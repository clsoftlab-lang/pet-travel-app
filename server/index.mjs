// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
//
// server/index.mjs — OPTIONAL backend proxy that connects the 윗마이펫 AI layer
// to the real Claude API. The public static demo does NOT need this: it runs on
// the offline MockProvider (ai/config.js AI_ENDPOINT === "").
//
// SECURITY MODEL:
//   • The ANTHROPIC_API_KEY lives ONLY here, as an environment variable.
//   • It is NEVER sent to, or readable by, the browser.
//   • The browser only ever talks to POST /api/ai and receives streamed text.
//
// Enable real AI:
//   1) cd server && npm install
//   2) copy .env.example → .env and set ANTHROPIC_API_KEY (starts with sk-ant-)
//   3) npm start                       (defaults to http://localhost:8787)
//   4) set AI_ENDPOINT in ai/config.js → "http://localhost:8787/api/ai"
//
// This file is intentionally not exercised in CI (no install / no network).

import http from "node:http";
import { readFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";

// ---- minimal .env loader (no dependency) ----
try {
  const env = readFileSync(new URL("./.env", import.meta.url), "utf8");
  for (const raw of env.split(/\r?\n/)) {
    const m = raw.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
} catch { /* no .env file — rely on the ambient environment */ }

const PORT = Number(process.env.PORT || 8787);
const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5";
const ORIGIN = process.env.CORS_ORIGIN || "*";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// System prompts per task — Claude stays grounded in the payload data the app sends.
const SYSTEM = {
  planner:
    "너는 반려동물 동반 여행을 돕는 한국어 여행 플래너야. 사용자의 지역·반려동물 크기·여행일수와 함께 제공된 후보 장소(payload.grounding.places)만 근거로 친절하고 구체적인 일정을 제안해. 목록에 없는 장소를 지어내지 말고, 반려동물 정책과 편의시설을 반영해.",
  course:
    "너는 반려동물 동반 여행 코스를 자동으로 짜는 한국어 도우미야. payload.grounding.places 안의 장소들만 사용해서 일차별(공원/카페 → 식당 → 숙소) 코스를 구성해. 각 장소의 카테고리·지역·편의시설을 간단히 덧붙여.",
  checklist:
    "너는 반려동물 동반 여행 준비물 체크리스트를 만드는 한국어 도우미야. 여행 조건(지역·크기·일수·메모)과 payload.grounding.gear 추천 용품을 반영해 실용적인 체크리스트를 만들어. 항목은 '☐ ' 로 시작해.",
};

function userMessage(task, payload) {
  const p = payload || {};
  return [
    task === "checklist" ? "준비물 체크리스트를 만들어줘." :
    task === "course" ? "여행 코스를 자동으로 만들어줘." :
    (p.question ? p.question : "여행 일정을 추천해줘."),
    "",
    "조건(JSON):",
    JSON.stringify({
      region: p.region || null, size: p.size || null, days: p.days || null, notes: p.notes || null,
    }),
    "",
    "근거 데이터(JSON, 이 목록만 사용):",
    JSON.stringify(p.grounding || {}),
  ].join("\n");
}

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, model: MODEL, hasKey: Boolean(process.env.ANTHROPIC_API_KEY) }));
    return;
  }

  if (req.method !== "POST" || (req.url || "").split("?")[0] !== "/api/ai") {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "ANTHROPIC_API_KEY is not set on the server." }));
    return;
  }

  let task = "planner";
  let payload = {};
  try {
    const parsed = JSON.parse((await readBody(req)) || "{}");
    task = ["planner", "course", "checklist"].includes(parsed.task) ? parsed.task : "planner";
    payload = parsed.payload || {};
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid JSON body" }));
    return;
  }

  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" });
  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 2048,
      thinking: { type: "adaptive" },
      system: SYSTEM[task] || SYSTEM.planner,
      messages: [{ role: "user", content: userMessage(task, payload) }],
    });
    stream.on("text", (delta) => res.write(delta));
    await stream.finalMessage();
    res.end();
  } catch (err) {
    console.error("[/api/ai] error:", err);
    if (!res.writableEnded) res.end("\n[AI 오류] " + (err && err.message ? err.message : "unknown"));
  }
});

server.listen(PORT, () => {
  console.log(`윗마이펫 AI proxy listening on http://localhost:${PORT}  (model: ${MODEL})`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("⚠ ANTHROPIC_API_KEY is not set — POST /api/ai will return 500 until you set it.");
  }
});
