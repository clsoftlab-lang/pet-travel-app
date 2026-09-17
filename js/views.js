// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
//
// views.js — route render functions for the 윗마이펫 (With My Pet) SPA.

import {
  state, subscribe, setProfile, isWished, toggleWish,
  createTrip, deleteTrip, renameTrip, addPlaceToTrip, removePlaceFromTrip,
  reorderTripPlace, addReview, getReviews, allReviews,
  addToCart, setCartQty, cartCount, clearCart, toggleCheck,
} from "./state.js";
import { placeImage, gearImage, petAvatar, icon, escapeText, escapeAttr } from "./svg.js";
import { h, won, stars, toast, modal, closeModal, qs, qsa } from "./ui.js";
import { askAI, pickItinerary } from "../ai/ai.js";

export function go(path) { location.hash = "#" + path; }

// Module-level view state (not persisted): filters for explore & gear
const filters = { q: "", region: "", category: "", size: "", amenities: new Set(), sort: "rating" };
const gearFilters = { q: "", category: "" };

// ---------- shared components ----------
function amenityLabel(key) {
  const a = (state.meta.amenities || []).find((x) => x.key === key);
  return a ? a.label : key;
}

function placeCard(p) {
  const wished = isWished(p.id) ? "on" : "";
  return `
  <article class="card place-card" data-goto="/place/${p.id}" tabindex="0" role="link"
    aria-label="${escapeAttr(p.name)} 상세보기">
    <div class="card-media">${placeImage(p, { w: 400, h: 200 })}
      <button class="wish-btn ${wished}" data-wish="${p.id}" aria-label="찜하기">${icon("heart")}</button>
      <span class="chip cat-chip">${escapeText(p.category)}</span>
    </div>
    <div class="card-body">
      <h3>${escapeText(p.name)}</h3>
      <p class="muted small">${escapeText(p.region)} · ${escapeText(p.district)}</p>
      <p class="summary">${escapeText(p.summary)}</p>
      <div class="card-foot">
        <span>${stars(p.rating)} <span class="small muted">${p.rating} (${p.reviewCount})</span></span>
        <span class="sizes">${p.petSizes.map(sizeBadge).join("")}</span>
      </div>
    </div>
  </article>`;
}

function sizeBadge(sz) {
  const map = { small: "소", medium: "중", large: "대" };
  return `<span class="size-badge sz-${sz}" title="${sizeLabel(sz)} 허용">${map[sz] || sz}</span>`;
}
function sizeLabel(sz) {
  const s = (state.meta.petSizes || []).find((x) => x.key === sz);
  return s ? s.label : sz;
}

// ---------- Home ----------
export function renderHome(root) {
  const featured = [...state.places].sort((a, b) => b.rating - a.rating).slice(0, 6);
  const cats = state.meta.categories || [];
  root.innerHTML = `
    <section class="hero">
      <div class="hero-text">
        <h1>반려동물과 함께,<br>어디든 떠나요 🐾</h1>
        <p>반려동물 동반 가능한 숙소·식당·카페·공원·병원을 한 곳에서.
           지역·크기·편의시설로 딱 맞는 곳을 찾아 나만의 여행 코스를 만들어요.</p>
        <div class="hero-actions">
          <button class="btn primary" data-goto="/places">${icon("search")} 장소 탐색</button>
          <button class="btn ghost" data-goto="/map">${icon("map")} 지도 보기</button>
        </div>
      </div>
    </section>

    <section class="cat-grid">
      ${cats.map((c) => `
        <button class="cat-tile" data-cat="${escapeAttr(c.key)}" style="--tile:${c.color}">
          <span class="cat-ic">${icon(iconForCat(c.key))}</span>
          <span>${escapeText(c.key)}</span>
        </button>`).join("")}
    </section>

    <section class="cta-banner ai-banner" data-goto="/ai">
      <div>${icon("spark")}<strong>AI 여행 도우미</strong> 지역·크기·일수만 고르면 코스·준비물까지 AI가 제안해요.</div>
      <span>→</span>
    </section>

    <section class="panel weekend-pick" aria-label="이번 주말 AI 추천 코스">
      <div class="row-head">
        <h2>${icon("spark")} 이번 주말 AI 추천 코스</h2>
        <button class="linklike" data-goto="/ai">더 만들기 →</button>
      </div>
      <pre class="ai-out" id="weekend-out" aria-live="polite">추천 코스를 준비하고 있어요… 🐾</pre>
    </section>

    <section class="row-head">
      <h2>평점 높은 인기 장소</h2>
      <button class="linklike" data-goto="/places">전체 보기 →</button>
    </section>
    <div class="grid">${featured.map(placeCard).join("")}</div>

    <section class="cta-banner" data-goto="/emergency">
      <div>${icon("cross")}<strong>여행 중 응급상황?</strong> 가까운 24시 동물병원을 빠르게 찾아보세요.</div>
      <span>→</span>
    </section>
  `;
  root.querySelectorAll("[data-cat]").forEach((b) =>
    b.addEventListener("click", () => { filters.category = b.dataset.cat; go("/places"); }));

  // Autonomous (무인) on-load feature: auto-generate "이번 주말" recommendation via
  // askAI. Works offline through the mock; failures fall back silently — the rest
  // of the home screen is already rendered and unaffected.
  const weekendOut = qs("#weekend-out", root);
  if (weekendOut) {
    const top = featured[0];
    const payload = { region: top ? top.region : "", days: 2 };
    weekendOut.textContent = "";
    askAI("weekend", payload, {
      onToken: (t) => { weekendOut.textContent += t; },
    }).catch(() => {
      if (!weekendOut.textContent) weekendOut.textContent = "지금은 추천을 불러올 수 없어요. ‘AI 여행 도우미’에서 직접 만들어보세요.";
    });
  }
}

