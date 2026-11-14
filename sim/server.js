const http = require('http');
const fs = require('fs');
const path = require('path');
const { runShot, plantDefaults, recordings, historyRecordings } = require('./harness');

const PORT = Number(process.env.SIM_PORT || 4780);
const PUB = path.join(__dirname, 'public');

function send(res, status, body, type) {
  res.writeHead(status, {
    'Content-Type': type || 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function staticFile(res, name) {
  const file = path.join(PUB, name);
  if (!file.startsWith(PUB) || !fs.existsSync(file)) return send(res, 404, 'not found', 'text/plain');
  const ext = path.extname(file);
  const type = ext === '.html' ? 'text/html; charset=utf-8' : ext === '.js' ? 'text/javascript; charset=utf-8' : 'text/plain; charset=utf-8';
  send(res, 200, fs.readFileSync(file), type);
}

const server = http.createServer((req, res) => {
  console.log(new Date().toISOString(), req.method, req.url.slice(0, 120));
  if (req.method === 'POST' && req.url === '/api/run') {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 2e6) req.destroy(); });
    req.on('end', async () => {
      try {
        const params = body ? JSON.parse(body) : {};
        const result = await runShot(params);
        send(res, 200, JSON.stringify(result));
      } catch (e) {
        console.error(e);
        send(res, 500, JSON.stringify({ ok: false, error: String((e && e.message) || e) }));
      }
    });
    return;
  }
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) return staticFile(res, 'index.html');
  if (req.method === 'GET' && req.url === '/app.js') return staticFile(res, 'app.js');
  if (req.method === 'GET' && (req.url === '/replay' || req.url === '/replay.html')) return staticFile(res, 'replay.html');
  if (req.method === 'GET' && req.url === '/replay.js') return staticFile(res, 'replay.js');
  if (req.method === 'GET' && req.url === '/api/defaults') {
    return send(res, 200, JSON.stringify({ plant: plantDefaults() }));
  }
  if (req.method === 'GET' && req.url === '/api/replays') {
    const recs = (recordings() || []).map((r, i) => ({ index: i, title: r.title, duration: r.duration, preinfusionStopSec: r.preinfusionStopSec, weightEnd: r.frames && r.frames[r.frames.length - 1] ? r.frames[r.frames.length - 1].w : 0 }));
    return send(res, 200, JSON.stringify(recs));
  }
  if (req.method === 'GET' && req.url.startsWith('/api/history')) {
    const q = new URL(req.url, 'http://x').searchParams;
    const file = q.get('file') || '';
    try {
      const recs = (historyRecordings(fs.readFileSync(file, 'utf8')) || []).map((r, i) => ({
        index: i, title: r.title, result: r.result, duration: r.duration, weightEnd: r.weightEnd,
        startedAt: r.startedAt, frames: r.frames.length, source: 'hyperex',
      }));
      return send(res, 200, JSON.stringify({ file, cups: recs }));
    } catch (e) {
      return send(res, 400, JSON.stringify({ ok: false, error: String((e && e.message) || e) }));
    }
  }
  // ---- 帧重放：直接读历史归档的全点数据（不跑插件） ----
  if (req.method === 'GET' && req.url.startsWith('/api/frame/shots')) {
    const q = new URL(req.url, 'http://x').searchParams;
    const file = q.get('file') || FRAME_DEFAULT_FILE;
    try {
      const shots = frameShots(file);
      const cups = shots.map((s, index) => {
        const rec = fullRecordOf(s);
        const raw = Array.isArray(rec.rawScaleSamples) ? rec.rawScaleSamples : [];
        const samples = Array.isArray(rec.samples) ? rec.samples : [];
        const events = Array.isArray(rec.events) ? rec.events : [];
        const trace = rec.liveFlowTrim && Array.isArray(rec.liveFlowTrim.trace) ? rec.liveFlowTrim.trace : [];
        const frames = raw.length ? raw : samples;
        return {
          index, runId: s.runId || '', startedAt: s.startedAt || '', pluginVersion: s.pluginVersion || '',
          result: s.result ? String(s.result) : '',
          profileTitle: s.profileTitle || '', releaseMode: s.releaseMode || '',
          workflowTitle: (s.workflowProfileCommands && s.workflowProfileCommands.title) || '',
          raw: raw.length, samples: samples.length, events: events.length, trace: trace.length,
          durationMs: frames.length ? Number(frames[frames.length - 1].tMs) || 0 : 0,
          playable: frames.length > 0,
        };
      }).filter((c) => c.playable || c.events > 0 || c.trace > 0);
      return send(res, 200, JSON.stringify({ file, total: shots.length, cups }));
    } catch (e) {
      return send(res, 400, JSON.stringify({ ok: false, error: String((e && e.message) || e) }));
    }
  }
  if (req.method === 'GET' && req.url.startsWith('/api/frame/cup')) {
    const q = new URL(req.url, 'http://x').searchParams;
    const file = q.get('file') || FRAME_DEFAULT_FILE;
    const index = Number(q.get('index'));
    try {
      const shots = frameShots(file);
      const shot = shots[index];
      if (!shot) throw new Error('没有这一杯：index ' + index);
      const rec = fullRecordOf(shot);
      const raw = Array.isArray(rec.rawScaleSamples) ? rec.rawScaleSamples : [];
      const samples = Array.isArray(rec.samples) ? rec.samples : [];
      const events = Array.isArray(rec.events) ? rec.events : [];
      const lt = rec.liveFlowTrim && typeof rec.liveFlowTrim === 'object' ? rec.liveFlowTrim : null;
      const trace = lt && Array.isArray(lt.trace) ? lt.trace : [];
      // trace 保留得更全；有 trace 时事件里的 live_flow_trim 是重复项，去掉。
      const log = events.filter((e) => trace.length === 0 || e.name !== 'live_flow_trim')
        .map((e) => ({ tMs: Number(e.tMs) || 0, src: 'event', name: e.name || '', phase: e.phase || '', data: e.data }))
        .concat(trace.map((t) => ({ tMs: Number(t.tMs) || 0, src: 'trace', name: t.kind || '', phase: t.phase || '', data: t })))
        .sort((a, b) => a.tMs - b.tMs);
      return send(res, 200, JSON.stringify({
        runId: shot.runId, startedAt: shot.startedAt, pluginVersion: shot.pluginVersion, result: shot.result,
        s1: shot.s1, s2: shot.s2, s3: shot.s3, commands: shot.commands,
        liveFlowTrim: lt ? { enabled: lt.enabled, level: lt.level, status: lt.status, writes: lt.writes, checks: lt.checks } : null,
        rawScaleSamples: raw, samples, log,
      }));
    } catch (e) {
      return send(res, 400, JSON.stringify({ ok: false, error: String((e && e.message) || e) }));
    }
  }
  send(res, 404, 'not found', 'text/plain');
});

const FRAME_DEFAULT_FILE = 'D:/vscode/.tools/hx-data/hyperex-history-all.json';
let frameCache = { file: '', mtimeMs: 0, shots: null };

function frameShots(file) {
  const stat = fs.statSync(file);
  if (frameCache.file !== file || frameCache.mtimeMs !== stat.mtimeMs) {
    const json = JSON.parse(fs.readFileSync(file, 'utf8'));
    frameCache = { file, mtimeMs: stat.mtimeMs, shots: Array.isArray(json.shots) ? json.shots : [] };
  }
  return frameCache.shots;
}

function fullRecordOf(shot) {
  return shot && shot.fullRecord && typeof shot.fullRecord === 'object' ? shot.fullRecord : shot;
}

server.listen(PORT, '0.0.0.0', () => {
  console.log('HyperEx sim: http://127.0.0.1:' + PORT + ' (listening on all interfaces)');
});

