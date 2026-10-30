# HyperEx 1.81ds handoff — 2026-10-30

开发版，版本号 1.81ds（非严格 semver）。按用户要求继续做在当前 v1.79ds 分支工作区（本地 + origin），接在 1.80ds 之后。

## 1. 当前状态

- 版本号：manifest.json "version": "1.81ds"、plugin.js PLUGIN_VERSION = "1.81ds"、生成页面文本自动插值。
- 测试：tests/verify_v0181ds.cjs 540/540（RESULTS_v0181ds.txt）。
- 未打包、未发 Release、未传夸克、未 push（用户说研究好再说）。

## 2. 本轮改动（基于 hyperex-history1030.json 的物理数据分析）

数据事实（1.80ds 两杯全点）：
- S2 稳定段机器流量 4.4–4.9 ml/s 对应杯流 5.0–5.6 g/s，k≈1.1–1.15，滞后 <1 s。
- S3 稳定段机器流量 0.62–0.90 对应杯流 1.1–2.0 g/s，k≈1.8–2.3，滞后 2–4 s；13–19 s 超调 +15–33%，23 s 后才稳。
- 机器流量与杯流在 S2 相关性≈0，压力与杯流 0.02–0.47；波动来自粉饼/泵扰动。
- 1 秒窗写入后的杯流响应增益在 −2.6~6.7 乱跳，方向常反，追噪声会放大波动（指令与杯流相关 −0.76~−0.81）。
- normalized 学习把真实 5.15 g/s 的尾段记成 3.14，导致连续加码到 4.0；学习覆盖率仅 22.8%/32.7%，被 80% 门槛挡住。

改动：
1. tailMachineGain：控制段（后 40%）RAW 杯流 / 机器流量中位数算物理增益；复用了 controlled 的 actuator 门槛（≥4 样本、≥70% 覆盖、压力<20%、执行跟随<25%）。
2. stage2AdaptiveEvidence：controlled eligible 时把 tailGain 附在证据上；不 eligible 时若 tail 安全可用则直接给 tail 证据。
3. s2AdaptiveSuggestion：无历史证据时用 tail 反推 target/k（0.9 阻尼），套学习档位步幅（保守 5%/0.1、正常 12%/0.35 等）；有历史时仍走历史共识。
4. stage3SingleSuggestion：单杯修正改比例反推 old×target/measured，0.9 阻尼，去掉 policy.gain 欠调。
5. liveTrimRegression：S3 窗口 3 s、尾窗 1.2 s、预测外推 2 s；S2 保持 1.6 s/0.75 s/0.5。
6. liveTrimTick：死区 report.deadbandPct=4（原 2）；coast 增加 trendSlope |.<0.1| 判据；vectorStepCount 在 |err|/target≤10% 时封顶 1 档。
7. S2 startup boost/return 写同步 t.commands[1]（1.80ds 遗留）。
8. 覆盖率：known() 接受包络内渐变回显，门槛 80%→70%（1.80ds 晚修复，本版包含）。

## 3. 真机待验证

1. S2 到达 5 g/s 的时间（目标 2–3 s）与稳态 CV（目标 3–4%）。
2. S3 到达 1.5 g/s 的时间（目标 8–10 s）与超调（目标 <+5%）；稳态占比（目标七成）。
3. coast 每杯占比是否上升（原 1 次/杯）。
4. 死区 4% 下是否仍有足够响应；接近目标是否只动 1 档。
5. 学习建议：tail 反推的 suggestedCommandMlS 是否收敛，LUT COMPENSATE 是否按步幅应用。
6. S2 boost 仍按用户 160% 设置（未改，物理上限方案已撤回，避免覆盖用户设置）。

## 4. 发布步骤（用户确认后）

1. 打包 release/HyperExPulseFilter_v1.81ds.zip（9 文件布局，HANDOFF_v0181ds.md / 两个校准 JSON / LICENSE / manifest.json / plugin.js / README.md / tests/verify_v0181ds.cjs / tests/RESULTS_v0181ds.txt）。
2. Release v1.81ds。
3. 夸克「来自：Codex」同名 zip。
4. push 走 127.0.0.1:57890。

## 5. 坑与经验

- plugin.js 长单行用 Node 脚本精确替换；apply_patch 里不要用反引号（模板字符串冲突）。
- 测试版本号两种形态都要替换（1.80ds 与 1\.80ds）。
- 改死区/窗口/步幅会破坏既有断言，需同步更新测试预期。
- tailGain 必须在 controlled 之后兜底并复用 actuator 门槛，否则会绕过压力/覆盖/目标回显安全闸。
