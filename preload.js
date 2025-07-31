// File: preload.js
import { setArrowList, arrowSet } from "./global.js";
import { config } from "./global.js";

/**
 * Load arrow list + preload key assets
 */
export async function preloadAssets() {
  await loadArrowFiles();
  await preloadImagesAndSounds();
  alert("✅ Preloading complete.");
}

/**
 * Loads arrowFiles.json if running on web, or uses fallback list for file://
 */
export async function loadArrowFiles() {
  if (location.protocol === "file:") {
    const fallbackList = [
      "beak", "chin", "dad", "hood", "knees",
      "lock", "mum", "nose", "note", "page",
      "seed", "tongue"
    ];
    console.warn("⚠️ Using static arrow list fallback (file:// mode)");
    setArrowList(fallbackList);
    return;
  }

  try {
    const res = await fetch("arrowFiles.json");
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("Invalid arrowFiles.json format");
    setArrowList(data);
    console.log("✅ Loaded arrow list:", data.length);
  } catch (err) {
    console.error("❌ Could not load arrowFiles.json:", err);
  }
}

/**
 * Preloads all arrow-related images and sounds into memory
 */
async function preloadImagesAndSounds() {
  const arrowList = Array.from(arrowSet);
  const jobs = [];

  // Images (main + _arrow)
  for (const name of arrowList) {
    jobs.push(preloadImage(`images/${name}.jpg`));
    jobs.push(preloadImage(`images/${name}_arrow.jpg`));
    jobs.push(preloadSound(`sounds/${name}.mp3`));
  }

  // UI assets
  jobs.push(preloadImage("UClogo.png"));
  jobs.push(preloadSound("sounds/calib.mp3"));
  jobs.push(preloadSound("sounds/NZEng_calib.mp3"));
  jobs.push(preloadSound("sounds/TeReo_calib.mp3"));

  await Promise.all(jobs);
  console.log(`✅ Preloaded ${jobs.length} assets`);
}

function preloadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = resolve;
    img.onerror = resolve;
    img.src = src;
  });
}

function preloadSound(src) {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.oncanplaythrough = resolve;
    audio.onerror = resolve;
    audio.src = src;
  });
}

/**
 * Starts calibration loop based on current language mode
 */
export function startCalibration() {
  const mode = localStorage.getItem("language") || "Te reo Māori";
  const soundFile = mode === "English" ? "NZEng_calib.mp3" : "TeReo_calib.mp3";

  const audio = document.getElementById("stimulus");
  audio.src = `sounds/${soundFile}`;
  audio.loop = true;

  audio.play().then(() => {
    alert("📢 Playing calibration sound.\nSet your device volume to maximum.\nClick OK to stop.");
  }).catch(err => {
    console.error("⚠️ Calibration audio failed to play:", err);
    alert("⚠️ Audio failed to play. Check browser autoplay permissions.");
  }).finally(() => {
    audio.pause();
    audio.loop = false;
  });
}
