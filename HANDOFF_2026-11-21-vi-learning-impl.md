# d Vi 杯间学习改码批交接（2026-11-21，2.2.59 候选，触记忆已授权，改码不发版）

> 派单：统筹 01a1f8e8-499f-7513-a9cd-84b3af28bb14（relay-8）11-21。用户裁 Q1–Q11 全按统筹推荐，含 Q11 触记忆授权改码；「做完再一次发版」＝d 完成＋统筹独立复核过后 b/d 合并 2.2.59 发版一次（发版链统筹核过后另派 relay-2 执行，**本批只改码不发版不 push 不 tag 不装机**）。设计规格＝[HANDOFF_2026-11-21-vi-learning-design.md](HANDOFF_2026-11-21-vi-learning-design.md)（01a1fb8e 提案批，统筹审过）。基线 **09f8b43**（b 终：VI_A 34.057／VI_B −32.251 固定，rmse 0.086）。git 四件事已做；别人 WIP HANDOFF_2026-10-31.md（M）不碰。
>
> 一句话现状：**桶 vi 行＋七质量门＋非对称 EWMA＋置信消费＋完整指纹门＋restore vi 撤销全落地**，r 机制／律结构／clamp／holdMs／FC0／决策点时序／其余机制零改。verify_v02259 **937/937**（927＋10 vi 套件）＋sim **5/5**；130 杯离线顺序回放（律复刻 41 杯零误差）：**批1 预测口径 11/11 零静默欠流**、25 杯学习注入全结构门过、**当前 4 干净杯 Vi 隔离写序列逐字不变**、排除管线核全不学。**两项如实呈报不硬凑**：批1 真值口径 4 杯残余欠流窗（Q1「量化有害退 B 须先问」呈裁）；era 过渡窗学习 rmse 0.309（成熟 0.179、律素材门 0.086 保持）。微簇门为达成「杯23 在线拒」的标定补充（neg/dt0 门不足以拒杯23），待统筹审。

## 1. 机制实现（plugin.js，新增并列不改 r）

| 位置 | 改动 |
|---|---|
| 常量区（VI 律常量后） | S2_VI_LEARN_STORAGE_MIN/MAX=12/40、USED_MIN/MAX=15/40、ALPHA_UP/DOWN=0.5/0.15、DEV_ALPHA_UP/DOWN=0.55/0.3、WETLAT_MIN/MAX_S=0.8/8、NEG_MAX=2、DT0_MAX=5、CLUSTER_MAX=100、BRIDGE_GAP_S=2（各带标定出处注释） |
| normalizeGainMemory | vi 行解析＋[12,40] 带校验（外值进 dropped[]，GAIN_R 同款）；vi-only 桶存活（stages 空＋vi 有→保留）；旧档无 vi→null；r 行解析逐字未动 |
| 新增 viConfidence | HIGH n≥3 dev≤15%／MEDIUM n≥2／LOW n=1；censored 封顶 MEDIUM（gainConfidence 同构） |
| 新增 viMemorySuggestion | 读侧路由：regime 有→run.gainMemoryBucketId／selectGainBucket；无（stage2 入口常态）→lastBucketId（Q10 旧桶先验）／s1OutflowHint high→最高中心桶（封顶 LOW）；完整 fpKey 门（不符→LOW）；返回 vi/n/confidence/fpKeyMatch/deviationPct/censoredN/routedBy |
| 新增 viObservation | 杯末 Vi_obs 测量＋七门（§2）；Vi_obs=wetLat_onset×flood_actual（trace boost commandMlS 非 plan）；Q9 预留 fc=FC_FACTOR×platform（今 0） |
| 新增 updateViMemoryFromRun | 非对称 EWMA 更新（§3）；与 r 共享 g 桶（selectGainBucket/createGainBucket/LRU 复用）；r 已触桶时 vi 不重复维护 center/radius，vi-only 桶自维护；fpKey 变更 reseed n=1；memory.lastBucketId 更新 |
| refillAdaptiveFloodDecision | viLaw 先算（律 clamp[15,36] 不动）→vi_used 消费（HIGH 全量/MEDIUM 0.5 半混/LOW 律，夹[15,40]，fpKey 门，viExtrapolated/无 soak 不消费）；下游 F_budget/max/clamp/holdMs 结构逐字未动；返回加 viLawMl/viUsedSource/viLearning |
| adaptiveReplanAtStage2Entry | soak-wetting trace 加 viLawMl/viUsedSource/viLearning（取证可验消费来源） |
| rememberAdaptiveEvidence | truthVerified 块内 r 更新后调 updateViMemoryFromRun，ev.viMemory 随证据持久化（persistHistoryFile 原子写）；state.liveTrim.run 匹配时记 vi-learning trace（杯末，无杯内竞争请求） |
| restoreGainMemoryFromSnapshot | excludeRunId 贡献者检查扩 vi.lastRunId（Vi-only 坏杯可撤销）；快照 vi 经 normalize 校验原子回滚；杯记录保留标排除（既有 setLearningHistoryReview） |
| gainMemoryRestoreSummary | 加 vi 摘要（vi/n/dev/confidence/lastRunId/fpKey） |

