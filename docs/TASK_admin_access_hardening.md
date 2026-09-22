# ТЗ: доступ в админку (P0-остаток)

**Источник:** `REPORT_iskra_audit_2026-09-17.md`, §1.6. Плюс однотипная утечка из §2.7, оставшаяся в админских роутах.
**Дата:** 2026-09-22.

Строки даны по состоянию на 22.09.2026. Перед правкой искать по grep-якорям, не по номерам.

---

## Проблема

Вход в админку сделан на статическом пароле, который путешествует в заголовке каждого запроса и лежит в браузере открытым текстом.

**Якорь `x-admin-token`, `server.js`:**

```js
function adminAuth(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (token !== ADMIN_PASSWORD) return res.status(403).json({ ok: false, error: 'Доступ запрещён' });
  next();
}
```

**Якорь `sessionStorage.setItem('rpkm_admin'`, `src/pages/AdminPage.jsx`:**

```js
const [token, setToken] = useState(() => sessionStorage.getItem('rpkm_admin') || '');
const headers = { 'x-admin-token': token };
...
sessionStorage.setItem('rpkm_admin', password);
```

Из этого следует пять отдельных дефектов.

1. **Пароль и есть токен.** Один и тот же секрет вводится человеком, хранится в браузере и уходит в каждом запросе. Утёк из любого места (расширение браузера, чужой компьютер, скриншот) и действует бессрочно.
2. **Ни срока, ни отзыва.** Сессия живёт, пока открыта вкладка, но сам пароль не протухает никогда. Сменить его можно только правкой `.env` и перезапуском процесса.
3. **Сравнение не constant-time.** `token !== ADMIN_PASSWORD` сравнивает строки посимвольно с ранним выходом. Практическая эксплуатация тайминга через интернет маловероятна, но на фоне остальных пунктов чинится одной строкой.
4. **Лимитера нет ни на одном админском роуте.** Якоря `app.get('/api/admin/stats'`, `app.get('/api/admin/users'`, `app.delete('/api/admin/users/:id'`, `app.post('/api/admin/users/:id/subscription'`, `app.delete('/api/admin/users/:id/subscription'`. Пароль перебирается с любой скоростью, а `/api/admin/users` отдаёт email и телефоны всех пользователей.
5. **Утечка текста ошибки.** Во всех пяти роутах `catch` отвечает `res.status(500).json({ ok: false, error: err.message })`. Это тот же дефект, что был в `/api/health` (§2.7), там его уже закрыли.

**Чего fail-fast из §1.2 не закрывает.** Проверка на старте гарантирует лишь то, что `ADMIN_PASSWORD` не равен дефолту `rpkm-admin-2026` и не пуст. Она ничего не говорит о его длине, о сроке жизни и о том, сколько раз его можно подобрать. Пункт §1.2 закрыт, §1.6 остаётся открытым.

---

## Что сделать

Идея правки: пароль превращается из постоянного пропуска в разовый ключ, которым обменивают на короткоживущую сессию. Браузер после входа не хранит пароль вообще.

### 1. `server.js`: эндпоинт входа в админку

Добавить перед блоком `// ==================== ADMIN API ====================` константу и роут:

```js
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
```

`crypto` и `jwt` уже импортированы в начале файла, новых зависимостей не нужно.

Сравнение длины перед `timingSafeEqual` обязательно: функция бросает исключение на буферах разной длины. Сама длина при этом утекает, но это несопоставимо с утечкой пароля.

### 2. `server.js`: переписать `adminAuth`

```js
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
```

Заголовок `x-admin-token` перестаёт поддерживаться полностью. Обратную совместимость не оставляем: пока старый путь жив, он и есть дыра.

Разделение кодов важно для фронта: **401** значит «войди заново», **403** значит «пароль неверный».

### 3. `server.js`: убрать утечку в пяти админских роутах

В каждом `catch` заменить

```js
res.status(500).json({ ok: false, error: err.message });
```

на

```js
console.error('admin error:', err.message);
res.status(500).json({ ok: false, error: 'Ошибка сервера' });
```

Ровно как это сделано в `/api/health`.

### 4. `src/pages/AdminPage.jsx`

