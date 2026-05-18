import { describe, expect, it } from "vitest";

import {
  aggregateInterpolNotices,
  normalizeCountries,
  normalizeDisease,
  normalizeFbi,
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

  it("normalizes FBI wanted entries for ticker and popup use", () => {
    const entries = normalizeFbi([
      {
        uid: "abc",
        title: "JANE DOE",
        description: "Wire Fraud",
        reward_text: "Reward up to $10,000",
        url: "https://fbi.gov/jane",
        images: [{ thumb: "thumb.jpg", large: "large.jpg" }],
        subjects: ["White-Collar Crime"],
      },
    ]);

    expect(entries[0]).toMatchObject({
      id: "abc",
      name: "JANE DOE",
      reward: "Reward up to $10,000",
      image: "large.jpg",
    });
  });
});
