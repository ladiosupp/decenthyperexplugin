# HANDOFF v02256 — S2 补水真自适应重设计（§22.19 落地，改码不发版）

> 用户 11-20 裁定全批＋改码授权（发版/push/tag/装机另问）。口径＝技能 **§22.19**（取代 §22.11 的「≥7 硬悬崖／灌水量静态上限只由安全包线／不降 flood」、D4 floor7 常量、1.8×plat 乘数；§22.18「保≥7」与「峰≤40」冲突时排序＝**不欠流＞不过冲**）。评估依据 [HANDOFF_2026-11-20-adaptive-redesign-proposal.md](HANDOFF_2026-11-20-adaptive-redesign-proposal.md)；**逐处改动/裁定冲突/坑/待验项见 [HANDOFF_2026-11-20-adaptive-impl.md](HANDOFF_2026-11-20-adaptive-impl.md)**（本文只做版本级摘要）。基线 HEAD 19f43c3（2.2.55）。

## 1. 一句话

灌水首笔从「开萃取瞬间冻结的 `max(7, ceil(target), 1.8×platform)`」改成「stage2 入口按本杯 soak 泄压形状现算的 `clamp(max(F_rise, F_budget), 3.5, 8)`」，并把 holdMs 变成 [2000,7000] 双向动态＋预算不可行显式旗标。真机 25 杯回放：慢润湿批（历史 13/13 超时欠流）拿到 flood 中位 8.000＋holdMs 中位 4800；当前机制批拿到 flood 中位 6.375、跨度 6.000–7.313（固定挡跨度 0），估算 Δ峰 −8.7pp。

## 2. 改了什么（plugin.js +273/−24）

- **决策点迁移**：`stage2StartupPlan(mode)` → `(mode, run)`；tick 在 boost 派发前调 `adaptiveReplanAtStage2Entry(t)`，每杯一次（`startup.adaptiveReplanAt` 上锁），复用 `hecLatchTakeover` 的 stage2 重建模式。重建降级则保留旧 plan 并记 `adaptive-replan-skipped`。
- **新增 `soakWettingObservation(run)`**：只读 soak 段压力（泵关，与 S1 指令流量无关）→ 主信号 `soakP2sRatio`，附 `soakP0Bar/soakP2sBar/soakTauES/soakSeconds`；6 个拒收门带 reason。
- **新增 `refillAdaptiveFloodDecision(...)`**：`Vi=clamp(40.929−32.251×ratio,15,36)`（无信号→24.8 冷启动、flood=max(5, platform+1/16)）；`F_rise=4.80/0.80=6.00`；`F_budget=fc+Vi/(holdMs/1000+0.274−0.80)`，`fc=FC_FACTOR(0)×platform`；`flood=snap16(clamp(max(F_rise,F_budget),3.5,8))`；`holdMs` 双向（可行只缩且不涨过设定值，不可行向 7000 抬，仍不够顶满 flood8 并报 `refill-budget-infeasible`）。
- **退役**：`1.8×platform`；D4 `max(7,…)` 常量下限；`refillFloodFloor()=ceil(target)` → 绝对 3.5（连带放开固定挡旋钮 min 与 UI 滑块下限）。
- **`S2_REFILL_LIMITS.maxDurationMs`** `[500,4000,100]` → `[2000,7000,100]`（默认仍 4000）。
- **防篡改闸适配**：`dispatchS2Startup` 的 `plan.holdMs!==settings.maxDurationMs` 等式改为经 `adaptiveFlood`（`holdMs===adaptiveFlood.holdMs && holdMsConfigured===settings.maxDurationMs`）校验；不改则动态 holdMs 会被判 `S2 refill plan settings invalid` → `startup-skipped`（实测踩过）。
- **诊断/UI**：trace 新增 `soak-wetting`（固定挡也记，供 P2 标定）／`adaptive-replan`／`adaptive-replan-skipped`／`refill-budget-infeasible`；plan 新增 `adaptiveFlood{…}` 全证据链；`refillLastShotSnapshot().adaptive`；UI 补水折叠新增 `#refilladaptive` 行（上一杯决策／固定挡观测／预算不可行红字／灌水量超 32ml 告警＋S2 重量预算／信号超标定域告警）；`curveEditorSnapshot().refillAdaptiveLaw` 把常量传给页面脚本。
- `manifest.json` 仅 version 一行（description 保持 275 字符，§1.15）；README 置顶 2.2.56 段。

