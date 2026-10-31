# HyperEx 1.91ds handoff — 2026-10-31

开发版，版本号 1.91ds（非严格 semver）。曲线编辑也折叠。

## 1. 当前状态

- 版本号：manifest.json = 1.91ds、plugin.js PLUGIN_VERSION = 1.91ds。
- 测试：tests/verify_v0191ds.cjs 562/562（RESULTS_v0191ds.txt）。

## 2. 本轮改动

1. 「下一杯 · 曲线编辑」由 section + h3 改为 details.manualPanel（id=curveEditor）+ summary.stepHead，默认收起，与 STEP 1/2 一致；内部内容与 id 全部保留。
2. 预设区仍是普通 section（不在折叠内）。

## 3. 坑

- 折叠后曲线图仍会在展开时按容器宽度绘制；未展开时 SVG 尺寸为 0，展开后需要一次重绘（现有 loadCal/renderCurveEditor 会在刷新时处理，真机确认一次）。
