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
  const eqNoiseCache = new Map();     // `${url}|${eqKey}` -> equalised noise AudioBuffer
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

  // Optional pre-measured momentary LUFS per word name, loaded from a repo file
  // (see loadLUFSTable). When present, decode() uses this instead of measuring
  // live, saving per-word measurement cost. name -> momentary LUFS (number).
  const preMeasured = new Map();

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
      const sum = (LIN(estimateTruePeakDB(wordBuf)) * sigLin +
                   LIN(estimateTruePeakDB(noiseBuf)) * noiLin) * m;
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

    // Word source + gain.
    const wordSrc = c.createBufferSource();
    wordSrc.buffer = wordBuf;
    const wordGain = c.createGain();
    wordGain.gain.value = sigLin;
    wordSrc.connect(wordGain);
    makeEarRouter(c, wordGain, routing);

    // Noise source (NOT looped — a single random segment) + gain, ramped in/out.
    const noiseSrc = c.createBufferSource();
    noiseSrc.buffer = noiseBuf;
    noiseSrc.loop = false;
    const noiseG = c.createGain();
    noiseSrc.connect(noiseG);
    makeEarRouter(c, noiseG, routing);

    activeSource = wordSrc;
    activeNoiseSource = noiseSrc;

    // Equal-power (cosine) ramps of rampSec, clamped so two ramps fit the segment.
    const ramp = Math.max(0, Math.min(rampSec, noiseDur / 2));
    const noiseStartClamped = Math.max(now, noiseStartAt);
    const noiseEndAt = noiseStartClamped + noiseDur;
    const g = noiseG.gain;
    g.setValueAtTime(0.0001, noiseStartClamped);
    if (ramp > 0) {
      // exponentialRamp can't target 0, so start just above and use it for a
      // smooth (near equal-power) fade; linear ramp to 0 at the tail.
      g.exponentialRampToValueAtTime(Math.max(noiLin, 1e-4), noiseStartClamped + ramp);
      g.setValueAtTime(noiLin, noiseEndAt - ramp);
      g.linearRampToValueAtTime(0.0001, noiseEndAt);
    } else {
      g.setValueAtTime(noiLin, noiseStartClamped);
    }

    return new Promise((resolve, reject) => {
      wordSrc.onended = () => {
        if (activeSource === wordSrc) activeSource = null;
        resolve();
      };
      try {
        if (noiseDur > 0) {
          // start(when, offset, duration) — a single contiguous slice.
          noiseSrc.start(noiseStartClamped, noiseOffset, noiseDur);
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
    decode, isDecoded, loadLUFSTable,
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
export { AudioEngine, measureLUFS, butterworthLowpassSections, renderButterworthLowpass };
