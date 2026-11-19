# HANDOFF v02253 — D1–D6＋sourceBucketId 改名（2.2.53 候选，改码完成待发版批）

> 2026-11-19 插件侧实施接力（接 01a1ee30 交接 HANDOFF_2026-11-19-D1-6-impl-relay.md）。用户 11-19 批「D1-6全改」＋「sourceRunId 改名也做」；**改码本批授权，发版/装机/push 另问**。统筹 01a1f239-4de7-7213-bca0-f947b70c0c1b（hostId local），状态真源 D:/vscode/HyperExController/HEC_COORDINATOR_STATE.md。
> 一句话现状：**2.2.53 已发版＋资产已替换为短简介包**（用户 11-19 批「2.2.53 发版」＋「替换 github 上面 2.2.53 的内容」）。代码 48c58e8（零改）＋文案 54ffbc0＋本回执；tag v2.2.53=**54ffbc0**；Release 451046769／asset **RA_kwDOVO5zXc4ttk2b**（uploaded，534524 B）；夸克 **ad8ab50f25744d7daca43291d23ebb00**（旧 dc47cde0… 保留 superseded）；平板 Download/ 新包已推核（用户未装，将自装看短简介）。详见 §9/§10。

## 1. 本轮改动（plugin.js 2.2.52→2.2.53）

- **D1 ③ 清锚 fallback 最佳可用估计**（test-command-set adaptive 分支）：无合格立即建议 → adaptiveEstimateFallback(node,target)：① gain-memory confidence HIGH（platformMemoryGain 同口径：immature bandN<3/provisional 回退 overall smoothedR）→ snap(clamp(target/r))；② FF k eligible（ff.eligible && (!mixedBand || spread≤.05)）→ snap(clamp(target/k))；③ 都无 → 原 {mode:auto,origin:original,command:null}（LUT 安全默认保留）。命中 fallback 时 stages[stage]={mode:manual,origin:adaptive,command,estimateSource}。仅 stage2（S1 无记忆/FF 平台路径，行为不动）。
- **D2 FF k 入平台/trim 中心**：stageGainEstimate 返回加 mixedBand（sources 跨 commandBandOf 带）；ffKQualified＝addGain 同意门（≥3 杯 spread≤.12／2 杯≤.05）＋混带收紧≤.05；s2FfPlatformCandidate(targetGS) 用 prior=diagnosticLast||diagnosticCurrent 的 settled 证据。boundedRefillControlBase 与 liveTrimControlCenter：FF k 第一候选（当杯 local blend 之后），与成熟记忆命令并存时套 P0-1 ±25%/0.35 包线（防资格抖动跳变）；controlSource="feed-forward-k" 入 trustedControl（holding 信任同 gain-memory）。建议侧 addGain 的 span 限幅路径与 eligible 门不动（info 加 mixedBand 字段）。
- **D3 大缺口杯内提速**（S2 only）：liveTrimTick rescue 块算 gapRel=|command−ccRescue.commandMlS|/ccRescue.commandMlS，largeGap=gapRel>.30，t.largeGapS2 每 tick 刷新；rescueHot=(angleStreak≥2 || largeGap) && predictedRel>.25 && actualRel≥.12 && cannotReturn（后三门不动）；normalTrimQuanta 第 4 参 largeGap：S2 → streak≥3?8:6；liveResponseInterval：S2 常规 largeGap → 1000ms（救急 800/S3 2400 不动）；recoveryTimeEstimate 透传 largeGap（perWrite/period 一致）；check 行加 commandGapPct/largeGap，write 记录加 largeGap/commandGapPct。杯间：P0-1 pull＋direct-mapping 包线仅 gap>30% 时 ±25%→±50%（0.35 绝对量不动）。
- **D4 adaptive flood 下限≥7**：adaptiveColdMlS=max(7, refillFloodFloor(), min(8, round(1.8×platform×16)/16))。**只改自适应挡冷启动下限值**；refillFloodFloor 本体、固定挡 floodMaxMlS 人工旋钮（§22.5 v2.2.26 人工折中口径）、8.00 硬上限、两段收口结构、灌水量律矢量全不动。
- **D5 诊断 null 门因＋收口快照**（additive）：s2RefillFlowEstimate 每个 null 出口记 t.startup.lastEstimateGate={gate,atMs,…}（points/span/stale/tail-span/tail-points/r2/slope），成功清 null；refill check 行加 estimateGate/estimateGateDetail；completeS2Startup 的 startupExecution＋startup-complete trace 加 estimate（lastEstimate 快照 slope/stamp/r2）＋estimateGate。firing-only cutoff 语义不动。
- **D6 ③ 预览**：adaptiveModePreview(key,sug,targetGS) 三分支——合格立即建议→「将应用最新学习值 X」（原文案）；stage2 fallback 命中→「将应用估计值 X ml/s（草稿态，按应用生效）」；都无→「无合格估计→清回 LUT（咖啡下可能欠流）＋armed 学习（草稿态，按应用生效）」；stage1 保留原文案。调用方 wireModeSelects（state.cfg[key+'Flow']）/stageTestRow（c[key+'DesiredGS']）传 target。UI_LANGUAGE_PAIRS 加 5 对子串翻译（动态数字保留，双向）。
- **改名**：bounded cup-target holding（stage2StartupPlan）sourceRunId→**sourceBucketId**（存 control.bucketId）；legacy s2HoldingReference.sourceRunId 不动（存 run.runId）；plan.sourceRunIds 数组不动。plugin.js 内无其他消费方；APK www 无 holdingReference 镜像（rg 证实）→本批无 APK 改动。
- **版本**：PLUGIN_VERSION/manifest version 2.2.53；manifest description 前置 2.2.53 段（Retains 链保留）；README 置顶 2.2.53 节。

