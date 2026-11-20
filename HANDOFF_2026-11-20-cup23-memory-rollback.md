# 杯23 增益记忆回滚批（2026-11-20，只读调查＋恢复源验证＋回滚机制方案；改码须授权）

> 统筹派单（用户明说授权写记忆＝硬规矩例外）：撤杯23（1795163773778-3 scale-noise 异常杯）对增益记忆的污染更新，恢复杯22 末态。relay-7 路由新统筹 01a1f85c-09ce-7301-a2ac-bb7162f0d278。取证 a 标记（训练 universe scaleNoise 类＋三管线＋Vi 第3样本）已完成统筹核过。基线 2.2.56 HEAD eb43a9f（branch auto-hyperex）。本批已完成只读调查＋恢复源验证＋机制设计；**恢复 gainMemory 桶值须加 guarded 插件端点（改码），按 AGENTS 20＋派单「若需改插件代码实现回滚机制则另报统筹」呈批待授权。未改仓 plugin.js（HEAD eb43a9f 不动）、未动平板活态。**

## 0. 结论先行

- **活态确认污染仍在**（只读 REST）：g2 s2 r1.4939/n20/dev23.7%/observedR1.635/lastRunId=杯23；s3 r2.1466/n18/dev15.8%；workflow base=3.0（杯23 auto applied @08:37:32Z）；杯23 插件侧 learningReview=null（尚未排除）。注：取证 a 标记是训练 universe 侧（universe-exclusions），与插件活体 learningReview 是两套独立机制，本批做后者。
- **恢复源已验证＝history-17.gainMemory**（exportedAt 08:14:38Z＝杯22 完成后、杯23 之前）：g2 s2 r1.3213/n19/dev1.8%/observedR1.3001/HIGH；s3 r1.9754/n17/dev0.8%/observedR1.9893/HIGH；center0.407/radius0.08；8 桶 g2..g9 seq9 dropped[]。**与目标逐字一致**。恢复 swap 仅 g2 变（g3..g9 与活态逐字同，杯23 只动 g2），杯23 保留标记不删。
- **无改码路径穷尽（四证）**：① 平板未 root（su 不存在）＋ReaPrime（net.tadel.reaprime）非 debuggable（run-as 拒）→ adb 不能访问 pluginStorage 物理文件；② ReaPrime 无 pluginStorage REST 端点（/storage、/storage/<key>、/state、/api/v1/storage 全 404）；③ 插件无 gainMemory 恢复端点（gainMemoryState 只 normalize 持久化对象、不从 shots 重建；history-review 只排除不恢复桶值；history-import 只 merge shots 不动 gainMemory）；④ CDP WebView 可达（pid29997）但引擎函数 IIFE 闭包私有（harness 须 inject hooks 才暴露），只能调既有 REST。→ **恢复桶值必须改插件代码加端点**。
- **base3.625 可无改码设**（test-command-set/adaptive-next-apply），但须先恢复 gainMemory＋排除杯23 使 diagnosticLast=杯22，adaptive-next-apply 才复现杯22 建议 3.625（杯22 实际已应用 3.625 统筹核过，同态必同建议）。当前 audit proposal.s2 虽=3.625 但出自污染 gainMemory，须恢复桶值才是干净 3.625。

## 1. 活态证据（只读 REST，adb forward tcp:18080→8080，-NoProxy）

- status.commandFlows：stage2CommandMlS=**3**，adaptiveSource.runId=杯23 mode=auto appliedAt=2026-11-20T08:37:32Z；stage1=1.813／stage3=0.625（shape early0.313/mid0.625/late0.625）；flowMultiplier0.950。
- adaptive-audit：proposal.curveCommands.s2=3.625，proposalMatchesWorkflow=**false**（workflow 3.0）。
- history-export gainMemory g2：s2 r1.4939 n20 lastDev0.2374 lastObservedR1.635 cmd3.625 band3.0-4.0 lastRunId杯23 updatedAt08:37:25Z bands{3.0-4.0:r1.4887/n14/steadyN9}；s3 r2.1466 n18 lastDev0.1576 lastObservedR2.2867 bands{<1.0:r2.1435/n16/steadyN12}；center0.407 samples[0.4238,0.4111,0.3839,0.4444,0.4029,0.3892]。
- 杯23 shot present，learningReview=null，result=completed at 102.80g。phase=idle。gainMemory seq9 lastBucketId g2 buckets g2..g9。

## 2. 恢复源验证（history-17＝杯22 末快照）

