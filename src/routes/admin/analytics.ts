// ── Admin — Analytics & Diagrams ──

import express, { Request, Response } from 'express';
import db from '../../db';
import { getProjectsMapData } from '../../lib/project-geo';
import { makeT } from './helpers';
import { getTopCities, getTotalViews } from '../../lib/analytics-db';
import { getCacheStatus, invalidateCache } from '../../lib/google-analytics';

export function registerAnalyticsRoutes(pageRouter: express.Router, apiRouter: express.Router): void {

  // ── ANALYTICS PAGE ──

  pageRouter.get('/analytics', async (req: Request, res: Response): Promise<void> => {
    const _t = makeT(res);
    const startDate = (req.query.start as string) || '7daysAgo';
    const endDate = (req.query.end as string) || 'today';

    try {
      const { getDailyMetrics, getRealtimeMetrics, getTopPages, getTrafficSources, getTrafficTrend } = await import('../../lib/google-analytics');

      const days = parseInt(startDate, 10) || 7;

      const [daily, realtime, topPages, sources, trend, monthly] = await Promise.all([
        getDailyMetrics(),
        getRealtimeMetrics().catch(() => ({ activeUsers: 0, screenPageViews: 0 })),
        getTopPages(10).catch(() => []),
        getTrafficSources(10).catch(() => []),
        getTrafficTrend(days).catch(() => []),
        getTrafficTrend(30).catch(() => []),
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
        SELECT
          CASE WHEN is_contractor = 1 THEN 'contractor' ELSE role END as role,
          COUNT(*) as count
        FROM users WHERE deleted_at IS NULL
        GROUP BY role
      `).all() as any[];

      const cacheStatus = getCacheStatus();
      const topCities = getTopCities(days);
      const totalDbViews = getTotalViews(days);

      res.render('admin/analytics', {
        title: _t('admin.analytics') + ' — Kontraktor',
        activePage: 'analytics',
        categoryStats,
        roleStats,
        daily,
        realtime,
        topPages,
        sources,
        trend,
        monthly,
        startDate,
        endDate,
        cacheStatus,
        topCities,
        totalDbViews,
      });
    } catch (err) {
      console.error('Analytics error:', err);
      const cacheStatus = getCacheStatus();
      const topCities = getTopCities(7);
      const totalDbViews = getTotalViews(7);

      res.render('admin/analytics', {
        title: _t('admin.analytics') + ' — Kontraktor',
        activePage: 'analytics',
        daily: null,
        realtime: { activeUsers: 0, screenPageViews: 0 },
        topPages: [],
        sources: [],
        trend: [],
        monthly: [],
        startDate,
        endDate,
        cacheStatus,
        topCities,
        totalDbViews,
        error: 'Analytics data unavailable. Check Google OAuth configuration.',
      });
    }
  });

  // ── API: Clear Analytics Cache ──
  apiRouter.post('/analytics/cache/clear', (req: Request, res: Response): void => {
    invalidateCache();
    res.json({ success: true, message: 'Analytics cache cleared' });
  });

  // ── API: Traffic trend for the monthly chart ──

  apiRouter.get('/analytics/trend', async (req: Request, res: Response): Promise<void> => {
    try {
      const { getTrafficTrend, getTrafficTrendCompare } = await import('../../lib/google-analytics');
      const days = Math.min(90, Math.max(7, parseInt(req.query.days as string, 10) || 30));
      if (req.query.compare === '1') {
        const data = await getTrafficTrendCompare(days);
        res.json(data);
        return;
      }
      const data = await getTrafficTrend(days);
      res.json(data || []);
    } catch (err) {
      console.error('Trend API error:', err);
      res.status(500).json({ error: 'Failed to load trend' });
    }
  });

  // ── DIAGRAMS PAGE ──

  pageRouter.get('/diagrams', (req: Request, res: Response): void => {
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
      SELECT
        CASE WHEN is_contractor = 1 THEN 'contractor' ELSE role END as role,
        COUNT(*) as count
      FROM users WHERE deleted_at IS NULL
      GROUP BY role
    `).all() as any[];
    res.render('admin/diagrams', {
      title: _t('admin.diagrams') + ' — Kontraktor',
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
        LEFT JOIN users c ON p.assigned_contractor_id = c.id
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

  const handleMapData = (req: Request, res: Response): void => {
    try {
      const status = (req.query.status as string || '').trim();
      const category = (req.query.category as string || '').trim();
      const mapData = getProjectsMapData({
        status: status || undefined,
        category: category || undefined,
      });
      res.json(mapData);
    } catch (err) {
      console.error('Error generating map data:', err);
      res.status(500).json({ error: 'Failed to generate map data' });
    }
  };

  apiRouter.get('/map', handleMapData);
  apiRouter.get('/projects/map', handleMapData);

  // ── API: Network graph ──

  apiRouter.get('/network-graph', (req: Request, res: Response): void => {
    try {
      const users = db.prepare('SELECT email as id, name as label, role as "group" FROM users').all() as any[];
      const contractors = db.prepare(`SELECT email as id, name as label, 'contractor' as "group" FROM users WHERE is_contractor = 1`).all() as any[];

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
        JOIN users c ON p.assigned_contractor_id = c.id
        WHERE p.client_email IS NOT NULL AND c.email IS NOT NULL
      `).all() as { source: string, target: string }[];

      const reviewLinks = db.prepare(`
        SELECT r.author_email as source, c.email as target
        FROM reviews r
        JOIN users c ON r.contractor_id = c.id
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
