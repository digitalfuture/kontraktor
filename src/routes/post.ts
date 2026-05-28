import express, { Request, Response } from 'express';
import db from '../db';
import { optionalAuth } from '../middleware/auth';
import districtsData from '../data/districts.json';
import { getDistrictDisplay } from '../lib/districts';
import { requireAuth } from '../middleware/auth';
import { sendNewBidNotification, sendBidAcceptedNotification } from '../lib/telegram';
import { sendNewBidEmail, sendBidAcceptedEmail, sendProjectCompletedEmail, isEmailConfigured } from '../lib/email';

const router: express.Router = express.Router();

// === GET routes ===

router.get('/', (req: Request, res: Response): void => {
  const locale = (res.locals.locale as string) || 'en';
  const categories = db.prepare('SELECT id, name, slug, name_en, name_id FROM categories WHERE is_active = 1 ORDER BY name').all();

  res.render('post', {
    title: locale === 'id' ? 'Pasang Proyek — Kontraktor' : 'Post a Project — Kontraktor',
    categories: categories.map((c: any) => ({
      ...c,
      display_name: (locale === 'id' && c.name_id) ? c.name_id : (locale === 'en' && c.name_en) ? c.name_en : c.name
    })),
    districtsData: districtsData,
  });
});

// === EDIT ROUTES (must be before /:id) ===

// Edit form (GET)
router.get('/:id/edit', requireAuth, (req: any, res: Response): void => {
  const locale = (res.locals.locale as string) || 'en';
  const t = (res.locals.t as (key: string) => string) || ((key: string) => key);
  const id = parseInt(req.params.id, 10);
  const user = req.user;

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as any;
  if (!project) { res.status(404).render('error', { title: 'Not Found', message: 'Project not found' }); return; }

  // Only owner can edit
  if (project.client_email !== user.email) {
    res.status(403).render('error', { title: 'Forbidden', message: 'You can only edit your own projects' });
    return;
  }

  // Cannot edit if contractor already assigned
  if (project.assigned_contractor_id) {
    res.status(403).render('error', { title: 'Forbidden', message: t('projects.editLocked') });
    return;
  }

  const categories = db.prepare('SELECT id, name, slug, name_en, name_id FROM categories WHERE is_active = 1 ORDER BY name').all();
  project.district_display = getDistrictDisplay(project.district, locale);

  // Map DB fields to formData format for the template
  const formData = {
    title: project.title || '',
    description: project.description || '',
    category: project.category || '',
    subcategory: project.subcategory || '',
    contactName: project.contact_name || '',
    contactPhone: project.contact_phone || '',
    district: getDistrictDisplay(project.district, locale) || '',
    district_en: project.district || '',
    address: project.address || '',
  };

  res.render('post', {
    title: locale === 'id' ? 'Edit Proyek — Kontraktor' : 'Edit Project — Kontraktor',
    categories: (categories as any[]).map((c: any) => ({
      ...c,
      display_name: (locale === 'id' && c.name_id) ? c.name_id : (locale === 'en' && c.name_en) ? c.name_en : c.name
    })),
    districtsData,
    editMode: true,
    project,
    formData,
  });
});

