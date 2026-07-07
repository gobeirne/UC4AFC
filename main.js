let assetsReady = false;
let waitingToBeginPhase = "";

// Abort current training audio and timeouts if needed
function abortPhase() {
  const abortBtn = document.getElementById("abortBtn");

  const stopAudio = () => {
    // Stop Web Audio playback (current engine path)
    if (typeof AudioEngine !== "undefined") AudioEngine.stop();
    // Legacy <audio> element, harmless if unused
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audio.src = "";
      audio.onended = null;
    }
  };

if (phase === "training" && confirm("Abort training?")) {
  abortTraining(); //  tells flow.js to stop future audio/images
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
  okBtn.textContent = "Loading...";

  okBtn.onclick = () => {
    okBtn.disabled = true;
    okBtn.style.display = "none";
    beginPhase(waitingToBeginPhase);
    waitingToBeginPhase = "";
  };

  const start = Date.now();
  const CHECK_MS = 200;
  const GRACE_MS = 8000; // after 8s, let the user start anyway

  const check = () => {
    if (assetsReady) {
      document.querySelector("#loading h2").textContent = "[OK] Ready!";
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
  
  // [OK] Initialise arrowSet before list/preload
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

  // Load the optional pre-measured stimulus LUFS table. If present, filtering
  // restores each word to its pre-measured original loudness (no live measure);
  // if absent, decode() measures live. Non-fatal either way.
  if (typeof AudioEngine !== "undefined" && AudioEngine.loadLUFSTable) {
    const file = (config && config.lufsTable) ? config.lufsTable : "stimulus_lufs.txt";
    AudioEngine.loadLUFSTable(file).then(n => {
      if (n > 0) console.log(`Loaded ${n} pre-measured LUFS values from ${file}.`);
    });
  }

  showScreen("intro");
  adjustImageSize();
  window.addEventListener("resize", adjustImageSize);

  // Start preloading in background
preloadAllAssets().then(() => {
  assetsReady = true;
  console.log("[OK] Assets preloaded.");
  // [X] Don't auto-begin — wait for user to click OK
});


  setOptImgs();

const abortBtn = document.getElementById("abortBtn");
if (abortBtn) {
  //  Show the button only if needed
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const showOnTouch = config.showAbortXOnTouchDevices === true;
  abortBtn.style.display = (showOnTouch && isTouchDevice) ? "block" : "none";

  //  Always attach the click handler
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


  // Train Button
  document.getElementById("trainBtn").onclick = () => {
    // Unlock the AudioContext within this user gesture (required on iOS/Safari),
    // then decode stimuli into the engine cache in the background. First play
    // still decodes on demand if warming hasn't finished.
    if (typeof AudioEngine !== "undefined") {
      AudioEngine.resume().then(() => {
        if (typeof warmDecodeCache === "function" && Array.isArray(list)) {
          const names = [...new Set(list.map(r => r && r.correct).filter(Boolean))];
          warmDecodeCache(names);
        }
      });
    }
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
    if (typeof AudioEngine !== "undefined") {
      AudioEngine.resume().then(() => {
        if (typeof warmDecodeCache === "function" && Array.isArray(list)) {
          const names = [...new Set(list.map(r => r && r.correct).filter(Boolean))];
          warmDecodeCache(names);
        }
      });
    }
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

  // Calibration screen
  document.getElementById("calibrateBtn").onclick = () => {
    if (typeof AudioEngine !== "undefined") AudioEngine.resume();
    showScreen("calibration");
    refreshCalStatus();
  };
  setupCalibrationScreen();
};

// --- Calibration screen wiring (mirrors UC_CVCV) -----------------------------
const CALIB_URL = () => (typeof config !== "undefined" && config && config.calibFile)
  ? `sounds/${config.calibFile}` : "sounds/calib.mp3";

function refreshCalStatus() {
  const el = document.getElementById("calStatus");
  if (!el || typeof Calibration === "undefined") return;
  if (Calibration.isCalibrated()) {
    el.textContent = `Calibrated to ${Calibration.measuredDbA()} dB(A). Device volume must be at maximum.`;
  } else {
    el.textContent = "";
  }
}

// Update the slider bounds/readout/mode badge from calibration state.
function setupCalibrationSlider() {
  const slider = document.getElementById("outputLevel");
  if (!slider || typeof Calibration === "undefined") return;
  const c = Calibration.state();
  slider.min = c.sliderMinDb ?? -100;
  slider.max = c.sliderMaxDb ?? 0;
  slider.step = 0.1;
  slider.value = c.currentSliderDb ?? slider.max;
  updateOutputLevelFromSlider();
}

function updateOutputLevelFromSlider() {
  const slider = document.getElementById("outputLevel");
  const label = document.getElementById("outputLevelLabel");
  const badge = document.getElementById("modeBadge");
  if (!slider || typeof Calibration === "undefined") return;
  const c = Calibration.state();
  let raw = parseFloat(slider.value);

  if (c.isCalibrated && c.measuredDbA !== null) {
    const max = parseFloat(slider.max);
    const tol = 0.25;
    const snapped = Math.abs(raw - max) <= tol ? max : Math.round(raw / 5) * 5;
    slider.value = snapped;
    Calibration.setCurrentSliderDb(snapped);
    if (label) label.textContent = `${snapped} dB A`;
    if (badge) { badge.textContent = "Calibrated Mode"; badge.classList.add("calibrated"); }
  } else {
    const snapped = Math.round(raw / 5) * 5;
    slider.value = snapped;
    Calibration.setCurrentSliderDb(snapped);
    if (label) label.textContent = `${snapped} dB FS`;
    if (badge) { badge.textContent = "Uncalibrated Mode"; badge.classList.remove("calibrated"); }
  }
}

function setupCalibrationScreen() {
  const toggleBtn = document.getElementById("calToneToggleBtn");
  const testBtn   = document.getElementById("testCalBtn");
  const clearBtn  = document.getElementById("calClearBtn");
  const backBtn   = document.getElementById("calBackBtn");
  const slider    = document.getElementById("outputLevel");
  if (!toggleBtn) return; // screen not present

  let toneOn = false;
  let testOn = false;

  // Offer any stored calibration on load, and initialise the slider.
  if (typeof Calibration !== "undefined") {
    const restored = Calibration.loadStored();
    if (restored) {
      if (testBtn) testBtn.hidden = false;
      const when = restored.timestamp
        ? new Date(restored.timestamp).toLocaleString("en-NZ", { dateStyle: "short", timeStyle: "short" })
        : "earlier";
      const el = document.getElementById("calStatus");
      if (el) el.textContent = `Calibration restored: ${restored.level} dB(A) from ${when}. Device volume must be at maximum.`;
    }
  }
  setupCalibrationSlider();

  // Toggle: play calibration tone (unity) -> stop & prompt for measured dB(A).
  toggleBtn.onclick = async () => {
    if (typeof AudioEngine === "undefined") return;

    if (toneOn) {
      // Stop and prompt (UC_CVCV flow).
      AudioEngine.stopCalibrationTone();
      toneOn = false;
      toggleBtn.textContent = "Calibration tone";
      toggleBtn.classList.remove("active");
      const measured = prompt("Enter measured calibration level (in dB A):");
      if (measured === null || measured === "" || isNaN(measured)) return;
      const level = parseFloat(measured);
      Calibration.applyCalibrationLevel(level);
      setupCalibrationSlider();
      if (testBtn) testBtn.hidden = false;
      refreshCalStatus();
      return;
    }

    await AudioEngine.resume();
    // Stop any test playback first.
    AudioEngine.stopCalibrationTone();
    testOn = false;
    if (testBtn) testBtn.textContent = "Test level";
    alert("Turn your device volume all the way up, then tap OK to play the calibration tone.");
    try {
      await AudioEngine.startCalibrationTone(CALIB_URL());
      toneOn = true;
      toggleBtn.textContent = "Stop & Enter Level";
      toggleBtn.classList.add("active");
      const el = document.getElementById("calStatus");
      if (el) el.textContent = "Calibration sound playing.";
    } catch (err) {
      alert("No calibration sound file found (" + CALIB_URL() + ").\nAdd calib.mp3 to the sounds/ folder.");
      console.error(err);
    }
  };

  // Test level: replay calibration file at the current slider level.
  if (testBtn) {
    testBtn.onclick = async () => {
      if (typeof Calibration === "undefined" || !Calibration.isCalibrated()) return;
      if (testOn) {
        AudioEngine.stopCalibrationTone();
        testOn = false;
        testBtn.textContent = "Test level";
        return;
      }
      await AudioEngine.resume();
      const gainDb = Calibration.gainDbForLevel(Calibration.state().currentSliderDb);
      try {
        await AudioEngine.startCalibrationTone(CALIB_URL(), { extraGainDb: gainDb });
        testOn = true;
        testBtn.textContent = "Stop";
      } catch (err) {
        alert("No calibration sound file found.");
        console.error(err);
      }
    };
  }

  if (slider) {
    slider.addEventListener("input", updateOutputLevelFromSlider);
    slider.addEventListener("change", updateOutputLevelFromSlider);
  }

  clearBtn.onclick = () => {
    if (typeof Calibration !== "undefined") Calibration.clearCalibration();
    AudioEngine.stopCalibrationTone();
    toneOn = testOn = false;
    toggleBtn.textContent = "Calibration tone";
    toggleBtn.classList.remove("active");
    if (testBtn) { testBtn.hidden = true; testBtn.textContent = "Test level"; }
    setupCalibrationSlider();
    refreshCalStatus();
  };

  backBtn.onclick = () => {
    if (typeof AudioEngine !== "undefined") AudioEngine.stopCalibrationTone();
    toneOn = testOn = false;
    toggleBtn.textContent = "Calibration tone";
    toggleBtn.classList.remove("active");
    if (testBtn) testBtn.textContent = "Test level";
    showScreen("intro");
  };
}
