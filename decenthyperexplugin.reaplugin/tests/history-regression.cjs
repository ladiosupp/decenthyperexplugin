// HyperEx history regression check for 2.2.45+.
// Read-only: never writes to the plugin or the machine.
// Usage:
//   node history-regression.cjs [history.json] [--all] [--mode auto|on|off]
// Default: newest hyperex-history*.json in C:/Users/ladios/Downloads.
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const fileArg = args.find(x => !x.startsWith("--")) || null;
const showAll = args.includes("--all");
const modeArg = (() => {
  const i = args.indexOf("--mode");
  return i >= 0 ? String(args[i + 1] || "").toLowerCase() : null;
})();

function newestHistory() {
  const dir = "C:/Users/ladios/Downloads";
  const files = fs.readdirSync(dir).filter(f => /^hyperex-history.*\.json$/i.test(f))
    .map(f => ({ f, p: path.join(dir, f), t: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  if (!files.length) throw new Error("no hyperex-history*.json in " + dir);
  return files[0].p;
}
const file = fileArg || newestHistory();
const data = JSON.parse(fs.readFileSync(file, "utf8"));
const shots = (data.shots || []).filter(s => s && s.fullRecord);

function modeOf(s) {
  if (s.releaseMode) return s.releaseMode;
  if (s.activeRelease === false) return "off";
  if (/\bauto$/i.test(String(s.profileTitle || ""))) return "auto";
  return "on";
}
function versionAtLeast(v, min) {
  const a = String(v || "0").split(".").map(Number);
  const b = String(min || "0").split(".").map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] || 0) - (b[i] || 0);
    if (d) return d > 0;
  }
  return true;
}
function events(s) { return (s.fullRecord && s.fullRecord.events) || []; }
function ev(s, name, after) {
  return events(s).find(e => e.name === name && (after === undefined || e.tMs >= after));
}
function samples(s) { return (s.fullRecord && s.fullRecord.samples) || []; }
function raw(s) { return (s.fullRecord && s.fullRecord.rawScaleSamples) || []; }
function between(arr, a, b) { return arr.filter(x => Number.isFinite(x.tMs) && x.tMs >= a && x.tMs <= b); }
function mean(a) { const v = a.filter(Number.isFinite); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : NaN; }
function med(a) { const v = a.filter(Number.isFinite).sort((x, y) => x - y); if (!v.length) return NaN; const m = v.length >> 1; return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; }
function fmt(v, n = 2) { return Number.isFinite(v) ? v.toFixed(n) : "-"; }
function pct(v, n = 1) { return Number.isFinite(v) ? (v * 100).toFixed(n) + "%" : "-"; }
function firstAtOrAfter(arr, t, pred) { for (const x of arr) if (x.tMs >= t && (!pred || pred(x))) return x; return null; }
function firstAtOrBefore(arr, t) { let best = null; for (const x of arr) if (x.tMs <= t) best = x; return best; }

