const $ = (id) => document.getElementById(id);
const PHASE_LABEL = { stage1: 'S1', stage2: 'S2', stage3: 'S3', dumping: '泄压', soak: '浸泡', restart_wait: '等 GHC', finishing: '收尾', idle: 'IDLE', aborted: '中止' };
const PHASE_PILL = { stage1: ['#20304d', '#9cc0ff'], stage2: ['#3d2c17', '#f5c078'], stage3: ['#173a2a', '#8fe0b0'], dumping: ['#3d1d22', '#f2a0aa'], soak: ['#322040', '#d5a8f5'], restart_wait: ['#2a2f37', '#cfd5de'], finishing: ['#2a2f37', '#cfd5de'], idle: ['#2a2f37', '#cfd5de'], aborted: ['#3d1d22', '#f2a0aa'] };
const STAGE_COLOR = { stage1: 'rgba(110,168,254,.10)', stage2: 'rgba(245,164,66,.10)', stage3: 'rgba(99,216,155,.10)', dumping: 'rgba(242,144,154,.08)', soak: 'rgba(199,125,255,.08)', restart_wait: 'rgba(139,147,161,.08)', finishing: 'rgba(139,147,161,.06)', aborted: 'rgba(242,144,154,.12)' };

// ---- 状态 ----
let cups = [];            // 归档杯列表（服务端已过滤掉无全点的）
let cup = null;           // 当前杯的完整数据
let frames = [];          // 播放用的帧（rawScaleSamples 优先，其次 samples）
let isRaw = true;
let frameTimes = [];      // 每帧 tMs
let logTimes = [];        // 事件时间（已排序）
let idx = 0;              // 当前帧下标
let playing = 0;          // 0 暂停 / 1 顺放 / -1 倒放
let speed = 1;
let lastTick = 0;
let rafId = 0;
let acc = 0;              // 播放累积的虚拟毫秒
let chartsReady = false;

const fmtT = (ms) => (ms / 1000).toFixed(2) + 's';
const num = (v, d) => (v == null || !Number.isFinite(Number(v))) ? (d == null ? '—' : d) : Number(v);
const f2 = (v) => Number.isFinite(v) ? v.toFixed(2) : '—';
const f3 = (v) => Number.isFinite(v) ? v.toFixed(3) : '—';

function setStatus(msg, busy) {
  $('status').textContent = msg;
  $('status').classList.toggle('busy', !!busy);
}

// ---- 载入 ----
async function loadArchive() {
  const file = $('file').value.trim();
  if (!file) { setStatus('失败：请填归档路径'); return; }
  setStatus('载入归档…', true);
  try {
    const res = await fetch('/api/frame/shots?file=' + encodeURIComponent(file));
    const data = await res.json();
    if (!res.ok || !data.cups) throw new Error(data.error || ('HTTP ' + res.status));
    cups = data.cups;
    $('srcNote').textContent = '共 ' + data.total + ' 杯，' + cups.length + ' 杯有全点/事件可看。';
    setStatus('已载入 ' + cups.length + ' 杯');
    const sel = $('cup');
    sel.innerHTML = cups.map((c) => {
      const d = new Date(c.startedAt);
      const when = Number.isFinite(d.getTime()) ? (d.getMonth() + 1) + '-' + String(d.getDate()).padStart(2, '0') + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') : '';
      const tag = c.playable ? (c.raw ? c.raw + ' 帧' : c.samples + ' 采样') : '仅事件';
      return '<option value="' + c.index + '">' + when + ' · ' + tag + ' · ' + (c.result || '') + '</option>';
    }).join('');
    // 默认选最后一杯有逐帧数据的
    const lastPlayable = cups.map((c, i) => c.playable ? i : -1).filter((i) => i >= 0).pop();
    if (lastPlayable != null) { sel.value = String(cups[lastPlayable].index); await loadCup(cups[lastPlayable].index); }
    else if (cups.length) { sel.value = String(cups[0].index); await loadCup(cups[0].index); }
  } catch (e) {
    setStatus('失败：' + (e.message || e));
  }
}

