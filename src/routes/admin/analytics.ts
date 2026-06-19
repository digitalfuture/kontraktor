// ── Admin — Analytics & Diagrams ──

import express, { Request, Response } from 'express';
import db from '../../db';
import { getDistrictDisplay } from '../../lib/districts';
import districtsData from '../../data/districts.json';
import provinceCentroids from '../../data/province-centroids.json';
import { makeT, getPagination } from './helpers';

export function registerAnalyticsRoutes(pageRouter: express.Router, apiRouter: express.Router): void {

  // ── ANALYTICS PAGE ──

  pageRouter.get('/analytics', async (req: Request, res: Response): Promise<void> => {
    const locale = (res.locals.locale as string) || 'en';
    const _t = makeT(res);
    const startDate = (req.query.start as string) || '7daysAgo';
    const endDate = (req.query.end as string) || 'today';

    try {
      const { getDailyMetrics, getRealtimeMetrics, getTopPages, getTrafficSources, getTrafficTrend } = await import('../../lib/google-analytics');

      const days = parseInt(startDate, 10) || 7;

      const [daily, realtime, topPages, sources, trend] = await Promise.all([
        getDailyMetrics(),
        getRealtimeMetrics().catch(() => ({ activeUsers: 0, screenPageViews: 0 })),
        getTopPages(10).catch(() => []),
        getTrafficSources(10).catch(() => []),
        getTrafficTrend(days).catch(() => ({ dates: [], values: [] })),
      ]);

      const categoryStats = db.prepare(`
        SELECT c.slug, c.name, COUNT(p.id) as count
        FROM categories c
        LEFT JOIN projects p ON p.category = c.slug
        WHERE c.is_active = 1
        GROUP BY c.slug
        ORDER BY count DESC
      `).all() as any[];
      const roleStats = db.prepare(`
        SELECT role, COUNT(*) as count FROM (
          SELECT role FROM users WHERE deleted_at IS NULL
          UNION ALL
          SELECT 'contractor' as role FROM contractors WHERE is_active = 1
        ) GROUP BY role
      `).all() as any[];

      res.render('admin/diagrams', {
        title: _t('titles.analytics') + ' — Kontraktor',
        activePage: 'diagrams',
        categoryStats,
        roleStats,
        daily,
        realtime,
        topPages,
        sources,
        trend,
        startDate,
        endDate,
      });
    } catch (err) {
      console.error('Analytics error:', err);
      res.render('admin/diagrams', {
        title: _t('titles.analytics') + ' — Kontraktor',
        activePage: 'diagrams',
        daily: null,
        realtime: { activeUsers: 0, screenPageViews: 0 },
        topPages: [],
        sources: [],
        trend: { dates: [], values: [] },
        startDate,
        endDate,
        error: 'Analytics data unavailable. Check Google OAuth configuration.',
      });
    }
  });

  // ── DIAGRAMS PAGE ──

  pageRouter.get('/diagrams', (req: Request, res: Response): void => {
    const locale = (res.locals.locale as string) || 'en';
    const _t = makeT(res);
    const categoryStats = db.prepare(`
      SELECT c.slug, c.name, COUNT(p.id) as count
      FROM categories c
      LEFT JOIN projects p ON p.category = c.slug
      WHERE c.is_active = 1
      GROUP BY c.slug
      ORDER BY count DESC
    `).all() as any[];
    const roleStats = db.prepare(`
      SELECT role, COUNT(*) as count FROM (
        SELECT role FROM users WHERE deleted_at IS NULL
        UNION ALL
        SELECT 'contractor' as role FROM contractors WHERE is_active = 1
      ) GROUP BY role
    `).all() as any[];
    res.render('admin/diagrams', {
      title: _t('titles.diagrams') + ' — Kontraktor',
      activePage: 'diagrams',
      activeSubPage: 'diagrams',
      categoryStats,
      roleStats,
    });
  });

  // ── API: Sankey diagram data ──

  apiRouter.get('/sankey', (req: Request, res: Response): void => {
    try {
      const lang = (req.query.lang as string) || 'id';
      const projects = db.prepare(`
        SELECT p.id, p.title,
               COALESCE(p.contact_name, p.client_email, 'Unknown') as client_name,
               COALESCE(c.name, c.email, NULL) as contractor_name
        FROM projects p
        LEFT JOIN contractors c ON p.assigned_contractor_id = c.id
        WHERE p.status IN ('pending', 'in_progress')
      `).all() as any[];

      if (projects.length === 0) {
        res.json({ nodes: [], links: [] });
        return;
      }

      const clientMap = new Map<string, number>();
      const contractorMap = new Map<string, number>();
      const nodes: { name: string; type: string }[] = [];
      const links: { source: number; target: number; value: number }[] = [];

      projects.forEach((p: any) => {
        const cname = p.client_name || 'Unknown';
        if (!clientMap.has(cname)) {
          clientMap.set(cname, nodes.length);
          nodes.push({ name: cname, type: 'client' });
        }

        const pIdx = nodes.length;
        const pname = lang === 'en' ? (p.title || `Project #${p.id}`) : (p.title || `Proyek #${p.id}`);
        nodes.push({ name: pname, type: 'project' });

        links.push({ source: clientMap.get(cname)!, target: pIdx, value: 1 });

        if (p.contractor_name) {
          const tname = p.contractor_name;
          if (!contractorMap.has(tname)) {
            contractorMap.set(tname, nodes.length);
            nodes.push({ name: tname, type: 'contractor' });
          }
          links.push({ source: pIdx, target: contractorMap.get(tname)!, value: 1 });
        }
      });

      res.json({ nodes, links });
    } catch (err) {
      console.error('Error generating sankey data:', err);
      res.status(500).json({ error: 'Failed to generate sankey data' });
    }
  });

  // ── API: Category→Status Sankey ──

  apiRouter.get('/sankey-category-status', (req: Request, res: Response): void => {
    try {
      const _lang = (req.query.lang as string) || 'id';
      const sankeyData = db.prepare(`
        SELECT c.name as category_name, p.status, COUNT(*) as count
        FROM projects p
        JOIN categories c ON p.category = c.slug
        GROUP BY c.slug, p.status
      `).all() as any[];

      if (sankeyData.length === 0) {
        res.json({ nodes: [], links: [] });
        return;
      }

      const categories = [...new Set(sankeyData.map((d: any) => d.category_en))];
      const statuses = [...new Set(sankeyData.map((d: any) => d.status))];

      const nodes = [
        ...categories.map((c: string) => ({ name: c, type: 'category' })),
        ...statuses.map((s: string) => ({ name: s, type: 'status' }))
      ];

      const links = sankeyData.map((d: any) => ({
        source: categories.indexOf(d.category_en),
        target: categories.length + statuses.indexOf(d.status),
        value: d.count
      }));

      res.json({ nodes, links });
    } catch (err) {
      console.error('Error generating category-status sankey:', err);
      res.status(500).json({ error: 'Failed to generate sankey data' });
    }
  });

  // ── API: Map data ──

  apiRouter.get('/map', (req: Request, res: Response): void => {
    try {
      const projects = db.prepare(`
        SELECT p.id, p.title, p.status, p.district,
               COALESCE(p.contact_name, p.client_email, 'Unknown') as client_name
        FROM projects p
        WHERE p.district IS NOT NULL AND p.district != ''
      `).all() as any[];

      const districtToProvince = new Map<string, string>();
      (districtsData as any[]).forEach((d: any) => {
        districtToProvince.set(d.name, d.province);
        const short = d.name.replace(/ (City|Regency|Municipality)$/i, '');
        if (!districtToProvince.has(short)) districtToProvince.set(short, d.province);
      });

      const provinceMap = new Map<string, { projects: any[]; lat: number; lng: number }>();
      projects.forEach((p: any) => {
        const province = districtToProvince.get(p.district) || 'Unknown';
        const centroid = (provinceCentroids as any)[province];
        if (!centroid) return;
        if (!provinceMap.has(province)) {
          provinceMap.set(province, { projects: [], lat: centroid[0], lng: centroid[1] });
        }
        provinceMap.get(province)!.projects.push({
          id: p.id,
          title: p.title,
          status: p.status,
          client: p.client_name,
          district: p.district,
        });
      });

      const markers = Array.from(provinceMap.entries()).map(([province, data]) => ({
        province,
        lat: data.lat,
        lng: data.lng,
        total: data.projects.length,
        pending: data.projects.filter(p => p.status === 'pending').length,
        accepted: data.projects.filter(p => ['in_progress', 'completed'].includes(p.status)).length,
        projects: data.projects,
      }));

      res.json({ markers });
    } catch (err) {
      console.error('Error generating map data:', err);
      res.status(500).json({ error: 'Failed to generate map data' });
    }
  });

  // ── API: Network graph ──

  apiRouter.get('/network-graph', (req: Request, res: Response): void => {
    try {
      const users = db.prepare('SELECT email as id, name as label, role as "group" FROM users').all() as any[];
      const contractors = db.prepare(`SELECT email as id, name as label, 'contractor' as "group" FROM contractors`).all() as any[];

      const nodesMap = new Map();
      users.forEach(u => nodesMap.set(u.id, u));
      contractors.forEach(c => {
        if (!nodesMap.has(c.id)) {
          nodesMap.set(c.id, c);
        } else {
          nodesMap.get(c.id).group = 'contractor';
        }
      });

      const nodes = Array.from(nodesMap.values());

      const projectLinks = db.prepare(`
        SELECT p.client_email as source, c.email as target
        FROM projects p
        JOIN contractors c ON p.assigned_contractor_id = c.id
        WHERE p.client_email IS NOT NULL AND c.email IS NOT NULL
      `).all() as { source: string, target: string }[];

      const reviewLinks = db.prepare(`
        SELECT r.author_email as source, c.email as target
        FROM reviews r
        JOIN contractors c ON r.contractor_id = c.id
        WHERE r.author_email IS NOT NULL AND c.email IS NOT NULL
      `).all() as { source: string, target: string }[];

      const links = [...projectLinks, ...reviewLinks];

      res.json({ nodes, links });
    } catch (err) {
      console.error('Error generating network graph:', err);
      res.status(500).json({ error: 'Failed to generate network graph data' });
    }
  });

  // ── API: Sitemap content ──

  apiRouter.get('/diagrams/sitemap-content', (req: Request, res: Response): void => {
    const fs = require('fs');
    const path = require('path');
    const sitemapPath = path.join(__dirname, '../../../docs/sitemap.html');
    try {
      const content = fs.readFileSync(sitemapPath, 'utf-8');
      res.send(content);
    } catch {
      res.status(404).send('Sitemap not generated yet. Run: npm run generate-sitemap');
    }
  });
}
