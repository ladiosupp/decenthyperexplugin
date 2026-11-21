v2.2.60：ext/hello fpKey 加性暴露（完整＋numeric 指纹 key、gainMemory 镜像）＋杯末结算可见性（settledRunId/settlingBusy）

本版为 2.2.60 批（用户 11-21 批② fpKey＋批① D）：面向 APK hec 里程碑 C 后半/D 波的加性协议字段与杯末数据窗可见性；**控制律零改**。

## fpKey 加性暴露（批②，user 11-21）

- external-status/hello 共享 payload 加性暴露 `fpKey`（adaptiveHistoryFingerprintKey 完整指纹：校准身份＋LUT 点＋targets＋weights/limits＋release＋温度，与 O1/viBuckets fpKeyMatch 同源）＋`numericFpKey`（numericLearningFingerprintKey，r 证据 numeric 指纹；温度/targets/LUT 点不敏感）。校准上下文不可用时均为 null（与 O1 同门）。
- external-hello 加性暴露 `gainMemory` 只读镜像（normalizeGainMemory 纯函数同格式：buckets＋viBuckets＋meta＋dropped 诊断行），**仅 hello，不进 external-status 轮询 payload**（payload 大小考虑）；服务统筹裁①插件主本＋APK 镜像 pre-cup 刷新；每次读当前主本、不写文件。
- 21 既有协议字段契约逐字不变；APK 消费零新增请求类型（§0 合规）。

## 杯末结算可见性 D（批①，user 11-21）

- finalizeDiagnostics 末尾（summary 定稿＋rememberAdaptiveEvidence 提交＋diagnosticLast 置后）记 `state.settled={runId,at}`；ext-status/hello 尾加 `settledRunId`（＝diagnostics.runId，跨轮询保持至下杯替换，无则 null）＋`settlingBusy`（派生 autoApplyTimer／status∈{scheduled,applying}／runtimeProfileRepairBusy；失败/异常终态 false 且保留 autoApplyLastStatus 诊断）。
- APK 既有 700ms 轮询零新增：settledRunId===diagnostics.runId 且 !settlingBusy → 抓杯末数据。本版只告知「数据定稿＋结算链在跑」；8.5s 窗的 HTTP 可响应性由后续 grace 窗批（2.2.61）解决。

## 测试口径：素材交叉钉原 5 杯标定子集（统筹 relay-9 裁定 b）

- vi-refit-material.json 11-21 被外部扩到 9 杯（杯26–29 为 refit 后活体验证样本，viPlanMl=clamp 后 plan 值另一口径）；标定反推测试钉回命名意图范围的原 5 杯（1795156969813-1/1795162247267-2/1795163773778-3/1795176353006-1/1795217090021-2），反推式与原 5 杯素材不动；rmse 0.831→0.086s、mean err 0.013s 恢复。

## 边界（逐字不动）

控制律/律结构/r/Vi/门/写入面零改；§0；单写者；LUT/记忆不删改；杯末评分数据链（diagnostics {summary,run}／shots）不回退；21 既有协议字段语义不变。manifest version 2.2.60／description 397（≤400）不动。

## 验证

tests/verify_v02260.cjs **968/968**（954 基线＋9 fpKey 加性测试＋5 D 结算字段测试；素材 5 杯交叉 rmse 0.086s；真杯交叉与协议契约禁镜像）；sim-regression **5/5**；node --check 通过；成对写序列回放（base 3cd2cd8 与 base 4922e7a 两轮，history-18 近 4 杯）writes 逐字＋status＋oqTailErr 全同——加性字段与结算派生不进控制实证。

## 装机与后续

装机由用户在 Decaid 里自做（包只推平板 Download/，不代装）。APK 消费点：fpKey→hec C 后半 O1 暖机指纹匹配＋D 波 Vi 完整指纹门；numericFpKey→D2 证据历史 live 门；gainMemory 镜像→pre-cup 刷新；settledRunId/settlingBusy→杯末数据窗取数。grace 窗（250ms→6–8s＋非 idle 顺延＋settlingBusy 语义修正）列为 2.2.61 候选，待宿主只读探针门结论。

详见包内 HANDOFF_v02260.md／README.md；批次细节见本地 HANDOFF_2026-11-21-ext-fpkey-impl.md／settle-d-impl.md／settle-async-assessment.md（不在包内）。

