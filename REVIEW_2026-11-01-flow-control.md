# HyperEx 插件流量控制审查 — 2026-11-01（三轮合并去重 · 自洽修订）

审查对象：`decenthyperexplugin.reaplugin/plugin.js` 工作区当前状态（PLUGIN_VERSION 2.2.6，manifest 2.2.6，未提交；已发布 tag v2.2.5 = c64dabc）。
测试基线：`tests/verify_v0226.cjs` 635/635 全绿。`tests/verify_v0225.cjs` 在同一份工作区上 624/627，三条失败全部来自 2.2.6 的 delta 与版本号，不是回归。
真机数据：`C:/Users/ladios/Downloads/hyperex-history (4).json`（11-01 08:30 导出，30 杯，22 杯带 fullRecord，writerVersion 2.2.5）。
设计口径依据：`decentplugin` 技能 §19–§22、`HANDOFF_2026-10-31-design.md`、`HANDOFF_2026-10-31-s2-refill-fix.md`、`HANDOFF_2026-11-01.md`。
本次审查对插件代码只读，未修改任何插件文件；本文档在 2026-11-01 做过一次自洽修订（见附录 C）；分析脚本见附录 A。

三轮审查分别是：① 全量流量控制代码的逻辑矛盾；② 2.2.6 改动后的 S2 补水与 S2 正常段专项；③ 所有门槛与界限值（安全门除外）的清单化复核。本文按子系统合并去重，每条给位置、现状、问题、真机证据、建议（改 / 删 / 保留）。

---

## 0. 结论摘要

设计目标（§22.1）是「尽量平直地达到设定称流速」。真机最近 5 杯 S2 整段回归为 3.559 / 3.952 / 3.751 / 3.627 / 3.820 g/s，对 5 g/s 目标误差 −28.8% / −21.0% / −25.0% / −27.5% / −23.6%，连续 5 杯没有一杯进入死区，也没有收敛趋势。S3 停在 −12.6%…−50.9%。救急在最近 4 杯都触发（S2 救急 0–4 笔；2.2.4 之后每杯 `s3RescueWrites` 都顶到 2 的上限；2.2.3 那杯全场 0 笔救急、S3 救急也是 0），而按 §22.1 救急应当是换纸换豆时的例外。

根因不是单点 bug，而是三层（LUT / 杯间增益 / 杯内决策）各自持有互不相同的机器模型，且多处门槛在偏差最大时最容易不满足。可归纳为四类：

1. **一杯之内存在多个互相矛盾的 S2 基准与增益**（曲线指令 / 补水基准 / 杯内信封中心分别来自不同桶、不同 r，2.2.6 之后补水甚至固定 r=1）。
2. **杯内决策所依据的预测量误差远大于它自己的死区**（S2 预测 MAE 1.35 g/s = 目标 27%，死区 4% = 0.2 g/s），且外推只有上升方向、没有幅度上限，另有 null 被当成 0 g/s 的硬 bug。
3. **步长下限与写入预算在 S3 上直接产生极限环和「墙」**（最小 2–3 档 = 目标 13–20%，救急最小 8 档 = 目标 54%；后段 45% 禁写 + 救急 2 笔封顶）。
4. **学习门槛在偏差大时集体失效**（纹波 CV ≤12%、seed ±20% 覆盖窗、VARIABLE/MIXED/SATURATED 连带封锁增益记忆），恰好与 §22.3「偏差检测 → 降置信 → 当杯局部估计 → 下一杯吸收」相反。

### 0.1 口径与时点（先看这一节）

本文有三套容易混用的对象，后文所有数字都必须按这里读：

| 对象 | 曲线指令 | 回落 | boost | refillBase | 备注 |
|---|---|---|---|---|---|
| 2.2.5 执行杯（1793492759538-1，00:25） | 3.0625 | 2.5（实测） | 3.75 | 2.5（source=lut） | 最后一杯真机数据；旧 holding 逻辑 |
| 2.2.6 下一杯 applied | 3.884→3.875 | 3.875（新 holding） | 7.5 | 5.0（high-flow-direct） | 已写入 nextShotApplied / profileTruth；未跑真机 |
| 2.2.6 工作区（未跑真机） | 同上 | 同上 | 同上 | 同上 | 7.5/5.0 是代码预期，不是实测 |

数据人群也有三套：**2.2.x 八杯**（2.2.0×2、2.2.2、2.2.3、2.2.4×3、2.2.5）用于 730/49、38 点预测、428/205、28 笔下调；**全部 22 杯 fullRecord**用于 86 笔非补水写入（其中只有 2.2.x 的 65 笔带 `stepQuanta`，21 笔夹笔都在这里）；**最近 5 杯**用于 1.1 的逐杯表。S2/S3/全场的写入计数也分开：`liveFlowTrim.normalWrites/rescueWrites` 是全场（S2+S3），`s3NormalWrites/s3RescueWrites` 才是 S3。

---

## 1. 真机数据基线

### 1.1 最近 5 杯（2.2.3 / 2.2.4×3 / 2.2.5）

| runId | 版本 | S2 整段 g/s | S2 误差 | 尾段均值 | 尾段 CV | S3 整段 g/s | S3 误差 | 全场写入(常规/救急) | 静默保持 |
|---|---|---|---|---|---|---|---|---|---|
| 1793462597528-1 | 2.2.3 | 3.559 | −28.8% | — | — | 无数据 | — | 8 (6/0) | 12 |
| 1793489359425-1 | 2.2.4 | 3.952 | −21.0% | — | — | 0.736 | −50.9% | 13 (5/6) | 18 |
| 1793489532447-2 | 2.2.4 | 3.751 | −25.0% | — | — | 1.311 | −12.6% | 13 (8/3) | 19 |
| 1793490122135-1 | 2.2.4 | 3.627 | −27.5% | — | — | 1.686 | −15.7% | 13 (9/2) | 13 |
| 1793492759538-1 | 2.2.5 | 3.820 | −23.6% | 4.147 | 16.5% | 1.683 | −15.8% | 11 (5/4) | 15 |

> 写入列是 `liveFlowTrim.normalWrites/rescueWrites`，含 S2+S3；S2/S3 拆分见 1.2 的小表。2.2.3 的「S3 无数据」指 `rawRegressionGS=null`（没有有效回归），不是没有 S3 写入；该杯 `s3NormalWrites=1`。

### 1.2 统计（22 杯 fullRecord 中 2.2.x 的 8 杯）

先明确三套人群，避免把不同分母混在一起：

| 统计 | 人群 | 说明 |
|---|---|---|
| 730 个检测点 / 49 个 `predictedGS===0` | 2.2.x 八杯 | 只有 2.2.x 的 trace 带预测值 |
| 38 个可核对预测点 / 28 笔下调 / 428 个预算墙 | 2.2.x 八杯 | 见 `__hx-h4-quant.js` |
| 86 笔非补水写入 / 21 笔夹笔 | 全部 22 杯 fullRecord | 21 笔夹笔都在 2.2.x 的 65 笔带 `stepQuanta` 的写入里 |

最近五杯的写入拆分：

| 杯 | 全场常规/救急 | 其中 S3 | S2 |
|---|---|---|---|
| 2.2.3 | 6/0 | 1/0 | 5/0 |
| 2.2.4a（23:29） | 5/6 | 3/2 | 2/4 |
| 2.2.4b（23:32） | 8/3 | 3/2 | 5/1 |
| 2.2.4c（23:42） | 9/2 | 3/2 | 6/0 |
| 2.2.5（00:25） | 5/4 | 3/2 | 2/2 |

- 730 个带预测值的检测点中 **49 个（6.7%）出现 `predictedGS===0` 而 `rawGS>0.2`**，集中在 2.2.3 与 2.2.4 两杯（见 T-1）。
- 全部 22 杯 fullRecord 的 86 笔非补水写入中，2.2.x 的 65 笔带 `stepQuanta`；其中 **21 笔（32.3%）实际移动档数与 `stepQuanta` 不符**（12 笔被信封往下夹、9 笔往上夹）。另有 21 笔是 2.0/2.1 的旧写入，没有 `stepQuanta`，不能参与这个比较。
- 38 个可核对的预测点：**整体 bias +0.250 g/s、MAE 0.920 g/s、20/38 偏高**；分帧 S2(frame1) n=19 bias +0.313 **MAE 1.350**；S3 early(frame2) n=16 bias +0.238 MAE 0.546；S3 mid(frame3) n=3 bias −0.082 MAE 0.194。
- 28 笔下调写入中 **12 笔发生在杯流仍低于目标时**；2.2.3 及之后的 5 杯里 S2 有 **9 笔**这种情况（其中 2.2.3 自己 2 笔；严格在 2.2.3 之后是 4 杯、7 笔）。
- **428 个检测点被 write budget 挡住，其中 205 个同时满足 |误差|>15% 且趋势角 >120°**。

### 1.3 最后一杯（1793492759538-1，v2.2.5）的三层基准

| 来源 | 值 | 出处 |
|---|---|---|
| 曲线指令（机器实际执行） | 3.0625 ml/s（cfg 记 3.067，未归档） | `commands.stage2` / `workflowProfileCommands` |
| 补水控制基准与回落指令 | 2.5000 ml/s（source = lut） | trace `startupAction:"boost"/"return"` |
| 杯内信封中心 | 2.628 ml/s，r = 1.9026，bucket = g2 | trace `controlCenterMlS/controlR/controlBucket` |
| 空粉碗 LUT | 2.507 ml/s | `commands.stage2.lutCommandMlS` |
| 沉降尾段实测 r_obs | 4.147 / 3.406 = **1.2174** | `outputQuality.tailMeanGS` + `stage2EffectiveCommand` |

> 本表的 3.0625 / 2.5 / 3.75 都是 2.2.5 执行杯；2.2.6 的下一杯 applied 是 3.884→3.875、boost 7.5、refillBase 5.0，见 0.1 的口径表。

同一杯 S2 里三个基准相差最大 22%，而实测 r 说明 5 g/s 需要约 4.107 ml/s，三者没有一个对。

补水时序：`stage2_start` t=21104 → boost 3.75 写在 t=21216（仅隔 112 ms，等于 `plan.boostCommandMlS` = 1.5×2.5）→ t=23721 以「maximum duration reached」回落到 2.500（`cutoff: null`，从未按杯流收口）→ t=23785 driver-ack 完成 → t=24301 杯流 2.638 g/s（目标的 52.8%，误差 −47.2%）。回落比曲线正在跑的 3.0625 低 18%，后半杯都在往回爬。

随后四笔常规/救急写入：

| t | 方向 | 指令 | rawGS | predictedGS | 之后 1.5–4.5 s 实测 | 备注 |
|---|---|---|---|---|---|---|
| 25084 | 下调 | 2.5 → 2.25 | 3.710 | 5.897 | 3.74 | 杯流低于目标 26% 时下调 |
| 26411 | 上调 | 2.25 → 3.3125 | 3.591 | 3.021 | 4.71 | 救急 17 档 |
| 27697 | 上调 | 3.3125 → 4.3125 | 3.083 | 3.049 | 4.74 | 救急 16 档 |
| 28994 | 下调 | 4.3125 → 3.125 | 3.728 | 6.386 | 4.52 | 救急后 1.3 s 反向 19 档 |

### 1.4 增益记忆现状

`gainMemory`：seq 3，lastBucketId **g2**。

- **g2** center 0.4715 radius 0.12；s2 r = 1.2874（n=3，lastObservedR 1.2174，lastDeviation 0.1032）；**无 s3 阶段**。
- **g3** center 0.2997 radius 0.12；s2 r = 1.6304（n=2）；s3 r = 1.9421（n=2，drift 0.913）。

反推：g2.s2 更新前 r = 1.3574（由 α=0.5、r_obs=1.2174、r_new=1.2874 解出，与 11-01 交接记录的「g2 r=1.36」一致）。而该杯杯内实际用的 r 是 **1.9026**（上一杯的 `lastObservedR`；本杯完成后才更新为 1.2174。导出的 `gainMemory.local=false` 是更新后重算值，不代表杯内没有 local 覆盖；local 分支顶掉了 3 样本的平滑值）。

