# 2.2.60 D 结算可见性（settledRunId＋settlingBusy）· 实施交接（2026-11-21，用户批①，改码本批授权）

> 统筹 relay-9 派单（用户 11-21「1，2，3，push都同意」：①D 并入 2.2.60；②grace 窗批授权；③发版次序 D→2.2.60、grace→2.2.61）。评估依据 [HANDOFF_2026-11-21-settle-async-assessment.md](HANDOFF_2026-11-21-settle-async-assessment.md)。基线 4922e7a（2.2.60 fpKey 批终）。**版本不升（2.2.60 未发版）；纯读取派生，零控制律改；发版待统筹核后派。**

## 1. 改动

- **plugin.js**（2 hunk）：①finalizeDiagnostics 末尾（state.diagnosticCurrent=null 后）记 `state.settled={runId,at}`——summary 已定稿＋rememberAdaptiveEvidence 已提交＋diagnosticLast 已置；②externalStatusPayload return 尾加 `settledRunId`（state.settled 有则 String，无则 null）＋`settlingBusy` 派生 `!!(autoApplyTimer || runtimeProfileRepairBusy || status∈{scheduled,applying})`。hello 继承（同 payload）。
- **verify_v02260.cjs**：＋5 断言（963→968）——settled 与 diagnosticLast/diagnostics runId 一致性＋finalize 后立即可见；settlingBusy 派生沿时序（scheduled/applying/timer/repair→true；applied/waiting/error→false 且保留 message 诊断）；settledRunId 跨轮询保持至下杯替换；21 既有字段契约不变＋默认 null/false；杯末评分数据链回归（summary 6 键＋diagnostics {summary,run} runId 一致）。
- **README.md**：2.2.60 段加 D 说明＋验证数 968。
- **RESULTS_v02260.txt**：实跑重生成（968/968）。

## 2. 语义契约（APK 消费）

- `settledRunId`：最近一次杯末结算完成的 runId（＝diagnostics.runId）；从 finalize 起可见，跨轮询保持，下一杯结算时替换；从未结算→null。
- `settlingBusy`：杯末结算链忙（autoApply 定时器排程中/应用中的 profile 同步/其它 repair）；true 时 APK 短退避；false 且 settledRunId===diagnostics.runId → 可安心抓杯末数据。失败/异常终态→false（数据仍可用，autoApplyLastStatus 保留 error message）。
- 注意：本字段只告知「数据已定稿」与「结算链是否在跑」；8.5s 数据窗的 HTTP 可响应性由阶段 2 grace 窗批（2.2.61）解决。

## 3. 验证

- verify_v02260 **968/968 EXIT0**；sim-regression 5/5；node --check plugin.js/verify 通过。
- **成对写序列回放**（base 4922e7a vs 新，history-18 近 4 杯）：**D_WRITESEQ_VERBATIM=true**（writes 逐字＋status＋oqTailErr 全同）→纯读取派生不进控制实证。取证 .tools/__d-ws-base.json／__d-ws-new.json。

## 4. 红线遵守

控制律零改（仅 finalize 状态标记＋payload 字段）；§0 杯末非萃取请求；单写者/LUT/记忆不删改；杯末评分数据链不回退（5 断言钉）；别人 WIP 不碰；.tools 探针 untracked。

## 5. 阶段 2（grace 窗，2.2.61，待本批核过＋2.2.60 发版后）

宿主只读探针（出站 pending 时入站投递性）→ 方案 a（250ms→6–8s grace＋非 idle 顺延＋restoreManualApplySchedule 重排）＋settlingBusy 语义修正（分「等窗口」与「真占用」；settled 新鲜时 APK 可直接取）＋结算时序契约验证（下杯竞态守卫/full-hec 一致/失败路径）＋杯29 类实证。版本升 2.2.61。

## 6. 复跑索引

- node decenthyperexplugin.reaplugin/tests/verify_v02260.cjs（968）；node sim/tests/sim-regression.cjs（5）。
- 成对回放：node D:/vscode/.tools/__d18-writeseq.cjs <plugin路径>（base .tools/__d-plugin-base.js=4922e7a）。
- 代码锚点：rg "state.settled=" plugin.js（finalize）／rg "settledRunId" plugin.js（ext-status）。

