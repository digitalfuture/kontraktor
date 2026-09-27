import type { Request } from 'express';
import { TOP_SEO_LOCATIONS } from './seo/types';
import type { SeoLocation } from './seo/types';

export interface DetectedLocation {
  city?: string;
  country?: string;
  location?: SeoLocation;
}

/**
 * Detect location from incoming request headers (Cloudflare, Fly.io, standard proxies)
 * or fallback to best match from TOP_SEO_LOCATIONS.
 */
export function detectLocationFromRequest(req: Request): DetectedLocation {
  const headers = req.headers;

  // Cloudflare headers
  const cfCity = headers['cf-ipcity'] as string | undefined;
  const cfCountry = (headers['cf-ipcountry'] as string | undefined) ?? 'ID';

  // Standard proxy / nginx geoip headers
  const xCity = headers['x-real-city'] ?? headers['x-geoip-city'];
  const headerCity = Array.isArray(cfCity) ? cfCity[0] : (cfCity ?? (Array.isArray(xCity) ? xCity[0] : xCity) ?? '');

  const rawCity = String(headerCity).trim();

  if (rawCity) {
    const rawLower = rawCity.toLowerCase();
    const matched = TOP_SEO_LOCATIONS.find((loc) =>
      loc.slug === rawLower ||
      loc.name.toLowerCase() === rawLower ||
      loc.nameId.toLowerCase() === rawLower ||
      rawLower.includes(loc.slug)
    );

    return {
      city: rawCity,
      country: cfCountry,
      location: matched,
    };
  }

  return {
    country: cfCountry,
  };
}
