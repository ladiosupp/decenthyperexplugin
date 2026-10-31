# HyperEx 1.89ds handoff — 2026-10-31

开发版，版本号 1.89ds（非严格 semver）。顶栏预设快切。

## 1. 当前状态

- 版本号：manifest.json = 1.89ds、plugin.js PLUGIN_VERSION = 1.89ds。
- 测试：tests/verify_v0189ds.cjs 560/560（RESULTS_v0189ds.txt）。

## 2. 本轮改动

1. 顶栏左侧新增 presetbar，由 renderPresetBar 渲染 1–5 五个小按钮：presetslot--on（琥珀实心 #efad56 配深字）与 presetslot--off（描边灰字、disabled）。
2. 点击有内容的槽位先 confirm（含目标与指令数值，走 HXLang 翻译 APPLY PRESET / 应用预设），确认后走 presets-apply。
3. 非诊断页（提示卡视图）隐藏 presetbar。
4. i18n 补一条 APPLY PRESET / 应用预设。

## 3. 行为

- 按钮状态随 /presets 返回刷新；保存或清除后即时更新。
- 应用仍是“写目标 → 重载 → 落地指令”，所以点完会看到插件重载。

## 4. 坑

- 顶栏在 520px 提示卡里会挤，已按 diagView 隐藏。
- 页面脚本在模板字符串里，不能出现反引号与美元花括号。
