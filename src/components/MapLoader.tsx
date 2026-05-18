"use client";

import dynamic from "next/dynamic";

const DangerMap = dynamic(() => import("./DangerMap").then((module) => module.DangerMap), {
  ssr: false,
  loading: () => (
    <main className="danger-shell">
      <div className="loading-panel">
        <p className="hud-title text-sm">RISKMAP ANALYZER</p>
        <h1 className="mt-2 text-2xl font-semibold">Booting global risk feed</h1>
        <p className="mt-3 text-sm text-[#7a8da0]">Loading map engine, command layers, and cached threat data.</p>
      </div>
    </main>
  ),
});

export default function MapLoader() {
  return <DangerMap />;
}