async function loadCup(index) {
  stop();
  setStatus('载入杯数据…', true);
  try {
    const file = $('file').value.trim();
    const res = await fetch('/api/frame/cup?file=' + encodeURIComponent(file) + '&index=' + index);
    const data = await res.json();
    if (!res.ok || data.ok === false) throw new Error(data.error || ('HTTP ' + res.status));
    cup = data;
    isRaw = (data.rawScaleSamples || []).length > 0;
    frames = isRaw ? data.rawScaleSamples : (data.samples || []);
    frameTimes = frames.map((f) => Number(f.tMs) || 0);
    logTimes = (data.log || []).map((e) => e.tMs);
    idx = 0; acc = 0;
    $('scrub').disabled = frames.length === 0;
    $('scrub').max = String(Math.max(0, frames.length - 1));
    setTransportEnabled(frames.length > 0);
    renderCupInfo();
    buildLog();
    buildCharts();
    paint();
    setStatus('就绪 · ' + (isRaw ? frames.length + ' 帧原始秤数据' : frames.length + ' 个插件采样') + ' · ' + (data.log || []).length + ' 条事件');
  } catch (e) {
    setStatus('失败：' + (e.message || e));
  }
}

function renderCupInfo() {
  const c = cup;
  const stageLine = (name, s) => {
    if (!s || s.rawRegressionGS == null) return name + ' —';
    return name + ' ' + f2(s.rawRegressionGS) + ' g/s（目标 ' + s.targetGS + ' · ' + (s.status || '') + '）';
  };
  const cmd = c.commands || {};
  const cmdLine = ['stage1', 'stage2', 'stage3'].map((k) => {
    const x = cmd[k];
    return x && x.commandMlS != null ? f3(x.commandMlS) : '—';
  }).join(' / ');
  $('cupInfo').innerHTML =
    '<div>runId ' + (c.runId || '—') + '</div>' +
    '<div>插件 ' + (c.pluginVersion || '—') + ' · ' + (c.startedAt || '') + '</div>' +
    '<div>结果 ' + (c.result || '—') + '</div>' +
    '<div style="margin-top:6px">' + stageLine('S1', c.s1) + '</div>' +
    '<div>' + stageLine('S2', c.s2) + '</div>' +
    '<div>' + stageLine('S3', c.s3) + '</div>' +
    '<div style="margin-top:6px">指令 ' + cmdLine + ' ml/s</div>' +
    (c.liveFlowTrim ? '<div>调流 档位' + (c.liveFlowTrim.level != null ? c.liveFlowTrim.level : '—') + ' · 写 ' + (c.liveFlowTrim.writes != null ? c.liveFlowTrim.writes : '—') + ' / 查 ' + (c.liveFlowTrim.checks != null ? c.liveFlowTrim.checks : '—') + ' · ' + (c.liveFlowTrim.status || '') + '</div>' : '');
}

function setTransportEnabled(on) {
  for (const id of ['btnStart', 'btnPrevEv', 'btnBack10', 'btnBack1', 'btnRev', 'btnPlay', 'btnFwd1', 'btnFwd10', 'btnNextEv', 'btnEnd']) $(id).disabled = !on;
}

// ---- 播放引擎 ----
function play(dir) {
  if (!frames.length) return;
  if (playing === dir) { stop(); return; }
  // 到边界再按播放：从头/尾重新开始
  if (dir > 0 && idx >= frames.length - 1) seek(0);
  if (dir < 0 && idx <= 0) seek(frames.length - 1);
  playing = dir;
  acc = 0;
  lastTick = performance.now();
  updatePlayButtons();
  rafId = requestAnimationFrame(tick);
}

function stop() {
  playing = 0;
  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0;
  updatePlayButtons();
}

function updatePlayButtons() {
  $('btnPlay').textContent = playing === 1 ? '暂停 ⏸' : '顺放 ▶';
  $('btnRev').textContent = playing === -1 ? '暂停 ⏸' : '◀ 倒放';
  $('btnPlay').classList.toggle('active', playing === 1);
  $('btnRev').classList.toggle('active', playing === -1);
}

function tick(now) {
  if (!playing) return;
  const dt = Math.min(200, now - lastTick); // 切后台回来不跳一大段
  lastTick = now;
  acc += dt * speed;
  let moved = false;
  if (playing > 0) {
    while (idx < frames.length - 1 && acc >= frameTimes[idx + 1] - frameTimes[idx]) {
      acc -= frameTimes[idx + 1] - frameTimes[idx];
      idx++; moved = true;
    }
    if (idx >= frames.length - 1) {
      if ($('loop').checked) { seek(0); acc = 0; }
      else { stop(); moved = true; }
    }
  } else {
    while (idx > 0 && acc >= frameTimes[idx] - frameTimes[idx - 1]) {
      acc -= frameTimes[idx] - frameTimes[idx - 1];
      idx--; moved = true;
    }
    if (idx <= 0) {
      if ($('loop').checked) { seek(frames.length - 1); acc = 0; }
      else { stop(); moved = true; }
    }
  }
  if (moved) paint();
  if (playing) rafId = requestAnimationFrame(tick);
}

