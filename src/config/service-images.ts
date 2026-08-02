/**
 * Service category images — single source of truth.
 * Maps category slugs to image filenames in /public/images.
 * Used by the landing page, /services catalog and service detail pages.
 */
export const serviceImages: Record<string, string> = {
  'demolition': 'Demolition.PNG',
  'electrical-work': 'Electrical.PNG',
  'facade': 'Facade.PNG',
  'finishing': 'Finishing.PNG',
  'construction': 'Home Building.PNG',
  'landscaping': 'Landscaping.PNG',
  'plumbing': 'Plumbing.PNG',
  'apartment-renovation': 'Renovation.PNG',
  'roofing': 'Roofing.PNG',
  'civil-engineering': 'Civil engineering.PNG',
  'construction-company': 'Construction company.PNG',
  'general-contractor': 'General contractor.PNG',
  'interior-renovation': 'Interior renovation.PNG',
  'mep-systems': 'Mep systems.PNG',
  'steel-structure': 'Steel structure.PNG',
  'waterproofing': 'Waterproofing.PNG',
};

/** Default image fallback when slug is not in the map */
export const defaultServiceImage = serviceImages['apartment-renovation'];
