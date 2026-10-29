// HyperEx offline shot simulator.
// Loads the real plugin.js, injects test hooks, and drives one shot against a
// hydraulic plant aligned with Decaid's official mock (mock_de1.dart /
// Streamline demo de1-mock.js). No machine, no network, no Decaid host required.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PLUGIN_FILE = path.join(__dirname, '..', 'decenthyperexplugin.reaplugin', 'plugin.js');
const RECORDING_FILE = path.join(__dirname, 'data', 'sim_shots.json');

// Machine envelope, taken from Decaid's mock DE1 (mock_de1.dart):
// pumpMaxFlow = 8.0 ml/s, physicalMaxPressure = 11.0 bar.
// The simulator enforces these as machine behaviour; the plugin's own limits are
// deliberately not used here, so an over-asking plugin gets clamped by the machine.
const MACHINE = Object.freeze({ maxFlowMlS: 8.0, maxPressureBar: 11.0 });

// Official mock_de1 puck-resistance constants (mock_de1.dart _simulateWithProfile).
const PUCK = Object.freeze({ rDry: 0.10, rPeak: 4.2, rErode: 2.5, peakSecs: 12, erodeSecs: 16 });

// Official mock_de1 limiter: asymptotic approach, not a hard clamp. range<=0
// (or a bare {value} limiter) means hard-clamp at value.
function applyLimiter(measurement, limiter) {
  if (!limiter || !(Number(limiter.value) > 0) || measurement <= Number(limiter.value)) return measurement;
  const range = Number(limiter.range);
  if (!(range > 0)) return Number(limiter.value);
  const excess = measurement - Number(limiter.value);
  return Number(limiter.value) + range * excess / (range + excess);
}

// Puck resistance over shot time: cubic rise rDry->rPeak over peakSecs, then
// linear erosion rPeak->rErode over erodeSecs. rPeak is a tunable knob; the
// official mock also multiplies every shot by a random 0.85-1.15, which we keep
// at 1.0 so identical params reproduce identical results.
function puckResistance(shotSecs, plant) {
  const rPeak = Number(plant.rPeak) > 0 ? Number(plant.rPeak) : PUCK.rPeak;
  if (shotSecs <= PUCK.peakSecs) {
    const s = shotSecs / PUCK.peakSecs;
    return PUCK.rDry + (rPeak - PUCK.rDry) * s * s * s;
  }
  const e = Math.min((shotSecs - PUCK.peakSecs) / PUCK.erodeSecs, 1);
  return rPeak - (rPeak - PUCK.rErode) * e;
}

// Recorded real shots from the official Streamline demo (mock/seed/sim_shots.json),
// copied to sim/data/. Each recording is { title, duration, preinfusionStopSec,
// frames:[{t,p,f,tp,tf,g,m,tt,w,wf}] } at ~10 Hz real-machine telemetry.
let _recordings = null;
function recordings() {
  if (_recordings) return _recordings;
  try { _recordings = JSON.parse(fs.readFileSync(RECORDING_FILE, 'utf8')); }
  catch (_) { _recordings = []; }
  return _recordings;
}
function sampleRecording(rec, t) {
  const frames = rec.frames;
  if (!frames || !frames.length) return { t, p: 0, f: 0, tp: 0, tf: 0, w: 0, wf: 0, g: 90, m: 89, tt: 90 };
  if (t <= frames[0].t) return frames[0];
  const last = frames[frames.length - 1];
  if (t >= last.t) return last;
  let lo = 0, hi = frames.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (frames[mid].t <= t) lo = mid; else hi = mid; }
  const a = frames[lo], b = frames[hi], u = (t - a.t) / (b.t - a.t || 1);
  const lerp = (x, y) => x + (y - x) * u;
  return { t, p: lerp(a.p, b.p), f: lerp(a.f, b.f), tp: lerp(a.tp, b.tp), tf: lerp(a.tf, b.tf), g: lerp(a.g, b.g), m: lerp(a.m, b.m), tt: lerp(a.tt, b.tt), w: lerp(a.w, b.w), wf: lerp(a.wf, b.wf), phase: a.phase || null, frame: a.frame != null ? a.frame : null };
}