function seek(i) {
  if (!frames.length) return;
  idx = Math.max(0, Math.min(frames.length - 1, i));
  acc = 0;
  paint();
}

function step(n) { stop(); seek(idx + n); }

function jumpEvent(dir) {
  if (!logTimes.length) return;
  stop();
  const t = frameTimes[idx] || 0;
  let target = null;
  if (dir > 0) { for (const lt of logTimes) { if (lt > t + 1) { target = lt; break; } } }
  else { for (let i = logTimes.length - 1; i >= 0; i--) { if (logTimes[i] < t - 1) { target = logTimes[i]; break; } } }
  if (target == null) { seek(dir > 0 ? frames.length - 1 : 0); return; }
  // 顺跳取事件时刻之后的第一帧、逆跳取之前的最后一帧，
  // 避免落在事件前的帧上导致下一次跳转又找到同一条事件。
  seek(dir > 0 ? frameAtOrAfter(target) : frameAtOrBefore(target));
}

function nearestFrame(tMs) {
  if (!frameTimes.length) return 0;
  let lo = 0, hi = frameTimes.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (frameTimes[mid] <= tMs) lo = mid; else hi = mid; }
  return (tMs - frameTimes[lo] <= frameTimes[hi] - tMs) ? lo : hi;
}

function frameAtOrAfter(tMs) {
  let lo = 0, hi = frameTimes.length - 1;
  if (tMs > frameTimes[hi]) return hi;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (frameTimes[mid] < tMs) lo = mid + 1; else hi = mid; }
  return lo;
}

function frameAtOrBefore(tMs) {
  let lo = 0, hi = frameTimes.length - 1;
  if (tMs < frameTimes[0]) return 0;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (frameTimes[mid] > tMs) hi = mid - 1; else lo = mid; }
  return lo;
}

// ---- 每帧刷新 ----
function paint() {
  $('scrub').value = String(idx);
  const f = frames[idx];
  const tMs = frames.length ? (frameTimes[idx] || 0) : -1;
  $('pos').textContent = frames.length ? (idx + 1) + ' / ' + frames.length + ' · ' + fmtT(tMs) : '— / —';
  renderCards(f, tMs);
  drawCursor();
  highlightLog(tMs);
}

function renderCards(f, tMs) {
  if (!f) {
    $('cards').innerHTML = '<div class="card" style="grid-column:1/-1"><div class="k">本杯</div><div class="v">无逐帧数据</div><div class="s">' +
      ((cup && cup.log) || []).length + ' 条事件/轨迹在下方，点击行看详情。</div></div>';
    return;
  }
  const phase = f.phase || '';
  const card = (k, v, s, cls) => '<div class="card"><div class="k">' + k + '</div><div class="v ' + (cls || '') + '">' + v + '</div><div class="s">' + (s || '') + '</div></div>';
  const raw = isRaw ? f : null;
  const sm = isRaw ? nearestSample(tMs) : f;
  const weight = raw ? num(raw.weightG) : num(sm && sm.scaleWeightG);
  const cum = sm ? num(sm.cumulativeWeightG) : null;
  const decaid = raw ? num(raw.decaidWeightFlowGS) : num(sm && sm.decaidWeightFlowGS);
  const rawDw = raw ? num(raw.rawDwDtGS) : num(sm && sm.rawScaleDwDtGS);
  const press = raw ? num(raw.pressureBar) : num(sm && sm.pressureBar);
  const mflow = raw ? num(raw.machineFlowMlS) : num(sm && sm.machineFlowMlS);
  const target = raw ? num(raw.targetFlowMlS) : num(sm && sm.targetFlowMlS);
  const frameNo = raw ? raw.profileFrame : (sm ? sm.profileFrame : null);
  const phys = raw ? raw.physicalProfileFrame : (sm ? sm.physicalProfileFrame : null);
  let html = '';
  html += card('时刻', fmtT(tMs), '帧 ' + (idx + 1) + ' / ' + frames.length + (raw && raw.tareReset ? ' · tare/reset' : ''));
  const pill = PHASE_PILL[phase] || ['#2a2f37', '#cfd5de'];
  html += card('相位', '<span class="phasepill" style="background:' + pill[0] + ';color:' + pill[1] + '">' + (PHASE_LABEL[phase] || phase || '—') + '</span>', '逻辑帧 ' + (frameNo == null ? '—' : frameNo) + ' · 物理帧 ' + (phys == null ? '—' : phys));
  html += card('秤重', f2(weight) + ' g', cum != null && Number.isFinite(cum) ? '插件累计 ' + f2(cum) + ' g' : '');
  html += card('decaid 杯流', f2(decaid) + ' g/s', 'RAW dW/dt ' + f2(rawDw) + ' g/s');
  html += card('压力', f2(press) + ' bar', '', press > 8 ? 'bad' : press > 6 ? 'warn' : '');
  html += card('机器流量', f2(mflow) + ' ml/s', '目标 ' + f3(target) + ' ml/s');
  $('cards').innerHTML = html;
}

