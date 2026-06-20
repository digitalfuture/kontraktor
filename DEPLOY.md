# Деплой, версии и коммиты

## Версионирование

Используем **SemVer** (major.minor.patch):

- **patch** (0.1.3 → 0.1.4) — багфиксы, мелкие доработки, refactoring
- **minor** (0.1.4 → 0.2.0) — новые фичи, изменения API, новые страницы
- **major** (1.0.0) — breaking changes, смена стека, архитектурные изменения

Версия хранится строго в `package.json`, поле `version`. Поднимается **перед** коммитом.

## Правила коммитов

### Формат сообщения

```
<тип>: краткое описание (до 72 символов)

- деталь 1
- деталь 2
- closes #123
```

### Типы

| Тип | Когда использовать |
|-----|-------------------|
| `feat` | Новая функциональность (страница, API, модуль) |
| `fix` | Исправление бага |
| `refactor` | Переписывание кода без изменения поведения |
| `perf` | Оптимизация |
| `style` | Форматирование, CSS, тема |
| `docs` | Документация |
| `chore` | Сборка, CI, конфиги, деплой |
| `revert` | Откат изменений |

### Примеры

```
feat: email queue with Brevo SMTP, admin campaign UI, rate limiting
refactor: migrate admin pages to unified _admin-layout template
fix: correct Sankey API fetch URL path
chore: bump version 0.1.3 → 0.1.4
docs: add DEPLOY.md with commit and version rules
```

## Что должно быть в коммите

Перед коммитом убедиться, что **все изменения** закоммичены — не только код, но и:
- Новые партиалы (partials/*.ejs)
- Новые роуты (routes/admin/*.ts)
- Новые типы (types/*.ts)
- Locale файлы (locales/*.json)
- Build-артефакты (tailwind.css, main.js, sitemap.html)
- package.json
- pm2.config.cjs.example (но не pm2.config.cjs — он в .gitignore)

**Не коммитить:**
- Базы данных (*.db, *.db-shm, *.db-wal)
- `.env` и `.env.*`
- `credentials/` — OAuth ключи, сервисные аккаунты
- `node_modules/`, `dist/` (кроме locales, views, public — они в .gitignore)
- Скрипты для одноразовых задач
- `tsconfig.tsbuildinfo`

## Процесс деплоя

```bash
# 0. Убедиться что pm2.config.cjs существует (он в .gitignore)
#    cp pm2.config.cjs.example pm2.config.cjs  # первый раз — заполнить секреты

# 1. Поднять версию
npm version patch -m "chore: bump version %s"

# 2. Собрать
npm run build

# 3. Проверить билд
node -e "console.log(require('./package.json').version)"  # должна быть новая
ls dist/index.js 2>/dev/null && echo "✅ dist/index.js exists" || echo "❌ BUILD FAILED"

# 4. Скопировать локали (если менялись)
cp -r src/locales/*.json dist/locales/

# 5. Перезапустить
pm2 restart kontraktor-prod --update-env

# 6. Smoke test — проверить что админка не 500
curl -s -o /dev/null -w "%{http_code}" -b "session_token=$TOKEN" http://localhost:8080/admin

# 7. Закоммитить
git add -A
git commit -m "feat: ..."

# 8. Запушить в GitHub (только если все тесты пройдены)
git push origin main
```

## Проверка версии при билде

Версия **обязательно** должна увеличиваться от коммита к коммиту.
Перед каждым билдом проверь:

```bash
git show HEAD:package.json | grep '"version"'   # старая версия
grep '"version"' package.json                    # новая версия — должна быть больше
```

Если версия не изменилась — **остановись и подними**.

## Когда делать коммит

- Каждый логический блок изменений — отдельный коммит
- Не коммитить «всё подряд» одним коммитом
- Не коммитить сломанный билд
- Если в процессе работы перезагружался сервер — сначала коммит, потом деплой
