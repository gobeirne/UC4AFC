// File: setImage.js
import { arrowSet } from "./global.js";

export function setImage(imgElement, name, useArrows = true) {
  const base = `images/${name}`;
  const fallback = `${base}.jpg`;
  const arrow = `${base}_arrow.jpg`;

  if (useArrows && arrowSet.has(name)) {
    imgElement.src = arrow;
  } else {
    imgElement.src = fallback;
  }
}
