// File: normalise.js
// -----------------------------------------------------------------------------
// UC4AFC — word normalisation at presentation.
//
// A normalisation table (made and saved by word-normalisation.html) gives, for
// each word, the level at which it is played for any level the procedure asks
// for, so that every word is about as hard as the average word:
//
//   played = midpoint_word + ratio_word × (requested − midpoint_target)
//
// on the mode's own axis (octaves = log2 Hz for LPF, dB for SNR). With the
// basic method the ratio is 1 (a shift); with the O'Beirne/Gibbins method it
// also matches the slope. The table's optional limit keeps the adjustment
// within ±n dB (SNR) or ±n octaves (LPF) of the requested level. LPF cutoffs
// also stay within the filter's 75 Hz–20 kHz. SNR has no other bound.
//
// Each mode (LPF, SNR) has its own setting on this device: Off, Central table
// (UC4AFC_normalisation_LPF.txt / _SNR.txt next to index.html, fetched fresh,
// with the last good copy kept for offline use) or Table file (loaded or
// pasted on this device). The same setting is used by adaptive runs (flow.js)
// and constant-stimuli runs (constant.js). A run takes a snapshot of the table
// when it starts, so a table changed mid-run doesn't affect it, and the
// snapshot goes into the results.
// -----------------------------------------------------------------------------

const NORM_KEYS = {
  state: "uc4afc_norm",                                                // { lpf|snr: { source, text } }
  central: { snr: "uc4afc_norm_central_snr", lpf: "uc4afc_norm_central_lpf" }
};
const NORM_CENTRAL_FILES = { snr: "UC4AFC_normalisation_SNR.txt", lpf: "UC4AFC_normalisation_LPF.txt" };
const NORM_LPF_RANGE = [Math.log2(75), Math.log2(20000)];
const NORM_CENTRAL = { snr: null, lpf: null };   // { status, text, url, updated, fetchedAt, note }
const NORM_MOUNTS = [];                          // rendered blocks: { el, mode }
const normParseCache = new Map();                // text -> parsed table

// ---- persisted per-mode setting ---------------------------------------------
function normStateAll() {
  try { const o = JSON.parse(localStorage.getItem(NORM_KEYS.state) || "{}"); return o && typeof o === "object" ? o : {}; }
  catch (_) { return {}; }
}
function normState(mode) {
  const s = normStateAll()[mode] || {};
  const source = (s.source === "central" || s.source === "own") ? s.source : "off";
  return { source, text: typeof s.text === "string" ? s.text : "" };
}
function normStore(mode, patch) {
  try {
    const o = normStateAll();
    o[mode] = { ...normState(mode), ...patch };
    localStorage.setItem(NORM_KEYS.state, JSON.stringify(o));
  } catch (_) {}
}
const normModeOk = m => m === "lpf" || m === "snr";

