import db from '../db';
import districtsData from '../data/districts.json';
import provinceCentroids from '../data/province-centroids.json';
import coordinatesData from '../data/coordinates.json';

const coordsMap: Record<string, number[]> = coordinatesData as any;
const centroidsMap: Record<string, number[]> = provinceCentroids as any;

export interface ProjectLocation {
  province: string;
  lat: number;
  lng: number;
  matchedBy: 'district' | 'address' | 'province' | 'area' | 'coordinates';
}

export interface MapProjectItem {
  id: number;
  title: string;
  status: string;
  client: string;
  district?: string | null;
  address?: string | null;
}

export interface ProvinceMarker {
  province: string;
  lat: number;
  lng: number;
  total: number;
  pending: number;
  accepted: number;
  projects: MapProjectItem[];
}

export interface ProjectGeoPoint extends MapProjectItem {
  province: string;
  lat: number;
  lng: number;
}

export interface ProjectsMapResult {
  markers: ProvinceMarker[];
  points: ProjectGeoPoint[];
  totalProjects: number;
}

// ── Province alias map ──
// Maps lowercased Indonesian and English province names/aliases to canonical provinceCentroids key
const PROVINCE_ALIASES: Record<string, string> = {
  'bali': 'Bali',
  'jakarta': 'Jakarta',
  'dki jakarta': 'Jakarta',
  'dki': 'Jakarta',
  'jawa barat': 'West Java',
  'west java': 'West Java',
  'jabar': 'West Java',
  'jawa tengah': 'Central Java',
  'central java': 'Central Java',
  'jateng': 'Central Java',
  'jawa timur': 'East Java',
  'east java': 'East Java',
  'jatim': 'East Java',
  'banten': 'Banten',
  'yogyakarta': 'Special Region of Yogyakarta',
  'jogja': 'Special Region of Yogyakarta',
  'jogjakarta': 'Special Region of Yogyakarta',
  'di yogyakarta': 'Special Region of Yogyakarta',
  'd.i. yogyakarta': 'Special Region of Yogyakarta',
  'daerah istimewa yogyakarta': 'Special Region of Yogyakarta',
  'special region of yogyakarta': 'Special Region of Yogyakarta',
  'sumatera utara': 'North Sumatra',
  'sumatra utara': 'North Sumatra',
  'north sumatra': 'North Sumatra',
  'sumut': 'North Sumatra',
  'sumatera barat': 'West Sumatra',
  'sumatra barat': 'West Sumatra',
  'west sumatra': 'West Sumatra',
  'sumbar': 'West Sumatra',
  'sumatera selatan': 'South Sumatra',
  'sumatra selatan': 'South Sumatra',
  'south sumatra': 'South Sumatra',
  'sumsel': 'South Sumatra',
  'riau': 'Riau',
  'kepulauan riau': 'Riau Islands',
  'kep riau': 'Riau Islands',
  'riau islands': 'Riau Islands',
  'kepri': 'Riau Islands',
  'aceh': 'Aceh',
  'nanggroe aceh darussalam': 'Aceh',
  'lampung': 'Lampung',
  'jambi': 'Jambi',
  'bengkulu': 'Bengkulu',
  'bangka belitung': 'Bangka Belitung Islands',
  'bangka belitung islands': 'Bangka Belitung Islands',
  'kepulauan bangka belitung': 'Bangka Belitung Islands',
  'babel': 'Bangka Belitung Islands',
  'kalimantan barat': 'West Kalimantan',
  'west kalimantan': 'West Kalimantan',
  'kalbar': 'West Kalimantan',
  'kalimantan tengah': 'Central Kalimantan',
  'central kalimantan': 'Central Kalimantan',
  'kalteng': 'Central Kalimantan',
  'kalimantan selatan': 'South Kalimantan',
  'south kalimantan': 'South Kalimantan',
  'kalsel': 'South Kalimantan',
  'kalimantan timur': 'East Kalimantan',
  'east kalimantan': 'East Kalimantan',
  'kaltim': 'East Kalimantan',
  'kalimantan utara': 'North Kalimantan',
  'north kalimantan': 'North Kalimantan',
  'kaltara': 'North Kalimantan',
  'sulawesi selatan': 'South Sulawesi',
  'south sulawesi': 'South Sulawesi',
  'sulsel': 'South Sulawesi',
  'sulawesi utara': 'North Sulawesi',
  'north sulawesi': 'North Sulawesi',
  'sulut': 'North Sulawesi',
  'sulawesi tengah': 'Central Sulawesi',
  'central sulawesi': 'Central Sulawesi',
  'sulteng': 'Central Sulawesi',
  'sulawesi tenggara': 'Southeast Sulawesi',
  'southeast sulawesi': 'Southeast Sulawesi',
  'sultra': 'Southeast Sulawesi',
  'sulawesi barat': 'West Sulawesi',
  'west sulawesi': 'West Sulawesi',
  'sulbar': 'West Sulawesi',
  'gorontalo': 'Gorontalo',
  'nusa tenggara barat': 'West Nusa Tenggara',
  'west nusa tenggara': 'West Nusa Tenggara',
  'ntb': 'West Nusa Tenggara',
  'lombok': 'West Nusa Tenggara',
  'nusa tenggara timur': 'East Nusa Tenggara',
  'east nusa tenggara': 'East Nusa Tenggara',
  'ntt': 'East Nusa Tenggara',
  'maluku': 'Maluku',
  'maluku utara': 'North Maluku',
  'north maluku': 'North Maluku',
  'papua': 'Papua',
  'papua barat': 'West Papua',
  'west papua': 'West Papua',
  'papua selatan': 'South Papua',
  'south papua': 'South Papua',
  'papua tengah': 'Central Papua',
  'central papua': 'Central Papua',
  'papua pegunungan': 'Highland Papua',
  'highland papua': 'Highland Papua',
  'papua barat daya': 'Southwest Papua',
  'southwest papua': 'Southwest Papua',
};

