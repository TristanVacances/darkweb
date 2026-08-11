# DARKWEB — build plan

## Context
Tristan wants a new joke Chrome extension in the family of CHIENTERNET / RIGOLOL / SCATERNET.
**DARKWEB**: when ON, it paints the whole page black; the only way to see the page is to move
the mouse — a small soft flashlight halo follows the cursor and reveals what's underneath, like a
torch in a pitch-dark room. Simple by design. Ships complete: tests, docs, packaged zip, repo.

Decisions locked with Tristan (grill answers):
- **Halo**: soft feathered, **small** default radius, torch-flicker **ON** by default.
- **Interaction**: **click-through** — the overlay never blocks the page (`pointer-events:none`);
  you can still scroll/click/type under the beam.
- **Toggle** (I decided): toolbar icon toggles like the other extensions **+** a keyboard shortcut
  **+** `Esc` exits. The browser toolbar is never covered by the blackout (the overlay only darkens
  the page, not Chrome's chrome), so the popup switch is always reachable — the hotkey and Esc are
  extra guaranteed escape hatches, which resolves Tristan's "how do I turn it off" worry.
- **Popup controls**: ON/OFF, halo-size slider, darkness slider, flicker checkbox, subtle vignette.
- **Background music** (added): low-volume **spooky horror drone**, synthesized in-browser with Web
  Audio (no bundled file, no network). Default ON, low gain; popup gets a music on/off checkbox +
  volume slider (default low). Autoplay policy handled: resume the AudioContext on the first
  click/keydown in the page.

## Prior art / fork base
Fork the skeleton of `~/Documents/chienternet/` (smallest sibling). Reuse verbatim where possible:
- `src/state.js` — `chrome.storage.local` wrapper (`DEFAULTS`, `get`, `set`), storage-driven, no
  messaging. **Reuse pattern exactly**, new DEFAULTS.
- `src/background.js` — toolbar-click toggle + icon on/off sync + `storage.onChanged` icon sync.
  **Reuse pattern**; drop the dog.ceo proxy; add `chrome.commands.onCommand` for the hotkey.
- `src/popup.html` / `popup.js` — button + storage writes, content reacts. **Reuse pattern**, new
  controls + dark theme.
- `tests/e2e.test.mjs` — Playwright `channel:"chromium"` loads the REAL unpacked extension, drives
  the storage-toggle path via the service worker, screenshots for the store. **Reuse scaffold.**
- `tools/package.sh` — zips runtime files only. **Reuse, rename.**
- `tools/make_icons.py` (in chienternet) — Pillow icon generator. **Reuse, new artwork.**

DARKWEB needs **no** `host_permissions`, **no** `web_accessible_resources`, **no** network — only
`storage` + `commands` permissions. This makes the Web Store privacy story trivial (zero data).

## Files to create — `~/Documents/darkweb/`

### `manifest.json` (MV3)
- `name`: DARKWEB · `permissions`: `["storage"]` · no host permissions.
- `action` → `src/popup.html`, icons on/off.
- `background.service_worker`: `src/background.js`.
- `commands`: `toggle-darkweb` → suggested `Ctrl+Shift+K` (mac `Command+Shift+K`), description
  "Toggle DARKWEB blackout".
- `content_scripts`: matches `<all_urls>`, `all_frames: true`, `run_at: document_start`,
  `js: ["src/state.js","src/drone.js","src/darkweb.js"]`. (document_start so overlay appears instantly.)

### `src/state.js`
`DEFAULTS = { enabled:false, radius:70, darkness:0.98, flicker:true, music:true, volume:0.15 }`. Same get/set wrapper.
`radius` = clear-core px; `darkness` = 0..1 max opacity of the black; `flicker` = torch jitter.

### `src/darkweb.js` (the engine — the only real new code)
Self-initialising content script. Responsibilities:
1. **Overlay**: a single `position:fixed; inset:0; z-index:2147483647; pointer-events:none;` div
   appended to `<html>` (survives `document.body` swaps). One overlay in the **top frame only**.
2. **Halo paint** (pure, unit-tested helper `haloBackground(x,y,radius,darkness)`):
   `radial-gradient(circle at Xpx Ypx, rgba(0,0,0,0) 0, rgba(0,0,0,0) ${core}px,
   rgba(0,0,0,${darkness}) ${core+feather}px)` where `core=radius`, `feather≈radius` (soft).
   Plus a static **vignette** layer (second radial-gradient, screen edges slightly darker).
3. **Mouse tracking**: top-frame `mousemove` (capture) → store client X/Y → repaint on
   `requestAnimationFrame` (rAF-batched, one paint per frame). Before first move, halo centers on
   viewport middle. `position:fixed` + client coords ⇒ correct under scroll automatically.
4. **Iframe coverage (boil-the-ocean edge)**: child frames (non-top) don't draw an overlay; they
   add a `mousemove` listener that `postMessage`s `{type:'DARKWEB_MOUSE', x, y}` to `window.top`.
   The top frame, on `message`, finds the sending iframe by matching `event.source` against each
   `iframe.contentWindow` (works cross-origin — element geometry is same-origin to the top doc),
   adds that iframe's `getBoundingClientRect()` offset, and repaints. So the beam keeps tracking
   over embedded iframes (videos/ads/widgets), not just the top document. **Named limitation**:
   iframes nested ≥2 deep track one level up only — documented, not silently skipped.
5. **Torch flicker** (default on): on each rAF, jitter effective core radius & darkness by a small
   pseudo-random amount (±~6% radius, ±~0.02 opacity), smoothed, to read like a real torch. Off ⇒
   steady beam. (`Math.random` is fine here — the Date.now/Math.random ban is Workflow-script-only.)
6. **Escape hatch**: window `keydown` → `Escape` sets `enabled:false` in storage (all frames/tabs
   react; icon re-greys).
7. **React to state**: `chrome.storage.onChanged` → enable/disable overlay, live-apply
   radius/darkness/flicker without reload. Enabling injects overlay; disabling removes it cleanly
   (no residual listeners leak — rAF cancelled, listeners removed).
8. **No silent failures**: guard every `chrome.*` call (storage may be unavailable in some frames /
   `chrome://`); a frame that can't read storage no-ops rather than throwing. Log with an
   `[DARKWEB]` prefix + context on the unexpected paths.

### `src/drone.js` (Web Audio horror drone — content-script module)
Procedural, self-contained, no assets/network. `globalThis.DarkwebDrone = { start, stop, setVolume }`.
- One `AudioContext`; a master `GainNode` (low default, e.g. 0.15) → destination.
- **Layers**: 2–3 low detuned sawtooth/sine oscillators (~55–70 Hz, slight detune for beating),
  a sub-bass sine (~40 Hz), through a lowpass + slow LFO on filter cutoff (dread swell), plus a
  very quiet reverb-ish feedback delay. Occasional randomly-scheduled dissonant high partials
  (shimmer) for jump-scare texture. All gains low → cinematic, not loud.
- **Autoplay**: context starts `suspended`; `start()` attempts `resume()` and, if blocked, arms
  one-time `pointerdown`/`keydown` listeners to resume on first page interaction. Logged, not silent.
- `stop()` ramps gain to 0 then closes/suspends; no clicks/pops (short gain ramps). No leaked nodes.
Wired from `darkweb.js`: enable → `start()` if `music` on; disable → `stop()`; react to `music` /
`volume` storage changes live. Top frame only (never in child frames — one audio source).

### `src/background.js`
Fork chienternet's: toolbar click toggles `enabled`; `chrome.commands.onCommand` (`toggle-darkweb`)
toggles `enabled`; icon on/off sync via `setIcon` + `storage.onChanged`; `onInstalled`/`onStartup`
reflect state without clobbering. Drop the dog.ceo proxy entirely.

### `src/popup.html` + `src/popup.js`
Dark-themed popup (black bg, dim-white text — on-brand). Controls, all writing `chrome.storage`:
- Big ON/OFF button (mirrors chienternet render pattern).
- **Halo size** range slider → `radius` (e.g. 40–320).
- **Darkness** range slider → `darkness` (0.70–1.00).
- **Torch flicker** checkbox → `flicker`.
- **Spooky music** checkbox → `music` + **volume** slider → `volume` (default low).
- Hint line: "Move your mouse to see. Press Esc or ⌘⇧K to exit."
Sliders disabled/dimmed when OFF (reuse `.row.disabled` pattern).

### `assets/icons/`
`icon-{16,32,48,128}.png` (ON) + `-off` variants, via `tools/make_icons.py` (fork). Artwork: a
black tile with a soft glowing dot/beam (ON = bright halo, OFF = grey/dim). Pillow radial gradient.

### `tools/package.sh`
Fork: `zip -r darkweb-v1.0.0.zip manifest.json src assets` (runtime only; exclude tools/tests/
node_modules/.venv/.git/store).

### `tests/`
- `tests/halo.test.mjs` (unit, `node --test`): `haloBackground()` geometry/string — asserts clear
  center at the cursor, black at edges, correct opacity, monotonic feather; edge inputs (radius 0,
  huge radius, negative/NaN coords rejected to a safe default).
- `tests/e2e.test.mjs` (Playwright, fork scaffold): load unpacked into Chromium (`channel:"chromium"`),
  serve a fixture page, then via the service worker:
  - enable → assert overlay element exists, `pointer-events:none`, covers viewport, background is a
    radial-gradient; **click-through** proven by clicking a link under the overlay and asserting the
    click lands on the page element (not the overlay).
  - `mousemove` → assert the gradient's `at Xpx Ypx` updates to follow.
  - `Escape` keypress → assert overlay removed and `enabled:false` in storage.
  - toggle flicker off → assert steady (no per-frame jitter attribute); disable → overlay gone, no
    leftover listeners (re-enable still works).
  - Capture the 2–3 store screenshots as a side effect (dark page + beam).
- `package.json`: `type:module`, scripts `test:unit`, `test:e2e`, `test`, `assets`, `build`
  (mirror chienternet). Dev dep: `playwright`.

### Docs + close-out
- `README.md` (what it is, install-unpacked, controls, how it works, privacy=zero-data).
- `HANDOFF.md` (status, architecture, the iframe-relay trick, named limitations, next steps).
- `PLAN.md` (this, trimmed).
- `store/` — `listing.md` (paste-ready name/summary/description/permissions-justification: only
  `storage`, no data collected) + generated screenshots + a trivial `privacy.html` (collects
  nothing). Matches the sibling store/ convention.
- `git init`, first commit, `.gitignore` (node_modules, .venv, .DS_Store, zip).
- Personal memory: create `memory/darkweb_project.md` + index line in `MEMORY.md`.

## Verification (run before calling done — show output)
1. `npm install` then `npm test` → unit + e2e green, **watched go green** (paste output).
2. Load unpacked in real Chrome once (Tristan or Playwright profile): toggle on → page blacks out,
   beam follows mouse, page still clickable, sliders + flicker live-update, Esc and ⌘⇧K exit.
3. `npm run build` → `darkweb-v1.0.0.zip`; `unzip -l` shows runtime files only, no secrets/junk.
4. Confirm code-side artifacts exist: overlay div id in DOM when enabled, `[DARKWEB]` absent on
   happy path, icon flips on/off.

## Scope guards
- Pure fork-and-simplify; no new deps beyond Playwright (already the sibling standard).
- Not touching the sibling projects. New dir only.
- Chrome Web Store **submission** stays Tristan's gated manual step (as with the siblings) — I build,
  test, package, and write paste-ready store copy; I do not submit.