// ---- parsing ------------------------------------------------------------------
function normParse(text) {
  const key = String(text || "");
  if (normParseCache.has(key)) return normParseCache.get(key);
  const lines = key.replace(/\r/g, "").split("\n");
  const h = {}, errors = [], warnings = [];
  let headAt = -1;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const m = l.match(/^#\s*([^\t]+)\t(.*)$/);
    if (m) { const k = m[1].trim(); if (!(k in h)) h[k] = m[2].trim(); continue; }
    if (/^Word\t/i.test(l)) { headAt = i; break; }
  }
  const out = { ok: false, errors, warnings, mode: "", name: h["Name"] || "", method: h["Method"] || "",
    cap: h["Slope ratio cap"] || "", ceiling: h["Ceiling"] || "", limitText: h["Adjustment limit"] || "none",
    lim: 0, target: NaN, targetText: "", words: new Map(), unadjusted: [], rows: 0 };
  if (!key.trim()) { errors.push("No table loaded."); normParseCache.set(key, out); return out; }
  const mode = String(h["Mode"] || "").trim().toLowerCase();
  if (!normModeOk(mode)) errors.push("The table has no “# Mode” line saying LPF or SNR.");
  out.mode = mode;
  const tKey = Object.keys(h).find(k => /^Target midpoint/i.test(k));
  const tv = tKey ? parseFloat(String(h[tKey]).replace("−", "-")) : NaN;
  if (!Number.isFinite(tv) || (mode === "lpf" && tv <= 0)) errors.push("The table has no target midpoint.");
  else { out.target = mode === "lpf" ? Math.log2(tv) : tv; out.targetText = mode === "lpf" ? `${Math.round(tv)} Hz` : `${tv.toFixed(1)} dB SNR`; }
  const lm = String(out.limitText).match(/(\d+(?:\.\d+)?)/);
  out.lim = /none/i.test(out.limitText) || !lm ? 0 : Number(lm[1]);
  if (headAt < 0) errors.push("The table has no “Word” column heading.");
  else {
    const head = lines[headAt].split("\t").map(s => s.trim());
    const iM = head.findIndex(c => /^Midpoint/i.test(c));
    const iR = head.findIndex(c => /^Slope ratio used/i.test(c));
    if (iM < 0 || iR < 0) errors.push("The table needs “Midpoint” and “Slope ratio used” columns.");
    else {
      for (let i = headAt + 1; i < lines.length; i++) {
        const c = lines[i].split("\t");
        const w = (c[0] || "").trim();
        if (!w || w.startsWith("#")) continue;
        out.rows++;
        const mid = parseFloat(String(c[iM] || "").replace("−", "-"));
        const r = parseFloat(c[iR]);
        if (Number.isFinite(mid) && Number.isFinite(r) && r > 0 && (mode !== "lpf" || mid > 0)) {
          out.words.set(w, { m: mode === "lpf" ? Math.log2(mid) : mid, r });
        } else out.unadjusted.push(w);
      }
      if (!out.rows) errors.push("The table has no word rows.");
    }
  }
  out.ok = errors.length === 0;
  normParseCache.set(key, out);
  return out;
}

// The level a word is played at for a requested level, with a table parsed by
// normParse. Levels in the mode's own unit (Hz for LPF, dB SNR for SNR).
function normPlayed(T, mode, word, requested) {
  if (!T || !T.ok) return { played: requested, adjusted: false, limited: false };
  const w = T.words.get(word);
  if (!w) return { played: requested, adjusted: false, limited: false };
  const lpf = mode === "lpf";
  const N = lpf ? Math.log2(requested) : requested;
  let x = w.m + w.r * (N - T.target), limited = false;
  if (T.lim > 0) {
    const c = Math.min(N + T.lim, Math.max(N - T.lim, x));
    if (c !== x) { limited = true; x = c; }
  }
  if (lpf) {
    const c = Math.min(NORM_LPF_RANGE[1], Math.max(NORM_LPF_RANGE[0], x));
    if (c !== x) { limited = true; x = c; }
  }
  return { played: lpf ? Math.pow(2, x) : x, adjusted: true, limited };
}

