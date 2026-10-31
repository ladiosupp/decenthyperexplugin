# HyperEx 1.93ds handoff — 2026-10-31

开发版，版本号 1.93ds（非严格 semver）。修复诊断页顶栏预设快切按钮不显示。

## 1. 当前状态

- 版本号：manifest.json = 1.93ds、plugin.js PLUGIN_VERSION = 1.93ds。
- 测试：tests/verify_v0193ds.cjs 566/566（RESULTS_v0193ds.txt）。
- 改动面：诊断页预设栏渲染（页面脚本）。控制律、校准、学习、预设端点与落盘逻辑未改。

## 2. 现象与根因

真机（1.92ds）打开诊断页，顶栏「关闭 / 首页」「实际秤重曲线」右边不再出现 1–5 的圆形预设按钮。

1.89ds 引入顶栏快切时，`renderPresets` 的定义行末尾多了一句 `renderPresetBar(d)`，它落在函数体外：

```
function renderPresets(d){ ... }renderPresetBar(d)
```

- 这一句在脚本求值时立即执行，此时 `d` 解析成页面顶部已有的 `const d=$('detail')`。`renderPresetBar` 拿到的不是 `/presets` 的返回体，`Array.isArray(d.slots)` 为假，于是把 `#presetbar` 的 innerHTML 设成空串。
- 之后 `loadCal()` → `loadPresets()` → `renderPresets(json)` 正常把预设列表画进 STEP 2 的 PRESETS 块，但不再调用 `renderPresetBar`，所以顶栏永远空着。
- 因为 `d` 是真元素，这句不报错，控制台看不到异常；1.89ds 的测试只查字符串（存在 `presetslot--on` 等），没跑渲染路径，所以一直没抓住。

## 3. 改动（plugin.js 页面脚本三处）

1. 把 `renderPresetBar(d)` 移进 `renderPresets` 函数体，改为 `;renderPresetBar(d)}`，按本次 payload 刷新顶栏。
2. `renderPresetBar` 的槽位缺省改为 5 个空槽（`{slot:n,empty:true}`），`/presets` 失败或返回空也能看到整排描边按钮。
3. `if(diagView){renderPresetBar(null);loadDiag()}`：进诊断页先画空槽，不再等网络。

## 4. 验证

- `node --check decenthyperexplugin.reaplugin/plugin.js` 通过。
- 本地预览（vm 假 host → `__httpRequestHandler({endpoint:'ui'})`，桩化 fetch 返回 5 槽、1/3 已保存）：修复前 `#presetbar` 为空、宽 0；修复后 5 个按钮、2 个 `presetslot--on`，截图 .impeccable/review/2026-10-31-193-topbar.png。
- 新增 3 条测试：渲染路径（`renderPresets` 后顶栏必须有 5 个按钮、2 亮 3 灰）、空 payload 兜底 5 个禁用槽、结构守卫（不允许再出现函数外的 `}renderPresetBar(d)`）。
- 566/566 通过。

## 5. 真机待确认

1. 顶栏 1–5 是否恢复显示；有内容的槽位为琥珀实心，空槽描边禁用。
2. 点有内容的槽位是否仍按原流程（确认 → 写目标 → 插件重载 → 落地指令）。

