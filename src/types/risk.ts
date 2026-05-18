export type RiskBand = "low" | "guarded" | "high" | "critical";

export type RiskInputs = {
  activeCases: number;
  population: number;
  interpolNotices: number;
  borderCount: number;
};

export type RestCountryRecord = {
  name: {
    common?: string;
    official?: string;
  };
  cca2?: string;
  cca3?: string;
  ccn3?: string;
  population?: number;
  area?: number;
  borders?: string[];
  flags?: {
    svg?: string;
    png?: string;
    alt?: string;
  };
  latlng?: number[];
  region?: string;
};

export type CountryIntel = {
  name: string;
  officialName: string;
  cca2: string;
  cca3: string;
  ccn3: string;
  population: number;
  area: number;
  density: number;
  borders: string[];
  borderCount: number;
  flag: string;
  flagAlt: string;
  region: string;
  latlng: [number, number];
  center: [number, number];
};

export type DiseaseRecord = {
  country: string;
  iso2: string;
  iso3: string;
  active: number;
  cases: number;
  deaths: number;
  recovered: number;
  lat: number;
  lng: number;
  trend: number[];
};

export type InterpolNotice = {
  id: string;
  name: string;
  nationalities: string[];
  charges: string;
  url?: string;
};

export type InterpolAggregate = {
  counts: Record<string, number>;
  notices: InterpolNotice[];
  total: number;
  source: "live" | "fallback";
  fetchedAt: string;
  error?: string;
};

export type FbiEntry = {
  id: string;
  name: string;
  description: string;
  reward: string;
  url: string;
  image?: string;
  subjects: string[];
};

export type GlobalStats = {
  interpolTotal: number;
  activeCases: number;
  highRiskCountries: number;
  defcon: number;
};

export type LayerKey = "threat" | "disease" | "interpol" | "fbi" | "density" | "corridors";

export type LayerState = Record<LayerKey, boolean>;
