import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { resolve, join } from 'path';
import pool, { initDB, findUserByEmail, createUser, saveAuthCode, verifyAuthCode, getActiveSubscription, createTrialSubscription, createPendingSubscription, activateSubscription, cancelSubscription, grantSubscription, deleteUser, getAllUsers, getAdminStats } from './server/db.js';
import { sendAuthCode, sendRawEmail } from './server/email.js';
import { PLANS, tierOf } from './src/data/tariffs.js';

const app = express();
app.set('trust proxy', 1); // за Nginx reverse-proxy (VPS): корректный req.ip/req.protocol и secure-кука по HTTPS
const PORT = process.env.PORT || 3000;
const DIST = resolve('dist');
const JWT_SECRET = process.env.JWT_SECRET || 'rpkm-dev-secret-change-in-prod';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'rpkm-admin-2026';
const YOOMONEY_WALLET = process.env.YOOMONEY_WALLET || '4100183647078';
const YOOMONEY_SECRET = process.env.YOOMONEY_SECRET || '';
const SITE_URL = process.env.APP_URL // явный публичный URL (VPS): https://ddrpkm.ru
  || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null)
  || `http://localhost:${PORT}`;

// Флаг доступности БД
let dbReady = false;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Middleware: проверка доступности БД для auth-роутов
// Простой in-memory rate limit: не более max обращений по ключу за windowMs.
// Переиспользуется публичными эндпоинтами, которые отправляют почту.
const rateLimitHits = new Map();
function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const hits = (rateLimitHits.get(key) || []).filter(t => now - t < windowMs);
  if (hits.length >= max) { rateLimitHits.set(key, hits); return false; }
  hits.push(now);
  rateLimitHits.set(key, hits);
  return true;
}

// Периодическая уборка, чтобы Map не рос бесконечно
setInterval(() => {
  const now = Date.now();
  for (const [key, hits] of rateLimitHits) {
    const alive = hits.filter(t => now - t < 60 * 60 * 1000);
    if (alive.length) rateLimitHits.set(key, alive); else rateLimitHits.delete(key);
  }
}, 30 * 60 * 1000).unref();

function requireDB(req, res, next) {
  if (!dbReady) return res.status(503).json({ ok: false, error: 'База данных не подключена. Авторизация недоступна.' });
  next();
}

// --- JWT helpers ---
function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
}

function authMiddleware(req, res, next) {
  const token = req.cookies?.rpkm_token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ ok: false, error: 'Не авторизован' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ ok: false, error: 'Сессия истекла' });
  }
}

// ==================== HEALTH CHECK ====================

app.get('/api/health', async (req, res) => {
  const status = { server: true, db: dbReady, email: !!((process.env.SMTP_USER && process.env.SMTP_PASS) || process.env.UNISENDER_GO_API_KEY || process.env.BREVO_API_KEY || process.env.RESEND_API_KEY) };
  try {
    if (dbReady) {
      const { rows } = await pool.query('SELECT 1');
      status.dbLive = rows.length > 0;
    }
  } catch (err) {
    status.dbLive = false;
    status.dbError = err.message;
  }
  res.json(status);
});

// ==================== AUTH API ====================

// Отправить код на email
app.post('/api/auth/send-code', requireDB, async (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) return res.status(400).json({ ok: false, error: 'Введите email' });
  const code = String(Math.floor(1000 + Math.random() * 9000)); // 4 digits
  try {
    await saveAuthCode(email, code);
    // Отправляем email в фоне — не блокируем ответ
    sendAuthCode(email, code).catch(err => console.error('Email bg error:', err.message));
    res.json({ ok: true });
  } catch (err) {
    console.error('send-code error:', err);
    res.status(500).json({ ok: false, error: 'Ошибка отправки кода' });
  }
});