// Edit form (POST)
router.post('/:id/edit', requireAuth, (req: any, res: Response): void => {
  const locale = (res.locals.locale as string) || 'en';
  const t = (res.locals.t as (key: string) => string) || ((key: string) => key);
  const id = parseInt(req.params.id, 10);
  const user = req.user;

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as any;
  if (!project) { res.status(404).render('error', { title: 'Not Found', message: 'Project not found' }); return; }
  if (project.client_email !== user.email) {
    res.status(403).render('error', { title: 'Forbidden', message: 'You can only edit your own projects' });
    return;
  }
  if (project.assigned_contractor_id) {
    res.status(403).render('error', { title: 'Forbidden', message: t('projects.editLocked') });
    return;
  }

  const errors: string[] = [];
  const formData = {
    title: (req.body.title || '').trim(),
    description: (req.body.description || '').trim(),
    category: req.body.category || '',
    subcategory: req.body.subcategory || '',
    contactName: (req.body.contactName || '').trim(),
    contactPhone: (req.body.contactPhone || '').trim(),
    district: (req.body.district || '').trim(),
    district_en: (req.body.district_en || '').trim(),
    address: (req.body.address || '').trim(),
  };

  if (!formData.title) errors.push(t('post.titleRequired'));
  if (!formData.description) errors.push(t('post.descriptionRequired'));
  if (!formData.category) errors.push(t('post.categoryRequired'));
  if (!formData.contactName) errors.push(t('post.nameRequired'));
  if (!formData.contactPhone) errors.push(t('post.phoneRequired'));
  if (!formData.district) errors.push(t('post.districtRequired'));

  if (errors.length > 0) {
    const categories = db.prepare('SELECT id, name, slug, name_en, name_id FROM categories WHERE is_active = 1 ORDER BY name').all();
    project.district_display = getDistrictDisplay(project.district, locale);
    res.render('post', {
      title: locale === 'id' ? 'Edit Proyek — Kontraktor' : 'Edit Project — Kontraktor',
      categories: (categories as any[]).map((c: any) => ({
        ...c,
        display_name: (locale === 'id' && c.name_id) ? c.name_id : (locale === 'en' && c.name_en) ? c.name_en : c.name
      })),
      districtsData,
      editMode: true,
      project: { ...project, ...formData },
      errors,
    });
    return;
  }

  db.prepare(`
    UPDATE projects SET title = ?, description = ?, category = ?, subcategory = ?,
      contact_name = ?, contact_phone = ?, district = ?, address = ?
    WHERE id = ?
  `).run(formData.title, formData.description, formData.category, formData.subcategory || null,
    formData.contactName, formData.contactPhone, formData.district_en || formData.district,
    formData.address || null, id);

  res.redirect(`/post/${id}?lang=${locale}`);
});

// HTMX endpoint: get subcategories for a category (MUST be before /:id)
router.get('/subcategories', (req: Request, res: Response): void => {
  const locale = (res.locals.locale as string) || 'en';
  const categorySlug = req.query.category as string;

  if (!categorySlug) {
    res.status(400).send('');
    return;
  }

  const category = db.prepare('SELECT id FROM categories WHERE slug = ?').get(categorySlug) as { id: number } | undefined;
  if (!category) {
    res.status(404).send('');
    return;
  }

  const subcategories = db.prepare('SELECT id, name, slug, name_en, name_id FROM subcategories WHERE category_id = ? ORDER BY name').all(category.id) as any[];

  const t = (res.locals.t as (key: string) => string) || ((key: string) => key);

  const subcategoryLabel = t('post.subcategoryLabel');
  const selectPlaceholder = 'Select subcategory';

  res.setHeader('Content-Type', 'text/html');
  res.send(`
    <div class="mb-6" id="subcategory-group">
      <label for="subcategory" class="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">${subcategoryLabel}</label>
      <select id="subcategory" name="subcategory" class="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
        <option value="">${selectPlaceholder}</option>
        ${subcategories.map((sub: any) => {
          const name = (locale === 'id' && sub.name_id) ? sub.name_id : (locale === 'en' && sub.name_en) ? sub.name_en : sub.name;
          return `<option value="${sub.slug}">${name}</option>`;
        }).join('')}
      </select>
    </div>
  `);
});

// HTMX endpoint: search district/city
router.get('/district-search', (req: Request, res: Response): void => {
  const q = ((req.query.q as string) || '').toLowerCase().trim();
  if (!q || q.length < 2) { res.send(''); return; }

  const results = (districtsData as any[])
    .filter(k => k.name.toLowerCase().includes(q))
    .slice(0, 15);

  res.setHeader('Content-Type', 'text/html');
  res.send(results.map(k =>
    `<option value="${k.name}">${k.name}, ${k.province}</option>`
  ).join(''));
});

