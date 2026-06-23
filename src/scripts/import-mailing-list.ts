#!/usr/bin/env node
/**
 * Import YellowPages mailing list contacts into the database
 * Run: node dist/scripts/import-mailing-list.js
 */

const fs = require('fs');
const path = require('path');
const betterSqlite3 = require('better-sqlite3');

// Load the mailing list data
const jsonPath = path.join(__dirname, '../../data/mailing-list-yellowpages.json');
const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

// Connect to dev database
const dbDir = path.join(__dirname, '../../data');
const dbFile = 'kontraktor.dev.db';
const db = new betterSqlite3(path.join(dbDir, dbFile));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

console.log('📦 Importing YellowPages mailing list contacts...\n');

// 1. Create or get the mailing list
const listName = 'Yellow Pages Construction Companies';
const listDescription = 'Compiled from YellowPages Indonesia, company websites, and verified directories. Covers general contractors, construction companies, steel structure, civil engineering, interior renovation, MEP, and landscaping across Jakarta, Surabaya, Bandung, Bali, Kediri.';

const existingList = db.prepare('SELECT id FROM mailing_lists WHERE name = ? AND deleted_at IS NULL').get(listName);

let listId;
if (existingList) {
  listId = existingList.id;
  console.log(`✅ Mailing list already exists (ID: ${listId})`);
} else {
  const result = db.prepare('INSERT INTO mailing_lists (name, description) VALUES (?, ?)').run(listName, listDescription);
  listId = result.lastInsertRowid;
  console.log(`✅ Created mailing list: "${listName}" (ID: ${listId})`);
}

// 2. Import contacts
let imported = 0;
let skipped = 0;
let withEmail = 0;

const insertContact = db.prepare(`
  INSERT INTO mailing_list_contacts (list_id, email, name, company, created_at)
  VALUES (?, ?, ?, ?, datetime('now'))
`);

// Check for duplicates by email
const checkDuplicate = db.prepare('SELECT id FROM mailing_list_contacts WHERE list_id = ? AND email = ? AND deleted_at IS NULL');

for (const company of data.companies) {
  if (!company.email || company.email.trim() === '') {
    console.log(`  ⏭️  Skipping (no email): ${company.name}`);
    skipped++;
    continue;
  }

  const duplicate = checkDuplicate.get(listId, company.email);
  if (duplicate) {
    console.log(`  ⏭️  Skipping (duplicate): ${company.email} (${company.name})`);
    skipped++;
    continue;
  }

  try {
    insertContact.run(listId, company.email, company.name || '', company.name || '');
    imported++;
    withEmail++;
    console.log(`  ✅ Imported: ${company.email} (${company.name})`);
  } catch (err: unknown) {
    console.log(`  ❌ Error: ${company.email} - ${err instanceof Error ? err.message : String(err)}`);
  }
}

console.log(`\n📊 Summary:`);
console.log(`   Total companies in source: ${data.companies.length}`);
console.log(`   Imported with email: ${withEmail}`);
console.log(`   Skipped (no email/duplicate): ${skipped}`);
console.log(`   Mailing list ID: ${listId}`);

db.close();
console.log('\n✅ Import complete!');