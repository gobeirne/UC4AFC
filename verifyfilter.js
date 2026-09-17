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

// Log-spaced probe frequencies from 20 Hz to just under Nyquist.
function vfBuildFreqs() {
  const fMin = 20, fMax = VF.sr / 2 * 0.98;
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

function vfUpdateReadout() {
  const el = document.getElementById("vfReadout");
  if (!el) return;
  const at = vfAnalyticAtCutoff();
  const slope = vfSlopeDbPerOct();
  el.textContent =
    `Analytic at ${VF.cutoff} Hz: ${at.toFixed(2)} dB (target −3.01). ` +
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
    // Seed cutoff from the slider's current value.
    const sl = document.getElementById("vfCutoff");
    if (sl) VF.cutoff = Number(sl.value) || VF.cutoff;
    vfRecompute();
  };

  const screen = document.getElementById("verifyfilter");
  if (!screen) return;

  const slider = document.getElementById("vfCutoff");
  const label = document.getElementById("vfCutoffLabel");
  if (slider) {
    const onMove = () => {
      VF.cutoff = Number(slider.value) || VF.cutoff;
      if (label) label.textContent = `${VF.cutoff} Hz`;
      // Analytic updates instantly on drag; measurement restarts on release.
      vfComputeAnalytic();
      vfUpdateReadout();
      vfDraw();
    };
    slider.addEventListener("input", onMove);
    slider.addEventListener("change", () => { onMove(); vfRunAveraging(); });
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

export { setupVerifyFilter };
