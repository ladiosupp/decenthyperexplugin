// HyperEx 历史归档合并内核（纯函数，无 DOM / Node 依赖）。
// 口径移植自 hyperex-history 技能的 hx-archive.mjs：按 runId 去重，
// 摘要全留，全点按分量取最长的一份（samples / rawScaleSamples / events /
// liveFlowTrim.trace 各自独立回填）。插件端、仿真台、APK 壳共用这一份。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HxArchive = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var ARRAY_KEYS = ['samples', 'rawScaleSamples', 'events'];

  function emptyArchive() {
    return { kind: 'HyperExHistoryArchive', schema: 1, updatedAt: null, count: 0, fullRecordCount: 0, shots: [] };
  }

  function cleanSummary(shot) {
    var s = Object.assign({}, shot);
    delete s.fullRecord; delete s.rawDetail; delete s.samples; delete s.rawScaleSamples; delete s.events;
    return s;
  }

  function hasAnyFull(fr) {
    if (!fr) return false;
    if (Array.isArray(fr.samples) && fr.samples.length) return true;
    if (Array.isArray(fr.rawScaleSamples) && fr.rawScaleSamples.length) return true;
    if (Array.isArray(fr.events) && fr.events.length) return true;
    if (fr.liveFlowTrim && Array.isArray(fr.liveFlowTrim.trace) && fr.liveFlowTrim.trace.length) return true;
    return false;
  }

  function shotStartedAt(shot, runId) {
    if (shot && shot.startedAt) return String(shot.startedAt);
    var n = Number(String(runId).split('-')[0]);
    if (Number.isFinite(n) && n > 1000000000000) return new Date(n).toISOString();
    return null;
  }

  function fullCandidates(shot, isNew) {
    var out = [];
    if (isNew) {
      if (shot.fullRecord) out.push(shot.fullRecord);
      if (shot.liveFlowTrim && Array.isArray(shot.liveFlowTrim.trace) && shot.liveFlowTrim.trace.length) {
        out.push({ samples: null, rawScaleSamples: null, events: null, liveFlowTrim: shot.liveFlowTrim });
      }
      return out;
    }
    if (shot.rawDetail) out.push(shot.rawDetail);
    var own = { samples: shot.samples, rawScaleSamples: shot.rawScaleSamples, events: shot.events, liveFlowTrim: shot.liveFlowTrim };
    if (hasAnyFull(own)) out.push(own);
    return out;
  }

  // 识别三种形状：归档 / 新导出 {shots} / 旧导出 {history:{shots}, latestRun}
  function normalizeExport(j) {
    if (!j || typeof j !== 'object') throw new Error('不是 JSON 对象');
    if (j.kind === 'HyperExHistoryArchive') return { format: 'archive', entries: (j.shots || []).map(function (s) { return { shot: s, fulls: s.fullRecord ? [s.fullRecord] : [] }; }) };
    if (Array.isArray(j.shots)) return { format: 'shots', entries: j.shots.map(function (s) { return { shot: s, fulls: fullCandidates(s, true) }; }) };
    if (j.history && Array.isArray(j.history.shots)) {
      var entries = j.history.shots.map(function (s) { return { shot: s, fulls: fullCandidates(s, false) }; });
      if (j.latestRun && j.latestRun.runId) {
        var lr = j.latestRun;
        var full = { samples: lr.samples, rawScaleSamples: lr.rawScaleSamples, events: lr.events, liveFlowTrim: lr.liveFlowTrim };
        var target = entries.find(function (e) { return e.shot.runId === lr.runId; });
        if (target) target.fulls.push(full);
        else if (lr.summary) entries.push({ shot: lr.summary, fulls: [full] });
      }
      return { format: 'legacy', entries: entries };
    }
    throw new Error('无法识别的导出格式');
  }

  function applyFull(rec, fr) {
    if (!fr) return false;
    var changed = false;
    for (var i = 0; i < ARRAY_KEYS.length; i++) {
      var key = ARRAY_KEYS[i], v = fr[key], cur = rec.fullRecord[key];
      if (Array.isArray(v) && v.length > (Array.isArray(cur) ? cur.length : 0)) { rec.fullRecord[key] = v; changed = true; }
    }
    var trim = fr.liveFlowTrim;
    if (trim && typeof trim === 'object') {
      var curT = rec.fullRecord.liveFlowTrim;
      var curLen = curT && Array.isArray(curT.trace) ? curT.trace.length : 0;
      var nextLen = Array.isArray(trim.trace) ? trim.trace.length : 0;
      if (!curT || nextLen > curLen) { rec.fullRecord.liveFlowTrim = trim; changed = true; }
    }
    return changed;
  }

  function loadRecords(archive) {
    var map = new Map();
    var shots = (archive && archive.shots) || [];
    for (var i = 0; i < shots.length; i++) {
      var shot = shots[i];
      var runId = shot && shot.runId;
      if (!runId) throw new Error('归档中有缺少 runId 的杯');
      if (map.has(runId)) throw new Error('归档中 runId 重复: ' + runId);
      var full = shot.fullRecord || {};
      map.set(runId, {
        runId: runId,
        summary: cleanSummary(shot),
        startedAt: shotStartedAt(shot, runId),
        fullRecord: { samples: full.samples || null, rawScaleSamples: full.rawScaleSamples || null, events: full.events || null, liveFlowTrim: full.liveFlowTrim || null }
      });
    }
    return map;
  }

  // 合并一份导出（或归档）进 records；返回统计。startedAt 冲突直接报错。
  function mergeExport(records, norm) {
    var src = { format: norm.format, shots: norm.entries.length, newShots: 0, duplicates: 0, fullUpdated: 0 };
    var fullSet = new Set();
    for (var i = 0; i < norm.entries.length; i++) {
      var shot = norm.entries[i].shot;
      if (!shot || typeof shot.runId !== 'string' || !shot.runId) throw new Error('缺少 runId：第 ' + (i + 1) + ' 杯');
      var runId = shot.runId;
      var startedAt = shotStartedAt(shot, runId);
      var rec = records.get(runId);
      if (!rec) {
        rec = { runId: runId, summary: cleanSummary(shot), startedAt: startedAt, fullRecord: { samples: null, rawScaleSamples: null, events: null, liveFlowTrim: null } };
        records.set(runId, rec);
        src.newShots++;
      } else {
        src.duplicates++;
        if (rec.startedAt && startedAt && rec.startedAt !== startedAt) throw new Error('同一 runId 的 startedAt 冲突: ' + runId);
        if (!rec.startedAt && startedAt) rec.startedAt = startedAt;
        rec.summary = Object.assign({}, rec.summary, cleanSummary(shot));
      }
      var fulls = norm.entries[i].fulls;
      for (var k = 0; k < fulls.length; k++) if (applyFull(rec, fulls[k])) fullSet.add(runId);
    }
    src.fullUpdated = fullSet.size;
    return src;
  }

  function buildArchive(records, maxShots) {
    var rows = Array.from(records.values());
    rows.sort(function (a, b) { return String(a.startedAt || '').localeCompare(String(b.startedAt || '')) || String(a.runId).localeCompare(String(b.runId)); });
    if (maxShots > 0 && rows.length > maxShots) rows = rows.slice(-maxShots);
    var shots = rows.map(function (r) { return Object.assign({}, r.summary, { runId: r.runId, startedAt: r.startedAt || r.summary.startedAt || null, fullRecord: r.fullRecord }); });
    var fullCount = 0;
    for (var i = 0; i < shots.length; i++) if (hasAnyFull(shots[i].fullRecord)) fullCount++;
    return { kind: 'HyperExHistoryArchive', schema: 1, updatedAt: new Date().toISOString(), count: shots.length, fullRecordCount: fullCount, shots: shots };
  }

  // 一步合并：archive + 导出 JSON → { archive, stats }
  function merge(archive, exportJson, maxShots) {
    var records = loadRecords(archive || emptyArchive());
    var stats = mergeExport(records, normalizeExport(exportJson));
    return { archive: buildArchive(records, maxShots || 0), stats: stats };
  }

  // 杯末追加：把当前 run 的全点直接并进归档（插件端用，不经导出形状）
  function appendRun(archive, run, maxShots) {
    var records = loadRecords(archive || emptyArchive());
    var shot = cleanSummary(run);
    var rec = records.get(run.runId);
    var isNew = !rec;
    if (!rec) {
      rec = { runId: run.runId, summary: shot, startedAt: shotStartedAt(run, run.runId), fullRecord: { samples: null, rawScaleSamples: null, events: null, liveFlowTrim: null } };
      records.set(run.runId, rec);
    } else {
      rec.summary = Object.assign({}, rec.summary, shot);
    }
    applyFull(rec, { samples: run.samples, rawScaleSamples: run.rawScaleSamples, events: run.events, liveFlowTrim: run.liveFlowTrim });
    return { archive: buildArchive(records, maxShots || 0), stats: { newShots: isNew ? 1 : 0 } };
  }

  return { emptyArchive: emptyArchive, normalizeExport: normalizeExport, merge: merge, appendRun: appendRun, hasAnyFull: hasAnyFull, loadRecords: loadRecords, buildArchive: buildArchive };
});

