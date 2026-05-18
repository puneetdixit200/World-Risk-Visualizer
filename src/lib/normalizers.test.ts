import { describe, expect, it } from "vitest";

import {
  aggregateInterpolNotices,
  normalizeCountries,
  normalizeCyberFeed,
  normalizeDisease,
  normalizeOutbreakDisease,
  parseDshieldTopSourcesHtml,
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

  it("normalizes WHO and GDELT outbreak reports beyond COVID", () => {
    const countries = normalizeCountries([
      {
        name: { common: "DR Congo", official: "Democratic Republic of the Congo" },
        cca2: "CD",
        cca3: "COD",
        ccn3: "180",
        population: 108_000_000,
        area: 2_344_858,
        borders: ["UGA"],
        flags: { svg: "https://flagcdn.com/cd.svg" },
        latlng: [0, 25],
        region: "Africa",
      },
      {
        name: { common: "Uganda", official: "Republic of Uganda" },
        cca2: "UG",
        cca3: "UGA",
        ccn3: "800",
        population: 48_000_000,
        area: 241_550,
        borders: ["COD"],
        flags: { svg: "https://flagcdn.com/ug.svg" },
        latlng: [1, 32],
        region: "Africa",
      },
      {
        name: { common: "Bangladesh", official: "People's Republic of Bangladesh" },
        cca2: "BD",
        cca3: "BGD",
        ccn3: "050",
        population: 169_000_000,
        area: 147_570,
        borders: ["IND", "MMR"],
        flags: { svg: "https://flagcdn.com/bd.svg" },
        latlng: [24, 90],
        region: "Asia",
      },
    ]);

    const disease = normalizeOutbreakDisease(
      [
        {
          DonId: "2026-DON602",
          Title: "Ebola disease caused by Bundibugyo virus, Democratic Republic of the Congo & Uganda",
          PublicationDateAndTime: "2026-05-16T22:00:00Z",
          UrlName: "2026-DON602",
        },
      ],
      [
        {
          title: "Dengue outbreak pressure rises after monsoon rains",
          sourcecountry: "Bangladesh",
          seendate: "20260518T090000Z",
          url: "https://example.com/dengue",
          domain: "example.com",
        },
      ],
      countries,
    );

    expect(disease.COD.active).toBe(1);
    expect(disease.COD.diseaseName).toContain("Ebola");
    expect(disease.UGA.latestTitle).toContain("Bundibugyo");
    expect(disease.BGD.diseaseName).toBe("Dengue");
    expect(disease.BGD.reportCount).toBe(1);
    expect(disease.BGD.sources).toContain("GDELT");
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
      {
        name: { common: "Netherlands", official: "Kingdom of the Netherlands" },
        cca2: "NL",
        cca3: "NLD",
        ccn3: "528",
        population: 17_800_000,
        area: 41_850,
        borders: [],
        flags: { svg: "https://flagcdn.com/nl.svg" },
        latlng: [52.5, 5.75],
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
      [
        {
          ip: "89.248.163.200",
          attacks: 9396,
          count: 364709,
          firstseen: "2022-09-21",
          lastseen: "2026-05-18",
        },
      ],
      [
        {
          ip: "89.248.163.200",
          country: "NL",
          asn: {
            number: 202425,
            organization: "IP Volume inc",
          },
        },
      ],
    );

    expect(feed.counts.NLD).toBe(1);
    expect(feed.incidents[0]).toMatchObject({
      kind: "CYBER",
      countryCode: "NLD",
      country: "Netherlands",
      source: "SANS ISC/DShield",
      ip: "89.248.163.200",
      attacks: 9396,
      reports: 364709,
    });
    expect(feed.counts.CHE).toBe(1);
    expect(feed.counts.USA).toBe(1);
    expect(feed.incidents[1]).toMatchObject({
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

  it("parses SANS DShield top source rows into attack sources and country lookups", () => {
    const parsed = parseDshieldTopSourcesHtml(`
      <tr>
        <td><a href="/ipdetails.html?ip=89.248.163.200">89.248.163.200</a><br/> (NL)</td><td>recyber.net</td><td>364,709</td>
        <td>9,396</td><td><a href="date.html?date=2022-09-21">2022-09-21</a></td>
        <td><a href="date.html?date=2026-05-18">2026-05-18</a></td></tr>
    `);

    expect(parsed.sources[0]).toMatchObject({
      ip: "89.248.163.200",
      attacks: "9,396",
      count: "364,709",
      firstseen: "2022-09-21",
      lastseen: "2026-05-18",
    });
    expect(parsed.lookups[0]).toEqual({ ip: "89.248.163.200", country: "NL" });
  });
});
