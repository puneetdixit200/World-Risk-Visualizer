"use client";

import { useEffect, useState } from "react";

import { formatCompactNumber } from "@/lib/geoUtils";
import type { GlobalStats } from "@/types/risk";

import { DraggablePanel } from "./DraggablePanel";

function useCountUp(value: number) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const duration = 900;
    const startTime = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startTime) / duration);
      setDisplayValue(Math.round(value * (1 - Math.pow(1 - progress, 3))));

      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [value]);

  return displayValue;
}

type StatsHUDProps = {
  stats: GlobalStats;
  sourceNote?: string;
};

export function StatsHUD({ stats, sourceNote }: StatsHUDProps) {
  const interpol = useCountUp(stats.interpolTotal);
  const cyber = useCountUp(stats.cyberIncidents);
  const cases = useCountUp(stats.activeCases);
  const highRisk = useCountUp(stats.highRiskCountries);

  return (
    <DraggablePanel
      ariaLabel="Global risk stats"
      className="hud-panel stats-panel"
      initialPosition={{ x: 950, y: 18 }}
      panelId="global-risk-stats"
    >
      <div className="defcon">
        <div>
          <p className="hud-title text-sm">GLOBAL DEFCON</p>
          <p className="data-font text-[10px] uppercase text-[#7a8da0]">{sourceNote ?? "Live cache"}</p>
        </div>
        <div className="defcon-number">{stats.defcon}</div>
      </div>
      <div className="stat-grid">
        <div className="stat-cell">
          <p className="stat-label">Interpol</p>
          <p className="stat-value">{formatCompactNumber(interpol)}</p>
        </div>
        <div className="stat-cell">
          <p className="stat-label">Cyber</p>
          <p className="stat-value text-[#00d4ff]">{formatCompactNumber(cyber)}</p>
        </div>
        <div className="stat-cell">
          <p className="stat-label">Outbreak Reports</p>
          <p className="stat-value">{formatCompactNumber(cases)}</p>
        </div>
        <div className="stat-cell">
          <p className="stat-label">High Risk</p>
          <p className="stat-value">{highRisk}</p>
        </div>
        <div className="stat-cell">
          <p className="stat-label">Status</p>
          <p className="stat-value">{stats.defcon <= 2 ? "RED" : "WATCH"}</p>
        </div>
      </div>
    </DraggablePanel>
  );
}
