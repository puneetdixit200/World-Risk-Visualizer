import { NextResponse } from "next/server";

import { fallbackInterpol } from "@/lib/fallbackData";
import { aggregateInterpolNotices, createIso2ToIso3Map, normalizeCountries } from "@/lib/normalizers";
import type { RestCountryRecord } from "@/types/risk";

export const revalidate = 3600;

const COUNTRIES_URL = "https://restcountries.com/v3.1/all?fields=name,cca2,cca3,ccn3,population,area,borders,flags,latlng,region";
const INTERPOL_URL = "https://ws-public.interpol.int/notices/v1/red";
const RESULT_PER_PAGE = 20;
const MAX_PAGES = 18;

type InterpolPayload = {
  total?: number;
  _embedded?: {
    notices?: Record<string, unknown>[];
  };
};

async function getIso2Map() {
  const response = await fetch(COUNTRIES_URL, {
    next: { revalidate },
    headers: { accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`REST Countries returned ${response.status}`);
  }

  return createIso2ToIso3Map(normalizeCountries((await response.json()) as RestCountryRecord[]));
}

async function fetchInterpolPage(page: number) {
  const url = `${INTERPOL_URL}?resultPerPage=${RESULT_PER_PAGE}&page=${page}`;
  const response = await fetch(url, {
    next: { revalidate },
    headers: {
      accept: "application/json",
      "user-agent": "Mozilla/5.0 DangerMap/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Interpol returned ${response.status}`);
  }

  return (await response.json()) as InterpolPayload;
}

export async function GET() {
  try {
    const [iso2ToIso3, firstPage] = await Promise.all([getIso2Map(), fetchInterpolPage(1)]);
    const totalPages = Math.max(1, Math.ceil((firstPage.total ?? RESULT_PER_PAGE) / RESULT_PER_PAGE));
    const pageCount = Math.min(MAX_PAGES, totalPages);
    const remainingPages = Array.from({ length: pageCount - 1 }, (_, index) => index + 2);
    const remainingPayloads = await Promise.all(remainingPages.map((page) => fetchInterpolPage(page)));
    const notices = [firstPage, ...remainingPayloads].flatMap((payload) => payload._embedded?.notices ?? []);

    return NextResponse.json(aggregateInterpolNotices(notices, iso2ToIso3));
  } catch (error) {
    return NextResponse.json({
      ...fallbackInterpol,
      fetchedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unable to fetch Interpol data.",
    });
  }
}
