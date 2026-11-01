# v2.2.18 交接 — P1 补水/学习修复（2026-11-01）

状态：<strong>已发布 v2.2.18</strong>（commit <code>e4b0433</code>，tag <code>v2.2.18</code>，分支 <code>v1.79ds</code>）。GitHub Release 与夸克包已上传；发布记录见文末。基线 HEAD = <code>37b0566</code>（v2.2.17）。

## 改了什么

1. **P1-1 boost ACK 清计时器**：<code>startLiveTrim</code> 的 raw ACK 处理器在 <code>startupAction==="boost"</code> 时清掉 <code>startupAckTimer</code>。修复“boost 已 ACK、2 s 时一笔 trim 还在等 ACK → 整杯 abort（S2 refill driver ACK missing）”。新增回归。
2. **P1-2 bounded 默认 cup-target**：<code>currentS2RefillSettings</code> 在 bounded 且未保存/缺 basis 时返回 <code>cup-target</code>；显式保存的 <code>pump-command</code> 保留。旧缺 basis 的存档在 bounded 下迁移为 <code>cup-target</code>。曲线编辑器的 <code>refillDefaults</code> 也按 bounded 返回 <code>cup-target</code>。
3. **P1-3 当前杯不重复计数**：<code>stageGainEstimate</code> 遍历 persistent history 时跳过与当前 <code>runId</code> 相同的行；当前杯仍由 <code>addSingle(current)</code> 计一次。按用户口径，<strong>没有</strong>按模式/纸过滤。

## 测试

<code>tests/verify_v02218.cjs</code> = <strong>686/686</strong>，日志 <code>tests/RESULTS_v02218.txt</code>。v02217 的 682 条全部保留，新增 4 条 P1 回归。

复现：<code>cd D:/vscode/decenthyperexplugin && node decenthyperexplugin.reaplugin/tests/verify_v02218.cjs</code>。

## 没动

- P2-1 drift 相邻增幅、P2-2 history-import 裁剪/ gainMemory、P2-3 桶几何、P2-4 return trace previous、P2-5 cutoff 耦合、P2-6 阶段 α，见 <code>REVIEW_2026-11-01-2.2.17-whole.md</code>。
- 未改 P1-3 的模式/上下文过滤（用户明确“不按模式过滤是对的”）。
- 未改皮肤或宿主配置；全部在插件侧。

## 真机先验

1. 正常一杯让补水持续 >2 s，确认不再在 boost 后约 2 s 出现 “S2 refill driver ACK missing”。
2. 新装或“恢复补水默认值”后看 <code>stage2StartupPlan.controlSource</code>/<code>controlBaseMlS</code>：目标 5 g/s 应为 <code>gain-memory</code>/<code>lut</code> 且平台约 3.6–4.0。
3. 已保存 pump-command 的旧设置不应被强行改写；若仍看到 <code>profile-base</code>，先确认 UI 里是否显式选了 pump-command。

## 发布记录（2026-11-01）

- commit <code>e4b0433</code>，tag <code>v2.2.18</code>，分支 <code>v1.79ds</code>。
- GitHub Release：https://github.com/ladiosupp/decenthyperexplugin/releases/tag/v2.2.18
  - 附件 <code>HyperExPulseFilter_v2.2.18.zip</code>，416,743 字节。
- 夸克：<code>夸克网盘/来自：Codex/HyperExPulseFilter_v2.2.18.zip</code>，fileId <code>8257e580a99249a38f8d8d456fdea955</code>。
- SHA256：<code>2AC740A98975D9924007A8F2306992BFEB0BB5AAA9D54B70773E4E1FF4038CA8</code>
- 测试：<code>tests/verify_v02218.cjs</code> 686/686；包内解压复跑 686/686。
