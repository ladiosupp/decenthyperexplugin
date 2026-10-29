const $ = (id) => document.getElementById(id);
const STAGE_COLOR = { stage1: 'rgba(110,168,254,.10)', stage2: 'rgba(245,164,66,.10)', stage3: 'rgba(99,216,155,.10)' };
const PHASE_LABEL = { stage1: 'S1', stage2: 'S2', stage3: 'S3', dumping: '泄压', soak: '浸泡', restart_wait: '等 GHC', finishing: '收尾', idle: 'IDLE', aborted: '中止' };
let pinned = null;
let runCount = 0;

function num(id) { return Number($(id).value); }
// No silent clamping: the plugin and the machine each enforce their own limits.
// We only substitute a default when a field is empty or not a number.
function val(id, fallback) {
  const v = Number($(id).value);
  return Number.isFinite(v) ? v : fallback;
}

function readParams() {
  const replayIdx = Number($('replayIdx').value);
  return {
    mode: $('mode').value,
    targets: { s1: val('t1', 2), s2: val('t2', 5), s3: val('t3', 1.5) },
    weights: { s1: val('w1', 4), s2: val('w2', 40), final: val('wf', 100) },
    soakSeconds: val('soak', 10),
    commands: {
      enabled: $('cmdOn').checked,
      s1: val('c1', 0.719),
      s2: val('c2', 2.507),
      s3: val('c3', 0.569),
    },
    liveTrim: { enabled: $('ltOn').checked, level: num('ltLevel') },
    refill: {
      enabled: $('rfOn').checked,
      basis: $('rfBasis').value,
      startDelayMs: val('rfDelay', 0),
      targetPercent: val('rfPct', 160),
      cutoffPercent: val('rfCut', 85),
      maxDurationMs: val('rfMax', 4000),
      approachMs: val('rfAppr', 3000),
    },
    policy: $('policy').value,
    replay: replayIdx >= 0 ? { index: replayIdx } : null,
    plant: {
      efficiency: val('pEff', 100) / 100,
      cupGain: val('pGain', 1.883),
      cupExp: val('pExp', 0.564),
      pumpResponse: val('pResp', 0.35),
      deadTime: val('pDead', 0.2),
      noise: val('pNoise', 0.015),
      rPeak: val('pRPeak', 4.2),
    },
    maxSeconds: val('maxS', 90),
  };
}

async function run() {
  const btn = $('run');
  const started = performance.now();
  btn.disabled = true;
  btn.textContent = '仿真中…';
  $('status').textContent = '仿真中…';
  $('status').classList.add('busy');
  $('cards').style.opacity = '.45';
  try {
    const res = await fetch('/api/run', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(readParams()),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || ('HTTP ' + res.status));
    render(data, readParams());
    runCount += 1;
    $('status').textContent = '完成 · 第 ' + runCount + ' 次 · 仿真 ' + data.ended.seconds + 's / 计算 ' + Math.round(performance.now() - started) + 'ms';
  } catch (e) {
    let msg = String(e.message || e);
    const hint = [
      ['targetPercent', '基础泵倍率需在 100–160%（插件限定）'],
      ['cutoffPercent', '收回阈值需在 70–90%'],
      ['startDelayMs', '启动延时需在 0–1500 ms'],
      ['maxDurationMs', '最长补水需在 500–4000 ms'],
      ['approachMs', '渐进时间需在 1000–6000 ms'],
    ].find(([key]) => msg.includes(key));
    if (hint) msg = hint[1];
    $('status').textContent = '失败：' + msg;
  } finally {
    btn.disabled = false;
    btn.textContent = '运行仿真';
    $('status').classList.remove('busy');
    $('cards').style.opacity = '1';
  }
}

function card(k, v, s, cls) {
  return '<div class="card"><div class="k">' + k + '</div><div class="v ' + (cls || '') + '">' + v +
    '</div><div class="s">' + (s || '') + '</div></div>';
}

function stageCard(name, st, target) {
  if (!st || st.rawRegressionGS == null) return card(name, '—', '无有效窗口');
  const v = st.rawRegressionGS;
  const err = (v / target - 1) * 100;
  const cls = Math.abs(err) <= 12 ? 'good' : Math.abs(err) <= 25 ? 'warn' : 'bad';
  return card(name, v.toFixed(2) + ' g/s', '目标 ' + target + ' · 差 ' + (err >= 0 ? '+' : '') + err.toFixed(1) + '% · ' + (st.validationStatus || ''), cls);
}

