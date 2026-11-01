# v2.2.21 交接 — 补水段 P2-4 / P3-6 / P2-5（C 口径，2026-11-01）

状态：**已改完、未提交**（未 commit / tag / push / 发版，等用户批准）。基线 HEAD = `9343187`（v2.2.20，692/692），版本号 2.2.21。

## 用户口径

- P2-4、P3-6 直接改并加测试。
- P2-5 **选 C**：保留 `cutoffPercent` 一值三用，不改 `boundedRefillCommand` / `dispatchS2Startup` 的控制律，只把联动讲清楚；不新增 `trimAtFraction`，不动 `bleedMs`。
- 不要碰：杯内 `liveTrimTick`、增益记忆、S3 形状、桶几何、2.2.19/2.2.20 的代码。

## 改了什么

1. **P2-4 收回笔 trace**：`dispatchS2Startup` 的 `liveTrimRecord("write", ...)` 统一用 `previousCommand`（实际在跑的前一笔）；return 笔另加 `plannedMlS`（= `boundedRefillCommand` 在 return 时刻算出的值），不再覆盖 `previousMlS`。bleed→return 现在读作 1.375→3.875，与真机一致。
2. **P3-6 显示语义**：`stage2StartupPlan` 增加 `plan.floodAtSafetyEnvelope = bounded && boost>=commandFlowMax`；`plan.commandLimited` 在 bounded 下为 `false`（legacy 分支保持 `requested>ceiling`）。曲线编辑器安全行在 bounded 追加「灌水在安全包线（设计值）」。安全门、ACK、限压、预算一律未动。
3. **P2-5 C 口径（控制律零改动）**：cutoff 仍同时是 shaping 起点、boost 跳过阈值、收回噪声底；收回真判据仍是 `predicted ≥ target`。
4. **文案**：滑块「收回 / 收口起点（%）」/ `Cutoff / taper start (%)`；派生行与预览行写明三用与下调代价；`UI_LANGUAGE_PAIRS` 两条、manifest 的 `S2StartupAssist` 说明同步。
5. **技能**：`C:/Users/ladios/.codex/skills/decentplugin/SKILL.md` §22.5 / §22.11 改为 C 口径。

## 测试

`tests/verify_v02221.cjs` = **698/698**（v02220 的 692 条全部保留 + 6 条新增），日志 `tests/RESULTS_v02221.txt`。`node --check plugin.js` 通过。v02220 测试与 RESULTS 原样保留。

三档闭环（同一植物、r=1.29、目标 5 g/s）：

| cutoff | rise 20→80% | 峰值过冲 | 末 2 s 平台偏差 |
|---|---|---|---|
| 70% | 600 ms | +33.2% | −13.9% |
| 85% | 600 ms | +33.2% | −13.9% |
| 99% | 600 ms | +45.8% | −19.2% |

三档写序列相同（boost 8 → bleed 1.375 → return 3.875）。70 与 85 在这台植物上看不出差别：shaping 起点 3.5 / 4.25 g/s 都没等到第一笔 trim（500 ms 节拍内 predicted 已到 5、先触发收回）；99 的差别来自实测噪声底 2.97 g/s 把收回推迟一 tick。shaping 起点与跳过阈值这两个联动由定向测试锁定（3.8 g/s predicted 时 70% 已离开满灌、85% 仍在满灌；3.8 g/s 实测时 70% 跳过 boost、85% 不跳过）。

## 没动

- 没有解耦 `boundedRefillCommand` / `dispatchS2Startup`（A/B 方案）；没有新旋钮。
- 没有改 `bleedMs`、杯内 `liveTrimTick`、增益记忆、S3 形状、桶几何，也没有改 2.2.18/2.2.19/2.2.20 的提交内容。
- 未改皮肤 / 宿主配置。

## 待办（用户批准后）

1. commit（`v2.2.21`）+ tag + GitHub Release + 夸克上传。
2. 真机：同条件两杯，一杯 cutoff 85、一杯 70，看导出 trace 的 `previousMlS`、`plannedMlS`、`cutoff` 记录与峰值过冲；验证 C 口径下「下调 cutoff = 更早离开满灌」在真机是否同样可见。
3. 仍待：≥5 ml/s 稳态 r 标定、HOLD 真机、F3 实测 ACK 分布。
