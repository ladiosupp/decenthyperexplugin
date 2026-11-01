# HyperEx 流量控制整改 · 新对话引导词（2026-11-01）

用法：一个 cut 开一个新对话，把对应那一段整段贴进去。**统筹对话和 cut 0 先开**，其余按编号串行（cut 7 可与 cut 2/3 并行）。cut 9 归原审查对话，不要新开。每段自包含，不需要额外补上下文。

当前状态：plugin.js 与 manifest.json = 2.2.7（未提交、未发布），tests/verify_v0227.cjs = 624/637，13 条红是刻意保留的旧 cutoff 语义测试（cut 0 处理）。2.2.6 也是未提交状态（另一个对话留下），所以 tag 序列会是 v2.2.5 → v2.2.7。

**一条贯穿所有 cut 的新事实（2026-11-01 真机标定，已记进技能台账）**：r 不是常数，它随指令下降——1–4 ml/s 区间 r ≈ 1.22–1.26，高流量区 r → 1，**秤流速峰值 ≈ 泵指令值**。唯一接近满泵的真机点是 2.2.2 那杯 boost 7.6875 ml/s → S2 整段回归 7.602 g/s（比值 0.99）。所以灌水到 8.0 时杯流渐近值就是 ~8 g/s，对 5 g/s 目标是 +60%，过冲上限由泵最大流量决定而不是由控制律决定；控制律唯一能做的是靠提前断流让杯流在追上渐近值之前被拦住。≥5 ml/s 的稳态 r 目前**一个样本都没有**，碰到需要它的 cut 先建议用户做一次高指令标定（S2 手动固定 5.5 / 6.5 / 7.5 ml/s 各 3 s）。

---

## 统筹对话（先开这个，它不改代码）

你是 HyperEx 插件流量控制整改的统筹对话。你**自己不改任何代码**，只负责守口径、守边界、守测试与仿真、守发布顺序、守台账。

先读：C:/Users/ladios/.codex/skills/decentplugin/SKILL.md 的 §19–§22，重点 §22.10（插件与固件的分工）、§22.11（补水段泵流量是趋势矢量）、§22.12（一句话自检）、「测试与仿真都必须跟真机 history JSON 交叉校准」那节的两条硬规矩、以及末尾的仿真植物校准台账；D:/vscode/decenthyperexplugin/REVIEW_2026-11-01-flow-control.md 全文，重点 §0.1 口径与时点、§9 已处理标记、§10 两段收口实测、§11 分 cut 建议与你的职责；D:/vscode/decenthyperexplugin/decenthyperexplugin.reaplugin/HANDOFF_v0227.md；D:/vscode/decenthyperexplugin/CUTS_2026-11-01-prompts.md（本文件）。

你的五件事：① 每个 cut 开工前对照技能 §22.10–§22.12 与审查文档，确认它没有重新引入已废弃写法（泵指令当流量设定值、镜像断言、1.5× 类静态倍率上限、按值迁移、把 r 当常数），发现冲突先停下问用户；② 守边界，每个 cut 只碰自己那一栏，补水段（审查文档第 2 节 + §10）归原审查对话所有，其它对话要改必须先读 plugin.js 常量区的中文横幅注释，同一函数被两个 cut claim 时按编号串行；③ 守测试与仿真，每个 cut 必须带口径不变量测试或闭环结果测试，只有 assert.equal(plan.某字段, 常数) 这类镜像断言的一律退回，每个 cut 完成后要求用最新真机 history JSON 做两件事——交叉验证测试（差距大就是测试不对）、校准仿真植物并把参数与准确度记进技能台账（目标 ≥90%）；④ 守发布，版本号从 2.2.8 起顺序递增、不并行发版，每个 cut 的 RESULTS / README / HANDOFF 必须齐全，F2 / F3 / F4 三个待定口径在碰到对应 cut 前先找用户定；⑤ 守台账，维护审查文档 §9 / §10 的状态表，每个 cut 合并后更新对应条目的「已改 / 未动」。

