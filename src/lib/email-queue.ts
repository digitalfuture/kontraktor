import * as nodemailer from 'nodemailer';
import db from '../db';
import type { QueueItem, QueueStats } from '../types/email';

const ADMIN_BCC = process.env.ADMIN_BCC || 'pulauberapi@gmail.com';

const DAILY_LIMIT = 300;
const BATCH_SIZE = 5;
const MAX_ATTEMPTS = 5;
const MAX_RETRY_DELAY_SEC = 3600; // cap at 1 hour
const PROVIDER_COOLDOWN_MS = 60000; // pause 1min on rate-limit
const INTERVAL_NORMAL_MS = 200;    // normal gap between sends
const INTERVAL_MAX_MS = 30000;     // max gap when being rate-limited
const COOLDOWN_DECAY_MS = 300000;  // 5 min without incident → reduce interval

let processorTimer: ReturnType<typeof setInterval> | null = null;
let isProcessing = false;

// ── In-memory rate-limit state ──

let providerCooldownUntil = 0;       // timestamp when cooldown expires
let currentIntervalMs = INTERVAL_NORMAL_MS;
let lastRateLimitTime = 0;           // timestamp of last rate-limit hit

// ── Rate-limit helpers ──

/**
 * Calculate seconds to wait before retry, with exponential backoff.
 * attemptIdx: 0-based (first retry = 0, second = 1, …)
 */
function retryDelaySec(attemptIdx: number): number {
  // 10, 50, 250, 1250, 3600 (cap)
  return Math.min(Math.pow(5, attemptIdx) * 10, MAX_RETRY_DELAY_SEC);
}

function calculateRetryAt(attemptIdx: number): string {
  const d = new Date(Date.now() + retryDelaySec(attemptIdx) * 1000);
  return d.toISOString().replace('T', ' ').slice(0, 19); // SQLite datetime
}

/**
 * Check if an error from nodemailer indicates a temporary/rate-limit failure
 * that should be retried (4xx SMTP, timeout, connection refused, throttle msgs).
 * Returns true = retryable, false = permanent failure.
 */
interface SmtpError {
  code?: string;
  message?: string;
  responseCode?: number;
}

function isRetryableError(err: unknown): boolean {
  const e = (typeof err === 'object' && err !== null ? err : {}) as SmtpError;
  if (typeof e.code !== 'string') e.code = '';
  if (typeof e.message !== 'string') e.message = '';
  if (typeof e.responseCode !== 'number') e.responseCode = 0;
  const code = e.code;
  const msg = e.message.toLowerCase();
  const responseCode = e.responseCode;

  // 5xx SMTP — permanent (invalid email, rejected, etc.)
  if (responseCode >= 500 && responseCode < 600) return false;

  // 4xx SMTP — temporary
  if (responseCode >= 400 && responseCode < 500) return true;

  // Connection/network errors — retryable
  if (code === 'ETIMEDOUT' || code === 'ECONNREFUSED' || code === 'ECONNRESET' ||
      code === 'ENOTFOUND' || code === 'ESOCKET') return true;

  // Rate-limit keywords in message
  if (msg.includes('rate') || msg.includes('limit') || msg.includes('throttl') ||
      msg.includes('too many') || msg.includes('try again later') ||
      msg.includes('temporary')) return true;

  // Auth errors — permanent
  if (code === 'EAUTH' || msg.includes('auth') || msg.includes('credentials')) return false;

  // Default: permanent (safe side)
  return false;
}

/**
 * Detect if the error indicates a rate-limit specifically (more aggressive backoff).
 */
function isRateLimitError(err: unknown): boolean {
  const e = (typeof err === 'object' && err !== null ? err : {}) as SmtpError;
  if (typeof e.code !== 'string') e.code = '';
  if (typeof e.message !== 'string') e.message = '';
  if (typeof e.responseCode !== 'number') e.responseCode = 0;
  const msg = e.message.toLowerCase();
  const code = e.code;
  const responseCode = e.responseCode;

  if (responseCode === 452 || responseCode === 450 || responseCode === 451) return true;
  if (msg.includes('rate') || msg.includes('throttl') || msg.includes('too many') ||
      msg.includes('exceeded') || msg.includes('try again later')) return true;
  if (code === 'ETIMEDOUT') return false; // timeout != rate-limit
  return false;
}

