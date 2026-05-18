import { NextResponse } from "next/server";

import { fallbackCyber, fallbackCountries } from "@/lib/fallbackData";
import {
  normalizeCountries,
  normalizeCyberFeed,
  type RawCisaKevCatalog,
} from "@/lib/normalizers";
import { fetchJsonWithNodeHttps } from "@/lib/serverJson";
import type { RestCountryRecord } from "@/types/risk";

export const revalidate = 600;

const GDELT_URL =
  "https://api.gdeltproject.org/api/v2/doc/doc?query=(cyberattack%20OR%20ransomware%20OR%20ddos%20OR%20%22data%20breach%22)&mode=artlist&format=json&maxrecords=75&timespan=24h&sort=datedesc";
const CISA_KEV_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";
const COUNTRIES_URL =
  "https://restcountries.com/v3.1/all?fields=name,cca2,cca3,ccn3,population,area,borders,flags,latlng,region";
const UPSTREAM_TIMEOUT_MS = 7000;
const EMPTY_KEV_CATALOG: RawCisaKevCatalog = { vulnerabilities: [] };

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
    const [gdelt, kev, countries] = await Promise.all([
      fetchGdeltArticles(),
      fetchKevCatalog(),
      fetchCountries(),
    ]);

    if (gdelt.articles.length === 0 && kev.catalog.vulnerabilities?.length === 0) {
      throw new Error(gdelt.error ?? kev.error ?? "Cyber upstreams returned no usable records.");
    }

    const feed = normalizeCyberFeed(gdelt.articles, kev.catalog, countries);
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
      gdelt.error,
      kev.error,
      incidentFallback ? "GDELT returned no country-mapped cyber incidents; showing seeded incident fallback." : undefined,
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
