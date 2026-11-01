# v2.2.26 交接 — bounded 补水灌水上限（固定 / 自适应，2026-11-01）

状态：**已改完、未提交**。基线 HEAD = `71b0515`（v2.2.25，706/706），版本 2.2.26。

## 用户口径

- bounded 模式下第一笔补水从固定 8.00 改成「固定 / 自适应」两挡，只有 bounded 可选。
- 固定挡加滑杆：上限 8.00，下限是曲线 S2 目标（例：5.00），默认 **7.00**。
- 自适应挡：算法自选，主要消除过冲；S2 onset 越接近目标越好。
- 自适应挡接管「什么时候离开满灌」，cutoff 只剩噪声底 + boost 跳过阈值；断流笔保留。
- UI 先示意图确认（已确认：默认 7、自适应显示计划上限）。

## 改了什么

1. **设置**：`S2_REFILL_DEFAULTS` 增 `floodMaxMlS:7`；新增 `S2_REFILL_FLOOD_MODES=["fixed","adaptive"]` 与 `S2_REFILL_LIMITS.floodMaxMlS=[1/16,8,1/16]`；`validatedS2RefillSettings` 校验 `floodMode`。
2. **下限跟随目标**：`refillFloodFloor()` 把曲线 S2 目标向上取到 1/16；`currentS2RefillSettings()` 把低于它的存值夹上来。
3. **计划**：`stage2StartupPlan` 输出 `floodMode`、`floodMaxMlS`（自适应为 null）、`floodPlanMlS`；固定挡 flood = 存值，自适应挡 flood = `0.9 × 2 × 平台`（约 6.98 @ r=1.29、4.50 @ r=2.00）。
4. **控制律**：`boundedRefillCommand` 自适应挡把上限本身当刹车律 `u = 平台 + (目标 − 预测)/r`，夹 `[平台, 8]`，只降不升；固定挡保持原逻辑（cutoff 管 shaping 起点）。
5. **UI**：S2 补水折叠新增「灌水上限」选卡（`.refillSeg` 同款）+ 整行滑杆；自适应挡隐藏滑杆、显示计划上限；非 bounded 置灰；标题行加「灌水上限 7.00 / 自适应」；补 `Flood cap / Fixed / Adaptive` 三条译文。
6. **manifest**：版本 2.2.26，S2StartupAssist 说明补灌水上限。

## 闭环数字（同一植物、目标 5 g/s、cutoff 85%）

| 学到的 r | 固定 7 | 固定 8 | 自适应 |
|---|---|---|---|
| 1.29 | 600 ms · +17.9% | 600 ms · +33.2% | 600 ms · **+15.4%** |
| 2.00 | 600 ms · +17.9% | 600 ms · +33.2% | 700 ms · **−5.3%** |

自适应在 r=1.29 比固定 7 少 2.5 点，在 r=2.00 把过冲压到零。代价是高 r 时上升慢 100 ms。

## 测试

`tests/verify_v02226.cjs` = **713/713**（v02225 的 706 条全部保留，新增 7 条），`node --check` 通过。v02225 原样保留。

## 没动

- 固定挡的 cutoff 三用（C 口径）不变；没有解耦 A/B，没有 trimAtFraction。
- `bleedMs`、杯内 `liveTrimTick`、增益记忆、S3 形状、桶几何均未动。
- 未 commit / tag / push。

## 待办

1. 用户确认后 commit + tag + Release + 夸克。
2. 真机：同条件固定 7 / 固定 8 / 自适应各一杯，看第一笔、trim 笔与峰值过冲；重点确认自适应在高 r 纸上的上升时间是否可接受。
