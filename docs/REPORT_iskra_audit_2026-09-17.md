# REPORT: аудит РПКМ (Искра) — 2026-09-17

**Автор:** Искра (Dzyga D.), 4-проходное код-ревью + самостоятельная перепроверка критичных пунктов.
**Для кого:** Claude Chat — проверить находки по коду (протокол ниже) и подготовить TASK-файл(ы) для Claude Code.
**Репозиторий в момент аудита:** копия без `.git` (синхронизированная папка). **Номера строк могут drift'нуть — ищите по grep-якорям, которые даны у каждой находки.**
**Окружение проверки:** Node v24. Расчётные движки прогонялись реально (ESM-модули, loader-хук для импортов без расширения). `npm install`/`vite build`/`npm run dev`/PostgreSQL в песочнице недоступны — статика по серверу и клиенту.

## Как читать уровни достоверности

| Метка | Значение |
|---|---|
| `[VERIFIED:код]` | Родитель (Искра) сам перечитал строки, цитата приведена |
| `[VERIFIED:прогон]` | Получено фактическим запуском кода в Node, числа — вывод |
| `[SUBAGENT]` | Из отчёта субагента, родителем не перепроверено → **проверьте в первую очередь** |

---

## 0. Что уже сделано (закрыть старые TASK, не переделывать)

Три открытых ТЗ в `docs/` **реализованы**, отчётов по ним нет:

- `TASK_role_downgrade.md` → якорь `CASE WHEN EXCLUDED.role` — в `server/db.js` стоит `role = CASE WHEN EXCLUDED.role = 'b2b' THEN 'b2b' ELSE users.role END,` `[VERIFIED:код]`
- `TASK_tariffs.md` → есть `src/data/tariffs.js` (PLANS: `club_monthly 99`, `club_yearly 990`, `pro_monthly 2900`, `tierOf()` с legacy-маппингом), в `server.js` — `const PLANS = PLANS_SRC`, `const PRO_URL = PRO_PUBLIC_URL`, `returnPath = planData.tier === 'pro' ? '/pro' : '/club'`, в `/api/auth/me` — `tier: tierOf(sub.plan)` `[VERIFIED:код]`
- `TASK_PRO_gate.md` → `ProPaywall.jsx` существует, `src/lib/auth.jsx` отдаёт `tier/hasClub/hasPro/hasAccess` `[VERIFIED:код]`

**Действие капитана:** сверить с критериями приёмки своих ТЗ и написать закрывающие `REPORT_*.md`, иначе следующая задача встанет на устаревшую карту проекта. Отдельно: в `TASK_tariffs.md` ещё актуальна ли часть про «реальная оплата PRO» (платёжный контуры сломаны — см. §1.1, §1.4) и §7 из этого отчёта (бандл с закрытыми данными).

---

## 1. P0 — платёж и доступ. Чинить до следующего деплоя

### 1.1 🔴 Бесплатная самоактивация подписки (любой пользователь → себе PRO)
`[VERIFIED:код]`

Якорь: `app.post('/api/subscription/activate'` — в `server.js` (секция «Ручная активация (для демо / после возврата с ЮMoney)»):

```js
app.post('/api/subscription/activate', authMiddleware, async (req, res) => {
  const { label } = req.body;
  if (!label) return res.status(400).json({ ok: false });
  const sub = await activateSubscription(label);   // ← только по label, user_id не сверяется
```

Якорь: `export async function activateSubscription(label)` — в `server/db.js`:

```sql
SELECT plan FROM subscriptions WHERE payment_label = $1 AND status = 'pending' LIMIT 1
...
UPDATE subscriptions SET status = 'active', ... WHERE payment_label = $1 AND status = 'pending' RETURNING *
```

Предсказуемость label, якорь `` const label = `sub_${user.id}_${Date.now()}` `` в `server.js` (ручка `/api/subscription/pay`): user id последовательный, `Date.now()` known-окно. Атакующий: `/pay` (создаёт pending, оплата не требуется) → подбор `sub_<id>_<ms>` → активация своей или чужой подписки, бессрочно (срок есть, но выдаётся бесплатно).

