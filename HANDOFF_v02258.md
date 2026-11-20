# HANDOFF v02258 — scaleSampleGate 摄入滤波（2.2.57）＋gain-memory-restore 维护端点（2.2.58）合批

> 两批合批发版（用户批「走发版链吧，未推的也push」）。两批均无控制律改动。逐处改动/验证/坑见 [HANDOFF_2026-11-20-scale-filter-impl.md](HANDOFF_2026-11-20-scale-filter-impl.md) 与 [HANDOFF_2026-11-20-gain-memory-restore-impl.md](HANDOFF_2026-11-20-gain-memory-restore-impl.md)（本文只做版本级摘要）。基线链：bf8abab（2.2.58）← 50f64d0（2.2.57）← 876f828（2.2.56 回执）。

## 1. 一句话

2.2.57 给瞬时估计摄入副本（oq tail＋Vb3）加 minGap60＋monotonic 摄入门，把秤 100Hz flush／dt=0／负增量噪点压回 ≤16Hz 保真实 10Hz，学习决策＋写序列＋HIT 不变，杯 23 oq tailErr 18.53→7.71；2.2.58 新增 guarded gain-memory-restore POST 维护端点，传历史 gainMemory 快照＋excludeRunId 可原子恢复桶值＋排除指定杯（标记不删）＋diagnosticLast 回最新合格杯，永久维护能力，不自动执行回滚。

## 2. 改了什么

### 2.2.57 scaleSampleGate（50f64d0）

- 常量 `SCALE_SAMPLE_GATE=Object.freeze({minGapMs:60,monotonic:true})`＋helper `scaleSampleGate(samples)`：顺序接受／与上一已接受样本 scaleTimestampSeconds 间隔 <60ms 丢弃／负重量增量拒收／tareReset 清 lastStamp/lastWeight 基线／返回摄入副本输入不改。
- 摄入点 1：controlOutputQuality oq tail 滚动回归（S2 学习 observedR 经 gainStageObservation 同源 tailMeanGS 受护）；摄入点 2：s2RefillReturnReason Vb3 instantCross rs。
- 未 gate：liveTrimRegression（控制律）／s2RefillFlowEstimate（预测主判）／diagnosticRawRegression（whole-phase）／soakWettingObservation（压力另路）／归档 rawScaleSamples。
- 用户裁 A：红线为行为级「学习决策＋写序列＋HIT 不变」，正常杯 oq 微移接受（minGap 门与「oq 逐字不变」物理不相容，冲突留档 HANDOFF_2026-11-20-scale-filter-conflict.md）。

### 2.2.58 gain-memory-restore（bf8abab）

- plugin.js：`restoreGainMemoryFromSnapshot`（4276）／`gainMemoryRestoreSummary`（4314）／端点 gain-memory-restore（10665，仿 history-review 守卫）。
- manifest.json：version 2.2.58＋api surfaces 加 {id:"gain-memory-restore",type:"http"}；description 保持 275（§1.15）。
- 守卫：idle＋!calibrationActive＋!curveApplyBusy＋autoApply 非 applying＋persistentHistoryAvailable＋storageProbeVerified＋persistentHistoryLoaded。校验：normalizeGainMemory 无 dropped＋非空桶＋excludeRunId 是任一桶 s2 最新贡献者（通用化不限 g2）＋fingerprintKey 匹配当前校准＋basket coffee＋reason enum＋指定杯 row 存在。
- 原子：①file.gainMemory=快照 ②setLearningHistoryReview 排除指定杯（标记不删＋取消 scheduled apply）③persistHistoryFile 一次写入快照＋排除＋readback ④diagnosticLast 指向被排除杯则置 null＋O1 restore 回最新合格杯；返回各桶 s2/s3 r/n/dev/confidence＋指定杯 review＋diagnosticLast.runId 读回证据。
- 只恢复状态不改控制律：恢复桶后下一杯 base 是律输出（干净 cup22 桶给 3.8125 bandR HIGH 路径，非固定 3.625），端点不强制也不断言特定 base。

## 3. 没动什么（逐字）

控制律 liveTrim／§22.19 自适应灌水律／两段收口 bleed→return／taper 只降不升／Q2 平滑链（coast／up-hold／治理链／死区／quanta／静默 1200／ceiling）／硬包线 0.10–8.00 与 1/16 档／压力门／ACK／写入预算／单一写者／影子 sent 恒 false／LUT 不被学习改写／gain memory 结构／manual 锚／Va／Vb3／Vd15／O1／cutoff predicted 主判／backstop 0.85／归档原始流／soak 观测／whole-phase 回归。

## 4. 验证

- tests/verify_v02258.cjs **926/926**（912 基线＝2.2.56 的 906＋2.2.57 的 6 gate 行为测试；14 新增端点断言，禁镜像）。tests/RESULTS_v02258.txt 为实跑输出。
- sim/tests/sim-regression.cjs **5/5**；node --check plugin.js／verify 通过；manifest JSON 合法 version=2.2.58 descLen=275。
- 2.2.57 真实杯全量 liveTrim 写序列回放（自建 harness 喂真实录制样本含真实 scaleTimestampSeconds）：近 4 杯（含 2.2.55 干净杯）写序列逐字相同＋HIT 全不变；正常杯 21/22 oq 微移无决策翻转；杯 23 tailErr 18.53→7.71／observedR 1.635→1.4855（部分去噪，~1.39 是取证 Hampel 口径不作目标）；soak 杯 21/22/23 0.5435/0.5747/0.6763 与 whole-phase 杯 23 stage2 5.118 不变。
- 2.2.58 离线真文件恢复回放 PASS：活态杯 23 污染文件→恢复→g2 s2 r1.3213/n19 HIGH、s3 r1.9754/n17 HIGH／杯 23 excluded 保留（shots80/evidence 在）／diagnosticLast 回杯 22（1795162247267-2）／持久化一致。

## 5. APK 移植同步点（full→hec 里程碑）

scaleSampleGate（minGap60＋monotonic，摄入副本，顺序接受＋tareReset 清基线）→ shadow/arbiter 等价物，与 D1–D6／O1／Va／Vb3／Vd15／2.2.56 新律债合并；APK 侧须保留真实秤时间戳（含微簇）才能复现门效果。gain-memory-restore 为插件 REST 维护端点，本批无 APK 改动。

## 6. 用户裁定记录

1. 2.2.57 裁 A 续做：红线放宽为行为级「学习决策＋写序列＋HIT 不变」，正常杯 oq 微移接受。
2. 杯 23 回滚本身暂缓不执行（污染态保留、不动平板活态）；回退端点写进插件作永久维护能力，「以后再一起发版」。
3. 合批发版批准：「走发版链吧，未推的也push」（11-20）。
4. 回滚机制定案前不出杯（避免污染态 base3.0 欠流）；下一杯 base 以用户/统筹后续裁定为准。

## 7. 下一步

- 用户在 Decaid 自装；装机后陪杯取证验滤噪（不去真实 boost 过冲，闭环验收用真实峰；杯 23 去尖峰 32.2% 仍>批门 26.3% 不计合格杯，批 2/5；去尖峰数据作 Vi 标定第 3 样本，标定与验收分开）。
- 杯 23 回滚执行待用户授权＋机制定案；若执行用本端点（杯 22 快照 D:/vscode/.tools/__d16-rb-gm-cup22.json，excludeRunId=1795163773778-3，reason scale-or-cup-disturbance）。
- Vi 重拟合待用户批（标定素材 3 杯含 23 去尖峰）。

