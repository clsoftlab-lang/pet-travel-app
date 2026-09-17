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

`task` is one of `planner` | `course` | `checklist`. The server builds a grounded
prompt from `payload` (including the candidate places/gear the app sends in
`payload.grounding`) and streams the model's text back via
`client.messages.stream({ model: "claude-opus-5", max_tokens: 2048, thinking: { type: "adaptive" }, ... })`.

`GET /health` returns `{ ok, model, hasKey }` for a quick sanity check.

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

## Environment variables

| Variable            | Default        | Notes                                            |
| ------------------- | -------------- | ------------------------------------------------ |
| `ANTHROPIC_API_KEY` | *(required)*   | Server-side only. Starts with `sk-ant-`.         |
| `ANTHROPIC_MODEL`   | `claude-opus-5`| Model id.                                        |
| `PORT`              | `8787`         | Listen port.                                     |
| `CORS_ORIGIN`       | `*`            | Set to your site origin in production.           |

## Notes

- CI never installs or runs this (`node check.mjs` only syntax-checks it).
- Do not commit `.env`. Only `.env.example` is tracked.