**Фикс:** `activateSubscription(label, userId)` + `AND user_id = $2`; в route передавать `req.user.id`; при `!sub` — 403/404. Либо удалить ручку из прода entirely (активация только через вебхук), а «демо» оставить за админ-эндпоинтом, который уже есть (`/api/admin/users/:id/subscription`).
**Проверка капитаном:** grep `activateSubscription` → убедиться, что единственный вызов с user_id.
**Приёмка:** POST activate чужим label → не активируется; свой label после `/pay` активирует только свою подписку.

### 1.2 🔴 Секреты-дефолты молча работают в проде
`[VERIFIED:код]`

```js
const JWT_SECRET = process.env.JWT_SECRET || 'rpkm-dev-secret-change-in-prod';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'rpkm-admin-2026';
const YOOMONEY_WALLET = process.env.YOOMONEY_WALLET || '4100183647078';
const YOOMONEY_SECRET = process.env.YOOMONEY_SECRET || '';
```
Якорь: `rpkm-dev-secret-change-in-prod` в начале `server.js`.

Пустой `.env` → сервер стартует (pm2 «онлайн», `/api/health` зелёный) с **известным** JWT-секретом (подделка токена любого пользователя) и **известным** admin-паролем (`/admin`, `x-admin-token`), и с **выключенной** проверкой вебхука (§1.4). Кошелёк тоже захардкожен как дефолт.

**Фикс:** fail-fast в `start()` (или сразу после констант): при `NODE_ENV === 'production'` отсутствие `JWT_SECRET`/`ADMIN_PASSWORD` (или совпадение с дефолтами) → `throw`. Значение по умолчанию убрать, кошелёк — только из env.
**Приёмка:** `NODE_ENV=production node server.js` без env-переменных завершается ошибкой за секунду, не поднимаясь.

### 1.3 🔴 Коды входа: 4 цифры, 10 минут, ноль ограничителей
`[VERIFIED:код]`

Якорь A (RNG): `String(Math.floor(1000 + Math.random() * 9000)); // 4 digits` в `server.js` (`/api/auth/send-code`).
Якорь B (вызовы лимитера): `grep -n "rateLimit(" server.js` даёт ровно три строки: определение `function rateLimit(...)` и **два** вызова — на `calculation` и `contact`. На `/api/auth/send-code` и `/api/auth/verify` лимитера **нет**.
Якорь C (таблица): в `server/db.js`, `CREATE TABLE IF NOT EXISTS auth_codes (...)` — колонок `attempts`/`failed_attempts` нет; `verifyAuthCode` только SELECT по соответствию + `used = FALSE AND expires_at > NOW()` и UPDATE `used = TRUE`.

Итого: 10 000 вариантов, `Math.random()` (не crypto), TTL 10 мин (`new Date(Date.now() + 10 * 60 * 1000)` в `saveAuthCode`), попыток никто не считает → онлайн-подбор за минуты на известный email.

**Фикс:** `crypto.randomInt(100000, 1000000)`; `rateLimit('send:'+email, 3, 10*60*1000)`, `rateLimit('verify:'+ip, 20, 10*60*1000)`, `rateLimit('verify:'+email, 5, 10*60*1000)`; колонка `attempts` (ALTER + `DEFAULT 0`), инкремент при неверном коде, инвалидация после 5.
**Приёмка:** 6 неверных кодов → код мёртв; 4-й `send-code` на тот же email → 429; код 6 знаков.

### 1.4 🔴 Вебхук ЮMoney: подпись опциональна, сумма не сверяется, нет идемпотентности
`[VERIFIED:код]`

```js
app.post('/api/subscription/yoomoney-webhook', async (req, res) => {
  const { notification_type, operation_id, amount, currency, datetime, sender, codepro, label, sha1_hash } = req.body;
  console.log('💰 ЮMoney webhook:', { label, amount, operation_id });
  if (YOOMONEY_SECRET) { /* сверка sha1 */ }
```
Якорь: `if (YOOMONEY_SECRET)` в `server.js`.

