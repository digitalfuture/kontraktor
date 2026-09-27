// ── SEO — Shared types and constants ──

export const SITE_URL = 'https://kontraktor.app';

export interface SeoData {
  title: string;
  description: string;
  canonical: string;
  ogType?: string;
  ogImage?: string;
  ogImageWidth?: number;
  ogImageHeight?: number;
  twitterCard?: 'summary' | 'summary_large_image';
  noIndex?: boolean;
  jsonLd?: object[];
  locale: 'en' | 'id';
  alternateLocales?: { lang: string; href: string }[];
  publishedTime?: string;
  modifiedTime?: string;
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
  lat?: number;
  lng?: number;
}

export const TOP_SEO_LOCATIONS: SeoLocation[] = [
  { slug: 'jakarta', name: 'Jakarta', nameId: 'DKI Jakarta', nameEn: 'Jakarta', province: 'Jakarta', lat: -6.2088, lng: 106.8456 },
  { slug: 'bali', name: 'Bali', nameId: 'Bali', nameEn: 'Bali', province: 'Bali', lat: -8.4095, lng: 115.1889 },
  { slug: 'surabaya', name: 'Surabaya', nameId: 'Surabaya', nameEn: 'Surabaya', province: 'East Java', lat: -7.2575, lng: 112.7521 },
  { slug: 'bandung', name: 'Bandung', nameId: 'Bandung', nameEn: 'Bandung', province: 'West Java', lat: -6.9175, lng: 107.6191 },
  { slug: 'tangerang', name: 'Tangerang', nameId: 'Tangerang', nameEn: 'Tangerang', province: 'Banten', lat: -6.1783, lng: 106.6319 },
  { slug: 'bekasi', name: 'Bekasi', nameId: 'Bekasi', nameEn: 'Bekasi', province: 'West Java', lat: -6.2383, lng: 106.9756 },
  { slug: 'medan', name: 'Medan', nameId: 'Medan', nameEn: 'Medan', province: 'North Sumatra', lat: 3.5952, lng: 98.6722 },
  { slug: 'semarang', name: 'Semarang', nameId: 'Semarang', nameEn: 'Semarang', province: 'Central Java', lat: -6.9667, lng: 110.4167 },
  { slug: 'yogyakarta', name: 'Yogyakarta', nameId: 'DI Yogyakarta', nameEn: 'Yogyakarta', province: 'Yogyakarta', lat: -7.7956, lng: 110.3695 },
  { slug: 'denpasar', name: 'Denpasar', nameId: 'Denpasar', nameEn: 'Denpasar', province: 'Bali', lat: -8.6705, lng: 115.2126 },
  { slug: 'badung', name: 'Badung', nameId: 'Badung (Canggu & Seminyak)', nameEn: 'Badung', province: 'Bali', lat: -8.5833, lng: 115.1833 },
  { slug: 'makassar', name: 'Makassar', nameId: 'Makassar', nameEn: 'Makassar', province: 'South Sulawesi', lat: -5.1477, lng: 119.4327 },
  { slug: 'batam', name: 'Batam', nameId: 'Batam', nameEn: 'Batam', province: 'Riau Islands', lat: 1.0456, lng: 104.0305 },
];
