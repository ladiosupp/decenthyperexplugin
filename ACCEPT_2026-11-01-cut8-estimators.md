# cut 8 验收文档 — 一致性门与三套 S2 估计（2026-11-01）

## 0. 结论

cut 8 完成。L-7 / L-13 / L-15 / L-16 与 §6.3 的本轮项已落地：S2 的链路仿射、稳态前馈、增益记忆三套估计统一到一个按指令区间取值的反解；`sameScalarAdaptiveEvidence` / `sameStage3Shape` 的相等判据从 0.005 放宽到半个档位 0.03125；前馈的 spread 门真正生效；目标比例失配改成一档过渡；`startupMetricAllowed` 的上界从 +8% 放宽到 +25%；HOLD 改为与曲线指令比较，并加了全段 HOLD 不重写的不变量。

`tests/verify_v02215.cjs` **677/677**（666 条既有 + 11 条新增）。v02214 测试文件与 RESULTS 原样保留。补水段与杯内 `liveTrimTick` 的控制律未碰。版本 2.2.15，未 commit、未 tag、未推送。

真机 `hyperex-history (4).json` 回放：最后一杯（1793492759538-1，2.2.5）的有效指令 3.938 ml/s、尾段杯流 4.794 g/s、`r_obs=1.2174`；统一后下一杯 S2 指令 **4.0625 ml/s**，与 `target/r_obs=4.107 ml/s` 相差 **−1.1%**。旧记忆给 3.884（−5.4%），旧链路仿射给 4.72（+14.9%）。**收敛方向与真机所需一致**。

## 1. 范围与边界

| 项 | 状态 |
|---|---|
| 改动文件 | `plugin.js`（一致性门、S2 三套估计、HOLD 判据）、`manifest.json`、`README.md`、新增 `HANDOFF_v02215.md`、`tests/verify_v02215.cjs`、`RESULTS_v02215.txt`、本文件 |
| 未动 | S2 补水段（`boundedRefillControlBase` / `boundedRefillCommand` / `stage2StartupPlan` 的 bounded 分支 / `s2RefillReturnReason` / `dispatchS2Startup` / `liveTrimTick` 的 startup 分支） |
| 未动 | 杯内 `liveTrimTick` 的控制律（步长、信封、救急、静默） |
| v02214 及更早测试 | 原样保留，未改 |
| 安全门 | 限压 / ACK / 帧确认 / 写入预算 / profile truth / 存储回读 / 秤失效，零删除、零弱化 |

## 2. 逐条实现

### L-13 相等判据放宽到半个档位

- `sameScalarAdaptiveEvidence`：command 容差 `0.005` → `COMMAND_EQUAL_TOLERANCE`（1/32 = 0.03125），target 容差保持 0.01（目标来自设置，不会漂移）。
- `sameStage3Shape`：逐帧 command 容差同样改成 1/32；时序 0.25 s、target 0.01 保持。
- §6.3 的 basis family：不再硬拒。`stage3ShapeFamily()` 抽出来，`matchingAdaptiveEvidenceSearch` 在跨 family 命中时给证据打 `comparisonModel:"cross-window historical reference"`，`stage3ReferenceEvidence` 的折算路径也按 family 标记；`nextShotAdaptiveSuggestion` 见到这个标记时把 S3 置信度降一级并记 `crossBasis:true`。

真机 `historySearch` 的 checked 5 / incompatibleCommands 4 是 0.005 判据造成的：0.02 的指令漂移就被判成「不是同一条指令」。放宽到 1/32 后，半个档位以内的漂移仍能命中；一个整档位（0.0625）以上仍然拒绝。测试用 1/64 的漂移与 1/16+ε 的漂移分别验证命中与拒绝。

### L-7 三套 S2 估计统一

新增 `s2ReverseEstimate(run, current, chain, memory, effectiveOverride)`，它是 S2 下一杯指令的唯一反解入口：

1. **取当杯实际生效指令**：`stage2EffectiveCommand(run)`（机器回显 `targetFlowMlS` 的末 60% 中位数），不是最后一笔 live-trim 写入。链路存在时要求 `startCommand ≤ effective ≤ lastCommand`，否则回退到链路末指令（夹具/遥测缺失时不会拿一个不可能的回显当锚点）。
2. **比值模型**：`rObs = 尾段杯流 / 生效指令`；与同命令区间的记忆先验加权（先验权重最多 0.25，按该区间的样本数），得到 `ratioNeed = target / r`。
3. **仿射检验**：用链路的两点（`startCommand/startGS` 与生效指令/尾段杯流）拟合斜率与截距。截距绝对值 ≥ target 的 10% 时，仿射解才算「显著」；只有同时满足「链路斜率 ≥ 0.75×当杯稳态 r」才采用。否则记录拒绝原因，退回比值解。
4. **一步过渡**：`need` 先按 0.9 阻尼，再以生效指令为中心做 `policy.s2` 限幅（保守 5%/0.10、温和 8%/0.20、正常 12%/0.35、激进 20%/0.60），最后 `snapCommandFlow` 归档 1/16 档。

