# HyperEx 1.86ds handoff — 2026-10-31

开发版，版本号 1.86ds（非严格 semver）。给 1.84/1.85 的合并与学习保活补上恢复入口。

## 1. 当前状态

- 版本号：manifest.json = 1.86ds、plugin.js PLUGIN_VERSION = 1.86ds。
- 测试：tests/verify_v0186ds.cjs 551/551（RESULTS_v0186ds.txt）。

## 2. 本轮改动

1. 端点 history-import（POST）：接受 {kind:'HyperExHistoryExport',shots:[...]} 或裸数组；按 runId 合并、同杯取新，按起止时间排序后保留最新 30 杯；写回 persistentHistoryFile 并调用 restoreAdaptiveHistoryFromPersistentFile()。要求 phase 为 idle 且存储已加载/自检通过，否则 409/503。
2. 端点 calibration-import（POST）：接受 {map:{...}}、裸 LUT {points:[...]} 或导出的 history（回退到最近一杯 fingerprint.lutPoints）；过滤数值（指令 0.1–8、实际流量 >0）、按实际流量排序、强制单调，少于 3 点拒绝；随后 adoptCalibrationMap 合并，返回点数、量程、可用性与合并计数。
3. 诊断页：STEP 1 增加 IMPORT LUT JSON 按钮与隐藏 file input；学习历史面板增加 IMPORT HISTORY JSON；各带一行状态文本（成功/失败原因）。
4. i18n 补两条（IMPORT HISTORY JSON / IMPORT LUT JSON），静态页断言仍过。

## 3. 使用与边界

- 备份优先级仍是文件级：退出 Decaid 后复制 %APPDATA%/net.tadel/Decaid/store/decenthyperexplugin.reaplugin.hive，恢复时覆盖回去。
- 导入 LUT 会与现有表合并（1.84 起的规则），不是替换；若要全新开始先 CLEAR CAL MAP。
- 导入只恢复数据，不会自动重写机器曲线；导入后走一次 SYNC HYPEREX 或等 idle 校验。
- 历史记录指纹里保留当时的 lutPoints，所以“先丢 LUT”也能从 history 反推。

## 4. 坑

- 导入要求存储已就绪：persistentHistoryLoaded、storageProbeVerified、persistentHistoryAvailable 不为 false，否则 503。
- 端点只接受空闲态，避免在萃取/校准中改控制状态。
- 页面脚本在模板字符串里，改完必须单独 new vm.Script(...) 解析；本轮漏过一次 }; 导致页面语法错误，测试里的 browser scripts compile 一条会报出来。
