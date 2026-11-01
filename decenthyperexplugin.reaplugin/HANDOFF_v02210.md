# v2.2.10 交接 — 杯内门槛与死参数（2026-11-01）

## 0. 这一版是什么

cut 3：T-4 角度死区、T-9/F4 S3 预算、T-10 救急判据、F3 救急静默、T-12 大角度加码、T-13 小项。**T-11 未做**——它要动的 `approachWriteIntervalMs` / `approachMs` / `approachFraction` 都在 `stage2StartupPlan` 与 `S2_REFILL_DEFAULTS`（补水段横幅所有），等你决定归属。

## 1. 改了什么（全在 plugin.js）

- `ANGLE_DEADBAND_DEG=2` 新增；`computeAngleStats` 用它，不再用 `report.deadbandPct`。
- S3 预算：`phaseQuanta.stage3` 按实际写入档数累计；常规/救急各 24 档；常规在 `rescueAngleStreak>=3`（连续 ≥120°）时放开；删除 `progress>=.55` 后段禁写。
- 救急判据：`stepsNeeded=|target-decisionGS|/(r/16)`，`timeToReturnS=1.2+stepsNeeded×写周期`，`cannotReturn=timeToReturnS>remainingS`；trace 记三个数。
- F3：救急静默 = `max(800, min(3000, lastResponseMs))`，无实测 800；`lastResponseMs` 在驱动 ACK 时记录；trace 记 `silenceBasis`。
- T-12：normalMax = bigAngleStreak≥6 ? 8 : ≥3 ? 6 : 4。
- 版本：plugin.js / manifest.json → 2.2.10。

## 2. 测试（tests/verify_v02210.cjs，651/651）

从 v0229 复制，v0229 与 RESULTS_v0229 原样保留。

新增 4 条：

- `§22.4 T-4 the angle deadband is 2 degrees and does not follow deadbandPct`：3° 趋势在 deadbandPct=12 下仍不算 0°；1.5° 算。
- `§22.4 T-10 rescue needs the remaining time to be genuinely insufficient`：同一角度/误差，剩余 20 s 不救急；只剩 4 g（2 s）才救急，并断言 `timeToReturnS>remainingS`。
- `§22.4 T-9 S3 spends a cumulative quantum budget and a big-angle streak releases it`：24 档预算挡住 → 连续 3 个 173° 检测点 → 放开并写出（intended 6 档、actual 4 档，落点受信封下限约束）。
- `§22.4 T-13 the rescue silence follows the measured driver ACK latency (F3)`：实测 1235 ms → 静默 1235；实测 300 ms → 落 800，basis 分别 measured / floor-800。

v0229 里断言「4 笔后 coast」「救急 8+ 档」的两条按新口径重写，不是弱化。

## 3. 数字

| 项 | 2.2.9 | 2.2.10 |
|---|---|---|
| tests | 649 | 651 |
| 旧副本跑新套 | — | 646/651（4 条新测试 + 版本号红） |

真机交叉（history (4)，2.2.x 8 杯）：`s3NormalWrites` 19、`s3RescueWrites` 10；`checkReasons` 里 "S3 normal write budget" **242** 次、"S3 rescue write budget" **186** 次（合计 **428**，与审查数字一致）、"predictive-write-silence" 118 次。这直接证明这道墙存在，也说明 F3 的静默放宽有真实依据。

## 4. 真机怎么验

1. 装 2.2.10，看 S3 在大偏差 + 大角度时是否还会被预算挡死；对照 `checkReasons` 里 "S3 normal quantum budget" 是否只在 24 档后出现。
2. 救急首笔看 `row.timeToReturnS` 与 `remainingS`：只有后者更小才应进入救急。
3. `silenceBasis` 出现 measured 时，`silenceMs` 应等于上一笔 ACK 延迟（≥800）。
4. trace 的 `bigAngleRelease` 为 true 时，即使常规 24 档用完也应继续写。

## 5. 已知限制

- T-11 未做（补水段归属）。
- 真机导出仍缺逐点 check 行，交叉验证用的是 `checkReasons` 汇总计数，不是逐点复算。
- 救急判据里的写周期用实测 ACK 延迟，首次（无实测）落 800 ms；这一点与 F3 一致。

