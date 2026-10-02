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
let listId = "";        // "1" | "2" for Start/Training runs; "both" for normalisation

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
    console.warn("Running locally. Skipping fetch(config.json) and using fallback config.");
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
    console.log("[ok] Loaded config.json:", config);
  } catch (err) {
    console.error("Failed to load config.json:", err);
    console.warn("Could not load config.json. Using fallback config.");
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

// ---- Headphone-curve shaping for loudness MEASUREMENT (not playback) --------
// In-place iterative radix-2 complex FFT (n = power of two). inverse => scaled.
function fftInPlace(re, im, inverse = false) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (inverse ? 2 : -2) * Math.PI / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti;
        re[a] += tr; im[a] += ti;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}

// Curve [[Hz, dB], ...] -> dB at f: linear interpolation between points, held
// flat beyond the first/last point.
function curveDbAt(curve, f) {
  if (f <= curve[0][0]) return curve[0][1];
  const last = curve[curve.length - 1];
  if (f >= last[0]) return last[1];
  let lo = 0, hi = curve.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (curve[m][0] <= f) lo = m; else hi = m; }
  const [f0, d0] = curve[lo], [f1, d1] = curve[hi];
  return d0 + (d1 - d0) * (f - f0) / (f1 - f0);
}

// Mono (channel-averaged, as the K-weighting stage does) copy of a buffer with
// its magnitude spectrum multiplied by the curve — zero-phase, via one FFT of
// the whole signal zero-padded by >=100 ms. Returns an AudioBuffer-like object
// accepted by kWeightSignal.
function shapeByCurve(buffer, curve) {
  const sr = buffer.sampleRate, len = buffer.length, nCh = buffer.numberOfChannels;
  let n = 1; while (n < len + Math.round(0.1 * sr)) n <<= 1;
  const re = new Float64Array(n), im = new Float64Array(n);
  for (let ch = 0; ch < nCh; ch++) {
    const d = buffer.getChannelData(ch);
    for (let i = 0; i < len; i++) re[i] += d[i] / nCh;
  }
  fftInPlace(re, im);
  for (let k = 0; k <= n / 2; k++) {
    const g = Math.pow(10, curveDbAt(curve, k * sr / n) / 20);
    re[k] *= g; im[k] *= g;
    if (k > 0 && k < n / 2) { re[n - k] *= g; im[n - k] *= g; }
  }
  fftInPlace(re, im, true);
  const y = re.subarray(0, len);
  return { sampleRate: sr, numberOfChannels: 1, length: len, getChannelData: () => y };
}

// Momentary (max 400 ms, 25 ms hop) LUFS only — same definition measureLUFS uses.
function momentaryLUFSOf(bufferLike) {
  const kw = kWeightSignal(bufferLike);
  return Math.max(...blockPowersFromSignal(kw, bufferLike.sampleRate, 0.4, 0.025).map(powerToLUFS));
}

// ---- Headphone de-emphasis (equalise to a flat response at the ear) ---------
// A linear-phase FIR whose magnitude is 1/curve (the inverse of the headphone
// response), designed by frequency sampling on a dense grid (nfft), then
// windowed (Hann) to `taps`. Applied by LINEAR convolution with the centre tap
// aligned to t=0 (zero phase, no delay), so there is no wrap-around of filter
// tails — the problem whole-file FFT filtering has at the file edges.
// 8193 taps (171 ms @ 48 kHz): HD280 curve × this filter is flat within
// ±0.24 dB from 30 Hz to 22 kHz; energy beyond ±5 ms of centre is −50 dB.
const EQ_TAPS = 8193, EQ_NFFT = 65536;

function designEqFir(curve, sr, { taps = EQ_TAPS, nfft = EQ_NFFT, maxBoostDb = null } = {}) {
  const re = new Float64Array(nfft), im = new Float64Array(nfft);
  const cap = (maxBoostDb == null) ? Infinity : Math.pow(10, maxBoostDb / 20);
  for (let k = 0; k <= nfft / 2; k++) {
    const g = Math.min(cap, Math.pow(10, -curveDbAt(curve, k * sr / nfft) / 20));
    re[k] = g;
    if (k > 0 && k < nfft / 2) re[nfft - k] = g;
  }
  fftInPlace(re, im, true);                        // real, even impulse response
  const c = (taps - 1) / 2, h = new Float64Array(taps);
  for (let m = 0; m < taps; m++) {
    const n = ((m - c) % nfft + nfft) % nfft;
    h[m] = re[n] * (0.5 - 0.5 * Math.cos(2 * Math.PI * m / (taps - 1)));   // Hann
  }
  return h;
}

// Linear convolution via FFT, output aligned to the centre tap (zero phase) and
// the same length as the input.
function firConvolve(x, h) {
  const len = x.length, taps = h.length, c = (taps - 1) >> 1;
  let n = 1; while (n < len + taps - 1) n <<= 1;
  const xr = new Float64Array(n), xi = new Float64Array(n);
  const hr = new Float64Array(n), hi = new Float64Array(n);
  for (let i = 0; i < len; i++) xr[i] = x[i];
  hr.set(h);
  fftInPlace(xr, xi); fftInPlace(hr, hi);
  for (let k = 0; k < n; k++) {
    const r = xr[k] * hr[k] - xi[k] * hi[k];
    xi[k] = xr[k] * hi[k] + xi[k] * hr[k];
    xr[k] = r;
  }
  fftInPlace(xr, xi, true);
  const y = new Float32Array(len);
  for (let i = 0; i < len; i++) y[i] = xr[i + c];
  return y;
}

// A-weighting power (IEC 61672), unnormalised — only ratios are used.
function aWeightPow(f) {
  const f2 = f * f;
  const ra = (148693636 * f2 * f2) /
    ((f2 + 424.36) * Math.sqrt((f2 + 11599.29) * (f2 + 544496.41)) * (f2 + 148693636));
  return ra * ra;
}

// Level scale for the de-emphasis filter h so the calibration noise keeps the
// SAME A-weighted level at the ear: raw path = curve·noise (what was measured);
// equalised path = curve·h·noise. Welch power spectrum of the noise (16384-pt
// Hann, 50% overlap). Returns the linear gain to multiply h by.
function eqLevelScale(noiseBuf, curve, h) {
  const sr = noiseBuf.sampleRate, N = 16384, hop = N / 2;
  const x = noiseBuf.getChannelData(0), S = new Float64Array(N / 2 + 1);
  const w = new Float64Array(N);
  for (let i = 0; i < N; i++) w[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N);
  for (let start = 0; start + N <= x.length; start += hop) {
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let i = 0; i < N; i++) re[i] = x[start + i] * w[i];
    fftInPlace(re, im);
    for (let k = 0; k <= N / 2; k++) S[k] += re[k] * re[k] + im[k] * im[k];
  }
  // |H(f)|^2 of the designed filter on the same grid (h is shorter than N).
  const hr = new Float64Array(N), hi = new Float64Array(N);
  hr.set(h); fftInPlace(hr, hi);
  let pRaw = 0, pEq = 0;
  for (let k = 1; k <= N / 2; k++) {
    const f = k * sr / N;
    const cw = Math.pow(10, curveDbAt(curve, f) / 10) * aWeightPow(f) * S[k];
    pRaw += cw;
    pEq += cw * (hr[k] * hr[k] + hi[k] * hi[k]);
  }
  return Math.sqrt(pRaw / pEq);
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

