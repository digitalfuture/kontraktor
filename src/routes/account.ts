import express, { Request, Response } from 'express';
import db from '../db';
import { requireAuth } from '../middleware/auth';

const router: express.Router = express.Router();

router.get('/', requireAuth, (req: Request, res: Response): void => {
  const user = res.locals.user;
  const locale = (res.locals.locale as string) || 'en';
  if (!user) {
    res.redirect('/auth/login');
    return;
  }

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

  // Projects as contractor (assigned to user)
  const contractorProjects = db.prepare(`
    SELECT p.*, c.name as category_name, c.slug as category_slug,
           s.name as subcategory_name, s.slug as subcategory_slug
    FROM projects p
    LEFT JOIN categories c ON p.category = c.slug
    LEFT JOIN subcategories s ON p.subcategory = s.slug
    JOIN contractors con ON p.assigned_contractor_id = con.id
    WHERE con.email = ?
    ORDER BY p.created_at DESC
  `).all(user.email) as any[];

  res.render('account', {
    title: locale === 'id' ? 'Dashboard Saya — Kontraktor' : 'My Dashboard — Kontraktor',
    user,
    clientProjects,
    contractorProjects,
    clientCount: clientProjects.length,
    contractorCount: contractorProjects.length,
  });
});

export default router;
