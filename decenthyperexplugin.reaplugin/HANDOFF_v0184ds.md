# HyperEx 1.84ds handoff — 2026-10-31

开发版，版本号 1.84ds（非严格 semver）。接在 1.83ds 之后，本机 `v1.79ds` 工作区。

## 1. 当前状态

- 版本号：`manifest.json` version = 1.84ds、`plugin.js` PLUGIN_VERSION = 1.84ds。
- 测试：`tests/verify_v0184ds.cjs` 544/544（`RESULTS_v0184ds.txt`）。
- 打包 9 文件，根目录 `decenthyperexplugin.reaplugin/`。

## 2. 本轮改动（校准叠加 + 学习保活）

1. `mergeCalibrationMap(previous, next)`：按 `actualFlow` 合并两组点，相差 ≤ max(0.05 g/s, 2%) 视为同一点并取新值；其余旧点原样保留，新点追加；排序后强制 commandFlow 严格递增（冲突时新点优先，旧点丢弃并计数）。合并保留旧 `createdAt` 作为 LUT 身份，写入 `revisedAt` / `revision` / `merge{retained,added,replaced,droppedNonMonotonic}`，`actualRange` 取合并后的首尾。
2. `adoptCalibrationMap(next)`：有效校准时统一走合并落盘；只有**没有旧 LUT**（用户先 CLEAR CAL MAP 或从未校准）时才清空 `testOverrides` 与 `adaptiveHistory`。这就是“只有显式清空后才全盘清空”。
3. `numericLearningFingerprintKey` 去掉 `lutPoints` / `targetAnchors` / `lutSchema` / `lutAlgorithm`：重新测同一区间不再让旧学习作废；`mapCreatedAt`（身份）、`basketContext`、`baseFlowMultiplier` / `actualFlowMultiplier`、`activeRelease` 仍是硬门槛。单杯质量、R²、样本数、执行故障、命令/目标比例（0.5–2×）等门槛一律保留。
4. 诊断页 `calstatus` 增加 `LUT rev N · points K · range a..b g/s · merged: R retained, A new, P replaced`。
5. `calibrationStatusPayload` 增加 `lutRevision` / `lutMerge`。

## 3. 行为对照

- 改目标但不清空：曲线用既有 LUT 重新映射；已学习的覆盖指令仍是绝对 ml/s，不会自动缩放（1.83ds 起就是这样）。
- 新校准（不点 CLEAR）：点级合并，旧学习与覆盖保留，按质量门槛继续参与。
- CLEAR CAL MAP + 新校准：整份新 LUT，覆盖与学习历史清空（旧行为）。
- 目标超出合并后的量程：LUT 判不可用，三段 1:1 直给；扩量程要靠新的校准点覆盖到目标以上。

## 4. 待真机确认

1. 跑一次全量校准（不点 CLEAR），确认诊断页出现 `merged … retained/new/replaced`，量程变宽而旧段仍在。
2. 确认第二天的杯间学习仍能引用合并前的杯子（`ADAPTIVE HISTORY` 的 compatible 计数不归零）。
3. CLEAR CAL MAP 后再校准，确认覆盖指令与历史按旧行为清空。
4. 合并后同一目标（≤ 原量程）指令不变或只随新点微调，不应出现阶跃。

## 5. 坑与经验

- 合并判重用实际流量 2%，不要用指令；同一 plateau 的实测值本来就会漂。
- 点列表里的 `source` 字段只做审计；`calibrationPoints()` 与插值只读 actualFlow/commandFlow。
- 指纹里保留完整 lutPoints 供审计，但 `numericLearningFingerprintKey` 必须删掉它，否则合并会让历史全部失配。
- 新增测试要把 `mergeCalibrationMap` / `adoptCalibrationMap` 加进 verify 的注入清单。
