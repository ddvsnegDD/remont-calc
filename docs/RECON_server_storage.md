# Разведка: перенос пользовательских данных из браузера на сервер

Только факты, код не менялся. Собрано 25.09.2026.

---

## 1. Схема БД (`server/db.js`, `initDB()`, строки 11–55)

Три таблицы, создаются через `CREATE TABLE IF NOT EXISTS` + отдельные
`ALTER TABLE ADD COLUMN IF NOT EXISTS` для части колонок. Индексов, кроме
неявных от `PRIMARY KEY`/`UNIQUE`, в `initDB()` нет.

### `users` (строки 15–28)

| колонка | тип | ограничения |
|---|---|---|
| `id` | SERIAL | PRIMARY KEY |
| `email` | VARCHAR(255) | UNIQUE NOT NULL |
| `name` | VARCHAR(255) | — |
| `phone` | VARCHAR(50) | — |
| `role` | VARCHAR(20) | DEFAULT 'b2c' |
| `organization` | VARCHAR(255) | — |
| `position` | VARCHAR(255) | — |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() |

Строки 26–28 повторяют `role`/`organization`/`position` через
`ALTER TABLE ... ADD COLUMN IF NOT EXISTS` — дублируют то, что уже есть в
`CREATE TABLE` выше (миграция для БД, созданных до появления этих колонок).

### `auth_codes` (строки 29–37)

| колонка | тип | ограничения |
|---|---|---|
| `id` | SERIAL | PRIMARY KEY |
| `email` | VARCHAR(255) | NOT NULL |
| `code` | VARCHAR(6) | NOT NULL |
| `expires_at` | TIMESTAMPTZ | NOT NULL |
| `used` | BOOLEAN | DEFAULT FALSE |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() |
| `attempts` | INTEGER | DEFAULT 0 — только через ALTER (строка 37), в исходном CREATE TABLE этой колонки нет |

Внешних ключей нет: `email` — обычный VARCHAR, не FK на `users.email`.

### `subscriptions` (строки 38–49)

| колонка | тип | ограничения |
|---|---|---|
| `id` | SERIAL | PRIMARY KEY |
| `user_id` | INTEGER | `REFERENCES users(id)` — без `ON DELETE`, то есть по умолчанию `NO ACTION` |
| `plan` | VARCHAR(50) | NOT NULL DEFAULT 'monthly' |
| `status` | VARCHAR(50) | NOT NULL DEFAULT 'trial' |
| `started_at` | TIMESTAMPTZ | DEFAULT NOW() |
| `expires_at` | TIMESTAMPTZ | NOT NULL |
| `payment_label` | VARCHAR(255) | — |
| `payment_id` | VARCHAR(255) | — |
| `amount` | INTEGER | — |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() |

`plan` не ограничен списком значений на уровне схемы (просто VARCHAR(50)).

Раз `subscriptions.user_id` без `ON DELETE CASCADE`, `deleteUser()`
(`server/db.js`, строки 187–192) удаляет строки вручную в три запроса перед
удалением пользователя: сначала `DELETE FROM subscriptions WHERE user_id = $1`,
затем `DELETE FROM auth_codes WHERE email = (SELECT email FROM users WHERE id = $1)`,
затем `DELETE FROM users WHERE id = $1`.

---

## 2. Авторизация и маршруты (`server.js`)

**Middleware:**

- `authMiddleware` (строки 73–82) — читает токен из `req.cookies?.rpkm_token`
  либо из заголовка `Authorization: Bearer …`, разбирает через
  `jwt.verify(token, JWT_SECRET)`, кладёт payload в `req.user` (поля `id` и
  `email` — см. `signToken`, строки 69–71: `jwt.sign({ id: user.id, email: user.email }, ...)`).
  При отсутствии/невалидности токена — `401`.
- Большинство обработчиков дальше сами вызывают
  `findUserByEmail(req.user.email)` (например строка 154, 182, 197, 215, 334),
  а не используют `req.user.id` напрямую.
- `adminAuth` (строки 259–268) — отдельный токен `req.cookies?.rpkm_admin_token`,
  проверяет `payload?.adm === true`, применяется только к `/api/admin/*`.
- `requireDB` (строки 63–66) — пропускает дальше только если `dbReady === true`.