// Fixed safety headroom for the SNR mix, applied EQUALLY to word and noise so
// the SNR ratio is never altered. Sized so that at 0 dB SNR a coherent sum of
// two equal peaks stays under full scale. The words are -22.5 LUFS with peaks
// well below 0 dBFS, so this also leaves room for moderate positive SNR before
// the word alone would approach full scale; extreme positive SNR is a clinical
// non-case (the word would be far above the masker). Not measured per trial.
const SNR_HEADROOM_DB = -6;

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
  // Active headphone preset (headphones.js). When it has a curve, the LPF
  // loudness match is computed on curve-shaped measurement copies.
  let hpId = "flat", hpCurve = null;
  const shapedRawLUFS = new Map();   // `${name}|${hpId}|${eq}` -> momentary LUFS of shaped raw word
  // De-emphasis (equalise the headphones to a flat response at the ear).
  let deemphOn = false, eqNoiseUrl = "sounds/noise.mp3", eqMaxBoostDb = null;
  let eq = null;                      // { key, h (level-scaled), scaleDb }
  let eqPending = null;
  const eqWordCache = new Map();      // `${name}|${eqKey}` -> equalised unfiltered result
  const eqNoiseCache = new Map();
  const noisePeakCache = new WeakMap();  // noise AudioBuffer -> true peak (dB), for the clip diagnostic     // `${url}|${eqKey}` -> equalised noise AudioBuffer
  function eqActive() { return deemphOn && !!hpCurve; }
  function eqTag() { return eqActive() ? `eq:${hpId}` : "raw"; }
  function setHeadphoneCurve(id, curve, { deemph = false, noiseUrl, maxBoostDb = null } = {}) {
    hpId = id || "flat";
    hpCurve = (Array.isArray(curve) && curve.length > 1) ? curve : null;
    deemphOn = !!deemph;
    if (noiseUrl) eqNoiseUrl = noiseUrl;
    eqMaxBoostDb = (maxBoostDb == null) ? null : Number(maxBoostDb);
    eq = null; eqPending = null;
    if (eqActive()) ensureEq().catch(err => console.warn("[eq] design failed:", err));  // warm up
  }
  // Design (once per preset + sample rate) and level-scale the de-emphasis FIR.
  async function ensureEq() {
    if (!eqActive()) return null;
    const sr = context().sampleRate, key = `${hpId}@${sr}`;
    if (eq && eq.key === key) return eq;
    if (eqPending && eqPending.key === key) return eqPending.p;
    const p = (async () => {
      const h = designEqFir(hpCurve, sr, { maxBoostDb: eqMaxBoostDb });
      const noise = await ensureCalibNoise(eqNoiseUrl);
      const g = eqLevelScale(noise.raw, hpCurve, h);
      for (let i = 0; i < h.length; i++) h[i] *= g;
      eq = { key, h, scaleDb: DB(g) };
      console.log(`[eq] ${hpId}: de-emphasis ready (${h.length} taps), level scale ${DB(g).toFixed(2)} dB`);
      return eq;
    })();
    eqPending = { key, p };
    return p;
  }
  function eqBuffer(buffer, h) {
    const c = context();
    const out = c.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      out.getChannelData(ch).set(firConvolve(buffer.getChannelData(ch), h));
    }
    return out;
  }
  // Noise for playback (SNR masker): equalised when de-emphasis is on.
  async function noiseForPlayback(url) {
    const noise = await ensureCalibNoise(url);
    if (!eqActive()) return noise.raw;
    const e = await ensureEq();
    const k = `${url}|${e.key}`;
    if (!eqNoiseCache.has(k)) eqNoiseCache.set(k, eqBuffer(noise.raw, e.h));
    return eqNoiseCache.get(k);
  }
  function eqInfo() {
    return { active: eqActive(), preset: hpId, scaleDb: eq ? eq.scaleDb : null,
             taps: eq ? eq.h.length : null, maxBoostDb: eqMaxBoostDb };
  }

  let activeSource = null;
  // In SNR mode a second source (looped calibration noise) plays alongside the
  // word. It is tracked separately so stop() can tear BOTH down — otherwise the
  // noise keeps looping after the word ends.
  let activeNoiseSource = null;

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
  // Decode one file (path like "sounds/nose.mp3") and cache raw buffer + its
  // unfiltered momentary LUFS (measured). Idempotent.
  async function decode(name, url) {
    if (cache.has(name)) return cache.get(name);
    const c = context();
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`decode fetch failed ${resp.status} for ${url}`);
    const arr = await resp.arrayBuffer();
    const raw = await c.decodeAudioData(arr);
    const momentary = measureLUFS(raw).momentary;
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

    // De-emphasis (if on) comes AFTER low-pass filtering and BEFORE the loudness
    // match, so filtered words are matched on what actually reaches the ear.
    const e = eqActive() ? await ensureEq() : null;

    if (cutoffHz == null) {
      if (!e) {
        return {
          buffer: entry.raw,
          preLUFS: entry.momentary,
          postLUFS: entry.momentary,
          matchGainDb: 0,
          truePeakDB: estimateTruePeakDB(entry.raw)
        };
      }
      const wk = `${name}|${e.key}`;
      if (!eqWordCache.has(wk)) {
        const buf = eqBuffer(entry.raw, e.h);
        eqWordCache.set(wk, { buffer: buf, preLUFS: null, postLUFS: null,
                              matchGainDb: 0, truePeakDB: estimateTruePeakDB(buf) });
      }
      return eqWordCache.get(wk);
    }

    const key = `${name}@${Math.round(cutoffHz)}@${hpId}@${eqTag()}`;
    if (filteredCache.has(key)) return filteredCache.get(key);

    const c = context();
    let filtered = await renderButterworthLowpass(c, entry.raw, cutoffHz);
    if (e) filtered = eqBuffer(filtered, e.h);
    // Loudness match: bring the filtered word back to the unfiltered word's
    // momentary LUFS. With a headphone curve, both are measured on copies shaped
    // by the curve, i.e. as they arrive at the ear through those headphones.
    let preLUFS, postLUFS;
    if (hpCurve) {
      const rk = `${name}|${hpId}|${eqTag()}`;
      if (!shapedRawLUFS.has(rk)) {
        const ref = e ? (await prepare(name, null)).buffer : entry.raw;   // equalised if on
        shapedRawLUFS.set(rk, momentaryLUFSOf(shapeByCurve(ref, hpCurve)));
      }
      preLUFS = shapedRawLUFS.get(rk);
      postLUFS = momentaryLUFSOf(shapeByCurve(filtered, hpCurve));
    } else {
      preLUFS = entry.momentary;
      postLUFS = measureLUFS(filtered).momentary;
    }
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
  // Output gain (calibration slider) in dB, applied after every stimulus.
  function masterDb() {
    return masterGain ? DB(masterGain.gain.value) : 0;
  }

  async function playStimulus(name, url, { cutoffHz = null, extraGainDb = 0, onStarted = null, routing = "binaural" } = {}) {
    if (!cache.has(name)) await decode(name, url);
    const prepared = await prepare(name, cutoffHz);

    // Per-presentation level diagnostic. The peak that reaches the output is
    // the played buffer's true peak (already post-filter and post loudness
    // make-up) plus the presentation gain and the master gain. Clipping is
    // only when THAT exceeds 0 dB FS — a positive gain on a quiet file is fine.
    const peakOut = prepared.truePeakDB + extraGainDb + masterDb();
    const tag = `[stim] ${name} · cutoff ${cutoffHz == null ? "none" : Math.round(cutoffHz) + " Hz"}` +
      ` · make-up ${prepared.matchGainDb.toFixed(1)} dB · gain ${extraGainDb.toFixed(1)} dB` +
      ` · output peak ${peakOut.toFixed(1)} dBFS`;
    if (peakOut > 0) console.warn(`${tag}  <-- CLIPS by ${peakOut.toFixed(1)} dB`);
    else console.log(tag);

    await playBuffer(prepared.buffer, { extraGainDb, onStarted, routing });
    return prepared;
  }

  // ---- SNR mode: word mixed with masking noise ----------------------------
  // The noise plays at the presentation level (noiseGainDb — the calibration
  // slider's level, or unity + device volume when uncalibrated) and does NOT
  // move with SNR. The word is offset from the noise by snrDb, so a lower SNR =
  // quieter word, noise unchanged.
  //
  // dB RATIO — no measurement, ever:
  //   The files are pinned at source: every word is -22.5 LUFS and the noise's
  //   mean dB(A) equals the words' average momentary dB(A). So at equal gain the
  //   ratio is already correct and 0 dB SNR just means "same gain on both". This
  //   function only ADDS dB and SCALES; it does not measure or re-match levels.
  //   A single fixed headroom offset (SNR_HEADROOM_DB) is applied EQUALLY to
  //   word and noise so the ratio is untouched but the 0-dB-SNR coherent sum
  //   can't clip.
  //
  // Noise segment:
  //   * The noise file is 10 s. Rather than loop it (audible seam, same slice
  //     every time), we take a CONTIGUOUS segment from a RANDOM offset inside
  //     the file, long enough to cover the word plus both pads, guaranteed not
  //     to run off the end (offset ∈ [0, fileLen − segmentLen]).
  //   * The segment starts `noiseLeadSec` before the word's audible onset and
  //     ends `noiseTrailSec` after the word ends. Both adjustable in Setup
  //     (config.snrNoiseLeadMs / snrNoiseTrailMs) to line the noise up with the
  //     actual speech onset inside each file.
  //   * The noise ramps in and out over `rampSec` (100 ms) so onset/offset are
  //     click-free.
  async function playStimulusWithNoise(name, url, {
    snrDb = 0,
    noiseGainDb = 0,
    noiseUrl = "sounds/noise.mp3",
    routing = "binaural",
    onStarted = null,
    noiseLeadSec = 0.6,     // noise starts this far BEFORE the word's audible onset
    noiseTrailSec = 0.6,    // noise ends this far AFTER the word ends
    wordLeadSec = 0.6,      // leading silence inside the word file (audible onset)
    rampSec = 0.1,          // noise fade in/out
    headroomDb = SNR_HEADROOM_DB   // fixed safety offset applied equally to both
  } = {}) {
    const c = context();
    stop(); // one trial at a time — tears down any prior word AND noise

    if (!cache.has(name)) await decode(name, url);
    const prepared = await prepare(name, null);      // SNR mode never filters
    const wordBuf = prepared.buffer;
    const noiseBuf = await noiseForPlayback(noiseUrl);   // equalised if de-emphasis is on

    // --- Levels: NO measurement, NO per-file re-matching. --------------------
    // The files are already pinned at source: every word is -22.5 LUFS and the
    // noise's mean dB(A) equals the words' average momentary dB(A). So at equal
    // gain the two already sit in the correct ratio, and 0 dB SNR = play both at
    // the same gain. We only ever ADD dB and SCALE — never measure.
    //
    //   noise gain = noiseGainDb            (the presentation/output level)
    //   word  gain = noiseGainDb + snrDb    (word offset from noise by the SNR)
    //
    // headroomDb is a FIXED safety offset (default SNR_HEADROOM_DB) applied
    // EQUALLY to both, so the SNR ratio is untouched; it only keeps the 0-dB-SNR
    // coherent sum below full scale. Overridable via config.snrHeadroomDb.
    const noiLin = LIN(noiseGainDb + headroomDb);
    const sigLin = LIN(noiseGainDb + snrDb + headroomDb);

    // Per-presentation level diagnostic (conservative): worst case is the two
    // true peaks adding coherently. Warn only; the sound plays unchanged.
    {
      const m = LIN(masterDb());
      if (!noisePeakCache.has(noiseBuf)) noisePeakCache.set(noiseBuf, estimateTruePeakDB(noiseBuf));
      const sum = (LIN(estimateTruePeakDB(wordBuf)) * sigLin +
                   LIN(noisePeakCache.get(noiseBuf)) * noiLin) * m;
      const sumDb = DB(sum);
      const tag = `[snr] ${name} · SNR ${snrDb.toFixed(1)} dB · noise gain ${noiseGainDb.toFixed(1)} dB` +
        ` · worst-case output peak ${sumDb.toFixed(1)} dBFS`;
      if (sum > 1) console.warn(`${tag}  <-- may CLIP by up to ${sumDb.toFixed(1)} dB`);
      else console.log(tag);
    }

    // --- Timing: place the word, then wrap the noise segment around it --------
    const now = c.currentTime;
    const t0 = now + 0.05;                              // small lead to arm nodes
    const wordDur = wordBuf.duration;
    const audibleOnset = Math.min(Math.max(0, wordLeadSec), wordDur);

    // Noise window in transport time.
    const lead  = Math.max(0, noiseLeadSec);
    const trail = Math.max(0, noiseTrailSec);
    const noiseStartAt = t0 + audibleOnset - lead;      // may be < t0 (leads word)
    const wordEnd      = t0 + wordDur;
    let   noiseDur     = (wordEnd + trail) - noiseStartAt;
    // Guard: never negative, never longer than the noise file (so a random
    // offset always has room). Cap to the file length minus a tiny epsilon.
    const maxSeg = Math.max(0, noiseBuf.duration - 1e-3);
    if (noiseDur > maxSeg) noiseDur = maxSeg;
    if (noiseDur < 0) noiseDur = 0;

    // Random contiguous offset inside the 10 s file such that
    // [offset, offset + noiseDur] stays within the file. (Request: start between
    // 0 and fileLen - segmentLen.)
    const maxOffset = Math.max(0, noiseBuf.duration - noiseDur);
    const noiseOffset = Math.random() * maxOffset;

    // Build this trial's noise segment with the fades BAKED INTO THE SAMPLES
    // (raised-cosine, cos^2), then play it at a constant gain. Previously the
    // fade was AudioParam automation starting at the same instant as the source;
    // before the first automation event a gain sits at its default of 1.0, so if
    // a browser rendered the source's first sample one frame before the fade
    // began (timing rounding varies trial to trial), that sample played at full
    // level — an intermittent onset click. A baked fade starts at exactly 0
    // whatever the scheduling rounding.
    const nsr = noiseBuf.sampleRate;
    const segLen = Math.max(0, Math.round(noiseDur * nsr));
    const segStart = Math.min(Math.floor(noiseOffset * nsr), Math.max(0, noiseBuf.length - segLen));
    const rampN = Math.min(Math.round(Math.max(0, rampSec) * nsr), Math.floor(segLen / 2));
    const segBuf = segLen > 0 ? c.createBuffer(noiseBuf.numberOfChannels, segLen, nsr) : null;
    if (segBuf) {
      for (let ch = 0; ch < noiseBuf.numberOfChannels; ch++) {
        const src = noiseBuf.getChannelData(ch), dst = segBuf.getChannelData(ch);
        for (let i = 0; i < segLen; i++) dst[i] = src[segStart + i];
        for (let i = 0; i < rampN; i++) {
          const w = Math.sin(0.5 * Math.PI * i / rampN), g2 = w * w;   // cos^2 ramp: 0 -> 1
          dst[i] *= g2;
          dst[segLen - 1 - i] *= g2;
        }
      }
    }

    // Word source + gain.
    const wordSrc = c.createBufferSource();
    wordSrc.buffer = wordBuf;
    const wordGain = c.createGain();
    wordGain.gain.value = sigLin;
    wordSrc.connect(wordGain);
    makeEarRouter(c, wordGain, routing);

    // Noise source (NOT looped — a single random segment) + gain, ramped in/out.
    const noiseSrc = c.createBufferSource();
    if (segBuf) noiseSrc.buffer = segBuf;
    noiseSrc.loop = false;
    const noiseG = c.createGain();
    noiseG.gain.value = noiLin;                 // constant: fades are in the samples
    noiseSrc.connect(noiseG);
    makeEarRouter(c, noiseG, routing);

    activeSource = wordSrc;
    activeNoiseSource = noiseSrc;

    const noiseStartClamped = Math.max(now, noiseStartAt);

    return new Promise((resolve, reject) => {
      wordSrc.onended = () => {
        if (activeSource === wordSrc) activeSource = null;
        resolve();
      };
      try {
        if (segBuf) {
          noiseSrc.start(noiseStartClamped);      // whole pre-faded segment
          noiseSrc.onended = () => {
            if (activeNoiseSource === noiseSrc) activeNoiseSource = null;
            try { noiseSrc.disconnect(); } catch (_) {}
          };
        }
        wordSrc.start(t0);
        if (onStarted) requestAnimationFrame(() => onStarted());
      } catch (err) {
        if (activeSource === wordSrc) activeSource = null;
        if (activeNoiseSource === noiseSrc) activeNoiseSource = null;
        reject(err);
      }
    }).then(() => prepared);
  }

  function stop() {
    if (activeSource) {
      try { activeSource.onended = null; activeSource.stop(); } catch (_) {}
      try { activeSource.disconnect(); } catch (_) {}
      activeSource = null;
    }
    if (activeNoiseSource) {
      try { activeNoiseSource.onended = null; activeNoiseSource.stop(); } catch (_) {}
      try { activeNoiseSource.disconnect(); } catch (_) {}
      activeNoiseSource = null;
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
  let calibGain = null;   // the running cal tone's gain node, for live level changes
  const CALIB_KEY = "__calib__";

  // Decode + cache an audio asset (idempotent), keyed BY URL. Used by both the
  // calibration tone (calibration_UC4AFC_1kHz.mp3 — a 1 kHz sine, looped in the
  // cal routine) and the SNR mix path (noise.mp3 — speech-shaped noise). These are
  // now distinct files with different content, so keying the cache by URL is what
  // lets them coexist instead of the first-fetched one winning a shared slot.
  //
  // No LUFS measurement: the presentation level is set by the calibration gain
  // (audiometer dial / device volume) and the word-to-noise ratio is fixed at
  // source, so nothing here needs the file's measured loudness. `momentary` is
  // left null for the one informational caller (startCalibrationTone).
  async function ensureCalibNoise(url = "sounds/noise.mp3") {
    const c = context();
    const key = `${CALIB_KEY}:${url}`;
    let entry = cache.get(key);
    if (!entry) {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`noise fetch failed ${resp.status} for ${url}`);
      const raw = await c.decodeAudioData(await resp.arrayBuffer());
      entry = { raw, momentary: null };
      cache.set(key, entry);
    }
    return entry;
  }

  async function startCalibrationTone(url = "sounds/calibration_UC4AFC_1kHz.mp3", { onStarted = null, extraGainDb = 0, ear = "binaural" } = {}) {
    const c = context();
    stopCalibrationTone();

    // Decode + cache the calibration file (idempotent).
    const entry = await ensureCalibNoise(url);

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
    calibGain = g;
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
    calibGain = null;
  }

  // Live-set the running calibration tone's level (dB, relative to unity/reference)
  // so moving the Test-output slider changes what's heard in real time. A short
  // ramp avoids clicks. No-op if nothing is playing.
  function setCalibrationGainDb(db) {
    if (!calibGain) return;
    const c = context();
    const target = LIN(Number(db) || 0);
    try {
      calibGain.gain.cancelScheduledValues(c.currentTime);
      calibGain.gain.setTargetAtTime(target, c.currentTime, 0.015);
    } catch (_) {
      calibGain.gain.value = target;
    }
  }

  // Whether the calibration tone is currently playing (for the UI to decide
  // whether a slider move should update the live level).
  function isCalibrationTonePlaying() { return !!calibSource; }

  // Live re-route the running calibration tone to left / right / both, so the
  // clinician can flip channels without restarting. No-op if nothing is playing.
  function setCalibrationEar(ear) {
    if (calibRouter) calibRouter.setEar(ear === "left" || ear === "right" ? ear : "binaural");
  }

  return {
    // lifecycle
    context, resume,
    // assets
    decode, isDecoded,
    // pipeline
    prepare, measure: measureLUFS,
    butterworthSections: butterworthLowpassSections,
    applyBiquad,                       // exact per-section filter (for the verify tool)
    butterworthOrder: BUTTERWORTH_ORDER,
    // playback
    playBuffer, playStimulus, playStimulusWithNoise, stop, setMasterGainDb,
    // calibration
    startCalibrationTone, stopCalibrationTone, setCalibrationEar, setCalibrationGainDb, isCalibrationTonePlaying, ensureCalibNoise,
    // audio-graph diagnostics
    rateMismatch,
    // headphone preset (LPF loudness match on curve-shaped copies)
    setHeadphoneCurve, eqInfo,
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

// Storage is per headphone/soundcard preset (headphones.js): key
// "uc4afc_calibration:<presetId>". setProfile() switches the slot.
const CAL_KEY_BASE = "uc4afc_calibration";
let CAL_KEY = CAL_KEY_BASE;

// (A former 96 dB maximum-attenuation bound on the test slider was removed:
// playback is floating point, so attenuating a recording scales its own noise
// floor with it. At extreme attenuation only the output DAC's bit depth matters.)
// Lowest level offered on the calibration screen's test slider. Levels below
// 0 dB(A) are legitimate (below 20 µPa); -10 dB(A) is a practical bottom.
const ABSOLUTE_FLOOR_DBA = -10;
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
  measuredDbA: null,     // representative reference (max of dials) for bounds/displays
  source: null,          // where a sound-field level came from, if not a meter (e.g. a preset)
  dial: { left: null, right: null }, // per-ear audiometer dial settings (dB(A))
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
      "Play the 1 kHz tone to both channels and zero each audiometer input (A and B) to VU 0 off this one tone. Both channels are then referenced to the tone.",
      "Set the audiometer dial to the highest level you expect to present, plus a margin. Use at least 6 dB of margin if you will be masking.",
      "Stop the tone and enter that dial setting below."
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

// ── Per-ear calibration reference (ported from UC_CVCV) ────────────────────
// Audiometer calibration has an independent dial per channel (A/B → left/right),
// so a clinician can give one ear more headroom for asymmetric losses or masking.
// The reference for a given ear is:
//   • audiometer: cal.dial[ear] if set, else the other ear's dial, else measuredDbA
//   • sound-field: the single measuredDbA (one speaker/meter for both)
// `ear` is "left" | "right" | "binaural" | null/undefined. Binaural/unknown falls
// back to whichever dial is set (then the representative measuredDbA), matching
// CVCV: a single reference still serves both channels when the dials are equal.
function referenceDbA(ear) {
  if (!cal || !cal.isCalibrated) return null;
  if (calMethod() === "audiometer" && cal.dial && typeof cal.dial === "object") {
    const has = (v) => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));
    const side = (ear === "left" || ear === "right") ? ear : null;
    if (side && has(cal.dial[side])) return Number(cal.dial[side]);
    // No dial for this side (or binaural/unknown): fall back to the other side.
    const other = side === "left" ? "right" : (side === "right" ? "left" : null);
    if (other && has(cal.dial[other])) return Number(cal.dial[other]);
    // Binaural/unknown with both set: prefer left, then right.
    if (!side) {
      if (has(cal.dial.left)) return Number(cal.dial.left);
      if (has(cal.dial.right)) return Number(cal.dial.right);
    }
  }
  return cal.measuredDbA === null ? null : Number(cal.measuredDbA);
}

