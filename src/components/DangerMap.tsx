"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import L, { type Layer, type LeafletMouseEvent, type PathOptions } from "leaflet";
import { GitBranch } from "lucide-react";
import { CircleMarker, GeoJSON, MapContainer, Polyline, Popup, TileLayer } from "react-leaflet";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import countries110m from "world-atlas/countries-110m.json";

import { CommandPalette } from "@/components/CommandPalette";
import { ComparisonPanel } from "@/components/ComparisonPanel";
import { CRTOverlay } from "@/components/CRTOverlay";
import { DraggablePanel } from "@/components/DraggablePanel";
import { IntelCard } from "@/components/IntelCard";
import { LayerTogglePanel } from "@/components/LayerTogglePanel";
import { MapZoomControls } from "@/components/MapZoomControls";
import { StatsHUD } from "@/components/StatsHUD";
import { ThreatTicker } from "@/components/ThreatTicker";
import {
  buildCommandPaletteItems,
  buildSourceHealth,
  getLikelyAttackTarget,
  getReplayCyberCounts,
  type CommandPaletteItem,
} from "@/lib/commandCenter";
import {
  createDeterministicScatter,
  formatCompactNumber,
  getDiseaseValueAtIndex,
  sanitizeWorldFeatureCollection,
  scaleCircleRadius,
  scaleOutbreakRadius,
} from "@/lib/geoUtils";
import { fallbackCyber } from "@/lib/fallbackData";
import { calculateDefcon, calculateRiskByCountry, getRiskColor } from "@/lib/riskCalculator";
import type {
  CountryIntel,
  CyberFeed,
  DiseaseRecord,
  InterpolAggregate,
  LayerKey,
  LayerState,
  SourceHealth,
} from "@/types/risk";

type CountryFeature = Feature<Geometry, { name?: string }> & {
  id?: string | number;
};

type WorldTopology = Topology<{
  countries: GeometryCollection<{ name?: string }>;
  land: GeometryCollection;
}>;

type CountriesResponse = {
  countries: Record<string, CountryIntel>;
  source: "live" | "fallback";
  error?: string;
};

type DiseaseResponse = {
  disease: Record<string, DiseaseRecord>;
  source: "live" | "fallback";
  fetchedAt?: string;
  updatedAt?: string;
  error?: string;
};

type TickerSelection = Parameters<typeof ThreatTicker>[0]["selected"];

const initialLayers: LayerState = {
  threat: true,
  disease: true,
  interpol: true,
  cyber: true,
  density: false,
  corridors: true,
};

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }

  return (await response.json()) as T;
}

function getCountryCodeFromFeature(featureValue: CountryFeature, countriesByNumeric: Record<string, string>) {
  const rawId = featureValue.id;

  if (rawId === undefined || rawId === null) {
    return undefined;
  }

  const numeric = String(rawId).padStart(3, "0");
  return countriesByNumeric[numeric];
}

function densityColor(density: number) {
  if (density > 500) {
    return "#00ff88";
  }

  if (density > 200) {
    return "#00d4ff";
  }

  if (density > 75) {
    return "#1a5276";
  }

  return "#101820";
}

function formatSourceNote(diseaseUpdatedAt: string | undefined, hasFallback: boolean) {
  const status = hasFallback ? "Mixed live/fallback" : "Live feeds";

  if (!diseaseUpdatedAt) {
    return status;
  }

  return `${status} | Disease ${new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(diseaseUpdatedAt))}`;
}

