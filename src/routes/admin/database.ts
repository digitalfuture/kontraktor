// ── Admin — Database Browser ──

import express, { Request, Response } from 'express';
import db from '../../db';
import { makeT } from './helpers';

export function registerDatabaseRoutes(pageRouter: express.Router, apiRouter: express.Router): void {

  // ── BROWSER PAGE ──

  pageRouter.get('/database', (req: Request, res: Response): void => {
    const locale = (res.locals.locale as string) || 'en';
    const _t = makeT(res);

    // Get all tables
    const tables = db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
    ).all() as { name: string }[];

    // Get row counts
    const tableInfo = tables.map(t => {
      const count = (db.prepare(`SELECT COUNT(*) as count FROM "${t.name}"`).get() as { count: number }).count;
      return { name: t.name, rows: count };
    });

    res.render('admin/database', {
      title: (locale === 'id' ? 'Database — Admin' : 'Database — Admin') + ' — Kontraktor',
      activePage: 'database',
      tables: tableInfo,
    });
  });

  // ── API: Table schema ──

  apiRouter.get('/db/schema/:table', (req: Request, res: Response): void => {
    const table = req.params.table as string;
    if (!isSafeTableName(table)) {
      res.status(400).json({ error: 'Invalid table name' });
      return;
    }
    const columns = db.prepare(`PRAGMA table_info("${table}")`).all() as any[];
    res.json({ table, columns });
  });

  // ── API: Table data (paginated) ──

  apiRouter.get('/db/data/:table', (req: Request, res: Response): void => {
    const table = req.params.table as string;
    if (!isSafeTableName(table)) {
      res.status(400).json({ error: 'Invalid table name' });
      return;
    }

    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
    const offset = (page - 1) * limit;
    const search = (req.query.search as string) || '';

    const total = (db.prepare(`SELECT COUNT(*) as count FROM "${table}"`).get() as { count: number }).count;

    let data: any[];
    if (search) {
      // Simple search: try to filter by text columns
      const columns = db.prepare(`PRAGMA table_info("${table}")`).all() as any[];
      const textCols = columns
        .filter((c: any) => c.type?.toLowerCase().includes('text') || c.type?.toLowerCase().includes('varchar') || c.type?.toLowerCase().includes('char'))
        .map((c: any) => c.name);
      if (textCols.length > 0) {
        const conditions = textCols.map(c => `"${c}" LIKE ?`).join(' OR ');
        const like = `%${search}%`;
        const params = textCols.map(() => like);
        data = db.prepare(`SELECT * FROM "${table}" WHERE ${conditions} ORDER BY rowid DESC LIMIT ? OFFSET ?`).all(...params, limit, offset) as any[];
      } else {
        data = [];
      }
    } else {
      data = db.prepare(`SELECT * FROM "${table}" ORDER BY rowid DESC LIMIT ? OFFSET ?`).all(limit, offset) as any[];
    }

    // Get column names
    const columns = data.length > 0 ? Object.keys(data[0]) : [];

    res.json({
      table,
      columns,
      rows: data,
      page,
      limit,
      offset,
      total,
      totalPages: Math.ceil(total / limit),
    });
  });

  // ── API: Table list ──

  apiRouter.get('/db/tables', (req: Request, res: Response): void => {
    const tables = db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
    ).all() as { name: string }[];

    const tableInfo = tables.map(t => {
      const count = (db.prepare(`SELECT COUNT(*) as count FROM "${t.name}"`).get() as { count: number }).count;
      return { name: t.name, rows: count };
    });
    res.json({ tables: tableInfo });
  });
}

function isSafeTableName(name: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}