两桶命中区间：g2 = [0.3515, 0.5915]，滞回 [0.3215, 0.6215]；g3 = [0.1797, 0.4197]，滞回 [0.1497, 0.4497]。**核心区间在 0.35–0.42 重叠（计滞回则 0.32–0.45）**，`selectGainBucket` 靠 lastBucketId 打破平局。§22.3 记录的两个形态是 0.18–0.35 与 0.55–0.63（间隙 0.20，阈值 0.45），g2 的实际中心 0.4715 落在文档所说的间隙里，radius 0.12 的取值前提不成立。

### 1.5 最后一杯的杯间三套 S2 估计

| 估计器 | 输出 | 是否采用 |
|---|---|---|
| 单杯链路（gain 0.45，chain 2.25→4.3125 / 杯流 3.856→4.794；纯仿射 need 4.77，0.9 阻尼后 4.72） | 4.72 ml/s | 被覆盖 |
| 稳态前馈 `gainFeedForward`（k=1.28，**spread 0.563**；目标折算 3.906，限幅后 3.963） | 3.963 ml/s | applied=false |
| 增益记忆 `gainMemory`（r=1.2874，比例反解） | **3.884 ml/s** | applied=true |

同一杯 `memoryGuardBypass.hard.reason` = "S2 tail ripple 16.5% exceeds 12% learning limit"，relaxed 侧 coverage 1.0 / pressureLimitedFraction 0 / underCommandFraction 0；`historySearch` = checked 5、incompatibleCommands 4、mixedBasis 1、nearbyCommandComparisons 1。

---

## 2. S2 补水（refill）

### R-1 · 有界补水的「逐决策点控制律」实际只执行一次，且必然取上限【建议改】

位置：`boundedRefillCommand`（plugin.js:2266）唯一调用点是 `dispatchS2Startup`（plugin.js:2429）；boost 只在 `p.status==="armed"` 时可派发（plugin.js:2415、plugin.js:7052），写完立刻置 `boosting`（plugin.js:2458），此后 boosting 分支只派发 return。

问题：`base + max(0,(target−predicted)/max(.15,r))` 这个渐减规律、`flowMaxGS` 对 predicted 的夹取、`max(.15,r)` 保护，全部只在 S2 刚开始、杯里还没出水时求值一次。此时 `s2RefillFlowEstimate` 必然返回 null（需 ≥6 点、跨度 ≥0.6 s、r²≥0.90），`predicted=0`，`candidate=max`。所以补水就是「一个固定上限值 + 一个 cutoff 判断 + 一个固定回落值」。

证据：00:25 那杯 boost 写在 `stage2_start` 后 112 ms，指令 3.75 恰等于 `plan.boostCommandMlS`（1.5×2.5）。

冲突口径：§22.5 v2.2.1/v2.2.2「实际指令在每个决策点用 2 s 预测秤流量和 cutoffPercent 计算」。

建议：要么在 boosting 期间允许按决策点重派 boost（每 `predictionSeconds` 一次，受同一 ACK/预算约束），让渐减规律真的生效；要么承认它是固定灌水，把 `boundedRefillCommand` 简化成常量并在文档里撤掉「逐决策点」的说法。二选一，不要保留现在这种「有控制律但从不迭代」的状态。

### R-2 · `high-flow-direct` 让补水与正常段持有互斥的 r【待定口径 F1】

位置：plugin.js:2257（`if(Number(targetGS)>=S2_REFILL_HIGH_FLOW_MLS){...r:1,source:"high-flow-direct"}`），常量在 plugin.js:86。

问题：

- S2 目标默认 5 g/s → 补水基准 5.0、增强上限 `min(8, 1.5×5.0)=7.5`；正常段中心 = 5/1.2874 = 3.884，常规信封上限 = `max(3.884×1.2, LUT 2.507) = 4.625`。**补水认定的稳态指令（5.0）高于正常段信封够得到的上限（4.625）**，高 8.1%；相对中心 3.884 则高 29%。
- 阈值拿**杯流目标 g/s** 去比一个名字与注释都写 **ml/s** 的常量（注释：「high-flow region from about 4 ml/s up」），量纲不一致。
- 不连续跳变：目标 3.99 g/s 时基准走 gain-memory（约 3.1），4.00 g/s 时跳到 4.0。
- 该分支排在 gain-memory 之前，所以默认目标下学到的 r 对补水永不生效；`gain-memory` / `lut` / `profile-base` 三个 source 全部不可达，UI 的「实测」「空粉碗 LUT」标签再也不会出现（`HANDOFF_2026-11-01.md` 第 3 节还叫用户靠这个标签判断有没有找到记忆）。
- 真机不支持 r=1：00:25 那杯沉降尾段 r_obs = 1.2174，折算 5 g/s 需 4.107 ml/s。r=1 高估 22%，记忆里的 1.2874 低估 5%。

冲突口径：§22.5 v2.2.1「`targetGS / r`（无 r 时 LUT）是控制基准」；§22.3「S2 目标 5 g/s → 低压 ≈3.99、高压 ≈4.64」。

注：`high-flow-direct` 是 §22.5 v2.2.6 明确写下的现行口径：「≥4 ml/s（官方高流量区）直接把目标 g/s 当泵指令（5 g/s → 5.0 ml/s），基准不与 S2 曲线指令挂钩」（用户 2026-11-01 点名）。本节的问题不是它违反了旧口径，而是这个新口径让正常段信封够不到补水基准；F1 要决定的是接不接受这个新口径。

建议（待用户定）：保留 r=1 则必须同时把正常段信封上限抬到能覆盖补水基准，否则补水认定的稳态正常段永远够不到；否则把该分支移到 gain-memory 之后当兜底，并把阈值改成对**指令**而非对杯流目标判断。

### R-3 · 收口值与控制律自己的答案差 1.4–2.75 ml/s，且控制律没有收口能力【建议改】

位置：`stage2StartupPlan` 的 `holding`（plugin.js:2344）把回落值定成 `base`（曲线指令）；`boundedRefillCommand` 的下限是 `plan.controlBaseMlS`（plugin.js:2280）。

问题：按同一公式，cutoff 时 predicted = 0.95×5 = 4.75、r = 1，答案应是 5.0 + 0.25 = **5.25**；代码却一步跳回 base：2.2.5 实测 2.5（旧逻辑），2.2.6 若重跑本杯，base 3.0625，下一杯 applied base 3.875；差值分别是 2.75 / 2.19 / 1.4 ml/s。同时因为灌水期指令下限被钉在 controlBase（5.0），即使杯流冲到 7–8 g/s 也降不下来，唯一下降动作就是那次回落。§22.5 v2.2.1 要求「收口按 2 s 预测的秤流量收到目标，不收在泵流量上」；§22.5 v2.2.6 已改成「写回 S2 曲线正在跑的指令」，代码执行的是后者。本节要问的是：这个新口径是否让 5.25 的控制律答案失效。

另注：R-1 说 `boundedRefillCommand` 在 boosting 期间根本不重算；所以当前「降不下来」的直接原因是只算一次，不是下限。若按 R-1 改成逐点重派，R-3 的下限才会成为第二个因。

建议：回落值改成 cutoff 时刻 `boundedRefillCommand` 的输出（并归档），或至少改成 `max(base, 控制律在 cutoff 时的值)`；灌水期下限从 controlBase 改成 `base`（曲线指令），让控制律在过冲时真的能往下走。

### R-4 · 保护性收回会退到比曲线指令更低【建议改】

位置：plugin.js:2431 `returnFloorRaw = Math.min(Number(controlBaseMlS||refillPumpBaseMlS), base)`；plugin.js:2434-2435 在 returnReason 含 pressure / stale 时把 `actualReturnCommandMlS` 设为 `returnFloor`。

问题：只要 controlBase < base（S2 目标 <4 g/s、或关掉 bounded、或增益记忆基准低于曲线指令），限压/秤失效触发的收回就落到曲线指令之下——正是 plugin.js:2341-2343 注释声明要消除的「饿死后半杯」。当前未暴露只因 `high-flow-direct` 把 controlBase 抬到 5.0 > base。

附带：plugin.js:2447 的 `handoffOk` 已把回落值钉死为 returnFloor 或 plannedReturn 二者之一，plugin.js:2448 的区间判断基本冗余。

建议：`returnFloorRaw` 直接用 `base`，保护路径也用 `plan.returnCommandMlS`，删掉 `Math.min`。

### R-5 · 学习窗在「收回未确认」时整体失效【建议改】

位置：`s2LearningWindow`（plugin.js:1678，`startMs` 只在找到 `startup-complete` 时写入，plugin.js:1690）；消费方 plugin.js:968（`stage2EffectiveCommand`）、plugin.js:6506（`controlOutputQuality`）、plugin.js:6702（`liveTrimChainEvidence`）都只判 `Number.isFinite(startMs)`，拿不到窗口就退回**完全不过滤**的数据；只有 plugin.js:6567（`controlLearningAssessment`）会拒绝。

问题：补水灌了但收回没确认（`observeLiveTrimMachine` 的 frame-ended 路径不产生 `startup-complete`）时，`refill=true, confirmed=false, startMs=null`，于是增益记忆的 r 和链路增益会连着 7.5 ml/s 的灌水段一起算——正是这段代码的注释自己举的例子（00:25 链路读到 gain 0.45，沉降尾段是 1.29）。该路径可达：S2 在补水未收回时换帧，杯子照样萃完，`rememberAdaptiveEvidence → updateGainMemoryFromRun` 照跑。

建议：`win.refill && !win.confirmed` 时，上述三处一律返回 null / `{available:false, reason:"refill-return-unconfirmed"}`，而不是退回全窗口。

### R-6 · cutoff 85 无法设置，默认值与生效值不一致【建议改】

位置：plugin.js:2223 `currentS2RefillSettings`：bounded 模式下 `if(out.cutoffPercent===85)out.cutoffPercent=95; out.targetPercent=100`；`S2_REFILL_LIMITS.cutoffPercent = [50,99,1]`（plugin.js:83）；`refillDefaults` 用未迁移的 `validatedS2RefillSettings(null)`（plugin.js:5626 附近）。

问题：迁移按**值**判断，用户主动设的 85 与历史遗留的 85 无法区分，被静默改成 95。而 §22.5 v2.2.2 和交接文档都写「过冲就下调 cutoff」，85 是最自然的选择，偏偏是唯一被覆盖的值。「恢复默认」按钮恢复的 160/85 也不是实际生效值。

建议：迁移改成按标记（写入时存 `migratedToBounded:true`），不要按值相等；`refillDefaults` 在 bounded 模式返回迁移后的值。

### R-7 · 补水侧的小问题【建议改】

- `maximumExtraCommandMl = max(0, boost − refillBase) × holdMs/1000`（plugin.js:2346）：refillBase 现在是 5.0，但真正多灌的水应相对下一杯曲线指令 3.875（2.2.6 applied）算；2.2.5 执行杯的曲线是 3.0625。按 3.875 算，报出的额外水量偏小约 1/3。
- `plan.commandLimited = requested > ceiling`（plugin.js:2337）：默认 5 g/s 时 requested 恒为 8、ceiling = 7.5，所以为真，UI/报告显示「已触及指令上限」；refillBase ≥5.33 时 ceiling = 8、requested = 8，为假，不是「恒为真」。
- `boostQuanta = round((boost − refillBase)×16)`：默认配置下 40 档（2.5 ml/s），是 §22.4 救急最大步 24 档的 1.7 倍。若属灌水设计意图请在文档里写明，否则应与救急上限统一。
- `boundedRefillCommand` 用**夹过**的 predicted（`min(flowMax, ·)`，plugin.js:2278），`s2RefillReturnReason` 用**未夹**的 predicted（plugin.js:2377-2380）。同一子系统里同一个量两种定义，trace 里 `cutoff.predictedGS` 与驱动指令的那个 predicted 不是同一个数。
- `strategy:"refill-85"`（plugin.js:2313）在 cutoff 默认已是 95% 之后仍作为行为开关用在 8 处判断（plugin.js:2387、2388、2398、6895、6929、7018、7044、7092；另有 1683 的 `s2LearningWindow` 也读它）。建议改名为 `refill-bounded` 并保留一次兼容读取。
- `s2LearningWindow` 返回的 `fromMs` 没有任何消费方（死字段）；`gainRegimeForRun` 的 `basis` 字符串写 "S2 late 40%"，实际 `rows.slice(0.4n)` 保留的是后 60%（与 §22.3 的「后段 60%」一致，标签错）。
- `controlOutputQuality` 的 `basis` 仍写 "rolling regressions over final60% of phase"，加了 1500 ms 学习窗后对 S2 已不准确。

