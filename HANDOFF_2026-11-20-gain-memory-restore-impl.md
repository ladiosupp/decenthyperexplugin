# 2.2.58 gain-memory-restore 回退维护端点 · 实施交接（2026-11-20，改码不发版）

> 用户 11-20 批：杯23 回滚本身**暂缓不执行**（污染态保留、不动平板活态）；但把 gain-memory-restore 回退端点写进插件作为以后类似秤噪点污染的**永久维护能力**；**改码本批授权，发版/push/tag/装机押后**（「以后再一起发版」）。统筹 relay-7 路由 01a1f85c-09ce-7301-a2ac-bb7162f0d278。设计依据 HANDOFF_2026-11-20-cup23-memory-rollback.md §3（统筹核过）。基线 50f64d0（2.2.57 scaleSampleGate，01a1f67b 本地未推）；本批版本候选 2.2.58。技能 §22.19 现行，记忆相邻已读。

## 1. 改动清单（只 add 本批文件）

- **plugin.js**：①PLUGIN_VERSION 2.2.57→2.2.58；②新 helper restoreGainMemoryFromSnapshot(body)（4276）＋gainMemoryRestoreSummary(gm)（4314），插在 setLearningHistoryReview 后；③新端点 gain-memory-restore（10665，仿 history-review try/catch＋calibrationStatusPayload）。
- **manifest.json**：version 2.2.58；api surfaces 加 {id:"gain-memory-restore",type:"http"}（history-review 后）；description 保持 275（§1.15）。
- **tests/verify_v02258.cjs**（926）＋tests/RESULTS_v02258.txt；README 2.2.58 置顶。
- 别人 WIP（HANDOFF_2026-10-31.md M）/APK 仓/取证功能区不碰；.tools 探针 untracked 不入库。

## 2. 端点设计（通用化，不硬编码任何杯）

- body：{gainMemory:<快照>, excludeRunId:<string>, excludeReason:<enum>, fingerprintKey:<string>}。
- 守卫：phase idle && !calibrationActive && !curveApplyBusy && autoApply 非 applying && persistentHistoryAvailable && storageProbeVerified && persistentHistoryLoaded。
- 校验：normalizeGainMemory(快照) 无 dropped＋非空桶；**excludeRunId 是当前某桶 s2 的最新贡献者（live.buckets.some(b=>b.stages.s2.lastRunId===excludeRunId)）**；fingerprintKey===adaptiveHistoryFingerprintKey(adaptiveHistoryFingerprint())；basketContext coffee；excludeReason∈{operator-mistake,plugin-fault,scale-or-cup-disturbance,other}；指定杯 row 存在。
- 原子：①file.gainMemory=normalized；②setLearningHistoryReview({runId:excludeRunId,excluded:true,reason})（排除＋log＋取消 scheduled apply＋restore＋persist 一次写入快照＋排除）；③若 diagnosticLast.runId===excludeRunId 则置 null＋restoreDiagnosticLastFromPersistentFile()（回最新合格杯）；④返回读回证据 {ok,restored,excludeRunId,excludedReview,diagnosticLastRunId,before,after:{各桶 s2/s3 r/n/deviationPct/confidence/lastRunId},persistedState}。
- **通用化说明**：派单守卫原文「当前 g2.s2.lastRunId===excludeRunId」，g2 是杯23 恰好污染的桶；为永久维护能力通用化为「任一桶 s2 最新贡献者匹配」（杯23 场景即 g2，满足原守卫且不限桶）。
- **diagnosticLast 刷新细节**：setLearningHistoryReview 只给 diagnosticLast 标 excluded、不会换杯（restoreDiagnosticLastFromPersistentFile 仅在 diagnosticLast 为 null 时重建）；故 helper 显式置 null 再 O1 restore，才回到最新合格杯（统筹口径要求）。O1 restore 只读载体，无记忆/LUT/机器写。

## 3. 验证口径更正（统筹离线辨明，重要）