Три дефекта в одном месте: (а) при пустом секрете — верификации нет вообще, любой POST активирует подписку; (б) `amount` принимается, но не сверяется с `PLANS[plan].price`; (в) `operation_id` пишется без unique — повтор/параллельный ретрай вебхука может дважды обновить `expires_at`. Строка `codepro` и `sender` в проверке есть — хорошо, но SHA1 без `timingSafeEqual`.
**Фикс:** обязательная сверка подписи в production (без секрета — 500 и alert-лог); `amount` ↔ цена плана; UNIQUE-индекс `subscriptions.notification_id` (`operation_id`) + вставка `ON CONFLICT DO NOTHING`, возврат `skipped` при дубле; сравнение хэша через `crypto.timingSafeEqual`.
**Проверить на сервере:** настроен ли HTTP-вебхук на кошельке и задан ли секрет (см. §4).
**Приёмка:** POST без `sha1_hash` → 400; с подписью, но суммой меньше цены → подписка не активна; повтор того же `operation_id` → срок не удваивается.

### 1.5 🟠 Гейт `hasPro` существует, но закрытые данные — в бандле
`[VERIFIED:код]` (частично `[SUBAGENT]` по размерам)

- Клиентская логика уровня тарифа (`src/lib/auth.jsx`, якорь `const hasAccess = hasClub; // алиас`):
  ```js
  const tier = subTier(subscription);
  const hasClub = tier === 'club' || tier === 'pro';
  const hasPro = tier === 'pro';
  ```
  Разделение **правильное**; сервер в `/api/auth/me` тоже отдаёт `tier`. `ProPage.jsx` использует `hasPro` (якорь `const { loading, hasPro } = useAuth();`), «Моё демо-решение» убрано в пользу `B2B_RESULT_DEMO`.
- Но: `src/lib/spec-data.js`, `src/data/office-vis-data*.js`, `office-finish-data*.js` (~1,5 МБ суммарно) импортируются напрямую и физически скачиваются **каждому** посетителю до оплаты; детальная спецификация собирается на клиенте. Открыть devtools → все расценки видны.
- Про `hasAccess` как алиас: где он ещё используется вместо `hasPro`/`hasClub` — **[SUBAGENT]**, требуется grep `hasAccess` по `src/` и сверка каждого места с целевым уровнем.

**Фикс (проектный, отдельной задачей):** вынести детальные data-файлы за серверный гейт (`GET /api/data/office-detail?tier=...` под `authMiddleware` + сверка `tierOf` ≥ pro, lazy-загрузка чанка после оплаты) либо серверный расчёт. Быстрых полумер нет: минификация/обфускация не спасает.
**Решение за владельцем:** принять риск (база расценок — конкурентное преимущество) или ставить в план.

### 1.6 🟠 Admin-доступ: статический пароль в заголовке и в sessionStorage
`[VERIFIED:код]` + `[SUBAGENT]` по фронту

```js
function adminAuth(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (token !== ADMIN_PASSWORD) return res.status(403).json({ ok: false, error: 'Доступ запрещён' });
```
Якорь: `x-admin-token`. Ротация нет, срок нет, сравнение не constant-time, на `/api/admin/*` (stats, users, DELETE user, POST/DELETE subscription — якорь `app.delete('/api/admin/users/:id'` и др.) rate limit отсутствует.
**[SUBAGENT]** `AdminPage.jsx`: пароль кладётся в `sessionStorage['rpkm_admin']` и живёт до закрытия вкладки.
**Фикс:** отдельная admin-сессия (JWT с коротким TTL, выдача по паролю + повторная сверка), `crypto.timingSafeEqual`, `rateLimit('admin:'+ip, 10, 5*60*1000)` на все `/api/admin/*`.

---

## 2. P1 — надёжность расчётов и прода

### 2.1 🟠 `formatRub` падает на undefined
`[VERIFIED:прогон]`

```
formatRub(undefined) → CRASH: TypeError: Cannot read properties of undefined (reading 'toLocaleString')
formatRub(NaN)       → "не число ₽"
formatRub(Infinity)  → "Infinity млн ₽"
```
Якорь: `export function formatRub(n)` в `src/lib/calculator.js`. Путь падения: страница результата читает `sessionStorage('rpkm-last-b2c')` без `JSON.parse`-валидации (**[SUBAGENT]** по точному месту — grep `rpkm-last-b2c`).
**Фикс:** `if (!Number.isFinite(n)) return '—';` + `try/catch` на `JSON.parse` в местах чтения sessionStorage.

### 2.2 🟠 Нет валидации площади: «смета из ничего» и отрицательные деньги
`[VERIFIED:прогон]`