现在先做一件事，不要动任何文件：读完上述材料后给我一份 cut 执行顺序确认表——每个 cut 的前置依赖、会碰到的函数清单、与哪些 cut 有文件冲突、哪几个 cut 需要先定 F2 / F3 / F4、以及哪几个 cut 需要先补 ≥5 ml/s 的高指令标定数据。

---

## cut 0 · 测试重写（第一个做）

任务：把 HyperEx 插件 tests/verify_v0227.cjs 里 13 条断言旧 cutoff 语义的 handover 测试按新口径重写或删掉，并补齐 bleeding 状态的专项测试。**只改测试文件，不改 plugin.js。**

先读：技能 §22.10–§22.12 与「测试与仿真都必须跟真机 history JSON 交叉校准」那节（两条硬规矩：测试要拿真机 JSON 交叉验证，差距大就是测试不对；镜像断言不许再写）；审查文档 §0.1、§10（两段收口的实现与闭环数字）、§10.3（13 条红测试）、§11.1 第 3 条；HANDOFF_v0227.md 第 8 节。动手前按 AGENTS.md 第 7 条查 git log / git status。

背景口径（不要违背）：补水段的泵流量是趋势矢量不是流量设定值；灌水量 = 安全包线 8.00 ml/s，不由 target / r / base 推导；平台 = target/r，r 允许 >1 且是命令的函数（平台区 ≈1.23）；收口是两段——cutoff 判据是「实测 ≥ cutoff×0.6（噪声底）且 predicted ≥ target」，触发后先写 bleed = snap(max(0.10, 平台×0.35)) 断流，等 700 ms 或秤流回落到 target×1.02 内，再写平台。cutoffPercent 的语义已经从「实测到 X% 收回」变成「观测噪声底」。

要做：① 跑 node tests/verify_v0227.cjs 拿到 13 条 FAIL 的确切名字；② 逐条判断它断言的是安全门（保留，只按新口径修 fixture）还是已被取代的旧 cutoff 语义（重写或删；删要在原位置留一行注释说明取代它的是哪条新测试）；③ 新增 bleeding 专项测试：断流笔缺 ACK、bleed 期中途换帧（frame-ended）、看门狗对已 ACK 断流笔的两次 1500 ms 续期与第三次判失败、保护性理由（pressure / stale）走不走断流、bleed 期秤失效；④ 新增一条闭环测试，植物按最新标定改：r 随命令变化（1–4 ml/s 取 1.23，>4.5 取 1.0），**去掉人为的粉饼限流常数**，然后重测峰值过冲并把数字报给用户——v2.2.7 报的 +21.4% 因为这两处失真是偏乐观的，不能当验收基线；⑤ 新测试一律写成口径不变量或闭环结果形式，参照文件里已有的 refillClosedLoop 与以「§22.11」开头那几条。

验收：node tests/verify_v0227.cjs 全绿（条数会增加）；安全门测试一条没删；重跑 tests/verify_v0226.cjs 确认你没动过它；把修正后的闭环过冲数字与技能台账里的标定对照后更新台账。产出：测试结果、删/改/增清单与每条理由、RESULTS 更新、新的过冲基线数字。**不要 commit、不要打 tag、不要推送**，改完把 diff 摘要与测试结果报给用户并问是否 commit。

---

## cut 1 · 杯内决策的三个硬 bug

任务：修 plugin.js 杯内决策的三个硬 bug。T-1：reg.predicted===null 被 Number(null)=0 当成 0 g/s。T-2：预测只外推上升方向且无幅度上限。T-3：前瞻窗两套（正常段 S2 是 2 s、补水是 1.5 s）。

先读：技能 §19–§22，重点 §22.4 杯内决策模型、§22.10–§22.12、测试与仿真交叉校准那节、仿真校准台账；审查文档 §0.1、§1.2、T-1、T-2、T-3、§11；HANDOFF_v0227.md。动手前按 AGENTS.md 第 7 条查 git 状态。**必须在 cut 0 之后做。**

