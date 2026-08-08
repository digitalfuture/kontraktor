import express, { Request, Response } from 'express';
import db from '../db';

const router: express.Router = express.Router();

// Dynamic sitemap from DB
router.get('/', (_req: Request, res: Response): void => {
  const baseUrl = process.env.BASE_URL || 'https://kontraktor.app';
  const host = (_req as any).headers?.host;

  // Do NOT expose a sitemap on non-production hosts (dev/staging would
  // advertise dev URLs to search engines and get them indexed).
  const hostname = (host || '').split(':')[0];
  const isNonProd = hostname.startsWith('dev.') || hostname === 'localhost' || hostname.startsWith('127.') || hostname.startsWith('192.168.');
  if (isNonProd) {
    res.type('application/xml');
    res.send('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
    return;
  }
  const url = host ? `https://${host}` : baseUrl;

  const projects = db.prepare(`
    SELECT id, created_at FROM projects WHERE status IN ('pending', 'in_progress') ORDER BY created_at DESC LIMIT 100
  `).all() as any[];

  const contractors = db.prepare(`
    SELECT id, created_at FROM users WHERE is_contractor = 1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 100
  `).all() as any[];

  const categories = db.prepare(`
    SELECT slug FROM categories WHERE is_active = 1 AND deleted_at IS NULL
  `).all() as any[];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${url}/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${url}/services</loc>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
`;

  categories.forEach((cat: any) => {
    xml += `  <url>
    <loc>${url}/services/${cat.slug}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
`;
  });

  projects.forEach((p: any) => {
    xml += `  <url>
    <loc>${url}/post/${p.id}</loc>
    <lastmod>${p.created_at.split(' ')[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.6</priority>
  </url>
`;
  });

  contractors.forEach((c: any) => {
    xml += `  <url>
    <loc>${url}/contractors/${c.id}</loc>
    <lastmod>${c.created_at.split(' ')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.5</priority>
  </url>
`;
  });

  xml += `  <url>
    <loc>${url}/terms</loc>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>${url}/privacy</loc>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>
</urlset>`;

  res.setHeader('Content-Type', 'application/xml');
  res.send(xml);
});

export default router;