// Parse the plugin's own history export (hyperex-history.json) into replay
// recordings. Only cups that kept their raw telemetry are replayable; summary-
// only rows (detailRetention stripped) are skipped. Returns array of
// { source:'hyperex', title, runId, result, startedAt, duration, weightEnd,
//   frames:[{t,p,f,tp,tf,g,m,tt,w,wf,phase,frame}], phaseDriven:true }.
function historyRecordings(fileText) {
  const json = JSON.parse(fileText);
  const out = [];
  const pushRun = (run, idxLabel) => {
    if (!run || typeof run !== 'object') return;
    const raw = Array.isArray(run.rawScaleSamples) ? run.rawScaleSamples
      : Array.isArray(run.samples) ? run.samples : null;
    if (!raw || !raw.length) return;
    const frames = [];
    for (const x of raw) {
      const tMs = Number(x.tMs);
      if (!Number.isFinite(tMs)) continue;
      frames.push({
        t: tMs / 1000,
        p: Number.isFinite(Number(x.pressureBar)) ? Number(x.pressureBar) : 0,
        f: Number.isFinite(Number(x.machineFlowMlS)) ? Number(x.machineFlowMlS) : 0,
        tp: 0,
        tf: Number.isFinite(Number(x.targetFlowMlS)) ? Number(x.targetFlowMlS) : 0,
        g: 90, m: 89, tt: 90,
        w: Number.isFinite(Number(x.weightG)) ? Number(x.weightG) : 0,
        wf: Number.isFinite(Number(x.decaidWeightFlowGS)) ? Number(x.decaidWeightFlowGS) : (Number.isFinite(Number(x.rawDwDtGS)) ? Number(x.rawDwDtGS) : 0),
        phase: x.phase || 'stage1',
        frame: Number.isFinite(Number(x.profileFrame)) ? Number(x.profileFrame) : 0,
      });
    }
    if (!frames.length) return;
    const last = frames[frames.length - 1];
    out.push({
      source: 'hyperex',
      title: (run.profileTitle || 'HyperEx 历史') + ' · ' + (run.runId || idxLabel || ''),
      runId: run.runId || null,
      result: run.result ? String(run.result) : '',
      pluginVersion: run.pluginVersion || json.pluginVersion || '',
      startedAt: run.startedAt || run.exportedAt || '',
      duration: last.t,
      preinfusionStopSec: 0.5,
      weightEnd: last.w,
      frames,
      phaseDriven: true,
    });
  };
  // Newer export shape: { shots:[...] } or { latestRun, history:{shots:[...]} }.
  if (Array.isArray(json.shots)) json.shots.forEach((r, i) => pushRun(r, String(i)));
  else if (json.latestRun) pushRun(json.latestRun, 'latest');
  if (json.history && Array.isArray(json.history.shots)) {
    json.history.shots.forEach((r, i) => pushRun(r, String(i)));
  }
  return out;
}

const HOOKS = [
  'startSequence', 'resetSequence', 'handleStateUpdate', 'onScaleSnapshot',
  'liveTrimTick', 'initializeLiveTrim', 'startLiveTrim', 'stopLiveTrim',
  'observeLiveTrimMachine', 'state', 'loadConfig', 'profileObject',
  'recomputeCalibrationUsability', 'testOverrideBinding', 'syncHyperExProfile',
  'curveEditorSnapshot', 'currentS2RefillSettings', 'stage2StartupPlan',
  'controlLearningAssessment', 'nextShotAdaptiveSuggestion', 'diagnosticSummary',
  'validatedS2RefillSettings', 'guardedSingleSkip', 'requestMachineState',
  'buildGhcOverlayHtml',
];

function inject(source) {
  const token = '  return {\n    id: ID,';
  const at = source.indexOf(token);
  if (at < 0) throw new Error('hook injection point not found');
  return source.slice(0, at)
    + 'globalThis.hooks={' + HOOKS.join(',') + '};\n'
    + source.slice(at);
}

function round(v, n) { const p = 10 ** (n || 2); return Math.round(v * p) / p; }

