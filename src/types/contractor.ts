// Contractor types are now aliases for User.
// All contractor attributes live on the users table.
// Import { User as Contractor } from './user' or use the type aliases below.
import type { User } from './user';

export type Contractor = User;
export type ContractorWithStats = User;

// Form data for contractor registration
export interface ContractorFormData {
  name: string;
  email: string;
  phone: string;
  telegram_id: string;
  specialty: string;
  bio: string;
}
