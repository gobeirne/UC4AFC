// filter.test.js — standalone checks for the app's 10th-order Butterworth LPF.
// Run from the project folder:  node filter.test.js
// Not part of the app bundle. It extracts the PRODUCTION functions from
// audioEngine.js (no re-typed copy) and tests them against an INDEPENDENT
// design built straight from the analog Butterworth poles (bilinear transform
// with prewarping), i.e. the same construction as LabVIEW's Butterworth
// Coefficients VI / SciPy butter().

const fs = require("fs");
const src = fs.readFileSync(__dirname + "/audioEngine.js", "utf8");
const grab = (n) => {
  const i = src.indexOf("function " + n + "(");
  if (i < 0) throw new Error("not found in audioEngine.js: " + n);
  // skip the parameter list (it may contain braces, e.g. destructured defaults)
  let k = src.indexOf("(", i), p = 0;
  for (; k < src.length; k++) { if (src[k] === "(") p++; if (src[k] === ")" && --p === 0) break; }
  let d = 0;
  for (k = src.indexOf("{", k); k < src.length; k++) {
    if (src[k] === "{") d++;
    if (src[k] === "}" && --d === 0) return src.slice(i, k + 1);
  }
};
const orderDecl = src.match(/const BUTTERWORTH_ORDER\s*=\s*\d+;/);
if (!orderDecl) throw new Error("BUTTERWORTH_ORDER not found in audioEngine.js");
eval(orderDecl[0].replace("const", "var"));
const kTable = (() => { const i = src.indexOf("const K_COEFFS = {"); let d = 0;
  for (let k = src.indexOf("{", i); k < src.length; k++) { if (src[k] === "{") d++; if (src[k] === "}" && --d === 0) return src.slice(i, k + 1) + ";"; } })();
const eqConsts = src.match(/const EQ_TAPS = \d+, EQ_NFFT = \d+;/)[0];
eval(kTable.replace("const", "var") + eqConsts.replace("const", "var") +
  ["fftInPlace", "curveDbAt", "shapeByCurve", "designEqFir", "firConvolve", "aWeightPow", "eqLevelScale",
   "getKCoeffs", "kWeightSignal", "blockPowersFromSignal", "powerToLUFS", "momentaryLUFSOf"].map(grab).join("\n"));
eval(grab("butterworthSectionQs") + grab("analogLPtoBiquad") +
     grab("butterworthLowpassSections") + grab("applyBiquad"));