---

## 3. 杯内控制（S2/S3 正常段与救急）

### T-1 · `reg.predicted === null` 被当成 0 g/s【建议改，优先级最高】

位置：plugin.js:7110 `const decisionGS=predictive&&Number.isFinite(Number(reg.predicted))?Number(reg.predicted):reg.slope;`；同一模式在 plugin.js:7152（`Number(reg.predicted)<target*.75`）。

成因：`liveTrimRegression`（plugin.js:6999-7000）在尾窗拟合不合格时返回 `fastSlope=null`、`predicted=null`；`Number(null)===0` 且 `Number.isFinite(0)===true`，于是 `decisionGS=0`。对照 plugin.js:7175 明确写了 `reg.fastSlope!==null&&reg.fastSlope!==undefined` 的守卫，说明作者知道该值可空，7110 漏了。

后果：`errGS` 变成整个目标值 → 步长饱和；`predictedRel=1.0` → `cannotReturn` 恒真 → 救急三条件里的「剩余时间回不到带内」被一个缺失估计直接满足；同一条 trace 记录里 `errorPct` 与 `predictedErrorPct` 互相矛盾。

证据：49/730 个检测点（6.7%）中招，记录形如 `rawGS 2.532 / errorPct −49.35 / predictedGS 0 / predictedErrorPct 100`；3 笔写入是在 `predictedGS===0` 下决策的。其中 tMs 30578 那笔：S3 early 帧，`rawGS 3.43`、目标 1.5、`errorPct +128.67`，`decisionGS=0` 让控制器打算**加码**，最终写出 0.8125→0.625 的下调，只因信封上限恰好是 0.625；trace 记的 `stepQuanta:4` 与实际 3 档移动也不符。

建议：`const decisionGS = predictive && reg.predicted !== null && reg.predicted !== undefined && Number.isFinite(Number(reg.predicted)) ? Number(reg.predicted) : reg.slope;`，plugin.js:7152 同样处理。并补一条回归测试：`fastSlope` 为 null 时 `decisionGS` 必须等于 `reg.slope`。

### T-2 · 预测只有上升方向、且无幅度上限（补水侧却有）【建议改】

位置：plugin.js:7000 `predicted = fastSlope + Math.max(0, fastSlope − early.slope) × horizon`，只有 `Math.max(0, ·)` 下界夹取；对照补水的 `s2RefillFlowEstimate` 在 plugin.js:2366 把加速度夹在 ±target。

问题：`fastSlope − early.slope` 是「后 0.75 s 斜率 − 前 0.95 s 斜率」，乘以 2 s 前瞻后放大 2 倍且无上限。减速与下落完全不外推，所以模型系统性偏向少加水。

证据：`rawGS 2.532 → predicted 7.349`（之后 1.5–4.5 s 实测 4.50，超预测 2.85 g/s）。frame-1 预测 MAE 1.350 g/s = 目标 27%，而决策死区是 4%（0.2 g/s），**决策信号的误差是自己死区的约 7 倍**。2.2.3 及之后 5 杯 S2 有 9 笔下调发生在杯流仍低于目标时，典型：`2.5→2.25 @ raw 2.533 / pred 7.349`、`2.5→2.25 @ raw 3.710 / pred 5.897`（实测 3.74）、`3.0→2.75→2.5 @ raw 3.608/3.747, pred 5.552/7.040`（整段收在 −28.8%）。

建议：正常段同样夹幅，`|predicted − fastSlope| ≤ 0.6×target` 或 `predicted ≤ target×1.5`；并考虑补上下落方向的外推（现在只防过冲、不防欠冲，与 §22.1「避免过冲靠统计预测」的用途只实现了一半）。

### T-3 · 前瞻窗两套、死区四个【建议改】

- 前瞻：正常段 S2 = 2 s（plugin.js:6984），补水 = 1.5 s（plugin.js:2316）。§22.4 写 S2 看 t+1.5 s，§22.9 写 S2 2 s 前瞻，技能自身也不一致。建议统一到 1.5 s 并同步两处文档。
- 死区：杯内决策 4%（`deadbandPct`，plugin.js:6850 附近）、杯间 HOLD 8%/5%（`learningPolicy.deadband`）、角度 0° 判定 2%（plugin.js:7142 附近）、`trendFlat` 用 |trendSlope|<0.1 g/s。四者互不派生。建议至少在注释里写明各自用途，避免再被混用（见 T-4）。

### T-4 · `deadbandPct`（流量百分比）被当角度阈值（度）使用【建议改】

位置：plugin.js:6771 `const band=(report&&report.deadbandPct)||2;` → plugin.js:6788 附近 `if(angle<=band)z++`。`deadbandPct = 4`（plugin.js:6850 附近），于是 `zeroDegreeShare` 统计的是 ≤**4°**；而循环内判 0° 用的是 **2% 流量带**（plugin.js:7142 附近），§19 记录的是「0°（≤deadband 2°）…（2% 带内且斜率≈0）」。

建议：`computeAngleStats` 单独引入 `angleDeadbandDeg = 2`，不复用 `deadbandPct`。

### T-5 · 常规信封可以不包含当前指令，且 `hi` 未夹到硬上限【建议改】

位置：plugin.js:7218-7219 `lo=ceil(min(center×0.8, floor)×16)/16`、`hi=floor(max(center×1.2, floor)×16)/16`（`floor` = LUT mapped，缺失时用 center）；越界写入在 plugin.js:7228 被静默丢成 `command-bound-vector`。

问题：

- `hi` 没有夹到 `commandFlowMax`，center 偏大时会算出 >8 的上限，随后写入被静默丢弃。真机 23:29 那杯 center = 7.236（r = 0.691），`hi = 8.625`。
- center 偏低时信封装不下正在跑的指令，任何决策都塌到边界值。真机 tMs 30578：frame 2 指令 0.8125，信封 [0.5, 0.625]，当前指令根本不在信封内。
- 全体统计：全部 22 杯的 86 笔非补水写入中，2.2.x 的 65 笔带 `stepQuanta`；其中 21 笔（32.3%）实际移动档数与 `stepQuanta` 不符（12 下 / 9 上）。导出的 history 因此不能直接用于分析。

冲突口径：§22.7 item 3 把「杯内信封 = 本杯基值 ±20%，基值错就锁死」列为待修；target/r 中心是修法，但 S3 每杯都回落到 `controlSource:"lut"`，等于没修。

建议：`hi = Math.min(LIMITS.commandFlowMax, ...)`；并把「当前生效指令」始终并入信封（`lo = min(lo, command)`、`hi = max(hi, command)`），保证信封至少包含现状，否则控制器无法从任何状态出发。trace 里同时记录 `intendedQuanta` 与 `actualQuanta`。

### T-6 · 救急上限可以比常规更窄【建议改】

位置：救急 `hi = floor(min(8, mapped×2)×16)/16`（plugin.js:7215 附近）；常规 `hi = max(center×1.2, mapped)`（plugin.js:7219）。

问题：当 r < 0.6×target/LUT（S2 LUT=2.507 时即 r < 1.196）时常规 hi 高于救急 hi，进入救急反而缩小可达范围，与 §22.1「救急幅度和密度要大幅提高」相反。真机 23:29 那杯：常规 hi = 8.625，救急 hi = 5.0，实测先写到 5.0 再被迫回落。

建议：救急 `hi = Math.max(min(8, mapped×2), 常规hi)`，并统一到一个 `commandCeilingFor(phase, mode)` 函数（见 L-8）。

### T-7 · S3 常规最小步 2/3 档，是死区的 3–5 倍 → 极限环【建议改】

位置：plugin.js:7202 `normalMin = state.phase==="stage3" ? (predictedRel>=.08?3:2) : 1`；`predictiveStepQuanta(errGS, r, normalMin, 4)`（plugin.js:6824）。

问题：S3 增益约 2.15 g/s per ml/s（11-01 交接），2 档 = 0.125 ml/s → 0.27 g/s = 2 g/s 目标的 **13.4%**；3 档 → 20%。死区是 4%，所以刚出死区的一笔最小写入就过冲 3 倍以上，符号随即反转，形成极限环。

证据：23:42 那杯 S3 指令 0.75→0.875→1.0625→1.4375→1.25→0.75（来回 0.69 ml/s）。

冲突口径：§22.4 的动作集是「0/±1/±2/±4 档（常规）」，最小 1 档。

建议：S3 常规 `normalMin` 改成 1；或把 S3 死区提到 13%（等于最小步能解决的最大误差）。倾向前者，提高死区等于放弃平直度。

### T-8 · 救急步长 8–24 档不分段【建议改】

位置：plugin.js:7204 附近 `predictiveStepQuanta(errGS, r, 8, 24)`。

问题：8 档 = 0.5 ml/s，在 S2（r≈1.22）是 0.61 g/s = 目标 12%，在 S3（r≈2.15）是 1.075 g/s = 目标 **54%**。同一档数范围对两段物理意义差 4 倍。

证据：2.2.5 那杯 f3 连续两笔请求 8 档（0.75→1.25→1.4375；第二笔实际被信封夹到 3 档）；23:42 那杯 f2 请求 8 档上去（实际 +6）、8 档下来（实际 −8）。本节所有“8 档”均指 `steps` 请求档数，实际档数见 T-5 的 21 笔夹笔统计。

建议：救急下限按误差比例给，例如 `min = clamp(round(0.25×|err|/r×16), 2, 8)`，让 S3 救急最小笔落在 0.1–0.2 ml/s；上限 24 档保留。

### T-9 · S3 写入预算 + 后段禁写构成「墙」【建议改，需确认归类】

位置：plugin.js:7187-7188（救急 ≥2 笔 / 常规 ≥4 笔即拒）、plugin.js:7190（`progress>=.55 → S3 late-phase coast`）；`phaseWrites` / `phaseRescueWrites` 只在换段时归零（plugin.js:7083 附近）。

证据：428 个检测点被 write budget 挡住，其中 205 个同时 |误差|>15% 且趋势角 >120°。2.2.5 那杯 check 158–172 连续 15 个点被预算挡住：158–159 是 "S3 normal write budget"（rescue:false；158 角 3.9°），160–172 是 "S3 rescue write budget"（rescue:true；160–168 角 171–178°、`rescueAngleStreak` 到 10；169 角 2.0°、streak 归零；170–172 角 177–178°）。errorPct −21.7%→−30.8%。最近 4 杯（2.2.4 之后）`s3RescueWrites` 都等于上限 2；2.2.3 那杯是 0。

冲突口径：§22.8「门槛第一安全、第二数据有效，不要形成墙壁」；§22.1「大偏差时救急幅度和密度要大幅提高」。注意 §22.8 把「写入预算」归在安全门里——全局 `maxWrites`（50/150/200/250）确实是安全预算，但 S3 的 4+2 是行为预算，这条归类需要用户确认。

建议：救急预算按累计档数而非笔数（例如 S3 救急总额 24 档，可 3 笔 8 档或 1 笔 24 档）；趋势角连续 ≥120° 超过 3 个检测点时临时放开常规预算；删掉 `progress>=.55` 的后段禁写，或改成「后段只允许朝减小误差方向、步长上限降到 2 档」。

### T-10 · 救急判据三条件实为两条【建议改】

位置：plugin.js:7151-7155。`remainingS = Math.max(0, ...)` 恒有限且 ≥0，所以 `!Number.isFinite(remainingS)` 是死条件；`remainingS` 只与常数 2 比较，从未进入外推。predictive 模式下 `decisionGS === reg.predicted`（有限时），因此 `cannotReturn` 的第 2/3 子句与 `predictedRel>.25` 逻辑等价。

