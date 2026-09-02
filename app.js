/* Te reo Māori CVCV Speech Audiometry
   Static, GitHub Pages friendly, local-file friendly.
   Put audio files in /sounds. The app resolves by the text before the first "_",
   trying the known filename first, then .mp3/.wav alternatives.
*/

const MAORI_WORD_LISTS = {
  1: [
    ["hēki","h","eː","k","i","egg"],
    ["keke","k","e","k","e","cake"],
    ["moni","m","o","n","i","money, cash"],
    ["nama","n","a","m","a","to owe, borrow"],
    ["ngutu","ŋ","u","t","u","lip"],
    ["papa","p","a","p","a","plank"],
    ["rangi","ɾ","a","ŋ","i","sky, day, heaven"],
    ["tiro","t","i","ɾ","o","inspection, gaze"],
    ["waho","w","a","h","o","outside"],
    ["whitu","f","i","t","u","seven"]
  ],
  2: [
    ["hipi","h","i","p","i","sheep"],["kurī","k","u","ɾ","iː","dog"],["mihi","m","i","h","i","greet"],
    ["neke","n","e","k","e","snake"],["ngata","ŋ","a","t","a","snail"],["poto","p","o","t","o","short"],
    ["runga","ɾ","u","ŋ","a","top"],["tuku","t","u","k","u","offering"],["wera","w","e","ɾ","a","heat"],["whana","f","a","n","a","spring/kick"]
  ],
  3: [
    ["huri","h","u","ɾ","i","turn"],["kēmu","k","eː","m","u","game"],["mata","m","a","t","a","face/screen"],
    ["niho","n","i","h","o","tooth"],["ngako","ŋ","a","k","o","essence"],["pune","p","u","n","e","spoon"],
    ["rōpū","ɾ","oː","p","uː","group"],["tāne","t","aː","n","e","man"],["waka","w","a","k","a","waka/vehicle"],["whiti","f","i","t","i","shining"]
  ],
  4: [
    ["hope","h","o","p","e","hip"],["kaha","k","a","h","a","strong"],["manu","m","a","n","u","bird"],
    ["nōku","n","oː","k","u","mine"],["ngāti","ŋ","aː","t","i","clan"],["pere","p","e","ɾ","e","bell"],
    ["rimu","ɾ","i","m","u","seaweed/red pine"],["tangi","t","a","ŋ","i","cry"],["wiri","w","i","ɾ","i","shaking"],["whatu","f","a","t","u","eye"]
  ],
  5: [
    ["heru","h","e","ɾ","u","comb"],["kino","k","i","n","o","bad"],["mangu","m","a","ŋ","u","black"],
    ["noho","n","o","h","o","living"],["ngaki","ŋ","a","k","i","weed/cultivate"],["pipi","p","i","p","i","cockle"],
    ["rūma","ɾ","uː","m","a","room"],["take","t","a","k","e","reason"],["wētā","w","eː","t","aː","wētā"],["whare","f","a","ɾ","e","house"]
  ],
  6: [
    ["hāte","h","aː","t","e","shirt"],["kupu","k","u","p","u","word"],["mīti","m","iː","t","i","meat"],
    ["noke","n","o","k","e","worm"],["ngeru","ŋ","e","ɾ","u","cat"],["pahi","p","a","h","i","bus"],
    ["rima","ɾ","i","m","a","five"],["tino","t","i","n","o","main/best"],["weka","w","e","k","a","woodhen"],["whanga","f","a","ŋ","a","bay"]
  ],
  7: [
    ["hapū","h","a","p","uː","subtribe/clan"],["kohu","k","o","h","u","fog"],["miro","m","i","ɾ","o","thread"],
    ["nēra","n","eː","ɾ","a","nail"],["ngenge","ŋ","e","ŋ","e","tired"],["piko","p","i","k","o","bend"],
    ["rama","ɾ","a","m","a","torch"],["tana","t","a","n","a","his/her"],["wiki","w","i","k","i","week"],["whetū","f","e","t","uː","star"]
  ],
  8: [
    ["hine","h","i","n","e","girl"],["kīngi","k","iː","ŋ","i","king"],["mōku","m","oː","k","u","for me"],
    ["nōna","n","oː","n","a","belonging to him/her"],["ngaru","ŋ","a","ɾ","u","wave"],["pāmu","p","aː","m","u","farm"],
    ["rata","ɾ","a","t","a","tame"],["tēpu","t","eː","p","u","table"],["wehi","w","e","h","i","fear/awe"],["whata","f","a","t","a","elevate/support"]
  ],
  9: [
    ["honu","h","o","n","u","turtle"],["koha","k","o","h","a","gift"],["mutu","m","u","t","u","cease"],
    ["nāna","n","aː","n","a","belongs to someone"],["ngira","ŋ","i","ɾ","a","needle"],["pēpi","p","eː","p","i","baby"],
    ["reka","ɾ","e","k","a","sweet"],["tiki","t","i","k","i","fetch"],["wāhi","w","aː","h","i","place"],["whero","f","e","ɾ","o","red"]
  ],
  10: [
    ["hinu","h","i","n","u","fat"],["kare","k","a","ɾ","e","dear/friend"],["muku","m","u","k","u","dishcloth"],
    ["nēhi","n","eː","h","i","nurse"],["ngaro","ŋ","a","ɾ","o","hidden"],["peka","p","e","k","a","branch"],
    ["roto","ɾ","o","t","o","lake"],["tapu","t","a","p","u","sacred"],["waha","w","a","h","a","mouth"],["whiwhi","f","i","f","i","acquire"]
  ]
};

/* ── NZ English CVC lists ─────────────────────────────────────────
   Word entry shape: [word, c1, v, c2, fileBase]
   - 3 phonemes per word (C V C).
   - fileBase is the NNNN_Word stem; audio resolves by that exact stem.
   - No translation column, no carrier (carrier is embedded in the file).
   The list/item number lives in the filename: NN(list)NN(item). */
const ENGLISH_WORD_LISTS = {
  1: [
    ["pass","p","a","ss","0101_Pass"],["rule","r","u","le","0102_Rule"],["cause","c","au","se","0103_Cause"],
    ["time","t","i","me","0104_Time"],["log","l","o","g","0105_Log"],["sick","s","i","ck","0106_Sick"],
    ["mean","m","ea","n","0107_Mean"],["bed","b","e","d","0108_Bed"],["hope","h","o","pe","0109_Hope"],["date","d","a","te","0110_Date"]
  ],
  2: [
    ["hall","h","a","ll","0201_Hall"],["come","c","o","me","0202_Come"],["bag","b","a","g","0203_Bag"],
    ["rose","r","o","se","0204_Rose"],["suit","s","ui","t","0205_Suit"],["made","m","a","de","0206_Made"],
    ["like","l","i","ke","0207_Like"],["peace","p","ea","ce","0208_Peace"],["dip","d","i","p","0209_Dip"],["ten","t","e","n","0210_Ten"]
  ],
  3: [
    ["pies","p","ie","s","0301_Pies"],["mock","m","o","ck","0302_Mock"],["room","r","oo","m","0303_Room"],
    ["dad","d","a","d","0304_Dad"],["loan","l","oa","n","0305_Loan"],["beg","b","e","g","0306_Beg"],
    ["tell","t","e","ll","0307_Tell"],["keep","k","ee","p","0308_Keep"],["hiss","h","i","ss","0309_Hiss"],["sought","s","ough","t","0310_Sought"]
  ],
  4: [
    ["boss","b","o","ss","0401_Boss"],["sip","s","i","p","0402_Sip"],["pal","p","a","l","0403_Pal"],
    ["coat","c","oa","t","0404_Coat"],["rod","r","o","d","0405_Rod"],["moon","m","oo","n","0406_Moon"],
    ["hem","h","e","m","0407_Hem"],["take","t","a","ke","0408_Take"],["league","l","ea","gue","0409_League"],["dies","d","ie","s","0410_Dies"]
  ],
  5: [
    ["time","t","i","me","0501_Time"],["caught","c","augh","t","0502_Caught"],["beg","b","e","g","0503_Beg"],
    ["rid","r","i","d","0504_Rid"],["loon","l","oo","n","0505_Loon"],["mop","m","o","p","0506_Mop"],
    ["doze","d","o","ze","0507_Doze"],["says","s","ay","s","0508_Says"],["pack","p","a","ck","0509_Pack"],["heel","h","ee","l","0510_Heel"]
  ],
  6: [
    ["make","m","a","ke","0601_Make"],["laws","l","aw","s","0602_Laws"],["rice","r","i","ce","0603_Rice"],
    ["bell","b","e","ll","0604_bell"],["tote","t","o","te","0605_Tote"],["cod","c","o","d","0606_Cod"],
    ["ham","h","a","m","0607_Ham"],["deep","d","ee","p","0608_Deep"],["pig","p","i","g","0609_Pig"],["soon","s","oo","n","0610_Soon"]
  ],
  7: [
    ["seal","s","ea","l","0701_Seal"],["dawn","d","aw","n","0702_Dawn"],["boom","b","oo","m","0703_Boom"],
    ["hog","h","o","g","0704_Hog"],["toes","t","oe","s","0705_Toes"],["mid","m","i","d","0706_Mid"],
    ["cat","c","a","t","0707_Cat"],["like","l","i","ke","0708_Like"],["pep","p","e","p","0709_Pep"],["race","r","a","ce","0710_Race"]
  ],
  8: [
    ["hide","h","i","de","0801_Hide"],["tame","t","a","me","0802_Tame"],["rule","r","u","le","0803_Rule"],
    ["cause","c","au","se","0804_Cause"],["big","b","i","g","0805_Big"],["sass","s","a","ss","0806_Sass"],
    ["pope","p","o","pe","0807_Pope"],["don","d","o","n","0808_Don"],["meek","m","ee","k","0809_Meek"],["let","l","e","t","0810_Let"]
  ],
  9: [
    ["call","c","a","ll","0901_Call"],["buys","b","uy","s","0902_Buys"],["same","s","a","me","0903_Same"],
    ["miss","m","i","ss","0904_Miss"],["rot","r","o","t","0905_Rot"],["hoop","h","oo","p","0906_Hoop"],
    ["load","l","oa","d","0907_Load"],["peck","p","e","ck","0908_Peck"],["tag","t","a","g","0909_Tag"],["dean","d","ea","n","0910_Dean"]
  ],
  10: [
    ["lean","l","ea","n","1001_Lean"],["hag","h","a","g","1002_Hag"],["bed","b","e","d","1003_Bed"],
    ["sews","s","ew","s","1004_Sews"],["cop","c","o","p","1005_Cop"],["root","r","oo","t","1006_Root"],
    ["pick","p","i","ck","1007_Pick"],["maim","m","ai","m","1008_Maim"],["toss","t","o","ss","1009_Toss"],["dial","d","ia","l","1010_Dial"]
  ],
  11: [
    ["lice","l","i","ce","1101_Lice"],["mall","m","a","ll","1102_Mall"],["tomb","t","o","mb","1103_Tomb"],
    ["bag","b","a","g","1104_Bag"],["soap","s","oa","p","1105_Soap"],["rake","r","a","ke","1106_Rake"],
    ["pen","p","e","n","1107_Pen"],["keys","k","ey","s","1108_Keys"],["hid","h","i","d","1109_Hid"],["dot","d","o","t","1110_Dot"]
  ],
  12: [
    ["dike","d","i","ke","1201_Dike"],["ball","b","a","ll","1202_Ball"],["mace","m","a","ce","1203_Mace"],
    ["rig","r","i","g","1204_Rig"],["lose","l","o","se","1205_Lose"],["sop","s","o","p","1206_Sop"],
    ["comb","c","o","mb","1207_Comb"],["ten","t","e","n","1208_Ten"],["pad","p","a","d","1209_Pad"],["heat","h","ea","t","1210_Heat"]
  ]
};

/* Per-language configuration. Everything language-specific is derived
   from here so the rest of the app stays count-agnostic. */
const LANGUAGES = {
  maori: {
    key: "maori",
    label: "Te reo Māori",
    lists: MAORI_WORD_LISTS,
    phonemeCount: 4,        // C V C V
    hasCarrier: true,       // separate kōrero-mai carrier file (11 variants)
    hasTranslation: true,
    hasAdvanced: true,      // advanced response-phoneme picker available
    hasTraining: true,
    randomiseOrder: true,   // default: shuffle word order (fixed order not yet settled)
    unit: "kupu",           // singular term for the stimulus
    unitTitle: "Kupu",
    // RMS level of the masker noise relative to this language's 1 kHz calibration
    // tone, in dB. Measured: the CVCV noise sits +0.75 dB (RMS) above the CVCV
    // tone. With tone-referenced audiometer zeroing (both channels zeroed to the
    // tone, NOT re-zeroed on the noise), the software must subtract this so the
    // masker presents at a known level relative to the dial. See maskerNoiseAdjustDb().
    noiseVsToneDb: 0.75,
    maskerNoiseFile: "noise"   // base name resolved in sounds/
  },
  english: {
    key: "english",
    label: "NZ English",
    lists: ENGLISH_WORD_LISTS,
    phonemeCount: 3,        // C V C
    hasCarrier: false,      // carrier embedded in the stimulus file
    hasTranslation: false,
    hasAdvanced: false,     // phoneme tiles + comment only
    hasTraining: false,
    randomiseOrder: false,  // default: present in listed order (CVC convention)
    unit: "word",
    unitTitle: "Word",
    // Millennium CVC noise sits +0.76 dB (RMS) above the CVC 1 kHz tone — the
    // same relationship as CVCV, so the two systems mask identically once this
    // correction is applied. (The CVC noise, if used, lives in sounds_cvc/ and
    // also carries the folder gain adjustment; this constant is the additional
    // tone-referenced correction, matching CVCV's.)
    noiseVsToneDb: 0.76,
    maskerNoiseFile: "noise"
  }
};

function lang() { return LANGUAGES[state.language] || LANGUAGES.maori; }

/* ── CVC file gain adjustment ─────────────────────────────────────────────
   Every sound played from the sounds_cvc/ folder is attenuated by this many dB.
   The CVC recordings (words AND their 1 kHz calibration tone) are 5.07 dB
   hotter in absolute level than the corresponding CVCV material, so pulling the
   whole folder down by 5.07 dB puts both word sets on the same effective level
   scale while each keeps the same relationship to its own 1 kHz tone.

   Because the CVC calibration tone lives in sounds_cvc/ too, it receives the
   SAME adjustment as the CVC words. That is the point: after the adjustment the
   CVC tone and the CVCV tone give the SAME audiometer VU reading at one dial
   setting, which is the proof that the two sets are level-matched.

   This is a single figure that a clinician can change from Settings (with a
   confirmation), NOT a per-language constant — the rule is purely "which folder
   did this file come from". Applies to words and the CVC tone; the masker and
   the CVCV assets are in other folders and are untouched. */
const CVC_SOUND_DIR = "sounds_cvc";
const DEFAULT_CVC_FILE_GAIN_DB = -5.07;

// The active adjustment: the persisted setting if present, else the default.
// Stored as a signed dB figure (negative = attenuation), matching the UI label.
function cvcFileGainDb() {
  const v = Number(state.cvcFileGainDb);
  return Number.isFinite(v) ? v : DEFAULT_CVC_FILE_GAIN_DB;
}

// Extra gain adjustment (dB, signed) for a given file URL, by folder. Any asset
// under sounds_cvc/ gets the CVC adjustment; everything else gets 0. This is the
// single source of truth for the offset, so the play path, the decode path and
// the calibration path all agree without threading a per-call flag.
function fileGainAdjustDb(url) {
  if (typeof url !== "string") return 0;
  return url.includes(`${CVC_SOUND_DIR}/`) ? cvcFileGainDb() : 0;
}
function WORD_LISTS_FOR(langKey) { return (LANGUAGES[langKey] || LANGUAGES.maori).lists; }
function currentWordLists() { return lang().lists; }
function phonemeCount() { return lang().phonemeCount; }
// Phoneme columns of a word entry, regardless of language (skips the word itself).
function wordPhonemes(wordEntry) { return wordEntry.slice(1, 1 + phonemeCount()); }
function blankSelections() { return Array(phonemeCount()).fill(false); }
function blankResponses() { return Array(phonemeCount()).fill(null); }
function pointsPerPhoneme() { return 100 / phonemeCount(); } // 25 (Māori) or 33.3 (English)

// Whether word order should be shuffled for a language: a per-language override
// wins if set, otherwise the language default. Defaults: Māori shuffled, English fixed.
function randomiseEnabled(langKey = state.language) {
  const ov = state.randomiseOverride?.[langKey];
  if (ov === true || ov === false) return ov;
  return !!(LANGUAGES[langKey] || LANGUAGES.maori).randomiseOrder;
}

const KNOWN_SOUND_FILES = [
  "calibration_CVCV_1kHz.mp3",
  "hapū.mp3","hāte.mp3","hēki.mp3","heru.mp3","hine.mp3","hinu.mp3","hipi.mp3","honu.mp3",
  "hope.mp3","huri.mp3","kaha.mp3","kare.mp3","keke.mp3","kēmu.mp3","kīngi.mp3","kino.mp3",
  "koha.mp3","kohu.mp3","kōrero_mai_01.mp3","kōrero_mai_02.mp3","kōrero_mai_03.mp3","kōrero_mai_04.mp3","kōrero_mai_05.mp3","kōrero_mai_06.mp3",
  "kōrero_mai_07.mp3","kōrero_mai_08.mp3","kōrero_mai_09.mp3","kōrero_mai_10.mp3","kōrero_mai_11.mp3","kupu.mp3","kurī.mp3","mangu.mp3",
  "manu.mp3","mata.mp3","mihi.mp3","miro.mp3","mīti.mp3","mōku.mp3","moni.mp3","muku.mp3",
  "mutu.mp3","nama.mp3","nāna.mp3","nēhi.mp3","neke.mp3","nēra.mp3","ngaki.mp3","ngako.mp3",
  "ngaro.mp3","ngaru.mp3","ngata.mp3","ngāti.mp3","ngenge.mp3","ngeru.mp3","ngira.mp3","ngutu.mp3",
  "niho.mp3","noho.mp3","noise.mp3","noke.mp3","nōku.mp3","nōna.mp3","pahi.mp3","pāmu.mp3",
  "papa.mp3","peka.mp3","pēpi.mp3","pere.mp3","piko.mp3","pipi.mp3","poto.mp3","pune.mp3",
  "rama.mp3","rangi.mp3","rata.mp3","reka.mp3","rima.mp3","rimu.mp3","rōpū.mp3","roto.mp3",
  "rūma.mp3","runga.mp3","take.mp3","tana.mp3","tāne.mp3","tangi.mp3","tapu.mp3","tēpu.mp3",
  "tiki.mp3","tino.mp3","tiro.mp3","tuku.mp3","waha.mp3","wāhi.mp3","waho.mp3","waka.mp3",
  "wehi.mp3","weka.mp3","wera.mp3","wētā.mp3","whana.mp3","whanga.mp3","whare.mp3","whata.mp3",
  "whatu.mp3","whero.mp3","whetū.mp3","whiti.mp3","whitu.mp3","whiwhi.mp3","wiki.mp3","wiri.mp3"
];

const PHONEMES = {
  C: ["p","t","k","m","n","ŋ","w","f","ɾ","h"],
  V: ["a","aː","e","eː","i","iː","o","oː","u","uː"]
};
const V_EQ = { "a":"a","aː":"a","e":"e","eː":"e","i":"i","iː":"i","o":"o","oː":"o","u":"u","uː":"u" };

const state = {
  language: "maori",
  client: {},
  sessionId: null,   // id of the current session in the keyed store (Sessions.js)
  calibration: { method: null, measuredDbA: null, dial: { left: null, right: null }, timestamp: null, isCalibrated: false, sliderMinDb: -100, sliderMaxDb: 0, currentSliderDb: 0, strandedLists: 0 },
  // Gain adjustment (signed dB) applied to every file played from sounds_cvc/.
  // Default -5.07 dB matches the CVC recordings being that much hotter than the
  // CVCV set; changing it is a deliberate, confirmed action (see the setting).
  cvcFileGainDb: DEFAULT_CVC_FILE_GAIN_DB,
  preload: null,
  queue: [],
  currentListIndex: -1,
  currentTrialIndex: 0,
  currentTrials: [],
  currentResultIndexByTrial: {},
  firstTrialMaskerPrimed: false,
  results: [],
  trialScore: null,
  scoringMode: "none",
  targetSelections: [false,false,false,false],
  responseSelections: [null,null,null,null],
  _pendingAdvance: null,
  awaitingListLevelConfirm: false,
  _advancing: false,
  // Per-language word-order override; null = use the language's default.
  randomiseOverride: { maori: null, english: null },
  clinicLogo: null,
  dialectSubstitutions: {},
  training: null,
  _trainingBypass: false,
  // Test mode: "fixed" (the original queue-of-levels flow) or "adaptive".
  testMode: "fixed",
  // Live adaptive run; null unless an adaptive track is in progress.
  // { session, procedure, listNumbers, words, maskerOffsetDb, startLevel,
  //   currentLevel, results:[], railPending }
  adaptive: null,
  // Persisted adaptive UI selections (survive re-render / reload of the form).
  adaptiveForm: { procedure: "A1", startLevel: 60, nTrials: 20, selectedLists: [] },
  // Serialisable summaries of completed adaptive tracks (for the report).
  adaptiveTracks: [],
  audio: {
    ctx: null,
    masker: null,
    maskerGain: null,
    calSource: null,
    calNode: null,
    calRouter: null,
    testCalNode: null,
    rateMismatch: null,
    activeStimuli: [],
    decodedBuffers: {}
  }
};

// Expose the app state on window so the optional experiment module (a separate
// classic script) can read and extend it. Top-level `const` is not a window
// property, so this bridge is explicit. No effect on normal operation.
if (typeof window !== "undefined") window.state = state;

const $ = (id) => document.getElementById(id);

function snap5(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n / 5) * 5;
}

/* ── Calibration methods ─────────────────────────────────────────────────
   Both methods yield the SAME quantity: the SPL produced at unity gain. What
   differs is how it is obtained, what it costs to change, and therefore what
   the app should say when a limit is reached.

   audiometer  the figure is a DIAL SETTING. The ceiling is the clinician's to
               move; the whole usable window slides with it.
   soundfield  the figure is a METER READING with the device already at full
               volume. The ceiling is a hardware fact — nothing raises it.

   The method is NOT implied by the transducer: an audiometer can drive a
   sound-field speaker. Do not infer it from $("transducer"). */
const CAL_METHODS = {
  audiometer: {
    label: "Audiometer — via aux / tape input",
    levelLabel: "Audiometer dial setting, dB(A)",
    levelStep: 5,
    steps: [
      "Set the device volume to maximum and leave it there for the whole session.",
      "Play the 1 kHz calibration tone and adjust the audiometer's aux input gain until its VU meter reads 0.",
      "Set the audiometer dial to the highest level you expect to present, plus a margin. Use at least 6 dB of margin if you will be masking.",
      "Stop the tone and enter that dial setting below.",
      "One calibration serves both word sets: the CVC and CVCV tones share the same tone-to-speech relationship, and the app attenuates the CVC words by 5.07 dB so both sit on the same effective level scale."
    ]
  },
  soundfield: {
    label: "Sound field — sound level meter",
    levelLabel: "Measured level, dB(A)",
    levelStep: 0.1,
    steps: [
      "Set the device volume to maximum and leave it there for the whole session.",
      "Place the sound level meter at the client's head position, facing the speaker.",
      "Play the calibration noise and read the level in dB(A) using your usual meter settings.",
      "Stop the noise and enter that reading below."
    ]
  }
};

function calMethod() { return state.calibration.method || "audiometer"; }
function calMethodInfo() { return CAL_METHODS[calMethod()] || CAL_METHODS.audiometer; }
function calMethodHint() {
  return calMethod() === "audiometer"
    ? `Levels are presented from this figure downward. Set the dial to the loudest ` +
      `level you'll need, plus a little margin — at least 6 dB if you'll be masking.`
    : `This is the most this setup can deliver with the device at full volume. The ` +
      `calibration is valid only for this speaker, seat and room — recalibrate if any change.`;
}
// How to get more or less level, phrased in this method's terms. Used by every
// limit message so the clinician is always told something they can act on.
function moreLevelAdvice() {
  return calMethod() === "audiometer"
    ? "raise the audiometer dial and recalibrate"
    : "this setup is already at full output — more level needs a different speaker or amplifier, or a closer position";
}
function lessLevelAdvice() {
  return calMethod() === "audiometer"
    ? "lower the audiometer dial and recalibrate"
    : "this is the bottom of the recordings' range — there's nothing quieter to present";
}

/* ── Presentation level bounds ───────────────────────────────────────────
   measuredDbA is the SPL at unity gain. The app only attenuates below it:
     max = the reference itself (gain 1.0). Nothing above it plays without clipping.
     min = the bottom of the recordings' dynamic range.
   Neither bound is clinical — the clinician chooses the range by choosing the
   reference. The software keeps the displayed level equal to the presented one
   and never offers a negative dB(A). */

// The recordings are 16-bit (as CD-based speech material has been for decades),
// which carries ~96 dB of dynamic range. Attenuating further than this only digs
// into quantisation noise, so 96 dB is where the useful range ends. This is a
// property of the recordings, NOT a clinical or hardware limit — in practice the
// floor almost never binds, because the reference sits well under 96 dB above the
// levels anyone presents. Raise it only if the source material's bit depth does.
const MAX_ATTENUATION_DB = 96;

// ── Per-ear calibration reference ─────────────────────────────────────────
// Audiometer calibration has an independent dial per channel (A/B → left/right),
// so a clinician can give one ear more headroom for asymmetric losses. The
// reference for a given ear is:
//   • audiometer: calibration.dial[ear] if set, else the shared measuredDbA
//   • sound-field: the single measuredDbA (one speaker/meter for both)
// currentStimEarSide() maps the routing selector to "left"/"right"; binaural or
// unknown falls back to whichever dial is set (or the shared value).
function currentStimEarSide() {
  const v = $("stimEar") ? $("stimEar").value : "";
  if (v === "left" || v === "right") return v;
  return null;   // binaural / soundfield / unset
}
function referenceDbA(ear) {
  const cal = state.calibration;
  if (!cal || !cal.isCalibrated) return null;
  if (calMethod() === "audiometer" && cal.dial && typeof cal.dial === "object") {
    const has = (v) => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));
    const side = (ear === "left" || ear === "right") ? ear : currentStimEarSide();
    if (side && has(cal.dial[side])) return Number(cal.dial[side]);
    // No dial for this side yet: fall back to the other side, then shared value.
    const other = side === "left" ? "right" : "left";
    if (has(cal.dial[other])) return Number(cal.dial[other]);
  }
  return cal.measuredDbA === null ? null : Number(cal.measuredDbA);
}
// The reference in effect for the current routing — used by the gain path.
function currentReferenceDbA() { return referenceDbA(currentStimEarSide()); }

// The ONLY floor on presentation level is the recording's dynamic range: below
// reference − MAX_ATTENUATION_DB you are digging into quantisation noise. There
// is no floor at 0 dB(A). Negative dB(A)/dB SPL are perfectly valid — they are
// simply pressures below the 20 µPa reference (a normal threshold at 2–4 kHz is
// itself below 0 dB SPL). Both audiometer and sound-field modes are bounded only
// by attenuation. Optionally scoped to a specific ear's dial.
function levelBounds(ear) {
  const cal = state.calibration;
  if (!cal.isCalibrated) return null;
  const reference = referenceDbA(ear);
  if (reference === null) return null;
  // Levels live on a 5 dB grid: round the ceiling DOWN and the floor UP so
  // every selectable position is genuinely inside the bounds.
  const max = Math.floor(reference / 5) * 5;
  const attenuationFloor = reference - MAX_ATTENUATION_DB;
  const min = Math.ceil(attenuationFloor / 5) * 5;
  return {
    reference, min, max,
    usable: min <= max,
    span: max - min
  };
}

// Snap to the 5 dB grid, then hold inside the bounds.
function clampLevel(value) {
  const snapped = snap5(value);
  const b = levelBounds();
  if (!b || !b.usable) return snapped;   // uncalibrated: unity gain anyway
  return Math.min(b.max, Math.max(b.min, snapped));
}

// Masker shares the reference with the stimulus — same gain path.
function maskerLevel() { return clampLevel($("maskLevel") ? $("maskLevel").value : 0); }

// The ear the masker is routed to ("left"/"right"), or null for binaural/off —
// used to pick that ear's calibration reference for the masker gain.
function maskEarSide() {
  const v = $("maskEar") ? $("maskEar").value : "";
  return (v === "left" || v === "right") ? v : null;
}

/* ── Masker noise-vs-tone correction ──────────────────────────────────────
   With tone-referenced audiometer calibration (both channels zeroed to the 1 kHz
   tone, not re-zeroed on the noise), the masker file plays hotter than the dial
   by its measured noise-vs-tone RMS offset. Subtract that offset from the masker
   gain so "masker at N dB" means N dB relative to the dial reference, matching
   what a noise-track VU null used to give for free. Per language; overridable via
   config.js: window.APP_CONFIG.masking = { noiseVsToneDb: { maori: 0.75, english: 0.76 } }.
   Returns a SIGNED adjustment (negative = attenuate) suitable for gainForLevel's
   adjustDb argument. Only sound-field mode, which is noise-referenced by its own
   calibration, skips it. */
function maskerNoiseAdjustDb() {
  const L = lang();
  const cfg = window.APP_CONFIG?.masking?.noiseVsToneDb?.[L.key];
  const off = Number.isFinite(Number(cfg)) ? Number(cfg)
            : (Number.isFinite(Number(L.noiseVsToneDb)) ? Number(L.noiseVsToneDb) : 0);
  // Sound-field calibration references the noise directly (meter reads the noise),
  // so no tone-referenced correction is needed there.
  if (calMethod() === "soundfield") return 0;
  return -off;   // file is +off above the tone → attenuate by off to sit at dial
}

// Transient note in the test-screen nudge bar. Creates its own element.
function flashLevelLimit(msg) {
  let el = document.getElementById("levelLimitMsg");
  if (!el) {
    const bar = document.querySelector(".level-nudge-bar") ||
                ($("levelNudgeLabel") && $("levelNudgeLabel").parentElement);
    if (!bar) return;
    el = document.createElement("span");
    el.id = "levelLimitMsg";
    el.className = "level-limit-msg";
    el.setAttribute("role", "status");
    bar.appendChild(el);
  }
  el.textContent = msg;
  clearTimeout(flashLevelLimit._t);
  flashLevelLimit._t = setTimeout(() => { el.textContent = ""; }, 6000);
}

// Worst-case combined clipping check: assumes the two signals add in phase.
// Speech-plus-noise sums nearer sqrt(g1²+g2²), so this over-warns.
function combinedClippingRisk() {
  const cal = state.calibration;
  if (!cal.isCalibrated || cal.measuredDbA === null) return null;
  if (!$("maskEar") || $("maskEar").value === "off") return null;
  const q = currentQueueItem();
  if (!q) return null;
  const g = L => Math.pow(10, (Number(L) - Number(cal.measuredDbA)) / 20);
  const sum = g(q.levelDbA) + g(maskerLevel());
  if (sum <= 1) return null;
  return { sum, overshootDb: 20 * Math.log10(sum) };
}

// Single owner of the calibration status line, so range/method/stranded notes
// don't overwrite each other.
// Human-readable summary of the calibration reference(s), for status text and
// the exported report. Audiometer shows both dials (or one if only one is set);
// sound-field shows the single measured SPL.
function referenceSummary() {
  const cal = state.calibration;
  if (!cal || !cal.isCalibrated) return "not set";
  if (cal.method === "audiometer" && cal.dial &&
      (cal.dial.left != null || cal.dial.right != null)) {
    const l = cal.dial.left != null ? `L ${cal.dial.left}` : "L —";
    const r = cal.dial.right != null ? `R ${cal.dial.right}` : "R —";
    return `${l} / ${r} dB(A)`;
  }
  return cal.measuredDbA != null ? `${cal.measuredDbA} dB(A)` : "not set";
}

function renderCalStatus() {
  const el = $("calStatus");
  if (!el) return;
  const b = levelBounds();
  if (!b || !b.usable) return;   // uncalibrated / refused: message set elsewhere

  const isAudiometer = calMethod() === "audiometer";
  const parts = [
    `${isAudiometer ? "Dial setting" : "Measured"} ${b.reference} dB(A) — presentation ` +
    `range ${b.min}–${b.max} dB(A). Device volume must stay at maximum.`
  ];
  if (b.reference !== b.max) {
    parts.push(`Ceiling rounded to ${b.max} to stay on the 5 dB grid.` +
      (isAudiometer ? " Set the dial on a 5 dB step to avoid losing headroom." : ""));
  }
  parts.push(isAudiometer
    ? `To present above ${b.max} dB(A), raise the audiometer dial and recalibrate.`
    : `That is the most this setup can deliver — more level needs a different speaker ` +
      `or amplifier, or a closer position.`);
  if (state.calibration.strandedLists) {
    parts.push(`${state.calibration.strandedLists} list(s) already tested outside ` +
      `${b.min}–${b.max} dB(A); their recorded levels are unchanged — check the report ` +
      `before relying on them.`);
  }
  el.textContent = parts.join(" ");
}

