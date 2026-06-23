// ── Admin — Backup & Restore ──
// Journal of restore points (Litestream + archive backups)
// with web-based restore and undo.

import express, { Request, Response } from 'express';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { makeT } from './helpers';

const APP_DIR = path.resolve(__dirname, '../../..');
const BACKUP_DIR = path.join(APP_DIR, 'backups');
const LITESTREAM_DIR = path.join(BACKUP_DIR, 'litestream');
const RESTORE_REQUEST = path.join(BACKUP_DIR, 'restore-request.json');
const RESTORE_STATUS = path.join(BACKUP_DIR, 'restore-status.json');
const RESTORE_HISTORY = path.join(BACKUP_DIR, 'restore-history.json');
const MAINTENANCE_FLAG = path.join(APP_DIR, '.maintenance');

function readJSON(p: string): any {
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return null; }
}

function writeJSON(p: string, data: any): void {
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

function shell(cmd: string): string {
  try { return execSync(cmd, { timeout: 5000, encoding: 'utf-8' }).trim(); }
  catch { return ''; }
}

// ── Get restore points ──
function getRestorePoints(): any[] {
  const points: any[] = [];
  const now = new Date().toISOString();

  // 1. Latest point (litestream current state)
  points.push({
    type: 'litestream',
    id: 'latest',
    label: 'Latest (current state via WAL)',
    time: now,
    source: 'Litestream continuous WAL',
    size: ''
  });

  // 2. Archive backups (daily full backups)
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.match(/^kontraktor_prod_(\d{8}_\d{6})\.db\.gz$/))
      .sort()
      .reverse();
    for (const f of files) {
      const m = f.match(/^kontraktor_prod_(\d{8}_\d{6})\.db\.gz$/);
      if (!m) continue;
      const ts = m[1];
      const yr = ts.slice(0, 4), mo = ts.slice(4, 6), dy = ts.slice(6, 8);
      const hr = ts.slice(9, 11), mi = ts.slice(11, 13);
      const stat = fs.statSync(path.join(BACKUP_DIR, f));
      points.push({
        type: 'archive',
        id: ts,
        label: `Archive ${yr}-${mo}-${dy} ${hr}:${mi}`,
        time: new Date(stat.mtime).toISOString(),
        source: 'Daily full backup',
        size: formatSize(stat.size),
        filename: f
      });
    }
  } catch { /* no archive dir */ }

  return points;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + 'B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
  return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
}

// ── Litestream generations info ──
function getLitestreamInfo(): any {
  const info: any = { running: false, archiveSize: '', generations: [] };

  // Check if process is up
  const psOut = shell('pm2 pid kontraktor-litestream 2>/dev/null');
  info.running = !!psOut && psOut !== '0';

  // Archive size
  try {
    if (fs.existsSync(LITESTREAM_DIR)) {
      const size = shell(`du -sh "${LITESTREAM_DIR}" 2>/dev/null`).split('\t')[0];
      info.archiveSize = size || '';
    }
  } catch { /* */ }

  return info;
}

// ── Restore history ──
function getRestoreHistory(): any[] {
  const h = readJSON(RESTORE_HISTORY);
  return h?.history || [];
}

function getLastRestore(): any {
  const h = readJSON(RESTORE_HISTORY);
  return h?.last_restore || null;
}

function addRestoreHistory(entry: any): void {
  let h = readJSON(RESTORE_HISTORY) || { history: [] };
  h.last_restore = entry;
  h.history.unshift(entry);
  if (h.history.length > 50) h.history = h.history.slice(0, 50);
  writeJSON(RESTORE_HISTORY, h);
}

// ════════════════════════════════════════
//  ROUTES
// ════════════════════════════════════════