真机证据（用来定验收，不是用来凑数）：730 个决策点里 49 个（6.7%）出现 predictedGS===0 而 rawGS>0.2，同一条记录 errorPct −49.35 而 predictedErrorPct 100；tMs 30578 那笔 rawGS 3.43、目标 1.5、errorPct +128.67，decisionGS=0 让控制器打算加码，最终写出下调只是因为信封上限恰好是 0.625。frame-1 预测 MAE 1.350 g/s = 目标的 27%，而死区是 4%（0.2 g/s）；rawGS 2.532 被外推成 7.349，之后 1.5–4.5 s 实测 4.50。2.2.3 之后 5 杯里 S2 有 9 笔下调发生在杯流仍低于目标时。

要做：① T-1 在 decisionGS 与 cannotReturn 两处都加显式 null 守卫（参照同函数下方已有的 reg.fastSlope!==null 写法），predicted 缺失时退回 reg.slope；② T-2 给外推加幅度上限（abs(predicted − fastSlope) ≤ 0.6×target，或 predicted ≤ target×1.5，二选一并说明理由），并补下落方向的外推——现在只防过冲不防欠冲，与 §22.1「避免过冲靠统计预测」只实现了一半；③ T-3 把正常段 S2 前瞻统一到 1.5 s 与补水一致，并同步技能 §22.4 / §22.9 的口径。

验收：新增闭环测试（参照 refillClosedLoop 搭杯内段的植物，r 按命令分段、不加人为粉饼上限）证明修改后 S2 平台偏差与「杯流低于目标时的下调笔数」都改善；新增不变量测试证明 predicted 为 null 时 decisionGS 等于 reg.slope、且 predicted 永远不超过上限；用最新真机 history JSON 交叉验证一次并把校准结果记进技能台账。发版走完整流程（版本号 2.2.8、新 verify 文件、RESULTS、README 小节、HANDOFF）。**补水段的符号不要碰**（boundedRefillControlBase / boundedRefillCommand / stage2StartupPlan 的 bounded 分支 / s2RefillReturnReason / dispatchS2Startup 的 boost|bleed|trim|return / liveTrimTick 的 startup 分支），那是另一个对话的所有物，见 plugin.js 常量区横幅注释。改完报告并问是否 commit / 发版。

---

## cut 2 · 杯内步长与信封

任务：修 T-5 常规信封可以不包含当前指令且 hi 未夹到 8；T-6 救急上限可以比常规更窄；T-7 S3 常规最小步 2/3 档是 4% 死区的 3–5 倍导致极限环；T-8 救急 8–24 档不分段；L-8 同一个 target/r 有四个上限。

先读：技能 §19–§22，重点 §22.4 动作集与救急判据、§22.6 实测机器特性、§22.10–§22.12、测试与仿真交叉校准那节；审查文档 §0.1、§1.2、T-5…T-8、L-8、§6.4、§11；HANDOFF_v0227.md。**必须在 cut 1 之后做**（同一段代码，串行）。

真机证据：2.2.x 的 65 笔非补水写入里 21 笔（32.3%）实际移动档数与 stepQuanta 不符；tMs 30578 那笔 frame 2 指令 0.8125 而信封是 [0.5, 0.625]，当前指令根本不在信封内；23:29 那杯 center 7.236 时常规 hi 算到 8.625（超 8 的写入被静默丢成 command-bound-vector），救急 hi 只有 5.0。S3 增益约 2.15 g/s per ml/s，2 档 = 0.125 ml/s → 0.27 g/s = 2 g/s 目标的 13.4%，3 档 20%，而死区 4%；23:42 那杯 S3 指令 0.75→0.875→1.0625→1.4375→1.25→0.75 来回 0.69。救急 8 档 = 0.5 ml/s 在 S3 是目标的 54%。

要做：① 抽一个 commandCeilingFor(phase, mode) 统一四个上限，常规 hi 夹到 commandFlowMax，救急 hi 取 max(min(8, LUT×2), 常规hi)，保证进入救急不会缩小可达范围；② 信封必须包含当前生效指令（lo = min(lo, command)、hi = max(hi, command)），否则控制器无法从任何状态出发；③ S3 常规最小步改 1 档（与 §22.4 动作集 0/±1/±2/±4 一致）；④ 救急下限按误差比例折算，例如 min = clamp(round(0.25×abs(err)/r×16), 2, 8)，让 S3 救急最小笔落在 0.1–0.2 ml/s；⑤ trace 同时记 intendedQuanta 与 actualQuanta，导出数据才可用。