// A restored session or a new reference can leave queue levels outside the
// current window. Re-clamp entries not yet started; leave levels that already
// have results and warn, since rewriting them would desync queue from results.
function reconcileQueueLevels() {
  const b = levelBounds();
  if (!b || !b.usable) { state.calibration.strandedLists = 0; return []; }
  const stranded = [];
  state.queue.forEach(q => {
    const clamped = clampLevel(q.levelDbA);
    if (clamped === q.levelDbA) return;
    const hasResults = state.results.some(r =>
      r.listNumber === q.listNumber &&
      r.listLevelDbA === q.levelDbA &&
      (r.language || "maori") === (q.language || "maori"));
    if (hasResults || q.status === "in-progress") stranded.push({ ...q });
    else q.levelDbA = clamped;
  });
  renderQueue();
  state.calibration.strandedLists = stranded.length;
  return stranded;
}

// A compact snapshot of the presentation setup in force RIGHT NOW, stamped onto
// each recorded result so a session that spans a mid-test dial change (or a
// routing/transducer change) stays correctly interpretable. Never rewritten:
// once a result carries a stamp, that stamp is the truth of how it was presented.
function presentationSetupStamp() {
  const cal = state.calibration || {};
  return {
    method: cal.method || null,
    referenceDbA: currentReferenceDbA(),                 // the ear-correct reference used
    dial: cal.dial ? { left: cal.dial.left, right: cal.dial.right } : null,
    measuredDbA: cal.measuredDbA ?? null,
    stimEar: $("stimEar") ? $("stimEar").value : null,   // stimulus routing
    presentationCondition: $("presentationCondition") ? $("presentationCondition").value : null,
    maskEar: $("maskEar") ? $("maskEar").value : null,
    transducer: $("transducer") ? $("transducer").value : null
  };
}

function conditionSymbol(condition) {
  return { left: "×", right: "○", binaural: "B", soundfield: "S", aided: "A", unaided: "U" }[condition] || "?";
}

function conditionLabel(condition) {
  return { left: "Left", right: "Right", binaural: "Binaural", soundfield: "Sound field", aided: "Aided", unaided: "Unaided" }[condition] || condition;
}

function init() {
  $("sessionDate").value = new Date().toISOString().slice(0,10);
  repopulateListSelects();
  loadClinicSettings();
  loadCvcGainSetting();
  // ── Multi-session store: register hooks, migrate any legacy draft, and flag
  //    sessions left mid-test (browser closed) as [interrupted]. ──
  if (window.Sessions) {
    window.Sessions.register({
      buildPayload: buildSessionPayload,
      applyPayload: applySessionPayload,
      describe: () => ({
        client: {
          name: state.client?.name || "", id: state.client?.id || "",
          dob: state.client?.dob || "", date: state.client?.date || ""
        },
        resultCount: (state.results && state.results.length) || 0,
        testInProgress: (Array.isArray(state.queue) &&
          state.queue.some(q => q && q.status === "in-progress")) || !!state.adaptive
      }),
      onListChanged: () => renderRecentSessions()
    });
    window.Sessions.migrateLegacy("ucTeReoSpeechAudiometry");
    window.Sessions.reconcileOnLoad(null);   // no current session yet this load
  }
  loadDraftIntoForm();
  bindEvents();
  applyLanguageToUI();
  setupCalibrationSlider();
  refreshPI();
  if (typeof window !== "undefined" && window.MaskingUI) window.MaskingUI.init();
  if ($("maskingEnabled")) updateMaskingEnabled();
  offerStoredCalibration();
  renderRecentSessions();
  renderQueue();
  updateSetupResultsSummary();
  updateTrainingBadge();
  updateClearClientBtn();
  applyAdaptiveFormToUI();
  setTestMode(state.testMode || "fixed");
  startMaoriPreloadWhenIdle();
  // If a restored session is already in English, warm that batch too.
  if (state.language === "english") startEnglishPreloadIfNeeded();
}

// ── Clinic settings (device-persistent, separate from session) ──
function loadClinicSettings() {
  const saved = localStorage.getItem("ucCVCVClinic");
  if (!saved) return;
  try {
    const d = JSON.parse(saved);
    if ($("clinicName") && d.name) $("clinicName").value = d.name;
    if (d.logo) renderLogoPreview(d.logo);
    if ($("facilityName") && d.facility) $("facilityName").value = d.facility;
    if ($("clinician") && d.clinician) $("clinician").value = d.clinician;
    if ($("clinicianRole") && d.role) $("clinicianRole").value = d.role;
    if ($("transducer") && d.transducer) $("transducer").value = d.transducer;
    if (d.iaa && typeof d.iaa === "object") {
      state.masking = state.masking || {};
      state.masking.iaa = Object.assign({ supraaural:40, insert:55, airpods:45, other:40 }, d.iaa);
    }
  } catch {}
}

function saveClinicSettings() {
  const data = {
    name: $("clinicName") ? $("clinicName").value.trim() : "",
    facility: $("facilityName") ? $("facilityName").value.trim() : "",
    clinician: $("clinician") ? $("clinician").value.trim() : "",
    role: $("clinicianRole") ? $("clinicianRole").value.trim() : "",
    transducer: $("transducer") ? $("transducer").value : "",
    iaa: (state.masking && state.masking.iaa) ? state.masking.iaa : undefined,
    logo: state.clinicLogo || null
  };
  localStorage.setItem("ucCVCVClinic", JSON.stringify(data));
}

// ── CVC file gain adjustment (device-persistent) ──
// Applied to every file in sounds_cvc/. Default -5.07 dB. Persisted separately
// so it survives sessions and reloads, like calibration and clinic settings.
const CVC_GAIN_STORAGE_KEY = "ucCVCVFileGainDb";

function loadCvcGainSetting() {
  try {
    const raw = localStorage.getItem(CVC_GAIN_STORAGE_KEY);
    if (raw !== null) {
      const v = Number(JSON.parse(raw));
      state.cvcFileGainDb = Number.isFinite(v) ? v : cvcConfigDefault();
    } else {
      state.cvcFileGainDb = cvcConfigDefault();
    }
  } catch {
    state.cvcFileGainDb = cvcConfigDefault();
  }
  renderCvcGainSetting();
}

// Install-time default: config.js may set window.APP_CONFIG.levels.cvcFileGainDb
// (signed dB) to change the shipped default without editing app.js. Falls back
// to the built-in -5.07. A persisted user setting still overrides this.
function cvcConfigDefault() {
  const v = Number(window.APP_CONFIG?.levels?.cvcFileGainDb);
  return Number.isFinite(v) ? v : DEFAULT_CVC_FILE_GAIN_DB;
}

function saveCvcGainSetting() {
  localStorage.setItem(CVC_GAIN_STORAGE_KEY, JSON.stringify(cvcFileGainDb()));
}

// Reflect the current value into the settings UI (input + status), if present.
function renderCvcGainSetting() {
  const input = $("cvcGainInput");
  if (input) input.value = cvcFileGainDb();
  const status = $("cvcGainStatus");
  if (status) {
    const v = cvcFileGainDb();
    const isDefault = Math.abs(v - DEFAULT_CVC_FILE_GAIN_DB) < 1e-9;
    status.textContent = isDefault
      ? `Default (${DEFAULT_CVC_FILE_GAIN_DB} dB). Applies to every sound in the ${CVC_SOUND_DIR}/ folder.`
      : `Custom: ${v} dB (default is ${DEFAULT_CVC_FILE_GAIN_DB} dB). Applies to every sound in the ${CVC_SOUND_DIR}/ folder.`;
  }
}

// Change the setting, but only behind a thorough confirmation — this figure is
// the level relationship between the two word sets, and getting it wrong makes
// every CVC result off by the error. Returns true if applied.
function requestCvcGainChange(nextValueRaw) {
  const next = Number(nextValueRaw);
  if (!Number.isFinite(next)) {
    renderCvcGainSetting();   // reject: restore displayed value
    return false;
  }
  const current = cvcFileGainDb();
  if (Math.abs(next - current) < 1e-9) return false;   // no change

  const warning =
    "Change the CVC file gain adjustment?\n\n" +
    `This changes the level of EVERY sound played from the ${CVC_SOUND_DIR}/ folder ` +
    "— the CVC words AND the CVC 1 kHz calibration tone — by the amount you enter.\n\n" +
    `Current: ${current} dB\nNew: ${next} dB\n\n` +
    `The default of ${DEFAULT_CVC_FILE_GAIN_DB} dB is what puts the CVC word set on the ` +
    "same effective level scale as the te reo CVCV set under one audiometer calibration. " +
    "It reflects the CVC recordings being 5.07 dB hotter than the CVCV recordings.\n\n" +
    "Only change this if you have re-measured the two word sets and know the new " +
    "relationship. An incorrect value will make every CVC presentation the wrong " +
    "level, and you will need to RE-CALIBRATE afterwards.\n\n" +
    "Are you sure you want to change it?";

  if (!window.confirm(warning)) {
    renderCvcGainSetting();   // cancelled: restore displayed value
    return false;
  }

  state.cvcFileGainDb = next;
  saveCvcGainSetting();
  renderCvcGainSetting();

  // The reference the clinician metered was on the OLD adjustment, so it no
  // longer describes what the CVC files present at. Make that impossible to miss.
  if (state.calibration.isCalibrated) {
    const note = $("cvcGainStatus");
    if (note) {
      note.textContent =
        `Saved: ${next} dB. Re-run calibration — the stored calibration was measured ` +
        `with the previous adjustment and no longer matches the ${CVC_SOUND_DIR}/ files.`;
    }
  }
  return true;
}

function resetCvcGainSetting() {
  return requestCvcGainChange(DEFAULT_CVC_FILE_GAIN_DB);
}

function renderLogoPreview(dataUrl) {
  const preview = $("logoPreview");
  if (!preview) return;
  preview.innerHTML = dataUrl ? `<img src="${dataUrl}" alt="Clinic logo">` : "";
  if ($("removeLogoBtn")) $("removeLogoBtn").style.display = dataUrl ? "" : "none";
  state.clinicLogo = dataUrl || null;
}

// Build the full serialisable session payload (used by saveSession and the
// Sessions store hook). Pure snapshot of the current session state.
function buildSessionPayload() {
  return {
    savedAt: new Date().toISOString(),
    sessionId: state.sessionId,
    language: state.language,
    randomiseOverride: state.randomiseOverride,
    client: state.client,
    participant: state.participant,          // per-ear audiogram/PTA/start spec
    experiment: state.experiment,            // experiment stepper + CSV stores
    masking: state.masking,                  // IAA settings
    calibration: state.calibration,
    queue: state.queue,
    currentListIndex: state.currentListIndex,
    currentTrialIndex: state.currentTrialIndex,
    currentTrials: state.currentTrials,
    results: state.results,
    dialectSubstitutions: state.dialectSubstitutions,
    training: state.training,
    testMode: state.testMode,
    adaptiveForm: state.adaptiveForm,
    adaptiveTracks: state.adaptiveTracks || [],
    // Live adaptive engine, if a track is mid-flight, captured as its config +
    // per-trial log so it can be replayed to the exact state on restore. The
    // engine instance itself isn't serialisable; the replay is lossless for A1
    // and, with the interleave persisted, for A2 too.
    adaptiveLive: serialiseLiveAdaptive()
  };
}

// Capture a live adaptive session as a replayable descriptor, or null if none.
function serialiseLiveAdaptive() {
  const a = state.adaptive;
  if (!a || !a.session) return null;
  const s = a.session;
  return {
    meta: {
      procedure: s.procedure, startLevel: s.startLevel, nTrials: s.nTrials,
      phonemeCount: s.phonemeCount, perUnitFloor: s.perUnitFloor,
      bk: s.bk, pTargets: s.tracks.map(t => t.pTarget),
      interleave: s.interleave.slice(), pos: s.pos
    },
    // The scored trials in presentation order: enough to replay record().
    log: (s.log || []).map(e => ({
      trackId: e.trackId, level: e.level, correct: e.correct, phonemes: e.phonemes
    })),
    // Non-session bookkeeping app.js keeps alongside the engine.
    context: {
      language: a.language, listNumbers: a.listNumbers, words: a.words,
      maskerOffsetDb: a.maskerOffsetDb, startLevel: a.startLevel,
      stimulusEar: a.stimulusEar, position: a.position
    }
  };
}

function saveSession() {
  // Always snapshot current form values so recent sessions reflect live state
  state.client = {
    name:     $("clientName")     ? $("clientName").value.trim()     : (state.client?.name     || ""),
    id:       $("clientId")       ? $("clientId").value.trim()       : (state.client?.id       || ""),
    dob:      $("clientDob")      ? $("clientDob").value             : (state.client?.dob      || ""),
    date:     $("sessionDate")    ? $("sessionDate").value           : (state.client?.date     || ""),
    clinician:$("clinician")      ? $("clinician").value.trim()      : (state.client?.clinician|| ""),
    role:     $("clinicianRole")  ? $("clinicianRole").value.trim()  : (state.client?.role     || ""),
    facility: $("facilityName")   ? $("facilityName").value.trim()   : (state.client?.facility || ""),
    notes:    $("sessionNotes")   ? $("sessionNotes").value.trim()   : (state.client?.notes    || "")
  };

  // Ensure the session has an id (created lazily on first save of real content).
  if (!state.sessionId && window.Sessions) state.sessionId = window.Sessions.newId();
  if (window.Sessions && state.sessionId) {
    window.Sessions.save(state.sessionId, "active");
  }
}

function updateSetupResultsSummary() {
  const el = $("setupResultsSummary");
  if (!el) return;
  const n = state.results?.length || 0;
  const tracks = state.adaptiveTracks || [];
  if (!n && !tracks.length) { el.textContent = "No results recorded yet."; return; }
  const lines = [];
  tracks.forEach((t, i) => {
    const L = LANGUAGES[t.language] || LANGUAGES.maori;
    const srt = t.srt != null ? `${t.srt.toFixed(1)} dB(A)` : "no estimate";
    lines.push(`${L.label} — ${t.procedure} adaptive (track ${i + 1}): SRT ${srt}`);
  });
  const summaries = listSummaries();
  summaries.forEach(s =>
    lines.push(`List ${s.listNumber} @ ${s.level} dB(A) — ${conditionLabel(s.condition)} — ${s.percent}% (${s.trials} trial${s.trials !== 1 ? "s" : ""})`)
  );
  el.innerHTML = lines.join("<br>");
}

function openSavedJson(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      if (!data.results) { alert("This file doesn't appear to be a valid results JSON."); return; }

      // Normalise the payload so the full restore path (applySessionPayload) can
      // rebuild everything — completed adaptive tracks, an in-progress track, the
      // PI plots, and the queue. Older exports (before the payload carried adaptive
      // state) only have raw `results`; reconstruct what we can from those so the
      // session no longer reopens blank.
      const payload = Object.assign({}, data);

      // Language: newer files use activeLanguage; older ones used `language`.
      const lang = (data.activeLanguage && LANGUAGES[data.activeLanguage]) ? data.activeLanguage
                 : (data.language && LANGUAGES[data.language]) ? data.language
                 : null;
      if (lang) payload.language = lang;

      // If the file predates adaptiveTracks in the export, rebuild the finished
      // tracks from the per-trial results so their SRTs and plots reappear.
      if (!Array.isArray(payload.adaptiveTracks) || !payload.adaptiveTracks.length) {
        const rebuilt = rebuildAdaptiveTracksFromResults(data.results);
        if (rebuilt.length) payload.adaptiveTracks = rebuilt;
      }
      // These may be absent in old files; applySessionPayload guards for that.
      if (!("adaptiveLive" in payload)) payload.adaptiveLive = null;
      if (!payload.testMode) {
        payload.testMode = data.results.some(r => r && r.adaptive) ? "adaptive" : "fixed";
      }

      applySessionPayload(payload);
      const nTracks = Array.isArray(state.adaptiveTracks) ? state.adaptiveTracks.length : 0;
      alert(`Loaded ${state.results.length} trial results` +
            (nTracks ? ` and ${nTracks} adaptive track${nTracks === 1 ? "" : "s"}` : "") +
            ` for ${state.client?.name || "unknown client"}.`);
    } catch (err) {
      console.error("[openSavedJson]", err);
      alert("Could not read file — it may be corrupt or the wrong format.");
    }
  };
  reader.readAsText(file);
  // Reset input so the same file can be re-opened
  e.target.value = "";
}

