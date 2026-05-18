import type { CountryIntel, CyberFeed, CyberIncident, DiseaseRecord, InterpolAggregate, SourceHealth } from "@/types/risk";

export type SimulationState = {
  borderLockdown: boolean;
  cvePatch: boolean;
  outbreakResponse: boolean;
};

export function calculateSimulatedRisk(riskScore: number, simulation: SimulationState) {
  const reduction =
    (simulation.borderLockdown ? 9 : 0) +
    (simulation.cvePatch ? 12 : 0) +
    (simulation.outbreakResponse ? 10 : 0);

  return Math.max(0, Math.round(riskScore - reduction));
}

export function getReplayCyberCounts(incidents: CyberIncident[], fallbackCounts: Record<string, number>, replayActive: boolean, replayIndex: number) {
  if (!replayActive) {
    return fallbackCounts;
  }

  const sorted = incidents
    .filter((incident) => incident.countryCode)
    .slice()
    .sort((left, right) => new Date(left.seenAt).getTime() - new Date(right.seenAt).getTime());
  const visibleCount = Math.max(1, Math.ceil(sorted.length * ((replayIndex + 1) / 24)));

  return sorted.slice(0, visibleCount).reduce<Record<string, number>>((counts, incident) => {
    counts[incident.countryCode] = (counts[incident.countryCode] ?? 0) + 1;
    return counts;
  }, {});
}

export function getLikelyAttackTarget(incident: CyberIncident, countries: Record<string, CountryIntel>) {
  const preferredTargets = ["USA", "IND", "GBR", "DEU", "FRA", "JPN", "AUS", "SGP"].filter(
    (code) => countries[code] && code !== incident.countryCode,
  );

  if (preferredTargets.length === 0) {
    return undefined;
  }

  const seed = incident.id.split("").reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return countries[preferredTargets[seed % preferredTargets.length]];
}

export function buildSourceHealth(input: {
  countriesSource: "live" | "fallback";
  diseaseSource: "live" | "fallback";
  interpolSource: "live" | "fallback";
  cyberSource: "live" | "fallback";
  diseaseUpdatedAt?: string;
  cyberFetchedAt?: string;
  hasCyberError?: boolean;
}): SourceHealth[] {
  return [
    { label: "Countries", status: input.countriesSource === "live" ? "live" : "fallback" },
    {
      label: "Outbreaks",
      status: input.diseaseSource === "live" ? "live" : "fallback",
      age: formatFeedAge(input.diseaseUpdatedAt),
    },
    { label: "Interpol", status: input.interpolSource === "live" ? "live" : "fallback" },
    {
      label: "Cyber",
      status: input.cyberSource === "live" && !input.hasCyberError ? "live" : input.cyberSource === "live" ? "cache" : "fallback",
      age: formatFeedAge(input.cyberFetchedAt),
    },
  ];
}

function formatFeedAge(value?: string) {
  if (!value) {
    return undefined;
  }

  const timestamp = new Date(value).getTime();

  if (!Number.isFinite(timestamp)) {
    return undefined;
  }

  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000));

  if (minutes < 1) {
    return "<1m";
  }

  if (minutes < 60) {
    return `${minutes}m`;
  }

  return `${Math.round(minutes / 60)}h`;
}

export type CommandPaletteItem = {
  id: string;
  label: string;
  detail: string;
  countryCode?: string;
};

export function buildCommandPaletteItems(input: {
  countries: Record<string, CountryIntel>;
  disease: Record<string, DiseaseRecord>;
  cyber: CyberFeed;
  interpol: InterpolAggregate;
}) {
  const countryItems = Object.values(input.countries).map((country) => ({
    id: `country-${country.cca3}`,
    label: country.name,
    detail: `Country | ${country.region}`,
    countryCode: country.cca3,
  }));
  const outbreakItems = Object.values(input.disease).map((record) => ({
    id: `outbreak-${record.iso3}`,
    label: record.diseaseName ?? record.country,
    detail: `Outbreak | ${record.country}`,
    countryCode: record.iso3,
  }));
  const cyberItems = input.cyber.incidents.slice(0, 36).map((incident) => ({
    id: `cyber-${incident.id}`,
    label: incident.ip ?? incident.title,
    detail: `${incident.source} | ${incident.country}`,
    countryCode: incident.countryCode,
  }));
  const cveItems = input.cyber.vulnerabilities.slice(0, 18).map((vulnerability) => ({
    id: `cve-${vulnerability.cve}`,
    label: vulnerability.cve,
    detail: `${vulnerability.vendor} ${vulnerability.product}`,
  }));
  const interpolItems = input.interpol.notices.slice(0, 18).map((notice) => ({
    id: `interpol-${notice.id}`,
    label: notice.name,
    detail: `Interpol | ${notice.nationalities.join(", ") || "Unknown nationality"}`,
  }));

  return [...countryItems, ...outbreakItems, ...cyberItems, ...cveItems, ...interpolItems];
}

export function filterCommandPaletteItems(items: CommandPaletteItem[], query: string) {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return items.slice(0, 8);
  }

  return items
    .filter((item) => `${item.label} ${item.detail}`.toLowerCase().includes(normalized))
    .slice(0, 10);
}
