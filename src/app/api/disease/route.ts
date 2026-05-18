import { NextResponse } from "next/server";

import { fallbackCountries, fallbackDisease } from "@/lib/fallbackData";
import {
  normalizeCountries,
  normalizeOutbreakDisease,
  type RawGdeltOutbreakArticle,
  type RawWhoOutbreak,
} from "@/lib/normalizers";
import { fetchJsonWithNodeHttps } from "@/lib/serverJson";
import type { RestCountryRecord } from "@/types/risk";

export const revalidate = 300;

const WHO_URL =
  "https://www.who.int/api/hubs/diseaseoutbreaknews?$top=30&$orderby=PublicationDateAndTime%20desc&$select=Title,DonId,PublicationDate,PublicationDateAndTime,FormattedDate,UrlName,ItemDefaultUrl,LastModified";
const GDELT_URL =
  "https://api.gdeltproject.org/api/v2/doc/doc?query=(%22cholera%20outbreak%22%20OR%20%22dengue%20outbreak%22%20OR%20%22mpox%20outbreak%22%20OR%20%22measles%20outbreak%22%20OR%20%22Ebola%20outbreak%22%20OR%20%22avian%20flu%20outbreak%22%20OR%20%22disease%20outbreak%22)&mode=artlist&format=json&maxrecords=50&timespan=7d&sort=datedesc";
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

async function fetchGdeltArticles() {
  try {
    const payload = await fetchJsonWithNodeHttps<{ articles?: RawGdeltOutbreakArticle[] }>(
      GDELT_URL,
      UPSTREAM_TIMEOUT_MS,
    );

    return payload.articles ?? [];
  } catch {
    return [];
  }
}

export async function GET() {
  try {
    const [whoResponse, gdeltArticles, countries] = await Promise.all([
      fetch(WHO_URL, {
        next: { revalidate },
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      }),
      fetchGdeltArticles(),
      fetchCountries(),
    ]);

    if (!whoResponse.ok) {
      throw new Error(`WHO Disease Outbreak News returned ${whoResponse.status}`);
    }

    const whoPayload = (await whoResponse.json()) as { value?: RawWhoOutbreak[] };
    const disease = normalizeOutbreakDisease(whoPayload.value ?? [], gdeltArticles, countries);
    const latestUpdate = Object.values(disease)
      .map((record) => (record.updatedAt ? new Date(record.updatedAt).getTime() : 0))
      .filter((value) => Number.isFinite(value))
      .reduce((latest, value) => Math.max(latest, value), 0);

    if (Object.keys(disease).length === 0) {
      throw new Error("No country-mapped outbreak reports returned.");
    }

    return NextResponse.json({
      disease,
      source: "live",
      fetchedAt: new Date().toISOString(),
      updatedAt: latestUpdate ? new Date(latestUpdate).toISOString() : undefined,
    });
  } catch (error) {
    return NextResponse.json({
      disease: fallbackDisease,
      source: "fallback",
      fetchedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unable to fetch disease data.",
    });
  }
}
