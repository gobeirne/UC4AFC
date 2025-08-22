/**
 * Preload all images and sounds listed in preloadfilelist.txt
 * Falls back to hardcoded list in file:// mode.
 */

export async function preloadAllAssets() {
  let assetList = [];

  const isLocal = location.protocol === "file:";

  if (isLocal) {
    // 🚧 Fallback list for local mode
assetList = [
  "images/bag.jpg",
  "images/back.jpg",
  "images/bat.jpg",
  "images/bed.jpg",
  "images/bike.jpg",
  "images/bat_backup.jpg",
  "images/beak.jpg",
  "images/bite.jpg",
  "images/bird.jpg",
  "images/bin.jpg",
  "images/book.jpg",
  "images/beach.jpg",
  "images/boat.jpg",
  "images/beak_arrow.jpg",
  "images/boot.jpg",
  "images/bug.jpg",
  "images/cage.jpg",
  "images/cake.jpg",
  "images/cap.jpg",
  "images/cat.jpg",
  "images/card.jpg",
  "images/ball.jpg",
  "images/chalk.jpg",
  "images/chin.jpg",
  "images/chin_arrow.jpg",
  "images/chip.jpg",
  "images/bone.jpg",
  "images/bus.jpg",
  "images/bell.jpg",
  "images/coat.jpg",
  "images/comb.jpg",
  "images/cone.jpg",
  "images/cot.jpg",
  "images/dad.jpg",
  "images/dad_arrow.jpg",
  "images/dirt.jpg",
  "images/dog.jpg",
  "images/fan.jpg",
  "images/duck.jpg",
  "images/feet.jpg",
  "images/fork.jpg",
  "images/gate.jpg",
  "images/goat.jpg",
  "images/hat.jpg",
  "images/hall.jpg",
  "images/head.jpg",
  "images/heart.jpg",
  "images/hen.jpg",
  "images/hood_arrow.jpg",
  "images/house.jpg",
  "images/hut.jpg",
  "images/hood.jpg",
  "images/keys.jpg",
  "images/hug.jpg",
  "images/kite.jpg",
  "images/king.jpg",
  "images/knees.jpg",
  "images/knees_arrow.jpg",
  "images/leaf.jpg",
  "images/knife.jpg",
  "images/leg.jpg",
  "images/lick.jpg",
  "images/light.jpg",
  "images/lock.jpg",
  "images/lock_arrow.jpg",
  "images/log.jpg",
  "images/man.jpg",
  "images/meat.jpg",
  "images/mop.jpg",
  "images/mouse.jpg",
  "images/mouth.jpg",
  "images/mum.jpg",
  "images/mum_arrow.jpg",
  "images/night.jpg",
  "images/nose.jpg",
  "images/nose_arrow.jpg",
  "images/note.jpg",
  "images/note_arrow.jpg",
  "images/nurse.jpg",
  "images/nurse_backup.jpg",
  "images/nut.jpg",
  "images/page_arrow.jpg",
  "images/page.jpg",
  "images/park.jpg",
  "images/pan.jpg",
  "images/peach.jpg",
  "images/pen.jpg",
  "images/pig.jpg",
  "images/purse.jpg",
  "images/road.jpg",
  "images/rock.jpg",
  "images/rose.jpg",
  "images/rug.jpg",
  "images/sack.jpg",
  "images/sad.jpg",
  "images/seed.jpg",
  "images/seed_arrow.jpg",
  "images/sheep.jpg",
  "images/shark.jpg",
  "images/shell.jpg",
  "images/shirt.jpg",
  "images/ship.jpg",
  "images/shop.jpg",
  "images/sock.jpg",
  "images/soup.jpg",
  "images/suit.jpg",
  "images/sword.jpg",
  "images/tongue.jpg",
  "images/tap.jpg",
  "images/tongue_arrow.jpg",
  "images/van.jpg",
  "images/zip.jpg",
  "sounds/back.mp3",
  "sounds/ball.mp3",
  "sounds/bat.mp3",
  "sounds/bed.mp3",
  "sounds/bell.mp3",
  "sounds/bin.mp3",
  "sounds/beach.mp3",
  "sounds/bird.mp3",
  "sounds/bone.mp3",
  "sounds/book.mp3",
  "sounds/boot.mp3",
  "sounds/bike.mp3",
  "sounds/bus.mp3",
  "sounds/bug.mp3",
  "sounds/cage.mp3",
  "sounds/beak.mp3",
  "sounds/cake.mp3",
  "sounds/calib.mp3",
  "sounds/card.mp3",
  "sounds/boat.mp3",
  "sounds/chalk.mp3",
  "sounds/cat.mp3",
  "sounds/cap.mp3",
  "sounds/chin.mp3",
  "sounds/bag.mp3",
  "sounds/chip.mp3",
  "sounds/bite.mp3",
  "sounds/coat.mp3",
  "sounds/comb.mp3",
  "sounds/cone.mp3",
  "sounds/cot.mp3",
  "sounds/dad.mp3",
  "sounds/dirt.mp3",
  "sounds/dog.mp3",
  "sounds/duck.mp3",
  "sounds/fan.mp3",
  "sounds/feet.mp3",
  "sounds/gate.mp3",
  "sounds/fork.mp3",
  "sounds/goat.mp3",
  "sounds/hall.mp3",
  "sounds/hat.mp3",
  "sounds/heart.mp3",
  "sounds/head.mp3",
  "sounds/hood.mp3",
  "sounds/hen.mp3",
  "sounds/house.mp3",
  "sounds/hug.mp3",
  "sounds/hut.mp3",
  "sounds/keys.mp3",
  "sounds/king.mp3",
  "sounds/kite.mp3",
  "sounds/knees.mp3",
  "sounds/knife.mp3",
  "sounds/leaf.mp3",
  "sounds/leg.mp3",
  "sounds/light.mp3",
  "sounds/lock.mp3",
  "sounds/lick.mp3",
  "sounds/man.mp3",
  "sounds/meat.mp3",
  "sounds/mop.mp3",
  "sounds/mouse.mp3",
  "sounds/log.mp3",
  "sounds/mum.mp3",
  "sounds/mouth.mp3",
  "sounds/night.mp3",
  "sounds/nose.mp3",
  "sounds/note.mp3",
  "sounds/nurse.mp3",
  "sounds/nut.mp3",
  "sounds/pan.mp3",
  "sounds/page.mp3",
  "sounds/park.mp3",
  "sounds/peach.mp3",
  "sounds/pen.mp3",
  "sounds/pig.mp3",
  "sounds/purse.mp3",
  "sounds/road.mp3",
  "sounds/rock.mp3",
  "sounds/rose.mp3",
  "sounds/rug.mp3",
  "sounds/sack.mp3",
  "sounds/sad.mp3",
  "sounds/seed.mp3",
  "sounds/shark.mp3",
  "sounds/sheep.mp3",
  "sounds/ship.mp3",
  "sounds/shell.mp3",
  "sounds/shirt.mp3",
  "sounds/shop.mp3",
  "sounds/sock.mp3",
  "sounds/soup.mp3",
  "sounds/suit.mp3",
  "sounds/sword.mp3",
  "sounds/tongue.mp3",
  "sounds/tap.mp3",
  "sounds/van.mp3",
  "sounds/zip.mp3"
];
    console.warn("📦 Using fallback preload asset list (file:// mode)");
  } else {
    try {
      const res = await fetch("preloadfilelist.txt");
      if (!res.ok) throw new Error(`Failed to fetch preloadfilelist.txt: ${res.status}`);
      const raw = await res.text();
      assetList = raw.split(/\r?\n/).filter(x => x.trim().length > 0);
    } catch (err) {
      console.error("❌ Failed to load preloadfilelist.txt:", err);
      return;
    }
  }

const tasks = assetList.map(src => () => {
  if (src.endsWith(".jpg")) return preloadImage(src);
  if (src.endsWith(".mp3")) return preloadSound(src);
  return Promise.resolve();
}).filter(Boolean);

console.log(`📦 Preloading ${tasks.length} assets...`);
await runWithConcurrency(tasks, 8); // keep this modest on mobile
console.log(`✅ Finished preloading ${tasks.length} assets.`);

async function runWithConcurrency(fns, limit = 8) {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, fns.length) }, async () => {
    while (i < fns.length) await fns[i++]();
  });
  await Promise.all(workers);
}


