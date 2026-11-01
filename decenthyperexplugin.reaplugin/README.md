# HyperEx Pulse Filter 2.2.17

cut 11 · 诊断页文案与补水折叠：cutoff 标签按新语义改名为「收回噪声底（%）」，S2 补水从曲线编辑器里独立成一折并带状态行，学习窗口措辞落到补水学习行，`controlOutputQuality` 增补窗口字段。控制律一行没动。

- **cutoff 改名（9 处）**：滑块标签、历史行前缀、两条状态语、迁移警告、对照表两条前缀全部从「称流速收回阈值／称流收回」改为「收回噪声底」；英文 `Cutoff noise floor (%)`。旧名字暗示「到 85% 就收回」，而实际判据是 `observed ≥ target × cutoff × 0.6` 且 `predicted ≥ target`。
- **派生阈值显示**：滑杆下方新增一行「派生 实测 ≥ 51% 目标（≈ 2.55 g/s）· 预测 ≥ 目标（3.55 g/s）」，随滑杆与 S2 目标实时换算；85% × 0.6 = 51%。
- **补水独立折叠**：`#refill-settings` 从 `#curveEditor` 内部移出，紧跟曲线编辑之后，成为 STEP 2 顶层的第 6 折。标题栏右侧显示「收回噪声底 85% · 触发 ≈ 51% · 启动 0 s」，草稿与已保存值不同时追加「· 草稿未保存」。保存按钮、revision、`refill-settings-save` 端点与草稿比较逻辑均未改。
- **学习行措辞（落点＝补水学习行）**：「学习窗口：X s 起 · 排除补水 800 ms（链路 1500 ms）后 · 末 60% 回归」。800/1500 是沉降排除时长，不是测量窗长度；回归仍是沉降后窗口的末 60%。
- **导出字段**：`controlOutputQuality` 返回体新增 `windowSettleMs`、`chainSettleMs`、`tailFraction`（0.6）、`basisDetail`（英文说明串）；收回未确认的不可用返回也带前两个字段。原有 `basis` 字符串保持不变——回放脚本与台账在读它。
- **S3 文案对齐 cut 7**：页面提示保持「S3 允许前段高于中段、后段低于中段；只限制相邻增幅」，本版没有把顺序约束写回去；`curveLimits` 逻辑未动。
- **测试**：tests/verify_v02217.cjs **682/682**（v02216 的 679 条 + 3 条：折叠位置、状态行与派生行、导出字段）。v02216 及更早测试与 RESULTS 原样保留，安全门零删除。
- **没做**：动态状态行与派生行带 `data-no-i18n`，英文界面下保持中文（与既有学习行一致）；版面尚未在真机页面目视验收。

## Previous release

# HyperEx Pulse Filter 2.2.16

cut 9 · 补水收尾：学习沉降窗拆两档、收回未确认不再退化成无窗口、handover 三处死参数清掉、补水侧纹波门与学习侧对齐。**补水段归 2026-11-01 流量控制审查所有，改前必读技能 §22.10–§22.12 与 plugin.js 常量区横幅注释。**

- **学习沉降窗拆两档（F2，用户拍板）**：测量窗（controlOutputQuality / stage2EffectiveCommand / controlLearningAssessment）**800 ms**，链路证据窗（liveTrimChainEvidence）**1500 ms**。链路会把恢复斜坡积分成增益（00:25 那杯量出 0.45，落定尾段其实是 1.29），必须等泵完全沉降约 1.6 s；测量窗只需泵停止移动，800 ms 够，还能给短 S2 多留数据。诊断页显示「已排除补水 + 测量 0.8 s / 链路 1.5 s 沉降」。
- **收回未确认不再退化成无窗口（R-5）**：补水灌了但收回没确认时（S2 换帧走 frame-ended，不产生 startup-complete），过去三处测量消费方会退回完全不过滤的数据，7.5–8 ml/s 的灌水段直接进了 r、链路增益和尾段质量。现在一律拒绝，reason = refill-return-unconfirmed。
- **窗口切光可观测**：controlOutputQuality 的 available:false 现在带 reason（refill-return-unconfirmed / no-target / raw-samples-insufficient / learning-window-too-short，后两者附窗口内与全段样本数），经 controlLearningAssessment 与 controlRunReview 显示在既有诊断面板，不新增 UI 元素。
- **handover 三处死参数（T-11）**：删 approachWriteIntervalMs:750 及其门（它在同一 tick 里排在 1200/800 ms 静默门之前，永远不可能放行）；approachMs 默认 200 → **800**（200 ms 短于一个 250 ms tick，守卫可能整段被跳过）；删恒为 1 的 row.approachFraction。
- **补水侧纹波门对齐 2.2.11**：s2RefillPumpEstimate 的私有 15.6% 与 s2HoldingReference 的私有 12% 都改成 >25% 拒绝、12–25% damped（后者把部分修正系数由 0.5 减半到 0.25，而不是整条参考作废）。
- **报告字段修正（R-7）**：maximumExtraCommandMl 改按曲线指令算（原按平台值，偏小约 1/3）；commandLimited 在 bounded 模式原恒为 false，改报灌水是否顶到驱动上限；删已无消费方的 plan.flowMaxGS；gainRegimeForRun 的 basis 由「S2 late 40%」改正为「S2 late 60%」；常量区横幅补 S2_REFILL_BLEED_MS / S2_REFILL_BLEED_FRACTION、删已不存在的 S2_REFILL_TRIM_MAX_QUANTA。
- **真机交叉验证**：hyperex-history (4).json 里 4 杯有 stage2 采样的完成杯，800 ms 测量窗后仍剩 71–93 个原始样本、1500 ms 链路窗后剩 64–87 个（controlOutputQuality 只要 6 个），两个窗口都不会把 S2 切光。另 6 杯显示切光的是中止杯或无 stage2 采样的杯，本来就被 completed at 排除在学习外。
- **没做**：strategy 值 refill-85 的改名。它是随 history JSON 落盘的持久化字段，12 处分支与 3 处测试断言依赖它，改名要么两名并存要么让旧 history 的学习窗失效，而 cutoff 默认回到 85% 后这名字又对上了。见 ACCEPT_2026-11-01-cut9-refill-closeout.md §5。
- **测试**：tests/verify_v02216.cjs **679/679**（v02215 原样保留）。新增 2 条不变量测试，改写 4 条既有测试匹配新口径，骨架补导出 stage2EffectiveCommand。安全门测试一条没删没弱化，没有新增镜像断言。
- **遗留**：补水过冲（闭环 +33.2%，绊线 ≤40%）本 cut 未改善，旋钮是 cutoffPercent 与 bleedMs；≥5 ml/s 稳态 r 仍 0 样本，需先做高指令标定。

## Previous release

# HyperEx Pulse Filter 2.2.15 · 一致性门与三套 S2 估计（cut 8 · L-7 / L-13 / L-15 / L-16）

杯间学习的三套 S2 估计以前各说各话：单杯链路按仿射反解要 4.72 ml/s、稳态前馈因 spread 56% 本不该参与、增益记忆按 `target/r` 给 3.884——最后记忆覆盖了另外两套。这一版把它们收成一个反解，并让人、写都按同一条曲线指令比较。

- **L-7 统一反解**：新增 `s2ReverseEstimate`。先取当杯**实际生效指令**（机器回显 `targetFlowMlS` 末 60% 中位数），算同窗 `r` 与 `target/r`；链路有显著截距（≥目标 10%）时才做仿射检验，且链路斜率必须 ≥ 当杯 `r` 的 75% 才采用——锚在最后一笔还没落定的写入上的「仿射解」是滞后假象，不是稳态。最后 0.9 阻尼 + `policy.s2` 限幅 + 1/16 归档。真机最后一杯：有效 3.938、尾段 4.794、`r_obs=1.2174` → **4.0625 ml/s**，与所需 4.107 差 −1.1%；旧记忆 3.884（−5.4%）、旧晚写仿射 4.72（+14.9%）。
- **r 做成命令的函数**：`gainMemory` 每段新增 `bands`（`<1.0` … `>=5.0`），每杯只更新自己所在区间；建议时只取同区间先验，跨区标 `crossBand`，不静默套用。旧记录没有 `bands` 时仍按单值 r 兼容。
- **记忆不再覆盖同杯建议**：有可用的 ADJUST / LUT COMPENSATE 数值时，记忆只报 `role:"prior"`、`applied:false`；只有没有同杯数值时才由记忆填。
- **L-13 半档相等**：`sameScalarAdaptiveEvidence` / `sameStage3Shape` 的 command 容差 0.005 → 0.03125（半个 1/16 档）；target 0.01、时序 0.25 s 不变。跨 measurement basis 不再硬拒，改打 `cross-window historical reference` 并把 S3 置信度降一级。真机 `historySearch` 的 4/5 incompatible 由这条消除。
- **前馈 spread 门真正生效**：两杯 spread ≤5%、三杯以上 ≤10% 才 `eligible`；超限只留遥测参考，`applied` 永远为假，且不参与建议。前馈输出也过 `snapCommandFlow`。
- **L-16 目标比例一步过渡**：`testOverrideStatus` 在 0.5–2× 内返回 `targetScale`，`manualTestCommand` / `s3ShapeStatus` / `preserveStage` 读取时缩放，`rescaleOverridesForTargets` 负责持久化；超过 2× 仍无效。`mapCreatedAt` 变化仍整套作废（不同 LUT 下的绝对指令没有定义，`gainMemory` 按 §22.1 保留）。
- **L-15 起步上界**：`startupMetricAllowed` 的 `tailMeanGS` 上界 +8% → +25%，下界 −50%、纹波 12%×factor、过冲 8%×factor 保留。真机 00:25 的 `tailCvPct 15.43` 仍被纹波门拒绝。
- **HOLD 真正可达**：`nextShotAdaptiveSuggestion` 不再拿 `s2.currentCommandMlS`（有链时是链路末笔 4.3125）与建议比，而是与本杯曲线指令比；S1/S2 的 ADJUST、S3 的三段形状都与曲线同档时转 HOLD。新增 `hold.all = !actionable`：全段都没有真实变化才不重写曲线。真机四杯 S1 都在 ADJUST 的问题由此不再强迫重写。
- **测试**：tests/verify_v02215.cjs **677/677**（666 条既有 + 11 条 cut 8）。新增覆盖：半档相等（命中与拒绝）、半档历史行命中、真机 00:25 统一反解、落定链路采用仿射、四档 `policy.s2` 限幅、spread 超限前馈不参与、+25% 起步上界、目标一步 rescale、HOLD 与曲线比较 + 全段 HOLD、跨 basis 降置信度、截距植物 5 杯闭环。v02214 测试与 RESULTS 原样保留；安全门零删除。

### 局限 / 未决

- **≥5 ml/s 稳态 r 仍 0 样本**；4–5 区间的 0.88 中位是暂态，不是高流量稳态。高指令标定（5.5 / 6.5 / 7.5 ml/s 各 3 s）仍待做。
- 目标比例超过 0.5–2× 仍整套作废；要跨数量级，先重跑 Flow Cal。
- `gainMemorySuggestion` 在 `updateGainMemoryFromRun` 之后调用，同区间先验已含当杯 r（权重最多 0.25，实测影响 <0.01 ml/s）；严格「先验不含当杯」需在更新前快照。
- 补水植物整体准确度仍不记达标（缺压力/粉饼动态与 ≥5 ml/s 稳态 r）；本版没有动物理参数，`HX_LOOP_REPORT=1` 与 cut 0/1/5 逐项一致（rise 0.60 s、峰值 +33.2%、平台 −19.3%、return 3.875）。

## Previous release

# HyperEx Pulse Filter 2.2.14 · S3 形状：删串联门、拆非递减、门槛按档位（cut 7 · L-5 / L-6）

S3 形状以前有两条并行通路：约 15 条串联硬门的 shape-only 共识，和 drift 模型。前者实际不可达；后者因为学习快照没带 `s3DriftModel`，在生产里从来没跑过——真机形状因此一直是平直（0.777/0.777/0.777，origin 标 adaptive）。

- **L-5 删除 `stage3ShapeOnlyConsensus`**：同指令、同时序、同 basis、两杯 LATE DECAY、lateToEarlyRatio<0.80、overallR2≥0.95、逐帧 r2/秒数、shapeVar/overallVar、profileRatio 互差、逐帧 ≤0.05/4%、非递减、相邻增幅、曝光变化 ≤0.2%、至少一帧变化 ≥0.005——整块删除。S3 形状只剩 drift 一个写入口；`s3DriftModel` 关闭时旧 LEVEL+SHAPE 建议仍可作回退。
- **drift 真的能跑**：诊断快照 `run.config` 现在带 `s3DriftModel`。以前 `driftShapeSuggestion` 读 `run.config.s3DriftModel`，快照里却没有这个键，函数永远返回 null；EARLY 帧的 S2→S3 沉降排除也因此从未生效。两处一起修好。
- **L-6 非递减三处拆除**：`projectS3Commands`、`curveLimits`、`applyCurveEditorDraft` 不再要求 EARLY ≤ MID ≤ LATE，只保留相邻增幅 ≤ max(+0.25 ml/s, ×1.35)。`s3ShapeStatus` 读回 legacy 形状时也不再因顺序拒绝；stall 恢复路径与高级手动编辑器里的同一限制一并删掉。
- **按档位计的门槛**：新增 `s3StepLimit(command, fraction, absolute) = max(1/16, |command|×fraction, absolute)`。形状门与学习门以「1 个 1/16 档」为最小可表达单位；4% / 0.05 ml/s 这类阈值只作档内死区（理想修正 < 半档 → HOLD），不再当外部硬门。0.75 ml/s 处一档 = 8.3%，正好越过 4% 与 8% 的旧门。套用处：`projectS3Commands`、两处 `bounded()`、levelFactor 的 ±5%、`stage3SingleSuggestion` 的死区与步幅、`driftShapeSuggestion` 的 MID 步幅、`addGain` 的 S3 feed-forward。
- **曲线编辑器按 model 分支**：形状值不变时原样保留已存对象（只改补水参数不再重写 S3）；真正编辑形状时写 `model:"drift"` + `earlyFactor` + `drift` + `manual`/`manualTilt`，不再把 drift 降级成 legacy，也不会让 `manualS3ShapeLocked` 失效。`curveLimits` 只限制相邻增幅（MID 相对 EARLY、LATE 相对 MID 的上限）。
- **UI 文案**：「一档 = 1/16 ml/s…」「输入值按档位归档…」「当前控制点允许范围…」与静态页面同步改成「S3 允许前段高于中段、后段低于中段；只限制相邻增幅」。
- **测试**：tests/verify_v02214.cjs 666/666。新增：删除不变量（源码不再含 `stage3ShapeOnlyConsensus`）、诊断快照携带 `s3DriftModel`、0.75 ml/s 一档步幅、单杯 6.7% 误差产出一档修正而 1.3% 落 HOLD、drift 投影保持非单调形状、drift 学习并写进曲线（EARLY>MID、LATE<MID）、曲线编辑器保存 drift 不降级、后续曲线保存保留 drift 因子、0.50–2.00 之外的比率被拒。

### 局限 / 未决

- 真机 `hyperex-history (4).json` 里 16 杯带 `evidence.s3`，但**最新一杯（2.2.5，00:27）没有**，那一杯的逐帧 gain 无法重算；本轮用两条 2.2.4 的 evidence.s3 做了 drift 回放（见 HANDOFF §3），最新杯只能核对「平直 + origin=adaptive」。
- `sameStage3Shape` 的相等判据当时仍是 0.005（L-13，cut 8）。2.2.15 已放宽到半个档位（0.03125），drift 每杯改形状不再被判成「不同指令」；保守／温和两档受此影响的问题一并关闭。
- drift 的 `earlyFactor`/`drift` 仍是每杯 ±20% 的比率步幅，与按档位计的指令步幅是两件事。

## Previous release

# HyperEx Pulse Filter 2.2.13 · 指令归档统一（Q-1 / L-14）

驱动只走 1/16 ml/s（0.0625）档位。2.2.12 及以前只有写入面归档：`resolvedStageCommandFlow` 返回 2.507 这类未归档值，`gainMemorySuggestion` 的 target/r 用 `round(...,3)`，「指令是否相同」用 0.005 比较——比一档细 12.5 倍。结果配置面、UI 面、学习面、写入面各说各话，`gain memory already maps to the current command` 分支不可达，AUTO APPLY 每杯重写内容寻址 profile。

本版：`resolvedStageCommandFlow`、`liveTrimControlCenter`、`gainMemorySuggestion`、`driftShapeSuggestion`、`scalarLearningSuggestion` / `scalarConsensusSuggestion` 的 suggested、学习输出写回、`rescaleOverridesForTargets`、手动曲线保存、`curveSetValue` 全部过 `snapCommandFlow`；新增 `sameCommandFlow(a,b)`（两侧先归档，半个档位内视为同一条指令），用于 HOLD 判定、读回校验、`keep` 模式识别。学习输出直接存档位值，不再 `round(...,3)`（3.0625 存成 3.063 会让读回和比较再次失配）。