## 2. 验证回执（全绿）

- node --check plugin.js ✓；manifest JSON parse ✓。
- **tests/verify_v02253.cjs 870/870**（851 基线按新口径更新 5 条＋版本断言：T-5 大缺口步长≤6／P0-1 ±50% 包线／ADAPTIVE 预览×2（bundle 含 fallback 助手）／2.2.27 adaptive 下限 7；＋19 新增：D1×4（HIGH 记忆/FF k/都无清 LUT/immature-provisional 回退）、D2×4（同带 k 领先＋中心一致/混带>5% 拒入平台/包线夹取/local blend 优先）、D3×4（步长门/静默门/闭环大缺口保护性收回≤5s 持续 90%＋早救急＋峰≤40＋静默≥800/±50% vs ±25%）、D4×2（下限≥7/上限 8/固定旋钮不动＋低 base 闭环抖动 0/0.6/1.2）、D5×3（各门因记录与清除/check 行门因/定时收口快照不造 cutoff）、D6×1（翻译双向）、改名×1（bounded sourceBucketId/legacy sourceRunId/sourceRunIds 数组））。禁镜像：新断言均口径不变量或闭环结果。
- **sim/tests/sim-regression.cjs 5/5**。
- **决策级回放**（探针 D:/vscode/.tools/__d16-replay.cjs，verify_v02253 fixture＋history-9 真机证据行＋最终 gainMemory 快照；before/after JSON 同目录 __d16-baseline-replay.json／__d16-after-replay.json）：
  - 平台（杯 6–13 先验）：杯 6–11 FF spread 12.9–13.7%>12% 不合格→gain-memory 不动；杯 12 先验 FF k1.257 eligible→platform 3.875→**4.0**（feed-forward-k，flood 7.1875）；杯 13 先验 FF k1.221 混带 spread>5%→gain-memory 3.8125（门按设计拒入）。
  - D1 fallback：杯 6/7/11 先验 HOLD→gain-memory 3.875；**杯 12 先验（manual）HOLD→feed-forward-k 4.0**（manual 先验标量 LIMITED 使记忆节点降 MEDIUM，合格 k 接管——即杯 13 现场 ③ 清锚场景，新律首杯 ≈4.0 起步，免 LUT 2.5）；杯 13 先验 ADJUST 立即合格→不需 fallback。
  - D3 闭环大缺口（r1.29 记忆中心 3.875，压力边际保护性收回 2.5，缺口 35.5%，植物 r(cmd)＋抖动 0.6＋真实重量推进）：持续 90% 时间 **8200ms→2550ms**；rescue 收回后 1000ms 触发（旧律角度 buildup 永不满足→无 rescue）；峰 0.9%；步长≤ceiling；静默≥800。
  - D4 闭环低 base（r2.0/platform 2.5/adaptive）：flood 5→7，峰 −5.3%→**+3.9%**（≤40），rise 0.7→0.6s（≤1.5），maxCmd 5→7，两段收口 complete，return=platform；抖动 0/0.6/1.2 一致。正常 base（r1.29）峰 15.4%/rise 0.6/maxCmd 7 不动。
  - 整杯回放（harness，4 杯 fullRecord：杯 11/12pred/12/13）：4/4 完成（旧 harness 在 S2 入口/补水 handoff 中止，见 §4 修复）；杯 13 flood 5→7，writes 序列含 D3 提速。
