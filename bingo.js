// Bingo helper: detects PoguinBot bingo pulls and auto-sends !yoink
// when one of your numbers is called. Active only on /towdan.

const TARGET_CHANNEL = "towdan";
const STORAGE_KEY = "bingo";
const MATCH_DELAY_MS = 3000;
const DEFAULT_STATE = {
  enabled: false,
  panelOpen: true,
  numbers: [], // numbers we're waiting on
  called: [], // numbers we've already yoinked
  lastCalled: null,
  lastYoinkAt: null,
  position: null, // { left, top } in px from viewport edges; null = default
};

let state = { ...DEFAULT_STATE };
const seenMessages = new WeakSet();
let chatObserver = null;
let pendingMatch = null; // { number, timerId, deadline, countdownId }

// ---------- Storage ----------

function loadState() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ [STORAGE_KEY]: DEFAULT_STATE }, (result) => {
      state = { ...DEFAULT_STATE, ...result[STORAGE_KEY] };
      resolve();
    });
  });
}

function saveState() {
  chrome.storage.local.set({ [STORAGE_KEY]: state });
}

// ---------- Number parsing ----------

function parseNumbers(input) {
  return input
    .split(/[\s,]+/)
    .map((token) => parseInt(token, 10))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 99);
}

// Wording varies; the bingo number is always the LAST 1–99 in the body.
function extractPulledNumber(text) {
  const matches = [...text.matchAll(/\d+/g)];
  for (let i = matches.length - 1; i >= 0; i--) {
    const n = parseInt(matches[i][0], 10);
    if (Number.isInteger(n) && n >= 1 && n <= 99) return n;
  }
  return null;
}

// Author-name selectors across regular + announcement chat lines.
const AUTHOR_SELECTORS = [
  ".chat-author__display-name",
  "[data-a-target='chat-message-username']",
  ".chatter-name",
];

function getAuthorName(node) {
  for (const sel of AUTHOR_SELECTORS) {
    const el = node.querySelector(sel);
    if (el) return el.textContent.trim();
  }
  return "";
}

// Message body only — excludes badge alt text, username prefix, timestamps.
function getMessageBody(node) {
  const fragments = node.querySelectorAll(
    "[data-a-target='chat-message-text'], [data-a-target='chat-line-message-body'] .text-fragment, .text-fragment",
  );
  if (fragments.length) {
    return Array.from(fragments)
      .map((el) => el.textContent)
      .join(" ");
  }
  // Fallback: strip "Author:" prefix from full text
  const author = getAuthorName(node);
  const full = (node.textContent || "").trim();
  if (author) {
    const needle = `${author}:`;
    const idx = full.indexOf(needle);
    if (idx !== -1) return full.slice(idx + needle.length).trim();
  }
  return full;
}

// PoguinBot also posts winner announcements ("They have won 5 times") —
// those should NOT trigger a yoink.
const NON_PULL_REGEX = /\b(winner|congrats|congratulations|won)\b/i;

// ---------- Sending chat ----------

function sendChatMessage(message) {
  // Twitch chat input is a contenteditable Slate editor or a textarea
  // depending on context. Try textarea first, then contenteditable.
  const textarea = document.querySelector(
    'textarea[data-a-target="chat-input"]',
  );
  if (textarea) {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value",
    ).set;
    setter.call(textarea, message);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    const sendBtn = document.querySelector(
      'button[data-a-target="chat-send-button"]',
    );
    if (sendBtn) {
      sendBtn.click();
      return true;
    }
    // Fallback: dispatch Enter
    textarea.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
        bubbles: true,
      }),
    );
    return true;
  }

  const editable = document.querySelector(
    '[data-a-target="chat-input"][contenteditable="true"], div[contenteditable="true"][role="textbox"]',
  );
  if (editable) {
    editable.focus();
    // Slate.js editors respond to beforeinput / insertText
    document.execCommand("selectAll", false, null);
    document.execCommand("insertText", false, message);
    const sendBtn = document.querySelector(
      'button[data-a-target="chat-send-button"]',
    );
    if (sendBtn) {
      sendBtn.click();
      return true;
    }
    editable.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
        bubbles: true,
      }),
    );
    return true;
  }

  return false;
}

function yoink(number) {
  const ok = sendChatMessage("!yoink");
  if (!ok) {
    setStatus(`Couldn't find chat input for !yoink on ${number}`, "error");
    return false;
  }
  if (number !== null && number !== undefined) {
    state.numbers = state.numbers.filter((n) => n !== number);
    state.called = [...state.called, number];
  }
  state.lastYoinkAt = Date.now();
  saveState();
  renderPanel();
  setStatus(number ? `Yoinked ${number}!` : "Sent !yoink", "ok");
  return true;
}

