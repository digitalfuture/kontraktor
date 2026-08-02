import { Response } from 'express';

/**
 * Get localized name from a DB record.
 * Returns `record['name_' + locale]` if available, otherwise falls back to `record[field]`.
 */
export function localizedName(
  record: Record<string, unknown>,
  locale: string,
  field = 'name'
): string {
  const localized = record[`name_${locale}`] as string | undefined;
  if (localized) return localized;
  return (record[field] as string) || '';
}

/** Locale from res.locals (set by i18nMiddleware), 'en' fallback */
export function getLocale(res: Response): string {
  return (res.locals.locale as string) || 'en';
}

/** t() translation function from res.locals, identity fallback */
export function getT(res: Response): (key: string) => string {
  return (res.locals.t as (key: string) => string) || ((key: string) => key);
}
