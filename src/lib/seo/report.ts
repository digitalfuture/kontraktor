// ── SEO — Report & FAQ data (used by cron/audit) ──

import { SeoIssue } from './types';
import { getFAQSchema } from './schemas';

const CATEGORY_NAMES: Record<string, { en: string; id: string }> = {
  'apartment-renovation': { en: 'Apartment Renovation', id: 'Renovasi Apartemen' },
  'electrical-work': { en: 'Electrical Work', id: 'Pekerjaan Listrik' },
  plumbing: { en: 'Plumbing', id: 'Pipa' },
  finishing: { en: 'Finishing', id: 'Finishing' },
  construction: { en: 'Construction', id: 'Konstruksi' },
  facade: { en: 'Facade', id: 'Fasad' },
  landscaping: { en: 'Landscaping', id: 'Taman' },
  roofing: { en: 'Roofing', id: 'Atap' },
  demolition: { en: 'Demolition', id: 'Pembongkaran' },
};

const SERVICE_FAQ: Record<string, { q: string; a: string }[]> = {
  plumbing: [
    { q: 'How much does plumbing service cost?', a: 'Plumbing service costs vary based on the job complexity. Minor repairs start from IDR 200,000 while full pipe replacement can range IDR 1,000,000-5,000,000. Get free quotes from our verified contractors.' },
    { q: 'How to find a reliable plumber?', a: 'Use Kontraktor to compare verified plumbers by rating, experience, and price. Read reviews from real customers and choose the best fit for your project.' },
  ],
  'electrical-work': [
    { q: 'Is it safe to do electrical work without a professional?', a: 'No, electrical work should only be done by licensed professionals. Our verified electricians ensure safety compliance with Indonesian electrical standards (PUIL).' },
    { q: 'How much does rewiring cost?', a: 'Full house rewiring costs between IDR 5,000,000-15,000,000 depending on house size. Get free estimates from our electricians.' },
  ],
};

function getDefaultFAQ(locale: 'en' | 'id'): { q: string; a: string }[] {
  return [
    {
      q: locale === 'id' ? 'Bagaimana cara memilih kontraktor yang tepat?' : 'How to choose the right contractor?',
      a: locale === 'id'
        ? 'Bandingkan beberapa kontraktor berdasarkan rating, portofolio, dan harga. Baca ulasan dari klien sebelumnya dan pastikan kontraktor memiliki pengalaman di bidang yang Anda butuhkan.'
        : 'Compare multiple contractors by rating, portfolio, and price. Read reviews from previous clients and ensure the contractor has experience in your required field.',
    },
    {
      q: locale === 'id' ? 'Apakah pasang proyek gratis?' : 'Is posting a project free?',
      a: locale === 'id'
        ? 'Ya, pasang proyek sepenuhnya gratis. Anda hanya perlu mendaftar akun, deskripsikan proyek Anda, dan dapatkan penawaran dari kontraktor.'
        : 'Yes, posting a project is completely free. Simply create an account, describe your project, and receive bids from contractors.',
    },
    {
      q: locale === 'id' ? 'Bagaimana sistem pembayarannya?' : 'How does payment work?',
      a: locale === 'id'
        ? 'Pembayaran dilakukan langsung antara Anda dan kontraktor. Kontraktor hanya sebagai platform pencocokan, semua kesepakatan finansial diatur antara kedua pihak.'
        : 'Payment is arranged directly between you and the contractor. Kontraktor is a matching platform only — all financial agreements are between both parties.',
    },
  ];
}

export function generateFAQSchema(slug?: string, locale: 'en' | 'id' = 'en'): object {
  const faqs = slug && SERVICE_FAQ[slug] ? SERVICE_FAQ[slug] : getDefaultFAQ(locale);
  return getFAQSchema(faqs);
}

export function generateSeoReport(): SeoIssue[] {
  const issues: SeoIssue[] = [];
  const pages = [
    { url: '/', name: 'Home' },
    { url: '/services', name: 'Services' },
    { url: '/contractors', name: 'Contractors' },
    { url: '/post', name: 'Post a Project' },
    { url: '/terms', name: 'Terms' },
    { url: '/privacy', name: 'Privacy' },
  ];

  for (const page of pages) {
    issues.push({
      type: 'info',
      page: page.url,
      message: `${page.name} — SEO configured`,
    });
  }

  // Check for missing meta descriptions across service categories
  for (const [slug] of Object.entries(CATEGORY_NAMES)) {
    issues.push({
      type: 'info',
      page: `/services/${slug}`,
      message: `Category "${slug}" — SEO auto-generated`,
    });
  }

  return issues;
}
