# v2.2.34 交接 — S3 夹取 / S2 晚峰 / 桶身份提前（2026-11-04）

状态：已改完、已本地提交；发版进行中。代码基线 = `be059cc`（2.2.34），另有 `c98d7a3`（2.2.32）与 `7bf06e7`（2.2.33）。

## 这一版给下一个对话的任务

用户要求：发版后继续用新的历史 JSON 校验 2.2.32–2.2.34 的真机表现，重点看 **S3 是否抬上去、S2 晚峰是否学到、S1/S2 的桶身份是否提前选对、5 g 平台是否不再被预测伪过冲打掉**。

- 当前数据：`C:/Users/ladios/Downloads/hyperex-history (7).json`（export 2026-11-03T23:23:48.910Z，pluginVersion 2.2.31，32 杯）。
- 关键两杯：
  - `1793746372274-1` 22:52:52 低压：S2 4.643（−7.1%），S3 1.576（+5.1%）；5 g/s 拐点 25.19 s、压力 1.39 bar；26.07 s 的 −4 档正常下调把平台从 5.25 打到 4.47。
  - `1793747524643-2` 23:12:04 高压：S2 4.021（−19.6%），S3 0.961（−35.9%）；boost 压力 0.44→1.19 bar，S2 最大 3.15 bar，杯流峰值 4.84 @3.00 bar，始终没到 5。

## 改了什么（只改插件）

1. **2.2.32 S3 形状夹取**（`driftShapeSuggestion`）：`ceiling = 2×LUT` 超限不再 `return null`，改为把 mid/early/late 夹到上限。23:12 高压纸 mid 1.143、early/late 1.1875 vs 1.138，整条被丢，S3 停在 0.563；夹取后 1.125/1.125/1.125，按当杯 r 约 MID 1.48 / EARLY-LATE 1.39，整体 1.4–1.47。
2. **2.2.33 S2 晚峰学习窗**（`stage2PlateauStartMs` / `controlOutputQuality`）：`peak+1.5 s` 之后不足 1.2 s 时回退到 S2 末 1.2 s（不早于 refill settle）；`controlOutputQuality` 返回 `plateauFallback:true`，basis 写 “late peak; last 1.2 s regression”。23:12 旧窗口 `windowSamples:0`，S2 完全学不到；回退后尾段可学，下一杯基值能从 4.31 往上走。
3. **2.2.34 桶身份提前 + 正常下调实际门**：
   - `gainRegimeForRun`：有补水时用 **return +2~4 s** 的压力/机器流量签名（2.2.31 低压 0.302–0.319、高压 0.481–0.610），无补水仍用后段 60%；桶中心不变。S3 控制中心当杯就能用 g4 的 r=1.3126（1.5→1.125）。
   - S1 软提示：`s1OutflowHint`，首次到 0.5 g/s ≥6.3 s 或 S1 时长 ≥8 s → high-pressure candidate（LOW），只在 S2 签名尚未拿到时优先最高中心桶；签名出来即覆盖。
   - S2 正常下调：`candidate<command` 且 `reg.slope ≤ target×1.04` → `s2-actual-in-band-down-hold`，不写；实测 >4% 的真实过冲照常下调。只挡预测伪过冲，不是墙。

## 下一个 JSON 要看的字段

| 改动 | 看哪里 | 预期 |
|---|---|---|
| S3 夹取 | `nextShotApplied.commandFlows.s3Shape`；`s3.rawRegressionGS` | shape 到 1.125/1.125/1.125（或按 r 夹取）；S3 从 0.96 抬到 ~1.4–1.47 |
| S3 当杯中心 | `liveFlowTrim.trace` 的 S3 write `controlBucket/controlCenterMlS` | 高压杯应出现 g4、center 1.125，正常写入能爬到 1.14 |
| S2 晚峰 | `adaptiveDecision.s2.outputQuality.plateauFallback`；`s2Startup.tailMeanGS` | late-peak 杯为 true，tailMean 非空；下一杯 `stage2CommandMlS` 从 4.313 往上 |
| S1 软提示 | `adaptiveDecision.s3/s2.gainMemory.s1Hint` | `candidate:high`、`firstOutflowS`、`s1DurationS`；LOW |
| S2 签名 | `gainRegimeForRun.basis`（诊断/日志） | 有补水时 “refill return +2–4 s”，无补水 “late 60%” |
| 正常下调门 | trace check 的 `reason=s2-actual-in-band-down-hold` | 22:52 型 +1.3% 不再 −4 档；实测 >4% 仍下调 |

## 已知边界

- S1 阈值（6.3 s / 8.0 s）只有 3 杯支撑，标 LOW；真机若误判，先看 `firstOutflowS` 与 S1 时长，不要直接改桶中心。
- 第一次换高压纸的那杯，S2 基值仍会用旧桶；2.2.33 的尾段学习让它学 r，下一杯才吃到。S1 软提示只保证桶身份更早，不凭空给出 S2 的 r。
- S3 正常写入按 2 档/2.4 s 爬，中心 1.125 正确但到位约 10 s；不要因为前几秒没到 1.4 就判失败。
- 2×LUT 夹取把 S3 的上限卡在 ~1.4–1.47；要精确 1.5，下一步再把形状上限放到 2.5×LUT（1.4225），仍远低于 8.0 硬限。
- 2.2.31 的 S2 救急实际误差门（`rescueHot` 的 `actualRel≥12%`）与 2.2.34 的**正常下调**门是两件事：前者救急，后者普通写；看 trace 的 `rescue` 区分。

## 测试与产物

- `tests/verify_v02234.cjs` **734/734**；`tests/RESULTS_v02234.txt`。
- 2.2.32 / 2.2.33 / 2.2.34 的测试分别为 728 / 729 / 734。
- 发布包：`release/HyperExPulseFilter_v2.2.34.zip`（从 tag `v2.2.34` 的 `git archive` 构建，不压工作区）；解压后 `node --check` + 复跑 734/734。

## 发布记录

（发版后补）

- commit：`be059cc`（2.2.34；含 2.2.32/2.2.33）
- tag：`v2.2.34`
- 分支：`v1.79ds`
- GitHub Release：待补
- 夸克：待补
- SHA256：待补
