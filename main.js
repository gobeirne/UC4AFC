let assetsReady = false;
let waitingToBeginPhase = "";
let waitingListNum = null;

// Abort current training audio and timeouts if needed
function abortPhase() {
  const abortBtn = document.getElementById("abortBtn");

  const stopAudio = () => {
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audio.src = "";
      audio.onended = null;
    }
  };

if (phase === "training" && confirm("Abort training?")) {
  abortTraining(); // ðŸ‘ˆ tells flow.js to stop future audio/images
  stopAudio();
  trialIndex = 0;
  responseLog.length = 0;
  showScreen("thankyou");
  if (abortBtn) abortBtn.style.display = "none";
} else if (phase === "test" && confirm("Abort test and save progress?")) {
    stopAudio();
    showScreen("thankyou");
    if (abortBtn) abortBtn.style.display = "none";
    saveResults("test aborted at " + new Date().toLocaleString());
  }
}

// Escape key handler
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") abortPhase();
});

// Show loading screen and wait until assetsReady becomes true
function waitForAssetsThenBegin() {
  showScreen("loading");

  const okBtn = document.getElementById("loading-ok");
  okBtn.disabled = true;
  okBtn.style.display = "inline-block";
  okBtn.textContent = "Loadingâ€¦";

  okBtn.onclick = () => {
    okBtn.disabled = true;
    okBtn.style.display = "none";
    beginPhase(waitingToBeginPhase);
    waitingListNum = null;
    waitingToBeginPhase = "";
  };

  const start = Date.now();
  const CHECK_MS = 200;
  const GRACE_MS = 8000; // after 8s, let the user start anyway

  const check = () => {
    if (assetsReady) {
      document.querySelector("#loading h2").textContent = "âœ… Ready!";
      document.querySelector("#loading p").textContent = "Assets have been loaded.";
      okBtn.disabled = false;
      okBtn.textContent = "OK";
      return;
    }

    const elapsed = Date.now() - start;
    if (elapsed > GRACE_MS && okBtn.disabled) {
      okBtn.disabled = false;
      okBtn.textContent = "Start (assets still loading)";
      const p = document.querySelector("#loading p");
      if (p) p.textContent = "Some assets may continue loading in the background.";
    }

    setTimeout(check, CHECK_MS);
  };

  check();
}



window.onload = async () => {
  await new Promise(resolve => {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", resolve);
    } else {
      resolve();
    }
  });

  await loadConfig();
  
  // âœ… Initialise arrowSet before list/preload
  if (location.protocol === "file:") {
    // Local: use the static list embedded in config
    setArrowList(Array.isArray(config.arrowList) ? config.arrowList : []);
  } else {
    // Hosted: prefer arrowFiles.json (fallback to config.arrowList)
    try {
      const res = await fetch("arrowFiles.json");
      const arr = await res.json();
      setArrowList(Array.isArray(arr) ? arr : []);
    } catch (e) {
      setArrowList(Array.isArray(config.arrowList) ? config.arrowList : []);
    }
  }
  await loadList();

  showScreen("intro");
  adjustImageSize();
  window.addEventListener("resize", adjustImageSize);

  // Start preloading in background
preloadAllAssets().then(() => {
  assetsReady = true;
  console.log("âœ… Assets preloaded.");
  // âŒ Don't auto-begin â€” wait for user to click OK
});


  setOptImgs();

const abortBtn = document.getElementById("abortBtn");
if (abortBtn) {
  // ðŸ–¼ï¸ Show the button only if needed
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const showOnTouch = config.showAbortXOnTouchDevices === true;
  abortBtn.style.display = (showOnTouch && isTouchDevice) ? "block" : "none";

  // ðŸ§  Always attach the click handler
  abortBtn.addEventListener("click", abortPhase);
}


  optImgs.forEach(img => {
    img.addEventListener("click", () => recordResponse(img));
  });

  const back = document.getElementById("backBtn");
  const ok   = document.getElementById("okBtn");
  const ret  = document.getElementById("returnBtn");

  if (back) back.addEventListener("click", () => showScreen("intro"));
 // if (ok)   ok.addEventListener("click", () => beginPhase(phase));
  if (ret)  ret.addEventListener("click", () => {
    trialIndex = 0;
    responseLog.length = 0;
    if (abortBtn) abortBtn.style.display = "none";
    showScreen("intro");
  });

  document.getElementById("delay").value = config.defaultDelay || 1500;
  document.getElementById("delay").oninput = (e) => {
    const val = parseInt(e.target.value);
    if (!isNaN(val)) config.delayMs = val;
  };

// Taking a break...
const breakEveryInput = document.getElementById("breakEvery");
if (breakEveryInput) {
  // set initial UI value from config default
  breakEveryInput.value = typeof config.breakEvery === "number" ? config.breakEvery : 24;
  breakEveryInput.oninput = (e) => {
    const n = parseInt(e.target.value, 10);
    // 0 or empty = disable breaks
    if (!Number.isNaN(n) && n >= 0) config.breakEvery = n;
  };
}



  // Helper function to get selected list
  function getSelectedList() {
    const radios = document.getElementsByName("listSelection");
    for (const radio of radios) {
      if (radio.checked) return radio.value;
    }
    return "1"; // default
  }

  // Train Button - uses selected list
  document.getElementById("trainBtn").onclick = () => {
    selectedList = getSelectedList();
    showInstructions("training", () => {
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      if (abortBtn && config.showAbortXOnTouchDevices && isTouchDevice) {
        abortBtn.style.display = "block";
      }

      if (assetsReady) {
        beginPhase("training");
      } else {
        waitingToBeginPhase = "training";
        waitForAssetsThenBegin();
      }
    });
  };

  // Demo Button - uses demo list and doesn't save results
  document.getElementById("demoBtn").onclick = () => {
    selectedList = "demo";
    showInstructions("test", () => {
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      if (abortBtn && config.showAbortXOnTouchDevices && isTouchDevice) {
        abortBtn.style.display = "block";
      }

      if (assetsReady) {
        beginPhase("test", "demo");
      } else {
        waitingToBeginPhase = "test";
        waitingListNum = "demo";
        waitForAssetsThenBegin();
      }
    });
  };

  // Start Button - uses selected list
  document.getElementById("startBtn").onclick = () => {
    selectedList = getSelectedList();
    showInstructions("test", () => {
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      if (abortBtn && config.showAbortXOnTouchDevices && isTouchDevice) {
        abortBtn.style.display = "block";
      }

      if (assetsReady) {
        beginPhase("test");
      } else {
        waitingToBeginPhase = "test";
        waitForAssetsThenBegin();
      }
    });
  };

  document.getElementById("calibrateBtn").onclick = startCalibration;
};
