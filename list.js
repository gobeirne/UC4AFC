// File: list.js (non-module)
async function loadList(listNumber = "1") {
  function parseLines(text, sourceLabel) {
    const lines = text.trim().split(/\r?\n/);
    const rows = lines.map((line, i) => {
      // Split to exactly 6 fields, trim each, and validate
      const parts = line.split(/\t/).map(s => (s ?? "").trim());
      if (parts.length !== 6 || parts.some(p => !p)) {
        console.warn(`⚠️ Bad list row skipped @ line ${i + 1} (${sourceLabel}):`, line);
        return null;
      }
      const [a, b, c, d, correct, audioFile] = parts;
      return { images: [a, b, c, d], correct, audioFile };
    }).filter(Boolean);

    if (rows.length === 0) {
      console.error(`❌ No valid rows parsed from ${sourceLabel}.`);
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
    console.warn("📦 Loaded inline fallback list (file://)");
  } else {
    try {
      // Determine which list file to load
      let filename;
      if (listNumber === "demo") {
        filename = "UC4AFC_list00.txt";
      } else {
        filename = `UC4AFC_list0${listNumber}.txt`;
      }
      
      const txt = await fetch(filename).then(r => r.text());
      const rows = parseLines(txt, filename);
      list.length = 0;
      list.push(...rows);
      console.log(`✅ Loaded list from ${filename}`);
    } catch (err) {
      console.error(`❌ Failed to load list file:`, err);
      alert("Failed to load stimulus list.");
    }
  }

  // ✅ All assets are preloaded via preloadAllAssets() in main.js
}
