# HyperEx 1.80ds handoff — 2026-10-29

开发版，版本号 1.80ds（非严格 semver）。按用户要求不再新开分支，直接做在当前 v1.79ds 分支（本地 + GitHub）上，接在 c53dd95（控制律曲线 90° 中刻度）之后。

## 1. 当前状态

- 版本号三处一致：manifest.json "version": "1.80ds"、plugin.js PLUGIN_VERSION = "1.80ds"、生成页面文本（运行时由 PLUGIN_VERSION 插值成 HYPEREX v1.80ds）。
- 测试：tests/verify_v0180ds.cjs 538/538（RESULTS_v0180ds.txt 为最新输出；2026-10-30 晚新增 2 条链路测试）。
- README 顶部已改成 1.80ds 小节，1.79ds 下移到 Previous release。
- 本地包：暂未打包（用户 2026-10-29 指示 1.80ds 还在做，先不打）。

## 2. 本轮改动（相对 1.79ds r4）

1. 版本号升级 1.79ds → 1.80ds：物理上只改 manifest.json 与 plugin.js 的 PLUGIN_VERSION 两处，生成页面与 calibrationStatusPayload 都从常量取值。
2. 控制律曲线补 90° 中刻度：renderChart 新增可选第六参数 tickVals；传入时按值换算 y 坐标，画 3 3 虚线网格（透明度 .4）+ 左侧 10px 标签；控制律曲线调用传 [90]，现在 0 / 90 / 180 三档可见。杯流图与重量图不传该参数，行为不变。
3. 新建 tests/verify_v0180ds.cjs（由 verify_v0179ds.cjs 复制，版本断言与测试名改为 1.80ds；正则形式 1\.79ds 1 处、普通 1.79ds 5 处替换）与 RESULTS_v0180ds.txt。
4. README 顶部加 1.80ds 小节：把 1.79ds 工作区里的矢量控制、角度统计（连线角）、bigAngleStreak、稳态增益 k 常驻、趋势轨迹线、控制律曲线（含 90° 中刻度）、历史导出收进 1.80ds。
5. 杯内控制显式分状态（2026-10-30）：coast（|误差|≤6% 且趋势收敛 → 不写，交给固件）／lut-compensate（低于目标且趋势角 55–125°，压力有余量 → 包络上限改为 mappedCommandForReal(target)×0.9，步进至少 2 档）／vector（原有 base±20% 窄包络）。状态写入 trace 的 trimMode。
6. 杯间学习改用单杯加码链（liveTrimChainEvidence）：连续同向稳态写 ≥2 档、Δ杯流同向且 ≥0.08 g/s、局部增益 0.2–3 视为有效证据；下一杯按链增益反推目标指令（0.9 阻尼，链首指令为下界）。加码无响应则 SATURATED / HOLD，不学 LUT 偏移；旧两杯一致路径保留为 fallback。

## 2b. 2026-10-30 晚修复（本分支工作区，未提交）

1. 加码链应用断链：s2AdaptiveSuggestion 返回的 LUT COMPENSATE / SATURATED / HOLD 之前只在建议层生成，下游 actionable 判定、applyNextShotAdaptiveSuggestion（写下一杯 + readback 校验）、adaptiveAuditPayload、UI renderNextDecision / renderAdaptive 五处只认 "ADJUST"，导致自动应用直接跳过、手动应用抛 "No actionable"——加码链学习实际是死代码。已全部扩展为 ("ADJUST" || "LUT COMPENSATE")，UI 补 SATURATED 文案。
2. 链构建 bug：liveTrimChainEvidence 首步 step 原为 null，lastStep 首轮不落值，两次写入永远成不了长度 2 的链（实际要 ≥3 次写入）。改为首步用 commandMlS - previousMlS 判方向，same 判断补 Number.isFinite / step!==0 保护。
3. 新增测试：
   - S2 single-shot chain supplies LUT COMPENSATE and auto-applies to next shot：链 usable → actionable → auto apply applied，stage2 写入建议值，LUT 不变；
   - saturated chain holds next-shot S2 command and is not actionable：链不可用 → SATURATED / HOLD、不应用。
4. RESULTS_v0180ds.txt 已刷新为 538/538。

