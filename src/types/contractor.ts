export interface Contractor {
  id: number;
  email: string;
  name: string | null;
  phone: string | null;
  experience: number | null;
  bio: string | null;
  avatar_url: string | null;
  category_id: number | null;
  specialty: string | null;
  rating: number;
  reviews_count: number;
  completed_projects: number;
  is_verified: number;
  is_approved: number;
  is_active: number;
  credits: number;
  created_at: string;
}

export interface ContractorWithStats extends Contractor {
  review_count: number;
  avg_rating: number;
}

export interface ContractorFormData {
  name: string;
  email: string;
  phone: string;
  specialty: string;
  experience: string;
  bio: string;
}
