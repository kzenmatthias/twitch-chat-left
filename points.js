// Channel-points auto-claim: when the green "Claim Bonus" button appears
// next to the chat input, click it after a random delay so it looks human.

// IIFE: content scripts share one global scope per tab, and bingo.js also
// declares STORAGE_KEY. Isolating this module avoids redeclaration errors.
(() => {
const STORAGE_KEY = "autoClaimPoints";
const MIN_DELAY_MS = 5000;
const MAX_DELAY_MS = 25000;
const POLL_INTERVAL_MS = 2000;
// Hidden tabs still poll, only slower: people farm points with the stream in
// a background tab, so pausing there would defeat the feature.
const HIDDEN_POLL_INTERVAL_MS = 30000;

let enabled = true;
let pollId = null;
let pendingTimerId = null;

function randomDelay() {
  return MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);
}

// Twitch localises the button's aria-label, so the chest icon class and the
// data-test-selector come first; the labels are only a fallback.
const CLAIM_LABELS = [
  "Claim Bonus",
  "Bonus claimen",
  "Bonus einfordern",
  "Récupérer un bonus",
];
const CLAIM_SELECTOR = [
  '[data-test-selector="claimable-bonus"]',
  ".claimable-bonus__icon",
  ...CLAIM_LABELS.map((label) => `[aria-label="${label}"]`),
].join(",");

// These elements only exist while a claim is available, so their presence is
// a reliable "the button is green right now" signal. The icon is not always
// inside a real <button>, so fall back to role="button" or the node itself.
function findClaimButton() {
  const el = document.querySelector(CLAIM_SELECTOR);
  if (!el) return null;
  const button =
    el.closest('button, [role="button"]') || el.querySelector("button") || el;
  if (button.disabled || button.getAttribute("aria-disabled") === "true") {
    return null;
  }
  return button;
}

function cancelPending() {
  if (pendingTimerId !== null) {
    clearTimeout(pendingTimerId);
    pendingTimerId = null;
  }
}

function checkAndSchedule() {
  if (!enabled) return;
  const button = findClaimButton();
  if (!button) {
    // Claim disappeared (user clicked, or it expired) — drop any pending timer
    cancelPending();
    return;
  }
  if (pendingTimerId !== null) return; // already scheduled

  pendingTimerId = setTimeout(() => {
    pendingTimerId = null;
    // Re-resolve at fire time: the DOM may have re-rendered the button
    const current = findClaimButton();
    if (!current) return;
    current.click();
    console.info("[Twitch Chat Position] Claimed channel points bonus");
  }, randomDelay());
}

function pollInterval() {
  return document.hidden ? HIDDEN_POLL_INTERVAL_MS : POLL_INTERVAL_MS;
}

function start() {
  if (pollId !== null) return;
  pollId = setInterval(checkAndSchedule, pollInterval());
  checkAndSchedule();
}

function stop() {
  if (pollId !== null) {
    clearInterval(pollId);
    pollId = null;
  }
  cancelPending();
}

// Switch poll rate when the tab is hidden or shown; restarting also checks
// right away, so a claim that appeared in the background is picked up.
document.addEventListener("visibilitychange", () => {
  if (!enabled || pollId === null) return;
  clearInterval(pollId);
  pollId = null;
  start();
});

function applyEnabled(value) {
  enabled = value !== false; // default on
  if (enabled) start();
  else stop();
}

chrome.storage.sync.get({ [STORAGE_KEY]: true }, (result) => {
  applyEnabled(result[STORAGE_KEY]);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync" || !changes[STORAGE_KEY]) return;
  applyEnabled(changes[STORAGE_KEY].newValue);
});
})();
