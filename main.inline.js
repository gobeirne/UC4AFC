"use strict";

// --- Bundled main.inline.js ---

// --- global.js ---
// File: global.js

// --- Config ---
const config = {
  arrows: false,
  defaultDelay: 1500,
  breakEvery: 32,
  showCountdown: true,
  imageRevealOffsetMs: 600,
  showAbortXOnTouchDevices: true,
  instructions: {
    training:
      "You'll see and hear words one at a time. Look at the picture while you listen. Try to remember what the word is.",
    test:
      "You will hear a word and see four pictures. Click the picture that matches the word you heard. If you're not sure, have a guess."
  },
  arrowList: [
    //"beak", "chin", "dad", "hood", "knees",
    //"lock", "mum", "nose", "note", "page",
    //"seed", "tongue"
  ]
};

// --- Runtime State ---
let testStartedAt = null;
let list = [];
let trialIndex = 0;
let phase = "";
let participant = "";
let responseLog = [];

// --- DOM Elements ---
const trainingImg = document.getElementById("training-img");
let optImgs = [];
let audio = null;
let startTime = null;

function setOptImgs() {
  optImgs = [
    document.getElementById("opt0"),
    document.getElementById("opt1"),
    document.getElementById("opt2"),
    document.getElementById("opt3")
  ];
  audio = document.getElementById("stimulus");
}

// --- Arrows ---
let arrowSet = new Set();
function setArrowList(list) {
  arrowSet.clear();
  list.forEach(item => arrowSet.add(item));
}

// Ensure optImgs/audio init if script is late-loaded
document.addEventListener("DOMContentLoaded", setOptImgs);


// --- config.js ---
// File: config.js

async function loadConfig() {
  const isLocal = location.protocol === "file:";

  if (isLocal) {
    console.warn(" Running locally. Skipping fetch(config.json) and using fallback config.");
    Object.assign(config, {
      arrows: false,
      defaultDelay: 1500,
      showCountdown: true,
      showAbortXOnTouchDevices: true,
      saveJson: false,
      imageRevealOffsetMs: 600,
      instructions: {
        training: "You'll see and hear words one at a time. Look at the picture while you listen. Try to remember what the word is.",
        test: "You will hear a word and see four pictures. Click the picture that matches the word you heard. If you're not sure, have a guess."
      }
    });
    return;
  }

  try {
    const res = await fetch("config.json");
    const externalConfig = await res.json();
    Object.assign(config, externalConfig);
    console.log("[OK] Loaded config.json:", config);
  } catch (err) {
    console.error("[X] Failed to load config.json:", err);
    console.warn("[!] Could not load config.json. Using fallback config.");
  }
}



// --- audioEngine.js ---
// File: audioEngine.js
// -----------------------------------------------------------------------------
// UC4AFC Web Audio engine (Steps 1 + 2 of the adaptive handover).
//
// Responsibilities:
//   * Own a single AudioContext and decode/cache stimulus AudioBuffers.
//   * Measure 400 ms momentary LUFS (BS.1770 K-weighting), ported VERBATIM from
//     gobeirne/NoiseResources level_equalization.html.
//   * Apply a 10th-order Butterworth low-pass (5 cascaded biquads, true
//     coefficients via bilinear transform) OFFLINE, so playback has zero lag.
//   * Loudness-match the filtered word to the unfiltered word's momentary LUFS.
//   * Apply an external gain (calibration, added in Step 3) and play.
//
// This module is deliberately self-contained and side-effect free at import
// time. flow.js calls playStimulus()/playThrough() instead of touching the
// <audio> element directly.
// -----------------------------------------------------------------------------

/* =========================================================================
 * SECTION A — LUFS routine (VERBATIM from level_equalization.html)
 * Do not "improve" these; they are validated. The only change from source is
 * that `padSilence` is passed as an explicit argument (default false) rather
 * than read from a global, since we have no such global here. Momentary max is
 * unaffected by symmetric silence padding, so this does not change results.
 * ========================================================================= */

const K_COEFFS = {
  48000: {
    s1: { b0:1.53512485958697, b1:-2.69169618940638, b2:1.19839281085285,
          a1:-1.69065929318241, a2:0.73248077421585 },
    s2: { b0:1.0, b1:-2.0, b2:1.0,
          a1:-1.99004745483398, a2:0.99007225036621 }
  },
  44100: {
    s1: { b0:1.5308412300503478, b1:-2.6509799951547297, b2:1.1690790799215869,
          a1:-1.6636551132560204, a2:0.7125954280732254 },
    s2: { b0:1.0, b1:-2.0, b2:1.0,
          a1:-1.9891696736297957, a2:0.9891990357870394 }
  }
};

function getKCoeffs(sr) {
  if (K_COEFFS[sr]) return K_COEFFS[sr];
  return Math.abs(sr - 44100) <= Math.abs(sr - 48000) ? K_COEFFS[44100] : K_COEFFS[48000];
}

function applyBiquad(input, c) {
  const out = new Float64Array(input.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < input.length; i++) {
    const x0 = input[i];
    const y0 = c.b0*x0 + c.b1*x1 + c.b2*x2 - c.a1*y1 - c.a2*y2;
    out[i] = y0;
    x2 = x1; x1 = x0; y2 = y1; y1 = y0;
  }
  return out;
}

function kWeightSignal(audioBuffer, includePad = false) {
  const sr = audioBuffer.sampleRate;
  const nCh = audioBuffer.numberOfChannels;
  const len = audioBuffer.length;
  const pad = includePad ? sr : 0;
  const mono = new Float64Array(len + 2 * pad);

  for (let ch = 0; ch < nCh; ch++) {
    const d = audioBuffer.getChannelData(ch);
    for (let i = 0; i < len; i++) mono[i + pad] += d[i] / nCh;
  }

  const coeffs = getKCoeffs(sr);
  return applyBiquad(applyBiquad(mono, coeffs.s1), coeffs.s2);
}

function blockPowersFromSignal(signal, sr, windowSeconds, hopSeconds) {
  const winSamp = Math.max(1, Math.round(windowSeconds * sr));
  const hopSamp = Math.max(1, Math.round(hopSeconds * sr));
  const cumSq = new Float64Array(signal.length + 1);
  for (let i = 0; i < signal.length; i++) cumSq[i+1] = cumSq[i] + signal[i] * signal[i];

  const powers = [];
  if (signal.length < winSamp) {
    powers.push(cumSq[signal.length] / winSamp);
  } else {
    for (let s = 0; s + winSamp <= signal.length; s += hopSamp) {
      powers.push((cumSq[s + winSamp] - cumSq[s]) / winSamp);
    }
  }
  return powers;
}

function powerToLUFS(ms) {
  return -0.691 + 10 * Math.log10(Math.max(ms, 1e-20));
}

function gatedIntegratedLUFS(blockPowers) {
  const absSurvivors = blockPowers.filter(ms => powerToLUFS(ms) >= -70);
  if (absSurvivors.length === 0) return -Infinity;

  const absMean = absSurvivors.reduce((sum, ms) => sum + ms, 0) / absSurvivors.length;
  const relGate = powerToLUFS(absMean) - 10;
  const relSurvivors = absSurvivors.filter(ms => powerToLUFS(ms) >= relGate);
  if (relSurvivors.length === 0) return -Infinity;

  const gatedMean = relSurvivors.reduce((sum, ms) => sum + ms, 0) / relSurvivors.length;
  return powerToLUFS(gatedMean);
}

function estimateTruePeakDB(audioBuffer) {
  // 4x linear interpolation estimate: better than sample peak, but not a full
  // ITU oversampled low-pass true-peak filter.
  let peak = 0;
  for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
    const d = audioBuffer.getChannelData(ch);
    for (let i = 0; i < d.length - 1; i++) {
      const a = d[i], b = d[i + 1];
      peak = Math.max(peak, Math.abs(a), Math.abs((3*a+b)/4), Math.abs((a+b)/2), Math.abs((a+3*b)/4));
    }
    if (d.length) peak = Math.max(peak, Math.abs(d[d.length - 1]));
  }
  return 20 * Math.log10(Math.max(peak, 1e-20));
}

function measureLUFS(audioBuffer, padSilence = false) {
  const sr = audioBuffer.sampleRate;
  const kw = kWeightSignal(audioBuffer, padSilence);

  // Fine-grained 25ms hop for accurate momentary max
  const momPowersFine = blockPowersFromSignal(kw, sr, 0.4, 0.025);
  // Standard 100ms hop for integrated loudness gating (per BS.1770)
  const momPowers = blockPowersFromSignal(kw, sr, 0.4, 0.1);
  const stPowers = blockPowersFromSignal(kw, sr, 3.0, 1.0);

  return {
    momentary: Math.max(...momPowersFine.map(powerToLUFS)),
    shortTerm: Math.max(...stPowers.map(powerToLUFS)),
    integrated: gatedIntegratedLUFS(momPowers),
    truePeakDB: estimateTruePeakDB(audioBuffer)
  };
}

/* =========================================================================
 * SECTION B — 10th-order Butterworth low-pass (true coefficients)
 * Five cascaded 2nd-order sections. Analog prototype -> bilinear transform
 * with frequency prewarping. Verified numerically: -3.01 dB at fc, flat
 * passband, 0 dB DC, -60 dB/oct rolloff, Qs matching the handover values.
 * ========================================================================= */

const BUTTERWORTH_ORDER = 10;

// Pole Qs for the 5 second-order sections of an order-10 Butterworth.
function butterworthSectionQs(order) {
  const Qs = [];
  const pairs = order / 2;
  for (let k = 0; k < pairs; k++) {
    const theta = Math.PI * (2 * k + 1) / (2 * order);
    Qs.push(1 / (2 * Math.sin(theta)));
  }
  return Qs;
}

