// 帧重放接口回归：node sim/tests/frame-replay-check.cjs（需 server 已在 4780 跑）
// 只读校验 /api/frame/shots、/api/frame/cup 与静态页，不跑插件、不改归档。
const BASE = 'http://127.0.0.1:' + (process.env.SIM_PORT || 4780);
const FILE = 'D:/vscode/.tools/hx-data/hyperex-history-all.json';
let pass = 0, fail = 0;
function ok(cond, name, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  [' + extra + ']' : '')); }
}
async function get(path) {
  const res = await fetch(BASE + path);
  return { status: res.status, body: await res.json() };
}
(async () => {
  const fs = require('fs');
  const archive = JSON.parse(fs.readFileSync(FILE, 'utf8'));

  console.log('静态页');
  for (const p of ['/replay', '/replay.js']) {
    const res = await fetch(BASE + p);
    ok(res.status === 200, p + ' 200', String(res.status));
  }

  console.log('/api/frame/shots');
  const list = await get('/api/frame/shots');
  ok(list.status === 200, '默认归档 200');
  const cups = list.body.cups || [];
  ok(list.body.total === archive.shots.length, 'total = 归档杯数', list.body.total + ' vs ' + archive.shots.length);
  const playable = cups.filter((c) => c.playable);
  const evOnly = cups.filter((c) => !c.playable);
  const playableExpect = archive.shots.filter((s) => { const fr = s.fullRecord || {}; return ((fr.rawScaleSamples || []).length + (fr.samples || []).length) > 0; }).length;
  ok(playable.length === playableExpect, '可逐帧杯数 = 归档全点杯数', playable.length + ' vs ' + playableExpect);
  ok(evOnly.every((c) => c.events + c.trace > 0), '仅事件杯都有事件/轨迹');
  ok(cups.every((c) => archive.shots[c.index] && archive.shots[c.index].runId === c.runId), 'index 对回原归档 runId');

  console.log('/api/frame/cup（最后一杯，逐帧）');
  const last = playable[playable.length - 1];
  const cup = await get('/api/frame/cup?index=' + last.index);
  ok(cup.status === 200, '200');
  const src = archive.shots[last.index].fullRecord;
  ok(cup.body.rawScaleSamples.length === src.rawScaleSamples.length, 'raw 帧数一致', cup.body.rawScaleSamples.length + ' vs ' + src.rawScaleSamples.length);
  ok(cup.body.samples.length === src.samples.length, 'samples 数一致');
  const log = cup.body.log;
  const nonLft = src.events.filter((e) => e.name !== 'live_flow_trim').length;
  ok(log.length === nonLft + src.liveFlowTrim.trace.length, 'log = 非调流事件 + trace', log.length + ' vs ' + (nonLft + src.liveFlowTrim.trace.length));
  ok(log.every((e, i) => i === 0 || log[i - 1].tMs <= e.tMs), 'log 按时间有序');
  ok(!log.some((e) => e.src === 'event' && e.name === 'live_flow_trim'), '有 trace 时去掉重复 live_flow_trim 事件');
  ok(cup.body.rawScaleSamples.every((f) => Number.isFinite(f.tMs)), '每帧 tMs 有效');
  ok(cup.body.liveFlowTrim && cup.body.liveFlowTrim.writes === src.liveFlowTrim.writes, '调流概要一致');

  console.log('/api/frame/cup（仅事件杯）');
  const ev = evOnly[0];
  const evCup = await get('/api/frame/cup?index=' + ev.index);
  ok(evCup.status === 200 && evCup.body.rawScaleSamples.length === 0 && evCup.body.log.length > 0, '无帧但有事件');

  console.log('错误路径');
  const bad = await get('/api/frame/cup?index=99999');
  ok(bad.status === 400 && bad.body.ok === false, '越界 index → 400');
  const badFile = await get('/api/frame/shots?file=D:/no-such-file.json');
  ok(badFile.status === 400, '不存在的文件 → 400');

  console.log(fail === 0 ? '通过，' + pass + '/' + (pass + fail) : '失败 ' + fail + ' 项（共 ' + (pass + fail) + '）');
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });

