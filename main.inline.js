"use strict";

// --- Bundled main.inline.js ---

// --- global.js ---
// File: global.js
const config = {
  arrows: true,
  defaultDelay: 1500,
  showCountdown: true,
  imageRevealOffsetMs: 600,
  instructions: {
    training:
      "You’ll see and hear words one at a time. Look at the picture while you listen. Try to remember what the word is.",
    test:
      "You will hear a word and see four pictures. Click the picture that matches the word you heard."
  },
  arrowList: ["beak", "chin", "dad", "hood", "knees", "lock", "mum", "nose", "note", "page", "seed", "tongue"]
};
let testStartedAt = null;

let arrowSet = new Set();
function setArrowList(list) {
  arrowSet = new Set(list);
}

let list = [];
let trialIndex = 0;
let phase = "";
let participant = "";
let responseLog = [];

const trainingImg = document.getElementById("training-img");
const audio = document.getElementById("stimulus");

let optImgs = [];
let startTime = null;

function setOptImgs() {
  optImgs = [
    document.getElementById("opt0"),
    document.getElementById("opt1"),
    document.getElementById("opt2"),
    document.getElementById("opt3")
  ];
}




document.addEventListener("DOMContentLoaded", setOptImgs);


// --- config.js ---
// File: config.js

async function loadConfig() {
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


// --- ui.js ---
// File: ui.js

const screens = Array.from(document.querySelectorAll(".screen"));

function showScreen(id) {
  screens.forEach(s => s.style.display = "none");
  const target = document.getElementById(id);
  if (target) target.style.display = "block";
}

function adjustImageSize() {
  const gridSize = Math.min(window.innerWidth, window.innerHeight) / 2 - 30;
  optImgs.forEach(img => {
    img.style.width = `${gridSize}px`;
    img.style.height = `${gridSize}px`;
  });
  trainingImg.style.width = `${gridSize}px`;
  trainingImg.style.height = `${gridSize}px`;
  trainingImg.style.objectFit = "contain";
  trainingImg.style.margin = "0 auto";
  trainingImg.style.display = "block";
}

function setImage(imgEl, name, useArrows = true) {
  const basePath = `images/${name}`;
  const arrowPath = `${basePath}_arrow.jpg`;
  const normalPath = `${basePath}.jpg`;

  if (!useArrows) {
    imgEl.src = normalPath;
    return;
  }

  const probe = new Image();
  probe.onload = () => {
    imgEl.src = arrowPath;
  };
  probe.onerror = () => {
    imgEl.src = normalPath;
  };
  probe.src = arrowPath;
}

function showInstructions(phase, onContinue) {
  const title = phase === "training" ? "Training Instructions" : "Test Instructions";
  const text = config.instructions?.[phase] || "(No instructions found)";

  document.getElementById("instructions-title").textContent = title;
  document.getElementById("instructions-text").textContent = text;

  showScreen("instructions");

  const okBtn = document.querySelector("#instructions button:last-of-type");
  const handler = () => {
    okBtn.removeEventListener("click", handler);
    onContinue();
  };
  okBtn.addEventListener("click", handler);
}


// --- setImage.js ---
// File: setImage.js

function setImage(imgElement, name, useArrows = true) {
  const base = `images/${name}`;
  const fallback = `${base}.jpg`;
  const arrow = `${base}_arrow.jpg`;

  if (useArrows && arrowSet.has(name)) {
    imgElement.src = arrow;
  } else {
    imgElement.src = fallback;
  }
}


// --- flow.js ---
// File: flow.js


function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function beginPhase(p) {
  phase = p;
  participant = document.getElementById("name").value || "anon";
  testStartedAt = new Date(); // ✅ log actual start time

  loadList().then(() => {
    shuffle(list);
    trialIndex = 0;
    responseLog.length = 0;

    if (phase === "training") {
      showScreen("main");
      showTrainingItem();
    } else {
      showScreen("test");
      nextTrial();
    }
  });
}

function showTrainingItem() {
  if (trialIndex >= list.length) {
    showScreen("instructions");
    return;
  }

  const item = list[trialIndex];
  setImage(trainingImg, item.correct, config.arrows);

  audio.pause();
  audio.currentTime = 0;
  audio.onended = null;
  audio.src = `sounds/${item.audioFile}`;
  audio.play().catch(err => {
    console.error("⚠️ Training audio failed to play:", err);
  });

  audio.onended = () => {
    trialIndex++;
    setTimeout(showTrainingItem, config.delayMs || 1500);
  };
}

function nextTrial() {
  if (trialIndex >= list.length) {
    saveResults();
    return;
  }

  const item = list[trialIndex];
  const shuffled = [...item.images];
  shuffle(shuffled);

  optImgs.forEach(img => {
    img.style.display = "none";
    img.removeAttribute("data-name");
    img.src = "";
  });

  let audioStartedAt = null;
  audio.src = `sounds/${item.audioFile}`;

  audio.onloadedmetadata = () => {
    audio.play().then(() => {
      const offset = config.imageRevealOffsetMs || 0;

      const checkStart = () => {
        if (!audioStartedAt && !audio.paused && audio.currentTime > 0) {
          audioStartedAt = performance.now();
        }

        if (audioStartedAt) {
          const elapsed = performance.now() - audioStartedAt;
          if (elapsed >= offset) {
            shuffled.forEach((name, idx) => {
              setImage(optImgs[idx], name, config.arrows);
              optImgs[idx].setAttribute("data-name", name);
              optImgs[idx].style.display = "block";
              optImgs[idx].style.opacity = "1.0";
            });
            startTime = performance.now();
            return;
          }
        }
        requestAnimationFrame(checkStart);
      };

      requestAnimationFrame(checkStart);
    }).catch(err => {
      console.error("Audio play failed:", err);
      if (!audio._erroredOnce) {
        alert("⚠️ Audio failed to play. Check browser autoplay settings.");
        audio._erroredOnce = true;
      }
    });
  };
}

function recordResponse(img) {
  const timeTaken = performance.now() - startTime;
  const chosen = img.getAttribute("data-name");
  const correct = list[trialIndex].correct;
  const sound = list[trialIndex].audioFile;

  responseLog.push({
    index: trialIndex + 1,
    sound,
    correct,
    chosen,
    timeMs: Math.round(timeTaken)
  });

  optImgs.forEach(image => {
    image.style.opacity = image === img ? "1.0" : "0.4";
  });

  setTimeout(() => {
    optImgs.forEach(image => {
      image.style.display = "none";
    });

    const delay = config.delayMs || 1500;
    const remaining = Math.max(0, delay - 500);

    setTimeout(() => {
      trialIndex++;
      nextTrial();
    }, remaining);
  }, 500);
}


// --- list.js ---
// File: list.js

async function loadList() {
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


// --- preload.js ---
// File: preload.js

/**
 * Load arrow list + preload key assets
 */
async function preloadAssets() {
  await loadArrowFiles();
  await preloadImagesAndSounds();
  alert("✅ Preloading complete.");
}

/**
 * Loads arrowFiles.json if running on web, or uses fallback list for file://
 */
async function loadArrowFiles() {
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
function startCalibration() {
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


// --- results.js ---
// File: results.js

function saveResults(optionalNote = "") {
  const now = new Date();
  const timeStr = now.toISOString().replace(/[:.]/g, "-");

  const formatTime = (d) =>
    d.toLocaleString("en-NZ", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    });

  const startTimeFormatted = testStartedAt
    ? formatTime(testStartedAt)
    : "(unknown)";

  const jsonData = {
    participant,
    startedAt: testStartedAt?.toISOString() || null,
    timestamp: now.toISOString(),
    data: responseLog.slice(),
    note: optionalNote || undefined
  };

  // --- Build .txt output
  const txtLines = [
    `# Participant\t${participant}`,
    `# test started at ${startTimeFormatted}`,
    "",
    "Trial\tSound\tCorrect\tChosen\tTime_ms"
  ];

  for (const r of responseLog) {
    txtLines.push(`${r.index}\t${r.sound}\t${r.correct}\t${r.chosen}\t${r.timeMs}`);
  }

  if (optionalNote) {
    txtLines.push("");
    txtLines.push(`# ${optionalNote}`);
  }

  // --- Save TXT
  const txtBlob = new Blob([txtLines.join("\n")], { type: "text/tab-separated-values" });
  const a1 = document.createElement("a");
  a1.href = URL.createObjectURL(txtBlob);
  a1.download = `UC4AFC_${participant}_${timeStr}.txt`;
  a1.click();

  // --- Save JSON if enabled
  const shouldSaveJson =
    config && typeof config.saveJson !== "undefined" ? config.saveJson : true;

  if (shouldSaveJson) {
    const jsonBlob = new Blob([JSON.stringify(jsonData, null, 2)], { type: "application/json" });
    const a2 = document.createElement("a");
    a2.href = URL.createObjectURL(jsonBlob);
    a2.download = `UC4AFC_${participant}_${timeStr}.json`;
    a2.click();
  } else {
    console.warn("🛑 Skipping JSON download due to config.saveJson = false");
  }

  // --- Show end screen
  showScreen("thankyou");
  document.getElementById("fileinfo").textContent =
    `Saved: UC4AFC_${participant}_${timeStr}.${shouldSaveJson ? "{txt,json}" : "txt"}`;
}


// --- main.js ---
// File: main.js

// --- Startup ---
window.onload = async () => {
  await new Promise(resolve => {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", resolve);
    } else {
      resolve();
    }
  });

  await loadConfig();
  await loadArrowFiles(); // Must come after config

  setOptImgs(); // Populate image elements
  document.getElementById("delay").value = config.defaultDelay || 1500;
  adjustImageSize();
  showScreen("intro");

  window.addEventListener("resize", adjustImageSize);

  // ✅ Set click handlers for test mode
  optImgs.forEach(img => {
    img.addEventListener("click", () => {
      recordResponse(img);
    });
  });

  // ✅ Wire up navigation buttons after DOM is ready
  const back = document.getElementById("backBtn");
  const ok = document.getElementById("okBtn");
  const ret = document.getElementById("returnBtn");

  if (back) back.addEventListener("click", () => showScreen("intro"));
  if (ok)   ok.addEventListener("click", () => beginPhase(phase));
  
  if (ret) ret.addEventListener("click", () => {
    trialIndex = 0;
    responseLog.length = 0;
    showScreen("intro");
  });
};



// --- Delay Setting ---
document.getElementById("delay").oninput = (e) => {
  const val = parseInt(e.target.value);
  if (!isNaN(val)) config.delayMs = val;
};

// --- Main Buttons ---
document.getElementById("startBtn").onclick = () => {
  showInstructions("test", () => beginPhase("test"));
};

document.getElementById("trainBtn").onclick = () => {
  showInstructions("training", () => beginPhase("training"));
};

document.getElementById("preloadBtn").onclick = preloadAssets;
document.getElementById("calibrateBtn").onclick = startCalibration;

// --- Escape Key to Abort ---
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (phase === "training" && confirm("Abort training?")) {
      saveResults("training aborted at " + new Date().toLocaleString());
    } else if (phase === "test" && confirm("Abort test and save progress?")) {
      saveResults("test aborted at " + new Date().toLocaleString());
    }
  }
});