// Project detail page
router.get('/:id', optionalAuth, (req: Request, res: Response): void => {
  const locale = (res.locals.locale as string) || 'en';
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(404).render('error', { title: 'Not Found' }); return; }

  const project = db.prepare(`
    SELECT p.*, 
      c.name_en as category_name_en, c.name_id as category_name_id, c.slug as category_slug,
      s.name_en as subcategory_name_en, s.name_id as subcategory_name_id, s.slug as subcategory_slug,
      con.name as contractor_name, con.id as contractor_id, con.rating as contractor_rating,
      con.phone as contractor_phone, con.specialty as contractor_specialty,
      con.completed_projects as contractor_completed, con.is_verified as contractor_verified,
      con.reviews_count as contractor_reviews_count, con.avatar_url as contractor_avatar
    FROM projects p
    LEFT JOIN categories c ON p.category = c.slug
    LEFT JOIN subcategories s ON p.subcategory = s.slug
    LEFT JOIN contractors con ON p.assigned_contractor_id = con.id
    WHERE p.id = ?
  `).get(id) as any;

  if (!project) { res.status(404).render('error', { title: 'Not Found' }); return; }

  // Localize category/subcategory names
  project.category_display = (locale === 'id' && project.category_name_id) ? project.category_name_id : (locale === 'en' && project.category_name_en) ? project.category_name_en : project.category_slug;
  project.subcategory_display = project.subcategory_slug ? ((locale === 'id' && project.subcategory_name_id) ? project.subcategory_name_id : (locale === 'en' && project.subcategory_name_en) ? project.subcategory_name_en : project.subcategory_slug) : null;
  project.district_display = getDistrictDisplay(project.district, locale);

  // Get bids for this project
  const isOwner = (req as any).user && project.client_email === (req as any).user.email;
  const bids = db.prepare(`
    SELECT b.*, c.name as contractor_name, c.rating as contractor_rating,
      c.reviews_count, c.specialty, c.is_verified, c.completed_projects
    FROM bids b
    JOIN contractors c ON b.contractor_id = c.id
    WHERE b.project_id = ?
    ORDER BY b.created_at ASC
  `).all(id) as any[];

  // Get approved reviews for this project's contractor
  const reviews = db.prepare(`
    SELECT r.rating, r.comment, r.author_email, r.created_at
    FROM reviews r
    WHERE r.contractor_id = ? AND r.is_approved = 1
    ORDER BY r.created_at DESC
    LIMIT 10
  `).all(project.contractor_id || 0) as any[];

  // Check if current user already reviewed this contractor
  const userReviewed = (req as any).user && db.prepare(`
    SELECT id FROM reviews WHERE contractor_id = ? AND client_email = ?
  `).get(project.contractor_id || 0, (req as any).user.email);
  project.reviewed = !!userReviewed;

  // Check if current user (as contractor) already bid
  let hasBid = false;
  let isContractor = false;
  let userCredits = 0;
  if ((req as any).user) {
    const contractor = db.prepare('SELECT id, credits FROM contractors WHERE email = ?').get((req as any).user.email) as any;
    if (contractor) {
      isContractor = true;
      userCredits = contractor.credits || 0;
      hasBid = !!db.prepare('SELECT id FROM bids WHERE project_id = ? AND contractor_id = ?').get(id, contractor.id) as any;
    }
  }

  res.render('project-detail', {
    title: `${project.title} — Kontraktor`,
    project,
    bids,
    reviews,
    locale,
    user: (req as any).user || null,
    isOwner,
    isContractor,
    hasBid,
    userCredits,
    editable: isOwner && !project.assigned_contractor_id,
  });
});

// HTMX endpoint: get bids list partial for real-time auto-polling (owner only)
router.get('/:id/bids-partial', optionalAuth, (req: Request, res: Response): void => {
  const locale = (res.locals.locale as string) || 'en';
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).send('Invalid Project ID'); return; }

  const project = db.prepare('SELECT client_email, status, id FROM projects WHERE id = ?').get(id) as any;
  if (!project) { res.status(404).send('Project Not Found'); return; }

  const isOwner = (req as any).user && project.client_email === (req as any).user.email;
  if (!isOwner) { res.status(403).send('Unauthorized'); return; }

  const bids = db.prepare(`
    SELECT b.*, c.name as contractor_name, c.rating as contractor_rating,
      c.reviews_count, c.specialty, c.is_verified, c.completed_projects
    FROM bids b
    JOIN contractors c ON b.contractor_id = c.id
    WHERE b.project_id = ?
    ORDER BY b.created_at ASC
  `).all(id) as any[];

  res.render('partials/_bids-list', {
    bids,
    project,
    isOwner,
    locale,
    t: (res.locals.t as (key: string) => string) || ((key: string) => key)
  });
});