function clearPendingMatch() {
  if (!pendingMatch) return;
  clearTimeout(pendingMatch.timerId);
  clearInterval(pendingMatch.countdownId);
  pendingMatch = null;
  const panel = document.getElementById("tcl-bingo-panel");
  if (panel) panel.classList.remove("alerting");
}

function schedulePendingMatch(number) {
  clearPendingMatch();

  // Force panel open so the user sees the alert
  if (!state.panelOpen) {
    state.panelOpen = true;
    saveState();
    renderPanel();
  }

  const panel = document.getElementById("tcl-bingo-panel");
  if (panel) panel.classList.add("alerting");

  const deadline = Date.now() + MATCH_DELAY_MS;

  const tick = () => {
    if (!pendingMatch) return;
    const remaining = Math.max(0, pendingMatch.deadline - Date.now());
    const secs = (remaining / 1000).toFixed(1);
    setStatus(
      `MATCH ${number}! Click !yoink now — auto in ${secs}s`,
      "alert",
    );
  };

  const timerId = setTimeout(() => {
    const num = pendingMatch?.number;
    clearPendingMatch();
    if (num !== null && num !== undefined) yoink(num);
  }, MATCH_DELAY_MS);

  const countdownId = setInterval(tick, 100);

  pendingMatch = { number, timerId, deadline, countdownId };
  tick();
}

// ---------- Chat watching ----------

function handleChatLine(node) {
  if (seenMessages.has(node)) return;
  seenMessages.add(node);

  const author = getAuthorName(node).toLowerCase();
  if (author !== "poguinbot") return;

  const body = getMessageBody(node);
  if (NON_PULL_REGEX.test(body)) return;

  const number = extractPulledNumber(body);
  if (number === null) return;

  state.lastCalled = number;
  saveState();
  renderPanel();

  if (!state.enabled) {
    setStatus(`Pulled ${number} (auto-yoink off)`, "info");
    return;
  }

  if (state.numbers.includes(number)) {
    schedulePendingMatch(number);
  } else {
    setStatus(`Pulled ${number} — not on your card`, "info");
  }
}

function attachChatObserver() {
  if (chatObserver) chatObserver.disconnect();

  const container =
    document.querySelector(".chat-scrollable-area__message-container") ||
    document.querySelector(
      '[data-test-selector="chat-scrollable-area__message-container"]',
    );

  if (!container) return false;

  // Process any messages already in the DOM
  container
    .querySelectorAll(
      ".chat-line__message, [data-a-target='chat-line-message']",
    )
    .forEach(handleChatLine);

  chatObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((node) => {
        if (node.nodeType !== 1) return;
        if (
          node.matches?.(
            ".chat-line__message, [data-a-target='chat-line-message']",
          )
        ) {
          handleChatLine(node);
        } else {
          node
            .querySelectorAll?.(
              ".chat-line__message, [data-a-target='chat-line-message']",
            )
            .forEach(handleChatLine);
        }
      });
    }
  });
  chatObserver.observe(container, { childList: true, subtree: false });
  return true;
}

function watchForChat() {
  // Twitch is a SPA; the chat container can come and go. Keep trying.
  if (attachChatObserver()) return;
  const root = new MutationObserver(() => {
    if (attachChatObserver()) {
      // Don't disconnect — the container can be replaced on navigation.
    }
  });
  root.observe(document.documentElement, { childList: true, subtree: true });
}

// ---------- Panel UI ----------

let statusEl = null;
let statusTimer = null;

function setStatus(text, kind = "info") {
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.dataset.kind = kind;
  clearTimeout(statusTimer);
  // Don't auto-clear the live alert text — the countdown rewrites it.
  if (kind === "alert") return;
  statusTimer = setTimeout(() => {
    if (statusEl) statusEl.textContent = "";
  }, 6000);
}