// ---- central tables ----------------------------------------------------------
function normCentralUrl(mode) {
  const c = (typeof config !== "undefined" && config && config.normalisationTables) || {};
  return (typeof c[mode] === "string" && c[mode].trim()) || NORM_CENTRAL_FILES[mode];
}
function normCentralSaved(mode) {
  try { const o = JSON.parse(localStorage.getItem(NORM_KEYS.central[mode]) || "null"); return o && typeof o.text === "string" ? o : null; }
  catch (_) { return null; }
}
async function normCentralFetch(mode) {
  const url = normCentralUrl(mode);
  NORM_CENTRAL[mode] = { status: "loading", text: "", url };
  normRenderAll();
  let entry;
  try {
    const res = await fetch(`${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(res.status === 404 ? "not found on the website" : `HTTP ${res.status}`);
    const text = await res.text();
    const lm = res.headers.get("Last-Modified");
    entry = { status: "ok", text, url, updated: lm ? new Date(lm).toISOString() : null, fetchedAt: new Date().toISOString() };
    try { localStorage.setItem(NORM_KEYS.central[mode], JSON.stringify(entry)); } catch (_) {}
  } catch (err) {
    const saved = normCentralSaved(mode);
    entry = saved && saved.url === url
      ? { ...saved, status: "saved", note: String(err && err.message || err) }
      : { status: "error", text: "", url, note: String(err && err.message || err) };
  }
  NORM_CENTRAL[mode] = entry;
  normRenderAll();
}
// Fetch the central table for every mode set to use it (at start-up and
// whenever a screen that shows the setting opens).
function normRefreshCentral() {
  for (const m of ["lpf", "snr"]) if (normState(m).source === "central") normCentralFetch(m);
}

// ---- what a run uses -----------------------------------------------------------
// { on:false } when off; otherwise { on, ok, reason, source, text, table, … }.
function normCurrent(mode) {
  if (!normModeOk(mode)) return { on: false, mode };
  const st = normState(mode);
  if (st.source === "off") return { on: false, mode };
  let text = "", meta = {};
  if (st.source === "central") {
    const c = NORM_CENTRAL[mode];
    if (!c || c.status === "loading") return { on: true, ok: false, mode, source: "central", reason: "The central normalisation table is still loading. Try again in a moment." };
    if (c.status === "error") return { on: true, ok: false, mode, source: "central", reason: `The central normalisation table couldn't be loaded (${c.note}). Choose Table file or Off in Setup.` };
    text = c.text;
    meta = { file: c.url, updated: c.updated || null, offlineCopy: c.status === "saved" };
  } else {
    text = st.text;
  }
  const table = normParse(text);
  const modeUp = mode.toUpperCase();
  let reason = "";
  if (!table.ok) reason = `The ${modeUp} normalisation table needs fixing: ${table.errors[0]}`;
  else if (table.mode !== mode) reason = `The normalisation table loaded for ${modeUp} is a ${table.mode.toUpperCase()} table.`;
  return { on: true, ok: !reason, reason, mode, source: st.source, text, table, ...meta };
}
// A run's snapshot (null when normalisation is off). Throws nothing: callers
// check .ok and show .reason. The table text is kept so a resumed run can
// rebuild it exactly.
function normSnapshot(mode) {
  const c = normCurrent(mode);
  if (!c.on) return null;
  if (!c.ok) return { ok: false, reason: c.reason };
  return { ok: true, mode, source: c.source, file: c.file || "", updated: c.updated || null, offlineCopy: !!c.offlineCopy,
    name: c.table.name || "unnamed table", text: c.text };
}
const normTableOf = snap => (snap && snap.ok ? normParse(snap.text) : null);
function normPlayedSnap(snap, word, requested) {
  if (!snap || !snap.ok) return { played: requested, adjusted: false, limited: false };
  return normPlayed(normTableOf(snap), snap.mode, word, requested);
}

// Header lines for a results file (mode lpf/snr only).
function normHeaderLines(snap, mode) {
  if (!normModeOk(mode)) return [];
  if (!snap || !snap.ok) return [`# Normalisation\toff`];
  const T = normTableOf(snap);
  const where = snap.source === "central"
    ? `central table ${snap.file}${snap.updated ? ` (last changed ${snap.updated})` : ""}${snap.offlineCopy ? ", saved copy (website unreachable)" : ""}`
    : "table file loaded on this device";
  const words = (typeof list !== "undefined" && Array.isArray(list)) ? [...new Set(list.map(r => r && r.correct).filter(Boolean))] : [];
  const nAdj = words.length ? words.filter(w => T.words.has(w)).length : T.words.size;
  return [
    `# Normalisation\t${snap.name}`,
    `# Normalisation source\t${where}`,
    `# Normalisation settings\ttarget midpoint ${T.targetText}; ${T.method || "method not stated"}` +
      `${T.cap ? `; slope ratio cap ${T.cap}` : ""}; limit ${T.limitText}` +
      `${words.length ? `; ${nAdj} of ${words.length} words adjusted` : ""}`
  ];
}
// For JSON results.
function normJson(snap) {
  if (!snap || !snap.ok) return { on: false };
  const T = normTableOf(snap);
  return { on: true, name: snap.name, source: snap.source, file: snap.file || undefined, updated: snap.updated || undefined,
    offlineCopy: snap.offlineCopy || undefined, target: T.targetText, method: T.method, cap: T.cap, limit: T.limitText, table: snap.text };
}

// ---- the setting's on-screen block ------------------------------------------------
// Norm.mount(el) builds the controls into `el` once; Norm.show(el, mode) points
// it at a mode (lpf, snr or quiet). Several blocks (Setup, Constant stimuli)
// share the same stored setting and stay in step.
function normMount(el) {
  if (!el || el._normMounted) return;
  el._normMounted = true;
  el.innerHTML = `
    <span class="setup-label">Word normalisation</span>
    <p class="small norm-intro" style="margin-top:0;">Plays each word at the level that makes it about as hard as the average word, from a table saved by the word-normalisation page. Used by adaptive and constant-stimuli runs in this mode. Saved on this device as soon as you change it.</p>
    <p class="small norm-quiet" hidden style="margin-top:0;">Not used in quiet mode.</p>
    <div class="norm-body">
      <div class="segmented cs-source norm-seg" style="margin-bottom:0.5rem;">
        <button type="button" data-normsrc="off" class="seg-btn">Off</button>
        <button type="button" data-normsrc="central" class="seg-btn">Central table</button>
        <button type="button" data-normsrc="own" class="seg-btn">Table file</button>
      </div>
      <div class="cs-plan norm-central" hidden>
        <p class="small norm-cinfo" style="margin:0 0 0.4rem;"></p>
        <button type="button" class="cs-plan-clear norm-reload" style="margin-left:0;">Check for updates</button>
        <details class="cs-central-show"><summary>Show the table</summary><pre class="norm-pre"></pre></details>
      </div>
      <div class="cs-plan norm-own" hidden>
        <p class="small" style="margin:0 0 0.4rem;">Load a table saved by the word-normalisation page, or paste its text below. It's kept on this device only. LPF and SNR each keep their own table.</p>
        <label class="cs-filebtn">Load table file…
          <input class="norm-file" type="file" accept=".txt,.tsv,text/plain,text/tab-separated-values">
        </label>
        <button type="button" class="cs-plan-clear norm-clear">Clear</button>
        <textarea class="norm-text" rows="6" spellcheck="false" autocapitalize="off" autocomplete="off" wrap="off" aria-label="Normalisation table text"></textarea>
      </div>
      <div class="cs-plan-check norm-check" aria-live="polite"></div>
    </div>`;
  const q = s => el.querySelector(s);
  el.querySelectorAll("[data-normsrc]").forEach(b => b.addEventListener("click", () => {
    const mode = el.dataset.mode;
    if (!normModeOk(mode)) return;
    normStore(mode, { source: b.dataset.normsrc });
    if (b.dataset.normsrc === "central" && (!NORM_CENTRAL[mode] || NORM_CENTRAL[mode].status === "error")) normCentralFetch(mode);
    normRenderAll();
  }));
  q(".norm-reload").addEventListener("click", () => { if (normModeOk(el.dataset.mode)) normCentralFetch(el.dataset.mode); });
  q(".norm-text").addEventListener("input", () => {
    if (!normModeOk(el.dataset.mode)) return;
    normStore(el.dataset.mode, { text: q(".norm-text").value });
    normRenderAll(el);
  });
  q(".norm-file").addEventListener("change", async () => {
    const inp = q(".norm-file"), f = inp.files && inp.files[0];
    inp.value = "";
    if (!f || !normModeOk(el.dataset.mode)) return;
    try { normStore(el.dataset.mode, { text: await f.text() }); } catch (_) { alert(`Couldn't read ${f.name}.`); }
    normRenderAll();
  });
  q(".norm-clear").addEventListener("click", () => {
    const mode = el.dataset.mode;
    if (!normModeOk(mode)) return;
    if (normState(mode).text.trim() && !confirm(`Clear the ${mode.toUpperCase()} normalisation table on this device?`)) return;
    normStore(mode, { text: "" });
    normRenderAll();
  });
  NORM_MOUNTS.push(el);
}
function normShow(el, mode) {
  if (!el) return;
  normMount(el);
  el.dataset.mode = mode;
  normRender(el);
}
const normFmtDate = iso => { try { return new Date(iso).toLocaleString("en-NZ", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }); } catch (_) { return iso; } };
function normRender(el, skipText) {
  const mode = el.dataset.mode, q = s => el.querySelector(s);
  const ok = normModeOk(mode);
  q(".norm-quiet").hidden = ok;
  q(".norm-intro").hidden = !ok;
  q(".norm-body").hidden = !ok;
  if (!ok) return;
  const st = normState(mode);
  el.querySelectorAll("[data-normsrc]").forEach(b => b.classList.toggle("active", b.dataset.normsrc === st.source));
  q(".norm-central").hidden = st.source !== "central";
  q(".norm-own").hidden = st.source !== "own";
  if (!skipText && q(".norm-text").value !== st.text) q(".norm-text").value = st.text;
  const c = NORM_CENTRAL[mode];
  const info = q(".norm-cinfo");
  info.textContent = !c ? "" :
    c.status === "loading" ? `Loading ${c.url} from the website…` :
    c.status === "ok" ? `From ${c.url} on the website${c.updated ? `, last changed ${normFmtDate(c.updated)}` : ""}.` :
    c.status === "saved" ? `Couldn't reach the website (${c.note}), so using the copy fetched ${normFmtDate(c.fetchedAt)}.` :
    `Couldn't load ${c.url} (${c.note}) and there's no saved copy on this device.`;
  info.style.color = c && c.status === "error" ? "#b31b1b" : c && c.status === "saved" ? "#8a5a00" : "";
  q(".norm-pre").textContent = (c && c.text) || "";
  const out = q(".norm-check");
  out.textContent = "";
  const line = (cls, t) => { const d = document.createElement("div"); d.className = cls; d.textContent = t; out.appendChild(d); };
  const cur = normCurrent(mode);
  if (!cur.on) { line("", "Off: every word is played at the level the procedure asks for."); return; }
  if (cur.source === "central" && (!c || c.status === "loading" || c.status === "error")) { if (c && c.status === "error") line("err", "✗ No central table available: choose Table file or Off."); return; }
  if (cur.source === "own" && !cur.text.trim()) { line("warn", "No table loaded yet."); return; }
  const T = cur.table;
  T.errors.forEach(e => line("err", "✗ " + e));
  if (T.ok && T.mode !== mode) line("err", `✗ This is a ${T.mode.toUpperCase()} table; this mode is ${mode.toUpperCase()}.`);
  if (!cur.ok) return;
  const words = (typeof list !== "undefined" && Array.isArray(list)) ? [...new Set(list.map(r => r && r.correct).filter(Boolean))].sort() : [];
  const nAdj = words.filter(w => T.words.has(w)).length;
  const notIn = words.filter(w => !T.words.has(w) && !T.unadjusted.includes(w));
  const unadj = words.filter(w => T.unadjusted.includes(w));
  line("ok", `✓ ${T.name ? `“${T.name}”: ` : ""}${words.length ? `${nAdj} of ${words.length} words adjusted` : `${T.words.size} words adjusted`}; target midpoint ${T.targetText}; ${T.method || "method not stated"}${T.cap ? `, slope ratio cap ×${T.cap}` : ""}, limit ${T.limitText}.`);
  if (unadj.length) line("warn", `! Played at the requested level (the table doesn't adjust them): ${unadj.join(", ")}.`);
  if (notIn.length) line("warn", `! Not in the table, so played at the requested level: ${notIn.join(", ")}.`);
  if (el.dataset.context === "cs") line("", "Levels below are requested levels: each word is played at its adjusted level. With normalisation on, every word would normally get the same levels.");
}
function normRenderAll(except) {
  for (const el of NORM_MOUNTS) if (el.dataset.mode) normRender(el, el === except);
  normIntroHint();
}

