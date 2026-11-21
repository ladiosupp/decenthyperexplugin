# Vi 重拟合批交接（2026-11-21，2.2.59 候选，改码不发版）

> 派单：统筹 01a1f8e8-499f-7513-a9cd-84b3af28bb14（relay-8）11-21，用户批 Vi 重拟合批（**改码本批授权；发版/push/tag/装机另问**）。口径依据＝技能 §22.19（现行）＋活文档 D:/vscode/HyperExController/HEC_COORDINATOR_STATE.md §3 杯25 裁决／§4。基线 HEAD **ef4f490**（2.2.58 已发，含 scaleSampleGate 50f64d0）。实施对话＝§22.19 自适应律实施对话（01a1f67b 链）。
>
> 一句话现状：**VI_A 40.929→21.013、VI_B −32.251→−8.962**，5 杯素材 wetLat rmse **0.831→0.077s**（用户门 ≤0.30s **PASS**，平均偏差 +0.802→+0.012s）；verify_v02259 **927/927**＋sim **5/5**；25 杯决策级回放＋5 杯全量写序列回放完成，零 infeasible／零 extrapolated／零 disabled；**两项行为后果须统筹裁定**（§6：批1类粉饼再现欠流风险、默认挡当期 flood 跨度 0）。本地 commit 不发版。

## 1. 拟合（方法＋验收）

- **素材**：D:/vscode/.tools/hx-train/data/vi-refit-material.json 5/5（杯21/22/23去尖峰/24/25；杯23 rise2080S=null 桥接口径敏感不录，rmse 门仅 wetLat）。
- **ratio 取值**：插件 soakWettingObservation 对原始样本的精确值（杯21/22/23 源 D:/vscode/HyperExController/.tools/__live-plugin-history-18.json；杯24/25 源 D:/vscode/.tools/hx-data/hyperex-history-all.json 130 杯归档），与素材 viPlanMl 反推 (40.929−viPlan)/32.251 交叉一致（差 ≤0.0002，viPlan 两位小数舍入）。
- **目标函数**：最小化 预测 wetLat = clamp(A+B×ratio,15,36)/floodMaterial（fc=0，flood 取素材当杯实测指令）的 5 杯 rmse；**clamp[15,36] 固定**；网格搜索＋逐级细化，系数取 3 位小数。探针 .tools/__d19-vifit.cjs（结果 __d19-vifit.json）。
- **结果**：A=21.013、B=−8.962，rmse=0.0768s ≤0.30 **PASS**。无约束 LS 解 (21.065,−9.009) rmse 0.0775 几乎相同——拟合实际由杯21/22 两个未截断杯决定，杯23–25 验证下限托底。

**逐杯 before/after（flood＝素材实测指令，fc=0）**

| 杯 | ratio | flood | wetLat 实测 | viImplied | Vi 旧 | 预测旧 | Δ旧 | Vi 新 | 预测新 | Δ新 | clamp |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 21 | 0.5435 | 6.75 | 2.386 | 16.11 | 23.40 | 3.467 | +1.081 | 16.14 | 2.391 | +0.005 | − |
| 22 | 0.5747 | 6.4375 | 2.471 | 15.91 | 22.39 | 3.478 | +1.007 | 15.86 | 2.464 | −0.007 | − |
| 23 | 0.6763 | 6 | 2.615 | 15.69 | 19.12 | 3.187 | +0.572 | 15.00 | 2.500 | −0.115 | 下限 |
| 24 | 0.7186 | 6 | 2.402 | 14.41 | 17.75 | 2.958 | +0.556 | 15.00 | 2.500 | +0.098 | 下限 |
| 25 | 0.6710 | 6 | 2.419 | 14.51 | 19.29 | 3.215 | +0.796 | 15.00 | 2.500 | +0.081 | 下限 |

rmse **0.831→0.077s**；平均 Δ **+0.802→+0.012s**（系统保守偏差消除）。

- **clamp 诊断（红线冲突检查）**：杯23/24/25 原始 Vi=14.95/14.57/14.9997 <15 被下限托底 → 预测恒 2.500s；下限松到 12/13/14 的 rmse 均为 0.067（仅改善 0.010s）→ **不需动 clamp 上下限／兜底 24.8／律结构**，未触发「冲突先问停下」条件。
- **支撑域**：Vi(0.2)=19.22、Vi(0.8)=15.00（原始 13.84 截断）；Vi 跨 15 在 ratio=0.6709；原始 Vi 最大=A=21.013（ratio 0）→ **上限 36 对任何物理 ratio≥0 不可达**（常量按红线保留；viExtrapolated 旗标仍守支撑域外）。