function createEnv(logs) {
  const handles = new Map();
  const machine = { state: 'idle', substate: 'idle', frame: 0, command: 0, requested: 0, flow: 0, pressure: 0, baseCommand: 0, writeCommand: null, baseFrame: -1, machineFlow: 0, shotStartSec: null };
  const violations = [];
  const lastViolation = {};
  const noteViolation = (kind, t, requested, applied) => {
    if (lastViolation[kind] != null && t - lastViolation[kind] < 2) return;
    lastViolation[kind] = t;
    violations.push({ t: round(t, 2), kind, requested: round(requested, 3), applied: round(applied, 3) });
  };
  let nowMs = 0;
  let seq = 0;
  const timers = new Map();

  const drain = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

  const setTimer = (fn, ms) => { const id = ++seq; timers.set(id, { at: nowMs + Math.max(0, Number(ms) || 0), fn }); return id; };
  const clear = (id) => { timers.delete(id); };
  const runTimer = async () => {
    let next = null;
    for (const [id, t] of timers) if (!next || t.at < next.t.at) next = { id, t };
    if (!next) return false;
    timers.delete(next.id);
    if (next.t.at > nowMs) nowMs = next.t.at;
    try { next.t.fn(); } catch (e) { logs.push('timer error: ' + (e && e.message)); }
    await drain();
    return true;
  };
  const advance = async (ms) => {
    const target = nowMs + ms;
    let guard = 0;
    while (guard++ < 5000) {
      let next = null;
      for (const [id, t] of timers) if (t.at <= target && (!next || t.at < next.t.at)) next = { id, t };
      if (!next) break;
      timers.delete(next.id);
      nowMs = Math.max(nowMs, next.t.at);
      try { next.t.fn(); } catch (e) { logs.push('timer error: ' + (e && e.message)); }
      await drain();
    }
    nowMs = target;
    await drain();
  };

  class TestDate extends Date { static now() { return nowMs; } }

  let hooks = null;
  const fakeFetch = async (url, opts) => {
    const p = String(url).replace(/^https?:\/\/[^/]+/, '');
    const method = String((opts && opts.method) || 'GET').toUpperCase();
    const body = (() => { try { return opts && opts.body ? JSON.parse(opts.body) : null; } catch (_) { return null; } })();
    const res = apiRoute(p, method, body);
    return { ok: res.status < 400, status: res.status, json: async () => res.body, text: async () => JSON.stringify(res.body) };
  };

  function apiRoute(p, method, body) {
    const pathOnly = p.replace(/^\/api\/v1/, '').split('?')[0];
    if (pathOnly === '/machine/info') return { status: 200, body: { model: 'DE1XL', groupHeadControllerPresent: true } };
    if (pathOnly === '/machine/state' && method === 'GET') {
      return { status: 200, body: { state: machine.state, substate: machine.substate } };
    }
    if (pathOnly.startsWith('/machine/state/')) {
      const cmd = pathOnly.split('/').pop();
      if (cmd === 'idle') { machine.state = 'idle'; machine.substate = 'idle'; }
      else if (cmd === 'espresso') { machine.state = 'espresso'; machine.substate = 'preinfusion'; machine.frame = 0; machine.writeCommand = null; machine.machineFlow = 0; machine.shotStartSec = nowMs / 1000; }
      else if (cmd === 'skipStep') { machine.frame = Math.min(4, machine.frame + 1); machine.substate = 'pouring'; }
      return { status: 200, body: { ok: true } };
    }
    if (pathOnly === '/workflow') return { status: 200, body: { profile: hooks ? hooks.profileObject() : null } };
    if (pathOnly === '/machine/calibration') return { status: 200, body: { flowMultiplier: 1 } };
    if (pathOnly.startsWith('/profiles')) return { status: 200, body: [] };
    if (pathOnly === '/machine/profile') return { status: 200, body: { ok: true } };
    return { status: 200, body: {} };
  }

  const context = vm.createContext({
    console, Date: TestDate, Math, JSON, Map, Set, Promise, String, Number, Array, Object,
    Error, RegExp, isFinite, parseFloat, parseInt, Boolean, Symbol,
    setTimeout: setTimer, clearTimeout: clear,
    fetch: fakeFetch,
  });

  const host = {
    log(message) { logs.push(String(message)); },
    emit(name, payload) { logs.push('emit ' + name); },
    storage(req) {
      if (!req || req.type !== 'read') return;
      const value = env.storage[req.key] === undefined ? null : env.storage[req.key];
      setTimer(() => env.plugin.onEvent({ name: 'storageRead', payload: { key: req.key, value } }), 0);
    },
    transport: {
      async open({ url }) {
        const handle = { url };
        handles.set(handle, { listener: null, url });
        return { handle };
      },
      onEvent(handle, fn) { const h = handles.get(handle); if (h) h.listener = fn; },
      async send(handle, payload) {
        const h = handles.get(handle);
        if (!h || !h.listener) return;
        let msg = payload;
        if (payload && payload.type === 'text' && typeof payload.data === 'string') {
          try { msg = JSON.parse(payload.data); } catch (_) { msg = payload; }
        }
        if (msg && msg.operation === 'write' && String(msg.characteristicUUID).toUpperCase() === 'A010' && typeof msg.payload === 'string') {
          const bytes = msg.payload.match(/../g) || [];
          const command = parseInt(bytes[2] || '0', 16) / 16;
          if (Number.isFinite(command)) {
            machine.requested = command; machine.writeCommand = command;
            env.writes.push({ t: round(nowMs / 1000, 3), frame: parseInt(bytes[0], 16), command: round(command, 4) });
            h.listener({ type: 'data', data: JSON.stringify({ type: 'response', operation: 'write', characteristicUUID: 'A010' }) });
          }
        }
      },
      async close(handle) { handles.delete(handle); },
    },
  };

  const source = inject(fs.readFileSync(PLUGIN_FILE, 'utf8'));
  vm.runInContext(source, context, { filename: 'plugin.js' });
  const env = { host, context, machine, storage: {}, writes: [], logs, advance, drain, now: () => nowMs, violations, noteViolation, press: null };
  const plugin = context.createPlugin(host);
  env.plugin = plugin;
  // Create a minimal API handler that the plugin's own api() can use.
  // api() calls global fetch, already wired to apiRoute.
  hooks = context.hooks;
  env.h = hooks;
  return env;
}

