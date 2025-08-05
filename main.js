let assetsReady = false;
let waitingToBeginPhase = "";

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
  abortTraining(); // 👈 tells flow.js to stop future audio/images
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
  okBtn.textContent = "Loading…";

  okBtn.onclick = () => {
    okBtn.disabled = true;
    okBtn.style.display = "none";
    beginPhase(waitingToBeginPhase);
    waitingToBeginPhase = "";
  };

  const check = () => {
    if (assetsReady) {
      document.querySelector("#loading h2").textContent = "✅ Ready!";
      document.querySelector("#loading p").textContent = "Assets have been loaded.";
      okBtn.disabled = false;
      okBtn.textContent = "OK";
    } else {
      setTimeout(check, 200);
    }
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
  await loadList();

  showScreen("intro");
  adjustImageSize();
  window.addEventListener("resize", adjustImageSize);

  // Start preloading in background
preloadAllAssets().then(() => {
  assetsReady = true;
  console.log("✅ Assets preloaded.");
  // ❌ Don't auto-begin — wait for user to click OK
});


  setOptImgs();

  const abortBtn = document.getElementById("abortBtn");
  if (abortBtn) {
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const showOnTouch = config.showAbortXOnTouchDevices === true;
    abortBtn.style.display = (showOnTouch && isTouchDevice) ? "block" : "none";
    abortBtn.addEventListener("click", abortPhase);
  }

  optImgs.forEach(img => {
    img.addEventListener("click", () => recordResponse(img));
  });

  const back = document.getElementById("backBtn");
  const ok   = document.getElementById("okBtn");
  const ret  = document.getElementById("returnBtn");

  if (back) back.addEventListener("click", () => showScreen("intro"));
  if (ok)   ok.addEventListener("click", () => beginPhase(phase));
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

  // Train Button
  document.getElementById("trainBtn").onclick = () => {
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

  // Start Button
  document.getElementById("startBtn").onclick = () => {
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
