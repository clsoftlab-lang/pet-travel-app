// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
//
// svg.js — inline SVG placeholder art + UI icons (no binary images).

// Deterministic hue from an id string so each place/gear keeps a stable color.
function hashHue(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
  return h;
}

const CATEGORY_GLYPH = {
  "숙소": "M8 30 L8 16 L24 6 L40 16 L40 30 Z M14 30 L14 22 L22 22 L22 30",
  "식당": "M14 6 L14 20 M18 6 L18 20 M16 20 L16 40 M30 6 C26 8 26 18 30 20 L30 40",
  "카페": "M12 16 L34 16 L32 30 C31 34 28 36 23 36 C18 36 15 34 14 30 Z M34 20 L40 20 L40 26 L35 26",
  "공원": "M24 8 C16 8 12 16 16 22 C10 22 8 30 16 32 L32 32 C40 30 38 22 32 22 C36 16 32 8 24 8 M24 32 L24 40",
  "병원": "M20 8 L28 8 L28 18 L38 18 L38 26 L28 26 L28 40 L20 40 L20 26 L10 26 L10 18 L20 18 Z",
};

// Placeholder "photo" for a place: gradient panel + category glyph + paw.
export function placeImage(place, opts = {}) {
  const hue = hashHue(place.id);
  const h2 = (hue + 40) % 360;
  const w = opts.w || 400;
  const h = opts.h || 240;
  const gid = "pg_" + place.id;
  return `
  <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" role="img"
       aria-label="${escapeAttr(place.name)} 이미지 (예시)" class="ph-img">
    <defs>
      <linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="hsl(${hue} 70% 66%)"/>
        <stop offset="1" stop-color="hsl(${h2} 68% 52%)"/>
      </linearGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#${gid})"/>
    <g transform="translate(${w / 2 - 24} ${h / 2 - 30}) scale(1.1)" fill="none"
       stroke="rgba(255,255,255,0.92)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <path d="${CATEGORY_GLYPH[place.category] || CATEGORY_GLYPH["공원"]}"/>
    </g>
    ${pawMark(w - 42, h - 40, "rgba(255,255,255,0.85)")}
    <rect x="12" y="12" rx="8" width="70" height="26" fill="rgba(0,0,0,0.28)"/>
    <text x="47" y="30" text-anchor="middle" font-size="14" fill="#fff"
      font-family="system-ui, sans-serif">${escapeText(place.category)}</text>
  </svg>`;
}

export function gearImage(item, opts = {}) {
  const hue = hashHue(item.id);
  const w = opts.w || 300;
  const h = opts.h || 220;
  const gid = "gg_" + item.id;
  return `
  <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" role="img"
       aria-label="${escapeAttr(item.name)} 이미지 (예시)" class="ph-img">
    <defs>
      <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="hsl(${hue} 45% 92%)"/>
        <stop offset="1" stop-color="hsl(${hue} 40% 80%)"/>
      </linearGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#${gid})"/>
    <rect x="${w / 2 - 46}" y="${h / 2 - 46}" rx="16" width="92" height="92"
      fill="hsl(${hue} 55% 55%)" opacity="0.92"/>
    ${pawMark(w / 2 - 22, h / 2 - 22, "#fff", 1.4)}
  </svg>`;
}

// Simple paw mark
function pawMark(x, y, color, scale = 1) {
  return `<g transform="translate(${x} ${y}) scale(${scale})" fill="${color}">
    <ellipse cx="8" cy="16" rx="6" ry="8"/>
    <circle cx="2" cy="6" r="3.2"/>
    <circle cx="9" cy="3" r="3.2"/>
    <circle cx="16" cy="6" r="3.2"/>
  </g>`;
}

// Small avatar for a pet profile (colored circle + paw + initial)
export function petAvatar(name, size = 64) {
  const hue = hashHue(name || "pet");
  const initial = escapeText((name || "?").trim().charAt(0) || "?");
  return `
  <svg viewBox="0 0 64 64" width="${size}" height="${size}" role="img" aria-label="반려동물 아바타">
    <circle cx="32" cy="32" r="32" fill="hsl(${hue} 60% 60%)"/>
    <text x="32" y="40" text-anchor="middle" font-size="26" fill="#fff"
      font-family="system-ui, sans-serif" font-weight="700">${initial}</text>
  </svg>`;
}

// Inline UI icons
const ICONS = {
  home: "M4 11 L12 4 L20 11 M6 10 V20 H18 V10",
  search: "M11 4 a7 7 0 1 0 0.01 0 M16 16 L21 21",
  map: "M9 4 L3 6 V20 L9 18 L15 20 L21 18 V4 L15 6 Z M9 4 V18 M15 6 V20",
  gear: "M6 5 H18 L20 9 H4 Z M5 9 V20 H19 V9 M9 13 H15",
  paw: "M12 14 c-3 0-5 2-5 4 c0 2 2 2 5 2 c3 0 5 0 5-2 c0-2-2-4-5-4 M6 8 a2 2 0 1 0 0.1 0 M18 8 a2 2 0 1 0 0.1 0 M9 5 a1.7 1.7 0 1 0 0.1 0 M15 5 a1.7 1.7 0 1 0 0.1 0",
  heart: "M12 21 C12 21 4 14 4 8.5 C4 5.5 6.5 4 9 5 C10.5 5.6 12 7 12 7 C12 7 13.5 5.6 15 5 C17.5 4 20 5.5 20 8.5 C20 14 12 21 12 21 Z",
  route: "M6 19 a2 2 0 1 0 0.1 0 M18 5 a2 2 0 1 0 0.1 0 M8 19 H14 a4 4 0 0 0 0-8 H10 a4 4 0 0 1 0-8 H16",
  cross: "M10 4 H14 V10 H20 V14 H14 V20 H10 V14 H4 V10 H10 Z",
  star: "M12 3 L14.7 9 L21 9.7 L16.5 14 L17.8 20.3 L12 17 L6.2 20.3 L7.5 14 L3 9.7 L9.3 9 Z",
  plus: "M12 5 V19 M5 12 H19",
  cart: "M4 5 H6 L8 16 H18 L20 8 H7 M9 20 a1 1 0 1 0 0.1 0 M17 20 a1 1 0 1 0 0.1 0",
  check: "M5 12 L10 17 L19 6",
  back: "M15 5 L8 12 L15 19",
  sun: "M12 6 V3 M12 21 V18 M6 12 H3 M21 12 H18 M7 7 L5 5 M17 7 L19 5 M7 17 L5 19 M17 17 L19 19 M12 8 a4 4 0 1 0 0.1 0",
  moon: "M20 14 A8 8 0 1 1 10 4 a6 6 0 0 0 10 10 Z",
  camera: "M4 8 H8 L10 5 H14 L16 8 H20 V19 H4 Z M12 12 a3 3 0 1 0 0.1 0",
  filter: "M4 6 H20 M7 12 H17 M10 18 H14",
  trash: "M6 7 H18 M9 7 V5 H15 V7 M8 7 V20 H16 V7",
  close: "M6 6 L18 18 M18 6 L6 18",
  phone: "M5 4 H9 L11 9 L8 11 C9 14 10 15 13 16 L15 13 L20 15 V19 C20 20 19 20 18 20 C10 20 4 14 4 6 C4 5 4 4 5 4 Z",
};

export function icon(name, cls = "") {
  const d = ICONS[name] || ICONS.paw;
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="${d}"/></svg>`;
}

// ---- helpers ----
export function escapeText(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
export function escapeAttr(s) {
  return escapeText(s).replace(/"/g, "&quot;");
}
