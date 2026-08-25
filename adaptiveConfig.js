// File: adaptiveConfig.js
// -----------------------------------------------------------------------------
// UC4AFC adaptive-track Setup configuration (Step 4).
//
// Holds the adaptive-procedure defaults, persists the operator's choices to
// localStorage ("uc4afc_adaptive"), and merges them into the global `config`
// at startup. The values here are the LPF-mode defaults taken verbatim from
// UCAST_adaptive_demo (the validated demo/Monte-Carlo source), so the Step 5
// engine can consume them directly.
//
// Axis: equivalent low-pass cutoff in Hz on a log10 axis. Steps are in decades.
// Target for 4AFC = midpointTarget(4) = 0.625. Alternatives A = 4 (floor 0.25).
// -----------------------------------------------------------------------------

const ADAPT_KEY = "uc4afc_adaptive";

// Per-mode presets, verbatim from the demo (PRESETS.lpf / PRESETS.quiet).
// axisIsLog distinguishes the log10(Hz) cutoff axis (LPF) from the linear dB
// level axis (quiet). unit/stepUnit/slopeUnit are for display + the results
// header. start is in the axis's natural unit (Hz for LPF, dB for quiet).
const PRESETS = {
  lpf: {
    mode: "lpf",
    axisIsLog: true,
    unit: "Hz", stepUnit: "decades", slopeUnit: "%/octave",
    start: 1000,
    xlo: Math.log10(80), xhi: Math.log10(6000),
    // WUDR two-phase steps (decades)
    workDown: +Math.log10(1 / 0.95238).toFixed(4),  // 0.0212  (-4.76%)
    workUp:   +Math.log10(1.08333).toFixed(4),       // 0.0348  (+8.33%)
    initDown: +Math.log10(1 / 0.8889).toFixed(4),    // 0.0511  (-11.1%)
    initUp:   +Math.log10(1.20833).toFixed(4),       // 0.0822  (+20.8%)
    switchRev: 5,
    a1slope: 10.0, a2slope: 10.0, minStep: 0.01,
    slopeHint: 43                                    // %/octave
  },
  quiet: {
    mode: "quiet",
    axisIsLog: false,
    unit: "dB", stepUnit: "dB", slopeUnit: "%/dB",
    start: 65,
    xlo: 20, xhi: 85,
    // WUDR two-phase steps (dB): working 0.6 down / 1.0 up; initial 3 / 5
    workDown: 0.6, workUp: 1.0,
    initDown: 3.0, initUp: 5.0,
    switchRev: 5,
    a1slope: 0.10, a2slope: 0.10, minStep: 0.25,
    slopeHint: 6                                     // %/dB
  },
  // Noise (SNR): the adapting quantity is the signal-to-noise ratio in dB. The
  // masking noise is the calibration file, presented at the fixed level (the
  // calibrated dB(A), or unity/relative when uncalibrated); the SIGNAL level is
  // moved relative to it, so a poorer (lower) SNR is the harder direction — the
  // same harder = -1 the other linear-axis mode uses. Loudness anchor is the
  // files AS DELIVERED: they are spectrum- and level-matched at source, so
  // SNR = 0 dB means noise-at-file-level + signal-at-file-level with no
  // re-matching, and the SNR value is exactly the extra dB applied to the signal.
  //
  // WUDR steps are the quiet-mode dB steps scaled by stepMult (Finding: the
  // clinician wanted the same shape as quiet but finer, e.g. 0.2x). The stored
  // workDown/workUp/initDown/initUp below are ALREADY scaled (quiet × 0.2); the
  // Setup screen exposes stepMult so changing it rescales from the quiet base.
  snr: {
    mode: "snr",
    axisIsLog: false,
    unit: "dB SNR", stepUnit: "dB", slopeUnit: "%/dB",
    start: 2,                                         // +2 dB SNR
    xlo: -20, xhi: 10,
    // Base = quiet dB steps; stepMult (0.2) applied -> stored values below.
    stepMult: 0.2,
    workDown: +(0.6 * 0.2).toFixed(4),  // 0.12
    workUp:   +(1.0 * 0.2).toFixed(4),  // 0.20
    initDown: +(3.0 * 0.2).toFixed(4),  // 0.60
    initUp:   +(5.0 * 0.2).toFixed(4),  // 1.00
    switchRev: 5,
    a1slope: 0.10, a2slope: 0.10, minStep: 0.05,
    slopeHint: 6                                     // %/dB
  }
};

// The unscaled quiet-mode WUDR base steps that the SNR stepMult multiplies.
const SNR_BASE_STEPS = { workDown: 0.6, workUp: 1.0, initDown: 3.0, initUp: 5.0 };

