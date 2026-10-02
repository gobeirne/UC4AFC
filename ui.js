// File: ui.js
import { config, optImgs, trainingImg, arrowSet } from "./global.js";
import { setImage } from "./setImage.js";

export const screens = Array.from(document.querySelectorAll(".screen"));

export function showScreen(id) {
  screens.forEach(s => s.style.display = "none");
  const target = document.getElementById(id);
  if (target) target.style.display = "block";
}

export function adjustImageSize() {
  const rowGap = 12;
  const colGap = 12;
  const padding = 20; // buffer from edges

  const availableWidth = window.innerWidth - colGap - padding * 2;
  const availableHeight = window.innerHeight - rowGap - padding * 2;

  const squareSize = Math.min(availableWidth / 2, availableHeight / 2);

  optImgs.forEach(img => {
    img.style.width = `${squareSize}px`;
    img.style.height = `${squareSize}px`;
  });

  trainingImg.style.width = `${squareSize}px`;
  trainingImg.style.height = `${squareSize}px`;
  trainingImg.style.objectFit = "contain";
  trainingImg.style.margin = "0 auto";
  trainingImg.style.display = "block";
}


export function showInstructions(phase, onContinue, onBack) {
  const title = phase === "training" ? "Training Instructions" : "Test Instructions";
  const text = config.instructions?.[phase] || "(No instructions found)";

  document.getElementById("instructions-title").textContent = title;
  document.getElementById("instructions-text").textContent = text;

  showScreen("instructions");

  // One OK/Back pair per showing. Assigning (not adding) the handlers replaces
  // any left over from an earlier showing, so e.g. Start -> Back -> Training
  // can't fire a stale Start handler on the next OK.
  const okBtn = document.getElementById("okBtn");
  const backBtn = document.getElementById("backBtn");
  const clear = () => { okBtn.onclick = null; backBtn.onclick = null; };
  okBtn.onclick = () => { clear(); onContinue(); };
  backBtn.onclick = () => { clear(); (onBack || (() => showScreen("intro")))(); };
}