真机对照：REVIEW §1.4 的 00:25 那杯曲线 3.875、记忆 r=1.2874 → 3.884，旧比较恒为 ADJUST；归档后 3.875 与曲线一致，同一条件的下一杯走 HOLD，不再改写 profile。

已知边界（留给 cut 7；2.2.14 已按 1/16 档位计门槛）：S3 在 0.75 ml/s 附近一档约 8.3%，而 S3 形状门是 4% / 0.05 ml/s、正常学习门是 8%（0.06 ml/s），档位粒度已经大于门槛。量化后这些形状修正无法表达，会落成 HOLD。S3 形状与学习门槛需要按档位计，而不是按百分比计。

## Previous release

# HyperEx Pulse Filter 2.2.12

增益记忆的结构：桶中心跟随实测、命中改成最近邻分区、缺段跨桶回退、LRU 淘汰、r 只有一套范围、分子分母同窗。

- **L-4 桶中心自适应**：每个桶保留最近 6 个签名（`samples`），`center` 取其中位数；`radius` 由签名离散度（MAD×2.6）给出，限定 0.08–0.20，样本不足 3 个时用 0.12 种子。真机 g2 的中心 0.4715 落在 §22.3 记录的间隙里，旧实现把中心在新建时写死、之后永不更新，这条由此消除。
- **L-4 命中改成最近邻分区**：只在最近的桶「距离 ≤ min(radius×1.25, 与最近邻桶中心距的一半)」时命中；超出命中半径但仍在 radius 内的签名并入最近桶（不新建碎片）；再远才新建。真机 g2 0.4715 / g3 0.2997 的新边界是 0.3856：0.3831→g3、0.3881→g2，与 `lastBucketId` 无关。旧口径下两条 0.12×1.25 的命中带在 0.32–0.45 重叠，同一签名连续两杯可以落进不同桶。
- **L-4 缺段跨桶回退**：当前桶没有该段记忆时，借其它桶的同段记忆（先比样本数、再比距离），返回 `stale:true` / `fallback:"cross-bucket"` / `activeBucketId`，不再直接掉回 LUT。真机 2.2.5 那杯活动桶是 g2、g2 没有 s3；现在能取到 g3 的 s3 `r=1.9421`、`drift=0.913`，平台指令 0.772 ml/s。
- **L-4 淘汰改 LRU**：新建桶超过 12 个时按 `updatedAt` 淘汰最旧，且不动新桶与 `lastBucketId`；原来的「第一个既不是新桶也不是 lastBucketId 的下标」会把有用记忆挤掉。
- **L-9 r 只有一套范围**：`GAIN_R_MIN=.2` / `GAIN_R_MAX=3` 成为唯一来源，加载、观测、建议三处共用。`normalizeGainMemory` 遇到越界的 r 直接丢弃该段并在 `dropped` 里记 `{bucketId,stage,r,reason}`（最多留 20 条），不再出现「存量 r=5 被建议直接用」。
- **L-10 分子分母同窗**：`stage2EffectiveCommand` 从 S2 末 40% 改成末 60%，与 `controlOutputQuality.tailMeanGS` 的窗口对齐；观测记录 `window:{startPct:40,endPct:100}`。以前一个比值混了两个指令区间。
- **r 的命令区间标注**：每段记忆记 `commandMlS` 与 `commandBand`（<1.0 / 1.0-2.0 / 2.0-3.0 / 3.0-4.0 / 4.0-5.0 / >=5.0）；建议返回 `commandBand`、`currentBand`、`crossBand`，跨区引用不再无声无息。技能台账的「r 是命令的函数」在数据结构里有了落点。
- **测试**：tests/verify_v02212.cjs 658/658。新增 7 条：最近邻与 `lastBucketId` 无关、缺段跨桶（真机 g2/g3 夹具）、中心滑动中位数、LRU、r 范围单一定义、60% 同窗、命令区间标注。安全门测试一条没删。对 2.2.11 代码跑 v02211 仍是 651/651（v02211 对 2.2.12 只红版本号断言，650/651）。
- **真机 JSON 回放**：`hyperex-history (4).json` 的 22 杯 fullRecord 里，4 杯（2.2.4×3、2.2.5）有可用的 S2 压力/流量签名；重放后两桶中心和半径随实测移动，命中带在 0.4415 相接、不再重叠。补水闭环植物与 2.2.11 完全一致（rise 0.60 s、峰值 +33.2%、平台 −19.3%），本版没有动物理参数。

## Previous release

# HyperEx Pulse Filter 2.2.11

杯间学习的封锁与门槛：不可采信的证据只降权、不再封锁增益记忆；当杯局部估计改成用当杯；同一物理量只留一套门槛。

- **L-1 不再连带封锁增益记忆**：`SATURATED / LIMITED / VARIABLE / MIXED` 的标量证据以前会让 `gainMemory.applied` 直接为假；现在 `target/r` 照常应用，只标记 `damped` 并把置信度降一级（HIGH→MEDIUM→LOW）。真机最近 5 杯 S2 停在 −21%…−29%，其中最后一杯的硬门槛理由是「S2 tail ripple 16.5% exceeds 12% learning limit」——这类杯子今后仍能吃到记忆。
- **L-2 链路饱和不再同时封掉「学」与「用」**：`gainStageObservation` 删掉 `chain.usable===false → null`，饱和时强制当杯 local 估计并把 α 提到 0.55；观测仍进入记忆更新。
- **L-3 local 用当杯估计**：local 不再是「上一杯的 `lastObservedR`」，而是本次观测（S2 后段 `tailMeanGS` ÷ `stage2EffectiveCommand`）；local=true 时置信度强制 LOW。真机 g2 平滑 r=1.3574 而杯内用 1.9026（差 29%）的错位由此消除。
- **L-11 同一物理量一套门槛**：增益观测的纹波门槛统一到 20%，12–20% 之间 α 减半、>25% 才 HOLD；`gainMemoryQualityGuard` 与 `stageActuatorEvidence` 对齐到 0.60 / 0.35 / 0.40（原来分别是 0.60/0.35/0.40 与 0.80/0.20/0.25）；两处的「欠跟踪」分母从 `cfg.stageNCommandMlS` 换成实际生效指令（S2 用 `stage2EffectiveCommand`，S3 用逐帧 `targetFlowMlS`），取不到就判 not-eligible。
- **L-12 开杯指令窗放宽**：`known()` 的 ±20% 窗改成 ±35%，减少「偏差越大越学不到」的墙。
- **⑦ 空指令回退删除**：`gainStageObservation` 拿不到实际生效指令时直接返回 null，不再退回旧的 profile 指令当分母。
- **未做（补水段归属）**：`s2RefillPumpEstimate`（15.6%）与 `stage2StartupPlan`（12%）两处纹波门槛在补水段横幅里，没有动。
- **测试**：tests/verify_v02211.cjs 651/651。四条旧测试按新口径重写（一条验证「同一门槛」，一条验证「不可采信仍应用」，一条验证「不再 cherry-pick 旧证据」，一条验证「饱和链路仍出观测」），并新增饱和链路 α=0.55 / local 当杯估计的不变量；对 2.2.10 副本跑同一套是 646/651。

## Previous release

# HyperEx Pulse Filter 2.2.10


杯内门槛与死参数：角度死区独立成常量、S3 预算按累计档数并可由大角度临时放开、救急判据真正用上剩余时间、救急静默按实测延迟放宽。

- **T-4 角度死区独立**：`ANGLE_DEADBAND_DEG=2` 成为独立常量，`computeAngleStats` 不再拿 `deadbandPct`（杯流百分比 4）当角度阈值（度）。0° 占比与循环内判定现在都按 2° 角 + 2% 流量带，两个物理量不再互相冒充。
- **T-9 / F4 S3 预算改成累计档数**：原先常规 4 笔 / 救急 2 笔是行为预算，真机 2.2.x 的 8 杯里「S3 normal write budget」被触发 242 次、「S3 rescue write budget」186 次（合计 428，与审查一致）。现在按写入的实际档数累计，常规与救急各 24 档；常规预算在趋势角连续 ≥120° 达到 3 个检测点时临时放开；全局 `maxWrites` 仍是安全门。`progress>=.55` 的后段禁写删除。
- **T-10 救急判据用上剩余时间**：`cannotReturn` 改成真正的外推——每档把杯流改变 `r/16`，每笔要等静默窗 + 约 1.2 s 泵滞后，算出 `timeToReturnS`，与 `remainingS` 比较。trace 记 `stepsNeeded` / `timeToReturnS` / `remainingS`。时间够就不救急，时间不够才救急。
- **F3 救急静默按实测**：救急静默 = `max(800 ms, 上一笔驱动 ACK 实测延迟)`，上限 3 s；没有实测就落 800 ms。trace 的 `silenceBasis` 记 `measured` / `floor-800` / `normal-1200`。
- **T-12 连续大角度加码接入 predictive**：`bigAngleStreak≥3` 时常规步长上限 4 → 6，`≥6` 时 → 8；不再是被计算、被上报却不起作用的死代码。
- **T-13 小项**：救急静默的 800 ms 现在有实测依据；`computeAngleStats` 与循环内的 0° 定义统一到 2° / 2% 带。
- **未做（归属冲突）**：T-11 的 `approachWriteIntervalMs` / `approachMs` 默认值 / `approachFraction` 都属于 `stage2StartupPlan` 与 `S2_REFILL_DEFAULTS`（补水段横幅所有），本版没碰，等用户决定交给谁。
- **测试**：tests/verify_v02210.cjs 651/651。新增 T-4 角度独立性、T-10 两态救急、T-9 预算与放开、T-13 实测静默四条；v0229 里断言旧「4 笔 + 后段禁写」的测试按新口径重写（不是弱化：新测试同时断言预算挡住与放开后能写）。对 2.2.9 副本跑同一套是 646/651。

## Previous release

# HyperEx Pulse Filter 2.2.9


杯内步长与信封：一个入口决定可达指令范围，信封永远包含当前生效指令，S3 不再用 2-3 档去撞 4% 死区。

- **T-5 / L-8 信封统一到 `commandCeilingFor(phase, mode, ctx)`**。正常段 = 中心 ±20%，但 hi 夹到 8.00、lo 不低于 0.10；救急段 = 至少与正常段同宽，向上到 `min(8, LUT×2)`。原先同一个 `target/r` 有四个上限（正常 hi、救急 hi、8 的硬门、mapped 自身），现在只有这一个函数。
- **信封必须包含当前生效指令**。`lo=min(lo, command)`、`hi=max(hi, command)`：真机 tMs 30578 那笔 frame 2 指令 0.8125 而信封是 [0.5, 0.625]，控制器根本不在信封内、无法从任何状态出发。修好后，落在信封外的活动指令会从「泵实际所在的位置」迈一步，而不是被夹到信封边界跳过去。
- **T-6 救急上限不再比常规更窄**。23:29 那杯 center 7.236 时正常 hi 算到 8.625（超 8 的写入被静默丢弃），救急 hi 只有 5.0；现在正常 hi 夹到 8，救急取 `max(min(8, LUT×2), 正常 hi)`，进入救急不会缩小可达范围。
- **T-7 S3 常规最小步改成 1 档**。旧值在误差 ≥8% 时是 3 档、否则 2 档：S3 的 1 档 ≈0.13 g/s，3 档 ≈0.4 g/s，是 4% 死区（0.06 g/s）的 3–5 倍，23:42 那杯因此来回 0.69。动作集回到 §22.4 的 0/±1/±2/±4。
- **T-8 救急下限按误差折算**。原来固定 8 档起（S3 一笔就是目标的 54%）；现在 `min = clamp(round(0.25×|err|/r×16), 2, 8)`，S3 救急最小笔落在 0.1–0.2 ml/s。
- **trace 同时记 `intendedQuanta` 与 `actualQuanta`**。原先只记 `stepQuanta`（意图），夹到信封后实际移动多少看不出来；真机 65 笔非补水写入里 21 笔与 `stepQuanta` 不符这件事，以后可以直接从导出里核对。
- **测试**：tests/verify_v0229.cjs 649/649。新增 T-5/T-6/L-8 信封不变量、写入量化与范围不变量、信封外活动指令的单步不变量，以及一条 S3 决策级闭环（旧 2-3 档：平台 +16.1%、方向反转 2 次、指令 0.625→0.75→0.625→0.8125；新 1 档：平台 −1.5%、0 次反转、0.625→0.6875）。对改动前的 plugin 副本跑同一套是 644/649，红的正好是这 5 条新测试。
- **S2 平台**：干净的 S2 闭环植物里两边都是 −6.9%（这版没有改 S2 的正常步长）；信封修复的收益由「信封外活动指令」那条不变量单独证明。
- **真机交叉验证**：导出里的 check 行与 `stepQuanta` 都被历史压缩剥掉了；能核的是 65 笔 2.2.x 非补水写入的实际档位分布——S3（frame 2）1 档 4 笔、2 档 6 笔、3 档 4 笔、4 档 2 笔、6 档 1 笔、8 档 9 笔，S2（frame 1）出现 40 档 2 笔（2.5 ml/s 的跳变）。这与 T-7/T-8 的现场描述一致。

## Previous release

# HyperEx Pulse Filter 2.2.8


杯内决策的三个硬 bug：缺失预测被当成 0 g/s、预测只向上且无幅度上限、S2 前瞻窗 2 s 与补水的 1.5 s 不一致。

- **T-1 缺失预测不再变成 0 g/s**。`liveTrimRegression` 在尾窗拟合不合格时返回 `predicted=null`，旧代码 `Number(null)` 得 0，于是 `decisionGS=0`：误差直接等于整个目标、`cannotReturn` 恒真、救急三条件被一个缺失估计满足。真机 730 个决策点里有 49 个（6.7%）中招，trace 形如 rawGS 2.532 / predictedGS 0 / predictedErrorPct 100。现在 decisionGS 与 cannotReturn 两处都按 `!==null && !==undefined && Number.isFinite` 守卫，预测缺失时退回 `reg.slope`。
- **T-2 预测双向且夹幅**。旧式 `fastSlope + max(0, fastSlope-early.slope)×horizon` 只外推上升、且加速度项无上限：真机 raw 2.532 被外推成 7.349，之后 1.5–4.5 s 实测 4.50；frame-1 预测 MAE 1.350 g/s 是目标的 27%，而决策死区只有 4%。现在加速度项允许负值（下落也外推），并夹在 ±0.6×target（S2 为 ±3.0 g/s）：预测仍能领先响应，但不会凭空造出一个台阶。
- **T-3 前瞻窗统一 1.5 s**。正常段 S2 从 2 s 改到与补水一致的 1.5 s；S3 的 1.2 s 与鲁棒窗不变。技能 §22.4 / §22.9 已同步。
- **测试换闭环**：新增 §22.4 T-1 不变量（缺失预测时 decisionGS 等于 rawGS）、T-2 双向夹幅不变量、以及一条杯内 S2 闭环植物（泵 0.35 s 死区 + τ 0.4 s，杯流按 r(命令) 分段：≤4 ml/s 取 1.23、≥4.5 取 1.0，不设粉饼限流）。同一植物下，旧预测器平台 −8.2%，新预测器 −6.9%；「杯流低于目标时的下调笔数」两边都是 0（这条作为回归守卫）。
- **测试**：tests/verify_v0228.cjs 645/645。对改动前的 plugin 副本跑同一套是 641/645，红的正好是 T-1、T-2、闭环与 1.5 s 窗这四条。
- **已知限制**：当前导出文件的 check 行被历史压缩剥掉（compact 记录只留 checkReasons），所以真机 49/730 这个数没法从现有 JSON 重新数出来；闭环植物只用于方向与回归，平台的绝对水平仍以真机为准（2.2.x 的 S2 平台偏差 −21…−29% 要等这版上机复测）。

## Previous release

# HyperEx Pulse Filter 2.2.7


S2 补水按 §22.11 重写：泵流量是趋势矢量，灌水量只受安全包线约束，r 只用于收口平台。**本节由 2026-11-01 流量控制审查拥有，改前必读技能 §22.10–§22.12。**

