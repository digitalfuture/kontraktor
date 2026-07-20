import express, { Request, Response } from 'express';
import crypto from 'crypto';
import db from '../db';
import { requireAuth } from '../middleware/auth';

const UNSUBSCRIBE_SECRET = process.env.UNSUBSCRIBE_SECRET || 'kontraktor-unsub-secret-change-in-production';

function generateUnsubscribeToken(userId: number, categorySlug: string | null): string {
  const data = `${userId}:${categorySlug || 'all'}:${UNSUBSCRIBE_SECRET}`;
  return Buffer.from(`${userId}:${categorySlug || 'all'}:${crypto.createHash('sha256').update(data).digest('hex').slice(0, 16)}`).toString('base64url');
}

function verifyUnsubscribeToken(token: string): { userId: number; categorySlug: string | null } | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8');
    const parts = decoded.split(':');
    if (parts.length !== 3) return null;
    const userId = parseInt(parts[0], 10);
    const categorySlug = parts[1] === 'all' ? null : parts[1];
    const expectedHash = crypto.createHash('sha256').update(`${userId}:${parts[1]}:${UNSUBSCRIBE_SECRET}`).digest('hex').slice(0, 16);
    if (parts[2] !== expectedHash) return null;
    return { userId, categorySlug };
  } catch {
    return null;
  }
}

const router: express.Router = express.Router();

router.get('/', requireAuth, (req: Request, res: Response): void => {
  const user = (req as any).user;
  const locale = (res.locals.locale as string) || 'en';
  const section = (req.query.section as string) || 'overview';

  if (!user) {
    res.redirect('/auth/login');
    return;
  }

  // If user has no name, force to profile page
  if (!user.name && section !== 'profile') {
    res.redirect('/account/profile');
    return;
  }

  // Check if user is also registered as contractor
  const contractor = db.prepare('SELECT id, credits FROM contractors WHERE email = ?').get(user.email) as any;
  const isContractor = !!contractor;

  // Projects as client (created by user)
  const clientProjects = db.prepare(`
    SELECT p.*, c.name as category_name, c.slug as category_slug,
           s.name as subcategory_name, s.slug as subcategory_slug,
           con.name as contractor_name
    FROM projects p
    LEFT JOIN categories c ON p.category = c.slug
    LEFT JOIN subcategories s ON p.subcategory = s.slug
    LEFT JOIN contractors con ON p.assigned_contractor_id = con.id
    WHERE p.client_email = ?
    ORDER BY p.created_at DESC
  `).all(user.email) as any[];

  // Bids placed by this contractor
  const bids = isContractor ? db.prepare(`
    SELECT b.*, p.title as project_title, p.category as category_slug,
           c.name as category_display
    FROM bids b
    JOIN projects p ON b.project_id = p.id
    LEFT JOIN categories c ON p.category = c.slug
    WHERE b.contractor_id = ?
    ORDER BY b.created_at DESC
  `).all(contractor.id) as any[] : [];

  // Bids stats
  const bidsStats = {
    total: bids.length as number,
    pending: bids.filter((b: any) => b.status === 'pending').length,
    accepted: bids.filter((b: any) => b.status === 'accepted').length,
    rejected: bids.filter((b: any) => b.status === 'rejected').length,
  };

  // Paid mode
  const paidModeRow = db.prepare("SELECT value FROM settings WHERE key = 'paid_mode'").get() as any;
  const paidMode = paidModeRow?.value === 'true';

  const userCredits = contractor?.credits || 0;

  const sectionTitles: Record<string, string> = {
    overview: locale === 'id' ? 'Akun' : 'Account',
    projects: locale === 'id' ? 'Proyek Saya' : 'My Projects',
    bids: locale === 'id' ? 'Penawaran Saya' : 'My Bids',
  };

  res.render('account', {
    title: (sectionTitles[section] || sectionTitles.overview) + ' — Kontraktor',
    pageTitle: sectionTitles[section] || sectionTitles.overview,
    user,
    clientProjects,
    clientCount: clientProjects.length,
    bids,
    bidsStats,
    isContractor,
    userCredits,
    paidMode,
    activeSection: section,
  });
});

// GET /account/profile — форма редактирования профиля
router.get('/profile', requireAuth, (req: Request, res: Response): void => {
  const user = (req as any).user;
  const locale = (res.locals.locale as string) || 'en';

  res.render('account', {
    title: (locale === 'id' ? 'Profil' : 'Profile') + ' — Kontraktor',
    pageTitle: locale === 'id' ? 'Profil' : 'Profile',
    user,
    activeSection: 'profile',
    needsName: !user.name,
    profileSuccess: req.query.success === '1',
    profileError: req.query.error,
  });
});

