# 윗마이펫 · With My Pet 🐾

A **pet-friendly travel app** for finding places that welcome your pet — lodging, restaurants, cafés, parks, and animal hospitals — with a community, trip planner, and pet-travel gear shop. Fully working **static SPA** (no build step) that runs entirely in the browser in demo mode.

**한국어 문서: [README.ko.md](README.ko.md)**

## 🔴 LIVE DEMO

**https://clsoftlab-lang.github.io/pet-travel-app/**

## What it is

윗마이펫 (With My Pet) helps pet owners plan travel with their animals. Discover 40+ (fictional) Korean pet-friendly places, filter by region / category / pet size / amenities, read the pet policy and reviews, save spots into your own trip course, write community reviews, build a pet profile, and shop for travel gear with a mock cart. It runs as a no-build, dependency-free single-page app.

## Features

- **Place discovery** — search + filter by region, category (숙소/식당/카페/공원/병원), allowed pet size (소/중/대형견), and amenities (울타리·주차·수영장·놀이터·펫 샤워장 …); sort by rating / reviews / name / price.
- **Place detail** — pet policy, hours, allowed sizes, amenities, schematic location, and reviews.
- **Map view** — a schematic region map (inline SVG) of Korea; tap a region to list its places. No external map keys.
- **Community** — browse and post reviews with a star rating and placeholder photo.
- **Pet profile** — name, breed, size, and a one-line bio, with a generated avatar.
- **Trip course builder** — add places to a named course, reorder steps, and remove them.
- **Gear catalog + cart** — 20+ travel items, category filter, search, mock cart with quantities and mock checkout.
- **Wishlist (찜)** — save favorite places, shown on your profile.
- **Extras** — pre-trip **동반 체크리스트** with progress, and **응급 동물병원 빠른찾기** (24h emergency vet quick-find with tap-to-call).
- Light + dark theme, responsive mobile-first UI, localStorage persistence with a one-tap reset.

## 🟡 DEMO-MODE boundaries (please read)

This is a demonstration front-end. In **BOLD**:

- **All places, gear, and prices are fictional seed data** loaded from `data/*.json` — no real businesses.
- **The map is a schematic SVG layout, not a real/interactive map** and has no geographic accuracy.
- **All images are inline SVG placeholders**, not photographs.
- **Data persists only in your browser via localStorage — it is not a real database.** Clearing site data or using the in-app reset erases it. Nothing syncs anywhere.
- **There are no real accounts, no payments, no PII collection, and no real map service.** "Mock checkout" charges nothing.
- **A production build would add** a backend + real database, real maps/geolocation, authentication, real payments, and content moderation.

## Run locally

No build, no dependencies. Serve the folder over HTTP (ES modules require it):

```bash
# Python
python -m http.server 8975
# then open http://localhost:8975

# or Node
npx serve .
```

## Tech

- Plain **HTML + CSS + ES-module JavaScript**, no framework, no bundler.
- `index.html` at repo root, relative paths only, deployable to GitHub Pages as-is.
- Seed data in `data/*.json`; state persisted to `localStorage` (try/catch + memory fallback).
- Inline SVG for all art, icons, avatars, and the map.

```
index.html          app.js (router/bootstrap)     styles.css
js/  data.js storage.js state.js svg.js ui.js views.js
data/  places.json gear.json meta.json
check.mjs           .github/workflows/ci.yml
```

## CI

`node check.mjs` verifies: every `data/*.json` parses, seed counts (≥40 places, ≥20 gear), `node --check` for all JS modules, and that `index.html` has the required containers. Runs on GitHub Actions (`.github/workflows/ci.yml`).

## Contributors

- **Dr. Lee Il-guk (이일국)** — CLSOFTLAB (씨엘소프트랩)
- **LWJ**
- **LMJ**
- **Claude** (Anthropic) — pair-programming assistant

## License

- Source code: **Apache-2.0** — see [LICENSE](LICENSE).
- Documentation: **CC BY 4.0**.

SPDX headers (`Apache-2.0`) and `Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)` appear across the source.

---

*Not an official Anthropic product.*
