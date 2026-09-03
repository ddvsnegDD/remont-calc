#!/usr/bin/env bash
# Деплой РПКМ: локальная проверка сборки → push в GitHub → обновление на VPS → health-check.
# Использование:  ./deploy.sh "текст коммита"   (коммит опционален, если всё уже закоммичено)

set -euo pipefail

REMOTE="${REMOTE:-neworigin}"
BRANCH="${BRANCH:-main}"
APP_DIR="/home/deploy/rpkm"
MSG="${1:-}"

cd "$(dirname "$0")"

# Адрес сервера держим вне репозитория: .deploy.env (в .gitignore) или env-переменная SERVER.
if [ -z "${SERVER:-}" ] && [ -f .deploy.env ]; then
  # shellcheck disable=SC1091
  . ./.deploy.env
fi

if [ -z "${SERVER:-}" ]; then
  cat >&2 <<'ERR'
✗ Не задан адрес сервера.
  Создай рядом со скриптом файл .deploy.env со строкой:
      SERVER=user@хост
  либо передай переменную окружения:
      SERVER=user@хост ./deploy.sh "текст коммита"
ERR
  exit 1
fi

# Снимаем залипший lock, если остался от прерванной git-операции
[ -f .git/index.lock ] && rm -f .git/index.lock

echo "→ 1/5 Проверяем сборку локально"
npm run build >/dev/null

if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  if [ -z "$MSG" ]; then
    echo "✗ Есть незакоммиченные изменения. Передай сообщение коммита: ./deploy.sh \"текст\"" >&2
    git status --short --untracked-files=no >&2
    exit 1
  fi
  echo "→ 2/5 Коммитим изменения"
  git add -A -- ':!node_modules'
  git commit -m "$MSG"
else
  echo "→ 2/5 Нечего коммитить, пропускаем"
fi

echo "→ 3/5 Пушим в $REMOTE/$BRANCH"
git push "$REMOTE" "$BRANCH"

echo "→ 4/5 Обновляем приложение на сервере"
# Примечание: npm ci здесь НЕ запускаем — vite лежит в devDependencies,
# а зависимости меняются редко. При изменении package.json выполнить на сервере вручную: npm ci
ssh "$SERVER" "cd $APP_DIR \
  && sudo -u deploy -H git pull \
  && sudo -u deploy -H npm run build \
  && sudo -u deploy -H pm2 restart rpkm \
  && sudo -u deploy -H pm2 save"

echo "→ 5/5 Health-check"
sleep 3
curl -fsS https://ddrpkm.ru/api/health && echo

echo "✓ Деплой завершён"