// === POST routes ===

router.post('/', optionalAuth, (req: Request, res: Response): void => {
  const errors: string[] = [];
  const formData = {
    title: (req.body.title || '').trim(),
    description: (req.body.description || '').trim(),
    category: req.body.category || '',
    subcategory: req.body.subcategory || '',
    contactName: (req.body.contactName || '').trim(),
    contactPhone: (req.body.contactPhone || '').trim(),
    district: (req.body.district || '').trim(),
    district_en: (req.body.district_en || '').trim(),
    address: (req.body.address || '').trim(),
  };

  // Validation
  const locale = (res.locals.locale as string) || 'en';
  const t = (res.locals.t as (key: string) => string) || ((key: string) => key);
  if (!formData.title) errors.push(t('post.titleRequired'));
  if (!formData.description) errors.push(t('post.descriptionRequired'));
  if (!formData.category) errors.push(t('post.categoryRequired'));
  if (!formData.contactName) errors.push(t('post.nameRequired'));
  if (!formData.contactPhone) errors.push(t('post.phoneRequired'));
  if (!formData.district) errors.push(t('post.districtRequired'));

  if (errors.length > 0) {
    const categories = db.prepare('SELECT id, name, slug, name_en, name_id FROM categories WHERE is_active = 1 ORDER BY name').all();
    res.render('post', {
      title: locale === 'id' ? 'Pasang Proyek — Kontraktor' : 'Post a Project — Kontraktor',
      categories: (categories as any[]).map((c: any) => ({
        ...c,
        display_name: (locale === 'id' && c.name_id) ? c.name_id : (locale === 'en' && c.name_en) ? c.name_en : c.name
      })),
      districtsData,
      formData,
      errors,
    });
    return;
  }

  const clientEmail = req.user?.email || null;

  db.prepare(`
    INSERT INTO projects (title, description, category, subcategory, contact_name, contact_phone, district, address, client_email, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `).run(formData.title, formData.description, formData.category, formData.subcategory || null, formData.contactName, formData.contactPhone, formData.district_en || formData.district, formData.address || null, clientEmail);

  // Localize district for display
  const storedDistrict = formData.district_en || formData.district;
  const successFormData = { ...formData, district_display: getDistrictDisplay(storedDistrict, locale) };
  res.render('post-success', {
    title: 'Project Posted — Kontraktor',
    formData: successFormData
  });
});

// === BID ROUTES ===

// Submit a bid on a project (contractors only)
router.post('/:projectId/bid', optionalAuth, (req: Request, res: Response): void => {
  const projectId = parseInt(req.params.projectId as string, 10);
  const user = (req as any).user;
  const locale = (res.locals.locale as string) || 'en';

  if (!user) {
    res.redirect(`/auth/login?redirect=/post/${projectId}`);
    return;
  }

  // Must be registered as contractor
  const contractor = db.prepare('SELECT id FROM contractors WHERE email = ?').get(user.email) as any;
  if (!contractor) {
    res.redirect('/contractors/register');
    return;
  }

  const project = db.prepare('SELECT id, status, client_email FROM projects WHERE id = ?').get(projectId) as any;
  if (!project) {
    res.status(404).render('error', { title: 'Not Found' });
    return;
  }

  if (project.status === 'completed' || project.status === 'cancelled') {
    res.redirect(`/post/${projectId}`);
    return;
  }

  // Cannot bid on own project
  if (project.client_email === user.email) {
    res.redirect(`/post/${projectId}`);
    return;
  }

  // Check if already bid
  const existingBid = db.prepare('SELECT id FROM bids WHERE project_id = ? AND contractor_id = ?').get(projectId, contractor.id) as any;
  if (existingBid) {
    res.redirect(`/post/${projectId}`);
    return;
  }

  const { price, description, estimated_days } = req.body;
  const errors: string[] = [];

  if (!description || !description.trim()) errors.push(locale === 'id' ? 'Deskripsi penawaran diperlukan' : 'Bid description is required');
  if (price && isNaN(Number(price))) errors.push(locale === 'id' ? 'Harga harus berupa angka' : 'Price must be a number');
  if (estimated_days && isNaN(Number(estimated_days))) errors.push(locale === 'id' ? 'Estimasi hari harus berupa angka' : 'Estimated days must be a number');

  if (errors.length > 0) {
    res.redirect(`/post/${projectId}?errors=${encodeURIComponent(errors.join('|'))}`);
    return;
  }

  // Check contractor has credits (3 free bids per month, then pay)
  const contractorInfo = db.prepare('SELECT credits FROM contractors WHERE id = ?').get(contractor.id) as any;
  if (contractorInfo.credits <= 0) {
    res.redirect(`/post/${projectId}?error=no_credits`);
    return;
  }

  // Deduct 1 credit
  db.prepare('UPDATE contractors SET credits = credits - 1 WHERE id = ?').run(contractor.id);

  db.prepare(`
    INSERT INTO bids (project_id, contractor_id, price, description, estimated_days, status)
    VALUES (?, ?, ?, ?, ?, 'pending')
  `).run(projectId, contractor.id, price || null, description.trim(), parseInt(estimated_days) || null);

  // Auto-promote project from pending to active on first bid
  if (project.status === 'pending') {
    db.prepare("UPDATE projects SET status = 'active' WHERE id = ? AND status = 'pending'").run(projectId);
  }

  // Notify admin (async, non-blocking)
  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (adminChatId) {
    sendNewBidNotification(adminChatId, project.title, contractor.name, price || null).catch(() => {});
  }

  // Notify client via email (async, non-blocking)
  if (isEmailConfigured() && project.client_email) {
    sendNewBidEmail(project.client_email, project.title, contractor.name, projectId).catch(() => {});
  }

  res.redirect(`/post/${projectId}`);
});