function renderPanel() {
  const panel = document.getElementById("tcl-bingo-panel");
  if (!panel) return;

  panel.classList.toggle("collapsed", !state.panelOpen);

  const enableToggle = panel.querySelector("#tcl-bingo-enable");
  if (enableToggle) enableToggle.checked = state.enabled;

  const numbersEl = panel.querySelector("#tcl-bingo-numbers");
  if (numbersEl) {
    numbersEl.innerHTML = "";
    if (state.numbers.length === 0) {
      const empty = document.createElement("div");
      empty.className = "tcl-bingo-empty";
      empty.textContent = "No numbers yet — add them above.";
      numbersEl.appendChild(empty);
    } else {
      state.numbers
        .slice()
        .sort((a, b) => a - b)
        .forEach((n) => {
          const chip = document.createElement("button");
          chip.type = "button";
          chip.className = "tcl-bingo-chip";
          chip.textContent = n;
          chip.title = `Remove ${n}`;
          chip.addEventListener("click", () => {
            state.numbers = state.numbers.filter((x) => x !== n);
            saveState();
            renderPanel();
          });
          numbersEl.appendChild(chip);
        });
    }
  }

  const calledEl = panel.querySelector("#tcl-bingo-called");
  if (calledEl) {
    calledEl.textContent = state.lastCalled
      ? `Last pull: ${state.lastCalled}`
      : "Last pull: —";
  }
}

// ---------- Drag-to-move ----------

function clampPosition(left, top, panel) {
  const margin = 4;
  const w = panel.offsetWidth || 260;
  const h = panel.offsetHeight || 40;
  const maxLeft = Math.max(margin, window.innerWidth - w - margin);
  const maxTop = Math.max(margin, window.innerHeight - h - margin);
  return {
    left: Math.min(Math.max(margin, left), maxLeft),
    top: Math.min(Math.max(margin, top), maxTop),
  };
}

function applyPanelPosition(panel) {
  if (!state.position) return;
  const { left, top } = clampPosition(
    state.position.left,
    state.position.top,
    panel,
  );
  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;
  panel.style.right = "auto";
  panel.style.bottom = "auto";
}

function wireDrag(panel) {
  const header = panel.querySelector(".tcl-bingo-header");
  let dragging = false;
  let pointerId = null;
  let startX = 0;
  let startY = 0;
  let originLeft = 0;
  let originTop = 0;
  let moved = false;

  header.addEventListener("pointerdown", (e) => {
    // Don't start a drag from the collapse button
    if (e.target.closest("#tcl-bingo-toggle")) return;
    if (e.button !== 0) return;
    dragging = true;
    moved = false;
    pointerId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    const rect = panel.getBoundingClientRect();
    originLeft = rect.left;
    originTop = rect.top;
    // Switch to explicit left/top so dragging works regardless of default anchor
    panel.style.left = `${originLeft}px`;
    panel.style.top = `${originTop}px`;
    panel.style.right = "auto";
    panel.style.bottom = "auto";
    header.setPointerCapture(pointerId);
    panel.classList.add("dragging");
    e.preventDefault();
  });

  header.addEventListener("pointermove", (e) => {
    if (!dragging || e.pointerId !== pointerId) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!moved && Math.hypot(dx, dy) > 3) moved = true;
    const { left, top } = clampPosition(
      originLeft + dx,
      originTop + dy,
      panel,
    );
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
  });

  function endDrag(e) {
    if (!dragging || e.pointerId !== pointerId) return;
    dragging = false;
    panel.classList.remove("dragging");
    try {
      header.releasePointerCapture(pointerId);
    } catch {
      // ignore
    }
    pointerId = null;
    if (moved) {
      panel.dataset.dragged = "1";
      state.position = {
        left: parseFloat(panel.style.left),
        top: parseFloat(panel.style.top),
      };
      saveState();
    }
  }
  header.addEventListener("pointerup", endDrag);
  header.addEventListener("pointercancel", endDrag);

  // Re-clamp on viewport resize so the panel can't get stranded off-screen
  window.addEventListener("resize", () => {
    if (state.position) applyPanelPosition(panel);
  });
}

