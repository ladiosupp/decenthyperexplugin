# HANDOFF v2.2.51：S2 平台估计器路由加固（A）＋诊断页回学习入口（③）

> 插件侧 only。用户 11-19 授权「修，合并一起发2.2.51，偏好立即应用最新学习值」——A（选项 1+2）＋③ 合并同包，发版全 SOP 已授权。
> 口径真源 decentplugin §22（§22.1/§22.3/§22.8/§22.11/§22.18）；评估真源 ../HANDOFF_2026-11-19-cup11-platform-estimator-eval.md（未跟踪）。
> 用户 11-19 裁定：manual 尊重不延伸杯内补水平台（§22.18 维持杯间建议侧）；设计意图自动控流为主、manual 仅少量高阶用户。

## 0. 一句话

灌水量律不动（§22.11）。A：平台/trim 读取侧加成熟度门（bandN<3/provisional 回退 overall r）＋band 路由改 baseBand（断杯 10→11 自强化环）。③：诊断页 S1/S2 加 ADAPTIVE 入口，立即应用最新合格学习值，无则清 manual 锚回 auto。杯 11 平台 5.25→3.875、杯 12 预测 4.375→4.125。

## 1. 改动（plugin.js 2.2.51）

- **A① 成熟度门（消费端）**：新增 platformMemoryGain(gm)（~3027）——!local && bandMatched && (bandN<3 || provisional) → 回退 gm.smoothedR（overall 桶 r），否则 gm.r；local 估计不受压。boundedRefillControlBase（~3051）与 liveTrimControlCenter（~8783 blend prior / ~8790 gain-memory 分支）三处消费改用 platformMemoryGain。**不改 gainMemorySuggestion 的 r/bandN/bandMatched 报告**（建议侧 P0-2 依赖）。
- **A② baseBand 路由**：gainMemorySuggestion 选行带 baseBand=commandBandOf(cfg.stage2CommandMlS) 优先（~1682），effectiveBand 降为诊断量（输出新增 effectiveBand 字段）；band=baseBand||stateRow.commandBand||commandBandOf(stateRow.commandMlS)（effective 不可算时回退 baseBand，删 stage 级陈旧带主导）。crossBand 旗标公式不变（stateRow.commandBand vs command/baseBand）。
- **③ ADAPTIVE 入口**：stageTestRow 下拉 S1/S2 加 ADAPTIVE 选项（origin=adaptive 时选中；keep 条件改 shaped||origin==='retained'，S3 不加）；test-command-set 处理体（~10236）mode=adaptive 分支——取 nextShotAdaptiveSuggestion(diagnosticLast) 该 stage 合格建议（usable && ADJUST/LUT COMPENSATE && finite suggestedCommandMlS）→ {mode:'manual',origin:'adaptive',command:snap(clamp(学习值))}（照 autoApply override 结构）；无合格建议 → {mode:'auto',origin:'original',command:null}（清 manual 锚）。编辑区说明文案中英同步（ADAPTIVE 立即应用最新学习指令／从用户手动选回即恢复插件学习）。

## 2. 测试回执

- tests/verify_v02251.cjs **846/846**（837 基线 + A 6 + ③ 3）。基线改动：4 条 P0-2/P0-1 fixture 把污染/immature 行挪到 base 带（新路由下才选中）＋其中 2 条 prev 杯设 manual（拒学习，保持行原样）；版本断言 4 处＋正则钉 1 处升 2.2.51。node --check / manifest JSON 通过。
- A 新增 6：读取侧门 immature→overall（trim center+plan，3.9375）/ mature 带行仍驱动（4.5625）双向 / provisional 回退＋local 不受压（2.5）/ baseBand 路由＋陈旧带回退修（杯 10 形态 center≤4.0、plan≤4.0）/ 闭环注入污染 immature 带行峰≤40% / 建议侧 bandN/bandMatched 报告不变。
- ③ 新增 3：选 adaptive 有合格建议→origin=adaptive＋command=学习值（snap 到 1/16）/ 无建议→清锚 original/auto/command=null / manual→adaptive 清锚后 manual 锚不再 HOLD（学习恢复 ADJUST）。禁镜像断言。
- 闭环（真实 dispatch/tick + 抖动 0/0.6/1.2 + 污染行注入）：峰≤40%、rise≤1.5s、maxCmd≥7、两段收口 complete。

## 3. 杯 6–12 决策级回放（A 前后平台轨迹）

