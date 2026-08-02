import type Database from 'better-sqlite3';

export interface ActiveCategory {
  id: number;
  name: string;
  slug: string;
  display_name: string;
}

/** Active categories with display_name alias (used across post/contractor forms) */
export function getActiveCategories(db: Database.Database): ActiveCategory[] {
  const rows = db
    .prepare('SELECT id, name, slug FROM categories WHERE is_active = 1 ORDER BY name')
    .all() as Array<{ id: number; name: string; slug: string }>;
  return rows.map((c) => ({ ...c, display_name: c.name }));
}
