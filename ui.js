// File: ui.js
import { config, optImgs, trainingImg, arrowSet } from "./global.js";
import { setImage } from "./setImage.js";

export const screens = Array.from(document.querySelectorAll(".screen"));

export function showScreen(id) {
  screens.forEach(s => s.style.display = "none");
  const target = document.getElementById(id);
  if (target) target.style.display = "block";
  // Let other modules react to screen changes (e.g. refresh the level fields).
  try { document.dispatchEvent(new CustomEvent("uc4afc:screen", { detail: id })); } catch (_) {}
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
  okBtn.textContent = "OK";
  backBtn.textContent = "Back";
  backBtn.style.display = "";
  const clear = () => { okBtn.onclick = null; backBtn.onclick = null; };
  okBtn.onclick = () => { clear(); onContinue(); };
  backBtn.onclick = () => { clear(); (onBack || (() => showScreen("intro")))(); };
}

// A message on the instructions screen with its own button labels, e.g. the
// end of a training list. Leave backLabel out for a single button.
export function showMessage(title, text, { okLabel = "OK", onOk, backLabel = null, onBack } = {}) {
  document.getElementById("instructions-title").textContent = title;
  document.getElementById("instructions-text").textContent = text;
  showScreen("instructions");
  const okBtn = document.getElementById("okBtn");
  const backBtn = document.getElementById("backBtn");
  okBtn.textContent = okLabel;
  backBtn.textContent = backLabel || "Back";
  backBtn.style.display = backLabel ? "" : "none";
  const clear = () => { okBtn.onclick = null; backBtn.onclick = null; };
  okBtn.onclick = () => { clear(); (onOk || (() => showScreen("intro")))(); };
  backBtn.onclick = () => { clear(); (onBack || (() => showScreen("intro")))(); };
}

// Break-screen encouragement: a different line at each break, plus a halfway
// and a nearly-there message. Starts at a random point so participants who
// sit both modes don't see the same order twice.
const BREAK_LINES = [
  ["You're doing a great job!", "Let's take a break."],
  ["Nice work!", "Take a moment to rest your ears."],
  ["Great listening!", "Time for a short break."],
  ["Keep it up!", "Have a stretch before the next set."],
  ["Well done so far!", "Take a breather, then carry on when you're ready."],
  ["Thanks for concentrating so hard!", "Have a little rest."],
  ["Excellent effort!", "Relax for a moment."],
  ["You're making good progress!", "Rest for a bit, then press OK to keep going."]
];
let breakLineAt = Math.floor(Math.random() * BREAK_LINES.length);
let halfwayShown = false, lastBreakDone = Infinity;
export function setBreakMessage(done, total) {
  const pct = total > 0 ? done / total : 0;
  if (done <= lastBreakDone) halfwayShown = false;          // a new run (or the first break)
  lastBreakDone = done;
  let title, text;
  if (!halfwayShown && pct >= 0.45 && pct <= 0.6) {
    halfwayShown = true;
    [title, text] = ["You're halfway there!", "Brilliant work. Take a short break."];
  } else if (pct >= 0.85) {
    [title, text] = ["Nearly finished!", "Not long to go now. Rest for a moment first."];
  } else {
    [title, text] = BREAK_LINES[breakLineAt % BREAK_LINES.length];
    breakLineAt++;
  }
  const t = document.getElementById("breakTitle"), x = document.getElementById("breakText");
  if (t) t.textContent = title;
  if (x) x.textContent = text;
}
