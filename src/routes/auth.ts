import express, { Request, Response } from 'express';
import db from '../db';
import { createMagicLink, verifyMagicLink, createSession, getUserByToken } from '../lib/auth';
import { sendMagicLinkEmail } from '../lib/email';
import { sendTelegramMagicLink } from '../lib/telegram';
import rateLimit from 'express-rate-limit';

// Rate limit: 5 magic link requests per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Pages ──

export const pageRouter: express.Router = express.Router();

// Login page
pageRouter.get('/login', (_req: Request, res: Response): void => {
  res.render('auth/login', { title: 'Sign In — Kontraktor' });
});

// Verify magic link
pageRouter.get('/verify', (req: Request, res: Response): void => {
  const token: string = req.query.token as string;

  if (!token) {
    res.redirect('/auth/login');
    return;
  }

  const email = verifyMagicLink(token);
  if (!email) {
    res.render('auth/login', { title: 'Sign In — Kontraktor', error: 'Link expired or already used' });
    return;
  }

  // Find or create user
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: number } | undefined;
  let userId: number;

  if (existing) {
    userId = existing.id;
  } else {
    const result = db.prepare('INSERT INTO users (email, role) VALUES (?, ?)').run(email, 'client');
    userId = result.lastInsertRowid as number;
  }

  // Create session (60 days)
  const sessionToken = createSession(userId);

  // Set cookie
  res.cookie('session_token', sessionToken, {
    maxAge: 60 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
  });

  // Redirect based on role
  const user = getUserByToken(sessionToken);
  if (user?.role === 'admin') {
    res.redirect('/admin');
  } else {
    res.redirect('/account');
  }
});

// ── API ──

export const apiRouter: express.Router = express.Router();

// Send magic link (POST) — rate limited
apiRouter.post('/login', loginLimiter, async (req: Request, res: Response): Promise<void> => {
  const email: string = req.body.email?.trim();

  if (!email || !email.includes('@')) {
    res.render('auth/login', { title: 'Вход — Kontraktor', error: 'Введите корректный email' });
    return;
  }

  // Create or find user
  const existing = db.prepare('SELECT id, telegram_id FROM users WHERE email = ?').get(email) as { id: number; telegram_id: string | null } | undefined;
  let userId: number;
  let telegramId: string | null = null;

  if (existing) {
    userId = existing.id;
    telegramId = existing.telegram_id;
  } else {
    const result = db.prepare('INSERT INTO users (email, role) VALUES (?, ?)').run(email, 'client');
    userId = result.lastInsertRowid as number;
  }

  // Create magic link with dynamic request-based base URL to prevent dev/prod mismatches
  const token = createMagicLink(email);
  const host = req.get('host') || 'localhost:3002';
  const protocol = req.protocol || 'http';
  // Enforce https if request is secure, or if the production BASE_URL is set to https and we are on the production domain
  const isSecure = req.secure || (host.includes('kontraktor.app') && process.env.BASE_URL && process.env.BASE_URL.startsWith('https'));
  const linkBaseUrl = `${isSecure ? 'https' : protocol}://${host}`;
  const link = `${linkBaseUrl}/auth/verify?token=${token}`;

  // Send via email
  let emailSent = false;
  if (process.env.SMTP_HOST) {
    try {
      await sendMagicLinkEmail(email, link);
      emailSent = true;
    } catch (err) {
      console.error('Email send error:', err);
    }
  }

  // Send via Telegram if user provided telegram_id
  let telegramSent = false;
  const telegramInput = (req.body.telegram || '').trim();
  // Use input from form, or existing user's telegram_id
  const effectiveTelegram = telegramInput || telegramId;
  if (effectiveTelegram) {
    // Save telegram_id to user if new
    if (telegramInput && !telegramId) {
      db.prepare('UPDATE users SET telegram_id = ? WHERE id = ?').run(telegramInput, userId);
    }
    try {
      await sendTelegramMagicLink(effectiveTelegram, link);
      telegramSent = true;
    } catch (err) {
      console.error('Telegram send error:', err);
    }
  }

  res.render('auth/link-sent', { 
    title: 'Ссылка отправлена — Kontraktor',
    email,
    emailSent,
    telegramSent
  });
});

// Logout
pageRouter.get('/logout', (req: Request, res: Response): void => {
  const token = req.cookies?.session_token;
  if (token) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }
  res.clearCookie('session_token');
  res.redirect('/');
});

export default pageRouter;