- **恢复桶后下一杯 base 是律输出，非固定值**。本交接前篇 cup23-memory-rollback.md 曾预告「复现杯22 建议 3.625」——**更正**：统筹 __relay7-b-mechanism.cjs 离线实证干净 cup22 桶给 **3.8125（bandR HIGH 路径）**，非 3.625（3.625 是杯22 当时已应用值，与「杯22 末态对下一杯的建议」不同）。base 随律路径变，**端点不强制也不断言特定 base**。
- verify 断言口径＝「桶值恢复到传入快照＋指定杯 excluded＋读回一致＋守卫/校验/原子」，**不断言特定 base 数值**。离线回放证「污染文件→恢复→g2=快照值/指定杯 excluded/diagnosticLast 回最新合格杯」。

## 4. 验证回执

- **verify_v02258 926/926**（912 基线＋14 端点断言，禁镜像）：恢复桶值到快照（g2 s2 r1.3213/n19/dev1.8/HIGH、s3 r1.9754/n17/dev0.8/HIGH）／指定杯 excluded 保留不删（shots 数不变＋evidence 在＋杯22 evidence 不动＋LUT 不动）／diagnosticLast 回最新合格杯／它桶 g3 不动／原子持久化（一次写入快照＋排除）／守卫（non-idle/unverified storage/bad reason/non-coffee/fingerprint mismatch·missing/非最新贡献者/dropped 快照/空·malformed 快照）／不断言特定 base（律输出有限正数即可）／HTTP 端点 200 无机器上传／409 不改态／manifest surface＋descLen275＋源码端点存在。版本钉 2.2.58（manifest/plugin/calibrationStatusPayload/external-status/生成页 HYPEREX v）。
- **sim-regression 5/5**。node --check plugin.js/verify 通过。manifest JSON parse ok descLen275。
- **离线真文件恢复回放 PASS**（.tools/__d16-gm-replay.cjs，vm 加载 shipped plugin.js 注入 hooks）：活态杯23 污染文件 __d16-rb-history.json（g2 s2 r1.4939/n20/lastRunId杯23、s3 r2.1466/n18）＋杯22 快照 __d16-rb-gm-cup22.json → restore → g2 s2 r1.3213/n19/dev1.8/HIGH、s3 r1.9754/n17/dev0.8/HIGH；杯23 excluded（scale-or-cup-disturbance）保留（shots80/evidence 在）；diagnosticLast 回杯22（1795162247267-2）；持久化 g2 r1.3213＋杯23 excluded。**注**：离线回放把 live shots 指纹对齐到 fixture 校准（live 校准与 fixture 不同），指纹守卫本身由 verify 指纹断言独立验。

## 5. 红线遵守

只恢复传入快照＋排除指定杯；其余桶（g3..g9）/LUT/manual 锚/硬包线 0.10–8.00 与 1/16/targets/gain memory 结构/sent 恒 false/单一写者零改；杯保留不删（annotation）；三重守卫（idle＋指纹＋最新贡献者）防误用；**无控制律改动**（端点只恢复状态，不改灌水律/学习律/治理链）。别人 WIP 不碰。

## 6. 授权边界 / 待后续

改码本批授权已完成；**发版/push/tag/装机押后**（用户「以后再一起发版」，与 2.2.57 scaleSampleGate 合批）。统筹复跑核（verify＋sim＋离线回放＋diff 红线审）后落档待合批发版。杯23 污染态保留不执行 restore（用户裁暂缓）；下一杯 base 以用户/统筹后续裁定为准（回滚机制定案前不出杯，避免污染态 base3.0 欠流）。

## 7. 复跑索引

- 回归：node decenthyperexplugin.reaplugin/tests/verify_v02258.cjs（926）；node sim/tests/sim-regression.cjs（5）。
- 离线真文件恢复回放：node D:/vscode/.tools/__d16-gm-replay.cjs（REPLAY_RESTORE_PASS）。
- 编辑/核验探针：.tools/__d16-gm-edit.cjs（精确替换）／__d16-gm-check.cjs（落位）／__d16-mkverify58.cjs（verify 生成）／__d16-v58fix.cjs（g3＋版本钉修）。
- 代码锚点：restoreGainMemoryFromSnapshot 4276／gainMemoryRestoreSummary 4314／端点 10665／setLearningHistoryReview 4247（复用）／gainMemoryState 1343／normalizeGainMemory 1300／restoreDiagnosticLastFromPersistentFile（O1）／adaptiveHistoryFingerprintKey 4278。