function ols(xs, ys) {
  const n = xs.length;
  if (n < 4) return null;
  const mx = mean(xs), my = mean(ys);
  let sxx = 0, sxy = 0, syy = 0;
  for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxx += dx * dx; sxy += dx * dy; syy += dy * dy; }
  if (sxx <= 0) return null;
  return { slope: sxy / sxx, r2: syy > 0 ? (sxy * sxy) / (sxx * syy) : 1, n };
}
function rollingSlope(rawArr, t, winMs) {
  const seg = rawArr.filter(x => x.tMs >= t - (winMs || 1200) && x.tMs <= t);
  const seen = new Set();
  const rows = seg.filter(x => {
    const st = Number(x.scaleTimestampSeconds);
    if (!Number.isFinite(st) || seen.has(st)) return false;
    seen.add(st); return true;
  });
  if (rows.length < 6) return null;
  const xs = rows.map(x => Number(x.scaleTimestampSeconds));
  const ys = rows.map(x => Number(x.weightG));
  if (xs[xs.length - 1] - xs[0] < 0.55) return null;
  return ols(xs, ys);
}
function onsetSeries(s, t2, target, maxS) {
  const rw = raw(s);
  const tEnd = t2 + (maxS || 20) * 1000;
  const out = [];
  for (let t = t2 + 500; t <= tEnd; t += 250) {
    const f = rollingSlope(rw, t);
    out.push({ t, slope: f ? f.slope : NaN, r2: f ? f.r2 : NaN });
  }
  return out;
}
function releaseMetrics(s, mode) {
  const enter = ev(s, "auto_release_enter");
  const soakStart = mode === "auto"
    ? ev(s, "auto_release_soak_start", enter ? enter.tMs : undefined)
    : ev(s, "soak_start");
  if (!soakStart) return null;
  const soakEnd = mode === "auto" ? ev(s, "stage2_start", soakStart.tMs) : ev(s, "soak_complete_arm1", soakStart.tMs);
  if (!soakEnd) return null;
  const a = soakStart.tMs, b = soakEnd.tMs;
  const ss = between(samples(s), a - 500, b);
  const seg = ss.filter(x => x.tMs >= a && x.tMs <= b);
  const pStart = firstAtOrBefore(ss, a);
  const pEnd = firstAtOrBefore(ss, b);
  const ps = seg.map(x => Number(x.pressureBar)).filter(Number.isFinite);
  const pMin = ps.length ? Math.min(...ps) : NaN;
  const pMax = ps.length ? Math.max(...ps) : NaN;
  const cross = th => { const x = seg.find(z => Number(z.pressureBar) <= th); return x ? (x.tMs - a) / 1000 : NaN; };
  const flow = seg.map(x => Number(x.machineFlowMlS)).filter(Number.isFinite);
  const cfg = (enter && enter.data && Number(enter.data.soakSeconds)) || (soakStart.data && Number(soakStart.data.soakSeconds)) || NaN;
  return {
    mode, enterT: enter ? enter.tMs : NaN, soakT: a, soakEndT: b,
    configuredS: cfg, actualS: (b - a) / 1000,
    pStart: pStart ? Number(pStart.pressureBar) : NaN,
    pEnd: pEnd ? Number(pEnd.pressureBar) : NaN,
    pMin, pMax, t03: cross(0.3), t05: cross(0.5), t01: cross(0.1),
    flowMed: med(flow)
  };
}
function s2Metrics(s) {
  const e2 = ev(s, "stage2_start");
  if (!e2) return null;
  const t2 = e2.tMs;
  const e3 = ev(s, "stage3_start", t2);
  const w2 = ev(s, "stage2_weight_trigger", t2);
  const tEnd = e3 ? e3.tMs : t2 + 25000;
  const ss = between(samples(s), t2 - 500, t2 + 15000);
  const target = Number((s.s2 && s.s2.targetGS) || (s.config && s.config.stage2Flow) || 5);
  const pAt = t => { const x = firstAtOrBefore(ss.filter(z => z.tMs >= t2 - 300), t); return x ? Number(x.pressureBar) : NaN; };
  const pAfter = ss.filter(x => x.tMs >= t2);
  const pMax = Math.max(...pAfter.map(x => Number(x.pressureBar)).filter(Number.isFinite));
  const pFirst1 = firstAtOrAfter(ss, t2, x => Number(x.pressureBar) >= 1);
  const series = onsetSeries(s, t2, target, 20);
  const th = Math.max(0.8, Math.min(1.2, target * 0.2));
  let onset = NaN;
  for (let i = 0; i < series.length - 2; i++) {
    if (series[i].slope >= th && series[i + 1].slope >= th * 0.9 && series[i + 2].slope >= th * 0.8) { onset = series[i].t - t2; break; }
  }
  const valid = series.filter(x => Number.isFinite(x.slope));
  const peak = valid.length ? valid.reduce((a, x) => x.slope > a.slope ? x : a, { slope: -Infinity, t: NaN }) : { slope: NaN, t: NaN };
  const to90 = series.find(x => x.slope >= target * 0.9);
  const st = s.s2Startup || {};
  const plan = (s.fullRecord.liveFlowTrim && s.fullRecord.liveFlowTrim.s2StartupPlan) || {};
  const exec = (s.fullRecord.liveFlowTrim && s.fullRecord.liveFlowTrim.startupExecution) || {};
  const trace = (s.fullRecord.liveFlowTrim && s.fullRecord.liveFlowTrim.trace) || [];
  const boost = trace.find(x => x.kind === "write" && x.startupAction === "boost");
  const s2 = s.s2 || {};
  return {
    t2, tEnd, durationS: (tEnd - t2) / 1000, target,
    pStart: pAt(t2), p3: pAt(t2 + 3000), p5: pAt(t2 + 5000), p10: pAt(t2 + 10000), pMax,
    pFirst1S: pFirst1 ? (pFirst1.tMs - t2) / 1000 : NaN,
    onsetS: onset / 1000, peakGS: peak.slope, peakAtS: peak.t / 1000,
    overshoot: peak.slope / target - 1, to90S: to90 ? (to90.t - t2) / 1000 : NaN,
    rawGS: s2.rawRegressionGS, rawR2: s2.rawRegressionR2, errPct: s2.errorPct,
    eligible: st.eligible, pulseUsed: st.pulseUsed, reason: st.reason,
    firstResponseDelayS: st.firstResponseDelayS, rise20to80S: st.rise20to80S, tailMeanGS: st.tailMeanGS,
    boostCmd: plan.floodCommandMlS || plan.boostCommandMlS,
    holdMs: plan.holdMs, cutoffFraction: plan.cutoffFraction,
    execStatus: exec.status, execReason: exec.reason,
    boostAtS: boost ? (boost.tMs - t2) / 1000 : NaN,
    boostCount: trace.filter(x => x.kind === "write" && x.startupAction === "boost").length,
    stage3BeforeWeight: !!(e3 && (!w2 || e3.tMs < w2.tMs - 500)),
    weightT: w2 ? w2.tMs : NaN
  };
}
function frameFacts(s, mode) {
  const ss = samples(s);
  const e2 = ev(s, "stage2_start");
  const t2 = e2 ? e2.tMs : NaN;
  const hasPhysical = ss.some(x => x.physicalProfileFrame !== null && x.physicalProfileFrame !== undefined);
  const logical = x => x && x.profileFrame !== null && x.profileFrame !== undefined;
  const logicalS2 = x => logical(x) && Number(x.profileFrame) >= 1;
  const physical = x => x && x.physicalProfileFrame !== null && x.physicalProfileFrame !== undefined;
  const after = t => ss.filter(x => x.tMs >= t);
  const s2Sample = after(t2).find(x => x.phase === "stage2" && logicalS2(x)) || after(t2 - 200).find(logicalS2) || null;
  const soakStart = ev(s, mode === "auto" ? "auto_release_soak_start" : "soak_start");
  const soakSample = soakStart
    ? (after(soakStart.tMs + 200).find(physical) || after(soakStart.tMs + 200).find(logical) || null)
    : null;
  const badFrames = mode === "auto"
    ? ss.filter(x => x.phase === "stage2" && Number(x.physicalProfileFrame) >= 3).length
    : ss.filter(x => x.phase === "stage2" && Number(x.physicalProfileFrame) >= 2).length;
  return {
    hasPhysical,
    s2Physical: physical(s2Sample) ? Number(s2Sample.physicalProfileFrame) : NaN,
    s2Logical: logical(s2Sample) ? Number(s2Sample.profileFrame) : NaN,
    soakPhysical: physical(soakSample) ? Number(soakSample.physicalProfileFrame) : NaN,
    soakLogical: logical(soakSample) ? Number(soakSample.profileFrame) : NaN,
    badFrames
  };
}
function pass(name, detail) { return { name, status: "PASS", detail: detail || "" }; }
function fail(name, detail) { return { name, status: "FAIL", detail: detail || "" }; }
function skip(name, detail) { return { name, status: "SKIP", detail: detail || "" }; }
function check(name, ok, detail) { return ok ? pass(name, detail) : fail(name, detail); }

