# v2.2.24 交接 — 补水 cutoff 下限 50 → 30（2026-11-01）

状态：**已改完、未提交**（未 commit / tag / push）。基线 HEAD = `760cc21`（v2.2.23，706/706），版本 2.2.24。

## 用户口径

真机上 85 甚至 70 仍可能压不住过冲，需要 shaping 起点更早；确认调低这个阈值不会形成别的连锁，就开放下限到 30%。

## 改了哪一侧

只改**插件**（`plugin.js` / `manifest.json` / 测试 / 文档）。没碰皮肤、宿主配置、控制律。

## 改动

1. `S2_REFILL_LIMITS.cutoffPercent`：`[50,99,1]` → `[30,99,1]`（唯一的行为改动）。
2. `PLUGIN_VERSION` / `manifest.version` → 2.2.24；manifest 的 `S2StartupAssist` 说明同步成「30–99%」。
3. 测试：`tests/verify_v02224.cjs`（自 v02223 复制）。边界测试改成接受 30、拒绝 29；新增「30% 起收」测试（同一 2.0 g/s 预测下 30% 已降到 6.5625 ml/s，旧下限 50% 仍是 8，低于 1.5 g/s 仍满灌）；三档扫描扩成 30/50/70/85/99 五档。
4. 文档：README 2.2.24、本文件、`ACCEPT_2026-11-01-cutoff-floor-30.md`；技能 §22.5 / §22.11 的可调范围与英文节同步改成 30–99。

## 连锁核查（只读）

`cutoffFraction` 的全部消费点：

- `boundedRefillCommand`：shaping 起点 `predicted < target×X%`；
- `dispatchS2Startup`：boost 跳过阈值 `reg.slope ≥ target×X%`；另有 plan 与已保存设置的一致性校验（不是范围校验）；
- `s2RefillReturnReason`：噪声底 `target×X%×0.6`，收回仍要 `predicted ≥ target`；
- `stage2StartupPlan`：`plan.cutoffFraction`、`plan.flowCutoffGS`（只导出/显示）；
- UI：滑块 `min` 直接读 `S2_REFILL_LIMITS`，派生行 `0.6×X`。

没有任何分支假设 X ≥ 50，也没有除法/取整依赖这个下限；降到 30 只改这三处时序与噪声底，不产生新路径。

## 闭环数字（同一植物、r=1.29、目标 5 g/s）

| cutoff | rise 20→80% | 峰值过冲 | 末 2 s 平台偏差 | 写序列 |
|---|---|---|---|---|
| 30% | 600 ms | **+25.1%** | −14.4% | boost 8 → trim 6.5625 → bleed 1.375 → return 3.875 |
| 50% | 600 ms | +33.2% | −13.9% | boost 8 → bleed 1.375 → return 3.875 |
| 70% | 600 ms | +33.2% | −13.9% | 同上 |
| 85% | 600 ms | +33.2% | −13.9% | 同上 |
| 99% | 600 ms | +45.8% | −19.2% | 同上 |

30% 是这台植物上唯一真的发出 trim 笔的档位，过冲从 +33.2% 降到 +25.1%，上升时间不变。

## 测试

`tests/verify_v02224.cjs` = **707/707**（v02223 的 706 条 + 1 条 30% 起收），日志 `tests/RESULTS_v02224.txt`；`node --check` 通过。v02223 及其 RESULTS 原样保留。

## 待办（用户批准后）

1. commit（`v2.2.24`）+ tag + Release + 夸克。
2. 真机：同条件 85 / 70 / 50 / 30 各一杯，看 trim 笔是否出现、峰值过冲与 20–80% 上升时间；重点确认 30% 不会因为跳过阈值降到 1.5 g/s 而把该补水的杯子跳过。