// Проверить код, войти/зарегистрироваться
app.post('/api/auth/verify', requireDB, async (req, res) => {
  const { email, code, name, phone, role, organization, position } = req.body;
  if (!email || !code) return res.status(400).json({ ok: false, error: 'Введите email и код' });
  try {
    const valid = await verifyAuthCode(email, code);
    if (!valid) return res.status(400).json({ ok: false, error: 'Неверный или просроченный код' });
    const user = await createUser(email, name, phone, { role, organization, position });
    const sub = await getActiveSubscription(user.id);
    const token = signToken(user);
    res.cookie('rpkm_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    res.json({ ok: true, user: { id: user.id, email: user.email, name: user.name, phone: user.phone, role: user.role, organization: user.organization }, subscription: sub });
  } catch (err) {
    console.error('verify error:', err);
    res.status(500).json({ ok: false, error: 'Ошибка входа' });
  }
});

// Текущий пользователь + подписка
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const user = await findUserByEmail(req.user.email);
    if (!user) return res.status(401).json({ ok: false, error: 'Пользователь не найден' });
    const sub = await getActiveSubscription(user.id);
    res.json({
      ok: true,
      user: { id: user.id, email: user.email, name: user.name, phone: user.phone, role: user.role, organization: user.organization },
      subscription: sub ? { plan: sub.plan, status: sub.status, expiresAt: sub.expires_at, tier: tierOf(sub.plan) } : null,
    });
  } catch (err) {
    console.error('me error:', err);
    res.status(500).json({ ok: false, error: 'Ошибка' });
  }
});

// Выход
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('rpkm_token');
  res.json({ ok: true });
});

// ==================== SUBSCRIPTION API ====================
// Тарифы (PLANS) — единый источник из src/data/tariffs.js

