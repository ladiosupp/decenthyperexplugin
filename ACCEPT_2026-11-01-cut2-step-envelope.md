# cut 2 验收文档 — 杯内步长与信封（2026-11-01）

## 0. 结论

cut 2 完成。T-5 / T-6 / T-7 / T-8 / L-8 五条已改，`tests/verify_v0229.cjs` **649/649** 全绿；同一套测试跑改动前的 2.2.8 plugin 副本是 **644/649**，红的正好是 5 条新测试（另加版本号一条）。安全门测试一条没删、没弱化；补水段符号一个没碰。版本 2.2.9 已写进 plugin.js / manifest.json，未打 tag、未推送。

## 1. 范围与边界

| 项 | 状态 |
|---|---|
| 改动文件 | `plugin.js`（信封/步长/救急下限/trace）、`manifest.json`、`README.md`、新增 `HANDOFF_v0229.md`、`tests/verify_v0229.cjs`、`RESULTS_v0229.txt` |
| `tests/verify_v0228.cjs` / `RESULTS_v0228.txt` | 未改动 |
| `tests/verify_v0227.cjs` / `v0226` | 未改动 |
| 补水段（boundedRefillControlBase / boundedRefillCommand / stage2StartupPlan 的 bounded 分支 / s2RefillReturnReason / dispatchS2Startup 的 boost|bleed|trim|return / liveTrimTick 的 startup 分支） | 未碰 |
| 工作区里别的对话的未提交文档 | 未碰 |

## 2. 口径

- 杯内控制器只有一个可达范围入口；信封的作用是「不越界」，不是「不许动」。
- 门槛第一是安全，第二是数据有效，不能变成墙（§22.8）。
- S3 的 1 档 ≈0.06–0.13 g/s；常规动作集 0/±1/±2/±4，救急才允许大档。
- 高流量区固件自准、低流量区才折算 r（本版不涉及补水与学习）。

## 3. 改动逐条

### T-5 / L-8 统一信封

新增 `commandCeilingFor(phase,mode,ctx)`，取代原来分散的四个上限：

- 正常：`lo=min(center*0.8, mapped)`、`hi=max(center*1.2, mapped)`；
- 救急：`lo=commandFlowMin`、`hi=max(min(8, mapped*2), 正常 hi)`；
- 两个分支最后都做 `lo=min(lo,command)`、`hi=max(hi,command)`，再夹到 [0.10, 8.00] 并落到 1/16 网格（lo 向上、hi 向下）。

效果：center 7.236 时正常 hi 从 8.625 → 8.000；活动指令 0.8125、信封 [0.5,0.625] 这类状态现在可出发。

### T-6 救急不缩小可达范围

救急 hi = `max(min(8, LUT×2), 正常 hi)`。原来救急只按 `mapped×2`，center 高时（7.236）救急 hi=5.0 < 正常 hi=8.625，一进救急反而够不到。

### T-7 S3 常规最小步

`normalMin` 由「S3: 误差≥8% 取 3，否则 2」改成 1，与 §22.4 动作集一致。S3 的 1 档 0.0625 ml/s ≈0.13 g/s，3 档 ≈0.4 g/s，而 4% 死区只有 0.06 g/s——旧值必然来回。

### T-8 救急下限按误差折算

`rescueMin=clamp(round(0.25*|err|/r*16), 2, 8)`，上限 24 不变。S3 救急首笔从固定 8 档（0.5 ml/s = 目标的 54%）降到 0.125–0.2 ml/s。

### trace

write 行新增 `intendedQuanta`（决策意图）与 `actualQuanta`（夹信封后的实际移动）；保留 `stepQuanta` 兼容旧读取。

## 4. 测试（649/649）

新增 5 条，全部是口径不变量或闭环结果：

