// Тонкий клиент API ЮKassa v3 (https://api.yookassa.ru/v3). Без новых
// зависимостей — встроенный fetch. Часть 2 TASK_yookassa.md.
//
// Секретный ключ нигде не логируется и не попадает в ответы: request()
// логирует только метод/путь/статус/тело ответа ЮKassa, никогда заголовки.
import crypto from 'crypto';

const API_BASE = 'https://api.yookassa.ru/v3';
const SHOP_ID = process.env.YOOKASSA_SHOP_ID || '';
const SECRET_KEY = process.env.YOOKASSA_SECRET_KEY || '';

if (!SHOP_ID || !SECRET_KEY) {
  console.warn('YOOKASSA_SHOP_ID/YOOKASSA_SECRET_KEY не заданы — оплата недоступна, эндпоинты отвечают 503.');
}

export function isPaymentsReady() {
  return !!(SHOP_ID && SECRET_KEY);
}

const REQUEST_TIMEOUT_MS = 10_000;

async function request(method, path, { body, idempotenceKey } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${SHOP_ID}:${SECRET_KEY}`).toString('base64')}`,
    };
    if (idempotenceKey) headers['Idempotence-Key'] = idempotenceKey;
    let res;
    try {
      res = await fetch(`${API_BASE}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (err) {
      console.error(`ЮKassa ${method} ${path}: сеть/таймаут —`, err.message);
      throw new Error('yookassa_network');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error(`ЮKassa ${method} ${path} → ${res.status}:`, JSON.stringify(data));
      const err = new Error(`yookassa_${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

// amount — число рублей (из PLANS), не строка: строку с копейками формирует
// сама функция ("99.00"), чтобы вызывающий код не путал рубли с копейками.
export async function createPayment({ amount, description, returnUrl, metadata }) {
  return request('POST', '/payments', {
    idempotenceKey: crypto.randomUUID(),
    body: {
      amount: { value: amount.toFixed(2), currency: 'RUB' },
      capture: true,
      confirmation: { type: 'redirect', return_url: returnUrl },
      description,
      metadata,
    },
  });
}

export async function getPayment(id) {
  return request('GET', `/payments/${id}`);
}

export async function getRefund(id) {
  return request('GET', `/refunds/${id}`);
}
