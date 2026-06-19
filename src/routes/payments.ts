import express, { Request, Response } from 'express';
import https from 'https';
import db from '../db';
import { requireAuth } from '../middleware/auth';
import { sendPaymentSuccessNotification } from '../lib/telegram';

const XENDIT_API_KEY = process.env.XENDIT_API_KEY || '';
const XENDIT_CALLBACK_TOKEN = process.env.XENDIT_CALLBACK_TOKEN || '';

export const CREDIT_PACKAGES = [
  { id: 'pack_10', credits: 10, price: 100000, name_en: 'Starter Pack', name_id: 'Paket Pemula' },
  { id: 'pack_30', credits: 30, price: 250000, name_en: 'Pro Pack', name_id: 'Paket Pro' },
  { id: 'pack_100', credits: 100, price: 700000, name_en: 'Enterprise Pack', name_id: 'Paket Perusahaan' }
];

// Helper to make native HTTPS requests to Xendit
function createXenditInvoice(
  externalId: string,
  amount: number,
  email: string,
  description: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!XENDIT_API_KEY) {
      // If no API key configured, simulate payment flow link in development
      const devUrl = `${process.env.BASE_URL || 'http://localhost:3002'}/contractors/dashboard?payment=success`;
      console.log(`[Payments] No XENDIT_API_KEY set. Simulating invoice redirect to: ${devUrl}`);
      return resolve(devUrl);
    }

    const auth = Buffer.from(`${XENDIT_API_KEY}:`).toString('base64');
    const baseUrl = process.env.BASE_URL || 'http://localhost:3002';
    
    const postData = JSON.stringify({
      external_id: externalId,
      amount: amount,
      description: description,
      payer_email: email,
      invoice_duration: 86400, // 24 hours
      success_redirect_url: `${baseUrl}/contractors/dashboard?payment=success`,
      failure_redirect_url: `${baseUrl}/contractors/dashboard?payment=failed`
    });

    const options = {
      hostname: 'api.xendit.co',
      path: '/v2/invoices',
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data.invoice_url);
          } else {
            reject(new Error(data.message || `Xendit returned status ${res.statusCode}`));
          }
        } catch (e: any) {
          reject(new Error(`Failed to parse Xendit response: ${e.message}`));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.write(postData);
    req.end();
  });
}

// ── Pages ──

export const pageRouter: express.Router = express.Router();

// Display package selection screen — now redirected: bidding is free
pageRouter.get('/buy', requireAuth, (req: Request, res: Response): void => {
  res.redirect('/contractors/dashboard?free_bidding=true');
  return;
});

// ── API ──

export const apiRouter: express.Router = express.Router();

// Trigger checkout invoice creation
apiRouter.post('/create-invoice', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const locale = (res.locals.locale as string) || 'en';
  const { package_id } = req.body;

  if (user.role !== 'contractor' && user.role !== 'admin') {
    res.redirect('/account/profile');
    return;
  }

  const contractor = db.prepare('SELECT id FROM contractors WHERE email = ?').get(user.email) as any;
  if (!contractor) {
    res.redirect('/contractors/dashboard?error=not_contractor');
    return;
  }

  const pkg = CREDIT_PACKAGES.find(p => p.id === package_id);
  if (!pkg) {
    res.redirect('/payments/buy?error=invalid_package');
    return;
  }

  const externalId = `inv_${Date.now()}_${contractor.id}`;
  const description = locale === 'id' 
    ? `Pembelian ${pkg.credits} Kredit Penawaran - Kontraktor.app` 
    : `Purchase of ${pkg.credits} Bidding Credits - Kontraktor.app`;

  try {
    // Record payment intent in the DB
    db.prepare(`
      INSERT INTO payments (contractor_id, external_id, amount, credits, status)
      VALUES (?, ?, ?, ?, 'pending')
    `).run(contractor.id, externalId, pkg.price, pkg.credits);

    // Call Xendit to get payment screen URL
    const checkoutUrl = await createXenditInvoice(
      externalId,
      pkg.price,
      user.email,
      description
    );

    // If sandbox simulated (no api key), auto-credit the account in dev for convenience
    if (!XENDIT_API_KEY) {
      db.prepare("UPDATE contractors SET credits = credits + ? WHERE id = ?").run(pkg.credits, contractor.id);
      db.prepare("UPDATE payments SET status = 'completed', payment_method = 'SIMULATOR', updated_at = CURRENT_TIMESTAMP WHERE external_id = ?").run(externalId);
    }

    res.redirect(checkoutUrl);
  } catch (err: any) {
    console.error('[Payments] Invoice creation failed:', err.message);
    res.redirect('/payments/buy?error=init_failed');
  }
});

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
          UPDATE contractors 
          SET credits = credits + ? 
          WHERE id = ?
        `).run(payment.credits, payment.contractor_id);
      })();

      console.log(`[Payments] Successfully completed payment ${external_id}. Added ${payment.credits} credits to contractor ID ${payment.contractor_id}`);

      // Send Telegram alert to admin
      const contractor = db.prepare('SELECT name FROM contractors WHERE id = ?').get(payment.contractor_id) as any;
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
