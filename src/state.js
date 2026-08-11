/*
 * DARKWEB — shared state (chrome.storage.local wrapper).
 * Exposes globalThis.DarkwebState = { DEFAULTS, get, set }.
 * The toolbar toggle, the hotkey, and the popup all write here; content scripts
 * react via chrome.storage.onChanged — so there is no message passing and no
 * "tabs" permission.
 *
 *   enabled  — blackout on/off
 *   radius   — clear-core radius of the flashlight halo, in px
 *   darkness — max opacity (0..1) of the black outside the halo
 *   flicker  — torch-style jitter of the beam
 *   music    — spooky Web Audio drone on/off
 *   volume   — drone master volume (0..1), kept low by default
 */
(function () {
  "use strict";
  const DEFAULTS = {
    enabled: false,
    radius: 70,
    darkness: 1.0,
    flicker: true,
    music: true,
    volume: 0.15,
  };

  function get() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(DEFAULTS, (v) =>
          resolve(Object.assign({}, DEFAULTS, v))
        );
      } catch (_e) {
        resolve(Object.assign({}, DEFAULTS));
      }
    });
  }

  function set(patch) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set(patch, () => resolve());
      } catch (_e) {
        resolve();
      }
    });
  }

  globalThis.DarkwebState = { DEFAULTS, get, set };
})();
