const leftBtn = document.getElementById("left");
const rightBtn = document.getElementById("right");

function updateUI(position) {
  leftBtn.classList.toggle("active", position === "left");
  rightBtn.classList.toggle("active", position === "right");
}

chrome.storage.sync.get({ position: "right" }, (result) => {
  updateUI(result.position);
});

leftBtn.addEventListener("click", () => {
  chrome.storage.sync.set({ position: "left" });
  updateUI("left");
});

rightBtn.addEventListener("click", () => {
  chrome.storage.sync.set({ position: "right" });
  updateUI("right");
});
