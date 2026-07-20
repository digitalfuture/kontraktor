#!/usr/bin/env node
/**
 * Add GAPENSI organization as a single-contact mailing list.
 * Run: node scripts/add-gapensi-org.js
 */
const path = require('path');
const Database = require('better-sqlite3');

const isProd = process.env.NODE_ENV === 'production';
const DB_PATH = isProd
  ? path.join(__dirname, '../data/kontraktor.prod.db')
  : path.join(__dirname, '../data/kontraktor.dev.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

console.log(`🔌 Connected to: ${DB_PATH}\n`);

// Create mailing list for GAPENSI organization only
const listName = 'GAPENSI (Organisasi)';
const listDescription = 'Kontak organisasi GAPENSI — Badan Pengurus Pusat (BPP), untuk pengiriman proposal kerjasama.';

const existingList = db.prepare('SELECT id FROM mailing_lists WHERE name = ? AND deleted_at IS NULL').get(listName);
let listId;
if (existingList) {
  listId = existingList.id;
  // Clear existing contacts and re-add
  db.prepare('UPDATE mailing_list_contacts SET deleted_at = CURRENT_TIMESTAMP WHERE list_id = ?').run(listId);
  console.log(`✅ Reusing existing list: "${listName}" (ID: ${listId})`);
} else {
  const result = db.prepare('INSERT INTO mailing_lists (name, description) VALUES (?, ?)').run(listName, listDescription);
  listId = result.lastInsertRowid;
  console.log(`✅ Created list: "${listName}" (ID: ${listId})`);
}

// Add GAPENSI contact
const email = 'bpp@gapensi.or.id';
const name = 'Badan Pengurus Pusat GAPENSI';
const company = 'GAPENSI — Gabungan Pelaksana Konstruksi Nasional Indonesia';

const dup = db.prepare('SELECT id FROM mailing_list_contacts WHERE list_id = ? AND email = ? AND deleted_at IS NULL').get(listId, email);
if (dup) {
  console.log(`  ⏭️  Already exists: ${email}`);
} else {
  db.prepare('INSERT INTO mailing_list_contacts (list_id, email, name, company, created_at) VALUES (?, ?, ?, ?, datetime(\'now\'))').run(listId, email, name, company);
  console.log(`  ✅ ${email} → ${name}`);
}

console.log(`\n📊 Summary:`);
const total = db.prepare('SELECT COUNT(*) as c FROM mailing_list_contacts WHERE list_id = ? AND deleted_at IS NULL').get(listId);
console.log(`   List: "${listName}" (ID: ${listId})`);
console.log(`   Contacts: ${total.c}`);
console.log(`   Email: ${email}`);

db.close();
console.log('\n✅ Done!');