验收：闭环测试证明 S3 不再极限环（指令序列收敛、方向反转次数下降）且 S2 平台偏差改善；不变量测试证明信封恒包含当前指令、救急上限恒不小于常规上限、所有写入恒在 0.10–8.00 内、trace 的 intended 与 actual 一致或差值有记录。用最新真机 JSON 交叉验证 + 校准植物并记台账。发版走完整流程（2.2.9）。**不要碰补水段。**

---

## cut 3 · 杯内门槛与死参数（开工前必须先定 F4 / F3）

任务：修 T-4 deadbandPct（流量百分比 4）被当角度阈值（度）用；T-9 S3 写入预算 + 后段 45% 禁写构成墙；T-10 救急判据三条件实为两条；T-11 handover 三处形同虚设；T-12 vectorStepCount 在 predictive 模式是死代码；T-13 其余杯内小问题。

先读：技能 §19–§22，重点 §22.4、§22.8 门槛取舍、§22.10–§22.12、测试与仿真交叉校准那节；审查文档 §0.1、§1.2、T-4、T-9…T-13、§6.4、§7 的 F3 / F4、§11；HANDOFF_v0227.md。**必须在 cut 2 之后做。**

**开工前必须先问用户两件事，不要自己定**：① F4——S3 的常规 4 笔 / 救急 2 笔算不算 §22.8 里的「写入预算 = 安全门」？全局 maxWrites 显然是安全预算，但 S3 分段预算是真机上 428 个检测点被挡（其中 205 个同时误差 >15% 且趋势角 >120°）的那道墙，归类不同决定它能不能改。② F3——救急静默取固定 800 ms、固定 1000 ms、还是 max(800, 上一笔实测响应延迟)？§22.4 同时写了「最小间隔 1.2 s（一笔要 1.2 s 才完全进泵）」和「救急 0.8 s」，两句自相矛盾，真机有一笔响应延迟 1235 ms。

真机证据：2.2.5 那杯 check 158–172 连续 15 个点，errorPct −21.7%→−30.8%、trendAngleDeg 171–178°、rescue:true、rescueAngleStreak 到 10，reason 全是 S3 rescue write budget；2.2.4 之后 4 杯 s3RescueWrites 都顶到上限 2。cannotReturn 在 predictive 模式下与 predictedRel>.25 逻辑等价（decisionGS 就等于 reg.predicted），remainingS 算出来只跟常数 2 比过、从未进入外推。approachWriteIntervalMs 750 被同一次 tick 后面的 1200/800 ms 静默门完全覆盖；approachMs 默认 200 ms 而 tick 周期 250 ms，真机只在 check 13–14 命中过（该杯 approachMs=800）。

要做：① computeAngleStats 引入独立的 angleDeadbandDeg=2，不复用 deadbandPct；② 按用户对 F4 的答复改 S3 预算（建议救急按累计档数而非笔数，例如总额 24 档；趋势角连续 ≥120° 超过 3 个检测点时临时放开常规预算），并删掉或改写 progress>=.55 的后段禁写；③ 救急判据把剩余时间真正用起来；④ 删 approachWriteIntervalMs 或把静默门改成 min(silenceMs, approachWriteIntervalMs)，approachMs 默认提到 600–800 ms，approachFraction 要么用 fraction 缩放步长要么删字段；⑤ vectorStepCount 接入 predictive（bigAngleStreak≥3 提常规 max 到 6、≥6 提到 8）或删函数并在技能 §19 撤掉那条记录。

验收：闭环测试证明 S3 在偏差 >15% 且角度 >120° 时不再被预算挡死、且写入总数仍受全局 maxWrites 约束；不变量测试证明角度阈值与流量死区是两个独立常量。交叉验证 + 校准 + 记台账。发版走完整流程（2.2.10）。**不要碰补水段。**

---

## cut 4 · 杯间学习的封锁与门槛

