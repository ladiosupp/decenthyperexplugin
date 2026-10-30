# HyperEx 1.83ds handoff — 2026-10-31

开发版，版本号 1.83ds（非严格 semver）。接在 1.82ds 之后，仍是本机 `v1.79ds` 工作区。

## 1. 当前状态

- 版本号：`manifest.json` version = 1.83ds、`plugin.js` PLUGIN_VERSION = 1.83ds、页面文本自动插值。
- 测试：`tests/verify_v0183ds.cjs` 540/540（`RESULTS_v0183ds.txt`）。
- 打包 9 文件，根目录 `decenthyperexplugin.reaplugin/`。

## 2. 本轮改动（诊断页与数据行，控制律未改）

1. 诊断页样式块整段重写，按 bestpresso 皮肤对齐：diagview 全页暖深色渐变底；`card` 24px 圆角 + `rgba(255,255,255,.08)` 细描边 + 半透明渐变填充；Inter 字体；标题 600 字重、负字距；大数字 300 细体；胶囊按钮（`#efad56` 主操作配深字、暖灰次操作、描边第三级）；`manualPanel` 18px；统计格 16px；表格、文本域、图表容器统一。
2. 内联样式同步：`#brewingmode` 琥珀横幅 1px 描边、16px 圆角；ENTRY 说明与 `#historystatus` 改 4% 白；水温 preflight 改低饱和琥珀；高级设置里两块提示卡改 18px 圆角；checkbox / 滑块 accent-color 换成 `#efad56` / `#53d68e`。
3. 语言按钮选中态由内联 `#ff4fa3` 改为 `#efad56` 背景 + `#241a10` 字色，未选中为 6% 白。
4. `buildSkinSurfaceAnswer` 新增 `hyperex-flow-strip`：`stage2` / `stage3` 时推 `shot-strip`，三格 `REAL`（`state.liveTrim.lastCheckGS`）、`weightFlow`、`flow`（带 targetFlow 目标）；进 S2 起 `startFlowStripTicker()` 每秒 `emitSkinChanged`，`clearAllTimers` 清理，回 idle 由 `resetSequence` 撤下。连续模式（S1→S2）同样接上。

## 3. 待真机确认

1. 诊断页在 Streamline overlay 与独立浏览器里的观感（1280×900、1194×834、平板竖屏各看一眼）。
2. 折叠状态、曲线编辑、应用按钮、语言切换一切照旧。
3. S2/S3 出液时数据行显示 REAL / Weight flow / Flow 三个读数；关掉 live flow trim 时 REAL 显示 `—`。

## 4. 坑与经验

- 样式块在模板字符串里：CSS 中不能出现反引号与 `${}`，否则会截断模板。
- 测试会把 `<style>` 整段剥掉再扫文案，改样式不影响 540 条断言；改结构或文案才会。
- 语言按钮的选中底色是脚本里内联写的（`button.style.background=...`），只改 CSS 覆盖不掉，必须同时改那一行。
- `shot-strip` 的数字由皮肤自己画，插件只声明格子；只有插件自己的读数（REAL）需要定时推 `changed`。
- 版本号两种形态（`1.82ds` 与 `1\.82ds`）都要在 verify 副本里替换。
