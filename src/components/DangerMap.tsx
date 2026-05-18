"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import L, { type Layer, type LeafletMouseEvent, type PathOptions } from "leaflet";
import { CircleMarker, GeoJSON, MapContainer, Polyline, Popup, TileLayer } from "react-leaflet";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import countries110m from "world-atlas/countries-110m.json";

import { ComparisonPanel } from "@/components/ComparisonPanel";
import { CRTOverlay } from "@/components/CRTOverlay";
import { DraggablePanel } from "@/components/DraggablePanel";
import { IntelCard } from "@/components/IntelCard";
import { LayerTogglePanel } from "@/components/LayerTogglePanel";
import { MapZoomControls } from "@/components/MapZoomControls";
import { StatsHUD } from "@/components/StatsHUD";
import { ThreatScene3D } from "@/components/ThreatScene3D";
import { ThreatTicker } from "@/components/ThreatTicker";
import {
  createDeterministicScatter,
  formatCompactNumber,
  getDiseaseValueAtIndex,
  scaleCircleRadius,
} from "@/lib/geoUtils";
import { calculateDefcon, calculateRiskByCountry, getRiskColor } from "@/lib/riskCalculator";
import type {
  CountryIntel,
  DiseaseRecord,
  FbiEntry,
  InterpolAggregate,
  LayerKey,
  LayerState,
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
  error?: string;
};

type FbiResponse = {
  fbi: FbiEntry[];
  source: "live" | "fallback";
  error?: string;
};

type TickerSelection = Parameters<typeof ThreatTicker>[0]["selected"];

const initialLayers: LayerState = {
  threat: true,
  disease: true,
  interpol: true,
  fbi: true,
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
  const [fbi, setFbi] = useState<FbiEntry[]>([]);
  const [sourceNote, setSourceNote] = useState("Live cache");
  const [layers, setLayers] = useState<LayerState>(initialLayers);
  const [hoveredCountry, setHoveredCountry] = useState<string | undefined>();
  const [lockedCountry, setLockedCountry] = useState<string | undefined>();
  const [compareCodes, setCompareCodes] = useState<string[]>([]);
  const [nightVision, setNightVision] = useState(false);
  const [satelliteFlash, setSatelliteFlash] = useState(false);
  const [timeIndex, setTimeIndex] = useState(29);
  const [tickerSelection, setTickerSelection] = useState<TickerSelection>();
  const [loadError, setLoadError] = useState<string | undefined>();
  const mapRef = useRef<L.Map | null>(null);

  const worldFeatures = useMemo(() => {
    const topology = countries110m as WorldTopology;
    const collection = feature(topology, topology.objects.countries) as FeatureCollection<Geometry, { name?: string }>;

    return {
      ...collection,
      features: collection.features.filter((countryFeature) => {
        const id = String(countryFeature.id).padStart(3, "0");
        return id !== "010" && id !== "242";
      }),
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadFeeds() {
      try {
        const [countryResponse, diseaseResponse, interpolResponse, fbiResponse] = await Promise.all([
          getJson<CountriesResponse>("/api/countries"),
          getJson<DiseaseResponse>("/api/disease"),
          getJson<InterpolAggregate>("/api/interpol"),
          getJson<FbiResponse>("/api/fbi"),
        ]);

        if (cancelled) {
          return;
        }

        setCountries(countryResponse.countries);
        setDisease(diseaseResponse.disease);
        setInterpol(interpolResponse);
        setFbi(fbiResponse.fbi);
        setSourceNote(
          [countryResponse.source, diseaseResponse.source, interpolResponse.source, fbiResponse.source].includes(
            "fallback",
          )
            ? "Mixed live/fallback"
            : "Live cache",
        );
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "Unable to load data feeds.");
        }
      }
    }

    void loadFeeds();

    return () => {
      cancelled = true;
    };
  }, []);

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
    const activeCases = Object.values(disease).reduce((sum, record) => sum + record.active, 0);
    const scores = Object.values(riskScores);

    return {
      interpolTotal: interpol.total,
      activeCases,
      highRiskCountries: scores.filter((score) => score >= 65).length,
      defcon: calculateDefcon(scores, activeCases, interpol.total),
    };
  }, [disease, interpol.total, riskScores]);

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

  const fbiMarkers = useMemo(
    () =>
      createDeterministicScatter([-98, 39], "FBI-MOST-WANTED", Math.min(fbi.length, 10)).map((point, index) => ({
        point,
        entry: fbi[index],
      })),
    [fbi],
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
                  radius={scaleCircleRadius(value)}
                  stroke
                  color="#ff0040"
                  weight={2}
                >
                  <Popup>
                    <strong>{record.country}</strong>
                    <br />
                    Active cases: {formatCompactNumber(value)}
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

          {layers.fbi
            ? fbiMarkers.map(({ point, entry }, index) =>
                entry ? (
                  <CircleMarker
                    center={[point[1], point[0]]}
                    className="fbi-marker"
                    color="#ff0000"
                    fillColor="#ff0000"
                    fillOpacity={0.72}
                    key={entry.id}
                    radius={6}
                    weight={2}
                  >
                    <Popup>
                      <strong>{entry.name}</strong>
                      <br />
                      {entry.description}
                    </Popup>
                  </CircleMarker>
                ) : (
                  <CircleMarker
                    center={[point[1], point[0]]}
                    className="fbi-marker"
                    color="#ff0000"
                    fillColor="#ff0000"
                    fillOpacity={0.72}
                    key={`fbi-empty-${index}`}
                    radius={6}
                    weight={2}
                  />
                ),
              )
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

      <ThreatScene3D activeRisk={activeRisk} density={interpolDots.length} />
      <MapZoomControls mapRef={mapRef} onSoundToggle={toggleSound} soundEnabled={soundEnabled} />
      <LayerTogglePanel
        layers={layers}
        nightVision={nightVision}
        onNightVisionToggle={() => setNightVision((current) => !current)}
        onToggle={toggleLayer}
      />
      <StatsHUD stats={globalStats} sourceNote={sourceNote} />
      <IntelCard
        country={activeCountry}
        countryLookup={countries}
        disease={activeDisease}
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
          <p className="hud-title text-xs">DISEASE TIME SLIDER</p>
          <p className="data-font text-[10px] uppercase text-[#7a8da0]">Day {timeIndex + 1}/30</p>
        </div>
        <input
          aria-label="Disease timeline day"
          max={29}
          min={0}
          onChange={(event) => setTimeIndex(Number(event.target.value))}
          type="range"
          value={timeIndex}
        />
      </DraggablePanel>
      <ThreatTicker
        fbi={fbi}
        interpol={interpol.notices}
        onClose={() => setTickerSelection(undefined)}
        onSelect={setTickerSelection}
        selected={tickerSelection}
      />
      <div className={`static-flash ${satelliteFlash ? "active" : ""}`} aria-hidden="true" />
      {!hasData || loadError ? (
        <section className="loading-panel">
          <p className="hud-title text-sm">{loadError ? "FEED ERROR" : "SYNCING FEEDS"}</p>
          <h1 className="mt-2 text-2xl font-semibold">{loadError ? "Unable to load command data" : "Building world risk layer"}</h1>
          <p className="mt-3 text-sm text-[#7a8da0]">
            {loadError ?? "Fetching countries, disease, Interpol, and FBI feeds through cached route handlers."}
          </p>
        </section>
      ) : null}
      <CRTOverlay />
    </main>
  );
}
