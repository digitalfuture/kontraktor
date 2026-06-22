import { config as dotenvConfig } from 'dotenv';
import path from 'path';
import * as seoLib from './lib/seo';

// Load environment-specific config file (.env.production or .env.development)
const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = nodeEnv === 'production' ? '.env.production' : '.env.development';
dotenvConfig({ path: path.join(__dirname, '../', envFile) });

import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import compression from 'compression';
import { serviceIcons, defaultServiceIcon } from './config/service-icons';
import { renderJsonLd, renderAlternateLinks } from './lib/seo/render';

// Initialize DB (creates tables + seeds data)
import db from './db';

import servicesRouter from './routes/services';
import { pageRouter as contractorsPages, apiRouter as contractorsApi } from './routes/contractors';
import projectsRouter from './routes/projects';
import sitemapRouter from './routes/sitemap';
import { pageRouter as postPages, apiRouter as postApi } from './routes/post';
import { pageRouter as adminPages, apiRouter as adminApi } from './routes/admin';
import { pageRouter as authPages, apiRouter as authApi } from './routes/auth';
import accountRouter from './routes/account';
import gaOptRouter from './routes/ga-opt';
import { apiRouter as contactApi } from './routes/contact';
import { pageRouter as paymentsPages, apiRouter as paymentsApi } from './routes/payments';
import { requireAuth, requireAdmin } from './middleware/auth';
import { i18nMiddleware } from './middleware/i18n';
import { csrfMiddleware } from './middleware/csrf';
import { startQueueProcessor, stopQueueProcessor } from './lib/email-queue';
import pkg from '../package.json';

const app = express();
app.set('trust proxy', 1);
const PORT: number = parseInt(process.env.PORT || '3002', 10);

const BUILD_VERSION = Date.now().toString();
const APP_VERSION = pkg.version;

app.use((req, res, next) => {
  res.locals.cssVersion = process.env.NODE_ENV === 'production' ? BUILD_VERSION : Date.now().toString();
  res.locals.appVersion = APP_VERSION;
  res.locals.buildTimestamp = BUILD_VERSION;
  next();
});

// Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
if (process.env.NODE_ENV !== 'production') {
  app.set('view options', { cache: false });
}
// Static files: images and fonts get long cache, CSS/JS get short cache with revalidation
app.use(express.static(path.join(__dirname, '../public'), {
  maxAge: 0, // Let setHeaders control per file type
  etag: true,
  lastModified: true,
  setHeaders(res, filePath) {
    if (/\.(css|js)$/i.test(filePath)) {
      // CSS and JS: 1 hour, must revalidate on every deploy
      res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
    } else if (/\.(png|jpg|jpeg|gif|ico|woff2|ttf|otf|eot|svg)$/i.test(filePath)) {
      // Images and fonts: 30 days, immutable
      res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
    }
  },
}));
app.use(compression()); // Gzip compression for all responses
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Security headers (CSP, HSTS disabled since production is HTTP-only without SSL/443 listener)
app.use(helmet({
  contentSecurityPolicy: false,
  hsts: false,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
}));

// i18n
app.use(i18nMiddleware);

// CSRF protection
app.use(csrfMiddleware);

// Make user available to all templates
app.use((req: express.Request, res: express.Response, next: express.NextFunction): void => {
  const token = req.cookies?.session_token;
  if (token) {
    const { getUserByToken } = require('./lib/auth');
    res.locals.user = getUserByToken(token) || null;
  }
  res.locals.GA_TRACKING_ID = process.env.GA_TRACKING_ID || null;
  res.locals.formatBudget = (budget: string | number | null | undefined, locale: string): string => {
    if (budget === null || budget === undefined || budget === '') return '—';
    const cleaned = String(budget).replace(/[^0-9.-]+/g, '');
    const num = Number(cleaned);
    if (cleaned === '' || isNaN(num)) return String(budget);
    return locale === 'id'
      ? `${num.toLocaleString('id-ID')}`
      : `${num.toLocaleString('en-US')}`;
  };
  // Internal traffic detection — exclude server self-requests from analytics
  const internalIps = (process.env.INTERNAL_IPS || '').split(',').map(s => s.trim()).filter(Boolean);
  const clientIp = req.ip || req.socket?.remoteAddress || '';
  const isInternal = (
    clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === '::ffff:127.0.0.1' ||
    internalIps.includes(clientIp) ||
    (req.headers['user-agent'] || '').startsWith('Kontraktor-SEO/') ||
    (req.headers['user-agent'] || '').startsWith('Kontraktor-Sitemap/')
  );
  res.locals.GA_DISABLED = isInternal || req.cookies?.ga_opt_out === '1';

  // SEO render helpers for templates
  res.locals.renderJsonLd = (seoData: any) => renderJsonLd(seoData);
  res.locals.renderAlternateLinks = (seoData: any) => renderAlternateLinks(seoData);

  next();
});

// Health check endpoint (no auth, no rate limit)
app.get('/health', (_req: express.Request, res: express.Response): void => {
  res.json({ status: 'ok', uptime: process.uptime(), memory: process.memoryUsage().heapUsed });
});

