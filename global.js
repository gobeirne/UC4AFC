// File: global.js
export const config = {
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
export let testStartedAt = null;

export let arrowSet = new Set();
export function setArrowList(list) {
  arrowSet = new Set(list);
}

export let list = [];
export let trialIndex = 0;
export let phase = "";
export let participant = "";
export let responseLog = [];

export const trainingImg = document.getElementById("training-img");
export const audio = document.getElementById("stimulus");

export let optImgs = [];
export let startTime = null;

export function setOptImgs() {
  optImgs = [
    document.getElementById("opt0"),
    document.getElementById("opt1"),
    document.getElementById("opt2"),
    document.getElementById("opt3")
  ];
}




document.addEventListener("DOMContentLoaded", setOptImgs);
