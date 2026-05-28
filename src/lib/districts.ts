import districtsData from '../data/districts.json';

interface DistrictEntry {
  name: string;
  name_id: string;
  province: string;
  province_id: string;
}

// Build lookup maps: English name -> entry
const byName = new Map<string, DistrictEntry>();
for (const k of districtsData as DistrictEntry[]) {
  byName.set(k.name, k);
}

/**
 * Get localized display name for a district/city.
 * DB stores English name (e.g. "Bandung Regency").
 * Returns localized name based on locale: "Kab. Bandung" (id) or "Bandung Regency" (en).
 */
export function getDistrictDisplay(englishName: string | null | undefined, locale: string): string {
  if (!englishName) return '';
  const entry = byName.get(englishName);
  if (!entry) return englishName; // fallback to stored name
  return locale === 'id' ? entry.name_id : entry.name;
}

/**
 * Get localized province name for a district/city.
 */
export function getProvinceDisplay(englishName: string | null | undefined, locale: string): string {
  if (!englishName) return '';
  const entry = byName.get(englishName);
  if (!entry) return '';
  return locale === 'id' ? entry.province_id : entry.province;
}
