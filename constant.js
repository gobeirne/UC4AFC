// File: constant.js
// -----------------------------------------------------------------------------
// UC4AFC — Method of Constant Stimuli (normalisation data collection).
//
// A self-contained experiment mode, deliberately kept OUTSIDE the adaptive
// machinery (flow.js / adaptive.js / results.js). It presents every one of the
// 66 stimulus words at each of a fixed list of levels (SNRs in SNR mode, or LPF
// corner frequencies in LPF mode), repeated `repeats` times, in a randomised
// order, and writes its own results file.
//
// Entry: a "Constant stimuli…" button on the Setup screen opens a dedicated
// screen (#conststim) with its own SNR/LPF toggle, a comma-separated level list
// (persisted separately per mode), a repeats field, and its own break count.
//
// Presentation reuses the existing AudioEngine paths exactly as the adaptive
// flow does:
//   LPF : AudioEngine.playStimulus({ cutoffHz: level, extraGainDb })
//   SNR : AudioEngine.playStimulusWithNoise({ snrDb: level, noiseGainDb, ... })
//
// Output (one .txt, plus a companion .json):
//   1. Header (participant, times, mode, levels, repeats, calibration)
//   2. Presentations table   (Word × level, denominator = count presented)
//   3. Correct table         (Word × level, numerator   = count correct)
//   4. Proportion table      (Word × level, correct / presented)
//   5. Chronological log      (timestamp, word, level, chosen, correct?)
// Rows are the 66 words (alphabetical); columns are the levels (ascending).
// -----------------------------------------------------------------------------

const CS_KEYS = {
  snr: "uc4afc_cs_snr",     // saved SNR level list (JSON array)
  lpf: "uc4afc_cs_lpf",     // saved LPF level list (JSON array)
  opts: "uc4afc_cs_opts"    // { repeats, breakEvery, mode }
};

// Sensible starting defaults (only used until the operator saves their own).
const CS_DEFAULTS = {
  snr: [-15, -12, -9, -6, -3],
  lpf: [500, 800, 1200, 2000, 3150],
  repeats: 2,
  breakEvery: 40,
  mode: "snr"
};

// --- Module state -------------------------------------------------------------
const CS = {
  active: false,        // true while a run is in progress (guards handlers)
  mode: "snr",          // "snr" | "lpf"
  levels: [],           // numeric levels for the run (ascending in tables)
  repeats: 2,
  breakEvery: 40,
  queue: [],            // [{ wordIdx, level, rep }] in presentation order
  pos: 0,               // index into queue of the CURRENT (pending) trial
  startedAt: null,
  logRows: [],          // chronological: { ts, word, level, chosen, correct, isCorrect, timeMs }
  // aggregation keyed by `${word}\u0000${level}`
  presented: new Map(),
  correct: new Map(),
  startTime: 0,         // performance.now() at option reveal (for RT)
  _lastBreakAt: -1,
  _savedOptHandlers: null
};

const csIsNonEmpty = v => typeof v === "string" && v.trim().length > 0;

function csParseLevels(text) {
  // Accept commas, whitespace, or newlines as separators. Keep finite numbers.
  return String(text || "")
    .split(/[\s,]+/)
    .map(s => s.trim())
    .filter(s => s.length)
    .map(Number)
    .filter(n => Number.isFinite(n));
}

function csLoadList(mode) {
  try {
    const raw = localStorage.getItem(CS_KEYS[mode]);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length) return arr.map(Number).filter(Number.isFinite);
    }
  } catch (_) {}
  return CS_DEFAULTS[mode].slice();
}

function csLoadOpts() {
  try {
    const raw = localStorage.getItem(CS_KEYS.opts);
    if (raw) {
      const o = JSON.parse(raw);
      return {
        repeats: Number.isFinite(Number(o.repeats)) ? Number(o.repeats) : CS_DEFAULTS.repeats,
        breakEvery: Number.isFinite(Number(o.breakEvery)) ? Number(o.breakEvery) : CS_DEFAULTS.breakEvery,
        mode: (o.mode === "lpf" || o.mode === "snr") ? o.mode : CS_DEFAULTS.mode
      };
    }
  } catch (_) {}
  return { repeats: CS_DEFAULTS.repeats, breakEvery: CS_DEFAULTS.breakEvery, mode: CS_DEFAULTS.mode };
}

