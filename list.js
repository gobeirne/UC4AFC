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
