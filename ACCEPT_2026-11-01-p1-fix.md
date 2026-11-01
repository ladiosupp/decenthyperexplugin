# ACCEPT — v2.2.18 P1 修复（2026-11-01）

## 结论

修复 2.2.17 全量审查的 3 条 P1：boost ACK 计时器误杀后续 trim、bounded 补水默认基准仍为 pump-command、当前杯在稳态增益估计里重复计数。P2/P3 未动。

## 范围

插件侧：<code>plugin.js</code>、<code>manifest.json</code>、<code>README.md</code>、<code>HANDOFF_v02218.md</code>、<code>tests/verify_v02218.cjs</code>、<code>tests/RESULTS_v02218.txt</code>。没有动皮肤或宿主配置。

## 改动逐条

1. **P1-1**：<code>startLiveTrim</code> 的 raw ACK 处理器在 <code>startupAction==="boost"</code> 时清掉 <code>startupAckTimer</code>。避免 boost 已 ACK 后、2 s 时一笔 trim 未 ACK 触发整杯 abort。
2. **P1-2**：<code>currentS2RefillSettings</code> 在 bounded 且未保存/缺 basis 时返回 <code>cup-target</code>；显式保存的 <code>pump-command</code> 保留。旧缺 basis 的存档在 bounded 下迁移为 <code>cup-target</code>。曲线编辑器 <code>refillDefaults</code> 按 bounded 返回 <code>cup-target</code>。
3. **P1-3**：<code>stageGainEstimate</code> 遍历 persistent history 时跳过与当前 <code>runId</code> 相同的行；当前杯只由 <code>addSingle(current)</code> 计一次。按用户口径未按模式/纸过滤。

## 测试

- <code>node --check</code> 通过。
- <code>tests/verify_v02218.cjs</code>：<strong>686/686</strong>。v02217 的 682 条保留，新增 4 条：boost ACK 清计时器、bounded 默认 cup-target、显式 pump-command 保留、缺 basis 迁移、当前杯不重复计数。
- 包内解压复跑通过（见构建脚本）。

## 真机验收

1. 正常一杯让补水持续 >2 s，确认 boost 后约 2 s 不再出现 “S2 refill driver ACK missing”。
2. 新装或“恢复补水默认值”后，<code>stage2StartupPlan.controlSource</code> 应为 <code>gain-memory</code>/<code>lut</code>，平台约 3.6–4.0（目标 5 g/s、r≈1.29）；显式保存 pump-command 的旧设置应保持原样。
3. 观察 S2 平台与峰值过冲，导出 history JSON。

## 限制

P2-1 drift 相邻增幅、P2-2 history-import 裁剪/gainMemory、P2-3 桶几何、P2-4 return trace previous、P2-5 cutoff 耦合、P2-6 阶段 α 未改；P3 风险未验。详见 <code>REVIEW_2026-11-01-2.2.17-whole.md</code>。
