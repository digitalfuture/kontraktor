import Database from 'better-sqlite3';
import path from 'path';

const dbDir: string = path.join(__dirname, '../../data');
const dbFile: string = process.env.NODE_ENV === 'production' ? 'kontraktor.prod.db' : 'kontraktor.dev.db';
const DB_PATH: string = process.env.DB_PATH || path.join(dbDir, dbFile);
const db: Database.Database = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// === SCHEMA ===
db.exec(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'client' CHECK(role IN ('admin', 'contractor', 'client')),
  telegram_id TEXT,
  is_verified INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME
);`);

db.exec(`CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);`);

db.exec(`CREATE TABLE IF NOT EXISTS magic_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at DATETIME NOT NULL,
  used INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);`);

db.exec(`CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  icon TEXT,
  name_en TEXT,
  name_id TEXT,
  description_en TEXT,
  description_id TEXT,
  is_active INTEGER DEFAULT 1,
  deleted_at DATETIME DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);`);

db.exec(`CREATE TABLE IF NOT EXISTS subcategories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  price_from TEXT,
  contractors_count INTEGER DEFAULT 0,
  name_en TEXT,
  name_id TEXT,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
  UNIQUE(category_id, slug)
);`);

db.exec(`CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  subcategory TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  address TEXT,
  budget INTEGER,
  client_email TEXT,
  assigned_contractor_id INTEGER,
  reviewed INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (assigned_contractor_id) REFERENCES contractors(id) ON DELETE SET NULL
);`);

db.exec(`CREATE TABLE IF NOT EXISTS contractors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  phone TEXT,
  experience INTEGER,
  bio TEXT,
  avatar_url TEXT,
  category_id INTEGER,
  specialty TEXT,
  rating REAL DEFAULT 0,
  reviews_count INTEGER DEFAULT 0,
  completed_projects INTEGER DEFAULT 0,
  is_verified INTEGER DEFAULT 0,
  is_approved INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  credits INTEGER DEFAULT 3,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);`);

db.exec(`CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contractor_id INTEGER REFERENCES contractors(id),
  project_id INTEGER REFERENCES projects(id),
  author_email TEXT NOT NULL,
  client_email TEXT,
  rating INTEGER NOT NULL,
  comment TEXT,
  is_moderated INTEGER DEFAULT 0,
  is_approved INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);`);

// Photos for projects (before/after) and contractor portfolio
db.exec(`CREATE TABLE IF NOT EXISTS photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contractor_id INTEGER NOT NULL,
  project_id INTEGER,
  filename TEXT NOT NULL,
  original_name TEXT,
  mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
  file_size INTEGER NOT NULL,
  caption TEXT,
  is_portfolio INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (contractor_id) REFERENCES contractors(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);`);

db.exec(`CREATE TABLE IF NOT EXISTS bids (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  contractor_id INTEGER NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  price REAL,
  estimated_days INTEGER,
  description TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'rejected')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, contractor_id)
);`);

db.exec(`CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contractor_id INTEGER NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  external_id TEXT UNIQUE NOT NULL,
  amount REAL NOT NULL,
  credits INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'failed')),
  payment_method TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);`);

db.exec(`CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);`);

// === MIGRATIONS ===
// Each migration runs exactly once, tracked in schema_migrations table.
db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);`);

