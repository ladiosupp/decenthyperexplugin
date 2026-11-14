# Profile Recorder

记录 **HyperEx Pulse Filter 不记录的每一杯萃取**的全点曲线（机器遥测 + RAW 秤 + 状态事件），
供 ProfileReplayer App / PC 仿真台回放。HyperEx 介入的杯（含校准）仍走 HyperEx 自己的记录，
本插件只保留其余杯——**源头不重叠**。

## 数据流

- 机器状态事件（stateUpdate）：espresso 开始 → 建 run；离开 espresso → 收 run。
- 秤快照 WebSocket（ws://localhost:8080/ws/v1/scale/snapshot）：rawScaleSamples（约 10 Hz，上限 12000 点/杯）。
- samples：100 ms 节奏（SampleIntervalMs 50–1000 可调，上限 3000 点/杯），字段镜像 HyperEx 诊断采样；
  机器快照里若有温度字段（mixTemperature / groupTemperature / targetMixTemperature / targetGroupTemperature / steamTemperature）一并记录。
- events：sequence_start / sequence_end / substate / workflow_changed（上限 300 条/杯）。

## 归属判定（不重叠的关键）

**曲线名前缀闸门（v1.0.1）**：HyperEx 只控制并记录标题以固定前缀 `HyperEx` 开头的曲线
（`HyperEx Pulse Filter` / `HyperEx Pulse Filter auto` / `HyperEx Flow Calibration`）。
标题不带该前缀的杯（如拉杆曲线）HyperEx 根本不会记录，本插件**杯一结束立即保留**，
不跑任何探针、不查 HyperEx 状态——非 HyperEx 杯落盘从 12 s 缩到 ~0 s。

**复杂检查只对带前缀的杯跑**：杯结束后 2 / 5 / 8 秒各查一次 HyperEx 的 /status，
diagnosticSummary 的 startedAt 落在本杯 espresso 窗内（允许早 2 s）且 endedAt 与本杯结束
相差 ≤10 s → 判定 HyperEx 已记录，丢弃本插件这份。起始用「包含式」而非紧窗：HyperEx 在
确认出液（preinfusion/pouring）才打开始时间，可能比 espresso 边沿晚一个预热段（冷机可超 5 s），
紧窗会把这种杯误留造成重叠。12 秒内无匹配证据（HyperEx 未装 / 关闭 / 观察模式）→ 保留。
插件卸载时未决的杯一律保留（宁可 App 端按 runId 去重，不丢杯）。

## 存储与导出

- host.storage 键 profileRecorderHistoryV1，滚动保留最新 **4 杯**全点，新的覆盖旧的。
- GET /api/v1/plugins/profilerecorder.reaplugin/history-export
  导出形状与 HyperEx 相同（kind: HyperExHistoryExport, schema: 1），runId 前缀 pr-，
  ProfileReplayer 的合并内核（sim/archive-core.js）按 runId 去重、分量取最长，无需改动。
- GET /api/v1/plugins/profilerecorder.reaplugin/status 返回录制状态与历史杯数。

## 边界

- 只读：不写机器状态、不写曲线、不改任何设置。
- HyperEx 的杯内调流轨迹（liveFlowTrim.trace）不在本插件记录范围——那属于 HyperEx 的导出。
- 旧数据没有温度列时回放端按 null 断线。

## 验证

node tests/verify_v0100.cjs（30 项：生命周期、采样/封顶、前缀闸门立即保留、
包含式起始窗 + 长预热丢弃、4 杯裁剪、存储回读合并、导出经 archive-core 合并幂等、
卸载保全、秤流重连）。