function decayInterval(): void {
  // If no rate-limit in the last 5 min, reduce interval toward normal
  if (Date.now() - lastRateLimitTime > COOLDOWN_DECAY_MS) {
    currentIntervalMs = Math.max(INTERVAL_NORMAL_MS, Math.floor(currentIntervalMs * 0.7));
  }
}

// ── Quota helpers ──

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

// ── Enqueue ──

export function enqueueEmail(
  to: string,
  subject: string,
  html: string,
  options?: {
    priority?: number;
    campaignId?: number;
    recipientName?: string | null;
    replyTo?: string | null;
  }
): number {
  const result = db.prepare(`
    INSERT INTO email_queue (to_email, subject, html, priority, campaign_id, recipient_name, reply_to, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'queued')
  `).run(
    to,
    subject,
    html,
    options?.priority ?? 0,
    options?.campaignId ?? null,
    options?.recipientName ?? null,
    options?.replyTo ?? null
  );
  return result.lastInsertRowid as number;
}

// ── Stats ──

export function getQueueStats(): QueueStats {
  const queued = db.prepare("SELECT COUNT(*) as count FROM email_queue WHERE status = 'queued' AND (retry_at IS NULL OR retry_at <= datetime('now'))").get() as { count: number };
  const waitingRetry = db.prepare("SELECT COUNT(*) as count FROM email_queue WHERE status = 'queued' AND retry_at IS NOT NULL AND retry_at > datetime('now')").get() as { count: number };
  const processing = db.prepare("SELECT COUNT(*) as count FROM email_queue WHERE status = 'processing'").get() as { count: number };
  const sentToday = getDailySentCount();
  const now = Date.now();

  return {
    queued: queued.count,
    processing: processing.count,
    sentToday,
    quotaLimit: DAILY_LIMIT,
    quotaRemaining: getRemainingQuota(),
    failedToday: (db.prepare("SELECT COUNT(*) as count FROM email_queue WHERE status = 'failed'").get() as { count: number }).count,
    waitingRetry: waitingRetry.count,
    maxAttempts: MAX_ATTEMPTS,
    providerCooldown: now < providerCooldownUntil,
    providerCooldownSeconds: Math.max(0, Math.ceil((providerCooldownUntil - now) / 1000)),
    sendIntervalMs: currentIntervalMs,
  };
}

// ── List queue items ──

export function getQueueItems(
  status?: string,
  limit = 50,
  offset = 0
): QueueItem[] {
  let query = 'SELECT * FROM email_queue';
  const params: (string | number)[] = [];
  if (status) {
    query += ' WHERE status = ?';
    params.push(status);
  }
  query += ' ORDER BY priority DESC, created_at ASC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  return db.prepare(query).all(...params) as QueueItem[];
}

// ── Transporter ──

