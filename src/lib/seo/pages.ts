// ── SEO — Page-specific builders ──

import { SITE_URL, SeoData } from './types';
import {
  getOrganizationSchema,
  getWebSiteSchema,
  getLocalBusinessSchema,
  getBreadcrumbSchema,
  getServiceSchema,
  getContractorSchema,
  getProjectSchema,
} from './schemas';

export function homePageSeo(locale: 'en' | 'id'): SeoData {
  const title =
    locale === 'id'
      ? 'Kontraktor — Cari Kontraktor Terpercaya untuk Proyek Konstruksi'
      : 'Kontraktor — Find Trusted Contractors for Your Construction Projects';
  const description =
    locale === 'id'
      ? 'Temukan kontraktor profesional berpengalaman untuk renovasi rumah, bangun baru, dan perbaikan. Pasang proyek gratis, dapatkan penawaran terbaik.'
      : 'Find trusted professional contractors for home renovation, new builds, and repairs. Post your project free and get the best bids.';

  return {
    title,
    description,
    canonical: `${SITE_URL}/`,
    ogType: 'website',
    locale,
    jsonLd: [
      getOrganizationSchema(locale),
      getWebSiteSchema(locale),
      getLocalBusinessSchema(),
      getBreadcrumbSchema([{ name: 'Home', item: '/' }]),
    ],
  };
}

export function servicesPageSeo(locale: 'en' | 'id'): SeoData {
  const title =
    locale === 'id'
      ? 'Jasa Kontraktor Profesional — Kontraktor'
      : 'Professional Contractor Services — Kontraktor';
  const description =
    locale === 'id'
      ? 'Lihat semua layanan konstruksi dan renovasi: plumbing, listrik, finishing, atap, taman, dan banyak lagi. Bandingkan kontraktor terbaik.'
      : 'Browse all construction and renovation services: plumbing, electrical, finishing, roofing, landscaping and more. Compare top contractors.';

  return {
    title,
    description,
    canonical: `${SITE_URL}/services`,
    ogType: 'website',
    locale,
    jsonLd: [
      getOrganizationSchema(locale),
      getWebSiteSchema(locale),
      getBreadcrumbSchema([
        { name: 'Home', item: '/' },
        { name: locale === 'id' ? 'Layanan' : 'Services', item: '/services' },
      ]),
    ],
  };
}

export function serviceCategorySeo(
  slug: string,
  name: string,
  description: string,
  locale: 'en' | 'id',
): SeoData {
  return {
    title: `${name} — Kontraktor`,
    description: description.substring(0, 160),
    canonical: `${SITE_URL}/services/${slug}`,
    ogType: 'website',
    locale,
    jsonLd: [
      getOrganizationSchema(locale),
      getServiceSchema(name, description, slug),
      getBreadcrumbSchema([
        { name: 'Home', item: '/' },
        { name: locale === 'id' ? 'Layanan' : 'Services', item: '/services' },
        { name, item: `/services/${slug}` },
      ]),
    ],
  };
}

export function contractorsListSeo(locale: 'en' | 'id'): SeoData {
  const title =
    locale === 'id'
      ? 'Kontraktor Profesional — Kontraktor'
      : 'Professional Contractors — Kontraktor';
  const description =
    locale === 'id'
      ? 'Cari dan bandingkan kontraktor profesional terverifikasi di Indonesia. Filter berdasarkan spesialisasi, rating, dan pengalaman.'
      : 'Search and compare verified professional contractors in Indonesia. Filter by specialty, rating, and experience.';

  return {
    title,
    description,
    canonical: `${SITE_URL}/contractors`,
    ogType: 'website',
    locale,
    jsonLd: [
      getOrganizationSchema(locale),
      getBreadcrumbSchema([
        { name: 'Home', item: '/' },
        { name: locale === 'id' ? 'Kontraktor' : 'Contractors', item: '/contractors' },
      ]),
    ],
  };
}

