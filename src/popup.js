/*
 * DARKWEB — popup controller.
 * Master ON/OFF plus halo size, darkness, torch flicker, spooky music, volume.
 * Writes chrome.storage; content scripts and the service worker react on their own.
 *
 * Slider ↔ stored-value mapping:
 *   radius   : slider px value = stored px  (40..320)
 *   darkness : slider 70..100  = stored 0.70..1.00
 *   volume   : slider 0..60    = stored 0.00..0.60  (kept low)
 */
(function () {
  "use strict";
  const State = globalThis.DarkwebState;

  const btn = document.getElementById("toggle");
  const controls = document.getElementById("controls");
  const radius = document.getElementById("radius");
  const radiusVal = document.getElementById("radiusVal");
  const darkness = document.getElementById("darkness");
  const darknessVal = document.getElementById("darknessVal");
  const flicker = document.getElementById("flicker");
  const music = document.getElementById("music");
  const volume = document.getElementById("volume");
  const volumeVal = document.getElementById("volumeVal");
  const volumeRow = document.getElementById("volumeRow");

  function render(st) {
    if (st.enabled) {
      btn.textContent = "Turn OFF";
      btn.className = "toggle on";
    } else {
      btn.textContent = "Turn ON";
      btn.className = "toggle off";
    }
    controls.classList.toggle("disabled", !st.enabled);

    radius.value = String(Math.round(st.radius));
    radiusVal.textContent = Math.round(st.radius) + "px";

    darkness.value = String(Math.round(st.darkness * 100));
    darknessVal.textContent = Math.round(st.darkness * 100) + "%";

    flicker.checked = !!st.flicker;
    music.checked = !!st.music;

    volume.value = String(Math.round(st.volume * 100));
    volumeVal.textContent = Math.round(st.volume * 100) + "%";
    volumeRow.style.opacity = st.music ? "1" : "0.4";
  }

  btn.addEventListener("click", async () => {
    const st = await State.get();
    await State.set({ enabled: !st.enabled });
    render(await State.get());
  });

  radius.addEventListener("input", async () => {
    const v = Number(radius.value);
    radiusVal.textContent = v + "px";
    await State.set({ radius: v });
  });

  darkness.addEventListener("input", async () => {
    const pct = Number(darkness.value);
    darknessVal.textContent = pct + "%";
    await State.set({ darkness: pct / 100 });
  });

  flicker.addEventListener("change", async () => {
    await State.set({ flicker: flicker.checked });
  });

  music.addEventListener("change", async () => {
    await State.set({ music: music.checked });
    volumeRow.style.opacity = music.checked ? "1" : "0.4";
  });

  volume.addEventListener("input", async () => {
    const pct = Number(volume.value);
    volumeVal.textContent = pct + "%";
    await State.set({ volume: pct / 100 });
  });

  State.get().then(render);
})();