## 2. 改动清单（外科手术式）

| # | 文件 | 改动 |
|---|---|---|
| 1 | plugin.js | PLUGIN_VERSION 2.2.58→2.2.59；S2_REFILL_VI_A 40.929→21.013、S2_REFILL_VI_B −32.251→−8.962；常量上方 +5 行重拟合出处注释（2.2.56 的 25 杯历史注释块原样保留）。**其余逐字未动** |
| 2 | manifest.json | 仅 version 一行；description 保持 275（§1.15） |
| 3 | README.md | 置顶 2.2.59 段 |
| 4 | tests/verify_v02259.cjs + RESULTS_v02259.txt | 926 基线复制＋重编码＋新门测试＝**927 tests 全绿**；RESULTS 为实跑输出 |
| 5 | 技能 SKILL.md §22.19 行 980 | Vi 子句插入重拟合系数值＋11-21 用户裁定引用（**该行其余文本逐字不动，统筹审**） |
| 6 | 本交接 | HANDOFF_2026-11-21-vi-refit.md |

**verify 重编码明细（授权范围：引用 Vi 系数的断言按新口径重写，拿真杯素材交叉，禁镜像）**

1. **slower-wetting 测试**：新口径下默认 4000ms 时当期 Vi 小（F_budget=Vi/3.474 ≤5.53 <F_rise 6.0），rise-target 全域绑定；hold-budget 分支夹具改 holdMs2000（budgetS 1.474 → F_budget 12.9 → flood 8）。保留 Vi 严格单调／flood 随 ratio 不增／rise 地板。
2. **holdMs 双向**：慢端 (0.22) 在 4000 可行 → holdMs=4000、adjusted=null（可行不抬）；抬升支用 tight 2000 夹具（3300>2000，raised）；快端缩 3600 保留。
3. **域外旗标**：上限 36 不可达 → 删 viMl===36／flood===8 旧钉（旧拟合截距产物），改 旗标＋[15,36] 包线＋Vi(0.05)>Vi(0.2) 单调＋rise 地板＋不静默超时。
4. **杯20 交叉**：0.6803 签名交叉保留（测量不变）；|Vi−19.6|<4 是旧豆期钉（杯20 Vi0=2.794×7=19.6 属上一豆期），由新豆期 5 杯素材门测试取代；Vi∈[15,36]＋不超时保留。
5. **25 杯回放**：b1up≥80% 跨期保守钉被取代 → rise 地板永不破＋紧 watch 批1预算驱动；**spread≥1.0 保留**（历史逐杯设置含 3000ms，实际跨度 1.688 仍过）；新增 holdMs 有缩＋紧预算机制跨度（6→8）。
6. **D4 律测试 slow 支**：0.22@4000 → flood 6 rise-target；新增 0.22@2000 → flood 8＋holdMs 抬。
7. **Vd15 通道夹具隔离**：vdChannelLoop 原用 adaptive 夹具（旧律输出 snap16(22.433/3.474)=**6.4375**），新律把夹具 flood 降到 6.0 改变通道动力学 → 钉 fixed 6.4375（holdMs 4000 同旧），Vd15 机制红线零改、其时序测试与 Vi 标定解耦。坑：先误钉 6.5 → quanta [24,10] 红，改正 6.4375 全绿（**snap16 网格，别拍整数**）。
8. **新增 5 杯素材门测试**（真杯交叉，禁镜像）：真实原始样本 → obs ratio → 律 Vi → Vi/floodMaterial 对比素材 wetLatS；断言 逐杯|err|≤0.30＋rmse≤0.30（用户门）＋rmse<旧拟合＋|平均偏差|<0.15＋素材↔插件 ratio 交叉（tol 0.002，旧系数 40.929/32.251 仅作历史参照）；数据缺失 skip（同既有真杯测试模式）。
9. **版本钉**：manifest／plugin／calibrationStatus／shotJSON／页面 regex HYPEREX v2.2.59。

## 3. 验证回执

- **改码前基线复跑**（HEAD ef4f490）：verify_v02258 **926/926**＋sim-regression **5/5**。
- **改码后**：verify_v02259 **927/927**（tests/RESULTS_v02259.txt）；sim-regression **5/5**；node --check plugin.js／verify 通过；manifest version 2.2.59、descLen 275。
- **git diff 红线审**：plugin.js 仅版本 1 行＋系数 2 行＋注释 5 行；manifest 仅 version 1 行。别人 WIP HANDOFF_2026-10-31.md（M）未碰未提交。