function render(r, params) {
  $('meta').textContent = 'plugin ' + r.version + ' · ' + (r.params.mode === 'active' ? '主动泄压' : '连续出杯') +
    (r.replay ? ' · 回放「' + r.replay.title + '」' : '') +
    ' · 效率 ' + Math.round(r.params.plant.efficiency * 100) + '%';

  const s = r.summary || {};
  const targets = r.params.targets;
  let cards = stageCard('S1', s.stage1, targets.s1) + stageCard('S2', s.stage2, targets.s2) + stageCard('S3', s.stage3, targets.s3);
  const rep = r.report || {};
  if (r.applied) {
    cards += card('实际指令 ml/s', Number(r.applied.s1).toFixed(3) + ' / ' + Number(r.applied.s2).toFixed(3) + ' / ' + Number(r.applied.s3).toFixed(3), 'S1 / S2 / S3' + (r.params.commands && r.params.commands.enabled ? ' · 手动覆盖' : ' · 跟随 LUT'));
  }
  cards += card('写入 / 检查', (rep.writes || 0) + ' / ' + (rep.checks || 0), '档位 ' + r.params.liveTrim.level + ' · 重试 ' + (rep.retries || 0) + ' · 缺失目标 ' + (rep.misses || 0));
  cards += card('用时', r.ended.seconds + ' s', '结束 ' + r.ended.weight + ' g · ' + (PHASE_LABEL[r.ended.phase] || r.ended.phase));
  if (r.simRefill && r.simRefill.events && r.simRefill.events.length) {
    const boost = r.simRefill.events.find((e) => e.kind === 'boost');
    const ret = r.simRefill.events.find((e) => e.kind === 'return');
    cards += card('S2 补水（目标基准）', boost ? boost.boostMlS.toFixed(2) + ' ml/s' : '—', '目标折算 ' + r.simRefill.targetPumpMlS + ' ml/s · ' + (ret ? ret.reason : '进行中'));
  } else if (r.plan && r.plan.enabled) {
    cards += card('S2 补水（插件基准）', (r.plan.boostCommandMlS || 0).toFixed(2) + ' ml/s', '基础 ' + (r.plan.baseCommandMlS || 0).toFixed(2) + ' · 收回 ' + Math.round((r.plan.cutoffFraction || 0) * 100) + '% · ' + (r.startup && r.startup.status || 'armed'));
  } else {
    cards += card('S2 补水', r.params.refill.enabled ? '未触发' : '关闭', r.plan && r.plan.reason || '');
  }
  if (pinned) {
    const ps = pinned.summary || {};
    const fmt = (x) => (x && x.rawRegressionGS != null ? x.rawRegressionGS.toFixed(2) : '—');
    cards += card('对照', 'S2 ' + fmt(ps.stage2) + ' → ' + fmt(s.stage2), 'S3 ' + fmt(ps.stage3) + ' → ' + fmt(s.stage3));
  }
  if (r.violations && r.violations.length) {
    cards += card('机器限幅', r.violations.length + ' 次', '泵 ≤' + r.machineLimits.maxFlowMlS + ' ml/s · 压力 ≤' + r.machineLimits.maxPressureBar + ' bar', 'warn');
  } else {
    cards += card('机器限幅', '0 次', '泵 ≤' + r.machineLimits.maxFlowMlS + ' ml/s · 压力 ≤' + r.machineLimits.maxPressureBar + ' bar');
  }
  $('cards').innerHTML = cards;

  const targetFor = (p) => p.phase === 'stage1' ? targets.s1 : p.phase === 'stage2' ? targets.s2 : p.phase === 'stage3' ? targets.s3 : null;
  drawChart($('cFlow'), r.series, [
    { get: (p) => p.cupFlow, color: '#f5a442', width: 2, label: '杯流' },
    { get: targetFor, color: '#8b93a1', width: 1, dash: [5, 4], label: '目标' },
    pinned ? { get: (p) => p.cupFlow, color: '#5c6470', width: 1, dash: [2, 4], label: '对照', data: pinned.series } : null,
  ].filter(Boolean));
  drawChart($('cWeight'), r.series, [
    { get: (p) => p.weight, color: '#6ea8fe', width: 2, label: '重量' },
    pinned ? { get: (p) => p.weight, color: '#5c6470', width: 1, dash: [2, 4], label: '对照', data: pinned.series } : null,
  ].filter(Boolean));
  drawChart($('cPress'), r.series, [
    { get: (p) => p.pressure, color: '#63d89b', width: 1.6, label: '压力' },
    { get: (p) => p.command, color: '#f5a442', width: 1.4, label: '指令' },
  ]);

  const ev = r.trace.filter((x) => x.kind !== 'check').slice(-40)
    .map((x) => x.t.toFixed(2) + 's  ' + x.kind + '  f' + x.frame + (x.commandMlS != null ? '  ' + Number(x.commandMlS).toFixed(3) + ' ml/s' : '') + (x.reason ? '  ' + x.reason : ''));
  const caps = (r.violations || []).map((v) => v.t.toFixed(2) + 's  机器限幅 ' + v.kind + '  请求 ' + v.requested + ' → 实际 ' + v.applied);
  const rf = ((r.simRefill && r.simRefill.events) || []).map((e) => e.t.toFixed(2) + 's  补水 ' + e.kind + (e.boostMlS != null ? '  ' + e.boostMlS + ' ml/s' : '') + (e.reason ? '  ' + e.reason : ''));
  $('events').textContent = ev.concat(caps).concat(rf).join('\n') || '没有写入事件。';
}

