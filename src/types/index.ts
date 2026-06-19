// Core domain types
export type { UserRole, User, Session } from './user';
export type { PaymentStatus, PaymentMethod, Payment, CreditPackage, CreditPackages } from './payment';
export type { Contractor, ContractorWithStats, ContractorFormData } from './contractor';
export type { ProjectStatus, Project, Bid } from './project';
export type { Category, Subcategory } from './category';
export type { PaginationInfo, AppError, Locals } from './app';

// Page-level types (kept from original)
export type { ServiceSubcategory, ServiceCategory, ContractorLandingSection, OrderFormData } from './page';

// Email system types
export type {
  Review,
  EmailTemplate,
  EmailCampaign,
  MailingList,
  MailingListContact,
  QueueItem,
  QueueStats,
  CampaignRecipient,
  RecipientStatus,
  ActiveCampaignInfo,
  EmailNameRow,
} from './email';

// Static data types
export type { District, ProvinceCentroid, Province } from './data';

export type { AddressInfo } from 'net';
