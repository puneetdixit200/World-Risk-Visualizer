# Danger Map

World Risk Visualizer is a full-screen command-center map built with Next.js, Leaflet, and live public data feeds.

## Features

- Dark CartoDB Leaflet world map with Natural Earth country polygons from `world-atlas`.
- Toggleable threat, disease, Interpol, FBI, density, and threat-corridor layers.
- Country hover dossier with flag, population, density, disease trend sparkline, Interpol count, adjacent borders, and computed risk score.
- Disease time slider, DEFCON HUD, bottom threat ticker, night-vision mode, red-alert mode, satellite zoom flash, and two-country comparison mode.
- Cached Next.js route handlers for REST Countries, disease.sh, FBI Wanted, and Interpol Red Notices.
- Resilient fallback data for upstream failures or Interpol access blocking.

## Data Sources

- REST Countries: `https://restcountries.com/v3.1/all`
- disease.sh: `https://disease.sh/v3/covid-19/countries`
- disease.sh historical: `https://disease.sh/v3/covid-19/historical?lastdays=30`
- FBI Wanted: `https://api.fbi.gov/wanted/v1/list`
- Interpol Red Notices: `https://ws-public.interpol.int/notices/v1/red`

No environment variables or API keys are required.

## Development

```bash
npm install
npm run dev
```

If port `3000` is occupied, run:

```bash
npm run dev -- --hostname 127.0.0.1 --port 3137
```

## Verification

```bash
npm test
npm run lint
npm run build
npm run test:e2e
npm audit --audit-level=moderate
```

The e2e test starts the dev server on `127.0.0.1:3137` and verifies the map, HUD, ticker, layer toggle, and intel-card interaction in Chromium.

## Deploy

This is a zero-config Vercel app:

```bash
npx vercel --prod
```