- **灌水量 = 安全包线，不再由 target / r / base 推导**。删掉 2.2.3 的「1.5 × 基准」上限和 2.2.6 的 high-flow-direct（r=1）。依据是实测：低压纸升流下限 0.7 s，且**增强 ≥7.0 ml/s 才到顶**，所以任何低于 7.0 的静态上限都直接判死「上升段接近 90°」这个首要目标。旧的 1.5× 上限还会随用户设的杯流目标漂移：目标 4.0 → 上限 6.0（不够）、4.5 → 6.75（不够）、5.0 → 7.5（够）。现在 floodCommandMlS 恒为 8.00，真正的限制是限压门、ACK、holdMs 看门狗和写入预算。
- **r 允许大于 1，且只用于收口平台级**。平台 = target/r（r 取 gainMemory，实测 1.19–1.39，所以平台低于目标数值），不再等于目标本身、也不再等于曲线指令。boundedRefillControlBase 的顺序回到 gainMemory → 空粉碗 LUT → 曲线基准；2.2.6 那个把三条分支全变死代码的 profile-command 早返回一并删掉，诊断页的「实测 / 空粉碗 LUT」标签重新可达。
- **补水指令的可达范围放开到整个驱动区间 [0.10, 8.00]**。boundedRefillCommand 的下限从 controlBaseMlS 改成 commandFlowMin，过冲时可以降到平台以下断流；dispatchS2Startup 里把回落值钉死成两个值的 handoffOk 删掉，改成区间校验（下限 = 保护性回落值，上限 = max(平台, 曲线指令×1.2)）。
- **收口分正常与保护两条**。正常 cutoff 收回落在平台 target/r；限压/秤失效的保护性收回落在 min(平台, 曲线指令)，所以它既不会在限压时抬泵、也不会饿死到曲线指令以下（2.2.6 的 Math.min(controlBase, base) 在平台低于曲线指令时会重现 00:25 的饿死）。
- **灌水期可以逐笔下调（trim / 断流）**：新增 dispatchS2Startup(t,"trim")，每 500 ms 一次、要求上一笔已 ACK、单调向下、trace 记 startup-bleed，图表标记「补水断流」。
- **修掉一个会让断流永远写不出去的档位 bug**：boundedRefillCommand 原来用 Math.floor 归档，floor(0.10×16)/16 = 0.0625 低于驱动硬下限，dispatchS2Startup 会静默拒发；改用 snapCommandFlow。
- **cutoffPercent 恢复成真正可调**：删掉 bounded 模式下「值等于 85 就改成 95」的按值迁移（它分不清历史遗留的 85 和用户主动设的 85，正好把文档里「过冲就下调 cutoff」这条路堵死）。默认回到 85，已存的值不动。
- **测试策略改了**：tests/verify_v0227.cjs 637/637（cut 0 按新 cutoff 口径重写后 642/642，见下条）。删掉 6 条镜像断言（assert.equal(p.controlBaseMlS,5) 这类「代码算出什么就断言什么」，其中一条还把 1.5× 上限本身钉成不变量），换成两层：① §22.11 口径不变量（对 3.0–6.5 g/s 每个目标断言灌水上限 ≥7.0；对 r ∈ {1.05,1.19,1.29,1.39,1.6} 断言平台 = snap(target/r) 且低于目标、灌水不随 r 变；断言规律能降到平台以下并到 0.125；断言单调向下）；② **闭环植物测试**——按实测动力学（0.35 s 死区 + τ 0.4 s + 粉饼限流 5.5 ml/s + 杯流 = r × 泵流）合成植物，按 50 ms 步进、250 ms tick 真跑 liveTrimTick，断言的是**秤流速曲线**：泵指令必须一度超过目标杯流数值（这一条杀掉所有「泵 = 设定值」的写法）、上升 20→80% ≤1.5 s、收口落在平台、补水写入 ≤10 笔。安全门测试（限压、ACK、帧确认、预算、秤失效、profile truth、存储回读）一条没动。
- **两段收口已实现（同日用户批准后，HANDOFF_v0227 §8）**：cutoff 改成前瞻判据——实测 ≥ cutoff×0.6 只当噪声底，收回看前导补偿后的预测秤流 ≥ 100% 目标；新增 bleeding 状态，cutoff 触发先写 `snap(max(0.10, 平台×0.35))` 断流，等 700 ms（`S2_REFILL_BLEED_MS`）或秤流回落到 target×1.02 以内，再写平台 `target/r`。状态机 armed → boosting → bleeding → returning → complete，四组安全路径同步；断流笔的 ACK 不结束补水，看门狗容忍已 ACK 的断流笔（最多续两次 1500 ms）。同一植物只改收口：r=1.29 峰值 +88% → +36.4% → **+21.4%**、平台偏差 −15.0% → **−1.4%**；r=1.05 / 1.6 的过冲与平台都达标。剩下的过冲靠 `cutoffPercent` 与 `bleedMs` 继续收，属真机调参。测试：cut 0 已按新口径重写，`tests/verify_v0227.cjs` 642/642。

## Previous release

# HyperEx Pulse Filter 2.2.6

S2 补水的基准按官方流量分区走，收口改回「交还控制权」。

- 补水基准按官方流量分区：**≥4 ml/s（高流量区）直接把目标 g/s 当泵指令**，交给固件自己拉，不再经 r 折算——目标 5 g/s 就是 5.0 ml/s，增强上限 7.5。低于 4 才回到 `目标 ÷ r`（r 取 gainMemory，没有记忆才退回空粉碗 LUT）。
- 收口（收回/接管）改成交还控制权：写回 S2 曲线正在跑的那条指令，而不是写回补水基准。2026-11-01 00:25 那杯基准是 LUT 的 2.5、曲线指令是 3.0625，2.5 s 后「收回」写到 2.5，把 S2 压到曲线指令以下，杯流塌到 2 g/s，随后调流花四笔才拉回 4.3。现在同样的收口写 3.0625。
- S2 学习窗口改成硬窗口：从补水收回确认起再等 1.5 s（0.35 死区 + 0.85 爬升 + 0.4 一阶），这段时间内的采样不进 gainMemory 的 r、不进单链证据（LUT COMPENSATE）、也不进 output quality 尾段。00:25 那杯的单链证据原本从收回后 1.3 s 的 2.25 → 4.3125 量出 gain 0.45（r≈2.2），而落定后的尾段是 1.29 —— 那是恢复斜坡，不是稳态增益；新窗口下这杯不再出链证据。收回没确认时整段不学 S2 稳态（原有行为）。
- 诊断页「上一杯补水节点」会显示学习窗口：「学习窗口：X s 起 · 已排除补水 + 1.5 s 沉降」，收回未确认时显示「本杯不学 S2 稳态」。
- 收回值只认计划里的两个合法取值（曲线指令 / 保护性回落），越界或篡改的回落值仍然丢弃，20% 包络检查保留。
- 诊断页补水预览按 bounded 模型显示：不再用旧倍率算式（100% 上限下它永远等于基础），改成「补水目标 5 g/s（收口 4.75 g/s）· 泵基准 5.0000 ml/s（高流量区直给，不折算 r）· 动态增强 5.0000–7.5000 ml/s · 收回 3.0625 ml/s（S2 指令）」；「补水指令上限」显示「100% · 仅上限」并置灰。
- 测试：tests/verify_v0226.cjs 632/632（新增：高流量区直给不折算 r、低流量区仍走 target/r、高流量忽略更低的 gainMemory、收口交还曲线指令、预览显示目标与动态上限）。

## Previous release

# HyperEx Pulse Filter 2.2.5

杯间增益与历史落盘两处修正。

- S2 增益的分母不再用曲线指令。杯内调流每杯都会覆盖曲线值（曲线 5.5、泵实际 2.8），旧代码于是把 r 算成 0.69 或 1.7，下一杯的 `target/r` 基值就全歪。现在取 S2 后段机器回显 `targetFlowMlS` 的中位数，拿不到遥测才退回曲线指令；同一批数据 r 回到 1.19–1.39。
- gainMemory 在没有当前杯阻力特征时（插件刚重载、或计划在任何 S2 采样之前生成）退回最近一次出杯的桶并标记 stale，不再直接掉回空粉碗 LUT（r=2.0 → 基值 2.5）。
- 诊断页的补水预览显示生效的 r 和来源：实测 / 空粉碗 LUT / 曲线。
- 历史文件按杯龄分级：最近 4 杯保留完整采样，第 5–10 杯保留 events 与 trace，更老只留 summary 与 evidence。实测 11.79 MB → 4.86 MB（−59%）。
- 落盘回读改为比对 `writeToken`，不再把整份文件做两次 canonical 规范化；一杯结束时的「写入记录」和「记录下一杯应用」合并成一次写；启动时压缩老文件的重写推迟到空闲时执行。
- 测试：tests/verify_v0225.cjs 627/627。

## Previous release

# HyperEx Pulse Filter 2.2.4

状态栏那格 REAL 的刷新与取值修正：

- 出液期间推给皮肤的 changed 事件从每秒 1 次改成每 0.5 s 一次，S2/S3 的实时杯流不再一秒才动一下。
- REAL 不再只认杯内调流的回归值。调流最后一次检测超过 1.5 s 没更新时，退回当前杯最近 16 个原始秤样本的短窗回归（一直在更新，比瞬时值稳）；再不行用瞬时 dW/dt；都没有才显示「—」。调流中途停掉时数字会继续动，而不是冻结在最后一个读数上。
- 测试：tests/verify_v0224.cjs 625/625（新增状态栏回退与 0.5 s 推送两条）。

## Previous release

# HyperEx Pulse Filter 2.2.3

2.2.2 在真机上 S2 补水后无法收回：回落指令被档位校验挡掉，整杯以「S2 回落基础指令缺少驱动确认」中止，泵留在补水的 8 ml/s。这一版先把写入面统一收拾干净：

- 全插件只保留一处档位换算：`toDriverStep`（就近归并到 1/16 ml/s）、`snapCommandFlow`（归并 + 夹到 0.1–8）、`formatCommandFlow`（曲线字符串）。A010 帧、曲线 S1/S2/S3、S3 三段形状、两条校准曲线全部走这里。
- 2.2.2 的补水基准是 `target/r`，r≈1.254 时算出来是 3.9872，LUT 基值 2.507 也一样，都不是驱动的整档；回落守卫因此静默丢笔。现在基准先归并到档位、r 用归并后的值反算，回落指令与基准完全一致；万一计划里出现越档值，回落直接兜底到基准，不再整笔丢弃。
- 补水增强上限从 8 ml/s 压到控制基准的 1.5 倍（r=1.25 时是 6.0）。依据是 12 杯机器流量拟合：死区 0.35 s + 爬升 0.85 s + 一阶 0.4 s，2 ml/s 的台阶要约 2 s 才真正到位，写满 8 只会在收口前多灌一截。
- 补水预测窗 `predictionSeconds` 2.0 → 1.5，跟实测伺服（约 1.2–1.5 s）对齐，收口不再明显提前。
- 曲线里的流量值现在是机器真能执行的档位（2.5 / 0.75 / 0.6875 这种），不再写 2.507 / 0.719。
- 测试：tests/verify_v0223.cjs 623/623，其中新增一条不变量——任意指令编码后字节必须等于 round(cmd×16)，且 HyperEx 与两条校准曲线的每段 flow 都是 1/16 整倍数。

## Previous release

# HyperEx Pulse Filter 2.2.2

2.2.1 已发布后，S2 补水口径进一步按目标流量校正：

- 补水控制目标固定在 S2 目标流量 5 g/s；`targetPercent` 不再参与 bounded 控制，旧 140% 会被归一到 100%。
- 实际泵指令由控制律计算，目标是把 S2 onset 后的秤流速上升段做陡（接近 90°）；泵域统一硬限 8 ml/s。
- 收口默认 `cutoffPercent=95%`（4.75 g/s），到 95% 就交回正常 S2 控制器形成 5 g/s 平台；旧 85% 在 bounded 模式下迁移为 95%。
- 如果过冲，下调 cutoff；如果到目标太慢，上调 cutoff。cutoff 仍是可调上限/交回点，不是固定流量。
- 补水收口仍要求实测斜率到 cutoff 的 95%，避免预测噪声提前收回。

## Previous release

# HyperEx Pulse Filter 2.2.1

2.2.0 真机两杯在 S3 early 中止，trace 明确是 `rescueActive is not initialized`。2.2.1 是热修：

- 修复 S3 预测控制里压力/执行器门在 `rescueActive` 初始化前读取的 TDZ；S3 early 不再因为这个错误 abort 整杯。
- S2 补水改为**有界控制律**：`targetGS/r`（无 r 时用 LUT）是控制基准，`targetPercent` 只是补水指令上限，不再直接当成固定 boost；实际指令按 2 s 预测秤流量和 `cutoffPercent` 计算，最终仍受 8 ml/s 硬门、压力、ACK 和写入预算约束。
- 补水收口要求实测斜率至少到 cutoff 的 95% 才接受 2 s 预测，避免 3.99 g/s 实测、13.12 g/s 预测这种提前收回。
- 杯内控制中心在没有杯间记忆时回到 LUT/目标基准，不再拿手动 profile base 与补水控制基准互相打架。
- 测试：tests/verify_v0221.cjs 620/620。

## Previous release

# HyperEx Pulse Filter 2.2.0

杯间学习从“绝对指令”改成“相对当杯实际指令的增益记忆”：

- 新增 `adaptiveHistoryFileV2.gainMemory`（schema 1）。每个桶用 S2 后段 40% 的 `压力 / 机器流量` 中位数做签名，带滞回；签名落在现有桶外时新建桶，不按纸名或固定两档分支。
- 每桶存 S2/S3 的 `r = 稳态杯流 / 当杯实际指令`。下一杯基值由 `target / r` 反算；r 是比值，所以重跑 Flow Cal 不会清空记忆，错误基值也不会污染 r。常规杯内介入按 0.12 回填，救急杯按 0.5 回填。
- 新观测相对桶内 r 偏差超过 15% 时先降置信度，下一杯改用这一杯的局部 `r`，桶以 0.55 的 α 吸收；常规更新 α 为 0.35。新桶从 n=1、LOW 置信度开始。
- S2 反算基值限制在 `[0.1, min(8, LUT×2)]`，不再被旧命令 ±12% 的步长锁死。S3 形状新增 drift model：MID 为基准，`earlyFactor = early/MID`、`drift = late/MID`，允许 early > MID、late < MID；没有 drift 的旧三段形状仍按原校验读取。
- S3 drift model 的 EARLY 测量只取该帧后半段，避开 S2→S3 过渡；MID/LATE 仍按帧窗口统计。自动学习给出 drift 提案后，应用会写入 `model:"drift"` 并由 profile 生成三段实际指令。
- S3 形状折叠区新增手动倾斜滑块：默认关闭且只读，打开后才能拖动；滑块 -1…+1、步长 0.05，对应 earlyFactor 0.55–1.45、drift 0.80–1.20。手动应用后 S3 被锁定，自动学习只继续更新 S1/S2，关掉开关即释放。
- 杯内改为预测式决策：常规写入后 1.2 s 静默，救急 0.8 s；S2 用 1.6 s 回归窗 + 2 s 前瞻，S3 用 3 s 鲁棒回归窗 + 1.2 s 前瞻。4% 死区按预测误差判断，不再用当前值偏差触发。
- 救急三条同时成立（趋势角 ≥120° 连续两次、预测回不到带内、误差 >25%）才进入，步长 8–24 档；压力限制只阻断向上加码，向下卸压仍允许。杯内信封以 `target/r` 为中心，不再绑死在本杯当前指令。
- S3 常规最多 4 笔、救急最多 2 笔；后 55% 只允许救急/角度确认的写；8% 以上偏差的正常单笔至少 3 档。常规、救急、补水写入分开计数，并显示在诊断状态行。
- S1 不进入预测杯内模型，仍按原路径；S2/S3 才使用预测、静默和救急分支。
- S2 补水收口从当前斜率改成 **2 s 预测秤流量**；预测到阈值就收回，不再等实测值到点。95% 阻尼仍作为开放项，没有用来推迟收口。
- 杯间记忆的质量门放宽为覆盖 60%、限压占比 <35%、机器流量欠跟踪 <40%，但压力极限、ACK、写入预算和方向门仍是硬门；一致性 `VARIABLE/MIXED` 仍会阻止记忆覆盖。
- 没有 S2 压力/机器流量签名时完全回退到现有 `gainFeedForward` 与标量学习；LUT、arming、校准触发时机不变。
- 诊断页“下一杯决策”新增桶、r、样本数、置信度、偏差与反算基值；历史文件导出同时带上 `gainMemory`。

验证见 tests/RESULTS_v0220.txt（614/614）。

## Previous release

# HyperEx Pulse Filter 2.1.3

在 2.1.2（回退到 2.1.0 行为）基础上，只做两处不改变时机的优化：

- 启动维护读一次 `GET /profiles?includeHidden=true`，把同一份列表传给 HyperEx 同步与两个校准 profile 的 upsert，不再每次 upsert 各自读。
- 旧校准 profile 迁移成功后按标题记标记，之后跳过。
- 不延迟、不加冷却：`calibration-status` 仍在页面打开时 verify/repair，启动维护在 `onLoad` 里立即开始，arming 节奏与 2.1.0 完全相同。
- 实测加载 REST：稳定态 5 → 2（1 次倍数 + 1 次 profile 列表），且全部在 1.5 秒内发生；新装 8 → 5。

