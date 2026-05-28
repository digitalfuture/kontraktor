import express, { Request, Response } from 'express';
import db from '../db';
import { getDistrictDisplay } from '../lib/districts';
import districtsData from '../data/districts.json';
import provinceCentroids from '../data/province-centroids.json';

const router: express.Router = express.Router();

const PAGE_SIZE = 10;

function makeT(res: Response): (key: string) => string {
  return (key: string): string => {
    const keys = key.split('.');
    const dict: Record<string, unknown> = res.locals.dict || {};
    let val: unknown = dict;
    for (const k of keys) { if (val && typeof val === 'object' && k in val) val = (val as Record<string, unknown>)[k]; else return key; }
    return typeof val === 'string' ? val : key;
  };
}

function getPagination(req: Request, total: number) {
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const offset = (page - 1) * PAGE_SIZE;
  return { page, totalPages, offset };
}

function localizedName(
  record: { name?: string; name_en?: string | null; name_id?: string | null },
  locale: string
): string {
  if (locale === 'id' && record.name_id) return record.name_id;
  if (locale === 'en' && record.name_en) return record.name_en;
  return record.name || '';
}

// Admin Dashboard
router.get('/', (req: Request, res: Response): void => {
  const locale = (res.locals.locale as string) || 'en';
  const _t = makeT(res);
  const totalProjects: { count: number } = db.prepare('SELECT COUNT(*) as count FROM projects').get() as { count: number };
  const totalContractors: { count: number } = db.prepare('SELECT COUNT(*) as count FROM contractors').get() as { count: number };
  const totalUsers: { count: number } = db.prepare('SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL').get() as { count: number };
  const totalClients: { count: number } = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'client' AND deleted_at IS NULL").get() as { count: number };
  const totalReviews: { count: number } = db.prepare('SELECT COUNT(*) as count FROM reviews').get() as { count: number };
  const pendingProjects: { count: number } = db.prepare("SELECT COUNT(*) as count FROM projects WHERE status = 'pending'").get() as { count: number };
  const unmoderatedReviews: { count: number } = db.prepare("SELECT COUNT(*) as count FROM reviews WHERE is_moderated = 0").get() as { count: number };

  const recentProjects = db.prepare(`
    SELECT p.id, p.title, p.contact_name, p.status, p.district, p.created_at, c.name as category_name, c.name_en, c.name_id
    FROM projects p
    LEFT JOIN categories c ON p.category = c.slug
    ORDER BY p.created_at DESC
    LIMIT 10
  `).all();

  const recentUsers = db.prepare(`
    SELECT id, email, name, role, created_at
    FROM users
    ORDER BY created_at DESC
    LIMIT 10
  `).all();

  // Category breakdown for charts
  const categoryStats = db.prepare(`
    SELECT c.slug, c.name_en, c.name_id, COUNT(p.id) as count
    FROM categories c
    LEFT JOIN projects p ON p.category = c.slug
    WHERE c.is_active = 1
    GROUP BY c.slug, c.name_en, c.name_id
    ORDER BY count DESC
  `).all() as any[];

  // Role breakdown for charts (contractors in separate table)
  const roleStats = db.prepare(`
    SELECT role, COUNT(*) as count FROM (
      SELECT role FROM users WHERE deleted_at IS NULL
      UNION ALL
      SELECT 'contractor' as role FROM contractors WHERE is_active = 1
    ) GROUP BY role
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
      category_name: localizedName(r, locale),
      district_display: getDistrictDisplay(r.district, locale),
    })),
    recentUsers,
    categoryStats: categoryStats.map((c: any) => ({
      name: localizedName(c, locale),
      count: c.count
    })),
    roleStats
  });
});

// Admin Projects
router.get('/projects', (req: Request, res: Response): void => {
  const locale = (res.locals.locale as string) || 'en';
  const total: { count: number } = db.prepare('SELECT COUNT(*) as count FROM projects').get() as { count: number };
  const { page, totalPages, offset } = getPagination(req, total.count);

  const projects = db.prepare(`
    SELECT p.id, p.title, p.description, p.contact_name, p.contact_phone, p.status, p.district, p.address, p.created_at,
           c.name as category_name, c.name_en, c.name_id
    FROM projects p
    LEFT JOIN categories c ON p.category = c.slug
    ORDER BY p.created_at DESC
    LIMIT ? OFFSET ?
  `).all(PAGE_SIZE, offset);

  const contractors = db.prepare('SELECT id, name, email FROM contractors WHERE is_active = 1 ORDER BY name').all();

  res.render('admin/orders', {
    title: (locale === 'id' ? 'Proyek — Admin' : 'Projects — Admin') + ' — Kontraktor',
    orders: (projects as any[]).map((r: any) => ({
      ...r,
      category_name: localizedName(r, locale),
      district_display: getDistrictDisplay(r.district, locale),
    })),
    contractors,
    pagination: { page, totalPages, total: total.count }
  });
});

// Admin Contractors
router.get('/contractors', (req: Request, res: Response): void => {
  const locale = (res.locals.locale as string) || 'en';
  const total: { count: number } = db.prepare('SELECT COUNT(*) as count FROM contractors').get() as { count: number };
  const { page, totalPages, offset } = getPagination(req, total.count);

  const contractors = db.prepare(`
    SELECT id, email, name, phone, rating, reviews_count, completed_projects, is_verified, is_active, created_at
    FROM contractors
    ORDER BY rating DESC
    LIMIT ? OFFSET ?
  `).all(PAGE_SIZE, offset);

  res.render('admin/contractors', {
    title: (locale === 'id' ? 'Kontraktor — Admin' : 'Contractors — Admin') + ' — Kontraktor',
    contractors: contractors,
    activePage: 'contractors',
    pagination: { page, totalPages, total: total.count }
  });
});

// Admin Categories
router.get('/categories', (req: Request, res: Response): void => {
  const locale = (res.locals.locale as string) || 'en';
  const categories = db.prepare(`
    SELECT id, name, slug, description, is_active, name_en, name_id, description_en, description_id,
           (SELECT COUNT(*) FROM subcategories WHERE category_id = c.id) as sub_count
    FROM categories c
    WHERE deleted_at IS NULL
    ORDER BY name
  `).all();

  res.render('admin/categories', {
    title: (locale === 'id' ? 'Kategori — Admin' : 'Categories — Admin') + ' — Kontraktor',
    categories: categories.map((c: any) => ({
      ...c,
      display_name: localizedName(c, locale)
    }))
  });
});

// Admin Reviews
router.get('/reviews', (req: Request, res: Response): void => {
  const locale = (res.locals.locale as string) || 'en';
  const total: { count: number } = db.prepare('SELECT COUNT(*) as count FROM reviews').get() as { count: number };
  const { page, totalPages, offset } = getPagination(req, total.count);

  const reviews = db.prepare(`
    SELECT r.id, r.author_email, r.contractor_id, r.client_email, r.rating, r.comment, 
           r.is_moderated, r.is_approved, r.created_at,
           c.name as contractor_name
    FROM reviews r
    LEFT JOIN contractors c ON r.contractor_id = c.id
    ORDER BY r.created_at DESC
    LIMIT ? OFFSET ?
  `).all(PAGE_SIZE, offset);

  res.render('admin/reviews', {
    title: (locale === 'id' ? 'Ulasan — Admin' : 'Reviews — Admin') + ' — Kontraktor',
    reviews,
    pagination: { page, totalPages, total: total.count }
  });
});

// === POST endpoints ===

// Update project status
router.post('/projects/:id/status', (req: Request, res: Response): void => {
  const id = parseInt(req.params.id as string, 10);
  const status = req.body.status;
  if (!['pending', 'active', 'in_progress', 'completed', 'cancelled'].includes(status)) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }
  db.prepare('UPDATE projects SET status = ? WHERE id = ?').run(status, id);
  res.redirect('/admin/projects');
});

// Assign contractor to project
router.post('/projects/:id/assign', (req: Request, res: Response): void => {
  const id = parseInt(req.params.id as string, 10);
  const contractorId = parseInt(req.body.contractor_id as string, 10);
  db.prepare('UPDATE projects SET assigned_contractor_id = ?, status = ? WHERE id = ?').run(contractorId, 'in_progress', id);
  res.redirect('/admin/projects');
});

// Approve/reject review
router.post('/reviews/:id/moderate', (req: Request, res: Response): void => {
  const id = parseInt(req.params.id as string, 10);
  const action = req.body.action; // 'approve' or 'reject'
  if (action === 'approve') {
    db.prepare('UPDATE reviews SET is_moderated = 1, is_approved = 1 WHERE id = ?').run(id);
  } else {
    db.prepare('UPDATE reviews SET is_moderated = 1, is_approved = 0 WHERE id = ?').run(id);
  }
  res.redirect('/admin/reviews');
});

// Delete review
router.post('/reviews/:id/delete', (req: Request, res: Response): void => {
  const id = parseInt(req.params.id as string, 10);
  db.prepare('DELETE FROM reviews WHERE id = ?').run(id);
  res.redirect('/admin/reviews');
});

// Create category
router.post('/categories/create', (req: Request, res: Response): void => {
  const { name_en, name_id, slug, description_en, description_id } = req.body;
  if (!name_en || !slug) {
    res.redirect('/admin/categories');
    return;
  }
  db.prepare(`
    INSERT INTO categories (name, name_en, name_id, slug, description_en, description_id, is_active)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `).run(name_en, name_en, name_id || name_en, slug, description_en || '', description_id || '');
  res.redirect('/admin/categories');
});

// Update category
router.post('/categories/:id/update', (req: Request, res: Response): void => {
  const id = parseInt(req.params.id as string, 10);
  const { name_en, name_id, description_en, description_id, is_active } = req.body;
  db.prepare(`
    UPDATE categories SET name_en = ?, name_id = ?, description_en = ?, description_id = ?, is_active = ?
    WHERE id = ?
  `).run(name_en, name_id || name_en, description_en || '', description_id || '', is_active ? 1 : 0, id);
  res.redirect('/admin/categories');
});

// Toggle category active
router.post('/categories/:id/toggle', (req: Request, res: Response): void => {
  const id = parseInt(req.params.id as string, 10);
  db.prepare('UPDATE categories SET is_active = NOT is_active WHERE id = ?').run(id);
  res.redirect('/admin/categories');
});

// Delete category (Soft Delete)
router.post('/categories/:id/delete', (req: Request, res: Response): void => {
  const id = parseInt(req.params.id as string, 10);
  db.prepare('UPDATE categories SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
  res.redirect('/admin/categories');
});

// Admin Categories Trash
router.get('/trash', (req: Request, res: Response): void => {
  const locale = (res.locals.locale as string) || 'en';
  const categories = db.prepare(`
    SELECT id, name, slug, description, is_active, name_en, name_id, description_en, description_id, deleted_at,
           (SELECT COUNT(*) FROM subcategories WHERE category_id = c.id) as sub_count
    FROM categories c
    WHERE deleted_at IS NOT NULL
    ORDER BY deleted_at DESC
  `).all();

  const users = db.prepare(`
    SELECT id, email, name, role, created_at, deleted_at
    FROM users
    WHERE deleted_at IS NOT NULL
    ORDER BY deleted_at DESC
  `).all();

  res.render('admin/trash', {
    title: (locale === 'id' ? 'Tempat Sampah — Admin' : 'Trash — Admin') + ' — Kontraktor',
    categories: categories.map((c: any) => ({
      ...c,
      display_name: localizedName(c, locale)
    })),
    users
  });
});

// Restore category
router.post('/categories/:id/restore', (req: Request, res: Response): void => {
  const id = parseInt(req.params.id as string, 10);
  db.prepare('UPDATE categories SET deleted_at = NULL WHERE id = ?').run(id);
  res.redirect('/admin/trash');
});

// Force delete category
router.post('/categories/:id/force-delete', (req: Request, res: Response): void => {
  const id = parseInt(req.params.id as string, 10);
  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  res.redirect('/admin/trash');
});

// Verify/block contractor
router.post('/contractors/:id/toggle-verified', (req: Request, res: Response): void => {
  const id = parseInt(req.params.id as string, 10);
  db.prepare('UPDATE contractors SET is_verified = NOT is_verified WHERE id = ?').run(id);
  res.redirect('/admin/contractors');
});

router.post('/contractors/:id/toggle-active', (req: Request, res: Response): void => {
  const id = parseInt(req.params.id as string, 10);
  db.prepare('UPDATE contractors SET is_active = NOT is_active WHERE id = ?').run(id);
  res.redirect('/admin/contractors');
});

// Add credits to contractor (admin only)
router.post('/contractors/:id/add-credits', (req: Request, res: Response): void => {
  const contractorId = parseInt(req.params.id as string, 10);
  const amount = parseInt(req.body.amount as string, 10) || 5;
  
  if (amount <= 0 || amount > 100) {
    res.redirect('/admin/contractors?error=invalid_credits');
    return;
  }
  
  db.prepare('UPDATE contractors SET credits = credits + ? WHERE id = ?').run(amount, contractorId);
  res.redirect('/admin/contractors?success=credits_added');
});

// Admin Users List
router.get('/users', (req: Request, res: Response): void => {
  const locale = (res.locals.locale as string) || 'en';
  const total: { count: number } = db.prepare('SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL').get() as { count: number };
  const { page, totalPages, offset } = getPagination(req, total.count);

  const users = db.prepare(`
    SELECT id, email, name, phone, role, telegram_id, is_verified, created_at,
      (SELECT COUNT(*) FROM projects WHERE client_email = users.email) as projects_count,
      (SELECT credits FROM contractors WHERE email = users.email) as contractor_credits
    FROM users
    WHERE deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(PAGE_SIZE, offset);

  res.render('admin/users', {
    title: (locale === 'id' ? 'Pengguna — Admin' : 'Users — Admin') + ' — Kontraktor',
    users,
    activePage: 'users',
    pagination: { page, totalPages, total: total.count }
  });
});

// Update user role
router.post('/users/:id/update-role', (req: Request, res: Response): void => {
  const id = parseInt(req.params.id as string, 10);
  const { role } = req.body;
  if (role === 'admin' || role === 'client' || role === 'contractor') {
    const user = db.prepare('SELECT email, role, name FROM users WHERE id = ?').get(id) as any;
    if (user && user.role !== role) {
      db.transaction(() => {
        // If changing from specialist to something else, remove from contractors
        if (user.role === 'contractor') {
          db.prepare('DELETE FROM contractors WHERE email = ?').run(user.email);
        }
        // If changing to specialist/contractor, ensure they are seeded in contractors table
        if (role === 'contractor') {
          const exists = db.prepare('SELECT 1 FROM contractors WHERE email = ?').get(user.email);
          if (!exists) {
            db.prepare('INSERT INTO contractors (email, name, credits) VALUES (?, ?, 3)').run(user.email, user.name || 'Contractor');
          }
        }
        // Update role
        db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
      })();
    }
  }
  res.redirect('/admin/users');
});

// Soft-delete user (moves to trash)
router.post('/users/:id/delete', (req: Request, res: Response): void => {
  const id = parseInt(req.params.id as string, 10);
  const user = db.prepare('SELECT email, role FROM users WHERE id = ? AND deleted_at IS NULL').get(id) as any;
  if (user) {
    db.transaction(() => {
      // Revoke all active sessions so the user is logged out
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
      db.prepare('DELETE FROM magic_links WHERE email = ?').run(user.email);
      // Mark user as deleted
      db.prepare('UPDATE users SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
    })();
  }
  res.redirect('/admin/users');
});

// Restore user from trash
router.post('/users/:id/restore', (req: Request, res: Response): void => {
  const id = parseInt(req.params.id as string, 10);
  db.prepare('UPDATE users SET deleted_at = NULL WHERE id = ?').run(id);
  res.redirect('/admin/trash');
});

// Permanently delete user
router.post('/users/:id/force-delete', (req: Request, res: Response): void => {
  const id = parseInt(req.params.id as string, 10);
  const user = db.prepare('SELECT email FROM users WHERE id = ?').get(id) as any;
  if (user) {
    db.transaction(() => {
      db.prepare('DELETE FROM contractors WHERE email = ?').run(user.email);
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
      db.prepare('DELETE FROM magic_links WHERE email = ?').run(user.email);
      db.prepare('DELETE FROM users WHERE id = ?').run(id);
    })();
  }
  res.redirect('/admin/trash');
});

// ============ PAYMENTS ============

// Get Xendit configured status from env
function isXenditConfigured(): boolean {
  return !!(process.env.XENDIT_API_KEY || process.env.XENDIT_SECRET_KEY);
}

// Get credit packages (defaults from payments.ts, overridable via DB settings)
function getCreditPackages(): Array<{label: string, credits: number, price: number}> {
  const defaults = [
    { label: 'Starter', credits: 10, price: 50000 },
    { label: 'Popular', credits: 30, price: 120000 },
    { label: 'Pro', credits: 100, price: 350000 },
  ];
  try {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'credit_packages'").get() as any;
    if (row) {
      const overrides = JSON.parse(row.value);
      return defaults.map((pkg, i) => ({
        ...pkg,
        price: overrides[i]?.price ?? pkg.price,
      }));
    }
  } catch {}
  return defaults;
}

// Payment list
router.get('/payments', (req: Request, res: Response): void => {
  const locale = (res.locals.locale as string) || 'en';

  const status = (req.query.status as string) || '';
  const search = (req.query.search as string) || '';

  let where = 'WHERE 1=1';
  const params: any[] = [];

  if (status) {
    where += ' AND p.status = ?';
    params.push(status);
  }
  if (search) {
    where += ' AND (c.name LIKE ? OR c.email LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  const total: { count: number } = db.prepare(`
    SELECT COUNT(*) as count
    FROM payments p
    LEFT JOIN contractors c ON p.contractor_id = c.id
    ${where}
  `).get(...params) as { count: number };

  const { page, totalPages, offset } = getPagination(req, total.count);

  const payments = db.prepare(`
    SELECT p.*, c.name as contractor_name, c.email as contractor_email
    FROM payments p
    LEFT JOIN contractors c ON p.contractor_id = c.id
    ${where}
    ORDER BY p.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, PAGE_SIZE, offset);

  res.render('admin/payments', {
    title: (locale === 'id' ? 'Pembayaran — Admin' : 'Payments — Admin') + ' — Kontraktor',
    payments: payments || [],
    search: search || '',
    selectedStatus: status || '',
    activePage: 'payments',
    pagination: { page, totalPages, total: total.count },
    currentPage: page,
    statusFilter: status,
    searchQuery: search
  });
});

// Payment settings page
router.get('/payments/settings', (req: Request, res: Response): void => {
  const locale = (res.locals.locale as string) || 'en';

  const packages = getCreditPackages();
  const xenditConfigured = isXenditConfigured();

  res.render('admin/payment-settings', {
    title: (locale === 'id' ? 'Pengaturan Pembayaran — Admin' : 'Payment Settings — Admin') + ' — Kontraktor',
    packages,
    xenditConfigured,
    activePage: 'payments',
  });
});

// Save payment settings
router.post('/payments/settings', (req: Request, res: Response): void => {
  const { packages } = req.body;
  if (packages && Array.isArray(packages)) {
    const overrides = packages.map(p => ({ price: parseInt(String(p.price), 10) || 0 }));
    db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES ('credit_packages', ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `).run(JSON.stringify(overrides));
  }
  res.redirect('/admin/payments/settings');
});

// API Endpoint for Sankey Diagram Data
router.get('/api/sankey', (req: Request, res: Response): void => {
  try {
    const lang = (req.query.lang as string) || 'id';
    const projects = db.prepare(`
      SELECT p.id, p.title,
             COALESCE(p.contact_name, p.client_email, 'Unknown') as client_name,
             COALESCE(c.name, c.email, NULL) as contractor_name
      FROM projects p
      LEFT JOIN contractors c ON p.assigned_contractor_id = c.id
      WHERE p.status IN ('pending', 'in_progress')
    `).all() as any[];

    if (projects.length === 0) {
      res.json({ nodes: [], links: [] });
      return;
    }

    // Collect unique clients and contractors
    const clientMap = new Map<string, number>();
    const contractorMap = new Map<string, number>();
    const nodes: { name: string; type: string }[] = [];
    const links: { source: number; target: number; value: number }[] = [];

    projects.forEach((p: any) => {
      // Client node
      const cname = p.client_name || 'Unknown';
      if (!clientMap.has(cname)) {
        clientMap.set(cname, nodes.length);
        nodes.push({ name: cname, type: 'client' });
      }

      // Project node
      const pIdx = nodes.length;
      const pname = lang === 'en' ? (p.title || `Project #${p.id}`) : (p.title || `Proyek #${p.id}`);
      nodes.push({ name: pname, type: 'project' });

      // Client → Project link
      links.push({ source: clientMap.get(cname)!, target: pIdx, value: 1 });

      // Contractor node + link
      if (p.contractor_name) {
        const tname = p.contractor_name;
        if (!contractorMap.has(tname)) {
          contractorMap.set(tname, nodes.length);
          nodes.push({ name: tname, type: 'contractor' });
        }
        links.push({ source: pIdx, target: contractorMap.get(tname)!, value: 1 });
      }
    });

    res.json({ nodes, links });
  } catch (err) {
    console.error('Error generating sankey data:', err);
    res.status(500).json({ error: 'Failed to generate sankey data' });
  }
});

// API Endpoint for Category→Status Sankey (Diagrams page)
router.get('/api/sankey-category-status', (req: Request, res: Response): void => {
  try {
    const _lang = (req.query.lang as string) || 'id';
    const sankeyData = db.prepare(`
      SELECT c.name_en as category_en, c.name_id as category_id, p.status, COUNT(*) as count
      FROM projects p
      JOIN categories c ON p.category = c.slug
      GROUP BY c.slug, p.status
    `).all() as any[];

    if (sankeyData.length === 0) {
      res.json({ nodes: [], links: [] });
      return;
    }

    const categories = [...new Set(sankeyData.map((d: any) => d.category_en))];
    const statuses = [...new Set(sankeyData.map((d: any) => d.status))];

    const nodes = [
      ...categories.map((c: string) => ({ name: c, type: 'category' })),
      ...statuses.map((s: string) => ({ name: s, type: 'status' }))
    ];

    const links = sankeyData.map((d: any) => ({
      source: categories.indexOf(d.category_en),
      target: categories.length + statuses.indexOf(d.status),
      value: d.count
    }));

    res.json({ nodes, links });
  } catch (err) {
    console.error('Error generating category-status sankey:', err);
    res.status(500).json({ error: 'Failed to generate sankey data' });
  }
});

// API Endpoint for Map Data (Indonesia projects by province)
router.get('/api/map', (req: Request, res: Response): void => {
  try {
    const projects = db.prepare(`
      SELECT p.id, p.title, p.status, p.district,
             COALESCE(p.contact_name, p.client_email, 'Unknown') as client_name
      FROM projects p
      WHERE p.district IS NOT NULL AND p.district != ''
    `).all() as any[];

    // Build district -> province lookup (both exact and partial)
    const districtToProvince = new Map<string, string>();
    (districtsData as any[]).forEach((d: any) => {
      districtToProvince.set(d.name, d.province);
      // Also store without common suffixes for fuzzy matching
      const short = d.name.replace(/ (City|Regency|Municipality)$/i, '');
      if (!districtToProvince.has(short)) districtToProvince.set(short, d.province);
    });

    // Group projects by province
    const provinceMap = new Map<string, { projects: any[]; lat: number; lng: number }>();
    projects.forEach((p: any) => {
      const province = districtToProvince.get(p.district) || 'Unknown';
      const centroid = (provinceCentroids as any)[province];
      if (!centroid) return;
      if (!provinceMap.has(province)) {
        provinceMap.set(province, { projects: [], lat: centroid[0], lng: centroid[1] });
      }
      provinceMap.get(province)!.projects.push({
        id: p.id,
        title: p.title,
        status: p.status,
        client: p.client_name,
        district: p.district,
      });
    });

    const markers = Array.from(provinceMap.entries()).map(([province, data]) => ({
      province,
      lat: data.lat,
      lng: data.lng,
      total: data.projects.length,
      pending: data.projects.filter(p => p.status === 'pending').length,
      accepted: data.projects.filter(p => ['in_progress', 'completed'].includes(p.status)).length,
      projects: data.projects,
    }));

    res.json({ markers });
  } catch (err) {
    console.error('Error generating map data:', err);
    res.status(500).json({ error: 'Failed to generate map data' });
  }
});

// API Endpoint for Cosmograph Network Data
router.get('/api/network-graph', (req: Request, res: Response): void => {
  try {
    const users = db.prepare('SELECT email as id, name as label, role as "group" FROM users').all() as any[];
    const contractors = db.prepare(`SELECT email as id, name as label, 'contractor' as "group" FROM contractors`).all() as any[];
    
    const nodesMap = new Map();
    users.forEach(u => nodesMap.set(u.id, u));
    contractors.forEach(c => {
      if (!nodesMap.has(c.id)) {
        nodesMap.set(c.id, c);
      } else {
        nodesMap.get(c.id).group = 'contractor';
      }
    });
    
    const nodes = Array.from(nodesMap.values());
    
    const projectLinks = db.prepare(`
      SELECT p.client_email as source, c.email as target
      FROM projects p
      JOIN contractors c ON p.assigned_contractor_id = c.id
      WHERE p.client_email IS NOT NULL AND c.email IS NOT NULL
    `).all() as { source: string, target: string }[];
    
    const reviewLinks = db.prepare(`
      SELECT r.author_email as source, c.email as target
      FROM reviews r
      JOIN contractors c ON r.contractor_id = c.id
      WHERE r.author_email IS NOT NULL AND c.email IS NOT NULL
    `).all() as { source: string, target: string }[];
    
    const links = [...projectLinks, ...reviewLinks];
    
    res.json({ nodes, links });
  } catch (err) {
    console.error('Error generating network graph:', err);
    res.status(500).json({ error: 'Failed to generate network graph data' });
  }
});

// Admin Diagrams & Charts
router.get('/diagrams', (req: Request, res: Response): void => {
  const _t = makeT(res);

  // Chart data (same as dashboard)
  const categoryStats = db.prepare(`
    SELECT c.slug, c.name_en, c.name_id, COUNT(p.id) as count
    FROM categories c
    LEFT JOIN projects p ON p.category = c.slug
    WHERE c.is_active = 1
    GROUP BY c.slug, c.name_en, c.name_id
    ORDER BY count DESC
  `).all() as any[];

  const roleStats = db.prepare(`
    SELECT role, COUNT(*) as count FROM (
      SELECT role FROM users WHERE deleted_at IS NULL
      UNION ALL
      SELECT 'contractor' as role FROM contractors WHERE is_active = 1
    ) GROUP BY role
  `).all() as any[];

  res.render('admin/diagrams', {
    title: _t('admin.diagrams') + ' — Kontraktor',
    categoryStats,
    roleStats,
    activePage: 'diagrams',
  });
});

// Serve generated sitemap HTML as a string via API
router.get('/diagrams/sitemap-content', (req: Request, res: Response): void => {
  const fs = require('fs');
  const path = require('path');
  const sitemapPath = path.join(__dirname, '../../docs/sitemap.html');
  try {
    const content = fs.readFileSync(sitemapPath, 'utf-8');
    res.send(content);
  } catch {
    res.status(404).send('Sitemap not generated yet. Run: npm run generate-sitemap');
  }
});

export default router;

