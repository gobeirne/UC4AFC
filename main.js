// File: main.js
import { loadConfig } from "./config.js";
import { loadArrowFiles, preloadAssets, startCalibration } from "./preload.js";
import { setOptImgs, config, optImgs, phase, audio, responseLog, trialIndex } from "./global.js";
import { showScreen, adjustImageSize, showInstructions } from "./ui.js";
import { beginPhase } from "./flow.js";
import { saveResults } from "./results.js";

// --- Abort Phase Function ---
export function abortPhase() {
  const abortBtn = document.getElementById("abortBtn");

  const stopAudio = () => {
    if (audio && !audio.paused) {
      audio.pause();
      audio.currentTime = 0;
      audio.src = "";
    }
  };

  if (phase === "training" && confirm("Abort training?")) {
    stopAudio();
    showScreen("thankyou");
    if (abortBtn) abortBtn.style.display = "none";
  } else if (phase === "test" && confirm("Abort test and save progress?")) {
    stopAudio();
    showScreen("thankyou");
    if (abortBtn) abortBtn.style.display = "none";
    saveResults("test aborted at " + new Date().toLocaleString());
  }
}

// --- Escape Key to Abort ---
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    abortPhase();
  }
});

// --- Startup ---
window.onload = async () => {
  await new Promise(resolve => {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", resolve);
    } else {
      resolve();
    }
  });

  await loadConfig();
  await loadArrowFiles();
  setOptImgs();

// ✅ Show abort button ONLY on touch devices if configured
const abortBtn = document.getElementById("abortBtn");
if (abortBtn) {
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const showOnTouch = config.showAbortXOnTouchDevices === true;

  console.log("📱 Touch device detected?", isTouchDevice);
  console.log("⚙️ Config: showAbortXOnTouchDevices =", showOnTouch);

  if (showOnTouch && isTouchDevice) {
    console.log("✅ Showing abort button (touch device only)");
    abortBtn.style.display = "block";
  } else {
    console.log("🚫 Hiding abort button");
    abortBtn.style.display = "none";
  }
}


  document.getElementById("delay").value = config.defaultDelay || 1500;
  adjustImageSize();
  showScreen("intro");

  window.addEventListener("resize", adjustImageSize);

  // ✅ Set click handlers for test mode
  optImgs.forEach(img => {
    img.addEventListener("click", () => {
      recordResponse(img);
    });
  });

  // ✅ Wire up navigation buttons
  const back = document.getElementById("backBtn");
  const ok = document.getElementById("okBtn");
  const ret = document.getElementById("returnBtn");

  if (back) back.addEventListener("click", () => showScreen("intro"));
  if (ok)   ok.addEventListener("click", () => beginPhase(phase));
  if (ret)  ret.addEventListener("click", () => {
    trialIndex = 0;
    responseLog.length = 0;
    if (abortBtn) abortBtn.style.display = "none";
    showScreen("intro");
  });

  if (abortBtn) abortBtn.addEventListener("click", abortPhase);
};

// --- Delay Setting ---
document.getElementById("delay").oninput = (e) => {
  const val = parseInt(e.target.value);
  if (!isNaN(val)) config.delayMs = val;
};

// --- Main Buttons ---
document.getElementById("startBtn").onclick = () => {
  showInstructions("test", () => {
    const abortBtn = document.getElementById("abortBtn");
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (abortBtn && config.showAbortXOnTouchDevices && isTouchDevice) {
      abortBtn.style.display = "block";
    } else if (abortBtn) {
      abortBtn.style.display = "none";
    }
    beginPhase("test");
  });
};

document.getElementById("trainBtn").onclick = () => {
  showInstructions("training", () => {
    const abortBtn = document.getElementById("abortBtn");
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (abortBtn && config.showAbortXOnTouchDevices && isTouchDevice) {
      abortBtn.style.display = "block";
    } else if (abortBtn) {
      abortBtn.style.display = "none";
    }
    beginPhase("training");
  });
};


document.getElementById("preloadBtn").onclick = preloadAssets;
document.getElementById("calibrateBtn").onclick = startCalibration;