为什么真机最后一杯不能用旧仿射 4.72：链路两点是 2.25→4.3125 ml/s、杯流 3.856→4.794 g/s，但 4.3125 是链路末笔写入，尾段的机器回显只有 3.938；用 4.3125 当终点会把「还没走完的泵行程」算成稳态，斜率 0.45 只有当杯稳态 r=1.217 的 37%。以 3.938 为终点重拟合，斜率 0.556、截距 2.606（占目标 52.1%），仿射解 4.309；它仍被「斜率 < 0.75×r」拒绝，因为这条链是暂态而不是稳态。比值解 4.107 才是与当杯同窗的答案。

`gainMemorySuggestion` 不再覆盖同杯反解：当 `s2` 已有可用的 ADJUST / LUT COMPENSATE 数值时，记忆只作为 `role:"prior"` 上报，`applied:false`；只有没有同杯数值时才由记忆填指令。`nextShotAdaptiveSuggestion` 里删掉了旧的 `actual = s2.currentCommandMlS` 分支。

**r 做成命令的函数**：`gainMemory` 每个 stage 增加 `bands`（`<1.0` / `1.0-2.0` / `2.0-3.0` / `3.0-4.0` / `4.0-5.0` / `>=5.0`），每次观测只更新自己的区间；建议时只取生效指令所在区间的先验，区间不匹配时 `bandMatched:false`、`crossBand:true`，不跨区静默套用。旧记录没有 `bands` 时退回原来的单值 r，行为兼容。

`gainFeedForward` 的 spread 门保持 §19 的两档（2 杯 spread ≤5%，3 杯以上 ≤10%），新增 `eligible` 与拒绝原因；不合格时只保留遥测参考，`applied` 永远为假，且不再参与建议。前馈输出也补上 `snapCommandFlow`（Q-1 的遗漏）。

### L-15 startupMetricAllowed 上界

`tailMeanGS` 的上界从 `target×(1+0.08×factor)` 放宽到 `target×(1+0.25×factor)`；下界仍是 `target×(1−0.5×factor)`，纹波 12%×factor、过冲 8%×factor 不变。真机 00:25 的 `tailCvPct 15.43` 仍被纹波门拒绝——本版只按要求放宽上界，不把纹波门也一起放掉；纹波归 §22.8 的权重门，不属本条。

### L-16 目标比例一步过渡

`testOverrideStatus` 不再在 target 比例失配时直接判无效。比例在 0.5–2× 内时返回 `valid:true`、`targetScale` 与 `targetTransition:true`；`manualTestCommand`、`s3ShapeStatus`、`applyNextShotAdaptiveSuggestion` 的 `preserveStage` 都按 `targetScale` 在读取时缩放。`rescaleOverridesForTargets` 仍负责把同一比例持久化（启动、标定加载、override 加载时调用），持久化后 `targetScale` 回到 1、`targetTransition:false`。超过 0.5–2× 仍判无效：那已经不是「同一条曲线的目标微调」，而是换了一个物理工作点。

`mapCreatedAt` 变化仍整套作废：不同 LUT 下的绝对指令没有定义，`gainMemory` 按 §22.1 保留并在下一杯重新反算。这一条是本版的明确边界，不把「重校准」伪装成「目标微调」。

### HOLD 判据：与曲线比较，全段 HOLD 才不重写

`curveCommandsForRun(run)` 给出本杯曲线实际会跑的 S1/S2/S3 指令（S3 支持 legacy 三段与 drift 的 mid×factor）。`reconcileStageWithCurve` 在 `actionable` 之前逐段比对：

- S1/S2：`ADJUST` / `LUT COMPENSATE` 的数值与曲线指令在半个档位内 → 改成 `HOLD`，删掉 suggested；
- S3：legacy `suggestedShape` 或 `driftShape` 的三段派生指令都与曲线同档 → 改成 `HOLD`，删掉形状；
- `hold.all = !actionable`：只有全段都没有真实变化时才不重写曲线。

