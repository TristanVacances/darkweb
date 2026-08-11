/*
 * DARKWEB — content orchestrator (the engine).
 *
 * Top frame: owns ONE fixed, click-through black overlay whose flashlight halo
 * follows the cursor, plus the spooky drone. Child frames: relay their local
 * mouse position up to the top frame so the beam keeps tracking over iframes.
 *
 * Storage-driven: reacts to chrome.storage.onChanged, no message passing.
 * Depends (same isolated world, loaded before this file):
 *   DarkwebState, DarkwebHalo, DarkwebDrone.
 */
(function () {
  "use strict";

  const State = globalThis.DarkwebState;
  const Halo = globalThis.DarkwebHalo;
  const Drone = globalThis.DarkwebDrone;
  const OVERLAY_ID = "darkweb-overlay";
  const isTop = window.top === window;

  function log(msg, err) {
    if (err) console.warn("[DARKWEB] " + msg, err);
  }

  // ---------------------------------------------------------------------------
  // Child frames: just relay mouse coords to the top frame while blackout is on.
  // ---------------------------------------------------------------------------
  if (!isTop) {
    let relayOn = false;
    window.addEventListener(
      "mousemove",
      (e) => {
        if (!relayOn) return;
        try {
          window.top.postMessage(
            { __darkweb: true, type: "MOUSE", x: e.clientX, y: e.clientY },
            "*"
          );
        } catch (_e) {
          /* cross-origin top may reject in exotic cases — non-fatal */
        }
      },
      true
    );
    try {
      chrome.storage.local.get({ enabled: false }, (v) => {
        relayOn = !!(v && v.enabled);
      });
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && changes && "enabled" in changes) {
          relayOn = !!changes.enabled.newValue;
        }
      });
    } catch (e) {
      log("child storage unavailable", e);
    }
    return;
  }

  // ---------------------------------------------------------------------------
  // Top frame: the real engine.
  // ---------------------------------------------------------------------------
  let settings = Object.assign({}, State.DEFAULTS);
  let active = false;
  let overlay = null;
  let mouseX = null;
  let mouseY = null;
  let rafId = null;
  let flickerPhase = 0;

  function ensureOverlay() {
    let el = document.getElementById(OVERLAY_ID);
    if (!el) {
      el = document.createElement("div");
      el.id = OVERLAY_ID;
      el.setAttribute("aria-hidden", "true");
      const s = el.style;
      s.position = "fixed";
      s.left = "0";
      s.top = "0";
      s.width = "100vw";
      s.height = "100vh";
      s.margin = "0";
      s.padding = "0";
      s.border = "0";
      s.pointerEvents = "none"; // click-through: page stays usable
      s.zIndex = "2147483647";
      s.background = "#000";
    }
    const host = document.documentElement || document.body;
    if (host && el.parentNode !== host) host.appendChild(el);
    overlay = el;
    return el;
  }

  function requestPaint() {
    if (rafId == null) rafId = requestAnimationFrame(paint);
  }

  function paint() {
    rafId = null;
    if (!active || !overlay) return;

    let r = settings.radius;
    let d = settings.darkness;

    if (settings.flicker) {
      flickerPhase += 0.3;
      // Smooth-ish torch flicker: layered sines + a little jitter.
      const f =
        Math.sin(flickerPhase) * 0.5 +
        Math.sin(flickerPhase * 2.3) * 0.3 +
        (Math.random() - 0.5) * 0.4;
      r = r * (1 + f * 0.06); // ±~6% radius
      d = Math.min(1, Math.max(0, d - Math.abs(f) * 0.02)); // dim on flicker
    }

    const x = mouseX == null ? window.innerWidth / 2 : mouseX;
    const y = mouseY == null ? window.innerHeight / 2 : mouseY;
    // Vignette layer on top, halo layer beneath.
    overlay.style.background =
      Halo.vignetteBackground(d) + ", " + Halo.haloBackground(x, y, r, d);

    // Keep the flicker loop alive while enabled.
    if (settings.flicker && active) requestPaint();
  }

  function onMouseMove(e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
    requestPaint();
  }

  function onMessage(e) {
    const data = e && e.data;
    if (!data || data.__darkweb !== true || data.type !== "MOUSE") return;
    // Find which iframe sent this by matching the source window, then add the
    // iframe's on-screen offset. Element geometry is readable even cross-origin.
    const frames = document.getElementsByTagName("iframe");
    for (let i = 0; i < frames.length; i++) {
      let cw = null;
      try {
        cw = frames[i].contentWindow;
      } catch (_e) {
        cw = null;
      }
      if (cw && cw === e.source) {
        const rect = frames[i].getBoundingClientRect();
        mouseX = rect.left + data.x;
        mouseY = rect.top + data.y;
        requestPaint();
        return;
      }
    }
    // Frame nested ≥2 deep or not found: documented limitation, ignore.
  }

  function onKeyDown(e) {
    if (e.key === "Escape" || e.keyCode === 27) {
      State.set({ enabled: false }); // storage change re-greys the icon everywhere
    }
  }

  function enable() {
    if (active) return;
    active = true;
    ensureOverlay();
    window.addEventListener("mousemove", onMouseMove, true);
    window.addEventListener("message", onMessage, false);
    window.addEventListener("keydown", onKeyDown, true);
    paint();
    if (settings.flicker) requestPaint(); // kick the flicker loop
    if (settings.music) Drone.start(settings.volume);
  }

  function disable() {
    active = false;
    window.removeEventListener("mousemove", onMouseMove, true);
    window.removeEventListener("message", onMessage, false);
    window.removeEventListener("keydown", onKeyDown, true);
    if (rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    overlay = null;
    Drone.stop();
  }

  function liveUpdate() {
    if (settings.music && !Drone.isRunning()) Drone.start(settings.volume);
    else if (!settings.music && Drone.isRunning()) Drone.stop();
    else if (settings.music) Drone.setVolume(settings.volume);
    requestPaint();
  }

  function reflect() {
    State.get()
      .then((st) => {
        settings = Object.assign({}, State.DEFAULTS, st);
        if (st.enabled) {
          if (!active) enable();
          else liveUpdate();
        } else if (active) {
          disable();
        }
      })
      .catch((e) => log("reflect failed", e));
  }

  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local") reflect();
    });
  } catch (e) {
    log("onChanged unavailable", e);
  }

  // Keep the halo sane on resize (recentres the default position).
  window.addEventListener("resize", () => {
    if (active) requestPaint();
  });

  reflect(); // initial state at document_start
})();
