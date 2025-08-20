// File: setImage.js
import { arrowSet, config } from "./global.js";

export function setImage(imgElement, name, useArrows = true) {
  // 🔍 Validate the name before using it
  if (typeof name !== "string" || !name.trim()) {
    console.warn("⚠️ setImage called with bad name:", name, imgElement);
    imgElement.removeAttribute("src"); // or point to a known placeholder if you prefer
    return;
  }

  const base = `images/${name}`;
  const fallback = `${base}.jpg`;
  const arrow = `${base}_arrow.jpg`;

  imgElement.src = (useArrows && config.arrows && arrowSet.has(name))
    ? arrow
    : fallback;

  // Optional: improve accessibility
  imgElement.alt = name;
}
