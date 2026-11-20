# 2.2.57 scaleSampleGate 秤样本摄入门滤波 · 实施交接（2026-11-20，用户裁 A 续做，改码不发版）

> 派单 HANDOFF_2026-11-20-scale-filter-dispatch.md；冲突上报 HANDOFF_2026-11-20-scale-filter-conflict.md（minGap 门与「正常杯 oq 逐字不变」红线不相容）→ **用户裁 A**：红线放宽为行为级「学习决策＋写序列＋HIT 不变」，接受 scaleSampleGate={minGapMs:60,monotonic:true}。本批续做完成。基线 eb43a9f（2.2.56）。**改码本批授权；发版/push/tag/装机另问**。

## 1. 一句话现状

scaleSampleGate 落地（oq tail 摄入＋Vb3 摄入两处，只作用摄入副本），verify_v02257 **912/912**、sim-regression **5/5**、真实杯全量 liveTrim 写序列回放**近 4 杯逐字相同＋HIT 全不变**，正常杯 oq 微移、杯 23 去噪（18.53→7.71）。归档/soak/whole-phase/控制律零改。

## 2. 改动清单（plugin.js）

- 常量 `SCALE_SAMPLE_GATE=Object.freeze({minGapMs:60,monotonic:true})`（§22.19 常量区后）。
- 新 helper `scaleSampleGate(samples)`：顺序接受，与上一已接受样本 scaleTimestampSeconds 间隔 <60ms 丢弃（压 100Hz flush/dt=0 回 ≤16Hz、保真实 10Hz）；monotonic 拒收负重量增量；tareReset 清 lastStamp/lastWeight 基线；返回新数组，**输入不改**。
- 摄入点 1：controlOutputQuality `const all=scaleSampleGate(phaseRawSamples(run,phase))`（oq tail 滚动回归；S2 学习 observedR 经 gainStageObservation 用同一 tailMeanGS，同源受护）。`whole=diagnosticRawRegression(run,phase)` 在其前独立读原始流，**未 gate**。
- 摄入点 2：s2RefillReturnReason Vb3 `const rs=scaleSampleGate((t.run.rawScaleSamples||[]).filter(stage2,frame1))`。
- **未 gate**：liveTrimRegression（控制律回归，读 phaseRawSamples/rawScaleSamples 原始）／s2RefillFlowEstimate（预测主判）／diagnosticRawRegression（whole-phase）／soakWettingObservation（压力另路）／归档 rawScaleSamples。
- 版本 PLUGIN_VERSION/manifest 2.2.57（description 保持 275）；README 置顶；tests/verify_v02257.cjs＋RESULTS_v02257.txt。

## 3. 验证回执

- **verify_v02257 912/912**（906 基线＋6 gate 行为测试，禁镜像）：100Hz flush 压缩 ≤16Hz 保真实 10Hz／dt=0 stamp 碰撞拒收／负增量拒收且轨迹恢复／clean 10Hz 按引用原样不变／输入数组不被改／真实杯 soak 签名＋whole-phase 回归不变＋噪杯 oq 去噪。版本钉 2.2.57。
- **sim-regression 5/5**。node --check plugin.js/verify 通过。
- **真实杯全量 liveTrim 写序列回放**（自建 harness 喂真实录制 rawScaleSamples 含真实 scaleTimestampSeconds；sim/harness.js 的 runShot 喂 10Hz 规整时钟＋内插重量会丢微簇，不适用，故自建）：近 4 杯（2.2.55 杯 1795131958238-4＋杯 21/22/23）**写序列逐字相同**（6/6/5/3 笔）、status 全 complete、realS2Status 全 HIT。oq tail：干净杯 1795131958238-4 −7.71→−7.71（不动）、杯 21 −0.59→−0.66、杯 22 0.77→0.88（微移）；杯 23 18.53→**7.71**（去噪）、tailMean 5.927→5.385。observedR（整 run 回放）杯 21 1.3037→1.3026、杯 22 1.3001→1.3017、杯 23 1.635→**1.4855**（部分去噪，~1.39 是取证 Hampel 口径不作目标）。
- **soak 不变**：杯 21/22/23 soakRatio 0.5435/0.5747/0.6763 门前后一致（压力另路）。**whole-phase 不变**：杯 23 stage2 diagnosticRawRegression 仍 5.118（归档 s2.rawRegressionGS）。

## 4. 红线遵守

归档 rawScaleSamples 原始不改（门返回摄入副本）；soak 观测不受影响；whole-phase 回归/控制律 liveTrimRegression/硬包线 0.10–8.00 与 1/16/targets/LUT/gain memory 结构/manual 锚/sent 恒 false/单一写者零改；别人 WIP（HANDOFF_2026-10-31.md M）/APK 仓/取证功能区不碰。

## 5. APK 同步债

scaleSampleGate（minGap60＋monotonic，摄入副本，顺序接受＋tareReset 清基线）→ shadow/arbiter 等价物，full→hec 里程碑（与 D1–D6/O1/Va/Vb3/Vd15/2.2.56 新律债合并）。注意 APK 侧须保留真实秤时间戳（含微簇）才能复现门效果。

## 6. 复跑索引

- 回归：node decenthyperexplugin.reaplugin/tests/verify_v02257.cjs（912）；node sim/tests/sim-regression.cjs（5）。
- 写序列回放：node D:/vscode/.tools/__d18-writeseq.cjs <plugin路径>（base=__d18-plugin-base.js=eb43a9f，gate=当前 plugin.js）；对照 __d18-wscmp6.cjs。
- oq/observedR/soak 回放：__d18-replay.cjs；间隔分布 __d18-gapdist.cjs；噪点 __d18-noise2.cjs。
- 数据：history-18（杯 21=1795156969813-1 / 22=1795162247267-2 / 23=1795163773778-3）。

## 7. 待用户/统筹

改码完成，**发版/push/tag/装机另问**。统筹复跑核（verify＋sim＋写序列回放＋diff 红线）后呈用户发版。真杯验：装机后陪杯取证，滤噪点不去真实 boost 过冲（闭环验收用真实峰，杯 23 去尖峰 32.2% 仍>批门 26.3% 不计合格杯，批 2/5；去尖峰数据作 Vi 标定第 3 样本，标定与验收分开——口径统筹已裁，勿改）。