**红线零改**：flood 律结构／clamp[15,36]／holdMs[2000,7000]默认4000／FC_FACTOR=0／决策点 stage2 入口时序／soak 六拒收门／禁 S1 出流族／Va/Vb3/Vd15/O1/cutoff predicted 主判/backstop 0.85/两段收口/Q2 平滑链／硬包线 0.10–8.00／sent 恒 false／LUT／单一写者／gain-memory r 机制（偏差/路由/LRU/restore/numeric 指纹）／归档 rawScaleSamples。manifest 本轮零改（2.2.59／descLen 275）。

## 2. 七质量门＋微簇门补充（viObservation）

1. learningRunAllowed＋trustedAdaptiveRun（caller 钩子）＋basket coffee。
2. soakWettingObservation.available（六门）＋ratio∈[0.2,0.8]（viExtrapolated→不学只用律＋旗标）。
3. onset 检出置信：stage2CupOnset.detected（r²≥0.85/slope≥max(0.05,target×1%)/0.6s 断档 reset 算法内置）；**桥接空档**：stage2 相邻 scaleTimestampSeconds 间隔>2s→拒（HEC WS 停摆级空洞）。
4. 秤噪点门：全杯 neg≤2、dt0≤5、**微簇≤100**（相邻 stamp 间隔∈(0,0.06s) 计数）。
5. 合理带：Vi_obs∈[12,40]ml、wetLat∈[0.8,8]s（拒 0.28/1.0/157/308 垃圾值；批1 杯 1794395116314-10 onset 误报 0.148s→Vi_obs 1.01 被拒）。
6. 截尾：onset 晚于 bleed（无 bleed 用 startup-complete）→censored=true，alpha 减半收录（Q5，偏差朝安全方向）。
7. 固定挡：floodMode=fixed 收录并旗标；manual stage2CommandOrigin 不阻（Q8，Vi 是粉饼量非命令增益）。

**微簇门补充（待统筹审）**：设计 gate 4 原为 neg≤2/dt0≤5，但**杯23 原始流实测 neg=2/dt0=1**（污染形态是 100Hz flush 微簇，非 dt0/neg），计数门不足以拒。130 杯归档标定：微簇计数干净杯最大 65（杯16）、杯23=257，阈值 100 干净分离零误伤。补微簇门后杯23 在线即拒（scale-noise-cluster），去尖峰值仅律拟合用（用户批例外）。这是达成派单「杯23 原始流在线拒」硬要求的标定补充，非红线冲突，呈统筹审。

## 3. 更新律＋消费（Q2/Q3/Q4/Q7）

- 非对称 EWMA：vi←vi+α(Vi_obs−vi)，round2。α_up=0.5／α_down=0.15；dev>15%→α 0.55(up)/0.3(down)＋lastLocalVi=Vi_obs（置信经 viConfidence 结构降一级）；damped（neg>0 或 dt0>0，微噪）减半；censored 减半。
- 置信消费：HIGH 全量／MEDIUM 0.5×学习＋0.5×律／LOW 律（存而不用）；vi_used 夹[15,40]（**不低于律下限 15＝不欠流**，上界 40 留 era 余量）；律输出 viLawMl 仍夹自己的[15,36]。
- 完整指纹门（O1 同款 adaptiveHistoryFingerprintKey：校准身份＋LUT 点＋targets＋weights/limits＋release＋温度）：消费时 fpKey 不符→回律（置信视同 LOW），**存储行不写不动**；下次杯末更新 fpKey 变更→reseed n=1（~3 杯重新成熟，期间律兜底，b 律偏保守方向安全）。Vi 是命令-毫升量（wetLat×flood）非比值，重标定漂移，故严于 r 的 numeric 指纹。
- 冷启动：新桶/vi=null/LOW/fpKey 不符/无 soak→律 b；无 soak→兜底 24.8 不消费学习值；冷启动无参照 flood5 不动。

