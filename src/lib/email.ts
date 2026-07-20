import { enqueueEmail } from './email-queue';
import * as nodemailer from 'nodemailer';
import db from '../db';

// ── Template cache (lifetime of process) ──
const systemTemplateCache = new Map<string, { subject: string; body_html: string }>();

function loadSystemTemplate(systemKey: string): { subject: string; body_html: string } | null {
  // Check cache first
  const cached = systemTemplateCache.get(systemKey);
  if (cached) return cached;

  try {
    const row = db.prepare(
      "SELECT subject, body_html FROM email_templates WHERE system_key = ? AND deleted_at IS NULL"
    ).get(systemKey) as { subject: string; body_html: string } | undefined;

    if (row) {
      systemTemplateCache.set(systemKey, row);
      return row;
    }
  } catch {
    // DB might not have the table yet during initial setup
  }
  return null;
}

function clearTemplateCache(): void {
  systemTemplateCache.clear();
}

export { clearTemplateCache };

/**
 * Render a system email template by replacing placeholders.
 * Falls back to null if no template is saved (caller should use hardcoded fallback).
 *
 * Supported placeholders:
 *   {{recipient_name}}   — recipient's name (or empty string)
 *   {{company_name}}     — recipient's company (or empty string)
 *   {{login_url}}        — magic link URL
 *   {{project_title}}    — project name/title
 *   {{project_url}}      — URL to project page
 *   {{project_category}} — project category name
 *   {{project_budget}}   — project budget
 *   {{project_location}} — project location
 *   {{contractor_name}}  — contractor's name
 *   {{client_name}}      — client's name
 *   {{amount}}           — monetary amount
 *   {{unsubscribe_url}}  — unsubscription link
 */
function renderSystemTemplate(
  systemKey: string,
  placeholders: Record<string, string>
): { subject: string; html: string } | null {
  const tmpl = loadSystemTemplate(systemKey);
  if (!tmpl) return null;

  const vars: Record<string, string> = {
    recipient_name: '',
    company_name: '',
    login_url: '',
    project_title: '',
    project_url: '',
    project_category: '',
    project_budget: '',
    project_location: '',
    contractor_name: '',
    client_name: '',
    amount: '',
    unsubscribe_url: '',
    ...placeholders,
  };

  const replaceAll = (text: string): string => {
    return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
  };

  return {
    subject: replaceAll(tmpl.subject),
    html: replaceAll(tmpl.body_html),
  };
}

// Fresh transporter per send — avoids any stale connection / lazy-init issues
// Also deferred: createTransport runs after dotenv has loaded .env
function getTransporterEmail(): nodemailer.Transporter {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    connectionTimeout: 5000,
    socketTimeout: 10000,
  });
}

// Lazy — env vars computed after dotenv loads .env
function getFromEmail(): string {
  const _fromEmail = process.env.SMTP_FROM || 'noreply@kontraktor.app';
  const isDev = process.env.NODE_ENV !== 'production';
  return isDev ? _fromEmail.replace(/^([^@+]+)/, 'dev-$1') : _fromEmail;
}
function getIsDev(): boolean {
  return process.env.NODE_ENV !== 'production';
}
function getBaseUrl(): string {
  return process.env.BASE_URL || 'http://localhost:3002';
}

/**
 * Queue an email for sending via the background processor.
 * Returns immediately — the processor handles SMTP rate limits & daily quota.
 * Also logs to email_log when actually sent (handled by email-queue processor).
 */
export function sendMail(to: string, subject: string, html: string, _replyTo?: string, _replyName?: string): Promise<void> {
  const finalSubject = getIsDev() ? `[DEV] ${subject}` : subject;
  enqueueEmail(to, finalSubject, html, {
    priority: 1,
    replyTo: _replyTo,
    recipientName: _replyName || null,
  });
  return Promise.resolve();
}

/**
 * Direct send (bypasses queue) — used only for admin test emails.
 */
export async function sendMailDirect(to: string, subject: string, html: string): Promise<void> {
  const finalSubject = getIsDev() ? `[DEV] ${subject}` : subject;
  try {
    const info = await getTransporterEmail().sendMail({
      from: `"Kontraktor${getIsDev() ? ' DEV' : ''}" <${getFromEmail()}>`,
      to,
      subject: finalSubject,
      html,
    });
    const messageId = typeof info === 'object' && info !== null ? (info as { messageId: string }).messageId || '' : '';
    db.prepare(
      "INSERT INTO email_log (recipient_email, subject, status, message_id, sent_at, created_at) VALUES (?, ?, 'sent', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
    ).run(to, finalSubject, messageId);
  } catch (err) {
    const errMsg = typeof err === 'object' && err !== null
      ? String((err as { message?: string }).message ?? 'Unknown error').slice(0, 500)
      : 'Unknown error';
    db.prepare(
      "INSERT INTO email_log (recipient_email, subject, status, error, created_at) VALUES (?, ?, 'failed', ?, CURRENT_TIMESTAMP)"
    ).run(to, finalSubject, errMsg);
    console.error('[email] sendMailDirect failed:', errMsg);
  }
}

