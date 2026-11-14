// Run: node tests/verify_v0100.cjs [path/to/plugin.js]
// Hooks are injected in memory only. The shipped plugin has no test exports.
const fs = require('fs'), vm = require('vm'), assert = require('assert/strict');
const path = require('path');
const file = process.argv[2] || path.join(__dirname, '..', 'plugin.js');
const source = fs.readFileSync(file, 'utf8');
const copy = x => JSON.parse(JSON.stringify(x));
const HxArchive = require(fs.existsSync(path.join(__dirname, '..', '..', 'sim', 'archive-core.js'))
  ? path.join(__dirname, '..', '..', 'sim', 'archive-core.js')
  : 'D:/vscode/decenthyperexplugin/sim/archive-core.js');
const tests = []; const test = (name, fn) => tests.push([name, fn]);

function setup(options = {}) {
  const timers = new Map(); let timerId = 0, plugin;
  const storage = {}; const pendingReads = []; const storageCalls = []; const logs = [];
  const mock = { hyperexStatus: null, hyperexFail: false, workflowTitle: 'Default Profile', ...options };
  // Resolve transport.open synchronously so the scale listener is registered
  // before onLoad returns (real host resolves async; tests need determinism).
  const immediatePromise = (v) => ({ then(fn) { const r = fn(v); return r && r.then ? r : immediatePromise(r); }, catch() { return this; } });
  const flush = () => new Promise(r => setImmediate(r));
  let clock = options.now || 1763100000000;
  class TestDate extends Date { static now() { return clock; } }
  const host = {
    log(m) { logs.push(String(m)); },
    storage(req) {
      storageCalls.push(copy(req));
      if (req.type === 'write') {
        if (mock.failWrite) throw Error('storage unavailable');
        storage[req.key] = req.data;
      } else pendingReads.push({ key: req.key, value: storage[req.key] ?? null });
    },
    transport: {
      open: () => immediatePromise({ handle: 'scale-test' }),
      onEvent(handle, fn) { mock.scaleListener = fn; },
      close: () => immediatePromise(undefined)
    }
  };
  const fetchCalls = [];
  const context = vm.createContext({
    console, Date: TestDate, Math, JSON, Map, Promise, Object, Array, Number, String, Boolean, Error, RegExp,
    setTimeout(fn, ms) { const id = ++timerId; timers.set(id, { fn, ms }); return id; },
    clearTimeout(id) { timers.delete(id); },
    fetch: async (url, opt) => {
      fetchCalls.push({ url, opt });
      if (String(url).includes('/plugins/decenthyperexplugin.reaplugin/status')) {
        if (mock.hyperexFail) throw Error('connect ECONNREFUSED');
        if (mock.hyperexStatus === null) return { ok: false, status: 404, json: async () => ({}) };
        return { ok: true, status: 200, json: async () => copy(mock.hyperexStatus) };
      }
      if (String(url).endsWith('/workflow')) {
        return { ok: true, status: 200, json: async () => ({ profile: { title: mock.workflowTitle } }) };
      }
      throw Error('unexpected fetch ' + url);
    }
  });
  const injection = 'globalThis.hooks={state,extractMachine,noteMachine,handleStateUpdate,startRun,finishRun,sample,captureRawScaleSample,onScaleSnapshot,queueOwnership,probeOwnership,settleOwnership,hyperexMatches,appendHistory,trimHistory,persistHistory,onStorageRead,historyExportPayload,statusPayload,loadConfig,clearAllTimers,scheduleScaleReconnect,handleScaleTransportEvent,connectScaleStream,closeScaleStream};\n';
  const token = '  return {\n    id: ID,';
  assert(source.includes(token), 'injection token missing');
  vm.runInContext(source.replace(token, injection + token), context);
  plugin = context.createPlugin(host);
  const h = context.hooks;
  function run(id) { const t = timers.get(id); assert(t, 'missing timer ' + id); timers.delete(id); return t.fn(); }
  function runAll() { const ids = [...timers.keys()]; for (const id of ids) run(id); return ids.length; }
  function event(name, payload) { plugin.onEvent({ name, payload }); }
  function deliverReads() { let n = 0; while (pendingReads.length) { assert(++n < 100); const r = pendingReads.shift(); event('storageRead', { key: r.key, value: r.value }); } }
  function scaleData(data) { mock.scaleListener({ type: 'data', data: JSON.stringify(data) }); }
  function espresso(sub = 'pouring', extra = {}) { event('stateUpdate', { state: { state: 'espresso', substate: sub }, pressure: 3, flow: 2, targetFlow: 2.5, targetPressure: 9, weightFlow: 1.8, profileFrame: 1, ...extra }); }
  function idle() { event('stateUpdate', { state: { state: 'idle', substate: 'idle' }, pressure: 0, flow: 0 }); }
  function shot(startMs, endMs, title) {
    clock = startMs;
    if (title !== undefined) mock.workflowTitle = title;
    event('workflowUpdated', { profile: { title: mock.workflowTitle } });
    espresso();
    for (let i = 1; i <= 5; i++) { clock = startMs + i * 1000; scaleData({ weight: i * 8, weightFlow: 2, timestamp: (startMs + i * 1000) / 1000 }); }
    clock = endMs;
    idle();
    return h.state.pendingOwnership[h.state.pendingOwnership.length - 1];
  }
  return { h, s: h.state, plugin, mock, storage, storageCalls, pendingReads, fetchCalls, logs, timers, run, runAll, event, deliverReads, scaleData, espresso, idle, shot, flush, advance(ms) { clock += ms; }, now() { return clock; }, setNow(ms) { clock = ms; } };
}

