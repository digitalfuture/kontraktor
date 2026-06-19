import * as nodemailer from 'nodemailer';
import { ImapFlow } from 'imapflow';
import db from '../db';
import { enqueueEmail } from './email-queue';

const DAILY_LIMIT = 300;

// ── Daily quota ──

export function getDailySentCount(): number {
  const today = new Date().toISOString().slice(0, 10);
  const row = db.prepare(
    "SELECT COUNT(*) as count FROM email_log WHERE status = 'sent' AND date(sent_at) = ?"
  ).get(today) as { count: number };
  return row?.count || 0;
}

export function getRemainingQuota(): number {
  return Math.max(0, DAILY_LIMIT - getDailySentCount());
}

export function canSendEmail(): boolean {
  return getDailySentCount() < DAILY_LIMIT;
}

export const DAILY_LIMIT_VALUE = DAILY_LIMIT;

// ── Logging ──

export function logEmailSend(
  campaignId: number | null,
  recipientEmail: string,
  recipientName: string | null,
  subject: string,
  status: 'sent' | 'failed',
  error?: string | null
): void {
  db.prepare(`
    INSERT INTO email_log (campaign_id, recipient_email, recipient_name, subject, status, sent_at, created_at, error)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?)
  `).run(campaignId, recipientEmail, recipientName, subject, status, error || null);
}

// ── Transporter ──

function _createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    connectionTimeout: 5000,
    socketTimeout: 10000,
  });
}

const _fromEmail = process.env.SMTP_FROM || 'noreply@kontraktor.id';
const _isDev = process.env.NODE_ENV !== 'production';

// ── Single send with quota check (now enqueues) ──

export async function sendWithQuota(
  to: string,
  subject: string,
  html: string,
  campaignId?: number
): Promise<{ sent: boolean; reason?: string }> {
  const finalSubject = _isDev ? `[DEV] ${subject}` : subject;
  enqueueEmail(to, finalSubject, html, {
    priority: 1,
    campaignId: campaignId ?? undefined,
  });
  return { sent: true }; // queued successfully
}

// ── Campaign batch send (now enqueues all recipients) ──

export async function sendCampaignEmails(
  campaignId: number,
  recipients: Array<{ email: string; name?: string }>,
  subject: string,
  html: string,
  onProgress?: (sent: number, failed: number, total: number) => void
): Promise<{ sent: number; failed: number }> {
  const total = recipients.length;
  const finalSubject = _isDev ? `[DEV] ${subject}` : subject;

  for (let i = 0; i < recipients.length; i++) {
    enqueueEmail(recipients[i].email, finalSubject, html, {
      campaignId,
      recipientName: recipients[i].name || null,
    });

    if (onProgress) onProgress(i + 1, 0, total);
  }

  return { sent: recipients.length, failed: 0 };
}

// ── IMAP inbox reader (Brevo) ──

export async function fetchInboxEmails(limit = 50): Promise<Array<{
  uid: number; from: string; subject: string; date: Date; text: string; html: string | null;
}>> {
  const client = new ImapFlow({
    host: process.env.IMAP_HOST || 'imap.brevo.com',
    port: parseInt(process.env.IMAP_PORT || '993', 10),
    secure: true,
    auth: {
      user: process.env.IMAP_USER || process.env.SMTP_USER || '',
      pass: process.env.IMAP_PASS || process.env.SMTP_PASS || '',
    },
    logger: false,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      const messages: Array<{
        uid: number; from: string; subject: string; date: Date; text: string; html: string | null;
      }> = [];

      for await (const msg of client.fetch('1:*', { uid: true, envelope: true })) {
        if (messages.length >= limit) break;
        const env = (msg as any).envelope;
        messages.push({
          uid: (msg as any).uid,
          from: env?.from?.[0]?.address || 'unknown',
          subject: env?.subject || '(no subject)',
          date: env?.date || new Date(),
          text: '',
          html: null,
        });
      }

      return messages;
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}
