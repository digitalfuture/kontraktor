import { Request, Response, NextFunction } from 'express';
import { getUserByToken, AuthUser } from '../lib/auth';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.session_token;
  if (token) {
    const user = getUserByToken(token);
    if (user) {
      req.user = user;
    }
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.session_token;
  
  if (!token) {
    res.redirect('/auth/login');
    return;
  }
  
  const user = getUserByToken(token);
  if (!user) {
    res.redirect('/auth/login');
    return;
  }
  
  req.user = user;
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'admin') {
    res.status(403).render('error', { message: 'Access denied' });
    return;
  }
  // Admin visits must never be counted in analytics — persist the device
  // opt-out cookie so the admin stays excluded even after logging out.
  res.cookie('ga_opt_out', '1', {
    maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
    httpOnly: false, // client-side JS also reads it for extra safety
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  next();
}

export function requireContractorOrAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.redirect('/auth/login');
    return;
  }
  if (!req.user.is_contractor && req.user.role !== 'admin') {
    res.status(403).render('error', { title: 'Forbidden', message: req.user.role === 'client' ? 'Only contractors can browse projects' : 'Access denied' });
    return;
  }
  next();
}
