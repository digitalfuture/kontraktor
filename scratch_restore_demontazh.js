const Database = require('better-sqlite3');
const db = new Database('/root/kontraktor/data/kontraktor.dev.db');
const cat = { name: 'Демонтаж', slug: 'demontazh', description: 'Снос, демонтаж, вывоз мусора', icon: '', name_en: 'Demolition', name_id: 'Pembongkaran', description_en: 'Demolition, removal, waste disposal', description_id: 'Pembongkaran, penghapusan, pembuangan sampah' };
const subcategories = [
  { name: 'Демонтаж стен', slug: 'walls', price_from: '50K Rp/m²', count: 200, name_en: 'Wall Demolition', name_id: 'Pembongkaran Dinding' },
  { name: 'Демонтаж пола', slug: 'floor', price_from: '30K Rp/m²', count: 150, name_en: 'Floor Demolition', name_id: 'Pembongkaran Lantai' },
  { name: 'Вывоз мусора', slug: 'disposal', price_from: '300K Rp/load', count: 300, name_en: 'Waste Removal', name_id: 'Pembuangan Sampah' },
  { name: 'Снос зданий', slug: 'buildings', price_from: 'from 5M Rp', count: 50, name_en: 'Building Demolition', name_id: 'Pembongkaran Bangunan' },
];
try {
  const insertCat = db.prepare('INSERT INTO categories (name, slug, description, icon, name_en, name_id, description_en, description_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const insertSub = db.prepare('INSERT INTO subcategories (category_id, name, slug, price_from, specialists_count, name_en, name_id) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const result = insertCat.run(cat.name, cat.slug, cat.description, cat.icon, cat.name_en, cat.name_id, cat.description_en, cat.description_id);
  const catId = result.lastInsertRowid;
  for (const sub of subcategories) {
    insertSub.run(catId, sub.name, sub.slug, sub.price_from, 0, sub.name_en, sub.name_id);
  }
  console.log('Restored category: demontazh');
} catch (e) { console.error(e); }
