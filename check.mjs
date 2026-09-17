// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
//
// check.mjs — lightweight CI gate for the static SPA.
//   1) every data/*.json parses as valid JSON
//   2) `node --check` passes for every .js / .mjs file
//   3) index.html contains the required containers + module entry
// Exits non-zero on any failure.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, extname } from "node:path";

const ROOT = new URL(".", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
let failures = 0;
const ok = (m) => console.log("  \x1b[32mPASS\x1b[0m " + m);
const bad = (m) => { console.log("  \x1b[31mFAIL\x1b[0m " + m); failures++; };

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".git")) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const files = walk(ROOT);

// 1) JSON parses
console.log("\n[1] JSON files parse");
const jsonFiles = files.filter((f) => extname(f) === ".json" && !f.includes("package"));
if (!jsonFiles.length) bad("no JSON data files found");
for (const f of jsonFiles) {
  try {
    const data = JSON.parse(readFileSync(f, "utf8"));
    const n = Array.isArray(data) ? `${data.length} items` : "object";
    ok(`${rel(f)} (${n})`);
  } catch (e) {
    bad(`${rel(f)} — ${e.message}`);
  }
}

// data count sanity (seed expectations from the spec)
console.log("\n[2] Seed data counts");
try {
  const places = JSON.parse(readFileSync(join(ROOT, "data/places.json"), "utf8"));
  const gear = JSON.parse(readFileSync(join(ROOT, "data/gear.json"), "utf8"));
  places.length >= 40 ? ok(`places = ${places.length} (>= 40)`) : bad(`places = ${places.length} (< 40)`);
  gear.length >= 20 ? ok(`gear = ${gear.length} (>= 20)`) : bad(`gear = ${gear.length} (< 20)`);
} catch (e) {
  bad("could not read seed data: " + e.message);
}

// 3) node --check for JS
console.log("\n[3] node --check on JS modules");
const jsFiles = files.filter((f) => [".js", ".mjs"].includes(extname(f)));
for (const f of jsFiles) {
  try {
    execFileSync(process.execPath, ["--check", f], { stdio: "pipe" });
    ok(rel(f));
  } catch (e) {
    bad(`${rel(f)} — ${String(e.stderr || e.message).trim()}`);
  }
}

// 4) index.html required containers
console.log("\n[4] index.html required containers");
try {
  const html = readFileSync(join(ROOT, "index.html"), "utf8");
  const required = ['id="topbar"', 'id="app"', 'id="tabbar"', 'id="toast"', 'type="module"'];
  for (const token of required) {
    html.includes(token) ? ok(`contains ${token}`) : bad(`missing ${token}`);
  }
} catch (e) {
  bad("index.html not readable: " + e.message);
}

// 5) AI layer gates (ai/ + server/)
console.log("\n[5] AI layer (ai/ + server/)");
const aiDirs = ["ai", "server"].map((d) => join(ROOT, d));
for (const dir of aiDirs) {
  let present = false;
  try { present = statSync(dir).isDirectory(); } catch { present = false; }
  present ? ok(`${rel(dir)}/ exists`) : bad(`${rel(dir)}/ missing`);
}
// node --check every .js/.mjs under ai/ and server/
const aiFiles = files.filter((f) => {
  const r = rel(f);
  return (r.startsWith("ai/") || r.startsWith("server/")) && [".js", ".mjs"].includes(extname(f));
});
if (!aiFiles.length) bad("no AI-layer JS files found under ai/ or server/");
for (const f of aiFiles) {
  try {
    execFileSync(process.execPath, ["--check", f], { stdio: "pipe" });
    ok(`node --check ${rel(f)}`);
  } catch (e) {
    bad(`${rel(f)} — ${String(e.stderr || e.message).trim()}`);
  }
}
// AI_ENDPOINT must ship empty (no live endpoint / no key required for the demo)
try {
  const cfg = readFileSync(join(ROOT, "ai/config.js"), "utf8");
  /export\s+const\s+AI_ENDPOINT\s*=\s*(""|'')\s*;/.test(cfg)
    ? ok("ai/config.js AI_ENDPOINT is empty")
    : bad("ai/config.js AI_ENDPOINT must be an empty string in the shipped demo");
} catch (e) {
  bad("ai/config.js not readable: " + e.message);
}
// No real Anthropic API key committed anywhere (pattern split so this file never self-matches)
console.log("\n[6] No real API key committed");
const keyRe = new RegExp("sk-" + "ant-[A-Za-z0-9_-]{20,}");
let leaks = 0;
for (const f of files) {
  if ([".png", ".jpg", ".jpeg", ".gif", ".ico", ".woff", ".woff2"].includes(extname(f))) continue;
  let text = "";
  try { text = readFileSync(f, "utf8"); } catch { continue; }
  if (keyRe.test(text)) { bad(`possible API key in ${rel(f)}`); leaks++; }
}
if (!leaks) ok("no sk-ant-* key format found in tracked files");

function rel(f) {
  return f.replace(/\\/g, "/").replace(ROOT.replace(/\\/g, "/"), "").replace(/^\//, "");
}

console.log("");
if (failures) {
  console.error(`\x1b[31m✗ ${failures} check(s) failed\x1b[0m`);
  process.exit(1);
}
console.log("\x1b[32m✓ all checks passed\x1b[0m");
