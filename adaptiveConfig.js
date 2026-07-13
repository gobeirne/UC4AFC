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

// Butterworth/axis + procedure defaults (LPF mode), verbatim from the demo.
const ADAPTIVE_DEFAULTS = {
  procedure: "wudr",          // "wudr" | "a1" | "a2"
  A: 4,                       // alternatives (fixed); floor = 1/A = 0.25
  target: 0.625,             // midpointTarget(4) = (A+1)/(2A)

  // Start
  startMode: "absolute",      // "absolute" (Hz) | "relative" (octaves re threshold)
  startCutoffHz: 1000,        // demo lpf.start
  startRelOctaves: 0,         // used when startMode === "relative"

  // Trials
  nTrials: 33,                // one list; up to 66 (both lists)

  // Axis bounds (log10 Hz), from the demo lpf mode
  xlo: Math.log10(80),
  xhi: Math.log10(6000),

  // WUDR two-phase steps (decades), verbatim from demo lpf mode
  workDown: +Math.log10(1 / 0.95238).toFixed(4),  // 0.0212  (-4.76%)
  workUp:   +Math.log10(1.08333).toFixed(4),       // 0.0348  (+8.33%)
  initDown: +Math.log10(1 / 0.8889).toFixed(4),    // 0.0512  (-11.1%)
  initUp:   +Math.log10(1.20833).toFixed(4),       // 0.0822  (+20.8%)
  switchRev: 5,                                     // switch to working after 5 reversals

  // A1
  a1slope: 10.0,              // tracking-slope constant on the log-Hz axis
  minStep: 0.01,

  // A2
  a2slope: 10.0,
  pLow: 0.40,                 // auto sweet points for 4AFC: 1/A + (1-1/A)*{0.2,0.8}
  pHigh: 0.85,
  a2Doubling: true,          // B&K step-doubling toggle

  // Psychometric slope hint for the MLE readout (demo lpf.slope, %/octave)
  slopeHint: 43
};

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
    sweetPointsFor, midpointTarget,
    loadAdaptiveConfig, saveAdaptiveConfig, clearAdaptiveConfig,
    mergeAdaptiveIntoConfig
  };
}
