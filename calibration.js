// File: calibration.js
// -----------------------------------------------------------------------------
// UC4AFC calibration - mirrors the UC_CVCV model.
//
// The calibration noise file is spectrum- and level-matched to the stimuli at
// source. The operator turns device volume fully up, plays the looped
// calibration file at UNITY, measures the acoustic output in dB(A) on a
// sound-level meter, and enters that value. That measured value becomes:
//   * the reference level (playing a stimulus at this level = unity gain), and
//   * the MAXIMUM of the presentation-level slider.
//
// Presentation level -> digital gain (UC_CVCV gainForLevel):
//   calibrated:   attenuation = measuredDbA - levelDbA;  gain = 10^(-att/20)
//                 (so level == measuredDbA => 0 dB attenuation => unity)
//   uncalibrated: unity gain (files are already level-normalised relative to
//                 each other; device volume sets absolute output)
//
// Filtering is handled separately in the audio engine: after the LPF removes
// energy, each word is matched back to its own original momentary LUFS, which
// restores it to the shared set-level = the calibration level, preserving
// calibration independent of the presentation-level gain above.
// -----------------------------------------------------------------------------

const CAL_KEY = "uc4afc_calibration";

// The recordings carry ~96 dB of dynamic range (16-bit). Attenuating past this
// only digs into quantisation noise, so 96 dB is where the useful range ends.
// This is a property of the recordings, not a clinical limit; adjust if the
// source bit depth changes. (Ported from UC_CVCV.)
const MAX_ATTENUATION_DB = 96;
// dB(A) below this aren't sound pressure levels — a physical sanity floor that
// stops the range going negative when the reference is under 96 dB(A).
const ABSOLUTE_FLOOR_DBA = 0;
// Consider a restored calibration stale past this many days (Finding 6).
const CAL_STALE_DAYS = 30;

// Snap to the 5 dB grid used for presentation levels.
function snap5(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n / 5) * 5 : 0;
}

// Calibration state (mirrors UC_CVCV state.calibration).
const cal = {
  method: null,          // "audiometer" | "soundfield" (see CAL_METHODS)
  measuredDbA: null,
  timestamp: null,
  isCalibrated: false,
  sliderMinDb: -100,
  sliderMaxDb: 0,
  currentSliderDb: 0
};

// The two calibration methods. Both yield the SAME quantity — the SPL at unity
// gain — but differ in how it's obtained and therefore what the app should say
// at a limit. The method is NOT implied by the transducer (an audiometer can
// drive a sound-field speaker), so it's chosen explicitly. (Ported from UC_CVCV.)
//   audiometer  the figure is a DIAL SETTING; the ceiling is the clinician's to
//               move, and per-channel aux calibration applies (handover §3/§5).
//   soundfield  the figure is a METER READING at full device volume; the ceiling
//               is a hardware fact and there's a single meter at the head.
const CAL_METHODS = {
  audiometer: {
    label: "Audiometer — via aux / tape input",
    levelLabel: "Audiometer dial setting, dB(A)",
    perChannel: true,
    steps: [
      "Set the device volume to maximum and leave it there for the whole session.",
      "Route the calibration noise to Left, then adjust the audiometer's aux input gain for that channel until its VU meter reads 0. Switch to Right and repeat.",
      "Set the audiometer dial to the highest level you expect to present, plus a margin.",
      "Stop the noise and enter that dial setting below."
    ]
  },
  soundfield: {
    label: "Sound field — sound level meter",
    levelLabel: "Measured level, dB(A)",
    perChannel: false,
    steps: [
      "Set the device volume to maximum and leave it there for the whole session.",
      "Place the sound level meter at the client's head position, facing the speaker.",
      "Play the calibration noise and read the level in dB(A) with your usual meter settings.",
      "Stop the noise and enter that reading below."
    ]
  }
};