结果：`rescueHot = angleStreak>=2 && predictedRel>.25`，§22.4 的「外推剩余时间内回不到带内」没有被独立评估，而且用的带是 ±25% 而不是 4% 死区。

建议：把剩余时间真正用起来，例如 `cannotReturn = |target − decisionGS| / max(0.1, 每档可修正量) × 静默间隔 > remainingS`，或按 §22.4 的语义用 4% 带做外推判定。

### T-11 · handover 相关三处形同虚设【建议改】

- `approachWriteIntervalMs:750`（plan 在 plugin.js:2316，门在 plugin.js:7101）被同一次 tick 后面的 1200/800 ms 静默门（plugin.js:7192）完全覆盖：松的门不可能放行严的门挡住的东西。建议删掉，或把静默门改成 `min(silenceMs, approachWriteIntervalMs)` 让它在接管期真的放宽。
- `approachMs` 默认 200 ms 而 tick 周期 250 ms（level 3），默认值下 handover 窗大概率整段跳过。真机 00:25 那杯设的是 800 ms，check 13–14 命中（`handoverProgress` 0.583→0.916，间隔 267 ms，267/0.333≈801 ms），说明 800 ms 能跨两个 tick；200 ms 默认值本身还没有这组实测。建议默认提到 600–800 ms（≥2 个 tick），再用一杯 200 ms 做对照。
- `row.approachFraction` 恒为 1（plugin.js:7095），真正算出的 `fraction` 只进了 `handoverProgress`。§22.5 称 `approachMs` 是「接管渐进上限」，但控制路径里没有任何渐变。建议要么用 `fraction` 缩放步长/死区，要么删掉这个字段。

### T-12 · `vectorStepCount` 的连续大角度加码在默认模式下是死代码【建议改或删】

位置：plugin.js:6798。predictive 模式走 `predictiveStepQuanta`，`vectorStepCount` 只在 legacy 分支被调用；`bigAngleStreak` 被计算、被上报，但不影响步长。

冲突口径：§19 把「连续 ≥45° → ≥3 提 6 档、≥6 提 8 档」记为现行行为。

建议：要么删函数并在文档撤掉这条，要么接进 predictive（`bigAngleStreak≥3` 时常规 max 从 4 提到 6、≥6 提到 8）。

### T-13 · 其它杯内小问题【建议改】

- `minWriteIntervalMs:50`（report 字段）与 predictive 的 1200/800 ms 静默并存，legacy 模式下只有 50 ms 生效；报告值有误导性。
- 救急静默 800 ms 短于同一节记录的「一笔要 1.2 s 才完全进泵」（plugin.js:7192 vs §22.4）。真机有一笔 `machine-target-response latencyMs:1235`。见 F3。
- `computeAngleStats` 与循环内角度公式各写一遍（plugin.js:6771 起 / plugin.js:7142 起），两处 0° 定义不同（4° vs 2% 流量带），容易再次跑偏。建议抽成一个函数。

---

## 4. 杯间学习（增益记忆 / 标量与形状共识）

### L-1 · VARIABLE / MIXED / SATURATED / LIMITED 连带封锁增益记忆【建议删】

位置：plugin.js:3129（离散度 > `maxVariability` → VARIABLE）、plugin.js:3131（两杯误差符号不同或任一杯在死区内 → MIXED）、plugin.js:3379 的 `/SATURATED|LIMITED|VARIABLE|MIXED/` 把 `gainMemory.applied` 置 false。

问题：明确的负反馈。两杯误差一正一负恰是收敛中的正常形态，越接近目标越容易触发 MIXED；离散度大恰是增益记忆要吸收的对象（§22.6：稳态 CV 本身 5–11%，回放显示固定前馈与 1/16 反馈都是 5–11% CV）。

建议：删掉这条正则封锁，改成降权——VARIABLE/MIXED 时回填 α 减半、confidence 降一级，但 `target/r` 照常应用。§22.8 已写「一致性门改成降权 + 一步过渡」，这条是未落地部分。

### L-2 · 链路饱和同时封掉「学」与「用」【建议删】

位置：plugin.js:984（`liveTrimChain.usable===false → gainStageObservation 返回 null`，不观测 r）+ plugin.js:3379（不应用 r）。`s2AdaptiveSuggestion` 的 chain 分支返回 `action:"SATURATED / HOLD"`。

问题：指令升了杯流没升 = 增益变了，正是 §22.3 要求「偏差检测 → 降置信 → 当杯局部估计 → 下一杯吸收」的场景，代码做的是相反的「既不学也不用」。

建议：两处都删；饱和时强制 `local=true` 并把 α 提到 `GAIN_MEMORY_DEVIATION_ALPHA`(0.55)，让这一杯的局部观测直接进桶。

### L-3 · `local` 覆盖用的是上一杯的原始观测，不是当杯估计【建议改】

位置：plugin.js:1090-1092 `local = lastDeviation > 0.15 → r = lastObservedR`。`gainMemorySuggestion` 只读存量状态，代码里没有任何杯内重估；`liveTrimMemoryCandidate`（plugin.js:6806）还优先取 `state.diagnosticLast`。

证据：00:25 那杯 g2 平滑 r = 1.3574（n=3，`gainConfidence` 判 HIGH），杯内实际用 r = 1.9026（上一杯的 `lastObservedR`，且是被错误分母污染的值），中心因此是 2.628 而非 3.683，差 29%，把正在跑的指令挤到信封上限一个档位以内。同一杯的 `gainMemory.confidence` 仍报 HIGH，完全不反映这次覆盖。

冲突口径：§22.3「当杯用局部估计」。

建议：`local` 只降 confidence 与提高 α，不直接顶掉平滑 r；若要顶掉，必须用当杯数据（例如 S2 后段的 `tailMeanGS / stage2EffectiveCommand`）而不是上一杯的 `lastObservedR`。`gainConfidence` 在 `local=true` 时强制降到 LOW。

### L-4 · 桶中心不自适应、两桶重叠、S3 记忆可整体丢失【建议改】

- 桶中心在 `createGainBucket` 时一次性写死，之后不更新；`radius=0.12`、`hysteresis=1.25` 固定。真机 g2 中心 0.4715 落在 §22.3 记录的间隙（0.35–0.55）里，两桶命中区间核心在 0.35–0.42 重叠（计滞回则 0.32–0.45），`selectGainBucket` 只能靠 `lastBucketId` 打破平局——同一物理签名连续两杯可落进不同桶，这正是 §22.3 明确反对的「认出这是哪张纸」。
- `GAIN_MEMORY_MAX_BUCKETS=12` 的淘汰是「第一个既不是新桶也不是 lastBucketId 的下标」，不是 LRU；桶碎片化时有用记忆会被挤掉。
- g2 没有 s3 阶段，而 lastBucketId = g2，所以 2.2.5 那杯 S3 的 `controlSource` 回落到 `lut`（中心 0.719、`controlR:null`），g3 里学到的 s3 r=1.9421 / drift=0.913 完全取不到。真机最近一杯（2.2.5）S3 形状是全平 0.777/0.777/0.777；此前 2.2.2/2.2.3 是 0.798/0.798/0.849，2.2.4 的 shape 是 disabled。§22.9 记的「已完成 S3 drift model」在数据上没有体现。

建议：桶中心改成滑动中位数（或每杯按 α 更新 center）；命中判定改成「最近邻 + 距离超过 radius×hysteresis 才新建桶」，新建前先尝试合并到最近桶；某段（s2/s3）在当前桶缺失时回退到**其它桶的同段记忆并标记 stale**，而不是直接掉回 LUT；淘汰改 LRU（按 `updatedAt`）。

### L-5 · `stage3ShapeOnlyConsensus` 约 15 条串联门，实际不可达【建议删】

位置：plugin.js:3145-3179。串联条件：同指令（逐帧 ≤0.005）+ 同时序（≤0.25 s）+ 同 basis family + 两杯都 LATE DECAY + lateToEarlyRatio<0.80 + overallR2≥0.95 + 逐帧 r2≥0.95 且 seconds≥3 + shapeVar≤0.15 + overallVar≤0.20 + 两杯 profileRatio 都<0.80 且互差≤0.12 + 逐帧变化≤0.05 ml/s 且≤4% + 非递减 + 相邻增幅≤max(+0.25,×1.35) + 加权曝光变化≤0.2% + 至少一帧变化≥0.005。

证据：§22.6 记录 S3 形状 11 杯冻结在 1:1:1.09；真机现在是全平 0.777（2.2.5；此前 2.2.2/2.2.3 是 0.798/0.798/0.849）。

建议：整块删掉，S3 形状统一走 drift 模型。若要保留，把 shapeVar / overallVar / profileRatio 互差 / exposureChange 这四条改成打分而非串联硬门。

### L-6 · S3 非递减约束与 drift 模型互斥（三处）【建议删】

位置：`projectS3Commands`（plugin.js:1136，强制非递减 + 相邻增幅，违反就返回 old）、曲线编辑器 `curveLimits`（plugin.js:4120，early 上限 = mid、late 下限 = mid）、`applyCurveEditorDraft`（plugin.js:5675，`early<=mid<=late` 否则抛错，且写回的 shape 不带 `model:"drift"`）。而 `driftShapeSuggestion`（plugin.js:1183 起）与 `s3ShapeStatus` 的 drift 分支明确允许 early>mid、late<mid，`s3DriftModel` 默认开（plugin.js:473）。

后果：drift 形状生效时曲线编辑器的 mid 上下界会互相越界变成不可编辑；任何一次曲线保存（包括只改补水参数）要么 409 报错、要么把 drift 降级成 legacy（连带 `manualS3ShapeLocked` 失效、自动 S3 学习恢复）。UI 文案仍写「S3 early≤mid≤late and adjacent-rise limits remain」。`test-command-set`（plugin.js:7878 起）反而正确支持 drift——同一个存储对象两个编辑器两套合法性规则。

建议：删掉三处非递减，只保留相邻增幅上限；`applyCurveEditorDraft` 按 `model` 分支校验，写回时保留 `model:"drift"` / `earlyFactor` / `drift`；同步删改 UI 文案。

### L-7 · 三套 S2 估计互相矛盾，最弱的一套赢【建议改】

位置：`liveTrimChainEvidence` → `s2AdaptiveSuggestion` 的 LUT COMPENSATE（仿射反解，plugin.js:1268 附近）；`stageGainEstimate` → `addGain`（plugin.js:3358 附近）；`gainMemorySuggestion` → plugin.js:3381-3383 覆盖前两者的 `suggestedCommandMlS`。

问题：链路测的是**增量增益**（0.45 g/s per ml/s，两点拟合截距约 2.83），按仿射反解 5 g/s 需 4.77；增益记忆是**比值**，按 `target/r` 反解给 3.884。有大截距时比例反解系统性偏低。§22.6 记的跨杯增益 0.976 g/s per ml/s 与 §22.3 的比值 r 是两个量，代码当同一个用。

证据不能跨杯配对：23:42 的 3.094 是 `controlCenterMlS`（该杯曲线指令是 2.5），2.2.5 执行杯曲线是 3.0625，3.884 是下一杯 applied（profile 读回 3.875）；3.75/3.63/3.82 也分别是 2.2.4b/2.2.4c/2.2.5 的杯流。正确写法是「同一杯的曲线 / 中心 / 杯流」三列，不能排成一条 3.094→3.067→3.884 的曲线序列。缺口确实一直在，但要用同杯数据证明。同杯 `gainFeedForward.spread = 0.563`（56%）远超 §19 要求的「两杯相差 ≤10%」，却仍被计算并上报（`applied:false`，但 `addGain` 在别的分支会应用）。

建议：统一到一种反解。若保留比值模型，必须承认它假设「过原点线性」，并在截距显著时用仿射反解；`gainFeedForward` 的 spread 门（§19 的 10%）应当真正生效，超过就不参与。`s2AdaptiveSuggestion` 的 chain 分支目前无 policy 限幅（只被 8 ml/s 卡，§22.7 item 2），应与标量路径一样受 `policy.s2` 约束。

### L-8 · 同一个 `target/r` 有四个上限 + 一个补水基准【建议改】

