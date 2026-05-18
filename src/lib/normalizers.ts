import type {
  CountryIntel,
  DiseaseRecord,
  FbiEntry,
  InterpolAggregate,
  InterpolNotice,
  RestCountryRecord,
} from "@/types/risk";

import { normalizeCountryName } from "./geoUtils";

type JsonRecord = Record<string, unknown>;

export type RawDiseaseCountry = {
  country?: string;
  active?: number;
  cases?: number;
  deaths?: number;
  recovered?: number;
  countryInfo?: {
    iso2?: string;
    iso3?: string;
    lat?: number;
    long?: number;
    flag?: string;
  };
};

export type RawDiseaseHistory = {
  country?: string;
  timeline?: {
    cases?: Record<string, number>;
  };
};

export function normalizeCountries(rawCountries: RestCountryRecord[]) {
  return rawCountries.reduce<Record<string, CountryIntel>>((countries, raw) => {
    if (!raw.cca3 || !raw.name?.common) {
      return countries;
    }

    const lat = raw.latlng?.[0] ?? 0;
    const lng = raw.latlng?.[1] ?? 0;
    const population = raw.population ?? 0;
    const area = raw.area ?? 0;

    countries[raw.cca3] = {
      name: raw.name.common,
      officialName: raw.name.official ?? raw.name.common,
      cca2: raw.cca2 ?? "",
      cca3: raw.cca3,
      ccn3: raw.ccn3 ?? "",
      population,
      area,
      density: area > 0 ? population / area : 0,
      borders: raw.borders ?? [],
      borderCount: raw.borders?.length ?? 0,
      flag: raw.flags?.svg ?? raw.flags?.png ?? "",
      flagAlt: raw.flags?.alt ?? `${raw.name.common} flag`,
      region: raw.region ?? "Unassigned",
      latlng: [lat, lng],
      center: [lng, lat],
    };

    return countries;
  }, {});
}

export function createIso2ToIso3Map(countries: Record<string, CountryIntel>) {
  return Object.fromEntries(
    Object.values(countries)
      .filter((country) => country.cca2 && country.cca3)
      .map((country) => [country.cca2, country.cca3]),
  );
}

export function normalizeDisease(current: RawDiseaseCountry[], historical: RawDiseaseHistory[] = []) {
  const trendsByName = new Map(
    historical
      .filter((entry) => entry.country && entry.timeline?.cases)
      .map((entry) => [
        normalizeCountryName(entry.country as string),
        Object.values(entry.timeline?.cases ?? {}).filter((value) => Number.isFinite(value)),
      ]),
  );

  return current.reduce<Record<string, DiseaseRecord>>((records, raw) => {
    const iso3 = raw.countryInfo?.iso3;

    if (!raw.country || !iso3) {
      return records;
    }

    records[iso3] = {
      country: raw.country,
      iso2: raw.countryInfo?.iso2 ?? "",
      iso3,
      active: raw.active ?? 0,
      cases: raw.cases ?? 0,
      deaths: raw.deaths ?? 0,
      recovered: raw.recovered ?? 0,
      lat: raw.countryInfo?.lat ?? 0,
      lng: raw.countryInfo?.long ?? 0,
      trend: trendsByName.get(normalizeCountryName(raw.country)) ?? [],
    };

    return records;
  }, {});
}

function getString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function getOptionalString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function getStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function getInterpolName(raw: JsonRecord) {
  const forename = getString(raw.forename);
  const name = getString(raw.name);
  const fullName = [forename, name].filter(Boolean).join(" ").trim();

  return fullName || getString(raw.title, "UNKNOWN SUBJECT");
}

function getInterpolCharges(raw: JsonRecord) {
  const warrants = Array.isArray(raw.arrestWarrants) ? raw.arrestWarrants : [];
  const charges = warrants
    .map((warrant) => (typeof warrant === "object" && warrant ? getString((warrant as JsonRecord).charge) : ""))
    .filter(Boolean);

  return charges[0] ?? getString(raw.charge, "Red notice");
}

function getInterpolUrl(raw: JsonRecord) {
  const links = raw._links;
  const self =
    typeof links === "object" && links && "_self" in links
      ? (links as JsonRecord)._self
      : typeof links === "object" && links && "self" in links
        ? (links as JsonRecord).self
        : undefined;

  return typeof self === "object" && self ? getOptionalString((self as JsonRecord).href) : undefined;
}

export function aggregateInterpolNotices(rawNotices: JsonRecord[], iso2ToIso3: Record<string, string>): InterpolAggregate {
  const counts: Record<string, number> = {};
  const notices: InterpolNotice[] = rawNotices.map((raw, index) => {
    const nationalities = getStringArray(raw.nationalities)
      .map((nationality) => nationality.toUpperCase())
      .filter(Boolean);

    nationalities.forEach((nationality) => {
      const iso3 = iso2ToIso3[nationality] ?? nationality;
      counts[iso3] = (counts[iso3] ?? 0) + 1;
    });

    return {
      id: getString(raw.entity_id, `interpol-${index}`),
      name: getInterpolName(raw),
      nationalities,
      charges: getInterpolCharges(raw),
      url: getInterpolUrl(raw),
    };
  });

  return {
    counts,
    notices,
    total: notices.length,
    source: "live",
    fetchedAt: new Date().toISOString(),
  };
}

function stripHtml(value: unknown) {
  return getString(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getFbiImage(images: unknown) {
  if (!Array.isArray(images)) {
    return undefined;
  }

  const first = images.find((image) => typeof image === "object" && image) as JsonRecord | undefined;

  return first ? getString(first.large) || getString(first.original) || getString(first.thumb) || undefined : undefined;
}

export function normalizeFbi(rawItems: JsonRecord[]): FbiEntry[] {
  return rawItems.map((raw, index) => ({
    id: getString(raw.uid, `fbi-${index}`),
    name: getString(raw.title, "UNKNOWN SUBJECT"),
    description: stripHtml(raw.description) || stripHtml(raw.caution) || "Federal wanted listing",
    reward: getString(raw.reward_text, "Reward undisclosed"),
    url: getString(raw.url, "https://www.fbi.gov/wanted"),
    image: getFbiImage(raw.images),
    subjects: getStringArray(raw.subjects),
  }));
}