这修的是两件事：① 旧代码拿 `s2.currentCommandMlS`（有链时是 `chain.commandMlS`，真机 4.3125）与记忆指令 3.884 比，永远不相等；② 真机四杯 S1 都在 ADJUST，即使 S2 归档修好也会被 S1 推着重写。现在 S1/S3 只有真的改变曲线才会 `actionable`。

## 3. 真机回放（`hyperex-history (4).json`）

脚本：`D:/vscode/.tools/hx-cut8-replay.js`（只读；加载 shipped `plugin.js` 的 VM hooks，不写文件、不升版本）。

### 3.1 最后一杯的统一结果

| 项 | 值 |
|---|---|
| 曲线指令 | 3.067 ml/s |
| 机器回显有效指令（末 60%） | 3.938 ml/s |
| 尾段杯流（同窗） | 4.794 g/s |
| `r_obs`（记录的 `evidence.gainMemory.stages.s2.observedR`） | 1.2174 |
| 比值解 `target/r_obs` | 4.107 ml/s |
| 链路两点（晚写锚点） | 斜率 0.45、截距 ≈2.83、旧仿射 4.72 |
| 链路两点（生效锚点） | 斜率 0.5557、截距 2.6056（占 52.1%）、仿射 4.309 |
| 仿射是否采用 | 否：斜率只有当杯 r 的 46%，链路末笔未落定 |
| 稳态前馈 | k=1.28、spread 0.563（56%）、`eligible:false`、`applied:false` |
| 增益记忆（旧） | r=1.2874 → 3.884，旧代码 applied=true |
| 2.2.15 采用 | **4.107 → 0.9 阻尼 → 4.0625 ml/s** |
| 与所需误差 | **−1.1%**（4.0625 vs 4.107） |
| 旧路径误差 | 记忆 3.884：−5.4%；晚写仿射 4.72：+14.9% |

“所需 4.107”不是目标 5 g/s 本身，而是「保持当杯同窗 r 不变、把杯流从 4.794 推到 5.0」所需的指令；这正是下一杯 S2 曲线要接近的值。

生产路径（不传第 5 个 override，用 41 个 `targetFlowMlS=3.9375` 的样本让 `stage2EffectiveCommand` 自己算）回放同样是 **4.0625**。`s2ReverseEstimate` 的第 5 个参数只用于导出回放，正常调用只传 4 个。

### 3.2 HOLD 是否可达

- 最后一杯：曲线 3.067，统一建议 4.0625 → **ADJUST**。这是正确的：学习结果确实要求更高指令，不该 HOLD。
- 旧代码的 HOLD 判据（建议 vs `s2.currentCommandMlS`）：4.0625 vs 4.3125 → false；即使建议恰好落在曲线上也会被判 false。
- 2.2.15 的 HOLD 判据（建议 vs 曲线）：同一条件若建议是 3.0625 而曲线也是 3.0625 → `sameCommandFlow` 为真 → HOLD。测试 `cut 8 / L-14` 用这个夹具断言 `hold.s2=true`、`actionable=false`、`hold.all=true`，并单独断言 S1 的 ADJUST 落在曲线上时也转 HOLD。
- 因此「假差异消失」和「同一条件真的 HOLD」两件事都有测试；真机数据里没有出现 HOLD，是因为这四杯的学习结果确实与曲线不同，不是判据不可达。

## 4. 测试（677/677）

`tests/verify_v02215.cjs`：666 条既有 + 11 条 cut 8。新增的全部是口径不变量、真机数回放或闭环结果，没有镜像断言：

1. L-13 两条共识路径的相等判据是半档（1/64 命中、1/16+ε 拒绝）。
2. L-13 半档漂移仍能找到历史行（`incompatibleCommands:0`，不再靠 nearby 折算）。
3. L-7 真机 00:25 链路：`r_obs=1.2174`、比例解 4.107、截距 2.606、仿射被拒、下一杯 4.0–4.25。
4. L-7 链路已落定时采用仿射（斜率与 r 一致、截距显著）。
5. L-7 链路分支在四档学习强度下都受 `policy.s2` 限幅（上下界+半个档位的归档余量）。
6. L-7 spread 超限的稳态前馈 `eligible:false` / `applied:false`，且不是建议值。
7. L-15 +25% 通过、+26% 与 −50% 以下拒绝。
8. L-16 目标 4→5 时读取缩放 3.0→3.75、`rescaleOverridesForTargets` 持久化、3× 变化拒绝。
9. L-14 HOLD 与曲线比较；全段 HOLD → `actionable:false`；S1 落在曲线上也转 HOLD。
10. §6.3 跨 measurement basis 的 S3 形状被接受并降置信度。
11. L-7 闭环：在 `cup = 0.556×command + 2.606` 的植物上，5 杯从 3.0675 走到 4.1875，最终杯流 4.934（−1.3%），没有 4.72 的跳变。

