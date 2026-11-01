# cut 9 补水收尾 — 交接页（2026-11-01，统筹）

你是原审查对话，cut 9 归你所有，不要新开对话。这一页自包含，照着做即可。

## 当前基线

- 仓库 `D:/vscode/decenthyperexplugin`，分支 `v1.79ds`，HEAD `63fc42c`，未推送、未打 tag。
- 版本链：2.2.7 `8dc82b6` → 2.2.8 `b7dd667` → 2.2.9 `d4f0593` → 2.2.10 `369d0f5` → 2.2.11 `80da6b4` → 2.2.12 `56aba8d` → 2.2.13 `0fe8971` → 2.2.14 `a9df732` → 2.2.15 `edee380`（+ `63fc42c` 文档补记）。
- **补水段自 2.2.7 起没有再被改动**。cut 1–8 改了：杯内预测（1.5 s 前瞻、双向外推夹幅、null 守卫）、步长与信封（`commandCeilingFor`）、门槛（S3 累计档数、F3 静默、F4 预算）、杯间学习（解除封锁、降权）、增益记忆结构（最近邻、中位数中心、跨桶回退、r 带 commandBand）、档位统一（`sameCommandFlow` 1/32）、S3 形状（删 `stage3ShapeOnlyConsensus`、档位门槛）、三套 S2 估计（`s2ReverseEstimate`、HOLD 改比本杯曲线）。
- 改补水前先看这些新接口，别绕开它们另起一套：`snapCommandFlow` 已全局归档、`commandCeilingFor`、`s2ReverseEstimate`、`gainMemory` 的 `bands`。

## cut 9 的范围

1. **R-5**：学习窗在「收回未确认」时三处退回无窗口的洞。
2. **R-7**：`maximumExtraCommandMl` / `commandLimited` / `strategy` 命名 / `flowMaxGS` 双定义 / `basis` 标签 / `fromMs` 死字段。
3. **F2**：`S2_REFILL_SETTLE_MS` 1500 ms 还是 §19 的 200 ms？**用户未定，先问，不要自己选。**
4. **T-11**（cut 3 按边界留给你）：`approachWriteIntervalMs=750` 被同 tick 后面的 1200/800 ms 静默门完全覆盖；`approachMs` 默认 200 ms 而 tick 周期 250 ms；`approachFraction` 恒 1。
5. **补水侧纹波门槛**：`s2RefillPumpEstimate` 15.6% 与 `stage2StartupPlan` 12%，与杯间已统一的 12–20 damped / >25 HOLD 不一致。这两处一直没动，现在归你。

## 口径约束（不可违）

- 泵流量是**趋势矢量**，不是流量设定值；灌水上限只由安全包线 8.00 ml/s 给出，不由 target / r / base 推导。
- r 只用于平台 `target/r`，允许 >1，且是命令的函数（1–4 ml/s ≈1.23，高流量区 →1）；r 不决定灌水量。
- 收口两段：cutoff = 实测 ≥ 0.6×cutoff（噪声底）且 predicted ≥ target；触发后先 bleed 断流，700 ms 或回落到 target×1.02 内，再写平台。
- 门槛：第一安全，第二数据有效，**不许成墙**。
- F3 / F4 已定（见 COORD_HANDOFF），直接照做；**F2 仍待用户拍板**。

## 验收要求

- 版本 **2.2.16**；`tests/verify_v02216.cjs`（v02215 原样保留）+ `RESULTS_v02216.txt`。
- `ACCEPT_2026-11-01-cut9-refill-closeout.md`：结论 / 范围 / 口径 / 改动逐条 / 测试 / 闭环数字 / 真机交叉验证 / 复现 / 清单 / 限制。
- 测试只写口径不变量或闭环结果，镜像断言禁止；安全门测试不许删或弱化。
- 用最新真机 history JSON 交叉验证，并校准闭环植物、把参数与准确度记进技能台账（≥5 ml/s 稳态 r 仍是 0 样本，涉及该区间就如实记「不记达标」）。
- 做完用 `send_message_to_thread` 把验收发回统筹：**threadId `01a19567-d49b-7f92-b5bc-1d47ee45d4d1`**。
- commit / tag / push / 发版：每一次都要用户当次点头。

## 当前数字（供判断，不要当验收标准）

- `verify_v02215` = 677/677；补水闭环峰值 +33.2%、绊线 `<=40%`（v2.2.7 口径）。
- HOLD 现在比本杯曲线指令；S3 形状门/学习门按 1 档计。
- ≥5 ml/s 稳态 r 0 样本；高流量区只能用 2.2.2 那杯 boost 7.6875 → 7.602 g/s（r≈0.99）作参考。
