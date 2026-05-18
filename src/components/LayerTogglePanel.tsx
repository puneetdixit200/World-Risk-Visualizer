"use client";

import type { ComponentType } from "react";
import { Biohazard, Eye, Network, RadioTower, ShieldAlert, Skull, Users } from "lucide-react";

import type { LayerKey, LayerState } from "@/types/risk";

import { DraggablePanel } from "./DraggablePanel";

const layerConfig: { key: LayerKey; label: string; icon: ComponentType<{ size?: number }> }[] = [
  { key: "threat", label: "Threat Level", icon: ShieldAlert },
  { key: "disease", label: "Disease Spread", icon: Biohazard },
  { key: "interpol", label: "Interpol Notices", icon: RadioTower },
  { key: "fbi", label: "FBI Overlay", icon: Skull },
  { key: "density", label: "Population Density", icon: Users },
  { key: "corridors", label: "Threat Corridors", icon: Network },
];

type LayerTogglePanelProps = {
  layers: LayerState;
  nightVision: boolean;
  onToggle: (key: LayerKey) => void;
  onNightVisionToggle: () => void;
};

export function LayerTogglePanel({ layers, nightVision, onToggle, onNightVisionToggle }: LayerTogglePanelProps) {
  return (
    <DraggablePanel
      ariaLabel="Layer controls"
      className="hud-panel layer-panel"
      initialPosition={{ x: 18, y: 18 }}
      panelId="layer-controls"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="hud-title text-sm">DANGER MAP</p>
          <p className="data-font text-[10px] uppercase text-[#7a8da0]">Layer Matrix</p>
        </div>
        <button
          className={`icon-button ${nightVision ? "text-[#00ff88]" : ""}`}
          type="button"
          title="Night vision"
          aria-label="Toggle night vision"
          onClick={onNightVisionToggle}
        >
          <Eye size={17} />
        </button>
      </div>

      {layerConfig.map(({ key, label, icon: Icon }) => (
        <button className="layer-row" key={key} type="button" onClick={() => onToggle(key)}>
          <Icon size={17} />
          <span className="layer-label">{label}</span>
          <span className={`switch ${layers[key] ? "active" : ""}`} aria-hidden="true">
            <span />
          </span>
        </button>
      ))}
    </DraggablePanel>
  );
}