// samples 比 raw 稀疏：找 tMs 最近的一条，用来补累计重量等插件视角字段
let sampleTimes = [];
function nearestSample(tMs) {
  const sm = cup && cup.samples;
  if (!sm || !sm.length) return null;
  if (sampleTimes.length !== sm.length) sampleTimes = sm.map((s) => Number(s.tMs) || 0);
  let lo = 0, hi = sm.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (sampleTimes[mid] <= tMs) lo = mid; else hi = mid; }
  return (tMs - sampleTimes[lo] <= sampleTimes[hi] - tMs) ? sm[lo] : sm[hi];
}

// ---- 事件日志 ----
function logLine(e) {
  const d = e.data || {};
  let detail = '';
  if (e.src === 'trace') {
    if (e.name === 'write') detail = f3(d.commandMlS) + ' ml/s' + (d.previousMlS != null ? ' ← ' + f3(d.previousMlS) : '') + (d.startupAction ? ' · ' + d.startupAction : '') + (d.retry ? ' · retry' : '');
    else if (e.name === 'check') detail = (d.decision || '') + (d.reason ? ' · ' + d.reason : '');
    else if (e.name === 'driver-ack') detail = 'f' + d.frame + ' · ' + d.latencyMs + 'ms';
    else if (e.name === 'machine-target-response') detail = f3(d.commandMlS) + ' ml/s · ' + d.latencyMs + 'ms';
    else detail = Object.keys(d).filter((k) => k !== 'kind' && k !== 'tMs').slice(0, 3).map((k) => k + '=' + (typeof d[k] === 'object' ? '…' : d[k])).join(' ');
  } else {
    detail = Object.keys(d).slice(0, 4).map((k) => k + '=' + (typeof d[k] === 'object' ? '…' : d[k])).join(' ');
  }
  return { t: e.tMs, tag: (e.src === 'trace' ? '调流·' : '') + e.name, detail, phase: e.phase };
}