// Routes — Pages
app.get('/', (req: express.Request, res: express.Response): void => {
  const locale = (res.locals.locale as string) || 'en';
  const t = res.locals.t;
  
  const categories = db.prepare('SELECT id, slug FROM categories WHERE is_active = 1').all() as Array<{ id: number; slug: string }>;
  const services = categories.map((cat) => {
    const totalContractors = db.prepare('SELECT COUNT(*) as count FROM contractors WHERE category_id = ? AND is_approved = 1 AND is_active = 1').get(cat.id) as { count: number };
    const firstSub = db.prepare('SELECT price_from FROM subcategories WHERE category_id = ? ORDER BY name LIMIT 1').get(cat.id) as { price_from: string } | undefined;
    const marketPrice = firstSub ? (firstSub.price_from || '') : '';
    const hasContractors = totalContractors.count > 0;
    return {
      slug: cat.slug,
      totalContractors: totalContractors.count,
      marketPrice,
      hasContractors,
    };
  });

  const reviews = db.prepare('SELECT author_email, rating, comment FROM reviews WHERE is_moderated = 1 ORDER BY created_at DESC LIMIT 3').all();

  res.render('index', {
    seo: seoLib.homePageSeo(locale as 'en' | 'id'),
    title: `${t('site.name')} — ${t('site.tagline')}`,
    iconMap: serviceIcons,
    defaultIcon: defaultServiceIcon,
    services,
    reviews,
  });
});

app.use('/services', servicesRouter);
app.use('/static/docs', express.static(path.join(__dirname, '../docs')));
app.use('/projects', requireAuth, projectsRouter);
app.use('/sitemap.xml', sitemapRouter);
app.use('/contractors', contractorsPages);
app.use('/post', postPages);
app.use('/auth', authPages);
app.use('/account', accountRouter);
app.use(gaOptRouter);
app.use('/payments', paymentsPages);

// Routes — API (flat /api/ namespace)
app.use('/api/auth', authApi);
app.use('/api/contact', contactApi);
app.use('/api/contractors', contractorsApi);
app.use('/api/payments', paymentsApi);
app.use('/api/post', postApi);

// Admin pages (with auth guard)
app.use('/admin', requireAuth, requireAdmin, adminPages);
// Admin API (with auth guard)
app.use('/api/admin', requireAuth, requireAdmin, adminApi);

app.get('/terms', (req: express.Request, res: express.Response): void => {
  const locale = (res.locals.locale as string) || 'en';
  res.render('terms', {
    seo: seoLib.termsSeo(locale as 'en' | 'id'),
  });
});

app.get('/privacy', (req: express.Request, res: express.Response): void => {
  const locale = (res.locals.locale as string) || 'en';
  res.render('privacy', {
    seo: seoLib.privacySeo(locale as 'en' | 'id'),
  });
});

// 404 handler — log to file for SEO/analytics tracking
app.use((req: express.Request, res: express.Response): void => {
  const ua = req.headers['user-agent'] || '';
  const ref = req.headers['referer'] || '-';
  if (!ua.startsWith('Kontraktor-SEO/')) {
    console.log(`[404] ${req.method} ${req.url} — referer: ${ref} — ${ua.slice(0, 80)}`);
  }
  res.status(404).render('error', {
    message: res.locals.t ? res.locals.t('error.notFound') : 'Not Found',
    statusCode: 404,
  });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction): void => {
  console.error('ERROR:', err.message);
  console.error(err.stack);
  try { require('fs').appendFileSync('/tmp/express-error.log', `${new Date().toISOString()} ERROR: ${err.message}\n${err.stack}\n\n`); } catch(_) {}
  res.status(500).render('error', { message: 'Internal Server Error' });
});

const HOST =
  nodeEnv === 'production'
    ? '127.0.0.1'
    : '0.0.0.0';

const server = app.listen(PORT, HOST, (): void => {
  console.log(`Kontraktor ${process.env.NODE_ENV || 'dev'} server running on http://127.0.0.1:${PORT}`);

  // Rescue campaigns stuck in 'sending' status after unclean shutdown
  try {
    const zombieCampaigns = db.prepare(`
      SELECT id, name FROM email_campaigns
      WHERE status = 'sending'
    `).all() as Array<{ id: number; name: string }>;

    if (zombieCampaigns.length > 0) {
      for (const c of zombieCampaigns) {
        // Only rescue if no active queue items for this campaign
        const activeItems = db.prepare(`
          SELECT COUNT(*) as count FROM email_queue
          WHERE campaign_id = ? AND status IN ('queued', 'processing')
        `).get(c.id) as { count: number };

        if (activeItems.count === 0) {
          db.prepare("UPDATE email_campaigns SET status = 'stopped' WHERE id = ?").run(c.id);
          console.log(`[startup] Rescued zombie campaign #${c.id} "${c.name}" → stopped`);
        }
      }
    }
  } catch (err) {
    console.error('[startup] Error rescuing zombie campaigns:', err);
  }

  // Start background email queue processor
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    startQueueProcessor(3000);
  }
});

// Graceful shutdown
function gracefulShutdown(signal: string): void {
  console.log(`\n${signal} received — shutting down gracefully...`);
  stopQueueProcessor();
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
  // Force close after 10s
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
