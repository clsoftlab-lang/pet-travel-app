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
// COST MODEL (무인·저비용):
//   • Cost-first default model claude-haiku-4-5 (configurable via AI_MODEL).
//   • Stable per-task system prompt sent as a cache_control:ephemeral block so
//     repeated calls read cache and cost less.
//   • Modest per-task max_tokens output caps.
//   • Per-IP rate limit + a monthly token budget; over budget → HTTP 429
//     {fallback:true} so the browser transparently falls back to the mock.
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
// Cost-first default. AI_MODEL may be raised to `claude-sonnet-5` or
// `claude-opus-5` for higher quality (and higher cost).
const MODEL = process.env.AI_MODEL || "claude-haiku-4-5";
const ORIGIN = process.env.CORS_ORIGIN || "*";

// Cost guardrails.
const RATE_LIMIT = Number(process.env.AI_RATE_LIMIT || 20);            // requests / minute / IP
const MONTHLY_TOKEN_CAP = Number(process.env.AI_MONTHLY_TOKEN_CAP || 2_000_000);

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// System prompts per task — Claude stays grounded in the payload data the app sends.
// These are STABLE strings → good prompt-cache keys.
const SYSTEM = {
  planner:
    "너는 반려동물 동반 여행을 돕는 한국어 여행 플래너야. 사용자의 지역·반려동물 크기·여행일수와 함께 제공된 후보 장소(payload.grounding.places)만 근거로 친절하고 구체적인 일정을 제안해. 목록에 없는 장소를 지어내지 말고, 반려동물 정책과 편의시설을 반영해.",
  course:
    "너는 반려동물 동반 여행 코스를 자동으로 짜는 한국어 도우미야. payload.grounding.places 안의 장소들만 사용해서 일차별(공원/카페 → 식당 → 숙소) 코스를 구성해. 각 장소의 카테고리·지역·편의시설을 간단히 덧붙여.",
  checklist:
    "너는 반려동물 동반 여행 준비물 체크리스트를 만드는 한국어 도우미야. 여행 조건(지역·크기·일수·메모)과 payload.grounding.gear 추천 용품을 반영해 실용적인 체크리스트를 만들어. 항목은 '☐ ' 로 시작해.",
  weekend:
    "너는 반려동물 동반 여행을 돕는 한국어 도우미야. payload.grounding.places 안의 장소들만 근거로 '이번 주말' 다녀올 만한 짧고 산뜻한 1~2곳 중심의 추천 코스를 3~5줄로 간결하게 제안해. 목록에 없는 장소는 지어내지 마.",
};

// Modest per-task output caps (raise only where a task truly needs it).
const MAX_TOKENS = { planner: 700, course: 900, checklist: 900, weekend: 400 };

const TASKS = ["planner", "course", "checklist", "weekend"];

function userMessage(task, payload) {
  const p = payload || {};
  return [
    task === "checklist" ? "준비물 체크리스트를 만들어줘." :
    task === "course" ? "여행 코스를 자동으로 만들어줘." :
    task === "weekend" ? "이번 주말 반려동물 여행 추천 코스를 짧게 알려줘." :
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

// Build request params, applying the model-specific thinking/effort rules.
// Haiku 4.5 does NOT accept adaptive thinking / effort (would 400) → send neither.
function buildParams(task, payload) {
  const params = {
    model: MODEL,
    max_tokens: MAX_TOKENS[task] || 700,
    // Prompt caching: stable system prompt as a cache_control:ephemeral block.
    system: [{ type: "text", text: SYSTEM[task] || SYSTEM.planner, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userMessage(task, payload) }],
  };
  if (!MODEL.startsWith("claude-haiku")) {
    params.thinking = { type: "adaptive" };
    params.output_config = { effort: process.env.AI_EFFORT || "low" };
  }
  return params;
}

// ---- cost guardrails (in-memory) ----
const hits = new Map();                 // ip -> number[] (recent request timestamps, ms)
function rateLimited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > RATE_LIMIT;
}

let budget = { month: new Date().getUTCMonth(), tokens: 0 };
function budgetExceeded() {
  const m = new Date().getUTCMonth();
  if (m !== budget.month) budget = { month: m, tokens: 0 };   // reset each month
  return budget.tokens >= MONTHLY_TOKEN_CAP;
}
function addUsage(usage) {
  if (!usage) return;
  const used =
    (usage.input_tokens || 0) + (usage.output_tokens || 0) +
    (usage.cache_creation_input_tokens || 0) + (usage.cache_read_input_tokens || 0);
  budget.tokens += used;
}

function clientIp(req) {
  const fwd = (req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return fwd || req.socket.remoteAddress || "unknown";
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
    res.end(JSON.stringify({
      ok: true, model: MODEL, hasKey: Boolean(process.env.ANTHROPIC_API_KEY),
      monthlyTokenCap: MONTHLY_TOKEN_CAP, tokensUsed: budget.tokens,
    }));
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

  // Cost guardrails → 429 {fallback:true} so the browser falls back to the mock.
  if (rateLimited(clientIp(req)) || budgetExceeded()) {
    res.writeHead(429, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ fallback: true }));
    return;
  }

  let task = "planner";
  let payload = {};
  try {
    const parsed = JSON.parse((await readBody(req)) || "{}");
    task = TASKS.includes(parsed.task) ? parsed.task : "planner";
    payload = parsed.payload || {};
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid JSON body" }));
    return;
  }

  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" });
  try {
    const stream = client.messages.stream(buildParams(task, payload));
    stream.on("text", (delta) => res.write(delta));
    const final = await stream.finalMessage();
    addUsage(final && final.usage);   // accumulate monthly token usage
    res.end();
  } catch (err) {
    console.error("[/api/ai] error:", err);
    if (!res.writableEnded) res.end("\n[AI 오류] " + (err && err.message ? err.message : "unknown"));
  }
});

server.listen(PORT, () => {
  console.log(`윗마이펫 AI proxy listening on http://localhost:${PORT}  (model: ${MODEL})`);
  console.log(`  cost guard: ${RATE_LIMIT}/min per IP, monthly cap ${MONTHLY_TOKEN_CAP.toLocaleString()} tokens`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("⚠ ANTHROPIC_API_KEY is not set — POST /api/ai will return 500 until you set it.");
  }
});
