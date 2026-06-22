export interface Review {
  id: number;
  contractor_id: number | null;
  project_id: number | null;
  author_email: string;
  client_email: string | null;
  rating: number;
  comment: string | null;
  is_moderated: number;
  is_approved: number;
  created_at: string;
  deleted_at: string | null;
}

export interface EmailTemplate {
  id: number;
  name: string;
  subject: string;
  body_html: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface EmailCampaign {
  id: number;
  name: string;
  template_id: number | null;
  subject: string;
  body_html: string;
  recipient_filter: string;
  status: string;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  created_by: number | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  mailing_list_id: number | null;
  deleted_at: string | null;
}

export interface MailingList {
  id: number;
  name: string;
  description: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
  contact_count?: number;
  active_campaign_status?: string | null;
  active_campaign_id?: number | null;
  active_campaign_name?: string | null;
  deleted_at: string | null;
}

export interface MailingListContact {
  id: number;
  list_id: number;
  email: string;
  name: string | null;
  company: string | null;
  notes: string | null;
  created_at: string;
  list_name?: string;
  deleted_at: string | null;
}

// — Email Queue types —

export interface QueueItem {
  id: number;
  to_email: string;
  subject: string;
  html: string;
  priority: number;
  status: 'queued' | 'processing' | 'sent' | 'failed';
  campaign_id: number | null;
  recipient_name: string | null;
  reply_to: string | null;
  error: string | null;
  retry_at: string | null;
  created_at: string;
  processed_at: string | null;
  attempts: number;
}

export interface QueueStats {
  queued: number;
  processing: number;
  sentToday: number;
  failedToday: number;
  quotaLimit: number;
  quotaRemaining: number;
  waitingRetry: number;
  maxAttempts: number;
  providerCooldown: boolean;
  providerCooldownSeconds: number;
  sendIntervalMs: number;
}

// — API response types —

/** Recipient used when sending a campaign */
export interface CampaignRecipient {
  email: string;
  name?: string;
  company?: string;
}

/** Recipient status row shown in list detail */
export interface RecipientStatus {
  email: string;
  send_status: string;
  sent_at?: string;
  error?: string;
}

/** Active campaign info (used in conflict check) */
export interface ActiveCampaignInfo {
  id: number;
  name: string;
  status: string;
}

/** Simple DB row with email + name (projection queries) */
export interface EmailNameRow {
  email: string;
  name: string | null;
}

// — Email Settings & System Templates —

export interface EmailSetting {
  key: string;
  value: string;
  updated_at: string;
}

export interface SystemEmailTemplate extends EmailTemplate {
  system_key: string | null;
  description: string | null;
}
