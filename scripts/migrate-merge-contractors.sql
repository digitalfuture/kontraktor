-- Migration: Merge contractors into users
-- Adds contractor-specific columns to the users table,
-- migrates existing contractor data, and updates FK references.

-- 1. Add contractor columns to users table
ALTER TABLE users ADD COLUMN bio TEXT;
ALTER TABLE users ADD COLUMN avatar_url TEXT;
ALTER TABLE users ADD COLUMN category_id INTEGER;
ALTER TABLE users ADD COLUMN specialty TEXT;
ALTER TABLE users ADD COLUMN rating REAL DEFAULT 0;
ALTER TABLE users ADD COLUMN reviews_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN completed_projects INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN is_approved INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN credits INTEGER DEFAULT 3;
ALTER TABLE users ADD COLUMN is_contractor INTEGER DEFAULT 0;

-- 2. Add temp user_id to contractors for migration mapping
ALTER TABLE contractors ADD COLUMN _new_user_id INTEGER;

-- 3. Create user accounts for all existing contractors
INSERT INTO users (email, name, phone, telegram_id, role, is_verified, is_active,
                   bio, avatar_url, specialty, rating, reviews_count, completed_projects,
                   is_approved, credits, is_contractor, created_at)
SELECT c.email, c.name, c.phone, c.telegram_id,
       CASE WHEN c.is_verified THEN 'contractor' ELSE 'client' END,
       c.is_verified, c.is_active,
       c.bio, c.avatar_url, c.specialty, c.rating, c.reviews_count, c.completed_projects,
       c.is_approved, c.credits, 1, c.created_at
FROM contractors c;

-- 4. Map old contractor IDs to new user IDs
UPDATE contractors SET _new_user_id = (
  SELECT u.id FROM users u WHERE u.email = contractors.email
);

-- 5. Update FK references in related tables
-- contractor_services
UPDATE contractor_services SET contractor_id = (
  SELECT c._new_user_id FROM contractors c WHERE c.id = contractor_services.contractor_id
);

-- reviews
UPDATE reviews SET contractor_id = (
  SELECT c._new_user_id FROM contractors c WHERE c.id = reviews.contractor_id
);

-- photos
UPDATE photos SET contractor_id = (
  SELECT c._new_user_id FROM contractors c WHERE c.id = photos.contractor_id
);

-- projects (assigned_contractor_id)
UPDATE projects SET assigned_contractor_id = (
  SELECT c._new_user_id FROM contractors c WHERE c.id = projects.assigned_contractor_id
);