- Убрать хранение пароля: якоря `sessionStorage.getItem('rpkm_admin')`, `sessionStorage.setItem('rpkm_admin', password)`, `sessionStorage.removeItem('rpkm_admin')` — все три места. В браузере не остаётся ничего.
- Вместо состояния `token` завести `authed` (булево). Начальное значение `false`.
- `handleLogin` (якорь `const handleLogin = (e) =>`) делает `POST /api/admin/login` с `credentials: 'include'` и телом `{ password }`. При `ok` — `setAuthed(true)`, очистить поле пароля. При 403 — «Неверный пароль». При 429 — показать текст из ответа.
- Все существующие `fetch('/api/admin/...')`: убрать `headers: { 'x-admin-token': ... }`, добавить `credentials: 'include'`. Там, где тело JSON, заголовок `Content-Type: application/json` оставить.
- Обработку `res.status === 403` (якорь `if (statsRes.status === 403`) заменить на проверку `401 || 403` → `setAuthed(false)` и сообщение «Сессия истекла, войдите заново».
- Кнопка выхода (якорь `sessionStorage.removeItem('rpkm_admin')` в обработчике) — дёргает `POST /api/admin/logout` и ставит `setAuthed(false)`.
- Чтобы восстановление сессии после перезагрузки вкладки работало, при монтировании делать один пробный `GET /api/admin/stats`: 200 значит кука жива и можно показывать данные, 401 значит показать форму входа.

---

## Не трогать

- `ADMIN_PASSWORD` как переменную окружения и fail-fast на неё из части 3 P0. Пароль остаётся, меняется только его роль.
- Пользовательскую авторизацию: `authMiddleware`, кука `rpkm_token`, `/api/auth/*`. Это отдельный контур.
- Логику `grantSubscription`, `cancelSubscription`, `deleteUser`, `getAllUsers`, `getAdminStats` в `server/db.js`. Правим только транспорт и доступ.
- Вёрстку и таблицы `AdminPage.jsx` вне перечисленных мест.
- Схему БД. Миграций в этом ТЗ нет.

---

## Критерии приёмки

1. `grep -rn "x-admin-token\|rpkm_admin" server.js src/` даёт пусто.
2. `curl -s -o /dev/null -w '%{http_code}' https://ddrpkm.ru/api/admin/users` без куки возвращает **401**.
3. `POST /api/admin/login` с неверным паролем возвращает **403**, с верным — **200** и ставит куку `rpkm_admin_token` с флагами `HttpOnly` и `Secure`.
4. Одиннадцатая подряд попытка входа с одного IP за 5 минут возвращает **429**.
5. После успешного входа страница `/admin` показывает статистику и список пользователей, выдача и отзыв подписки работают, удаление пользователя работает.
6. Кнопка выхода гасит сессию: следующий запрос к `/api/admin/stats` возвращает 401.
7. Ошибка внутри админского роута отдаёт `{"ok":false,"error":"Ошибка сервера"}` без текста исключения, подробность видна только в логе PM2.
8. Проверка срока: декодировать полезную нагрузку куки и показать разницу `exp − iat` в секундах, ожидается `7200`.

---

## Порядок работ и самопроверка

1. Серверная часть (пп. 1–3), `node --check server.js`.
2. Фронт (п. 4), `npx vite build`.
3. Локальный прогон: `npm run dev:server` плюс `npm run dev`, пройти вход в `/admin`, выдать и отозвать подписку тестовому пользователю в локальной БД.
4. Деплой только по явной команде владельца.

**Риск, который надо назвать до деплоя.** Админка сейчас единственный способ выдать подписку вручную, а оплаты нет. Если правка сломает вход, выдавать доступ будет нечем, пока не откатишь. Поэтому после деплоя первым делом проверяется вход в `/admin`, и при неудаче откат делается сразу, не разбираясь на боевом: `git revert` коммита, пересборка, `pm2 restart rpkm`.

## Что написать в отчёте

`docs/REPORT_admin_access_hardening.md`: что изменено по файлам и функциям, результат каждого критерия приёмки с фактическим выводом команд, отдельным разделом то, что проверить не удалось и почему.
