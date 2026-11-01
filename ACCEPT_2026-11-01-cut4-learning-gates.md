# cut 4 验收文档 — 杯间学习的封锁与门槛（2026-11-01）

## 0. 结论

cut 4 完成。L-1 / L-2 / L-3 / L-11 / L-12 与 §6.2 已落地，`tests/verify_v02211.cjs` **651/651**；同一套跑 2.2.10 副本是 **646/651**（4 条重写 + 版本号）。补水段与杯内 liveTrimTick 未碰。版本 2.2.11，未打 tag、未推送。

真机回放补做完毕（§5）：**「门不再挡」被真机支持，「下一杯 S2 收敛」未被支持**（唯一一次干净应用误差 +33.9%），本版不记达标。

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

## 5. 真机交叉验证（2026-11-01 补做，取代「无法回放」的结论）

### 5.1 倒推方法

原结论「shot 记录不含 `nextShotAdaptive`，无法逐杯回放」不成立。每杯都带 `nextShotApplied.commandFlows`，它记录的是该杯结束时写入下一杯的 S2 指令；核对 30 杯：

| 项 | 数量 |
|---|---|
| 可核对过渡（本杯有 nextShotApplied + 有下一杯） | 19 |
| 与下一杯 `commands.stage2.commandMlS` 一致（≤0.02） | 18 |
| 不一致（人工/外部改曲线） | 1（2.2.3 → 2.2.4：记录 5.527，实跑 2.507） |
| 无 nextShotApplied 记录 | 10 |
| 无下一杯 | 1 |

10 个「无记录」过渡不能靠相邻杯指令做差代替——那样会把「没应用」误判成「改过」。**排除规则**：只用 nextShotApplied 存在、且与下一杯一致的过渡；人工改动与未记录应用都不计入收敛。

r 观测不重算，直接取 `evidence.gainMemory.stages.s2.observedR`；实际生效指令 = `s2Startup.tailMeanGS / observedR`（同一窗口反推，避免另立一套窗口）。杯流同时报两套：`tailMeanGS`（学习窗后 60%）与 `s2.rawRegressionGS`（整段回归），两者差距是 L-10 窗口不一致的直接量度。

脚本：`D:/vscode/.tools/hx-cut4-replay.js`（`node .tools/hx-cut4-replay.js <json> --last 5`，可复跑；两个导出 (3) 与 (4) 结果一致）。

### 5.2 最近 5 杯实测

| 杯 | 版本 | 曲线指令 | 实际指令 | 尾段杯流 | 尾段误差 | 整段回归 | 整段误差 | r_obs | 桶(r,n) | 门 | 记忆已用 | 建议 | 下一杯 | 过渡 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1793462597528-1 | 2.2.3 | 5.527 | 5.66 | 3.91 | −21.9% | 3.56 | −28.8% | 0.691 | g2(0.691,1) | LIMITED / HOLD | 否 | 5.014 | 5.527 | 人工改动 |
| 1793489359425-1 | 2.2.4 | 2.507 | 2.62 | 4.99 | −0.2% | 3.95 | −21.0% | 1.903 | g2(1.903,2) | SATURATED / HOLD | 否/local | — | 2.507 | 已应用（指令未变） |
| 1793489532447-2 | 2.2.4 | 2.507 | 2.50 | 4.04 | −19.3% | 3.75 | −25.0% | 1.616 | g3(1.616,1) | LUT COMPENSATE | 是 | 3.094 | — | 未应用 |
| 1793490122135-1 | 2.2.4 | 2.507 | 2.59 | 4.26 | −14.9% | 3.63 | −27.5% | 1.645 | g3(1.630,2) | LUT COMPENSATE | 是 | 3.067 | 3.067 | 已应用 |
| 1793492759538-1 | 2.2.5 | 3.067 | 3.52 | 4.29 | −14.2% | 3.82 | −23.6% | 1.217 | g2(1.287,3) | LUT COMPENSATE | 是 | 3.884 | 3.884 | — |

两项平台指标差 7–14 个百分点（B 最夸张：−0.2% 对 −21.0%）。验收时必须写明用哪一个；审查文档里的「−21%…−29%」是整段回归，尾段是 −0.2%…−21.9%。

