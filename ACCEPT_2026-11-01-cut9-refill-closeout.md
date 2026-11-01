# cut 9 验收 — 补水收尾（R-5 / R-7 / F2 / T-11 + 补水侧纹波门）

日期 2026-11-01 · 执行 原审查对话 · 版本 **2.2.16** · 基线 HEAD 63fc42c（2.2.15）· 分支 v1.79ds
测试 **tests/verify_v02216.cjs = 679/679**（v02215 原样保留）· RESULTS_v02216.txt 已出
状态：**未 commit、未 tag、未推送、未发版**（等用户当次点头）

## 1. 结论

cut 9 四项范围全部落地，一项按工程判断没做（strategy 字符串改名，理由见 §5）。F2 由用户拍板为「测量窗 800 ms / 链路窗 1500 ms」，并要求窗口切光时在报告里带 reason，两条都已实现。真机 JSON 交叉验证显示新窗口在真实完成杯上不会把 S2 数据切光。安全门测试一条没删、没弱化。

## 2. 范围与口径依据

范围（CUT9_HANDOFF）：R-5 学习窗在收回未确认时退回无窗口的洞；R-7 一组小问题；F2 沉降窗口径；T-11 handover 三处死参数（cut 3 按边界留给补水）；补水侧两处纹波门（2.2.11 只统一了学习侧）。

口径依据：技能 §22.10（插件与固件分工）、§22.11（泵流量是趋势矢量、灌水量只受安全包线约束、r 允许 >1 且只用于平台）、§22.12（六条自检）、「测试与仿真都必须跟真机 history JSON 交叉校准」两条硬规矩；审查文档 §10 与 §11 的 cut 9 行。

## 3. 改动逐条

### F2 · 沉降窗拆成两个（用户 2026-11-01 拍板）

- 新增 S2_REFILL_CHAIN_SETTLE_MS = 1500，S2_REFILL_SETTLE_MS 由 1500 改 **800**。
- s2LearningWindow(run, consumer) 增加 consumer 参数：值为 chain 时取 1500，其余取 800；返回体新增 chainSettleMs。
- 理由：链路证据把恢复斜坡积分成一个增益（00:25 那杯量出 0.45 而落定尾段是 1.29），必须等泵完全沉降（0.35 死区 + 0.85 爬升 + 0.4 一阶 ≈ 1.6 s）；测量窗只需泵停止移动，800 ms 够，且能给短 S2 多留数据。
- 诊断页文案改成「已排除补水 + 测量 0.8 s / 链路 1.5 s 沉降」。

### R-5 · 收回未确认时不再退化成「无窗口」

- s2LearningWindow 在未确认时带 reason = refill-return-unconfirmed。
- 三个测量消费方全部改成拒绝而不是退回全窗口：stage2EffectiveCommand 返回 null；controlOutputQuality 返回 available:false + reason；liveTrimChainEvidence 返回 null。（controlLearningAssessment 原本已拒绝。）
- 修前后果：补水灌了但收回没确认时（frame-ended 路径不产生 startup-complete），r、链路增益、尾段质量会连着 7.5–8 ml/s 的灌水段一起算，正是这段代码注释自己举的例子。
- 新增不变量测试「§R-5 unconfirmed refill return withholds every S2 measurement consumer」：未确认时三处一律拒绝，补上 startup-complete 后恢复且窗口起点 = complete + 800。

### F2 附带 · 窗口切光要能看出来（用户要求带 reason）

- controlOutputQuality 的 available:false 现在带 reason：refill-return-unconfirmed / no-target / raw-samples-insufficient / learning-window-too-short，后两者附 rawSamples 与 windowSamples。
- controlLearningAssessment 转成 report.outputQualityReason，controlRunReview 的 learningStatus 追加「（S2 输出质量：…）」，经既有诊断面板显示，不新增 UI 元素。
- 新增不变量测试「§F2 a learning window that empties S2 reports learning-window-too-short」。

### T-11 · handover 三处死参数

- 删 approachWriteIntervalMs:750 及其在 tick 里的门（reason「S2 approach upward-write spacing」）。它在同一次 tick 里排在 1200/800 ms 预测静默门之前，松的门不可能放行严的门挡住的东西，是个读起来像 handover 专用节拍的死参数。
- S2_REFILL_DEFAULTS.approachMs 由 200 改 **800**：200 ms 短于一个 250 ms tick，handover 守卫可能整段被跳过（真机 00:25 那杯 approachMs=800 才在 check 13–14 命中）。S2_REFILL_LIMITS 区间 [200,6000] 不变，已存值不动。
- 删 row.approachFraction（恒为 1，真实 ramp 已在 handoverProgress）。

### 补水侧纹波门对齐

- s2RefillPumpEstimate：私有硬门 15.6% → 统一策略 **>25% 拒绝**，返回值新增 rippleCVPct 与 rippleDamped（≥12%）。
- s2HoldingReference：私有硬门 12% → **>25% 拒绝**，12–25% 时把部分修正系数由 0.5 减半到 0.25（damped 而不是拒绝）。

### R-7 · 一组小问题

- maximumExtraCommandMl 的基准由 refillBase 改 base：额外水量应相对「S2 本来会跑的那条指令」算；2.2.7 起 refillBase 是平台值，报出的水量偏小约 1/3。
- commandLimited 在 bounded 模式原来恒为 false（requested 与 ceiling 都是 8），改成 boost >= commandFlowMax；legacy 分支保持 requested>ceiling（既有测试覆盖）。
- 删 plan.flowMaxGS：2.2.7 之后没有任何消费方，boundedRefillCommand 已不再用它夹 predicted（夹了反而看不见过冲、无法断流）。
- gainRegimeForRun 的 basis 文案「S2 late 40%」→「S2 late 60%」：代码是 rows.slice(0.4n)，保留后 60%，与 §22.3 一致，标签一直错。
- 常量区所有权横幅删掉已不存在的 S2_REFILL_TRIM_MAX_QUANTA，补上 S2_REFILL_BLEED_MS / S2_REFILL_BLEED_FRACTION（2.2.7 引入时漏更新）。

