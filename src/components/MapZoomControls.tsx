"use client";

import type { RefObject } from "react";
import type L from "leaflet";
import { Minus, Plus, Volume2, VolumeX } from "lucide-react";

type MapZoomControlsProps = {
  mapRef: RefObject<L.Map | null>;
  soundEnabled: boolean;
  onSoundToggle: () => void;
};

export function MapZoomControls({ mapRef, onSoundToggle, soundEnabled }: MapZoomControlsProps) {
  return (
    <nav className="top-zoom-controls" aria-label="Map zoom controls">
      <button type="button" aria-label="Zoom in" title="Zoom in" onClick={() => mapRef.current?.zoomIn()}>
        <Plus size={18} />
      </button>
      <button type="button" aria-label="Zoom out" title="Zoom out" onClick={() => mapRef.current?.zoomOut()}>
        <Minus size={18} />
      </button>
      <button
        type="button"
        aria-label="Toggle immersive sound"
        title="Toggle immersive sound"
        onClick={onSoundToggle}
        className={soundEnabled ? "active" : ""}
      >
        {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
      </button>
    </nav>
  );
}