验证见 tests/RESULTS_v0213.txt（582/582）。

## Previous release

# HyperEx Pulse Filter 2.1.2

回退 2.1.1 对 `calibration-status` 的「只读」改造，恢复 2.1.0 的行为：

- `calibration-status` 重新在打开页面时验证/修复 profile。2.1.1 把它改成只读后，真机出现偶发首杯 controller 起不来、HyperEx 曲线不介入控制、冲洗出水完成后状态不退出且计时继续（切换曲线无效，休眠再唤醒才恢复）。这次实验得不偿失。
- 取消 10 分钟修复冷却和 2 秒启动延迟，加载时恢复即时维护。
- 2.1.1 那次一并做的「profile 列表合并读取」也撤掉，请求序列回到与 2.1.0 相同（稳定态 5 次）。
- 2.1.0 的图表 Canvas 开关、2.0.2 的预设回读与 STEP 4 折叠等均保留。

验证见 tests/RESULTS_v0212.txt（578/578）。

## Previous release

# HyperEx Pulse Filter 2.1.1

诊断页回归只读，加载路径减负：

- 打开诊断页不再触发 verify / repair。`calibration-status` 只返回缓存状态（倍数读取改为不强制），所以 GHC 不会因为开页面闪一圈粉灯，也不会无谓改写 profile——这也是 Streamline 里 HyperEx 收藏消失的可疑原因。
- 修复只在三种时机发生：工作流切换、点 SYNC、检测到明确漂移且距上次修复 ≥ 10 分钟（冷却期内只记跳过）。
- 启动时的 profile 维护推迟 2 秒执行，不再和 Decaid 启动抢本地 API。
- 每次加载的 profile 列表从 4 次读取合并为 1 次；旧校准 profile 迁移成功后写标记，之后不再查询。
- 实测加载 REST：稳定态 5 → 2（1 次倍数 + 1 次 profile 列表），前 1.5 秒只有 1 次；新装 8 → 5。

验证见 tests/RESULTS_v0211.txt（582/582）。

## Previous release

# HyperEx Pulse Filter 2.1.0

图表渲染加了 Canvas 2D / SVG 开关，默认 Canvas 2D：

- 「实际秤重曲线」标题下的按钮点一下就在 Canvas 与 SVG 之间切换，切回时用已保存的 `lastChartRun` 原地重绘，不重新取数、不影响导出。
- Canvas 版沿用同一套坐标与配色：坐标轴、刻度、全部 series、标记（圆点／箭头／方块／↻）都画进位图；点图按最近 12px 命中标记，`#flowpointdetail` 显示与 SVG 相同的文本。
- 切换状态不落盘，每次打开诊断页都是 Canvas。
- 同一杯 900 样本下，页面节点 1640 → 1180。

验证见 tests/RESULTS_v0210.txt（578/578）。

## Previous release

# HyperEx Pulse Filter 2.0.2

2.0.2 修三件事：

- **预设又能保存了**。宿主回读的是存储里的 JSON 文本，旧代码按对象判断，重进页面就把 5 个槽清空；现在统一走 `parseStoredJson`（待应用预设同样）。
- **诊断页载入后更轻**。图表按像素抽稀到约 380 个顶点（保留峰值），标记层封顶 160 个，三张大图各自成合成层。同一杯 900 样本：flowchart 节点 451→333、路径数据 72→35 KB。
- **能看到中止原因**。「上一杯 · 验证结果」新增 ABORT 卡，直接显示该杯最后一次中止的 phase 与 reason（原来只在日志里）。

验证见 tests/RESULTS_v0202.txt（574/574）。

## Previous release

# HyperEx Pulse Filter 2.0.1

从 2.0.1 起版本号改用标准 semver，1.9xds 编号作废、不回填。原因是 Decaid 的 GitHub Release 安装要求标签必须是 `X.Y.Z` 或 `vX.Y.Z`，且去掉 v 后与 manifest 的 `version` 完全一致；`v1.93ds` 会被拒绝（`Release tag "v1.93ds" is not X.Y.Z or vX.Y.Z`）。

2.0.1 的内容（诊断页减压）：

- STEP 4（上一杯 CSV / 历史 JSON）改成和前几步一致的折叠块，默认收起；「复制 CSV」「导出历史 JSON」按钮仍留在页脚。
- CSV 改为懒加载：打开 STEP 4 或点「复制 CSV」时才取 `/diagnostics-csv`。整杯 CSV 常有几十万字节，以前一进页面就塞进 textarea 并参与排版。
- 本机实测（900 样本 + 30 杯历史）：脚本 12→7 ms、布局 6→5 ms、样式计算 4→3 ms；折叠态节点数与页面高度不变。
- 验证见 tests/RESULTS_v0201.txt（569/569）。

## Previous release

# HyperEx Pulse Filter 1.93ds

本地开发版（版本号 1.93ds，非严格 semver）。1.93ds 修复诊断页顶栏预设快切按钮不显示：

- 1.89ds 起 `renderPresets` 末尾的 `renderPresetBar(d)` 落在函数体外面。脚本启动时它用页面 detail 元素调了一次，之后即使拿到预设数据也不再刷新顶栏，所以 1–5 一直是空的。
- 现在这行放回函数体内，按 `/presets` 返回的槽位渲染；顶栏在拿到数据前先画 5 个空槽（描边、禁用），`/presets` 失败也不会整排消失。
- 控制律、校准、学习与预设写入逻辑未改。
- 验证见 tests/RESULTS_v0193ds.txt（566/566）。

## Previous release

# HyperEx Pulse Filter 1.92ds

本地开发版（版本号 1.92ds，非严格 semver）。1.92ds 按使用频率重排诊断页：

- 步骤 2 折叠内现在收着：学习历史、下一杯已应用曲线、曲线编辑、预设、上一杯指令快照、上一杯验证、S1/S3 稳定性、下一杯学习建议、实时数据。
- 实际秤重曲线留在步骤 2 外面，不展开也能看。
- 步骤 3 折叠内收着：参考建议、高级/测试覆盖编辑、高级设置；步骤 4（复制 CSV）仍在最外层。
- 给根画布补了背景底色，长页面滚动到底不会再出现白底。
- 验证见 tests/RESULTS_v0192ds.txt（563/563）。

## Previous release

# HyperEx Pulse Filter 1.91ds

本地开发版（版本号 1.91ds，非严格 semver）。1.91ds 继续统一首屏折叠样式：

- 「下一杯 · 曲线编辑」改为与 STEP 1 / STEP 2 相同的 details + stepHead 折叠块，默认收起；展开后仍是原来的曲线、档位按钮与「应用到下一杯」。
- 验证见 tests/RESULTS_v0191ds.txt（562/562）。

## Previous release

# HyperEx Pulse Filter 1.90ds

本地开发版（版本号 1.90ds，非严格 semver）。1.90ds 只调整诊断页首屏结构：

- 去掉诊断页的标题「诊断 / 流量校准」和下面那行步骤说明（只在诊断页隐藏，浸泡/GHC 提示卡里仍保留）。
- STEP 2 · 杯间自动学习改为与 STEP 1 对称的折叠块，默认收起；徽标仍显示状态，展开后是学习历史与已应用曲线。
- 验证见 tests/RESULTS_v0190ds.txt（561/561）。

## Previous release

# HyperEx Pulse Filter 1.89ds

本地开发版（版本号 1.89ds，非严格 semver）。1.89ds 在诊断页顶栏加五个预设快切按钮：

- 顶栏「关闭 / 首页」「实际秤重曲线」右侧新增 1–5 五个小按钮；有内容的槽位为琥珀实心，空槽为描边灰字并禁用。
- 点有内容的按钮会弹一次确认（显示该槽的目标 → 指令），确认后按既定流程应用：写目标 → 插件重载 → 落地指令。
- 只在诊断页显示，提示卡（520px）里隐藏。
- 验证见 tests/RESULTS_v0189ds.txt（560/560）。

## Previous release

# HyperEx Pulse Filter 1.88ds

本地开发版（版本号 1.88ds，非严格 semver）。1.88ds 加五个预设，并让改目标时指令按比例跟着走：

- 诊断页新增「PRESETS · TARGET → COMMAND」：5 格，每格可存当前目标（S1/S2/S3 g/s）与该刻实际生效的指令（ml/s），随后可一键应用或清除。
- 应用预设：先把目标写回插件设置，再在插件重载后用存下的指令作为下一杯覆盖（pending 标记按目标匹配后落地，S3 形状关闭）。
- 目标变化自动缩放：已有覆盖指令（手动或学习得来）按 新目标/旧目标 逐段缩放，S3 三段一起；只在 LUT 有效时执行，缩放后更新绑定目标并重写曲线，幂等。
- 验证见 tests/RESULTS_v0188ds.txt（559/559）。

## Previous release

# HyperEx Pulse Filter 1.87ds

本地开发版（版本号 1.87ds，非严格 semver）。1.87ds 给导入补上「从链接导入」：

- 诊断页学习历史的导入区新增输入框与 IMPORT FROM URL / 从链接导入 按钮；输入框默认填当前环境的 history-export 地址。
- 点一次会同时回灌学习历史与 LUT：先 history-import，再 calibration-import；LUT 失败不影响历史，状态行分别报两段结果。
- 文本输入框样式与数字框统一。
- 验证见 tests/RESULTS_v0187ds.txt（552/552）。

## Previous release

# HyperEx Pulse Filter 1.86ds

本地开发版（版本号 1.86ds，非严格 semver）。1.86ds 在诊断页加入导入，用于找回丢失的 LUT 与学习记录：

- IMPORT HISTORY JSON：读 hyperex-history*.json，按 runId 合并（同杯取新），超过 30 杯保留最新；导入后重建自适应历史。只允许 idle，且要求持久化存储已就绪。
- IMPORT LUT JSON：接受 LUT 表或导出的 history（从最近一杯的 fingerprint.lutPoints 取点）。校验数值范围、按实际流量排序、强制指令单调（至少 3 点），然后走合并落盘；会回报量程与是否可用。
- 新增 history-import / calibration-import 两个端点，manifest 已声明。
- 控制、学习数学与合并规则未改；验证见 tests/RESULTS_v0186ds.txt（551/551）。

## Previous release
# HyperEx Pulse Filter 1.85ds

本地开发版（版本号 1.85ds，非严格 semver）。1.85ds 修 1.84ds 的一个上下文判定漏洞：

- 学习阶段判定用的 `qualificationFingerprintKey` 之前仍带着 LUT 点，合并后会把桥接状态翻回 "empty"，咖啡学习记录被暂时挡住。现在它和学习指纹同口径：只认 LUT 身份（createdAt）、篮型与倍率，点列表变化不再影响 operating qualification。
- 合并后保持 `NORMAL COFFEE · AUTO`，兼容杯数不归零；只有 CLEAR CAL MAP 后的新校准才清空覆盖与历史。
- 控制与学习数学未改；验证见 tests/RESULTS_v0185ds.txt（546/546）。

## Previous release

# HyperEx Pulse Filter 1.84ds

本地开发版（版本号 1.84ds，非严格 semver）。1.84ds 把校准 LUT 改成可叠加，并把学习证据从“整张 LUT”解耦：

- 新校准默认**合并**进现有 LUT：重叠区（实际流量相差 2% 以内）用新点替换，未覆盖的区间保留旧点，量程可以一段段扩。合并时 LUT 身份（createdAt）不变，历史指令与学习记录继续绑定同一台机器。
- 只有用户点了 **CLEAR CAL MAP** 之后再校准，才走以前的全盘清空（覆盖指令与自适应历史一起清）。
- 学习指纹不再包含 LUT 点列表，只按 LUT 身份、篮型、倍率、主动泄压模式和目标判定；单杯质量、R²、执行故障、命令/目标比例等门槛原样保留，质量不过关的旧记录依旧不会被采用。
- 诊断页 LUT 一行新增 revision、点数、量程与合并计数（retained / new / replaced）。
- 控制、安全与学习数学未改；验证见 tests/RESULTS_v0184ds.txt（544/544）。

## Previous release

# HyperEx Pulse Filter 1.83ds

本地开发版（版本号 1.83ds，非严格 semver）。1.83ds 只动诊断页与出液数据行，控制律一行未改：

- 诊断页按 bestpresso 皮肤的视觉语言重做：暖深色渐变底、24px 卡片圆角加细描边、Inter 字体与更轻的字重、胶囊按钮（主操作琥珀色）；折叠结构、按钮 id 与文案、全部交互保持不变。
- 诊断页的统计格、表格、文本域、图表容器与 STEP 标题统一到同一套表面与分隔线。
- S2/S3 出液期间，顶部数据行改为实时流量：REAL（插件 RAW 回归 g/s）、Weight flow（秤算 g/s）、Flow（DE1 组流量 ml/s / 目标）。进 S2 立即切到该行，每秒刷新，回到 idle 撤下。
- 语言切换按钮的选中态改为琥珀配深字，替换原来的粉色。
- 控制、安全、学习与导出逻辑未改动；验证见 tests/RESULTS_v0183ds.txt（540/540）。

## Previous release

# HyperEx Pulse Filter 1.82ds

本地开发版（版本号 1.82ds，非严格 semver）。1.82ds 只动诊断页，控制律一行未改：

- 诊断页顶部左侧新增「关闭／首页」按钮，与语言切换同一行；不再需要滚到页面底部才能退出。
- 关闭按钮旁新增「实际秤重曲线」按钮，点击平滑滚动到该段曲线；提示卡视图里不显示。
- STEP 1 流量校准整块默认折叠，右侧状态徽标仍可见；日常不看校准时不再占据首屏。
- 下一杯 · 已应用曲线（readback 与原始 workflow JSON）、上一杯 · 启动指令快照、S2 提前补水设置都改为默认折叠，展开方式与下方「学习历史」「高级设置」一致。
- 首屏直接露出：下一杯曲线编辑（含曲线图）、上一杯验证结果、下一杯学习建议。
- 控制、安全、学习与导出逻辑未改动；验证见 tests/RESULTS_v0182ds.txt（540/540）。

## Previous release

# HyperEx Pulse Filter 1.81ds

本地开发版（版本号 1.81ds，非严格 semver）。1.81ds 按 1.80ds 真机历史（hyperex-history1030.json，30 杯）的物理数据调整控制律，目标是杯流更快到位、稳态更长更平：

- 稳态增益前馈：S2/S3 用杯内稳定段的 RAW 杯流 / 机器流量比值估 k（实测 S2≈1.1–1.15、S3≈2.0–2.3），下一杯指令直接按 target/k 反推；单杯即可给出 LUT COMPENSATE，不再从校准 LUT 慢慢爬。建议仍受学习档位步幅限制。
- 归一化证据与物理证据分离：normalized 模型在真机上把 5.15 g/s 的尾段记成 3.14，导致连续加码；现在把实测尾段机器增益附在合格证据上，下一杯按真实杯流判断。
- S3 窗口与预测：S3 的机器流量到杯流有 2–4 秒滞后，回归窗口从 1.6 秒改为 3 秒，尾窗 1.2 秒，预测外推 2 秒；S2 保持 1.6 秒 / 0.5 秒。
- S3 单杯修正改为比例反推（old × target / measured，0.9 阻尼），去掉学习强度衰减导致的欠调（真机 0.63→0.81 爬升对应稳态只需约 0.72）。
- 稳态死区从 2% 放宽到 4%（RAW 1 秒窗噪声约 2–4%），coast 增加「趋势斜率 |d cup/dt|<0.1」判据；真机数据里 coast 原先每杯只触发 1 次。
- 接近目标（|误差|≤10%）时矢量步幅封顶 1 档，减少稳态来回。
- 学习覆盖率修复：包络内回显即视为已知目标（固件按 1/16 档位渐变），门槛 80%→70%；真机两杯覆盖率从 22.8%/32.7% 升到 80.7%/75.0%。
- S2 起步 boost/return 写同步常规调流基线。
- 验证见 tests/RESULTS_v0181ds.txt（540/540）。

## Previous release

# HyperEx Pulse Filter 1.80ds

本地开发版（版本号 1.80ds，非严格 semver）。1.80ds 把 1.79ds 工作区里的矢量控制与诊断曲线收进正式版本，并补上控制律曲线的 90° 中刻度：