function iconForCat(key) {
  return { "숙소": "home", "식당": "paw", "카페": "paw", "공원": "paw", "병원": "cross" }[key] || "paw";
}

// ---------- Explore / Places ----------
export function renderPlaces(root) {
  const meta = state.meta;
  root.innerHTML = `
    <div class="page-head">
      <h1>장소 탐색</h1>
      <p class="muted">${state.places.length}곳의 반려동물 동반 장소 (데모 데이터)</p>
    </div>
    <div class="search-bar">
      ${icon("search")}
      <input id="q" type="search" placeholder="장소명·지역 검색" value="${escapeAttr(filters.q)}" aria-label="검색">
    </div>
    <div class="filters">
      <select id="f-region" aria-label="지역"><option value="">전체 지역</option>
        ${(meta.regions || []).map((r) => opt(r.key, filters.region)).join("")}</select>
      <select id="f-cat" aria-label="카테고리"><option value="">전체 카테고리</option>
        ${(meta.categories || []).map((c) => opt(c.key, filters.category)).join("")}</select>
      <select id="f-size" aria-label="반려동물 크기"><option value="">크기 무관</option>
        ${(meta.petSizes || []).map((s) => `<option value="${s.key}" ${filters.size === s.key ? "selected" : ""}>${escapeText(s.label)} 허용</option>`).join("")}</select>
      <select id="f-sort" aria-label="정렬">
        ${["rating:평점순", "reviews:후기많은순", "name:이름순", "price:가격낮은순"].map((o) => {
          const [v, t] = o.split(":");
          return `<option value="${v}" ${filters.sort === v ? "selected" : ""}>${t}</option>`;
        }).join("")}
      </select>
    </div>
    <div class="amenity-filter" aria-label="편의시설 필터">
      ${(meta.amenities || []).map((a) => `
        <label class="pill ${filters.amenities.has(a.key) ? "on" : ""}">
          <input type="checkbox" value="${a.key}" ${filters.amenities.has(a.key) ? "checked" : ""} hidden>
          ${escapeText(a.label)}
        </label>`).join("")}
    </div>
    <div class="result-head"><span id="count"></span>
      <button class="linklike" id="reset-filters">필터 초기화</button></div>
    <div class="grid" id="results"></div>
  `;

  const apply = () => {
    const list = filterPlaces();
    qs("#count").textContent = `${list.length}곳`;
    const box = qs("#results");
    box.innerHTML = list.length
      ? list.map(placeCard).join("")
      : `<div class="empty">조건에 맞는 장소가 없어요. 필터를 조정해 보세요.</div>`;
  };

  qs("#q").addEventListener("input", (e) => { filters.q = e.target.value; apply(); });
  qs("#f-region").addEventListener("change", (e) => { filters.region = e.target.value; apply(); });
  qs("#f-cat").addEventListener("change", (e) => { filters.category = e.target.value; apply(); });
  qs("#f-size").addEventListener("change", (e) => { filters.size = e.target.value; apply(); });
  qs("#f-sort").addEventListener("change", (e) => { filters.sort = e.target.value; apply(); });
  qsa(".amenity-filter label").forEach((lab) => {
    lab.addEventListener("click", (e) => {
      e.preventDefault();
      const key = lab.querySelector("input").value;
      if (filters.amenities.has(key)) filters.amenities.delete(key);
      else filters.amenities.add(key);
      lab.classList.toggle("on");
      apply();
    });
  });
  qs("#reset-filters").addEventListener("click", () => {
    filters.q = ""; filters.region = ""; filters.category = ""; filters.size = "";
    filters.amenities.clear(); filters.sort = "rating";
    renderPlaces(root);
  });
  apply();
}

function opt(v, cur) {
  return `<option value="${escapeAttr(v)}" ${cur === v ? "selected" : ""}>${escapeText(v)}</option>`;
}

