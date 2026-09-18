# ТЗ: платёжный контур и вход (P0)

**Источник:** `REPORT_iskra_audit_2026-09-17.md`, §1.1 §1.2 §1.3 §1.4 (+ мелочи §2.6 §2.7 попутно, они в тех же файлах).
**Дата:** 2026-09-18.
**Решения владельца, на которых стоит это ТЗ:**
- Оплата через ЮMoney не работает и чиниться не будет. Переезд на ЮKassa — отдельным ТЗ после этого.
- Активных платных подписчиков нет, совместимость со старыми ручками не нужна.
- Выдача подписки до появления ЮKassa — только вручную через `/admin` (эндпоинт уже есть).

Номера строк даны по снимку от 18.09.2026, при расхождении ищи по grep-якорям.

---

## Часть 1. Удалить мёртвый платёжный контур ЮMoney

### Проблема

Две дыры из отчёта закрываются не патчем, а удалением кода.

**§1.1.** Цепочка выдаёт подписку бесплатно: любой залогиненный шлёт `POST /api/subscription/pay` (создаётся `pending` с предсказуемым `label = sub_<id>_<Date.now()>`), сразу `POST /api/subscription/activate` с этим label, получает активную подписку. Оплата в цепочке не участвует. `activateSubscription(label)` в `server/db.js` не сверяет `user_id`, так что активировать можно и чужой pending.

**§1.4.** `YOOMONEY_SECRET` пуст, поэтому блок `if (YOOMONEY_SECRET) { ... }` не выполняется: любой неавторизованный POST на `/api/subscription/yoomoney-webhook` с любым телом активирует подписку по переданному label. Плюс сумма не сверяется с ценой плана и нет идемпотентности по `operation_id`.

### Что сделать

**1.1. `server.js`**

- Удалить константы (строки 16–17, якорь `YOOMONEY_WALLET`):
  ```js
  const YOOMONEY_WALLET = process.env.YOOMONEY_WALLET || '4100183647078';
  const YOOMONEY_SECRET = process.env.YOOMONEY_SECRET || '';
  ```
- Удалить целиком три роута:
  - `app.post('/api/subscription/pay'` (строки 172–199)
  - `app.post('/api/subscription/yoomoney-webhook'` (строки 202–230)
  - `app.post('/api/subscription/activate'` (строки 265–274)
- Из импорта на строке 6 убрать `createPendingSubscription` и `activateSubscription`.
- `import crypto from 'crypto'` (строка 4) **оставить** — он понадобится в части 2.
- `PLANS` из `src/data/tariffs.js` остаётся: цены показываются на страницах тарифов. `tierOf` тоже остаётся.

**1.2. `server/db.js`**

- Удалить `createPendingSubscription` (строки 124–130) и `activateSubscription` (строки 132–145).
- После удаления проверить импорт на строке 2: `import { daysOf } from '../src/data/tariffs.js'` — если `daysOf` больше нигде в файле не вызывается, убрать импорт. Сам `daysOf` в `tariffs.js` не трогать.
- Таблицу `subscriptions` и колонки `payment_label` / `payment_id` / `amount` **не трогать**: под ЮKassa они пригодятся, ломать схему боевой БД ради косметики не нужно.

**1.3. `src/pages/ClubPage.jsx`**

- Удалить `useEffect`, обрабатывающий возврат с оплаты (строки 46–76, якорь `const payment = searchParams.get('payment')`). Вместе с ним уходит единственный вызов `/api/subscription/activate` на этой странице.
- `handlePay` (строки 118–140, якорь `const res = await fetch('/api/subscription/pay'`) заменить на заглушку, кнопки тарифов **не удалять**:
  ```js
  const handlePay = async () => {
    setNotice('Оплата временно недоступна: подключаем ЮKassa. Напишите на ddv1121@yandex.ru, откроем доступ вручную.');
  };
  ```
- Состояние `payLoading` и `setPayLoading` после этого не используется — убрать, если линтер ругается.
- Проверить, остался ли в импорте `useSearchParams` нужным (в файле он используется только ради `payment`/`label`). Если нет — убрать вместе с `const [searchParams] = useSearchParams()`.
- Пункт FAQ «Как происходит оплата?» (строка 31) переписать: `'Сейчас подключаем приём платежей через ЮKassa. Пока оплата недоступна, напишите нам — откроем доступ.'`

**1.4. `src/pages/ProPage.jsx`**

- То же самое: удалить `useEffect` возврата с оплаты (строки 43–73, якорь `// Возврат с ЮMoney`), `handlePay` (строки 75–97) заменить на ту же заглушку с notice.

**1.5. Что оставить как есть**

- `/api/subscription/trial`, `/api/subscription/cancel`, `/api/subscription/status` — работают, не трогать.
- Все `/api/admin/*`, `grantSubscription`, `cancelSubscription`, `deleteUser` — не трогать.
- Тексты про ЮMoney в `OfferPage.jsx`, `PrivacyPage.jsx`, `ConsentPage.jsx` — **не трогать в этом ТЗ**. Их правим одним заходом в ТЗ по ЮKassa, чтобы не переписывать юридические тексты дважды.
- Строки `status = 'pending'` в боевой БД оставить, они никому не мешают. Счётчик `pending_payments` в админ-статистике тоже остаётся.

