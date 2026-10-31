# HyperEx 1.94ds handoff — 2026-10-31

开发版，版本号 1.94ds（非严格 semver）。诊断页减压：STEP 4 折叠 + CSV 懒加载。

## 1. 当前状态

- 版本号：manifest.json = 1.94ds、plugin.js PLUGIN_VERSION = 1.94ds。
- 测试：tests/verify_v0194ds.cjs 569/569（RESULTS_v0194ds.txt）。
- 改动面：诊断页 STEP 4 结构与 CSV 取数时机。控制律、校准、学习、预设逻辑未改。

## 2. 背景

真机反馈：诊断页载入数据后滑动很慢，怀疑渲染压力大。

本机实测（Chrome headless，900 样本 + 900 原始秤重 + 220 条杯内调流点 + 30 杯历史，全折叠）：

- 载入脚本 12 ms、布局 6 ms、样式计算 4 ms、布局次数 6 —— 页面构建本身不重。
- 展开全部步骤后约 1,640 节点、508 个 SVG 节点、122 条 path、83 KB path 数据、页高 6,478 px。
- 同一页在 CDP trace 里滚动 1.2 s 的 Paint/Raster 合计只有个位数毫秒，说明 headless 环境测不出真机 WebView 的绘制成本，**这次没有拿到真机滑动的直接归因**。

## 3. 本轮改动

1. STEP 4（上一杯 CSV / 历史 JSON）从「stepHead + 两个 section」改成 `<details class="manualPanel" id="step4">`，默认收起，「复制 CSV」「导出历史 JSON」按钮仍留在页脚（`#diag` 外面那一行）。
2. CSV 懒加载：新增 `ensureCsv()`，只有 STEP 4 展开（toggle）或点「复制 CSV」时才 fetch `/diagnostics-csv`。整杯 CSV 常有几十万字节，以前一进页面就写进 textarea 参与排版。
3. 载入实测（同数据量）：脚本 12→7 ms、布局 6→5 ms、样式 4→3 ms，布局次数 6→5；折叠态节点数与页高不变。

## 4. 仍未定位的部分

滑动慢若在「全部收起」时仍然存在，就不是这几块的问题，候选按可能性排：

1. 图表绘制：`#weight-curves` 三张 SVG，整杯数据 100+ 条 path、80 KB 路径数据，弱 GPU 上滚动重栅格化会掉帧。
2. `background-attachment:fixed` 的双层渐变（1.92 加的底色兜底旁边）：部分 WebView 会因此关掉快速滚动路径。
3. 皮肤侧（Streamline）的覆盖层与滚动容器：诊断页在 iframe 里，真正的滚动可能由皮肤接管，插件管不到。

下一轮要定位，建议先在真机区分「全部收起 / 展开步骤 2」两种状态是否都慢，再决定是削图表点数还是换掉固定背景。

## 5. 真机待确认

1. 折叠态首屏是否只剩三步 + 实际秤重曲线 + 步骤 4 的折叠行。
2. 展开 STEP 4 后 CSV 是否正常出现；点「复制 CSV」是否能直接复制（未展开时应自动取数再复制）。
3. 滑动是否比 1.93ds 顺畅；若仍慢，请说明是「全部收起」还是「展开步骤 2」时慢。