## 4. 验证回执

- **verify_v02259 937/937**（tests/RESULTS_v02259.txt）：927 基线（含 b 批 6 处重编码＋5 杯素材门）＋10 vi 套件：normalize vi 带/vi-only 桶/旧档兼容；七门逐拒收 reason（含微簇/桥接/截尾/固定挡）；**真杯交叉**（杯21/22/24/25 onset Vi_obs 与素材 viImplied 差≤0.05、wetLat 差≤0.02；杯23 原始流 scale-noise-cluster 在线拒）；非对称 EWMA 公式/dev 门/lastLocalVi/截尾减半/微噪减半；置信消费 HIGH/MEDIUM/LOW＋[15,40] 夹带＋地板抬升；完整指纹拒（消费不写存储）＋reseed；冷启动/域外不消费；restore vi-only 撤销（贡献者/快照带校验/记录保留）；杯末持久化＋vi-learning/soak-wetting trace；Q10 旧桶先验＋律结构源码钉（34.057/−32.251/15/36/FC0）。**5 杯素材门 rmse 0.086≤0.30 保持**（律值口径，真杯交叉禁镜像）。
- **sim-regression 5/5**；node --check plugin.js/verify 通过；manifest 2.2.59 descLen 275 不变。
- 钩子表补 viConfidence/viMemorySuggestion/viObservation/updateViMemoryFromRun（测试访问）。

## 5. 130 杯离线顺序回放（__d20-vi-learn-replay.cjs／.json）

仿真注记（设计 §3.8）：run 指纹对齐当前校准以演示 era 吸收（离线仿真非在线证据；在线 fpKey 门由 verify 单独验）；r＋vi 同钩子顺序跑（桶既有 r 又有 vi，同线上）；决策反事实用 stage2 入口代理（soak+stage1 前缀、无 stage2 尾签名→lastBucketId 路由，与真机决策点一致）。律复刻（a/b 反事实用）对插件 b 输出 41 杯校验**零误差**。

- 83 杯有 fullRecord，**32 杯学成**，51 杯排除。桶终态：g3 center 0.324 vi 16.23 n7 HIGH／g4 0.527 vi 19.26 n1 LOW／g5 0.199 vi 13.68 n2 MEDIUM／g6 0.414 vi 15.64 n19 HIGH（当前 era 主桶）／g7 0.717 vi 24.5 n4 HIGH（批1）／g8 1.059 vi 26.77 n3 MEDIUM（批1 截尾封顶）／g9 1.388 vi null。
- **排除管线核**：universe 7 全不学（stress 5 在线 learning-not-allowed 即拒＋杯23 scale-noise-cluster 在线拒＋abnormalPrereqRerun 1 在线门过→**离线 universe 强制排除**，标记不删三管线同口径）；integrity-false/非 trusted 8 杯不学；门拒 36（vi-extrapolated 31／wetlat-band 2／vi-band 1／scale-noise-neg 2）。
- 逐桶 prior→learned 轨迹／dev 门触发／置信迁移／截尾收录／era 切换首杯行为见 JSON traj（32 条）＋decisions（含 a/b/b+d 选笔 hold binding）。

## 6. 批1 不欠流（验收门①）

**预测口径（派单验收门）：批1 合格 11 杯 predicted b2b≤holdMs 11/11 全过，零静默欠流／零 infeasible。**

**真值口径（设计 §4 强准则，true b2b=(ViObs+4.59)/flood−0.274）：7/11 过，4 杯残余欠流窗（如实呈报）**：

| runId | ratio | ViObs | b+d flood/hold | 预测 b2b | 真值 b2b | 超 hold | 根因 |
|---|---|---|---|---|---|---|---|
| 1794311272562-5 | 0.4627 | 22.22 | 6.625/3000 | 2.895 | 3.773 | +0.77s | Q10 批1首杯，MEDIUM 半混旧 era 低先验 |
| 1794437908164-11 | 0.3504 | 25.03 | 6.5625/4000 | 3.893 | 4.240 | +0.24s | 路由空档（viLearning null→律 b），A 键交错 |
| 1794526329036-2 | 0.2442 | 25.40 | 6.8125/4000 | 3.864 | 4.128 | +0.13s | learned-high g7 vi 23.66 < 律 26.18（EWMA 滞后低于真值） |
| 1794617558035-4 | 0.3777 | 23.53 | 6.0/4000 | 3.888 | 4.413 | +0.41s | MEDIUM 半混把 vi 拉到 rise 地板 |

