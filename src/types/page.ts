export interface ServiceSubcategory {
  name: string;
  nameEn?: string;
  nameId?: string;
  slug: string;
  count: number;
  priceFrom: string;
}

export interface ServiceCategory {
  name: string;
  nameEn?: string;
  nameId?: string;
  slug: string;
  icon: string;
  description: string;
  descriptionEn?: string;
  descriptionId?: string;
  subcategories: ServiceSubcategory[];
  totalContractors: number;
}

export interface ContractorLandingSection {
  title: string;
  description: string;
  icon: string;
  items: string[];
}

export interface OrderFormData {
  service: string;
  description: string;
  address: string;
  deadline: string;
  contactPhone: string;
  contactName: string;
}
