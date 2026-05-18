import { NextResponse } from "next/server";

import { fallbackDisease } from "@/lib/fallbackData";
import { normalizeDisease, type RawDiseaseCountry, type RawDiseaseHistory } from "@/lib/normalizers";

export const revalidate = 3600;

const CURRENT_URL = "https://disease.sh/v3/covid-19/countries?allowNull=false";
const HISTORICAL_URL = "https://disease.sh/v3/covid-19/historical?lastdays=30";

async function safeFetchHistory() {
  try {
    const response = await fetch(HISTORICAL_URL, {
      next: { revalidate },
      headers: { accept: "application/json" },
    });

    if (!response.ok) {
      return [];
    }

    return (await response.json()) as RawDiseaseHistory[];
  } catch {
    return [];
  }
}

export async function GET() {
  try {
    const [currentResponse, historical] = await Promise.all([
      fetch(CURRENT_URL, {
        next: { revalidate },
        headers: { accept: "application/json" },
      }),
      safeFetchHistory(),
    ]);

    if (!currentResponse.ok) {
      throw new Error(`disease.sh returned ${currentResponse.status}`);
    }

    const current = (await currentResponse.json()) as RawDiseaseCountry[];

    return NextResponse.json({
      disease: normalizeDisease(current, historical),
      source: "live",
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({
      disease: fallbackDisease,
      source: "fallback",
      fetchedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unable to fetch disease data.",
    });
  }
}