const rows = [];
for (const s of shots) {
  const mode = modeOf(s);
  if (modeArg && mode !== modeArg) continue;
  const rel = releaseMetrics(s, mode);
  const s2 = s2Metrics(s);
  const ff = frameFacts(s, mode);
  const checks = [];
  if (mode === "auto") {
    const enter = ev(s, "auto_release_enter");
    const soak = ev(s, "auto_release_soak_start", enter ? enter.tMs : undefined);
    const e2 = ev(s, "stage2_start", soak ? soak.tMs : undefined);
    if (!enter || !soak || !e2) {
      checks.push(skip("auto handoff evidence", "missing auto_release_enter / auto_release_soak_start / stage2_start"));
    } else {
      checks.push(pass("auto release events", "auto_release_enter + auto_release_soak_start"));
      checks.push(check("stage2 marks autoRelease", !!(e2.data && e2.data.autoRelease === true), e2 ? JSON.stringify(e2.data || {}) : "missing"));
      if (ff.hasPhysical) {
        checks.push(check("release physical frame 1", ff.soakPhysical === 1, "got " + (Number.isFinite(ff.soakPhysical) ? ff.soakPhysical : "unknown")));
        checks.push(check("S2 physical frame 2", ff.s2Physical === 2, "got " + (Number.isFinite(ff.s2Physical) ? ff.s2Physical : "unknown")));
        checks.push(check("no S2->S3 double skip", ff.badFrames === 0, "stage2 samples at physical >=3: " + ff.badFrames));
      } else {
        checks.push(fail("auto physical frame data", "record has no physicalProfileFrame"));
      }
      if (s2) checks.push(check("no early S3 event", !s2.stage3BeforeWeight, "stage3_start before stage2_weight_trigger"));
      if (rel && Number.isFinite(rel.configuredS)) {
        const lo = rel.configuredS - 0.25, hi = rel.configuredS + 1.1;
        checks.push(check("soak duration", rel.actualS >= lo && rel.actualS <= hi, fmt(rel.actualS) + "s vs " + fmt(rel.configuredS) + "s"));
      } else {
        checks.push(skip("soak duration", "configured SoakSeconds not retained"));
      }
      const skips = events(s).filter(e => e.name === "command_accepted" && e.data && e.data.machineState === "skipStep").length;
      checks.push(check("auto skip count", skips >= 1 && skips <= 2, "accepted skipStep=" + skips));
      if (s2 && Number.isFinite(s2.boostAtS) && versionAtLeast(s.pluginVersion, "2.2.45")) {
        checks.push(check("auto boost 100 ms confirmation", s2.boostAtS >= 0.085, "boost at " + fmt(s2.boostAtS, 3) + "s after S2"));
      } else if (s2 && Number.isFinite(s2.boostAtS)) {
        checks.push(pass("auto boost 100 ms confirmation", "legacy " + s.pluginVersion + " timing: " + fmt(s2.boostAtS, 3) + "s"));
      } else {
        checks.push(skip("auto boost 100 ms confirmation", "no boost write"));
      }
      if (s2 && /completed/i.test(String(s.result || "")) && s2.execStatus === "frame-ended") {
        checks.push(fail("completed auto refill execution", "frame-ended"));
      }
    }
  } else if (mode === "on") {
    const soak = ev(s, "soak_start");
    const soakEnd = ev(s, "soak_complete_arm1", soak ? soak.tMs : undefined);
    const e2 = ev(s, "stage2_start", soakEnd ? soakEnd.tMs : undefined);
    if (!events(s).length || !soak || !soakEnd || !e2) {
      checks.push(skip("on handoff evidence", "legacy record has no soak_start / soak_complete_arm1 / stage2_start"));
    } else {
      checks.push(check("on soak events", true, "soak_start + soak_complete_arm1"));
      checks.push(check("on has no auto release events", !ev(s, "auto_release_enter") && !ev(s, "auto_release_soak_start"), "unexpected auto event"));
      checks.push(check("on stage2 is not autoRelease", !(e2.data && e2.data.autoRelease === true), JSON.stringify(e2.data || {})));
      if (ff.hasPhysical) {
        checks.push(check("on S2 physical frame 1", ff.s2Physical === 1, "got " + (Number.isFinite(ff.s2Physical) ? ff.s2Physical : "unknown")));
        checks.push(check("on no S3 frames in stage2", ff.badFrames === 0, "stage2 samples at physical >=2: " + ff.badFrames));
      } else if (Number.isFinite(ff.s2Logical)) {
        checks.push(check("on S2 logical frame 1", ff.s2Logical === 1, "got " + ff.s2Logical));
      } else {
        checks.push(skip("on S2 frame identity", "no logical/physical S2 sample retained"));
      }
      const skips = events(s).filter(e => e.name === "command_accepted" && e.data && e.data.machineState === "skipStep").length;
      if (skips === 0) checks.push(skip("on skip count", "no accepted skipStep in retained events"));
      else checks.push(check("on skip count", skips >= 1 && skips <= 2, "accepted skipStep=" + skips));
    }
  } else {
    checks.push(pass("off mode", "continuous mode: no auto/on handoff check"));
  }
  const hasFail = checks.some(c => c.status === "FAIL");
  const hasSkip = checks.some(c => c.status === "SKIP");
  rows.push({ s, mode, rel, s2, ff, checks, verdict: hasFail ? "FAIL" : hasSkip ? "SKIP" : "PASS" });
}
rows.sort((a, b) => String(a.s.startedAt).localeCompare(String(b.s.startedAt)));