- `gainMemorySuggestion` ceiling = `min(8, LUT×2)`（plugin.js:1094）
- `driftShapeSuggestion` ceiling = `min(8, LUT×2)`（plugin.js:1208）
- 常规信封 hi = `max(center×1.2, LUT)`，**未夹到 8**（plugin.js:7219）
- 救急 hi = `min(8, LUT×2)`；补水基准（2.2.6 起）= target 本身（r=1），它是 base 不是 ceiling，增强上限是 1.5×target（默认 7.5）

建议：抽一个 `commandCeilingFor(phase, mode)` 统一计算，常规 hi 也夹到 `commandFlowMax`，救急 hi 不小于常规 hi（见 T-6）。

### L-9 · r 的取值范围三处不同【建议改】

`normalizeGainMemory` 收 (0.05, 8]（plugin.js:875），`gainStageObservation` 只产 [0.2, 3]（plugin.js:992、plugin.js:1002），`gainMemorySuggestion` 只要求 >0.05（plugin.js:1093）。存量里若有 r=5 会被 suggestion 直接用（command = target/5 = 1.0 ml/s）。

建议：统一到 [0.2, 3]，`normalizeGainMemory` 越界即丢弃该 stage 并记录原因。

### L-10 · r 的分子分母窗口不一致【建议改】

分子 `controlOutputQuality.tailMeanGS` = 相位（窗口）后 **60%** 的 2 s 滚动回归均值（plugin.js:6504 起）；分母 `stage2EffectiveCommand` = 后 **40%** 的 `targetFlowMlS` 中位数（plugin.js:967 起）。杯内调流保证指令在这段时间里一定动过，所以 r 混了两个指令区间。加了 1500 ms 学习窗后两个窗口都变短、重叠变多，但仍不重合。

建议：分母窗口与分子对齐（都取后 60%，或都取后 40%）。

### L-11 · 三套执行器/质量门阈值互不相同，且两处仍用过期分母【建议改】

| 门 | 覆盖率 | 限压占比 | 欠跟踪占比 | 欠跟踪分母 |
|---|---|---|---|---|
| `stageActuatorEvidence`（plugin.js:2073） | ≥0.80 | <0.20 | <0.25 | `cfg[phase+"CommandMlS"]` |
| `gainMemoryQualityGuard`（plugin.js:1030） | ≥0.60 | <0.35 | <0.40 | `cfg[phase+"CommandMlS"]` |
| `tailMachineGain`（plugin.js:6534-6535） | ≥0.70 | <0.20 | <0.25 | 经 `controlLearningAssessment.known()` |
| `gainStageObservation` 纹波 | — | — | — | 纹波 CV ≤20% |
| `controlLearningAssessment` 纹波（plugin.js:6561、2524、3233） | — | — | — | 纹波 CV ≤ `spread(12)` = 12%（激进档 15.6%） |
| `s2RefillPumpEstimate` 纹波（plugin.js:2240） | — | — | — | 纹波 CV ≤15.6% |
| `startupMetricAllowed` 纹波（plugin.js:2156） | — | — | — | 纹波 CV ≤12×factor（默认 12%） |

问题：同一个物理量最多有四个阈值。纹波 12% 是当前 S2 学习最常触发的封锁（真机 16.5% 直接被 hard guard 拒，靠 relaxed 绕过；00:25 的 startup metrics 是 15.43%），而 §19（技能第 523 行）说稳态 CV 主要是粉饼/泵扰动、正常值 5–11%，所以 12% 卡在正常物理波动边缘。两处欠跟踪门用**开杯曲线指令**做分母，而 2.2.5 已经在 r 上把分母换成实际生效指令（`stage2EffectiveCommand`），这两处没换——曲线指令偏高时（LUT COMPENSATE 给过 5.875）大部分样本会被误判成欠跟踪。§22.7 item 6 点名这组门在 10-29 的 14 杯里挡掉 13 杯，至今未改。

建议：纹波四处（含刚补的 `startupMetricAllowed`）统一到 20%，并按 §22.8 改成权重（12–20% 之间 α 减半，>25% 才 HOLD）；执行器三处对齐到 0.60 / 0.35 / 0.40；欠跟踪分母改用 `stage2EffectiveCommand(run)` / S3 逐帧实际指令，取不到就判 not-eligible（不要退回曲线指令）。

### L-12 · `known()` 的开杯指令 ±20% 窗是「偏差越大越学不到」的墙【建议改】

位置：plugin.js:6578 `if(v<LIMITS.commandFlowMin||v>LIMITS.commandFlowMax||v<base*.8-.02||v>base*1.2+.02)return null;`，base = 开杯 seed 指令。随后 `good < machine×0.7` 即拒绝整杯（plugin.js:6594 附近）。

问题：杯内调流每杯都把指令推出 ±20%（常规信封到 center×1.2，救急到 2×LUT），于是覆盖率塌、学习被拒。这正是 §22.7 item 6 描述的情形；§22.8 的「一致性门」例子是 target 比例 / command 比例 / basis 匹配，本条更接近数据有效性/覆盖门。

建议：base 换成该样本时刻的实际生效指令（trace 里最近一次 write 的 `commandMlS`，退回 `targetFlowMlS` 自身），窗放宽到 ±35%；或把「指令是否已知」从硬门降成权重，覆盖判定只留 `machineTelemetryValid + machineAgeMs≤600 + frame`。

### L-13 · `sameScalarAdaptiveEvidence` / `sameStage3Shape` 的相等判据比档位细 12.5 倍【建议删或放宽】

位置：plugin.js:2620（|command 差| ≤ 0.005、|target 差| ≤ 0.01）、plugin.js:2623-2629（逐帧 ≤0.005、时序 ≤0.25 s、target ≤0.01、basis family 相等）。驱动档位是 0.0625。

证据：真机上一杯 `historySearch` = checked 5、incompatibleCommands 4，只剩 1 条靠 `s2NearbyEvidence` 的 0.5–2× 比例救回。

建议：删掉严格相等路径，让 `s2NearbyEvidence` / `stage3ReferenceEvidence` 的 0.5–2× 折算成为唯一判据；若保留，阈值改半个档位 0.03125。

### L-14 · 学习输出未归档 → HOLD 判据不可达 → 每杯重写曲线【建议改】

位置：`gainMemorySuggestion.commandMlS = round(target/r, 3)`（plugin.js:1095）、`driftShapeSuggestion` 的三个指令（plugin.js:1213 附近）、`scalarLearningSuggestion.suggestedCommandMlS` 都未过 `snapCommandFlow`；而曲线在 `profileObject` 归档（plugin.js:4495 附近），`cfg.stage2CommandMlS` 保留未归档值（plugin.js:1480 附近）。HOLD 判据是差值 <0.005（plugin.js:3139、plugin.js:3381 附近、`scalarLearningSuggestion` 的 `|value-command|<.005`）。

问题：0.005 比半个档位（0.03125）细 6 倍，所以「gain memory already maps to the current command」这条 HOLD 分支实际不可达，`actionable` 每杯为真、AUTO APPLY 每杯重写曲线。§21 记录曲线是内容寻址的，重写可能改变 profile id 并让 Streamline 收藏掉链。

建议：所有学习输出先过 `snapCommandFlow`；所有「指令是否相同」的比较统一用 0.03125。

### L-15 · `startupMetricAllowed` 的 +8% 上界让起步增强只在不需要时可用【建议改】

位置：plugin.js:2156，`tailMeanGS ∈ [target×(1−0.5×factor), target×(1+0.08×factor)]`、`tailCvPct ≤ 12×factor`、`overshootPct ≤ 8×factor`。

问题：下界松到 −50%、上界紧到 +8%，意味着上一杯已几乎达标才允许起步增强，而这条本来就是给起步慢的杯子用的。真机 00:25 的 `tailCvPct` 15.43 > 12，`headroomPassed:false`。（只影响 legacy 起步路径，bounded 补水不走它。）

建议：上界放宽到 +25%，或删掉上界只留下界。

### L-16 · 目标比例 0.5–2× 作废整套 override，与增益记忆不同步【建议改】

位置：`testOverrideStatus` 的 targets 比例门；`mapCreatedAt` 不等也整套作废。

问题：§22.8 明确列为该放宽的一致性门。改目标或重校准会清掉学来的绝对指令，而 `gainMemory` 保留（符合 §22.1「重跑 Flow Cal 后增益保留」），两者不同步：记忆还在但这一杯没有指令可用，要靠下一杯重新反算。

建议：比例失配时调用已有的 `rescaleOverridesForTargets` 做一步过渡，而不是整套作废；重校准时保留 `origin:"adaptive"` 的指令并按新 LUT 重新反算一次。

### L-17 · `gainBackfillAlpha` 的 0.12 与 §22.3 的 0.1–0.15 一致，但缺少「介入强度」分级【建议改】

位置：plugin.js:912 附近：`rescueWrites>0 → 0.5`，`normalWrites>0 → 0.12`，否则 `GAIN_MEMORY_ALPHA=0.35`，偏差 >15% 时 `max(·, 0.55)`。

问题：只看「有没有救急笔」，不看救急了几笔、幅度多大。§22.7 item 5 指出「传导无条件全量（≥2 次同向写入 → 0.9 全推），不区分介入强度」，这里同类问题：1 笔救急与 6 笔救急得到同一个 α=0.5。真机 23:29 那杯 6 笔救急、指令从 2.5 走到 5.0 再回到 1.75，α 仍是 0.5。

建议：α 按介入强度分级，例如 `0.35 + 0.05×min(6, rescueWrites) + 0.01×normalWrites`，上限 0.7；或直接用「救急档数总量」做权重。

---

## 5. 档位（1/16 ml/s）与量纲

### Q-1 · 归档只做在写入面，学习面与配置面仍是未归档值【建议改】

2.2.3 把 A010 帧、曲线 S1/S2/S3、S3 三段形状、两条校准曲线统一到 `toDriverStep` / `snapCommandFlow` / `formatCommandFlow`，但：

- `resolvedStageCommandFlow` / `baseStageCommandFlow` 返回未归档值（LUT 插值本身就会产生非档位值），`cfg.stageNCommandMlS` 因此是 3.067 这类数（plugin.js:1480 附近），而曲线帧是 3.063。`commandFlowSummary` 上报给 UI 的也是未归档值（plugin.js:1331 附近），所以「CURRENTLY APPLIED」显示的数字与机器实际执行的不同。
- `liveTrimControlCenter` 返回 `target/r` 未归档（plugin.js:6816 附近），而补水的 `boundedRefillControlBase` 归档（plugin.js:2246 起）。同一个 `target/r` 两种处理。
- 学习输出未归档（见 L-14）。
- 曲线编辑器 `curveSetValue` 允许 4 位小数（未归档），`curveNudge` 按 1/16 走；两个入口口径不同。

建议：把 `snapCommandFlow` 提到 `resolvedStageCommandFlow` 的返回值上（这样 cfg、UI、学习、写入四面同源），`liveTrimControlCenter` 同样归档；`curveSetValue` 输入后归档。

### Q-2 · `S2_REFILL_HIGH_FLOW_MLS` 量纲错用【见 R-2 / F1】

常量名与注释都是 ml/s（「high-flow region from about 4 ml/s up」），比较对象是杯流目标 g/s。

---

## 6. 门槛与界限值汇总（按 §22.8 四类）

### 6.1 安全门 — 建议全部保留硬门

压力上限与 0.90/0.95 限压判据、A010 ACK 与 2000 ms 超时、`startupWatchdog`(holdMs+2500)、帧确认与 `state.stage2SkipSent`、profile 校验与 readback（`runtimeProfileVerified` / `profileTruthVerified` / `machineUploadAcknowledged`）、`LIMITS.commandFlowMin/Max` 0.10–8.00、`assessRunLearningIntegrity` 的秤掉重(≥3 g)/跳变(>max(12,30dt))/skip 计数(>2)/`completed at` 要求、全局 `maxWrites` 50/150/200/250 与 `maxChecks 2000`、`stage2CupOnset` 出液判定、回归 r²≥0.90 与样本数下限、`multiplierClose ±0.015` 与 LUT 绑定校验、`mappedCommandForReal` 拒绝外插（`lo×0.92 … hi×1.08`）、`recomputeCalibrationUsability` 的目标在标定范围内检查。

