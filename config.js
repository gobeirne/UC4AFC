// File: config.js
import { config } from "./global.js";

export async function loadConfig() {
  try {
    const res = await fetch("config.json");
    const externalConfig = await res.json();
    Object.assign(config, externalConfig);
    console.log("✅ Loaded config.json:", config);
  } catch (err) {
    console.error("❌ Failed to load config.json:", err);
    console.warn("⚠️ Could not load config.json. Using fallback config.");
    Object.assign(config, {
      arrows: true,
      defaultDelay: 1500,
      showCountdown: true,
	  saveJson: false,
      imageRevealOffsetMs: 600,
      instructions: {
        training: "You’ll see and hear words one at a time. Look at the picture while you listen. Try to remember what the word is.",
        test: "You will hear a word and see four pictures. Click the picture that matches the word you heard."
      }
    });
  }
}