export function createTransporter() {
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

// On dev, prepend dev- to the from address
const _smtpFrom = process.env.SMTP_FROM || 'noreply@kontraktor.id';
const isDev = process.env.NODE_ENV !== 'production';
export const fromEmail = isDev ? _smtpFrom.replace(/^([^@+]+)/, 'dev-$1') : _smtpFrom;

// ── Queue Processor ──

async function processNextBatch(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;

  try {
    // Check provider cooldown
    if (Date.now() < providerCooldownUntil) {
      return;
    }

    // Decay interval if no recent incidents
    decayInterval();

    const remaining = getRemainingQuota();
    if (remaining <= 0) return;

    const items = db.prepare(`
      SELECT * FROM email_queue
      WHERE status = 'queued'
        AND (retry_at IS NULL OR retry_at <= datetime('now'))
      ORDER BY priority DESC, created_at ASC
      LIMIT ?
    `).all(Math.min(BATCH_SIZE, remaining)) as QueueItem[];

    if (items.length === 0) return;

    const ids = items.map(i => i.id);
    const placeholders = ids.map(() => '?').join(',');

    // Mark as processing
    db.prepare(`UPDATE email_queue SET status = 'processing', attempts = attempts + 1 WHERE id IN (${placeholders})`)
      .run(...ids);

    const transporter = createTransporter();

    for (const item of items) {
      // Re-check cooldown between items (provider may have been hit)
      if (Date.now() < providerCooldownUntil) {
        // Put remaining items back to queued
        const remainingIds = items.slice(items.indexOf(item)).map(i => i.id);
        if (remainingIds.length > 0) {
          const rPlaceholders = remainingIds.map(() => '?').join(',');
          db.prepare(`UPDATE email_queue SET status = 'queued' WHERE id IN (${rPlaceholders})`)
            .run(...remainingIds);
        }
        break;
      }

      try {
        // [DEV] prefix already added at enqueue time — don't double
        await transporter.sendMail({
          from: `"Kontraktor${isDev ? ' DEV' : ''}" <${fromEmail}>`,
          to: item.to_email,
          subject: item.subject,
          html: item.html,
          replyTo: item.reply_to || undefined,
          bcc: ADMIN_BCC,
        });

        // Mark as sent
        db.prepare("UPDATE email_queue SET status = 'sent', processed_at = CURRENT_TIMESTAMP, retry_at = NULL WHERE id = ?")
          .run(item.id);

        // Log to email_log
        db.prepare(`
          INSERT INTO email_log (campaign_id, recipient_email, recipient_name, subject, status, sent_at, created_at)
          VALUES (?, ?, ?, ?, 'sent', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).run(item.campaign_id, item.to_email, item.recipient_name, item.subject);
      } catch (err) {
        const attemptIdx = item.attempts; // already incremented by the batch update
        const retryable = isRetryableError(err);
        const isRL = isRateLimitError(err);
        const errMsg = typeof err === 'object' && err !== null && (err as SmtpError).message
          ? String((err as SmtpError).message).slice(0, 500)
          : 'Unknown error';

        if (retryable && attemptIdx < MAX_ATTEMPTS) {
          // Retry later with backoff
          const retryAt = calculateRetryAt(attemptIdx);
          db.prepare(`UPDATE email_queue SET status = 'queued', error = ?, retry_at = ? WHERE id = ?`)
            .run(errMsg, retryAt, item.id);

          console.log(`[email-queue] Item #${item.id} failed (attempt ${attemptIdx}/${MAX_ATTEMPTS}), retry at ${retryAt}: ${errMsg}`);

          // If rate-limit: activate provider cooldown & increase interval
          if (isRL) {
            providerCooldownUntil = Date.now() + PROVIDER_COOLDOWN_MS;
            currentIntervalMs = Math.min(Math.floor(currentIntervalMs * 2), INTERVAL_MAX_MS);
            lastRateLimitTime = Date.now();
            console.log(`[email-queue] Rate-limit detected → cooldown ${PROVIDER_COOLDOWN_MS / 1000}s, interval now ${currentIntervalMs}ms`);
          } else {
            // Non-rate-limit retryable: gentler backoff
            currentIntervalMs = Math.min(Math.floor(currentIntervalMs * 1.3), INTERVAL_MAX_MS);
          }
        } else {
          // Permanently failed or max attempts exceeded
          const reason = attemptIdx >= MAX_ATTEMPTS ? 'Max retry attempts exceeded' : 'Permanent failure';
          db.prepare(`UPDATE email_queue SET status = 'failed', error = ?, processed_at = CURRENT_TIMESTAMP WHERE id = ?`)
            .run(errMsg, item.id);

          console.log(`[email-queue] Item #${item.id} ${reason}: ${errMsg}`);

          db.prepare(`
            INSERT INTO email_log (campaign_id, recipient_email, recipient_name, subject, status, error, created_at)
            VALUES (?, ?, ?, ?, 'failed', ?, CURRENT_TIMESTAMP)
          `).run(item.campaign_id, item.to_email, item.recipient_name, item.subject, errMsg);
        }
      }

      // Adaptive delay between sends
      await new Promise(r => setTimeout(r, currentIntervalMs));
    }
  } catch (err) {
    console.error('[email-queue] processor error:', err);
  } finally {
    isProcessing = false;
  }
}

// ── Start/Stop Processor ──

export function startQueueProcessor(intervalMs = 3000): void {
  if (processorTimer) return;
  console.log(`[email-queue] Processor started (interval: ${intervalMs}ms, daily limit: ${DAILY_LIMIT}, max retries: ${MAX_ATTEMPTS})`);
  processNextBatch();
  processorTimer = setInterval(processNextBatch, intervalMs);
}

export function stopQueueProcessor(): void {
  if (processorTimer) {
    clearInterval(processorTimer);
    processorTimer = null;
    console.log('[email-queue] Processor stopped');
  }
}