```
SpecCalc.compute: area=0 | -50 | NaN | 'abc' | undefined  →  grand = 1 687 351 ₽ во всех случаях
B2C calculateB2C: area=-50 → totalLow = -3 600 000 ₽, avgTotal = -4 350 000 ₽
B2C calculateB2C: area=1e9 → totalLow = 6.0e+13 ₽
```
Якоря: `Math.max(1, parseFloat(area) || 0)` в `src/lib/spec-calculator.js` (`SpecCalc.compute`) и `parseFloat(answers.area) || 60` в `src/lib/calculator.js` (`calculateB2C`).
`[SUBAGENT]` дополнительно: `calculateB2B` — `parseInt(answers.bathrooms || 1)` даёт NaN на мусоре → вся смета NaN; детальный офисный калькулятор не клампит площадь, `S=0` даёт `0 ₽/м²` в шапке.
**Фикс:** единый валидатор `validateArea(v, {min, max})` до расчёта; на невалидном входе — сообщение в UI, не дефолт. B2C: 5…2000 м²; B2B-предвар: 30…200 000; детальный офис — так же. Плюс проверка `bathrooms`/`workplaces`/`meetingRooms` на `Number.isFinite && >=0`.

### 2.3 🟠 Replan считается от базы, в которой уже лежит premium-резерв
`[SUBAGENT]` — **проверить обязательно**

В `src/lib/spec-calculator.js` (якорь: `replanPct` и последующее применение `Math.round(grandTotal * replanPct)`) надбавка за перепланировку берётся от итога **после** `premiumReserve`, тогда как `TIERS` и README описывают её как долю работ. Заявлено расхождение: премиум 60 м² + replan full → +118 866 ₽ относительно «правильного» порядка.
**Что сделать:** решить документированно — либо применять % до резерва (и синхронизировать РЕЗЮМЕ), либо оставить и вынести константой `RESERVE_BEFORE_REPLAN = true`, чтобы не «чинилось» молча в будущем.

### 2.4 🟠 Калибровка «Технопарк 32 434 ₽/м²» не воспроизводима при целочисленном вводе UI
`[SUBAGENT]` — **проверить обязательно** (цифры из расчёта субагента)

Механизм: по 1636 позициям ВИС «Стандарт» объёмы режутся через `Math.ceil(qOrig * ratio)`. На границе `S1 = 19225.85` → 32 200 ₽/м²; `S1 = 19226` → механика 14 319 + ЭОМ 25 676 ≈ **+18%** разницы на 0,15 м². UI вводит площадь с шагом 1 (целые) → реальный пользователь видит ≈50 000 ₽/м² вместо заявленных 32 434.
**Фикс-кандидат:** `Math.ceil` только для `Шт`/`Компл` (дискретное оборудование), для `Площадь`/`пог.м` оставлять дробный объём (округление только итога).
**Как проверять:** собрать функцию, вернуть `totals.perM2` для `S1 = 19225.85` и `19226` — увидеть скачок; после фикса — его отсутствие.

### 2.5 🟠 Nginx: в репозитории только HTTP, HTTPS-блок живёт вне git
`[VERIFIED:код]`

`nginx/rpkm.conf` (424 байта, якорь `listen 80;`) — единственный listen, **нет**: 443/сертификата, редиректа 80→443, `try_files ... /index.html`, `location /api` прокси на 3001, `proxy_read_timeout`, всех security-заголовков (HSTS/CSP/X-Frame-Options/X-Content-Type-Options/Referrer-Policy), `gzip`, `client_max_body_size`. При этом `deploy.sh` (якорь `HEALTH_URL` / `curl -sk https://`) проверяет именно https, а README заявляет Let's Encrypt.
**[SUBAGENT]** по `ssl_ciphers`/`ssl_protocols` — их нет в файле репо (логично, раз нет 443-блока).
**Что сделать:** `sudo nginx -T` на VPS → перенести **полный** рабочий конфиг в `nginx/rpkm.conf` (2 server-блока), добавить заголовки, `try_files`, раздельное кеширование (`/assets` → `immutable, max-age=31536000`; `/api` → `no-store`), `client_max_body_size` только на `POST /api/consultation`. Без этого прод невоспроизводим с нуля — риск при переезде на новый VPS.

