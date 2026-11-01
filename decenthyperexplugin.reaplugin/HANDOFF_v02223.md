# v2.2.23 交接 — STEP 2 折叠重排（2026-11-01）

完整验收见仓库根目录 `ACCEPT_2026-11-01-cut13-step2-folds.md`。

## 一句话

诊断页 STEP 2 从「6 个 details + 4 个裸 h3」改成 10 个统一折叠，标题行带状态；字号在折叠内收口。控制律一行没动。

## 版本与测试

- `plugin.js` 与 `manifest.json` = **2.2.23**；`tests/verify_v02223.cjs` = **706/706**；`RESULTS_v02223.txt` 已出。
- 未 commit、未 tag、未推送、未发版。基线 HEAD = `4c4d702`（v2.2.22 发布记录）。

## 接手要注意

1. 折叠结构：`details.manualPanel.hxfold`，summary 固定三段——`.fnum` 序号、`.fttl` 标题、`.fst` 状态。新增折叠沿用这个骨架。
2. 状态刷新：`updateFoldStatuses()` 每 600 ms 跑一次，读 `lastDiagSummary / lastCommandFlows / lastLearningHistory / lastPresetData`。这些全局由 `loadDiag`、`loadCal`、`renderPresets` 填充；新数据源要同时更新对应全局，否则状态停在「—」。
3. 折叠标题是中文静态文案，配了 8 条新译文；英文界面靠 `UI_LANGUAGE_PAIRS`，新增标题记得补对照，`verify` 里有静态页翻译扫描。
4. `#curveEditor` 与 `#refill-settings` 的 id 没变，曲线/补水相关测试与脚本不受影响。
5. STEP 1/3/4 的样式没动；`.hxfold` 的字号作用域只在其内部。

## 未做

- 本版把曲线编辑器与补水预览也换成 canvas（逻辑坐标 800×232 / 760×156，指针命中按逻辑像素半径）；流量/角度/秤重默认 canvas，右上角切换按钮仍在。
- 未在真机目视验收。
