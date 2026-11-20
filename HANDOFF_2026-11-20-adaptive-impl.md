# 2.2.56 S2 补水真自适应重设计 · 实施交接（2026-11-20，改码不发版）

> 派单：统筹 01a1f6fa（原 01a1f631 已接力）11-20，用户裁定全批＋改码授权（**发版/push/tag/装机另问**）。口径依据＝技能 **§22.19**（现行，取代 §22.11 的「≥7 硬悬崖／灌水量静态上限只由安全包线／不降 flood」、D4 floor7 常量、1.8×plat 乘数）＋评估 [HANDOFF_2026-11-20-adaptive-redesign-proposal.md](HANDOFF_2026-11-20-adaptive-redesign-proposal.md)。基线 HEAD **19f43c3**（2.2.55）。
>
> 一句话现状：**§22.19 全条落地**，`verify_v02256` **906/906**、`sim-regression` **5/5**、25 杯真机决策级回放全过（选笔 6.000–8.000、零越界、零 infeasible、零 extrapolated）。**用户 11-20 已裁定：FC_FACTOR=0 写入技能 §22.19、holdMs 动态只动自适应挡（人工档不动）、灌水量不设硬上限（各自安全包线兜底）；标定与闭环合并——直接跑自适应挡真机杯，第一杯即标定点（见 §6）。代码无需再改，均已按此实现。**

## 1. 改动清单（plugin.js +273/−24，manifest 1 行，README 置顶，tests 新增）