function filterPlaces() {
  let list = state.places.filter((p) => {
    if (filters.category && p.category !== filters.category) return false;
    if (filters.region && p.region !== filters.region) return false;
    if (filters.size && !p.petSizes.includes(filters.size)) return false;
    if (filters.amenities.size) {
      for (const a of filters.amenities) if (!p.amenities.includes(a)) return false;
    }
    if (filters.q) {
      const q = filters.q.toLowerCase();
      const hay = (p.name + p.region + p.district + p.summary).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const sorters = {
    rating: (a, b) => b.rating - a.rating,
    reviews: (a, b) => b.reviewCount - a.reviewCount,
    name: (a, b) => a.name.localeCompare(b.name, "ko"),
    price: (a, b) => (a.priceLevel || 0) - (b.priceLevel || 0),
  };
  return list.sort(sorters[filters.sort] || sorters.rating);
}

// ---------- Place detail ----------
export function renderPlaceDetail(root, id) {
  const p = state.places.find((x) => x.id === id);
  if (!p) { root.innerHTML = notFound(); return; }
  const reviews = getReviews(p.id);
  const wished = isWished(p.id);
  root.innerHTML = `
    <button class="btn ghost small back" data-back>${icon("back")} 뒤로</button>
    <div class="detail-hero">${placeImage(p, { w: 800, h: 320 })}</div>
    <div class="detail-head">
      <div>
        <span class="chip cat-chip">${escapeText(p.category)}</span>
        ${p.emergency ? '<span class="chip emg">24시 응급</span>' : ""}
        <h1>${escapeText(p.name)}</h1>
        <p class="muted">${escapeText(p.address)}</p>
        <p>${stars(p.rating)} <strong>${p.rating}</strong> <span class="muted">(${p.reviewCount} 후기)</span></p>
      </div>
      <div class="detail-actions">
        <button class="btn ${wished ? "primary" : "ghost"}" id="wish">${icon("heart")} ${wished ? "찜함" : "찜하기"}</button>
        <button class="btn primary" id="add-trip">${icon("route")} 코스에 담기</button>
        <a class="btn ghost" href="tel:${escapeAttr(p.phone)}">${icon("phone")} 전화</a>
      </div>
    </div>

    <section class="panel">
      <h2>반려동물 정책</h2>
      <p>${escapeText(p.policy)}</p>
      <div class="kv"><span>이용 시간</span><span>${escapeText(p.hours)}</span></div>
      <div class="kv"><span>허용 크기</span><span>${p.petSizes.map((s) => sizeLabel(s)).join(", ")}</span></div>
    </section>

    <section class="panel">
      <h2>편의시설</h2>
      <div class="amenity-list">
        ${p.amenities.map((a) => `<span class="pill on static">${icon("check")} ${escapeText(amenityLabel(a))}</span>`).join("") || "<span class='muted'>정보 없음</span>"}
      </div>
    </section>

    <section class="panel">
      <h2>위치</h2>
      <div class="mini-map">${regionSchematic(p.region, [p])}</div>
      <p class="muted small">* 데모용 개략 지도입니다. 실제 좌표/실시간 지도가 아닙니다.</p>
    </section>

    <section class="panel">
      <div class="row-head"><h2>후기 (${reviews.length})</h2>
        <button class="btn primary small" id="write-review">${icon("plus")} 후기 작성</button></div>
      <div id="reviews">${reviews.length ? reviews.map(reviewCard).join("") : "<p class='muted'>아직 후기가 없어요. 첫 후기를 남겨보세요!</p>"}</div>
    </section>
  `;
  qs("#wish").addEventListener("click", () => { toggleWish(p.id); renderPlaceDetail(root, id); });
  qs("#add-trip").addEventListener("click", () => addToTripDialog(p, root, id));
  qs("#write-review").addEventListener("click", () => writeReviewDialog(p, () => renderPlaceDetail(root, id)));
}

function reviewCard(r) {
  const place = state.places.find((x) => x.id === r.placeId);
  return `
  <div class="review">
    <div class="review-head">
      <strong>${escapeText(r.author)}</strong>
      ${stars(r.rating)}
      ${place ? `<button class="linklike small" data-goto="/place/${place.id}">${escapeText(place.name)}</button>` : ""}
      <span class="muted small">${fmtDate(r.createdAt)}</span>
    </div>
    ${r.photoColor ? `<div class="review-photo" style="background:${r.photoColor}">${icon("camera")}</div>` : ""}
    <p>${escapeText(r.text)}</p>
  </div>`;
}

function addToTripDialog(p, root, id) {
  const trips = state.trips;
  const body = `
    <p class="muted small">"${escapeText(p.name)}"를 담을 여행 코스를 선택하세요.</p>
    <div class="trip-pick">
      ${trips.map((t) => `<button class="btn ghost block" data-trip="${t.id}">
        ${escapeText(t.name)} <span class="muted small">(${t.placeIds.length}곳)</span></button>`).join("")}
    </div>
    <div class="new-trip">
      <input id="new-trip-name" placeholder="새 코스 이름 (예: 제주 3박4일)" />
      <button class="btn primary" id="create-trip">${icon("plus")} 새 코스 만들어 담기</button>
    </div>`;
  const ov = modal("여행 코스에 담기", body);
  ov.querySelectorAll("[data-trip]").forEach((b) =>
    b.addEventListener("click", () => {
      const ok = addPlaceToTrip(b.dataset.trip, p.id);
      closeModal();
      toast(ok ? "코스에 담았어요!" : "이미 담긴 장소예요", ok ? "ok" : "warn");
    }));
  ov.querySelector("#create-trip").addEventListener("click", () => {
    const name = ov.querySelector("#new-trip-name").value.trim();
    const t = createTrip(name || `${p.region} 여행 코스`);
    addPlaceToTrip(t.id, p.id);
    closeModal();
    toast("새 코스를 만들어 담았어요!");
  });
}

function writeReviewDialog(p, after) {
  const colors = ["#7c9cff", "#ff9f6b", "#5fcf8f", "#c79bff", "#ff7b8a", "none"];
  const body = `
    <form id="review-form" class="form">
      <label>닉네임<input name="author" placeholder="집사 닉네임" required maxlength="20"></label>
      <label>별점
        <select name="rating">${[5, 4, 3, 2, 1].map((n) => `<option value="${n}">${"★".repeat(n)} ${n}점</option>`).join("")}</select>
      </label>
      <label>후기
        <textarea name="text" rows="4" placeholder="반려동물과의 방문 경험을 남겨주세요" required maxlength="500"></textarea></label>
      <fieldset class="photo-pick"><legend>사진 색상 (데모 플레이스홀더)</legend>
        ${colors.map((c, i) => c === "none"
          ? `<label class="ph-swatch none"><input type="radio" name="photo" value="" ${i === 0 ? "" : ""} hidden>없음</label>`
          : `<label class="ph-swatch" style="background:${c}"><input type="radio" name="photo" value="${c}" hidden></label>`).join("")}
      </fieldset>
      <button class="btn primary block" type="submit">${icon("check")} 후기 등록</button>
    </form>`;
  const ov = modal(`${p.name} 후기 작성`, body);
  ov.querySelectorAll(".ph-swatch").forEach((s) =>
    s.addEventListener("click", () => {
      ov.querySelectorAll(".ph-swatch").forEach((x) => x.classList.remove("sel"));
      s.classList.add("sel");
      s.querySelector("input").checked = true;
    }));
  ov.querySelector("#review-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    addReview(p.id, {
      author: f.get("author"), rating: f.get("rating"),
      text: f.get("text"), photoColor: f.get("photo") || null,
    });
    closeModal();
    toast("후기가 등록되었어요! 🐾");
    if (after) after();
  });
}

