#!/usr/bin/env node
/**
 * Import Yellow Pages construction companies into Kontraktor mailing list
 * Usage: node import-yellow-pages.mjs <csv-file> [list-name]
 * 
 * CSV format expected: email,company,phone,address,city,category,website
 * Only email is required. Other fields are optional.
 */

import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'kontraktor.prod.db');
const CSV_FILE = process.argv[2];
const LIST_NAME = process.argv[3] || 'Yellow Pages — Construction';

if (!CSV_FILE) {
  console.error('Usage: node import-yellow-pages.mjs <csv-file> [list-name]');
  process.exit(1);
}

const db = new Database(DB_PATH);

try {
  // Read and parse CSV
  const csvContent = readFileSync(CSV_FILE, 'utf-8');
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  console.log(`Parsed ${records.length} records from ${CSV_FILE}`);

  // Filter for construction-related categories
  const constructionKeywords = [
    'construction', 'contractor', 'builder', 'building', 'renovation',
    'remodel', 'repair', 'maintenance', 'civil', 'structural',
    'electrical', 'plumbing', 'hvac', 'roofing', 'flooring',
    'painting', 'carpentry', 'masonry', 'excavation', 'demolition',
    'architecture', 'engineering', 'surveying', 'inspection',
    'landscaping', 'paving', 'concrete', 'steel', 'welding',
    'insulation', 'waterproofing', 'drywall', 'tile', 'cabinet',
    'window', 'door', 'glass', 'metal', 'wood', 'fabrication',
    'prefab', 'modular', 'industrial', 'commercial', 'residential',
    'инженер', 'строитель', 'подрядчик', 'ремонт', 'ремонтник',
    'благоустройство', 'проектирование', 'архитектор', 'геодезия',
    'электрика', 'сантехника', 'крыша', 'потолок', 'пол',
    'покраска', 'пленка', 'окна', 'двери', 'стекло', 'металл',
    'дерево', 'бетон', 'арматура', 'кровля', 'фасад', 'утепление',
    'гидроизоляция', 'штукатурка', 'обои', 'плитка', 'ламинат'
  ];

  const filtered = records.filter(r => {
    const category = (r.category || r.Category || '').toLowerCase();
    const company = (r.company || r.Company || r.name || r.Name || '').toLowerCase();
    const text = `${category} ${company}`;
    return constructionKeywords.some(kw => text.includes(kw));
  });

  console.log(`Filtered to ${filtered.length} construction-related companies`);

  if (filtered.length === 0) {
    console.log('No construction companies found. Importing all...');
    filtered.push(...records);
  }

  // Create or get mailing list
  let list = db.prepare('SELECT * FROM mailing_lists WHERE name = ?').get(LIST_NAME);
  if (!list) {
    const result = db.prepare('INSERT INTO mailing_lists (name, description) VALUES (?, ?)').run(
      LIST_NAME,
      `Imported from Yellow Pages CSV on ${new Date().toISOString().split('T')[0]}`
    );
    list = { id: result.lastInsertRowid, name: LIST_NAME };
    console.log(`Created new mailing list: ${LIST_NAME} (ID: ${list.id})`);
  } else {
    console.log(`Using existing mailing list: ${LIST_NAME} (ID: ${list.id})`);
  }

  // Import contacts
  let imported = 0;
  let skipped = 0;
  const stmt = db.prepare('INSERT OR IGNORE INTO mailing_list_contacts (list_id, email, name, company, notes) VALUES (?, ?, ?, ?, ?)');

  for (const r of filtered) {
    const email = r.email || r.Email || r['e-mail'] || r.EMAIL;
    if (!email || !email.includes('@')) {
      skipped++;
      continue;
    }

    const company = r.company || r.Company || r.name || r.Name || '';
    const name = r.name || r.Name || r.contact_name || r['Contact Name'] || '';
    const phone = r.phone || r.Phone || r.telephone || r.Telephone || '';
    const address = r.address || r.Address || r.street || r.Street || '';
    const city = r.city || r.City || r.location || r.Location || '';
    const website = r.website || r.Website || r.url || r.URL || '';
    const category = r.category || r.Category || '';
    const notes = JSON.stringify({
      phone,
      address,
      city,
      website,
      category,
      source: 'yellow-pages-import',
      imported_at: new Date().toISOString()
    });

    try {
      stmt.run(list.id, email.trim().toLowerCase(), name, company, notes);
      imported++;
    } catch (e) {
      skipped++;
    }
  }

  console.log(`\nImport complete:`);
  console.log(`  Imported: ${imported}`);
  console.log(`  Skipped (duplicates/invalid): ${skipped}`);
  console.log(`  Total in list: ${db.prepare('SELECT COUNT(*) as c FROM mailing_list_contacts WHERE list_id = ?').get(list.id).c}`);

} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
} finally {
  db.close();
}