function csSaveDefaults(mode, levels, repeats, breakEvery) {
  try {
    localStorage.setItem(CS_KEYS[mode], JSON.stringify(levels));
    localStorage.setItem(CS_KEYS.opts, JSON.stringify({ repeats, breakEvery, mode }));
    return true;
  } catch (_) { return false; }
}

// The 66 words (alphabetical, unique by `correct`) as a stable row order for
// the tables. Derived live from the loaded `list` so it always matches stimuli.
function csWordRows() {
  const seen = new Set();
  const words = [];
  for (const item of (Array.isArray(list) ? list : [])) {
    if (item && csIsNonEmpty(item.correct) && !seen.has(item.correct)) {
      seen.add(item.correct);
      words.push(item.correct);
    }
  }
  words.sort((a, b) => a.localeCompare(b));
  return words;
}

// ---------------------------------------------------------------------------
// Screen wiring
// ---------------------------------------------------------------------------
function csPopulateForm() {
  const opts = csLoadOpts();
  CS.mode = opts.mode;
  const modeSeg = document.getElementById("csModeSegmented");
  if (modeSeg) {
    modeSeg.querySelectorAll(".seg-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.csmode === CS.mode);
    });
  }
  csFillLevelsField();
  const rep = document.getElementById("csRepeats");
  if (rep) rep.value = opts.repeats;
  const brk = document.getElementById("csBreakEvery");
  if (brk) brk.value = opts.breakEvery;
  csUpdateSummary();
  csStatus("");
}

function csFillLevelsField() {
  const field = document.getElementById("csLevels");
  if (field) field.value = csLoadList(CS.mode).join(", ");
  const lbl = document.getElementById("csLevelsLabel");
  if (lbl) {
    lbl.textContent = CS.mode === "snr"
      ? "SNRs (dB, comma-separated)"
      : "LPF corner frequencies (Hz, comma-separated)";
  }
}

function csUpdateSummary() {
  const el = document.getElementById("csSummary");
  if (!el) return;
  const levels = csParseLevels(document.getElementById("csLevels")?.value);
  const reps = Math.max(1, Math.round(Number(document.getElementById("csRepeats")?.value) || 1));
  const words = csWordRows().length || 66;
  const total = words * levels.length * reps;
  el.textContent = levels.length
    ? `${words} words × ${levels.length} level${levels.length === 1 ? "" : "s"} × ${reps} repeat${reps === 1 ? "" : "s"} = ${total} presentations.`
    : "Enter at least one level.";
}

function csStatus(msg, isErr) {
  const el = document.getElementById("csStatus");
  if (el) { el.textContent = msg || ""; el.style.color = isErr ? "#b31b1b" : ""; }
}

function setupConstantScreen() {
  // Button on the Setup screen opens the CS screen.
  const openBtn = document.getElementById("openConstBtn");
  if (openBtn) openBtn.onclick = () => { showScreen("conststim"); csPopulateForm(); };

  const screen = document.getElementById("conststim");
  if (!screen) return; // screen not present in DOM

  // Mode toggle: swap the persisted level list shown in the field.
  const modeSeg = document.getElementById("csModeSegmented");
  if (modeSeg) {
    modeSeg.querySelectorAll(".seg-btn").forEach(btn => {
      btn.onclick = () => {
        const m = btn.dataset.csmode;
        if (m === CS.mode) return;
        CS.mode = m;
        modeSeg.querySelectorAll(".seg-btn").forEach(b =>
          b.classList.toggle("active", b === btn));
        csFillLevelsField();
        csUpdateSummary();
        csStatus("");
      };
    });
  }

  // Live summary as the operator edits levels/repeats.
  ["csLevels", "csRepeats"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", csUpdateSummary);
  });

  // Save as default (per-mode list + shared opts).
  const saveBtn = document.getElementById("csSaveBtn");
  if (saveBtn) saveBtn.onclick = () => {
    const levels = csParseLevels(document.getElementById("csLevels").value);
    if (!levels.length) { csStatus("Enter at least one valid level before saving.", true); return; }
    const reps = Math.max(1, Math.round(Number(document.getElementById("csRepeats").value) || 1));
    const brk = Math.max(0, Math.round(Number(document.getElementById("csBreakEvery").value) || 0));
    const ok = csSaveDefaults(CS.mode, levels, reps, brk);
    csStatus(ok ? `Saved as default for ${CS.mode.toUpperCase()} mode.` : "Could not save (storage unavailable).", !ok);
  };

  // Back to Setup.
  const backBtn = document.getElementById("csBackBtn");
  if (backBtn) backBtn.onclick = () => showScreen("setup");

  // Start the run.
  const startBtn = document.getElementById("csStartBtn");
  if (startBtn) startBtn.onclick = () => csStartRun();
}