**Лимит тела запроса:** `app.use(express.json())` (строка 37) и
`app.use(express.urlencoded({ extended: true }))` (строка 38) — без опции
`limit`. Явного оверрайда лимита нигде в `server.js` не найдено, действует
дефолт `body-parser`/Express — `100kb`.

**Все `/api`-маршруты, по одному на строку:**

- `GET /api/health` (86) — без авторизации.
- `POST /api/auth/send-code` (103) — `requireDB`.
- `POST /api/auth/verify` (124) — `requireDB`.
- `GET /api/auth/me` (152) — `authMiddleware`.
- `POST /api/auth/logout` (171) — без авторизации.
- `GET /api/subscription/status` (180) — `authMiddleware`.
- `POST /api/subscription/trial` (195) — `authMiddleware`.
- `POST /api/subscription/cancel` (213) — `authMiddleware`.
- `POST /api/admin/login` (232) — без авторизации (проверяет пароль в теле запроса).
- `POST /api/admin/logout` (252) — без авторизации.
- `GET /api/admin/stats` (273) — `requireDB`, `adminAuth`.
- `GET /api/admin/users` (283) — `requireDB`, `adminAuth`.
- `DELETE /api/admin/users/:id` (294) — `requireDB`, `adminAuth`.
- `POST /api/admin/users/:id/subscription` (306) — `requireDB`, `adminAuth`.
- `DELETE /api/admin/users/:id/subscription` (320) — `requireDB`, `adminAuth`.
- `POST /api/consultation` (332) — `authMiddleware`.
- `POST /api/calculation` (447) — без авторизации.
- `POST /api/contact` (482) — без авторизации.
- `GET /{*splat}` (540) — без авторизации, SPA-фолбэк (отдаёт `index.html`).

`POST /api/calculation` (строки 447–478) принимает `{email, name, kind, result}`,
валидирует и отправляет письмо через `sendRawEmail` — в БД ничего не пишет
(в схеме из раздела 1 нет таблицы под расчёты).

---

## 3. `localStorage`/`sessionStorage` в `src/`

### `sessionStorage`

| ключ | пишет | читает | форма данных |
|---|---|---|---|
| `rpkm-last-b2c` | `B2CQuizPage.jsx:102` | `B2CResultPage.jsx:16`, `B2CDetailPage.jsx:40,231` | `{ id, timestamp, kind:'b2c', result, answers, contact:{name, email} }` (`B2CQuizPage.jsx:96–101`) |
| `rpkm-last-b2c-detail` | `B2CDetailPage.jsx:174` | `B2CDetailPage.jsx:24`, `B2CResultDetailPage.jsx:22` | `{ id, timestamp, kind:'b2c-detail', inputs, result, contact:{name, phone, email} }` (`B2CDetailPage.jsx:167–173`) — единственный из B2C-лидов, где в `contact` есть `phone` |
| `rpkm-b2b-current` | `B2BQuizPage.jsx:143`, `B2BCabinetPage.jsx:162` | `B2BResultPage.jsx:25` | `{ id, timestamp, projectName, answers, result }` (`B2BQuizPage.jsx:130–136`) |
| `rpkm-b2b-office-current` | `B2BOfficePage.jsx:124` | `B2BOfficeResultPage.jsx:26` | `{ id, timestamp, kind:'office', projectName, inputs, result }` (`B2BOfficePage.jsx:111–117`) |
| `rpkm-contact-sent` | `HomePage.jsx:472` | `HomePage.jsx:455` | строка — таймстамп `Date.now()`, антиспам-пауза формы обратной связи |

`B2BCabinetPage.jsx:162` пишет в `rpkm-b2b-current` при клике «Открыть →» и на
офисный расчёт (`c.kind === 'office'`, строка 145), и на обычный, а
`link` для офисного расчёта при этом — `/b2b-office-result` (строка 151),
которая читает `rpkm-b2b-office-current` (`B2BOfficeResultPage.jsx:26`), не
`rpkm-b2b-current`.

### `localStorage`