// Reconstruct finished adaptive-track summaries from raw per-trial results, for
// files exported before the payload carried `adaptiveTracks`. Groups adaptive
// trials by their track identity (language + condition + source-list set) and
// fits each group's log with the Adaptive fitter so the SRT/slope/plot return.
function rebuildAdaptiveTracksFromResults(results) {
  if (!Array.isArray(results) || !window.Adaptive ||
      typeof window.Adaptive.fitFromLog !== "function") return [];
  const adaptive = results.filter(r => r && r.adaptive);
  if (!adaptive.length) return [];

  // Group key: the fields that actually distinguish one track from another —
  // language, the list-set, and the ear. (An `adaptiveTrack` field exists but in
  // practice is a constant per session, so it can't be used to separate tracks.)
  // If a session ever does carry a genuinely varying track id, prefer it.
  const trackIds = new Set(adaptive.map(r => String(r.adaptiveTrack)));
  const useTrackId = trackIds.size > 1;
  const groups = new Map();
  adaptive.forEach(r => {
    const key = useTrackId
      ? `t${r.adaptiveTrack}`
      : `${r.language || "maori"}|${r.listNumber || ""}|${r.stimulusEar || r.presentationCondition || ""}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  });

  const tracks = [];
  groups.forEach((rows, key) => {
    // Preserve presentation order.
    rows.sort((a, b) => (a.trialOrder || 0) - (b.trialOrder || 0));
    const log = rows.map((r, i) => {
      const level = Number(r.listLevelDbA);
      const phonemes = Number(r.phonemeCount);
      const correct = Number(r.score);
      return {
        order: i + 1,
        trackId: 1,                                    // A1 is single-track
        word: r.presentedWord,
        sourceList: r.sourceList != null ? r.sourceList : null,
        level,
        correct,
        phonemes,
        result: phonemes ? (correct / phonemes) : 0,   // proportion, for the % column
        transcription: r.comment || null
      };
    }).filter(e => Number.isFinite(e.level) && Number.isFinite(e.phonemes) && e.phonemes > 0);
    if (log.length < 2) return;

    let fit = null;
    try { fit = window.Adaptive.fitFromLog(log); } catch { fit = null; }
    const first = rows[0];
    tracks.push({
      language: first.language || "maori",
      procedure: first.adaptiveProcedure || "A1",
      stimulusEar: first.stimulusEar || first.presentationCondition || "",
      condition: first.presentationCondition || first.stimulusEar || "",
      listNumbers: String(first.listNumber || "").split("+").map(n => Number(n)).filter(Boolean),
      maskerEar: first.maskerEar || "",
      srt: fit ? fit.srt : null,
      slope: fit ? fit.slope : null,
      fitConverged: fit ? !!fit.converged : false,
      nObservations: log.reduce((s, e) => s + (e.phonemes || 0), 0),
      nTrials: log.length,
      phonemeCount: first.phonemeCount || (first.language === "english" ? 3 : 4),
      startLevel: first.adaptiveStartLevel != null ? first.adaptiveStartLevel : null,
      timestamp: first.timestamp || new Date().toISOString(),
      log,
      reconstructed: true   // flag: rebuilt from raw trials, not the live engine
    });
  });
  return tracks;
}

function renderRecentSessions() {
  const list = $("recentSessionsList");
  const hint = $("noRecentHint");
  if (!list || !window.Sessions) return;
  const items = window.Sessions.list();
  if (!items.length) { if (hint) hint.style.display = ""; list.innerHTML = ""; return; }
  if (hint) hint.style.display = "none";
  list.innerHTML = "";
  for (const d of items) {
    const item = document.createElement("div");
    item.className = "recent-session-item";
    const isCurrent = d.id === state.sessionId;
    const when = d.savedAt ? new Date(d.savedAt).toLocaleString("en-NZ", { dateStyle: "short", timeStyle: "short" }) : "earlier";
    const rc = d.resultCount || 0;
    const name = (d.client && d.client.name) || "Unnamed client";
    const tag = isCurrent
      ? ` <span class="recent-tag current">(current session)</span>`
      : (d.status === "interrupted"
          ? ` <span class="recent-tag interrupted">[interrupted]</span>`
          : "");
    item.innerHTML = `
      <div>
        <div class="recent-session-name">${escapeHtml(name)}${tag}</div>
        <div class="recent-session-meta">${(d.client && d.client.date) || ""} · ${rc} trial${rc !== 1 ? "s" : ""} · saved ${when}</div>
      </div>
      <button class="recent-session-dismiss" title="Remove from list" type="button">×</button>
    `;
    item.querySelector(".recent-session-dismiss").onclick = (e) => {
      e.stopPropagation();
      if (isCurrent) { alert("This is the current session — it can't be removed from the list while active."); return; }
      if (confirm(`Remove ${name}'s session from the list? Its saved data will be deleted from this device.`)) {
        window.Sessions.remove(d.id);
      }
    };
    item.onclick = (e) => {
      if (e.target.classList.contains("recent-session-dismiss")) return;
      if (isCurrent) return;   // already loaded
      restoreSession(d.id);
    };
    list.appendChild(item);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const SCREEN_SUBTITLES = {
  "screen-setup":  "Setup",
  "screen-test":   "Testing",
  "screen-report": "Report"
};

function show(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  $(id).classList.add("active");
  const sub = $("headerSubtitle");
  if (sub) {
    let label = SCREEN_SUBTITLES[id] || "Setup";
    if (trainingActive() && id !== "screen-report") label = `🎓 Training — ${label}`;
    sub.textContent = label;
  }
}

function readClientForm() {
  state.client = {
    name: $("clientName").value.trim(),
    id: $("clientId").value.trim(),
    dob: $("clientDob") ? $("clientDob").value : "",
    date: $("sessionDate").value,
    clinician: $("clinician").value.trim(),
    role: $("clinicianRole") ? $("clinicianRole").value.trim() : "",
    facility: $("facilityName") ? $("facilityName").value.trim() : "",
    notes: $("sessionNotes").value.trim()
  };
  saveClinicSettings();
  saveSession();
}

function loadDraftIntoForm() {
  // With the multi-session store, the app no longer auto-loads a single draft on
  // startup. A fresh load starts a clean session; previous work (including any
  // [interrupted] session) is resumed explicitly from the Recent Sessions list.
  // Clinician/role/facility come from device clinic settings, loaded separately.
}

function restoreSession(id) {
  if (!window.Sessions) return;
  const payload = window.Sessions.loadPayload(id);
  if (!payload) { alert("That session's data could not be found."); return; }

  // Warn before leaving the current session. It's already a saved recent entry,
  // so nothing is lost — but make the switch explicit.
  const curHasContent = (state.results && state.results.length) ||
    (state.queue && state.queue.length) || (state.client && state.client.name);
  if (curHasContent) {
    const target = (payload.client && payload.client.name) || "that session";
    if (!confirm(`Load ${target}? This ends the current session. Your current work is ` +
                 `saved and will remain in Recent Sessions.`)) return;
    // Make sure the current session is persisted before we leave it.
    if (state.sessionId) window.Sessions.save(state.sessionId, "clean");
  }

  applySessionPayload(payload);
}

// Restore full app state from a session payload (used by manual restore and by
// crash recovery). Replays a live adaptive track to its exact pre-interruption
// state where one was captured.
function applySessionPayload(payload) {
  try {
    const live = payload.adaptiveLive || null;
    // Bulk-assign the serialisable state.
    Object.assign(state, payload);
    state.adaptive = null;   // will be rebuilt from `live` below if present

    if (!Array.isArray(state.adaptiveTracks)) state.adaptiveTracks = [];
    if (!state.adaptiveForm) state.adaptiveForm = { procedure: "A1", startLevel: 60, nTrials: 20, selectedLists: [] };
    if (!LANGUAGES[state.language]) state.language = "maori";
    if (!state.randomiseOverride || typeof state.randomiseOverride !== "object") {
      state.randomiseOverride = { maori: null, english: null };
    }
    if (!state.dialectSubstitutions) state.dialectSubstitutions = {};

    // Rebuild a live adaptive track, if one was in progress, by replaying its log.
    let resumedTrack = false;
    if (live && window.Adaptive && typeof window.Adaptive.replaySession === "function") {
      const session = window.Adaptive.replaySession(live);
      if (session) {
        state.adaptive = Object.assign({}, live.context, { session });
        resumedTrack = true;
      }
    } else if (Array.isArray(state.queue)) {
      // No live engine captured: drop any incomplete adaptive queue item.
      state.queue = state.queue.filter(q => !(q && q.adaptive && q.status !== "complete"));
    }

    applyLanguageToUI();
    if (payload.client) {
      $("clientName").value = payload.client.name || "";
      $("clientId").value = payload.client.id || "";
      if ($("clientDob")) $("clientDob").value = payload.client.dob || "";
      $("sessionDate").value = payload.client.date || $("sessionDate").value;
      $("sessionNotes").value = payload.client.notes || "";
    }
    setupCalibrationSlider();
    if (state.calibration?.isCalibrated && $("testCalBtn")) $("testCalBtn").hidden = false;
    if (typeof syncMaskerControls === "function") syncMaskerControls();
    renderQueue();
    refreshPI();
    updateSetupResultsSummary();
    updateTrainingBadge();
    updateClearClientBtn();
    applyAdaptiveFormToUI();
    if (window.ParticipantInputs && window.ParticipantInputs.render) { try { window.ParticipantInputs.render(); } catch {} }
    if (window.Experiment && window.Experiment.renderSection) { try { window.Experiment.renderSection(); } catch {} }
    if (window.MaskingUI && window.MaskingUI.render) { try { window.MaskingUI.render(); } catch {} }

    // Mark this the active session and re-save so its status is 'active' again.
    if (window.Sessions && state.sessionId) window.Sessions.save(state.sessionId, "active");
    renderRecentSessions();
    setTestMode(state.testMode || "fixed");

    if (resumedTrack) {
      // Bring the clinician into the test screen ready to continue the track.
      const s = state.adaptive.session;
      const remaining = s.total - s.done;
      alert(`Resumed the adaptive track — ${s.done} of ${s.total} words done, ` +
            `${remaining} remaining. Continue from where it was interrupted.`);
    }
  } catch (e) {
    console.error("[restore]", e);
    alert("Could not restore session — data may be corrupt.");
  }
}

function setupFastScoreButtons() {
  const box = document.querySelector(".score-buttons");
  if (!box) return;
  box.innerHTML = "";
  const max = phonemeCount();
  for (let i = 0; i <= max; i++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.score = String(i);
    btn.textContent = String(i);
    btn.onclick = () => fastScore(i);
    box.appendChild(btn);
  }
}

// Shared fast-score logic used by buttons and keyboard.
// Sets the score then schedules auto-advance after 600ms.
// The trial navigator click handler cancels the pending advance
// and instead jumps to the clicked trial.
function fastScore(score) {
  state.scoringMode = "fast";
  state.trialScore = score;
  state.targetSelections = blankSelections();
  state.responseSelections = blankResponses();
  markScoreButton();
  renderSelectionColours();
  schedulePendingAdvance();
}

function schedulePendingAdvance() {
  // Cancel any existing pending advance
  if (state._pendingAdvance) {
    clearTimeout(state._pendingAdvance);
    state._pendingAdvance = null;
  }
  state._pendingAdvance = setTimeout(() => {
    state._pendingAdvance = null;
    nextTrial();
  }, 600);
}

function cancelPendingAdvance() {
  if (state._pendingAdvance) {
    clearTimeout(state._pendingAdvance);
    state._pendingAdvance = null;
  }
}

// Brief, non-modal cue shown when a "Next" press is ignored because the
// current trial has no score yet. Keeps the clinician from silently skipping.
function flashNextLocked() {
  const btn = $("nextTrialBtn");
  if (btn) {
    btn.classList.add("next-locked");
    btn.textContent = (lang && lang().unit === "word") ? "Score this word first" : "Score this kupu first";
    clearTimeout(state._nextLockTimer);
    state._nextLockTimer = setTimeout(() => {
      btn.classList.remove("next-locked");
      btn.textContent = "Next";
    }, 900);
  }
}

/* ── Training mode ──────────────────────────────────────────────
   Training client JSON profiles + response mp3s live in /training.
   Filename format: ClientXX_word_c1_v1_c2_v2.mp3 (empty slot = omission).
   The app plays the stimulus as normal, then the client's recorded
   response; the trainee scores it and gets immediate feedback. */

const TRAINING_DIR = "training";
// The CVC recordings live here. Defined once at the top as CVC_SOUND_DIR (the
// folder that receives the CVC gain adjustment); this alias keeps the existing
// English-mode references reading naturally.
const ENGLISH_SOUND_DIR = CVC_SOUND_DIR;

// Literal on-disk CVC filenames, warmed when English mode is selected (see
// the preloading section). Cross-checked against the English lexicon stems.
const ENGLISH_PRELOAD_FILES = [
  "0101_Pass.mp3","0102_Rule.mp3","0103_Cause.mp3","0104_Time.mp3",
  "0105_Log.mp3","0106_Sick.mp3","0107_Mean.mp3","0108_Bed.mp3",
  "0109_Hope.mp3","0110_Date.mp3","0201_Hall.mp3","0202_Come.mp3",
  "0203_Bag.mp3","0204_Rose.mp3","0205_Suit.mp3","0206_Made.mp3",
  "0207_Like.mp3","0208_Peace.mp3","0209_Dip.mp3","0210_Ten.mp3",
  "0301_Pies.mp3","0302_Mock.mp3","0303_Room.mp3","0304_Dad.mp3",
  "0305_Loan.mp3","0306_Beg.mp3","0307_Tell.mp3","0308_Keep.mp3",
  "0309_Hiss.mp3","0310_Sought.mp3","0401_Boss.mp3","0402_Sip.mp3",
  "0403_Pal.mp3","0404_Coat.mp3","0405_Rod.mp3","0406_Moon.mp3",
  "0407_Hem.mp3","0408_Take.mp3","0409_League.mp3","0410_Dies.mp3",
  "0501_Time.mp3","0502_Caught.mp3","0503_Beg.mp3","0504_Rid.mp3",
  "0505_Loon.mp3","0506_Mop.mp3","0507_Doze.mp3","0508_Says.mp3",
  "0509_Pack.mp3","0510_Heel.mp3","0601_Make.mp3","0602_Laws.mp3",
  "0603_Rice.mp3","0604_bell.mp3","0605_Tote.mp3","0606_Cod.mp3",
  "0607_Ham.mp3","0608_Deep.mp3","0609_Pig.mp3","0610_Soon.mp3",
  "0701_Seal.mp3","0702_Dawn.mp3","0703_Boom.mp3","0704_Hog.mp3",
  "0705_Toes.mp3","0706_Mid.mp3","0707_Cat.mp3","0708_Like.mp3",
  "0709_Pep.mp3","0710_Race.mp3","0801_Hide.mp3","0802_Tame.mp3",
  "0803_Rule.mp3","0804_Cause.mp3","0805_Big.mp3","0806_Sass.mp3",
  "0807_Pope.mp3","0808_Don.mp3","0809_Meek.mp3","0810_Let.mp3",
  "0901_Call.mp3","0902_Buys.mp3","0903_Same.mp3","0904_Miss.mp3",
  "0905_Rot.mp3","0906_Hoop.mp3","0907_Load.mp3","0908_Peck.mp3",
  "0909_Tag.mp3","0910_Dean.mp3","1001_Lean.mp3","1002_Hag.mp3",
  "1003_Bed.mp3","1004_Sews.mp3","1005_Cop.mp3","1006_Root.mp3",
  "1007_Pick.mp3","1008_Maim.mp3","1009_Toss.mp3","1010_Dial.mp3",
  "1101_Lice.mp3","1102_Mall.mp3","1103_Tomb.mp3","1104_Bag.mp3",
  "1105_Soap.mp3","1106_Rake.mp3","1107_Pen.mp3","1108_Keys.mp3",
  "1109_Hid.mp3","1110_Dot.mp3","1201_Dike.mp3","1202_Ball.mp3",
  "1203_Mace.mp3","1204_Rig.mp3","1205_Lose.mp3","1206_Sop.mp3",
  "1207_Comb.mp3","1208_Ten.mp3","1209_Pad.mp3","1210_Heat.mp3",
  "Speech Lists - Millenium Edition-01-1 kHz tone_left.mp3","Speech Lists - Millenium Edition-01-1 kHz tone_right.mp3","Speech Lists - Millenium Edition-13-CVC Words List 12_right.mp3"
];
const ALL_WORDS = new Set(Object.values(MAORI_WORD_LISTS).flat().map(w => w[0]));

function trainingActive() { return !!state.training; }

function parseTrainingFilename(filename) {
  // ClientXX_word_s1_s2_s3_s4.mp3 → { word, response: [4] }; empty slot → "–"
  const stem = filename.replace(/\.mp3$/i, "").replace(/\.wav$/i, "");
  const parts = stem.split("_");
  if (parts.length !== 6) return null;
  const word = parts[1];
  if (!ALL_WORDS.has(word)) return null;
  const response = parts.slice(2, 6).map(s => (s === "" ? "–" : s));
  return { word, response };
}

async function loadTrainingClients() {
  // Probe training/Client01.json .. Client12.json; use whichever load.
  const found = [];
  for (let i = 1; i <= 12; i++) {
    const id = `Client${String(i).padStart(2, "0")}`;
    try {
      const resp = await fetch(`${TRAINING_DIR}/${id}.json`);
      if (!resp.ok) continue;
      const profile = await resp.json();
      if (profile && profile.id) found.push(profile);
    } catch {}
  }
  return found;
}

async function openTrainingPicker() {
  const sel = $("trainingClientSelect");
  const btn = $("trainingBtn");
  btn.disabled = true;
  btn.textContent = "Loading clients…";
  const profiles = await loadTrainingClients();
  btn.disabled = false;
  btn.textContent = "🎓 Train scoring";
  if (!profiles.length) {
    alert(`No training clients found.\nAdd ClientXX.json profiles and response mp3s to the /${TRAINING_DIR} folder.`);
    return;
  }
  sel.innerHTML = `<option value="">Choose a training client…</option>`;
  for (const p of profiles) {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = `${p.id} — ${p.name || "unnamed"}${p.iwi ? " (" + p.iwi + ")" : ""}`;
    opt._profile = p;
    sel.appendChild(opt);
  }
  sel.hidden = false;
  btn.hidden = true;
  sel.onchange = () => {
    const opt = sel.options[sel.selectedIndex];
    if (opt && opt._profile) activateTrainingClient(opt._profile);
  };
}

function activateTrainingClient(profile) {
  // Index response files by word; warn on unparseable names.
  const responsesByWord = {};
  for (const f of profile.files || []) {
    const parsed = parseTrainingFilename(f);
    if (!parsed) { console.warn("Training file not parseable, skipped:", f); continue; }
    (responsesByWord[parsed.word] = responsesByWord[parsed.word] || []).push({
      filename: f, response: parsed.response
    });
  }

  state.training = {
    id: profile.id,
    name: profile.name || profile.id,
    age: profile.age ?? "",
    iwi: profile.iwi || "",
    notes: profile.notes || "",
    dialectSubstitutions: profile.dialectSubstitutions || {},
    responsesByWord
  };

  // Populate client fields — notes prime the trainee with iwi + variants
  $("clientName").value = `${state.training.name} (TRAINING)`;
  $("clientId").value = profile.id;
  const dialectNotes = Object.entries(state.training.dialectSubstitutions)
    .map(([t, d]) => d.message || `May use /${d.substitute}/ for /${t}/`)
    .join(" ");
  $("sessionNotes").value =
    `TRAINING CLIENT — ${state.training.name}, age ${state.training.age}` +
    (state.training.iwi ? `, iwi: ${state.training.iwi}` : "") +
    `. ${state.training.notes}` +
    (dialectNotes ? ` ${dialectNotes}` : "");

  updateTrainingBadge();
  updateClearClientBtn();
  saveSession();
}

function exitTraining() {
  state.training = null;
  $("clientName").value = "";
  $("clientId").value = "";
  $("sessionNotes").value = "";
  $("trainingClientSelect").hidden = true;
  $("trainingClientSelect").value = "";
  $("trainingBtn").hidden = false;
  updateTrainingBadge();
  updateClearClientBtn();
  saveSession();
}

function updateTrainingBadge() {
  const badge = $("trainingBadge");
  const exitBtn = $("exitTrainingBtn");
  const sel = $("trainingClientSelect");
  const btn = $("trainingBtn");
  if (!badge) return;
  if (trainingActive()) {
    badge.textContent = `🎓 Training: ${state.training.name} (${state.training.id})`;
    badge.hidden = false;
    exitBtn.hidden = false;
    sel.hidden = true;
    btn.hidden = true;
  } else {
    badge.hidden = true;
    exitBtn.hidden = true;
    btn.hidden = false;
  }
}

/* ── Mita / dialect substitutions ───────────────────────────────
   Session-level client substitutions keyed by target phoneme, e.g.
   { "ŋ": ["k"], "f": ["w","h"] }. Selected substitutes score as correct
   wherever the target occurs (see substitutesForTarget / equivalentForScoring).
   When a training client is loaded the dialog is read-only and reflects the
   loaded profile instead. */

const MITA_NOTE_PREFIX = "Mita/dialect:";

// Flatten a substitution map ({ target: [subs] } or legacy
// { target: {substitute} }) into an array of {target, sub} pairs.
function mitaPairsFromMap(map) {
  const pairs = [];
  for (const [target, val] of Object.entries(map || {})) {
    if (Array.isArray(val)) val.forEach(sub => pairs.push({ target, sub }));
    else if (val && val.substitute) pairs.push({ target, sub: val.substitute });
  }
  return pairs;
}

function mitaActiveMap() {
  // Source of truth for the dialog: training profile (read-only) or session.
  if (trainingActive()) return state.training.dialectSubstitutions || {};
  return state.dialectSubstitutions || {};
}

function openMitaDialog() {
  const dlg = $("mitaDialog");
  if (!dlg) return;
  const readOnly = trainingActive();
  const card = dlg.querySelector(".dialog-card");
  if (card) card.classList.toggle("readonly", readOnly);

  const activePairs = mitaPairsFromMap(mitaActiveMap());
  const isActive = (t, s) => activePairs.some(p => p.target === t && p.sub === s);

  dlg.querySelectorAll(".mita-toggle").forEach(btn => {
    const t = btn.dataset.target, s = btn.dataset.sub;
    btn.classList.toggle("active", isActive(t, s));
    btn.onclick = readOnly ? null : () => btn.classList.toggle("active");
  });

  $("mitaTitle").textContent = readOnly
    ? `Mita / dialect — ${state.training.name}`
    : "Mita / dialect substitutions";
  $("mitaIntro").textContent = readOnly
    ? "From this training client's case history. Shown for reference; these score as correct wherever the target phoneme occurs."
    : "Select the realisations this client uses. Selected substitutions score as correct wherever the target phoneme occurs.";
  $("mitaSaveBtn").style.display = readOnly ? "none" : "";
  $("mitaCancelBtn").textContent = readOnly ? "Close" : "Cancel";

  dlg.showModal();
}

function saveMitaDialog() {
  if (trainingActive()) { $("mitaDialog").close(); return; }
  const map = {};
  $("mitaDialog").querySelectorAll(".mita-toggle.active").forEach(btn => {
    const t = btn.dataset.target, s = btn.dataset.sub;
    (map[t] = map[t] || []).push(s);
  });
  state.dialectSubstitutions = map;
  applyMitaToNotes();
  saveSession();
  $("mitaDialog").close();
}

// Compose a human-readable substitution line, e.g.
// "Mita/dialect: /ŋ/→/k/, /f/→/w/".
function mitaNoteLine() {
  const pairs = mitaPairsFromMap(state.dialectSubstitutions);
  if (!pairs.length) return "";
  const bits = pairs.map(p => `/${p.target}/→/${p.sub}/`);
  return `${MITA_NOTE_PREFIX} ${bits.join(", ")}`;
}

// Prepend (idempotently) the substitution line to the notes field. Any
// existing Mita/dialect line is stripped first so re-saving updates cleanly.
function applyMitaToNotes() {
  const ta = $("sessionNotes");
  if (!ta) return;
  const existing = ta.value
    .split("\n")
    .filter(l => !l.trim().startsWith(MITA_NOTE_PREFIX))
    .join("\n")
    .replace(/^\n+/, "");
  const line = mitaNoteLine();
  ta.value = line ? (existing ? `${line}\n${existing}` : line) : existing;
}

function clearClient() {
  const hasAny =
    ($("clientName") && $("clientName").value.trim()) ||
    ($("clientId") && $("clientId").value.trim()) ||
    ($("clientDob") && $("clientDob").value);
  if (!hasAny) return;
  if (!confirm("Clear the client name, identifier and date of birth? This can't be undone.")) return;
  if ($("clientName")) $("clientName").value = "";
  if ($("clientId")) $("clientId").value = "";
  if ($("clientDob")) $("clientDob").value = "";
  state.client = { ...state.client, name: "", id: "", dob: "" };
  // The mita/dialect substitutions belong to the client, so clear them too.
  state.dialectSubstitutions = {};
  applyMitaToNotes();
  saveSession();
  renderRecentSessions();
  updateClearClientBtn();
}

function updateClearClientBtn() {
  const btn = $("clearClientBtn");
  if (!btn) return;
  const hasAny =
    ($("clientName") && $("clientName").value.trim()) ||
    ($("clientId") && $("clientId").value.trim()) ||
    ($("clientDob") && $("clientDob").value);
  btn.disabled = !hasAny;
}

// Return the list of accepted substitute phonemes for a target, drawn from
// (a) the session-level client substitutions and (b) a loaded training
// profile. Handles both data shapes: session uses { target: [subs...] };
// legacy training profiles use { target: { substitute, message } }.
function substitutesForTarget(target) {
  const out = new Set();

  const session = state.dialectSubstitutions?.[target];
  if (Array.isArray(session)) session.forEach(s => out.add(s));

  if (trainingActive()) {
    const prof = state.training.dialectSubstitutions?.[target];
    if (Array.isArray(prof)) prof.forEach(s => out.add(s));
    else if (prof && prof.substitute) out.add(prof.substitute);
  }
  return [...out];
}

// Dialect-aware equivalence: a substitution listed for the client (either
// entered manually via the Mita dialog or carried by a training profile)
// is correct wherever it occurs.
function equivalentForScoring(target, response) {
  if (equivalent(target, response)) return true;
  if (!response || response === "–") return false;
  return substitutesForTarget(target).includes(response);
}

function ensureTrialTrainingVariant(trial) {
  // Pick one response variant at random per trial; keep it so replays
  // and rescoring use the same recording.
  if (!trainingActive() || !trial || trial.trainingFile !== undefined) return;
  const variants = state.training.responsesByWord[trial.word[0]] || [];
  if (!variants.length) {
    trial.trainingFile = null; // explicitly: no recording for this kupu
    trial.trainingResponse = null;
    return;
  }
  const v = variants[Math.floor(Math.random() * variants.length)];
  trial.trainingFile = v.filename;
  trial.trainingResponse = v.response;
  trial.trainingAttempts = 0;
}

// Play just the target kupu, without chaining the training response
// (used by the feedback dialog so kupu and response can be compared).
async function playKupuOnly() {
  const trial = currentTrial();
  const q = currentQueueItem();
  if (!trial || !q) return;
  stopCurrentStimulusIfAny();
  try {
    await playFirstAvailable([trial.word[0]], $("stimEar").value, q.levelDbA, false);
  } catch {
    console.warn("Could not play kupu:", trial.word[0]);
  }
}

async function playClientResponse() {
  const trial = currentTrial();
  if (!trainingActive() || !trial || !trial.trainingFile) return;
  // Play the response binaurally at a clear, comfortable level: aim for
  // 65 dB(A) when calibrated, but hold it inside the presentation range so a
  // high dial setting doesn't push it below the usable floor. Unity when not.
  const level = state.calibration.isCalibrated
    ? clampLevel(65)
    : 0;
  try {
    const node = await playFirstAvailable([`${TRAINING_DIR}/${trial.trainingFile}`], "binaural", level, false);
    setStimulusIndicator(true, "Client response");
    node.el.addEventListener("ended", () => {
      if (!state.audio.activeStimuli.length) setStimulusIndicator(false);
    }, { once: true });
  } catch {
    console.warn("Could not play training response:", trial.trainingFile);
  }
}

// Per-position truth: how each response phoneme scores against the target.
function evaluateTrainingPositions(targets, response) {
  return targets.map((t, i) => {
    const r = response[i];
    if (!r || r === "–") return { target: t, response: r || "–", correct: false, type: "omission" };
    if (t === r) return { target: t, response: r, correct: true, type: "exact" };
    if (equivalent(t, r)) return { target: t, response: r, correct: true, type: "length" };
    if (substitutesForTarget(t).includes(r)) {
      const prof = state.training?.dialectSubstitutions?.[t];
      const message = (prof && !Array.isArray(prof) && prof.message)
        ? prof.message
        : `/${r}/ for /${t}/ is a listed dialect variant for this client.`;
      return { target: t, response: r, correct: true, type: "dialect", message };
    }
    return { target: t, response: r, correct: false, type: "substitution" };
  });
}

function describePosition(pos, idx) {
  const n = idx + 1;
  switch (pos.type) {
    case "exact":
      return `<div class="tf-row ok"><span class="tf-phon">${n}: /${pos.target}/</span><span>Correct.</span></div>`;
    case "length":
      return `<div class="tf-row ok"><span class="tf-phon">${n}: /${pos.target}/</span><span>The client said /${pos.response}/ — vowel-length differences are subtle and not penalised. Scores correct.</span></div>`;
    case "dialect":
      return `<div class="tf-row note"><span class="tf-phon">${n}: /${pos.target}/</span><span class="tf-teach">The client said /${pos.response}/. ${pos.message || "This is a valid regional variant."} Scores correct.</span></div>`;
    case "omission":
      return `<div class="tf-row bad"><span class="tf-phon">${n}: /${pos.target}/</span><span>The client omitted this sound — scores incorrect.</span></div>`;
    default:
      return `<div class="tf-row bad"><span class="tf-phon">${n}: /${pos.target}/</span><span>The client said /${pos.response}/ — a substitution, scores incorrect.</span></div>`;
  }
}

function handleTrainingNext() {
  const trial = currentTrial();
  if (!trial) return;

  // No recording for this kupu → behave like a normal trial.
  if (!trial.trainingFile) { advanceTrainingTrial(); return; }

  if (state.scoringMode === "none") {
    showTrainingFeedback("Score first", `<p>Listen to the client's response and enter a score before continuing.</p>`, { listen: true });
    return;
  }

  const targets = wordPhonemes(trial.word);
  const total = phonemeCount();
  const positions = evaluateTrainingPositions(targets, trial.trainingResponse);
  const trueScore = positions.filter(p => p.correct).length;
  trial.trainingTrueScore = trueScore;
  const traineeScore = computeCurrentScore();

  // Per-position comparison when phoneme/advanced scoring was used.
  let positionsMatch = true;
  if (state.scoringMode !== "fast") {
    positions.forEach((pos, i) => {
      const transcribed = state.responseSelections[i];
      const judged = (transcribed !== null && transcribed !== undefined && transcribed !== "")
        ? equivalentForScoring(targets[i], transcribed)
        : !!state.targetSelections[i];
      if (judged !== pos.correct) positionsMatch = false;
    });
  }
  const match = (traineeScore === trueScore) && positionsMatch;

  if (match) {
    trial.trainingMatched = true;
    if (trueScore === total) {
      showTrainingFeedback("✓ Correct", `<p class="tf-summary">All ${total} phonemes correct — ${trueScore}/${total}.</p>`, { continue: true });
    } else {
      const detail = positions.map(describePosition).join("");
      showTrainingFeedback(`✓ Correct — ${trueScore}/${total}`,
        `<p class="tf-summary">You scored this correctly.</p>${detail}`, { continue: true });
    }
  } else {
    trial.trainingAttempts = (trial.trainingAttempts || 0) + 1;

    // Per-position: where did the TRAINEE disagree with the truth?
    // Only meaningful when they made per-position judgements. fastScore()
    // blanks targetSelections/responseSelections, so reading them here would
    // report "you marked this incorrect" for every position the client got
    // RIGHT and stay silent about the one they got wrong.
    const traineeMismatches = [];
    if (state.scoringMode !== "fast") {
      positions.forEach((pos, i) => {
        const transcribed = state.responseSelections[i];
        const judgedCorrect =
          (transcribed !== null && transcribed !== undefined && transcribed !== "")
            ? equivalentForScoring(targets[i], transcribed)
            : !!state.targetSelections[i];
        if (judgedCorrect !== pos.correct) {
          traineeMismatches.push({ pos, i, transcribed, judgedCorrect });
        }
      });
    }

    let body;
    if (traineeScore === trueScore) {
      // Total is right but the wrong positions are marked correct/incorrect
      body = `<p class="tf-summary">Your total of ${trueScore}/${total} is right, but you've marked the wrong phonemes as correct.</p>` +
             `<p>Listen again — which sounds did the client actually get right?</p>`;
    } else {
      body = `<p class="tf-summary">Not quite — you scored ${traineeScore}/${total}, the correct score is ${trueScore}/${total}.</p>`;
    }

    if (trial.trainingAttempts >= 2) {
      // Full reveal: show every position (truth-only, safe in any scoring mode)
      body += positions.map(describePosition).join("");
    } else if (state.scoringMode === "fast") {
      // No per-position judgements to compare against — don't invent any.
      body += `<p class="tf-hint">You scored this as a total, so there's nothing ` +
              `to compare position by position. Listen again — and if you're not ` +
              `sure which sound was missed, mark each phoneme individually.</p>`;
    } else {
      // First miss: point at the positions the trainee actually got wrong…
      traineeMismatches.forEach(({ pos, i, transcribed, judgedCorrect }) => {
        body += describeTraineeMismatch(pos, i, transcribed, judgedCorrect);
      });
      // …plus any teaching-moment positions the trainee happened to get right
      positions.forEach((pos, i) => {
        if ((pos.type === "dialect" || pos.type === "length") &&
            !traineeMismatches.some(m => m.i === i)) {
          body += describePosition(pos, i);
        }
      });
    }
    showTrainingFeedback("Have another listen", body, { listen: true, reveal: trial.trainingAttempts >= 2 });
  }
}

// Frame a per-position note from the TRAINEE's perspective: what they marked
// versus the truth. Used on a first miss so the feedback points at the
// position the trainee actually got wrong, not just teaching moments.
function describeTraineeMismatch(pos, idx, transcribed, judgedCorrect) {
  const n = idx + 1;
  const heard = (transcribed && transcribed !== "–") ? transcribed : null;
  if (judgedCorrect && !pos.correct) {
    // Trainee accepted it; truth says wrong
    return `<div class="tf-row bad"><span class="tf-phon">${n}: /${pos.target}/</span>` +
      `<span>You marked this correct, but the client ${pos.type === "omission"
        ? "omitted this sound" : `said /${pos.response}/`} — it scores incorrect.</span></div>`;
  }
  // Trainee rejected it; truth says correct
  let why;
  if (pos.type === "dialect") why = pos.message || "this is a valid regional variant.";
  else if (pos.type === "length") why = "vowel-length differences aren't penalised.";
  else why = "the client did say the target sound here.";
  return `<div class="tf-row bad"><span class="tf-phon">${n}: /${pos.target}/</span>` +
    `<span>You marked this incorrect${heard ? ` (you heard /${heard}/)` : ""}, but it scores correct — ${why}</span></div>`;
}

function showTrainingFeedback(title, bodyHtml, opts = {}) {
  const dlg = $("trainingFeedbackDialog");
  if (!dlg) return;
  $("tfTitle").textContent = title;
  $("tfBody").innerHTML = bodyHtml;
  // Record which variant played, so a student's bug report can be traced to a
  // recording (ensureTrialTrainingVariant picks among a word's files at random).
  const trial = currentTrial();
  if (trial && trial.trainingFile) $("tfBody").dataset.file = trial.trainingFile;
  else delete $("tfBody").dataset.file;
  $("tfPlayKupuBtn").hidden = !opts.listen;
  $("tfPlayResponseBtn").hidden = !opts.listen;
  $("tfContinueBtn").hidden = !opts.continue;
  $("tfRevealBtn").hidden = !opts.reveal;
  $("tfCloseBtn").hidden = !!opts.continue; // when correct, Continue is the only exit
  dlg.showModal();
}

function advanceTrainingTrial() {
  state._trainingBypass = true;
  try { nextTrial(); } finally { state._trainingBypass = false; }
}

function bindEvents() {
  // Training mode
  if ($("trainingBtn")) $("trainingBtn").onclick = openTrainingPicker;
  if ($("exitTrainingBtn")) $("exitTrainingBtn").onclick = exitTraining;
  if ($("clearClientBtn")) $("clearClientBtn").onclick = clearClient;
  if ($("mitaBtn")) $("mitaBtn").onclick = openMitaDialog;
  if ($("mitaSaveBtn")) $("mitaSaveBtn").onclick = saveMitaDialog;
  ["clientName","clientId","clientDob"].forEach(id => {
    const el = $(id);
    if (el) el.addEventListener("input", updateClearClientBtn);
  });
  if ($("replayResponseBtn")) $("replayResponseBtn").onclick = () => { stopCurrentStimulusIfAny(); playClientResponse(); };
  if ($("tfPlayKupuBtn")) $("tfPlayKupuBtn").onclick = () => playKupuOnly();
  if ($("tfPlayResponseBtn")) $("tfPlayResponseBtn").onclick = () => { stopCurrentStimulusIfAny(); playClientResponse(); };
  if ($("tfContinueBtn")) $("tfContinueBtn").onclick = () => {
    $("trainingFeedbackDialog").close();
    advanceTrainingTrial();
  };
  if ($("tfRevealBtn")) $("tfRevealBtn").onclick = () => {
    // Accept the true score and move on (logged with attempts count)
    const trial = currentTrial();
    if (trial && Number.isFinite(trial.trainingTrueScore)) {
      trial.trainingRevealed = true;
      state.scoringMode = "fast";
      state.trialScore = trial.trainingTrueScore;
      markScoreButton();
    }
    $("trainingFeedbackDialog").close();
    advanceTrainingTrial();
  };

  // Calibration
  $("calibrateBtn").onclick = openCalibrationDialog;
  if ($("calMethodSelect")) $("calMethodSelect").onchange = () => {
    // Switching method changes which signal calibration uses (tone vs noise), so
    // stop anything playing and relabel — otherwise the button could claim to be
    // playing a tone while noise is still running from the previous method.
    stopCalibrationSound();
    if ($("calPlayBtn")) {
      $("calPlayBtn").textContent = calPlayLabel(false);
      $("calPlayBtn").classList.remove("active");
    }
    $("calDialogStatus").textContent = "";
    renderCalMethodUI();
  };
  if ($("calPlayBtn")) $("calPlayBtn").onclick = toggleCalibrationNoise;
  if ($("calEarSelect")) $("calEarSelect").onchange = (e) => setCalibrationEar(e.target.value);
  if ($("calSaveBtn")) $("calSaveBtn").onclick = saveCalibrationDialog;
  // Catches Cancel, Esc and Save alike — the signal must never outlive the dialog.
  if ($("calibrationDialog")) $("calibrationDialog").addEventListener("close", () => {
    stopCalibrationSound();
    if ($("calPlayBtn")) {
      $("calPlayBtn").textContent = calPlayLabel(false);
      $("calPlayBtn").classList.remove("active");
    }
  });
  $("testCalBtn").onclick = testCalibratedSound;
  // CVC file gain adjustment (guarded by a confirmation inside the handler).
  if ($("cvcGainApplyBtn")) $("cvcGainApplyBtn").onclick = () => {
    requestCvcGainChange($("cvcGainInput") ? $("cvcGainInput").value : DEFAULT_CVC_FILE_GAIN_DB);
  };
  if ($("cvcGainResetBtn")) $("cvcGainResetBtn").onclick = resetCvcGainSetting;
  if ($("preloadAllBtn")) $("preloadAllBtn").onclick = preloadEverything;
  $("outputLevel").addEventListener("input", updateOutputLevelFromSlider);
  $("outputLevel").addEventListener("change", updateOutputLevelFromSlider);
  $("outputLevel").addEventListener("touchend", updateOutputLevelFromSlider);

  // Clinic settings — save on change
  ["clinicName","facilityName","clinician","clinicianRole","transducer"].forEach(id => {
    const el = $(id);
    if (el) el.addEventListener("change", saveClinicSettings);
  });

  // Logo upload
  if ($("replaceLogoBtn")) $("replaceLogoBtn").onclick = () => $("logoFileInput").click();
  if ($("logoFileInput")) $("logoFileInput").onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { renderLogoPreview(ev.target.result); saveClinicSettings(); };
    reader.readAsDataURL(file);
  };
  if ($("removeLogoBtn")) $("removeLogoBtn").onclick = () => { renderLogoPreview(null); saveClinicSettings(); };

  // Stimulus routing
  $("stimEar").onchange = () => {
    const ear = $("stimEar").value;
    if ($("maskingEnabled") && $("maskingEnabled").value === "off") {
      $("maskEar").value = "off";
    } else {
      if (ear === "left") $("maskEar").value = "right";
      if (ear === "right") $("maskEar").value = "left";
      if (ear === "binaural") $("maskEar").value = "binaural";
    }
    syncMaskerControls();
  };

  $("maskLevel").addEventListener("input", () => {
    $("maskLevel").value = clampLevel($("maskLevel").value);
    $("maskLevelLive").value = $("maskLevel").value;
    updateLiveMasker();
  });
  $("maskEar").addEventListener("change", () => {
    $("maskEarLive").value = $("maskEar").value;
    updateLiveMasker();
  });
  $("maskLevelLive").addEventListener("input", () => {
    $("maskLevelLive").value = clampLevel($("maskLevelLive").value);
    $("maskLevel").value = $("maskLevelLive").value;
    updateLiveMasker();
  });
  $("maskEarLive").addEventListener("change", () => {
    $("maskEar").value = $("maskEarLive").value;
    updateLiveMasker();
  });

  // Queue
  $("addListBtn").onclick = () => addList(Number($("listChoice").value), clampLevel($("listLevel").value));
  $("addRandomBtn").onclick = () => addRandomList(clampLevel($("listLevel").value));
  $("addNRandomBtn").onclick = addNRandomLists;
  $("startBtn").onclick = startTesting;

  if ($("addQueueBtn")) $("addQueueBtn").onclick = () => openQueueDialog(null);
  if ($("queueSaveBtn")) $("queueSaveBtn").onclick = saveQueueDialog;
  if ($("queueDeleteBtn")) $("queueDeleteBtn").onclick = deleteQueueDialog;
  if ($("presentationCondition")) $("presentationCondition").onchange = updatePresentationConditionRouting;
  if ($("maskingEnabled")) $("maskingEnabled").onchange = updateMaskingEnabled;
  if ($("conditionSaveBtn")) $("conditionSaveBtn").onclick = saveConditionDialog;
  if ($("trialEditSaveBtn")) $("trialEditSaveBtn").onclick = saveTrialEditDialog;

  // Language selector
  document.querySelectorAll(".language-btn:not([data-mode])").forEach(btn => {
    btn.onclick = () => setLanguage(btn.dataset.lang);
  });

  // Adaptive mode
  bindAdaptiveEvents();

  // Word-order randomise override (per current language)
  if ($("randomiseOrderToggle")) {
    $("randomiseOrderToggle").onchange = (e) => {
      if (!state.randomiseOverride) state.randomiseOverride = { maori: null, english: null };
      state.randomiseOverride[state.language] = e.target.checked;
      applyLanguageToUI();
      saveSession();
    };
  }

  // Test screen
  $("playWordBtn").onclick = () => playCurrent(true);
  $("repeatWordBtn").onclick = () => playCurrent(false);
  $("toggleMaskBtn").onclick = toggleMasker;

  setupFastScoreButtons();
  $("clearScoreBtn").onclick = () => { cancelPendingAdvance(); clearScoring(); };
  $("nextTrialBtn").onclick = () => { cancelPendingAdvance(); nextTrial(); };
  $("abandonBtn").onclick = () => $("abandonDialog").showModal();
  $("confirmAbandonBtn").onclick = abandonList;

  $("downloadJsonBtn").onclick = downloadJson;
  if ($("emailAnonBtn")) $("emailAnonBtn").onclick = exportAnonymisedResults;
  if ($("convertBackupBtn")) $("convertBackupBtn").onclick = openConvertBackup;
  $("downloadTsvBtn").onclick = downloadTsv;
  if ($("copyTsvBtn")) $("copyTsvBtn").onclick = copyTsv;
  $("reportBtn").onclick = showReport;
  $("backToTestBtn").onclick = () => show(state._reportCalledFrom || "screen-setup");
  $("printBtn").onclick = () => window.print();

  // Setup page results panel
  if ($("setupReportBtn"))       $("setupReportBtn").onclick = showReport;
  if ($("setupDownloadJsonBtn")) $("setupDownloadJsonBtn").onclick = downloadJson;
  if ($("setupDownloadTsvBtn"))  $("setupDownloadTsvBtn").onclick = downloadTsv;
  if ($("setupCopyTsvBtn"))      $("setupCopyTsvBtn").onclick = copyTsv;
  if ($("openJsonBtn"))          $("openJsonBtn").onclick = () => $("openJsonFileInput").click();
  if ($("openJsonFileInput"))    $("openJsonFileInput").onchange = openSavedJson;

  $("levelDownBtn").onclick = () => nudgeLevel(-5);
  $("levelUpBtn").onclick   = () => nudgeLevel(+5);

  document.addEventListener("keydown", (e) => {
    if (!$("screen-test").classList.contains("active")) return;
    if (document.querySelector("dialog[open]")) return; // don't score/play behind dialogs
    const tag = document.activeElement.tagName;
    const inInput = ["INPUT","TEXTAREA","SELECT"].includes(tag);

    // 0–N: fast score + auto-advance (600ms window for nav click interception)
    if (/^[0-9]$/.test(e.key) && Number(e.key) <= phonemeCount() && !inInput) {
      e.preventDefault();
      fastScore(Number(e.key));
      return;
    }

    // Space: play carrier + kupu
    if (e.code === "Space" && !inInput) {
      e.preventDefault();
      playCurrent(true);
      return;
    }

    // R: replay kupu only
    if ((e.key === "r" || e.key === "R") && !inInput) {
      e.preventDefault();
      playCurrent(false);
      return;
    }

    // ←/→: stimulus level ±5
    if (e.key === "ArrowLeft" && !inInput)  { e.preventDefault(); nudgeLevel(-5); return; }
    if (e.key === "ArrowRight" && !inInput) { e.preventDefault(); nudgeLevel(+5); return; }

    // ↑/↓: masker level ±5
    if (e.key === "ArrowUp" && !inInput) {
      e.preventDefault();
      nudgeMasker(+5);
      return;
    }
    if (e.key === "ArrowDown" && !inInput) {
      e.preventDefault();
      nudgeMasker(-5);
      return;
    }

    // Shift+M: toggle masker
    if (e.key === "M" && e.shiftKey && !inInput) {
      e.preventDefault();
      toggleMasker();
      return;
    }

    // Enter: next (kept for backwards compat)
    if (e.key === "Enter" && !inInput) nextTrial();

    // Escape: abandon dialog
    if (e.key === "Escape") $("abandonDialog").showModal();
  });
}


// The kupu, carriers, masker and calibration noise are all 48 kHz mp3. The
// AudioContext must run at the same rate: when context and media agree, no
// resampling happens on the media-element path — which is where iOS Safari
// otherwise gets the ratio wrong.
const ASSET_SAMPLE_RATE = 48000;

function ensureAudio() {
  if (!state.audio.ctx) {
    // On iOS the audio-session category IN FORCE AT CONSTRUCTION decides the
    // hardware rate: if it isn't "playback" when the context is built, iOS hands
    // out a 24 kHz context and every 48 kHz asset plays at half speed (ratio
    // exactly 2 — the tell-tale signature), with wrong level and spectrum. This
    // must be set BEFORE the constructor runs, not after.
    try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch {}
    const Ctor = window.AudioContext || window.webkitAudioContext;
    // Ask for the asset rate. If the browser refuses the hint we still get a
    // context; either way the rate is checked below so a mismatch surfaces in
    // the console rather than as "it sounded a bit off / the level looked wrong".
    try { state.audio.ctx = new Ctor({ sampleRate: ASSET_SAMPLE_RATE }); }
    catch { state.audio.ctx = new Ctor(); }

    const rate = state.audio.ctx.sampleRate;
    if (rate !== ASSET_SAMPLE_RATE) {
      const ratio = ASSET_SAMPLE_RATE / rate;
      const halfSpeed = Math.abs(ratio - 2) < 0.01;
      console.warn(
        `[audio] AudioContext is ${rate} Hz but assets are ${ASSET_SAMPLE_RATE} Hz — RATE MISMATCH.` +
        (halfSpeed
          ? " Exactly half: this is the iOS 50%-speed signature (a 24 kHz context " +
            "handed out because the audio session was not 'playback' at construction). " +
            "Playback will be slow AND the presented level will be wrong — do not " +
            "calibrate or test in this state."
          : " If playback sounds slow or fast, or the level looks off, this is why.")
      );
      state.audio.rateMismatch = { contextRate: rate, assetRate: ASSET_SAMPLE_RATE, ratio };
      renderRateWarning();
    } else {
      state.audio.rateMismatch = null;
      console.log(`[audio] AudioContext ${rate} Hz (matches assets)`);
    }
  }
  // iOS suspends AudioContext until a user gesture — resume on every call
  if (state.audio.ctx.state === "suspended") {
    state.audio.ctx.resume().catch(() => {});
  }
  return state.audio.ctx;
}

