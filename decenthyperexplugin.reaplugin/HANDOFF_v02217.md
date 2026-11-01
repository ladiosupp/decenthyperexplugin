# v2.2.17 交接 — cut 11 诊断页文案与补水折叠（2026-11-01）

完整验收见仓库根目录 `ACCEPT_2026-11-01-cut11-ui-copy.md`。这里只记接手要知道的。

## 一句话

诊断页补语文案：cutoff 改名为「收回噪声底（%）」并显示派生阈值；S2 补水从曲线编辑器里独立成一折、标题栏带状态；学习窗口措辞落到补水学习行；`controlOutputQuality` 增补窗口字段。控制律、门槛、补水算法一行没动。

## 版本与测试

- `plugin.js` 与 `manifest.json` = **2.2.17**；`tests/verify_v02217.cjs` = **682/682**；`RESULTS_v02217.txt` 已出。v02216 及更早的测试与 RESULTS 原样保留。
- 未 commit、未 tag、未推送、未发版。基线 HEAD = `68d654e`（UI spec 提交后），分支 `v1.79ds`。

## 接手要注意

1. **补水折叠位置**：`<details class="manualPanel" id="refill-settings">` 现在紧跟 `#curveEditor` 之后，是 STEP 2 顶层第 6 折；`#curverefill` 容器 id 没变，所以 `renderRefillEditor()`、保存按钮、revision 与 `refill-settings-save` 端点都不用改。别再把它塞回曲线编辑器里。
2. **状态行**：`#refillstatus` 在 summary 里右浮动，显示已保存值「收回噪声底 X% · 触发 ≈ Y% · 启动 Z s」，草稿与已保存不同时追加「· 草稿未保存」。它带 `data-no-i18n`，英文界面保持中文。
3. **派生行**：`#refillderived` 由 `renderRefillEditor()` 生成并更新，内容是「派生 实测 ≥ 51% 目标（≈ 2.55 g/s）· 预测 ≥ 目标（3.55 g/s）」。同样是中文固定文案，带 `data-no-i18n`。
4. **改名范围是 9 处**：滑块标签、历史行前缀、`Cup-flow cutoff` / `Cup cutoff ` 两条对照、四条状态句（含运行时的 `s2RefillReturnReason`、skip reason、basisReason 后缀、迁移警告）。只剩这些地方还有旧词就是漏了。
5. **`controlOutputQuality` 新字段**：`windowSettleMs` / `chainSettleMs` / `tailFraction` / `basisDetail`。`basis` 原字符串**故意没改**——回放脚本、台账和既有测试都在读它。
6. **S3 文案是 cut 7 的口径**：页面写的「S3 允许前段高于中段、后段低于中段；只限制相邻增幅」不要改回顺序约束；`curveLimits` 只限相邻增幅。
7. 折叠默认仍是收起的——状态行本来就是为了收起时也能看。

## 真机怎么验

1. DIAG / CAL → STEP 2 →「下一杯 · 曲线编辑」正下方应出现「S2 补水」折叠；标题右侧显示「收回噪声底 85% · 触发 ≈ 51% · 启动 0 s」。
2. 展开后拖动「收回噪声底」，派生行数字应随动（85% → 51%、≈2.55 g/s）；拖动任一滑杆后标题应出现「· 草稿未保存」，保存后消失。
3. 「上一杯补水节点」里学习行应显示「学习窗口：X s 起 · 排除补水 800 ms（链路 1500 ms）后 · 末 60% 回归」。
4. 导出 history JSON 查 `controlOutputQuality`：`windowSettleMs` 800、`chainSettleMs` 1500、`tailFraction` 0.6，收回未确认那杯也有前两个字段。
5. 英文界面：滑块标签应显示 `Cutoff noise floor`，状态行与派生行仍是中文（预期）。

## 待办

- 折叠版面在真机上的目视确认（本版没跑真机截图）。

## 发布记录（2026-11-01）

- commit `37b0566`，tag `v2.2.17`，分支 `v1.79ds` 已推送。
- GitHub Release：https://github.com/ladiosupp/decenthyperexplugin/releases/tag/v2.2.17（附件 `HyperExPulseFilter_v2.2.17.zip`，416,498 字节）。
- 夸克：`夸克网盘/来自：Codex/HyperExPulseFilter_v2.2.17.zip`，fileId `58e5d32ebb8a429790a2570d1ea7765b`。
- SHA256：`CC3CE326C231A20D32398C5749D095FE00B924D9026985B4F1A765AF1BD40810`。
