# d Vi 学习退 B 键重做交接（2026-11-21，2.2.59 候选，用户裁①，改码不发版）

> 派单：统筹 01a1f8e8-499f-7513-a9cd-84b3af28bb14（relay-8）11-21。用户裁①退 B 键重做（Q1 条款：A 键批1真值口径量化有害）。改码本批授权（沿 d 批触记忆授权）；**发版/push/tag/装机另问**——B 重做统筹核过后 b/d(B) 合并 2.2.59 发版一次（用户预授权仍有效，统筹派 relay-2）。基线 **3adafd7**（d A 键实现，本地未推）；新 commit 叠上，版本仍 2.2.59 候选。A 键未发版无 live 数据，B 替换 A 原位改（normalize 对旧 A 格式 vi 行容错，无迁移）。git 四件事已做；别人 WIP HANDOFF_2026-10-31.md（M）不碰。
>
> 一句话现状：**B 键（soakP2sRatio 带独立 viBuckets）替换 A 键落地，d 批已验机制全沿袭只换桶键与路由**。verify_v02259 **938/938**＋sim **5/5**；130 杯回放（律复刻 47 杯零误差）：批1 **预测口径 11/11 零静默欠流（历史＋uniform 双基准）**、25 杯注入全结构门过、当前 4 干净杯 Vi 隔离写序列逐字不变、排除核全不学、律门 0.086／成熟~0.21／过渡 0.264 均≤0.30。**门①（批1真值不欠流）未达，如实呈报不硬凑**：b+d 历史 6 窗>b-only 4 窗、uniform 6 窗=b-only 6 窗但残余含 4 个学习消费窗非仅 Q10 首杯——带内跨 era 先验混合＋MEDIUM 半混上行慢＋learned-high 滞后低于真值，统筹预估退 B 修复 -2/-4/-11 未现。**呈裁**（带形状/消费策略改动须先问；发版决定需重议）。

## 1. B 键机制（plugin.js，替换 A 原位改）

- **常量**：S2_VI_BANDS=[[0.2,0.4],[0.4,0.6],[0.6,0.8]]（支撑域三等分；带形状属设计参数，改须先问）；S2_VI_LEARN_* 沿 d 批（storage[12,40]/used[15,40]/α_up0.5/down0.15/dev0.55/0.3/wetLat[0.8,8]/neg≤2/dt0≤5/微簇≤100/桥接>2s）。
- **emptyGainMemory/normalizeGainMemory**：gainMemory.viBuckets 独立数组（{bandLo,bandHi,vi,n,lastDeviation,lastObservedVi,lastLocalVi,damped,censored,censoredN,lastRunId,updatedAt,fpKey,floodMode}）；带校验 lo≥0.2 hi≤0.8 lo<hi＋vi[12,40] 外值 dropped＋按带去重＋LRU（updatedAt 降序 cap 3）；旧档→[]。**A 键 g 桶 vi 行移除**（bucket 恢复 r-only，stages 空桶丢弃；旧 A vi-only 桶容错丢弃，无 live 数据无迁移）。r 行解析逐字未动。
- **viBandFor(ratio)**：[lo,hi) 落带，末带 [0.6,0.8] 含 0.8；域外→null。
- **viMemorySuggestion**：按当杯 obs.soakP2sRatio 落带取 viBucket（**无 regime 签名依赖、无 lastBucket 滞后**）；空带→null→律 b（Q10 首杯律先验）；完整 fpKey 门（不符→LOW）；返回 bandLo/bandHi/routedBy="ratio-band"/vi/n/confidence/fpKeyMatch/deviationPct/censoredN。
- **updateViMemoryFromRun**：viObservation 七门（沿 d）→viBandFor(o.ratio)→memory.viBuckets 找/建带桶→非对称 EWMA（沿 d 公式）→fpKey 变更 reseed n=1→LRU。**不触 r g 桶/center/radius/lastBucketId/run.gainMemoryBucketId**（r 机制零改）；同带 era 漂移靠 dev 门＋非对称吸收。
- **消费**（refillAdaptiveFloodDecision）：viLaw 先算（律 clamp[15,36] 不动）→vi_used HIGH 全量/MEDIUM 0.5 半混/LOW 律，夹[15,40]，fpKey 门，viExtrapolated/无 soak 不消费；下游律结构逐字未动；viLearning 字段 bucketId→bandLo/bandHi。
- **restore**：excludeRunId 贡献者检查扩 viBuckets.lastRunId；快照守卫接受 viBuckets-only（B 下 vi 学习不建 g 桶）；快照 viBuckets 经 normalize 原子回滚；杯记录保留标排除。gainMemoryRestoreSummary 加 viBuckets 摘要（去 A 的 per-bucket vi）。
- **杯末钩子/trace**：rememberAdaptiveEvidence r 后调 updateViMemoryFromRun，ev.viMemory 持久化＋vi-learning trace；soak-wetting trace viLearning 带 bandLo/bandHi（沿 d）。

