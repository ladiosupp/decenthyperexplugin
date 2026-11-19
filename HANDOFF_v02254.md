# HANDOFF v02254 — O1 估计载体暖机（2.2.54 候选，改码完成待发版批）

> 2026-11-19 插件对话（接 2.2.53 发版＋晚段 tail 评估）。用户批「暖机恢复 diagnosticLast，同意批」（O1）；**Q2 用户不批「坚持平滑度优先」——O2/O3 不做**，coast 8%／up-hold／治理链／死区全不动，§22.13 维持（whole HIT＋平台平直＝设计达成，tail ±4% 不作硬指标）。改码本批授权，**发版/装机/push 另问**。统筹 01a1f239-4de7-7213-bca0-f947b70c0c1b。
> 一句话现状：**2.2.54 已发版**（用户 11-19 批「2.2.54 发版」，统筹转达全 SOP）。代码 aa93338＋本回执；tag v2.2.54=aa93338；GitHub Release 451186657／asset RA_kwDOVO5zXc4tuyEp（uploaded）；夸克 b89cb2fe7ce74e93bc1cd2d14f087794；平板 Download/ 已推核过（用户 Decaid 自装）。详见 §8。

## 1. 本轮改动（plugin.js 2.2.53→2.2.54，估计侧，控制律零改）

- **restoreDiagnosticLastFromPersistentFile()**（新函数，restoreAdaptiveHistoryFromPersistentFile 末尾调用）：diagnosticLast 空＋phase idle＋!calibrationActive＋persistentHistoryAvailable===true＋fingerprint 可算时，从持久化 shots **由新到旧**取第一个合格杯重建只读 run 落 diagnosticLast（restoredFromDisk=true）。
- **合格门（陈旧先验风险 bound）**：profileTruthSchema===3＋profileTruthVerified＋!observationOnly＋algorithmIntervention≠off＋**完整 fingerprint key 相等**（adaptiveHistoryFingerprintKey，含校准身份 mapCreatedAt＋LUT 点＋targets＋weights/limits＋release＋温度）＋basketContext 匹配＋historyLearningStatus(row).eligible＋result completed＋**fullRecord.samples 非空**（仅最近 HISTORY_FULL_SHOTS=4 杯；trimmed 杯不恢复）＋重建后 trustedAdaptiveRun 复核。
- **为何用完整 key 而非 numericLearningFingerprintKey**：numeric 键按设计排除 targets/shotSettings（证据兼容用）；重建 config 的 weights/limits 从当前 cfg 拷贝喂重量敏感消费方（controlOutputQuality/s2RefillPumpEstimate），完整 key 相等保证这些值与持久化杯一致——任何设置变更即拒恢复。commands/targets/LUT commands/shape 从 row.commands（diagnosticRunCommandSnapshot）重建；releaseMode/activeRelease/algorithmIntervention/experimentalLiveTrim/flowMultiplier 从 row 顶层；adaptiveLearningLevel/s3DriftModel 取当前 cfg（新建议用当前策略）。
- **只读保证**：不写 persistentHistoryFile／不写 storage／不改 gainMemory 学习值／不发机器指令／不触发 autoApply。pending scheduled apply 经既有 restoreManualApplySchedule 恢复（diagnosticLast.runId===previousStatus.runId 时），autoApplyNextShotIfEligible 的 runId/status 门防重复。暖机杯（diagnosticLast 非空）函数首行 return，逐字不受影响。
- **消费路径（既有，零改）**：boundedRefillControlBase/liveTrimControlCenter/s2FfPlatformCandidate/gainMemorySuggestion/s2RefillPumpEstimate/nextShotAdaptiveSuggestion/③ adaptive 入口——diagnosticLast 有值即消费，D1/D2 路径自动可用。
- 版本：PLUGIN_VERSION/manifest version 2.2.54；**manifest description 保持 275 字符短简介不动**（2.2.53 文案批口径：固定简介，不堆 changelog）；README 置顶 2.2.54 节。

## 2. 验证回执（全绿）

- node --check ✓；manifest JSON parse ✓（version 2.2.54，description 275）。
- **tests/verify_v02254.cjs 880/880**（870 基线＋O1 10 新增，禁镜像）：冷启动恢复＋gain-memory 消费／完整 fingerprint 门（mapCreatedAt＋stage2Weight 两变体）／basket 门／排除杯（learningReview/observationOnly/manual stop）跳过取最近合格／live prior 不覆盖／trimmed samples 不恢复／FF k 暖机路径（feed-forward-k 4.0625）／只读（shots JSON＋学习 r/n＋storage 写计数不变）／idle＋storage 验证＋calibration 三门／off＋unverified 跳过。
- **sim/tests/sim-regression.cjs 5/5**。
- **O1 冷启动回放**（探针 D:/vscode/.tools/__d16-o1-replay.cjs，history-10 真实持久化数据，杯 15 场景；before=2.2.53 插件 git show 966e3c7 提取）：
  - cold before：restored null，controlSource **profile-base**，platform **2.5**，gm null（证据行 20 已在 adaptiveHistory，但载体缺失不消费）。
  - cold after：restored **1795078937216-1**（杯 15，restoredFromDisk），controlSource **feed-forward-k**，platform **4.0625**（k1.2308；gm HIGH r1.2821→3.875 后备），return 4.0625，flood 7.3125。
  - warm 对照：before/after **逐字相同**（priorUnchanged=true，feed-forward-k 3.9375）——暖机杯零影响。
  - 预期杯 15 类尾偏移：base 4.0625×实际 r≈1.28–1.30→flow≈5.2（whole +2–4% HIT）；gm 后备 3.875→≈5.0。较 before 的 −6.91% 静态偏移消除。（k vs gm 选择是 D2 既有策略，非 O1 改动。）
