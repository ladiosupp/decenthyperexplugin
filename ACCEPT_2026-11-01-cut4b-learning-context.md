# cut 4b 验收文档 — 杯间学习的上下文与 α 分阶段（2026-11-01）

## 0. 结论

三项全部落地，`tests/verify_v02219.cjs` **689/689**；v02218 原样保留。版本 2.2.19，未打 tag、未推送。

## 1. 范围与边界

只改 `plugin.js` 的三个杯间学习函数（stageGainEstimate / gainBackfillAlpha / stageActuatorEvidence 的 reason），另加 manifest/README/HANDOFF/tests/RESULTS。补水段、liveTrimTick、commandCeilingFor、S3 形状、桶几何均未碰。

## 2. 改动逐条

### P1-3 stageGainEstimate 混上下文

- 旧：`persistentHistoryFile.shots.slice(-8)`，逐杯读 `s.evidence[stage]`；空粉碗/咖啡/未校验/不同模式会混进同一个 k。
- 新：`state.adaptiveHistory.slice(-8)`，读 `s[stage]`；保持 `s.runId===run.runId` 跳过（remember 时当前杯尚未入列，apply 重算时已入列，两种调用都正确）。
- adaptiveHistory 为空 → `{samples:0,k:null}`，不回退未过滤列表。

### P2-6 α 分阶段

`gainBackfillAlpha(run,deviation,stage)`：

- 有 trace 时按 `write.frame` 数本阶段 rescue：stage2 = frame 1；stage3 = frame≥2。
- S2 全常规 + S3 救急 2 笔 → S2 α=0.12、S3 α=0.5。
- 无 trace 才退回 `trim.rescueWrites/normalWrites` 合计。

### 覆盖门文案

`stageActuatorEvidence` 的 reason 覆盖条件与 eligible 对齐到 0.60；65% 覆盖 + 限压时 reason 报压力门，不再误报覆盖不足。

## 3. 测试（689/689）

- `P1-3 steady-gain uses only the filtered history and skips the current run`：adaptiveHistory 两杯咖啡 + persistent 空粉碗/未校验 → samples=3 且来源只有咖啡；再验证同 runId 只跳过一次（samples=2）。
- `P2-6 gain alpha reads rescue writes per stage`：S2 全常规 + S3 救急 2 → α .12 / .5。
- `§22.8 the coverage reason uses the same 0.60 floor`：65% 覆盖 + 压力失败 → reason 匹配 Pressure limiter。
- 原有 8 条稳态增益测试夹具改为 `gainHist()` 预置 adaptiveHistory（profileTruthSchema:3、fingerprint、runId），不保留未过滤路径。

## 4. 复现

```powershell
cd D:/vscode/decenthyperexplugin/decenthyperexplugin.reaplugin
node tests/verify_v02219.cjs   # 689/689
```

## 5. 清单

- [x] stageGainEstimate 只读过滤后的 adaptiveHistory，并跳过当前杯
- [x] α 按阶段取救急笔数，不用 phaseWrites
- [x] 覆盖门 reason 与 0.60 阈值一致
- [x] 689/689；v02218 未动
- [x] 2.2.19 版本号、README、HANDOFF、RESULTS

## 6. 限制

- 依赖启动 restore 的过滤；restore 异常时返回 k=null（刻意）。
- 真机导出无建议对象，收益待上机。

