# HyperEx 2.2.42 交接：按 2.2.41 真机数据收紧五处边界

日期：2026-11-08（北京时间）。实验版本，2.2.42 本身尚未真机验证。

基线：2.2.41（manifest 与 PLUGIN_VERSION 均为 2.2.41）。用户确认按 2026-11-07 的 8 杯真机数据一次修改五条，全部落在插件侧；皮肤和 Decaid 宿主未改。

## 真机依据

hyperex-history (9).json 新增 8 杯（本地 11-05 07:48 ～ 11-08 07:52），其中 4 杯有逐点 RAW 秤。关键现象：

- 4/8 补水的收口是计时触发，且全部跳过断流笔，直接回平台；另外 4/8 是预测触发并走断流。
- 11-07 13:52：补水收回后 3.45 s 没有普通写入（S2 post-refill ramp quantum hold 6 次、predictive-write-silence 26 次），峰值 5.74（目标 5，+14.8%），到 +12.8% 才用 22 档救急；下一杯降到 4.125 后峰值 5.25（+4.9%）。
- S3 final60 的 p95 绝对误差 0.266–0.305 g/s（17.7–20.3%），RMSE 0.121–0.168（8.1–11.2%）；指令反转已降到 1–3 次/杯。EARLY 形状学习窗仍吃到 S2→S3 衰减：早段指令同为 0.8125 时，学习窗测到 1.27 与 1.144。
- S1 指令从 2.188 一路加到 2.438（约 1.85×LUT 1.315）后卡住；4 杯可学，4 杯因 20–80% transit <0.9 s 被 REPEAT，且被排除的多是高流量杯。
- S2 稳态增益 feed-forward 8 杯里 7 杯被 10% spread 挡住，实际 spread 10.1–11.4%；唯一放行的 1 杯把 -16.3% 的欠流量修了回来。

## 修改

1. **S2 计时收口也走断流**（dispatchS2Startup 的安全定时器）。原先 holdMs 定时器直接 dispatch return；现在只在 status=boosting 时动作，bounded refill 先 dispatch bleed，由断流的 700 ms / 预测收回条件决定何时回平台。断流已开始时定时器直接返回，不截短断流。位置：plugin.js 约 3102 行。
2. **S2 回收轨迹提前交回反馈**（liveTrimGovernor 的 s2Recovery）。固定 u0→u1 向下回收且 actualError ≥ +8% 时，rec.done=true 并立即 return null，让普通反馈接管；不再 hold 到 +12% 救急门。位置：plugin.js 约 8371 行。
3. **S3 drift EARLY 窗避开衰减**（stage3StabilityDiagnostics 的 shapeFrames）。EARLY 的 settle 从 duration×0.50 改为 max(0.75, min(5.0, max(0.75, duration−3.0)))，即最多等 5 s，同时至少留 3 s 回归窗；短帧仍按可用窗口回退。位置：plugin.js 约 2324 行。
4. **S1 快速轨迹准入**（stage1StartupMetrics / stage1AdaptiveEvidence）。新增 0.55 s transit / 5 样本 / 1.05 s active 的 reduced-evidence 通道，R² 仍要求 ≥0.90；通过时 confidence=MEDIUM、fastTrajectory=true。stage1AdaptiveEvidence 对 fastTrajectory 使用降低后的 transit/active 下限，不再一律拒绝快杯。位置：plugin.js 约 2152、2546 行。
5. **稳态增益门 10% → 12%**（addGain）。三杯以上允许 spread ≤12%；两杯共识仍是 5%。原因串同步改为 12%。位置：plugin.js 约 4024 行。

版本号、manifest description、README 顶部小节同步到 2.2.42。

## 测试

- tests/verify_v02242.cjs：772/772 通过。新增/更新覆盖：
  - 计时器 bounded refill 先断流；断流在飞时定时器不截短。
  - S2 ramp 在 +8% 以上交回普通反馈；+6% 以下仍按固定轨迹。
  - S3 EARLY 窗长度 2.4–3.6 s。
  - S1 快杯进入 MEDIUM / fastTrajectory，且 next-shot S1 不再 REPEAT。
  - 11% spread 在 12% 门下放行。
