# v2.2.8 交接 — 杯内决策三个硬 bug（2026-11-01）

## 0. 这一版是什么

修 cut 1 的三条：T-1 `predicted===null` 被 `Number(null)=0` 当成 0 g/s；T-2 预测只外推上升且无幅度上限；T-3 正常段 S2 前瞻 2 s 与补水 1.5 s 不一致。只动杯内正常段，补水段的符号一个没碰。

## 1. 改了什么（全在 plugin.js）

- `liveTrimRegression`：S2 predictive horizon 2 → 1.5（S3 仍 1.2、legacy 仍 .5/2）。
- `liveTrimRegression`：predicted 改成双向外推，加速度项夹在 `±0.6×target`（S2 为 ±3.0 g/s）。旧式只取 `max(0, fastSlope-early.slope)`。
- `liveTrimTick` decisionGS：加 `predicted!==null && !==undefined && Number.isFinite` 守卫，缺失时退回 `reg.slope`。
- `liveTrimTick` cannotReturn：同样先算 `predictedSafe`，缺失时不参与「回不到带内」判定。
- 版本：plugin.js / manifest.json → 2.2.8。

## 2. 测试（tests/verify_v0228.cjs，645/645）

从 verify_v0227.cjs 复制，v0227 与 RESULTS_v0227 原样保留。

新增：

- `§22.4 T-1 a missing tail fit falls back to the regression slope, never 0 g/s`：构造「整体线性合格、尾窗不合格」的采样，断言 `reg.fastSlope===null`、`reg.predicted===null`，tick 后 `row.predictedGS===row.rawGS`。
- `§22.4 T-2 the forecast extrapolates both directions and is capped at 0.6x target`：加速窗断言 `|predicted-fastSlope|≤0.6×target`；减速窗断言 `predicted<fastSlope`。
- `§22.4 T-2 closed loop: the S2 platform settles without down-writes while the cup is low`：杯内 S2 闭环植物（泵 0.35 s 死区 + τ 0.4 s，杯流 τ 0.2 s，`r(cmd)`：≤4→1.23、≥4.5→1.0，无粉饼限流），50 ms 步进、250 ms tick。断言平台 `|偏差|≤7.5%`、杯流低于目标时无下调笔、植物确实进到 4.5 g/s 以上。
- 1.5 s 窗：原「S2 2s and S3 1.2s」测试改成 S2 1.5 s。

## 3. 闭环数字（合成植物，同一参数，只换预测器）

| 指标 | 旧（2.2.7） | 新（2.2.8） |
|---|---|---|
| S2 平台偏差（末 2 s） | −8.2% | **−6.9%** |
| 杯流低于目标时的下调笔数 | 0 | 0 |
| 写入笔数 | 6 | 6 |

改前副本对同一套测试是 641/645：红的正好是 1.5 s 窗、T-1、T-2、闭环这四条。

## 4. 真机怎么验

1. 装 2.2.8，萃一杯 S2/S3，导出 history JSON。
2. trace 里不应再出现 `predictedGS===0` 而 `rawGS>0.2` 的行；也不应出现 `errorPct` 与 `predictedErrorPct` 一个 −49% 一个 100% 的矛盾。
3. `predictedGS` 与 `rawGS` 的差不应超过 `0.6×target`（S2 为 3.0 g/s）；`horizonS` 正常段应为 1.5。
4. 看 S2 平台偏差是否从 −21…−29% 收窄——这是本版的主要收益指标。

## 5. 已知限制

- 现有导出文件的 check 行被历史压缩剥掉（compact 只留 checkReasons），所以审查里的 49/730 没法从本地 JSON 重新数；本轮交叉验证受此限制，未重新统计。
- 闭环植物只做方向与回归，绝对水平仍以真机为准。平台偏差 −19% 量级的成因（断流后的 S2 自己往下写）属 cut 2/3。
- 2.2.7 仍未提交、仍由另一对话持有；本版叠在它上面，tag 序列会是 v2.2.5 → v2.2.7 → v2.2.8。

## 6. 发布状态

未提交、未打 tag、未推送。按 §15 走发版，按 §20 全部等用户点头。

