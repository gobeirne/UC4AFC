// File: results.js
import { responseLog, participant, config, testStartedAt, selectedList } from "./global.js";
import { showScreen } from "./ui.js";

export function saveResults(optionalNote = "") {
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
    list: selectedList === "demo" ? "Demo" : `List ${selectedList}`,
    participant,
    startedAt: testStartedAt?.toISOString() || null,
    timestamp: now.toISOString(),
    data: responseLog.slice(),
    note: optionalNote || undefined
  };

  // --- Build .txt output
  const txtLines = [
    `# Participant\t${participant}`,
    `# List used\t${selectedList === "demo" ? "Demo" : `List ${selectedList}`}`,
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
    console.warn("ðŸ›‘ Skipping JSON download due to config.saveJson = false");
  }

 // --- Show end screen
showScreen("thankyou");
document.getElementById("fileinfo").textContent =
  `Saved: UC4AFC_${participant}_${timeStr}.${shouldSaveJson ? "{txt,json}" : "txt"}`;

// Enable Save Again button
const saveAgainBtn = document.getElementById("saveAgainBtn");
if (saveAgainBtn) {
  saveAgainBtn.onclick = () => saveResults("manual re-save at " + new Date().toLocaleString());
}


  // Email (subject = filename; body = TXT contents)
  const emailBtn = document.getElementById("emailBtn");
  if (emailBtn) {
    const baseName = `UC4AFC_${participant}_${timeStr}`;
    const subject = `${baseName}.txt`;

    const txtContent = txtLines.join("\n");

    // Mailto size is limited â€” keep conservative
    const MAX_MAILTO_BODY = 1800;
    let body = txtContent;
    let truncated = false;
    if (body.length > MAX_MAILTO_BODY) {
      truncated = true;
      body = body.slice(0, MAX_MAILTO_BODY - 120)
        + `\n\n[...truncated...]\n(Full file saved locally as ${subject}${shouldSaveJson ? " and JSON." : "."})`;
    }

    // Optional default recipient via config.emailTo (add to config.json if you want)
    const to = (typeof config?.emailTo === "string" && config.emailTo.trim()) ? config.emailTo : "";
    const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    emailBtn.onclick = () => { location.href = mailto; };
    if (truncated) emailBtn.title = "Body truncated to fit email link limits";
  }
}