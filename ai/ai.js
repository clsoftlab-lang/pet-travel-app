// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
//
// ai/ai.js — pluggable AI layer for 윗마이펫 (With My Pet).
//
//   askAI(task, payload, { onToken } = {})
//     • AI_ENDPOINT === ""  ⇒ deterministic Korean MockProvider that reuses the
//       app's own places/gear seed data (state.places / state.gear). No network,
//       no key — the public demo "just works" offline.
//     • AI_ENDPOINT set      ⇒ POST { task, payload } to the backend proxy in
//       server/ and stream the plain-text response back token-by-token.
//
//   tasks: "planner" (chatbot itinerary), "course" (auto trip course),
//          "checklist" (pet-travel packing checklist),
//          "weekend" (on-load "이번 주말" auto recommendation).
//
// 무인(autonomous) resilience: in REAL mode, if the endpoint call fails, returns
// a 429 {fallback:true} (cost cap hit), or the network errors, askAI AUTO-FALLS
// BACK to the offline mock so the app never breaks — streaming still via onToken.
//
// The provider is chosen at call time, so switching to real Claude only requires
// setting AI_ENDPOINT in ai/config.js — no other code changes. A real API key is
// NEVER read here; it lives only on the server.

import { AI_ENDPOINT } from "./config.js";
import { state } from "../js/state.js";

const SIZE_LABEL = { small: "소형견", medium: "중형견", large: "대형견" };
export function sizeLabel(s) { return SIZE_LABEL[s] || ""; }

function amenityLabel(key) {
  const a = (state.meta.amenities || []).find((x) => x.key === key);
  return a ? a.label : key;
}

// ---- data grounding (reuses the app's seed data) ----

// Candidate places filtered by region / allowed pet size — the raw material the
// mock reasons over and that we send to the real model for grounding.
export function candidatePlaces({ region, size } = {}) {
  let list = (state.places || []).slice();
  if (region) list = list.filter((p) => p.region === region);
  if (size) list = list.filter((p) => Array.isArray(p.petSizes) && p.petSizes.includes(size));
  return list;
}

function byCategory(list, cat) {
  return list.filter((p) => p.category === cat).sort((a, b) => b.rating - a.rating);
}

function makeTaker(arr) {
  let i = 0;
  return (used) => {
    for (let k = 0; k < arr.length; k++) {
      const item = arr[i % arr.length];
      i++;
      if (item && !used.has(item.id)) { used.add(item.id); return item; }
    }
    return arr.length ? arr[(i++) % arr.length] : null;
  };
}

// Deterministic day-by-day itinerary built purely from the app's places.
// Each day tries: an activity (공원/카페) → a meal (식당/카페) → lodging (숙소).
export function pickItinerary({ region, size, days = 2 } = {}) {
  const d = Math.max(1, Math.min(7, Number(days) || 2));
  const pool = candidatePlaces({ region, size });
  const takePlay = makeTaker([...byCategory(pool, "공원"), ...byCategory(pool, "카페")]);
  const takeEat = makeTaker([...byCategory(pool, "식당"), ...byCategory(pool, "카페")]);
  const takeStay = makeTaker(byCategory(pool, "숙소"));
  const used = new Set();
  const out = [];
  for (let day = 1; day <= d; day++) {
    const places = [takePlay(used), takeEat(used), takeStay(used)].filter(Boolean);
    out.push({ day, places });
  }
  return out;
}

// A few relevant gear items from the app's catalog, tuned by size / notes.
export function recommendGear({ notes } = {}) {
  const g = state.gear || [];
  const wanted = new Set(["이동장비", "위생용품", "안전용품", "급식용품"]);
  const n = String(notes || "");
  if (/여름|더위|폭염|해변|바다/.test(n)) wanted.add("여름용품");
  if (/겨울|추위|눈|스키/.test(n)) wanted.add("겨울용품");
  if (/놀이|공원|산책|등산/.test(n)) { wanted.add("산책용품"); wanted.add("놀이용품"); }
  const picks = [];
  for (const cat of wanted) {
    const best = g.filter((x) => x.category === cat).sort((a, b) => b.rating - a.rating)[0];
    if (best) picks.push(best);
  }
  return picks;
}

