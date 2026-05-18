import { NextResponse } from "next/server";

import { fallbackCountries } from "@/lib/fallbackData";
import { normalizeCountries } from "@/lib/normalizers";
import type { RestCountryRecord } from "@/types/risk";

export const revalidate = 3600;

const COUNTRIES_URL =
  "https://restcountries.com/v3.1/all?fields=name,cca2,cca3,ccn3,population,area,borders,flags,latlng,region";

export async function GET() {
  try {
    const response = await fetch(COUNTRIES_URL, {
      next: { revalidate },
      headers: { accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`REST Countries returned ${response.status}`);
    }

    const rawCountries = (await response.json()) as RestCountryRecord[];

    return NextResponse.json({
      countries: normalizeCountries(rawCountries),
      source: "live",
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({
      countries: fallbackCountries,
      source: "fallback",
      fetchedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unable to fetch REST Countries.",
    });
  }
}
