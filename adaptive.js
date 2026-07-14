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
    // A fit pinned to an axis bound is not identifiable (the near-separable
    // window collapses the MLE onto xlo/xhi). Flag it alongside the explicit
    // all-correct/all-incorrect degeneracy from fitMLE.
    const eps = 1e-6;
    const pinned = (fit.srtX <= cfg.xlo + eps) || (fit.srtX >= cfg.xhi - eps);
    return {
      srtX: fit.srtX,
      slope: fit.slope,
      degenerate: !!fit.degenerate || pinned,
      pinned,
      value,                    // Hz (LPF) or dB (quiet)
      unit: cfg.unit,
      thresholdHz: value,       // LPF-friendly alias
      thresholdValue: value
    };
  }

  // "If the run stopped at the current trial": the FINAL estimator (fitMLE)
  // applied to all trials collected so far. Identical estimator to estimate();
  // this name documents intent for the per-trial stop-at-n column. Returns the
  // value or null when the fit is degenerate/pinned (so the stopping curve has
  // honest gaps rather than floor-pinned artefacts).
  function stopAtEstimate() {
    const e = estimate();
    return e.degenerate ? null : e.value;
  }

  function history() {
    return xs.map((xi, i) => ({ x: xi, value: xToHz(xi), cutoffHz: xToHz(xi), correct: ys[i] === 1 }));
  }

  // The RUNNING estimate is only meaningful once the coarse initial phase is
  // over — before the phase switch (switchRev reversals) an MLE on sparse,
  // near-monotonic data is degenerate and thrashes (pins to a bound / overshoots).
  // This gates the PER-TRIAL running estimate only; the FINAL estimate() is
  // always computed from the complete track and is unaffected. WUDR uses the
  // phase switch; A1/A2 have no phases, so they reuse switchRev as a reversal
  // floor for the same "enough information" reason.
  function estimateReady() {
    const need = (typeof cfg.switchRev === "number" && cfg.switchRev > 0) ? cfg.switchRev : 0;
    if (need === 0) return true; // single-phase: no gating requested
    return reversalCount() >= need;
  }
  function reversalCount() {
    return (cfg.procedure === "a2") ? (A2.T[0].rev + A2.T[1].rev) : rev;
  }

  return {
    currentX, currentValue, currentCutoffHz, update, estimate, stopAtEstimate,
    unit: cfg.unit, mode: cfg.mode, axisIsLog: cfg.axisIsLog,
    trials: () => xs.length,
    done: () => xs.length >= cfg.nTrials,
    history,
    reversals: reversalCount,
    estimateReady
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

export {
  createTrack, resolveTrackConfig, fitMLE, midpointTarget,
  intelligibility, slopeToK
};
