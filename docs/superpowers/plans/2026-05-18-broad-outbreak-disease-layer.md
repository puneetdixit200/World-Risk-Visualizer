# Broad Outbreak Disease Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the COVID-only disease layer with a broader outbreak layer using WHO Disease Outbreak News and GDELT reported outbreak signals.

**Architecture:** Preserve the existing `/api/disease` response shape so map components keep working, but normalize WHO/GDELT outbreak reports into `DiseaseRecord` objects keyed by ISO3 country code. Keep GDELT as a secondary signal and fall back to seeded non-COVID outbreak data if upstreams are slow or unmappable.

**Tech Stack:** Next.js App Router route handlers, TypeScript normalizers, Leaflet/react-leaflet markers, Vitest, Playwright.

---

### Task 1: Tests First

**Files:**
- Modify: `src/lib/normalizers.test.ts`
- Modify: `e2e/danger-map.spec.ts`

- [x] Add a failing test for `normalizeOutbreakDisease` using WHO Ebola and GDELT dengue records mapped to real countries.
- [x] Update browser expectations from COVID/active-case wording to outbreak-report wording.

### Task 2: Normalizer And Types

**Files:**
- Modify: `src/types/risk.ts`
- Modify: `src/lib/normalizers.ts`
- Modify: `src/lib/geoUtils.ts`
- Modify: `src/lib/riskCalculator.ts`

- [x] Add outbreak metadata fields to `DiseaseRecord`.
- [x] Implement `normalizeOutbreakDisease`.
- [x] Add an outbreak-specific marker radius helper.
- [x] Make disease risk scoring work with small report counts as well as large case counts.

### Task 3: API And Fallback

**Files:**
- Modify: `src/app/api/disease/route.ts`
- Modify: `src/app/api/cyber/route.ts`
- Modify: `src/lib/fallbackData.ts`
- Add: `src/lib/serverJson.ts`

- [x] Replace disease.sh COVID fetches with WHO Disease Outbreak News and GDELT outbreak queries.
- [x] Add request timeouts and fallback for slow/noisy upstreams.
- [x] Replace COVID fallback records with non-COVID outbreak fallback records.
- [x] Harden GDELT JSON fetches so cached route handlers do not emit noisy Next fetch failures when GDELT is slow.

### Task 4: UI Text

**Files:**
- Modify: `src/components/DangerMap.tsx`
- Modify: `src/components/IntelCard.tsx`
- Modify: `src/components/LayerTogglePanel.tsx`
- Modify: `src/components/StatsHUD.tsx`
- Modify: `src/components/Sparkline.tsx`

- [x] Show outbreak reports and disease names in popups and country dossier.
- [x] Rename the toggle to "Outbreak Watch".
- [x] Keep the time slider functional as a report timeline.

### Task 5: Verification And Release

**Files:**
- Verify all changed code.

- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.
- [x] Run `npm run test:e2e`.
- [x] Run `npm audit --audit-level=moderate`.
- [ ] Commit, push, deploy to Vercel, and live smoke test the outbreak layer.
