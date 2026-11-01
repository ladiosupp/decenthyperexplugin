# v2.2.25 交接 — 诊断页 STEP 1/3/4 折叠、STEP 2 摘要行与补水两栏滑杆（2026-11-01）

状态：已改完。基线 HEAD = `f8506f8`（v2.2.24，707/707），版本 2.2.25。

## 用户口径

STEP 1/3/4 按 2026-11-01 确认的示意图落地统一折叠；图表引擎切换按钮**不删**；REAL SCALE CURVES 仍留在 STEP 2 外面。STEP 2 补顶部摘要行；补水面板改卡片式两栏滑杆（纯视觉，边界不写死）。

## 改了哪一侧

只改**插件**（`plugin.js` / `manifest.json` / 测试 / 文档）。控制律、门槛、补水算法、皮肤、宿主配置、Decaid 设置均未动。

## 改动

1. **STEP 2 摘要行**：`#step2summary`（`.hxsum`），在 STEP 2 折叠体顶部、第 01 折之前；由 `updateFoldStatuses()` 每 600 ms 填「上一杯 HH:MM / S2 实测 x.xx g/s / 下一杯状态 / 历史 n 杯」。下一杯状态取 `lastCommandFlows`：有 `manualCurveSource` 或 `adaptiveSource.runId` 显示「已应用」，否则「LUT」。
2. **补水面板**：`renderRefillEditor` 的 innerHTML 重排——基准改成并排两枚 `label` 包原生 radio（`data-refill-basis` 不变，`curveRefillBasisChange` 仍走原路径）；五项滑杆用 2 / 1 / 2 三行卡片（`.refillGrid` / `.refillRow` / `.refillField`），收回那一行独占整行并带 `#refillderived`；保存按钮改主色，外包 `.refillActions`。min/max/step 仍取 `curveLatest.refillLimits`。
3. **STEP 1** 五折：01 校准状态 / 02 水量·容器·水箱检查 / 03 校准模式与作用域 / 04 执行校准 / 05 校准表 LUT（全局三按钮收在末折）。
4. **STEP 3** 七折：01 参考建议 / 02 精确数值编辑 / 03 泄压模式与学习强度 / 04 目标与压力保护 / 05 杯内调流试验 / 06 泄压·秤·重试·诊断（含保存按钮、advancedmeta、startupbox）/ 07 直接驱动启动试验。03–07 包在 `<div id="advancedsettings">` 里（原 `<details>` 去掉，id 保留给测试定位）。
5. **STEP 4** 两折：01 上一杯 CSV / 02 学习历史 JSON；`#copy`、`#exporthistory` 从底部动作条移进对应折叠，底部只剩 `#rearm` / `#close`。
6. **状态行**：`updateFoldStatuses()` 新增 14 条 `st-*`；`loadCal` 存 `lastCalStatus`，`loadAdvancedSettings` 存 `lastAdvancedSettings`，其余读既有全局。
7. **译文**：新增 13 条（Last shot / S2 measured / Next shot state / History / Refill command ceiling / Calibration status / Calibration mode-scope / Run calibration / LUT table / Reference advice / Precise numeric editor / Release mode-learning strength / Targets-pressure safety / Direct driver start test）。第三段标签用「下一杯状态」而不是「下一杯」——后者既有词条会译成 `NEXT SHOT ONLY`。
8. **版本**：`PLUGIN_VERSION` 与 `manifest.version` → 2.2.25；测试 `tests/verify_v02225.cjs`（自 v02224 复制）。

## 坑

- `updateFoldStatuses()` 在 `loadDiag` 的 try 里被调用。新加的状态在数据未就绪时抛异常，会把整页诊断打断（本次踩过：`st-targets` 直接读 `set3.stage1Flow`，而 advanced-settings 还没回来）。空值一律先判断再取值。
- STEP 4 的结构测试按「第一个 `</details>`」切块；改成两折后必须换成配对扫描，否则切到的是第 01 折的收尾。
- 折叠标题是中文静态文案，新增就要补 `UI_LANGUAGE_PAIRS`，否则英文模式与静态页翻译扫描两条测试会红。
- 元素级截图要先 `scrollintoview`，否则截到的是视口空白。

## 测试

`tests/verify_v02225.cjs` = **707/707**，日志 `tests/RESULTS_v02225.txt`；`node --check` 通过。v02224 及其 RESULTS 原样保留。另外跑了 58 个被页面脚本/测试引用的 id 存在性检查（全在）与英文翻译扫描（0 条残留中文）。

## 待办

- 真机版面目视验收：2.2.23（STEP 2 十折）与 2.2.25（STEP 1/3/4）两轮 UI 都还没在真机上看过。
- 如需继续收 UI：可考虑把 REAL SCALE CURVES 也折起来（当前按用户口径保持独立区块）。

## 发布记录

（2026-11-01）

- commit `5915dd9`，tag `v2.2.25`，分支 `v1.79ds` 已推送。
- GitHub Release：https://github.com/ladiosupp/decenthyperexplugin/releases/tag/v2.2.25（附件 `HyperExPulseFilter_v2.2.25.zip`，435,258 字节）。
- 夸克：`夸克网盘/来自：Codex/HyperExPulseFilter_v2.2.25.zip`，fileId `0dbac42579d64227b39a78a3bddaaa37`。
- SHA256：`EF11C055D0788C60B926F06C06E3E0B1F7A9DEAF961CF3A1C0A827D9B770792B`。
- 打包：从 tag `v2.2.25` 的 `git archive` 构建（不压工作区），解压后 `node --check` 通过、复跑 **707/707**。
- 备注：本次夸克 MCP 的上传提交接口稳定返回 `203`（列表与详情正常，5 字节探针同样失败），改用官方 skill 的 CLI（`quark-drive upload`）完成，落在同一目录。