let logRows = [];
function buildLog() {
  const box = $('log');
  box.innerHTML = '';
  logRows = [];
  const frag = document.createDocumentFragment();
  (cup.log || []).forEach((e, i) => {
    const L = logLine(e);
    const row = document.createElement('div');
    row.className = 'row' + (e.src === 'trace' ? ' trace' : '');
    row.innerHTML = '<span class="t">' + fmtT(L.t) + '</span><span class="tag" title="' + L.tag + '">' + L.tag + '</span><span class="d" title="' + escapeHtml(L.detail) + '">' + (L.phase ? '[' + (PHASE_LABEL[L.phase] || L.phase) + '] ' : '') + L.detail + '</span>';
    row.addEventListener('click', () => { stop(); if (frames.length) seek(nearestFrame(L.t)); else showEvent(i); });
    frag.appendChild(row);
    logRows.push(row);
  });
  box.appendChild(frag);
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// 仅事件杯：点日志行看这条事件的完整 data
function showEvent(i) {
  const e = cup.log[i];
  if (!e) return;
  if (lastLogHi >= 0 && logRows[lastLogHi]) logRows[lastLogHi].classList.remove('now');
  lastLogHi = i;
  logRows[i].classList.add('now');
  $('cards').innerHTML =
    '<div class="card"><div class="k">时刻</div><div class="v">' + fmtT(e.tMs) + '</div><div class="s">' + (e.src === 'trace' ? '调流轨迹' : '事件') + '</div></div>' +
    '<div class="card"><div class="k">名称</div><div class="v" style="font-size:14px">' + escapeHtml(e.name) + '</div><div class="s">' + (PHASE_LABEL[e.phase] || e.phase || '') + '</div></div>' +
    '<div class="card" style="grid-column:1/-1"><div class="k">data</div><pre class="evdata">' + escapeHtml(JSON.stringify(e.data == null ? {} : e.data, null, 1)) + '</pre></div>';
}

let lastLogHi = -1;
function highlightLog(tMs) {
  // 找 <= tMs 的最后一条
  let hi = -1;
  for (let i = 0; i < logTimes.length; i++) { if (logTimes[i] <= tMs) hi = i; else break; }
  if (hi === lastLogHi) return;
  if (lastLogHi >= 0 && logRows[lastLogHi]) logRows[lastLogHi].classList.remove('now');
  if (hi >= 0 && logRows[hi]) {
    logRows[hi].classList.add('now');
    const box = $('log');
    const row = logRows[hi];
    const top = row.offsetTop - box.offsetTop;
    if (top < box.scrollTop || top > box.scrollTop + box.clientHeight - 24) box.scrollTop = top - box.clientHeight / 2;
  }
  lastLogHi = hi;
}

// ---- 图表（全量曲线 + 当前帧游标） ----
const chartDefs = [
  { id: 'cFlow', lines: [
    { get: (f) => num(f.decaidWeightFlowGS, null), color: '#c77dff', width: 1.6, label: 'decaid 杯流' },
    { get: (f) => num(isRaw ? f.rawDwDtGS : f.rawScaleDwDtGS, null), color: '#63d89b', width: 1, dash: [2, 3], label: 'RAW dW/dt' },
  ] },
  { id: 'cWeight', lines: [
    { get: (f) => num(isRaw ? f.weightG : f.scaleWeightG, null), color: '#6ea8fe', width: 2, label: '秤重' },
    { get: (f) => { const s = isRaw ? nearestSample(Number(f.tMs) || 0) : f; return s ? num(s.cumulativeWeightG, null) : null; }, color: '#f5a442', width: 1.2, dash: [4, 3], label: '插件累计' },
  ] },
  { id: 'cPress', lines: [
    { get: (f) => num(f.pressureBar, null), color: '#63d89b', width: 1.6, label: '压力' },
    { get: (f) => num(f.machineFlowMlS, null), color: '#6ea8fe', width: 1.2, label: '机器流量' },
    { get: (f) => num(f.targetFlowMlS, null), color: '#f5a442', width: 1.2, dash: [5, 4], label: '目标指令' },
  ] },
];
let chartGeo = [];

function buildCharts() {
  sampleTimes = [];
  chartGeo = [];
  chartBase = [];
  for (const def of chartDefs) {
    // RAW dW/dt 是秤差分噪声（tare/换相瞬间尖峰可达十几 g/s），默认不叠，
    // 需要看原始差分时勾选；Y 轴只按可见曲线取范围。
    const lines = def.id === 'cFlow' && !$('rawToggle').checked
      ? def.lines.filter((l) => l.label !== 'RAW dW/dt') : def.lines;
    const view = { id: def.id, lines };
    const canvas = $(def.id);
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 800, h = canvas.clientHeight || 180;
    canvas.width = w * dpr; canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const pad = { l: 42, r: 10, t: 8, b: 20 };
    const xMax = Math.max(0.001, (frameTimes[frameTimes.length - 1] || 0) / 1000);
    let yMin = Infinity, yMax = -Infinity;
    for (const ln of lines) for (const f of frames) {
      const v = ln.get(f);
      if (v == null || !Number.isFinite(v)) continue;
      yMin = Math.min(yMin, v); yMax = Math.max(yMax, v);
    }
    if (!Number.isFinite(yMin)) { yMin = 0; yMax = 1; }
    // RAW 差分有孤立尖峰（秤时间戳量化）：只约束 RAW 线——轴按其 p99 定，画时跳过突变值
    let rawCap = Infinity;
    const rawLine = lines.find((l) => l.label === 'RAW dW/dt');
    if (rawLine) {
      const rv = [];
      for (const f of frames) { const v = rawLine.get(f); if (v != null && Number.isFinite(v)) rv.push(v); }
      if (rv.length > 20) {
        rv.sort((a, b) => a - b);
        rawCap = rv[Math.floor((rv.length - 1) * 0.99)];
        yMax = -Infinity;
        for (const ln of lines) for (const f of frames) {
          let v = ln.get(f);
          if (v == null || !Number.isFinite(v)) continue;
          if (ln === rawLine) v = Math.min(v, rawCap);
          yMax = Math.max(yMax, v);
        }
      }
    }
    if (!frames.length) {
      ctx.fillStyle = '#7d8592'; ctx.font = '12px sans-serif';
      ctx.fillText('无帧数据（仅事件/轨迹）', w / 2 - 78, h / 2);
    }
    if (yMin > 0) yMin = 0;
    const span = Math.max(0.5, yMax - yMin);
    yMax = yMin + span * 1.1;
    const x = (t) => pad.l + (w - pad.l - pad.r) * (t / xMax);
    const y = (v) => h - pad.b - (h - pad.t - pad.b) * ((v - yMin) / (yMax - yMin));
    // 相位底色
    let start = 0;
    for (let i = 1; i <= frames.length; i++) {
      if (i === frames.length || frames[i].phase !== frames[start].phase) {
        const color = STAGE_COLOR[frames[start].phase];
        if (color && i > start) {
          ctx.fillStyle = color;
          ctx.fillRect(x(frameTimes[start] / 1000), pad.t, x(frameTimes[i - 1] / 1000) - x(frameTimes[start] / 1000), h - pad.b - pad.t);
        }
        start = i;
      }
    }
    // 网格
    ctx.strokeStyle = '#2b3038'; ctx.fillStyle = '#7d8592'; ctx.font = '10px ui-monospace,monospace'; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const v = yMin + (yMax - yMin) * i / 4;
      const yy = y(v);
      ctx.beginPath(); ctx.moveTo(pad.l, yy); ctx.lineTo(w - pad.r, yy); ctx.stroke();
      ctx.fillText(v.toFixed(1), 6, yy + 3);
    }
    for (let t = 0; t <= xMax; t += Math.max(5, Math.round(xMax / 6))) ctx.fillText(t + 's', x(t) - 6, h - 5);
    // 曲线
    for (const ln of lines) {
      ctx.strokeStyle = ln.color; ctx.lineWidth = ln.width || 1.5;
      ctx.setLineDash(ln.dash || []);
      ctx.save(); ctx.beginPath(); ctx.rect(pad.l, pad.t, w - pad.l - pad.r, h - pad.t - pad.b); ctx.clip();
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < frames.length; i++) {
        const v = ln.get(frames[i]);
        if (v == null || !Number.isFinite(v) || (ln === rawLine && v > rawCap)) { started = false; continue; }
        const px = x(frameTimes[i] / 1000), py = y(v);
        if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
    // 图例
    ctx.font = '10px sans-serif';
    let lx = pad.l + 4;
    for (const ln of lines) {
      ctx.fillStyle = ln.color;
      ctx.fillText('■ ' + ln.label, lx, pad.t + 9);
      lx += ctx.measureText('■ ' + ln.label).width + 14;
    }
    // 写入时刻标记（调流 trace 的 write）：压力图顶部小三角
    if (def.id === 'cPress' && cup && cup.log) {
      ctx.fillStyle = '#e8833a';
      for (const e of cup.log) {
        if (e.src !== 'trace' || e.name !== 'write') continue;
        const px = x(e.tMs / 1000);
        ctx.beginPath();
        ctx.moveTo(px - 4, pad.t + 12); ctx.lineTo(px + 4, pad.t + 12); ctx.lineTo(px, pad.t + 19);
        ctx.closePath(); ctx.fill();
      }
      ctx.fillText('▲ 写入', lx, pad.t + 9);
    }
    chartGeo.push({ canvas, ctx, def: view, x, y, w, h, pad, dpr, yMin, yMax });
  }
  chartsReady = true;
  // 点图定位
  for (const g of chartGeo) {
    g.canvas.onclick = (ev) => {
      if (!frames.length) return;
      const rect = g.canvas.getBoundingClientRect();
      const px = ev.clientX - rect.left;
      const xMax = Math.max(0.001, (frameTimes[frameTimes.length - 1] || 0) / 1000);
      const t = Math.max(0, Math.min(xMax, (px - g.pad.l) / (g.w - g.pad.l - g.pad.r) * xMax));
      stop();
      seek(nearestFrame(t * 1000));
    };
  }
}

// 游标画在曲线之上：先恢复底图再画竖线。底图用离屏 canvas 缓存。
let chartBase = [];
function drawCursor() {
  if (!chartsReady || !frames.length) return;
  if (chartBase.length !== chartGeo.length) {
    chartBase = chartGeo.map((g) => {
      const off = document.createElement('canvas');
      off.width = g.canvas.width; off.height = g.canvas.height;
      off.getContext('2d').drawImage(g.canvas, 0, 0);
      return off;
    });
  }
  const t = (frameTimes[idx] || 0) / 1000;
  chartGeo.forEach((g, i) => {
    g.ctx.setTransform(1, 0, 0, 1, 0, 0);
    g.ctx.clearRect(0, 0, g.canvas.width, g.canvas.height);
    g.ctx.drawImage(chartBase[i], 0, 0);
    g.ctx.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);
    const px = g.x(t);
    g.ctx.strokeStyle = '#e8833a'; g.ctx.lineWidth = 1.5;
    g.ctx.beginPath(); g.ctx.moveTo(px, g.pad.t); g.ctx.lineTo(px, g.h - g.pad.b); g.ctx.stroke();
    g.ctx.fillStyle = '#e8833a'; g.ctx.font = '10px ui-monospace,monospace';
    const label = fmtT(frameTimes[idx] || 0);
    const lw = g.ctx.measureText(label).width;
    g.ctx.fillText(label, Math.min(px + 4, g.w - g.pad.r - lw), g.pad.t + 20);
    // 各曲线在当前帧的点
    for (const ln of g.def.lines) {
      const v = ln.get(frames[idx]);
      if (v == null || !Number.isFinite(v)) continue;
      g.ctx.fillStyle = ln.color;
      g.ctx.beginPath(); g.ctx.arc(px, g.y(v), 3, 0, Math.PI * 2); g.ctx.fill();
    }
  });
}

