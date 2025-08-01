// File: ui.js
import { config, optImgs, trainingImg } from "./global.js";

export const screens = Array.from(document.querySelectorAll(".screen"));

export function showScreen(id) {
  screens.forEach(s => s.style.display = "none");
  const target = document.getElementById(id);
  if (target) target.style.display = "block";
}

export function adjustImageSize() {
  const gridSize = Math.min(window.innerWidth, window.innerHeight) / 2 - 30;
  optImgs.forEach(img => {
    img.style.width = `${gridSize}px`;
    img.style.height = `${gridSize}px`;
  });
  trainingImg.style.width = `${gridSize}px`;
  trainingImg.style.height = `${gridSize}px`;
  trainingImg.style.objectFit = "contain";
  trainingImg.style.margin = "0 auto";
  trainingImg.style.display = "block";
}

export function setImage(imgEl, name, useArrows = true) {
  const basePath = `images/${name}`;
  const arrowPath = `${basePath}_arrow.jpg`;
  const normalPath = `${basePath}.jpg`;

  if (!useArrows) {
    imgEl.src = normalPath;
    return;
  }

  const probe = new Image();
  probe.onload = () => {
    imgEl.src = arrowPath;
  };
  probe.onerror = () => {
    imgEl.src = normalPath;
  };
  probe.src = arrowPath;
}

export function showInstructions(phase, onContinue) {
  const title = phase === "training" ? "Training Instructions" : "Test Instructions";
  const text = config.instructions?.[phase] || "(No instructions found)";

  document.getElementById("instructions-title").textContent = title;
  document.getElementById("instructions-text").textContent = text;

  showScreen("instructions");

  const okBtn = document.querySelector("#instructions button:last-of-type");
  const handler = () => {
    okBtn.removeEventListener("click", handler);
    onContinue();
  };
  okBtn.addEventListener("click", handler);
}
