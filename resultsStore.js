// File: resultsStore.js
// -----------------------------------------------------------------------------
// In-app Results store (the UC_CVCV / UC_KTT model).
//
//   * Every test run (adaptive and normalisation) is kept on the device in
//     IndexedDB and re-saved after EVERY response, so closing the app, a crash
//     or a flat battery loses nothing. Downloads still happen as before; this is
//     the working copy, not a replacement for them.
//   * IndexedDB rather than localStorage: all three apps (UC-4AFC, UC_CVCV,
//     UC_KTT) share the gobeirne.github.io origin, whose localStorage quota is
//     only ~5 MB in total, and a normalisation run is 30–60 KB.
//   * A run left "active" when the app last closed is marked "interrupted" on
//     the next load. Normalisation runs that weren't completed can be resumed.
//   * Results screen: newest first; Download / Copy / Resume / Delete per run,
//     plus "Download all (.zip)" — every file with its normal name, in one go.
//
// Record: { id, kind: "adaptive"|"normalisation", mode, participant, listId,
//   startedAt, updatedAt, status: "active"|"complete"|"aborted"|"interrupted",
//   done, total, summary, baseName, txt, json, resume? }
// -----------------------------------------------------------------------------

const RS_DB = "uc4afc_results", RS_STORE = "runs";
let rsDbPromise = null;
let rsPersistAsked = false;

function rsOpen() {
  if (!rsDbPromise) {
    rsDbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB unavailable"));
      const req = indexedDB.open(RS_DB, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(RS_STORE)) {
          req.result.createObjectStore(RS_STORE, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    rsDbPromise.catch(err => console.warn("[results] store unavailable:", err && err.message));
  }
  return rsDbPromise;
}

function rsTx(mode, fn) {
  return rsOpen().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(RS_STORE, mode);
    const store = tx.objectStore(RS_STORE);
    let out;
    Promise.resolve(fn(store, (v) => { out = v; })).catch(reject);
    tx.oncomplete = () => resolve(out);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }));
}

const rsReq = (r) => new Promise((resolve, reject) => {
  r.onsuccess = () => resolve(r.result);
  r.onerror = () => reject(r.error);
});

