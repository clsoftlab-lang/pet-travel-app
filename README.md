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

## 🤖 AI 기능 (API 연동)

The app ships with a **pluggable AI layer** and three features, wired into the **AI 여행 도우미** screen (`#/ai`, ✨ icon in the top bar):

1. **AI 반려동물 여행 플래너 챗봇** — pick region / pet size / dates, then ask for a pet-friendly itinerary built from the app's own places.
2. **여행 코스 자동 생성** — auto-build a day-by-day trip course and save it straight into *내 여행 코스*.
3. **동반 준비물 체크리스트 생성** — generate a packing checklist tuned to the trip (season, size, notes) and recommended gear.

**In the demo, AI runs on a deterministic offline Korean MockProvider** that reuses `data/*.json` — no network, no key, works on GitHub Pages.

**To enable real Claude:**

1. `cd server && npm install`
2. `cp .env.example .env` and set **`ANTHROPIC_API_KEY`** (cost-first default model `claude-haiku-4-5`, configurable via `AI_MODEL`)
3. `npm start` (defaults to `http://localhost:8787`)
4. set **`AI_ENDPOINT`** in `ai/config.js` to `"http://localhost:8787/api/ai"`

The browser then streams responses from `POST /api/ai`, which calls `client.messages.stream({ model: process.env.AI_MODEL || "claude-haiku-4-5", ... })`.

> **🔒 API keys are server-side only. The `ANTHROPIC_API_KEY` never appears in the browser or the repo — it lives only as a server environment variable, and the shipped `AI_ENDPOINT` is empty.** See [`server/README.md`](server/README.md).

## ⚙️ 고도화 — 무인·저비용 실 AI 연동

This build upgrades the AI layer for **무인(autonomous) · 실제 AI 연결(real Claude) · 비용 합리적(cost-efficient)** operation, while keeping every prior feature working:

- **Cost model** — cost-first default **`claude-haiku-4-5`** (~**$1 / $5 per MTok** in/out), configurable via `AI_MODEL` (raise to `claude-sonnet-5` / `claude-opus-5`). **Prompt caching** sends the stable per-task system prompt as a `cache_control:{type:'ephemeral'}` block; modest per-task `max_tokens` (~700); a **monthly token cap** (`AI_MONTHLY_TOKEN_CAP`, default 2,000,000) plus a per-IP rate limit (20/min). Haiku sends no `thinking`/effort; sonnet/opus send `thinking:{type:'adaptive'}` + `output_config:{effort}`.
- **Rough cost estimate** — a typical grounded request here is ~2–4K input + ~0.5–1K output tokens; at Haiku pricing that is on the order of **~$5–10 per 1,000 requests** (less with cache hits), versus multiples of that on opus.
- **Free one-deploy hosting** — a **Cloudflare Workers** variant (`server/worker.js` + `server/wrangler.toml`) calls the Anthropic REST API with the same rules. Deploy once on the free tier (`npx wrangler deploy` + `wrangler secret put ANTHROPIC_API_KEY`) — no server to babysit.
- **Autonomous & never-breaks** — the home screen auto-generates an **“이번 주말 반려동물 여행 추천 코스”** on load via `askAI`, and any endpoint failure / `429 {fallback:true}` / network error **auto-falls back to the offline mock**, so the app keeps working unmanned.

> **🔒 API keys are server-side only — never in the browser or repo.**

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
ai/  config.js ai.js          (pluggable AI layer — mock or proxy, auto-fallback)
server/  index.mjs worker.js wrangler.toml package.json .env.example README.md  (Node + Cloudflare Workers proxy)
check.mjs           .github/workflows/ci.yml
```

## CI

`node check.mjs` verifies: every `data/*.json` parses, seed counts (≥40 places, ≥20 gear), `node --check` for all JS modules (including `ai/` and `server/`), that `index.html` has the required containers, that `ai/config.js`'s `AI_ENDPOINT` ships empty, and that no real `sk-ant-*` key is committed. Runs on GitHub Actions (`.github/workflows/ci.yml`).

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

## 🎓 Idea origin

The seed idea for this project came from the **entrepreneurship class taught by Dr. Lee Il-guk (이일국) at Yongin University (용인대학교)**. The students in that class produced startup ideas of remarkable, standout creativity — this project is one of those exceptional ideas, finally brought to life as a working service. Built with deep admiration and gratitude for those students' imagination. *(No student personal information is included; only the idea itself was used, implemented clean-room.)*