- harness：HEC .tools/__cup11-platform-replay2.cjs（vm 加载 verify harness 驱动真实 stage2StartupPlan/gainMemorySuggestion）；旧律临时包 D:/vscode/.tools/__before2250（git show v2.2.50 plugin.js + verify_v02250）；真机 history-7 fullRecord 做 prior＋最终 gainMemory 快照（决策级近似，同 __s2-fix-replay 先例）。
- 平台 before→after（ml/s）：杯 6 3.875→3.875 / 杯 7 3.875→3.875 / 杯 8 4.375→4.25（门：>=5.0 n1→overall 1.1821）/ 杯 9 4.3125→4.3125 / 杯 10 4.3125→4.125（路由：4.0-5.0→3.0-4.0）/ **杯 11 5.25→3.875**（路由：g2 4.0-5.0 r0.9562 n2→3.0-4.0 r1.2802 n7；旧律 gain 0.9524/flood 8 与现场导出吻合）/ **杯 12 预测 4.375→4.125**（g3 >=5.0 r1.1401 n1→3.0-4.0 r1.2078 n4，降温）。
- 注：回放用最终 gainMemory 快照，杯 10 绝对值与现场（装机 reload 后 diagnosticLast 空→profile-base 3.875）不同；before/after 同输入对比隔离 A 律变更。杯 11 before 与现场一致。

## 4. 发版回执（待填，发版后补）

- 版本 2.2.51 / tag v2.2.51 / 代码 commit（待填）。zip 字节/SHA256（待填）。GitHub Release ID/asset（待填）。夸克 fileId（待填）。平板 Download/ ls 核（待填）。

## 5. APK 移植同步点（同步债，full→hec 里程碑一次移植，AGENTS §1.12）

- **A 改动函数**：platformMemoryGain（新增）/ boundedRefillControlBase / liveTrimControlCenter（gain-memory 分支＋blend prior）/ gainMemorySuggestion 选行带（baseBand 路由＋effectiveBand 诊断）。
- **APK 对应处（只读排查）**：app/www/shadow.js 已移植 updateLiveGain→updateRGain（当杯局部 r）＋liveTrimTick 预测/救急（predictedGS/rescue）＋stage2CupOnset；**未移植跨杯增益记忆/band 路由/补水平台律**（shadow.js 注释明言「APK 侧拿不到跨杯增益记忆，局部估计是可得的最接近先验」）。arbiter.js 是模型仲裁，与 A 无关。
- **hec 切换时需新增**：若 APK 在 hec 档拥有/影子补水平台，需新增移植 gain-memory 桶/band 记忆＋baseBand 读取路由＋platformMemoryGain 成熟度门＋boundedRefillControlBase/liveTrimControlCenter 平台选择，按 2.2.51 口径。当前无 APK 对应物＝新增项。
- **③ 改动**：stageTestRow（诊断 UI 下拉）/ test-command-set adaptive 分支 / UI_LANGUAGE_PAIRS 说明文案。APK 走 external-flow 调流（协议），不复用插件 test-command-set 编辑器；APK 控制中心当前以 full/hec/off 三态为主，无 per-stage manual/adaptive 编辑器。hec 切换时若 APK 需提供「清 manual 回 adaptive」入口，按 ③ 语义（取最新合格建议立即应用／无则清锚）新增。

## 6. 待拍板 / 后续

- 选项 3（FF k 入平台，跟研磨）B 另批；holdingReference.sourceRunId 改名（存桶 ID）另批。
- 装机后测杯 12（取证接力陪杯）：预期平台≈4.125（g3 base 带）、manual 锚若仍 manual 则建议侧 HOLD；③ 入口可从 manual 选回 ADAPTIVE 立即应用学习值。
- 回放残留：g3 3.0-4.0 r1.2078 仍略高于 FF k≈1.257 对应 3.979——base 带记忆与 FF k 的差异由选项 3 处理（本批不动）。

## 7. 别碰 / 红线自检

- 灌水量律/§22.11/LUT/硬包线（0.10–8.00、1/16、上行压力门）/单一写者/full-off-hec/两段收口结构不动；记忆数据不删不改（只读导出）；§22.18 杯间建议侧 manual 锚逻辑不动（③ 只给清 manual 入口）。
- 别人未提交/未跟踪不碰（插件仓 M HANDOFF_2026-10-31.md 等）；commit 只 add 本批（plugin.js/manifest.json/README.md/tests/verify_v02251.cjs/tests/RESULTS_v02251.txt/HANDOFF_v02251.md）。
- 不操作真机出杯（装机/测杯归用户＋取证）；全程中文。

## 8. 复跑索引

- node tests/verify_v02251.cjs（HX_LOOP_REPORT=1 打印闭环峰）。
- node D:/vscode/HyperExController/.tools/__cup11-platform-replay2.cjs <verifyPath>（旧律 D:/vscode/.tools/__before2250/tests/verify_v02250.cjs / 新律 tests/verify_v02251.cjs）。
- 代码锚点（2.2.51）：platformMemoryGain ~3027 / boundedRefillControlBase 消费 ~3051 / gainMemorySuggestion baseBand ~1682＋effectiveBand 输出 ~1704 / liveTrimControlCenter ~8783/8790 / test-command-set adaptive ~10236 / stageTestRow ADAPTIVE 选项（minified）/ 说明文案 UI_LANGUAGE_PAIRS＋fold-testedit。