### 2.6 🟠 `server.js` `app.get('/{*splat}')` глушит 404 для API
`[SUBAGENT]` — якорь `{*splat}`. `GET /api/whatever` → 200 + HTML. **Фикс:** перед fallback — `app.use('/api', (req,res)=>res.status(404).json({ok:false,error:'Не найдено'}))`.

### 2.7 🟠 `/api/health` наружу отдаёт строку ошибки БД
`[VERIFIED:код]`

```js
} catch (err) {
  status.dbLive = false;
  status.dbError = err.message;   // ← уходит в публичный JSON
}
```
Якорь: `status.dbError = err.message`. **Фикс:** подробности только в `console.error`; в ответе — флаги. Заодно: поле `email` в health строится по наличию env-ключей (это ок), но проверьте, что не раскрывает имена провайдеров.

### 2.8 🟠 deploy.sh: нет автоотката, `pm2 save` трогает чужие процессы
`[VERIFIED:код]` + `[SUBAGENT]` по деталям

Якоря: `pm2 reload rpkm --update-env || pm2 restart rpkm` (при падении приложения на старте — crash-loop, health-check лишь печатает «⚠️ Health-check не прошёл» и `exit 1`, **уже после** перезапуска продеплоя), `pm2 save` (на shared-VPS фиксирует список всех процессов, включая n8n), `|| true` на `rm -rf node_modules && npm ci` (падение установки молча продолжает деплой на старых зависимостях), `read -rp` интерактив (несовместимо с cron/CI).
**Что сделать:** `OLD=$(git rev-parse HEAD)` → после `pm2 restart` жечь health 10×2 c; при фейле — `git checkout $OLD && npm ci && npm run build && pm2 restart` и `exit 1`. `pm2 save` заменить на `pm2 describe rpkm` (или убрать). Убрать `|| true`, добавить `--non-interactive`-режим (env `CI=1`).

### 2.9 🟠 Google Fonts напрямую
`[SUBAGENT]` — якоря `fonts.googleapis.com` в `index.html` (пре-коннект + 2 stylesheet) и `@import` в `src/styles/global.css` (шрифт в кириллической подсети с `text=`-подсетями). Для 152-ФЗ это передача IP/UA третьей стороной при каждом визите; плюс риск недоступности в РФ → деградация вёрстки.
**Фикс:** self-host Inter/Golos Text/Cormorant Garamond (все — открытые лицензии, OFL), `woff2` + `font-display: swap`, убрать `@import` из CSS.

### 2.10 🟠 Печатные отчёты: незакрытые векторы XSS
`[SUBAGENT]` — **проверить обязательно**

Якоря в `src/lib/estimateReport.js` и `src/lib/checklistReport.js`:
- `<img src="${p.photo}">` в `buildChecklistHTML` — путь фотофиксации идёт из localStorage без экранирования/whitelist схемы (`javascript:` в атрибуте src безвреден в современных браузерах, но `"` ломает атрибут → инъекция произвольных атрибутов);
- `<span ...>${g.icon}</span>` (3 места) — интерполяция без `esc()`; сейчас там захардкожены эмодзи, риск при будущих правках данных;
- `buildSpecHTML(..., 'Квартира')` и `buildEstimateHTML(answers, result)` без третьего аргумента → `<title>Смета — undefined</title>` (якорь `est.title`).

**Фикс:** пропускать через уже существующий `esc()`, для фото — `p.photo.startsWith('data:image/') ? p.photo : ''`.

---

## 3. P2 — гигиена и рассинхрон документов

