# ТЗ: инфраструктура и документы (P2)

**Источник:** `REPORT_iskra_audit_2026-09-17.md`, §2.5, §2.8, §3.1, §3.2.
**Дата:** 2026-09-22.

Три независимые части, делать можно в любом порядке. Сборку и проверку конфига прогнать один раз в конце.

Оговорка про источник данных. Боевой конфиг nginx снят с сервера командой `sudo nginx -T` 22.09.2026, приведён ниже дословно. Файлы `deploy.sh`, `README.md`, `РЕЗЮМЕ-ПРОЕКТА.md` и `.env.example` автором ТЗ не читались, по ним даны grep-якоря и что искать, точные правки делает исполнитель по фактическому содержимому.

---

## Часть 1. Боевой nginx в репозиторий

### Проблема

`nginx/rpkm.conf` в репозитории занимает 424 байта и содержит единственный `listen 80;`. Реальный конфиг живёт только на VPS и в git не попадал. При переезде на новый сервер поднять прод с нуля по репозиторию невозможно.

**Рекомендацию отчёта Искры в этой части надо скорректировать.** Отчёт предлагал добавить `try_files ... /index.html` и отдельный `location /api`. Делать этого нельзя: боевая схема устроена иначе, весь трафик одним `location /` уходит на `127.0.0.1:3001`, а статику и SPA-фолбэк раздаёт сам Express (`app.use(express.static(DIST))` и `app.get('/{*splat}')`). Добавление `try_files` в nginx сломает работающую раздачу.

Что действительно отсутствует в боевом конфиге:

- ни одного security-заголовка;
- `gzip on` включён глобально, но `gzip_types` не задан нигде, поэтому сжимается только `text/html`, а JS и CSS идут без сжатия. Цена вопроса по последней сборке: `index-*.js` 490,70 КБ против 143,04 КБ в gzip, `office-vis-data-*.js` 404,99 КБ против 53,00 КБ. Каждый посетитель качает примерно втрое больше необходимого;
- `server_tokens build` в `/etc/nginx/nginx.conf` отдаёт версию и сборку nginx в заголовке `Server`;
- нет таймаутов на прокси, дефолтные 60 секунд;
- `client_max_body_size 25M` стоит на весь сайт.

### Боевой конфиг на 22.09.2026 (основа для репозитория)

```nginx
server {
    server_name ddrpkm.ru www.ddrpkm.ru;
    client_max_body_size 25M;
    location / {
        proxy_pass http://127.0.0.1:3001;   # РПКМ на 3001 (VidFlex занимает 3000)
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/ddrpkm.ru/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/ddrpkm.ru/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
}

server {
    if ($host = www.ddrpkm.ru) { return 301 https://$host$request_uri; } # managed by Certbot
    if ($host = ddrpkm.ru)     { return 301 https://$host$request_uri; } # managed by Certbot
    listen 80;
    server_name ddrpkm.ru www.ddrpkm.ru;
    return 404; # managed by Certbot
}
```

Блоки для `ddvideoai.ru` в репозиторий не переносить, это чужой проект на том же сервере.

### Что сделать

**1.1.** Заменить содержимое `nginx/rpkm.conf` на конфиг выше плюс правки ниже. В шапке комментарием: дата снятия, что строки `managed by Certbot` трогать руками нельзя, и что на сервере файл лежит в `/etc/nginx/sites-available/`.

**1.2.** В `server`-блок 443 добавить заголовки:

```nginx
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=15768000" always;
```

`always` обязательно, иначе заголовок не попадёт в ответы с кодом ошибки.

HSTS на полгода, без `includeSubDomains` и без `preload`. Редирект с 80 на 443 уже работает, сертификат обновляется автоматически, риск минимален. `preload` не добавляем сознательно, из списка предзагрузки трудно выйти.

**CSP в этом заходе не добавляем.** Сайт тянет шрифты с Google Fonts и использует инлайновые стили React, поэтому осмысленный `Content-Security-Policy` потребует отдельной итерации с проверкой каждой страницы. Городить `unsafe-inline` ради галочки смысла нет.

**1.3.** Сжатие. В `server`-блок 443:

```nginx
    gzip_types text/css application/javascript application/json image/svg+xml text/plain;
    gzip_min_length 1024;
```

`text/html` входит в список всегда. Самая дешёвая и самая заметная правка во всём ТЗ.

**1.4.** Таймауты в `location /`:

```nginx
        proxy_read_timeout 60s;
        proxy_connect_timeout 10s;
        proxy_send_timeout 60s;
```

**1.5.** Сузить лимит тела запроса до `client_max_body_size 1M;` на уровне `server`.

