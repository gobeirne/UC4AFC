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

  // Merge persisted adaptive Setup config into `config` (mirrors config.js).
  if (typeof AdaptiveConfig !== "undefined") {
    AdaptiveConfig.mergeAdaptiveIntoConfig(config);
  }
  
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

  // Setup screen (adaptive controls)
  const setupBtn = document.getElementById("setupBtn");
  if (setupBtn) setupBtn.onclick = () => { showScreen("setup"); populateSetupForm(); };
  setupSetupScreen();
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

// --- Setup screen wiring (adaptive controls, Step 4) -------------------------
let _setupProc = "wudr";
let _setupMode = "lpf";

function currentAdaptiveCfg() {
  if (typeof AdaptiveConfig !== "undefined") return AdaptiveConfig.loadAdaptiveConfig();
  return {};
}

function showProcBlocks(proc) {
  const map = { wudr: "wudrBlock", a1: "a1Block", a2: "a2Block" };
  Object.entries(map).forEach(([p, id]) => {
    const el = document.getElementById(id);
    if (el) el.hidden = (p !== proc);
  });
  document.querySelectorAll("#procSegmented .seg-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.proc === proc);
  });
}

function showModeButtons(mode) {
  document.querySelectorAll("#modeSegmented .seg-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.mode === mode);
  });
  const hint = document.getElementById("modeHint");
  if (hint) hint.textContent =
    (mode === "quiet") ? "Adapts presentation level (dB). Uncalibrated runs are relative to the start level."
  : (mode === "snr")   ? "Adapts signal-to-noise ratio (dB). Masking noise is fixed at the presentation level; the signal moves."
  : "Adapts the equivalent low-pass cutoff (Hz).";
  // The SNR-only block (step multiplier) is shown only in SNR mode.
  const snrBlock = document.getElementById("snrBlock");
  if (snrBlock) snrBlock.hidden = (mode !== "snr");
}

// Relabel units and adjust input bounds/steps for the active mode.
function applyModeLabels(mode) {
  const isQuiet = (mode === "quiet");
  const isSnr = (mode === "snr");
  const isLinear = isQuiet || isSnr;   // dB axis (either level or SNR)
  const stepUnit = isLinear ? "dB" : "dec";
  const setText = (id, t) => { const el = document.getElementById(id); if (el) el.textContent = t; };
  setText("lblStart", isSnr ? "Starting SNR (dB)" : isQuiet ? "Starting level (dB)" : "Starting cutoff (Hz)");
  setText("lblStartRel", isSnr ? "Start (dB re threshold)" : isQuiet ? "Start (dB re threshold)" : "Start (octaves re threshold)");
  document.querySelectorAll(".lblStepUnit-wd").forEach(e => e.textContent = `Working down step (${stepUnit})`);
  document.querySelectorAll(".lblStepUnit-wu").forEach(e => e.textContent = `Working up step (${stepUnit})`);
  document.querySelectorAll(".lblStepUnit-id").forEach(e => e.textContent = `Initial down step (${stepUnit})`);
  document.querySelectorAll(".lblStepUnit-iu").forEach(e => e.textContent = `Initial up step (${stepUnit})`);

  // Start input bounds/step per mode.
  const sc = document.getElementById("setStartCutoff");
  if (sc) {
    if (isSnr) { sc.min = -20; sc.max = 10; sc.step = 1; }
    else if (isQuiet) { sc.min = 20; sc.max = 85; sc.step = 1; }
    else { sc.min = 80; sc.max = 6000; sc.step = 10; }
  }
  // Step inputs: fine in SNR (small dB), medium in quiet, very fine in LPF.
  ["setWorkDown","setWorkUp","setInitDown","setInitUp"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.step = isSnr ? 0.01 : isQuiet ? 0.1 : 0.0001;
  });
  const wudrHint = document.getElementById("wudrHint");
  if (wudrHint) wudrHint.textContent =
    isSnr   ? "SNR steps = quiet dB steps \u00d7 the multiplier below. 0 reversals = single-phase."
  : isQuiet ? "Quiet defaults: down 0.6 dB / up 1.0 dB (working); down 3 / up 5 (initial). 0 reversals = single-phase."
  : "Defaults: down \u22124.76% / up +8.33% (working); down \u221211.1% / up +20.8% (initial). 0 reversals = single-phase.";
}

