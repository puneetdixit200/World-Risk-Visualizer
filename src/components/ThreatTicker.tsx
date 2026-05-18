"use client";

/* eslint-disable @next/next/no-img-element */

import { ExternalLink, X } from "lucide-react";

import type { FbiEntry, InterpolNotice } from "@/types/risk";

type TickerItem =
  | {
      kind: "FBI";
      id: string;
      name: string;
      description: string;
      reward: string;
      image?: string;
      url: string;
    }
  | {
      kind: "INTERPOL";
      id: string;
      name: string;
      description: string;
      reward: string;
      url?: string;
    };

type ThreatTickerProps = {
  fbi: FbiEntry[];
  interpol: InterpolNotice[];
  selected?: TickerItem;
  onSelect: (item: TickerItem) => void;
  onClose: () => void;
};

function toTickerItems(fbi: FbiEntry[], interpol: InterpolNotice[]) {
  const fbiItems: TickerItem[] = fbi.slice(0, 18).map((entry) => ({
    kind: "FBI",
    id: entry.id,
    name: entry.name,
    description: entry.description,
    reward: entry.reward,
    image: entry.image,
    url: entry.url,
  }));

  const interpolItems: TickerItem[] = interpol.slice(0, 18).map((notice) => ({
    kind: "INTERPOL",
    id: notice.id,
    name: notice.name,
    description: notice.charges,
    reward: notice.nationalities.join(", ") || "Nationality unknown",
    url: notice.url,
  }));

  return [...fbiItems, ...interpolItems];
}

export function ThreatTicker({ fbi, interpol, selected, onSelect, onClose }: ThreatTickerProps) {
  const items = toTickerItems(fbi, interpol);
  const marqueeItems = items.length ? [...items, ...items] : [];

  return (
    <>
      <footer className="ticker" aria-label="Threat ticker">
        <div className="ticker-track">
          {marqueeItems.map((item, index) => (
            <button className="ticker-item" type="button" key={`${item.kind}-${item.id}-${index}`} onClick={() => onSelect(item)}>
              <span className="ticker-source">{item.kind}</span>
              <span>{item.name}</span>
              <span className="text-[#7a8da0]">{item.reward}</span>
            </button>
          ))}
        </div>
      </footer>

      {selected ? (
        <section className="ticker-modal" aria-label="Threat detail">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="hud-title text-xs">{selected.kind} NOTICE</p>
              <h2 className="text-lg font-semibold">{selected.name}</h2>
            </div>
            <button type="button" className="icon-button" onClick={onClose} aria-label="Close threat detail">
              <X size={17} />
            </button>
          </div>
          {"image" in selected && selected.image ? (
            <img className="ticker-image" src={selected.image} alt={selected.name} />
          ) : null}
          <p className="text-sm text-[#d8e4ee]">{selected.description}</p>
          <p className="data-font mt-3 text-xs uppercase text-[#ff8c00]">{selected.reward}</p>
          {selected.url ? (
            <a className="mt-4 inline-flex items-center gap-2 text-sm text-[#00d4ff]" href={selected.url} target="_blank" rel="noreferrer">
              Open source record <ExternalLink size={14} />
            </a>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
