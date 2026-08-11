/*
 * DARKWEB — service worker.
 *  - Toolbar click toggles `enabled` in storage (content scripts react on their own).
 *  - The `toggle-darkweb` command (Ctrl/Cmd+Shift+K) does the same.
 *  - Keeps the toolbar icon in sync (bright = on, dim = off).
 * No network, no tabs permission — storage only.
 */
"use strict";

const ICON_ON = {
  16: "assets/icons/icon-16.png",
  32: "assets/icons/icon-32.png",
  48: "assets/icons/icon-48.png",
  128: "assets/icons/icon-128.png",
};
const ICON_OFF = {
  16: "assets/icons/icon-16-off.png",
  32: "assets/icons/icon-32-off.png",
  48: "assets/icons/icon-48-off.png",
  128: "assets/icons/icon-128-off.png",
};

function setIcon(enabled) {
  chrome.action.setIcon({ path: enabled ? ICON_ON : ICON_OFF }).catch(() => {});
  chrome.action
    .setTitle({
      title: enabled
        ? "DARKWEB is ON — move your mouse to see (click to exit)"
        : "DARKWEB is off (click to plunge into darkness)",
    })
    .catch(() => {});
}

function syncIcon() {
  chrome.storage.local.get({ enabled: false }, (v) => setIcon(!!v.enabled));
}

function toggle() {
  chrome.storage.local.get({ enabled: false }, (v) => {
    const next = !v.enabled;
    chrome.storage.local.set({ enabled: next }, () => setIcon(next));
  });
}

// On install/startup just reflect current state in the icon. Do NOT write storage
// here — defaults are supplied at every read site, and writing on install can
// clobber a concurrent toggle.
chrome.runtime.onInstalled.addListener(syncIcon);
chrome.runtime.onStartup && chrome.runtime.onStartup.addListener(syncIcon);

// Toolbar click = master toggle.
chrome.action.onClicked.addListener(toggle);

// Keyboard shortcut = master toggle.
chrome.commands &&
  chrome.commands.onCommand.addListener((command) => {
    if (command === "toggle-darkweb") toggle();
  });

// Keep the icon correct if state changes from the popup or the Escape key.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && "enabled" in changes) setIcon(!!changes.enabled.newValue);
});

// Ensure the icon is right whenever the worker spins up.
syncIcon();