function useImmersiveAudio(activeRisk: number) {
  const audioRef = useRef<AudioContext | null>(null);
  const humRef = useRef<OscillatorNode | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const blipTimerRef = useRef<number | null>(null);
  const [enabled, setEnabled] = useState(false);

  const ensureContext = useCallback(() => {
    const AudioContextCtor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextCtor) {
      return null;
    }

    const context = audioRef.current ?? new AudioContextCtor();
    audioRef.current = context;
    void context.resume();

    return context;
  }, []);

  const playPing = useCallback((risk: number) => {
    const context = ensureContext();

    if (!context) {
      return;
    }

    try {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = risk >= 80 ? "sawtooth" : "sine";
      oscillator.frequency.value = risk >= 80 ? 520 : 1200;
      gain.gain.value = enabled ? (risk >= 80 ? 0.045 : 0.022) : 0.012;
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + (risk >= 80 ? 0.12 : 0.045));
    } catch {
      // Browser autoplay policy can block this before a user gesture.
    }
  }, [enabled, ensureContext]);

  const stopSoundscape = useCallback(() => {
    if (blipTimerRef.current) {
      window.clearInterval(blipTimerRef.current);
      blipTimerRef.current = null;
    }

    humRef.current?.stop();
    humRef.current?.disconnect();
    humRef.current = null;
    masterGainRef.current?.disconnect();
    masterGainRef.current = null;
    setEnabled(false);
  }, []);

  const startSoundscape = useCallback(() => {
    const context = ensureContext();

    if (!context || humRef.current) {
      setEnabled(Boolean(context));
      return;
    }

    const masterGain = context.createGain();
    const filter = context.createBiquadFilter();
    const hum = context.createOscillator();
    masterGain.gain.value = 0.018;
    filter.type = "lowpass";
    filter.frequency.value = 240;
    hum.type = "sawtooth";
    hum.frequency.value = 48;
    hum.connect(filter);
    filter.connect(masterGain);
    masterGain.connect(context.destination);
    hum.start();
    humRef.current = hum;
    masterGainRef.current = masterGain;
    setEnabled(true);

    blipTimerRef.current = window.setInterval(() => {
      const risk = activeRisk || 35;
      playPing(risk);
    }, 2300);
  }, [activeRisk, ensureContext, playPing]);

  const toggleSound = useCallback(() => {
    if (enabled) {
      stopSoundscape();
    } else {
      startSoundscape();
    }
  }, [enabled, startSoundscape, stopSoundscape]);

  useEffect(() => {
    const startOnGesture = () => startSoundscape();
    window.addEventListener("pointerdown", startOnGesture, { once: true });

    return () => window.removeEventListener("pointerdown", startOnGesture);
  }, [startSoundscape]);

  useEffect(() => {
    if (humRef.current) {
      humRef.current.frequency.setTargetAtTime(42 + activeRisk * 0.38, audioRef.current?.currentTime ?? 0, 0.08);
    }

    if (masterGainRef.current) {
      masterGainRef.current.gain.setTargetAtTime(0.012 + activeRisk / 4500, audioRef.current?.currentTime ?? 0, 0.12);
    }
  }, [activeRisk]);

  useEffect(() => stopSoundscape, [stopSoundscape]);

  return { enabled, playPing, toggleSound };
}

