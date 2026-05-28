export type PaymentStatus = 'pending' | 'completed' | 'failed';

export type PaymentMethod = 'bank_transfer' | 'credit_card' | 'e_wallet' | 'over_the_counter' | 'qris' | 'virtual_account';

export interface Payment {
  id: number;
  contractor_id: number;
  external_id: string;
  amount: number;
  credits: number;
  status: PaymentStatus;
  payment_method: PaymentMethod | null;
  created_at: string;
  updated_at: string;
}

export interface CreditPackage {
  name: string;
  price: number;
  credits: number;
}

export interface CreditPackages {
  [key: string]: CreditPackage;
}
