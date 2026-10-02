// File: headphones.js
// -----------------------------------------------------------------------------
// Headphone + soundcard presets.
//
// A preset is a specific transducer chain. Each one has:
//   * its OWN stored calibration (the sound-field noise calibration level, in
//     dB(A) at full device volume) — so calibrating one chain never overwrites
//     another. Selecting a preset switches calibration.js to that preset's
//     storage slot.
//   * an optional built-in calibration (`defaultCal`) used when nothing has been
//     measured/entered for that preset yet.
//   * an optional frequency-response `curve` [[Hz, dB], ...]. It is used ONLY to
//     loudness-match low-pass-filtered words: the LUFS match is computed on
//     copies shaped by this curve (measurement copies — the played sound is not
//     shaped). Absolute offset of the curve cancels; only its shape matters.
//     Unfiltered words, quiet mode and SNR need no curve — the calibration noise
//     is spectrum-matched to the speech, so its dB(A) reading already includes
//     the headphones' response.
// -----------------------------------------------------------------------------

const HP_KEY = "uc4afc_headphones";
const HP_DEEMPH_KEY = "uc4afc_hp_deemph";   // "1" = equalise to flat (de-emphasis)

// Raw HATS frequency response of the Sennheiser HD280 Pro (dB), measured with
// the X-Fi. Its shape is set by the headphones, so it is shared by every chain
// that uses the HD280.
const HD280_CURVE = [
  [0, 12.48784], [50, 12.48784], [100, 4.75783], [150, 4.196114],
  [200, 0.259988], [250, 0.387803], [300, 0.767491], [350, 0.903058],
  [400, 0.887052], [450, 0.854083], [500, 0.661139], [550, 0.578238],
  [600, 0.383544], [650, 0.060629], [700, -0.10318], [750, -0.01785],
  [800, 0.008676], [850, -0.13003], [900, -0.43919], [950, -0.52313],
  [1000, -0.28539], [1100, 0.443688], [1200, 0.729564], [1300, 0.259018],
  [1400, -0.37757], [1500, -0.8873], [1600, -0.7755], [1700, -0.84623],
  [1800, -0.70259], [1900, -0.24701], [2000, 0.118596], [2250, 0.867295],
  [2500, 1.553311], [2750, -0.03347], [3000, -4.59946], [3250, -7.9489],
  [3500, -5.18471], [3750, -2.50899], [4000, -1.82328], [4250, -0.42877],
  [4500, 0.173617], [4750, 0.48311], [5000, 1.399076], [5250, 4.120973],
  [5500, 5.748327], [5750, 5.780714], [6000, 5.817753], [6250, 6.559097],
  [6500, 6.804424], [6750, 6.153435], [7000, 5.80585], [7250, 6.261406],
  [7500, 7.619856], [7750, 9.180964], [8000, 9.444511], [8250, 9.510284],
  [8500, 9.278084], [8750, 8.847723], [9000, 8.119021], [9250, 7.291807],
  [9500, 6.465921], [9750, 5.841209], [10000, 5.217527], [10500, 4.672712],
  [11000, 3.33047], [11500, 0.889905], [12000, 0.750223], [12500, -1.18928],
  [13000, -2.12922], [13500, -0.77013], [14000, -0.11249], [14500, -1.15671],
  [15000, -2.10313], [15500, -2.95206], [16000, -3.10376], [16500, -2.55843],
  [17000, -3.31627], [17500, -5.67743], [18000, -7.34202], [18500, -9.11014],
  [19000, -10.0819], [19500, -9.15727], [20000, -9.23637], [20500, -9.11921],
  [21000, -9.10579], [21500, -9.29613], [22000, -10.4902]
];

const HEADPHONE_PRESETS = {
  flat: {
    label: "Manual",
    curve: null,
    defaultCal: null
  },

  hd280_xfi: {
    label: "Sennheiser HD280 Pro + Sound Blaster X-Fi",
    curve: HD280_CURVE,
    // Measured (GRAS): 90.9 ± 0.9 dB(A), 6 measurements across 3 individuals.
    // Full volume: Windows, browser and X-Fi at max; enhancements/effects off.
    defaultCal: {
      level: 90.9,
      source: "built-in: GRAS, 90.9 ± 0.9 dB(A), 6 measurements, 3 individuals"
    }
  },

  hd280_ugreen: {
    label: "UGREEN UG-80154 + Sennheiser HD280 Pro",
    curve: HD280_CURVE,   // headphone-determined shape (measured via the X-Fi)
    // Measured (GRAS): 89.3 ± 1.1 dB(A), 5 measurements across 2 individuals.
    defaultCal: {
      level: 89.3,
      source: "built-in: GRAS, 89.3 ± 1.1 dB(A), 5 measurements, 2 individuals"
    }
  },

  sony_zx110_ugreen: {
    label: "UGREEN UG-80154 + Sony MDR-ZX110",
    curve: null,        // no frequency-response curve yet (LPF matching is flat)
    // Measured (GRAS): 82.9 ± 0.9 dB(A), 8 measurements across 3 individuals.
    defaultCal: {
      level: 82.9,
      source: "built-in: GRAS, 82.9 ± 0.9 dB(A), 8 measurements, 3 individuals"
    }
  }
};

