const Database = require('better-sqlite3');
const db = new Database('/root/kontraktor/data/kontraktor.dev.db');
const cat = { name: 'Кровля', slug: 'krovlya', description: 'Монтаж, ремонт, утепление кровли', icon: '', name_en: 'Roofing', name_id: 'Atap', description_en: 'Installation, repair, insulation', description_id: 'Pemasangan, perbaikan, insulasi' };
const subcategories = [
  { name: 'Монтаж кровли', slug: 'install', price_from: '200K Rp/m²', count: 300, name_en: 'Roof Installation', name_id: 'Pemasangan Atap' },
  { name: 'Ремонт кровли', slug: 'repair', price_from: '100K Rp/m²', count: 200, name_en: 'Roof Repair', name_id: 'Perbaikan Atap' },
  { name: 'Утепление', slug: 'insulation', price_from: '50K Rp/m²', count: 150, name_en: 'Insulation', name_id: 'Insulasi' },
  { name: 'Водосточные системы', slug: 'drainage', price_from: '80K Rp/m', count: 100, name_en: 'Drainage Systems', name_id: 'Sistem Drainase' },
];
try {
  const insertCat = db.prepare('INSERT INTO categories (name, slug, description, icon, name_en, name_id, description_en, description_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const insertSub = db.prepare('INSERT INTO subcategories (category_id, name, slug, price_from, specialists_count, name_en, name_id) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const result = insertCat.run(cat.name, cat.slug, cat.description, cat.icon, cat.name_en, cat.name_id, cat.description_en, cat.description_id);
  const catId = result.lastInsertRowid;
  for (const sub of subcategories) {
    insertSub.run(catId, sub.name, sub.slug, sub.price_from, 0, sub.name_en, sub.name_id);
  }
  console.log('Restored category: krovlya');
} catch (e) { console.error(e); }
