# HyperEx 2.2.3 handoff — 2026-10-31

2.2.2 真机两杯在 S2 补水后中止，结果都是「S2 回落基础指令缺少驱动确认」。

## 根因

- 2.2.2 的补水基准是 `target/r`（r≈1.254 → 3.9872），LUT 基值是 2.507；两者都不在驱动的 1/16 ml/s 档位上。
- 回落下发前有一道守卫：指令必须是 1/16 整倍数且不小于回落基值。`2.507×16=40.112` 直接判无效，`dispatchS2Startup(t,"return")` 静默返回 false。
- 回落一笔都没写出，2.5 s 后看门狗 `S2 startup base return driver ACK missing` abort，泵一直停在补水那笔 8 ml/s。

## 2.2.3 改动

- 新增 `toDriverStep`（就近归并 1/16）、`snapCommandFlow`（归并 + 夹 0.1–8）、`formatCommandFlow`。
- 所有写入面统一走档位：A010 编码器、补水增强/回落下发、`profileObject` 的 S1/S2/S3 与 S3 三段、`calibrationProgram` 与两条校准曲线。
- 补水控制基准先归并档位，`r = target / 归并值`；回落基值同样归并，回落指令与基值严格相等。
- 若计划里出现越档或略低于基值的回落指令，直接兜底成基值，不再静默丢弃。
- 补水增强上限从 8 ml/s 压到控制基准的 1.5 倍（r=1.25 时为 6.0）。
- 补水预测窗 2.0 → 1.5 s。

## 关于「2 s 惯性」

- 不是官方文档数字，也不是泵转子惯性。对 12 杯 `machineFlowMlS` 按阶跃拟合：死区 0.35 s + 爬升 0.85 s + 一阶 τ，τ 中位数 0.4 s（0.2–0.8），单杯 RMSE 0.5–1.0 ml/s。
- 小台阶（≤0.7 ml/s）机器流量 0.02–0.27 s 到位；2 ml/s 的台阶要约 2 s。之前记的「收后惯性 1.9–2.2 s」是 RAW 秤 1.2 s 滑动回归的峰顶时间，含约 0.6 s 窗口滞后。

## 测试

- tests/verify_v0223.cjs 623/623。
- 新增不变量：任意指令编码后字节 = round(cmd×16)；HyperEx 与两条校准曲线每段 flow 都是 1/16 整倍数。
- 新增回归：bounded 补水回落指令在档位上且可下发；越档回落自动兜底到基准。
- node --check plugin.js 通过。

## 真机

1. 装 2.2.3，先 RETURN ALL TO LUT（不清学习历史）。
2. 保持补水 basis = 目标折算。
3. 看 S2 onset 后是否到 6.0 左右就收住（不再顶 8），4.75 g/s 附近交回，S2 是否形成 5 g/s 平台。
4. 若杯流峰值 >5.5 g/s，说明 1.5× 上限或 1.5 s 前瞻仍偏激进，先回调 `predictionSeconds` 到 2.0 再试。
5. 若收口后杯流迟迟到不了 4.75，把 `predictionSeconds` 降到 1.2。
6. 若仍出现「S2 回落基础指令缺少驱动确认」，导出 history JSON 的 `liveFlowTrim.trace` 最后几条。