## 4. 25 杯决策级回放（before/after，开环只验选笔/旗标/区间）

探针 .tools/__d19-replay25.cjs（与 verify 同选笔逻辑），before/after JSON＋__d19-diff.txt 全表。

| 指标 | before（2.2.58 拟合） | after（2.2.59 重拟合） |
|---|---|---|
| law flood 范围 | 6.000–8.000 | 6.000–7.6875 |
| lawHold 范围 | 3700–5200 | 3000–4000 |
| b1up（批1 ≥历史灌水） | 13/13 | 5/13 |
| hotDown（批2 高峰 ≤历史） | 4/4 | 4/4 |
| extrapolated / infeasible / disabled | 0 / 0 / 0 | 0 / 0 / 0 |
| 平均峰估 Δ（13.84pp per ml/s） | +4.26pp | **−8.65pp** |
| flood 变化杯数 | — | 21/25 |
| holdMs 变化杯数 | — | 24/25 |
| binding 变化杯数 | — | 15/25 |

**全 25 杯（hist=历史灌水；lawB/lawA=旧/新律选笔；holdB/holdA=旧/新律 holdMs；wet/peak=历史实测）**

| runId | 批 | hist | lawB→lawA | viB→viA | holdB→holdA | bindB→bindA | wet | peak% |
|---|---|---|---|---|---|---|---|---|
| 1794311272562-5 | 1 | 6.8125 | 8→6.8125 | 26.01→16.87 | 4200→3000 | hold-budget→hold-budget | 4.285 | 5.7 |
| 1794349686272-6 | 1 | 6.8125 | 8→7.25 | 30.09→18 | 4700→3000 | hold-budget→hold-budget | 4.587 | 12.3 |
| 1794350648377-7 | 1 | 6.8125 | 8→7.4375 | 31.54→18.4 | 4900→3000 | hold-budget→hold-budget | 4.979 | 0.1 |
| 1794351268936-8 | 1 | 6.8125 | 8→7.375 | 30.81→18.2 | 4800→3000 | hold-budget→hold-budget | 5.026 | 4.6 |
| 1794393997909-9 | 1 | 6.8125 | 8→6.375 | 22.09→15.78 | 3700→3000 | hold-budget→hold-budget | 3.68 | 26.6 |
| 1794395116314-10 | 1 | 6.8125 | 8→7.6875 | 33.55→18.96 | 5100→3000 | hold-budget→hold-budget | 5.256 | 0.1 |
| 1794437908164-11 | 1 | 6.8125 | 8→6 | 29.63→17.87 | 4700→4000 | hold-budget→rise-target | 4.292 | 6.9 |
| 1794438954177-13 | 1 | 6.8125 | 8→6 | 33.45→18.93 | 5100→4000 | hold-budget→rise-target | 4.685 | −22.5 |
| 1794439491260-14 | 1 | 6.8125 | 8→6 | 34.09→19.11 | 5200→4000 | hold-budget→rise-target | 4.658 | −18.0 |
| 1794525779756-1 | 1 | 6.8125 | 8→6 | 31.54→18.4 | 4900→4000 | hold-budget→rise-target | 4.424 | 10.9 |
| 1794526329036-2 | 1 | 6.8125 | 8→6 | 33.05→18.82 | 5100→4000 | hold-budget→rise-target | 4.545 | 10.4 |
| 1794617112489-3 | 1 | 6.8125 | 7.375→6 | 25.65→16.77 | 4000→3900 | hold-budget→rise-target | 3.801 | 9.4 |
| 1794617558035-4 | 1 | 6.8125 | 8→6 | 28.75→17.63 | 4000→4000 | hold-budget→rise-target | 3.934 | 13.0 |
| 1794868573594-3 | 2 | 7 | 6.6875→6 | 23.3→16.12 | 4000→3800 | hold-budget→rise-target | 3.545 | 36.3 |
| 1794869984844-4 | 2 | 7 | 7.3125→6 | 25.31→16.67 | 4000→3900 | hold-budget→rise-target | 3.337 | 19.0 |
| 1794873721382-6 | 2 | 7 | 6.875→6 | 23.91→16.28 | 4000→3900 | hold-budget→rise-target | 3.435 | 25.2 |
| 1794960683592-1 | 2 | 7 | 6.6875→6 | 23.24→16.1 | 4000→3800 | hold-budget→rise-target | 3.092 | 58.4 |
| 1795005952147-1 | 2 | 7 | 6.4375→6 | 22.42→15.87 | 4000→3800 | hold-budget→rise-target | 3.34 | 20.3 |
| 1795053602320-1 | 2 | 7 | 6.375→6 | 22.1→15.78 | 4000→3800 | hold-budget→rise-target | 3.33 | 39.1 |
| 1795078937216-1 | 2 | 7 | 6.0625→6 | 20.96→15.46 | 4000→3700 | hold-budget→rise-target | 2.654 | 27.6 |
| 1795084966454-2 | 2 | 7 | 6→6 | 16.32→15 | 3900→3600 | rise-target→rise-target | 2.159 | 102.7 |
| 1795092284238-1 | 2 | 7 | 6→6 | 20.35→15.29 | 4000→3700 | rise-target→rise-target | 2.954 | 53.6 |
| 1795128910696-2 | 2 | 7 | 6.4375→6 | 22.47→15.88 | 4000→3800 | hold-budget→rise-target | 2.601 | 29.9 |
| 1795130086821-3 | 2 | 7 | 6→6 | 18.75→15 | 4000→3600 | rise-target→rise-target | 2.8 | 53.2 |
| 1795131958238-4 | 2 | 7 | 6→6 | 19→15 | 4000→3600 | rise-target→rise-target | 2.794 | 24.8 |

