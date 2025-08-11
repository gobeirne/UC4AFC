// File: setImage.js
import { arrowSet, config } from "./global.js";

export function setImage(imgElement, name, useArrows = true) {
  const base = `images/${name}`;
  const fallback = `${base}.jpg`;
  const arrow = `${base}_arrow.jpg`;

  imgElement.src = (useArrows && config.arrows && arrowSet.has(name))
    ? arrow
    : fallback;
}
