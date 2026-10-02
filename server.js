import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import multer from 'multer';
import { resolve, join } from 'path';
import pool, {
  initDB, findUserByEmail, findUserById, createUser, saveAuthCode, verifyAuthCode, getActiveSubscription, getSubscriptionQueue,
  createTrialSubscription, hasUsedTrial, cancelSubscription, grantSubscription, deleteUser,
  getAllUsers, getAdminStats,
  listCalculations, countB2BCalculationsThisMonth, createCalculation, deleteCalculation,
  listChecklists, getChecklist, upsertChecklist, deleteChecklist,
  listChecklistPhotoIds, countChecklistItemPhotos, sumUserPhotoBytes,
  createChecklistPhoto, getChecklistPhoto, deleteChecklistPhoto, deleteChecklistPhotosByChecklist,
  countConsultationsThisMonth, createConsultation,
  applySucceededPayment, applyRefund,
  createPendingPayment, setPaymentYookassaId, getPaymentById, getPaymentByYookassaId, markPaymentStatus,
  getSubscriptionById,
} from './server/db.js';
import { savePhoto, photoPath, deletePhoto, isStorageReady } from './server/storage.js';
import { sendAuthCode, sendRawEmail } from './server/email.js';
import { isPaymentsReady, createPayment, getPayment, getRefund, isValidPaymentId } from './server/yookassa.js';
import {
  PLANS, tierOf, daysOf, labelOf,
  FREE_B2B_CALCS_PER_MONTH, FREE_CONSULTATIONS_PER_MONTH, MAX_PHOTOS_PER_ITEM, MAX_PHOTOS_TOTAL_MB,
} from './src/data/tariffs.js';
import { CHECKLISTS } from './src/data/checklists.js';

const app = express();
app.set('trust proxy', 1); // за Nginx reverse-proxy (VPS): корректный req.ip/req.protocol и secure-кука по HTTPS
const PORT = process.env.PORT || 3000;
const DIST = resolve('dist');
const JWT_SECRET = process.env.JWT_SECRET || 'rpkm-dev-secret-change-in-prod';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'rpkm-admin-2026';

if (process.env.NODE_ENV === 'production') {
  const bad = [];
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'rpkm-dev-secret-change-in-prod') bad.push('JWT_SECRET не задан или равен дефолту');
  else if (process.env.JWT_SECRET.length < 32) bad.push('JWT_SECRET короче 32 символов');
  if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD === 'rpkm-admin-2026') bad.push('ADMIN_PASSWORD не задан или равен дефолту');
  if (bad.length) {
    console.error('FATAL: небезопасная конфигурация окружения:\n  ' + bad.join('\n  '));
    process.exit(1);
  }
}

const SITE_URL = process.env.APP_URL // явный публичный URL (VPS): https://ddrpkm.ru
  || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null)
  || `http://localhost:${PORT}`;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

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

function requireStorage(req, res, next) {
  if (!isStorageReady()) return res.status(503).json({ ok: false, error: 'Хранилище файлов недоступно' });
  next();
}

// Загрузка фото чек-листа: multipart/form-data, одно поле photo, в памяти
// (не на диск — сохраняем сами через server/storage.js после проверок лимитов).
// Лимит файла 1 МБ — ниже дефолтного лимита nginx на этот путь, чтобы получить
// внятный отказ от сервера, а не голый 413 от nginx раньше ответа приложения.
const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'image/jpeg') return cb(new Error('Принимаются только JPEG-файлы'));
    cb(null, true);
  },
});

// Оборачивает multer, чтобы его ошибки (лимит размера, fileFilter) отвечали
// тем же {ok:false, error} форматом, что и остальной API, а не падали в
// стандартный Express-обработчик ошибок, которого в проекте нет.
function uploadSinglePhoto(req, res, next) {
  photoUpload.single('photo')(req, res, (err) => {
    if (err) return res.status(400).json({ ok: false, error: err.message || 'Ошибка загрузки файла' });
    next();
  });
}

// :id в URL — только целое положительное число, иначе 404 без обращения к БД
// (часть 3, ревью). Число, не подходящее под этот вид, точно не найдётся —
// незачем гонять запрос, чтобы узнать то же самое.
function parsePositiveIntId(raw) {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function findChecklistDef(checklistId) {
  return CHECKLISTS.find(c => c.id === checklistId) || null;
}

// checklistId неизвестен нигде под /api/checklists/:checklistId* — 404 (часть 3, ревью).
function requireValidChecklist(req, res, next) {
  const def = findChecklistDef(req.params.checklistId);
  if (!def) return res.status(404).json({ ok: false, error: 'Не найдено' });
  req.checklistDef = def;
  next();
}

// itemKey вида "<индекс группы>_<индекс пункта>", как ChecklistDetailPage.jsx:289
// (itemKey = (gIdx, iIdx) => `${gIdx}_${iIdx}`), и должен указывать на реально
// существующий пункт именно этого чек-листа.
function isValidItemKey(checklistDef, itemKey) {
  const m = /^(0|[1-9]\d*)_(0|[1-9]\d*)$/.exec(String(itemKey));
  if (!m) return false;
  const group = checklistDef.groups[Number(m[1])];
  return !!(group && group.items[Number(m[2])] !== undefined);
}

// Сигнатура JPEG (FF D8 FF) — mimetype из multipart клиент может подделать
// произвольно, содержимое буфера подделать так же легко нельзя (часть 3, ревью).
function isJpegSignature(buffer) {
  return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
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
    console.error('health: DB error:', err.message);
  }
  res.json(status);
});

