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
  pagination?: {
    prev?: string;
    next?: string;
  };
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

export interface SeoLocation {
  slug: string;
  name: string;
  nameId: string;
  nameEn: string;
  province: string;
}

export const TOP_SEO_LOCATIONS: SeoLocation[] = [
  { slug: 'jakarta', name: 'Jakarta', nameId: 'DKI Jakarta', nameEn: 'Jakarta', province: 'Jakarta' },
  { slug: 'bali', name: 'Bali', nameId: 'Bali', nameEn: 'Bali', province: 'Bali' },
  { slug: 'surabaya', name: 'Surabaya', nameId: 'Surabaya', nameEn: 'Surabaya', province: 'East Java' },
  { slug: 'bandung', name: 'Bandung', nameId: 'Bandung', nameEn: 'Bandung', province: 'West Java' },
  { slug: 'tangerang', name: 'Tangerang', nameId: 'Tangerang', nameEn: 'Tangerang', province: 'Banten' },
  { slug: 'bekasi', name: 'Bekasi', nameId: 'Bekasi', nameEn: 'Bekasi', province: 'West Java' },
  { slug: 'medan', name: 'Medan', nameId: 'Medan', nameEn: 'Medan', province: 'North Sumatra' },
  { slug: 'semarang', name: 'Semarang', nameId: 'Semarang', nameEn: 'Semarang', province: 'Central Java' },
];
