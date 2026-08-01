// @ts-check
/**
 * HTMX Lint — проверяет что все формы используют HTMX и
 * POST-роуты не делают res.redirect без hx-request fallback.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

let hasErrors = false;

const warn = (file, msg) => {
  const rel = path.relative(rootDir, file);
  console.error(`  ⚠ ${rel}: ${msg}`);
  hasErrors = true;
};

// ── 1. EJS: форма с method="POST" без hx-* атрибута ──
function checkEjsFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      checkEjsFiles(full);
    } else if (entry.name.endsWith('.ejs')) {
      checkEjsFile(full);
    }
  }
}

function checkEjsFile(file) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  // Пропускаем партиалы CSRF/хедер и edit-mode (там только JS-селекторы)
  const skipFiles = ['csrf-field.ejs', '_head.ejs', '_anti-flash.ejs', '_edit-mode.ejs'];
  if (skipFiles.some(s => file.endsWith(s))) return;

  // Ищем формы — собираем мультилайн <form ... > тэг целиком
  const methodRe = /method="(POST|PUT|DELETE|PATCH)"/i;
  const hxRe = /\bhx-(post|put|delete|patch|trigger)\b/i;

  let inScript = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/<script/.test(line)) inScript = true;
    if (/<\/script/.test(line)) { inScript = false; continue; }
    if (inScript) continue;

    // Начало формы
    if (/<form\b/.test(line)) {
      // Собираем до 8 строк (учитываем EJS %>, которые содержат >)
      let formTag = line;
      const maxLines = 8;
      for (let k = 1; k < maxLines && i + k < lines.length; k++) {
        formTag += ' ' + lines[i + k].trim();
      }

      const hasMethod = methodRe.test(formTag);
      const hasHx = hxRe.test(formTag);

      if (hasMethod && !hasHx) {
        const startLine = i + 1;
        warn(file, `Line ${startLine}: form with method but no hx- attribute\n         ${lines[i].trim().substring(0, 120)}`);
      }
    }
  }
}

// ── 2. TS: POST-роут с res.redirect без hx-request ──
function checkTsFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      checkTsFiles(full);
    } else if (entry.name.endsWith('.ts')) {
      checkTsFile(full);
    }
  }
}

function checkTsFile(file) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  // Ищем POST-роуты
  const postRoute = /\.(post|put|delete|patch)\(/i;
  const redirect = /res\.redirect\(/;
  const hxCheck = /hx-request|hxRedirect|hx_refresh/i;

  let inPostHandler = false;
  let postLine = 0;
  let redirectCount = 0;
  let hasHxCheck = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Отслеживаем вход/выход из роута
    if (postRoute.test(line)) {
      // Если были в роуте — проверяем
      if (inPostHandler && redirectCount > 0 && !hasHxCheck) {
        warn(file, `Line ${postLine}: POST route with ${redirectCount} res.redirect but no hx-request check`);
      }
      inPostHandler = true;
      postLine = i + 1;
      redirectCount = 0;
      hasHxCheck = false;
    }

    if (inPostHandler) {
      if (redirect.test(line)) redirectCount++;
      if (hxCheck.test(line)) hasHxCheck = true;
      // Выходим из обработчика на следующем router.post/export/function/})
      if (/^\};?$/.test(line) || /^}\)?;?\s*$/.test(line) || /^export\s/.test(line) || /^function\s/.test(line)) {
        if (!postRoute.test(line)) {
          if (redirectCount > 0 && !hasHxCheck) {
            warn(file, `Line ${postLine}: POST route with ${redirectCount} res.redirect but no hx-request check`);
          }
          inPostHandler = false;
        }
      }
    }
  }
}

// ── Run ──
const viewsDir = path.resolve(rootDir, 'src/views');
const routesDir = path.resolve(rootDir, 'src/routes');

console.log('\n🔍 HTMX Lint — checking forms and routes...');
console.log('──────────────────────────────────────────────');

checkEjsFiles(viewsDir);
checkTsFiles(routesDir);

if (hasErrors) {
  console.log('\n❌ HTMX lint found issues.\n');
  process.exit(1);
} else {
  console.log('✅ All forms have HTMX attributes and routes handle hx-request.\n');
}