export function DangerMap() {
  const [countries, setCountries] = useState<Record<string, CountryIntel>>({});
  const [disease, setDisease] = useState<Record<string, DiseaseRecord>>({});
  const [interpol, setInterpol] = useState<InterpolAggregate>({
    counts: {},
    notices: [],
    total: 0,
    source: "fallback",
    fetchedAt: new Date().toISOString(),
  });
  const [cyber, setCyber] = useState<CyberFeed>(fallbackCyber);
  const [sourceNote, setSourceNote] = useState("Live cache");
  const [sourceHealth, setSourceHealth] = useState<SourceHealth[]>([
    { label: "Countries", status: "cache" },
    { label: "Outbreaks", status: "cache" },
    { label: "Interpol", status: "cache" },
    { label: "Cyber", status: "cache" },
  ]);
  const [layers, setLayers] = useState<LayerState>(initialLayers);
  const [hoveredCountry, setHoveredCountry] = useState<string | undefined>();
  const [lockedCountry, setLockedCountry] = useState<string | undefined>();
  const [compareCodes, setCompareCodes] = useState<string[]>([]);
  const [nightVision, setNightVision] = useState(false);
  const [satelliteFlash, setSatelliteFlash] = useState(false);
  const [timeIndex, setTimeIndex] = useState(29);
  const [replayActive, setReplayActive] = useState(false);
  const [replayIndex, setReplayIndex] = useState(23);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [tickerSelection, setTickerSelection] = useState<TickerSelection>();
  const [loadError, setLoadError] = useState<string | undefined>();
  const mapRef = useRef<L.Map | null>(null);
  const voiceAlertRef = useRef("");

  const worldFeatures = useMemo(() => {
    const topology = countries110m as WorldTopology;
    const collection = feature(topology, topology.objects.countries) as FeatureCollection<Geometry, { name?: string }>;

    return sanitizeWorldFeatureCollection(collection);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadFeeds() {
      const countryPromise = getJson<CountriesResponse>("/api/countries")
        .then((countryResponse) => {
          if (!cancelled) {
            setCountries(countryResponse.countries);
          }

          return countryResponse.source;
        })
        .catch((error) => {
          if (!cancelled) {
            setLoadError(error instanceof Error ? error.message : "Unable to load country data.");
          }

          return "fallback" as const;
        });

      const diseasePromise = getJson<DiseaseResponse>("/api/disease")
        .then((diseaseResponse) => {
          if (!cancelled) {
            setDisease(diseaseResponse.disease);
          }

          return {
            source: diseaseResponse.source,
            updatedAt: diseaseResponse.updatedAt ?? diseaseResponse.fetchedAt,
          };
        })
        .catch(() => ({ source: "fallback" as const, updatedAt: undefined }));

      const interpolPromise = getJson<InterpolAggregate>("/api/interpol")
        .then((interpolResponse) => {
          if (!cancelled) {
            setInterpol(interpolResponse);
          }

          return interpolResponse.source;
        })
        .catch(() => "fallback" as const);

      const cyberPromise = getJson<CyberFeed>("/api/cyber")
        .then((cyberResponse) => {
          if (!cancelled) {
            setCyber(cyberResponse);
          }

          return {
            source: cyberResponse.source,
            fetchedAt: cyberResponse.fetchedAt,
            hasError: Boolean(cyberResponse.error),
          };
        })
        .catch(() => ({ source: "fallback" as const, fetchedAt: undefined, hasError: true }));

      const [countrySource, diseaseResult, interpolSource, cyberSource] = await Promise.all([
        countryPromise,
        diseasePromise,
        interpolPromise,
        cyberPromise,
      ]);

      if (!cancelled) {
        setSourceNote(
          formatSourceNote(
            diseaseResult.updatedAt,
            [countrySource, diseaseResult.source, interpolSource, cyberSource.source].includes("fallback"),
          ),
        );
        setSourceHealth(
          buildSourceHealth({
            countriesSource: countrySource,
            diseaseSource: diseaseResult.source,
            interpolSource,
            cyberSource: cyberSource.source,
            diseaseUpdatedAt: diseaseResult.updatedAt,
            cyberFetchedAt: cyberSource.fetchedAt,
            hasCyberError: cyberSource.hasError,
          }),
        );
      }
    }

    void loadFeeds();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!replayActive) {
      return;
    }

    const interval = window.setInterval(() => {
      setReplayIndex((current) => (current >= 23 ? 0 : current + 1));
    }, 1150);

    return () => window.clearInterval(interval);
  }, [replayActive]);

  const countriesByNumeric = useMemo(
    () =>
      Object.fromEntries(
        Object.values(countries)
          .filter((country) => country.ccn3)
          .map((country) => [country.ccn3, country.cca3]),
      ),
    [countries],
  );

  const riskScores = useMemo(
    () => calculateRiskByCountry(countries, disease, interpol.counts),
    [countries, disease, interpol.counts],
  );

  const activeCountryCode = lockedCountry ?? hoveredCountry;
  const activeCountry = activeCountryCode ? countries[activeCountryCode] : undefined;
  const activeRisk = activeCountryCode ? riskScores[activeCountryCode] ?? 0 : 0;
  const activeDisease = activeCountryCode ? disease[activeCountryCode] : undefined;
  const comparisonCountries = compareCodes.map((code) => countries[code]).filter(Boolean);
  const { enabled: soundEnabled, playPing, toggleSound } = useImmersiveAudio(activeRisk);

  const globalStats = useMemo(() => {
    const activeCases = Object.values(disease).reduce((sum, record) => sum + (record.reportCount ?? record.active), 0);
    const scores = Object.values(riskScores);

    return {
      interpolTotal: interpol.total,
      activeCases,
      cyberIncidents: cyber.total,
      highRiskCountries: scores.filter((score) => score >= 65).length,
      defcon: calculateDefcon(scores, activeCases, interpol.total),
    };
  }, [cyber.total, disease, interpol.total, riskScores]);

  useEffect(() => {
    if (!soundEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    const alertKey = `${globalStats.defcon}-${activeCountry?.cca3 ?? "global"}`;

    if (globalStats.defcon > 2 || voiceAlertRef.current === alertKey) {
      return;
    }

    voiceAlertRef.current = alertKey;
    const message = new SpeechSynthesisUtterance(
      activeCountry ? `High risk detected in ${activeCountry.name}` : `Global DEFCON ${globalStats.defcon}`,
    );
    message.rate = 0.92;
    message.pitch = 0.75;
    message.volume = 0.35;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(message);
  }, [activeCountry, globalStats.defcon, soundEnabled]);

  const countryStyle = useCallback(
    (featureValue?: Feature<Geometry, { name?: string }>): PathOptions => {
      const featureCountry = featureValue
        ? countries[getCountryCodeFromFeature(featureValue as CountryFeature, countriesByNumeric) ?? ""]
        : undefined;
      const score = featureCountry ? riskScores[featureCountry.cca3] ?? 0 : 0;
      const fillColor = layers.threat
        ? getRiskColor(score)
        : layers.density && featureCountry
          ? densityColor(featureCountry.density)
          : "#071017";

      return {
        color: "rgba(0,255,136,0.18)",
        weight: 0.7,
        opacity: 0.95,
        fillColor,
        fillOpacity: layers.threat || layers.density ? 0.55 : 0.08,
        className: `country-path ${score >= 75 ? "critical-country" : ""}`,
      };
    },
    [countries, countriesByNumeric, layers.density, layers.threat, riskScores],
  );

  const registerCountryEvents = useCallback(
    (featureValue: Feature<Geometry, { name?: string }>, layer: Layer) => {
      const countryCode = getCountryCodeFromFeature(featureValue as CountryFeature, countriesByNumeric);

      if (!countryCode) {
        return;
      }

      layer.on({
        mouseover: (event: LeafletMouseEvent) => {
          setHoveredCountry(countryCode);
          const score = riskScores[countryCode] ?? 0;
          playPing(score);
          (event.target as L.Path).setStyle({
            color: "#00ff88",
            weight: 1.8,
            fillOpacity: layers.threat || layers.density ? 0.72 : 0.16,
          });
        },
        mouseout: (event: LeafletMouseEvent) => {
          if (!lockedCountry) {
            setHoveredCountry(undefined);
          }

          (event.target as L.Path).setStyle(countryStyle(featureValue));
        },
        click: (event: LeafletMouseEvent) => {
          setLockedCountry(countryCode);
          setCompareCodes((current) => {
            const next = current.filter((code) => code !== countryCode);
            next.push(countryCode);
            return next.slice(-2);
          });

          const target = event.target as L.Polygon;
          mapRef.current?.flyToBounds(target.getBounds(), {
            padding: [80, 80],
            duration: 1.1,
          });
          setSatelliteFlash(true);
          window.setTimeout(() => setSatelliteFlash(false), 720);
        },
      });
    },
    [countriesByNumeric, countryStyle, layers.density, layers.threat, lockedCountry, playPing, riskScores],
  );

  const toggleLayer = useCallback((key: LayerKey) => {
    setLayers((current) => ({ ...current, [key]: !current[key] }));
  }, []);

  const selectCountry = useCallback((cca3: string) => {
    setLockedCountry(cca3);
    const country = countries[cca3];

    if (country) {
      mapRef.current?.flyTo([country.latlng[0], country.latlng[1]], 4, { duration: 0.9 });
    }
  }, [countries]);

  const selectCommandItem = useCallback(
    (item: CommandPaletteItem) => {
      if (item.countryCode && countries[item.countryCode]) {
        selectCountry(item.countryCode);
      }
    },
    [countries, selectCountry],
  );

  const diseaseMarkers = useMemo(
    () =>
      Object.values(disease)
        .map((record) => ({
          record,
          value: getDiseaseValueAtIndex(record, timeIndex),
        }))
        .filter(({ record, value }) => value > 0 && Number.isFinite(record.lat) && Number.isFinite(record.lng))
        .sort((left, right) => right.value - left.value)
        .slice(0, 90),
    [disease, timeIndex],
  );

  const interpolDots = useMemo(
    () =>
      Object.entries(interpol.counts).flatMap(([cca3, count]) => {
        const country = countries[cca3];

        if (!country || count <= 0) {
          return [];
        }

        return createDeterministicScatter(country.center, cca3, Math.min(count, 6)).map((point, index) => ({
          id: `${cca3}-${index}`,
          cca3,
          count,
          point,
        }));
      }).slice(0, 280),
    [countries, interpol.counts],
  );

  const visibleCyberCounts = useMemo(
    () => getReplayCyberCounts(cyber.incidents, cyber.counts, replayActive, replayIndex),
    [cyber.counts, cyber.incidents, replayActive, replayIndex],
  );

  const cyberMarkers = useMemo(
    () =>
      Object.entries(visibleCyberCounts).flatMap(([cca3, count]) => {
        const country = countries[cca3];

        if (!country || count <= 0) {
          return [];
        }

        return createDeterministicScatter(country.center, `${cca3}-CYBER`, Math.min(count, 5)).map((point, index) => ({
          id: `${cca3}-cyber-${index}`,
          cca3,
          count,
          point,
        }));
      }).slice(0, 220),
    [countries, visibleCyberCounts],
  );

  const cyberHeatTrails = useMemo(
    () =>
      cyberMarkers.slice(0, 70).map((marker) => ({
        ...marker,
        radius: Math.min(30, 12 + marker.count * 4),
      })),
    [cyberMarkers],
  );

  const attackLines = useMemo(
    () =>
      cyber.incidents
        .slice(0, replayActive ? Math.max(1, replayIndex + 1) : 18)
        .map((incident) => {
          const source = countries[incident.countryCode];
          const target = getLikelyAttackTarget(incident, countries);

          if (!source || !target) {
            return undefined;
          }

          return {
            id: `attack-${incident.id}`,
            positions: [
              [source.latlng[0], source.latlng[1]],
              [(source.latlng[0] + target.latlng[0]) / 2 + 18, (source.latlng[1] + target.latlng[1]) / 2],
              [target.latlng[0], target.latlng[1]],
            ] as [number, number][],
            attacks: incident.attacks ?? 1,
          };
        })
        .filter((line): line is { id: string; positions: [number, number][]; attacks: number } => Boolean(line))
        .slice(0, 24),
    [countries, cyber.incidents, replayActive, replayIndex],
  );

  const diseaseCounts = useMemo(
    () => Object.fromEntries(Object.entries(disease).map(([code, record]) => [code, record.reportCount ?? record.active])),
    [disease],
  );

  const commandItems = useMemo(
    () => buildCommandPaletteItems({ countries, disease, cyber, interpol }),
    [countries, cyber, disease, interpol],
  );

  const corridorLines = useMemo(() => {
    if (!activeCountry || !layers.corridors) {
      return [];
    }

    return activeCountry.borders
      .map((borderCode) => countries[borderCode])
      .filter(Boolean)
      .filter((borderCountry) => (interpol.counts[borderCountry.cca3] ?? 0) > 0 || (riskScores[borderCountry.cca3] ?? 0) > 45)
      .map((borderCountry) => ({
        id: `${activeCountry.cca3}-${borderCountry.cca3}`,
        positions: [
          [activeCountry.latlng[0], activeCountry.latlng[1]],
          [borderCountry.latlng[0], borderCountry.latlng[1]],
        ] as [number, number][],
      }));
  }, [activeCountry, countries, interpol.counts, layers.corridors, riskScores]);

  const hasData = Object.keys(countries).length > 0;

  return (
    <main className={`danger-shell ${activeRisk >= 80 ? "red-alert" : ""} ${nightVision ? "night-vision" : ""}`}>
      <div className={`map-stage ${satelliteFlash ? "satellite-drop" : ""}`}>
        <MapContainer
          center={[22, 12]}
          zoom={2}
          minZoom={2}
          maxZoom={7}
          zoomControl={false}
          className="map"
          ref={mapRef}
          worldCopyJump
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          {hasData ? (
            <GeoJSON
              key={`${layers.threat}-${layers.density}-${Object.keys(countries).length}`}
              data={worldFeatures}
              style={countryStyle}
              onEachFeature={registerCountryEvents}
            />
          ) : null}

          {layers.disease
            ? diseaseMarkers.map(({ record, value }) => (
                <CircleMarker
                  center={[record.lat, record.lng]}
                  className="disease-pulse"
                  fillColor="#ff0040"
                  fillOpacity={0.28}
                  key={record.iso3}
                  radius={record.reportCount ? scaleOutbreakRadius(value) : scaleCircleRadius(value)}
                  stroke
                  color="#ff0040"
                  weight={2}
                >
                  <Popup>
                    <strong>{record.country}</strong>
                    <br />
                    {record.diseaseName ?? "Outbreak reports"}: {formatCompactNumber(value)}
                  </Popup>
                </CircleMarker>
              ))
            : null}

          {layers.interpol
            ? interpolDots.map((dot) => (
                <CircleMarker
                  center={[dot.point[1], dot.point[0]]}
                  className="interpol-blink"
                  color="#ff8c00"
                  fillColor="#ff8c00"
                  fillOpacity={0.78}
                  key={dot.id}
                  radius={4.5}
                  weight={1}
                >
                  <Popup>
                    <strong>{countries[dot.cca3]?.name ?? dot.cca3}</strong>
                    <br />
                    Interpol notices: {dot.count}
                  </Popup>
                </CircleMarker>
              ))
            : null}

          {layers.cyber
            ? cyberHeatTrails.map((marker) => (
                <CircleMarker
                  center={[marker.point[1], marker.point[0]]}
                  className="cyber-heat-trail"
                  color="#00d4ff"
                  fillColor="#00d4ff"
                  fillOpacity={0.08}
                  key={`${marker.id}-heat`}
                  radius={marker.radius}
                  stroke={false}
                />
              ))
            : null}

          {layers.cyber
            ? cyberMarkers.map((marker) => (
                <CircleMarker
                  center={[marker.point[1], marker.point[0]]}
                  className="cyber-pulse"
                  color="#00d4ff"
                  fillColor="#9d4edd"
                  fillOpacity={0.64}
                  key={marker.id}
                  radius={Math.min(12, 5 + marker.count * 1.2)}
                  weight={2}
                >
                  <Popup>
                    <strong>{countries[marker.cca3]?.name ?? marker.cca3}</strong>
                    <br />
                    Cyber reports: {marker.count}
                  </Popup>
                </CircleMarker>
              ))
            : null}

          {layers.cyber
            ? attackLines.map((line) => (
                <Polyline
                  className="attack-arc-line"
                  color="#ff0040"
                  key={line.id}
                  opacity={0.52}
                  positions={line.positions}
                  weight={Math.min(4, 1 + line.attacks / 4500)}
                />
              ))
            : null}

          {corridorLines.map((line) => (
            <Polyline
              className="corridor-line"
              color="#00d4ff"
              key={line.id}
              opacity={0.7}
              positions={line.positions}
              weight={2}
            />
          ))}
        </MapContainer>
      </div>

      <MapZoomControls mapRef={mapRef} onSoundToggle={toggleSound} soundEnabled={soundEnabled} />
      <LayerTogglePanel
        layers={layers}
        nightVision={nightVision}
        onNightVisionToggle={() => setNightVision((current) => !current)}
        onToggle={toggleLayer}
      />
      <CommandPalette
        items={commandItems}
        onOpenChange={setCommandPaletteOpen}
        onSelect={selectCommandItem}
        open={commandPaletteOpen}
      />
      <StatsHUD stats={globalStats} sourceNote={sourceNote} sources={sourceHealth} />
      <IntelCard
        country={activeCountry}
        countryLookup={countries}
        disease={activeDisease}
        cyberCount={activeCountryCode ? cyber.counts[activeCountryCode] ?? 0 : 0}
        interpolCount={activeCountryCode ? interpol.counts[activeCountryCode] ?? 0 : 0}
        onClose={() => {
          setHoveredCountry(undefined);
          setLockedCountry(undefined);
        }}
        onSelectCountry={selectCountry}
        riskScore={activeRisk}
      />
      <ComparisonPanel
        countries={comparisonCountries}
        cyberCounts={visibleCyberCounts}
        diseaseCounts={diseaseCounts}
        interpolCounts={interpol.counts}
        onClose={() => setCompareCodes([])}
        riskScores={riskScores}
      />
      <DraggablePanel
        ariaLabel="Disease timeline control"
        className="time-scrubber"
        initialPosition={{ x: 380, y: 610 }}
        panelId="disease-timeline"
        role="region"
      >
        <div className="mb-1 flex items-center justify-between gap-3">
          <p className="hud-title text-xs">OUTBREAK TIME SLIDER</p>
          <p className="data-font text-[10px] uppercase text-[#7a8da0]">Day {timeIndex + 1}/30</p>
        </div>
        <input
          aria-label="Outbreak timeline day"
          max={29}
          min={0}
          onChange={(event) => setTimeIndex(Number(event.target.value))}
          type="range"
          value={timeIndex}
        />
        <div className="replay-row" aria-label="Incident replay controls">
          <button
            type="button"
            onClick={() => {
              setReplayActive((current) => {
                if (current) {
                  setReplayIndex(23);
                  return false;
                }

                setReplayIndex(0);
                return true;
              });
            }}
          >
            {replayActive ? "Pause replay" : "Replay incidents"}
          </button>
          <span>Hour {replayIndex + 1}/24</span>
        </div>
      </DraggablePanel>
      <ThreatTicker
        cyber={cyber}
        interpol={interpol.notices}
        onClose={() => setTickerSelection(undefined)}
        onSelect={setTickerSelection}
        selected={tickerSelection}
      />
      <a
        aria-label="Open Puneet Dixit's GitHub profile"
        className="github-hud-link"
        href="https://github.com/puneetdixit200"
        rel="noreferrer"
        target="_blank"
      >
        <GitBranch size={18} strokeWidth={2.1} aria-hidden="true" />
        <span>@puneetdixit200</span>
      </a>
      <div className={`static-flash ${satelliteFlash ? "active" : ""}`} aria-hidden="true" />
      {!hasData || loadError ? (
        <section className="loading-panel">
          <p className="hud-title text-sm">{loadError ? "FEED ERROR" : "SYNCING FEEDS"}</p>
          <h1 className="mt-2 text-2xl font-semibold">{loadError ? "Unable to load command data" : "Building world risk layer"}</h1>
          <p className="mt-3 text-sm text-[#7a8da0]">
            {loadError ?? "Fetching countries, WHO outbreaks, GDELT reports, Interpol, and cyber feeds through cached route handlers."}
          </p>
        </section>
      ) : null}
      <CRTOverlay />
    </main>
  );
}
