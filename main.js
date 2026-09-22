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

// Constant-stimuli run takes precedence: it manages its own state/save.
if (typeof csRunActive === "function" && csRunActive()) {
  stopAudio();
  csAbort();
  return;
}

if (phase === "training") {
  abortTraining(); //  tells flow.js to stop future audio/images
  stopAudio();
  trialIndex = 0;
  responseLog.length = 0;
  showScreen("thankyou");
  if (abortBtn) abortBtn.style.display = "none";
} else if (phase === "test") {
    stopAudio();
    showScreen("thankyou");
    if (abortBtn) abortBtn.style.display = "none";
    saveResults("test aborted at " + new Date().toLocaleString());
  }
}

// Escape key handler (keyboard path keeps a confirm; the on-screen button uses
// a 3-second hold instead, so a stray tap can't end the session).
window.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  const inRun = (phase === "training" || phase === "test" ||
    (typeof csRunActive === "function" && csRunActive()));
  if (!inRun) return;
  if (confirm("End the current session?")) abortPhase();
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

  // Merge persisted SNR noise-timing (presentation) settings into `config`.
  // config.json values (if any) act as defaults; a saved Setup overrides them.
  try {
    const raw = localStorage.getItem("uc4afc_snr_timing");
    if (raw) {
      const t = JSON.parse(raw);
      const merge = (k) => { if (isFinite(Number(t[k]))) config[k] = Number(t[k]); };
      merge("snrWordLeadMs"); merge("snrNoiseLeadMs");
      merge("snrNoiseTrailMs"); merge("snrNoiseRampMs");
    }
  } catch (_) {}
  
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
  // Visibility is driven per-phase (training + test) elsewhere; default hidden.
  abortBtn.style.display = "none";

  const ring = document.getElementById("abortProgress");
  const CIRC = 100.53;                 // 2*pi*16, matches the CSS dasharray
  const HOLD_MS = 3000;                // hold duration to confirm
  let rafId = null, holdStart = 0, pointerId = null;

  const setProgress = (frac) => {
    if (ring) ring.style.strokeDashoffset = String(CIRC * (1 - Math.max(0, Math.min(1, frac))));
  };
  const resetRing = () => {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    abortBtn.classList.remove("holding");
    setProgress(0);
    pointerId = null;
  };
  const tick = () => {
    const frac = (performance.now() - holdStart) / HOLD_MS;
    setProgress(frac);
    if (frac >= 1) {
      resetRing();
      abortPhase();          // the completed hold IS the confirmation
      return;
    }
    rafId = requestAnimationFrame(tick);
  };
  const startHold = (ev) => {
    ev.preventDefault();
    if (rafId) return;       // already holding
    if (ev.pointerId != null) {
      pointerId = ev.pointerId;
      try { abortBtn.setPointerCapture(pointerId); } catch (_) {}
    }
    abortBtn.classList.add("holding");
    holdStart = performance.now();
    rafId = requestAnimationFrame(tick);
  };
  const cancelHold = (ev) => {
    if (ev) ev.preventDefault();
    resetRing();
  };

  // Pointer events cover mouse + touch + pen in one path.
  if (window.PointerEvent) {
    abortBtn.addEventListener("pointerdown", startHold);
    abortBtn.addEventListener("pointerup", cancelHold);
    abortBtn.addEventListener("pointercancel", cancelHold);
    abortBtn.addEventListener("pointerleave", cancelHold);
  } else {
    // Fallback for older engines.
    abortBtn.addEventListener("mousedown", startHold);
    abortBtn.addEventListener("mouseup", cancelHold);
    abortBtn.addEventListener("mouseleave", cancelHold);
    abortBtn.addEventListener("touchstart", startHold, { passive: false });
    abortBtn.addEventListener("touchend", cancelHold);
    abortBtn.addEventListener("touchcancel", cancelHold);
  }
  // A plain click never aborts (guards against assistive double-activations).
  abortBtn.addEventListener("click", (e) => e.preventDefault());
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
      if (abortBtn && config.showAbortXOnTouchDevices !== false) {
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
      if (abortBtn && config.showAbortXOnTouchDevices !== false) {
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

  // Constant-stimuli (normalisation) screen wiring.
  if (typeof setupConstantScreen === "function") setupConstantScreen();
  if (typeof setupVerifyFilter === "function") setupVerifyFilter();
};

// --- Calibration screen wiring (mirrors UC_CVCV) -----------------------------
// The calibration tone is the 1 kHz reference (audiometer aux-input nulling; also
// available for free-field/masking). The sound-field noise is config.calibNoiseFile.
const CALIB_URL = () => (typeof config !== "undefined" && config && config.calibFile)
  ? `sounds/${config.calibFile}` : "sounds/calibration_UC4AFC_1kHz.mp3";
const CALIB_NOISE_URL = () => (typeof config !== "undefined" && config && config.calibNoiseFile)
  ? `sounds/${config.calibNoiseFile}` : "sounds/noise.mp3";

function refreshCalStatus() {
  const el = document.getElementById("calStatus");
  if (!el || typeof Calibration === "undefined") return;
  if (Calibration.isCalibrated()) {
    el.textContent = `Calibrated: ${Calibration.calibrationHeader()}. Device volume must be at maximum.`;
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

function updateOutputLevelFromSlider(snap = true) {
  const slider = document.getElementById("outputLevel");
  const label = document.getElementById("outputLevelLabel");
  const badge = document.getElementById("modeBadge");
  if (!slider || typeof Calibration === "undefined") return;
  const c = Calibration.state();
  let raw = parseFloat(slider.value);

  if (c.isCalibrated && c.measuredDbA !== null) {
    const max = parseFloat(slider.max);
    const tol = 0.25;
    // While dragging (snap=false) keep the exact value for smooth audition;
    // on release (snap=true) settle onto the 5 dB grid.
    const shown = snap
      ? (Math.abs(raw - max) <= tol ? max : Math.round(raw / 5) * 5)
      : raw;
    if (snap) slider.value = shown;
    Calibration.setCurrentSliderDb(shown);
    if (label) label.textContent = `${snap ? shown : Math.round(shown)} dB A`;
    if (badge) { badge.textContent = "Calibrated Mode"; badge.classList.add("calibrated"); }
    // Live: if the Test tone is auditioning, move its level with the slider.
    if (typeof AudioEngine !== "undefined" && AudioEngine.isCalibrationTonePlaying &&
        AudioEngine.isCalibrationTonePlaying()) {
      const earSel = document.getElementById("calEarSelect");
      const ear = earSel ? earSel.value : "binaural";
      AudioEngine.setCalibrationGainDb(Calibration.gainDbForLevel(shown, ear));
    }
  } else {
    const snapped = Math.round(raw / 5) * 5;
    slider.value = snapped;
    Calibration.setCurrentSliderDb(snapped);
    if (label) label.textContent = `${snapped} dB FS`;
    if (badge) { badge.textContent = "Uncalibrated Mode"; badge.classList.remove("calibrated"); }
  }
}

// True when the current method uses the 1 kHz tone (audiometer) vs noise (sound field).
function calSignalIsTone() {
  const sel = document.getElementById("calMethodSelect");
  const method = (sel && sel.value) || (typeof Calibration !== "undefined" ? Calibration.calMethod() : "audiometer");
  return method === "audiometer";
}
function calPlayLabel(playing) {
  const sig = calSignalIsTone() ? "1 kHz tone" : "calibration noise";
  return `${playing ? "■ Stop" : "▶ Play"} ${sig}`;
}
// The signal URL for the current method: tone for audiometer, noise for sound field.
function calSignalUrl() {
  return calSignalIsTone() ? CALIB_URL() : CALIB_NOISE_URL();
}

// Render the method-dependent parts of the calibration screen: steps, the
// single-vs-dual level inputs, the play-button label, and the routing hint.
function renderCalMethodUI() {
  if (typeof Calibration === "undefined") return;
  const sel = document.getElementById("calMethodSelect");
  const method = (sel && sel.value) || Calibration.calMethod();
  const info = (Calibration.CAL_METHODS && Calibration.CAL_METHODS[method])
    || Calibration.CAL_METHODS.audiometer;

  // Steps.
  const ol = document.getElementById("calSteps");
  if (ol) {
    ol.innerHTML = "";
    (info.steps || []).forEach(s => {
      const li = document.createElement("li");
      li.textContent = s;
      ol.appendChild(li);
    });
  }

  const isAud = method === "audiometer";

  // Level label + hint.
  const lbl = document.getElementById("calLevelLabelText");
  if (lbl) lbl.textContent = info.levelLabel || "Level, dB(A)";
  const hint = document.getElementById("calLevelHint");
  if (hint) {
    hint.textContent = isAud
      ? "Levels are presented from this figure downward. Set the dial to the loudest " +
        "level you'll need, plus a little margin — at least 6 dB if you'll be masking."
      : "This is the most this setup can deliver with the device at full volume. The " +
        "calibration is valid only for this speaker, seat and room — recalibrate if any change.";
  }

  // Routing selector is an audiometer concern (per-channel aux calibration).
  const earWrap = document.getElementById("calEarWrap");
  const earHint = document.getElementById("calEarHint");
  if (earWrap) earWrap.style.display = isAud ? "" : "none";
  if (earHint) {
    earHint.textContent = isAud
      ? "Play the tone to both channels and zero each audiometer input (A and B) to " +
        "VU 0 off this one tone. Both channels are then referenced to the tone, so the " +
        "software can place speech and masker correctly on either side."
      : "";
  }
  // Default routing to both in every method.
  const earSel = document.getElementById("calEarSelect");
  if (earSel) { earSel.value = "binaural"; if (AudioEngine.setCalibrationEar) AudioEngine.setCalibrationEar("binaural"); }

  // Single (sound field) vs dual dials (audiometer).
  const dual = document.getElementById("calDialDualWrap");
  const single = document.getElementById("calLevelSingleWrap");
  if (dual) dual.style.display = isAud ? "" : "none";
  if (single) single.style.display = isAud ? "none" : "";
  if (isAud) {
    const c = Calibration.state();
    const d = c.dial || {};
    const dl = document.getElementById("calDialLeft");
    const dr = document.getElementById("calDialRight");
    if (dl) dl.value = d.left ?? (c.measuredDbA ?? "");
    if (dr) dr.value = d.right ?? (c.measuredDbA ?? "");
  } else {
    const inp = document.getElementById("calLevelInput");
    if (inp) inp.value = Calibration.state().measuredDbA ?? "";
  }

  // Test-output slider + Test-level button belong to SOUND-FIELD ONLY, and only
  // once calibrated. Audiometer never shows them (no slider, no test playback).
  const calibrated = Calibration.isCalibrated();
  const showTestUI = (!isAud && calibrated);
  const testRow = document.getElementById("calTestRow");
  if (testRow) testRow.style.display = showTestUI ? "flex" : "none";

  // Play-button label follows the method.
  const toggleBtn = document.getElementById("calToneToggleBtn");
  if (toggleBtn && !toggleBtn.classList.contains("active")) toggleBtn.textContent = calPlayLabel(false);
}

function setupCalibrationScreen() {
  const toggleBtn = document.getElementById("calToneToggleBtn");
  const testBtn   = document.getElementById("testCalBtn");
  const clearBtn  = document.getElementById("calClearBtn");
  const backBtn   = document.getElementById("calBackBtn");
  const saveBtn   = document.getElementById("calSaveBtn");
  const methodSel = document.getElementById("calMethodSelect");
  const earSel    = document.getElementById("calEarSelect");
  const slider    = document.getElementById("outputLevel");
  if (!toggleBtn) return; // screen not present

  let playing = false;
  let testOn = false;

  // Offer any stored calibration on load, and initialise the slider.
  if (typeof Calibration !== "undefined") {
    const restored = Calibration.loadStored();
    if (restored) {
      if (methodSel && restored.method) methodSel.value = restored.method;
      if (typeof Calibration.setMethod === "function" && restored.method) Calibration.setMethod(restored.method);
      // Auto-activate the stored calibration on return so the test UI is live
      // immediately (operator confirmed device volume when they first saved).
      Calibration.confirmStored(restored);
      const when = restored.timestamp
        ? new Date(restored.timestamp).toLocaleString("en-NZ", { dateStyle: "short", timeStyle: "short" })
        : "earlier";
      const el = document.getElementById("calStatus");
      if (el) {
        el.textContent = `Calibrated: ${Calibration.calibrationHeader()} (restored from ${when}). ` +
          `Device volume must be at maximum.` +
          (restored.stale ? " Over 30 days old — recalibration recommended." : "");
      }
    }
  }
  setupCalibrationSlider();
  renderCalMethodUI();

  // Method change: re-render the method-dependent UI and reset the signal.
  if (methodSel) methodSel.onchange = () => {
    if (typeof Calibration !== "undefined" && Calibration.setMethod) Calibration.setMethod(methodSel.value);
    if (playing) { AudioEngine.stopCalibrationTone(); playing = false; }
    toggleBtn.classList.remove("active");
    renderCalMethodUI();
  };

  // Live per-channel re-route while the signal plays.
  if (earSel) earSel.onchange = () => {
    if (AudioEngine.setCalibrationEar) AudioEngine.setCalibrationEar(earSel.value);
  };

  // Play / stop the calibration signal (tone for audiometer, noise for sound field).
  toggleBtn.onclick = async () => {
    if (typeof AudioEngine === "undefined") return;
    if (playing) {
      AudioEngine.stopCalibrationTone();
      playing = false;
      toggleBtn.textContent = calPlayLabel(false);
      toggleBtn.classList.remove("active");
      return;
    }
    await AudioEngine.resume();
    AudioEngine.stopCalibrationTone();
    testOn = false;
    if (testBtn) testBtn.textContent = "Test level";
    const ear = earSel ? earSel.value : "binaural";
    try {
      await AudioEngine.startCalibrationTone(calSignalUrl(), { ear });
      playing = true;
      toggleBtn.textContent = calPlayLabel(true);
      toggleBtn.classList.add("active");
    } catch (err) {
      const el = document.getElementById("calStatus");
      const what = calSignalIsTone()
        ? ((config && config.calibFile) || "calibration_UC4AFC_1kHz.mp3")
        : ((config && config.calibNoiseFile) || "noise.mp3");
      if (el) el.textContent = `Calibration signal not found (${calSignalUrl()}). Add ${what} to the sounds/ folder.`;
      console.error(err);
    }
  };

  // Save calibration: dual dials (audiometer) or single level (sound field).
  if (saveBtn) saveBtn.onclick = () => {
    if (typeof Calibration === "undefined") return;
    const method = methodSel ? methodSel.value : Calibration.calMethod();
    const status = document.getElementById("calStatus");

    if (method === "audiometer") {
      const lRaw = document.getElementById("calDialLeft")?.value ?? "";
      const rRaw = document.getElementById("calDialRight")?.value ?? "";
      const lHas = lRaw !== "" && Number.isFinite(Number(lRaw));
      const rHas = rRaw !== "" && Number.isFinite(Number(rRaw));
      if (!lHas && !rHas) { if (status) status.textContent = "Enter at least one dial setting before saving."; return; }
      const ok = Calibration.applyCalibrationDials(
        lHas ? Number(lRaw) : null, rHas ? Number(rRaw) : null,
        new Date().toISOString(), method);
      if (!ok) { if (status) status.textContent = "Those dial settings don't give a usable range. Check they're dB(A) audiometer dial settings."; return; }
    } else {
      const raw = document.getElementById("calLevelInput")?.value ?? "";
      if (raw === "" || !Number.isFinite(Number(raw))) { if (status) status.textContent = "Enter the measured level before saving."; return; }
      const ok = Calibration.applyCalibrationLevel(Number(raw), new Date().toISOString(), method);
      if (!ok) { if (status) status.textContent = `${raw} dB(A) is not a usable reference. Check the figure is the meter reading in dB(A).`; return; }
    }
    if (playing) { AudioEngine.stopCalibrationTone(); playing = false; toggleBtn.textContent = calPlayLabel(false); toggleBtn.classList.remove("active"); }
    setupCalibrationSlider();
    renderCalMethodUI();
    refreshCalStatus();
  };

  // Test level: replay the signal at the current slider level.
  if (testBtn) {
    testBtn.onclick = async () => {
      if (typeof Calibration === "undefined" || !Calibration.isCalibrated()) return;
      if (testOn) { AudioEngine.stopCalibrationTone(); testOn = false; testBtn.textContent = "Test level"; return; }
      await AudioEngine.resume();
      const ear = earSel ? earSel.value : "binaural";
      const gainDb = Calibration.gainDbForLevel(Calibration.state().currentSliderDb, ear);
      try {
        await AudioEngine.startCalibrationTone(calSignalUrl(), { extraGainDb: gainDb, ear });
        testOn = true;
        testBtn.textContent = "Stop";
      } catch (err) {
        if (document.getElementById("calStatus")) document.getElementById("calStatus").textContent = "Calibration signal not found.";
        console.error(err);
      }
    };
  }

  if (slider) {
    slider.addEventListener("input", () => updateOutputLevelFromSlider(false));
    slider.addEventListener("change", () => updateOutputLevelFromSlider(true));
  }

  clearBtn.onclick = () => {
    if (typeof Calibration !== "undefined") Calibration.clearCalibration();
    AudioEngine.stopCalibrationTone();
    playing = testOn = false;
    toggleBtn.textContent = calPlayLabel(false);
    toggleBtn.classList.remove("active");
    if (testBtn) { testBtn.hidden = true; testBtn.textContent = "Test level"; }
    setupCalibrationSlider();
    renderCalMethodUI();
    refreshCalStatus();
  };

  backBtn.onclick = () => {
    if (typeof AudioEngine !== "undefined") AudioEngine.stopCalibrationTone();
    playing = testOn = false;
    toggleBtn.textContent = calPlayLabel(false);
    toggleBtn.classList.remove("active");
    if (testBtn) testBtn.textContent = "Test level";
    showScreen("intro");
  };
}

// --- Setup screen wiring (adaptive controls, Step 4) -------------------------
let _setupProc = "wudr";
let _setupMode = "lpf";
let _setupDirty = false;   // unsaved edits present in the Setup form

// Reflect the dirty/saved state in the status line and Save button so it's
// never ambiguous whether Setup changes are stored. (Back auto-saves, but the
// cue reassures the operator and prompts them to Save if they prefer.)
function updateDirtyUI() {
  const status = document.getElementById("setupStatus");
  if (status) {
    status.textContent = _setupDirty
      ? "Not saved as default — Back applies for this session only."
      : "";
    status.style.color = _setupDirty ? "#b00" : "";
  }
  const saveBtn = document.getElementById("setupSaveBtn");
  if (saveBtn) {
    saveBtn.textContent = _setupDirty ? "Save as default *" : "Save as default";
    saveBtn.classList.toggle("dirty", _setupDirty);
  }
}

function markDirty() {
  if (!_setupDirty) { _setupDirty = true; updateDirtyUI(); }
}

function currentAdaptiveCfg() {
  // Show the LIVE session settings if present (so reopening Setup within a
  // session reflects what's actually running, including changes applied via
  // Back), falling back to the persisted default.
  if (typeof config !== "undefined" && config && config.adaptive) return config.adaptive;
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
  // The LPF presentation-level block: LPF only. In quiet the level IS the
  // adaptive variable, and SNR sets its level in the noise block.
  const lpfLevelBlock = document.getElementById("lpfLevelBlock");
  if (lpfLevelBlock) lpfLevelBlock.hidden = (mode !== "lpf");
}

// Relabel units and adjust input bounds/steps for the active mode.
function applyModeLabels(mode) {
  const isQuiet = (mode === "quiet");
  const isSnr = (mode === "snr");
  const isLinear = isQuiet || isSnr;   // dB axis (either level or SNR)
  const stepUnit = isLinear ? "dB" : "dec";
  const setText = (id, t) => { const el = document.getElementById(id); if (el) el.textContent = t; };
  setText("lblStart", isSnr ? "Starting SNR (dB)" : isQuiet ? "Starting level (dB)" : "Starting cutoff (Hz)");
  // SNR noise-level label depends on calibration: dB(A) when calibrated, else a
  // dB FS attenuation the operator sets (device volume does the rest).
  const cal = (typeof Calibration !== "undefined" && Calibration.isCalibrated && Calibration.isCalibrated());
  setText("lblSnrNoiseLevel", cal ? "Noise level (dB A)" : "Noise level (dB FS attenuation)");
  setText("lblLpfLevel", cal ? "Level (dB A)" : "Level (dB FS attenuation)");
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
  // Presentation-level fields: set bounds/step for the calibration state, but
  // NEVER rewrite the user's entered value here (that caused the field to reset
  // itself, e.g. -20 -> 0). Value defaulting/clamping lives in fillFormFromCfg.
  const nl = document.getElementById("setSnrNoiseLevel");
  if (nl) {
    if (cal) { nl.min = 40; nl.max = 90; nl.step = 1; }
    else     { nl.min = -60; nl.max = 0; nl.step = 1; }
  }
  const ll = document.getElementById("setLpfLevel");
  if (ll) {
    if (cal) { ll.min = 40; ll.max = 90; ll.step = 1; }
    else     { ll.min = -60; ll.max = 0; ll.step = 1; }
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

// Populate the whole form from a resolved cfg object.
function fillFormFromCfg(cfg) {
  const set = (id, v) => { const el = document.getElementById(id); if (el != null && v != null) el.value = v; };
  const isQuiet = (cfg.mode === "quiet");
  const isSnr = (cfg.mode === "snr");
  set("setStartCutoff",
    isSnr   ? (cfg.startValue ?? 2)
  : isQuiet ? (cfg.startValue ?? 65)
  : (cfg.startValue ?? cfg.startCutoffHz ?? 1000));
  set("setSnrStepMult", cfg.stepMult ?? 0.2);
  // Presentation-level fields: default per calibration state when unset, and
  // clamp a value carried from the other calibration state into range.
  const cal = (typeof Calibration !== "undefined" && Calibration.isCalibrated && Calibration.isCalibrated());
  const levelDefault = cal ? 65 : 0;
  const clampLevel = (v) => {
    let n = Number(v);
    if (!isFinite(n)) n = levelDefault;
    return cal ? Math.max(40, Math.min(90, n)) : Math.max(-60, Math.min(0, n));
  };
  set("setSnrNoiseLevel", clampLevel(cfg.snrNoiseLevel ?? levelDefault));
  set("setLpfLevel", clampLevel(cfg.lpfLevel ?? levelDefault));
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

// SNR noise-timing (presentation) fields live on `config`, not the adaptive
// cfg. Populate them from config with the documented defaults.
function fillSnrTimingFromConfig() {
  const set = (id, v) => { const el = document.getElementById(id); if (el != null && v != null) el.value = v; };
  const c = (typeof config !== "undefined" && config) ? config : {};
  set("setSnrWordLead",   c.snrWordLeadMs   ?? c.imageRevealOffsetMs ?? 600);
  set("setSnrNoiseLead",  c.snrNoiseLeadMs  ?? 600);
  set("setSnrNoiseTrail", c.snrNoiseTrailMs ?? 600);
  set("setSnrNoiseRamp",  c.snrNoiseRampMs  ?? 100);
}

function populateSetupForm() {
  const cfg = currentAdaptiveCfg();
  _setupProc = cfg.procedure || "wudr";
  _setupMode = cfg.mode || "lpf";
  showProcBlocks(_setupProc);
  showModeButtons(_setupMode);
  applyModeLabels(_setupMode);
  fillFormFromCfg(cfg);
  fillSnrTimingFromConfig();

  _setupDirty = false;
  updateDirtyUI();
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
    startValue: startVal,
    startCutoffHz: isLinear ? undefined : startVal,  // LPF alias only
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
    // SNR noise presentation level (dB(A) if calibrated, else dB FS attenuation).
    // Stored for all modes but only consumed in SNR.
    snrNoiseLevel: num("setSnrNoiseLevel", (typeof Calibration !== "undefined" && Calibration.isCalibrated && Calibration.isCalibrated()) ? 65 : 0),
    // LPF presentation level (dB(A) if calibrated, else dB FS attenuation).
    // Consumed in LPF mode.
    lpfLevel: num("setLpfLevel", (typeof Calibration !== "undefined" && Calibration.isCalibrated && Calibration.isCalibrated()) ? 65 : 0),
    routing: val("setRouting") || "binaural"
  };
}

function setupSetupScreen() {
  const seg = document.getElementById("procSegmented");
  if (!seg) return; // screen not present

  seg.querySelectorAll(".seg-btn").forEach(btn => {
    btn.onclick = () => { _setupProc = btn.dataset.proc; showProcBlocks(_setupProc); markDirty(); };
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
        markDirty();
      };
    });
  }

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

  // Two-tier persistence:
  //   applySetupToSession()  -> live config only (this session's run). Back uses
  //                             this: current settings take effect now but do
  //                             NOT become the standing default.
  //   saveSetupAsDefault()   -> everything applySetupToSession does, PLUS writes
  //                             localStorage so the settings persist across
  //                             reloads/relaunches as the default.
  //
  // SNR-timing fields live on config; helper reads them from the form.
  function readSnrTimingFromForm() {
    const numOr = (id, dflt) => {
      const el = document.getElementById(id);
      const v = el ? parseFloat(el.value) : NaN;
      return isFinite(v) && v >= 0 ? v : dflt;
    };
    return {
      snrWordLeadMs:   numOr("setSnrWordLead", 600),
      snrNoiseLeadMs:  numOr("setSnrNoiseLead", 600),
      snrNoiseTrailMs: numOr("setSnrNoiseTrail", 600),
      snrNoiseRampMs:  numOr("setSnrNoiseRamp", 100)
    };
  }

  // Apply the form to the live session config (no localStorage write).
  function applySetupToSession() {
    const cfg = readSetupForm();
    if (typeof config !== "undefined") {
      config.adaptive = cfg;
      config.routing = cfg.routing;   // surfaced at top level for flow.js
      const t = readSnrTimingFromForm();
      config.snrWordLeadMs   = t.snrWordLeadMs;
      config.snrNoiseLeadMs  = t.snrNoiseLeadMs;
      config.snrNoiseTrailMs = t.snrNoiseTrailMs;
      config.snrNoiseRampMs  = t.snrNoiseRampMs;
    }
    return cfg;
  }

  // Apply to the session AND persist as the default.
  function saveSetupAsDefault() {
    const cfg = applySetupToSession();
    if (typeof AdaptiveConfig !== "undefined") AdaptiveConfig.saveAdaptiveConfig(cfg);
    try {
      const t = readSnrTimingFromForm();
      localStorage.setItem("uc4afc_snr_timing", JSON.stringify(t));
    } catch (_) {}
    _setupDirty = false;
    updateDirtyUI();
  }

  // Any edit to a Setup control marks the form dirty and reflects it in the UI,
  // so it's never ambiguous whether changes are the saved default yet. Delegated
  // listener covers every input/select, including ones toggled in/out per mode.
  const setupScreen = document.getElementById("setup");
  if (setupScreen) {
    const onEdit = (e) => {
      const t = e.target;
      if (!t || !/^(INPUT|SELECT)$/.test(t.tagName)) return;
      if (t.readOnly) return;                    // A / target are display-only
      markDirty();
    };
    setupScreen.addEventListener("input", onEdit);
    setupScreen.addEventListener("change", onEdit);
  }

  const saveBtn = document.getElementById("setupSaveBtn");
  if (saveBtn) saveBtn.onclick = () => {
    saveSetupAsDefault();
    const status = document.getElementById("setupStatus");
    if (status) { status.textContent = "Saved as default."; status.style.color = ""; }
  };

  const resetBtn = document.getElementById("setupResetBtn");
  if (resetBtn) resetBtn.onclick = () => {
    if (typeof AdaptiveConfig !== "undefined") {
      AdaptiveConfig.clearAdaptiveConfig();
      if (typeof config !== "undefined") config.adaptive = AdaptiveConfig.loadAdaptiveConfig();
    }
    populateSetupForm();
    _setupDirty = false;
    updateDirtyUI();
    const status = document.getElementById("setupStatus");
    if (status) { status.textContent = "Reset to defaults."; status.style.color = ""; }
  };

  // Back applies the current form to THIS session (so a run started now uses it)
  // but does not change the persisted default. Save-as-default is the only path
  // that writes localStorage.
  const backBtn = document.getElementById("setupBackBtn");
  if (backBtn) backBtn.onclick = () => {
    applySetupToSession();
    _setupDirty = false;
    updateDirtyUI();
    showScreen("intro");
  };
}