历史基线：`tests/verify_v02214.cjs` 未改。在 2.2.14 自己的 plugin+manifest 上 **666/666**；放进本版树（manifest 2.2.15）只剩版本断言红，665/666；对 2.2.15 代码 664/666，红的是版本断言与已废除的「记忆覆盖同杯建议」旧断言。v02215 不假装对 2.2.14 全绿——它注入的新 hooks 在 2.2.14 里不存在。

## 5. 校准与台账

- 真机同窗数据：`r_obs` 1.2174、尾段 4.794、有效 3.938；统一建议 4.0625，与所需 4.107 差 −1.1%。旧记忆 3.884、旧晚写仿射 4.72 同时记录，供下一轮复核。
- 闭环植物：`HX_LOOP_REPORT=1` 的补水植物输出仍是 rise 0.60 s、峰值 +33.2%、平台 −19.3%、return 3.875——本版没有改补水/植物参数，数字与 cut 0/1/5 一致。
- 新增的 S2 反解闭环植物（截距 2.606）5 杯收敛，最终 4.1875 / 杯流 4.934（−1.3%），没有 4.72 的过冲。
- 准确度评级：**估计器在本杯的同窗误差 1.1%**；补水植物整体仍**不记达标**（目标 ≥90%，缺压力/粉饼动态与 ≥5 ml/s 稳态 r 样本）。
- 台账已追加到 `C:/Users/ladios/.codex/skills/decentplugin/SKILL.md` 的「仿真植物校准台账」。

## 6. 已知限制与未决口径

1. **≥5 ml/s 稳态 r 仍 0 样本**。本版所有高流量定数（包括 4–5 区间的 0.88 中位）仍是暂态，不能当稳态；高指令标定（5.5 / 6.5 / 7.5 ml/s 各 3 s）仍待做。
2. **目标比例超过 0.5–2× 仍整套作废**。一条曲线跨一个数量级的目标不是「同一条曲线」；要跨，应先重跑 Flow Cal。
3. **`mapCreatedAt` 变化仍整套作废**。不同 LUT 下的绝对指令没有定义；`gainMemory` 保留并在下一杯重新反算。
4. **记忆先验含当杯观测**：`gainMemorySuggestion` 在 `updateGainMemoryFromRun` 之后调用，同区间先验已经把当杯 r 按 α 混进去；当前权重最多 0.25，实测影响 <0.01 ml/s。若以后要严格「先验不含当杯」，需在更新前快照 band 值。
5. **`s2ReverseEstimate` 的第 5 个参数只用于回放/测试**：导出 `fullRecord` 会剥掉 refill-complete trace，重新算出的 `stage2EffectiveCommand` 与杯内当时的窗口不同；回放必须传入记录的 `tail/r_obs` 才能复现同一窗。生产调用只传 4 个参数。
6. **L-15 的纹波门未动**：真机 00:25 的 15.43% 仍大于 12%，这是 §22.8 的权重门，不属本条的 +8% 上界。

## 7. 复现

```powershell
cd D:/vscode/decenthyperexplugin/decenthyperexplugin.reaplugin
node tests/verify_v02215.cjs                 # 677/677
node D:/vscode/.tools/hx-cut8-replay.js     # 最后一杯：4.0625 vs 所需 4.107
$env:HX_LOOP_REPORT='1'; node tests/verify_v02215.cjs   # 补水植物：rise 0.60 / 峰值 +33.2% / 平台 −19.3%
```

## 8. 验收清单

- [x] L-13 相等判据放宽到 1/32（两条共识路径），跨 basis 保留并降权
- [x] L-7 三套估计统一到 `s2ReverseEstimate`；比值为主、仿射仅在截距显著且链路落定时采用；r 按命令区间记忆
- [x] `gainFeedForward` 的 spread 门生效；不合格不参与；输出归档
- [x] `s2AdaptiveSuggestion` 的 chain 分支受 `policy.s2` 限幅
- [x] L-16 目标比例一步过渡；`rescaleOverridesForTargets` 持久化
- [x] L-15 上界 +25%
- [x] HOLD 与曲线比较；全段 HOLD 才不重写；不变量测试覆盖
- [x] 677/677；安全门零删除；v02214 原样保留
- [x] 真机 JSON 回放 + 闭环植物 + 校准台账
- [ ] commit / tag / push / release：等用户当次授权