// ---------- Map view ----------
export function renderMap(root) {
  const selRegion = filters.region || "";
  root.innerHTML = `
    <div class="page-head"><h1>지도 보기</h1>
      <p class="muted">지역을 눌러 해당 지역의 장소를 확인하세요 (데모용 개략 지도)</p></div>
    <div class="map-wrap">
      <div class="map-canvas">${koreaSchematic(selRegion)}</div>
      <div class="map-side" id="map-side"></div>
    </div>`;
  const renderSide = (region) => {
    const list = region ? state.places.filter((p) => p.region === region) : [];
    const side = qs("#map-side");
    if (!region) {
      side.innerHTML = `<div class="empty">지역 핀을 선택하면<br>장소 목록이 표시됩니다.</div>`;
      return;
    }
    side.innerHTML = `<h2>${escapeText(region)} · ${list.length}곳</h2>` +
      list.map((p) => `
        <button class="side-item" data-goto="/place/${p.id}">
          <span class="dot" style="background:${catColor(p.category)}"></span>
          <span><strong>${escapeText(p.name)}</strong><br>
          <span class="muted small">${escapeText(p.category)} · ${stars(p.rating)}</span></span>
        </button>`).join("");
  };
  const bind = () => {
    qsa(".map-region").forEach((g) => g.addEventListener("click", () => {
      filters.region = g.dataset.region;
      qsa(".map-region").forEach((x) => x.classList.toggle("active", x === g));
      renderSide(g.dataset.region);
    }));
  };
  bind();
  renderSide(selRegion);
}

function koreaSchematic(selRegion) {
  const regions = state.meta.regions || [];
  // Stylised region blobs + place pins on a 400x500 canvas.
  const pins = state.places.map((p) => {
    const r = regions.find((x) => x.key === p.region);
    if (!r) return "";
    const jx = ((hashNum(p.id) % 40) - 20);
    const jy = ((hashNum(p.id + "y") % 40) - 20);
    return `<circle class="map-pin" cx="${r.x + jx}" cy="${r.y + jy}" r="3.4"
      fill="${catColor(p.category)}" opacity="0.9"><title>${escapeAttr(p.name)}</title></circle>`;
  }).join("");
  const zones = regions.map((r) => `
    <g class="map-region ${selRegion === r.key ? "active" : ""}" data-region="${escapeAttr(r.key)}" tabindex="0" role="button"
       aria-label="${escapeAttr(r.key)} 지역">
      <circle class="zone" cx="${r.x}" cy="${r.y}" r="34"></circle>
      <text x="${r.x}" y="${r.y + 4}" text-anchor="middle">${escapeText(r.key)}</text>
      <text x="${r.x}" y="${r.y + 20}" text-anchor="middle" class="zone-count">${countRegion(r.key)}곳</text>
    </g>`).join("");
  return `
  <svg viewBox="0 0 400 500" class="korea-map" role="img" aria-label="지역 개략 지도">
    <rect width="400" height="500" fill="none"/>
    <path class="landmass" d="M120 90 C90 120 90 170 120 200 C100 240 120 300 150 320
      C130 360 150 420 190 400 L210 360 C260 350 300 320 290 280 C320 250 300 200 270 180
      C300 150 280 110 250 110 C220 90 160 70 120 90 Z"/>
    <ellipse class="landmass" cx="140" cy="452" rx="46" ry="26"/>
    ${zones}
    <g class="pins">${pins}</g>
  </svg>`;
}

function regionSchematic(region, places) {
  const r = (state.meta.regions || []).find((x) => x.key === region) || { x: 200, y: 100 };
  const pins = places.map((p) =>
    `<circle cx="200" cy="70" r="8" fill="${catColor(p.category)}"/>
     <circle cx="200" cy="70" r="16" fill="none" stroke="${catColor(p.category)}" opacity="0.5"/>`).join("");
  return `<svg viewBox="0 0 400 140" class="region-map" role="img" aria-label="${escapeAttr(region)} 위치 개략도">
    <rect width="400" height="140" rx="12" class="region-bg"/>
    <text x="200" y="120" text-anchor="middle" class="region-name">${escapeText(region)}</text>
    ${pins}
  </svg>`;
}

function countRegion(key) { return state.places.filter((p) => p.region === key).length; }
function catColor(key) {
  const c = (state.meta.categories || []).find((x) => x.key === key);
  return c ? c.color : "#888";
}
function hashNum(s) { let n = 0; for (let i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) & 0xffff; return n; }

// ---------- Community ----------
export function renderCommunity(root) {
  const feed = allReviews();
  root.innerHTML = `
    <div class="page-head"><h1>커뮤니티</h1>
      <p class="muted">집사들이 남긴 반려동물 여행 후기 (데모)</p></div>
    <button class="btn primary" id="new-post">${icon("plus")} 후기 올리기</button>
    <div class="feed" id="feed">
      ${feed.length ? feed.map(reviewCard).join("")
        : "<div class='empty'>아직 후기가 없어요.<br>첫 후기를 남겨보세요! 🐾</div>"}
    </div>`;
  qs("#new-post").addEventListener("click", () => {
    const body = `
      <label class="form">방문한 장소
        <select id="pick-place">${state.places.map((p) =>
          `<option value="${p.id}">${escapeText(p.name)} (${escapeText(p.category)})</option>`).join("")}</select>
      </label>`;
    const ov = modal("후기 올리기 - 장소 선택", body + `<button class="btn primary block" id="go-write">다음</button>`);
    ov.querySelector("#go-write").addEventListener("click", () => {
      const pid = ov.querySelector("#pick-place").value;
      const p = state.places.find((x) => x.id === pid);
      closeModal();
      writeReviewDialog(p, () => renderCommunity(root));
    });
  });
}