**红线零改**：flood 律结构/clamp[15,36]/holdMs[2000,7000]默认4000/FC0/决策点 stage2 时序/soak 六门/禁 S1 族/Va/Vb3/Vd15/O1/cutoff/backstop/两段收口/Q2/硬包线 0.10–8.00/sent/LUT/单一写者/r 机制/归档 raw。manifest 零改（2.2.59/descLen275）。杯末算无杯内竞争请求；记忆不删改（restore 撤销除外）。

## 2. 验证回执

- **verify_v02259 938/938**（RESULTS_v02259.txt）：927 基线＋11 vi-B 套件（normalize viBuckets 带校验＋旧 A 容错＋r 共存；七门逐拒收；真杯交叉杯21/22/24/25 Vi_obs≈素材±0.05/wetLat±0.02＋杯23 scale-noise-cluster 在线拒；非对称 EWMA 公式/dev/lastLocalVi/截尾减半/微噪减半；置信消费 HIGH/MEDIUM/LOW＋[15,40]＋地板抬升；完整指纹拒消费不写存储＋reseed；冷启动/域外不消费；restore viBuckets-only 撤销/贡献者/快照带校验/记录保留；杯末持久化＋trace；**带隔离 Q10**（新带空→律先验，无跨带泄漏）；**带边界 viBandFor**（0.399→[0.2,0.4)/0.4→[0.4,0.6)/0.6→[0.6,0.8]/0.8 含/0.81 域外）＋内点路由；律源码钉 34.057/−32.251/15/36/FC0）。5 杯素材门 rmse 0.086≤0.30 保持。钩子补 viBandFor。
- **sim-regression 5/5**；node --check plugin.js/verify 通过；manifest 2.2.59 descLen 275 不变。

## 3. 130 杯离线顺序回放（__d20-vi-learn-replay-b.cjs／.json）

仿真注记（设计 §3.8）：run 指纹对齐当前校准演示 era 吸收（离线仿真非在线证据；在线 fpKey 门 verify 单独验）；r＋vi 同钩子顺序跑；决策反事实用 stage2 入口代理（soak+stage1 前缀，B 按 ratio 落带）。律复刻对插件 b 输出 **47 杯校验零误差**。83 杯有 fullRecord，32 学成，51 排除。

**viBuckets 终态**：

| 带 | vi | n | 置信 | lastRunId |
|---|---|---|---|---|
| 0.6-0.8 | 15.37 | 12 | HIGH | 1795217090021-2 |
| 0.4-0.6 | 17.17 | 15 | HIGH | 1795162247267-2 |
| 0.2-0.4 | 23.08 | 9 | MEDIUM | 1794870069039-5 |

