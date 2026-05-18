"use client";

import { X } from "lucide-react";

import { formatCompactNumber } from "@/lib/geoUtils";
import { getRiskColor } from "@/lib/riskCalculator";
import type { CountryIntel } from "@/types/risk";

import { DraggablePanel } from "./DraggablePanel";

type ComparisonPanelProps = {
  countries: CountryIntel[];
  riskScores: Record<string, number>;
  onClose: () => void;
};

export function ComparisonPanel({ countries, riskScores, onClose }: ComparisonPanelProps) {
  if (countries.length < 2) {
    return null;
  }

  return (
    <DraggablePanel
      ariaLabel="Country comparison"
      className="comparison-panel"
      initialPosition={{ x: 330, y: 74 }}
      panelId="country-comparison"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="hud-title text-xs">COMPARISON MODE</p>
          <h2 className="text-lg font-semibold">
            {countries[0].name} vs {countries[1].name}
          </h2>
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close comparison">
          <X size={17} />
        </button>
      </div>
      <div className="comparison-grid">
        {countries.map((country) => {
          const risk = riskScores[country.cca3] ?? 0;

          return (
            <div className="intel-cell" key={country.cca3}>
              <p className="data-font text-xs text-[#7a8da0]">{country.region}</p>
              <h3 className="truncate text-base font-semibold">{country.name}</h3>
              <p className="data-font mt-2 text-4xl font-bold" style={{ color: getRiskColor(risk) }}>
                {risk}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-[#b8c7d4]">
                <span>Pop {formatCompactNumber(country.population)}</span>
                <span>Area {formatCompactNumber(country.area)}</span>
                <span>Borders {country.borderCount}</span>
                <span>Density {formatCompactNumber(country.density)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </DraggablePanel>
  );
}
