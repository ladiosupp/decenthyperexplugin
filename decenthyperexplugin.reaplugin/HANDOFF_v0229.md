# v2.2.9 交接 — 杯内步长与信封（2026-11-01）

## 0. 这一版是什么

修 cut 2 的五条：T-5 常规信封可以不包含当前指令且 hi 未夹到 8；T-6 救急上限可以比常规更窄；T-7 S3 常规最小步 2/3 档；T-8 救急 8 档起步不分段；L-8 同一个 target/r 有四个上限。只动杯内正常段，补水段没碰。

## 1. 改了什么（全在 plugin.js）

- 新增 `commandCeilingFor(phase,mode,ctx)`：正常段中心 ±20%、hi 夹 8、lo ≥0.10；救急段 lo=0.10、hi=max(min(8,LUT×2), 正常 hi)；两个分支最后都做 `lo=min(lo,command)`、`hi=max(hi,command)`。
- 删除原来的四个上限分支（正常 center*1.2 / mapped、救急 mapped*2、8 的硬门），正常/救急都改走这个函数。
- S3 常规最小步：`predictiveStepQuanta(errGS,r,1,4)`（原 S3 是 3 或 2）。
- 救急下限：`rescueMin=clamp(round(.25*|err|/r*16),2,8)`，上限仍 24。
- trace：write 行新增 `intendedQuanta` / `actualQuanta`（保留 `stepQuanta` 兼容旧读取）。
- 版本：plugin.js / manifest.json → 2.2.9。

## 2. 测试（tests/verify_v0229.cjs，649/649）

从 verify_v0228.cjs 复制，v0228 与 RESULTS_v0228 原样保留。

新增 5 条：

- `§22.4 T-5/T-6/L-8 the envelope always contains the live command and rescue never narrows it`：直接调 commandCeilingFor 验四条（含命令、hi≤8、救急≥正常、S3 越界命令可达）。
- `§22.4 T-5 every write records intended and actual quanta inside the driver range`：一次从 0.8125 出发的 S3 写入，断言 intended/actual 都记、actual>0、命令在 0.10–8.00。
- `§22.4 T-5 an out-of-band live S2 command takes one bounded step, not an envelope jump`：活动指令 0.8125、杯流 1.2 时，写入从泵的实际位置迈 ≤4 档。
- `§22.4 T-7 closed loop: S3 converges without the 2-3 quantum limit cycle`：决策级闭环（每 tick 给 1.4 s 窗口，泵一阶跟进），断言 ≤1 次方向反转、平台 ±8%。
- （既有）S2 闭环、T-1/T-2、安全门全部保留。

## 3. 闭环数字

| 指标 | 旧 2.2.8 | 新 2.2.9 |
|---|---|---|
| S3 平台偏差 | +16.1% | **−1.5%** |
| S3 方向反转 | 2 次 | **0 次** |
| S3 指令序列 | 0.625→0.75→0.625→0.8125 | 0.625→0.6875 |
| S2 平台偏差（干净植物） | −6.9% | −6.9% |

改前副本跑同一套：644/649，红的正好是 5 条新测试（外加版本号）。

## 4. 真机怎么验

1. 装 2.2.9，看 S3 段是否还在 2-3 档来回；正常小误差应只走 1 档。
2. 救急触发时（角度 ≥120° 连续 2 次、误差 >25%），第一笔不应是固定 0.5 ml/s；S3 应在 0.1–0.2 ml/s。
3. 导出 JSON 看 write 行的 `intendedQuanta` 与 `actualQuanta`：夹到信封的笔数应明显减少；不一致的笔要能对应到边界。
4. 杯流低于目标时不应再出现下调（T-5 的信封包含规则）。

## 5. 已知限制

- 干净 S2 植物上平台偏差没变（−6.9% 两边），因为这版没改 S2 正常步长；信封修复的收益由「信封外活动指令」那条单独证明。
- 导出文件仍不含 check 行与旧 `stepQuanta`，只能用实际档位分布做交叉验证（65 笔里 S3 的 2/3 档与 S2 的 40 档跳变都能看到）。
- S3 的 4+2 写入预算、后段禁写属于 cut 3，本版没动。

## 6. 发布状态

未提交、未打 tag、未推送。2.2.8 已入库（b7dd667），本版叠在它上面；发版按 §15/§20 等用户点头。

