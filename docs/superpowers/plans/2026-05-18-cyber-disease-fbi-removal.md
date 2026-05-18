# Cyber Disease FBI Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove FBI overlays, expose fresher disease feed metadata, and add a real public cyber incident layer using GDELT reported cyber events plus CISA KEV exploited vulnerabilities.

**Architecture:** Keep the existing Next.js route-handler proxy pattern. Add a `/api/cyber` route that normalizes GDELT article records into country-counted cyber incidents and combines them with CISA KEV records for the ticker. Replace FBI client state, markers, and ticker inputs with cyber data.

**Tech Stack:** Next.js App Router route handlers, TypeScript, Leaflet/react-leaflet overlays, Vitest, Playwright.

---

### Task 1: Tests First

**Files:**
- Modify: `src/lib/normalizers.test.ts`
- Modify: `e2e/danger-map.spec.ts`

- [x] Add tests for `normalizeCyberFeed` so GDELT articles count by source country and CISA KEV entries become ticker-ready records.
- [x] Update Playwright expectations so "FBI Overlay" is absent, "Cyber Attacks" is present, cyber markers render, and the ticker contains cyber items.
- [x] Run `npm test -- src/lib/normalizers.test.ts` and `npm run test:e2e`; expected result before implementation is failure.

### Task 2: Cyber Data Model And Route

**Files:**
- Modify: `src/types/risk.ts`
- Modify: `src/lib/normalizers.ts`
- Modify: `src/lib/fallbackData.ts`
- Create: `src/app/api/cyber/route.ts`

- [x] Add `CyberIncident`, `CyberVulnerability`, and `CyberFeed` types.
- [x] Implement `normalizeCyberFeed(rawArticles, rawKev, countries)` using existing country normalization helpers.
- [x] Add fallback cyber incidents and vulnerabilities.
- [x] Add `/api/cyber` with 10 minute revalidation and server-side fetches for GDELT DOC 2.0 and CISA KEV JSON.

### Task 3: Remove FBI And Wire Cyber UI

**Files:**
- Modify: `src/components/DangerMap.tsx`
- Modify: `src/components/LayerTogglePanel.tsx`
- Modify: `src/components/ThreatTicker.tsx`
- Modify: `src/components/StatsHUD.tsx`
- Modify: `src/components/IntelCard.tsx`
- Modify: `src/app/globals.css`
- Delete: `src/app/api/fbi/route.ts`

- [x] Replace FBI layer key with `cyber`.
- [x] Remove FBI fetch state and marker rendering.
- [x] Add cyber pulsing markers at country centers and a cyber count in the country dossier.
- [x] Change ticker inputs from FBI+Interpol to Cyber+Interpol.
- [x] Add cyber global stat and source note including disease last-updated text.
- [x] Delete the unused FBI route.

### Task 4: Verification And Release

**Files:**
- Verify all changed code.

- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.
- [x] Run `npm run test:e2e`.
- [x] Run `npm audit --audit-level=moderate`.
- [ ] Commit, push to `main`, deploy with `npx vercel@latest --prod --yes`, and smoke test the live alias.