### Критерии приёмки (часть 1)

1. `grep -rn "yoomoney\|YOOMONEY\|activateSubscription\|createPendingSubscription\|paymentUrl" server.js server/ src/` даёт пусто (кроме юридических текстов из п. 1.5).
2. `POST /api/subscription/activate` и `POST /api/subscription/pay` возвращают 404 (после части 3 — JSON `{ok:false}`, до неё — HTML).
3. `POST /api/subscription/yoomoney-webhook` с любым телом возвращает 404 и подписку не создаёт.
4. Кнопка оплаты на `/club` и `/pro` показывает понятное уведомление, никуда не редиректит и не роняет страницу.
5. Триал по кнопке «Попробовать 14 дней» по-прежнему выдаётся; выдача подписки из `/admin` работает.

---

## Часть 2. Коды входа: 6 цифр, лимиты, счётчик попыток (§1.3)

### Проблема

`const code = String(Math.floor(1000 + Math.random() * 9000)); // 4 digits` — 10 000 вариантов, время жизни 10 минут, `rateLimit` на auth-роутах не стоит (он применён только к `/api/calculation` и `/api/contact`), в таблице `auth_codes` нет счётчика попыток. Зная чей-то email, аккаунт открывается перебором за минуты. Через аккаунт видны его расчёты и подписка. Это единственная дыра, которая эксплуатируется прямо сейчас.

### Что сделать

**2.1. `server.js`, `/api/auth/send-code` (строка 92)**

- Заменить генератор:
  ```js
  const code = String(crypto.randomInt(100000, 1000000)); // 6 цифр, CSPRNG
  ```
- Нормализовать email один раз в начале хендлера: `const mail = String(email || '').trim().toLowerCase();`
- Валидацию `!email.includes('@')` заменить на `EMAIL_RE.test(mail)`. Константа `EMAIL_RE` объявлена на строке 380, то есть ниже по файлу — **перенести её объявление вверх**, к остальным константам (после строки 20), иначе получишь TDZ-ошибку.
- Перед `saveAuthCode` поставить два лимитера:
  ```js
  if (!rateLimit(`send:${mail}`, 3, 10 * 60 * 1000))
    return res.status(429).json({ ok: false, error: 'Слишком много запросов кода. Попробуйте через 10 минут.' });
  if (!rateLimit(`send-ip:${req.ip}`, 10, 10 * 60 * 1000))
    return res.status(429).json({ ok: false, error: 'Слишком много запросов. Попробуйте позже.' });
  ```

**2.2. `server.js`, `/api/auth/verify` (строка 108)**

- Так же нормализовать email и добавить перед `verifyAuthCode`:
  ```js
  if (!rateLimit(`verify-ip:${req.ip}`, 20, 10 * 60 * 1000))
    return res.status(429).json({ ok: false, error: 'Слишком много попыток. Попробуйте позже.' });
  if (!rateLimit(`verify:${mail}`, 5, 10 * 60 * 1000))
    return res.status(429).json({ ok: false, error: 'Слишком много попыток. Запросите новый код через 10 минут.' });
  ```

**2.3. `server/db.js`, миграция**

В `initDB()`, рядом с существующими `ALTER TABLE users ADD COLUMN IF NOT EXISTS ...` (строки 27–29), добавить:
```sql
ALTER TABLE auth_codes ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0;
```
Колонку `code VARCHAR(6)` не менять, шесть цифр в неё помещаются ровно.

**2.4. `server/db.js`, `verifyAuthCode` (строка 88)**

Сейчас запрос ищет сразу по паре `(email, code)`, поэтому неверную попытку негде посчитать. Переписать: сначала достаём последний живой код по email, потом сравниваем.

```js
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
```

Побочный эффект, который надо понимать: проверяется только самый свежий код. Если пользователь нажал «отправить код» дважды, старый код перестаёт работать. Это нормальное поведение, но сообщение об ошибке на фронте должно быть «Неверный или просроченный код», как сейчас, без уточнений.

**2.5. Фронт: три места с четвёркой**

`maxLength={4}`, `slice(0, 4)`, `code.length < 4` и текст «Отправили 4-значный код» встречаются в трёх файлах:

- `src/components/LoginModal.jsx` — строки 61, 154, 161, 163
- `src/pages/LoginChoicePage.jsx` — строки 58, 176, 183, 185
- `src/pages/B2BLoginPage.jsx` — строки 78, 243, 250, 252

Во всех трёх: `4` → `6`, текст «4-значный» → «6-значный», сообщение об ошибке «Введите 4-значный код» → «Введите 6-значный код». Проверить, что рядом стоит `inputMode="numeric"`; если нет, добавить.

