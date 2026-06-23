#!/usr/bin/env python3
import re

# ── Patch email-queue.ts ──
with open('/root/kontraktor/src/lib/email-queue.ts', 'r') as f:
    q = f.read()

# Remove the duplicate `const fromEmail` block the bot added
q = q.replace(
    """const fromEmail = process.env.SMTP_FROM || 'noreply@kontraktor.id';
export { fromEmail };

const fromEmail = process.env.SMTP_FROM || 'noreply@kontraktor.id';
const isDev = process.env.NODE_ENV !== 'production';""",
    """const fromEmail = process.env.SMTP_FROM || 'noreply@kontraktor.id';
export { fromEmail };

export { fromEmail as fromEmailQ };
const isDev = process.env.NODE_ENV !== 'production';""",
    1
)

# Add `export { createTransporter };` before `const fromEmail`
q = q.replace(
    "const fromEmail = process.env.SMTP_FROM || 'noreply@kontraktor.id';",
    "export { createTransporter };\n\nexport const fromEmail2 = process.env.SMTP_FROM || 'noreply@kontraktor.id';"
)

with open('/root/kontraktor/src/lib/email-queue.ts', 'w') as f:
    f.write(q)
print('queue patched')

# ── Patch admin/email.ts ──
with open('/root/kontraktor/src/routes/admin/email.ts', 'r') as f:
    r = f.read()

# Add imports
r = r.replace(
    "import { getQueueStats, getQueueItems } from '../../lib/email-queue';",
    "import { getQueueItems } from '../../lib/email-queue';\nimport { createTransporter, fromEmail2 as fromEmailLocal, fromEmail } from '../../lib/email-queue';\nimport type { SentMessageInfo } from 'nodemailer';"
)

# Use local var to avoid name conflict
r = r.replace("import { createTransporter, fromEmail2 as fromEmailLocal, fromEmail } from '../../lib/email-queue';",
              "import { createTransporter, fromEmail } from '../../lib/email-queue';\nimport type { SentMessageInfo } from 'nodemailer';")

# Remove duplicate helpers imports if any
r = re.sub(r"import \{ makeT, getPagination, localizedName, PAGE_SIZE, csvUpload \} from '\./helpers'\;\nimport \{ makeT, getPagination, localizedName, PAGE_SIZE, csvUpload \} from '\./helpers'\;",
           "import { makeT, getPagination, localizedName, PAGE_SIZE, csvUpload } from './helpers';", r)

# Add relay endpoint
endpoint = r"""
  // ── SMTP Relay (для Gmail / любого IP) ──
  const RELAY_KEY = process.env.EMAIL_RELAY_KEY;
  if (!RELAY_KEY) {
    console.warn('[email-relay] EMAIL_RELAY_KEY not set — relay endpoint disabled');
  }

  apiRouter.post('/email/relay', express.json(), (req: import('express').Request, res: import('express').Response): void => {
    if (!RELAY_KEY) {
      res.status(503).json({ error: 'Relay not configured' });
      return;
    }

    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : (req.query.key as string | undefined);

    if (token !== RELAY_KEY) {
      res.status(401).json({ error: 'Invalid relay key' });
      return;
    }

    const from: string = (req.body.from as string | undefined) || fromEmail;
    const to: string = (req.body.to as string)?.trim() || '';
    const subject: string = (req.body.subject as string)?.trim() || '';
    const html: string = (req.body.html as string) || '';
    const text: string = (req.body.text as string) || '';

    if (!to || !subject) {
      res.status(400).json({ error: 'Missing to or subject' });
      return;
    }

    createTransporter().sendMail({
      from,
      to,
      subject,
      html,
      text: text || undefined,
    }).then((info: SentMessageInfo) => {
      db.prepare(`
        INSERT INTO email_log (recipient_email, subject, status, sent_at, created_at)
        VALUES (?, ?, 'sent', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(to, subject);
      res.json({ ok: true, messageId: info.messageId });
    }).catch((err: unknown) => {
      const errMsg = typeof err === 'object' && err !== null
        ? String((err as { message?: string }).message ?? 'Unknown error').slice(0, 500)
        : 'Unknown error';
      db.prepare(`
        INSERT INTO email_log (recipient_email, subject, status, error, created_at)
        VALUES (?, ?, 'failed', ?, CURRENT_TIMESTAMP)
      `).run(to, subject, errMsg);
      res.status(502).json({ error: 'Send failed', detail: errMsg });
    });
  });
"""

r = r.rstrip() + '\n' + endpoint

with open('/root/kontraktor/src/routes/admin/email.ts', 'w') as f:
    f.write(r)
print('email.ts patched')
