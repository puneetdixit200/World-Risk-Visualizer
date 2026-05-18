import { NextResponse } from "next/server";

import { fallbackCyber, fallbackCountries } from "@/lib/fallbackData";
import {
  normalizeCountries,
  normalizeCyberFeed,
  parseDshieldTopSourcesHtml,
  type RawCisaKevCatalog,
  type RawDshieldAttackSource,
  type RawIpCountryLookup,
} from "@/lib/normalizers";
import { fetchJsonWithNodeHttps } from "@/lib/serverJson";
import type { RestCountryRecord } from "@/types/risk";

export const revalidate = 120;

const DSHIELD_SOURCES_URL = "https://isc.sans.edu/api/sources/attacks/40?json";
const DSHIELD_PAGE_URL = "https://www.dshield.org/data/";
const COUNTRY_IS_URL = "https://api.country.is/?fields=asn";
const GDELT_URL =
  "https://api.gdeltproject.org/api/v2/doc/doc?query=(cyberattack%20OR%20ransomware%20OR%20ddos%20OR%20%22data%20breach%22)&mode=artlist&format=json&maxrecords=75&timespan=24h&sort=datedesc";
const CISA_KEV_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";
const COUNTRIES_URL =
  "https://restcountries.com/v3.1/all?fields=name,cca2,cca3,ccn3,population,area,borders,flags,latlng,region";
const UPSTREAM_TIMEOUT_MS = 7000;
const DSHIELD_TIMEOUT_MS = 12000;
const DSHIELD_DETAIL_LIMIT = 24;
const DSHIELD_HEADERS = {
  accept: "application/json",
  "user-agent": "world-risk-visualizer/1.0 (github.com/puneetdixit200)",
};
const EMPTY_KEV_CATALOG: RawCisaKevCatalog = { vulnerabilities: [] };

type DshieldResult = {
  sources: RawDshieldAttackSource[];
  lookups: RawIpCountryLookup[];
  error?: string;
};

type GdeltResult = {
  articles: Record<string, unknown>[];
  error?: string;
};

type KevResult = {
  catalog: RawCisaKevCatalog;
  error?: string;
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

async function fetchCountries() {
  try {
    const response = await fetch(COUNTRIES_URL, {
      next: { revalidate: 3600 },
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });

    if (!response.ok) {
      return fallbackCountries;
    }

    return normalizeCountries((await response.json()) as RestCountryRecord[]);
  } catch {
    return fallbackCountries;
  }
}

async function fetchDshieldJson<T>(url: string) {
  const response = await fetch(url, {
    next: { revalidate },
    headers: DSHIELD_HEADERS,
    signal: AbortSignal.timeout(DSHIELD_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`SANS ISC/DShield returned ${response.status}`);
  }

  return (await response.json()) as T;
}

async function fetchDshieldTopSourcesFromHtml(): Promise<DshieldResult> {
  const response = await fetch(DSHIELD_PAGE_URL, {
    next: { revalidate },
    headers: DSHIELD_HEADERS,
    signal: AbortSignal.timeout(DSHIELD_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`SANS ISC/DShield data page returned ${response.status}`);
  }

  const parsed = parseDshieldTopSourcesHtml(await response.text());

  if (parsed.sources.length === 0) {
    throw new Error("SANS ISC/DShield data page returned no parseable top source rows.");
  }

  return parsed;
}

async function fetchDshieldApiSources(): Promise<DshieldResult> {
  const payload = await fetchDshieldJson<{ value?: RawDshieldAttackSource[] }>(DSHIELD_SOURCES_URL);
  const sources = (payload.value ?? []).filter((source) => source.ip).slice(0, DSHIELD_DETAIL_LIMIT);
  const lookupPayload = await fetchJsonWithNodeHttps<{ value?: RawIpCountryLookup[] }>(
    COUNTRY_IS_URL,
    UPSTREAM_TIMEOUT_MS,
    {
      method: "POST",
      body: sources.map((source) => source.ip),
    },
  ).catch(() => ({ value: [] }));

  return { sources, lookups: lookupPayload.value ?? [] };
}

async function fetchDshieldAttacks(): Promise<DshieldResult> {
  try {
    return await fetchDshieldTopSourcesFromHtml();
  } catch (error) {
    const htmlError = getErrorMessage(error, "Unable to fetch SANS ISC/DShield attack sources.");

    try {
      const apiResult = await fetchDshieldApiSources();
      return {
        ...apiResult,
        error: apiResult.lookups.length === 0 ? htmlError : undefined,
      };
    } catch (apiError) {
      return {
        sources: [],
        lookups: [],
        error: `${htmlError}; ${getErrorMessage(apiError, "Unable to fetch SANS ISC/DShield API sources.")}`,
      };
    }
  }
}

async function fetchGdeltArticles(): Promise<GdeltResult> {
  try {
    const payload = await fetchJsonWithNodeHttps<{ articles?: Record<string, unknown>[] }>(
      GDELT_URL,
      UPSTREAM_TIMEOUT_MS,
    );

    return { articles: payload.articles ?? [] };
  } catch (error) {
    return { articles: [], error: getErrorMessage(error, "Unable to fetch GDELT cyber articles.") };
  }
}

async function fetchKevCatalog(): Promise<KevResult> {
  try {
    const response = await fetch(CISA_KEV_URL, {
      next: { revalidate },
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });

    if (!response.ok) {
      return {
        catalog: EMPTY_KEV_CATALOG,
        error: `CISA KEV feed returned ${response.status}`,
      };
    }

    return { catalog: (await response.json()) as RawCisaKevCatalog };
  } catch (error) {
    return {
      catalog: EMPTY_KEV_CATALOG,
      error: getErrorMessage(error, "Unable to fetch CISA KEV feed."),
    };
  }
}

export async function GET() {
  try {
    const [dshield, gdelt, kev, countries] = await Promise.all([
      fetchDshieldAttacks(),
      fetchGdeltArticles(),
      fetchKevCatalog(),
      fetchCountries(),
    ]);

    if (dshield.sources.length === 0 && gdelt.articles.length === 0 && kev.catalog.vulnerabilities?.length === 0) {
      throw new Error(dshield.error ?? gdelt.error ?? kev.error ?? "Cyber upstreams returned no usable records.");
    }

    const feed = normalizeCyberFeed(gdelt.articles, kev.catalog, countries, dshield.sources, dshield.lookups);
    const incidentFallback = feed.incidents.length === 0;
    const responseFeed = incidentFallback
      ? {
          ...feed,
          counts: fallbackCyber.counts,
          incidents: fallbackCyber.incidents,
          total: fallbackCyber.total,
          source: "fallback" as const,
        }
      : feed;
    const upstreamErrors = [
      dshield.error,
      gdelt.error,
      kev.error,
      incidentFallback ? "Cyber feeds returned no country-mapped incidents; showing seeded incident fallback." : undefined,
    ]
      .filter(Boolean)
      .join("; ");

    return NextResponse.json({
      ...responseFeed,
      error: upstreamErrors || undefined,
    });
  } catch (error) {
    return NextResponse.json({
      ...fallbackCyber,
      fetchedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unable to fetch cyber data.",
    });
  }
}
