import express, { Request, Response } from 'express';
import path from 'path';
import db from '../db';
import * as seoLib from '../lib/seo';
import { optionalAuth, requireAuth } from '../middleware/auth';
import { upload, deleteFile, processAndSaveImage } from '../lib/upload';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

// ── Pages ──

export const pageRouter: express.Router = express.Router();

// Contractors list with search and filters
pageRouter.get('/', (req: Request, res: Response): void => {
  const search = (req.query.search as string || '').trim();
  const specialty = (req.query.specialty as string || '').trim();
  const sort = (req.query.sort as string || 'projects').trim();
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit as string, 10) || DEFAULT_LIMIT));
  const offset = (page - 1) * limit;

  let sql = `
    SELECT c.*, 
      (SELECT name FROM categories WHERE slug = c.specialty) as specialty_name,
      (SELECT COUNT(*) FROM reviews WHERE contractor_id = c.id AND is_approved = 1) as review_count,
      (SELECT COALESCE(AVG(rating), 0) FROM reviews WHERE contractor_id = c.id AND is_approved = 1) as avg_rating,
      (SELECT GROUP_CONCAT(cat.slug, ',') FROM contractor_services cs JOIN categories cat ON cs.category_id = cat.id WHERE cs.contractor_id = c.id AND cs.is_active = 1) as active_services
    FROM contractors c
    WHERE c.is_active = 1
  `;
  const params: any[] = [];

  if (search) {
    sql += ` AND (c.name LIKE ? OR c.bio LIKE ? OR EXISTS (SELECT 1 FROM contractor_services cs JOIN categories cat ON cs.category_id = cat.id WHERE cs.contractor_id = c.id AND (cat.name LIKE ?)))`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (specialty) {
    sql += ` AND EXISTS (SELECT 1 FROM contractor_services cs WHERE cs.contractor_id = c.id AND cs.category_id = (SELECT id FROM categories WHERE slug = ?) AND cs.is_active = 1)`;
    params.push(specialty);
  }

  // Count total for pagination
  const countResult = db.prepare(`
    SELECT COUNT(*) as total FROM contractors c WHERE c.is_active = 1${search ? ` AND (c.name LIKE ? OR c.bio LIKE ? OR EXISTS (SELECT 1 FROM contractor_services cs JOIN categories cat ON cs.category_id = cat.id WHERE cs.contractor_id = c.id AND (cat.name LIKE ?)))` : ''}${specialty ? ` AND EXISTS (SELECT 1 FROM contractor_services cs WHERE cs.contractor_id = c.id AND cs.category_id = (SELECT id FROM categories WHERE slug = ?) AND cs.is_active = 1)` : ''}
  `).get(...params) as { total: number };

  // Sort
  if (sort === 'name') {
    sql += ` ORDER BY c.name ASC`;
  } else {
    sql += ` ORDER BY c.completed_projects DESC, c.rating DESC, c.name ASC`;
  }
  sql += ` LIMIT ? OFFSET ?`;

  const contractors = db.prepare(sql).all(...params, limit, offset) as any[];

  // Get all categories for filter dropdown (used as specialties)
  const specialties = db.prepare(`SELECT DISTINCT c.slug, c.name FROM categories c WHERE c.is_active = 1 AND EXISTS (SELECT 1 FROM contractor_services cs JOIN contractors ct ON cs.contractor_id = ct.id WHERE cs.category_id = c.id AND ct.is_active = 1) ORDER BY c.name`).all() as any[];

  const totalPages = Math.ceil(countResult.total / limit);

  const locale = (res.locals.locale as string) || 'en';
  res.render('contractors-list', {
    seo: seoLib.contractorsListSeo(locale as 'en' | 'id'),
    title: 'Find Contractors — Kontraktor',
    contractors,
    specialties,
    search,
    specialty,
    sort,
    pagination: {
      page,
      totalPages,
      limit,
      totalItems: countResult.total,
      baseUrl: '/contractors',
      params: { search: search || undefined, specialty: specialty || undefined, sort: sort !== 'projects' ? sort : undefined },
    },
  });
});

// Registration page
pageRouter.get('/register', optionalAuth, (req: Request, res: Response): void => {
  const locale = (res.locals.locale as string) || 'en';
  const categories = db.prepare('SELECT id, name, slug FROM categories WHERE is_active = 1 ORDER BY name').all();

  res.render('contractor-register', {
    seo: seoLib.contractorRegisterSeo(locale as 'en' | 'id'),
    title: locale === 'id' ? 'Daftar sebagai Kontraktor' : 'Register as Contractor',
    categories: categories.map((c: any) => ({
      ...c,
      display_name: c.name
    })),
    formData: null,
    errors: null,
  });
});