// Статус подписки
app.get('/api/subscription/status', authMiddleware, async (req, res) => {
  try {
    const user = await findUserByEmail(req.user.email);
    const sub = await getActiveSubscription(user.id);
    res.json({
      ok: true,
      hasAccess: !!sub,
      subscription: sub ? { plan: sub.plan, status: sub.status, expiresAt: sub.expires_at, tier: tierOf(sub.plan) } : null,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Ошибка' });
  }
});

// Создать платёж → редирект на ЮMoney
app.post('/api/subscription/pay', authMiddleware, async (req, res) => {
  const { plan } = req.body;
  const planData = PLANS[plan];
  if (!planData) return res.status(400).json({ ok: false, error: 'Неверный план' });

  try {
    const user = await findUserByEmail(req.user.email);
    const label = `sub_${user.id}_${Date.now()}`;
    await createPendingSubscription(user.id, plan, label, planData.price);

    // Возврат по уровню плана: PRO → /pro, Клуб → /club
    const returnPath = planData.tier === 'pro' ? '/pro' : '/club';
    const params = new URLSearchParams({
      receiver: YOOMONEY_WALLET,
      'quickpay-form': 'button',
      paymentType: 'AC',
      sum: String(planData.price),
      label,
      targets: planData.label,
      successURL: `${SITE_URL}${returnPath}?payment=success&label=${label}`,
    });
    const paymentUrl = `https://yoomoney.ru/quickpay/confirm?${params}`;
    res.json({ ok: true, paymentUrl, label });
  } catch (err) {
    console.error('pay error:', err);
    res.status(500).json({ ok: false, error: 'Ошибка создания платежа' });
  }
});

// Вебхук ЮMoney — уведомление об оплате
app.post('/api/subscription/yoomoney-webhook', async (req, res) => {
  const { notification_type, operation_id, amount, currency, datetime, sender, codepro, label, sha1_hash } = req.body;
  console.log('💰 ЮMoney webhook:', { label, amount, operation_id });

  // Верификация подписи (если настроен секрет)
  if (YOOMONEY_SECRET) {
    const checkStr = `${notification_type}&${operation_id}&${amount}&${currency}&${datetime}&${sender}&${codepro}&${YOOMONEY_SECRET}&${label}`;
    const hash = crypto.createHash('sha1').update(checkStr).digest('hex');
    if (hash !== sha1_hash) {
      console.error('ЮMoney: неверная подпись');
      return res.status(400).send('Invalid signature');
    }
  }

  if (!label) return res.status(400).send('No label');

  try {
    const sub = await activateSubscription(label);
    if (sub) {
      console.log(`✅ Подписка активирована: user_id=${sub.user_id}, plan=${sub.plan}, до ${sub.expires_at}`);
    } else {
      console.warn('⚠️  Подписка не найдена для label:', label);
    }
    res.send('OK');
  } catch (err) {
    console.error('webhook error:', err);
    res.status(500).send('Error');
  }
});

// Активировать триал (только по кнопке «Попробовать 14 дней»)
app.post('/api/subscription/trial', authMiddleware, async (req, res) => {
  try {
    const user = await findUserByEmail(req.user.email);
    if (user.role === 'b2b') return res.status(400).json({ ok: false, error: 'Триал только для физических лиц' });
    const sub = await createTrialSubscription(user.id);
    if (!sub) return res.json({ ok: false, error: 'Триал уже был использован' });
    res.json({ ok: true, subscription: { plan: sub.plan, status: sub.status, expiresAt: sub.expires_at } });
  } catch (err) {
    console.error('trial error:', err);
    res.status(500).json({ ok: false, error: 'Ошибка' });
  }
});

// Отменить подписку
app.post('/api/subscription/cancel', authMiddleware, async (req, res) => {
  try {
    const user = await findUserByEmail(req.user.email);
    const sub = await cancelSubscription(user.id);
    if (!sub) return res.json({ ok: false, error: 'Нет активной подписки' });
    // Отправить email админу
    sendRawEmail('ddv1121@yandex.ru',
      `Отмена подписки: ${user.email}`,
      `<p>Пользователь <strong>${user.name || user.email}</strong> (${user.email}) отменил подписку.</p><p>План: ${sub.plan}</p><p>Дата отмены: ${new Date().toLocaleString('ru-RU')}</p>`
    ).catch(err => console.error('Cancel notify error:', err.message));
    res.json({ ok: true });
  } catch (err) {
    console.error('cancel error:', err);
    res.status(500).json({ ok: false, error: 'Ошибка' });
  }
});

// Ручная активация (для демо / после возврата с ЮMoney)
app.post('/api/subscription/activate', authMiddleware, async (req, res) => {
  const { label } = req.body;
  if (!label) return res.status(400).json({ ok: false });
  try {
    const sub = await activateSubscription(label);
    res.json({ ok: !!sub, subscription: sub });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Ошибка' });
  }
});

// ==================== ADMIN API ====================

function adminAuth(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (token !== ADMIN_PASSWORD) return res.status(403).json({ ok: false, error: 'Доступ запрещён' });
  next();
}

app.get('/api/admin/stats', requireDB, adminAuth, async (req, res) => {
  try {
    const stats = await getAdminStats();
    res.json({ ok: true, stats });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/admin/users', requireDB, adminAuth, async (req, res) => {
  try {
    const users = await getAllUsers();
    res.json({ ok: true, users });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Удаление пользователя
app.delete('/api/admin/users/:id', requireDB, adminAuth, async (req, res) => {
  try {
    const user = await deleteUser(Number(req.params.id));
    if (!user) return res.status(404).json({ ok: false, error: 'Пользователь не найден' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Выдать подписку вручную
app.post('/api/admin/users/:id/subscription', requireDB, adminAuth, async (req, res) => {
  try {
    // План — конкретный id из PLANS (club_monthly | club_yearly | pro_monthly); дефолт — клубный годовой
    const plan = PLANS[req.body?.plan] ? req.body.plan : 'club_yearly';
    const days = Math.max(1, Math.min(36500, Number(req.body?.days) || PLANS[plan].days));
    const sub = await grantSubscription(Number(req.params.id), plan, days);
    res.json({ ok: true, subscription: sub });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Отозвать подписку вручную
app.delete('/api/admin/users/:id/subscription', requireDB, adminAuth, async (req, res) => {
  try {
    await cancelSubscription(Number(req.params.id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ==================== CONSULTATION API ====================

app.post('/api/consultation', authMiddleware, async (req, res) => {
  try {
    const user = await findUserByEmail(req.user.email);
    if (!user) return res.status(401).json({ ok: false, error: 'Пользователь не найден' });

    // Проверяем подписку
    const sub = await getActiveSubscription(user.id);
    if (!sub) return res.status(403).json({ ok: false, error: 'Нет активной подписки' });

    // Email-уведомление админу
    sendRawEmail(
      'ddv1121@yandex.ru',
      `Запись на консультацию: ${user.name || user.email}`,
      `<div style="font-family:Arial,sans-serif;max-width:500px;padding:20px">
        <h2 style="color:#B95C38;margin:0 0 16px">🔔 Новая запись на консультацию</h2>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:8px 0;color:#6b7280;width:120px">Имя:</td><td style="padding:8px 0;font-weight:600">${user.name || '—'}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">Email:</td><td style="padding:8px 0;font-weight:600">${user.email}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">Телефон:</td><td style="padding:8px 0;font-weight:600">${user.phone || '—'}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">Подписка:</td><td style="padding:8px 0">${sub.plan} до ${new Date(sub.expires_at).toLocaleDateString('ru-RU')}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">Дата:</td><td style="padding:8px 0">${new Date().toLocaleString('ru-RU')}</td></tr>
        </table>
        <hr style="border:none;border-top:1px solid #e4e4e7;margin:16px 0">
        <p style="color:#9ca3af;font-size:12px">РПКМ · Автоматическое уведомление</p>
      </div>`
    ).catch(err => console.error('Consultation notify error:', err.message));

    res.json({ ok: true });
  } catch (err) {
    console.error('consultation error:', err);
    res.status(500).json({ ok: false, error: 'Ошибка записи на консультацию' });
  }
});

// ==================== STATIC + SPA ====================

// ==================== CALCULATION EMAIL API ====================

// Письмо собирается ТОЛЬКО из числовых полей result на сервере.
// Пользовательский текст в письмо не попадает — иначе эндпоинт превращается
// в открытый релей для рассылки произвольного содержимого от нашего домена.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Число из клиентских данных: только конечное число, иначе 0.
const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

// Название категории берём из своего словаря по ключу, а не из присланной строки:
// иначе через tierLabel в письмо можно протащить произвольный текст.
const TIER_LABELS = {
  cosmetic: 'Косметический', capital: 'Капитальный',
  euro: 'Евроремонт', euro_top: 'Евроремонт+', premium: 'Премиум', luxury: 'Luxury',
};
const tierLabel = key => TIER_LABELS[key] || '—';
const rub = v => Math.round(num(v)).toLocaleString('ru-RU') + ' ₽';

function calcEmailHtml({ name, kind, result }) {
  const safeName = escapeHtml(name);
  const row = (label, value) =>
    `<tr><td style="padding:8px 0;color:#6b7280">${label}</td><td style="padding:8px 0;font-weight:600;text-align:right">${value}</td></tr>`;

  let body;
  if (kind === 'quick') {
    const b = result.breakdown || {};
    const part = (label, o) => o
      ? row(`${label} · ${Math.round(num(o.pct) * 100)}%`, `${rub(o.low)} — ${rub(o.high)}`)
      : '';
    body = `
      <p style="font-size:22px;font-weight:800;color:#B95C38;margin:0 0 4px">${rub(result.totalLow)} — ${rub(result.totalHigh)}</p>
      <p style="color:#6b7280;margin:0 0 20px;font-size:13px">ориентировочная вилка стоимости</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        ${row('Площадь', `${num(result.area)} м²`)}
        ${row('Категория', tierLabel(result.tier))}
        ${row('Цена за м²', `${num(result.lowPerM2).toLocaleString('ru-RU')}—${num(result.highPerM2).toLocaleString('ru-RU')} ₽`)}
        ${row('Сроки', `~${num(result.days)} раб. дней`)}
      </table>
      <h3 style="font-size:15px;margin:24px 0 8px">Разбивка стоимости</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        ${part('Работы', b.works)}
        ${part('Черновые материалы', b.rough)}
        ${part('Чистовые материалы', b.finish)}
      </table>`;
  } else {
    const t = result.totals || {};
    const lines = Array.isArray(result.lines) ? result.lines.length : 0;
    body = `
      <p style="font-size:22px;font-weight:800;color:#B95C38;margin:0 0 4px">${rub(t.grand)}</p>
      <p style="color:#6b7280;margin:0 0 20px;font-size:13px">детальная смета, ${lines} позиций</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        ${row('Площадь', `${num(result.inputs && result.inputs.area)} м²`)}
        ${row('Отделка', result.mode === 'whitebox' ? 'WhiteBox' : 'Полная отделка')}
        ${row('Цена за м²', `${num(result.perM2).toLocaleString('ru-RU')} ₽`)}
        ${row(`Работы · ${num(t.worksPct)}%`, rub(t.works))}
        ${row(`Материалы · ${num(t.matPct)}%`, rub(t.materials))}
      </table>
      <p style="font-size:13px;color:#6b7280;margin:20px 0 0">Полная таблица по позициям — на сайте, в вашем расчёте.</p>`;
  }

  return `<div style="font-family:Arial,sans-serif;max-width:560px;padding:24px">
    <h2 style="color:#B95C38;margin:0 0 4px">Ваш расчёт стоимости отделки</h2>
    <p style="color:#6b7280;margin:0 0 24px;font-size:14px">${safeName}, вот результат вашего расчёта на сайте РПКМ.</p>
    ${body}
    <hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0">
    <p style="font-size:12px;color:#6b7280;line-height:1.6">
      Расчёт носит предварительный характер: итоговая стоимость зависит от конкретных
      материалов, объёмов по факту и условий подрядчика.
    </p>
    <p style="font-size:13px;margin:16px 0 0"><a href="https://ddrpkm.ru" style="color:#B95C38">ddrpkm.ru</a></p>
  </div>`;
}

app.post('/api/calculation', async (req, res) => {
  const { email, name, kind, result } = req.body || {};

  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim()) || email.length > 254) {
    return res.status(400).json({ ok: false, error: 'Некорректный email' });
  }
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
    return res.status(400).json({ ok: false, error: 'Некорректное имя' });
  }
  if (kind !== 'quick' && kind !== 'detail') {
    return res.status(400).json({ ok: false, error: 'Некорректный тип расчёта' });
  }
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return res.status(400).json({ ok: false, error: 'Некорректный расчёт' });
  }

  if (!rateLimit(`calc:${req.ip}`, 5, 15 * 60 * 1000)) {
    return res.status(429).json({ ok: false, error: 'Слишком много запросов. Попробуйте позже' });
  }

  const sent = await sendRawEmail(
    email.trim(),
    'РПКМ · Ваш расчёт стоимости отделки',
    calcEmailHtml({ name: name.trim(), kind, result })
  );

  if (!sent) {
    console.error('calculation email failed:', email.trim());
    return res.status(502).json({ ok: false, error: 'Не удалось отправить письмо' });
  }
  res.json({ ok: true });
});

// ==================== CONTACT FORM API ====================

app.post('/api/contact', async (req, res) => {
  const { name, email, message, website } = req.body || {};

  // honeypot: боты заполняют скрытое поле — отвечаем успехом, письмо не шлём
  if (typeof website === 'string' && website.trim() !== '') {
    console.log('→ /api/contact honeypot сработал, письмо не отправлено');
    return res.json({ ok: true });
  }

  const badFields = typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100
    || typeof email !== 'string' || !EMAIL_RE.test(email.trim()) || email.length > 254
    || typeof message !== 'string' || message.trim().length < 10 || message.trim().length > 2000;
  if (badFields) {
    return res.status(400).json({ ok: false, error: 'Проверьте заполнение полей' });
  }

  if (!rateLimit(`contact:${req.ip}`, 3, 15 * 60 * 1000)) {
    return res.status(429).json({ ok: false, error: 'Слишком много сообщений. Попробуйте позже.' });
  }

  const safeName = escapeHtml(name.trim());
  const safeEmail = escapeHtml(email.trim());
  // экранируем ДО подстановки <br>, иначе теги из ввода тоже станут разметкой
  const safeMessage = escapeHtml(message.trim()).replace(/\n/g, '<br>');
  const sentAt = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });

  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;padding:24px">
    <h2 style="color:#B95C38;margin:0 0 16px">✉️ Сообщение с сайта</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <tr><td style="padding:8px 0;color:#6b7280;width:100px">Имя:</td><td style="padding:8px 0;font-weight:600">${safeName}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280">Email:</td><td style="padding:8px 0;font-weight:600">${safeEmail}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280">Дата:</td><td style="padding:8px 0">${sentAt} (МСК)</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280">IP:</td><td style="padding:8px 0">${escapeHtml(req.ip || '—')}</td></tr>
    </table>
    <hr style="border:none;border-top:1px solid #e4e4e7;margin:16px 0">
    <div style="font-size:15px;line-height:1.6;white-space:normal">${safeMessage}</div>
    <hr style="border:none;border-top:1px solid #e4e4e7;margin:16px 0">
    <p style="color:#9ca3af;font-size:12px">РПКМ · Форма обратной связи. Ответ уйдёт отправителю — Reply-To подставлен.</p>
  </div>`;

  const sent = await sendRawEmail(
    process.env.CONTACT_EMAIL || 'ddv1121@yandex.ru',
    `РПКМ · Сообщение с сайта от ${name.trim()}`,
    html,
    email.trim(),
  );

  if (!sent) {
    console.error('contact email failed from:', email.trim());
    return res.status(502).json({ ok: false, error: 'Не удалось отправить сообщение. Напишите на ddv1121@yandex.ru' });
  }
  res.json({ ok: true });
});

app.use(express.static(DIST));

app.get('/{*splat}', (req, res) => {
  res.sendFile(join(DIST, 'index.html'));
});

// ==================== START ====================

async function start() {
  if (process.env.DATABASE_URL) {
    try {
      await initDB();
      dbReady = true;
      console.log('✅ БД подключена');
    } catch (err) {
      console.error('DB init error:', err.message);
      console.warn('⚠️  Сервер запущен без БД — авторизация и подписки не будут работать');
    }
  } else {
    console.warn('⚠️  DATABASE_URL не задан — авторизация и подписки отключены');
  }
  app.listen(PORT, () => {
    console.log(`РПКМ server → ${SITE_URL}`);
  });
}

start();
