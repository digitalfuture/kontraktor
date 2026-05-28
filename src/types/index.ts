// Core domain types
export type { UserRole, User, Session } from './user';
export type { PaymentStatus, PaymentMethod, Payment, CreditPackage, CreditPackages } from './payment';
export type { Contractor, ContractorWithStats, ContractorFormData } from './contractor';
export type { ProjectStatus, Project, Bid } from './project';
export type { Category, Subcategory } from './category';
export type { PaginationInfo, AppError, Locals } from './app';

// Page-level types (kept from original)
export type { ServiceSubcategory, ServiceCategory, ContractorLandingSection, OrderFormData } from './page';

export type { AddressInfo } from 'net';