// Bilinear transform of a 2nd-order analog lowpass (unity DC gain) with given Q.
function analogLPtoBiquad(fc, Q, sr) {
  const wcAnalog = 2 * sr * Math.tan(Math.PI * fc / sr); // prewarped
  const K = 2 * sr;
  const w2 = wcAnalog * wcAnalog;
  const b = wcAnalog / Q;
  const a0 = K*K + b*K + w2;
  const a1 = 2*(w2 - K*K);
  const a2 = K*K - b*K + w2;
  const nb0 = w2, nb1 = 2*w2, nb2 = w2;
  return {
    b0: nb0/a0, b1: nb1/a0, b2: nb2/a0,
    a1: a1/a0,  a2: a2/a0
  };
}

// Build the 5-section cascade for a given cutoff and sample rate.
function butterworthLowpassSections(fc, sr, order = BUTTERWORTH_ORDER) {
  return butterworthSectionQs(order).map(q => analogLPtoBiquad(fc, q, sr));
}

// Apply the Butterworth cascade to an AudioBuffer offline, returning a new
// AudioBuffer of the same shape. Each channel is filtered independently through
// the same 5-section cascade (double-precision direct form).
async function renderButterworthLowpass(ctxForBuffers, buffer, cutoffHz) {
  const sr = buffer.sampleRate;
  const sections = butterworthLowpassSections(cutoffHz, sr);
  const out = ctxForBuffers.createBuffer(buffer.numberOfChannels, buffer.length, sr);
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    let sig = Float64Array.from(buffer.getChannelData(ch));
    for (const c of sections) sig = applyBiquad(sig, c);
    out.getChannelData(ch).set(Float32Array.from(sig));
  }
  return out;
}

/* =========================================================================
 * SECTION C — Engine (context, decode cache, pipeline, playback)
 * ========================================================================= */

const DB = (linear) => 20 * Math.log10(Math.max(linear, 1e-20));
const LIN = (db) => Math.pow(10, db / 20);

const AudioEngine = (() => {
  // The one true rate. Stimuli are 48 kHz; the calibration file must match
  // (see Finding 1). Everything downstream assumes this rate.
  const ASSET_SAMPLE_RATE = 48000;

  let ctx = null;
  let masterGain = null;
  // Populated by context() when the constructed rate differs from the assets.
  // { contextRate, assetRate, ratio } or null. Read via rateMismatch().
  let _rateMismatch = null;

  // name -> { raw: AudioBuffer, momentary: number }
  const cache = new Map();

  // per-(name|cutoff) filtered+matched buffers, so repeated presentations at
  // the same cutoff are free. Keyed as `${name}@${cutoffHz}`.
  const filteredCache = new Map();

  // Optional pre-measured momentary LUFS per word name, loaded from a repo file
  // (see loadLUFSTable). When present, decode() uses this instead of measuring
  // live, saving per-word measurement cost. name -> momentary LUFS (number).
  const preMeasured = new Map();

  let activeSource = null;

  function context() {
    if (!ctx) {
      // On iOS the audio-session category IN FORCE AT CONSTRUCTION decides the
      // hardware rate. If it isn't "playback" when the context is built, iOS
      // hands out a 24 kHz context and every 48 kHz asset plays at half speed
      // (ratio exactly 2 — the tell-tale signature), with wrong level AND
      // spectrum. This MUST be set before the constructor runs, not after.
      try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (_) {}

      const AC = window.AudioContext || window.webkitAudioContext;
      // Ask for the asset rate as a hint; fall back to a plain constructor if
      // the browser refuses it. Either way the rate is verified below.
      try { ctx = new AC({ sampleRate: ASSET_SAMPLE_RATE }); }
      catch (_) { ctx = new AC(); }

      masterGain = ctx.createGain();
      masterGain.gain.value = 1.0;
      masterGain.connect(ctx.destination);

      const rate = ctx.sampleRate;
      if (rate !== ASSET_SAMPLE_RATE) {
        const ratio = ASSET_SAMPLE_RATE / rate;
        const halfSpeed = Math.abs(ratio - 2) < 0.01;
        _rateMismatch = { contextRate: rate, assetRate: ASSET_SAMPLE_RATE, ratio };
        console.warn(
          `[audio] AudioContext is ${rate} Hz but assets are ${ASSET_SAMPLE_RATE} Hz — RATE MISMATCH.` +
          (halfSpeed
            ? " Exactly half: the iOS 50%-speed signature (a 24 kHz context handed " +
              "out because the audio session was not 'playback' at construction). " +
              "Playback will be slow AND the presented level wrong — do not " +
              "calibrate or test in this state."
            : " If playback sounds slow/fast or the level looks off, this is why.")
        );
      } else {
        _rateMismatch = null;
        console.log(`[audio] AudioContext ${rate} Hz (matches assets)`);
      }
    }
    return ctx;
  }

  // Null when the context rate matches the assets; otherwise
  // { contextRate, assetRate, ratio }. The UI reads this to warn the clinician
  // and block calibration, since a mismatch means a silently wrong reference.
  function rateMismatch() { return _rateMismatch; }

  // Must be called from a user gesture on iOS/Safari to unlock audio.
  async function resume() {
    const c = context();
    if (c.state === "suspended") {
      try { await c.resume(); } catch (_) {}
    }
    return c.state;
  }

  // Load a pre-measured momentary-LUFS table from a repo file. Format: one entry
  // per line, "name<TAB or whitespace>lufs" (e.g. "nose\t-23.14"). Lines that
  // start with # are comments. Missing/malformed lines are skipped; words not in
  // the table simply fall back to live measurement in decode(). Returns the
  // number of entries loaded (0 on any failure, so callers degrade gracefully).
  async function loadLUFSTable(url = "stimulus_lufs.txt") {
    try {
      const resp = await fetch(url);
      if (!resp.ok) return 0;
      const text = await resp.text();
      let n = 0;
      for (const line of text.split(/\r?\n/)) {
        const t = line.trim();
        if (!t || t.startsWith("#")) continue;
        const m = t.split(/[\s,]+/);
        if (m.length < 2) continue;
        const name = m[0];
        const lufs = parseFloat(m[1]);
        if (name && isFinite(lufs)) { preMeasured.set(name, lufs); n++; }
      }
      return n;
    } catch (_) {
      return 0;
    }
  }

  // Decode one file (path like "sounds/nose.mp3") and cache raw buffer + its
  // unfiltered momentary LUFS. Uses a pre-measured LUFS value when available
  // (loadLUFSTable), otherwise measures live. Idempotent.
  async function decode(name, url) {
    if (cache.has(name)) return cache.get(name);
    const c = context();
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`decode fetch failed ${resp.status} for ${url}`);
    const arr = await resp.arrayBuffer();
    const raw = await c.decodeAudioData(arr);
    const momentary = preMeasured.has(name) ? preMeasured.get(name)
                                            : measureLUFS(raw).momentary;
    const entry = { raw, momentary };
    cache.set(name, entry);
    return entry;
  }

  function isDecoded(name) { return cache.has(name); }

  // Produce the filtered + loudness-matched buffer for a word at a cutoff.
  // Returns { buffer, preLUFS, postLUFS, matchGainDb, truePeakDB }.
  // cutoffHz === null  => no filtering (pass-through), matchGain 0.
  async function prepare(name, cutoffHz) {
    const entry = cache.get(name);
    if (!entry) throw new Error(`prepare() called before decode() for ${name}`);

    if (cutoffHz == null) {
      return {
        buffer: entry.raw,
        preLUFS: entry.momentary,
        postLUFS: entry.momentary,
        matchGainDb: 0,
        truePeakDB: estimateTruePeakDB(entry.raw)
      };
    }

    const key = `${name}@${Math.round(cutoffHz)}`;
    if (filteredCache.has(key)) return filteredCache.get(key);

    const c = context();
    const filtered = await renderButterworthLowpass(c, entry.raw, cutoffHz);
    const postLUFS = measureLUFS(filtered).momentary;
    const preLUFS = entry.momentary;
    const matchGainDb = preLUFS - postLUFS;           // >0: LPF lost energy
    const matchLin = LIN(matchGainDb);

    // Bake the loudness-match gain into the buffer samples so the returned
    // buffer already sits at the unfiltered momentary loudness.
    const matched = c.createBuffer(filtered.numberOfChannels, filtered.length, filtered.sampleRate);
    for (let ch = 0; ch < filtered.numberOfChannels; ch++) {
      const src = filtered.getChannelData(ch);
      const dst = matched.getChannelData(ch);
      for (let i = 0; i < src.length; i++) dst[i] = src[i] * matchLin;
    }

    const result = {
      buffer: matched,
      preLUFS, postLUFS, matchGainDb,
      truePeakDB: estimateTruePeakDB(matched)
    };
    filteredCache.set(key, result);
    return result;
  }

  // Route an input node to the left ear, right ear, or both, WITHOUT the
  // equal-power boost a StereoPannerNode applies. A StereoPannerNode panned hard
  // to one side sums both input channels into the output channel — up to +6 dB
  // in that ear versus the un-panned path — so single-ear presentation measures
  // hot while the on-screen level reads correct. Here instead:
  //   * up-mix the source to dual-mono first (a mono file → identical L and R at
  //     unchanged level, so single-ear presentation of a mono file isn't silent;
  //     a stereo file passes through per channel), then
  //   * split to 2 channels, multiply the off-ear by 0 and the on-ear by 1 (no
  //     panning, no summing, no level compensation), then merge back to stereo.
  // "left" = right×0, left×1. "right" = left×0, right×1. "binaural" = both×1.
  // This is the SAME graph the calibration tone uses (Finding 3), so any
  // channel-handling effect cancels out of the reference rather than biasing it.
  function makeEarRouter(c, inputNode, ear) {
    // "speakers" up-mix to 2 channels turns mono into dual-mono. (A raw
    // ChannelSplitter uses "discrete" interpretation, under which a mono input
    // maps to ch0=signal, ch1=silence — silencing the right ear for mono files.)
    const stereoize = c.createGain();
    stereoize.channelCount = 2;
    stereoize.channelCountMode = "explicit";
    stereoize.channelInterpretation = "speakers";
    inputNode.connect(stereoize);

    const splitter = c.createChannelSplitter(2);
    const leftGain = c.createGain();
    const rightGain = c.createGain();
    const merger = c.createChannelMerger(2);
    stereoize.connect(splitter);
    splitter.connect(leftGain, 0).connect(merger, 0, 0);
    splitter.connect(rightGain, 1).connect(merger, 0, 1);
    merger.connect(masterGain);

    const apply = (e) => {
      leftGain.gain.value  = (e === "left"  || e === "binaural") ? 1 : 0;
      rightGain.gain.value = (e === "right" || e === "binaural") ? 1 : 0;
    };
    apply(ear);
    return { setEar: apply };
  }

  // Play a prepared buffer at a given extra gain (dB). extraGainDb is where
  // the calibration gain (Step 3) will go; for now default 0 dB.
  // Returns a promise that resolves when playback ends (or rejects on error).
  // onStarted() fires when audio actually begins producing sound (for the
  // image-reveal timing in flow.js).
  function playBuffer(buffer, { extraGainDb = 0, onStarted = null, routing = "binaural" } = {}) {
    const c = context();
    stop(); // ensure only one stimulus at a time

    const src = c.createBufferSource();
    src.buffer = buffer;

    const trialGain = c.createGain();
    trialGain.gain.value = LIN(extraGainDb);

    // Route left / right / binaural via the splitter/merger router (Finding 2),
    // never a StereoPannerNode. The router terminates at masterGain, so this is
    // the same path — including its single sink — that the calibration tone
    // takes (Finding 3): source → trialGain → earRouter → masterGain → dest.
    src.connect(trialGain);
    makeEarRouter(c, trialGain, routing);
    activeSource = src;

    return new Promise((resolve, reject) => {
      let started = false;
      src.onended = () => {
        if (activeSource === src) activeSource = null;
        resolve();
      };
      try {
        src.start();
        // Fire onStarted on the next frame; buffer sources begin effectively
        // immediately (unlike <audio>, no metadata/autoplay stall).
        if (onStarted) {
          started = true;
          requestAnimationFrame(() => onStarted());
        }
      } catch (err) {
        if (activeSource === src) activeSource = null;
        reject(err);
      }
    });
  }

  // Convenience: decode-if-needed, prepare at cutoff, play. Mirrors what
  // flow.js needs per trial.
  async function playStimulus(name, url, { cutoffHz = null, extraGainDb = 0, onStarted = null, routing = "binaural" } = {}) {
    if (!cache.has(name)) await decode(name, url);
    const prepared = await prepare(name, cutoffHz);
    await playBuffer(prepared.buffer, { extraGainDb, onStarted, routing });
    return prepared;
  }

  function stop() {
    if (activeSource) {
      try { activeSource.onended = null; activeSource.stop(); } catch (_) {}
      try { activeSource.disconnect(); } catch (_) {}
      activeSource = null;
    }
  }

  function setMasterGainDb(db) {
    context();
    masterGain.gain.value = LIN(db);
  }

  // ---- Calibration tone ---------------------------------------------------
  // Plays the provided calibration noise FILE (spectrum- and level-matched to
  // the stimuli) looped at unity gain through the graph. No synthesis: the file
  // is the reference. Decoded once and cached under a reserved key.
  let calibSource = null;
  let calibRouter = null;
  const CALIB_KEY = "__calib__";

  async function startCalibrationTone(url = "sounds/calib.mp3", { onStarted = null, extraGainDb = 0, ear = "binaural" } = {}) {
    const c = context();
    stopCalibrationTone();

    // Decode + cache the calibration file (idempotent).
    let entry = cache.get(CALIB_KEY);
    if (!entry) {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`calibration fetch failed ${resp.status} for ${url}`);
      const raw = await c.decodeAudioData(await resp.arrayBuffer());
      entry = { raw, momentary: measureLUFS(raw).momentary };
      cache.set(CALIB_KEY, entry);
    }

    const src = c.createBufferSource();
    src.buffer = entry.raw;
    src.loop = true;
    // The calibration reference MUST be measured on the identical graph the
    // stimuli play through (Finding 3), or the reference and the presentation
    // differ by the presence of the routing stage itself. So the cal tone goes
    // through the same trialGain → earRouter → masterGain path a stimulus uses.
    // Unity when extraGainDb === 0 (this IS the reference); the "Test level"
    // button passes a non-zero gain to audition a presentation level.
    const g = c.createGain();
    g.gain.value = LIN(extraGainDb);
    src.connect(g);
    // Route through the SAME splitter/merger the stimuli use (Finding 3), so the
    // reference is measured on the identical graph. The ear is honoured because
    // audiometer calibration is done ONE CHANNEL AT A TIME: the clinician routes
    // the noise to Left, sets that channel's aux gain, then Right (handover §3).
    // Sound-field callers pass "binaural" (a single meter at the head).
    calibRouter = makeEarRouter(c, g, ear === "left" || ear === "right" ? ear : "binaural");
    calibSource = src;
    src.start();
    if (onStarted) requestAnimationFrame(() => onStarted());
    return entry.momentary;       // informational only
  }

  function stopCalibrationTone() {
    if (calibSource) {
      try { calibSource.stop(); } catch (_) {}
      try { calibSource.disconnect(); } catch (_) {}
      calibSource = null;
    }
    calibRouter = null;
  }

  // Live re-route the running calibration tone to left / right / both, so the
  // clinician can flip channels without restarting. No-op if nothing is playing.
  function setCalibrationEar(ear) {
    if (calibRouter) calibRouter.setEar(ear === "left" || ear === "right" ? ear : "binaural");
  }

  return {
    // lifecycle
    context, resume,
    // assets
    decode, isDecoded, loadLUFSTable,
    // pipeline
    prepare, measure: measureLUFS,
    butterworthSections: butterworthLowpassSections,
    // playback
    playBuffer, playStimulus, stop, setMasterGainDb,
    // calibration
    startCalibrationTone, stopCalibrationTone, setCalibrationEar,
    // audio-graph diagnostics
    rateMismatch,
    // caches (exposed for diagnostics / teardown)
    _cache: cache, _filteredCache: filteredCache,
    // utils
    DB, LIN
  };
})();