function loaded(options = {}) {
  const e = setup(options);
  e.plugin.onLoad({ Enabled: true, SampleIntervalMs: 100 });
  e.deliverReads();
  return e;
}

// ---- config / machine extraction ----

test('config clamps interval and parses enabled', () => {
  const e = setup();
  assert.equal(e.h.loadConfig({ SampleIntervalMs: 5 }).sampleIntervalMs, 50);
  assert.equal(e.h.loadConfig({ SampleIntervalMs: 5 }).enabled, true);
  assert.deepEqual(e.h.loadConfig({ SampleIntervalMs: 99999 }).sampleIntervalMs, 1000);
  assert.equal(e.h.loadConfig({ Enabled: false }).enabled, false);
  assert.equal(e.h.loadConfig({ Enabled: 'false' }).enabled, false);
  assert.equal(e.h.loadConfig({}).enabled, true);
});

test('extractMachine mirrors HyperEx shape and picks up temperatures', () => {
  const e = setup();
  const m = e.h.extractMachine({ state: { state: 'espresso', substate: 'pouring' }, pressure: 3.1, flow: 2.2, targetFlow: 2.5, targetPressure: 9, weightFlow: 1.8, profileFrame: 2, mixTemperature: 92.1, groupTemperature: 91.5, targetMixTemperature: 92, targetGroupTemperature: 92, steamTemperature: 130 });
  assert.equal(m.machineState, 'espresso'); assert.equal(m.substate, 'pouring');
  assert.equal(m.telemetryValid, true); assert.equal(m.targetFlow, 2.5); assert.equal(m.machineWeightFlow, 1.8);
  assert.equal(m.temperatures.mixTemperature, 92.1); assert.equal(m.temperatures.steamTemperature, 130);
  const bare = e.h.extractMachine({ state: 'idle' });
  assert.equal(bare.temperatures, null); assert.equal(bare.telemetryValid, false);
});

// ---- lifecycle ----

test('espresso starts a run; idle finalizes and queues ownership', async () => {
  const e = loaded();
  await e.flush();
  assert.equal(e.s.workflowTitle, 'Default Profile');
  e.espresso();
  assert.equal(e.s.phase, 'recording'); assert(e.s.run); assert(e.s.run.runId.startsWith('pr-'));
  assert.equal(e.s.run.profileTitle, 'Default Profile');
  e.advance(1000); e.scaleData({ weight: 10, weightFlow: 2, timestamp: e.now() / 1000 });
  e.advance(1000); e.idle();
  assert.equal(e.s.phase, 'idle'); assert.equal(e.s.run, null);
  assert.equal(e.s.pendingOwnership.length, 1);
  const run = e.s.pendingOwnership[0].run;
  assert(run.samples.length >= 2); assert(run.rawScaleSamples.length >= 1);
  assert(run.events.some(x => x.name === 'sequence_start')); assert(run.events.some(x => x.name === 'sequence_end'));
  assert(run.endedAt);
});

