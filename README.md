# RiskMap Analyzer

RiskMap Analyzer is a full-screen command-center map built with Next.js, Leaflet, and live public data feeds.

## Screenshot

![Made with Puneet Dixit signature badge](docs/screenshots/signature-badge.png)

## Features

- Dark CartoDB Leaflet world map with Natural Earth country polygons from `world-atlas`.
- Toggleable threat, outbreak, Interpol, cyber, density, and threat-corridor layers.
- Live cyber attack sources, attack arcs, heat trails, replay controls, and a bottom threat ticker.
- Country dossier with flag, population, density, outbreak sparkline, cyber/Interpol counts, adjacent borders, lockdown simulator, and computed risk score.
- DEFCON HUD, source confidence badges, command search palette, night-vision mode, red-alert mode, satellite zoom flash, and two-country risk battle mode.
- Cached Next.js route handlers for REST Countries, WHO outbreak reports, GDELT, SANS ISC/DShield, CISA KEV, and Interpol Red Notices.
- Resilient fallback data for upstream failures or Interpol access blocking.
- Bottom-right signature badge linking to Puneet Dixit's GitHub profile.

## Data Sources

- REST Countries: `https://restcountries.com/v3.1/all`
- WHO Disease Outbreak News: `https://www.who.int/api/hubs/diseaseoutbreaknews`
- GDELT DOC API: `https://api.gdeltproject.org/api/v2/doc/doc`
- SANS ISC/DShield: `https://www.dshield.org/data/`
- CISA KEV: `https://www.cisa.gov/known-exploited-vulnerabilities-catalog`
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
