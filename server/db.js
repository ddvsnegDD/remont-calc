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
export async function getActiveSubscription(userId) {
  const { rows } = await pool.query(
    `SELECT * FROM subscriptions WHERE user_id = $1 AND status IN ('trial', 'active') AND expires_at > NOW() ORDER BY expires_at DESC LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
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
  // завершаем текущие активные/триал/pending, чтобы не было дублей
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
export async function cancelSubscription(userId) {
  const { rows } = await pool.query(
    `UPDATE subscriptions SET status = 'cancelled', expires_at = NOW()
     WHERE user_id = $1 AND status IN ('trial', 'active') AND expires_at > NOW()
     RETURNING *`,
    [userId]
  );
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
      (SELECT COUNT(*) FROM subscriptions WHERE status = 'trial' AND expires_at > NOW()) AS active_trials,
      (SELECT COUNT(*) FROM subscriptions WHERE status = 'active' AND expires_at > NOW()) AS active_paid,
      (SELECT COUNT(*) FROM subscriptions WHERE status = 'pending') AS pending_payments
  `);
  const row = rows[0];
  return Object.fromEntries(Object.entries(row).map(([k, v]) => [k, Number(v)]));
}

export default pool;
