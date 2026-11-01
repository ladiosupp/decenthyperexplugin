# 验收 · v2.2.24 — 补水 cutoff 下限 50% → 30%

日期：2026-11-01。基线：HEAD `760cc21`（v2.2.23，706/706）。目标版本 2.2.24。
起因：用户实测判断 85% 甚至 70% 仍可能压不住过冲，需要 shaping 起点更早；要求先确认调低不会形成别的连锁，再开放下限。

## 1. 连锁核查（改前只读）

`cutoffPercent` 在插件里的全部消费点：

| 位置 | 用途 | 是否依赖下限 ≥50 |
|---|---|---|
| `boundedRefillCommand` | shaping 起点：`predicted < target×X%` 保持满灌 | 否；X 越小起点越低，是本次要的效果 |
| `dispatchS2Startup` | boost 跳过阈值：`reg.slope ≥ target×X%` | 否；同样只是变早 |
| `s2RefillReturnReason` | 噪声底：`target×X%×0.6`，收回仍要求 `predicted ≥ target` | 否；X 越小底越低 |
| `stage2StartupPlan` | `plan.cutoffFraction`、`plan.flowCutoffGS` | 否；只导出/显示 |
| `dispatchS2Startup` 计划校验 | `plan.cutoffFraction === settings.cutoffPercent/100` | 否；一致性校验，与范围无关 |
| UI 滑块 / 派生行 | `min` 读 `S2_REFILL_LIMITS`，派生 `0.6×X` | 否；随常量自动变 |

没有除法、取整、数组索引或分支假设 X ≥ 50；把下限放到 30 只会让上述三处时序更早、噪声底更低，不产生新路径，也不会影响 S1/S3、增益记忆、桶几何、`bleedMs` 或安全门。

## 2. 改动

- `S2_REFILL_LIMITS.cutoffPercent`：`[50,99,1]` → `[30,99,1]`（唯一的行为改动）。
- `PLUGIN_VERSION` / `manifest.version` → 2.2.24；manifest 的 `S2StartupAssist` 说明同步为 30–99%。
- 技能 §22.5 / §22.11：可调范围 30–99，并注明下限放到 30 的原因。
- 测试：`tests/verify_v02224.cjs`（自 `verify_v02223.cjs` 复制）；新增「30% 起收」，原边界测试改为 30/29。

## 3. 闭环数字（同一植物、r=1.29、目标 5 g/s）

| cutoff | rise 20→80% | 峰值过冲（秤流） | 末 2 s 平台偏差 | 写序列 |
|---|---|---|---|---|
| 30% | 600 ms | **+25.1%** | −14.4% | boost 8 → trim 6.5625 → bleed 1.375 → return 3.875 |
| 50% | 600 ms | +33.2% | −13.9% | boost 8 → bleed 1.375 → return 3.875 |
| 70% | 600 ms | +33.2% | −13.9% | 同上 |
| 85% | 600 ms | +33.2% | −13.9% | 同上 |
| 99% | 600 ms | +45.8% | −19.2% | 同上 |

读法：30% 是这台植物上唯一真的发出 trim 笔的档位（predicted 过 1.5 g/s 时仍在 500 ms 节拍内），过冲从 +33.2% 降到 **+25.1%**，20–80% 上升时间仍是 600 ms。50–85 之间没有 trim 笔，所以三档数字相同——这不是「解耦」，是这台植物的节奏。

## 4. 副作用（同一旋钮，不是新连锁）

30% 同时把 boost 跳过阈值降到 1.5 g/s：onset 很快、补水派发时 S2 已出液 ≥1.5 g/s 的杯子会更常跳过补水。这正是 C 口径的第 2 用，真机上要留意这种杯子会不会因此少灌。

## 5. 测试与产物

- `tests/verify_v02224.cjs`：**707/707**（v02223 的 706 条全部保留 + 1 条 30% 起收）。
- `tests/RESULTS_v02224.txt`：完整日志，五档闭环数字在运行时打印。
- `verify_v02223.cjs` / `RESULTS_v02223.txt` 原样保留；`node --check` 通过。
- `tests/verify_v02221.cjs` 恢复到已提交版本（我先前误改的工作区副本已还原）。

## 6. 未做

- 控制律、`bleedMs`、杯内 `liveTrimTick`、增益记忆、S3 形状、桶几何均未动。
- 未 commit / tag / push / 发版。
