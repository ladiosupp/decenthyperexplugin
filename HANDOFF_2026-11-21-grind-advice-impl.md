# 2.2.59 研磨建议 P0＋R7 细化 · 实施交接（2026-11-21，用户裁 Q1–Q7 全按推荐，改码本批授权）

> 统筹 relay-8（01a1f8e8-499f-7513-a9cd-84b3af28bb14）派单。设计规格 [HANDOFF_2026-11-21-grind-advice-review.md](HANDOFF_2026-11-21-grind-advice-review.md)（01a1fb99 提案批统筹审过）§3/§4 P0 R0–R6＋R7、§5 逐杯证据、§6 uneven 兼容、§7 验证方案。基线 e4283df（d-floor 终，链 a6ae73c→09f8b43→3adafd7→9749813→e4283df，本地未推）。**版本仍 2.2.59 候选（合并发版波不单独升）；本批不发版不 push 不 tag 不装机**。

## 1. 一句话

grindAdvisory 按 P0＋R7 重写：status 词表＋阈值冻结，只加性字段 evidence/subtype/suggestedDirection/confirmation；uneven&&high 置顶、非完成杯 incomplete 门、近带 8–12% 微建议、原因分诊注记、证据驱动置信、幅度带文案、两杯确认严格守卫（读历史不写记忆）、coarse/fine 须 S2 尾参与。130 杯回放可用杯状态零迁移（仅故障门），uneven 集合 [83,105,121] 逐字不变，verify 954/954。

## 2. 改动清单（只改 grindAdvisory＋verify＋README＋技能 §22.14）

- **plugin.js grindAdvisory**（原 5541–5576，重写后函数体加长，锚点 rg "function grindAdvisory"）：
  - **R0**：分支顺序 uneven&&high 置顶（先于 coarse/fine）；coarse-uneven 字符串退役，rel≤−8 的偏粗子型进 subtype="coarse-uneven"＋detail 注记。归档 0 使用，APK 泛化显示兼容。
  - **R1**：fault（execution-fault→aborted）门后增非完成杯门：result 不匹配 /^completed at /i → available:false, status:"incomplete", hold, LOW「本杯未完成：研磨建议不适用，先查执行/压力/通道」。aborted 原样保留。
  - **R2**：high/low 且 8≤|rel|<12 → status 不变 flow-high/low，label「流量偏高/低，阻力略低/高（X%，接近 12% 阈值）：先查粉量/指令；连续两杯同向再调细/粗半档」＋suggestedDirection=finer/coarser（按 rel 符号）。滞回本期不做（阈值冻结）。
  - **R3**：detail 按序拼接分诊注记——①gm.local&&deviationPct≥15→「本杯指令偏离学习中心 X%（base 纠正中），流量偏差优先归因指令/base；下一杯纠正后再评估研磨」；②阶段归因（S2-only/S3-only「先查 S3 形状/指令，研磨嫌疑低」/同向）；③gm.stale||fallback|||rel|>50→「参考桶可能不匹配当前纸/豆 regime（stale/cross-bucket/rel X%），阻力对比仅供参考，先核 regime」；④uneven&&!high→「S3 late/early X<0.80（或 S2 尾 CV X≥15），布粉可能不均；流量未偏高，先观察」（status 不变，保 B 子形≠uneven；措辞「流量未偏高」兼容 hold 与 flow-low，规格原文「流量还在带内」对 flow-low 杯不准确，取准确措辞）；⑤flow-high/low detail 末追加 TDS 固定文案「若本杯 TDS 命中 3.5±0.2，研磨大概率合适，流量偏差先查粉量/指令（TDS 联合判定见 HEC 总结页·确认重算）」（插件无 TDS 口径）。
  - **R4**：置信证据驱动——LOW：uneven/桶 LOW 或 n<3/无桶/stale/fallback/local dev≥15/|rel|>50（aborted/incomplete 早退 LOW）；MEDIUM：健康桶单杯（hold 默认）；HIGH：仅 R6 确认成立＋桶 HIGH n≥8＋非 stale/local（归档 0 触发，本期闲置）。evidence 串「桶 gN nX CONF [local devY%] [stale] [cross-bucket] · 单杯/两杯确认」。
  - **R5**：coarse/fine label 幅度带 |rel| 12–20 半档／20–35 一档／>35「阻力偏差过大：先确认纸/豆/桶匹配，再谈研磨」（不给档，status/direction 不变；仅文案，无研磨真值）。
  - **R6**：读 state.persistentHistoryFile.shots 上一杯（按 runId 定位 idx，未入库取末条；只读不写）。守卫：本杯与上杯均 flow-high/low/resistance-shift＋rel 符号同向＋两杯 8≤|rel|≤35＋两杯非 stale/fallback＋同 bucketId＋上杯 ga.available 且 status∉{uneven,coarse-uneven,aborted}＋上杯 s2.status≠MISS＋上杯 learningIntegrity.eligible≠false。成立→label 追加「连续两杯同向（X%→Y%，桶 gN），建议微调半档」＋confirmation={confirmed,prevRunId,prevRelPct,relPct,bucketId}＋置信升 HIGH（若桶 HIGH n≥8）。不成立静默（confirmation:null）。
  - **R7**：coarse 需 s2Err≥4、fine 需 s2Err≤−4（S2 尾参与）；S3-only 偏差落 flow-high/low＋R3 阶段分诊。
  - **加性字段**：evidence（总是串）/subtype（仅 uneven 偏粗子型，余 null）/suggestedDirection（仅近带，余 null）/confirmation（仅确认成立，余 null）。原有字段（available/status/direction/label/confidence/s2Pq/referencePq/relPct/s2TailErrorPct/s2TailCvPct/s3TailErrorPct/s3LateToEarlyRatio/detail/basis）语义不变；no-usable 早退补 status:"no-usable"（词表明示，原无 status 字段，加性）。
