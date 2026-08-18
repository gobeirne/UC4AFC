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
export { AudioEngine, measureLUFS, butterworthLowpassSections, renderButterworthLowpass };
