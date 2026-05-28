export type ProjectStatus = 'pending' | 'active' | 'completed' | 'cancelled';

export interface Project {
  id: number;
  title: string;
  description: string | null;
  category: string | null;
  subcategory: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  address: string | null;
  budget: number | null;
  client_email: string | null;
  district: string | null;
  assigned_contractor_id: number | null;
  reviewed: number;
  status: ProjectStatus;
  created_at: string;
}

export interface Bid {
  id: number;
  project_id: number;
  contractor_id: number;
  price: number | null;
  estimated_days: number | null;
  description: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}