| ключ | пишет | читает | форма данных |
|---|---|---|---|
| `rpkm-b2b-calcs` | `B2BQuizPage.jsx:141`, `B2BOfficePage.jsx:122`, `B2BCabinetPage.jsx:58` | `B2BCabinetPage.jsx:44` | JSON-массив, накапливающий оба вида расчётов (`B2BQuizPage.jsx:130–136` и `B2BOfficePage.jsx:111–117` вперемешку); ключ не содержит id пользователя нигде из трёх файлов |
| `rpkm_checklist_${userId}_${checklistId}` | `ChecklistDetailPage.jsx:24` (`saveState`) | `ChecklistDetailPage.jsx:17` (`loadState`), `ChecklistsPage.jsx:18,52` | `{ items: { "<gIdx>_<iIdx>": { checked: bool, photos: string[], comment: string } }, meta: { address, room, date, comments, result } }` — форма функций `getStorageKey`/`loadState` продублирована один в один в `ChecklistsPage.jsx:12–14` и `ChecklistDetailPage.jsx:12–14` |
| `rpkm_consult_${userId}_${год}_${месяц}` | `ClubPage.jsx:88` | `ClubPage.jsx:67` | строка — число использованных консультаций за месяц |

`ChecklistDetailPage.jsx:23–25` (`saveState`) вызывает `localStorage.setItem`
без `try/catch`.

---

## 4. Чек-листы подробно

**Состояние одного чек-листа** (см. также таблицу выше) — объект с двумя
полями:

- `items`: словарь по ключу `"<индекс группы>_<индекс пункта>"`
  (`itemKey`, `ChecklistDetailPage.jsx:289`), значение —
  `{ checked: boolean, photos: string[], comment: string }`.
- `meta`: `{ address, room, date, comments, result }`, `result` — одно из
  `'accepted' | 'with_remarks' | 'rejected'` (`ChecklistDetailPage.jsx:414–417`).

**Фото** (`ChecklistDetailPage.jsx:27–47`, функция `compressImage`):

- источник — `<input type="file" accept="image/*" capture="environment" multiple>`
  (строка 142).
- каждый файл читается через `FileReader.readAsDataURL`, рисуется в
  `<canvas>`, масштабируется так, чтобы ширина не превышала 800px
  (`maxW = 800`, строки 35–39), кодируется обратно в
  `canvas.toDataURL('image/jpeg', 0.7)` (строка 41) — JPEG, качество 0.7.
- результат — base64 data URL (`data:image/jpeg;base64,...`), хранится прямо
  в массиве `photos` внутри объекта состояния чек-листа в `localStorage`.
- явного лимита на количество фото на пункт или на суммарный размер в коде
  не найдено: `addPhoto` (`ChecklistDetailPage.jsx:252–257`) всегда делает
  `photos: [...(items[key].photos || []), dataUrl]`, без проверки длины
  массива или размера `dataUrl`.

**PDF-акт** (`src/lib/checklistReport.js`):

- `generateReportHTML` (строки 21–247) собирает `allPhotos` (строки 32–43)
  напрямую из переданного `state.items[key].photos` — то есть из уже
  загруженного из `localStorage` объекта состояния, без обращения к серверу.
- каждое фото подставляется как `<img src="...">` в HTML
  (проверка на строке 95: `typeof p.photo === 'string' && p.photo.startsWith('data:image/')`).
- `openReportWindow` (строки 250–258) открывает `window.open('', '_blank')`
  и пишет туда готовый HTML через `w.document.write(html)` — печать/сохранение
  в PDF делает сам браузер (`window.print()` в сгенерированном HTML, не
  проверялось построчно за пределами `checklistReport.js`), запросов к
  серверу в `openReportWindow` нет.

---

## 5. `B2BOfficeDetailPage.jsx` и детальная смета B2C

**`B2BOfficeDetailPage.jsx`** — `grep -n "localStorage\|sessionStorage\|fetch("
src/pages/B2BOfficeDetailPage.jsx` ничего не находит. Единственное
кеширование в файле — модульная переменная `dataCache` (строки 13–14),
живёт в памяти вкладки, не персистентная; используется, чтобы не
перезапрашивать `import('../data/office-finish-data...')` повторно.

**Детальная смета B2C** (`B2CDetailPage.jsx`) — сохраняет в `sessionStorage`
под ключом `rpkm-last-b2c-detail` при сабмите формы (строки 167–174, см.
раздел 3); дальше это же самое читает страница результата
(`B2CResultDetailPage.jsx:22`) и сама форма — для повторного заполнения при
следующем визите (`B2CDetailPage.jsx:24`, эффект сида).

---

## 6. Библиотеки для загрузки файлов (`package.json`)

