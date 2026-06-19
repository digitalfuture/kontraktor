import express, { Request, Response } from 'express';
import db from '../db';
import { requireAuth } from '../middleware/auth';

const router: express.Router = express.Router();

router.get('/', requireAuth, (req: Request, res: Response): void => {
  const user = (req as any).user;
  const locale = (res.locals.locale as string) || 'en';
  const section = (req.query.section as string) || 'overview';

  if (!user) {
    res.redirect('/auth/login');
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
    SELECT b.*, p.title as project_title, p.category_slug,
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

export default router;
