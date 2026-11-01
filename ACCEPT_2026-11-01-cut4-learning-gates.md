# cut 4 验收文档 — 杯间学习的封锁与门槛（2026-11-01）

## 0. 结论

cut 4 完成。L-1 / L-2 / L-3 / L-11 / L-12 与 §6.2 已落地，`tests/verify_v02211.cjs` **651/651**；同一套跑 2.2.10 副本是 **646/651**（4 条重写 + 版本号）。补水段与杯内 liveTrimTick 未碰。版本 2.2.11，未打 tag、未推送。

## 1. 范围与边界

| 项 | 状态 |
|---|---|
| 改动文件 | `plugin.js`（杯间学习 6 处）、`manifest.json`、`README.md`、新增 `HANDOFF_v02211.md`、`tests/verify_v02211.cjs`、`RESULTS_v02211.txt` |
| v02210 及更早测试 | 未改动 |
| 补水段（boundedRefillControlBase / boundedRefillCommand / stage2StartupPlan 的 bounded 分支 / s2RefillReturnReason / dispatchS2Startup / liveTrimTick startup） | 未碰 |
| 杯内 liveTrimTick 控制律 | 未碰 |
| 补水侧两处纹波门槛（s2RefillPumpEstimate 15.6%、stage2StartupPlan 12%） | **未动**（补水段归属） |

## 2. 口径

- §22.3：学的是相对 LUT 的增益；偏差检测 → 降置信 → 当杯局部估计 → 下一杯吸收。
- §22.8：数据质量门改权重，不形成墙；安全门（压力/ACK/预算）不动。
- 原则：不可采信的证据只降低权重与置信度，不阻止 target/r 的应用。

## 3. 改动逐条

### L-1 不再连带封锁增益记忆

`nextShotAdaptiveSuggestion` 里 `SATURATED|LIMITED|VARIABLE|MIXED` 的分支从「withheld」改成「damped」：`s2.gainMemory.applied` 照常为真，`damped=true`，置信度 HIGH→MEDIUM→LOW 降一级，`target/r` 照常写入 `suggestedCommandMlS`。

### L-2 链路饱和

`gainStageObservation` 删掉 `chain.usable===false → return null`。饱和时 `local=true`、`alphaOverride=0.55`，观测仍然进入记忆更新。

### L-3 local 用当杯估计

`updateGainMemoryFromRun` 在偏差 >15% 或观测本身 local 时写 `lastLocalR`（当杯 r）；`gainMemorySuggestion` 的 `local` 改读它，local=true 时置信度强制 LOW。no longer 用上一杯的 `lastObservedR`。

`normalizeGainMemory` 同步保留 `lastLocalR` / `damped`（否则每次读档会被重建剥掉）。

### L-11 同一物理量一套门槛

- 纹波：`>25%` 才 HOLD；`12–20%` 标 damped，α 减半。
- 质量门：`gainMemoryQualityGuard` 与 `stageActuatorEvidence` 统一 0.60 / 0.35 / 0.40（原 0.80/0.20/0.25）。
- 欠跟踪分母：两处都从 `cfg.stageNCommandMlS` 换成实际生效指令（S2 `stage2EffectiveCommand`、S3 逐帧 `targetFlowMlS`），取不到就跳过该样本（不判 eligible）。

### L-12 开杯指令窗

`known()` 的 seed 窗从 ±20% 放宽到 ±35%。

### ⑦ 空回退

`gainStageObservation` 拿不到 `stage2EffectiveCommand` 时直接返回 null，不再用 `cfg.stage2CommandMlS` 当分母。

## 4. 测试（651/651）

重写 4 条旧测试（旧断言正是本次要废除的行为）：

1. 「不可采信证据只留在 telemetry」→ 现在断言 `applied=true`、`damped=true`、置信度非 HIGH、`usable=true`。
2. 「relaxed 与 hard 两套门槛」→ 改为「同一套门槛、同一结论」，并保留「限压仍是硬门」。
3. 「newest contradictory cup」→ 仍断言检查的是最新可比杯、不 cherry-pick 旧证据。
4. 「bypass」→ 改为「标量门拒绝时记忆照常应用」。

新增：

5. `L-2 a saturated chain yields a current-shot local estimate at alpha 0.55`：饱和链路仍出观测、α=.55、local 用当杯 r、置信度 LOW。

## 5. 真机交叉验证（如实）

- `hyperex-history (4).json` 的 shot 记录**不含** `nextShotAdaptive` 与 check 行（compact 只保留 evidence/fullRecord 的采样），无法逐杯回放这次的建议逻辑。
- 能引用的真机证据仍是审查文档里的：最近 5 杯 S2 −21%…−29%；最后一杯 `memoryGuardBypass.hard.reason` 为「S2 tail ripple 16.5% exceeds 12% learning limit」而 relaxed 侧 coverage 1.0 / pressure 0 / under 0；g2 平滑 r=1.3574 而杯内用 1.9026（差 29%）。
- 本轮**没有**新的真机回放数字，植物/学习准确度不记达标。

## 6. 复现

```powershell
cd D:/vscode/decenthyperexplugin/decenthyperexplugin.reaplugin
node tests/verify_v02211.cjs                 # 651/651
node tests/verify_v02211.cjs <2.2.10 plugin> # 646/651
```

## 7. 验收清单

- [x] L-1 降权而非封锁；target/r 照常应用
- [x] L-2 饱和链路不再封学/封用；α=0.55
- [x] L-3 local 用当杯估计、置信度 LOW
- [x] L-11 学习侧纹波统一、执行器门一套、分母换实际指令
- [x] L-12 known 窗 ±35%
- [x] ⑦ 空回退删除
- [ ] 补水侧两处纹波门槛：归补水对话（cut 9），2.2.11 不处理
- [x] 651/651；安全门零删除；v02210 及更早未动

## 8. 已知限制

1. 补水侧 15.6% / 12% 两处纹波门槛未统一；已定归补水对话（cut 9），2.2.11 不处理。
2. 真机导出不含建议对象，无法逐杯回放；收益指标（下一杯 S2 平台收敛）要等真机。
3. `GAIN_MEMORY_DEVIATION=0.15` 与 r 的取值范围（0.05–8）属 cut 5，本版没动。

