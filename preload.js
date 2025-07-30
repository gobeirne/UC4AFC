// File: preload.js
import { setArrowList } from "./global.js";
import { config } from "./global.js";

/**
 * Load arrow list + preload key assets
 */
export async function preloadAssets() {
  await loadArrowFiles();
  preloadImages();
  preloadAudio();
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
 * Preloads static UI images
 */
function preloadImages() {
  const imgPaths = [
    "UClogo.png"
    // add more static images if needed
  ];

  imgPaths.forEach((src) => {
    const img = new Image();
    img.src = src;
  });
}

/**
 * Preloads static calibration sounds
 */
function preloadAudio() {
  const soundFiles = [
    "calib.mp3"
  ];

  soundFiles.forEach((name) => {
    const audio = new Audio();
    audio.src = `sounds/${name}`;
    // The browser will cache this if same-origin
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
