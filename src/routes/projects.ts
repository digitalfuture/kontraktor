import express, { Response } from 'express';
import db from '../db';
import { getDistrictDisplay } from '../lib/districts';

const router: express.Router = express.Router();

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

router.get('/', (req: any, res: Response): void => {
  const locale = (res.locals.locale as string) || 'en';
  const category = (req.query.category as string || '').trim();
  const status = (req.query.status as string || '').trim();
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit as string, 10) || DEFAULT_LIMIT));
  const offset = (page - 1) * limit;
  const user = req.user;
  const userRole = user?.role || 'client';

  const conditions: string[] = [];
  const params: any[] = [];

  // Role-based filtering
  if (userRole === 'admin') {
    // Admin sees ALL projects
    if (status) {
      conditions.push(`p.status = ?`);
      params.push(status);
    }
  } else if (userRole === 'contractor') {
    // Contractor sees: their assigned projects + all unassigned projects
    const contractor = db.prepare('SELECT id FROM contractors WHERE email = ?').get(user.email) as any;
    if (contractor) {
      conditions.push(`(p.assigned_contractor_id = ? OR p.assigned_contractor_id IS NULL)`);
      params.push(contractor.id);
    } else {
      conditions.push(`p.assigned_contractor_id IS NULL`);
    }
    if (status) {
      conditions.push(`p.status = ?`);
      params.push(status);
    } else {
      conditions.push(`p.status IN ('pending', 'in_progress')`);
    }
  } else {
    // Client sees only their own projects (all statuses)
    conditions.push(`p.client_email = ?`);
    params.push(user.email);
    if (status) {
      conditions.push(`p.status = ?`);
      params.push(status);
    }
  }

  if (category) {
    conditions.push(`p.category = ?`);
    params.push(category);
  }

  const whereSql = conditions.length > 0 ? ` AND ${conditions.join(' AND ')}` : '';

  // Count total for pagination
  const countResult = db.prepare(`
    SELECT COUNT(*) as total FROM projects p WHERE 1=1${whereSql}
  `).get(...params) as { total: number };

  // Get paginated projects
  const projects = db.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM bids WHERE project_id = p.id) as bid_count
    FROM projects p
    LEFT JOIN categories c ON p.category = c.slug
    WHERE 1=1${whereSql}
    ORDER BY p.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as any[];

  // Localize category names and district, mark editability for client
  projects.forEach((p: any) => {
        p.district_display = getDistrictDisplay(p.district, locale);
    // Client can edit only if no contractor assigned yet
    p.editable = (userRole === 'client' && !p.assigned_contractor_id);
  });

  // Get categories for filter
  const categories = db.prepare('SELECT slug, c.name, name FROM categories WHERE is_active = 1 ORDER BY name').all() as any[];

  const totalPages = Math.ceil(countResult.total / limit);

  const baseUrl = '/projects';

  res.render('projects-list', {
    title: locale === 'id' ? 'Cari Proyek — Kontraktor' : 'Browse Projects — Kontraktor',
    projects,
    categories,
    category,
    status,
    locale,
    userRole,
    pagination: {
      page,
      totalPages,
      limit,
      totalItems: countResult.total,
      baseUrl,
      params: { category: category || undefined, status: status || undefined },
    },
  });
});

export default router;
