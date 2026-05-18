import { NextResponse } from "next/server";

import { fallbackFbi } from "@/lib/fallbackData";
import { normalizeFbi } from "@/lib/normalizers";

export const revalidate = 3600;

const FBI_URL = "https://api.fbi.gov/wanted/v1/list?pageSize=25";

export async function GET() {
  try {
    const response = await fetch(FBI_URL, {
      next: { revalidate },
      headers: { accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`FBI Wanted API returned ${response.status}`);
    }

    const payload = (await response.json()) as { items?: Record<string, unknown>[] };

    return NextResponse.json({
      fbi: normalizeFbi(payload.items ?? []),
      source: "live",
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({
      fbi: fallbackFbi,
      source: "fallback",
      fetchedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unable to fetch FBI data.",
    });
  }
}
