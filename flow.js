// File: flow.js
import {
  config,
  list,
  trialIndex,
  responseLog,
  participant,
  phase,
  optImgs,
  audio,
  trainingImg,
  startTime,
  testStartedAt,
  arrowSet
} from "./global.js";

import { showScreen, setImage } from "./ui.js";
import { loadList } from "./list.js";
import { saveResults } from "./results.js";
import { AudioEngine } from "./audioEngine.js";
import { createTrack, resolveTrackConfig } from "./adaptive.js";

let trainingAborted = false;

// Active adaptive track (test phase only). null => no adaptive tracking (plays
// unfiltered at a fixed level, e.g. training or a non-adaptive run).
let track = null;
let currentCutoffHz = null;   // pending trial's adaptive value (Hz LPF / dB quiet)
let quietStartLevel = null;   // quiet-mode start level (dB), for uncalibrated relative gain

let lastBreakAt = -1;  // remember the index where we last stopped for a break

const isNonEmpty = v => typeof v === "string" && v.trim().length > 0;
const warn = (...args) => console.warn(...args);

export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

let nextImagesToPreload = [];

export function beginPhase(p) {
  phase = p;
  trainingAborted = false;
  participant = document.getElementById("name").value || "anon";
  testStartedAt = new Date();

  loadList().then(() => {
    shuffle(list);
    trialIndex = 0;
    responseLog.length = 0;

    if (phase === "training") {
      track = null;
      currentCutoffHz = null;
      showScreen("main");
      showTrainingItem();
    } else {
      // Build the adaptive track from the persisted Setup config. If none is
      // present (app never visited Setup), resolveTrackConfig's guards apply.
      const adaptive = (config && config.adaptive) ? config.adaptive : {};
      const isQuiet = adaptive.mode === "quiet";
      const isSnr = adaptive.mode === "snr";
      const isLinear = isQuiet || isSnr;   // both use a dB axis, not log(Hz)

      // Start value in the mode's own unit: Hz (LPF), dB level (quiet), dB SNR
      // (noise). A single absolute start per mode — no "relative to threshold"
      // path (there is no prior threshold to be relative to within a run).
      const startVal = isLinear
        ? (adaptive.startValue ?? (isSnr ? 2 : 65))
        : (adaptive.startValue ?? adaptive.startCutoffHz ?? 1000);

      // quietStartLevel doubles as the uncalibrated relative-gain anchor for
      // quiet mode (its level is played relative to this start when uncalibrated).
      quietStartLevel = isLinear ? startVal : null;
      const trackCfg = resolveTrackConfig(adaptive, startVal);
      track = createTrack(trackCfg);
      currentCutoffHz = track.currentValue();
      showScreen("test");
      nextTrial();
    }
  });
}

export function showTrainingItem() {
  if (trainingAborted || trialIndex >= list.length || phase !== "training") {
    showScreen("instructions");
    return;
  }

const item = list[trialIndex];
  if (!item || !isNonEmpty(item.correct) || !isNonEmpty(item.audioFile)) {
    warn("[!] Bad training item, skipping trial", { index: trialIndex + 1, item });
    trialIndex++;
    return showTrainingItem();
  }

  AudioEngine.stop();

  const revealMs = config.imageRevealOffsetMs || 600;

  // Play unfiltered (cutoffHz: null) for now; the adaptive track will supply a
  // cutoff in Step 5. Reveal the training image `revealMs` after the buffer
  // starts (each file has ~600 ms leading silence, so this lands as the word
  // arrives), matching the original timing.
  AudioEngine.playStimulus(item.correct, `sounds/${item.audioFile}`, {
    cutoffHz: null,
    routing: (config && config.routing) || "binaural",
    onStarted: () => {
      if (trainingAborted) return;
      setTimeout(() => {
        if (trainingAborted || phase !== "training") return;
        setImage(trainingImg, item.correct, config.arrows);
      }, revealMs);
    }
  }).then(() => {
    if (trainingAborted) return;
    trialIndex++;
    if (phase === "training") {
      setTimeout(() => {
        if (trainingAborted || phase !== "training") return;
        showTrainingItem();
      }, config.delayMs || 1500);
    }
  }).catch(err => {
    console.error("[!] Training audio failed to play:", err);
  });
}