### 3.1 🔵 Документы врут о деньгах и о составе проекта
- **Тарифы.** Правда (`src/data/tariffs.js`, `[VERIFIED:код]`): `club_monthly 99`, `club_yearly 990`, `pro_monthly 2900`, trial → club. `README.md` и `РЕЗЮМЕ-ПРОЕКТА.md` всё ещё пишут **490/4900** как про активные цены. Сверить и с `/offer`.
- **Фантомные сущности.** `[VERIFIED:код]`: `src/lib/bitrix.js` — **отсутствует**, `grep -n "bitrix" -i server.js` — пусто, `/api/lead` — нет; файлов `PartnerB2BPage.jsx`, `PartnerB2CPage.jsx`, `B2CBookPage.jsx` — нет (маршруты живые, редирект `Navigate to="/" replace`). При этом РЕЗЮМЕ продолжает описывать «Интеграция с CRM (Битрикс24)», `/b2c-book`, партнёрские программы как функции.
- **Число маршрутов:** App.jsx содержит **27** `<Route>` (включая 4 редиректа); в README «28», в РЕЗЮМЕ в разных местах «26» и «27». Мелочь, но это индекс актуальности карты.
- **Объёмы данных** `[SUBAGENT]`: заявленные «~2200 позиций отделки / ~1700 ВИС» против фактических подсчётов по `id`: finish-Std **534 поз. / 41 группа**, vis-Std **1636**, vis-Biz **2075** (в резюме 2074), всего в `data/` ≈4279 против «5000+» в README. Дубликатов id нет, «Премиум» tier действительно не существует (групп 0) — это в TODO, ок.
- **README и `.env.example` расходятся с кодом** `[SUBAGENT]`: `.env.example` не документирует `B24_WEBHOOK` (мертво), `UNISENDER_GO_API_KEY/URL`, `EMAIL_FROM`, `CONTACT_EMAIL`, `YOOMONEY_WALLET/SECRET`, `BREVO_API_KEY`, `RESEND_API_KEY`, `ADMIN_EMAIL`, `SITE_URL` (все читаются в `server.js`/`server/email.js`); при этом описывает `SMTP_*` как «основной путь», тогда как README ставит во главу UniSender Go. В `package.json` нет `engines` (якорь `"engines"`) при требовании Express 5 → Node ≥18.

### 3.2 🔵 Мёртвый код и зависимости `[SUBAGENT]` (кроме помеченных VERIFIED)
- `server.js`: `const RAILWAY_PUBLIC_DOMAIN = process.env.RAILWAY_PUBLIC_DOMAIN || '';` — легаси Railway выведен; `const SITE_URL = process.env.APP_URL || 'http://localhost:5173'` — vite-dev-порт как дефолт прод-редиректа оплаты (якорь `SITE_URL`).
- `package.json`: `serve` в `dependencies` не используется ни в одном скрипте; `serve-static` и `send` — в `devDependencies`, хотя нужны рантайм-серверу (для `npm ci --omit=dev` это критично — **[SUBAGENT]**, проверить: `grep -n "serve-static\|from 'send'" server.js`).
- `src/pages/B2BOfficeDetailPage.jsx`: `B2B_DEMO_AVAILABLE = true` — демо открыто всем, то есть §1.5 работает против PRO-гейта даже на уровне UI (якорь `B2B_DEMO_AVAILABLE`).
- Остатки после рефакторинга позиционирования: `README.md` всё ещё содержит раздел «Интеграция с CRM (Битрикс24)» и «Данные по офису» со ссылкой на несуществующий `src/lib/bitrix.js`.

### 3.3 🔵 Прочее
- Cookie: `sameSite: 'lax'` (`[VERIFIED:код]`, якорь `sameSite`) — при `trust proxy` и кросс-доменных сценариях ок; убедитесь, что форма оплаты ЮMoney возвращает GET-запросом (тогда lax не ломает вход после оплаты) — **проверить в проде**.
- `subscriptions.expires_at` хранится как TEXT и сравнивается строково с ISO (`[SUBAGENT]`, якорь `expires_at > ` в `db.js`) — работает для UTC-формата, но хрупко; при любой будущей миграции — в `timestamptz`.
- `checklists.js`: `step` 1..6, id `s3`=Электрика и `s4`=Сантехника — **[SUBAGENT]**, сверить порядок с UI (`ChecklistsPage`) и с РЕЗЮМЕ (там s3=Электрика, s4=Сантехника — совпадает, но «175» пунктов и «консультации 3/мес» проверить: счётчик консультаций живёт в localStorage → обход чисткой хранилища; серверная проверка есть только через `requireDB` в `/api/consultation` — уточнить, считает ли бэк).
- `admin`-пароль в `sessionStorage` (см. §1.6).

---

## 4. Что невозможно проверить из песочницы → нужно на сервере/локально