- history-17 exportedAt 2026-11-20T08:14:38Z（杯22 completed 08:11:56Z 后、杯23 started 08:36:13Z 前）。
- g2 s2 r1.3213/n19/lastDeviation0.0182/lastObservedR1.3001/commandMlS3.875/lastRunId杯22；s3 r1.9754/n17/lastDeviation0.008/lastObservedR1.9893/commandMlS0.75/lastRunId杯22；center0.407/radius0.08/samples[0.3975,0.4238,0.4111,0.3839,0.4444,0.4029]。
- 8 桶 g2..g9，seq9，lastBucketId g2，dropped[]。**恢复 swap 仅 g2 变**（探针实证 changedBuckets=["g2"]，g3..g9 与活态逐字同）。
- confidence HIGH 由 gainConfidence(n≥3 && dev≤GAIN_MEMORY_DEVIATION) 算出（n19 dev1.8%→HIGH ✓）；alpha0.12 是正常笔阻尼（gainBackfillAlpha normal>0→0.12），非持久化字段，恢复态自然复现。快照 r 值均在 normalizeGainMemory 界内（无 dropped）。
- 载荷已备：.tools/__d16-rb-gm-cup22.json（gainMemory 快照 8495B）；.tools/__d16-rb-restored-candidate.json（整文件恢复候选＝活态结构 gainMemory←快照＋杯23 learningReview.excluded reason scale-or-cup-disturbance，保留杯23 shot 不删）。

## 3. 回滚机制方案（改码，呈批待授权）

**最小改码：新增 guarded 端点 gain-memory-restore**（POST，plugin.js onRequest 内，仿 history-review 守卫）：

- 守卫：phase idle && !calibrationActive && !curveApplyBusy && autoApply 非 applying && persistentHistoryAvailable && storageProbeVerified && persistentHistoryLoaded。
- body：{gainMemory:<快照>, excludeRunId:"1795163773778-3", excludeReason:"scale-or-cup-disturbance", fingerprintKey:<当前校准指纹>}。
- 校验：normalizeGainMemory(快照) 无 dropped；当前 g2.stages.s2.lastRunId===excludeRunId（确认撤的是杯23）；fingerprintKey 匹配当前（防跨校准恢复）；basketContext coffee。
- 原子动作：① file.gainMemory=normalizeGainMemory(快照)；② 复用 setLearningHistoryReview 排除杯23（learningReview.excluded＋log＋取消 scheduled apply）；③ persistHistoryFile()＋readback；④ restoreAdaptiveHistoryFromPersistentFile()（重建证据，diagnosticLast=杯22）。
- 返回读回证据：g2 s2/s3 r/n/dev/confidence＋杯23 review＋diagnosticLast.runId。
- 随后调既有 **adaptive-next-apply**（applyNextShotAdaptiveSuggestion(diagnosticLast=杯22,"manual")）→ workflow base3.625＋机器上传 ack（单一写者仍是插件）。
- 红线：只撤杯23（g2 swap＋杯23 标记），g3..g9/LUT/manual 锚/硬包线/sent/单一写者不动；杯23 保留不删；端点三重守卫（idle＋指纹＋lastRunId）防误用。
- 验证计划（授权批内）：verify_vXXXX 新增端点断言（守卫/校验/原子/读回，禁镜像）＋sim-regression 5/5＋离线 harness 恢复回放（活态污染文件→恢复→g2=杯22 值/杯23 excluded/nextShotAdaptiveSuggestion(杯22).s2=3.625）＋真机读回（g2 s2 r1.3213 n19 HIGH／s3 r1.9754 n17 HIGH／center0.407／base3.625／杯23 excluded 不再 applied）。
- 部署：改 plugin.js→打包 zip→推平板 Download/→用户 Decaid 自装→REST 调 gain-memory-restore＋adaptive-next-apply→读回。不需 GitHub Release/夸克正式发版（派单「不需发版」），但插件须装机生效（用户装）。

## 4. 待授权 / 冲突

- **改码授权**（AGENTS 20＋派单「改码另报统筹」）：新增 gain-memory-restore 端点属插件代码改动，须用户/统筹批。本批未改仓 plugin.js（HEAD eb43a9f 不动）、未动平板活态。恢复载荷＋机制设计已就绪，授权后即可实施＋验证＋装机＋执行＋读回。
- 无控制律改动（端点只恢复状态，不改灌水律/学习律/硬包线）；与 §22 无冲突（记忆回滚是用户明说授权的硬规矩例外）。
- 取证 a 标记（训练 universe scaleNoise）已完成；本批做插件活体 learningReview 排除＋gainMemory 恢复（两套独立互补）。下一杯 base 以回滚后 3.625 为准。

## 5. 红线 / 复跑

- 只读调查未改仓/未动平板；探针 .tools（__d16-rb-*.ps1/cjs/json，untracked，仓库不动）。
- 复跑：__d16-rollback-read.ps1（活态只读）；__d16-rb-parse2.cjs（base/proposal）；__d16-rb-gm17.cjs（恢复源）；__d16-rb-payload.cjs（swap 范围验证）；__d16-rb-storage-probe.ps1／__d16-rb-rest-probe.ps1（无改码路径四证）。
- 代码锚点：gainMemoryState 1334（normalize 不重建）／updateGainMemoryFromRun 1620（逐杯增量）／setLearningHistoryReview 4213（排除）／historyLearningStatus 4151／restoreAdaptiveHistoryFromPersistentFile 4401／adaptive-next-apply 10735／normalizeGainMemory 1291／STORAGE_HISTORY_FILE=adaptiveHistoryFileV2 292／ID=decenthyperexplugin.reaplugin 7。

