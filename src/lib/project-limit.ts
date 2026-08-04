import type Database from 'better-sqlite3';

/**
 * Two-mode billing model:
 *  - Free mode (settings.free_mode = 'true', toggled in admin): everything is
 *    free, everyone gets unlimited active projects.
 *  - Paid mode (free_mode = 'false'): each client gets 1 active project for
 *    free. A paid subscription raises the cap: Pro = 3, Business = unlimited.
 * 0 means unlimited.
 */

export type UserPlan = 'free' | 'pro' | 'business';

/** True when the "everything is free" mode is enabled via admin settings. */
export function isFreeMode(db: Database.Database): boolean {
  const row = db
    .prepare("SELECT value FROM settings WHERE key = 'free_mode'")
    .get() as { value: string } | undefined;
  return row?.value === 'true';
}

/** Active-project cap for a plan (0 = unlimited). */
export function getPlanLimit(plan: string | null | undefined): number {
  switch (plan) {
    case 'pro':
      return 3;
    case 'business':
      return 0; // unlimited
    case 'free':
    default:
      return 1; // one active project always free in paid mode
  }
}

/** Effective active-project limit for a user (0 = unlimited). */
export function getProjectLimit(db: Database.Database, user: { plan?: string | null } | null | undefined): number {
  if (isFreeMode(db)) return 0;
  return getPlanLimit(user?.plan ?? 'free');
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