// ---------- Trips (여행 코스) ----------
export function renderTrips(root, tripId) {
  if (tripId) return renderTripDetail(root, tripId);
  root.innerHTML = `
    <div class="page-head"><h1>내 여행 코스</h1>
      <p class="muted">장소를 담아 나만의 반려동물 여행 코스를 만들어요</p></div>
    <div class="new-trip">
      <input id="trip-name" placeholder="코스 이름 (예: 강원 힐링 2박3일)">
      <button class="btn primary" id="mk-trip">${icon("plus")} 코스 만들기</button>
    </div>
    <div class="trip-list">
      ${state.trips.length ? state.trips.map(tripSummary).join("")
        : "<div class='empty'>아직 코스가 없어요. 장소 상세에서 <b>코스에 담기</b>를 눌러보세요.</div>"}
    </div>`;
  qs("#mk-trip").addEventListener("click", () => {
    const name = qs("#trip-name").value.trim();
    createTrip(name || "새 여행 코스");
    toast("코스를 만들었어요!");
    renderTrips(root);
  });
}

function tripSummary(t) {
  const cats = t.placeIds.map((id) => state.places.find((p) => p.id === id)).filter(Boolean);
  return `
  <article class="card trip-card" data-goto="/trips/${t.id}">
    <div class="trip-card-body">
      <h3>${escapeText(t.name)}</h3>
      <p class="muted small">${cats.length}개 장소 · ${fmtDate(t.createdAt)}</p>
      <div class="trip-mini">${cats.slice(0, 5).map((p) =>
        `<span class="dot" style="background:${catColor(p.category)}" title="${escapeAttr(p.name)}"></span>`).join("") || "<span class='muted small'>비어 있음</span>"}</div>
    </div>
    <span class="chev">→</span>
  </article>`;
}

function renderTripDetail(root, tripId) {
  const t = state.trips.find((x) => x.id === tripId);
  if (!t) { root.innerHTML = notFound(); return; }
  const places = t.placeIds.map((id) => state.places.find((p) => p.id === id)).filter(Boolean);
  const regionSet = [...new Set(places.map((p) => p.region))];
  root.innerHTML = `
    <button class="btn ghost small back" data-goto="/trips">${icon("back")} 코스 목록</button>
    <div class="page-head trip-detail-head">
      <input class="trip-title-input" id="trip-title" value="${escapeAttr(t.name)}" aria-label="코스 이름">
      <button class="icon-btn danger" id="del-trip" aria-label="코스 삭제">${icon("trash")}</button>
    </div>
    <p class="muted">${places.length}개 장소 · 지역: ${regionSet.join(", ") || "-"}</p>
    <ol class="course-list" id="course">
      ${places.length ? places.map((p, i) => courseItem(p, i, places.length, t.id)).join("")
        : "<div class='empty'>담긴 장소가 없어요. 장소 탐색에서 담아보세요.</div>"}
    </ol>
    ${places.length ? `<button class="btn ghost block" data-goto="/places">${icon("plus")} 장소 더 담으러 가기</button>` : ""}
  `;
  qs("#trip-title").addEventListener("change", (e) => { renameTrip(t.id, e.target.value.trim() || "새 여행 코스"); toast("이름을 변경했어요"); });
  qs("#del-trip").addEventListener("click", () => {
    if (confirm("이 코스를 삭제할까요?")) { deleteTrip(t.id); toast("코스를 삭제했어요"); go("/trips"); }
  });
  root.querySelectorAll("[data-up]").forEach((b) => b.addEventListener("click", (e) => {
    e.stopPropagation(); reorderTripPlace(t.id, b.dataset.up, -1); renderTripDetail(root, tripId);
  }));
  root.querySelectorAll("[data-down]").forEach((b) => b.addEventListener("click", (e) => {
    e.stopPropagation(); reorderTripPlace(t.id, b.dataset.down, 1); renderTripDetail(root, tripId);
  }));
  root.querySelectorAll("[data-remove]").forEach((b) => b.addEventListener("click", (e) => {
    e.stopPropagation(); removePlaceFromTrip(t.id, b.dataset.remove); toast("코스에서 뺐어요"); renderTripDetail(root, tripId);
  }));
}

function courseItem(p, i, total, tripId) {
  return `
  <li class="course-item">
    <span class="step">${i + 1}</span>
    <div class="course-media" data-goto="/place/${p.id}">${placeImage(p, { w: 120, h: 90 })}</div>
    <div class="course-info" data-goto="/place/${p.id}">
      <strong>${escapeText(p.name)}</strong>
      <span class="muted small">${escapeText(p.category)} · ${escapeText(p.region)} ${escapeText(p.district)}</span>
    </div>
    <div class="course-ctrl">
      <button class="icon-btn" data-up="${p.id}" ${i === 0 ? "disabled" : ""} aria-label="위로">▲</button>
      <button class="icon-btn" data-down="${p.id}" ${i === total - 1 ? "disabled" : ""} aria-label="아래로">▼</button>
      <button class="icon-btn danger" data-remove="${p.id}" aria-label="제거">${icon("close")}</button>
    </div>
  </li>`;
}

