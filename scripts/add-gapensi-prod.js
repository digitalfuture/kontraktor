#!/usr/bin/env node
/**
 * Copy GAPENSI template and mailing lists to production.
 * Run: NODE_ENV=production node scripts/add-gapensi-prod.js
 */
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// ── Read from dev, write to prod ──

const devDb = new Database(path.join(__dirname, '../data/kontraktor.dev.db'));
const prodDb = new Database(path.join(__dirname, '../data/kontraktor.prod.db'));

devDb.pragma('journal_mode = WAL');
prodDb.pragma('journal_mode = WAL');

console.log('📋 Copying GAPENSI data from dev → prod\n');

// 1. Copy template
const template = devDb.prepare("SELECT * FROM email_templates WHERE name = 'GAPENSI Partnership Proposal' AND deleted_at IS NULL").get();
if (template) {
  const existing = prodDb.prepare("SELECT id FROM email_templates WHERE name = ? AND deleted_at IS NULL").get(template.name);
  if (existing) {
    prodDb.prepare('UPDATE email_templates SET subject = ?, body_html = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(template.subject, template.body_html, existing.id);
    console.log(`✅ Updated template "${template.name}" (ID: ${existing.id})`);
  } else {
    const r = prodDb.prepare('INSERT INTO email_templates (name, subject, body_html) VALUES (?, ?, ?)').run(template.name, template.subject, template.body_html);
    console.log(`✅ Created template "${template.name}" (ID: ${r.lastInsertRowid})`);
  }
}

// 2. Copy "GAPENSI Construction Contacts" list (48 contacts)
const list48 = devDb.prepare("SELECT * FROM mailing_lists WHERE name = 'GAPENSI Construction Contacts' AND deleted_at IS NULL").get();
if (list48) {
  const existing = prodDb.prepare("SELECT id FROM mailing_lists WHERE name = ? AND deleted_at IS NULL").get(list48.name);
  let listId;
  if (existing) {
    listId = existing.id;
    console.log(`✅ List "${list48.name}" already exists (ID: ${listId})`);
  } else {
    const r = prodDb.prepare('INSERT INTO mailing_lists (name, description) VALUES (?, ?)').run(list48.name, list48.description);
    listId = r.lastInsertRowid;
    console.log(`✅ Created list "${list48.name}" (ID: ${listId})`);
  }
  
  // Copy contacts
  const contacts = devDb.prepare("SELECT * FROM mailing_list_contacts WHERE list_id = ? AND deleted_at IS NULL").all(list48.id);
  let imported = 0, skipped = 0;
  for (const c of contacts) {
    const dup = prodDb.prepare('SELECT id FROM mailing_list_contacts WHERE list_id = ? AND email = ? AND deleted_at IS NULL').get(listId, c.email.toLowerCase().trim());
    if (dup) { skipped++; continue; }
    prodDb.prepare('INSERT INTO mailing_list_contacts (list_id, email, name, company, created_at) VALUES (?, ?, ?, ?, datetime(\'now\'))').run(listId, c.email.toLowerCase().trim(), c.name, c.company);
    imported++;
  }
  console.log(`   Contacts: ${imported} imported, ${skipped} skipped`);
}

// 3. Copy "GAPENSI (Organisasi)" list (1 contact) - should already exist from previous script
const listOrg = devDb.prepare("SELECT * FROM mailing_lists WHERE name = 'GAPENSI (Organisasi)' AND deleted_at IS NULL").get();
if (listOrg) {
  const existing = prodDb.prepare("SELECT id FROM mailing_lists WHERE name = ? AND deleted_at IS NULL").get(listOrg.name);
  if (!existing) {
    const r = prodDb.prepare('INSERT INTO mailing_lists (name, description) VALUES (?, ?)').run(listOrg.name, listOrg.description);
    const listId = r.lastInsertRowid;
    const contact = devDb.prepare("SELECT * FROM mailing_list_contacts WHERE list_id = ? AND deleted_at IS NULL").get(listOrg.id);
    if (contact) {
      prodDb.prepare('INSERT INTO mailing_list_contacts (list_id, email, name, company, created_at) VALUES (?, ?, ?, ?, datetime(\'now\'))').run(listId, contact.email, contact.name, contact.company);
      console.log(`✅ Created list "${listOrg.name}" (ID: ${listId}) with contact`);
    }
  } else {
    console.log(`✅ List "${listOrg.name}" already exists (ID: ${existing.id})`);
  }
}

console.log('\n📊 Prod summary:');
const lists = prodDb.prepare(`
  SELECT ml.id, ml.name, COUNT(mlc.id) as contacts
  FROM mailing_lists ml
  LEFT JOIN mailing_list_contacts mlc ON mlc.list_id = ml.id AND mlc.deleted_at IS NULL
  WHERE ml.deleted_at IS NULL AND ml.name LIKE 'GAPENSI%'
  GROUP BY ml.id
`).all();
for (const l of lists) {
  console.log(`   ID ${l.id}: "${l.name}" — ${l.contacts} contacts`);
}

const tmpl = prodDb.prepare("SELECT id, name FROM email_templates WHERE name = 'GAPENSI Partnership Proposal' AND deleted_at IS NULL").get();
console.log(`   Template: "${tmpl?.name}" (ID: ${tmpl?.id})`);

devDb.close();
prodDb.close();
console.log('\n✅ Done!');
