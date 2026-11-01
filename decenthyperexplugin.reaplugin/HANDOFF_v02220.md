# v2.2.20 交接 — cut 5 第二轮 P2-3（桶几何只随观测提交）

## 0. 这一版是什么

第二轮复查把 cut 5 退回的 P2-3：`updateGainMemoryFromRun` 原先先追加 `bucket.samples`、重算 `center/radius`，之后才取 S2/S3 观测。一次完成但没有合格证据的杯子（短 S2、纹波过大、帧缺失）会把已有桶的中心和半径拖向该杯签名，下一杯的最近邻/半径判定随之变化。

基线：HEAD `30bc35d` = v2.2.19（689/689）。本版只动杯间增益记忆的提交时序。

## 1. 改了什么（全在 plugin.js）

`updateGainMemoryFromRun`：

1. 选桶后先对 s2 / s3 调 `gainStageObservation`，结果放进 `observations`；
2. 两段都为空 → 只删除本次新建的 scratch 桶（`selected.bucket` 与 `selected.absorb` 都没有时才新建），已有桶与 absorb 桶原样保留；返回 `no-observation`。**不写** `bucket.samples / center / radius / updatedAt`，**不写** `memory.lastBucketId / updatedAt`，**不写** `run.gainMemoryBucketId`；
3. 至少一段有观测 → 才提交 `bucket.samples`（追加签名）、`bucket.center=median`、`bucket.radius=离散度`，然后按原逻辑逐段更新 r/drift/bands；
4. 删掉因此不可达的尾部 `if(!Object.values(out.stages).some(x=>x.status==="updated"))` 分支；
5. 版本号 `PLUGIN_VERSION` 与 manifest → 2.2.20。

## 2. 测试（tests/verify_v02220.cjs，692/692）

从 v02219 重建，v02219 与 RESULTS_v02219 原样保留。新增 3 条：

- `P2-3 a completed cup with no S2/S3 observation leaves the existing bucket byte-identical`：预置 g1（samples [.29,.3,.31]、center .3、radius .12、updatedAt 2026-10-01），用 `stage2CommandOrigin='manual'` + `evidence {}` 造两段都没观测；断言整桶 `JSON.stringify` 不变、`memory.lastBucketId/updatedAt` 不变、`run.gainMemoryBucketId` 未设置。
- `P2-3 a no-observation cup never leaves a new scratch bucket behind`：签名 2.0 远离 g1，断言跑完只剩 g1。
- `P2-3 a cup with a valid observation still commits its signature into the bucket`：签名 0.2 命中 g1，断言 samples 追加、center 0.3→0.25、updatedAt 更新。

修前基线（同一 v02220 文件跑 2.2.19）：690/692，红的是版本号与本条 P2-3；修后 692/692。`verify_v02219` 对 2.2.20 只红版本号（688/689）。

## 3. 已知问题（本版未改）

- `normalizeGainMemory` 对缺失的 `lastLocalR` / `drift` 不是幂等：第一次归一写 `null`，第二次 `Number(null)=0` 会写成 `0`。对控制无影响（`local` 要求 >0，`drift` 要求 >0 才用），但会让「整桶 JSON 逐字节」类断言在第一次加载前后出现差异。P2-3 的测试夹具先归一两次再取快照，规避的是这个既存行为，不是掩盖几何变化。
- 半径下限 0.08 的建桶速度仍需真机观察（cut 5 首轮遗留）。

## 4. 边界

没碰：补水段（`boundedRefillControlBase` / `boundedRefillCommand` / `stage2StartupPlan` 的 bounded 分支 / `s2RefillReturnReason` / `dispatchS2Startup` / `liveTrimTick` 的 startup 分支）、`selectGainBucket` 的命中与分桶规则、S3 形状、杯内控制律。

## 5. 发布状态

**未提交、未打 tag、未推送。** 等用户批准提交。

