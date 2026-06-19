// ── SEO — Barrel exports ──

export type { SeoData, BreadcrumbItem, SeoIssue } from './types';
export { SITE_URL } from './types';

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
  contractorsListSeo,
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