test('samples carry machine + scale + temperature columns', async () => {
  const e = loaded();
  await e.flush();
  e.event('stateUpdate', { state: { state: 'espresso', substate: 'pouring' }, pressure: 3, flow: 2, targetFlow: 2.5, targetPressure: 9, weightFlow: 1.8, profileFrame: 1, mixTemperature: 92.1, groupTemperature: 91.5, targetMixTemperature: 92, targetGroupTemperature: 92, steamTemperature: 130 });
  e.advance(200);
  e.scaleData({ weight: 12.5, weightFlow: 2.1, timestamp: e.now() / 1000 });
  const run = e.s.run;
  const sm = run.samples[run.samples.length - 1];
  assert.equal(sm.pressureBar, 3); assert.equal(sm.targetFlowMlS, 2.5); assert.equal(sm.targetPressureBar, 9);
  assert.equal(sm.machineWeightFlowGS, 1.8); assert.equal(sm.mixTemperature, 92.1); assert.equal(sm.steamTemperature, 130);
  const raw = run.rawScaleSamples[run.rawScaleSamples.length - 1];
  assert.equal(raw.weightG, 12.5); assert.equal(raw.decaidWeightFlowGS, 2.1); assert.equal(raw.mixTemperature, 92.1);
  assert.equal(raw.scaleTimestampSeconds, e.now() / 1000);
});

test('raw dW/dt uses scale timestamps; tare drop flags reset and nulls derivative', async () => {
  const e = loaded();
  await e.flush();
  e.espresso();
  e.advance(1000); e.scaleData({ weight: 10, weightFlow: 2, timestamp: e.now() / 1000 });
  e.advance(1000); e.scaleData({ weight: 14, weightFlow: 4, timestamp: e.now() / 1000 });
  let raw = e.s.run.rawScaleSamples; assert.equal(raw[raw.length - 1].rawDwDtGS, 4);
  e.advance(1000); e.scaleData({ weight: 1, weightFlow: 0, timestamp: e.now() / 1000 });
  raw = e.s.run.rawScaleSamples;
  assert.equal(raw[raw.length - 1].tareReset, true); assert.equal(raw[raw.length - 1].rawDwDtGS, null);
});

test('sample cadence respects interval; caps bound arrays', async () => {
  const e = loaded();
  await e.flush();
  e.espresso();
  for (let i = 0; i < 10; i++) { e.advance(30); e.h.sample('machine', false); }
  assert.equal(e.s.run.samples.filter(x => x.source === 'machine').length <= 4, true);
  for (let i = 0; i < 3100; i++) { e.advance(100); e.h.sample('machine', true); }
  assert.equal(e.s.run.samples.length, 3000);
  for (let i = 0; i < 12050; i++) { e.advance(100); e.h.captureRawScaleSample({ timestamp: e.now() / 1000 }, i * 0.01, 1, e.now()); }
  assert.equal(e.s.run.rawScaleSamples.length, 12000);
});

test('disabled plugin records nothing but keeps serving history', async () => {
  const e = setup();
  e.plugin.onLoad({ Enabled: false });
  e.deliverReads();
  e.espresso(); e.advance(1000); e.idle();
  assert.equal(e.s.run, null); assert.equal(e.s.pendingOwnership.length, 0);
  const res = await e.plugin.__httpRequestHandler({ requestId: 'r', endpoint: 'history-export' });
  assert.equal(res.status, 200);
  assert.equal(JSON.parse(res.body).count, 0);
});

test('workflow title changes mid-run are logged as events', async () => {
  const e = loaded();
  await e.flush();
  e.espresso();
  e.event('workflowUpdated', { profile: { title: 'Another Profile' } });
  assert(e.s.run.events.some(x => x.name === 'workflow_changed' && x.data.profileTitle === 'Another Profile'));
});

// ---- ownership ----