// ---- MockProvider: deterministic Korean text generators ----

function line(...xs) { return xs.join(""); }

function mockPlanner(payload) {
  const { region, size, days, question } = payload;
  const itin = pickItinerary({ region, size, days: days || 2 });
  const total = itin.reduce((n, x) => n + x.places.length, 0);
  const head = ["🐾 반려동물 동반 여행 플래너예요."];
  const q = String(question || "").trim();
  if (q) head.push(line("질문: “", q, "”"));
  head.push(line("조건: ", region || "전 지역", " · ", sizeLabel(size) || "크기 무관", " · ", String(days || 2), "일"));
  if (!total) {
    return head.join("\n") + "\n\n조건에 딱 맞는 장소를 찾지 못했어요. 지역을 넓히거나 반려동물 크기 조건을 완화해 보시겠어요?";
  }
  const lines = [head.join("\n"), "", "이렇게 다녀보시는 걸 추천드려요:"];
  for (const day of itin) {
    lines.push(line("\n[", String(day.day), "일차]"));
    for (const p of day.places) {
      lines.push(line(" • ", p.name, " (", p.category, ", ", p.region, " ", p.district, ") — ", p.summary));
    }
  }
  lines.push("", "🧳 준비물은 '준비물 체크리스트' 탭에서, 이 일정을 그대로 담으려면 '코스 자동생성' 탭을 이용하세요.");
  return lines.join("\n");
}

function mockCourse(payload) {
  const { region, size, days } = payload;
  const itin = pickItinerary({ region, size, days: days || 2 });
  const total = itin.reduce((n, x) => n + x.places.length, 0);
  if (!total) {
    return line("조건(", region || "전 지역", ", ", sizeLabel(size) || "크기 무관", ", ", String(days || 2), "일)에 맞는 장소가 없어요. 필터를 완화해 보세요.");
  }
  const lines = [line("🗺️ ", region || "전 지역", " ", String(days || 2), "일 반려동물 동반 코스 (", sizeLabel(size) || "크기 무관", ")"), ""];
  for (const day of itin) {
    lines.push(line("━━ ", String(day.day), "일차 ━━"));
    day.places.forEach((p, i) => {
      lines.push(line(String(i + 1), ". ", p.name, " · ", p.category));
      lines.push(line("   ", p.region, " ", p.district, p.hours ? line(" | ", p.hours) : ""));
      const ams = (p.amenities || []).slice(0, 3).map(amenityLabel).join(" · ");
      if (ams) lines.push(line("   편의: ", ams));
    });
    lines.push("");
  }
  lines.push("아래 '이 코스 저장' 버튼을 누르면 위 장소들이 '내 여행 코스'에 그대로 담겨요.");
  return lines.join("\n");
}

function mockChecklist(payload) {
  const { region, size, days, notes } = payload;
  const lines = [
    line("✅ 반려동물 동반 준비물 체크리스트 (", region || "전 지역", " · ", sizeLabel(size) || "크기 무관", " · ", String(days || 2), "일)"),
    "",
    "기본 준비물",
  ];
  for (const c of (state.meta.checklist || [])) lines.push(line(" ☐ ", c.label));

  const n = String(notes || "") + " " + String(region || "");
  const extra = [];
  if (/여름|더위|폭염|해변|바다|제주/.test(n)) extra.push("더위 대비: 쿨매트·충분한 식수·그늘, 뜨거운 아스팔트 산책 시간 피하기");
  if (/겨울|추위|눈|스키|강원/.test(n)) extra.push("추위 대비: 방한복·발 보호 부츠·미끄럼 방지");
  if (/비|우천|장마/.test(n)) extra.push("우천 대비: 우비·타월·방수 매트");
  if (/장거리|고속|기차|비행|차/.test(n)) extra.push("장거리 이동: 멀미약 상담·중간 휴식·이동가방 적응");
  if (size === "large") extra.push("대형견: 튼튼한 하네스·긴 리드줄·넉넉한 차량 공간 확인");
  if (size === "small") extra.push("소형견: 보온 담요·낮은 급수대·분실 방지 인식표 재확인");
  if (extra.length) {
    lines.push("", "여행 조건 맞춤 추가 준비물");
    for (const e of extra) lines.push(line(" ☐ ", e));
  }

  const gear = recommendGear(payload);
  if (gear.length) {
    lines.push("", "추천 용품 (앱 '용품' 탭에서 담을 수 있어요)");
    for (const g of gear) lines.push(line(" ☐ ", g.name, " — ", g.category, " · ₩", Number(g.price || 0).toLocaleString("ko-KR")));
  }
  lines.push("", "* 출발 전 여행지 인근 24시 동물병원 위치를 꼭 확인하세요. (앱 '응급' 메뉴)");
  return lines.join("\n");
}

