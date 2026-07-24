// Channel-points auto-claim: when the green "Claim Bonus" button appears
// next to the chat input, click it after a random delay so it looks human.

// IIFE: content scripts share one global scope per tab, and bingo.js also
// declares STORAGE_KEY. Isolating this module avoids redeclaration errors.
(() => {
const STORAGE_KEY = "autoClaimPoints";
const MIN_DELAY_MS = 5000;
const MAX_DELAY_MS = 25000;
const POLL_INTERVAL_MS = 2000;

let enabled = true;
let pollId = null;
let pendingTimerId = null;

function randomDelay() {
  return MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);
}

// The claim-bonus button wraps a `.claimable-bonus__icon` element.
// That icon only exists in the DOM while a claim is available, so its
// presence is a reliable "the button is green right now" signal.
function findClaimButton() {
  const icon = document.querySelector(".claimable-bonus__icon");
  if (!icon) return null;
  return icon.closest("button");
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
    if (current) current.click();
  }, randomDelay());
}

function start() {
  if (pollId !== null) return;
  pollId = setInterval(checkAndSchedule, POLL_INTERVAL_MS);
  checkAndSchedule();
}

function stop() {
  if (pollId !== null) {
    clearInterval(pollId);
    pollId = null;
  }
  cancelPending();
}

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
