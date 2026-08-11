/*
 * End-to-end test: loads the REAL unpacked extension into Chromium, drives the
 * genuine storage-toggle path via the service worker, and asserts the overlay,
 * click-through, mouse-follow, Escape exit, and clean teardown. Also captures
 * the store screenshots as a side effect.
 *
 * Content-script console logs are invisible across the extension boundary, so we
 * assert on the real DOM (the #darkweb-overlay element and its computed styles).
 *
 * Run:  node --test tests/e2e.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import http from "node:http";
import { readFileSync, mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const EXT = join(here, "..");
const FIXTURE = readFileSync(join(here, "fixtures", "sample.html"), "utf8");
const SHOTS = join(here, "..", "store", "screenshots");

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(FIXTURE);
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function getWorker(context) {
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent("serviceworker", { timeout: 10000 });
  return sw;
}

async function setState(sw, patch) {
  await sw.evaluate(
    (patch) => new Promise((r) => chrome.storage.local.set(patch, r)),
    patch
  );
}

async function getEnabled(sw) {
  return sw.evaluate(
    () => new Promise((r) => chrome.storage.local.get({ enabled: false }, (v) => r(v.enabled)))
  );
}

const overlayBg = (page) =>
  page.evaluate(() => {
    const el = document.getElementById("darkweb-overlay");
    if (!el) return null;
    const cs = getComputedStyle(el);
    return {
      exists: true,
      pointerEvents: cs.pointerEvents,
      position: cs.position,
      zIndex: cs.zIndex,
      background: el.style.background,
      width: el.getBoundingClientRect().width,
      height: el.getBoundingClientRect().height,
    };
  });

test("DARKWEB blacks out, follows the mouse, stays click-through, and exits", async (t) => {
  const server = await startServer();
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/`;
  const userDataDir = mkdtempSync(join(tmpdir(), "darkweb-pw-"));
  mkdirSync(SHOTS, { recursive: true });

  const context = await chromium.launchPersistentContext(userDataDir, {
    // Playwright's default headless shell does NOT load extensions; the full
    // "chromium" channel (new headless) does.
    channel: "chromium",
    headless: true,
    args: [
      `--disable-extensions-except=${EXT}`,
      `--load-extension=${EXT}`,
      "--no-first-run",
    ],
  });

  t.after(async () => {
    await context.close().catch(() => {});
    server.close();
  });

  const sw = await getWorker(context);
  const page = await context.newPage();
  await page.setViewportSize({ width: 1000, height: 700 });
  await page.goto(url, { waitUntil: "load" });

  // --- Off by default: no overlay ---
  assert.equal(await overlayBg(page), null, "no overlay before enabling");

  // --- Enable via the real storage path; keep flicker off for stable assertions ---
  await setState(sw, { enabled: true, flicker: false, music: false, radius: 90, darkness: 0.98 });
  await page.waitForFunction(() => !!document.getElementById("darkweb-overlay"), { timeout: 4000 });

  const on = await overlayBg(page);
  assert.ok(on && on.exists, "overlay present when enabled");
  assert.equal(on.pointerEvents, "none", "overlay is click-through");
  assert.equal(on.position, "fixed", "overlay is fixed");
  assert.equal(on.zIndex, "2147483647", "overlay sits on top");
  assert.ok(on.width >= 999 && on.height >= 699, "overlay covers the viewport");
  assert.match(on.background, /radial-gradient/, "overlay paints a halo gradient");

  // --- Mouse-follow: the gradient centre tracks the cursor ---
  await page.mouse.move(250, 180);
  await page.waitForFunction(
    () => {
      const el = document.getElementById("darkweb-overlay");
      return el && /at 250px 180px/.test(el.style.background);
    },
    { timeout: 3000 }
  );
  const moved = await overlayBg(page);
  assert.match(moved.background, /at 250px 180px/, "halo follows the mouse");

  // Screenshot #1: page in the dark with the beam mid-page.
  await page.mouse.move(500, 340);
  await page.waitForTimeout(120);
  await page.screenshot({ path: join(SHOTS, "01-beam.png") });

  // --- Click-through: clicking a button under the black actually hits the page ---
  await page.click("#clickme");
  assert.equal(
    await page.textContent("#result"),
    "CLICKED_THROUGH",
    "page remains usable under the overlay"
  );

  // Screenshot #2: proof of a small tight beam near the button.
  await page.mouse.move(140, 430);
  await page.waitForTimeout(120);
  await page.screenshot({ path: join(SHOTS, "02-clickthrough.png") });

  // --- Escape exits: overlay removed AND storage flipped off ---
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.getElementById("darkweb-overlay"), { timeout: 3000 });
  assert.equal(await overlayBg(page), null, "Escape removes the overlay");
  assert.equal(await getEnabled(sw), false, "Escape flips enabled=false in storage");

  // --- Re-enable proves clean teardown (no dead listeners / leaked state) ---
  await setState(sw, { enabled: true, flicker: false, music: false });
  await page.waitForFunction(() => !!document.getElementById("darkweb-overlay"), { timeout: 4000 });
  await page.mouse.move(600, 200);
  await page.waitForFunction(
    () => {
      const el = document.getElementById("darkweb-overlay");
      return el && /at 600px 200px/.test(el.style.background);
    },
    { timeout: 3000 }
  );
  assert.ok(true, "re-enable works after a full disable cycle");

  // --- Toolbar/hotkey path: service-worker toggle greys back off ---
  await setState(sw, { enabled: false });
  await page.waitForFunction(() => !document.getElementById("darkweb-overlay"), { timeout: 3000 });
});