// Expose for the non-module bundle (main.inline.js) and for ES import.
if (typeof window !== "undefined") window.AudioEngine = AudioEngine;


// --- calibration.js ---
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


// --- adaptiveConfig.js ---
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


// --- adaptive.js ---
// File: adaptive.js
// -----------------------------------------------------------------------------
// UC4AFC adaptive engine (Step 5).
//
// The psychometric function, step formulas (WUDR two-phase, A1, A2 with B&K
// step-doubling), and the maximum-likelihood fit are ported VERBATIM from the
// validated UCAST_adaptive_demo / UCAST_montecarlo_sweep sources. The only
// change is structural: the demo runs an entire simulated track in a for-loop
// (calling simResponse internally); here each procedure's single-iteration step
// logic is factored into a createTrack() state machine that advances one step
// per REAL user response.
//
// Axis: internal x is on the mode's axis. For UC4AFC (LPF mode) x = log10(Hz),
// so currentCutoffHz() = 10^x. Steps are in decades. A = 4 (floor 0.25),
// target = midpointTarget(4) = 0.625.
// -----------------------------------------------------------------------------

const BK_A = 1.5, BK_B = 1.41;

function midpointTarget(A) { const floor = 1.0 / A; return floor + (1 - floor) * 0.5; }

// --- Psychometric function (verbatim; axis handling folded in) ---------------
// slope is the gradient at threshold in the mode's slope units (%/octave for
// LPF). For the log axis we convert %/octave -> per log10(Hz) decade, then to
// the logistic coefficient k = 4A*m/(A-1) which pins the 4AFC threshold at
// (A+1)/(2A) = 0.625.
function slopeToK(slope, A, axisIsLog) {
  let m = slope / 100.0;                      // proportion per (octave)
  if (axisIsLog) m = m * Math.log2(10);       // %/octave -> per log10(Hz) decade
  return (4.0 * A * m) / (A - 1.0);
}

function intelligibility(x, srtX, slope, A, axisIsLog) {
  const k = slopeToK(slope, A, axisIsLog);
  const z = Math.max(-50, Math.min(50, k * (x - srtX)));
  return (1.0 / A) * (1.0 + (A - 1.0) / (1.0 + Math.exp(-z)));
}

// --- MLE fit (verbatim: negLL + Nelder-Mead + fitMLE) ------------------------
function negLL(params, xs, ys, A, axisIsLog) {
  const srtX = params[0], slope = params[1];
  if (slope <= 0 || slope > 1000) return 1e12;
  let nll = 0;
  for (let i = 0; i < xs.length; i++) {
    let p = intelligibility(xs[i], srtX, slope, A, axisIsLog);
    p = Math.min(1 - 1e-9, Math.max(1e-9, p));
    nll -= ys[i] * Math.log(p) + (1 - ys[i]) * Math.log(1 - p);
  }
  return nll;
}