function plantDefaults() {
  return { efficiency: 1.0, cupGain: 1.883, cupExp: 0.564, pumpResponse: 0.35, deadTime: 0.2, noise: 0.015, rPeak: 4.2 };
}

// Cup yield fitted to the user's 0.1.77 history (20 steady S2/S3 points):
// cup = cupGain * machineFlow^cupExp, R2 = 0.984. The exponent below 1 is what
// makes S2 saturate: more pump flow buys less and less cup flow.
function cupFlowForMachineFlow(flow, plant) {
  return plant.cupGain * Math.pow(Math.max(0, flow), plant.cupExp);
}

function applyState(env, p) {
  const h = env.h, s = h.state;
  const cfg = h.loadConfig({
    Stage1Flow: p.targets.s1, Stage2Flow: p.targets.s2, Stage3Flow: p.targets.s3,
    Stage1Weight: p.weights.s1, Stage2Weight: p.weights.s2, FinalWeight: p.weights.final,
    SoakSeconds: p.soakSeconds, LiveFlowTrimTest: p.liveTrim.enabled, LiveFlowTrimLevel: String(p.liveTrim.level),
    ActiveRelease: p.mode === 'active', S2StartupAssist: p.refill.enabled, AdaptiveLearningLevel: p.policy,
    Enabled: true, DirectDriverStartTest: false, MaxRunSeconds: p.maxSeconds,
    DumpFallbackSeconds: 2, DumpTimeoutSeconds: 6, DumpFlowThreshold: 0.35,
    HardPressureLimit: p.hardPressureLimit,
  });
  s.cfg = cfg;
  // Target-based refill is a simulator experiment: keep the plugin's own refill
  // plan out of the way and let the machine-side controller below apply the boost.
  if (p.refill.enabled && p.refill.basis === 'target') s.cfg.s2StartupAssist = false;
  s.basketContext = 'coffee';
  s.scopeMode = 'off';
  s.calibrationStorageLoaded = true;
  s.overrideStorageLoaded = true;
  s.s2RefillStorageLoaded = true;
  s.scopeStorageLoaded = true;
  s.scopedOriginalStorageLoaded = true;
  s.calibrationMap = {
    schema: 3, valid: true, createdAt: 'sim', baseFlowMultiplier: 1, algorithm: 'sim',
    points: [{ actualFlow: 1.5, commandFlow: 0.569 }, { actualFlow: 2, commandFlow: 0.719 }, { actualFlow: 5, commandFlow: 2.507 }],
  };
  s.flowMultiplierCurrent = 1;
  h.recomputeCalibrationUsability();
  s.workflowTitle = cfg.profileTitle;
  s.workflowProfile = h.profileObject();
  s.runtimeProfileVerified = true;
  s.armed = true;
  if (p.commands && p.commands.enabled) {
    const binding = h.testOverrideBinding();
    const at = new Date().toISOString();
    s.testOverrides = {
      schema: 3, writerVersion: env.plugin.version, savedAt: at, ...binding,
      stages: {
        stage1: { mode: 'manual', origin: 'manual', command: Number(p.commands.s1) },
        stage2: { mode: 'manual', origin: 'manual', command: Number(p.commands.s2) },
        stage3: { mode: 'manual', origin: 'manual', command: Number(p.commands.s3) },
      },
      s3Shape: { enabled: false },
      manualCurveSource: { afterRunId: '', appliedAt: at, mode: 'sim-manual' },
    };
  } else {
    s.testOverrides = null;
  }
  s.s2RefillSettings = h.validatedS2RefillSettings({
    basis: 'pump-command',
    startDelayMs: p.refill.startDelayMs,
    targetPercent: p.refill.targetPercent,
    cutoffPercent: p.refill.cutoffPercent,
    maxDurationMs: p.refill.maxDurationMs,
    approachMs: p.refill.approachMs,
  });
  s.s2RefillPrevious = null;
  s.uiLanguage = 'zh';
}