读法：批1 六杯历史 holdMs=3000 → budgetS=2.474，F_budget=Vi/2.474≈6.4–7.7 → flood 6.375–7.6875（hold-budget 保留，hold 3000 可行不抬）；批1 其余七杯 holdMs=4000 → rise 地板 6.0。批2 全 6.0＋hold 3600–3900。**回放用历史逐杯设置，故跨度 1.688 非 0**（默认 4000 统一设置下的跨度见 §6.2）。

## 5. 5 杯全量写序列回放（真实录制样本＋真实 soak 前缀）

探针 .tools/__d19-writeseq5.cjs：喂真实录制样本（含真实 scaleTimestampSeconds），**保留非 stage2 前缀**（soak+stage1），冷启动临时 plan → stage2 入口真实 replan（与真机决策点时序一致）。修正了 __d18-writeseq 探针每 tick 用 stage2-only 覆盖 rawScaleSamples 冲掉 soak 前缀→静默冷启动的问题（那个探针评估 Vi 改动会恒零差异，不适用本批）。

| 杯 | boost 旧→新 | hold 旧→新 | Vi 旧→新 | bind 旧→新 | nW | status | 写序列差异 |
|---|---|---|---|---|---|---|---|
| 21 | 6.75→6.0 | 4000→3800 | 23.4→16.14 | hold-budget→rise-target | 7→7 | complete | 仅 write#0 boost；其余 6 笔逐字 |
| 22 | 6.4375→6.0 | 4000→3800 | 22.39→15.86 | hold-budget→rise-target | 6→6 | complete | 仅 write#0 boost；其余 5 笔逐字 |
| 23 | 6→6 | 4000→3600 | 19.12→15 | rise-target→rise-target | 3→3 | complete | bleed 4250→4000ms、return 5000→4750ms（早 250ms，命令 1.375/3.875 不变） |
| 24 | 6→6 | 4000→3600 | 17.75→15 | rise-target→rise-target | 8→8 | complete | **逐字相同**（预测主判收口先于 watchdog） |
| 25 | 6→6 | 4000→3600 | 19.29→15 | rise-target→rise-target | 7→7 | complete | **逐字相同** |

- oqTail／oqTailErr／observedR **五杯全不变**（开环喂录制样本，学习决策输入不变；observedR 探针口径 null 前后一致）。
- 结论：写序列影响＝boost 首笔幅度（杯21/22）＋收口时序（杯23 早 250ms）；**笔数不变、命令序列不变、学习输入不变、全 complete 无超时**。杯23 时序移动来自 holdMs 4000→3600 与两段收口的交互（命令值不变）；闭环真值须真机陪杯。

## 6. 行为后果／待统筹裁定（不自行取舍）

