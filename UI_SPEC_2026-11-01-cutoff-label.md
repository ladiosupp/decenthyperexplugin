# 诊断页文案 spec：cutoff 标签与 basis 文案（2026-11-01）

给改诊断页 UI 的对话。这是**插件侧**改动：文案在 `plugin.js` 的页面模板里，不是皮肤层。

## 基线

- HEAD `97a2db7`，v2.2.16 已入库，工作区干净（除别的对话的未提交文档）。
- 口径来源：技能 §22.5（cutoffPercent 新语义）、§22.9；审查文档 §9（cut 10 已把旧文案、新文案、落点写进去）。

## 要改的两处

1. **cutoffPercent 滑块标签**
   - 旧：「称流速收回阈值」（`Cup-flow cutoff` / `Cup cutoff`）。
   - 语义已变：cutoffPercent 不再是「实测到 X% 就收回」，而是**观测噪声底**——收回判据是 `实测 ≥ target×cutoffPercent×0.6` 且 `predicted ≥ 100% 目标`。
   - 新文案（cut 10 提案）：「收回观测底（%）」。英文同步，别只改中文。
   - 落点：`UI_LANGUAGE_PAIRS` 里的 `["Cup-flow cutoff", "称流速收回阈值"]` 等条目，以及补水编辑器的渲染函数（`renderRefillEditor` 的标签/提示）。

2. **controlOutputQuality 的 basis 文案**
   - 旧：`final60% of phase`（对 S2 已不准确）。
   - 现在有两套窗：测量窗 800 ms（`s2LearningWindow` 的 consumer 路径）与链路窗 1500 ms（`chainSettleMs`）。
   - 新文案要能区分：「末 800 ms 测量窗 / 链路 1500 ms」，取不到窗口时说明原因。
   - 落点：`UI_LANGUAGE_PAIRS` 与 `controlOutputQuality` 返回的 basis 字符串；翻译覆盖测试会断言这些条目，改完要同步测试。

## 交付与流程

- 版本 **2.2.17**（plugin.js + manifest）；`tests/verify_v02217.cjs`（v02216 原样保留）+ `RESULTS_v02217.txt`；README 2.2.17 小节；HANDOFF_v02217.md；`ACCEPT_2026-11-01-cut11-ui-copy.md`。
- 安全门测试不许删；翻译/标签覆盖断言按新文案更新。
- 做完把验收发回统筹：threadId `01a19567-d49b-7f92-b5bc-1d47ee45d4d1`。
- commit / tag / push / 发版：用户当次点头再做。