- **红线复核**：硬包线 0.10–8.00／1/16／上行压力门代码未动；单一写者/影子 sent 未动；LUT/记忆数据未动；两段收口结构未动（D4 只改冷启动下限值）；§22.18 杯间 manual 锚未动。

## 3. 技能补注（只加不改，统筹复核）

C:/Users/ladios/.codex/skills/decentplugin/SKILL.md：§22.8 末「2.2.53 大缺口杯内提速例外」／§22.11 末「2.2.53 adaptive flood 下限≥7 独立 base」／§22.18 末「2026-11-19 杯 13 设计目的重评补注（2.2.53 D1/D2）」。现有文本零改动。

## 4. 本轮坑（项目特有）

- **harness auto 泄压回放映射（sim/harness.js，本批修）**：① 录制 profileFrame 是插件逻辑帧（state.lastFrame），喂 handleStateUpdate 前要反映射回物理帧（auto：逻辑 1→物理 2，S3 +1）；② auto 泄压杯 soak 期机器仍是 espresso（0 bar 帧），旧映射 soak→idle 触发「Machine returned to Idle during auto release/soak」中止；③ applyState 硬编码 basis=pump-command（bounded 默认前旧配置）→bleedCommandMlS=null→bleed 永远发不出→watchdog「S2 startup base return driver ACK missing」；改 cup-target（'target' 仍走 sim 侧补水实验）＋floodMode/floodMaxMlS 可配。修前 sim-regression 可选第 5 项（Downloads 2.2.31 ON 模式杯）基线即红——release 风格随录制杯（autoRelease=有 soak 无 restart_wait），数据源优先 history-9。
- **refillLoopEnv 默认 legacy 控制律**（setup liveTrimDecisionModel=false）：D3 闭环测试必须显式 cfg.liveTrimDecisionModel=true＋report.decisionModel='predictive'，否则包线 base±20% 钉死、无救急，场景假停摆。
- **D5 stale 门测试浮点边界**：1300ms 年龄过滤会把 100ms 网格窗裁成恰好 0.6s 跨度（浮点<0.6 误触 span 门）；用 50ms 网格＋620ms 老化避开。
- **apply_patch 半行锚点**：stageTestRow 是整行长函数，半行锚点必失败——用 node 精确替换脚本（ occurrence 计数断言）。
- **Number(null)=0 过 isFinite**：pump-command basis 的 bleedCommandMlS=null 被 Number() 转 0 绕过「bleed command unavailable」门，到 command<0.1 才裸 return false（无 startupBlock 日志）——排查时 DBG 要打在 cmd-resolve 处。本批不改该交互（生产 bounded 默认 cup-target，不触发）。

## 5. 待办（每步先问）

- **发版批（用户经统筹另批）**：tag v2.2.53→push origin auto-hyperex＋tag（VPN 代理 127.0.0.1:57890）→git archive zip→GitHub Release（gh token 走 git credential fill 不回显＋HTTPS_PROXY；curl -H Expect: --data-binary）→夸克「来自：Codex」→推平板 /sdcard/Download/ zip（ls 核字节，不代装）→回执 commit（仅 HANDOFF）＋push→回叫统筹 key 数字。
- **发版后测杯**（取证接力 01a1eec0 陪杯）：① 正常 base 杯复核 c 诊断 firing 字段（estHistory/margin/firingTickMs＋refill check 斜率序列＋本批 estimateGate）；② ③ 清锚场景首杯是否 ≈4.0 起步 HIT（D1/D2）；③ 大缺口杯内收敛/whole 误差（D3）；④ 低 base flood≥7 陡升/峰≤40（D4）。
- **APK 同步债**（full→hec 里程碑一次移植，AGENTS §1.12）：见 §6。
- backstop 加固仍另批（破 40% 再评）；暖机恢复 diagnosticLast 可选（建议不动）。

