// File: main.js
import { loadConfig } from "./config.js";
import { loadArrowFiles, preloadAssets, startCalibration } from "./preload.js";
import { setOptImgs, config, optImgs, phase } from "./global.js";
import { showScreen, adjustImageSize, showInstructions } from "./ui.js";
import { beginPhase } from "./flow.js";

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
  await loadArrowFiles(); // Must come after config

  setOptImgs(); // Populate image elements
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

  // ✅ Wire up navigation buttons after DOM is ready
  const back = document.getElementById("backBtn");
  const ok = document.getElementById("okBtn");
  const ret = document.getElementById("returnBtn");

  if (back) back.addEventListener("click", () => showScreen("intro"));
  if (ok)   ok.addEventListener("click", () => beginPhase(phase));
  
  if (ret) ret.addEventListener("click", () => {
    trialIndex = 0;
    responseLog.length = 0;
    showScreen("intro");
  });
};



// --- Delay Setting ---
document.getElementById("delay").oninput = (e) => {
  const val = parseInt(e.target.value);
  if (!isNaN(val)) config.delayMs = val;
};

// --- Main Buttons ---
document.getElementById("startBtn").onclick = () => {
  showInstructions("test", () => beginPhase("test"));
};

document.getElementById("trainBtn").onclick = () => {
  showInstructions("training", () => beginPhase("training"));
};

document.getElementById("preloadBtn").onclick = preloadAssets;
document.getElementById("calibrateBtn").onclick = startCalibration;

// --- Escape Key to Abort ---
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (phase === "training" && confirm("Abort training?")) {
      saveResults("training aborted at " + new Date().toLocaleString());
    } else if (phase === "test" && confirm("Abort test and save progress?")) {
      saveResults("test aborted at " + new Date().toLocaleString());
    }
  }
});