| # | 位置 | 改动 |
|---|---|---|
| 1 | `PLUGIN_VERSION` (8) | 2.2.55 → **2.2.56** |
| 2 | `S2_REFILL_LIMITS.maxDurationMs` (152) | `[500,4000,100]` → **`[2000,7000,100]`**（默认仍 4000；用户裁定 holdMs 双向动态区间） |
| 3 | 常量区（Vd15 块之后） | 新增 §22.19 全套常量：`RISE_TARGET_S=0.8`／`RR_QUANTILE=4.8`／`RR_MEDIAN=4.59`／`CUTOFF_LEAD_S=0.274`／`FC_FACTOR=0`／`VI_A=40.929`／`VI_B=-32.251`／`VI_MIN=15`／`VI_MAX=36`／`VI_FALLBACK_ML=24.8`／`VI_WINDOW_S=2`／`VI_RATIO_MIN=0.2`／`VI_RATIO_MAX=0.8`／`SOAK_MIN_SAMPLES=10`／`SOAK_MIN_P0_BAR=0.05`／`FLOOD_MIN_MLS=3.5`／`FLOOD_COLD_MLS=5`／`HOLD_MS_MIN=2000`／`HOLD_MS_MAX=7000`／`HOLD_MARGIN_S=0.6`／`BOOST_VOLUME_WARN_ML=32`。每个都带真机标定出处注释 |
| 4 | `refillFloodFloor()` | `ceil(stage2Flow)`（=5）→ **绝对下限 `S2_REFILL_FLOOD_MIN_MLS`=3.5**。连带放开：固定挡旋钮 min、UI 滑块下限（`refillLimits.floodMaxMlS`）、`floodCapHtml` 静态 `min="5"`→`min="3.5"` |
| 5 | **新增** `soakWettingObservation(run)` | 只读 soak 段：`soakP0Bar`（前 5 片压力中位）／`soakP2sBar`／**`soakP2sRatio`（主信号）**／`soakTauES`（1/e 衰减，仅诊断）／`soakSeconds`；拒收门 `no-samples`／`soak-samples`(<10)／`soak-pressure-head`／`soak-pressure-low`(≤0.05bar)／`soak-window`／`soak-pressure-window`，全部带 reason 供取证 |
| 6 | **新增** `refillAdaptiveFloodDecision(run,platformMlS,settings,headroomMlS)` | §22.19 律本体＋holdMs 双向＋旗标＋灌水量核算＋S2 重量预算；返回全证据链对象（见 §2） |
| 7 | **新增** `adaptiveReplanAtStage2Entry(t)` | 决策点迁移：stage2 入口重建 plan（复用 `hecLatchTakeover` 既有模式）；记 `soak-wetting`（**固定挡也记**，供 P2 标定）／`adaptive-replan`／`adaptive-replan-skipped`／`refill-budget-infeasible`＋`log()` |
| 8 | `stage2StartupPlan(mode)` → `(mode,run)` | 加 run 形参；**删 `max(7, refillFloodFloor(), min(8, 1.8×control.commandMlS))`**，改为 `wetting = bounded ? refillAdaptiveFloodDecision(run, control && control.commandMlS, settings, refillBase) : null`；`adaptiveColdMlS` 取 `wetting.floodMlS`（applyAdaptive）否则冷启动 `clamp(FLOOD_COLD_MLS)`；`holdMs` 取 `applyAdaptive ? wetting.holdMs : settings.maxDurationMs`；plan 新增 `adaptiveFlood:wetting`（带 `applied` 布尔） |
| 9 | 调用点 | `hecLatchTakeover` 传 `run`；`startDiagnostics`／`stage2StartupNext`／`refillPreview` **不传**（＝开萃取前的临时值，stage2 入口重算） |
| 10 | tick（boost 派发前） | `if(refill && t.startup.adaptiveReplanAt==null && state.phase==="stage2") adaptiveReplanAtStage2Entry(t);`——在 `early` 判定与 `dispatchS2Startup(t,"boost")` **之前**，每杯一次 |
| 11 | `dispatchS2Startup` 防篡改闸 | 原 `p.plan.holdMs!==limits.maxDurationMs` 与动态 holdMs 冲突 → 改为：`adaptiveFlood.applied===true` 时校验 `holdMs===adaptiveFlood.holdMs && adaptiveFlood.holdMsConfigured===limits.maxDurationMs`，否则维持原等式。**防陈旧/防篡改意图不变**（这条不改，boost 会被 `S2 refill plan settings invalid` 挡掉→`startup-skipped`，D3 闭环实测复现过） |
| 12 | `refillLastShotSnapshot()` | 返回值加 `adaptive: plan.adaptiveFlood 或 null`（含固定挡的 forecast，`applied:false`） |
| 13 | UI（页面脚本） | 新增 `refillAdaptiveLine(ad,law)`（放在 `refillLearningLine` 前）＋容器 `<div id="refilladaptive" class="small" data-no-i18n>`（紧跟 `#refillnodes`）＋填充；`refillvalue-floodMode` 自适应文案改为「stage2 入口按 soak 泄压形状定灌水（上升目标 0.80s · 绝对区间 3.50–8.00 · holdMs 2000–7000 双向动态）」，固定挡文案去掉「下限为曲线 S2 目标」；`curveEditorSnapshot()` 新增 `refillAdaptiveLaw{…}` 供页面脚本取常量（页面脚本拿不到插件闭包常量） |
| 14 | `manifest.json` | 仅 `version` 一行；description 保持 **275** 字符短简介（§1.15 不动） |
| 15 | `README.md` | 置顶 `# 2.2.56 experimental` 段 |
| 16 | `tests/verify_v02256.cjs` + `tests/RESULTS_v02256.txt` | 892 基线 + 14 新增 = **906**；RESULTS 为本次实跑输出 |

## 2. 律与诊断字段（实施后的准确形状）

```
Vi        = clamp(40.929 − 32.251 × soakP2sRatio, 15, 36) ml      // 25 杯真机，R²=0.873 rmse 1.99ml
          = 24.8 ml（无 soak 信号，viSource="cold-start-fallback"）
fc        = FC_FACTOR(0) × platform
budgetS   = max(0.3, holdMs设定/1000 + 0.274 − riseTargetS)
F_rise    = 4.80 / 0.80 = 6.00
F_budget  = fc + Vi / budgetS
flood     = snap16(clamp(max(F_rise, F_budget), 3.5, 8.00))       // 冷启动：clamp(max(5, platform+1/16))
needed    = Vi/max(0.2, flood−fc) + 4.59/flood − 0.274            // = 预测 boostToBleed
holdMs    = 可行时 min(设定值, clamp(ceil100((needed+0.6)*1000), 2000, 7000))   // 只缩不涨过设定值
          = 不可行时 max(设定值, 同上)；needed>7.0s → flood 顶 8.00 重算 → 仍不可行则 budgetInfeasible=true
```