// ---------- Gear (용품 카탈로그 + 장바구니) ----------
export function renderGear(root) {
  const cats = [...new Set(state.gear.map((g) => g.category))];
  root.innerHTML = `
    <div class="page-head"><h1>펫 여행용품</h1>
      <p class="muted">${state.gear.length}개 상품 (모의 장바구니 · 실제 결제 없음)</p></div>
    <div class="search-bar">${icon("search")}
      <input id="gq" type="search" placeholder="용품 검색" value="${escapeAttr(gearFilters.q)}" aria-label="용품 검색"></div>
    <div class="chips-row">
      <button class="chip-btn ${!gearFilters.category ? "on" : ""}" data-gcat="">전체</button>
      ${cats.map((c) => `<button class="chip-btn ${gearFilters.category === c ? "on" : ""}" data-gcat="${escapeAttr(c)}">${escapeText(c)}</button>`).join("")}
    </div>
    <button class="btn primary cart-open" id="open-cart">${icon("cart")} 장바구니 <span class="badge" id="cart-badge">${cartCount()}</span></button>
    <div class="grid gear-grid" id="gear-results"></div>`;

  const apply = () => {
    let list = state.gear.filter((g) => {
      if (gearFilters.category && g.category !== gearFilters.category) return false;
      if (gearFilters.q) {
        const q = gearFilters.q.toLowerCase();
        if (!(g.name + g.summary + (g.tags || []).join(" ")).toLowerCase().includes(q)) return false;
      }
      return true;
    });
    qs("#gear-results").innerHTML = list.length
      ? list.map(gearCard).join("")
      : "<div class='empty'>검색 결과가 없어요.</div>";
    qsa("[data-add]").forEach((b) => b.addEventListener("click", () => {
      addToCart(b.dataset.add, 1); toast("장바구니에 담았어요 🛒");
      qs("#cart-badge").textContent = cartCount();
    }));
  };
  qs("#gq").addEventListener("input", (e) => { gearFilters.q = e.target.value; apply(); });
  qsa("[data-gcat]").forEach((b) => b.addEventListener("click", () => {
    gearFilters.category = b.dataset.gcat;
    qsa("[data-gcat]").forEach((x) => x.classList.toggle("on", x === b));
    apply();
  }));
  qs("#open-cart").addEventListener("click", openCart);
  apply();
}

function gearCard(g) {
  return `
  <article class="card gear-card">
    <div class="card-media small">${gearImage(g, { w: 300, h: 160 })}
      <span class="chip cat-chip">${escapeText(g.category)}</span></div>
    <div class="card-body">
      <h3>${escapeText(g.name)}</h3>
      <p class="summary small">${escapeText(g.summary)}</p>
      <div class="card-foot">
        <strong class="price">${won(g.price)}</strong>
        <span class="small muted">${stars(g.rating)} ${g.rating}</span>
      </div>
      <button class="btn primary block" data-add="${g.id}">${icon("cart")} 담기</button>
    </div>
  </article>`;
}

function openCart() {
  const render = (ov) => {
    const ids = Object.keys(state.cart);
    const items = ids.map((id) => ({ g: state.gear.find((x) => x.id === id), qty: state.cart[id] })).filter((x) => x.g);
    const total = items.reduce((s, it) => s + it.g.price * it.qty, 0);
    const body = ov.querySelector(".modal-body");
    body.innerHTML = items.length ? `
      <div class="cart-items">
        ${items.map((it) => `
          <div class="cart-row">
            <div class="cart-thumb">${gearImage(it.g, { w: 80, h: 60 })}</div>
            <div class="cart-meta"><strong>${escapeText(it.g.name)}</strong>
              <span class="muted small">${won(it.g.price)}</span></div>
            <div class="qty">
              <button class="icon-btn" data-dec="${it.g.id}" aria-label="수량 감소">−</button>
              <span>${it.qty}</span>
              <button class="icon-btn" data-inc="${it.g.id}" aria-label="수량 증가">+</button>
            </div>
            <button class="icon-btn danger" data-rm="${it.g.id}" aria-label="삭제">${icon("trash")}</button>
          </div>`).join("")}
      </div>
      <div class="cart-total"><span>합계</span><strong>${won(total)}</strong></div>
      <button class="btn primary block" id="checkout">${icon("check")} 모의 결제하기</button>
      <p class="muted small center">* 데모입니다. 실제 결제/배송은 이루어지지 않습니다.</p>
    ` : "<div class='empty'>장바구니가 비어 있어요.</div>";
    body.querySelectorAll("[data-inc]").forEach((b) => b.addEventListener("click", () => { setCartQty(b.dataset.inc, state.cart[b.dataset.inc] + 1); render(ov); }));
    body.querySelectorAll("[data-dec]").forEach((b) => b.addEventListener("click", () => { setCartQty(b.dataset.dec, state.cart[b.dataset.dec] - 1); render(ov); }));
    body.querySelectorAll("[data-rm]").forEach((b) => b.addEventListener("click", () => { setCartQty(b.dataset.rm, 0); render(ov); }));
    const co = body.querySelector("#checkout");
    if (co) co.addEventListener("click", () => {
      clearCart(); closeModal();
      toast("모의 결제가 완료되었어요! (데모)", "ok");
      const badge = document.getElementById("cart-badge"); if (badge) badge.textContent = "0";
    });
  };
  const ov = modal("장바구니 (모의)", "");
  render(ov);
}

