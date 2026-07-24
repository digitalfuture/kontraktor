-- Fix FK references pointing to contractors → users
-- Run: sqlite3 path/to/db.db < scripts/fix-fk-refs.sql
-- PRAGMA foreign_keys must be OFF for table recreation

PRAGMA foreign_keys = OFF;

-- 1. bids
CREATE TABLE bids_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  contractor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  price REAL,
  estimated_days INTEGER,
  description TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'rejected')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, contractor_id)
);
INSERT INTO bids_new SELECT * FROM bids;
DROP TABLE bids;
ALTER TABLE bids_new RENAME TO bids;

-- 2. contractor_services
CREATE TABLE contractor_services_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contractor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(contractor_id, category_id)
);
INSERT INTO contractor_services_new SELECT * FROM contractor_services;
DROP TABLE contractor_services;
ALTER TABLE contractor_services_new RENAME TO contractor_services;

-- 3. payments
CREATE TABLE payments_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contractor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  external_id TEXT UNIQUE NOT NULL,
  amount REAL NOT NULL,
  credits INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'failed')),
  payment_method TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO payments_new SELECT * FROM payments;
DROP TABLE payments;
ALTER TABLE payments_new RENAME TO payments;

-- 4. projects
CREATE TABLE projects_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  subcategory TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  address TEXT,
  budget TEXT,
  client_email TEXT,
  assigned_contractor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reviewed INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  district TEXT,
  contact_email TEXT
);
INSERT INTO projects_new SELECT * FROM projects;
DROP TABLE projects;
ALTER TABLE projects_new RENAME TO projects;

-- 5. reviews
CREATE TABLE reviews_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contractor_id INTEGER REFERENCES users(id),
  project_id INTEGER REFERENCES projects(id),
  author_email TEXT NOT NULL,
  client_email TEXT,
  rating INTEGER NOT NULL,
  comment TEXT,
  is_moderated INTEGER DEFAULT 0,
  is_approved INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME
);
INSERT INTO reviews_new SELECT * FROM reviews;
DROP TABLE reviews;
ALTER TABLE reviews_new RENAME TO reviews;

PRAGMA foreign_keys = ON;

-- Verify
SELECT 'fix_fk_refs done';
