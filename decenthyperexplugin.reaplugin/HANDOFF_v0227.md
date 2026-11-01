# v2.2.7 交接 — S2 补水重写（2026-11-01）

## 0. 这一版是什么

按 decentplugin 技能 §22.10 / §22.11 / §22.12（2026-11-01 用户定稿）重写 S2 补水。核心口径：**泵流量是趋势矢量，不是流量设定值**；灌水量只受安全包线约束；r 允许大于 1，且只用于收口平台级。

审查全文（39 条，三轮合并去重）：D:/vscode/decenthyperexplugin/REVIEW_2026-11-01-flow-control.md。本版只实现其中补水相关的部分：R-1（部分）、R-2、R-3（部分）、R-4、R-6，以及 E6、Q-2。**其余各条未动**，等用户修订文档后再改。

## 1. 改了什么（全在 plugin.js，未提交）

- 常量区（含所有权标记注释）：删 S2_REFILL_HIGH_FLOW_MLS；加 S2_REFILL_TRIM_MS=500。
- boundedRefillControlBase：删 high-flow-direct（r=1）分支；顺序回到 gainMemory → LUT → 曲线基准。
- boundedRefillCommand：下限 controlBaseMlS → commandFlowMin；上限 refillMaxCommandMlS → floodCommandMlS；无估算时直接顶到灌水上限；单调向下；归档改 snapCommandFlow（原来 Math.floor 会把 0.10 压成 0.0625，低于驱动硬限被静默拒发）。
- stage2StartupPlan：新增 floodCommandMlS = LIMITS.commandFlowMax；删 1.5×基准 上限；controlGain 回到 control.r；holding = 平台 target/r（2.2.6 是曲线指令）。
- currentS2RefillSettings：删「cutoffPercent===85 → 95」的按值迁移。
- dispatchS2Startup：新增 trim 动作；删 handoffOk 两值钉死；returnFloor 改成 平台 / 保护性 min(平台, 曲线指令) 两条；command 选择式覆盖 trim。
- liveTrimTick：boosting 且无收回理由时派发 trim。
- trace 新增 startup-bleed；图表标记新增「补水断流」。
- renderRefillEditor：预览显示灌水上限、r、平台收回值。
- 版本：plugin.js 与 manifest.json → 2.2.7。

## 2. 测试（tests/verify_v0227.cjs，637/637）

从 verify_v0226.cjs 复制，**v0226 与 RESULTS_v0226.txt 原样保留未动**。

删掉 6 条镜像断言，换成两层新测试：

- 口径不变量（不引用计划常数）：§22.11 the flood ceiling reaches the rise-time floor for every cup target（3.0–6.5 g/s 逐个断言 ≥7.0）、§22.11 r greater than 1 lowers the platform and never moves the flood（r ∈ 1.05…1.6）、§22.11 the refill law spans the full driver range and only ever steps the flood down、§22.11 refill handoff lands on the platform and a protective return never raises the pump、§22.11 bounded refill platform is target/r and the flood is the safety envelope。
- 闭环植物测试 §22.11 closed loop：合成植物按实测动力学（0.35 s 死区 + 一阶 τ 0.4 s + 粉饼限流 5.5 ml/s + 杯流 = r × 泵流），50 ms 步进、250 ms tick 真跑 liveTrimTick，断言**秤流速曲线**而不是计划常数。HX_LOOP_REPORT=1 会打印实测指标。

安全门测试（限压 / ACK / 帧确认 / 预算 / 秤失效 / profile truth / 存储回读 / UI 翻译）一条没动，全绿。

**为什么必须换测试策略**：v0226 是 635/635 全绿，而真机连续 5 杯 S2 停在 −21%…−29%，没有一杯对。原因是那批断言是镜像式的——assert.equal(p.controlBaseMlS,5)、assert.equal(p.boostCommandMlS,7.5)、assert.equal(p.controlSource,'high-flow-direct')，代码算出什么就把什么写成期望值；其中 assert(p.boostCommandMlS<=p.controlBaseMlS*1.5+1e-9) 甚至把错误策略本身钉成不变量。2.2.6 把基准从 2.5 改成 5.0 时三条测试变红，修法是跟着把期望值改成 5.0/7.5，没有人问「5.0/7.5 能不能做出 90° 上升」。

## 3. 闭环实测数字（合成植物，不是真机）

| 学到的 r | 平台 target/r | 上升 20→80% | 峰值过冲 | 平台偏差 | 灌水峰值 | trim 触发 |
|---|---|---|---|---|---|---|
| 1.29 | 3.875 | 0.60 s | **+36.4%** | −15.0% | 8.0 | 0 笔 |
| 1.05 | 4.750 | 0.70 s | +11.3% | −11.0% | 8.0 | 0 笔 |
| 1.60 | 3.125 | 0.55 s | **+62.7%** | −12.2% | 8.0 | 0 笔 |

上升段已经做到 0.55–0.70 s，贴近机器下限 0.7 s，首要目标达成。**过冲仍然偏大，单步收口是主因**：从 8 ml/s 一步回到平台，泵要 ~1.2 s 才走完，这段时间杯流继续冲。

## 4. 已知未完成（需用户定口径）

