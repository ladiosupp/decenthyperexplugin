# cut 3 验收文档 — 杯内门槛与死参数（2026-11-01）

## 0. 结论

cut 3 完成（**T-11 除外，见 §1**）。T-4 / T-9(F4) / T-10(F3) / T-12 / T-13 已落地，`tests/verify_v02210.cjs` **651/651**；同一套跑 2.2.9 副本是 **646/651**，红的正好是 4 条新测试与版本号。补零段符号一个没碰。版本 2.2.10，未打 tag、未推送。

## 1. 范围与边界

| 项 | 状态 |
|---|---|
| 改动文件 | `plugin.js`、`manifest.json`、`README.md`、新增 `HANDOFF_v02210.md`、`tests/verify_v02210.cjs`、`RESULTS_v02210.txt` |
| v0229 / v0228 / v0227 / v0226 | 未改动 |
| 补水段（boundedRefillControlBase / boundedRefillCommand / stage2StartupPlan 的 bounded 分支 / s2RefillReturnReason / dispatchS2Startup 的 boost|bleed|trim|return / liveTrimTick 的 startup 分支） | 未碰 |
| **T-11 handover 三处** | **未做**：`approachWriteIntervalMs`、`approachMs` 默认值、`approachFraction` 都在 `stage2StartupPlan` / `S2_REFILL_DEFAULTS`（补水段横幅所有），按边界停下等你决定归属 |

## 2. 口径

- §22.8：安全门保留硬（全局 maxWrites、限压、ACK、帧确认、预算）；数据质量门改权重；一致性门放宽。
- F4（用户 2026-11-01）：S3 的 4+2 是行为预算，不是安全门；常规改累计档数 24；大角度连续 ≥120° 放开；后段禁写删除。
- F3（用户 2026-11-01）：救急静默 = max(800 ms, 上一笔实测响应延迟)，无实测落 800。
- T-4：角度是度，流量是百分比，两者不能互相冒充。

## 3. 改动逐条

### T-4 角度死区

`ANGLE_DEADBAND_DEG=2`；`computeAngleStats` 的 `band` 改用它（原来 `report.deadbandPct||2`，即 4°）。0° 占比按 `angle<=2°` 统计，涨落判定仍用 2% 流量带，与循环内一致。

### T-9 / F4 S3 预算

- 新增 `t.phaseQuanta`（每段 normal/rescue 累计实际写入档数，1/16 ml/s 为一档）。
- S3 常规预算 24 档；救急预算 24 档；`rescueAngleStreak>=3` 时常规预算临时放开（救急预算仍按 24 档）。
- 删除 `progress>=.55 → S3 late-phase coast`。
- 全局 `t.report.maxWrites` 检查仍在写入前，未改。

### T-10 救急判据

`cannotReturn` 由 `timeToReturnS>remainingS` 决定：

```
perQuantumGS = r/16
stepsNeeded  = |target − decisionGS| / perQuantumGS
writePeriodS = clamp(lastResponseMs/1000, 0.8, 3)
timeToReturnS = 1.2 + stepsNeeded × writePeriodS
```

trace 记 `stepsNeeded` / `timeToReturnS` / `remainingS`。时间够就不救急。

### F3 救急静默

驱动 ACK 时记 `t.lastResponseMs`；救急静默 = `max(800, min(3000, measured))`，无实测 800；trace 的 `silenceBasis` 记 `measured` / `floor-800` / `normal-1200`。

### T-12 大角度加码

`normalMax = bigAngleStreak>=6 ? 8 : bigAngleStreak>=3 ? 6 : 4`，predictive 模式生效。

### T-13 小项

0° 定义统一（2° + 2% 带）；救急静默有实测依据。`minWriteIntervalMs` 的误导性报告值未改（未在本次范围）。

## 4. 测试（651/651）

新增 4 条，全部口径不变量或决策级结果：

1. `T-4 the angle deadband is 2 degrees and does not follow deadbandPct`：deadbandPct=12 时，3° 趋势的 zeroDegreeShare=0，1.5° 为 1。
2. `T-10 rescue needs the remaining time to be genuinely insufficient`：剩 20 s 不救急；剩 4 g（约 2 s）救急且 `timeToReturnS>remainingS`。
3. `T-9 S3 spends a cumulative quantum budget and a big-angle streak releases it`：24 档预算挡住（reason=S3 normal quantum budget）→ 连续 3 个 173° 检测点 → `bigAngleRelease=true`、写出（intended 6 / actual 4，落点受信封下限约束）。
4. `T-13 the rescue silence follows the measured driver ACK latency (F3)`：1235 ms → 1235 measured；300 ms → 800 floor。

v0229 中「4 笔后 coast」「救急 8+ 档」两条按新语义重写（新测试同时验证挡住与放开，不是弱化）。

## 5. 数字

| 项 | 2.2.9 | 2.2.10 |
|---|---|---|
| tests | 649 | **651** |
| 旧副本跑新套 | — | 646/651（4 新 + 版本号） |

## 6. 真机交叉验证

`hyperex-history (4).json` 的 2.2.x 8 杯：

| 指标 | 值 |
|---|---|
| s3NormalWrites | 19 |
| s3RescueWrites | 10 |
| checkReasons "S3 normal write budget" | **242** |
| checkReasons "S3 rescue write budget" | **186** |
| 合计被预算挡住的检测点 | **428** |
| "predictive-write-silence" | 118 |

428 与审查文档的数字完全一致，说明这道墙真实存在；118 次静默说明 F3 的放宽有依据。逐点 check 行仍被 compact 剥离，本轮无法逐点复算角度/误差分布。植物准确度沿用 cut 1 的结论，不记达标。

## 7. 复现

```powershell
cd D:/vscode/decenthyperexplugin/decenthyperexplugin.reaplugin
node tests/verify_v02210.cjs                # 651/651
node tests/verify_v02210.cjs <2.2.9 plugin> # 646/651（去掉 computeAngleStats 导出）
```

## 8. 验收清单

- [x] T-4 角度阈值与流量死区是两个独立常量
- [x] T-9/F4 累计档数预算 + 大角度放开 + 删除后段禁写；全局 maxWrites 保留
- [x] T-10 剩余时间真正进入救急判据
- [x] F3 救急静默 max(800, 实测)
- [x] T-12 大角度加码接入 predictive
- [x] T-13 0° 定义统一
- [ ] **T-11 handover 三处**：归补水对话（S2_REFILL_DEFAULTS / stage2StartupPlan 属补水段横幅所有权），2.2.10 不处理
- [x] 651/651；安全门零删除；v0229 及更早未动
- [x] 版本 2.2.10、README、HANDOFF、RESULTS

## 9. 已知限制

1. T-11 未做，已定归补水对话（S2_REFILL_DEFAULTS / stage2StartupPlan 属补水段横幅所有权），2.2.10 不处理。
2. 交叉验证到 `checkReasons` 汇总层，逐点角度/误差无法复算。
3. 救急写周期首次无实测时用 800 ms；与 F3 一致但仍是估计。静默上限 3000 ms 是本次加的保护，避免一次异常 ACK 把静默拉长到整杯；F3 原文只给了下限。
4. S3 救急预算的 24 档与常规同值，是审查建议值，没有真机标定。

