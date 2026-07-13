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
  }
};

// Full default config = LPF preset flattened + procedure/common fields. The
// persisted config always carries a `mode`; switching mode in Setup swaps the
// mode-specific fields to that preset's values.
const ADAPTIVE_DEFAULTS = {
  mode: "lpf",                // "lpf" | "quiet"
  procedure: "wudr",          // "wudr" | "a1" | "a2"
  A: 4,                       // alternatives (fixed); floor = 1/A = 0.25
  target: 0.625,             // midpointTarget(4) = (A+1)/(2A)

  // Start
  startMode: "absolute",      // "absolute" | "relative"
  startValue: PRESETS.lpf.start,     // Hz (LPF) or dB (quiet)
  startCutoffHz: 1000,        // back-compat alias for LPF start (Hz)
  startRelOctaves: 0,         // relative start: octaves (LPF) or dB (quiet)

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
    slopeHint: p.slopeHint
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
    PRESETS, applyModePreset,
    sweetPointsFor, midpointTarget,
    loadAdaptiveConfig, saveAdaptiveConfig, clearAdaptiveConfig,
    mergeAdaptiveIntoConfig
  };
}