function toggleStartMode(mode) {
  const abs = document.getElementById("setStartCutoffWrap");
  const rel = document.getElementById("setStartRelWrap");
  if (abs) abs.hidden = (mode !== "absolute");
  if (rel) rel.hidden = (mode !== "relative");
}

// Populate the whole form from a resolved cfg object.
function fillFormFromCfg(cfg) {
  const set = (id, v) => { const el = document.getElementById(id); if (el != null && v != null) el.value = v; };
  const isQuiet = (cfg.mode === "quiet");
  const isSnr = (cfg.mode === "snr");
  set("setStartMode", cfg.startMode || "absolute");
  toggleStartMode(cfg.startMode || "absolute");
  set("setStartCutoff",
    isSnr   ? (cfg.startValue ?? cfg.start ?? 2)
  : isQuiet ? (cfg.startValue ?? cfg.start ?? 65)
  : (cfg.startValue ?? cfg.startCutoffHz ?? 1000));
  set("setSnrStepMult", cfg.stepMult ?? 0.2);
  set("setStartRel", cfg.startRelOctaves ?? 0);
  set("setNTrials", cfg.nTrials ?? 33);
  set("setA", cfg.A ?? 4);
  set("setTarget", ((cfg.target ?? 0.625) * 100).toFixed(1) + "%");
  set("setWorkDown", cfg.workDown);
  set("setWorkUp", cfg.workUp);
  set("setInitDown", cfg.initDown);
  set("setInitUp", cfg.initUp);
  set("setSwitchRev", cfg.switchRev);
  set("setA1Slope", cfg.a1slope);
  set("setA2Slope", cfg.a2slope);
  set("setPLow", (cfg.pLow ?? 0.40).toFixed(2));
  set("setPHigh", (cfg.pHigh ?? 0.85).toFixed(2));
  const dbl = document.getElementById("setA2Doubling");
  if (dbl) dbl.checked = cfg.a2Doubling !== false;
  set("setRouting", cfg.routing || (config && config.routing) || "binaural");
}

function populateSetupForm() {
  const cfg = currentAdaptiveCfg();
  _setupProc = cfg.procedure || "wudr";
  _setupMode = cfg.mode || "lpf";
  showProcBlocks(_setupProc);
  showModeButtons(_setupMode);
  applyModeLabels(_setupMode);
  fillFormFromCfg(cfg);

  const status = document.getElementById("setupStatus");
  if (status) status.textContent = "";
}

function readSetupForm() {
  const num = (id, dflt) => {
    const el = document.getElementById(id);
    const v = el ? parseFloat(el.value) : NaN;
    return isFinite(v) ? v : dflt;
  };
  const val = (id) => { const el = document.getElementById(id); return el ? el.value : undefined; };
  const A = 4;
  const isQuiet = (_setupMode === "quiet");
  const isSnr = (_setupMode === "snr");
  const isLinear = isQuiet || isSnr;   // dB axis (level or SNR)
  const sweet = (typeof AdaptiveConfig !== "undefined") ? AdaptiveConfig.sweetPointsFor(A) : { pLow: 0.40, pHigh: 0.85 };
  const midpoint = (typeof AdaptiveConfig !== "undefined") ? AdaptiveConfig.midpointTarget(A) : 0.625;
  const startVal = num("setStartCutoff", isSnr ? 2 : isQuiet ? 65 : 1000);

  // In SNR mode the WUDR steps are derived from the multiplier (single source of
  // truth), not read from the step inputs. Other modes read the step inputs.
  const stepMult = isSnr ? num("setSnrStepMult", 0.2) : undefined;
  const snrSteps = (isSnr && typeof AdaptiveConfig !== "undefined")
    ? AdaptiveConfig.snrStepsForMult(stepMult)
    : null;

  return {
    mode: _setupMode,
    procedure: _setupProc,
    A,
    target: midpoint,
    axisIsLog: !isLinear,
    unit: isSnr ? "dB SNR" : isQuiet ? "dB" : "Hz",
    stepUnit: isLinear ? "dB" : "decades",
    slopeUnit: isLinear ? "%/dB" : "%/octave",
    startMode: val("setStartMode") || "absolute",
    startValue: startVal,
    startCutoffHz: isLinear ? undefined : startVal,  // LPF alias only
    startRelOctaves: num("setStartRel", 0),
    nTrials: Math.max(1, Math.min(66, Math.round(num("setNTrials", 33)))),
    xlo: isSnr ? -20 : isQuiet ? 20 : Math.log10(80),
    xhi: isSnr ? 10 : isQuiet ? 85 : Math.log10(6000),
    workDown: snrSteps ? snrSteps.workDown : num("setWorkDown", isQuiet ? 0.6 : 0.0212),
    workUp:   snrSteps ? snrSteps.workUp   : num("setWorkUp",   isQuiet ? 1.0 : 0.0348),
    initDown: snrSteps ? snrSteps.initDown : num("setInitDown", isQuiet ? 3.0 : 0.0511),
    initUp:   snrSteps ? snrSteps.initUp   : num("setInitUp",   isQuiet ? 5.0 : 0.0822),
    switchRev: Math.max(0, Math.round(num("setSwitchRev", 5))),
    a1slope: num("setA1Slope", isLinear ? 0.10 : 10),
    minStep: isSnr ? 0.05 : isQuiet ? 0.25 : 0.01,
    a2slope: num("setA2Slope", isLinear ? 0.10 : 10),
    pLow: sweet.pLow,
    pHigh: sweet.pHigh,
    a2Doubling: !!(document.getElementById("setA2Doubling") || {}).checked,
    slopeHint: isLinear ? 6 : 43,
    stepMult,   // undefined unless SNR
    routing: val("setRouting") || "binaural"
  };
}

