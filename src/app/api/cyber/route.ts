import { NextResponse } from "next/server";

import { fallbackCyber, fallbackCountries } from "@/lib/fallbackData";
import {
  normalizeCountries,
  normalizeCyberFeed,
  type RawCisaKevCatalog,
} from "@/lib/normalizers";
import type { RestCountryRecord } from "@/types/risk";

export const revalidate = 600;

const GDELT_URL =
  "https://api.gdeltproject.org/api/v2/doc/doc?query=(cyberattack%20OR%20ransomware%20OR%20ddos%20OR%20%22data%20breach%22)&mode=artlist&format=json&maxrecords=75&timespan=24h&sort=datedesc";
const CISA_KEV_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";
const COUNTRIES_URL =
  "https://restcountries.com/v3.1/all?fields=name,cca2,cca3,ccn3,population,area,borders,flags,latlng,region";
const UPSTREAM_TIMEOUT_MS = 7000;

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

export async function GET() {
  try {
    const [gdeltResponse, kevResponse, countries] = await Promise.all([
      fetch(GDELT_URL, {
        next: { revalidate },
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      }),
      fetch(CISA_KEV_URL, {
        next: { revalidate },
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      }),
      fetchCountries(),
    ]);

    if (!gdeltResponse.ok) {
      throw new Error(`GDELT DOC API returned ${gdeltResponse.status}`);
    }

    if (!kevResponse.ok) {
      throw new Error(`CISA KEV feed returned ${kevResponse.status}`);
    }

    const gdeltPayload = (await gdeltResponse.json()) as { articles?: Record<string, unknown>[] };
    const kevPayload = (await kevResponse.json()) as RawCisaKevCatalog;
    const feed = normalizeCyberFeed(gdeltPayload.articles ?? [], kevPayload, countries);

    if (feed.incidents.length === 0) {
      throw new Error("GDELT returned no country-mapped cyber incidents.");
    }

    return NextResponse.json(feed);
  } catch (error) {
    return NextResponse.json({
      ...fallbackCyber,
      fetchedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unable to fetch cyber data.",
    });
  }
}
