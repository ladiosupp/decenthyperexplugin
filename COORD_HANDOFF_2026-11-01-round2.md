# 统筹交接 · 第二轮复查（2026-11-01）

第二轮复查已收口（2026-11-01）。下面保留原逐 cut 清单供追溯，**最终结果以「第二轮收口结果」为准**。
接手者先读 `C:/Users/ladios/.codex/skills/decentplugin/SKILL.md` §22.10–§22.12、`REVIEW_2026-11-01-flow-control.md` §9/§10/§11、本页。

## 规则

- 派新任务用 `create_thread`，**必须嵌套 target**：`{ prompt, title, target:{ type:"project", projectId:"5f74cf60-4cb4-4b5c-b439-b5bdf0cde7e5", environment:{ type:"local" } } }`。
- 退回原 cut 用 `send_message_to_thread`，一次一条，写清「要改什么 + 验收标准 + 不要碰什么」。
- commit / tag / push / 发版：每次都要用户当次点头。只读检查、跑测试不用问。
- 版本号顺序递增；一个文件同一时间只让一个 cut 改（`plugin.js` 是单文件）。

## 当前状态

分支 `v1.79ds`，HEAD `41d9a22` = v2.2.22，706/706；2.2.19–2.2.22 已入库，tag / push / 发版按用户当次点头执行。工作区有别的对话未提交的 `HANDOFF_2026-10-31.md` 等，别碰。

| 版本 | 提交 | 内容 | verify |
|---|---|---|---|
| 2.2.7 | 8dc82b6 | 补水两段收口 | 642 |
| 2.2.8 | b7dd667 | T-1/T-2/T-3 杯内预测 | 645 |
| 2.2.9 | d4f0593 | T-5…T-8、L-8 步长与信封 | 649 |
| 2.2.10 | 369d0f5 | T-4/T-9/T-10/T-12/T-13（T-11 归补水） | 651 |
| 2.2.11 | 80da6b4 | L-1/L-2/L-3/L-11/L-12 杯间学习 | 651 |
| 2.2.12 | 56aba8d | L-4/L-9/L-10 增益记忆结构 | 658 |
| 2.2.13 | 0fe8971 | Q-1/L-14 档位统一 | 661 |
| 2.2.14 | a9df732 | L-5/L-6 + 档位门槛 | 666 |
| 2.2.15 | edee380 | L-7/L-13/L-15/L-16 + HOLD 可达 | 677 |
| 2.2.16 | 6057dae | R-5/R-7/F2/T-11 + 纹波门 | 679 |
| 2.2.17 | 37b0566 | cut 11 诊断页文案与补水折叠 | 682 |
| 2.2.18 | e4b0433 | P1-1 boost ACK 计时器、P1-2 默认 cup-target、P1-3 同杯去重 | 686 |
| 2.2.19 | 30bc35d | cut 4b 学习历史上下文、α 分阶段、覆盖门文案 | 689 |
| 2.2.20 | 9343187 | cut 5 桶几何只在有观测时提交（P2-3） | 692 |
| 2.2.21 | 5d7e5a9 | cut 9b trace previousMlS、commandLimited、cutoff 三用说明（C） | 698 |
| 2.2.22 | 41d9a22 | cut 7b S3 drift LATE 相邻增幅门（P2-1，LATE-only） | 706 |

文档提交：`9abbb03`、`f223547`、`63fc42c`、`97a2db7`、`68d654e`。
**注意**：`verify_v02213.cjs` 在 2.2.14 及以后会 setup 阶段 ReferenceError（hook 引用了已删的 `stage3ShapeOnlyConsensus`），属预期，不是回归。

## 已定口径（不要重开）

- 泵流量是趋势矢量；灌水上限只由安全包线 8.00 给出。
- r 是命令的函数：1–4 ml/s ≈1.23，高流量区 →1；只用于平台 `target/r`。
- 两段收口：cutoff 噪声底 0.6×X%、predicted ≥ target 才收；先 bleed 再平台。
- F3：救急静默 `max(800, 实测 ACK)`，上限 3000。
- F4：S3 预算按累计档数（24），趋势角 ≥120° 三点放开常规预算，全局 maxWrites 仍是安全门。
- F2：测量窗 800 ms / 链路窗 1500 ms（用户拍板）。
- S3 形状门与学习门按档位计，至少 1 档。
- `refill-85` 改名：**不做**（持久化字段）。
- cutoffPercent（用户选 C）：一值三用——满灌转 shaping 起点、boost 跳过阈值、收回实测噪声底；真正收回看 `predicted ≥ target`。UI 叫「收回 / 收口起点（%）」，不要再写「只当噪声底」。
- `controlOutputQuality.basis`：**不改**，它是回放脚本/台账读的导出兼容字段；窗口说明用 `basisDetail` 与学习行。

