# v2.2.15 交接 — 一致性门与三套 S2 估计（2026-11-01）

## 0. 这一版是什么

cut 8：把 S2 的「单杯链路仿射 / 稳态前馈 / 增益记忆」三套估计统一成一个反解，修掉最弱的一套覆盖最强的一套；把 0.005 的相等判据放宽到半个 1/16 档；让 spread 超限的前馈真正退出；目标比例失配改成一档过渡；`startupMetricAllowed` 的 +8% 上界放宽到 +25%；HOLD 改为与曲线指令比较，并补上「全段 HOLD 才不重写」的不变量。

基线：`a9df732` = v2.2.14。本版只改 `plugin.js` / `manifest.json` / `README.md`，新增 `tests/verify_v02215.cjs`、`tests/RESULTS_v02215.txt`、本文件、`ACCEPT_2026-11-01-cut8-estimators.md`。**未 commit、未 tag、未推送**。

## 1. 改了哪些函数

| 函数 / 位置 | 改动 |
|---|---|
| `sameScalarAdaptiveEvidence` / `sameStage3Shape` | command 容差 0.005 → `COMMAND_EQUAL_TOLERANCE`（1/32）；新增 `stage3ShapeFamily`，跨 basis 不再硬拒 |
| `matchingAdaptiveEvidenceSearch` / `stage3ReferenceEvidence` | 跨 basis 命中时打 `comparisonModel:"cross-window historical reference"`；`nextShotAdaptiveSuggestion` 见标记降一级 S3 置信度并记 `crossBasis` |
| `s2ReverseEstimate`（新） | 唯一的 S2 下一杯反解：当杯生效指令 → r → 比值解；链路有显著截距时才做仿射检验；链路斜率只有当杯 r 的 75% 以上才采用仿射；0.9 阻尼 + `policy.s2` 限幅 + 1/16 归档 |
| `s2AdaptiveSuggestion` | chain / tail 两个分支都改走 `s2ReverseEstimate`；保留 `SATURATED / HOLD`；标量共识回退不动 |
| `gainMemorySuggestion` / `normalizeGainMemory` / `updateGainMemoryFromRun` | 每个 stage 新增 `bands`（6 个指令区间），只更新/只取同区间先验；`bandMatched` / `band` / `bandR` / `bandN` 上报；无 bands 的旧记录兼容 |
| `nextShotAdaptiveSuggestion` | 记忆不再覆盖同杯数值建议（`role:"prior"`、`applied:false`）；无同杯数值时才由记忆填；HOLD 比较对象改成 `run.config.stageNCommandMlS` / S3 曲线形状；新增 `curveCommands`、`hold`、`hold.all` |
| `curveCommandsForRun` / `reconcileStageWithCurve`（新） | 逐段把建议与曲线比较；相等则 HOLD 并删 suggested；`actionable` 只在真有变化时为真 |
| `gainFeedForward`（`addGain`） | 新增 `eligible` / 拒绝原因；spread 不合格不参与；输出过 `snapCommandFlow` |
| `startupMetricAllowed` | `tailMeanGS` 上界 `+0.08×factor` → `+0.25×factor`；下界、纹波、过冲保留 |
| `testOverrideStatus` / `manualTestCommand` / `s3ShapeStatus` / `preserveStage` | target 比例 0.5–2× 内返回 `targetScale`，读取时缩放；`rescaleOverridesForTargets` 持久化；超出 2× 仍无效 |
| 版本 | `PLUGIN_VERSION` / `manifest.json` → 2.2.15 |

**没碰**：`boundedRefillControlBase`、`boundedRefillCommand`、`stage2StartupPlan` 的 bounded 分支、`s2RefillReturnReason`、`dispatchS2Startup`、`liveTrimTick` 的 startup 分支，以及杯内 `liveTrimTick` 的控制律。

## 2. 真机回放（最后一杯 1793492759538-1，2.2.5）