`plan.adaptiveFlood` 字段：`floodMlS / holdMs / holdMsConfigured / holdAdjusted("shrunk"|"raised"|null) / fRiseMlS / fBudgetMlS / binding("rise-target"|"hold-budget"|"cold-start"|"envelope-max") / riseTargetS / rrQuantile / rrMedian / cutoffLeadS / fcFactor / fcMlS / platformMlS / viMl / viSource / viExtrapolated / viRatioSupport / predictedWetLatencyS / predictedRiseS / predictedBoostToBleedS / budgetInfeasible / budgetInfeasibleReason / boostVolumeMl / boostVolumeWarnMl / boostVolumeWarn / s2WeightBudgetG / applied / observation{…}`。

trace 新增 4 类：`soak-wetting`（**两种挡都记**：available/reason/soakP0Bar/soakP2sRatio/soakTauES/samples/floodMode/applied/viMl/viSource/fcMlS/lawFloodMlS/lawHoldMs/lawBinding/currentFloodMlS/predictedBoostToBleedS/configuredHoldMs/fitsConfiguredHoldMs/budgetInfeasible）、`adaptive-replan`（changed/floodMlS/previousFloodMlS/holdMs/previousHoldMs/adaptive）、`adaptive-replan-skipped`、`refill-budget-infeasible`。

## 3. 实现层裁定（**用户 11-20 已裁定，技能 §22.19 已同步**）

1. **`FC_FACTOR` 默认 0 —— 用户 11-20 已裁定，技能 §22.19 该行已改为「fc = FC_FACTOR × platform，默认 FC_FACTOR=0，Vi 按 fc=0 口径标定」。** 当初实现取 0 而非文中 0.9 的三条理由（留档）：①数学不相容——plat 3.875 时 fc=3.49，用户裁定的 3.5 绝对下限压在双曲渐近线上，`Vi/(flood−fc)` 发散，3.5 取不到；②§22.19 引用的「flood3.5→b2b6.95s」与「Vi 兜底 24.8」本就是 fc=0 口径的数（fc=0.9plat 口径下 Vi 上界只有 15.7）；③同 25 杯 fc=0 拟合更优（wetLat 预测 rmse 0.289s vs 0.478s、Vi R² 0.873 vs 0.419）。`FC_FACTOR` 为可配常量，改回 0.9 须同步重标定 `VI_A/VI_B/VI_MIN/VI_MAX/VI_FALLBACK`（量纲不同）。
2. **holdMs 动态只作用于 adaptive 挡 —— 用户 11-20 确认「人工档不动」，就按此实现。** 固定挡（人工旋钮）`holdMs` 与 `floodMaxMlS` 一律不动，只记 `soak-wetting` 观测与 forecast（`applied:false`）。依据＝§22.11 v2.2.26「固定挡是人工折中，不代表算法策略」。
3. **冷启动加了 headroom 守卫**（`flood = max(5, platform+1/16)`）：纯 5.0 在 platform≥4.94 时会触发 `stage2StartupPlan` 的「S2 refill has no command headroom」→ `enabled:false` → 整段补水被 skip（比灌水偏小更糟）。实测 r=0.8（platform 6.25）时冷启动值＝6.3125，测试已钉住。这是对用户「冷启动默认 5」的**安全补丁**，不改其本意（无信号时不跑律、不给高值）。
4. **`viExtrapolated` 与 `budgetInfeasible` 是两个旗标**：Vi 被 clamp 到 [15,36] 后，`needed(flood=8)` 最大 ≈4.8s < 7.0s，所以 `budgetInfeasible` 在当前常量下**数学上不可达**（保留作常量变更后的安全网）；粉饼异常改由 `viExtrapolated`（soakP2sRatio 超出标定域 0.20–0.80）告警，UI 红字提示核对研磨/布粉。
5. **灌水量与 stage2Weight —— 用户 11-20 确认「不设硬上限，各自安全包线兜底即可」，维持告警不拦截。** `boostVolumeMl = flood × holdMs/1000` 已入 plan 与 UI，超过 §22.11 历史包线 32ml 时红字告警并显示 `s2WeightBudgetG`（=stage2Weight−stage1Weight）；最坏组合 flood8×holdMs7000＝56ml 由压力门/ACK/硬包线 0.10–8.00 与 holdMs 上限兜底，不再加 `MAX_BOOST_VOLUME_ML`。

