import type { FeatureCollection, Geometry, Position } from "geojson";

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

const DROPPED_ATLAS_FEATURE_IDS = new Set(["010", "242"]);
const ANTIMERIDIAN_SPAN_DEGREES = 300;
const SLIVER_LATITUDE_SPAN_DEGREES = 8;

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

function normalizedAtlasId(countryFeature: { id?: string | number }) {
  if (countryFeature.id === undefined || countryFeature.id === null) {
    return undefined;
  }

  return String(countryFeature.id).padStart(3, "0");
}

function getRingBounds(ring: Position[]) {
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  for (const position of ring) {
    const [lng, lat] = position;

    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      continue;
    }

    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }

  if (!Number.isFinite(minLng) || !Number.isFinite(minLat)) {
    return { spanLng: 0, spanLat: 0 };
  }

  return {
    spanLng: maxLng - minLng,
    spanLat: maxLat - minLat,
  };
}

function unwrapAntimeridianRing(ring: Position[]) {
  if (ring.length === 0) {
    return ring;
  }

  let previousLng = ring[0][0];
  let offset = 0;

  return ring.map((position, index) => {
    if (index === 0) {
      return position;
    }

    let lng = position[0] + offset;

    while (lng - previousLng > 180) {
      offset -= 360;
      lng -= 360;
    }

    while (previousLng - lng > 180) {
      offset += 360;
      lng += 360;
    }

    previousLng = lng;
    return [lng, ...position.slice(1)];
  });
}

function sanitizePolygonRings(rings: Position[][]) {
  const sanitizedRings: Position[][] = [];

  for (let index = 0; index < rings.length; index += 1) {
    const ring = rings[index];
    const bounds = getRingBounds(ring);
    const crossesAntimeridian = bounds.spanLng > ANTIMERIDIAN_SPAN_DEGREES;
    const isThinSliver = crossesAntimeridian && bounds.spanLat < SLIVER_LATITUDE_SPAN_DEGREES;

    if (isThinSliver) {
      if (index === 0) {
        return [];
      }

      continue;
    }

    sanitizedRings.push(crossesAntimeridian ? unwrapAntimeridianRing(ring) : ring);
  }

  return sanitizedRings;
}

function sanitizeGeometry(geometry: Geometry): Geometry | null {
  if (geometry.type === "Polygon") {
    const coordinates = sanitizePolygonRings(geometry.coordinates);
    return coordinates.length > 0 ? { ...geometry, coordinates } : null;
  }

  if (geometry.type === "MultiPolygon") {
    const coordinates = geometry.coordinates
      .map((polygon) => sanitizePolygonRings(polygon))
      .filter((polygon) => polygon.length > 0);

    return coordinates.length > 0 ? { ...geometry, coordinates } : null;
  }

  return geometry;
}

export function sanitizeWorldFeatureCollection<TProperties>(
  collection: FeatureCollection<Geometry, TProperties>,
): FeatureCollection<Geometry, TProperties> {
  const features = collection.features.flatMap((countryFeature) => {
    const id = normalizedAtlasId(countryFeature);

    if (id && DROPPED_ATLAS_FEATURE_IDS.has(id)) {
      return [];
    }

    if (!countryFeature.geometry) {
      return [countryFeature];
    }

    const geometry = sanitizeGeometry(countryFeature.geometry);
    return geometry ? [{ ...countryFeature, geometry }] : [];
  });

  return { ...collection, features };
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

export function scaleOutbreakRadius(reportCount: number) {
  if (reportCount <= 0) {
    return 0;
  }

  return Math.min(32, Math.max(5, Math.sqrt(reportCount) * 5 + 4));
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