// Contractor dashboard: my bids
pageRouter.get('/dashboard', optionalAuth, (req: Request, res: Response): void => {
  const user = (req as any).user;
  const locale = (res.locals.locale as string) || 'en';

  if (!user) {
    res.redirect('/auth/login?redirect=/contractors/dashboard');
    return;
  }

  const contractor = db.prepare('SELECT * FROM contractors WHERE email = ?').get(user.email) as any;
  if (!contractor) {
    res.redirect('/contractors/register');
    return;
  }

  // All bids by this contractor
  const bids = db.prepare(`
    SELECT b.*, p.title as project_title, p.status as project_status, p.category,
      p.client_email
    FROM bids b
    JOIN projects p ON b.project_id = p.id
    LEFT JOIN categories c ON p.category = c.slug
    WHERE b.contractor_id = ?
    ORDER BY b.created_at DESC
  `).all(contractor.id) as any[];

  // Localize category names
  bids.forEach((bid: any) => {
    bid.category_display = bid.category;
  });

  // Stats
  const stats = {
    total: bids.length,
    pending: bids.filter((b: any) => b.status === 'pending').length,
    accepted: bids.filter((b: any) => b.status === 'accepted').length,
    rejected: bids.filter((b: any) => b.status === 'rejected').length,
  };

  const paidModeRow = db.prepare("SELECT value FROM settings WHERE key = 'paid_mode'").get() as any;
  const paidMode = paidModeRow?.value === 'true';

  // Load contractor services with category names
  const services = db.prepare(`
    SELECT cs.id, cs.is_active, cs.created_at, c.id as category_id, c.name, c.slug
    FROM contractor_services cs
    JOIN categories c ON cs.category_id = c.id
    WHERE cs.contractor_id = ?
    ORDER BY c.name
  `).all(contractor.id) as any[];
  services.forEach((svc: any) => {
    svc.display_name = svc.name;
  });

  res.render('contractor-dashboard', {
    title: locale === 'id' ? 'Dashboard Kontraktor' : 'Contractor Dashboard',
    contractor,
    services,
    bids,
    stats,
    locale,
    paidMode,
    userCredits: contractor.credits || 0,
    success: req.query.success as string,
    error: req.query.error as string,
    photos: db.prepare('SELECT id, filename, original_name, caption, file_size, created_at FROM photos WHERE contractor_id = ? AND is_portfolio = 1 ORDER BY created_at DESC').all(contractor.id) as any[],
  });
});

