// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
//
// ai/config.js — AI layer configuration.
//
// AI_ENDPOINT is the URL of the backend proxy that talks to Claude.
//   - Leave it EMPTY ("") for the default DEMO mode: a deterministic, offline
//     Korean MockProvider that reuses the app's own places/gear seed data.
//   - Set it (e.g. "http://localhost:8787/api/ai") to route requests through
//     the Node proxy in `server/`, which holds the real ANTHROPIC_API_KEY.
//
// SECURITY: never put an API key here or anywhere in the browser bundle / repo.
// The key lives ONLY on the server, as an environment variable. This file ships
// with an empty endpoint so the public demo can never leak or require a key.

export const AI_ENDPOINT = "";