// POST /account/profile — сохранение профиля
router.post('/profile', requireAuth, (req: Request, res: Response): void => {
  const user = (req as any).user;
  const { name, email, phone, telegram_id } = req.body as { name?: string; email?: string; phone?: string; telegram_id?: string };

  const trimmedName = (name || '').trim();
  const trimmedEmail = (email || '').trim();

  // Validate
  if (!trimmedName) {
    res.redirect('/account/profile?error=name_required');
    return;
  }
  if (!trimmedEmail || !trimmedEmail.includes('@')) {
    res.redirect('/account/profile?error=email_invalid');
    return;
  }

  // Check email uniqueness (exclude current user)
  const existing = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(trimmedEmail, user.id) as { id: number } | undefined;
  if (existing) {
    res.redirect('/account/profile?error=email_taken');
    return;
  }

  // Normalize & validate Indonesian phone number
  let normalizedPhone: string | null = null;
  const rawPhone = (phone || '').trim();
  if (rawPhone) {
    let p = rawPhone.replace(/\s+/g, '');
    if (p.startsWith('+62')) p = p.slice(3);
    else if (p.startsWith('62')) p = p.slice(2);
    else if (p.startsWith('0')) p = p.slice(1);
    if (!/^8\d{7,14}$/.test(p)) {
      res.redirect('/account/profile?error=phone_invalid');
      return;
    }
    normalizedPhone = '+62' + p;
  }

  db.prepare('UPDATE users SET name = ?, email = ?, phone = ?, telegram_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
    trimmedName,
    trimmedEmail,
    normalizedPhone,
    (telegram_id || '').trim() || null,
    user.id
  );

  // If user had no name before (forced profile), redirect to overview
  const cameFromForce = !user.name;
  (req as any).user.name = trimmedName;
  (req as any).user.email = trimmedEmail;
  (req as any).user.phone = normalizedPhone;
  (req as any).user.telegram_id = (telegram_id || '').trim() || null;

  res.redirect(cameFromForce ? '/account' : '/account/profile?success=1');
});

// GET /account/notifications — настройки уведомлений
router.get('/notifications', requireAuth, (req: Request, res: Response): void => {
  const user = (req as any).user;
  const locale = (res.locals.locale as string) || 'en';
  const t = res.locals.t;

  const categories = db.prepare('SELECT id, slug, name FROM categories WHERE is_active = 1 ORDER BY name').all() as Array<{ id: number; slug: string; name: string }>;
  const userCats: string[] = user.notification_categories ? JSON.parse(user.notification_categories) : [];

  res.render('account', {
    title: (locale === 'id' ? 'Notifikasi' : 'Notifications') + ' — Kontraktor',
    pageTitle: locale === 'id' ? 'Notifikasi' : 'Notifications',
    user,
    categories,
    userCats,
    activeSection: 'notifications',
    notificationSuccess: req.query.success === '1',
  });
});

// POST /account/notifications — сохранение настроек
router.post('/notifications', requireAuth, (req: Request, res: Response): void => {
  const user = (req as any).user;
  const { enabled, categories } = req.body as { enabled?: string; categories?: string | string[] };

  const catArray = categories
    ? (Array.isArray(categories) ? categories : [categories])
    : [];

  db.prepare('UPDATE users SET notifications_enabled = ?, notification_categories = ? WHERE id = ?').run(
    enabled === '1' ? 1 : 0,
    catArray.length > 0 ? JSON.stringify(catArray) : null,
    user.id
  );

  // Update user in session
  (req as any).user.notifications_enabled = enabled === '1' ? 1 : 0;
  (req as any).user.notification_categories = catArray.length > 0 ? JSON.stringify(catArray) : null;

  res.redirect('/account/notifications?success=1');
});

// GET /unsubscribe — отписка от уведомлений (без авторизации, по токену)
router.get('/unsubscribe', (req: Request, res: Response): void => {
  const token = req.query.token as string;
  const all = req.query.all as string | undefined;
  const locale = (res.locals.locale as string) || 'en';

  if (!token) {
    res.render('unsubscribe', {
      title: 'Unsubscribe — Kontraktor',
      locale,
      success: false,
      message: locale === 'id' ? 'Tautan tidak valid.' : 'Invalid link.',
    });
    return;
  }

  const payload = verifyUnsubscribeToken(token);
  if (!payload) {
    res.render('unsubscribe', {
      title: 'Unsubscribe — Kontraktor',
      locale,
      success: false,
      message: locale === 'id' ? 'Tautan tidak valid atau telah kedaluwarsa.' : 'Invalid or expired link.',
    });
    return;
  }

  const { userId, categorySlug } = payload;

  if (all === '1' || categorySlug === null) {
    // Отписать от всего
    db.prepare('UPDATE users SET notifications_enabled = 0 WHERE id = ?').run(userId);
    res.render('unsubscribe', {
      title: 'Unsubscribed — Kontraktor',
      locale,
      success: true,
      message: locale === 'id'
        ? 'Anda telah berhenti berlangganan dari semua notifikasi.'
        : 'You have been unsubscribed from all notifications.',
      enableUrl: '/account/notifications',
    });
  } else {
    // Отписать от конкретной категории
    const user = db.prepare('SELECT notification_categories FROM users WHERE id = ?').get(userId) as any;
    if (user && user.notification_categories) {
      const cats: string[] = JSON.parse(user.notification_categories);
      const filtered = cats.filter((c: string) => c !== categorySlug);
      db.prepare('UPDATE users SET notification_categories = ? WHERE id = ?').run(
        filtered.length > 0 ? JSON.stringify(filtered) : null,
        userId
      );
    }
    const catName = db.prepare('SELECT name FROM categories WHERE slug = ?').get(categorySlug) as any;
    res.render('unsubscribe', {
      title: 'Unsubscribed — Kontraktor',
      locale,
      success: true,
      message: locale === 'id'
        ? `Anda telah berhenti berlangganan notifikasi kategori "${catName?.name || categorySlug}".`
        : `You have been unsubscribed from "${catName?.name || categorySlug}" notifications.`,
      enableUrl: '/account/notifications',
    });
  }
});

export default router;
