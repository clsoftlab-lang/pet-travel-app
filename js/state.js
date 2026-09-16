// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
//
// state.js — in-memory app state backed by localStorage (DEMO persistence).
// A tiny pub/sub lets views re-render when state changes.

import { load, save, resetAll, storageAvailable } from "./storage.js";

const listeners = new Set();

export const state = {
  places: [],
  gear: [],
  meta: {},
  profile: load("profile", null),
  trips: load("trips", []),
  reviews: load("reviews", {}),      // { placeId: [review, ...] }
  cart: load("cart", {}),            // { gearId: qty }
  wishlist: load("wishlist", []),    // [placeId, ...]
  checklist: load("checklist", {}),  // { checkId: true }
  theme: load("theme", "auto"),
};

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit() {
  for (const fn of listeners) fn();
}

function uid(prefix) {
  return prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ---- profile ----
export function setProfile(p) {
  state.profile = p;
  save("profile", p);
  emit();
}

// ---- wishlist ----
export function isWished(placeId) {
  return state.wishlist.includes(placeId);
}
export function toggleWish(placeId) {
  const i = state.wishlist.indexOf(placeId);
  if (i >= 0) state.wishlist.splice(i, 1);
  else state.wishlist.push(placeId);
  save("wishlist", state.wishlist);
  emit();
  return isWished(placeId);
}

// ---- trips (여행 코스) ----
export function createTrip(name) {
  const trip = { id: uid("t"), name: name || "새 여행 코스", placeIds: [], createdAt: Date.now() };
  state.trips.push(trip);
  save("trips", state.trips);
  emit();
  return trip;
}
export function renameTrip(id, name) {
  const t = state.trips.find((x) => x.id === id);
  if (t) { t.name = name; save("trips", state.trips); emit(); }
}
export function deleteTrip(id) {
  state.trips = state.trips.filter((x) => x.id !== id);
  save("trips", state.trips);
  emit();
}
export function addPlaceToTrip(tripId, placeId) {
  const t = state.trips.find((x) => x.id === tripId);
  if (t && !t.placeIds.includes(placeId)) {
    t.placeIds.push(placeId);
    save("trips", state.trips);
    emit();
    return true;
  }
  return false;
}
export function removePlaceFromTrip(tripId, placeId) {
  const t = state.trips.find((x) => x.id === tripId);
  if (t) {
    t.placeIds = t.placeIds.filter((p) => p !== placeId);
    save("trips", state.trips);
    emit();
  }
}
export function reorderTripPlace(tripId, placeId, dir) {
  const t = state.trips.find((x) => x.id === tripId);
  if (!t) return;
  const i = t.placeIds.indexOf(placeId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= t.placeIds.length) return;
  [t.placeIds[i], t.placeIds[j]] = [t.placeIds[j], t.placeIds[i]];
  save("trips", state.trips);
  emit();
}

// ---- reviews (커뮤니티) ----
export function addReview(placeId, review) {
  const r = {
    id: uid("r"),
    author: review.author || "익명 집사",
    rating: Math.min(5, Math.max(1, Number(review.rating) || 5)),
    text: review.text || "",
    photoColor: review.photoColor || null,
    createdAt: Date.now(),
  };
  if (!state.reviews[placeId]) state.reviews[placeId] = [];
  state.reviews[placeId].unshift(r);
  save("reviews", state.reviews);
  emit();
  return r;
}
export function getReviews(placeId) {
  return state.reviews[placeId] || [];
}
export function allReviews() {
  const out = [];
  for (const pid of Object.keys(state.reviews)) {
    for (const r of state.reviews[pid]) out.push({ ...r, placeId: pid });
  }
  return out.sort((a, b) => b.createdAt - a.createdAt);
}

// ---- cart (모의 장바구니) ----
export function addToCart(gearId, qty = 1) {
  state.cart[gearId] = (state.cart[gearId] || 0) + qty;
  save("cart", state.cart);
  emit();
}
export function setCartQty(gearId, qty) {
  if (qty <= 0) delete state.cart[gearId];
  else state.cart[gearId] = qty;
  save("cart", state.cart);
  emit();
}
export function cartCount() {
  return Object.values(state.cart).reduce((a, b) => a + b, 0);
}
export function clearCart() {
  state.cart = {};
  save("cart", state.cart);
  emit();
}

// ---- checklist ----
export function toggleCheck(id) {
  state.checklist[id] = !state.checklist[id];
  save("checklist", state.checklist);
  emit();
}

// ---- theme ----
export function setTheme(theme) {
  state.theme = theme;
  save("theme", theme);
  emit();
}

// ---- reset everything ----
export function resetDemo() {
  resetAll();
  state.profile = null;
  state.trips = [];
  state.reviews = {};
  state.cart = {};
  state.wishlist = [];
  state.checklist = {};
  state.theme = "auto";
  emit();
}

export { storageAvailable };
