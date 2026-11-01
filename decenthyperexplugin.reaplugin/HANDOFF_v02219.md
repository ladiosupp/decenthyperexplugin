# v2.2.19 交接 — 杯间学习的上下文与 α 分阶段（2026-11-01）

## 0. 这一版是什么

第二轮复查退回的三项：stageGainEstimate 混上下文（P1-3 剩余）、gainBackfillAlpha 用全场救急计数（P2-6）、覆盖门文案与阈值不一致。只动杯间学习，补水段 / liveTrimTick / commandCeilingFor / S3 形状 / 桶几何都没碰。

## 1. 改了什么（plugin.js）

- `stageGainEstimate`：历史来源从 `persistentHistoryFile.shots.slice(-8)` + `evidence[stage]` 改成 `state.adaptiveHistory.slice(-8)` + `s[stage]`；继续跳过同 runId；为空返回 k=null，不回退未过滤列表。
- `gainBackfillAlpha(run,deviation,stage)`：按 trace 的 write.frame 分阶段数 rescue（frame 1 = stage2，≥2 = stage3）；没有 trace 才用 report 合计；调用点传 stage。
- `stageActuatorEvidence`：reason 的覆盖条件 0.8 → 0.60，与 eligible 一致。

## 2. 测试（tests/verify_v02219.cjs，689/689）

- 新增 P1-3：adaptiveHistory 两杯咖啡 + persistent 里空粉碗/未校验 → 只用咖啡；同 runId 只跳过一次（samples=2）。
- 新增 P2-6：S2 全常规 + S3 救急 2 → S2 α=.12、S3 α=.5。
- 新增覆盖门 reason：65% 覆盖 + 限压 → reason 报 pressure。
- 原有 8 条稳态增益夹具改成 `gainHist()` 预置 adaptiveHistory（带 profileTruthSchema:3 / fingerprint / runId）。

## 3. 已知限制

- adaptiveHistory 仍依赖启动时的 restore 过滤；若 restore 被跳过（存储异常），增益估计会返回 k=null 而不是退回未过滤数据，这是刻意的。
- 真机导出不含建议对象，收益仍要真机验证。

## 4. 发布状态

未提交、未打 tag、未推送，等用户点头。