**2.6. `server/email.js`**

Шаблон письма (строка 175, якорь `letter-spacing:6px`) рассчитан на короткий код. Убедиться, что шесть цифр не ломают вёрстку письма; при необходимости уменьшить `letter-spacing` до 4px. Текст «Ваш код входа» не трогать.

### Критерии приёмки (часть 2)

1. Код в письме и в логе сервера состоит из шести цифр.
2. Четвёртый подряд `POST /api/auth/send-code` на тот же email в течение 10 минут возвращает 429.
3. Пять неверных кодов подряд → шестая попытка не проходит даже с верным кодом (код помечен `used`), нужно запросить новый.
4. В таблице `auth_codes` появилась колонка `attempts`, значения растут при неверных попытках.
5. Обычный вход (запросил код, ввёл верный с первого раза) работает на всех трёх формах входа: модалка, `/login`, `/b2b-login`.

---

## Часть 3. Fail-fast на секреты и две мелочи в том же файле

### 3.1 Секреты (§1.2)

Сейчас при отсутствии `.env` сервер молча поднимается с известным JWT-секретом и известным admin-паролем, `/api/health` при этом зелёный. На боевом VPS переменные заданы, так что это профилактика на случай переезда или опечатки в `ecosystem.config.cjs`.

В `server.js`, сразу после объявления `JWT_SECRET` и `ADMIN_PASSWORD` (строки 14–15):

```js
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
```

**Предупреждение по деплою.** После этой правки сервер с пустым окружением не поднимется, а PM2 уйдёт в crash-loop и сайт ляжет. Перед деплоем обязательно проверить на VPS, что переменные видны именно процессу `rpkm`:

```bash
pm2 env rpkm | grep -E 'JWT_SECRET|ADMIN_PASSWORD|NODE_ENV'
```

Если вывод пуст, сначала чинить `.env` / `ecosystem.config.cjs`, деплой не запускать.

### 3.2 404 для несуществующих API (§2.6)

Сейчас `app.get('/{*splat}')` (строка 546) отдаёт `index.html` на любой путь, включая `/api/чего-нибудь`, то есть на удалённые в части 1 ручки клиент получит 200 и HTML вместо честной ошибки. Перед этим роутом вставить:

```js
app.use('/api', (req, res) => res.status(404).json({ ok: false, error: 'Не найдено' }));
```

### 3.3 `/api/health` не должен отдавать текст ошибки БД (§2.7)

Якорь `status.dbError = err.message`. Заменить на запись в лог, в ответе оставить только флаг:

```js
} catch (err) {
  status.dbLive = false;
  console.error('health: DB error:', err.message);
}
```

Соответственно убрать `dbError` из формируемого объекта ответа, если он там объявлен заранее.

### Критерии приёмки (часть 3)

1. `NODE_ENV=production node server.js` без переменных окружения завершается за секунду с понятным сообщением и кодом 1.
2. С заданными `JWT_SECRET` (≥32 символов) и `ADMIN_PASSWORD` сервер стартует как раньше.
3. `GET /api/nonexistent` → 404 и JSON, не HTML.
4. `GET /api/health` при недоступной БД не содержит `dbError` и текста ошибки PostgreSQL.

---

## Не трогать во всём ТЗ

- Расчётные модули: `src/lib/calculator.js`, `src/lib/spec-calculator.js`, `src/lib/office-calculator.js` и данные в `src/data/`. Они правятся отдельным ТЗ по расчётам.
- Схему таблиц, кроме одного `ALTER TABLE auth_codes ADD COLUMN IF NOT EXISTS attempts`.
- Nginx, `deploy.sh`, README, РЕЗЮМЕ — отдельное ТЗ по инфраструктуре и документам.
- Гейт `hasPro` / `hasClub` и вынос базы расценок за серверный гейт (§1.5) — отдельное продуктовое решение.
- Admin-доступ по `x-admin-token` (§1.6) — сознательно отложен, решается вместе с ЮKassa.

## Порядок работ и самопроверка

1. Часть 1 (удаление), `node --check server.js && node --check server/db.js`.
2. Часть 2 (коды входа), там же проверка синтаксиса.
3. Часть 3 (секреты и мелочи).
4. `npx vite build` — сборка должна пройти без ошибок и без предупреждений о неиспользуемых импортах в правленых файлах.
5. Локальный прогон: `npm run dev:server` + `npm run dev`, пройти вход по коду от начала до конца на `/login`.
6. Перед деплоем — проверка `pm2 env rpkm` из п. 3.1.
7. Деплой только по явной команде владельца. Перед ним — бэкап БД (`pg_dump rpkm`), потому что в части 2 есть ALTER.

## Что написать в отчёте

Файл `docs/REPORT_payments_auth_hardening.md`: что удалено (со списком строк), что изменено в `verifyAuthCode`, результат ALTER на боевой БД, вывод проверок по каждому критерию приёмки. Отдельно отметить, если какая-то правка оказалась невозможна и почему.