console.log("file:", file);
console.log("exported:", data.exportedAt, "plugin:", data.pluginVersion, "shots:", shots.length);
const counts = rows.reduce((a, r) => { a[r.mode] = (a[r.mode] || 0) + 1; return a; }, {});
console.log("modes:", JSON.stringify(counts), "filter:", modeArg || "all");
console.log("");
console.log("time                 ver      mode  result                 S2raw  err%   onset  peak  ovs    p@S2   pMax  boost  verdict");
const visible = showAll ? rows : rows.slice(-12);
for (const r of visible) {
  const q = r.s2 || {};
  console.log([
    String(r.s.startedAt).slice(5, 16).replace("T", " "),
    r.s.pluginVersion, r.mode.padEnd(4),
    String(r.s.result || "").padEnd(21).slice(0, 21),
    fmt(q.rawGS), fmt(q.errPct, 1), fmt(q.onsetS), fmt(q.peakGS), pct(q.overshoot, 1),
    fmt(q.pStart), fmt(q.pMax), fmt(q.boostAtS, 3), r.verdict
  ].join("  "));
}

for (const mode of ["auto", "on"]) {
  const group = rows.filter(r => r.mode === mode);
  if (!group.length) continue;
  console.log("\n=== " + mode.toUpperCase() + " checks ===");
  for (const r of group) {
    const x = r.rel, q = r.s2, f = r.ff;
    const head = String(r.s.startedAt).slice(5, 16).replace("T", " ") + " " + r.s.runId +
      " frame soak=" + (Number.isFinite(f.soakPhysical) ? f.soakPhysical : "-") +
      " s2=" + (Number.isFinite(f.s2Physical) ? f.s2Physical : "-");
    if (r.verdict === "PASS") {
      console.log(head + " PASS  soak=" + fmt(x && x.actualS) + "s S2=" + fmt(q && q.rawGS) + "g/s boost@=" + fmt(q && q.boostAtS, 3) + "s");
    } else if (r.verdict === "SKIP") {
      console.log(head + " SKIP  " + r.checks.filter(c => c.status === "SKIP").map(c => c.name).join("; "));
    } else {
      console.log(head + " FAIL");
      for (const c of r.checks) if (c.status === "FAIL") console.log("  FAIL " + c.name + " :: " + c.detail);
    }
  }
}

const autoRows = rows.filter(r => r.mode === "auto");
const onRows = rows.filter(r => r.mode === "on");
const autoPass = autoRows.filter(r => r.verdict === "PASS").length;
const onPass = onRows.filter(r => r.verdict === "PASS").length;
const autoFail = autoRows.filter(r => r.verdict === "FAIL").length;
const onFail = onRows.filter(r => r.verdict === "FAIL").length;
const autoSkip = autoRows.filter(r => r.verdict === "SKIP").length;
const onSkip = onRows.filter(r => r.verdict === "SKIP").length;
const autoChecked = autoPass + autoFail;
const onChecked = onPass + onFail;
console.log("\nSUMMARY auto PASS " + autoPass + " / " + autoChecked + " checked (FAIL " + autoFail + ", SKIP " + autoSkip + "); on PASS " + onPass + " / " + onChecked + " checked (FAIL " + onFail + ", SKIP " + onSkip + ")");
if (autoFail || onFail) process.exitCode = 1;
