import express, { Request, Response } from 'express';
import db from '../db';
import { getDistrictDisplay } from '../lib/districts';
import { getProjectsMapData } from '../lib/project-geo';

export const pageRouter: express.Router = express.Router();
export const apiRouter: express.Router = express.Router();

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

// ── Pages: Browse Projects ──

pageRouter.get('/', (req: any, res: Response): void => {
  const locale = (res.locals.locale as string) || 'en';
  const category = (req.query.category as string || '').trim();
  const status = (req.query.status as string || '').trim();
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit as string, 10) || DEFAULT_LIMIT));
  const offset = (page - 1) * limit;
  const user = req.user;
  const userRole = user?.role || null;

  const conditions: string[] = [];
  const params: any[] = [];

  // Role-based filtering
  if (!user) {
    // Guest: sees all open (unassigned) projects
    conditions.push(`p.assigned_contractor_id IS NULL`);
    conditions.push(`p.status IN ('pending', 'active')`);
  } else if (userRole === 'admin') {
    // Admin sees ALL projects
    if (status) {
      conditions.push(`p.status = ?`);
      params.push(status);
    }
  } else if (userRole === 'contractor') {
    // Contractor sees: their assigned projects + all unassigned projects
    const contractor = db.prepare('SELECT id FROM users WHERE id = ? AND is_contractor = 1').get(user.id) as any;
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
    SELECT p.*, c.name as category_name,
      (SELECT COUNT(*) FROM bids WHERE project_id = p.id) as bid_count
    FROM projects p
    LEFT JOIN categories c ON p.category = c.slug
    WHERE 1=1${whereSql}
    ORDER BY p.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as any[];

  // Localize category names and district, mark editability for client
  projects.forEach((p: any) => {
    p.category_display = p.category_name || p.category;
    p.district_display = getDistrictDisplay(p.district, locale);
    // Client can edit only if no contractor assigned yet
    p.editable = (userRole === 'client' && !p.assigned_contractor_id);
  });

  // Get categories for filter
  const categories = db.prepare('SELECT slug, name FROM categories WHERE is_active = 1 ORDER BY name').all() as any[];

  const totalPages = Math.ceil(countResult.total / limit);

  const baseUrl = '/projects';

  res.render('projects-list', {
    title: locale === 'id' ? 'Cari Proyek — Kontraktor' : 'Browse Projects — Kontraktor',
    projects,
    categories,
    category,
    status,
    locale,
    user,
    isContractor: user?.is_contractor === 1 || user?.role === 'contractor',
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

// ── API: Projects Map Endpoints ──

apiRouter.get('/map', (req: Request, res: Response): void => {
  try {
    const status = (req.query.status as string || '').trim();
    const category = (req.query.category as string || '').trim();
    const mapData = getProjectsMapData({
      status: status || undefined,
      category: category || undefined,
    });
    res.json(mapData);
  } catch (err) {
    console.error('Error generating projects map data:', err);
    res.status(500).json({ error: 'Failed to generate map data' });
  }
});

// ── API: Projects List ──

apiRouter.get('/', (req: any, res: Response): void => {
  try {
    const locale = (res.locals.locale as string) || 'en';
    const category = (req.query.category as string || '').trim();
    const status = (req.query.status as string || '').trim();
    const district = (req.query.district as string || '').trim();
    const search = (req.query.search as string || '').trim();
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit as string, 10) || DEFAULT_LIMIT));
    const offset = (page - 1) * limit;
    const user = req.user;
    const userRole = user?.role || null;

    const conditions: string[] = [];
    const params: any[] = [];

    // Role-based visibility
    if (!user) {
      conditions.push(`p.assigned_contractor_id IS NULL`);
      conditions.push(`p.status IN ('pending', 'active')`);
    } else if (userRole === 'admin') {
      if (status) {
        conditions.push(`p.status = ?`);
        params.push(status);
      }
    } else if (userRole === 'contractor') {
      const contractor = db.prepare('SELECT id FROM users WHERE id = ? AND is_contractor = 1').get(user.id) as any;
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
        conditions.push(`p.status IN ('pending', 'in_progress', 'active')`);
      }
    } else {
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
    if (district) {
      conditions.push(`(p.district LIKE ? OR p.address LIKE ?)`);
      params.push(`%${district}%`, `%${district}%`);
    }
    if (search) {
      conditions.push(`(p.title LIKE ? OR p.description LIKE ? OR p.address LIKE ? OR p.district LIKE ?)`);
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    const whereSql = conditions.length > 0 ? ` AND ${conditions.join(' AND ')}` : '';

    const countResult = db.prepare(`
      SELECT COUNT(*) as total FROM projects p WHERE 1=1${whereSql}
    `).get(...params) as { total: number };

    const projects = db.prepare(`
      SELECT p.*, c.name as category_name,
        (SELECT COUNT(*) FROM bids WHERE project_id = p.id) as bid_count
      FROM projects p
      LEFT JOIN categories c ON p.category = c.slug
      WHERE 1=1${whereSql}
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset) as any[];

    projects.forEach((p: any) => {
      p.category_display = p.category_name || p.category;
      p.district_display = getDistrictDisplay(p.district, locale);
      if (p.attachments) {
        try { p.attachments_list = JSON.parse(p.attachments); } catch { p.attachments_list = []; }
      } else {
        p.attachments_list = [];
      }
    });

    const totalPages = Math.ceil(countResult.total / limit);

    res.json({
      projects,
      pagination: {
        page,
        limit,
        total: countResult.total,
        totalPages,
      },
    });
  } catch (err) {
    console.error('Error listing projects via API:', err);
    res.status(500).json({ error: 'Failed to list projects' });
  }
});

// ── API: Single Project ──

apiRouter.get('/:id', (req: any, res: Response): void => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid project ID' });
      return;
    }

    const locale = (res.locals.locale as string) || 'en';
    const project = db.prepare(`
      SELECT p.*, c.name as category_name,
        (SELECT COUNT(*) FROM bids WHERE project_id = p.id) as bid_count
      FROM projects p
      LEFT JOIN categories c ON p.category = c.slug
      WHERE p.id = ?
    `).get(id) as any;

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    project.category_display = project.category_name || project.category;
    project.district_display = getDistrictDisplay(project.district, locale);
    if (project.attachments) {
      try { project.attachments_list = JSON.parse(project.attachments); } catch { project.attachments_list = []; }
    } else {
      project.attachments_list = [];
    }

    res.json({ project });
  } catch (err) {
    console.error('Error fetching project via API:', err);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

export default pageRouter;
