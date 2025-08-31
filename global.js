// File: global.js

// --- Config ---
export const config = {
  arrows: false,
  defaultDelay: 1500,
  breakEvery: 32,
  showCountdown: true,
  imageRevealOffsetMs: 600,
  showAbortXOnTouchDevices: true,
  instructions: {
    training:
      "You’ll see and hear words one at a time. Look at the picture while you listen. Try to remember what the word is.",
    test:
      "You will hear a word and see four pictures. Click the picture that matches the word you heard. If you're not sure, have a guess."
  },
  arrowList: [
    //"beak", "chin", "dad", "hood", "knees",
    //"lock", "mum", "nose", "note", "page",
    //"seed", "tongue"
  ]
};

// --- Runtime State ---
export let testStartedAt = null;
export let list = [];
export let trialIndex = 0;
export let phase = "";
export let participant = "";
export let responseLog = [];

// --- DOM Elements ---
export const trainingImg = document.getElementById("training-img");
export let optImgs = [];
export let audio = null;
export let startTime = null;

export function setOptImgs() {
  optImgs = [
    document.getElementById("opt0"),
    document.getElementById("opt1"),
    document.getElementById("opt2"),
    document.getElementById("opt3")
  ];
  audio = document.getElementById("stimulus");
}

// --- Arrows ---
export let arrowSet = new Set();
export function setArrowList(list) {
  arrowSet.clear();
  list.forEach(item => arrowSet.add(item));
}

// Ensure optImgs/audio init if script is late-loaded
document.addEventListener("DOMContentLoaded", setOptImgs);