（1794395116314-10 onset 误报 ViObs 1.01 无效，vi-band 拒学，真值口径不计；stress 排除杯 1794438954177-13/1794439491260-14 不在合格 11。）

- **设计算例杯 1794351268936-8 确认修复**：b 律真值 4.27s>4.0 欠流 → b+d 学习 Vi 26.6 flood 8 hold 4100 真值 3.63s≤4.1 可行＋余量（靠抬 flood 缩短润湿＋上升，非抬 holdMs）。
- b-only 对照同 11 杯真值 3 杯欠流（2562-5/908164-11/558035-4）；b+d 修了算例杯但 329036-2 因学习滞后新增欠流——**学习未均匀改善批1真值不欠流**。
- **呈裁（用户 Q1 原文「离线回放量化有害退 B 须先问」）**：A 键同签名跨 era 混桶＋lastBucket 路由滞后＋MEDIUM 半混上行慢，在批1真值口径量化出 4 杯有害窗。是否退桶键 B（ratio 带独立桶）或加过渡守卫，**呈统筹/用户裁，本批不自行取舍**。预测口径验收门已过，安全包线（holdMs 自抬响应预测＋硬包线）兜底；真值窗属 Q10 接受的首杯/过渡代价范畴但量级呈报。

## 7. 25 杯决策级回放注入学习 Vi（验收门③）

成熟记忆（130 杯顺序跑后）注入 25 杯（批1 13＋批2 12，full-run regime 路由）：**rise 地板永不破（flood≥6）／flood∈[3.5,8]／hold∈[2000,7000]／predicted b2b≤holdMs 全过／零 infeasible／零 extrapolated**。选笔/旗标见 JSON rep25。

## 8. 5 杯全量写序列回放（验收门②，Vi 隔离成对）

__d19-writeseq5 同款真实样本＋真实 soak 前缀；**成对隔离**：每杯同一 r 记忆，基线剥 vi 行 vs 学习带 vi 行，任何写差异只归因 Vi。

| 杯 | boost | 非 boost 笔 | oq/observedR | holdMs 基线→学习 | status |
|---|---|---|---|---|---|
| 21 | 逐字相同（6.0） | **逐字相同** | 不变 | 3900→3800 | complete |
| 22 | 逐字相同 | **逐字相同** | 不变 | 3700→3800 | complete |
| 24 | 逐字相同 | **逐字相同** | 不变 | 3600→3800 | complete |
| 25 | 逐字相同 | **逐字相同** | 不变 | 3600→3800 | complete |
| 23（噪点杯） | 逐字相同 | bleed/return **晚 250ms**（命令 1.4375/4.0625 不变） | 不变 | 3600→3800 | complete |

**当前 4 干净杯（21/22/24/25）学习 Vi≈律→非 boost 笔逐字不变／oq／observedR 不变／全 complete ✓**。杯23 收口时序移动来自 holdMs 3600→3800（学习 vi 16.09 vs 律 15），命令值不变；杯23 是 scale-noise 排除杯，非「当前 4 杯」验收范围，注记呈报。

## 9. 当期 wetLat rmse（验收门「当前 4 杯 rmse≤0.30 保持」）

- **律素材门（verify，无记忆）：0.086s ≤0.30 保持 ✓**（b 拟合口径，真杯交叉）。
- 成熟记忆学习消费（ws 成对，era 吸收后）：vi_used 16.12/16.12/16.09/15.84 → rmse **0.179s ≤0.30 ✓**。
- **era 过渡窗（130 杯顺序回放，当前首杯消费批2桶先验）**：vi_used 17.73/17.49/17.25/15.7 → rmse **0.309s（+0.009 超门，如实呈报）**——批2→当前过渡先验偏高 ~1.5ml，过预测＝安全方向（不欠流），Q10 首杯窗，~3 杯吸收后回 0.179。不硬凑。

## 10. 待批／风险／后续