function nelderMead(obj, start, step, maxit, tol) {
  const a = 1, g = 2, r = 0.5, s = 0.5;
  let S = [
    { x: start.slice(), fx: obj(start) },
    { x: [start[0] + step[0], start[1]], fx: obj([start[0] + step[0], start[1]]) },
    { x: [start[0], start[1] + step[1]], fx: obj([start[0], start[1] + step[1]]) }
  ];
  for (let it = 0; it < maxit; it++) {
    S.sort((p, q) => p.fx - q.fx);
    const spread = Math.max(Math.abs(S[0].fx - S[1].fx), Math.abs(S[0].fx - S[2].fx));
    if (spread < tol) break;
    const c = [(S[0].x[0] + S[1].x[0]) / 2, (S[0].x[1] + S[1].x[1]) / 2];
    const rf = [c[0] + a * (c[0] - S[2].x[0]), c[1] + a * (c[1] - S[2].x[1])];
    const fr = obj(rf);
    if (fr < S[0].fx) {
      const ex = [c[0] + g * (rf[0] - c[0]), c[1] + g * (rf[1] - c[1])]; const fe = obj(ex);
      S[2] = fe < fr ? { x: ex, fx: fe } : { x: rf, fx: fr }; continue;
    }
    if (fr < S[1].fx) { S[2] = { x: rf, fx: fr }; continue; }
    let cx;
    if (fr < S[2].fx) cx = [c[0] + r * (rf[0] - c[0]), c[1] + r * (rf[1] - c[1])];
    else cx = [c[0] - r * (c[0] - S[2].x[0]), c[1] - r * (c[1] - S[2].x[1])];
    const fc = obj(cx);
    if (fc < S[2].fx) { S[2] = { x: cx, fx: fc }; continue; }
    S[1] = { x: [S[0].x[0] + s * (S[1].x[0] - S[0].x[0]), S[0].x[1] + s * (S[1].x[1] - S[0].x[1])], fx: 0 }; S[1].fx = obj(S[1].x);
    S[2] = { x: [S[0].x[0] + s * (S[2].x[0] - S[0].x[0]), S[0].x[1] + s * (S[2].x[1] - S[0].x[1])], fx: 0 }; S[2].fx = obj(S[2].x);
  }
  S.sort((p, q) => p.fx - q.fx);
  return S[0];
}

// xlo/xhi/axisIsLog come from the track config. slopeHint in the mode's slope
// units. Returns { srtX, slope, degenerate }.
function fitMLE(cfg, xs, ys, slopeHint) {
  const A = cfg.A, axisIsLog = cfg.axisIsLog;
  let sum = 0; for (let i = 0; i < ys.length; i++) sum += ys[i];
  if (sum === 0 || sum === ys.length) {
    let mx = 0; for (let j = 0; j < xs.length; j++) mx += xs[j]; mx /= xs.length;
    return { srtX: mx, slope: slopeHint, degenerate: true };
  }
  const sorted = xs.slice().sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)];
  const res = nelderMead(p => negLL(p, xs, ys, A, axisIsLog),
    [med, slopeHint], [(axisIsLog ? 0.1 : 2), 8], 500, 1e-8);
  return {
    srtX: Math.max(cfg.xlo, Math.min(cfg.xhi, res.x[0])),
    slope: Math.max(1, Math.min(1000, res.x[1])),
    degenerate: false
  };
}

// --- Online track state machine ----------------------------------------------
// cfg (from adaptiveConfig, resolved to internal x units):
//   { procedure, A, target, xlo, xhi, axisIsLog, harder,
//     startX, nTrials,
//     workDown, workUp, initDown, initUp, switchRev,   // WUDR
//     a1slope,                                          // A1
//     a2slope, pLow, pHigh, a2Doubling, minStep,        // A2
//     slopeHint }
//
// Contract:
//   currentCutoffHz()   -> Hz for the CURRENT (pending) trial
//   currentX()          -> internal x for the current trial
//   update(correct)     -> record response, advance one step
//   estimate()          -> { thresholdHz, srtX, slope, degenerate }
//   trials()            -> number of responses recorded so far
//   done()              -> trials() >= nTrials
//   history()           -> [{ x, cutoffHz, correct }]
function createTrack(cfg) {
  const clampX = (x) => Math.max(cfg.xlo, Math.min(cfg.xhi, x));
  const xToHz = (x) => cfg.axisIsLog ? Math.pow(10, x) : x;

  const xs = [], ys = [];
  const harder = cfg.harder ?? -1;
  const minStep = cfg.minStep ?? 0.01;

  // --- WUDR two-phase state ---
  let x = clampX(cfg.startX);
  let rev = 0, prevDir = 0;

  // --- A1 state ---
  let prevDelta = 0;

  // --- A2 state: two interleaved sub-tracks + a precomputed interleaver ---
  let A2 = null;
  if (cfg.procedure === "a2") {
    const floor = 1.0 / cfg.A;
    const openOf = (pc) => (pc - floor) / (1 - floor);
    A2 = {
      floor, openOf,
      T: [
        { pTarget: cfg.pLow,  x: clampX(cfg.startX), rev: 0, prevDelta: 0, iter: 0,
          xs: [], ys: [], isExtreme: (openOf(cfg.pLow)  <= 0.2) || (openOf(cfg.pLow)  >= 0.8) },
        { pTarget: cfg.pHigh, x: clampX(cfg.startX), rev: 0, prevDelta: 0, iter: 0,
          xs: [], ys: [], isExtreme: (openOf(cfg.pHigh) <= 0.2) || (openOf(cfg.pHigh) >= 0.8) }
      ],
      order: buildInterleaver(cfg.nTrials),
      trial: 0
    };
  }

  function buildInterleaver(n) {
    // Balanced shuffled pairs of track ids 0/1 (Durstenfeld on [0,1] per pair),
    // trimmed to exactly n — verbatim from runA2.
    const order = [];
    for (let pair = 0; pair < Math.ceil(n / 2); pair++) {
      const two = [0, 1];
      for (let k = two.length - 1; k > 0; k--) {
        const j = Math.floor(Math.random() * (k + 1));
        const tmp = two[k]; two[k] = two[j]; two[j] = tmp;
      }
      order.push(two[0], two[1]);
    }
    return order.slice(0, n);
  }

  function currentX() {
    if (cfg.procedure === "a2") {
      const t = A2.T[A2.order[A2.trial]];
      return clampX(t.x);
    }
    return clampX(x);
  }

  function currentValue() { return xToHz(currentX()); }   // Hz (LPF) or dB (quiet)
  function currentCutoffHz() { return currentValue(); }   // LPF-friendly alias

  function update(correct) {
    const y = correct ? 1 : 0;

    if (cfg.procedure === "wudr") {
      const cx = clampX(x);
      xs.push(cx); ys.push(y);
      // initial steps until MORE than switchRev reversals (the reversal that
      // reaches switchRev still uses initial steps) — verbatim.
      const hasInit = (typeof cfg.initDown === "number" && typeof cfg.initUp === "number" && cfg.switchRev > 0);
      const useInit = hasInit && (rev <= cfg.switchRev);
      const dn = useInit ? cfg.initDown : cfg.workDown;
      const upp = useInit ? cfg.initUp : cfg.workUp;
      const step = (y === 1 ? harder * dn : -harder * upp);
      const dir = Math.sign(step);
      if (xs.length > 1 && dir !== 0 && prevDir !== 0 && dir !== prevDir) rev++;
      if (dir !== 0) prevDir = dir;
      x = cx + step;

    } else if (cfg.procedure === "a1") {
      const cx = clampX(x);
      xs.push(cx); ys.push(y);
      const phi = BK_A * Math.pow(BK_B, -rev);
      let delta = (phi * (y - cfg.target)) / cfg.a1slope;
      if (delta !== 0 && Math.abs(delta) < minStep) delta = Math.sign(delta) * minStep;
      if (xs.length > 1 && !((prevDelta > 0 && delta > 0) || (prevDelta < 0 && delta < 0))) rev++;
      prevDelta = delta;
      x = cx + harder * delta;

    } else { // a2
      const t = A2.T[A2.order[A2.trial]];
      t.x = clampX(t.x);
      t.xs.push(t.x); t.ys.push(y);
      xs.push(t.x); ys.push(y);

      const phi = BK_A * Math.pow(BK_B, -t.rev);
      let delta = (phi * (y - t.pTarget)) / cfg.a2slope;
      if (delta !== 0 && Math.abs(delta) < minStep) delta = Math.sign(delta) * minStep;

      // B&K step-doubling near an extreme sweet point (verbatim).
      const pOpenTarget = A2.openOf(t.pTarget);
      const resultOpen = A2.openOf(y);
      const outside = (pOpenTarget <= 0.2 && resultOpen < 0.2) ||
                      (pOpenTarget >= 0.8 && resultOpen > 0.8);
      const fast = Math.abs(delta) > 0.5;
      const move = (cfg.a2Doubling && t.isExtreme && outside && fast) ? 2 * delta : delta;

      if (t.iter >= 1 && !((t.prevDelta > 0 && delta > 0) || (t.prevDelta < 0 && delta < 0))) t.rev++;
      t.prevDelta = delta; t.iter++;
      t.x = t.x + harder * move;
      A2.trial++;
    }
  }

  function estimate() {
    const fit = fitMLE(cfg, xs.slice(), ys.slice(), cfg.slopeHint);
    const value = xToHz(fit.srtX);
    return {
      srtX: fit.srtX,
      slope: fit.slope,
      degenerate: fit.degenerate,
      value,                    // Hz (LPF) or dB (quiet)
      unit: cfg.unit,
      thresholdHz: value,       // LPF-friendly alias
      thresholdValue: value
    };
  }

  function history() {
    return xs.map((xi, i) => ({ x: xi, value: xToHz(xi), cutoffHz: xToHz(xi), correct: ys[i] === 1 }));
  }

  return {
    currentX, currentValue, currentCutoffHz, update, estimate,
    unit: cfg.unit, mode: cfg.mode, axisIsLog: cfg.axisIsLog,
    trials: () => xs.length,
    done: () => xs.length >= cfg.nTrials,
    history,
    reversals: () => (cfg.procedure === "a2" ? (A2.T[0].rev + A2.T[1].rev) : rev)
  };
}

