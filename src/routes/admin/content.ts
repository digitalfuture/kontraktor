// ── Admin — Core content management (dashboard, projects, contractors, categories, reviews, trash, users) ──

import express, { Request, Response } from 'express';
import db from '../../db';
import { getDistrictDisplay } from '../../lib/districts';
import { makeT, getPagination, PAGE_SIZE } from './helpers';

export function registerContentRoutes(pageRouter: express.Router, apiRouter: express.Router): void {

  // ═══════════════════════════════════════════
  // ADMIN PAGES
  // ═══════════════════════════════════════════

  // ── Dashboard ──

  pageRouter.get('/', (req: Request, res: Response): void => {
    const locale = (res.locals.locale as string) || 'en';
    const _t = makeT(res);
    const totalProjects: { count: number } = db.prepare('SELECT COUNT(*) as count FROM projects').get() as { count: number };
    const totalContractors: { count: number } = db.prepare('SELECT COUNT(*) as count FROM users WHERE is_contractor = 1 AND deleted_at IS NULL').get() as { count: number };
    const totalUsers: { count: number } = db.prepare('SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL').get() as { count: number };
    const totalClients: { count: number } = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'client' AND deleted_at IS NULL").get() as { count: number };
    const totalReviews: { count: number } = db.prepare('SELECT COUNT(*) as count FROM reviews WHERE deleted_at IS NULL').get() as { count: number };
    const pendingProjects: { count: number } = db.prepare("SELECT COUNT(*) as count FROM projects WHERE status = 'pending'").get() as { count: number };
    const unmoderatedReviews: { count: number } = db.prepare("SELECT COUNT(*) as count FROM reviews WHERE is_moderated = 0 AND deleted_at IS NULL").get() as { count: number };

    const recentProjects = db.prepare(`
      SELECT p.id, p.title, p.contact_name, p.status, p.district, p.created_at, c.name as category_name
      FROM projects p
      LEFT JOIN categories c ON p.category = c.slug
      ORDER BY p.created_at DESC
      LIMIT 10
    `).all();

    const recentUsers = db.prepare(`
      SELECT id, email, name, role, created_at
      FROM users
      WHERE deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT 10
    `).all();

    const categoryStats = db.prepare(`
      SELECT c.slug, COUNT(p.id) as count
      FROM categories c
      LEFT JOIN projects p ON p.category = c.slug
      WHERE c.is_active = 1
      GROUP BY c.slug
      ORDER BY count DESC
    `).all() as any[];

    const roleStats = db.prepare(`
      SELECT
        CASE WHEN is_contractor = 1 THEN 'contractor' ELSE role END as role,
        COUNT(*) as count
      FROM users WHERE deleted_at IS NULL
      GROUP BY role
    `).all() as any[];

    res.render('admin/dashboard', {
      title: _t('admin.dashboard') + ' — Kontraktor',
      stats: {
        totalProjects: totalProjects.count,
        totalContractors: totalContractors.count,
        totalUsers: totalUsers.count,
        totalClients: totalClients.count,
        totalReviews: totalReviews.count,
        pendingProjects: pendingProjects.count,
        unmoderatedReviews: unmoderatedReviews.count
      },
      recentProjects: (recentProjects as any[]).map((r: any) => ({
        ...r,
        district_display: getDistrictDisplay(r.district, locale),
      })),
      recentUsers,
      categoryStats: categoryStats.map((c: any) => ({
        name: c.name,
        count: c.count
      })),
      roleStats
    });
  });

  // ── Projects ──

  pageRouter.get('/projects', (req: Request, res: Response): void => {
    const locale = (res.locals.locale as string) || 'en';
    const total: { count: number } = db.prepare('SELECT COUNT(*) as count FROM projects').get() as { count: number };
    const { page, totalPages, offset } = getPagination(req, total.count);

    const projects = db.prepare(`
      SELECT p.id, p.title, p.description, p.contact_name, p.contact_phone, p.status, p.district, p.address, p.created_at,
             c.name as category_name
      FROM projects p
      LEFT JOIN categories c ON p.category = c.slug
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `).all(PAGE_SIZE, offset);

    const contractors = db.prepare('SELECT id, name, email FROM users WHERE is_contractor = 1 AND deleted_at IS NULL ORDER BY name').all();

    res.render('admin/orders', {
      title: (locale === 'id' ? 'Proyek — Admin' : 'Projects — Admin') + ' — Kontraktor',
      orders: (projects as any[]).map((r: any) => ({
        ...r,
        district_display: getDistrictDisplay(r.district, locale),
      })),
      contractors,
      pagination: { page, totalPages, total: total.count }
    });
  });

  // ── Contractors ──

  pageRouter.get('/contractors', (req: Request, res: Response): void => {
    const locale = (res.locals.locale as string) || 'en';
    const total: { count: number } = db.prepare('SELECT COUNT(*) as count FROM users WHERE is_contractor = 1 AND deleted_at IS NULL').get() as { count: number };
    const { page, totalPages, offset } = getPagination(req, total.count);

    const contractors = db.prepare(`
      SELECT id, email, name, phone, rating, reviews_count, completed_projects, is_verified, is_active, created_at
      FROM users
      WHERE is_contractor = 1 AND deleted_at IS NULL
      ORDER BY rating DESC
      LIMIT ? OFFSET ?
    `).all(PAGE_SIZE, offset) as any[];

    const getServices = db.prepare(`
      SELECT cs.id, cs.is_active, c.id as category_id, c.name, c.slug
      FROM contractor_services cs
      JOIN categories c ON cs.category_id = c.id
      WHERE cs.contractor_id = ?
      ORDER BY c.name
    `);
    for (const c of contractors) {
      c.services = getServices.all(c.id).map((svc: any) => ({
        ...svc,
        display_name: svc.name,
      }));
    }

    res.render('admin/contractors', {
      title: (locale === 'id' ? 'Kontraktor — Admin' : 'Contractors — Admin') + ' — Kontraktor',
      contractors: contractors,
      activePage: 'contractors',
      pagination: { page, totalPages, total: total.count }
    });
  });

  // ── Categories ──

  pageRouter.get('/categories', (req: Request, res: Response): void => {
    const locale = (res.locals.locale as string) || 'en';
    const _t = makeT(res);
    const categories = db.prepare('SELECT * FROM categories ORDER BY is_active DESC, name').all() as any[];
    res.render('admin/categories', {
      title: _t('admin.categories') + ' — Kontraktor',
      activePage: 'categories',
      categories: categories.map((c: any) => ({
        ...c,
        display_name: c.name,
      })),
    });
  });

  // ── Reviews ──

  pageRouter.get('/reviews', (req: Request, res: Response): void => {
    const locale = (res.locals.locale as string) || 'en';
    const _t = makeT(res);
    const total: { count: number } = db.prepare('SELECT COUNT(*) as count FROM reviews WHERE deleted_at IS NULL').get() as { count: number };
    const { page, totalPages, offset } = getPagination(req, total.count);

    const reviews = db.prepare(`
      SELECT r.*, c.name as contractor_name, c.email as contractor_email
      FROM reviews r
      LEFT JOIN users c ON r.contractor_id = c.id
      WHERE r.deleted_at IS NULL
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?
    `).all(PAGE_SIZE, offset);

    res.render('admin/reviews', {
      title: _t('admin.reviews') + ' — Kontraktor',
      activePage: 'reviews',
      reviews,
      pagination: { page, totalPages, total: total.count }
    });
  });

  // ── Trash ──

  pageRouter.get('/trash', (req: Request, res: Response): void => {
    const locale = (res.locals.locale as string) || 'en';
    const _t = makeT(res);

    const deletedUsers = db.prepare('SELECT id, email, name, role, created_at, deleted_at FROM users WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 50').all();
    const deletedCategories = db.prepare('SELECT * FROM categories WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 50').all() as any[];
    const deletedReviews = db.prepare(`
      SELECT r.*, c.name as contractor_name FROM reviews r
      LEFT JOIN users c ON r.contractor_id = c.id
      WHERE r.deleted_at IS NOT NULL ORDER BY r.deleted_at DESC LIMIT 50
    `).all();
    const deletedTemplates = db.prepare('SELECT id, name, subject, deleted_at FROM email_templates WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 50').all();
    const deletedCampaigns = db.prepare('SELECT id, name, subject, deleted_at FROM email_campaigns WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 50').all();
    const deletedLists = db.prepare('SELECT id, name, deleted_at FROM mailing_lists WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 50').all();
    const deletedContacts = db.prepare('SELECT mlc.id, mlc.email, mlc.name, mlc.deleted_at, ml.name as list_name FROM mailing_list_contacts mlc JOIN mailing_lists ml ON mlc.list_id = ml.id WHERE mlc.deleted_at IS NOT NULL ORDER BY mlc.deleted_at DESC LIMIT 50').all();

    res.render('admin/trash', {
      title: (locale === 'id' ? 'Sampah — Admin' : 'Trash — Admin') + ' — Kontraktor',
      activePage: 'trash',
      categories: deletedCategories,
      users: deletedUsers,
      reviews: deletedReviews,
      emailTemplates: deletedTemplates,
      emailCampaigns: deletedCampaigns,
      mailingLists: deletedLists,
      mailingContacts: deletedContacts,
    });
  });

  // ── Users ──

  pageRouter.get('/users', (req: Request, res: Response): void => {
    const locale = (res.locals.locale as string) || 'en';
    const _t = makeT(res);

    const roleFilter = (req.query.role as string) || '';
    const search = (req.query.search as string) || '';

    let countSql = "SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL";
    let sql = "SELECT u.*, COALESCE(u.rating, 0) as contractor_rating, COALESCE(u.reviews_count, 0) as contractor_reviews, COALESCE(u.completed_projects, 0) as contractor_projects FROM users u WHERE u.deleted_at IS NULL";
    const params: any[] = [];
    const countParams: any[] = [];

    if (roleFilter && ['admin', 'contractor', 'client'].includes(roleFilter)) {
      sql += " AND u.role = ?";
      countSql += " AND role = ?";
      params.push(roleFilter);
      countParams.push(roleFilter);
    }
    if (search) {
      sql += " AND (u.email LIKE ? OR u.name LIKE ?)";
      countSql += " AND (email LIKE ? OR name LIKE ?)";
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
      countParams.push(searchTerm, searchTerm);
    }

    const total: { count: number } = db.prepare(countSql).get(...countParams) as { count: number };
    const { page, totalPages, offset } = getPagination(req, total.count);

    sql += " ORDER BY u.created_at DESC LIMIT ? OFFSET ?";
    params.push(PAGE_SIZE, offset);

    const users = db.prepare(sql).all(...params) as any[];

    const isAdmin = (user: any): boolean => user.role === 'admin';

    res.render('admin/users', {
      title: _t('admin.users') + ' — Kontraktor',
      activePage: 'users',
      users,
      isAdmin,
      pagination: { page, totalPages, total: total.count },
      roleFilter,
      search,
    });
  });

  // ═══════════════════════════════════════════
  // ADMIN API
  // ═══════════════════════════════════════════

  // ── Project API ──

  apiRouter.post('/projects/:id/status', (req: Request, res: Response): void => {
    const id = parseInt(req.params.id as string, 10);
    const status = req.body.status;
    if (!['pending', 'active', 'in_progress', 'completed', 'cancelled'].includes(status)) {
      res.status(400).json({ error: 'Invalid status' });
      return;
    }
    db.prepare('UPDATE projects SET status = ? WHERE id = ?').run(status, id);
    if (req.headers['hx-request']) {
      const order = db.prepare('SELECT id, status, title, contact_name, contact_phone, description, district_display, address, category, created_at FROM projects WHERE id = ?').get(id) as any;
      res.render('partials/_admin-order-status', { order, prefix: req.body.prefix || '' });
      return;
    }
    res.redirect('/admin/projects');
  });

  apiRouter.post('/projects/:id/assign', (req: Request, res: Response): void => {
    const id = parseInt(req.params.id as string, 10);
    const contractorId = parseInt(req.body.contractor_id as string, 10);
    db.prepare('UPDATE projects SET assigned_contractor_id = ?, status = ? WHERE id = ?').run(contractorId, 'in_progress', id);
    if (req.headers['hx-request']) {
      res.set('HX-Trigger', JSON.stringify({ showNotification: { msg: 'Contractor assigned', type: 'success' } }));
      res.set('HX-Refresh', 'true');
      res.status(200).send('');
      return;
    }
    res.redirect('/admin/projects');
  });

  // ── Reviews API ──

  apiRouter.post('/reviews/:id/moderate', (req: Request, res: Response): void => {
    const id = parseInt(req.params.id as string, 10);
    const action = req.body.action;
    if (action === 'approve') {
      db.prepare('UPDATE reviews SET is_moderated = 1, is_approved = 1 WHERE id = ?').run(id);
    } else {
      db.prepare('UPDATE reviews SET is_moderated = 1, is_approved = 0 WHERE id = ?').run(id);
    }
    if (req.headers['hx-request']) {
      const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(id) as any;
      res.render('partials/_admin-review-actions', { review });
      return;
    }
    res.redirect('/admin/reviews');
  });

  apiRouter.post('/reviews/:id/delete', (req: Request, res: Response): void => {
    const id = parseInt(req.params.id as string, 10);
    db.prepare('UPDATE reviews SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
    if (req.headers['hx-request']) {
      res.set('HX-Redirect', '/admin/reviews');
      res.status(200).send('');
      return;
    }
    res.redirect('/admin/reviews');
  });

  apiRouter.post('/reviews/:id/restore', (req: Request, res: Response): void => {
    const id = parseInt(req.params.id as string, 10);
    db.prepare('UPDATE reviews SET deleted_at = NULL WHERE id = ?').run(id);
    if (req.headers['hx-request']) {
      res.set('HX-Trigger', JSON.stringify({ showNotification: { msg: 'Review restored', type: 'success' } }));
      res.status(200).send('');
      return;
    }
    res.redirect('/admin/trash');
  });

  apiRouter.post('/reviews/:id/force-delete', (req: Request, res: Response): void => {
    const id = parseInt(req.params.id as string, 10);
    db.prepare('DELETE FROM reviews WHERE id = ?').run(id);
    if (req.headers['hx-request']) {
      res.set('HX-Trigger', JSON.stringify({ showNotification: { msg: 'Review permanently deleted', type: 'success' } }));
      res.status(200).send('');
      return;
    }
    res.redirect('/admin/trash');
  });

  // ── Categories API ──

  apiRouter.post('/categories/create', (req: Request, res: Response): void => {
    const { name, slug } = req.body;
    if (!name || !slug) {
      if (req.headers['hx-request']) {
        res.set('HX-Trigger', JSON.stringify({ showNotification: { msg: 'Name and slug are required', type: 'error' } }));
        res.status(400).send('');
        return;
      }
      res.redirect('/admin/categories');
      return;
    }
    db.prepare(`
      INSERT INTO categories (name, slug, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `).run(name, slug);
    if (req.headers['hx-request']) {
      res.set('HX-Trigger', JSON.stringify({ showNotification: { msg: 'Category created', type: 'success' } }));
      res.set('HX-Refresh', 'true');
      res.status(200).send('');
      return;
    }
    res.redirect('/admin/categories');
  });

  apiRouter.post('/categories/:id/update', (req: Request, res: Response): void => {
    const id = parseInt(req.params.id as string, 10);
    const { name: catName, is_active } = req.body;
    db.prepare(`
      UPDATE categories SET name = ?, is_active = ?
      WHERE id = ?
    `).run(catName, is_active ? 1 : 0, id);
    if (req.headers['hx-request']) {
      res.set('HX-Trigger', JSON.stringify({ showNotification: { msg: 'Category updated', type: 'success' } }));
      res.set('HX-Refresh', 'true');
      res.status(200).send('');
      return;
    }
    res.redirect('/admin/categories');
  });

  apiRouter.post('/categories/:id/toggle', (req: Request, res: Response): void => {
    const id = parseInt(req.params.id as string, 10);
    db.prepare('UPDATE categories SET is_active = NOT is_active WHERE id = ?').run(id);
    if (req.headers['hx-request']) {
      res.set('HX-Trigger', JSON.stringify({ showNotification: { msg: 'Category toggled', type: 'success' } }));
      res.set('HX-Refresh', 'true');
      res.status(200).send('');
      return;
    }
    res.redirect('/admin/categories');
  });

  apiRouter.post('/categories/:id/delete', (req: Request, res: Response): void => {
    const id = parseInt(req.params.id as string, 10);
    db.prepare('UPDATE categories SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
    if (req.headers['hx-request']) {
      res.set('HX-Trigger', JSON.stringify({ showNotification: { msg: 'Category deleted', type: 'success' } }));
      res.status(200).send('');
      return;
    }
    res.redirect('/admin/categories');
  });

  apiRouter.post('/categories/:id/restore', (req: Request, res: Response): void => {
    const id = parseInt(req.params.id as string, 10);
    db.prepare('UPDATE categories SET deleted_at = NULL WHERE id = ?').run(id);
    if (req.headers['hx-request']) {
      res.set('HX-Trigger', JSON.stringify({ showNotification: { msg: 'Category restored', type: 'success' } }));
      res.status(200).send('');
      return;
    }
    res.redirect('/admin/trash');
  });

  apiRouter.post('/categories/:id/force-delete', (req: Request, res: Response): void => {
    const id = parseInt(req.params.id as string, 10);
    db.prepare('DELETE FROM categories WHERE id = ?').run(id);
    if (req.headers['hx-request']) {
      res.set('HX-Trigger', JSON.stringify({ showNotification: { msg: 'Category permanently deleted', type: 'success' } }));
      res.status(200).send('');
      return;
    }
    res.redirect('/admin/trash');
  });

  // ── Contractors API ──

  apiRouter.post('/contractors/:id/toggle-verified', (req: Request, res: Response): void => {
    const id = parseInt(req.params.id as string, 10);
    db.prepare('UPDATE users SET is_verified = NOT is_verified WHERE id = ?').run(id);
    if (req.headers['hx-request']) {
      const c = db.prepare('SELECT id, is_verified, is_active FROM users WHERE id = ?').get(id) as any;
      res.render('partials/_admin-contractor-actions', { c, prefix: req.body.prefix || '' });
      return;
    }
    res.redirect('/admin/contractors');
  });

  apiRouter.post('/contractors/:id/toggle-active', (req: Request, res: Response): void => {
    const id = parseInt(req.params.id as string, 10);
    db.prepare('UPDATE users SET is_active = NOT is_active WHERE id = ?').run(id);
    if (req.headers['hx-request']) {
      const c = db.prepare('SELECT id, is_verified, is_active FROM users WHERE id = ?').get(id) as any;
      res.render('partials/_admin-contractor-actions', { c, prefix: req.body.prefix || '' });
      return;
    }
    res.redirect('/admin/contractors');
  });

  apiRouter.post('/contractors/:id/services/:serviceId/toggle', (req: Request, res: Response): void => {
    const contractorId = parseInt(req.params.id as string, 10);
    const serviceId = parseInt(req.params.serviceId as string, 10);
    const service = db.prepare('SELECT cs.id, cs.is_active, c.slug as display_name FROM contractor_services cs JOIN categories c ON c.id = cs.category_id WHERE cs.id = ? AND cs.contractor_id = ?').get(serviceId, contractorId) as any;
    if (service) {
      db.prepare('UPDATE contractor_services SET is_active = NOT is_active WHERE id = ?').run(serviceId);
      service.is_active = !service.is_active;
    }
    if (req.headers['hx-request']) {
      res.render('admin/partials/_service-toggle', { ...res.locals, s: { id: contractorId }, svc: service });
      return;
    }
    res.redirect('/admin/contractors');
  });

  apiRouter.post('/contractors/:id/add-credits', (req: Request, res: Response): void => {
    const contractorId = parseInt(req.params.id as string, 10);
    const amount = parseInt(req.body.amount as string, 10) || 5;
    if (amount <= 0 || amount > 100) {
      if (req.headers['hx-request']) {
        const c = db.prepare('SELECT id, is_verified, is_active FROM users WHERE id = ?').get(contractorId) as any;
        res.render('partials/_admin-contractor-actions', { c, prefix: req.body.prefix || '' });
        return;
      }
      res.redirect('/admin/contractors?error=invalid_credits');
      return;
    }
    db.prepare('UPDATE users SET credits = credits + ? WHERE id = ?').run(amount, contractorId);
    if (req.headers['hx-request']) {
      const c = db.prepare('SELECT id, is_verified, is_active FROM users WHERE id = ?').get(contractorId) as any;
      res.render('partials/_admin-contractor-actions', { c, prefix: req.body.prefix || '' });
      return;
    }
    res.redirect('/admin/contractors?success=credits_added');
  });

  // ── Users API ──

  apiRouter.post('/users/:id/update-role', (req: Request, res: Response): void => {
    const id = parseInt(req.params.id as string, 10);
    const { role } = req.body;
    if (role === 'admin' || role === 'client' || role === 'contractor') {
      const user = db.prepare('SELECT email, role, name, is_contractor FROM users WHERE id = ?').get(id) as any;
      if (user && user.role !== role) {
        db.transaction(() => {
          const isCurrentlyContractor = user.role === 'contractor' || user.is_contractor;
          const willBeContractor = role === 'contractor';
          db.prepare('UPDATE users SET role = ?, is_contractor = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(role, willBeContractor ? 1 : 0, id);
        })();
      }
    }
    if (req.headers['hx-request']) {
      const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
      res.render('partials/_admin-user-actions', { user: updatedUser });
      return;
    }
    res.redirect('/admin/users');
  });

  apiRouter.post('/users/:id/delete', (req: Request, res: Response): void => {
    const id = parseInt(req.params.id as string, 10);
    const user = db.prepare('SELECT email, role FROM users WHERE id = ? AND deleted_at IS NULL').get(id) as any;
    if (user) {
      db.transaction(() => {
        db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
        db.prepare('DELETE FROM magic_links WHERE email = ?').run(user.email);
        db.prepare('UPDATE users SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
      })();
    }
    if (req.headers['hx-request']) {
      res.set('HX-Redirect', '/admin/users');
      res.status(200).send('');
      return;
    }
    res.redirect('/admin/users');
  });

  apiRouter.post('/users/:id/toggle-active', (req: Request, res: Response): void => {
    const id = parseInt(req.params.id as string, 10);
    db.prepare('UPDATE users SET is_active = COALESCE(NOT is_active, 1) WHERE id = ? AND deleted_at IS NULL').run(id);
    if (req.headers['hx-request']) {
      res.set('HX-Trigger', JSON.stringify({ showNotification: { msg: 'User status toggled', type: 'success' } }));
      res.set('HX-Refresh', 'true');
      res.status(200).send('');
      return;
    }
    res.redirect('/admin/users');
  });

  apiRouter.post('/users/:id/restore', (req: Request, res: Response): void => {
    const id = parseInt(req.params.id as string, 10);
    db.prepare('UPDATE users SET deleted_at = NULL WHERE id = ?').run(id);
    if (req.headers['hx-request']) {
      res.set('HX-Trigger', JSON.stringify({ showNotification: { msg: 'User restored', type: 'success' } }));
      res.status(200).send('');
      return;
    }
    res.redirect('/admin/trash');
  });

  apiRouter.post('/users/:id/force-delete', (req: Request, res: Response): void => {
    const id = parseInt(req.params.id as string, 10);
    const user = db.prepare('SELECT email FROM users WHERE id = ?').get(id) as any;
    if (user) {
      db.transaction(() => {
        db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
        db.prepare('DELETE FROM magic_links WHERE email = ?').run(user.email);
        db.prepare('DELETE FROM users WHERE id = ?').run(id);
      })();
    }
    if (req.headers['hx-request']) {
      res.set('HX-Trigger', JSON.stringify({ showNotification: { msg: 'User permanently deleted', type: 'success' } }));
      res.status(200).send('');
      return;
    }
    res.redirect('/admin/trash');
  });
}
