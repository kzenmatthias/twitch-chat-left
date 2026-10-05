const leftBtn = document.getElementById("left");
const rightBtn = document.getElementById("right");
const autoClaim = document.getElementById("auto-claim");

function updatePositionUI(position) {
  for (const [btn, value] of [
    [leftBtn, "left"],
    [rightBtn, "right"],
  ]) {
    btn.classList.toggle("active", position === value);
    btn.setAttribute("aria-pressed", String(position === value));
  }
}

chrome.storage.sync.get(
  { position: "right", autoClaimPoints: true },
  (result) => {
    updatePositionUI(result.position);
    autoClaim.checked = result.autoClaimPoints;
  },
);

leftBtn.addEventListener("click", () => {
  chrome.storage.sync.set({ position: "left" });
  updatePositionUI("left");
});

rightBtn.addEventListener("click", () => {
  chrome.storage.sync.set({ position: "right" });
  updatePositionUI("right");
});

autoClaim.addEventListener("change", (e) => {
  chrome.storage.sync.set({ autoClaimPoints: e.target.checked });
});
