import { describe, expect, it } from "vitest";

import { createDeterministicScatter, normalizeCountryName, scaleCircleRadius } from "./geoUtils";

describe("geoUtils", () => {
  it("normalizes country names for cross-API joins", () => {
    expect(normalizeCountryName("United States of America")).toBe("united states");
    expect(normalizeCountryName("Côte d'Ivoire")).toBe("cote divoire");
  });

  it("creates stable scatter points around a centroid", () => {
    const first = createDeterministicScatter([77, 20], "IND", 3);
    const second = createDeterministicScatter([77, 20], "IND", 3);

    expect(first).toEqual(second);
    expect(first).toHaveLength(3);
    expect(first[0][0]).toBeGreaterThan(75);
    expect(first[0][1]).toBeGreaterThan(18);
  });

  it("scales disease circles using a square-root transform", () => {
    expect(scaleCircleRadius(0)).toBe(0);
    expect(scaleCircleRadius(1_000_000)).toBeLessThanOrEqual(34);
    expect(scaleCircleRadius(1_000_000)).toBeGreaterThan(8);
  });
});
