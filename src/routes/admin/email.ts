// ── Admin — Email & Mailing Lists ──

import express, { Request, Response } from 'express';
import db from '../../db';
import { getQueueStats, getQueueItems } from '../../lib/email-queue';
import {
  EmailTemplate,
  EmailCampaign,
  MailingList,
  MailingListContact,
  RecipientStatus,
  CampaignRecipient,
  ActiveCampaignInfo,
  EmailNameRow,
} from '../../types/email';
import { makeT, getPagination, localizedName, PAGE_SIZE, csvUpload } from './helpers';
import { createTransporter, fromEmail } from '../../lib/email-queue';

// Bring in EmailSetting type
interface EmailSetting { key: string; value: string; updated_at: string; }

export function registerEmailRoutes(pageRouter: express.Router, apiRouter: express.Router): void {

  // ── EMAIL MANAGEMENT (pages) ──

  pageRouter.get('/email', (req: Request, res: Response): void => {
    const locale = (res.locals.locale as string) || 'en';
    const sentToday = db.prepare("SELECT COUNT(*) as count FROM email_log WHERE status = 'sent' AND date(sent_at) = date('now')").get() as { count: number };
    const failedToday = db.prepare("SELECT COUNT(*) as count FROM email_log WHERE status = 'failed' AND date(created_at) = date('now')").get() as { count: number };
    const queueStats = getQueueStats();
    const queueItems = getQueueItems('queued', 20);
    const campaigns = db.prepare(`
      SELECT c.*, ml.name as mailing_list_name
      FROM email_campaigns c
      LEFT JOIN mailing_lists ml ON ml.id = c.mailing_list_id
      ORDER BY c.created_at DESC
    `).all();
    const templates: EmailTemplate[] = db.prepare('SELECT * FROM email_templates WHERE deleted_at IS NULL ORDER BY created_at DESC').all() as EmailTemplate[];
    const recentLog = db.prepare('SELECT * FROM email_log ORDER BY created_at DESC LIMIT 20').all();
    const mailingLists: MailingList[] = db.prepare('SELECT ml.*, (SELECT COUNT(*) FROM mailing_list_contacts WHERE list_id = ml.id AND deleted_at IS NULL) as contact_count FROM mailing_lists ml ORDER BY ml.created_at DESC').all() as MailingList[];

    res.render('admin/email', {
      title: (locale === 'id' ? 'Email — Admin' : 'Email — Admin') + ' — Kontraktor',
      activePage: 'email',
      sentToday: sentToday.count,
      failedToday: failedToday.count,
      queueStats,
      queueItems,
      campaigns,
      templates,
      recentLog,
      mailingLists,
    });
  });

  pageRouter.get('/email/inbox', (req: Request, res: Response): void => {
    res.redirect('/admin/email');
  });

  pageRouter.get('/email/campaigns', (req: Request, res: Response): void => {
    res.redirect('/admin/email');
  });

  pageRouter.get('/email/templates', (req: Request, res: Response): void => {
    const locale = (res.locals.locale as string) || 'en';
    const t = (res.locals.t as (key: string) => string) || ((key: string) => key);
    const templates = db.prepare("SELECT * FROM email_templates WHERE system_key IS NOT NULL ORDER BY system_key").all() as Array<{id:number;name:string;subject:string;system_key:string;description:string}>;
    res.render('admin/email-templates', {
      title: (locale === 'id' ? 'Template Email — Admin' : 'Email Templates — Admin') + ' — Kontraktor',
      activePage: 'email',
      templates,
    });
  });

  pageRouter.get('/email/templates/:key', (req: Request, res: Response): void => {
    const locale = (res.locals.locale as string) || 'en';
    const t = (res.locals.t as (key: string) => string) || ((key: string) => key);
    const systemKey = req.params.key as string;
    const tmpl = db.prepare("SELECT * FROM email_templates WHERE system_key = ?").get(systemKey);
    if (!tmpl) { res.redirect('/admin/email/templates'); return; }
    res.render('admin/email-template-editor', {
      title: (locale === 'id' ? 'Edit Template — Admin' : 'Edit Template — Admin') + ' — Kontraktor',
      activePage: 'email',
      tmpl,
    });
  });

  pageRouter.get('/email/lists', (req: Request, res: Response): void => {
    const locale = (res.locals.locale as string) || 'en';
    const lists: MailingList[] = db.prepare(`
      SELECT ml.*, 
        (SELECT COUNT(*) FROM mailing_list_contacts WHERE list_id = ml.id AND deleted_at IS NULL) as contact_count,
        (SELECT c.status FROM email_campaigns c WHERE c.mailing_list_id = ml.id AND c.deleted_at IS NULL AND c.status IN ('sending', 'draft') ORDER BY c.created_at DESC LIMIT 1) as active_campaign_status,
        (SELECT c.id FROM email_campaigns c WHERE c.mailing_list_id = ml.id AND c.deleted_at IS NULL AND c.status IN ('sending', 'draft') ORDER BY c.created_at DESC LIMIT 1) as active_campaign_id,
        (SELECT c.name FROM email_campaigns c WHERE c.mailing_list_id = ml.id AND c.deleted_at IS NULL AND c.status IN ('sending', 'draft') ORDER BY c.created_at DESC LIMIT 1) as active_campaign_name
      FROM mailing_lists ml ORDER BY ml.created_at DESC
    `).all() as MailingList[];

    res.render('admin/email-lists', {
      title: (locale === 'id' ? 'Mailing Lists — Admin' : 'Mailing Lists — Admin') + ' — Kontraktor',
      activePage: 'email',
      lists,
    });
  });

  pageRouter.get('/email/lists/:id', (req: Request, res: Response): void => {
    const locale = (res.locals.locale as string) || 'en';
    const id = parseInt(req.params.id as string, 10);
    const list: MailingList | undefined = db.prepare('SELECT * FROM mailing_lists WHERE id = ?').get(id) as MailingList | undefined;
    if (!list) { res.redirect('/admin/email/lists'); return; }

    const total: { count: number } = db.prepare('SELECT COUNT(*) as count FROM mailing_list_contacts WHERE list_id = ? AND deleted_at IS NULL').get(id) as { count: number };
    const { page, totalPages, offset } = getPagination(req, total.count);
    const contacts: MailingListContact[] = db.prepare('SELECT * FROM mailing_list_contacts WHERE list_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT ? OFFSET ?').all(id, PAGE_SIZE, offset) as MailingListContact[];

    const campaign = db.prepare(`
      SELECT * FROM email_campaigns 
      WHERE mailing_list_id = ? AND deleted_at IS NULL
      ORDER BY 
        CASE status WHEN 'sending' THEN 1 WHEN 'draft' THEN 2 WHEN 'sent' THEN 3 WHEN 'stopped' THEN 4 ELSE 5 END,
        created_at DESC
      LIMIT 1
    `).get(id) as EmailCampaign | undefined;

    let recipientStatuses: RecipientStatus[] = [];
    if (campaign) {
      recipientStatuses = db.prepare(`
        SELECT mlc.*, 
          COALESCE(el.status, 'not_sent') as send_status,
          el.sent_at,
          el.error
        FROM mailing_list_contacts mlc
        LEFT JOIN email_log el ON el.campaign_id = ? AND el.recipient_email = mlc.email
        WHERE mlc.list_id = ?
        ORDER BY 
          CASE el.status WHEN 'sent' THEN 1 WHEN 'failed' THEN 2 ELSE 3 END,
          mlc.created_at DESC
      `).all(campaign.id, id) as RecipientStatus[];
    }

    res.render('admin/email-list-detail', {
      title: (locale === 'id' ? `${list.name} — Admin` : `${list.name} — Admin`) + ' — Kontraktor',
      activePage: 'email',
      list,
      contacts,
      campaign,
      recipientStatuses,
      pagination: { page, totalPages, total: total.count }
    });
  });

  // ── EMAIL API ──

  apiRouter.post('/email/send', async (req: Request, res: Response): Promise<void> => {
    const to = (req.body.to as string | undefined)?.trim() || '';
    const subject = (req.body.subject as string | undefined)?.trim() || '';
    const html = (req.body.body as string | undefined) || '';
    const isDev = process.env.NODE_ENV !== 'production';
    const finalSubject = isDev ? `[DEV] ${subject}` : subject;
    if (!to || !subject || !html) {
      res.status(400).json({ error: 'Missing required fields: to, subject, body' });
      return;
    }
    const from = (req.body.from as string | undefined) || fromEmail;
    try {
      const info = await createTransporter().sendMail({ from, to, subject: finalSubject, html });
      const messageId = typeof info === 'object' && info !== null ? (info as { messageId: string }).messageId || '' : '';
      db.prepare(
        "INSERT INTO email_log (from_email, recipient_email, subject, direction, status, message_id, sent_at, created_at) VALUES (?, ?, ?, 'outbound', 'sent', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
      ).run(from, to, subject, messageId);
      res.json({ sent: true, messageId });
    } catch (err: unknown) {
      const errMsg = typeof err === 'object' && err !== null
        ? String((err as { message?: string }).message ?? 'Unknown error').slice(0, 500)
        : 'Unknown error';
      db.prepare(
        "INSERT INTO email_log (from_email, recipient_email, subject, direction, status, error, created_at) VALUES (?, ?, ?, 'outbound', 'failed', ?, CURRENT_TIMESTAMP)"
      ).run(from, to, subject, errMsg);
      console.error('[email] send failed:', errMsg);
      res.status(502).json({ sent: false, reason: errMsg });
    }
  });

  // ── INBOUND + REPLY ──
  apiRouter.post('/email/inbound', express.json(), (req: Request, res: Response): void => {
    const from = (req.body.from as string | undefined)?.trim();
    const to = (req.body.to as string | undefined)?.trim();
    const subject = (req.body.subject as string | undefined)?.trim() || '';
    const body = (req.body.text || req.body.html || '') as string;
    const messageId = (req.body.messageId as string | undefined)?.trim();
    const inReplyTo = (req.body.inReplyTo as string | undefined)?.trim();
    if (!from || !to) { res.status(400).json({ error: 'Missing from/to' }); return; }

    db.prepare(
      "INSERT INTO email_log (from_email, recipient_email, subject, direction, status, message_id, in_reply_to, body_html, sent_at, created_at) VALUES (?, ?, ?, 'inbound', 'sent', ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
    ).run(from, to, subject, messageId || null, inReplyTo || null, body);
    res.json({ ok: true });
  });

  apiRouter.post('/email/reply', express.json(), async (req: Request, res: Response): Promise<void> => {
    const parentId = parseInt(req.body.parent_log_id as string || '0', 10);
    const to = (req.body.to as string | undefined)?.trim();
    const subject = (req.body.subject as string | undefined)?.trim() || '';
    const html = (req.body.html as string | undefined) || '';
    if (!parentId || !to) { res.status(400).json({ error: 'Missing parent_log_id or to' }); return; }

    const parent = db.prepare('SELECT * FROM email_log WHERE id = ?').get(parentId) as Record<string, unknown> | undefined;
    if (!parent) { res.status(404).json({ error: 'Parent not found' }); return; }
    const parentMessageId = (parent.message_id as string) || '';
    const parentSubject = (parent.subject as string) || '';
    const parentBody = (parent.body_html as string) || '';
    const from = (req.body.from as string | undefined) || (parent.from_email as string) || fromEmail;
    const isDev = process.env.NODE_ENV !== 'production';
    const finalSubject = subject.startsWith('Re:') ? subject : `Re: ${parentSubject}`;
    const devSubject = isDev ? `[DEV] ${finalSubject}` : finalSubject;

    const quoted = `<blockquote>${html || ''}</blockquote>`;
    const wrapped = `<div>${html}</div><hr/><strong>On ${parent.created_at} ${parent.from_email || parent.recipient_email} wrote:</strong><br/>${quoted}`;

    try {
      const info = await createTransporter().sendMail({ from, to, subject: devSubject, html: wrapped, text: html });
      const messageId = typeof info === 'object' && info !== null ? (info as { messageId: string }).messageId || '' : '';
      const refs = [parentMessageId, messageId].filter(Boolean).join(' ');
      db.prepare(
        "INSERT INTO email_log (from_email, recipient_email, subject, direction, status, message_id, in_reply_to, references, parent_log_id, body_html, sent_at, created_at) VALUES (?, ?, ?, 'outbound', 'sent', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
      ).run(from, to, devSubject, messageId, parentMessageId || null, refs || null, parentId, wrapped);
      res.json({ ok: true, messageId, inReplyTo: parentMessageId, references: refs });
    } catch (err: unknown) {
      const errMsg = typeof err === 'object' && err !== null
        ? String((err as { message?: string }).message ?? 'Unknown error').slice(0, 500)
        : 'Unknown error';
      db.prepare(
        "INSERT INTO email_log (from_email, recipient_email, subject, direction, status, parent_log_id, error, created_at) VALUES (?, ?, ?, 'outbound', 'failed', ?, ?, CURRENT_TIMESTAMP)"
      ).run(from, to, devSubject, parentId, errMsg);
      res.status(502).json({ error: 'Send failed', detail: errMsg });
    }
  });

  apiRouter.post('/email/templates/create', (req: Request, res: Response): void => {
    const name = req.body.name as string;
    const subject = req.body.subject as string;
    const body_html = req.body.body_html as string;
    if (!name || !subject || !body_html) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }
    db.prepare('INSERT INTO email_templates (name, subject, body_html) VALUES (?, ?, ?)').run(name, subject, body_html);
    res.redirect('/admin/email');
  });

  apiRouter.post('/email/templates/:id/update', (req: Request, res: Response): void => {
    const id = parseInt(req.params.id as string, 10);
    const name = req.body.name as string;
    const subject = req.body.subject as string;
    const body_html = req.body.body_html as string;
    db.prepare('UPDATE email_templates SET name = ?, subject = ?, body_html = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(name, subject, body_html, id);
    res.redirect('/admin/email');
  });

  apiRouter.post('/email/templates/:id/delete', (req: Request, res: Response): void => {
    const id = parseInt(req.params.id as string, 10);
    db.prepare('UPDATE email_templates SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
    if (req.headers['hx-request']) {
      res.set('HX-Trigger', JSON.stringify({ showNotification: { msg: 'Template deleted', type: 'success' } }));
      res.status(200).send('');
      return;
    }
    res.redirect('/admin/email');
  });

  apiRouter.post('/email/templates/:id/restore', (req: Request, res: Response): void => {
    const id = parseInt(req.params.id as string, 10);
    db.prepare('UPDATE email_templates SET deleted_at = NULL WHERE id = ?').run(id);
    if (req.headers['hx-request']) {
      res.set('HX-Trigger', JSON.stringify({ showNotification: { msg: 'Template restored', type: 'success' } }));
      res.status(200).send('');
      return;
    }
    res.redirect('/admin/trash');
  });

  apiRouter.post('/email/templates/:id/force-delete', (req: Request, res: Response): void => {
    const id = parseInt(req.params.id as string, 10);
    db.prepare('DELETE FROM email_templates WHERE id = ?').run(id);
    if (req.headers['hx-request']) {
      res.set('HX-Trigger', JSON.stringify({ showNotification: { msg: 'Template permanently deleted', type: 'success' } }));
      res.status(200).send('');
      return;
    }
    res.redirect('/admin/trash');
  });

  apiRouter.post('/email/campaigns/create', (req: Request, res: Response): void => {
    const name = req.body.name as string;
    const subject = req.body.subject as string;
    const body_html = req.body.body_html as string;
    const recipient_filter = req.body.recipient_filter as string;
    const mailing_list_id = req.body.mailing_list_id ? parseInt(req.body.mailing_list_id as string, 10) : null;
    if (!name || !subject || !body_html) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }
    const filter = recipient_filter || 'all';
    db.prepare(`
      INSERT INTO email_campaigns (name, subject, body_html, recipient_filter, mailing_list_id, status)
      VALUES (?, ?, ?, ?, ?, 'draft')
    `).run(name, subject, body_html, filter, mailing_list_id);
    res.redirect('/admin/email');
  });

  apiRouter.post('/email/campaigns/:id/start', async (req: Request, res: Response): Promise<void> => {
    const id = parseInt(req.params.id as string, 10);
    const campaign: EmailCampaign | undefined = db.prepare('SELECT * FROM email_campaigns WHERE id = ?').get(id) as EmailCampaign | undefined;
    if (!campaign) { res.status(404).json({ error: 'Campaign not found' }); return; }

    if (campaign.mailing_list_id) {
      const activeCampaign = db.prepare(`
        SELECT id, name, status FROM email_campaigns 
        WHERE mailing_list_id = ? AND id != ? AND deleted_at IS NULL AND status IN ('sending', 'draft')
        ORDER BY created_at DESC LIMIT 1
      `).get(campaign.mailing_list_id, id) as ActiveCampaignInfo | undefined;

      if (activeCampaign) {
        res.status(400).json({ 
          error: 'Cannot start new campaign — list has active sending',
          activeCampaign: { id: activeCampaign.id, name: activeCampaign.name, status: activeCampaign.status }
        });
        return;
      }
    }

    let recipients: CampaignRecipient[] = [];

    if (campaign.mailing_list_id) {
      const contacts = db.prepare('SELECT email, name, company FROM mailing_list_contacts WHERE list_id = ? AND deleted_at IS NULL').all(campaign.mailing_list_id) as Pick<MailingListContact, 'email' | 'name' | 'company'>[];
      recipients = contacts.map(c => ({ email: c.email, name: c.name || undefined, company: c.company || undefined }));
    } else {
      if (campaign.recipient_filter === 'all' || campaign.recipient_filter === 'all_contractors') {
        const contractors = db.prepare('SELECT email, name FROM contractors WHERE is_active = 1').all() as EmailNameRow[];
        recipients.push(...contractors.map(c => ({ email: c.email, name: c.name ?? undefined })));
      }
      if (campaign.recipient_filter === 'all' || campaign.recipient_filter === 'clients') {
        const clients = db.prepare("SELECT email, name FROM users WHERE role = 'client' AND deleted_at IS NULL AND is_active = 1").all() as EmailNameRow[];
        recipients.push(...clients.map(c => ({ email: c.email, name: c.name ?? undefined })));
      }
      if (campaign.recipient_filter === 'all') {
        const contractors2 = db.prepare('SELECT email, name FROM contractors WHERE is_active = 1').all() as EmailNameRow[];
        recipients.push(...contractors2.map(c => ({ email: c.email, name: c.name ?? undefined })));
      }

      const seen = new Set<string>();
      recipients = recipients.filter(r => {
        if (seen.has(r.email)) return false;
        seen.add(r.email);
        return true;
      });
    }

    db.prepare('UPDATE email_campaigns SET status = ?, total_recipients = ?, started_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run('sending', recipients.length, id);

    const { sendCampaignEmails } = require('../../lib/email-campaign');
    sendCampaignEmails(id, recipients, campaign.subject, campaign.body_html).then((result: { sent: number; failed: number }) => {
      db.prepare('UPDATE email_campaigns SET status = ?, sent_count = ?, failed_count = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run('sent', result.sent, result.failed, id);
    }).catch((err: unknown) => {
      console.error('[email-campaign] send error:', err);
      db.prepare('UPDATE email_campaigns SET status = ? WHERE id = ?').run('stopped', id);
    });

    res.redirect('/admin/email');
  });

  apiRouter.post('/email/campaigns/:id/stop', (req: Request, res: Response): void => {
    const id = parseInt(req.params.id as string, 10);
    db.prepare("UPDATE email_campaigns SET status = 'stopped' WHERE id = ?").run(id);
    res.redirect('/admin/email');
  });

  apiRouter.post('/email/campaigns/:id/delete', (req: Request, res: Response): void => {
    const id = parseInt(req.params.id as string, 10);
    db.prepare('UPDATE email_campaigns SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
    if (req.headers['hx-request']) {
      res.set('HX-Trigger', JSON.stringify({ showNotification: { msg: 'Campaign deleted', type: 'success' } }));
      res.status(200).send('');
      return;
    }
    res.redirect('/admin/email');
  });

  apiRouter.post('/email/campaigns/:id/restore', (req: Request, res: Response): void => {
    const id = parseInt(req.params.id as string, 10);
    db.prepare('UPDATE email_campaigns SET deleted_at = NULL WHERE id = ?').run(id);
    if (req.headers['hx-request']) {
      res.set('HX-Trigger', JSON.stringify({ showNotification: { msg: 'Campaign restored', type: 'success' } }));
      res.status(200).send('');
      return;
    }
    res.redirect('/admin/trash');
  });

  apiRouter.post('/email/campaigns/:id/force-delete', (req: Request, res: Response): void => {
    const id = parseInt(req.params.id as string, 10);
    db.prepare('DELETE FROM email_campaigns WHERE id = ?').run(id);
    if (req.headers['hx-request']) {
      res.set('HX-Trigger', JSON.stringify({ showNotification: { msg: 'Campaign permanently deleted', type: 'success' } }));
      res.status(200).send('');
      return;
    }
    res.redirect('/admin/trash');
  });

  // ── EMAIL QUEUE API ──

  apiRouter.get('/email/queue-stats', (_req: Request, res: Response): void => {
    res.json(getQueueStats());
  });

  apiRouter.get('/email/queue', (req: Request, res: Response): void => {
    const status = (req.query.status as string) || 'queued';
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 200);
    const offset = parseInt(req.query.offset as string, 10) || 0;
    const items = getQueueItems(status, limit, offset);
    res.json({ items, stats: getQueueStats() });
  });

  // ── MAILING LISTS API ──

  apiRouter.post('/email/lists/create', (req: Request, res: Response): void => {
    const name = req.body.name as string;
    const description = req.body.description as string;
    if (!name) { res.status(400).json({ error: 'Name is required' }); return; }
    db.prepare('INSERT INTO mailing_lists (name, description) VALUES (?, ?)').run(name, description || null);
    res.redirect('/admin/email/lists');
  });

  apiRouter.post('/email/lists/:id/delete', (req: Request, res: Response): void => {
    const id = parseInt(req.params.id as string, 10);
    db.prepare('UPDATE mailing_lists SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
    if (req.headers['hx-request']) {
      res.set('HX-Trigger', JSON.stringify({ showNotification: { msg: 'Mailing list deleted', type: 'success' } }));
      res.status(200).send('');
      return;
    }
    res.redirect('/admin/email/lists');
  });

  apiRouter.post('/email/lists/:id/restore', (req: Request, res: Response): void => {
    const id = parseInt(req.params.id as string, 10);
    db.prepare('UPDATE mailing_lists SET deleted_at = NULL WHERE id = ?').run(id);
    if (req.headers['hx-request']) {
      res.set('HX-Trigger', JSON.stringify({ showNotification: { msg: 'Mailing list restored', type: 'success' } }));
      res.status(200).send('');
      return;
    }
    res.redirect('/admin/trash');
  });

  apiRouter.post('/email/lists/:id/force-delete', (req: Request, res: Response): void => {
    const id = parseInt(req.params.id as string, 10);
    db.prepare('DELETE FROM mailing_lists WHERE id = ?').run(id);
    res.redirect('/admin/trash');
  });

  apiRouter.get('/email/lists/:id/edit-name', (req: Request, res: Response): void => {
    const id = parseInt(req.params.id as string, 10);
    const list = db.prepare('SELECT * FROM mailing_lists WHERE id = ?').get(id) as MailingList | undefined;
    if (!list) { res.status(404).send('Not found'); return; }
    const t = (res.locals.t as (key: string) => string) || ((key: string) => key);
    res.render('admin/partials/_list-name-edit', { list, t });
  });

  apiRouter.get('/email/lists/:id/display-name', (req: Request, res: Response): void => {
    const id = parseInt(req.params.id as string, 10);
    const list = db.prepare('SELECT * FROM mailing_lists WHERE id = ?').get(id) as MailingList | undefined;
    if (!list) { res.status(404).send('Not found'); return; }
    const t = (res.locals.t as (key: string) => string) || ((key: string) => key);
    const referer = req.headers.referer || '';
    const isDetailPage = referer.includes('/admin/email/lists/') && !referer.endsWith('/admin/email/lists');
    res.render(isDetailPage ? 'admin/partials/_list-name-display' : 'admin/partials/_list-name-display-list', { list, t });
  });

  apiRouter.put('/email/lists/:id/rename', (req: Request, res: Response): void => {
    const id = parseInt(req.params.id as string, 10);
    const name = (req.body.name as string)?.trim();
    if (!name) { res.status(400).send('Name required'); return; }
    db.prepare('UPDATE mailing_lists SET name = ? WHERE id = ?').run(name, id);
    if (req.headers['hx-request']) {
      const t = (res.locals.t as (key: string) => string) || ((key: string) => key);
      res.set('HX-Trigger', JSON.stringify({ showNotification: { msg: t('email.listRenamed'), type: 'success' } }));
      const referer = req.headers.referer || '';
      const isDetailPage = referer.includes('/admin/email/lists/') && !referer.endsWith('/admin/email/lists');
      res.render(isDetailPage ? 'admin/partials/_list-name-display' : 'admin/partials/_list-name-display-list', { list: { id, name }, t });
      return;
    }
    res.redirect(`/admin/email/lists/${id}`);
  });

  apiRouter.post('/email/lists/:id/contacts/add', (req: Request, res: Response): void => {
    const listId = parseInt(req.params.id as string, 10);
    const email = req.body.email as string;
    const name = req.body.name as string;
    const company = req.body.company as string;
    if (!email) { res.status(400).json({ error: 'Email is required' }); return; }
    db.prepare('INSERT INTO mailing_list_contacts (list_id, email, name, company) VALUES (?, ?, ?, ?)')
      .run(listId, email, name || null, company || null);
    res.redirect(`/admin/email/lists/${listId}`);
  });

  apiRouter.post('/email/lists/:listId/contacts/:contactId/delete', (req: Request, res: Response): void => {
    const contactId = parseInt(req.params.contactId as string, 10);
    const listId = parseInt(req.params.listId as string, 10);
    db.prepare('UPDATE mailing_list_contacts SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(contactId);
    if (req.headers['hx-request']) {
      const newCsrfToken = res.locals.csrfToken as string;
      res.set('HX-Trigger', JSON.stringify({ 
        showNotification: { msg: 'Contact deleted', type: 'success' },
        updateCsrf: newCsrfToken
      }));
      res.set('X-CSRF-Token', newCsrfToken || '');
      res.status(200).send('');
      return;
    }
    res.redirect(`/admin/email/lists/${listId}`);
  });

  apiRouter.post('/email/lists/:listId/contacts/:contactId/restore', (req: Request, res: Response): void => {
    const contactId = parseInt(req.params.contactId as string, 10);
    const listId = parseInt(req.params.listId as string, 10);
    db.prepare('UPDATE mailing_list_contacts SET deleted_at = NULL WHERE id = ?').run(contactId);
    if (req.headers['hx-request']) {
      res.set('HX-Trigger', JSON.stringify({ showNotification: { msg: 'Contact restored', type: 'success' } }));
      res.status(200).send('');
      return;
    }
    res.redirect('/admin/trash');
  });

  apiRouter.post('/email/lists/:id/contacts/import', csvUpload.single('csv_file'), (req: Request, res: Response): void => {
    const listId = parseInt(req.params.id as string, 10);
    let csvText = '';

    if (req.file) {
      csvText = req.file.buffer.toString('utf-8');
    } else if (req.body.csv_data) {
      csvText = req.body.csv_data as string;
    }

    if (!csvText.trim()) {
      res.status(400).json({ error: 'CSV data is required' });
      return;
    }

    const lines = csvText.trim().split('\n');
    let imported = 0;
    const insert = db.prepare('INSERT INTO mailing_list_contacts (list_id, email, name, company) VALUES (?, ?, ?, ?)');

    const tx = db.transaction(() => {
      for (let i = 0; i < lines.length; i++) {
        const parts = lines[i].split(',').map((s: string) => s.trim());
        const email = parts[0];
        if (!email || !email.includes('@')) continue;
        const name = parts[1] || null;
        const company = parts[2] || null;
        insert.run(listId, email, name, company);
        imported++;
      }
    });
    tx();

    res.redirect(`/admin/email/lists/${listId}`);
  });

  // ── EMAIL SETTINGS ──

  pageRouter.get('/email/settings', (req: Request, res: Response): void => {
    const locale = (res.locals.locale as string) || 'en';
    const rows = db.prepare('SELECT * FROM email_settings').all() as EmailSetting[];
    const settings: Record<string, string> = {};
    for (const r of rows) settings[r.key] = r.value;

    const systemTmpl = db.prepare("SELECT * FROM email_templates WHERE system_key IS NOT NULL ORDER BY system_key").all();

    res.render('admin/email-settings', {
      title: (locale === 'id' ? 'Настройки Email — Admin' : 'Email Settings — Admin') + ' — Kontraktor',
      activePage: 'email-settings',
      settings,
      systemTmpl,
    });
  });

  apiRouter.get('/email/settings', (_req: Request, res: Response): void => {
    const rows = db.prepare('SELECT * FROM email_settings').all() as EmailSetting[];
    const settings: Record<string, string> = {};
    for (const r of rows) settings[r.key] = r.value;
    res.json(settings);
  });

  apiRouter.post('/email/settings/update', (req: Request, res: Response): void => {
    const upsert = db.prepare('INSERT INTO email_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP');
    for (const [key, val] of Object.entries(req.body)) {
      if (key === '_csrf') continue;
      upsert.run(key, String(val));
    }
    if (req.headers['hx-request']) {
      res.set('HX-Trigger', JSON.stringify({ showNotification: { msg: 'Settings saved', type: 'success' } }));
      res.status(200).send('');
      return;
    }
    res.redirect('/admin/email/settings');
  });

  // ── SYSTEM TEMPLATES API ──

  apiRouter.get('/email/system-templates', (_req: Request, res: Response): void => {
    const tmpl = db.prepare("SELECT * FROM email_templates WHERE system_key IS NOT NULL ORDER BY system_key").all();
    res.json(tmpl);
  });

  apiRouter.post('/email/system-templates/:key/update', (req: Request, res: Response): void => {
    const systemKey = req.params.key as string;
    const { subject, body_html } = req.body;
    const existing = db.prepare("SELECT id FROM email_templates WHERE system_key = ?").get(systemKey) as { id: number } | undefined;

    if (existing) {
      db.prepare("UPDATE email_templates SET subject = ?, body_html = ?, updated_at = CURRENT_TIMESTAMP WHERE system_key = ?")
        .run(subject, body_html, systemKey);
    } else {
      const name = req.body.name || systemKey;
      const description = req.body.description || '';
      db.prepare("INSERT INTO email_templates (name, subject, body_html, system_key, description) VALUES (?, ?, ?, ?, ?)")
        .run(name, subject, body_html, systemKey, description);
    }

    if (req.headers['hx-request']) {
      res.set('HX-Trigger', JSON.stringify({ showNotification: { msg: 'Template saved', type: 'success' } }));
      res.status(200).send('');
      return;
    }
    res.redirect('/admin/email/settings');
  });

  apiRouter.get('/email/system-templates/:key/preview', (req: Request, res: Response): void => {
    const systemKey = req.params.key as string;
    const tmpl = db.prepare("SELECT * FROM email_templates WHERE system_key = ?").get(systemKey);
    if (!tmpl) { res.status(404).send('Not found'); return; }
    res.json(tmpl);
  });
}