## 4. 验证回执

- `node --check plugin.js` / `node --check tests/verify_v02256.cjs`：通过。
- **`tests/verify_v02256.cjs` 906/906**（`tests/RESULTS_v02256.txt`）。基线 892 中改动的 11 处断言：2 处版本钉（2.2.55→2.2.56）、`all S2 editor boundaries`（maxDurationMs 区间）、`configured500ms duration`→`configured minimum duration`（500→2000，新下限）、`active shot keeps the frozen refill plan`（滑块下限 3→3.5）、`2.2.27 stored flood cap below the curve target is clamped up to that target`→`2.2.56 the manual knob floor is the absolute 3.5, no longer ceil(target)`、`2.2.27 the plan carries…`（自适应无 run → 冷启动 5）、`2.2.53 D4 adaptive cold flood floor >=7…`→`2.2.56 §22.19 adaptive flood follows the wetting signature…`、3 处闭环 `maxCmd>=7`→band＋与法则选笔一致、`2.2.53 D3`（夹具补慢润湿签名 soakRatio 0.22，保住「大缺口→高灌水→压力保护收回」原意）。**4 处闭环夹具改动**：`refillLoopEnv` 加 `soakRatio`（默认 0.5735＝当前机制中位）并把 run 传给 `stage2StartupPlan`；4 处 `t.run.rawScaleSamples=scale.slice(-30)` 改为保留非 stage2 前缀（否则 soak 签名会在首个 tick 前被闭环覆盖）。
- **14 条新增测试**（禁镜像，全部断言行为/区间/真机交叉）：法则常量与 UI 暴露／`soakWettingObservation` 计算与 6 个拒收门／慢润湿更多灌水＋快润湿落在 F_rise 下界＋binding 正确／soakP2sRatio 0.02–1.82 全域扫描 band[3.5,8]＋1/16 网格＋`predictedBoostToBleed≤holdMs`（不静默超时）／冷启动 flood5＋Vi24.8＋仍不超时／holdMs 双向（快润湿缩短、慢润湿抬高、可行时不涨过设定值、用户设 2000 也会被抬）／超标定域 `viExtrapolated`＋Vi 截断＋顶满 8／固定挡旋钮与 holdMs 一字不动但记 `soak-wetting`（`applied:false`、无 `adaptive-replan`）／stage2 入口每杯重建一次（临时值 5 → 重算值，后续 tick 不再重建）／`1.8*Number(control.commandMlS)` 与 `Math.max(7,refillFloodFloor()` 已从源码消失＋同签名不同 target 得到同一 flood（平台不再驱动）／**禁用信号族源码级断言**（law 函数体内不得出现 midFlowGS/activeFlowGS/decaidWeightFlowGS/rawDwDtGS/weightG/machineFlowMlS/s1DurS/soakDrainG，且必须读 pressureBar）／**真机杯 20 soak 样本交叉**（history-15，`soakP2sRatio` 与离线探针 0.6803 差 <0.02，Vi 与实测 wetLat×flood=19.6 差 <4，且不超时）／闭环「选笔即写入笔」／**25 杯真机决策级回放**。
- **`sim/tests/sim-regression.cjs` 5/5**（historyRecordings fullRecord／empty replay fails loudly／paperCondition 0/0.5/1／S3 shape override／real-file warm handoff 61.7s 4 writes）。
- **真机 25 杯决策级回放**（开环，只验选笔/旗标/区间；已在 verify 内常驻）：法则选笔 **6.000–8.000**（历史 6.813–7.000），band 全过、1/16 网格全过、`predictedBoostToBleed≤holdMs` 全过、零 `budgetInfeasible`、零 `viExtrapolated`；断言「批1（慢润湿）≥80% 的杯拿到不低于历史的灌水」「批2 高峰杯（≥40%）≥60% 拿到不高于历史的灌水」「全域跨度 ≥1.0 ml/s（自适应范围大于固定挡）」。

