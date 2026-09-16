// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
//
// ui.js — small DOM + formatting helpers, toast notifications, and a modal.

import { escapeText } from "./svg.js";

export function h(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function won(n) {
  return "₩" + Number(n || 0).toLocaleString("ko-KR");
}

export function stars(rating) {
  const full = Math.round(Number(rating) || 0);
  let s = "";
  for (let i = 1; i <= 5; i++) s += i <= full ? "★" : "☆";
  return `<span class="stars" aria-label="별점 ${rating}점">${s}</span>`;
}

let toastTimer = null;
export function toast(msg, kind = "ok") {
  const el = document.getElementById("toast");
  if (!el) return;
  el.className = "toast show " + kind;
  el.textContent = msg;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.className = "toast";
  }, 2200);
}

// Lightweight modal. content = HTML string. Returns the overlay element.
export function modal(title, contentHTML, onMount) {
  closeModal();
  const overlay = h(`
    <div class="modal-overlay" role="dialog" aria-modal="true" aria-label="${escapeText(title)}">
      <div class="modal">
        <div class="modal-head">
          <h2>${escapeText(title)}</h2>
          <button class="icon-btn" data-close aria-label="닫기">✕</button>
        </div>
        <div class="modal-body">${contentHTML}</div>
      </div>
    </div>`);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay || e.target.hasAttribute("data-close")) closeModal();
  });
  document.body.appendChild(overlay);
  document.body.classList.add("modal-open");
  if (onMount) onMount(overlay);
  return overlay;
}

export function closeModal() {
  const ex = document.querySelector(".modal-overlay");
  if (ex) ex.remove();
  document.body.classList.remove("modal-open");
}

// Delegated helper for query
export function qs(sel, root = document) {
  return root.querySelector(sel);
}
export function qsa(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
}
