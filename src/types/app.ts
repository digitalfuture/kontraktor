export interface PaginationInfo {
  page: number;
  totalPages: number;
  limit: number;
  totalItems: number;
  baseUrl: string;
  params?: Record<string, string | undefined>;
}

export interface AppError {
  message: string;
  status?: number;
  stack?: string;
}

export interface Locals {
  t: (key: string, params?: Record<string, string | number>) => string;
  locale: string;
  user?: import('./user').User;
  csrfToken?: string;
  [key: string]: unknown;
}
