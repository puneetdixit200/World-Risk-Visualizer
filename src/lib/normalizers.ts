import type {
  CountryIntel,
  CyberFeed,
  CyberIncident,
  CyberVulnerability,
  DiseaseRecord,
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
  updated?: number;
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

export type RawWhoOutbreak = {
  DonId?: string;
  Title?: string;
  PublicationDateAndTime?: string;
  PublicationDate?: string;
  LastModified?: string;
  UrlName?: string;
  ItemDefaultUrl?: string;
};

export type RawGdeltOutbreakArticle = {
  title?: string;
  sourcecountry?: string;
  sourceCountry?: string;
  seendate?: string;
  seenDate?: string;
  url?: string;
  domain?: string;
};

export type RawCisaKevCatalog = {
  catalogVersion?: string;
  dateReleased?: string;
  vulnerabilities?: JsonRecord[];
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
      updatedAt: raw.updated ? new Date(raw.updated).toISOString() : undefined,
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

function stripHtml(value: unknown) {
  return getString(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function createCountryNameLookup(countries: Record<string, CountryIntel>) {
  const entries = Object.values(countries).flatMap((country) => [
    [normalizeCountryName(country.name), country] as const,
    [normalizeCountryName(country.officialName), country] as const,
  ]);

  return new Map(entries);
}

function inferDiseaseName(title: string) {
  const knownDiseases = [
    "Ebola",
    "Hantavirus",
    "Measles",
    "Dengue",
    "Mpox",
    "Cholera",
    "Marburg",
    "Avian flu",
    "Yellow fever",
    "Polio",
    "Meningitis",
    "Lassa fever",
    "Rift Valley fever",
  ];
  const match = knownDiseases.find((diseaseName) => title.toLowerCase().includes(diseaseName.toLowerCase()));

  if (match) {
    return match;
  }

  return title.split(/[,|-]/)[0]?.trim() || "Disease outbreak";
}

function splitWhoTitle(title: string) {
  const [diseasePart, ...locationParts] = title.split(/,\s+|\s+-\s+/);
  const locationText = locationParts.join(", ");
  const countries = locationText
    .replace(/\b(the )?Democratic Republic of the Congo\b/gi, "Democratic Republic of the Congo")
    .split(/\s*&\s*|\s+and\s+|,\s*/)
    .map((value) => value.trim())
    .filter((value) => value && !/multi-country|global|regional/i.test(value));

  return {
    diseaseName: inferDiseaseName(diseasePart || title),
    countries,
  };
}

function parseReportDate(value: string | undefined) {
  if (!value) {
    return new Date().toISOString();
  }

  return parseGdeltSeenDate(value);
}

function addOutbreakRecord(
  records: Record<string, DiseaseRecord>,
  country: CountryIntel,
  diseaseName: string,
  title: string,
  source: string,
  publishedAt: string,
  url?: string,
) {
  const existing = records[country.cca3];
  const previousCount = existing?.reportCount ?? existing?.active ?? 0;
  const reportCount = previousCount + 1;
  const previousDiseases = existing?.diseaseName?.split(", ").filter(Boolean) ?? [];
  const diseaseNames = Array.from(new Set([...previousDiseases, diseaseName])).slice(0, 4);
  const sources = Array.from(new Set([...(existing?.sources ?? []), source]));
  const trend = existing?.trend?.length ? [...existing.trend] : Array.from({ length: 30 }, () => 0);
  const reportDate = new Date(publishedAt);

  if (!Number.isNaN(reportDate.getTime())) {
    const today = new Date();
    const ageDays = Math.floor((Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) - Date.UTC(reportDate.getUTCFullYear(), reportDate.getUTCMonth(), reportDate.getUTCDate())) / 86_400_000);
    const index = Math.min(29, Math.max(0, 29 - ageDays));
    trend[index] += 1;
  } else {
    trend[29] += 1;
  }

  records[country.cca3] = {
    country: country.name,
    iso2: country.cca2,
    iso3: country.cca3,
    active: reportCount,
    cases: reportCount,
    deaths: 0,
    recovered: 0,
    lat: country.latlng[0],
    lng: country.latlng[1],
    trend,
    updatedAt: publishedAt,
    diseaseName: diseaseNames.join(", "),
    reportCount,
    latestTitle: title,
    url,
    sources,
  };
}

export function normalizeOutbreakDisease(
  whoReports: RawWhoOutbreak[],
  gdeltArticles: RawGdeltOutbreakArticle[],
  countries: Record<string, CountryIntel>,
) {
  const lookup = createCountryNameLookup(countries);
  const records: Record<string, DiseaseRecord> = {};

  whoReports.forEach((report) => {
    const title = getString(report.Title);

    if (!title) {
      return;
    }

    const parsed = splitWhoTitle(title);
    const publishedAt = parseReportDate(report.PublicationDateAndTime ?? report.PublicationDate ?? report.LastModified);
    const url = report.UrlName
      ? `https://www.who.int/emergencies/disease-outbreak-news/item/${report.UrlName}`
      : report.ItemDefaultUrl
        ? `https://www.who.int/emergencies/disease-outbreak-news/item${report.ItemDefaultUrl}`
        : undefined;

    parsed.countries.forEach((countryName) => {
      const country = lookup.get(normalizeCountryName(countryName));

      if (country) {
        addOutbreakRecord(records, country, parsed.diseaseName, title, "WHO", publishedAt, url);
      }
    });
  });

  gdeltArticles.forEach((article) => {
    const sourceCountry = article.sourcecountry ?? article.sourceCountry;
    const country = sourceCountry ? lookup.get(normalizeCountryName(sourceCountry)) : undefined;
    const title = getString(article.title);

    if (!country || !title) {
      return;
    }

    addOutbreakRecord(
      records,
      country,
      inferDiseaseName(title),
      title,
      "GDELT",
      parseReportDate(article.seendate ?? article.seenDate),
      article.url,
    );
  });

  return records;
}

function parseGdeltSeenDate(value: string) {
  const compactMatch = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);

  if (compactMatch) {
    const [, year, month, day, hour, minute, second] = compactMatch;
    return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
  }

  return value;
}

function getCyberCountry(raw: JsonRecord, lookup: Map<string, CountryIntel>) {
  const sourceCountry = getString(raw.sourcecountry) || getString(raw.sourceCountry) || getString(raw.country);

  if (!sourceCountry) {
    return undefined;
  }

  return lookup.get(normalizeCountryName(sourceCountry));
}

function getCyberSource(raw: JsonRecord) {
  const domain = getString(raw.domain);
  const source = getString(raw.source);
  const url = getString(raw.url);

  if (domain) {
    return domain;
  }

  if (source) {
    return source;
  }

  try {
    return url ? new URL(url).hostname.replace(/^www\./, "") : "GDELT";
  } catch {
    return "GDELT";
  }
}

export function normalizeCyberFeed(
  rawArticles: JsonRecord[],
  rawKev: RawCisaKevCatalog,
  countries: Record<string, CountryIntel>,
): CyberFeed {
  const lookup = createCountryNameLookup(countries);
  const counts: Record<string, number> = {};
  const seenUrls = new Set<string>();
  const incidents: CyberIncident[] = [];

  rawArticles.forEach((raw, index) => {
    const country = getCyberCountry(raw, lookup);
    const title = getString(raw.title, "Reported cyber incident");
    const url = getOptionalString(raw.url);

    if (!country || !title || (url && seenUrls.has(url))) {
      return;
    }

    if (url) {
      seenUrls.add(url);
    }

    counts[country.cca3] = (counts[country.cca3] ?? 0) + 1;
    incidents.push({
      kind: "CYBER",
      id: getString(raw.url, `cyber-${index}`),
      title,
      country: country.name,
      countryCode: country.cca3,
      source: getCyberSource(raw),
      seenAt: parseGdeltSeenDate(getString(raw.seendate) || getString(raw.seenDate) || new Date().toISOString()),
      url,
    });
  });

  const vulnerabilities: CyberVulnerability[] = (rawKev.vulnerabilities ?? [])
    .slice()
    .sort((left, right) => getString(right.dateAdded).localeCompare(getString(left.dateAdded)))
    .slice(0, 24)
    .map((raw, index) => {
      const cve = getString(raw.cveID, `CVE-${index}`);

      return {
        kind: "CISA KEV",
        id: cve,
        cve,
        vendor: getString(raw.vendorProject, "Unknown vendor"),
        product: getString(raw.product, "Unknown product"),
        name: getString(raw.vulnerabilityName, "Known exploited vulnerability"),
        dateAdded: getString(raw.dateAdded, ""),
        ransomware: getString(raw.knownRansomwareCampaignUse, "Unknown"),
        action: stripHtml(raw.requiredAction) || "Apply mitigations per vendor instructions.",
        url: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
      };
    });

  return {
    counts,
    incidents: incidents.slice(0, 120),
    vulnerabilities,
    total: incidents.length,
    source: "live",
    fetchedAt: new Date().toISOString(),
    cisaCatalogVersion: rawKev.catalogVersion,
    cisaReleasedAt: rawKev.dateReleased,
  };
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
