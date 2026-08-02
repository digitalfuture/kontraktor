// ── Admin — Payments ──

import express, { Request, Response } from 'express';
import db from '../../db';
import { makeT } from './helpers';
import { getActiveProjectLimit } from '../../lib/project-limit';

export function registerPaymentRoutes(pageRouter: express.Router, apiRouter: express.Router): void {

  pageRouter.get('/payments', (req: Request, res: Response): void => {
    const locale = (res.locals.locale as string) || 'en';
    const _t = makeT(res);

    let totalPaid = { total: 0 };
    let totalPayouts = { total: 0 };
    let recentTransactions: any[] = [];
    try {
      totalPaid = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM payment_transactions WHERE status = 'completed'").get() as { total: number };
      totalPayouts = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM payment_transactions WHERE type = 'payout' AND status = 'completed'").get() as { total: number };
      recentTransactions = db.prepare('SELECT * FROM payment_transactions ORDER BY created_at DESC LIMIT 20').all();
    } catch (err) {
      console.error('Payments DB error (payment_transactions table may not exist):', err);
    }
    const totalDue: { total: number } = { total: 0 };

    res.render('admin/payments', {
      title: (locale === 'id' ? 'Pembayaran — Admin' : 'Payments — Admin') + ' — Kontraktor',
      activePage: 'payments',
      totalPaid: totalPaid.total,
      totalPayouts: totalPayouts.total,
      totalPending: 0,
      totalDue: totalDue.total,
      payments: recentTransactions,
      selectedStatus: '',
      searchQuery: '',
      pagination: { page: 1, totalPages: Math.ceil(recentTransactions.length / 20), total: recentTransactions.length },
    });
  });

  pageRouter.get('/payments/settings', (req: Request, res: Response): void => {
    const locale = (res.locals.locale as string) || 'en';
    const _t = makeT(res);

    const xenditConfigured = !!process.env.XENDIT_SECRET_API_KEY;
    const projectLimit = getActiveProjectLimit(db);

    res.render('admin/payment-settings', {
      title: (locale === 'id' ? 'Pengaturan Pembayaran — Admin' : 'Payment Settings — Admin') + ' — Kontraktor',
      activePage: 'payments',
      projectLimit,
      xenditConfigured,
    });
  });

  // ── PAYMENTS API ──

  // Set max active projects per client (3-tier subscription scheme)
  apiRouter.post('/payments/set-project-limit', (req: Request, res: Response): void => {
    const raw = parseInt(String(req.body.limit), 10);
    const limit = isNaN(raw) || raw < 0 ? 0 : raw;
    db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES ('active_project_limit', ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `).run(String(limit));
    // Keep legacy free_mode flag in sync for backward compatibility
    db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES ('free_mode', ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `).run(limit === 0 ? 'true' : 'false');
    if (req.headers['hx-request']) {
      res.set('HX-Trigger', JSON.stringify({ showNotification: { msg: 'Project limit saved', type: 'success' } }));
      res.set('HX-Refresh', 'true');
      res.status(200).send('');
      return;
    }
    res.redirect('/admin/payments/settings');
  });
}
