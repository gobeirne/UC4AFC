// File: list.js
import { list } from "./global.js";

export async function loadList() {
  if (location.protocol === "file:") {
    const fallback = document.getElementById("list-fallback");
    if (!fallback) {
      alert("Local fallback list not found in page.");
      throw new Error("Missing <script id='list-fallback'> element");
    }
    const raw = fallback.textContent.trim();
    list.length = 0;
    list.push(...raw.split(/\r?\n/).map(line => {
      const [a, b, c, d, correct, audioFile] = line.split(/\t/);
      return { images: [a, b, c, d], correct, audioFile };
    }));
    console.warn("Loaded inline list (local file mode)");
  } else {
    const txt = await fetch("UC4AFC_lists.txt").then(r => r.text());
    list.length = 0;
    list.push(...txt.trim().split(/\r?\n/).map(line => {
      const [a, b, c, d, correct, audioFile] = line.split(/\t/);
      return { images: [a, b, c, d], correct, audioFile };
    }));
  }
}
