import express from 'express';
import { resolve, join } from 'path';

const app = express();
const PORT = process.env.PORT || 3000;
const DIST = resolve('dist');

// Битрикс24 webhook (входящий вебхук с правами CRM)
const B24_WEBHOOK = process.env.B24_WEBHOOK;
if (!B24_WEBHOOK) console.warn('⚠️  B24_WEBHOOK не задан — заявки в CRM отправляться не будут');

// Parse JSON body
app.use(express.json());

// API: создание сделки + контакта в Битрикс24
app.post('/api/lead', async (req, res) => {
  const { title, name, phone, email, comment, source } = req.body;
  console.log('→ /api/lead', title);

  if (!B24_WEBHOOK) {
    return res.status(503).json({ ok: false, error: 'CRM не настроена' });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    // 1. Создаём контакт
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

    // 2. Создаём сделку, привязанную к контакту
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

// Serve static files from dist/
app.use(express.static(DIST));

// SPA fallback — любой не-API маршрут → index.html
app.get('/{*splat}', (req, res) => {
  res.sendFile(join(DIST, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`РПКМ server → http://localhost:${PORT}`);
});
