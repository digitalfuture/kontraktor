#!/usr/bin/env node
// ── lint-hardcode.mjs ──
// Catches hardcoded user-facing strings in EJS templates that are not
// wrapped in t() / i18n calls. Runs as part of dev:build.
//
// What it flags:
//   1. Plain text nodes (outside EJS tags and HTML tags) containing letters
//   2. title/placeholder/alt/aria-label/data-confirm attributes whose value
//      is a multi-word literal without a t() expression
//
// Deliberately skipped: <script>/<style> bodies (JS strings handled by
// code review), single-word attribute values (brand words, icon labels),
// numbers/punctuation-only text, EJS expressions themselves.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const viewsDir = path.resolve(__dirname, '../src/views');

// Known-legitimate literals (brand, technical, layout markers) — keep small.
const ALLOW = ['Kontraktor', 'Rp', 'IDR', 'PK', '—', '.', ','];

function getEjsFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getEjsFiles(filePath));
    } else if (file.endsWith('.ejs')) {
      results.push(filePath);
    }
  }
  return results;
}

const hasLetter = (s) => /[A-Za-zА-Яа-яЁё]/.test(s);

// Technical/structural text that is not a user-facing string:
const isTechnical = (s) =>
  // material icon names / snake_case identifiers
  /^[a-z_][a-z0-9_]*$/.test(s) ||
  // HTML entities (&middot;, &laquo;, …)
  /^&[a-zA-Z]+;$/.test(s) ||
  // uppercase acronyms (WAL, IDR, PK)
  (/^[A-ZА-ЯЁ]{1,6}$/.test(s) && !s.includes(' ')) ||
  // versions / numbers (v1.0.3, 2026, 99+)
  /[0-9]/.test(s) ||
  // dash-wrapped technical tokens (-photo-, -slug-)
  /^-[a-z]+-$/.test(s) ||
  // code / attribute fragments
  /['"()=%<>/]/.test(s);

const looksLikeLiteral = (s) => {
  const words = s.split(/\s+/).map((w) => w.replace(/[.,!?;:'")\]]+$/, ''));
  return hasLetter(s) && s.length >= 3 && !isTechnical(s) && !words.every((w) => ALLOW.includes(w));
};

function stripEjsComments(content) {
  return content.replace(/<%#[\s\S]*?%>/g, '');
}

function stripHtmlComments(content) {
  return content.replace(/<!--[\s\S]*?-->/g, '');
}

function stripScriptStyle(content) {
  return content.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ');
}

function checkTextNodes(content) {
  const issues = [];
  // Capture text between '>' and '<' that is not inside an EJS tag.
  const re = />([^<>]*?)</g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const raw = m[1];
    if (!raw || !raw.includes('<%')) {
      const text = raw.trim();
      if (text && looksLikeLiteral(text)) {
        issues.push({ text: text.slice(0, 90), kind: 'text' });
      }
    }
  }
  return issues;
}

function checkAttributes(content) {
  const issues = [];
  const attrRe = /\s(title|placeholder|alt|aria-label|data-confirm|data-tooltip|label)="([^"]*)"/g;
  let m;
  while ((m = attrRe.exec(content)) !== null) {
    const val = m[2].trim();
    if (!val || val.includes('<%') || val.includes('/') || val.includes('#')) continue;
    // multi-word literal without t()
    if (val.includes(' ') && looksLikeLiteral(val) && !val.includes('t(')) {
      issues.push({ text: `${m[1]}="${val.slice(0, 90)}"`, kind: 'attr' });
    }
  }
  return issues;
}

const files = getEjsFiles(viewsDir);
let hasErrors = false;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  content = stripEjsComments(content);
  content = stripHtmlComments(content);
  content = stripScriptStyle(content);

  const issues = [...checkTextNodes(content), ...checkAttributes(content)];
  if (issues.length) {
    const rel = path.relative(path.resolve(__dirname, '..'), file);
    for (const i of issues) {
      console.error(`[HARDCODE] ${rel}: ${i.text}`);
      hasErrors = true;
    }
  }
}

if (hasErrors) {
  console.error('\n❌ Hardcoded strings found — wrap them in t() or add to ALLOW in scripts/lint-hardcode.mjs');
  process.exit(1);
} else {
  console.log(`✅ No hardcoded user-facing strings in ${files.length} template files.`);
}