1. `§22.4 T-5/T-6/L-8 the envelope always contains the live command and rescue never narrows it`——直接调 `commandCeilingFor`：center 7.236/mapped 5/command 7 时 hi=8 且包含 7；救急 hi≥正常 hi；S3 command .8125 仍可达。
2. `§22.4 T-5 every write records intended and actual quanta inside the driver range`——从 .8125 出发写一笔，断言 intended/actual 都记、actual>0、命令在 [0.1,8]。
3. `§22.4 T-5 an out-of-band live S2 command takes one bounded step, not an envelope jump`——活动指令 .8125、杯流 1.2，写入 ≤4 档且从泵的实际位置出发。
4. `§22.4 T-7 closed loop: S3 converges without the 2-3 quantum limit cycle`——决策级闭环，22 个 250 ms tick，泵一阶跟进、r=2.15；断言 ≤1 次方向反转、平台 ±8%。
5. （既有）S2 闭环、T-1/T-2、安全门全部保留并通过。

改前副本：644/649，红的就是上面 1–4 与版本号。

## 5. 闭环数字

| 指标 | 旧 2.2.8 | 新 2.2.9 |
|---|---|---|
| S3 平台偏差 | +16.1% | **−1.5%** |
| S3 方向反转 | 2 次 | **0 次** |
| S3 指令序列 | 0.625→0.75→0.625→0.8125 | 0.625→0.6875 |
| S3 写入笔数 | 4 | 2 |
| S2 平台偏差（干净植物） | −6.9% | −6.9% |
| S2 信封外指令首笔 | 跳变（旧 hi/lo 夹） | ≤4 档单步 |

**如实说明**：验收文字要求「S2 平台偏差改善」，但干净 S2 植物上前后都是 −6.9%——本版没有改 S2 的正常步长（原本就是 1 档），S2 的收益体现在「信封外的活动指令能按单步出发」这一条，而不是平台偏差。没有为了凑指标去改 S2 步长。

## 6. 真机交叉验证

导出 `hyperex-history (4).json` 的 check 行与 `stepQuanta` 已被 compact 记录剥掉，无法复算 730 点/65 笔的原始判据；能核的是 2.2.x 的 65 笔非补水写入实际档位分布：

| frame | 1/16 档位分布 |
|---|---|
| frame 1（S2） | 4 档 19 笔、11 档 1、16 档 2、17 档 1、19 档 2、20 档 2、24 档 3、40 档 2、10 档 1、2 档 3 |
| frame 2（S3） | 1 档 4 笔、2 档 6、3 档 4、4 档 2、6 档 1、8 档 9 |
| frame 3（S3 第三帧） | 1 档 1、3 档 1、8 档 1 |

S3 的 2–3 档共 10 笔、8 档 9 笔，与审查里「S3 小步 2/3 档、救急 8 档」的现场一致；S2 的 40 档（2.5 ml/s）跳变 2 笔，正是信封/夹取问题的形状。植物准确度沿用 cut 1 的结论（≥5 ml/s 稳态 r 仍无样本，不记达标），本次没有新增可信的峰值校准。

## 7. 复现

```powershell
cd D:/vscode/decenthyperexplugin/decenthyperexplugin.reaplugin
node tests/verify_v0229.cjs                 # 649/649
$env:HX_LOOP_REPORT='1'; node tests/verify_v0229.cjs   # 打印 s3 loop / inner loop
node tests/verify_v0229.cjs <2.2.8 的 plugin.js>        # 644/649，五条红
```

## 8. 验收清单

- [x] `commandCeilingFor` 统一四个上限；正常 hi 夹 8；救急 ≥ 正常
- [x] 信封包含当前生效指令（两个分支都做）
- [x] S3 常规最小步 1 档
- [x] 救急下限按误差折算（2–8）
- [x] trace 记 intendedQuanta / actualQuanta
- [x] 649/649；安全门零删除；v0228 / v0227 / v0226 未动
- [x] 版本 2.2.9、README 小节、HANDOFF_v0229、RESULTS_v0229
- [ ] 真机复测（装 2.2.9 后看 S3 指令序列与救急首笔）

## 9. 已知限制

1. S2 平台偏差在干净植物上没有改善（见 §5），本版对 S2 的收益是信封外单步。
2. 真机导出缺少 check 行与 `stepQuanta`，交叉验证只能到「实际档位分布」这一层。
3. S3 的 4+2 写入预算、后段 45% 禁写属 cut 3；救急静默的 F3 也属 cut 3。
4. 2.2.8 已入库，本版叠在它上面；发版前仍需按顺序提交。