// Surface a rate mismatch in the UI, not just the console — a clinician cannot
// be expected to have devtools open, and calibrating at the wrong rate produces
// a silently wrong reference. Paints into #calStatus / #calDialogStatus if
// present; harmless if neither exists.
function renderRateWarning() {
  const m = state.audio.rateMismatch;
  if (!m) return;
  const msg = `⚠ Audio is running at ${m.contextRate} Hz but the recordings are ` +
    `${m.assetRate} Hz. ` +
    (Math.abs(m.ratio - 2) < 0.01
      ? "This halves playback speed and makes the level wrong. Close the app fully " +
        "and reopen it (on iPhone/iPad, swipe it away from the app switcher first); "
      : "Playback speed and level may be wrong; try reopening the app; ") +
    "do not rely on calibration until this clears.";
  const dlg = $("calDialogStatus");
  if (dlg) dlg.textContent = msg;
  const cal = $("calStatus");
  if (cal) cal.textContent = msg;
}

function soundKey(filename) {
  // Strip path and extension to get the word/stem. The trailing-dB strip is a
  // no-op on the current clean filenames (kept so legacy "_+1.6dB.wav" names,
  // if any linger, still resolve). Underscores inside a name are preserved,
  // e.g. kōrero_mai_01.
  return filename
    .replace(/^.*\//, "")
    .replace(/\.(mp3|wav)$/i, "")
    .replace(/_[+-]?\d+(?:\.\d+)?dB$/i, "");
}

function fileForWord(word) {
  const exact = KNOWN_SOUND_FILES.find(f => soundKey(f) === word);
  if (exact) return `sounds/${exact}`;
  return `sounds/${word}.mp3`;
}

function candidatesForBase(base) {
  // Māori bases are the word/known stem. Try the known file first, then a bare
  // .mp3 (the current format), then .wav as a legacy fallback.
  const known = KNOWN_SOUND_FILES.filter(f => soundKey(f) === base).map(f => `sounds/${f}`);
  return [...known, `sounds/${base}.mp3`, `sounds/${base}.wav`];
}

// English stems are NNNN_Word (e.g. "0301_Pies"). The recordings are all .mp3,
// but the word part is inconsistently cased across files (e.g. "0604_bell.mp3"
// vs "0301_Pies.mp3"). To be robust on a case-sensitive host we try, in order:
// the stem exactly as listed, then a Capitalised-word variant, then an
// all-lowercase-word variant — deduped. Order = preference.
function englishCandidates(stem) {
  const m = /^(\d{4})_(.+)$/.exec(stem);
  const stems = [stem];
  if (m) {
    const num = m[1], wRaw = m[2];
    const cap = wRaw.charAt(0).toUpperCase() + wRaw.slice(1).toLowerCase();
    const lower = wRaw.toLowerCase();
    for (const variant of [`${num}_${cap}`, `${num}_${lower}`]) {
      if (!stems.includes(variant)) stems.push(variant);
    }
  }
  return stems.map(s => `${ENGLISH_SOUND_DIR}/${s}.mp3`);
}

/* ── Asset preloading ────────────────────────────────────────────────────
   Warms the HTTP cache so the first presentation of a sound doesn't stall on a
   download. Two batches, warmed at different times because they matter at
   different times:

   • "maori"   — the ~2 MB kupu set plus the eleven kōrero-mai carriers and the
                 masker. Warmed eagerly on idle at startup. The carrier is chosen
                 at random per kupu, so any of the eleven can be the very first
                 sound a client hears; there's no way to know which to warm, so
                 all of them go early. This is also the app's default mode.

   • "english" — the ~10 MB CVC set. Warmed only when English mode is selected,
                 not at startup: most sessions are te reo, English presents its
                 words in fixed list order with the carrier embedded (so there's
                 no "any file could be first" problem), and mode-selection gives
                 ample lead time before the first word. Eagerly warming 10 MB on
                 every load would tax metered tablet connections and delay the
                 small Māori warm for the majority who never leave te reo.

   A manual "prepare for offline" action warms both regardless, for a clinic
   about to lose connectivity.

   Modelled on the UC KTT preloader: it deliberately does NOT decode audio.
   Playback here is via HTMLAudioElement (createMediaElementSource), and the app
   probes each file with a HEAD request before playing, so warming the browser's
   HTTP cache is exactly what makes first use instant. Web-Audio decodeAudioData
   is also unreliable on a still-suspended AudioContext (it only unlocks on a
   user gesture), so decoding stays lazy.

   Each item settles on load, error OR timeout, so one missing file costs a
   console warning rather than a hung preload. Failures are surfaced because a
   clinic needs to know an asset is missing before a client is in the booth. */
const PRELOAD_CONCURRENCY = 8;   // modest — this runs on tablets too
const PRELOAD_TIMEOUT_MS  = 10000;

// Māori audio, built from the list the app already ships (no separate manifest
// to keep in sync). Includes the eleven carriers and the masker (noise.mp3).
function maoriPreloadUrls() {
  return KNOWN_SOUND_FILES.map(f => `sounds/${encodeURI(f)}`);
}

// English CVC audio. These are literal on-disk filenames under ENGLISH_SOUND_DIR
// — cross-checked to match the lexicon stems exactly, so the warmed URL is the
// same one the play path requests. The final three are the tone/list-recording
// files; if they live somewhere other than ENGLISH_SOUND_DIR, adjust here.
function englishPreloadUrls() {
  return ENGLISH_PRELOAD_FILES.map(f => `${ENGLISH_SOUND_DIR}/${encodeURI(f)}`);
}

function warmOneAsset(url) {
  return new Promise(resolve => {
    let settled = false;
    const done = ok => { if (!settled) { settled = true; clearTimeout(timer); resolve(ok); } };
    const timer = setTimeout(() => { console.warn("[preload] timed out:", url); done(false); }, PRELOAD_TIMEOUT_MS);
    if (/\.(png|jpe?g|webp|gif|svg)$/i.test(url)) {
      const img = new Image();
      img.onload = () => done(true);
      img.onerror = () => { console.warn("[preload] image failed:", url); done(false); };
      img.src = url;
      if (img.decode) img.decode().then(() => done(true)).catch(() => {});
    } else {
      // Audio: warm the HTTP cache via a preloading <audio>. Any of these events
      // means the bytes are in cache; error/stalled still settles so we move on.
      const a = new Audio();
      a.preload = "auto";
      ["canplaythrough", "loadeddata", "loadedmetadata"].forEach(ev =>
        a.addEventListener(ev, () => done(true), { once: true }));
      a.addEventListener("error", () => { console.warn("[preload] sound failed:", url); done(false); }, { once: true });
      a.src = url;
      try { a.load(); } catch {}   // iOS needs the explicit kick
    }
  });
}

// Tracks which batches have run, so switching to English twice, or re-init,
// doesn't restart a completed or in-flight warm.
const _preloadState = { maori: "idle", english: "idle" };   // idle | running | done

async function warmUrls(urls, onProgress) {
  const list = Array.from(new Set(urls));
  const total = list.length;
  let done = 0, failed = 0;
  const failures = [];
  if (onProgress) onProgress({ phase: "start", total, done, failed });
  let i = 0;
  const worker = async () => {
    while (i < list.length) {
      const url = list[i++];
      const ok = await warmOneAsset(url);
      done++; if (!ok) { failed++; failures.push(url); }
      if (onProgress) onProgress({ phase: "progress", total, done, failed, current: url });
    }
  };
  const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
  const t0 = now();
  await Promise.all(Array.from({ length: Math.min(PRELOAD_CONCURRENCY, total) }, worker));
  const seconds = Number(((now() - t0) / 1000).toFixed(1));
  const result = { total, done, failed, failures, seconds, at: new Date().toISOString() };
  if (onProgress) onProgress({ phase: "done", ...result });
  return result;
}

// Warm one named batch, at most once. Returns the result, or null if it was
// already done/running.
async function preloadBatch(name, urls, onProgress) {
  if (_preloadState[name] !== "idle") return null;
  _preloadState[name] = "running";
  const label = name === "english" ? "English CVC" : "te reo";
  try {
    const r = await warmUrls(urls, onProgress);
    _preloadState[name] = "done";
    state.preload = { ...(state.preload || {}), [name]: r };
    if (r.failed) console.warn(`[preload] ${label}: ${r.failed}/${r.total} missing —`, r.failures.slice(0, 12));
    else console.log(`[preload] ${label}: ${r.done}/${r.total} warmed in ${r.seconds}s`);
    return r;
  } catch (e) {
    _preloadState[name] = "idle";   // allow a retry
    console.warn(`[preload] ${label} error:`, e);
    return null;
  }
}

// Māori batch: eager on idle at startup, never competing with first paint.
function startMaoriPreloadWhenIdle() {
  const urls = [...maoriPreloadUrls(), ...(state.clinicLogo ? [] : ["assets/UClogo.png"])];
  const go = () => preloadBatch("maori", urls, s => renderPreloadStatus("maori", s));
  if ("requestIdleCallback" in window) requestIdleCallback(go, { timeout: 4000 });
  else setTimeout(go, 2000);
}

// English batch: triggered by setLanguage("english"). Runs on idle too so it
// doesn't jank the mode-switch UI; the lead time to the first word is long.
function startEnglishPreloadIfNeeded() {
  if (_preloadState.english !== "idle") return;
  const go = () => preloadBatch("english", englishPreloadUrls(), s => renderPreloadStatus("english", s));
  if ("requestIdleCallback" in window) requestIdleCallback(go, { timeout: 4000 });
  else setTimeout(go, 500);
}

// Manual "prepare for offline": warm whatever hasn't been warmed yet, both
// batches, and report combined progress. Wired to #preloadAllBtn if present.
async function preloadEverything() {
  const btn = $("preloadAllBtn");
  if (btn) btn.disabled = true;
  const batches = [
    ["maori", [...maoriPreloadUrls(), ...(state.clinicLogo ? [] : ["assets/UClogo.png"])]],
    ["english", englishPreloadUrls()]
  ];
  for (const [name, urls] of batches) {
    // Re-warm even if "done" so an offline-bound clinic can confirm the cache;
    // temporarily reset the gate for this explicit action.
    if (_preloadState[name] === "done") _preloadState[name] = "idle";
    await preloadBatch(name, urls, s => renderPreloadStatus(name, s));
  }
  if (btn) btn.disabled = false;
}

// Optional status line — only paints if a #preloadStatus element exists.
function renderPreloadStatus(batch, s) {
  const el = $("preloadStatus");
  if (!el) return;
  const which = batch === "english" ? "English words" : "te reo sounds";
  if (s.phase === "done") {
    el.textContent = s.failed
      ? `${which}: ${s.total - s.failed}/${s.total} cached (${s.failed} missing — see console)`
      : `${which}: all ${s.total} cached for offline use`;
  } else if (s.phase === "progress" || s.phase === "start") {
    el.textContent = `Caching ${which}… ${s.done || 0}/${s.total}`;
  }
}

// Eleven carrier recordings of "kōrero mai"; one is chosen at random per kupu so
// the phrase doesn't become predictable over a list. Zero-padded to two digits
// to match the filenames (kōrero_mai_01 … kōrero_mai_11).
const KORERO_MAI_COUNT = 11;
function pickKoreroMai() {
  const n = 1 + Math.floor(Math.random() * KORERO_MAI_COUNT);
  return `kōrero_mai_${String(n).padStart(2, "0")}`;
}

// Route an input node to the left ear, right ear, or both, without the
// equal-power boost a StereoPannerNode applies. A mono source is up-mixed to
// dual-mono (identical L and R at unchanged level) so single-ear presentation of
// a mono file isn't silent; a stereo source passes through per channel at unity.
// The non-test ear is then multiplied by zero and the test ear passed through
// UNCHANGED — no panning, no summing, no downmix, no level compensation.
//
// This is the ONLY path to the destination for stimuli, masker, calibration
// noise and the test tone alike, so the calibration reference is measured on the
// identical graph the words play through and any channel-handling effect cancels
// out of the calibration rather than biasing it. (Matches the UC KTT router.)
// Returns a handle exposing `.setEar()` so live callers (masker) can re-route.
function makeEarRouter(ctx, inputNode, ear) {
  // Route to the test ear(s) by muting the non-test channel and passing the test
  // channel through UNCHANGED. No panning, no summing, no down-mixing, no level
  // compensation of any kind: the non-test ear is multiplied by zero and the test
  // ear is byte-for-byte the source channel.
  //
  // Channel handling: a mono source must be treated as dual-mono (identical L and
  // R) so that single-ear presentation of a mono file plays in the test ear at
  // the same level as a stereo file — never silent. A ChannelSplitterNode uses
  // "discrete" interpretation, under which a mono input would map to ch0=signal,
  // ch1=silence (silencing the right ear for mono files). So we first pass the
  // source through a GainNode explicitly configured for a "speakers" up-mix to
  // 2 channels: mono → duplicated into L and R at unchanged level, stereo → left
  // untouched. Then split, mute the non-test channel, pass the test channel
  // through unchanged, and merge back to stereo.
  const stereoize = ctx.createGain();
  stereoize.channelCount = 2;
  stereoize.channelCountMode = "explicit";
  stereoize.channelInterpretation = "speakers";
  inputNode.connect(stereoize);

  const splitter = ctx.createChannelSplitter(2);
  const leftGain = ctx.createGain();
  const rightGain = ctx.createGain();
  const merger = ctx.createChannelMerger(2);
  stereoize.connect(splitter);
  splitter.connect(leftGain, 0).connect(merger, 0, 0);
  splitter.connect(rightGain, 1).connect(merger, 0, 1);
  merger.connect(ctx.destination);

  const apply = (e) => {
    leftGain.gain.value  = (e === "left"  || e === "binaural") ? 1 : 0;
    rightGain.gain.value = (e === "right" || e === "binaural") ? 1 : 0;
  };
  apply(ear);

  // Shim so existing code that reads/writes `.pan.value` keeps working:
  // setting a value <0 => left, >0 => right, 0 => binaural.
  return {
    _apply: apply,
    setEar: apply,
    // Tear down the whole routing subgraph. MediaElement/BufferSource nodes and
    // their routers stay live (and keep summing into ctx.destination) until every
    // node in the chain is disconnected; over a long session that accumulation is
    // what degrades playback into stutter/drop-outs. Callers invoke this when a
    // stimulus ends or is stopped.
    disconnect() {
      try { inputNode.disconnect(stereoize); } catch {}
      try { stereoize.disconnect(); } catch {}
      try { splitter.disconnect(); } catch {}
      try { leftGain.disconnect(); } catch {}
      try { rightGain.disconnect(); } catch {}
      try { merger.disconnect(); } catch {}
    },
    get pan() {
      return {
        get value() {
          const l = leftGain.gain.value, r = rightGain.gain.value;
          return l && r ? 0 : l ? -1 : 1;
        },
        set value(v) { apply(v < 0 ? "left" : v > 0 ? "right" : "binaural"); }
      };
    }
  };
}

function createRoutedAudio(url, ear, levelDbA, loop=false) {
  const ctx = ensureAudio();
  const el = new Audio(url);
  el.loop = loop;
  el.preload = "auto";
  const source = ctx.createMediaElementSource(el);
  const gain = ctx.createGain();
  // The folder the file came from decides its gain adjustment: sounds_cvc/
  // assets are pulled down by the CVC file gain adjustment, everything else
  // by 0. Derived from the URL so words, carriers and the CVC tone are all
  // handled by the same rule with nothing to pass in per call.
  gain.gain.value = gainForLevel(levelDbA, fileGainAdjustDb(url));

  // Ear routing via a splitter/merger instead of StereoPannerNode.
  // StereoPannerNode uses an equal-power law that, for a STEREO source panned
  // hard to one ear, sums both input channels into the output channel — a boost
  // of up to +6 dB in that ear relative to the un-panned calibration path. That
  // makes single-ear presentation measure hot even though the on-screen level is
  // correct. Here we first collapse the (possibly stereo) source to mono at
  // unity, then feed only the selected output channel(s), so the in-ear level
  // matches the calibration/test path exactly for left, right and binaural.
  source.connect(gain);
  const pan = makeEarRouter(ctx, gain, ear);
  const node = { el, source, gain, pan, loop };

  if (!loop) {
    state.audio.activeStimuli.push(node);
    setStimulusIndicator(true);
    el.addEventListener("ended", () => {
      state.audio.activeStimuli = state.audio.activeStimuli.filter(x => x !== node);
      teardownStimulusNode(node);
      if (!state.audio.activeStimuli.length) setStimulusIndicator(false);
    }, { once: true });
  } else {
    // Fallback only: iOS can gap HTMLAudioElement loops.
    // Main masker path uses AudioBufferSourceNode below.
    el.addEventListener("timeupdate", () => {
      if (el.duration && el.duration - el.currentTime < 0.12) {
        try { el.currentTime = 0; el.play(); } catch {}
      }
    });
  }
  return node;
}

// Disconnect and release every Web-Audio node a stimulus created. A
// MediaElementAudioSourceNode stays connected to the graph (and keeps summing
// into ctx.destination) until explicitly disconnected, and cannot be
// garbage-collected while connected — so without this, each played word left a
// live source→gain→router→destination chain behind. Hundreds of these over a
// session progressively load the audio thread and cause the drop-outs/static
// that worsen as testing goes on. Safe to call more than once.
function teardownStimulusNode(node) {
  if (!node || node._torndown) return;
  node._torndown = true;
  try { node.source && node.source.disconnect(); } catch {}
  try { node.gain && node.gain.disconnect(); } catch {}
  try { node.pan && typeof node.pan.disconnect === "function" && node.pan.disconnect(); } catch {}
  try {
    if (node.el) {
      node.el.pause();
      node.el.removeAttribute("src");
      // Release the decoded media so the element and its source node can be GC'd.
      try { node.el.load(); } catch {}
    }
  } catch {}
}

// adjustDb is a SIGNED gain adjustment (dB) applied on top of the level→gain
// conversion, matching the UI's "CVC file gain adjustment: -5.07 dB". Negative
// attenuates, positive would amplify. It defaults to 0, so the masker, the
// CVCV assets and any non-sounds_cvc/ file are unchanged. Files under
// sounds_cvc/ pass -5.07 (via fileGainAdjustDb), so both the CVC words and the
// CVC calibration tone play 5.07 dB below their raw level — landing them on the
// same effective scale as CVCV and making the two tones meter identically.
function gainForLevel(levelDbA, adjustDb = 0, ear = undefined) {
  const adj = Number(adjustDb) || 0;
  const reference = referenceDbA(ear);   // per-ear (audiometer) or shared (sound-field)
  if (state.calibration.isCalibrated && reference !== null) {
    // Effective presented level is the displayed level plus the (signed) file
    // adjustment; attenuation is how far that sits below the unity reference.
    const attenuation = reference - (Number(levelDbA) + adj);
    const gain = Math.pow(10, -attenuation / 20);
    if (gain > 1) {
      // The reference IS unity gain. Amplifying past it clips the sample and
      // the on-screen dB(A) stops describing what the client hears. Cap, and
      // complain — if this fires, a level reached the audio path without
      // passing clampLevel(). A negative (attenuating) CVC adjustment can only
      // lower the gain, so it is never the cause; the base level is too high.
      console.error(
        `gainForLevel: ${levelDbA} dB(A) is above the calibration reference of ` +
        `${reference} dB(A). Capped at unity — presented level ` +
        `is NOT the displayed level. To present higher, ${moreLevelAdvice()}.`
      );
      return 1;
    }
    return gain;
  }
  // Uncalibrated adaptive: there is no absolute reference, but the whole point
  // of an adaptive track is the RELATIVE level change between words, and the
  // stimulus set is level-normalised — so treat the track's starting level as
  // the unity-gain reference and attenuate below it. Without this, every word
  // plays at unity and the level never actually changes in the ear.
  if (adaptiveActive() && state.adaptive && state.adaptive.startLevel != null) {
    const attenuation = Number(state.adaptive.startLevel) - (Number(levelDbA) + adj);
    // attenuation < 0 means "above the starting level"; can't amplify past
    // unity, so cap and let the rail/level logic surface it.
    if (attenuation <= 0) return 1;
    return Math.pow(10, -attenuation / 20);
  }
  // Uncalibrated, fixed mode: files are level-normalised relative to each other,
  // so play at unity and let device volume set the output. A negative CVC
  // adjustment still applies as a pure relative attenuation so the two sets stay
  // on the same scale even with no reference; a non-negative adjustment is unity.
  if (adj < 0) return Math.pow(10, adj / 20);
  return 1.0;
}

async function playFirstAvailable(bases, ear, levelDbA, loop=false) {
  let lastError = null;
  for (const base of bases) {
    const urls = base.includes("/") ? [base] : candidatesForBase(base);
    for (const url of urls) {
      // Confirm the file actually exists before trying to play it. Probing with
      // fetch makes the .wav→.mp3 fallback reliable (a missing extension is a
      // clean 404 here, not an unreliable HTMLAudioElement play() rejection)
      // and surfaces real case-sensitivity mismatches instead of masking them.
      let exists = true;
      try {
        const resp = await fetch(url, { method: "HEAD" });
        exists = resp.ok;
      } catch {
        // HEAD can be blocked (some static hosts); fall back to a ranged GET.
        try {
          const resp = await fetch(url, { headers: { Range: "bytes=0-0" } });
          exists = resp.ok;
        } catch (err) {
          exists = false;
          lastError = err;
        }
      }
      if (!exists) continue;
      try {
        const node = createRoutedAudio(url, ear, levelDbA, loop);
        await node.el.play();
        return node;
      } catch (err) {
        lastError = err;
      }
    }
  }
  throw lastError || new Error("No audio file found");
}

function setupCalibrationSlider() {
  const slider = $("outputLevel");
  // Recompute from measuredDbA rather than reading persisted bounds: a session
  // saved under the old rule carries stale (possibly negative) ones, and would
  // restore them even after this fix lands.
  const b = levelBounds();
  if (b && b.usable) {
    state.calibration.sliderMinDb = b.min;
    state.calibration.sliderMaxDb = b.max;
    state.calibration.currentSliderDb = clampLevel(state.calibration.currentSliderDb ?? b.max);
    slider.step = 5;
  } else {
    // Uncalibrated: dB FS, −100…0, unity at 0. Honest about what it is.
    state.calibration.sliderMinDb = -100;
    state.calibration.sliderMaxDb = 0;
    state.calibration.currentSliderDb =
      Math.min(0, Math.max(-100, snap5(state.calibration.currentSliderDb ?? 0)));
    slider.step = 5;
  }
  slider.min = state.calibration.sliderMinDb;
  slider.max = state.calibration.sliderMaxDb;
  slider.value = state.calibration.currentSliderDb;
  updateOutputLevelFromSlider();
}

function updateOutputLevelFromSlider() {
  const slider = $("outputLevel");
  let rawValue = parseFloat(slider.value);
  if (state.calibration.isCalibrated && state.calibration.measuredDbA !== null) {
    const max = parseFloat(slider.max);
    const tolerance = 0.25;
    const snapped = Math.abs(rawValue - max) <= tolerance ? max : Math.round(rawValue / 5) * 5;
    slider.value = snapped;
    state.calibration.currentSliderDb = snapped;
    $("outputLevelLabel").textContent = `${snapped} dB A`;
    $("modeBadge").textContent = "Calibrated Mode";
    $("modeBadge").classList.add("calibrated");
  } else {
    const snapped = Math.round(rawValue / 5) * 5;
    slider.value = snapped;
    state.calibration.currentSliderDb = snapped;
    $("outputLevelLabel").textContent = `${snapped} dB FS`;
    $("modeBadge").textContent = "Uncalibrated Mode";
    $("modeBadge").classList.remove("calibrated");
  }
  saveSession();
}

// Apply a dual-dial audiometer calibration. left/right are the per-ear dial
// settings (either may be null → falls back to the other ear at use time). The
// slider bounds use the higher of the two references (the widest headroom); the
// per-ear gain path picks the correct dial for each ear via referenceDbA().
function applyCalibrationDials(left, right, timestamp = new Date().toISOString(), method) {
  const vals = [left, right].filter(v => Number.isFinite(Number(v))).map(Number);
  if (!vals.length) return false;
  const representative = Math.max(...vals);

  state.calibration.method = method || "audiometer";
  state.calibration.dial = { left: Number.isFinite(Number(left)) ? Number(left) : null,
                             right: Number.isFinite(Number(right)) ? Number(right) : null };
  state.calibration.measuredDbA = representative;   // for slider bounds & displays
  state.calibration.timestamp = timestamp;
  state.calibration.isCalibrated = true;

  const b = levelBounds();
  if (!b || !b.usable) {
    state.calibration.isCalibrated = false;
    state.calibration.measuredDbA = null;
    if ($("calStatus")) $("calStatus").textContent =
      `Those dial settings don't give a usable range. Check the figures are the ` +
      `audiometer dial settings in dB(A).`;
    saveSession();
    return false;
  }
  state.calibration.sliderMinDb = b.min;
  state.calibration.sliderMaxDb = b.max;
  state.calibration.currentSliderDb = b.max;
  const slider = $("outputLevel");
  if (slider) { slider.min = b.min; slider.max = b.max; slider.step = 5; slider.value = b.max; }
  if ($("testCalBtn")) $("testCalBtn").hidden = false;
  updateOutputLevelFromSlider();
  reconcileQueueLevels();
  renderCalStatus();
  saveSession();
  return true;
}

function applyCalibrationLevel(level, timestamp = new Date().toISOString(), method) {
  const reference = Number(level);
  if (!Number.isFinite(reference)) return false;

  state.calibration.method = method || calMethod();
  state.calibration.measuredDbA = reference;
  state.calibration.timestamp = timestamp;
  state.calibration.isCalibrated = true;

  const b = levelBounds();

  if (!b.usable) {
    // Only reachable when the reference is below the physical floor, i.e. the
    // figure entered is not a sound pressure level. Refuse rather than hand
    // back a slider that looks functional.
    const wasMethod = state.calibration.method;
    state.calibration.isCalibrated = false;
    state.calibration.measuredDbA = null;
    state.calibration.sliderMinDb = -100;
    state.calibration.sliderMaxDb = 0;
    state.calibration.currentSliderDb = 0;
    state.calibration.method = wasMethod;   // keep for the dialog
    setupCalibrationSlider();
    if ($("calStatus")) $("calStatus").textContent =
      `${reference} dB(A) is not a usable reference. Check the figure is ` +
      (wasMethod === "audiometer"
        ? "the audiometer dial setting"
        : "the meter reading at the client's position") +
      ` in dB(A). Staying in uncalibrated mode.`;
    saveSession();
    return false;
  }

  state.calibration.sliderMinDb = b.min;
  state.calibration.sliderMaxDb = b.max;
  state.calibration.currentSliderDb = b.max;

  const slider = $("outputLevel");
  slider.min = b.min;
  slider.max = b.max;
  slider.step = 5;   // both ends on the grid; make travel match the snap
  slider.value = b.max;

  $("testCalBtn").hidden = false;
  updateOutputLevelFromSlider();
  reconcileQueueLevels();
  renderCalStatus();
  saveSession();
  return true;
}

function offerStoredCalibration() {
  const saved = localStorage.getItem("ucTeReoSpeechAudiometryCalibration");
  if (!saved) return;
  try {
    const data = JSON.parse(saved);
    // Dual-dial audiometer calibrations store {dial:{left,right}}; older/sound-field
    // ones store {level}. Restore whichever is present.
    let ok;
    if (data.dial && (Number.isFinite(Number(data.dial.left)) || Number.isFinite(Number(data.dial.right)))) {
      ok = applyCalibrationDials(data.dial.left, data.dial.right, data.timestamp, data.method || "audiometer");
    } else if (data.level) {
      ok = applyCalibrationLevel(Number(data.level), data.timestamp, data.method);
    } else {
      return;
    }
    if (!ok) return;
    const when = data.timestamp
      ? new Date(data.timestamp).toLocaleString("en-NZ", { dateStyle: "short", timeStyle: "short" })
      : "earlier";
    // renderCalStatus() has set the live range line; prepend the restore notice
    // rather than overwrite it. The stored figure is someone else's dial setting
    // or an assumption the room is unchanged — flag it as needing confirmation.
    if ($("calStatus")) $("calStatus").textContent =
      `Calibration restored from ${when} — confirm it still holds (re-run calibration if ` +
      `the dial, speaker, seat or room has changed). ` + $("calStatus").textContent;
  } catch {}
}

// Log the actual sample rate of each decoded file, so a file whose rate differs
// from the rest is visible instead of assumed. decodeAudioData reports the rate
// it read from the file header; an AudioBufferSourceNode is resampled to the
// context rate by the Web Audio engine on playback, so a differing rate is
// handled correctly rather than shifting pitch.
function logDecodedRate(url, buffer) {
  try {
    console.log(`[audio] decoded ${url}: ${buffer.sampleRate} Hz`);
  } catch {}
}

// Resolve the first base that actually exists to its concrete URL, without
// decoding. Used so the calibration path can learn WHICH file it will play and
// apply that file's folder gain adjustment (the CVC tone lives in sounds_cvc/
// and must be pulled down like the CVC words). Returns null if none exist.
async function firstAvailableUrl(bases) {
  for (const base of bases) {
    const urls = base.includes("/") ? [base] : candidatesForBase(base);
    for (const url of urls) {
      if (state.audio.decodedBuffers[url]) return url;   // already fetched
      try {
        const resp = await fetch(url, { method: "HEAD" });
        if (resp.ok) return url;
      } catch {
        try {
          const resp = await fetch(url, { headers: { Range: "bytes=0-0" } });
          if (resp.ok) return url;
        } catch {}
      }
    }
  }
  return null;
}

async function decodeFirstAvailable(bases) {
  const ctx = ensureAudio();
  for (const base of bases) {
    const urls = base.includes("/") ? [base] : candidatesForBase(base);
    for (const url of urls) {
      if (state.audio.decodedBuffers[url]) return state.audio.decodedBuffers[url];
      try {
        const resp = await fetch(url);
        if (!resp.ok) continue;
        const arr = await resp.arrayBuffer();
        const decoded = await ctx.decodeAudioData(arr);
        logDecodedRate(url, decoded);
        state.audio.decodedBuffers[url] = decoded;
        return decoded;
      } catch {}
    }
  }
  throw new Error("No decodable calibration sound found");
}

// Decode the first available base AND report the URL it came from, so callers
// can apply that file's folder gain adjustment. { buffer, url }.
//
// This does NOT pre-probe with HEAD: some static hosts (GitHub Pages behind a
// CDN among them) answer HEAD with 405/redirect even when GET works, which would
// make a reachable calibration tone look missing and silently fall through to
// the noise. We attempt the real decode (a GET) on each candidate in turn and
// only move on when that genuinely fails.
async function decodeFirstAvailableWithUrl(bases) {
  const ctx = ensureAudio();
  for (const base of bases) {
    const urls = base.includes("/") ? [base] : candidatesForBase(base);
    for (const url of urls) {
      if (state.audio.decodedBuffers[url]) return { buffer: state.audio.decodedBuffers[url], url };
      try {
        const resp = await fetch(url);
        if (!resp.ok) continue;
        const arr = await resp.arrayBuffer();
        const decoded = await ctx.decodeAudioData(arr);
        logDecodedRate(url, decoded);
        state.audio.decodedBuffers[url] = decoded;
        return { buffer: decoded, url };
      } catch {}
    }
  }
  throw new Error("No decodable calibration sound found");
}

function stopCalibrationSound() {
  if (state.audio.calNode) {
    try { state.audio.calNode.stop(); } catch {}
    state.audio.calNode = null;
  }
  state.audio.calRouter = null;
}

function openCalibrationDialog() {
  const dlg = $("calibrationDialog");
  if (!dlg) return;
  $("calMethodSelect").value = calMethod();
  $("calLevelInput").value = state.calibration.measuredDbA ?? "";
  $("calDialogStatus").textContent = "";
  if ($("calPlayBtn")) $("calPlayBtn").textContent = calPlayLabel(false);
  renderCalMethodUI();
  dlg.showModal();
}

function renderCalMethodUI() {
  const info = CAL_METHODS[$("calMethodSelect").value] || CAL_METHODS.audiometer;
  const ol = $("calSteps");
  ol.innerHTML = "";
  info.steps.forEach(s => {
    const li = document.createElement("li");
    li.textContent = s;
    ol.appendChild(li);
  });
  $("calLevelLabelText").textContent = info.levelLabel;
  $("calLevelInput").step = info.levelStep;
  // hint depends on the selected method, not the stored one
  const sel = $("calMethodSelect").value;
  $("calLevelHint").textContent = sel === "audiometer"
    ? `Levels are presented from this figure downward. Set the dial to the loudest ` +
      `level you'll need, plus a little margin — at least 6 dB if you'll be masking.`
    : `This is the most this setup can deliver with the device at full volume. The ` +
      `calibration is valid only for this speaker, seat and room — recalibrate if any change.`;
  // Per-channel routing is an audiometer concern: the aux input is calibrated one
  // channel at a time. In sound field there's a single meter at the head, so the
  // selector is hidden and the noise plays to both.
  const earWrap = $("calEarWrap"), earHint = $("calEarHint");
  if (earWrap) earWrap.style.display = sel === "audiometer" ? "" : "none";
  if (earHint) {
    earHint.textContent = sel === "audiometer"
      ? "Play the tone to BOTH channels and zero each audiometer input (A and B) " +
        "to VU 0 off this one tone. Both channels are then referenced to the tone, " +
        "so the software can place speech and masker correctly on either side."
      : "";
  }
  // Audiometer mode uses two dials (one per channel/ear); sound-field uses the
  // single measured SPL. Show whichever applies.
  // New (safer) audiometer scheme: the tone goes to BOTH channels and the
  // clinician zeroes A and B off it, so an ear-swap mid-test can never leave a
  // channel mis-referenced. Default the routing to binaural in every method.
  if ($("calEarSelect")) {
    $("calEarSelect").value = "binaural";
    setCalibrationEar("binaural");
  }
  const dual = $("calDialDualWrap"), single = $("calLevelSingleWrap");
  if (dual && single) {
    const isAud = sel === "audiometer";
    dual.style.display = isAud ? "" : "none";
    single.style.display = isAud ? "none" : "";
    if (isAud) {
      const d = state.calibration.dial || {};
      if ($("calDialLeft"))  $("calDialLeft").value  = d.left  ?? (state.calibration.measuredDbA ?? "");
      if ($("calDialRight")) $("calDialRight").value = d.right ?? (state.calibration.measuredDbA ?? "");
    }
  }
}

// Ordered list of calibration-signal bases to try, for the current method and
// language. The audiometer method uses a 1 kHz tone matched to the speech
// material — CVCV has its own tone, CVC reuses the Millennium-edition 1 kHz
// tone the CVC recordings were referenced against. The CVC tone lives in
// sounds_cvc/, so it receives the same folder gain adjustment as the CVC words
// (see fileGainAdjustDb); that is what makes it meter to the SAME reading as the
// CVCV tone at one dial setting, so a single calibration serves BOTH tests. The
// sound-field method keeps the broadband noise. In every case we fall back to
// noise/masking so a missing tone file degrades gracefully rather than blocking
// calibration. Paths with spaces are URI-encoded to match the on-disk filenames.
function calibrationSignalBases() {
  const toneCVCV = "sounds/calibration_CVCV_1kHz.mp3";
  const toneCVC  = `${ENGLISH_SOUND_DIR}/` +
    encodeURI("Speech Lists - Millenium Edition-01-1 kHz tone_left.mp3");
  // Follow the LIVE method selector in the dialog, not the saved calibration
  // method: the clinician chooses the method and plays the signal to calibrate
  // BEFORE saving, so reading saved state here would play the wrong signal (e.g.
  // the noise) until Save. Fall back to the saved method when the dialog isn't
  // open (e.g. Test level from the setup screen).
  const method = ($("calMethodSelect") && $("calMethodSelect").value) || calMethod();
  if (method === "audiometer") {
    // Audiometer method calibrates against the 1 kHz tone. Do NOT fall back to
    // the broadband noise: substituting noise for the tone would let a clinician
    // calibrate against the wrong signal without realising. If the tone file is
    // missing we want a clear failure, not silent noise.
    const tone = state.language === "english" ? toneCVC : toneCVCV;
    return [tone];
  }
  return ["calib", "noise", "masking"];
}

// True when the current (live) calibration method uses the 1 kHz tone.
function calSignalIsTone() {
  const method = ($("calMethodSelect") && $("calMethodSelect").value) || calMethod();
  return method === "audiometer";
}
function calPlayLabel(playing) {
  const sig = calSignalIsTone() ? "1 kHz tone" : "calibration noise";
  return `${playing ? "■ Stop" : "▶ Play"} ${sig}`;
}

async function toggleCalibrationNoise() {
  const btn = $("calPlayBtn");
  if (state.audio.calNode) {
    stopCalibrationSound();
    btn.textContent = calPlayLabel(false);
    btn.classList.remove("active");
    $("calDialogStatus").textContent = "";
    return;
  }

  stopCurrentStimulusIfAny();
  stopTestCalibratedSound();
  ensureAudio();
  // If the context came back at the wrong rate, calibrating now would set a
  // silently wrong reference. Refuse and say why.
  if (state.audio.rateMismatch) { renderRateWarning(); return; }

  const isTone = calSignalIsTone();
  let buffer, calUrl;
  try {
    ({ buffer, url: calUrl } = await decodeFirstAvailableWithUrl(calibrationSignalBases()));
  } catch {
    $("calDialogStatus").textContent = isTone
      ? "1 kHz calibration tone not found. Expected " +
        (state.language === "english"
          ? `${ENGLISH_SOUND_DIR}/Speech Lists - Millenium Edition-01-1 kHz tone_left.mp3`
          : "sounds/calibration_CVCV_1kHz.mp3") +
        ". Calibration cannot proceed without it."
      : "No calibration noise found. Add calib.wav or noise.mp3 to the sounds/ folder.";
    return;
  }

  const source = state.audio.ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  // Route through the SAME stereoize/split/merge graph a stimulus uses.
  // The calibration reference must be measured on the identical signal path the
  // words play through, or any channel-count / up-mix effect would apply to one
  // and not the other and the on-screen dB would drift from the presented dB.
  // Audiometer calibration is done per channel, so honour the ear selector: the
  // clinician sets the aux-input gain for each channel in turn.
  //
  // Crucially, the tone gets the SAME folder gain adjustment as the words it is
  // the reference for: the CVC tone (in sounds_cvc/) plays -5.07 dB, the CVCV
  // tone (in sounds/) plays at unity. That is what makes the two tones meter to
  // the SAME reading at one dial setting, and what keeps each word set matched
  // to its own tone.
  const calGain = state.audio.ctx.createGain();
  calGain.gain.value = Math.pow(10, fileGainAdjustDb(calUrl) / 20);
  source.connect(calGain);
  const ear = $("calEarSelect") ? $("calEarSelect").value : "binaural";
  state.audio.calRouter = makeEarRouter(state.audio.ctx, calGain, ear);
  source.start();
  state.audio.calNode = source;

  btn.textContent = calPlayLabel(true);
  btn.classList.add("active");
  $("calDialogStatus").textContent = calNoiseStatusText(ear);
}

// Live re-route while the noise plays, so the clinician can flip between
// channels without restarting the tone. No-op if not currently playing.
function setCalibrationEar(ear) {
  if (state.audio.calRouter) state.audio.calRouter.setEar(ear);
  if (state.audio.calNode) $("calDialogStatus").textContent = calNoiseStatusText(ear);
}

function calNoiseStatusText(ear) {
  const where = ear === "left" ? "left channel only"
              : ear === "right" ? "right channel only"
              : "both channels";
  const signal = calSignalIsTone() ? "1 kHz calibration tone" : "Calibration noise";
  const adj = calSignalIsTone() && state.language === "english" && fileGainAdjustDb(
    `${ENGLISH_SOUND_DIR}/x`) !== 0
      ? ` (CVC tone, ${cvcFileGainDb()} dB folder adjustment applied)` : "";
  return `${signal} playing at full output${adj} — ${where}.`;
}

function saveCalibrationDialog() {
  const method = $("calMethodSelect").value;

  // Audiometer: two dials (one per ear). At least one must be set; a blank side
  // falls back to the other at use time.
  if (method === "audiometer") {
    const lRaw = $("calDialLeft") ? $("calDialLeft").value : "";
    const rRaw = $("calDialRight") ? $("calDialRight").value : "";
    const lHas = lRaw !== "" && Number.isFinite(Number(lRaw));
    const rHas = rRaw !== "" && Number.isFinite(Number(rRaw));
    if (!lHas && !rHas) {
      $("calDialogStatus").textContent = "Enter at least one dial setting before saving.";
      return;
    }
    const ok = applyCalibrationDials(
      lHas ? Number(lRaw) : null, rHas ? Number(rRaw) : null,
      new Date().toISOString(), method);
    if (!ok) { $("calDialogStatus").textContent = $("calStatus").textContent; return; }
    localStorage.setItem("ucTeReoSpeechAudiometryCalibration",
      JSON.stringify({ dial: state.calibration.dial, method, timestamp: state.calibration.timestamp }));
    $("calibrationDialog").close();
    return;
  }

  const raw = $("calLevelInput").value;
  const level = Number(raw);
  if (raw === "" || !Number.isFinite(level)) {
    $("calDialogStatus").textContent = "Enter the level before saving.";
    return;
  }
  const ok = applyCalibrationLevel(level, new Date().toISOString(), method);
  if (!ok) {
    // Refused — mirror the reason into the dialog and stay open so the figure
    // can be corrected without redoing the noise.
    $("calDialogStatus").textContent = $("calStatus").textContent;
    return;
  }
  localStorage.setItem("ucTeReoSpeechAudiometryCalibration",
    JSON.stringify({ level, method, timestamp: state.calibration.timestamp }));
  $("calibrationDialog").close();
}

async function testCalibratedSound() {
  if (!state.calibration.isCalibrated) return;

  if (state.audio.testCalNode) {
    stopTestCalibratedSound();
    return;
  }

  stopCurrentStimulusIfAny();
  stopCalibrationSound();

  let buffer, calUrl;
  try {
    ({ buffer, url: calUrl } = await decodeFirstAvailableWithUrl(calibrationSignalBases()));
  } catch {
    alert("No calibration sound file found.");
    return;
  }

  const source = state.audio.ctx.createBufferSource();
  const gain = state.audio.ctx.createGain();
  source.buffer = buffer;
  source.loop = true;
  // Play the tone exactly as a word at this level would play, including the
  // folder gain adjustment, so metering the test tone reads the true presented
  // level for that word set.
  gain.gain.value = gainForLevel(state.calibration.currentSliderDb, fileGainAdjustDb(calUrl));
  // Same graph as a real stimulus (and as the calibration noise): source → gain
  // → ear router → destination, binaural. This is what lets a clinician meter
  // the test tone and read the level a word would actually present at.
  source.connect(gain);
  makeEarRouter(state.audio.ctx, gain, "binaural");
  source.start();

  state.audio.testCalNode = source;
  $("testCalBtn").textContent = "Stop";
  source.onended = () => {
    if (state.audio.testCalNode === source) {
      state.audio.testCalNode = null;
      $("testCalBtn").textContent = "Test Calibrated Sound";
    }
  };
}

function stopTestCalibratedSound() {
  if (state.audio.testCalNode) {
    try { state.audio.testCalNode.stop(); } catch {}
    state.audio.testCalNode = null;
  }
  if ($("testCalBtn")) $("testCalBtn").textContent = "Test Calibrated Sound";
}

function stopCurrentStimulusIfAny() {
  for (const node of state.audio.activeStimuli || []) {
    try {
      node.el.pause();
      node.el.currentTime = 0;
    } catch {}
    // Release the graph immediately — an interrupted word (replay, advance to the
    // next trial) would otherwise leak its nodes exactly like a completed one.
    teardownStimulusNode(node);
  }
  state.audio.activeStimuli = [];
  setStimulusIndicator(false);
}

function updateMaskingEnabled() {
  const enabled = $("maskingEnabled") && $("maskingEnabled").value === "on";
  $("maskEar").disabled = !enabled;
  $("maskLevel").disabled = !enabled;
  if (!enabled) {
    $("maskEar").value = "off";
    if ($("maskEarLive")) $("maskEarLive").value = "off";
    stopMasker();
  } else if ($("maskEar").value === "off") {
    const stim = $("stimEar").value;
    $("maskEar").value = stim === "left" ? "right" : stim === "right" ? "left" : "binaural";
  }
  syncMaskerControls();
}

function openConditionDialog() {
  if (!$("conditionDialog")) return;
  $("conditionEditSelect").value = $("presentationCondition") ? $("presentationCondition").value : $("stimEar").value;
  $("conditionDialog").showModal();
}

function saveConditionDialog() {
  if ($("presentationCondition")) {
    $("presentationCondition").value = $("conditionEditSelect").value;
    updatePresentationConditionRouting();
    renderQueue();
    refreshPI();
    saveSession();
  }
  $("conditionDialog").close();
}

function openTrialEdit(resultIndex) {
  const r = state.results[resultIndex];
  if (!r || !$("trialEditDialog")) return;
  $("trialEditResultIndex").value = String(resultIndex);
  $("trialEditTitle").textContent = `Edit ${r.presentedWord}`;
  // Rebuild the score options to match this result's phoneme count.
  const denom = r.phonemeCount || r.targetPhonemes?.length || 4;
  const sel = $("trialEditScore");
  if (sel) {
    sel.innerHTML = "";
    for (let i = 0; i <= denom; i++) {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = `${i}/${denom}`;
      sel.appendChild(opt);
    }
    sel.value = String(r.score ?? 0);
  }
  $("trialEditComment").value = r.comment || "";
  $("trialEditDialog").showModal();
}

function saveTrialEditDialog() {
  const idx = Number($("trialEditResultIndex").value);
  if (!Number.isFinite(idx) || !state.results[idx]) return;
  const r = state.results[idx];
  const denom = r.phonemeCount || r.targetPhonemes?.length || 4;
  r.score = Number($("trialEditScore").value);
  r.scoringMode = "edited-numeric";
  r.responsePhonemes = Array(denom).fill(null);
  r.selectedTargetCorrectness = Array(denom).fill(false);
  r.percent = Math.round((r.score / denom) * 100);
  r.comment = $("trialEditComment").value.trim();
  saveSession();
  refreshPI();
  renderTrialNavigator();
  $("trialEditDialog").close();
}

function updatePresentationConditionRouting() {
  const c = $("presentationCondition") ? $("presentationCondition").value : $("stimEar").value;
  if (c === "left") $("stimEar").value = "left";
  else if (c === "right") $("stimEar").value = "right";
  else $("stimEar").value = "binaural";
  if ($("stimEar").onchange) $("stimEar").onchange();
}

function addList(listNumber, level) {
  const lvl = clampLevel(level);
  // WAS: if (!listNumber || !level) return; — rejected a legitimate level of 0
  if (!listNumber || !Number.isFinite(lvl)) return;
  state.queue.push({ listNumber, levelDbA: lvl, language: state.language, status: "queued", id: crypto.randomUUID?.() || String(Date.now()+Math.random()) });
  renderQueue();
  saveSession();
}

function addRandomList(level) {
  const allLists = Object.keys(currentWordLists()).map(Number);
  let pool = allLists;

  // Do not duplicate a list (within the current language) while the queue
  // contains fewer entries than there are lists. Repeats allowed beyond that.
  const sameLang = state.queue.filter(q => (q.language || "maori") === state.language);
  if (sameLang.length < allLists.length) {
    const used = new Set(sameLang.map(q => q.listNumber));
    pool = allLists.filter(n => !used.has(n));
  }
  if (!pool.length) pool = allLists;

  const n = pool[Math.floor(Math.random() * pool.length)];
  addList(n, level);
}

function addNRandomLists() {
  const n = Math.max(1, Math.min(10, Number($("randomCount").value)));
  const level = clampLevel($("randomLevel").value);
  for (let i = 0; i < n; i++) addRandomList(level);
}

function renderQueue() {
  const box = $("queueChips");
  if (!box) return;
  box.innerHTML = "";
  state.queue.forEach((q, idx) => {
    const chip = document.createElement("span");
    chip.className = "chip queue-chip" + (idx === state.currentListIndex ? " current" : "");
    chip.draggable = true;
    chip.dataset.index = String(idx);
    chip.innerHTML = `<span class="queue-lang-tag ${(q.language||'maori')}">${(LANGUAGES[q.language||'maori']||LANGUAGES.maori).label}</span> List ${q.listNumber} @ ${q.levelDbA} dB(A) — ${q.status} <span class="queue-arrows">↕</span>`;
    chip.onclick = () => openQueueDialog(idx);

    chip.addEventListener("dragstart", e => {
      chip.classList.add("dragging");
      e.dataTransfer.setData("text/plain", String(idx));
    });
    chip.addEventListener("dragend", () => chip.classList.remove("dragging"));
    chip.addEventListener("dragover", e => e.preventDefault());
    chip.addEventListener("drop", e => {
      e.preventDefault();
      const from = Number(e.dataTransfer.getData("text/plain"));
      moveQueueItem(from, idx);
    });

    box.appendChild(chip);
  });

  const progress = $("progressIndicator");
  if (progress) progress.innerHTML = box.innerHTML;
}

function openQueueDialog(index) {
  const dlg = $("queueDialog");
  if (!dlg) return;
  const isNew = index === null || index === undefined;
  $("queueDialogTitle").textContent = isNew ? "Add list" : "Edit list";
  $("queueEditIndex").value = isNew ? "" : String(index);
  $("queueListNumber").value = isNew ? String(Number($("listChoice")?.value || 1)) : String(state.queue[index].listNumber);
  $("queueLevel").value = isNew ? String(snap5($("listLevel")?.value || 60)) : String(state.queue[index].levelDbA);
  $("queueDeleteBtn").style.visibility = isNew ? "hidden" : "visible";
  dlg.showModal();
}

function saveQueueDialog() {
  const idxRaw = $("queueEditIndex").value;
  const listNumber = Number($("queueListNumber").value);
  const levelDbA = clampLevel($("queueLevel").value);
  if (idxRaw === "") {
    addList(listNumber, levelDbA);
  } else {
    const idx = Number(idxRaw);
    if (state.queue[idx]) {
      state.queue[idx].listNumber = listNumber;
      state.queue[idx].levelDbA = levelDbA;
      renderQueue();
      saveSession();
    }
  }
  $("queueDialog").close();
}

function deleteQueueDialog() {
  const idx = Number($("queueEditIndex").value);
  if (!Number.isFinite(idx) || !state.queue[idx]) return;
  if (state.queue[idx].status === "in progress" && !confirm("Delete the list currently in progress? Existing trial data already saved will remain in the report.")) return;
  state.queue.splice(idx, 1);
  if (state.currentListIndex >= state.queue.length) state.currentListIndex = Math.max(0, state.queue.length - 1);
  renderQueue();
  saveSession();
  $("queueDialog").close();
}

function moveQueueItem(from, to) {
  if (from === to || !state.queue[from] || !state.queue[to]) return;
  const [item] = state.queue.splice(from, 1);
  state.queue.splice(to, 0, item);
  if (state.currentListIndex === from) state.currentListIndex = to;
  renderQueue();
  saveSession();
}

function startTesting() {
  readClientForm();
  if (!state.queue.length) addRandomList(Number($("listLevel").value));
  state.currentListIndex = state.queue.findIndex(q => q.status === "queued");
  if (state.currentListIndex < 0) state.currentListIndex = 0;
  syncMaskerControls();
  state.firstTrialMaskerPrimed = false;
  beginCurrentList();
  show("screen-test");
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function beginCurrentList() {
  const q = state.queue[state.currentListIndex];
  if (!q) return showReport();
  // Follow the list's language so scoring, terminology and the carrier behave correctly.
  if (q.language && q.language !== state.language) {
    state.language = q.language;
    applyLanguageToUI();
  }
  q.status = "in progress";
  state.firstTrialMaskerPrimed = false;
  const qLang = q.language || "maori";
  const lists = WORD_LISTS_FOR(qLang);
  // Shuffle only when randomisation is enabled for this language; otherwise
  // present the words in their listed (file) order.
  const words = randomiseEnabled(qLang) ? shuffle(lists[q.listNumber]) : lists[q.listNumber].slice();
  state.currentTrials = words.map((w, i) => ({ order: i + 1, word: w }));
  state.currentResultIndexByTrial = {};
  state.currentTrialIndex = 0;

  // Non-adaptive lists: let the clinician set/confirm the presentation level (and
  // masker) BEFORE the first word plays. Previously the first word auto-played at
  // the proposed level before it could be changed. The prompt holds playback; on
  // confirm it applies the level and plays the first word.
  if (q.nonAdaptive) {
    state.awaitingListLevelConfirm = true;
    renderQueue();
    renderTrial();          // paints the trial UI but auto-play is gated by the flag
    promptListLevel(q);
    saveSession();
    return;
  }

  renderQueue();
  renderTrial();
  startMaskerIfNeeded();
  saveSession();
}

// Pre-list level/masker confirmation for non-adaptive lists. Shows the proposed
// level and masker, lets the clinician change them, and only then plays the first
// word. Ordered loudest→middle→quietest across the block, so this is where the
// clinician nudges an individual list (e.g. to chase a half-peak).
function promptListLevel(q) {
  let dlg = $("listLevelDialog");
  if (!dlg) {
    dlg = document.createElement("dialog");
    dlg.id = "listLevelDialog";
    dlg.className = "mita-dialog-card";
    dlg.innerHTML = `
      <div style="min-width:320px;max-width:420px">
        <h3 id="listLevelTitle" style="margin:.2rem 0 .6rem">Set level for this list</h3>
        <p class="hint" id="listLevelBlurb" style="margin:.2rem 0 .8rem"></p>
        <div style="display:flex;flex-direction:column;gap:.6rem">
          <label style="display:block;margin:0">Presentation level dB(A)
            <input type="number" id="listLevelInput" step="5" style="width:100%">
          </label>
          <label style="display:block;margin:0">Masker level dB(A) <span class="hint">(blank = off)</span>
            <input type="number" id="listMaskerInput" step="5" style="width:100%">
          </label>
        </div>
        <div class="actions" style="margin-top:1rem;display:flex;gap:.5rem;justify-content:flex-end">
          <button type="button" id="listLevelStart" class="primary">Start list</button>
        </div>
      </div>`;
    document.body.appendChild(dlg);
  }
  const lvlInput = $("listLevelInput");
  const maskInput = $("listMaskerInput");
  const label = q.proposedLabel ? ` (${q.proposedLabel})` : "";
  $("listLevelTitle").textContent = `List ${q.listNumber}${label} — set level`;
  $("listLevelBlurb").textContent =
    `Adjust the presentation level (and masker if needed) before the first word plays. ` +
    `You can still change the level mid-list from the usual control.`;
  lvlInput.value = (q.levelDbA === "" || q.levelDbA == null) ? "" : q.levelDbA;
  // Seed masker from the live control (runBlock may have set it) or the queue item.
  const currentMask = ($("maskEar") && $("maskEar").value !== "off" && $("maskLevel"))
    ? $("maskLevel").value : (q.maskerLevel != null ? q.maskerLevel : "");
  maskInput.value = currentMask;
  lvlInput.focus?.();

  const start = $("listLevelStart");
  start.onclick = () => {
    // Apply level.
    const newLevel = clampLevel(Number(lvlInput.value));
    if (Number.isFinite(newLevel)) q.levelDbA = newLevel;
    // Apply masker: blank/empty => off; a number => on at that level to the
    // non-test ear (the block already set maskEar; leave it if present).
    if (maskInput.value === "" || maskInput.value == null) {
      if ($("maskEar")) { $("maskEar").value = "off"; }
    } else if ($("maskLevel") && $("maskEar")) {
      $("maskLevel").value = clampLevel(Number(maskInput.value));
      if ($("maskEar").value === "off") {
        $("maskEar").value = q.maskEar || (($("stimEar") && $("stimEar").value === "left") ? "right" : "left");
      }
    }
    if (typeof syncMaskerControls === "function") syncMaskerControls();
    state.awaitingListLevelConfirm = false;
    dlg.close();
    // Now start the masker (if any) and play the first word.
    renderQueue();
    renderTrial();            // re-render with the applied level; auto-play now runs
    startMaskerIfNeeded();
    saveSession();
  };
  if (typeof dlg.showModal === "function") dlg.showModal();
}

function currentQueueItem() { return state.queue[state.currentListIndex]; }
function currentTrial() { return state.currentTrials[state.currentTrialIndex]; }

function renderTrial() {
  clearScoring();
  const trial = currentTrial();
  const q = currentQueueItem();
  if (!trial || !q) return;
  const L = lang();
  ensureTrialTrainingVariant(trial);
  const word = trial.word[0];
  const phonemes = wordPhonemes(trial.word);
  const translation = L.hasTranslation ? (trial.word[trial.word.length - 1] || "") : "";
  $("currentWord").innerHTML = `${word}${translation ? `<span class="kupu-translation">${translation}</span>` : ""}`;
  const c = $("presentationCondition") ? $("presentationCondition").value : $("stimEar").value;
  const trainingTag = trainingActive() ? `🎓 ${state.training.name} — ` : "";
  const noRecording = trainingActive() && !trial.trainingFile ? ` <b>(no training recording for this ${L.unit})</b>` : "";
  const listLabel = adaptiveActive()
    ? `${state.adaptive.procedure} adaptive`
    : `List ${q.listNumber}`;
  const levelLabel = adaptiveActive() ? `${Number(q.levelDbA).toFixed(1)}` : `${q.levelDbA}`;
  $("currentMeta").innerHTML = `${trainingTag}${listLabel}, ${levelLabel} dB(A), trial ${state.currentTrialIndex + 1} of ${state.currentTrials.length} — <span class="condition-chip" title="Click to change condition">${conditionLabel(c)}</span>${noRecording}`;
  const conditionChip = $("currentMeta").querySelector(".condition-chip");
  if (conditionChip) conditionChip.onclick = openConditionDialog;
  if ($("phonemeHeading")) $("phonemeHeading").textContent = `Phoneme scoring - ${word}`;
  if ($("replayResponseBtn")) $("replayResponseBtn").hidden = !(trainingActive() && trial.trainingFile);
  updateLevelDisplay();
  renderTargetPhonemes(phonemes);
  if (L.hasAdvanced) renderAdvanced(phonemes);
  renderSelectionColours();
  renderQueue();
  renderTrialNavigator();
  scheduleAutoplay();
}

function scheduleAutoplay() {
  // Let the UI paint first, then play the carrier phrase + kupu.
  // For the first kupu in a list, if masking is active, give the masker at least 3 seconds first.
  const maskerOn = $("maskEar").value !== "off";
  const needsMaskerLeadIn = maskerOn && !state.firstTrialMaskerPrimed && state.currentTrialIndex === 0;
  const delay = needsMaskerLeadIn ? 3100 : 250;
  if (needsMaskerLeadIn) state.firstTrialMaskerPrimed = true;

  // Hold the first word entirely if a pre-list level confirmation is pending
  // (non-adaptive lists). Not scheduling avoids any race with the confirm handler.
  if (state.awaitingListLevelConfirm) return;
  setTimeout(() => {
    if (state.awaitingListLevelConfirm) return;
    if ($("screen-test").classList.contains("active")) playCurrent(true);
  }, delay);
}

function renderTrialNavigator() {
  const box = $("trialNavigator");
  if (!box) return;
  box.innerHTML = "";
  if (!state.currentTrials || !state.currentTrials.length) return;

  state.currentTrials.forEach((trial, idx) => {
    const resultIdx = state.currentResultIndexByTrial?.[idx];
    const result = Number.isFinite(resultIdx) ? state.results[resultIdx] : null;
    const item = document.createElement("div");
    item.className = "trial-nav-item" + (idx === state.currentTrialIndex ? " current" : "") + (result ? " done" : "");
    const denom = result ? (result.phonemeCount || result.targetPhonemes?.length || 4) : phonemeCount();
    const scoreText = result ? `${result.score}/${denom}` : idx === state.currentTrialIndex ? "now" : "—";
    const scoreClass = result ? (result.score >= Math.ceil(denom * 0.75) ? "good" : "bad") : "";
    item.innerHTML = `<span>${idx + 1}</span><span>${trial.word[0]}</span><span class="trial-nav-score ${scoreClass}">${scoreText}</span>`;
    item.onclick = () => {
      if (idx === state.currentTrialIndex) {
        // Replay current word — cancel any pending advance first
        cancelPendingAdvance();
        playCurrent(true);
      } else if (result || idx > state.currentTrialIndex) {
        // Jump to this trial — save current score first if pending, then jump
        cancelPendingAdvance();
        // Save current trial's score before jumping
        const curTrial = currentTrial();
        const curQ = currentQueueItem();
        if (curTrial && curQ && state.scoringMode !== "none") {
          const targets = wordPhonemes(curTrial.word);
          const score = computeCurrentScore();
          const payload = {
            timestamp: new Date().toISOString(),
            client: state.client,
            language: curQ.language || state.language,
            listNumber: curQ.listNumber,
            listLevelDbA: curQ.levelDbA,
            presentationCondition: $("presentationCondition") ? $("presentationCondition").value : $("stimEar").value,
            stimulusEar: $("stimEar").value,
            transducer: $("transducer") ? $("transducer").value : "",
            maskerEar: $("maskEar").value,
            maskerLevelDbA: maskerLevel(),
            trialOrder: curTrial.order,
            presentedWord: curTrial.word[0],
            targetPhonemes: targets,
            phonemeCount: targets.length,
            scoringMode: state.scoringMode,
            responsePhonemes: state.scoringMode === "fast" ? blankResponses() : [...state.responseSelections],
            selectedTargetCorrectness: state.scoringMode === "fast" ? blankSelections() : [...state.targetSelections],
            score,
            percent: Math.round((score / targets.length) * 100),
            maskerLevelReport: $("maskEar").value === "off" ? "none" : maskerLevel(),
            comment: $("trialComment").value.trim(),
            presentationSetup: presentationSetupStamp()
          };
          const existingIdx = state.currentResultIndexByTrial[state.currentTrialIndex];
          if (Number.isFinite(existingIdx)) {
            state.results[existingIdx] = payload;
          } else {
            state.results.push(payload);
            state.currentResultIndexByTrial[state.currentTrialIndex] = state.results.length - 1;
          }
        }
        state.currentTrialIndex = idx;
        renderTrial();
        refreshPI();
        updateRunningScore();
        saveSession();
      }
    };
    box.appendChild(item);
  });
}

function renderTargetPhonemes(phonemes) {
  const row = $("targetPhonemes");
  row.innerHTML = "";
  // Match the column count to the phoneme count so 3 English tiles fill the row.
  row.style.gridTemplateColumns = `repeat(${phonemes.length}, 1fr)`;
  phonemes.forEach((p, idx) => {
    const div = document.createElement("div");
    div.className = "phoneme-target";
    div.textContent = p;
    div.onclick = () => {
      state.scoringMode = "phoneme";
      state.targetSelections[idx] = !state.targetSelections[idx];
      div.classList.toggle("selected", state.targetSelections[idx]);
      state.trialScore = computeCurrentScore();
      markScoreButton();
      renderSelectionColours();
    };
    row.appendChild(div);
  });
}

function renderAdvanced(targets) {
  const box = $("advancedColumns");
  box.innerHTML = "";
  box.style.gridTemplateColumns = `repeat(${targets.length}, 1fr)`;
  targets.forEach((target, idx) => {
    const type = idx % 2 === 0 ? "C" : "V";
    const col = document.createElement("div");
    col.className = "advanced-col";
    col.innerHTML = `<h4>${idx + 1}: /${target}/</h4>`;

    function selectOption(p) {
      [...col.querySelectorAll(".phoneme-option, .diphthong-chip")].forEach(x =>
        x.classList.remove("selected", "correct-selected", "incorrect-selected")
      );
      state.scoringMode = "advanced";
      state.responseSelections[idx] = p === "–" ? "–" : p;
      state.targetSelections[idx] = false;
      state.trialScore = computeCurrentScore();
      markScoreButton();
      renderSelectionColours();
    }

    ["–", ...PHONEMES[type]].forEach(p => {
      const btn = document.createElement("div");
      btn.className = "phoneme-option" + (p === "–" ? " blank-option" : "");
      btn.textContent = p;
      btn.title = p === "–" ? "Blank / no response for this position" : "";
      btn.onclick = () => {
        btn.classList.add("selected");
        selectOption(p);
      };
      col.appendChild(btn);
    });

    // Diphthong builder — V columns only (positions 2 and 4)
    if (type === "V") {
      const divider = document.createElement("div");
      divider.className = "diphthong-divider";
      divider.textContent = "＋ diphthong";
      divider.onclick = () => {
        if (col._diphthongBuildMode) {
          // Cancel build mode
          col._diphthongBuildMode = false;
          col._diphthongFirst = null;
          col.querySelectorAll(".phoneme-option").forEach(b => {
            b.classList.remove("diphthong-first-selected");
            if (b._origOnclick) { b.onclick = b._origOnclick; b._origOnclick = null; }
          });
          divider.classList.remove("active");
          divider.textContent = "＋ diphthong";
        } else {
          // Enter build mode — next vowel click = first component
          col._diphthongBuildMode = true;
          divider.classList.add("active");
          divider.textContent = "select 1st vowel…";
          col.querySelectorAll(".phoneme-option:not(.blank-option)").forEach(btn => {
            btn._origOnclick = btn.onclick;
            btn.onclick = () => {
              const baseShort = V_EQ[btn.textContent] || btn.textContent;
              col._diphthongFirst = baseShort;
              col.querySelectorAll(".phoneme-option").forEach(b => b.classList.remove("diphthong-first-selected"));
              btn.classList.add("diphthong-first-selected");
              divider.textContent = `/${baseShort}/ + select 2nd…`;
              // Re-wire all vowel buttons for second component
              col.querySelectorAll(".phoneme-option:not(.blank-option)").forEach(btn2 => {
                btn2.onclick = () => {
                  const base2 = V_EQ[btn2.textContent] || btn2.textContent;
                  const combo = baseShort + base2;
                  col._diphthongFirst = null;
                  col._diphthongBuildMode = false;
                  divider.classList.remove("active");
                  divider.textContent = "＋ diphthong";
                  col.querySelectorAll(".phoneme-option").forEach(b => {
                    b.classList.remove("diphthong-first-selected");
                    if (b._origOnclick) { b.onclick = b._origOnclick; b._origOnclick = null; }
                  });
                  renderDiphthongChip(col, combo, idx, selectOption);
                  selectOption(combo);
                };
              });
            };
          });
        }
      };
      col.appendChild(divider);

      const chipArea = document.createElement("div");
      chipArea.className = "diphthong-chip-area";
      col._chipArea = chipArea;
      col.appendChild(chipArea);
    }

    box.appendChild(col);
  });
}

function renderDiphthongChip(col, combo, idx, selectOption) {
  const chipArea = col._chipArea;
  if (!chipArea) return;
  chipArea.innerHTML = "";
  const chip = document.createElement("div");
  chip.className = "diphthong-chip";
  chip.textContent = combo;
  chip.title = `Diphthong /${combo}/ — click to clear`;
  chip.onclick = () => {
    chipArea.innerHTML = "";
    state.responseSelections[idx] = null;
    state.trialScore = computeCurrentScore();
    markScoreButton();
    renderSelectionColours();
  };
  chipArea.appendChild(chip);
}

function isDiphthong(p) {
  // Two bare vowels joined, e.g. "au", "ai", "ei" — no macrons
  return typeof p === "string" && /^[aeiou]{2}$/.test(p);
}

function equivalent(target, response) {
  if (!response || response === "–") return false;
  // Diphthongs must match exactly (au ≠ ao)
  if (isDiphthong(target) || isDiphthong(response)) return target === response;
  // Long/short vowel equivalence
  if (V_EQ[target] && V_EQ[response]) return V_EQ[target] === V_EQ[response];
  return target === response;
}

function computeAdvancedScore(targets, responses) {
  return targets.reduce((sum, t, i) => sum + (equivalentForScoring(t, responses[i]) ? 1 : 0), 0);
}

function computeCurrentScore() {
  if (state.scoringMode === "fast") return Number(state.trialScore ?? 0);

  const trial = currentTrial();
  if (!trial) return 0;
  const targets = wordPhonemes(trial.word);
  let score = 0;
  targets.forEach((target, idx) => {
    const advanced = state.responseSelections[idx];
    if (advanced !== null && advanced !== undefined && advanced !== "") {
      if (equivalentForScoring(target, advanced)) score++;
    } else if (state.targetSelections[idx]) {
      score++;
    }
  });
  return score;
}

function renderSelectionColours() {
  const trial = currentTrial();
  if (!trial) return;
  const targets = wordPhonemes(trial.word);
  const fastAllCorrect = state.scoringMode === "fast" && Number(state.trialScore) === phonemeCount();

  document.querySelectorAll(".phoneme-target").forEach((el, idx) => {
    const advanced = state.responseSelections[idx];
    const topSelected = !!state.targetSelections[idx];
    const advancedChosen = !!advanced;

    if (state.scoringMode === "fast") {
      el.classList.toggle("selected", fastAllCorrect);
      el.classList.toggle("correct-selected", fastAllCorrect);
      el.classList.toggle("incorrect-selected", false);
      return;
    }

    el.classList.toggle("selected", topSelected || advancedChosen);
    el.classList.toggle("correct-selected", topSelected || (advancedChosen && equivalentForScoring(targets[idx], advanced)));
    el.classList.toggle("incorrect-selected", advancedChosen && !equivalentForScoring(targets[idx], advanced));
  });

  document.querySelectorAll(".advanced-col").forEach((col, idx) => {
    const target = targets[idx];
    const explicitResponse = state.responseSelections[idx];

    col.querySelectorAll(".phoneme-option").forEach(btn => {
      const p = btn.textContent;
      const isChosen = explicitResponse === p;
      const isTopSelected = state.scoringMode !== "fast" && !explicitResponse && state.targetSelections[idx] && equivalentForScoring(target, p);
      const fastCorrect = fastAllCorrect && equivalentForScoring(target, p);

      btn.classList.toggle("selected", isChosen);
      btn.classList.toggle("correct-selected", (isChosen && equivalentForScoring(target, p)) || isTopSelected || fastCorrect);
      btn.classList.toggle("incorrect-selected", isChosen && !equivalentForScoring(target, p));
    });

    // Colour the diphthong chip if present
    const chip = col.querySelector(".diphthong-chip");
    if (chip) {
      const isChosen = explicitResponse === chip.textContent;
      chip.classList.toggle("selected", isChosen);
      chip.classList.toggle("correct-selected", isChosen && equivalentForScoring(target, chip.textContent));
      chip.classList.toggle("incorrect-selected", isChosen && !equivalentForScoring(target, chip.textContent));
    }
  });
}

function markScoreButton() {
  document.querySelectorAll(".score-buttons button").forEach(btn => {
    btn.classList.toggle("fast-selected", Number(btn.dataset.score) === state.trialScore);
  });
}

function clearScoring() {
  state.trialScore = null;
  state.scoringMode = "none";
  state.targetSelections = blankSelections();
  state.responseSelections = blankResponses();
  $("trialComment").value = "";
  document.querySelectorAll(".phoneme-target,.phoneme-option").forEach(x => x.classList.remove("selected", "correct-selected", "incorrect-selected"));
  document.querySelectorAll(".diphthong-chip-area").forEach(a => a.innerHTML = "");
  document.querySelectorAll(".advanced-col").forEach(col => {
    col._diphthongFirst = null;
    col._diphthongBuildMode = false;
  });
  document.querySelectorAll(".diphthong-divider").forEach(d => {
    d.classList.remove("active");
    d.textContent = "＋ diphthong";
  });
  markScoreButton();
}

async function playCurrent(withCarrier) {
  stopCurrentStimulusIfAny();
  const trial = currentTrial();
  const q = currentQueueItem();
  if (!trial || !q) return;
  const L = lang();
  const word = trial.word[0];
  // English resolves audio from sounds_cvc/ by its NNNN_Word file stem (col 4).
  // Recordings are all .mp3; word casing varies between files, so we try a few
  // case variants. Māori resolves by the word from sounds/.
  const stem = trial.word[4] || word;
  const stimBases = L.hasCarrier ? [word] : englishCandidates(stem);
  const level = q.levelDbA;
  const ear = $("stimEar").value;
  // No per-call gain adjustment here: the CVC file gain adjustment is applied by
  // folder inside the play path (any sounds_cvc/ file is pulled down; the te reo
  // carrier and kupu in sounds/ are not). See fileGainAdjustDb().

  // In training mode (Māori only), the client's recorded response follows the kupu.
  const chainResponse = (kupuNode) => {
    if (!trainingActive() || !trial.trainingFile) return;
    kupuNode.el.addEventListener("ended", () => {
      setTimeout(() => {
        if ($("screen-test").classList.contains("active")) playClientResponse();
      }, 600);
    }, { once: true });
  };

  try {
    if (withCarrier && L.hasCarrier) {
      // Māori: play a randomly chosen kōrero-mai carrier, then the kupu.
      const carrier = await playFirstAvailable([pickKoreroMai()], ear, level, false);
      carrier.el.addEventListener("ended", async () => {
        try {
          const kupu = await playFirstAvailable(stimBases, ear, level, false);
          chainResponse(kupu);
        } catch {}
      }, { once: true });
    } else {
      // English: carrier is embedded in the file — just play the file.
      const kupu = await playFirstAvailable(stimBases, ear, level, false);
      chainResponse(kupu);
    }
  } catch {
    const where = L.hasCarrier ? "/sounds" : `/${ENGLISH_SOUND_DIR}`;
    alert(`Could not play ${word}. Check the file exists in ${where}.`);
  }
}

function setMaskerIndicator(isOn) {
  const el = $("maskerStatus");
  if (!el) return;
  el.classList.toggle("on", !!isOn);
  el.classList.toggle("off", !isOn);
  el.textContent = isOn ? "Masker playing" : "Masker off";
}

function setStimulusIndicator(isOn, label) {
  const el = $("stimulusStatus");
  if (!el) return;
  el.classList.toggle("on", !!isOn);
  el.classList.toggle("off", !isOn);
  el.textContent = isOn ? (label || "Kupu playing") : "Kupu idle";
}

function syncMaskerControls() {
  if ($("maskLevelLive")) $("maskLevelLive").value = $("maskLevel").value;
  if ($("maskEarLive")) $("maskEarLive").value = $("maskEar").value;
}

function updateLiveMasker() {
  syncMaskerControls();
  const maskVal = $("maskEar").value;
  if (state.audio.masker) {
    // Honour "off" FIRST. Previously the routing line ran before the off-check,
    // so an "off" masker was momentarily re-routed binaurally (pan 0 = both
    // channels) — pushing masker noise into the TEST-ear channel for a frame
    // before it stopped. Stop first, route only when actually on.
    if (maskVal === "off") { stopMasker(); saveSession(); return; }
    state.audio.masker.gain.gain.value = gainForLevel(maskerLevel(), maskerNoiseAdjustDb(), maskEarSide());
    // Route the masker to its ear only. A masker ear of exactly "left"/"right"
    // maps to a single channel; never fall through to binaural here, or the
    // masker would leak into the test-ear channel.
    state.audio.masker.pan.pan.value = maskVal === "left" ? -1 : maskVal === "right" ? 1 : 0;
    setMaskerIndicator(true);
  } else if (maskVal !== "off" && $("screen-test").classList.contains("active")) {
    startMasker();
  }
  saveSession();
}

async function startMaskerIfNeeded() {
  stopMasker();
  if ($("maskEar").value !== "off") await startMasker();
}

async function startMasker() {
  if (state.audio.masker) return;
  try {
    const ctx = ensureAudio();
    const buffer = await decodeFirstAvailable(["noise","masking"]);
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();

    source.buffer = buffer;
    source.loop = true;
    gain.gain.value = gainForLevel(maskerLevel(), maskerNoiseAdjustDb(), maskEarSide());
    const maskEarVal = $("maskEar").value;
    // Same splitter/merger ear routing as the stimulus path, so the masker's
    // in-ear level matches its on-screen dB regardless of ear (no panner boost).
    const pan = makeEarRouter(ctx, gain, maskEarVal === "left" ? "left" : maskEarVal === "right" ? "right" : "binaural");

    source.connect(gain);
    source.start();

    state.audio.masker = { bufferSource: source, gain, pan, isBufferLoop: true };
    $("toggleMaskBtn").textContent = "Stop masker";
    setMaskerIndicator(true);
  } catch {
    try {
      state.audio.masker = await playFirstAvailable(["noise","masking"], $("maskEar").value, maskerLevel(), true);
      $("toggleMaskBtn").textContent = "Stop masker";
      setMaskerIndicator(true);
    } catch {
      $("toggleMaskBtn").textContent = "Start masker";
      setMaskerIndicator(false);
    }
  }
}

function stopMasker() {
  if (state.audio.masker) {
    if (state.audio.masker.isBufferLoop) {
      try { state.audio.masker.bufferSource.stop(); } catch {}
      try { state.audio.masker.bufferSource.disconnect(); } catch {}
    } else if (state.audio.masker.el) {
      state.audio.masker.el.pause();
      state.audio.masker.el.currentTime = 0;
      try { state.audio.masker.el.removeAttribute("src"); state.audio.masker.el.load(); } catch {}
    }
    // Release the masker's gain + ear-router subgraph too (it restarts each
    // position; without this the routers accumulate across a session).
    try { state.audio.masker.gain && state.audio.masker.gain.disconnect(); } catch {}
    try { state.audio.masker.pan && typeof state.audio.masker.pan.disconnect === "function" && state.audio.masker.pan.disconnect(); } catch {}
    state.audio.masker = null;
  }
  $("toggleMaskBtn").textContent = "Start masker";
  setMaskerIndicator(false);
}

function toggleMasker() {
  syncMaskerControls();
  if (state.audio.masker) stopMasker();
  else startMasker();
}

function nudgeMasker(delta) {
  const newVal = clampLevel((Number($("maskLevelLive").value) || 40) + delta);
  $("maskLevelLive").value = newVal;
  $("maskLevel").value = newVal;
  updateLiveMasker();
}

function nudgeLevel(delta) {
  const q = currentQueueItem();
  if (!q) return;
  // In adaptive mode the engine owns the level; manual nudges are disabled.
  if (adaptiveActive()) { flashLevelLimit("The adaptive procedure sets the level automatically."); return; }
  const newLevel = clampLevel(q.levelDbA + delta);
  if (newLevel === q.levelDbA) {
    // At a bound: no change to make. Say why, and don't fire the discard prompt
    // on a keypress that was never going to change anything.
    const b = levelBounds();
    if (b) {
      flashLevelLimit(newLevel >= b.max
        ? `${b.max} dB(A) is the calibration reference — to go higher, ${moreLevelAdvice()}.`
        : `${b.min} dB(A) is the bottom of the range — to go lower, ${lessLevelAdvice()}.`);
    }
    return;
  }
  const qLang = q.language || "maori";

  // Check if results exist for the current list (this language, list & level)
  const listHasResults = state.results.some(r =>
    r.listNumber === q.listNumber && r.listLevelDbA === q.levelDbA && (r.language || "maori") === qLang
  );

  if (listHasResults) {
    const ok = confirm(
      `Changing level from ${q.levelDbA} to ${newLevel} dB will discard results for this list. Continue?`
    );
    if (!ok) return;
    // Mark current list abandoned, remove its results, create new queue entry
    q.status = "abandoned";
    state.results = state.results.filter(r =>
      !(r.listNumber === q.listNumber && r.listLevelDbA === q.levelDbA && (r.language || "maori") === qLang)
    );
    const newEntry = {
      listNumber: q.listNumber,
      levelDbA: newLevel,
      language: qLang,
      status: "in-progress",
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now())
    };
    state.queue.splice(state.currentListIndex + 1, 0, newEntry);
    state.currentListIndex++;
    state.currentTrials = [...state.currentTrials]; // keep same trial order
    state.currentTrialIndex = 0;
    state.currentResultIndexByTrial = {};
  } else {
    q.levelDbA = newLevel;
  }

  updateLevelDisplay();
  renderTrial();
  refreshPI();
  saveSession();
}

function updateLevelDisplay() {
  const q = currentQueueItem();
  if (!q) return;
  const el = $("levelNudgeLabel");
  if (el) el.textContent = adaptiveActive() ? Number(q.levelDbA).toFixed(1) : String(q.levelDbA);

  const b = levelBounds();
  if (adaptiveActive()) {
    // Engine owns the level; disable manual nudges but keep the display live.
    if ($("levelDownBtn")) $("levelDownBtn").disabled = true;
    if ($("levelUpBtn"))   $("levelUpBtn").disabled   = true;
  } else {
    if ($("levelDownBtn")) $("levelDownBtn").disabled = !!b && q.levelDbA <= b.min;
    if ($("levelUpBtn"))   $("levelUpBtn").disabled   = !!b && q.levelDbA >= b.max;
  }

  const risk = combinedClippingRisk();
  if (risk) {
    flashLevelLimit(
      `Stimulus and masker together exceed full output by ${risk.overshootDb.toFixed(1)} dB ` +
      `— both will distort. Lower one of the two levels, or ${moreLevelAdvice()}.`
    );
  }

  updateRunningScore();
  refreshPI();
}

function updateRunningScore() {
  const el = $("runningScore");
  if (!el) return;
  if (adaptiveActive()) {
    const a = state.adaptive;
    el.textContent = `${a.session.done}/${a.session.total} words`;
    return;
  }
  const q = currentQueueItem();
  if (!q) { el.textContent = "—"; return; }
  const listResults = state.results.filter(r =>
    r.listNumber === q.listNumber && r.listLevelDbA === q.levelDbA &&
    (r.language || "maori") === (q.language || "maori")
  );
  if (!listResults.length) { el.textContent = "—"; return; }
  const correct = listResults.reduce((sum, r) => sum + Number(r.score || 0), 0);
  const total = listResults.reduce((sum, r) => sum + (r.phonemeCount || r.targetPhonemes?.length || 4), 0);
  const pct = Math.round((correct / total) * 100);
  el.textContent = `${correct}/${total} phonemes · ${pct}%`;
}

function nextTrial() {
  // Training mode: evaluate the trainee's scoring before advancing.
  if (trainingActive() && !state._trainingBypass) {
    cancelPendingAdvance();
    handleTrainingNext();
    return;
  }

  // Re-entrancy lockout: ignore a second advance while one is already running.
  // This stops a manual "Next" tap from stacking on top of the auto-advance
  // timer (or a double-tap) and skipping the trial in between.
  if (state._advancing) return;

  const trial = currentTrial();
  const q = currentQueueItem();
  if (!trial || !q) return;

  // Don't advance off an unscored trial. The auto-advance only fires *after*
  // a score is entered, so this blocks only stray manual/double "Next" presses
  // that would otherwise skip a trial and silently record it as 0.
  // (Training bypass has already validated/recorded a score, so it's exempt.)
  const alreadyHasResult = Number.isFinite(state.currentResultIndexByTrial[state.currentTrialIndex]);
  if (!state._trainingBypass && state.scoringMode === "none" && !alreadyHasResult) {
    flashNextLocked();
    return;
  }

  state._advancing = true;
  try {
    advanceTrialNow(trial, q);
  } finally {
    state._advancing = false;
  }
}

// The actual record-and-advance, separated so the lockout/guard logic above
// stays readable.
function advanceTrialNow(trial, q) {
  const targets = wordPhonemes(trial.word);
  const score = computeCurrentScore();
  const resultPayload = {
    timestamp: new Date().toISOString(),
    client: state.client,
    language: q.language || state.language,
    listNumber: q.listNumber,
    listLevelDbA: q.levelDbA,
    presentationCondition: $("presentationCondition") ? $("presentationCondition").value : $("stimEar").value,
    stimulusEar: $("stimEar").value,
    transducer: $("transducer") ? $("transducer").value : "",
    maskerEar: $("maskEar").value,
    maskerLevelDbA: maskerLevel(),
    trialOrder: trial.order,
    presentedWord: trial.word[0],
    targetPhonemes: targets,
    phonemeCount: targets.length,
    scoringMode: state.scoringMode,
    responsePhonemes: state.scoringMode === "fast" ? blankResponses() : [...state.responseSelections],
    selectedTargetCorrectness: state.scoringMode === "fast" ? blankSelections() : [...state.targetSelections],
    score,
    percent: Math.round((score / targets.length) * 100),
    maskerLevelReport: $("maskEar").value === "off" ? "none" : maskerLevel(),
    comment: $("trialComment").value.trim(),
    ...(trainingActive() ? {
      training: true,
      trainingClientId: state.training.id,
      trainingFile: trial.trainingFile || null,
      trueResponsePhonemes: trial.trainingResponse || null,
      trueScore: Number.isFinite(trial.trainingTrueScore) ? trial.trainingTrueScore : null,
      attempts: (trial.trainingAttempts || 0) + 1,
      revealed: !!trial.trainingRevealed
    } : {})
  };

  // Adaptive runs tag each result with the procedure and the track that
  // produced this word, so the stored trial data is self-describing.
  if (adaptiveActive()) {
    const cur = state.adaptive.session.current();
    resultPayload.adaptive = true;
    resultPayload.adaptiveProcedure = state.adaptive.procedure;
    resultPayload.sourceList = (trial.sourceList != null) ? trial.sourceList : null;
    if (cur) { resultPayload.adaptiveTrack = cur.trackId; resultPayload.adaptivePTarget = cur.pTarget; }
  }
  resultPayload.presentationSetup = presentationSetupStamp();

  const existingIdx = state.currentResultIndexByTrial[state.currentTrialIndex];
  if (Number.isFinite(existingIdx)) {
    state.results[existingIdx] = resultPayload;
  } else {
    state.results.push(resultPayload);
    state.currentResultIndexByTrial[state.currentTrialIndex] = state.results.length - 1;
  }

  // ── Adaptive branch: the engine drives the level and the finish. ──
  if (adaptiveActive()) {
    state.currentTrialIndex++;
    adaptiveOnResult(resultPayload);   // steps the level or finishes the track
    if (!state.adaptive || !state.adaptive.session.finished) renderTrial();
    updateRunningScore();
    updateSetupResultsSummary();
    saveSession();
    return;
  }

  state.currentTrialIndex++;
  // Skip over any trials that already have a score (jumped-to trials filled in earlier)
  while (
    state.currentTrialIndex < state.currentTrials.length &&
    Number.isFinite(state.currentResultIndexByTrial[state.currentTrialIndex])
  ) {
    state.currentTrialIndex++;
  }
  if (state.currentTrialIndex >= state.currentTrials.length) finishList();
  else {
    renderTrial();
  }
  refreshPI();
  updateRunningScore();
  updateSetupResultsSummary();
  saveSession();
}

function finishList() {
  // Find the first trial that has no recorded result yet
  const firstUnscored = state.currentTrials.findIndex((_, idx) =>
    !Number.isFinite(state.currentResultIndexByTrial[idx])
  );

  if (firstUnscored >= 0) {
    // There are gaps — jump to the first unscored trial
    state.currentTrialIndex = firstUnscored;
    renderTrial();
    return;
  }

  // All trials scored — truly done
  const q = currentQueueItem();
  q.status = "complete";
  stopMasker();
  renderQueue();
  saveSession();

  // Training: show the performance summary first; continue on close.
  if (trainingActive() && showTrainingSummary()) return;

  finishListProceed();
}

function finishListProceed() {
  const next = state.queue.findIndex(x => x.status === "queued");
  if (next >= 0) {
    const proceed = confirm(`List complete. Start next queued list (List ${state.queue[next].listNumber} @ ${state.queue[next].levelDbA} dB)?`);
    if (proceed) {
      state.currentListIndex = next;
      beginCurrentList();
      return;
    }
  } else {
    // If this was an experiment-driven non-adaptive comparison block, hand back to
    // the harness to record it and advance to the next block / completion — don't
    // drop to the setup screen (mirrors the adaptive summary hand-off).
    const naExperiment = (typeof window !== "undefined" && window.Experiment &&
      window.Experiment.isExperimentUnlocked && window.Experiment.isExperimentUnlocked() &&
      state.experiment && state.experiment.naRunning &&
      typeof window.Experiment.onNonAdaptiveFinished === "function" &&
      state.queue.every(q => q.nonAdaptive));
    if (naExperiment) {
      updateSetupResultsSummary();
      try { window.Experiment.onNonAdaptiveFinished(); }
      catch (e) { console.error("[experiment] onNonAdaptiveFinished:", e); }
      return;
    }
    alert("All queued lists complete. Results are being saved automatically.");
    autoSaveJson();
  }
  updateSetupResultsSummary();
  show("screen-setup");
}

// Build and show the end-of-list training performance summary.
// Returns true if the dialog was shown (finishListProceed runs on close).
function showTrainingSummary() {
  const dlg = $("trainingSummaryDialog");
  if (!dlg) return false;

  // This run's results, in trial order
  const entries = Object.keys(state.currentResultIndexByTrial)
    .map(k => state.results[state.currentResultIndexByTrial[k]])
    .filter(Boolean);

  // Only trials that actually had a recording count toward scoring accuracy
  const scored = entries.filter(e => e.training && e.trainingFile);
  if (!scored.length) return false;

  const total = scored.length;
  const firstTry = scored.filter(e => e.attempts === 1);
  const revealed = scored.filter(e => e.revealed);
  const retried = scored.filter(e => e.attempts > 1 && !e.revealed);
  const pct = Math.round((firstTry.length / total) * 100);

  // Count the teaching-moment phonemes this list contained
  let dialectCount = 0, lengthCount = 0;
  for (const e of scored) {
    if (!e.trueResponsePhonemes) continue;
    for (const pos of evaluateTrainingPositions(e.targetPhonemes, e.trueResponsePhonemes)) {
      if (pos.type === "dialect") dialectCount++;
      if (pos.type === "length") lengthCount++;
    }
  }

  const headline =
    pct === 100 ? "Ka rawe! Perfect scoring — every kupu right on the first attempt." :
    pct >= 80   ? "Ka pai! Strong scoring accuracy." :
    pct >= 50   ? "Good progress — keep practising." :
                  "Keep at it — scoring accuracy builds with practice.";

  let body = `<p class="tf-summary">${headline}</p>` +
    `<div class="tf-row ok"><span class="tf-phon">${firstTry.length}/${total}</span><span>kupu scored correctly on the first attempt (${pct}%).</span></div>`;

  if (retried.length) {
    const items = retried.map(e => `${e.presentedWord} (${e.attempts} attempts)`).join(", ");
    body += `<div class="tf-row note"><span class="tf-phon">${retried.length}</span><span>needed another listen: ${items}.</span></div>`;
  }
  if (revealed.length) {
    const items = revealed.map(e => `${e.presentedWord}`).join(", ");
    body += `<div class="tf-row bad"><span class="tf-phon">${revealed.length}</span><span>answer revealed: ${items} — worth replaying these in a future session.</span></div>`;
  }
  if (dialectCount || lengthCount) {
    const bits = [];
    if (dialectCount) bits.push(`${dialectCount} regional-variant phoneme${dialectCount !== 1 ? "s" : ""}`);
    if (lengthCount) bits.push(`${lengthCount} vowel-length case${lengthCount !== 1 ? "s" : ""}`);
    body += `<div class="tf-row note"><span class="tf-phon">📚</span><span class="tf-teach">This list included ${bits.join(" and ")} — these score as correct.</span></div>`;
  }

  const skipped = entries.filter(e => e.training && !e.trainingFile).length;
  if (skipped) {
    body += `<p class="hint">${skipped} kupu had no training recording and ${skipped !== 1 ? "were" : "was"} excluded from these figures.</p>`;
  }

  $("tsTitle").textContent = `Training summary — ${state.training.name}`;
  $("tsBody").innerHTML = body;
  dlg.addEventListener("close", () => finishListProceed(), { once: true });
  dlg.showModal();
  return true;
}

function abandonList() {
  const q = currentQueueItem();
  if (!q) return;
  q.status = "abandoned";
  if (state.adaptive) state.adaptive = null;   // drop any live adaptive engine
  stopMasker();
  // Let experiment mode mark this position aborted (✗) if it drove the track.
  if (typeof window !== "undefined" && window.Experiment &&
      typeof window.Experiment.onTrackAborted === "function") {
    try { window.Experiment.onTrackAborted(); } catch (e) { console.error("[experiment] onTrackAborted:", e); }
  }
  saveSession();
  if (state.results?.length) autoSaveJson();
  renderQueue();
  renderRecentSessions();
  updateSetupResultsSummary();
  show("screen-setup");
}

function listSummaries() {
  const map = new Map();
  for (const r of state.results) {
    if (r.adaptive) continue;   // adaptive trials are summarised per track, not per list/level
    const condition = r.presentationCondition || r.stimulusEar;
    const masked = r.maskerEar && r.maskerEar !== "off";
    const language = r.language || "maori";
    const key = `${language}|${r.listNumber}|${r.listLevelDbA}|${condition}|${masked}`;
    if (!map.has(key)) map.set(key, { language, listNumber: r.listNumber, level: r.listLevelDbA, condition, ear: condition, masked, trials: 0, phonemes: 0, phonemeTotal: 0 });
    const s = map.get(key);
    s.trials++;
    s.phonemes += Number(r.score || 0);
    s.phonemeTotal += (r.phonemeCount || r.targetPhonemes?.length || 4);
  }
  return [...map.values()].map(s => ({ ...s, percent: s.phonemeTotal ? Math.round((s.phonemes / s.phonemeTotal) * 100) : 0 }));
}

// Which languages have fixed-level (non-adaptive) results. Adaptive tracks
// get their own report sections, so they don't drive the per-language blocks.
function languagesWithResults() {
  // Count ALL results (adaptive and fixed). Previously this filtered to !r.adaptive,
  // so a purely adaptive session exported languagesPresent: [] — which made the
  // reopened file look empty.
  const set = new Set((state.results || []).map(r => r.language || "maori"));
  return ["maori", "english"].filter(k => set.has(k));
}

// ── Language switching ────────────────────────────────────────────
function repopulateListSelects() {
  const listNums = Object.keys(currentWordLists()).map(Number).sort((a,b)=>a-b);
  [["listChoice"], ["queueListNumber"]].forEach(([id]) => {
    const sel = $(id);
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = "";
    listNums.forEach(i => {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = `List ${i}`;
      sel.appendChild(opt);
    });
    if (listNums.includes(Number(prev))) sel.value = prev;
  });
}

// Reflect the active language across the UI: toggle buttons, terminology,
// available list numbers, and the visibility of Māori-only controls.
function applyLanguageToUI() {
  const L = lang();
  document.querySelectorAll(".language-btn").forEach(b =>
    b.classList.toggle("active", b.dataset.lang === state.language));

  // Stimulus play-button label + terminology
  if ($("playWordBtn")) {
    $("playWordBtn").textContent = L.hasCarrier ? 'Play "Kōrero mai..." + kupu' : "Play word";
  }
  if ($("repeatWordBtn")) {
    $("repeatWordBtn").textContent = L.hasCarrier ? "Replay kupu only" : "Replay word";
    // English has no separate word-only stimulus — replay plays the same file.
    $("repeatWordBtn").title = L.hasCarrier ? "" : "Replays the full recording (carrier is part of the file)";
  }
  if ($("phonemeHeading")) $("phonemeHeading").textContent = "Phoneme scoring";

  // Advanced phoneme selection — Māori only.
  const advancedDetails = document.getElementById("advancedDetails");
  if (advancedDetails) advancedDetails.style.display = L.hasAdvanced ? "" : "none";

  // Training controls — Māori only.
  const trainingControls = document.querySelector(".training-controls");
  if (trainingControls) trainingControls.style.display = L.hasTraining ? "" : "none";

  // Word-order randomise toggle reflects the current language's effective setting.
  const rndToggle = $("randomiseOrderToggle");
  if (rndToggle) {
    rndToggle.checked = randomiseEnabled(state.language);
    const usingDefault = (state.randomiseOverride?.[state.language] ?? null) === null;
    const lbl = $("randomiseOrderLabel");
    if (lbl) lbl.textContent = "Randomise word order" + (usingDefault ? ` (default: ${L.randomiseOrder ? "on" : "off"})` : "");
  }

  repopulateListSelects();
  setupFastScoreButtons();
}

function setLanguage(langKey, opts = {}) {
  if (!LANGUAGES[langKey] || langKey === state.language) {
    applyLanguageToUI();
    return;
  }
  // If switching away from a language that has training active, exit training.
  if (langKey !== "maori" && trainingActive()) exitTraining();
  state.language = langKey;
  // Warm the CVC set now, so it's cached before the first word. Cheap if already
  // done; no-op for te reo, which is warmed eagerly at startup.
  if (langKey === "english") startEnglishPreloadIfNeeded();
  applyLanguageToUI();
  renderQueue();
  if (!opts.silent) saveSession();
}

// Tabs above the PI canvas — shown only when both languages have data.
function renderPiTabs() {
  const box = $("piTabs");
  if (!box) return;
  const withData = languagesWithResults();
  if (withData.length < 2) {
    box.hidden = true;
    box.innerHTML = "";
    // Keep the displayed tab consistent with what's actually plotted.
    state._piTab = withData[0] || null;
    return;
  }
  box.hidden = false;
  const active = activePiLanguage();
  box.innerHTML = "";
  withData.forEach(k => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pi-tab" + (k === active ? " active" : "");
    btn.textContent = LANGUAGES[k].label;
    btn.onclick = () => {
      state._piTab = k;
      renderPiTabs();
      drawPI(k);
    };
    box.appendChild(btn);
  });
}