## 2c. 2026-10-30 真机历史分析后的修复（本分支工作区，未提交）

用户提供的 hyperex-history1030.json（30 杯，最后 2 杯为 1.80ds）暴露：S2 尾段实测 5.155 g/s（误差 3.1%、波动 4.2%）已经达标，但学习连续十几杯都是 LIMITED / HOLD，原因是覆盖率被挡住：

- 固件把机器目标按 1/16 档位渐变回显（4.94→5.5→4.2…），而 controlLearningAssessment 的 known() 要求回显精确等于某次写入或 base 才计为已知目标。真实两杯覆盖率仅 22.8% / 32.7%，低于 80% 门槛。
- 修法：包络内（base×0.8–1.2）的回显即视为已知目标；覆盖率门槛 80% → 70%。同两杯覆盖率升至 80.7% / 75.0%。
- 另一处：S2 startup 的 boost/return 写没有同步 t.commands[frame]，return 回 4.0 后决策仍从 5.5625 起（trace 里 previousMlS=5.5625），会多走几次下调。现在 boost/return 写后同步基线。
- 新增测试：固件渐变回显计为已知覆盖；S2 startup 写同步基线。540/540。
- 真机其余观察：trimMode 以 vector 为主（84/171、65/180），coast 各 1 次，lut-compensate 2 次且均 command-bound；尾段达标说明包络够用，但 43–67 次 command-bound-vector 说明指令常贴上界，后续可观察学习恢复后是否减少。

## 3. 真机待验证（承 1.79ds，均未复核）

1. 矢量箭头方向是否与趋势一致（write 带 rawGS 时起点在连线上）；箭头头部大小是否可接受。
2. 角度统计：0° share 是否随杯内推进上升，mean angle 是否下降；若稳态仍 70–90°，说明 45° 阈值或步幅需要再调。
3. bigAngleStreak 是否只在启动 / 扰动段出现；稳态持续增长说明加码过猛。
4. 稳态增益 k：STEP 2「下一杯决策」底部是否显示；显示「样本 0 杯」说明历史 evidence 不足。
5. 趋势轨迹线 / 控制律曲线是否可读（本版补了 90° 刻度）。
6. 历史导出：复制出的本地地址在系统浏览器打开能否下载 JSON；JSON 内新杯是否有 fullRecord。
7. 杯内状态：coast 段是否不再写、lut-compensate 是否能把指令推到目标反算值、饱和是否被正确识别（trimMode 与 reason 可在 trace 里核对）。
8. 学习：加码链是否在下一杯给出 LUT COMPENSATE，饱和杯是否保持指令不变；多杯后 LUT 偏移是否收敛而不是每杯重爬。

## 4. 发布步骤（待开发完成后执行）

1. 打包：release/HyperExPulseFilter_v1.80ds.zip（HANDOFF_v0180ds.md / 两个校准 JSON / LICENSE / manifest.json / plugin.js / README.md / tests/verify_v0180ds.cjs / tests/RESULTS_v0180ds.txt）。
2. Release：新建 v1.80ds（仓库已关闭 immutable，可直接覆盖资产）。
3. 夸克网盘：同名 zip 上传到「来自：Codex」。
4. push 走 VPN 代理：git -c http.proxy=http://127.0.0.1:57890 push origin v1.79ds（用户说不用推时只记口径）。

## 5. 坑与经验（本轮新增）

- plugin.js 的 renderChart / renderCharts / liveTrimMarkers 是超长单行，apply_patch 匹配不了行内片段；用 Node 脚本做精确串替换，每处断言只命中一次。
- exec 里调用 tools.apply_patch 时补丁文本要用 String.raw，否则模板字符串会把 \r\n 解释成真换行、把补丁拆坏（报 invalid hunk）。
- apply_patch 的路径相对于 D:/vscode，插件目录是 decenthyperexplugin/decenthyperexplugin.reaplugin/...，别漏仓库目录这一层。
- 测试文件里的版本号有两种形态：普通 1.79ds 和正则转义 1\.79ds（HYPEREX v1.x 断言），复制升级时两种都要替换，并确认文件里不再残留 1.79ds。
- 模板字符串里不要写反引号包裹命令，会截断 String.raw 的内容。