### 6.2 数据质量门 — 建议改权重

| 门 | 位置 | 现值 | 建议 |
|---|---|---|---|
| S2 尾段纹波 CV | plugin.js:6561 / 2524 / 3233 | ≤12%（激进 15.6%） | 统一 20%，12–20% 降权，>25% 才 HOLD（L-11） |
| 增益观测纹波 CV | `gainStageObservation` | ≤20% | 与上统一（L-11） |
| 补水前杯纹波 CV | plugin.js:2240 | ≤15.6% | 与上统一（L-11） |
| 执行器覆盖/限压/欠跟踪 | plugin.js:2073 / 1030 / 6534 | 三套不同 | 统一 0.60 / 0.35 / 0.40（L-11） |
| `known()` seed ±20% 窗 | plugin.js:6578 | ±20% | 换实际生效指令 + ±35%，或降权（L-12） |
| 欠跟踪分母 | plugin.js:1017 / 2069 附近 | 开杯曲线指令 | 换实际生效指令（L-11） |
| r² / 样本数 / 秒数 | 多处 `admission.r2/samples/seconds` | 随学习档缩放 | 保留（属数据有效性，且已随档位缩放） |
| `plausible` measured/target ∈[0.2,3] | plugin.js:3103 | — | 保留 |

### 6.3 一致性门 — 建议删除或放宽

| 门 | 位置 | 现值 | 建议 |
|---|---|---|---|
| VARIABLE / MIXED 封锁记忆 | plugin.js:3129 / 3131 / 3379 | 硬封 | **删**，改降权（L-1） |
| SATURATED 封锁学与用 | plugin.js:984 / 3379 | 硬封 | **删**，改 local+α 0.55（L-2） |
| 指令相等 ≤0.005 | plugin.js:2620 / 2629 | 硬门 | **删**或放宽到 0.03125（L-13） |
| HOLD 判据 <0.005 | plugin.js:3139 / 3381 | 硬门 | 改 0.03125 并归档学习输出（L-14） |
| target 比例 0.5–2× | `testOverrideStatus` | 整套作废 | 改 rescale 一步过渡（L-16） |
| basis family 相等 | plugin.js:2625 | 硬门 | 保留但降权（跨 basis 已有 `cross-window historical reference` 标记） |
| S3 非递减 + 相邻增幅 | plugin.js:1136 / 4120 / 5675 | 硬门 | **删非递减**，保留增幅（L-6） |
| `stage3ShapeOnlyConsensus` 15 条 | plugin.js:3145-3179 | 硬门 | **整块删**（L-5） |

### 6.4 方向门与行为预算 — 建议改

| 门 | 位置 | 现值 | 建议 |
|---|---|---|---|
| S3 常规 4 笔 / 救急 2 笔 | plugin.js:7187-7188 | 硬顶 | 改累计档数 + 大角度时放开（T-9） |
| S3 后段 45% 禁写 | plugin.js:7190 | 硬顶 | **删**或改成单向限幅（T-9） |
| S3 常规最小步 2/3 档 | plugin.js:7202 | 下限 | 改 1 档（T-7） |
| 救急步长 8–24 档 | plugin.js:7204 | 下限不分段 | 下限按误差比例（T-8） |
| 静默 1200 / 800 ms | plugin.js:7192 | — | 救急改 `max(800, 上一笔实测延迟)`（F3） |
| `approachWriteIntervalMs` 750 | plugin.js:2316 / 7101 | 死参数 | **删**或让静默门取 min（T-11） |
| 死区 4% | `deadbandPct` | — | 保留，但不要复用为角度阈值（T-4） |
| 角度 0° 判据 2% / 4° | plugin.js:6771 / 7142 | 量纲混用 | 引入 `angleDeadbandDeg=2`（T-4） |
| `vectorStepCount` 大角度加码 | plugin.js:6798 | 默认模式死代码 | 接入 predictive 或删（T-12） |
| 救急退出 predictedRel<0.06 或 angle<90 连续 2 次 | plugin.js:7158 附近 | — | 保留（属方向门「不反相」） |

### 6.5 补水参数界限

| 项 | 位置 | 现值 | 建议 |
|---|---|---|---|
| `cutoffPercent` | plugin.js:83 / 2223 | [50,99]，但 85 被静默改 95 | 迁移改按标记（R-6） |
| `targetPercent` | plugin.js:83 / 2223 | [100,160]，bounded 强制 100 | 保留；文档改口径为「bounded 下不参与」（§22.5 v2.2.2 已这么写；v2.2.1 的「只是指令上限」是旧口径，与代码强制 100 不符） |
| `approachMs` | plugin.js:83 | [200,6000]，默认 200 | 默认提到 600–800（T-11） |
| `maxDurationMs` | plugin.js:83 | [500,4000]，默认 4000 | 保留 |
| `startDelayMs` | plugin.js:83 | [0,1500]，默认 0 | 保留 |
| 增强上限 | plugin.js:2333 | bounded `min(8, 1.5×refillBase)` | 保留，但注意 refillBase=5.0 时 1.5×=7.5，接近 8；refillBase>5.33 才会顶穿（R-2） |
| `predictionSeconds` | plugin.js:2316 | 1.5 | 与正常段统一（T-3） |
| `S2_REFILL_SETTLE_MS` | plugin.js:91 | 1500 | 待定口径（F2） |
| `S2_REFILL_HIGH_FLOW_MLS` | plugin.js:86 | 4 | 待定口径（F1） |

### 6.6 增益记忆常量

| 常量 | 现值 | 建议 |
|---|---|---|
| `GAIN_MEMORY_ALPHA` | 0.35 | 保留（§22.3 α≈0.35） |
| `GAIN_MEMORY_DEVIATION_ALPHA` | 0.55 | 保留（§22.3 救急 0.5–0.7） |
| `gainBackfillAlpha` 救急 0.5 / 常规 0.12 | — | 改按介入强度分级（L-17） |
| `GAIN_MEMORY_DEVIATION` | 0.15 | 保留，但 `local` 语义要改（L-3） |
| `GAIN_MEMORY_BUCKET_RADIUS` | 0.12 | 改自适应或按实测 spread 定（L-4） |
| `GAIN_MEMORY_HYSTERESIS` | 1.25 | 与 radius 一起改；真机已重叠（L-4） |
| `GAIN_MEMORY_MIN_SAMPLES` | 10 | 保留 |
| `GAIN_MEMORY_MAX_BUCKETS` | 12 | 保留，淘汰改 LRU（L-4） |
| `gainRegimeForRun` 的 \|flow\|≥0.15、ratio∈(0.05,5]、ageMs≤600 | — | 保留 |

---

## 7. 待用户定口径（已全部定案，保留作决策记录）

### F1 · 补水是否真的用 r=1（`high-flow-direct`）

见 R-2。要决定的是：① r=1 是设计口径还是临时兜底；② 若保留，正常段信封上限是否同步抬到能覆盖补水基准（否则补水认定的稳态指令正常段够不到）；③ 阈值应该对**杯流目标**判断还是对**指令**判断；④ 是否要把它移到 gain-memory 之后。

### F2 · 补水后的学习沉降窗 1500 ms 还是 200 ms

见 R-5。§19 的「learning settle after refill is 200 ms（was 1600 ms）」是旧口径；§22.9 v2.2.6 已改成 1500 ms，并从 1 处扩到 4 处（`controlLearningAssessment`、`controlOutputQuality`、`stage2EffectiveCommand`、`liveTrimChainEvidence`）。要决定的是：① 是否保留 1500 ms；② 是否四处同值（建议链路 1500、`controlOutputQuality`/`stage2EffectiveCommand` 用 800）；③ 窗口把数据切光时要不要在报告里显式区分。副作用已量化：按 00:25 时序窗口起点是 S2 开始后 4.18 s，约 9 s 的 S2 只剩 4.8 s，`controlOutputQuality` 在窗口内原始样本 <6 时返回 `{available:false}` 且不带原因。

### F3 · 救急静默 800 ms 与「一笔要 1.2 s 才完全进泵」

§22.4 的 1.2 s 是常规最小间隔，0.8 s 是救急例外；两句不是同一场景的互斥规则，但 0.8 s 是否足够仍要定。真机有一笔响应延迟 1235 ms。要决定的是：救急静默取固定 800、固定 1000、还是 `max(800, 上一笔实测响应延迟)`。

### F4（附带）· S3 的 4+2 写入预算算不算 §22.8 的「安全门」

§22.8 把「写入预算」列在安全门里，但全局 `maxWrites` 与 S3 分段 4+2 是两回事；真机数据表明后者是墙（T-9）。需要确认它归安全门（不动）还是行为门（可改）。

---

## 8. 建议修复顺序

按「改动量小 + 直接对应实测症状」排序：

1. **T-1**（null→0，一行守卫 + 一条回归测试）：49/730 个决策点受影响，且会产生方向完全错误的写入意图。
2. **L-1 + L-2**（删掉 VARIABLE/MIXED/SATURATED 对增益记忆的封锁，改降权）：直接对应「S2 最近 5 杯平均约 −25%，其中 2 杯被 LIMIT/SATURATED 封，2.2.5 的 applied 虽为 true 但杯内被 local 覆盖」。
3. **T-7 + T-8**（S3 最小步 1 档、救急步长按段折算）：直接对应 S3 极限环与 −12.6%…−50.9%。
4. **T-2**（外推夹幅，并考虑补下落方向）：frame-1 预测 MAE 1.35 g/s 是死区 7 倍，是「9 笔低于目标时下调」的直接原因。
5. **R-1 + R-3 + R-4**（补水控制律只算一次、收口值用控制律自己的答案、保护性回落不用 min）：对应补水后 S2 塌到 2.6 g/s。
6. **L-11 + L-12**（三套质量门对齐并降权、`known()` 换实际指令）：打开大偏差杯的学习通道。
7. **T-5 + T-6 + L-8**（统一上限函数、信封包含现状、救急不窄于常规）：消除 32% 写入被夹（2.2.x 口径）与静默丢笔。
8. **Q-1 + L-14**（归档提到 `resolvedStageCommandFlow`、比较阈值改半档）：止住每杯重写曲线。
9. **R-5 + L-3 + L-4**（学习窗在收回未确认时拒绝、local 语义、桶自适应与跨桶回退）。
10. **L-5 + L-6**（删 `stage3ShapeOnlyConsensus`、拆掉三处非递减）：让 S3 drift 真正可用。
11. 其余（T-3/T-4/T-9/T-10/T-11/T-12/T-13、L-7/L-9/L-10/L-15/L-16/L-17、R-6/R-7）。R-1 已并入第 5 步。

F1–F4 定口径后再排入。所有改动都在插件侧，需走 §15 发版流程（版本号递增、新 `verify_vXXXX.cjs`、`RESULTS_vXXXX.txt`、README 小节、HANDOFF）。

---

## 附录 A · 分析脚本（只读，未入库）

- `D:/vscode/.tools/__hx-h4-review.js` — 历史文件顶层结构与 gainMemory 概览（原写作 `__hx-h4-peek.js`，该文件不存在）
- `D:/vscode/.tools/__hx-h4-struct.js` / `__hx-h4-struct2.js` — 单杯 fullRecord / trace 结构
- `D:/vscode/.tools/__hx-h4-shots.js` — 30 杯逐杯表（S2/S3 目标、实测、误差、记忆 r、采用与否、写入与静默计数）
- `D:/vscode/.tools/__hx-h4-quant.js` — 逐笔写入方向审计、预测 vs 之后 1.5–4.5 s 实测、预算墙计数
- `D:/vscode/.tools/__hx-h4-null.js` — `predictedGS===0` 与信封夹笔统计
- `D:/vscode/.tools/__hx-h4-pred0.js` — `predictedGS===0` 的原始 write/check 记录取证

## 附录 B · 工作区状态（审查时）