1. **两段收口没做**。§22.11 要求「先断流、让留存水把杯流顶到目标，再写平台」。试过两条路：
   - 灌水途中逐笔下调（本版已实现 trim 通道）——**实测无效**：上升太快，从 cutoff(4.25) 到 target(5.0) 只有约 0.1 s，250 ms 的 tick 抓不到窗口，闭环里 trim 触发 0 笔。
   - 把 cutoff 改成前瞻判据（predicted ≥ target，观测值只当 0.6× 噪声底）——过冲降到 +22.6% / +7.7% / +51.2%，但会让 13 条既有 handover 测试失效，且 cutoffPercent 的语义从「实测到 X% 收回」变成「噪声底」，属于口径变更，已回退。
   - 结论：**断流必须放在 return 那一笔**，即在 boosting → returning 之间加一个 bleeding 状态（先写一个远低于平台的值，等 ~700 ms 或预测回到带内，再写平台）。这要动安全状态机（["boosting","returning","return-unconfirmed"] 出现在 6 处：transport close、frame-ended ×2、tick ×2、ACK 完成、actual-flow 佐证），**等用户确认后再做**。
2. S2_REFILL_SETTLE_MS=1500 与技能 §19 记的 200 ms 冲突，作用面从 1 处扩到 4 处；本版未动，见审查 F2。
3. 审查文档里 T-1（reg.predicted===null 被当成 0 g/s，真机 49/730 个决策点中招）、T-2（预测单向外推且无幅度上限）、T-7/T-8（S3 步长）、L-1/L-2（VARIABLE/MIXED/SATURATED 封锁增益记忆）等全部未动。

## 5. 所有权标记

plugin.js 常量区有一段中文横幅注释，列出归属本节的符号（S2_REFILL_TRIM_MS、S2_REFILL_SETTLE_MS、boundedRefillControlBase、boundedRefillCommand、stage2StartupPlan 的 bounded 分支、s2RefillReturnReason、dispatchS2Startup 的 boost|trim|return、liveTrimTick 的 startup 分支）。其它对话要改这段，先对照技能 §22.11 与 §22.12 的六条自检，不要重新引入「泵指令 = 流量设定值」。

## 6. 真机怎么验

1. 装 2.2.7。**先看诊断页补水预览**：应显示「r 1.2x · gain-memory」（或「空粉碗 LUT」），灌水 8.0000 ml/s，平台收回 = target/r（r=1.29 时约 3.875），不再是 2.2.6 的「高流量区直给，不折算 r」。
2. 若显示「空粉碗 LUT」说明没找到增益记忆（这一版标签重新可达了）。
3. 萃一杯，导出 history JSON，看 liveFlowTrim.trace：startupAction:"boost" 的 commandMlS 应是 8.0；有没有 startupAction:"trim" 与 startup-bleed（闭环预测是 0 笔，真机上升更慢，可能有）；startupAction:"return" 的 commandMlS 应等于平台。
4. 看 s2RefillTimeline.cutoff：rawGS / predictedGS / thresholdGS。峰值过冲是这版的主要待改项，请记录秤流速峰值。
5. cutoffPercent 现在可以设 85 了（2.2.2–2.2.6 会被静默改回 95）。过冲大就下调它。

## 7. 发布状态

**未提交、未发布**。工作区里 2.2.6 也是未提交状态（另一个对话留下），本版直接叠在它上面，所以 2.2.6 没有独立 tag，tag 序列会是 v2.2.5 → v2.2.7。要发版按 §15 走：commit、tag v2.2.7、GitHub Release、夸克上传——按 §20 全部等用户点头。

## 8. 追加（同日，用户批准两段收口后）

第 4 节第 1 条「两段收口没做」已完成，本节取代它。

- cutoff 改前瞻判据：s2RefillReturnReason 现在是「实测 ≥ cutoff×0.6（噪声底）且 predicted ≥ target」，cutoffPercent 语义变成噪声底，默认 85。
- 新增 bleeding 状态：armed → boosting → bleeding → returning → complete。cutoff 触发先写 snap(max(0.10, 平台×0.35)) 断流，等 700 ms（S2_REFILL_BLEED_MS）或秤流回落到 target×1.02 内，再写平台 target/r。
- 状态数组在 4 处安全路径同步；ACK 完成与 actual-flow 佐证仍只认 returning，断流笔的 ACK 不会提前结束补水。看门狗容忍已 ACK 的断流笔，最多续两次 1500 ms。
- 修掉本次引入的 TDZ：previousCommand 声明在状态块之后，trim 分支从未真正执行所以没暴露，bleed 一触发就是 ReferenceError → abortSequence（与 2.2.1 的 rescueActive 同类）。

闭环实测（同一植物模型，只改收口）：

| 学到的 r | 平台 | 上升 20→80% | 峰值过冲 | 平台偏差 | 补水写入 |
|---|---|---|---|---|---|
| 1.29 | 3.875 | 0.60 s | +88% → +36.4% → **+21.4%** | −15.0% → **−1.4%** | boost 8.0 → bleed 1.375 → return 3.875 |
| 1.05 | 4.750 | 0.70 s | 达标 | 达标 | 同上 |
| 1.60 | 3.125 | 0.55 s | 达标 | 达标 | 同上 |

平台偏差从 −15.0% 收到 −1.4%（进 4% 死区）是这一版最大收益：断流那 700 ms 让留存水把杯流顶到目标附近，平台笔接手时不用再爬。峰值过冲仍 +21.4%，下一步下调 cutoffPercent 或缩短 bleedMs。

测试状态：**624/637**。13 条红全部是断言旧 cutoff 语义的 handover 测试（「实测到 85% 就收回」这类），按用户口径「既有的测试不用管，都有大问题」没有为了让它们变绿而回退代码，列为 cut 0 重写。安全门测试、新增口径不变量、闭环测试全绿。

真机验收时请额外看：trace 里有没有 startupAction:"bleed" 与 startup-bleed-start；bleed 的 commandMlS 是否约等于平台×0.35；从 bleed 到 return 的间隔是否约 700 ms；秤流速峰值（这是当前主要待收的指标）。

