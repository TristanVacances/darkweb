/*
 * DARKWEB — flashlight halo geometry (pure, deterministic, side-effect free).
 *
 * Exposes globalThis.DarkwebHalo = { clampNum, haloBackground, vignetteBackground }.
 * No import/export so this same file runs both as an MV3 content script and,
 * loaded via node:vm, under the unit tests.
 *
 * The overlay is a single fixed <div>. Its `background` is two stacked layers:
 *   1. the halo   — a radial-gradient centred on the cursor: transparent core,
 *                   soft feather, then solid black(darkness) everywhere else;
 *   2. the vignette — a static radial-gradient darkening the screen corners a touch.
 * The div paints ON TOP of the page with pointer-events:none, so the page stays
 * fully usable underneath.
 */
(function () {
  "use strict";

  /**
   * Coerce to a finite number within [min,max]; fall back to `fallback`
   * for nil / NaN / wrong-type input. Loud-safe: never throws.
   */
  function clampNum(v, min, max, fallback) {
    // Nil / empty coerce to 0 via Number(); treat them as "unset" → fallback.
    if (v === null || v === undefined || v === "") return fallback;
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) return fallback;
    if (n < min) return min;
    if (n > max) return max;
    return n;
  }

  /**
   * Build the halo radial-gradient string for a cursor at (x,y).
   * @param {number} x        cursor client X (px)
   * @param {number} y        cursor client Y (px)
   * @param {number} radius   clear-core radius (px)
   * @param {number} darkness max black opacity outside the halo (0..1)
   * @returns {string} a CSS radial-gradient(...)
   */
  function haloBackground(x, y, radius, darkness) {
    const px = clampNum(x, -1e5, 1e5, 0);
    const py = clampNum(y, -1e5, 1e5, 0);
    const core = clampNum(radius, 0, 2000, 70);
    const dark = clampNum(darkness, 0, 1, 0.98);
    // feather ~= core so the beam falls off gently ("soft feathered").
    const feather = core;
    const mid = core + feather;
    // A soft mid-stop keeps the edge from banding.
    const half = (core + mid) / 2;
    return (
      "radial-gradient(circle at " +
      px +
      "px " +
      py +
      "px, " +
      "rgba(0,0,0,0) 0px, " +
      "rgba(0,0,0,0) " +
      core +
      "px, " +
      "rgba(0,0,0," +
      (dark * 0.55).toFixed(3) +
      ") " +
      half.toFixed(1) +
      "px, " +
      "rgba(0,0,0," +
      dark.toFixed(3) +
      ") " +
      mid +
      "px)"
    );
  }

  /**
   * Static corner-vignette layer (independent of cursor). Subtle by design.
   * @param {number} darkness master darkness (0..1) — vignette scales off it
   * @returns {string} a CSS radial-gradient(...)
   */
  function vignetteBackground(darkness) {
    const dark = clampNum(darkness, 0, 1, 0.98);
    const edge = Math.min(1, dark * 0.35);
    return (
      "radial-gradient(ellipse at center, " +
      "rgba(0,0,0,0) 55%, " +
      "rgba(0,0,0," +
      edge.toFixed(3) +
      ") 100%)"
    );
  }

  const api = { clampNum, haloBackground, vignetteBackground };
  if (typeof globalThis !== "undefined") globalThis.DarkwebHalo = api;
})();
