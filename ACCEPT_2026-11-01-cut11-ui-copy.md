# cut 11 验收 — 诊断页文案与补水折叠（v2.2.17，2026-11-01）

## 1. 结论

诊断页补水段的文案按 cut 10 口径改完：cutoff 标签改为「收回噪声底（%）」/ `Cutoff noise floor (%)` 并显示派生阈值；S2 补水从曲线编辑器里独立成一折、标题栏带状态；学习窗口措辞落到补水学习行；`controlOutputQuality` 增补窗口字段。`verify_v02217` 682/682。控制律、门槛、补水算法未改。

## 2. 范围

- 改的是**插件侧**页面模板与页面脚本（`plugin.js`），不是皮肤层。
- 只动文案、折叠位置、显示用的派生计算与导出字段；不写机器、不改 profile、不改学习结果。
- 版本 2.2.17；基线 HEAD `68d654e`；分支 `v1.79ds`。

## 3. 口径

- `cutoffPercent` 的新语义是**观测噪声底**：收回判据为 `observed ≥ target × cutoffFraction × 0.6` 且 `predicted ≥ target`（`s2RefillReturnReason` 现行实现）。85% 对应 51% 目标的实测门。
- 800 ms / 1500 ms 是补水后的**沉降排除**时长（`S2_REFILL_SETTLE_MS` / `S2_REFILL_CHAIN_SETTLE_MS`），不是测量窗长度；输出质量回归仍取沉降后窗口的末 60%。
- S3 文案沿 cut 7 口径：允许前段高于中段、后段低于中段，只限制相邻增幅。

## 4. 改动逐条

1. 滑块标签 `refillControlFields`：`称流速收回阈值` → `收回噪声底`。
2. 补水历史行前缀 `refillSettingsText`：`称流收回 ` → `收回噪声底 `。
3. 译文表：`Cup-flow cutoff` → `Cutoff noise floor`；`Cup cutoff ` → `Noise floor `。
4. 状态句重写（中英同步）：收回触发 `S2 refill reached predicted target with observed above noise floor`；跳过 `S2 predicted flow already at target; refill unnecessary`；可调补水 `... predicted target or safety deadline`；迁移警告 `... timing and noise floor retained`。
5. 折叠独立：`<details id="refill-settings">` 从 `#curveEditor` 内部移到其正后方；`#curverefill`、保存按钮、revision 不变；去掉与标题重复的内层「S2 提前补水」小标题。
6. 标题状态：`#refillstatus` 显示已保存值「收回噪声底 X% · 触发 ≈ Y% · 启动 Z s」，草稿脏时追加「· 草稿未保存」。
7. 派生行：`#refillderived` 显示「派生 实测 ≥ 51% 目标（≈ 2.55 g/s）· 预测 ≥ 目标（3.55 g/s）」，随滑杆与 S2 目标换算。
8. 学习行：`学习窗口：X s 起 · 排除补水 800 ms（链路 1500 ms）后 · 末 60% 回归`。
9. 导出字段：`controlOutputQuality` 增 `windowSettleMs` / `chainSettleMs` / `tailFraction` / `basisDetail`；`basis` 原字符串保留。
10. 折叠标题沿用 `S2 early refill` 的既有译文键，中文改为「S2 补水」。

## 5. 测试

- `tests/verify_v02217.cjs`：682/682（v02216 的 679 条 + 3 条）。
- 新增：折叠位置（`curverefill` 不在曲线编辑器内、`refill-settings` 在 PRESETS 之前、旧词已消失）、状态行与派生行、`controlOutputQuality` 的新字段（含收回未确认分支）。
- 改写既有：译文覆盖用例的标签对照、预览数值断言（`85 %` + 派生）、学习行断言、版本一致性。
- v02216 及更早测试与 RESULTS 原样保留；安全门测试零删除、零弱化；没有新增镜像断言。

## 6. 闭环数字

本版未改控制律，闭环基线不变：峰值过冲 +33.2%（绊线 ≤40%），平台 −19.3%，return 3.875。本版没有重跑闭环。

## 7. 真机交叉验证

未做。本版是页面文案 / 折叠结构 / 导出字段，真机要验的是版面与读数是否如设计（见 §9）。逻辑侧由 682 条测试覆盖；`controlOutputQuality` 的新字段用既有 `startupRun` 夹具验证了 800/1500/0.6 与 basisDetail。

## 8. 复现

```
cd D:/vscode/decenthyperexplugin
node decenthyperexplugin.reaplugin/tests/verify_v02217.cjs
```

页面侧复现：打开 DIAG / CAL → STEP 2 →「下一杯 · 曲线编辑」下方「S2 补水」。

## 9. 清单

- `decenthyperexplugin.reaplugin/plugin.js`（文案、折叠、派生行、学习行、导出字段、版本号）
- `decenthyperexplugin.reaplugin/manifest.json`（2.2.17）
- `decenthyperexplugin.reaplugin/tests/verify_v02217.cjs`
- `decenthyperexplugin.reaplugin/tests/RESULTS_v02217.txt`
- `decenthyperexplugin.reaplugin/README.md`（2.2.17 小节）
- `decenthyperexplugin.reaplugin/HANDOFF_v02217.md`
- 本文件

## 10. 限制

- 状态行与派生行带 `data-no-i18n`：英文界面下保持中文（与既有学习行一致）。英文只覆盖了滑块标签与四条状态句。
- 折叠默认收起；展开后的滑杆仍是原生 `input[type=range]`，没有改视觉皮肤。
- 补水预览图仍是原来的 SVG，没有并入本版的 canvas 改版（那属于 STEP 2 折叠与图表改版，另开版本）。
- 真机版面未目视验收；若状态行过长会挤到标题，实机上需要确认换行表现。
