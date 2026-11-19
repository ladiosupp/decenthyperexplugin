# HANDOFF v2.2.52：诊断与编辑 UX 加固（非控制律小批）

> 插件侧 only。用户 11-19 批「派插件接力做」——⑤ 小批三项（(c) 诊断字段＋§22.18 文案澄清＋③ UX 歧义修），**改码不发版**（发版另问）。
> 口径真源 decentplugin §22；杯 12 核码 ../HANDOFF_2026-11-19-cup12-observations-eval.md（未跟踪）。

## 0. 一句话

控制律全程不动。(c) cutoff/refill check 加诊断字段补取证缺口；§22.18 backstop 近似界文案澄清（技能文档层）；③ 应用按钮改名＋ADAPTIVE 输入置灰＋草稿预览。verify_v02252 851/851。

## 1. 改动（plugin.js 2.2.52，全非控制律）

- **(c) cutoff 诊断字段**：s2RefillReturnReason 的 p.cutoff（~3305）additive 加 estHistory 快照（slope/stamp/r2）、margin=round(observed−backstop,3)、firingTickMs=t.report.periodMs、firingObservedGS=flow.slope（既有 rawGS/predictedGS/predictedRawGS/decisionGS/thresholdGS/backstopGS/basis/atMs 不变）。refill 期 check（liveTrimTick ~9189）additive 加 rfEst=s2RefillFlowEstimate(t) 的 rawGS/predictedGS/predictedCappedGS/accelGS2/backstopGS/startupStatus。**s2RefillReturnReason/boundedRefillCommand 控制逻辑零改动**（只加输出字段；同 tick 重复调 s2RefillFlowEstimate 因 stamp 不前进不重复 push estHistory）。
- **§22.18 文案澄清**：技能 C:/Users/ladios/.codex/skills/decentplugin/SKILL.md §22.18 加杯 12 核码补注（近似界≤0.85×target＋一个 tick 离散裕量；峰余量主因 retained-water §22.11；backstop 离散化贡献小；2.2.52 诊断字段）＋cutoff bullet 加近似界注。**文档层，独立于插件仓 commit，不改控制律**。
- **③ UX 歧义修**：按钮 APPLY TEST COMMANDS→APPLY SELECTED MODES & COMMANDS（4 处＋UI_LANGUAGE_PAIRS zh「应用所选模式与指令」＋草稿态句语言对）；stageTestRow 加 adSel/adPrev，ADAPTIVE 选中时 input disabled＋adprev 预览 span；新增 adaptiveModePreview（纯函数：取 latestNextShotAdaptive 对应 stage eligible suggestedCommandMlS→「将应用最新学习值 X ml/s（草稿态，按应用生效）」，否则「无新建议（HOLD）→清回 LUT＋armed 学习（草稿态，按应用生效）」）＋wireModeSelects（mode onchange 置灰＋预览，renderTestCommands 末尾调用）。**test-command-set mode=adaptive 分支（~10242）应用语义不动**——只改呈现。

## 2. 测试回执

- tests/verify_v02252.cjs **851/851**（846 基线＋5 新增）。新增：cutoff 诊断字段存在性＋margin 独立复算（rawGS−backstop）＋firingObservedGS=rawGS＋backstop 控制律不变 / refill check 斜率序列（rawGS/predictedGS/backstopGS=4.25/startupStatus）/ 按钮改名（新标签在、旧标签无）/ adaptiveModePreview 学习值与 HOLD/无建议文案 / stageTestRow ADAPTIVE 置灰＋adprev span＋manual 仍可编辑。
- 版本钉 17 处＋文件名＋正则升 2.2.52；node --check / manifest JSON 通过。禁镜像断言（margin 复算、预览文案、HTML 字段存在性）。

## 3. 发版状态

- **改码批，未发版**（用户当次授权只对改码；发版须另批）。无 tag/Release/夸克/平板推送。本地 commit（只 add 本批 6 文件）。

## 4. APK 移植同步点（同步债，full→hec 里程碑，AGENTS §1.12）

- **(c) 诊断字段**：APK shadow.js 取证若镜像插件 cutoff/check 记录，可同步加 estHistory/margin/firingTickMs/斜率序列字段（纯诊断、非控制律）。当前 shadow 记 predictedGS/rescue 决策，cutoff 诊断字段为插件独有→hec 切换时按需镜像。
- **③ UX**：插件诊断页 UI（stageTestRow/test-command-set 编辑器）；APK 走 external-flow 调流（协议），不复用该编辑器、无同款 per-stage 模式选择器→无需移植。hec 切换若 APK 需「清 manual 回 adaptive」入口，按 2.2.51 ③ 语义新增。
- 控制律同步债（A 批 2.2.51 平台路由/成熟度门/baseBand）见 HANDOFF_v02251.md §5；**本批不动控制律，无新增控制律同步项**。

## 5. 待拍板 / 后续

- 发版批准（统筹问用户）；装机后取证陪杯核 cutoff 诊断字段导出（tick 跳变 vs backstop 时序可区分）。
- 选项 3（FF k 入平台）B 另批；holdingReference.sourceRunId 改名另批；backstop 控制律加固（提前量/更密检查）留待破 40% 另批。

## 6. 别碰 / 红线自检

- 控制律（s2RefillReturnReason/boundedRefillCommand/boundedRefillControlBase/liveTrimControlCenter/gainMemorySuggestion 选行/成熟度门/baseBand 路由）零改动；记忆数据/灌水量律/LUT/硬包线/单一写者/两段收口/§22.18 杯间 manual 锚逻辑不动。
- 别人未提交/未跟踪未碰（M HANDOFF_2026-10-31.md 原样）；commit 只 add 本批 6 文件（plugin.js/manifest.json/README.md/tests/verify_v02252.cjs/tests/RESULTS_v02252.txt/HANDOFF_v02252.md）。技能 §22.18 编辑在 ~/.codex/skills（文档层，独立于插件仓）。

## 7. 复跑索引 / 代码锚点

- node tests/verify_v02252.cjs。锚点（2.2.52）：cutoff 记录 ~3305 / refill check ~9189 / adaptiveModePreview＋wireModeSelects（stageTestRow 前）/ stageTestRow adSel/adPrev＋input disabled＋adprev span / renderTestCommands 末尾 wireModeSelects / 按钮＋UI_LANGUAGE_PAIRS。