// Full default config = LPF preset flattened + procedure/common fields. The
// persisted config always carries a `mode`; switching mode in Setup swaps the
// mode-specific fields to that preset's values.
const ADAPTIVE_DEFAULTS = {
  mode: "lpf",                // "lpf" | "quiet"
  procedure: "wudr",          // "wudr" | "a1" | "a2"
  A: 4,                       // alternatives (fixed); floor = 1/A = 0.25
  target: 0.625,             // midpointTarget(4) = (A+1)/(2A)

  // Start (single absolute value per mode; no relative-to-threshold path)
  startValue: PRESETS.lpf.start,     // Hz (LPF) / dB level (quiet) / dB SNR (snr)
  startCutoffHz: 1000,        // back-compat alias for LPF start (Hz)

  // SNR noise presentation level: dB(A) when calibrated, else a dB FS
  // attenuation (<= 0). Only consumed in SNR mode.
  snrNoiseLevel: 65,

  // LPF presentation level: dB(A) when calibrated, else dB FS attenuation.
  // Only consumed in LPF mode.
  lpfLevel: 65,

  // Trials
  nTrials: 33,

  // Axis bounds (mode units: log10 Hz for LPF, dB for quiet)
  xlo: PRESETS.lpf.xlo,
  xhi: PRESETS.lpf.xhi,
  axisIsLog: true,
  unit: "Hz", stepUnit: "decades", slopeUnit: "%/octave",

  // WUDR two-phase steps (mode units)
  workDown: PRESETS.lpf.workDown,
  workUp:   PRESETS.lpf.workUp,
  initDown: PRESETS.lpf.initDown,
  initUp:   PRESETS.lpf.initUp,
  switchRev: 5,

  // A1
  a1slope: PRESETS.lpf.a1slope,
  minStep: PRESETS.lpf.minStep,

  // A2
  a2slope: PRESETS.lpf.a2slope,
  pLow: 0.40,
  pHigh: 0.85,
  a2Doubling: true,

  // Psychometric slope hint for the MLE readout
  slopeHint: PRESETS.lpf.slopeHint
};

// Return a config with the mode-specific fields set to `mode`'s preset,
// preserving procedure/A/nTrials/startMode and A2 sweet points.
function applyModePreset(cfg, mode) {
  const p = PRESETS[mode] || PRESETS.lpf;
  return {
    ...cfg,
    mode: p.mode,
    axisIsLog: p.axisIsLog,
    unit: p.unit, stepUnit: p.stepUnit, slopeUnit: p.slopeUnit,
    startValue: p.start,
    startCutoffHz: p.mode === "lpf" ? p.start : cfg.startCutoffHz,
    xlo: p.xlo, xhi: p.xhi,
    workDown: p.workDown, workUp: p.workUp,
    initDown: p.initDown, initUp: p.initUp,
    switchRev: p.switchRev,
    a1slope: p.a1slope, a2slope: p.a2slope, minStep: p.minStep,
    slopeHint: p.slopeHint,
    // SNR carries a step multiplier; other modes clear it so it can't leak.
    stepMult: p.mode === "snr" ? p.stepMult : undefined
  };
}

// Rescale the SNR WUDR steps from the quiet base by a multiplier. Used by Setup
// when the operator changes the SNR step multiplier. Returns the four steps.
function snrStepsForMult(mult) {
  const m = isFinite(mult) && mult > 0 ? mult : 0.2;
  return {
    workDown: +(SNR_BASE_STEPS.workDown * m).toFixed(4),
    workUp:   +(SNR_BASE_STEPS.workUp   * m).toFixed(4),
    initDown: +(SNR_BASE_STEPS.initDown * m).toFixed(4),
    initUp:   +(SNR_BASE_STEPS.initUp   * m).toFixed(4)
  };
}

// Derive A2 sweet points from the floor, matching the demo:
//   p = 1/A + (1 - 1/A) * pOpen, with pOpen in {0.2, 0.8}
function sweetPointsFor(A) {
  const floor = 1 / A;
  return {
    pLow:  +(floor + (1 - floor) * 0.20).toFixed(4),
    pHigh: +(floor + (1 - floor) * 0.80).toFixed(4)
  };
}

function midpointTarget(A) {
  const floor = 1 / A;
  return floor + (1 - floor) * 0.5;
}

// Load persisted config (merged over defaults). Always returns a full object.
function loadAdaptiveConfig() {
  const cfg = { ...ADAPTIVE_DEFAULTS };
  try {
    const raw = localStorage.getItem(ADAPT_KEY);
    if (raw) Object.assign(cfg, JSON.parse(raw));
  } catch (_) {}
  // Keep derived values consistent.
  cfg.target = midpointTarget(cfg.A || 4);
  // --- Migrate stale persisted blobs -----------------------------------------
  // Older builds saved axisIsLog and a "start mode / relative octaves" pair.
  // axisIsLog is now derived STRICTLY from mode, so a stale axisIsLog could make
  // a quiet/snr run get low-pass filtered. Re-derive it and drop the dead
  // fields so nothing downstream can read them.
  const mode = cfg.mode || "lpf";
  cfg.axisIsLog = !(mode === "quiet" || mode === "snr");
  delete cfg.startMode;
  delete cfg.startRelOctaves;
  return cfg;
}

function saveAdaptiveConfig(cfg) {
  try { localStorage.setItem(ADAPT_KEY, JSON.stringify(cfg)); } catch (_) {}
  return cfg;
}

function clearAdaptiveConfig() {
  try { localStorage.removeItem(ADAPT_KEY); } catch (_) {}
}

// Merge the persisted adaptive config into the global `config` object at
// startup (mirrors config.js's Object.assign pattern).
function mergeAdaptiveIntoConfig(config) {
  if (!config || typeof config !== "object") return;
  config.adaptive = loadAdaptiveConfig();
}

if (typeof window !== "undefined") {
  window.AdaptiveConfig = {
    DEFAULTS: ADAPTIVE_DEFAULTS,
    PRESETS, applyModePreset, snrStepsForMult, SNR_BASE_STEPS,
    sweetPointsFor, midpointTarget,
    loadAdaptiveConfig, saveAdaptiveConfig, clearAdaptiveConfig,
    mergeAdaptiveIntoConfig
  };
}