// Always refresh tabs alongside the plot.
function refreshPI() {
  renderPiTabs();
  drawPI();
}

// Which language the PI canvas is currently showing. Defaults to the
// active test language, falling back to whatever has data.
function activePiLanguage() {
  const withData = languagesWithResults();
  if (state._piTab && withData.includes(state._piTab)) return state._piTab;
  if (withData.includes(state.language)) return state.language;
  return withData[0] || state.language;
}

// Glyph for one plotted point. condition + masking decide the mark.
function drawPiGlyph(ctx, px, py, condition, masked) {
  ctx.save();
  ctx.font = "bold 22px system-ui";
  ctx.textBaseline = "middle";
  if (condition === "left") {
    ctx.fillStyle = "#135bd8";
    if (masked) {
      // Masked left: two ×'s overlapping by 50% of the glyph width, centred on px.
      ctx.textAlign = "center";
      const w = ctx.measureText("×").width;
      const off = w * 0.25; // each × shifted a quarter-width from centre → 50% overlap
      ctx.fillText("×", px - off, py);
      ctx.fillText("×", px + off, py);
    } else {
      ctx.textAlign = "center";
      ctx.fillText("×", px, py);
    }
  } else if (condition === "right") {
    ctx.strokeStyle = "#c52222";
    ctx.fillStyle = "#c52222";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, 8, 0, Math.PI * 2);
    if (masked) ctx.fill();   // masked right: filled circle
    else ctx.stroke();        // unmasked right: open circle
  } else {
    ctx.fillStyle = "#111";
    ctx.textAlign = "center";
    ctx.fillText(conditionSymbol(condition), px, py);
  }
  ctx.restore();
}

