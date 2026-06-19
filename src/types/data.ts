// ── Data types for static JSON datasets ──

export interface District {
  name: string;
  name_id: string;
  province: string;
  province_id: number;
}

export interface ProvinceCentroid {
  province_id: number;
  province: string;
  lat: number;
  lng: number;
}

export interface Province {
  id: number;
  name: string;
  name_id: string;
}
