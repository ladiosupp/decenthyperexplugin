# cut 13 验收 — STEP 2 折叠重排与字号统一（v2.2.23）

## 结论

诊断页 STEP 2 按示意图重排为 10 个统一折叠，标题行带状态；字号收口；控制律未动。`verify_v02223` 706/706。

## 范围

- 只改 `plugin.js` 的页面模板与页面脚本、`manifest.json`、测试与文档。
- 未改控制律、补水算法、S3 形状、学习门槛。

## 改动逐条

1. 新增 `.hxfold` 样式：48px 标题行、序号列、14px 标题、12px 等宽状态、`›` 折叠箭头、14px 内边距的正文区。
2. STEP 2 十个块统一为 `details.manualPanel.hxfold`，按示意图顺序排列；`#curveEditor`、`#refill-settings`、`#refillstatus` 等既有 id 保留。
3. 新增 `updateFoldStatuses()` 与 `lastDiagSummary/lastCommandFlows/lastLearningHistory/lastPresetData`，每 600 ms 刷新 10 条状态；`loadDiag`/`loadCal`/`renderPresets` 负责喂数据。
4. 字号只作用于 `.hxfold .fbody`：正文 13px、次要 12px、表格 12.5px。
5. 补 8 条折叠标题的中英对照；`STEP 2` 提示文案恢复为 2.2.22 原文（重组时误用了旧措辞，已改回）。
6. `manifest.json` 与 `PLUGIN_VERSION` = 2.2.23。
7. 曲线编辑器 SVG → canvas：按 800×232 逻辑坐标绘制网格、当前/草稿阶梯线与 5 个控制点；指针命中改成 30 逻辑像素半径测试，拖动沿用 `(190-y)/154*ymax` 换算；键盘 ↑/↓ 仍作用当前控制点。
8. S2 补水预览 SVG → canvas：画基线与阶梯指令、收回虚线；三行说明（boost/r 来源/接管值与收回判据）移到 `#refillpreviewlabels` 的 DOM 文本，便于读屏与断言。

## 测试

- `tests/verify_v02223.cjs`：706/706（v02222 原样复制后改 2 条结构断言、版本号与标题译文）。
- 改写：曲线编辑折叠断言（stepHead → 编号折叠）、补水折叠断言（按 id 而非整串 class 匹配）。

## 未做 / 限制

- 流量/角度/秤重仍有 canvas/SVG 切换按钮；本版只把曲线编辑器与补水预览固定为 canvas。
- 状态行为空时显示「—」，数据来自最近一次诊断摘要；换页后需等一次 400 ms 轮询或重新进页才刷新。
- 未做真机目视验收；版面以本地渲染截图为准。