- 控制律曲线（0–180°）：每个 check 的 trendAngleDeg 按时间画在独立图上；0° 表示趋势落在目标线上，90° 表示平行偏离，大于 90° 表示背离。本版补上 90° 中刻度（虚线网格 + 左侧标签），现在 0 / 90 / 180 三档都可见。
- 矢量箭头画在「上一检测点 → 本次写入」的趋势连线上：方向 = 指令增/减的绝对方向，头部固定 5px 高、±4px 宽，强度只拉长尾巴（|command − previous|×48）。
- 角度统计（连线角口径）：相邻两个带 RAW 回归的检测点连线延长到目标线；zeroDegreeShare / meanAngleDeg 进 report 与 learningAssessment。
- 连续大角度加码：bigAngleStreak（趋势角 ≥45° 连续次数）≥3 → 步长上限 6 档，≥6 → 8 档。
- 稳态增益 k 常驻显示：有样本显示 k / 样本数 / 离散 / 当前指令 / 目标折算 / 限幅后；样本不足显示「样本 N 杯 · 需 ≥2 杯同段干净记录」。
- 诊断图新增浅蓝趋势轨迹线（check / write 的 rawGS 按时间连接 + 3 点移动平均）。
- 历史导出：STEP 4 EXPORT HISTORY JSON 生成 Decaid 本地服务地址（/api/v1/plugins/&lt;id&gt;/history-export）并复制到剪贴板，浏览器打开即下载；新杯记录 fullRecord（完整 samples / rawScaleSamples / events / liveFlowTrim.trace），上限 30 杯。
- 杯内控制显式分状态：coast（趋势正在收敛，交给固件，不写）／lut-compensate（平行偏离且压力有余量，包络改为目标杯流反算指令×0.9，不再受 base±20% 限制）／vector（原有有界矢量）。状态写进诊断 trace 的 trimMode 字段。
- 杯间学习改用单杯加码链：连续同向写入的 Δ指令→Δ杯流作为直接证据，下一杯按实测增益反推目标指令（0.9 阻尼）；加码后杯流不响应则标记 SATURATED / HOLD，不把饱和误学成 LUT 偏低。
- 学习覆盖率修复（2026-10-30 真机数据）：固件会把机器目标按 1/16 档位渐变回显，旧逻辑要求回显精确等于某次写入才计为已知目标，真实杯覆盖率只有 22.8% / 32.7%，连续十几杯被 80% 门槛挡住。现在包络内回显即视为已知目标，门槛降到 70%，同两杯覆盖率升至 80.7% / 75.0%。
- S2 起步 boost/return 写同步更新常规调流基线（此前回落 4.0 后仍按 5.5625 决策，多走几次下调）。
- 验证见 tests/RESULTS_v0180ds.txt（540/540）。

## Previous release

# HyperEx Pulse Filter 1.79ds

本地开发版（版本号 1.79ds，非严格 semver）。1.79ds 修复真机发现的 restart skipStep 双发竞态，并把补水基准做成明确开关：

- 修复主动泄压后自动 skipStep 双发：scheduleRestartSkip 的防重变量 restartSkipTimer 原先在 setTimeout 回调第一行就置空，而 guardedSingleSkip 的机器快照 preflight 是异步的；这段 await 期间状态更新每帧都会再次触发 restartPourConfirmed，排上第二条 skipStep，帧号 0→1→2 跳过 S2 的 frame 1，导致补水等不到帧确认、S2 活调全部 frame-not-confirmed、全杯无写入。现在 restartSkipTimer 保持到整个 skip 流程结束的 finally 才置空，原防重在整个异步流程内有效；自动 skipStep 进 S2 的机制不变。
- 补水基准改为明确双选开关：基础泵倍率（按当前 S2 指令）或目标折算（按设置值 S2 目标动态估算）。UI 同时显示两种基准各自的增强结果，保存时写入 basis；恢复补水默认值同样带基准。
- 1.78ds 的活调趋势/矢量语义（趋势确认、PD 矢量幅度、同向加码、角度统计、绝对方向箭头）保留。
- 历史数据全点记录与 STEP 4 CSV 导出保留（1.68 起：每杯持久历史保存全部 action/ACK/target/fault，常规 check 行压缩为原因计数，CSV 导出完整实时轨迹，旧记录不改写）。
- 历史导出：STEP 4 新增 EXPORT HISTORY JSON，一键把持久历史（最多 30 杯）导出为 JSON；新增杯记录 fullRecord（完整 samples / rawScaleSamples / liveFlowTrim.trace），旧杯按原压缩记录导出。
- 验证见 tests/RESULTS_v0179ds.txt（536/536，含 restart 双触发只发一条 skipStep 与历史全点导出的回归测试）。
- 无 1.79ds 真机验证；skip 修复与补水 UI 待真机复核。

## Previous release

# HyperEx Pulse Filter 1.78ds

本地开发版（版本号 1.78ds，非严格 semver）。1.78ds 将活调整体重写为趋势 / 矢量语义（用户 2026-10-28/29 定案）：

- 活调确认改为趋势确认：RAW 杯流斜率向目标收敛为主判据（写后 600ms 起，误差缩小 ≥0.015 g/s）；machineFlow 朝写入方向移动 ≥1/16 为辅助佐证；驱动 ACK 仍是硬闸但不推进命令。
- 同值重试废弃：未响应矢量记 vector-unresponsive，下一次决策从当前趋势重算新矢量（加码/撤码），不再重发同值、不再有 3 次降级冷却。
- PD 矢量写控制：写入幅度 = |target − slope|×8 档（1/16 量化，封顶 4 档）；先 clamp 进 base±20% 包络，无余量报 command-bound-vector，不空写。
- 连续大角度加码：bigAngleStreak（上一检测点到当前回归的趋势线与目标线夹角 ≥45° 的连续次数）≥3 时步长上限 6 档、≥6 时 8 档；sameSignStreak 保留作报告；波幅由包络与趋势预测 hold 压住。
- S3 固定 1600ms 防毛刺写间隔删除：写不写由统计闸（R²、新鲜度、预测 hold、2% 死区）决定。
- 角度统计：zeroDegreeShare 与 meanAngleDeg 按相邻检测点连线的夹角计算（连线延长到目标线；0° = 趋势落在目标线上，朝目标 0–90°，背离 90–180°）；sameSignStreak 仍按 RAW slope 相对目标同号维护；进报告与诊断状态行，不设硬门槛。
- 诊断曲线箭头：方向 = 绝对方向（command 相对 previous 升则向上、降则向下），箭头画在上一检测点到本次写入的趋势连线上；长度 = |command − previous|×48；与目标背离时如实显示；↻ 表示趋势未响应时的重新决策（不是重发同值）。
- 状态/事件/文案语义：monitoring-unresponsive-trend、vector-unresponsive、feedbackPolicy trend-vector-response；i18n 同步新状态翻译。

S2 补水算法、S3 投影、杯间学习与 1.77ds 一致；历史数据全点记录与 STEP 4 CSV 导出保留（1.68 起：每杯持久历史保存全部 action/ACK/target/fault，常规 check 行压缩为原因计数，CSV 导出完整实时轨迹，旧记录不改写）；S1 走 LUT 直给，不做精细活调。无真机验证。另附本地离线仿真台 sim/（加载真实 plugin.js，自带植物模型和网页曲线），用法见 sim/README.md。

验证见 tests/RESULTS_v0178ds.txt（527/527）。

## Previous release

# HyperEx Pulse Filter 1.77ds

本地开发版（版本号 1.77ds，非严格 semver）。在 1.76 基础上修掉复核发现的三处问题：

- 保存补水参数现在会写入后**读回校验**，回读缺失或不一致时不报成功（1.5 秒超时）；
- abortSequence 的 1.2 秒复位定时器纳入 abortResetTimer 管理，新一杯不会被上一杯的迟到复位清掉；
- 界面 esc() 补上双引号/单引号转义；版本号收敛为一个常量。

控制策略、S2 补水算法、S3 投影与 1.76 一致，无真机验证。另附本地离线仿真台 sim/（加载真实 plugin.js，自带植物模型和网页曲线），用法见 sim/README.md。

验证见 tests/RESULTS_v0177ds.txt（511/511）。

## Previous release

# HyperEx Pulse Filter 0.1.76

修复 1.75 独立补水保存按钮报错 `endpoint refill-settings-save not available`：1.75 已实现按钮和处理函数，但漏在 manifest 注册 HTTP 接口，宿主会提前拒绝请求。本版补齐注册。

增加宿主接口声明与 HTTP 保存/重新读取测试，保存渐进 1.5s、收回80%可持久化。1.75 的 S3 策略、图形补零以及 1.74 的 S2 策略均不改。覆盖安装后由宿主重新载入插件；仅刷新诊断页可能不足以更新 manifest。

模拟验证见 tests/RESULTS_v0176.txt；无 1.76 真机验证。

## Previous release

# HyperEx Pulse Filter 0.1.75

基线 1.74。保留 LUT、历史和 S3 手动曲线，不重新校准。

- 补水面板增加独立“保存补水参数”：保存五项参数及修改前后记录，下一杯采用；不改动 S1/S2/S3 曲线或覆盖学习来源。草稿与保存状态分开，失败保留草稿。运行中及版本冲突拒绝保存。
- S3 杯内上调增加 1.6 秒响应等待，并用同帧 RAW 短窗趋势检查正在回升/预计达标时停止继续加档。低流量不再只看较慢的整窗回归连续追涨。保留压力、反馈、指令范围和下降纠偏，不重置用户 S3 曲线。本杯具体过冲原因不能由照片确定，仍需真机反馈。
- 日常流量/重量/写入线在 S1 与第二段之间补零连接，保留实际时间长度；仅渲染点补零，原 RAW/回归/学习/CSV 不改。其他遥测缺口仍不冒充测量。
- 1.74 S2 全目标接管与持续出液起点逻辑保留。

模拟结果见 tests/RESULTS_v0175.txt。尚无 1.75 真机验证。

## Previous release

# HyperEx Pulse Filter 0.1.74

Based on delivered/GitHub1.70. Install over the same plugin; retain LUT/history and valid starting commands. No new calibration or dedicated coffee tests. No1.68 hardware validation yet.

## 1.74 · S2完整目标接管与有效称流起点

用户明确要求修改控制策略：可以接受短暂约6g/s峰值，重点是回落后稳定在5g/s；S2是称流先决曲线，出液前等待不能计入流量合格/置信评估。基线1.73此前仅修显示与参数记录，本版实施控制与评估逻辑修改。

### 补水结束后的接管

- 补水幅度仍是基础泵指令默认160%、最高8ml/s，不恢复＋2限制；称流收回阈值默认85%、最长4秒请求退出增强、压力及数据/ACK保护保留。
- 接管阶段的真实杯流目标始终是完整目标，默认5g/s；取消原先内部4.25→5g/s目标斜坡，避免4.6g/s本应偏低却被当成超目标继续下调。原“渐进至100%时间”滑块保留并改名“接管渐进时间”，用于限制接管期节奏，不再降低杯流目标。
- 确认返回指令后，杯内控制等待从1600ms改为50ms；新鲜度、帧确认、有效RAW回归、原驱动最小发送间隔仍需满足。仅补水返回控制如此，原连续模式短脉冲和数值学习的稳态排除时段不被取消。
- 接管期用带符号的短窗流量趋势：正在回落、预测已接近目标时避免再叠加下调；持续偏高且没有回落趋势仍可下调，低于5且没有上升惯性则可上调。750ms上调间隔只约束所设接管时长，结束后恢复原档位检查/写入节奏，不再贯穿整个S2。
- 若上一杯是已完成、未排除、同物理上下文，后段称流稳定，且多次新鲜机器目标/实际流量与压力佐证可靠，则用后段实际杯流偏差做半幅局部比例估计，生成有界接管指令。范围为基础指令至基础×120%，不得超过增强指令或8ml/s，按1/16向下量化。不用补水峰值估计维持流量；没有可靠证据就用基础指令，由杯内控流接管。不会凭一次峰值无界抬高基础/LUT。
- 压力或数据过期触发退出增强时，返回原基础指令，不采用较高接管估计。强补水4秒上限依然生效；接管指令处在普通杯内调流的原有±20%范围内。
- 返回已有驱动ACK、却缺少机器目标回显时，至少3次不同时间的新鲜同帧实际流量观测、跨度至少500ms、距返回写入至少600ms、流量在返回值约5%或一个原生档位内且压力有余量，可标记“actual-flow-corroborated”恢复接管。不是伪造目标ACK，目标回显计数不增加，驱动ACK缺失仍停止。重复/过期/高压/流量不符不能满足佐证。

### S2出液前不算低流量

- 从RAW秤重与源时间戳检测持续增重：至少4个唯一采样、跨度约0.4秒、总增重至少0.2g、回归R²≥0.85，斜率超过低噪声阈值。最长2.05秒检测窗支持很慢的真实出液，不要求接近目标或85%才开始计量。
- 确认后回溯到持续上升的起点，纳入最初出液数据；重复时间、单次跳重、无持续趋势的小抖动不能触发。归零后重新检测。原始出液前记录仍保留，不改秤重、不压缩时间轴。
- S2回归、误差/合格状态、后段均值/CV、固定指令证据、杯内学习覆盖率及机器执行窗口从该起点对齐；未检测出液时暂不计算流量合格，而非给一个假的MISS或HIT。出液开始后，后面的低流量/断流仍完整计入，不能只截取好看的稳定段。
- 启动延迟单独显示，诊断区列出S2有效称流起点及被排除的等待时间。原启动响应分析仍保留完整原始时间线，用于分析延迟，不能与出液后的流量误差混为一谈。
- 数值学习仍匹配实际指令窗口、保留补水瞬态/返回后的稳定性要求；并非把不同指令下的数据都配成同一稳态指令。旧杯记录和LUT不清除，缺少原始数据的旧统计不凭空重算。

1.73的滑块、上次修改/上一杯窗口、萃取图排除泄压等功能保留，S1/S3、主动泄压/GHC/skip拓扑及温度指令不改。本版是算法实现与模拟验证，不能声称已在真机证明回落后稳定5g/s。

**499/499 Node模拟/回归检查通过**。验证见tests/RESULTS_v0174.txt：延迟2/10/20秒的出液后回归一致、完全无流/噪声/重复/归零、慢流正确MISS、出液后断流仍MISS、短暂6后稳定5可纳入学习、完整目标接管/50ms恢复/回落趋势/过高继续纠偏、接管期结束解除750ms限制、可靠/不可靠历史接管估计、压力返回基础、实际流量佐证及旧有回归。没有1.74真机或完整浏览器验证。

## Historical release notes — 1.73

## 1.73 · 萃取图排除泄压尖峰，标注补水收回原因

用户提供1.71截图：S2绿色称流峰值不足5g/s，橙色指令在明显出液前下降；S1主动泄压和最终停止阶段出现相似的机器目标/实际流量尖峰。当前代码确实持续采集dumping/finishing等遥测，而日常图原先不筛阶段、把所有点连接，导致停杯后的波形看起来像萃取动作。本版修复展示范围，不声称已经证明固件内部那段泵动作的确切物理目的。

### 日常图只画萃取

- 普通HyperEx图保留S1/S2/S3萃取数据，隐藏dumping、soak、restart_wait、finishing、aborted等准备/泄压/停杯后阶段。组合遥测还要求已提供的机器状态是espresso且子状态为preinfusion/pouring，排除稳温/flush等非萃取状态。
- 使用已有stage1_weight_trigger和final_weight_trigger事件，在请求停止的时点截止；即使后续点误留在旧活动阶段，也不能跨越这两个截止点。老杯没有事件时按已保存阶段筛选。
- 主动泄压开启时S1与第二次运行断开绘线，不把停杯/重启两侧数据连成一条线。RAW局部斜率不跨泄压/重启计算。S2→S3仍连续；主动泄压关闭的完整曲线保持连续。称重图也截止于各段萃取停止，保留原时间轴，间隔留空。
- 写入指令线与目标反馈/检查标记使用同一可见时间窗，排除停杯后的目标回显。空萃取图清空旧图，非法数值不伪装成零流量。校准图保持完整校准阶段，不受普通萃取筛选影响。
- **仅筛显示**：原始run.samples/rawScaleSamples、事件、统计、学习与CSV均不删除或改写；泄压尾迹保留用于异常排查。界面明确说明日常图省略准备/泄压/停杯后数据。

### 保留滑块，增加上一次参数窗口

五个补水滑块保留。新增独立只读窗口，区分当前已保存设置、最近一次修改前→修改后及修改时间、上一杯实际采用的启动参数。上一杯的计划增强指令与实际记录到的已发送增强指令分别列出，不把计划冒充执行；旧1.71称流目标倍率明确标为旧版，不当作新版泵倍率。没有记录的字段显示未记录，不用当前滑块猜测历史。

最近一次修改记录与现有补水设置共同持久化，成功应用后更新；只改S1/S2/S3曲线不会覆盖补水修改记录，保存/同步失败回滚时一同恢复。重新启动从存储恢复。上一杯参数从冻结的启动计划或已有落盘杯记录读取，不额外篡改旧历史；缺少旧记录时明确提示。当前滑块草稿可与上次保存值对照，尚未应用的拖动不伪装成上一杯数据。

