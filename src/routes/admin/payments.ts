// ── Admin — Payments ──

import express, { Request, Response } from 'express';
import db from '../../db';
import { makeT } from './helpers';

function isPaidMode(): boolean {
  const setting = db.prepare("SELECT value FROM settings WHERE key = 'paid_mode'").get() as { value: string } | undefined;
  return setting?.value === 'true';
}

function isFreeMode(): boolean {
  const setting = db.prepare("SELECT value FROM settings WHERE key = 'free_mode'").get() as { value: string } | undefined;
  return setting?.value === 'true';
}

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

    const packagesSetting = db.prepare("SELECT value FROM settings WHERE key = 'credit_packages'").get() as { value: string } | undefined;
    const packages = packagesSetting ? JSON.parse(packagesSetting.value) : [];
    const xenditConfigured = !!process.env.XENDIT_SECRET_API_KEY;

    res.render('admin/payment-settings', {
      title: (locale === 'id' ? 'Pengaturan Pembayaran — Admin' : 'Payment Settings — Admin') + ' — Kontraktor',
      activePage: 'payments',
      packages,
      paidMode: isPaidMode(),
      freeMode: isFreeMode(),
      xenditConfigured,
    });
  });

  // ── PAYMENTS API ──

  apiRouter.post('/payments/settings', (req: Request, res: Response): void => {
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

  apiRouter.post('/payments/toggle-paid-mode', (req: Request, res: Response): void => {
    const newValue = isPaidMode() ? 'false' : 'true';
    db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES ('paid_mode', ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `).run(newValue);
    res.redirect('/admin/payments/settings');
  });

  apiRouter.post('/payments/toggle-free-mode', (req: Request, res: Response): void => {
    const newValue = isFreeMode() ? 'false' : 'true';
    db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES ('free_mode', ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `).run(newValue);
    res.redirect('/admin/payments/settings');
  });
}
