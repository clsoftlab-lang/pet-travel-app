// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
//
// data.js — loads seed JSON (places, gear, meta) from ./data/*.json.
// This is fictional DEMO seed data, not a live source.

async function fetchJSON(path) {
  const res = await fetch(path, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.json();
}

export async function loadData() {
  const [places, gear, meta] = await Promise.all([
    fetchJSON("./data/places.json"),
    fetchJSON("./data/gear.json"),
    fetchJSON("./data/meta.json"),
  ]);
  return { places, gear, meta };
}