## 4. 真机交叉验证（硬规矩一 + 二）

数据源 C:/Users/ladios/Downloads/hyperex-history (4).json（30 杯 / 22 杯 fullRecord）。脚本 D:/vscode/.tools/__hx-cut9-window.js。

10 杯带补水写入，其中 4 杯是有 stage2 采样的完成杯：

| runId | S2 采样跨度 | startup-complete | 测量窗起(+800) | 链路窗起(+1500) | 剩余样本 测量/链路 |
|---|---|---|---|---|---|
| 1793489359425-1 | 10.5 s | 28.17 s | 28.97 s | 29.67 s | 71 / 64 |
| 1793489532447-2 | 12.8 s | 29.86 s | 30.66 s | 31.36 s | 93 / 87 |
| 1793490122135-1 | 11.1 s | 26.30 s | 27.10 s | 27.80 s | 75 / 68 |
| 1793492759538-1 | 10.7 s | 23.79 s | 24.59 s | 25.29 s | 73 / 66 |

结论：**两个窗口在真实完成杯上都不会把 S2 切光**（最少也剩 64 个原始样本，而 controlOutputQuality 只要 6 个）。另 6 杯显示切光的是中止杯或无 stage2 采样的杯（2.0.1 / 2.1.1 / 2.2.0 ×2 / 2.2.2 / 2.2.3），本来就被 completed at 要求排除在学习之外；其中 2.2.2 那杯正是「收回未确认」，修复后走 R-5 的拒绝分支而不是退回全窗口。

仿真植物校准：本 cut 没有改动灌水/收口控制律，闭环峰值仍是 2.2.7 口径的 **+33.2%**（绊线 ≤40%），植物参数未变，台账不新增达标记录。**≥5 ml/s 稳态 r 仍是 0 样本**，涉及该区间的定数还不能算达标，需先做高指令标定（S2 手动固定 5.5 / 6.5 / 7.5 ml/s 各 3 s）。

## 5. 没做的一项，以及为什么

**strategy:"refill-85" 改名没做。** 它是持久化字段：写进 run.config.s2StartupPlan，随 history JSON 落盘并导出，历史文件里所有旧杯都带这个值；代码里 12 处按它判分支，测试里 3 处断言它。改名要么留永久兼容读取（两个名字并存，比现在更乱），要么让旧 history 的学习窗与补水时间线全部失效。收益只是名字好听——而 cutoff 默认回到 85% 之后，refill-85 其实又对上了。按 AGENTS.md 第 2 条（最简）与第 3 条（只碰必须碰的）判定不值得，改为在常量区注释说明它是历史标识符。**若用户坚持改名，按「新值 + 兼容读取旧值」做，需点头。**

另外 controlOutputQuality 的 basis 文案仍写 rolling regressions over final60% of phase，加了学习窗后对 S2 不够准确。这串文字被多处测试与 UI 翻译表引用，改动面大于收益，本 cut 只改了确实说反的 gainRegimeForRun。

## 6. 测试

- 新增 2 条不变量测试（§R-5、§F2）；改写 4 条既有测试以匹配新口径（沉降窗 4200→3500、settleMs 1500→800 并新增 chainSettleMs 与 chain consumer 断言、UI 文案、refillDefaults.approachMs 200→800 及三处依赖它的断言）。
- 测试骨架 hooks 补导出 stage2EffectiveCommand（新测试需要）。
- 安全门测试（限压 / ACK / 帧确认 / 预算 / 秤失效 / profile truth / 存储回读 / 设置校验与回滚）一条没删、没弱化。
- 没有写镜像断言；两条新测试断言的都是行为不变量（未确认必拒、切光必报 reason）。

## 7. 复现

    cd D:/vscode/decenthyperexplugin/decenthyperexplugin.reaplugin
    node tests/verify_v02216.cjs                 # 679/679
    node tests/verify_v02216.cjs > tests/RESULTS_v02216.txt
    node D:/vscode/.tools/__hx-cut9-window.js    # 真机窗口核算

## 8. 清单

改动：decenthyperexplugin.reaplugin/plugin.js（21 处替换）、manifest.json（版本号）、tests/verify_v02216.cjs（新建，自 v02215 复制后修改）、tests/RESULTS_v02216.txt（新建）、README.md（2.2.16 小节）、HANDOFF_v02216.md（新建）、本文件。
未改：tests/verify_v02215.cjs 及更早所有测试与 RESULTS；其它对话的未提交文档；补水控制律（灌水量、bleed、平台、cutoff 判据）。

## 9. 限制与遗留

1. 补水段过冲（闭环 +33.2%）本 cut 没有改善，它取决于两段收口的时机参数（cutoffPercent / bleedMs），属真机调参，不在 cut 9 范围。
2. ≥5 ml/s 稳态 r 仍 0 样本；灌水上限 8.00 目前只有 2.2.2 那杯（7.6875 → 7.602 g/s，r≈0.99）一个参考点。
3. strategy 改名与 controlOutputQuality 的 basis 文案见 §5，都待用户点头。
4. F2 已定并实现；F3 / F4 已由 cut 3 实现（救急静默 max(800, min(3000, 实测 ACK 延迟))，S3 预算改累计 24 档 + 大角度放开），本 cut 未触碰。
5. 未 commit / 未 tag / 未推送 / 未发版。
