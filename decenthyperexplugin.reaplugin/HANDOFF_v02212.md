# v2.2.12 交接 — 增益记忆结构（cut 5）

## 0. 这一版是什么

修 L-4 / L-9 / L-10：桶中心自适应、命中改最近邻分区、缺段跨桶回退、LRU 淘汰、r 范围单一来源、r 的分子分母同窗，并给每段记忆标注测得的指令区间。只动杯间增益记忆；补水段与杯内 `liveTrimTick` 一行没碰。

基线：HEAD `80da6b4` = v2.2.11。工作区里别的对话留下的未提交文档没有动。

## 1. 改了什么（全在 plugin.js）

- 常量区：新增 `GAIN_MEMORY_BUCKET_MIN_RADIUS=.08`、`GAIN_MEMORY_BUCKET_MAX_RADIUS=.20`、`GAIN_MEMORY_SIGNATURE_SAMPLES=6`、`GAIN_R_MIN=.2`、`GAIN_R_MAX=3`；`GAIN_MEMORY_BUCKET_RADIUS` 保留为种子。
- 新增 `gainBucketLimit`（命中半径 = min(radius×1.25, 与最近邻桶中心距的一半)）、`gainBucketRadius`（MAD×2.6，钳 0.08–0.20）、`commandBandOf`（六档）。
- `normalizeGainMemory`：接受并裁剪 `samples`（≤6，空则用 center），保留 `commandMlS` / `commandBand`，r 范围改用 `GAIN_R_MIN/MAX`，越界丢段并写入 `dropped`（≤20 条）。
- `selectGainBucket`：最近邻；`distance ≤ limit` 命中；`distance ≤ radius` 并入最近桶；否则新建。不再用 `lastBucketId` 抢先命中。
- `createGainBucket`：`samples:[]`（签名由更新方追加，避免首样本重复）；淘汰改 LRU（按 `updatedAt`，排除新桶与 `lastBucketId`）。
- `stage2EffectiveCommand`：末端窗口 40% → 60%，与 `controlOutputQuality.tailMeanGS` 对齐。
- `gainStageObservation`：S2 返回 `commandBand` / `window:{startPct:40,endPct:100}`；S2/S3 共用 `GAIN_R_MIN/MAX`。
- `updateGainMemoryFromRun`：每杯追加签名、center=中位数、radius=离散度；返回 `absorbed` / `signatureSamples`；段上记 `commandMlS` / `commandBand`。
- `gainMemorySuggestion`：r 范围共用常量；当前桶缺段时跨桶借记忆（先样本数、再距离），返回 `stale` / `fallback:"cross-bucket"` / `activeBucketId` / `sourceBucketId`；返回 `commandBand` / `currentBand` / `crossBand`。
- 版本：`PLUGIN_VERSION` 与 manifest → 2.2.12。

## 2. 测试（tests/verify_v02212.cjs，658/658）

从 v02211 复制，v02211 与 RESULTS_v02211 原样保留。新增 7 条：

- `L-4 membership is nearest-neighbour so one signature never depends on lastBucketId`（真机夹具；0.3831→g3、0.3881→g2）
- `L-4 a stage missing from the active bucket is borrowed cross-bucket and marked stale`（真机 g2 无 s3 → g3 r=1.9421 / drift=0.913）
- `L-4 the bucket centre is the sliding median`（0.20/0.22/0.24 → 0.22，radius 0.08）
- `L-4 eviction is LRU by updatedAt`（12 桶 + 新桶 → 最旧的 g1 被淘汰，g5 保留）
- `L-9 r outside [0.2,3] is dropped on load with a reason`（含源码里只有一处范围字面量）
- `L-10 the gain numerator and denominator share the final 60 percent window`（60% 中位 5.0 / 40% 中位 3.0，r 必须按前者）
- `r records the command band ... and flags a cross-band reuse`

安全门测试一条没删。`verify_v02211.cjs` 对 2.2.12 只红版本号那条（650/651），与之前几个 cut 的规律一致。

## 3. 真机 JSON 回放

数据源 `C:/Users/ladios/Downloads/hyperex-history (4).json`（30 杯，22 杯 fullRecord）。脚本 `D:/vscode/.tools/hx-cut5-replay.js` 直接加载 shipped plugin 的代码跑，不重写逻辑。

**导出的旧记忆**：g2@0.4715（s2 r=1.2874 n=3，无 s3）、g3@0.2997（s2 1.6304 n=2、s3 1.9421 n=2、drift 0.913）。旧命中带 g2 [0.3215,0.6215]、g3 [0.1497,0.4497]，重叠 0.3215–0.4497（0.128 宽）。新边界 0.3856；lastBucketId 设成 g3 或 g2，0.40 都落 g2。

**缺段回退**：活动桶 g2、stage2 签名 0.4715 → s3 返回 `{bucket:"g3", active:"g2", r:1.9421, drift:0.913, stale:true, fallback:"cross-bucket", command:0.772}`。

**22 杯重放**：只有 4 杯（2.2.4×3、2.2.5）有可用的 S2 压力/流量签名，其余旧记录缺机器遥测字段。逐杯签名 0.3899 / 0.2997 / 0.3655 / 0.5176 → 最终两桶：g2 center 0.3655 radius 0.08 samples [0.3899,0.2997,0.3655] s2 r=1.2448；g3 center 0.5176 radius 0.12 s2 r=1.276。重放后的命中带 [0.2894,0.4415] 与 [0.4415,0.5936] 在 0.4415 相接，不再重叠。

**闭环植物**：与 2.2.11 完全一致（`HX_LOOP_REPORT=1`：rise 0.60 s、峰值 +33.2%、平台 −19.3%、return 3.875）。本版没有动物理参数，也没碰补水控制律。

## 4. 已知限制与观察点

1. **半径下限 0.08**：重放里最后一杯的签名比前一杯高出 0.152，因此新建了 g3。这是设计上的「换了增益状态」而不是碎片；真机若发现每两三杯就多一个桶，说明同一张纸的签名漂移超过 0.08，需要把下限调高或把签名换成更稳的量。
2. **commandBand 是新增字段**：老记忆没有，第一次观测后才写；crossBand 在此之前恒为 false。
3. **r ∈ [0.2,3] 会丢弃存量越界值**：导出里没有越界样本；若以后出现 r>3，加载时会进 `dropped` 并从记忆中消失。
4. **回放不能重算 S3 观测**：导出没有 `evidence.s3`，回放只能沿用已存的 s3 行；跨桶回退是用导出记忆直接验证的。
5. **补水段与杯内控制律未动**：`boundedRefillControlBase` / `boundedRefillCommand` / `stage2StartupPlan` 的 bounded 分支 / `s2RefillReturnReason` / `dispatchS2Startup` 的 boost|bleed|trim|return / `liveTrimTick` 的 startup 分支保持 2.2.11 状态。

## 5. 发布状态

**未提交、未打 tag、未推送。** 按 §15 走完整流程；提交与发版等用户点头。

真机验收建议看诊断页「杯间增益记忆」：桶 id / center / radius / r / n / 指令带，以及 crossBand 是否在换纸时出现。