function calMethod() { return cal.method || "audiometer"; }
function calMethodInfo() { return CAL_METHODS[calMethod()] || CAL_METHODS.audiometer; }
function isPerChannel() { return calMethodInfo().perChannel === true; }

// Method-specific advice when a level limit is hit, so the operator is always
// told something they can act on.
function moreLevelAdvice() {
  return calMethod() === "audiometer"
    ? "raise the audiometer dial and recalibrate"
    : "this setup is already at full output — more level needs a different speaker or amplifier, or a closer position";
}
function lessLevelAdvice() {
  return calMethod() === "audiometer"
    ? "lower the audiometer dial and recalibrate"
    : "this is the bottom of the recordings' range — there's nothing quieter to present";
}

function state() { return cal; }

// Bounds for any dB(A) level that can be presented. null when uncalibrated (the
// dB FS path is a different quantity and is left alone). Ceiling = reference
// (unity — nothing louder can play without clipping); floor = reference minus
// the recording's dynamic range, but never below the physical floor of 0 dB(A).
// Both ends are placed ON the 5 dB grid (ceiling rounded DOWN, floor rounded UP)
// so every selectable position is genuinely inside the bounds. This replaces the
// old `Math.floor(level/5)*5 - 60` span, which drifted off 60 dB, dropped below
// audibility, and went NEGATIVE for references under 60 dB(A). (Ported from
// UC_CVCV levelBounds.)
function levelBounds() {
  if (!cal.isCalibrated || cal.measuredDbA === null) return null;
  const reference = Number(cal.measuredDbA);
  const max = Math.floor(reference / 5) * 5;
  const attenuationFloor = reference - MAX_ATTENUATION_DB;
  const min = Math.ceil(Math.max(ABSOLUTE_FLOOR_DBA, attenuationFloor) / 5) * 5;
  return { reference, min, max, usable: min <= max, span: max - min };
}

// Snap to the grid, then hold inside the bounds. Uncalibrated → grid only
// (gain is unity anyway). This is the clamp the AUDIO PATH uses, not just the
// slider, so no out-of-range level can reach the gain maths. (UC_CVCV clampLevel.)
function clampLevel(value) {
  const snapped = snap5(value);
  const b = levelBounds();
  if (!b || !b.usable) return snapped;
  return Math.min(b.max, Math.max(b.min, snapped));
}

// Apply a measured calibration level: it becomes the reference and the slider
// ceiling; the floor is reference − recording dynamic range, floored at 0 dB(A),
// both ends on the 5 dB grid (Finding 5). Returns true on success. A figure that
// yields no usable range (below the physical floor — i.e. not a real dB(A) SPL)
// is refused and calibration stays off, rather than handing back a slider whose
// floor is negative.
function applyCalibrationLevel(level, timestamp = new Date().toISOString(), method) {
  const reference = Number(level);
  if (!Number.isFinite(reference)) return false;

  cal.method = method || calMethod();
  cal.measuredDbA = reference;
  cal.timestamp = timestamp;
  cal.isCalibrated = true;

  const b = levelBounds();
  if (!b || !b.usable) {
    // Only reachable when the reference is below the physical floor: the figure
    // entered is not a sound pressure level. Refuse but keep the chosen method.
    const wasMethod = cal.method;
    cal.measuredDbA = null;
    cal.isCalibrated = false;
    cal.sliderMinDb = -100;
    cal.sliderMaxDb = 0;
    cal.currentSliderDb = 0;
    cal.method = wasMethod;
    return false;
  }

  cal.sliderMinDb = b.min;
  cal.sliderMaxDb = b.max;
  cal.currentSliderDb = b.max;
  persist();
  return true;
}