export function nextTrial() {
	
	// Pause for a rest every N trials before starting the next one
if (phase === "test") {
  const n = Number(config.breakEvery) || 0; // 0 = disabled
  if (n > 0 && trialIndex > 0 && (trialIndex % n === 0) && lastBreakAt !== trialIndex) {
    lastBreakAt = trialIndex;

    // Show break screen and wait for the user
    showScreen("break");
    const btn = document.getElementById("breakOkBtn");
    if (btn) {
      btn.onclick = () => {
        showScreen("test");
        nextTrial();  // resume: try again, now same trialIndex starts
      };
    }
    return; // stop here until user presses OK
  }
}

	
  // Termination: adaptive test ends when the track has collected nTrials
  // responses. Training (or a non-adaptive run) ends at the end of the list.
  if (phase === "test" && track) {
    if (track.done()) {
      saveResults();
      return;
    }
  } else if (trialIndex >= list.length) {
    if (phase === "test") {
      saveResults();
    } else {
      showScreen("thankyou");
      const abortBtn = document.getElementById("abortBtn");
      if (abortBtn) abortBtn.style.display = "none";
    }
    return;
  }

  // Word selection: for adaptive runs the number of trials may exceed the list
  // length, so cycle through the (shuffled) list by wrapping the index. The
  // adapting quantity is the CUTOFF; which word is presented matters less.
  const wordIdx = (phase === "test" && track) ? (trialIndex % list.length) : trialIndex;
  const item = list[wordIdx];
  if (!item) {
    warn("[!] Missing trial item at index", wordIdx);
    trialIndex++;
    return nextTrial();
  }
  // Refresh the pending adaptive value from the track for this trial.
  if (phase === "test" && track) {
    currentCutoffHz = track.currentValue();
  }
  const shuffled = [...item.images];
  shuffle(shuffled);

  optImgs.forEach(img => {
    img.style.display = "none";
    img.removeAttribute("data-name");
    img.src = "";
  });

  if (!isNonEmpty(item.audioFile)) {
    warn("[!] Invalid audioFile in trial", trialIndex + 1, item);
  }

  // Preload NEXT trial's images
  // (see below)
  if (trialIndex + 1 < list.length) {
    const nextItem = list[trialIndex + 1];
    const nextShuffled = [...nextItem.images];
    shuffle(nextShuffled);

    nextImagesToPreload = nextShuffled;
	nextImagesToPreload.forEach(name => {
      if (!isNonEmpty(name)) {
        warn("[!] Skipping preload for invalid name (next trial)", { nextIndex: trialIndex + 2, name });
        return;
      }
      const preload = new Image();
      preload.src = `images/${name}.jpg`;
      if (config.arrows && arrowSet.has(name)) {
        const preloadArrow = new Image();
        preloadArrow.src = `images/${name}_arrow.jpg`;
      }
    });
	
  } else {
    nextImagesToPreload = [];
  }

  const offset = config.imageRevealOffsetMs || 0;

  // Reveal the four option images `offset` ms after the buffer starts. Each
  // audio file has ~600 ms of leading silence, so this lands as the word
  // arrives (identical timing to the previous <audio> polling implementation).
  const revealOptions = () => {
    shuffled.forEach((name, idx) => {
      if (!isNonEmpty(name)) {
        warn("Empty/invalid image name in trial",
          trialIndex + 1, { item, position: idx, shuffled });
      }
      setImage(optImgs[idx], name, config.arrows);
      if (isNonEmpty(name)) {
        optImgs[idx].setAttribute("data-name", name);
      } else {
        optImgs[idx].removeAttribute("data-name");
      }
      optImgs[idx].style.display = "block";
      optImgs[idx].style.opacity = "1.0";
    });
    startTime = performance.now();
  };

  // Mode-aware presentation:
  //  LPF  : filter at the adaptive CUTOFF; gain from the fixed run level.
  //  Quiet: no filter; the adaptive VALUE is the presentation LEVEL (dB),
  //         applied as gain (calibrated -> absolute dB(A); uncalibrated ->
  //         relative dB re the start level).
  //  SNR  : no filter; the adaptive VALUE is the dB SNR. The masking noise
  //         (calibration file) plays at the FIXED presentation level; the
  //         signal is offset from the noise by the SNR.
  const adaptive = (config && config.adaptive) ? config.adaptive : {};
  const isQuiet = (phase === "test" && track) ? adaptive.mode === "quiet" : false;
  const isSnr   = (phase === "test" && track) ? adaptive.mode === "snr"   : false;
  const calibrated = (typeof Calibration !== "undefined" && Calibration.isCalibrated && Calibration.isCalibrated());
  const routing = (config && config.routing) || "binaural";

  // ---- SNR mode: dispatch to the mixed word+noise path and return early ----
  if (isSnr) {
    const snrDb = currentCutoffHz;   // mode-neutral value; dB SNR here
    // Noise presentation level comes from the dedicated SNR noise-level setting,
    // independent of the SNR (which only moves the word). Interpretation depends
    // on calibration:
    //   calibrated   -> the number is dB(A); convert via the calibration curve.
    //   uncalibrated -> the number is a dB FS attenuation (<= 0) applied
    //                   directly; device volume then sets absolute loudness.
    const noiseLevelSetting = Number(
      (config && config.adaptive && isFinite(config.adaptive.snrNoiseLevel))
        ? config.adaptive.snrNoiseLevel
        : (calibrated ? 65 : 0)
    );
    const noiseGainDb = calibrated
      ? Calibration.gainDbForLevel(noiseLevelSetting)
      : Math.min(0, noiseLevelSetting);   // dB FS attenuation, never boost
    // SNR masking uses the dedicated noise file (noise.mp3), which is the same
    // audio as the calibration file but doesn't need to loop, so its start/end
    // dropout is irrelevant. Overridable via config.snrNoiseFile.
    const noiseUrl = (config && config.snrNoiseFile)
      ? `sounds/${config.snrNoiseFile}`
      : "sounds/noise.mp3";

    // Adjustable timing (ms) so the operator can line the noise up with the
    // actual speech onset inside each stimulus file. Defaults: 600 ms lead/
    // trail, 100 ms ramps, 600 ms audible onset (leading silence in the files).
    const msToSec = (v, dflt) => {
      const n = Number(v);
      return isFinite(n) && n >= 0 ? n / 1000 : dflt;
    };
    const noiseLeadSec  = msToSec(config && config.snrNoiseLeadMs, 0.6);
    const noiseTrailSec = msToSec(config && config.snrNoiseTrailMs, 0.6);
    const rampSec       = msToSec(config && config.snrNoiseRampMs, 0.1);
    const wordLeadSec   = msToSec(config && config.snrWordLeadMs,
                                  msToSec(config && config.imageRevealOffsetMs, 0.6));
    // Optional override for the fixed clip-safety headroom; omit to use the
    // engine default (-6 dB). Applied equally to word and noise (SNR unchanged).
    const headroomDb = (config && isFinite(Number(config.snrHeadroomDb)))
      ? Number(config.snrHeadroomDb) : undefined;

    const snrOpts = {
      snrDb,
      noiseGainDb,
      noiseUrl,
      routing,
      noiseLeadSec,
      noiseTrailSec,
      rampSec,
      wordLeadSec,
      onStarted: () => { setTimeout(revealOptions, offset); }
    };
    if (headroomDb !== undefined) snrOpts.headroomDb = headroomDb;

    AudioEngine.playStimulusWithNoise(item.correct, `sounds/${item.audioFile}`, snrOpts).catch(err => {
      console.error("SNR audio play failed:", err);
      if (!nextTrial._erroredOnce) {
        alert("Audio failed to play. Check the noise file (sounds/" +
          ((config && config.snrNoiseFile) || "noise.mp3") +
          ") exists and browser autoplay is allowed.");
        nextTrial._erroredOnce = true;
      }
    });
    return;
  }

  let cutoffHz = null;
  let extraGainDb = 0;

  if (phase === "test" && track && isQuiet) {
    // Quiet mode: value is a dB level.
    const level = currentCutoffHz; // (mode-neutral value; dB here)
    if (calibrated) {
      extraGainDb = Calibration.gainDbForLevel(level);
    } else {
      // Uncalibrated: play relative to the start level (start = unity).
      extraGainDb = level - (quietStartLevel ?? level);
    }
  } else {
    // LPF mode (or non-adaptive): filter at the cutoff; presentation level from
    // the dedicated LPF level setting. Calibrated -> dB(A) via the curve;
    // uncalibrated -> dB FS attenuation (<= 0), device volume sets absolute level.
    cutoffHz = (phase === "test" && track) ? currentCutoffHz : null;
    const lpfLevel = Number(
      (config && config.adaptive && isFinite(config.adaptive.lpfLevel))
        ? config.adaptive.lpfLevel
        : (calibrated ? 65 : 0)
    );
    if (calibrated) {
      extraGainDb = Calibration.gainDbForLevel(lpfLevel);
    } else {
      extraGainDb = Math.min(0, lpfLevel);   // dB FS attenuation, never boost
    }
  }

  AudioEngine.playStimulus(item.correct, `sounds/${item.audioFile}`, {
    cutoffHz,
    extraGainDb,
    routing,
    onStarted: () => {
      setTimeout(revealOptions, offset);
    }
  }).catch(err => {
    console.error("Audio play failed:", err);
    if (!nextTrial._erroredOnce) {
      alert("Audio failed to play. Check browser autoplay settings.");
      nextTrial._erroredOnce = true;
    }
  });
}