export function contractorProfileSeo(
  name: string,
  bio: string,
  rating: number | null,
  reviewCount: number,
  locale: 'en' | 'id',
  contractorId: number,
): SeoData {
  const desc = bio
    ? bio.substring(0, 160)
    : locale === 'id'
      ? `Profil kontraktor ${name} — lihat portofolio, rating, dan proyek yang sudah diselesaikan.`
      : `Contractor profile of ${name} — view portfolio, rating, and completed projects.`;

  return {
    title: `${name} — Kontraktor`,
    description: desc,
    canonical: `${SITE_URL}/contractors/${contractorId}`,
    ogType: 'profile',
    ogImage: undefined,
    locale,
    jsonLd: [
      getContractorSchema(name, bio || desc, rating || undefined, reviewCount),
      getBreadcrumbSchema([
        { name: 'Home', item: '/' },
        { name: locale === 'id' ? 'Kontraktor' : 'Contractors', item: '/contractors' },
        { name, item: `/contractors/${contractorId}` },
      ]),
    ],
  };
}

export function projectDetailSeo(
  title: string,
  description: string,
  category: string,
  createdAt: string,
  locale: 'en' | 'id',
  projectId: number,
): SeoData {
  return {
    title: `${title} — Kontraktor`,
    description: (description || 'Lihat detail proyek').substring(0, 160),
    canonical: `${SITE_URL}/post/${projectId}`,
    ogType: 'article',
    locale,
    publishedTime: createdAt,
    jsonLd: [
      getProjectSchema(title, description, category, createdAt),
      getBreadcrumbSchema([
        { name: 'Home', item: '/' },
        { name: locale === 'id' ? 'Proyek' : 'Projects', item: '/projects' },
        { name: title, item: `/post/${projectId}` },
      ]),
    ],
  };
}

export function postProjectSeo(locale: 'en' | 'id'): SeoData {
  const title =
    locale === 'id'
      ? 'Pasang Proyek Gratis — Kontraktor'
      : 'Post a Project Free — Kontraktor';
  const description =
    locale === 'id'
      ? 'Pasang proyek renovasi atau konstruksi Anda secara gratis. Dapatkan penawaran dari kontraktor profesional terverifikasi.'
      : 'Post your renovation or construction project for free. Get bids from verified professional contractors.';

  return {
    title,
    description,
    canonical: `${SITE_URL}/post`,
    ogType: 'website',
    locale,
    jsonLd: [
      getBreadcrumbSchema([
        { name: 'Home', item: '/' },
        { name: locale === 'id' ? 'Pasang Proyek' : 'Post a Project', item: '/post' },
      ]),
    ],
  };
}

export function contractorRegisterSeo(locale: 'en' | 'id'): SeoData {
  const title =
    locale === 'id'
      ? 'Daftar sebagai Kontraktor — Kontraktor'
      : 'Register as Contractor — Kontraktor';
  const description =
    locale === 'id'
      ? 'Daftar sebagai kontraktor dan dapatkan proyek baru setiap hari. Bergabunglah dengan ribuan kontraktor di platform kami.'
      : 'Register as a contractor and get new projects daily. Join thousands of contractors on our platform.';

  return {
    title,
    description,
    canonical: `${SITE_URL}/contractors/register`,
    ogType: 'website',
    locale,
  };
}

export function termsSeo(locale: 'en' | 'id'): SeoData {
  return {
    title: `${locale === 'id' ? 'Ketentuan Layanan' : 'Terms of Service'} — Kontraktor`,
    description:
      locale === 'id'
        ? 'Ketentuan layanan platform Kontraktor. Baca syarat dan ketentuan penggunaan platform.'
        : 'Terms of service for Kontraktor platform. Read the terms and conditions for using our platform.',
    canonical: `${SITE_URL}/terms`,
    ogType: 'website',
    locale,
    jsonLd: [
      getOrganizationSchema(locale),
      getBreadcrumbSchema([
        { name: 'Home', item: '/' },
        { name: locale === 'id' ? 'Ketentuan' : 'Terms', item: '/terms' },
      ]),
    ],
  };
}

export function privacySeo(locale: 'en' | 'id'): SeoData {
  return {
    title: `${locale === 'id' ? 'Kebijakan Privasi' : 'Privacy Policy'} — Kontraktor`,
    description:
      locale === 'id'
        ? 'Kebijakan privasi platform Kontraktor. Bagaimana kami mengumpulkan, menggunakan, dan melindungi data Anda.'
        : 'Privacy policy for Kontraktor platform. How we collect, use, and protect your data.',
    canonical: `${SITE_URL}/privacy`,
    ogType: 'website',
    locale,
    jsonLd: [
      getOrganizationSchema(locale),
      getBreadcrumbSchema([
        { name: 'Home', item: '/' },
        { name: locale === 'id' ? 'Privasi' : 'Privacy', item: '/privacy' },
      ]),
    ],
  };
}
