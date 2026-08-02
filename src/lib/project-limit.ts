import type Database from 'better-sqlite3';

/**
 * Active-project limit model (3-tier subscription scheme):
 *  - Free tier: unlimited (free_mode ON, or active_project_limit = 0)
 *  - Tier 2:    capped active projects (active_project_limit = 3)
 *  - Tier 3:    unlimited (active_project_limit = 0)
 * 0 means unlimited.
 */

/** Active project limit from settings (0 = unlimited). Falls back to free_mode toggle. */
export function getActiveProjectLimit(db: Database.Database): number {
  const row = db
    .prepare("SELECT value FROM settings WHERE key = 'active_project_limit'")
    .get() as { value: string } | undefined;
  if (row) {
    const n = parseInt(row.value, 10);
    if (!isNaN(n) && n >= 0) return n;
  }
  // Backward compat: old free_mode toggle (true = unlimited, false = 3)
  const free = db
    .prepare("SELECT value FROM settings WHERE key = 'free_mode'")
    .get() as { value: string } | undefined;
  return free?.value === 'true' ? 0 : 3;
}

/** Number of active (pending/active) projects for a client email */
export function countActiveProjects(db: Database.Database, clientEmail: string): number {
  const row = db
    .prepare(
      "SELECT COUNT(*) as c FROM projects WHERE client_email = ? AND (status = 'pending' OR status = 'active')"
    )
    .get(clientEmail) as { c: number };
  return row.c;
}
