// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
//
// server/worker.js — Cloudflare Workers variant of the 윗마이펫 AI proxy.
//
// 무인(autonomous): deploy once to the Cloudflare Workers FREE tier and there is
// no server to babysit. It calls the Anthropic REST API directly and relays the
// assistant text back to the browser (SSE stream). Same task routing + model +
// prompt-caching + output-cap rules as server/index.mjs.
//
// SECURITY: the key lives ONLY as the Worker secret ANTHROPIC_API_KEY
//   wrangler secret put ANTHROPIC_API_KEY
// It is NEVER sent to, embedded in, or readable by the browser or the repo.
//
// Deploy:
//   cd server
//   npx wrangler deploy                 # uses wrangler.toml
//   npx wrangler secret put ANTHROPIC_API_KEY
// Then set AI_ENDPOINT in ai/config.js to the Worker URL + "/api/ai".

// Cost-first default. Override with the AI_MODEL var (wrangler.toml [vars]).
const DEFAULT_MODEL = "claude-haiku-4-5";

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
const MAX_TOKENS = { planner: 700, course: 900, checklist: 900, weekend: 400 };
const TASKS = ["planner", "course", "checklist", "weekend"];

function userMessage(task, payload) {
  const p = payload || {};
  const first =
    task === "checklist" ? "준비물 체크리스트를 만들어줘." :
    task === "course" ? "여행 코스를 자동으로 만들어줘." :
    task === "weekend" ? "이번 주말 반려동물 여행 추천 코스를 짧게 알려줘." :
    (p.question ? p.question : "여행 일정을 추천해줘.");
  return [
    first, "",
    "조건(JSON):",
    JSON.stringify({ region: p.region || null, size: p.size || null, days: p.days || null, notes: p.notes || null }),
    "",
    "근거 데이터(JSON, 이 목록만 사용):",
    JSON.stringify(p.grounding || {}),
  ].join("\n");
}

function cors(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = env.CORS_ORIGIN || "*";
    const model = env.AI_MODEL || DEFAULT_MODEL;

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });

    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, model, hasKey: Boolean(env.ANTHROPIC_API_KEY) }, { headers: cors(origin) });
    }

    if (request.method !== "POST" || url.pathname !== "/api/ai") {
      return Response.json({ error: "Not found" }, { status: 404, headers: cors(origin) });
    }
    if (!env.ANTHROPIC_API_KEY) {
      return Response.json({ error: "ANTHROPIC_API_KEY is not set on the Worker." }, { status: 500, headers: cors(origin) });
    }

    let task = "planner", payload = {};
    try {
      const parsed = await request.json();
      task = TASKS.includes(parsed.task) ? parsed.task : "planner";
      payload = parsed.payload || {};
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400, headers: cors(origin) });
    }

    // Build the Anthropic request. Model-specific thinking/effort rules:
    // Haiku 4.5 accepts NEITHER adaptive thinking NOR effort (would 400).
    const body = {
      model,
      max_tokens: MAX_TOKENS[task] || 700,
      stream: true,
      system: [{ type: "text", text: SYSTEM[task] || SYSTEM.planner, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userMessage(task, payload) }],
    };
    if (!model.startsWith("claude-haiku")) {
      body.thinking = { type: "adaptive" };
      body.output_config = { effort: env.AI_EFFORT || "low" };
    }

    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => "");
      return new Response("\n[AI 오류] upstream " + upstream.status + " " + detail, {
        status: 200, headers: { "Content-Type": "text/plain; charset=utf-8", ...cors(origin) },
      });
    }

    // Relay the Anthropic SSE stream, emitting only the text deltas as plain text
    // (matches server/index.mjs and what ai/ai.js expects).
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    let buf = "";
    const out = new ReadableStream({
      async pull(controller) {
        const { value, done } = await reader.read();
        if (done) { controller.close(); return; }
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          const s = line.trim();
          if (!s.startsWith("data:")) continue;
          const json = s.slice(5).trim();
          if (!json || json === "[DONE]") continue;
          try {
            const ev = JSON.parse(json);
            if (ev.type === "content_block_delta" && ev.delta && typeof ev.delta.text === "string") {
              controller.enqueue(encoder.encode(ev.delta.text));
            }
          } catch { /* ignore keep-alive / non-JSON lines */ }
        }
      },
      cancel() { reader.cancel(); },
    });

    return new Response(out, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache", ...cors(origin) },
    });
  },
};
