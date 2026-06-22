# Деплой, версии и коммиты

## Версионирование

Используем **SemVer** (major.minor.patch):

- **patch** (0.1.3 → 0.1.4) — багфиксы, мелкие доработки, refactoring
- **minor** (0.1.4 → 0.2.0) — новые фичи, изменения API, новые страницы
- **major** (1.0.0) — breaking changes, смена стека, архитектурные изменения

Версия хранится строго в `package.json`, поле `version`.

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

---

## Процесс деплоя

```bash
# ─── Шаг 1: Собрать ──────────────────────────────────────────

npm run build

# Проверить билд
ls dist/index.js 2>/dev/null && echo "✅ BUILD OK" || echo "❌ BUILD FAILED"
cp -r src/locales/*.json dist/locales/

# ─── Шаг 2: Деплой ─────────────────────────────────────────────

pm2 restart kontraktor-prod --update-env

# ─── Шаг 3: Тестирование всех страниц ──────────────────────────

# Открыть в браузере все admin-страницы и убедиться что нет
# 500-х ошибок, пустых страниц или падения JS
#
# Список страниц:
#   /admin
#   /admin/email
#   /admin/email/lists
#   /admin/email/lists/<id>
#   /admin/email/settings
#   /admin/contractors
#   /admin/projects
#   /admin/trash
#   /admin/analytics
#
# Проверить что скрипты и стили грузятся (нет 404 на main.js, tailwind.css)
# Проверить HTMX-секции: в админке все hx-get/hx-post запросы отвечают

# ─── Шаг 4: Коммит изменений ───────────────────────────────────

# 4.1. Убедиться что build-артефакты в актуальном состоянии
npm run build
cp -r src/locales/*.json dist/locales/

# 4.2. Закоммитить ВСЕ изменения (без поднятия версии)
git add -A
git commit -m "feat: ... (или fix, refactor)"

# ─── Шаг 5: Отдельный коммит — версия + пуш ────────────────────

npm version patch -m "chore: bump version %s"
git push origin main
```

---

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