// ---------------------------------------------------------------------------
// Run lifecycle
// ---------------------------------------------------------------------------
function csStartRun() {
  const levels = csParseLevels(document.getElementById("csLevels").value);
  if (!levels.length) { csStatus("Enter at least one valid level.", true); return; }
  const reps = Math.max(1, Math.round(Number(document.getElementById("csRepeats").value) || 1));
  const brk = Math.max(0, Math.round(Number(document.getElementById("csBreakEvery").value) || 0));

  // Ascending order is what the tables use; keep a sorted copy for columns.
  CS.levels = levels.slice().sort((a, b) => a - b);
  CS.repeats = reps;
  CS.breakEvery = brk;
  CS.mode = CS.mode || "snr";

  const words = csWordRows();
  if (!words.length) { csStatus("No stimulus words loaded.", true); return; }

  // Build the queue: one full (word × level) block per repeat, shuffled WITHIN
  // each rep-block, then the blocks concatenated (rep 1 fully, then rep 2, …).
  CS.queue = [];
  for (let rep = 0; rep < reps; rep++) {
    const block = [];
    for (let wi = 0; wi < words.length; wi++) {
      for (let li = 0; li < CS.levels.length; li++) {
        block.push({ word: words[wi], level: CS.levels[li], rep: rep + 1 });
      }
    }
    shuffle(block);            // reuse the app's Durstenfeld shuffle
    CS.queue.push(...block);
  }

  CS.pos = 0;
  CS._lastBreakAt = -1;
  CS.logRows = [];
  CS.presented = new Map();
  CS.correct = new Map();
  CS.startedAt = new Date();
  CS.active = true;

  // Resume the audio context within this user gesture (iOS/Safari), then run.
  const go = () => { installOptHandlers(); showScreen("test"); csNextTrial(); };
  if (typeof AudioEngine !== "undefined" && AudioEngine.resume) {
    AudioEngine.resume().then(go).catch(go);
  } else {
    go();
  }

  // Show the abort [X] on touch devices, mirroring the adaptive flow.
  const abortBtn = document.getElementById("abortBtn");
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (abortBtn && config && config.showAbortXOnTouchDevices && isTouch) {
    abortBtn.style.display = "block";
  }
}

// Word lookup: find the list item whose `correct` matches (for images/audio).
function csItemForWord(word) {
  for (const item of list) if (item && item.correct === word) return item;
  return null;
}

function csKey(word, level) { return `${word}\u0000${level}`; }

function csNextTrial() {
  if (!CS.active) return;

  // Break handling (this mode's own count).
  if (CS.breakEvery > 0 && CS.pos > 0 &&
      (CS.pos % CS.breakEvery === 0) && CS._lastBreakAt !== CS.pos) {
    CS._lastBreakAt = CS.pos;
    showScreen("break");
    const btn = document.getElementById("breakOkBtn");
    if (btn) btn.onclick = () => { showScreen("test"); csNextTrial(); };
    return;
  }

  // Termination.
  if (CS.pos >= CS.queue.length) { csFinish(); return; }

  const trial = CS.queue[CS.pos];
  const item = csItemForWord(trial.word);
  if (!item) {
    console.warn("[CS] No stimulus item for word", trial.word, "- skipping");
    CS.pos++;
    return csNextTrial();
  }

  // Prepare the four options (shuffled), hidden until the word arrives.
  const shuffled = [...item.images];
  shuffle(shuffled);
  optImgs.forEach(img => {
    img.style.display = "none";
    img.removeAttribute("data-name");
    img.style.opacity = "1.0";
    img.src = "";
  });

  const offset = (config && config.imageRevealOffsetMs) || 0;
  const revealOptions = () => {
    shuffled.forEach((name, idx) => {
      setImage(optImgs[idx], name, config.arrows);
      if (csIsNonEmpty(name)) optImgs[idx].setAttribute("data-name", name);
      else optImgs[idx].removeAttribute("data-name");
      optImgs[idx].style.display = "block";
      optImgs[idx].style.opacity = "1.0";
    });
    CS.startTime = performance.now();
  };

  const calibrated = (typeof Calibration !== "undefined" &&
    Calibration.isCalibrated && Calibration.isCalibrated());
  const routing = (config && config.routing) || "binaural";

  if (CS.mode === "snr") {
    csPlaySnr(item, trial.level, calibrated, routing, offset, revealOptions);
  } else {
    csPlayLpf(item, trial.level, calibrated, routing, offset, revealOptions);
  }
}

