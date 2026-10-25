function createPlugin(host) {
  "use strict";

  const API = "http://localhost:8080/api/v1";
  const SCALE_WS = "ws://localhost:8080/ws/v1/scale/snapshot";
  const WATER_WS = "ws://localhost:8080/ws/v1/machine/waterLevels";
  const ID = "decenthyperexplugin.reaplugin";
  // Hard bounds are enforced twice: once while loading user settings and again
  // when generating the DE1 profile/calibration commands. This keeps malformed
  // settings, stale LUT values, or advisory calculations from ever becoming an
  // out-of-range machine command.
  const LIMITS = Object.freeze({
    commandFlowMin: 0.10, commandFlowMax: 8.00,
    desiredRealFlowMin: 0.30, desiredRealFlowMax: 6.50,
    temperatureMin: 70.0, temperatureMax: 100.0,
    pressureMin: 0.50, pressureMax: 12.00,
    stage1WeightMin: 1.0, stage1WeightMax: 20.0,
    stage2WeightMax: 200.0, finalWeightMax: 300.0,
    maxProfileFrames: 20
  });
  // Two empty-basket calibration programs. LOW WATER is the default and
  // concentrates samples around the HyperEx real-flow targets while keeping
  // the cup well below 300 ml. FULL retains the denser 12-point map.
  const CALIBRATION_MODES = {
    low: {
      label: "Low Water",
      algorithm: "target-lut",
      // Target-focused calibration. The three blocks follow the HyperEx use order:
      // stage-1 ~2 g/s, stage-2 ~5 g/s, then the final ~1.5 g/s after high flow.
      // Each block is evaluated independently; all three targets must pass before
      // the previous valid LUT is replaced or HyperEx is auto-synced.
      primeFlow: 3.00, primeSeconds: 3.0,
      targetBlocks: [
        { id: "S1", targetSource: "stage1", target: 2.00, commands: [0.65, 0.80, 0.95] },
        { id: "S2", targetSource: "stage2", target: 5.00, commands: [2.20, 2.40, 2.60] },
        { id: "S3", targetSource: "stage3", target: 1.50, commands: [0.70, 0.60, 0.50] }
      ],
      stepSeconds: 7.5, settleSeconds: 2.8, windowSeconds: 4.4,
      hardStopG: 240, recommendedContainerMl: 300,
      waterWarnMarginMm: 15, waterBlockMarginMm: 5
    },
    full: {
      label: "Full",
      algorithm: "staircase",
      primeFlow: 3.00, primeSeconds: 3.0,
      commands: [0.25, 0.40, 0.60, 0.80, 1.00, 1.25, 1.50, 2.00, 2.50, 3.00, 4.00, 5.00],
      stepSeconds: 6.0, settleSeconds: 2.2, windowSeconds: 3.4,
      hardStopG: 270, recommendedContainerMl: 300,
      waterWarnMarginMm: 20, waterBlockMarginMm: 7
    }
  };
  const STORAGE_CAL = "flowCalibration";
  const STORAGE_SCOPE = "flowMultiplierScope";
  const STORAGE_PENDING_MULT = "pendingCalibrationMultiplier";
  const STORAGE_GLOBAL_PREVIOUS = "globalPreviousMultiplier";
  const STORAGE_SCOPED_ORIGINAL = "scopedOriginalMultiplier";
  const STORAGE_CAL_MODE = "calibrationMode";
  const STORAGE_S1_STARTUP = "stage1StartupCorrection";
  const STORAGE_TEST_OVERRIDES = "manualTestOverrides";
  const STORAGE_AUTO_APPLY = "autoApplyNextShot";
  const STORAGE_ADAPTIVE_HISTORY = "adaptiveHistoryV1"; // legacy migration source
  const STORAGE_HISTORY_FILE = "adaptiveHistoryFileV2";
  const STORAGE_HISTORY_PROBE = "adaptiveHistoryStorageProbeV1";
  const HISTORY_FILE_MAX_SHOTS = 30;

  function normalizeCalibrationMode(value) {
    const v = String(value || "").trim().toLowerCase();
    return v === "full" ? "full" : "low";
  }

  function calibrationModeConfig(mode) {
    return CALIBRATION_MODES[normalizeCalibrationMode(mode || state.calibrationMode)] || CALIBRATION_MODES.low;
  }

  function calibrationProgram(mode) {
    const normalized = normalizeCalibrationMode(mode || state.calibrationMode);
    const m = calibrationModeConfig(normalized);
    if (m.algorithm === "target-lut") {
      const steps = [];
      for (const block of (m.targetBlocks || [])) {
        let targetReal = Number(block.target);
        if (state.cfg) {
          if (block.targetSource === "stage1") targetReal = Number(state.cfg.stage1Flow);
          else if (block.targetSource === "stage2") targetReal = Number(state.cfg.stage2Flow);
          else if (block.targetSource === "stage3") targetReal = Number(state.cfg.stage3Flow);
        }
        let commands = (block.commands || []).map(Number).filter(Number.isFinite);
        const defaults = { stage1: 2.0, stage2: 5.0, stage3: 1.5 };
        const defaultTarget = Number(defaults[block.targetSource] || block.target || targetReal || 1);
        let center = mappedCommandForReal(targetReal);
        if (!Number.isFinite(center)) {
          const baseCenter = commands.length ? commands[Math.floor(commands.length / 2)] : Math.max(0.2, targetReal * 0.5);
          center = baseCenter * (targetReal / Math.max(0.1, defaultTarget));
        }
        const span = Math.max(block.targetSource === "stage2" ? 0.16 : 0.10, Math.abs(center) * 0.12);
        commands = block.targetSource === "stage3"
          ? [center + span, center, Math.max(0.10, center - span)]
          : [Math.max(0.10, center - span), center, center + span];
        for (const command of commands) {
          steps.push({
            blockId: String(block.id || ""), targetSource: String(block.targetSource || ""), targetReal,
            commandFlow: clampCommandFlow(command), seconds: Number(m.stepSeconds),
            settleSeconds: Number(m.settleSeconds), windowSeconds: Number(m.windowSeconds)
          });
        }
      }
      return steps;
    }
    return (m.commands || []).map(command => ({
      blockId: "FULL", targetReal: null, commandFlow: clampCommandFlow(command),
      seconds: Number(m.stepSeconds), settleSeconds: Number(m.settleSeconds), windowSeconds: Number(m.windowSeconds)
    }));
  }

  function calibrationCommands(mode) {
    return calibrationProgram(mode).map(x => Number(x.commandFlow));
  }

  function calibrationWaterPlan(mode) {
    const m = calibrationModeConfig(mode);
    const program = calibrationProgram(mode);
    const primeMl = Number(m.primeFlow || 0) * Number(m.primeSeconds || 0);
    const nominalMl = primeMl + program.reduce((sum, step) => sum + Number(step.commandFlow || 0) * Number(step.seconds || m.stepSeconds || 0), 0);
    return {
      mode: normalizeCalibrationMode(mode || state.calibrationMode),
      modeLabel: m.label,
      algorithm: m.algorithm || "staircase",
      steps: program.length,
      stepSeconds: m.stepSeconds,
      settleSeconds: m.settleSeconds,
      windowSeconds: m.windowSeconds,
      primeFlow: Number(m.primeFlow || 0),
      primeSeconds: Number(m.primeSeconds || 0),
      hardStopG: m.hardStopG,
      nominalCommandWaterMl: round(nominalMl, 0),
      recommendedContainerMl: m.recommendedContainerMl,
      waterWarnMarginMm: Number(m.waterWarnMarginMm || 0),
      waterBlockMarginMm: Number(m.waterBlockMarginMm || 0)
    };
  }

  function calibrationProfileTitle(mode) {
    const base = state.cfg && state.cfg.calibrationProfileTitle
      ? String(state.cfg.calibrationProfileTitle) : "HyperEx Flow Calibration";
    return `${base} - ${calibrationModeConfig(mode).label}`;
  }

  function calibrationModeFromTitle(title) {
    const t = String(title || "");
    if (t === calibrationProfileTitle("low")) return "low";
    if (t === calibrationProfileTitle("full")) return "full";
    return null;
  }

  function isCalibrationProfileTitle(title) {
    return calibrationModeFromTitle(title) !== null;
  }

  const state = {
    cfg: null,
    workflowTitle: "",
    workflowProfile: null,
    runtimeProfileVerified: false,
    profileSyncQueue: Promise.resolve(),
    temperatureRecheckNeeded: false,
    machineProfileAckKey: "",
    profileReadbackAt: null,
    calibrationStorageLoaded: false,
    overrideStorageLoaded: false,
    scopeStorageLoaded: false,
    scopedOriginalStorageLoaded: false,
    workflowSelectionRevision: 0,
    runtimeProfileStatus: "not verified",
    runtimeProfileRepairBusy: false,
    profileVerificationPending: false,
    profileVerificationRetryAtMs: 0,
    runtimeProfileMismatchAbortSent: false,
    armed: false,
    phase: "idle", // idle|stage1|dumping|soak|restart_wait|stage2|stage3|finishing|aborted
    lastMachineState: null,
    lastSubstate: null,
    lastPressure: 0,
    lastMachineTelemetryValid: false,
    lastFlow: 0,
    lastWeightFlow: 0,
    lastFrame: null,
    lowFlowSamples: 0,
    idleConfirmedAtMs: 0,
    hardPressureSamples: 0,
    rawBaseline: null,
    lastRawWeight: null,
    cumulativeOffset: 0,
    cumulativeWeight: 0,
    hasScaleSample: false,
    dumpRequestedAtMs: 0,
    dumpAcceptedAtMs: 0,
    dumpReinforceSent: false,
    lastMachineAtMs: 0,
    dumpTimer: null,
    dumpSettleTimer: null,
    dumpFallbackTimer: null,
    idlePollTimer: null,
    soakTimer: null,
    noScaleTimer: null,
    maxRunTimer: null,
    restartSkipTimer: null,
    restartPollTimer: null,
    restartTimeoutTimer: null,
    ghcCountdownTimer: null,
    ghcPromptStartedAtMs: 0,
    ghcSecondsRemaining: 0,
    soakCountdownTimer: null,
    soakPromptStartedAtMs: 0,
    soakSecondsRemaining: 0,
    armReinforceTimer: null,
    armReinforceTimer2: null,
    armRequestCount: 0,
    lastArmRequestAtMs: 0,
    commandBusy: false,
    sequenceStartedAtMs: 0,
    stage1DumpSent: false,
    stage2SkipSent: false,
    finalStopSent: false,
    completionTimer: null,
    liveTrim: null,
    liveTrimTimer: null,
    liveTrimDirty: false,
    directStartTest: null,
    directStartTestTimer: null,
    directStartTestEnabledForRun: false,
    scaleHandle: null,
    scaleReconnectTimer: null,
    scaleConnected: false,
    latestRawWeight: null,
    latestWeightFlow: 0,
    latestScaleAtMs: 0,
    latestScaleTimestamp: null,
    latestRawDwDt: null,
    lastTargetFlow: null,
    lastTargetPressure: null,
    lastMachineWeightFlow: null,
    diagnosticCurrent: null,
    diagnosticLast: null,
    diagnosticLastSampleAtMs: 0,
    diagnosticRunSeq: 0,
    calibrationArmed: false,
    calibrationMode: "low",
    calibrationActive: false,
    calibrationLast: null,
    calibrationMap: null,
    calibrationMapUsable: false,
    calibrationMapStaleReason: "not calibrated",
    calibrationPendingMultiplier: null,
    calibrationFinalizeBusy: false,
    calibrationHardPressureSamples: 0,
    flowMultiplierCurrent: null,
    flowMultiplierReadAtMs: 0,
    scopedOriginalMultiplier: null,
    scopedAppliedMultiplier: null,
    globalPreviousMultiplier: null,
    scopeMode: "hyperex",
    scopeChangeBusy: false,
    profileSyncStatus: "",
    hyperExProfileId: null,
    calibrationProfileIds: { low: null, full: null },
    waterHandle: null,
    waterReconnectTimer: null,
    waterCurrentLevelMm: null,
    waterRefillLevelMm: null,
    waterLevelAtMs: 0,
    waterLevelConnected: false,
    calibrationWaterPreflightApprovedUntilMs: 0,
    stage1StartupCorrection: null,
    testOverrides: null,
    adaptiveHistory: [],
    legacyAdaptiveHistory: [],
    persistentHistoryFile: null,
    persistentHistoryLoaded: false,
    storageProbeVerified: false,
    pendingHistoryWrite: null,
    historyWriteDirty: false,
    historyWriteTimer: null,
    persistentHistoryAvailable: null,
    persistentHistoryStatus: "checking persistent history storage",
    persistentHistoryCompatibleCount: 0,
    storageProbeToken: "",
    storageProbeTimer: null,
    autoApplyNextShot: true,
    autoApplyLastStatus: null,
    learningStage: null,
    learningContextLoaded: true,
    autoApplyTimer: null
  };

  function n(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function b(value, fallback) {
    if (typeof value === "boolean") return value;
    if (value === "true") return true;
    if (value === "false") return false;
    return fallback;
  }

  function clampNumber(value, lo, hi, fallback) {
    const v = Number(value);
    const x = Number.isFinite(v) ? v : Number(fallback);
    return Math.max(lo, Math.min(hi, x));
  }

  function clampCommandFlow(value) {
    return clampNumber(value, LIMITS.commandFlowMin, LIMITS.commandFlowMax, LIMITS.commandFlowMin);
  }

  function loadConfig(settings) {
    const hardPressureLimit = clampNumber(settings.HardPressureLimit, 1.0, LIMITS.pressureMax, 8.0);
    const stage1Weight = clampNumber(settings.Stage1Weight, LIMITS.stage1WeightMin, LIMITS.stage1WeightMax, 4.0);
    // Keep the weight state machine ordered even if persisted/user input is contradictory.
    const stage2Weight = clampNumber(settings.Stage2Weight, stage1Weight + 2.0, LIMITS.stage2WeightMax, Math.max(40.0, stage1Weight + 2.0));
    const finalWeight = clampNumber(settings.FinalWeight, stage2Weight + 5.0, LIMITS.finalWeightMax, Math.max(100.0, stage2Weight + 5.0));
    return {
      enabled: b(settings.Enabled, true),
      basketContext: "empty", // Startup qualification chooses empty engineering or normal coffee automatically.
      profileTitle: String(settings.ProfileTitle || "HyperEx Pulse Filter"),
      temperature: clampNumber(settings.Temperature, LIMITS.temperatureMin, LIMITS.temperatureMax, 92.0),
      stage1Flow: clampNumber(settings.Stage1Flow, LIMITS.desiredRealFlowMin, LIMITS.desiredRealFlowMax, 2.0),
      stage1Weight,
      stage1PressureLimit: clampNumber(settings.Stage1PressureLimit, LIMITS.pressureMin, hardPressureLimit, Math.min(3.0, hardPressureLimit)),
      dumpFlowThreshold: clampNumber(settings.DumpFlowThreshold, 0, 2.0, 0.4),
      dumpFlowStableSamples: Math.max(1, Math.min(20, Math.round(n(settings.DumpFlowStableSamples, 2)))),
      dumpMinSettleSeconds: clampNumber(settings.DumpMinSettleSeconds, 0, 10, 0.8),
      dumpFallbackSeconds: clampNumber(settings.DumpFallbackSeconds, 0.2, 15, 1.5),
      dumpTimeoutSeconds: clampNumber(settings.DumpTimeoutSeconds, 1, 30, 5.0),
      soakSeconds: clampNumber(settings.SoakSeconds, 0, 60, 10.0),
      stage2Flow: clampNumber(settings.Stage2Flow, LIMITS.desiredRealFlowMin, LIMITS.desiredRealFlowMax, 5.0),
      stage2Weight,
      stage2PressureLimit: clampNumber(settings.Stage2PressureLimit, LIMITS.pressureMin, hardPressureLimit, Math.min(6.0, hardPressureLimit)),
      stage3Flow: clampNumber(settings.Stage3Flow, LIMITS.desiredRealFlowMin, LIMITS.desiredRealFlowMax, 1.5),
      finalWeight,
      stage3PressureLimit: clampNumber(settings.Stage3PressureLimit, LIMITS.pressureMin, hardPressureLimit, Math.min(3.0, hardPressureLimit)),
      hardPressureLimit,
      scaleResetThreshold: clampNumber(settings.ScaleResetThreshold, 0.5, 20, 2.0),
      noScaleTimeoutSeconds: clampNumber(settings.NoScaleTimeoutSeconds, 1, 30, 5.0),
      liveFlowTrimTest: b(settings.LiveFlowTrimTest, false),
      liveFlowTrimLevel: [1,2,3,4].includes(Number(settings.LiveFlowTrimLevel)) ? Number(settings.LiveFlowTrimLevel) : 1,
      directDriverStartTest: b(settings.DirectDriverStartTest, false),
      ghcConfirmTimeoutSeconds: clampNumber(settings.GHCConfirmTimeoutSeconds, 1, 60, 20.0),
      autoArmRetry1Seconds: clampNumber(settings.AutoArmRetry1Seconds, 0, 30, 3.0),
      autoArmRetry2Seconds: clampNumber(settings.AutoArmRetry2Seconds, 0, 60, 7.0),
      diagnosticEnabled: b(settings.DiagnosticEnabled, true),
      idleDashboardShortcut: b(settings.IdleDashboardShortcut, true),
      diagnosticSampleIntervalMs: Math.round(clampNumber(settings.DiagnosticSampleIntervalMs, 50, 1000, 100)),
      maxRunSeconds: clampNumber(settings.MaxRunSeconds, 30, 600, 180.0),
      useCalibrationLut: b(settings.UseCalibrationLut, true),
      flowMultiplierScope: String(settings.FlowMultiplierScope || "HyperEx only"),
      calibrationProfileTitle: String(settings.CalibrationProfileTitle || "HyperEx Flow Calibration"),
      calibrationMode: normalizeCalibrationMode(settings.CalibrationMode || "Low Water"),
      calibrationStepSeconds: clampNumber(settings.CalibrationStepSeconds, 7, 20, 10.0),
      calibrationSettleSeconds: clampNumber(settings.CalibrationSettleSeconds, 1.5, 10, 4.0),
      calibrationWindowSeconds: clampNumber(settings.CalibrationWindowSeconds, 2, 8, 3.5),
      calibrationAutoSync: b(settings.CalibrationAutoSync, true),
      autoApplyNextShot: b(settings.AutoApplyNextShot, true)
    };
  }

  function advancedSettingsFromCfg(cfg) {
    const c = cfg || state.cfg || loadConfig({});
    return {
      liveFlowTrimTest: !!c.liveFlowTrimTest,
      liveFlowTrimLevel: c.liveFlowTrimLevel,
      directDriverStartTest: !!c.directDriverStartTest,
      temperature: round(c.temperature, 2),
      stage1Flow: round(c.stage1Flow, 3), stage1PressureLimit: round(c.stage1PressureLimit, 2),
      dumpFlowThreshold: round(c.dumpFlowThreshold, 3), dumpFlowStableSamples: Math.round(c.dumpFlowStableSamples),
      dumpFallbackSeconds: round(c.dumpFallbackSeconds, 2), dumpTimeoutSeconds: round(c.dumpTimeoutSeconds, 2),
      stage2Flow: round(c.stage2Flow, 3), stage2PressureLimit: round(c.stage2PressureLimit, 2),
      stage3Flow: round(c.stage3Flow, 3), stage3PressureLimit: round(c.stage3PressureLimit, 2),
      hardPressureLimit: round(c.hardPressureLimit, 2), scaleResetThreshold: round(c.scaleResetThreshold, 2),
      noScaleTimeoutSeconds: round(c.noScaleTimeoutSeconds, 2), autoArmRetry1Seconds: round(c.autoArmRetry1Seconds, 2),
      autoArmRetry2Seconds: round(c.autoArmRetry2Seconds, 2), diagnosticSampleIntervalMs: Math.round(c.diagnosticSampleIntervalMs),
      maxRunSeconds: round(c.maxRunSeconds, 1)
    };
  }

  function advancedSettingsPayload() {
    return {
      settings: advancedSettingsFromCfg(),
      liveFlowTrimTest: liveTrimPayload(),
      directStartTest: directStartTestPayload(),
      basicCurve: state.cfg ? {
        stage1WeightG: round(state.cfg.stage1Weight,2),
        releaseSettleSeconds: round(state.cfg.dumpMinSettleSeconds,2),
        soakSeconds: round(state.cfg.soakSeconds,2),
        stage2WeightG: round(state.cfg.stage2Weight,2),
        finalWeightG: round(state.cfg.finalWeight,2),
        ghcConfirmTimeoutSeconds: round(state.cfg.ghcConfirmTimeoutSeconds,2)
      } : null,
      note: "Single source of truth: values are loaded from Plugins → HyperEx Pulse Filter settings."
    };
  }

  function log(message) {
    host.log(`[HyperEx] ${message}`);
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

  function normalizeScope(value) {
    const v = String(value || "").trim().toLowerCase();
    if (v === "off") return "off";
    if (v === "global") return "global";
    return "hyperex";
  }

  function scopeLabel(value) {
    return value === "off" ? "Off" : value === "global" ? "Global" : "HyperEx only";
  }

  function parseStoredJson(value) {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "object") return value;
    try { return JSON.parse(String(value)); } catch (_) { return null; }
  }

  function storageRead(key) {
    try { host.storage({ type: "read", key, namespace: ID }); return true; }
    catch (error) { log(`Storage read '${key}' failed: ${error.message || error}`); return false; }
  }

  function storageWrite(key, value) {
    try {
      const data = typeof value === "string" ? value : JSON.stringify(value);
      host.storage({ type: "write", key, namespace: ID, data });
      return true;
    } catch (error) {
      log(`Storage write '${key}' failed: ${error.message || error}`);
      return false;
    }
  }

  function desiredRealFlowForPhase(phase) {
    if (!state.cfg) return null;
    if (phase === "stage1") return state.cfg.stage1Flow;
    if (phase === "stage2") return state.cfg.stage2Flow;
    if (phase === "stage3") return state.cfg.stage3Flow;
    return null;
  }

  function calibrationBaseMultiplier() {
    const m = state.calibrationMap && Number(state.calibrationMap.baseFlowMultiplier);
    return Number.isFinite(m) ? m : null;
  }

  function calibrationPoints() {
    const points = state.calibrationMap && Array.isArray(state.calibrationMap.points)
      ? state.calibrationMap.points.filter(p => Number.isFinite(Number(p.commandFlow)) && Number.isFinite(Number(p.actualFlow)) && Number(p.actualFlow) > 0)
      : [];
    return points.slice().sort((a, b) => Number(a.actualFlow) - Number(b.actualFlow));
  }

  function multiplierClose(a, b) {
    const x = finiteOrNull(a), y = finiteOrNull(b);
    return x !== null && y !== null && Math.abs(x - y) <= 0.015;
  }

  function recomputeCalibrationUsability() {
    state.calibrationMapUsable = false;
    state.calibrationMapStaleReason = "not calibrated";
    if (!state.cfg || !state.cfg.useCalibrationLut) {
      state.calibrationMapStaleReason = "LUT disabled";
      return;
    }
    const map = state.calibrationMap;
    const pts = calibrationPoints();
    if (!map || map.valid !== true || pts.length < 3) {
      state.calibrationMapStaleReason = "no valid calibration map";
      return;
    }
    if (Number(map.schema || 0) < 3) {
      state.calibrationMapStaleReason = "legacy calibration map; rerun v0.1.27+ Flow Cal";
      return;
    }
    if (state.cfg && pts.length) {
      const lo = Number(pts[0].actualFlow), hi = Number(pts[pts.length - 1].actualFlow);
      const targets = [Number(state.cfg.stage1Flow), Number(state.cfg.stage2Flow), Number(state.cfg.stage3Flow)].filter(Number.isFinite);
      const outside = targets.find(t => t < lo * 0.92 || t > hi * 1.08);
      if (outside !== undefined) {
        state.calibrationMapStaleReason = `target ${round(outside,3)} g/s outside calibrated range ${round(lo,3)}..${round(hi,3)}; rerun Flow Cal`;
        return;
      }
    }
    const base = calibrationBaseMultiplier();
    if (!Number.isFinite(base)) {
      state.calibrationMapStaleReason = "calibration multiplier missing";
      return;
    }
    if (state.scopeMode === "hyperex") {
      state.calibrationMapUsable = true;
      state.calibrationMapStaleReason = "";
      return;
    }
    if (finiteOrNull(state.flowMultiplierCurrent) === null) {
      state.calibrationMapStaleReason = "current DE1 multiplier unknown";
      return;
    }
    if (!multiplierClose(state.flowMultiplierCurrent, base)) {
      state.calibrationMapStaleReason = `DE1 multiplier ${round(state.flowMultiplierCurrent,3)} != calibration ${round(base,3)}`;
      return;
    }
    state.calibrationMapUsable = true;
    state.calibrationMapStaleReason = "";
  }

  function mappedCommandForReal(realFlow) {
    const target = Number(realFlow);
    if (!state.calibrationMapUsable || !Number.isFinite(target) || target <= 0) return null;
    const pts = calibrationPoints();
    if (pts.length < 2) return null;
    const lo = Number(pts[0].actualFlow), hi = Number(pts[pts.length - 1].actualFlow);
    // Do not silently extrapolate far outside the measured calibration envelope.
    if (target < lo * 0.92 || target > hi * 1.08) return null;
    if (target <= lo) return Number(pts[0].commandFlow);
    if (target >= hi) return Number(pts[pts.length - 1].commandFlow);
    for (let i = 1; i < pts.length; i += 1) {
      const a = pts[i - 1], b = pts[i];
      const ya = Number(a.actualFlow), yb = Number(b.actualFlow);
      if (target <= yb && yb > ya) {
        const f = (target - ya) / (yb - ya);
        return Number(a.commandFlow) + f * (Number(b.commandFlow) - Number(a.commandFlow));
      }
    }
    return null;
  }

  function resolvedCommandFlow(realFlow) {
    const mapped = mappedCommandForReal(realFlow);
    return Number.isFinite(mapped) ? clampCommandFlow(mapped) : clampCommandFlow(realFlow);
  }

  function stage1StartupFactor() {
    const x = state.stage1StartupCorrection;
    if (!x || typeof x !== "object") return 1.0;
    const factor = Number(x.factor), target = Number(x.targetRealFlow), weight = Number(x.stage1Weight);
    if (!Number.isFinite(factor) || factor < 0.70 || factor > 1.60) return 1.0;
    if (!state.cfg || Math.abs(target - Number(state.cfg.stage1Flow)) > 0.001 || Math.abs(weight - Number(state.cfg.stage1Weight)) > 0.001) return 1.0;
    const mapCreatedAt = state.calibrationMap && state.calibrationMap.createdAt ? String(state.calibrationMap.createdAt) : "";
    if (String(x.mapCreatedAt || "") !== mapCreatedAt) return 1.0;
    return factor;
  }

  function testOverrideBinding() {
    const mapCreatedAt = state.calibrationMap && state.calibrationMap.createdAt ? String(state.calibrationMap.createdAt) : "";
    return {
      mapCreatedAt,
      basketContext: state.cfg ? state.cfg.basketContext : "unknown",
      targets: state.cfg ? {
        stage1: round(state.cfg.stage1Flow, 4),
        stage2: round(state.cfg.stage2Flow, 4),
        stage3: round(state.cfg.stage3Flow, 4)
      } : null
    };
  }


  function testOverrideStatus() {
    const x = state.testOverrides;
    const schema = Number(x && x.schema || 0);
    if (!x || typeof x !== "object" || ![1,2,3].includes(schema)) return { valid: false, reason: "none", activeStages: [], s3ShapeActive: false };
    // v0.1.37 accidentally wrote adaptive schema-3 overrides that its own reader
    // rejected. Do not silently activate those stale writes after upgrading to
    // v0.1.38. Genuine v0.1.38+ schema-3 adaptive writes carry writerVersion.
    if (schema === 3 && x.adaptiveSource && !String(x.writerVersion || "").trim()) {
      return { valid: false, reason: "legacy v0.1.37 adaptive override ignored; run a new validation shot and apply again", activeStages: [], s3ShapeActive: false };
    }
    if (!state.cfg) return { valid: false, reason: "configuration unavailable", activeStages: [], s3ShapeActive: false };
    const binding = testOverrideBinding();
    const overrideContext = x.basketContext || "unknown";
    const baselinePrior = binding.basketContext === "coffee" && ["empty","unknown"].includes(overrideContext);
    if (overrideContext !== binding.basketContext && !baselinePrior && !(binding.basketContext === "empty" && overrideContext === "unknown")) {
      return { valid:false, reason:"basket context changed; previous overrides ignored; using LUT baseline", activeStages:[], s3ShapeActive:false };
    }
    if (String(x.mapCreatedAt || "") !== String(binding.mapCreatedAt || "")) return { valid: false, reason: "calibration LUT changed; manual test override ignored", activeStages: [], s3ShapeActive: false };
    const xt = x.targets && typeof x.targets === "object" ? x.targets : {};
    for (const stage of ["stage1","stage2","stage3"]) {
      if (!Number.isFinite(Number(xt[stage])) || Math.abs(Number(xt[stage]) - Number(binding.targets[stage])) > 0.001) {
        return { valid: false, reason: "real-flow targets changed; manual test override ignored", activeStages: [], s3ShapeActive: false };
      }
    }
    const activeStages = [];
    for (const stage of ["stage1","stage2","stage3"]) {
      const q = x.stages && x.stages[stage];
      if (q && String(q.mode) === "manual" && Number.isFinite(Number(q.command))) activeStages.push(stage);
    }
    const sq = schema >= 2 && x.s3Shape && typeof x.s3Shape === "object" ? x.s3Shape : null;
    const s3ShapeActive = !!(sq && sq.enabled === true);
    if (s3ShapeActive) activeStages.push("stage3-shape");
    const adaptiveSource = x.adaptiveSource && typeof x.adaptiveSource === "object" ? x.adaptiveSource : null;
    let reason = "all stages AUTO / LUT";
    if (activeStages.length) {
      if (adaptiveSource && String(adaptiveSource.mode || "").toLowerCase() === "auto") reason = "adaptive auto applied";
      else if (adaptiveSource) reason = "adaptive manual applied";
      else reason = "manual test active";
    }
    if (baselinePrior && activeStages.length) reason = "empty/pre-upgrade baseline seed; normal coffee learning";
    return { valid: true, reason, activeStages, s3ShapeActive, adaptiveSource:baselinePrior?null:adaptiveSource, baselinePrior, sourceBasketContext:overrideContext };
  }

  function s3ShapeStatus() {
    const os = testOverrideStatus();
    const out = { enabled: false, reason: os.valid ? "flat S3" : os.reason, earlyCommand: null, earlySeconds: null, midCommand: null, midSeconds: null, lateCommand: null };
    if (!os.valid || !os.s3ShapeActive) return out;
    const q = state.testOverrides && state.testOverrides.s3Shape;
    if (!q || typeof q !== "object") return out;
    const early = Number(q.earlyCommand), mid = Number(q.midCommand), late = Number(q.lateCommand);
    const earlySeconds = Number(q.earlySeconds), midSeconds = Number(q.midSeconds);
    if (![early,mid,late,earlySeconds,midSeconds].every(Number.isFinite)) return { ...out, reason: "stored S3 shape rejected: non-finite value" };
    if (early < LIMITS.commandFlowMin || early > LIMITS.commandFlowMax ||
        mid < LIMITS.commandFlowMin || mid > LIMITS.commandFlowMax ||
        late < LIMITS.commandFlowMin || late > LIMITS.commandFlowMax) {
      return { ...out, reason: "stored S3 shape rejected: command outside hard limits" };
    }
    if (earlySeconds < 3 || earlySeconds > 30 || midSeconds < 3 || midSeconds > 30) {
      return { ...out, reason: "stored S3 shape rejected: timing outside 3–30 s" };
    }
    if (!(early <= mid && mid <= late)) return { ...out, reason: "stored S3 shape rejected: commands must be non-decreasing" };
    const boundedRise = (a,b) => b <= Math.max(a + 0.25, a * 1.35) + 1e-9;
    if (!boundedRise(early,mid) || !boundedRise(mid,late)) {
      return { ...out, reason: "stored S3 shape rejected: adjacent rise exceeds test bound" };
    }
    return {
      enabled: true, reason: "DECAY COMP TEST",
      earlyCommand: round(early,3),
      earlySeconds: round(earlySeconds,1),
      midCommand: round(mid,3),
      midSeconds: round(midSeconds,1),
      lateCommand: round(late,3)
    };
  }

  function manualTestCommand(stage) {
    const status = testOverrideStatus();
    if (!status.valid) return null;
    const q = state.testOverrides && state.testOverrides.stages ? state.testOverrides.stages[stage] : null;
    if (!q || String(q.mode) !== "manual") return null;
    const v = Number(q.command);
    return Number.isFinite(v) ? clampCommandFlow(v) : null;
  }

  function baseStageCommandFlow(realFlow) {
    return clampCommandFlow(resolvedCommandFlow(realFlow));
  }

  function resolvedStageCommandFlow(stage, realFlow) {
    // v0.1.38 keeps scale feedback advisory-only. A user may explicitly select a
    // bounded MANUAL TEST command per stage from DIAG / CAL; this is static for
    // the entire shot, never learned/applied while espresso is running, and does
    // not modify the saved calibration LUT.
    const manual = manualTestCommand(stage);
    return manual === null ? baseStageCommandFlow(realFlow) : manual;
  }


  function commandFlowSummary() {
    if (!state.cfg) return {};
    const rows = {};
    for (const [stage, real] of [["stage1",state.cfg.stage1Flow],["stage2",state.cfg.stage2Flow],["stage3",state.cfg.stage3Flow]]) {
      const base = baseStageCommandFlow(real);
      const manual = manualTestCommand(stage);
      rows[stage] = { desired: round(real,3), lut: round(base,3), effective: round(manual === null ? base : manual,3), mode: manual === null ? "auto" : "manual" };
    }
    const os = testOverrideStatus();
    const shape = s3ShapeStatus();
    const adaptiveSource = os.valid && !os.baselinePrior && state.testOverrides && state.testOverrides.adaptiveSource && typeof state.testOverrides.adaptiveSource === "object"
      ? {
          runId: String(state.testOverrides.adaptiveSource.runId || ""),
          appliedAt: String(state.testOverrides.adaptiveSource.appliedAt || ""),
          mode: String(state.testOverrides.adaptiveSource.mode || "")
        }
      : null;
    const appliedProfile = {
      stage1: { desiredGS: rows.stage1.desired, lutCommandMlS: rows.stage1.lut, commandMlS: rows.stage1.effective, mode: rows.stage1.mode },
      stage2: { desiredGS: rows.stage2.desired, lutCommandMlS: rows.stage2.lut, commandMlS: rows.stage2.effective, mode: rows.stage2.mode },
      stage3: shape.enabled
        ? { desiredGS: rows.stage3.desired, lutCommandMlS: rows.stage3.lut, mode: "shape", flatCommandMlS: rows.stage3.effective, shape: { ...shape } }
        : { desiredGS: rows.stage3.desired, lutCommandMlS: rows.stage3.lut, mode: rows.stage3.mode, flatCommandMlS: rows.stage3.effective, shape: { enabled:false, reason:shape.reason } }
    };
    return {
      stage1DesiredGS: rows.stage1.desired, stage1LutCommandMlS: rows.stage1.lut, stage1CommandMlS: rows.stage1.effective, stage1Mode: rows.stage1.mode,
      stage2DesiredGS: rows.stage2.desired, stage2LutCommandMlS: rows.stage2.lut, stage2CommandMlS: rows.stage2.effective, stage2Mode: rows.stage2.mode,
      stage3DesiredGS: rows.stage3.desired, stage3LutCommandMlS: rows.stage3.lut,
      stage3FlatCommandMlS: rows.stage3.effective,
      stage3CommandMlS: shape.enabled ? shape.midCommand : rows.stage3.effective,
      stage3Mode: shape.enabled ? "shape" : rows.stage3.mode,
      s3Shape: shape,
      appliedProfile,
      adaptiveSource,
      manualTestActiveStages: os.activeStages || [], manualTestStatus: os.reason || "none"
    };
  }

  async function refreshFlowMultiplier(force, strict) {
    const now = Date.now();
    if (!force && finiteOrNull(state.flowMultiplierCurrent) !== null && now - state.flowMultiplierReadAtMs < 3000) {
      return finiteOrNull(state.flowMultiplierCurrent);
    }
    try {
      const r = await api('/machine/calibration', { method: 'GET' });
      const j = await r.json();
      const v = Number(j && j.flowMultiplier);
      if (Number.isFinite(v)) {
        noteMultiplierChange(v);
        state.flowMultiplierCurrent = v;
        state.flowMultiplierReadAtMs = now;
        recomputeCalibrationUsability();
        return v;
      }
    } catch (error) {
      log(`Could not read DE1 flowMultiplier: ${error.message || error}`);
      if (strict) throw error;
    }
    if (strict) throw new Error('Fresh DE1 flowMultiplier readback unavailable');
    return finiteOrNull(state.flowMultiplierCurrent) !== null ? finiteOrNull(state.flowMultiplierCurrent) : null;
  }

  async function writeFlowMultiplier(value, reason) {
    const v = Math.max(0.13, Math.min(2.0, Number(value)));
    if (!Number.isFinite(v)) throw new Error('invalid flowMultiplier');
    if (multiplierClose(state.flowMultiplierCurrent, v)) return v;
    await api('/machine/calibration', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flowMultiplier: v })
    });
    noteMultiplierChange(v);
    state.flowMultiplierCurrent = v;
    state.flowMultiplierReadAtMs = Date.now();
    recomputeCalibrationUsability();
    log(`DE1 flowMultiplier -> ${v.toFixed(3)}${reason ? ` (${reason})` : ''}.`);
    return v;
  }

  function inHyperExScope(title) {
    return !!state.cfg && (title === state.cfg.profileTitle || isCalibrationProfileTitle(title));
  }

  async function enterHyperExScopedMultiplier(reason, expectedRevision) {
    if (state.scopeMode !== "hyperex") return;
    const mapBase = calibrationBaseMultiplier();
    const target = state.calibrationArmed && finiteOrNull(state.calibrationPendingMultiplier) !== null
      ? finiteOrNull(state.calibrationPendingMultiplier) : mapBase;
    if (!Number.isFinite(target)) return;
    if (state.scopeChangeBusy) return;
    state.scopeChangeBusy = true;
    try {
      const current = await refreshFlowMultiplier(true, expectedRevision !== undefined);
      if (expectedRevision !== undefined) checkProfileSelection(expectedRevision);
      if (!Number.isFinite(current)) return;
      if (finiteOrNull(state.scopedOriginalMultiplier) === null) { state.scopedOriginalMultiplier = current; storageWrite(STORAGE_SCOPED_ORIGINAL, String(current)); }
      await writeFlowMultiplier(target, reason || "HyperEx scoped");
      state.scopedAppliedMultiplier = target;
    } finally {
      state.scopeChangeBusy = false;
      if (!inHyperExScope(state.workflowTitle) && finiteOrNull(state.scopedOriginalMultiplier) !== null) {
        await restoreHyperExScopedMultiplier('selection left scope during multiplier update');
      }
    }
  }

  async function restoreHyperExScopedMultiplier(reason) {
    if (finiteOrNull(state.scopedOriginalMultiplier) === null) return;
    if (state.scopeChangeBusy) return;
    state.scopeChangeBusy = true;
    const original = finiteOrNull(state.scopedOriginalMultiplier);
    let restored = false;
    try {
      await writeFlowMultiplier(original, reason || "restore previous");
      restored = true;
    } catch (error) {
      log(`Could not restore previous flowMultiplier ${original}: ${error.message || error}`);
    } finally {
      if (restored) {
        state.scopedOriginalMultiplier = null;
        state.scopedAppliedMultiplier = null;
        storageWrite(STORAGE_SCOPED_ORIGINAL, '');
      }
      state.scopeChangeBusy = false;
    }
  }

  function diagnosticEvent(name, data) {
    const run = state.diagnosticCurrent;
    if (!run) return;
    run.events.push({
      tMs: Math.max(0, Date.now() - run.startedAtMs),
      name: String(name || "event"),
      phase: state.phase,
      data: data && typeof data === "object" ? data : (data === undefined ? {} : { value: data })
    });
    if (run.events.length > 300) run.events.shift();
  }

  function startDiagnostics(kind) {
    if (!state.cfg || (!state.cfg.diagnosticEnabled && !state.cfg.liveFlowTrimTest && kind !== "calibration")) {
      state.diagnosticCurrent = null;
      return;
    }
    state.diagnosticRunSeq += 1;
    const now = Date.now();
    state.diagnosticCurrent = {
      schema: 3,
      kind: String(kind || "hyperex"),
      pluginVersion: "0.1.59",
      runId: `${now}-${state.diagnosticRunSeq}`,
      profileTitle: state.workflowTitle || (state.cfg ? state.cfg.profileTitle : ""),
      startedAt: new Date(now).toISOString(),
      startedAtMs: now,
      endedAt: null,
      result: null,
      config: {
        basketContext: kind === "calibration" ? "empty" : state.cfg.basketContext,
        baselinePrior: baselineFeedForwardPayload(),
        stage1PressureLimit: state.cfg.stage1PressureLimit,
        stage2PressureLimit: state.cfg.stage2PressureLimit,
        stage3PressureLimit: state.cfg.stage3PressureLimit,
        stage1Flow: state.cfg.stage1Flow,
        stage1LutCommandMlS: baseStageCommandFlow(state.cfg.stage1Flow),
        stage1CommandMlS: resolvedStageCommandFlow("stage1", state.cfg.stage1Flow),
        stage1CommandMode: manualTestCommand("stage1") === null ? "auto" : "manual",
        stage1Weight: state.cfg.stage1Weight,
        soakSeconds: state.cfg.soakSeconds,
        stage2Flow: state.cfg.stage2Flow,
        stage2LutCommandMlS: baseStageCommandFlow(state.cfg.stage2Flow),
        stage2CommandMlS: resolvedStageCommandFlow("stage2", state.cfg.stage2Flow),
        stage2CommandMode: manualTestCommand("stage2") === null ? "auto" : "manual",
        stage2Weight: state.cfg.stage2Weight,
        stage3Flow: state.cfg.stage3Flow,
        stage3LutCommandMlS: baseStageCommandFlow(state.cfg.stage3Flow),
        stage3CommandMlS: s3ShapeStatus().enabled ? s3ShapeStatus().midCommand : resolvedStageCommandFlow("stage3", state.cfg.stage3Flow),
        stage3CommandMode: s3ShapeStatus().enabled ? "shape" : (manualTestCommand("stage3") === null ? "auto" : "manual"),
        stage3Shape: s3ShapeStatus(),
        finalWeight: state.cfg.finalWeight,
        sampleIntervalMs: state.cfg.diagnosticSampleIntervalMs,
        flowMultiplier: state.flowMultiplierCurrent,
        profileTruthVerified: !!state.runtimeProfileVerified,
        profileTruthSchema: 3,
        adaptiveFingerprint: adaptiveHistoryFingerprint(),
        profileReadbackAt: state.profileReadbackAt,
        machineProfileUploadAcknowledged: !!state.machineProfileAckKey,
        workflowProfileCommands: profileCommandSummaryFromProfile(state.workflowProfile),
        workflowProfileExecution: normalizedProfileExecution(state.workflowProfile),
        calibrationMode: state.calibrationMode,
        calibrationCommands: calibrationCommands(),
        calibrationProgram: calibrationProgram(),
        calibrationStepSeconds: calibrationModeConfig().stepSeconds,
        calibrationSettleSeconds: calibrationModeConfig().settleSeconds,
        calibrationWindowSeconds: calibrationModeConfig().windowSeconds,
        calibrationHardStopG: calibrationModeConfig().hardStopG
      },
      samples: [],
      rawScaleSamples: [],
      events: []
    };
    state.diagnosticLastSampleAtMs = 0;
    state.latestRawDwDt = null;
    diagnosticEvent(kind === "calibration" ? "calibration_start" : "sequence_start", {
      rawWeight: round(state.latestRawWeight, 3),
      flowMultiplier: round(state.flowMultiplierCurrent, 4)
    });
    log(`${kind === "calibration" ? "Flow calibration" : "Diagnostic"} capture started (${state.cfg.diagnosticSampleIntervalMs} ms target cadence).`);
  }

  function diagnosticSample(source, force) {
    const run = state.diagnosticCurrent;
    if (!run || !state.cfg || (!state.cfg.diagnosticEnabled && !state.cfg.liveFlowTrimTest)) return;
    const now = Date.now();
    if (!force && state.diagnosticLastSampleAtMs && now - state.diagnosticLastSampleAtMs < state.cfg.diagnosticSampleIntervalMs) return;
    state.diagnosticLastSampleAtMs = now;
    const scaleAgeMs = state.latestScaleAtMs ? now - state.latestScaleAtMs : null;
    const machineFlow = Number(state.lastFlow);
    const scaleFlow = Number(state.latestWeightFlow);
    const ratio = Number.isFinite(machineFlow) && Math.abs(machineFlow) >= 0.15 && Number.isFinite(scaleFlow)
      ? scaleFlow / machineFlow : null;
    run.samples.push({
      tMs: Math.max(0, now - run.startedAtMs),
      source: String(source || "sample"),
      phase: state.phase,
      machineState: state.lastMachineState,
      substate: state.lastSubstate,
      profileFrame: state.lastFrame,
      targetFlowMlS: round(state.lastTargetFlow, 3),
      desiredRealFlowGS: round(desiredRealFlowForPhase(state.phase), 3),
      targetPressureBar: round(state.lastTargetPressure, 3),
      machineFlowMlS: round(state.lastFlow, 3),
      machineTelemetryValid: state.lastMachineTelemetryValid,
      machineAgeMs: state.lastMachineAtMs ? Math.max(0,now-state.lastMachineAtMs) : null,
      pressureBar: round(state.lastPressure, 3),
      machineWeightFlowGS: round(state.lastMachineWeightFlow, 3),
      rawScaleWeightG: round(state.latestRawWeight, 3),
      rawScaleDwDtGS: round(state.latestRawDwDt, 3),
      decaidWeightFlowGS: round(state.latestWeightFlow, 3),
      // Backward-compatible aliases retained from v0.1.18.
      scaleWeightG: round(state.latestRawWeight, 3),
      scaleFlowGS: round(state.latestWeightFlow, 3),
      cumulativeWeightG: round(state.cumulativeWeight, 3),
      scaleAgeMs: Number.isFinite(scaleAgeMs) ? Math.max(0, Math.round(scaleAgeMs)) : null,
      gflowToMachineFlow: round(ratio, 4)
    });
    if (run.samples.length > 3000) run.samples.shift();
  }

  function median(values) {
    const a = values.filter(Number.isFinite).sort((x, y) => x - y);
    if (!a.length) return null;
    const i = Math.floor(a.length / 2);
    return a.length % 2 ? a[i] : (a[i - 1] + a[i]) / 2;
  }

  function average(values) {
    const a = values.filter(Number.isFinite);
    return a.length ? a.reduce((sum, v) => sum + v, 0) / a.length : null;
  }

  function diagnosticRawRegression(run, phase) {
    if (!run || !Array.isArray(run.rawScaleSamples)) return null;
    let raw = phaseRawSamples(run, phase);
    if (raw.length < 4) return null;

    const firstTMs = Number(raw[0].tMs);
    const settleSeconds = phase === "stage1" ? 0.25 : phase === "stage2" ? 1.0 : 2.0;
    let use = raw.filter(s => Number(s.tMs) - firstTMs >= settleSeconds * 1000);
    // Stage 1 is intentionally short (4 g trigger). If the settle cut leaves too
    // little data, fall back to almost the whole phase rather than reporting an
    // instantaneous dW/dt average.
    if (use.length < 5) use = raw.filter(s => Number(s.tMs) - firstTMs >= 100);
    if (use.length < 4) use = raw;

    const points = use.map(s => ({ x: rawTimeSecondsForSample(s), y: Number(s.weightG) }));
    const reg = linearRegression(points);
    if (!reg) return null;
    const times = points.map(p => p.x).filter(Number.isFinite);
    const span = times.length ? Math.max(...times) - Math.min(...times) : 0;
    return {
      slope: round(reg.slope, 3),
      r2: round(reg.r2, 5),
      samples: reg.n,
      seconds: round(span, 2),
      settleSeconds: round(settleSeconds, 2)
    };
  }

  function rawTimeSecondsForSample(s) {
    const ts = Number(s && s.scaleTimestampSeconds);
    return Number.isFinite(ts) ? ts : Number(s && s.tMs) / 1000;
  }

  function phaseRawSamples(run, phase) {
    if (!run || !Array.isArray(run.rawScaleSamples)) return [];
    let raw = run.rawScaleSamples
      .filter(s => s.phase === phase && Number.isFinite(Number(s.weightG)))
      .slice()
      .sort((a, b) => Number(a.tMs) - Number(b.tMs));
    if (!raw.length) return raw;
    let lastReset = -1;
    for (let i = 0; i < raw.length; i++) if (raw[i].tareReset) lastReset = i;
    if (lastReset >= 0) raw = raw.slice(lastReset + 1);
    return raw;
  }

  function regressionForRawSamples(samples) {
    if (!Array.isArray(samples) || samples.length < 4) return null;
    const points = samples.map(s => ({ x: rawTimeSecondsForSample(s), y: Number(s.weightG) }));
    const reg = linearRegression(points);
    if (!reg) return null;
    const xs = points.map(p => p.x).filter(Number.isFinite);
    const span = xs.length ? Math.max(...xs) - Math.min(...xs) : 0;
    return {
      slope: round(reg.slope, 3),
      r2: round(reg.r2, 5),
      samples: reg.n,
      seconds: round(span, 2)
    };
  }

  function stage1StartupMetrics(run) {
    const raw = phaseRawSamples(run, "stage1");
    if (raw.length < 6) return null;
    const pts = raw.map(s => ({ ...s, x: rawTimeSecondsForSample(s), y: Number(s.weightG) }))
      .filter(s => Number.isFinite(s.x) && Number.isFinite(s.y));
    if (pts.length < 6) return null;
    const head = pts.slice(0, Math.min(4, pts.length)).map(p => p.y);
    const tail = pts.slice(Math.max(0, pts.length - 4)).map(p => p.y);
    const baseline = median(head);
    const finalWeight = median(tail);
    const gain = Number(finalWeight) - Number(baseline);
    if (!Number.isFinite(gain) || gain < 1.0) return null;

    const crossing = threshold => {
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        if (a.y < threshold && b.y >= threshold && b.x > a.x) {
          const f = Math.max(0, Math.min(1, (threshold - a.y) / Math.max(1e-9, b.y - a.y)));
          return a.x + (b.x - a.x) * f;
        }
      }
      const exact = pts.find(p => p.y >= threshold);
      return exact ? exact.x : null;
    };

    const firstRiseThreshold = baseline + Math.min(0.20, Math.max(0.08, gain * 0.05));
    const tRise = crossing(firstRiseThreshold);
    const t20 = crossing(baseline + gain * 0.20);
    const t80 = crossing(baseline + gain * 0.80);
    const t0 = pts[0].x;
    const tEnd = pts[pts.length - 1].x;
    const midSamples = Number.isFinite(t20) && Number.isFinite(t80)
      ? pts.filter(p => p.x >= t20 && p.x <= t80) : [];
    const midReg = regressionForRawSamples(midSamples);
    const transit = Number.isFinite(t20) && Number.isFinite(t80) && t80 > t20 ? t80 - t20 : null;
    const midFlow = Number.isFinite(transit) && transit > 0 ? (gain * 0.60) / transit : null;
    const activeSeconds = Number.isFinite(tRise) && tEnd > tRise ? tEnd - tRise : null;
    const activeGain = Number.isFinite(tRise) ? Math.max(0, finalWeight - firstRiseThreshold) : null;
    const activeFlow = Number.isFinite(activeSeconds) && activeSeconds > 0 ? activeGain / activeSeconds : null;
    const target = desiredRealForRunPhase(run, "stage1");
    const errorPct = Number.isFinite(target) && target > 0 && Number.isFinite(midFlow)
      ? (midFlow - target) / target * 100 : null;
    let confidence = "INSUFFICIENT";
    const rejectionReasons = [];
    if (gain < 2.5) rejectionReasons.push("collected gain < 2.5 g");
    if (!Number.isFinite(transit) || transit < 0.90) rejectionReasons.push("20–80% transit < 0.90 s");
    if (midSamples.length < 8) rejectionReasons.push("20–80% samples < 8");
    if (!Number.isFinite(activeSeconds) || activeSeconds < 1.25) rejectionReasons.push("active duration < 1.25 s");
    if (!midReg || !Number.isFinite(Number(midReg.r2)) || Number(midReg.r2) < 0.90) rejectionReasons.push("20–80% regression R² < 0.90");
    if (gain >= 2.5 && Number.isFinite(transit) && transit >= 0.90 && midSamples.length >= 8 && Number.isFinite(activeSeconds) && activeSeconds >= 1.25) {
      confidence = midReg && Number(midReg.r2) >= 0.90 ? "MEDIUM" : "LOW";
    }
    return {
      gainG: round(gain, 3),
      firstRiseDelayS: Number.isFinite(tRise) ? round(Math.max(0, tRise - t0), 2) : null,
      transit20to80S: Number.isFinite(transit) ? round(transit, 2) : null,
      midFlowGS: Number.isFinite(midFlow) ? round(midFlow, 3) : null,
      midR2: midReg ? midReg.r2 : null,
      activeFlowGS: Number.isFinite(activeFlow) ? round(activeFlow, 3) : null,
      activeSeconds: Number.isFinite(activeSeconds) ? round(activeSeconds, 2) : null,
      targetGS: round(target, 3),
      errorPct: Number.isFinite(errorPct) ? round(errorPct, 1) : null,
      confidence,
      midSampleCount: midSamples.length, rejectionReasons,
      qualityReason: rejectionReasons.length ? rejectionReasons.join("; ") : "Startup quality gates passed"
    };
  }

  function stage1StartupAdvisory(run) {
    const m = stage1StartupMetrics(run);
    const cfg = run && run.config ? run.config : {};
    let current = Number(cfg.stage1CommandMlS);
    if (!Number.isFinite(current)) current = null;
    if (!m || !Number.isFinite(Number(m.midFlowGS)) || !Number.isFinite(Number(m.targetGS)) || Number(m.targetGS) <= 0) {
      return { phase: "stage1", basis: "20–80% startup trajectory", confidence: "INSUFFICIENT", action: "REPEAT", message: "S1 startup trajectory is not long/clean enough for a numeric test range. Keep the current command and repeat.", referenceCommandMlS: null, referenceRangeMlS: null, currentCommandMlS: current === null ? null : round(current,3) };
    }
    const err = Number(m.errorPct);
    if (m.confidence === "INSUFFICIENT" || !Number.isFinite(err) || current === null) {
      return { phase: "stage1", basis: "20–80% startup trajectory", confidence: m.confidence || "INSUFFICIENT", action: "REPEAT", message: "S1 whole-phase regression is startup-sensitive; the 20–80% trajectory is still insufficient for a numeric adjustment.", referenceCommandMlS: null, referenceRangeMlS: null, currentCommandMlS: current === null ? null : round(current,3), startupMetrics: m };
    }
    if (Math.abs(err) <= 12) {
      return { phase: "stage1", basis: "20–80% startup trajectory", confidence: m.confidence, action: "HOLD", message: `S1 20–80% trajectory is within ${Math.abs(err).toFixed(1)}% of target. Keep the current command; startup delay is reported separately.`, referenceCommandMlS: round(current,3), referenceRangeMlS: [round(current,3),round(current,3)], currentCommandMlS: round(current,3), ratio: round(Number(m.targetGS)/Number(m.midFlowGS),3), errorPct: round(err,1), startupMetrics: m };
    }
    const ratio = Number(m.targetGS) / Number(m.midFlowGS);
    const delta = ratio - 1;
    const fractions = m.confidence === "MEDIUM" ? [0.20, 0.35] : [0.10, 0.20];
    const factorA = Math.max(0.85, Math.min(1.15, 1 + delta * fractions[0]));
    const factorB = Math.max(0.85, Math.min(1.15, 1 + delta * fractions[1]));
    const cmdA = clampCommandFlow(current * factorA), cmdB = clampCommandFlow(current * factorB);
    const range = [round(Math.min(cmdA,cmdB),3), round(Math.max(cmdA,cmdB),3)];
    const midpoint = round((range[0]+range[1])/2,3);
    return {
      phase: "stage1", basis: "20–80% startup trajectory", confidence: m.confidence, action: "REFERENCE RANGE",
      message: `${err < 0 ? "Higher" : "Lower"} S1 command is indicated by the startup 20–80% trajectory. This range is intentionally small; first-rise delay is not treated as flow error.`,
      currentCommandMlS: round(current,3), referenceCommandMlS: midpoint, referenceRangeMlS: range,
      ratio: round(ratio,3), errorPct: round(err,1), startupMetrics: m
    };
  }

  function stage3StabilityDiagnostics(run) {
    let raw = phaseRawSamples(run, "stage3");
    if (raw.length < 10) return null;
    const firstMs = Number(raw[0].tMs);
    raw = raw.filter(s => Number(s.tMs) - firstMs >= 2000);
    if (raw.length < 10) return null;
    const timed = raw.map(s => ({ ...s, x: rawTimeSecondsForSample(s) })).filter(s => Number.isFinite(s.x));
    if (timed.length < 10) return null;
    const t0 = timed[0].x, t1 = timed[timed.length - 1].x, span = t1 - t0;
    if (!(span > 6)) return null;
    const q1 = t0 + span * 0.25, q3 = t0 + span * 0.75;
    const seg = (name, lo, hi, includeHi) => {
      const a = timed.filter(s => s.x >= lo && (includeHi ? s.x <= hi : s.x < hi));
      const r = regressionForRawSamples(a);
      return { name, ...(r || { slope: null, r2: null, samples: a.length, seconds: null }) };
    };
    const early = seg("EARLY", t0, q1, false);
    const mid = seg("MID", q1, q3, false);
    const late = seg("LATE", q3, t1, true);
    const target = desiredRealForRunPhase(run, "stage3");
    const ratioLateEarly = Number.isFinite(Number(early.slope)) && Number(early.slope) > 0 && Number.isFinite(Number(late.slope))
      ? Number(late.slope) / Number(early.slope) : null;

    const stallWindowSeconds = 6.0;
    const rawThreshold = Math.max(0.20, Number.isFinite(Number(target)) ? Number(target) * 0.15 : 0.20);
    const machineThreshold = 0.40;
    let stall = null;
    for (let i = 0; i < timed.length; i++) {
      const end = timed[i].x;
      const start = end - stallWindowSeconds;
      if (start < t0) continue;
      const w = timed.filter(s => s.x >= start && s.x <= end);
      if (w.length < 8) continue;
      const reg = regressionForRawSamples(w);
      if (!reg || !Number.isFinite(Number(reg.slope))) continue;
      const machine = average(w.map(s => Number(s.machineFlowMlS)));
      const activeFraction = w.filter(s => Number(s.machineFlowMlS) >= machineThreshold).length / w.length;
      if (Number.isFinite(machine) && machine >= machineThreshold && activeFraction >= 0.70 && Number(reg.slope) <= rawThreshold) {
        stall = {
          suspected: true,
          startS: round(start - t0, 1),
          endS: round(end - t0, 1),
          rawSlopeGS: reg.slope,
          rawR2: reg.r2,
          machineFlowMlS: round(machine, 3),
          thresholdGS: round(rawThreshold, 3),
          windowS: stallWindowSeconds
        };
        break;
      }
    }
    let shapeFrames = null;
    const shapeCfg = run && run.config && run.config.stage3Shape && run.config.stage3Shape.enabled ? run.config.stage3Shape : null;
    if (shapeCfg) {
      const frameSpec = [
        { frame: 2, name: "S3 EARLY", commandMlS: Number(shapeCfg.earlyCommand), plannedSeconds: Number(shapeCfg.earlySeconds) },
        { frame: 3, name: "S3 MID", commandMlS: Number(shapeCfg.midCommand), plannedSeconds: Number(shapeCfg.midSeconds) },
        { frame: 4, name: "S3 LATE", commandMlS: Number(shapeCfg.lateCommand), plannedSeconds: null }
      ];
      shapeFrames = frameSpec.map(spec => {
        const allFrame = timed.filter(x => Number(x.profileFrame) === spec.frame);
        if (!allFrame.length) return { ...spec, slope: null, r2: null, seconds: null, samples: 0 };
        const f0 = allFrame[0].x;
        const useFrame = allFrame.filter(x => x.x - f0 >= 0.75);
        const use = useFrame.length >= 6 ? useFrame : allFrame;
        const reg = regressionForRawSamples(use);
        return {
          ...spec,
          commandMlS: Number.isFinite(spec.commandMlS) ? round(spec.commandMlS,3) : null,
          plannedSeconds: Number.isFinite(spec.plannedSeconds) ? round(spec.plannedSeconds,1) : null,
          ...(reg || { slope: null, r2: null, seconds: null, samples: use.length })
        };
      });
    }
    const decayQuality = [early, mid, late].every(x => Number.isFinite(Number(x.r2)) && Number(x.r2) >= 0.90 && Number.isFinite(Number(x.slope)) && Number(x.slope) > 0);
    const decay = decayQuality && Number.isFinite(ratioLateEarly) && ratioLateEarly < 0.75;
    return {
      spanS: round(span,2), early, mid, late, shapeFrames,
      lateToEarlyRatio: Number.isFinite(ratioLateEarly) ? round(ratioLateEarly,3) : null,
      lateDecay: !!decay,
      stall: stall || { suspected: false, thresholdGS: round(rawThreshold,3), machineThresholdMlS: machineThreshold, windowS: stallWindowSeconds },
      status: stall ? "STALL SUSPECTED" : decay ? "LATE DECAY" : "STABLE"
    };
  }

  function desiredRealForRunPhase(run, phase) {
    const cfg = run && run.config || {};
    if (phase === "stage1") return finiteOrNull(cfg.stage1Flow);
    if (phase === "stage2") return finiteOrNull(cfg.stage2Flow);
    if (phase === "stage3") return finiteOrNull(cfg.stage3Flow);
    return null;
  }

  function diagnosticPhaseSummary(run, phase) {
    if (!run || !Array.isArray(run.samples)) return null;
    const all = run.samples.filter(s => s.phase === phase);
    if (!all.length) return null;
    const firstT = all[0].tMs;
    const settleMs = phase === "stage1" ? 250 : phase === "stage2" ? 1000 : 2000;
    const steady = all.filter(s => s.tMs - firstT >= settleMs && Number.isFinite(s.machineFlowMlS) && Math.abs(s.machineFlowMlS) >= 0.15 && Number.isFinite(s.scaleFlowGS));
    const use = steady.length >= 5 ? steady : all.filter(s => Number.isFinite(s.machineFlowMlS) && Math.abs(s.machineFlowMlS) >= 0.15 && Number.isFinite(s.scaleFlowGS));
    const reg = diagnosticRawRegression(run, phase);
    const desired = desiredRealForRunPhase(run, phase);
    const raw = reg && Number.isFinite(Number(reg.slope)) ? Number(reg.slope) : null;
    const errorPct = desired !== null && desired > 0 && raw !== null ? (raw - desired) / desired * 100 : null;
    let validationStatus = "NO DATA";
    if (raw !== null && desired !== null) {
      if (phase === "stage1") {
        const sm = stage1StartupMetrics(run);
        if (!sm || sm.confidence === "INSUFFICIENT" || (reg && Number(reg.seconds) < 1.5)) validationStatus = "STARTUP / REPEAT";
        else if (Math.abs(errorPct) <= 12) validationStatus = "HIT";
        else if (Math.abs(errorPct) <= 25) validationStatus = "NEAR";
        else validationStatus = "STARTUP / REPEAT";
      } else if (Math.abs(errorPct) <= 12) validationStatus = "HIT";
      else if (Math.abs(errorPct) <= 25) validationStatus = "NEAR";
      else validationStatus = "MISS";
    }
    return {
      samples: use.length,
      desiredRealFlowGS: round(desired, 3),
      commandFlowAvg: round(average(use.map(s => s.targetFlowMlS)), 3),
      machineFlowAvg: round(average(use.map(s => s.machineFlowMlS)), 3),
      gflowAvg: round(average(use.map(s => s.scaleFlowGS)), 3),
      // Retained for CSV/backward diagnostic comparison only. Do not use this
      // instantaneous derivative average as the physical validation reference.
      rawDwDtAvg: round(average(use.map(s => s.rawScaleDwDtGS)), 3),
      rawRegressionGS: raw === null ? null : round(raw, 3),
      rawRegressionR2: reg ? reg.r2 : null,
      rawRegressionSeconds: reg ? reg.seconds : null,
      rawRegressionSamples: reg ? reg.samples : 0,
      rawErrorPct: errorPct === null ? null : round(errorPct, 1),
      validationStatus,
      pressureAvg: round(average(use.map(s => s.pressureBar)), 3),
      ratioMedian: round(median(use.map(s => s.gflowToMachineFlow)), 4),
      ratioAvg: round(average(use.map(s => s.gflowToMachineFlow)), 4)
    };
  }

  function referenceAdvisory(run, phase) {
    if (phase === "stage1") return stage1StartupAdvisory(run);
    const p = diagnosticPhaseSummary(run, phase);
    if (!p || !Number.isFinite(Number(p.desiredRealFlowGS)) || !Number.isFinite(Number(p.rawRegressionGS)) || Number(p.rawRegressionGS) <= 0) {
      return { phase, confidence: "INSUFFICIENT", action: "REPEAT", message: "Not enough usable RAW weight-regression data; keep the current command and repeat an empty-basket validation.", referenceCommandMlS: null, referenceRangeMlS: null, currentCommandMlS: null };
    }
    const target = Number(p.desiredRealFlowGS);
    const measured = Number(p.rawRegressionGS);
    const err = Number(p.rawErrorPct);
    const r2 = Number(p.rawRegressionR2);
    const seconds = Number(p.rawRegressionSeconds);
    const cfg = run && run.config ? run.config : {};
    const key = phase === "stage1" ? "stage1CommandMlS" : phase === "stage2" ? "stage2CommandMlS" : "stage3CommandMlS";
    let current = Number(cfg[key]);
    if (!Number.isFinite(current)) current = Number(p.commandFlowAvg);
    if (!Number.isFinite(current)) current = null;

    let confidence = "LOW";
    if (phase === "stage1") {
      if (r2 >= 0.88 && seconds >= 2.0) confidence = "MEDIUM";
      else if (r2 >= 0.72 && seconds >= 1.5) confidence = "LOW";
      else confidence = "INSUFFICIENT";
    } else {
      if (r2 >= 0.97 && seconds >= (phase === "stage2" ? 4.0 : 5.0)) confidence = "HIGH";
      else if (r2 >= 0.93 && seconds >= 3.0) confidence = "MEDIUM";
      else if (r2 >= 0.85 && seconds >= 2.0) confidence = "LOW";
      else confidence = "INSUFFICIENT";
    }

    if (!Number.isFinite(err)) {
      return { phase, confidence: "INSUFFICIENT", action: "REPEAT", message: "Regression exists but target error could not be evaluated.", referenceCommandMlS: null, referenceRangeMlS: null, currentCommandMlS: current };
    }
    if (phase === "stage3") {
      const stability = stage3StabilityDiagnostics(run);
      if (stability && stability.stall && stability.stall.suspected && current !== null) {
        const lo = clampCommandFlow(current * 1.10), hi = clampCommandFlow(current * 1.20);
        return { phase, confidence: "MEDIUM", action: "STALL CHECK", message: `LOW-FLOW STALL SUSPECTED: machine flow stayed active while a ${stability.stall.windowS}s RAW-weight window fell to ${stability.stall.rawSlopeGS} g/s. Try a modestly higher static S3 command and repeat; do not rewrite the LUT from one stall run.`, currentCommandMlS: round(current,3), referenceCommandMlS: round((lo+hi)/2,3), referenceRangeMlS: [round(lo,3),round(hi,3)], ratio: round(target/measured,3), errorPct: round(err,1), stability };
      }
      if (stability && stability.lateDecay && current !== null) {
        const segR2 = [stability.early, stability.mid, stability.late].map(x => Number(x && x.r2)).filter(Number.isFinite);
        const segConfidence = segR2.length === 3 && Math.min(...segR2) >= 0.97 ? "HIGH" : "MEDIUM";
        return { phase, confidence: segConfidence, action: "SHAPE ADVISED", message: `S3 whole-phase average can hide late decay: LATE/EARLY=${stability.lateToEarlyRatio}. Prefer the NEXT SHOT adaptive-shape suggestion over a flat static correction.`, currentCommandMlS: round(current,3), referenceCommandMlS: round(current,3), referenceRangeMlS: [round(current,3),round(current,3)], ratio: round(target/measured,3), errorPct: round(err,1), stability };
      }
    }
    if (confidence === "INSUFFICIENT") {
      return { phase, confidence, action: "REPEAT", message: "Regression quality/window is insufficient; keep the current LUT command and repeat the empty-basket validation.", referenceCommandMlS: null, referenceRangeMlS: null, currentCommandMlS: current === null ? null : round(current,3) };
    }
    if (Math.abs(err) <= 12) {
      const suffix = confidence === "LOW" ? " Data confidence is low, so repeat once before treating this as confirmed." : "";
      return { phase, confidence, action: "HOLD", message: `Within ${Math.abs(err).toFixed(1)}% of target; keep the current command.${suffix}`, referenceCommandMlS: current === null ? null : round(current,3), referenceRangeMlS: current === null ? null : [round(current,3),round(current,3)], currentCommandMlS: current === null ? null : round(current,3) };
    }
    if (current === null) {
      return { phase, confidence, action: "REPEAT", message: "A regression exists, but the command used by this shot is unavailable. Repeat before changing anything.", referenceCommandMlS: null, referenceRangeMlS: null, currentCommandMlS: null };
    }

    // Reference RANGE only. Move only part of the theoretical ratio correction;
    // the lower-quality the run, the smaller the proposed step. This deliberately
    // avoids a full target/measured jump (e.g. 0.569 -> ~1.05) after one shot.
    const rawRatio = target / measured;
    const delta = rawRatio - 1.0;
    let fractions = confidence === "HIGH" ? [0.60,0.85] : confidence === "MEDIUM" ? [0.40,0.65] : [0.25,0.40];
    if (phase === "stage1") fractions = confidence === "MEDIUM" ? [0.25,0.40] : [0.15,0.25];
    const factorA = 1.0 + delta * fractions[0];
    const factorB = 1.0 + delta * fractions[1];
    const factorLoCap = phase === "stage1" ? 0.80 : 0.70;
    const factorHiCap = phase === "stage1" ? 1.20 : 1.35;
    const boundedA = Math.max(factorLoCap, Math.min(factorHiCap, factorA));
    const boundedB = Math.max(factorLoCap, Math.min(factorHiCap, factorB));
    const cmdA = clampCommandFlow(current * boundedA);
    const cmdB = clampCommandFlow(current * boundedB);
    const range = [round(Math.min(cmdA,cmdB),3), round(Math.max(cmdA,cmdB),3)];
    const midpoint = round((range[0] + range[1]) / 2,3);
    const direction = err < 0 ? "higher" : "lower";
    const qualityText = confidence === "LOW" ? "LOW confidence · manual test only; repeat the empty-basket run before treating the result as calibration." : `${confidence} confidence · still a manual test range, not an automatic correction.`;
    const caveat = phase === "stage1" ? " S1 is startup-transient, so its range is intentionally narrower." : "";
    return {
      phase, confidence, action: "REFERENCE RANGE",
      message: `A ${direction} command is indicated. ${qualityText}${caveat}`,
      currentCommandMlS: round(current,3),
      referenceCommandMlS: midpoint,
      referenceRangeMlS: range,
      ratio: round(rawRatio,3), errorPct: round(err,1)
    };
  }


  function stageActuatorEvidence(run, phase) {
    const cfg=run && run.config || {};
    if (cfg.basketContext !== "coffee") return {eligible:true,reason:"Empty/legacy engineering context"};
    const limit=finiteOrNull(cfg[phase+"PressureLimit"]);
    const all=(run.samples||[]).filter(x=>x.phase===phase && finiteOrNull(x.tMs)!==null);
    if (!all.length || limit===null || limit<=0) return {eligible:false,reason:"Coffee actuator evidence missing; keep command"};
    const start=Math.min(...all.map(x=>Number(x.tMs)));
    // Exclude the first second of actuator transients. No interpolated or cup
    // derivative data are used to pretend the machine reached its command.
    const rows=all.filter(x=>Number(x.tMs)-start>=1000);
    let usable=0,nearLimit=0,underCommand=0;
    for (const row of rows) {
      const pressure=finiteOrNull(row.pressureBar), flow=finiteOrNull(row.machineFlowMlS);
      let command=finiteOrNull(cfg[phase+"CommandMlS"]);
      if (phase==="stage3" && cfg.stage3Shape && cfg.stage3Shape.enabled) {
        const frame=finiteOrNull(row.profileFrame);
        command=frame===2?finiteOrNull(cfg.stage3Shape.earlyCommand):
          frame===3?finiteOrNull(cfg.stage3Shape.midCommand):
          frame===4?finiteOrNull(cfg.stage3Shape.lateCommand):null;
      }
      if (row.machineTelemetryValid!==true || finiteOrNull(row.machineAgeMs)===null || Number(row.machineAgeMs)>1000 || pressure===null || pressure<0 || flow===null || flow<0 || command===null || command<=0) continue;
      usable++;
      if (pressure>=limit*0.95) nearLimit++;
      if (flow<command*0.70) underCommand++;
    }
    const pressureFraction=usable?nearLimit/usable:1;
    const underCommandFraction=usable?underCommand/usable:1;
    const eligible=usable>=4 && usable>=rows.length*0.8 && pressureFraction<0.20 && underCommandFraction<0.25;
    const reason=usable<4 || usable<rows.length*0.8 ? "Coffee machine telemetry/frame coverage insufficient; keep command" :
      pressureFraction>=0.20 ? "Pressure limiter may be active; cup-flow target may be unreachable. Keep command, do not increase pressure" :
      underCommandFraction>=0.25 ? "Machine flow is not tracking the shot command; withhold numeric correction" :
      "Coffee pressure and actuator quality gates passed";
    return {eligible,reason,pressureLimitBar:limit,samples:usable,expectedSamples:rows.length,
      pressureLimitedFraction:round(pressureFraction,3),underCommandFraction:round(underCommandFraction,3)};
  }

  function stage1AdaptiveEvidence(run) {
    if (!stageActuatorEvidence(run, "stage1").eligible) return null;
    if (!run || (run.kind || "hyperex") !== "hyperex") return null;
    const m = stage1StartupMetrics(run);
    const cfg = run.config || {};
    const target = Number(desiredRealForRunPhase(run, "stage1"));
    const command = Number(cfg.stage1CommandMlS);
    if (!m || m.confidence !== "MEDIUM" || !Number.isFinite(target) || target <= 0 || !Number.isFinite(command)) return null;
    const measured = Number(m.midFlowGS), r2 = Number(m.midR2), transit = Number(m.transit20to80S), activeSeconds = Number(m.activeSeconds);
    if (!Number.isFinite(measured) || measured <= 0 || !Number.isFinite(r2) || r2 < 0.90 || !Number.isFinite(transit) || transit < 0.90 || !Number.isFinite(activeSeconds) || activeSeconds < 1.25) return null;
    return {
      runId: run.runId, targetGS: round(target,3), command: round(command,3), measured: round(measured,3),
      errorPct: round((measured-target)/target*100,1), confidence:"MEDIUM", r2:round(r2,5),
      transitS:round(transit,2), activeSeconds:round(activeSeconds,2), firstRiseDelayS:m.firstRiseDelayS
    };
  }

  function stage2AdaptiveEvidence(run) {
    run = liveTrimLearningView(run, "stage2");
    if (!run || !stageActuatorEvidence(run, "stage2").eligible) return null;
    if (!run || (run.kind || "hyperex") !== "hyperex") return null;
    const p = diagnosticPhaseSummary(run, "stage2");
    const cfg = run.config || {};
    const target = Number(desiredRealForRunPhase(run, "stage2"));
    const command = Number(cfg.stage2CommandMlS);
    if (!p || !Number.isFinite(target) || target <= 0 || !Number.isFinite(command)) return null;
    const measured = Number(p.rawRegressionGS), r2 = Number(p.rawRegressionR2), seconds = Number(p.rawRegressionSeconds);
    if (!Number.isFinite(measured) || measured <= 0 || !Number.isFinite(r2) || r2 < 0.97 || !Number.isFinite(seconds) || seconds < 4.0) return null;
    return {
      runId:run.runId, targetGS:round(target,3), command:round(command,3), measured:round(measured,3),
      errorPct:round((measured-target)/target*100,1), confidence:"HIGH", r2:round(r2,5), seconds:round(seconds,2)
    };
  }

  function stage3AdaptiveEvidence(run) {
    run = liveTrimLearningView(run, "stage3");
    if (!run || !stageActuatorEvidence(run, "stage3").eligible) return null;
    if (!run || (run.kind || "hyperex") !== "hyperex") return null;
    const st = stage3StabilityDiagnostics(run);
    const phase = diagnosticPhaseSummary(run, "stage3");
    const target3 = Number(desiredRealForRunPhase(run, "stage3"));
    if (!st || !phase || !Number.isFinite(target3) || target3 <= 0) return null;
    const cfg = run.config || {};
    const baseCurrent = Number(cfg.stage3CommandMlS);
    const runShape = cfg.stage3Shape && cfg.stage3Shape.enabled === true ? cfg.stage3Shape : null;
    const commandTriplet = runShape
      ? [Number(runShape.earlyCommand), Number(runShape.midCommand), Number(runShape.lateCommand)]
      : [baseCurrent, baseCurrent, baseCurrent];
    if (!commandTriplet.every(Number.isFinite)) return null;

    const overallGS = Number(phase.rawRegressionGS), overallR2 = Number(phase.rawRegressionR2), overallSeconds = Number(phase.rawRegressionSeconds);
    if (!Number.isFinite(overallGS) || overallGS <= 0 || !Number.isFinite(overallR2) || overallR2 < 0.93 || !Number.isFinite(overallSeconds) || overallSeconds < 5.0) return null;

    let source = null;
    let measurementBasis = null;
    let stallQualitative = false;
    if (Array.isArray(st.shapeFrames) && st.shapeFrames.length === 3 && st.shapeFrames.every(x =>
      Number.isFinite(Number(x.commandMlS)) && Number.isFinite(Number(x.slope)) && Number(x.slope) > 0 &&
      Number.isFinite(Number(x.r2)) && Number(x.r2) >= 0.90 && Number.isFinite(Number(x.seconds)) && Number(x.seconds) >= 3.0)) {
      source = st.shapeFrames.map((x,i) => ({ name:x.name, command:Number(commandTriplet[i]), measured:Number(x.slope), r2:Number(x.r2), seconds:Number(x.seconds), quality:"clean" }));
      measurementBasis = "profile-frame regression";
    } else if ([st.early,st.mid,st.late].every(x =>
      x && Number.isFinite(Number(x.slope)) && Number(x.slope) > 0 && Number.isFinite(Number(x.r2)) && Number(x.r2) >= 0.90 &&
      Number.isFinite(Number(x.seconds)) && Number(x.seconds) >= 3.0)) {
      // Measurement windows may fall back to EARLY/MID/LATE 25/50/25 stability segments,
      // but command provenance must always remain the commands that this shot actually ran.
      source = [
        { name:"S3 EARLY", command:commandTriplet[0], measured:Number(st.early.slope), r2:Number(st.early.r2), seconds:Number(st.early.seconds), quality:"clean" },
        { name:"S3 MID", command:commandTriplet[1], measured:Number(st.mid.slope), r2:Number(st.mid.r2), seconds:Number(st.mid.seconds), quality:"clean" },
        { name:"S3 LATE", command:commandTriplet[2], measured:Number(st.late.slope), r2:Number(st.late.r2), seconds:Number(st.late.seconds), quality:"clean" }
      ];
      measurementBasis = "stability 25/50/25 fallback";
    } else if (st.stall && st.stall.suspected) {
      // A confirmed stall is itself useful physical evidence even when the LATE segment's
      // linear fit is poor: DE1 flow stayed active while cup-weight slope collapsed for a
      // dedicated 6 s window. Require clean EARLY and MID measurements; preserve LATE as
      // qualitative stall evidence rather than throwing the whole S3 shot away.
      const clean = x => x && Number.isFinite(Number(x.slope)) && Number(x.slope) > 0 &&
        Number.isFinite(Number(x.r2)) && Number(x.r2) >= 0.90 && Number.isFinite(Number(x.seconds)) && Number(x.seconds) >= 3.0;
      const lateSlope = st.late && Number.isFinite(Number(st.late.slope)) && Number(st.late.slope) >= 0
        ? Number(st.late.slope)
        : Number(st.stall.rawSlopeGS);
      if (clean(st.early) && clean(st.mid) && Number.isFinite(lateSlope) && lateSlope >= 0 &&
          Number.isFinite(Number(st.late && st.late.seconds)) && Number(st.late.seconds) >= 3.0) {
        source = [
          { name:"S3 EARLY", command:commandTriplet[0], measured:Number(st.early.slope), r2:Number(st.early.r2), seconds:Number(st.early.seconds), quality:"clean" },
          { name:"S3 MID", command:commandTriplet[1], measured:Number(st.mid.slope), r2:Number(st.mid.r2), seconds:Number(st.mid.seconds), quality:"clean" },
          { name:"S3 LATE", command:commandTriplet[2], measured:lateSlope, r2:Number.isFinite(Number(st.late && st.late.r2)) ? Number(st.late.r2) : Number(st.stall.rawR2), seconds:Number(st.late.seconds), quality:"stall-qualitative" }
        ];
        measurementBasis = "STALL RECOVERY: clean EARLY/MID + confirmed late stall";
        stallQualitative = true;
      }
    }
    if (!source) return null;

    const shapeCfg = cfg.stage3Shape && cfg.stage3Shape.enabled ? cfg.stage3Shape : null;
    const earlySeconds = Number.isFinite(Number(shapeCfg && shapeCfg.earlySeconds)) ? Number(shapeCfg.earlySeconds) : 8;
    const midSeconds = Number.isFinite(Number(shapeCfg && shapeCfg.midSeconds)) ? Number(shapeCfg.midSeconds) : 14;
    return {
      runId: run.runId, targetGS: target3, status: st.status, stall:!!(st.stall&&st.stall.suspected), stallQualitative,
      stallRawSlopeGS: st.stall&&st.stall.suspected ? round(st.stall.rawSlopeGS,3) : null,
      stallMachineFlowMlS: st.stall&&st.stall.suspected ? round(st.stall.machineFlowMlS,3) : null,
      lateToEarlyRatio: st.lateToEarlyRatio,
      overallGS:round(overallGS,3), overallR2:round(overallR2,5), overallSeconds:round(overallSeconds,2),
      earlySeconds: round(earlySeconds,1), midSeconds: round(midSeconds,1), measurementBasis,
      source: source.map(x => ({ name:x.name, command:round(x.command,3), measured:round(x.measured,3), r2:Number.isFinite(Number(x.r2))?round(x.r2,5):null, seconds:round(x.seconds,2), quality:x.quality||"clean" }))
    };
  }

  function sameScalarAdaptiveEvidence(a,b) {
    return !!(a && b && Math.abs(Number(a.command)-Number(b.command)) <= 0.005 && Math.abs(Number(a.targetGS)-Number(b.targetGS)) <= 0.01);
  }

  function sameStage3Shape(a, b) {
    if (!a || !b || !Array.isArray(a.source) || !Array.isArray(b.source) || a.source.length !== 3 || b.source.length !== 3) return false;
    if (a.measurementBasis !== b.measurementBasis) return false;
    if (Math.abs(Number(a.earlySeconds) - Number(b.earlySeconds)) > 0.25 || Math.abs(Number(a.midSeconds) - Number(b.midSeconds)) > 0.25) return false;
    if (Math.abs(Number(a.targetGS)-Number(b.targetGS)) > 0.01) return false;
    for (let i = 0; i < 3; i++) if (Math.abs(Number(a.source[i].command) - Number(b.source[i].command)) > 0.005) return false;
    return true;
  }

  function adaptiveHistoryFingerprint() {
    if (!state.cfg || !state.calibrationMapUsable || !state.calibrationMap || state.calibrationMap.valid !== true ||
        finiteOrNull(state.flowMultiplierCurrent) === null || !multiplierClose(state.flowMultiplierCurrent, calibrationBaseMultiplier())) return null;
    return {
      schema: 3,
      basketContext: state.cfg.basketContext,
      mapCreatedAt: String(state.calibrationMap.createdAt || ""),
      lutSchema: state.calibrationMap.schema,
      lutAlgorithm: state.calibrationMap.algorithm || "",
      lutPoints: canonicalProfileValue(calibrationPoints()),
      targetAnchors: canonicalProfileValue(state.calibrationMap.targetAnchors || []),
      baseFlowMultiplier: round(calibrationBaseMultiplier(), 4),
      actualFlowMultiplier: round(state.flowMultiplierCurrent, 4),
      targets: { stage1:round(state.cfg.stage1Flow,4), stage2:round(state.cfg.stage2Flow,4), stage3:round(state.cfg.stage3Flow,4) },
      shotSettings: {
        temperature:state.cfg.temperature, stage1Weight:state.cfg.stage1Weight, soakSeconds:state.cfg.soakSeconds,
        stage2Weight:state.cfg.stage2Weight, finalWeight:state.cfg.finalWeight,
        stage1PressureLimit:state.cfg.stage1PressureLimit, stage2PressureLimit:state.cfg.stage2PressureLimit,
        stage3PressureLimit:state.cfg.stage3PressureLimit, hardPressureLimit:state.cfg.hardPressureLimit
      },
      profileTruthSchema: 3,
      model: "hyperex-realflow-lut-nextshot-v3"
    };
  }

  // Operating qualification survives a normal temperature adjustment. Numeric
  // shot-to-shot consensus also ignores temperature, while retaining all quality gates.
  function qualificationFingerprintKey(fp) {
    if(!fp||typeof fp!=="object")return "";
    const q={...fp,shotSettings:{...(fp.shotSettings||{})}};
    delete q.basketContext;delete q.shotSettings.temperature;
    return adaptiveHistoryFingerprintKey(q);
  }

  function refreshLearningStage() {
    if (!state.cfg || state.phase!=="idle") return state.learningStage;
    const status={automatic:true,minEmptyShots:2,maxEmptyShots:3,emptyShots:0};
    const finish=(stage,message,extra={})=>{
      state.learningStage={...status,stage,message,...extra};
      return state.learningStage;
    };
    if (!state.calibrationMapUsable) {
      state.cfg.basketContext="empty";
      return finish("STEP 1 · EMPTY CALIBRATION","Run Step 1 with an empty locked-in basket to save the original LUT.");
    }
    const key=qualificationFingerprintKey;
    const fingerprint=key(adaptiveHistoryFingerprint());
    const rows=state.persistentHistoryFile && state.persistentHistoryFile.shots || [];
    const matching=fingerprint?rows.filter(r=>r && /^completed at /i.test(String(r.result||"")) &&
      r.profileTruthSchema===3 && r.profileTruthVerified===true && key(r.fingerprint)===fingerprint):[];
    const empty=matching.filter(r=>(r.basketContext||"unknown")!=="coffee");
    const coffee=matching.filter(r=>r.basketContext==="coffee");
    status.emptyShots=empty.length;
    if (coffee.length) {
      state.cfg.basketContext="coffee";
      return finish("NORMAL COFFEE · AUTO","Continue normal coffees; the retained empty baseline is refined from completed coffee evidence.");
    }
    // Never change a run's interpretation while its automatic application is
    // queued/in flight, nor use an unverified/failed storage write as readiness.
    const applyStatus=state.autoApplyLastStatus && state.autoApplyLastStatus.status;
    if (["scheduled","applying"].includes(applyStatus)) return finish("STEP 2 · APPLYING","Wait for the pending next-shot decision and verified application. Do not start an extra test cup.");
    if (!state.runtimeProfileVerified || !state.machineProfileAckKey || state.persistentHistoryAvailable!==true || state.pendingHistoryWrite) {
      return finish("STEP 2 · CHECKING","Waiting for verified workflow and history readback; do not add test cups while checks are pending.");
    }
    if (applyStatus==="error") return finish("STEP 2 · BLOCKED","Automatic application failed. Read the raw workflow/error and fix it; do not add empty-basket cups.");
    const usable=(r,strict)=>{
      const a=r.s2||{},b=r.s3||{};
      return [a.rawRegressionGS,b.rawRegressionGS].every(x=>finiteOrNull(x)!==null && Number(x)>0) &&
        Number(a.windowS)>=4 && Number(b.windowS)>=5 &&
        Number(a.rawRegressionR2)>=(strict ? .97 : .93) && Number(b.rawRegressionR2)>=(strict ? .93 : .85) &&
        !(r.s3Stability&&r.s3Stability.stall&&r.s3Stability.stall.suspected);
    };
    const last=empty.slice(-2);
    const inBand=r=>["s2","s3"].every(k=>{
      const q=r[k];return Number(q.targetGS)>0 && Math.abs(Number(q.rawRegressionGS)/Number(q.targetGS)-1)<=.12;
    });
    const variation=k=>{
      const a=Number(last[0]&&last[0][k]&&last[0][k].rawRegressionGS);
      const b=Number(last[1]&&last[1][k]&&last[1][k].rawRegressionGS);
      return Math.abs(a-b)/((a+b)/2);
    };
    const stable=last.length===2 && last.every(r=>usable(r,true)&&inBand(r)) && variation("s2")<=.15 && variation("s3")<=.20;
    const capped=empty.length>=3 && last.length===2 && last.every(r=>usable(r,false));
    if (stable || capped) {
      state.cfg.basketContext="coffee";
      return finish("READY FOR COFFEE · AUTO",stable?
        "Two clean stable empty-basket shots are sufficient. You can fill the basket and brew normally; no further empty-basket tuning.":
        "Empty-basket tuning has reached its 3-shot limit. Preserve this baseline and begin coffee use; at most one dedicated filled-basket acceptance shot.",
        {transitionBasis:stable?"two stable shots":"bounded empty-basket test budget",limitedEmptyImprovement:!stable});
    }
    state.cfg.basketContext="empty";
    return finish(empty.length>=3?"STEP 2 · BLOCKED":"STEP 2 · EMPTY BASELINE",empty.length>=3?
      "The 3-shot limit is reached but data/stall checks need attention. Stop empty-basket tests and inspect existing diagnostics.":
      "Run Step 2 with an empty basket. The plugin refines the next-shot command mapping while preserving the original LUT. It will prompt you automatically after 2–3 shots.");
  }

  function baselineFeedForwardPayload() {
    const fingerprint=adaptiveHistoryFingerprint();
    const baseKey=qualificationFingerprintKey;
    const key=baseKey(fingerprint);
    const rows=state.persistentHistoryFile && state.persistentHistoryFile.shots || [];
    const references=key ? rows.filter(row=>row && /^completed at /i.test(String(row.result||"")) && row.profileTruthSchema===3 && row.profileTruthVerified===true &&
      (row.basketContext||"unknown")!=="coffee" && baseKey(row.fingerprint)===key) : [];
    const latest=references.length?references[references.length-1]:null;
    const override=testOverrideStatus();
    return {role:"feed-forward prior; not a matching coffee consensus shot",
      calibrationRetained:!!state.calibrationMapUsable,referenceShots:references.length,
      sourceRunIds:references.map(row=>row.runId),sourceClassification:"empty/pre-upgrade reference",
      commandSeedRetained:!!(override.valid && override.baselinePrior && override.activeStages.length),
      sourceCommands:latest&&latest.commands||null,
      priorCupResponse:latest?{stage1:latest.s1Startup||latest.s1,stage2:latest.s2,stage3:latest.s3,stage3Stability:latest.s3Stability}:null,
      note:"Retain LUT, validated command baseline and historical cup-response reference. Coffee backpressure changes the response; numeric coffee updates require new coffee evidence and actuator/pressure quality."};
  }

  function numericLearningFingerprintKey(fp) {
    if(!fp||typeof fp!=="object")return "";
    const q={...fp,shotSettings:{...(fp.shotSettings||{})}};
    delete q.shotSettings.temperature;
    return adaptiveHistoryFingerprintKey(q);
  }

  function trustedAdaptiveRun(run) {
    const c = run && run.config;
    const key = numericLearningFingerprintKey(adaptiveHistoryFingerprint());
    return !!(run && run.kind === "hyperex" && /^completed at /i.test(String(run.result || "")) && c &&
      c.profileTruthVerified === true && c.profileTruthSchema === 3 && c.basketContext === state.cfg.basketContext && key &&
      numericLearningFingerprintKey(c.adaptiveFingerprint) === key);
  }

  function adaptiveHistoryFingerprintKey(fp) {
    if (!fp || typeof fp !== "object") return "";
    try { return JSON.stringify(canonicalProfileValue(fp)); } catch (_) { return ""; }
  }

  function historyStatusPayload() {
    const shots = state.persistentHistoryFile && Array.isArray(state.persistentHistoryFile.shots) ? state.persistentHistoryFile.shots.length : 0;
    return {
      available: state.persistentHistoryAvailable,
      status: state.persistentHistoryStatus || "unknown",
      savedShots: shots,
      compatibleShots: Number(state.persistentHistoryCompatibleCount || 0),
      baselineReferenceShots: baselineFeedForwardPayload().referenceShots,
      maxShots: HISTORY_FILE_MAX_SHOTS,
      storageKey: STORAGE_HISTORY_FILE
    };
  }

  function setPersistentHistoryUnavailable(reason) {
    state.persistentHistoryAvailable = false;
    state.storageProbeVerified = false;
    state.pendingHistoryWrite = null;
    state.adaptiveHistory = (state.adaptiveHistory || []).filter(ev => !ev.restoredFromDisk);
    state.persistentHistoryCompatibleCount = 0;
    if (state.historyWriteTimer) { clearTimeout(state.historyWriteTimer); state.historyWriteTimer = null; }
    state.persistentHistoryStatus = `SESSION ONLY: ${reason || 'pluginStorage unavailable'}`;
    if (state.storageProbeTimer) { clearTimeout(state.storageProbeTimer); state.storageProbeTimer = null; }
    log(`Persistent adaptive history unavailable. Shot-to-shot adaptation remains active for this plugin session, but cross-reload/version history is disabled. ${reason || ''}`);
    emitSkinChanged();
  }

  function startPersistentHistoryProbe() {
    if (state.storageProbeTimer) clearTimeout(state.storageProbeTimer);
    state.storageProbeToken = `${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
    state.storageProbeVerified = false;
    state.persistentHistoryAvailable = null;
    state.persistentHistoryStatus = "checking pluginStorage write/readback";
    // Arm timeout before requesting a read, including hosts that reply synchronously.
    state.storageProbeTimer = setTimeout(() => {
      if (state.persistentHistoryAvailable !== true) setPersistentHistoryUnavailable("write/readback probe timed out");
    }, 3500);
    if (!storageWrite(STORAGE_HISTORY_PROBE, state.storageProbeToken)) {
      setPersistentHistoryUnavailable("probe write failed");
      return;
    }
    if (!storageRead(STORAGE_HISTORY_PROBE)) setPersistentHistoryUnavailable("probe read request failed");
  }

  function compactPersistentShotRecord(run, evidence) {
    if (!run || !run.runId) return null;
    const summary = run.summary || diagnosticSummary(run) || {};
    const compactPhase = phase => {
      const q = summary[phase] || {};
      return {
        targetGS: q.desiredRealFlowGS, rawRegressionGS: q.rawRegressionGS, rawRegressionR2: q.rawRegressionR2,
        windowS: q.rawRegressionSeconds, de1Flow: q.machineFlowAvg, decaidWeightFlow: q.gflowAvg, status: q.validationStatus, errorPct: q.rawErrorPct
      };
    };
    const st = summary.stage3Stability || null;
    return {
      runId: String(run.runId),
      pluginVersion: "0.1.59",
      basketContext: run.config && run.config.basketContext || "unknown",
      startedAt: run.startedAt || null, endedAt: run.endedAt || null, result: run.result || null,
      fingerprint: run.config && run.config.adaptiveFingerprint || null,
      profileTruthSchema: run.config && run.config.profileTruthSchema || 0,
      profileTruthVerified: !!(run.config && run.config.profileTruthVerified),
      experimentalLiveTrim: !!(run.config && run.config.experimentalLiveTrim),
      liveFlowTrim: run.liveFlowTrim || null,
      workflowProfileCommands: run.config && run.config.workflowProfileCommands ? run.config.workflowProfileCommands : null,
      profileReadbackAt: run.config && run.config.profileReadbackAt || null,
      machineUploadAcknowledged: !!(run.config && run.config.machineProfileUploadAcknowledged),
      commands: diagnosticRunCommandSnapshot(run),
      flowMultiplier: run.config ? round(run.config.flowMultiplier,4) : null,
      s1: compactPhase("stage1"), s2: compactPhase("stage2"), s3: compactPhase("stage3"),
      s1Startup: summary.stage1Startup ? { confidence:summary.stage1Startup.confidence, firstRiseDelayS:summary.stage1Startup.firstRiseDelayS, midFlowGS:summary.stage1Startup.midFlowGS, midR2:summary.stage1Startup.midR2, activeFlowGS:summary.stage1Startup.activeFlowGS } : null,
      s3Stability: st ? { status:st.status, lateToEarlyRatio:st.lateToEarlyRatio, early:st.early, mid:st.mid, late:st.late, stall:st.stall } : null,
      adaptiveDecision: summary.nextShotAdaptive || null,
      nextShotApplied: null,
      evidence: evidence || null
    };
  }

  function persistHistoryFile() {
    // Never overwrite disk before the initial read, and serialize full-file writes.
    if (!state.persistentHistoryLoaded || !state.storageProbeVerified || state.persistentHistoryAvailable === false || !state.persistentHistoryFile) return false;
    if (state.pendingHistoryWrite) { state.historyWriteDirty = true; return true; }
    state.persistentHistoryFile.writerVersion = "0.1.59";
    state.persistentHistoryFile.updatedAt = new Date().toISOString();
    state.persistentHistoryFile.writeToken = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    state.pendingHistoryWrite = JSON.stringify(state.persistentHistoryFile);
    state.historyWriteDirty = false;
    state.historyWriteTimer = setTimeout(() => setPersistentHistoryUnavailable('history file readback timed out'), 3500);
    if (!storageWrite(STORAGE_HISTORY_FILE, state.pendingHistoryWrite) || !storageRead(STORAGE_HISTORY_FILE)) {
      setPersistentHistoryUnavailable('history file write/read request failed');
      return false;
    }
    return true;
  }

  function recordNextShotApplied(run, commandFlows) {
    const rows = state.persistentHistoryFile && state.persistentHistoryFile.shots;
    const row = Array.isArray(rows) && rows.find(x => x && x.runId === run.runId);
    if (!row) return;
    row.nextShotApplied = { at:new Date().toISOString(), commandFlows, profileTruth:runtimeProfileTruthPayload() };
    persistHistoryFile();
  }

  function appendPersistentHistoryShot(run, evidence) {
    const record = compactPersistentShotRecord(run, evidence);
    if (!record) return;
    if (!state.persistentHistoryFile || typeof state.persistentHistoryFile !== "object") {
      state.persistentHistoryFile = { schema:2, kind:"HyperExAdaptiveHistory", writerVersion:"0.1.59", createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(), shots:[] };
    }
    if (!Array.isArray(state.persistentHistoryFile.shots)) state.persistentHistoryFile.shots = [];
    state.persistentHistoryFile.shots = state.persistentHistoryFile.shots.filter(x => x && x.runId !== record.runId);
    state.persistentHistoryFile.shots.push(record);
    if (state.persistentHistoryFile.shots.length > HISTORY_FILE_MAX_SHOTS) state.persistentHistoryFile.shots = state.persistentHistoryFile.shots.slice(-HISTORY_FILE_MAX_SHOTS);
    persistHistoryFile();
  }

  function restoreAdaptiveHistoryFromPersistentFile() {
    refreshLearningStage();
    const fpKey = numericLearningFingerprintKey(adaptiveHistoryFingerprint());
    const compatible = row => row && row.profileTruthSchema === 3 && row.fingerprint &&
      numericLearningFingerprintKey(row.fingerprint) === fpKey;
    // Session evidence remains usable even when persistent storage is unavailable.
    const session = (state.adaptiveHistory || []).filter(ev => compatible(ev) && (!ev.restoredFromDisk || state.persistentHistoryAvailable === true));
    const saved = state.persistentHistoryAvailable === true && fpKey && state.persistentHistoryFile && Array.isArray(state.persistentHistoryFile.shots)
      ? state.persistentHistoryFile.shots.filter(row => row && row.evidence && row.profileTruthVerified === true && compatible(row)) : [];
    state.persistentHistoryCompatibleCount = saved.length;
    const merged = new Map();
    for (const ev of saved.map(row => ({...row.evidence, restoredFromDisk:true})).concat(session)) {
      if (ev && ev.runId && compatible(ev)) merged.set(ev.runId, ev);
    }
    state.adaptiveHistory = Array.from(merged.values()).slice(-20);
    emitSkinChanged();
    return state.adaptiveHistory.length > 0;
  }

  function rememberAdaptiveEvidence(run) {
    const truthVerified = trustedAdaptiveRun(run);
    const ev = truthVerified ? { runId:run && run.runId, profileTruthSchema:3, fingerprint:run.config.adaptiveFingerprint, s1:stage1AdaptiveEvidence(run), s2:stage2AdaptiveEvidence(run), s3:stage3AdaptiveEvidence(run) } : null;
    if (!truthVerified) {
      appendPersistentHistoryShot(run, null);
      if (run && run.kind === "hyperex") log(`Adaptive evidence excluded: workflow profile truth was not verified at shot start (${run.runId || 'unknown run'}).`);
      return;
    }
    if (!ev.runId || (!ev.s1 && !ev.s2 && !ev.s3)) {
      appendPersistentHistoryShot(run, ev && ev.runId ? ev : null);
      return;
    }
    if (!Array.isArray(state.adaptiveHistory)) state.adaptiveHistory = [];
    state.adaptiveHistory = state.adaptiveHistory.filter(x => x && x.runId !== ev.runId);
    state.adaptiveHistory.push(ev);
    if (state.adaptiveHistory.length > 20) state.adaptiveHistory = state.adaptiveHistory.slice(-20);
    storageWrite(STORAGE_ADAPTIVE_HISTORY, JSON.stringify(state.adaptiveHistory.slice(-8)));
    appendPersistentHistoryShot(run, ev);
  }

  function previousMatchingAdaptiveEvidence(current, key) {
    if (!current || !Array.isArray(state.adaptiveHistory)) return null;
    for (let i=state.adaptiveHistory.length-1;i>=0;i--) {
      const row=state.adaptiveHistory[i];
      if (!row || row.runId === current.runId) continue;
      if ((row.restoredFromDisk && state.persistentHistoryAvailable !== true) || row.profileTruthSchema !== 3 || numericLearningFingerprintKey(row.fingerprint) !== numericLearningFingerprintKey(adaptiveHistoryFingerprint())) return null;
      const ev=row[key] || (key === "s3" && row.source ? row : null);
      if (!ev) return null;
      return (key === "s3" ? sameStage3Shape(current,ev) : sameScalarAdaptiveEvidence(current,ev)) ? ev : null;
    }
    return null;
  }

  function scalarConsensusSuggestion(label,current,previous,opt) {
    if (!current) return { usable:false, action:"REPEAT", confidence:"INSUFFICIENT", reason:`${label} data is not clean enough for numeric adaptation.` };
    const base = { targetGS:round(Number(current.targetGS),3), currentCommandMlS:round(Number(current.command),3), measuredGS:round(Number(current.measured),3) };
    if (!previous) return { ...base, usable:false, action:"REPEAT SAME COMMAND", confidence:"PENDING", repeatCount:1, reason:`One clean ${label} shot is not enough. Repeat the same command once more.` , maxStepRule:opt.rule };
    const mean=(Number(current.measured)+Number(previous.measured))/2;
    const variability=mean>0?Math.abs(Number(current.measured)-Number(previous.measured))/mean:Infinity;
    const e1=(Number(previous.measured)-Number(current.targetGS))/Number(current.targetGS)*100;
    const e2=(Number(current.measured)-Number(current.targetGS))/Number(current.targetGS)*100;
    const meanErr=(mean-Number(current.targetGS))/Number(current.targetGS)*100;
    const common={...base, measuredGS:round(mean,3), previousGS:round(Number(previous.measured),3), currentGS:round(Number(current.measured),3), variabilityPct:round(variability*100,1), repeatCount:2, maxStepRule:opt.rule};
    if (!Number.isFinite(variability) || variability>opt.maxVariability) return {...common,usable:false,action:"VARIABLE / REPEAT",confidence:"LOW",reason:`Repeated ${label} response differs by ${round(variability*100,1)}%; keep the same command rather than chasing shot variability.`};
    if (Math.abs(e1)<=opt.deadbandPct && Math.abs(e2)<=opt.deadbandPct) return {...common,usable:true,action:"HOLD",confidence:"HIGH",suggestedCommandMlS:round(Number(current.command),3),reason:`Both matching shots are inside the ${opt.deadbandPct}% deadband.`};
    if (Math.sign(e1)!==Math.sign(e2) || Math.abs(e1)<=opt.deadbandPct || Math.abs(e2)<=opt.deadbandPct) return {...common,usable:false,action:"MIXED / REPEAT",confidence:"MEDIUM",reason:`The two matching shots do not show the same out-of-band direction; keep the command and collect another shot.`};
    const ratio=Number(current.targetGS)/mean;
    let factor=1+(ratio-1)*opt.gain;
    factor=Math.max(1-opt.maxFraction,Math.min(1+opt.maxFraction,factor));
    let out=Number(current.command)*factor;
    out=Math.max(Number(current.command)-opt.maxAbs,Math.min(Number(current.command)+opt.maxAbs,out));
    out=clampCommandFlow(out);
    const delta=Math.abs(out-Number(current.command));
    return {...common,usable:true,action:delta<0.005?"HOLD":"ADJUST",confidence:"HIGH",suggestedCommandMlS:round(out,3),errorPct:round(meanErr,1),reason:delta<0.005?`Consensus error is too small to justify a command change.`:`Two matching ${label} shots agree on the same error direction; apply one bounded damped step to the next shot.`};
  }

  // A varying absolute level must not veto a repeatable shape by itself. This
  // fallback requires same commands, timings AND measurement basis. It freezes
  // LEVEL and compares frame flows normalized independently within each shot.
  function stage3ShapeOnlyConsensus(current, previous) {
    if (!sameStage3Shape(current, previous) || current.measurementBasis !== previous.measurementBasis ||
        current.stall || previous.stall || current.stallQualitative || previous.stallQualitative) return null;
    if (![current,previous].every(e => e.status === "LATE DECAY" &&
        Number.isFinite(Number(e.lateToEarlyRatio)) && Number(e.lateToEarlyRatio) < 0.80 &&
        Number(e.overallR2) >= 0.95 && e.source.every(x =>
          Number(x.r2) >= 0.95 && Number(x.seconds) >= 3 && Number(x.measured) > 0 &&
          Number(x.command) >= 0.10 && Number(x.command) <= 8))) return null;
    const weights = current.source.map((x,i) => Math.min(Number(x.seconds),Number(previous.source[i].seconds)));
    const weightSum = weights.reduce((a,b)=>a+b,0);
    const normalized = e => {
      const mean = e.source.reduce((sum,x,i)=>sum+Number(x.measured)*weights[i],0)/weightSum;
      return e.source.map(x=>Number(x.measured)/mean);
    };
    const a=normalized(current), b=normalized(previous);
    const shapeVar=Math.max(...a.map((x,i)=>Math.abs(x-b[i])/((x+b[i])/2)));
    const overallMean=(Number(current.overallGS)+Number(previous.overallGS))/2;
    const overallVar=Math.abs(Number(current.overallGS)-Number(previous.overallGS))/overallMean;
    const profileRatio = e => Number(e.source[2].measured)/Number(e.source[0].measured);
    // Require decay in both the diagnostic quarters and the actual profile frames.
    if (!Number.isFinite(shapeVar) || shapeVar>0.15 || !Number.isFinite(overallVar) || overallVar>0.20 ||
        ![current,previous].every(e=>profileRatio(e)<0.80) ||
        Math.abs(profileRatio(current)-profileRatio(previous))>0.12) return null;
    const commands=current.source.map(x=>Number(x.command));
    let factors=a.map((x,i)=>Math.max(0.97,Math.min(1.03,1+(1/((x+b[i])/2)-1)*0.08)));
    // Preserve weighted command exposure, rather than only the mean factor.
    const exposure=commands.reduce((sum,x,i)=>sum+x*weights[i],0);
    const norm=factors.reduce((sum,x,i)=>sum+x*commands[i]*weights[i],0)/exposure;
    let proposed=commands.map((x,i)=>round(x*factors[i]/norm,3));
    if (proposed.some((x,i)=>x<0.10 || x>8 || Math.abs(x-commands[i])>0.05 ||
        Math.abs(x/commands[i]-1)>0.04)) return null;
    if (proposed[0]>proposed[1] || proposed[1]>proposed[2] ||
        proposed.slice(1).some((x,i)=>x>proposed[i]*1.35 || x-proposed[i]>0.25)) return null;
    const exposureChange=proposed.reduce((sum,x,i)=>sum+x*weights[i],0)/exposure-1;
    if (Math.abs(exposureChange)>0.002 || !proposed.some((x,i)=>Math.abs(x-commands[i])>=0.005)) return null;
    return {
      usable:true, action:"SHAPE ONLY / LEVEL HOLD", confidence:"MEDIUM",
      targetGS:current.targetGS, overallGS:round(overallMean,3), levelFactor:1,
      shapeFactors:proposed.map((x,i)=>round(x/commands[i],4)),
      normalizedShapeVariabilityPct:round(shapeVar*100,1), overallVariabilityPct:round(overallVar*100,1),
      weightedCommandChangePct:round(exposureChange*100,3),
      status:current.status, lateToEarlyRatio:current.lateToEarlyRatio, repeatCount:2,
      sourceFrames:current.source.map((x,i)=>({name:x.name,commandMlS:x.command,currentGS:x.measured,
        previousGS:previous.source[i].measured,r2:Math.min(x.r2,previous.source[i].r2),windowS:weights[i]})),
      suggestedShape:{earlyCommand:proposed[0],earlySeconds:current.earlySeconds,
        midCommand:proposed[1],midSeconds:current.midSeconds,lateCommand:proposed[2]},
      maxStepRule:"SHAPE ONLY: 2 same-basis clean decay shots; normalized variation ≤15%, overall variation ≤20%; LEVEL held; each frame ≤4% and 0.05 ml/s; weighted command exposure within 0.2%",
      reason:"Absolute frame levels vary, but normalized decay agrees in two matching shots. Apply a small next-shot shape correction with LEVEL held. Weighted command exposure is preserved; cup flow still requires validation."
    };
  }

  function nextShotAdaptiveSuggestion(run) {
    if (!trustedAdaptiveRun(run)) return null;
    const s1ev=stage1AdaptiveEvidence(run), s2ev=stage2AdaptiveEvidence(run), s3ev=stage3AdaptiveEvidence(run);
    const s1=scalarConsensusSuggestion("S1 startup",s1ev,previousMatchingAdaptiveEvidence(s1ev,"s1"),{
      deadbandPct:12,maxVariability:0.18,gain:0.18,maxFraction:0.04,maxAbs:0.04,rule:"2 matching MEDIUM-confidence startup shots; ±12% deadband; max ±4% and ±0.04 ml/s per next shot"
    });
    if (!s1ev) {
      const startup=stage1StartupMetrics(run);
      s1.reason=startup ? startup.qualityReason : "Not enough S1 RAW scale samples or collected gain.";
      s1.startupMetrics=startup;
    }
    const s2=scalarConsensusSuggestion("S2",s2ev,previousMatchingAdaptiveEvidence(s2ev,"s2"),{
      deadbandPct:12,maxVariability:0.15,gain:0.25,maxFraction:0.05,maxAbs:0.10,rule:"2 matching high-quality shots; ±12% HIT deadband; max ±5% and ±0.10 ml/s per next shot"
    });

    let s3={usable:false,action:"REPEAT",confidence:"INSUFFICIENT",reason:"S3 segment/overall data is insufficient."};
    if (s3ev) {
      const prev=previousMatchingAdaptiveEvidence(s3ev,"s3");
      if (!prev) {
        s3={usable:false,action:"REPEAT SAME SHAPE",confidence:"PENDING",targetGS:round(Number(s3ev.targetGS),3),overallGS:s3ev.overallGS,status:s3ev.status,lateToEarlyRatio:s3ev.lateToEarlyRatio,sourceFrames:s3ev.source.map(x=>({name:x.name,commandMlS:x.command,measuredGS:x.measured,r2:x.r2,windowS:x.seconds})),repeatCount:1,maxStepRule:"2 matching shots; LEVEL and SHAPE are solved separately",reason:"One clean S3 shot is not enough. Repeat the same shape once more before numeric next-shot adaptation."};
      } else if (s3ev.stall || prev.stall) {
        const target=Number(s3ev.targetGS);
        const currentRatio=Number(s3ev.lateToEarlyRatio), previousRatio=Number(prev.lateToEarlyRatio);
        const currentLateWeak=!!(s3ev.stall || s3ev.status==="LATE DECAY" || (Number.isFinite(currentRatio)&&currentRatio<0.75));
        const previousLateWeak=!!(prev.stall || prev.status==="LATE DECAY" || (Number.isFinite(previousRatio)&&previousRatio<0.75));
        const bothLateWeak=currentLateWeak&&previousLateWeak;
        const overallMean=(Number(s3ev.overallGS)+Number(prev.overallGS))/2;
        const currentErr=(Number(s3ev.overallGS)-target)/target*100;
        const previousErr=(Number(prev.overallGS)-target)/target*100;
        if (!bothLateWeak || !Number.isFinite(overallMean) || overallMean<=0) {
          s3={usable:false,action:"STALL / REPEAT",confidence:"LOW",targetGS:round(target,3),overallGS:Number.isFinite(overallMean)?round(overallMean,3):null,status:s3ev.status,lateToEarlyRatio:s3ev.lateToEarlyRatio,repeatCount:2,maxStepRule:"stall recovery requires 2 same-shape shots that both show late weakness",reason:"A confirmed stall exists, but the matching shot does not confirm the same late-weakness pattern. Keep the current profile and repeat rather than chase one stall."};
        } else {
          // STALL RECOVERY: the dedicated stall detector is qualitative evidence, so use a
          // smaller bounded step than the normal clean LEVEL+SHAPE controller. LEVEL is
          // allowed to rise only when BOTH matching shots are >10% below target. SHAPE is
          // normalized so late compensation does not silently create a large level jump.
          let levelFactor=1;
          if (currentErr < -10 && previousErr < -10) {
            const ratio=target/overallMean;
            levelFactor=1+(ratio-1)*0.14;
            levelFactor=Math.max(1.0,Math.min(1.04,levelFactor));
          }
          const ratios=[currentRatio,previousRatio].filter(Number.isFinite);
          const meanLateRatio=ratios.length?ratios.reduce((a,b)=>a+b,0)/ratios.length:0.5;
          const severity=Math.max(0,Math.min(1,(0.80-meanLateRatio)/0.80));
          const weights=s3ev.source.map(x=>Math.max(1,Number(x.seconds)||1));
          const wsum=weights.reduce((a,b)=>a+b,0);
          let shapeFactors=[1-0.025*severity,1+0.005*severity,1+0.060*severity];
          const norm=shapeFactors.reduce((a,f,i)=>a+f*weights[i],0)/wsum;
          shapeFactors=shapeFactors.map(f=>f/Math.max(0.001,norm));
          const bounded=(cmd,f)=>{let out=cmd*f;out=Math.max(cmd*0.93,cmd-0.05,out);out=Math.min(cmd*1.07,cmd+0.05,out);return clampCommandFlow(out)};
          const commands=s3ev.source.map(x=>Number(x.command));
          let early=bounded(commands[0],levelFactor*shapeFactors[0]);
          let mid=bounded(commands[1],levelFactor*shapeFactors[1]);
          let late=bounded(commands[2],levelFactor*shapeFactors[2]);
          mid=Math.max(mid,early); late=Math.max(late,mid);
          const boundRise=(a,b)=>Math.min(b,Math.max(a,Math.min(a+0.25,a*1.35)));
          mid=boundRise(early,mid);late=boundRise(mid,late);
          const changed=[early,mid,late].some((v,i)=>Math.abs(v-commands[i])>=0.005);
          s3={usable:changed,action:changed?"STALL RECOVERY":"STALL / HOLD",confidence:"MEDIUM",targetGS:round(target,3),overallGS:round(overallMean,3),levelErrorPct:round((overallMean-target)/target*100,1),levelFactor:round(levelFactor,4),shapeFactors:shapeFactors.map(x=>round(x,4)),status:s3ev.status,lateToEarlyRatio:s3ev.lateToEarlyRatio,meanLateToEarlyRatio:round(meanLateRatio,3),recoverySeverity:round(severity,3),repeatCount:2,maxStepRule:"STALL RECOVERY requires 2 same-shape late-weak shots with ≥1 confirmed stall; LEVEL max +4%; each frame max ±7% and ±0.05 ml/s",sourceFrames:s3ev.source.map((x,i)=>({name:x.name,commandMlS:round(x.command,3),currentGS:round(x.measured,3),previousGS:round(prev.source[i]&&prev.source[i].measured,3),quality:x.quality||"clean",r2:x.r2,windowS:x.seconds})),suggestedShape:changed?{earlyCommand:round(early,3),earlySeconds:s3ev.earlySeconds,midCommand:round(mid,3),midSeconds:s3ev.midSeconds,lateCommand:round(late,3)}:null,reason:changed?"Two matching S3 shots confirm late weakness and at least one has a dedicated low-flow stall. Apply one conservative next-shot recovery step: LEVEL rises only if both overall flows are low, while normalized SHAPE shifts command toward LATE.":"Repeated stall evidence was confirmed but the bounded recovery step is too small to justify a profile rewrite."};
        }
      } else {
        const pairs=s3ev.source.map((x,i)=>{const p=prev.source[i],mean=(Number(x.measured)+Number(p.measured))/2;return {name:x.name,command:Number(x.command),measuredMean:mean,variability:mean>0?Math.abs(Number(x.measured)-Number(p.measured))/mean:Infinity,r2:Math.min(Number(x.r2),Number(p.r2)),seconds:Math.max(1,Math.min(Number(x.seconds),Number(p.seconds))),currentMeasured:Number(x.measured),previousMeasured:Number(p.measured)}});
        const overallMean=(Number(s3ev.overallGS)+Number(prev.overallGS))/2;
        const overallVar=overallMean>0?Math.abs(Number(s3ev.overallGS)-Number(prev.overallGS))/overallMean:Infinity;
        const maxVar=Math.max(overallVar,...pairs.map(x=>x.variability));
        const minR2=Math.min(Number(s3ev.overallR2),Number(prev.overallR2),...pairs.map(x=>x.r2));
        if (!Number.isFinite(maxVar)||maxVar>0.20) {
          s3={usable:false,action:"VARIABLE / REPEAT",confidence:"LOW",targetGS:round(Number(s3ev.targetGS),3),overallGS:round(overallMean,3),status:s3ev.status,lateToEarlyRatio:s3ev.lateToEarlyRatio,repeatCount:2,variabilityPct:round(maxVar*100,1),sourceFrames:pairs.map(x=>({name:x.name,commandMlS:round(x.command,3),measuredGS:round(x.measuredMean,3),variabilityPct:round(x.variability*100,1),previousGS:round(x.previousMeasured,3),currentGS:round(x.currentMeasured,3),r2:round(x.r2,5),windowS:round(x.seconds,2)})),maxStepRule:"no numeric adjustment when any repeated S3 measure differs by >20%",reason:"The repeated S3 response is too variable. Keep the same shape and repeat instead of chasing the latest shot."};
          const shapeOnly=stage3ShapeOnlyConsensus(s3ev,prev);
          if (shapeOnly) s3={...s3,...shapeOnly};
        } else {
          const confidence=minR2>=0.97&&maxVar<=0.15?"HIGH":"MEDIUM";
          const target=Number(s3ev.targetGS);
          const levelErr=(overallMean-target)/target*100;
          const levelGain=confidence==="HIGH"?0.22:0.16;
          let levelFactor=1;
          if (Math.abs(levelErr)>10) levelFactor=1+(target/overallMean-1)*levelGain;
          levelFactor=Math.max(0.95,Math.min(1.05,levelFactor));
          const weights=pairs.map(x=>Math.max(1,x.seconds));
          const wsum=weights.reduce((a,b)=>a+b,0);
          const frameMean=pairs.reduce((a,x,i)=>a+x.measuredMean*weights[i],0)/wsum;
          const shapeGain=confidence==="HIGH"?0.12:0.08;
          let shapeFactors=pairs.map(x=>{
            const rel=frameMean/Math.max(0.05,x.measuredMean);
            let f=1+(rel-1)*shapeGain;
            return Math.max(0.97,Math.min(1.03,f));
          });
          const norm=shapeFactors.reduce((a,f,i)=>a+f*weights[i],0)/wsum;
          shapeFactors=shapeFactors.map(f=>f/Math.max(0.001,norm));
          const bounded=(cmd,f)=>{let out=cmd*f;out=Math.max(cmd*0.93,cmd-0.05,out);out=Math.min(cmd*1.07,cmd+0.05,out);return clampCommandFlow(out)};
          let early=bounded(pairs[0].command,levelFactor*shapeFactors[0]);
          let mid=bounded(pairs[1].command,levelFactor*shapeFactors[1]);
          let late=bounded(pairs[2].command,levelFactor*shapeFactors[2]);
          mid=Math.max(mid,early); late=Math.max(late,mid);
          const boundRise=(a,b)=>Math.min(b,Math.max(a,Math.min(a+0.25,a*1.35)));
          mid=boundRise(early,mid);late=boundRise(mid,late);
          const changed=[early,mid,late].some((v,i)=>Math.abs(v-pairs[i].command)>=0.005);
          s3={usable:true,action:changed?"LEVEL + SHAPE":"HOLD",confidence,targetGS:round(target,3),overallGS:round(overallMean,3),levelErrorPct:round(levelErr,1),levelFactor:round(levelFactor,4),shapeFactors:shapeFactors.map(x=>round(x,4)),status:s3ev.status,lateToEarlyRatio:s3ev.lateToEarlyRatio,repeatCount:2,variabilityPct:round(maxVar*100,1),maxStepRule:"2 matching shots; LEVEL uses overall S3; SHAPE is normalized to ~zero weighted level change; each frame max ±7% and ±0.05 ml/s",sourceFrames:pairs.map(x=>({name:x.name,commandMlS:round(x.command,3),measuredGS:round(x.measuredMean,3),variabilityPct:round(x.variability*100,1),previousGS:round(x.previousMeasured,3),currentGS:round(x.currentMeasured,3),r2:round(x.r2,5),windowS:round(x.seconds,2)})),suggestedShape:changed?{earlyCommand:round(early,3),earlySeconds:s3ev.earlySeconds,midCommand:round(mid,3),midSeconds:s3ev.midSeconds,lateCommand:round(late,3)}:null,reason:changed?"S3 overall LEVEL and EARLY/MID/LATE SHAPE were solved separately, then combined into one bounded next-shot profile.":"S3 consensus is inside the overall deadband and shape imbalance is too small to justify a change."};
        }
      }
    }
    const actuatorGuards={stage1:stageActuatorEvidence(run,"stage1"),stage2:stageActuatorEvidence(run,"stage2"),stage3:stageActuatorEvidence(run,"stage3")};
    for (const [key,guard] of [["s1",actuatorGuards.stage1],["s2",actuatorGuards.stage2],["s3",actuatorGuards.stage3]]) {
      const decision=key==="s1"?s1:key==="s2"?s2:s3;
      if (!guard.eligible) Object.assign(decision,{usable:false,action:"LIMITED / HOLD",confidence:"INSUFFICIENT",reason:guard.reason,actuatorGuard:guard});
    }
    const actionable=!!((s1.usable&&s1.action==="ADJUST"&&Number.isFinite(Number(s1.suggestedCommandMlS)))||(s2.usable&&s2.action==="ADJUST"&&Number.isFinite(Number(s2.suggestedCommandMlS)))||(s3.usable&&s3.suggestedShape));
    return {usable:!!(s1.usable||s2.usable||s3.usable),actionable,basketContext:run.config.basketContext||"unknown",actuatorGuards,runId:run.runId,mode:"SHOT-TO-SHOT ONLY",s1,s2,s3,note:"All three stages use completed-shot evidence only. No running-shot scale control, no extra skipStep calls, and the calibration LUT is never rewritten."};
  }


  async function applyNextShotAdaptiveSuggestion(run, source) {
    if (state.phase !== "idle" || state.calibrationActive) throw new Error("Next-shot adaptation can only be applied while HyperEx is idle");
    recomputeCalibrationUsability();
    if (!state.calibrationMapUsable) throw new Error(`Calibration LUT is not usable: ${state.calibrationMapStaleReason || "not ready"}`);
    const suggestion = nextShotAdaptiveSuggestion(run);
    if (!suggestion || !suggestion.actionable) throw new Error("No actionable bounded next-shot suggestion is available from the latest HyperEx run");
    const binding = testOverrideBinding();
    const os = testOverrideStatus();
    const prevStages = os.valid && state.testOverrides && state.testOverrides.stages ? state.testOverrides.stages : {};
    const sourceCfg = run && run.config && typeof run.config === "object" ? run.config : {};

    const preserveStage = (stage) => {
      const n = stage === "stage1" ? "1" : stage === "stage2" ? "2" : "3";
      const sourceMode = String(sourceCfg[`stage${n}CommandMode`] || "").toLowerCase();
      const sourceCommand = Number(sourceCfg[`stage${n}CommandMlS`]);
      if (sourceMode === "manual" && Number.isFinite(sourceCommand)) {
        return { mode:"manual", command:round(clampCommandFlow(sourceCommand),3) };
      }
      const q = prevStages[stage] && typeof prevStages[stage] === "object" ? prevStages[stage] : {};
      if (String(q.mode) === "manual" && Number.isFinite(Number(q.command))) {
        return { mode:"manual", command:round(clampCommandFlow(Number(q.command)),3) };
      }
      return { mode:"auto", command:null };
    };
    const stages = {
      stage1: preserveStage("stage1"),
      stage2: preserveStage("stage2"),
      stage3: preserveStage("stage3")
    };
    if (suggestion.s1 && suggestion.s1.usable && suggestion.s1.action === "ADJUST" && Number.isFinite(Number(suggestion.s1.suggestedCommandMlS))) {
      stages.stage1 = { mode:"manual", command:round(clampCommandFlow(Number(suggestion.s1.suggestedCommandMlS)),3) };
    }
    if (suggestion.s2 && suggestion.s2.usable && suggestion.s2.action === "ADJUST" && Number.isFinite(Number(suggestion.s2.suggestedCommandMlS))) {
      stages.stage2 = { mode:"manual", command:round(clampCommandFlow(Number(suggestion.s2.suggestedCommandMlS)),3) };
    }

    const sourceShape = sourceCfg.stage3Shape && typeof sourceCfg.stage3Shape === "object" ? sourceCfg.stage3Shape : null;
    let s3Shape = sourceShape && sourceShape.enabled === true
      ? JSON.parse(JSON.stringify(sourceShape))
      : (os.valid && state.testOverrides && state.testOverrides.s3Shape ? JSON.parse(JSON.stringify(state.testOverrides.s3Shape)) : { enabled:false });
    if (suggestion.s3 && suggestion.s3.usable && suggestion.s3.suggestedShape) {
      const q = suggestion.s3.suggestedShape;
      s3Shape = { enabled:true, earlyCommand:round(clampCommandFlow(Number(q.earlyCommand)),3), earlySeconds:round(Math.max(3,Math.min(30,Number(q.earlySeconds))),1), midCommand:round(clampCommandFlow(Number(q.midCommand)),3), midSeconds:round(Math.max(3,Math.min(30,Number(q.midSeconds))),1), lateCommand:round(clampCommandFlow(Number(q.lateCommand)),3) };
    }
    const previousOverrides = state.testOverrides ? JSON.parse(JSON.stringify(state.testOverrides)) : null;
    try {
      state.testOverrides = { schema:3, writerVersion:"0.1.59", savedAt:new Date().toISOString(), mapCreatedAt:binding.mapCreatedAt, basketContext:binding.basketContext, targets:binding.targets, stages, s3Shape, adaptiveSource:{ runId:suggestion.runId, appliedAt:new Date().toISOString(), mode:String(source || "manual") } };
      storageWrite(STORAGE_TEST_OVERRIDES, state.testOverrides);

      const verifyStatus = testOverrideStatus();
      if (!verifyStatus.valid) throw new Error(`adaptive override readback rejected: ${verifyStatus.reason}`);
      if (suggestion.s1 && suggestion.s1.usable && suggestion.s1.action === "ADJUST") {
        const expectedS1 = round(clampCommandFlow(Number(suggestion.s1.suggestedCommandMlS)),3);
        const actualS1 = manualTestCommand("stage1");
        if (!Number.isFinite(actualS1) || Math.abs(Number(actualS1) - expectedS1) > 0.001) {
          throw new Error(`S1 adaptive readback mismatch: expected ${expectedS1}, got ${actualS1}`);
        }
      }
      if (suggestion.s2 && suggestion.s2.usable && suggestion.s2.action === "ADJUST") {
        const expectedS2 = round(clampCommandFlow(Number(suggestion.s2.suggestedCommandMlS)),3);
        const actualS2 = manualTestCommand("stage2");
        if (!Number.isFinite(actualS2) || Math.abs(Number(actualS2) - expectedS2) > 0.001) {
          throw new Error(`S2 adaptive readback mismatch: expected ${expectedS2}, got ${actualS2}`);
        }
      }
      if (suggestion.s3 && suggestion.s3.usable && suggestion.s3.suggestedShape) {
        const expected = suggestion.s3.suggestedShape;
        const actual = s3ShapeStatus();
        const same = actual.enabled === true &&
          Math.abs(Number(actual.earlyCommand) - Number(expected.earlyCommand)) <= 0.001 &&
          Math.abs(Number(actual.midCommand) - Number(expected.midCommand)) <= 0.001 &&
          Math.abs(Number(actual.lateCommand) - Number(expected.lateCommand)) <= 0.001 &&
          Math.abs(Number(actual.earlySeconds) - Number(expected.earlySeconds)) <= 0.01 &&
          Math.abs(Number(actual.midSeconds) - Number(expected.midSeconds)) <= 0.01;
        if (!same) throw new Error(`S3 adaptive shape readback mismatch: ${JSON.stringify(actual)}`);
      }

      await syncHyperExProfile(state.workflowTitle === state.cfg.profileTitle);
      const commandFlows = commandFlowSummary();
      if (suggestion.s3 && suggestion.s3.usable && suggestion.s3.suggestedShape && commandFlows.stage3Mode !== "shape") {
        throw new Error(`S3 profile verification failed: effective mode is ${commandFlows.stage3Mode}`);
      }
      recordNextShotApplied(run, commandFlows);
      log(`Next-shot adaptive suggestion VERIFIED (${source || "manual"}) from ${suggestion.runId}: ${JSON.stringify(commandFlows)}`);
      return { verified:true, suggestion, commandFlows };
    } catch (applyError) {
      state.testOverrides = previousOverrides;
      storageWrite(STORAGE_TEST_OVERRIDES, previousOverrides || '');
      try { await syncHyperExProfile(state.workflowTitle === state.cfg.profileTitle); } catch (_) {}
      throw applyError;
    }
  }

  async function autoApplyNextShotIfEligible(run) {
    if (!state.autoApplyNextShot || !run) return;
    if (state.autoApplyLastStatus && state.autoApplyLastStatus.runId === run.runId &&
        ["applying","applied","manual-applied"].includes(state.autoApplyLastStatus.status)) return;
    const suggestion = nextShotAdaptiveSuggestion(run);
    if (!suggestion || !suggestion.actionable) {
      state.autoApplyLastStatus = {
        runId: run.runId, status: "waiting", at: new Date().toISOString(),
        message: suggestion ? `S1 ${suggestion.s1&&suggestion.s1.action||"—"} · S2 ${suggestion.s2&&suggestion.s2.action||"—"} · S3 ${suggestion.s3&&suggestion.s3.action||"—"}` : "No actionable suggestion; current settings retained"
      };
      emitSkinChanged();
      log(`AUTO APPLY waiting after ${run.runId}: ${state.autoApplyLastStatus.message}.`);
      refreshLearningStage();
      return;
    }
    state.autoApplyLastStatus = {runId:run.runId,status:"applying",at:new Date().toISOString(),message:"Applying proposal; awaiting workflow readback and machine upload acknowledgement"};
    emitSkinChanged();
    try {
      const result = await applyNextShotAdaptiveSuggestion(run, "auto");
      state.autoApplyLastStatus = {
        runId: run.runId, status: "applied", at: new Date().toISOString(),
        message: "Verified next-shot adaptive override applied automatically",
        commandFlows: result.commandFlows
      };
      emitSkinChanged();
      log(`AUTO APPLY completed for ${run.runId}.`);
      refreshLearningStage();
    } catch (error) {
      state.autoApplyLastStatus = {
        runId: run.runId, status: "error", at: new Date().toISOString(),
        message: String(error.message || error)
      };
      emitSkinChanged();
      log(`AUTO APPLY failed safely for ${run.runId}: ${error.message || error}`);
    }
  }

  async function adaptiveAuditPayload() {
    const revision=state.workflowSelectionRevision;
    const basketContext=state.cfg.basketContext;
    const fingerprint=adaptiveHistoryFingerprintKey(adaptiveHistoryFingerprint());
    const expected=profileObject();
    const response=await api("/workflow",{method:"GET"});
    const body=await response.json();
    const actual=body && body.profile && typeof body.profile==="object" ? body.profile : null;
    const contextStable=revision===state.workflowSelectionRevision && basketContext===state.cfg.basketContext && fingerprint===adaptiveHistoryFingerprintKey(adaptiveHistoryFingerprint()) && profileExecutionEquivalent(expected,profileObject());
    const proposal=nextShotAdaptiveSuggestion(state.diagnosticLast);
    const commands=actual?profileCommandSummaryFromProfile(actual):null;
    const close=(a,b)=>finiteOrNull(a)!==null && finiteOrNull(b)!==null && Math.abs(Number(a)-Number(b))<=0.001;
    let proposalMatchesWorkflow=null;
    if (proposal && proposal.actionable) {
      proposalMatchesWorkflow=!!(contextStable && commands);
      for (const [key,field] of [["s1","stage1CommandMlS"],["s2","stage2CommandMlS"]]) {
        const q=proposal[key];
        if (q && q.usable && q.action==="ADJUST") proposalMatchesWorkflow=proposalMatchesWorkflow && close(commands&&commands[field],q.suggestedCommandMlS);
      }
      if (proposal.s3 && proposal.s3.usable && proposal.s3.suggestedShape) {
        const shape=commands && commands.s3Shape;
        proposalMatchesWorkflow=proposalMatchesWorkflow && !!(shape&&shape.enabled) &&
          ["earlyCommand","earlySeconds","midCommand","midSeconds","lateCommand"].every(k=>close(shape[k],proposal.s3.suggestedShape[k]));
      }
    }
    // Read-only: never repairs or uploads a profile. A proposal is separate
    // from the workflow and neither is independent DE1 firmware-memory proof.
    return {serverTime:new Date().toISOString(),basketContext,
      contextStable,rawWorkflowProfile:actual,actualCommands:actual?profileCommandSummaryFromProfile(actual):null,
      expectedCommands:profileCommandSummaryFromProfile(expected),
      workflowMatchesExpected:contextStable && profileExecutionEquivalent(actual,expected),
      differences:profileExecutionDifferences(actual,expected),
      proposal,proposalMatchesWorkflow,baselinePrior:baselineFeedForwardPayload(),
      autoApply:state.autoApplyLastStatus,cachedProfileTruth:runtimeProfileTruthPayload(),
      machineProfileIndependentlyReadBack:false};
  }

  function diagnosticRunCommandSnapshot(run) {
    const c = run && run.config && typeof run.config === "object" ? run.config : null;
    if (!c) return null;
    const shape = c.stage3Shape && c.stage3Shape.enabled === true ? c.stage3Shape : null;
    return {
      stage1: { desiredGS: round(c.stage1Flow,3), lutCommandMlS: round(c.stage1LutCommandMlS,3), commandMlS: round(c.stage1CommandMlS,3), mode: String(c.stage1CommandMode || "auto") },
      stage2: { desiredGS: round(c.stage2Flow,3), lutCommandMlS: round(c.stage2LutCommandMlS,3), commandMlS: round(c.stage2CommandMlS,3), mode: String(c.stage2CommandMode || "auto") },
      stage3: shape ? {
        desiredGS: round(c.stage3Flow,3), lutCommandMlS: round(c.stage3LutCommandMlS,3), mode:"shape",
        shape: {
          enabled:true, earlyCommand:round(shape.earlyCommand,3), earlySeconds:round(shape.earlySeconds,1),
          midCommand:round(shape.midCommand,3), midSeconds:round(shape.midSeconds,1), lateCommand:round(shape.lateCommand,3)
        }
      } : {
        desiredGS: round(c.stage3Flow,3), lutCommandMlS: round(c.stage3LutCommandMlS,3), mode:String(c.stage3CommandMode || "auto"),
        flatCommandMlS: round(c.stage3CommandMlS,3), shape:{ enabled:false }
      }
    };
  }

  function diagnosticSummary(run) {
    if (!run) return null;
    return {
      runId: run.runId,
      kind: run.kind || "hyperex",
      profileTitle: run.profileTitle || "",
      startedAt: run.startedAt,
      endedAt: run.endedAt,
      result: run.result,
      liveFlowTrim: run.liveFlowTrim || null,
      shotCommands: diagnosticRunCommandSnapshot(run),
      sampleCount: Array.isArray(run.samples) ? run.samples.length : 0,
      rawScaleSampleCount: Array.isArray(run.rawScaleSamples) ? run.rawScaleSamples.length : 0,
      eventCount: Array.isArray(run.events) ? run.events.length : 0,
      lastRawScaleWeightG: Array.isArray(run.rawScaleSamples) && run.rawScaleSamples.length ? round(run.rawScaleSamples[run.rawScaleSamples.length - 1].weightG, 3) : null,
      lastRawScaleDwDtGS: Array.isArray(run.rawScaleSamples) && run.rawScaleSamples.length ? round(run.rawScaleSamples[run.rawScaleSamples.length - 1].rawDwDtGS, 3) : null,
      lastDecaidWeightFlowGS: Array.isArray(run.rawScaleSamples) && run.rawScaleSamples.length ? round(run.rawScaleSamples[run.rawScaleSamples.length - 1].decaidWeightFlowGS, 3) : null,
      stage1: diagnosticPhaseSummary(run, "stage1"),
      stage2: diagnosticPhaseSummary(run, "stage2"),
      stage3: diagnosticPhaseSummary(run, "stage3"),
      stage1Startup: stage1StartupMetrics(run),
      stage3Stability: stage3StabilityDiagnostics(run),
      advisory: {
        stage1: referenceAdvisory(run, "stage1"),
        stage2: referenceAdvisory(run, "stage2"),
        stage3: referenceAdvisory(run, "stage3")
      },
      nextShotAdaptive: nextShotAdaptiveSuggestion(run),
      legacyStage1StartupFactor: round(stage1StartupFactor(), 4)
    };
  }

  function finalizeDiagnostics(result) {
    const run = state.diagnosticCurrent;
    if (!run) return;
    diagnosticSample("final", true);
    run.endedAt = new Date().toISOString();
    run.result = String(result || "ended");
    run.summary = diagnosticSummary(run);
    state.diagnosticLast = run;
    rememberAdaptiveEvidence(run);
    state.diagnosticCurrent = null;
    state.diagnosticLastSampleAtMs = 0;
    const s2 = run.summary && run.summary.stage2;
    const s3 = run.summary && run.summary.stage3;
    log(`Diagnostic capture saved: ${run.samples.length} samples; stage2 GFlow/Flow=${s2 && s2.ratioMedian !== null ? s2.ratioMedian : "n/a"}, stage3=${s3 && s3.ratioMedian !== null ? s3.ratioMedian : "n/a"}.`);
    return run;
  }

  function csvEscape(value) {
    if (value === null || value === undefined) return "";
    const s = String(value);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  function diagnosticCsv(run) {
    if (!run) return "No diagnostic run captured yet.\n";
    const headers = ["runId","tMs","source","phase","machineState","substate","profileFrame","targetFlowMlS","desiredRealFlowGS","targetPressureBar","machineFlowMlS","pressureBar","machineWeightFlowGS","rawScaleWeightG","rawScaleDwDtGS","decaidWeightFlowGS","scaleWeightG","scaleFlowGS","cumulativeWeightG","scaleAgeMs","gflowToMachineFlow"];
    const rows = [headers.join(",")];
    for (const s of run.samples || []) {
      const obj = { runId: run.runId, ...s };
      rows.push(headers.map(h => csvEscape(obj[h])).join(","));
    }
    rows.push("");
    rows.push("raw_scale_runId,raw_scale_tMs,raw_scale_phase,profileFrame,targetFlow_ml_s,machineFlow_ml_s,pressure_bar,raw_scale_timestamp,raw_scale_timestamp_seconds,raw_scale_weight_g,raw_scale_dWdt_g_s,decaid_weightFlow_g_s,raw_scale_tare_reset");
    for (const r of run.rawScaleSamples || []) {
      rows.push([
        run.runId,
        r.tMs,
        r.phase,
        r.profileFrame,
        r.targetFlowMlS,
        r.machineFlowMlS,
        r.pressureBar,
        r.scaleTimestamp,
        r.scaleTimestampSeconds,
        r.weightG,
        r.rawDwDtGS,
        r.decaidWeightFlowGS,
        r.tareReset ? 1 : 0
      ].map(csvEscape).join(","));
    }
    rows.push("");
    rows.push("event_tMs,event_name,event_phase,event_data");
    for (const e of run.events || []) {
      rows.push([e.tMs,e.name,e.phase,JSON.stringify(e.data || {})].map(csvEscape).join(","));
    }
    if ((run.kind || "hyperex") === "hyperex") {
      const summary = diagnosticSummary(run);
      rows.push("");
      rows.push("validation_stage,target_real_g_s,machine_flow_avg_ml_s,decaid_weightFlow_avg_g_s,raw_weight_regression_g_s,regression_r2,regression_window_s,error_pct,status");
      for (const [label, p] of [["S1", summary.stage1],["S2", summary.stage2],["S3", summary.stage3]]) {
        rows.push([label,p && p.desiredRealFlowGS,p && p.machineFlowAvg,p && p.gflowAvg,p && p.rawRegressionGS,p && p.rawRegressionR2,p && p.rawRegressionSeconds,p && p.rawErrorPct,p && p.validationStatus].map(csvEscape).join(","));
      }
      rows.push("");
      rows.push("advisory_stage,confidence,action,current_command_ml_s,reference_command_ml_s,reference_range_min_ml_s,reference_range_max_ml_s,ratio,error_pct,message");
      for (const [label, a] of [["S1", summary.advisory && summary.advisory.stage1],["S2", summary.advisory && summary.advisory.stage2],["S3", summary.advisory && summary.advisory.stage3]]) {
        const rr = a && Array.isArray(a.referenceRangeMlS) ? a.referenceRangeMlS : [null,null];
        rows.push([label,a && a.confidence,a && a.action,a && a.currentCommandMlS,a && a.referenceCommandMlS,rr[0],rr[1],a && a.ratio,a && a.errorPct,a && a.message].map(csvEscape).join(","));
      }
      rows.push("");
      rows.push("s1_startup_confidence,first_rise_delay_s,transit_20_80_s,mid_flow_g_s,mid_r2,active_flow_g_s,active_seconds,gain_g,error_pct");
      const s1m = summary.stage1Startup || {};
      rows.push([s1m.confidence,s1m.firstRiseDelayS,s1m.transit20to80S,s1m.midFlowGS,s1m.midR2,s1m.activeFlowGS,s1m.activeSeconds,s1m.gainG,s1m.errorPct].map(csvEscape).join(","));
      rows.push("");
      rows.push("s3_segment,raw_regression_g_s,r2,window_s,samples");
      const s3s = summary.stage3Stability || {};
      for (const seg of [s3s.early,s3s.mid,s3s.late]) if (seg) rows.push([seg.name,seg.slope,seg.r2,seg.seconds,seg.samples].map(csvEscape).join(","));
      rows.push("s3_stability_status,late_to_early_ratio,stall_suspected,stall_start_s,stall_end_s,stall_raw_g_s,stall_machine_ml_s,stall_threshold_g_s");
      const st = s3s.stall || {};
      rows.push([s3s.status,s3s.lateToEarlyRatio,st.suspected?1:0,st.startS,st.endS,st.rawSlopeGS,st.machineFlowMlS,st.thresholdGS].map(csvEscape).join(","));
      if (Array.isArray(s3s.shapeFrames) && s3s.shapeFrames.length) {
        rows.push("s3_shape_frame,command_ml_s,raw_regression_g_s,r2,window_s,samples,planned_seconds");
        for (const x of s3s.shapeFrames) rows.push([x.name,x.commandMlS,x.slope,x.r2,x.seconds,x.samples,x.plannedSeconds].map(csvEscape).join(","));
      }
      const nx = summary.nextShotAdaptive || {};
      rows.push("");
      rows.push("next_shot_stage,usable,confidence,current_command_ml_s,suggested_command_ml_s,early_command_ml_s,early_seconds,mid_command_ml_s,mid_seconds,late_command_ml_s,reason");
      const nx1 = nx.s1 || {};
      rows.push(["S1",nx1.usable?1:0,nx1.confidence,nx1.currentCommandMlS,nx1.suggestedCommandMlS,null,null,null,null,null,nx1.reason].map(csvEscape).join(","));
      const nx3 = nx.s3 || {}, q3 = nx3.suggestedShape || {};
      rows.push(["S3",nx3.usable?1:0,nx3.confidence,null,null,q3.earlyCommand,q3.earlySeconds,q3.midCommand,q3.midSeconds,q3.lateCommand,nx3.reason].map(csvEscape).join(","));
    }
    return rows.join("\n") + "\n";
  }

  function emitGhcPrompt(status, secondsRemaining, message) {
    try {
      host.emit("ghcPrompt", {
        status: String(status || ""),
        secondsRemaining: Math.max(0, Math.ceil(Number(secondsRemaining) || 0)),
        message: String(message || "")
      });
    } catch (error) {
      log(`GHC prompt event failed: ${error.message || error}`);
    }
  }

  function stopGhcPrompt(status, message) {
    clearTimer("ghcCountdownTimer");
    state.ghcPromptStartedAtMs = 0;
    state.ghcSecondsRemaining = 0;
    emitGhcPrompt(status, 0, message);
    emitSkinChanged();
  }

  function emitSkinChanged() {
    try { host.emit("changed", { what: "skin" }); } catch (_) {}
  }

  function startSoakCountdown() {
    clearTimer("soakCountdownTimer");
    state.soakPromptStartedAtMs = Date.now();
    const total = Math.max(0, state.cfg.soakSeconds);
    let last = null;
    const tick = () => {
      if (state.phase !== "soak") return;
      const elapsed = (Date.now() - state.soakPromptStartedAtMs) / 1000;
      const remaining = Math.max(0, Math.ceil(total - elapsed));
      state.soakSecondsRemaining = remaining;
      if (remaining !== last) {
        last = remaining;
        emitGhcPrompt("soak", remaining, `SOAK — ${remaining}s remaining`);
        emitSkinChanged();
      }
      if (remaining > 0 && state.phase === "soak") {
        state.soakCountdownTimer = setTimeout(tick, 250);
      }
    };
    tick();
  }

  function pluginHttpJson(request, status, body) {
    return { requestId: request.requestId, status, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
  }

  function pluginHttpHtml(request, status, body) {
    return { requestId: request.requestId, status, headers: { "Content-Type": "text/html; charset=utf-8" }, body };
  }

  function pluginHttpText(request, status, contentType, body, extraHeaders) {
    return { requestId: request.requestId, status, headers: { "Content-Type": contentType, ...(extraHeaders || {}) }, body };
  }

  function uiStatusPayload() {
    return {
      phase: state.phase,
      liveFlowTrimTest: liveTrimPayload(),
      directStartTest: directStartTestPayload(),
      soakSecondsRemaining: state.soakSecondsRemaining,
      ghcSecondsRemaining: state.ghcSecondsRemaining,
      armRequestCount: state.armRequestCount,
      cumulativeWeight: Math.round(state.cumulativeWeight * 100) / 100,
      stage2Flow: state.cfg ? state.cfg.stage2Flow : 5,
      diagnosticAvailable: !!state.diagnosticLast,
      diagnosticSummary: diagnosticSummary(state.diagnosticLast),
      calibrationActive: state.calibrationActive,
      calibration: calibrationStatusPayload(),
      commandFlows: commandFlowSummary()
    };
  }

  function buildSkinSurfaceAnswer() {
    const surfaces = [];
    const live = { endpoint: "changed" };
    if (state.phase === "dumping") {
      surfaces.push({
        id: "hyperex-release-header", kind: "header-button", label: "RELEASING", text: "ACTIVE PRESSURE RELEASE",
        action: { type: "open", view: "ghc", presentation: "overlay", fit: true, closeOnShot: true }
      });
      surfaces.push({
        id: "hyperex-release-strip", kind: "shot-strip", show: "always", cells: [
          { label: "HYPEREX", text: "ACTIVE RELEASE", color: "amber", col: 1, span: 4 },
          { label: "STATUS", text: "WAITING FOR SETTLE", color: "accent", col: 5, span: 5 }
        ]
      });
    } else if (state.phase === "soak") {
      const sec = Math.max(0, state.soakSecondsRemaining);
      surfaces.push({
        id: "hyperex-soak-header", kind: "header-button", label: `SOAK ${sec}s`, text: "WAIT — PINK LIGHT AFTER 0",
        action: { type: "open", view: "ghc", presentation: "overlay", fit: true, closeOnShot: true }
      });
      surfaces.push({
        id: "hyperex-soak-strip", kind: "shot-strip", show: "always", cells: [
          { label: "SOAK", text: `${sec} s`, color: sec <= 5 ? "amber" : "accent", col: 1, span: 2 },
          { label: "STATUS", text: "ACTIVE RELEASE COMPLETE", color: "accent", col: 3, span: 4 },
          { label: "NEXT", text: "WAIT FOR PINK", color: "flow", col: 7, span: 3 }
        ]
      });

    } else if (state.phase === "restart_wait") {
      const sec = Math.max(0, state.ghcSecondsRemaining);
      const sinceArm = state.lastArmRequestAtMs ? (Date.now() - state.lastArmRequestAtMs) / 1000 : 999;
      const waitingPink = sinceArm < 2.5;
      surfaces.push({
        id: "hyperex-ghc-header", kind: "header-button",
        label: waitingPink ? `ARMING ${sec}s` : "RE-ARM",
        text: waitingPink ? "WAIT FOR PINK LIGHT" : `PINK OFF? TAP HERE · ${sec}s`,
        action: { type: "open", view: waitingPink ? "ghc" : "rearm", presentation: "overlay", fit: true, closeOnShot: true }
      });
      surfaces.push({
        id: "hyperex-ghc-strip", kind: "shot-strip", show: "always", cells: waitingPink ? [
          { label: "HYPEREX", text: "WAIT FOR PINK", color: "amber", col: 1, span: 5 },
          { label: "TIME", text: `${sec} s`, color: sec <= 5 ? "red" : sec <= 10 ? "amber" : "accent", col: 6, span: 2 },
          { label: "NEXT", text: "PRESS GHC", color: "flow", col: 8, span: 2 }
        ] : [
          { label: "PINK ON", text: "PRESS GHC", color: "flow", col: 1, span: 3 },
          { label: "PINK OFF", text: "TAP RE-ARM", color: "accent", col: 4, span: 4 },
          { label: "TIME", text: `${sec} s`, color: sec <= 5 ? "red" : sec <= 10 ? "amber" : "accent", col: 8, span: 2 }
        ]
      });
    } else if (state.calibrationActive) {
      surfaces.push({
        id: "hyperex-cal-header", kind: "header-button", label: "FLOW CAL", text: "EMPTY BASKET · RUNNING",
        action: { type: "open", view: "diag-dashboard", presentation: "page" }
      });
    } else if (state.phase === "idle" && state.cfg && state.cfg.diagnosticEnabled && state.cfg.idleDashboardShortcut) {
      const ds = diagnosticSummary(state.diagnosticLast);
      const r2 = ds && ds.kind === "hyperex" && ds.stage2 && ds.stage2.rawRegressionGS !== null ? `S2 ${ds.stage2.rawRegressionGS}g/s` : (state.calibrationMapUsable ? "CAL READY" : "FLOW CAL / DIAG");
      surfaces.push({
        id: "hyperex-diag-header", kind: "header-button",
        label: state.learningStage && state.learningStage.stage === "READY FOR COFFEE · AUTO" ? "READY · ADD COFFEE" : "DIAG / CAL",
        text: state.learningStage && state.learningStage.stage === "READY FOR COFFEE · AUTO" ? "EMPTY BASELINE COMPLETE" : r2,
        action: { type: "open", view: "diag-dashboard", presentation: "page" }
      });
    }
    return { version: 1, surfaces, live };
  }

  function buildGhcOverlayHtml() {
    const endpointBase = `/api/v1/plugins/${ID}`;
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
html,body{margin:0;width:100%;min-height:100%;background:transparent;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#f7f7f8;overflow-x:hidden}.card{width:860px;max-width:96vw;box-sizing:border-box;padding:22px;border-radius:20px;background:#17191d;box-shadow:0 18px 60px rgba(0,0,0,.45)}html.diagview,body.diagview{background:#17191d;min-width:100%;min-height:100vh}body.diagview .card{width:100vw;max-width:none;min-height:100vh;border-radius:0;box-shadow:none;padding:24px 30px}body.diagview .chart{height:250px}body.diagview textarea{height:190px}.k{font-size:13px;letter-spacing:.12em;opacity:.65}.t{font-size:27px;font-weight:800;margin:7px 0}.d{font-size:15px;line-height:1.45}.row{display:flex;gap:9px;margin-top:14px;flex-wrap:wrap}.b{border:0;border-radius:12px;padding:12px 14px;font-size:14px;font-weight:800;cursor:pointer}.p{background:#ff4fa3;color:#fff}.s{background:#343840;color:#fff}.warn{background:#8a4b18;color:#fff}.danger{background:#8a2530;color:#fff}.primaryAction{background:#f27a22;color:#fff;padding:14px 20px;font-size:15px;box-shadow:0 5px 18px rgba(0,0,0,.28)}.secondaryAction{background:#2b2f36;color:#e7e9ec;border:1px solid #555b65;padding:10px 13px;font-size:13px}.tertiaryAction{background:transparent;color:#c9cdd3;border:1px solid #3d424a;padding:10px 13px;font-size:13px}.actionBadge{display:inline-block;margin-left:8px;padding:3px 7px;border-radius:999px;background:#4a321d;color:#ffd4ac;font-size:9px;font-weight:800;letter-spacing:.08em;vertical-align:middle}.manualPanel{margin-top:10px;padding:12px;border-radius:10px;background:#1c1f24;border:1px solid #30343b}.active{outline:2px solid #fff}.m{margin-top:12px;font:12px ui-monospace,monospace;opacity:.78}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0}.stat{background:#23262c;border-radius:11px;padding:10px}.stat b{display:block;font-size:17px;margin-top:4px}.small{font-size:11px;opacity:.68}.section{margin-top:14px;padding-top:13px;border-top:1px solid #343840}.section h3{margin:0 0 8px;font-size:16px}.good{color:#77d98b}.bad{color:#ff8c92}.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}textarea{width:100%;height:150px;box-sizing:border-box;background:#0f1114;color:#dfe6ef;border:1px solid #343840;border-radius:10px;padding:9px;font:10px ui-monospace,monospace;resize:vertical}table{width:100%;border-collapse:collapse;font-size:11px}th,td{text-align:right;padding:5px 6px;border-bottom:1px solid #292d33}th:first-child,td:first-child{text-align:left}.chart{width:100%;height:205px;background:#101216;border:1px solid #2f333a;border-radius:10px;margin-top:8px}.legend{font-size:11px;opacity:.8;line-height:1.5}.stepHead{margin-top:18px;padding:14px 16px;border-radius:14px;background:#20242a;border:1px solid #3a4049}.stepHead b{font-size:19px}.stepBadge{float:right;padding:4px 9px;border-radius:999px;background:#343840;font-size:10px;letter-spacing:.06em}.stepBadge.good{background:#173b25}.stepBadge.bad{background:#4a2024}.stepHint{margin-top:5px;font-size:12px;opacity:.72;line-height:1.45}
</style></head><body><div class="card"><div class="k">HYPEREX v0.1.59</div><div id="title" class="t">Checking…</div><div id="detail" class="d"></div>
<div id="diag" style="display:none">
  <div class="d" style="margin:2px 0 12px;padding:10px 12px;border-radius:10px;background:#23262c"><b>ENTRY</b> · Dashboard <b>DIAG / CAL</b> is enabled by default. If another plugin occupies the reserved header slot, open <b>Plugins → HyperEx Pulse Filter</b>.</div>

  <div class="stepHead"><span id="step1badge" class="stepBadge">CHECKING</span><b>STEP 1 · FLOW CALIBRATION</b><div class="stepHint">First-time setup. Use an <b>EMPTY BASKET</b> and a large catch vessel. A valid RAW-scale calibration creates the real-flow LUT used by HyperEx. Invalid calibration never overwrites the previous valid LUT.</div></div>
  <div class="section"><h3>CALIBRATION LUT</h3><div id="calstatus" class="d"></div><div id="calmode" class="row"></div><div id="waterwarn" class="d" style="margin-top:10px;padding:10px;border-radius:10px;background:#3b2d16;color:#ffd58a"><b>WATER / VESSEL / TANK PREFLIGHT</b><br>Waiting for live DE1 tank level…</div><div id="scope" class="row"></div><div class="row"><button id="prepare" class="b p">PREPARE FLOW CAL</button><button id="sync" class="b s">SYNC HYPEREX</button><button id="suggested" class="b s">USE SUGGESTED FOR NEXT CAL</button></div><div class="row"><button id="global" class="b danger">APPLY SUGGESTED GLOBALLY</button><button id="restore" class="b warn">RESTORE PREVIOUS GLOBAL</button><button id="clearcal" class="b s">CLEAR CAL MAP</button></div><div id="map" class="m"></div></div>

  <div class="stepHead"><span id="step2badge" class="stepBadge">WAITING</span><b>STEP 2 · SHOT-TO-SHOT AUTO ADAPTIVE</b><div class="stepHint">Normal daily workflow after calibration. Every completed HyperEx shot is measured with RAW scale weight + timestamp regression. S1, S2 and S3 are evaluated separately; verified changes apply only to the <b>next shot</b>. Normal mode has no running-shot scale closed loop. The optional live-flow test is labelled separately below. No extra skipStep calls.</div></div>
  <div id="historystatus" class="d" style="margin-top:10px;padding:10px 12px;border-radius:10px;background:#23262c"><b>ADAPTIVE HISTORY</b> · checking persistent storage…</div>
  <div class="section"><h3>NEXT SHOT · APPLIED PROFILE</h3><div class="small">Actual workflow commands below come from GET /workflow. Real g/s targets and LUT commands remain reference values. VERIFIED also requires successful machine upload acknowledgement.</div><div id="appliedcommands" class="m"></div><div id="auditstatus" class="small"></div><button id="readworkflow" class="b s">READ RAW WORKFLOW</button><details><summary>Raw workflow / adaptive audit JSON</summary><textarea id="auditjson" readonly></textarea></details></div>
  <div class="section"><h3>LATEST SHOT · COMMAND SNAPSHOT</h3><div class="small">Historical command snapshot captured at shot start. It may differ from NEXT SHOT after adaptation.</div><div id="runcommands" class="m"></div></div>
  <div class="section"><h3>LATEST SHOT · VALIDATION</h3><div class="small">RAW real flow is a multi-second linear regression of unmodified scale weight vs scale timestamp. Instantaneous RAW dW/dt is not the acceptance reference.</div><div id="livetrimstatus" class="m"></div><div id="validation" class="grid"></div><div id="validationtable" class="m"></div></div>
  <div class="section"><h3>S1 STARTUP / S3 STABILITY</h3><div class="small">S1 separates first-rise delay from active cup flow. S3 tracks EARLY / MID / LATE stability and stall/decay behavior.</div><div id="stability" class="m"></div></div>
  <div class="section"><h3>NEXT SHOT ADAPTIVE <span class="actionBadge">AUTOMATIC PATH</span></h3><div id="basketcontext" class="m"></div><div id="autoapplybox" class="m"></div><div class="small">S1 startup, S2 level and S3 LEVEL + SHAPE use repeated completed-shot evidence and bounded corrections. Calibration LUT is never rewritten by adaptive history.</div><div id="adaptive" class="m"></div></div>
  <div class="section"><h3>LIVE / END-OF-RUN TELEMETRY</h3><div id="stats" class="grid"></div></div>
  <div class="section"><h3>REAL SCALE CURVES</h3><div class="legend">Machine target / machine flow: ml/s. Cup target / Decaid weightFlow / RAW-scale slope: g/s. Weight chart is the unmodified scale weight stream.<br>LIVE TEST: green circles = check RAW g/s; gray circles on baseline = check without usable regression; orange diamonds = raw writes ml/s; pale squares = machine target response ml/s. Tap/hover markers for details.</div><svg id="flowchart" class="chart" viewBox="0 0 800 205" preserveAspectRatio="none"></svg><div id="flowpointdetail" class="small"></div><svg id="weightchart" class="chart" viewBox="0 0 800 205" preserveAspectRatio="none"></svg></div>

  <div class="stepHead"><span class="stepBadge">OPTIONAL</span><b>STEP 3 · MANUAL / ENGINEERING</b><div class="stepHint">Only for diagnosis, experiments or manual override. Normal users should leave AUTO APPLY on and let STEP 2 manage future shots.</div></div>
  <div class="section"><h3>REFERENCE ADVISORY · NO RUNNING-SHOT CONTROL</h3><div class="small">Manual reference ranges derived from the latest shot. These are not LUT rewrites.</div><div id="advisory" class="m"></div></div>
  <div class="section"><h3>ADVANCED / TEST OVERRIDE EDITOR</h3><div class="manualPanel"><div class="small"><b>EDITOR ONLY.</b> AUTO / LUT uses the saved calibration LUT. MANUAL TEST changes only future HyperEx profile commands. S3 shape advances by profile time only.</div><div id="testcommands" class="m"></div><div id="s3shape" class="m" style="margin-top:10px"></div><div class="row"><button id="applytest" class="b secondaryAction">APPLY TEST COMMANDS</button><button id="returnlut" class="b tertiaryAction">RETURN ALL TO LUT</button></div></div></div>
  <div class="section"><details id="advancedsettings" class="manualPanel"><summary style="cursor:pointer;font-weight:800;font-size:16px">ADVANCED SETTINGS · QUICK EDIT</summary><div class="small" style="margin-top:8px">Same source of truth as <b>Plugins → HyperEx Pulse Filter</b>. Saving here writes normal plugin Settings; there is no second settings store.</div><div id="advancedmeta" class="m"></div><div class="m"><b>REAL-FLOW TARGETS</b></div><table><tr><th>Parameter</th><th>Value</th><th>Parameter</th><th>Value</th></tr><tr><td>S1 target (g/s)</td><td><input id="adv_stage1Flow" type="number" step="0.1" min="0.3" max="6.5"></td><td>S2 target (g/s)</td><td><input id="adv_stage2Flow" type="number" step="0.1" min="0.3" max="6.5"></td></tr><tr><td>S3 target (g/s)</td><td><input id="adv_stage3Flow" type="number" step="0.1" min="0.3" max="6.5"></td><td></td><td></td></tr></table><div class="m"><b>TEMPERATURE / PRESSURE SAFETY</b></div><table><tr><td>Temperature (°C)</td><td><output id="adv_temperature">—</output><div class="small">当前曲线温度 · 在首页调整</div></td><td>Emergency pressure (bar)</td><td><input id="adv_hardPressureLimit" type="number" step="0.1" min="1" max="12"></td></tr><tr><td>S1 pressure limiter (bar)</td><td><input id="adv_stage1PressureLimit" type="number" step="0.1" min="0.5" max="12"></td><td>S2 pressure limiter (bar)</td><td><input id="adv_stage2PressureLimit" type="number" step="0.1" min="0.5" max="12"></td></tr><tr><td>S3 pressure limiter (bar)</td><td><input id="adv_stage3PressureLimit" type="number" step="0.1" min="0.5" max="12"></td><td></td><td></td></tr></table><div class="m"><b>EXPERIMENTAL S2/S3 LIVE FLOW TRIM · DEFAULT OFF</b><br><label><input id="adv_liveFlowTrimTest" type="checkbox"> Enable live flow trim</label><br><label>Level <input id="adv_liveFlowTrimLevel" type="range" min="1" max="4" step="1" value="1" aria-label="杯内调流档位" style="width:260px;max-width:90%;vertical-align:middle;accent-color:#63d89b"><output id="adv_liveFlowTrimLevelLabel" for="adv_liveFlowTrimLevel">一档 · 原周期 / 最多50次写入</output></label><br>All levels: max 2000 checks per shot across S2+S3. Write budget is separate and shown by level; retries count as writes. Actual writes retain at least 2 s response wait. Up to 3 consecutive ACK-without-target misses are tolerated; the 4th stops trim. Unconfirmed targets retry without accumulating commands. Level 1 defaults to 944 ms. Level 4 is an experimental software cap, not a proven hardware maximum. Target band ±6%; bounded raw A010 changes, no extra skips. Normal shot-to-shot learning remains ON; corrected frames use only verified stable-command windows. Original profile restored afterwards.</div><div class="m"><b>DIRECT DRIVER START TEST · DEFAULT OFF</b><br><label><input id="adv_directDriverStartTest" type="checkbox"> After soak: Espresso request, then raw A002=04 write</label><br>One optional raw write. Original GHC confirmation countdown, re-arm retries and safety guards remain active. Physical GHC confirmation was still required in the 1.54 device test.</div><div class="m"><b>RELEASE / SCALE / RETRY / DIAGNOSTICS</b></div><table><tr><td>Release flow threshold (ml/s)</td><td><input id="adv_dumpFlowThreshold" type="number" step="0.05" min="0" max="2"></td><td>Low-flow stable samples</td><td><input id="adv_dumpFlowStableSamples" type="number" step="1" min="1" max="20"></td></tr><tr><td>Release fallback (s)</td><td><input id="adv_dumpFallbackSeconds" type="number" step="0.1" min="0.2" max="15"></td><td>Release timeout (s)</td><td><input id="adv_dumpTimeoutSeconds" type="number" step="0.1" min="1" max="30"></td></tr><tr><td>Scale tare threshold (g)</td><td><input id="adv_scaleResetThreshold" type="number" step="0.1" min="0.5" max="20"></td><td>No-scale timeout (s)</td><td><input id="adv_noScaleTimeoutSeconds" type="number" step="0.5" min="1" max="30"></td></tr><tr><td>Auto-arm retry 1 (s)</td><td><input id="adv_autoArmRetry1Seconds" type="number" step="0.5" min="0" max="30"></td><td>Auto-arm retry 2 (s)</td><td><input id="adv_autoArmRetry2Seconds" type="number" step="0.5" min="0" max="60"></td></tr><tr><td>Diagnostic sample (ms)</td><td><input id="adv_diagnosticSampleIntervalMs" type="number" step="10" min="50" max="1000"></td><td>Maximum sequence (s)</td><td><input id="adv_maxRunSeconds" type="number" step="10" min="30" max="600"></td></tr></table><div class="row"><button id="saveadvanced" class="b secondaryAction">SAVE TO PLUGIN SETTINGS</button></div><div id="startupbox" class="d" style="margin-top:10px"></div></details></div>

  <div class="stepHead"><span class="stepBadge">EXPORT</span><b>STEP 4 · COPY CSV</b><div class="stepHint">Raw engineering export for offline analysis or bug reports. This is intentionally last because it is not needed for normal brewing.</div></div>
  <div class="section"><h3>LAST RUN CSV</h3><div class="small">Combined DE1/Decaid samples plus RAW scale weight/timestamp/dW-dt and profile-frame markers.</div><textarea id="csv" readonly></textarea></div>
</div>
<div class="row"><button id="rearm" class="b p">RE-ARM</button><button id="copy" class="b p" style="display:none">COPY CSV</button><button id="close" class="b s">CLOSE</button></div><div id="meta" class="m"></div></div>
<script>
(function(){
  function emergencyHomeFallback(){
    try{if(window.top&&window.top!==window&&window.top.history&&window.top.history.length>1){window.top.history.back();return}}catch(_){}
    if(window.history&&window.history.length>2){window.history.go(-2);return}
    if(window.history&&window.history.length>1){window.history.back();return}
  }
  function emergencyClose(){
    try{if(window.parent&&window.parent!==window)window.parent.postMessage({type:'streamline:close'},'*')}catch(_){}
    setTimeout(emergencyHomeFallback,280);
  }
  const c=document.getElementById('close');
  if(c){c.textContent='CLOSE / HOME';c.onclick=emergencyClose}
  window.addEventListener('error',function(e){
    const t=document.getElementById('title'),d=document.getElementById('detail');
    if(t)t.textContent='DIAGNOSTICS UI ERROR';
    if(d)d.textContent='The diagnostics script failed to initialize. CLOSE / HOME remains available. '+String((e&&e.message)||'Unknown UI error');
  });
})();
</script>
<script>
const base=${JSON.stringify(endpointBase)};const coreSettings='/api/v1/plugins/'+${JSON.stringify(ID)}+'/settings';const requestedView=new URLSearchParams(location.search).get('view');const view=requestedView||${JSON.stringify(state.phase === 'idle' ? 'diag' : 'ghc')};const dashboardEntry=view==='diag-dashboard';const diagView=view==='diag'||dashboardEntry;if(diagView){document.documentElement.classList.add('diagview');document.body.classList.add('diagview')}window.parent.postMessage({type:'streamline:ready'},'*');const sw=Math.max(1000,Math.min(1800,Number((window.screen&&window.screen.width)||window.innerWidth||1200)));const sh=Math.max(780,Math.min(1400,Number((window.screen&&window.screen.height)||window.innerHeight||900)));window.parent.postMessage({type:'streamline:size',width:diagView?sw:520,height:diagView?sh:300},'*');
let latestAdvisorySummary=null;let latestStage3Stability=null;let latestNextShotAdaptive=null;let latestAdaptiveSummary=null;let latestAutoApplyEnabled=true;let latestAutoApplyStatus=null;const $=id=>document.getElementById(id),t=$('title'),d=$('detail'),m=$('meta'),b=$('rearm'),copy=$('copy'),diag=$('diag'),stats=$('stats'),appliedcommands=$('appliedcommands'),runcommands=$('runcommands'),validation=$('validation'),validationtable=$('validationtable'),stability=$('stability'),adaptive=$('adaptive'),advisory=$('advisory'),testcommands=$('testcommands'),s3shape=$('s3shape'),csv=$('csv'),calstatus=$('calstatus'),waterwarn=$('waterwarn'),scope=$('scope'),calmode=$('calmode'),map=$('map'),startupbox=$('startupbox');
function paint(x){if(x.phase==='soak'){t.textContent='SOAK '+x.soakSecondsRemaining+'s';d.textContent='Active release is complete. Wait until the soak reaches 0. The plugin will arm the second stage only after the full soak.';b.disabled=true;}else if(x.phase==='restart_wait'){t.textContent='CHECK PINK LIGHT · '+x.ghcSecondsRemaining+'s';d.textContent='Pink ON → press the physical GHC Espresso button. Pink OFF → tap RE-ARM, then press GHC when the light turns pink.';b.disabled=false;}else if(x.calibrationActive){t.textContent='FLOW CAL RUNNING';d.textContent='EMPTY BASKET. Leave the staircase running until Idle. Do not remove the catch vessel; the plugin will stop at the selected-mode actual-water safety cap before 300 ml.';b.disabled=true;}else{t.textContent='HYPEREX IDLE';d.textContent='No GHC action is required.';b.disabled=true;}m.textContent='Cumulative '+Number(x.cumulativeWeight||0).toFixed(1)+'g · arm requests '+(x.armRequestCount||0)+(x.directStartTest?' · DIRECT TEST: '+x.directStartTest.status:'');}
async function post(ep,body){const r=await fetch(base+'/'+ep,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body||{})});let j={};try{j=await r.json()}catch(_){j={error:await r.text()}}if(!r.ok)throw new Error(j.error||('HTTP '+r.status));return j;}
async function doRearm(auto){b.disabled=true;b.textContent='RE-ARMING…';try{const x=await post('rearm',{retry:1});paint(x);t.textContent='RE-ARM REQUEST SENT';d.textContent='Wait for the pink GHC Espresso light, then press the physical GHC Espresso button.';if(auto)setTimeout(closeUi,1300)}catch(e){t.textContent='RE-ARM FAILED';d.textContent=String(e)}finally{b.textContent='RE-ARM';setTimeout(()=>b.disabled=false,800)}}
function stat(label,v){return '<div class="stat"><span class="small">'+label+'</span><b>'+v+'</b></div>'}
function esc(v){return String(v==null?'—':v).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}
function commandModeLabel(v){v=String(v||'auto').toLowerCase();return v==='shape'?'SHAPE':v==='manual'?'MANUAL TEST':'AUTO / LUT'}
function shapeCommandText(sh){if(!sh||sh.enabled!==true)return null;return esc(sh.earlyCommand)+' × '+esc(sh.earlySeconds)+'s → '+esc(sh.midCommand)+' × '+esc(sh.midSeconds)+'s → '+esc(sh.lateCommand)+' ml/s'}
function appliedS3Text(c){const sh=c&&c.s3Shape;const shaped=shapeCommandText(sh);if(shaped)return shaped;const flat=c&&c.stage3FlatCommandMlS!=null?c.stage3FlatCommandMlS:(c&&c.stage3CommandMlS);return esc(flat)+' ml/s FLAT'}
function renderAppliedCommands(c,truth){if(!appliedcommands)return;if(!c||!c.appliedProfile){appliedcommands.innerHTML='<span class="bad">Current profile command state unavailable.</span>';return}const p=c.appliedProfile,src=c.adaptiveSource||null;const expectedS3=p.stage3||{};const t=truth||{};const a=t.actual||null;let ap1=p.stage1&&p.stage1.commandMlS,ap2=p.stage2&&p.stage2.commandMlS,mode=expectedS3.mode,ap3=expectedS3.mode==='shape'?shapeCommandText(expectedS3.shape):(esc(expectedS3.flatCommandMlS)+' ml/s');if(!a){ap1='unavailable';ap2='unavailable';ap3='unavailable';mode='unverified'}if(a){ap1=a.stage1CommandMlS;ap2=a.stage2CommandMlS;mode=a.stage3Mode==='shape'?'shape':'actual';ap3=a.stage3Mode==='shape'?shapeCommandText(a.s3Shape):(esc(a.stage3CommandMlS)+' ml/s')}let source='<b>Source:</b> '+esc(c.manualTestStatus||'AUTO / LUT');if(src&&src.runId)source='<b>Source:</b> NEXT SHOT ADAPTIVE '+esc(String(src.mode||'').toUpperCase())+' · run '+esc(src.runId)+(src.appliedAt?' · '+esc(src.appliedAt):'');const truthLine=t.verified?'<span class="good"><b>WORKFLOW READBACK VERIFIED</b></span> · '+esc(t.status||''):'<span class="bad"><b>WORKFLOW NOT VERIFIED</b></span> · '+esc(t.status||'')+' · expected commands are shown only as a reference until repair succeeds.';appliedcommands.innerHTML='<table><tr><th>Stage</th><th>Target REAL g/s</th><th>LUT cmd</th><th>Mode</th><th>ACTUAL WORKFLOW COMMAND</th></tr><tr><td>S1</td><td>'+esc(p.stage1&&p.stage1.desiredGS)+' g/s</td><td>'+esc(p.stage1&&p.stage1.lutCommandMlS)+'</td><td>'+commandModeLabel(p.stage1&&p.stage1.mode)+'</td><td><b>'+esc(ap1)+' ml/s</b></td></tr><tr><td>S2</td><td>'+esc(p.stage2&&p.stage2.desiredGS)+' g/s</td><td>'+esc(p.stage2&&p.stage2.lutCommandMlS)+'</td><td>'+commandModeLabel(p.stage2&&p.stage2.mode)+'</td><td><b>'+esc(ap2)+' ml/s</b></td></tr><tr><td>S3</td><td>'+esc(expectedS3.desiredGS)+' g/s</td><td>'+esc(expectedS3.lutCommandMlS)+'</td><td>'+commandModeLabel(mode)+'</td><td><b>'+ap3+'</b></td></tr></table><div class="small" style="margin-top:7px">'+truthLine+'<br>'+source+'</div>'}
function renderRunCommands(s){if(!runcommands)return;const p=s&&s.shotCommands;if(!p){runcommands.innerHTML='<span class="small">No completed HyperEx shot command snapshot is available.</span>';return}const s3=p.stage3||{};const s3txt=s3.mode==='shape'?shapeCommandText(s3.shape):(esc(s3.flatCommandMlS)+' ml/s');runcommands.innerHTML=(s.liveFlowTrim?'<div class="small"><b>LIVE TRIM ENABLED:</b> this table is the shot-start snapshot. In-shot commands and machine target responses are plotted and exported below.</div>':'')+'<table><tr><th>Stage</th><th>Target</th><th>LUT cmd</th><th>Mode AT SHOT START</th><th>COMMANDS USED BY THIS SHOT</th></tr><tr><td>S1</td><td>'+esc(p.stage1&&p.stage1.desiredGS)+' g/s</td><td>'+esc(p.stage1&&p.stage1.lutCommandMlS)+'</td><td>'+commandModeLabel(p.stage1&&p.stage1.mode)+'</td><td><b>'+esc(p.stage1&&p.stage1.commandMlS)+' ml/s</b></td></tr><tr><td>S2</td><td>'+esc(p.stage2&&p.stage2.desiredGS)+' g/s</td><td>'+esc(p.stage2&&p.stage2.lutCommandMlS)+'</td><td>'+commandModeLabel(p.stage2&&p.stage2.mode)+'</td><td><b>'+esc(p.stage2&&p.stage2.commandMlS)+' ml/s</b></td></tr><tr><td>S3</td><td>'+esc(s3.desiredGS)+' g/s</td><td>'+esc(s3.lutCommandMlS)+'</td><td>'+commandModeLabel(s3.mode)+'</td><td><b>'+s3txt+'</b></td></tr></table><div class="small" style="margin-top:7px">Historical snapshot only. It does not change when NEXT SHOT ADAPTIVE writes a new profile after this shot.</div>'}
const ADV_SETTING_KEYS={liveFlowTrimLevel:'LiveFlowTrimLevel',liveFlowTrimTest:'LiveFlowTrimTest',directDriverStartTest:'DirectDriverStartTest',stage1Flow:'Stage1Flow',stage1PressureLimit:'Stage1PressureLimit',dumpFlowThreshold:'DumpFlowThreshold',dumpFlowStableSamples:'DumpFlowStableSamples',dumpFallbackSeconds:'DumpFallbackSeconds',dumpTimeoutSeconds:'DumpTimeoutSeconds',stage2Flow:'Stage2Flow',stage2PressureLimit:'Stage2PressureLimit',stage3Flow:'Stage3Flow',stage3PressureLimit:'Stage3PressureLimit',hardPressureLimit:'HardPressureLimit',scaleResetThreshold:'ScaleResetThreshold',noScaleTimeoutSeconds:'NoScaleTimeoutSeconds',autoArmRetry1Seconds:'AutoArmRetry1Seconds',autoArmRetry2Seconds:'AutoArmRetry2Seconds',diagnosticSampleIntervalMs:'DiagnosticSampleIntervalMs',maxRunSeconds:'MaxRunSeconds'};
const ADV_FIELDS=Object.keys(ADV_SETTING_KEYS);
function updateTrimLevelLabel(){const q=$('adv_liveFlowTrimLevel'),o=$('adv_liveFlowTrimLevelLabel');if(!q||!o)return;const labels=['一档 · 原周期 / 最多50次写入','二档 · 300 ms / 最多150次写入','三档 · 250 ms / 最多200次写入','四档 · 200 ms / 最多250次写入'];const level=Number(q.value);o.textContent=labels[level-1]||labels[0];q.setAttribute('aria-valuetext',o.textContent)}
const trimLevelSlider=$('adv_liveFlowTrimLevel');if(trimLevelSlider)trimLevelSlider.addEventListener('input',updateTrimLevelLabel);

async function loadAdvancedSettings(){try{const r=await fetch(base+'/advanced-settings');if(!r.ok)return;const j=await r.json(),a=j.settings||{};for(const k of ADV_FIELDS){const q=$('adv_'+k);if(q&&a[k]!=null){if(q.type==='checkbox')q.checked=!!a[k];else q.value=a[k]}}const currentTemp=$('adv_temperature');if(currentTemp&&a.temperature!=null)currentTemp.value=Number(a.temperature).toFixed(1)+' °C';const meta=$('advancedmeta');updateTrimLevelLabel();if(meta){const bt=j.basicCurve||{};meta.innerHTML='Single settings source · core curve: S1 <b>'+esc(bt.stage1WeightG)+'g</b> → settle <b>'+esc(bt.releaseSettleSeconds)+'s</b> → soak <b>'+esc(bt.soakSeconds)+'s</b> → S2→S3 <b>'+esc(bt.stage2WeightG)+'g</b> → final <b>'+esc(bt.finalWeightG)+'g</b> · GHC timeout <b>'+esc(bt.ghcConfirmTimeoutSeconds)+'s</b>.'+(j.directStartTest?'<br><b>DIRECT DRIVER TEST: '+esc(j.directStartTest.status)+'</b>':'')}}catch(e){const meta=$('advancedmeta');if(meta)meta.textContent='Settings load error: '+e}}
async function saveAdvancedSettings(){const payload={};for(const k of ADV_FIELDS){const q=$('adv_'+k);if(!q)continue;if(q.type==='checkbox'){payload[ADV_SETTING_KEYS[k]]=q.checked;continue}const v=Number(q.value);if(!Number.isFinite(v)){alert('Invalid setting: '+k);return}payload[ADV_SETTING_KEYS[k]]=k==='liveFlowTrimLevel'?String(v):v}if(!confirm('Save these values to the normal HyperEx plugin Settings?\\n\\nThis uses the same settings source shown on the Plugins page and reloads HyperEx once.'))return;const r=await fetch(coreSettings,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});if(!r.ok){alert('Save failed: '+await r.text());return}alert('Settings saved. HyperEx is reloading; reopen DIAG / CAL if this page closes.');setTimeout(()=>location.reload(),1200)}
async function loadCal(){try{const r=await fetch(base+'/calibration-status');const c=await r.json();renderAppliedCommands(c.commandFlows||{},c.profileTruth||{});renderBasketContext(c);latestAutoApplyEnabled=c.autoApplyNextShot!==false;latestAutoApplyStatus=c.autoApplyLastStatus||null;renderAutoApplyBox();renderAdaptive(latestAdaptiveSummary);const ok=c.calibrationUsable;const b1=$("step1badge"),b2=$("step2badge");if(b1){b1.textContent=ok?"CAL READY":"REQUIRED FIRST";b1.className="stepBadge "+(ok?"good":"bad")}if(b2){b2.textContent=ok?"ACTIVE · AUTO NEXT SHOT":"WAITING FOR VALID LUT";b2.className="stepBadge "+(ok?"good":"bad")}const hs=c.persistentHistory||{},hb=$("historystatus");if(hb){if(hs.available===true){hb.style.background="#173b25";hb.style.color="#9ff0b5";hb.innerHTML='<b>ADAPTIVE HISTORY · PERSISTENT</b> · '+esc(hs.savedShots)+' saved shot(s), '+esc(hs.compatibleShots)+' compatible with the current calibration/LUT and basket context. '+esc(hs.baselineReferenceShots||0)+' empty/pre-upgrade baseline references retained; coffee consensus accumulates from normal coffees.'}else if(hs.available===false){hb.style.background="#4a2024";hb.style.color="#ffb4b8";hb.innerHTML='<b>ADAPTIVE HISTORY · SESSION ONLY</b> · '+esc(hs.status)+'<br>Shot-to-shot adaptation still works in this session, but cross-reload/version regression is disabled.'}else{hb.style.background="#3b2d16";hb.style.color="#ffd58a";hb.innerHTML='<b>ADAPTIVE HISTORY</b> · checking pluginStorage write/readback…'}}if($("t1")){ $("t1").value=c.commandFlows&&c.commandFlows.stage1DesiredGS!=null?c.commandFlows.stage1DesiredGS:""; $("t2").value=c.commandFlows&&c.commandFlows.stage2DesiredGS!=null?c.commandFlows.stage2DesiredGS:""; $("t3").value=c.commandFlows&&c.commandFlows.stage3DesiredGS!=null?c.commandFlows.stage3DesiredGS:"";}if(calmode){calmode.innerHTML=(c.calibrationModes||[{id:'low',label:'Low Water'},{id:'full',label:'Full'}]).map(x=>'<button class="b s '+(c.calibrationMode===x.id?'active':'')+'" data-mode="'+esc(x.id)+'">'+esc(x.label)+(x.id==='low'?' · DEFAULT':'')+'</button>').join('');calmode.querySelectorAll('button').forEach(q=>q.onclick=async()=>{await post('calibration-mode',{mode:q.dataset.mode});await loadCal()})}if(waterwarn){const w=c.waterPreflight||{};const wc=w.status==='ok'?'#163b26':w.status==='warn'?'#3b2d16':'#4a2024';const fg=w.status==='ok'?'#9ff0b5':w.status==='warn'?'#ffd58a':'#ffb4b8';waterwarn.style.background=wc;waterwarn.style.color=fg;let tank='Tank level unavailable';if(w.available)tank='Tank: <b>'+esc(w.currentLevelMm)+' mm</b> · refill threshold: <b>'+esc(w.refillLevelMm)+' mm</b> · margin: <b>'+esc(w.marginMm)+' mm</b>';waterwarn.innerHTML='<b>WATER / VESSEL / TANK PREFLIGHT · '+esc(c.calibrationModeLabel)+' · '+esc((w.status||'unknown').toUpperCase())+'</b><br>'+tank+'<br>Prime: '+esc(c.primeFlow)+' ml/s × '+esc(c.primeSeconds)+' s · '+esc(c.calibrationSteps)+' calibration plateaus × '+esc(c.calibrationStepSeconds)+' s · nominal DE1 command water <b>≈'+esc(c.nominalCommandWaterMl)+' ml</b>.<br>Use a <b>'+esc(c.recommendedContainerMl)+' ml or larger</b> catch vessel. Plugin actively stops around <b>'+esc(c.calibrationHardStopG)+' g</b> actual collected water. '+esc(w.message||'');}calstatus.innerHTML='<b class="'+(ok?'good':'bad')+'">'+(ok?'CALIBRATION READY':'CALIBRATION NOT READY')+'</b><br>Mode: <b>'+esc(c.calibrationModeLabel)+'</b> · Profile: <b>'+esc(c.calibrationProfileTitle)+'</b><br>Scope: <b>'+esc(c.scopeLabel)+'</b> · DE1 multiplier: <b>'+esc(c.currentFlowMultiplier)+'</b> · map base: <b>'+esc(c.calibrationBaseMultiplier)+'</b> · suggested: <b>'+esc(c.suggestedFlowMultiplier)+'</b><br>'+esc(c.calibrationStaleReason||'LUT valid')+(c.lastCalibrationValid===false?'<br><b class="bad">LAST CAL RUN INVALID — previous valid LUT retained</b>':c.lastCalibrationValid===true?'<br><b class="good">LAST CAL RUN VALID</b>':'')+'<br>Real→command: S1 '+esc(c.commandFlows&&c.commandFlows.stage1DesiredGS)+'→'+esc(c.commandFlows&&c.commandFlows.stage1CommandMlS)+' · S2 '+esc(c.commandFlows&&c.commandFlows.stage2DesiredGS)+'→'+esc(c.commandFlows&&c.commandFlows.stage2CommandMlS)+' · S3 '+esc(c.commandFlows&&c.commandFlows.stage3DesiredGS)+'→'+appliedS3Text(c.commandFlows||{})+'<br>Test mode: <b>'+esc((c.commandFlows&&c.commandFlows.manualTestStatus)||'none')+'</b>';renderTestCommands(c.commandFlows||{},latestAdvisorySummary||{});scope.innerHTML=['off','hyperex','global'].map(x=>'<button class="b s '+(c.scope===x?'active':'')+'" data-scope="'+x+'">'+(x==='off'?'OFF':x==='hyperex'?'HYPEREX ONLY':'GLOBAL')+'</button>').join('');scope.querySelectorAll('button').forEach(q=>q.onclick=async()=>{await post('calibration-scope',{scope:q.dataset.scope});await loadCal()});const last=c.lastCalibration||null;const rows=last&&Array.isArray(last.plateauResults)?last.plateauResults:[];const anchors=last&&last.map&&Array.isArray(last.map.targetAnchors)?last.map.targetAnchors:[];const anchorHtml=anchors.length?'<div style="margin:8px 0"><b>TARGET LUT:</b> '+anchors.map(a=>esc(a.blockId)+' '+esc(a.actualFlow)+' g/s → '+esc(a.commandFlow)+' ml/s ('+esc(a.quality)+')').join(' · ')+'</div>':'';map.innerHTML=rows.length?anchorHtml+'<table><tr><th>Frame</th><th>Block / target</th><th>DE1 cmd</th><th>RAW real g/s</th><th>DE1 flow</th><th>R²</th><th>Status</th></tr>'+rows.map(p=>'<tr><td>'+esc(p.frame)+'</td><td>'+esc((p.blockId||'—')+(p.targetReal!=null?' / '+p.targetReal:'') )+'</td><td>'+esc(p.commandFlow)+'</td><td>'+esc(p.actualFlow)+'</td><td>'+esc(p.machineFlow)+'</td><td>'+esc(p.r2)+'</td><td class="'+(p.acceptedInMap?'good':(p.valid?'':'bad'))+'">'+esc(p.acceptedInMap?'ANCHOR SOURCE':(p.reason||'REJECTED'))+'</td></tr>').join('')+'</table><div style="margin-top:8px">'+esc(c.profileSyncStatus||'')+'</div>':'No calibration run yet. Low Water automatically searches the three HyperEx real-flow targets and generates the LUT only when all targets pass. Full remains the wide engineering staircase.';const cur=c.stage1StartupCorrection||1;startupbox.innerHTML='<b>Stable skip topology:</b> scale feedback is advisory only. Optional S3 DECAY COMP may use 5 profile frames, but S3 subframes advance only by their own timers and never add plugin skipStep calls.'+(Number(cur)!==1?(' <br><span class="bad">Legacy S1 startup factor '+esc(cur)+'× is stored but ignored in v0.1.59.</span> <button id=clearstartup class="b s">CLEAR LEGACY</button>'):'');const cl=$("clearstartup");if(cl)cl.onclick=async()=>{try{await post('startup-clear',{});await loadCal()}catch(e){alert('Clear failed: '+e)}};}catch(e){calstatus.textContent='Calibration status error: '+e}}
function svgPath(points,xmin,xmax,ymin,ymax){const W=800,H=205,pad=18,dx=Math.max(.001,xmax-xmin),dy=Math.max(.001,ymax-ymin);let out='';for(const q of points){if(!Number.isFinite(q[0])||!Number.isFinite(q[1]))continue;const x=pad+(q[0]-xmin)/dx*(W-pad*2),y=H-pad-(q[1]-ymin)/dy*(H-pad*2);out+=(out?' L ':'M ')+x.toFixed(1)+' '+y.toFixed(1)}return out}
function renderChart(svg,series,ymin,ymax,markers){if(!svg)return;let all=[];series.forEach(s=>all=all.concat(s.points));if(!all.length){svg.innerHTML='';return}const xs=all.map(p=>p[0]).filter(Number.isFinite),ys=all.map(p=>p[1]).filter(Number.isFinite);const xmin=Math.min(...xs),xmax=Math.max(...xs);if(ymin==null)ymin=Math.min(...ys);if(ymax==null)ymax=Math.max(...ys);if(ymax-ymin<.01)ymax=ymin+1;let h='<line x1="18" y1="187" x2="782" y2="187" stroke="#3a3f47"/><line x1="18" y1="18" x2="18" y2="187" stroke="#3a3f47"/>';for(const s of series){const path=svgPath(s.points,xmin,xmax,ymin,ymax);if(path)h+='<path d="'+path+'" fill="none" stroke="'+s.stroke+'" stroke-width="'+(s.width||1.7)+'" opacity="'+(s.opacity||1)+'"/>'}h+='<text x="24" y="16" fill="#aeb6c2" font-size="10">'+Number(ymax).toFixed(1)+'</text><text x="24" y="184" fill="#aeb6c2" font-size="10">'+Number(ymin).toFixed(1)+'</text>';for(const q of markers||[]){if(!Number.isFinite(q.x))continue;const xx=18+(q.x-xmin)/Math.max(.001,xmax-xmin)*764;const yy=Number.isFinite(q.y)?187-(q.y-ymin)/Math.max(.001,ymax-ymin)*169:181;const title='<title>'+esc(q.label||'')+'</title>';const tip=' data-tip="'+esc(q.label||'').replace(/"/g,'&quot;')+'"';if(q.shape==='diamond')h+='<path d="M '+xx+' '+(yy-4)+' l 4 4 l -4 4 l -4 -4 Z" fill="'+q.color+'"'+tip+'>'+title+'</path>';else if(q.shape==='square')h+='<rect x="'+(xx-3)+'" y="'+(yy-3)+'" width="6" height="6" fill="'+q.color+'"'+tip+'>'+title+'</rect>';else h+='<circle cx="'+xx+'" cy="'+yy+'" r="3" fill="'+q.color+'"'+tip+'>'+title+'</circle>'}svg.innerHTML=h}
function liveTrimMarkers(run){return(run.liveFlowTrim&&run.liveFlowTrim.trace||[]).filter(x=>['check','write','machine-target-response'].includes(x.kind)).map(x=>({x:x.tMs/1000,y:x.kind==='check'?x.rawGS:x.commandMlS,shape:x.kind==='write'?'diamond':x.kind==='machine-target-response'?'square':'circle',color:x.kind==='write'?'#ff9c45':x.kind==='machine-target-response'?'#f4e6a5':x.rawGS==null?'#7c8795':'#63d89b',label:x.kind+' @ '+(x.tMs/1000).toFixed(2)+'s · '+(x.kind==='check'?(x.rawGS==null?'no valid RAW regression':x.rawGS+' g/s')+' · '+(x.reason||x.decision):x.commandMlS+' ml/s')}))}
function renderLiveTrim(run){const q=$('livetrimstatus');if(!q)return;const x=run&&run.liveFlowTrim;if(!x){q.textContent='';return}q.textContent='EXPERIMENTAL LIVE FLOW TRIM · level '+(x.level||1)+' · '+x.status+' · checks '+x.checks+'/'+(x.maxChecks||50)+' · writes '+x.writes+'/'+(x.maxWrites||50)+' · driver ACK '+x.acks+' · target responses '+x.targetConfirmations+' · target misses '+(x.targetMisses||0)+' / streak '+(x.consecutiveTargetMisses||0)+' (tolerate 3) · retries '+(x.retries||0)+' · interval '+x.periodMs+' ms · normal next-shot learning retained; corrected stages require verified stable windows';}
function renderCharts(run){if(!run)return;const combined=run.samples||[],raw=run.rawScaleSamples||[];const target=combined.map(s=>[Number(s.tMs)/1000,Number(s.targetFlowMlS)]),machine=combined.map(s=>[Number(s.tMs)/1000,Number(s.machineFlowMlS)]),decaid=combined.map(s=>[Number(s.tMs)/1000,Number(s.decaidWeightFlowGS)]);const cupTarget=combined.map(s=>[Number(s.tMs)/1000,Number(s.desiredRealFlowGS)]);const rawSlope=[];for(let i=0;i<raw.length;i++){let j=i-1;while(j>0&&Number(raw[i].tMs)-Number(raw[j].tMs)<900)j--;if(j>=0){let reset=false;for(let k=j+1;k<=i;k++)if(raw[k].tareReset){reset=true;break}const dt=(Number(raw[i].scaleTimestampSeconds)-Number(raw[j].scaleTimestampSeconds));if(!reset&&Number.isFinite(dt)&&dt>.25){rawSlope.push([Number(raw[i].tMs)/1000,(Number(raw[i].weightG)-Number(raw[j].weightG))/dt])}}}const flowYs=[...target,...machine,...decaid,...rawSlope].map(p=>p[1]).filter(v=>Number.isFinite(v)&&v>-1&&v<20);const fymax=Math.max(6,flowYs.length?Math.min(12,Math.ceil(Math.max(...flowYs)+.5)):8);renderChart($('flowchart'),[{points:cupTarget,stroke:'#f58d9a',width:1.3},{points:target,stroke:'#f0c75e',width:1.4},{points:machine,stroke:'#71a7ff',width:1.8},{points:decaid,stroke:'#c77dff',width:1.5,opacity:.8},{points:rawSlope,stroke:'#63d89b',width:2.1},{points:(run.liveFlowTrim&&run.liveFlowTrim.trace||[]).filter(x=>x.kind==='write').map(x=>[x.tMs/1000,x.commandMlS]),stroke:'#ff9c45',width:2}],0,fymax,liveTrimMarkers(run));const wp=raw.map(r=>[Number(r.tMs)/1000,Number(r.weightG)]);if(wp.length){const wy=wp.map(p=>p[1]).filter(Number.isFinite);renderChart($('weightchart'),[{points:wp,stroke:'#e5e8ed',width:2}],Math.min(...wy),Math.max(...wy))}}
function validationClass(x){return x==='HIT'?'good':x==='NEAR'||x==='TRANSIENT'?'':'bad'}
function validationRow(label,p){if(!p)return '<tr><td>'+label+'</td><td colspan=7>—</td></tr>';return '<tr><td>'+label+'</td><td>'+esc(p.desiredRealFlowGS)+'</td><td>'+esc(p.machineFlowAvg)+'</td><td>'+esc(p.gflowAvg)+'</td><td><b>'+esc(p.rawRegressionGS)+'</b></td><td>'+esc(p.rawRegressionR2)+'</td><td>'+esc(p.rawRegressionSeconds)+'s</td><td class="'+validationClass(p.validationStatus)+'">'+esc(p.validationStatus)+' '+(p.rawErrorPct==null?'':('('+p.rawErrorPct+'%)'))+'</td></tr>'}
function advisoryClass(a){return !a?'':a.action==='HOLD'?'good':a.confidence==='INSUFFICIENT'?'bad':''}
function advisoryRow(label,a){if(!a)return '<tr><td>'+label+'</td><td colspan=6>—</td></tr>';const ref=a.referenceCommandMlS==null?'—':a.referenceCommandMlS;const range=a.referenceRangeMlS&&a.referenceRangeMlS.length===2?(a.referenceRangeMlS[0]+'–'+a.referenceRangeMlS[1]):'—';return '<tr><td>'+label+'</td><td>'+esc(a.confidence)+'</td><td>'+esc(a.action)+'</td><td>'+esc(a.currentCommandMlS)+'</td><td>'+esc(ref)+'</td><td><b>'+esc(range)+'</b></td><td class="'+advisoryClass(a)+'">'+esc(a.message)+'</td></tr>'}
function segCell(x){if(!x||x.slope==null)return '—';return '<b>'+esc(x.slope)+'</b> g/s · R² '+esc(x.r2)+' · '+esc(x.seconds)+'s'}
function renderStability(s){if(!stability)return;const m=s&&s.stage1Startup,st=s&&s.stage3Stability;if(!m&&!st){stability.innerHTML='<span class="small">No S1/S3 stability diagnostics available yet.</span>';return}let h='';if(m){const cls=m.confidence==='INSUFFICIENT'?'bad':m.confidence==='MEDIUM'?'good':'';h+='<div style="margin-bottom:10px"><b>S1 STARTUP</b> · confidence <span class="'+cls+'">'+esc(m.confidence)+'</span><br>First cup rise: <b>'+esc(m.firstRiseDelayS)+' s</b> · 20–80% flow: <b>'+esc(m.midFlowGS)+' g/s</b> · R² '+esc(m.midR2)+' · transit '+esc(m.transit20to80S)+' s · active avg '+esc(m.activeFlowGS)+' g/s · collected '+esc(m.gainG)+' g<br><span class="small">Quality: '+esc(m.qualityReason||'—')+' · 20–80% samples '+esc(m.midSampleCount??'—')+' · active '+esc(m.activeSeconds)+' s</span></div>'}if(st){const sc=st.status==='STABLE'?'good':'bad';h+='<div><b>S3 STABILITY</b> · <span class="'+sc+'">'+esc(st.status)+'</span> · late/early '+esc(st.lateToEarlyRatio)+'<table><tr><th>EARLY 25%</th><th>MID 50%</th><th>LATE 25%</th><th>Stall window</th></tr><tr><td>'+segCell(st.early)+'</td><td>'+segCell(st.mid)+'</td><td>'+segCell(st.late)+'</td><td>'+(st.stall&&st.stall.suspected?'<span class="bad"><b>YES</b> '+esc(st.stall.startS)+'–'+esc(st.stall.endS)+'s · RAW '+esc(st.stall.rawSlopeGS)+' g/s while DE1 '+esc(st.stall.machineFlowMlS)+' ml/s</span>':'<span class="good">none</span>')+'</td></tr></table>'+(Array.isArray(st.shapeFrames)?'<div style="margin-top:8px"><b>LATEST SHOT · S3 FRAME MEASUREMENTS</b><div class="small">The Command column is the command captured for this completed shot, not the current NEXT SHOT profile.</div><table><tr><th>Frame</th><th>SHOT command</th><th>MEASURED RAW regression</th><th>R²</th><th>Window</th></tr>'+st.shapeFrames.map(x=>'<tr><td>'+esc(x.name)+'</td><td>'+esc(x.commandMlS)+' ml/s</td><td>'+esc(x.slope)+' g/s</td><td>'+esc(x.r2)+'</td><td>'+esc(x.seconds)+' s</td></tr>').join('')+'</table></div>':'')+'</div>'}stability.innerHTML=h}
function renderAdvisory(s){if(!advisory)return;const a=s&&s.advisory;if(!a){advisory.innerHTML='<span class="small">No advisory available yet. Run a complete HyperEx shot.</span>';return}advisory.innerHTML='<table><tr><th>Stage</th><th>Confidence</th><th>Action</th><th>Current cmd</th><th>Mid ref</th><th>Reference Range</th><th>Advice</th></tr>'+advisoryRow('S1',a.stage1)+advisoryRow('S2',a.stage2)+advisoryRow('S3',a.stage3)+'</table><div class="small" style="margin-top:8px">Range is deliberately only a partial step toward the theoretical correction. LOW confidence may still show a broad manual-test range; INSUFFICIENT never shows a numeric range.</div>'}
function stageTestRow(label,key,c,a){const mode=(c&&c[key+'Mode'])||'auto';const lut=c&&c[key+'LutCommandMlS']!=null?c[key+'LutCommandMlS']:'—';const eff=c&&c[key+'CommandMlS']!=null?c[key+'CommandMlS']:lut;const editor=(key==='stage3'&&c&&c.stage3FlatCommandMlS!=null)?c.stage3FlatCommandMlS:eff;const applied=(key==='stage3'&&mode==='shape')?appliedS3Text(c):esc(eff)+' ml/s';const adv=a&&a[key];const rr=adv&&adv.referenceRangeMlS&&adv.referenceRangeMlS.length===2?(adv.referenceRangeMlS[0]+'–'+adv.referenceRangeMlS[1]):'—';const shapeOpt=(key==='stage3'&&mode==='shape')?'<option value="shape" selected disabled>SHAPE ACTIVE ↓</option>':'';return '<tr><td>'+label+'</td><td>'+esc(c&&c[key+'DesiredGS'])+'</td><td>'+esc(lut)+'</td><td>'+esc(rr)+'</td><td><select id="mode_'+key+'">'+shapeOpt+'<option value="auto" '+(mode==='auto'?'selected':'')+'>AUTO / LUT</option><option value="manual" '+(mode==='manual'?'selected':'')+'>MANUAL TEST</option></select></td><td><input id="cmd_'+key+'" type="number" min="0.10" max="8.00" step="0.01" value="'+esc(editor)+'" style="width:85px"></td><td><b>'+applied+'</b></td></tr>'}
function shapeSuggestion(c,st){const a=latestNextShotAdaptive&&latestNextShotAdaptive.s3;if(a&&a.usable&&a.suggestedShape){const q=a.suggestedShape;return {early:Number(q.earlyCommand),earlySeconds:Number(q.earlySeconds),mid:Number(q.midCommand),midSeconds:Number(q.midSeconds),late:Number(q.lateCommand),source:'NEXT SHOT ADAPTIVE'}}if(a&&a.action&&String(a.action).includes('REPEAT'))return null;const cur=Number(c&&c.stage3CommandMlS);if(!Number.isFinite(cur))return null;let early=cur,mid=cur,late=cur;if(st&&(st.status==='LATE DECAY'||(st.stall&&st.stall.suspected))){early=Math.max(.10,cur*.97);late=Math.min(8,cur*(st.stall&&st.stall.suspected?1.15:1.08));}return {early:Number(early.toFixed(3)),earlySeconds:8,mid:Number(mid.toFixed(3)),midSeconds:14,late:Number(late.toFixed(3)),source:'FALLBACK'}}
function renderAdaptive(s){
  latestAdaptiveSummary=s||null;
  if(!adaptive)return;
  const a=s&&s.nextShotAdaptive;
  if(!a){adaptive.innerHTML='<span class="small"><b>WAITING FOR SHOT EVIDENCE</b><br>After STEP 1 calibration is valid, run HyperEx normally. The plugin will collect completed-shot evidence and adjust only the next shot when its safety gates pass.</span>';return}
  const s1=a.s1||{},s2=a.s2||{},s3=a.s3||{},ready=!!a.actionable,st=latestAutoApplyStatus||{};
  const appliedForRun=String(st.runId||'')===String(a.runId||'')&&(st.status==='applied'||st.status==='manual-applied');
  const failedForRun=String(st.runId||'')===String(a.runId||'')&&st.status==='error';
  const scalarRow=(label,x,basis)=>{let measured=x.measuredGS==null?'—':esc(x.measuredGS)+' g/s';if(x.previousGS!=null&&x.currentGS!=null)measured=esc(x.previousGS)+' → '+esc(x.currentGS)+' g/s · mean '+esc(x.measuredGS);let proposed='repeat';if(x.action==='HOLD')proposed='<span class="good"><b>HOLD '+esc(x.currentCommandMlS)+' ml/s</b></span>';else if(x.action==='ADJUST')proposed='<b>'+esc(x.suggestedCommandMlS)+' ml/s</b>';else if(x.action)proposed='<b>'+esc(x.action)+'</b>';return '<tr><td>'+label+'</td><td>'+basis+'<br>'+measured+(x.variabilityPct!=null?' · var '+esc(x.variabilityPct)+'%':'')+'</td><td>'+esc(x.currentCommandMlS)+' ml/s</td><td>'+proposed+'</td><td>'+esc(x.confidence||'—')+'</td></tr>'};
  let h='<div class="small">Source run: <b>'+esc(a.runId)+'</b> · <b>'+esc(a.mode)+'</b> · all numeric changes below apply to the <b>NEXT SHOT ONLY</b>.</div><table><tr><th>Stage</th><th>Evidence</th><th>SHOT command</th><th>NEXT action / command</th><th>Confidence</th></tr>';
  h+=scalarRow('S1',s1,'startup 20–80%');
  h+=scalarRow('S2',s2,'RAW multi-second regression');
  let s3meas=s3.overallGS==null?'—':('overall '+esc(s3.overallGS)+' g/s');
  if(s3.levelErrorPct!=null)s3meas+=' · LEVEL error '+esc(s3.levelErrorPct)+'%';
  if(s3.variabilityPct!=null)s3meas+=' · max var '+esc(s3.variabilityPct)+'%';
  let s3shot=(s3.sourceFrames||[]).map(x=>esc(x.commandMlS)).join(' → ')||'—';
  let s3next='<b>'+esc(s3.action||'REPEAT')+'</b>';
  if(s3.normalizedShapeVariabilityPct!=null)s3meas+=' · normalized shape var '+esc(s3.normalizedShapeVariabilityPct)+'%';
  if(s3.suggestedShape){const q=s3.suggestedShape;s3next='<b>'+esc(s3.action)+'<br>'+esc(q.earlyCommand)+' × '+esc(q.earlySeconds)+'s → '+esc(q.midCommand)+' × '+esc(q.midSeconds)+'s → '+esc(q.lateCommand)+'</b>';if(s3.levelFactor!=null)s3next+='<br><span class="small">LEVEL ×'+esc(s3.levelFactor)+' · normalized SHAPE '+(s3.shapeFactors||[]).map(x=>'×'+esc(x)).join(' / ')+'</span>'}
  h+='<tr><td>S3</td><td>'+s3meas+'<br>late/early '+esc(s3.lateToEarlyRatio)+' · '+esc(s3.status||'—')+'</td><td>'+s3shot+'</td><td>'+s3next+'</td><td>'+esc(s3.confidence||'—')+'</td></tr>';
  h+='</table><div class="small" style="margin-top:7px">'+esc(a.note||'')+'<br>S1: '+esc(s1.maxStepRule||'')+'<br>'+esc(s1.reason||'—')+'<br>S2: '+esc(s2.maxStepRule||'')+'<br>'+esc(s2.reason||'—')+'<br>S3: '+esc(s3.maxStepRule||'')+'<br>'+esc(s3.reason||'—')+'</div>';
  if(ready){
    if(latestAutoApplyEnabled){
      if(appliedForRun)h+='<div class="row"><span class="good"><b>APPLIED ✓ TO NEXT SHOT</b></span><span class="small" style="align-self:center">Readback and profile sync completed. The NEXT SHOT · APPLIED PROFILE block above is authoritative.</span></div>';
      else if(failedForRun)h+='<div class="row"><span class="bad"><b>NOT APPLIED</b></span><span class="small" style="align-self:center">AUTO APPLY failed safely: '+esc(st.message||'unknown error')+'. Previous profile retained.</span></div>';
      else h+='<div class="row"><span><b>AUTO APPLY ARMED</b></span><span class="small" style="align-self:center">An actionable proposal exists; wait for successful APPLIED readback before treating it as current.</span></div>';
    }else h+='<div class="row"><button id="applynext" class="b primaryAction">APPLY NEXT SHOT</button><span class="small" style="align-self:center">AUTO APPLY is OFF.</span></div>';
  }else h+='<div class="small" style="margin-top:8px"><b>NO NUMERIC CHANGE YET</b> · the plugin keeps the current profile until the required repeated evidence agrees.</div>';
  adaptive.innerHTML=h;
  const q=$('applynext');
  if(q)q.onclick=async()=>{if(!confirm('Apply the bounded NEXT SHOT adaptive suggestion?\\n\\nThis changes only future-shot profile commands. It does NOT modify the calibration LUT and does NOT change a running shot.'))return;try{const r=await post('adaptive-next-apply',{});if(r&&r.verified!==true)throw new Error('server did not verify the applied override');alert('Next-shot suggestion VERIFIED and applied.\\n\\nThe NEXT SHOT · APPLIED PROFILE block is authoritative.');await loadDiag()}catch(e){alert('Apply next shot failed: '+e)}}
}
function renderBasketContext(c){
 const el=$('basketcontext');if(!el)return;const prior=c.baselinePrior||{},stage=c.learningStage||{};
 el.innerHTML='<b>'+esc(stage.stage||'CHECKING BASELINE')+'</b><div>'+esc(stage.message||'Checking calibration and saved empty-basket evidence.')+'</div><div class="small">Empty-basket Step 2: '+esc(stage.emptyShots||0)+' / '+esc(stage.maxEmptyShots||3)+' maximum. '+esc(prior.referenceShots||0)+' empty/pre-upgrade references retained. Starting LUT and bounded commands are kept; normal coffees then refine the next-shot trajectory automatically.</div>';
}
async function readRawWorkflow(){
 const status=$('auditstatus'),out=$('auditjson');if(status)status.textContent='Reading fresh workflow without repair/upload…';
 try{
  const r=await fetch(base+'/adaptive-audit');const a=await r.json();
  if(out)out.value=JSON.stringify(a,null,2);
  if(!r.ok)throw Error(a.error||'Read failed');
  status.textContent='RAW GET /workflow · '+a.serverTime+' · expected current profile match: '+a.workflowMatchesExpected+' · latest proposal match: '+(a.proposalMatchesWorkflow==null?'no actionable proposal':a.proposalMatchesWorkflow)+' · auto apply: '+((a.autoApply||{}).status||'no attempt recorded')+'. Upload acknowledgement is not independent DE1 memory readback.';
 }catch(e){if(status)status.textContent='Raw readback unavailable: '+e}
}
if($('readworkflow'))$('readworkflow').onclick=readRawWorkflow;
function renderAutoApplyBox(){const box=$('autoapplybox');if(!box)return;const on=!!latestAutoApplyEnabled;const st=latestAutoApplyStatus||{};let status=st.message?('<span class="small">Auto apply state: <b>'+esc(st.status||'unknown')+'</b> · '+esc(st.message)+(st.runId?' · '+esc(st.runId):'')+'</span>'):'';box.innerHTML='<div class="row"><button id="autoapplytoggle" class="b '+(on?'primaryAction':'tertiaryAction')+'">AUTO APPLY NEXT SHOT: '+(on?'ON':'OFF')+'</button><span class="small" style="align-self:center">'+(on?'Default mode · verified actionable suggestions apply automatically.':'Manual mode · enter DIAG and press APPLY NEXT SHOT when a numeric suggestion is available.')+'</span></div>'+status;const q=$('autoapplytoggle');if(q)q.onclick=async()=>{const next=!latestAutoApplyEnabled;if(!confirm((next?'Enable':'Disable')+' AUTO APPLY NEXT SHOT?\\n\\n'+(next?'Verified actionable suggestions will apply automatically after completed HyperEx shots.':'The plugin will return to the v0.1.39 manual APPLY NEXT SHOT workflow.')))return;try{const r=await post('adaptive-auto-set',{enabled:next});latestAutoApplyEnabled=!!r.autoApplyNextShot;latestAutoApplyStatus=r.autoApplyLastStatus||null;renderAutoApplyBox();renderAdaptive(latestAdaptiveSummary)}catch(e){alert('AUTO APPLY setting failed: '+e)}}}
function renderS3Shape(c,st){if(!s3shape)return;const saved=c&&c.s3Shape&&c.s3Shape.enabled?c.s3Shape:null;const sug=shapeSuggestion(c,st);const q=saved||sug||{early:c.stage3CommandMlS,earlySeconds:8,mid:c.stage3CommandMlS,midSeconds:14,late:c.stage3CommandMlS};const ap=latestNextShotAdaptive&&latestNextShotAdaptive.s3;const hint=(ap&&ap.action&&(ap.action==='REPEAT SAME SHAPE'||ap.action==='VARIABLE / REPEAT'))?('NEXT SHOT: '+ap.action+' · keep the current shape unchanged until repeated evidence is consistent.'):('Suggested '+(sug&&sug.source==='NEXT SHOT ADAPTIVE'?'from NEXT SHOT ADAPTIVE':'from latest LATE DECAY')+': '+(sug?(sug.early+' × '+sug.earlySeconds+'s → '+sug.mid+' × '+sug.midSeconds+'s → '+sug.late):'—'));s3shape.innerHTML='<b>S3 SHAPE OVERRIDE EDITOR</b> · profile-time only, no extra skipStep<div class="small">'+(saved?'<span class="good"><b>APPLIED SHAPE</b></span> · inputs below are loaded from the current applied override.':'<b>NOT APPLIED</b> · inputs below are only a TEST/PROPOSED editor until APPLY TEST COMMANDS succeeds.')+'</div><table><tr><th>Mode</th><th>EARLY cmd</th><th>EARLY time</th><th>MID cmd</th><th>MID time</th><th>LATE cmd</th></tr><tr><td><select id="s3shape_mode"><option value="off" '+(!saved?'selected':'')+'>FLAT</option><option value="decay" '+(saved?'selected':'')+'>DECAY COMP TEST</option></select></td><td><input id="s3shape_early" type="number" min=".10" max="8" step=".01" value="'+esc(q.earlyCommand??q.early)+'" style="width:76px"></td><td><input id="s3shape_early_s" type="number" min="3" max="30" step="1" value="'+esc(q.earlySeconds)+'" style="width:62px"> s</td><td><input id="s3shape_mid" type="number" min=".10" max="8" step=".01" value="'+esc(q.midCommand??q.mid)+'" style="width:76px"></td><td><input id="s3shape_mid_s" type="number" min="3" max="30" step="1" value="'+esc(q.midSeconds)+'" style="width:62px"> s</td><td><input id="s3shape_late" type="number" min=".10" max="8" step=".01" value="'+esc(q.lateCommand??q.late)+'" style="width:76px"></td></tr></table><div class="small">Commands must be non-decreasing. Adjacent rises are bounded to ≤35% and ≤0.25 ml/s. '+hint+' The shape is enabled automatically only when AUTO APPLY is ON and a verified actionable adaptive suggestion passes all safety checks.</div>'}
function renderTestCommands(c,a){if(!testcommands)return;testcommands.innerHTML='<table><tr><th>Stage</th><th>Target g/s</th><th>LUT cmd</th><th>Ref range</th><th>Editor mode</th><th>Editor flat cmd</th><th>CURRENTLY APPLIED</th></tr>'+stageTestRow('S1','stage1',c,a)+stageTestRow('S2','stage2',c,a)+stageTestRow('S3','stage3',c,a)+'</table><div class="small" style="margin-top:7px">DE1 command hard limit: 0.10–8.00 ml/s. MANUAL TEST changes only the HyperEx profile command; calibration LUT data remains untouched. If S3 DECAY COMP is enabled, its three shape commands override the flat S3 command.</div>';renderS3Shape(c,latestStage3Stability)}
async function applyTestCommands(){const stages={};for(const key of ['stage1','stage2','stage3']){const mode=$('mode_'+key).value;const command=Number($('cmd_'+key).value);if(mode==='manual'&&(!Number.isFinite(command)||command<0.10||command>8.00)){alert(key.toUpperCase()+' manual command must be 0.10–8.00 ml/s.');return}stages[key]={mode,command}}const sm=$('s3shape_mode');const s3Shape={enabled:!!sm&&sm.value==='decay',earlyCommand:Number($('s3shape_early').value),earlySeconds:Number($('s3shape_early_s').value),midCommand:Number($('s3shape_mid').value),midSeconds:Number($('s3shape_mid_s').value),lateCommand:Number($('s3shape_late').value)};if(s3Shape.enabled){if([s3Shape.earlyCommand,s3Shape.midCommand,s3Shape.lateCommand].some(x=>!Number.isFinite(x)||x<.10||x>8)){alert('S3 shape commands must be 0.10–8.00 ml/s.');return}if(s3Shape.earlyCommand>s3Shape.midCommand||s3Shape.midCommand>s3Shape.lateCommand){alert('S3 DECAY COMP commands must be non-decreasing: EARLY ≤ MID ≤ LATE.');return}if(!Number.isFinite(s3Shape.earlySeconds)||s3Shape.earlySeconds<3||s3Shape.earlySeconds>30||!Number.isFinite(s3Shape.midSeconds)||s3Shape.midSeconds<3||s3Shape.midSeconds>30){alert('S3 EARLY/MID times must be 3–30 seconds.');return}}if(!confirm('Apply these TEST commands to HyperEx?\\n\\nS1/S2/manual flat commands are static. S3 DECAY COMP, if enabled, advances only by profile time and adds NO plugin skipStep calls. Calibration LUT remains unchanged. Use empty-basket validation first.'))return;try{await post('test-command-set',{stages,s3Shape});await loadDiag()}catch(e){alert('Apply failed: '+e)}}
async function returnAllToLut(){if(!confirm('Return S1/S2/S3 to AUTO / LUT and clear all manual test overrides, including S3 shape?'))return;try{await post('test-command-clear',{});await loadDiag()}catch(e){alert('Reset failed: '+e)}}

async function loadDiag(){b.style.display='none';copy.style.display='block';diag.style.display='block';t.textContent='DIAGNOSTICS / FLOW CAL';d.textContent='STEP 1 calibrates the physical real-flow LUT. STEP 2 measures every completed shot and automatically adapts S1/S2/S3 for the next shot only. STEP 3 is manual engineering; STEP 4 exports CSV.';try{const jr=await fetch(base+'/diagnostics');if(jr.ok){const j=await jr.json(),s=j.summary||{};renderLiveTrim(j.run);renderCharts(j.run);renderRunCommands(s);if(s.kind==='hyperex'){validation.innerHTML=stat('S1 target / RAW reg',(s.stage1?(esc(s.stage1.desiredRealFlowGS)+' / '+esc(s.stage1.rawRegressionGS)):'—'))+stat('S2 target / RAW reg',(s.stage2?(esc(s.stage2.desiredRealFlowGS)+' / '+esc(s.stage2.rawRegressionGS)):'—'))+stat('S3 target / RAW reg',(s.stage3?(esc(s.stage3.desiredRealFlowGS)+' / '+esc(s.stage3.rawRegressionGS)):'—'));validationtable.innerHTML='<table><tr><th>Stage</th><th>Target g/s</th><th>DE1 Flow</th><th>Decaid</th><th>RAW regression</th><th>R²</th><th>Window</th><th>Status / error</th></tr>'+validationRow('S1',s.stage1)+validationRow('S2',s.stage2)+validationRow('S3',s.stage3)+'</table>';latestAdvisorySummary=s.advisory||null;latestStage3Stability=s.stage3Stability||null;latestNextShotAdaptive=s.nextShotAdaptive||null;renderStability(s);renderAdaptive(s);renderAdvisory(s)}else{validation.innerHTML=stat('LATEST RUN',s.kind||'calibration');validationtable.innerHTML='<span class="small">Latest diagnostic run is not a HyperEx shot. Run HyperEx to populate current-shot validation.</span>';latestAdvisorySummary=null;latestStage3Stability=null;latestNextShotAdaptive=null;latestAdaptiveSummary=null;if(stability)stability.innerHTML='<span class="small">S1/S3 stability diagnostics are generated only from a HyperEx shot.</span>';if(adaptive)adaptive.innerHTML='<span class="small"><b>NEW INSTALL / NO PREVIOUS SHOT</b><br>Run one complete HyperEx validation shot to generate the first next-shot suggestion.</span>';if(advisory)advisory.innerHTML='<span class="small">Reference advice is generated only from a HyperEx shot.</span>'}stats.innerHTML=stat('RAW SCALE WEIGHT',s.lastRawScaleWeightG??'—')+stat('RAW instantaneous dW/dt',s.lastRawScaleDwDtGS??'—')+stat('Decaid weightFlow',s.lastDecaidWeightFlowGS??'—')+stat('RUN RESULT',s.result||'—')+stat('COMBINED SAMPLES',s.sampleCount||0)+stat('RAW SCALE SAMPLES',s.rawScaleSampleCount||0);m.textContent=(s.result||'')+' · '+(s.sampleCount||0)+' combined · '+(s.rawScaleSampleCount||0)+' raw scale';const cr=await fetch(base+'/diagnostics-csv');if(cr.ok)csv.value=await cr.text();}else{renderRunCommands(null);validation.innerHTML=stat('LAST RUN','none yet');validationtable.innerHTML='';latestAdaptiveSummary=null;if(stability)stability.innerHTML='';if(adaptive)adaptive.innerHTML='<span class="small"><b>NEW INSTALL / NO PREVIOUS SHOT</b><br>Run one complete HyperEx validation shot to generate the first next-shot suggestion.</span>';if(advisory)advisory.innerHTML='';stats.innerHTML=''}}catch(e){if(runcommands)runcommands.innerHTML='<span class="bad">Latest-shot command snapshot unavailable: '+esc(e)+'</span>';validation.innerHTML=stat('DIAG ERROR',esc(e));validationtable.innerHTML='';latestAdaptiveSummary=null;if(stability)stability.innerHTML='';if(adaptive)adaptive.innerHTML='';if(advisory)advisory.innerHTML='';stats.innerHTML=''}await loadCal();await loadAdvancedSettings()}
const flowSvg=$('flowchart');if(flowSvg)flowSvg.onclick=e=>{const q=e.target.closest('[data-tip]');if(q&&$('flowpointdetail'))$('flowpointdetail').textContent=q.getAttribute('data-tip')};const saveAdv=$('saveadvanced');if(saveAdv)saveAdv.onclick=saveAdvancedSettings;$('applytest').onclick=applyTestCommands;$('returnlut').onclick=returnAllToLut;
$('prepare').onclick=async()=>{let c={calibrationModeLabel:'Low Water',calibrationSteps:9,calibrationStepSeconds:7.5,nominalCommandWaterMl:95,recommendedContainerMl:300,calibrationHardStopG:240,primeFlow:3,primeSeconds:3,waterPreflight:{status:'unknown',available:false,message:'Tank level unavailable'}};try{const rr=await fetch(base+'/calibration-status');if(rr.ok)c=await rr.json()}catch(_){}const w=c.waterPreflight||{};if(w.status==='block'){alert('WATER PREFLIGHT BLOCKED.\\n\\n'+(w.message||'DE1 tank level is too close to/below the refill threshold.')+'\\n\\nRefill the tank and try again.');return}let allowUnknown=false;if(w.status==='unknown'||!w.available){if(!confirm('DE1 tank level is unavailable or stale.\\n\\nThe plugin cannot verify tank water automatically. Continue only if you have manually checked the tank.'))return;allowUnknown=true}else if(w.status==='warn'){if(!confirm('DE1 tank water margin is low.\\n\\n'+(w.message||'')+'\\n\\nContinue anyway?'))return}const msg='EMPTY BASKET ONLY · '+c.calibrationModeLabel+' CALIBRATION.\\n\\nPrime '+c.primeFlow+' ml/s × '+c.primeSeconds+' s, then '+c.calibrationSteps+' target/search plateaus × '+c.calibrationStepSeconds+' s.\\nNominal DE1 commanded water: ≈'+c.nominalCommandWaterMl+' ml.\\nActual-water safety stop: ≈'+c.calibrationHardStopG+' g.\\n\\nUse a '+c.recommendedContainerMl+' ml or larger catch vessel.\\nTare the scale, then start Espresso manually. Do not remove the vessel until Idle.\\n\\nContinue?';if(!confirm(msg))return;try{await post('calibration-prepare',{allowUnknownWater:allowUnknown,allowLowMargin:w.status==='warn'});alert(c.calibrationModeLabel+' calibration profile selected. EMPTY BASKET. Tare scale, start Espresso, and leave the vessel in place until Idle.');await loadCal()}catch(e){alert('Prepare failed: '+e)}};
$('sync').onclick=async()=>{try{await post('calibration-sync',{});await loadCal()}catch(e){alert('Sync failed: '+e)}};
$('suggested').onclick=async()=>{try{await post('calibration-use-suggested',{});alert('Suggested multiplier will be used for the NEXT calibration run. Re-run Flow Cal to create a LUT tied to that multiplier.');await loadCal()}catch(e){alert('Action failed: '+e)}};
$('global').onclick=async()=>{if(!confirm('This changes DE1 flowMultiplier globally for ALL profiles. The current value will be saved for Restore. After applying, run Flow Cal again. Continue?'))return;try{await post('calibration-apply-global',{});alert('Global multiplier applied. Run Flow Cal again before using the LUT.');await loadCal()}catch(e){alert('Global apply failed: '+e)}};
$('restore').onclick=async()=>{if(!confirm('Restore the DE1 flowMultiplier saved before the last global apply?'))return;try{await post('calibration-restore-global',{});await loadCal()}catch(e){alert('Restore failed: '+e)}};
$('clearcal').onclick=async()=>{if(!confirm('Clear the saved real-flow LUT? HyperEx will return to direct DE1 flow commands.'))return;try{await post('calibration-clear',{});await loadCal()}catch(e){alert('Clear failed: '+e)}};
async function poll(){try{const r=await fetch(base+'/status');paint(await r.json())}catch(e){}setTimeout(poll,400)}b.onclick=()=>doRearm(false);copy.onclick=async()=>{csv.focus();csv.select();try{await navigator.clipboard.writeText(csv.value);copy.textContent='COPIED'}catch(e){document.execCommand('copy');copy.textContent='SELECTED / COPIED'}setTimeout(()=>copy.textContent='COPY CSV',1200)};function dashboardBack(){if(window.history&&window.history.length>1){window.history.back();return}homeFallback()}function homeFallback(){try{if(window.top&&window.top!==window&&window.top.history&&window.top.history.length>1){window.top.history.back();return}}catch(_){}if(window.history&&window.history.length>2){window.history.go(-2);return}if(window.history&&window.history.length>1){window.history.back();return}}function closeUi(){try{if(window.parent&&window.parent!==window)window.parent.postMessage({type:'streamline:close'},'*')}catch(_){}setTimeout(dashboardEntry?dashboardBack:homeFallback,280)}$('close').textContent=diagView?'CLOSE / HOME':'CLOSE';$('close').onclick=closeUi;if(diagView){loadDiag()}else if(view==='rearm'){doRearm(true)}else{poll()}
</script></body></html>`;
  }

  function startGhcCountdown() {
    clearTimer("ghcCountdownTimer");
    state.ghcPromptStartedAtMs = Date.now();
    const total = Math.max(1, state.cfg.ghcConfirmTimeoutSeconds);
    let lastLogged = null;
    let lastUi = null;

    const tick = () => {
      if (state.phase !== "restart_wait") return;
      const elapsed = (Date.now() - state.ghcPromptStartedAtMs) / 1000;
      const remaining = Math.max(0, Math.ceil(total - elapsed));
      state.ghcSecondsRemaining = remaining;
      const message = `CHECK PINK: ON -> PRESS GHC / OFF -> RE-ARM — ${remaining}s`;
      emitGhcPrompt("waiting", remaining, message);
      if (remaining !== lastUi) { emitSkinChanged(); lastUi = remaining; }

      const shouldLog = remaining === Math.ceil(total) || remaining === 15 || remaining === 10 || remaining <= 5;
      if (shouldLog && remaining !== lastLogged) {
        log(`>>> ${message} <<<`);
        lastLogged = remaining;
      }

      if (remaining > 0 && state.phase === "restart_wait") {
        state.ghcCountdownTimer = setTimeout(tick, 250);
      }
    };

    tick();
  }

  function clearTimer(name) {
    if (state[name] !== null && state[name] !== undefined) {
      clearTimeout(state[name]);
      state[name] = null;
    }
  }

  function clearAllTimers() {
    stopLiveTrim("cancelled");
    cancelDirectStartTest();
    clearTimer("dumpTimer");
    clearTimer("dumpSettleTimer");
    clearTimer("dumpFallbackTimer");
    clearTimer("idlePollTimer");
    clearTimer("soakTimer");
    clearTimer("noScaleTimer");
    clearTimer("maxRunTimer");
    clearTimer("restartSkipTimer");
    clearTimer("restartPollTimer");
    clearTimer("restartTimeoutTimer");
    clearTimer("ghcCountdownTimer");
    clearTimer("soakCountdownTimer");
    clearTimer("armReinforceTimer");
    clearTimer("armReinforceTimer2");
    clearTimer("autoApplyTimer");
    clearTimer("completionTimer");
  }

  function profileObject() {
    const c = state.cfg;
    const s1 = clampCommandFlow(resolvedStageCommandFlow("stage1", c.stage1Flow));
    const s2 = clampCommandFlow(resolvedStageCommandFlow("stage2", c.stage2Flow));
    const s3 = clampCommandFlow(resolvedStageCommandFlow("stage3", c.stage3Flow));
    const safePressure = value => clampNumber(value, LIMITS.pressureMin, Math.min(LIMITS.pressureMax, c.hardPressureLimit), LIMITS.pressureMin);
    const p1 = safePressure(c.stage1PressureLimit), p2 = safePressure(c.stage2PressureLimit), p3 = safePressure(c.stage3PressureLimit);
    const summary = commandFlowSummary();
    const manualStages = Array.isArray(summary.manualTestActiveStages) ? summary.manualTestActiveStages : [];
    const shape = s3ShapeStatus();
    const manualNote = manualStages.length
      ? ` MANUAL TEST override active for ${manualStages.map(x => x.toUpperCase()).join("/")}; saved LUT is unchanged.`
      : ` All stages AUTO / LUT.`;
    const calNote = state.calibrationMapUsable
      ? `Scale-calibrated real-flow feed-forward. Effective commands: ${s1.toFixed(3)}/${s2.toFixed(3)}/${(shape.enabled ? shape.midCommand : s3).toFixed(3)} ml/s at flowMultiplier ${Number(calibrationBaseMultiplier()).toFixed(3)}.${manualNote}`
      : `Direct bounded DE1 flow feed-forward; calibration LUT inactive (${state.calibrationMapStaleReason || "not available"}).${manualNote}`;
    const steps = [
      {
        name: `S1 real ${c.stage1Flow.toFixed(2)} g/s`,
        temperature: c.temperature.toFixed(1), sensor: "coffee", pump: "flow", transition: "fast", pressure: "",
        flow: s1.toFixed(3), seconds: "120", volume: "0", weight: "0",
        limiter: { value: p1.toFixed(2), range: Math.max(0.1, p1 * 0.1).toFixed(2) }
      },
      {
        name: `S2 real ${c.stage2Flow.toFixed(2)} g/s`,
        temperature: c.temperature.toFixed(1), sensor: "coffee", pump: "flow", transition: "fast", pressure: "",
        flow: s2.toFixed(3), seconds: "180", volume: "0", weight: "0",
        limiter: { value: p2.toFixed(2), range: Math.max(0.1, p2 * 0.1).toFixed(2) }
      }
    ];
    if (shape.enabled) {
      steps.push(
        {
          name: `S3 EARLY real ${c.stage3Flow.toFixed(2)} g/s`,
          temperature: c.temperature.toFixed(1), sensor: "coffee", pump: "flow", transition: "fast", pressure: "",
          flow: clampCommandFlow(shape.earlyCommand).toFixed(3), seconds: clampNumber(shape.earlySeconds,3,30,8).toFixed(1), volume: "0", weight: "0",
          limiter: { value: p3.toFixed(2), range: Math.max(0.1, p3 * 0.1).toFixed(2) }
        },
        {
          name: `S3 MID real ${c.stage3Flow.toFixed(2)} g/s`,
          temperature: c.temperature.toFixed(1), sensor: "coffee", pump: "flow", transition: "fast", pressure: "",
          flow: clampCommandFlow(shape.midCommand).toFixed(3), seconds: clampNumber(shape.midSeconds,3,30,14).toFixed(1), volume: "0", weight: "0",
          limiter: { value: p3.toFixed(2), range: Math.max(0.1, p3 * 0.1).toFixed(2) }
        },
        {
          name: `S3 LATE real ${c.stage3Flow.toFixed(2)} g/s`,
          temperature: c.temperature.toFixed(1), sensor: "coffee", pump: "flow", transition: "fast", pressure: "",
          flow: clampCommandFlow(shape.lateCommand).toFixed(3), seconds: "180", volume: "0", weight: "0",
          limiter: { value: p3.toFixed(2), range: Math.max(0.1, p3 * 0.1).toFixed(2) }
        }
      );
    } else {
      steps.push({
        name: `S3 real ${c.stage3Flow.toFixed(2)} g/s`,
        temperature: c.temperature.toFixed(1), sensor: "coffee", pump: "flow", transition: "fast", pressure: "",
        flow: s3.toFixed(3), seconds: "180", volume: "0", weight: "0",
        limiter: { value: p3.toFixed(2), range: Math.max(0.1, p3 * 0.1).toFixed(2) }
      });
    }
    if (steps.length > LIMITS.maxProfileFrames) throw new Error(`HyperEx profile would contain ${steps.length} frames; DE1 limit is ${LIMITS.maxProfileFrames}`);
    return {
      title: c.profileTitle,
      author: "ladiosupp / HyperEx",
      notes: `DE1XL v1.50 HyperEx pulse filtration. User flow settings mean desired cup-scale mass flow (g/s). ${calNote} Stable skip topology: one restart skip to S2 and one 40 g skip to S3. Optional S3 DECAY COMP uses only natural profile-time transitions inside S3; no extra plugin skipStep calls. Final stop is by Idle. Current-shot regression is advisory only.`,
      beverage_type: "espresso",
      steps,
      tank_temperature: "0", target_weight: "0", target_volume: "0", target_volume_count_start: "0",
      legacy_profile_type: "settings_2c", type: "flow", lang: "en", hidden: "0",
      reference_file: "hyperex_pulse_filter", changes_since_last_espresso: "", version: "2"
    };
  }

  function calibrationProfileObject(mode) {
    const c = state.cfg;
    const normalizedMode = normalizeCalibrationMode(mode || state.calibrationMode);
    const wp = calibrationWaterPlan(normalizedMode);
    const program = calibrationProgram(normalizedMode);
    const calPressure = clampNumber(6.0, LIMITS.pressureMin, Math.min(LIMITS.pressureMax, c.hardPressureLimit), Math.min(6.0, c.hardPressureLimit));
    const calibrationFrameCount = program.length + (wp.primeSeconds > 0 ? 1 : 0);
    if (calibrationFrameCount > LIMITS.maxProfileFrames) throw new Error(`Calibration profile would contain ${calibrationFrameCount} frames; DE1 limit is ${LIMITS.maxProfileFrames}`);
    return {
      title: calibrationProfileTitle(normalizedMode),
      author: "ladiosupp / HyperEx",
      notes: `EMPTY BASKET ONLY. HyperEx v0.1.59 ${wp.modeLabel} real-flow calibration. Prime ${wp.primeFlow.toFixed(2)} ml/s × ${wp.primeSeconds.toFixed(1)} s, then ${wp.steps} ${wp.algorithm === "target-lut" ? "target-search" : "calibration"} plateaus × ${wp.stepSeconds.toFixed(1)} s; nominal DE1 commanded water ≈${wp.nominalCommandWaterMl} ml. Use a ${wp.recommendedContainerMl} ml or larger catch vessel. The plugin actively stops calibration at about ${wp.hardStopG} g actual collected water to preserve margin below 300 ml. Tank level is checked before PREPARE when live DE1 water-level telemetry is available. Tare the scale, start Espresso manually, and leave the vessel in place until Idle.`,
      beverage_type: "espresso",
      steps: [
        ...(wp.primeSeconds > 0 ? [{
          name: `CAL PRIME - ${wp.primeFlow.toFixed(2)} ml/s`,
          temperature: c.temperature.toFixed(1), sensor: "coffee", pump: "flow", transition: "fast", pressure: "",
          flow: wp.primeFlow.toFixed(2), seconds: wp.primeSeconds.toFixed(1), volume: "0", weight: "0",
          limiter: { value: calPressure.toFixed(2), range: Math.max(0.1, calPressure * 0.1).toFixed(2) }
        }] : []),
        ...program.map((step, i) => ({
          name: wp.algorithm === "target-lut"
            ? `CAL ${step.blockId} target ${Number(step.targetReal).toFixed(1)} - cmd ${Number(step.commandFlow).toFixed(2)}`
            : `CAL ${wp.modeLabel.toUpperCase()} ${i + 1}/${program.length} - ${Number(step.commandFlow).toFixed(2)} ml/s`,
          temperature: c.temperature.toFixed(1), sensor: "coffee", pump: "flow", transition: "fast", pressure: "",
          flow: Number(step.commandFlow).toFixed(2), seconds: Number(step.seconds).toFixed(1), volume: "0", weight: "0",
          limiter: { value: calPressure.toFixed(2), range: Math.max(0.1, calPressure * 0.1).toFixed(2) }
        }))
      ],
      tank_temperature: "0", target_weight: "0", target_volume: "0", target_volume_count_start: "0",
      legacy_profile_type: "settings_2c", type: "flow", lang: "en", hidden: "0",
      reference_file: `hyperex_flow_calibration_${wp.mode}`, changes_since_last_espresso: "", version: "2"
    };
  }

  async function api(path, options) {
    const response = await fetch(`${API}${path}`, options || {});
    if (!response.ok) {
      let body = "";
      try { body = await response.text(); } catch (_) {}
      throw new Error(`${options && options.method ? options.method : "GET"} ${path} -> HTTP ${response.status}${body ? `: ${body.slice(0, 240)}` : ""}`);
    }
    return response;
  }

  function canonicalProfileValue(value) {
    if (Array.isArray(value)) return value.map(canonicalProfileValue);
    if (value && typeof value === "object") {
      const out = {};
      for (const key of Object.keys(value).sort()) out[key] = canonicalProfileValue(value[key]);
      return out;
    }
    return value;
  }

  function profilesEquivalent(a, b) {
    // Compare the content Decaid actually retains, rather than import-only keys.
    // Source: decentespresso/decaid, lib/src/models/data/profile.dart
    const stored = profile => profile && typeof profile === 'object' ? {
      title:String(profile.title || ''), author:String(profile.author || ''), notes:String(profile.notes || ''),
      execution:normalizedProfileExecution(profile)
    } : null;
    try { return JSON.stringify(stored(a)) === JSON.stringify(stored(b)); }
    catch (_) { return false; }
  }

  function normalizedProfileExecution(profile) {
    if (!profile || typeof profile !== "object") return null;
    const num = value => {
      if (value === null || value === undefined || value === '') return null;
      const v = Number(value);
      return Number.isFinite(v) ? round(v, 5) : String(value);
    };
    const steps = Array.isArray(profile.steps) ? profile.steps.map(step => {
      const q = step || {};
      const pump = String(q.pump || '');
      return {
        name:String(q.name || ''), temperature:num(q.temperature), sensor:String(q.sensor || ''),
        pump, transition:String(q.transition || ''),
        // Flow steps do not serialize unused pressure, and pressure steps do not
        // serialize unused flow. Compare only the actuator used by that step.
        ...(pump === 'flow' ? {flow:num(q.flow)} : pump === 'pressure' ? {pressure:num(q.pressure)} : {flow:num(q.flow),pressure:num(q.pressure)}),
        seconds:num(q.seconds), volume:num(q.volume), weight:num(q.weight),
        limiter:q.limiter ? {value:num(q.limiter.value),range:num(q.limiter.range)} : null,
        // Exit conditions affect execution and MUST survive equivalence checks.
        exit:q.exit ? {type:String(q.exit.type || ''),condition:String(q.exit.condition || ''),value:num(q.exit.value)} : null
      };
    }) : [];
    return {
      beverage_type:String(profile.beverage_type || ''), steps,
      tank_temperature:num(profile.tank_temperature), target_weight:num(profile.target_weight),
      target_volume:num(profile.target_volume), target_volume_count_start:num(profile.target_volume_count_start),
      version:num(profile.version)
      // Decaid's Profile.toJson intentionally omits legacy_profile_type and type.
    };
  }

  function profileExecutionDifferences(actual, expected) {
    const differences = [];
    const visit = (a, e, field) => {
      if (JSON.stringify(a) === JSON.stringify(e)) return;
      if (a && e && typeof a === 'object' && typeof e === 'object' && Array.isArray(a) === Array.isArray(e)) {
        const keys = Array.from(new Set(Object.keys(e).concat(Object.keys(a))));
        for (const key of keys) visit(a[key],e[key],Array.isArray(e) ? `${field}[${key}]` : (field ? `${field}.${key}` : key));
      } else differences.push({field:field || 'profile',expected:e === undefined ? null : e,actual:a === undefined ? null : a});
    };
    visit(normalizedProfileExecution(actual),normalizedProfileExecution(expected),'');
    if (String(actual && actual.title || '') !== String(expected && expected.title || '')) differences.unshift({field:'title',expected:expected && expected.title || null,actual:actual && actual.title || null});
    return differences;
  }

  function profileExecutionEquivalent(a, b) {
    try {
      return JSON.stringify(normalizedProfileExecution(a)) === JSON.stringify(normalizedProfileExecution(b));
    } catch (_) {
      return false;
    }
  }

  function profileCommandSummaryFromProfile(profile) {
    if (!profile || !Array.isArray(profile.steps) || profile.steps.length < 3) return null;
    const flow = step => { const v = Number(step && step.flow); return Number.isFinite(v) ? round(v, 3) : null; };
    const steps = profile.steps;
    const s3steps = steps.slice(2);
    const shape = s3steps.length >= 3;
    return {
      title: String(profile.title || ""),
      stage1CommandMlS: flow(steps[0]),
      stage2CommandMlS: flow(steps[1]),
      stage3Mode: shape ? "shape" : "flat",
      stage3CommandMlS: shape ? flow(s3steps[1]) : flow(s3steps[0]),
      s3Shape: shape ? {
        enabled: true,
        earlyCommand: flow(s3steps[0]), earlySeconds: round(Number(s3steps[0] && s3steps[0].seconds),1),
        midCommand: flow(s3steps[1]), midSeconds: round(Number(s3steps[1] && s3steps[1].seconds),1),
        lateCommand: flow(s3steps[2])
      } : { enabled:false }
    };
  }

  function runtimeProfileTruthPayload() {
    const expected = state.cfg ? profileObject() : null;
    const actual = state.workflowProfile;
    return {
      selectedTitle: state.workflowTitle || "",
      verified: !!state.runtimeProfileVerified,
      readbackAt: state.profileReadbackAt,
      machineUploadAcknowledged: !!state.machineProfileAckKey,
      machineProfileIndependentlyReadBack: false,
      status: state.runtimeProfileStatus || "not verified",
      expected: expected ? profileCommandSummaryFromProfile(expected) : null,
      actual: actual ? profileCommandSummaryFromProfile(actual) : null,
      differences: expected ? profileExecutionDifferences(actual, expected) : []
    };
  }

  async function readWorkflowProfile() {
    const response = await api('/workflow', { method: 'GET' });
    const body = await response.json();
    state.profileReadbackAt = new Date().toISOString();
    return body && body.profile && typeof body.profile === 'object' ? body.profile : null;
  }

  function invalidateProfileTruth(reason, clearMachineAck) {
    state.runtimeProfileVerified = false;
    state.armed = false;
    state.runtimeProfileStatus = reason || 'verification required';
    if (clearMachineAck) state.machineProfileAckKey = "";
  }

  function noteMultiplierChange(value) {
    const previous = finiteOrNull(state.flowMultiplierCurrent);
    if (previous !== null && Math.abs(previous - value) > 0.0001) {
      state.adaptiveHistory = [];
      state.persistentHistoryCompatibleCount = 0;
      invalidateProfileTruth('flowMultiplier changed; fresh verification required', true);
      if (state.diagnosticCurrent && state.diagnosticCurrent.kind === 'hyperex') state.diagnosticCurrent.config.profileTruthVerified = false;
    }
  }

  function profileSyncIsIdle() {
    return state.phase === 'idle' && !state.calibrationActive && state.lastMachineState !== 'espresso';
  }

  function workflowBrewTemperature(profile) {
    if(!state.cfg||!profile||profile.title!==state.cfg.profileTitle||!Array.isArray(profile.steps)||profile.steps.length<3||profile.steps.length>LIMITS.maxProfileFrames)return null;
    const temps=profile.steps.map(step=>finiteOrNull(step&&step.temperature));
    if(temps.some(v=>v===null||v<LIMITS.temperatureMin||v>LIMITS.temperatureMax))return null;
    const value=temps[0];
    return temps.every(v=>Math.abs(v-value)<0.001)?value:null;
  }

  function adoptWorkflowBrewTemperature(profile,fromNotification) {
    if(!profileSyncIsIdle())return false; // Never change an active shot's frozen temperature.
    const value=workflowBrewTemperature(profile);
    if(value===null||Math.abs(value-state.cfg.temperature)<0.001)return false;
    const previous=state.cfg.temperature;
    state.cfg.temperature=value;
    refreshLearningStage();
    if(fromNotification){
      // Also cancel in-flight sync of an older temperature before its next write.
      state.workflowSelectionRevision++;
      state.temperatureRecheckNeeded=true;
    }
    log(`Home/profile brew temperature accepted: ${previous} -> ${value} °C; fresh verification required.`);
    return true;
  }

  function recheckHomeTemperatureIfNeeded() {
    if(!state.temperatureRecheckNeeded||state.runtimeProfileRepairBusy||state.profileVerificationPending||!profileSyncIsIdle())return;
    state.temperatureRecheckNeeded=false;state.profileVerificationRetryAtMs=0;
    scheduleProfileVerification('home temperature changed during synchronization');
  }

  function checkProfileSelection(revision) {
    if (!profileSyncIsIdle()) throw new Error('Profile sync blocked while shot or calibration is active');
    if (state.workflowTitle !== state.cfg.profileTitle || state.workflowSelectionRevision !== revision) throw new Error('Workflow selection changed during verification');
  }

  function checkProfileSyncContext(profile, revision) {
    checkProfileSelection(revision);
    if (!profileExecutionEquivalent(profile, profileObject())) throw new Error('Expected profile changed during verification; retry required');
  }

  async function verifyAndRepairSelectedHyperExProfile(reason) {
    if (!state.cfg || state.workflowTitle !== state.cfg.profileTitle) return;
    return syncHyperExProfile(true, reason || 'workflow verification');
  }

  function scheduleProfileVerification(reason) {
    if (!state.cfg || state.workflowTitle !== state.cfg.profileTitle || state.runtimeProfileRepairBusy || state.profileVerificationPending || Date.now() < state.profileVerificationRetryAtMs || !profileSyncIsIdle()) return;
    state.profileVerificationPending = true;
    state.profileVerificationRetryAtMs = Date.now() + 3000;
    verifyAndRepairSelectedHyperExProfile(reason).catch(error => {
      invalidateProfileTruth(`verification failed: ${error.message || error}`, true);
      log(state.runtimeProfileStatus);
      emitSkinChanged();
    }).finally(() => { state.profileVerificationPending = false; recheckHomeTemperatureIfNeeded(); });
  }

  async function upsertProfile(profile) {
    const title = profile && profile.title ? String(profile.title) : "";
    if (!title) throw new Error("profile title missing");
    let records = [];
    try {
      const listResponse = await api('/profiles?includeHidden=true', { method: 'GET' });
      const body = await listResponse.json();
      if (Array.isArray(body)) records = body;
    } catch (error) {
      log(`Profile list read failed before upsert '${title}': ${error.message || error}`);
    }
    const matching = records.filter(r => r && r.profile && String(r.profile.title || '') === title && r.visibility !== 'deleted');
    if (matching.length) {
      const exact = matching.find(r => profilesEquivalent(r.profile, profile));
      if (exact) {
        log(`Profile '${title}' already current; Decaid write skipped.`);
        return exact;
      }
      const chosen = matching.find(r => !r.isDefault) || matching[0];
      const response = await api(`/profiles/${encodeURIComponent(chosen.id)}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile })
      });
      const updated = await response.json();
      return updated;
    }
    const response = await api('/profiles', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile })
    });
    return await response.json();
  }

  async function ensureProfileInstalled() {
    try { await syncHyperExProfile(false); }
    catch (error) { state.profileSyncStatus = `HyperEx profile sync failed: ${error.message || error}`; log(state.profileSyncStatus); }
  }

  async function hideLegacyCalibrationProfile() {
    const legacyTitle = state.cfg ? String(state.cfg.calibrationProfileTitle || "") : "";
    if (!legacyTitle || isCalibrationProfileTitle(legacyTitle)) return;
    try {
      const listResponse = await api('/profiles?includeHidden=true', { method: 'GET' });
      const records = await listResponse.json();
      if (!Array.isArray(records)) return;
      const legacy = records.filter(r => r && r.profile && String(r.profile.title || '') === legacyTitle && r.visibility === 'visible');
      for (const rec of legacy) {
        if (!rec.id) continue;
        await api(`/profiles/${encodeURIComponent(rec.id)}/visibility`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visibility: 'hidden' })
        });
        log(`Legacy single calibration profile '${legacyTitle}' hidden after dual-profile migration.`);
      }
    } catch (error) {
      log(`Legacy calibration profile migration skipped: ${error.message || error}`);
    }
  }

  async function ensureCalibrationProfilesInstalled() {
    for (const mode of ['low', 'full']) {
      try {
        const profile = calibrationProfileObject(mode);
        const rec = await upsertProfile(profile);
        state.calibrationProfileIds[mode] = rec && rec.id ? rec.id : state.calibrationProfileIds[mode];
        log(`Calibration profile '${profile.title}' installed/updated.`);
      } catch (error) {
        log(`Calibration profile ${calibrationModeConfig(mode).label} auto-install failed: ${error.message || error}`);
      }
    }
    await hideLegacyCalibrationProfile();
  }

  function syncHyperExProfile(updateCurrentWorkflow, reason) {
    if (!profileSyncIsIdle()) return Promise.reject(new Error('Profile writes blocked during an active shot'));
    if (updateCurrentWorkflow && state.workflowTitle === (state.cfg && state.cfg.profileTitle)) invalidateProfileTruth('waiting for fresh workflow readback', false);
    const task = state.profileSyncQueue.catch(() => {}).then(() => performHyperExProfileSync(updateCurrentWorkflow, reason));
    state.profileSyncQueue = task.catch(() => {});
    return task;
  }

  async function requireIdleMachineForProfileSync() {
    const machine = extractMachine(await getMachineSnapshot());
    if (!machine.machineState || machine.machineState === 'espresso') throw new Error('Machine is busy or state is unavailable; profile writes blocked');
    if (!profileSyncIsIdle()) throw new Error('Shot began during profile verification');
  }

  async function performHyperExProfileSync(updateCurrentWorkflow, reason) {
    if (!profileSyncIsIdle()) throw new Error('Profile writes blocked during an active shot');
    const selected = !!(updateCurrentWorkflow && state.workflowTitle === state.cfg.profileTitle);
    const revision = state.workflowSelectionRevision;
    state.runtimeProfileRepairBusy = selected;
    try {
      if (selected) {
        invalidateProfileTruth('checking fresh workflow / multiplier readback', false);
        await requireIdleMachineForProfileSync();
        checkProfileSelection(revision);
        if (!state.calibrationStorageLoaded || !state.overrideStorageLoaded || !state.scopeStorageLoaded || !state.scopedOriginalStorageLoaded || !state.learningContextLoaded) throw new Error('Waiting for stored calibration and overrides / multiplier scope / history context');
        if (state.scopeMode === 'hyperex') {
          if (state.scopeChangeBusy) throw new Error('Scoped multiplier change still pending');
          await enterHyperExScopedMultiplier('profile verification', revision);
          checkProfileSelection(revision);
        }
        const multiplier = await refreshFlowMultiplier(true, true);
        recomputeCalibrationUsability();
        if (!state.calibrationMapUsable || !multiplierClose(multiplier, calibrationBaseMultiplier())) throw new Error('Valid LUT and matching actual multiplier required before arming');
      }
      recomputeCalibrationUsability();
      // Read the selected workflow BEFORE generating/upserting a replacement.
      // The home page persists its temperature in the profile itself; no second store.
      let actual=null;
      if(selected){
        actual=await readWorkflowProfile();checkProfileSelection(revision);
        if(!actual||actual.title!==state.cfg.profileTitle)throw new Error('GET /workflow no longer selects HyperEx');
        adoptWorkflowBrewTemperature(actual,false);
      }
      const profile = profileObject();
      if (selected) checkProfileSyncContext(profile, revision);
      const rec = await upsertProfile(profile);
      state.hyperExProfileId = rec && rec.id ? rec.id : state.hyperExProfileId;
      if (selected) {
        checkProfileSyncContext(profile, revision);
        state.workflowProfile = actual;
        checkProfileSyncContext(profile, revision);
        if (!actual || actual.title !== state.cfg.profileTitle) throw new Error('GET /workflow no longer selects HyperEx');
        const changed = !profileExecutionEquivalent(actual, profile);
        if (changed) {
          state.machineProfileAckKey = "";
          await requireIdleMachineForProfileSync();
          checkProfileSyncContext(profile, revision);
          await api('/workflow', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({profile}) });
          checkProfileSyncContext(profile, revision);
        }
        const key = JSON.stringify(normalizedProfileExecution(profile));
        if (changed || state.machineProfileAckKey !== key) {
          // HTTP success acknowledges upload; this is not independent DE1 memory readback.
          await requireIdleMachineForProfileSync();
          checkProfileSyncContext(profile, revision);
          await api('/machine/profile', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(profile) });
          checkProfileSyncContext(profile, revision);
          state.machineProfileAckKey = key;
        }
        const readback = await readWorkflowProfile();
        state.workflowProfile = readback;
        checkProfileSyncContext(profile, revision);
        if (!readback || readback.title !== state.cfg.profileTitle || !profileExecutionEquivalent(readback, profile)) {
          const differences = profileExecutionDifferences(readback, profile);
          log(`Workflow execution mismatch details: ${JSON.stringify(differences)}`);
          const detail = differences.slice(0,6).map(d => `${d.field}: expected ${JSON.stringify(d.expected)}, actual ${JSON.stringify(d.actual)}`).join('; ');
          throw new Error(`Final GET /workflow does not match expected LUT/adaptive profile${detail ? ': '+detail : ''}`);
        }
        const multiplier = await refreshFlowMultiplier(true, true);
        checkProfileSyncContext(profile, revision);
        if (!multiplierClose(multiplier, calibrationBaseMultiplier()) || state.machineProfileAckKey !== key) throw new Error('Multiplier or machine upload acknowledgement changed during verification');
        state.temperatureRecheckNeeded=false;
        state.runtimeProfileVerified = true;
        state.profileReadbackAt = new Date().toISOString();
        state.runtimeProfileStatus = `GET /workflow verified; machine upload acknowledged (${reason || 'sync'})`;
        state.runtimeProfileMismatchAbortSent = false;
        state.armed = !!state.cfg.enabled;
        restoreAdaptiveHistoryFromPersistentFile();
      }
      state.profileSyncStatus = `HyperEx profile synced ${new Date().toISOString()}`;
      emitSkinChanged();
      return rec;
    } catch (error) {
      if (selected) invalidateProfileTruth(`verification failed: ${error.message || error}`, true);
      state.profileSyncStatus = `HyperEx sync failed: ${error.message || error}`;
      emitSkinChanged();
      throw error;
    } finally { state.runtimeProfileRepairBusy = false; recheckHomeTemperatureIfNeeded(); }
  }

  async function prepareCalibrationProfile(options) {
    const opts = options && typeof options === 'object' ? options : {};
    const preflight = waterPreflightStatus();
    if (preflight.status === 'block') throw new Error(`Water preflight blocked: ${preflight.message}`);
    if (preflight.status === 'unknown' && opts.allowUnknownWater !== true) throw new Error(`Water preflight unavailable: ${preflight.message}`);
    if (preflight.status === 'warn' && opts.allowLowMargin !== true) throw new Error(`Water preflight warning: ${preflight.message}`);
    state.calibrationWaterPreflightApprovedUntilMs = Date.now() + 10 * 60 * 1000;
    const current = await refreshFlowMultiplier(true);
    let base = finiteOrNull(state.calibrationPendingMultiplier);
    if (!Number.isFinite(base)) base = Number(current);
    if (!Number.isFinite(base)) throw new Error('Cannot determine current DE1 flowMultiplier');
    state.calibrationPendingMultiplier = base;
    storageWrite(STORAGE_PENDING_MULT, String(base));

    // HyperEx-only scope may temporarily move the machine to the pending calibration
    // multiplier. OFF never writes it; GLOBAL uses whatever is already globally set.
    if (state.scopeMode === 'hyperex') {
      if (finiteOrNull(state.scopedOriginalMultiplier) === null) { state.scopedOriginalMultiplier = current; storageWrite(STORAGE_SCOPED_ORIGINAL, String(current)); }
      await writeFlowMultiplier(base, 'prepare Flow Calibration');
      state.scopedAppliedMultiplier = base;
    }

    const selectedMode = normalizeCalibrationMode(state.calibrationMode);
    const profile = calibrationProfileObject(selectedMode);
    const rec = await upsertProfile(profile);
    state.calibrationProfileIds[selectedMode] = rec && rec.id ? rec.id : state.calibrationProfileIds[selectedMode];
    await api('/workflow', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile })
    });
    state.workflowTitle = profile.title;
    state.calibrationArmed = true;
    state.armed = false;
    emitSkinChanged();
    { const wp = calibrationWaterPlan(selectedMode); log(`Calibration profile '${profile.title}' selected. EMPTY BASKET: prime ${wp.primeFlow} ml/s × ${wp.primeSeconds}s + ${calibrationCommands().length} measured plateaus; nominal command water ≈${wp.nominalCommandWaterMl} ml; use >=${wp.recommendedContainerMl} ml catch vessel. Tare scale, then start Espresso manually and let all plateaus finish (unless the actual-water safety stop is reached).`); }
    return calibrationStatusPayload();
  }

  async function requestMachineState(machineState) {
    diagnosticEvent("command_request", { machineState });
    await api(`/machine/state/${machineState}`, { method: "PUT" });
    diagnosticEvent("command_accepted", { machineState });
    diagnosticSample(`command:${machineState}`, true);
    log(`Machine command accepted: ${machineState}`);
  }

  async function getMachineSnapshot() {
    const response = await api(`/machine/state`, { method: "GET" });
    return await response.json();
  }

  function extractMachine(payload) {
    const p = payload || {};
    const m = p.machine || p;
    const nestedState = m.state && typeof m.state === "object" ? m.state : (p.state && typeof p.state === "object" ? p.state : null);
    const machineState = nestedState ? nestedState.state : (typeof p.machineState === "string" ? p.machineState : (typeof p.state === "string" ? p.state : null));
    const substate = nestedState ? nestedState.substate : (p.machineSubstate || p.substate || null);
    return {
      machineState,
      substate,
      pressure: n(m.pressure !== undefined ? m.pressure : p.pressure, 0),
      telemetryValid: finiteOrNull(m.pressure !== undefined ? m.pressure : p.pressure)!==null && finiteOrNull(m.flow !== undefined ? m.flow : p.flow)!==null,
      flow: n(m.flow !== undefined ? m.flow : p.flow, 0),
      targetFlow: Number.isFinite(Number(m.targetFlow !== undefined ? m.targetFlow : p.targetFlow)) ? Number(m.targetFlow !== undefined ? m.targetFlow : p.targetFlow) : null,
      targetPressure: Number.isFinite(Number(m.targetPressure !== undefined ? m.targetPressure : p.targetPressure)) ? Number(m.targetPressure !== undefined ? m.targetPressure : p.targetPressure) : null,
      machineWeightFlow: Number.isFinite(Number(m.weightFlow !== undefined ? m.weightFlow : p.weightFlow)) ? Number(m.weightFlow !== undefined ? m.weightFlow : p.weightFlow) : null,
      profileFrame: m.profileFrame !== undefined ? m.profileFrame : (p.profileFrame !== undefined ? p.profileFrame : null)
    };
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
    // Common timestamp units: ns, us, ms, or s. For small monotonic
    // timestamps, fractional values are treated as seconds.
    if (a >= 1e17) return v / 1e9;
    if (a >= 1e14) return v / 1e6;
    if (a >= 1e11) return v / 1e3;
    if (a >= 1e9) return v;
    return v;
  }

  function captureRawScaleSample(snapshot, weight, decaidWeightFlow, receivedAtMs) {
    const run = state.diagnosticCurrent;
    const sourceTimestamp = snapshot && snapshot.timestamp !== undefined ? snapshot.timestamp : null;
    const timestampSeconds = scaleTimestampSeconds(sourceTimestamp);
    let rawDwDt = null;
    let tareReset = false;

    if (run && Array.isArray(run.rawScaleSamples) && run.rawScaleSamples.length) {
      const prev = run.rawScaleSamples[run.rawScaleSamples.length - 1];
      const drop = Number(prev.weightG) - weight;
      tareReset = Number.isFinite(drop) && state.cfg && drop >= state.cfg.scaleResetThreshold;
      const dt = Number.isFinite(timestampSeconds) && Number.isFinite(Number(prev.scaleTimestampSeconds))
        ? timestampSeconds - Number(prev.scaleTimestampSeconds) : null;
      if (!tareReset && Number.isFinite(dt) && dt > 0 && dt <= 10) {
        rawDwDt = (weight - Number(prev.weightG)) / dt;
      }
    }

    state.latestRawDwDt = Number.isFinite(rawDwDt) ? rawDwDt : null;
    if (!run) return;
    run.rawScaleSamples.push({
      tMs: Math.max(0, receivedAtMs - run.startedAtMs),
      phase: state.phase,
      profileFrame: state.lastFrame,
      targetFlowMlS: round(state.lastTargetFlow, 4),
      machineFlowMlS: round(state.lastFlow, 4),
      pressureBar: round(state.lastPressure, 4),
      scaleTimestamp: sourceTimestamp,
      scaleTimestampSeconds: Number.isFinite(timestampSeconds) ? round(timestampSeconds, 6) : null,
      weightG: round(weight, 4),
      rawDwDtGS: Number.isFinite(rawDwDt) ? round(rawDwDt, 4) : null,
      decaidWeightFlowGS: Number.isFinite(decaidWeightFlow) ? round(decaidWeightFlow, 4) : null,
      tareReset
    });
    if (run.rawScaleSamples.length > 12000) run.rawScaleSamples.shift();
  }


  function clearScaleReconnectTimer() {
    if (state.scaleReconnectTimer !== null) {
      clearTimeout(state.scaleReconnectTimer);
      state.scaleReconnectTimer = null;
    }
  }

  function scheduleScaleReconnect(delayMs) {
    clearScaleReconnectTimer();
    state.scaleReconnectTimer = setTimeout(() => {
      state.scaleReconnectTimer = null;
      connectScaleStream();
    }, Math.max(250, delayMs || 1000));
  }

  function onScaleSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== "object") return;
    if (snapshot.status === "connected") {
      if (!state.scaleConnected) log("Scale snapshot stream reports connected.");
      state.scaleConnected = true;
      return;
    }
    if (snapshot.status === "disconnected") {
      state.scaleConnected = false;
      log("Scale snapshot stream reports disconnected.");
      return;
    }

    const weight = Number(snapshot.weight);
    if (!Number.isFinite(weight)) return;
    const weightFlow = Number(snapshot.weightFlow);
    const receivedAtMs = Date.now();
    state.scaleConnected = true;
    state.latestRawWeight = weight;
    state.latestWeightFlow = Number.isFinite(weightFlow) ? weightFlow : 0;
    state.latestScaleAtMs = receivedAtMs;
    state.latestScaleTimestamp = snapshot.timestamp !== undefined ? snapshot.timestamp : null;
    state.lastWeightFlow = state.latestWeightFlow;
    captureRawScaleSample(snapshot, weight, Number.isFinite(weightFlow) ? weightFlow : null, receivedAtMs);

    if (state.phase === "idle" || state.phase === "aborted") return;

    updateCumulativeWeight(weight);
    diagnosticSample("scale", false);

    if (state.phase === "stage1" && state.cumulativeWeight >= state.cfg.stage1Weight) {
      beginDump();
      return;
    }
    if (state.phase === "stage2") {
      if (state.cumulativeWeight >= state.cfg.finalWeight) {
        finishSequence();
        return;
      }
      if (state.cumulativeWeight >= state.cfg.stage2Weight) {
        beginStage3LowFlow();
        return;
      }
    }
    if (state.phase === "stage3" && state.cumulativeWeight >= state.cfg.finalWeight) {
      finishSequence();
    }
  }

  function handleScaleTransportEvent(event) {
    if (!event) return;
    if (event.type === "data") {
      try {
        const payload = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        onScaleSnapshot(payload);
      } catch (error) {
        log(`Scale snapshot parse error: ${error.message || error}`);
      }
      return;
    }
    if (event.type === "close" || event.type === "error") {
      state.scaleConnected = false;
      state.scaleHandle = null;
      log(`Scale snapshot stream ${event.type}; reconnecting.`);
      scheduleScaleReconnect(1000);
    }
  }

  function connectScaleStream() {
    if (state.scaleHandle !== null) return;
    clearScaleReconnectTimer();
    host.transport.open({kind: "websocket", url: SCALE_WS})
      .then((opened) => {
        if (!opened || !opened.handle) throw new Error("scale websocket opened without a handle");
        state.scaleHandle = opened.handle;
        host.transport.onEvent(opened.handle, handleScaleTransportEvent);
        log("Connected to Decaid scale snapshot stream.");
      })
      .catch((error) => {
        state.scaleHandle = null;
        state.scaleConnected = false;
        log(`Scale snapshot stream connection failed: ${error.message || error}; retrying.`);
        scheduleScaleReconnect(1000);
      });
  }

  function closeScaleStream() {
    clearScaleReconnectTimer();
    const handle = state.scaleHandle;
    state.scaleHandle = null;
    state.scaleConnected = false;
    if (handle !== null) {
      host.transport.close(handle).catch(() => {});
    }
  }

  function clearWaterReconnectTimer() {
    if (state.waterReconnectTimer !== null) {
      clearTimeout(state.waterReconnectTimer);
      state.waterReconnectTimer = null;
    }
  }

  function scheduleWaterReconnect(delayMs) {
    clearWaterReconnectTimer();
    state.waterReconnectTimer = setTimeout(() => {
      state.waterReconnectTimer = null;
      connectWaterLevelStream();
    }, Math.max(500, delayMs || 1500));
  }

  function waterPreflightStatus() {
    const cfg = calibrationModeConfig();
    const current = finiteOrNull(state.waterCurrentLevelMm);
    const refill = finiteOrNull(state.waterRefillLevelMm);
    const ageMs = state.waterLevelAtMs > 0 ? Date.now() - state.waterLevelAtMs : null;
    const fresh = current !== null && refill !== null && ageMs !== null && ageMs <= 5000;
    if (!fresh) {
      return {
        status: 'unknown', available: false, fresh: false,
        currentLevelMm: round(current, 2), refillLevelMm: round(refill, 2),
        marginMm: current !== null && refill !== null ? round(current - refill, 2) : null,
        ageMs,
        message: 'Live DE1 tank level is unavailable or stale. Manually verify the tank before calibration.'
      };
    }
    const margin = current - refill;
    if (current <= refill || margin < Number(cfg.waterBlockMarginMm || 0)) {
      return {
        status: 'block', available: true, fresh: true,
        currentLevelMm: round(current, 2), refillLevelMm: round(refill, 2), marginMm: round(margin, 2), ageMs,
        message: `Tank margin is too small for ${cfg.label}. Refill the tank before calibration.`
      };
    }
    if (margin < Number(cfg.waterWarnMarginMm || 0)) {
      return {
        status: 'warn', available: true, fresh: true,
        currentLevelMm: round(current, 2), refillLevelMm: round(refill, 2), marginMm: round(margin, 2), ageMs,
        message: `Tank is above the DE1 refill threshold but the remaining height margin is only ${round(margin,1)} mm. Refill is recommended.`
      };
    }
    return {
      status: 'ok', available: true, fresh: true,
      currentLevelMm: round(current, 2), refillLevelMm: round(refill, 2), marginMm: round(margin, 2), ageMs,
      message: `Tank level margin is ${round(margin,1)} mm above the refill threshold.`
    };
  }

  function handleWaterTransportEvent(event) {
    if (!event) return;
    if (event.type === 'data') {
      try {
        const payload = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (!payload || typeof payload !== 'object') return;
        const current = Number(payload.currentLevel);
        const refill = Number(payload.refillLevel);
        if (Number.isFinite(current) && Number.isFinite(refill)) {
          state.waterCurrentLevelMm = current;
          state.waterRefillLevelMm = refill;
          state.waterLevelAtMs = Date.now();
          state.waterLevelConnected = true;
        }
      } catch (error) {
        log(`Water-level parse error: ${error.message || error}`);
      }
      return;
    }
    if (event.type === 'close' || event.type === 'error') {
      state.waterLevelConnected = false;
      state.waterHandle = null;
      scheduleWaterReconnect(1500);
    }
  }

  function connectWaterLevelStream() {
    if (state.waterHandle !== null) return;
    clearWaterReconnectTimer();
    host.transport.open({kind: 'websocket', url: WATER_WS})
      .then(opened => {
        if (!opened || !opened.handle) throw new Error('water-level websocket opened without a handle');
        state.waterHandle = opened.handle;
        state.waterLevelConnected = true;
        host.transport.onEvent(opened.handle, handleWaterTransportEvent);
        log('Connected to Decaid DE1 water-level stream.');
      })
      .catch(error => {
        state.waterHandle = null;
        state.waterLevelConnected = false;
        log(`DE1 water-level stream connection failed: ${error.message || error}; retrying.`);
        scheduleWaterReconnect(1500);
      });
  }

  function closeWaterLevelStream() {
    clearWaterReconnectTimer();
    const handle = state.waterHandle;
    state.waterHandle = null;
    state.waterLevelConnected = false;
    if (handle !== null) host.transport.close(handle).catch(() => {});
  }

  function averageFinite(values) {
    const a = values.map(Number).filter(Number.isFinite);
    return a.length ? a.reduce((sum, v) => sum + v, 0) / a.length : null;
  }

  function linearRegression(points) {
    const clean = points.filter(p => Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y)));
    if (clean.length < 3) return null;
    const mx = clean.reduce((s, p) => s + Number(p.x), 0) / clean.length;
    const my = clean.reduce((s, p) => s + Number(p.y), 0) / clean.length;
    let sxx = 0, sxy = 0, syy = 0;
    for (const p of clean) {
      const dx = Number(p.x) - mx, dy = Number(p.y) - my;
      sxx += dx * dx; sxy += dx * dy; syy += dy * dy;
    }
    if (sxx <= 0) return null;
    const slope = sxy / sxx;
    const intercept = my - slope * mx;
    const r2 = syy > 0 ? Math.max(0, Math.min(1, (sxy * sxy) / (sxx * syy))) : 1;
    return { slope, intercept, r2, n: clean.length };
  }

  function analyzeCalibrationRun(run, baseMultiplier) {
    const raw = run && Array.isArray(run.rawScaleSamples) ? run.rawScaleSamples : [];
    const plateauResults = [];
    const mode = normalizeCalibrationMode(run && run.config && run.config.calibrationMode || state.calibrationMode);
    const modeCfg = calibrationModeConfig(mode);
    const program = Array.isArray(run && run.config && run.config.calibrationProgram)
      ? run.config.calibrationProgram.map(x => ({
          blockId: String(x.blockId || ''), targetSource: String(x.targetSource || ''),
          targetReal: finiteOrNull(x.targetReal), commandFlow: Number(x.commandFlow),
          seconds: Number(x.seconds || modeCfg.stepSeconds),
          settleSeconds: Number(x.settleSeconds || modeCfg.settleSeconds),
          windowSeconds: Number(x.windowSeconds || modeCfg.windowSeconds)
        })).filter(x => Number.isFinite(x.commandFlow))
      : calibrationProgram(mode);
    const frameOffset = Number(modeCfg.primeSeconds || 0) > 0 ? 1 : 0;

    for (let i = 0; i < program.length; i += 1) {
      const step = program[i];
      const frame = i + frameOffset;
      const cmd = Number(step.commandFlow);
      const settleMs = Number(step.settleSeconds || modeCfg.settleSeconds) * 1000;
      const windowMs = Number(step.windowSeconds || modeCfg.windowSeconds) * 1000;
      const frameSamples = raw.filter(r => Number(r.profileFrame) === frame && Number.isFinite(Number(r.weightG)));
      if (!frameSamples.length) {
        plateauResults.push({ frame, blockId: step.blockId || '', targetReal: step.targetReal, commandFlow: cmd, valid: false, acceptedInMap: false, reason: 'no raw scale samples' });
        continue;
      }
      const firstT = Math.min(...frameSamples.map(r => Number(r.tMs)));
      const lastT = Math.max(...frameSamples.map(r => Number(r.tMs)));
      const startT = Math.max(firstT + settleMs, lastT - windowMs);
      const window = frameSamples.filter(r => Number(r.tMs) >= startT && !r.tareReset);
      const regPoints = window.map(r => ({
        x: Number.isFinite(Number(r.scaleTimestampSeconds)) ? Number(r.scaleTimestampSeconds) : Number(r.tMs) / 1000,
        y: Number(r.weightG)
      }));
      const reg = linearRegression(regPoints);
      const machineFlow = averageFinite(window.map(r => r.machineFlowMlS));
      const pressure = averageFinite(window.map(r => r.pressureBar));
      const decaid = averageFinite(window.map(r => r.decaidWeightFlowGS));
      const actual = reg ? reg.slope : null;
      const r2Min = modeCfg.algorithm === 'target-lut' ? 0.96 : 0.95;
      const valid = !!reg && reg.n >= 8 && Number.isFinite(actual) && actual > 0.05 && reg.r2 >= r2Min;
      plateauResults.push({
        frame, blockId: step.blockId || '', targetSource: step.targetSource || '', targetReal: round(step.targetReal, 3),
        commandFlow: cmd, actualFlow: round(actual, 4), machineFlow: round(machineFlow, 4),
        decaidWeightFlow: round(decaid, 4), pressure: round(pressure, 4), r2: reg ? round(reg.r2, 5) : null,
        samples: reg ? reg.n : window.length, fitStartMs: Math.round(startT), fitEndMs: Math.round(lastT),
        valid, acceptedInMap: false,
        reason: valid ? '' : (!reg ? 'insufficient fit' : reg.n < 8 ? `too few samples ${reg.n}` : reg.r2 < r2Min ? `low R2 ${round(reg.r2,3)}` : 'invalid/near-zero slope')
      });
    }

    // LOW WATER: build a target-focused three-anchor LUT. Each HyperEx target is
    // searched independently so transient behavior in one phase cannot make a
    // distant point look like a valid global interpolation bracket.
    if (modeCfg.algorithm === 'target-lut') {
      const anchors = [];
      const targetCoverage = [];
      const blocks = [];
      for (const step of program) {
        if (!step.blockId || blocks.some(b => b.id === step.blockId)) continue;
        blocks.push({ id: step.blockId, targetSource: step.targetSource || '', target: Number(step.targetReal) });
      }

      for (const block of blocks) {
        const target = Number(block.target);
        const candidates = plateauResults
          .filter(p => p.blockId === block.id && p.valid)
          .sort((a, b) => Number(a.commandFlow) - Number(b.commandFlow));
        const monotonic = [];
        for (const p of candidates) {
          if (!monotonic.length || Number(p.actualFlow) > Number(monotonic[monotonic.length - 1].actualFlow) + 0.03) {
            monotonic.push(p);
          } else {
            p.reason = `non-monotonic in ${block.id} vs ${round(monotonic[monotonic.length - 1].actualFlow,3)} g/s`;
          }
        }

        const nearTolerance = target >= 4 ? 0.40 : target >= 1.8 ? 0.25 : 0.20;
        const maxGap = target >= 4 ? 1.25 : target >= 1.8 ? 0.85 : 0.75;
        let nearest = null;
        for (const p of monotonic) {
          const err = Math.abs(Number(p.actualFlow) - target);
          if (!nearest || err < nearest.err) nearest = { p, err };
        }

        let lo = null, hi = null;
        for (const p of monotonic) {
          const y = Number(p.actualFlow);
          if (y <= target) lo = p;
          if (y >= target && !hi) hi = p;
        }

        let command = null, machineFlow = null, quality = null, source = [];
        if (lo && hi && lo !== hi) {
          const ya = Number(lo.actualFlow), yb = Number(hi.actualFlow);
          const gap = yb - ya;
          if (gap > 0 && gap <= maxGap) {
            const f = (target - ya) / gap;
            command = Number(lo.commandFlow) + f * (Number(hi.commandFlow) - Number(lo.commandFlow));
            if (Number.isFinite(Number(lo.machineFlow)) && Number.isFinite(Number(hi.machineFlow))) {
              machineFlow = Number(lo.machineFlow) + f * (Number(hi.machineFlow) - Number(lo.machineFlow));
            }
            quality = 'tight-bracket';
            source = [lo, hi];
          }
        }
        if (!Number.isFinite(command) && nearest && nearest.err <= nearTolerance) {
          command = Number(nearest.p.commandFlow);
          machineFlow = Number(nearest.p.machineFlow);
          quality = 'near-hit';
          source = [nearest.p];
        }

        for (const p of source) {
          p.acceptedInMap = true;
          p.reason = `${quality} source for ${block.id} ${round(target,2)} g/s`;
        }
        for (const p of monotonic) {
          if (!p.acceptedInMap && !p.reason) p.reason = `valid ${block.id} search point`;
        }

        const gap = lo && hi ? Number(hi.actualFlow) - Number(lo.actualFlow) : null;
        const ok = Number.isFinite(command);
        targetCoverage.push({
          blockId: block.id, targetSource: block.targetSource, target: round(target, 3), ok, quality,
          commandFlow: round(command, 4), nearestError: nearest ? round(nearest.err, 4) : null,
          lowerActual: lo ? lo.actualFlow : null, upperActual: hi ? hi.actualFlow : null,
          lowerCommand: lo ? lo.commandFlow : null, upperCommand: hi ? hi.commandFlow : null,
          gap: round(gap, 4), maxGap, nearTolerance
        });
        if (ok) {
          anchors.push({
            blockId: block.id, targetSource: block.targetSource,
            actualFlow: round(target, 4), commandFlow: round(command, 4), machineFlow: round(machineFlow, 4),
            r2: source.length ? round(Math.min(...source.map(p => Number(p.r2))), 5) : null,
            samples: source.length ? Math.min(...source.map(p => Number(p.samples || 0))) : null,
            quality
          });
        }
      }

      anchors.sort((a, b) => Number(a.actualFlow) - Number(b.actualFlow));
      let monotonicCommands = anchors.length >= 3;
      for (let i = 1; i < anchors.length; i += 1) {
        if (!(Number(anchors[i].commandFlow) > Number(anchors[i - 1].commandFlow) + 0.02)) monotonicCommands = false;
      }
      const coversTargets = blocks.length >= 3 && anchors.length === blocks.length && targetCoverage.every(x => x.ok) && monotonicCommands;

      let suggested = null, displayFactor = null;
      const displayPts = anchors.filter(p => Number.isFinite(Number(p.machineFlow)) && Number(p.machineFlow) > 0.12);
      if (coversTargets && Number.isFinite(Number(baseMultiplier)) && displayPts.length >= 3) {
        let num = 0, den = 0;
        for (const p of displayPts) {
          const x = Number(p.machineFlow), y = Number(p.actualFlow);
          num += x * y; den += x * x;
        }
        if (den > 0) {
          displayFactor = num / den;
          suggested = Math.max(0.13, Math.min(2.0, Number(baseMultiplier) * displayFactor));
        }
      }

      const actuals = anchors.map(p => Number(p.actualFlow));
      const map = {
        schema: 3,
        algorithm: 'v0.1.38-target-lut',
        createdAt: new Date().toISOString(), calibrationMode: mode,
        baseFlowMultiplier: round(baseMultiplier, 4), valid: coversTargets, coversTargets,
        targetCoverage, targetAnchors: anchors,
        actualRange: anchors.length ? [round(Math.min(...actuals), 4), round(Math.max(...actuals), 4)] : null,
        desiredRange: anchors.length ? [round(Math.min(...actuals), 4), round(Math.max(...actuals), 4)] : null,
        points: anchors.map(p => ({
          commandFlow: p.commandFlow, actualFlow: p.actualFlow, machineFlow: p.machineFlow,
          r2: p.r2, samples: p.samples, quality: p.quality, blockId: p.blockId, targetSource: p.targetSource
        })),
        suggestedFlowMultiplier: round(suggested, 4), displayScaleFactor: round(displayFactor, 4)
      };
      if (!monotonicCommands && anchors.length) {
        for (const x of targetCoverage) if (x.ok) x.warning = 'anchor commands are not strictly increasing';
      }
      return { valid: map.valid, map, plateauResults };
    }

    // FULL: retain the wide engineering staircase and a monotonic diagnostic LUT.
    const validByCommand = plateauResults.filter(p => p.valid).sort((a, b) => a.commandFlow - b.commandFlow);
    const monotonic = [];
    for (const p of validByCommand) {
      if (!monotonic.length || Number(p.actualFlow) > Number(monotonic[monotonic.length - 1].actualFlow) + 0.03) {
        p.acceptedInMap = true; p.reason = 'used'; monotonic.push(p);
      } else {
        p.acceptedInMap = false;
        p.reason = `non-monotonic vs previous ${round(monotonic[monotonic.length - 1].actualFlow,3)} g/s`;
      }
    }
    const desired = [state.cfg.stage1Flow, state.cfg.stage2Flow, state.cfg.stage3Flow].map(Number).filter(Number.isFinite);
    const minDesired = desired.length ? Math.min(...desired) : 1.5;
    const maxDesired = desired.length ? Math.max(...desired) : 5.0;
    const minActual = monotonic.length ? Number(monotonic[0].actualFlow) : null;
    const maxActual = monotonic.length ? Number(monotonic[monotonic.length - 1].actualFlow) : null;
    const targetCoverage = desired.map(target => {
      let lo = null, hi = null;
      for (const p of monotonic) {
        const y = Number(p.actualFlow);
        if (y <= target) lo = p;
        if (y >= target && !hi) hi = p;
      }
      const gap = lo && hi ? Number(hi.actualFlow) - Number(lo.actualFlow) : null;
      const maxGap = target <= 2.05 ? 0.85 : 1.25;
      const ok = !!lo && !!hi && Number.isFinite(gap) && gap <= maxGap;
      return { target: round(target, 3), ok, lowerActual: lo ? lo.actualFlow : null, upperActual: hi ? hi.actualFlow : null,
        lowerCommand: lo ? lo.commandFlow : null, upperCommand: hi ? hi.commandFlow : null, gap: round(gap, 4), maxGap };
    });
    const coversTargets = monotonic.length >= 5 && targetCoverage.length > 0 && targetCoverage.every(x => x.ok);
    const displayPts = monotonic.filter(p => Number.isFinite(Number(p.machineFlow)) && Number(p.machineFlow) > 0.12);
    let suggested = null, displayFactor = null;
    if (coversTargets && Number.isFinite(Number(baseMultiplier)) && displayPts.length >= 3) {
      let num = 0, den = 0;
      for (const p of displayPts) { const x = Number(p.machineFlow), y = Number(p.actualFlow); num += x * y; den += x * x; }
      if (den > 0) { displayFactor = num / den; suggested = Math.max(0.13, Math.min(2.0, Number(baseMultiplier) * displayFactor)); }
    }
    const map = {
      schema: 3, algorithm: 'v0.1.38-full-staircase', createdAt: new Date().toISOString(), calibrationMode: mode,
      baseFlowMultiplier: round(baseMultiplier, 4), valid: coversTargets, coversTargets, targetCoverage,
      actualRange: monotonic.length ? [round(minActual, 4), round(maxActual, 4)] : null,
      desiredRange: [round(minDesired, 4), round(maxDesired, 4)],
      points: monotonic.map(p => ({ commandFlow: p.commandFlow, actualFlow: p.actualFlow, machineFlow: p.machineFlow, r2: p.r2, samples: p.samples })),
      suggestedFlowMultiplier: round(suggested, 4), displayScaleFactor: round(displayFactor, 4)
    };
    return { valid: map.valid, map, plateauResults };
  }

  function calibrationStatusPayload() {
    recomputeCalibrationUsability();
    refreshLearningStage();
    const map = state.calibrationMap;
    return {
      pluginVersion: '0.1.59',
      basketContext: state.cfg ? state.cfg.basketContext : "unknown",
      learningStage: state.learningStage,
      baselinePrior: baselineFeedForwardPayload(),
      overrideContextStatus: testOverrideStatus().reason,
      autoApplyNextShot: !!state.autoApplyNextShot,
      autoApplyLastStatus: state.autoApplyLastStatus,
      calibrationMode: state.calibrationMode,
      calibrationModeLabel: calibrationModeConfig().label,
      calibrationAlgorithm: calibrationModeConfig().algorithm || 'staircase',
      calibrationModes: Object.keys(CALIBRATION_MODES).map(k => ({ id: k, label: CALIBRATION_MODES[k].label })),
      workflowTitle: state.workflowTitle,
      calibrationProfileTitle: calibrationProfileTitle(state.calibrationMode),
      calibrationProfileTitles: { low: calibrationProfileTitle('low'), full: calibrationProfileTitle('full') },
      calibrationArmed: state.calibrationArmed,
      calibrationActive: state.calibrationActive,
      scope: state.scopeMode,
      scopeLabel: scopeLabel(state.scopeMode),
      currentFlowMultiplier: round(state.flowMultiplierCurrent, 4),
      scopedOriginalMultiplier: round(state.scopedOriginalMultiplier, 4),
      pendingCalibrationMultiplier: round(state.calibrationPendingMultiplier, 4),
      globalPreviousMultiplier: round(state.globalPreviousMultiplier, 4),
      calibrationValid: !!(map && map.valid),
      calibrationUsable: state.calibrationMapUsable,
      calibrationStaleReason: state.calibrationMapStaleReason,
      calibrationBaseMultiplier: round(calibrationBaseMultiplier(), 4),
      suggestedFlowMultiplier: map && map.valid === true && Number(map.schema || 0) >= 3 ? round(map.suggestedFlowMultiplier, 4) : null,
      targetCoverage: map && Array.isArray(map.targetCoverage) ? map.targetCoverage : null,
      targetAnchors: map && Array.isArray(map.targetAnchors) ? map.targetAnchors : null,
      actualRange: map ? map.actualRange : null,
      pointCount: calibrationPoints().length,
      commandFlows: commandFlowSummary(),
      profileTruth: runtimeProfileTruthPayload(),
      persistentHistory: historyStatusPayload(),
      manualTestOverride: testOverrideStatus(),
      profileSyncStatus: state.profileSyncStatus,
      stage1StartupCorrection: stage1StartupFactor(),
      nominalCommandWaterMl: calibrationWaterPlan().nominalCommandWaterMl,
      recommendedContainerMl: calibrationWaterPlan().recommendedContainerMl,
      primeFlow: calibrationWaterPlan().primeFlow,
      primeSeconds: calibrationWaterPlan().primeSeconds,
      calibrationHardStopG: calibrationWaterPlan().hardStopG,
      calibrationStepSeconds: calibrationWaterPlan().stepSeconds,
      calibrationSteps: calibrationWaterPlan().steps,
      waterPreflight: waterPreflightStatus(),
      lastCalibrationValid: state.calibrationLast ? !!state.calibrationLast.valid : null,
      lastCalibration: state.calibrationLast
    };
  }

  async function beginCalibrationRun() {
    if (state.calibrationActive || state.calibrationFinalizeBusy) return;
    state.calibrationActive = true;
    state.phase = 'calibration';
    state.calibrationHardPressureSamples = 0;
    resetWeightTracking(finiteOrNull(state.latestRawWeight));
    const current = await refreshFlowMultiplier(true);
    if (Number.isFinite(current)) state.calibrationPendingMultiplier = current;
    startDiagnostics('calibration');
    diagnosticEvent('calibration_multiplier', { flowMultiplier: round(current, 4) });
    emitSkinChanged();
    log(`Flow Calibration started (${calibrationModeConfig().label}) at flowMultiplier=${Number.isFinite(current) ? current.toFixed(3) : 'unknown'}. EMPTY BASKET; actual-water safety cap=${calibrationModeConfig().hardStopG} g.`);
  }

  async function finalizeCalibrationRun(result) {
    if (!state.calibrationActive || state.calibrationFinalizeBusy) return;
    state.calibrationFinalizeBusy = true;
    try {
      const run = state.diagnosticCurrent;
      if (!run || run.kind !== 'calibration') {
        state.calibrationActive = false;
        state.phase = 'idle';
        return;
      }
      diagnosticSample('calibration_final', true);
      run.endedAt = new Date().toISOString();
      run.result = String(result || 'calibration ended');
      const base = Number(run.config && run.config.flowMultiplier);
      const analysis = analyzeCalibrationRun(run, Number.isFinite(base) ? base : state.flowMultiplierCurrent);
      run.calibration = analysis;
      run.summary = diagnosticSummary(run);
      state.calibrationLast = {
        result: run.result,
        valid: analysis.valid,
        createdAt: new Date().toISOString(),
        plateauResults: analysis.plateauResults,
        map: analysis.map
      };
      state.diagnosticLast = run;
      state.diagnosticCurrent = null;
      state.diagnosticLastSampleAtMs = 0;
      state.calibrationActive = false;
      state.phase = 'idle';

      if (analysis.valid) {
        state.calibrationMap = analysis.map;
        state.calibrationPendingMultiplier = null;
        storageWrite(STORAGE_CAL, analysis.map);
        // A new LUT invalidates any old static manual-test command. Never carry
        // an experiment across a calibration map change.
        state.testOverrides = null;
        state.adaptiveHistory = [];
        storageWrite(STORAGE_TEST_OVERRIDES, '');
        storageWrite(STORAGE_PENDING_MULT, '');
        recomputeCalibrationUsability();
        log(`Flow Calibration VALID: ${analysis.map.points.length} LUT points (${analysis.map.algorithm}), real-flow range ${analysis.map.actualRange[0]}..${analysis.map.actualRange[1]} g/s. Suggested DE1 flowMultiplier=${analysis.map.suggestedFlowMultiplier ?? 'n/a'}.`);
        if (state.cfg.calibrationAutoSync) {
          try { await syncHyperExProfile(false); }
          catch (error) { state.profileSyncStatus = `Auto-sync failed: ${error.message || error}`; log(state.profileSyncStatus); }
        }
      } else {
        log('Flow Calibration INVALID: one or more HyperEx real-flow targets failed the target-search quality gate (or Full staircase coverage was insufficient). Existing valid LUT was kept unchanged and HyperEx was NOT auto-synced.');
      }
      emitSkinChanged();
    } finally {
      state.calibrationFinalizeBusy = false;
    }
  }

  async function handleCalibrationMachine(machine, pourHasBegun) {
    if (!state.calibrationArmed && !state.calibrationActive) return false;
    if (!state.calibrationActive && machine.machineState === 'espresso' && pourHasBegun) {
      const preflight = waterPreflightStatus();
      const preflightApproved = Date.now() <= Number(state.calibrationWaterPreflightApprovedUntilMs || 0);
      const mustBlock = preflight.status === 'block' || ((preflight.status === 'unknown' || preflight.status === 'warn') && !preflightApproved);
      if (mustBlock) {
        log(`CALIBRATION WATER PREFLIGHT STOP: ${preflight.message}${preflightApproved ? '' : ' Use PREPARE FLOW CAL for explicit confirmation.'}`);
        try { await requestMachineState('idle'); } catch (_) {}
        return true;
      }
      await beginCalibrationRun();
      return true;
    }
    if (!state.calibrationActive) return true;

    if (Number(machine.pressure) > state.cfg.hardPressureLimit) {
      state.calibrationHardPressureSamples += 1;
      if (state.calibrationHardPressureSamples >= 3) {
        log(`CALIBRATION EMERGENCY STOP: pressure > ${state.cfg.hardPressureLimit.toFixed(2)} bar for 3 samples.`);
        try { await requestMachineState('idle'); } catch (_) {}
        await finalizeCalibrationRun('aborted: pressure safety');
        return true;
      }
    } else {
      state.calibrationHardPressureSamples = 0;
    }

    const waterCap = calibrationModeConfig().hardStopG;
    if (Number.isFinite(waterCap) && state.cumulativeWeight >= waterCap) {
      log(`CALIBRATION WATER SAFETY STOP: collected ${state.cumulativeWeight.toFixed(1)} g reached ${waterCap} g cap (${calibrationModeConfig().label}). Requesting Idle to stay below 300 ml.`);
      try { await requestMachineState('idle'); } catch (_) {}
      await finalizeCalibrationRun(`water safety stop at ${state.cumulativeWeight.toFixed(1)} g`);
      return true;
    }

    if (machine.machineState === 'idle' || machine.substate === 'pouringDone') {
      await finalizeCalibrationRun('completed');
    }
    return true;
  }

  function resetWeightTracking(rawWeight) {
    state.rawBaseline = Number.isFinite(rawWeight) ? rawWeight : null;
    state.lastRawWeight = Number.isFinite(rawWeight) ? rawWeight : null;
    state.cumulativeOffset = 0;
    state.cumulativeWeight = 0;
    state.hasScaleSample = Number.isFinite(rawWeight);
  }

  function updateCumulativeWeight(rawWeight) {
    if (!Number.isFinite(rawWeight)) return state.cumulativeWeight;

    state.hasScaleSample = true;
    clearTimer("noScaleTimer");

    if (state.rawBaseline === null || state.lastRawWeight === null) {
      state.rawBaseline = rawWeight;
      state.lastRawWeight = rawWeight;
      state.cumulativeWeight = state.cumulativeOffset;
      return state.cumulativeWeight;
    }

    const downwardJump = state.lastRawWeight - rawWeight;
    if (downwardJump >= state.cfg.scaleResetThreshold) {
      const carried = state.cumulativeWeight;
      state.cumulativeOffset = carried;
      state.rawBaseline = rawWeight;
      state.lastRawWeight = rawWeight;
      state.cumulativeWeight = carried;
      log(`Detected scale tare/reset (${downwardJump.toFixed(2)} g drop); carrying cumulative ${carried.toFixed(2)} g.`);
      return state.cumulativeWeight;
    }

    let total = state.cumulativeOffset + (rawWeight - state.rawBaseline);
    if (!Number.isFinite(total)) total = state.cumulativeWeight;
    // Do not let minor scale noise make the logical cumulative weight run backwards by more than 0.5 g.
    if (total < state.cumulativeWeight - 0.5) total = state.cumulativeWeight;
    state.cumulativeWeight = Math.max(0, total);
    state.lastRawWeight = rawWeight;
    return state.cumulativeWeight;
  }

  function resetSequence(reason) {
    let completedDiagnosticRun = null;
    if (state.diagnosticCurrent) completedDiagnosticRun = finalizeDiagnostics(reason || "reset");
    clearAllTimers();
    const previous = state.phase;
    if (previous === "restart_wait") {
      stopGhcPrompt("cleared", "GHC confirmation wait cleared");
    } else {
      state.ghcPromptStartedAtMs = 0;
    }
    state.phase = "idle";
    if (state.liveTrimDirty) {
      invalidateProfileTruth("Experimental raw frame changed; restoring original profile before next shot", true);
      state.liveTrimDirty = false;
    }
    state.lowFlowSamples = 0;
    state.idleConfirmedAtMs = 0;
    state.dumpAcceptedAtMs = 0;
    state.dumpReinforceSent = false;
    state.hardPressureSamples = 0;
    state.dumpRequestedAtMs = 0;
    state.dumpAcceptedAtMs = 0;
    state.dumpReinforceSent = false;
    state.lastMachineAtMs = 0;
    state.commandBusy = false;
    state.stage1DumpSent = false;
    state.stage2SkipSent = false;
    state.finalStopSent = false;
    state.sequenceStartedAtMs = 0;
    state.soakPromptStartedAtMs = 0;
    state.soakSecondsRemaining = 0;
    state.ghcSecondsRemaining = 0;
    state.armRequestCount = 0;
    state.lastArmRequestAtMs = 0;
    state.rawBaseline = null;
    state.lastRawWeight = null;
    state.cumulativeOffset = 0;
    state.cumulativeWeight = 0;
    state.hasScaleSample = false;
    emitSkinChanged();
    if (reason) log(`Sequence reset (${previous} -> idle): ${reason}`);
    if (reason && state.workflowTitle === (state.cfg && state.cfg.profileTitle)) scheduleProfileVerification('sequence reset');
    if (completedDiagnosticRun && /^completed at /i.test(String(reason || "")) && state.autoApplyNextShot) {
      state.autoApplyLastStatus = {runId:completedDiagnosticRun.runId,status:"scheduled",at:new Date().toISOString(),message:"Completed shot queued for next-shot evaluation"};
      state.autoApplyTimer = setTimeout(() => {
        state.autoApplyTimer = null;
        return autoApplyNextShotIfEligible(completedDiagnosticRun);
      }, 250);
    }
  }

  function abortSequence(reason, requestIdle) {
    if (state.phase === "idle" || state.phase === "aborted") return;
    const wasRestartWait = state.phase === "restart_wait";
    clearAllTimers();
    if (wasRestartWait) {
      stopGhcPrompt("timeout", `GHC confirmation cancelled: ${reason}`);
    }
    state.phase = "aborted";
    log(`ABORT: ${reason}`);
    if (requestIdle) {
      requestMachineState("idle").catch((error) => log(`Abort idle command failed: ${error.message || error}`));
    }
    setTimeout(() => resetSequence(reason), 1200);
  }

  function startSequence(rawWeight) {
    refreshLearningStage();
    if (state.autoApplyTimer !== null) state.autoApplyLastStatus = {status:"cancelled",at:new Date().toISOString(),message:"New shot started before pending adaptation; current shot commands retained"};
    clearAllTimers();
    state.phase = "stage1";
    state.directStartTestEnabledForRun = !!state.cfg.directDriverStartTest;
    state.directStartTest = null;
    state.lowFlowSamples = 0;
    state.idleConfirmedAtMs = 0;
    state.hardPressureSamples = 0;
    state.stage1DumpSent = false;
    state.stage2SkipSent = false;
    state.finalStopSent = false;
    state.sequenceStartedAtMs = Date.now();
    state.soakSecondsRemaining = 0;
    state.ghcSecondsRemaining = 0;
    state.armRequestCount = 0;
    state.lastArmRequestAtMs = 0;
    resetWeightTracking(rawWeight);
    startDiagnostics("hyperex");
    initializeLiveTrim();
    diagnosticSample("sequence-start", true);

    state.noScaleTimer = setTimeout(() => {
      if (!state.hasScaleSample && state.phase !== "idle") {
        abortSequence(`No usable scale snapshot received within ${state.cfg.noScaleTimeoutSeconds}s`, true);
      }
    }, state.cfg.noScaleTimeoutSeconds * 1000);

    state.maxRunTimer = setTimeout(() => {
      if (state.phase !== "idle") abortSequence(`Maximum sequence time ${state.cfg.maxRunSeconds}s exceeded`, true);
    }, state.cfg.maxRunSeconds * 1000);

    log(`START stage1: desired real ${state.cfg.stage1Flow.toFixed(2)} g/s -> DE1 command ${resolvedStageCommandFlow("stage1", state.cfg.stage1Flow).toFixed(2)} ml/s, dump at ${state.cfg.stage1Weight.toFixed(2)} g; scale=${state.hasScaleSample ? "ready" : "waiting"}.`);
  }

  function dumpLooksReleased(machine) {
    if (!machine) return false;
    if (machine.machineState === "idle") return true;
    if (machine.substate === "pouringDone") return true;
    const flow = Number(machine.flow);
    const pressure = Number(machine.pressure);
    const lowFlow = Number.isFinite(flow) && Math.abs(flow) <= state.cfg.dumpFlowThreshold;
    const lowPressure = Number.isFinite(pressure) && pressure <= 0.8;
    return lowFlow && lowPressure;
  }

  function confirmDumpIdle(source, machine) {
    if (state.phase !== "dumping" || state.idleConfirmedAtMs) return;
    state.idleConfirmedAtMs = Date.now();
    clearTimer("idlePollTimer");
    clearTimer("dumpFallbackTimer");
    const pressure = machine && Number.isFinite(Number(machine.pressure)) ? Number(machine.pressure) : state.lastPressure;
    const flow = machine && Number.isFinite(Number(machine.flow)) ? Number(machine.flow) : state.lastFlow;
    log(`Active release confirmed via ${source}; pressure=${pressure.toFixed(2)} bar, flow=${flow.toFixed(2)} ml/s. Holding ${state.cfg.dumpMinSettleSeconds.toFixed(1)} s for valve/water-path settling.`);

    state.dumpSettleTimer = setTimeout(() => {
      state.dumpSettleTimer = null;
      if (state.phase !== "dumping") return;
      beginSoak(`${source} + ${state.cfg.dumpMinSettleSeconds.toFixed(1)} s timed water-path settle`);
    }, state.cfg.dumpMinSettleSeconds * 1000);
  }

  function noteMachine(machine) {
    if (!machine) return;
    state.lastMachineAtMs = Date.now();
    state.lastMachineState = machine.machineState;
    state.lastSubstate = machine.substate;
    state.lastPressure = machine.pressure;
    state.lastMachineTelemetryValid = machine.telemetryValid === true;
    state.lastFlow = machine.flow;
    state.lastTargetFlow = machine.targetFlow;
    state.lastTargetPressure = machine.targetPressure;
    state.lastMachineWeightFlow = machine.machineWeightFlow;
    diagnosticSample("machine", false);
  }

  function pollForDumpIdle() {
    clearTimer("idlePollTimer");
    const poll = async () => {
      if (state.phase !== "dumping" || state.idleConfirmedAtMs) return;
      try {
        const snapshot = await getMachineSnapshot();
        const machine = extractMachine(snapshot);
        noteMachine(machine);
        const elapsed = state.dumpAcceptedAtMs ? (Date.now() - state.dumpAcceptedAtMs) / 1000 : 0;
        if (machine.machineState === "idle") {
          confirmDumpIdle("REST idle", machine);
          return;
        }
        if (elapsed >= state.cfg.dumpMinSettleSeconds && dumpLooksReleased(machine)) {
          confirmDumpIdle(`REST settled (${machine.machineState || "?"}/${machine.substate || "?"})`, machine);
          return;
        }
      } catch (error) {
        log(`Release-state poll transient error: ${error.message || error}`);
      }
      if (state.phase === "dumping" && !state.idleConfirmedAtMs) {
        state.idlePollTimer = setTimeout(poll, 150);
      }
    };
    state.idlePollTimer = setTimeout(poll, 120);
  }

  function armDumpFallback() {
    clearTimer("dumpFallbackTimer");
    state.dumpFallbackTimer = setTimeout(async () => {
      state.dumpFallbackTimer = null;
      if (state.phase !== "dumping" || state.idleConfirmedAtMs) return;
      state.dumpReinforceSent = true;
      log(`No definitive Idle frame after ${state.cfg.dumpFallbackSeconds.toFixed(1)} s; reinforcing active release with one more Idle request.`);
      try {
        await requestMachineState("idle");
      } catch (error) {
        log(`Release reinforcement Idle failed: ${error.message || error}`);
        return;
      }

      // Give the valve/state stream a short chance to settle after the reinforced write.
      setTimeout(async () => {
        if (state.phase !== "dumping" || state.idleConfirmedAtMs) return;
        try {
          const snapshot = await getMachineSnapshot();
          const machine = extractMachine(snapshot);
          noteMachine(machine);
          if (dumpLooksReleased(machine) || machine.machineState !== "espresso") {
            confirmDumpIdle(`reinforced Idle + REST (${machine.machineState || "?"}/${machine.substate || "?"})`, machine);
            return;
          }
          const flow = Number(machine.flow);
          const clearlyStillPouring = machine.machineState === "espresso" &&
            (machine.substate === "preinfusion" || machine.substate === "pouring") &&
            Number.isFinite(flow) && Math.abs(flow) > Math.max(0.8, state.cfg.dumpFlowThreshold);
          if (clearlyStillPouring) {
            log(`Reinforced Idle not yet settled: still ${machine.substate}, flow=${flow.toFixed(2)} ml/s; continuing polls.`);
            return;
          }
          // The state is ambiguous but the DE1 acknowledged two Idle writes. Do not throw away
          // the coffee merely because finalize hid the exact Idle frame.
          confirmDumpIdle(`two acknowledged Idle writes; state ambiguous ${machine.machineState || "?"}/${machine.substate || "?"}`, machine);
        } catch (error) {
          // During shot finalization the current-state endpoint can briefly be unavailable.
          // Two acknowledged Idle writes are stronger evidence than a missing REST frame.
          log(`Post-reinforcement state read unavailable (${error.message || error}); accepting two acknowledged Idle writes as release confirmation.`);
          confirmDumpIdle("two acknowledged Idle writes; REST unavailable during finalize", null);
        }
      }, 450);
    }, state.cfg.dumpFallbackSeconds * 1000);
  }

  function beginDump() {
    if (state.stage1DumpSent || state.phase !== "stage1") return;
    state.stage1DumpSent = true;
    state.phase = "dumping";
    state.lowFlowSamples = 0;
    state.idleConfirmedAtMs = 0;
    state.dumpAcceptedAtMs = 0;
    state.dumpReinforceSent = false;
    state.dumpRequestedAtMs = Date.now();
    emitSkinChanged();
    diagnosticEvent("stage1_weight_trigger", { cumulativeWeightG: round(state.cumulativeWeight, 3) });
    log(`Stage1 reached ${state.cumulativeWeight.toFixed(2)} g. Requesting active water-path release via Espresso -> Idle.`);

    state.dumpTimer = setTimeout(async () => {
      if (state.phase !== "dumping") return;
      // Final guard: only abort when fresh telemetry explicitly says the machine is still
      // pouring with meaningful flow. Otherwise preserve the shot and continue after the
      // already-acknowledged Idle release request(s).
      let machine = null;
      try {
        const snapshot = await getMachineSnapshot();
        machine = extractMachine(snapshot);
        noteMachine(machine);
      } catch (_) {}
      const flow = machine ? Number(machine.flow) : NaN;
      const explicitlyStillPouring = machine && machine.machineState === "espresso" &&
        (machine.substate === "preinfusion" || machine.substate === "pouring") &&
        Number.isFinite(flow) && Math.abs(flow) > Math.max(0.8, state.cfg.dumpFlowThreshold);
      if (explicitlyStillPouring) {
        abortSequence(`Active release still shows ${machine.substate} at ${flow.toFixed(2)} ml/s after ${state.cfg.dumpTimeoutSeconds}s`, true);
      } else if (state.dumpAcceptedAtMs) {
        confirmDumpIdle("release timeout fallback after acknowledged Idle", machine);
      } else {
        abortSequence(`Idle release command was never acknowledged within ${state.cfg.dumpTimeoutSeconds}s`, true);
      }
    }, state.cfg.dumpTimeoutSeconds * 1000);

    requestMachineState("idle")
      .then(() => {
        if (state.phase !== "dumping") return;
        state.dumpAcceptedAtMs = Date.now();
        pollForDumpIdle();
        armDumpFallback();
      })
      .catch((error) => {
        log(`Initial active dump command failed: ${error.message || error}; retrying once.`);
        setTimeout(() => {
          if (state.phase !== "dumping") return;
          requestMachineState("idle")
            .then(() => {
              state.dumpAcceptedAtMs = Date.now();
              state.dumpReinforceSent = true;
              pollForDumpIdle();
              armDumpFallback();
            })
            .catch((retryError) => abortSequence(`Active dump command failed twice: ${retryError.message || retryError}`, true));
        }, 300);
      });
  }


  function beginSoak(reason) {
    if (state.phase !== "dumping") return;
    clearTimer("dumpTimer");
    clearTimer("dumpSettleTimer");
    clearTimer("dumpFallbackTimer");
    clearTimer("idlePollTimer");
    state.phase = "soak";
    state.armRequestCount = 0;
    state.lastArmRequestAtMs = 0;
    const soakStartWeight = state.cumulativeWeight;
    diagnosticEvent("soak_start", { reason, cumulativeWeightG: round(soakStartWeight, 3), pressureBar: round(state.lastPressure, 3), machineFlowMlS: round(state.lastFlow, 3) });
    log(`Active-release confirmed (${reason}); pressure=${state.lastPressure.toFixed(2)} bar, flow=${state.lastFlow.toFixed(2)} ml/s. Starting ${state.cfg.soakSeconds.toFixed(1)} s soak at ${soakStartWeight.toFixed(2)} g.`);
    startSoakCountdown();

    state.soakTimer = setTimeout(() => {
      state.soakTimer = null;
      clearTimer("soakCountdownTimer");
      state.soakSecondsRemaining = 0;
      if (state.phase !== "soak") return;
      state.phase = "restart_wait";
      state.armRequestCount = 1;
      state.lastArmRequestAtMs = Date.now();
      emitSkinChanged();
      diagnosticEvent("soak_complete_arm1", { cumulativeWeightG: round(state.cumulativeWeight, 3) });
      log(`Soak complete at cumulative ${state.cumulativeWeight.toFixed(2)} g. Sending second-stage Espresso arm request now.`);
      if (state.directStartTestEnabledForRun) {
        beginDirectStartTest();
        return;
      }
      requestMachineState("espresso")
        .then(() => startRestartPoll())
        .catch((error) => abortSequence(`Espresso restart failed: ${error.message || error}`, false));
    }, state.cfg.soakSeconds * 1000);
  }



  // Optional REST -> raw startup attempt retains the original GHC guard and retries.

  // User-authorized experiment: direct writes to the current flow frame, never skipStep.
  // Firmware live-frame semantics are unverified; ACK is distinct from target feedback.

  function liveTrimLearningView(run,phase) {
    if(!run||!run.config||!run.config.experimentalLiveTrim)return run;
    const trace=run.liveFlowTrim&&run.liveFlowTrim.trace||[];
    const frames=phase==="stage2"?[1]:(run.config.stage3Shape&&run.config.stage3Shape.enabled?[2,3,4]:[2]);
    const changed=frames.filter(f=>trace.some(x=>x.kind==="write"&&x.frame===f));
    if(!changed.length)return run; // S1 and untouched phases retain the existing evidence path.
    const bounds={},commands={};
    for(const frame of changed){
      const last=trace.filter(x=>x.kind==="write"&&x.frame===frame).slice(-1)[0];
      const response=trace.find(x=>x.kind==="machine-target-response"&&x.frame===frame&&x.tMs>=last.tMs&&Math.abs(x.commandMlS-last.commandMlS)<0.001);
      if(!response)return null;
      bounds[frame]=response.tMs+2000;commands[frame]=last.commandMlS;
      const raw=(run.rawScaleSamples||[]).filter(x=>x.phase===phase&&Number(x.profileFrame)===frame&&x.tMs>=bounds[frame]);
      if(raw.length<6||raw[raw.length-1].tMs-raw[0].tMs<5000)return null;
    }
    const keep=x=>x.phase!==phase||bounds[Number(x.profileFrame)]===undefined||x.tMs>=bounds[Number(x.profileFrame)];
    const c={...run.config,liveTrimLearningBasis:"verified stable-command windows after 2s settle"};
    if(phase==="stage2")c.stage2CommandMlS=commands[1];
    else if(c.stage3Shape&&c.stage3Shape.enabled){
      c.stage3Shape={...c.stage3Shape};
      for(const [frame,key] of [[2,"earlyCommand"],[3,"midCommand"],[4,"lateCommand"]])if(commands[frame]!==undefined)c.stage3Shape[key]=commands[frame];
      c.stage3CommandMlS=c.stage3Shape.midCommand;
    }else c.stage3CommandMlS=commands[2];
    return {...run,config:c,rawScaleSamples:(run.rawScaleSamples||[]).filter(keep),samples:(run.samples||[]).filter(keep)};
  }

  function liveTrimPayload() { return state.liveTrim ? state.liveTrim.report : null; }
  function liveTrimRecord(kind, extra) {
    const t=state.liveTrim;if(!t)return;
    const row={kind,tMs:Math.max(0,Date.now()-t.run.startedAtMs),...(extra||{})};
    t.report.trace.push(row);
    diagnosticEvent("live_flow_trim",row);
  }
  function closeLiveTrim(t) {
    if(!t||!t.handle)return;const h=t.handle;t.handle=null;
    host.transport.close(h).catch(()=>{});
  }
  function stopLiveTrim(reason) {
    clearTimer("liveTrimTimer");
    const t=state.liveTrim;if(!t)return;
    if(t.active){t.active=false;t.report.status=reason;liveTrimRecord("stopped",{reason});}
    closeLiveTrim(t);
  }
  function initializeLiveTrim() {
    state.liveTrim=null;
    const run=state.diagnosticCurrent;
    if(!state.cfg.liveFlowTrimTest||!run)return;
    const c=run.config;
    c.experimentalLiveTrim=true;
    const seconds=(c.stage2Weight-c.stage1Weight)/c.stage2Flow+(c.finalWeight-c.stage2Weight)/c.stage3Flow;
    const level=[1,2,3,4].includes(state.cfg.liveFlowTrimLevel)?state.cfg.liveFlowTrimLevel:1;
    const budget=[50,150,200,250][level-1];
    const period=level===1?Math.max(300,Math.round(seconds*1000/50)):[0,300,250,200][level-1];
    const report={enabled:true,status:"armed-for-S2",level,plannedDurationMs:Math.round(seconds*1000),periodMs:period,maxChecks:2000,maxWrites:budget,
      checks:0,writes:0,acks:0,targetConfirmations:0,targetMissTolerance:3,targetMisses:0,consecutiveTargetMisses:0,retries:0,deadbandPct:6,trace:[],adaptiveMode:"normal-shot-to-shot-with-verified-stable-command-windows"};
    run.liveFlowTrim=report;
    state.liveTrim={active:true,started:false,handle:null,run,report,phase:null,frame:null,frameAt:0,
      commands:{},pending:null,retry:null,profile:JSON.parse(JSON.stringify(profileObject()))};
    liveTrimRecord("armed",{periodMs:report.periodMs});
  }
  async function startLiveTrim() {
    const t=state.liveTrim;
    if(!t||!t.active||t.started)return;t.started=true;
    const live=()=>state.liveTrim===t&&t.active&&state.diagnosticCurrent===t.run&&["stage2","stage3"].includes(state.phase);
    // Schedule before awaits: opening/API calls cannot strand the experiment.
    scheduleLiveTrimTick(t);
    try {
      const rr=await api("/machine/info",{method:"GET"});const info=await rr.json();
      if(!live())return;
      // This encoder is for stock DE1 only, not Bengle's 0.1-unit v2 protocol.
      if(!info||typeof info.model!=="string"||!/^DE1/i.test(info.model))throw new Error("stock DE1 model not confirmed");
      const opened=await host.transport.open({kind:"websocket",url:"ws://localhost:8080/ws/v1/machine/raw"});
      if(!opened||!opened.handle)throw new Error("raw socket missing handle");
      if(!live()){host.transport.close(opened.handle).catch(()=>{});return;}
      t.handle=opened.handle;t.report.status="monitoring";
      host.transport.onEvent(t.handle,event=>{
        if(!live())return;
        if(event.type==="close"||event.type==="error"){t.handle=null;stopLiveTrim("raw-transport-failed");return;}
        if(event.type!=="data"||!t.pending)return;
        try {
          const x=typeof event.data==="string"?JSON.parse(event.data):event.data;
          if(x.type==="response"&&x.operation==="write"&&x.characteristicUUID==="A010"&&!t.pending.ack){
            t.pending.ack=true;t.report.acks++;
            liveTrimRecord("driver-ack",{frame:t.pending.frame,latencyMs:Date.now()-t.pending.at});
          }
        }catch(_){}
      });
    }catch(error){if(live())stopLiveTrim(`setup-failed: ${error.message||error}`);}
  }
  function scheduleLiveTrimTick(t) {
    if(!t.active||state.liveTrim!==t)return;
    state.liveTrimTimer=setTimeout(()=>{
      state.liveTrimTimer=null;
      liveTrimTick(t).catch(error=>{if(state.liveTrim===t&&t.active){stopLiveTrim(`write-failed: ${error.message||error}`);abortSequence("Live flow driver write failed",true);}});
    },t.report.periodMs);
  }
  function observeLiveTrimMachine(machine) {
    const t=state.liveTrim;if(!t||!t.active||!t.started)return;
    if(!["stage2","stage3"].includes(state.phase))return;
    const frame=finiteOrNull(machine.profileFrame);
    if(frame!==t.frame||state.phase!==t.phase){t.frame=frame;t.phase=state.phase;t.frameAt=Date.now();}
    const p=t.pending||t.retry;
    if(p) p.lastObserved={frame,targetFlowMlS:finiteOrNull(machine.targetFlow),telemetryValid:machine.telemetryValid===true,atMs:Date.now()};
    if(p&&machine.machineState==="espresso"&&machine.telemetryValid&&frame===p.frame&&
       finiteOrNull(machine.targetFlow)!==null&&Math.abs(machine.targetFlow-p.command)<0.02&&!p.targetSeen){
      p.targetSeen=true;t.report.targetConfirmations++;
      // Only matching machine feedback advances our known command. ACK alone does not.
      t.commands[frame]=p.command;t.report.consecutiveTargetMisses=0;t.report.status="monitoring";
      if(t.retry===p)t.retry=null;
      liveTrimRecord("machine-target-response",{frame,commandMlS:p.command,latencyMs:Date.now()-p.at});
    }
  }
  function encodeLiveFlowFrame(step,frame,command) {
    if(!step||step.pump!=="flow"||step.exit||!Number.isInteger(frame)||frame<1||frame>4)throw new Error("unsupported frame");
    if(!Number.isFinite(command)||command<LIMITS.commandFlowMin||command>LIMITS.commandFlowMax)throw new Error("flow out of bounds");
    const temp=Number(step.temperature),seconds=Number(step.seconds),volume=Number(step.volume);
    if(!Number.isFinite(temp)||temp<70||temp>100||!Number.isFinite(seconds)||seconds<0||!Number.isFinite(volume)||volume!==0)throw new Error("unsupported frame metadata");
    // Exactly match Decaid stock-DE1 frame encoding; preserve sensor, transition,
    // temperature, duration and unlimited-volume flag. Extended limiter frame untouched.
    const flags=0x40|0x01|(step.sensor==="water"?0x10:0)|(step.transition==="smooth"?0x20:0);
    const duration=seconds===0?0:seconds>=12.75?(0x80|Math.min(127,Math.floor(seconds+0.5))):Math.floor(seconds*10+0.5);
    const bytes=[frame,flags,Math.floor(command*16+0.5),Math.floor(temp*2+0.5),duration,0,4,0];
    return bytes.map(x=>x.toString(16).padStart(2,"0").toUpperCase()).join("");
  }
  function liveTrimRegression(t) {
    const now=Date.now(),raw=t.run.rawScaleSamples||[],seen=new Set(),points=[];
    for(const x of raw){
      if(x.phase!==state.phase||Number(x.profileFrame)!==t.frame||x.tMs<t.frameAt-t.run.startedAtMs||now-t.run.startedAtMs-x.tMs>1600)continue;
      if(x.tareReset){points.length=0;seen.clear();continue;}
      const stamp=finiteOrNull(x.scaleTimestampSeconds),weight=finiteOrNull(x.weightG);
      if(stamp===null||weight===null||seen.has(stamp))continue;
      if(points.length&&(stamp<=points[points.length-1].x||stamp-points[points.length-1].x>0.6)){points.length=0;}
      seen.add(stamp);points.push({x:stamp,y:weight});
    }
    if(points.length<6||points[points.length-1].x-points[0].x<1.2)return null;
    const r=linearRegression(points);return r&&r.r2>=0.90&&r.slope>0?r:null;
  }
  async function liveTrimTick(t) {
    const live=()=>state.liveTrim===t&&t.active&&state.diagnosticCurrent===t.run&&["stage2","stage3"].includes(state.phase);
    if(!live())return;
    const exhausted=t.report.checks>=t.report.maxChecks;
    if(exhausted&&!t.pending){stopLiveTrim(`${t.report.maxChecks}-check-budget-complete`);return;}
    if(!exhausted)t.report.checks++;
    const row={check:t.report.checks,frame:t.frame,phase:state.phase,decision:"hold"};
    const checkReg=liveTrimRegression(t);
    if(checkReg)row.rawGS=round(checkReg.slope,3);
    try {
      if(t.pending){
        const p=t.pending;
        if(Date.now()-p.at>Math.max(2000,t.report.periodMs*2)){
          if(!p.ack){stopLiveTrim("driver-ack-timeout");abortSequence("Live flow driver acknowledgement timeout",true);return;}
          if(!p.targetSeen){
            t.report.targetMisses++;t.report.consecutiveTargetMisses++;
            liveTrimRecord("target-response-timeout",{frame:p.frame,commandMlS:p.command,lastObserved:p.lastObserved||null,currentFrame:state.lastFrame,stageTransition:state.stage2SkipSent===true,
              consecutiveMisses:t.report.consecutiveTargetMisses,tolerance:t.report.targetMissTolerance});
            if(t.report.consecutiveTargetMisses>t.report.targetMissTolerance){stopLiveTrim("target-feedback-missing-4-consecutive");return;}
            // Acknowledged but unconfirmed: tolerate, then retry the SAME bounded target.
            // Do not pretend it failed physically or accumulate another quantum on top.
            t.retry=p;t.report.status=`monitoring-target-feedback-miss-${t.report.consecutiveTargetMisses}-of-3`;
            liveTrimRecord("target-feedback-bypass",{frame:p.frame,commandMlS:p.command,consecutiveMisses:t.report.consecutiveTargetMisses});
          }
          t.pending=null;
        }else {row.reason="waiting-for-write-response";return;}
      }
      if(exhausted){stopLiveTrim(`${t.report.maxChecks}-check-budget-complete`);return;}
      if(!t.handle){row.reason="raw-socket-not-ready";return;}
      if(state.stage2SkipSent&&state.phase==="stage2"){row.reason="stage-transition";return;}
      const frame=finiteOrNull(state.lastFrame);
      if(frame===null||!Number.isInteger(frame)||(state.phase==="stage2"?frame!==1:frame<2||frame>=t.profile.steps.length)){row.reason="frame-not-confirmed";return;}
      if(frame!==t.frame||state.phase!==t.phase){t.frame=frame;t.phase=state.phase;t.frameAt=Date.now();row.reason="frame-settle";return;}
      if(Date.now()-t.frameAt<1600||Date.now()-state.latestScaleAtMs>600||Date.now()-state.lastMachineAtMs>600||!state.lastMachineTelemetryValid||state.lastMachineState!=="espresso"||!["preinfusion","pouring"].includes(state.lastSubstate)){row.reason="settling-or-stale-telemetry";return;}
      const reg=liveTrimRegression(t);if(!reg){row.reason="raw-regression-insufficient";return;}
      const target=state.phase==="stage2"?t.run.config.stage2Flow:t.run.config.stage3Flow;
      row.rawGS=round(reg.slope,3);row.targetGS=target;row.errorPct=round((reg.slope/target-1)*100,2);row.r2=round(reg.r2,4);
      if(Math.abs(reg.slope/target-1)<=0.06){row.reason="inside-6pct-band";return;}
      if(t.retry&&t.retry.frame!==frame){
        liveTrimRecord("unconfirmed-frame-ended",{frame:t.retry.frame,commandMlS:t.retry.command,nextFrame:frame});
        t.retry=null; // Never resend an old frame after a natural/weight transition.
      }
      const retry=t.retry;
      const step=t.profile.steps[frame],base=Math.floor(Number(step.flow)*16+0.5)/16;
      const command=Number.isFinite(t.commands[frame])?t.commands[frame]:base;
      const limiter=Number(step.limiter&&step.limiter.value);
      if(reg.slope<target&&(!Number.isFinite(limiter)||state.lastPressure>=0.95*limiter||state.lastFlow<command*0.7)){row.reason="pressure-or-actuator-limited";return;}
      // A stale direction is held, not blindly retried after the cup error reverses.
      if(retry&&Math.sign(retry.command-command)!==Math.sign(target-reg.slope)){row.reason="unconfirmed-target-direction-changed";return;}
      // One quantum only from a confirmed command; unresolved attempts repeat the same target.
      const candidate=retry?retry.command:Math.round((command+(reg.slope<target?1:-1)/16)*16)/16;
      if(candidate<LIMITS.commandFlowMin||candidate>LIMITS.commandFlowMax||candidate<base*0.8||candidate>base*1.2){row.reason="command-bound";return;}
      if(t.report.writes>=t.report.maxWrites){row.reason=`${t.report.maxWrites}-write-budget`;return;}
      const payload=encodeLiveFlowFrame(step,frame,candidate);
      // All preconditions are synchronous immediately before dispatch. No awaiting
      // GET/profile upload between frame validation and this single raw write.
      if(!live()||Number(state.lastFrame)!==frame||state.commandBusy){row.reason="frame-changed-or-command-busy";return;}
      const p={frame,command:candidate,at:Date.now(),ack:false,targetSeen:false};t.pending=p;
      if(retry){t.report.retries++;t.retry=null;}
      t.report.writes++;state.liveTrimDirty=true;
      liveTrimRecord("write",{frame,commandMlS:candidate,previousMlS:command,retry:!!retry,rawGS:row.rawGS,targetGS:target,payload});
      row.decision="write";row.commandMlS=candidate;
      await host.transport.send(t.handle,{type:"text",data:JSON.stringify({type:"request",operation:"write",characteristicUUID:"A010",payload})});
    }finally{
      if(state.liveTrim===t){if(!exhausted)liveTrimRecord("check",row);if(live())scheduleLiveTrimTick(t);}
    }
  }

  // Optional raw attempt shares the original GHC watchdog; no cup-gain watchdog.
  function directStartTestPayload() {
    const t=state.directStartTest;
    return t?{active:t.active,status:t.status,requestAtMs:t.requestAtMs,writeAtMs:t.writeAtMs,
      rawWriteAcknowledged:!!t.rawWriteAcknowledged,machineConfirmed:!!t.machineConfirmed}:null;
  }
  function directTestEvent(status) {
    const t=state.directStartTest;if(!t)return;
    t.status=status;diagnosticEvent("direct_driver_start_test",directStartTestPayload());
    log(`DIRECT START TEST: ${status}`);emitSkinChanged();
  }
  function closeDirectTestTransport(t) {
    if(!t||!t.handle)return;const handle=t.handle;t.handle=null;
    host.transport.close(handle).catch(()=>{});
  }
  function cancelDirectStartTest() {
    clearTimer("directStartTestTimer");
    const t=state.directStartTest;
    if(t){t.active=false;closeDirectTestTransport(t);}
  }
  async function beginDirectStartTest() {
    const t={active:true,status:"requesting-espresso",requestAtMs:Date.now(),writeAtMs:null,handle:null};
    state.directStartTest=t;
    const live=()=>state.directStartTest===t&&t.active&&state.phase==="restart_wait";
    const stop=(reason)=>{
      if(state.directStartTest!==t||!t.active)return;
      directTestEvent(reason);cancelDirectStartTest();
    };
    try {
      await requestMachineState("espresso");
      if(!live())return;
      // Restore the original confirmation/retry/timeout owner before any raw await.
      startRestartPoll();
      directTestEvent("espresso-request-accepted; physical-GHC-may-be-required");
      // Transport cleanup only. This timer never sends Idle or replaces GHC safety.
      state.directStartTestTimer=setTimeout(()=>stop("raw-setup-timeout; original-GHC-guard-active"),5000);
      const rr=await api("/machine/info",{method:"GET"});const info=await rr.json();
      if(!live())return;
      if(!info||!/^DE1/i.test(info.model||"")||info.groupHeadControllerPresent!==false){
        stop(info&&info.groupHeadControllerPresent===true?"GHC-confirmation-required; raw-attempt-skipped":"GHC-capability-unknown; raw-attempt-skipped");
        return;
      }
      const opened=await host.transport.open({kind:"websocket",url:"ws://localhost:8080/ws/v1/machine/raw"});
      if(!opened||!opened.handle)throw new Error("raw socket missing handle");
      if(!live()){host.transport.close(opened.handle).catch(()=>{});return;}
      t.handle=opened.handle;
      host.transport.onEvent(t.handle,event=>{
        if(!live())return;
        if(event.type==="close"||event.type==="error"){stop("raw-transport-closed; original-GHC-guard-active");return;}
        if(event.type!=="data")return;
        try {
          const msg=typeof event.data==="string"?JSON.parse(event.data):event.data;
          if(t.writeAtMs&&msg.type==="response"&&msg.operation==="write"&&String(msg.characteristicUUID).toUpperCase()==="A002"){
            t.rawWriteAcknowledged=true;stop("raw-write-acknowledged; physical-GHC-may-be-required");
          }
        }catch(_){}
      });
      if(!live())return;
      t.writeAtMs=Date.now();directTestEvent("raw-write-dispatched; original-GHC-guard-active");
      await host.transport.send(t.handle,{type:"text",data:JSON.stringify({type:"request",operation:"write",characteristicUUID:"A002",payload:"04"})});
    }catch(error){
      if(!live())return;
      if(t.writeAtMs===null&&!state.restartTimeoutTimer){stop("espresso-request-failed");abortSequence(`Espresso restart failed: ${error.message||error}`,false);}
      else stop(`raw-attempt-failed; original-GHC-guard-active: ${error.message||error}`);
    }
  }

  function restartPourConfirmed(source, machine) {
    if (state.phase !== "restart_wait" || state.restartSkipTimer !== null) return;
    const pourHasBegun = machine && (machine.substate === "preinfusion" || machine.substate === "pouring");
    if (!machine || machine.machineState !== "espresso" || !pourHasBegun) return;
    clearTimer("restartPollTimer");
    clearTimer("restartTimeoutTimer");
    clearTimer("armReinforceTimer");
    clearTimer("armReinforceTimer2");
    if (state.directStartTest && state.directStartTest.active) {
      state.directStartTest.machineConfirmed = true;
      directTestEvent("pouring-observed");
      cancelDirectStartTest();
    }
    stopGhcPrompt("confirmed", "Espresso preinfusion/pouring observed — continuing HyperEx");
    emitSkinChanged();
    diagnosticEvent("ghc_pour_confirmed", { source, substate: machine.substate, armRequestCount: state.armRequestCount });
    log(`GHC CONFIRMED. Restart pour confirmed via ${source} (${machine.substate}); scheduling skipStep to desired real ${state.cfg.stage2Flow.toFixed(2)} g/s (DE1 command ${resolvedStageCommandFlow("stage2", state.cfg.stage2Flow).toFixed(2)} ml/s).`);
    scheduleRestartSkip();
  }

  function startRestartPoll() {
    clearTimer("restartPollTimer");
    clearTimer("restartTimeoutTimer");
    clearTimer("armReinforceTimer");
    log(`Second-stage Espresso request sent. Wait for the pink GHC light; press the physical GHC Espresso button within ${state.cfg.ghcConfirmTimeoutSeconds.toFixed(1)} s. If no pink light, use RE-ARM.`);
    startGhcCountdown();
    emitSkinChanged();

    // Two bounded automatic reinforcement requests after the full soak. They never
    // run during soak, never extend the 20 s GHC window, and are both cancelled
    // immediately once the second pour actually starts (or the user presses RE-ARM).
    const scheduleArmRetry = (timerName, delaySeconds, ordinal) => {
      if (!(delaySeconds > 0)) return;
      state[timerName] = setTimeout(() => {
        state[timerName] = null;
        if (state.phase !== "restart_wait") return;
        state.armRequestCount += 1;
        state.lastArmRequestAtMs = Date.now();
        diagnosticEvent("auto_arm_retry", { ordinal, requestCount: state.armRequestCount, delaySeconds });
        log(`Second-stage automatic arm reinforcement #${ordinal}: request ${state.armRequestCount} at +${delaySeconds.toFixed(1)} s.`);
        requestMachineState("espresso")
          .then(() => emitSkinChanged())
          .catch((error) => log(`Automatic arm reinforcement #${ordinal} failed: ${error.message || error}`));
      }, delaySeconds * 1000);
    };

    scheduleArmRetry("armReinforceTimer", state.cfg.autoArmRetry1Seconds, 1);
    const retry2 = state.cfg.autoArmRetry2Seconds;
    const retry1 = state.cfg.autoArmRetry1Seconds;
    const retry2Effective = retry2 > 0 && retry1 > 0 && retry2 <= retry1 ? retry1 + 1 : retry2;
    scheduleArmRetry("armReinforceTimer2", retry2Effective, 2);

    state.restartTimeoutTimer = setTimeout(() => {
      state.restartTimeoutTimer = null;
      if (state.phase !== "restart_wait") return;
      log(`>>> GHC TIMEOUT — no second-stage pour detected. Sending Idle and clearing HyperEx state. <<<`);
      requestMachineState("idle").catch((error) => log(`Timeout Idle command failed: ${error.message || error}`));
      resetSequence(`GHC confirmation window ${state.cfg.ghcConfirmTimeoutSeconds.toFixed(1)} s expired`);
    }, state.cfg.ghcConfirmTimeoutSeconds * 1000);

    const poll = async () => {
      if (state.phase !== "restart_wait") return;
      try {
        const snapshot = await getMachineSnapshot();
        const machine = extractMachine(snapshot);
        state.lastMachineState = machine.machineState;
        state.lastSubstate = machine.substate;
        state.lastPressure = machine.pressure;
    state.lastMachineTelemetryValid = machine.telemetryValid === true;
        state.lastFlow = machine.flow;
        const pourHasBegun = machine.substate === "preinfusion" || machine.substate === "pouring";
        if (machine.machineState === "espresso" && pourHasBegun) {
          restartPourConfirmed("REST poll", machine);
          return;
        }
      } catch (error) {
        log(`Restart poll transient error: ${error.message || error}`);
      }
      if (state.phase === "restart_wait") state.restartPollTimer = setTimeout(poll, 150);
    };
    state.restartPollTimer = setTimeout(poll, 120);
  }

  async function manualRearmSecondStage() {
    cancelDirectStartTest(); // Manual recovery also cancels any delayed optional raw write.
    if (state.phase !== "restart_wait") throw new Error("HyperEx is not waiting for second-stage GHC confirmation");
    const now = Date.now();
    if (now - state.lastArmRequestAtMs < 800) throw new Error("RE-ARM throttled; wait a moment");
    // A manual RE-ARM means the user has taken over recovery. Do not surprise them
    // with a later scheduled automatic arm request from the original chain.
    clearTimer("armReinforceTimer");
    clearTimer("armReinforceTimer2");
    state.armRequestCount += 1;
    state.lastArmRequestAtMs = now;
    diagnosticEvent("manual_rearm", { requestCount: state.armRequestCount, cumulativeWeightG: round(state.cumulativeWeight, 3) });
    log(`User RE-ARM request ${state.armRequestCount}; cancelled pending automatic arm retries, preserving cumulative ${state.cumulativeWeight.toFixed(2)} g and current GHC timeout window.`);
    await requestMachineState("espresso");
    emitSkinChanged();
    return uiStatusPayload();
  }

  async function guardedSingleSkip(expectedFrom, expectedTo, reason) {
    let frame = null;
    try {
      const snapshot = await getMachineSnapshot();
      const machine = extractMachine(snapshot);
      const f = Number(machine.profileFrame);
      if (Number.isFinite(f)) frame = Math.floor(f);
    } catch (error) {
      log(`Could not preflight profileFrame before ${reason}: ${error.message || error}; using one bounded skip only.`);
    }
    if (frame === expectedTo) {
      log(`${reason}: profileFrame already ${expectedTo}; no skipStep sent.`);
      return { skipped: false, frame };
    }
    if (frame !== null && frame !== expectedFrom) {
      throw new Error(`${reason}: refusing skipStep because profileFrame=${frame}, expected ${expectedFrom} (or already ${expectedTo})`);
    }
    await requestMachineState("skipStep");
    return { skipped: true, frame: expectedTo };
  }

  function scheduleRestartSkip() {
    if (state.restartSkipTimer !== null || state.phase !== "restart_wait") return;
    state.restartSkipTimer = setTimeout(async () => {
      state.restartSkipTimer = null;
      if (state.phase !== "restart_wait") return;
      try {
        await guardedSingleSkip(0, 1, "restart -> S2");
        state.phase = "stage2";
        startLiveTrim();
        diagnosticEvent("stage2_start", { targetFlowMlS: state.cfg.stage2Flow });
        diagnosticSample("stage2-start", true);
        log(`START stage3: skipped profile frame 0 -> 1; desired real ${state.cfg.stage2Flow.toFixed(2)} g/s, DE1 command ${resolvedStageCommandFlow("stage2", state.cfg.stage2Flow).toFixed(2)} ml/s until cumulative ${state.cfg.stage2Weight.toFixed(2)} g.`);
      } catch (error) {
        abortSequence(`Could not skip to 5 ml/s stage after restart: ${error.message || error}`, true);
      }
    }, 350);
  }

  function beginStage3LowFlow() {
    if (state.stage2SkipSent || state.phase !== "stage2") return;
    state.stage2SkipSent = true;
    diagnosticEvent("stage2_weight_trigger", { cumulativeWeightG: round(state.cumulativeWeight, 3), nextTargetFlowMlS: state.cfg.stage3Flow });
    log(`Cumulative ${state.cumulativeWeight.toFixed(2)} g reached. Advancing to desired real ${state.cfg.stage3Flow.toFixed(2)} g/s (DE1 command ${resolvedStageCommandFlow("stage3", state.cfg.stage3Flow).toFixed(2)} ml/s) final stage.`);
    guardedSingleSkip(1, 2, "S2 -> S3")
      .then(() => {
        if (state.phase === "stage2") {
          state.phase = "stage3";
          diagnosticEvent("stage3_start", { targetFlowMlS: state.cfg.stage3Flow });
          diagnosticSample("stage3-start", true);
          log(`START S3: desired real ${state.cfg.stage3Flow.toFixed(2)} g/s, DE1 command ${resolvedStageCommandFlow("stage3", state.cfg.stage3Flow).toFixed(2)} ml/s until ${state.cfg.finalWeight.toFixed(2)} g.`);
        }
      })
      .catch((error) => abortSequence(`Could not advance to final low-flow stage: ${error.message || error}`, true));
  }

  function finishSequence() {
    if (state.finalStopSent || (state.phase !== "stage2" && state.phase !== "stage3")) return;
    state.finalStopSent = true;
    stopLiveTrim("shot-finished");
    state.phase = "finishing";
    diagnosticEvent("final_weight_trigger", { cumulativeWeightG: round(state.cumulativeWeight, 3) });
    log(`Final cumulative weight ${state.cumulativeWeight.toFixed(2)} g reached. Ending Espresso.`);
    requestMachineState("idle")
      .catch((error) => log(`Final idle command failed: ${error.message || error}`));
  }

  function handlePressureSafety(pressure) {
    if (state.phase === "idle" || state.phase === "soak" || state.phase === "dumping" || state.phase === "finishing" || state.phase === "aborted") {
      state.hardPressureSamples = 0;
      return;
    }
    if (pressure > state.cfg.hardPressureLimit) {
      state.hardPressureSamples += 1;
      if (state.hardPressureSamples >= 3) {
        abortSequence(`Pressure > ${state.cfg.hardPressureLimit.toFixed(2)} bar for 3 samples`, true);
      }
    } else {
      state.hardPressureSamples = 0;
    }
  }

  function handleStateUpdate(payload) {
    const machine = extractMachine(payload);
    state.lastFrame = machine.profileFrame;
    noteMachine(machine);
    observeLiveTrimMachine(machine);

    if (state.phase === 'idle' && state.runtimeProfileVerified &&
        (!profileExecutionEquivalent(state.workflowProfile, profileObject()) || !adaptiveHistoryFingerprint())) {
      invalidateProfileTruth('Profile or calibration context changed before shot start', true);
    }
    const active = state.cfg && state.cfg.enabled && state.armed && state.runtimeProfileVerified;

    // Never allow a HyperEx-labelled workflow to pour while its execution profile
    // differs from the LUT/adaptive profile the plugin believes is current.
    if (state.cfg && state.cfg.enabled && state.workflowTitle === state.cfg.profileTitle && !state.runtimeProfileVerified &&
        machine.machineState === "espresso" && (machine.substate === "preinfusion" || machine.substate === "pouring")) {
      if (!state.runtimeProfileMismatchAbortSent) {
        state.runtimeProfileMismatchAbortSent = true;
        log(`SAFETY STOP: HyperEx workflow started before profile truth was verified (${state.runtimeProfileStatus}). Sending Idle; this run will not enter adaptive history.`);
        requestMachineState("idle").catch(error => log(`Profile-mismatch safety Idle failed: ${error.message || error}`));
      }
      return;
    }

    // Do not arm control during Decaid's preparingForShot/preheat phase.
    // Decaid treats any Idle command before preinfusion/pouring as a preheat abort.
    const pourHasBegun = machine.substate === "preinfusion" || machine.substate === "pouring";

    // Dedicated Flow Calibration never enters the HyperEx dump/soak state machine.
    // It only captures RAW scale + machine telemetry, with the same 8 bar / 3-sample emergency stop.
    if (state.calibrationArmed || state.calibrationActive) {
      handleCalibrationMachine(machine, pourHasBegun).catch(error => {
        log(`Calibration state handler error: ${error.message || error}`);
      });
      return;
    }

    if (active && state.phase === "idle" && machine.machineState === "espresso" && pourHasBegun) {
      const freshScale = state.latestScaleAtMs > 0 && (Date.now() - state.latestScaleAtMs) < 2500;
      startSequence(freshScale ? state.latestRawWeight : null);
      log(`Pour confirmed (${machine.substate}); HyperEx control is now live.`);
    }

    if (state.phase === "idle") {
      if (machine.machineState === 'idle' && !state.runtimeProfileVerified) scheduleProfileVerification('machine idle');
      return;
    }

    handlePressureSafety(machine.pressure);

    if (state.phase === "dumping") {
      // Fast paths. Exact Idle is strongest, but pouringDone or a settled near-zero
      // flow/pressure snapshot is also sufficient after the acknowledged Idle write.
      if (machine.machineState === "idle") {
        confirmDumpIdle("stateUpdate idle", machine);
      } else if (state.dumpAcceptedAtMs &&
                 (Date.now() - state.dumpAcceptedAtMs) >= state.cfg.dumpMinSettleSeconds * 1000 &&
                 dumpLooksReleased(machine)) {
        confirmDumpIdle(`stateUpdate settled (${machine.machineState || "?"}/${machine.substate || "?"})`, machine);
      }
      return;
    }

    // On the second Espresso start, also wait for real preinfusion/pouring before
    // requesting skipStep. Sending skipStep during preparingForShot can abort the shot.
    if (state.phase === "restart_wait" && machine.machineState === "espresso" && pourHasBegun) {
      restartPourConfirmed("stateUpdate", machine);
      return;
    }

    if (state.phase === "finishing" && machine.machineState === "idle") {
      if (state.completionTimer !== null) return;
      const finalWeight = state.cumulativeWeight;
      const sequenceToken = state.sequenceStartedAtMs;
      const run = state.diagnosticCurrent;
      state.completionTimer = setTimeout(() => {
        state.completionTimer = null;
        if (state.phase !== "finishing" || state.sequenceStartedAtMs !== sequenceToken || state.diagnosticCurrent !== run) return;
        resetSequence(`completed at ${finalWeight.toFixed(2)} g`);
      }, 500);
      return;
    }

    // User/manual abort detection. Idle is expected while dumping/soaking/restart_wait.
    if ((state.phase === "stage1" || state.phase === "stage2" || state.phase === "stage3") && machine.machineState === "idle") {
      abortSequence("Machine returned to Idle before the programmed trigger (manual stop or external stop)", false);
    }
  }

  function handleWorkflowUpdated(payload) {
    const title = payload && payload.profile && payload.profile.title ? String(payload.profile.title) : "";
    const previousTitle = state.workflowTitle;
    const previousCalMode = calibrationModeFromTitle(previousTitle);
    const selectedCalMode = calibrationModeFromTitle(title);
    const eventProfile = payload && payload.profile || null;
    if(title===(state.cfg&&state.cfg.profileTitle))adoptWorkflowBrewTemperature(eventProfile,true);
    const unchanged = previousTitle === title && profileExecutionEquivalent(eventProfile, state.workflowProfile) &&
      (!state.cfg || title !== state.cfg.profileTitle || profileExecutionEquivalent(eventProfile, profileObject()));
    if (previousTitle !== title) state.workflowSelectionRevision += 1;
    state.workflowTitle = title;
    state.calibrationArmed = selectedCalMode !== null;
    if (!unchanged || !state.runtimeProfileVerified) {
      invalidateProfileTruth(title === (state.cfg && state.cfg.profileTitle) ? 'workflow notification; GET verification required' : 'not HyperEx', !unchanged && !state.runtimeProfileRepairBusy);
      if (state.diagnosticCurrent && state.diagnosticCurrent.kind === 'hyperex' && !unchanged) state.diagnosticCurrent.config.profileTruthVerified = false;
      if (previousTitle !== title) { state.workflowProfile = null; state.profileReadbackAt = null; }
      if (!state.runtimeProfileRepairBusy) scheduleProfileVerification('workflowUpdated');
    }

    if (selectedCalMode !== null && state.calibrationMode !== selectedCalMode) {
      state.calibrationMode = selectedCalMode;
      storageWrite(STORAGE_CAL_MODE, selectedCalMode);
      log(`Flow Calibration mode auto-selected from profile: ${calibrationModeConfig(selectedCalMode).label}.`);
    }

    if (state.calibrationActive && previousCalMode !== null && title !== previousTitle) {
      finalizeCalibrationRun('interrupted: workflow changed').catch(error => log(`Calibration finalize error: ${error.message || error}`));
    }

    if (state.scopeMode === 'hyperex') {
      if (inHyperExScope(title)) {
        if (selectedCalMode !== null) enterHyperExScopedMultiplier(selectedCalMode !== null ? `Flow Calibration ${calibrationModeConfig(selectedCalMode).label} selected` : 'HyperEx selected')
          .catch(error => log(`Scoped flowMultiplier apply failed: ${error.message || error}`));
      } else {
        restoreHyperExScopedMultiplier('left HyperEx scope')
          .catch(error => log(`Scoped flowMultiplier restore failed: ${error.message || error}`));
      }
    } else if (finiteOrNull(state.scopedOriginalMultiplier) !== null) {
      restoreHyperExScopedMultiplier('scope mode no longer HyperEx-only')
        .catch(error => log(`Scoped flowMultiplier restore failed: ${error.message || error}`));
    }

    recomputeCalibrationUsability();
    if (state.calibrationArmed) {
      log(`FLOW CAL ARMED (${calibrationModeConfig().label}) by workflow '${title}'. EMPTY BASKET: tare scale and start Espresso; let the staircase finish.`);
    } else if (state.armed) {
      const flows = commandFlowSummary();
      log(`ARMED by VERIFIED workflow '${title}'. Real targets ${flows.stage1DesiredGS}/${flows.stage2DesiredGS}/${flows.stage3DesiredGS} g/s -> DE1 commands ${flows.stage1CommandMlS}/${flows.stage2CommandMlS}/${flows.stage3CommandMlS} ml/s.`);
    } else if (title === (state.cfg && state.cfg.profileTitle)) {
      log(`HyperEx selected but NOT ARMED until profile truth is verified: ${state.runtimeProfileStatus}.`);
    } else if (title) {
      log(`Not armed: selected workflow profile is '${title}'.`);
    }
    emitSkinChanged();
  }

  return {
    id: ID,
    version: "0.1.59",

    onLoad(settings) {
      state.cfg = loadConfig(settings || {});
      state.temperatureRecheckNeeded=false;
      state.learningContextLoaded = false;
      state.scopeMode = normalizeScope(state.cfg.flowMultiplierScope);
      state.calibrationMode = normalizeCalibrationMode(state.cfg.calibrationMode);
      state.autoApplyNextShot = state.cfg.autoApplyNextShot !== false;
      state.autoApplyLastStatus = null;
      state.armed = false;
      state.workflowProfile = null;
      state.machineProfileAckKey = "";
      state.calibrationStorageLoaded = false;
      state.overrideStorageLoaded = false;
      state.scopeStorageLoaded = false;
      state.scopedOriginalStorageLoaded = false;
      state.runtimeProfileVerified = false;
      state.runtimeProfileStatus = "not verified";
      state.runtimeProfileMismatchAbortSent = false;
      state.calibrationArmed = false;
      resetSequence();
      log(`Loaded v0.1.59. Stable two-skip topology; scale feedback is validation/advisory only; optional S3 decay-compensation subframes advance by profile time and add no skipStep calls. Dual calibration profiles are installed/updated at first load; HyperEx flow settings are desired REAL mass flow: ${state.cfg.stage1Flow}/${state.cfg.stage2Flow}/${state.cfg.stage3Flow} g/s. flowMultiplier scope=${scopeLabel(state.scopeMode)}. Dashboard idle shortcut=${state.cfg.idleDashboardShortcut ? "enabled" : "off (plugin page primary)"}. Brew state machine remains v0.1.16/v0.1.17 baseline.`);
      connectScaleStream();
      connectWaterLevelStream();
      storageRead(STORAGE_CAL);
      storageRead(STORAGE_SCOPE);
      storageRead(STORAGE_PENDING_MULT);
      storageRead(STORAGE_GLOBAL_PREVIOUS);
      storageRead(STORAGE_SCOPED_ORIGINAL);
      storageRead(STORAGE_CAL_MODE);
      storageRead(STORAGE_S1_STARTUP);
      storageRead(STORAGE_TEST_OVERRIDES);
      storageRead(STORAGE_AUTO_APPLY);
      storageRead(STORAGE_HISTORY_FILE);
      storageRead(STORAGE_ADAPTIVE_HISTORY);
      startPersistentHistoryProbe();
      refreshFlowMultiplier(true).then(() => {
        recomputeCalibrationUsability();
        emitSkinChanged();
      });
      ensureProfileInstalled();
      ensureCalibrationProfilesInstalled();
    },

    async __httpRequestHandler(request) {
      if (request.endpoint === "skin") return pluginHttpJson(request, 200, buildSkinSurfaceAnswer());
      if (request.endpoint === "ui") return pluginHttpHtml(request, 200, buildGhcOverlayHtml());
      if (request.endpoint === "status") return pluginHttpJson(request, 200, uiStatusPayload());
      if (request.endpoint === "advanced-settings") return pluginHttpJson(request, 200, advancedSettingsPayload());
      if (request.endpoint === "diagnostics") {
        const run = state.diagnosticLast;
        return pluginHttpJson(request, run ? 200 : 404, run ? { summary: diagnosticSummary(run), run } : { error: "No diagnostic run captured yet" });
      }
      if (request.endpoint === "diagnostics-csv") {
        const run = state.diagnosticLast;
        return pluginHttpText(request, run ? 200 : 404, "text/csv; charset=utf-8", diagnosticCsv(run), run ? { "Content-Disposition": `attachment; filename=hyperex-${run.runId}.csv` } : {});
      }
      if (request.endpoint === "adaptive-audit") {
        try { return pluginHttpJson(request,200,await adaptiveAuditPayload()); }
        catch(error) { return pluginHttpJson(request,503,{error:String(error.message||error),autoApply:state.autoApplyLastStatus}); }
      }
      if (request.endpoint === "calibration-status") {
        await refreshFlowMultiplier(true);
        if (state.workflowTitle === state.cfg.profileTitle && profileSyncIsIdle()) {
          try { await verifyAndRepairSelectedHyperExProfile('diagnostics refresh'); } catch (_) {}
        }
        return pluginHttpJson(request, 200, calibrationStatusPayload());
      }
      if (request.endpoint === "calibration-mode") {
        try {
          if (state.calibrationActive) throw new Error('Cannot change calibration mode while calibration is running');
          const raw = request.body && request.body.mode !== undefined ? request.body.mode : 'low';
          state.calibrationMode = normalizeCalibrationMode(raw);
          storageWrite(STORAGE_CAL_MODE, state.calibrationMode);
          await ensureCalibrationProfilesInstalled();
          log(`Flow Calibration mode -> ${calibrationModeConfig().label}; dedicated profile '${calibrationProfileTitle(state.calibrationMode)}'.`);
          emitSkinChanged();
          return pluginHttpJson(request, 200, calibrationStatusPayload());
        } catch (error) {
          return pluginHttpJson(request, 409, { error: String(error.message || error), ...calibrationStatusPayload() });
        }
      }
      if (request.endpoint === "adaptive-next-apply") {
        try {
          const result = await applyNextShotAdaptiveSuggestion(state.diagnosticLast, "manual");
          state.autoApplyLastStatus = { runId: result.suggestion.runId, status:"manual-applied", at:new Date().toISOString(), message:"Verified next-shot adaptive override applied manually", commandFlows:result.commandFlows };
          return pluginHttpJson(request, 200, { ...result, ...calibrationStatusPayload() });
        } catch (error) {
          return pluginHttpJson(request, 409, { error: String(error.message || error), ...calibrationStatusPayload() });
        }
      }
      if (request.endpoint === "adaptive-auto-set") {
        try {
          if (state.phase !== "idle" || state.calibrationActive) throw new Error("Auto-apply mode can only be changed while HyperEx is idle");
          state.autoApplyNextShot = !(request.body && request.body.enabled === false);
          storageWrite(STORAGE_AUTO_APPLY, state.autoApplyNextShot ? "true" : "false");
          state.autoApplyLastStatus = { status:"mode", at:new Date().toISOString(), message: state.autoApplyNextShot ? "AUTO APPLY enabled for future completed shots" : "AUTO APPLY disabled; v0.1.39 manual confirmation flow restored" };
          emitSkinChanged();
          log(`AUTO APPLY NEXT SHOT -> ${state.autoApplyNextShot ? "ON" : "OFF"}.`);
          return pluginHttpJson(request, 200, calibrationStatusPayload());
        } catch (error) {
          return pluginHttpJson(request, 409, { error: String(error.message || error), ...calibrationStatusPayload() });
        }
      }
      if (request.endpoint === "test-command-set") {
        try {
          if (!state.cfg) throw new Error("HyperEx configuration unavailable");
          if (state.phase !== "idle" || state.calibrationActive) throw new Error("Manual test commands can only be changed while HyperEx is idle");
          recomputeCalibrationUsability();
          if (!state.calibrationMapUsable) throw new Error(`Calibration LUT is not usable: ${state.calibrationMapStaleReason || "not ready"}`);
          const incoming = request.body && request.body.stages && typeof request.body.stages === "object" ? request.body.stages : {};
          const stages = {};
          for (const stage of ["stage1","stage2","stage3"]) {
            const q = incoming[stage] && typeof incoming[stage] === "object" ? incoming[stage] : {};
            const mode = String(q.mode || "auto").toLowerCase() === "manual" ? "manual" : "auto";
            const command = Number(q.command);
            if (mode === "manual" && (!Number.isFinite(command) || command < LIMITS.commandFlowMin || command > LIMITS.commandFlowMax)) {
              throw new Error(`${stage.toUpperCase()} manual command must be ${LIMITS.commandFlowMin.toFixed(2)}–${LIMITS.commandFlowMax.toFixed(2)} ml/s`);
            }
            stages[stage] = { mode, command: mode === "manual" ? round(clampCommandFlow(command),3) : null };
          }
          const rawShape = request.body && request.body.s3Shape && typeof request.body.s3Shape === "object" ? request.body.s3Shape : {};
          const shapeEnabled = rawShape.enabled === true;
          let s3Shape = { enabled:false };
          if (shapeEnabled) {
            const earlyCommand = Number(rawShape.earlyCommand), midCommand = Number(rawShape.midCommand), lateCommand = Number(rawShape.lateCommand);
            const earlySeconds = Number(rawShape.earlySeconds), midSeconds = Number(rawShape.midSeconds);
            for (const [label,v] of [["EARLY",earlyCommand],["MID",midCommand],["LATE",lateCommand]]) {
              if (!Number.isFinite(v) || v < LIMITS.commandFlowMin || v > LIMITS.commandFlowMax) throw new Error(`S3 ${label} shape command must be ${LIMITS.commandFlowMin.toFixed(2)}–${LIMITS.commandFlowMax.toFixed(2)} ml/s`);
            }
            if (!(earlyCommand <= midCommand && midCommand <= lateCommand)) throw new Error("S3 DECAY COMP commands must satisfy EARLY ≤ MID ≤ LATE");
            if (!Number.isFinite(earlySeconds) || earlySeconds < 3 || earlySeconds > 30 || !Number.isFinite(midSeconds) || midSeconds < 3 || midSeconds > 30) throw new Error("S3 shape EARLY/MID times must be 3–30 seconds");
            const boundedRise = (a,b) => b <= Math.max(a + 0.25, a * 1.35) + 1e-9;
            if (!boundedRise(earlyCommand,midCommand) || !boundedRise(midCommand,lateCommand)) throw new Error("S3 shape adjacent command rise exceeds test bound (max 35% and 0.25 ml/s)");
            s3Shape = { enabled:true, earlyCommand:round(earlyCommand,3), earlySeconds:round(earlySeconds,1), midCommand:round(midCommand,3), midSeconds:round(midSeconds,1), lateCommand:round(lateCommand,3) };
          }
          const binding = testOverrideBinding();
          state.testOverrides = { schema:3, writerVersion:"0.1.59", savedAt:new Date().toISOString(), mapCreatedAt:binding.mapCreatedAt, basketContext:binding.basketContext, targets:binding.targets, stages, s3Shape };
          storageWrite(STORAGE_TEST_OVERRIDES, state.testOverrides);
          await syncHyperExProfile(state.workflowTitle === state.cfg.profileTitle);
          log(`Manual test commands updated: ${JSON.stringify(commandFlowSummary())}`);
          return pluginHttpJson(request, 200, calibrationStatusPayload());
        } catch (error) {
          return pluginHttpJson(request, 409, { error: String(error.message || error), ...calibrationStatusPayload() });
        }
      }
      if (request.endpoint === "test-command-clear") {
        try {
          if (state.phase !== "idle" || state.calibrationActive) throw new Error("Manual test commands can only be changed while HyperEx is idle");
          state.testOverrides = null;
          storageWrite(STORAGE_TEST_OVERRIDES, '');
          await syncHyperExProfile(state.workflowTitle === state.cfg.profileTitle);
          log("Manual test commands cleared; all stages returned to AUTO / LUT.");
          return pluginHttpJson(request, 200, calibrationStatusPayload());
        } catch (error) {
          return pluginHttpJson(request, 409, { error: String(error.message || error), ...calibrationStatusPayload() });
        }
      }
      if (request.endpoint === "calibration-prepare") {
        try {
          const payload = await prepareCalibrationProfile({
            allowUnknownWater: !!(request.body && request.body.allowUnknownWater),
            allowLowMargin: !!(request.body && request.body.allowLowMargin)
          });
          return pluginHttpJson(request, 202, payload);
        } catch (error) {
          return pluginHttpJson(request, 409, { error: String(error.message || error), ...calibrationStatusPayload() });
        }
      }
      if (request.endpoint === "calibration-scope") {
        try {
          const raw = request.body && request.body.scope !== undefined ? request.body.scope : null;
          const next = normalizeScope(raw);
          if (state.scopeMode === 'hyperex' && next !== 'hyperex') await restoreHyperExScopedMultiplier('scope changed');
          state.scopeMode = next;
          storageWrite(STORAGE_SCOPE, next);
          recomputeCalibrationUsability();
          if (next === 'hyperex' && inHyperExScope(state.workflowTitle)) await enterHyperExScopedMultiplier('scope changed to HyperEx only');
          if (next !== 'hyperex') await syncHyperExProfile(state.workflowTitle === state.cfg.profileTitle);
          emitSkinChanged();
          return pluginHttpJson(request, 200, calibrationStatusPayload());
        } catch (error) {
          return pluginHttpJson(request, 409, { error: String(error.message || error), ...calibrationStatusPayload() });
        }
      }
      if (request.endpoint === "calibration-sync") {
        try {
          await refreshFlowMultiplier(true);
          await syncHyperExProfile(state.workflowTitle === state.cfg.profileTitle);
          return pluginHttpJson(request, 200, calibrationStatusPayload());
        } catch (error) {
          return pluginHttpJson(request, 409, { error: String(error.message || error), ...calibrationStatusPayload() });
        }
      }
      if (request.endpoint === "calibration-use-suggested") {
        try {
          recomputeCalibrationUsability();
          const suggested = state.calibrationMap && Number(state.calibrationMap.schema || 0) >= 3 && state.calibrationMap.valid === true ? Number(state.calibrationMap.suggestedFlowMultiplier) : NaN;
          if (!state.calibrationMapUsable || !Number.isFinite(suggested)) throw new Error('No valid/usable calibration map with a suggested multiplier');
          state.calibrationPendingMultiplier = suggested;
          storageWrite(STORAGE_PENDING_MULT, String(suggested));
          log(`Suggested flowMultiplier ${suggested.toFixed(3)} selected for NEXT Flow Calibration. Existing LUT remains tied to ${round(calibrationBaseMultiplier(),3)} until the rerun completes.`);
          return pluginHttpJson(request, 200, calibrationStatusPayload());
        } catch (error) {
          return pluginHttpJson(request, 409, { error: String(error.message || error), ...calibrationStatusPayload() });
        }
      }
      if (request.endpoint === "calibration-apply-global") {
        try {
          recomputeCalibrationUsability();
          const suggested = state.calibrationMap && Number(state.calibrationMap.schema || 0) >= 3 && state.calibrationMap.valid === true ? Number(state.calibrationMap.suggestedFlowMultiplier) : NaN;
          if (!state.calibrationMapUsable || !Number.isFinite(suggested)) throw new Error('No valid/usable calibration map with a suggested multiplier');
          if (finiteOrNull(state.scopedOriginalMultiplier) !== null) await restoreHyperExScopedMultiplier('before global apply');
          const previous = await refreshFlowMultiplier(true);
          if (!Number.isFinite(previous)) throw new Error('Cannot read current DE1 flowMultiplier');
          state.globalPreviousMultiplier = previous;
          storageWrite(STORAGE_GLOBAL_PREVIOUS, String(previous));
          state.scopeMode = 'global';
          storageWrite(STORAGE_SCOPE, 'global');
          await writeFlowMultiplier(suggested, 'explicit GLOBAL apply');
          state.calibrationPendingMultiplier = suggested;
          storageWrite(STORAGE_PENDING_MULT, String(suggested));
          recomputeCalibrationUsability();
          await syncHyperExProfile(state.workflowTitle === state.cfg.profileTitle);
          log(`GLOBAL flowMultiplier applied: ${suggested.toFixed(3)} (previous ${previous.toFixed(3)} saved). Re-run Flow Calibration before trusting the LUT at this multiplier.`);
          emitSkinChanged();
          return pluginHttpJson(request, 200, calibrationStatusPayload());
        } catch (error) {
          return pluginHttpJson(request, 409, { error: String(error.message || error), ...calibrationStatusPayload() });
        }
      }
      if (request.endpoint === "calibration-restore-global") {
        try {
          const previous = finiteOrNull(state.globalPreviousMultiplier);
          if (!Number.isFinite(previous)) throw new Error('No saved pre-global flowMultiplier to restore');
          await writeFlowMultiplier(previous, 'restore pre-global value');
          state.scopeMode = 'off';
          storageWrite(STORAGE_SCOPE, 'off');
          state.calibrationPendingMultiplier = null;
          storageWrite(STORAGE_PENDING_MULT, '');
          recomputeCalibrationUsability();
          await syncHyperExProfile(state.workflowTitle === state.cfg.profileTitle);
          emitSkinChanged();
          return pluginHttpJson(request, 200, calibrationStatusPayload());
        } catch (error) {
          return pluginHttpJson(request, 409, { error: String(error.message || error), ...calibrationStatusPayload() });
        }
      }
      if (request.endpoint === "calibration-clear") {
        state.calibrationMap = null;
        state.calibrationMapUsable = false;
        state.calibrationMapStaleReason = 'calibration cleared';
        state.calibrationPendingMultiplier = null;
        storageWrite(STORAGE_CAL, '');
        state.testOverrides = null; storageWrite(STORAGE_TEST_OVERRIDES, '');
        state.adaptiveHistory = []; state.persistentHistoryCompatibleCount = 0; storageWrite(STORAGE_ADAPTIVE_HISTORY, '');
        storageWrite(STORAGE_PENDING_MULT, '');
        try { await syncHyperExProfile(state.workflowTitle === state.cfg.profileTitle); } catch (_) {}
        emitSkinChanged();
        return pluginHttpJson(request, 200, calibrationStatusPayload());
      }
      if (request.endpoint === "startup-apply") {
        return pluginHttpJson(request, 409, { error: "Legacy startup-apply is disabled in v0.1.59. S1 is handled only by the unified shot-to-shot adaptive engine after two matching MEDIUM-confidence startup shots." });
      }
      if (request.endpoint === "startup-clear") {
        state.stage1StartupCorrection = null; storageWrite(STORAGE_S1_STARTUP, '');
        try { await syncHyperExProfile(state.workflowTitle === state.cfg.profileTitle); } catch (_) {}
        return pluginHttpJson(request, 200, { ok:true, commandFlows: commandFlowSummary() });
      }
      if (request.endpoint === "rearm") {
        try {
          const payload = await manualRearmSecondStage();
          return pluginHttpJson(request, 202, payload);
        } catch (error) {
          return pluginHttpJson(request, state.phase === "restart_wait" ? 429 : 409, { error: String(error.message || error), ...uiStatusPayload() });
        }
      }
      return pluginHttpJson(request, 404, { error: "not found" });
    },

    onUnload() {
      if (state.liveTrim && state.liveTrim.active) requestMachineState("idle").catch(()=>{});
      if (state.directStartTest && state.directStartTest.active) {
        requestMachineState("idle").catch(error=>log(`Direct test unload Idle failed: ${error.message||error}`));
      }
      clearTimer("storageProbeTimer");
      clearTimer("historyWriteTimer");
      if (state.calibrationActive) {
        // Preserve the raw run as diagnostics even if unloading interrupts calibration.
        const run = state.diagnosticCurrent;
        if (run) {
          diagnosticSample('plugin_unload', true);
          run.endedAt = new Date().toISOString();
          run.result = 'interrupted: plugin unloaded';
          state.diagnosticLast = run;
          state.diagnosticCurrent = null;
        }
      } else if (state.diagnosticCurrent) {
        finalizeDiagnostics("plugin unloaded");
      }
      if (finiteOrNull(state.scopedOriginalMultiplier) !== null) {
        restoreHyperExScopedMultiplier('plugin unload').catch(() => {});
      }
      clearAllTimers();
      stopGhcPrompt("cleared", "HyperEx plugin unloaded");
      closeScaleStream();
      log("Unloaded; timers cleared and scale stream closed.");
    },

    onEvent(event) {
      if (!event || !event.name) return;
      if (event.name === "workflowUpdated") {
        handleWorkflowUpdated(event.payload || {});
      } else if (event.name === "stateUpdate") {
        handleStateUpdate(event.payload || {});
      } else if (event.name === "storageRead") {
        const payload = event.payload || {};
        const key = payload.key;
        const value = payload.value;
        if (key === STORAGE_CAL) {
          state.calibrationStorageLoaded = true;
          const parsed = parseStoredJson(value);
          if (parsed && Number(parsed.schema || 0) >= 1) state.calibrationMap = parsed;
          recomputeCalibrationUsability();
          restoreAdaptiveHistoryFromPersistentFile();
          if (state.cfg && state.cfg.calibrationAutoSync && state.calibrationMapUsable) {
            const selected = state.workflowTitle === state.cfg.profileTitle;
            syncHyperExProfile(selected, 'stored calibration loaded').catch(error => log(`Stored calibration auto-sync failed: ${error.message || error}`));
          }
          emitSkinChanged();
        } else if (key === STORAGE_CAL_MODE && value) {
          state.calibrationMode = normalizeCalibrationMode(value);
          emitSkinChanged();
        } else if (key === STORAGE_SCOPE) {
          state.scopeStorageLoaded = true;
          if (value) state.scopeMode = normalizeScope(value);
          recomputeCalibrationUsability();
          scheduleProfileVerification('stored multiplier scope loaded');
          emitSkinChanged();
        } else if (key === STORAGE_PENDING_MULT) {
          const v = value === '' || value === null || value === undefined ? NaN : Number(value);
          state.calibrationPendingMultiplier = Number.isFinite(v) ? v : null;
          emitSkinChanged();
        } else if (key === STORAGE_GLOBAL_PREVIOUS) {
          const v = value === '' || value === null || value === undefined ? NaN : Number(value);
          state.globalPreviousMultiplier = Number.isFinite(v) ? v : null;
        } else if (key === STORAGE_SCOPED_ORIGINAL) {
          state.scopedOriginalStorageLoaded = true;
          const v = value === '' || value === null || value === undefined ? NaN : Number(value);
          state.scopedOriginalMultiplier = Number.isFinite(v) ? v : null;
          if (state.scopedOriginalMultiplier !== null && !inHyperExScope(state.workflowTitle)) {
            restoreHyperExScopedMultiplier('recovery from previous interrupted scoped session').catch(() => {});
          }
          scheduleProfileVerification('stored original multiplier loaded');
        } else if (key === STORAGE_S1_STARTUP) {
          state.stage1StartupCorrection = parseStoredJson(value);
          emitSkinChanged();
        } else if (key === STORAGE_AUTO_APPLY) {
          if (value !== null && value !== undefined && value !== "") state.autoApplyNextShot = b(value, state.cfg ? state.cfg.autoApplyNextShot !== false : true);
          emitSkinChanged();
        } else if (key === STORAGE_HISTORY_PROBE) {
          if (String(value || "") === String(state.storageProbeToken || "") && state.storageProbeToken) {
            state.storageProbeVerified = true;
            state.persistentHistoryStatus = "probe verified; checking history file";
            if (state.storageProbeTimer) { clearTimeout(state.storageProbeTimer); state.storageProbeTimer = null; }
            storageWrite(STORAGE_HISTORY_PROBE, "");
            if (state.persistentHistoryLoaded) persistHistoryFile();
            else state.storageProbeTimer = setTimeout(() => setPersistentHistoryUnavailable('initial history read timed out'), 3500);
            emitSkinChanged();
          }
        } else if (key === STORAGE_HISTORY_FILE) {
          const parsed = parseStoredJson(value);
          if (!state.persistentHistoryLoaded) {
            const sessionRows = state.persistentHistoryFile && state.persistentHistoryFile.shots || [];
            state.persistentHistoryFile = parsed && Number(parsed.schema || 0) >= 2 && Array.isArray(parsed.shots) ? parsed
              : { schema:2, kind:"HyperExAdaptiveHistory", writerVersion:"0.1.59", shots:[] };
            for (const row of sessionRows) {
              state.persistentHistoryFile.shots = state.persistentHistoryFile.shots.filter(x => x && x.runId !== row.runId).concat(row);
            }
            state.persistentHistoryFile.shots = state.persistentHistoryFile.shots.slice(-HISTORY_FILE_MAX_SHOTS);
            state.persistentHistoryLoaded = true;
            state.learningContextLoaded = true;
            if (state.storageProbeVerified) { clearTimer('storageProbeTimer'); persistHistoryFile(); }
          } else if (state.pendingHistoryWrite) {
            if (!parsed || adaptiveHistoryFingerprintKey(parsed) !== adaptiveHistoryFingerprintKey(JSON.parse(state.pendingHistoryWrite))) {
              setPersistentHistoryUnavailable('history file readback mismatch');
            } else {
              clearTimer('historyWriteTimer');
              state.pendingHistoryWrite = null;
              state.persistentHistoryAvailable = true;
              state.persistentHistoryStatus = 'probe and history file write/readback verified';
              if (state.historyWriteDirty) persistHistoryFile();
            }
          }
          restoreAdaptiveHistoryFromPersistentFile();
          scheduleProfileVerification("history context loaded");
          emitSkinChanged();


        } else if (key === STORAGE_ADAPTIVE_HISTORY) {
          const parsed = parseStoredJson(value);
          if (Array.isArray(parsed)) {
            state.legacyAdaptiveHistory = parsed.filter(x => x && typeof x === "object" && x.runId).slice(-8);
            restoreAdaptiveHistoryFromPersistentFile();
          }
          emitSkinChanged();
        } else if (key === STORAGE_TEST_OVERRIDES) {
          state.overrideStorageLoaded = true;
          state.testOverrides = parseStoredJson(value);
          const os = testOverrideStatus();
          if (state.testOverrides && !os.valid && os.reason !== "none") log(`Stored manual test override ignored: ${os.reason}`);
          // Storage returns asynchronously after the initial profile install;
          // resync once so a valid persisted MANUAL TEST command is visible.
          if (state.cfg && state.calibrationStorageLoaded) {
            const selected = state.workflowTitle === state.cfg.profileTitle;
            syncHyperExProfile(selected, 'stored override loaded').catch(error => log(`Stored manual test override sync failed: ${error.message || error}`));
          }
          emitSkinChanged();
        }
      } else if (event.name === "shutdown") {
        clearTimer("storageProbeTimer");
        clearTimer("historyWriteTimer");
        if (finiteOrNull(state.scopedOriginalMultiplier) !== null) restoreHyperExScopedMultiplier('shutdown').catch(() => {});
        clearAllTimers();
      }
    }
  };
}

