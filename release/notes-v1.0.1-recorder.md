ProfileRecorder v1.0.1 — 归属判定提速 + 修长预热重叠。

- **曲线名前缀闸门**：标题不以固定前缀 `HyperEx` 开头的杯（如拉杆曲线）HyperEx 根本不会记录，本插件杯一结束**立即保留**，不跑探针、不查 HyperEx 状态——非 HyperEx 杯落盘从 12s 缩到 ~0s。
- **起始窗改包含式（修重叠）**：HyperEx 在确认出液才打开始时间，可能比 espresso 边沿晚一个预热段（冷机可超 5s）。旧 ±5s 紧窗会把这种 HyperEx 杯误留、与 HyperEx 自己的记录重叠；现改为「开始落在本杯 espresso 窗内（允许早 2s）+ 结束相差 ≤10s」，长预热也能正确匹配丢弃。
- 复杂检查（2/5/8s 探针 + 12s 超时兜底）只对带 `HyperEx` 前缀的杯跑；带前缀杯照旧 ~2s 丢弃。
- 其余口径不变：滚动留最新 4 杯全点；/history-export 与 HyperEx 同形，ProfileReplayer 按 runId 去重；只读，不写机器状态/曲线/设置。30/30 本地回归。

安装：Decaid → Plugins → Install plugin → GitHub Release → ladiosupp/profilerecorder（已装 v1.0.0 的会自动跟踪更新）；或下载本 ZIP 用 ZIP file 装。
