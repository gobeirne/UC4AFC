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

export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

let nextImagesToPreload = [];

export function beginPhase(p) {
  phase = p;
  participant = document.getElementById("name").value || "anon";
  testStartedAt = new Date(); // ✅ actual start time

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
  if (trialIndex >= list.length || phase !== "training") {
    showScreen("instructions");
    return;
  }

  const item = list[trialIndex];

  // Reset and prepare audio
  audio.pause();
  audio.currentTime = 0;
  audio.onended = null;
  audio.src = `sounds/${item.audioFile}`;

  audio.play().then(() => {
    // ✅ Image appears after 600 ms from audio start
    setTimeout(() => {
      if (phase === "training") {
        setImage(trainingImg, item.correct, config.arrows);
      }
    }, config.imageRevealOffsetMs || 600);
  }).catch(err => {
    console.error("⚠️ Training audio failed to play:", err);
  });

  audio.onended = () => {
    trialIndex++;
    if (phase === "training") {
      setTimeout(() => {
        if (phase === "training") {
          showTrainingItem();
        }
      }, config.delayMs || 1500);
    }
  };
}




export function nextTrial() {
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
  const shuffled = [...item.images];
  shuffle(shuffled);

  optImgs.forEach(img => {
    img.style.display = "none";
    img.removeAttribute("data-name");
    img.src = "";
  });

  let audioStartedAt = null;
  audio.src = `sounds/${item.audioFile}`;

  // ✅ Preload NEXT trial’s images
  if (trialIndex + 1 < list.length) {
    const nextItem = list[trialIndex + 1];
    const nextShuffled = [...nextItem.images];
    shuffle(nextShuffled);

    nextImagesToPreload = nextShuffled;
    nextImagesToPreload.forEach(name => {
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
