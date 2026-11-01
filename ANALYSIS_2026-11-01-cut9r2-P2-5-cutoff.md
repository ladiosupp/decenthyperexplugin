# P2-5 分析 — cutoffPercent 一值三用（2026-11-01，cut 9 第二轮，未改代码）

基线：HEAD a2c711f（v2.2.18 发布记录），plugin.js 快照 D:/vscode/.tools/__hx-plugin-head.js。工作区里 plugin.js 已被改、verify_v02220.cjs 未跟踪，说明 cut 5 第二轮在飞行中，**本次一行代码未动**。

## 1. 一个滑块现在同时驱动三件事

| 用途 | 位置 | 判据 | cutoff 85 → 70 时的变化方向 |
|---|---|---|---|
| (a) 灌水转 shaping 的起点 | boundedRefillCommand | predicted < target×frac 时保持 flood，过了就按 platform+(target−predicted)/r 往下走 | 起点 4.25 → 3.50，**提前 0.75 g/s 离开满灌** |
| (b) boost 跳过 | dispatchS2Startup | reg.slope ≥ target×frac（refill）或 ×0.8（legacy）就跳过补水 | 跳过阈值 4.25 → 3.50，**更不容易跳过** |
| (c) 收回的观测噪声底 | s2RefillReturnReason | observed ≥ threshold×0.6 且 **predicted ≥ target** 才收 | 噪声底 2.55 → 2.10，**更不容易被底挡住** |

真正的收回判据是 predicted ≥ target，与 frac 无关；frac 只出现在 (c) 的噪声底上。技能 §22.11 的口径也是「cutoff 只当观测噪声底，收口看 predicted = target」。2.2.17 的 UI 已经把它改名叫「收回噪声底」并显示「触发 ≈ 51%」——**这个标签只对 (c) 成立，对 (a) 和 (b) 是错的**，而 (a) 才是影响曲线形状的那个。

## 2. 三个用途的贡献能不能分开（结构判断，先于实测）

- **(c) 几乎不绑定**。它只在「predicted 已到 target 而 observed 还低于 0.6×frac×target」时才起作用，也就是要求前瞻项独自贡献 >2.45 g/s（frac=0.85）。这在极陡上升时可能发生，且发生时是**推迟**收回（坏方向）。降低 frac 会把噪声底也降低，让它更不容易绑定——所以调低 cutoff 对 (c) 的影响是「更松」，与用户「下调 cutoff 来压过冲」的意图方向一致但作用极小。
- **(b) 正常杯不触发**。boost 跳过要求补水派发那一刻 S2 已经在出液且达到 frac×target；正常杯在 frame 1 确认时杯里还是干的。它只在 onset 极快的杯子上生效，而降低 frac 让它**更不容易跳过**——方向与 (a) 相反。
- **(a) 是唯一的实际杠杆**。降低 frac 会让控制律在 predicted 只有 3.5 g/s 时就离开满灌开始 shaping，等于**提前收油门**。这直接牺牲 §22.11 的首要目标（上升段接近 90°，需要 ≥7.0 ml/s 维持到接近目标），换来峰值过冲下降。

结论：**用户按文档「过冲就下调 cutoff」时，实际买到的是「上升段变缓」，而不是「收口提前」**。UI 只说噪声底，所以这个副作用是不可见的。这与技能 §22.11「cutoff 只当观测噪声底」冲突，审查的定性成立。

## 3. 建议的解耦（等用户拍板后再改）

- cutoffPercent 只留给 s2RefillReturnReason 的观测噪声底（保持现语义，UI 标签也就名副其实）。
- boundedRefillCommand 的 shaping 起点改成**固定 target**（predicted < target 时保持满灌），或引入独立的 trimAtFraction（默认 1.00）。理由：shaping 起点是「什么时候开始收油门」，它应该由目标水平和泵滞后决定，不该跟着一个被标成噪声底的滑块漂。
- boost 跳过改成固定阈值（审查建议 0.85×target），与 cutoff 解绑。
- 若用户选择保留联动，则必须在 UI 与技能 §22.5 里写明「这个滑块同时改 trim 起点与跳过阈值」，不能只写噪声底。

三种方案的取舍：固定 target 最符合 §22.11 且没有新旋钮（推荐）；trimAtFraction 多一个可调项但保留真机调参空间；保留联动最省事但文档必须改，且用户调过冲时会 unknowingly 牺牲上升段。

## 4. 实测扫描：已备好，未取数（如实说明）

扫描工具已建：D:/vscode/.tools/__hx-p25.cjs（自 verify_v02218.cjs 复制，两处改动——refillLoopEnv 的 cutoffPercent 读 HX_CUTOFF、runner 支持 HX_ONLY 过滤），跑在 HEAD 的 plugin.js 快照上，不受飞行中的 2.2.20 影响。

**没有取到数字**，原因是 v02218 里补水闭环测试在 HX_LOOP_REPORT 下不再打印报告行（cut 0 重写测试时改了），所以扫不出 rise20-80 / 峰值 / 平台偏差。要取数需要在 verify_v02221 里加一个插桩跑法（按 cutoff 99 / 85 / 70 × r 1.29 / 1.05 各跑一次，并记录 cutoff 时刻的 observed 与 predicted 以验证 §2 关于 (c) 不绑定的判断）。这属于「写 verify_v02221 的测试」，是本次允许的动作，但需要 HEAD 到 v2.2.20 之后基于 v02220 复制才不会和在飞的 cut 5 冲突。

预期结果（供统筹判断优先级，不作为结论）：cutoff 99 → 85 → 70 应当呈现「上升时间变长、峰值过冲变小、平台偏差变化不大」，因为 (a) 是唯一杠杆；如果实测显示平台偏差也随 cutoff 明显变化，说明 (c) 在陡上升时确实绑定，那就要重新评估。

## 5. 同批退回的另两项（状态）

- **P2-4**（收回笔 trace 的 previousMlS 记成 boosted）：已确认代码事实——previousCommand 取 t.commands[1]（bleed 后是 1.375 一类），而 return 分支记的是 boundedRefillCommand 在 return 时刻重算的值。测试已写好，见 D:/vscode/.tools/__hx-cut9r2-p24-test.js，预期先红。改法照审查建议：所有 action 统一用 previousCommand，需要保留计划值就另加 plannedMlS 字段。
- **P3-6**（commandLimited 在 bounded 下恒真）：确认成立，bounded 下 boost=8、commandLimited=boost>=8 恒 true，「已触及指令上限」会一直显示。属显示语义，不动安全逻辑。建议改成 floodAtSafetyEnvelope（含义正确且不再像异常），或只在 boost < 上限时显示「受限」。等 2.2.20 后一起改。