// Resolve an adaptiveConfig record (from AdaptiveConfig) + a resolved start
// value (Hz for LPF, dB for quiet) into the internal cfg the track consumes.
// Mode-aware: LPF uses a log10(Hz) axis, quiet uses a linear dB axis.
function resolveTrackConfig(adaptive, startValue) {
  const axisIsLog = adaptive.axisIsLog !== false && adaptive.mode !== "quiet";
  const toX = axisIsLog ? (v) => Math.log10(v) : (v) => v;
  const defStart = startValue
    || adaptive.startValue
    || (axisIsLog ? (adaptive.startCutoffHz || 1000) : (adaptive.start || 65));
  return {
    mode: adaptive.mode || (axisIsLog ? "lpf" : "quiet"),
    procedure: adaptive.procedure || "wudr",
    A: adaptive.A || 4,
    target: adaptive.target ?? midpointTarget(adaptive.A || 4),
    xlo: adaptive.xlo ?? (axisIsLog ? Math.log10(80) : 20),
    xhi: adaptive.xhi ?? (axisIsLog ? Math.log10(6000) : 85),
    axisIsLog,
    unit: adaptive.unit || (axisIsLog ? "Hz" : "dB"),
    harder: -1,
    startX: toX(defStart),
    nTrials: adaptive.nTrials || 33,
    workDown: adaptive.workDown, workUp: adaptive.workUp,
    initDown: adaptive.initDown, initUp: adaptive.initUp,
    switchRev: adaptive.switchRev,
    a1slope: adaptive.a1slope ?? (axisIsLog ? 10 : 0.10),
    a2slope: adaptive.a2slope ?? (axisIsLog ? 10 : 0.10),
    pLow: adaptive.pLow ?? 0.40, pHigh: adaptive.pHigh ?? 0.85,
    a2Doubling: adaptive.a2Doubling !== false,
    minStep: adaptive.minStep ?? (axisIsLog ? 0.01 : 0.25),
    slopeHint: adaptive.slopeHint ?? (axisIsLog ? 43 : 6)
  };
}

if (typeof window !== "undefined") {
  window.Adaptive = {
    createTrack, resolveTrackConfig, fitMLE, midpointTarget,
    intelligibility, slopeToK
  };
}

{
  createTrack, resolveTrackConfig, fitMLE, midpointTarget,
  intelligibility, slopeToK
};


// --- ui.js ---
// File: ui.js

const screens = Array.from(document.querySelectorAll(".screen"));

function showScreen(id) {
  screens.forEach(s => s.style.display = "none");
  const target = document.getElementById(id);
  if (target) target.style.display = "block";
}

function adjustImageSize() {
  const rowGap = 12;
  const colGap = 12;
  const padding = 20; // buffer from edges

  const availableWidth = window.innerWidth - colGap - padding * 2;
  const availableHeight = window.innerHeight - rowGap - padding * 2;

  const squareSize = Math.min(availableWidth / 2, availableHeight / 2);

  optImgs.forEach(img => {
    img.style.width = `${squareSize}px`;
    img.style.height = `${squareSize}px`;
  });

  trainingImg.style.width = `${squareSize}px`;
  trainingImg.style.height = `${squareSize}px`;
  trainingImg.style.objectFit = "contain";
  trainingImg.style.margin = "0 auto";
  trainingImg.style.display = "block";
}


function showInstructions(phase, onContinue) {
  const title = phase === "training" ? "Training Instructions" : "Test Instructions";
  const text = config.instructions?.[phase] || "(No instructions found)";

  document.getElementById("instructions-title").textContent = title;
  document.getElementById("instructions-text").textContent = text;

  showScreen("instructions");

  const okBtn = document.querySelector("#instructions button:last-of-type");
  const handler = () => {
    okBtn.removeEventListener("click", handler);
    onContinue();
  };
  okBtn.addEventListener("click", handler);
}


// --- setImage.js ---
// File: setImage.js

function setImage(imgElement, name, useArrows = true) {
  // 🔍 Validate the name before using it
  if (typeof name !== "string" || !name.trim()) {
    console.warn("⚠️ setImage called with bad name:", name, imgElement);
    imgElement.removeAttribute("src"); // or point to a known placeholder if you prefer
    return;
  }

  const base = `images/${name}`;
  const fallback = `${base}.jpg`;
  const arrow = `${base}_arrow.jpg`;

  imgElement.src = (useArrows && config.arrows && arrowSet.has(name))
    ? arrow
    : fallback;

  // Optional: improve accessibility
  imgElement.alt = name;
}


// --- flow.js ---
// File: flow.js


let trainingAborted = false;

// Active adaptive track (test phase only). null => no adaptive tracking (plays
// unfiltered at a fixed level, e.g. training or a non-adaptive run).
let track = null;
let currentCutoffHz = null;   // pending trial's adaptive value (Hz LPF / dB quiet)
let quietStartLevel = null;   // quiet-mode start level (dB), for uncalibrated relative gain

let lastBreakAt = -1;  // remember the index where we last stopped for a break

const isNonEmpty = v => typeof v === "string" && v.trim().length > 0;
const warn = (...args) => console.warn(...args);

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

let nextImagesToPreload = [];

function beginPhase(p) {
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

      // Start value: Hz (LPF) or dB (quiet). Relative start shifts the start by
      // octaves (LPF) or dB (quiet); with no prior in-session threshold it
      // resolves against the absolute start for now (documented).
      let startVal = isQuiet
        ? (adaptive.startValue ?? adaptive.start ?? 65)
        : (adaptive.startValue ?? adaptive.startCutoffHz ?? 1000);
      if (adaptive.startMode === "relative" && isFinite(adaptive.startRelOctaves)) {
        startVal = isQuiet
          ? startVal + adaptive.startRelOctaves               // dB shift
          : startVal * Math.pow(2, adaptive.startRelOctaves); // octave shift
      }

      quietStartLevel = isQuiet ? startVal : null;
      const trackCfg = resolveTrackConfig(adaptive, startVal);
      track = createTrack(trackCfg);
      currentCutoffHz = track.currentValue();
      showScreen("test");
      nextTrial();
    }
  });
}

