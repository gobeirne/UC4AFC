// File: preload.js
import { setArrowList } from "./global.js";
import { config } from "./global.js";

/**
 * Load arrow list + preload key assets
 */
export async function preloadAssets() {
  const list = config.arrowList;
  if (!list || !Array.isArray(list) || list.length === 0) {
    console.warn("⚠️ Skipping preload — no arrowList found.");
    return;
  }
  await preloadImagesAndSounds(list);
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
    config.arrowList = fallbackList;
    return;
  }

  try {
    const res = await fetch("arrowFiles.json");
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("Invalid arrowFiles.json format");
    setArrowList(data);
    config.arrowList = data;
	console.log("✅ Loaded arrow list:", data.length, "items:", data);
  } catch (err) {
    console.error("❌ Could not load arrowFiles.json:", err);
  }
}

/**
 * Preloads all relevant images and sounds into memory
 */
async function preloadImagesAndSounds(list) {
  const jobs = [];

  for (const name of list) {
    jobs.push(preloadImage(`images/${name}.jpg`));
    jobs.push(preloadImage(`images/${name}_arrow.jpg`));
    jobs.push(preloadSound(`sounds/${name}.mp3`));
  }

  // UI and calibration assets
  jobs.push(preloadImage("UClogo.png"));
  jobs.push(preloadSound("sounds/calib.mp3"));
  jobs.push(preloadSound("sounds/NZEng_calib.mp3"));
  jobs.push(preloadSound("sounds/TeReo_calib.mp3"));

  await Promise.all(jobs);
  console.log("📦 Will preload assets for:", list.length, "items");
  console.log(`✅ Preloaded ${jobs.length} assets`);
  
}

function preloadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = resolve;
    img.onerror = () => {
      console.warn(`⚠️ Failed to preload image: ${src}`);
      resolve();
    };
    img.src = src;
  });
}

function preloadSound(src) {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.oncanplaythrough = resolve;
    audio.onerror = () => {
      console.warn(`⚠️ Failed to preload sound: ${src}`);
      resolve();
    };
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