async function runShot(params) {
  const logs = [];
  const env = createEnv(logs);
  const defaults = {
    mode: 'active', targets: { s1: 2, s2: 5, s3: 1.5 }, weights: { s1: 4, s2: 40, final: 100 },
    soakSeconds: 10, liveTrim: { enabled: true, level: 3 },
    commands: { enabled: false, s1: 0.719, s2: 2.507, s3: 0.569 },
    refill: { enabled: true, basis: 'target', startDelayMs: 0, targetPercent: 160, cutoffPercent: 85, maxDurationMs: 4000, approachMs: 3000 },
    plant: plantDefaults(), policy: '正常', maxSeconds: 90,
    hardPressureLimit: undefined,
  };
  const input = params || {};
  const p = { ...defaults, ...input };
  for (const key of ['targets', 'weights', 'liveTrim', 'refill', 'plant', 'commands']) {
    p[key] = { ...defaults[key], ...(input[key] || {}) };
  }

  // Replay mode: drive the machine from a real recorded shot instead of the
  // hydraulic plant. Two sources:
  //  - official Streamline demo sim_shots.json (recording.index) — one
  //    continuous espresso, so force continuous mode;
  //  - the plugin's own history export hyperex-history.json (recording.file +
  //    recording.index) — carries per-sample phase (stage1/dumping/soak/
  //    restart_wait/stage2/stage3/finishing), so the machine state follows the
  //    recording's real sequence and the plugin's active release flow is kept.
  // In both, flow/pressure/weight come from the recording; the plugin's frame
  // state machine still runs.
  let replay = null;
  if (input.replay && input.replay.file) {
    const recs = historyRecordings(fs.readFileSync(input.replay.file, 'utf8'));
    const idx = Number.isInteger(input.replay.index) ? input.replay.index : recs.length - 1;
    replay = recs[idx] || null;
  } else if (input.replay && Number.isInteger(input.replay.index)) {
    const recordingsList = recordings();
    replay = recordingsList[input.replay.index] || null;
  }
  if (replay && !replay.phaseDriven) p.mode = 'continuous';
  // Replay is review semantics for a finished real shot: the machine no longer
  // answers the plugin, so use the machine envelope pressure ceiling instead of
  // the plugin's 8 bar protection (pass hardPressureLimit: 8 to observe the
  // real abort behaviour on a >8 bar recording).
  if (replay && p.hardPressureLimit == null) p.hardPressureLimit = 11;

  applyState(env, p);
  const h = env.h, s = h.state, m = env.machine;

  // Deterministic noise.
  let seed = 12345;
  const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const gauss = () => (rand() + rand() + rand() + rand() - 2) * 0.6;

  h.startSequence(0);
  await env.drain();

  const series = [];
  const dt = 0.1;
  let t = 0, weight = 0, cupFlow = 0, lastSample = -1, lastState = -1;
  const dead = [];
  const profile = h.profileObject();
  const stepAt = (frame) => (profile.steps[frame] || profile.steps[profile.steps.length - 1]);
  const targetPumpMlS = Math.pow(
    Math.max(0.01, p.targets.s2) / Math.max(0.01, p.plant.cupGain * p.plant.efficiency),
    1 / Math.max(0.05, p.plant.cupExp),
  );
  const simRefill = { active: false, enteredAt: null, startedAt: 0, boost: 0 };
  const refillEvents = [];
  m.state = 'espresso';
  m.substate = 'pouring';
  m.baseCommand = Number(stepAt(0).flow) || 0;
  m.writeCommand = null;
  if (m.shotStartSec == null) m.shotStartSec = 0;
  const useReplay = !!replay;
  const replayLastT = useReplay ? replay.frames[replay.frames.length - 1].t : 0;
  let replayEnded = false;

  // S3 timed subframes advance by profile time, like the machine does.
  let frameEnteredAt = 0, autoFrame = m.frame;
  // Replay runs on its own recording clock: the plugin may request espresso a
  // second time (active release restart), which resets machine.shotStartSec,
  // so the recording timeline must be anchored to the first t instead.
  let replayStart = null;

  while (t < p.maxSeconds) {
    await env.advance(dt * 1000);

    // Automatic timed advance inside S3 (frames >=2), like the DE1 profile clock.
    let frame = m.frame;
    if (frame >= 2) {
      if (frame !== autoFrame) { autoFrame = frame; frameEnteredAt = t; }
      const secs = Number(stepAt(frame).seconds);
      if (Number.isFinite(secs) && secs > 0 && t - frameEnteredAt >= secs && frame < profile.steps.length - 1) {
        m.frame = frame + 1; autoFrame = m.frame; frameEnteredAt = t; frame = m.frame;
      }
    }
    if (frame !== autoFrame) { autoFrame = frame; frameEnteredAt = t; }
    if (frame !== m.baseFrame) { m.baseFrame = frame; m.writeCommand = null; m.baseCommand = Number(stepAt(frame).flow) || 0; }

    // Hydraulic plant modelled on Decaid's mock DE1: 100 ms ticks, first-order
    // flow response, puck pressure and the current frame's pressure limiter.
    const step = stepAt(frame);
    // Simulator-side refill whose percentage applies to the S2 target instead of
    // the plugin's base pump command. Enabled only when basis === 'target';
    // disabled in replay mode (machine flow is already fixed by the recording).
    const useSimRefill = !useReplay && p.refill.enabled && p.refill.basis === 'target';
    if (useSimRefill && m.state === 'espresso' && s.phase === 'stage2' && m.frame === 1) {
      if (simRefill.enteredAt == null) simRefill.enteredAt = t;
      const age = t - simRefill.enteredAt;
      if (!simRefill.started && age >= p.refill.startDelayMs / 1000) {
        simRefill.started = true;
        simRefill.startedAt = t;
        simRefill.boost = Math.min(MACHINE.maxFlowMlS, targetPumpMlS * p.refill.targetPercent / 100);
        simRefill.active = true;
        refillEvents.push({ t: round(t, 2), kind: 'boost', boostMlS: round(simRefill.boost, 3), targetPumpMlS: round(targetPumpMlS, 3) });
      }
      if (simRefill.active) {
        const cutoff = p.targets.s2 * p.refill.cutoffPercent / 100;
        if (cupFlow >= cutoff || t - simRefill.startedAt >= p.refill.maxDurationMs / 1000) {
          simRefill.active = false;
          refillEvents.push({ t: round(t, 2), kind: 'return', reason: cupFlow >= cutoff ? 'cutoff' : 'timeout' });
        }
      }
    } else if (simRefill.active) {
      simRefill.active = false;
      refillEvents.push({ t: round(t, 2), kind: 'return', reason: 'stage-ended' });
    }
    const pluginCmd = m.state === 'espresso' ? (m.writeCommand == null ? m.baseCommand : m.writeCommand) : 0;
    const cmd = simRefill.active ? simRefill.boost : pluginCmd;
    dead.push({ t, cmd });
    while (dead.length && dead[0].t < t - p.plant.deadTime) dead.shift();
    const commandedMlS = dead.length ? dead[0].cmd : 0;
    let targetMlS = commandedMlS;
    if (targetMlS > MACHINE.maxFlowMlS) {
      noteViolation('pump-flow', t, targetMlS, MACHINE.maxFlowMlS);
      targetMlS = MACHINE.maxFlowMlS;
    }
    if (useReplay) {
      if (replayStart == null) replayStart = t;
      const elapsed = Math.max(0, t - replayStart);
      const rec = sampleRecording(replay, elapsed);
      m.machineFlow = Math.max(0, rec.f);
      m.pressure = Math.max(0, rec.p);
      cupFlow = Math.max(0, rec.wf);
      weight = Math.max(0, rec.w);
      if (replay.phaseDriven) {
        // Real recorded machine sequence (plugin history export): feed the
        // plugin the same state/substate the real machine showed so its active
        // release / soak / restart flow can follow it.
        const ph = rec.phase || 'stage1';
        if (ph === 'stage1' || ph === 'stage2' || ph === 'stage3' || ph === 'preinfusion') {
          m.state = 'espresso';
          m.substate = ph === 'preinfusion' ? 'preinfusion' : 'pouring';
        } else if (ph === 'soak') {
          m.state = 'idle'; m.substate = 'soak';
        } else if (ph === 'restart_wait') {
          m.state = 'idle'; m.substate = 'restart_wait';
        } else if (ph === 'finishing') {
          m.state = 'idle'; m.substate = 'finishing';
        } else {
          m.state = 'idle'; m.substate = 'idle'; // dumping / unknown
        }
      } else {
        // Replay substate follows the recording's pour boundary (official
        // simulateReplay semantics); plugin frame state is driven by skipStep.
        if (elapsed < 0.5) m.substate = 'preparingForShot';
        else if (elapsed < replay.preinfusionStopSec) m.substate = 'preinfusion';
        else m.substate = 'pouring';
      }
      if (elapsed >= replayLastT) {
        if (!replayEnded) {
          replayEnded = true;
          m.substate = 'pouringDone';
          m.state = 'idle';
        }
      }
    } else if (m.state === 'espresso') {
      // Official mock_de1 flow-step physics (mock_de1.dart _simulateWithProfile):
      // newFlow approaches targetMlS at pumpResponse per tick but never exceeds
      // it; pressure = flow * puckResistance(shotSecs), damped at the same rate;
      // the frame limiter is applied asymptotically (applyLimiter), and any
      // limiter hit pulls flow back toward limiter/resistance. The physical
      // 11 bar ceiling is a hard cap that also pulls flow back.
      const rate = Math.min(1, Math.max(0.01, p.plant.pumpResponse));
      const shotSecs = m.shotStartSec == null ? 0 : Math.max(0, t - m.shotStartSec);
      const resistance = puckResistance(shotSecs, p.plant);
      let newFlow = m.machineFlow + (targetMlS - m.machineFlow) * rate;
      if (newFlow > targetMlS) newFlow = targetMlS; // flow step: never overshoot target
      let newPressure = m.pressure + (newFlow * resistance - m.pressure) * rate;
      const limitedPressure = applyLimiter(newPressure, step.limiter);
      if (limitedPressure < newPressure) {
        newPressure = limitedPressure;
        newFlow = Math.min(newFlow, limitedPressure / resistance);
      }
      if (newPressure > MACHINE.maxPressureBar) {
        noteViolation('pressure', t, newPressure, MACHINE.maxPressureBar);
        newPressure = MACHINE.maxPressureBar;
        newFlow = Math.min(newFlow, MACHINE.maxPressureBar / resistance);
      }
      m.machineFlow = newFlow;
      m.pressure = newPressure;
    } else {
      m.machineFlow += (0 - m.machineFlow) * 0.35;
      m.pressure = 0;
    }
    if (!useReplay) {
      cupFlow = cupFlowForMachineFlow(m.machineFlow, p.plant) * p.plant.efficiency;
      weight += cupFlow * dt;
    }
    const pressure = m.pressure;

    t += dt;

    if (t - lastSample >= 0.1) {
      lastSample = t;
      const noisy = useReplay ? weight : Math.max(0, weight + gauss() * p.plant.noise);
      h.onScaleSnapshot({ weight: noisy, weightFlow: cupFlow, timestamp: round(t, 3) });
      await env.drain();
    }
    if (t - lastState >= 0.2) {
      lastState = t;
      h.handleStateUpdate({
        state: { state: m.state, substate: m.substate },
        pressure: round(pressure, 3),
        flow: round(m.machineFlow, 3),
        targetFlow: round(m.state === 'espresso' ? cmd : 0, 3),
        profileFrame: m.frame,
      });
      await env.drain();
    }

    series.push({
      t: round(t, 2), weight: round(weight, 2), cupFlow: round(cupFlow, 3),
      command: round(cmd, 4), machineFlow: round(m.machineFlow, 3),
      pressure: round(pressure, 2), frame: m.frame, phase: s.phase,
    });

    if (useReplay && replayEnded) break;

    if (s.phase === 'idle' && t > 1 && s.diagnosticLast) break;
    if (s.phase === 'aborted') break;
  }

  const run = s.diagnosticLast;
  const trace = (run && run.liveFlowTrim && run.liveFlowTrim.trace) || [];
  const writes = trace.filter(x => x.kind === 'write');
  return {
    ok: true,
    version: env.plugin.version,
    params: p,
    series,
    writes: writes.map(x => ({ t: round(x.tMs / 1000, 2), frame: x.frame, commandMlS: x.commandMlS, action: x.startupAction || 'trim' })),
    trace: trace.map(x => ({ t: round(x.tMs / 1000, 2), kind: x.kind, frame: x.frame, reason: x.reason || '', commandMlS: x.commandMlS })),
    summary: run ? h.diagnosticSummary(run) : null,
    plan: run && run.config ? run.config.s2StartupPlan : null,
    simRefill: { targetPumpMlS: round(targetPumpMlS, 3), events: refillEvents },
    applied: run && run.config ? { s1: run.config.stage1CommandMlS, s2: run.config.stage2CommandMlS, s3: run.config.stage3CommandMlS } : null,
    machineLimits: MACHINE,
    replay: useReplay ? { index: input.replay.index, title: replay.title, duration: replay.duration, lastT: replayLastT } : null,
    violations: env.violations.slice(0, 40),
    startup: run && run.liveFlowTrim ? run.liveFlowTrim.startupExecution : null,
    report: run && run.liveFlowTrim ? { checks: run.liveFlowTrim.checks, writes: run.liveFlowTrim.writes, retries: run.liveFlowTrim.retries, misses: run.liveFlowTrim.targetMisses, status: run.liveFlowTrim.status } : null,
    ended: { phase: s.phase, weight: round(weight, 2), seconds: round(t, 2), liveTrimStatus: run && run.liveFlowTrim && run.liveFlowTrim.status },
    debug: s.liveTrim ? { started: s.liveTrim.started, status: s.liveTrim.report.status, checks: s.liveTrim.report.checks, writes: s.liveTrim.report.writes, handle: !!s.liveTrim.handle, lastReason: (s.liveTrim.report.trace.filter(x => x.kind === 'check').slice(-1)[0] || {}).reason } : null,
    logs: logs.slice(-60),
  };
}

module.exports = { runShot, plantDefaults, PLUGIN_FILE, recordings, historyRecordings };

if (require.main === module) {
  const params = process.argv[2] ? JSON.parse(process.argv[2]) : {};
  runShot(params).then(r => {
    console.log(JSON.stringify({
      ended: r.ended, writes: r.writes.length,
      summary: r.summary && { s1: r.summary.stage1 && r.summary.stage1.rawRegressionGS, s2: r.summary.stage2 && r.summary.stage2.rawRegressionGS, s3: r.summary.stage3 && r.summary.stage3.rawRegressionGS },
      tail: r.series.slice(-3), logs: r.logs.slice(-40),
    }, null, 2));
  }).catch(e => { console.error(e); process.exit(1); });
}