**排除管线核**：universe 7 全不学（stress 5 在线 learning-not-allowed＋杯23 scale-noise-cluster 在线拒＋abnormalPrereqRerun 1 在线门过→离线 universe 强制）；integrity/非 trusted 8；门拒 36（vi-extrapolated 31/wetlat-band 2/vi-band 1/scale-noise-neg 2）。逐带轨迹见 JSON traj（32 条）。

## 4. 门① 批1真值不欠流双基准（未达，如实呈报）

true b2b=(ViObs+4.59)/flood−0.274；合格 11 杯（stress 排除 2，ViObs 无效 1 杯 1794395116314-10 onset 误报 1.01 vi-band 拒学不计真值）。**预测口径 11/11 全过（历史＋uniform，零静默欠流/零 infeasible）**。真值口径：

| 基准 | b-only 过/11 | b+d 过/11 | b+d 窗 vs b-only |
|---|---|---|---|
| 历史 holdCfg | 7 | 5 | b+d 6 窗 > b-only 4 窗（**恶化**） |
| uniform 4000 | 5 | 5 | 6 窗 = 6 窗，但残余含 4 学习消费窗非仅 Q10 |

**逐杯双基准表**（b-only/b+d 各历史 holdCfg＋uniform 4000）：

| runId | ratio | ViObs | b-only 历史 flood/hold/真值 | b-only uniform | b+d 历史 flood/hold/真值 | b+d uniform | 消费 |
|---|---|---|---|---|---|---|---|
| 1794311272562-5 | 0.4627 | 22.22 | 7.75/3000/3.185 FAIL | 6/4000/4.194 FAIL | 7.75/3000/3.185 FAIL | 6/4000/4.194 FAIL | law 0.4-0.6 |
| 1794349686272-6 | 0.3361 | 26.56 | 8/3900/3.62 PASS | 6.6875/4000/4.384 FAIL | 8/3900/3.62 PASS | 6.6875/4000/4.384 FAIL | law 0.2-0.4 |
| 1794350648377-7 | 0.2912 | 28.29 | 8/4000/3.836 PASS | 7.125/4000/4.341 FAIL | 8/3000/3.836 FAIL | 6/4000/5.206 FAIL | learned-medium-blend 0.2-0.4 |
| 1794351268936-8 | 0.3139 | 26.64 | 8/3900/3.63 PASS | 6.875/4000/4.269 FAIL | 8/3000/3.63 FAIL | 6/4000/4.931 FAIL | learned-medium-blend 0.2-0.4 |
| 1794393997909-9 | 0.5842 | 18.42 | 6.125/3000/3.483 FAIL | 6/3700/3.561 PASS | 6.0625/3000/3.521 FAIL | 6/3600/3.561 PASS | learned-medium-blend 0.4-0.6 |
| 1794395116314-10 | 0.2287 | 1.01 | 8/4300/0.426 PASS | 7.6875/4000/0.454 PASS | 8/3800/0.426 PASS | 6.5625/4000/0.579 PASS | learned-medium-blend 0.2-0.4 |
| 1794437908164-11 | 0.3504 | 25.03 | 6.5625/4000/4.24 FAIL | 6.5625/4000/4.24 FAIL | 6/4000/4.663 FAIL | 6/4000/4.663 FAIL | learned-medium-blend 0.2-0.4 |
| 1794525779756-1 | 0.2912 | 23.17 | 7.125/4000/3.622 PASS | 7.125/4000/3.622 PASS | 6.75/4000/3.839 PASS | 6.75/4000/3.839 PASS | learned-medium-blend 0.2-0.4 |
| 1794526329036-2 | 0.2442 | 25.4 | 7.5625/4000/3.692 PASS | 7.5625/4000/3.692 PASS | 6.4375/4000/4.385 FAIL | 6.4375/4000/4.385 FAIL | learned-high 0.2-0.4 |
| 1794617112489-3 | 0.4736 | 19.35 | 6/4000/3.716 PASS | 6/4000/3.716 PASS | 6/4000/3.716 PASS | 6/4000/3.716 PASS | learned-medium-blend 0.4-0.6 |
| 1794617558035-4 | 0.3777 | 23.53 | 6.3125/4000/4.181 FAIL | 6.3125/4000/4.181 FAIL | 6.875/4000/3.816 PASS | 6.875/4000/3.816 PASS | learned-high 0.2-0.4 |

