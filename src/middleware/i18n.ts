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

  // Redirect to add ?lang= if not present in query (skip for static assets, HTMX partials, API, non-GET)
  if (!queryLang && req.method === 'GET' && !req.path.match(/\.(css|js|svg|png|jpg|ico|woff|json)$/) && !req.headers['hx-request']) {
    const separator = req.url.includes('?') ? '&' : '?';
    res.redirect(302, req.url + separator + 'lang=' + locale);
    return;
  }

  // Create t() function
  const t = (key: string): string | any[] => {
    const result = deepGet(translations[locale], key);
    if (typeof result === 'string' || Array.isArray(result)) return result;
    return String(result);
  };

  res.locals.t = t;
  res.locals.locale = locale;
  res.locals.locales = supportedLocales;

  next();
}