test('matching HyperEx summary drops the recorder run', async () => {
  const e = loaded();
  await e.flush();
  const start = e.now();
  const entry = e.shot(start, start + 30000);
  e.mock.hyperexStatus = { diagnosticSummary: { runId: String(start) + '-1', startedAt: new Date(start + 500).toISOString(), endedAt: new Date(start + 30500).toISOString() } };
  await e.h.probeOwnership(entry);
  assert.equal(entry.settled, true);
  assert.equal(e.s.pendingOwnership.length, 0);
  assert.equal(e.s.historyFile.shots.length, 0); // dropped, never appended
  assert(e.logs.some(l => l.includes('Dropped')));
});

test('HyperEx 404 keeps the recorder run after probes', async () => {
  const e = loaded();
  await e.flush();
  const start = e.now();
  const entry = e.shot(start, start + 30000);
  e.mock.hyperexStatus = null; // 404
  for (const id of [...e.timers.keys()]) { const t = e.timers.get(id); if (t.ms === 2000 || t.ms === 5000 || t.ms === 8000) { e.timers.delete(id); await t.fn(); } }
  assert.equal(entry.settled, false); // still waiting for timeout
  e.setNow(start + 30000 + 12000);
  for (const id of [...e.timers.keys()]) { const t = e.timers.get(id); if (t.ms === 12000) { e.timers.delete(id); await t.fn(); } }
  assert.equal(entry.settled, true);
  assert.equal(e.s.historyFile.shots.length, 1);
  assert(e.logs.some(l => l.includes('Keeping')));
});

test('HyperEx unreachable (fetch throws) keeps the run', async () => {
  const e = loaded();
  await e.flush();
  const start = e.now();
  const entry = e.shot(start, start + 30000);
  e.mock.hyperexFail = true;
  e.setNow(start + 30000 + 12000);
  for (const id of [...e.timers.keys()]) { const t = e.timers.get(id); if (t.ms === 12000) { e.timers.delete(id); await t.fn(); } }
  assert.equal(e.s.historyFile.shots.length, 1);
});

test('non-matching HyperEx summary (different cup) keeps the run', async () => {
  const e = loaded();
  await e.flush();
  const start = e.now();
  const entry = e.shot(start, start + 30000);
  e.mock.hyperexStatus = { diagnosticSummary: { runId: 'old', startedAt: new Date(start - 600000).toISOString(), endedAt: new Date(start - 570000).toISOString() } };
  e.setNow(start + 30000 + 12000);
  for (const id of [...e.timers.keys()]) { const t = e.timers.get(id); if (t.ms === 12000) { e.timers.delete(id); await t.fn(); } }
  assert.equal(e.s.historyFile.shots.length, 1);
});

test('match windows: start ±5s, end ±10s', () => {
  const e = setup();
  const run = { startedAtMs: 1000000, endedAtMs: 1030000 };
  const sum = (s, en) => ({ runId: 'x', startedAt: new Date(s).toISOString(), endedAt: new Date(en).toISOString() });
  assert.equal(e.h.hyperexMatches(sum(1004999, 1039999), run), true);
  assert.equal(e.h.hyperexMatches(sum(1005001, 1030000), run), false);
  assert.equal(e.h.hyperexMatches(sum(1000000, 1040001), run), false);
  assert.equal(e.h.hyperexMatches(null, run), false);
  assert.equal(e.h.hyperexMatches({ runId: 'x' }, run), false);
});

test('late HyperEx evidence after timeout does not duplicate or resurrect', async () => {
  const e = loaded();
  await e.flush();
  const start = e.now();
  const entry = e.shot(start, start + 30000);
  e.setNow(start + 42000);
  e.h.settleOwnership(entry, 'keep', 'timeout');
  assert.equal(e.s.historyFile.shots.length, 1);
  e.mock.hyperexStatus = { diagnosticSummary: { runId: 'x', startedAt: new Date(start).toISOString(), endedAt: new Date(start + 30000).toISOString() } };
  await e.h.probeOwnership(entry); // settled: no-op
  assert.equal(e.s.historyFile.shots.length, 1);
});

// ---- history persistence ----