const migrations: Array<{ version: number; name: string; sql: string }> = [
  {
    version: 1,
    name: 'add_contractor_columns',
    sql: `
      ALTER TABLE contractors ADD COLUMN avatar_url TEXT;
      ALTER TABLE contractors ADD COLUMN phone TEXT;
      ALTER TABLE contractors ADD COLUMN experience INTEGER;
      ALTER TABLE contractors ADD COLUMN bio TEXT;
      ALTER TABLE contractors ADD COLUMN category_id INTEGER REFERENCES categories(id);
      ALTER TABLE contractors ADD COLUMN specialty TEXT;
      ALTER TABLE contractors ADD COLUMN is_approved INTEGER DEFAULT 0;
      ALTER TABLE contractors ADD COLUMN credits INTEGER DEFAULT 3;
    `,
  },
  {
    version: 2,
    name: 'add_project_columns',
    sql: `
      ALTER TABLE projects ADD COLUMN subcategory TEXT;
      ALTER TABLE projects ADD COLUMN client_email TEXT;
      ALTER TABLE projects ADD COLUMN assigned_contractor_id INTEGER REFERENCES contractors(id) ON DELETE SET NULL;
      ALTER TABLE projects ADD COLUMN reviewed INTEGER DEFAULT 0;
    `,
  },
  {
    version: 3,
    name: 'add_review_columns',
    sql: `
      ALTER TABLE reviews ADD COLUMN contractor_id INTEGER REFERENCES contractors(id);
      ALTER TABLE reviews ADD COLUMN is_approved INTEGER DEFAULT 0;
      ALTER TABLE reviews ADD COLUMN project_id INTEGER REFERENCES projects(id);
      ALTER TABLE reviews ADD COLUMN client_email TEXT;
    `,
  },
  {
    version: 4,
    name: 'add_project_district',
    sql: `
      ALTER TABLE projects ADD COLUMN district TEXT;
    `,
  },
  {
    version: 5,
    name: 'add_users_deleted_at',
    sql: `
      ALTER TABLE users ADD COLUMN deleted_at DATETIME;
    `,
  },
  {
    version: 6,
    name: 'add_settings_table',
    sql: `
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `,
  },
];

const getApplied = db.prepare('SELECT version FROM schema_migrations');
const appliedVersions = new Set((getApplied.all() as { version: number }[]).map(r => r.version));
const markApplied = db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)');

for (const migration of migrations) {
  if (appliedVersions.has(migration.version)) continue;

  // Run each statement individually so one failure doesn't block others
  const statements = migration.sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const stmt of statements) {
    try {
      db.exec(stmt);
    } catch (e: any) {
      // Column already exists — safe to ignore
      if (!e.message?.includes('duplicate column name')) {
        console.warn(`[migration v${migration.version}] Warning: ${e.message}`);
      }
    }
  }

  markApplied.run(migration.version, migration.name);
  console.log(`✅ Migration v${migration.version} applied: ${migration.name}`);
}


// === SEED: Admin User ===
const adminExists = db.prepare('SELECT id FROM users WHERE email = ?').get('pulauberapi@gmail.com');
if (!adminExists) {
  db.prepare('INSERT INTO users (email, name, role, is_verified) VALUES (?, ?, ?, ?)').run(
    'pulauberapi@gmail.com', 'Admin', 'admin', 1
  );
  console.log('✅ Admin user created');
}

