# HyperEx 1.79ds handoff — 2026-10-29

Development build on top of 1.78ds (commit ea6a8d9). Branch v1.79ds (local + GitHub). Version label stays in the ds series: 1.79ds; next release continues upward (1.80ds ...). Not strict semver, same as 1.78ds.

## 本轮改动（真机反馈）

1. 主动泄压后自动 skipStep 双发竞态修复。scheduleRestartSkip 的防重变量 restartSkipTimer 原先在 setTimeout 回调第一行就置 null，而 guardedSingleSkip 的 getMachineSnapshot preflight 是异步的；这段 await 期间 stateUpdate 每帧都会再次触发 restartPourConfirmed，排上第二条 skipStep，帧号 0→1→2 直接跳过 S2 的 frame 1。结果：补水在 4 秒窗口内等不到 frame 1（startup-skipped），S2 活调全部 frame-not-confirmed，全杯无写入，约 25 秒后手动取消触发保护停止。修复：restartSkipTimer 保持到整个 skip 流程结束的 finally 才置空，原有防重在整个异步流程内有效；自动 skipStep 进入 S2 的机制不变（arm espresso 后 profile 从 S1 完整加载，确认 pouring 后只跳一帧到 S2）。
2. 补水基准 UI 改为明确双选开关（radio）：基础泵倍率（按当前 S2 指令）或目标折算（按设置值 S2 目标动态估算）。UI 同时显示两种基准各自的增强值，保存时写入 basis；原 0/1 range 滑条删除。
3. README 对齐 1.79ds；历史数据全点记录与 STEP 4 CSV 导出保留说明保留（1.68 起）。

## 真机证据（1.78ds）

- run 1793227543723-1：t=23734 与 t=23823 两条 command:skipStep（间隔 89ms），stage2 段机器 profileFrame=2/3、从未到 1；t=27977 startup-skipped: Startup dispatch guards not satisfied in time；t=48697 command:idle → aborted。CSV 内 0 条 write / 0 条 driver-ack，因此诊断图没有矢量箭头（没有写入可画）。

## 验证

- tests/verify_v0179ds.cjs：528/528 通过，含新增回归测试「restart pour poll+stateUpdate double trigger issues exactly one skipStep」。
- 无 1.79ds 真机验证；skip 修复与补水 UI 待真机复核。

## 待办

1. 真机复核：S2 帧 1 正常停留、补水按 frame 1 启动、S2 活调恢复写入、箭头出现。
2. 若修复后仍有写入却看不到矢量箭头，取该杯 CSV 核对 liveFlowTrim.trace 的 write 行（方向来自 command−previous，retry=true 时画 ↻）。

