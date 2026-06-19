// ── Admin — Shared helpers ──

import { Request, Response } from 'express';
import db from '../../db';
import multer from 'multer';

export const PAGE_SIZE = 10;

export const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

export function makeT(res: Response): (key: string) => string | any[] {
  return (key: string): string | any[] => {
    return typeof res.locals.t === 'function' ? res.locals.t(key) : key;
  };
}

export function getPagination(req: Request, total: number) {
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const offset = (page - 1) * PAGE_SIZE;
  return { page, totalPages, offset };
}

export function localizedName(
  record: { name?: string },
  _locale: string
): string {
  return record.name || '';
}