## 5. 分批量化（真机锚定估算，**闭环真值须真机**）

| 批 | n | 历史 flood | 历史结局 | 法则 flood（中位[范围]） | Δflood | 法则 holdMs（中位[范围]） | 估算 Δ峰 |
|---|---|---|---|---|---|---|---|
| 批1 fixed 6.8125（11-10→11-14） | 13 | 6.8125 | **13/13 holdMs 超时**，whole −3.4…−41.5%，峰被删失（−22.5…+26.6%） | **8.000 [7.375..8.000]** | **+1.188** | **4800 [3700..5200]**（Δ+1100ms） | +16.4pp（**其历史峰是删失值，不可比**；换来的是不再超时欠流：预测 b2b 4.15s vs 历史实测 wetLat 4.54s） |
| 批2 adaptive 7（11-16→11-19，当前机制） | 12 | 7.000 | 全部正常收口，回归峰 18.5…102.7%（中位 36.3%） | **6.375 [6.000..7.313]** | **−0.625** | 4000 [3900..4000]（不变） | **−8.7pp**（回归峰中位 36.3%→~27.6%）；binding＝hold-budget 8 杯 / rise-target 4 杯 |

- **自适应范围**：批2 跨度 **1.31 ml/s**（6.000–7.313），固定挡跨度 0 → 满足「适应范围应大于固定档」。
- **§22.19 引用的 −13.8pp 对应 riseTarget 0.8＋flood 6.00 的静态算法**；实施后按逐杯 Vi 得到的批2 中位是 6.375（−8.7pp），差额来自 Vi 截距对当前豆期偏保守（批2 预测 b2b 中位 3.88s vs 实测 3.31s，约 +0.57s）。**P2 标定后预计还能再让出 0.3–0.5 ml/s（约再 −4…−7pp）**，方向安全（偏保守＝偏不欠流）。

## 6. 真机待验项（标定与闭环合并，须用户陪杯）

> **用户 11-20 裁定：不再单设「不改码的固定挡标定轮」。** 2.2.56 代码已带 `soak-wetting` 全证据链，直接跑自适应挡真机杯，**第一杯即标定点**——标定与闭环一次完成。原 P2 三轮固定挡（6.0/6.5/7.0 各 ≥3 杯）取消。

1. **首杯＝标定＋闭环**：adaptive 挡直接出杯。每杯从导出 JSON 取 `soak-wetting` 的 `soakP2sRatio/soakTauES/soakP0Bar/viMl/predictedBoostToBleedS` 与实测 `wetLat/rise2080/boostToBleed/回归峰/whole`，**对比预测 b2b 与实测**：吻合则 `VI_A/VI_B` 保持；偏则用本杯 (flood, wetLat) 反推 Vi=wetLat×flood 重拟合（当前系数来自 10-28→11-19 的 25 杯、跨两个 S1 指令期，对当前豆期偏保守约 0.57s，方向安全）。首杯风险由安全包线兜住：clamp[3.5,8]＋冷启动保守兜底 Vi24.8＋holdMs 自动抬防静默超时＋压力门/ACK/硬包线 0.10–8.00。**验收**：批内 wetLat 预测 rmse ≤0.30s。
2. **闭环验收（adaptive 挡 ≥5 杯）**：回归峰 ≤ 现中位 −10pp 且 ≤40% 绊线／`rise2080 ≤0.9s`／**零 holdMs 超时**／whole 不劣于现机制。`FC_FACTOR` 已裁定为 0，无需再比 0.9（若后续真机数据强烈支持 0.9，改常量须同步重标定 Vi 五元组）。
4. **P4 极端粉饼**：细研磨或布粉偏松做慢润湿，验收＝法则顶到 8.00、holdMs 抬到 5000+、`viExtrapolated` 在异常杯上亮、whole 优于同条件 fixed6.8125 基线（−3.4…−41.5%）。
5. **冷启动/无 soak 场景**：确认 profile 无 soak 相段（或 soak<10 片、压力<0.05bar）时走 flood 5＋Vi24.8＋holdMs 抬高，且 UI 显示「冷启动默认（无 soak 信号：reason）」。
6. **UI 实机核**：Decaid 页面补水折叠的 `#refilladaptive` 行中英双语显示、`data-no-i18n` 未被翻译器打散、红字告警可见（本批只做了源码级与 `buildGhcOverlayHtml` 级校验，未在 Decaid 里目视）。