- node --check plugin.js 通过；manifest JSON 解析通过；生成 HTML 的全部 script 在测试里用 vm.Script 解析。
- 旧 verify_v02241.cjs 仍有 4 条按旧口径写的断言会失败（0.90 s 门、2.2.41 版本号、短 S2 用 6 g/s 触发新 +8% 释放、固定轨迹 hold），这是预期的口径变化；以 verify_v02242.cjs 为准。

## 真机一次测试重点

- 看计时收口杯是否出现 bleed → return 两笔，且 return 不再紧贴 bleed。
- 看 S2 峰后是否在 +8% 左右就交回普通反馈，峰值是否低于 2.2.41 的 5.74；特别关注 11-07 13:52 同款高增益杯。
- 看 S3 EARLY 的 sourceFrames 窗口与 earlyFactor 是否停止在 1.6 附近摆动；S3 final60 p95 仍是主要验收项。
- 看 S1 adaptiveDecision 是否对快杯给出非 REPEAT 的建议，指令能否从 2.438 回落。
- 看 steady-gain feed-forward 是否在 10–12% spread 的杯上放行，以及放行后是否比纯 gain-memory 更平。

## 安装与回滚

- 安装 releases/v2.2.42/HyperExPulseFilter_v2.2.42_experimental.zip，根目录 decenthyperexplugin.reaplugin/。
- 回滚：装回 2.2.41 的已发布 ZIP。代码回滚不会撤销测试杯已经写入的杯间学习数据。
- 未改：LUT、S1/S2/S3 压力与限压、补水 5.75 / 3000 / 45 的现有设置、皮肤、宿主。

## 工作区

- 只改插件侧：plugin.js、manifest.json、README.md、tests/verify_v02242.cjs、tests/RESULTS_v02242.txt、HANDOFF_v02242.md。
- 已发布：见文末「发布记录（2026-11-08）」。

## 发布记录（2026-11-08）

- 代码提交 2b79249，tag v2.2.42，分支 v1.79ds 已推送。
- GitHub Release：https://github.com/ladiosupp/decenthyperexplugin/releases/tag/v2.2.42（附件 HyperExPulseFilter_v2.2.42_experimental.zip，480,502 字节）。
- SHA256：57C5F0E3EDE11A0D24ED7745DEB53AA108169497EBFA99C55501AE062EDE4199；包内 10 个文件与提交 2b79249 逐字节一致。
- 夸克：夸克网盘/来自：Codex/HyperExPulseFilter_v2.2.42.zip，480,502 字节，fileId 23a2567526464566892d2cd9008e3940。

## 数据与取证（2026-11-08 复核）

- 全量归档：`D:/vscode/.tools/hx-data/hyperex-history-all.json`，80 杯 / 11 份导出 / 25.2 MB。73 杯有 fullRecord（都有 liveFlowTrim.trace），42 杯有逐点 samples 与 rawScaleSamples；`.tools` 不入库。
- 本次合并：hyperex-history (9).json 新增 8 杯（本地 11-05 07:48 ～ 11-08 07:52）、8 杯补全点、37 杯重复，归档从 72 杯到 80 杯。
- 四杯杯流对照图：`D:/vscode/.impeccable/review/hx-new8.png`。
- 一次性分析脚本（未入库）：`.tools/__hx-new8-analysis2.js`、`__hx-writes.js`、`__hx-chart.js`；复核归档条数用 `.tools/__hx-archive-count.js`。
- 同日 09:22 又发布了 2.2.43（三档泄压 + 自动 0 bar 帧，783/783，见 `HANDOFF_v02243.md`）。**2.2.42 与 2.2.43 都还没有真机数据**，回读新导出时先看 `pluginVersion` 再分口径。
- 工作区：插件仓库根是 `D:/vscode/decenthyperexplugin`；外层 `D:/vscode` 是咖啡小程序仓库，它的 `docs/plans` 不是本项目的交接区。