// ── Well-known tourist and commercial areas mapping directly to province & coordinates ──
const POPULAR_AREAS: Record<string, { province: string; lat: number; lng: number }> = {
  // Bali areas
  'canggu': { province: 'Bali', lat: -8.6481, lng: 115.1384 },
  'seminyak': { province: 'Bali', lat: -8.6913, lng: 115.1682 },
  'kuta': { province: 'Bali', lat: -8.7233, lng: 115.1723 },
  'kerobokan': { province: 'Bali', lat: -8.6738, lng: 115.1585 },
  'pererenan': { province: 'Bali', lat: -8.6420, lng: 115.1230 },
  'uluwatu': { province: 'Bali', lat: -8.8149, lng: 115.0884 },
  'jimbaran': { province: 'Bali', lat: -8.7900, lng: 115.1600 },
  'nusa dua': { province: 'Bali', lat: -8.7950, lng: 115.2300 },
  'ubud': { province: 'Bali', lat: -8.5069, lng: 115.2625 },
  'sanur': { province: 'Bali', lat: -8.6750, lng: 115.2625 },
  'denpasar': { province: 'Bali', lat: -8.6500, lng: 115.2167 },
  'badung': { province: 'Bali', lat: -8.5833, lng: 115.1833 },
  'gianyar': { province: 'Bali', lat: -8.5417, lng: 115.3250 },
  'tabanan': { province: 'Bali', lat: -8.5411, lng: 115.1250 },
  'berawa': { province: 'Bali', lat: -8.6606, lng: 115.1437 },
  'bukit': { province: 'Bali', lat: -8.8200, lng: 115.1200 },
  'nusa penida': { province: 'Bali', lat: -8.7278, lng: 115.5444 },
  'nusa lembongan': { province: 'Bali', lat: -8.6800, lng: 115.4500 },
  'candidasa': { province: 'Bali', lat: -8.5000, lng: 115.5667 },
  'amed': { province: 'Bali', lat: -8.3500, lng: 115.6500 },
  'lovina': { province: 'Bali', lat: -8.1500, lng: 115.0333 },

  // Greater Jakarta / Jabodetabek
  'kemang': { province: 'Jakarta', lat: -6.2730, lng: 106.8160 },
  'senopati': { province: 'Jakarta', lat: -6.2330, lng: 106.8080 },
  'menteng': { province: 'Jakarta', lat: -6.1960, lng: 106.8320 },
  'kelapa gading': { province: 'Jakarta', lat: -6.1580, lng: 106.9080 },
  'tebet': { province: 'Jakarta', lat: -6.2360, lng: 106.8530 },
  'kuningan': { province: 'Jakarta', lat: -6.2290, lng: 106.8300 },
  'scbd': { province: 'Jakarta', lat: -6.2260, lng: 106.8080 },
  'pondok indah': { province: 'Jakarta', lat: -6.2780, lng: 106.7820 },
  'pluit': { province: 'Jakarta', lat: -6.1180, lng: 106.7900 },
  'pantai indah kapuk': { province: 'Jakarta', lat: -6.1110, lng: 106.7450 },
  'pik': { province: 'Jakarta', lat: -6.1110, lng: 106.7450 },
  'sudirman': { province: 'Jakarta', lat: -6.2150, lng: 106.8200 },
  'senayan': { province: 'Jakarta', lat: -6.2230, lng: 106.8000 },
  'bsd': { province: 'Banten', lat: -6.3000, lng: 106.6667 },
  'bsd city': { province: 'Banten', lat: -6.3000, lng: 106.6667 },
  'bintaro': { province: 'Banten', lat: -6.2800, lng: 106.7200 },
  'gading serpong': { province: 'Banten', lat: -6.2400, lng: 106.6300 },
  'alam sutera': { province: 'Banten', lat: -6.2200, lng: 106.6600 },
};