function showTrainingItem() {
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

function nextTrial() {
	
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
  const adaptive = (config && config.adaptive) ? config.adaptive : {};
  const isQuiet = (phase === "test" && track) ? adaptive.mode === "quiet" : false;
  const calibrated = (typeof Calibration !== "undefined" && Calibration.isCalibrated && Calibration.isCalibrated());

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
    // LPF mode (or non-adaptive): filter at the cutoff; fixed-level gain.
    cutoffHz = (phase === "test" && track) ? currentCutoffHz : null;
    if (calibrated) {
      extraGainDb = Calibration.gainDbForLevel(Calibration.state().currentSliderDb);
    }
  }

  AudioEngine.playStimulus(item.correct, `sounds/${item.audioFile}`, {
    cutoffHz,
    extraGainDb,
    routing: (config && config.routing) || "binaural",
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

function recordResponse(img) {
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
    const unit = track.unit || (adaptive.mode === "quiet" ? "dB" : "Hz");
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
function finalEstimate() {
  return track ? track.estimate() : null;
}
function activeTrack() { return track; }

function abortTraining() {
  trainingAborted = true;
}


// --- list.js ---
// File: list.js (non-module)
async function loadList() {
  function parseLines(text, sourceLabel) {
    const lines = text.trim().split(/\r?\n/);
    const rows = lines.map((line, i) => {
      // Split to exactly 6 fields, trim each, and validate
      const parts = line.split(/\t/).map(s => (s ?? "").trim());
      if (parts.length !== 6 || parts.some(p => !p)) {
        console.warn(`[!] Bad list row skipped @ line ${i + 1} (${sourceLabel}):`, line);
        return null;
      }
      const [a, b, c, d, correct, audioFile] = parts;
      return { images: [a, b, c, d], correct, audioFile };
    }).filter(Boolean);

    if (rows.length === 0) {
      console.error(`[X] No valid rows parsed from ${sourceLabel}.`);
    }
    return rows;
  }

  if (location.protocol === "file:") {
    const fallback = document.getElementById("list-fallback");
    if (!fallback) {
      alert("Local fallback list not found in page.");
      throw new Error("Missing <script id='list-fallback'> element");
    }
    const raw = fallback.textContent || "";
    const rows = parseLines(raw, "inline fallback");
    list.length = 0;
    list.push(...rows);
    console.warn("[pkg] Loaded inline fallback list (file://)");
  } else {
    try {
      const txt = await fetch("UC4AFC_lists.txt").then(r => r.text());
      const rows = parseLines(txt, "UC4AFC_lists.txt");
      list.length = 0;
      list.push(...rows);
      console.log("[OK] Loaded list from UC4AFC_lists.txt");
    } catch (err) {
      console.error("[X] Failed to load UC4AFC_lists.txt:", err);
      alert("Failed to load stimulus list.");
    }
  }

  // [OK] All assets are preloaded via preloadAllAssets() in main.js
}


// --- preload.js ---
/**
 * Preload all images and sounds listed in preloadfilelist.txt
 * Falls back to hardcoded list in file:// mode.
 */

async function preloadAllAssets() {
  let assetList = [];

  const isLocal = location.protocol === "file:";

  if (isLocal) {
    // [wip] Fallback list for local mode
assetList = [
  "images/bag.jpg",
  "images/back.jpg",
  "images/bat.jpg",
  "images/bed.jpg",
  "images/bike.jpg",
  "images/bat_backup.jpg",
  "images/beak.jpg",
  "images/bite.jpg",
  "images/bird.jpg",
  "images/bin.jpg",
  "images/book.jpg",
  "images/beach.jpg",
  "images/boat.jpg",
  "images/beak_arrow.jpg",
  "images/boot.jpg",
  "images/bug.jpg",
  "images/cage.jpg",
  "images/cake.jpg",
  "images/cap.jpg",
  "images/cat.jpg",
  "images/card.jpg",
  "images/ball.jpg",
  "images/chalk.jpg",
  "images/chin.jpg",
  "images/chin_arrow.jpg",
  "images/chip.jpg",
  "images/bone.jpg",
  "images/bus.jpg",
  "images/bell.jpg",
  "images/coat.jpg",
  "images/comb.jpg",
  "images/cone.jpg",
  "images/cot.jpg",
  "images/dad.jpg",
  "images/dad_arrow.jpg",
  "images/dirt.jpg",
  "images/dog.jpg",
  "images/fan.jpg",
  "images/duck.jpg",
  "images/feet.jpg",
  "images/fork.jpg",
  "images/gate.jpg",
  "images/goat.jpg",
  "images/hat.jpg",
  "images/hall.jpg",
  "images/head.jpg",
  "images/heart.jpg",
  "images/hen.jpg",
  "images/hood_arrow.jpg",
  "images/house.jpg",
  "images/hut.jpg",
  "images/hood.jpg",
  "images/keys.jpg",
  "images/hug.jpg",
  "images/kite.jpg",
  "images/king.jpg",
  "images/knees.jpg",
  "images/knees_arrow.jpg",
  "images/leaf.jpg",
  "images/knife.jpg",
  "images/leg.jpg",
  "images/lick.jpg",
  "images/light.jpg",
  "images/lock.jpg",
  "images/lock_arrow.jpg",
  "images/log.jpg",
  "images/man.jpg",
  "images/meat.jpg",
  "images/mop.jpg",
  "images/mouse.jpg",
  "images/mouth.jpg",
  "images/mum.jpg",
  "images/mum_arrow.jpg",
  "images/night.jpg",
  "images/nose.jpg",
  "images/nose_arrow.jpg",
  "images/note.jpg",
  "images/note_arrow.jpg",
  "images/nurse.jpg",
  "images/nurse_backup.jpg",
  "images/nut.jpg",
  "images/page_arrow.jpg",
  "images/page.jpg",
  "images/park.jpg",
  "images/pan.jpg",
  "images/peach.jpg",
  "images/pen.jpg",
  "images/pig.jpg",
  "images/purse.jpg",
  "images/road.jpg",
  "images/rock.jpg",
  "images/rose.jpg",
  "images/rug.jpg",
  "images/sack.jpg",
  "images/sad.jpg",
  "images/seed.jpg",
  "images/seed_arrow.jpg",
  "images/sheep.jpg",
  "images/shark.jpg",
  "images/shell.jpg",
  "images/shirt.jpg",
  "images/ship.jpg",
  "images/shop.jpg",
  "images/sock.jpg",
  "images/soup.jpg",
  "images/suit.jpg",
  "images/sword.jpg",
  "images/tongue.jpg",
  "images/tap.jpg",
  "images/tongue_arrow.jpg",
  "images/van.jpg",
  "images/zip.jpg",
  "sounds/back.mp3",
  "sounds/ball.mp3",
  "sounds/bat.mp3",
  "sounds/bed.mp3",
  "sounds/bell.mp3",
  "sounds/bin.mp3",
  "sounds/beach.mp3",
  "sounds/bird.mp3",
  "sounds/bone.mp3",
  "sounds/book.mp3",
  "sounds/boot.mp3",
  "sounds/bike.mp3",
  "sounds/bus.mp3",
  "sounds/bug.mp3",
  "sounds/cage.mp3",
  "sounds/beak.mp3",
  "sounds/cake.mp3",
  "sounds/calib.mp3",
  "sounds/card.mp3",
  "sounds/boat.mp3",
  "sounds/chalk.mp3",
  "sounds/cat.mp3",
  "sounds/cap.mp3",
  "sounds/chin.mp3",
  "sounds/bag.mp3",
  "sounds/chip.mp3",
  "sounds/bite.mp3",
  "sounds/coat.mp3",
  "sounds/comb.mp3",
  "sounds/cone.mp3",
  "sounds/cot.mp3",
  "sounds/dad.mp3",
  "sounds/dirt.mp3",
  "sounds/dog.mp3",
  "sounds/duck.mp3",
  "sounds/fan.mp3",
  "sounds/feet.mp3",
  "sounds/gate.mp3",
  "sounds/fork.mp3",
  "sounds/goat.mp3",
  "sounds/hall.mp3",
  "sounds/hat.mp3",
  "sounds/heart.mp3",
  "sounds/head.mp3",
  "sounds/hood.mp3",
  "sounds/hen.mp3",
  "sounds/house.mp3",
  "sounds/hug.mp3",
  "sounds/hut.mp3",
  "sounds/keys.mp3",
  "sounds/king.mp3",
  "sounds/kite.mp3",
  "sounds/knees.mp3",
  "sounds/knife.mp3",
  "sounds/leaf.mp3",
  "sounds/leg.mp3",
  "sounds/light.mp3",
  "sounds/lock.mp3",
  "sounds/lick.mp3",
  "sounds/man.mp3",
  "sounds/meat.mp3",
  "sounds/mop.mp3",
  "sounds/mouse.mp3",
  "sounds/log.mp3",
  "sounds/mum.mp3",
  "sounds/mouth.mp3",
  "sounds/night.mp3",
  "sounds/nose.mp3",
  "sounds/note.mp3",
  "sounds/nurse.mp3",
  "sounds/nut.mp3",
  "sounds/pan.mp3",
  "sounds/page.mp3",
  "sounds/park.mp3",
  "sounds/peach.mp3",
  "sounds/pen.mp3",
  "sounds/pig.mp3",
  "sounds/purse.mp3",
  "sounds/road.mp3",
  "sounds/rock.mp3",
  "sounds/rose.mp3",
  "sounds/rug.mp3",
  "sounds/sack.mp3",
  "sounds/sad.mp3",
  "sounds/seed.mp3",
  "sounds/shark.mp3",
  "sounds/sheep.mp3",
  "sounds/ship.mp3",
  "sounds/shell.mp3",
  "sounds/shirt.mp3",
  "sounds/shop.mp3",
  "sounds/sock.mp3",
  "sounds/soup.mp3",
  "sounds/suit.mp3",
  "sounds/sword.mp3",
  "sounds/tongue.mp3",
  "sounds/tap.mp3",
  "sounds/van.mp3",
  "sounds/zip.mp3"
];
    console.warn("[pkg] Using fallback preload asset list (file:// mode)");
  } else {
    try {
      const res = await fetch("preloadfilelist.txt");
      if (!res.ok) throw new Error(`Failed to fetch preloadfilelist.txt: ${res.status}`);
      const raw = await res.text();
      assetList = raw.split(/\r?\n/).filter(x => x.trim().length > 0);
    } catch (err) {
      console.error("[X] Failed to load preloadfilelist.txt:", err);
      return;
    }
  }

const tasks = assetList.map(src => () => {
  if (src.endsWith(".jpg")) return preloadImage(src);
  if (src.endsWith(".mp3")) return preloadStimulus(src);
  return Promise.resolve();
}).filter(Boolean);

console.log(`[pkg] Preloading ${tasks.length} assets...`);
await runWithConcurrency(tasks, 8); // keep this modest on mobile
console.log(`[OK] Finished preloading ${tasks.length} assets.`);

async function runWithConcurrency(fns, limit = 8) {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, fns.length) }, async () => {
    while (i < fns.length) await fns[i++]();
  });
  await Promise.all(workers);
}
}

function preloadImage(src, timeoutMs = 7000) {
  return new Promise((resolve) => {
    const img = new Image();
    let settled = false;

    const done = () => { if (!settled) { settled = true; clearTimeout(timer); resolve(); } };
    const timer = setTimeout(() => {
      console.warn(`[time] Image preload timed out: ${src}`);
      done();
    }, timeoutMs);

    img.onload = done;
    img.onerror = () => { console.warn(`[!] Failed to load image: ${src}`); done(); };
    img.src = src;

    // On some browsers, decode can resolve earlier/more reliably
    if (img.decode) {
      img.decode().then(done).catch(done);
    }
  });
}


function preloadSound(src, timeoutMs = 7000) {
  return new Promise((resolve) => {
    const audio = new Audio();
    let settled = false;

    const done = () => { if (!settled) { settled = true; clearTimeout(timer); resolve(); } };
    const timer = setTimeout(() => {
      console.warn(`[time] Sound preload timed out: ${src}`);
      done();
    }, timeoutMs);

    const once = (type) => audio.addEventListener(type, done, { once: true });
    once("canplaythrough");
    once("loadeddata");
    once("loadedmetadata");
    audio.addEventListener("error", () => { console.warn(`[!] Failed to load sound: ${src}`); done(); }, { once: true });

    audio.preload = "auto";
    audio.src = src;
    try { audio.load(); } catch (_) {}  // iOS: kick the fetch
  });
}


// Warm the network cache for a stimulus mp3. We deliberately do NOT call
// decodeAudioData here: at preload time the AudioContext is still suspended
// (it only unlocks on the Train/Start user gesture), and on many browsers
// decodeAudioData will not complete on a suspended context. Decoding is done
// lazily by the engine on first play, and the cache is warmed in the
// background after unlock (see warmDecodeCache below).
function preloadStimulus(src, timeoutMs = 7000) {
  return preloadSound(src, timeoutMs);
}

// Decode every stimulus into the engine cache AFTER the context is unlocked.
// Safe to call repeatedly; decode() is idempotent. Runs with modest
// concurrency so it doesn't jank the UI on mobile.
async function warmDecodeCache(soundFiles, limit = 4) {
  if (typeof AudioEngine === "undefined") return;
  const c = AudioEngine.context();
  if (c.state !== "running") return; // only after a user gesture unlocks audio

  const jobs = soundFiles.map(name => async () => {
    if (AudioEngine.isDecoded(name)) return;
    try { await AudioEngine.decode(name, `sounds/${name}.mp3`); }
    catch (err) { console.warn(`Deferred decode failed for ${name}`, err); }
  });

  let i = 0;
  const workers = Array.from({ length: Math.min(limit, jobs.length) }, async () => {
    while (i < jobs.length) await jobs[i++]();
  });
  await Promise.all(workers);
  console.log(`Decoded ${soundFiles.length} stimuli into the engine cache.`);
}


// Legacy startCalibration() stub removed — calibration is now handled by the
// calibration screen (calibration.js + AudioEngine.startCalibrationTone).


// --- results.js ---
// File: results.js

function saveResults(optionalNote = "") {
  const now = new Date();
  const timeStr = now.toISOString().replace(/[:.]/g, "-");

  const formatTime = (d) =>
    d.toLocaleString("en-NZ", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    });

  const startTimeFormatted = testStartedAt
    ? formatTime(testStartedAt)
    : "(unknown)";

  const jsonData = {
    participant,
    startedAt: testStartedAt?.toISOString() || null,
    timestamp: now.toISOString(),
    data: responseLog.slice(),
    adaptive: (config && config.adaptive && responseLog.some(r => typeof r.value === "number" || typeof r.cutoffHz === "number"))
      ? {
          config: config.adaptive,
          mode: (config.adaptive && config.adaptive.mode) || "lpf",
          routing: (config && config.routing) || "binaural",
          threshold: (() => {
            for (let i = responseLog.length - 1; i >= 0; i--) {
              const e = (typeof responseLog[i].estimate === "number") ? responseLog[i].estimate : responseLog[i].estimateHz;
              if (typeof e === "number") return e;
            }
            return null;
          })()
        }
      : undefined,
    note: optionalNote || undefined
  };

  // Detect an adaptive run (rows carry a value) and build a self-documenting
  // settings + threshold header, mirroring the Monte-Carlo export style.
  const isAdaptive = responseLog.some(r => typeof r.value === "number" || typeof r.cutoffHz === "number");
  const adaptiveCfg = (config && config.adaptive) ? config.adaptive : null;
  const mode = (adaptiveCfg && adaptiveCfg.mode) || "lpf";
  const unit = (mode === "quiet") ? "dB" : "Hz";
  const stepUnit = (mode === "quiet") ? "dB" : "dec";
  const valOf = (r) => (typeof r.value === "number" ? r.value : r.cutoffHz);
  const estOf = (r) => (typeof r.estimate === "number" ? r.estimate : r.estimateHz);
  const lastEstimate = (() => {
    for (let i = responseLog.length - 1; i >= 0; i--) {
      const e = estOf(responseLog[i]);
      if (typeof e === "number") return e;
    }
    return null;
  })();

  // --- Build .txt output
  const txtLines = [
    `# Participant\t${participant}`,
    `# test started at ${startTimeFormatted}`
  ];

  if (isAdaptive && adaptiveCfg) {
    const startShown = (mode === "quiet")
      ? (adaptiveCfg.startValue ?? adaptiveCfg.start ?? "")
      : (adaptiveCfg.startValue ?? adaptiveCfg.startCutoffHz ?? "");
    txtLines.push(
      `# Mode\t${mode}`,
      `# Procedure\t${adaptiveCfg.procedure}`,
      `# Alternatives\t${adaptiveCfg.A}`,
      `# Target\t${((adaptiveCfg.target ?? 0.625) * 100).toFixed(1)}%`,
      `# Start (${unit})\t${startShown}`,
      `# Trials\t${adaptiveCfg.nTrials}`,
      `# WUDR steps (${stepUnit}) work down/up\t${adaptiveCfg.workDown}/${adaptiveCfg.workUp}`,
      `# WUDR steps (${stepUnit}) init down/up\t${adaptiveCfg.initDown}/${adaptiveCfg.initUp}`,
      `# Switch after reversals\t${adaptiveCfg.switchRev}`,
      `# Routing\t${(config && config.routing) || "binaural"}`,
      `# Threshold estimate (${unit})\t${lastEstimate != null ? lastEstimate : "n/a"}`
    );
  }
  if (typeof Calibration !== "undefined" && Calibration.calibrationHeader) {
    txtLines.push(`# Calibration\t${Calibration.calibrationHeader()}`);
  }

  txtLines.push("");
  if (isAdaptive) {
    const valCol = (mode === "quiet") ? "Level_dB" : "Cutoff_Hz";
    const estCol = (mode === "quiet") ? "Estimate_dB" : "Estimate_Hz";
    txtLines.push(`Trial\tSound\tCorrect\tChosen\tCorrect?\t${valCol}\tProcedure\t${estCol}\tTime_ms`);
    for (const r of responseLog) {
      txtLines.push(
        `${r.index}\t${r.sound}\t${r.correct}\t${r.chosen}\t` +
        `${r.isCorrect ? 1 : 0}\t${valOf(r) ?? ""}\t${r.procedure ?? ""}\t${estOf(r) ?? ""}\t${r.timeMs}`
      );
    }
  } else {
    txtLines.push("Trial\tSound\tCorrect\tChosen\tTime_ms");
    for (const r of responseLog) {
      txtLines.push(`${r.index}\t${r.sound}\t${r.correct}\t${r.chosen}\t${r.timeMs}`);
    }
  }

  if (optionalNote) {
    txtLines.push("");
    txtLines.push(`# ${optionalNote}`);
  }

  // --- Save TXT
  const txtBlob = new Blob([txtLines.join("\n")], { type: "text/tab-separated-values" });
  const a1 = document.createElement("a");
  a1.href = URL.createObjectURL(txtBlob);
  a1.download = `UC4AFC_${participant}_${timeStr}.txt`;
  a1.click();

  // --- Save JSON if enabled
  const shouldSaveJson =
    config && typeof config.saveJson !== "undefined" ? config.saveJson : true;

  if (shouldSaveJson) {
    const jsonBlob = new Blob([JSON.stringify(jsonData, null, 2)], { type: "application/json" });
    const a2 = document.createElement("a");
    a2.href = URL.createObjectURL(jsonBlob);
    a2.download = `UC4AFC_${participant}_${timeStr}.json`;
    a2.click();
  } else {
    console.warn("[stop] Skipping JSON download due to config.saveJson = false");
  }

 // --- Show end screen
showScreen("thankyou");
document.getElementById("fileinfo").textContent =
  `Saved: UC4AFC_${participant}_${timeStr}.${shouldSaveJson ? "{txt,json}" : "txt"}`;

// Enable Save Again button
const saveAgainBtn = document.getElementById("saveAgainBtn");
if (saveAgainBtn) {
  saveAgainBtn.onclick = () => saveResults("manual re-save at " + new Date().toLocaleString());
}


  // Email (subject = filename; body = TXT contents)
  const emailBtn = document.getElementById("emailBtn");
  if (emailBtn) {
    const baseName = `UC4AFC_${participant}_${timeStr}`;
    const subject = `${baseName}.txt`;

    const txtContent = txtLines.join("\n");

    // Mailto size is limited — keep conservative
    const MAX_MAILTO_BODY = 1800;
    let body = txtContent;
    let truncated = false;
    if (body.length > MAX_MAILTO_BODY) {
      truncated = true;
      body = body.slice(0, MAX_MAILTO_BODY - 120)
        + `\n\n[...truncated...]\n(Full file saved locally as ${subject}${shouldSaveJson ? " and JSON." : "."})`;
    }

    // Optional default recipient via config.emailTo (add to config.json if you want)
    const to = (typeof config?.emailTo === "string" && config.emailTo.trim()) ? config.emailTo : "";
    const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    emailBtn.onclick = () => { location.href = mailto; };
    if (truncated) emailBtn.title = "Body truncated to fit email link limits";
  }
}