test('history keeps newest 4 full records, overwriting older', async () => {
  const e = loaded();
  await e.flush();
  for (let i = 0; i < 6; i++) {
    const start = e.now() + i * 60000;
    const entry = e.shot(start, start + 30000);
    e.h.settleOwnership(entry, 'keep', 'test');
  }
  assert.equal(e.s.historyFile.shots.length, 4);
  const ids = e.s.historyFile.shots.map(x => x.runId);
  assert.equal(new Set(ids).size, 4);
  assert(e.s.historyFile.shots.every(x => x.fullRecord && x.fullRecord.samples.length > 0));
});

test('write persists JSON string and readback merges without loss', async () => {
  const e = loaded();
  await e.flush();
  const start = e.now();
  const entry = e.shot(start, start + 30000);
  e.h.settleOwnership(entry, 'keep', 'test');
  e.runAll(); // fire write timer
  const raw = e.storage.profileRecorderHistoryV1;
  assert.equal(typeof raw, 'string');
  const parsed = JSON.parse(raw);
  assert.equal(parsed.kind, 'ProfileRecorderHistory');
  assert.equal(parsed.shots.length, 1);
  e.deliverReads(); // readback echo
  assert.equal(e.s.historyLoaded, true);
  assert.equal(e.s.historyFile.shots.length, 1);
});

test('reload restores history from storage', async () => {
  const e = loaded();
  await e.flush();
  const start = e.now();
  const entry = e.shot(start, start + 30000);
  e.h.settleOwnership(entry, 'keep', 'test');
  e.runAll(); e.deliverReads();
  const e2 = setup({ now: e.now() + 60000 });
  e2.storage.profileRecorderHistoryV1 = e.storage.profileRecorderHistoryV1;
  e2.plugin.onLoad({});
  await e.flush();
  e2.deliverReads();
  assert.equal(e2.s.historyFile.shots.length, 1);
  assert.equal(e2.s.historyFile.shots[0].runId, entry.run.runId);
});

test('late initial read merges newer session record', async () => {
  const e = setup();
  e.plugin.onLoad({});
  await e.flush();
  // session record arrives before the initial storage read
  const start = e.now();
  const entry = e.shot(start, start + 30000);
  e.h.settleOwnership(entry, 'keep', 'test');
  e.storage.profileRecorderHistoryV1 = JSON.stringify({ schema: 1, kind: 'ProfileRecorderHistory', shots: [{ runId: 'old-disk', startedAt: new Date(start - 60000).toISOString(), fullRecord: { samples: [], rawScaleSamples: [], events: [], liveFlowTrim: null } }] });
  e.pendingReads.length = 0;
  e.pendingReads.push({ key: 'profileRecorderHistoryV1', value: e.storage.profileRecorderHistoryV1 });
  e.deliverReads();
  const ids = e.s.historyFile.shots.map(x => x.runId);
  assert.deepEqual(ids, ['old-disk', entry.run.runId]);
});

test('storage write failure is reported, not thrown', async () => {
  const e = loaded();
  await e.flush();
  e.mock.failWrite = true;
  const start = e.now();
  const entry = e.shot(start, start + 30000);
  e.h.settleOwnership(entry, 'keep', 'test');
  e.runAll();
  assert(e.s.storageError);
  assert.equal(e.s.historyFile.shots.length, 1); // in-memory intact
});

// ---- export / status / merge compatibility ----

test('history-export matches HyperEx export shape and merges via archive-core', async () => {
  const e = loaded();
  await e.flush();
  const start = e.now();
  const entry = e.shot(start, start + 30000);
  e.h.settleOwnership(entry, 'keep', 'test');
  const res = await e.plugin.__httpRequestHandler({ requestId: 'r1', endpoint: 'history-export' });
  assert.equal(res.status, 200);
  assert.equal(res.requestId, 'r1');
  const payload = JSON.parse(res.body);
  assert.equal(payload.kind, 'HyperExHistoryExport');
  assert.equal(payload.schema, 1);
  assert.equal(payload.count, 1);
  assert.equal(payload.shots[0].runId, entry.run.runId);
  // merge into an empty archive, then merge again: idempotent
  let archive = HxArchive.emptyArchive();
  const r1 = HxArchive.merge(archive, payload, 0);
  assert.equal(r1.stats.newShots, 1);
  const r2 = HxArchive.merge(r1.archive, payload, 0);
  assert.equal(r2.stats.newShots, 0);
  assert.equal(r2.archive.count, 1);
  assert.equal(r2.archive.fullRecordCount, 1);
  const shot = r2.archive.shots[0];
  assert(shot.fullRecord.samples.length > 0);
  assert(shot.fullRecord.rawScaleSamples.length > 0);
});