- 红线复核：控制律/灌水律/两段收口/硬包线/单一写者/影子 sent/LUT/记忆数据/manual 锚代码零改。

## 3. 技能补注（只加不改，统筹复核）

SKILL.md **§22.3 末**「2.2.54 估计载体暖机（2026-11-19 用户批 O1）」——载体恢复口径＋完整 fingerprint 门理由＋只读保证＋§22.13 平滑度优先不动（O2/O3 不批）。提案落 §22.3（杯间增益状态：载体跨 reload 存续），统筹复核。

## 4. 待办（每步先问）

- **发版批（用户经统筹另批）**：tag v2.2.54→push（VPN 57890）→git archive zip（release/__build_v2254.ps1 同 v2253 口径，handoff 在仓根按 pkg 前缀打包）→GitHub Release（credential fill 不回显＋HTTPS_PROXY；--clobber 不需要，新版新资产）→夸克「来自：Codex」→推平板 Download/（ls 核字节，不代装）→回执 commit（仅 HANDOFF）＋push→回叫统筹 key 数字。
- **发版后测杯**：reload 冷启动首杯验 O1（diagnosticLast restored 日志＋plan controlSource gain-memory/feed-forward-k＋base≈3.8–4.0）；暖机杯对照不受影响；D1/D2 清锚场景仍待专门杯（§14②）。
- 晚段 tail 评估其余项：O2/O3 **不做**（用户不批，平滑度优先）；O4 使用侧（S2 重量窗）用户自定；O5 cc 瞬态观察项不动。backstop 加固仍另批。

## 5. APK 移植同步点（full→hec 里程碑）

- **O1 估计侧**：shadow/arbiter 的 diagnosticLast 等价物（最近合格杯载体）暖机恢复，同信任门（完整 fingerprint＋basket＋合格＋completed＋retained samples）；只读、不触发外部指令。与 D1–D4 同步债（HANDOFF_v02253 §6）合并到 hec 切换批一次移植。
- 本批无 APK 改动（插件估计侧；APK 当前无 diagnosticLast 镜像）。

## 6. 别碰

别人未提交/未跟踪（HANDOFF_2026-10-31.md 改动、release/、.tools/ 等）；记忆数据；控制律/灌水律/两段收口/LUT/硬包线/单一写者/影子 sent；coast/up-hold/治理链/死区（Q2 不批）；APK 仓；UI 批；技能 §22 现有文本。

## 7. 复跑索引

- 回归：node decenthyperexplugin.reaplugin/tests/verify_v02254.cjs（880）；node sim/tests/sim-regression.cjs（5）。
- O1 回放：node D:/vscode/.tools/__d16-o1-replay.cjs <verify.cjs> [plugin.js]（before 用 __d16-plugin-2253.js＝git show 966e3c7 提取）。
- 晚段评估：HANDOFF_2026-11-19-late-s2-tail-eval.md＋__d16-late-eval.cjs（O1 来源；O2/O3 已否）。
- 数据：D:/vscode/HyperExController/.tools/__live-plugin-history-10.json（杯 14/15）。

## 8. 发版回执（2026-11-19，用户批「2.2.54 发版」，统筹转达全 SOP）

- **基线**：aa93338（发版批不改码；统筹复跑 880/880 核过）。tag **v2.2.54**=aa93338923569d7ed0e11ba255d993e32c5c8588（lightweight）。
- **push**：origin auto-hyperex 966e3c7..aa93338＋new tag v2.2.54（VPN 代理 127.0.0.1:57890）。
- **包**：release/HyperExPulseFilter_v2.2.54.zip **534760 字节**，SHA256 **A0440E2CA4AC3A5D13ABB130DC976642362875EED7010B1DB55360B043F102A1**（git archive v2.2.54，9 条目同 v2253 布局；HANDOFF 在仓根按 pkg 前缀打包）。**包内复跑 880/880**＋node --check 通过。manifest description 保持 275 短简介（版本细节在 notes-v2.2.54.md／Release body，AGENTS §1.15）。
- **GitHub Release**：**451186657**（tag v2.2.54，--latest），asset **RA_kwDOVO5zXc4tuyEp**（HyperExPulseFilter_v2.2.54.zip，534760 字节，state=**uploaded**）。gh token git credential fill 不回显＋HTTPS_PROXY=57890。
- **夸克**：「夸克网盘/来自：Codex」fileId **b89cb2fe7ce74e93bc1cd2d14f087794**（534760 字节，非秒传；result 无 notice.text）。
- **平板**：adb mDNS push /sdcard/Download/HyperExPulseFilter_v2.2.54.zip，ls 核 **534760** 字节（2026-11-19 18:27）；**不代装，用户 Decaid 自装**。
- **发版后测杯**（取证陪杯统筹另行通知）：reload 冷启动首杯验 O1——restored 日志（Warm start: restored diagnosticLast …）＋plan controlSource gain-memory/feed-forward-k＋base≈3.8–4.0；暖机杯对照不受影响；D1/D2 清锚场景仍待专门杯。
- 红线遵守：只 add 本批（回执仅 HANDOFF_v02254.md）；gh/夸克/adb/push 均提权；装机不代做。