1. Боевой конфиг nginx: `sudo nginx -T` (есть ли 443, HSTS, try_files) — см. §2.5.
2. Реальный `.env` на VPS: заданы ли `JWT_SECRET`/`ADMIN_PASSWORD` non-default, `YOOMONEY_SECRET`, `UNISENDER_GO_API_KEY`, `EMAIL_FROM`, `SITE_URL`; версия Node (`node -v`).
3. Настроен ли HTTP-вебхук ЮMoney на кошельке + секрет (без него §1.4 — открытый вход).
4. `npm audit` / `npm outdated` — сети нет.
5. Миграции БД/схема: `initDB()` в `server/db.js` делает `CREATE TABLE IF NOT EXISTS` **без** `ALTER` и без каталога миграций → расхождение схемы боевой БД и ожидаемой не проверить отсюда (якорь `CREATE TABLE IF NOT EXISTS`).
6. Рендер и UX в браузере (мигание пейвола, `loading` перед показом, адаптив 390 px, `<title>Смета — undefined</title>` визуально).

---

## 5. Как я рекомендую расписать это для Claude Code

Три TASK-файла по объёму и риску (каждый — точечные диффы, критерии приёмки, «не трогать»):

**`TASK_payments_auth_hardening.md` (P0, один заход).** §1.1 + §1.2 + §1.3 + §1.4 (+§1.6, если капитан решит не растягивать). Файлы: `server.js`, `server/db.js`. Ключевые приёмки: activate требует владельца; прод не стартует без секретов; код 6 цифр + 3 лимитера + `attempts`; вебхук — обязательная подпись, сверка суммы, идемпотентность по `operation_id`. Риск: задеплоить без §2.5 можно, без этого — нельзя.

**`TASK_calc_input_hardening.md` (P1).** §2.1 + §2.2 + §2.3 + §2.4 (+§2.10 как мелкий бонус). Файлы: `src/lib/calculator.js`, `src/lib/spec-calculator.js`, `src/lib/office-calculator.js`, компоненты ввода детального офисного, `estimateReport.js`, `checklistReport.js`. Приёмки: ни одно «сметочное» число не появляется на area 0/−50/'abc'; `formatRub` не падает; калибровка ВИС воспроизводима при целочисленном S1 в диапазоне ±1%; порядок replan/reserve зафиксирован константой и описан в РЕЗЮМЕ. Для Claude Code обязательно дать loader-рецепт прогона (в §6).

**`TASK_docs_infra_sync.md` (P2 + §2.5/2.6/2.7/2.8).** Перенести боевой nginx в репо, автооткат в deploy.sh, `/api`-404, обрезать `dbError`, переписать README/`.env.example`/раздел тарифов в РЕЗЮМЕ, убрать/подтвердить мёртвый код (`bitrix.js` уже удалён → поправить только тексты), удалить мусорные файлы в `docs/` и `src/pages/`, `engines`, `serve`. Это «приведение карты в соответствие», риск минимальный, но без него следующее ТЗ будет опираться на враньё в README.

**Отдельным продуктовым решением (не TASK):** §1.5 — вынос закрытых расценок за серверный гейт. И §7 `TASK_tariffs.md`-остаток: реальная оплата PRO после §1.4.

---

## 6. Приложение: как я гонял расчётные модули (пригодится Claude Code для self-check)

Проблема: импорты в проекте без расширения (Vite это терпит, `node` — нет) и `node_modules`/сети нет. Рецепт:

```js
// res.mjs — resolver-хук, добавляющий .js к относительным импортам без расширения
export async function resolve(spec, ctx, next) {
  if (spec.startsWith('.') && !/\.(js|jsx|css|json)$/.test(spec)) {
    try { return await next(spec + '.js', ctx); } catch {}
  }
  return next(spec, ctx);
}
```
```js
// reg.mjs — зарегистрировать хук (рядом с res.mjs)
import { register } from 'node:module';
register('./res.mjs', import.meta.url);
```
```bash
node --import ./reg.mjs probe.mjs   # в probe.mjs импорты по абсолютным путям к src/lib/*
```

Примеры прогонов, подтвердившие §2.1–2.2, — в цитатах вывода выше. Все чистые ESM-модули (`calculator.js`, `spec-calculator.js`, `office-calculator.js`, `office-data.js`, `checklists.js`, `tariffs.js`) исполняются так без изменений кода; `.jsx` — нет (нужен Vite, т.е. локально у вас).

**Мой результат:** `/workspace/REVIEW_full_audit_2026-09-17.md` — исходный полный отчёт Искры; этот файл — его переработанная для handoff версия (метод, находки, протоколы проверки, план TASK).
