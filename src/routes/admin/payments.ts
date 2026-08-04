// ── Admin — Payments ──

import express, { Request, Response } from 'express';
import db from '../../db';
import { makeT } from './helpers';
import { isFreeMode } from '../../lib/project-limit';

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
    const freeMode = isFreeMode(db);

    res.render('admin/payment-settings', {
      title: (locale === 'id' ? 'Pengaturan Pembayaran — Admin' : 'Payment Settings — Admin') + ' — Kontraktor',
      activePage: 'payments',
      freeMode,
      xenditConfigured,
    });
  });

  // ── PAYMENTS API ──

  // Set billing mode: 'free' = everything free for everyone,
  // 'paid' = per-user plan caps (free plan 1 active project, pro 3, business unlimited)
  apiRouter.post('/payments/set-mode', (req: Request, res: Response): void => {
    const mode = String(req.body.mode || 'free');
    const free = mode === 'paid' ? 'false' : 'true';
    db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES ('free_mode', ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `).run(free);
    if (req.headers['hx-request']) {
      res.set('HX-Trigger', JSON.stringify({ showNotification: { msg: 'Billing mode saved', type: 'success' } }));
      res.set('HX-Refresh', 'true');
      res.status(200).send('');
      return;
    }
    res.redirect('/admin/payments/settings');
  });
}
