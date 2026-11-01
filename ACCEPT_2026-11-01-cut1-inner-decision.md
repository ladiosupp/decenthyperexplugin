# cut 1 验收文档 — 杯内决策三个硬 bug（2026-11-01）

## 0. 结论

cut 1 完成。T-1 / T-2 / T-3 三条已改，`tests/verify_v0228.cjs` **645/645** 全绿；同一套测试跑改动前的 plugin 副本是 **641/645**，红的正好是 1.5 s 窗、T-1、T-2、杯内闭环四条。安全门测试一条没动，补水段符号一个没碰。版本 2.2.8 已写进 plugin.js / manifest.json，未打 tag、未推送。

## 1. 范围与边界

| 项 | 状态 |
|---|---|
| 改动文件 | `plugin.js`（4 处）、`manifest.json`、`README.md`、新增 `HANDOFF_v0228.md`、新增 `tests/verify_v0228.cjs` 与 `RESULTS_v0228.txt` |
| `tests/verify_v0227.cjs` / `RESULTS_v0227.txt` | 未改动 |
| `tests/verify_v0226.cjs` | 未改动 |
| 补水段（boundedRefillControlBase / boundedRefillCommand / stage2StartupPlan 的 bounded 分支 / s2RefillReturnReason / dispatchS2Startup 的 boost|bleed|trim|return / liveTrimTick 的 startup 分支） | 未碰 |
| 工作区里 2.2.7 的未提交改动 | 保持原样，未回滚 |

## 2. 口径

- 杯内是控制器、杯间是估计器；预测只用于「避免过冲/欠冲」，不是设定值。
- 高流量区（≥4 ml/s）固件自己准，r≈1；低流量区才用 LUT/r。闭环植物按这条分段。
- 门槛第一是安全，第二是数据有效，不能变成墙。本次没有新增门槛，只修决策输入。

## 3. 改动逐条

### T-1 缺失预测不再变成 0 g/s

旧代码：`decisionGS=predictive&&Number.isFinite(Number(reg.predicted))?Number(reg.predicted):reg.slope`。`reg.predicted===null` 时 `Number(null)=0` 且 `isFinite(0)` 为真 → `decisionGS=0`。

现在：`reg.predicted!==null && reg.predicted!==undefined && Number.isFinite(Number(reg.predicted))`，否则退回 `reg.slope`；`cannotReturn` 里同样的空值先算成 `predictedSafe`，缺失时不参与「剩余时间内回不到带内」判定。

真机证据（审查文档 T-1）：730 个决策点里 49 个（6.7%）predictedGS===0 而 rawGS>0.2；tMs 30578 那笔 rawGS 3.43、目标 1.5，decisionGS=0 让控制器打算加码。

### T-2 预测双向 + 幅度上限（选 0.6×target）

旧式：`Math.max(0, fastSlope + Math.max(0, fastSlope-early.slope) × horizon)`。只外推上升，且加速度项无上限。

现在：加速度项允许负值，并夹在 `±0.6×target`：`predicted = max(0, fastSlope + clamp((fastSlope-early.slope)×horizon, ±0.6×target))`。

**为什么选 0.6×target 而不是 predicted ≤ target×1.5**：前者约束的是「预测相对当前快斜率的位移」，上升和下落共用同一个上限，正好补上「只防过冲、不防欠冲」的另一半；后者只封顶绝对值，对下落方向没有约束，也仍然允许一个远离当前趋势的预测。S2 目标 5 → 上限 3.0 g/s，真机 2.532→7.349 那笔会被压到 5.532。

### T-3 前瞻窗统一 1.5 s

`liveTrimRegression` 的 `horizon`：S2 predictive 2 → 1.5（与补水一致）；S3 仍 1.2，legacy 仍 .5 / 2。技能 §22.4 早已写 1.5 s，§22.9 的 v2.2.0 条目写 2 s，已在该条补注「v2.2.8 起统一 1.5 s」。

## 4. 测试

新增三条、改一条：