export function recordResponse(img) {
  const timeTaken = performance.now() - startTime;
  const chosen = img.getAttribute("data-name");
  // Use the same cycling word index the trial was built with.
  const wordIdx = (phase === "test" && track) ? (trialIndex % list.length) : trialIndex;
  const correctName = list[wordIdx].correct;
  const sound = list[wordIdx].audioFile;
  const isCorrect = chosen === correctName;

  const entry = {
    index: trialIndex + 1,
    sound,
    correct: correctName,
    chosen,
    timeMs: Math.round(timeTaken)
  };

  // Adaptive: record the presented value (cutoff Hz for LPF, level dB for
  // quiet), advance the track, and capture the running threshold estimate.
  if (phase === "test" && track) {
    const adaptive = (config && config.adaptive) ? config.adaptive : {};
    const unit = track.unit
      || (adaptive.mode === "snr" ? "dB SNR" : adaptive.mode === "quiet" ? "dB" : "Hz");
    const val = (unit === "Hz") ? Math.round(currentCutoffHz) : +currentCutoffHz.toFixed(1);
    entry.value = val;
    entry.unit = unit;
    entry.mode = adaptive.mode || "lpf";
    // Back-compat alias so existing LPF-oriented consumers keep working.
    entry.cutoffHz = val;
    entry.isCorrect = isCorrect;
    entry.procedure = adaptive.procedure || "wudr";
    track.update(isCorrect);
    const est = track.estimate();
    const estV = est.value;
    entry.estimate = isFinite(estV) ? ((unit === "Hz") ? Math.round(estV) : +estV.toFixed(1)) : null;
    entry.estimateHz = entry.estimate; // alias
  }

  responseLog.push(entry);

  optImgs.forEach(image => {
    image.style.opacity = image === img ? "1.0" : "0.4";
  });

  setTimeout(() => {
    optImgs.forEach(image => {
      image.style.display = "none";
    });

    const delay = config.delayMs || 1500;
    const remaining = Math.max(0, delay - 500);

    setTimeout(() => {
      trialIndex++;
      nextTrial();
    }, remaining);
  }, 500);
}

// Expose the active track's final estimate for results (null if no track).
export function finalEstimate() {
  return track ? track.estimate() : null;
}
export function activeTrack() { return track; }

export function abortTraining() {
  trainingAborted = true;
}