// LPF presentation — mirrors the adaptive LPF branch in flow/bundle.
function csPlayLpf(item, level, calibrated, routing, offset, revealOptions) {
  const lpfLevel = Number(
    (config && config.adaptive && isFinite(config.adaptive.lpfLevel))
      ? config.adaptive.lpfLevel
      : (calibrated ? 65 : 0)
  );
  const extraGainDb = calibrated
    ? Calibration.gainDbForLevel(lpfLevel)
    : Math.min(0, lpfLevel);   // dB FS attenuation, never boost

  AudioEngine.playStimulus(item.correct, `sounds/${item.audioFile}`, {
    cutoffHz: level,
    extraGainDb,
    routing,
    onStarted: () => setTimeout(revealOptions, offset)
  }).catch(err => csAudioError(err));
}

// SNR presentation — mirrors the adaptive SNR branch in the bundle.
function csPlaySnr(item, snrDb, calibrated, routing, offset, revealOptions) {
  const noiseLevelSetting = Number(
    (config && config.adaptive && isFinite(config.adaptive.snrNoiseLevel))
      ? config.adaptive.snrNoiseLevel
      : (calibrated ? 65 : 0)
  );
  const noiseGainDb = calibrated
    ? Calibration.gainDbForLevel(noiseLevelSetting)
    : Math.min(0, noiseLevelSetting);
  const noiseUrl = (config && config.snrNoiseFile)
    ? `sounds/${config.snrNoiseFile}` : "sounds/noise.mp3";

  const msToSec = (v, dflt) => {
    const n = Number(v);
    return isFinite(n) && n >= 0 ? n / 1000 : dflt;
  };
  const snrOpts = {
    snrDb,
    noiseGainDb,
    noiseUrl,
    routing,
    noiseLeadSec:  msToSec(config && config.snrNoiseLeadMs, 0.6),
    noiseTrailSec: msToSec(config && config.snrNoiseTrailMs, 0.6),
    rampSec:       msToSec(config && config.snrNoiseRampMs, 0.1),
    wordLeadSec:   msToSec(config && config.snrWordLeadMs,
                           msToSec(config && config.imageRevealOffsetMs, 0.6)),
    onStarted: () => setTimeout(revealOptions, offset)
  };
  if (config && isFinite(Number(config.snrHeadroomDb))) {
    snrOpts.headroomDb = Number(config.snrHeadroomDb);
  }

  AudioEngine.playStimulusWithNoise(item.correct, `sounds/${item.audioFile}`, snrOpts)
    .catch(err => csAudioError(err));
}

function csAudioError(err) {
  console.error("[CS] Audio play failed:", err);
  if (!csAudioError._once) {
    alert("Audio failed to play. Check the stimulus/noise files and browser autoplay settings.");
    csAudioError._once = true;
  }
}

// Response handling for a CS trial (installed on the option images during a run).
function csRecordResponse(img) {
  if (!CS.active) return;
  const trial = CS.queue[CS.pos];
  if (!trial) return;

  const timeMs = Math.round(performance.now() - CS.startTime);
  const chosen = img.getAttribute("data-name");
  const isCorrect = chosen === trial.word;

  // Aggregate.
  const key = csKey(trial.word, trial.level);
  CS.presented.set(key, (CS.presented.get(key) || 0) + 1);
  if (isCorrect) CS.correct.set(key, (CS.correct.get(key) || 0) + 1);

  // Chronological log.
  CS.logRows.push({
    ts: new Date().toISOString(),
    word: trial.word,
    level: trial.level,
    chosen: chosen || "",
    isCorrect,
    rep: trial.rep,
    timeMs
  });

  // Visual feedback then advance (same cadence as the adaptive flow).
  optImgs.forEach(image => { image.style.opacity = image === img ? "1.0" : "0.4"; });
  setTimeout(() => {
    optImgs.forEach(image => { image.style.display = "none"; });
    const delay = (config && config.delayMs) || 1500;
    const remaining = Math.max(0, delay - 500);
    setTimeout(() => { CS.pos++; csNextTrial(); }, remaining);
  }, 500);
}

