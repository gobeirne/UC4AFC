// File: config.js
import { config } from "./global.js";

export async function loadConfig() {
  const isLocal = location.protocol === "file:";

  if (isLocal) {
    console.warn("📁 Running locally. Skipping fetch(config.json) and using fallback config.");
    Object.assign(config, {
      arrows: false,
      defaultDelay: 1500,
      showCountdown: true,
      showAbortXOnTouchDevices: true,
      saveJson: false,
      imageRevealOffsetMs: 600,
      instructions: {
        training: "You’ll see and hear words one at a time. Look at the picture while you listen. Try to remember what the word is.",
        test: "You will hear a word and see four pictures. Click the picture that matches the word you heard. If you're not sure, have a guess."
      }
    });
    return;
  }

  try {
    const res = await fetch("config.json");
    const externalConfig = await res.json();
    Object.assign(config, externalConfig);
    console.log("✅ Loaded config.json:", config);
  } catch (err) {
    console.error("❌ Failed to load config.json:", err);
    console.warn("⚠️ Could not load config.json. Using fallback config.");
  }
}

