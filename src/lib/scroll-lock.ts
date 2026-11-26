"use client";

import { useEffect } from "react";

/**
 * One shared lock for "stop the page scrolling behind this popup".
 *
 * Popups used to each save body.style.overflow, set "hidden", and put the
 * saved value back when they closed. With two popups open (e.g. a contact
 * and its "Greet on WhatsApp" sheet), the inner one could save "hidden"
 * and restore it last, leaving the page unable to scroll. A counter fixes
 * that: the page is unlocked only when the last popup closes.
 */
let count = 0;
let saved = "";

export function lockScroll() {
  if (typeof document === "undefined") return;
  if (count === 0) {
    saved = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  count += 1;
}

export function unlockScroll() {
  if (typeof document === "undefined" || count === 0) return;
  count -= 1;
  if (count === 0) document.body.style.overflow = saved === "hidden" ? "" : saved;
}

/** Locks page scrolling while `active` is true (default) and the component is mounted. */
export function useScrollLock(active = true) {
  useEffect(() => {
    if (!active) return;
    lockScroll();
    return unlockScroll;
  }, [active]);
}
