import 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        name: string | null;
        role: import('./user').UserRole;
      };
    }

    interface Locals {
      /** Translation function */
      t: (key: string, params?: Record<string, string | number>) => string | any[];
      /** Current locale ('en' | 'id') */
      locale: string;
      /** Available locales list */
      locales?: string[];
      /** Current user (null if not authenticated) */
      user?: import('./user').User | null;
      /** CSRF token */
      csrfToken?: string;
      /** CSS version for cache busting */
      cssVersion: string;
      /** App version from package.json */
      appVersion: string;
      /** Build timestamp */
      buildTimestamp: string;
      /** Google Analytics tracking ID */
      GA_TRACKING_ID: string | null;
      /** Whether analytics is disabled (internal traffic / opt-out) */
      GA_DISABLED?: boolean;
      /** Locale-specific alternate URLs for hreflang */
      alternateLocales?: { lang: string; href: string }[];
      /** Canonical URL override */
      canonicalUrl?: string;
      /** Budget formatting helper */
      formatBudget: (budget: string | number | null | undefined, locale: string) => string;
      /** Edit mode flag for admin */
      editMode?: boolean;
      [key: string]: unknown;
    }
  }
}
