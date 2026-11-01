# 验收 · v2.2.21 — 补水段 P2-4 / P3-6 / P2-5（C 口径）

日期：2026-11-01。基线：HEAD `9343187`（v2.2.20，692/692）。目标版本 2.2.21。
来源：`REVIEW_2026-11-01-2.2.17-whole.md` 的 P2-4 / P2-5 / P3-6、`ANALYSIS_2026-11-01-cut9r2-P2-5-cutoff.md`、技能 §22.10–§22.12。

## 用户决定（2026-11-01）

- P2-4、P3-6：直接改，加测试。
- **P2-5 选 C**：`cutoffPercent` 保留一值三用，不改 `boundedRefillCommand` / `dispatchS2Startup` 的控制律，只把联动讲清楚；不新增 `trimAtFraction`。
- 不碰杯内 `liveTrimTick`、增益记忆、S3 形状、桶几何、2.2.19/2.2.20 的代码；不 commit / tag / push。

## P2-4 · 收回笔的 `previousMlS` 记成重算值（已修）

**事实**：`dispatchS2Startup` 的 write 记录原来写 `previousMlS: action==="return" ? boosted : previousCommand`；`boosted` 是 `boundedRefillCommand(t)` 在 return 时刻重算的值，不是实际在跑的前一笔（bleed）。导出里 bleed→return 会从 1.375 读成 3.875，重叠/斜率/「上一笔」分析全部失真。

**改法**：所有 action 统一记 `previousCommand`；refill 收回笔另加 `plannedMlS`（重算值），不覆盖 `previousMlS`。

**验收**：闭环测试断言 `return.previousMlS === bleed.commandMlS`、`boost.previousMlS === plan.baseCommandMlS`、`plannedMlS` 为有限数、`previousMlS` 不回落成 8。见 `tests/verify_v02221.cjs` 的「P2-4 the refill trace records the command that was actually running before each write」。

## P3-6 · bounded 下 `commandLimited` 恒真（已改显示语义）

**事实**：bounded 模式 `boost` 恒为安全包线 8 ml/s，旧判据 `commandLimited = boost>=8` 每杯为真，读起来像「撞上限」的异常。

**改法**：新增 `plan.floodAtSafetyEnvelope = bounded && boost>=LIMITS.commandFlowMax`；`plan.commandLimited` 在 bounded 下为 `false`，legacy 分支保持 `requested>ceiling`。曲线编辑器安全行在 bounded 追加「灌水在安全包线（设计值）」。**安全逻辑一行未动**（压力门、ACK、限压、预算、看门狗全部原样）。

**验收**：bounded 计划断言 `floodAtSafetyEnvelope===true` 且 `commandLimited===false`；legacy 的 9.6/8 夹具仍断言 `commandLimited===true`（v02220 原测试原样通过）。

## P2-5 · cutoffPercent 一值三用（C：讲清楚，不解耦）

### 当前三个消费点（控制律未改）

| 用途 | 位置 | 判据 | 下调 X 的方向 |
|---|---|---|---|
| (a) 灌水转 shaping 起点 | `boundedRefillCommand` | `predicted < target×X%` 保持 flood，过了才 `platform+(target−predicted)/r` | 更早离开满灌，上升段可能变慢 |
| (b) boost 跳过阈值 | `dispatchS2Startup` | `reg.slope ≥ target×X%`（legacy `0.8×target`） | 更不容易跳过补水 |
| (c) 收回实测噪声底 | `s2RefillReturnReason` | `observed ≥ target×X%×0.6` 且 **`predicted ≥ target`** | 更容易相信较低的实测值 |

收回的**真判据仍是 predicted ≥ target**，三用里只有 (c) 参与收回判定；(a)/(b) 改变的是灌水与跳过时机。

### 定向测试（三用各自的联动都被锁定）

