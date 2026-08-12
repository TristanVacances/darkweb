/*
 * Capture the DARKWEB settings popup and pad it onto a 1280×800 store canvas.
 * Output: store/screenshots/popup-raw.png (the bare popup, for compositing).
 *
 * Run:  node tools/popup_shot.mjs
 */
import { chromium } from "playwright";
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const EXT = join(here, "..");
const SHOTS = join(here, "..", "store", "screenshots");
mkdirSync(SHOTS, { recursive: true });

const userDataDir = mkdtempSync(join(tmpdir(), "darkweb-popup-"));
const context = await chromium.launchPersistentContext(userDataDir, {
  channel: "chromium",
  headless: true,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, "--no-first-run"],
});

let [sw] = context.serviceWorkers();
if (!sw) sw = await context.waitForEvent("serviceworker", { timeout: 10000 });
const id = sw.url().split("/")[2]; // chrome-extension://<id>/...

// Render the popup in its "ON" state so the controls are active/visible.
await sw.evaluate(
  () =>
    new Promise((r) =>
      chrome.storage.local.set(
        { enabled: true, radius: 90, darkness: 1.0, flicker: true, music: true, volume: 0.15 },
        r
      )
    )
);

const page = await context.newPage();
await page.setViewportSize({ width: 250, height: 470 });
await page.goto(`chrome-extension://${id}/src/popup.html`, { waitUntil: "load" });
await page.waitForTimeout(300);
await page.screenshot({ path: join(SHOTS, "popup-raw.png") });
console.log("wrote popup-raw.png");

await context.close();
console.log("done");
