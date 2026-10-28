const $ = (id) => document.getElementById(id);
const STAGE_COLOR = { stage1: 'rgba(110,168,254,.10)', stage2: 'rgba(245,164,66,.10)', stage3: 'rgba(99,216,155,.10)' };
const PHASE_LABEL = { stage1: 'S1', stage2: 'S2', stage3: 'S3', dumping: '泄压', soak: '浸泡', restart_wait: '等 GHC', finishing: '收尾', idle: 'IDLE', aborted: '中止' };
let pinned = null;

function num(id) { return Number($(id).value); }

function readParams() {
  return {
    mode: $('mode').value,
    targets: { s1: num('t1'), s2: num('t2'), s3: num('t3') },
    weights: { s1: num('w1'), s2: num('w2'), final: num('wf') },
    soakSeconds: num('soak'),
    liveTrim: { enabled: $('ltOn').checked, level: num('ltLevel') },
    refill: {
      enabled: $('rfOn').checked, startDelayMs: num('rfDelay'), targetPercent: num('rfPct'),
      cutoffPercent: num('rfCut'), maxDurationMs: num('rfMax'), approachMs: num('rfAppr'),
    },
    policy: $('policy').value,
    plant: {
      efficiency: num('pEff') / 100, tau: num('pTau'), deadTime: num('pDead'),
      noise: num('pNoise'), pressureK: num('pK'),
    },
    maxSeconds: num('maxS'),
  };
}

async function run() {
  const btn = $('run');
  btn.disabled = true;
  $('status').textContent = '仿真中…';
  try {
    const res = await fetch('/api/run', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(readParams()),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || ('HTTP ' + res.status));
    render(data, readParams());
    $('status').textContent = '完成 · ' + data.ended.seconds + 's';
  } catch (e) {
    $('status').textContent = '失败：' + e.message;
  } finally {
    btn.disabled = false;
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
    ' · 效率 ' + Math.round(r.params.plant.efficiency * 100) + '%';

  const s = r.summary || {};
  const targets = r.params.targets;
  let cards = stageCard('S1', s.stage1, targets.s1) + stageCard('S2', s.stage2, targets.s2) + stageCard('S3', s.stage3, targets.s3);
  const rep = r.report || {};
  cards += card('写入 / 检查', (rep.writes || 0) + ' / ' + (rep.checks || 0), '档位 ' + r.params.liveTrim.level + ' · 重试 ' + (rep.retries || 0) + ' · 缺失目标 ' + (rep.misses || 0));
  cards += card('用时', r.ended.seconds + ' s', '结束 ' + r.ended.weight + ' g · ' + (PHASE_LABEL[r.ended.phase] || r.ended.phase));
  if (r.plan && r.plan.enabled) {
    cards += card('S2 补水', (r.plan.boostCommandMlS || 0).toFixed(2) + ' ml/s', '基础 ' + (r.plan.baseCommandMlS || 0).toFixed(2) + ' · 收回 ' + Math.round((r.plan.cutoffFraction || 0) * 100) + '% · ' + (r.startup && r.startup.status || 'armed'));
  } else {
    cards += card('S2 补水', r.params.refill.enabled ? '未触发' : '关闭', r.plan && r.plan.reason || '');
  }
  if (pinned) {
    const ps = pinned.summary || {};
    const fmt = (x) => (x && x.rawRegressionGS != null ? x.rawRegressionGS.toFixed(2) : '—');
    cards += card('对照', 'S2 ' + fmt(ps.stage2) + ' → ' + fmt(s.stage2), 'S3 ' + fmt(ps.stage3) + ' → ' + fmt(s.stage3));
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
  $('events').textContent = ev.length ? ev.join('\n') : '没有写入事件。';
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
run();