// Bounds for any dB(A) level that can be presented. null when uncalibrated (the
// dB FS path is a different quantity and is left alone). Ceiling = reference
// (unity — nothing louder can play without clipping); floor = reference minus
// the recording's dynamic range, but never below the physical floor of 0 dB(A).
// Both ends are placed ON the 5 dB grid (ceiling rounded DOWN, floor rounded UP)
// so every selectable position is genuinely inside the bounds. Optionally scoped
// to a specific ear's dial (audiometer per-channel). (Ported from UC_CVCV.)
function levelBounds(ear) {
  if (!cal.isCalibrated) return null;
  const reference = referenceDbA(ear);
  if (reference === null) return null;
  const max = Math.floor(reference / 5) * 5;
  const min = Math.ceil(ABSOLUTE_FLOOR_DBA / 5) * 5;
  return { reference, min, max, usable: min <= max, span: max - min };
}

// Snap to the grid, then hold inside the bounds. Uncalibrated → grid only
// (gain is unity anyway). This is the clamp the AUDIO PATH uses, not just the
// slider, so no out-of-range level can reach the gain maths. (UC_CVCV clampLevel.)
function clampLevel(value, ear) {
  const snapped = snap5(value);
  const b = levelBounds(ear);
  if (!b || !b.usable) return snapped;
  return Math.min(b.max, Math.max(b.min, snapped));
}

// Apply a measured calibration level: it becomes the reference and the slider
// ceiling; the floor is reference − recording dynamic range, floored at 0 dB(A),
// both ends on the 5 dB grid (Finding 5). Returns true on success. A figure that
// yields no usable range (below the physical floor — i.e. not a real dB(A) SPL)
// is refused and calibration stays off, rather than handing back a slider whose
// floor is negative.
function applyCalibrationLevel(level, timestamp = new Date().toISOString(), method, source = null) {
  const reference = Number(level);
  if (!Number.isFinite(reference)) return false;
  cal.source = source || null;

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

// Apply a dual-dial audiometer calibration. left/right are per-ear dial settings
// (either may be null → falls back to the other ear at use time via referenceDbA).
// The slider bounds use the higher of the two (widest headroom); the per-ear gain
// path picks the correct dial for each ear. (Ported from UC_CVCV applyCalibrationDials.)
function applyCalibrationDials(left, right, timestamp = new Date().toISOString(), method) {
  const isNum = (v) => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));
  const vals = [left, right].filter(isNum).map(Number);
  if (!vals.length) return false;
  const representative = Math.max(...vals);

  cal.method = method || "audiometer";
  cal.source = null;
  cal.dial = {
    left:  isNum(left)  ? Number(left)  : null,
    right: isNum(right) ? Number(right) : null
  };
  cal.measuredDbA = representative;   // for slider bounds & displays
  cal.timestamp = timestamp;
  cal.isCalibrated = true;

  const b = levelBounds();
  if (!b || !b.usable) {
    cal.isCalibrated = false;
    cal.measuredDbA = null;
    cal.dial = { left: null, right: null };
    return false;
  }
  cal.sliderMinDb = b.min;
  cal.sliderMaxDb = b.max;
  cal.currentSliderDb = b.max;
  persist();
  return true;
}
// Stimulus gain for a requested level: EXACTLY  level − reference  (dB), with
// no rounding and no clamping. (It used to snap the level to the calibration
// slider's 5 dB grid and cap at the highest grid step below the reference, which
// silently moved off-grid levels — 62 -> 60 — quantised calibrated quiet-mode
// tracking to 5 dB, and made levels between the top grid step and the reference
// unreachable.) A level above the reference means gain > 0 dB; whether that
// actually clips depends on the stimulus peak, and the audio engine warns per
// presentation when it does. The calibration screen's slider keeps its own
// 5 dB grid (clampLevel / levelBounds) — that is UI only.
function gainForLevel(levelDbA, ear) {
  return Math.pow(10, gainDbForLevel(levelDbA, ear) / 20);
}

// dB form, used by the engine's extraGainDb parameter. Optional `ear` selects the
// per-channel dial (audiometer); omit or "binaural" for the shared reference.
// Uncalibrated: 0 dB (unity).
function gainDbForLevel(levelDbA, ear) {
  const reference = referenceDbA(ear);
  const level = Number(levelDbA);
  if (cal.isCalibrated && reference !== null && Number.isFinite(level)) {
    return level - Number(reference);
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
  cal.source = null;
  cal.method = null;
  cal.measuredDbA = null;
  cal.dial = { left: null, right: null };
  cal.timestamp = null;
  cal.isCalibrated = false;
  cal.sliderMinDb = -100;
  cal.sliderMaxDb = 0;
  cal.currentSliderDb = 0;
  try { localStorage.removeItem(CAL_KEY); } catch (_) {}
}

// Switch to a preset's storage slot. In-memory calibration is reset (the caller
// restores the slot with loadStored/confirmStored). A calibration saved before
// presets existed is moved, once, into the first preset activated.
function setProfile(id) {
  const key = `${CAL_KEY_BASE}:${id}`;
  try {
    const legacy = localStorage.getItem(CAL_KEY_BASE);
    if (legacy) {
      if (!localStorage.getItem(key)) localStorage.setItem(key, legacy);
      localStorage.removeItem(CAL_KEY_BASE);
    }
  } catch (_) {}
  CAL_KEY = key;
  cal.method = null;
  cal.measuredDbA = null;
  cal.source = null;
  cal.dial = { left: null, right: null };
  cal.timestamp = null;
  cal.isCalibrated = false;
  cal.sliderMinDb = -100;
  cal.sliderMaxDb = 0;
  cal.currentSliderDb = 0;
}

function persist() {
  try {
    if (cal.method === "audiometer") {
      localStorage.setItem(CAL_KEY, JSON.stringify({
        dial: cal.dial, method: cal.method, timestamp: cal.timestamp
      }));
    } else {
      localStorage.setItem(CAL_KEY, JSON.stringify({
        level: cal.measuredDbA, timestamp: cal.timestamp, method: cal.method,
        source: cal.source || undefined
      }));
    }
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
    let ageDays = null, stale = false;
    if (data.timestamp) {
      const ms = Date.now() - new Date(data.timestamp).getTime();
      if (isFinite(ms)) { ageDays = ms / 86400000; stale = ageDays > CAL_STALE_DAYS; }
    }
    // Audiometer per-channel record: { dial:{left,right}, method, timestamp }.
    if (data.dial && typeof data.dial === "object") {
      const l = Number(data.dial.left), r = Number(data.dial.right);
      const lHas = data.dial.left != null && isFinite(l);
      const rHas = data.dial.right != null && isFinite(r);
      if (!lHas && !rHas) return null;
      const representative = Math.max(...[lHas ? l : -Infinity, rHas ? r : -Infinity].filter(isFinite));
      return {
        dial: { left: lHas ? l : null, right: rHas ? r : null },
        level: representative, timestamp: data.timestamp || null,
        method: data.method || "audiometer", ageDays, stale
      };
    }
    // Sound-field single-level record: { level, method, timestamp }.
    const level = Number(data.level);
    if (data.level == null || !isFinite(level)) return null;
    return { level, timestamp: data.timestamp || null, method: data.method || null,
             source: data.source || null, ageDays, stale };
  } catch (_) {
    return null;
  }
}

// Activate a previously-read stored calibration (called after the operator
// confirms). Returns true on success. Handles both per-channel (dial) and
// single-level (sound-field) records.
function confirmStored(rec) {
  if (!rec) return false;
  if (rec.dial && typeof rec.dial === "object" &&
      (isFinite(Number(rec.dial.left)) || isFinite(Number(rec.dial.right)))) {
    return applyCalibrationDials(
      isFinite(Number(rec.dial.left)) ? Number(rec.dial.left) : null,
      isFinite(Number(rec.dial.right)) ? Number(rec.dial.right) : null,
      rec.timestamp || undefined, rec.method || "audiometer");
  }
  if (!isFinite(Number(rec.level))) return false;
  return applyCalibrationLevel(Number(rec.level), rec.timestamp || undefined, rec.method || undefined,
    rec.source || null);
}

// Back-compat shim: some callers may still call loadStored(). It now only READS
// (never auto-activates), so nothing gets silently restored.
function loadStored() { return readStored(); }

// Header string for the results file. Audiometer reports both dials when they
// differ; sound-field reports the single measured level.
function calibrationHeader() {
  if (!cal.isCalibrated || cal.measuredDbA == null) return "not set";
  if (calMethod() === "audiometer") {
    const l = cal.dial ? cal.dial.left : null;
    const r = cal.dial ? cal.dial.right : null;
    const fmt = (v) => (v == null ? "—" : `${v}`);
    const dials = (l != null && r != null && l === r)
      ? `${l} dB(A)`
      : `L ${fmt(l)} / R ${fmt(r)} dB(A)`;
    return `${dials} — audiometer (aux input)`;
  }
  return `${cal.measuredDbA} dB(A) — sound field (${cal.source || "level meter"})`;
}

if (typeof window !== "undefined") {
  window.Calibration = {
    state, applyCalibrationLevel, applyCalibrationDials,
    gainForLevel, gainDbForLevel, referenceDbA,
    setCurrentSliderDb, isCalibrated, measuredDbA, clearCalibration,
    loadStored, readStored, confirmStored, calibrationHeader,
    levelBounds, clampLevel,
    calMethod, calMethodInfo, isPerChannel, setMethod,
    moreLevelAdvice, lessLevelAdvice, CAL_METHODS, setProfile
  };
}




// --- headphones.js ---
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
    // Measured (Verifit): 90.9 ± 0.9 dB(A), 6 measurements across 3 individuals.
    // Full volume: Windows, browser and X-Fi at max; enhancements/effects off.
    defaultCal: {
      level: 90.9,
      source: "built-in: Verifit, 90.9 ± 0.9 dB(A), 6 measurements, 3 individuals"
    }
  },

  hd280_ugreen: {
    label: "UGREEN UG-80154 + Sennheiser HD280 Pro",
    curve: HD280_CURVE,   // headphone-determined shape (measured via the X-Fi)
    // Measured (Verifit): 89.3 ± 1.1 dB(A), 5 measurements across 2 individuals.
    defaultCal: {
      level: 89.3,
      source: "built-in: Verifit, 89.3 ± 1.1 dB(A), 5 measurements, 2 individuals"
    }
  },

  sony_zx110_ugreen: {
    label: "UGREEN UG-80154 + Sony MDR-ZX110",
    curve: null,        // no frequency-response curve yet (LPF matching is flat)
    // Measured (Verifit): 82.9 ± 0.9 dB(A), 8 measurements across 3 individuals.
    defaultCal: {
      level: 82.9,
      source: "built-in: Verifit, 82.9 ± 0.9 dB(A), 8 measurements, 3 individuals"
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
    xlo: Math.log10(75), xhi: Math.log10(20000),  // floor 75 Hz (matches LabVIEW); ceiling 20 kHz (wide open)
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
    xlo: null, xhi: null,   // unbounded: the track goes wherever the listener takes it
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
    xlo: null, xhi: null,   // unbounded
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

  // Start
  startValue: PRESETS.lpf.start,     // Hz (LPF) or dB (quiet)
  startCutoffHz: 1000,        // back-compat alias for LPF start (Hz)

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
// preserving procedure/A/nTrials and A2 sweet points.
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
  // Strip the retired "relative start" fields from configs saved by older
  // builds; they have no Setup control and used to shift the start silently.
  delete cfg.startMode;
  delete cfg.startRelOctaves;
  // Axis bounds have no Setup control, so always take them from the mode preset
  // (a saved copy could be stale — e.g. the old 80 Hz LPF floor, now 75 Hz).
  const pm = PRESETS[cfg.mode] || PRESETS.lpf;
  cfg.xlo = pm.xlo; cfg.xhi = pm.xhi;
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
    total: () => cfg.nTrials,
    done: () => xs.length >= cfg.nTrials,
    history,
    reversals: () => (cfg.procedure === "a2" ? (A2.T[0].rev + A2.T[1].rev) : rev)
  };
}