### S2截图与收回原因

1.71中补水受称流阈值、压力、新鲜度和最长时限共同限制；截图下调发生在绿色称流明显建立前，更像最长时限到期，不能仅凭图认定85%称流收回太早。黄色/蓝色是机器ml/s，粉色/绿色是杯中g/s，峰值不能直接混用单位判断。没有CSV/trace，不能给该历史杯编造确定的触发原因。

本版每次补水增强/返回写入记录startupReason，并在箭头详情显示“补水增强/补水收回”及实际记录原因。原先诊断区的执行原因保留。修复上一版下一杯启动摘要残留“估算称流目标”标签，改为基础泵流量倍率，避免把1.72的泵倍率说成杯流百分比。

用户后续实测参考：启动0秒、旧版补水目标7g/s、收回85%、最长4秒、渐进2秒，出现约5.6–6g/s短暂峰值，再回落到约4.5g/s；压力约1bar，机器目标约5.5→3.8ml/s。用户明确该数据用于算法参考，可接受这种短暂过冲，重点是回落后稳定在5g/s，而非把每次峰值都压平。后续交接优化应区分补水结束与稳态维持指令；现有“直接回基础、渐进时暂降杯目标”的组合值得评估，但本版不凭这一杯临时改动作或放宽保护。图像不能替代具体trace证明触发原因。

**控制不再额外放宽**：继承1.72基础泵指令默认160%、最高8ml/s、无＋2限幅；仅此补水幅度按泵指令，其他目标/学习按杯中g/s。85%称流收回、最长4秒请求返回、压力/新鲜度/ACK保护、原skip拓扑、S3设置全部保持。此用户截图为1.71，不是1.72的160%实测。

**476/476 Node模拟/回归检查通过**。验证结果见本包tests/RESULTS_v0174.txt；包括泄压双尖峰、截止事件、旧记录、连续模式、校准模式、断线和RAW斜率重置、原始CSV不变、空图清除、实际收回原因及旧有控制回归。没有1.73真机或完整浏览器验证。

## Historical release notes — 1.72

## 1.72 · S2补水按基础泵指令160%，取消＋2限制

本次仅修改S2临时增强幅度的单位和边界。用户明确：百分比按基础泵流量指令ml/s计算，其他阶段目标、杯内控流、杯间学习与补水收回仍按真实杯中称流g/s。

- 默认倍率160%，可调100%–160%；基础指令先按原生1/16 ml/s量化，增强指令为`floor(min(8, base × percent / 100) × 16) / 16`。取消基础指令＋2 ml/s限制；计划与驱动派发均校验倍率和8 ml/s上限。LUT/杯间学习仍决定基础指令，但不再额外换算增强倍率。
- 例：基础4 ml/s，160%理论6.4 ml/s，实际档位6.375 ml/s，允许超过旧的6 ml/s上限；基础6 ml/s时理论9.6，封顶8 ml/s。100%不需要增强，不强制多写一档。
- 其余补水参数保留：默认确认S2后0秒启动、实际称流达到S2目标85%收回、最长4秒请求收回、恢复后3秒渐进。用户已有的启动延时、收回阈值、最长时间和渐进时间保留；现有可调范围不变。
- 原压力保护保持：默认S2限压6 bar；增强在达到90%限压即5.4 bar时请求收回。600ms数据新鲜度、ACK/返回截止保护、帧确认、正式出水子状态、检查及写入预算、重量出口均保持。不在机器加热/混水稳温子状态执行增强，不增加skip或曲线帧。
- 原1.71存储百分比含义是称流目标，不能静默当作泵倍率。读取无`basis`的旧补水设置时，只迁移倍率为160%，保留其他有效参数并显示说明；新存储带`basis: pump-command`，用户后续设置的倍率跨重启保留。坏值仍回退默认并提示。旧页面含补水字段但没有新单位标记的应用请求会被拒绝，要求重新载入；完全没有补水字段的旧客户端仍保留当前参数。
- 同一曲线编辑器改为“基础泵流量倍率”，预览显示实际量化后的ml/s；85%收回另显示对应g/s。恢复默认、草稿版本、当前杯冻结、空闲应用和失败回滚保留。S3曲线、时长、手动/学习来源不重置。

注意：取消＋2后，不再有原先“额外指令积分≤8个指令ml”的界限；4秒只是计划请求收回时点，不是实测额外水量上限。8 ml/s是软件指令上限，不代表所有粉饼/机器条件下均已实测无过冲或无温度瞬态。

**455/455 Node模拟/回归检查通过**。验证结果见本包`tests/RESULTS_v0174.txt`；Node模拟覆盖新倍率、超过旧＋2边界、8封顶、驱动实际编码/收回、旧值迁移与新值保留、运行中稳温状态禁止派发、界面预览、S3/称流目标/温度保持及既有回归。没有1.72真机或完整浏览器验证。

## Historical release notes — 1.71

## 1.71 · 可视化S2补水设置与自由数值曲线编辑

用户先要求恢复S3旧递增值，随后明确取消源码恢复、选择在真机手动填写。**本版没有S3重置/迁移**；保留现存S3值、来源、时长，尤其是用户已手动恢复的0.698→0.720→0.778。新需求是把S2补水参数放在现有可视化曲线编辑区，并允许原曲线控制点自由输入数字。

### 同一编辑区，统一应用到下一杯

“下一杯·曲线编辑”增加S2提前补水滑块、机器指令预览、估算目标称流速及软件指令上限。滑块修改草稿，点击原有“应用到下一杯”才保存；“恢复补水默认值”只恢复补水参数，不重置S1/S2/S3曲线。现有S3手动值与算法来源保留。补水参数独立存储，不随杯间学习覆盖。

| 参数 | 默认 | 可调范围 | 步长 |
|---|---:|---:|---:|
| 启动延时 | 0秒 | 0–1.5秒 | 0.05秒 |
| 补水目标 | 目标称流速120% | 100%–140% | 1% |
| 实测称流速收回阈值 | 85% | 70%–90% | 1% |
| 最长补水 | 4秒 | 0.5–4秒 | 0.1秒 |
| 恢复后渐进至100%的时间 | 3秒 | 1–6秒 | 0.1秒 |

启动延时从确认进入S2帧后计算，不能设负值或在GHC确认/浸泡结束前补水。当前0秒默认仍尽早执行。正常收回阈值与渐进起点使用同一个配置值；压力/数据/最长时限保护仍可更早请求返回。最长补水设定是计划请求返回的时点，实际执行还取决于驱动与反馈，不能声称毫秒级硬件响应保证。

### 边界的计算与不能调的保护

可调范围以1.70已有限幅为工程边界，不作为所有机器/滤具环境的实测安全认证。设置→读取恢复→生成补水计划→驱动派发均有检查；伪造请求、超界、非有限值和非法步长不被接受。持续提早或增强都不能突破：

- 临时机器指令≤min(8ml/s，基础指令×1.6，基础指令+2ml/s)，按原生1/16向下量化。百分比是称流速目标，仍经LUT/可靠实测局部模型换算，不直接把g/s当ml/s。
- 因此计划额外指令流量最多2ml/s；计划最长4s时，计划增量积分≤8个“指令ml”。这不是实测进水体积、杯中增重或热/压力安全保证；机器标定、流动滞后和保护退出仍影响结果。
- 收回阈值最高90%，保留目标前至少10%的名义流速余量；不能保证所有惯性过冲被消除。0–1.5s延时只允许在确认S2后等待，最少0.5s持续时间覆盖多次常用档位检查，最长4s不放宽原增强期限。渐进时间最少1s，避免恢复后立刻一步把内部目标推至100%。
- 原压力<90%限压的增强准入/收回、600ms新鲜度、驱动ACK、返回截止保护、50ms最小发送间隔、渐进上调750ms、检查/写入预算、重量出口不开放修改。无新增skip、帧或GHC自动启动。
- 主动泄压关闭时仍使用既有连续模式短脉冲，新滑块显示当前不执行补水；保存的设置可供以后开启使用。开关状态不会因调整参数而改变。

### 参数保存与当前杯冻结

新独立KV键`s2RefillSettingsV1`，等待初次读取后才能完成曲线武装/应用；旧安装没有值则使用默认。坏JSON或非法保存值使用默认并提示，不悄悄接受危险值。曲线与补水草稿使用同一版本校验、空闲检查、保存事务和失败回滚；保存失败或上传/回读失败不能报告成功。参数只影响后续杯，当前杯使用冻结的计划。修改补水参数不改变物理LUT指纹、历史准入或原始校准表。

预览明确是估算，显示最大时限示意；达到称流速阈值或保护条件可以更早返回。更改S2基础值时预览同步跟随；应用后以服务器重新换算、限幅和校验结果为准。未把1.70的“返回目标回显缺失仍限制稳态学习”问题冒充为已解决。

### 曲线控制点可直接输入

选中S1/S2/S3控制点后可在数字框输入最多四位小数，也可精细拖动；例如0.698、0.720、0.778不再被界面强行吸附到1/16网格。上下按钮及键盘箭头仍移动一个**实际原生驱动档位**，从最接近当前值的原生量化档计算，触及边界停止；不会用表面小数变化假装实际下降一档。

输入值与对应驱动量化档位分别显示。软件允许保存精细小数，不代表机器具备0.0001ml/s控制分辨率；0.819/0.813仍可能落到同一个0.8125档位。保留0.10–8.00ml/s、S3前≤中≤后与相邻变化限制；非法输入不修改草稿，显示原因并阻止应用。不会因新数字输入而关闭S3三段或重置学习档位。

### 验证

**443/443 Node模拟/回归检查**，包含1.70的408项和35项新检查：默认/边界/步长、延时、70/90%收回、500ms计时、计划二次检查、6s渐进、持久化恢复/坏值回退、旧客户端、版本冲突、保存/上传失败回滚、当前杯冻结、所有硬保护保持、S3保留、滑块逻辑/双语、自由数字精确恢复旧递增值、非法输入、实际档位按钮与下边界。plugin及最终生成HTML脚本语法、HTML结构和1032翻译条目通过检查。没有1.71真机或完整浏览器运行验证；不能把模拟视作硬件过冲/响应已验证。原LICENSE/校准JSON/旧ZIP保持。

## Historical release notes — 1.70

## 1.70 · S2提早补水至85%；S3投影偏置与实测方向保护

用户1.69截图/run1793099785070-1显示：S2启动指令3.651ml/s，整段RAW3.821g/s，后段误差-12.32%、CV2.78%；回显缺失导致“补水后的基础值恢复尚未确认”，S2尚未纳入数值学习。S3启动三段0.813/0.813/0.813，实际整体1.619g/s、后段误差+11.62%，但归一化整体约1.513g/s，下一杯三段建议0.853。用户要求S2更早补水、估算120%目标流量、实测称流速85%时收回；同时调查S3为何由低转高、三段相同是否错误关闭shape。没有这杯完整CSV，以下确认的是源码机制与模拟，不声称已精确重放全部实机原因。

### S2：提早准备与120%目标估算

- 浸泡开始便准备RAW控制通道；此阶段没有泵写入、不消耗检查预算，不缩短浸泡或代替物理GHC按键。S2确认帧1且通道就绪后，首次检查使用一次0ms调度，不额外等250/944ms档位周期；随后的检查恢复原档位频率。去重定时器与一次kick标记防止回调风暴。1.69去掉的350ms切换等待保持；最多一次有帧预检的重启skip、一次S2重量切换，不增加skip或曲线帧。
- 补水目标为 **1.20×目标称流速**，例如5g/s→估算6g/s。g/s不会直接填入ml/s指令。若可靠上一杯尾段实测与最后指令有机器实际流量佐证，使用其局部比例模型；否则按可用LUT的相对变化换算，超出LUT包络时仅使用明确标记的有界局部比例估计，不伪称精确外推。示例：可靠4g/s对应2.5ml/s时，6g/s估算3.75ml/s；这是模型，不保证实际一定达到6g/s。
- 来源仅取可学习的同物理LUT/模式上下文上一杯；需尾段稳定、实测0.5–1.5倍当前目标、至少8条且≥80%的尾段机器记录新鲜、实际流量在参考指令±15%内且压力<90%原限压。排除杯、模式/LUT不符或缺乏佐证不使用此模型。模型只计算本杯补水指令，不自动视作已验证S2杯间稳态证据。
- 临时补水指令上限为 **基础值1.6倍、基础值+2ml/s、8ml/s** 三者最小，向下量化1/16。它比1.69的40%/+1上限宽，原压力、驱动ACK、数据新鲜度、共享检查/写入预算和4s最长增强保护保留；达到机器指令上限会标记commandLimited，不保证达到估算称流速。
- 正常收回改为 **实测RAW回归达到85%**；预测值不再单独触发提前收回。压力余量、秤失鲜、最长4s仍可提前返回。预测继续用于返回后的渐进阶段，防止响应正在上升时重复上调。恢复基础值并响应等待后仍在3s内由85%渐进100%，上调至少750ms，称重量阶段出口与最终目标重量不变。

### S3：等值三段确实是平直，但没有关闭三段模式

源码没有发现1.69修复时将已启用shape强制关闭的路径；0.813×8s→0.813×14s→0.813是**三段计时、相同流量**。原模式标签仅说明三段功能启用，不能代表数值有起伏。现在已应用与启动快照表格明确显示“平直（三段计时）”，真正不同值仍显示形状；保留其时长与5帧结构，不盲目恢复旧的递增曲线。

发现一个可造成偏高/压平的机制：单杯S3每段修正后，旧代码为保证非递减，向前取最大值；前段一旦上调，可能机械地把中、后段一起抬高，即使它们原建议保持/下降。1.68引入更敏捷单杯修正后，这个偏置更值得注意；不声称它独自解释用户所有杯差。

1.70将正常单杯和双杯LEVEL+SHAPE调整改为带每段时长权重的有界单调投影，保留非递减、相邻变化与四档逐段上限。冲突的三段共同让步，而不是用前段的新最大值覆盖后两段。为最终投影保留原始逐段建议，避免提前丢失后段下降意图。专门的停滞恢复规则保持。

对于杯内运行的S3，如果真实RAW尾段超出所选学习带，而归一化模型建议相反方向变化，高尾段阻止上调，低尾段阻止下调；仍可保留同向的限幅修正。模型冲突造成HOLD时显示“实测与模型方向冲突，保持”，不会冒称“在容差内”。投影后不足0.005ml/s的变化不会被当成新的数值应用。模型未被当成实际测量；RAW曲线/误差继续独立展示。该规则不保证根除所有杯差，也不会人为制造非平直命令；受当时非递减形状约束时，合理结果仍可能为平直。


### S3指令历史追溯

用户随后询问何时全段变为约0.819。1.67–1.69源码中没有写死0.819；它与0.813在杯内A010驱动中均编码为0.8125这一档，但不据此推断用户记错或具体修改时间。新增学习历史里的“S3指令变化时间线”，只读列出现存启动快照和已校验的下一杯应用，显示时间、来源杯、插件版本、三段数值、来源、平直/三段模式和学习排除状态。保留被排除杯用于溯源，不重新纳入学习。只有前后都已校验、同物理上下文且中间快照未缺失时才列出非平直到平直的观测转变；提案和失败应用不能当已执行。仅能报告现存最早证据，缺失旧记录不能宣称第一次修改。当前尚未取得用户设备历史文件，因此未声称准确是哪一杯。

### 验证与保留事项

**408/408 Node模拟/回归检查**：继承1.69的388项，调整新120%流量包络与实测85%收回期望；新增20项覆盖g/s→ml/s区别、LUT插值/超界回退、可信实测来源与排除/模式保护、浸泡预热通道、一次立即kick、S3时长加权投影、800组四档边界、实测高/低与模型相反方向、等值shape5帧上传及UI状态。包含plugin语法、生成HTML脚本语法、双语/HTML结构验证。996翻译条目。无1.70真机或完整浏览器执行验证；构造数据不等于用户该杯原始数据重放。

原LUT、历史及人工排除、温度设定、主动泄压/连续模式区分和四档强度保留，不需重校准。1.69的“S2返回目标回显缺失时暂不学习”仍是限制：本版没有把写入ACK直接冒充机器目标确认，也没有声称已解决底层全部缺失反馈。原LICENSE和校准JSON不变，旧安装包保持。

## Historical release notes — 1.69

## 1.69 · S2 先补水，85%收回，再渐进到目标

主动泄压后，S2使用独立的有界补水策略：不再先等待上一杯合格慢爬升证据，也不再要求泵实际流量先追到基础值的85%。两个原开关S2StartupAssist与杯内控流仍同时生效，默认开启；主动泄压关闭时保留原连续曲线的短脉冲策略。本版不改S3学习增益/限幅，保留1.68四档策略与历史/LUT。

