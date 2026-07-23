import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { resolve, join } from 'path';
import pool, { initDB, findUserByEmail, createUser, saveAuthCode, verifyAuthCode, getActiveSubscription, createTrialSubscription, createPendingSubscription, activateSubscription, cancelSubscription, deleteUser, getAllUsers, getAdminStats } from './server/db.js';
import { sendAuthCode, sendRawEmail } from './server/email.js';

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

// Битрикс24
const B24_WEBHOOK = process.env.B24_WEBHOOK;
if (!B24_WEBHOOK) console.warn('⚠️  B24_WEBHOOK не задан — заявки в CRM отправляться не будут');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Middleware: проверка доступности БД для auth-роутов
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
      subscription: sub ? { plan: sub.plan, status: sub.status, expiresAt: sub.expires_at } : null,
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

const PLANS = {
  monthly: { price: 490, days: 30, label: 'Клуб РПКМ · 1 месяц' },
  yearly: { price: 4900, days: 365, label: 'Клуб РПКМ · 1 год' },
};

// Статус подписки
app.get('/api/subscription/status', authMiddleware, async (req, res) => {
  try {
    const user = await findUserByEmail(req.user.email);
    const sub = await getActiveSubscription(user.id);
    res.json({
      ok: true,
      hasAccess: !!sub,
      subscription: sub ? { plan: sub.plan, status: sub.status, expiresAt: sub.expires_at } : null,
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

    const params = new URLSearchParams({
      receiver: YOOMONEY_WALLET,
      'quickpay-form': 'button',
      paymentType: 'AC',
      sum: String(planData.price),
      label,
      targets: planData.label,
      successURL: `${SITE_URL}/club?payment=success&label=${label}`,
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

// ==================== BITRIX24 API ====================

app.post('/api/lead', async (req, res) => {
  const { title, name, phone, email, comment, source } = req.body;
  console.log('→ /api/lead', title);

  if (!B24_WEBHOOK) {
    return res.status(503).json({ ok: false, error: 'CRM не настроена' });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const contactRes = await fetch(`${B24_WEBHOOK}/crm.contact.add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          NAME: name || 'Без имени',
          PHONE: phone ? [{ VALUE: phone, VALUE_TYPE: 'WORK' }] : [],
          EMAIL: email ? [{ VALUE: email, VALUE_TYPE: 'WORK' }] : [],
          SOURCE_ID: source || 'WEB',
          OPENED: 'Y',
        }
      }),
      signal: controller.signal,
    });
    const contactData = await contactRes.json();
    const contactId = contactData.result;
    console.log('← Contact created:', contactId);

    const dealRes = await fetch(`${B24_WEBHOOK}/crm.deal.add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          TITLE: title || 'Заявка с сайта РПКМ',
          CONTACT_ID: contactId || undefined,
          SOURCE_ID: source || 'WEB',
          OPENED: 'Y',
          STAGE_ID: 'NEW',
          COMMENTS: comment || '',
        }
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const dealData = await dealRes.json();
    console.log('← Deal created:', JSON.stringify(dealData).slice(0, 200));

    if (dealData.result) {
      res.json({ ok: true, id: dealData.result, contactId });
    } else {
      console.error('B24 deal error:', dealData);
      res.status(400).json({ ok: false, error: dealData.error_description || 'Ошибка Битрикс24' });
    }
  } catch (err) {
    console.error('B24 fetch error:', err.message);
    res.status(502).json({ ok: false, error: 'Не удалось связаться с Битрикс24' });
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

    const title = `Консультация инженера — ${user.name || user.email}`;
    const comment = [
      `Запись на консультацию инженера`,
      `Пользователь: ${user.name || '—'}`,
      `Email: ${user.email}`,
      `Телефон: ${user.phone || '—'}`,
      `Подписка: ${sub.plan} (до ${new Date(sub.expires_at).toLocaleDateString('ru-RU')})`,
      `Дата запроса: ${new Date().toLocaleString('ru-RU')}`,
    ].join('\n');

    // Отправляем в Битрикс24
    let dealId = null;
    if (B24_WEBHOOK) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        // Ищем существующий контакт или создаём
        const contactRes = await fetch(`${B24_WEBHOOK}/crm.contact.add`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fields: {
              NAME: user.name || 'Без имени',
              PHONE: user.phone ? [{ VALUE: user.phone, VALUE_TYPE: 'WORK' }] : [],
              EMAIL: [{ VALUE: user.email, VALUE_TYPE: 'WORK' }],
              SOURCE_ID: 'WEB',
              OPENED: 'Y',
            }
          }),
          signal: controller.signal,
        });
        const contactData = await contactRes.json();
        const contactId = contactData.result;

        const dealRes = await fetch(`${B24_WEBHOOK}/crm.deal.add`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fields: {
              TITLE: title,
              CONTACT_ID: contactId || undefined,
              SOURCE_ID: 'WEB',
              OPENED: 'Y',
              STAGE_ID: 'NEW',
              CATEGORY_ID: 0,
              COMMENTS: comment,
            }
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        const dealData = await dealRes.json();
        dealId = dealData.result;
        console.log(`✅ Консультация → Битрикс24: deal=${dealId}, user=${user.email}`);
      } catch (err) {
        console.error('B24 consultation error:', err.message);
        // Не блокируем — отправим email-уведомление
      }
    }

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
          ${dealId ? `<tr><td style="padding:8px 0;color:#6b7280">Битрикс24:</td><td style="padding:8px 0">Сделка #${dealId}</td></tr>` : ''}
        </table>
        <hr style="border:none;border-top:1px solid #e4e4e7;margin:16px 0">
        <p style="color:#9ca3af;font-size:12px">РПКМ · Автоматическое уведомление</p>
      </div>`
    ).catch(err => console.error('Consultation notify error:', err.message));

    res.json({ ok: true, dealId });
  } catch (err) {
    console.error('consultation error:', err);
    res.status(500).json({ ok: false, error: 'Ошибка записи на консультацию' });
  }
});

// ==================== STATIC + SPA ====================

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
