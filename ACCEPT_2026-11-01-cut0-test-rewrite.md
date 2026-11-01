# cut 0 验收文档 — 测试重写与 bleeding 专项（2026-11-01）

## 0. 结论

cut 0 完成。`tests/verify_v0227.cjs` 从 **624/637（13 红）** 变为 **642/642 全绿**，13 条红全部按新口径重写或修夹具，**没有删除任何测试**，安全门测试一条未动。本次只改测试，`plugin.js` 零改动。

提交：`9823c34`（分支 `v1.79ds`，测试与 RESULTS 首版）、`c50cf37`（本文档首版）；`<=40` 绊线与本文档 §5.1 的修订随本提交入库（未打 tag、未推送）。

## 1. 范围与边界

| 项 | 状态 |
|---|---|
| `plugin.js` / `manifest.json` | 未改动（工作区里的 2.2.7 仍由另一对话持有、未提交） |
| `tests/verify_v0226.cjs` / `RESULTS_v0226.txt` | 未改动 |
| 新增测试 | 5 条（bleeding 专项） |
| 删除测试 | 0 条 |
| 修改的测试 | 13 条（4 条重写 #1 #2 #6 #7、1 条改断言 #4、8 条只修夹具 #3 #5 #8 #9 #10 #11 #12 #13） |

「删除 0 条」的口径是**相对 v0227 自己的 637 条基线**：637 + 5 条新增 = 642，原有条目一条没少。若直接拿 `tests/verify_v0226.cjs`（635 条）对比，会有 11 个测试名在 v0227 里消失：其中 8 条是改名（4 条是 cut 0 重写，见 §3；另 4 条是 2.2.7 补水重写时改的名——target/r 基准、r 折算、补水预览、版本号一致性），另外 3 条是在 **2.2.7 的补水重写**里、随 `high-flow-direct` 分支一起删除的策略测试（不是 cut 0 删的），它们断言的是 §22.11 明确判定为错的旧策略：

- `high-flow refill floods at the target value without the LUT/r translation`
- `high-flow refill ignores a lower gain-memory base and hands control back to the S2 command`
- `refill handoff writes the running S2 command even when the LUT base is lower`

设计层面的替代者是 `§22.11 the flood ceiling reaches the rise-time floor for every cup target`、`§22.11 r greater than 1 lowers the platform and never moves the flood`、`§22.11 refill handoff lands on the platform and a protective return never raises the pump` 这三条不变量测试。

## 2. 本次遵循的口径

- 补水段泵流量是**趋势矢量**，不是流量设定值；灌水量 = 安全包线 8.00 ml/s，不由 target / r / base 推导。
- 平台 = `target / r`，r 允许 > 1 且是命令的函数（平台区 ≈1.23）。
- 收口两段：cutoff 判据是「实测 ≥ cutoff×0.6（噪声底）且 predicted ≥ target」；触发后先写 `bleed = snap(max(0.10, 平台×0.35))` 断流，等 700 ms 或秤流回落到 `target×1.02` 内，再写平台。
- 因此 `cutoffPercent` 的语义是**观测噪声底**，不再是「实测到 X% 收回」。旧夹具里「稳在 4.3 g/s 就该收回」的写法在新判据下永远撞不到 cutoff。

## 3. 13 条红测试的处置

