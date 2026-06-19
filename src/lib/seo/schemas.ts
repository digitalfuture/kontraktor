// ── SEO — JSON-LD schema generators ──

import { SITE_URL, BreadcrumbItem } from './types';

export function getOrganizationSchema(locale: 'en' | 'id'): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Kontraktor',
    url: SITE_URL,
    logo: `${SITE_URL}/favicon.svg`,
    description:
      locale === 'id'
        ? 'Platform pencarian kontraktor terpercaya di Indonesia'
        : 'Find trusted construction professionals in Indonesia',
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'ID',
    },
    sameAs: [],
  };
}

export function getWebSiteSchema(locale: 'en' | 'id'): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    url: SITE_URL,
    name: 'Kontraktor',
    alternateName:
      locale === 'id'
        ? 'Kontraktor — Cari Kontraktor Terpercaya'
        : 'Kontraktor — Find Trusted Contractors',
    description:
      locale === 'id'
        ? 'Temukan kontraktor profesional untuk proyek renovasi, konstruksi, dan perbaikan rumah Anda'
        : 'Find professional contractors for your renovation, construction and home improvement projects',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/contractors?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function getLocalBusinessSchema(): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    name: 'Kontraktor',
    url: SITE_URL,
    areaServed: [
      { '@type': 'Country', name: 'ID' },
    ],
    availableLanguage: ['English', 'Indonesian'],
    priceRange: '$$',
  };
}

export function getBreadcrumbSchema(items: BreadcrumbItem[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.item.startsWith('http') ? item.item : `${SITE_URL}${item.item}`,
    })),
  };
}

export function getFAQSchema(questions: { q: string; a: string }[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: questions.map((qa) => ({
      '@type': 'Question',
      name: qa.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: qa.a,
      },
    })),
  };
}

export function getServiceSchema(
  name: string,
  description: string,
  category: string,
): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name,
    description,
    category,
    provider: {
      '@type': 'Organization',
      name: 'Kontraktor',
    },
    areaServed: { '@type': 'Country', name: 'ID' },
  };
}

export function getProjectSchema(
  title: string,
  description: string,
  category: string,
  datePosted: string,
  budget?: string,
): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Project',
    name: title,
    description,
    category,
    datePosted,
    ...(budget ? { budget } : {}),
    isAcceptingNewClients: true,
  };
}

export function getContractorSchema(
  name: string,
  description: string,
  rating?: number,
  reviewCount?: number,
  priceRange?: string,
): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    name,
    description,
    ...(rating ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: rating, reviewCount: reviewCount || 0 } } : {}),
    ...(priceRange ? { priceRange } : {}),
    areaServed: { '@type': 'Country', name: 'ID' },
  };
}