- `D:/vscode/decenthyperexplugin` HEAD = c8a6d6c，未提交改动：`plugin.js`（+80/−24，2.2.6）、`manifest.json`（2.2.5→2.2.6）、`README.md`、`HANDOFF_2026-10-31.md`、`HANDOFF_2026-11-01.md`；未跟踪：`tests/verify_v0226.cjs`、`tests/RESULTS_v0226.txt`、`HANDOFF_2026-10-31-design.md`、`REVIEW_2026-11-01-flow-control.md`、`release/`、`review/`。
- 已发布 tag v2.2.5 = c64dabc，该提交内 manifest 与 `PLUGIN_VERSION` 均为 2.2.5，发布件本身无版本不一致。
- `verify_v0226.cjs` 635/635；`verify_v0225.cjs` 在同一工作区 624/627，三条失败分别是「bounded refill 用 target/r 作控制基准」（2.2.6 改成 high-flow-direct）、「补水前端预览公式」（2.2.6 改了 UI）、「2.2.5 版本号一致」（manifest 已升 2.2.6）。均为预期 delta，非回归。
- 本审查对插件代码只读，未修改 `plugin.js` / `manifest.json` / 测试或交接文档；本文件是本次新增并修订的审查文档（修订记录见附录 C）。

## 附录 C · 本次修订记录（2026-11-01）

- 补 0.1 口径与时点表：区分 2.2.5 执行杯、2.2.6 下一杯 applied、2.2.6 工作区未跑真机；补 2.2.x 八杯 / 全部 22 杯 / S2·S3·全场的人群说明。
- 修正写入计数：S2 救急 0–6 → S2 0–4（全场 0–6）；`s3RescueWrites` “每杯 2” → 2.2.4 之后 4 杯；86 笔 / 21 笔（24%）→ 2.2.x 65 笔 / 21 笔（32.3%）。
- 修正数字：R-2 差 29% → 高 8.1%（相对中心 29%）；§1.5 4.72 标为 0.9 阻尼后（纯仿射 4.77）；§6.5 1.5× 顶穿 8 → 7.5（>5.33 才顶穿）。
- 修正时点：R-3/R-7 的 3.875 标为下一杯 applied，2.2.5 实测 2.5；L-7 的 3.094/3.067/3.884 拆成「同杯曲线 / 中心 / 杯流」。
- 修正证据：T-8 区分请求档数/实际档数；T-9 的 158–172 拆成 158–159 normal、160–172 rescue；T-11 的 check 13–14 标为该杯 approachMs=800。
- 修正引用：R-6 5626；L-5 §22.6；L-11 5–11% CV 归 §19 并补 startup 纹波行；L-12 区分数据有效性门与 §22.8 一致性门；F2/F3 标旧口径；附录 A 的 `__hx-h4-peek.js` → `__hx-h4-review.js`；§8 补 R-1。


---

## 9. 状态总表（按版本落定，截至 v2.2.16）

> **所有权标记**：每条的代码归属见「版本」列。其它对话要再改这些位置，先读 decentplugin 技能 §22.10 / §22.11 / §22.12 与 plugin.js 常量区的横幅注释，不要重新引入「泵指令 = 流量设定值」。第 2–7 节的正文保留 2.2.6 当时的现状描述与真机证据，**结论以本节为准**；第 10 节已取代本节早期版本里 R-1 / R-3 的「部分已改」。

**补水（第 2 节 + §10）**

| 条目 | 结论 | 版本 |
|---|---|---|
| R-1 补水控制律只执行一次 | 已改：灌水首笔一次顶到包线（刻意），trim 通道 + bleeding 两段收口补齐 | 2.2.7 |
| R-2 high-flow-direct 的 r=1 | 已改（删除）：整支删掉，含 `S2_REFILL_HIGH_FLOW_MLS`；顺序回到 gainMemory → 空粉碗 LUT → 曲线基准，lut / profile-base 标签重新可达 | 2.2.7 |
| R-3 收口值与控制律不一致 | 已改：收口回到平台 `target/r`（r 可 >1），`boundedRefillCommand` 下限放开到 `commandFlowMin`，bleeding 实现「先断流再回平台」 | 2.2.7 |
| R-4 保护性收回退到曲线指令以下 | 已改：`returnFloor` 拆正常 / 保护两条；`handoffOk` 两值钉死改区间校验 | 2.2.7 |
| R-5 学习窗在收回未确认时失效 | 已改：三处测量消费方一律拒绝，`reason=refill-return-unconfirmed` | 2.2.16 |
| R-6 cutoff 85 无法设置 | 已改：删按值迁移，默认回到 85，50–99 全区间可调 | 2.2.7 |
| R-7 补水侧小问题 | 已改：`maximumExtraCommandMl` 基准、`commandLimited`、删 `plan.flowMaxGS`、`gainRegimeForRun` 的 40%→60% 标签、横幅常量表 | 2.2.16 |
| R-7 的 `strategy:"refill-85"` 改名 | **不做**（2026-11-01 判定）：持久化字段，12 处分支 + 3 处测试依赖；收益只是名字，cutoff 默认回 85 后又对上了。理由见 cut 9 验收 §5 | — |
| E6 保护性收回取 min | 已改（同 R-4） | 2.2.7 |
| Q-2 `S2_REFILL_HIGH_FLOW_MLS` 量纲错用 | 已改（随 R-2 删除） | 2.2.7 |

**杯内（第 3 节）**

| 条目 | 结论 | 版本 |
|---|---|---|
| T-1 `reg.predicted===null` 被当成 0 g/s | 已改：`decisionGS` 与 `cannotReturn` 两处显式 null 守卫 | 2.2.8 |
| T-2 预测只向上、无幅度上限 | 已改：双向 + 夹在 ±0.6×target | 2.2.8 |
| T-3 前瞻窗两套、死区四个 | 已改：S2 统一 1.5 s（S3 1.2 s 不变） | 2.2.8 |
| T-4 `deadbandPct` 被当角度阈值 | 已改：`ANGLE_DEADBAND_DEG=2` 独立 | 2.2.10 |
| T-5 常规信封不包含当前指令、hi 未夹 8 | 已改：`commandCeilingFor` 两个分支都包含当前指令 | 2.2.9 |
| T-6 救急上限比常规更窄 | 已改：救急 hi = `max(min(8, LUT×2), 正常 hi)` | 2.2.9 |
| T-7 S3 常规最小步 2/3 档 | 已改：常规最小步 1 档 | 2.2.9 |
| T-8 救急 8–24 档不分段 | 已改：下限 `clamp(round(.25×\|err\|/r×16),2,8)`，上限 24 | 2.2.9 |
| T-9 S3 4+2 预算 + 后段禁写构成墙 | 已改：累计 24 档 + 大角度（连续 ≥120° 达 3 点）放开，删后段 45% 禁写 | 2.2.10 |
| T-10 救急判据实为两条 | 已改：`timeToReturnS` 对 `remainingS` 真正生效 | 2.2.10 |
| T-11 handover 三处形同虚设 | 已改：删 `approachWriteIntervalMs` 与 `approachFraction`，`approachMs` 200→800 | 2.2.16 |
| T-12 `vectorStepCount` 加码是死代码 | 已改：predictive 模式接入 4/6/8 档上限 | 2.2.10 |
| T-13 其它杯内小问题 | 已改：0° 定义统一到 2° + 2% 带 | 2.2.10 |
| L-8 同一个 `target/r` 四个上限 | 已改：并入 `commandCeilingFor` | 2.2.9 |

**杯间学习（第 4 节）**

| 条目 | 结论 | 版本 |
|---|---|---|
| L-1 `VARIABLE/MIXED/SATURATED/LIMITED` 连带封锁记忆 | 已改：改 damped，置信度降一级，`target/r` 照常应用 | 2.2.11 |
| L-2 链路饱和同时封「学」与「用」 | 已改：饱和出当杯 local，α 0.55，观测照常进记忆 | 2.2.11 |
| L-3 `local` 用上一杯观测 | 已改：`lastLocalR`（当杯 `tailMeanGS ÷ stage2EffectiveCommand`），置信度 LOW | 2.2.11 |
| L-4 桶中心不自适应、两桶重叠、S3 可整体丢失 | 已改：滑中位中心、最近邻命中、跨桶回退 stale、LRU 淘汰 | 2.2.12 |
| L-5 `stage3ShapeOnlyConsensus` 不可达 | 已改：整块删除，S3 形状只剩 drift 一个写入口 | 2.2.14 |
| L-6 S3 非递减与 drift 互斥 | 已改：`projectS3Commands` / `curveLimits` / `applyCurveEditorDraft` 三处拆除，只留相邻增幅 | 2.2.14 |
| L-7 三套 S2 估计互相矛盾 | 已改：`s2ReverseEstimate` 单一反解（比值为主、仿射过斜率门、0.9 阻尼 + policy 限幅） | 2.2.15 |
| L-9 r 的取值范围三处不同 | 已改：`GAIN_R_MIN/MAX` = 0.2–3 单一来源，越界丢段记 `dropped` | 2.2.12 |
| L-10 分子分母窗口不一致 | 已改：`stage2EffectiveCommand` 末 40% → 60%，与 `tailMeanGS` 同窗 | 2.2.12（2.2.13 复验） |
| L-11 三套质量门阈值不同、两处过期分母 | 已改：0.60 / 0.35 / 0.40；纹波 >25% 才 HOLD；分母换实际生效指令 | 2.2.11 |
| L-12 `known()` 的 ±20% 是墙 | 已改：±35% | 2.2.11 |
| L-13 相等判据比档位细 12.5 倍 | 已改：command 容差 0.005 → 1/32；跨 basis 改降置信 | 2.2.15 |
| L-14 学习输出未归档、HOLD 不可达 | 已改：全链路 1/16 归档 + `sameCommandFlow`；2.2.15 又把 HOLD 改成与曲线比 + `hold.all` | 2.2.13 / 2.2.15 |
| L-15 `startupMetricAllowed` 的 +8% 上界 | 已改：上界 +25%（下界 −50% 与纹波门不变） | 2.2.15 |
| L-16 目标比例 0.5–2× 作废整套 override | 已改：读取时按 `targetScale` 一步过渡 + 持久化 rescale；超过 2× 仍作废 | 2.2.15 |
| L-17 `gainBackfillAlpha` 缺介入强度分级 | 现状已满足：救急笔 0.5 / 常规笔 0.12 / 无写入走 `GAIN_MEMORY_ALPHA` 分级 | 2.2.0 起，本轮复核 |

**档位与口径（第 5 节 + 第 7 节）**

| 条目 | 结论 | 版本 |
|---|---|---|
| Q-1 归档只做在写入面 | 已改：`resolvedStageCommandFlow`、`liveTrimControlCenter`、学习输出、编辑器输入、`rescaleOverridesForTargets` 全部归档 | 2.2.13 |
| F1 补水是否真用 r=1 | 已定：r 是命令的函数（灌水区 ≈1、平台区 ≈1.23），补水段 r 允许 >1 且只用于平台；灌水量只受安全包线约束 | 2.2.7 |
| F2 学习沉降窗 1500 还是 200 | 已定并实现：测量窗 800 ms、链路窗 1500 ms，切光带 reason | 2.2.16 |
| F3 救急静默 | 已定并实现：`max(800, min(3000, 实测 ACK 延迟))`，无实测落 800 | 2.2.10 |
| F4 S3 4+2 预算算不算安全门 | 已定并实现：行为预算，按累计 24 档计，大角度放开；全局 `maxWrites` 仍是安全门 | 2.2.10 |

**未做 / 未验（cut 10 收口时的全部剩余）**

1. **`controlOutputQuality` 的 basis 文案 —— 已收口（2.2.17），`basis` 保留为导出兼容字段**：回放脚本与台账在读 `learningEvidence.stage2.outputQuality.basis`，所以 `basis` 保持 `actual RAW g/s; rolling regressions over final60% of phase, separate from normalized learning model` 不变；窗口说明改由 2.2.17 新增的 `basisDetail`（`after refill settle 800 ms; final 60% regression`）与补水学习行承担。页面 `ACTUAL RAW OUTPUT` 不显示 basis，无需改显示层。原先「改成能区分两窗的说法」的建议作废。
2. 其余全部是真机验证类：≥5 ml/s 稳态 r 标定；补水峰值过冲（闭环 +33.2%，绊线 ≤40%）与 `cutoffPercent` / `bleedMs` 调参；分桶半径 0.08 的建桶速度；同一条件下一杯真的 HOLD；S3 最新杯缺 `evidence.s3`；2.2.8 之后 S2 平台在真机上是否离开 −21…−29%。