- **tests/verify_v02259.cjs**：grindRun fixture 补 result:'completed at 100 g'（原 fixture 无 result，R1 门会误伤 3 条老测试；6 条老断言 status/direction 钉一字未动）；＋15 条新测试（§4）。
- **tests/RESULTS_v02259.txt**：实跑输出重生成（954/954）。
- **README.md**：2.2.59 段加研磨 P0＋R7 段（d-B 段后、2.2.58 段前）。
- **技能 §22.14**：末补注（只加不改，待统筹审）——P0＋R7 全规则＋用户 11-21 裁定引用＋回放不变性＋纯建议核实＋APK 同步债。
- **manifest.json 零改**（2.2.59/descLen275，description 发版批按 §1.15 定）。

## 3. 没动什么（红线）

- **uneven 签名语义冻结**：合取（s2Cv≥15 OR lateRatio<0.80）＋high→status "uneven" 逐字未动；A/B 子形分类不变（回放＋8 杯真杯交叉证）。
- **纯建议性质**：grindAdvice 消费点 rg 核＝diagnosticSummary（5676）／历史 shot JSON（4654）／诊断页琥珀块 renderNextDecision（6938，仅显示）＋R6 读历史（5617）；控制律/记忆/写入零消费。
- 律结构／r 机制／d-floor 消费／Vi 学习／记忆不删改／归档 raw／硬包线／sent／单一写者／Q2 全零改（diff 仅 grindAdvisory 函数体）。
- §0 杯末算：grindAdvisory 只在杯末 diagnosticSummary/历史落盘调用，无杯内请求；R6 只读已持久化历史。
- 别人 WIP（HANDOFF_2026-10-31.md M）不碰不代提交；.tools 探针 untracked 不入库。

## 4. 验证

- **verify_v02259 954/954**（939 基线全绿含 6 条老 grind 钉＋15 新增，禁镜像）：近带高侧/低侧/低于 8% 无 hint／R7 S3-only→flow-low＋阶段分诊／local dev 分诊＋LOW／regime 极值警告＋LOW／带内 uneven 注记不改 status（合成 le 0.5）／R0 uneven 优先级（合成 rel −35.5＋high＋le 0.625→uneven＋subtype）／R5 幅度带四档／R1 incomplete 门＋aborted 优先／R6 合成两杯同向确认 HIGH＋只读断言（shots 与桶学习值不变）／R6 七守卫拒（MISS/uneven/异桶/|rel|>35/stale/eligible false/incomplete）／R4 immature LOW＋证据串／no-usable 词表／**8 杯真杯交叉**（history-all fullRecord 重建 run＋归档 gm 桶，当前代码复算：杯 16 uneven／杯 17 flow-high／杯 19 flow-high／杯 21 hold／杯 22 flow-high／杯 23 flow-high（scaleSampleGate 去噪后 s2Err 7.71 仍≥4 分类稳健）／杯 24 flow-low／杯 25 flow-high，relPct 与归档差≤0.15）。
- **sim-regression 5/5**；node --check plugin.js/verify 通过；manifest JSON 合法 2.2.59/275（verify 钉）。
- 合成 S3 形状夹具 gaRunS3：14s 分段线性重量（EARLY [2,5) / LATE [11,14] 斜率可控），stage3StabilityDiagnostics 去首 2s span>6s 条件满足，le 精确可控。

## 5. 离线回放回归（__ga-review-replay.cjs --r7，130 杯归档，取证 D:/vscode/.tools/__ga-p0-r7-replay-output.txt）

