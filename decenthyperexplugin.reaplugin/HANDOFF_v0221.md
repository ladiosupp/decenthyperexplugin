# HyperEx 2.2.1 handoff — 2026-10-31

2.2.0 真机两杯均在 S3 early 中止，history JSON 明确记录：

    write-failed: rescueActive is not initialized

这不是 raw socket、A010 编码或学习判据，而是新杯内代码的 TDZ：压力/执行器门在 rescueActive 声明前读取。两杯因此被标成 not-completed + execution-fault，不会进入学习。

## 2.2.1 改动

1. 把压力/执行器门移到 rescueActive 初始化之后，S3 actuator-low 路径不再抛 ReferenceError。
2. S2 补水改为有界控制律：
   - u* = targetGS / r；无 r 时用 LUT 映射；
   - targetPercent 只做上限，不再直接生成固定 boost；
   - 实际指令由 2 s 预测秤流量和 cutoffPercent 计算；
   - 统一受 8 ml/s 硬门、压力、ACK、写入预算；
   - 收口要求实测斜率至少到 cutoff 的 95%，避免预测噪声提前收回。
3. 杯内控制中心无杯间记忆时回到 LUT/目标基准，不拿手动 profile base 与补水基准互相打架。

## 测试

- tests/verify_v0221.cjs 620/620。
- node --check plugin.js 通过。
- 连续模式仿真跑通。
- 合成测试不等于真机；S2 onset 上升段和 95% 阻尼仍需真机确认。

## 真机测试

1. 装 2.2.1。
2. 先按 RETURN ALL TO LUT，清掉旧的 S2 手动 5.5；这不会清学习历史，只清 manualTestOverrides 和 S3 shape。
3. 保持 S2 补水为“目标折算”基准，先看 S2 是否不再冲到 7–8，且 onset 后能看到平台。
4. 跑一张熟悉纸，确认 S3 early 不再 abort；若仍失败，导出 history JSON 的 liveFlowTrim.trace 最后几条。
5. 观察 normal/rescue、silence holds、S3 writes 和 S2 cut-off 的 predictedGS/decisionGS。

## 回滚

- 2.2.0（有 TDZ，不建议继续真机）
- 2.1.3（稳定版，但没有新三层控制）
