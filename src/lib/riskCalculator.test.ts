import { describe, expect, it } from "vitest";

import {
  calculateDefcon,
  calculateRiskScore,
  getRiskBand,
  getRiskColor,
} from "./riskCalculator";

describe("riskCalculator", () => {
  it("combines disease burden, notices, borders, and scale into a clamped score", () => {
    const score = calculateRiskScore({
      activeCases: 1_500_000,
      population: 10_000_000,
      interpolNotices: 18,
      borderCount: 5,
    });

    expect(score).toBe(100);
  });

  it("handles sparse or missing inputs without producing NaN", () => {
    const score = calculateRiskScore({
      activeCases: 0,
      population: 0,
      interpolNotices: 0,
      borderCount: 0,
    });

    expect(score).toBe(0);
  });

  it("maps score thresholds to threat bands and colors", () => {
    expect(getRiskBand(12)).toBe("low");
    expect(getRiskBand(35)).toBe("guarded");
    expect(getRiskBand(62)).toBe("high");
    expect(getRiskBand(88)).toBe("critical");
    expect(getRiskColor(88)).toBe("#ff0040");
  });

  it("calculates a lower DEFCON number as global risk rises", () => {
    expect(calculateDefcon([10, 18, 20], 1_000, 10)).toBe(5);
    expect(calculateDefcon([92, 80, 76, 55], 800_000, 600)).toBe(1);
  });
});
