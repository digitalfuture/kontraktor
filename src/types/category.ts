export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  name_en: string | null;
  name_id: string | null;
  description_en: string | null;
  description_id: string | null;
  is_active: number;
  created_at: string;
}

export interface Subcategory {
  id: number;
  category_id: number;
  name: string;
  slug: string;
  price_from: string | null;
  contractors_count: number;
  name_en: string | null;
  name_id: string | null;
}