// ---------- Profile (반려동물 프로필) ----------
export function renderProfile(root) {
  const p = state.profile;
  root.innerHTML = `
    <div class="page-head"><h1>반려동물 프로필</h1></div>
    ${p ? profileCard(p) : ""}
    <form id="profile-form" class="form panel">
      <h2>${p ? "프로필 수정" : "프로필 만들기"}</h2>
      <label>이름<input name="name" value="${p ? escapeAttr(p.name) : ""}" placeholder="예: 초코" required maxlength="20"></label>
      <label>견종
        <select name="breed">${(state.meta.breeds || []).map((b) =>
          `<option value="${escapeAttr(b)}" ${p && p.breed === b ? "selected" : ""}>${escapeText(b)}</option>`).join("")}</select></label>
      <label>크기
        <select name="size">${(state.meta.petSizes || []).map((s) =>
          `<option value="${s.key}" ${p && p.size === s.key ? "selected" : ""}>${escapeText(s.label)}</option>`).join("")}</select></label>
      <label>한 줄 소개<input name="bio" value="${p ? escapeAttr(p.bio || "") : ""}" placeholder="우리 아이를 소개해주세요" maxlength="60"></label>
      <button class="btn primary block" type="submit">${icon("check")} 저장</button>
    </form>
    <section class="panel">
      <h2>내가 찜한 장소 (${state.wishlist.length})</h2>
      <div class="grid">${state.wishlist.length
        ? state.wishlist.map((id) => state.places.find((x) => x.id === id)).filter(Boolean).map(placeCard).join("")
        : "<p class='muted'>아직 찜한 장소가 없어요.</p>"}</div>
    </section>`;
  qs("#profile-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    setProfile({ name: f.get("name"), breed: f.get("breed"), size: f.get("size"), bio: f.get("bio") });
    toast("프로필을 저장했어요! 🐾");
    renderProfile(root);
  });
}

function profileCard(p) {
  return `
  <div class="profile-card panel">
    <div class="avatar">${petAvatar(p.name, 72)}</div>
    <div>
      <h2>${escapeText(p.name)}</h2>
      <p class="muted">${escapeText(p.breed)} · ${sizeLabel(p.size)}</p>
      ${p.bio ? `<p>"${escapeText(p.bio)}"</p>` : ""}
    </div>
  </div>`;
}

// ---------- Emergency (24시 병원 빠른찾기) ----------
export function renderEmergency(root) {
  const region = filters.region || "";
  const vets = state.places.filter((p) => p.category === "병원" && p.emergency);
  root.innerHTML = `
    <div class="page-head"><h1>${icon("cross")} 응급 동물병원 빠른찾기</h1>
      <p class="muted">여행 중 응급상황을 대비한 24시/야간 응급 병원 (데모)</p></div>
    <div class="filters">
      <select id="emg-region" aria-label="지역"><option value="">전체 지역</option>
        ${(state.meta.regions || []).map((r) => opt(r.key, region)).join("")}</select>
    </div>
    <div class="alert-box">${icon("phone")} 응급 시에는 방문 전 전화로 상황을 알리고 내원하세요.</div>
    <div class="vet-list" id="vet-list"></div>`;
  const apply = () => {
    const list = filters.region ? vets.filter((v) => v.region === filters.region) : vets;
    qs("#vet-list").innerHTML = list.length ? list.map(vetCard).join("")
      : "<div class='empty'>해당 지역의 응급 병원 데이터가 없어요.</div>";
  };
  qs("#emg-region").addEventListener("change", (e) => { filters.region = e.target.value; apply(); });
  apply();
}

function vetCard(v) {
  return `
  <article class="vet-card">
    <div class="vet-main" data-goto="/place/${v.id}">
      <h3>${escapeText(v.name)} <span class="chip emg">응급</span></h3>
      <p class="muted small">${escapeText(v.region)} · ${escapeText(v.district)}</p>
      <p class="small">${escapeText(v.hours)}</p>
    </div>
    <a class="btn primary" href="tel:${escapeAttr(v.phone)}">${icon("phone")} 전화</a>
  </article>`;
}

// ---------- Checklist (동반 체크리스트) ----------
export function renderChecklist(root) {
  const items = state.meta.checklist || [];
  const done = items.filter((i) => state.checklist[i.id]).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  root.innerHTML = `
    <div class="page-head"><h1>반려동물 동반 체크리스트</h1>
      <p class="muted">여행 전 꼭 확인하세요</p></div>
    <div class="progress"><div class="progress-bar" style="width:${pct}%"></div></div>
    <p class="muted small">${done}/${items.length} 완료 (${pct}%)</p>
    <ul class="check-list">
      ${items.map((i) => `
        <li class="check-item ${state.checklist[i.id] ? "done" : ""}" data-check="${i.id}">
          <span class="check-box">${state.checklist[i.id] ? icon("check") : ""}</span>
          <span>${escapeText(i.label)}</span>
        </li>`).join("")}
    </ul>`;
  qsa("[data-check]").forEach((li) => li.addEventListener("click", () => { toggleCheck(li.dataset.check); renderChecklist(root); }));
}