**本节与早期表格的差异**：旧表把 R-5 / R-7 / T-11 记成「未动」、把 R-1 / R-3 / Q-1 记成「部分已改」，是 2.2.7 当时的快照；2.2.8–2.2.16 已全部收口，以本表为准。

### 9.1 测试策略也换了（这是「635 全绿 + 真机零成功」的根因）

v0226 的 880 条断言里有 53 条是「计划字段等于某个常数」的镜像断言，其中 assert(p.boostCommandMlS<=p.controlBaseMlS*1.5+1e-9) 把错误策略本身钉成了不变量，refill handoff writes the running S2 command even when the LUT base is lower 断言的正是 §22.11 判定为错的行为。搜 overshoot / rise / plant / simulate 全文件只有 4 处命中，没有一条验「秤流速曲线对不对」。

v0227 删掉 6 条镜像断言，换成：

- **口径不变量**（不引用计划常数）：对 3.0–6.5 g/s 每个目标断言灌水上限 ≥7.0（上升时间下限是机器属性，不能随用户设的目标漂移）；对 r ∈ {1.05,1.19,1.29,1.39,1.6} 断言平台 = snap(target/r) 且低于目标、灌水不随 r 变；断言规律能降到平台以下并到 0.125、且单调向下；断言正常收口落平台、保护性收回不抬泵。
- **闭环植物测试**：按实测动力学合成植物（0.35 s 死区 + 一阶 τ 0.4 s + 杯流 = r × 泵流；初版还写了粉饼限流 5.5 ml/s，cut 0 已去掉——那个常数把杯流渐近值压到 7.1，使 +21.4% 的过冲偏乐观；r 同时改成按命令分段，见校准台账），50 ms 步进、250 ms tick 真跑 liveTrimTick，断言秤流速曲线：泵指令必须一度超过目标杯流数值（这一条杀掉所有「泵 = 设定值」的回归）、上升 20→80% ≤1.5 s、收口落在平台、补水写入 ≤10 笔。HX_LOOP_REPORT=1 打印实测指标。
- 安全门测试一条没动。

**建议**：文档修订时把「闭环结果测试」写成后续每一项改动的硬性验收条件。杯内控制与杯间学习那两块同样是镜像式绿测，改它们之前应先补同类的闭环测试，否则会重演「改完还是绿的、真机还是不对」。


---

## 10. v2.2.7 补充：两段收口已实现（2026-11-01，用户批准后）

用户批准「收益大就做」，本节取代第 9 节里 R-1 / R-3 的「部分已改」。

### 10.1 改了什么

- cutoff 改成前瞻判据：s2RefillReturnReason 从「实测 ≥ cutoff×0.95 且 predicted ≥ cutoff」改成「实测 ≥ cutoff×0.6（只当噪声底）且 predicted ≥ target」。cutoffPercent 语义随之从「实测到 X% 收回」变成「观测噪声底」，默认 85。
- 新增 bleeding 状态，实现 §22.11 的两段收口：armed → boosting → bleeding → returning → complete。cutoff 触发时先写 bleedCommandMlS = snap(max(0.10, 平台×0.35)) 断流，等 bleedMs（700 ms，与泵下降时间对齐）或秤流回落到 target×1.02 以内，再写平台 target/r。
- 状态数组（boosting / bleeding / returning / return-unconfirmed）在 4 处安全路径同步：transport close、frame-ended ×2、tick。ACK 完成与 actual-flow 佐证仍只认 returning，所以断流那一笔的 ACK 不会提前结束补水。
- 看门狗容忍已 ACK 的断流笔，最多续两次 1500 ms 再判失败，不会把正在正常恢复的杯子 abort 掉。
- 修掉一个本次引入的 TDZ：previousCommand 原来声明在状态块之后，trim 分支从未真正执行过所以没暴露，bleed 一触发就是 ReferenceError → abortSequence。与 2.2.1 的 rescueActive TDZ 同一类，真机上会整杯中止。

### 10.2 闭环实测（合成植物，同一模型同一参数，只改收口）

| 学到的 r | 平台 | 上升 20→80% | 峰值过冲 | 平台偏差 | 补水写入 |
|---|---|---|---|---|---|
| 1.29 | 3.875 | 0.60 s | +88% → +36.4% → **+21.4%** | −15.0% → **−1.4%** | boost 8.0 → bleed 1.375 → return 3.875 |
| 1.05 | 4.750 | 0.70 s | +11.3% → 达标 | −11.0% → 达标 | 同上 |
| 1.60 | 3.125 | 0.55 s | +62.7% → 达标 | −12.2% → 达标 | 同上 |

三阶段对照：原始（单步收口 + 实测 85% 判据）→ 放开灌水范围但仍单步收口 → 前瞻判据 + 两段收口。**平台偏差从 −15.0% 收到 −1.4%（进入 4% 死区）是这一版最大收益**：断流那 700 ms 让留存水把杯流顶到目标附近，平台笔接手时不需要再爬。峰值过冲仍有 +21.4%，下一步靠下调 cutoffPercent 或缩短 bleedMs 收。

### 10.3 遗留：13 条旧 handover 测试红了（列为 cut 0）

它们断言的是被取代的旧口径（实测到 85% 就收回、70% cutoff 在 3.5 g/s 收回、predicted 很高但实测不到 85% 就不收回等）。按用户口径「既有的测试不用管，都有大问题」，**没有为了让它们变绿而回退代码**。当前 tests/verify_v0227.cjs = 624/637，13 条红全部是这批，名字见 git 工作区里该文件的 FAIL 输出。安全门测试与新增的口径不变量、闭环测试全绿。


---

## 11. 分 cut 建议（每个 cut 交给一个新对话，互不重叠）

切分原则：① 一个 cut 只碰一个子系统；② 每个 cut 自带闭环/不变量测试，不许再写镜像断言；③ 口径冲突先问用户；④ 每个 cut 走完整发版流程，版本号从 2.2.8 起顺序递增，**不要并行发版**。

| cut | 内容 | 条目 | 规模 | 前置 |
|---|---|---|---|---|
| **0** | 13 条旧 handover 测试按新 cutoff/两段收口口径重写或删；补 bleeding 专项测试（断流 ACK 缺失、bleed 期中途换帧、看门狗续期、保护性理由走不走断流） | §10.3 | 中 | 无。**先做**，否则后面每个 cut 都面对红套件 |
| **1** | 杯内决策三个硬 bug：reg.predicted===null 被当成 0 g/s；预测只外推上升方向且无幅度上限；前瞻窗统一 1.5 s | T-1 T-2 T-3 | 小 | cut 0 |
| **2** | 杯内步长与信封：S3 常规最小步 2/3 档改 1 档；救急 8–24 档按段折算；信封必须包含当前指令、hi 夹到 8；救急上限不小于常规；抽 commandCeilingFor(phase,mode) | T-5 T-6 T-7 T-8 L-8 | 中 | cut 1（同段代码，必须串行） |
| **3** | 杯内门槛与死参数：S3 4+2 预算改累计档数 + 大角度放开；删后段 45% 禁写；救急判据用上剩余时间；删 approachWriteIntervalMs；approachFraction 落实或删；deadbandPct 与角度阈值分离；vectorStepCount 接入或删 | T-4 T-9 T-10 T-11 T-12 T-13 | 中 | cut 2；T-9 需先定 F4 |
| **4** | 杯间学习的封锁与门槛：删 VARIABLE/MIXED/SATURATED/LIMITED 对增益记忆的连带封锁改降权；local 语义改当杯估计；三套质量门阈值对齐 + 欠跟踪分母换实际生效指令；known() 的 ±20% seed 窗换实际指令；gainStageObservation 空回退删掉 | L-1 L-2 L-3 L-11 L-12 §6.2 | 中大 | 可与 cut 2/3 并行，建议排后 |
| **5** | 增益记忆结构：桶中心自适应、半径/滞回按实测 spread、跨桶回退（g2 无 s3 时不掉回 LUT）、LRU 淘汰、r 范围统一 0.2–3、分子分母窗口对齐 | L-4 L-9 L-10 | 中 | cut 4 |
| **6** | 档位统一：snapCommandFlow 提到 resolvedStageCommandFlow；学习输出全部归档；所有「指令相同」比较改半个档位 0.03125；liveTrimControlCenter 归档 | Q-1 L-14 | 小 | cut 5 |
| **7** | S3 形状：删 stage3ShapeOnlyConsensus；拆掉三处非递减（projectS3Commands / curveLimits / applyCurveEditorDraft）；编辑器按 model 分支并保留 drift 字段；同步 UI 文案 | L-5 L-6 | 中 | 独立，可并行 |
| **8** | 一致性门与三套估计：sameScalarAdaptiveEvidence / sameStage3Shape 相等判据放宽到半档或删；target 比例 0.5–2× 改 rescale 一步过渡；三套 S2 估计统一反解口径（仿射 vs 比例）、gainFeedForward 的 spread 门真正生效、chain 分支加 policy 限幅 | L-7 L-13 L-16 §6.3 | 中大 | cut 4 之后 |
| **9** | 补水收尾：学习窗在「收回未确认」时三处退回无窗口的洞；S2_REFILL_SETTLE_MS 口径；maximumExtraCommandMl / commandLimited / strategy 命名 / flowMaxGS 双定义 / basis 标签 / fromMs 死字段 | R-5 R-7 F2 | 小 | 属补水段，归本审查所有；等 §10.2 真机验证后由本对话做 |
| **10** | 文档与自检：§22.7 待改清单按落地情况重写；§22.4 的动作集/前瞻窗/静默与代码对齐；README 的 S3 非递减文案；HANDOFF_2026-11-01 的 LUT 标签诊断口径已恢复可用 | 文档组 | 小 | 全部 cut 之后 |

### 11.1 统筹对话的职责（另开一个新对话，它自己不改代码）

1. **守口径**：每个 cut 开工前对照技能 §22.10 / §22.11 / §22.12 与本文档，确认没有重新引入已废弃写法（泵指令当设定值、镜像断言、1.5× 类静态上限、按值迁移）；冲突先停下问用户。
2. **守边界**：每个 cut 只碰自己那一栏。补水段（第 2 节 + §10）归本审查所有，其它对话要改先读 plugin.js 常量区横幅注释。同一函数被两个 cut claim 时按编号串行。
3. **守测试与仿真**：每个 cut 必须带口径不变量或闭环结果测试，只有镜像断言的一律退回。每个 cut 完成后用最新真机 history JSON 做两件事——交叉验证测试（差距大就是测试不对）、校准仿真植物并记录准确度（目标 ≥90%）。两条都是技能 §19 的硬规矩。
4. **守发布**：版本号顺序递增不并行；RESULTS/README/HANDOFF 齐全；F2 / F3 / F4 在碰到对应 cut 前先找用户定。
5. **守台账**：维护本文档第 9/10 节状态表与技能里的仿真准确度台账，每个 cut 合并后更新。

### 11.2 口径定案记录（F1–F4 已全部定案）

- **F1 已定**（2026-11-01）：补水段 r 允许 >1，泵流量是趋势矢量、可超过目标杯流，灌水量只受安全包线约束。已实现，见 §10。
- **F2 已定并实现（2026-11-01 用户拍板）**：测量窗 800 ms（`controlOutputQuality` / `stage2EffectiveCommand` / `controlLearningAssessment`）、链路窗 1500 ms（`liveTrimChainEvidence`）；窗口切光时 `controlOutputQuality` 带 reason。2.2.16 落地。
- **F3 已定并实现**：救急静默 = `max(800, min(3000, 上一笔实测 ACK 延迟))`，无实测落 800。2.2.10 落地。
- **F4 已定并实现**：S3 4+2 不是安全门，改累计 24 档 + 大角度放开，删后段 45% 禁写；全局 `maxWrites` 仍是安全门。2.2.10 落地。
- **cutoffPercent 语义已改（2.2.7）**：观测噪声底 = 目标 × X% × 0.6，收回看预测 ≥100% 目标；口径已记进技能 §22.5，UI 滑块标签的改文案仍待做（代码项，归 2.2.17）。
