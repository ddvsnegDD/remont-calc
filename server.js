import express from 'express';
import { resolve, join } from 'path';

const app = express();
const PORT = process.env.PORT || 3000;
const DIST = resolve('dist');

// Битрикс24 webhook (входящий вебхук с правами на CRM)
const B24_WEBHOOK = process.env.B24_WEBHOOK || 'https://b24-0ouhlh.bitrix24.ru/rest/1/j3vt2f9w9lh6s23x';

// Parse JSON body
app.use(express.json());

// API: создание лида в Битрикс24
app.post('/api/lead', async (req, res) => {
  console.log('→ /api/lead', req.body?.fields?.TITLE);
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(`${B24_WEBHOOK}/crm.lead.add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: req.body.fields }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const data = await response.json();
    console.log('← B24 response:', JSON.stringify(data).slice(0, 200));

    if (data.result) {
      res.json({ ok: true, id: data.result });
    } else {
      console.error('B24 error:', data);
      res.status(400).json({ ok: false, error: data.error_description || 'Ошибка Битрикс24' });
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