## 逐 cut 复查清单（重点看「未证明」有没有被写成「已完成」）

- **cut 0**：642/642，bleeding 5 条；闭环基线 +33.2%、绊线 <=40%。查是否还有镜像断言残留。
- **cut 1**：T-1/T-2/T-3。闭环平台 −8.2%→−6.9%；「低于目标的下调笔数 0→0」是守门断言不是改善。查 T-2 的 ±0.6×target 是否把正常加码也夹住。
- **cut 2**：`commandCeilingFor` 统一四上限；S3 +16.1%/2 次反转 → −1.5%/0 次。S2 平台前后都是 −6.9%，收益只在「信封外指令」。
- **cut 3**：F3/F4 落地；T-11 当时留给补水（cut 9 已做）。24 档是审查建议值，无真机标定。
- **cut 4**：门解封锁已被真机支持；「下一杯收敛」未证明（crossBand + 无下一杯）。`ACCEPT_..._cut4` §5.7 已把 +33.9% 推翻，别再用旧数。
- **cut 5**：桶最近邻/中位数/跨桶回退。风险：半径下限 0.08 的建桶速度（真机 0.152 跳变已新建桶）；`commandBand` 老记忆首次观测后才写；导出无 `evidence.s3`。
- **cut 6**：档位统一。HOLD 算术修好，但真机不可达的问题已归 cut 8 修（`actual` 改比本杯曲线 + `hold.all`）。「每杯重写曲线」缺端到端计数。
- **cut 7**：删 `stage3ShapeOnlyConsensus`、`s3StepLimit`；根因 `run.config.s3DriftModel` 缺失已修。`earlyFactor/drift` 仍 ±20%/杯的比率步幅。
- **cut 8**：`s2ReverseEstimate`；真机末杯比例解 4.107→4.0625（−1.1%），旧记忆 −5.4%、旧仿射 +14.9%；链路仿射因斜率只有当杯 r 的 46% 被拒。未决：target >2× 与 `mapCreatedAt` 变化仍整套作废；L-15 的 12% 纹波门是否与 cut 4 的 damped 口径冲突；记忆同区先验含当杯 r（权重≤0.25）。
- **cut 9**：R-5/R-7/F2/T-11/纹波门；`strategy` 改名不做。查 R-5 的「三处拒绝」是否真的覆盖所有测量消费方。
- **cut 10**：文档已对齐；只剩 `controlOutputQuality` 的 basis 文案（归 2.2.17 UI 改动，spec 在 `UI_SPEC_2026-11-01-cutoff-label.md`）。

## 仍需真机验证（按优先级）

1. ≥5 ml/s 稳态 r（S2 固定 5.5/6.5/7.5 各 3 s），仍 0 样本。
2. 补水峰值与 bleeding 时序：断流≈平台×0.35、bleed→return≈700 ms、秤流峰值（基线 +33.2%）。
3. 分桶半径 0.08 的建桶速度。
4. 同一条件是否真能 HOLD（现有导出一次都没有）。
5. S3 drift 上机（最新杯缺 `evidence.s3`）。
6. S2 平台是否离开 −21…−29%。
7. T-1/T-2 的 49/730 复算——**check 行在 `shots[i].fullRecord.liveFlowTrim.trace`**，不是顶层 `liveFlowTrim.trace`；只保留最近 4 杯全量、最近 10 杯 trace。
8. F3 实测 ACK 分布（手上有 1235 ms 一笔）。
9. cut 4「下一杯 S2 收敛」仍待下一杯实跑。
10. R-5「收回未确认」路径的真机覆盖。

## 复查产出

每读一个 cut，记一行：cut / 提交 / 复查结论（通过 / 要改什么）/ 退回给它还是并入后续版本。全部过完后给用户一张总表 + 建议的下一版号（2.2.17 已被 UI 文案占用）。

## 线程 id（退回时用）

- cut 0 `01a1956a-ad66-7710-b003-d5de3218291a`
- cut 1 `01a19589-d85c-7963-b079-3a318ee3777d`
- cut 2 `01a1959d-a69f-70e1-b816-f48ceda1af3f`
- cut 3 `01a195aa-b6d9-71c1-b11b-4357813d601c`
- cut 4 `01a195b3-9aa8-7ec0-9178-3579aed6272a`
- cut 4-2 `01a195c0-399c-7693-8f69-0104ac80fe27`
- cut 4-2b `01a195e0-1b87-7170-afb3-05a3ce702aad`
- cut 5 `01a195be-00ae-7450-b867-a9830f1a1a5b`
- cut 6 `01a195c9-51a3-7362-af0c-849230326dbf`
- cut 7 `01a195e2-73e2-75b3-ad9d-bfc4629b07b9`
- cut 8 `01a19600-7f0f-7910-8500-f19a326e6699`
- cut 9（原审查）`01a1948f-1bcb-7d30-88d7-007180b22ba1`
- cut 10 `01a19643-0f11-7241-acf2-e7a2fd9a1297`