| # | 旧测试 | 处置 | 理由 |
|---|---|---|---|
| 1 | `refill returns baseline when raw cup flow reaches85 percent not100` | 重写为 `refill cutoff needs the lead-compensated cup flow to reach the target` | 断言的是已废弃的「实测 85% 收回」；新版先证稳态 4.3 g/s 窗口不收，再用 6 g/s 爬升证 `decisionGS ≥ target` 才收，并检查 `thresholdGS = target×cutoffFraction` |
| 2 | `refill refuses a wild 2s prediction while observed cup flow is still below85 percent` | 重写为 `…observed cup flow is below the cutoff noise floor` | 野预测的拒绝门槛从「实测 ≥85%」变成「实测 ≥0.6×cutoff」；2.0 g/s 时即使外推很野也必须返回 null |
| 3 | `refill return driver ACK has its own2second deadline after early cutoff` | 保留，修夹具 | 安全门：返回笔的 2 s 驱动 ACK 死线不因 cutoff 提前而豁免 |
| 4 | `refill return ACK completes the refill and never stacks another boost` | 保留，改断言 | 改为断言 boost 笔数恒为 1（原来断言总写入数=2，属镜像） |
| 5 | `after85percent cutoff cup target stays100percent while handover pacing ramps` | 保留，修夹具 | 口径不变量：交接期目标不降到 cutoff 百分比；顺手去掉 `approachFraction` 常量断言 |
| 6 | `200ms approach hands control back before the next trim write` | 重写为 `refill handover stays active for approachMs and keeps the full cup target` | 原唯一断言 `row.approachFraction === 1` 在当前代码里是常量，属镜像；改为断言 `handoverActive`、`handoverProgress ∈ (0,1)`、目标仍为 5 |
| 7 | `configured70percent cutoff returns at3.5gpersecond for5goal` | 重写为 `configured70percent cutoff lowers the noise floor but not the5gpersecond return target` | 70% 只把噪声底降到 2.1；3.6 g/s 稳态必须**不**收，预测 ≥5 才收 |
| 8 | `configured cutoff does not reduce actual cup target during handover` | 保留，修夹具 | 同上目标不变量；断言改为 `handoverActive` |
| 9 | `refill target echo hands control over after50ms rather than another1600ms blind wait` | 保留，修夹具 | 交接在返回 ACK 后 50 ms 打开，`approachAt === resumeAt` |
| 10 | `S2 handover below5gpersecond never lowers pump command merely because flow exceeds85percent` | 保留，修夹具 | 目标恒为 5，不允许因「超过 85%」而下压 |
| 11 | `falling delayed RAW estimate does not trigger an extra down-write during handover` | 保留，修夹具 | 交接期下落响应不得叠加额外下调笔 |
| 12 | `handover pacing expires so750ms upward spacing does not restrict the rest of S2` | 保留，修夹具 | 750 ms 上行间距只作用于交接窗内 |
| 13 | `genuinely sustained oversupply can still down-trim during handover with no falling trend` | 保留，修夹具 | 真实持续超供仍必须能下调 |

共用夹具改动：`refillSamples(e,flow)` 现在的语义是「窗口以 `flow` g/s 上升」；新增 `confirmRefillReturn()`，按真实路径「推进 → 刷新遥测 → 返回笔驱动 ACK 完成（resumeAt = now+50）」结束交接。原来的 `returnedRefill` 用稳态 4.3 g/s 直接等 cutoff，在新判据下不再可达。

## 4. 新增的 5 条 bleeding 测试

夹具 `boostingFixture` / `bleedFixture` 走 bounded 模型（`s2RefillBoundedModel=true` + cup-target + 学到的 r=1.29），boost 已 ACK、杯流爬升，下一笔必须断流。

| 测试 | 验什么 |
|---|---|
| `§22.11 a bleed write without a driver ACK is failed by the refill watchdog` | 断流笔无 ACK：看门狗到点 abort 并发 Idle，且不会补写平台 |
| `§22.11 a frame change during bleed ends the refill without writing the platform` | bleed 期中途换帧：状态与 startupExecution 都变 `frame-ended`，不向旧帧写 |
| `§22.11 the watchdog renews an ACKed bleed twice then fails the platform return` | 已 ACK 断流笔：1500 ms 续期两次，第三次以「平台返回缺 ACK」abort |
| `§22.11 a protective return (pressure or stale scale) still bleeds and hands back the lower platform` | 保护性理由（pressure / stale 各跑一遍）仍先断流，收回值 = `min(平台, 曲线指令)`，绝不抬泵 |
| `§22.11 a stale scale during bleed still returns on the bleed timer` | bleed 期秤失效：700 ms 计时到点照常写平台，不等新秤窗 |

## 5. 闭环植物改正与新的过冲基线

植物（`refillClosedLoop`）两处按技能台账改正：

| 项 | 旧 | 新 |
|---|---|---|
| r | 常数（学到的 r=1.29） | `r(mach)`：≤4 ml/s 取 1.23、≥4.5 取 1.0、中间线性 |
| 粉饼限流 | 常数 5.5 ml/s | 删除（泵指令原样进一阶模型） |
| 其余 | 死区 0.35 s、泵 τ 0.4 s、杯流 τ 0.2 s | 不变 |

重测（同一两段收口逻辑，只换植物）：

| 学到的 r | 平台 target/r | 上升 20→80% | 峰值过冲 | 平台偏差（末 2 s） | 补水写入 |
|---|---|---|---|---|---|
| 1.29 | 3.875 | 0.60 s | **+33.2%** | −19.3% | boost 8 → bleed 1.375 → return 3.875 |
| 1.05 | 4.750 | 0.60 s | +33.2% | −15.4% | 同上 |
| 1.60 | 3.125 | 0.60 s | +33.2% | −22.6% | 同上 |

**+33.2% 取代 +21.4% 成为 v2.2.7 的诚实基线。** +21.4% 是「r=1.29 常数 + 粉饼 5.5 限流」两处失真同时压出来的，不能当验收值。