test('recorder export and HyperEx export merge without runId collision', async () => {
  const e = loaded();
  await e.flush();
  const start = e.now();
  const entry = e.shot(start, start + 30000);
  e.h.settleOwnership(entry, 'keep', 'test');
  const rec = JSON.parse((await e.plugin.__httpRequestHandler({ requestId: 'r', endpoint: 'history-export' })).body);
  const hyperex = {
    kind: 'HyperExHistoryExport', schema: 1, count: 1,
    shots: [{ runId: String(start + 60000) + '-1', startedAt: new Date(start + 60000).toISOString(), result: 'completed', fullRecord: { samples: [{ tMs: 0, pressureBar: 1 }], rawScaleSamples: [{ tMs: 0, weightG: 0 }], events: [], liveFlowTrim: null } }]
  };
  let archive = HxArchive.emptyArchive();
  archive = HxArchive.merge(archive, rec, 0).archive;
  archive = HxArchive.merge(archive, hyperex, 0).archive;
  assert.equal(archive.count, 2);
  assert.equal(archive.fullRecordCount, 2);
});

test('status endpoint reports recording and history state', async () => {
  const e = loaded();
  await e.flush();
  e.espresso();
  const res = await e.plugin.__httpRequestHandler({ requestId: 's', endpoint: 'status' });
  const body = JSON.parse(res.body);
  assert.equal(body.id, 'profilerecorder.reaplugin');
  assert.equal(body.recording, true);
  assert.equal(body.phase, 'recording');
  assert.equal(body.historyShots, 0);
});

test('unknown endpoint returns 404', async () => {
  const e = loaded();
  const res = await e.plugin.__httpRequestHandler({ requestId: 'x', endpoint: 'nope' });
  assert.equal(res.status, 404);
});

// ---- unload / reconnect ----

test('unload finalizes current run and keeps pending ownership runs', async () => {
  const e = loaded();
  await e.flush();
  const start = e.now();
  const entry = e.shot(start, start + 30000); // pending ownership
  e.espresso(); // second run in progress
  e.advance(1000);
  e.plugin.onUnload();
  assert.equal(e.s.run, null);
  assert.equal(e.s.pendingOwnership.length, 0);
  assert.equal(e.s.historyFile.shots.length, 2);
  assert(e.s.historyFile.shots.some(x => x.result === 'interrupted: plugin unloaded'));
  assert.equal(e.s.scaleHandle, null);
  assert.equal(e.timers.size, 0);
});

test('scale stream reconnects after close event', async () => {
  const e = loaded();
  await e.flush();
  e.mock.scaleListener({ type: 'close' });
  assert.equal(e.s.scaleHandle, null);
  assert(e.s.scaleReconnectTimer !== null);
  e.run(e.s.scaleReconnectTimer);
  assert.equal(e.s.scaleHandle, 'scale-test');
});

test('scale status frames do not create samples', async () => {
  const e = loaded();
  await e.flush();
  e.espresso();
  const before = e.s.run.rawScaleSamples.length;
  e.scaleData({ status: 'connected' });
  e.scaleData({ status: 'disconnected' });
  assert.equal(e.s.run.rawScaleSamples.length, before);
  assert.equal(e.s.scaleConnected, false);
});

(async () => {
  let pass = 0, fail = 0;
  for (const [name, fn] of tests) {
    try { await fn(); pass++; console.log('ok   ' + name); }
    catch (error) { fail++; console.log('FAIL ' + name + '\n     ' + (error && error.stack || error)); }
  }
  console.log('\n' + pass + '/' + (pass + fail) + ' passed');
  process.exit(fail ? 1 : 0);
})();

