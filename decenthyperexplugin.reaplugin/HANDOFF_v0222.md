# HyperEx 2.2.2 handoff — 2026-10-31

2.2.1 已发布，但 S2 补水仍把 targetPercent 当成了泵域倍率。2.2.2 按目标杯流域修正。

## 口径

- S2 补水目标固定为 S2 目标杯流 5 g/s；不是 LUT 指令，也不是 baseCommandMlS。
- 泵指令由控制律算，统一硬限 8 ml/s。
- targetPercent 不再参与 bounded 补水控制；旧 140% 在 bounded 模式归一到 100%。
- cutoffPercent 默认 95%（4.75 g/s）。到 95% 就交回正常 S2 控制器形成 5 g/s 平台。
- 过冲就下调 cutoff；到目标太慢就上调 cutoff。cutoff 是可调交回点，不是固定流量。
- 收口仍要求实测斜率至少到 cutoff 的 95%，避免 2 s 预测噪声提前收回。

## 改动

- 修复 2.2.1 的 S3 rescueActive TDZ（已在 2.2.1，但这里保留说明）。
- 补水控制基准 targetGS/r（无 r 用 LUT），targetPercent 只作旧版兼容，不再生成固定 boost。
- bounded 模式默认 cutoff 95；旧 85 在 currentS2RefillSettings 中迁移为 95。
- 补水 UI 在 bounded 模式隐藏旧 targetPercent 滑块；cutoff 保留可调。

## 测试

- tests/verify_v0222.cjs 620/620。
- node --check plugin.js 通过。
- 连续模式仿真跑通。

## 真机

1. 装 2.2.2。
2. 先 RETURN ALL TO LUT；不会清学习历史。
3. 保持补水 basis 为目标折算，先看 S2 onset 是否快速上升、到 4.75 左右交回，正常 S2 是否形成 5 g/s 平台。
4. 过冲就下调 cutoff；到 5 太慢就上调 cutoff。
5. 若 S3 仍 abort，导出 history JSON 的 liveFlowTrim.trace 最后几条。
