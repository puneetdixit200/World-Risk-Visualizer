const NAME_ALIASES: Record<string, string> = {
  "united states of america": "united states",
  "russian federation": "russia",
  "viet nam": "vietnam",
  "korea republic of": "south korea",
  "iran islamic republic of": "iran",
  "syrian arab republic": "syria",
  "moldova republic of": "moldova",
  "bolivia plurinational state of": "bolivia",
  "venezuela bolivarian republic of": "venezuela",
  "tanzania united republic of": "tanzania",
};

export function normalizeCountryName(name: string) {
  const normalized = name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/&/g, "and")
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  return NAME_ALIASES[normalized] ?? normalized;
}

function hashString(seed: string) {
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function seededRandom(seed: string) {
  let value = hashString(seed);

  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

export function createDeterministicScatter(center: [number, number], seed: string, count: number) {
  const random = seededRandom(seed);
  const cappedCount = Math.min(Math.max(count, 0), 36);
  const points: [number, number][] = [];
  const [lng, lat] = center;

  for (let index = 0; index < cappedCount; index += 1) {
    const angle = random() * Math.PI * 2;
    const distance = 0.45 + random() * 2.75;
    const latitudeCompensation = Math.max(0.45, Math.cos((lat * Math.PI) / 180));
    const nextLng = lng + (Math.cos(angle) * distance) / latitudeCompensation;
    const nextLat = lat + Math.sin(angle) * distance;

    points.push([Number(nextLng.toFixed(4)), Number(nextLat.toFixed(4))]);
  }

  return points;
}

export function scaleCircleRadius(activeCases: number) {
  if (activeCases <= 0) {
    return 0;
  }

  return Math.min(34, Math.max(4, Math.sqrt(activeCases) * 0.028 + 3));
}

export function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en").format(Math.round(value));
}

export function getDiseaseValueAtIndex(record: { active: number; trend: number[] }, index: number) {
  if (record.trend.length < 2) {
    return record.active;
  }

  const lastValue = record.trend.at(-1) ?? 1;
  const selectedValue = record.trend[Math.min(Math.max(index, 0), record.trend.length - 1)] ?? lastValue;
  const ratio = lastValue > 0 ? selectedValue / lastValue : 1;

  return Math.max(0, Math.round(record.active * ratio));
}