任务：修 L-1 VARIABLE/MIXED/SATURATED/LIMITED 连带封锁增益记忆；L-2 链路饱和同时封掉「学」与「用」；L-3 local 覆盖用上一杯观测而非当杯估计；L-11 三套执行器/质量门阈值互不相同且两处仍用过期分母；L-12 known() 的开杯指令 ±20% 窗；以及 §6.2 数据质量门改权重。

先读：技能 §19–§22，重点 §22.1 用户设计意图、§22.3 杯间增益状态、§22.8 门槛取舍、§22.10–§22.12、测试与仿真交叉校准那节与台账；审查文档 §0.1、§1.4、§1.5、L-1、L-2、L-3、L-11、L-12、§6.2、§6.3、§11；HANDOFF_v0227.md。可与 cut 2/3 并行（不同函数），建议排在它们之后。

真机证据：最近 5 杯 S2 停在 −21%…−29% 而增益记忆没有被有效采用；最后一杯 memoryGuardBypass.hard.reason = 「S2 tail ripple 16.5% exceeds 12% learning limit」，relaxed 侧 coverage 1.0 / pressureLimitedFraction 0 / underCommandFraction 0；historySearch = checked 5、incompatibleCommands 4、mixedBasis 1、nearbyCommandComparisons 1。g2 平滑 r=1.3574（n=3、confidence HIGH）但杯内实际用 r=1.9026（上一杯的 lastObservedR），中心因此是 2.628 而非 3.683，差 29%。纹波 CV 同一个量有四个阈值：12%（controlLearningAssessment）、20%（gainStageObservation）、15.6%（s2RefillPumpEstimate）、不测（gainMemoryQualityGuard）。执行器门三套：0.80/0.20/0.25、0.60/0.35/0.40、0.70/0.20/0.25。

要做：① 删掉 SATURATED|LIMITED|VARIABLE|MIXED 那条正则对 gainMemory.applied 的封锁，改成降权（α 减半、confidence 降一级），但 target/r 照常应用；② 删掉 gainStageObservation 里 chain.usable===false 的封锁，改成饱和时强制 local=true 并把 α 提到 0.55；③ local 语义改成当杯估计（例如 S2 后段 tailMeanGS / stage2EffectiveCommand），local=true 时 gainConfidence 强制降到 LOW；④ 纹波四处统一到 20% 并按 §22.8 改成权重（12–20% 之间 α 减半，>25% 才 HOLD），执行器三处对齐到 0.60/0.35/0.40；⑤ 两处欠跟踪分母从 cfg.stageNCommandMlS 换成实际生效指令（stage2EffectiveCommand / S3 逐帧实际指令），取不到就判 not-eligible；⑥ known() 的 seed 换成该样本时刻的实际生效指令并把窗放宽到 ±35%，或把「指令是否已知」从硬门降成权重；⑦ gainStageObservation 的 command 空回退删掉，直接返回 null。

验收：新增回放测试，用真机 history JSON 的合格杯证明修改后这些杯子能产出 r 观测并让下一杯 S2 平台偏差收敛（当前是连续 5 杯 −21%…−29% 不收敛，这是最直接的收益指标）；不变量测试证明同一个物理量只有一套阈值。交叉验证 + 校准 + 记台账。发版走完整流程。**不要碰补水段与杯内 liveTrimTick。**

---

## cut 5 · 增益记忆结构

任务：修 L-4 桶中心不自适应、两桶重叠、S3 记忆可整体丢失；L-9 r 取值范围三处不同；L-10 r 的分子分母窗口不一致。

先读：技能 §22.3（注意「原则不是认出这是哪张纸，而是认出增益变了并立刻切到对应先验」）、§22.10–§22.12、测试与仿真交叉校准那节与台账；审查文档 §0.1、§1.3、§1.4、L-4、L-9、L-10、§6.6、§11；HANDOFF_v0227.md。**必须在 cut 4 之后做。**