**Перед выполнением проверить.** Фотографии в чек-листах сейчас живут в localStorage и на сервер не отправляются. Найти по `grep -rn "FormData\|multipart\|base64" server.js src/` реальные места загрузки. Если ни один эндпоинт не принимает тела больше мегабайта, отдельный `location` не нужен. Если принимает, завести для него отдельный `location` со своим лимитом 25M и теми же `proxy_set_header`.

**1.6.** `server_tokens off;` поставить в `http`-блок на сервере (`/etc/nginx/nginx.conf`, сейчас там `server_tokens build;`). В репозитории отразить комментарием в шапке `nginx/rpkm.conf`, сам `nginx.conf` не переносим.

### Критерии приёмки (часть 1)

1. `nginx -t` на сервере проходит без ошибок до перезагрузки конфига.
2. `curl -sI https://ddrpkm.ru | grep -iE 'strict-transport|x-frame|x-content-type|referrer'` показывает все четыре заголовка.
3. `curl -sI -H 'Accept-Encoding: gzip' https://ddrpkm.ru/assets/<имя_бандла>.js | grep -i content-encoding` возвращает `gzip`.
4. `curl -sI https://ddrpkm.ru | grep -i '^server:'` не содержит версии nginx.
5. Сайт открывается, вход работает, расчёты открываются. Проверяется руками после `nginx -s reload`.
6. `nginx/rpkm.conf` в репозитории совпадает с боевым файлом по существу, расхождение только в блоках чужого проекта.

---

## Часть 2. Автооткат в `deploy.sh`

### Проблема

По якорям из аудита в скрипте сейчас:

- `pm2 reload rpkm --update-env || pm2 restart rpkm` — приложение перезапускается до проверки здоровья. Если оно падает на старте, получаем crash-loop, а health-check лишь печатает предупреждение и делает `exit 1`, когда откатывать уже поздно;
- `pm2 save` — на общем VPS фиксирует список всех процессов, включая чужой `videoai`;
- `|| true` на `rm -rf node_modules && npm ci` — падение установки молча продолжает деплой на старых зависимостях;
- `read -rp` — интерактивный вопрос, из-за которого скрипт нельзя запустить из cron или CI.

Риск стал выше после P0: fail-fast на секретах означает, что при кривом окружении процесс не поднимется вообще.

### Что сделать

**2.1.** Перед деплоем запомнить текущий коммит на сервере: `OLD=$(git rev-parse HEAD)`.

**2.2.** После `pm2 restart` бить в health десять раз с паузой две секунды:

```bash
for i in $(seq 1 10); do
  sleep 2
  if curl -sf "$HEALTH_URL" > /dev/null; then OK=1; break; fi
done
```

**2.3.** При неуспехе откатывать автоматически и завершаться с ошибкой:

```bash
if [ -z "${OK:-}" ]; then
  echo "Health-check не прошёл, откатываюсь на $OLD"
  git checkout "$OLD" && npm ci && npm run build && pm2 restart rpkm
  exit 1
fi
```

**2.4.** `pm2 save` убрать. Вместо него `pm2 describe rpkm` для диагностики. Причина: сервер общий, `pm2 save` перезаписывает список автозапуска чужому проекту.

**2.5.** `|| true` после `npm ci` убрать. Установка зависимостей упала, значит деплой должен упасть.

**2.6.** Интерактив убрать под флаг: если задана переменная `CI=1`, вопросов не задавать.

**2.7.** Добавить в начало скрипта проверку секретов, ту же, что в `docs/TASK_payments_auth_hardening.md`, часть 3: `JWT_SECRET` и `ADMIN_PASSWORD` присутствуют в `/home/deploy/rpkm/.env`, длина первого не меньше 32, дефолтов из кода нет. Не прошло — выходить до `git pull`.

### Критерии приёмки (часть 2)

1. `bash -n deploy.sh` проходит.
2. `grep -n "pm2 save\|| true" deploy.sh` даёт пусто.
3. Проверка отката делается на заведомо ломающем коммите: временно внести в `server.js` синтаксическую ошибку, запустить деплой, убедиться, что скрипт откатился на прежний коммит, сайт жив, код возврата 1. После проверки ломающий коммит удалить.
4. `CI=1 ./deploy.sh` не задаёт вопросов.

---

## Часть 3. Документы против фактического кода

### Проблема

README и РЕЗЮМЕ описывают продукт, которого нет. Это не косметика: следующая задача будет опираться на устаревшую карту.

### Что сделать