// === SEED: Categories with EN/ID translations ===
function seedCategories(): void {
  const count = db.prepare('SELECT COUNT(*) as c FROM categories').get() as { c: number };
  if (count.c > 0) return;

  const categories = [
    { name: 'Ремонт квартир', slug: 'remont-kvartir', description: 'Косметический, капитальный, дизайнерский ремонт', icon: '', name_en: 'Apartment Renovation', name_id: 'Renovasi Apartemen', description_en: 'Cosmetic, major, and designer renovation', description_id: 'Renovasi kosmetik, besar, dan desainer' },
    { name: 'Электромонтаж', slug: 'elektromontazh', description: 'Проводка, розетки, освещение, щитки', icon: '', name_en: 'Electrical Work', name_id: 'Pekerjaan Listrik', description_en: 'Wiring, outlets, lighting, panels', description_id: 'Kabel, stopkontak, penerangan, panel' },
    { name: 'Сантехника', slug: 'santehnika', description: 'Установка, замена, ремонт сантехники', icon: '🔧', name_en: 'Plumbing', name_id: 'Plumbing', description_en: 'Installation, replacement, repair', description_id: 'Pemasangan, penggantian, perbaikan' },
    { name: 'Отделка', slug: 'otdelka', description: 'Обои, покраска, плитка, потолки', icon: '🎨', name_en: 'Finishing', name_id: 'Finishing', description_en: 'Wallpaper, painting, tiles, ceilings', description_id: 'Wallpaper, pengecatan, ubin, plafon' },
    { name: 'Строительство', slug: 'stroitelstvo', description: 'Дома, бани, пристройки', icon: '', name_en: 'Construction', name_id: 'Konstruksi', description_en: 'Houses, saunas, extensions', description_id: 'Rumah, sauna, ekstensi' },
    { name: 'Кровля', slug: 'krovlya', description: 'Монтаж, ремонт, утепление кровли', icon: '', name_en: 'Roofing', name_id: 'Atap', description_en: 'Installation, repair, insulation', description_id: 'Pemasangan, perbaikan, insulasi' },
    { name: 'Фасад', slug: 'fasad', description: 'Штукатурка, сайдинг, утепление', icon: '', name_en: 'Facade', name_id: 'Fasad', description_en: 'Plastering, siding, insulation', description_id: 'Plester, siding, insulasi' },
    { name: 'Ландшафт', slug: 'landshaft', description: 'Заборы, дорожки, озеленение', icon: '', name_en: 'Landscaping', name_id: 'Pertamanan', description_en: 'Fences, paths, gardening', description_id: 'Pagar, jalan, pertamanan' },
    { name: 'Демонтаж', slug: 'demontazh', description: 'Снос, демонтаж, вывоз мусора', icon: '', name_en: 'Demolition', name_id: 'Pembongkaran', description_en: 'Demolition, removal, waste disposal', description_id: 'Pembongkaran, penghapusan, pembuangan sampah' },
  ];

  const insertCat = db.prepare('INSERT INTO categories (name, slug, description, icon, name_en, name_id, description_en, description_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const insertSub = db.prepare('INSERT INTO subcategories (category_id, name, slug, price_from, contractors_count, name_en, name_id) VALUES (?, ?, ?, ?, ?, ?, ?)');

  const subcategories: Record<string, Array<{ name: string; slug: string; price_from: string; count: number; name_en: string; name_id: string }>> = {
    'remont-kvartir': [
      { name: 'Косметический ремонт', slug: 'cosmetic', price_from: '150K Rp/m²', count: 1200, name_en: 'Cosmetic Renovation', name_id: 'Renovasi Kosmetik' },
      { name: 'Капитальный ремонт', slug: 'capital', price_from: '300K Rp/m²', count: 800, name_en: 'Major Renovation', name_id: 'Renovasi Besar' },
      { name: 'Ремонт под ключ', slug: 'turnkey', price_from: '500K Rp/m²', count: 600, name_en: 'Turnkey Renovation', name_id: 'Renovasi Turnkey' },
      { name: 'Дизайнерский ремонт', slug: 'design', price_from: '800K Rp/m²', count: 300, name_en: 'Designer Renovation', name_id: 'Renovasi Desainer' },
    ],
    'elektromontazh': [
      { name: 'Замена проводки', slug: 'wiring', price_from: '50K Rp/point', count: 400, name_en: 'Wiring Replacement', name_id: 'Penggantian Kabel' },
      { name: 'Установка розеток', slug: 'sockets', price_from: '30K Rp/pcs', count: 600, name_en: 'Outlet Installation', name_id: 'Pemasangan Stopkontak' },
      { name: 'Монтаж освещения', slug: 'lighting', price_from: '80K Rp/point', count: 500, name_en: 'Lighting Installation', name_id: 'Pemasangan Penerangan' },
      { name: 'Электрощиты', slug: 'panels', price_from: '300K Rp', count: 200, name_en: 'Electrical Panels', name_id: 'Panel Listrik' },
    ],
    'santehnika': [
      { name: 'Установка сантехники', slug: 'install', price_from: '100K Rp', count: 500, name_en: 'Fixture Installation', name_id: 'Pemasangan Perlengkapan' },
      { name: 'Замена труб', slug: 'pipes', price_from: '50K Rp/m', count: 400, name_en: 'Pipe Replacement', name_id: 'Penggantian Pipa' },
      { name: 'Ремонт труб', slug: 'repair', price_from: '80K Rp', count: 350, name_en: 'Pipe Repair', name_id: 'Perbaikan Pipa' },
      { name: 'Установка водонагревателя', slug: 'water-heater', price_from: '200K Rp', count: 200, name_en: 'Water Heater Installation', name_id: 'Pemasangan Pemanas Air' },
    ],
    'otdelka': [
      { name: 'Поклейка обоев', slug: 'wallpaper', price_from: '15K Rp/m²', count: 600, name_en: 'Wallpaper Hanging', name_id: 'Pemasangan Wallpaper' },
      { name: 'Покраска стен', slug: 'painting', price_from: '10K Rp/m²', count: 500, name_en: 'Wall Painting', name_id: 'Pengecatan Dinding' },
      { name: 'Укладка плитки', slug: 'tiles', price_from: '80K Rp/m²', count: 800, name_en: 'Tile Laying', name_id: 'Pemasangan Ubin' },
      { name: 'Натяжные потолки', slug: 'ceilings', price_from: '50K Rp/m²', count: 400, name_en: 'Stretch Ceilings', name_id: 'Plafon Stretch' },
    ],
    'stroitelstvo': [
      { name: 'Каркасные дома', slug: 'frame', price_from: '1,500K Rp/m²', count: 200, name_en: 'Frame Houses', name_id: 'Rumah Bingkai' },
      { name: 'Кирпичные дома', slug: 'brick', price_from: '2,500K Rp/m²', count: 150, name_en: 'Brick Houses', name_id: 'Rumah Bata' },
      { name: 'Дома из блоков', slug: 'blocks', price_from: '2,000K Rp/m²', count: 250, name_en: 'Block Houses', name_id: 'Rumah Blok' },
      { name: 'Бани и сауны', slug: 'saunas', price_from: '1,200K Rp/m²', count: 180, name_en: 'Baths & Saunas', name_id: 'Mandi & Sauna' },
    ],
    'krovlya': [
      { name: 'Монтаж кровли', slug: 'install', price_from: '200K Rp/m²', count: 300, name_en: 'Roof Installation', name_id: 'Pemasangan Atap' },
      { name: 'Ремонт кровли', slug: 'repair', price_from: '100K Rp/m²', count: 200, name_en: 'Roof Repair', name_id: 'Perbaikan Atap' },
      { name: 'Утепление', slug: 'insulation', price_from: '50K Rp/m²', count: 150, name_en: 'Insulation', name_id: 'Insulasi' },
      { name: 'Водосточные системы', slug: 'drainage', price_from: '80K Rp/m', count: 100, name_en: 'Drainage Systems', name_id: 'Sistem Drainase' },
    ],
    'fasad': [
      { name: 'Штукатурка фасада', slug: 'plaster', price_from: '100K Rp/m²', count: 200, name_en: 'Facade Plastering', name_id: 'Plester Fasad' },
      { name: 'Сайдинг', slug: 'siding', price_from: '150K Rp/m²', count: 150, name_en: 'Siding', name_id: 'Siding' },
      { name: 'Утепление', slug: 'insulation', price_from: '120K Rp/m²', count: 180, name_en: 'Insulation', name_id: 'Insulasi' },
      { name: 'Облицовка камнем', slug: 'stone', price_from: '250K Rp/m²', count: 100, name_en: 'Stone Cladding', name_id: 'Cladding Batu' },
    ],
    'landshaft': [
      { name: 'Установка заборов', slug: 'fences', price_from: '120K Rp/m', count: 150, name_en: 'Fence Installation', name_id: 'Pemasangan Pagar' },
      { name: 'Мощение дорожек', slug: 'paths', price_from: '80K Rp/m²', count: 120, name_en: 'Path Paving', name_id: 'Pengerasan Jalan' },
      { name: 'Озеленение', slug: 'greening', price_from: '50K Rp/m²', count: 80, name_en: 'Gardening', name_id: 'Pertamanan' },
      { name: 'Дренажные системы', slug: 'drainage', price_from: '100K Rp/m', count: 60, name_en: 'Drainage Systems', name_id: 'Sistem Drainase' },
    ],
    'demontazh': [
      { name: 'Демонтаж стен', slug: 'walls', price_from: '50K Rp/m²', count: 200, name_en: 'Wall Demolition', name_id: 'Pembongkaran Dinding' },
      { name: 'Демонтаж пола', slug: 'floor', price_from: '30K Rp/m²', count: 150, name_en: 'Floor Demolition', name_id: 'Pembongkaran Lantai' },
      { name: 'Вывоз мусора', slug: 'disposal', price_from: '300K Rp/load', count: 300, name_en: 'Waste Removal', name_id: 'Pembuangan Sampah' },
      { name: 'Снос зданий', slug: 'buildings', price_from: 'from 5M Rp', count: 50, name_en: 'Building Demolition', name_id: 'Pembongkaran Bangunan' },
    ],
  };

  for (const cat of categories) {
    const result = insertCat.run(cat.name, cat.slug, cat.description, cat.icon, cat.name_en, cat.name_id, cat.description_en, cat.description_id);
    const catId = result.lastInsertRowid as number;
    const subs = subcategories[cat.slug] || [];
    for (const sub of subs) {
      insertSub.run(catId, sub.name, sub.slug, sub.price_from, 0, sub.name_en, sub.name_id);
    }
  }
  console.log('✅ Categories seeded');
}
seedCategories();

// === SEED: Mock Data (dev only) ===
function seedMockData(): void {
  return; // Disabled: we want the database to start completely clean.
  if (process.env.NODE_ENV === 'production' && process.env.SEED_MOCK_DATA !== '1') return;
  
  const projectCount = db.prepare('SELECT COUNT(*) as c FROM projects').get() as { c: number };
  if (projectCount.c > 0) return;

  console.log('Seeding mock data...');

  const projects = [
    { title: 'Bathroom Renovation', description: 'Full bathroom renovation 4m²', category: 'remont-kvartir', contact_name: 'John Doe', contact_phone: '+62812****4567', status: 'pending' },
    { title: 'Wiring Replacement', description: '2-room apartment', category: 'elektromontazh', contact_name: 'Jane Smith', contact_phone: '+62812****5678', status: 'active' },
    { title: 'Stretch Ceiling', description: 'Living room 20m², matte white', category: 'otdelka', contact_name: 'Alex Brown', contact_phone: '+62812****6789', status: 'completed' },
    { title: 'Sauna Construction', description: 'Sauna 6x4m from timber', category: 'stroitelstvo', contact_name: 'David Wilson', contact_phone: '+62812****7890', status: 'pending' },
    { title: 'Paving Stones', description: 'Yard 50m²', category: 'landshaft', contact_name: 'Sarah Lee', contact_phone: '+62812****8901', status: 'active' },
    { title: 'Roof Installation', description: 'Metal tiles 120m²', category: 'krovlya', contact_name: 'Mike Johnson', contact_phone: '+62812****9012', status: 'completed' },
  ];

  const insertProject = db.prepare('INSERT INTO projects (title, description, category, contact_name, contact_phone, status) VALUES (?, ?, ?, ?, ?, ?)');
  for (const p of projects) insertProject.run(p.title, p.description, p.category, p.contact_name, p.contact_phone, p.status);

  const contractors = [
    { email: 'budi.master@mail.com', name: 'Budi Santoso', rating: 4.8, reviews_count: 124, completed_projects: 89, is_verified: 1, is_active: 1 },
    { email: 'anto.bangun@gmail.com', name: 'Anto Pratama', rating: 4.5, reviews_count: 67, completed_projects: 45, is_verified: 1, is_active: 1 },
    { email: 'siti.renovasi@yahoo.com', name: 'Siti Rahayu', rating: 4.9, reviews_count: 203, completed_projects: 156, is_verified: 1, is_active: 1 },
    { email: 'dedi.listrik@mail.com', name: 'Dedi Kurniawan', rating: 4.2, reviews_count: 34, completed_projects: 28, is_verified: 0, is_active: 1 },
    { email: 'rina.desain@gmail.com', name: 'Rina Wulandari', rating: 4.7, reviews_count: 89, completed_projects: 67, is_verified: 1, is_active: 1 },
  ];

  const insertContractor = db.prepare('INSERT INTO contractors (email, name, rating, reviews_count, completed_projects, is_verified, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)');
  for (const c of contractors) insertContractor.run(c.email, c.name, c.rating, c.reviews_count, c.completed_projects, c.is_verified, c.is_active);

  const reviews = [
    { author_email: 'client1@mail.com', rating: 5, comment: 'Excellent work! Everything on time.', is_moderated: 1 },
    { author_email: 'client2@mail.com', rating: 4, comment: 'Good contractor, slightly delayed.', is_moderated: 1 },
    { author_email: 'client3@mail.com', rating: 5, comment: 'Highly recommend! True professional.', is_moderated: 0 },
    { author_email: 'client4@mail.com', rating: 3, comment: 'Acceptable.', is_moderated: 0 },
    { author_email: 'client5@mail.com', rating: 5, comment: 'Exceeded expectations!', is_moderated: 1 },
  ];

  const insertReview = db.prepare('INSERT INTO reviews (author_email, rating, comment, is_moderated) VALUES (?, ?, ?, ?)');
  for (const r of reviews) insertReview.run(r.author_email, r.rating, r.comment, r.is_moderated);

  console.log('✅ Mock data seeded');
}
seedMockData();

export default db;
