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
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME
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
  {
    version: 7,
    name: 'add_paid_mode_setting',
    sql: `
      INSERT OR IGNORE INTO settings (key, value) VALUES ('paid_mode', 'false');
    `,
  },
  {
    version: 8,
    name: 'add_contractor_services',
    sql: `
      CREATE TABLE IF NOT EXISTS contractor_services (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contractor_id INTEGER NOT NULL,
        category_id INTEGER NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (contractor_id) REFERENCES contractors(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
        UNIQUE(contractor_id, category_id)
      );
      INSERT OR IGNORE INTO contractor_services (contractor_id, category_id, is_active)
        SELECT id, category_id, 1 FROM contractors WHERE category_id IS NOT NULL;
    `,
  },
  {
    version: 9,
    name: 'add_users_is_active',
    sql: `
      ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1;
    `,
  },
  {
    version: 10,
    name: 'add_email_tables',
    sql: `
      CREATE TABLE IF NOT EXISTS email_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        subject TEXT NOT NULL,
        body_html TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS email_campaigns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        template_id INTEGER REFERENCES email_templates(id) ON DELETE SET NULL,
        subject TEXT NOT NULL,
        body_html TEXT NOT NULL,
        recipient_filter TEXT NOT NULL DEFAULT 'all' CHECK(recipient_filter IN ('all', 'contractors', 'clients', 'all_contractors')),
        status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'sending', 'sent', 'stopped')),
        total_recipients INTEGER DEFAULT 0,
        sent_count INTEGER DEFAULT 0,
        failed_count INTEGER DEFAULT 0,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        started_at DATETIME,
        completed_at DATETIME
      );

      CREATE TABLE IF NOT EXISTS email_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id INTEGER REFERENCES email_campaigns(id) ON DELETE CASCADE,
        recipient_email TEXT NOT NULL,
        recipient_name TEXT,
        subject TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'failed')),
        error TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        sent_at DATETIME
      );
    `,
  },
  {
    version: 11,
    name: 'add_email_queue',
    sql: `
      CREATE TABLE IF NOT EXISTS email_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        to_email TEXT NOT NULL,
        subject TEXT NOT NULL,
        html TEXT NOT NULL,
        priority INTEGER DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued', 'processing', 'sent', 'failed')),
        campaign_id INTEGER REFERENCES email_campaigns(id) ON DELETE SET NULL,
        recipient_name TEXT,
        error TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        processed_at DATETIME,
        attempts INTEGER DEFAULT 0
      );
    `,
  },
  {
    version: 12,
    name: 'add_email_queue_retry_at',
    sql: `
      ALTER TABLE email_queue ADD COLUMN retry_at DATETIME;
    `,
  },
  {
    version: 13,
    name: 'add_email_settings_and_system_templates',
    sql: `
      CREATE TABLE IF NOT EXISTS email_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      INSERT OR IGNORE INTO email_settings (key, value) VALUES ('daily_quota', '300');
      INSERT OR IGNORE INTO email_settings (key, value) VALUES ('from_name', 'Kontraktor');
      INSERT OR IGNORE INTO email_settings (key, value) VALUES ('from_email', 'noreply@kontraktor.app');
      INSERT OR IGNORE INTO email_settings (key, value) VALUES ('admin_bcc', 'pulauberapi@gmail.com');
      INSERT OR IGNORE INTO email_settings (key, value) VALUES ('brevo_api_key', '');
      INSERT OR IGNORE INTO email_settings (key, value) VALUES ('rate_limit_per_minute', '10');

      ALTER TABLE email_templates ADD COLUMN system_key TEXT;
      ALTER TABLE email_templates ADD COLUMN description TEXT;
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
    { name: 'General Contractor', slug: 'general-contractor', description: 'Full-project construction management, design-build, turnkey', icon: '🏗️' },
    { name: 'Construction Company', slug: 'construction-company', description: 'Licensed construction companies for commercial & industrial projects', icon: '🏢' },
    { name: 'Civil Engineering', slug: 'civil-engineering', description: 'Roads, bridges, drainage, earthworks, infrastructure', icon: '🛣️' },
    { name: 'Steel Structure', slug: 'steel-structure', description: 'Structural steel, precast, metal fabrication, industrial structures', icon: '🏭' },
    { name: 'Apartment Renovation', slug: 'apartment-renovation', description: 'Professional apartment renovation services in Indonesia — cosmetic updates, major structural renovations, and full designer refurbishments. Get free quotes from verified contractors.', icon: '' },
    { name: 'Interior Renovation', slug: 'interior-renovation', description: 'Office, retail, hotel, commercial interior fit-out', icon: '🏪' },
    { name: 'Electrical Work', slug: 'electrical-work', description: 'Professional electrical services in Indonesia — wiring replacement, outlet installation, lighting setup, and electrical panel upgrades. Licensed electricians for safe, compliant installations.', icon: '' },
    { name: 'Plumbing', slug: 'plumbing', description: 'Installation, replacement, repair', icon: '🔧' },
    { name: 'MEP Systems', slug: 'mep-systems', description: 'Integrated mechanical, electrical, plumbing, HVAC', icon: '⚙️' },
    { name: 'Finishing', slug: 'finishing', description: 'Wallpaper, painting, tiles, ceilings', icon: '🎨' },
    { name: 'Construction', slug: 'construction', description: 'New home construction services in Indonesia — frame houses, brick houses, block houses, baths and saunas. Build your dream home with experienced contractors.', icon: '' },
    { name: 'Roofing', slug: 'roofing', description: 'Professional roofing services in Indonesia — new roof installation, repair, insulation, and drainage systems. Protect your home with quality roofing from verified contractors.', icon: '' },
    { name: 'Facade', slug: 'facade', description: 'Professional facade services in Indonesia — plastering, siding, insulation and stone cladding. Enhance your building exterior with quality materials and expert craftsmanship.', icon: '' },
    { name: 'Waterproofing', slug: 'waterproofing', description: 'Roof, basement, bathroom, balcony waterproofing', icon: '💧' },
    { name: 'Landscaping', slug: 'landscaping', description: 'Professional landscaping services in Indonesia — fence installation, path paving, gardening, and drainage systems. Transform your outdoor space with expert contractors.', icon: '' },
    { name: 'Demolition', slug: 'demolition', description: 'Professional demolition services in Indonesia — wall and floor demolition, building dismantling, and waste removal. Safe, licensed demolition crews for residential and commercial projects.', icon: '' },
  ];

  const insertCat = db.prepare('INSERT INTO categories (name, slug, description, icon) VALUES (?, ?, ?, ?)');
  const insertSub = db.prepare('INSERT INTO subcategories (category_id, name, slug, price_from, contractors_count) VALUES (?, ?, ?, ?, ?)');

  const subcategories: Record<string, Array<{ name: string; slug: string; price_from: string; count: number }>> = {
    'apartment-renovation': [
      { name: 'Cosmetic Renovation', slug: 'cosmetic', price_from: '150K Rp/m²', count: 1200 },
      { name: 'Major Renovation', slug: 'capital', price_from: '300K Rp/m²', count: 800 },
      { name: 'Turnkey Renovation', slug: 'turnkey', price_from: '500K Rp/m²', count: 600 },
      { name: 'Designer Renovation', slug: 'design', price_from: '800K Rp/m²', count: 300 },
    ],
    'electrical-work': [
      { name: 'Wiring Replacement', slug: 'wiring', price_from: '50K Rp/point', count: 400 },
      { name: 'Outlet Installation', slug: 'sockets', price_from: '30K Rp/pcs', count: 600 },
      { name: 'Lighting Installation', slug: 'lighting', price_from: '80K Rp/point', count: 500 },
      { name: 'Electrical Panels', slug: 'panels', price_from: '300K Rp', count: 200 },
    ],
    'plumbing': [
      { name: 'Fixture Installation', slug: 'install', price_from: '100K Rp', count: 500 },
      { name: 'Pipe Replacement', slug: 'pipes', price_from: '50K Rp/m', count: 400 },
      { name: 'Pipe Repair', slug: 'repair', price_from: '80K Rp', count: 350 },
      { name: 'Water Heater Installation', slug: 'water-heater', price_from: '200K Rp', count: 200 },
    ],
    'finishing': [
      { name: 'Wallpaper Hanging', slug: 'wallpaper', price_from: '15K Rp/m²', count: 600 },
      { name: 'Wall Painting', slug: 'painting', price_from: '10K Rp/m²', count: 500 },
      { name: 'Tile Laying', slug: 'tiles', price_from: '80K Rp/m²', count: 800 },
      { name: 'Stretch Ceilings', slug: 'ceilings', price_from: '50K Rp/m²', count: 400 },
    ],
    'construction': [
      { name: 'Frame Houses', slug: 'frame', price_from: '1,500K Rp/m²', count: 200 },
      { name: 'Brick Houses', slug: 'brick', price_from: '2,500K Rp/m²', count: 150 },
      { name: 'Block Houses', slug: 'blocks', price_from: '2,000K Rp/m²', count: 250 },
      { name: 'Baths & Saunas', slug: 'saunas', price_from: '1,200K Rp/m²', count: 180 },
    ],
    'roofing': [
      { name: 'Roof Installation', slug: 'install', price_from: '200K Rp/m²', count: 300 },
      { name: 'Roof Repair', slug: 'repair', price_from: '100K Rp/m²', count: 200 },
      { name: 'Insulation', slug: 'insulation', price_from: '50K Rp/m²', count: 150 },
      { name: 'Drainage Systems', slug: 'roofing-drainage', price_from: '80K Rp/m', count: 100 },
    ],
    'facade': [
      { name: 'Facade Plastering', slug: 'plaster', price_from: '100K Rp/m²', count: 200 },
      { name: 'Siding', slug: 'siding', price_from: '150K Rp/m²', count: 150 },
      { name: 'Insulation', slug: 'insulation', price_from: '120K Rp/m²', count: 180 },
      { name: 'Stone Cladding', slug: 'stone', price_from: '250K Rp/m²', count: 100 },
    ],
    'landscaping': [
      { name: 'Fence Installation', slug: 'fences', price_from: '120K Rp/m', count: 150 },
      { name: 'Path Paving', slug: 'paths', price_from: '80K Rp/m²', count: 120 },
      { name: 'Gardening', slug: 'greening', price_from: '50K Rp/m²', count: 80 },
      { name: 'Drainage Systems', slug: 'landscaping-drainage', price_from: '100K Rp/m', count: 60 },
    ],
    'demolition': [
      { name: 'Wall Demolition', slug: 'walls', price_from: '50K Rp/m²', count: 200 },
      { name: 'Floor Demolition', slug: 'floor', price_from: '30K Rp/m²', count: 150 },
      { name: 'Waste Removal', slug: 'disposal', price_from: '300K Rp/load', count: 300 },
      { name: 'Building Demolition', slug: 'buildings', price_from: 'from 5M Rp', count: 50 },
    ],
    'general-contractor': [
      { name: 'Design & Build', slug: 'design-build', price_from: '2,000K Rp/m²', count: 150 },
      { name: 'General Contracting', slug: 'general-contracting', price_from: '1,800K Rp/m²', count: 200 },
      { name: 'Project Management', slug: 'project-management', price_from: '10% project cost', count: 100 },
      { name: 'Turnkey Construction', slug: 'turnkey-construction', price_from: '2,500K Rp/m²', count: 120 },
    ],
    'construction-company': [
      { name: 'Commercial Construction', slug: 'commercial', price_from: '3,000K Rp/m²', count: 80 },
      { name: 'Industrial Construction', slug: 'industrial', price_from: '3,500K Rp/m²', count: 60 },
      { name: 'High-Rise Construction', slug: 'high-rise', price_from: '4,000K Rp/m²', count: 40 },
      { name: 'Renovation & Retrofit', slug: 'renovation-retrofit', price_from: '1,500K Rp/m²', count: 100 },
    ],
    'civil-engineering': [
      { name: 'Road Construction', slug: 'roads', price_from: '500K Rp/m²', count: 100 },
      { name: 'Bridge Construction', slug: 'bridges', price_from: 'from 10M Rp', count: 30 },
      { name: 'Drainage & Sewerage', slug: 'drainage', price_from: '200K Rp/m', count: 80 },
      { name: 'Earthworks & Grading', slug: 'earthworks', price_from: '150K Rp/m³', count: 120 },
      { name: 'Piling & Foundation', slug: 'piling', price_from: '500K Rp/pile', count: 70 },
    ],
    'steel-structure': [
      { name: 'Structural Steel Fabrication', slug: 'fabrication', price_from: '200K Rp/kg', count: 80 },
      { name: 'Precast Concrete', slug: 'precast', price_from: '1,000K Rp/m³', count: 60 },
      { name: 'Industrial Steel Buildings', slug: 'industrial-buildings', price_from: '1,500K Rp/m²', count: 50 },
      { name: 'Metal Roofing & Cladding', slug: 'metal-roofing', price_from: '180K Rp/m²', count: 70 },
    ],
    'interior-renovation': [
      { name: 'Office Fit-Out', slug: 'office-fitout', price_from: '800K Rp/m²', count: 200 },
      { name: 'Retail & Shop Renovation', slug: 'retail-renovation', price_from: '1,000K Rp/m²', count: 150 },
      { name: 'Hotel & Hospitality', slug: 'hospitality', price_from: '1,500K Rp/m²', count: 80 },
      { name: 'Restaurant & F&B', slug: 'restaurant', price_from: '1,200K Rp/m²', count: 100 },
    ],
    'mep-systems': [
      { name: 'HVAC Installation', slug: 'hvac', price_from: '300K Rp/m²', count: 150 },
      { name: 'Electrical Systems', slug: 'electrical-systems', price_from: '200K Rp/m²', count: 200 },
      { name: 'Plumbing Systems', slug: 'plumbing-systems', price_from: '150K Rp/m²', count: 180 },
      { name: 'Fire Protection', slug: 'fire-protection', price_from: '100K Rp/m²', count: 80 },
      { name: 'Building Automation', slug: 'building-automation', price_from: '150K Rp/m²', count: 50 },
    ],
    'waterproofing': [
      { name: 'Roof Waterproofing', slug: 'roof-waterproofing', price_from: '80K Rp/m²', count: 200 },
      { name: 'Basement Waterproofing', slug: 'basement-waterproofing', price_from: '150K Rp/m²', count: 100 },
      { name: 'Bathroom Waterproofing', slug: 'bathroom-waterproofing', price_from: '100K Rp/m²', count: 300 },
      { name: 'Balcony & Deck Waterproofing', slug: 'balcony-waterproofing', price_from: '90K Rp/m²', count: 120 },
    ],
  };

  for (const cat of categories) {
    const result = insertCat.run(cat.name, cat.slug, cat.description, cat.icon);
    const catId = result.lastInsertRowid as number;
    const subs = subcategories[cat.slug] || [];
    for (const sub of subs) {
      insertSub.run(catId, sub.name, sub.slug, sub.price_from, 0);
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
    { title: 'Bathroom Renovation', description: 'Full bathroom renovation 4m²', category: 'apartment-renovation', contact_name: 'John Doe', contact_phone: '+62812****4567', status: 'pending' },
    { title: 'Wiring Replacement', description: '2-room apartment', category: 'electrical-work', contact_name: 'Jane Smith', contact_phone: '+62812****5678', status: 'active' },
    { title: 'Stretch Ceiling', description: 'Living room 20m², matte white', category: 'finishing', contact_name: 'Alex Brown', contact_phone: '+62812****6789', status: 'completed' },
    { title: 'Sauna Construction', description: 'Sauna 6x4m from timber', category: 'construction', contact_name: 'David Wilson', contact_phone: '+62812****7890', status: 'pending' },
    { title: 'Paving Stones', description: 'Yard 50m²', category: 'landscaping', contact_name: 'Sarah Lee', contact_phone: '+62812****8901', status: 'active' },
    { title: 'Roof Installation', description: 'Metal tiles 120m²', category: 'roofing', contact_name: 'Mike Johnson', contact_phone: '+62812****9012', status: 'completed' },
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