`dependencies`: `cookie-parser`, `express`, `jsonwebtoken`, `lucide-react`,
`nodemailer`, `pg`, `react`, `react-dom`, `react-router-dom`, `resend`,
`serve`. `devDependencies`: `@vitejs/plugin-react`, `vite`.

`multer`, `busboy`, `formidable`, `express-fileupload` — нет ни в
`dependencies`, ни в `devDependencies`. Сервер не принимает `multipart/form-data`
(только `express.json()`/`express.urlencoded()`, раздел 2) — файлов на сервер
никакой код сейчас не отправляет.

---

## 7. Лимит «3 расчёта/мес» для профи

Текст встречается в четырёх местах, все — статичная строка в JSX, без
привязки к какому-либо счётчику:

- `B2BCabinetPage.jsx:96` — `'3 расчёта/мес · базовый PDF'`.
- `B2BProfilePage.jsx:61` — тернарник `subscription?.status === 'active' ? 'Полный доступ' : '3 расчёта/мес · базовый PDF'`.
- `B2BProfilePage.jsx:122` — аналогичный тернарник, `'3 расчёта в месяц'`.
- `HomePage.jsx:381` — `"Безлимитные расчёты"` в описании PRO-кабинета (обратная формулировка того же лимита).

`grep -n "subscription\|hasPro\|hasAccess\|limit" src/pages/B2BQuizPage.jsx
src/pages/B2BOfficePage.jsx` — в `B2BQuizPage.jsx` нет ни одного совпадения:
файл не импортирует `useAuth` вообще, `finish()` (строки 127–143) ничего не
проверяет перед записью в `rpkm-b2b-calcs`. В `B2BOfficePage.jsx` есть
`hasPro` (строка 19) и гейт `if (!hasPro)` (строка 147) — но это проверка
доступа к странице целиком (офисный калькулятор — только для PRO), не
счётчик расчётов за месяц.

`POST /api/consultation` (`server.js:332–356`) — проверяет только
`getActiveSubscription(user.id)` (строка 337: наличие любой активной
подписки), количество использований нигде не запрашивает и не пишет.

Счётчик, который сопоставим по смыслу — `rpkm_consult_${userId}_${год}_${месяц}`
в `localStorage` (раздел 3) — существует только для консультаций в «Клубе
владельцев» (`ClubPage.jsx`), не для B2B-расчётов, и это отдельный
механизм от текста «3 расчёта/мес».

---

## 8. Что ещё хранится только в браузере

**`logout()` не трогает `localStorage`/`sessionStorage`.** Полный текст
функции (`src/lib/auth.jsx:81–85`):

```js
const logout = useCallback(async () => {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  setUser(null);
  setSubscription(null);
}, []);
```

Ни один из ключей `sessionStorage`/`localStorage` из разделов 3–4 здесь не
очищается. `trialUsed` (состояние в том же `auth.jsx`) тоже не сбрасывается
при логауте.

**`rpkm-b2b-calcs` не содержит id пользователя** (раздел 3) — один общий
ключ `localStorage` для всех, кто пользовался B2B-квизом или офисным
калькулятором с этого браузера. При входе другого пользователя на том же
устройстве `B2BCabinetPage.jsx:44` подставит в список тот же самый массив,
независимо от того, кто сейчас залогинен — `useEffect` на строках 40–47,
загружающий `calcs`, не зависит от `user.id`.

Ключи `sessionStorage` (`rpkm-last-b2c`, `rpkm-last-b2c-detail`,
`rpkm-b2b-current`, `rpkm-b2b-office-current`) живут до закрытия вкладки —
раз логаут их не чистит, второй пользователь, зашедший в той же вкладке,
при открытии `/b2c-result`, `/b2c-result-detail`, `/b2b-result` или
`/b2b-office-result` увидит расчёт предыдущего пользователя, если сам ещё
не считал ничего нового в этой вкладке (эффекты на чтение — `useEffect`
без зависимости от `user`, например `B2CResultPage.jsx:14–19`,
`B2BResultPage.jsx:22–33`).

**`consultationsLeft` в `ClubPage.jsx`** — счётчик (раздел 3, 7) читается
из `localStorage` при монтировании (строки 65–69) и инкрементируется на
клиенте (строка 88) сразу после ответа сервера; сервер (раздел 2,
`POST /api/consultation`) значение не возвращает и не хранит — счётчик
существует только в браузере того устройства/профиля браузера, где велись
записи.
