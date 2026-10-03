import pg from 'pg';
import { deleteUserFiles } from './storage.js';

const dbUrl = process.env.DATABASE_URL || '';
// Локальная БД на VPS (localhost / unix-socket) не требует SSL; облачная (Railway) — требует.
const isLocalDB = /localhost|127\.0\.0\.1|\/var\/run/.test(dbUrl);
const pool = new pg.Pool({
  connectionString: dbUrl,
  ssl: process.env.NODE_ENV === 'production' && !isLocalDB ? { rejectUnauthorized: false } : false,
});

export async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        phone VARCHAR(50),
        role VARCHAR(20) DEFAULT 'b2c',
        organization VARCHAR(255),
        position VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      -- Миграция: добавляем новые колонки если их нет
      ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'b2c';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS organization VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS position VARCHAR(255);
      CREATE TABLE IF NOT EXISTS auth_codes (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        code VARCHAR(6) NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      ALTER TABLE auth_codes ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0;
      CREATE TABLE IF NOT EXISTS subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        plan VARCHAR(50) NOT NULL DEFAULT 'monthly',
        status VARCHAR(50) NOT NULL DEFAULT 'trial',
        started_at TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        payment_label VARCHAR(255),
        payment_id VARCHAR(255),
        amount INTEGER,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS expiry_reminder_sent_at TIMESTAMPTZ;
      CREATE TABLE IF NOT EXISTS calculations (
        id           SERIAL PRIMARY KEY,
        user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        kind         VARCHAR(20) NOT NULL,      -- 'b2b' | 'office'
        project_name VARCHAR(255),
        data         JSONB NOT NULL,            -- answers/inputs + result, как сейчас в объекте calc
        created_at   TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS calculations_user_created ON calculations(user_id, created_at);

      CREATE TABLE IF NOT EXISTS checklists (
        id           SERIAL PRIMARY KEY,
        user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        checklist_id VARCHAR(50) NOT NULL,
        state        JSONB NOT NULL,            -- { items, meta }, в photos вместо base64 id фото
        updated_at   TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (user_id, checklist_id)
      );
      -- rev — растущее число от клиента (часть 5 ТЗ, правка ревью): защита от
      -- записи устаревшего состояния поверх нового при гонке двух PUT (например
      -- обычный запрос и keepalive-флеш при быстром уходе со страницы).
      ALTER TABLE checklists ADD COLUMN IF NOT EXISTS rev BIGINT NOT NULL DEFAULT 0;

      CREATE TABLE IF NOT EXISTS checklist_photos (
        id           SERIAL PRIMARY KEY,
        user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        checklist_id VARCHAR(50) NOT NULL,
        item_key     VARCHAR(20) NOT NULL,
        file_name    VARCHAR(100) NOT NULL,     -- случайное имя, не из запроса
        size_bytes   INTEGER NOT NULL,
        created_at   TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS checklist_photos_user ON checklist_photos(user_id);

      CREATE TABLE IF NOT EXISTS consultations (
        id           SERIAL PRIMARY KEY,
        user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at   TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS consultations_user_created ON consultations(user_id, created_at);

      -- Часть 1 TASK_yookassa.md. user_id — SET NULL, не CASCADE: записи о
      -- платежах при удалении аккаунта обезличиваются, а не исчезают (нужны
      -- для возвратов и сверки с «Мой налог» после удаления). email в эту
      -- таблицу не пишется вовсе.
      CREATE TABLE IF NOT EXISTS payments (
        id              SERIAL PRIMARY KEY,
        user_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
        plan            VARCHAR(50) NOT NULL,
        amount          INTEGER NOT NULL,                 -- в рублях, из PLANS на момент создания
        yookassa_id     VARCHAR(64) UNIQUE,                -- id платежа в ЮKassa
        status          VARCHAR(32) NOT NULL DEFAULT 'pending', -- pending | succeeded | canceled | refunded
        subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL,
        applied_at      TIMESTAMPTZ,                       -- когда выдан доступ; NOT NULL = платёж уже применён
        created_at      TIMESTAMPTZ DEFAULT NOW(),
        updated_at      TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS payments_user_id ON payments(user_id);
    `);
    console.log('DB tables ready');
  } finally {
    client.release();
  }
}

// --- Users ---
export async function findUserByEmail(email) {
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
  return rows[0] || null;
}

// По id, не по email — часть 2 TASK_yookassa.md: письмо владельцу об оплате
// (2.5) знает user_id платежа, но email в payments сознательно не хранится.
export async function findUserById(id) {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function createUser(email, name, phone, { role, organization, position } = {}) {
  const { rows } = await pool.query(
    `INSERT INTO users (email, name, phone, role, organization, position)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (email) DO UPDATE SET
       name = COALESCE(EXCLUDED.name, users.name),
       phone = COALESCE(EXCLUDED.phone, users.phone),
       role = CASE WHEN EXCLUDED.role = 'b2b' THEN 'b2b' ELSE users.role END,
       organization = COALESCE(EXCLUDED.organization, users.organization),
       position = COALESCE(EXCLUDED.position, users.position)
     RETURNING *`,
    [email.toLowerCase(), name || null, phone || null, role || 'b2c', organization || null, position || null]
  );
  return rows[0];
}

// --- Auth codes ---
export async function saveAuthCode(email, code) {
  const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 min
  await pool.query(
    'INSERT INTO auth_codes (email, code, expires_at) VALUES ($1, $2, $3)',
    [email.toLowerCase(), code, expires]
  );
}

export async function verifyAuthCode(email, code) {
  const mail = String(email || '').toLowerCase();
  const { rows } = await pool.query(
    `SELECT * FROM auth_codes
       WHERE email = $1 AND used = FALSE AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
    [mail]
  );
  const row = rows[0];
  if (!row) return false;

  if (String(row.code) !== String(code)) {
    const attempts = (row.attempts || 0) + 1;
    if (attempts >= 5) {
      await pool.query('UPDATE auth_codes SET attempts = $2, used = TRUE WHERE id = $1', [row.id, attempts]);
    } else {
      await pool.query('UPDATE auth_codes SET attempts = $2 WHERE id = $1', [row.id, attempts]);
    }
    return false;
  }

  await pool.query('UPDATE auth_codes SET used = TRUE WHERE id = $1', [row.id]);
  return true;
}

// --- Subscriptions ---
// started_at <= NOW(): часть 1.2 TASK_yookassa.md. Оплата вперёд (продление
// «в хвост», п. 1 «Решений владельца») может поставить подписку в очередь
// с started_at в будущем — до этого момента доступ по ней ещё не должен
// действовать, хотя status уже 'active' и expires_at ещё не прошёл.
export async function getActiveSubscription(userId) {
  const { rows } = await pool.query(
    `SELECT * FROM subscriptions
     WHERE user_id = $1 AND status IN ('trial', 'active') AND started_at <= NOW() AND expires_at > NOW()
     ORDER BY expires_at DESC LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

// Очередь оплаченных периодов (TASK_queue_ui.md, часть 1): текущая подписка
// и будущие (started_at позже NOW()), по порядку начала. Только для показа
// на странице — доступ по-прежнему определяет getActiveSubscription.
export async function getSubscriptionQueue(userId) {
  const { rows } = await pool.query(
    `SELECT plan, status, started_at, expires_at FROM subscriptions
     WHERE user_id = $1 AND status IN ('trial', 'active') AND expires_at > NOW()
     ORDER BY started_at ASC, id ASC`,
    [userId]
  );
  return rows;
}

// Подписки, которым пора напомнить об окончании (TASK_expiry_reminder.md):
// уже идут (started_at <= NOW()), заканчиваются в ближайшие `days` дней и
// письмо по ним ещё не отправлялось. Подписки без пользователя пропускаются.
// Правило «продолжение уже оплачено» применяет вызывающий (server.js).
export async function findExpiringSubscriptions(days) {
  const { rows } = await pool.query(
    `SELECT s.id, s.user_id, s.plan, s.status, s.started_at, s.expires_at, u.email
     FROM subscriptions s
     JOIN users u ON u.id = s.user_id
     WHERE s.user_id IS NOT NULL
       AND s.status IN ('trial', 'active')
       AND s.started_at <= NOW()
       AND s.expires_at > NOW()
       AND s.expires_at <= NOW() + INTERVAL '1 day' * $1
       AND s.expiry_reminder_sent_at IS NULL
     ORDER BY s.expires_at ASC, s.id ASC`,
    [days]
  );
  return rows;
}

// Захват отметки ПЕРЕД отправкой: true — строку обновили мы, значит отправляем;
// false — отметка уже стоит (другой прогон или прошлая отправка).
export async function claimReminder(subscriptionId) {
  const { rowCount } = await pool.query(
    `UPDATE subscriptions SET expiry_reminder_sent_at = NOW()
     WHERE id = $1 AND expiry_reminder_sent_at IS NULL RETURNING id`,
    [subscriptionId]
  );
  return rowCount > 0;
}

// Отправка не удалась — снимаем отметку, следующий прогон попробует снова.
export async function releaseReminder(subscriptionId) {
  await pool.query('UPDATE subscriptions SET expiry_reminder_sent_at = NULL WHERE id = $1', [subscriptionId]);
}

// Пробные планы — по plan, а не по status: status переписывают cancelSubscription
// и grantSubscription ('cancelled' / 'active'), а факт «триал брали» должен это
// пережить (часть 4 TASK_trial_b2b.md). db.js не импортирует PLANS из src/ (часть
// 1.3) — список захардкожен сознательно; новый пробный план дописывается сюда же.
const TRIAL_PLANS = ['trial', 'pro_trial'];

// План и срок решает вызывающий (server.js, у которого есть src/data/tariffs.js) —
// эта функция только слой доступа к БД и не импортирует ничего из src/.
export async function createTrialSubscription(userId, plan, days) {
  const existing = await getActiveSubscription(userId);
  if (existing) return { created: false, reason: 'active', subscription: existing };

  // Пробный доступ даётся один раз на аккаунт, независимо от плана.
  const { rows: past } = await pool.query(
    `SELECT id FROM subscriptions WHERE user_id = $1 AND plan = ANY($2::text[]) LIMIT 1`,
    [userId, TRIAL_PLANS]
  );
  if (past.length > 0) return { created: false, reason: 'used' };

  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const { rows } = await pool.query(
    `INSERT INTO subscriptions (user_id, plan, status, expires_at) VALUES ($1, $2, 'trial', $3) RETURNING *`,
    [userId, plan, expires]
  );
  return { created: true, subscription: rows[0] };
}

// Был ли когда-либо триал на аккаунте — тот же признак, что и внутри
// createTrialSubscription, нужен отдельно для /api/auth/me (часть 3 TASK_trial_b2b.md).
export async function hasUsedTrial(userId) {
  const { rows } = await pool.query(
    `SELECT id FROM subscriptions WHERE user_id = $1 AND plan = ANY($2::text[]) LIMIT 1`,
    [userId, TRIAL_PLANS]
  );
  return rows.length > 0;
}

// --- Grant subscription manually (admin) ---
export async function grantSubscription(userId, plan = 'yearly', days = 365) {
  // Завершаем текущие активные/триал/pending, чтобы не было дублей. Условие
  // не проверяет started_at — и не должно (часть 1.6 TASK_yookassa.md): здесь
  // нет фильтра по времени вовсе, поэтому строки с started_at в будущем
  // (подписка, поставленная в очередь оплатой) закрываются тем же запросом —
  // они тоже status='active', просто ещё не наступили. Добавлять отдельное
  // условие для «будущих» не нужно, оно уже покрыто.
  await pool.query(
    `UPDATE subscriptions SET status = 'cancelled', expires_at = NOW()
     WHERE user_id = $1 AND status IN ('trial', 'active', 'pending')`,
    [userId]
  );
  const { rows } = await pool.query(
    `INSERT INTO subscriptions (user_id, plan, status, started_at, expires_at)
     VALUES ($1, $2, 'active', NOW(), NOW() + INTERVAL '1 day' * $3) RETURNING *`,
    [userId, plan, days]
  );
  return rows[0];
}

// --- Cancel subscription ---
// Часть 2.6 TASK_yookassa.md убирает пользовательский POST
// /api/subscription/cancel (кнопка «Отменить подписку» — возврат теперь
// только через ЮKassa/applyRefund), но эта функция остаётся: её же вызывает
// отзыв подписки в админке (DELETE /api/admin/users/:id/subscription),
// который часть 2.6 явно не трогает (grep подтвердил — второе место
// использования). Тот же пробел с started_at, что был у getActiveSubscription
// (нашёл при аудите части 1.2), здесь не чиню: с админским отзывом
// в очереди почти никогда не сталкиваются (ручное действие, не поток
// платежей), а трогать поведение вне заявленной части — лишний риск.
export async function cancelSubscription(userId) {
  const { rows } = await pool.query(
    `UPDATE subscriptions SET status = 'cancelled', expires_at = NOW()
     WHERE user_id = $1 AND status IN ('trial', 'active') AND expires_at > NOW()
     RETURNING *`,
    [userId]
  );
  return rows[0] || null;
}

// --- Payments (TASK_yookassa.md) ---

// db.js не импортирует src/ (см. TRIAL_PLANS выше — тот же приём и та же
// причина). Нужно различать клубные и PRO подписки среди уже существующих
// строк subscriptions при выдаче нового платежа (см. applySucceededPayment) —
// список зеркалит src/data/tariffs.js, новый план дописывается сюда же.
const PLAN_TIER = {
  monthly: 'club', yearly: 'club', trial: 'club', // legacy (до разделения тарифов)
  club_monthly: 'club', club_yearly: 'club',
  pro_monthly: 'pro', pro_trial: 'pro',
};
function planTier(plan) {
  return PLAN_TIER[plan] || 'club'; // неизвестный legacy — считаем клубным, как tierOf в tariffs.js
}

// err.code — а не текст сообщения — разбор в server.js: аккаунт удалился до
// применения платежа, выдавать подписку некому (часть 2.3/2.5 ТЗ).
function orphanedPaymentError(message) {
  const err = new Error(message);
  err.code = 'PAYMENT_ORPHANED';
  return err;
}

// Выдача доступа по успешному платежу. tier/days — из tariffs.js, считает
// вызывающий (server.js), db.js их не знает (см. PLAN_TIER выше).
//
// Идемпотентность: SELECT ... FOR UPDATE строки payments — если applied_at
// уже стоит, ничего не меняем и возвращаем уже выданную подписку (ЮKassa
// повторяет вебхуки, плюс GET /api/payments/:id может опросить и применить
// тем же путём, если вебхук запаздывает — двойная выдача недопустима).
//
// Активные и будущие подписки пользователя ищем БЕЗ started_at <= NOW() —
// здесь специально нужна вся очередь (текущее и уже поставленное в очередь),
// не только то, что действует прямо сейчас.
export async function applySucceededPayment(paymentId, tier, days) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: prows } = await client.query('SELECT * FROM payments WHERE id = $1 FOR UPDATE', [paymentId]);
    const payment = prows[0];
    if (!payment) { await client.query('ROLLBACK'); return null; }

    if (payment.applied_at) {
      const { rows: srows } = await client.query('SELECT * FROM subscriptions WHERE id = $1', [payment.subscription_id]);
      await client.query('COMMIT');
      return { applied: false, subscription: srows[0] || null };
    }

    if (!payment.user_id) {
      // Аккаунт удалился между созданием платежа и приходом успеха от ЮKassa —
      // редкий случай, выдавать подписку некому. Роняем транзакцию: платёж
      // остаётся неприменённым. err.code — вызывающий код (server.js) по нему,
      // а не по тексту сообщения, отличает этот случай от сбоя БД/API: шлёт
      // владельцу письмо «Оплата без аккаунта» и отвечает ЮKassa 200 (не 500),
      // чтобы не спровоцировать повтор уведомления (часть 2.3/2.5 ТЗ).
      await client.query('ROLLBACK');
      throw orphanedPaymentError(`applySucceededPayment: payment ${paymentId} has no user_id (account deleted?)`);
    }

    const { plan, user_id: userId, yookassa_id: yookassaId, amount } = payment;

    // Сериализация по пользователю (правка ревью части 1): если активных
    // подписок ещё нет вовсе, SELECT ... FOR UPDATE ниже по subscriptions
    // не блокирует ничего (нечего блокировать) — два платежа одного
    // пользователя, применяемые одновременно (два вебхука, или вебхук и
    // GET /api/payments/:id одновременно), оба увидели бы пустой existing
    // и оба посчитали бы start = NOW(), перекрыв друг друга. Блокировка
    // строки users — тот якорь, которого не хватает пустой выборке: вторая
    // транзакция ждёт на этом FOR UPDATE, пока первая не дойдёт до COMMIT,
    // и только потом читает existing — к этому моменту первая подписка уже
    // вставлена и видна, очередь строится правильно.
    const { rows: urows } = await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
    if (!urows[0]) {
      // Аккаунт удалился между чтением payment.user_id (строкой выше) и этой
      // блокировкой — тот же случай, что и !payment.user_id, просто пойман
      // на шаг позже.
      await client.query('ROLLBACK');
      throw orphanedPaymentError(`applySucceededPayment: user ${userId} not found (deleted?)`);
    }

    const { rows: existing } = await client.query(
      `SELECT * FROM subscriptions WHERE user_id = $1 AND status IN ('trial', 'active') AND expires_at > NOW() FOR UPDATE`,
      [userId]
    );

    let start;
    if (tier === 'pro') {
      const clubIds = existing.filter(r => planTier(r.plan) === 'club').map(r => r.id);
      const proRows = existing.filter(r => planTier(r.plan) === 'pro');
      if (clubIds.length > 0) {
        // Текущие клубные — закрываем прямо сейчас; будущие (в очереди,
        // started_at ещё не наступил) — просто отменяем статус, expires_at
        // трогать незачем (недействовавший период, наружу это не влияет).
        await client.query(
          `UPDATE subscriptions SET status = 'cancelled', expires_at = NOW()
           WHERE id = ANY($1::int[]) AND started_at <= NOW()`,
          [clubIds]
        );
        await client.query(
          `UPDATE subscriptions SET status = 'cancelled'
           WHERE id = ANY($1::int[]) AND started_at > NOW()`,
          [clubIds]
        );
      }
      start = proRows.length > 0
        ? proRows.reduce((max, r) => (new Date(r.expires_at) > max ? new Date(r.expires_at) : max), new Date(0))
        : new Date();
    } else {
      start = existing.length > 0
        ? existing.reduce((max, r) => (new Date(r.expires_at) > max ? new Date(r.expires_at) : max), new Date(0))
        : new Date();
    }

    const expiresAt = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
    const { rows: newSub } = await client.query(
      `INSERT INTO subscriptions (user_id, plan, status, started_at, expires_at, payment_id, amount)
       VALUES ($1, $2, 'active', $3, $4, $5, $6) RETURNING *`,
      [userId, plan, start, expiresAt, yookassaId, amount]
    );

    await client.query(
      `UPDATE payments SET status = 'succeeded', subscription_id = $2, applied_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [paymentId, newSub[0].id]
    );

    await client.query('COMMIT');
    return { applied: true, subscription: newSub[0] };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// Сколько миллисекунд освобождает возвращаемая подписка (TASK_refund_queue_shift.md).
// Чистая функция, без БД. Считается только для active/trial с expires_at > now:
// - уже началась (started_at <= now): freed = expires_at - now (остаток);
// - в очереди (started_at > now): freed = expires_at - started_at (вся длина).
// cancelled/refunded/истёкшая — 0: отменённую покупкой PRO клубную подписку
// усекли ещё в момент отмены, сдвигать после неё нечего.
export function computeRefundShift(refunded, now) {
  if (!refunded || (refunded.status !== 'active' && refunded.status !== 'trial')) return 0;
  const started = new Date(refunded.started_at).getTime();
  const expires = new Date(refunded.expires_at).getTime();
  const nowMs = new Date(now).getTime();
  if (!(expires > nowMs)) return 0;
  return started <= nowMs ? expires - nowMs : expires - started;
}

// Возврат по yookassa_id платежа. Идемпотентно (status='refunded' на payments —
// ветка alreadyRefunded срабатывает до любых изменений, повтор ничего не двигает).
// Цепочка подписок пользователя стыкуется вплотную (started_at следующей =
// expires_at предыдущей, см. applySucceededPayment), поэтому освободившийся
// интервал сдвигает назад все подписки, стоявшие в очереди после возвращённой:
// первая из них стартует в момент возврата, без разрыва. Блокировки в том же
// порядке, что в applySucceededPayment: сначала payments, затем users.
export async function applyRefund(yookassaPaymentId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: prows } = await client.query('SELECT * FROM payments WHERE yookassa_id = $1 FOR UPDATE', [yookassaPaymentId]);
    const payment = prows[0];
    if (!payment) { await client.query('ROLLBACK'); return null; }

    if (payment.status === 'refunded') {
      await client.query('COMMIT');
      return { alreadyRefunded: true, shifted: 0, payment };
    }

    // Аккаунт удалён (user_id пуст) — сдвигать нечего, подписки у него уже нет.
    if (payment.user_id) {
      await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [payment.user_id]);
    }

    let shifted = 0;
    if (payment.subscription_id) {
      // Состояние подписки читаем ДО закрытия: freed и прежний expires_at
      // нужны для сдвига очереди. NOW() в транзакции постоянен, поэтому
      // db_now совпадает с NOW() в UPDATE ниже.
      const { rows: srows } = await client.query(
        'SELECT *, NOW() AS db_now FROM subscriptions WHERE id = $1 FOR UPDATE',
        [payment.subscription_id]
      );
      const sub = srows[0];

      // Сдвиг очереди — до закрытия возвращаемой подписки: граница «стоят после
      // неё» берётся из её ещё не усечённого expires_at прямо в SQL (без
      // округления через JS Date).
      const freedMs = payment.user_id && sub ? computeRefundShift(sub, sub.db_now) : 0;
      if (freedMs > 0) {
        const { rowCount } = await client.query(
          `UPDATE subscriptions
           SET started_at = started_at - ($3::double precision * interval '1 millisecond'),
               expires_at = expires_at - ($3::double precision * interval '1 millisecond')
           WHERE user_id = $1 AND status IN ('trial', 'active')
             AND id <> $2
             AND started_at >= (SELECT expires_at FROM subscriptions WHERE id = $2)`,
          [payment.user_id, sub.id, freedMs]
        );
        shifted = rowCount;
      }

      // Ещё не истекла и уже началась (started_at <= NOW()) — обрезаем прямо
      // сейчас (LEAST на случай, если уже истекла бы раньше NOW() сама по
      // себе — не отодвигаем конец назад). Ещё не началась (в очереди) —
      // только статус, expires_at не трогаем: диапазон started_at..expires_at
      // никогда не был в силе, поправлять нечего.
      await client.query(
        `UPDATE subscriptions
         SET status = 'refunded',
             expires_at = CASE WHEN started_at <= NOW() THEN LEAST(expires_at, NOW()) ELSE expires_at END
         WHERE id = $1`,
        [payment.subscription_id]
      );
    }

    const { rows } = await client.query(
      `UPDATE payments SET status = 'refunded', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [payment.id]
    );
    await client.query('COMMIT');
    return { alreadyRefunded: false, shifted, payment: rows[0] };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// Простой доступ к строкам payments — часть 2 TASK_yookassa.md
// (POST /api/payments/create, вебхук, GET /api/payments/:id).

export async function createPendingPayment(userId, plan, amount) {
  const { rows } = await pool.query(
    `INSERT INTO payments (user_id, plan, amount, status) VALUES ($1, $2, $3, 'pending') RETURNING *`,
    [userId, plan, amount]
  );
  return rows[0];
}

export async function setPaymentYookassaId(paymentId, yookassaId) {
  const { rows } = await pool.query(
    'UPDATE payments SET yookassa_id = $2, updated_at = NOW() WHERE id = $1 RETURNING *',
    [paymentId, yookassaId]
  );
  return rows[0] || null;
}

// Только свой платёж — чужой id даёт пустой результат, вызывающий код
// (server.js) отвечает 404, не подтверждая существование записи (как и
// остальные ownership-проверки в проекте, часть 3 TASK_server_storage.md).
export async function getPaymentById(userId, id) {
  const { rows } = await pool.query(
    'SELECT * FROM payments WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  return rows[0] || null;
}

export async function getPaymentByYookassaId(yookassaId) {
  const { rows } = await pool.query('SELECT * FROM payments WHERE yookassa_id = $1', [yookassaId]);
  return rows[0] || null;
}

export async function markPaymentStatus(id, status) {
  const { rows } = await pool.query(
    'UPDATE payments SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *',
    [id, status]
  );
  return rows[0] || null;
}

// GET /api/payments/:id показывает план/сроки подписки, выданной именно этим
// платежом — не обязательно текущую активную (её могла закрыть последующая
// покупка PRO), поэтому берём по id, а не через getActiveSubscription.
export async function getSubscriptionById(id) {
  const { rows } = await pool.query('SELECT * FROM subscriptions WHERE id = $1', [id]);
  return rows[0] || null;
}

// --- Delete user ---
// subscriptions.user_id — без ON DELETE (не трогаем, часть 1 TASK_server_storage.md),
// поэтому удаляем вручную в транзакции; calculations/checklists/checklist_photos/
// consultations удалятся сами через ON DELETE CASCADE на их собственных FK.
export async function deleteUser(userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Часть 1.5 TASK_yookassa.md: платежи обезличиваются, не удаляются
    // (нужны для возвратов и сверки с «Мой налог»). FK payments.subscription_id/
    // user_id сами обнулились бы через ON DELETE SET NULL при удалении
    // subscriptions/users ниже — обнуляем явно заранее, чтобы порядок
    // удаления не зависел от того, в каком порядке сработают констрейнты.
    await client.query('UPDATE payments SET subscription_id = NULL, user_id = NULL WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM subscriptions WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM auth_codes WHERE email = (SELECT email FROM users WHERE id = $1)', [userId]);
    const { rows } = await client.query('DELETE FROM users WHERE id = $1 RETURNING *', [userId]);
    await client.query('COMMIT');
    // Файлы — вне транзакции БД и осознанно после COMMIT: если удаление на диске
    // упадёт, запись в базе уже не откатываем (лишние файлы лучше, чем ссылка
    // на удалённого пользователя). Ошибка только логируется. Вызываем, только
    // если пользователь реально был удалён (rows[0] есть) — иначе userId мог
    // не существовать вовсе, и звать deleteUserFiles не на что.
    try {
      if (rows[0]) await deleteUserFiles(userId);
    } catch (err) {
      console.error('deleteUserFiles error:', err);
    }
    return rows[0] || null;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// --- Calculations / checklists / checklist photos / consultations ---
// Часть 3 TASK_server_storage.md.

// Начало текущего календарного месяца по Москве, как TIMESTAMPTZ — для лимитов
// «N в месяц». Двойной AT TIME ZONE: первый разворот переводит NOW() в
// московское время (naive timestamp), date_trunc берёт начало месяца по этому
// времени, второй разворот переводит обратно в TIMESTAMPTZ (UTC-инстант
// начала месяца) — так сравнение с индексируемым created_at использует индекс.
const MONTH_START_MOSCOW_SQL = `(date_trunc('month', NOW() AT TIME ZONE 'Europe/Moscow') AT TIME ZONE 'Europe/Moscow')`;

export async function listCalculations(userId) {
  const { rows } = await pool.query(
    'SELECT * FROM calculations WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );
  return rows;
}

// Только 'b2b' считаем для лимита бесплатного плана — 'office' всегда требует pro.
export async function countB2BCalculationsThisMonth(userId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*) FROM calculations
     WHERE user_id = $1 AND kind = 'b2b' AND created_at >= ${MONTH_START_MOSCOW_SQL}`,
    [userId]
  );
  return Number(rows[0].count);
}

export async function createCalculation(userId, kind, projectName, data) {
  const { rows } = await pool.query(
    'INSERT INTO calculations (user_id, kind, project_name, data) VALUES ($1, $2, $3, $4) RETURNING *',
    [userId, kind, projectName, JSON.stringify(data)]
  );
  return rows[0];
}

export async function deleteCalculation(userId, id) {
  const { rows } = await pool.query(
    'DELETE FROM calculations WHERE id = $1 AND user_id = $2 RETURNING id',
    [id, userId]
  );
  return rows[0] || null;
}

// pg отдаёт BIGINT строкой (защита от потери точности для значений вне
// диапазона JS-числа) — наши rev — Date.now(), в пределах Number.MAX_SAFE_INTEGER,
// приводим к числу сразу, иначе rev.current + 1 на клиенте конкатенирует строки.
function rowWithNumericRev(row) {
  return row ? { ...row, rev: Number(row.rev) } : row;
}

export async function listChecklists(userId) {
  const { rows } = await pool.query(
    'SELECT checklist_id, state, rev, updated_at FROM checklists WHERE user_id = $1',
    [userId]
  );
  return rows.map(rowWithNumericRev);
}

export async function getChecklist(userId, checklistId) {
  const { rows } = await pool.query(
    'SELECT checklist_id, state, rev, updated_at FROM checklists WHERE user_id = $1 AND checklist_id = $2',
    [userId, checklistId]
  );
  return rowWithNumericRev(rows[0] || null);
}

// rev — растущее число от клиента, защита от записи устаревшего состояния
// поверх нового при гонке двух PUT одного пользователя (часть 5 ТЗ, правка
// ревью). WHERE в DO UPDATE отклоняет запись, если пришедший rev не новее
// сохранённого — тогда запрос не обновляет строку и RETURNING не возвращает
// её; вызывающий код (server.js) трактует null как «отклонено, не ошибка».
export async function upsertChecklist(userId, checklistId, state, rev) {
  const { rows } = await pool.query(
    `INSERT INTO checklists (user_id, checklist_id, state, rev, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (user_id, checklist_id) DO UPDATE
       SET state = EXCLUDED.state, rev = EXCLUDED.rev, updated_at = NOW()
       WHERE checklists.rev < EXCLUDED.rev
     RETURNING checklist_id, state, rev, updated_at`,
    [userId, checklistId, JSON.stringify(state), rev]
  );
  return rowWithNumericRev(rows[0] || null);
}

export async function deleteChecklist(userId, checklistId) {
  const { rows } = await pool.query(
    'DELETE FROM checklists WHERE user_id = $1 AND checklist_id = $2 RETURNING id',
    [userId, checklistId]
  );
  return rows[0] || null;
}

// Id фото, реально принадлежащих этому пользователю и этому чек-листу — для
// валидации state.items[*].photos перед сохранением (PUT /api/checklists/:id).
export async function listChecklistPhotoIds(userId, checklistId) {
  const { rows } = await pool.query(
    'SELECT id FROM checklist_photos WHERE user_id = $1 AND checklist_id = $2',
    [userId, checklistId]
  );
  return rows.map(r => r.id);
}

export async function countChecklistItemPhotos(userId, checklistId, itemKey) {
  const { rows } = await pool.query(
    'SELECT COUNT(*) FROM checklist_photos WHERE user_id = $1 AND checklist_id = $2 AND item_key = $3',
    [userId, checklistId, itemKey]
  );
  return Number(rows[0].count);
}

export async function sumUserPhotoBytes(userId) {
  const { rows } = await pool.query(
    'SELECT COALESCE(SUM(size_bytes), 0) AS total FROM checklist_photos WHERE user_id = $1',
    [userId]
  );
  return Number(rows[0].total);
}

export async function createChecklistPhoto(userId, checklistId, itemKey, fileName, sizeBytes) {
  const { rows } = await pool.query(
    `INSERT INTO checklist_photos (user_id, checklist_id, item_key, file_name, size_bytes)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [userId, checklistId, itemKey, fileName, sizeBytes]
  );
  return rows[0];
}

export async function getChecklistPhoto(userId, id) {
  const { rows } = await pool.query(
    'SELECT * FROM checklist_photos WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  return rows[0] || null;
}

export async function deleteChecklistPhoto(userId, id) {
  const { rows } = await pool.query(
    'DELETE FROM checklist_photos WHERE id = $1 AND user_id = $2 RETURNING *',
    [id, userId]
  );
  return rows[0] || null;
}

// Удаляет записи фото этого чек-листа и возвращает их file_name — вызывающий
// код (server.js) удаляет сами файлы через server/storage.js.
export async function deleteChecklistPhotosByChecklist(userId, checklistId) {
  const { rows } = await pool.query(
    'DELETE FROM checklist_photos WHERE user_id = $1 AND checklist_id = $2 RETURNING file_name',
    [userId, checklistId]
  );
  return rows;
}

export async function countConsultationsThisMonth(userId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*) FROM consultations WHERE user_id = $1 AND created_at >= ${MONTH_START_MOSCOW_SQL}`,
    [userId]
  );
  return Number(rows[0].count);
}

export async function createConsultation(userId) {
  const { rows } = await pool.query('INSERT INTO consultations (user_id) VALUES ($1) RETURNING *', [userId]);
  return rows[0];
}

// --- Admin ---
export async function getAllUsers() {
  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.name, u.phone, u.role, u.organization, u.position, u.created_at,
       s.plan AS sub_plan, s.status AS sub_status, s.expires_at AS sub_expires
     FROM users u
     LEFT JOIN LATERAL (
       SELECT plan, status, expires_at FROM subscriptions
       WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1
     ) s ON true
     ORDER BY u.created_at DESC`
  );
  return rows;
}

// Найдено попутно при аудите BIGINT/COUNT (правка ревью части 5
// TASK_server_storage.md): COUNT(*) тоже отдаётся pg строкой (bigint),
// здесь не влияло на вид (значения только отображаются в AdminPage.jsx),
// но приводим к числу для консистентности с остальными COUNT в этом файле.
export async function getAdminStats() {
  const { rows } = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM users) AS total_users,
      (SELECT COUNT(*) FROM users WHERE role = 'b2c') AS b2c_users,
      (SELECT COUNT(*) FROM users WHERE role = 'b2b') AS b2b_users,
      -- Триалы не встают в очередь (createTrialSubscription всегда стартует
      -- сейчас же) — started_at <= NOW() здесь не нужен, у трайлов это верно
      -- по построению. active_paid — из оплаты, которая может быть в очереди
      -- (часть 1.2/1.3 TASK_yookassa.md), поэтому фильтр обязателен, иначе
      -- статистика посчитает ещё не начавшийся доступ как уже активный.
      (SELECT COUNT(*) FROM subscriptions WHERE status = 'trial' AND expires_at > NOW()) AS active_trials,
      (SELECT COUNT(*) FROM subscriptions WHERE status = 'active' AND started_at <= NOW() AND expires_at > NOW()) AS active_paid,
      (SELECT COUNT(*) FROM subscriptions WHERE status = 'pending') AS pending_payments
  `);
  const row = rows[0];
  return Object.fromEntries(Object.entries(row).map(([k, v]) => [k, Number(v)]));
}

export default pool;
