# HyperEx 1.85ds handoff — 2026-10-31

补丁版，版本号 1.85ds（非严格 semver）。修 1.84ds 里合并后学习上下文被误判的问题。

## 1. 当前状态

- 版本号：`manifest.json` version = 1.85ds、`plugin.js` PLUGIN_VERSION = 1.85ds。
- 测试：`tests/verify_v0185ds.cjs` 546/546（`RESULTS_v0185ds.txt`）。

## 2. 本轮改动

1. `qualificationFingerprintKey` 删掉 `lutPoints` / `targetAnchors` / `lutSchema` / `lutAlgorithm`（与 `numericLearningFingerprintKey` 同口径），保留 `mapCreatedAt` 身份、篮型、倍率。
   - 1.84ds 的漏洞：Full 合并后点列表变了，`refreshLearningStage` 找不到兼容的咖啡行与 `coffeeQualification`，会把 `cfg.basketContext` 置为 "empty"，咖啡历史被跳过，直到重新积累两杯空篮。
   - 修复后：合并保身份，资格键不变，`NORMAL COFFEE · AUTO` 保持；新 LUT 身份（真正的新校准）仍会让资格失效。
2. 更新对应测试：点编辑不再翻转上下文，改 `createdAt` 才翻转。
3. 新增两条测试：资格键对点编辑免疫、Full 式合并后咖啡上下文与阶段保持。

## 3. 合并行为（1.84ds 起）

- 新校准按实际流量 2% 合并；重叠取新，其余保留；`createdAt` 不变，`revision` +1。
- 只有 CLEAR CAL MAP 后再校准（无旧图）才清空 `testOverrides` 与 `adaptiveHistory`。
- 目标超出合并后量程时整张 LUT 停用、三段 1:1；量程上下限都会校验（低端也看 0.92× 最小实测）。

## 4. 待真机确认

1. 不点 CLEAR 跑 Full：诊断页出现 `merged …`，量程变宽，`ADAPTIVE HISTORY` 的 compatible 计数不归零，阶段仍是 NORMAL COFFEE · AUTO。
2. 合并后把 S2 设 6、S3 设 2：`CALIBRATION READY` 保持，S1/S2/S3 都走 LUT（不再 1:1）。
3. CLEAR 后校准：覆盖与历史按旧行为清空。

## 5. 坑

- 两个指纹用途不同：数值学习用 `numericLearningFingerprintKey`，阶段/桥接用 `qualificationFingerprintKey`，两者都必须忽略 LUT 点，否则合并后行为不一致。
- 合并后同区间以新点为准；旧的三锚点若与新曲线单调性冲突会被丢弃（`droppedNonMonotonic`），量程本身不会缩。