## 3. 没动什么（逐字）

Va（slope-zero 拒收）／Vb3（瞬时交叉核）／Vd15（衰减例外）／O1（估计载体暖机）／`s2RefillFlowEstimate` 门与 phase 过滤／cutoff predicted 主判／backstop 0.85／两段收口 bleed→return／`boundedRefillCommand` taper 与只降不升／Q2 平滑链（coast、up-hold、治理链、死区、quanta、静默 1200、ceiling）／硬包线 0.10–8.00 与 1/16 档／压力门／ACK／写入预算／单一写者／影子 `sent` 恒 false／LUT 不被学习改写／gain memory／manual 锚／固定挡人工旋钮语义。

## 4. 验证

- `tests/verify_v02256.cjs` **906/906**（892 基线：2 版本钉＋9 处退役口径断言按 §22.19 重写；4 处闭环夹具补 soak 签名并保留非 stage2 样本前缀；**14 新增**含禁用信号族源码级断言、真机杯 20 soak 样本交叉、25 杯真机决策级回放）。`tests/RESULTS_v02256.txt` 为实跑输出。
- `sim/tests/sim-regression.cjs` **5/5**；`node --check` plugin.js 与 verify 均通过；manifest JSON 合法。
- 真机 25 杯回放（开环）：选笔 6.000–8.000 全部落 band、全部 1/16 网格、全部 `predictedBoostToBleed≤holdMs`、零 infeasible、零 extrapolated；批1 ≥80% 拿到不低于历史灌水，批2 高峰杯 ≥60% 拿到不高于历史灌水，全域跨度 ≥1.0 ml/s。
- **闭环真值（rise/峰/wetLat/whole）开环回放测不了**，全部标注为真机锚定估算，须 P2/P3 陪杯。

## 5. APK 移植同步点（full→hec 里程碑）

soak 湿润观测（`soakP2sRatio` ＋6 拒收门）／自适应灌水律（F_rise、F_budget、clamp、冷启动 headroom）／holdMs 双向动态／`refill-budget-infeasible` 旗标与 UI → shadow/arbiter 等价物，与 D1–D6／O1／Va／Vb3／Vd15 债同批。**先确认 APK 侧有 soak 相段样本流**，否则等价物恒走冷启动分支。

## 6. 待用户/统筹确认（阻塞项）

1. **`FC_FACTOR` 默认 0 与 §22.19 文中「fc=0.9×plat」不一致**——三条理由（3.5 下限在 fc=3.49 时数学不可达；§22.19 引用的 6.95s 与 24.8 都是 fc=0 口径；fc=0 拟合 rmse 0.289s vs 0.478s）见 impl §3.1。**建议改 §22.19 该行为「fc = FC_FACTOR × platform，默认 0，Vi 按 fc=0 口径标定」**。
2. holdMs 动态**只作用于 adaptive 挡**（固定挡人工值不动，只记观测）；要延伸到固定挡须另批。
3. 灌水量最坏 56ml（flood8×holdMs7000）**未做硬拦截**，只告警；要硬上限请另批常量。
4. 发版／push／tag／装机：**均未做，等用户指令**。

## 7. 下一步（建议顺序）

P2 固定挡标定试杯（6.0/6.5/7.0 各 ≥3 杯，同豆同研磨，取 `soak-wetting` 与实测 wetLat/b2b/峰/whole 重拟合 `VI_A/VI_B`，并顺带核 `FC_FACTOR`）→ 按标定结果决定是否调 `RISE_TARGET_S`／`HOLD_MARGIN_S` → P3 adaptive 挡闭环 ≥5 杯（验收：峰 ≤ 现中位 −10pp 且 ≤40%、rise ≤0.9s、零超时、whole 不劣化）→ P4 极端粉饼验上行侧与旗标。

