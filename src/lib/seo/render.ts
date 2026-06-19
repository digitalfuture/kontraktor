// ── SEO — Render helpers ──

import { SeoData } from './types';

function escapeJsonLd(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '\\\\u003c')
    .replace(/>/g, '\\\\u003e')
    .replace(/\//g, '\\\\/');
}

export function renderJsonLd(data: SeoData): string {
  if (!data.jsonLd?.length) return '';
  return data.jsonLd
    .map((schema) => {
      const json = JSON.stringify(schema);
      return `<script type="application/ld+json">${escapeJsonLd(json)}</script>`;
    })
    .join('\n  ');
}

export function renderAlternateLinks(data: SeoData): string {
  const alternates = data.alternateLocales || [];
  const links = alternates.map(
    (a) => `  <link rel="alternate" href="${a.href}" hreflang="${a.lang}" />`,
  );
  // Also add x-default if not present
  if (!alternates.find((a) => a.lang === 'x-default')) {
    links.push(`  <link rel="alternate" href="${data.canonical}" hreflang="x-default" />`);
  }
  return links.join('\n');
}

export function getPaginationMeta(currentPage: number, totalPages: number, baseUrl: string): {
  prev?: string;
  next?: string;
} {
  return {
    ...(currentPage > 1 ? { prev: `${baseUrl}?page=${currentPage - 1}` } : {}),
    ...(currentPage < totalPages ? { next: `${baseUrl}?page=${currentPage + 1}` } : {}),
  };
}