export function registerBackupRoutes(pageRouter: express.Router, apiRouter: express.Router): void {

  // ── VIEW ──
  pageRouter.get('/backup', async (req: Request, res: Response): Promise<void> => {
    const _t = makeT(res);
    const status = readJSON(RESTORE_STATUS) || {};
    const lastRestore = getLastRestore();
    const points = getRestorePoints();
    const litestream = getLitestreamInfo();
    const maintenance = fs.existsSync(MAINTENANCE_FLAG);

    res.render('admin/backup', {
      title: 'Backup & Restore — Kontraktor',
      activePage: 'backup',
      points,
      litestream,
      maintenance,
      lastRestore,
      pendingRequest: status.pending || false,
      statusMessage: status.message || ''
    });
  });

  // ── API: Journal (JSON) ──
  apiRouter.get('/backup/journal', (req: Request, res: Response): void => {
    const points = getRestorePoints();
    const litestream = getLitestreamInfo();
    const lastRestore = getLastRestore();
    const status = readJSON(RESTORE_STATUS) || {};
    const pending = status.pending ? readJSON(RESTORE_REQUEST) : null;
    const maintenance = fs.existsSync(MAINTENANCE_FLAG);

    res.json({ points, litestream, lastRestore, pending, maintenance, history: getRestoreHistory() });
  });

  // ── API: Trigger restore ──
  apiRouter.post('/backup/restore', express.json(), (req: Request, res: Response): void => {
    const { target, label } = req.body || {};

    if (!target) {
      res.status(400).json({ error: 'Target is required' });
      return;
    }

    // Check if already pending
    if (fs.existsSync(RESTORE_REQUEST)) {
      res.status(409).json({ error: 'A restore is already pending or in progress' });
      return;
    }

    // Create request
    const request = {
      target,
      label: label || target,
      requestedAt: new Date().toISOString(),
      requestedBy: (res.locals as any).user?.email || 'unknown'
    };

    writeJSON(RESTORE_REQUEST, request);
    writeJSON(RESTORE_STATUS, { pending: true, message: 'Restore requested. Worker will process shortly.', request });

    // If worker not running, trigger via maintenance script
    shell(`bash "${APP_DIR}/scripts/restore-worker.sh" &`);

    res.json({ status: 'requested', request });
  });

  // ── API: Undo last restore ──
  apiRouter.post('/backup/undo', (req: Request, res: Response): void => {
    const last = getLastRestore();
    if (!last || !last.pre_restore_file) {
      res.status(400).json({ error: 'No undo data available (no previous restore found)' });
      return;
    }

    const preRestorePath = path.join(BACKUP_DIR, last.pre_restore_file);
    if (!fs.existsSync(preRestorePath)) {
      res.status(400).json({ error: `Pre-restore backup not found: ${last.pre_restore_file}` });
      return;
    }

    if (fs.existsSync(RESTORE_REQUEST)) {
      res.status(409).json({ error: 'A restore is already pending' });
      return;
    }

    // Create undo request
    const request = {
      target: 'undo:' + last.pre_restore_file,
      label: `Undo: revert to pre-restore state (${last.pre_restore_file})`,
      requestedAt: new Date().toISOString(),
      requestedBy: (res.locals as any).user?.email || 'unknown',
      pre_restore_file: last.pre_restore_file
    };

    writeJSON(RESTORE_REQUEST, request);
    writeJSON(RESTORE_STATUS, { pending: true, message: 'Undo requested. Reverting to pre-restore state.', request });

    shell(`bash "${APP_DIR}/scripts/restore-worker.sh" &`);

    res.json({ status: 'requested', request });
  });

  // ── API: Cancel pending restore ──
  apiRouter.post('/backup/cancel', (req: Request, res: Response): void => {
    if (!fs.existsSync(RESTORE_REQUEST)) {
      res.status(400).json({ error: 'No pending restore to cancel' });
      return;
    }
    fs.unlinkSync(RESTORE_REQUEST);
    writeJSON(RESTORE_STATUS, { pending: false, message: 'Cancelled' });
    res.json({ status: 'cancelled' });
  });

  // ── API: Status ──
  apiRouter.get('/backup/status', (req: Request, res: Response): void => {
    const status = readJSON(RESTORE_STATUS) || {};
    const litestream = getLitestreamInfo();
    const pending = status.pending ? readJSON(RESTORE_REQUEST) : null;
    const maintenance = fs.existsSync(MAINTENANCE_FLAG);

    res.json({ litestream, pending, maintenance, status: status.message || '' });
  });

  // ── API: Manual maintenance toggle ──
  apiRouter.post('/backup/maintenance', express.json(), (req: Request, res: Response): void => {
    const { action } = req.body || {};
    if (action === 'on') {
      shell(`bash "${APP_DIR}/scripts/maintenance.sh" on "Admin: manual maintenance"`);
      res.json({ maintenance: true });
    } else if (action === 'off') {
      shell(`bash "${APP_DIR}/scripts/maintenance.sh" off`);
      res.json({ maintenance: false });
    } else {
      res.status(400).json({ error: 'action must be "on" or "off"' });
    }
  });
}

export default registerBackupRoutes;
