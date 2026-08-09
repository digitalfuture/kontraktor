/**
 * Service category images — single source of truth.
 * Maps category slugs to image filenames in /public/images.
 * Used by the landing page, /services catalog and service detail pages.
 * All images are WebP (converted from PNG, ~40% smaller).
 */
export const serviceImages: Record<string, string> = {
  'demolition': 'Demolition.webp',
  'electrical-work': 'Electrical.webp',
  'facade': 'Facade.webp',
  'finishing': 'Finishing.webp',
  'construction': 'Home Building.webp',
  'landscaping': 'Landscaping.webp',
  'plumbing': 'Plumbing.webp',
  'apartment-renovation': 'Renovation.webp',
  'roofing': 'Roofing.webp',
  'civil-engineering': 'Civil engineering.webp',
  'construction-company': 'Construction company.webp',
  'general-contractor': 'General contractor.webp',
  'interior-renovation': 'Interior renovation.webp',
  'mep-systems': 'Mep systems.webp',
  'steel-structure': 'Steel structure.webp',
  'waterproofing': 'Waterproofing.webp',
};

/** Default image fallback when slug is not in the map */
export const defaultServiceImage = serviceImages['apartment-renovation'];