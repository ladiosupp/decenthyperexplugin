# HyperEx 1.78ds handoff — 2026-10-28

Development build on top of 1.77ds. Branch: v1.78ds (local + GitHub). Version label stays in the ds series: 1.78ds; next release continues upward (1.79ds ...). Not strict semver, same as 1.77ds.

## 本轮改动：活调整体重写为用户语义（趋势 / 矢量）

1. 活调确认：值相等改为趋势确认。旧实现要求 |targetFlow − command| < 0.02 才算确认——targetFlow 是流量趋势的观察窗口，不是写入 ACK。新判据：RAW 杯流斜率向目标收敛（写后 600ms 起用 liveTrimRegression，误差缩小 ≥0.015 g/s）为主；machineFlow 朝写入方向移动 ≥1/16 作为泵响应的辅助佐证。驱动 ACK 仍是硬闸（缺失即中止），但单独 ACK 不推进命令。
2. 同值重试废弃。未响应的矢量只记 vector-unresponsive，不再排队重发同值，不再有 3 次降级冷却与 3s 同值重试。下一次决策从当前趋势重算新矢量（加码或撤码）。
3. PD 矢量写控制。写入幅度 = |target − slope|×8 档（1/16 量化，封顶 4 档）；先 clamp 进 base±20% 包络（量化对齐），包络内无空间报 command-bound-vector，不空写。
4. 连续同向加码。sameSignStreak（RAW slope 相对目标的连续同号）≥3 时步长上限 6 档，≥6 时 8 档：更少写入次数、更短时间收敛；波幅由 base±20% 包络与趋势预测 hold 压住。
5. S3 1600ms 固定防毛刺写间隔删除。写不写由统计闸（R²、新鲜度、预测 hold、2% 死区）决定，不再为减少毛刺而人为少写。
6. 角度统计（杯内学习判据）。zeroDegreeShare = |errorPct| ≤ 2% 的 check 占比；meanAngleDeg = mean(atan(|errorPct|/100))；sameSignStreak 进报告。report 与 learningAssessment.angleStats 暴露，诊断状态行显示。不设硬门槛：收敛早期 0° 少属正常。
7. 诊断曲线箭头带方向与长短。liveTrimMarkers 给 up/down 矢量 size = |command − previous|×48（1 档≈3px、8 档≈24px）；renderChart 按 size 画箭头；图例中英文说明「箭头长短＝指令幅度 ml/s」。
8. 状态 / 事件 / 文案语义更新：monitoring-unresponsive-trend、vector-unresponsive、feedbackPolicy trend-vector-response、adaptiveMode trend-confirmed-window-and-dynamic-exposure-learning；i18n 增加新状态翻译。

## 用户定案的设计语义（2026-10-28，必须遵守）

- 写控制盯趋势（方向 + 速率），不盯值偏差；确认看趋势，不看作法。
- ACK 的作用是拨动 targetFlow 的趋势；可用超出目标流量的有界指令驱动趋势；同值重发无意义。
- 终极被控量是称流量（RAW 秤 g/s）；machineFlow / targetFlow 只是中间代理与趋势佐证。
- 学习判据：杯间 = 不启杯内调流时整杯曲线贴近目标 2/5/1.5 的程度；杯内 = 矢量角度越小越好、0° 时段越多越好。
- 连续同向角度 = 当前矢量太弱：加码（更少次数、更短时间），波幅靠包络与预测闸防。
- S1 走 LUT 直给，不做精细活调。

## 验证

- tests/verify_v0178ds.cjs：526/526 通过（含 2 条角度统计、1 条箭头方向/长短、1 条连续同向加码）。
- sim smoke：完整一杯通过（22 writes / S2 3.145 / 71.7s）。
- 无真机验证。

## 待办

1. 真机验证 S2/S3 趋势确认与加码行为、补水窗口、S3 低速段目标回显（历史 1.77 数据 21 写仅 8 次目标回显，主要受旧值相等确认影响；新确认下需重新采集）。
2. README 的 live trim 旧文案（same-target retry 等）未同步；README 历史说明停于 v0.1.67，新版说明以 HANDOFF 为准。
3. 打包：9 文件布局，zip 名 HyperExPulseFilter_v1.78ds_fresh.zip，根目录 decenthyperexplugin.reaplugin/。

## 版本与分支约定

- 分支 v1.78ds（本地 + origin）；后续版本继续 ds 后缀递增（1.79ds ...）。
- 版本三处一致：manifest.json 的 version、plugin.js 的 PLUGIN_VERSION、生成页面文本；verify 的版本一致性测试覆盖。
