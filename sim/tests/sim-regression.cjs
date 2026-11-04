// Simulator regressions for the 2026-11-04 changes:
//  - historyRecordings accepts the 2.2.30+ fullRecord export shape;
//  - a replay file with no replayable cup fails loudly instead of silently
//    falling back to a synthetic shot;
//  - plant.paperCondition blends the two measured paper states;
//  - commands.shape reaches the plugin's S3 shape override;
//  - optional: warm handoff from the real 2026-11-03 history file.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const H = require('../harness');

function nestedExport() {
  return {
    kind: 'hyperex-history', pluginVersion: 'test', exportedAt: '2026-11-04T00:00:00.000Z',
    shots: [{
      runId: 'nested-1', pluginVersion: 'test', startedAt: '2026-11-04T00:00:00.000Z', result: 'completed at 100 g',
      fullRecord: {
        samples: [
          { tMs: 0, phase: 'stage2', profileFrame: 1, targetFlowMlS: 4.3, machineFlowMlS: 4.0, pressureBar: 1.2, weightG: 0, decaidWeightFlowGS: 4.5 },
          { tMs: 100, phase: 'stage2', profileFrame: 1, targetFlowMlS: 4.3, machineFlowMlS: 4.1, pressureBar: 1.2, weightG: 0.45, decaidWeightFlowGS: 4.5 },
        ],
        rawScaleSamples: [
          { tMs: 0, phase: 'stage2', profileFrame: 1, targetFlowMlS: 4.3, machineFlowMlS: 4.0, pressureBar: 1.2, weightG: 0, decaidWeightFlowGS: 4.5 },
          { tMs: 100, phase: 'stage2', profileFrame: 1, targetFlowMlS: 4.3, machineFlowMlS: 4.1, pressureBar: 1.2, weightG: 0.45, decaidWeightFlowGS: 4.5 },
        ],
      },
    }],
  };
}

(async () => {
  // 1. nested fullRecord shape
  const recs = H.historyRecordings(JSON.stringify(nestedExport()));
  assert.strictEqual(recs.length, 1, 'nested fullRecord should produce one replayable cup');
  assert.strictEqual(recs[0].frames.length, 2);
  assert.strictEqual(recs[0].frames[1].phase, 'stage2');
  assert.strictEqual(recs[0].frames[1].frame, 1);
  console.log('ok historyRecordings fullRecord');

  // 2. no replayable cup: loud failure, not a silent synthetic shot
  const tmp = path.join(os.tmpdir(), `hyperex-empty-${process.pid}.json`);
  fs.writeFileSync(tmp, JSON.stringify({ shots: [{ runId: 'empty', fullRecord: {} }] }));
  await assert.rejects(() => H.runShot({ replay: { file: tmp, index: 0 } }), /replayable cup/);
  fs.unlinkSync(tmp);
  console.log('ok empty replay fails loudly');

  // 3. paperCondition endpoints and midpoint
  const base = { mode: 'continuous', maxSeconds: 8, graphFromStage2: false };
  const low = await H.runShot({ ...base, plant: { paper: 'low', pump: 'realDe1' } });
  const cond0 = await H.runShot({ ...base, plant: { paperCondition: 0, pump: 'realDe1' } });
  const high = await H.runShot({ ...base, plant: { paper: 'high', pump: 'realDe1' } });
  const cond1 = await H.runShot({ ...base, plant: { paperCondition: 1, pump: 'realDe1' } });
  const mid = await H.runShot({ ...base, plant: { paperCondition: 0.5, pump: 'realDe1' } });
  for (const key of ['cupGain', 'cupExp', 'rPeak']) {
    assert.ok(Math.abs(low.params.plant[key] - cond0.params.plant[key]) < 1e-9, `paperCondition 0 should equal low ${key}`);
    assert.ok(Math.abs(high.params.plant[key] - cond1.params.plant[key]) < 1e-9, `paperCondition 1 should equal high ${key}`);
    assert.ok(Math.abs(mid.params.plant[key] - (low.params.plant[key] + high.params.plant[key]) / 2) < 1e-9, `paperCondition 0.5 should be the midpoint ${key}`);
  }
  console.log('ok paperCondition 0/0.5/1');

  // 4. S3 shape override reaches the applied stage-3 command
  const shaped = await H.runShot({
    mode: 'continuous', maxSeconds: 120, graphFromStage2: false,
    commands: { enabled: true, s1: 0.719, s2: 2.507, s3: 0.56, shape: { earlyCommand: 0.9, earlySeconds: 6, midCommand: 0.56, midSeconds: 10, lateCommand: 0.7 } },
    plant: { paperCondition: 0.5, pump: 'realDe1' },
  });
  assert.strictEqual(shaped.applied.s3, 0.56);
  assert.ok(shaped.summary.stage3.commandFlowAvg > 0.6, 'shape average should include the early/late points');
  console.log('ok S3 shape override');

  // 5. optional real-file handoff (local checkout only)
  const real = 'C:/Users/ladios/Downloads/hyperex-history (7).json';
  if (fs.existsSync(real)) {
    const r = await H.runShot({
      replay: { file: real, index: 2 },
      handoff: { phase: 'stage2', frame: 1 },
      targets: { s1: 3, s2: 5, s3: 1.5 }, weights: { s1: 4, s2: 40, final: 100 },
      commands: { enabled: true, s1: 1.938, s2: 4.313, s3: 0.625, shape: { earlyCommand: 0.938, earlySeconds: 8, midCommand: 0.625, midSeconds: 14, lateCommand: 0.75 } },
      refill: { enabled: false }, plant: { paper: 'low', pump: 'realDe1' }, maxSeconds: 140, graphFromStage2: false,
    });
    assert.ok(r.replay, 'real-file replay metadata should survive the handoff');
    assert.ok(r.handoff && r.handoff.phase === 'stage2', 'handoff should be recorded');
    assert.ok(r.ended.seconds > 10, 'warm run should continue past the handoff');
    console.log('ok real-file warm handoff', r.ended.seconds + 's', r.writes.length + ' writes');
  } else {
    console.log('skip real-file warm handoff: file not found');
  }
})().catch((e) => { console.error(e); process.exit(1); });
