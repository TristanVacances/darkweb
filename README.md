# DARKWEB 🔦

A joke Chrome extension (Manifest V3). Flip it on and the page plunges into
total darkness — the only way to see anything is to move your mouse, which
carries a small soft flashlight halo like a torch in a pitch-black room. A
low, cinematic horror drone hums in the background. The page stays fully
usable underneath: you can still scroll, click, and type.

Part of the family: CHIENTERNET · RIGOLOL · SCATERNET · **DARKWEB**.

## Install (unpacked, for development)
1. `git clone` this repo (or unzip `darkweb-v1.0.0.zip`).
2. Chrome → `chrome://extensions` → enable **Developer mode**.
3. **Load unpacked** → pick this folder.
4. Click the DARKWEB toolbar icon → **Turn ON**. Move your mouse.

## Controls
- **Toolbar icon** → popup with the ON/OFF switch and all settings.
- **Keyboard**: `Ctrl+Shift+K` (Windows/Linux) / `⌘⇧K` (mac) toggles the blackout
  from anywhere. Configurable at `chrome://extensions/shortcuts`.
- **`Esc`** always exits the blackout.
- The browser toolbar is **never** covered by the darkness, so the popup switch
  is always reachable — there are three independent ways to turn it off.

Popup settings (live, no reload): **Halo size**, **Darkness**, **Torch flicker**
(on by default), **Spooky music** (on by default) + **Volume** (kept low).

## How it works
- One fixed, full-viewport `<div>` with `pointer-events: none` (so it never
  blocks the page) and a `z-index` of `2147483647`. Its `background` is two
  stacked CSS radial-gradients: a **halo** centred on the cursor (transparent
  core → soft feather → solid black) plus a subtle corner **vignette**.
- The halo is repainted on `requestAnimationFrame` as the mouse moves; **torch
  flicker** jitters the radius/opacity each frame for a living-flame feel.
- **Over iframes**: child frames relay their local mouse position up to the top
  frame via `postMessage`; the top frame matches the sender to its `<iframe>`
  element and adds that element's on-screen offset, so the beam keeps tracking
  over embedded videos/ads/widgets. (Iframes nested ≥2 deep are a known
  limitation — see `HANDOFF.md`.)
- **Music** is synthesised entirely in the browser with the Web Audio API
  (detuned sub-bass drones + slow filter swells + filtered-noise air + random
  dissonant shimmers). No audio file is bundled and nothing is fetched.
- State lives in `chrome.storage.local`; the popup, the toolbar, the hotkey and
  the `Esc` key all just write storage, and the content script reacts to
  `storage.onChanged`. No message passing, no `tabs` permission.

## Privacy
DARKWEB collects **nothing**, sends **nothing**, and makes **no** network
requests. Its only permission is `storage` (to remember your settings on this
device). See `store/privacy.html`.

## Development
```bash
npm install                 # playwright
npx playwright install chromium
npm test                    # unit (halo geometry) + Playwright e2e
npm run assets              # regenerate icons (needs .venv with Pillow)
npm run build               # → darkweb-v1.0.0.zip (runtime files only)
```

## Layout
```
manifest.json          MV3 manifest (permissions: storage + commands)
src/state.js           chrome.storage wrapper + DEFAULTS
src/halo.js            pure halo/vignette gradient geometry (unit-tested)
src/drone.js           procedural Web Audio horror drone
src/darkweb.js         the engine: overlay, mouse-track, iframe relay, flicker, Esc
src/background.js       service worker: toolbar/hotkey toggle + icon sync
src/popup.html/.js      dark-themed control panel
assets/icons/          on/off toolbar icons (generated)
tests/                 halo.test.mjs (unit) + e2e.test.mjs (Playwright)
tools/                 make_icons.py, package.sh
store/                 listing copy, privacy policy, screenshots
```