// Accept a bid (project owner only)
router.post('/:projectId/bids/:bidId/accept', optionalAuth, (req: Request, res: Response): void => {
  const projectId = parseInt(req.params.projectId as string, 10);
  const bidId = parseInt(req.params.bidId as string, 10);
  const user = (req as any).user;

  if (!user) {
    res.redirect(`/auth/login?redirect=/post/${projectId}`);
    return;
  }

  const project = db.prepare('SELECT id, client_email, assigned_contractor_id FROM projects WHERE id = ?').get(projectId) as any;
  if (!project) {
    res.status(404).render('error', { title: 'Not Found' });
    return;
  }

  if (project.client_email !== user.email) {
    res.status(403).render('error', { title: 'Forbidden' });
    return;
  }

  const bid = db.prepare('SELECT id, contractor_id FROM bids WHERE id = ? AND project_id = ?').get(bidId, projectId) as any;
  if (!bid) {
    res.redirect(`/post/${projectId}`);
    return;
  }

  // Accept this bid, reject others
  db.prepare('UPDATE bids SET status = ? WHERE project_id = ?').run('rejected', projectId);
  db.prepare('UPDATE bids SET status = ? WHERE id = ?').run('accepted', bidId);
  db.prepare('UPDATE projects SET status = ?, assigned_contractor_id = ? WHERE id = ?').run('in_progress', bid.contractor_id, projectId);

  // Notify admin (async)
  const adminChatId2 = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (adminChatId2) {
    const proj = db.prepare('SELECT title FROM projects WHERE id = ?').get(projectId) as any;
    const cont = db.prepare('SELECT name FROM contractors WHERE id = ?').get(bid.contractor_id) as any;
    sendBidAcceptedNotification(adminChatId2, proj.title, cont.name).catch(() => {});
  }

  // Notify contractor via email (async)
  if (isEmailConfigured()) {
    const proj = db.prepare('SELECT title, client_email FROM projects WHERE id = ?').get(projectId) as any;
    const cont = db.prepare('SELECT email, name FROM contractors WHERE id = ?').get(bid.contractor_id) as any;
    if (cont && cont.email) {
      sendBidAcceptedEmail(cont.email, proj.title, proj.client_email || 'Client', projectId).catch(() => {});
    }
  }

  res.redirect(`/post/${projectId}`);
});

