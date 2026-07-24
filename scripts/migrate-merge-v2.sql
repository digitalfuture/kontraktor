-- Migration v2: Merge contractors into users (fixed role)
-- The ALTER TABLE columns were already added in v1 attempt.
-- Just migrate data and update FK references.

-- 1. Create user accounts for all existing contractors (role='client' + is_contractor=1)
INSERT OR IGNORE INTO users (email, name, phone, telegram_id, role, is_verified, is_active,
                   bio, avatar_url, specialty, rating, reviews_count, completed_projects,
                   is_approved, credits, is_contractor, created_at)
SELECT c.email, c.name, c.phone, c.telegram_id, 'client',
       c.is_verified, c.is_active,
       c.bio, c.avatar_url, c.specialty, c.rating, c.reviews_count, c.completed_projects,
       c.is_approved, c.credits, 1, c.created_at
FROM contractors c;

-- 2. Map old contractor IDs to new user IDs
UPDATE contractors SET _new_user_id = (
  SELECT u.id FROM users u WHERE u.email = contractors.email
);

-- 3. Update FK references
UPDATE contractor_services SET contractor_id = (
  SELECT COALESCE(c._new_user_id, (SELECT id FROM users WHERE email = 'migration-error@kontraktor.app'))
  FROM contractors c WHERE c.id = contractor_services.contractor_id
);
UPDATE reviews SET contractor_id = (
  SELECT COALESCE(c._new_user_id, (SELECT id FROM users WHERE email = 'migration-error@kontraktor.app'))
  FROM contractors c WHERE c.id = reviews.contractor_id
);
UPDATE photos SET contractor_id = (
  SELECT COALESCE(c._new_user_id, (SELECT id FROM users WHERE email = 'migration-error@kontraktor.app'))
  FROM contractors c WHERE c.id = photos.contractor_id
);
UPDATE projects SET assigned_contractor_id = (
  SELECT COALESCE(c._new_user_id, (SELECT id FROM users WHERE email = 'migration-error@kontraktor.app'))
  FROM contractors c WHERE c.id = projects.assigned_contractor_id
);
