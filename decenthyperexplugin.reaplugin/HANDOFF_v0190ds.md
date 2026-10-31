# HyperEx 1.90ds handoff — 2026-10-31

开发版，版本号 1.90ds（非严格 semver）。诊断页首屏结构。

## 1. 当前状态

- 版本号：manifest.json = 1.90ds、plugin.js PLUGIN_VERSION = 1.90ds。
- 测试：tests/verify_v0190ds.cjs 561/561（RESULTS_v0190ds.txt）。

## 2. 本轮改动

1. CSS 增加 body.diagview #title,body.diagview #detail{display:none}：诊断页不再显示标题与步骤说明；提示卡沿用同一批元素，不受影响。
2. STEP 2 由 div.stepHead 改为 details.manualPanel + summary.stepHead（id=step2），默认折叠，与 STEP 1 对称；学习历史与“下一杯 · 已应用曲线”收进折叠体内。

## 3. 坑

- step2badge 仍由 loadCal 更新，id 不能动。
- details 嵌套 details 合法，但缩进与闭合要数清楚；改完用浏览器解析一次页面脚本并截图。