// A short, on-load "이번 주말" recommendation built from the app's own places.
function mockWeekend(payload) {
  const { region, size } = payload;
  const itin = pickItinerary({ region, size, days: 1 });
  const places = itin[0] ? itin[0].places : [];
  if (!places.length) {
    return "🐾 이번 주말 추천: 조건에 맞는 장소를 찾지 못했어요. 지역·크기 조건을 넓혀보세요.";
  }
  const lines = [line("🐾 이번 주말 반려동물 여행 추천 코스", region ? line(" · ", region) : "")];
  places.forEach((p, i) => {
    lines.push(line(String(i + 1), ". ", p.name, " (", p.category, ", ", p.region, " ", p.district, ")"));
  });
  lines.push("자세한 코스·준비물은 ‘AI 여행 도우미’에서 이어서 만들어보세요.");
  return lines.join("\n");
}

function mockGenerate(task, payload) {
  switch (task) {
    case "course": return mockCourse(payload);
    case "checklist": return mockChecklist(payload);
    case "weekend": return mockWeekend(payload);
    case "planner":
    default: return mockPlanner(payload);
  }
}

// Simulate token streaming for the mock so the UI behaves like the real thing.
async function streamOut(text, onToken) {
  if (!onToken) return;
  const tokens = text.match(/\s+|\S+/g) || [text];
  for (const t of tokens) {
    onToken(t);
    await new Promise((r) => setTimeout(r, 12));
  }
}

// Compact grounding sent to the real backend so Claude answers from OUR data.
function groundingFor(task, payload) {
  const places = candidatePlaces(payload).slice(0, 16).map((p) => ({
    name: p.name, category: p.category, region: p.region, district: p.district,
    petSizes: p.petSizes, amenities: (p.amenities || []).map(amenityLabel),
    summary: p.summary, hours: p.hours,
  }));
  const gear = task === "checklist"
    ? recommendGear(payload).map((g) => ({ name: g.name, category: g.category, price: g.price }))
    : undefined;
  return { places, gear };
}

// Offline mock, streamed via onToken. Also the 무인 auto-fallback path.
async function runMock(task, payload, onToken) {
  const text = mockGenerate(task, payload);
  await streamOut(text, onToken);
  return text;
}

/**
 * askAI — main entry. Returns the full response text; streams via onToken.
 * @param {"planner"|"course"|"checklist"|"weekend"} task
 * @param {object} payload  e.g. { region, size, days, notes, question }
 * @param {{ onToken?: (chunk: string) => void }} [opts]
 * @returns {Promise<string>}
 */
export async function askAI(task, payload = {}, { onToken } = {}) {
  // DEMO mode: deterministic offline mock.
  if (!AI_ENDPOINT) return runMock(task, payload, onToken);

  // REAL mode: stream from the backend proxy (which holds the API key).
  // 무인 resilience: any failure (network error, non-OK, or a 429 {fallback:true}
  // cost-cap response) transparently falls back to the offline mock.
  try {
    const body = { task, payload: { ...payload, grounding: groundingFor(task, payload) } };
    const res = await fetch(AI_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    // Cost cap / rate limit → { fallback: true } → use the mock.
    if (res.status === 429) return runMock(task, payload, onToken);
    if (!res.ok || !res.body) throw new Error("AI 요청이 실패했어요 (" + res.status + ")");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let full = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      full += chunk;
      if (onToken) onToken(chunk);
    }
    return full;
  } catch (err) {
    // Never break the app: fall back to the offline mock.
    console.warn("[askAI] endpoint failed — falling back to offline mock:", err && err.message ? err.message : err);
    return runMock(task, payload, onToken);
  }
}
