import { enqueueEmail } from './email-queue';
import * as nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
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

const fromEmail = process.env.SMTP_FROM || 'noreply@kontraktor.id';
const baseUrl = process.env.BASE_URL || 'http://localhost:3002';
const isDev = process.env.NODE_ENV !== 'production';
const ADMIN_BCC = process.env.ADMIN_BCC || 'pulauberapi@gmail.com';

/**
 * Queue an email for sending via the background processor.
 * Returns immediately — the processor handles SMTP rate limits & daily quota.
 * Also logs to email_log when actually sent (handled by email-queue processor).
 */
export function sendMail(to: string, subject: string, html: string, _replyTo?: string, _replyName?: string): Promise<void> {
  const finalSubject = isDev ? `[DEV] ${subject}` : subject;
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
export function sendMailDirect(to: string, subject: string, html: string): Promise<void> {
  const finalSubject = isDev ? `[DEV] ${subject}` : subject;
  return transporter.sendMail({
    from: `"Kontraktor${isDev ? ' DEV' : ''}" <${fromEmail}>`,
    to,
    bcc: ADMIN_BCC,
    subject: finalSubject,
    html,
  }).then(() => {});
}

export function sendMagicLinkEmail(email: string, link: string): Promise<void> {
  const html = `
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
  return sendMail(email, 'Sign in to Kontraktor', html);
}

export function sendNewBidEmail(clientEmail: string, projectName: string, contractorName: string, projectId: number): Promise<void> {
  const html = `
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
        <a href="${baseUrl}/post/${projectId}" style="display: inline-block; background: #ea580c; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600;">View Bids →</a>
      </div>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">You can review and accept bids from your project page.</p>
    </div>
  `;
  return sendMail(clientEmail, `New bid: ${projectName}`, html);
}

export function sendBidAcceptedEmail(contractorEmail: string, projectName: string, clientName: string, _projectId: number): Promise<void> {
  const html = `
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
        <a href="${baseUrl}/contractors/dashboard" style="display: inline-block; background: #ea580c; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600;">View Dashboard →</a>
      </div>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">Contact the client to discuss project details.</p>
    </div>
  `;
  return sendMail(contractorEmail, `Bid accepted: ${projectName}`, html);
}

export function sendProjectCompletedEmail(clientEmail: string, projectName: string, contractorName: string, projectId: number): Promise<void> {
  const html = `
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
        <a href="${baseUrl}/post/${projectId}" style="display: inline-block; background: #ea580c; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600;">Leave Review →</a>
      </div>
    </div>
  `;
  return sendMail(clientEmail, `Project completed: ${projectName}`, html);
}

export function isEmailConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}