与台账对照：上升 0.60 s 与 §22.5 的 0.7 s 下限同量级（灌水瞬间给 8，略快于泵台阶）；峰值仍无法用真机校验——≥5 ml/s 稳态 r 仍为 0 样本，**准确度不记达标**。

两条闭环测试的峰值绊线是 **`<=40%`**（不再用 `<=95`，也不能用 `<=60`——§5.1 的实验说明 +60 正好等于本植物的物理渐近线，挡不住「cutoff 从不触发」）。同时两条测试都显式断言 `refillCmds` 里必须同时出现 `bleed` 与 `return`：没有断流就没有两段收口。

### 5.1 绊线有效性实验（一次性，未入库）

做法：把 `plugin.js` 复制到临时目录，只改两处——`s2RefillReturnReason` 在秤失效检查后直接 `return null`（停用流量 cutoff），`boundedRefillCommand` 的 `estimate` 强制为 null（保持 8 ml/s 灌水）。这等价于 2.2.3 那类「cutoff 从不触发、靠 holdMs 定时收回」的回归。用同一植物、同一套 tick 跑：

| 指标 | 结果 |
|---|---|
| 峰值杯流 | 7.99976 g/s |
| 峰值过冲 | **+59.995%** |
| 状态 / 收回值 | `complete` / 3.875（等于平台） |
| 补水写入 | boost 8 → bleed 1.375 → return 3.875 |
| 上升 20→80% | 0.60 s |

结论：旧绊线 `<=60` 会**放行**这条回归（59.995 ≤ 60），而 `status`、`returnCmd`、`bleed+return`、`rise` 全部照旧成立——整条测试依然绿。新绊线 `<=40` 会以约 20 个点的差距判红。这就是把上界从 60 收到 40 的依据。

补充：第一次实验只停 cutoff、保留 trim 整形，峰值仍是 +33.2%（trim 把泵拨到 0.125–0.3125，提前刹住了）。所以这条绊线真正拦的是「固定 boost 到计时器」的整类回归，不是「漏了 bleed 断言」那一种。

## 6. 副产品发现（不在 cut 0 范围）

新植物下，断流后正常 S2 段自己在往下写：指令 3.875 → 3.0 → 2.6875，杯流从 4.9 掉到 3.5 g/s。平台偏差 −19.3% 主要来自这里，不是末 2 s 窗口拖尾。按 §22.4 属杯内预测/信封课题，归 cut 1–3；cut 0 只记录、未改控制律。

## 7. 复现

```powershell
cd D:/vscode/decenthyperexplugin/decenthyperexplugin.reaplugin
node tests/verify_v0227.cjs                 # 642/642
$env:HX_LOOP_REPORT='1'; node tests/verify_v0227.cjs   # 打印闭环指标
node tests/verify_v0226.cjs                 # 616/635，见下
```

`tests/verify_v0226.cjs` 未改动（mtime 仍为 9:30，文件里没有本次新增的符号）。它对着 2.2.7 代码跑是 616/635，属预期：它断言的是 2.2.6 及更早的口径。

## 8. 验收清单

- [x] `node tests/verify_v0227.cjs` 全绿，条数 637 → 642
- [x] 安全门测试零删除（限压 / ACK / 帧确认 / 预算 / 秤失效 / profile truth / 存储回读）
- [x] `tests/verify_v0226.cjs` 未改动
- [x] 新测试全部为口径不变量或闭环结果形式；阈值断言用 `target×cutoffFraction` 表达，不写死计划常数
- [x] 闭环植物按台账改正，峰值基线更新为 +33.2%
- [x] 两条闭环峰值绊线收到 `<=40%`，并显式断言 `bleed` 与 `return` 都发生
- [x] 一次性实验证明：停用 cutoff（固定 boost 到 holdMs）峰值 +59.995%，旧 `<=60` 放行、新 `<=40` 判红
- [x] 技能台账（§ Supporting references → 仿真植物校准台账）追加本次记录

## 9. 已知限制

1. **本提交只含测试侧。** `plugin.js` / `manifest.json` 的 2.2.7 改动仍由另一对话持有、未入库；单独检出 `9823c34` 时 plugin 仍是 2.2.5，本套测试不会全绿。要自洽需把 2.2.7 的插件改动一并入库（需该对话 / 用户授权）。
2. +33.2% 是合成植物结果，不是真机实测；≥5 ml/s 稳态标定仍缺，灌水上限与 cutoff 定数前建议先做一次高指令标定（S2 固定 5.5 / 6.5 / 7.5 ml/s 各 3 s）。
3. 平台偏差 −19% 的成因见第 6 节，需 cut 1–3 处理。
