// ── SEO — Barrel exports ──

export type { SeoData, BreadcrumbItem, SeoIssue, SeoLocation } from './types';
export { SITE_URL, TOP_SEO_LOCATIONS } from './types';

export {
  getOrganizationSchema,
  getWebSiteSchema,
  getLocalBusinessSchema,
  getBreadcrumbSchema,
  getFAQSchema,
  getServiceSchema,
  getProjectSchema,
  getContractorSchema,
} from './schemas';

export {
  homePageSeo,
  servicesPageSeo,
  serviceCategorySeo,
  serviceLocationCategorySeo,
  contractorsListSeo,
  contractorLocationListSeo,
  contractorProfileSeo,
  projectDetailSeo,
  postProjectSeo,
  contractorRegisterSeo,
  termsSeo,
  privacySeo,
} from './pages';

export {
  renderJsonLd,
  renderAlternateLinks,
  getPaginationMeta,
} from './render';

export {
  generateFAQSchema,
  generateSeoReport,
} from './report';