// Contractor profile page
pageRouter.get('/:id', (req: Request, res: Response): void => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(404).render('error', { message: 'Not Found' }); return; }

  const contractor = db.prepare('SELECT * FROM contractors WHERE id = ?').get(id) as any;
  
  if (!contractor) {
    res.status(404).render('error', { message: 'Not Found' });
    return;
  }

  const reviews = db.prepare(`
    SELECT r.*, u.name as reviewer_name
    FROM reviews r
    LEFT JOIN users u ON r.client_email = u.email
    WHERE r.contractor_id = ? AND r.is_approved = 1
    ORDER BY r.created_at DESC
  `).all(id) as any[];

  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total_reviews,
      COALESCE(AVG(rating), 0) as avg_rating,
      SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as five_star,
      SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as four_star,
      SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as three_star
    FROM reviews
    WHERE contractor_id = ? AND is_approved = 1
  `).get(id) as any;

  const locale = (res.locals.locale as string) || 'en';
  res.render('contractor-profile', {
    seo: seoLib.contractorProfileSeo(contractor.name, contractor.bio || '', stats?.avg_rating || null, stats?.total_reviews || 0, locale as 'en' | 'id', id),
    title: `${contractor.name} — Kontraktor`,
    contractor,
    reviews,
    stats,
    photos: db.prepare('SELECT id, filename, original_name, caption FROM photos WHERE contractor_id = ? AND is_portfolio = 1 ORDER BY created_at DESC').all(id) as any[],
  });
});

// ── API ──

export const apiRouter: express.Router = express.Router();

// Handle registration
apiRouter.post('/register', optionalAuth, (req: Request, res: Response): void => {
  const locale = (res.locals.locale as string) || 'en';
  const errors: string[] = [];
  const formData = {
    name: (req.body.name || '').trim(),
    email: (req.body.email || '').trim(),
    phone: (req.body.phone || '').trim(),
    specialty: req.body.specialty || '',
    experience: req.body.experience || '',
    bio: (req.body.bio || '').trim(),
  };

  if (!formData.name) errors.push('Name is required');
  if (!formData.email) errors.push('Email is required');
  // Normalize & validate Indonesian phone number
  if (formData.phone) {
    let phone = formData.phone.replace(/\s+/g, '');
    if (phone.startsWith('+62')) phone = phone.slice(3);
    else if (phone.startsWith('62')) phone = phone.slice(2);
    else if (phone.startsWith('0')) phone = phone.slice(1);
    if (!/^8\d{7,14}$/.test(phone)) {
      errors.push('Nomor telepon Indonesia tidak valid. Harus nomor +62 yang valid (contoh: 81234567890)');
    } else {
      formData.phone = '+62' + phone;
    }
  }
  const selectedCategories = Array.isArray(formData.specialty) ? formData.specialty : (formData.specialty ? [formData.specialty] : []);
  if (selectedCategories.length === 0) errors.push('At least one specialty/category is required');

  if (errors.length > 0) {
    const categories = db.prepare('SELECT id, name, slug FROM categories WHERE is_active = 1 ORDER BY name').all();
    res.render('contractor-register', {
      title: locale === 'id' ? 'Daftar sebagai Kontraktor' : 'Register as Contractor',
      categories: categories.map((c: any) => ({
        ...c,
        display_name: c.name
      })),
      formData,
      errors,
    });
    return;
  }

  const existing = db.prepare('SELECT id FROM contractors WHERE email = ?').get(formData.email) as any;
  if (existing) {
    errors.push('This email is already registered as a contractor');
    const categories = db.prepare('SELECT id, name, slug FROM categories WHERE is_active = 1 ORDER BY name').all();
    res.render('contractor-register', {
      title: locale === 'id' ? 'Daftar sebagai Kontraktor' : 'Register as Contractor',
      categories: categories.map((c: any) => ({
        ...c,
        display_name: c.name
      })),
      formData,
      errors,
    });
    return;
  }

  const result = db.prepare(`
    INSERT INTO contractors (email, name, phone, specialty, experience, bio, is_verified, is_active)
    VALUES (?, ?, ?, ?, ?, ?, 0, 1)
  `).run(formData.email, formData.name, formData.phone, selectedCategories[0] || '', parseInt(formData.experience) || 0, formData.bio);

  const contractorId = result.lastInsertRowid;

  // Insert into contractor_services for each selected category
  const insertService = db.prepare('INSERT OR IGNORE INTO contractor_services (contractor_id, category_id) VALUES (?, (SELECT id FROM categories WHERE slug = ?))');
  for (const catSlug of selectedCategories) {
    insertService.run(contractorId, catSlug);
  }

  if (req.user) {
    db.prepare("UPDATE users SET role = 'contractor' WHERE email = ?").run(req.user.email);
  }

  res.redirect(`/contractors/${result.lastInsertRowid}`);
});

// Upload avatar (single image)
apiRouter.post('/dashboard/avatar', requireAuth, upload.single('avatar'), async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  if (!req.file) {
    res.redirect('/contractors/dashboard?error=no_file');
    return;
  }

  const contractor = db.prepare('SELECT id, avatar_url FROM contractors WHERE email = ?').get(user.email) as any;
  if (!contractor) {
    res.redirect('/contractors/dashboard?error=no_contractor');
    return;
  }

  // Delete old avatar if exists
  if (contractor.avatar_url) {
    const oldFilename = contractor.avatar_url.split('/').pop();
    if (oldFilename) deleteFile(oldFilename);
  }

  try {
    const { filename } = await processAndSaveImage(req.file, { isAvatar: true });
    db.prepare('UPDATE contractors SET avatar_url = ? WHERE id = ?').run(`/uploads/${filename}`, contractor.id);
    res.redirect('/contractors/dashboard?success=avatar');
  } catch (err) {
    console.error('Failed to process and save avatar:', err);
    res.redirect('/contractors/dashboard?error=processing_failed');
  }
});

// Upload portfolio photos (multiple)
apiRouter.post('/dashboard/portfolio', requireAuth, upload.array('photos', 10), async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const files = req.files as Express.Multer.File[];

  if (!files || files.length === 0) {
    res.redirect('/contractors/dashboard?error=no_files');
    return;
  }

  const contractor = db.prepare('SELECT id FROM contractors WHERE email = ?').get(user.email) as any;
  if (!contractor) {
    res.redirect('/contractors/dashboard?error=no_contractor');
    return;
  }

  const insertPhoto = db.prepare(
    'INSERT INTO photos (contractor_id, filename, original_name, mime_type, file_size, caption, is_portfolio) VALUES (?, ?, ?, ?, ?, ?, 1)'
  );

  try {
    for (const file of files) {
      const captionVal = (req.body as any)[`caption_${file.fieldname}`];
      const caption = Array.isArray(captionVal) ? captionVal[0] : (captionVal || file.originalname);
      
      const { filename, size } = await processAndSaveImage(file, { isAvatar: false });
      
      // Keep original name but replace its extension with .webp for clarity
      const ext = path.extname(file.originalname);
      const originalWebpName = file.originalname.slice(0, -ext.length) + '.webp';
      
      insertPhoto.run(contractor.id, filename, originalWebpName, 'image/webp', size, caption);
    }

    res.redirect(`/contractors/dashboard?success=portfolio`);
  } catch (err) {
    console.error('Failed to process and save portfolio photos:', err);
    res.redirect('/contractors/dashboard?error=processing_failed');
  }
});

// Delete portfolio photo
apiRouter.post('/dashboard/photo/:photoId/delete', requireAuth, (req: Request, res: Response): void => {
  const user = (req as any).user;
  const photoId = parseInt(req.params.photoId as string, 10);

  const photo = db.prepare('SELECT id, filename FROM photos WHERE id = ?').get(photoId) as any;
  if (!photo) {
    res.redirect('/contractors/dashboard');
    return;
  }

  const contractor = db.prepare('SELECT id FROM contractors WHERE email = ?').get(user.email) as any;
  if (!contractor) {
    res.redirect('/contractors/dashboard');
    return;
  }

  // Verify ownership
  const isOwner = db.prepare('SELECT 1 FROM photos WHERE id = ? AND contractor_id = ?').get(photoId, contractor.id);
  if (!isOwner) {
    res.status(403).render('error', { title: 'Forbidden' });
    return;
  }

  deleteFile(photo.filename);
  db.prepare('DELETE FROM photos WHERE id = ?').run(photoId);
  res.redirect('/contractors/dashboard?success=photo_deleted');
});

// Request credits (contractor requests free credits)
apiRouter.post('/request-credits', requireAuth, (req: Request, res: Response): void => {
  const user = (req as any).user;
  
  const contractor = db.prepare('SELECT id, credits FROM contractors WHERE email = ?').get(user.email) as any;
  if (!contractor) {
    res.redirect('/contractors/dashboard?error=not_contractor');
    return;
  }
  
  // Grant 5 free credits per request
  db.prepare('UPDATE contractors SET credits = credits + 5 WHERE id = ?').run(contractor.id);
  
  res.redirect('/contractors/dashboard?success=credits_granted');
});

// Toggle contractor active/inactive status (self-service)
apiRouter.post('/dashboard/toggle-active', requireAuth, (req: Request, res: Response): void => {
  const user = (req as any).user;

  const contractor = db.prepare('SELECT id, is_active FROM contractors WHERE email = ?').get(user.email) as any;
  if (!contractor) {
    res.redirect('/contractors/dashboard?error=not_contractor');
    return;
  }

  db.prepare('UPDATE contractors SET is_active = NOT is_active WHERE id = ?').run(contractor.id);
  res.redirect('/contractors/dashboard');
});

// Toggle individual contractor_service (self-service)
apiRouter.post('/dashboard/services/:serviceId/toggle', requireAuth, (req: Request, res: Response): void => {
  const user = (req as any).user;
  const serviceId = parseInt(req.params.serviceId as string, 10);

  const contractor = db.prepare('SELECT id FROM contractors WHERE email = ?').get(user.email) as any;
  if (!contractor) {
    res.redirect('/contractors/dashboard?error=not_contractor');
    return;
  }

  // Ensure the service belongs to this contractor
  const service = db.prepare('SELECT id FROM contractor_services WHERE id = ? AND contractor_id = ?').get(serviceId, contractor.id) as any;
  if (!service) {
    res.redirect('/contractors/dashboard?error=service_not_found');
    return;
  }

  db.prepare('UPDATE contractor_services SET is_active = NOT is_active WHERE id = ?').run(serviceId);
  res.redirect('/contractors/dashboard');
});

export default pageRouter;