- 曲线 3.067 ml/s；机器回显有效指令 3.938；尾段杯流 4.794；`r_obs=1.2174`。
- 链路（晚写锚点）4.3125：斜率 0.45、截距 ≈2.83、旧仿射 4.72。
- 链路（生效锚点 3.938）：斜率 0.5557、截距 2.6056（52.1%）、仿射 4.309；斜率只有当杯 r 的 46% → 拒绝，判为「末笔未落定」。
- 稳态前馈：k=1.28、spread 0.563、`eligible:false`、`applied:false`。
- 增益记忆旧值：r=1.2874 → 3.884（旧代码 applied=true）。
- **2.2.15：比例解 4.107 → 0.9 阻尼 → 4.0625 ml/s**；与所需 4.107 差 −1.1%。
- HOLD：曲线 3.067 vs 建议 4.0625 → ADJUST（正确）。若建议落在 3.0625 且曲线也是 3.0625 → HOLD；测试夹具已覆盖。

生产路径（不传第 5 个 override，用 41 个 `targetFlowMlS=3.9375` 的样本让 `stage2EffectiveCommand` 自己算）同样得到 **4.0625**，说明回放不是靠那个可选参数才成立的。

脚本：`node D:/vscode/.tools/hx-cut8-replay.js`。回放使用记录的 `observedR` 和尾段杯流，因为导出 `fullRecord` 会剥掉 refill-complete trace，重算窗口与杯内当时不同；生产的 `s2ReverseEstimate` 只传 4 个参数。

## 3. 测试

- `tests/verify_v02215.cjs`：**677/677**；`tests/RESULTS_v02215.txt` 是完整输出。
- 11 条新增：L-13 两条（半档命中/拒绝、历史行命中）、L-7 五条（真机链路、落定仿射、四档限幅、spread 门、闭环植物）、L-15 一条、L-16 一条、L-14/HOLD 一条、§6.3 一条。
- v02214 测试与 RESULTS 原样保留；在 2.2.14 自己的 plugin+manifest 上 666/666；放进本版树（manifest 2.2.15）只剩版本断言红，665/666；对 2.2.15 代码 664/666，红的是版本与已废除的「记忆覆盖同杯建议」旧断言。
- 安全门（限压 / ACK / 帧确认 / 预算 / profile truth / 存储回读 / 秤失效）一条没删、没弱化。

## 4. 真机怎么验

1. 装 2.2.15，先跑一杯正常咖啡，看诊断页的 `s2.reverseModel`：应显示 `rObserved`、`ratioNeedMlS`、`affine`（斜率/截距/占比）、`affineRejected`（如果被拒）与 `suggestedCommandMlS`。
2. 若下一杯曲线当前值已经等于建议值，`nextShotAdaptiveSuggestion.hold.s2` 应为 true、`actionable` 应为 false；AUTO APPLY 状态应显示等待而不是重写。
3. 目标从 5 改到 4 或 6（0.8–1.25×）：旧 override 不应整套消失，`testOverrideStatus().targetScale` 应给出比例，命令按比例缩放；下次启动/保存后 `targetTransition` 回到 false。
4. 看 `gainFeedForward.eligible`：真机最近的 spread 0.56 应显示 false，并且 `suggestedCommandMlS` 不等于 `boundedCommandMlS`。
5. **≥5 ml/s 稳态 r 仍 0 样本**：不要拿 4–5 区间的 0.88 中位当高流量稳态；高指令标定仍待做。

## 5. 已知限制

1. 目标比例超过 0.5–2× 仍整套作废；`mapCreatedAt` 变化仍整套作废（`gainMemory` 保留，下一杯重算）。
2. `gainMemorySuggestion` 在 `updateGainMemoryFromRun` 之后调用，同区间先验已含当杯 r（权重最多 0.25，实测影响 <0.01 ml/s）；若要严格「先验不含当杯」，需在更新前快照。
3. `startupMetricAllowed` 的纹波门仍是 12%×factor，真机 00:25 的 15.43% 仍被拒；本版只改了 +8% 上界。
4. 补水植物整体准确度仍不记达标（缺压力/粉饼动态与 ≥5 ml/s 稳态 r）；本版没有动物理参数，`HX_LOOP_REPORT=1` 与 cut 0/1/5 逐项一致。

## 6. 提交状态

工作区未提交。`git status` 里另有别的对话的未跟踪文档（`COORD_HANDOFF_2026-11-01.md`、`REVIEW_2026-11-01-flow-control.md`、`CUTS_2026-11-01-prompts.md`、`HANDOFF_2026-10-31-design.md`、`HANDOFF_cut5_TODO.md`、`release/`、`review/`、`tests/verify_v0226.cjs`、`tests/RESULTS_v0226.txt`），本版没有碰、没有回滚，提交时只 add 本版自己的文件。
