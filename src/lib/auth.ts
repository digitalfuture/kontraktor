import crypto from 'crypto';
import db from '../db';

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'contractor' | 'client';
  telegram_id: string | null;
  is_verified: number;
}

// Create session token (60 days TTL)
export function createSession(userId: number): string {
  const token: string = crypto.randomUUID();
  const expiresAt: string = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
  
  db.prepare('INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)').run(
    token, userId, token, expiresAt
  );
  
  return token;
}

// Get user from session token
export function getUserByToken(token: string): AuthUser | null {
  const now = new Date().toISOString();
  const row = db.prepare(`
    SELECT u.id, u.email, u.name, u.role, u.telegram_id, u.is_verified
    FROM users u
    JOIN sessions s ON u.id = s.user_id
    WHERE s.token = ? AND s.expires_at > ?
  `).get(token, now) as AuthUser | undefined;
  
  return row || null;
}

// Create magic link for email auth
export function createMagicLink(email: string): string {
  const token: string = crypto.randomUUID();
  const expiresAt: string = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min
  
  db.prepare('INSERT INTO magic_links (email, token, expires_at) VALUES (?, ?, ?)').run(
    email, token, expiresAt
  );
  
  return token;
}

// Verify and consume magic link
export function verifyMagicLink(token: string): string | null {
  const now = new Date().toISOString();
  const row = db.prepare(`
    SELECT email FROM magic_links 
    WHERE token = ? AND used = 0 AND expires_at > ?
  `).get(token, now) as { email: string } | undefined;
  
  if (!row) return null;
  
  db.prepare('UPDATE magic_links SET used = 1 WHERE token = ?').run(token);
  return row.email;
}