线程标题可能被改过，发送前用 `list_threads` 核对一次标题与 id。

## 第二轮收口结果（2026-11-01）

| cut | 交付 | 复查结论 | 版本 |
|---|---|---|---|
| 0 | 2.2.7 / 8dc82b6, 642 | 通过：5 条 bleeding 专项；无新增镜像断言；闭环 +33.2%、绊线 ≤40% 仍在 | — |
| 1 | 2.2.8 / b7dd667, 645 | 通过：T-1 null 守卫、T-2 双向夹幅、T-3 1.5 s。残留：±0.6×target 夹的是加速度位移，S2 正常加码未被夹；S3 下落也共用 0.6×target，极端衰减可能被低估，无真机样本，未改 | — |
| 2 | 2.2.9 / d4f0593, 649 | 通过：commandCeilingFor 统一；S3 +16.1%/2 反转 → −1.5%/0；S2 平台前后都是 −6.9%，收益只在信封外单步（文档已如实写） | — |
| 3 | 2.2.10 / 369d0f5, 651 | 通过：F3/F4 落地；T-11 归补水（2.2.16 已做）；24 档是审查建议值，无真机标定 | — |
| 4 | 2.2.11 / 80da6b4, 651 | 文档判断正确（门解封锁有真机支持、下一杯收敛未证明、+33.9% 已被 2.2.13 推翻）；代码退回三项 → 2.2.19 | 2.2.19 |
| 5 | 2.2.12 / 56aba8d, 658 | 主体通过；P2-3 桶几何无观测也更新 → 2.2.20。风险仍是半径 0.08 / 0.152 跳变、commandBand 首次观测后才写、导出无 evidence.s3 | 2.2.20 |
| 6 | 2.2.13 / 0fe8971, 661 | 通过：HOLD 与曲线比较、all-HOLD 不重写；autoApply 在 !actionable 时直接返回，结构上不会写 profile。缺一条端到端“全 HOLD 零 profile 写”的计数测试（低优先） | — |
| 7 | 2.2.14 / a9df732, 666 | 主体通过；P2-1 的 LATE 越界 → 2.2.22。EARLY>MID 是 UI 允许的，未加对称上限 | 2.2.22 |
| 8 | 2.2.15 / edee380, 677 | 通过：s2ReverseEstimate 4.107→4.0625（−1.1%），仿射因斜率只有当杯 r 的 46% 被拒；target>2× / mapCreatedAt 变化仍整套作废（刻意）；12% 纹波门是 controlLearningAssessment 的杯内门，与 gainStageObservation 的 25% hard / 12% damped 不冲突；同区先验含当杯 r（权重≤0.25，影响<0.01 ml/s），记录不改 | — |
| 9 | 2.2.16 / 6057dae, 679 | 通过：R-5 的窗口覆盖 gainStageObservation / controlOutputQuality / controlLearningAssessment / chain / timeline 五个消费方；F2 800/1500 落地；strategy 改名不做。P2-4/P3-6 + P2-5 C → 2.2.21 | 2.2.21 |
| 10 | 文档 | 通过：表格与 §9/§10/§11 对齐；basis 项收口为“保留导出兼容字段，显示用 basisDetail”，无代码改动 | docs |

## 仍未做 / 未验（按优先级）

1. ≥5 ml/s 稳态 r（S2 固定 5.5/6.5/7.5 各 3 s），仍 0 样本。
2. 补水峰值与 bleeding 时序：断流≈平台×0.35、bleed→return≈700 ms、秤流峰值（基线 +33.2%）。
3. 分桶半径 0.08 的建桶速度（真机 0.152 跳变已新建桶）。
4. 同一条件是否真能 HOLD（现有导出一次都没有）。
5. S3 drift 上机（最新杯缺 evidence.s3）。
6. S2 平台是否离开 −21…−29%。
7. T-1/T-2 的 49/730 复算——check 行在 `shots[i].fullRecord.liveFlowTrim.trace`，不是顶层。
8. F3 实测 ACK 分布（手上有 1235 ms 一笔）。
9. cut 4「下一杯 S2 收敛」仍待下一杯实跑。
10. R-5「收回未确认」路径的真机覆盖。

## 2.2.19–2.2.22 的边界

- 2.2.19 只改 stageGainEstimate / gainBackfillAlpha / stageActuatorEvidence 的 reason。
- 2.2.20 只改 updateGainMemoryFromRun 的提交时机。
- 2.2.21 只改 dispatchS2Startup 的 trace 记录、commandLimited 显示、cutoff 文案/技能；控制律零改动（C）。
- 2.2.22 只补 S3 drift 的 LATE 相邻增幅门；EARLY 自由未动。
