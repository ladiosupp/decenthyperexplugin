// HyperEx offline shot simulator.
// Loads the real plugin.js, injects test hooks, and drives one shot against a
// simple hydraulic plant. No machine, no network, no Decaid host required.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PLUGIN_FILE = path.join(__dirname, '..', 'decenthyperexplugin.reaplugin', 'plugin.js');

// Machine envelope, taken from Decaid's mock DE1 (lib/src/models/device/impl/
// mock_de1/mock_de1.dart): pumpMaxFlow = 8.0 ml/s, physicalMaxPressure = 11.0 bar.
// The simulator enforces these as machine behaviour; the plugin's own limits are
// deliberately not used here, so an over-asking plugin gets clamped by the machine.
const MACHINE = Object.freeze({ maxFlowMlS: 8.0, maxPressureBar: 11.0 });

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
  const machine = { state: 'idle', substate: 'idle', frame: 0, command: 0, requested: 0, flow: 0, pressure: 0, baseCommand: 0, writeCommand: null, baseFrame: -1, machineFlow: 0 };
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
      else if (cmd === 'espresso') { machine.state = 'espresso'; machine.substate = 'preinfusion'; machine.frame = 0; machine.writeCommand = null; machine.machineFlow = 0; }
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
  return { efficiency: 1.0, cupGain: 1.883, cupExp: 0.564, pumpResponse: 0.35, deadTime: 0.2, noise: 0.015, pressureK: 0.22, pressureB: 0.1 };
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
  });
  s.cfg = cfg;
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
    refill: { enabled: true, startDelayMs: 0, targetPercent: 160, cutoffPercent: 85, maxDurationMs: 4000, approachMs: 3000 },
    plant: plantDefaults(), policy: '正常', maxSeconds: 90,
  };
  const input = params || {};
  const p = { ...defaults, ...input };
  for (const key of ['targets', 'weights', 'liveTrim', 'refill', 'plant']) {
    p[key] = { ...defaults[key], ...(input[key] || {}) };
  }

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
  m.state = 'espresso';
  m.substate = 'pouring';
  m.baseCommand = Number(stepAt(0).flow) || 0;
  m.writeCommand = null;

  // S3 timed subframes advance by profile time, like the machine does.
  let frameEnteredAt = 0, autoFrame = m.frame;

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
    const cmd = m.state === 'espresso' ? (m.writeCommand == null ? m.baseCommand : m.writeCommand) : 0;
    dead.push({ t, cmd });
    while (dead.length && dead[0].t < t - p.plant.deadTime) dead.shift();
    const commandedMlS = dead.length ? dead[0].cmd : 0;
    let targetMlS = commandedMlS;
    if (targetMlS > MACHINE.maxFlowMlS) {
      noteViolation('pump-flow', t, targetMlS, MACHINE.maxFlowMlS);
      targetMlS = MACHINE.maxFlowMlS;
    }
    const limiter = Math.min(MACHINE.maxPressureBar, Number(step.limiter && step.limiter.value) || MACHINE.maxPressureBar);
    if (m.state === 'espresso') {
      const rate = Math.min(1, Math.max(0.01, p.plant.pumpResponse));
      m.machineFlow += (targetMlS - m.machineFlow) * rate;
      let pressure = p.plant.pressureB + p.plant.pressureK * m.machineFlow;
      if (pressure > limiter) {
        pressure = limiter;
        m.machineFlow = Math.max(0, (limiter - p.plant.pressureB) / p.plant.pressureK);
      }
      if (pressure > MACHINE.maxPressureBar) {
        noteViolation('pressure', t, pressure, MACHINE.maxPressureBar);
        pressure = MACHINE.maxPressureBar;
        m.machineFlow = Math.min(m.machineFlow, Math.max(0, (MACHINE.maxPressureBar - p.plant.pressureB) / p.plant.pressureK));
      }
      m.pressure = pressure;
    } else {
      m.machineFlow += (0 - m.machineFlow) * 0.35;
      m.pressure = 0.2;
    }
    cupFlow = cupFlowForMachineFlow(m.machineFlow, p.plant) * p.plant.efficiency;
    weight += cupFlow * dt;
    const pressure = m.pressure;

    t += dt;

    if (t - lastSample >= 0.1) {
      lastSample = t;
      const noisy = Math.max(0, weight + gauss() * p.plant.noise);
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
    machineLimits: MACHINE,
    violations: env.violations.slice(0, 40),
    startup: run && run.liveFlowTrim ? run.liveFlowTrim.startupExecution : null,
    report: run && run.liveFlowTrim ? { checks: run.liveFlowTrim.checks, writes: run.liveFlowTrim.writes, retries: run.liveFlowTrim.retries, misses: run.liveFlowTrim.targetMisses, status: run.liveFlowTrim.status } : null,
    ended: { phase: s.phase, weight: round(weight, 2), seconds: round(t, 2), liveTrimStatus: run && run.liveFlowTrim && run.liveFlowTrim.status },
    debug: s.liveTrim ? { started: s.liveTrim.started, status: s.liveTrim.report.status, checks: s.liveTrim.report.checks, writes: s.liveTrim.report.writes, handle: !!s.liveTrim.handle, lastReason: (s.liveTrim.report.trace.filter(x => x.kind === 'check').slice(-1)[0] || {}).reason } : null,
    logs: logs.slice(-60),
  };
}

module.exports = { runShot, plantDefaults, PLUGIN_FILE };

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