// ── Build District Lookup Maps ──
interface DistrictEntry {
  name: string;
  name_id: string;
  province: string;
  province_id: string;
}

const districtToProvince = new Map<string, string>();
const districtSearchList: Array<{ key: string; province: string }> = [];

(districtsData as DistrictEntry[]).forEach((d) => {
  const normProvince = PROVINCE_ALIASES[d.province.toLowerCase()] || d.province;

  const addMapping = (val: string) => {
    if (!val) return;
    const lower = val.toLowerCase().trim();
    if (!districtToProvince.has(lower)) {
      districtToProvince.set(lower, normProvince);
      if (lower.length >= 4) {
        districtSearchList.push({ key: lower, province: normProvince });
      }
    }
  };

  addMapping(d.name);
  addMapping(d.name_id);

  // Stripped versions: remove 'Regency', 'City', 'Kab.', 'Kota', etc.
  const shortEn = d.name.replace(/ (City|Regency|Administrative City|Municipality)$/i, '').trim();
  addMapping(shortEn);

  const shortId = d.name_id.replace(/^(Kab\.|Kota Adm\.|Kota|Kabupaten) /i, '').trim();
  addMapping(shortId);
});

// Sort search list by key length descending so longer matches take precedence
districtSearchList.sort((a, b) => b.key.length - a.key.length);

/**
 * Resolve project location (province, latitude, longitude) based on district and/or address.
 */
export function resolveProjectLocation(project: {
  district?: string | null;
  address?: string | null;
}): ProjectLocation | null {
  const districtRaw = (project.district || '').trim();
  const addressRaw = (project.address || '').trim();

  const districtLower = districtRaw.toLowerCase();
  const addressLower = addressRaw.toLowerCase();

  let foundProvince: string | null = null;
  let matchedBy: ProjectLocation['matchedBy'] = 'district';
  let specificCoords: [number, number] | null = null;

  // 1. Check if district directly matches a province name or alias
  if (districtLower && PROVINCE_ALIASES[districtLower]) {
    foundProvince = PROVINCE_ALIASES[districtLower];
    matchedBy = 'province';
  }

  // 2. Check if district matches known district dictionary
  if (!foundProvince && districtLower) {
    if (districtToProvince.has(districtLower)) {
      foundProvince = districtToProvince.get(districtLower)!;
      matchedBy = 'district';
    } else {
      const stripped = districtLower.replace(/ (city|regency|municipality)$/i, '')
        .replace(/^(kab\.|kota adm\.|kota|kabupaten) /i, '').trim();
      if (districtToProvince.has(stripped)) {
        foundProvince = districtToProvince.get(stripped)!;
        matchedBy = 'district';
      }
    }
  }

  // 3. Check popular areas in district or address
  if (!foundProvince) {
    const combinedText = `${districtLower} ${addressLower}`.trim();
    for (const [area, info] of Object.entries(POPULAR_AREAS)) {
      const regex = new RegExp(`\\b${area}\\b`, 'i');
      if (regex.test(combinedText)) {
        foundProvince = info.province;
        specificCoords = [info.lat, info.lng];
        matchedBy = 'area';
        break;
      }
    }
  }

  // 4. Check address for province name or alias
  if (!foundProvince && addressLower) {
    for (const [alias, prov] of Object.entries(PROVINCE_ALIASES)) {
      // Use word boundary to avoid partial substring false matches
      const regex = new RegExp(`\\b${alias.replace(/\./g, '\\.')}\\b`, 'i');
      if (regex.test(addressLower)) {
        foundProvince = prov;
        matchedBy = 'address';
        break;
      }
    }
  }

  // 5. Check address for district names
  if (!foundProvince && addressLower) {
    for (const item of districtSearchList) {
      const regex = new RegExp(`\\b${item.key.replace(/\./g, '\\.')}\\b`, 'i');
      if (regex.test(addressLower)) {
        foundProvince = item.province;
        matchedBy = 'address';
        break;
      }
    }
  }

  // 6. Check coordinatesData keys in district or address
  if (!foundProvince) {
    const combined = `${districtLower} ${addressLower}`;
    for (const [placeName, coords] of Object.entries(coordsMap)) {
      const regex = new RegExp(`\\b${placeName.toLowerCase()}\\b`, 'i');
      if (regex.test(combined)) {
        // Find which province this place belongs to
        if (PROVINCE_ALIASES[placeName.toLowerCase()]) {
          foundProvince = PROVINCE_ALIASES[placeName.toLowerCase()];
        } else if (districtToProvince.has(placeName.toLowerCase())) {
          foundProvince = districtToProvince.get(placeName.toLowerCase())!;
        } else {
          // If place is in coordinates.json, determine province from centroids or default
          foundProvince = placeName;
        }
        if (coords && coords.length >= 2) {
          specificCoords = [coords[0], coords[1]];
        }
        matchedBy = 'coordinates';
        break;
      }
    }
  }

  if (!foundProvince) return null;

  // Resolve coordinates
  let lat = 0;
  let lng = 0;

  if (specificCoords) {
    [lat, lng] = specificCoords;
  } else {
    // Check if coordinates.json has a direct match for the district or city
    const coordLookup = coordsMap[districtRaw] || coordsMap[foundProvince];

    if (coordLookup && coordLookup.length >= 2) {
      lat = coordLookup[0];
      lng = coordLookup[1];
    } else {
      const centroid = centroidsMap[foundProvince];
      if (centroid && centroid.length >= 2) {
        lat = centroid[0];
        lng = centroid[1];
      } else {
        // Fallback: search in PROVINCE_ALIASES
        const canonical = PROVINCE_ALIASES[foundProvince.toLowerCase()];
        const c2 = canonical ? centroidsMap[canonical] : null;
        if (c2 && c2.length >= 2) {
          lat = c2[0];
          lng = c2[1];
          foundProvince = canonical;
        } else {
          return null;
        }
      }
    }
  }

  return {
    province: foundProvince,
    lat,
    lng,
    matchedBy,
  };
}

