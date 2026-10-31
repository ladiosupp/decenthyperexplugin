# HyperEx 2.0.1 handoff — 2026-10-31

版本号改用标准 semver，从 2.0.1 起。诊断页 STEP 4 折叠 + CSV 懒加载。

## 1. 当前状态

- 版本号：manifest.json = 2.0.1、plugin.js PLUGIN_VERSION = 2.0.1。
- 测试：tests/verify_v0201.cjs 569/569（RESULTS_v0201.txt）。
- 改动面：版本号规则 + 诊断页 STEP 4 结构与 CSV 取数时机。控制律、校准、学习、预设逻辑未改。

## 2. 版本号规则（本轮改）

Decaid 的 GitHub Release 安装有硬校验，见 `lib/src/plugins/plugin_source_service.dart`：

- `_releaseTagPattern = ^v?\d+\.\d+\.\d+$`：标签必须是 `X.Y.Z` 或 `vX.Y.Z`，带任何后缀都拒；
- 去掉 `v` 后必须与 manifest 的 `version` 完全一致。

`v1.93ds` 因此报 `Release tag "v1.93ds" is not X.Y.Z or vX.Y.Z`。1.9xds 编号作废、不回填；新发版一律 2.0.1、2.0.2……，tag 与 manifest 同步。

版本比较（`plugin_version.dart`）对非 semver 会解析成 `[1,0]` 这类值，1.9xds 之间互相相等；换成 semver 后降级保护才真正生效。

## 3. 本轮改动（相对 1.93ds）

1. STEP 4（上一杯 CSV / 历史 JSON）从「stepHead + 两个 section」改成 `<details class="manualPanel" id="step4">`，默认收起；「复制 CSV」「导出历史 JSON」按钮仍留在页脚（`#diag` 外面那一行）。
2. CSV 懒加载：新增 `ensureCsv()`，只有 STEP 4 展开（toggle）或点「复制 CSV」时才 fetch `/diagnostics-csv`。
3. 注意：把 stepHead 换成 summary 时，原 stepHead 的收尾 `</div>` 要一起删掉，否则 details 会提前闭合、内容留在外面（本轮踩过一次）。

## 4. 背景与未定位项

真机反馈诊断页载入数据后滑动慢。本机实测（900 样本 + 30 原始样本 + 220 条杯内调流点 + 30 杯历史，全折叠）：脚本 12 ms、布局 6 ms、样式 4 ms；CDP trace 滚动 Paint/Raster 只有个位数毫秒 —— headless 测不出真机 WebView 的绘制成本，**没有拿到滑动慢的直接归因**。

若「全部收起」仍慢，候选按可能性：图表 SVG（122 条 path、83 KB 路径数据）→ `background-attachment:fixed` 双层渐变 → 皮肤（Streamline）覆盖层的滚动容器。

## 5. 真机待确认

1. GitHub Release 安装能否通过（tag `v2.0.1` / manifest `2.0.1`）。
2. 折叠态首屏：三步 + 实际秤重曲线 + 步骤 4 折叠行；展开 STEP 4 后 CSV 正常，点「复制 CSV」能自动取数再复制。
3. 滑动是否比 1.93ds 顺畅；若仍慢，请说明是「全部收起」还是「展开步骤 2」时慢。