**b+d uniform 残余 6 窗**：1794311272562-5（law，Q10 首杯，+0.19）／1794349686272-6（law，Q10 首杯带空，+0.38）／1794350648377-7（learned-medium-blend，+1.21）／1794351268936-8（learned-medium-blend，+0.93）／1794437908164-11（learned-medium-blend，+0.66）／1794526329036-2（learned-high，+0.39）。**仅前 2 是 Q10 首杯律先验窗，后 4 是学习消费窗**→「仅剩 Q10」条款不满足。

**根因**：
1. **带内跨 era 先验混合**：低带 [0.2,0.4) 聚合批1慢润湿（ViObs 23–28）与批2/其他 era 低 ratio 快润湿杯（ViObs 16–20），终态 vi 23.08 n9 MEDIUM（被低值拉下）；批1杯决策时带先验更低（顺序早期 seeding）。B 消除了路由滞后与跨签名混桶，但 ratio 带仍聚合跨 era 残余。
2. **MEDIUM 半混上行慢**：n<3 或 dev>15% → MEDIUM → vi_used=0.5×learned+0.5×law，learned 偏低时半混把 vi 拉到律值以下→flood 降→真值 b2b 升（648377-7/268936-8/908164-11 flood 掉到 6）。
3. **learned-high 滞后低于真值**：329036-2 b-only uniform PASS（flood 7.5625 真值 3.69）→ b+d learned-high 带 vi~22.4<律 26.18→flood 6.4375 真值 4.39 FAIL（**回归**）；带均值滞后于单杯真值 ViObs 25.4。
4. 历史 holdCfg 3000 杯：b-only 律 vi 高→预测 need>3.0→holdMs 自抬到 4000 覆盖真值；b+d 半混 vi 低→预测 need≤3.0→不抬→真值超 3.0（648377-7/268936-8 hist 窗）。

**对照统筹预估**：预估低带学成~26 修复 -2/-4/-11、仅剩 -5 首杯 +0.19。真实回放：低带终态 23.08（非 26，跨 era 拉低），-2(329036-2) 反而回归、-11(908164-11)/-7(648377-7) 未修复，预估未现。**禁镜像，拿真实回放核**。

**呈裁（不自行取舍）**：门①未达。选项须用户/统筹裁：(a) 带形状精化（更多带/era 感知键——**改形状须先问**）；(b) 消费策略调整（MEDIUM→律而非半混，或仅 HIGH 消费——Q3 变体须裁）；(c) 接受 B 残余风险（预测门过＋安全包线兜底，真值窗属过渡代价）；(d) 回退 b-only 静态（无学习）发版。**B 如实现未达门①，b/d(B) 合并发版预授权需重议**。本批不改带形状/消费策略（红线/设计参数），忠实实现 B 规格＋如实呈报。

## 5. 门②③④⑤⑥⑦（全过）

- **门② 当前 4 干净杯写序列**（Vi 隔离成对，同 r 记忆剥 viBuckets vs 带）：21/22/24/25 非 boost 笔**逐字不变**＋boost 逐字＋oq/observedR 不变＋全 complete ✓。杯23（噪点杯，非验收 4 杯）收口时序移动（holdMs 3600→3800，命令不变）。

