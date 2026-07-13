// File: results.js
import { responseLog, participant, config, testStartedAt } from "./global.js";
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
    participant,
    startedAt: testStartedAt?.toISOString() || null,
    timestamp: now.toISOString(),
    data: responseLog.slice(),
    adaptive: (config && config.adaptive && responseLog.some(r => typeof r.value === "number" || typeof r.cutoffHz === "number"))
      ? {
          config: config.adaptive,
          mode: (config.adaptive && config.adaptive.mode) || "lpf",
          routing: (config && config.routing) || "binaural",
          threshold: (() => {
            for (let i = responseLog.length - 1; i >= 0; i--) {
              const e = (typeof responseLog[i].estimate === "number") ? responseLog[i].estimate : responseLog[i].estimateHz;
              if (typeof e === "number") return e;
            }
            return null;
          })()
        }
      : undefined,
    note: optionalNote || undefined
  };

  // Detect an adaptive run (rows carry a value) and build a self-documenting
  // settings + threshold header, mirroring the Monte-Carlo export style.
  const isAdaptive = responseLog.some(r => typeof r.value === "number" || typeof r.cutoffHz === "number");
  const adaptiveCfg = (config && config.adaptive) ? config.adaptive : null;
  const mode = (adaptiveCfg && adaptiveCfg.mode) || "lpf";
  const unit = (mode === "quiet") ? "dB" : "Hz";
  const stepUnit = (mode === "quiet") ? "dB" : "dec";
  const valOf = (r) => (typeof r.value === "number" ? r.value : r.cutoffHz);
  const estOf = (r) => (typeof r.estimate === "number" ? r.estimate : r.estimateHz);
  const lastEstimate = (() => {
    for (let i = responseLog.length - 1; i >= 0; i--) {
      const e = estOf(responseLog[i]);
      if (typeof e === "number") return e;
    }
    return null;
  })();

  // --- Build .txt output
  const txtLines = [
    `# Participant\t${participant}`,
    `# test started at ${startTimeFormatted}`
  ];

  if (isAdaptive && adaptiveCfg) {
    const startShown = (mode === "quiet")
      ? (adaptiveCfg.startValue ?? adaptiveCfg.start ?? "")
      : (adaptiveCfg.startValue ?? adaptiveCfg.startCutoffHz ?? "");
    txtLines.push(
      `# Mode\t${mode}`,
      `# Procedure\t${adaptiveCfg.procedure}`,
      `# Alternatives\t${adaptiveCfg.A}`,
      `# Target\t${((adaptiveCfg.target ?? 0.625) * 100).toFixed(1)}%`,
      `# Start (${unit})\t${startShown}`,
      `# Trials\t${adaptiveCfg.nTrials}`,
      `# WUDR steps (${stepUnit}) work down/up\t${adaptiveCfg.workDown}/${adaptiveCfg.workUp}`,
      `# WUDR steps (${stepUnit}) init down/up\t${adaptiveCfg.initDown}/${adaptiveCfg.initUp}`,
      `# Switch after reversals\t${adaptiveCfg.switchRev}`,
      `# Routing\t${(config && config.routing) || "binaural"}`,
      `# Threshold estimate (${unit})\t${lastEstimate != null ? lastEstimate : "n/a"}`
    );
  }
  if (typeof Calibration !== "undefined" && Calibration.calibrationHeader) {
    txtLines.push(`# Calibration\t${Calibration.calibrationHeader()}`);
  }

  txtLines.push("");
  if (isAdaptive) {
    const valCol = (mode === "quiet") ? "Level_dB" : "Cutoff_Hz";
    const estCol = (mode === "quiet") ? "Estimate_dB" : "Estimate_Hz";
    txtLines.push(`Trial\tSound\tCorrect\tChosen\tCorrect?\t${valCol}\tProcedure\t${estCol}\tTime_ms`);
    for (const r of responseLog) {
      txtLines.push(
        `${r.index}\t${r.sound}\t${r.correct}\t${r.chosen}\t` +
        `${r.isCorrect ? 1 : 0}\t${valOf(r) ?? ""}\t${r.procedure ?? ""}\t${estOf(r) ?? ""}\t${r.timeMs}`
      );
    }
  } else {
    txtLines.push("Trial\tSound\tCorrect\tChosen\tTime_ms");
    for (const r of responseLog) {
      txtLines.push(`${r.index}\t${r.sound}\t${r.correct}\t${r.chosen}\t${r.timeMs}`);
    }
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
    console.warn("[stop] Skipping JSON download due to config.saveJson = false");
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

    // Mailto size is limited — keep conservative
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