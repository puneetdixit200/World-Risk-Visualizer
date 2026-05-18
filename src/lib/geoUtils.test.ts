import type { FeatureCollection, Geometry, Position } from "geojson";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import countries110m from "world-atlas/countries-110m.json";
import { describe, expect, it } from "vitest";

import {
  createDeterministicScatter,
  normalizeCountryName,
  sanitizeWorldFeatureCollection,
  scaleCircleRadius,
} from "./geoUtils";

type WorldTopology = Topology<{
  countries: GeometryCollection<{ name?: string }>;
  land: GeometryCollection;
}>;

function ringLongitudeSpan(ring: Position[]) {
  const longitudes = ring.map(([lng]) => lng);
  return Math.max(...longitudes) - Math.min(...longitudes);
}

function collectLongitudeSpans(geometry: Geometry) {
  if (geometry.type === "Polygon") {
    return geometry.coordinates.map(ringLongitudeSpan);
  }

  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.flatMap((polygon) => polygon.map(ringLongitudeSpan));
  }

  return [];
}

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

  it("drops atlas features that create full-width antimeridian bands", () => {
    const collection = sanitizeWorldFeatureCollection({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          id: "010",
          properties: { name: "Antarctica" },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [-180, -82],
                [180, -82],
                [180, -80],
                [-180, -80],
                [-180, -82],
              ],
            ],
          },
        },
        {
          type: "Feature",
          id: "840",
          properties: { name: "United States of America" },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [-125, 25],
                [-65, 25],
                [-65, 49],
                [-125, 49],
                [-125, 25],
              ],
            ],
          },
        },
      ],
    });

    expect(collection.features).toHaveLength(1);
    expect(collection.features[0].id).toBe("840");
  });

  it("preserves Russia while removing only thin antimeridian sliver rings", () => {
    const collection = sanitizeWorldFeatureCollection({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          id: "643",
          properties: { name: "Russia" },
          geometry: {
            type: "MultiPolygon",
            coordinates: [
              [
                [
                  [130, 52],
                  [179, 54],
                  [-170, 56],
                  [-165, 70],
                  [130, 72],
                  [130, 52],
                ],
              ],
              [
                [
                  [-180, 65],
                  [180, 65],
                  [180, 67],
                  [-180, 67],
                  [-180, 65],
                ],
              ],
            ],
          },
        },
      ],
    });

    expect(collection.features).toHaveLength(1);
    expect(collection.features[0].id).toBe("643");
    expect(collection.features[0].geometry?.type).toBe("MultiPolygon");

    const geometry = collection.features[0].geometry;
    if (geometry?.type !== "MultiPolygon") {
      throw new Error("Expected Russia geometry to stay as a MultiPolygon");
    }

    expect(geometry.coordinates).toHaveLength(1);
    expect(Math.max(...geometry.coordinates[0][0].map(([lng]) => lng))).toBeGreaterThan(180);
    expect(Math.max(...geometry.coordinates[0][0].map(([lng]) => lng))).toBeLessThan(210);
  });

  it("sanitizes the bundled Russia atlas geometry so it no longer spans the map seam", () => {
    const topology = countries110m as WorldTopology;
    const collection = feature(topology, topology.objects.countries) as FeatureCollection<Geometry, { name?: string }>;
    const sanitized = sanitizeWorldFeatureCollection(collection);
    const russia = sanitized.features.find((countryFeature) => String(countryFeature.id).padStart(3, "0") === "643");

    expect(russia).toBeDefined();
    expect(russia?.geometry ? Math.max(...collectLongitudeSpans(russia.geometry)) : Infinity).toBeLessThan(300);
  });
});