### 5.3 cut 4 解除了什么（反事实）

| 杯 | 门 | 记忆 r | 2.2.11 会写 | 该杯记录的下一杯 | 下一杯实际跑 | Δ | 可比性 |
|---|---|---|---|---|---|---|---|
| 1793462597528-1 | LIMITED / HOLD | 0.691 | 5.014 | 5.527 | 2.507 | −0.513 | 人工改动过，不可比 |
| 1793489359425-1 | SATURATED / HOLD | 1.903 | 2.628 | 2.507 | 2.507 | +0.121 | 可比 |

5 杯里只有这两杯被门挡住；其余 3 杯的记忆本来就是 applied=true，cut 4 不改变它们。也就是说：cut 4 解除的是**可达性**，在这批数据里只换来一次 +0.121 ml/s 的实际写入。2.2.3 那杯即使按记忆写 5.014，用同杯 r=0.691 外推也只有 3.46 g/s——瓶颈是 3 bar 限压，不是门。

### 5.4 收敛性：唯一一次干净应用是负结果

| 过渡 | 上一杯记忆 r | 本杯曲线指令 | 本杯实际指令 | 预测(按实际指令) | 实测尾段 | 误差 |
|---|---|---|---|---|---|---|
| 1793490122135-1 → 1793492759538-1 | 1.630 | 3.067 | 3.52 | 5.75 | 4.29 | +33.9% |

记忆按 r=1.6304 写 3.067，预期 5.0 g/s；杯内调流把实际指令抬到 3.52，实测尾段只有 4.29。同一杯反算的 r_obs = 1.2174，比记忆 r 低 25%。**这是比值模型在指令上升后高估增益的直接证据**，不是「差一点」的噪声：5 杯全部观测里，指令 <3 ml/s 的 r 中位 1.645（n=3），≥3 ml/s 的 r 中位 0.954（n=2），最高点 5.66 ml/s 只有 0.691（3 bar 限压，非稳态）。

### 5.5 两套 r 的窗口差

同一杯、两套算法（诊断式 2 s 回归 vs 插件 observedR）：

| 杯 | 诊断式 | 插件 | 比值 |
|---|---|---|---|
| 1793489359425-1 | 1.046 | 1.903 | 1.82 |
| 1793489532447-2 | 1.285 | 1.616 | 1.26 |
| 1793490122135-1 | 1.215 | 1.645 | 1.35 |
| 1793492759538-1 | 1.211 | 1.217 | 1.00 |
| 1793462597528-1（导出 (3)） | 1.280 | 0.691 | 0.54 |

同一杯能差 1.8 倍，方向也不固定。这不是文档洁癖：L-10 的分子/分母窗口不一致会直接改变学习出来的 r。

### 5.6 结论

- **cut 4 的「门不再挡」被真机支持**：LIMITED / SATURATED 两杯在 2.2.11 下会写出建议指令。
- **cut 4 的收益（下一杯 S2 收敛）没有被支持**：唯一的干净应用误差 +33.9%，其余两杯要么指令未变、要么建议根本没写进下一杯（C 杯 nextShotApplied 为空，是应用链路问题，不是学习门）。
- 本版**不记达标**。植物/学习准确度仍按「未达标」记录。
- 下一步不是再放宽门，而是让 r 带上它的指令区间：2.5 ml/s 的 1.6 与 3.5 ml/s 的 1.2 不是同一个数（cut 5 的 L-9/L-10，cut 8 的比例 vs 仿射）。在此之前，任何「按 target/r 收敛到 5」的验收都会被这个偏差吃掉。

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
2. 真机回放已补做（§5）：用 `nextShotApplied` 倒推下一杯实际指令，18/19 个可核对过渡一致。收益指标已判：门解除成立，收敛不成立。剩下的限制是 r 本身随指令变化（cut 5 / cut 8），不是数据缺失。
3. `GAIN_MEMORY_DEVIATION=0.15` 与 r 的取值范围（0.05–8）属 cut 5，本版没动。