// Resolve an adaptiveConfig record (from AdaptiveConfig) + a resolved start
// value (Hz for LPF, dB for quiet) into the internal cfg the track consumes.
// Mode-aware: LPF uses a log10(Hz) axis, quiet uses a linear dB axis.
function resolveTrackConfig(adaptive, startValue) {
  // Both quiet (dB level) and snr (dB SNR) are LINEAR-axis modes; only LPF is
  // log10(Hz). Anything not explicitly linear stays on the log axis (LPF).
  const linearMode = adaptive.mode === "quiet" || adaptive.mode === "snr";
  const axisIsLog = adaptive.axisIsLog !== false && !linearMode;
  const isSnr = adaptive.mode === "snr";
  const toX = axisIsLog ? (v) => Math.log10(v) : (v) => v;
  const defStart = (startValue != null ? startValue : undefined)
    ?? adaptive.startValue
    ?? (axisIsLog ? (adaptive.startCutoffHz || 1000) : (adaptive.start ?? (isSnr ? 2 : 65)));
  return {
    mode: adaptive.mode || (axisIsLog ? "lpf" : "quiet"),
    procedure: adaptive.procedure || "wudr",
    A: adaptive.A || 4,
    target: adaptive.target ?? midpointTarget(adaptive.A || 4),
    // LPF keeps its 75 Hz floor and 20 kHz ceiling (the filter can't be designed
    // at/above Nyquist). Quiet (dB level) and SNR (dB SNR) are unbounded — no
    // floor or ceiling on the track or on the threshold estimate.
    xlo: axisIsLog ? (adaptive.xlo ?? Math.log10(75)) : -Infinity,
    xhi: axisIsLog ? (adaptive.xhi ?? Math.log10(20000)) : Infinity,
    axisIsLog,
    unit: adaptive.unit || (axisIsLog ? "Hz" : (isSnr ? "dB SNR" : "dB")),
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


function showInstructions(phase, onContinue, onBack) {
  const title = phase === "training" ? "Training Instructions" : "Test Instructions";
  const text = config.instructions?.[phase] || "(No instructions found)";

  document.getElementById("instructions-title").textContent = title;
  document.getElementById("instructions-text").textContent = text;

  showScreen("instructions");

  // One OK/Back pair per showing. Assigning (not adding) the handlers replaces
  // any left over from an earlier showing, so e.g. Start -> Back -> Training
  // can't fire a stale Start handler on the next OK.
  const okBtn = document.getElementById("okBtn");
  const backBtn = document.getElementById("backBtn");
  const clear = () => { okBtn.onclick = null; backBtn.onclick = null; };
  okBtn.onclick = () => { clear(); onContinue(); };
  backBtn.onclick = () => { clear(); (onBack || (() => showScreen("intro")))(); };
}


// --- setImage.js ---
// File: setImage.js

function setImage(imgElement, name, useArrows = true) {
  // Validate the name before using it
  if (typeof name !== "string" || !name.trim()) {
    console.warn("setImage called with bad name:", name, imgElement);
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

  // Which word list (1 or 2) this Training/Start run uses, from the start screen.
  const sel = document.getElementById("listSelect");
  listId = (sel && (sel.value === "1" || sel.value === "2")) ? sel.value : "1";
  try { localStorage.setItem("uc4afc_list", listId); } catch (_) {}

  loadList(listId).then(() => {
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

      // Start value in the mode's own unit: Hz (LPF), dB level (quiet), dB SNR.
      // Exactly the Setup value — no hidden "relative" shift (that old feature
      // has no Setup control, so a stale saved value could silently move the
      // start, e.g. 1000 Hz -> 250 Hz while Setup still showed 1000).
      const startVal = isLinear
        ? (adaptive.startValue ?? adaptive.start ?? (isSnr ? 2 : 65))
        : (adaptive.startValue ?? adaptive.startCutoffHz ?? 1000);

      // quietStartLevel doubles as the uncalibrated relative-gain anchor for
      // BOTH linear modes (quiet's level and snr's noise level).
      quietStartLevel = isLinear ? startVal : null;
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
  // No break once the run is complete (e.g. 33 trials with breaks every 33).
  const finished = track ? track.done() : (trialIndex >= list.length);
  if (n > 0 && !finished && trialIndex > 0 && (trialIndex % n === 0) && lastBreakAt !== trialIndex) {
    lastBreakAt = trialIndex;

    // Progress: responses recorded vs. run total. Adaptive runs total nTrials.
    const total = (track && typeof track.total === "function" && isFinite(track.total()))
      ? track.total()
      : ((config && config.adaptive && isFinite(config.adaptive.nTrials))
          ? config.adaptive.nTrials
          : list.length);
    const done = Math.min(trialIndex, total);
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const txt = document.getElementById("breakProgressText");
    const bar = document.getElementById("breakProgressBar");
    if (txt) txt.textContent = `Done ${done} / ${total}  (${pct}%)`;
    if (bar) bar.style.width = `${pct}%`;

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
    const m = (config && config.adaptive && config.adaptive.mode) || "lpf";
    const u = m === "snr" ? "dB SNR" : m === "quiet" ? "dB" : "Hz";
    console.log(`[trial ${trialIndex + 1}] list ${listId} · ${m} value = ` +
      `${u === "Hz" ? Math.round(currentCutoffHz) : currentCutoffHz.toFixed(1)} ${u}`);
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
    // Same presentation as normalisation (constant.js csPlaySnr): the masker is
    // the SNR noise file (noise.mp3) at the Setup SNR noise level, and the word
    // sits snrDb above/below it. Previously this used config.calibFile, which is
    // the 1 kHz CALIBRATION TONE, and the calibration slider level.
    const noiseLevelSetting = Number(
      (config && config.adaptive && isFinite(config.adaptive.snrNoiseLevel))
        ? config.adaptive.snrNoiseLevel
        : (calibrated ? 65 : 0)
    );
    const noiseGainDb = calibrated
      ? Calibration.gainDbForLevel(noiseLevelSetting, routing)
      : noiseLevelSetting;             // dB re full scale; clipping is warned, not floored
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
      onStarted: () => { setTimeout(revealOptions, offset); }
    };
    if (config && isFinite(Number(config.snrHeadroomDb))) {
      snrOpts.headroomDb = Number(config.snrHeadroomDb);
    }

    AudioEngine.playStimulusWithNoise(item.correct, `sounds/${item.audioFile}`, snrOpts).catch(err => {
      console.error("SNR audio play failed:", err);
      if (!nextTrial._erroredOnce) {
        alert(`Audio failed to play. Check the noise file (${noiseUrl}) and autoplay settings.`);
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
      extraGainDb = Calibration.gainDbForLevel(level, routing);
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
      extraGainDb = Calibration.gainDbForLevel(lpfLevel, routing);
    } else {
      extraGainDb = lpfLevel;   // dB re full scale; clipping is warned (engine), not floored
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
function finalEstimate() {
  return track ? track.estimate() : null;
}
function activeTrack() { return track; }

function abortTraining() {
  trainingAborted = true;
}


// --- list.js ---
// File: list.js (non-module)
//
// loadList(which): which = "1" | "2" | "both" (default "both").
//   "1"/"2" -> UC4AFC_list01.txt / UC4AFC_list02.txt (33 words each).
//   "both"  -> list 1 + list 2 concatenated (66 words). Built from the two
//              list files rather than the old combined UC4AFC_lists.txt, which
//              was missing "chin" (65 rows).
// Offline (file://) uses the two inline <script type="text/plain"> blocks
// #list-fallback-1 and #list-fallback-2 in index.html.
async function loadList(which = "both") {
  function parseLines(text, sourceLabel) {
    const lines = text.trim().split(/\r?\n/);
    const rows = lines.map((line, i) => {
      // Split to exactly 6 fields, trim each, and validate
      const parts = line.split(/\t/).map(s => (s ?? "").trim());
      if (parts.length !== 6 || parts.some(p => !p)) {
        console.warn(`Bad list row skipped @ line ${i + 1} (${sourceLabel}):`, line);
        return null;
      }
      const [a, b, c, d, correct, audioFile] = parts;
      return { images: [a, b, c, d], correct, audioFile };
    }).filter(Boolean);

    if (rows.length === 0) {
      console.error(`No valid rows parsed from ${sourceLabel}.`);
    }
    return rows;
  }

  const ids = (which === "1" || which === "2") ? [which] : ["1", "2"];
  const rows = [];

  if (location.protocol === "file:") {
    for (const id of ids) {
      const el = document.getElementById(`list-fallback-${id}`);
      if (!el) {
        alert(`Local fallback list ${id} not found in page.`);
        throw new Error(`Missing <script id='list-fallback-${id}'> element`);
      }
      rows.push(...parseLines(el.textContent || "", `inline fallback list ${id}`));
    }
    console.warn(`Loaded inline fallback list(s) ${ids.join("+")} (file://)`);
  } else {
    try {
      for (const id of ids) {
        const file = `UC4AFC_list0${id}.txt`;
        const res = await fetch(file);
        if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
        rows.push(...parseLines(await res.text(), file));
      }
      console.log(`[ok] Loaded list(s) ${ids.join("+")}: ${rows.length} words`);
    } catch (err) {
      console.error("Failed to load stimulus list:", err);
      alert("Failed to load stimulus list.");
    }
  }

  if (rows.length) {
    list.length = 0;
    list.push(...rows);
  }

  // [ok] All assets are preloaded via preloadAllAssets() in main.js
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
    // Fallback list for local mode
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
  "sounds/calibration_UC4AFC_1kHz.mp3",
  "sounds/noise.mp3",
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
    console.warn("Using fallback preload asset list (file:// mode)");
  } else {
    try {
      const res = await fetch("preloadfilelist.txt");
      if (!res.ok) throw new Error(`Failed to fetch preloadfilelist.txt: ${res.status}`);
      const raw = await res.text();
      assetList = raw.split(/\r?\n/).filter(x => x.trim().length > 0);
    } catch (err) {
      console.error("Failed to load preloadfilelist.txt:", err);
      return;
    }
  }

const tasks = assetList.map(src => () => {
  if (src.endsWith(".jpg")) return preloadImage(src);
  if (src.endsWith(".mp3")) return preloadSound(src);
  return Promise.resolve();
}).filter(Boolean);

console.log(`Preloading ${tasks.length} assets...`);
await runWithConcurrency(tasks, 8); // keep this modest on mobile
console.log(`[ok] Finished preloading ${tasks.length} assets.`);

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
      console.warn(`Image preload timed out: ${src}`);
      done();
    }, timeoutMs);

    img.onload = done;
    img.onerror = () => { console.warn(`Failed to load image: ${src}`); done(); };
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
      console.warn(`Sound preload timed out: ${src}`);
      done();
    }, timeoutMs);

    const once = (type) => audio.addEventListener(type, done, { once: true });
    once("canplaythrough");
    once("loadeddata");
    once("loadedmetadata");
    audio.addEventListener("error", () => { console.warn(`Failed to load sound: ${src}`); done(); }, { once: true });

    audio.preload = "auto";
    audio.src = src;
    try { audio.load(); } catch (_) {}  // iOS: kick the fetch
  });
}



// --- constant.js ---
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
  // SNRs (dB), six points at equal 3 dB spacing — the log-domain analogue of the
  // LPF grid (SNR is already logarithmic). Anchored on McClelland's 2015 UCAMST
  // word-specific normalisation in matched steady noise (young normal-hearing,
  // closed-set, constant noise): word L_mid ≈ −18 to −8 dB, mean ≈ −13.6, slopes
  // ≈ 14%/dB. This grid brackets that whole range and samples one step beyond each
  // end (−20 and −5), so extreme words are still measured on both sides, and the
  // 3 dB step keeps ≥2 observations inside a typical transition for slope
  // estimation. 396 conditions/participant (66 × 6); ×2 repeats = 792.
  snr: [-20, -17, -14, -11, -8, -5],
  // LPF cutoffs (Hz), six log-spaced points (~0.58 octave apart) across 200–1500 Hz.
  // Chosen to bracket BOTH the historical closed-set and open-set per-word SRT
  // distributions (only weakly correlated, r≈0.31, so a word's new-foil threshold
  // could land anywhere in that combined range) AND to sample inside each word's
  // transition finely enough to estimate slope, not just SRT — a five-point grid
  // (~0.70 oct) can bracket a steep transition without an observation in it.
  // 396 presentations/participant at 2 repeats.
  lpf: [200, 300, 450, 675, 1000, 1500],
  repeats: 1,
  breakEvery: 40,
  easeIn: 20,
  mode: "snr",
  ear: "binaural"
};

// --- Module state -------------------------------------------------------------
const CS = {
  active: false,        // true while a run is in progress (guards handlers)
  mode: "snr",          // "snr" | "lpf"
  ear: "binaural",      // "left" | "right" | "binaural" (presentation routing)
  levels: [],           // numeric levels for the run (ascending in tables)
  repeats: 1,
  breakEvery: 40,
  easeIn: 20,
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
        easeIn: Number.isFinite(Number(o.easeIn)) ? Number(o.easeIn) : CS_DEFAULTS.easeIn,
        mode: (o.mode === "lpf" || o.mode === "snr") ? o.mode : CS_DEFAULTS.mode,
        ear: (o.ear === "left" || o.ear === "right" || o.ear === "binaural") ? o.ear : CS_DEFAULTS.ear
      };
    }
  } catch (_) {}
  return { repeats: CS_DEFAULTS.repeats, breakEvery: CS_DEFAULTS.breakEvery, easeIn: CS_DEFAULTS.easeIn, mode: CS_DEFAULTS.mode, ear: CS_DEFAULTS.ear };
}