1. **Q1 退 B 呈裁**（§6）：批1真值 4 杯有害窗量化，退桶键 B 或过渡守卫须用户/统筹裁，本批不自行取舍。
2. **微簇门标定补充**（§2）：neg/dt0 不足拒杯23，微簇≤100 补之（干净 max 65/杯23 257），待统筹审。
3. **技能补注待审**：§22.19 末 d 学习补注＋§22.3 末 Vi 行补注（只加不改现有文本，新机制口径＋用户 11-21 裁定引用）。
4. **era 过渡 rmse 0.309**（§9）：安全方向过预测，Q10 窗，成熟 0.179；呈报。
5. **峰≤40%**：verify 闭环套件峰≤40% 全过（937 含）；设计 §4 批1学习 flood 抬升峰代价 +11pp 仍 ≤40%（批1历史峰 0.1–26.6%）；闭环真值须真机陪杯。
6. **fc 学习批**：d 先 fc 后依赖序——Vi 标定（b）＋Vi 学习（d）已落，fc 批触记忆仍须用户另批；FC_FACTOR>0 时 Vi_obs=wetLat×(flood−fc) 已预留。
7. **APK 移植同步债**：桶 vi 行＋七门＋非对称 EWMA＋完整指纹门＋restore 扩展 → shadow/arbiter，full→hec 里程碑一次移植（与 2.2.56 新律/b 系数/scaleSampleGate/Va/Vb3/Vd15/O1 债合并）；APK 无 soak 样本流则 Vi 学习 inert（冷启动兜底）。
8. **真机陪杯**（发版装机后）：Vi_obs trace vs 预测、≥3 杯 era 吸收轨迹、零 holdMs 超时/峰≤40%/rise≤0.9s/whole 不劣化、固定挡收录验、restore vi 撤销验（用户批测试杯）。

## 11. 坑（本批踩过）

1. **各 harness env 校准身份 createdAt 不同→完整 fpKey 不同**：离线回放跨 env 携带记忆须对齐 vi.fpKey 到目标 env（仿真口径，设计 §3.8）；在线 fpKey 门由 verify 单独验。
2. **r＋vi 须同钩子跑**：只跑 vi 学习→桶无 r 行→写序列 env 平台借不到 r 塌到 profile base（return 3.875→2.5 假差异）。主回放 updateGainMemoryFromRun＋updateViMemoryFromRun 同跑（同 rememberAdaptiveEvidence 序）。
3. **写序列归因须成对隔离 Vi**：基线剥 vi 行 vs 学习带 vi 行、同一 r 记忆，否则 r 学习差异混入。
4. **杯23 污染是微簇非 dt0/neg**（neg2/dt01 过计数门）：微簇<60ms 计数门补之（阈值 100 标定）。
5. **夹具默认 closeS 3.3 使高 wetLat 杯意外截尾**：EWMA/era 测试须显式 closeS>wetLat 才非截尾；neg 注入须隔样（连续 dip 增量抵消）。
6. **verify 作用域无 plugin round()**：测试用本地 vround。
7. **apply_patch hunk 须按文件位置递增**（向前搜索）；exec 模板字符串内禁反引号与美元花括号插值符（runner 锚点用无反引号前缀）。
8. **soakSignature 名义 ratio 与插件实测有 ~0.02–0.04 偏移**（p0 前 5 片中位）：断言用行为/区间不用钉值。

## 12. 复跑索引／工作区

- cd decenthyperexplugin.reaplugin && node tests/verify_v02259.cjs（937）
- cd D:/vscode/decenthyperexplugin && node sim/tests/sim-regression.cjs（5）
- node D:/vscode/.tools/__d20-vi-learn-replay.cjs（130 杯顺序回放＋反事实＋批1表＋25 杯注入＋5 杯成对写序列，写 __d20-vi-learn-replay.json）
- node D:/vscode/.tools/__d20-vi-learn-scan.cjs（提案批只读扫描，__d20-vi-learn-scan.json）
- 数据：hyperex-history-all.json（130 杯）／vi-refit-material.json（5 杯）／universe-exclusions.json／history-18（杯21/22/23）。
- 探针 .tools/__d20-*（untracked 不入库）；本批 commit 仅 plugin.js／tests/verify_v02259.cjs／tests/RESULTS_v02259.txt／README.md／本交接（manifest 零改）。
- 别人 WIP HANDOFF_2026-10-31.md（M）不碰不提交不回滚；APK 仓/取证功能区不碰；记忆数据不删改（restore 撤销除外）；归档 raw 不改。
- **未发版/未 push/无 tag/未装机**；发版由统筹核过后派 relay-2（用户已预授权 b/d 合并 2.2.59 发版一次）。