- **尽早进入S2**：GHC确认preinfusion/pouring后，原固定350ms切换等待移除。并行预备RAW传输与一次新鲜帧号预检；已在S2不重发skip，帧号不符合不连续跳步。没有新增帧、skip、自动GHC按键或曲线上传。准备阶段不写补水指令、不消耗检查预算。
- **先有界补水**：只有已确认S2帧1、曲线已校验、机器/秤新鲜、压力低于原限压90%、没有未决S2指令且留足返回预算时，才在同一帧写较高流量。上限为基础值1.4倍、基础值+1ml/s和原8ml/s硬上限三者最小值，向下量化至1/16；例如基础2.5→补水3.5ml/s。这不是无限制机器最大流量。
- **85%提前收回**：短窗RAW重量/源时间回归达到目标85%，或最近上升趋势推算约400ms后将达到85%，即恢复已验证基础指令。目标5g/s对应4.25g/s。需至少6个唯一源样本、约0.6s、R²≥0.90；窗口0.75s为主，较低采样率可用1.3s内窗口，不用单点dW/dt。预测是有界趋势估计，不能保证消除所有惯性过冲。
- **独立时限与保护**：增强最长4s；压力达到限压90%或秤失鲜也收回。返回不等待补水目标回显/称流回归，但需前次驱动ACK、同帧和新鲜机器数据。补水/返回各有2s驱动ACK保护，最长增强+2.5s总返回保护；返回只有目标回显缺失时保持同基础值重试，不继续向上叠加。进入S3取消所有补水计时器，不再写上一帧。帧号缺失是未知状态，不会取消返回截止保护。
- **85%→100%渐进**：确认基础值ACK及目标回显后，保留1.6s响应等待，再让内部称流控制目标在3s内从85%渐进至100%。上调至少间隔750ms，检查仍按所选杯内档位继续；若预测现有上升趋势将达到当时目标，就等待惯性响应。下调保留原频率和边界。完成渐进后继续以100%目标微调，上调仍保持750ms间隔。
- **学习分开**：有实际补水写入的S2，稳态学习使用确认恢复基础值之后再过1.6s的窗口；补水段不进入稳态数值归一化或机器覆盖率分母。未确认返回时保留实测曲线，暂不把该瞬态当稳态证据。整段RAW误差、曲线仍完整显示，不将短暂补水效果伪装为稳态准确度。归一化窗口新增起止时间，诊断/CSV保留实际动作、85%收回原因与预测值。

检查/写入预算仍为每杯2000检查、按杯内档位50/150/200/250实际写入，含补水、返回和重试。原限压、硬停、原始LUT、温度处理、历史人工排除、杯间四档设置保留。无需重新校准。

Validation: **388/388 Node synthetic/regression checks**. Includes the361 prior checks with ordinary-control fixtures explicitly disabling startup to isolate that subject, and legacy planner unit tests explicitly exercising the continuous-mode planner;27 new active-release cases cover arm-without-history, switches/mode separation, quantization/envelopes, early low-actuator dispatch, unconfirmed-frame waiting,85%actual/predicted cutoff, freshness/tare/gaps, pressure/timed return, ACK/timeouts/target-onlydegradation, gradual approach/spacing, transient exclusion, zero-delay/prewarmed single-skip topology, and missing-frame return protection. Plugin and generatedHTMLscripts are syntax checked; both UI languages/HTML structure are covered. No1.69 hardware or full-browser execution validation yet; synthetic input curves are not proof of faster device filling. Physical drain amount is not measured or assumed as a known volume. LICENSE/calibrationJSON bytes unchanged.

## Historical release notes — 1.68

## 1.68 · 动态学习与来源标记

默认杯间学习档位改为 **正常**：一杯合格证据发现超出学习容差，下一杯即可生成、上传并校验一次限幅调整。无需再等一杯完全相同的指令。该设置与杯内控流的1–4档独立；已有杯内开关/档位和主动泄压选择保持。

| 档位 | 启动数值调整 | 学习误差带 | S1 每杯上限 | S2 每杯上限 | S3 每段上限 |
|---|---|---|---|---|---|
| 保守 | 两杯可比证据 | ±8% | ±4%且0.04ml/s | ±5%且0.10ml/s | ±4%且0.04ml/s |
| 温和 | 小偏差两杯；明显偏差允许单杯 | ±8% | ±5%且0.04ml/s | ±8%且0.20ml/s | ±5%且0.05ml/s |
| 正常（默认） | 一杯合格证据 | ±8% | ±10%且0.08ml/s | ±12%且0.35ml/s | ±8%且0.075ml/s |
| 激进 | 一杯合格证据，更高增益 | ±5% | ±15%且0.12ml/s | ±20%且0.60ml/s | ±12%且0.125ml/s |

百分比与绝对值同时限幅，并保留机器流量、S3 相邻增幅限制（2.2.14 起不再要求顺序递增）、压力与执行保护；不是承诺实际杯流按同比例改变。基础增益0.18/0.25/0.35/0.55。历史同向一致时作为约20%参考；当前与历史冲突时正常/激进缩小本次步幅而非一律REPEAT。保守保留两杯一致性检查；已确认S3停滞仍使用较保守的专门恢复规则。

**激进的统计学习准入范围为正常的1.3倍**。例如S2稳态与起步波动CV上限12%→15.6%，拟合未解释误差上限0.10→0.13，即R²0.90→0.87；固定S2回归R²0.97→0.961。最少统计时长/覆盖率按1.3折算，样本数向上取整；归一化窗口离散度25%→32.5%、历史参考一致范围35%→45.5%。它扩大可用证据，不把错误杯算正确，也不扩大实际出液目标或驱动安全边界。原始HIT/NEAR/MISS仍是出液诊断，与数据准入/学习误差带分别显示。

### Same curve, dynamic evidence

Normal/Aggressive use current clean S1 startup, S2 level and S3 frame evidence without requiring an identical-command repeat. Near-target current evidence holds; a pressure/actuator limit, unavailable RAW evidence, excluded fault or numeric response outside0.2–3×target still withholds correction. Missing evidence is never invented. Gentle permits a clean large scalar error(≥20%, with stable matching tail forS2) or largeS3frame error; Conservative requires comparable repeats. S3 single-shot LEVEL+SHAPE changes retain only the adjacent-rise bound; EARLY may sit above MID and LATE below MID. An explicit user OFF for autoapply still requires manual application.

For this single fixed HyperEx curve, numeric history no longer hard-matches targets, weight exits, soak time, temperature or pressure-setting microchanges. PhysicalLUT/multiplier, coffee/empty context and ActiveReleaseON/OFF remain separated. Existing coffee qualification and valid learned command seeds survive microchanges without resetting to empty calibration. Existing qualification-marker strings migrate by normalizing their original fingerprint. Learned override goal bindings accept bounded goal changes instead of discarding every small change; physicalLUT and mode guards remain.

Nearby scalar commands are compared through an explicitly labelled local proportional reference; S3 maps old frame commands/timings into a reference for current frames. The model has a bounded0.5–2 command/target ratio envelope; more distant history remains retained but is not forced into that model. The newest comparable contradictory observation is retained as conflicting evidence; Normal/Aggressive damp against it rather than searching for an older agreeing cup. Numeric extreme responses are excluded from numeric reference, independently of operator/fault annotations. Legacy version numbers are not an exclusion and the same adaptiveHistoryFileV2 storage key is retained.

Fixed-command S2 LEVEL uses a clean settled last60% RAW regression when available, preventing initial delay/ramp from being mistaken for a persistent plateau deficit. Whole-phase actual validation and plots remain unmodified. In-shot normalized target-window learning remains explicitly modelled; actual RAW output remains separate. Selected statistical thresholds/rejection reasons and learning policy appear in diagnostics.

### Startup assist without a prerequisite plateau HIT

Startupmetrics schema2 stores both target-referenced20–80% rise and observed-plateau-relative rise, with the displayed basis. A stable below-target plateau can qualify: Normal allows0.5–1.08×target, CV≤12%, targetovershoot≤8%; Aggressive widens these statistical ranges by1.3. Valid onset/continuous unique source timestamps, execution integrity and fresh machine coverage/headroom are still required. Machineheadroom statistics require≥80%coverage/8rows, <10%samples near≥95%pressurelimiter and≥90%post1s samples with actualflow≥85%observedtarget. No hard pressure limits are raised.

Normal/Aggressive can trial one native1/16ml/s quantum for400ms from one clean slow-rise cup (>1.2s/>1s). Gentle permits a very slow single cup(≥2.5s,CV≤8%); Conservative needs two compatible observations. Small S1/S2 starting-command changes no longer reset this evidence. Legacy schema1 metrics whose explicit rejection was only baseline-off may be reused, because that reason followed their strict headroom checks; absent raw metrics are not reconstructed. Normal/Aggressive do not require an identical preceding S1write signature; other policies retain bounded trajectory compatibility.

Runtime still requires sameframe1, verified original base target, fresh machine+scale, no pending/priorS2write, pressure<90%configuredlimiter, actualflow≥85%base, and reserved return/check budget. The dispatch window is2s; if a usable RAW estimate is already≥80%target, skip a late boost. One-quantum amplitude≤8%/8ml/s is unchanged. Existing independent base-return deadline, earlypressure return,2.5s total driver-ACK guard, missing-target-only degradation/retry, cooldown, same-frame checks and shared budgets remain. Continued assist needs an observed≥10%rise improvement against a consistent reference basis; this is not proof of individual-action causality. The UI separates NOTPLANNED/ARMED/ISSUED/RETURNING/SKIPPED and the actual reason, plus current next-shot eligibility, instead of an unexplainedNO.

### Original / Adaptive / Manual

Applied-profile and shot-start tables now show **ORIGINAL/LUT**, **ADAPTIVE**, or **MANUAL** independently of internal execution-override type and S3shape. Stageorigin is frozen atshotstart and persisted perstage/shape. Auto changes mark only changedstages adaptive; editingS2 does not relabel untouchedS1/S3 as manual. Numeric editor Keep retains adaptive provenance; actual user edits/selectingmanual create manual provenance. Visual editing, successful applies, persistence/reload and failure rollbacks preserve origins. Legacy adaptiveSource is an aggregate learned-source migration; unattributed legacy overrides show RETAINED/UNKNOWN rather than inventing user authorship. The saved LUT is unchanged.

### Storage and export diagnostics

The user confirmed the three reported cups were saved. This release does NOT claim they were lost: code inspection found exact-command and startup gates that can cause repeated waiting. A new per-run persistence audit reports current record/evidence presence, write/readback pending/verified status, lastreadback time and actualUTF8 bytes. A small successful probe alone does not claim the current cup was saved. Transient storage errors get atmosttwo idle retry/probes, and require whole-file readback before restoring verified status. Unload/shutdown clears retrytimers; failures remain visible.

New compact history records keep every action/ACK/target/fault but replace routine check rows with reason counts. Current full trace/CSV stays intact and older records are not rewritten. CSV now has the full current live trace despite the separate300event ring, a previously missingS2next-shot row, and origin/policy/history metadata. An independent flatS3 analysis null-dereference was found by the new reload integration test and fixed; it is not asserted as the user's reported cause.

Validation: **361/361 syntheticNodechecks**, plugin syntax, generated browser scripts and HTML/locale checks. The legacy regression harness explicitly selects Conservative and is supplemented by Normal/Aggressive cases: three-cup synthetic response→verifiedupload→diskreadback→reload→next-cup improvement; one-cupS1/S2/S3; conflictinghistorydamping; mixedmanual/adaptiveprovenance; exact1.3statisticalwidth and same-waveformCV admission; pressure/freshness/ACK/budgets unchanged; old-version/microsetting reuse; fullCSV/flatS3/storage recovery. These are simulations, not replay of the user's unseen3cups. No1.68 hardware/fullbrowser validation yet. OriginalLICENSE/calibrationJSON stay byteidentical. No new calibration or dedicated coffee tests are requested.

## Historical: Active release switch and continuous brewing (1.67)

ActiveRelease defaultsON, preserving the original S1weight→Idle/active release→soak→GHC restart→S2→S3 sequence. The switch is immediately after Enable in native plugin settings and the first highlighted control in the quick-settings editor. The diagnostics top banner always states ON/release-soak-restart or OFF/continuousS1→S2→S3, including before settings fetch. Dashboard DIAGheader text also identifies the mode. Chinese/English labels and reasons remain reversible. The active-shot UI now shows the runningstage instead of HYPEREXIDLE. Quick settings use the existing native settings endpoint, preflight idle/availability and reload once; no second switch store. Native host settings remain host-controlled: change between cups because saving reloads the plugin.

OFF runs one Espresso: atS1weight(default4g), a guarded single0→1advance entersS2; atS2weight(default40g), one1→2advance entersS3; atfinalweight(default100g), requestIdle. No intermediateIdle,soak,Espressoarm,restart countdown or second GHCconfirmation. Initial start stays the usual user start. Cumulative weight is not reset atstageboundaries. Natural S3shape timers remain unchanged, without extra skips. Continuous finalweight also stops whileS1transition awaits its APIread. Asynchronous preflight skips recheck phase/sequence identity before dispatch, so finishing/abort/restart cannot cause a late skip. Missing/null profileFrame is no longer coerced into0; the existing once-only bounded unknown-frame fallback remains. Explicit unexpected frames are rejected. Original active-release mode and its guards retain their default behavior.

Live trim stays defaultON/level3. In continuous mode the same controller also coversS1frame0, with the same RAWregression/freshtelemetry/pressure/actuator/onepending/ACK/target/native1/16/bounds safeguards. A pending S1weight transition blocks new S1writes. Existing50/150/200/250write and2000check limits cover the WHOLE cup, includingS1 andS2startupboost/returns/retries; no budget reset atstagechanges. Active-releaseON retains its previous S2/S3-only live coverage. Explicit liveOFF disables all live actions but preserves fixed-profile S1/S2/S3 completed-shot learning. The raw encoder now accepts the valid nativeframe0; no extra machine characteristic or global multiplier changes.

S1 corrected continuous cups use the original startup quality gates (2.5gcollected,20–80%≥0.9s/8samples/R²≥.90,active≥1.25s). Only that measured20–80%RAWtrajectory is fitted against integrated ACTUAL observed target exposure relative to the quantized starting command. It requires unique continuous source timestamps and freshsameframe target/machine coverage, known bounded commands, pressureheadroom and actuator tracking. Insufficient/limited corrected S1 does not pretend fixed-command evidence; its reason appears in the existing decision panel. This is explicitly a local proportional model, not physical causality or a modifiedRAWcurve. Two-cup consistency,±8%nextshotband and original bounded S1changes remain. Fixed S1 retains its existing path. S2/S3 learning is retained. S2startupshape also compares the preceding S1write signature; an unmatched actual S1trajectory skips the conditional startupboost.

Numeric fingerprints now include shotSettings.activeRelease. Missing legacy field meansON, so previous records remain usable in the originalmode. OFF numerical consensus cannot use ONcups, and viceversa; startupshape learning is isolated too. All history stays in the same retained file and manual exclude/restore rules still apply. The history table labels each cup's mode. Persistent command/shape/manual provenance uses the ORIGINAL manualTestOverrides key forON and manualTestOverridesContinuousV3 forOFF; reads, clears, applies and rollbacks route to the currentmode, and overrides carry the mode binding. Returning toON restores its savedcommands rather than overwriting them withOFFvalues. FreshOFF starts from the shared valid physicalLUT until it learns its own commands.

The original physical calibrationLUT and established coffee operating qualification are shared across the switch. Qualification ignores mode (like temperature) to avoid demanding new empty-basket calibration merely because the flow topology changed. This is readiness/baseline reference sharing, NOT mixed numeric consensus or sharing learned command overrides. Other physical LUT/settings/context guards remain, and explicit history exclusion cannot re-enter learning. No user history or prior ZIP is deleted.

Validation:328/328 syntheticNodechecks with all original305 plus23continuous-mode checks covering full two-skip/oneIdle run, original release flow, finalweight/latepreflight cancellation, transitionfailure, S1frame0driverwrites/normalization/insufficientfeedback, fixedlearning, mode/legacy history isolation, separate commandstorage/load/clear/verifiedapply, coffee qualification, UIstate/defaults/idle-savepreflight, S2startup preceding-S1guard and pressurestop. Generated browser scripts and HTML structure/IDs are checked. No1.67 hardware run or full browser/WebView visual validation yet. Continuous S1driver behavior and normalized-model accuracy require ordinary-use hardware evidence; no claim of guaranteed target tracking.

## S2 startup response and bounded pre-emphasis (1.66)

S2 retains its immediate FAST fixed baseline command on entry. It does not create a slow command ramp. Existing next-shot LEVEL learning remains responsible for the baseline; an independent response-shape analysis separates cup response delay, sustained20–80% target-flow rise time, tail60% mean/error/CV and overshoot. Measurements are rolling0.6–0.85s linear regressions of original scale weight against unique source timestamps, not instantaneousdW/dt. Crossing requires3successive good fits; a real-time windowed estimate is not an exact hydraulic delay measurement. First/reset/gap/frame/onset and execution integrity are checked. Analysis only: no automatic time-shift of displayed actual data.