## 7. APK 同步债（full→hec 里程碑，与既有债合并）

soak 湿润观测（`soakP2sRatio` 计算与 6 个拒收门）＋自适应灌水律（F_rise/F_budget/clamp/冷启动 headroom）＋holdMs 双向动态＋`refill-budget-infeasible` 旗标与 UI → shadow/arbiter 等价物；与 D1–D6／O1／Va／Vb3／Vd15 债同批。**注意 APK 侧若无 soak 相段样本流，等价物会恒走冷启动分支**，移植前先确认 sample 通道。

## 8. 坑（本批踩过，后续别再踩）

1. **`dispatchS2Startup` 有一道 plan↔settings 一致性闸**（`p.plan.holdMs!==limits.maxDurationMs || …` → `startupBlock` 报 `S2 refill plan settings invalid`）。任何让 plan 偏离 settings 的动态化都会在这里被静默挡掉，表现是 `startup-skipped`＋补水完全不发生（D3 闭环实测：trace 里只有普通 trim，boost 一笔没写）。改动态量必须同步改这道闸。
2. **闭环夹具每步 `t.run.rawScaleSamples=scale.slice(-30)` 会把 soak 前缀冲掉**，导致 stage2 入口重建时读不到签名、静默退回冷启动。4 处都已改成保留非 stage2 前缀。
3. **冷启动 flood 5 会撞上「无指令余量」判据**：`boost < refillBase+1/16` 时 `stage2StartupPlan` 直接返回 `enabled:false`，整段补水被跳过。已加 headroom 守卫（§3.3）。
4. **页面脚本拿不到插件闭包常量**：UI 文案里的 0.80/3.5/2000/7000 必须经 `curveEditorSnapshot().refillAdaptiveLaw` 传出去，别在页面脚本里硬编码。
5. **测试会按「单函数/整函数」抽取页面脚本到裸 VM 里跑**（`renderRefillEditor` 等），新加的跨函数调用要么在 mock 里提供，要么用 typeof 守卫——直接调用会 ReferenceError 打挂 4 条 UI 测试。
6. **`JSON.stringify` 重写 manifest 会把 `92.0` 规范成 `92`**（23 行无谓 diff）。改 manifest 只做定点字符串替换。
7. **S1 出流族信号跨校准期反号**（批1 −0.92 → 批2 +0.45），直觉上最像「湿润饱和」的 `midFlowGS` 恰恰不能用；已用源码级测试钉死禁用清单。

## 9. 红线 / 复跑

- 只改本批授权范围；**未发版、未 push、未打 tag、未装机**（须另问用户）。硬包线 0.10–8.00 未动；影子 `sent` 恒 false 语义未碰；LUT／gain memory／manual 锚／单一写者未碰；Va/Vb3/Vd15/O1/cutoff predicted 主判/backstop 0.85/两段收口/Q2 平滑链（coast/up-hold/治理链/死区/quanta/静默/ceiling）逐字未动。
- 别人 WIP 未碰：`HANDOFF_2026-10-31.md`（工作区 M 状态）、`HANDOFF_2026-11-20-fc-learning-prep.md`。
- 禁合成植物推断：所有系数来自真机全点样本；`sim/` 只用于既有 5 条回归，未用于本批任何结论数字。
- 复跑：`cd decenthyperexplugin.reaplugin && node tests/verify_v02256.cjs`（906）；`cd .. && node sim/tests/sim-regression.cjs`（5）；离线分析探针在 `D:/vscode/.tools/__d17-*.cjs`（untracked，仓库不动）：`__d17-early-signal` / `__d17-era-corr` / `__d17-groups` / `__d17-vcrit` / `__d17-hypfit` / `__d17-budget` / `__d17-law3` / `__d17-batch` / `__d17-soak` / `__d17-vical(2)` / `__d17-fccmp` / `__d17-tradeoff` / `__d17-batchlaw`；2.2.55 原样快照 `__d17-plugin-2255-base.js`（891/892，唯一失败是版本钉）。

