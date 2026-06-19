import { Request, Response, NextFunction } from 'express';
import * as fs from 'fs';
import * as path from 'path';

type Locale = 'en' | 'id';
type TranslationDict = Record<string, any>;

const translations: Record<Locale, TranslationDict> = {
  en: JSON.parse(fs.readFileSync(path.join(__dirname, '../locales/en.json'), 'utf-8')),
  id: JSON.parse(fs.readFileSync(path.join(__dirname, '../locales/id.json'), 'utf-8')),
};

const defaultLocale: Locale = 'id';
const supportedLocales: Locale[] = ['id', 'en'];

// Deep get helper: t('hero.steps.0.title')
function deepGet(obj: TranslationDict, keyPath: string): unknown {
  const keys = keyPath.split('.');
  let current: any = obj;
  for (const k of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return keyPath; // fallback
    }
    current = current[k];
  }
  if (typeof current === 'string' || Array.isArray(current)) {
    return current;
  }
  if (typeof current === 'object' && current !== null) {
    return current;
  }
  return keyPath;
}

export function i18nMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Determine locale from query > cookie > accept-language > default
  let locale: Locale = defaultLocale;

  const queryLang = req.query.lang as string;
  if (queryLang && supportedLocales.includes(queryLang as Locale)) {
    locale = queryLang as Locale;
  } else if (req.cookies?.locale && supportedLocales.includes(req.cookies.locale as Locale)) {
    locale = req.cookies.locale as Locale;
  } else {
    const acceptLang = req.headers['accept-language'] || '';
    if (acceptLang.includes('id') || acceptLang.includes('in')) {
      locale = 'id';
    }
  }

  // Set cookie for next request
  res.cookie('locale', locale, { maxAge: 365 * 24 * 60 * 60 * 1000, httpOnly: false, path: '/' });

  // Serve content directly without redirect.
  // Previously we redirected all GET requests to add ?lang=xx (302), but that
  // prevented Google from crawling/indexing any page — every sitemap URL
  // returned 302 and Google never fetched the content.
  // Now we detect locale from query/cookie/accept-language, set the cookie,
  // and serve the page immediately. Language toggle in the UI uses ?lang=xx.

  // Build canonical URL (without ?lang=xx) and hreflang alternates for SEO
  const canonicalPath = req.path;
  const baseUrl = process.env.BASE_URL || `https://${req.headers.host || 'kontraktor.app'}`;
  const canonicalUrl = `${baseUrl}${canonicalPath}`;

  res.locals.canonicalUrl = canonicalUrl;
  res.locals.alternateLocales = supportedLocales.filter((l: Locale) => l !== locale).map((l: Locale) => ({
    lang: l,
    href: `${canonicalUrl}?lang=${l}`,
  }));

  // Create t() function
  const t = (key: string, params?: Record<string, string | number>): string | any[] => {
    const result = deepGet(translations[locale], key);
    if (typeof result === 'string') return params ? interpolate(result, params) : result;
    if (Array.isArray(result)) return result;
    return String(result);
  };

  function interpolate(str: string, params: Record<string, string | number>): string {
    return str.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`));
  }

  res.locals.t = t;
  res.locals.locale = locale;
  res.locals.locales = supportedLocales;

  next();
}