function rsNewId() {
  return `${new Date().toISOString()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Merge `partial` into the stored record (creating it if needed). Writes are
// chained so autosaves land in order. Never throws to the caller.
let rsChain = Promise.resolve();
function rsSave(partial) {
  if (!partial || !partial.id) return Promise.resolve();
  if (!rsPersistAsked && navigator.storage && navigator.storage.persist) {
    rsPersistAsked = true;
    navigator.storage.persist().catch(() => {});      // ask not to be evicted
  }
  rsChain = rsChain.then(() => rsTx("readwrite", async (store) => {
    const prev = await rsReq(store.get(partial.id));
    const rec = Object.assign({ status: "active" }, prev || {}, partial, { updatedAt: new Date().toISOString() });
    store.put(rec);
  })).catch(err => console.warn("[results] save failed:", err && err.message));
  return rsChain;
}

function rsGet(id) { return rsTx("readonly", async (s, set) => set(await rsReq(s.get(id)))); }
function rsAll() {
  return rsTx("readonly", async (s, set) => set(await rsReq(s.getAll())))
    .then(list => (list || []).sort((a, b) => String(b.startedAt || b.updatedAt).localeCompare(String(a.startedAt || a.updatedAt))))
    .catch(() => []);
}
function rsDelete(id) { return rsTx("readwrite", (s) => { s.delete(id); }); }
function rsDeleteAll() { return rsTx("readwrite", (s) => { s.clear(); }); }

// On load: anything still "active" belongs to a session that ended without
// finishing (closed, crashed, reloaded) — mark it interrupted.
function rsMarkInterrupted() {
  return rsTx("readwrite", async (s) => {
    const all = await rsReq(s.getAll());
    for (const r of all || []) {
      if (r.status === "active") { r.status = "interrupted"; s.put(r); }
    }
  }).catch(() => {});
}

// ---- Downloads ---------------------------------------------------------------
function rsDownloadBlob(name, blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

function rsDownloadRun(rec) {
  rsDownloadBlob(`${rec.baseName}.txt`, new Blob([rec.txt || ""], { type: "text/tab-separated-values" }));
  if (rec.json) rsDownloadBlob(`${rec.baseName}.json`, new Blob([rec.json], { type: "application/json" }));
}

// Minimal ZIP writer (stored, no compression) — one file per run, normal names.
const RS_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function rsCrc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = RS_CRC[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function rsMakeZip(files) {
  const enc = new TextEncoder(), parts = [], central = [];
  const d = new Date();
  const dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name), data = enc.encode(f.text), crc = rsCrc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);
    lh.setUint16(8, 0, true); lh.setUint16(10, dosTime, true); lh.setUint16(12, dosDate, true);
    lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true);
    lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
    parts.push(new Uint8Array(lh.buffer), name, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true);
    ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true); ch.setUint16(12, dosTime, true);
    ch.setUint16(14, dosDate, true); ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true);
    ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true);
    ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const cdSize = central.reduce((n, a) => n + a.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true); end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: "application/zip" });
}

async function rsDownloadAll() {
  const runs = await rsAll();
  if (!runs.length) return;
  const used = new Set(), files = [];
  const uniq = (n) => { let x = n, i = 2; while (used.has(x)) x = n.replace(/(\.\w+)$/, `_${i++}$1`); used.add(x); return x; };
  for (const r of runs) {
    files.push({ name: uniq(`${r.baseName}.txt`), text: r.txt || "" });
    if (r.json) files.push({ name: uniq(`${r.baseName}.json`), text: r.json });
  }
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  rsDownloadBlob(`UC4AFC_results_${stamp}.zip`, rsMakeZip(files));
}

// ---- Results screen --------------------------------------------------------------
const RS_STATUS = {
  complete:    { label: "complete",    color: "#166534", bg: "#f0fdf4" },
  aborted:     { label: "aborted",     color: "#555",    bg: "#f1f1f1" },
  interrupted: { label: "interrupted", color: "#9a3412", bg: "#fff7ed" },
  active:      { label: "in progress", color: "#1e40af", bg: "#eff6ff" }
};

function rsModeLabel(r) {
  const m = { lpf: "LPF", quiet: "Quiet", snr: "Noise (SNR)" }[r.mode] || r.mode || "";
  return r.kind === "normalisation" ? `Normalisation ${m}` : `Adaptive ${m}`;
}

async function rsRender() {
  const listEl = document.getElementById("resultsList");
  const info = document.getElementById("resultsInfo");
  if (!listEl) return;
  listEl.textContent = "";
  const runs = await rsAll();
  if (info) info.textContent = runs.length
    ? `${runs.length} run${runs.length === 1 ? "" : "s"} kept on this device. Each is saved after every response.`
    : "No runs stored on this device yet.";
  const zipBtn = document.getElementById("resultsZipBtn");
  if (zipBtn) zipBtn.disabled = !runs.length;
  const delAll = document.getElementById("resultsDeleteAllBtn");
  if (delAll) delAll.disabled = !runs.length;

  for (const r of runs) {
    const st = RS_STATUS[r.status] || RS_STATUS.active;
    const card = document.createElement("div");
    card.style.cssText = "border:1px solid #dde0e4;border-radius:8px;padding:.6rem .8rem;margin:.5rem 0;text-align:left;background:#fafafa";
    const when = r.startedAt ? new Date(r.startedAt).toLocaleString("en-NZ", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
    const list = r.listId && r.listId !== "both" ? ` · List ${r.listId}` : "";
    card.innerHTML =
      `<div style="display:flex;justify-content:space-between;gap:.5rem;align-items:baseline;flex-wrap:wrap">` +
      `<strong></strong><span style="font-size:.8rem;padding:.1rem .5rem;border-radius:6px;color:${st.color};background:${st.bg}">${st.label}</span></div>` +
      `<div class="small" style="margin-top:.2rem"></div><div class="rs-actions" style="margin-top:.3rem"></div>`;
    card.querySelector("strong").textContent = `${r.participant || "anon"} · ${rsModeLabel(r)}${list}`;
    card.querySelector(".small").textContent =
      `${when} · ${r.done ?? 0}${r.total ? ` / ${r.total}` : ""} trials${r.summary ? ` · ${r.summary}` : ""}`;
    const actions = card.querySelector(".rs-actions");
    const btn = (label, fn, grey) => {
      const b = document.createElement("button");
      b.type = "button"; b.textContent = label;
      b.style.cssText = "margin:.2rem .4rem .2rem 0;padding:.35rem .8rem;font-size:.9rem" + (grey ? ";background:#777" : "");
      b.onclick = fn; actions.appendChild(b); return b;
    };
    btn("Download", () => rsDownloadRun(r));
    btn("Copy", async (e) => {
      try { await navigator.clipboard.writeText(r.txt || ""); e.target.textContent = "Copied"; }
      catch (_) { e.target.textContent = "Copy failed"; }
      setTimeout(() => { e.target.textContent = "Copy"; }, 1500);
    });
    if (r.kind === "normalisation" && r.status !== "complete" && r.resume && typeof csResume === "function") {
      btn("Resume", () => csResume(r));
    }
    btn("Delete", async () => {
      if (!confirm(`Delete this run (${r.participant || "anon"}, ${rsModeLabel(r)}, ${when})? This can't be undone.`)) return;
      await rsDelete(r.id); rsRender();
    }, true);
    listEl.appendChild(card);
  }
}

function rsSetupScreen() {
  const open = document.getElementById("resultsBtn");
  if (open) open.onclick = () => { showScreen("resultsScreen"); rsRender(); };
  const back = document.getElementById("resultsBackBtn");
  if (back) back.onclick = () => showScreen("intro");
  const zip = document.getElementById("resultsZipBtn");
  if (zip) zip.onclick = () => rsDownloadAll();
  const delAll = document.getElementById("resultsDeleteAllBtn");
  if (delAll) delAll.onclick = async () => {
    const n = (await rsAll()).length;
    if (!n || !confirm(`Delete ALL ${n} stored run${n === 1 ? "" : "s"} from this device? Download them first if you need them. This can't be undone.`)) return;
    await rsDeleteAll(); rsRender();
  };
  rsMarkInterrupted();
}

if (typeof window !== "undefined") {
  window.ResultsStore = {
    newId: rsNewId, save: rsSave, get: rsGet, all: rsAll, remove: rsDelete,
    markInterrupted: rsMarkInterrupted, downloadAll: rsDownloadAll, render: rsRender,
    setupScreen: rsSetupScreen, _makeZip: rsMakeZip
  };
}
