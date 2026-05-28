import express, { Request, Response } from 'express';
import { sendMail } from '../lib/email';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/auth';

const router = express.Router();

const ADMIN_EMAIL = 'pulauberapi@gmail.com';

// Rate limit: 5 contact submissions per 15 minutes per IP
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many messages, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/', requireAuth, contactLimiter, async (req: Request, res: Response): Promise<void> => {
  const { name, email, message, website } = req.body;
  const t = res.locals.t;

  // Honeypot: if website field is filled, it's a bot
  if (website && website.trim()) {
    res.status(200).send('');
    return;
  }

  // Validation
  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    const locals = {
      error: t('contact.formError'),
      name: name || '',
      email: email || '',
      message: message || '',
      csrfToken: res.locals.csrfToken,
      locale: res.locals.locale,
    };
    if (req.headers['hx-request']) {
      res.render('partials/_contact-form', locals);
    } else {
      res.render('error', { message: t('contact.formError') });
    }
    return;
  }

  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 480px;">
      <h2 style="color: #ea580c;">New contact form submission</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 8px 0; color: #6b7280;">Name:</td><td style="padding: 8px 0; font-weight: 600;">${name}</td></tr>
        <tr><td style="padding: 8px 0; color: #6b7280;">Email:</td><td style="padding: 8px 0;">${email}</td></tr>
        <tr><td style="padding: 8px 0; color: #6b7280; vertical-align: top;">Message:</td><td style="padding: 8px 0;">${message.replace(/\n/g, '<br>')}</td></tr>
      </table>
    </div>
  `;

  try {
    await sendMail(ADMIN_EMAIL, `Contact form: ${name}`, html, email, name);
    const locals = {
      success: true,
      csrfToken: res.locals.csrfToken,
      locale: res.locals.locale,
    };
    if (req.headers['hx-request']) {
      res.render('partials/_contact-form', locals);
    } else {
      res.render('index', { title: t('contact.formSuccess'), success: true });
    }
  } catch (err) {
    console.error('Contact email send error:', err);
    const locals = {
      error: t('contact.sendError'),
      name: name || '',
      email: email || '',
      message: message || '',
      csrfToken: res.locals.csrfToken,
      locale: res.locals.locale,
    };
    if (req.headers['hx-request']) {
      res.render('partials/_contact-form', locals);
    } else {
      res.render('error', { message: t('contact.sendError') });
    }
  }
});

export default router;