| 杯 | boost | 非 boost 笔 | oq/observedR | holdMs 基线→学习 | nW | status |
|---|---|---|---|---|---|---|
| 21 | 逐字 | **逐字** | 不变 | 3900→4000 | 6/6 | complete |
| 22 | 逐字 | **逐字** | 不变 | 3700→4000 | 6/6 | complete |
| 23 | 逐字 | 时序差 | 不变 | 3600→3800 | 3/3 | complete |
| 24 | 逐字 | **逐字** | 不变 | 3600→3800 | 8/8 | complete |
| 25 | 逐字 | **逐字** | 不变 | 3600→3700 | 7/7 | complete |

- **门③ 25 杯学习注入**：rise 地板永不破（flood≥6）／flood[3.5,8]／hold[2000,7000]／predicted b2b≤holdMs 全过／零 infeasible／零 extrapolated ✓。
- **门④ rmse**：律素材门 0.086≤0.30 保持✓；成熟学习~0.21≤0.30✓；era 过渡 0.264≤0.30✓（B 比 A 的 0.309 改善，带路由使当前杯更快落成熟带）。
- **门⑤ 峰≤40%**：verify 闭环套件全过（938 含）；闭环真值须真机陪杯。
- **门⑥ 排除/指纹/restore/冷启动/截尾/固定挡**：verify 938 全绿✓；universe7（6 在线＋1 离线）/integrity/杯23 微簇在线拒✓；完整指纹拒＋reseed✓；restore viBuckets 撤销✓。
- **门⑦ era 过渡 rmse**：0.264≤0.30，过预测＝安全方向注记✓。

## 6. 坑（本批踩过）

1. **assert/strict 跨 VM realm**：插件返回 VM realm 数组，测试 host [] 字面量 deepEqual 报「same structure not reference-equal」→用 length/逐元素断言。
2. **restore 守卫**：B 下 vi 学习不建 g 桶→快照 buckets 空→原守卫「Snapshot has no valid buckets」拒→扩接受 viBuckets-only。
3. **b-only uniform 基准计算**：true b2b 须用 uniform flood（repU.flood）非历史 flood；初版误用历史 flood 致 b-only uniform 虚高（9/11），修正后 5/11。
4. **带边界夹具漂移**：soakSignature 名义 ratio 与实测差 ~0.02–0.04，0.39/0.4 边界测试漂移跨带→viBandFor 直测边界＋内点（0.35/0.45/0.7）路由。
5. **r＋vi 同钩子**：写序列 env 平台靠 r 桶，主回放须 r+vi 同跑；成对隔离 Vi 剥 viBuckets（非 g 桶 vi）。
6. **跨 env fpKey**：各 harness env 校准 createdAt 不同→携带记忆对齐 viBuckets.fpKey（仿真口径）。

## 7. 待办／别碰／复跑

- **待裁**：门①失败→带形状/消费策略/回退选项（§4，须先问）；技能 §22.19/§22.3 d 补注已按 B 更新（只改 d 补注，其余逐字，待统筹审）；发版决定重议（b/d(B) 合并预授权基于门①达）。
- fc 批依赖（Vi 标定 b＋学习 d）已落，触记忆仍须另批；FC>0 Vi_obs 预留已埋。APK 同步债 viBuckets ratio 带＋七门＋EWMA＋指纹门＋restore→shadow/arbiter full→hec。
- 复跑：cd decenthyperexplugin.reaplugin && node tests/verify_v02259.cjs（938）；cd .. && node sim/tests/sim-regression.cjs（5）；node D:/vscode/.tools/__d20-vi-learn-replay-b.cjs（130 杯 B 回放，写 __d20-vi-learn-replay-b.json）。
- 本批 commit 仅 plugin.js/tests/verify_v02259.cjs/tests/RESULTS_v02259.txt/README.md/本交接（manifest 零改）；探针 .tools/__d20-* untracked 不入库；别人 WIP HANDOFF_2026-10-31.md（M）不碰不提交不回滚；APK 仓/取证功能区不碰；记忆不删改（restore 除外）；归档 raw 不改。
- **未发版/未 push/无 tag/未装机**；发版由统筹核过后派 relay-2（门①未达需先裁）。