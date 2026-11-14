function createPlugin(host) {
  "use strict";

  const API = "http://localhost:8080/api/v1";
  const SCALE_WS = "ws://localhost:8080/ws/v1/scale/snapshot";
  const HYPEREX_STATUS_URL = API + "/plugins/decenthyperexplugin.reaplugin/status";
  const ID = "profilerecorder.reaplugin";
  const PLUGIN_VERSION = "1.0.0";
  const STORAGE_HISTORY_FILE = "profileRecorderHistoryV1";
  const HISTORY_FULL_SHOTS = 4;      // newest 4 full records; older ones are dropped
  const SAMPLE_CAP = 3000;           // same caps as HyperEx diagnostics
  const RAW_SAMPLE_CAP = 12000;
  const EVENT_CAP = 300;
  const TARE_RESET_THRESHOLD_G = 2.0;
  const OWNERSHIP_PROBES_MS = [2000, 5000, 8000];
  const OWNERSHIP_TIMEOUT_MS = 12000; // give up waiting for HyperEx evidence after this
  const START_MATCH_MS = 5000;
  const END_MATCH_MS = 10000;

  const state = {
    cfg: { enabled: true, sampleIntervalMs: 100 },
    phase: "idle",
    run: null,
    runSeq: 0,
    historyFile: null,
    historyLoaded: false,
    pendingOwnership: [],
    workflowTitle: "",
    lastMachineState: null,
    lastSubstate: null,
    lastPressure: null,
    lastFlow: null,
    lastTargetFlow: null,
    lastTargetPressure: null,
    lastMachineWeightFlow: null,
    lastProfileFrame: null,
    lastTemperatures: null,
    lastMachineAtMs: 0,
    lastMachineTelemetryValid: false,
    latestRawWeight: null,
    latestWeightFlow: null,
    latestRawDwDt: null,
    latestScaleAtMs: 0,
    lastSampleAtMs: 0,
    scaleHandle: null,
    scaleConnected: false,
    scaleReconnectTimer: null,
    ownershipTimers: [],
    writeTimer: null,
    writeInFlight: false,
    writeDirty: false,
    storageError: null
  };

  function log(message) {
    try { host.log("[ProfileRecorder] " + message); } catch (_) {}
  }

  function round(value, digits) {
    if (value === null || value === undefined || value === "") return null;
    const v = Number(value);
    if (!Number.isFinite(v)) return null;
    const f = Math.pow(10, digits === undefined ? 3 : digits);
    return Math.round(v * f) / f;
  }

  function finiteOrNull(value) {
    if (value === null || value === undefined || value === "") return null;
    const v = Number(value);
    return Number.isFinite(v) ? v : null;
  }

  function parseStoredJson(value) {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "object") return value;
    try { return JSON.parse(String(value)); } catch (_) { return null; }
  }

  function loadConfig(settings) {
    const interval = Number(settings && settings.SampleIntervalMs);
    return {
      enabled: !settings || settings.Enabled === undefined ? true : settings.Enabled !== false && settings.Enabled !== "false",
      sampleIntervalMs: Math.max(50, Math.min(1000, Number.isFinite(interval) ? interval : 100))
    };
  }

  // ---- machine telemetry (mirror of HyperEx extractMachine + temperature columns) ----

  function extractMachine(payload) {
    const p = payload || {};
    const m = p.machine || p;
    const nestedState = m.state && typeof m.state === "object" ? m.state : (p.state && typeof p.state === "object" ? p.state : null);
    const machineState = nestedState ? nestedState.state : (typeof p.machineState === "string" ? p.machineState : (typeof p.state === "string" ? p.state : null));
    const substate = nestedState ? nestedState.substate : (p.machineSubstate || p.substate || null);
    const pressure = finiteOrNull(m.pressure !== undefined ? m.pressure : p.pressure);
    const flow = finiteOrNull(m.flow !== undefined ? m.flow : p.flow);
    const temperatures = {};
    let anyTemp = false;
    for (const key of ["mixTemperature", "groupTemperature", "targetMixTemperature", "targetGroupTemperature", "steamTemperature"]) {
      const v = finiteOrNull(m[key] !== undefined ? m[key] : p[key]);
      temperatures[key] = v;
      if (v !== null) anyTemp = true;
    }
    return {
      machineState,
      substate,
      pressure,
      flow,
      telemetryValid: pressure !== null && flow !== null,
      targetFlow: finiteOrNull(m.targetFlow !== undefined ? m.targetFlow : p.targetFlow),
      targetPressure: finiteOrNull(m.targetPressure !== undefined ? m.targetPressure : p.targetPressure),
      machineWeightFlow: finiteOrNull(m.weightFlow !== undefined ? m.weightFlow : p.weightFlow),
      profileFrame: m.profileFrame !== undefined ? m.profileFrame : (p.profileFrame !== undefined ? p.profileFrame : null),
      temperatures: anyTemp ? temperatures : null
    };
  }

  function noteMachine(machine) {
    if (!machine) return;
    state.lastMachineAtMs = Date.now();
    state.lastMachineState = machine.machineState;
    state.lastSubstate = machine.substate;
    state.lastPressure = machine.pressure;
    state.lastFlow = machine.flow;
    state.lastTargetFlow = machine.targetFlow;
    state.lastTargetPressure = machine.targetPressure;
    state.lastMachineWeightFlow = machine.machineWeightFlow;
    state.lastProfileFrame = machine.profileFrame;
    state.lastMachineTelemetryValid = machine.telemetryValid === true;
    if (machine.temperatures) state.lastTemperatures = machine.temperatures;
    sample("machine", false);
  }

  // ---- capture ----

  function startRun() {
    state.runSeq += 1;
    const now = Date.now();
    state.run = {
      schema: 1,
      kind: "external",
      pluginVersion: PLUGIN_VERSION,
      runId: "pr-" + now + "-" + state.runSeq,
      profileTitle: state.workflowTitle || "",
      startedAt: new Date(now).toISOString(),
      startedAtMs: now,
      endedAt: null,
      endedAtMs: null,
      result: null,
      samples: [],
      rawScaleSamples: [],
      events: []
    };
    state.lastSampleAtMs = 0;
    event("sequence_start", { profileTitle: state.workflowTitle });
    log("Capture started: " + state.run.runId + " (" + state.workflowTitle + ")");
  }

  function event(name, data) {
    const run = state.run;
    if (!run) return;
    run.events.push({
      tMs: Math.max(0, Date.now() - run.startedAtMs),
      name: String(name || "event"),
      phase: state.phase,
      data: data && typeof data === "object" ? data : (data === undefined ? {} : { value: data })
    });
    if (run.events.length > EVENT_CAP) run.events.shift();
  }

  function temperatureColumns() {
    const t = state.lastTemperatures;
    if (!t) return {};
    const out = {};
    for (const key of Object.keys(t)) if (t[key] !== null) out[key] = round(t[key], 2);
    return out;
  }

  function sample(source, force) {
    const run = state.run;
    if (!run || !state.cfg.enabled) return;
    const now = Date.now();
    if (!force && state.lastSampleAtMs && now - state.lastSampleAtMs < state.cfg.sampleIntervalMs) return;
    state.lastSampleAtMs = now;
    const scaleAgeMs = state.latestScaleAtMs ? now - state.latestScaleAtMs : null;
    const machineFlow = Number(state.lastFlow);
    const scaleFlow = Number(state.latestWeightFlow);
    const ratio = Number.isFinite(machineFlow) && Math.abs(machineFlow) >= 0.15 && Number.isFinite(scaleFlow)
      ? scaleFlow / machineFlow : null;
    run.samples.push(Object.assign({
      tMs: Math.max(0, now - run.startedAtMs),
      source: String(source || "sample"),
      phase: state.phase,
      machineState: state.lastMachineState,
      substate: state.lastSubstate,
      profileFrame: state.lastProfileFrame,
      physicalProfileFrame: state.lastProfileFrame,
      targetFlowMlS: round(state.lastTargetFlow, 3),
      targetPressureBar: round(state.lastTargetPressure, 3),
      machineFlowMlS: round(state.lastFlow, 3),
      machineTelemetryValid: state.lastMachineTelemetryValid,
      machineAgeMs: state.lastMachineAtMs ? Math.max(0, now - state.lastMachineAtMs) : null,
      pressureBar: round(state.lastPressure, 3),
      machineWeightFlowGS: round(state.lastMachineWeightFlow, 3),
      rawScaleWeightG: round(state.latestRawWeight, 3),
      rawScaleDwDtGS: round(state.latestRawDwDt, 3),
      decaidWeightFlowGS: round(state.latestWeightFlow, 3),
      scaleWeightG: round(state.latestRawWeight, 3),
      scaleFlowGS: round(state.latestWeightFlow, 3),
      scaleAgeMs: Number.isFinite(scaleAgeMs) ? Math.max(0, Math.round(scaleAgeMs)) : null,
      gflowToMachineFlow: round(ratio, 4)
    }, temperatureColumns()));
    if (run.samples.length > SAMPLE_CAP) run.samples.shift();
  }

  function scaleTimestampSeconds(value) {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return null;
      const numeric = Number(trimmed);
      if (Number.isFinite(numeric)) return scaleTimestampSeconds(numeric);
      const parsed = Date.parse(trimmed);
      return Number.isFinite(parsed) ? parsed / 1000 : null;
    }
    const v = Number(value);
    if (!Number.isFinite(v)) return null;
    const a = Math.abs(v);
    if (a >= 1e17) return v / 1e9;
    if (a >= 1e14) return v / 1e6;
    if (a >= 1e11) return v / 1e3;
    if (a >= 1e9) return v;
    return v;
  }

  function captureRawScaleSample(snapshot, weight, decaidWeightFlow, receivedAtMs) {
    const run = state.run;
    const sourceTimestamp = snapshot && snapshot.timestamp !== undefined ? snapshot.timestamp : null;
    const timestampSeconds = scaleTimestampSeconds(sourceTimestamp);
    let rawDwDt = null;
    let tareReset = false;
    if (run && run.rawScaleSamples.length) {
      const prev = run.rawScaleSamples[run.rawScaleSamples.length - 1];
      const drop = Number(prev.weightG) - weight;
      tareReset = Number.isFinite(drop) && drop >= TARE_RESET_THRESHOLD_G;
      const dt = Number.isFinite(timestampSeconds) && Number.isFinite(Number(prev.scaleTimestampSeconds))
        ? timestampSeconds - Number(prev.scaleTimestampSeconds) : null;
      if (!tareReset && Number.isFinite(dt) && dt > 0 && dt <= 10) {
        rawDwDt = (weight - Number(prev.weightG)) / dt;
      }
    }
    state.latestRawDwDt = Number.isFinite(rawDwDt) ? rawDwDt : null;
    if (!run || !state.cfg.enabled) return;
    run.rawScaleSamples.push(Object.assign({
      tMs: Math.max(0, receivedAtMs - run.startedAtMs),
      phase: state.phase,
      profileFrame: state.lastProfileFrame,
      physicalProfileFrame: state.lastProfileFrame,
      targetFlowMlS: round(state.lastTargetFlow, 4),
      machineFlowMlS: round(state.lastFlow, 4),
      pressureBar: round(state.lastPressure, 4),
      scaleTimestamp: sourceTimestamp,
      scaleTimestampSeconds: Number.isFinite(timestampSeconds) ? round(timestampSeconds, 6) : null,
      weightG: round(weight, 4),
      rawDwDtGS: Number.isFinite(rawDwDt) ? round(rawDwDt, 4) : null,
      decaidWeightFlowGS: Number.isFinite(decaidWeightFlow) ? round(decaidWeightFlow, 4) : null,
      tareReset
    }, temperatureColumns()));
    if (run.rawScaleSamples.length > RAW_SAMPLE_CAP) run.rawScaleSamples.shift();
  }

  function onScaleSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== "object") return;
    if (snapshot.status === "connected") { state.scaleConnected = true; return; }
    if (snapshot.status === "disconnected") { state.scaleConnected = false; return; }
    const weight = Number(snapshot.weight);
    if (!Number.isFinite(weight)) return;
    const weightFlow = Number(snapshot.weightFlow);
    const receivedAtMs = Date.now();
    state.scaleConnected = true;
    state.latestRawWeight = weight;
    state.latestWeightFlow = Number.isFinite(weightFlow) ? weightFlow : 0;
    state.latestScaleAtMs = receivedAtMs;
    captureRawScaleSample(snapshot, weight, Number.isFinite(weightFlow) ? weightFlow : null, receivedAtMs);
    if (state.run) sample("scale", false);
  }

  // ---- shot lifecycle from machine state events ----

  function isEspresso(machine) {
    return machine && machine.machineState === "espresso";
  }

  function handleStateUpdate(payload) {
    const machine = extractMachine(payload);
    const wasEspresso = state.phase === "recording";
    noteMachine(machine);
    const nowEspresso = isEspresso(machine);
    if (nowEspresso && !wasEspresso && state.cfg.enabled) {
      state.phase = "recording";
      startRun();
      sample("start", true);
    } else if (!nowEspresso && wasEspresso) {
      state.phase = "idle";
      finishRun(machine);
    } else if (state.run && machine.substate && machine.substate !== state.lastSubstateSeen) {
      event("substate", { substate: machine.substate });
    }
    state.lastSubstateSeen = machine.substate || null;
  }

  function finishRun(machine) {
    const run = state.run;
    if (!run) return;
    sample("final", true);
    const now = Date.now();
    run.endedAt = new Date(now).toISOString();
    run.endedAtMs = now;
    run.result = "ended (" + (machine && machine.machineState || "unknown") + ")";
    event("sequence_end", { machineState: machine && machine.machineState || null });
    state.run = null;
    log("Capture ended: " + run.runId + " samples=" + run.samples.length + " raw=" + run.rawScaleSamples.length);
    queueOwnership(run);
  }

  // ---- ownership: drop runs that HyperEx already recorded ----

  function queueOwnership(run) {
    const entry = { run, deadlineMs: Date.now() + OWNERSHIP_TIMEOUT_MS, settled: false };
    state.pendingOwnership.push(entry);
    for (const delay of OWNERSHIP_PROBES_MS) {
      const id = setTimeout(() => { probeOwnership(entry); }, delay);
      state.ownershipTimers.push(id);
    }
    const timeoutId = setTimeout(() => { settleOwnership(entry, "keep", "hyperex evidence timeout"); }, OWNERSHIP_TIMEOUT_MS);
    state.ownershipTimers.push(timeoutId);
  }

  function hyperexMatches(summary, run) {
    if (!summary || !summary.runId) return false;
    const hStart = Date.parse(summary.startedAt || "");
    const hEnd = Date.parse(summary.endedAt || "");
    if (!Number.isFinite(hStart) || !Number.isFinite(hEnd)) return false;
    return Math.abs(hStart - run.startedAtMs) <= START_MATCH_MS && Math.abs(hEnd - run.endedAtMs) <= END_MATCH_MS;
  }

  async function probeOwnership(entry) {
    if (entry.settled) return;
    let summary = null;
    try {
      const response = await fetch(HYPEREX_STATUS_URL, { method: "GET" });
      if (response.ok) {
        const body = await response.json();
        summary = body && body.diagnosticSummary || null;
      }
    } catch (_) { /* HyperEx absent or unreachable: keep our record */ }
    if (entry.settled) return;
    if (hyperexMatches(summary, entry.run)) {
      settleOwnership(entry, "drop", "hyperex run " + summary.runId);
    } else if (Date.now() >= entry.deadlineMs) {
      settleOwnership(entry, "keep", "no matching hyperex run");
    }
  }

  function settleOwnership(entry, decision, reason) {
    if (entry.settled) return;
    entry.settled = true;
    state.pendingOwnership = state.pendingOwnership.filter(x => x !== entry);
    if (decision === "drop") {
      log("Dropped " + entry.run.runId + ": already recorded by " + reason);
      return;
    }
    log("Keeping " + entry.run.runId + ": " + reason);
    appendHistory(entry.run);
  }

  // ---- history persistence (newest 4 full records, overwrite older) ----

  function emptyHistory() {
    return { schema: 1, kind: "ProfileRecorderHistory", writerVersion: PLUGIN_VERSION, createdAt: new Date().toISOString(), updatedAt: null, shots: [] };
  }

  function trimHistory(file) {
    const shots = file && Array.isArray(file.shots) ? file.shots : [];
    if (shots.length > HISTORY_FULL_SHOTS) file.shots = shots.slice(-HISTORY_FULL_SHOTS);
    return file;
  }

  function appendHistory(run) {
    if (!state.historyFile) state.historyFile = emptyHistory();
    const file = state.historyFile;
    file.shots.push({
      runId: run.runId,
      pluginVersion: PLUGIN_VERSION,
      kind: run.kind,
      profileTitle: run.profileTitle,
      startedAt: run.startedAt,
      endedAt: run.endedAt,
      result: run.result,
      sampleCount: run.samples.length,
      rawScaleSampleCount: run.rawScaleSamples.length,
      eventCount: run.events.length,
      fullRecord: { samples: run.samples, rawScaleSamples: run.rawScaleSamples, events: run.events, liveFlowTrim: null }
    });
    trimHistory(file);
    file.writerVersion = PLUGIN_VERSION;
    file.updatedAt = new Date().toISOString();
    scheduleWrite();
  }

  function scheduleWrite() {
    state.writeDirty = true;
    if (state.writeTimer !== null || state.writeInFlight) return;
    state.writeTimer = setTimeout(() => {
      state.writeTimer = null;
      persistHistory();
    }, 250);
  }

  function persistHistory() {
    if (state.writeInFlight || !state.writeDirty || !state.historyFile) return;
    state.writeInFlight = true;
    state.writeDirty = false;
    try {
      host.storage({ type: "write", key: STORAGE_HISTORY_FILE, namespace: ID, data: JSON.stringify(state.historyFile) });
      host.storage({ type: "read", key: STORAGE_HISTORY_FILE, namespace: ID });
    } catch (error) {
      state.storageError = String(error && error.message || error);
      state.writeInFlight = false;
      log("History write failed: " + state.storageError);
    }
  }

  function onStorageRead(key, value) {
    if (key !== STORAGE_HISTORY_FILE) return;
    state.writeInFlight = false;
    const parsed = parseStoredJson(value);
    if (parsed && parsed.kind === "ProfileRecorderHistory" && Array.isArray(parsed.shots)) {
      // Merge by runId so a late initial read cannot lose a newer session record.
      const byId = new Map();
      for (const row of parsed.shots) if (row && row.runId) byId.set(row.runId, row);
      if (state.historyFile) {
        for (const row of state.historyFile.shots) if (row && row.runId) byId.set(row.runId, row);
      }
      const merged = Array.from(byId.values()).sort((a, b) => String(a.startedAt || "").localeCompare(String(b.startedAt || "")));
      state.historyFile = { schema: 1, kind: "ProfileRecorderHistory", writerVersion: PLUGIN_VERSION, createdAt: parsed.createdAt || new Date().toISOString(), updatedAt: parsed.updatedAt || null, shots: merged };
      trimHistory(state.historyFile);
      state.historyLoaded = true;
      state.storageError = null;
      if (state.writeDirty) scheduleWrite();
    } else {
      if (!state.historyFile) state.historyFile = emptyHistory();
      state.historyLoaded = true;
    }
  }

  function historyExportPayload() {
    const file = state.historyFile;
    const shots = file && Array.isArray(file.shots) ? file.shots : [];
    return {
      kind: "HyperExHistoryExport",
      schema: 1,
      pluginVersion: PLUGIN_VERSION,
      recorder: ID,
      exportedAt: new Date().toISOString(),
      count: shots.length,
      shots: shots.slice()
    };
  }

  function statusPayload() {
    return {
      id: ID,
      version: PLUGIN_VERSION,
      enabled: state.cfg.enabled,
      phase: state.phase,
      recording: !!state.run,
      currentRunId: state.run ? state.run.runId : null,
      workflowTitle: state.workflowTitle,
      scaleConnected: state.scaleConnected,
      machineState: state.lastMachineState,
      substate: state.lastSubstate,
      historyShots: state.historyFile ? state.historyFile.shots.length : 0,
      historyLoaded: state.historyLoaded,
      pendingOwnership: state.pendingOwnership.length,
      storageError: state.storageError
    };
  }

  // ---- scale websocket ----

  function scheduleScaleReconnect(delayMs) {
    if (state.scaleReconnectTimer !== null) clearTimeout(state.scaleReconnectTimer);
    state.scaleReconnectTimer = setTimeout(() => {
      state.scaleReconnectTimer = null;
      connectScaleStream();
    }, Math.max(250, delayMs || 1000));
  }

  function handleScaleTransportEvent(evt) {
    if (!evt) return;
    if (evt.type === "data") {
      try {
        const payload = typeof evt.data === "string" ? JSON.parse(evt.data) : evt.data;
        onScaleSnapshot(payload);
      } catch (error) {
        log("Scale snapshot parse error: " + (error.message || error));
      }
      return;
    }
    if (evt.type === "close" || evt.type === "error") {
      state.scaleConnected = false;
      state.scaleHandle = null;
      scheduleScaleReconnect(1000);
    }
  }

  function connectScaleStream() {
    if (state.scaleHandle !== null) return;
    if (state.scaleReconnectTimer !== null) { clearTimeout(state.scaleReconnectTimer); state.scaleReconnectTimer = null; }
    host.transport.open({ kind: "websocket", url: SCALE_WS })
      .then((opened) => {
        if (!opened || !opened.handle) throw new Error("scale websocket opened without a handle");
        state.scaleHandle = opened.handle;
        host.transport.onEvent(opened.handle, handleScaleTransportEvent);
        log("Connected to Decaid scale snapshot stream.");
      })
      .catch((error) => {
        state.scaleHandle = null;
        state.scaleConnected = false;
        log("Scale stream connection failed: " + (error.message || error) + "; retrying.");
        scheduleScaleReconnect(1000);
      });
  }

  function closeScaleStream() {
    if (state.scaleReconnectTimer !== null) { clearTimeout(state.scaleReconnectTimer); state.scaleReconnectTimer = null; }
    const handle = state.scaleHandle;
    state.scaleHandle = null;
    state.scaleConnected = false;
    if (handle !== null) host.transport.close(handle).catch(() => {});
  }

  function clearAllTimers() {
    for (const id of state.ownershipTimers) clearTimeout(id);
    state.ownershipTimers = [];
    if (state.writeTimer !== null) { clearTimeout(state.writeTimer); state.writeTimer = null; }
  }

  function httpJson(request, status, body) {
    return { requestId: request.requestId, status, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
  }

  return {
    id: ID,

    onLoad(settings) {
      state.cfg = loadConfig(settings || {});
      state.phase = "idle";
      state.run = null;
      state.pendingOwnership = [];
      state.historyFile = null;
      state.historyLoaded = false;
      connectScaleStream();
      try { host.storage({ type: "read", key: STORAGE_HISTORY_FILE, namespace: ID }); }
      catch (error) { state.storageError = String(error && error.message || error); }
      fetch(API + "/workflow", { method: "GET" })
        .then(r => r.ok ? r.json() : null)
        .then(body => { if (body && body.profile && body.profile.title) state.workflowTitle = String(body.profile.title); })
        .catch(() => {});
      log("Loaded v" + PLUGIN_VERSION + " (records non-HyperEx shots only; newest " + HISTORY_FULL_SHOTS + " full records).");
    },

    onUnload() {
      if (state.run) {
        const run = state.run;
        sample("plugin_unload", true);
        run.endedAt = new Date().toISOString();
        run.endedAtMs = Date.now();
        run.result = "interrupted: plugin unloaded";
        state.run = null;
        appendHistory(run);
      }
      // Pending ownership checks cannot run after unload; keep those runs rather than lose them.
      for (const entry of state.pendingOwnership) {
        if (!entry.settled) { entry.settled = true; appendHistory(entry.run); }
      }
      state.pendingOwnership = [];
      clearAllTimers();
      closeScaleStream();
      if (state.writeDirty && state.historyFile) {
        try { host.storage({ type: "write", key: STORAGE_HISTORY_FILE, namespace: ID, data: JSON.stringify(state.historyFile) }); } catch (_) {}
        state.writeDirty = false;
      }
      log("Unloaded; timers cleared and scale stream closed.");
    },

    onEvent(evt) {
      if (!evt || !evt.name) return;
      if (evt.name === "stateUpdate") {
        handleStateUpdate(evt.payload || {});
      } else if (evt.name === "workflowUpdated") {
        const title = evt.payload && evt.payload.profile && evt.payload.profile.title ? String(evt.payload.profile.title) : "";
        if (title !== state.workflowTitle) {
          state.workflowTitle = title;
          if (state.run) event("workflow_changed", { profileTitle: title });
        }
      } else if (evt.name === "storageRead") {
        const payload = evt.payload || {};
        onStorageRead(payload.key, payload.value);
      }
    },

    async __httpRequestHandler(request) {
      if (request.endpoint === "status") return httpJson(request, 200, statusPayload());
      if (request.endpoint === "history-export") {
        return {
          requestId: request.requestId, status: 200,
          headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": "attachment; filename=profilerecorder-history.json" },
          body: JSON.stringify(historyExportPayload())
        };
      }
      return httpJson(request, 404, { error: "not found" });
    }
  };
}