The native plugin setting S2StartupAssist defaultsON, but requires live trimON and verified persisted history. Old records still supply existing LEVEL learning; they do not contain invented startup evidence. Two newest comparable startup records must agree within25% on rise time, have sustained20–80% rise>1s, tailerror≤8%,tailCV≤10%,overshoot≤8%, trustworthy completion/profile, same physical fingerprint/context/target and baseline within1/32ml/s, and same S1command. Temperature alone stays compatible. Machine telemetry coverage≥80%/8samples, pressure<85%limiter, and flow≥90%observedtarget after1s are required for shape eligibility. Newer comparable failed/fast/variable responses are not skipped to find older slow agreement. Excluding a history cup removes it from startup planning too. Old history/LUT is retained; no recalibration or dedicated coffee shots are requested.

When justified, the frozen shot-start plan requests exactly one native1/16ml/s upward quantum, no more than8% or8ml/s, for400–800ms derived from repeated rise time. It does not grow with each sample. Actual dispatch is same S2frame1, stockDE1 driver only, within1.2s of observedframe entry, after fresh machine/scale telemetry, verified original base target, machine flow≥90%base, pressureheadroom, no pending/retry/busy command, zero priorwrites and reserved return/check budget. If guards/socket are late, skip assist and retain ordinary baseline/trim. No extra profile frames, skipStep, pressure limit or global multiplier changes. Opening latency can mean no boost on that cup; diagnostics distinguish plan and issued write.

Independent400–800ms deadline requests the base command as soon as boostdriverACK and freshsameframe telemetry permit, regardless of boosttarget echo or scale regression. Rising pressure≥95%limiter also returns early. No normal scale correction can extend the pulse. Returning is a downward command, not an extra upward increment. At2.5s from boost dispatch, missing base-return DRIVER ACK triggers the existing Idle/abort safety path; raw transport/send failure also retains safety stop. Base-return driverACK without targetecho does NOT stop the shot: monitor in degraded mode and retry only the SAME base at≥3s with freshsameframe machine telemetry, inside existingwrite/check budgets. No upward progression until base echo arrives. Delayed echo recovers, then wait1.6s before regular cup-scale trim resumes. Cross-frame transition clears pulse timers and never returns into oldframe. Every boost/return/retry consumes the existing50/150/200/250writebudget; no budget reset. No unconfirmed boost stacking.

A completed assisted cup records the actual action and reference rise; bounded assist is retained only if the new eligible response shows≥10% shorter rise against that reference without excessive ripple/overshoot. This is an observational policy, not proof of individual-write causality. Otherwise revert to ordinary baseline and gather normal coffee evidence. There is no automatic boost escalation. All actual issued/target windows remain in the existing normalized LEVEL learning pipeline, so a temporary boost is not silently labelled a new constant profile command.

The next-shot decision panel displays delay/rise/tailerror, current next startup plan/reason and whether a boost was actually issued; labels/reasons have Chinese/English translations. CSV/raw diagnostic JSON and plots retain the original measured stream and action trace. Fixed-command curve-editor preview remains the baseline, not a promised actual cup response or a depiction of every conditional rawwrite.

Validation:305/305 syntheticNodechecks, generated browser-script syntax and existing HTML structure checks. No1.66 hardware test or full browser/WebView rendering. Rise/boost thresholds are software heuristics and hardware benefit is unverified. Explicit liveOFF disables both regulartrim and startupassist. OriginalGHC/two-skip topology, finalweight/pressure/scale guards, LUT, manual/history controls and persisted preferences remain.

## Learning history integrity and exclusion (1.65)

Step2 now includes Learning history · Exclude / restore shots. Select a cup by time/runID/version, choose Operator mistake,Plugin fault,Scale/cup disturbed orOther, then exclude it from future learning. The history table shows eligibility/reasons and which stages have retained evidence. Restore removes the user's exclusion only; automatic faults and normal stage quality/consensus gates still apply. No graph/evidence/LUT deletion, automatic profile rollback or extra machine upload. Already-applied commands remain current and can be adjusted using the curve editor. Existing history retention limits still apply.

Eligibility is enforced before current-shot suggestions/admission, during persisted/session restore, matching lookup and empty-baseline/reference counts. Excluded original evidence is retained for inspection and valid manual restoration, never silently merged back. Pending application of the excluded cup is cancelled. Control review/decision UI clearly labels exclusion instead of still claiming learning admission. Existing coffee operating qualification is persisted independently of later sample exclusion, preventing an annotation from resetting a valid coffee profile/LUT to empty mode. A changed physical LUT/settings key invalidates that retained qualification.

Automatic hard exclusions use positive evidence: incomplete/interrupted run, unverified initial profile, recorded execution abort/fault, more than2accepted plugin skip commands, or a gross in-extraction scale discontinuity. Scale inspection is within S1/S2/S3 after2s with at least2g prior gain: drop≥3g, or positive jump>max(12g,30g/s×dt) for a positive source-time gap≤0.6s. These are conservative software disturbance heuristics, not hardware-proven operator intent. Initial tare with no meaningful gain, intended dump/restart tare and normal GHC re-arm are allowed. Execution faults/skip counts survive event-ring truncation. Negative raw readings during release are not mistaken for extraction faults.

MISS, low flow, ordinary ripple, late decay, real stalls, pressure limitation without abort, and missing target feedback alone are not reasons to label a cup an operator/plugin mistake. Existing per-stage regression/pressure/actuator and consensus protections still decide numerical use. Legacy compact records without raw/events cannot be fully retrospectively audited; they retain available completion/profile checks, and the UI labels limited audit. Users can flag known old mistakes explicitly. No claim that all historical mistakes can be detected automatically.

Review edits require idle state and verified persistent history, use the existing history file (no second numeric data store), retain a bounded annotation log and serialize through its existing write/readback queue. UI shows save pending until readback. If dispatch fails, the session flag remains fail-closed with an explicit persistence error; persistence across reload is not falsely claimed.

## Historical consensus lookup fix (1.64)

A newer cup lacking S2 evidence, with a different phase command/context, or restored from unverified disk used to terminate the history search immediately. That could hide an earlier valid matching cup and make a currently admitted S2 keep reporting REPEAT SAME COMMAND. Now scan newest-to-oldest through the retained history and select the first comparable verified cup. Apply the same correction to S1/S3 history lookup.

Keep the same LUT/target/context/storage truth and stage command/shape checks. After finding the newest comparable cup, retain the existing variability/error-direction/pressure/actuator gates. Never skip a newer contradictory comparable cup to find an older agreeing one. No evidence is invented for a currently inadmissible stage. Missing current evidence still waits; this does not force every MISS into an adjustment.

The decision panel shows lookup counts (checked, missing stage, incompatible context/commands, unverified disk) and matched source run. These are translated while preserving raw IDs. A synthetic before/after replay of the same history (valid S2 → intervening missing-S2 row → current valid S2) changes old REPEAT to ADJUST2.507→2.607ml/s, then passes automatic upload and workflow verification. This reproduces a software defect, not the user's unavailable original1.62 RAW data. The exact blocker in the newly reported1.62 cup still needs its screenshot; do not assume this is its sole cause.

## 中文／English switch (1.63)

The page header now has 中文 / English buttons. Default language is Chinese; the chosen language is saved in existing pluginStorage under uiLanguage and restored on reopen/reload. Switches apply immediately without page reload, profile upload or a new machine request. Curve drafts, selected handles, input values, source records and learning history remain unchanged. Preference saves are serialized; an unsuccessful storage request visibly restores the prior language. Late initial-storage reads cannot overwrite a newer explicit choice.

Coverage: generated diagnostics/GHC pages, Step1–4 headings and controls, curve editor, automatic status and gate explanations, marker titles/details, confirm/alert dialogs, and plugin-provided dashboard/header/shot-strip text. RAW,LUT,ACK,DE1,units and product names are intentional technical terms. Raw CSV/JSON, numeric input values, IDs and code blocks are never translated. The native Decaid Plugins/settings interface is rendered by Decaid from manifest metadata and is outside the plugin page switch; this switch does not alter Decaid's app-wide language.

Text translation is reversible and observes newly rendered nodes, tooltips and accessible labels. Original text is retained in WeakMaps so switching cannot accumulate translation artifacts. The bootstrap is independent from the main diagnostics script; original CLOSE/HOME failure containment remains. The embedded reviewed catalog contains859phrase entries/aliases. Raw external error messages without a catalog entry remain original diagnostic text, not invented translations. The catalog is embedded in plugin.js; no remote translation/network service or extra dependency is used.

## Default live trim: ON / level3 (1.63)

User-authorized defaults now enable live trim at level3:250ms checks,2000check cap across S2/S3,200write cap including retries. Manifest and loadConfig defaults match; invalid/missing level falls back to3. Explicitly saved OFF or a different valid level is retained, so upgrading does not force a user's stored preference. A saved level1 remains1. Original ACK/pressure/source/command bounds,2%target aim and recoverable missing-target policy unchanged. Direct-driver-start test remains OFF. The initial slider, checkbox and instructional text match the new defaults.

## 下一杯曲线编辑（Step 2）

Step2 now contains a visual command editor with5 selectable handles: S1,S2,S3 EARLY/MID/LATE. Select a handle and drag vertically, use ↑/↓ buttons, or keyboard arrows. Each button advances to the next native1/16ml/s command level. Preview the draft and current commands, inspect generated parameters, then click 应用到下一杯. This is an explicit next-shot application, never a running-shot edit. Preview does not write to the machine.

The vertical axis is DE1 flow command ml/s, not measured cup g/s. Gray dashed is current setup; orange is draft. This is a stage diagram: S1/S2 remain weight-triggered, release/soak are omitted, and the S3 handles show their actual0/early/early+mid second starts. Change S3 EARLY/MID durations with±1s buttons (3–30s); late runs to final weight. S3 shape may place EARLY above MID or LATE below MID; only an adjacent rise is bounded. No free-form profile frames, extra skipStep calls, physical-response guarantee or invented delay model.

Editing S1/S2 preserves other stage modes and current commands. Editing S3 enables the3-part shape; switching shape off gives flat S3 at the middle command. Flow command bounds remain0.1–8ml/s. Draft/current visibility switches are separate. Dirty drafts survive refresh; changed applied parameters disable applying an obsolete draft until reloaded. Applying requires selected verified HyperEx, idle state, valid LUT, a fresh unchanged workflow, upload acknowledgement and final readback. Failure rolls back previous overrides. A successful upload followed by a page-refresh failure remains labelled applied, with a refresh warning. A successful application updates Step2 APPLIED PROFILE and provenance. Old-run automatic or manual adaptive proposals cannot overwrite the new curve; new completed coffees continue normal learning. Numeric precision editor remains under optional Step3 details, using the same storage/profile source, verification/rollback and prior-run supersession. RETURN ALL TO LUT also verifies application and suppresses stale old-run proposals. AUTO APPLY remains unchanged.

## Curve and decision output audit

- Real-scale flow chart has independent visibility checkboxes for cup target, RAW cup flow, Decaid cup flow, machine target, machine actual and issued flow commands. Units remain visible; original raw weight chart unchanged.
- Issued writes use ↑/↓ arrows with absolute direction (command increase vs previous = up, decrease = down; divergence from the target line is shown as-is) and length = |command − previous|×48 (1 level ≈3px). ↻ marks a fresh vector decided on an unresponsive trend, never a same-value resend. Historical writes without a recorded previous command have an unknown-direction dot. ACK is not a cup-output confirmation; matching machine target remains a separate square.
- Validation now has an adjacent 下一杯决策 panel explaining each stage's output error, whether an adjustment is proposed/applied/failed/held/waiting, and the exact learning blocker. Manual application marks the old cup analysis as superseded. An available proposal is not described as already applied before successful readback.
- Fixed-target learning previously tried dynamic exposure only when fixed-window seconds were too short. It now tries the dynamic path if ANY fixed-window admission gate fails, including temporal coverage or consistent-cohort share. Prefer an eligible dynamic analysis. RAW/machine/pressure gates, ≥1.2s and6unique source samples,R²≥.90, S2≥2.4s,25% temporal coverage,60% consistent-window share, matching two-cup consensus and correction bounds remain unchanged.
- Learning reports structured actual/required seconds, temporal coverage, consistent-window share and precise failures. It no longer says merely “need2.4s” when2.84s has already passed that condition. This repairs a skipped analysis path; it does not guarantee every MISS should cause an automatic adjustment.

## Retained controller and learning behavior

Original LUT unchanged. S1 startup quality gates unchanged; normal next-shot S1/S2 deadband8%,S3 LEVEL8%. Live target band2% is an aim, not guaranteed physical precision; DE1 command quantum1/16ml/s. Unique RAW source timestamps, pressure/actuator and fresh-machine guards retained. S3 timed subframes advance naturally. Only the original2business skip transitions; physical GHC confirmation remains. Home temperature persists; temperature alone does not invalidate numeric consensus or require a new LUT. Actual output review stays separate from labelled target-normalized local-model learning. Whole-cup smoothness supports overall outcome, not isolated per-write causal proof.

|Level|Check cadence|Check cap S2+S3|Write cap including retries|
|---|---|---|---|
|1|planned duration/50,minimum300ms; default944ms|2000|50|
|2|300ms|2000|150|
|3|250ms|2000|200|
|4|200ms|2000|250|

Live trim defaults ON at level3; diagnostic slider/native dropdown. Saved explicit choices and the per-level check cadence / write budgets in the table above are retained. Confirmation is trend-based, not value-equal: the RAW cup-flow slope converging on target (from 600ms after the write, error shrinking ≥0.015 g/s) is primary; machineFlow moving ≥1/16 toward the written vector corroborates; driver ACK stays a hard gate but does not by itself advance the command. Same-value retries are abolished: an unresponsive vector is recorded as vector-unresponsive and the next decision recomputes a fresh vector (add/remove) from the current trend, with no 3-miss downgrade cooldown and no 3s same-target resend. Write amplitude = |target − slope|×8 levels (1/16 quantized, capped at 4 levels), clamped into the base±20% envelope; no headroom reports command-bound-vector and no empty write is issued. Consecutive same-sign streaks raise the step cap (sameSignStreak ≥3 → 6 levels, ≥6 → 8 levels) so convergence needs fewer writes; the envelope plus trend-prediction hold limits amplitude. The fixed 1600ms S3 anti-jitter write interval is removed; whether to write is decided by the statistical gates (R², freshness, prediction hold, 2% deadband). Angle statistics (zeroDegreeShare of checks within |errorPct|≤2%, meanAngleDeg, sameSignStreak) are reported and shown in the diagnostic status line without a hard threshold. Missing driver ACK retains original abort path. Budgets never reset on recovery. Original pressure/no-scale/total-time/final-weight safeguards and post-shot profile restoration remain.

## Validation

305/305 Node simulations: steady-MISS retention, execution/extra-skip and scale anomaly exclusion, normal/delayed tare and GHC recovery allowance, manual exclude/restore, immutable evidence/LUT/profile, restore/merge bypass protection, coffee context retention/LUT invalidation, queued apply cancellation, invalid inputs/storage/busy gates, HTTP no-machine-write behavior, exclusion display and retained history selection/errors; plus interrupted historical lookup, missing-stage/context/command/storage exclusions, newest-conflicting-row retention, S3 lookup, absent evidence and automatic upload verification; plus reversible localization, newly authored text, raw CSV/JSON/input preservation, dialogs, storage rollback/late-read/serialization, dashboard actions, all static language coverage, ON/level3 defaults and explicit saved preferences; plus retained controller tests, generated browser-script compilation, UI draft/refresh/stale checks, pointer and keyboard interaction with a simulated DOM, quantization/shape/time bounds, real HTTP handlers for application and reset, rollback, fresh workflow edits, prior-run suppression/new-run learning, queued evaluation restoration, successful application vs failed UI refresh, arrow/retry direction, explicit stage decisions and dynamic fallback when fixed seconds pass but coverage fails. Generated full HTML has balanced elements and unique IDs; generated editor SVG parses as XML. Fixtures are synthetic, not unavailable user RAW replays.

Full browser visual/touch rendering was unavailable (Chromium/Firefox and SVG raster delegate not installed); simulated DOM/pointer checks are not hardware or full WebView validation. Existing handheld/tablet screenshots remain the actual1.60 evidence. No1.65 device results yet.

Run node --check plugin.js and node tests/verify_v0174.cjs. Current HANDOFF_v0174.md and tests/RESULTS_v0174.txt accompany this package. LICENSE and original calibration JSON are unchanged. Delivered older ZIPs remain immutable; old remote files retained for history.