function preloadImage(src, timeoutMs = 7000) {
  return new Promise((resolve) => {
    const img = new Image();
    let settled = false;

    const done = () => { if (!settled) { settled = true; clearTimeout(timer); resolve(); } };
    const timer = setTimeout(() => {
      console.warn(`⏱️ Image preload timed out: ${src}`);
      done();
    }, timeoutMs);

    img.onload = done;
    img.onerror = () => { console.warn(`⚠️ Failed to load image: ${src}`); done(); };
    img.src = src;

    // On some browsers, decode can resolve earlier/more reliably
    if (img.decode) {
      img.decode().then(done).catch(done);
    }
  });
}


function preloadSound(src, timeoutMs = 7000) {
  return new Promise((resolve) => {
    const audio = new Audio();
    let settled = false;

    const done = () => { if (!settled) { settled = true; clearTimeout(timer); resolve(); } };
    const timer = setTimeout(() => {
      console.warn(`⏱️ Sound preload timed out: ${src}`);
      done();
    }, timeoutMs);

    const once = (type) => audio.addEventListener(type, done, { once: true });
    once("canplaythrough");
    once("loadeddata");
    once("loadedmetadata");
    audio.addEventListener("error", () => { console.warn(`⚠️ Failed to load sound: ${src}`); done(); }, { once: true });

    audio.preload = "auto";
    audio.src = src;
    try { audio.load(); } catch (_) {}  // iOS: kick the fetch
  });
}


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
