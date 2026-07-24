export type UserRole = 'admin' | 'contractor' | 'client';

export interface User {
  id: number;
  email: string;
  name: string | null;
  phone: string | null;
  role: UserRole;
  telegram_id: string | null;
  is_verified: number;
  is_active: number;
  // Contractor extension fields (populated when is_contractor = 1)
  is_contractor: number;
  bio: string | null;
  avatar_url: string | null;
  category_id: number | null;
  specialty: string | null;
  rating: number;
  reviews_count: number;
  completed_projects: number;
  is_approved: number;
  credits: number;
  notifications_enabled: number;
  notification_categories: string | null;
  max_projects: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// Contractor is now the same as User with is_contractor=1
export type Contractor = User;
export type ContractorWithStats = User;
export type ContractorFormData = User;

export interface Session {
  id: string;
  user_id: number;
  token: string;
  expires_at: string;
  created_at: string;
}
