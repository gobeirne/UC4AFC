// File: list.js (non-module)
async function loadList() {
  function parseLines(text, sourceLabel) {
    const lines = text.trim().split(/\r?\n/);
    const rows = lines.map((line, i) => {
      // Split to exactly 6 fields, trim each, and validate
      const parts = line.split(/\t/).map(s => (s ?? "").trim());
      if (parts.length !== 6 || parts.some(p => !p)) {
        console.warn(`[!] Bad list row skipped @ line ${i + 1} (${sourceLabel}):`, line);
        return null;
      }
      const [a, b, c, d, correct, audioFile] = parts;
      return { images: [a, b, c, d], correct, audioFile };
    }).filter(Boolean);

    if (rows.length === 0) {
      console.error(`[X] No valid rows parsed from ${sourceLabel}.`);
    }
    return rows;
  }

  if (location.protocol === "file:") {
    const fallback = document.getElementById("list-fallback");
    if (!fallback) {
      alert("Local fallback list not found in page.");
      throw new Error("Missing <script id='list-fallback'> element");
    }
    const raw = fallback.textContent || "";
    const rows = parseLines(raw, "inline fallback");
    list.length = 0;
    list.push(...rows);
    console.warn("[pkg] Loaded inline fallback list (file://)");
  } else {
    try {
      const txt = await fetch("UC4AFC_lists.txt").then(r => r.text());
      const rows = parseLines(txt, "UC4AFC_lists.txt");
      list.length = 0;
      list.push(...rows);
      console.log("[OK] Loaded list from UC4AFC_lists.txt");
    } catch (err) {
      console.error("[X] Failed to load UC4AFC_lists.txt:", err);
      alert("Failed to load stimulus list.");
    }
  }

  // [OK] All assets are preloaded via preloadAllAssets() in main.js
}