export async function sendMagicLinkEmail(email: string, link: string): Promise<void> {
  // Try saved template first
  const rendered = renderSystemTemplate('magic_link', {
    recipient_name: '',
    login_url: link,
  });

  const html = rendered?.html ?? `
    <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="font-size: 28px; font-weight: 700; color: #ea580c;">Kontraktor</span>
      </div>
      <h2 style="color: #111827; margin-bottom: 16px;">Sign in to your account</h2>
      <p style="color: #4b5563; line-height: 1.6;">Click the button below to sign in to Kontraktor:</p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${link}" style="display: inline-block; background: #ea580c; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Sign In →</a>
      </div>
      <p style="color: #9ca3af; font-size: 13px; word-break: break-all; background: #f9fafb; padding: 12px; border-radius: 6px;">${link}</p>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">This link expires in 15 minutes. If you didn't request this, ignore this email.</p>
    </div>
  `;
  const subject = rendered?.subject ?? 'Sign in to Kontraktor';
  const finalSubject = getIsDev() ? `[DEV] ${subject}` : subject;
  try {
    const info = await getTransporterEmail().sendMail({
      from: `"Kontraktor${getIsDev() ? ' DEV' : ''}" <${getFromEmail()}>`,
      to: email,
      subject: finalSubject,
      html,
    });
    const messageId = typeof info === 'object' && info !== null ? (info as { messageId: string }).messageId || '' : '';
    db.prepare(
      "INSERT INTO email_log (recipient_email, subject, status, message_id, sent_at, created_at) VALUES (?, ?, 'sent', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
    ).run(email, finalSubject, messageId);
  } catch (err) {
    const errMsg = typeof err === 'object' && err !== null
      ? String((err as { message?: string }).message ?? 'Unknown error').slice(0, 500)
      : 'Unknown error';
    db.prepare(
      "INSERT INTO email_log (recipient_email, subject, status, error, created_at) VALUES (?, ?, 'failed', ?, CURRENT_TIMESTAMP)"
    ).run(email, finalSubject, errMsg);
    console.error('[email] sendMagicLinkEmail failed:', errMsg);
  }
}

export function sendNewBidEmail(clientEmail: string, projectName: string, contractorName: string, projectId: number): Promise<void> {
  const projectUrl = `${getBaseUrl()}/post/${projectId}`;
  const rendered = renderSystemTemplate('new_bid', {
    recipient_name: '',
    company_name: '',
    project_title: projectName,
    project_url: projectUrl,
    contractor_name: contractorName,
  });

  const html = rendered?.html ?? `
    <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="font-size: 28px; font-weight: 700; color: #ea580c;">Kontraktor</span>
      </div>
      <h2 style="color: #111827; margin-bottom: 16px;">New bid on your project</h2>
      <p style="color: #4b5563; line-height: 1.6;"><strong>${contractorName}</strong> has submitted a bid on your project:</p>
      <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 0; font-weight: 600; color: #111827;">${projectName}</p>
      </div>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${projectUrl}" style="display: inline-block; background: #ea580c; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600;">View Bids →</a>
      </div>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">You can review and accept bids from your project page.</p>
    </div>
  `;
  const subject = rendered?.subject ?? `New bid: ${projectName}`;
  return sendMail(clientEmail, subject, html);
}

export function sendBidAcceptedEmail(contractorEmail: string, projectName: string, clientName: string, _projectId: number): Promise<void> {
  const projectUrl = `${getBaseUrl()}/post/${_projectId}`;
  const rendered = renderSystemTemplate('bid_accepted', {
    recipient_name: '',
    company_name: '',
    project_title: projectName,
    project_url: projectUrl,
    client_name: clientName,
  });

  const html = rendered?.html ?? `
    <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="font-size: 28px; font-weight: 700; color: #ea580c;">Kontraktor</span>
      </div>
      <h2 style="color: #111827; margin-bottom: 16px;">🎉 Your bid was accepted!</h2>
      <p style="color: #4b5563; line-height: 1.6;"><strong>${clientName}</strong> has accepted your bid on:</p>
      <div style="background: #f0fdf4; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #bbf7d0;">
        <p style="margin: 0; font-weight: 600; color: #166534;">${projectName}</p>
      </div>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${getBaseUrl()}/contractors/dashboard" style="display: inline-block; background: #ea580c; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600;">View Dashboard →</a>
      </div>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">Contact the client to discuss project details.</p>
    </div>
  `;
  const subject = rendered?.subject ?? `Bid accepted: ${projectName}`;
  return sendMail(contractorEmail, subject, html);
}

export function sendProjectCompletedEmail(clientEmail: string, projectName: string, contractorName: string, projectId: number): Promise<void> {
  const projectUrl = `${getBaseUrl()}/post/${projectId}`;
  const rendered = renderSystemTemplate('project_completed', {
    recipient_name: '',
    company_name: '',
    project_title: projectName,
    project_url: projectUrl,
    contractor_name: contractorName,
  });

  const html = rendered?.html ?? `
    <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="font-size: 28px; font-weight: 700; color: #ea580c;">Kontraktor</span>
      </div>
      <h2 style="color: #111827; margin-bottom: 16px;">Project completed</h2>
      <p style="color: #4b5563; line-height: 1.6;">Your project is now marked as complete. You can leave a review for:</p>
      <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 0; font-weight: 600; color: #111827;">${contractorName}</p>
        <p style="margin: 4px 0 0; color: #6b7280; font-size: 14px;">${projectName}</p>
      </div>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${projectUrl}" style="display: inline-block; background: #ea580c; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600;">Leave Review →</a>
      </div>
    </div>
  `;
  const subject = rendered?.subject ?? `Project completed: ${projectName}`;
  return sendMail(clientEmail, subject, html);
}

export function isEmailConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}