function stageBands(ctx, series, x, y0, y1) {
  let start = 0;
  for (let i = 1; i <= series.length; i++) {
    if (i === series.length || series[i].phase !== series[start].phase) {
      const color = STAGE_COLOR[series[start].phase];
      if (color && i > start) {
        ctx.fillStyle = color;
        ctx.fillRect(x(series[start].t), y0, x(series[i - 1].t) - x(series[start].t), y1 - y0);
      }
      start = i;
    }
  }
}

function drawChart(canvas, series, lines) {
  if (!canvas || !series.length) return;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 800, h = canvas.clientHeight || 180;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const pad = { l: 42, r: 10, t: 8, b: 20 };
  const xMax = Math.max.apply(null, series.map((p) => p.t));
  let yMin = Infinity, yMax = -Infinity;
  for (const ln of lines) {
    const data = ln.data || series;
    for (const p of data) {
      const v = ln.get(p);
      if (v == null || !Number.isFinite(v)) continue;
      yMin = Math.min(yMin, v); yMax = Math.max(yMax, v);
    }
  }
  if (!Number.isFinite(yMin)) return;
  if (yMin > 0) yMin = 0;
  const span = Math.max(0.5, yMax - yMin);
  yMax = yMin + span * 1.1;
  const x = (t) => pad.l + (w - pad.l - pad.r) * (t / Math.max(0.001, xMax));
  const y = (v) => h - pad.b - (h - pad.t - pad.b) * ((v - yMin) / (yMax - yMin));

  stageBands(ctx, series, x, pad.t, h - pad.b);

  ctx.strokeStyle = '#2b3038'; ctx.fillStyle = '#7d8592'; ctx.font = '10px ui-monospace,monospace'; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const v = yMin + (yMax - yMin) * i / 4;
    const yy = y(v);
    ctx.beginPath(); ctx.moveTo(pad.l, yy); ctx.lineTo(w - pad.r, yy); ctx.stroke();
    ctx.fillText(v.toFixed(1), 6, yy + 3);
  }
  for (let t = 0; t <= xMax; t += Math.max(5, Math.round(xMax / 6))) {
    ctx.fillText(t + 's', x(t) - 6, h - 5);
  }

  for (const ln of lines) {
    const data = ln.data || series;
    ctx.strokeStyle = ln.color; ctx.lineWidth = ln.width || 1.5;
    ctx.setLineDash(ln.dash || []);
    ctx.beginPath();
    let started = false;
    for (const p of data) {
      const v = ln.get(p);
      if (v == null || !Number.isFinite(v)) { started = false; continue; }
      const px = x(p.t), py = y(v);
      if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.font = '10px sans-serif'; ctx.fillStyle = '#8b93a1';
  let lx = pad.l + 4;
  for (const ln of lines) {
    if (!ln.label) continue;
    ctx.fillStyle = ln.color;
    ctx.fillText('■ ' + ln.label, lx, pad.t + 9);
    lx += ctx.measureText('■ ' + ln.label).width + 14;
  }
}

$('run').addEventListener('click', run);
$('pin').addEventListener('click', () => {
  if (!window.__last) return;
  pinned = window.__last;
  $('status').textContent = '已保存对照';
  render(window.__last, readParams());
});
$('export').addEventListener('click', () => {
  if (!window.__last) return;
  const blob = new Blob([JSON.stringify(window.__last, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'hyperex-sim-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
});

const _origRender = render;
render = function (r, p) { window.__last = r; _origRender(r, p); };

// Fill replay titles from the server and lock the mode select while replaying.
fetch('/api/replays').then((res) => res.json()).then((recs) => {
  const sel = $('replayIdx');
  sel.innerHTML = '<option value="-1">关闭</option>' + recs.map((r) =>
    '<option value="' + r.index + '">' + r.title + '（' + r.duration.toFixed(0) + 's）</option>').join('');
  sel.addEventListener('change', () => {
    $('mode').disabled = Number(sel.value) >= 0;
    if (Number(sel.value) >= 0) $('mode').value = 'continuous';
  });
}).catch(() => {});

run();

