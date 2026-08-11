# HANDOFF — DARKWEB

## Status: ✅ BUILT, TESTED, PACKAGED — not yet store-submitted (Tristan's gated step)
Joke MV3 Chrome extension: turns any page pitch-black, mouse = flashlight, spooky
Web Audio drone. Forked from `~/Documents/chienternet/`'s skeleton. Family:
CHIENTERNET / RIGOLOL / SCATERNET / DARKWEB.

- Project: `~/Documents/darkweb/`
- Tests: `npm test` → **9/9 green** (8 unit + 1 Playwright e2e loading the real
  unpacked build). e2e proves: overlay appears on enable, `pointer-events:none`,
  covers viewport, halo follows the mouse, **click-through works** (clicks a button
  under the black and it fires), `Esc` removes the overlay + flips storage off,
  re-enable works after a full teardown.
- Package: `npm run build` → `darkweb-v1.0.0.zip` (runtime files only).

## Architecture (storage-driven, no message passing)
`chrome.storage.local` is the single source of truth. Popup + toolbar click +
hotkey command + `Esc` all just write storage; content scripts react via
`storage.onChanged`. Only permissions: `storage` + `commands`. No network, no
`tabs`, no host permissions, no web-accessible resources → trivial privacy story.

Content scripts load in order (`manifest.json`): `state.js` → `halo.js` →
`drone.js` → `darkweb.js`, at `document_start`, `all_frames: true`.

- **`src/halo.js`** — pure gradient geometry (`haloBackground`, `vignetteBackground`,
  `clampNum`). Classic-script global `globalThis.DarkwebHalo`, so the unit test can
  run it in a `node:vm` sandbox (no DOM). All numeric inputs clamped; nil/junk →
  safe defaults (never NaN).
- **`src/darkweb.js`** — the engine. **Top frame** owns ONE fixed click-through
  overlay; repaints on rAF; flicker loop keeps repainting while on. **Child frames**
  only relay mouse coords up (see iframe note). `Esc` writes `enabled:false`.
- **`src/drone.js`** — procedural Web Audio horror bed (`DarkwebDrone.start/stop/
  setVolume/isRunning`). Lazy `AudioContext`; slow gain ramps (no clicks); random
  shimmer via `setTimeout`. Autoplay handled (see note).
- **`src/background.js`** — toolbar click + `toggle-darkweb` command both toggle
  `enabled`; icon on/off sync via `storage.onChanged`. No storage writes on install.

## Non-obvious things (don't relearn the hard way)
- **e2e needs the full Chromium channel.** Playwright's default headless shell does
  NOT load extensions. The test uses `channel: "chromium"` — run
  `npx playwright install chromium` first (already done in this env).
- **Content-script console logs are invisible** across the extension boundary; the
  e2e asserts on the real DOM (`#darkweb-overlay` + computed styles), not logs.
- **Autoplay policy**: a page-created `AudioContext` starts `suspended` and only
  resumes after a user gesture *in the page*. `drone.start()` calls `resume()` and
  also arms one-time `pointerdown`/`keydown` listeners to resume on first
  interaction. Because DARKWEB is click-through, the user clicks/moves naturally, so
  the drone comes up within the first interaction. Toggling on via the popup alone
  (no page click yet) may leave audio suspended until the first page click — by
  design, not a bug.
- **Default darkness = 1.0** (pure black beyond the beam) to match the "only the
  mouse reveals it" spec. Slider goes down to 0.70 for a faint see-the-page bleed.

## Known limitations (named, not silent)
1. **Iframes nested ≥2 deep**: the beam tracks over direct child iframes (coords
   relayed + offset added via `event.source` ↔ `iframe.contentWindow` match), but a
   frame nested two or more levels down posts to `window.top`, whose direct-iframe
   list won't contain it, so its coords are ignored and the beam freezes while the
   cursor is inside that deep frame. Rare in practice. Fix (if ever wanted): relay
   up one parent level at a time, each frame adding its own offset.
2. **`chrome://` and the Web Store** pages don't run content scripts (Chrome policy),
   so DARKWEB has no effect there. Expected.
3. **Music vs popup-only toggle**: see autoplay note — audio may wait for the first
   page interaction.

## Next steps (Tristan's gated)
- Load unpacked in real Chrome, sanity-check the drone volume feels right to you,
  tune `state.js` `volume` default (currently 0.15) if needed.
- Chrome Web Store submission (dashboard is unscriptable by extensions — manual):
  use paste-ready copy in `store/listing.md`; host `store/privacy.html` (GitHub
  Pages, like the siblings) and paste its URL; upload `darkweb-v1.0.0.zip`.
- Optional: GitHub repo + Pages for the privacy policy (mirror the sibling setup).

## Memory
Personal memory: `darkweb_project.md` (indexed in `MEMORY.md`).
