import { describe, expect, it } from "vitest";

import {
  aggregateInterpolNotices,
  normalizeCountries,
  normalizeCyberFeed,
  normalizeDisease,
} from "./normalizers";

describe("normalizers", () => {
  it("normalizes REST Countries into keyed country intelligence records", () => {
    const countries = normalizeCountries([
      {
        name: { common: "India", official: "Republic of India" },
        cca2: "IN",
        cca3: "IND",
        ccn3: "356",
        population: 1_400_000_000,
        area: 3_287_263,
        borders: ["PAK", "CHN", "NPL"],
        flags: { svg: "https://flagcdn.com/in.svg", png: "https://flagcdn.com/w320/in.png" },
        latlng: [20, 77],
        region: "Asia",
      },
    ]);

    expect(countries.IND.name).toBe("India");
    expect(countries.IND.density).toBeCloseTo(425.89, 1);
    expect(countries.IND.borderCount).toBe(3);
  });

  it("normalizes disease data and joins historical trends by country name", () => {
    const disease = normalizeDisease(
      [
        {
          country: "India",
          active: 1000,
          cases: 5000,
          deaths: 50,
          recovered: 3950,
          countryInfo: { iso2: "IN", iso3: "IND", lat: 20, long: 77, flag: "flag" },
        },
      ],
      [
        {
          country: "India",
          timeline: { cases: { "1/1/23": 10, "1/2/23": 20, "1/3/23": 35 } },
        },
      ],
    );

    expect(disease.IND.active).toBe(1000);
    expect(disease.IND.trend).toEqual([10, 20, 35]);
  });

  it("aggregates Interpol notices by ISO3 country code", () => {
    const aggregate = aggregateInterpolNotices(
      [
        { name: "A Person", nationalities: ["IN"], charges: "Fraud" },
        { name: "B Person", nationalities: ["US", "IN"], charges: "Theft" },
      ],
      { IN: "IND", US: "USA" },
    );

    expect(aggregate.counts.IND).toBe(2);
    expect(aggregate.counts.USA).toBe(1);
    expect(aggregate.total).toBe(2);
  });

  it("normalizes cyber articles and exploited vulnerabilities for map and ticker use", () => {
    const countries = normalizeCountries([
      {
        name: { common: "United States", official: "United States of America" },
        cca2: "US",
        cca3: "USA",
        ccn3: "840",
        population: 334_805_269,
        area: 9_833_517,
        borders: ["CAN", "MEX"],
        flags: { svg: "https://flagcdn.com/us.svg" },
        latlng: [38, -97],
        region: "Americas",
      },
      {
        name: { common: "Switzerland", official: "Swiss Confederation" },
        cca2: "CH",
        cca3: "CHE",
        ccn3: "756",
        population: 8_900_000,
        area: 41_285,
        borders: ["AUT", "FRA", "ITA", "LIE", "DEU"],
        flags: { svg: "https://flagcdn.com/ch.svg" },
        latlng: [47, 8],
        region: "Europe",
      },
    ]);

    const feed = normalizeCyberFeed(
      [
        {
          title: "DDoS attack disrupts telecom services",
          sourcecountry: "Switzerland",
          seendate: "20260518T090000Z",
          url: "https://example.com/ddos",
          domain: "example.com",
        },
        {
          title: "Ransomware group hits hospital network",
          sourceCountry: "United States",
          seendate: "20260518T080000Z",
          url: "https://example.com/ransomware",
        },
      ],
      {
        catalogVersion: "2026.05.15",
        dateReleased: "2026-05-15T16:55:06.6086Z",
        vulnerabilities: [
          {
            cveID: "CVE-2026-42897",
            vendorProject: "Microsoft",
            product: "Windows",
            vulnerabilityName: "Microsoft Windows Exploited Vulnerability",
            dateAdded: "2026-05-15",
            knownRansomwareCampaignUse: "Unknown",
            requiredAction: "Apply mitigations per vendor instructions.",
          },
        ],
      },
      countries,
    );

    expect(feed.counts.CHE).toBe(1);
    expect(feed.counts.USA).toBe(1);
    expect(feed.incidents[0]).toMatchObject({
      kind: "CYBER",
      countryCode: "CHE",
      country: "Switzerland",
      title: "DDoS attack disrupts telecom services",
      source: "example.com",
    });
    expect(feed.vulnerabilities[0]).toMatchObject({
      kind: "CISA KEV",
      cve: "CVE-2026-42897",
      vendor: "Microsoft",
      product: "Windows",
    });
  });
});