function createPanel() {
  if (document.getElementById("tcl-bingo-panel")) return;

  const panel = document.createElement("div");
  panel.id = "tcl-bingo-panel";
  panel.className = state.panelOpen ? "" : "collapsed";
  panel.innerHTML = `
    <div class="tcl-bingo-header" title="Drag to move">
      <span class="tcl-bingo-title">Bingo</span>
      <button type="button" id="tcl-bingo-toggle" title="Collapse">_</button>
    </div>
    <div class="tcl-bingo-body">
      <label class="tcl-bingo-row">
        <input type="checkbox" id="tcl-bingo-enable" />
        <span>Auto-yoink on match</span>
      </label>
      <form id="tcl-bingo-form" class="tcl-bingo-row">
        <input
          type="text"
          id="tcl-bingo-input"
          inputmode="numeric"
          placeholder="Add numbers (e.g. 7, 12, 23)"
          autocomplete="off"
        />
        <button type="submit">Add</button>
      </form>
      <div id="tcl-bingo-numbers" class="tcl-bingo-numbers"></div>
      <div class="tcl-bingo-footer">
        <span id="tcl-bingo-called">Last pull: —</span>
        <button type="button" id="tcl-bingo-yoink">!yoink now</button>
        <button type="button" id="tcl-bingo-clear">Clear</button>
      </div>
      <div id="tcl-bingo-status" class="tcl-bingo-status" data-kind="info"></div>
    </div>
  `;
  document.body.appendChild(panel);

  statusEl = panel.querySelector("#tcl-bingo-status");
  applyPanelPosition(panel);
  wireDrag(panel);

  panel.querySelector("#tcl-bingo-toggle").addEventListener("click", () => {
    state.panelOpen = !state.panelOpen;
    saveState();
    renderPanel();
  });

  panel.querySelector(".tcl-bingo-header").addEventListener("click", (e) => {
    if (e.target.id === "tcl-bingo-toggle") return;
    if (panel.dataset.dragged === "1") {
      // Suppress click that follows a drag
      delete panel.dataset.dragged;
      return;
    }
    if (!state.panelOpen) {
      state.panelOpen = true;
      saveState();
      renderPanel();
    }
  });

  panel.querySelector("#tcl-bingo-enable").addEventListener("change", (e) => {
    state.enabled = e.target.checked;
    saveState();
  });

  panel.querySelector("#tcl-bingo-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = panel.querySelector("#tcl-bingo-input");
    const added = parseNumbers(input.value);
    if (added.length === 0) {
      setStatus("No valid numbers (1–99) found in input", "error");
      return;
    }
    const merged = Array.from(new Set([...state.numbers, ...added]));
    state.numbers = merged;
    saveState();
    input.value = "";
    renderPanel();
    setStatus(`Added: ${added.join(", ")}`, "ok");
  });

  panel.querySelector("#tcl-bingo-yoink").addEventListener("click", () => {
    if (pendingMatch) {
      const num = pendingMatch.number;
      clearPendingMatch();
      yoink(num);
    } else {
      const ok = sendChatMessage("!yoink");
      setStatus(
        ok ? "Sent !yoink" : "Couldn't find chat input",
        ok ? "ok" : "error",
      );
    }
  });

  panel.querySelector("#tcl-bingo-clear").addEventListener("click", () => {
    if (state.numbers.length === 0) return;
    state.numbers = [];
    saveState();
    renderPanel();
    setStatus("Cleared all numbers", "info");
  });

  renderPanel();
}

function waitForBody() {
  return new Promise((resolve) => {
    if (document.body) return resolve();
    const obs = new MutationObserver(() => {
      if (document.body) {
        obs.disconnect();
        resolve();
      }
    });
    obs.observe(document.documentElement, { childList: true });
  });
}

// ---------- Channel scoping ----------

function isTargetChannel() {
  // Twitch channel pages are /<channel> (and /<channel>/anything-else).
  // Be permissive about case and trailing path segments.
  const first = location.pathname.split("/").filter(Boolean)[0];
  return first?.toLowerCase() === TARGET_CHANNEL;
}

function teardown() {
  clearPendingMatch();
  if (chatObserver) {
    chatObserver.disconnect();
    chatObserver = null;
  }
  const panel = document.getElementById("tcl-bingo-panel");
  if (panel) panel.remove();
  statusEl = null;
}

function activate() {
  if (document.getElementById("tcl-bingo-panel")) return;
  createPanel();
  watchForChat();
}

function syncWithLocation() {
  if (isTargetChannel()) {
    activate();
  } else {
    teardown();
  }
}

function watchUrlChanges() {
  let lastPath = location.pathname;
  const check = () => {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      syncWithLocation();
    }
  };
  // Twitch is a SPA; pushState/replaceState don't fire popstate.
  const origPush = history.pushState;
  const origReplace = history.replaceState;
  history.pushState = function (...args) {
    const ret = origPush.apply(this, args);
    check();
    return ret;
  };
  history.replaceState = function (...args) {
    const ret = origReplace.apply(this, args);
    check();
    return ret;
  };
  window.addEventListener("popstate", check);
  // Belt-and-suspenders: watch for DOM-level navigation indicators too.
  const obs = new MutationObserver(check);
  obs.observe(document.documentElement, { childList: true, subtree: false });
}

async function init() {
  await loadState();
  await waitForBody();
  watchUrlChanges();
  syncWithLocation();
}

init();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes[STORAGE_KEY]) return;
  const next = changes[STORAGE_KEY].newValue;
  if (!next) return;
  state = { ...DEFAULT_STATE, ...next };
  renderPanel();
});
