# HyperEx 1.79ds handoff — 2026-10-29 (r4)

Development build on top of 1.78ds (commit ea6a8d9). Branch v1.79ds (local + GitHub). Version label stays in the ds series: 1.79ds; next release continues upward (1.80ds ...). Not strict semver, same as 1.78ds.

## 本轮改动

1. 主动泄压后自动 skipStep 双发竞态修复。scheduleRestartSkip 的防重变量 restartSkipTimer 原先在 setTimeout 回调第一行就置 null，而 guardedSingleSkip 的 getMachineSnapshot preflight 是异步的；这段 await 期间 stateUpdate 每帧都会再次触发 restartPourConfirmed，排上第二条 skipStep，帧号 0→1→2 直接跳过 S2 的 frame 1。修复：restartSkipTimer 保持到整个 skip 流程结束的 finally 才置空。
2. 补水基准 UI 改为明确双选开关（radio）：基础泵倍率（按当前 S2 指令）或目标折算（按设置值 S2 目标动态估算），保存写入 basis；原 0/1 range 滑条删除。
3. README 对齐 1.79ds。
4. 矢量箭头改画在「上一检测点 → 本次写入」的趋势连线上（方向仍是指令增/减的绝对方向）；箭头头部固定 5px 高、±4px 宽，强度只拉长尾巴。
5. 角度统计改为连线角：相邻检测点连线延长到目标线，0° = 趋势落在目标线上（2% 带内且斜率≈0），朝目标 0–90°，平行偏离 90°，背离 90–180°。
6. 连续大角度加码：bigAngleStreak（趋势角 ≥45° 连续次数）≥3 → 6 档，≥6 → 8 档；sameSignStreak 保留作报告。
7. 稳态增益 k 常驻显示（样本不足显示「样本 N 杯 · 需 ≥2 杯同段干净记录」）。
8. 诊断图新增浅蓝趋势轨迹线（check/write rawGS + 3 点平滑）与 0–180° 控制律曲线图（每个 check 的 trendAngleDeg）。
9. 历史导出：STEP 4 EXPORT HISTORY JSON；插件页无下载能力，按钮生成 Decaid 本地服务地址（/api/v1/plugins/<id>/history-export）并复制，浏览器打开下载（attachment）。新杯历史记录 fullRecord（完整 samples / rawScaleSamples / events / liveFlowTrim.trace），上限 30 杯。

## 真机证据（1.78ds）

- run 1793227543723-1：t=23734 与 t=23823 两条 command:skipStep（间隔 89ms），stage2 段机器 profileFrame=2/3、从未到 1；t=27977 startup-skipped；t=48697 command:idle → aborted。CSV 内 0 条 write / 0 条 driver-ack。

## 验证

- tests/verify_v0179ds.cjs：536/536 通过（含 restart 双触发只发一条 skipStep、历史全点导出、角度口径、趋势轨迹与控制律曲线）。
- 真机验证（2026-10-29）：用户确认萃取步骤正常——主动泄压后自动 skipStep 只跳一次，S2 进入后帧确认与补水不再卡住。
- 矢量箭头/角度/加码/k/趋势轨迹/控制律曲线/历史导出尚未逐项真机复核。

## 待办

1. 真机复核：箭头方向与头部大小、0° share 与 mean angle 是否收敛、bigAngleStreak 是否只在启动段、k 是否显示、历史导出地址是否可下载。
2. 若稳态角度仍大，按实测调 45° 阈值或步幅上限。
3. 1.80ds：先跑 536 基线；升版本三处（manifest version / PLUGIN_VERSION / 页面文本）；新建 tests/verify_v0180ds.cjs 与 RESULTS_v0180ds.txt；打包 9 文件布局；release 与夸克同步。