真机证据：gainMemory 现有 g2 center 0.4715（s2 r=1.2874 n=3，**无 s3 阶段**）、g3 center 0.2997（s2 r=1.6304 n=2、s3 r=1.9421 n=2 drift 0.913），lastBucketId=g2。radius 0.12 + hysteresis 1.25 后 g2 命中区间 [0.3215,0.6215]、g3 [0.1497,0.4497]，在 0.35–0.45 重叠，selectGainBucket 只能靠 lastBucketId 打破平局。§22.3 记录的两个形态是 0.18–0.35 与 0.55–0.63（间隙 0.20、阈值 0.45），g2 的实际中心 0.4715 落在文档所说的间隙里，radius 0.12 的前提不成立。因为活动桶是 g2 而 g2 没有 s3，2.2.5 那杯 S3 的 controlSource 回落到 lut（中心 0.719、controlR null），g3 学到的 s3 r=1.9421 与 drift=0.913 完全取不到，真机 S3 形状一直是全平 0.777。r 范围三处不同：normalizeGainMemory 收 (0.05,8]、gainStageObservation 只产 [0.2,3]、gainMemorySuggestion 只要求 >0.05。分子 tailMeanGS 取窗口后 60%、分母 stage2EffectiveCommand 取后 40%。

要做：① 桶中心改成滑动中位数或按 α 更新；② 命中判定改成最近邻 + 距离超过 radius×hysteresis 才新建桶，新建前先尝试合并到最近桶；③ 某段在当前桶缺失时回退到其它桶的同段记忆并标记 stale，不要直接掉回 LUT；④ 淘汰改 LRU（按 updatedAt）；⑤ r 范围统一到 [0.2,3]，normalizeGainMemory 越界即丢弃该 stage 并记录原因；⑥ 分子分母窗口对齐。另外按台账：r 是命令的函数，桶里的 r 应当记录它是在哪个指令区间测出来的，跨区引用要标注。

验收：用真机 history JSON 回放证明同一批杯子重新跑一遍后桶不再重叠、S3 记忆在活动桶缺 s3 时仍可取到、r 收敛值与 §22.3 记录的实测区间一致；不变量测试证明 r 的取值范围只有一处定义。交叉验证 + 校准 + 记台账。发版走完整流程。**不要碰补水段与杯内 liveTrimTick。**

---

## cut 6 · 档位统一

任务：修 Q-1 归档只做在写入面（配置面 / 学习面 / UI 面仍是未归档值）与 L-14 学习输出未归档导致 HOLD 判据不可达、每杯重写曲线。

先读：技能 §19（v2.2.3 的 1/16 档位统一那段）、§21（Streamline 收藏与内容寻址 profile）、§22.10–§22.12、测试与仿真交叉校准那节；审查文档 §0.1、L-14、Q-1、§11；HANDOFF_v0227.md。**必须在 cut 5 之后做。**

真机证据与推算：驱动档位是 1/16 = 0.0625 ml/s，而所有「指令是否相同」的比较用 0.005，细 12.5 倍。gainMemorySuggestion 的 commandMlS = round(target/r,3) 从不归档，而曲线经 formatCommandFlow 归档、cfg.stage2CommandMlS 保留未归档值（真机 3.067 对曲线 3.063）。结果「gain memory already maps to the current command」这条 HOLD 分支实际不可达，actionable 每杯为真、AUTO APPLY 每杯重写曲线；§21 记录曲线是内容寻址的，重写可能改变 profile id 并让 Streamline 收藏掉链。driftShapeSuggestion 的三个指令同样未归档。曲线编辑器 curveSetValue 允许 4 位小数而 curveNudge 按 1/16 走，两个入口口径不同。

要做：① 把 snapCommandFlow 提到 resolvedStageCommandFlow 的返回值上，让 cfg、UI、学习、写入四面同源；② liveTrimControlCenter 的 target/r 归档；③ 所有学习输出（gainMemorySuggestion、driftShapeSuggestion、scalarLearningSuggestion 的 suggested）先过 snapCommandFlow；④ 所有「指令相同」比较统一用半个档位 0.03125；⑤ curveSetValue 输入后归档。

验收：不变量测试证明任何进入 profile / A010 / 学习输出的指令都满足 round(v×16)===v×16；连续多杯相同条件下 HOLD 分支可达、AUTO APPLY 不再每杯重写。交叉验证 + 记台账。发版走完整流程。**不要碰补水段的控制律**（boundedRefillCommand 已用 snapCommandFlow，改它要先读 plugin.js 常量区横幅注释）。