**迁移表（与规格 §5.4 逐字吻合）**：flow-low 18→18／flow-high 16→16／hold 8→7／fine 4→flow-low（R7：75/76/90/115 全 S3-only）／resistance-shift 3→2／uneven 3→3／aborted 2→2／X:no-usable 3→X:incomplete／resistance-shift→X:incomplete 1（杯 84 skipStep 失败）／hold→X:incomplete 1（杯 98 压力中止）。**可用杯状态零迁移（仅故障门 2 杯＋no-usable 3 杯）**。

- **uneven 集合 before=after=[83,105,121] IDENTICAL=true**；A 签名杯 121（杯 16）uneven LOW 不变＋dev26.4 分诊；B 子形杯 124（杯 19）flow-high MEDIUM ≠uneven＋S3-only 分诊；重跑杯 122（杯 17）flow-high LOW ≠uneven＋近带 −9.1＋dev16.3。
- **置信重分布**：before LOW42/MEDIUM12/无3 → after MEDIUM31/LOW26/HIGH0（HIGH 需确认，归档 0，诚实闲置）。
- **R6 confirmed 0／guarded-reject 1**（杯 99 上杯非完成拒；杯 122 上杯 121 MISS 拒；杯 75→76 假确认被 |rel|≤35＋非 stale 守卫拦——机制 inert 待真机样本）。
- 关键杯：杯 24 近带 +11.4 flow-low LOW＋dev24.6 base 分诊；杯 25 近带 −9.4 flow-high LOW＋dev19；杯 22 S3 5.61 分诊 MEDIUM；杯 23 dev23.7 分诊（去噪后分类稳健）；杯 76/90 regime 伪影 fine→flow-low LOW＋「阻力偏差过大 +95.4/+216.8%」警告；杯 94 带内 uneven le0.783 注记不改 status；杯 21 hold MEDIUM 不变。

## 6. 坑（本批特有）

1. **grindRun fixture 无 result**：R1 门会把 3 条老 coarse/fine/hold 测试打成 incomplete——fixture 构造器补 result:'completed at 100 g'（断言不动）。改 grind 测试先查 fixture result。
2. **R6 只读断言 vs gainMemoryState 归一**：gainMemorySuggestion→gainMemoryState(false) 会原位 normalizeGainMemory（补缺省字段如 lastRunId:null），整份 file JSON 前后不等是既有行为不是 R6 写入；只读断言钉 shots 全量＋桶学习值（r/n/dev/obs/center/radius/lastRunId，undefined 与 null 归一）。
3. **近带 label 自带「连续两杯同向再调X半档」（R2 文案）**：守卫测试断言 R6 未触发须匹配确认特有模式「连续两杯同向（」（带括号数值），不能用泛词。
4. **tailErrorPct round 2 位**：coarse fixture s2Flow 5.2→s2Err 恰 4.00 过 R7 门（≥4）；若回归改 oq 舍入须复核此 fixture。
5. 真杯交叉重建 run 用归档 gm 桶（center/radius/smoothedR/n/dev）＋run.gainMemoryBucketId 强制桶；config stage2CommandMlS 只影响 bandR 不影响 center/pq/oq，交叉钉 status＋relPct 不钉置信（local 载体 lastLocalR 不在归档 gm 里）。

## 7. APK 同步债／待办

- **APK 同步债（hec 里程碑）**：新字段 evidence/subtype/suggestedDirection/confirmation 显示更新＋R6 confirmation 消费（本期 APK 不实现，派单明示）；与既有债（D1–D6/O1/Va/Vb3/Vd15/2.2.56 新律/scaleSampleGate/viBuckets＋地板）合并。TDS 联合层为 APK 原生（a27d2d6 已核），无插件对应物不需镜像。
- **发版**：待合并发版波（插件 b+d(B+地板)+研磨 P0+R7 合并 2.2.59 一次，用户预授权；条件＝本批统筹核过＋基线干净（UI12 WIP 先问））。本批不发版不 push 不 tag 不装机。
- **二期（用户裁 Q4 后续）**：pq 趋势 EWMA（触记忆须另批）／grindInput 历史漂移（APK 本地数据）／异常重跑杯 S1 识别。
- **真机**：R6 多杯确认需连续两杯同向近带（归档 0→随缘攒不压杯数）；TDS 真验需用户录≥5 杯（APK 侧）；通道杯机遇验 A/B 分类不变。
- 提案交接 HANDOFF_2026-11-21-grind-advice-review.md 仍 untracked（提交另问，派单口径）。

## 8. 复跑索引

- 回归：node decenthyperexplugin.reaplugin/tests/verify_v02259.cjs（954）；node sim/tests/sim-regression.cjs（5）。
- 回放：node D:/vscode/.tools/__ga-review-replay.cjs --r7（素材 D:/vscode/.tools/hx-data/hyperex-history-all.json 130 杯；取证输出 __ga-p0-r7-replay-output.txt）。
- 代码锚点：rg "function grindAdvisory" plugin.js；消费点 rg "grindAdvice" plugin.js（4654/5617/5676/6938）。