/**
 * Fetch and construct map data (grouped province markers + individual project points).
 */
export function getProjectsMapData(options?: {
  status?: string;
  category?: string;
}): ProjectsMapResult {
  const conditions: string[] = [];
  const params: any[] = [];

  if (options?.status) {
    conditions.push('p.status = ?');
    params.push(options.status);
  }
  if (options?.category) {
    conditions.push('p.category = ?');
    params.push(options.category);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const projects = db.prepare(`
    SELECT p.id, p.title, p.status, p.district, p.address,
           COALESCE(p.contact_name, p.client_email, 'Unknown') as client_name
    FROM projects p
    ${whereClause}
    ORDER BY p.created_at DESC
  `).all(...params) as Array<{
    id: number;
    title: string;
    status: string;
    district: string | null;
    address: string | null;
    client_name: string;
  }>;

  const provinceMap = new Map<string, {
    lat: number;
    lng: number;
    projects: MapProjectItem[];
  }>();

  const points: ProjectGeoPoint[] = [];

  for (const p of projects) {
    const loc = resolveProjectLocation(p);
    if (!loc) continue;

    if (!provinceMap.has(loc.province)) {
      // Use canonical province centroid coordinates for marker center
      const centroid = centroidsMap[loc.province];
      const centerLat = centroid && centroid.length >= 2 ? centroid[0] : loc.lat;
      const centerLng = centroid && centroid.length >= 2 ? centroid[1] : loc.lng;
      provinceMap.set(loc.province, {
        lat: centerLat,
        lng: centerLng,
        projects: [],
      });
    }

    const item: MapProjectItem = {
      id: p.id,
      title: p.title,
      status: p.status,
      client: p.client_name,
      district: p.district,
      address: p.address,
    };

    provinceMap.get(loc.province)!.projects.push(item);

    points.push({
      ...item,
      province: loc.province,
      lat: loc.lat,
      lng: loc.lng,
    });
  }

  const markers: ProvinceMarker[] = Array.from(provinceMap.entries()).map(([province, data]) => ({
    province,
    lat: data.lat,
    lng: data.lng,
    total: data.projects.length,
    pending: data.projects.filter(p => p.status === 'pending').length,
    accepted: data.projects.filter(p => ['in_progress', 'completed', 'active'].includes(p.status)).length,
    projects: data.projects,
  }));

  return {
    markers,
    points,
    totalProjects: points.length,
  };
}