## 6. APK 移植同步点（hec 里程碑 shadow/arbiter 同口径）

- D1：清锚/无立即建议时的 fallback 估计选择（memory HIGH＞FF k eligible＞LUT；immature/provisional 回退 overall；混带 spread≤5%）。
- D2：FF k 平台候选＋混带门＋P0-1 包线（平台与 trim 中心同估计）。
- D3：大缺口参数（gap>30%：常规 6/8 步、静默 1000ms、rescueHot 角度豁免、杯间 ±50% 包线）。
- D4：adaptive 冷启动 flood≥7（固定挡人工值不动）。
- D5：estimateGate/收口快照——shadow 取证可镜像（additive）。
- D6：插件诊断 UI，APK external-flow 不复用。
- 改名：APK 当前无 holdingReference 镜像（rg 证实）→本批无 APK 改动；hec 若镜像 bounded holding 用 **sourceBucketId**。取证脚本读 bounded holdingReference.sourceRunId 者同步改 sourceBucketId（统筹已通知取证接力；历史导出读侧容忍旧名）。

## 7. 别碰

别人未提交/未跟踪（HANDOFF_2026-10-31.md 改动、release/ zips/scripts、.tools/、.gradle/、app/build/、local.properties 等）；记忆数据；灌水量律矢量/两段收口结构/LUT/硬包线/单一写者/影子 sent；APK 仓（本批只插件）；UI 批（用户直管 UI9）；技能 §22 现有文本。

## 8. 复跑索引

- 回归：node decenthyperexplugin.reaplugin/tests/verify_v02253.cjs（870）；node sim/tests/sim-regression.cjs（5）。
- 回放：node D:/vscode/.tools/__d16-replay.cjs <verify.cjs> [plugin.js]（平台/fallback/闭环 gap/整杯；before/after JSON 在 .tools/__d16-{baseline,after}-replay.json）。
- 探针：.tools/__d16-gmdebug.cjs（gm 链路）／__d16-gatedebug.cjs（门因）／__d16-ackdebug.cjs（harness ACK instrumentation，fs.readFileSync 拦截注入 DBG）。
- 数据：D:/vscode/HyperExController/.tools/__live-plugin-history-9.json（17 杯，4 杯 fullRecord 可整杯回放：11/12pred/12/13）。
- 评估来源：HANDOFF_2026-11-19-cup13-design-purpose-eval.md／-diagnostic-semantics-eval.md；实施交接 HANDOFF_2026-11-19-D1-6-impl-relay.md。

## 9. 发版回执（2026-11-19，用户批「2.2.53 发版」，统筹转达全 SOP）