function hpCurrentId() {
  try {
    const id = localStorage.getItem(HP_KEY);
    if (id && HEADPHONE_PRESETS[id]) return id;
  } catch (_) {}
  return "flat";
}

function hpPreset(id = hpCurrentId()) {
  return HEADPHONE_PRESETS[id] || HEADPHONE_PRESETS.flat;
}

// Activate a preset: remember it, switch calibration storage to its slot
// (restoring what was stored there, or its built-in value), and give the audio
// engine its curve. Returns { id, restored, fromPreset }.
function hpActivate(id) {
  if (!HEADPHONE_PRESETS[id]) id = "flat";
  try { localStorage.setItem(HP_KEY, id); } catch (_) {}
  const p = HEADPHONE_PRESETS[id];

  let restored = null, fromPreset = false;
  if (typeof Calibration !== "undefined" && Calibration.setProfile) {
    Calibration.setProfile(id);                 // clears in-memory cal, switches slot
    restored = Calibration.loadStored();
    // A stored value WITH a source came from a built-in preset value (manual
    // entries have none). If the built-in has since changed, use the new one.
    if (restored && restored.source && p.defaultCal &&
        (Number(restored.level) !== p.defaultCal.level || restored.source !== p.defaultCal.source)) {
      restored = null;
    }
    if (restored) {
      if (restored.method && Calibration.setMethod) Calibration.setMethod(restored.method);
      Calibration.confirmStored(restored);
    } else if (p.defaultCal) {
      Calibration.setMethod("soundfield");
      Calibration.applyCalibrationLevel(p.defaultCal.level, new Date().toISOString(),
        "soundfield", p.defaultCal.source);
      fromPreset = true;
    }
  }
  hpPushToEngine(id);
  return { id, restored, fromPreset };
}

// De-emphasis: equalise the selected headphones to a flat response at the ear
// (played sound filtered by 1/curve; level-scaled so the calibration noise keeps
// its calibrated dB(A)). Only possible for a preset with a curve.
// The de-emphasis option is currently hidden in the UI and forced OFF (even if a
// device previously ticked it). Set DEEMPH_ENABLED = true to bring it back.
const DEEMPH_ENABLED = false;
function hpDeemphOn() {
  if (!DEEMPH_ENABLED) return false;
  try { return localStorage.getItem(HP_DEEMPH_KEY) === "1"; } catch (_) { return false; }
}
function hpSetDeemph(on) {
  try { localStorage.setItem(HP_DEEMPH_KEY, on ? "1" : "0"); } catch (_) {}
  hpPushToEngine(hpCurrentId());
}
function hpPushToEngine(id) {
  const p = hpPreset(id);
  if (typeof AudioEngine !== "undefined" && AudioEngine.setHeadphoneCurve) {
    const noiseUrl = (typeof config !== "undefined" && config && config.calibNoiseFile)
      ? `sounds/${config.calibNoiseFile}` : "sounds/noise.mp3";
    AudioEngine.setHeadphoneCurve(id, p.curve, {
      deemph: hpDeemphOn() && !!p.curve, noiseUrl, maxBoostDb: p.maxBoostDb ?? null
    });
  }
}

// One line for results headers.
function hpHeader() {
  const id = hpCurrentId(), p = hpPreset(id);
  let eqTxt = "";
  if (p.curve && DEEMPH_ENABLED) {
    const info = (typeof AudioEngine !== "undefined" && AudioEngine.eqInfo) ? AudioEngine.eqInfo() : null;
    eqTxt = hpDeemphOn()
      ? `; equalised to flat (de-emphasis${info && info.scaleDb != null ? `, level scale ${info.scaleDb.toFixed(2)} dB` : ""})`
      : "; not equalised";
  }
  return `${p.label}${(p.curve || id === "flat") ? "" : " (no frequency-response curve yet)"}${eqTxt}`;
}

if (typeof window !== "undefined") {
  window.Headphones = {
    PRESETS: HEADPHONE_PRESETS,
    currentId: hpCurrentId, preset: hpPreset, activate: hpActivate, header: hpHeader,
    deemphOn: hpDeemphOn, setDeemph: hpSetDeemph
  };
}