// --- main.js ---
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

// Finding 4: if the audio context came back at the wrong rate, calibrating now
// would set a silently wrong reference (on iOS, half speed + wrong level). Paint
// the warning where the operator will see it and report whether calibration is
// blocked. Returns true when a mismatch is present (caller must not proceed).
function calRateBlocked() {
  if (typeof AudioEngine === "undefined" || !AudioEngine.rateMismatch) return false;
  const m = AudioEngine.rateMismatch();
  const el = document.getElementById("calStatus");
  if (!m) return false;
  const halfSpeed = Math.abs(m.ratio - 2) < 0.01;
  if (el) el.textContent =
    `⚠ Audio is running at ${m.contextRate} Hz but the recordings are ` +
    `${m.assetRate} Hz. ` +
    (halfSpeed
      ? "This halves playback speed and makes the level wrong. Fully close the " +
        "app and reopen it (on iPhone/iPad, swipe it away from the app switcher first). "
      : "Playback speed and level may be wrong; try reopening the app. ") +
    "Calibration is disabled until this clears.";
  return true;
}

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
  // Both ends sit on the 5 dB grid now (Finding 5); make travel match the snap.
  slider.step = c.isCalibrated ? 5 : 0.1;
  // Clamp the starting position into the calibrated bounds so it can never open
  // below the floor or above the reference.
  let start = c.currentSliderDb ?? c.sliderMaxDb ?? 0;
  if (c.isCalibrated && Calibration.clampLevel) start = Calibration.clampLevel(start);
  slider.value = start;
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
    // Clamp to the calibrated bounds (Finding 5): never above the reference,
    // never below the recording floor.
    const snapped = Calibration.clampLevel ? Calibration.clampLevel(raw) : Math.round(raw / 5) * 5;
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

// Render the calibration screen for the currently-selected method: swap in the
// method's step list, show the per-channel ear selector only for audiometer, and
// keep the noise routed to the right channel(s). Audiometer calibration is done
// one channel at a time (handover §3); sound field uses a single meter at the
// head, so the ear selector is hidden and the noise plays to both.
function renderCalMethodUI() {
  if (typeof Calibration === "undefined") return;
  const sel = document.getElementById("calMethodSelect");
  const method = sel ? sel.value : Calibration.calMethod();
  Calibration.setMethod(method);
  const info = (Calibration.CAL_METHODS && Calibration.CAL_METHODS[method]) || null;

  const ol = document.getElementById("calSteps");
  if (ol && info) {
    ol.innerHTML = "";
    info.steps.forEach(s => { const li = document.createElement("li"); li.textContent = s; ol.appendChild(li); });
  }

  const perChannel = method === "audiometer";
  const earWrap = document.getElementById("calEarWrap");
  const earHint = document.getElementById("calEarHint");
  if (earWrap) earWrap.style.display = perChannel ? "" : "none";
  if (earHint) earHint.textContent = perChannel
    ? "Calibrate each channel separately: route to Left, set the aux gain, then Right."
    : "";
  const earSel = document.getElementById("calEarSelect");
  if (!perChannel && earSel) { earSel.value = "binaural"; }
}