// One line on the front page when the adaptive mode's normalisation is on.
function normIntroHint() {
  const el = document.getElementById("normHint");
  if (!el) return;
  const mode = (typeof config !== "undefined" && config && config.adaptive && config.adaptive.mode) || "lpf";
  const cur = normCurrent(mode);
  if (!cur.on) { el.textContent = ""; el.hidden = true; return; }
  el.hidden = false;
  el.textContent = cur.ok ? `Word normalisation on (${mode.toUpperCase()}): ${cur.table.name || "unnamed table"}.`
    : (cur.reason && /loading/.test(cur.reason) ? `Word normalisation on (${mode.toUpperCase()}): loading the table…` : `Word normalisation: ${cur.reason}`);
  el.style.color = cur.ok ? "" : "#b31b1b";
}

function normInit() {
  normRefreshCentral();
  document.addEventListener("uc4afc:screen", (e) => {
    if (e.detail === "setup" || e.detail === "conststim" || e.detail === "intro") {
      if (e.detail !== "intro") normRefreshCentral();
      normRenderAll();
    }
  });
  normIntroHint();
}

if (typeof window !== "undefined") {
  window.Norm = { parse: normParse, played: normPlayed, current: normCurrent, snapshot: normSnapshot, playedSnap: normPlayedSnap,
    headerLines: normHeaderLines, json: normJson, mount: normMount, show: normShow, init: normInit, refreshCentral: normRefreshCentral };
}

export { normParse, normPlayed, normCurrent, normSnapshot, normPlayedSnap, normHeaderLines, normJson, normMount, normShow, normInit, normRefreshCentral };
