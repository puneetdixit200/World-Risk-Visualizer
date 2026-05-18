"use client";

import { Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { filterCommandPaletteItems, type CommandPaletteItem } from "@/lib/commandCenter";

type CommandPaletteProps = {
  items: CommandPaletteItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (item: CommandPaletteItem) => void;
};

export function CommandPalette({ items, open, onOpenChange, onSelect }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const visibleItems = useMemo(() => filterCommandPaletteItems(items, query), [items, query]);

  useEffect(() => {
    if (open) {
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(!open);
        return;
      }

      if (!isTyping && event.key === "/") {
        event.preventDefault();
        onOpenChange(true);
      }

      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onOpenChange, open]);

  if (!open) {
    return (
      <button className="command-launcher" type="button" onClick={() => onOpenChange(true)} aria-label="Open command search">
        <Search size={16} />
        <span>Search</span>
      </button>
    );
  }

  return (
    <section className="command-palette" aria-label="Threat search command palette">
      <div className="command-search-row">
        <Search size={17} />
        <input
          ref={inputRef}
          aria-label="Search countries, IPs, CVEs, outbreaks, and notices"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search country, IP, CVE, disease, notice..."
        />
        <button type="button" className="icon-button" onClick={() => onOpenChange(false)} aria-label="Close command search">
          <X size={16} />
        </button>
      </div>
      <div className="command-result-list">
        {visibleItems.map((item) => (
          <button
            type="button"
            className="command-result"
            key={item.id}
            onClick={() => {
              onSelect(item);
              setQuery("");
              onOpenChange(false);
            }}
          >
            <span>{item.label}</span>
            <span>{item.detail}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