// The ear currently selected for the (audiometer) calibration noise.
function currentCalEar() {
  const earSel = document.getElementById("calEarSelect");
  const method = document.getElementById("calMethodSelect");
  if (method && method.value !== "audiometer") return "binaural";
  return earSel ? earSel.value : "binaural";
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

  // Method selector: re-render steps/labels and (if noise is playing) keep it
  // routed correctly. Ear selector: re-route the running noise live so the
  // clinician can flip channels without restarting (handover §3).
  const methodSel = document.getElementById("calMethodSelect");
  const earSel = document.getElementById("calEarSelect");
  if (methodSel) {
    methodSel.value = (typeof Calibration !== "undefined") ? Calibration.calMethod() : "audiometer";
    methodSel.onchange = () => {
      renderCalMethodUI();
      if (toneOn) AudioEngine.setCalibrationEar(currentCalEar());
    };
  }
  if (earSel) {
    earSel.onchange = () => {
      if (typeof AudioEngine !== "undefined") AudioEngine.setCalibrationEar(currentCalEar());
      const el = document.getElementById("calStatus");
      if (toneOn && el) {
        const where = earSel.value === "left" ? "left channel only"
                    : earSel.value === "right" ? "right channel only" : "both channels";
        el.textContent = `Calibration noise playing — ${where}.`;
      }
    };
  }
  renderCalMethodUI();

  // Finding 6: read any stored calibration but DON'T activate it silently. A
  // stored figure asserts the device was at max volume when it was taken, which
  // can't be verified after the fact; and a stale one may no longer hold. Ask
  // the operator to confirm (with an explicit warning past the age threshold).
  if (typeof Calibration !== "undefined" && Calibration.readStored) {
    const rec = Calibration.readStored();
    if (rec) {
      const when = rec.timestamp
        ? new Date(rec.timestamp).toLocaleString("en-NZ", { dateStyle: "short", timeStyle: "short" })
        : "an earlier session";
      const age = rec.ageDays != null ? ` (${Math.round(rec.ageDays)} day(s) ago)` : "";
      const warn = rec.stale
        ? "\n\nThis calibration is old and may no longer be valid — re-calibrating is recommended."
        : "";
      const ok = window.confirm(
        `A stored calibration of ${rec.level} dB(A) from ${when}${age} was found.\n\n` +
        "Re-use it? It assumes the device volume is at maximum, exactly as when it " +
        "was measured. Choose Cancel to stay uncalibrated and measure again." + warn
      );
      if (ok && Calibration.confirmStored(rec)) {
        if (testBtn) testBtn.hidden = false;
        const msel = document.getElementById("calMethodSelect");
        if (msel && rec.method) { msel.value = rec.method; renderCalMethodUI(); }
        const el = document.getElementById("calStatus");
        const mlabel = Calibration.calMethod() === "audiometer" ? "audiometer" : "sound field";
        if (el) el.textContent =
          `Calibration in use: ${rec.level} dB(A) (${mlabel}) from ${when}. Device volume must be at maximum.`;
      }
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
      const method = methodSel ? methodSel.value : Calibration.calMethod();
      const promptLabel = method === "audiometer"
        ? "Enter the audiometer dial setting (in dB A):"
        : "Enter the measured level at the client's head (in dB A):";
      const measured = prompt(promptLabel);
      if (measured === null || measured === "" || isNaN(measured)) return;
      const level = parseFloat(measured);
      const ok = Calibration.applyCalibrationLevel(level, undefined, method);
      if (!ok) {
        const el = document.getElementById("calStatus");
        if (el) el.textContent =
          `${level} dB(A) is not a usable reference. Check the figure is ` +
          (method === "audiometer"
            ? "the audiometer dial setting"
            : "the meter reading at the client's position") +
          `, in dB(A). Staying uncalibrated.`;
        setupCalibrationSlider();
        return;
      }
      setupCalibrationSlider();
      if (testBtn) testBtn.hidden = false;
      refreshCalStatus();
      return;
    }

    await AudioEngine.resume();
    // resume() constructs the context, so the rate check is now populated.
    // Refuse to calibrate at the wrong rate (Finding 4).
    if (calRateBlocked()) return;
    // Stop any test playback first.
    AudioEngine.stopCalibrationTone();
    testOn = false;
    if (testBtn) testBtn.textContent = "Test level";
    alert("Turn your device volume all the way up, then tap OK to play the calibration noise.");
    try {
      const ear = currentCalEar();
      await AudioEngine.startCalibrationTone(CALIB_URL(), { ear });
      toneOn = true;
      toggleBtn.textContent = "Stop & Enter Level";
      toggleBtn.classList.add("active");
      const el = document.getElementById("calStatus");
      if (el) {
        const where = ear === "left" ? "left channel only"
                    : ear === "right" ? "right channel only" : "both channels";
        el.textContent = `Calibration noise playing — ${where}.`;
      }
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
      if (calRateBlocked()) return;
      const gainDb = Calibration.gainDbForLevel(Calibration.state().currentSliderDb);
      try {
        await AudioEngine.startCalibrationTone(CALIB_URL(), { extraGainDb: gainDb, ear: currentCalEar() });
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
  if (hint) hint.textContent = (mode === "quiet")
    ? "Adapts presentation level (dB). Uncalibrated runs are relative to the start level."
    : "Adapts the equivalent low-pass cutoff (Hz).";
}

// Relabel units and adjust input bounds/steps for the active mode.
function applyModeLabels(mode) {
  const isQuiet = (mode === "quiet");
  const stepUnit = isQuiet ? "dB" : "dec";
  const setText = (id, t) => { const el = document.getElementById(id); if (el) el.textContent = t; };
  setText("lblStart", isQuiet ? "Starting level (dB)" : "Starting cutoff (Hz)");
  setText("lblStartRel", isQuiet ? "Start (dB re threshold)" : "Start (octaves re threshold)");
  document.querySelectorAll(".lblStepUnit-wd").forEach(e => e.textContent = `Working down step (${stepUnit})`);
  document.querySelectorAll(".lblStepUnit-wu").forEach(e => e.textContent = `Working up step (${stepUnit})`);
  document.querySelectorAll(".lblStepUnit-id").forEach(e => e.textContent = `Initial down step (${stepUnit})`);
  document.querySelectorAll(".lblStepUnit-iu").forEach(e => e.textContent = `Initial up step (${stepUnit})`);

  // Start-cutoff input bounds/step per mode.
  const sc = document.getElementById("setStartCutoff");
  if (sc) {
    if (isQuiet) { sc.min = 20; sc.max = 85; sc.step = 1; }
    else { sc.min = 80; sc.max = 6000; sc.step = 10; }
  }
  // Step inputs coarser in quiet (dB) than LPF (decades).
  ["setWorkDown","setWorkUp","setInitDown","setInitUp"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.step = isQuiet ? 0.1 : 0.0001;
  });
  const wudrHint = document.getElementById("wudrHint");
  if (wudrHint) wudrHint.textContent = isQuiet
    ? "Quiet defaults: down 0.6 dB / up 1.0 dB (working); down 3 / up 5 (initial). 0 reversals = single-phase."
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
  set("setStartMode", cfg.startMode || "absolute");
  toggleStartMode(cfg.startMode || "absolute");
  set("setStartCutoff", isQuiet ? (cfg.startValue ?? cfg.start ?? 65) : (cfg.startValue ?? cfg.startCutoffHz ?? 1000));
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
  const sweet = (typeof AdaptiveConfig !== "undefined") ? AdaptiveConfig.sweetPointsFor(A) : { pLow: 0.40, pHigh: 0.85 };
  const midpoint = (typeof AdaptiveConfig !== "undefined") ? AdaptiveConfig.midpointTarget(A) : 0.625;
  const startVal = num("setStartCutoff", isQuiet ? 65 : 1000);

  return {
    mode: _setupMode,
    procedure: _setupProc,
    A,
    target: midpoint,
    axisIsLog: !isQuiet,
    unit: isQuiet ? "dB" : "Hz",
    stepUnit: isQuiet ? "dB" : "decades",
    slopeUnit: isQuiet ? "%/dB" : "%/octave",
    startMode: val("setStartMode") || "absolute",
    startValue: startVal,
    startCutoffHz: isQuiet ? undefined : startVal,  // LPF alias
    startRelOctaves: num("setStartRel", 0),
    nTrials: Math.max(1, Math.min(66, Math.round(num("setNTrials", 33)))),
    xlo: isQuiet ? 20 : Math.log10(80),
    xhi: isQuiet ? 85 : Math.log10(6000),
    workDown: num("setWorkDown", isQuiet ? 0.6 : 0.0212),
    workUp: num("setWorkUp", isQuiet ? 1.0 : 0.0348),
    initDown: num("setInitDown", isQuiet ? 3.0 : 0.0511),
    initUp: num("setInitUp", isQuiet ? 5.0 : 0.0822),
    switchRev: Math.max(0, Math.round(num("setSwitchRev", 5))),
    a1slope: num("setA1Slope", isQuiet ? 0.10 : 10),
    minStep: isQuiet ? 0.25 : 0.01,
    a2slope: num("setA2Slope", isQuiet ? 0.10 : 10),
    pLow: sweet.pLow,
    pHigh: sweet.pHigh,
    a2Doubling: !!(document.getElementById("setA2Doubling") || {}).checked,
    slopeHint: isQuiet ? 6 : 43,
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


