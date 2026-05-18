import { describe, expect, it } from "vitest";

import {
  buildCommandPaletteItems,
  buildSourceHealth,
  calculateSimulatedRisk,
  filterCommandPaletteItems,
  getLikelyAttackTarget,
  getReplayCyberCounts,
} from "./commandCenter";
import type { CountryIntel, CyberFeed, InterpolAggregate } from "@/types/risk";

const countries: Record<string, CountryIntel> = {
  USA: {
    name: "United States",
    officialName: "United States of America",
    cca2: "US",
    cca3: "USA",
    ccn3: "840",
    population: 1,
    area: 1,
    density: 1,
    borders: [],
    borderCount: 0,
    flag: "",
    flagAlt: "",
    region: "Americas",
    latlng: [38, -97],
    center: [-97, 38],
  },
  NLD: {
    name: "Netherlands",
    officialName: "Kingdom of the Netherlands",
    cca2: "NL",
    cca3: "NLD",
    ccn3: "528",
    population: 1,
    area: 1,
    density: 1,
    borders: [],
    borderCount: 0,
    flag: "",
    flagAlt: "",
    region: "Europe",
    latlng: [52.5, 5.7],
    center: [5.7, 52.5],
  },
};

const cyber: CyberFeed = {
  counts: { NLD: 2, USA: 1 },
  incidents: [
    {
      kind: "CYBER",
      id: "attack-1",
      title: "89.248.163.200 active attack source",
      country: "Netherlands",
      countryCode: "NLD",
      source: "SANS ISC/DShield",
      seenAt: "2026-05-18T01:00:00Z",
      ip: "89.248.163.200",
      attacks: 9396,
    },
    {
      kind: "CYBER",
      id: "attack-2",
      title: "66.240.205.34 active attack source",
      country: "United States",
      countryCode: "USA",
      source: "SANS ISC/DShield",
      seenAt: "2026-05-18T02:00:00Z",
      ip: "66.240.205.34",
      attacks: 4671,
    },
  ],
  vulnerabilities: [
    {
      kind: "CISA KEV",
      id: "CVE-2026-42897",
      cve: "CVE-2026-42897",
      vendor: "Microsoft",
      product: "Exchange",
      name: "Cross-site scripting vulnerability",
      dateAdded: "2026-05-15",
      ransomware: "Unknown",
      action: "Patch",
      url: "https://example.com",
    },
  ],
  total: 3,
  source: "live",
  fetchedAt: "2026-05-18T02:00:00Z",
};

const interpol: InterpolAggregate = {
  counts: {},
  notices: [{ id: "red-1", name: "TEST SUBJECT", charges: "Fraud", nationalities: ["NL"] }],
  total: 1,
  source: "live",
  fetchedAt: "2026-05-18T02:00:00Z",
};

describe("command center helpers", () => {
  it("calculates simulated risk reductions", () => {
    expect(calculateSimulatedRisk(71, { borderLockdown: true, cvePatch: true, outbreakResponse: true })).toBe(40);
    expect(calculateSimulatedRisk(12, { borderLockdown: true, cvePatch: true, outbreakResponse: true })).toBe(0);
  });

  it("replays cyber incidents into progressive country counts", () => {
    expect(getReplayCyberCounts(cyber.incidents, cyber.counts, false, 0)).toEqual(cyber.counts);
    expect(getReplayCyberCounts(cyber.incidents, cyber.counts, true, 0)).toEqual({ NLD: 1 });
    expect(getReplayCyberCounts(cyber.incidents, cyber.counts, true, 23)).toEqual({ NLD: 1, USA: 1 });
  });

  it("selects a likely attack target that is not the source country", () => {
    expect(getLikelyAttackTarget(cyber.incidents[0], countries)?.cca3).toBe("USA");
  });

  it("builds source confidence badges", () => {
    expect(
      buildSourceHealth({
        countriesSource: "live",
        diseaseSource: "fallback",
        interpolSource: "live",
        cyberSource: "live",
        hasCyberError: true,
      }),
    ).toMatchObject([
      { label: "Countries", status: "live" },
      { label: "Outbreaks", status: "fallback" },
      { label: "Interpol", status: "live" },
      { label: "Cyber", status: "cache" },
    ]);
  });

  it("builds and filters command palette results", () => {
    const items = buildCommandPaletteItems({
      countries,
      disease: {
        NLD: {
          country: "Netherlands",
          iso2: "NL",
          iso3: "NLD",
          active: 1,
          cases: 1,
          deaths: 0,
          recovered: 0,
          lat: 52,
          lng: 5,
          trend: [],
          diseaseName: "Measles",
        },
      },
      cyber,
      interpol,
    });

    expect(filterCommandPaletteItems(items, "CVE-2026")[0]).toMatchObject({ label: "CVE-2026-42897" });
    expect(filterCommandPaletteItems(items, "89.248")[0]).toMatchObject({ countryCode: "NLD" });
  });
});