---

## cut 7 · S3 形状（可与 cut 2/3 并行）

任务：修 L-5 stage3ShapeOnlyConsensus 约 15 条串联门实际不可达；L-6 S3 非递减约束与 drift 模型互斥（三处）。

先读：技能 §22.4、§22.6（S3 形状与 EARLY/MID/LATE 实测）、§22.9（S3 drift model 那条）、§22.10–§22.12、测试与仿真交叉校准那节；审查文档 §0.1、L-5、L-6、§6.3、§11；HANDOFF_v0227.md。

真机证据：§22.9 记录 S3 形状从 10-29 22:47 起 11 杯冻结在 1:1:1.09；最新真机是全平 0.777/0.777/0.777（曲线 0.75），origin 标 adaptive，说明 drift 模型没在产出。g3 桶里有 s3 r=1.9421、drift=0.913，但活动桶是 g2 且 g2 无 s3，所以取不到。stage3ShapeOnlyConsensus 的串联条件约 15 条（同指令逐帧 ≤0.005、同时序 ≤0.25 s、同 basis family、两杯都 LATE DECAY、lateToEarlyRatio<0.80、overallR2≥0.95、逐帧 r2≥0.95 且 seconds≥3、shapeVar≤0.15、overallVar≤0.20、两杯 profileRatio 都<0.80 且互差≤0.12、逐帧变化≤0.05 ml/s 且≤4%、非递减、相邻增幅受限、加权曝光变化≤0.2%、至少一帧变化≥0.005）。非递减约束在三处：projectS3Commands、curveLimits、applyCurveEditorDraft（后者还不带 model:drift 写回，会把 drift 形状降级成 legacy）；test-command-set 反而正确支持 drift，同一个存储对象两个编辑器两套合法性规则。

要做：① 删掉 stage3ShapeOnlyConsensus 整块，S3 形状统一走 drift 模型（若用户想保留，就把 shapeVar / overallVar / profileRatio 互差 / exposureChange 四条改成打分而非串联硬门——先问用户）；② 拆掉三处非递减，只保留相邻增幅 ≤ max(+0.25, ×1.35)；③ applyCurveEditorDraft 按 model 分支校验，写回时保留 model:drift / earlyFactor / drift；④ 同步删改 UI 文案「S3 early≤mid≤late and adjacent-rise limits remain」与「请保持S3顺序和相邻增幅」。

验收：闭环或回放测试证明 drift 形状能真正被学到并写进曲线（不再恒为全平）；不变量测试证明 early>mid 与 late<mid 的形状可以通过曲线编辑器保存而不被降级。交叉验证 + 记台账。发版走完整流程。**不要碰 S2 补水段。**

---

## cut 8 · 一致性门与三套 S2 估计

任务：修 L-7 三套 S2 估计互相矛盾而最弱的一套赢；L-13 sameScalarAdaptiveEvidence / sameStage3Shape 的相等判据比档位细 12.5 倍；L-16 目标比例 0.5–2× 作废整套 override；L-15 startupMetricAllowed 的 +8% 上界；以及 §6.3 一致性门其余项。

先读：技能 §19（稳态增益前馈那段的 spread 要求）、§22.1、§22.3、§22.6、§22.8、§22.10–§22.12、测试与仿真交叉校准那节与台账；审查文档 §0.1、§1.5、L-7、L-13、L-15、L-16、§6.3、§11；HANDOFF_v0227.md。**必须在 cut 4 之后做。**

