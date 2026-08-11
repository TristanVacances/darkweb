/*
 * Generate Chrome Web Store screenshots at the required 1280×800.
 * Loads the real unpacked extension, enables the blackout, and captures the
 * beam at a few positions. Output: store/screenshots/store-{1,2,3}.png
 *
 * Run:  node tools/shots.mjs
 */
import { chromium } from "playwright";
import http from "node:http";
import { readFileSync, mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const EXT = join(here, "..");
const FIXTURE = readFileSync(join(here, "..", "tests", "fixtures", "sample.html"), "utf8");
const SHOTS = join(here, "..", "store", "screenshots");

const server = http.createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(FIXTURE);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/`;

mkdirSync(SHOTS, { recursive: true });
const userDataDir = mkdtempSync(join(tmpdir(), "darkweb-shots-"));
const context = await chromium.launchPersistentContext(userDataDir, {
  channel: "chromium",
  headless: true,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, "--no-first-run"],
});

let [sw] = context.serviceWorkers();
if (!sw) sw = await context.waitForEvent("serviceworker", { timeout: 10000 });

const page = await context.newPage();
await page.setViewportSize({ width: 1280, height: 800 });
await page.goto(url, { waitUntil: "load" });

async function shot(name, patch, mx, my) {
  await sw.evaluate(
    (patch) => new Promise((r) => chrome.storage.local.set(patch, r)),
    patch
  );
  await page.waitForFunction(() => !!document.getElementById("darkweb-overlay"), { timeout: 4000 });
  await page.mouse.move(mx, my);
  // Slightly higher darkness so the page is *faintly* sensed around the beam —
  // reads better as a marketing shot than pure black.
  await page.waitForTimeout(150);
  await page.screenshot({ path: join(SHOTS, name) });
  console.log("wrote", name);
}

await shot("store-1.png", { enabled: true, flicker: false, music: false, radius: 130, darkness: 0.9 }, 560, 360);
await shot("store-2.png", { enabled: true, flicker: false, music: false, radius: 80, darkness: 0.95 }, 220, 430);
await shot("store-3.png", { enabled: true, flicker: false, music: false, radius: 190, darkness: 0.85 }, 780, 300);

await context.close();
server.close();
console.log("done → store/screenshots/store-{1,2,3}.png (1280×800)");
