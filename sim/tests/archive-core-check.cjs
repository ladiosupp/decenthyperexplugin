// 归档合并内核回归：node sim/tests/archive-core-check.cjs
// 用真实归档做自合并幂等 / 分量回填 / 上限 / 杯末追加 / 旧格式 / 冲突报错。
const assert = require('assert/strict');
const fs = require('fs');
const core = require('../archive-core.js');
const FILE = 'D:/vscode/.tools/hx-data/hyperex-history-all.json';
let pass = 0;
const ok = (cond, name) => { if (cond) { pass++; console.log('  ✓ ' + name); } else { console.log('  ✗ ' + name); process.exitCode = 1; } };

const archive = JSON.parse(fs.readFileSync(FILE, 'utf8'));
console.log('自合并幂等');
const self = core.merge(archive, archive, 0);
ok(self.archive.count === archive.count, '杯数不变 ' + self.archive.count);
ok(self.stats.newShots === 0 && self.stats.duplicates === archive.count, '全重复无新增');
ok(self.archive.fullRecordCount === archive.fullRecordCount, '全点数不变 ' + self.archive.fullRecordCount);
const byId = new Map(self.archive.shots.map(s => [s.runId, s]));
let same = true;
for (const s of archive.shots) {
  const t = byId.get(s.runId);
  const a = (s.fullRecord && s.fullRecord.rawScaleSamples || []).length;
  const b = (t.fullRecord && t.fullRecord.rawScaleSamples || []).length;
  if (a !== b) same = false;
}
ok(same, '每杯 raw 帧数不变');

console.log('分量回填（取最长）');
const withRaw = archive.shots.filter(s => s.fullRecord && (s.fullRecord.rawScaleSamples || []).length);
const donor = withRaw[withRaw.length - 1];
const stripped = JSON.parse(JSON.stringify(archive));
const target = stripped.shots.find(s => s.runId === donor.runId);
target.fullRecord.rawScaleSamples = target.fullRecord.rawScaleSamples.slice(0, 10);
const back = core.merge(stripped, { kind: 'HyperExHistoryExport', shots: [donor] }, 0);
const backShot = back.archive.shots.find(s => s.runId === donor.runId);
ok(backShot.fullRecord.rawScaleSamples.length === donor.fullRecord.rawScaleSamples.length, '短分量被长的一份回填');
ok(back.stats.fullUpdated === 1, 'fullUpdated=1');

console.log('上限滚动');
const capped = core.merge(archive, archive, 10);
ok(capped.archive.count === 10, 'maxShots=10 截到 10');
ok(capped.archive.shots[9].runId === archive.shots[archive.shots.length - 1].runId, '保留最新');

console.log('杯末追加');
const run = { runId: '9999999999999-1', startedAt: '2026-11-14T00:00:00.000Z', result: 'test', samples: [{ tMs: 0 }], rawScaleSamples: [{ tMs: 0 }, { tMs: 100 }], events: [{ tMs: 0, name: 'x' }], liveFlowTrim: { trace: [{ kind: 'armed', tMs: 0 }] } };
const ap = core.appendRun(archive, run, 0);
ok(ap.archive.count === archive.count + 1 && ap.stats.newShots === 1, '新杯 +1');
const ap2 = core.appendRun(ap.archive, run, 0);
ok(ap2.archive.count === ap.archive.count && ap2.stats.newShots === 0, '同 run 再追加不增杯');

console.log('旧格式');
const legacy = { history: { shots: [{ runId: donor.runId, startedAt: donor.startedAt, rawDetail: { rawScaleSamples: donor.fullRecord.rawScaleSamples } }] }, latestRun: null };
const lg = core.merge(core.emptyArchive(), legacy, 0);
ok(lg.archive.count === 1 && lg.archive.shots[0].fullRecord.rawScaleSamples.length === donor.fullRecord.rawScaleSamples.length, 'legacy rawDetail 解包');

console.log('冲突与坏输入');
let threw = false;
try { core.merge(archive, { shots: [{ runId: donor.runId, startedAt: '1999-01-01T00:00:00.000Z' }] }, 0); } catch (e) { threw = /startedAt 冲突/.test(e.message); }
ok(threw, 'startedAt 冲突报错');
threw = false;
try { core.merge(archive, { foo: 1 }, 0); } catch (e) { threw = true; }
ok(threw, '坏格式报错');

console.log(process.exitCode ? '有失败' : '通过，' + pass + '/' + pass);

