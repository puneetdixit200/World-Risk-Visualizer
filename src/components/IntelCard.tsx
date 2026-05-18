"use client";

/* eslint-disable @next/next/no-img-element */

import { X } from "lucide-react";

import { formatCompactNumber, formatNumber } from "@/lib/geoUtils";
import { getRiskBand, getRiskColor } from "@/lib/riskCalculator";
import type { CountryIntel, DiseaseRecord } from "@/types/risk";

import { Sparkline } from "./Sparkline";

type IntelCardProps = {
  country?: CountryIntel;
  disease?: DiseaseRecord;
  interpolCount: number;
  riskScore: number;
  countryLookup: Record<string, CountryIntel>;
  onClose: () => void;
  onSelectCountry: (cca3: string) => void;
};

export function IntelCard({
  country,
  disease,
  interpolCount,
  riskScore,
  countryLookup,
  onClose,
  onSelectCountry,
}: IntelCardProps) {
  const open = Boolean(country);

  return (
    <aside className={`intel-card ${open ? "open" : ""}`} aria-live="polite">
      {country ? (
        <>
          <div className="intel-header">
            <div className="flag-frame">
              {country.flag ? <img src={country.flag} alt={country.flagAlt} /> : null}
            </div>
            <div className="min-w-0">
              <p className="hud-title text-xs">COUNTRY DOSSIER</p>
              <h2 className="truncate text-xl font-semibold">{country.name}</h2>
              <p className="data-font truncate text-xs text-[#7a8da0]">{country.region}</p>
            </div>
            <button type="button" className="icon-button" onClick={onClose} aria-label="Close intel card">
              <X size={17} />
            </button>
          </div>

          <div className="mt-5 flex items-end justify-between gap-4">
            <div>
              <p className="data-font text-[10px] uppercase text-[#7a8da0]">Risk Score</p>
              <p className="data-font text-5xl font-bold" style={{ color: getRiskColor(riskScore) }}>
                {riskScore}
              </p>
            </div>
            <p className="data-font mb-2 rounded border border-[#ff004040] px-2 py-1 text-xs uppercase text-[#ff7a99]">
              {getRiskBand(riskScore)}
            </p>
          </div>
          <div className="risk-meter mt-3" aria-hidden="true">
            <span style={{ width: `${riskScore}%` }} />
          </div>

          <div className="intel-grid">
            <div className="intel-cell">
              <p className="stat-label">Population</p>
              <p className="stat-value">{formatCompactNumber(country.population)}</p>
            </div>
            <div className="intel-cell">
              <p className="stat-label">Area</p>
              <p className="stat-value">{formatCompactNumber(country.area)} km²</p>
            </div>
            <div className="intel-cell">
              <p className="stat-label">Density</p>
              <p className="stat-value">{formatNumber(country.density)}/km²</p>
            </div>
            <div className="intel-cell">
              <p className="stat-label">Interpol</p>
              <p className="stat-value text-[#ff8c00]">{interpolCount}</p>
            </div>
          </div>

          <div className="intel-cell mt-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <p className="stat-label">Active Disease Cases</p>
                <p className="stat-value text-[#ff0040]">{formatCompactNumber(disease?.active ?? 0)}</p>
              </div>
              <p className="data-font text-[10px] uppercase text-[#7a8da0]">30D Trend</p>
            </div>
            <Sparkline data={disease?.trend ?? []} color="#ff0040" />
          </div>

          <div className="mt-4">
            <p className="stat-label mb-2">Adjacent Threats</p>
            <div className="chip-list">
              {country.borders.length ? (
                country.borders.slice(0, 12).map((border) => (
                  <button className="chip" type="button" key={border} onClick={() => onSelectCountry(border)}>
                    {countryLookup[border]?.name ?? border}
                  </button>
                ))
              ) : (
                <span className="chip">No land borders</span>
              )}
            </div>
          </div>
        </>
      ) : null}
    </aside>
  );
}