1. **批1类粉饼再现的欠流风险（era 局部标定代价，第一优先级「不欠流」相关）**：批1（11-10→14 旧豆期）历史 wetLat 3.68–5.26s @ flood 6.8125 → 隐含 Vi 25.1–35.8ml；新律在同 ratio（0.31–0.46）给 Vi 15.8–19.0。若该类粉饼再现：例 1794351268936-8（ratio≈0.314，新 Vi 18.2、flood 7.375、hold 3000）预测 b2b≈2.82s≤3.0 判可行，但真实 b2b≈5.03+0.62−0.274≈5.37s≫3.0 → **holdMs 超时欠流**。holdMs 自动抬升只响应预测需求，救不了真实偏差。选项（统筹/用户裁）：a) 接受 era 局部（当前豆期快润湿，批1 是历史豆期）；b) 约束拟合（如固定 B=−32.251 只拟 A≈33.64，rmse≈0.095 仍过门、低 ratio 端 Vi 更高、批1 表征更好——非 rmse 最优，属取舍，本批未做）；c) 动 riseTarget/RR_QUANTILE/clamp（红线，另批）；d) Vi 杯间学习（触记忆，另批，技能已注）。
2. **默认挡当期 flood 跨度 0**：holdMs4000 时对 ratio∈[0.2,0.8] 恒有 F_budget=Vi/3.474 ≤19.22/3.474=5.53 <F_rise 6.0 → flood≡6.0（域外低至 ratio 0.02 仍 6.0）。技能优先级「自适应范围＞固定档」在当期默认挡只经 holdMs（3600–4000）与紧预算/域外 flood 体现；回放集（历史混合设置）跨度 1.688、紧预算机制跨度 6→8 均过断言。若要求当期默认挡也有 flood 跨度 → 须动 riseTargetS/RR_QUANTILE（红线，另批）。本批不动。
3. **上限 36 不可达**（原始 Vi 最大 21.013）：常量按红线保留，viExtrapolated 仍守域外；仅注记。
4. **技能 §22.19 行 980 已同步**（Vi 子句插入系数值＋11-21 用户裁定引用，该行其余逐字不动）——**待统筹审**。
5. **fc 学习批依赖解除**：HANDOFF_2026-11-20-fc-learning-prep.md 前置「Vi 先标定」已满足；发版装机＋用户授权触记忆仍待，本批不触 fc。

## 7. APK 移植同步债

VI_A/VI_B 新系数（21.013/−8.962）→ shadow/arbiter 等价物；与 2.2.56 新律债（soak 观测＋自适应律＋holdMs 双向＋旗标）合并，full→hec 里程碑一次移植（活文档 §5）。注：APK 侧若无 soak 样本流等价物恒走冷启动（既有注记）。

## 8. 复跑索引

- cd decenthyperexplugin.reaplugin && node tests/verify_v02259.cjs（927）
- cd D:/vscode/decenthyperexplugin && node sim/tests/sim-regression.cjs（5）
- node D:/vscode/.tools/__d19-vifit.cjs [plugin]（拟合＋逐杯对照）
- node D:/vscode/.tools/__d19-replay25.cjs <plugin> <out.json>（25 杯决策级）
- node D:/vscode/.tools/__d19-writeseq5.cjs <plugin> <out.json>（5 杯写序列）
- node D:/vscode/.tools/__d19-diff.cjs（before/after 对照，依赖 4 个 JSON）
- 旧插件快照 .tools/__d19-plugin-2258-base.js（ef4f490 plugin.js 原样）；before/after JSON＋diff.txt 在 .tools（untracked 不入库）。
- 数据：history-18（杯21/22/23）／hyperex-history-all.json（杯24/25）／vi-refit-material.json。

## 9. 红线／工作区

- **零改**：flood 律结构／clamp[3.5,8]／holdMs[2000,7000]默认4000／FC_FACTOR=0／决策点 stage2 入口时序／soak 六拒收门／禁 S1 出流族／Va/Vb3/Vd15/O1/cutoff predicted 主判/backstop 0.85/两段收口/Q2 平滑链（coast/up-hold/治理链/死区/quanta/静默/ceiling）／硬包线 0.10–8.00／sent 恒 false／LUT／单一写者／gain memory／归档 rawScaleSamples。
- 别人 WIP HANDOFF_2026-10-31.md（M）未碰未提交不回滚；.tools 探针 untracked 不入库；APK 仓/取证功能区不碰。
- **未发版、未 push、未打 tag、未装机**（须另问用户）。本地 commit 仅本批 6 文件（plugin.js／manifest.json／README.md／tests/verify_v02259.cjs／tests/RESULTS_v02259.txt／本交接）。