- **基线**：48c58e8（发版批不改码；统筹复跑 870/870 核过）。tag **v2.2.53**=48c58e8953517a0120e5e0b2f26048ef82fa6e39（lightweight，同 v2.2.52 口径）。
- **push**：origin auto-hyperex 1663e24..48c58e8＋new tag v2.2.53（VPN 代理 127.0.0.1:57890）；ls-remote 独立核过 refs/heads/auto-hyperex 与 refs/tags/v2.2.53 均=48c58e8953517a0120e5e0b2f26048ef82fa6e39。
- **包**：release/HyperExPulseFilter_v2.2.53.zip **536730 字节**，SHA256 **9F6B36E6D5B4F507CCADE8F11586BB2880CF503AAAA58DB705017F781DD2DC0E**。git archive v2.2.53 → 9 条目（manifest/plugin/README/LICENSE/两校准 JSON/verify_v02253.cjs/RESULTS_v02253.txt/HANDOFF_v02253.md；handoff 在仓根，构建脚本按 pkg 前缀打包，同 v02252 包布局）。**包内复跑 870/870**＋node --check 通过。
- **GitHub Release**：**451046769**（tag v2.2.53，--latest），asset **RA_kwDOVO5zXc4ttOBi**（HyperExPulseFilter_v2.2.53.zip，536730 字节，state=**uploaded**）。gh token 走 git credential fill 不回显＋HTTPS_PROXY=127.0.0.1:57890；notes=release/notes-v2.2.53.md。
- **夸克**：「夸克网盘/来自：Codex」fileId **dc47cde0ebf64ac281f780d45ce42ae2**（536730 字节，非秒传；CLI 1.0.25，session 1795076203-0tejl9；result 无 notice.text）。
- **平板**：adb mDNS adb-haf6uwvcqcdujzin-trqoCZ._adb-tls-connect._tcp push /sdcard/Download/HyperExPulseFilter_v2.2.53.zip，ls 核 **536730** 字节（2026-11-19 16:13）；**不代装，用户 Decaid 自装**。
- **发版后测杯**（取证接力 01a1eec0 陪杯，§5 待办）：① 正常 base 杯核 c 诊断 firing 字段＋estimateGate；② ③ 清锚首杯 ≈4.0 HIT（D1/D2）；③ 大缺口收敛（D3）；④ 低 base flood≥7 峰≤40（D4）。
- **APK 同步债**不变（§6，full→hec 里程碑）；backstop 加固仍另批。

## 10. 文案批＋资产替换回执（2026-11-19，用户批「替换 github 上面 2.2.53 的内容，那个我还没装，刚好可以看效果」＝交接 §6 选项 b）

- **文案批**：commit **54ffbc0**——manifest.json description 整段替换为用户已确认的 275 字符固定短简介（「我觉得没问题」），其余字段逐字不动；JSON parse ok 2.2.53 275；verify_v02253 870/870 不受影响；diff 仅 manifest.json 一行（1 insertion/1 deletion）。新口径常设：description＝固定短简介＋只写大的功能改动更新，不堆 changelog/不留 Retains；版本细节归 release/notes-vX.md 与 Release body。交接 HANDOFF_2026-11-19-manifest-description-shorten.md（未入库）。
- **tag 移动**：lightweight v2.2.53 由 48c58e8 强制更新到 **54ffbc09614a3b51bca8e2a7d19d8330afd671c4**（与旧 tag 差＝manifest description 一行＋§9 回执文档，**代码零改**）；push auto-hyperex c7278af..54ffbc0＋tag forced update（VPN 57890）。
- **新包**：release/HyperExPulseFilter_v2.2.53.zip **534524 字节**，SHA256 **2940958E2B72E45926896DA8D7D026F865EDF9A1BF19A9A00C4072D0FC7A7195**（git archive v2.2.53@54ffbc0，9 条目；包内 manifest version=2.2.53 descLen=275 核过；**包内复跑 870/870**＋node --check）。旧包 536730 B／9F6B36E6…DC0E superseded。
- **GitHub Release 451046769**：gh release upload --clobber 同名替换，asset 旧 RA_kwDOVO5zXc4ttOBi → 新 **RA_kwDOVO5zXc4ttk2b**（HyperExPulseFilter_v2.2.53.zip，534524 B，state=**uploaded**）。
- **平板**：adb push 覆盖 /sdcard/Download/HyperExPulseFilter_v2.2.53.zip，ls 核 **534524** 字节（2026-11-19 16:45，mDNS）；**不代装**——用户尚未装 2.2.53，将自装新包看短简介效果（同版本 Decaid 不提示更新，手动装）。
- **夸克**：「夸克网盘/来自：Codex」新 fileId **ad8ab50f25744d7daca43291d23ebb00**（534524 B，非秒传，result 无 notice.text）；**旧 dc47cde0ebf64ac281f780d45ce42ae2 保留注 superseded，不删**。
- 红线遵守：不升版本／plugin.js 零改／只 add 本批（manifest.json 已于 54ffbc0 提交；本回执仅 HANDOFF_v02253.md）；gh/adb/push/夸克均提权；token git credential fill 不回显＋HTTPS_PROXY。

