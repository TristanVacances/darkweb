/*
 * DARKWEB — spooky horror drone (procedural Web Audio, no assets, no network).
 *
 * Exposes globalThis.DarkwebDrone = { start, stop, setVolume, isRunning }.
 * A low, detuned, cinematic dread bed: sub-bass + two detuned mid drones through
 * a slow filter swell, a whisper of filtered noise "air", and occasional random
 * dissonant high shimmers (the jump-scare texture). All gains low by design.
 *
 * Autoplay policy: a page-created AudioContext starts `suspended` and can only
 * resume after a user gesture in the page. start() attempts resume() and, if the
 * browser blocks it, arms one-time pointerdown/keydown listeners to resume on the
 * first interaction. DARKWEB is click-through, so that happens naturally.
 */
(function () {
  "use strict";

  const ROOT = 46.25; // F#1 — low and uneasy
  let ctx = null;
  let master = null; // GainNode → destination
  let nodes = []; // everything to disconnect on stop()
  let shimmerTimer = null;
  let running = false;
  let targetVolume = 0.15;
  let gestureArmed = false;

  function log(msg, err) {
    // Observability without noise on the happy path.
    if (err) console.warn("[DARKWEB drone] " + msg, err);
  }

  function AC() {
    return window.AudioContext || window.webkitAudioContext || null;
  }

  function makeNoiseBuffer(context, seconds) {
    const len = Math.max(1, Math.floor(context.sampleRate * seconds));
    const buf = context.createBuffer(1, len, context.sampleRate);
    const data = buf.getChannelData(0);
    // Deterministic-ish pseudo-noise; Math.random is fine in extension runtime.
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function osc(context, type, freq, detune) {
    const o = context.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    if (detune) o.detune.value = detune;
    return o;
  }

  function buildGraph() {
    master = ctx.createGain();
    master.gain.value = 0; // fade in via setVolume ramp
    master.connect(ctx.destination);

    // --- Low drone bed through a slowly-swelling lowpass ---
    const bedGain = ctx.createGain();
    bedGain.gain.value = 0.9;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 320;
    lp.Q.value = 6;
    lp.connect(bedGain);
    bedGain.connect(master);

    const sub = osc(ctx, "sine", ROOT / 2, 0); // deep sub
    const subG = ctx.createGain();
    subG.gain.value = 0.5;
    sub.connect(subG);
    subG.connect(lp);

    const d1 = osc(ctx, "sawtooth", ROOT, -7); // detuned pair → slow beating
    const d2 = osc(ctx, "sawtooth", ROOT, +9);
    const dG = ctx.createGain();
    dG.gain.value = 0.16;
    d1.connect(dG);
    d2.connect(dG);
    dG.connect(lp);

    // A minor-second-ish upper drone for unease
    const tense = osc(ctx, "triangle", ROOT * 2.05, 0);
    const tenseG = ctx.createGain();
    tenseG.gain.value = 0.05;
    tense.connect(tenseG);
    tenseG.connect(lp);

    // --- Slow LFO on the filter cutoff → dread swells ---
    const lfo = osc(ctx, "sine", 0.05, 0);
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 220; // ±220Hz sweep around 320
    lfo.connect(lfoGain);
    lfoGain.connect(lp.frequency);

    // --- Filtered-noise "air" bed ---
    const noise = ctx.createBufferSource();
    noise.buffer = makeNoiseBuffer(ctx, 3);
    noise.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 800;
    bp.Q.value = 0.6;
    const noiseG = ctx.createGain();
    noiseG.gain.value = 0.02;
    noise.connect(bp);
    bp.connect(noiseG);
    noiseG.connect(master);

    [sub, d1, d2, tense, lfo, noise].forEach((n) => {
      try {
        n.start();
      } catch (e) {
        log("node start failed", e);
      }
    });

    nodes = [
      master, bedGain, lp, sub, subG, d1, d2, dG, tense, tenseG,
      lfo, lfoGain, noise, bp, noiseG,
    ];
  }

  // A single random dissonant high shimmer — the horror-film sting.
  function shimmer() {
    if (!running || !ctx || !master) return;
    try {
      const t = ctx.currentTime;
      const base = ROOT * 8; // ~370Hz
      // tritone-ish detune for maximal unease
      const freq = base * (1.35 + Math.random() * 0.6);
      const o = osc(ctx, "sine", freq, 0);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.03, t + 0.8); // slow swell
      g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2); // slow fade
      o.connect(g);
      g.connect(master);
      o.start(t);
      o.stop(t + 3.4);
      o.onended = () => {
        try { o.disconnect(); g.disconnect(); } catch (_e) { /* already gone */ }
      };
    } catch (e) {
      log("shimmer failed", e);
    }
    // 8–20s until the next one.
    shimmerTimer = setTimeout(shimmer, 8000 + Math.random() * 12000);
  }

  function rampMaster(to, seconds) {
    if (!master || !ctx) return;
    const now = ctx.currentTime;
    const v = Math.max(0.0001, to);
    try {
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), now);
      master.gain.exponentialRampToValueAtTime(v, now + seconds);
      if (to <= 0.0001) master.gain.setValueAtTime(0, now + seconds + 0.01);
    } catch (e) {
      log("gain ramp failed", e);
    }
  }

  function armGesture() {
    if (gestureArmed) return;
    gestureArmed = true;
    const resume = () => {
      if (ctx && ctx.state === "suspended") ctx.resume().catch((e) => log("resume() failed", e));
      window.removeEventListener("pointerdown", resume, true);
      window.removeEventListener("keydown", resume, true);
      gestureArmed = false;
    };
    window.addEventListener("pointerdown", resume, true);
    window.addEventListener("keydown", resume, true);
  }

  function start(volume) {
    if (typeof volume === "number") targetVolume = Math.max(0, Math.min(1, volume));
    const Ctor = AC();
    if (!Ctor) {
      log("Web Audio unavailable in this context", new Error("no AudioContext"));
      return;
    }
    try {
      if (!ctx) {
        ctx = new Ctor();
        buildGraph();
      }
      running = true;
      rampMaster(targetVolume, 2.5); // slow, cinematic fade-in
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => armGesture());
        armGesture(); // belt and braces — resume on first gesture regardless
      }
      if (!shimmerTimer) shimmerTimer = setTimeout(shimmer, 6000 + Math.random() * 8000);
    } catch (e) {
      log("start failed", e);
    }
  }

  function stop() {
    running = false;
    if (shimmerTimer) {
      clearTimeout(shimmerTimer);
      shimmerTimer = null;
    }
    if (!ctx || !master) return;
    rampMaster(0, 0.6); // fade out — no click
    setTimeout(() => {
      if (running) return; // a restart raced us; leave it alone
      try {
        nodes.forEach((n) => {
          try {
            if (typeof n.stop === "function") n.stop();
          } catch (_e) { /* oscillators can only stop once */ }
          try { n.disconnect(); } catch (_e) { /* already disconnected */ }
        });
      } catch (e) {
        log("teardown failed", e);
      }
      nodes = [];
      if (ctx) {
        ctx.close().catch((e) => log("ctx close failed", e));
        ctx = null;
        master = null;
      }
    }, 700);
  }

  function setVolume(v) {
    targetVolume = Math.max(0, Math.min(1, typeof v === "number" ? v : Number(v) || 0));
    if (running) rampMaster(targetVolume, 0.3);
  }

  function isRunning() {
    return running;
  }

  globalThis.DarkwebDrone = { start, stop, setVolume, isRunning };
})();
