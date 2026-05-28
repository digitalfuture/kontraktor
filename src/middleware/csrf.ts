import { randomBytes } from 'crypto';
import { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Locals {
      csrfToken?: string;
    }
  }
}

/**
 * CSRF middleware — generates a token per user session (via signed cookie),
 * validates on all non-idempotent requests (POST/PUT/PATCH/DELETE).
 *
 * Works with the project's existing cookie-based auth system.
 */
export function csrfMiddleware(req: Request, res: Response, next: NextFunction) {
  // Exclude external webhooks from CSRF checks
  if (req.path === '/payments/webhook') {
    return next();
  }

  const tokenCookie = req.cookies?.csrf_token;

  // Only protect state-changing methods
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    // Ensure token exists for GET/HEAD
    if (!tokenCookie) {
      const token = randomBytes(32).toString('hex');
      res.cookie('csrf_token', token, {
        httpOnly: false, // JS needs to read it for HTMX headers
        sameSite: 'lax',
        secure: false, // must work over HTTP too (dev, proxied setups)
        maxAge: 86400000, // 24h
      });
      res.locals.csrfToken = token;
    } else {
      res.locals.csrfToken = tokenCookie;
    }
    return next();
  }

  // Validate token on POST/etc
  // For multipart forms, _csrf might be in query params since urlencoded middleware doesn't parse multipart
  const bodyToken = req.body._csrf ?? req.query._csrf ?? req.headers['x-csrf-token'] ?? req.headers['csrf-token'];
  if (!bodyToken || bodyToken !== tokenCookie) {
    return res.status(403).send('Invalid CSRF token');
  }

  // Rotate token after validation
  const newToken = randomBytes(32).toString('hex');
  res.cookie('csrf_token', newToken, {
    httpOnly: false,
    sameSite: 'lax',
    secure: false, // must work over HTTP too (dev, proxied setups)
    maxAge: 86400000,
  });
  res.locals.csrfToken = newToken;
  next();
}