function drawPI(forLanguage) {
  const canvas = $("piCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle = "#fff"; ctx.fillRect(0,0,w,h);
  ctx.strokeStyle = "#777"; ctx.lineWidth = 1;
  const left = 50, right = w - 20, top = 20, bottom = h - 45;
  const xOf = lvl => left + (Math.max(0, Math.min(100, lvl)) / 100) * (right - left);
  const yOf = pct => bottom - (Math.max(0, Math.min(100, pct)) / 100) * (bottom - top);

  ctx.beginPath();
  ctx.moveTo(left, top); ctx.lineTo(left, bottom); ctx.lineTo(right, bottom); ctx.stroke();

  ctx.font = "13px system-ui";
  ctx.fillStyle = "#111";
  for (let y = 0; y <= 100; y += 20) {
    const py = yOf(y);
    ctx.strokeStyle = "#ddd"; ctx.beginPath(); ctx.moveTo(left, py); ctx.lineTo(right, py); ctx.stroke();
    ctx.fillStyle = "#111"; ctx.fillText(String(y), 18, py + 4);
  }
  for (let x = 0; x <= 100; x += 20) {
    const px = xOf(x);
    ctx.strokeStyle = "#ddd"; ctx.beginPath(); ctx.moveTo(px, top); ctx.lineTo(px, bottom); ctx.stroke();
    ctx.fillStyle = "#111"; ctx.fillText(String(x), px - 8, bottom + 20);
  }
  ctx.fillText("dB(A)", (left+right)/2 - 18, h - 8);
  ctx.save(); ctx.translate(12, (top+bottom)/2 + 35); ctx.rotate(-Math.PI/2); ctx.fillText("% correct", 0, 0); ctx.restore();

  const plotLang = forLanguage || activePiLanguage();
  const summaries = listSummaries().filter(s => (s.language || "maori") === plotLang);

  // ── Connecting lines ─────────────────────────────────────────────
  // One line per condition (ear), threaded across levels. Where two
  // points share the same level, the masked one wins the line; if the
  // masking state also matches, the most recent wins. Every point is
  // still drawn as its own glyph below — nothing is dropped.
  const byCondition = {};
  for (const s of summaries) {
    const cond = s.condition || s.ear;
    (byCondition[cond] = byCondition[cond] || []).push(s);
  }

  for (const [cond, pts] of Object.entries(byCondition)) {
    // Pick the line-bearing point at each level.
    const bestByLevel = new Map();
    for (const p of pts) {
      const existing = bestByLevel.get(p.level);
      if (!existing) { bestByLevel.set(p.level, p); continue; }
      // masked wins; otherwise keep the one already chosen (latest insertion)
      if (p.masked && !existing.masked) bestByLevel.set(p.level, p);
    }
    const linePts = [...bestByLevel.values()].sort((a, b) => a.level - b.level);
    if (linePts.length >= 2) {
      ctx.save();
      ctx.lineWidth = 2;
      ctx.strokeStyle = cond === "left" ? "#135bd8" : cond === "right" ? "#c52222" : "#444";
      // Left = dashed, right & others = solid.
      ctx.setLineDash(cond === "left" ? [6, 4] : []);
      ctx.beginPath();
      linePts.forEach((p, i) => {
        const px = xOf(p.level), py = yOf(p.percent);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      });
      ctx.stroke();
      ctx.restore();
    }
  }

  // ── Glyphs (all points, always) ──────────────────────────────────
  for (const s of summaries) {
    drawPiGlyph(ctx, xOf(s.level), yOf(s.percent), s.condition || s.ear, s.masked);
  }

  // ── Crosshair: only on the tab matching the active test language ──
  const q = currentQueueItem();
  const showCrosshair = q && $("screen-test").classList.contains("active") &&
    plotLang === (q.language || state.language);
  if (showCrosshair) {
    const clevel = q.levelDbA;
    const listResults = state.results.filter(r =>
      r.listNumber === q.listNumber && r.listLevelDbA === clevel &&
      (r.language || "maori") === (q.language || "maori")
    );
    const correct = listResults.reduce((s,r) => s + Number(r.score||0), 0);
    const total = listResults.reduce((s,r) => s + (r.phonemeCount || r.targetPhonemes?.length || 4), 0);
    const cpct = total ? Math.round((correct / total) * 100) : 0;
    const cx = xOf(clevel);
    const cy = yOf(cpct);

    ctx.save();
    ctx.strokeStyle = "#b31b1b";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(cx, top); ctx.lineTo(cx, bottom); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(left, cy); ctx.lineTo(right, cy); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#b31b1b";
    ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI*2); ctx.fill();

    // Tiny red % label by the Y-axis, baseline resting on the horizontal line.
    // Clamp near the top so it tucks under the line instead of clipping.
    ctx.font = "bold 11px system-ui";
    ctx.textAlign = "left";
    const labelBaseline = (cy - 3 < top + 10) ? cy + 12 : cy - 3;
    ctx.fillText(`${cpct}%`, left + 3, labelBaseline);
    ctx.restore();
  }
}