// Reject a bid (project owner only)
router.post('/:projectId/bids/:bidId/reject', optionalAuth, (req: Request, res: Response): void => {
  const projectId = parseInt(req.params.projectId as string, 10);
  const bidId = parseInt(req.params.bidId as string, 10);
  const user = (req as any).user;

  if (!user) {
    res.redirect(`/auth/login?redirect=/post/${projectId}`);
    return;
  }

  const project = db.prepare('SELECT client_email FROM projects WHERE id = ?').get(projectId) as any;
  if (!project || project.client_email !== user.email) {
    res.status(403).render('error', { title: 'Forbidden' });
    return;
  }

  db.prepare('UPDATE bids SET status = ? WHERE id = ? AND project_id = ?').run('rejected', bidId, projectId);
  res.redirect(`/post/${projectId}`);
});

// === PROJECT STATUS ROUTES ===

// Change project status (owner only)
router.post('/:projectId/status', optionalAuth, (req: Request, res: Response): void => {
  const projectId = parseInt(req.params.projectId as string, 10);
  const { status } = req.body;
  const user = (req as any).user;

  if (!user) {
    res.redirect(`/auth/login?redirect=/post/${projectId}`);
    return;
  }

  // Only allow valid transitions
  const validStatuses = ['completed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    res.redirect(`/post/${projectId}`);
    return;
  }

  const project = db.prepare('SELECT id, client_email, status FROM projects WHERE id = ?').get(projectId) as any;
  if (!project || project.client_email !== user.email) {
    res.status(403).render('error', { title: 'Forbidden' });
    return;
  }

  // Only allow status change from in_progress
  if (project.status !== 'in_progress') {
    res.redirect(`/post/${projectId}`);
    return;
  }

  db.prepare('UPDATE projects SET status = ? WHERE id = ?').run(status, projectId);

  // Notify contractor via email when project is completed
  if (isEmailConfigured() && status === 'completed') {
    const proj = db.prepare(`
      SELECT p.title, p.assigned_contractor_id, p.client_email, c.name as contractor_name, c.email as contractor_email
      FROM projects p LEFT JOIN contractors c ON p.assigned_contractor_id = c.id
      WHERE p.id = ?
    `).get(projectId) as any;
    if (proj && proj.contractor_email) {
      sendProjectCompletedEmail(proj.client_email, proj.title, proj.contractor_name || 'Contractor', projectId).catch(() => {});
    }
  }

  res.redirect(`/post/${projectId}`);
});

// === REVIEW ROUTES ===

// Submit review for a contractor
router.post('/:projectId/review', optionalAuth, (req: Request, res: Response): void => {
  const projectId = parseInt(req.params.projectId as string, 10);
  const { rating, comment, contractor_id } = req.body;
  const authorEmail = req.user?.email || null;

  if (!rating || !comment || !authorEmail) {
    res.redirect(`/post/${projectId}`);
    return;
  }

  // Only allow review if user has a completed project with this contractor
  const completedProject = db.prepare(`
    SELECT id FROM projects 
    WHERE id = ? 
      AND client_email = ? 
      AND assigned_contractor_id = ? 
      AND status = 'completed'
  `).get(projectId, authorEmail, parseInt(contractor_id)) as any;

  if (!completedProject) {
    res.redirect(`/post/${projectId}`);
    return;
  }

  // Check if user already reviewed this contractor for this project
  const existingReview = db.prepare(`
    SELECT id FROM reviews 
    WHERE project_id = ? AND contractor_id = ? AND client_email = ?
  `).get(projectId, parseInt(contractor_id), authorEmail) as any;

  if (existingReview) {
    res.redirect(`/post/${projectId}`);
    return;
  }

  db.prepare(`
    INSERT INTO reviews (project_id, contractor_id, author_email, client_email, rating, comment, is_moderated, is_approved)
    VALUES (?, ?, ?, ?, ?, ?, 0, 1)
  `).run(projectId, parseInt(contractor_id), authorEmail, authorEmail, parseInt(rating), comment.trim());

  // Update contractor stats
  const stats = db.prepare(`
    SELECT COUNT(*) as total, COALESCE(AVG(rating), 0) as avg_rating
    FROM reviews WHERE contractor_id = ? AND is_approved = 1
  `).get(contractor_id) as any;
  

  db.prepare(`
    UPDATE contractors SET rating = ?, reviews_count = ? WHERE id = ?
  `).run(stats.avg_rating, stats.total, contractor_id);

  res.redirect(`/post/${projectId}`);
});

export default router;
