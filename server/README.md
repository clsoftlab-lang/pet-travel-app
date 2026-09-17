<!--
  SPDX-License-Identifier: Apache-2.0
  Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
-->
# 윗마이펫 AI Proxy (server/)

An **optional** Node backend that connects the app's AI layer to the **real Claude API**.
The public static demo does **not** need this — it runs on an offline Korean
MockProvider. Run this proxy only when you want live Claude responses.

## 🔒 Security model (read first)

- **The `ANTHROPIC_API_KEY` lives only here, as an environment variable.**
- **The key is never sent to, embedded in, or readable by the browser or the repo.**
- The browser talks only to `POST /api/ai` and receives streamed **text** — never the key.

## What it does

`POST /api/ai` with a JSON body:

```json
{ "task": "planner", "payload": { "region": "제주", "size": "small", "days": 2 } }
```

`task` is one of `planner` | `course` | `checklist` | `weekend`. The server builds a
grounded prompt from `payload` (including the candidate places/gear the app sends in
`payload.grounding`) and streams the model's text back via `client.messages.stream(...)`.

`GET /health` returns `{ ok, model, hasKey, monthlyTokenCap, tokensUsed }` for a quick sanity check.

## 💰 Cost model (무인·저비용)

- **Cost-first default model `claude-haiku-4-5`** ($1 / $5 per MTok in/out). Raise via
  `AI_MODEL` to `claude-sonnet-5` or `claude-opus-5` for higher quality.
- **Prompt caching** — the stable per-task system prompt is sent as a
  `cache_control:{type:'ephemeral'}` block, so repeated calls read cache and cost less.
- **Thinking/effort** — for Haiku, **no** `thinking`/effort is sent (Haiku 4.5 rejects them
  with a 400). For sonnet/opus the proxy sends `thinking:{type:'adaptive'}` and
  `output_config:{effort: AI_EFFORT}` (default `low`).
- **Output caps** — modest per-task `max_tokens` (~700 default).
- **Cost guardrails** — a per-IP rate limit (`AI_RATE_LIMIT`, default 20/min) and a monthly
  token budget (`AI_MONTHLY_TOKEN_CAP`, default 2,000,000). When exceeded the proxy returns
  **HTTP 429 `{fallback:true}`** and the browser transparently falls back to the offline mock.

## Run it

```bash
cd server
npm install                     # installs @anthropic-ai/sdk
cp .env.example .env            # then edit .env and set ANTHROPIC_API_KEY
npm start                       # → http://localhost:8787
```

Then point the front-end at the proxy by editing **`ai/config.js`**:

```js
export const AI_ENDPOINT = "http://localhost:8787/api/ai";
```

Reload the app — the AI 도우미 screen now streams real Claude responses. Reset
`AI_ENDPOINT` back to `""` to return to offline demo (mock) mode.

## ☁️ Free serverless deploy — Cloudflare Workers (무인)

`worker.js` + `wrangler.toml` are a **Cloudflare Workers** variant that calls the Anthropic
REST API directly with the same task routing, model, prompt-caching and output-cap rules.
On the **free tier there is no server to babysit**:

```bash
cd server
npx wrangler deploy                    # deploys worker.js (uses wrangler.toml)
npx wrangler secret put ANTHROPIC_API_KEY   # key stays a server-side secret
```

Then set `AI_ENDPOINT` in `ai/config.js` to your Worker URL + `/api/ai`
(e.g. `"https://witmypet-ai-proxy.<subdomain>.workers.dev/api/ai"`). The Worker streams the
assistant text back exactly like the Node proxy. Tune `AI_MODEL` / `AI_EFFORT` / `CORS_ORIGIN`
in `wrangler.toml` `[vars]`; the key is **never** in `[vars]` — only `wrangler secret put`.

## Environment variables

| Variable               | Default           | Notes                                                        |
| ---------------------- | ----------------- | ------------------------------------------------------------ |
| `ANTHROPIC_API_KEY`    | *(required)*      | Server-side only. Starts with `sk-ant-`.                     |
| `AI_MODEL`             | `claude-haiku-4-5`| Cost-first default. May be raised to `claude-sonnet-5`/`claude-opus-5`. |
| `AI_EFFORT`            | `low`             | Effort for sonnet/opus (ignored for Haiku).                  |
| `AI_RATE_LIMIT`        | `20`              | Max requests per minute per IP.                              |
| `AI_MONTHLY_TOKEN_CAP` | `2000000`         | Monthly token budget; over budget → 429 `{fallback:true}`.  |
| `PORT`                 | `8787`            | Listen port (Node proxy only).                              |
| `CORS_ORIGIN`          | `*`               | Set to your site origin in production.                       |

## Notes

- CI never installs or runs this (`node check.mjs` only syntax-checks it, incl. `worker.js`).
- Do not commit `.env`. Only `.env.example` is tracked.