function download(filename, mime, text) {
  const blob = new Blob([text], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function safeName() {
  return (state.client.name || "client").replace(/[^\p{Letter}\p{Number}]+/gu, "_");
}

function buildExportPayload() {
  readClientForm();
  return {
    exportedAt: new Date().toISOString(),
    app: "UC Speech Audiometry (Te reo Māori / NZ English)",
    activeLanguage: state.language,
    // Also emit `language` (the key the importer historically read). Keeping both
    // means new files load in old builds and vice-versa. The importer now prefers
    // activeLanguage and falls back to language.
    language: state.language,
    languagesPresent: languagesWithResults(),
    client: state.client,
    setup: {
      presentationCondition: $("presentationCondition") ? $("presentationCondition").value : "",
      stimulusRouting: $("stimEar") ? $("stimEar").value : "",
      transducer: $("transducer") ? $("transducer").value : "",
      maskingAtExport: $("maskEar") && $("maskEar").value !== "off",
      maskerEar: $("maskEar") ? $("maskEar").value : "",
      maskerLevelDbA: $("maskLevel") ? $("maskLevel").value : ""
    },
    calibration: state.calibration,
    queue: state.queue,
    dialectSubstitutions: state.dialectSubstitutions,
    results: state.results,
    summaries: listSummaries(),
    // Full session state so a reopened file restores the adaptive tracks (the
    // fitted SRTs and plots) AND any track that was mid-flight — i.e. "where I was
    // up to". Previously the export dropped these, so an adaptive session looked
    // empty on reload even though every trial was in `results`. Mirrors the
    // localStorage crash-recovery snapshot.
    testMode: state.testMode,
    adaptiveForm: state.adaptiveForm,
    currentListIndex: state.currentListIndex,
    currentTrialIndex: state.currentTrialIndex,
    currentTrials: state.currentTrials,
    adaptiveTracks: state.adaptiveTracks || [],
    adaptiveLive: serialiseLiveAdaptive(),
    // Thesis-mode harness state, when present, so a reopened experiment file shows
    // the same progress and accumulated CSVs.
    experiment: state.experiment || null,
    // Per-ear audiogram / PTA and derived inputs (state.participant holds the
    // per-frequency AC/BC thresholds, PTA, 4FA, and masker settings each ear).
    // The analysis plan needs PTA per ear as a continuous predictor, so this must
    // travel with the results. Absent → the participant simply hasn't entered one.
    participant: state.participant || null,
    // Non-adaptive comparison configuration + per-block plan (lists/levels chosen),
    // so a reopened file / analysis tool can see the fixed-level arm's setup.
    nonAdaptive: state.nonAdaptive || null
  };
}

function autoSaveJson() {
  // Silently trigger a JSON download so data is never lost on session end
  const payload = buildExportPayload();
  const base = (window.Sessions && window.Sessions.fileBase)
    ? window.Sessions.fileBase(state.client, payload.exportedAt)
    : `${safeName()}_${(state.client.date||"").replace(/-/g,"")}`;
  download(`${base}_speech_audiometry.json`, "application/json", JSON.stringify(payload, null, 2));
  // Exporting is a clean close point for this session.
  if (window.Sessions && state.sessionId) window.Sessions.markClean(state.sessionId);
}

function downloadJson() {
  autoSaveJson();
}

// One complete per-participant JSON bundle (experiment mode). Same payload as the
// standard export — which now includes the audiogram, adaptive tracks with full
// logs, the experiment admin/trial CSVs, and the non-adaptive config — but named
// by participant so a folder of these drops straight into the analysis tool.
function downloadParticipantJson() {
  const payload = buildExportPayload();
  const pid = (state.experiment && state.experiment.participant != null)
    ? `participant_${state.experiment.participant}` : (safeName() || "participant");
  const date = (state.client.date || payload.exportedAt.slice(0, 10)).replace(/-/g, "");
  download(`${pid}_${date}_speech_audiometry.json`, "application/json", JSON.stringify(payload, null, 2));
  if (window.Sessions && state.sessionId) window.Sessions.markClean(state.sessionId);
}

// ── Anonymised export & backup conversion (anonymiser.js) ─────────────────
function exportAnonymisedResults() {
  if (!window.Anonymiser) { alert("Anonymiser unavailable."); return; }
  window.Anonymiser.exportAnonymised(
    buildExportPayload,
    (client, iso) => (window.Sessions ? window.Sessions.fileBase(client, iso) : safeName())
  );
}

function openConvertBackup() {
  if (!window.Anonymiser) { alert("Anonymiser unavailable."); return; }
  window.Anonymiser.openConvertModal(
    (client, iso) => (window.Sessions ? window.Sessions.fileBase(client, iso) : "decoded"),
    addDecodedToRecent
  );
}

// Bridge for the Convert-backup modal: turn a decoded export payload into a new
// entry in the keyed session store (for moving a client between devices). Does
// NOT disturb the current session. Returns true on success.
function addDecodedToRecent(decoded) {
  if (!window.Sessions) return false;
  try {
    const id = window.Sessions.newId();
    const payload = {
      savedAt: new Date().toISOString(),
      sessionId: id,
      importedFrom: "email-backup",
      language: decoded.activeLanguage || "maori",
      client: decoded.client || {},
      calibration: decoded.calibration || {},
      queue: decoded.queue || [],
      results: decoded.results || [],
      dialectSubstitutions: decoded.dialectSubstitutions || {}
    };
    window.Sessions.saveImported(id, payload, {
      client: {
        name: payload.client.name || "", id: payload.client.id || "",
        dob: payload.client.dob || "", date: payload.client.date || ""
      },
      resultCount: payload.results.length,
      testInProgress: false
    });
    renderRecentSessions();
    return true;
  } catch (e) { console.error("[import] addDecodedToRecent:", e); return false; }
}

function buildTsv() {
  readClientForm();
  const headerRows = [
    ["Client name", state.client.name || ""],
    ["Client ID", state.client.id || ""],
    ["Date of birth", state.client.dob || ""],
    ["Session date", state.client.date || ""],
    ["Clinician", state.client.clinician || ""],
    ["Notes", state.client.notes || ""],
    ["Calibration method", state.calibration?.isCalibrated ? calMethodInfo().label : "uncalibrated"],
    ["Calibration reference dB(A)", referenceSummary()],
    ["Presentation range dB(A)", (() => { const b = levelBounds(); return b && b.usable ? `${b.min}–${b.max}` : "—"; })()],
    ["Calibration time", state.calibration?.timestamp || "—"],
    ["Default presentation condition", $("presentationCondition") ? conditionLabel($("presentationCondition").value) : ""],
    ["Stimulus routing", $("stimEar") ? $("stimEar").value : ""],
    ["Transducer", $("transducer") ? $("transducer").value : ""],
    ["Masking enabled at export", $("maskEar") && $("maskEar").value !== "off" ? "Yes" : "No"],
    []
  ];

  const cols = ["timestamp","language","clientName","clientId","clientDob","listNumber","listLevelDbA","presentationCondition","stimulusEar","transducer","maskerEar","maskerLevelDbA","trialOrder","presentedWord","targetPhonemes","scoringMode","responsePhonemes","score","scoreOutOf","percent","comment"];
  const rows = state.results.map(r => {
    const denom = r.phonemeCount || r.targetPhonemes?.length || 4;
    const langLabel = (LANGUAGES[r.language || "maori"] || LANGUAGES.maori).label;
    const responseStr = r.scoringMode === "fast"
      ? (Number(r.score) === denom ? r.targetPhonemes.join(" ") : "not recorded")
      : (r.responsePhonemes || []).join(" ");
    return [
      r.timestamp, langLabel, state.client.name, state.client.id, state.client.dob, r.listNumber, r.listLevelDbA, r.presentationCondition, r.stimulusEar, r.transducer, r.maskerEar, r.maskerLevelReport ?? r.maskerLevelDbA ?? "none", r.trialOrder, r.presentedWord,
      r.targetPhonemes.join(" "), r.scoringMode || "", responseStr, r.score, denom, r.percent, r.comment
    ];
  });

  return [...headerRows, cols, ...rows]
    .map(row => row.map(x => String(x ?? "").replace(/\t/g," ").replace(/\n/g," ")).join("\t"))
    .join("\n");
}

function downloadTsv() {
  download(`${safeName()}_speech_audiometry.tsv`, "text/tab-separated-values", buildTsv());
}

async function copyTsv() {
  const tsv = buildTsv();
  try {
    await navigator.clipboard.writeText(tsv);
    alert("TSV copied to clipboard.");
  } catch {
    const ta = document.createElement("textarea");
    ta.value = tsv;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    alert("TSV copied to clipboard.");
  }
}

// Render a finished adaptive track's level path to a PNG data URL for the report.
// Fixed x-axis range for adaptive figures: −10 to 100 dB(A), matching the
// A2 demo's word-in-quiet range so the track and psychometric function share
// exactly the same horizontal scale.
const ADAPTIVE_X_MIN = -10;
const ADAPTIVE_X_MAX = 100;

// Marker colour graded red → green across phonemes correct (0..m).
// 0 correct = red, all correct = green, midway = amber. Semi-transparent.
function phonemeMarkerColour(correct, total, alpha) {
  const t = total > 0 ? Math.max(0, Math.min(1, correct / total)) : 0;
  // red (220,50,50) → amber (230,170,40) → green (40,170,80)
  let r, g, b;
  if (t < 0.5) {
    const u = t / 0.5;
    r = 220 + (230 - 220) * u; g = 50 + (170 - 50) * u; b = 50 + (40 - 50) * u;
  } else {
    const u = (t - 0.5) / 0.5;
    r = 230 + (40 - 230) * u; g = 170 + (170 - 170) * u; b = 40 + (80 - 40) * u;
  }
  return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${alpha == null ? 0.55 : alpha})`;
}

/* Draw the combined adaptive figure into a 2D context, matching the A2 demo's
   arrangement: two stacked panels sharing one dB(A) x-axis (−10..100).
     • Top panel  — psychometric function: fitted curve, per-word markers
       (coloured by phonemes correct), and a dashed 50% line that meets the
       curve then drops to the SRT on the axis.
     • Bottom panel — the adaptive track drawn "sideways": presentation level
       on the shared x-axis, trial index climbing down the panel, so each
       word sits directly under its level on the psychometric plot.
   spec = { log, srt, slope, floor, phonemeCount, nTrials }  */
function drawAdaptiveCombined(ctx, W, H, spec) {
  const log = spec.log || [];
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
  if (!log.length) return;

  const padL = 42, padR = 12, padTop = 10, gap = 26, axisH = 18;
  const plotW = W - padL - padR;
  // Two equal panels with a gap and a shared axis label strip between them.
  const panelH = (H - padTop - axisH - gap) / 2;
  const topY0 = padTop, topY1 = padTop + panelH;                 // proportion 1→0
  const botY0 = topY1 + gap + axisH, botY1 = botY0 + panelH;     // trial 0→n

  const xMin = ADAPTIVE_X_MIN, xMax = ADAPTIVE_X_MAX;
  const xFor = dB => padL + plotW * ((dB - xMin) / (xMax - xMin));
  const yTop = p => topY1 - (topY1 - topY0) * p;                 // proportion correct
  const n = spec.nTrials || log.length;
  const yBot = i => botY0 + (botY1 - botY0) * (i / Math.max(1, n - 1)); // trial index

  // ── shared x-axis grid + ticks (drawn once, spanning both panels) ──
  ctx.strokeStyle = "#e2e8f0"; ctx.lineWidth = 1;
  ctx.fillStyle = "#64748b"; ctx.font = "10px sans-serif"; ctx.textAlign = "center";
  for (let dB = xMin; dB <= xMax; dB += 10) {
    const x = xFor(dB);
    ctx.beginPath(); ctx.moveTo(x, topY0); ctx.lineTo(x, topY1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, botY0); ctx.lineTo(x, botY1); ctx.stroke();
    ctx.fillText(String(dB), x, topY1 + axisH - 4);
  }
  ctx.textAlign = "left";
  ctx.fillStyle = "#334155"; ctx.font = "11px sans-serif";
  ctx.fillText("Presentation level dB(A)", padL, topY1 + axisH + gap / 2 + 3);

  // ── TOP PANEL: psychometric function ──
  // panel frame
  ctx.strokeStyle = "#cbd5e1"; ctx.lineWidth = 1;
  ctx.strokeRect(padL, topY0, plotW, topY1 - topY0);
  // y ticks 0 / 50 / 100 %
  ctx.fillStyle = "#64748b"; ctx.font = "10px sans-serif"; ctx.textAlign = "right";
  [[1, "100%"], [0.5, "50%"], [0, "0%"]].forEach(([p, lbl]) => {
    ctx.fillText(lbl, padL - 4, yTop(p) + 3);
  });
  ctx.textAlign = "left";
  ctx.save(); ctx.translate(12, (topY0 + topY1) / 2); ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = "#334155"; ctx.font = "11px sans-serif"; ctx.textAlign = "center";
  ctx.fillText("proportion correct", 0, 0); ctx.restore(); ctx.textAlign = "left";

  // per-word markers, coloured by phonemes correct
  log.forEach(l => {
    ctx.fillStyle = phonemeMarkerColour(l.correct, l.phonemes, 0.55);
    ctx.beginPath(); ctx.arc(xFor(l.level), yTop(l.result), 5, 0, 2 * Math.PI); ctx.fill();
  });

  // fitted curve + SRT drop-line
  if (spec.srt != null && spec.slope != null) {
    const floor = spec.floor != null ? spec.floor : Adaptive.DEFAULT_PER_UNIT_FLOOR;
    ctx.strokeStyle = "rgb(64,64,64)"; ctx.lineWidth = 2; ctx.beginPath();
    for (let k = 0; k <= 120; k++) {
      const dB = xMin + (xMax - xMin) * (k / 120);
      const y = yTop(Adaptive.perUnitCurve(dB, spec.srt, spec.slope, floor));
      k ? ctx.lineTo(xFor(dB), y) : ctx.moveTo(xFor(dB), y);
    }
    ctx.stroke();
    // dashed 50% line: horizontal from left axis to the curve at SRT, then down to axis
    const srtInRange = spec.srt >= xMin && spec.srt <= xMax;
    ctx.strokeStyle = "#16a34a"; ctx.setLineDash([5, 3]); ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(padL, yTop(0.5));
    ctx.lineTo(srtInRange ? xFor(spec.srt) : padL + plotW, yTop(0.5));
    if (srtInRange) { ctx.lineTo(xFor(spec.srt), yTop(0)); }
    ctx.stroke(); ctx.setLineDash([]);
    if (srtInRange) {
      ctx.fillStyle = "#16a34a"; ctx.font = "11px sans-serif"; ctx.textAlign = "center";
      ctx.fillText(`SRT ${spec.srt.toFixed(1)}`, xFor(spec.srt), yTop(0) - 4);
      ctx.textAlign = "left";
    }
  }

  // ── BOTTOM PANEL: adaptive track drawn sideways (level on shared x) ──
  ctx.strokeStyle = "#cbd5e1"; ctx.lineWidth = 1;
  ctx.strokeRect(padL, botY0, plotW, botY1 - botY0);
  ctx.fillStyle = "#64748b"; ctx.font = "10px sans-serif"; ctx.textAlign = "right";
  ctx.fillText("trial 1", padL - 4, yBot(0) + 3);
  ctx.fillText(`${n}`, padL - 4, yBot(n - 1) + 3);
  ctx.textAlign = "left";
  const trackColours = { 1: "#0f62fe", 2: "#7c3aed" };
  [1, 2].forEach(tid => {
    const pts = log.filter(l => l.trackId === tid);
    if (!pts.length) return;
    ctx.strokeStyle = trackColours[tid]; ctx.globalAlpha = 0.7; ctx.lineWidth = 1.5;
    ctx.beginPath();
    pts.forEach((l, k) => { const x = xFor(l.level), y = yBot(l.order - 1); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.stroke(); ctx.globalAlpha = 1;
  });
  log.forEach(l => {
    ctx.fillStyle = phonemeMarkerColour(l.correct, l.phonemes, 0.7);
    ctx.beginPath(); ctx.arc(xFor(l.level), yBot(l.order - 1), 3.5, 0, 2 * Math.PI); ctx.fill();
  });
  // SRT vertical reference across the track panel
  if (spec.srt != null && spec.srt >= xMin && spec.srt <= xMax) {
    ctx.strokeStyle = "#16a34a"; ctx.setLineDash([5, 3]); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(xFor(spec.srt), botY0); ctx.lineTo(xFor(spec.srt), botY1); ctx.stroke();
    ctx.setLineDash([]);
  }
}

function adaptiveTrackToImage(track) {
  const cv = document.createElement("canvas");
  cv.width = 620; cv.height = 460;
  const ctx = cv.getContext("2d");
  drawAdaptiveCombined(ctx, cv.width, cv.height, {
    log: track.log || [],
    srt: track.srt,
    slope: track.slope,
    floor: track.perUnitFloor,
    phonemeCount: track.phonemeCount,
    nTrials: track.nTrials
  });
  return cv.toDataURL("image/png");
}

function buildAdaptiveReportSections() {
  const tracks = state.adaptiveTracks || [];
  if (!tracks.length) return "";
  const blocks = tracks.map((t, i) => {
    const L = LANGUAGES[t.language] || LANGUAGES.maori;
    const img = adaptiveTrackToImage(t);
    const rev = (t.reversalsByTrack || []).map(r => `${Math.round(r.pTarget * 100)}%: ${r.reversals} reversals`).join(", ");
    const lists = (t.listNumbers || []).join(", ") || "—";
    const masker = (t.maskerEar && t.maskerEar !== "off")
      ? `${t.maskerEar}${t.maskerOffsetDb != null ? `, SNR held at ${t.maskerOffsetDb.toFixed(1)} dB` : ""}`
      : "none";
    const srt = t.srt != null ? `${t.srt.toFixed(1)} dB(A)` : "not estimated";
    // Report slope as %/dB (percentage-points of intelligibility per dB) rather
    // than proportion/dB. This is the slope of the fitted 0→1 logistic × 100.
    const slope = t.slope != null ? `${(t.slope * 100).toFixed(1)} %/dB` : "—";
    const slopeNote = t.procedure === "A1"
      ? ` <span class="report-pi-legend">(A1 concentrates trials near 50%; the slope is weakly determined — report the SRT)</span>`
      : "";
    const when = t.timestamp ? new Date(t.timestamp).toLocaleString("en-NZ", { dateStyle: "short", timeStyle: "short" }) : "";
    const esc = s => (s == null ? "" : String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"));

    let tableHead, rows;
    if (t.procedure === "A1") {
      // A1: one track, no reversal/step emphasis. Show the word, its source
      // list, and any clinician transcription instead.
      tableHead = `<tr><th>#</th><th>Word</th><th>List</th><th>Level dB(A)</th><th>Correct</th><th>%</th><th>Transcription</th></tr>`;
      rows = (t.log || []).map(l =>
        `<tr><td>${l.order}</td><td>${esc(l.word)}</td><td>${l.sourceList != null ? esc(l.sourceList) : "—"}</td><td>${l.level.toFixed(1)}</td><td>${l.correct}/${l.phonemes}</td><td>${(l.result * 100).toFixed(0)}%</td><td>${esc(l.transcription) || "—"}</td></tr>`
      ).join("");
    } else {
      // A2: two interleaved tracks — the track identity matters here.
      tableHead = `<tr><th>#</th><th>Track</th><th>Word</th><th>List</th><th>Level dB(A)</th><th>Correct</th><th>%</th><th>Transcription</th></tr>`;
      rows = (t.log || []).map(l =>
        `<tr><td>${l.order}</td><td>${l.trackId}${l.pTarget != null ? ` (${Math.round(l.pTarget * 100)}%)` : ""}</td><td>${esc(l.word)}</td><td>${l.sourceList != null ? esc(l.sourceList) : "—"}</td><td>${l.level.toFixed(1)}</td><td>${l.correct}/${l.phonemes}</td><td>${(l.result * 100).toFixed(0)}%</td><td>${esc(l.transcription) || "—"}</td></tr>`
      ).join("");
    }
    return `
      <section class="report-lang-section">
        <h2>${L.label} — adaptive ${t.procedure} (track ${i + 1})</h2>
        <div class="report-grid">
          <div>
            <p><b>SRT (50%):</b> ${srt}</p>
            <p><b>Slope:</b> ${slope}${slopeNote}</p>
            <p><b>Fit:</b> ${t.nObservations} phoneme observations${t.fitConverged ? "" : " · did not fully converge"}</p>
          </div>
          <div>
            <p><b>Lists:</b> ${lists}</p>
            <p><b>Start level:</b> ${t.startLevel} dB(A) · <b>Trials:</b> ${t.nTrials}</p>
            <p><b>Condition:</b> ${conditionLabel(t.condition)} · <b>Masker:</b> ${masker}</p>
            <p><b>Reversals:</b> ${rev || "—"}${when ? ` · ${when}` : ""}</p>
          </div>
        </div>
        ${img ? `<img class="report-pi" src="${img}" alt="${t.procedure} psychometric function and adaptive track">` : ""}
        <p class="report-pi-legend">Top: fitted psychometric function with per-word markers; the dashed line marks 50% and drops to the SRT. Bottom: the adaptive track on the same dB(A) scale. Marker colour runs red (0 phonemes correct) → green (all ${t.phonemeCount || (L.phonemeCount)} correct).</p>
        <h3>Adaptive track data</h3>
        <table class="report-table"><thead>${tableHead}</thead><tbody>${rows}</tbody></table>
      </section>`;
  });
  return blocks.join("");
}

// ── Per-participant analysis summary (front page of the report) ──────────
// Provisional, pre-stats summary aligned with the equivalence analysis plan:
// one row per completed adaptive track (the analysis "atom" = SRT per language ×
// ear × repeat), with the SRT at 20 and 30 words and their difference (the
// truncation quantity), PTA per ear, and the paired Māori−English differences
// where a same-ear/same-repeat pair exists. This is an indicator only — the real
// stats (TOST, mixed-effects τ_pm, Bland–Altman, S_w/RC) come later.
function fmtDb(v) { return (v == null || !Number.isFinite(Number(v))) ? "—" : Number(v).toFixed(1); }

function srtAtWords(log, nWords) {
  // Reuse the same ML fitter the CSV uses. Words → phoneme observations happen
  // inside the log entries; slice by word count.
  if (!Array.isArray(log) || !window.Adaptive || typeof window.Adaptive.fitFromLog !== "function") return null;
  const slice = log.slice(0, nWords);
  if (slice.length < 2) return null;
  try { const f = window.Adaptive.fitFromLog(slice); return f ? f.srt : null; } catch { return null; }
}

function ptaForEar(ear) {
  // ear: "left" | "right". Prefer the analysis PTA if ParticipantInputs has one.
  if (window.ParticipantInputs && typeof window.ParticipantInputs.dataFor === "function") {
    try {
      const d = window.ParticipantInputs.dataFor(ear);
      if (d) {
        if (Number.isFinite(Number(d.pta))) return Number(d.pta);
        if (Number.isFinite(Number(d.referenceThreshold))) return Number(d.referenceThreshold);
        if (Number.isFinite(Number(d.fourfa))) return Number(d.fourfa);
      }
    } catch {}
  }
  return null;
}

function buildParticipantSummaryPage() {
  const tracks = Array.isArray(state.adaptiveTracks) ? state.adaptiveTracks : [];
  if (!tracks.length) return "";   // only meaningful once adaptive tracks exist

  // Build per-track rows with SRT@20 / SRT@30 / difference.
  const rows = tracks.map((t, i) => {
    const ear = t.stimulusEar || t.condition || "";
    const srt30 = (t.srt != null) ? Number(t.srt) : srtAtWords(t.log, 30);
    const srt20 = srtAtWords(t.log, 20);
    const diff = (srt30 != null && srt20 != null) ? (srt30 - srt20) : null;
    return {
      idx: i,
      language: t.language || "maori",
      ear,
      lists: Array.isArray(t.listNumbers) ? t.listNumbers.join("+") : (t.listNumbers || ""),
      srt20, srt30, diff,
      converged: t.fitConverged,
      timestamp: t.timestamp || ""
    };
  });
  // Assign a repeat index per (language, ear) in time order.
  const seen = {};
  rows.sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
  rows.forEach(r => {
    const key = r.language + "|" + r.ear;
    seen[key] = (seen[key] || 0) + 1;
    r.repeat = seen[key];
  });

  const trackRows = rows.map(r => `
    <tr>
      <td>${r.language === "maori" ? "Māori (CVCV)" : "English (CVC)"}</td>
      <td>${conditionLabel(r.ear)}</td>
      <td>${r.repeat}</td>
      <td>${r.lists}</td>
      <td>${fmtDb(r.srt20)}</td>
      <td>${fmtDb(r.srt30)}</td>
      <td>${fmtDb(r.diff)}</td>
      <td>${r.converged ? "" : "not converged"}</td>
    </tr>`).join("");

  // Paired Māori−English differences at SRT(30), matched by ear + repeat.
  const byKey = {};
  rows.forEach(r => { byKey[r.language + "|" + r.ear + "|" + r.repeat] = r; });
  const pairRows = [];
  rows.filter(r => r.language === "maori").forEach(m => {
    const e = byKey["english|" + m.ear + "|" + m.repeat];
    if (e && m.srt30 != null && e.srt30 != null) {
      pairRows.push(`<tr><td>${conditionLabel(m.ear)}</td><td>${m.repeat}</td>
        <td>${fmtDb(m.srt30)}</td><td>${fmtDb(e.srt30)}</td>
        <td>${fmtDb(m.srt30 - e.srt30)}</td></tr>`);
    }
  });

  // Simple provisional aggregates (indicator only; not the planned stats).
  const diffs = pairRows.length
    ? rows.filter(r => r.language === "maori").map(m => {
        const e = byKey["english|" + m.ear + "|" + m.repeat];
        return (e && m.srt30 != null && e.srt30 != null) ? (m.srt30 - e.srt30) : null;
      }).filter(v => v != null)
    : [];
  const mean = arr => arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : null;
  const sd = arr => {
    if (arr.length < 2) return null;
    const m = mean(arr); return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1));
  };
  const truncs = rows.map(r => r.diff).filter(v => v != null);

  const ptaL = ptaForEar("left"), ptaR = ptaForEar("right");

  const provisional = `
    <div class="summary-stats">
      <p><b>Provisional indicators</b> (not the final analysis — see plan):</p>
      <ul>
        <li>Māori−English SRT(30) difference: mean ${fmtDb(mean(diffs))} dB, SD ${fmtDb(sd(diffs))} dB, over ${diffs.length} matched pair(s).</li>
        <li>Truncation SRT(30)−SRT(20): mean ${fmtDb(mean(truncs))} dB, SD ${fmtDb(sd(truncs))} dB, over ${truncs.length} track(s).</li>
        <li>PTA — left ${fmtDb(ptaL)} dB HL, right ${fmtDb(ptaR)} dB HL.</li>
      </ul>
      <p class="report-pi-legend">These are simple descriptive placeholders. The planned equivalence
      analysis (TOST at ±5 dB, mixed-effects τ_pm, repeated-measures Bland–Altman, S_w / RC, Method×PTA)
      is run separately across all participants.</p>
    </div>`;

  return `
    <section class="report-summary-page">
      <h2>Participant summary — adaptive SRTs</h2>
      <p class="report-pi-legend">One row per completed adaptive track. SRT at 20 and 30 words are both
      reported (the plan's "measure at 20, continue to 30"); their difference is the truncation quantity.</p>
      <table class="report-table">
        <thead><tr><th>Test</th><th>Ear</th><th>Rep</th><th>Lists</th>
          <th>SRT@20 dB(A)</th><th>SRT@30 dB(A)</th><th>Δ(30−20)</th><th>Fit</th></tr></thead>
        <tbody>${trackRows}</tbody>
      </table>
      ${pairRows.length ? `
        <h3>Paired Māori − English (SRT@30, matched ear &amp; repeat)</h3>
        <table class="report-table">
          <thead><tr><th>Ear</th><th>Rep</th><th>Māori SRT</th><th>English SRT</th><th>Māori−English</th></tr></thead>
          <tbody>${pairRows.join("")}</tbody>
        </table>` : ""}
      ${provisional}
    </section>`;
}

