/**
 * Service icon paths — single source of truth.
 * Used by both the landing page and the /services catalog.
 * Keys match category slugs in the database.
 */
export const serviceIcons: Record<string, string> = {
  'apartment-renovation': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>',
  'electrical-work': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>',
  'plumbing': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z"/>',
  'finishing': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 3h12a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2zM4 17h12M12 11v6m0 0a2 2 0 11-4 0v-2"/>',
  'construction': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>',
  'roofing': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2 17l10-10 10 10M2 12l10-10 10 10"/>',
  'facade': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h18v18H3z M3 9h18 M3 15h18 M9 3v6 M15 3v6 M5 9v6 M12 9v6 M19 9v6 M9 15v6 M15 15v6"/>',
  'landscaping': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 22v-5m0 0a5 5 0 005-5 4 4 0 00-3-3.87 5 5 0 00-8 0A4 4 0 007 12a5 5 0 005 5z"/>',
  'demolition': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>',
};

/** Default icon fallback when slug is not in the map */
export const defaultServiceIcon = serviceIcons['apartment-renovation'];