// ==================== AUTH API ====================

// Отправить код на email
app.post('/api/auth/send-code', requireDB, async (req, res) => {
  const { email } = req.body;
  const mail = String(email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(mail)) return res.status(400).json({ ok: false, error: 'Введите email' });
  if (!rateLimit(`send:${mail}`, 3, 10 * 60 * 1000))
    return res.status(429).json({ ok: false, error: 'Слишком много запросов кода. Попробуйте через 10 минут.' });
  if (!rateLimit(`send-ip:${req.ip}`, 10, 10 * 60 * 1000))
    return res.status(429).json({ ok: false, error: 'Слишком много запросов. Попробуйте позже.' });
  const code = String(crypto.randomInt(100000, 1000000)); // 6 цифр, CSPRNG
  try {
    await saveAuthCode(mail, code);
    // Отправляем email в фоне — не блокируем ответ
    sendAuthCode(mail, code).catch(err => console.error('Email bg error:', err.message));
    res.json({ ok: true });
  } catch (err) {
    console.error('send-code error:', err);
    res.status(500).json({ ok: false, error: 'Ошибка отправки кода' });
  }
});

// Очередь периодов для показа на /club и /pro (TASK_queue_ui.md, часть 1).
// Доступ определяет только subscription (текущая), queue — информационная.
function formatQueue(rows) {
  return rows.map(r => ({
    plan: r.plan, status: r.status, tier: tierOf(r.plan),
    startedAt: r.started_at, expiresAt: r.expires_at,
  }));
}