// ---- 事件绑定 ----
$('load').addEventListener('click', loadArchive);
$('cup').addEventListener('change', () => loadCup(Number($('cup').value)));
$('btnPlay').addEventListener('click', () => play(1));
$('btnRev').addEventListener('click', () => play(-1));
$('btnBack1').addEventListener('click', () => step(-1));
$('btnFwd1').addEventListener('click', () => step(1));
$('btnBack10').addEventListener('click', () => step(-10));
$('btnFwd10').addEventListener('click', () => step(10));
$('btnStart').addEventListener('click', () => { stop(); seek(0); });
$('btnEnd').addEventListener('click', () => { stop(); seek(frames.length - 1); });
$('btnPrevEv').addEventListener('click', () => jumpEvent(-1));
$('btnNextEv').addEventListener('click', () => jumpEvent(1));
$('speed').addEventListener('change', () => { speed = Number($('speed').value) || 1; });
$('scrub').addEventListener('input', () => { stop(); seek(Number($('scrub').value)); });
$('rawToggle').addEventListener('change', () => { if (cup) { buildCharts(); paint(); } });

document.addEventListener('keydown', (ev) => {
  const tag = (ev.target && ev.target.tagName) || '';
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
  // 焦点在按钮上时把空格让给按钮原生点击，避免「全局快捷键 + 按钮 click」双重触发
  if (tag === 'BUTTON') return;
  if (ev.code === 'Space') { ev.preventDefault(); if (playing) stop(); else play(1); }
  else if (ev.key === 'ArrowLeft') { ev.preventDefault(); step(ev.shiftKey ? -10 : -1); }
  else if (ev.key === 'ArrowRight') { ev.preventDefault(); step(ev.shiftKey ? 10 : 1); }
  else if (ev.key === 'Home') { ev.preventDefault(); stop(); seek(0); }
  else if (ev.key === 'End') { ev.preventDefault(); stop(); seek(frames.length - 1); }
  else if (ev.key === 'PageUp') { ev.preventDefault(); jumpEvent(-1); }
  else if (ev.key === 'PageDown') { ev.preventDefault(); jumpEvent(1); }
});

let resizeTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if (cup) { buildCharts(); chartBase = []; paint(); } }, 150);
});

// ---- 图表卡长按拖动排序（⠿ 把手；顺序存 localStorage）----
const CHART_IDS = ['cFlow', 'cWeight', 'cPress'];
function chartBoxes() { return CHART_IDS.map((id) => document.querySelector('.chartbox[data-chart="' + id + '"]')).filter(Boolean); }
function applyChartOrder(order) {
  const view = document.querySelector('section.view');
  const logBox = document.querySelector('.chartbox:last-of-type');
  const byId = {};
  chartBoxes().forEach((b) => { byId[b.dataset.chart] = b; });
  const seq = (Array.isArray(order) ? order : []).filter((id) => byId[id]);
  CHART_IDS.forEach((id) => { if (!seq.includes(id)) seq.push(id); });
  seq.forEach((id) => view.insertBefore(byId[id], logBox));
}
function saveChartOrder() {
  const order = [...document.querySelectorAll('section.view .chartbox[data-chart]')].map((b) => b.dataset.chart);
  try { localStorage.setItem('hx-replay-chart-order', JSON.stringify(order)); } catch (e) {}
}
function initChartDrag() {
  const view = document.querySelector('section.view');
  let drag = null;
  const arm = (handle, ev) => {
    if (drag || (ev.button != null && ev.button !== 0)) return;
    const box = handle.closest('.chartbox');
    const x0 = ev.clientX, y0 = ev.clientY;
    const timer = setTimeout(() => begin(box, x0, y0), 350);
    const cancel = () => { clearTimeout(timer); handle.removeEventListener('pointermove', preMove); handle.removeEventListener('pointerup', cancel); handle.removeEventListener('pointercancel', cancel); };
    const preMove = (e) => { if (Math.hypot(e.clientX - x0, e.clientY - y0) > 8) cancel(); };
    handle.addEventListener('pointermove', preMove);
    handle.addEventListener('pointerup', cancel);
    handle.addEventListener('pointercancel', cancel);
  };
  const begin = (box, x0, y0) => {
    const rect = box.getBoundingClientRect();
    const ghost = box.cloneNode(true);
    ghost.classList.add('chartghost');
    ghost.style.width = rect.width + 'px';
    document.body.appendChild(ghost);
    box.classList.add('dragging');
    document.body.classList.add('chart-dragging');
    drag = { box, ghost, dx: x0 - rect.left, dy: y0 - rect.top };
    moveGhost(x0, y0);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };
  const moveGhost = (x, y) => { drag.ghost.style.transform = 'translate(' + (x - drag.dx) + 'px,' + (y - drag.dy) + 'px)'; };
  const onMove = (e) => {
    if (!drag) return;
    e.preventDefault();
    moveGhost(e.clientX, e.clientY);
    const boxes = chartBoxes().filter((b) => b !== drag.box);
    let target = null;
    for (const b of boxes) {
      const r = b.getBoundingClientRect();
      if (e.clientY >= r.top && e.clientY <= r.bottom) { target = { el: b, before: e.clientY < r.top + r.height / 2 }; break; }
    }
    if (!target && boxes.length) {
      const first = boxes[0].getBoundingClientRect(), last = boxes[boxes.length - 1].getBoundingClientRect();
      if (e.clientY < first.top) target = { el: boxes[0], before: true };
      else if (e.clientY > last.bottom) target = { el: boxes[boxes.length - 1], before: false };
    }
    chartBoxes().forEach((b) => b.classList.remove('drop-target'));
    if (target) {
      target.el.classList.add('drop-target');
      view.insertBefore(drag.box, target.before ? target.el : target.el.nextSibling);
    }
    const vr = view.getBoundingClientRect();
    if (e.clientY < vr.top + 40) view.scrollTop -= 8;
    else if (e.clientY > vr.bottom - 40) view.scrollTop += 8;
  };
  const onUp = () => {
    if (!drag) return;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    drag.ghost.remove();
    drag.box.classList.remove('dragging');
    document.body.classList.remove('chart-dragging');
    chartBoxes().forEach((b) => b.classList.remove('drop-target'));
    drag = null;
    saveChartOrder();
    if (cup) { buildCharts(); chartBase = []; paint(); }
  };
  document.querySelectorAll('.charthandle').forEach((h) => {
    h.addEventListener('pointerdown', (ev) => arm(h, ev));
    h.addEventListener('contextmenu', (ev) => ev.preventDefault());
  });
}
try { applyChartOrder(JSON.parse(localStorage.getItem('hx-replay-chart-order') || 'null')); } catch (e) {}
initChartDrag();

loadArchive();

