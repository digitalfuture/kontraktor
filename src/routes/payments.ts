import express, { Request, Response } from 'express';
import db from '../db';
import { requireAuth } from '../middleware/auth';
import { sendPaymentSuccessNotification } from '../lib/telegram';

const XENDIT_CALLBACK_TOKEN = process.env.XENDIT_CALLBACK_TOKEN || '';

// ── Pages ──

export const pageRouter: express.Router = express.Router();

// Display package selection screen — now redirected: bidding is free
pageRouter.get('/buy', requireAuth, (req: Request, res: Response): void => {
  res.redirect('/contractors/dashboard?free_bidding=true');
  return;
});

// ── API ──

export const apiRouter: express.Router = express.Router();

// Credit purchases are disabled since the credit-based bidding scheme was
// removed (bids are free). Kept as a stub until real subscriptions land.
apiRouter.post('/create-invoice', requireAuth, (req: Request, res: Response): void => {
  const locale = (res.locals.locale as string) || 'en';
  const isHtmx = req.headers['hx-request'] === 'true';
  if (isHtmx) {
    res.status(410).send(renderError(locale,
      locale === 'id' ? 'Dinonaktifkan' : 'Disabled',
      locale === 'id' ? 'Pembelian kredit dinonaktifkan — penawaran sekarang gratis.' : 'Credit purchases are disabled — bidding is now free.'
    ));
    return;
  }
  res.redirect('/contractors/dashboard?free_bidding=true');
});

/** Render an error snippet for HTMX swap into #payment-error */
function renderError(locale: string, title: string, message: string): string {
  return `<div class="max-w-md mx-auto mb-8 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 flex items-center gap-3">
  <span class="text-xl">⚠️</span>
  <div>
    <p class="font-bold">${title}</p>
    <p class="text-sm">${message}</p>
  </div>
</div>`;
}

// Xendit callback webhook (Excluded from CSRF)
apiRouter.post('/webhook', (req: Request, res: Response): void => {
  const callbackToken = req.headers['x-callback-token'];
  const { external_id, status, payment_method } = req.body;

  console.log(`[Payments] Webhook received: external_id=${external_id}, status=${status}, method=${payment_method}`);

  // Authenticate callback token if configured
  if (XENDIT_CALLBACK_TOKEN && callbackToken !== XENDIT_CALLBACK_TOKEN) {
    console.warn('[Payments] Webhook callback token mismatch. Access denied.');
    res.status(403).send('Invalid token');
    return;
  }

  if (!external_id) {
    res.status(400).send('Missing external_id');
    return;
  }

  // Find transaction
  const payment = db.prepare('SELECT * FROM payments WHERE external_id = ?').get(external_id) as any;
  if (!payment) {
    console.warn(`[Payments] Transaction ${external_id} not found in DB`);
    res.status(404).send('Transaction not found');
    return;
  }

  // Process success payments
  if (payment.status === 'pending') {
    if (status === 'PAID' || status === 'SETTLED') {
      db.transaction(() => {
        // Mark payment as completed
        db.prepare(`
          UPDATE payments 
          SET status = 'completed', payment_method = ?, updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `).run(payment_method || 'XENDIT', payment.id);

        // Add credits to contractor
        db.prepare(`
          UPDATE users
          SET credits = credits + ?
          WHERE id = ?
        `).run(payment.credits, payment.contractor_id);
      })();

      console.log(`[Payments] Successfully completed payment ${external_id}. Added ${payment.credits} credits to contractor ID ${payment.contractor_id}`);

      // Send Telegram alert to admin
      const contractor = db.prepare('SELECT name FROM users WHERE id = ?').get(payment.contractor_id) as any;
      const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
      if (adminChatId) {
        sendPaymentSuccessNotification(
          adminChatId,
          contractor?.name || 'Contractor',
          payment.amount,
          payment.credits
        ).catch((err) => console.error('[Payments] Failed to send telegram notification:', err.message));
      }
    } else if (status === 'EXPIRED') {
      db.prepare(`
        UPDATE payments 
        SET status = 'failed', updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(payment.id);
      console.log(`[Payments] Payment ${external_id} expired and marked failed`);
    }
  } else {
    console.log(`[Payments] Transaction ${external_id} already processed. Current status: ${payment.status}`);
  }

  res.status(200).json({ status: 'processed' });
});

export default pageRouter;
