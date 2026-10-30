# HyperEx 1.82ds handoff — 2026-10-30

开发版，版本号 1.82ds（非严格 semver）。接在 1.81ds 之后，仍是本机 `v1.79ds` 工作区。

## 1. 当前状态

- 版本号：`manifest.json` version = 1.82ds、`plugin.js` PLUGIN_VERSION = 1.82ds、页面文本自动插值。
- 测试：`tests/verify_v0182ds.cjs` 540/540（`RESULTS_v0182ds.txt`）。
- 工作区未提交；未打包、未发 Release、未传夸克、未 push。

## 2. 本轮改动（只动诊断页，控制律未改）

1. 顶部左侧新增 `#close-top`「关闭／首页」按钮，与语言切换同一行（外层 row 改 `space-between`，语言行保留 `data-no-i18n`）；复用底部 `closeUi`，图标/文字跟随 `diagView`（诊断页 `CLOSE / HOME`，提示卡 `CLOSE`），中文页显示「关闭／首页」。
2. STEP 1 流量校准整块收进 `<details class="manualPanel">`，`stepHead` 变成 `summary`（徽标仍显示），`stepHint` 移到折叠内容里。
3. 「下一杯 · 已应用曲线」（含 READ RAW WORKFLOW 与原始 JSON）、「上一杯 · 启动指令快照」各收进一个 details；标题保留在 summary，内部 h3 删除避免重复。
4. S2 提前补水设置（`#curverefill`）收进 details，summary 用已有词条 `S2 early refill`。
5. 首屏顺序变成：曲线编辑（含曲线图）→ 上一杯验证结果 → 下一杯学习建议。
6. 关闭按钮右侧新增 `#jump-weight`「实际秤重曲线」按钮（文案复用 `REAL SCALE CURVES` 词条，与段落标题一致），点击 `scrollIntoView({behavior:'smooth'})` 到 `#weight-curves`（新增 id）；提示卡视图隐藏。两颗顶部按钮包在左侧一组里，避免 `space-between` 把跳转按钮推到中间。

新增文案只用已有 i18n 词条或中文原文，避免触发「中文静态页无英文散文」断言。

## 3. 待真机确认

1. 诊断页顶部关闭按钮在 Streamline overlay 与独立浏览器中都可用。
2. 折叠后首屏是否直接露出曲线、本杯验证与下一杯建议（1024×768 与平板竖屏各看一眼）。
3. 折叠状态下，曲线编辑的草稿与应用按钮仍可操作（`#curverefill` 只是包了 details，`refillsave` 在展开后可点）。

## 4. 坑与经验

- `plugin.js` 的超长单行模板用 Node 脚本按精确子串替换，先断言锚点存在；改完必须 `node --check`。
- 折叠的 `summary` 文案会被「中文静态页」断言扫描：不要新造英文短语，直接用已收录词条（`NEXT SHOT · APPLIED PROFILE`、`LATEST SHOT · COMMAND SNAPSHOT`、`S2 early refill`）。
- 顶层 row 嵌一层 div 后，测试里剔除语言行的正则会少吞一层 `</div>`，不影响断言，但改结构时要复跑。
- 版本号两种形态（`1.81ds` 与 `1\.81ds`）都要在 verify 副本里替换。
