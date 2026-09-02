/* ─────────────────────────────────────────────────────────────────────────
   nonadaptive.js — Optional non-adaptive (fixed-level) comparison block for the
   thesis experiment.

   WHY THIS EXISTS
   The equivalence study compares adaptive SRTs against conventional non-adaptive
   speech scores. There is no CVC *adaptive* norm in the literature, so to
   validate CVC-adaptive we also need CVC presented the conventional (fixed-level,
   PI-function) way. This module threads an optional block of THREE fixed-level
   lists into the run, per language, entirely under clinician control.

   Design decisions (from the Sep 2026 Roux/O'Beirne thread):
     • OFF by default. Two independent tickboxes — one for CVC (English), one for
       CVCV (Māori). Both start unticked; the whole block is optional at the point
       of testing so timing can be trialled (90-min session, 3 repeats/ear).
       The CVCV box carries a caveat: no CVCV list-equivalence has been
       established, so it is provided for timing/exploration only.
     • Levels are PROPOSED from the audiogram via the UC PI-max/HPL protocol
       (reusing ParticipantInputs), and remain EDITABLE THROUGHOUT — a clinician
       who sees an unexpectedly good score can drop the next level a long way to
       chase a half-peak. Nothing is locked in from the start. If ParticipantInputs
       has no usable threshold, the fields fall back to blank/manual.
     • Masker level is likewise PROPOSED from protocol (Level(TE) − IAA + ABgap +
       10, via the existing Masking engine) and is editable.
     • Candidate LISTS are the three whose words the adaptive schedule presented
       only AT OR BELOW that ear's threshold (lowest-level exposure) — chosen per
       participant at run time to minimise practice effect. Because that ranking
       needs adaptive data to exist, the block DEFAULTS to a group of three at the
       END of the run, but may be placed elsewhere; when placed earlier it ranks
       on whatever adaptive data has accumulated so far and warns if that is thin.

   This module is self-contained: it reads/writes the shared `state`, drives the
   app's existing fixed-mode queue (setTestMode("fixed") + the normal list queue),
   and appends to the experiment CSV stores via Experiment hooks. It adds NO
   behaviour to the normal (non-experiment) flow.
   ──────────────────────────────────────────────────────────────────────── */