const SR = 48000, ORDER = BUTTERWORTH_ORDER;
let pass = 0, fail = 0;
const check = (ok, msg) => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`); };
const db = (x) => 20 * Math.log10(x);

// Complex helpers
const C = (re, im = 0) => ({ re, im });
const add = (a, b) => C(a.re + b.re, a.im + b.im);
const sub = (a, b) => C(a.re - b.re, a.im - b.im);
const mul = (a, b) => C(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
const div = (a, b) => { const d = b.re * b.re + b.im * b.im; return C((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d); };
const abs = (a) => Math.hypot(a.re, a.im);

// |H| of the app's section cascade at frequency f.
function appMag(secs, f) {
  const w = 2 * Math.PI * f / SR, z1 = C(Math.cos(w), -Math.sin(w)), z2 = mul(z1, z1);
  let H = C(1);
  for (const c of secs) {
    const num = add(add(C(c.b0), mul(C(c.b1), z1)), mul(C(c.b2), z2));
    const den = add(add(C(1), mul(C(c.a1), z1)), mul(C(c.a2), z2));
    H = mul(H, div(num, den));
  }
  return abs(H);
}

// Independent reference: analog poles -> bilinear (prewarped) -> zpk, |H(z)|.
function refMag(fc, f) {
  const wc = 2 * SR * Math.tan(Math.PI * fc / SR), K = C(2 * SR);
  const pz = [];
  for (let k = 0; k < ORDER; k++) {
    const th = Math.PI * (2 * k + ORDER + 1) / (2 * ORDER);
    const p = C(wc * Math.cos(th), wc * Math.sin(th));      // analog pole
    pz.push(div(add(K, p), sub(K, p)));                     // z = (2fs+p)/(2fs-p)
  }
  // zeros all at z = -1; gain set for unity at DC
  const w = 2 * Math.PI * f / SR, z = C(Math.cos(w), Math.sin(w));
  let num = C(1), den = C(1), num0 = C(1), den0 = C(1);
  for (const p of pz) {
    num = mul(num, add(z, C(1))); den = mul(den, sub(z, p));
    num0 = mul(num0, C(2));       den0 = mul(den0, sub(C(1), p));
  }
  return abs(div(num, den)) / abs(div(num0, den0));
}

// 1. Q values from the pole calculation
const Qs = butterworthSectionQs(ORDER).slice().sort((a, b) => a - b);
const expectQ = [0.50623256, 0.56116312, 0.70710678, 1.10134463, 3.19622661];
check(Qs.every((q, i) => Math.abs(q - expectQ[i]) < 1e-8),
  `section Qs = ${Qs.map(q => q.toFixed(8)).join(", ")}`);
check(butterworthLowpassSections(1000, SR).length === 5, "order 10 = five 2nd-order sections");

for (const fc of [125, 250, 500, 1000, 2000, 4000, 8000]) {
  const secs = butterworthLowpassSections(fc, SR);
  // 2. matches the independent design across the band
  let maxErr = 0;
  for (let f = 10; f < SR / 2 * 0.99; f *= 1.02) {
    const a = appMag(secs, f), r = refMag(fc, f);
    if (r > 1e-9) maxErr = Math.max(maxErr, Math.abs(db(a) - db(r)));
  }
  check(maxErr < 1e-6, `fc ${fc}: matches independent pole design (max ${maxErr.toExponential(1)} dB)`);
  // 3. -3 dB at fc
  const at = db(appMag(secs, fc));
  check(Math.abs(at + 3.0103) < 0.01, `fc ${fc}: ${at.toFixed(3)} dB at cutoff`);
  // 4. roll-off ~60 dB/oct one octave above. Only checked where 4·fc is well
  // below Nyquist: near Nyquist the bilinear transform (here and in LabVIEW)
  // makes the digital roll-off steeper; test 2 already covers those cutoffs.
  if (4 * fc <= SR / 8) {
    const slope = db(appMag(secs, 4 * fc)) - db(appMag(secs, 2 * fc));
    check(slope < -58 && slope > -80, `fc ${fc}: ${slope.toFixed(1)} dB/octave (2fc→4fc)`);
  }
  // 5. monotonic, maximally flat passband (no resonant peak)
  let prev = Infinity, mono = true, peak = 0;
  for (let f = 1; f <= fc; f += fc / 2000) {
    const m = appMag(secs, f); if (m > prev + 1e-9) mono = false;  // 1e-9: float eval noise near DC prev = m; peak = Math.max(peak, m);
  }
  check(mono && db(peak) < 1e-6, `fc ${fc}: passband monotonic, peak ${db(peak).toExponential(1)} dB`);
}

// 6. Time-domain cases at fc = 1000 Hz
const secs = butterworthLowpassSections(1000, SR);
const run = (x) => { let s = Float64Array.from(x); const peaks = [];
  for (const c of secs) { s = applyBiquad(s, c); peaks.push(Math.max(...s.map(Math.abs))); }
  return { y: s, peaks }; };
const N = 48000;
const imp = new Float64Array(N); imp[0] = 1;
const ir = run(imp);
check(ir.y.every(Number.isFinite), "impulse: no NaN/Inf");
check(Math.abs(ir.y.reduce((a, b) => a + b, 0) - 1) < 1e-9, "impulse: DC gain (sum of IR) = 1");
check(Math.max(...ir.y.slice(N - 4800).map(Math.abs)) < 1e-12, "impulse: decays (stable)");
console.log("      per-section peak (impulse):", ir.peaks.map(p => p.toExponential(2)).join("  "));
check(run(new Float64Array(N)).y.every(v => v === 0), "silence in → silence out");
const step = run(new Float64Array(N).fill(1));
check(Math.abs(step.y[N - 1] - 1) < 1e-9, "step: settles to 1");
console.log(`      step overshoot ${(db(Math.max(...step.y)))} dB; per-section peaks:`,
  step.peaks.map(p => p.toFixed(3)).join("  "));
const nyq = run(Float64Array.from({ length: N }, (_, i) => (i % 2 ? -1 : 1)));
check(Math.max(...nyq.y.slice(N / 2).map(Math.abs)) < 1e-9, "Nyquist: removed");
for (const [f, lo, hi] of [[500, -0.01, 0.01], [1000, -3.05, -2.97], [2000, -62, -59]]) {
  const y = run(Float64Array.from({ length: N }, (_, i) => Math.sin(2 * Math.PI * f * i / SR))).y;
  const g = db(Math.max(...y.slice(N / 2).map(Math.abs)));
  check(g > lo && g < hi, `sine ${f} Hz: ${g.toFixed(2)} dB`);
}

// 7. Channels are filtered independently (mirrors renderButterworthLowpass)
const L = Float64Array.from({ length: N }, (_, i) => Math.sin(2 * Math.PI * 300 * i / SR));
const R = new Float64Array(N);
let yL = L, yR = R;
for (const c of secs) { yL = applyBiquad(yL, c); yR = applyBiquad(yR, c); }
check(yR.every(v => v === 0), "stereo: silent right channel stays silent (no crosstalk)");

// ---- Headphone de-emphasis (equalisation to flat) ---------------------------
{
  const hpSrc = fs.readFileSync(__dirname + "/headphones.js", "utf8");
  const win = {};
  new Function("localStorage", "window", hpSrc)({ getItem() { return null; }, setItem() {} }, win);
  const HP = { P: win.Headphones.PRESETS };
  const curve = HP.P.hd280_xfi.curve;
  const h = designEqFir(curve, SR);
  // accuracy: headphone x de-emphasis = flat
  const respDb = (f) => { const c = (h.length - 1) / 2; let r = 0, i = 0;
    for (let m = 0; m < h.length; m++) { const a = -2 * Math.PI * f * (m - c) / SR; r += h[m] * Math.cos(a); i += h[m] * Math.sin(a); }
    return db(Math.hypot(r, i)); };
  let worst = 0, wf = 0;
  for (let f = 30; f < 22000; f *= 1.03) { const e = respDb(f) + curveDbAt(curve, f); if (Math.abs(e) > Math.abs(worst)) { worst = e; wf = f; } }
  check(Math.abs(worst) < 0.3, `EQ: HD280 x de-emphasis flat within ${Math.abs(worst).toFixed(2)} dB, 30 Hz–22 kHz (worst @ ${wf.toFixed(0)} Hz)`);

  // linear convolution: impulse at index 0 -> right half of h at the start, nothing wrapped to the end
  const L = 20000, x0 = new Float64Array(L); x0[0] = 1;
  const y0 = firConvolve(x0, h), c = (h.length - 1) / 2;
  let err = 0; for (let i = 0; i < 3000; i++) err = Math.max(err, Math.abs(y0[i] - h[c + i]));
  let tail = 0; for (let i = L - 5000; i < L; i++) tail = Math.max(tail, Math.abs(y0[i]));
  check(err < 1e-6 && tail < 1e-9,   // output is float32 (audio buffer precision)
    `EQ: linear convolution, zero-phase aligned, no wrap-around (edge err ${err.toExponential(1)}, far-end ${tail.toExponential(1)})`);

  // flat curve -> identity
  const hf = designEqFir([[0, 0], [24000, 0]], SR);
  let rnd = 7; const rand = () => { rnd = (rnd * 16807) % 2147483647; return rnd / 2147483647 - 0.5; };
  const xs = Float64Array.from({ length: 48000 }, rand);
  const yf = firConvolve(xs, hf); let mx = 0;
  for (let i = 5000; i < 43000; i++) mx = Math.max(mx, Math.abs(yf[i] - xs[i]));
  check(mx < 1e-4, `EQ: flat curve passes audio unchanged (max diff ${mx.toExponential(1)})`);

  // speech-ish noise (for round trip and level)
  const N = 480000, noise = new Float64Array(N); let lp = 0;
  for (let i = 0; i < N; i++) { lp = 0.9 * lp + rand(); noise[i] = 0.05 * lp; }
  const nb = { sampleRate: SR, numberOfChannels: 1, length: N, duration: N / SR, getChannelData: () => noise };
  const g = eqLevelScale(nb, curve, h);

  // round trip: curve-shaped de-emphasised copy vs original (momentary LUFS)
  const seg = noise.slice(0, 96000), sb = (a) => ({ sampleRate: SR, numberOfChannels: 1, length: a.length, getChannelData: () => a });
  const eqSeg = firConvolve(seg, h);
  const rt = momentaryLUFSOf(shapeByCurve(sb(eqSeg), curve)) - momentaryLUFSOf(sb(seg));
  check(Math.abs(rt) < 0.1, `EQ: headphone(de-emphasis(x)) = x (round-trip loudness difference ${rt.toFixed(3)} dB, before level scale)`);

  // level: A-weighted level at the ear of scaled-equalised noise == raw noise (independent FFT path)
  const aCurve = []; for (let f = 1; f < 24000; f *= 1.01) aCurve.push([f, 10 * Math.log10(aWeightPow(f))]);
  aCurve.unshift([0, aCurve[0][1]]);
  const ms = (a) => { let e = 0; for (const v of a) e += v * v; return e / a.length; };
  const rawEar = shapeByCurve(shapeByCurve(nb, curve), aCurve).getChannelData(0);
  const eqNoise = firConvolve(noise, h).map(v => v * g);
  const eqEar = shapeByCurve(shapeByCurve(sb(eqNoise), curve), aCurve).getChannelData(0);
  const dLevel = 10 * Math.log10(ms(eqEar) / ms(rawEar));
  check(Math.abs(dLevel) < 0.1, `EQ: calibration noise keeps its dB(A) at the ear (difference ${dLevel.toFixed(3)} dB; level scale ${db(g).toFixed(2)} dB)`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
