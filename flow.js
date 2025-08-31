// File: flow.js
import {
  config,
  list,
  trialIndex,
  responseLog,
  participant,
  phase,
  optImgs,
  audio,
  trainingImg,
  startTime,
  testStartedAt,
  arrowSet
} from "./global.js";

import { showScreen, setImage } from "./ui.js";
import { loadList } from "./list.js";
import { saveResults } from "./results.js";

let trainingAborted = false;

let lastBreakAt = -1;  // remember the index where we last stopped for a break

const isNonEmpty = v => typeof v === "string" && v.trim().length > 0;
const warn = (...args) => console.warn(...args);

export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

let nextImagesToPreload = [];

export function beginPhase(p) {
  phase = p;
  trainingAborted = false;
  participant = document.getElementById("name").value || "anon";
  testStartedAt = new Date();

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

export function showTrainingItem() {
  if (trainingAborted || trialIndex >= list.length || phase !== "training") {
    showScreen("instructions");
    return;
  }

const item = list[trialIndex];
  if (!item || !isNonEmpty(item.correct) || !isNonEmpty(item.audioFile)) {
    warn("⚠️ Bad training item, skipping trial", { index: trialIndex + 1, item });
    trialIndex++;
    return showTrainingItem();
  }

  audio.pause();
  audio.currentTime = 0;
  audio.onended = null;
  audio.src = `sounds/${item.audioFile}`;

  audio.play().then(() => {
    if (trainingAborted) return;

    setTimeout(() => {
      if (trainingAborted || phase !== "training") return;
      setImage(trainingImg, item.correct, config.arrows);
    }, config.imageRevealOffsetMs || 600);
  }).catch(err => {
    console.error("⚠️ Training audio failed to play:", err);
  });

  audio.onended = () => {
    if (trainingAborted) return;

    trialIndex++;
    if (phase === "training") {
      setTimeout(() => {
        if (trainingAborted || phase !== "training") return;
        showTrainingItem();
      }, config.delayMs || 1500);
    }
  };
}

export function nextTrial() {
	
	// Pause for a rest every N trials before starting the next one
if (phase === "test") {
  const n = Number(config.breakEvery) || 0; // 0 = disabled
  if (n > 0 && trialIndex > 0 && (trialIndex % n === 0) && lastBreakAt !== trialIndex) {
    lastBreakAt = trialIndex;

    // Show break screen and wait for the user
    showScreen("break");
    const btn = document.getElementById("breakOkBtn");
    if (btn) {
      btn.onclick = () => {
        showScreen("test");
        nextTrial();  // resume: try again, now same trialIndex starts
      };
    }
    return; // stop here until user presses OK
  }
}

	
  if (trialIndex >= list.length) {
    if (phase === "test") {
      saveResults();
    } else {
      showScreen("thankyou");
      const abortBtn = document.getElementById("abortBtn");
      if (abortBtn) abortBtn.style.display = "none";
    }
    return;
  }

  const item = list[trialIndex];
  if (!item) {
    warn("⚠️ Missing trial item at index", trialIndex);
    trialIndex++;
    return nextTrial();
  }
  
  const shuffled = [...item.images];
  shuffle(shuffled);

  optImgs.forEach(img => {
    img.style.display = "none";
    img.removeAttribute("data-name");
    img.src = "";
  });

  let audioStartedAt = null;
  if (!isNonEmpty(item.audioFile)) {
    warn("⚠️ Invalid audioFile in trial", trialIndex + 1, item);
  } else {
    audio.src = `sounds/${item.audioFile}`;
  }

  // ✅ Preload NEXT trial’s images
  if (trialIndex + 1 < list.length) {
    const nextItem = list[trialIndex + 1];
    const nextShuffled = [...nextItem.images];
    shuffle(nextShuffled);

    nextImagesToPreload = nextShuffled;
	nextImagesToPreload.forEach(name => {
      if (!isNonEmpty(name)) {
        warn("⚠️ Skipping preload for invalid name (next trial)", { nextIndex: trialIndex + 2, name });
        return;
      }
      const preload = new Image();
      preload.src = `images/${name}.jpg`;
      if (config.arrows && arrowSet.has(name)) {
        const preloadArrow = new Image();
        preloadArrow.src = `images/${name}_arrow.jpg`;
      }
    });
	
  } else {
    nextImagesToPreload = [];
  }

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
              if (!isNonEmpty(name)) {
                warn("⚠️ Empty/invalid image name in trial",
                  trialIndex + 1, { item, position: idx, shuffled });
              }
              setImage(optImgs[idx], name, config.arrows);
              // Only set data-name if valid to avoid propagating "undefined"
              if (isNonEmpty(name)) {
                optImgs[idx].setAttribute("data-name", name);
              } else {
                optImgs[idx].removeAttribute("data-name");
              }
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

export function recordResponse(img) {
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

export function abortTraining() {
  trainingAborted = true;
}