(function (global) {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const LANGS = [
    { key: "english", label: "CVC (NZ English)", listMax: 12, caveat: null },
    { key: "maori",   label: "CVCV (te reo Māori)", listMax: 10,
      caveat: "No CVCV list-equivalence has been established — for timing/exploration only." }
  ];
  const EARS = [
    { key: "left",     short: "L",   label: "Left" },
    { key: "right",    short: "R",   label: "Right" },
    { key: "binaural", short: "Bin", label: "Binaural" }
  ];

  // ── Settings, persisted on state so they survive a reload ───────────────
  // Model: per language, a per-ear on/off map. A language contributes a
  // non-adaptive block for each ear that is ticked. Left and Right default ON,
  // Binaural OFF; the language master tickbox turns the whole language on/off and
  // reflects whether any ear is selected.
  function defaultEars(on) { return { left: on, right: on, binaural: false }; }
  function cfg() {
    const s = global.state || (global.state = {});
    if (!s.nonAdaptive) {
      s.nonAdaptive = {
        // Master on/off per language — both OFF by default (session time).
        include: { english: false, maori: false },
        // Which ears to run for each language when it's on. L+R on by default.
        ears: { english: defaultEars(true), maori: defaultEars(true) },
        placement: "end",                           // "end" | "shuffled"
        nLists: 3,
        plan: {}                                     // plan[lang][ear] = {...}
      };
    }
    // Back-compat / integrity: ensure the ears map exists.
    if (!s.nonAdaptive.ears) s.nonAdaptive.ears = { english: defaultEars(true), maori: defaultEars(true) };
    LANGS.forEach(l => { if (!s.nonAdaptive.ears[l.key]) s.nonAdaptive.ears[l.key] = defaultEars(true); });
    return s.nonAdaptive;
  }

  // Ears selected for a language (only meaningful when the language is included).
  function earsFor(language) {
    const e = cfg().ears[language] || {};
    return EARS.filter(x => e[x.key]).map(x => x.key);
  }

  // ── Level proposal (UC PI-max / HPL protocol) ───────────────────────────
  // PI-max seed: reference threshold + band increment (ParticipantInputs already
  // implements the UC band table: 2 kHz + 25/20/15/10/5). HPL seed: PI-max − 15
  // (protocol says 10–20 dB below; 15 is the midpoint). Mid seed: halfway between,
  // snapped to the 5 dB grid. All three are seeds the clinician edits throughout.
  function snap5(v) {
    return (typeof global.snap5 === "function") ? global.snap5(v) : Math.round(Number(v) / 5) * 5;
  }
  function proposeLevels(ear) {
    let piMax = null, source = "manual";
    if (global.ParticipantInputs && typeof global.ParticipantInputs.startLevelFor === "function") {
      const s = global.ParticipantInputs.startLevelFor(ear);
      if (s && Number.isFinite(Number(s.level))) { piMax = Number(s.level); source = s.source || "audiogram"; }
    }
    if (piMax === null) {
      // No threshold available: leave blank for manual entry.
      return { levels: [null, null, null], source: "manual (no audiogram)", editable: true };
    }
    const hpl = piMax - 15;
    const mid = snap5((piMax + hpl) / 2);
    return {
      levels: [snap5(piMax), mid, snap5(hpl)],   // high → low, matching a PI sweep
      labels: ["PI-max", "mid", "HPL"],
      source,
      editable: true
    };
  }

  // ── Masker proposal (reuse the Masking engine, protocol formula) ────────
  // Non-test ear masking = Level(TE) − IAA + ABgap(NTE) + 10. We seed off the
  // PI-max level (the loudest of the three) so the dialled masker safely covers
  // the whole block; the clinician can lower it per list. Returns null when the
  // masking rule says no masking is needed (or there's no data to decide).
  function proposeMasker(ear, piMaxLevel) {
    if (!(global.Masking && typeof global.Masking.recommend === "function")) return null;
    if (!Number.isFinite(Number(piMaxLevel))) return null;
    const transducer = $("transducer") ? $("transducer").value : "";
    let rec = null;
    try {
      rec = global.Masking.recommend({ testEar: ear, PL: Number(piMaxLevel), transducer });
    } catch { return null; }
    if (!rec || !rec.needed || !rec.amount) return { needed: false, level: null, reason: rec ? rec.reason : "" };
    return {
      needed: true,
      level: rec.amount.level,
      maskEar: rec.maskEar,
      overMask: rec.amount.overMask,
      reason: rec.reason
    };
  }

  // ── Candidate list selection (at/below threshold) ───────────────────────
  // Rank the language's lists by how much of their adaptive exposure was AT OR
  // BELOW the ear's estimated threshold: for each list, the fraction of its
  // presented words whose level ≤ (SRT for that condition). Prefer lists with the
  // most sub-threshold exposure (least practice). Ties broken by lower mean level.
  // Falls back to lowest-mean-level, then to any unused numbers, so it always
  // returns three lists even with thin data.
  function adaptiveTrialsSoFar() {
    // Prefer the experiment trial store (authoritative, includes source list &
    // level); fall back to state.results for a live, not-yet-exported run.
    const rows = [];
    const xs = global.state && global.state.experiment;
    if (xs && xs.trialCsv) {
      const lines = xs.trialCsv.split("\n");
      const head = lines[0].split(",");
      const iLang = head.indexOf("language"), iList = head.indexOf("list_number"),
            iLvl = head.indexOf("level_dB"), iEar = head.indexOf("ear");
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i]) continue;
        const c = lines[i].split(",");
        rows.push({ language: c[iLang], list: Number(c[iList]), level: Number(c[iLvl]),
                    ear: c[iEar] === "L" ? "left" : c[iEar] === "R" ? "right" : c[iEar] });
      }
    }
    if (!rows.length && Array.isArray(global.state.results)) {
      global.state.results.forEach(r => {
        if (!r || !r.adaptive) return;
        rows.push({ language: r.language || "maori", list: Number(r.sourceList),
                    level: Number(r.listLevelDbA),
                    ear: r.stimulusEar || r.presentationCondition });
      });
    }
    return rows;
  }

  // Best available SRT estimate for a language+ear, from recorded adaptive tracks.
  function srtFor(language, ear) {
    const tracks = Array.isArray(global.state.adaptiveTracks) ? global.state.adaptiveTracks : [];
    const matches = tracks.filter(t =>
      t && t.language === language &&
      (t.stimulusEar === ear || t.condition === ear) &&
      Number.isFinite(Number(t.srt)));
    if (!matches.length) return null;
    // Mean of the available SRTs for this condition.
    return matches.reduce((s, t) => s + Number(t.srt), 0) / matches.length;
  }

  function chooseCandidateLists(language, ear, listMax, nLists) {
    const rows = adaptiveTrialsSoFar().filter(r => r.language === language && Number.isFinite(r.list));
    const srt = srtFor(language, ear);
    const stat = {};   // list -> { n, sub, sumLvl }
    rows.forEach(r => {
      if (!stat[r.list]) stat[r.list] = { n: 0, sub: 0, sumLvl: 0 };
      stat[r.list].n++;
      stat[r.list].sumLvl += r.level;
      if (srt != null && r.level <= srt) stat[r.list].sub++;
    });
    const all = [];
    for (let l = 1; l <= listMax; l++) {
      const s = stat[l];
      all.push({
        list: l,
        seen: s ? s.n : 0,
        subFrac: s && s.n ? s.sub / s.n : (s ? 0 : 1),   // unseen lists count as fully "unpractised"
        meanLvl: s && s.n ? s.sumLvl / s.n : -Infinity
      });
    }
    // Sort: most sub-threshold exposure first; then lowest mean level; then fewest
    // times seen (least practice). Unseen lists (subFrac defaulted to 1) naturally
    // sort to the top — they carry no practice at all.
    all.sort((a, b) =>
      (b.subFrac - a.subFrac) ||
      (a.meanLvl - b.meanLvl) ||
      (a.seen - b.seen) ||
      (a.list - b.list));
    const chosen = all.slice(0, nLists).map(x => x.list);
    const thinData = rows.length < listMax * 4;   // heuristic: <~4 words/list seen
    return { lists: chosen, thinData, srtUsed: srt, ranking: all.slice(0, nLists) };
  }

  // ── Build the fixed-level queue for one language block ──────────────────
  // Returns an array of queue entries [{listNumber, levelDbA, language}]. One
  // level per list across the PI sweep (a conventional 3-point PI function). The
  // three lists are ALWAYS ordered loudest → middle → quietest, whatever order the
  // candidate-list ranking produced and whether or not levels came from an
  // audiogram (in the manual case the levels are blank but the loud→quiet slot
  // labels still apply). The clinician can re-level any list live afterwards.
  function buildBlock(language, ear) {
    const conf = cfg();
    const L = LANGS.find(x => x.key === language);
    const cand = chooseCandidateLists(language, ear, L.listMax, conf.nLists);
    const prop = proposeLevels(ear);
    // proposeLevels returns high→low; make that explicit and guaranteed here.
    const orderedLevels = prop.levels.slice();          // [loud, mid, quiet]
    const orderedLabels = ["loudest", "middle", "quietest"];
    const piMax = orderedLevels[0];
    const masker = proposeMasker(ear, piMax);
    // Pair each candidate list with a loud→quiet slot, in order.
    let entries = cand.lists.map((listNumber, i) => ({
      listNumber,
      levelDbA: orderedLevels[i] != null ? orderedLevels[i] : "",
      language,
      nonAdaptive: true,
      proposedLabel: orderedLabels[i] || null,
      maskerLevel: masker && masker.needed ? masker.level : null,
      maskEar: masker && masker.needed ? masker.maskEar : (ear === "left" ? "right" : "left")
    }));
    // Enforce loudest → middle → quietest on the actual stored order. When a level
    // is blank (manual, no audiogram) it keeps its proposed slot; numeric levels
    // sort strictly descending. Stable for equal/blank levels.
    entries = entries
      .map((e, idx) => ({ e, idx, lvl: (e.levelDbA === "" ? null : Number(e.levelDbA)) }))
      .sort((a, b) => {
        if (a.lvl == null && b.lvl == null) return a.idx - b.idx;   // keep slot order
        if (a.lvl == null) return 1;    // unknown levels sink below known ones
        if (b.lvl == null) return -1;
        return b.lvl - a.lvl;           // loudest first
      })
      .map(({ e }, i) => Object.assign(e, { proposedLabel: orderedLabels[i] || e.proposedLabel }));
    // Stash the plan in the FINAL presented order (loudest → quietest) so the
    // table, CSV and queue all agree.
    conf.plan[language] = conf.plan[language] || {};
    conf.plan[language][ear] = {
      lists: entries.map(e => e.listNumber),
      levels: entries.map(e => (e.levelDbA === "" ? null : Number(e.levelDbA))),
      levelSource: prop.source,
      masker, thinData: cand.thinData, srtUsed: cand.srtUsed
    };
    if (typeof global.saveSession === "function") global.saveSession();
    return { entries, cand, prop, masker };
  }

  // ── Public: is any non-adaptive block requested? ────────────────────────
  function anyIncluded() {
    return LANGS.some(l => cfg().include[l.key] && earsFor(l.key).length);
  }
  function includedLanguages() {
    return LANGS.filter(l => cfg().include[l.key] && earsFor(l.key).length).map(l => l.key);
  }

  // Ask the experiment harness to rebuild its sequence table (the non-adaptive
  // rows are appended there). Safe no-op if the harness isn't present.
  function refreshExperimentTable() {
    if (global.Experiment && typeof global.Experiment.renderSection === "function") {
      try { global.Experiment.renderSection(); } catch {}
    }
  }

  // ── UI: inject the tickboxes + placement into the experiment card ───────
  // Checkbox styling note: the global stylesheet sets `input { width:100%;
  // padding:.6rem }`, which stretches bare checkboxes across the row and shoves
  // their labels away. Every checkbox here therefore explicitly resets width,
  // min-width, padding and margin so it renders as a normal small box beside its
  // text.
  const CB = 'style="width:auto;min-width:0;flex:0 0 auto;padding:0;margin:0"';
  function ensureUI() {
    if ($("nonAdaptivePanel")) return;
    const host = $("experimentSection");
    if (!host) return;   // experiment card not present/unlocked yet
    const conf = cfg();
    const wrap = document.createElement("div");
    wrap.id = "nonAdaptivePanel";
    wrap.style.marginTop = ".8rem";
    wrap.style.paddingTop = ".6rem";
    wrap.style.borderTop = "1px solid var(--line)";
    wrap.innerHTML = `
      <h3 style="margin:.2rem 0 .4rem;font-size:.95rem">Non-adaptive comparison lists <span class="hint" style="font-weight:normal">(optional)</span></h3>
      <p class="hint" id="naIntro" style="margin:.2rem 0 .6rem">
        Adds fixed-level lists per selected language/ear for the conventional
        PI-function comparison; they appear as extra positions in the sequence
        above. Levels and masking are proposed from the audiogram (UC protocol)
        and stay editable throughout. Off by default — each ear added lengthens
        the session.
      </p>
      <div style="display:flex;flex-direction:column;gap:.6rem">
        ${LANGS.map(l => `
          <div style="display:flex;flex-direction:column;gap:.25rem">
            <label style="display:flex;align-items:center;gap:.5rem;font-weight:600;margin:0;cursor:pointer">
              <input type="checkbox" id="naInclude_${l.key}" ${conf.include[l.key] ? "checked" : ""} ${CB}>
              <span>Include non-adaptive ${l.label}</span>
            </label>
            <div id="naEars_${l.key}" style="display:flex;gap:1rem;padding-left:1.6rem;${conf.include[l.key] ? "" : "opacity:.45;pointer-events:none"}">
              ${EARS.map(e => `
                <label style="display:flex;align-items:center;gap:.35rem;font-weight:normal;margin:0;cursor:pointer">
                  <input type="checkbox" id="naEar_${l.key}_${e.key}" ${conf.ears[l.key][e.key] ? "checked" : ""} ${CB}>
                  <span>${e.label}</span>
                </label>`).join("")}
            </div>
            ${l.caveat ? `<div class="hint" style="padding-left:1.6rem;color:var(--warn,#b45309)">${l.caveat}</div>` : ""}
          </div>`).join("")}
      </div>
      <div style="margin-top:.7rem;max-width:24rem">
        <label style="display:block;margin:0 0 .2rem">Placement
          <select id="naPlacement" style="width:100%">
            <option value="end" ${conf.placement === "end" ? "selected" : ""}>Block at the end (default)</option>
            <option value="shuffled" ${conf.placement === "shuffled" ? "selected" : ""}>Shuffled into the run</option>
          </select>
        </label>
        <div class="hint" id="naPlacementHint" style="margin-top:.25rem"></div>
      </div>
      <div id="naSummary" class="hint" style="margin-top:.5rem"></div>`;
    host.appendChild(wrap);

    LANGS.forEach(l => {
      const master = $("naInclude_" + l.key);
      if (master) master.addEventListener("change", () => {
        cfg().include[l.key] = master.checked;
        // Ghost/enable the ear row.
        const earRow = $("naEars_" + l.key);
        if (earRow) {
          earRow.style.opacity = master.checked ? "" : ".45";
          earRow.style.pointerEvents = master.checked ? "" : "none";
        }
        persistAndRefresh();
      });
      EARS.forEach(e => {
        const cb = $(`naEar_${l.key}_${e.key}`);
        if (cb) cb.addEventListener("change", () => {
          cfg().ears[l.key][e.key] = cb.checked;
          persistAndRefresh();
        });
      });
    });
    const pl = $("naPlacement");
    if (pl) pl.addEventListener("change", () => { cfg().placement = pl.value; persistAndRefresh(); });

    renderSummary();
  }

  function persistAndRefresh() {
    if (typeof global.saveSession === "function") global.saveSession();
    renderSummary();
    refreshExperimentTable();   // fold the change into the sequence table
  }

  // Short status line under the controls (the detailed per-position listing now
  // lives in the sequence table itself).
  function renderSummary() {
    const box = $("naSummary");
    const hint = $("naPlacementHint");
    const conf = cfg();
    if (hint) {
      hint.textContent = conf.placement === "shuffled"
        ? "When shuffled earlier, list ranking uses only the adaptive data collected so far."
        : "Runs after the adaptive administrations, when all lists have been ranked.";
    }
    if (!box) return;
    const parts = [];
    LANGS.forEach(l => {
      if (!conf.include[l.key]) return;
      const ears = earsFor(l.key);
      if (ears.length) parts.push(`${l.label}: ${ears.map(e => EARS.find(x => x.key === e).short).join("/")}`);
    });
    const n = countBlocks();
    box.innerHTML = parts.length
      ? `Adding <b>${n}</b> non-adaptive ${n === 1 ? "block" : "blocks"} — ${parts.join("; ")}. They appear as extra positions in the sequence above.`
      : "<em>No non-adaptive block — no ears selected.</em>";
  }

  // Total number of non-adaptive blocks currently requested (language × ear).
  function countBlocks() {
    return LANGS.reduce((n, l) => n + (cfg().include[l.key] ? earsFor(l.key).length : 0), 0);
  }

  // ── Public: enqueue the non-adaptive block(s) for the current ear/lang ──
  // Called by the experiment stepper when it reaches a non-adaptive slot (end or
  // shuffled). Sets fixed mode and pushes the three lists at their proposed
  // levels into the normal queue, then hands control to the app's test screen.
  function runBlock(language, ear) {
    if (typeof global.setTestMode === "function") global.setTestMode("fixed");
    if (typeof global.setLanguage === "function") global.setLanguage(language, { silent: true });
    if ($("stimEar")) { $("stimEar").value = ear; if (typeof $("stimEar").onchange === "function") { try { $("stimEar").onchange(); } catch {} } }
    if ($("presentationCondition")) $("presentationCondition").value = ear;

    const { entries, cand, masker } = buildBlock(language, ear);
    // Reset the queue to just this block's lists.
    global.state.queue = entries.map(e => ({
      listNumber: e.listNumber,
      levelDbA: (typeof global.clampLevel === "function" && e.levelDbA !== "")
        ? global.clampLevel(e.levelDbA) : e.levelDbA,
      language,
      status: "queued",
      nonAdaptive: true,
      id: (global.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now() + Math.random())
    }));
    global.state.currentListIndex = 0;
    // Seed the live masker from the proposal (editable on-screen).
    if (masker && masker.needed) {
      if ($("maskLevel")) $("maskLevel").value = masker.level;
      if ($("maskEar")) $("maskEar").value = masker.maskEar;
    }
    if (typeof global.saveSession === "function") global.saveSession();
    return { entries, cand, masker };
  }

  // ── Init / expose ───────────────────────────────────────────────────────
  function init() { ensureUI(); }

  global.NonAdaptive = {
    init, ensureUI, renderSummary,
    anyIncluded, includedLanguages, earsFor, countBlocks,
    proposeLevels, proposeMasker, chooseCandidateLists, buildBlock, runBlock,
    cfg
  };

  // The experiment module calls NonAdaptive.init() after it renders its section.
  // Also self-init on load in case the section already exists.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(init, 0));
  } else {
    setTimeout(init, 0);
  }
})(typeof window !== "undefined" ? window : globalThis);
