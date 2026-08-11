/*
 * Unit tests for the pure flashlight-halo geometry (src/halo.js).
 * The module is a classic script that assigns globalThis.DarkwebHalo, so we
 * execute its source in a node:vm sandbox and read the API back out — same file,
 * no bundler, no duplicate logic.
 *
 * Run:  node --test tests/halo.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "..", "src", "halo.js"), "utf8");
const sandbox = { globalThis: {} };
sandbox.globalThis.globalThis = sandbox.globalThis;
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
const Halo = sandbox.globalThis.DarkwebHalo;

test("exposes the API", () => {
  assert.equal(typeof Halo.haloBackground, "function");
  assert.equal(typeof Halo.vignetteBackground, "function");
  assert.equal(typeof Halo.clampNum, "function");
});

test("clampNum coerces and bounds; falls back on junk", () => {
  assert.equal(Halo.clampNum(5, 0, 10, 1), 5);
  assert.equal(Halo.clampNum(-3, 0, 10, 1), 0);
  assert.equal(Halo.clampNum(99, 0, 10, 1), 10);
  assert.equal(Halo.clampNum("7", 0, 10, 1), 7); // string coercion
  assert.equal(Halo.clampNum(NaN, 0, 10, 1), 1); // fallback
  assert.equal(Halo.clampNum(null, 0, 10, 1), 1);
  assert.equal(Halo.clampNum(undefined, 0, 10, 1), 1);
  assert.equal(Halo.clampNum("abc", 0, 10, 1), 1);
});

test("haloBackground centres the clear core on the cursor", () => {
  const bg = Halo.haloBackground(300, 200, 70, 0.98);
  assert.match(bg, /^radial-gradient\(circle at 300px 200px,/);
  // A fully-transparent core out to the radius.
  assert.match(bg, /rgba\(0,0,0,0\) 0px/);
  assert.match(bg, /rgba\(0,0,0,0\) 70px/);
});

test("haloBackground goes solid black at the requested darkness", () => {
  const bg = Halo.haloBackground(0, 0, 70, 0.98);
  // Outer stop must reach the requested opacity.
  assert.match(bg, /rgba\(0,0,0,0\.980\) 140px\)/);
});

test("darkness is monotonic: brighter setting → lower final opacity", () => {
  const dark = Halo.haloBackground(0, 0, 70, 1.0);
  const dim = Halo.haloBackground(0, 0, 70, 0.7);
  assert.match(dark, /rgba\(0,0,0,1\.000\) 140px\)/);
  assert.match(dim, /rgba\(0,0,0,0\.700\) 140px\)/);
});

test("feather grows with radius (soft edge scales)", () => {
  const small = Halo.haloBackground(0, 0, 40, 0.98); // mid = 80
  const big = Halo.haloBackground(0, 0, 200, 0.98); // mid = 400
  assert.match(small, /0\.980\) 80px\)/);
  assert.match(big, /0\.980\) 400px\)/);
});

test("edge inputs are clamped, never throw or NaN", () => {
  const zero = Halo.haloBackground(0, 0, 0, 0.98); // radius 0 → tiny beam
  assert.match(zero, /circle at 0px 0px/);
  assert.doesNotMatch(zero, /NaN/);

  const huge = Halo.haloBackground(0, 0, 99999, 0.98); // clamped to 2000
  assert.match(huge, /4000px\)/); // core+feather = 2000+2000
  assert.doesNotMatch(huge, /NaN/);

  const junk = Halo.haloBackground(NaN, undefined, "nope", null);
  assert.doesNotMatch(junk, /NaN/); // coords→0, radius→70, darkness→0.98
  assert.match(junk, /circle at 0px 0px/);
  assert.match(junk, /0\.980\) 140px\)/);
});

test("vignetteBackground is subtle and darkness-scaled", () => {
  const v = Halo.vignetteBackground(0.98);
  assert.match(v, /^radial-gradient\(ellipse at center,/);
  assert.match(v, /rgba\(0,0,0,0\) 55%/); // clear middle
  // edge opacity = min(1, 0.98*0.35) = 0.343
  assert.match(v, /rgba\(0,0,0,0\.343\) 100%\)/);
  assert.doesNotMatch(v, /NaN/);
});