function csSaveDefaults(mode, levels, repeats, breakEvery, ear, easeIn) {
  try {
    localStorage.setItem(CS_KEYS[mode], JSON.stringify(levels));
    localStorage.setItem(CS_KEYS.opts, JSON.stringify({ repeats, breakEvery, easeIn, mode, ear }));
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
  const ease = document.getElementById("csEaseIn");
  if (ease) ease.value = opts.easeIn;
  CS.ear = opts.ear;
  const earSeg = document.getElementById("csEarSegmented");
  if (earSeg) {
    earSeg.querySelectorAll(".seg-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.csear === CS.ear);
    });
  }
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
  // Normalisation always uses BOTH lists (66 words). A Training/Start run may
  // have left only List 1 or 2 in memory, so load both explicitly first.
  if (openBtn) openBtn.onclick = () => {
    showScreen("conststim");
    loadList("both").then(() => csPopulateForm());
  };

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

  // Ear/routing toggle: left / right / binaural.
  const earSeg = document.getElementById("csEarSegmented");
  if (earSeg) {
    earSeg.querySelectorAll(".seg-btn").forEach(btn => {
      btn.onclick = () => {
        const e = btn.dataset.csear;
        if (e === CS.ear) return;
        CS.ear = e;
        earSeg.querySelectorAll(".seg-btn").forEach(b =>
          b.classList.toggle("active", b === btn));
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
    const ease = Math.max(0, Math.round(Number(document.getElementById("csEaseIn").value) || 0));
    const ok = csSaveDefaults(CS.mode, levels, reps, brk, CS.ear, ease);
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
  const easeIn = Math.max(0, Math.round(Number(document.getElementById("csEaseIn").value) || 0));

  // Ascending order is what the tables use; keep a sorted copy for columns.
  CS.levels = levels.slice().sort((a, b) => a - b);
  CS.repeats = reps;
  CS.breakEvery = brk;
  CS.easeIn = easeIn;
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

  // Ease-in ramp: after shuffling, take the first `easeIn` presentations and
  // reorder THEM easiest -> hardest, leaving the remainder shuffled. In both
  // modes a HIGHER value is easier (higher SNR = clearer; higher LPF cutoff =
  // more speech passband), so easiest->hardest is descending by level. Ties
  // (same level, different word) keep their shuffled order — a stable sort on a
  // descending-level key. Clamped to the queue length.
  const n = Math.min(easeIn, CS.queue.length);
  if (n > 1) {
    const head = CS.queue.slice(0, n);
    // Stable descending sort by level (decorate-sort-undecorate to guarantee
    // stability across engines).
    head
      .map((t, i) => ({ t, i }))
      .sort((a, b) => (b.t.level - a.t.level) || (a.i - b.i))
      .forEach((o, k) => { CS.queue[k] = o.t; });
  }

  CS.pos = 0;
  CS._lastBreakAt = -1;
  CS.logRows = [];
  CS.presented = new Map();
  CS.correct = new Map();
  CS.active = true;

  // Unlock audio within this user gesture (iOS/Safari).
  if (typeof AudioEngine !== "undefined" && AudioEngine.resume) AudioEngine.resume().catch(() => {});

  // Ready step: show the test instructions and wait for the participant to
  // press OK, so the operator can hand the device over before anything plays.
  // Back cancels the run and returns to the normalisation screen.
  const go = () => {
    CS.startedAt = new Date();                 // the run starts when they press OK
    const abortBtn = document.getElementById("abortBtn");
    if (abortBtn && config && config.showAbortXOnTouchDevices !== false) {
      abortBtn.style.display = "block";       // the run's only escape
    }
    const run = () => { installOptHandlers(); showScreen("test"); csNextTrial(); };
    if (typeof AudioEngine !== "undefined" && AudioEngine.resume) {
      AudioEngine.resume().then(run).catch(run);
    } else {
      run();
    }
  };
  showInstructions("test", go, () => { CS.active = false; showScreen("conststim"); });
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
  if (CS.breakEvery > 0 && CS.pos > 0 && CS.pos < CS.queue.length &&   // no break at the very end
      (CS.pos % CS.breakEvery === 0) && CS._lastBreakAt !== CS.pos) {
    CS._lastBreakAt = CS.pos;
    // Progress: presentations done vs. the run total (queue length).
    const total = CS.queue.length;
    const done = Math.min(CS.pos, total);
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const txt = document.getElementById("breakProgressText");
    const bar = document.getElementById("breakProgressBar");
    if (txt) txt.textContent = `Done ${done} / ${total}  (${pct}%)`;
    if (bar) bar.style.width = `${pct}%`;
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
  const routing = (CS.ear === "left" || CS.ear === "right" || CS.ear === "binaural")
    ? CS.ear
    : ((config && config.routing) || "binaural");

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
    ? Calibration.gainDbForLevel(lpfLevel, routing)
    : lpfLevel;   // dB re full scale; clipping is warned (engine), not floored

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
    ? Calibration.gainDbForLevel(noiseLevelSetting, routing)
    : noiseLevelSetting;
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
  lines.push(`# Routing\t${CS.ear || (config && config.routing) || "binaural"}`);
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
  if (typeof Headphones !== "undefined") lines.push(`# Headphones\t${Headphones.header()}`);
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
      routing: CS.ear || (config && config.routing) || "binaural",
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
    // A constant-stimuli run's full text (three tables + log) essentially always
    // exceeds the mailto: limit, so hide the button rather than send a truncated
    // body. The .txt/.json are saved locally for the operator to attach.
    if (txt.length > MAX) {
      emailBtn.style.display = "none";
      emailBtn.onclick = null;
    } else {
      emailBtn.style.display = "";
      const to = (typeof config?.emailTo === "string" && config.emailTo.trim()) ? config.emailTo : "";
      const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(txt)}`;
      emailBtn.onclick = () => { location.href = mailto; };
    }
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



// --- verifyfilter.js ---
// File: verifyfilter.js
// -----------------------------------------------------------------------------
// LPF verification tool. Plots the frequency response of the EXACT filter the
// stimuli are passed through — AudioEngine.butterworthSections(fc, sr) built at
// the 48 kHz file rate, applied with AudioEngine.applyBiquad — so the corner
// frequency and slope can be confirmed against requirements.
//
// Two curves, overlaid:
//   • analytic  — |H(z)| of the same coefficient objects evaluated on the unit
//     circle (exact, smooth, instant);
//   • measured  — white noise pushed through the identical applyBiquad cascade,
//     magnitude at each probe frequency via the Goertzel algorithm, averaged
//     over n runs (fresh noise each run), resetting on any cutoff change.
//
// Unfiltered = 0 dB (each curve is normalised to its DC/passband level). The
// −3 dB point at the corner frequency is marked. "Copy TSV" exports
// freq / analytic_dB / measured_dB columns for Excel.
// -----------------------------------------------------------------------------

const VF = {
  sr: 48000,               // build the filter at the sound-file rate
  cutoff: 2000,
  averages: 100,
  freqs: [],               // probe frequencies (log-spaced)
  analyticDb: [],          // analytic response (dB)
  measuredDb: [],          // noise-measured response (dB)
  measuredAccum: [],       // running sum of linear magnitudes per freq
  measuredCount: 0,        // completed averaging runs
  running: false,          // an averaging pass is active
  cancel: false,           // set on slider change to abort the current pass
  noiseLen: 1 << 15        // 32768 samples per noise run (~0.68 s at 48 kHz)
};

// Frequency range shared by the probe grid, the plot x-axis, AND the slider.
// fMax is just under Nyquist at the 48 kHz build rate (same as the x-axis).
const VF_FMIN = 20;
const VF_FMAX = 48000 / 2 * 0.98;   // 23520 Hz
const VF_SLIDER_STEPS = 1000;       // slider positions across the log range

// Slider position (0..VF_SLIDER_STEPS) → frequency (Hz), logarithmic.
function vfPosToFreq(pos) {
  const t = Math.min(1, Math.max(0, pos / VF_SLIDER_STEPS));
  const lg = Math.log10(VF_FMIN) + t * (Math.log10(VF_FMAX) - Math.log10(VF_FMIN));
  return Math.pow(10, lg);
}
// Frequency (Hz) → slider position (0..VF_SLIDER_STEPS), logarithmic.
function vfFreqToPos(f) {
  const cl = Math.min(VF_FMAX, Math.max(VF_FMIN, Number(f) || VF_FMIN));
  const t = (Math.log10(cl) - Math.log10(VF_FMIN)) / (Math.log10(VF_FMAX) - Math.log10(VF_FMIN));
  return Math.round(t * VF_SLIDER_STEPS);
}
function vfClampFreq(f) {
  return Math.min(VF_FMAX, Math.max(VF_FMIN, Number(f)));
}

// Log-spaced probe frequencies from 20 Hz to just under Nyquist.
function vfBuildFreqs() {
  const fMin = VF_FMIN, fMax = VF_FMAX;
  const n = 240;
  const out = [];
  const logMin = Math.log10(fMin), logMax = Math.log10(fMax);
  for (let i = 0; i < n; i++) {
    out.push(Math.pow(10, logMin + (logMax - logMin) * i / (n - 1)));
  }
  return out;
}

// Analytic magnitude (linear) of one biquad at digital frequency w (rad/sample).
// H(z) = (b0 + b1 z^-1 + b2 z^-2) / (1 + a1 z^-1 + a2 z^-2), z = e^{jw}.
function vfBiquadMag(c, w) {
  const cos1 = Math.cos(w), sin1 = Math.sin(w);
  const cos2 = Math.cos(2 * w), sin2 = Math.sin(2 * w);
  const numRe = c.b0 + c.b1 * cos1 + c.b2 * cos2;
  const numIm = -(c.b1 * sin1 + c.b2 * sin2);
  const denRe = 1 + c.a1 * cos1 + c.a2 * cos2;
  const denIm = -(c.a1 * sin1 + c.a2 * sin2);
  const numMag = Math.hypot(numRe, numIm);
  const denMag = Math.hypot(denRe, denIm);
  return denMag === 0 ? 0 : numMag / denMag;
}

// Analytic cascade magnitude (product of section magnitudes) at frequency f Hz.
function vfAnalyticMag(sections, f) {
  const w = 2 * Math.PI * f / VF.sr;
  let m = 1;
  for (const c of sections) m *= vfBiquadMag(c, w);
  return m;
}

// Compute the analytic curve for the current cutoff, normalised to 0 dB at DC.
function vfComputeAnalytic() {
  const sections = AudioEngine.butterworthSections(VF.cutoff, VF.sr);
  // Reference = magnitude at DC (f→0). Butterworth LP is unity at DC by design,
  // but normalise anyway so the plot reads exactly 0 dB in the passband.
  const ref = vfAnalyticMag(sections, VF.freqs[0]); // 20 Hz ≈ DC for these fc
  VF.analyticDb = VF.freqs.map(f => {
    const m = vfAnalyticMag(sections, f);
    return 20 * Math.log10((m / ref) || 1e-12);
  });
}

// Goertzel magnitude of a real signal at normalised frequency k = f/sr (cycles
// per sample). Returns linear amplitude (peak) of that component.
function vfGoertzel(sig, f) {
  const w = 2 * Math.PI * f / VF.sr;
  const coeff = 2 * Math.cos(w);
  let s0 = 0, s1 = 0, s2 = 0;
  for (let i = 0; i < sig.length; i++) {
    s0 = sig[i] + coeff * s1 - s2;
    s2 = s1; s1 = s0;
  }
  // Magnitude of the DFT bin (not necessarily on-bin, but fine for a ratio).
  const re = s1 - s2 * Math.cos(w);
  const im = s2 * Math.sin(w);
  return (2 / sig.length) * Math.hypot(re, im);
}

// One averaging run: fresh white noise → identical applyBiquad cascade → measure
// input and output magnitude at each probe freq; accumulate output/input ratio.
function vfOneNoiseRun() {
  const sections = AudioEngine.butterworthSections(VF.cutoff, VF.sr);
  const n = VF.noiseLen;
  const noise = new Float64Array(n);
  for (let i = 0; i < n; i++) noise[i] = Math.random() * 2 - 1;

  let filtered = noise;
  for (const c of sections) filtered = AudioEngine.applyBiquad(filtered, c);

  for (let i = 0; i < VF.freqs.length; i++) {
    const f = VF.freqs[i];
    const inMag = vfGoertzel(noise, f);
    const outMag = vfGoertzel(filtered, f);
    const ratio = inMag > 1e-12 ? outMag / inMag : 0;
    VF.measuredAccum[i] += ratio;
  }
  VF.measuredCount++;
}

// Convert the accumulated measured ratios to a normalised dB curve.
function vfFinishMeasured() {
  if (VF.measuredCount === 0) { VF.measuredDb = VF.freqs.map(() => NaN); return; }
  const avg = VF.measuredAccum.map(s => s / VF.measuredCount);
  // Normalise to the passband: average the lowest-frequency ratios (well below fc).
  const passband = avg.filter((_, i) => VF.freqs[i] < VF.cutoff / 4);
  const ref = passband.length
    ? passband.reduce((a, b) => a + b, 0) / passband.length
    : avg[0];
  VF.measuredDb = avg.map(r => 20 * Math.log10((r / (ref || 1e-12)) || 1e-12));
}

// Run the averaging asynchronously so the UI stays responsive; abort if the
// cutoff changed (VF.cancel). Redraws periodically and at the end.
async function vfRunAveraging() {
  if (VF.running) { VF.cancel = true; await new Promise(r => setTimeout(r, 0)); }
  VF.cancel = false;
  VF.running = true;
  VF.measuredAccum = VF.freqs.map(() => 0);
  VF.measuredCount = 0;
  VF.measuredDb = VF.freqs.map(() => NaN);

  const target = Math.max(1, Math.min(1000, Math.round(VF.averages) || 100));
  const prog = document.getElementById("vfProgress");

  for (let run = 0; run < target; run++) {
    if (VF.cancel) { VF.running = false; return; }
    vfOneNoiseRun();
    // Redraw every few runs (and on the last) so the operator sees it converge.
    if (run % 5 === 4 || run === target - 1) {
      vfFinishMeasured();
      vfDraw();
      if (prog) prog.textContent = `Averaging noise: ${VF.measuredCount} / ${target}`;
      await new Promise(r => setTimeout(r, 0)); // yield to the event loop
    }
  }
  vfFinishMeasured();
  vfDraw();
  if (prog) prog.textContent = `Averaging complete (n = ${VF.measuredCount}).`;
  VF.running = false;
}

// ── Plot ────────────────────────────────────────────────────────────────────
function vfDraw() {
  const cv = document.getElementById("vfCanvas");
  if (!cv) return;
  const ctx = cv.getContext("2d");
  const W = cv.width, H = cv.height;
  const padL = 56, padR = 16, padT = 16, padB = 40;
  const plotW = W - padL - padR, plotH = H - padT - padB;

  const fMin = VF.freqs[0], fMax = VF.freqs[VF.freqs.length - 1];
  const dbMin = -80, dbMax = 6;
  const xOf = f => padL + (Math.log10(f) - Math.log10(fMin)) / (Math.log10(fMax) - Math.log10(fMin)) * plotW;
  const yOf = db => padT + (dbMax - db) / (dbMax - dbMin) * plotH;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);

  // Grid: vertical decade lines + 1-2-5 minors.
  ctx.strokeStyle = "#eee"; ctx.fillStyle = "#666"; ctx.font = "11px sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "top";
  for (let dec = 10; dec <= fMax; dec *= 10) {
    for (const mul of [1, 2, 5]) {
      const f = dec * mul;
      if (f < fMin || f > fMax) continue;
      const x = xOf(f);
      ctx.strokeStyle = mul === 1 ? "#ddd" : "#f1f1f1";
      ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, padT + plotH); ctx.stroke();
      if (mul === 1 || mul === 2 || mul === 5) {
        const lbl = f >= 1000 ? `${f / 1000}k` : `${f}`;
        ctx.fillText(lbl, x, padT + plotH + 4);
      }
    }
  }
  // Horizontal dB lines.
  ctx.textAlign = "right"; ctx.textBaseline = "middle";
  for (let db = dbMax; db >= dbMin; db -= 10) {
    const y = yOf(db);
    ctx.strokeStyle = db === 0 ? "#bbb" : "#eee";
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + plotW, y); ctx.stroke();
    ctx.fillStyle = "#666"; ctx.fillText(`${db}`, padL - 6, y);
  }
  // Axis titles.
  ctx.fillStyle = "#333"; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
  ctx.fillText("Frequency (Hz)", padL + plotW / 2, H - 2);
  ctx.save();
  ctx.translate(12, padT + plotH / 2); ctx.rotate(-Math.PI / 2);
  ctx.textBaseline = "top"; ctx.fillText("Magnitude (dB)", 0, 0);
  ctx.restore();

  // −3 dB horizontal reference + cutoff vertical marker.
  ctx.setLineDash([5, 4]); ctx.strokeStyle = "#c00";
  const y3 = yOf(-3);
  ctx.beginPath(); ctx.moveTo(padL, y3); ctx.lineTo(padL + plotW, y3); ctx.stroke();
  const xc = xOf(VF.cutoff);
  ctx.beginPath(); ctx.moveTo(xc, padT); ctx.lineTo(xc, padT + plotH); ctx.stroke();
  ctx.setLineDash([]);
  // −3 dB @ fc dot.
  ctx.fillStyle = "#c00";
  ctx.beginPath(); ctx.arc(xc, y3, 4, 0, 2 * Math.PI); ctx.fill();

  const plot = (arr, stroke, dashed) => {
    ctx.strokeStyle = stroke; ctx.lineWidth = 1.75;
    ctx.setLineDash(dashed ? [2, 3] : []);
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < VF.freqs.length; i++) {
      const db = arr[i];
      if (!isFinite(db)) { started = false; continue; }
      const x = xOf(VF.freqs[i]), y = yOf(Math.max(dbMin, Math.min(dbMax, db)));
      if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    }
    ctx.stroke(); ctx.setLineDash([]);
  };

  // Analytic (smooth blue line).
  if (VF.analyticDb.length) plot(VF.analyticDb, "#06c", false);
  // Measured (green dots).
  if (VF.measuredDb.length && VF.measuredCount > 0) {
    ctx.fillStyle = "#0a0";
    for (let i = 0; i < VF.freqs.length; i++) {
      const db = VF.measuredDb[i];
      if (!isFinite(db)) continue;
      const x = xOf(VF.freqs[i]), y = yOf(Math.max(dbMin, Math.min(dbMax, db)));
      ctx.beginPath(); ctx.arc(x, y, 1.6, 0, 2 * Math.PI); ctx.fill();
    }
  }

  // Legend.
  ctx.font = "12px sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
  ctx.fillStyle = "#06c"; ctx.fillRect(padL + 8, padT + 10, 14, 3);
  ctx.fillStyle = "#333"; ctx.fillText("analytic", padL + 26, padT + 11);
  ctx.fillStyle = "#0a0"; ctx.beginPath(); ctx.arc(padL + 100, padT + 11, 3, 0, 2 * Math.PI); ctx.fill();
  ctx.fillStyle = "#333"; ctx.fillText("noise-measured", padL + 108, padT + 11);
}

// Interpolate the analytic dB at exactly fc for the readout.
function vfAnalyticAtCutoff() {
  const sections = AudioEngine.butterworthSections(VF.cutoff, VF.sr);
  const ref = vfAnalyticMag(sections, VF.freqs[0]);
  const m = vfAnalyticMag(sections, VF.cutoff);
  return 20 * Math.log10((m / ref) || 1e-12);
}

// Estimate the rolloff slope (dB/octave) from the analytic curve. Measured from
// fc to 2·fc — just into the stopband, where a 10th-order Butterworth is at its
// −60 dB/oct asymptote. (Further out the bilinear transform steepens it toward
// Nyquist; nearer fc the knee is still rounding — so fc→2fc is the fair place to
// read the nominal slope.)
function vfSlopeDbPerOct() {
  const sections = AudioEngine.butterworthSections(VF.cutoff, VF.sr);
  const ref = vfAnalyticMag(sections, VF.freqs[0]);
  const f1 = VF.cutoff, f2 = VF.cutoff * 2;
  if (f2 >= VF.sr / 2) return null;
  const db1 = 20 * Math.log10(vfAnalyticMag(sections, f1) / ref);
  const db2 = 20 * Math.log10(vfAnalyticMag(sections, f2) / ref);
  return (db2 - db1); // one octave apart → dB/oct
}

// Reflect VF.cutoff into both the slider (log position) and the number box,
// without retriggering their handlers (we set .value directly).
function vfSyncCutoffControls() {
  const slider = document.getElementById("vfCutoff");
  const box = document.getElementById("vfCutoffInput");
  if (slider) slider.value = String(vfFreqToPos(VF.cutoff));
  if (box && document.activeElement !== box) {
    // Don't clobber what the operator is typing; only round when unfocused.
    box.value = String(Math.round(VF.cutoff));
  }
}

function vfUpdateReadout() {
  const el = document.getElementById("vfReadout");
  if (!el) return;
  const at = vfAnalyticAtCutoff();
  const slope = vfSlopeDbPerOct();
  el.textContent =
    `Analytic at ${Math.round(VF.cutoff)} Hz: ${at.toFixed(2)} dB (target −3.01). ` +
    (slope != null ? `Rolloff ≈ ${slope.toFixed(1)} dB/oct (10th-order Butterworth ≈ −60).` : "");
}

// Recompute analytic + restart noise averaging for the current cutoff.
function vfRecompute() {
  vfComputeAnalytic();
  vfUpdateReadout();
  vfDraw();
  vfRunAveraging();  // async; resets accumulation
}

function vfToTSV() {
  const lines = ["Frequency_Hz\tAnalytic_dB\tMeasured_dB\tCutoff_Hz\tSampleRate_Hz\tOrder"];
  const order = AudioEngine.butterworthOrder || 10;
  for (let i = 0; i < VF.freqs.length; i++) {
    const f = VF.freqs[i].toFixed(3);
    const a = isFinite(VF.analyticDb[i]) ? VF.analyticDb[i].toFixed(4) : "";
    const m = (VF.measuredCount > 0 && isFinite(VF.measuredDb[i])) ? VF.measuredDb[i].toFixed(4) : "";
    lines.push(`${f}\t${a}\t${m}\t${VF.cutoff}\t${VF.sr}\t${order}`);
  }
  return lines.join("\n");
}

function setupVerifyFilter() {
  const openBtn = document.getElementById("verifyFilterBtn");
  if (openBtn) openBtn.onclick = () => {
    if (typeof AudioEngine === "undefined" || !AudioEngine.butterworthSections) {
      alert("Audio engine not available.");
      return;
    }
    showScreen("verifyfilter");
    if (!VF.freqs.length) VF.freqs = vfBuildFreqs();
    // Seed cutoff from the number box (falls back to current VF.cutoff).
    const box = document.getElementById("vfCutoffInput");
    if (box && box.value !== "" && isFinite(Number(box.value))) {
      VF.cutoff = vfClampFreq(Number(box.value));
    }
    vfSyncCutoffControls();
    vfRecompute();
  };

  const screen = document.getElementById("verifyfilter");
  if (!screen) return;

  // Show the shared min/max next to the box so the range is explicit.
  const rangeEl = document.getElementById("vfCutoffRange");
  if (rangeEl) rangeEl.textContent = `(${VF_FMIN}–${Math.round(VF_FMAX)} Hz)`;

  const slider = document.getElementById("vfCutoff");
  const box = document.getElementById("vfCutoffInput");

  // Apply a new cutoff from either control: clamp, sync both widgets, redraw the
  // analytic curve live. `commit` (release / Enter / blur) restarts averaging.
  const applyCutoff = (freq, commit) => {
    VF.cutoff = vfClampFreq(freq);
    vfSyncCutoffControls();
    vfComputeAnalytic();
    vfUpdateReadout();
    vfDraw();
    if (commit) vfRunAveraging();
  };

  if (slider) {
    slider.addEventListener("input", () => applyCutoff(vfPosToFreq(Number(slider.value)), false));
    slider.addEventListener("change", () => applyCutoff(vfPosToFreq(Number(slider.value)), true));
  }
  if (box) {
    // Live analytic redraw as they type; commit (restart noise) on Enter/blur.
    box.addEventListener("input", () => {
      if (box.value === "" || !isFinite(Number(box.value))) return;
      applyCutoff(Number(box.value), false);
    });
    box.addEventListener("change", () => {
      if (box.value === "" || !isFinite(Number(box.value))) { vfSyncCutoffControls(); return; }
      applyCutoff(Number(box.value), true);
    });
    box.addEventListener("keydown", (e) => { if (e.key === "Enter") box.blur(); });
  }

  const avg = document.getElementById("vfAverages");
  if (avg) avg.addEventListener("change", () => {
    VF.averages = Math.max(1, Math.min(1000, Math.round(Number(avg.value)) || 100));
    vfRunAveraging();
  });

  const copyBtn = document.getElementById("vfCopyBtn");
  if (copyBtn) copyBtn.onclick = async () => {
    const tsv = vfToTSV();
    const status = document.getElementById("vfStatus");
    try {
      await navigator.clipboard.writeText(tsv);
      if (status) status.textContent = `Copied ${VF.freqs.length} rows to clipboard (TSV).`;
    } catch (_) {
      // Fallback: temporary textarea + execCommand for non-secure contexts.
      try {
        const ta = document.createElement("textarea");
        ta.value = tsv; document.body.appendChild(ta); ta.select();
        document.execCommand("copy"); document.body.removeChild(ta);
        if (status) status.textContent = `Copied ${VF.freqs.length} rows to clipboard (TSV).`;
      } catch (e) {
        if (status) status.textContent = "Could not copy — clipboard blocked by the browser.";
      }
    }
  };

  const backBtn = document.getElementById("vfBackBtn");
  if (backBtn) backBtn.onclick = () => {
    VF.cancel = true;          // stop any averaging pass
    showScreen("setup");
  };
}

if (typeof window !== "undefined") {
  window.VerifyFilter = { setupVerifyFilter, VF };
}



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
    list: listId || null,
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
  const isLinear = (mode === "quiet" || mode === "snr");
  const unit = (mode === "snr") ? "dB SNR" : (mode === "quiet") ? "dB" : "Hz";
  const stepUnit = isLinear ? "dB" : "dec";
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
    `# List\t${listId ? "List " + listId : "n/a"}`,
    `# test started at ${startTimeFormatted}`
  ];

  if (isAdaptive && adaptiveCfg) {
    const startShown = isLinear
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
    if (mode === "snr") {
      // In SNR mode the noise sits at the fixed presentation level; document it
      // (the calibrated dB(A), else "uncalibrated") and the step multiplier.
      const noiseLevel = (typeof Calibration !== "undefined" && Calibration.isCalibrated && Calibration.isCalibrated())
        ? `${Calibration.state().currentSliderDb} dB(A)`
        : "uncalibrated (device volume sets level)";
      txtLines.push(
        `# Noise level (fixed)\t${noiseLevel}`,
        `# SNR step multiplier\t${adaptiveCfg.stepMult ?? "n/a"}`
      );
    }
  }
  if (typeof Calibration !== "undefined" && Calibration.calibrationHeader) {
    txtLines.push(`# Calibration\t${Calibration.calibrationHeader()}`);
  }
  if (typeof Headphones !== "undefined") txtLines.push(`# Headphones\t${Headphones.header()}`);

  txtLines.push("");
  if (isAdaptive) {
    const valCol = (mode === "snr") ? "SNR_dB" : (mode === "quiet") ? "Level_dB" : "Cutoff_Hz";
    const estCol = (mode === "snr") ? "EstimateSNR_dB" : (mode === "quiet") ? "Estimate_dB" : "Estimate_Hz";
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


  // Email (subject = filename; body = TXT contents). A mailto: link has a hard
  // length limit and cannot attach files, so we only offer email when the FULL
  // results text fits under the limit (typical for a short adaptive run). If it
  // would overflow, we hide the button rather than send a truncated, useless
  // body — the file is already saved locally.
  const emailBtn = document.getElementById("emailBtn");
  if (emailBtn) {
    const baseName = `UC4AFC_${participant}_${timeStr}`;
    const subject = `${baseName}.txt`;
    const txtContent = txtLines.join("\n");

    // Conservative ceiling for the whole encoded mailto: URL body.
    const MAX_MAILTO_BODY = 1800;

    if (txtContent.length > MAX_MAILTO_BODY) {
      emailBtn.style.display = "none";
      emailBtn.onclick = null;
    } else {
      emailBtn.style.display = "";
      const to = (typeof config?.emailTo === "string" && config.emailTo.trim()) ? config.emailTo : "";
      const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(txtContent)}`;
      emailBtn.onclick = () => { location.href = mailto; };
      emailBtn.title = "";
    }
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

// Constant-stimuli run takes precedence: it manages its own state/save.
if (typeof csRunActive === "function" && csRunActive()) {
  stopAudio();
  csAbort();
  return;
}

if (phase === "training") {
  abortTraining(); //  tells flow.js to stop future audio/images
  stopAudio();
  trialIndex = 0;
  responseLog.length = 0;
  showScreen("thankyou");
  if (abortBtn) abortBtn.style.display = "none";
} else if (phase === "test") {
    stopAudio();
    showScreen("thankyou");
    if (abortBtn) abortBtn.style.display = "none";
    saveResults("test aborted at " + new Date().toLocaleString());
  }
}

// Escape key handler (keyboard path keeps a confirm; the on-screen button uses
// a 3-second hold instead, so a stray tap can't end the session).
window.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  const inRun = (phase === "training" || phase === "test" ||
    (typeof csRunActive === "function" && csRunActive()));
  if (!inRun) return;
  if (confirm("End the current session?")) abortPhase();
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

  // Merge persisted SNR noise-timing (presentation) settings into `config`.
  // config.json values (if any) act as defaults; a saved Setup overrides them.
  try {
    const raw = localStorage.getItem("uc4afc_snr_timing");
    if (raw) {
      const t = JSON.parse(raw);
      const merge = (k) => { if (isFinite(Number(t[k]))) config[k] = Number(t[k]); };
      merge("snrWordLeadMs"); merge("snrNoiseLeadMs");
      merge("snrNoiseTrailMs"); merge("snrNoiseRampMs");
    }
  } catch (_) {}
  
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
  await loadList("both");

  // Restore the last word list chosen on the start screen (defaults to List 1).
  try {
    const saved = localStorage.getItem("uc4afc_list");
    const sel = document.getElementById("listSelect");
    if (sel && (saved === "1" || saved === "2")) sel.value = saved;
  } catch (_) {}

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
  // Visibility is driven per-phase (training + test) elsewhere; default hidden.
  abortBtn.style.display = "none";

  const ring = document.getElementById("abortProgress");
  const CIRC = 100.53;                 // 2*pi*16, matches the CSS dasharray
  const HOLD_MS = 3000;                // hold duration to confirm
  let rafId = null, holdStart = 0, pointerId = null;

  const setProgress = (frac) => {
    if (ring) ring.style.strokeDashoffset = String(CIRC * (1 - Math.max(0, Math.min(1, frac))));
  };
  const resetRing = () => {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    abortBtn.classList.remove("holding");
    setProgress(0);
    pointerId = null;
  };
  const tick = () => {
    const frac = (performance.now() - holdStart) / HOLD_MS;
    setProgress(frac);
    if (frac >= 1) {
      resetRing();
      abortPhase();          // the completed hold IS the confirmation
      return;
    }
    rafId = requestAnimationFrame(tick);
  };
  const startHold = (ev) => {
    ev.preventDefault();
    if (rafId) return;       // already holding
    if (ev.pointerId != null) {
      pointerId = ev.pointerId;
      try { abortBtn.setPointerCapture(pointerId); } catch (_) {}
    }
    abortBtn.classList.add("holding");
    holdStart = performance.now();
    rafId = requestAnimationFrame(tick);
  };
  const cancelHold = (ev) => {
    if (ev) ev.preventDefault();
    resetRing();
  };

  // Pointer events cover mouse + touch + pen in one path.
  if (window.PointerEvent) {
    abortBtn.addEventListener("pointerdown", startHold);
    abortBtn.addEventListener("pointerup", cancelHold);
    abortBtn.addEventListener("pointercancel", cancelHold);
    abortBtn.addEventListener("pointerleave", cancelHold);
  } else {
    // Fallback for older engines.
    abortBtn.addEventListener("mousedown", startHold);
    abortBtn.addEventListener("mouseup", cancelHold);
    abortBtn.addEventListener("mouseleave", cancelHold);
    abortBtn.addEventListener("touchstart", startHold, { passive: false });
    abortBtn.addEventListener("touchend", cancelHold);
    abortBtn.addEventListener("touchcancel", cancelHold);
  }
  // iOS Safari: preventDefault on pointerdown does NOT stop its long-press text
  // selection / callout, and when that kicks in it fires pointercancel, which
  // cancelled the hold. A non-passive touchstart that preventDefault()s is what
  // suppresses it. The hold itself is still driven by the pointer events above.
  const block = (e) => { e.preventDefault(); };
  abortBtn.addEventListener("touchstart", block, { passive: false });
  abortBtn.addEventListener("contextmenu", block);
  abortBtn.addEventListener("selectstart", block);

  // A plain click never aborts (guards against assistive double-activations).
  abortBtn.addEventListener("click", (e) => e.preventDefault());
}


  optImgs.forEach(img => {
    img.addEventListener("click", () => recordResponse(img));
  });

  const back = document.getElementById("backBtn");
  const ok   = document.getElementById("okBtn");
  const ret  = document.getElementById("returnBtn");

  // Back on the instructions screen is wired per showing by showInstructions().
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
      if (abortBtn && config.showAbortXOnTouchDevices !== false) {
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
      if (abortBtn && config.showAbortXOnTouchDevices !== false) {
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

  // Constant-stimuli (normalisation) screen wiring.
  if (typeof setupConstantScreen === "function") setupConstantScreen();
  if (typeof setupVerifyFilter === "function") setupVerifyFilter();
};

// --- Calibration screen wiring (mirrors UC_CVCV) -----------------------------
// The calibration tone is the 1 kHz reference (audiometer aux-input nulling; also
// available for free-field/masking). The sound-field noise is config.calibNoiseFile.
const CALIB_URL = () => (typeof config !== "undefined" && config && config.calibFile)
  ? `sounds/${config.calibFile}` : "sounds/calibration_UC4AFC_1kHz.mp3";
const CALIB_NOISE_URL = () => (typeof config !== "undefined" && config && config.calibNoiseFile)
  ? `sounds/${config.calibNoiseFile}` : "sounds/noise.mp3";

function refreshCalStatus() {
  const el = document.getElementById("calStatus");
  if (!el || typeof Calibration === "undefined") return;
  if (Calibration.isCalibrated()) {
    el.textContent = `Calibrated: ${Calibration.calibrationHeader()}. Device volume must be at maximum.`;
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
  slider.step = 0.1;
  slider.value = c.currentSliderDb ?? slider.max;
  updateOutputLevelFromSlider();
}

function updateOutputLevelFromSlider(snap = true) {
  const slider = document.getElementById("outputLevel");
  const label = document.getElementById("outputLevelLabel");
  const badge = document.getElementById("modeBadge");
  if (!slider || typeof Calibration === "undefined") return;
  const c = Calibration.state();
  let raw = parseFloat(slider.value);

  if (c.isCalibrated && c.measuredDbA !== null) {
    const max = parseFloat(slider.max);
    const tol = 0.25;
    // While dragging (snap=false) keep the exact value for smooth audition;
    // on release (snap=true) settle onto the 5 dB grid.
    const shown = snap
      ? (Math.abs(raw - max) <= tol ? max : Math.round(raw / 5) * 5)
      : raw;
    if (snap) slider.value = shown;
    Calibration.setCurrentSliderDb(shown);
    if (label) label.textContent = `${snap ? shown : Math.round(shown)} dB A`;
    if (badge) { badge.textContent = "Calibrated Mode"; badge.classList.add("calibrated"); }
    // Live: if the Test tone is auditioning, move its level with the slider.
    if (typeof AudioEngine !== "undefined" && AudioEngine.isCalibrationTonePlaying &&
        AudioEngine.isCalibrationTonePlaying()) {
      const earSel = document.getElementById("calEarSelect");
      const ear = earSel ? earSel.value : "binaural";
      AudioEngine.setCalibrationGainDb(Calibration.gainDbForLevel(shown, ear));
    }
  } else {
    const snapped = Math.round(raw / 5) * 5;
    slider.value = snapped;
    Calibration.setCurrentSliderDb(snapped);
    if (label) label.textContent = `${snapped} dB FS`;
    if (badge) { badge.textContent = "Uncalibrated Mode"; badge.classList.remove("calibrated"); }
  }
}

// True when the current method uses the 1 kHz tone (audiometer) vs noise (sound field).
function calSignalIsTone() {
  const sel = document.getElementById("calMethodSelect");
  const method = (sel && sel.value) || (typeof Calibration !== "undefined" ? Calibration.calMethod() : "audiometer");
  return method === "audiometer";
}
function calPlayLabel(playing) {
  const sig = calSignalIsTone() ? "1 kHz tone" : "calibration noise";
  return `${playing ? "■ Stop" : "▶ Play"} ${sig}`;
}
// The signal URL for the current method: tone for audiometer, noise for sound field.
function calSignalUrl() {
  return calSignalIsTone() ? CALIB_URL() : CALIB_NOISE_URL();
}

// Render the method-dependent parts of the calibration screen: steps, the
// single-vs-dual level inputs, the play-button label, and the routing hint.
function renderCalMethodUI() {
  if (typeof Calibration === "undefined") return;
  const sel = document.getElementById("calMethodSelect");
  const method = (sel && sel.value) || Calibration.calMethod();
  const info = (Calibration.CAL_METHODS && Calibration.CAL_METHODS[method])
    || Calibration.CAL_METHODS.audiometer;

  // Steps.
  const ol = document.getElementById("calSteps");
  if (ol) {
    ol.innerHTML = "";
    (info.steps || []).forEach(s => {
      const li = document.createElement("li");
      li.textContent = s;
      ol.appendChild(li);
    });
  }

  const isAud = method === "audiometer";

  // Level label + hint.
  const lbl = document.getElementById("calLevelLabelText");
  if (lbl) lbl.textContent = info.levelLabel || "Level, dB(A)";
  const hint = document.getElementById("calLevelHint");
  if (hint) {
    hint.textContent = isAud
      ? "Levels are presented from this figure downward. Set the dial to the loudest " +
        "level you'll need, plus a little margin — at least 6 dB if you'll be masking."
      : "This is the most this setup can deliver with the device at full volume. The " +
        "calibration is valid only for this speaker, seat and room — recalibrate if any change.";
  }

  // Routing selector is an audiometer concern (per-channel aux calibration).
  const earWrap = document.getElementById("calEarWrap");
  const earHint = document.getElementById("calEarHint");
  if (earWrap) earWrap.style.display = isAud ? "" : "none";
  if (earHint) {
    earHint.textContent = isAud
      ? "Play the tone to both channels and zero each audiometer input (A and B) to " +
        "VU 0 off this one tone. Both channels are then referenced to the tone, so the " +
        "software can place speech and masker correctly on either side."
      : "";
  }
  // Default routing to both in every method.
  const earSel = document.getElementById("calEarSelect");
  if (earSel) { earSel.value = "binaural"; if (AudioEngine.setCalibrationEar) AudioEngine.setCalibrationEar("binaural"); }

  // Single (sound field) vs dual dials (audiometer).
  const dual = document.getElementById("calDialDualWrap");
  const single = document.getElementById("calLevelSingleWrap");
  if (dual) dual.style.display = isAud ? "" : "none";
  if (single) single.style.display = isAud ? "none" : "";
  if (isAud) {
    const c = Calibration.state();
    const d = c.dial || {};
    const dl = document.getElementById("calDialLeft");
    const dr = document.getElementById("calDialRight");
    if (dl) dl.value = d.left ?? (c.measuredDbA ?? "");
    if (dr) dr.value = d.right ?? (c.measuredDbA ?? "");
  } else {
    const inp = document.getElementById("calLevelInput");
    if (inp) inp.value = Calibration.state().measuredDbA ?? "";
  }

  // Test-output slider + Test-level button belong to SOUND-FIELD ONLY, and only
  // once calibrated. Audiometer never shows them (no slider, no test playback).
  const calibrated = Calibration.isCalibrated();
  const showTestUI = (!isAud && calibrated);
  const testRow = document.getElementById("calTestRow");
  if (testRow) testRow.style.display = showTestUI ? "flex" : "none";

  // Play-button label follows the method.
  const toggleBtn = document.getElementById("calToneToggleBtn");
  if (toggleBtn && !toggleBtn.classList.contains("active")) toggleBtn.textContent = calPlayLabel(false);
}

function setupCalibrationScreen() {
  const toggleBtn = document.getElementById("calToneToggleBtn");
  const testBtn   = document.getElementById("testCalBtn");
  const clearBtn  = document.getElementById("calClearBtn");
  const backBtn   = document.getElementById("calBackBtn");
  const saveBtn   = document.getElementById("calSaveBtn");
  const methodSel = document.getElementById("calMethodSelect");
  const earSel    = document.getElementById("calEarSelect");
  const slider    = document.getElementById("outputLevel");
  if (!toggleBtn) return; // screen not present

  let playing = false;
  let testOn = false;

  // Headphone/soundcard preset: each has its own calibration slot and (optional)
  // frequency-response curve for LPF loudness matching. Activate the saved one
  // before restoring calibration, so the restore reads that preset's slot.
  const hpSel = document.getElementById("calHeadphoneSelect");
  const hpHint = () => {
    const el = document.getElementById("calHeadphoneHint");
    if (!el || typeof Headphones === "undefined") return;
    const p = Headphones.preset();
    const dm = document.getElementById("calDeemph");
    if (dm) { dm.disabled = !p.curve; dm.checked = !!p.curve && Headphones.deemphOn(); }
    el.textContent = (p.curve
      ? "Frequency-response curve loaded: low-pass words are loudness-matched as heard through these headphones."
      : "No frequency-response curve: low-pass words are loudness-matched digitally (flat).") +
      (p.defaultCal ? ` Built-in calibration ${p.defaultCal.level} dB(A); entering your own measurement replaces it on this device.` : "") +
      " Calibration is stored separately for each preset.";
  };
  if (typeof Headphones !== "undefined") {
    if (hpSel) {
      hpSel.innerHTML = "";
      for (const [id, p] of Object.entries(Headphones.PRESETS)) {
        const o = document.createElement("option");
        o.value = id; o.textContent = p.label;
        hpSel.appendChild(o);
      }
      hpSel.value = Headphones.currentId();
    }
    Headphones.activate(Headphones.currentId());
    hpHint();
    const dm = document.getElementById("calDeemph");
    if (dm) dm.onchange = () => { Headphones.setDeemph(dm.checked); hpHint(); };
  }

  // Offer any stored calibration on load, and initialise the slider.
  if (typeof Calibration !== "undefined") {
    const restored = Calibration.loadStored();
    if (restored) {
      if (methodSel && restored.method) methodSel.value = restored.method;
      if (typeof Calibration.setMethod === "function" && restored.method) Calibration.setMethod(restored.method);
      // Auto-activate the stored calibration on return so the test UI is live
      // immediately (operator confirmed device volume when they first saved).
      Calibration.confirmStored(restored);
      const when = restored.timestamp
        ? new Date(restored.timestamp).toLocaleString("en-NZ", { dateStyle: "short", timeStyle: "short" })
        : "earlier";
      const el = document.getElementById("calStatus");
      if (el) {
        el.textContent = `Calibrated: ${Calibration.calibrationHeader()} (restored from ${when}). ` +
          `Device volume must be at maximum.` +
          (restored.stale ? " Over 30 days old — recalibration recommended." : "");
      }
    }
  }
  setupCalibrationSlider();
  renderCalMethodUI();

  // Preset change: stop any signal, switch to that preset's calibration slot
  // (or its built-in value) and curve, and refresh the screen.
  if (hpSel && typeof Headphones !== "undefined") hpSel.onchange = () => {
    if (playing) { AudioEngine.stopCalibrationTone(); playing = false; }
    toggleBtn.classList.remove("active");
    const act = Headphones.activate(hpSel.value);
    if (methodSel && Calibration.calMethod) methodSel.value = Calibration.calMethod();
    setupCalibrationSlider();
    renderCalMethodUI();
    hpHint();
    const el = document.getElementById("calStatus");
    if (el) {
      if (Calibration.isCalibrated()) {
        el.textContent = `Calibrated: ${Calibration.calibrationHeader()}. Device volume must be at maximum.` +
          (act.fromPreset ? " (Built-in preset value — replace it by measuring and entering a level.)" : "");
      } else {
        el.textContent = "Not calibrated for this preset yet: play the calibration noise, measure the dB(A), and enter it.";
      }
    }
  };

  // Method change: re-render the method-dependent UI and reset the signal.
  if (methodSel) methodSel.onchange = () => {
    if (typeof Calibration !== "undefined" && Calibration.setMethod) Calibration.setMethod(methodSel.value);
    if (playing) { AudioEngine.stopCalibrationTone(); playing = false; }
    toggleBtn.classList.remove("active");
    renderCalMethodUI();
  };

  // Live per-channel re-route while the signal plays.
  if (earSel) earSel.onchange = () => {
    if (AudioEngine.setCalibrationEar) AudioEngine.setCalibrationEar(earSel.value);
  };

  // Play / stop the calibration signal (tone for audiometer, noise for sound field).
  toggleBtn.onclick = async () => {
    if (typeof AudioEngine === "undefined") return;
    if (playing) {
      AudioEngine.stopCalibrationTone();
      playing = false;
      toggleBtn.textContent = calPlayLabel(false);
      toggleBtn.classList.remove("active");
      return;
    }
    await AudioEngine.resume();
    AudioEngine.stopCalibrationTone();
    testOn = false;
    if (testBtn) testBtn.textContent = "Test level";
    const ear = earSel ? earSel.value : "binaural";
    try {
      await AudioEngine.startCalibrationTone(calSignalUrl(), { ear });
      playing = true;
      toggleBtn.textContent = calPlayLabel(true);
      toggleBtn.classList.add("active");
    } catch (err) {
      const el = document.getElementById("calStatus");
      const what = calSignalIsTone()
        ? ((config && config.calibFile) || "calibration_UC4AFC_1kHz.mp3")
        : ((config && config.calibNoiseFile) || "noise.mp3");
      if (el) el.textContent = `Calibration signal not found (${calSignalUrl()}). Add ${what} to the sounds/ folder.`;
      console.error(err);
    }
  };

  // Save calibration: dual dials (audiometer) or single level (sound field).
  if (saveBtn) saveBtn.onclick = () => {
    if (typeof Calibration === "undefined") return;
    const method = methodSel ? methodSel.value : Calibration.calMethod();
    const status = document.getElementById("calStatus");

    if (method === "audiometer") {
      const lRaw = document.getElementById("calDialLeft")?.value ?? "";
      const rRaw = document.getElementById("calDialRight")?.value ?? "";
      const lHas = lRaw !== "" && Number.isFinite(Number(lRaw));
      const rHas = rRaw !== "" && Number.isFinite(Number(rRaw));
      if (!lHas && !rHas) { if (status) status.textContent = "Enter at least one dial setting before saving."; return; }
      const ok = Calibration.applyCalibrationDials(
        lHas ? Number(lRaw) : null, rHas ? Number(rRaw) : null,
        new Date().toISOString(), method);
      if (!ok) { if (status) status.textContent = "Those dial settings don't give a usable range. Check they're dB(A) audiometer dial settings."; return; }
    } else {
      const raw = document.getElementById("calLevelInput")?.value ?? "";
      if (raw === "" || !Number.isFinite(Number(raw))) { if (status) status.textContent = "Enter the measured level before saving."; return; }
      const ok = Calibration.applyCalibrationLevel(Number(raw), new Date().toISOString(), method);
      if (!ok) { if (status) status.textContent = `${raw} dB(A) is not a usable reference. Check the figure is the meter reading in dB(A).`; return; }
    }
    if (playing) { AudioEngine.stopCalibrationTone(); playing = false; toggleBtn.textContent = calPlayLabel(false); toggleBtn.classList.remove("active"); }
    setupCalibrationSlider();
    renderCalMethodUI();
    refreshCalStatus();
  };

  // Test level: replay the signal at the current slider level.
  if (testBtn) {
    testBtn.onclick = async () => {
      if (typeof Calibration === "undefined" || !Calibration.isCalibrated()) return;
      if (testOn) { AudioEngine.stopCalibrationTone(); testOn = false; testBtn.textContent = "Test level"; return; }
      await AudioEngine.resume();
      const ear = earSel ? earSel.value : "binaural";
      const gainDb = Calibration.gainDbForLevel(Calibration.state().currentSliderDb, ear);
      try {
        await AudioEngine.startCalibrationTone(calSignalUrl(), { extraGainDb: gainDb, ear });
        testOn = true;
        testBtn.textContent = "Stop";
      } catch (err) {
        if (document.getElementById("calStatus")) document.getElementById("calStatus").textContent = "Calibration signal not found.";
        console.error(err);
      }
    };
  }

  if (slider) {
    slider.addEventListener("input", () => updateOutputLevelFromSlider(false));
    slider.addEventListener("change", () => updateOutputLevelFromSlider(true));
  }

  clearBtn.onclick = () => {
    if (typeof Calibration !== "undefined") Calibration.clearCalibration();
    AudioEngine.stopCalibrationTone();
    playing = testOn = false;
    toggleBtn.textContent = calPlayLabel(false);
    toggleBtn.classList.remove("active");
    if (testBtn) { testBtn.hidden = true; testBtn.textContent = "Test level"; }
    setupCalibrationSlider();
    renderCalMethodUI();
    refreshCalStatus();
  };

  backBtn.onclick = () => {
    if (typeof AudioEngine !== "undefined") AudioEngine.stopCalibrationTone();
    playing = testOn = false;
    toggleBtn.textContent = calPlayLabel(false);
    toggleBtn.classList.remove("active");
    if (testBtn) testBtn.textContent = "Test level";
    showScreen("intro");
  };
}

// --- Setup screen wiring (adaptive controls, Step 4) -------------------------
let _setupProc = "wudr";
let _setupMode = "lpf";
let _setupDirty = false;   // unsaved edits present in the Setup form

// Reflect the dirty/saved state in the status line and Save button so it's
// never ambiguous whether Setup changes are stored. (Back auto-saves, but the
// cue reassures the operator and prompts them to Save if they prefer.)
function updateDirtyUI() {
  const status = document.getElementById("setupStatus");
  if (status) {
    status.textContent = _setupDirty
      ? "Not saved as default — Back applies for this session only."
      : "";
    status.style.color = _setupDirty ? "#b00" : "";
  }
  const saveBtn = document.getElementById("setupSaveBtn");
  if (saveBtn) {
    saveBtn.textContent = _setupDirty ? "Save as default *" : "Save as default";
    saveBtn.classList.toggle("dirty", _setupDirty);
  }
}

function markDirty() {
  if (!_setupDirty) { _setupDirty = true; updateDirtyUI(); }
}

function currentAdaptiveCfg() {
  // Show the LIVE session settings if present (so reopening Setup within a
  // session reflects what's actually running, including changes applied via
  // Back), falling back to the persisted default.
  if (typeof config !== "undefined" && config && config.adaptive) return config.adaptive;
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
  if (hint) hint.textContent =
    (mode === "quiet") ? "Adapts presentation level (dB). Uncalibrated runs are relative to the start level."
  : (mode === "snr")   ? "Adapts signal-to-noise ratio (dB). Masking noise is fixed at the presentation level; the signal moves."
  : "Adapts the equivalent low-pass cutoff (Hz).";
  // The SNR-only block (step multiplier) is shown only in SNR mode.
  const snrBlock = document.getElementById("snrBlock");
  if (snrBlock) snrBlock.hidden = (mode !== "snr");
  // The LPF presentation-level block: LPF only. In quiet the level IS the
  // adaptive variable, and SNR sets its level in the noise block.
  const lpfLevelBlock = document.getElementById("lpfLevelBlock");
  if (lpfLevelBlock) lpfLevelBlock.hidden = (mode !== "lpf");
}

// Relabel units and adjust input bounds/steps for the active mode.
function applyModeLabels(mode) {
  const isQuiet = (mode === "quiet");
  const isSnr = (mode === "snr");
  const isLinear = isQuiet || isSnr;   // dB axis (either level or SNR)
  const stepUnit = isLinear ? "dB" : "dec";
  const setText = (id, t) => { const el = document.getElementById(id); if (el) el.textContent = t; };
  setText("lblStart", isSnr ? "Starting SNR (dB)" : isQuiet ? "Starting level (dB)" : "Starting cutoff (Hz)");
  // SNR noise-level label depends on calibration: dB(A) when calibrated, else a
  // dB FS attenuation the operator sets (device volume does the rest).
  const cal = (typeof Calibration !== "undefined" && Calibration.isCalibrated && Calibration.isCalibrated());
  setText("lblSnrNoiseLevel", cal ? "Noise level (dB A)" : "Noise level (dB FS attenuation)");
  setText("lblLpfLevel", cal ? "Level (dB A)" : "Level (dB FS attenuation)");
  document.querySelectorAll(".lblStepUnit-wd").forEach(e => e.textContent = `Working down step (${stepUnit})`);
  document.querySelectorAll(".lblStepUnit-wu").forEach(e => e.textContent = `Working up step (${stepUnit})`);
  document.querySelectorAll(".lblStepUnit-id").forEach(e => e.textContent = `Initial down step (${stepUnit})`);
  document.querySelectorAll(".lblStepUnit-iu").forEach(e => e.textContent = `Initial up step (${stepUnit})`);

  // Start input bounds/step per mode.
  const sc = document.getElementById("setStartCutoff");
  if (sc) {
    if (isSnr || isQuiet) { sc.removeAttribute("min"); sc.removeAttribute("max"); sc.step = 1; }
    else { sc.min = 75; sc.max = 20000; sc.step = 10; }
  }
  // Presentation-level fields: no min/max (nothing is clamped; genuine output
  // clipping is warned per presentation in the console). NEVER rewrite the
  // user's entered value here (that caused -20 -> 0). Defaults: fillFormFromCfg.
  const nl = document.getElementById("setSnrNoiseLevel");
  if (nl) {
    nl.removeAttribute("min"); nl.removeAttribute("max"); nl.step = 1;
  }
  const ll = document.getElementById("setLpfLevel");
  if (ll) {
    ll.removeAttribute("min"); ll.removeAttribute("max"); ll.step = 1;
  }
  // Step inputs: fine in SNR (small dB), medium in quiet, very fine in LPF.
  ["setWorkDown","setWorkUp","setInitDown","setInitUp"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.step = isSnr ? 0.01 : isQuiet ? 0.1 : 0.0001;
  });
  const wudrHint = document.getElementById("wudrHint");
  if (wudrHint) wudrHint.textContent =
    isSnr   ? "SNR steps = quiet dB steps \u00d7 the multiplier below. 0 reversals = single-phase."
  : isQuiet ? "Quiet defaults: down 0.6 dB / up 1.0 dB (working); down 3 / up 5 (initial). 0 reversals = single-phase."
  : "Defaults: down \u22124.76% / up +8.33% (working); down \u221211.1% / up +20.8% (initial). 0 reversals = single-phase.";
}

// Populate the whole form from a resolved cfg object.
function fillFormFromCfg(cfg) {
  const set = (id, v) => { const el = document.getElementById(id); if (el != null && v != null) el.value = v; };
  const isQuiet = (cfg.mode === "quiet");
  const isSnr = (cfg.mode === "snr");
  set("setStartCutoff",
    isSnr   ? (cfg.startValue ?? 2)
  : isQuiet ? (cfg.startValue ?? 65)
  : (cfg.startValue ?? cfg.startCutoffHz ?? 1000));
  set("setSnrStepMult", cfg.stepMult ?? 0.2);
  // Presentation-level fields: default per calibration state when unset, and
  // clamp a value carried from the other calibration state into range.
  const cal = (typeof Calibration !== "undefined" && Calibration.isCalibrated && Calibration.isCalibrated());
  const levelDefault = cal ? 65 : 0;
  // Default only when nothing is saved; an existing value is shown as-is
  // (no range clamping — genuine clipping is warned per presentation instead).
  const clampLevel = (v) => {
    const n = Number(v);
    return isFinite(n) ? n : levelDefault;
  };
  set("setSnrNoiseLevel", clampLevel(cfg.snrNoiseLevel ?? levelDefault));
  set("setLpfLevel", clampLevel(cfg.lpfLevel ?? levelDefault));
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

// SNR noise-timing (presentation) fields live on `config`, not the adaptive
// cfg. Populate them from config with the documented defaults.
function fillSnrTimingFromConfig() {
  const set = (id, v) => { const el = document.getElementById(id); if (el != null && v != null) el.value = v; };
  const c = (typeof config !== "undefined" && config) ? config : {};
  set("setSnrWordLead",   c.snrWordLeadMs   ?? c.imageRevealOffsetMs ?? 600);
  set("setSnrNoiseLead",  c.snrNoiseLeadMs  ?? 600);
  set("setSnrNoiseTrail", c.snrNoiseTrailMs ?? 600);
  set("setSnrNoiseRamp",  c.snrNoiseRampMs  ?? 100);
}

function populateSetupForm() {
  const cfg = currentAdaptiveCfg();
  _setupProc = cfg.procedure || "wudr";
  _setupMode = cfg.mode || "lpf";
  showProcBlocks(_setupProc);
  showModeButtons(_setupMode);
  applyModeLabels(_setupMode);
  fillFormFromCfg(cfg);
  fillSnrTimingFromConfig();

  _setupDirty = false;
  updateDirtyUI();
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
  const isSnr = (_setupMode === "snr");
  const isLinear = isQuiet || isSnr;   // dB axis (level or SNR)
  const sweet = (typeof AdaptiveConfig !== "undefined") ? AdaptiveConfig.sweetPointsFor(A) : { pLow: 0.40, pHigh: 0.85 };
  const midpoint = (typeof AdaptiveConfig !== "undefined") ? AdaptiveConfig.midpointTarget(A) : 0.625;
  const startVal = num("setStartCutoff", isSnr ? 2 : isQuiet ? 65 : 1000);

  // In SNR mode the WUDR steps are derived from the multiplier (single source of
  // truth), not read from the step inputs. Other modes read the step inputs.
  const stepMult = isSnr ? num("setSnrStepMult", 0.2) : undefined;
  const snrSteps = (isSnr && typeof AdaptiveConfig !== "undefined")
    ? AdaptiveConfig.snrStepsForMult(stepMult)
    : null;

  return {
    mode: _setupMode,
    procedure: _setupProc,
    A,
    target: midpoint,
    axisIsLog: !isLinear,
    unit: isSnr ? "dB SNR" : isQuiet ? "dB" : "Hz",
    stepUnit: isLinear ? "dB" : "decades",
    slopeUnit: isLinear ? "%/dB" : "%/octave",
    startValue: startVal,
    startCutoffHz: isLinear ? undefined : startVal,  // LPF alias only
    nTrials: Math.max(1, Math.min(66, Math.round(num("setNTrials", 33)))),
    xlo: (isSnr || isQuiet) ? null : Math.log10(75),     // quiet/SNR: unbounded
    xhi: (isSnr || isQuiet) ? null : Math.log10(20000),
    workDown: snrSteps ? snrSteps.workDown : num("setWorkDown", isQuiet ? 0.6 : 0.0212),
    workUp:   snrSteps ? snrSteps.workUp   : num("setWorkUp",   isQuiet ? 1.0 : 0.0348),
    initDown: snrSteps ? snrSteps.initDown : num("setInitDown", isQuiet ? 3.0 : 0.0511),
    initUp:   snrSteps ? snrSteps.initUp   : num("setInitUp",   isQuiet ? 5.0 : 0.0822),
    switchRev: Math.max(0, Math.round(num("setSwitchRev", 5))),
    a1slope: num("setA1Slope", isLinear ? 0.10 : 10),
    minStep: isSnr ? 0.05 : isQuiet ? 0.25 : 0.01,
    a2slope: num("setA2Slope", isLinear ? 0.10 : 10),
    pLow: sweet.pLow,
    pHigh: sweet.pHigh,
    a2Doubling: !!(document.getElementById("setA2Doubling") || {}).checked,
    slopeHint: isLinear ? 6 : 43,
    stepMult,   // undefined unless SNR
    // SNR noise presentation level (dB(A) if calibrated, else dB FS attenuation).
    // Stored for all modes but only consumed in SNR.
    snrNoiseLevel: num("setSnrNoiseLevel", (typeof Calibration !== "undefined" && Calibration.isCalibrated && Calibration.isCalibrated()) ? 65 : 0),
    // LPF presentation level (dB(A) if calibrated, else dB FS attenuation).
    // Consumed in LPF mode.
    lpfLevel: num("setLpfLevel", (typeof Calibration !== "undefined" && Calibration.isCalibrated && Calibration.isCalibrated()) ? 65 : 0),
    routing: val("setRouting") || "binaural"
  };
}

function setupSetupScreen() {
  const seg = document.getElementById("procSegmented");
  if (!seg) return; // screen not present

  seg.querySelectorAll(".seg-btn").forEach(btn => {
    btn.onclick = () => { _setupProc = btn.dataset.proc; showProcBlocks(_setupProc); markDirty(); };
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
        markDirty();
      };
    });
  }

  // SNR step multiplier: recompute and display the four WUDR steps from it, so
  // the step fields always reflect quiet-base × multiplier.
  const snrMult = document.getElementById("setSnrStepMult");
  if (snrMult) {
    const applyMult = () => {
      if (_setupMode !== "snr" || typeof AdaptiveConfig === "undefined") return;
      const s = AdaptiveConfig.snrStepsForMult(parseFloat(snrMult.value));
      const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
      set("setWorkDown", s.workDown); set("setWorkUp", s.workUp);
      set("setInitDown", s.initDown); set("setInitUp", s.initUp);
    };
    snrMult.addEventListener("input", applyMult);
    snrMult.addEventListener("change", applyMult);
  }

  // Two-tier persistence:
  //   applySetupToSession()  -> live config only (this session's run). Back uses
  //                             this: current settings take effect now but do
  //                             NOT become the standing default.
  //   saveSetupAsDefault()   -> everything applySetupToSession does, PLUS writes
  //                             localStorage so the settings persist across
  //                             reloads/relaunches as the default.
  //
  // SNR-timing fields live on config; helper reads them from the form.
  function readSnrTimingFromForm() {
    const numOr = (id, dflt) => {
      const el = document.getElementById(id);
      const v = el ? parseFloat(el.value) : NaN;
      return isFinite(v) && v >= 0 ? v : dflt;
    };
    return {
      snrWordLeadMs:   numOr("setSnrWordLead", 600),
      snrNoiseLeadMs:  numOr("setSnrNoiseLead", 600),
      snrNoiseTrailMs: numOr("setSnrNoiseTrail", 600),
      snrNoiseRampMs:  numOr("setSnrNoiseRamp", 100)
    };
  }

  // Apply the form to the live session config (no localStorage write).
  function applySetupToSession() {
    const cfg = readSetupForm();
    if (typeof config !== "undefined") {
      config.adaptive = cfg;
      config.routing = cfg.routing;   // surfaced at top level for flow.js
      const t = readSnrTimingFromForm();
      config.snrWordLeadMs   = t.snrWordLeadMs;
      config.snrNoiseLeadMs  = t.snrNoiseLeadMs;
      config.snrNoiseTrailMs = t.snrNoiseTrailMs;
      config.snrNoiseRampMs  = t.snrNoiseRampMs;
    }
    return cfg;
  }

  // Apply to the session AND persist as the default.
  function saveSetupAsDefault() {
    const cfg = applySetupToSession();
    if (typeof AdaptiveConfig !== "undefined") AdaptiveConfig.saveAdaptiveConfig(cfg);
    try {
      const t = readSnrTimingFromForm();
      localStorage.setItem("uc4afc_snr_timing", JSON.stringify(t));
    } catch (_) {}
    _setupDirty = false;
    updateDirtyUI();
  }

  // Any edit to a Setup control marks the form dirty and reflects it in the UI,
  // so it's never ambiguous whether changes are the saved default yet. Delegated
  // listener covers every input/select, including ones toggled in/out per mode.
  const setupScreen = document.getElementById("setup");
  if (setupScreen) {
    const onEdit = (e) => {
      const t = e.target;
      if (!t || !/^(INPUT|SELECT)$/.test(t.tagName)) return;
      if (t.readOnly) return;                    // A / target are display-only
      markDirty();
    };
    setupScreen.addEventListener("input", onEdit);
    setupScreen.addEventListener("change", onEdit);
  }

  const saveBtn = document.getElementById("setupSaveBtn");
  if (saveBtn) saveBtn.onclick = () => {
    saveSetupAsDefault();
    const status = document.getElementById("setupStatus");
    if (status) { status.textContent = "Saved as default."; status.style.color = ""; }
  };

  const resetBtn = document.getElementById("setupResetBtn");
  if (resetBtn) resetBtn.onclick = () => {
    if (typeof AdaptiveConfig !== "undefined") {
      AdaptiveConfig.clearAdaptiveConfig();
      if (typeof config !== "undefined") config.adaptive = AdaptiveConfig.loadAdaptiveConfig();
    }
    populateSetupForm();
    _setupDirty = false;
    updateDirtyUI();
    const status = document.getElementById("setupStatus");
    if (status) { status.textContent = "Reset to defaults."; status.style.color = ""; }
  };

  // Back applies the current form to THIS session (so a run started now uses it)
  // but does not change the persisted default. Save-as-default is the only path
  // that writes localStorage.
  const backBtn = document.getElementById("setupBackBtn");
  if (backBtn) backBtn.onclick = () => {
    applySetupToSession();
    _setupDirty = false;
    updateDirtyUI();
    showScreen("intro");
  };
}


