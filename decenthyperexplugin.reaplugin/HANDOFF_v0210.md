# HyperEx 2.1.0 handoff — 2026-10-31

图表渲染加 Canvas 2D / SVG 开关，默认 Canvas 2D。

## 1. 当前状态

- 版本号：manifest / PLUGIN_VERSION = 2.1.0。
- 测试：tests/verify_v0210.cjs 578/578（RESULTS_v0210.txt）。
- 改动面：诊断页图表渲染层。控制律、校准、学习、数据与导出未改。

## 2. 实现

- 页面状态 `chartEngine`，默认 `"canvas"`；标题下的 `#chartengine` 按钮在 canvas / svg 间切换，按钮文字随之显示 `CANVAS 2D` / `SVG`。
- `syncChartEngine()` 就地替换三个图元素（`flowchart` / `anglechart` / `weightchart`）：canvas ↔ svg，保留 id 与 class；切换后若已有 `lastChartRun` 立刻重绘。
- `renderChartAny(el, …)` 按元素类型分派：canvas 走 `drawChartCanvas`，其余走原来的 `renderChart`（SVG 实现原样保留，现有测试继续覆盖它）。
- `drawChartCanvas`：800×205 坐标系映射到元素 CSS 尺寸，按 devicePixelRatio 设位图；画坐标轴、刻度、各 series 折线、标记（圆点／↑↓箭头／菱形／方块／↻）；标记坐标缓存在 `cv._markers`，点击 14px 内最近者把 label 写进 `#flowpointdetail`。
- `clearChartEl()` 统一清空 canvas / svg；窗口 resize 时（仅 canvas 模式）160 ms 防抖重绘。

## 3. 取舍

- Canvas 不需要抽稀：900 点的折线一次 stroke 很便宜；SVG 模式仍保留 2.0.2 的包络抽稀（~380 顶点）。
- 切换状态不持久化（用户要求）：每次打开默认 Canvas。
- Canvas 下没有 DOM 级别的 hover/长按提示，交互统一为点击最近标记。

## 4. 验证

- `node --check` 通过；578/578。
- 本地预览（900 样本 + 220 条杯内点）：默认三个图都是 `CANVAS`，页面节点 1640 → 1180；截图曲线形状与 SVG 版一致（.impeccable/review/2026-10-31-canvas-charts.png）。
- 点按钮切到 `SVG`（88 条 path）再切回 `CANVAS`，两向都正常；点击 canvas 标记能把详情写进 `#flowpointdetail`。

## 5. 真机待确认

1. 默认进入是否为 Canvas；按钮点击能切换且图立即重绘。
2. 滚动是否比 2.0.2 更顺（重点看展开步骤 2 时）。
3. 点击曲线标记能否显示详情。

