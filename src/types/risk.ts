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
  updatedAt?: string;
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

export type CyberIncident = {
  kind: "CYBER";
  id: string;
  title: string;
  country: string;
  countryCode: string;
  source: string;
  seenAt: string;
  url?: string;
};

export type CyberVulnerability = {
  kind: "CISA KEV";
  id: string;
  cve: string;
  vendor: string;
  product: string;
  name: string;
  dateAdded: string;
  ransomware: string;
  action: string;
  url: string;
};

export type CyberFeed = {
  counts: Record<string, number>;
  incidents: CyberIncident[];
  vulnerabilities: CyberVulnerability[];
  total: number;
  source: "live" | "fallback";
  fetchedAt: string;
  cisaCatalogVersion?: string;
  cisaReleasedAt?: string;
  error?: string;
};

export type GlobalStats = {
  interpolTotal: number;
  activeCases: number;
  cyberIncidents: number;
  highRiskCountries: number;
  defcon: number;
};

export type LayerKey = "threat" | "disease" | "interpol" | "cyber" | "density" | "corridors";

export type LayerState = Record<LayerKey, boolean>;