function showReport() {
  readClientForm();
  if (!state.results || !state.results.length) {
    alert("No results to report yet.");
    return;
  }
  state._reportCalledFrom = document.querySelector(".screen.active")?.id || "screen-setup";

  const langs = languagesWithResults();
  const allSummaries = listSummaries();

  const denomOf = r => r.phonemeCount || r.targetPhonemes?.length || 4;
  const responseText = (r) => {
    const denom = denomOf(r);
    if (r.scoringMode === "fast") {
      return Number(r.score) === denom ? r.targetPhonemes.join(" ") : "not recorded";
    }
    return r.targetPhonemes.map((target, idx) => {
      const advanced = r.responsePhonemes?.[idx];
      const selectedCorrect = r.selectedTargetCorrectness?.[idx];
      if (advanced !== null && advanced !== undefined && advanced !== "") return advanced;
      if (selectedCorrect) return target;
      return "–";
    }).join(" ");
  };

  // Capture one PI image per language by drawing each into the canvas.
  const piImages = {};
  for (const lk of langs) {
    drawPI(lk);
    piImages[lk] = $("piCanvas") ? $("piCanvas").toDataURL("image/png") : "";
  }
  // Restore the live canvas to the active tab.
  refreshPI();

  // Per-language report sections (plot + summary + trial table).
  const langSection = (lk) => {
    const L = LANGUAGES[lk] || LANGUAGES.maori;
    const summaries = allSummaries.filter(s => (s.language || "maori") === lk);
    const results = state.results.filter(r => (r.language || "maori") === lk && !r.adaptive);
    const summaryRows = summaries.map(s =>
      `<tr><td>${s.listNumber}</td><td>${s.level}</td><td>${conditionLabel(s.condition || s.ear)}</td><td>${s.masked ? "Yes" : "No"}</td><td>${s.trials}</td><td>${s.percent}%</td></tr>`
    ).join("");
    const trialRows = results.map(r =>
      `<tr><td>${r.listNumber}</td><td>${r.listLevelDbA}</td><td>${conditionLabel(r.presentationCondition || r.stimulusEar)}</td><td>${r.transducer || ""}</td><td>${r.maskerLevelReport ?? r.maskerLevelDbA ?? "none"}</td><td>${r.presentedWord}</td><td>${r.targetPhonemes.join(" ")}</td><td>${responseText(r)}</td><td>${r.score}/${denomOf(r)}</td><td>${r.comment || ""}</td></tr>`
    ).join("");
    const wordHeader = L.unitTitle;
    return `
      <section class="report-lang-section">
        <h2>${L.label} — performance intensity function</h2>
        ${piImages[lk] ? `<img class="report-pi" src="${piImages[lk]}" alt="${L.label} performance intensity plot">` : ""}
        <p class="report-pi-legend">× Left (dashed) &nbsp; ×× Masked left &nbsp; ○ Right (solid) &nbsp; ● Masked right &nbsp; B Binaural &nbsp; S/A/U Sound field / Aided / Unaided</p>
        <h3>${L.label} — summary</h3>
        <table class="report-table"><thead><tr><th>List</th><th>Level dB(A)</th><th>Condition</th><th>Masked</th><th>Trials</th><th>% correct</th></tr></thead><tbody>${summaryRows}</tbody></table>
        <h3>${L.label} — trial data</h3>
        <table class="report-table"><thead><tr><th>List</th><th>dB(A)</th><th>Condition</th><th>Transducer</th><th>Masker dB(A)</th><th>${wordHeader}</th><th>Target</th><th>Response</th><th>Score</th><th>Comment</th></tr></thead><tbody>${trialRows}</tbody></table>
      </section>`;
  };

  const sectionsHtml = langs.map(langSection).join("");
  const adaptiveHtml = buildAdaptiveReportSections();

  const logoHtml = state.clinicLogo
    ? `<img src="${state.clinicLogo}" alt="Clinic logo" style="max-height:60px;max-width:200px;object-fit:contain">`
    : "";
  const clinicNameVal = ($("clinicName") ? $("clinicName").value.trim() : "") || "University of Canterbury Hearing Clinic";
  const titleLangs = langs.map(lk => (LANGUAGES[lk] || LANGUAGES.maori).label).join(" / ");

  $("reportContent").innerHTML = `
    <div class="report-header-row">
      <div>${logoHtml}</div>
      <div style="text-align:right;color:#555;font-size:.9rem">${clinicNameVal}</div>
    </div>
    <h1>Speech Audiometry Report</h1>
    <p class="report-pi-legend">Languages assessed: ${titleLangs}</p>
    <div class="report-grid">
      <div>
        <p><b>Client:</b> ${state.client.name || ""}</p>
        <p><b>Identifier:</b> ${state.client.id || ""}</p>
        <p><b>Date of birth:</b> ${state.client.dob || ""}</p>
        <p><b>Date:</b> ${state.client.date || ""}</p>
      </div>
      <div>
        <p><b>Clinician:</b> ${state.client.clinician || ""}${state.client.role ? " — " + state.client.role : ""}</p>
        <p><b>Facility:</b> ${state.client.facility || ""}</p>
        <p><b>Calibration:</b> ${state.calibration.isCalibrated
          ? `${referenceSummary()} reference (${calMethodInfo().label})`
            + (() => { const b = levelBounds(); return b && b.usable ? `, presented ${b.min}–${b.max} dB(A)` : ""; })()
          : "not set"}</p>
        <p><b>Notes:</b> ${state.client.notes || ""}</p>
      </div>
    </div>
    ${buildParticipantSummaryPage()}
    ${adaptiveHtml}
    ${sectionsHtml}
  `;
  show("screen-report");
}

/* ═══════════════════════════════════════════════════════════════════
   ADAPTIVE MODE
   Drives Brand & Kollmeier A1/A2 tracks using the same playback, scoring,
   masker and calibration machinery as fixed-level testing. The adaptive
   run appears to the rest of the app as a single synthetic queue item
   whose levelDbA is updated by the engine after every word.
   ═══════════════════════════════════════════════════════════════════ */

function adaptiveActive() { return state.testMode === "adaptive" && !!state.adaptive; }

// ── Mode toggle ──
function setTestMode(mode) {
  state.testMode = (mode === "adaptive") ? "adaptive" : "fixed";
  document.querySelectorAll("[data-mode]").forEach(btn =>
    btn.classList.toggle("active", btn.dataset.mode === state.testMode));
  const adaptiveCard = $("adaptiveCard");
  const queueCard = $("queueCard");
  if (adaptiveCard) adaptiveCard.hidden = state.testMode !== "adaptive";
  if (queueCard) queueCard.hidden = state.testMode === "adaptive";
  if (state.testMode === "adaptive") renderAdaptiveListPicker();
  saveSession();
}

// ── Adaptive settings form ──
function readAdaptiveForm() {
  const f = state.adaptiveForm || (state.adaptiveForm = {});
  f.procedure = $("adaptiveProcedure") ? $("adaptiveProcedure").value : "A1";
  f.startLevel = Number($("adaptiveStartLevel") ? $("adaptiveStartLevel").value : 60);
  f.nTrials = Math.max(4, Math.round(Number($("adaptiveNTrials") ? $("adaptiveNTrials").value : 20)));
  return f;
}

// Push saved adaptive form values into the inputs (used on restore/init).
function applyAdaptiveFormToUI() {
  const f = state.adaptiveForm || {};
  if ($("adaptiveProcedure") && f.procedure) $("adaptiveProcedure").value = f.procedure;
  if ($("adaptiveStartLevel") && f.startLevel != null) $("adaptiveStartLevel").value = f.startLevel;
  const proc = f.procedure || "A1";
  const procDefault = (proc === "A2") ? 30 : 20;
  if ($("adaptiveNTrials") && f.nTrials != null) {
    $("adaptiveNTrials").value = f.nTrials;
    // Only protect the restored value from procedure-driven defaults if it was
    // deliberately different from this procedure's default; otherwise let
    // switching procedures keep applying 20/30.
    state._adaptiveNTrialsTouched = (Number(f.nTrials) !== procDefault);
  }
  const a2 = $("a2Targets");
  if (a2) a2.hidden = (proc !== "A2");
  renderAdaptiveListPicker();
}

function applyProcedureDefaults() {
  const proc = $("adaptiveProcedure") ? $("adaptiveProcedure").value : "A1";
  // Default trial counts: A1 → 20 (2 lists), A2 → 30 (3 lists). Only auto-set
  // if the clinician hasn't deliberately typed a different value this session.
  if ($("adaptiveNTrials") && !state._adaptiveNTrialsTouched) {
    $("adaptiveNTrials").value = (proc === "A2") ? 30 : 20;
  }
  const a2 = $("a2Targets");
  if (a2) a2.hidden = (proc !== "A2");
  state.adaptiveForm.procedure = proc;
  saveSession();
}

function bkFromForm() {
  return {
    a: Number($("bkA") ? $("bkA").value : 1.5) || 1.5,
    b: Number($("bkB") ? $("bkB").value : 1.41) || 1.41,
    minStep: Number($("bkMinStep") ? $("bkMinStep").value : 0.25) || 0.25,
    s50: Number($("bkS50") ? $("bkS50").value : 0.1) || 0.1
  };
}
function floorFromForm() {
  const v = Number($("bkFloor") ? $("bkFloor").value : 0);
  return Math.min(0.5, Math.max(0, isFinite(v) ? v : 0.05));
}
function pTargetsFromForm(proc) {
  if (proc !== "A2") return [0.5];
  const p1 = Number($("pTarget1") ? $("pTarget1").value : 0.2);
  const p2 = Number($("pTarget2") ? $("pTarget2").value : 0.8);
  return [p1, p2];
}

// ── List picker (multi-select, ordered) ──
function renderAdaptiveListPicker() {
  const box = $("adaptiveListPicker");
  if (!box) return;
  box.innerHTML = "";
  const lists = Object.keys(currentWordLists()).map(Number).sort((a, b) => a - b);
  const selected = state.adaptiveForm.selectedLists || (state.adaptiveForm.selectedLists = []);
  lists.forEach(n => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "list-toggle" + (selected.includes(n) ? " selected" : "");
    const order = selected.indexOf(n);
    btn.innerHTML = `List ${n}` + (order >= 0 ? `<span class="order-badge">#${order + 1}</span>` : "");
    btn.onclick = () => {
      const i = selected.indexOf(n);
      if (i >= 0) selected.splice(i, 1);
      else selected.push(n);
      renderAdaptiveListPicker();
      updateAdaptiveListStatus();
      saveSession();
    };
    box.appendChild(btn);
  });
  updateAdaptiveListStatus();
}

function selectedAdaptiveWords() {
  const selected = state.adaptiveForm.selectedLists || [];
  const lists = currentWordLists();
  let pool = [];
  selected.forEach(n => { if (lists[n]) pool = pool.concat(lists[n]); });
  return pool;
}

// Same pool, but each entry paired with the list number it came from, so the
// adaptive trial data can report the source list of every presented word.
function selectedAdaptiveWordsWithList() {
  const selected = state.adaptiveForm.selectedLists || [];
  const lists = currentWordLists();
  const pool = [];
  selected.forEach(n => { if (lists[n]) lists[n].forEach(w => pool.push({ word: w, list: n })); });
  return pool;
}

function updateAdaptiveListStatus() {
  const el = $("adaptiveListStatus");
  if (!el) return;
  const selected = state.adaptiveForm.selectedLists || [];
  const words = selectedAdaptiveWords().length;
  const need = Math.max(4, Math.round(Number($("adaptiveNTrials") ? $("adaptiveNTrials").value : 20)));
  if (!selected.length) { el.textContent = "No lists selected."; return; }
  const shortfall = words < need;
  el.innerHTML = `${selected.length} list(s), ${words} words available for ${need} trials` +
    (shortfall ? ` — <span class="danger-text">need ${need - words} more; words will be reused</span>` : ` ✓`);
}

// ── Starting an adaptive track ──
function startAdaptiveTrack() {
  // Re-entrancy guard: a live adaptive track must not be replaced by a second
  // start (e.g. a stray "Start adaptive track" click, or a double-tap on the
  // experiment Continue button). Without this, a second start wiped the running
  // session and could record the same administration twice. If a track is
  // genuinely in progress, ignore the start.
  if (state.adaptive && state.adaptive.session && !state.adaptive.session.finished) {
    return;
  }
  readClientForm();
  readAdaptiveForm();
  const proc = state.adaptiveForm.procedure;
  const nTrials = state.adaptiveForm.nTrials;
  const startLevel = state.adaptiveForm.startLevel;

  // Bounds check on the starting level.
  const b = levelBounds();
  if (b && b.usable && (startLevel < b.min || startLevel > b.max)) {
    alert(`Starting level ${startLevel} dB(A) is outside the calibrated range ` +
          `(${b.min}–${b.max} dB(A)). Adjust the starting level or recalibrate.`);
    return;
  }

  // Assemble the word pool from the selected lists, in the chosen order,
  // keeping each word paired with the list it came from.
  let pool = selectedAdaptiveWordsWithList();
  if (!pool.length) { alert("Select at least one word list for the adaptive track."); return; }
  // Optionally shuffle within the pool per the language's randomise setting.
  if (randomiseEnabled(state.language)) pool = shuffle(pool);
  // Repeat the pool if it is shorter than the trial count.
  const words = [];
  for (let i = 0; i < nTrials; i++) words.push(pool[i % pool.length].word);
  const wordLists = [];
  for (let i = 0; i < nTrials; i++) wordLists.push(pool[i % pool.length].list);

  const session = new Adaptive.AdaptiveSession({
    procedure: proc,
    startLevel,
    nTrials,
    phonemeCount: phonemeCount(),
    perUnitFloor: floorFromForm(),
    bk: bkFromForm(),
    pTargets: pTargetsFromForm(proc)
  });

  // Masker offset: if masking is on, hold stimulus−masker constant from the
  // levels the clinician has dialled in at track start.
  const maskingOn = $("maskEar") && $("maskEar").value !== "off";
  const maskerOffset = maskingOn ? (startLevel - maskerLevel()) : null;

  state.adaptive = {
    session,
    procedure: proc,
    listNumbers: (state.adaptiveForm.selectedLists || []).slice(),
    words,
    wordLists,
    maskerOffsetDb: maskerOffset,
    startLevel,
    railHandled: false
  };

  // Build a synthetic queue entry so the rest of the app treats this like a list.
  const synthetic = {
    listNumber: (state.adaptiveForm.selectedLists || []).join("+") || "adaptive",
    levelDbA: session.current().level,
    language: state.language,
    status: "in progress",
    adaptive: true,
    id: crypto.randomUUID?.() || String(Date.now())
  };
  state.queue = [synthetic];
  state.currentListIndex = 0;
  state.currentTrials = words.map((w, i) => ({ order: i + 1, word: w, sourceList: wordLists[i] }));
  state.currentResultIndexByTrial = {};
  state.currentTrialIndex = 0;
  state.firstTrialMaskerPrimed = false;

  syncMaskerControls();
  applyAdaptiveMaskerLevel();      // set masker to follow the first level
  showAdaptivePanels(true);
  renderTrial();
  updateLevelDisplay();
  startMaskerIfNeeded();
  renderAdaptiveViews();
  show("screen-test");
  saveSession();
}

// Keep the masker following the current stimulus level. Two modes:
//  • Clinical auto-masking (MaskingUI "Auto"): the masker level comes from the
//    masking rules (PL − IAA + ABgap + 10), retracked with a gentle ramp.
//  • Otherwise: hold the fixed stimulus−masker SNR offset dialled in at track start.
function applyAdaptiveMaskerLevel() {
  const a = state.adaptive;
  if (!a) return;
  // Clinical auto-masking takes precedence when the clinician has enabled it.
  if (typeof window !== "undefined" && window.MaskingUI &&
      $("maskingAuto") && $("maskingAuto").checked) {
    window.MaskingUI.onLevelChanged();
    return;
  }
  if (a.maskerOffsetDb == null) return;
  const q = currentQueueItem();
  if (!q) return;
  const target = clampLevel(q.levelDbA - a.maskerOffsetDb);
  if ($("maskLevel")) $("maskLevel").value = target;
  if ($("maskLevelLive")) $("maskLevelLive").value = target;
  if (state.audio.masker) state.audio.masker.gain.gain.value = gainForLevel(target, maskerNoiseAdjustDb(), maskEarSide());
}

// Build a readable transcription of what the clinician entered for a word.
// Advanced scoring records the actual response phoneme per slot (or null for
// "not transcribed / omitted"); fast scoring records only a count, so there is
// no transcription to show. Returns "" when nothing was transcribed.
function adaptiveTranscriptionString(r) {
  if (r.scoringMode === "fast") return "";
  const resp = r.responsePhonemes;
  if (!Array.isArray(resp) || !resp.some(p => p !== null && p !== undefined && p !== "")) return "";
  return resp.map(p => (p === null || p === undefined || p === "") ? "·" : p).join(" ");
}

// ── The adaptive step, called from advanceTrialNow after a result is stored ──
// resultPayload is the object just pushed to state.results.
function adaptiveOnResult(resultPayload) {
  const a = state.adaptive;
  if (!a) return;
  const outcomes = phonemeOutcomeVector(resultPayload);
  const presentedLevel = resultPayload.listLevelDbA;
  const out = a.session.record(outcomes, presentedLevel);

  // Enrich the just-recorded log entry with the word, its source list, and the
  // clinician's phoneme transcription (advanced scoring only), so the report
  // and the exported data are complete. The engine stays domain-agnostic; this
  // metadata is attached here where the word/list/transcription are known.
  const entry = a.session.log[a.session.log.length - 1];
  if (entry) {
    entry.word = resultPayload.presentedWord;
    entry.sourceList = (resultPayload.sourceList != null) ? resultPayload.sourceList : null;
    entry.targetPhonemes = resultPayload.targetPhonemes || [];
    entry.transcription = adaptiveTranscriptionString(resultPayload);
  }
  renderAdaptiveViews();

  if (a.session.finished) { finishAdaptiveTrack(); return; }

  // Compute the next level and check calibration rails.
  const nextLevel = a.session.current().level;
  const b = levelBounds();
  let applied = nextLevel;
  let railMsg = null;
  if (b && b.usable) {
    if (nextLevel > b.max) {
      applied = b.max;
      railMsg = `The procedure called for ${nextLevel.toFixed(1)} dB(A), above the ` +
        `calibrated maximum of ${b.max} dB(A). To go higher, ${moreLevelAdvice()}.`;
    } else if (nextLevel < b.min) {
      applied = b.min;
      railMsg = `The procedure called for ${nextLevel.toFixed(1)} dB(A), below the ` +
        `bottom of the range (${b.min} dB(A)). To go lower, ${lessLevelAdvice()}.`;
    }
  } else {
    // Uncalibrated: the starting level is the unity-gain reference, so the
    // procedure can attenuate below it but cannot go louder without clipping.
    if (nextLevel > a.startLevel) {
      applied = a.startLevel;
      railMsg = `The procedure called for ${nextLevel.toFixed(1)} dB(A), above the ` +
        `starting level of ${a.startLevel} dB(A). Uncalibrated, the starting level is ` +
        `the loudest the app can present without clipping — the client is performing ` +
        `below target at the top of the range. Turn up the device volume and restart, ` +
        `raise the starting level, or calibrate for an absolute reference.`;
    }
  }
  // Also check the tracked masker won't exceed its rail.
  if (!railMsg && a.maskerOffsetDb != null && b && b.usable) {
    const maskTarget = applied - a.maskerOffsetDb;
    if (maskTarget > b.max || maskTarget < b.min) {
      railMsg = `The contralateral masker would need ${maskTarget.toFixed(1)} dB(A) to ` +
        `hold the set SNR, which is outside the calibrated range (${b.min}–${b.max} dB(A)).`;
    }
  }

  const q = currentQueueItem();
  q.levelDbA = applied;

  if (railMsg) {
    promptAdaptiveRail(railMsg);
  } else {
    applyAdaptiveMaskerLevel();
    updateLevelDisplay();
  }
}

// Reconstruct a per-phoneme 0/1 vector from a stored result.
// Advanced/manual scoring records true per-phoneme correctness; fast scoring
// records only a count, so we synthesise k ones then zeros (order-agnostic for
// the likelihood fit, which sums independent Bernoulli terms per word).
function phonemeOutcomeVector(r) {
  const m = r.phonemeCount || (r.targetPhonemes ? r.targetPhonemes.length : phonemeCount());
  if (r.scoringMode !== "fast" && Array.isArray(r.selectedTargetCorrectness) &&
      Array.isArray(r.responsePhonemes)) {
    const out = [];
    for (let i = 0; i < m; i++) {
      const adv = r.responsePhonemes[i];
      if (adv !== null && adv !== undefined && adv !== "") {
        out.push(equivalentForScoring(r.targetPhonemes[i], adv) ? 1 : 0);
      } else {
        out.push(r.selectedTargetCorrectness[i] ? 1 : 0);
      }
    }
    return out;
  }
  const k = Math.max(0, Math.min(m, Math.round(r.score)));
  const out = [];
  for (let i = 0; i < m; i++) out.push(i < k ? 1 : 0);
  return out;
}

function promptAdaptiveRail(msg) {
  const dlg = $("adaptiveRailDialog");
  const body = $("adaptiveRailBody");
  if (!dlg || !body) { applyAdaptiveMaskerLevel(); updateLevelDisplay(); return; }
  body.innerHTML = `<p>${msg}</p><p>You can continue presenting at the limit, or ` +
    `abandon this adaptive track. Continuing keeps recording data; the estimate will ` +
    `note that a limit was reached.</p>`;
  state.adaptive.railHandled = true;
  dlg.showModal();
}

// ── Finishing ──
function finishAdaptiveTrack() {
  const a = state.adaptive;
  if (!a) return;
  const q = currentQueueItem();
  if (q) q.status = "complete";
  stopMasker();
  const fit = a.session.estimate();
  a.fit = fit;

  // Persist a serialisable summary for the report and session restore.
  const summary = {
    timestamp: new Date().toISOString(),
    procedure: a.procedure,
    language: state.language,
    listNumbers: a.listNumbers,
    startLevel: a.startLevel,
    nTrials: a.session.total,
    condition: $("presentationCondition") ? $("presentationCondition").value : $("stimEar").value,
    stimulusEar: $("stimEar").value,
    maskerEar: $("maskEar") ? $("maskEar").value : "off",
    maskerOffsetDb: a.maskerOffsetDb,
    srt: fit ? fit.srt : null,
    slope: fit ? fit.slope : null,
    fitConverged: fit ? fit.converged : false,
    nObservations: fit ? fit.n : 0,
    perUnitFloor: a.session.perUnitFloor,
    phonemeCount: a.session.phonemeCount,
    reversalsByTrack: a.session.tracks.map(t => ({ pTarget: t.pTarget, reversals: t.reversals })),
    log: a.session.log.slice()
  };
  if (!Array.isArray(state.adaptiveTracks)) state.adaptiveTracks = [];
  state.adaptiveTracks.push(summary);

  // Notify the optional experiment module that a track completed, so it can
  // RECORD the administration. No-op when inactive.
  //
  // Ordering matters: recording must happen now (while state.adaptive still holds
  // this track's log), but ADVANCING to the next position must wait until the
  // clinician has dismissed the per-track summary dialog below. If we let the
  // harness advance immediately (its old 50 ms timer), the next position's
  // instruction modal opens ON TOP of this summary dialog; closing the summary
  // then runs its own "return to setup" branch and yanks the clinician to the
  // home screen between every administration (the reported fault). So in
  // experiment mode we record here and defer the advance to the summary's close
  // handler via a one-shot callback.
  const experimentDriven = (typeof window !== "undefined" && window.Experiment &&
      window.Experiment.isExperimentUnlocked && window.Experiment.isExperimentUnlocked() &&
      state.experiment && state.experiment.running);
  if (typeof window !== "undefined" && window.Experiment &&
      typeof window.Experiment.onTrackFinished === "function") {
    try {
      window.Experiment.onTrackFinished(summary, { deferAdvance: experimentDriven });
    } catch (e) { console.error("[experiment] onTrackFinished:", e); }
  }

  renderAdaptiveViews();
  showAdaptiveSummary(fit);
  saveSession();
}

function showAdaptiveSummary(fit) {
  const dlg = $("adaptiveSummaryDialog");
  const body = $("adaptiveSummaryBody");
  const a = state.adaptive;
  if (!dlg || !body || !a) return;
  const reversals = a.session.tracks.map(t => `track ${t.id} (target ${Math.round(t.pTarget*100)}%): ${t.reversals} reversals`).join("; ");
  let html = `<p><b>${a.procedure}</b> · ${a.session.total} trials · ${reversals}.</p>`;
  if (fit) {
    html += `<p style="font-size:1.15rem"><b>SRT (50%): ${fit.srt.toFixed(1)} dB(A)</b></p>`;
    html += `<p>Fitted slope: ${(fit.slope * 100).toFixed(1)} %/dB` +
            `${a.procedure === "A1" ? " <span class=\"hint\">(A1 concentrates trials near 50%, so the slope is weakly determined — report the SRT)</span>" : ""}</p>`;
    if (!fit.converged) html += `<p class="danger-text">Note: the fit did not fully converge; interpret with caution.</p>`;
  } else {
    html += `<p class="danger-text">Not enough data to fit a psychometric function.</p>`;
  }
  body.innerHTML = html;
  dlg.showModal();
}

// ── Views: track plot + estimate ──
function showAdaptivePanels(on) {
  const tabs = $("adaptiveTabs");
  const panel = $("adaptivePanel");
  if (tabs) tabs.hidden = !on;
  if (panel) panel.hidden = !on;
  // Hide the fixed-mode PI + list navigator while adaptive is showing.
  const showFixed = !on;
  ["currentListHeading", "trialNavigator", "piHeading", "piTabs", "piCanvas"].forEach(id => {
    const el = $(id);
    if (el) el.style.display = showFixed ? "" : "none";
  });
}

function setAdaptiveTab(which) {
  document.querySelectorAll("[data-atab]").forEach(b =>
    b.classList.toggle("active", b.dataset.atab === which));
  if ($("adaptiveTrackView")) $("adaptiveTrackView").hidden = which !== "track";
  if ($("adaptiveEstimateView")) $("adaptiveEstimateView").hidden = which !== "estimate";
  if (which === "estimate") renderAdaptiveEstimate();
}

function renderAdaptiveViews() {
  if (!adaptiveActive() && !(state.adaptive && state.adaptive.fit)) return;
  renderAdaptiveTrackPlot();
  renderAdaptiveEstimate();
  const a = state.adaptive;
  const line = $("adaptiveProgressLine");
  if (line && a) {
    const cur = a.session.current();
    if (a.session.finished) {
      line.innerHTML = `<span class="adaptive-progress-strong">Complete</span> — ${a.session.total} trials.`;
    } else {
      line.innerHTML = `Trial <span class="adaptive-progress-strong">${a.session.done + 1}</span> of ${a.session.total}` +
        (cur ? ` · next at <span class="adaptive-progress-strong">${cur.level.toFixed(1)} dB(A)</span>` +
               (a.session.tracks.length > 1 ? ` · track ${cur.trackId} (target ${Math.round(cur.pTarget*100)}%)` : "") : "");
    }
  }
}

// Build the drawing spec from the live session (uses the running fit).
function liveAdaptiveSpec() {
  const a = state.adaptive;
  if (!a) return null;
  const fit = (a.session.finished && a.fit) ? a.fit : a.session.estimate();
  return {
    log: a.session.log,
    srt: fit ? fit.srt : null,
    slope: fit ? fit.slope : null,
    floor: a.session.perUnitFloor,
    phonemeCount: a.session.phonemeCount,
    nTrials: a.session.total,
    fit
  };
}

function renderAdaptiveTrackPlot() {
  const cv = $("adaptiveTrackCanvas");
  const a = state.adaptive;
  if (!cv || !a) return;
  const spec = liveAdaptiveSpec();
  if (!spec) return;
  drawAdaptiveCombined(cv.getContext("2d"), cv.width, cv.height, spec);
}

function renderAdaptiveEstimate() {
  const a = state.adaptive;
  if (!a) return;
  const spec = liveAdaptiveSpec();
  const fit = spec && spec.fit;
  const numbers = $("adaptiveEstimateNumbers");
  if (numbers) {
    if (fit) {
      numbers.innerHTML =
        `<div><span class="big-srt">${fit.srt.toFixed(1)} dB(A)</span> SRT (50%)</div>` +
        `<div>slope ${(fit.slope * 100).toFixed(1)} %/dB · ${fit.n} phoneme observations` +
        `${fit.converged ? "" : " · <span class=\"danger-text\">not converged</span>"}</div>`;
    } else {
      numbers.textContent = "Collecting data… the estimate appears once enough words are scored.";
    }
  }
  const cv = $("adaptiveFitCanvas");
  if (!cv || !spec) return;
  drawAdaptiveCombined(cv.getContext("2d"), cv.width, cv.height, spec);
}

function bindAdaptiveEvents() {
  document.querySelectorAll("[data-mode]").forEach(btn => {
    btn.onclick = () => setTestMode(btn.dataset.mode);
  });
  if ($("adaptiveProcedure")) $("adaptiveProcedure").onchange = applyProcedureDefaults;
  if ($("adaptiveNTrials")) $("adaptiveNTrials").oninput = () => {
    state._adaptiveNTrialsTouched = true;
    updateAdaptiveListStatus();
  };
  if ($("adaptiveStartLevel")) $("adaptiveStartLevel").onchange = () => { readAdaptiveForm(); saveSession(); };
  if ($("startAdaptiveBtn")) $("startAdaptiveBtn").onclick = startAdaptiveTrack;
  document.querySelectorAll("[data-atab]").forEach(btn => {
    btn.onclick = () => setAdaptiveTab(btn.dataset.atab);
  });
  if ($("adaptiveRailContinue")) $("adaptiveRailContinue").onclick = () => {
    $("adaptiveRailDialog").close();
    applyAdaptiveMaskerLevel();
    updateLevelDisplay();
  };
  if ($("adaptiveRailAbandon")) $("adaptiveRailAbandon").onclick = () => {
    $("adaptiveRailDialog").close();
    state.adaptive = null;
    stopMasker();
    show("screen-setup");
  };
  if ($("adaptiveSummaryContinue")) $("adaptiveSummaryContinue").onclick = () => {
    $("adaptiveSummaryDialog").close();
    updateSetupResultsSummary();
    // In experiment mode the harness owns navigation: closing the summary should
    // advance to the NEXT administration's instruction modal, staying in the test
    // flow — NOT drop back to the setup/home screen between every administration.
    // finishAdaptiveTrack deferred the advance to us for exactly this reason.
    const exp = (typeof window !== "undefined" && window.Experiment &&
      window.Experiment.isExperimentUnlocked && window.Experiment.isExperimentUnlocked() &&
      state.experiment && state.experiment.active);
    if (exp && typeof window.Experiment.resumeAfterSummary === "function") {
      window.Experiment.resumeAfterSummary();
      return;
    }
    show("screen-setup");
  };
}

init();