// ---------- AI 여행 도우미 (플래너 챗봇 · 코스 자동생성 · 준비물 체크리스트) ----------
export function renderAI(root) {
  const meta = state.meta;
  const regionOpts = `<option value="">지역 무관</option>` +
    (meta.regions || []).map((r) => `<option value="${escapeAttr(r.key)}">${escapeText(r.key)}</option>`).join("");
  const sizeOpts = `<option value="">크기 무관</option>` +
    (meta.petSizes || []).map((s) => `<option value="${s.key}">${escapeText(s.label)}</option>`).join("");

  root.innerHTML = `
    <div class="page-head">
      <h1>${icon("spark")} AI 여행 도우미</h1>
      <p class="muted">반려동물 동반 여행을 AI가 도와드려요 <span class="chip">데모 = 목업</span></p>
    </div>
    <div class="ai-ctx">
      <select id="ai-region" aria-label="지역">${regionOpts}</select>
      <select id="ai-size" aria-label="반려동물 크기">${sizeOpts}</select>
      <label class="ai-days">여행일수
        <input id="ai-days" type="number" min="1" max="7" value="2" aria-label="여행 일수">일</label>
    </div>
    <div class="chips-row ai-tabs" role="tablist">
      <button class="chip-btn on" data-aitab="planner" role="tab">💬 플래너 챗봇</button>
      <button class="chip-btn" data-aitab="course" role="tab">🗺️ 코스 자동생성</button>
      <button class="chip-btn" data-aitab="checklist" role="tab">✅ 준비물 체크리스트</button>
    </div>
    <div id="ai-panel"></div>
    <p class="muted small ai-note">* 데모에서는 실제 API 없이 앱의 장소·용품 데이터로 결과를 생성합니다.
      실제 Claude 연동은 <code>server/</code> 프록시와 <code>ANTHROPIC_API_KEY</code>로 활성화되며, 키는 서버에만 보관됩니다.</p>
  `;

  const ctx = () => ({
    region: qs("#ai-region").value,
    size: qs("#ai-size").value,
    days: Number(qs("#ai-days").value) || 2,
  });

  const panel = qs("#ai-panel");
  let tab = "planner";
  const paint = () => {
    if (tab === "course") panel.innerHTML = aiCoursePanel();
    else if (tab === "checklist") panel.innerHTML = aiChecklistPanel();
    else panel.innerHTML = aiPlannerPanel();
    bindAiPanel(tab, panel, ctx);
  };
  qsa("[data-aitab]").forEach((b) => b.addEventListener("click", () => {
    tab = b.dataset.aitab;
    qsa("[data-aitab]").forEach((x) => x.classList.toggle("on", x === b));
    paint();
  }));
  paint();
}

function aiPlannerPanel() {
  return `
    <div class="ai-chat" id="ai-chat">
      <div class="ai-msg ai">${icon("spark")} 안녕하세요! 지역·크기·일수를 고른 뒤, 궁금한 점을 물어보세요.
        예) "바다 근처로 2박 코스 추천해줘"</div>
    </div>
    <form class="ai-form" id="ai-plan-form">
      <input id="ai-q" placeholder="반려동물 여행에 대해 물어보세요" aria-label="질문" autocomplete="off">
      <button class="btn primary" type="submit">${icon("spark")} 보내기</button>
    </form>`;
}

function aiCoursePanel() {
  return `
    <div class="ai-actions">
      <button class="btn primary" id="ai-gen-course">${icon("route")} 코스 자동 생성</button>
      <button class="btn ghost" id="ai-save-course" style="display:none">${icon("plus")} 이 코스 저장</button>
    </div>
    <pre class="ai-out" id="ai-course-out" aria-live="polite"></pre>`;
}

function aiChecklistPanel() {
  return `
    <label class="ai-notes">여행 메모 (선택)
      <input id="ai-notes" placeholder="예: 여름, 바다, 장거리 이동" aria-label="여행 메모" autocomplete="off"></label>
    <div class="ai-actions">
      <button class="btn primary" id="ai-gen-check">${icon("check")} 체크리스트 생성</button>
    </div>
    <pre class="ai-out" id="ai-check-out" aria-live="polite"></pre>`;
}

async function streamInto(task, payload, outEl, btns = []) {
  outEl.textContent = "";
  outEl.classList.add("streaming");
  btns.forEach((b) => b && (b.disabled = true));
  try {
    await askAI(task, payload, { onToken: (t) => { outEl.textContent += t; outEl.scrollTop = outEl.scrollHeight; } });
  } catch (e) {
    outEl.textContent = "AI 응답 중 문제가 발생했어요: " + (e && e.message ? e.message : e);
  } finally {
    outEl.classList.remove("streaming");
    btns.forEach((b) => b && (b.disabled = false));
  }
}

function bindAiPanel(tab, panel, ctx) {
  if (tab === "planner") {
    const form = qs("#ai-plan-form", panel);
    const log = qs("#ai-chat", panel);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const q = qs("#ai-q", panel).value.trim();
      if (!q) return;
      qs("#ai-q", panel).value = "";
      log.appendChild(h(`<div class="ai-msg user">${escapeText(q)}</div>`));
      const bubble = h(`<div class="ai-msg ai"></div>`);
      log.appendChild(bubble);
      log.scrollTop = log.scrollHeight;
      await streamInto("planner", { ...ctx(), question: q }, bubble, [form.querySelector("button")]);
      log.scrollTop = log.scrollHeight;
    });
  } else if (tab === "course") {
    const gen = qs("#ai-gen-course", panel);
    const save = qs("#ai-save-course", panel);
    const out = qs("#ai-course-out", panel);
    gen.addEventListener("click", async () => {
      save.style.display = "none";
      await streamInto("course", ctx(), out, [gen]);
      if (pickItinerary(ctx()).some((d) => d.places.length)) save.style.display = "";
    });
    save.addEventListener("click", () => {
      const c = ctx();
      const ids = pickItinerary(c).flatMap((d) => d.places.map((p) => p.id));
      if (!ids.length) { toast("담을 장소가 없어요", "warn"); return; }
      const t = createTrip((c.region || "AI 추천") + " AI 코스");
      ids.forEach((id) => addPlaceToTrip(t.id, id));
      toast("AI 코스를 저장했어요! 🐾");
      go("/trips/" + t.id);
    });
  } else {
    const gen = qs("#ai-gen-check", panel);
    const out = qs("#ai-check-out", panel);
    gen.addEventListener("click", async () => {
      const notes = qs("#ai-notes", panel).value.trim();
      await streamInto("checklist", { ...ctx(), notes }, out, [gen]);
    });
  }
}

// ---------- helpers ----------
function fmtDate(ts) {
  try {
    const d = new Date(ts);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  } catch (e) { return ""; }
}
function notFound() {
  return `<div class="empty big">페이지를 찾을 수 없어요.<br>
    <button class="btn primary" data-goto="/">홈으로</button></div>`;
}
