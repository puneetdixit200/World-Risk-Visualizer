"use client";

import { ExternalLink, X } from "lucide-react";

import type { CyberFeed, InterpolNotice } from "@/types/risk";

type TickerItem =
  | {
      kind: "CYBER";
      id: string;
      name: string;
      description: string;
      meta: string;
      url?: string;
    }
  | {
      kind: "CISA KEV";
      id: string;
      name: string;
      description: string;
      meta: string;
      url: string;
    }
  | {
      kind: "INTERPOL";
      id: string;
      name: string;
      description: string;
      meta: string;
      url?: string;
    };

type ThreatTickerProps = {
  cyber: CyberFeed;
  interpol: InterpolNotice[];
  selected?: TickerItem;
  onSelect: (item: TickerItem) => void;
  onClose: () => void;
};

function formatTickerDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Recent";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function toTickerItems(cyber: CyberFeed, interpol: InterpolNotice[]) {
  const cyberItems: TickerItem[] = cyber.incidents.slice(0, 16).map((incident) => ({
    kind: "CYBER",
    id: incident.id,
    name: incident.title,
    description: `${incident.country} | ${incident.source}`,
    meta: formatTickerDate(incident.seenAt),
    url: incident.url,
  }));

  const kevItems: TickerItem[] = cyber.vulnerabilities.slice(0, 10).map((vulnerability) => ({
    kind: "CISA KEV",
    id: vulnerability.id,
    name: vulnerability.cve,
    description: `${vulnerability.vendor} ${vulnerability.product}: ${vulnerability.name}`,
    meta: vulnerability.ransomware === "Known" ? "Ransomware-linked" : vulnerability.dateAdded,
    url: vulnerability.url,
  }));

  const interpolItems: TickerItem[] = interpol.slice(0, 18).map((notice) => ({
    kind: "INTERPOL",
    id: notice.id,
    name: notice.name,
    description: notice.charges,
    meta: notice.nationalities.join(", ") || "Nationality unknown",
    url: notice.url,
  }));

  return [...cyberItems, ...kevItems, ...interpolItems];
}

export function ThreatTicker({ cyber, interpol, selected, onSelect, onClose }: ThreatTickerProps) {
  const items = toTickerItems(cyber, interpol);
  const marqueeItems = items.length ? [...items, ...items] : [];

  return (
    <>
      <footer className="ticker" aria-label="Threat ticker">
        <div className="ticker-track">
          {marqueeItems.map((item, index) => (
            <button className="ticker-item" type="button" key={`${item.kind}-${item.id}-${index}`} onClick={() => onSelect(item)}>
              <span className="ticker-source">{item.kind}</span>
              <span>{item.name}</span>
              <span className="text-[#7a8da0]">{item.meta}</span>
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
          <p className="text-sm text-[#d8e4ee]">{selected.description}</p>
          <p className="data-font mt-3 text-xs uppercase text-[#ff8c00]">{selected.meta}</p>
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