- `§22.4 T-1 …never 0 g/s`：整体线性合格、尾窗不合格的采样（`[0,.5,1,1.5,2,2.4,2.3,2.5]`）→ `fastSlope=null`、`predicted=null`；tick 后 `row.predictedGS===row.rawGS`（1.857），`predictedErrorPct` 62.9 而不是 100。
- `§22.4 T-2 …capped at 0.6x target`：加速窗（`[0,.15,.35,.7,1.2,1.9,2.8,3.8]`）断言预测仍向上且位移 ≤3.0；减速窗（`[0,1.2,2.2,3.0,3.6,4.0,4.2,4.3]`）断言 `predicted<fastSlope`。
- `§22.4 T-2 closed loop: the S2 platform settles…`：杯内 S2 植物（泵 0.35 s 死区、τ 0.4 s；杯流 τ 0.2 s；`r(cmd)` 分段 1.23/1.0；无粉饼限流），50 ms 步进、250 ms tick，起步 2.4 ml/s、杯流 0.6 g/s，跑 9 s。断言 `|平台偏差|≤7.5%`、杯流低于目标时下调 0 笔、植物确实到过 4.5 g/s 以上。
- 原 `S2 2s and S3 1.2s` 改成 `S2 1.5s and S3 1.2s`。

安全门测试（限压 / ACK / 帧确认 / 预算 / 秤失效 / profile truth / 存储回读）一条没改。

## 5. 闭环数字（同一植物，只换预测器）

| 指标 | 旧（2.2.7 副本） | 新（2.2.8） |
|---|---|---|
| S2 平台偏差（末 2 s） | −8.2% | **−6.9%** |
| 杯流低于目标时的下调笔数 | 0 | 0 |
| 写入笔数 | 6 | 6 |
| 峰值/上升 | 未单独统计 | 未单独统计 |

同一套 645 条：旧 641/645（红 1.5 s 窗、T-1、T-2、闭环），新 645/645。

## 6. 真机交叉验证（含限制，如实说明）

- 现有 `hyperex-history (4).json`（30 杯）里 `liveFlowTrim.trace` 只剩 write / armed / stopped 等行，**check 行被 compact 记录剥掉**（cut 0 的压缩测试正是断言这一点）。因此审查文档里的 49/730 与 9 笔 S2 下调无法从这份导出重新数出来。
- `hyperex-history (2).json` 有 191 条 check 行，但都是预测模型之前的版本，没有 predictedGS===0 的样本。
- 结论：本轮**未能**用本地 JSON 复算 T-1/T-2 的真机命中率；这两条的证据仍以审查文档记录的 730 点分析为准。下一次真机导出如果带完整 check 行，应按本节的 1.5 s / 0.6×target 口径重新统计。植物准确度本次不记为达标，理由同 cut 0（≥5 ml/s 稳态 r 仍为 0 样本）。

## 7. 复现

```powershell
cd D:/vscode/decenthyperexplugin/decenthyperexplugin.reaplugin
node tests/verify_v0228.cjs                 # 645/645
$env:HX_LOOP_REPORT='1'; node tests/verify_v0228.cjs   # 打印 inner loop 指标
node tests/verify_v0228.cjs <改动前的 plugin.js>        # 641/645，四条红
```

## 8. 验收清单

- [x] T-1 两处（decisionGS / cannotReturn）都有显式 null 守卫
- [x] T-2 双向外推 + 0.6×target 幅度上限，并说明取舍
- [x] T-3 S2 正常段 1.5 s，技能 §22.4 / §22.9 同步
- [x] 新增闭环测试（杯内 S2 植物、r 按命令分段、无粉饼限流）
- [x] 新增 T-1 / T-2 不变量测试；无镜像断言
- [x] 645/645；安全门零删除；v0227 / v0226 未动
- [x] 版本 2.2.8、README 小节、HANDOFF_v0228、RESULTS_v0228
- [ ] 真机复测（等装 2.2.8 后导出带 check 行的 JSON）

## 9. 已知限制

1. 平台偏差的绝对值仍不可信：植物只有泵/杯流一阶动力学，没有压力与粉饼变化；−6.9% 只用于同植物前后对照。
2. 断流后 S2 自己往下写（平台偏差的主要来源）属 cut 2/3，本版未动。
3. 2.2.7 仍未提交，本版叠在未提交的工作区上；单独检出 2.2.8 依赖前一版的提交顺序。