1. **shaping 起点**：同一预测 3.8 g/s，cutoff 70 → 指令 4.8125 ml/s（已离开满灌），cutoff 85 → 8 ml/s（仍满灌）。
2. **boost 跳过**：同一实测 3.8 g/s，cutoff 70 → 状态 `skipped`、0 笔写入；cutoff 85 → `boosting`、1 笔写入。
3. **噪声底**：同一 `observed 2.4 g/s、predicted ≈ 5.67 g/s` 夹具，cutoff 70 → 收回（floor 2.10），85 → 不收回（2.55），99 → 不收回（2.97）。

### 三档闭环（同一植物、r=1.29、目标 5 g/s、同一写预算）

| cutoff | rise 20→80% | 峰值过冲（秤流） | 末 2 s 平台偏差 | 写序列 |
|---|---|---|---|---|
| 70% | 600 ms | +33.2% | −13.9% | boost 8 → bleed 1.375 → return 3.875 |
| 85% | 600 ms | +33.2% | −13.9% | 同上 |
| 99% | 600 ms | +45.8% | −19.2% | 同上 |

**怎么读这三个数**：

- 70 与 85 完全相同，并不是「已经解耦」。原因是这台标定植物上 boost→收回之间只有约 600 ms，第一笔 trim 的 500 ms 节拍还没到，predicted 已经到 5 并触发收回；shaping 起点（3.5 vs 4.25 g/s）没有机会作用。换更慢的植物/更长的预测窗，两档才会分开。
- 99 的 +12.6 点差别来自 (c)：噪声底 0.6×4.95 = 2.97 g/s，把收回推迟了一个 tick，灌水多留了一拍。
- 因此本表证明的是 **C 的代价方向与幅度**（cutoff 越高越晚收、过冲越大），不是解耦效果。要区分 (a)/(b) 在真机上的贡献，需要对比 3.5–4.25 g/s 区间真的产生 trim 写的那类杯子。

## 文案 / 文档

- 滑块「收回噪声底（%）」→「收回 / 收口起点（%）」/ `Cutoff / taper start (%)`。
- 派生行：「派生：实测 ≥ 51% 目标（≈ 2.55 g/s）+ 预测 ≥ 目标（5.00 g/s）才收回；下调会同时提前离开满灌（可能拖慢 90° 上升）、降低补水跳过阈值、降低实测噪声底」。
- 预览行：「收回判据：预测 ≥ 5.00 g/s；85% 同时决定收口起点、跳过阈值、实测噪声底」。
- 折叠标题行：「收回 / 收口起点 85% · 实测门槛 ≈ 51% 目标 · 启动 0 s」。
- 补水节点里的「杯流 85% x.xx s」改为「断流 x.xx s」：cutoff 触发的是断流笔，标签不再暗示秤流到过 85%。
- `UI_LANGUAGE_PAIRS` 增 `Cutoff / taper start` 与带尾空格版本；manifest 的 `S2StartupAssist` 说明同步。
- 技能 §22.5 / §22.11 改为 C 口径；§22.11 的断流段判据由「predicted + 上升率×泵滞后 ≥ cutoff」改为「前导补偿后的 predicted ≥ target（预测窗 1.5 s）」。

## 测试与产物

- `tests/verify_v02221.cjs`：**698/698**（v02220 的 692 条全部保留，新增 6 条）。
- `tests/RESULTS_v02221.txt`：完整日志；三档闭环数字在测试运行时打印，可直接复核。
- `verify_v02220.cjs` / `RESULTS_v02220.txt` 原样保留。
- `node --check decenthyperexplugin.reaplugin/plugin.js` 通过。

## 风险与未做

- 三档闭环只在标定植物上跑；真机上 (a)/(b) 的权重可能更大（尤其是慢上升的杯子），C 口径的「上升段换过冲」必须在真机复核。
- 没有解耦 A/B；没有新增 `trimAtFraction`；没有改 `bleedMs`。若以后改主意，需要新的版本号与新的三档扫描。
- 未 commit / tag / push / 发版。