// Swap the option-image click handlers to the CS handler for the duration of a
// run, and keep a way to restore the adaptive handlers afterwards. Cloning the
// nodes drops the listeners attached in main.js without needing their refs.
function installOptHandlers() {
  if (CS._savedOptHandlers) return; // already installed
  CS._savedOptHandlers = true;
  optImgs.forEach((img, i) => {
    const clone = img.cloneNode(true);
    img.parentNode.replaceChild(clone, img);
    optImgs[i] = clone;
    clone.addEventListener("click", () => csRecordResponse(clone));
  });
}

// Restore the normal (adaptive/test) click handlers after a CS run ends.
function restoreOptHandlers() {
  if (!CS._savedOptHandlers) return;
  CS._savedOptHandlers = null;
  optImgs.forEach((img, i) => {
    const clone = img.cloneNode(true);
    img.parentNode.replaceChild(clone, img);
    optImgs[i] = clone;
    clone.addEventListener("click", () => recordResponse(clone));
  });
}

function csEndCommon() {
  CS.active = false;
  restoreOptHandlers();
  const abortBtn = document.getElementById("abortBtn");
  if (abortBtn) abortBtn.style.display = "none";
}

function csFinish() {
  csEndCommon();
  csSaveResults();
}

// Abort mid-run: save what we have, tagged as aborted.
function csAbort() {
  if (!CS.active) return false;
  if (typeof AudioEngine !== "undefined") AudioEngine.stop();
  csEndCommon();
  csSaveResults(`run aborted at ${new Date().toLocaleString()}`);
  return true;
}

