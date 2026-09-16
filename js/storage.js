// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
//
// storage.js — localStorage wrapper (demo persistence). All reads/writes are
// wrapped in try/catch so the app keeps working when storage is blocked
// (private mode, quota, disabled cookies). Nothing here is a real database.

const PREFIX = "wmp.";
const KEYS = ["profile", "trips", "reviews", "cart", "wishlist", "checklist", "theme"];

let memoryFallback = {}; // used when localStorage is unavailable

function available() {
  try {
    const t = PREFIX + "__test__";
    window.localStorage.setItem(t, "1");
    window.localStorage.removeItem(t);
    return true;
  } catch (e) {
    return false;
  }
}

const HAS_LS = available();

export function load(key, fallback) {
  try {
    if (!HAS_LS) {
      return key in memoryFallback ? memoryFallback[key] : fallback;
    }
    const raw = window.localStorage.getItem(PREFIX + key);
    if (raw === null || raw === undefined) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.warn("[storage] load failed for", key, e);
    return fallback;
  }
}

export function save(key, value) {
  try {
    if (!HAS_LS) {
      memoryFallback[key] = value;
      return true;
    }
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.warn("[storage] save failed for", key, e);
    memoryFallback[key] = value;
    return false;
  }
}

export function resetAll() {
  try {
    memoryFallback = {};
    if (HAS_LS) {
      for (const k of KEYS) window.localStorage.removeItem(PREFIX + k);
    }
    return true;
  } catch (e) {
    console.warn("[storage] reset failed", e);
    return false;
  }
}

export const storageAvailable = HAS_LS;
