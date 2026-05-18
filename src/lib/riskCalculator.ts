import type { RiskBand, RiskInputs } from "@/types/risk";

export const RISK_COLORS: Record<RiskBand, string> = {
  low: "#1a5276",
  guarded: "#f39c12",
  high: "#e74c3c",
  critical: "#ff0040",
};

export function clamp(value: number, min = 0, max = 100) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}

export function calculateRiskScore({
  activeCases,
  population,
  interpolNotices,
  borderCount,
}: RiskInputs) {
  const diseaseRate = population > 0 ? activeCases / population : 0;
  const diseaseBurden = Math.min(45, diseaseRate * 300);
  const interpolBurden = Math.min(54, interpolNotices * 3);
  const borderBurden = Math.min(14, borderCount * 1.2);
  const scaleBurden = population > 100_000_000 ? 5 : 0;

  return Math.round(clamp(diseaseBurden + interpolBurden + borderBurden + scaleBurden));
}

export function getRiskBand(score: number): RiskBand {
  if (score >= 75) {
    return "critical";
  }

  if (score >= 50) {
    return "high";
  }

  if (score >= 25) {
    return "guarded";
  }

  return "low";
}

export function getRiskColor(score: number) {
  return RISK_COLORS[getRiskBand(score)];
}

export function calculateDefcon(scores: number[], globalActiveCases: number, interpolTotal: number) {
  if (scores.length === 0) {
    return 5;
  }

  const averageRisk = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const criticalCount = scores.filter((score) => score >= 75).length;
  const diseasePressure = Math.log10(Math.max(globalActiveCases, 0) + 1) * 3;
  const interpolPressure = Math.min(20, interpolTotal / 30);
  const globalPressure = averageRisk + criticalCount * 5 + diseasePressure + interpolPressure;

  if (globalPressure >= 80) {
    return 1;
  }

  if (globalPressure >= 62) {
    return 2;
  }

  if (globalPressure >= 45) {
    return 3;
  }

  if (globalPressure >= 30) {
    return 4;
  }

  return 5;
}

export function calculateRiskByCountry(
  countries: Record<string, { population: number; borderCount: number }>,
  disease: Record<string, { active: number }>,
  interpolCounts: Record<string, number>,
) {
  return Object.fromEntries(
    Object.entries(countries).map(([cca3, country]) => [
      cca3,
      calculateRiskScore({
        activeCases: disease[cca3]?.active ?? 0,
        population: country.population,
        interpolNotices: interpolCounts[cca3] ?? 0,
        borderCount: country.borderCount,
      }),
    ]),
  );
}