// ---------------------------------------------------------------------------
// Results — three tables + chronological log, in one .txt (+ companion .json)
// ---------------------------------------------------------------------------
function csSaveResults(note) {
  const now = new Date();
  const timeStr = now.toISOString().replace(/[:.]/g, "-");
  const who = (typeof participant === "string" && participant) ? participant : "anon";
  const modeUp = CS.mode.toUpperCase();
  const unit = CS.mode === "snr" ? "dB SNR" : "Hz";
  const valCol = CS.mode === "snr" ? "SNR" : "Cutoff_Hz";

  const words = csWordRows();
  const levels = CS.levels.slice(); // already ascending

  const fmtTime = (d) => d.toLocaleString("en-NZ", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true
  });

  const calibrated = (typeof Calibration !== "undefined" &&
    Calibration.isCalibrated && Calibration.isCalibrated());

  // --- Header
  const lines = [];
  lines.push(`# UC4AFC — Method of Constant Stimuli`);
  lines.push(`# Participant\t${who}`);
  lines.push(`# Started at\t${CS.startedAt ? fmtTime(CS.startedAt) : "(unknown)"}`);
  lines.push(`# Saved at\t${fmtTime(now)}`);
  lines.push(`# Mode\t${modeUp}`);
  lines.push(`# Levels (${unit})\t${levels.join(", ")}`);
  lines.push(`# Repeats\t${CS.repeats}`);
  lines.push(`# Words\t${words.length}`);
  lines.push(`# Total presentations\t${CS.logRows.length}`);
  lines.push(`# Break every\t${CS.breakEvery || "off"}`);
  lines.push(`# Routing\t${(config && config.routing) || "binaural"}`);
  if (CS.mode === "snr") {
    const nl = (config && config.adaptive && isFinite(config.adaptive.snrNoiseLevel))
      ? config.adaptive.snrNoiseLevel : (calibrated ? 65 : 0);
    lines.push(`# SNR noise level\t${nl}${calibrated ? " dB(A)" : " dB FS"}`);
  } else {
    const ll = (config && config.adaptive && isFinite(config.adaptive.lpfLevel))
      ? config.adaptive.lpfLevel : (calibrated ? 65 : 0);
    lines.push(`# LPF presentation level\t${ll}${calibrated ? " dB(A)" : " dB FS"}`);
  }
  if (typeof Calibration !== "undefined" && Calibration.calibrationHeader) {
    lines.push(`# Calibration\t${Calibration.calibrationHeader()}`);
  }
  if (note) lines.push(`# Note\t${note}`);

  const header = ["Word", ...levels].join("\t");

  const tableBlock = (title, getter, fixed) => {
    const out = ["", `# ${title}`, header];
    for (const w of words) {
      const cells = levels.map(lv => {
        const v = getter(w, lv);
        return (v == null) ? "" : (fixed != null ? Number(v).toFixed(fixed) : String(v));
      });
      out.push([w, ...cells].join("\t"));
    }
    return out;
  };

  // Table 1: presentations (denominator)
  lines.push(...tableBlock(
    "TABLE 1 — Presentations (count presented)",
    (w, lv) => CS.presented.get(csKey(w, lv)) || 0
  ));

  // Table 2: correct (numerator)
  lines.push(...tableBlock(
    "TABLE 2 — Correct (count correct)",
    (w, lv) => CS.correct.get(csKey(w, lv)) || 0
  ));

  // Table 3: proportion correct = correct / presented (blank if never presented)
  lines.push(...tableBlock(
    "TABLE 3 — Proportion correct (correct / presented)",
    (w, lv) => {
      const n = CS.presented.get(csKey(w, lv)) || 0;
      if (n === 0) return null;
      const c = CS.correct.get(csKey(w, lv)) || 0;
      return c / n;
    },
    3
  ));

  // Chronological log
  lines.push("");
  lines.push(`# LOG — chronological presentation record`);
  lines.push(`Timestamp\tWord\t${valCol}\tChosen\tCorrect?\tRepeat\tTime_ms`);
  for (const r of CS.logRows) {
    lines.push(`${r.ts}\t${r.word}\t${r.level}\t${r.chosen}\t${r.isCorrect ? 1 : 0}\t${r.rep}\t${r.timeMs}`);
  }

  const txt = lines.join("\n");

  // --- Save .txt
  const baseName = `UC4AFC_CS_${modeUp}_${who}_${timeStr}`;
  const a1 = document.createElement("a");
  a1.href = URL.createObjectURL(new Blob([txt], { type: "text/tab-separated-values" }));
  a1.download = `${baseName}.txt`;
  a1.click();

  // --- Save companion .json (raw log + the three tables as arrays)
  const shouldSaveJson =
    (config && typeof config.saveJson !== "undefined") ? config.saveJson : true;
  if (shouldSaveJson) {
    const tableToObj = (map, asProportion) => {
      const rows = {};
      for (const w of words) {
        rows[w] = {};
        for (const lv of levels) {
          if (asProportion) {
            const n = CS.presented.get(csKey(w, lv)) || 0;
            rows[w][lv] = n === 0 ? null : (CS.correct.get(csKey(w, lv)) || 0) / n;
          } else {
            rows[w][lv] = map.get(csKey(w, lv)) || 0;
          }
        }
      }
      return rows;
    };
    const jsonData = {
      kind: "constant-stimuli",
      participant: who,
      mode: CS.mode,
      unit,
      levels,
      repeats: CS.repeats,
      breakEvery: CS.breakEvery,
      startedAt: CS.startedAt ? CS.startedAt.toISOString() : null,
      savedAt: now.toISOString(),
      routing: (config && config.routing) || "binaural",
      tables: {
        presentations: tableToObj(CS.presented, false),
        correct: tableToObj(CS.correct, false),
        proportion: tableToObj(null, true)
      },
      log: CS.logRows.slice(),
      note: note || undefined
    };
    const a2 = document.createElement("a");
    a2.href = URL.createObjectURL(new Blob([JSON.stringify(jsonData, null, 2)], { type: "application/json" }));
    a2.download = `${baseName}.json`;
    a2.click();
  }

  // --- End screen (reuse the thankyou screen)
  showScreen("thankyou");
  const info = document.getElementById("fileinfo");
  if (info) info.textContent = `Saved: ${baseName}.${shouldSaveJson ? "{txt,json}" : "txt"}`;
  const saveAgainBtn = document.getElementById("saveAgainBtn");
  if (saveAgainBtn) saveAgainBtn.onclick = () => csSaveResults("manual re-save at " + new Date().toLocaleString());

  const emailBtn = document.getElementById("emailBtn");
  if (emailBtn) {
    const subject = `${baseName}.txt`;
    const MAX = 1800;
    let body = txt;
    if (body.length > MAX) {
      body = body.slice(0, MAX - 120) +
        `\n\n[...truncated...]\n(Full file saved locally as ${subject}${shouldSaveJson ? " and JSON." : "."})`;
    }
    const to = (typeof config?.emailTo === "string" && config.emailTo.trim()) ? config.emailTo : "";
    const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    emailBtn.onclick = () => { location.href = mailto; };
  }
}

// True while a constant-stimuli run is active — lets the global abort handler
// route Escape / [X] to csAbort() instead of the adaptive abort.
function csRunActive() { return CS.active; }

if (typeof window !== "undefined") {
  window.ConstantStimuli = {
    setupConstantScreen, csStartRun, csAbort, csRunActive, csPopulateForm
  };
}

export { setupConstantScreen, csStartRun, csAbort, csRunActive, csPopulateForm };
