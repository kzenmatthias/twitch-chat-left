// Inject the CSS stylesheet
const link = document.createElement("link");
link.rel = "stylesheet";
link.href = chrome.runtime.getURL("content.css");
(document.head || document.documentElement).appendChild(link);

let currentPosition = "right";

// Apply saved position
function applyPosition(position) {
  currentPosition = position;
  if (position === "left") {
    document.body.classList.add("tcl-chat-left");
  } else {
    document.body.classList.remove("tcl-chat-left");
    // Reset player's inline left that Twitch's JS may have changed
    const player = document.querySelector(".persistent-player");
    if (player) player.style.left = "0px";
  }
  updateToggleButton();
  // Trigger resize so Twitch recalculates player dimensions
  window.dispatchEvent(new Event("resize"));
}

// Create the toggle button SVG icons
const ARROW_LEFT = `<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M12 4l-6 6 6 6V4z"/></svg>`;
const ARROW_RIGHT = `<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M8 4l6 6-6 6V4z"/></svg>`;

function updateToggleButton() {
  const btn = document.getElementById("tcl-toggle");
  if (!btn) return;
  btn.innerHTML = currentPosition === "left" ? ARROW_RIGHT : ARROW_LEFT;
  btn.title =
    currentPosition === "left" ? "Move chat to right" : "Move chat to left";
  btn.setAttribute("aria-label", btn.title);
}

function injectToggle(header) {
  if (document.getElementById("tcl-toggle")) return;

  const btn = document.createElement("button");
  btn.id = "tcl-toggle";
  btn.className =
    "ScCoreButton-sc-ocjdkq-0 glPhvE ScButtonIcon-sc-9yap0r-0 dgVYJo";
  btn.style.cssText =
    "display:inline-flex;align-items:center;justify-content:center;";
  btn.innerHTML = currentPosition === "left" ? ARROW_RIGHT : ARROW_LEFT;
  btn.title =
    currentPosition === "left" ? "Move chat to right" : "Move chat to left";
  btn.setAttribute("aria-label", btn.title);
  btn.addEventListener("click", () => {
    const newPosition = currentPosition === "left" ? "right" : "left";
    chrome.storage.sync.set({ position: newPosition });
    applyPosition(newPosition);
  });

  // Insert before the existing buttons
  const buttonArea = header.querySelector(
    '[class*="UPwco"], [class*="Layout-sc"]:last-child',
  );
  if (buttonArea) {
    const wrapper = document.createElement("div");
    wrapper.className = "InjectLayout-sc-1i43xsx-0 iDMNUO";
    wrapper.appendChild(btn);
    buttonArea.prepend(wrapper);
  }
}

// Watch for the chat header to appear (Twitch is a SPA)
function observeChatHeader() {
  const observer = new MutationObserver(() => {
    const header = document.querySelector(".stream-chat-header");
    if (header && !document.getElementById("tcl-toggle")) {
      injectToggle(header);
    }
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  // Also check immediately
  const header = document.querySelector(".stream-chat-header");
  if (header) injectToggle(header);
}

// Wait for body to exist, then apply
function init() {
  if (document.body) {
    chrome.storage.sync.get({ position: "right" }, (result) => {
      applyPosition(result.position);
      observeChatHeader();
    });
  } else {
    const observer = new MutationObserver(() => {
      if (document.body) {
        observer.disconnect();
        chrome.storage.sync.get({ position: "right" }, (result) => {
          applyPosition(result.position);
          observeChatHeader();
        });
      }
    });
    observer.observe(document.documentElement, { childList: true });
  }
}

init();

// Listen for changes from the popup
chrome.storage.onChanged.addListener((changes) => {
  if (changes.position) {
    applyPosition(changes.position.newValue);
  }
});