**3.1. Тарифы.** Правда в `src/data/tariffs.js`: `club_monthly` 99 ₽, `club_yearly` 990 ₽, `pro_monthly` 2900 ₽, триал 14 дней трактуется как `club`. В `README.md` и `РЕЗЮМЕ-ПРОЕКТА.md` до сих пор написаны 490 и 4900. Найти по `grep -rn "490\|4900" README.md РЕЗЮМЕ-ПРОЕКТА.md` и привести к фактическим. Сверить заодно с текстом на `/offer`.

**3.2. Фантомные сущности.** Удалить из документов всё, чего нет в коде:

- «Интеграция с CRM (Битрикс24)» и ссылки на `src/lib/bitrix.js` — файла нет, `grep -in bitrix server.js src/` пусто, эндпоинта `/api/lead` нет;
- партнёрские программы и `/b2c-book` — компонентов `PartnerB2BPage.jsx`, `PartnerB2CPage.jsx`, `B2CBookPage.jsx` нет, маршруты ведут на `Navigate to="/" replace`;
- описания записи на замер и обещаний выполнения работ, если остались: продукт позиционируется как калькулятор.

**3.3. Платежи.** После P0 в коде нет ни ЮMoney-контура, ни эндпоинтов `/api/subscription/pay` и `/activate`. В README и РЕЗЮМЕ должно быть написано, что приём платежей отключён и готовится переход на ЮKassa. Юридические тексты в `OfferPage.jsx`, `PrivacyPage.jsx`, `ConsentPage.jsx` в этом ТЗ **не трогать**, они правятся вместе с подключением ЮKassa.

**3.4. Число маршрутов.** Посчитать `<Route` в `src/App.jsx` и поставить фактическое число в оба документа. В README сейчас 28, в РЕЗЮМЕ в разных местах 26 и 27.

**3.5. Объёмы данных.** README обещает «5000+ позиций». Фактические подсчёты по `id` из аудита: finish-Std 534 позиции в 41 группе, vis-Std 1636, vis-Biz 2075, итого около 4279. Пересчитать самостоятельно и поставить настоящие числа. Отсутствие тира «Премиум» в офисных данных оставить как есть, это известный долг.

**3.6. `.env.example`.** Привести в соответствие с тем, что реально читает код. Собрать список командой `grep -on "process\.env\.[A-Z_]*" server.js server/*.js | sort -u` и документировать каждую переменную. Удалить `B24_WEBHOOK`, он мёртв. `YOOMONEY_WALLET` и `YOOMONEY_SECRET` тоже удалить, контура больше нет. **Значения в файл не вписывать, только имена и однострочные пояснения.**

**3.7. `package.json`.** Добавить `"engines": { "node": ">=18" }`: Express 5 требует Node 18 и выше. Проверить `serve` в `dependencies` (в скриптах не используется, если так, удалить) и `serve-static` с `send` в `devDependencies` (если они нужны рантайму, перенести в `dependencies`, иначе `npm ci --omit=dev` на проде сломает сервер). Проверяется командой `grep -n "serve-static\|from 'send'" server.js`.

### Критерии приёмки (часть 3)

1. `grep -rn "490 ₽\|4900\|Битрикс\|bitrix\|b2c-book\|партнёрск" README.md РЕЗЮМЕ-ПРОЕКТА.md` даёт пусто или только исторические упоминания в явно помеченном разделе «что было раньше».
2. Число маршрутов в обоих документах совпадает с `grep -c "<Route" src/App.jsx`.
3. Каждая переменная из `grep -o "process\.env\.[A-Z_]*"` присутствует в `.env.example`, лишних нет.
4. `npm ci --omit=dev && node --check server.js` проходит, сервер стартует.
5. `npx vite build` проходит.

---

## Не трогать во всём ТЗ

- Расчётные модули и данные в `src/data/`.
- Схему БД.
- Юридические тексты в `OfferPage.jsx`, `PrivacyPage.jsx`, `ConsentPage.jsx`.
- Конфигурацию чужого проекта `ddvideoai.ru` на том же сервере.
- Логику приложения: это ТЗ про конфиги и тексты, кода в `src/` и `server/` оно касается только в пункте 3.7.

## Порядок работ

1. Часть 3 (документы), она безопасная и не требует сервера.
2. Часть 2 (`deploy.sh`), с проверкой отката на заведомо ломающем коммите.
3. Часть 1 (nginx), последней, потому что правка боевого конфига единственная, которая может уронить сайт. `nginx -t` до `reload`, всегда.

## Что написать в отчёте

`docs/REPORT_docs_infra_sync.md`: по каждой части что сделано, фактический вывод команд из критериев приёмки, отдельно результат проверки отката и результат замера сжатия до и после.