// Проверить код, войти/зарегистрироваться
app.post('/api/auth/verify', requireDB, async (req, res) => {
  const { email, code, name, phone, role, organization, position } = req.body;
  const mail = String(email || '').trim().toLowerCase();
  if (!mail || !code) return res.status(400).json({ ok: false, error: 'Введите email и код' });
  if (!rateLimit(`verify-ip:${req.ip}`, 20, 10 * 60 * 1000))
    return res.status(429).json({ ok: false, error: 'Слишком много попыток. Попробуйте позже.' });
  if (!rateLimit(`verify:${mail}`, 5, 10 * 60 * 1000))
    return res.status(429).json({ ok: false, error: 'Слишком много попыток. Запросите новый код через 10 минут.' });
  try {
    const valid = await verifyAuthCode(mail, code);
    if (!valid) return res.status(400).json({ ok: false, error: 'Неверный или просроченный код' });
    const user = await createUser(mail, name, phone, { role, organization, position });
    const sub = await getActiveSubscription(user.id);
    const queue = formatQueue(await getSubscriptionQueue(user.id));
    const token = signToken(user);
    res.cookie('rpkm_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    res.json({ ok: true, user: { id: user.id, email: user.email, name: user.name, phone: user.phone, role: user.role, organization: user.organization }, subscription: sub, queue });
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
    const trialUsed = await hasUsedTrial(user.id);
    const queue = formatQueue(await getSubscriptionQueue(user.id));
    res.json({
      ok: true,
      user: { id: user.id, email: user.email, name: user.name, phone: user.phone, role: user.role, organization: user.organization },
      subscription: sub ? { plan: sub.plan, status: sub.status, expiresAt: sub.expires_at, tier: tierOf(sub.plan) } : null,
      queue,
      trialUsed,
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
    const queue = formatQueue(await getSubscriptionQueue(user.id));
    res.json({
      ok: true,
      hasAccess: !!sub,
      subscription: sub ? { plan: sub.plan, status: sub.status, expiresAt: sub.expires_at, tier: tierOf(sub.plan) } : null,
      queue,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Ошибка' });
  }
});

// Активировать триал — физлицу клубный на 14 дней, профессионалу pro_trial на 7
app.post('/api/subscription/trial', authMiddleware, async (req, res) => {
  try {
    const user = await findUserByEmail(req.user.email);
    const plan = user.role === 'b2b' ? 'pro_trial' : 'trial';
    const result = await createTrialSubscription(user.id, plan, daysOf(plan));
    if (!result.created) {
      const error = result.reason === 'active' ? 'У вас уже есть активная подписка' : 'Пробный доступ уже был использован';
      return res.json({ ok: false, error });
    }
    const sub = result.subscription;
    res.json({ ok: true, plan: sub.plan, subscription: { plan: sub.plan, status: sub.status, expiresAt: sub.expires_at } });
  } catch (err) {
    console.error('trial error:', err);
    res.status(500).json({ ok: false, error: 'Ошибка' });
  }
});

// Кнопки «Отменить подписку» больше нет (часть 2.6 TASK_yookassa.md) —
// подписка просто заканчивается в срок, возврат владелец делает по письму
// в кабинете ЮKassa. cancelSubscription() из db.js не удаляем — её всё ещё
// использует отзыв подписки в админке (DELETE /api/admin/users/:id/subscription).

// ==================== PAYMENTS API (ЮKassa, TASK_yookassa.md) ====================
// Тестовый магазин ЮKassa (ShopID 1380535) — переключение на настоящий позже,
// только переменными окружения. Чеки не автоматизируем: письмо владельцу
// содержит всё нужное для ручной пробивки в «Мой налог» (решения владельца,
// раздел 4 roadmap от 24.09.2026).

const OWNER_EMAIL = process.env.CONTACT_EMAIL || 'ddv1121@yandex.ru';
const PAYABLE_PLANS = ['club_monthly', 'club_yearly', 'pro_monthly']; // без триалов

function requirePayments(req, res, next) {
  if (!isPaymentsReady()) return res.status(503).json({ ok: false, error: 'payments_off' });
  next();
}

// Письмо владельцу на каждое первое применение успешного платежа (не на
// повтор — вызывающий код шлёт его только когда applySucceededPayment вернул
// applied:true). Тема помечается [ТЕСТ], когда сама ЮKassa говорит, что
// платёж тестовый (test:true в ответе API), а не по своей переменной —
// иначе при переключении на боевой магазин легко забыть снять признак.
async function sendPaymentOwnerEmail(row, subscription, isTest) {
  const buyer = await findUserById(row.user_id).catch(() => null);
  const subject = `${isTest ? '[ТЕСТ] ' : ''}Оплата: ${labelOf(row.plan)}, ${row.amount} ₽`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:500px;padding:20px">
    <h2 style="color:#B95C38;margin:0 0 16px">💳 Оплата подписки</h2>
    <table style="width:100%;border-collapse:collapse;">
      <tr><td style="padding:8px 0;color:#6b7280;width:140px">План:</td><td style="padding:8px 0;font-weight:600">${escapeHtml(labelOf(row.plan))}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280">Сумма:</td><td style="padding:8px 0;font-weight:600">${row.amount} ₽</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280">Покупатель:</td><td style="padding:8px 0">${escapeHtml(buyer?.email || '—')}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280">Платёж ЮKassa:</td><td style="padding:8px 0">${escapeHtml(row.yookassa_id || '—')}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280">Период доступа:</td><td style="padding:8px 0">${new Date(subscription.started_at).toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow' })} — ${new Date(subscription.expires_at).toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow' })}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280">Дата оплаты:</td><td style="padding:8px 0">${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}</td></tr>
    </table>
    <hr style="border:none;border-top:1px solid #e4e4e7;margin:16px 0">
    <p style="color:#B95C38;font-weight:600">Выдайте чек в «Мой налог».</p>
    <p style="color:#9ca3af;font-size:12px">РПКМ · Автоматическое уведомление</p>
  </div>`;
  return sendRawEmail(OWNER_EMAIL, subject, html);
}

// Аккаунт удалился между созданием платежа и приходом успеха от ЮKassa —
// подписку выдать некому, владелец возвращает деньги руками из кабинета
// ЮKassa. Ровно одно письмо на платёж — вызывающий код помечает
// payments.status='orphaned' до вызова этой функции, второй вебхук по тому
// же платежу такое письмо уже не шлёт (часть 2.3/2.5 ТЗ, доп. к части 2).
async function sendOrphanedPaymentEmail(row) {
  const html = `<div style="font-family:Arial,sans-serif;max-width:500px;padding:20px">
    <h2 style="color:#dc2626;margin:0 0 16px">⚠️ Оплата без аккаунта: нужен возврат</h2>
    <p>Аккаунт покупателя был удалён до того, как платёж прошёл — доступ выдать некому. Оформите возврат в кабинете ЮKassa.</p>
    <table style="width:100%;border-collapse:collapse;">
      <tr><td style="padding:8px 0;color:#6b7280;width:140px">План:</td><td style="padding:8px 0;font-weight:600">${escapeHtml(labelOf(row.plan))}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280">Сумма:</td><td style="padding:8px 0;font-weight:600">${row.amount} ₽</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280">Платёж ЮKassa:</td><td style="padding:8px 0">${escapeHtml(row.yookassa_id || '—')}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280">Время:</td><td style="padding:8px 0">${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}</td></tr>
    </table>
  </div>`;
  return sendRawEmail(OWNER_EMAIL, 'Оплата без аккаунта: нужен возврат', html);
}

// Исправлено (27.09.2026): по п. 6.1 оферты возврат при отказе от Клуба
// ВСЕГДА частичный (сумма за использованные дни удерживается) — значит
// «доступ не меняем при частичном возврате» было ошибкой первой версии ТЗ.
// Любой успешный возврат, полный или частичный, закрывает доступ по этому
// платежу через applyRefund (см. вебхук ниже); это письмо — только
// уведомление владельцу при частичном, что доступ уже закрыт, не «доступ
// не менялся».
async function sendPartialRefundEmail(row, ykRefund) {
  const html = `<div style="font-family:Arial,sans-serif;max-width:500px;padding:20px">
    <h2 style="color:#B95C38;margin:0 0 16px">Частичный возврат: доступ по этой оплате закрыт</h2>
    <table style="width:100%;border-collapse:collapse;">
      <tr><td style="padding:8px 0;color:#6b7280;width:160px">Сумма платежа:</td><td style="padding:8px 0">${row.amount} ₽</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280">Сумма возврата:</td><td style="padding:8px 0;font-weight:600">${escapeHtml(String(ykRefund?.amount?.value ?? '—'))} ₽</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280">Платёж ЮKassa:</td><td style="padding:8px 0">${escapeHtml(row.yookassa_id || '—')}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280">Время:</td><td style="padding:8px 0">${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}</td></tr>
    </table>
  </div>`;
  return sendRawEmail(OWNER_EMAIL, 'Частичный возврат: доступ по этой оплате закрыт', html);
}

// Создать платёж. Сумма и план — только с сервера (PLANS), клиент присылает
// только id плана (решения владельца от 27.09.2026, п. «Сумма и план...»).
app.post('/api/payments/create', requireDB, authMiddleware, requirePayments, async (req, res) => {
  try {
    const user = await findUserByEmail(req.user.email);
    if (!user) return res.status(401).json({ ok: false, error: 'Пользователь не найден' });
    if (!rateLimit(`payment-create:${user.id}`, 10, 10 * 60 * 1000))
      return res.status(429).json({ ok: false, error: 'Слишком много попыток. Попробуйте позже.' });

    const plan = String(req.body?.plan || '');
    if (!PAYABLE_PLANS.includes(plan)) return res.status(400).json({ ok: false, error: 'Неизвестный план' });

    const amount = PLANS[plan].price;
    const row = await createPendingPayment(user.id, plan, amount);

    let ykPayment;
    try {
      ykPayment = await createPayment({
        amount,
        description: `РПКМ: ${labelOf(plan)}`,
        returnUrl: `${SITE_URL}/payment/return?p=${row.id}`,
        metadata: { payment_row_id: row.id, user_id: user.id, plan },
      });
    } catch (err) {
      // Строка остаётся pending без yookassa_id — созданную заявку просто
      // не с чем связать, пользователь может попробовать оплатить снова.
      console.error('payments/create: yookassa error:', err.message);
      return res.status(502).json({ ok: false, error: 'provider' });
    }

    await setPaymentYookassaId(row.id, ykPayment.id);
    res.json({ ok: true, confirmationUrl: ykPayment.confirmation.confirmation_url });
  } catch (err) {
    console.error('payments/create error:', err);
    res.status(500).json({ ok: false, error: 'Ошибка' });
  }
});

// Вебхук ЮKassa. Без авторизации — её шлёт сама ЮKassa. Телу не доверяем:
// берём только event и object.id, дальше запрашиваем объект заново через API
// и действуем по её ответу (защита от подделанных уведомлений, часть 2.3 ТЗ).
app.post('/api/payments/yookassa/webhook', async (req, res) => {
  const event = req.body?.event;
  const objectId = req.body?.object?.id;
  if (!event || !objectId) return res.sendStatus(200); // не похоже на уведомление ЮKassa — не 500, повторять нечего
  if (!isValidPaymentId(objectId)) return res.sendStatus(200); // не похоже на id ЮKassa — не ходим в API вовсе

  try {
    switch (event) {
      case 'payment.succeeded': {
        const ykPayment = await getPayment(objectId);
        const row = await getPaymentByYookassaId(ykPayment.id);
        if (!row) { console.error('webhook payment.succeeded: платёж не найден в payments', ykPayment.id); return res.sendStatus(200); }
        if (row.status === 'orphaned') return res.sendStatus(200); // письмо владельцу уже отправлено на этот платёж

        const amountOk = ykPayment.amount?.currency === 'RUB' && parseFloat(ykPayment.amount?.value) === row.amount;
        if (ykPayment.status !== 'succeeded' || !ykPayment.paid || !amountOk) {
          console.error('webhook payment.succeeded: несовпадение', { id: ykPayment.id, status: ykPayment.status, paid: ykPayment.paid, amount: ykPayment.amount, rowAmount: row.amount });
          return res.sendStatus(200);
        }

        try {
          const result = await applySucceededPayment(row.id, tierOf(row.plan), daysOf(row.plan));
          if (result?.applied) {
            sendPaymentOwnerEmail(row, result.subscription, !!ykPayment.test).catch(err => console.error('Payment owner email error:', err.message));
          }
          return res.sendStatus(200);
        } catch (err) {
          if (err.code === 'PAYMENT_ORPHANED') {
            await markPaymentStatus(row.id, 'orphaned');
            sendOrphanedPaymentEmail(row).catch(e => console.error('Orphaned payment email error:', e.message));
            return res.sendStatus(200);
          }
          throw err; // сбой БД/другая причина — пусть ЮKassa повторит (500 ниже)
        }
      }

      case 'payment.canceled': {
        const ykPayment = await getPayment(objectId);
        const row = await getPaymentByYookassaId(ykPayment.id);
        if (!row) return res.sendStatus(200);
        if (row.status === 'pending') await markPaymentStatus(row.id, 'canceled');
        return res.sendStatus(200);
      }

      case 'refund.succeeded': {
        const ykRefund = await getRefund(objectId);
        const row = await getPaymentByYookassaId(ykRefund.payment_id);
        if (!row) { console.error('webhook refund.succeeded: платёж не найден в payments', ykRefund.payment_id); return res.sendStatus(200); }

        // Любой успешный возврат — полный или частичный — закрывает доступ по
        // этому платежу (п. 6.1 оферты: возврат при отказе от Клуба всегда
        // частичный, поэтому «частичный = доступ не меняем» было ошибкой ТЗ).
        const full = parseFloat(ykRefund.amount?.value) >= row.amount;
        const result = await applyRefund(row.yookassa_id);
        if (!full && result && !result.alreadyRefunded) {
          sendPartialRefundEmail(row, ykRefund).catch(err => console.error('Partial refund email error:', err.message));
        }
        return res.sendStatus(200);
      }

      default:
        console.log('webhook: неизвестное событие', event, objectId);
        return res.sendStatus(200);
    }
  } catch (err) {
    console.error('webhook error:', err.message);
    return res.sendStatus(500); // сбой БД/API — пусть ЮKassa повторит уведомление
  }
});

// Свой платёж — чужой/несуществующий id → 404 (не 403, как везде в проекте).
// Если строка ещё pending и есть yookassa_id — опрашиваем ЮKassa сами: второй
// путь применения на случай, если вебхук запаздывает или потерян (часть 2.4 ТЗ).
app.get('/api/payments/:id', requireDB, authMiddleware, async (req, res) => {
  try {
    const id = parsePositiveIntId(req.params.id);
    if (!id) return res.status(404).json({ ok: false, error: 'Не найдено' });
    const user = await findUserByEmail(req.user.email);
    if (!user) return res.status(401).json({ ok: false, error: 'Пользователь не найден' });

    let row = await getPaymentById(user.id, id);
    if (!row) return res.status(404).json({ ok: false, error: 'Не найдено' });

    if (row.status === 'pending' && row.yookassa_id && isPaymentsReady()) {
      try {
        const ykPayment = await getPayment(row.yookassa_id);
        const amountOk = ykPayment.amount?.currency === 'RUB' && parseFloat(ykPayment.amount?.value) === row.amount;
        if (ykPayment.status === 'succeeded' && ykPayment.paid && amountOk) {
          const result = await applySucceededPayment(row.id, tierOf(row.plan), daysOf(row.plan));
          if (result?.applied) sendPaymentOwnerEmail(row, result.subscription, !!ykPayment.test).catch(err => console.error('Payment owner email error:', err.message));
          row = await getPaymentById(user.id, id);
        } else if (ykPayment.status === 'canceled') {
          row = await markPaymentStatus(row.id, 'canceled');
        }
      } catch (err) {
        // Строка остаётся pending — фронт продолжит опрос, вебхук догонит сам.
        console.error('payments/:id: poll error:', err.message);
      }
    }

    const sub = row.subscription_id ? await getSubscriptionById(row.subscription_id) : null;
    res.json({
      ok: true,
      status: row.status,
      plan: row.plan,
      subscription: sub ? { plan: sub.plan, expiresAt: sub.expires_at, startsAt: sub.started_at } : null,
    });
  } catch (err) {
    console.error('payments/:id error:', err);
    res.status(500).json({ ok: false, error: 'Ошибка' });
  }
});

const ADMIN_TTL_SEC = 2 * 60 * 60; // 2 часа

app.post('/api/admin/login', (req, res) => {
  if (!rateLimit(`admin-login:${req.ip}`, 10, 5 * 60 * 1000))
    return res.status(429).json({ ok: false, error: 'Слишком много попыток. Попробуйте позже.' });

  const given = Buffer.from(String(req.body?.password || ''));
  const real = Buffer.from(ADMIN_PASSWORD);
  const ok = given.length === real.length && crypto.timingSafeEqual(given, real);
  if (!ok) return res.status(403).json({ ok: false, error: 'Доступ запрещён' });

  const token = jwt.sign({ adm: true }, JWT_SECRET, { expiresIn: ADMIN_TTL_SEC });
  res.cookie('rpkm_admin_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/admin',
    maxAge: ADMIN_TTL_SEC * 1000,
  });
  res.json({ ok: true, expiresIn: ADMIN_TTL_SEC });
});

app.post('/api/admin/logout', (req, res) => {
  res.clearCookie('rpkm_admin_token', { path: '/api/admin' });
  res.json({ ok: true });
});

// ==================== ADMIN API ====================

function adminAuth(req, res, next) {
  if (!rateLimit(`admin:${req.ip}`, 60, 5 * 60 * 1000))
    return res.status(429).json({ ok: false, error: 'Слишком много запросов.' });
  const token = req.cookies?.rpkm_admin_token;
  if (!token) return res.status(401).json({ ok: false, error: 'Требуется вход' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (!payload?.adm) return res.status(403).json({ ok: false, error: 'Доступ запрещён' });
    next();
  } catch {
    return res.status(401).json({ ok: false, error: 'Сессия истекла' });
  }
}

app.get('/api/admin/stats', requireDB, adminAuth, async (req, res) => {
  try {
    const stats = await getAdminStats();
    res.json({ ok: true, stats });
  } catch (err) {
    console.error('admin error:', err.message);
    res.status(500).json({ ok: false, error: 'Ошибка сервера' });
  }
});

app.get('/api/admin/users', requireDB, adminAuth, async (req, res) => {
  try {
    const users = await getAllUsers();
    res.json({ ok: true, users });
  } catch (err) {
    console.error('admin error:', err.message);
    res.status(500).json({ ok: false, error: 'Ошибка сервера' });
  }
});

// Удаление пользователя
app.delete('/api/admin/users/:id', requireDB, adminAuth, async (req, res) => {
  try {
    const user = await deleteUser(Number(req.params.id));
    if (!user) return res.status(404).json({ ok: false, error: 'Пользователь не найден' });
    res.json({ ok: true });
  } catch (err) {
    console.error('admin error:', err.message);
    res.status(500).json({ ok: false, error: 'Ошибка сервера' });
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
    console.error('admin error:', err.message);
    res.status(500).json({ ok: false, error: 'Ошибка сервера' });
  }
});

// Отозвать подписку вручную
app.delete('/api/admin/users/:id/subscription', requireDB, adminAuth, async (req, res) => {
  try {
    await cancelSubscription(Number(req.params.id));
    res.json({ ok: true });
  } catch (err) {
    console.error('admin error:', err.message);
    res.status(500).json({ ok: false, error: 'Ошибка сервера' });
  }
});

// ==================== CALCS API (B2B / office) ====================
// Часть 3.1 TASK_server_storage.md.

app.get('/api/calcs', requireDB, authMiddleware, async (req, res) => {
  try {
    const user = await findUserByEmail(req.user.email);
    if (!user) return res.status(401).json({ ok: false, error: 'Пользователь не найден' });
    const calcs = await listCalculations(user.id);
    res.json({ ok: true, calcs });
  } catch (err) {
    console.error('calcs list error:', err);
    res.status(500).json({ ok: false, error: 'Ошибка' });
  }
});

app.post('/api/calcs', requireDB, authMiddleware, async (req, res) => {
  try {
    const user = await findUserByEmail(req.user.email);
    if (!user) return res.status(401).json({ ok: false, error: 'Пользователь не найден' });

    const { kind, projectName, data } = req.body || {};
    if (kind !== 'b2b' && kind !== 'office') {
      return res.status(400).json({ ok: false, error: 'Некорректный тип расчёта' });
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return res.status(400).json({ ok: false, error: 'Некорректные данные расчёта' });
    }

    const sub = await getActiveSubscription(user.id);
    const tier = tierOf(sub?.plan);

    // Повторяет гейт страницы B2BOfficePage.jsx:147 на сервере.
    if (kind === 'office' && tier !== 'pro') {
      return res.status(403).json({ ok: false, error: 'Офисный калькулятор доступен только на PRO' });
    }
    // Бесплатный профи: лимит расчётов в месяц. Снимает только уровень pro
    // (включая pro_trial) — подписка Клуба этот лимит не снимает.
    if (kind === 'b2b' && tier !== 'pro') {
      const used = await countB2BCalculationsThisMonth(user.id);
      if (used >= FREE_B2B_CALCS_PER_MONTH) {
        return res.status(403).json({ ok: false, error: 'limit' });
      }
    }

    const calc = await createCalculation(user.id, kind, projectName || null, data);
    res.json({ ok: true, calc });
  } catch (err) {
    console.error('calcs create error:', err);
    res.status(500).json({ ok: false, error: 'Ошибка' });
  }
});

app.delete('/api/calcs/:id', requireDB, authMiddleware, async (req, res) => {
  try {
    const id = parsePositiveIntId(req.params.id);
    if (id === null) return res.status(404).json({ ok: false, error: 'Не найдено' });
    const user = await findUserByEmail(req.user.email);
    if (!user) return res.status(401).json({ ok: false, error: 'Пользователь не найден' });
    const deleted = await deleteCalculation(user.id, id);
    if (!deleted) return res.status(404).json({ ok: false, error: 'Не найдено' });
    res.json({ ok: true });
  } catch (err) {
    console.error('calcs delete error:', err);
    res.status(500).json({ ok: false, error: 'Ошибка' });
  }
});

// ==================== CHECKLISTS API ====================
// Часть 3.2 TASK_server_storage.md. Доступ — club или pro (смысл как у hasClub
// на фронте, docs/TASK_checklists_gate.md). Подписка истекла — доступ закрыт,
// данные не удаляются: после оплаты возвращаются нетронутыми.

async function requireChecklistsAccess(req, res, next) {
  try {
    const user = await findUserByEmail(req.user.email);
    if (!user) return res.status(401).json({ ok: false, error: 'Пользователь не найден' });
    const sub = await getActiveSubscription(user.id);
    const tier = tierOf(sub?.plan);
    if (tier !== 'club' && tier !== 'pro') {
      return res.status(403).json({ ok: false, error: 'Доступно по подписке Клуба или PRO' });
    }
    req.dbUser = user;
    next();
  } catch (err) {
    console.error('checklists access error:', err);
    res.status(500).json({ ok: false, error: 'Ошибка' });
  }
}

app.get('/api/checklists', requireDB, authMiddleware, requireChecklistsAccess, async (req, res) => {
  try {
    const list = await listChecklists(req.dbUser.id);
    res.json({ ok: true, checklists: list.map(r => ({ checklistId: r.checklist_id, state: r.state, rev: r.rev, updatedAt: r.updated_at })) });
  } catch (err) {
    console.error('checklists list error:', err);
    res.status(500).json({ ok: false, error: 'Ошибка' });
  }
});

app.get('/api/checklists/:checklistId', requireDB, authMiddleware, requireChecklistsAccess, requireValidChecklist, async (req, res) => {
  try {
    const row = await getChecklist(req.dbUser.id, req.params.checklistId);
    // Чек-лист ещё не начат — обычное состояние для своего checklistId, не 404.
    if (!row) return res.json({ ok: true, checklist: null });
    res.json({ ok: true, checklist: { checklistId: row.checklist_id, state: row.state, rev: row.rev, updatedAt: row.updated_at } });
  } catch (err) {
    console.error('checklist get error:', err);
    res.status(500).json({ ok: false, error: 'Ошибка' });
  }
});

app.put('/api/checklists/:checklistId', requireDB, authMiddleware, requireChecklistsAccess, requireValidChecklist, async (req, res) => {
  try {
    const { state, rev } = req.body || {};
    if (!state || typeof state !== 'object' || Array.isArray(state)) {
      return res.status(400).json({ ok: false, error: 'Некорректное состояние чек-листа' });
    }
    if (!Number.isInteger(rev) || rev <= 0) {
      return res.status(400).json({ ok: false, error: 'Некорректная версия чек-листа' });
    }
    const checklistId = req.params.checklistId;
    // Чужие и несуществующие id фото выкидываем из сохраняемого состояния —
    // не доверяем тому, что прислал клиент.
    const ownedPhotoIds = new Set((await listChecklistPhotoIds(req.dbUser.id, checklistId)).map(String));
    const items = state.items && typeof state.items === 'object' && !Array.isArray(state.items) ? state.items : {};
    const cleanedItems = {};
    for (const [key, item] of Object.entries(items)) {
      const photos = Array.isArray(item?.photos) ? item.photos.filter(id => ownedPhotoIds.has(String(id))) : [];
      cleanedItems[key] = { ...item, photos };
    }
    const cleanedState = { ...state, items: cleanedItems };
    const saved = await upsertChecklist(req.dbUser.id, checklistId, cleanedState, rev);
    // saved === null — запись отклонена как устаревшая (пришедший rev не новее
    // сохранённого): это гонка двух своих же PUT, не ошибка (часть 5 ТЗ, правка ревью).
    if (!saved) return res.json({ ok: true, stale: true });
    res.json({ ok: true, checklist: { checklistId: saved.checklist_id, state: saved.state, rev: saved.rev, updatedAt: saved.updated_at } });
  } catch (err) {
    console.error('checklist put error:', err);
    res.status(500).json({ ok: false, error: 'Ошибка' });
  }
});

// Сброс чек-листа — сейчас на фронте это localStorage.removeItem (ChecklistsPage.jsx:61).
app.delete('/api/checklists/:checklistId', requireDB, authMiddleware, requireChecklistsAccess, requireValidChecklist, async (req, res) => {
  try {
    const checklistId = req.params.checklistId;
    const photoRows = await deleteChecklistPhotosByChecklist(req.dbUser.id, checklistId);
    await deleteChecklist(req.dbUser.id, checklistId);
    for (const { file_name } of photoRows) {
      try { await deletePhoto(req.dbUser.id, file_name); } catch (err) { console.error('deletePhoto error:', err); }
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('checklist delete error:', err);
    res.status(500).json({ ok: false, error: 'Ошибка' });
  }
});

app.post('/api/checklists/:checklistId/photos', requireDB, authMiddleware, requireChecklistsAccess, requireValidChecklist, requireStorage, uploadSinglePhoto, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'Файл не получен' });
    const { itemKey } = req.body || {};
    if (!isValidItemKey(req.checklistDef, itemKey)) {
      return res.status(400).json({ ok: false, error: 'Некорректный пункт чек-листа' });
    }
    // mimetype в multipart клиент может выставить произвольно — сигнатура буфера
    // подделывается не так тривиально (часть 3, ревью).
    if (!isJpegSignature(req.file.buffer)) {
      return res.status(400).json({ ok: false, error: 'Файл не является JPEG' });
    }

    const checklistId = req.params.checklistId;
    const userId = req.dbUser.id;

    const itemCount = await countChecklistItemPhotos(userId, checklistId, itemKey);
    if (itemCount >= MAX_PHOTOS_PER_ITEM) {
      return res.status(403).json({ ok: false, error: 'limit_item' });
    }
    const totalBytes = await sumUserPhotoBytes(userId);
    if (totalBytes + req.file.size > MAX_PHOTOS_TOTAL_MB * 1024 * 1024) {
      return res.status(403).json({ ok: false, error: 'limit_total' });
    }

    const fileName = await savePhoto(userId, req.file.buffer);
    let photo;
    try {
      photo = await createChecklistPhoto(userId, checklistId, itemKey, fileName, req.file.size);
    } catch (err) {
      // Файл на диске уже есть, а запись в БД не создалась — не оставляем
      // осиротевший файл (часть 3, ревью).
      try { await deletePhoto(userId, fileName); } catch (cleanupErr) { console.error('cleanup deletePhoto error:', cleanupErr); }
      throw err;
    }
    res.json({ ok: true, photo: { id: photo.id } });
  } catch (err) {
    console.error('photo upload error:', err);
    res.status(500).json({ ok: false, error: 'Ошибка' });
  }
});

app.get('/api/checklists/photos/:id', requireDB, authMiddleware, requireChecklistsAccess, requireStorage, async (req, res) => {
  try {
    const id = parsePositiveIntId(req.params.id);
    if (id === null) return res.status(404).json({ ok: false, error: 'Не найдено' });
    const photo = await getChecklistPhoto(req.dbUser.id, id);
    if (!photo) return res.status(404).json({ ok: false, error: 'Не найдено' });
    res.set('Cache-Control', 'private');
    res.set('X-Content-Type-Options', 'nosniff');
    res.sendFile(photoPath(req.dbUser.id, photo.file_name), (err) => {
      if (err && !res.headersSent) res.status(404).json({ ok: false, error: 'Файл не найден' });
    });
  } catch (err) {
    console.error('photo get error:', err);
    if (!res.headersSent) res.status(500).json({ ok: false, error: 'Ошибка' });
  }
});

// Если на фронте сейчас нет удаления фото — эндпоинт всё равно нужен для
// сброса чек-листа; кнопку в интерфейсе не добавлять, если её нет (часть 3.2 ТЗ).
app.delete('/api/checklists/photos/:id', requireDB, authMiddleware, requireChecklistsAccess, requireStorage, async (req, res) => {
  try {
    const id = parsePositiveIntId(req.params.id);
    if (id === null) return res.status(404).json({ ok: false, error: 'Не найдено' });
    const photo = await deleteChecklistPhoto(req.dbUser.id, id);
    if (!photo) return res.status(404).json({ ok: false, error: 'Не найдено' });
    try { await deletePhoto(req.dbUser.id, photo.file_name); } catch (err) { console.error('deletePhoto error:', err); }
    res.json({ ok: true });
  } catch (err) {
    console.error('photo delete error:', err);
    res.status(500).json({ ok: false, error: 'Ошибка' });
  }
});

// ==================== CONSULTATION API ====================
// Часть 3.3 TASK_server_storage.md. Лимит и остаток теперь считает сервер.

app.post('/api/consultation', requireDB, authMiddleware, async (req, res) => {
  try {
    const user = await findUserByEmail(req.user.email);
    if (!user) return res.status(401).json({ ok: false, error: 'Пользователь не найден' });

    const sub = await getActiveSubscription(user.id);
    if (!sub) return res.status(403).json({ ok: false, error: 'Нет активной подписки' });

    const used = await countConsultationsThisMonth(user.id);
    if (used >= FREE_CONSULTATIONS_PER_MONTH) {
      return res.status(403).json({ ok: false, error: 'limit' });
    }

    // Запись в consultations вставляется только после успешной отправки письма —
    // значит письмо теперь ждём, а не отправляем в фоне без ожидания.
    const sent = await sendRawEmail(
      'ddv1121@yandex.ru',
      `Запись на консультацию: ${user.name || user.email}`,
      `<div style="font-family:Arial,sans-serif;max-width:500px;padding:20px">
        <h2 style="color:#B95C38;margin:0 0 16px">🔔 Новая запись на консультацию</h2>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:8px 0;color:#6b7280;width:120px">Имя:</td><td style="padding:8px 0;font-weight:600">${escapeHtml(user.name || '—')}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">Email:</td><td style="padding:8px 0;font-weight:600">${escapeHtml(user.email)}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">Телефон:</td><td style="padding:8px 0;font-weight:600">${escapeHtml(user.phone || '—')}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">Подписка:</td><td style="padding:8px 0">${escapeHtml(labelOf(sub.plan))} до ${new Date(sub.expires_at).toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow' })}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">Дата:</td><td style="padding:8px 0">${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}</td></tr>
        </table>
        <hr style="border:none;border-top:1px solid #e4e4e7;margin:16px 0">
        <p style="color:#9ca3af;font-size:12px">РПКМ · Автоматическое уведомление</p>
      </div>`
    );
    if (!sent) return res.status(502).json({ ok: false, error: 'Не удалось отправить письмо' });

    await createConsultation(user.id);
    res.json({ ok: true, left: FREE_CONSULTATIONS_PER_MONTH - (used + 1) });
  } catch (err) {
    console.error('consultation error:', err);
    res.status(500).json({ ok: false, error: 'Ошибка записи на консультацию' });
  }
});

app.get('/api/consultation/status', requireDB, authMiddleware, async (req, res) => {
  try {
    const user = await findUserByEmail(req.user.email);
    if (!user) return res.status(401).json({ ok: false, error: 'Пользователь не найден' });
    const used = await countConsultationsThisMonth(user.id);
    res.json({ ok: true, left: Math.max(0, FREE_CONSULTATIONS_PER_MONTH - used) });
  } catch (err) {
    console.error('consultation status error:', err);
    res.status(500).json({ ok: false, error: 'Ошибка' });
  }
});

// ==================== STATIC + SPA ====================

// ==================== CALCULATION EMAIL API ====================

// Письмо собирается ТОЛЬКО из числовых полей result на сервере.
// Пользовательский текст в письмо не попадает — иначе эндпоинт превращается
// в открытый релей для рассылки произвольного содержимого от нашего домена.

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

app.use('/api', (req, res) => res.status(404).json({ ok: false, error: 'Не найдено' }));

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
