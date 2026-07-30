#!/usr/bin/env node
/**
 * Validate that all locale keys referenced in .ejs templates
 * exist in both en.json and id.json locale files.
 *
 * Usage: node scripts/validate-locale-keys.mjs
 * Exit code: 0 = all OK, 1 = missing keys found
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = join(__dirname, '..', 'src');
const localesDir = join(srcDir, 'locales');
const viewsDir = join(srcDir, 'views');

// ── 1. Extract all t('...') calls from EJS template tags ──
// Only match t() calls INSIDE <% %> / <%= %> / <%- %> tags, not in JS strings or HTML
const ejsBlockPattern = /<%[=-]?([\s\S]*?)%>/g;
const tKeyPattern = /(?<![a-zA-Z])t\(\s*'([^']+)'\s*\)/g;

function extractKeysFromFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const keys = [];
  // First extract all EJS blocks
  let blockMatch;
  while ((blockMatch = ejsBlockPattern.exec(content)) !== null) {
    const ejsCode = blockMatch[1];
    // Then find t() calls within each block
    let tMatch;
    while ((tMatch = tKeyPattern.exec(ejsCode)) !== null) {
      keys.push(tMatch[1]);
    }
  }
  return keys;
}

function walkDir(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(walkDir(fullPath));
    } else if (entry.name.endsWith('.ejs')) {
      files.push(fullPath);
    }
  }
  return files;
}

const allKeys = new Map(); // key → [files...]
for (const file of walkDir(viewsDir)) {
  const keys = extractKeysFromFile(file);
  for (const key of keys) {
    if (!allKeys.has(key)) allKeys.set(key, []);
    allKeys.get(key).push(file.replace(srcDir, 'src'));
  }
}

// ── 2. Load locale files ──
function loadLocale(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

function keyExists(obj, keyPath) {
  const parts = keyPath.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return false;
    }
    current = current[part];
  }
  return current !== undefined;
}

const en = loadLocale(join(localesDir, 'en.json'));
const id = loadLocale(join(localesDir, 'id.json'));

// ── 3. Report missing keys ──
let exitCode = 0;
for (const [key, files] of allKeys) {
  const inEn = keyExists(en, key);
  const inId = keyExists(id, key);
  const missing = [];
  if (!inEn) missing.push('en');
  if (!inId) missing.push('id');
  if (missing.length > 0) {
    exitCode = 1;
    console.log(`❌ \x1b[31m${key}\x1b[0m — missing in: ${missing.join(', ')}`);
    for (const file of files) {
      console.log(`     ${file}`);
    }
  }
}

if (exitCode === 0) {
  console.log(`✅ All ${allKeys.size} locale keys present in both en.json and id.json`);
} else {
  console.log(`\nFound missing locale keys. Add them to the locale JSON files.`);
}
process.exit(exitCode);
