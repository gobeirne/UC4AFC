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

// Calibration state (mirrors UC_CVCV state.calibration).
const cal = {
  measuredDbA: null,
  timestamp: null,
  isCalibrated: false,
  sliderMinDb: -100,
  sliderMaxDb: 0,
  currentSliderDb: 0
};

function state() { return cal; }

// Apply a measured calibration level: it becomes the reference and the slider
// maximum; the slider floor sits 60 dB below (snapped to 5 dB), UC_CVCV-style.
function applyCalibrationLevel(level, timestamp = new Date().toISOString()) {
  cal.measuredDbA = level;
  cal.timestamp = timestamp;
  cal.isCalibrated = true;
  cal.sliderMaxDb = level;
  cal.sliderMinDb = Math.floor(level / 5) * 5 - 60;
  cal.currentSliderDb = level;
  persist();
  return cal;
}

// Digital linear gain for a target presentation level in dB(A) (UC_CVCV).
function gainForLevel(levelDbA) {
  if (cal.isCalibrated && cal.measuredDbA !== null) {
    const attenuation = Number(cal.measuredDbA) - Number(levelDbA);
    return Math.pow(10, -attenuation / 20);
  }
  return 1.0; // uncalibrated: unity
}

// dB form of the same, convenient for the engine's extraGainDb parameter.
function gainDbForLevel(levelDbA) {
  if (cal.isCalibrated && cal.measuredDbA !== null) {
    return -(Number(cal.measuredDbA) - Number(levelDbA)); // = levelDbA - measuredDbA
  }
  return 0;
}

function setCurrentSliderDb(db) {
  cal.currentSliderDb = db;
  persist();
}

function isCalibrated() { return cal.isCalibrated; }
function measuredDbA() { return cal.measuredDbA; }

function clearCalibration() {
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
      level: cal.measuredDbA, timestamp: cal.timestamp
    }));
  } catch (_) {}
}

// Restore a stored calibration on load. Returns the record (or null).
function loadStored() {
  try {
    const raw = localStorage.getItem(CAL_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.level == null || !isFinite(Number(data.level))) return null;
    applyCalibrationLevel(Number(data.level), data.timestamp);
    return { level: Number(data.level), timestamp: data.timestamp };
  } catch (_) {
    return null;
  }
}

// Header string for the results file.
function calibrationHeader() {
  if (!cal.isCalibrated || cal.measuredDbA == null) return "not set";
  return `${cal.measuredDbA} dB(A)`;
}

if (typeof window !== "undefined") {
  window.Calibration = {
    state, applyCalibrationLevel, gainForLevel, gainDbForLevel,
    setCurrentSliderDb, isCalibrated, measuredDbA, clearCalibration,
    loadStored, calibrationHeader
  };
}