真机证据（最后一杯同时算出三套 S2 下一杯指令）：单杯链路仿射反解 4.72 ml/s（chain 2.25→4.3125 对应杯流 3.856→4.794，增量增益 0.45，两点拟合截距约 2.83，纯仿射反解应是 4.77）；稳态前馈 gainFeedForward k=1.28、**spread 0.563（56%）**、targetCommandMlS 3.906、bounded 3.963、applied=false；增益记忆比例反解 r=1.2874 → 3.884、applied=true。代码让比例反解覆盖仿射反解。§22.6 记的跨杯增益是 0.976 g/s per ml/s，§22.3 把 r 定义成比值，两个量在代码里当同一个用；有大截距时 target/r 系统性偏低，真机曲线指令 3.094→3.067→3.884 而杯流 3.75→3.63→3.82，缺口一直在。historySearch 的 incompatibleCommands 4/5 说明 0.005 相等判据基本不命中。startupMetricAllowed 的 tailMeanGS 带是 [target×0.5, target×1.08]，下界松到 −50% 上界紧到 +8%，真机 00:25 的 tailCvPct 15.43 > 12 直接被拒。**注意台账里的新事实**：r 是命令的函数（1–4 ml/s ≈1.23，高流量区 →1），所以「比例反解 vs 仿射反解」的取舍要按指令区间分别讨论，不能一刀切。

要做：① 统一到一种反解口径——若保留比值模型必须承认它假设过原点线性，截距显著时改用仿射反解，并按台账把 r 做成命令的函数；② gainFeedForward 的 spread 门（§19 的两杯 ≤10% 或三杯 ≤10%）真正生效，超过就不参与；③ s2AdaptiveSuggestion 的 chain 分支加 policy.s2 限幅（现在只被 8 ml/s 卡，§22.7 item 2）；④ sameScalarAdaptiveEvidence / sameStage3Shape 的相等判据放宽到半个档位 0.03125，或直接删掉严格相等路径让 s2NearbyEvidence / stage3ReferenceEvidence 的 0.5–2× 折算成为唯一判据；⑤ target 比例 0.5–2× 失配时改成调用已有的 rescaleOverridesForTargets 做一步过渡，不要整套作废；⑥ startupMetricAllowed 上界放宽到 +25% 或删掉上界只留下界。

验收：用真机 history JSON 回放证明三套估计统一后下一杯 S2 指令的收敛方向与真机所需一致（当前所需约 4.1 ml/s，实测 r_obs=1.2174）；不变量测试证明 spread 超限的前馈不参与、chain 分支受 policy 限幅。交叉验证 + 校准 + 记台账。发版走完整流程。**不要碰 S2 补水段与杯内 liveTrimTick。**

---

## cut 9 · 不要新开对话

补水收尾（R-5 学习窗在「收回未确认」时三处退回无窗口的洞、R-7 一组小问题、F2 沉降窗口径）**归原审查对话所有**，等 §10.2 的两段收口在真机验证过之后由它做。其它对话不要碰 plugin.js 常量区横幅注释里列出的那些符号。

---

## cut 10 · 文档与自检收口（最后做）

任务：把技能与仓库文档跟代码对齐。① 技能 §22.7「现状与设计的差距（待改清单）」按各 cut 落地情况重写，已修的移走并记版本号；② §22.4 的动作集 / 前瞻窗 / 静默间隔与代码实际值对齐（cut 1–3 会改这些）；③ §22.5 补一条 cutoffPercent 的新语义（噪声底 0.6×X%，收回判据 predicted ≥ 100% 目标），并决定 UI 滑块标签怎么改（现在仍叫「称流速收回阈值」）；④ §22.11 里「r=1 是错的」那句按台账修正为「r 是命令的函数：灌水区 ≈1，平台区 ≈1.23」；⑤ README 里 S3 非递减的文案（cut 7 之后）；⑥ README 的 2.2.7 小节里「两段收口已回退等确认」那句已过期，正确内容在 HANDOFF_v0227.md 第 8 节，同步掉；⑦ HANDOFF_2026-11-01.md 第 3 节「若显示空粉碗 LUT 说明没找到记忆」的诊断口径在 2.2.7 已恢复可用，注明；⑧ 技能里的仿真准确度台账补上各 cut 的记录。

先读：技能 §19–§22 全文（含台账）、审查文档全文（尤其 §9 / §10 / §11）、HANDOFF_v0227.md、README.md 的 2.2.6 与 2.2.7 小节。这一条只改文档，不改 plugin.js 与测试，不需要发版号，但要在审查文档 §9 的状态表里把每条标成已改并记版本号。改完把改动清单报给用户。