function setupSetupScreen() {
  const seg = document.getElementById("procSegmented");
  if (!seg) return; // screen not present

  seg.querySelectorAll(".seg-btn").forEach(btn => {
    btn.onclick = () => { _setupProc = btn.dataset.proc; showProcBlocks(_setupProc); };
  });

  // Mode toggle: switch axis/units and load that mode's preset step values,
  // preserving procedure / nTrials / start mode / routing from the form.
  const modeSeg = document.getElementById("modeSegmented");
  if (modeSeg) {
    modeSeg.querySelectorAll(".seg-btn").forEach(btn => {
      btn.onclick = () => {
        const newMode = btn.dataset.mode;
        if (newMode === _setupMode) return;
        _setupMode = newMode;
        showModeButtons(_setupMode);
        applyModeLabels(_setupMode);
        // Apply the preset for the new mode over the current form values.
        if (typeof AdaptiveConfig !== "undefined") {
          const current = readSetupForm();
          const preset = AdaptiveConfig.applyModePreset(current, _setupMode);
          fillFormFromCfg(preset);
        }
      };
    });
  }

  const startMode = document.getElementById("setStartMode");
  if (startMode) startMode.onchange = () => toggleStartMode(startMode.value);

  // SNR step multiplier: recompute and display the four WUDR steps from it, so
  // the step fields always reflect quiet-base × multiplier.
  const snrMult = document.getElementById("setSnrStepMult");
  if (snrMult) {
    const applyMult = () => {
      if (_setupMode !== "snr" || typeof AdaptiveConfig === "undefined") return;
      const s = AdaptiveConfig.snrStepsForMult(parseFloat(snrMult.value));
      const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
      set("setWorkDown", s.workDown); set("setWorkUp", s.workUp);
      set("setInitDown", s.initDown); set("setInitUp", s.initUp);
    };
    snrMult.addEventListener("input", applyMult);
    snrMult.addEventListener("change", applyMult);
  }

  const saveBtn = document.getElementById("setupSaveBtn");
  if (saveBtn) saveBtn.onclick = () => {
    const cfg = readSetupForm();
    if (typeof AdaptiveConfig !== "undefined") AdaptiveConfig.saveAdaptiveConfig(cfg);
    if (typeof config !== "undefined") config.adaptive = cfg;
    // Routing is also surfaced at the top level of config for flow.js to read.
    if (typeof config !== "undefined") config.routing = cfg.routing;
    const status = document.getElementById("setupStatus");
    if (status) status.textContent = "Saved.";
  };

  const resetBtn = document.getElementById("setupResetBtn");
  if (resetBtn) resetBtn.onclick = () => {
    if (typeof AdaptiveConfig !== "undefined") {
      AdaptiveConfig.clearAdaptiveConfig();
      if (typeof config !== "undefined") config.adaptive = AdaptiveConfig.loadAdaptiveConfig();
    }
    populateSetupForm();
    const status = document.getElementById("setupStatus");
    if (status) status.textContent = "Reset to defaults.";
  };

  const backBtn = document.getElementById("setupBackBtn");
  if (backBtn) backBtn.onclick = () => showScreen("intro");
}