// Digital linear gain for a target presentation level in dB(A). The requested
// level is CLAMPED to the calibrated bounds first (Finding 5) so a stray value
// can never reach the gain maths, and the result is capped at unity — nothing
// can play louder than the reference without clipping. A cap that fires is
// logged, because it means a level reached here without being clamped upstream.
function gainForLevel(levelDbA) {
  if (cal.isCalibrated && cal.measuredDbA !== null) {
    const target = clampLevel(levelDbA);
    const attenuation = Number(cal.measuredDbA) - Number(target);
    let g = Math.pow(10, -attenuation / 20);
    if (g > 1.0) { console.warn(`[cal] gain ${g.toFixed(3)} > 1 capped at unity`); g = 1.0; }
    return g;
  }
  return 1.0; // uncalibrated: unity
}

// dB form of the same, convenient for the engine's extraGainDb parameter.
// Also clamped and capped at 0 dB (unity).
function gainDbForLevel(levelDbA) {
  if (cal.isCalibrated && cal.measuredDbA !== null) {
    const target = clampLevel(levelDbA);
    return Math.min(0, Number(target) - Number(cal.measuredDbA));
  }
  return 0;
}

function setCurrentSliderDb(db) {
  cal.currentSliderDb = db;
  persist();
}

// Set the intended method before a measurement (from the screen's selector).
function setMethod(m) { if (m === "audiometer" || m === "soundfield") cal.method = m; }

function isCalibrated() { return cal.isCalibrated; }
function measuredDbA() { return cal.measuredDbA; }

function clearCalibration() {
  cal.method = null;
  cal.measuredDbA = null;
  cal.timestamp = null;
  cal.isCalibrated = false;
  cal.sliderMinDb = -100;
  cal.sliderMaxDb = 0;
  cal.currentSliderDb = 0;
  try { localStorage.removeItem(CAL_KEY); } catch (_) {}
}

function persist() {
  try {
    localStorage.setItem(CAL_KEY, JSON.stringify({
      level: cal.measuredDbA, timestamp: cal.timestamp, method: cal.method
    }));
  } catch (_) {}
}

// Read a stored calibration WITHOUT activating it (Finding 6). The old code
// restored any saved figure as an active calibration on load, with no age check
// and no confirmation — and an active calibration asserts device volume is at
// maximum, which can't be verified after the fact. Instead we hand the record
// back to the screen, which asks the operator to confirm before it becomes
// active. Returns { level, timestamp, ageDays, stale } or null.
function readStored() {
  try {
    const raw = localStorage.getItem(CAL_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const level = Number(data.level);
    if (data.level == null || !isFinite(level)) return null;
    let ageDays = null, stale = false;
    if (data.timestamp) {
      const ms = Date.now() - new Date(data.timestamp).getTime();
      if (isFinite(ms)) { ageDays = ms / 86400000; stale = ageDays > CAL_STALE_DAYS; }
    }
    return { level, timestamp: data.timestamp || null, method: data.method || null, ageDays, stale };
  } catch (_) {
    return null;
  }
}

// Activate a previously-read stored calibration (called after the operator
// confirms). Returns true on success.
function confirmStored(rec) {
  if (!rec || !isFinite(Number(rec.level))) return false;
  return applyCalibrationLevel(Number(rec.level), rec.timestamp || undefined, rec.method || undefined);
}

// Back-compat shim: some callers may still call loadStored(). It now only READS
// (never auto-activates), so nothing gets silently restored.
function loadStored() { return readStored(); }

// Header string for the results file.
function calibrationHeader() {
  if (!cal.isCalibrated || cal.measuredDbA == null) return "not set";
  const m = calMethod() === "audiometer" ? "audiometer (aux input)" : "sound field (level meter)";
  return `${cal.measuredDbA} dB(A) — ${m}`;
}

if (typeof window !== "undefined") {
  window.Calibration = {
    state, applyCalibrationLevel, gainForLevel, gainDbForLevel,
    setCurrentSliderDb, isCalibrated, measuredDbA, clearCalibration,
    loadStored, readStored, confirmStored, calibrationHeader,
    levelBounds, clampLevel,
    calMethod, calMethodInfo, isPerChannel, setMethod,
    moreLevelAdvice, lessLevelAdvice, CAL_METHODS
  };
}


