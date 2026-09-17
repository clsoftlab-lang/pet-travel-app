// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
//
// app.js — bootstrap, hash router, navigation, theme. 윗마이펫 (With My Pet).

import { loadData } from "./js/data.js";
import { state, subscribe, setTheme, resetDemo, cartCount, storageAvailable } from "./js/state.js";
import { icon } from "./js/svg.js";
import { toast } from "./js/ui.js";
import {
  go, renderHome, renderPlaces, renderPlaceDetail, renderMap, renderCommunity,
  renderTrips, renderGear, renderProfile, renderEmergency, renderChecklist, renderAI,
} from "./js/views.js";

const app = document.getElementById("app");

const NAV = [
  { path: "/", label: "홈", ic: "home" },
  { path: "/places", label: "탐색", ic: "search" },
  { path: "/map", label: "지도", ic: "map" },
  { path: "/trips", label: "코스", ic: "route" },
  { path: "/gear", label: "용품", ic: "cart" },
];

// ---- theme ----
function applyTheme() {
  const t = state.theme;
  if (t === "auto") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", t);
  const btn = document.getElementById("theme-btn");
  if (btn) btn.innerHTML = t === "dark" ? icon("sun") : icon("moon");
}
function cycleTheme() {
  const order = { auto: "light", light: "dark", dark: "auto" };
  setTheme(order[state.theme] || "light");
}

// ---- router ----
function parseHash() {
  const raw = (location.hash || "#/").replace(/^#/, "");
  const parts = raw.split("/").filter(Boolean); // ["place","p01"]
  return { seg: parts, path: "/" + parts.join("/") };
}

function route() {
  const { seg } = parseHash();
  window.scrollTo(0, 0);
  const key = seg[0] || "";
  try {
    switch (key) {
      case "": renderHome(app); break;
      case "places": renderPlaces(app); break;
      case "place": renderPlaceDetail(app, seg[1]); break;
      case "map": renderMap(app); break;
      case "community": renderCommunity(app); break;
      case "trips": renderTrips(app, seg[1]); break;
      case "gear": renderGear(app); break;
      case "profile": renderProfile(app); break;
      case "emergency": renderEmergency(app); break;
      case "checklist": renderChecklist(app); break;
      case "ai": renderAI(app); break;
      default: renderHome(app);
    }
  } catch (e) {
    console.error("[route] render error", e);
    app.innerHTML = `<div class="empty big">화면을 표시하는 중 문제가 발생했어요.<br>
      <button class="btn primary" data-goto="/">홈으로</button></div>`;
  }
  updateNavActive(key);
}

function updateNavActive(key) {
  document.querySelectorAll(".tab").forEach((t) => {
    const p = t.dataset.path.replace(/^\//, "");
    t.classList.toggle("active", p === key || (key === "" && p === ""));
  });
  const badge = document.getElementById("nav-cart-badge");
  if (badge) { badge.textContent = cartCount(); badge.style.display = cartCount() ? "" : "none"; }
}

// ---- chrome (topbar + tabbar) ----
function buildChrome() {
  const topbar = document.getElementById("topbar");
  topbar.innerHTML = `
    <button class="brand" data-goto="/">${icon("paw")}<span>윗마이펫</span></button>
    <div class="top-actions">
      <button class="icon-btn" data-goto="/ai" aria-label="AI 여행 도우미">${icon("spark")}</button>
      <button class="icon-btn" data-goto="/emergency" aria-label="응급 병원">${icon("cross")}</button>
      <button class="icon-btn" data-goto="/community" aria-label="커뮤니티">${icon("paw")}</button>
      <button class="icon-btn" data-goto="/checklist" aria-label="체크리스트">${icon("check")}</button>
      <button class="icon-btn" data-goto="/profile" aria-label="프로필">${icon("paw")}</button>
      <button class="icon-btn" id="theme-btn" aria-label="테마 전환">${icon("moon")}</button>
      <button class="icon-btn" id="reset-btn" aria-label="데모 초기화">${icon("trash")}</button>
    </div>`;
  const tabbar = document.getElementById("tabbar");
  tabbar.innerHTML = NAV.map((n) => `
    <button class="tab" data-path="${n.path}" data-goto="${n.path}">
      <span class="tab-ic">${icon(n.ic)}${n.path === "/gear" ? '<span class="nav-badge" id="nav-cart-badge"></span>' : ""}</span>
      <span>${n.label}</span>
    </button>`).join("");

  document.getElementById("theme-btn").addEventListener("click", cycleTheme);
  document.getElementById("reset-btn").addEventListener("click", () => {
    if (confirm("데모 데이터(프로필·코스·후기·장바구니·찜)를 모두 초기화할까요?")) {
      resetDemo();
      toast("데모 데이터를 초기화했어요");
      go("/");
      route();
    }
  });
}

// ---- global delegated navigation ----
function bindGlobal() {
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-goto]");
    if (el) { e.preventDefault(); go(el.dataset.goto); return; }
    const wish = e.target.closest("[data-wish]");
    if (wish) {
      e.preventDefault(); e.stopPropagation();
      import("./js/state.js").then((m) => {
        const on = m.toggleWish(wish.dataset.wish);
        wish.classList.toggle("on", on);
        toast(on ? "찜했어요 ❤" : "찜을 해제했어요");
      });
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const el = e.target.closest("[data-goto]");
      if (el && el.getAttribute("role") === "link") { e.preventDefault(); go(el.dataset.goto); }
    }
  });
  window.addEventListener("hashchange", route);
  subscribe(() => { applyTheme(); updateNavActive(parseHash().seg[0] || ""); });
}

// ---- boot ----
async function boot() {
  buildChrome();
  bindGlobal();
  applyTheme();
  app.innerHTML = `<div class="loading">불러오는 중… 🐾</div>`;
  try {
    const data = await loadData();
    state.places = data.places;
    state.gear = data.gear;
    state.meta = data.meta;
  } catch (e) {
    console.error("[boot] data load failed", e);
    app.innerHTML = `<div class="empty big">데이터를 불러오지 못했어요.<br>
      <span class="muted small">로컬 서버(예: <code>python -m http.server</code>)로 실행했는지 확인해주세요.</span></div>`;
    return;
  }
  if (!storageAvailable) {
    toast("저장소를 사용할 수 없어 이번 세션에서만 데이터가 유지돼요", "warn");
  }
  route();
}

boot();
