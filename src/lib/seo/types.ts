// ── SEO — Shared types and constants ──

export const SITE_URL = 'https://kontraktor.app';

export interface SeoData {
  title: string;
  description: string;
  canonical: string;
  ogType?: string;
  ogImage?: string;
  noIndex?: boolean;
  jsonLd?: object[];
  locale: 'en' | 'id';
  alternateLocales?: { lang: string; href: string }[];
  publishedTime?: string;
  keywords?: string;
}

export interface BreadcrumbItem {
  name: string;
  item: string;
}

export interface SeoIssue {
  type: 'warning' | 'error' | 'info';
  page: string;
  message: string;
}
