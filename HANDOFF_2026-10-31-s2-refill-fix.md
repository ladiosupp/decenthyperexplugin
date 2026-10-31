# HyperEx S2 补水/ S3 early 真机问题交接 — 2026-10-31

## 1. 现场结果

30 杯 history 中最后两杯是 2.2.0：

- run 1793456102926-1，result = Live flow driver write failed
- run 1793456227824-2，result = Live flow driver write failed

两杯 liveFlowTrim.status 都是：

    write-failed: rescueActive is not initialized

两杯学习排除原因是 not-completed + execution-fault / stage3 / Live flow driver write failed，不是学习判据主动排除。

历史审核入口：DIAG / CAL → 展开 STEP 2 · SHOT-TO-SHOT AUTO ADAPTIVE → ADAPTIVE HISTORY 下面再展开 Learning history · Exclude / restore shots。它是 STEP 2 内部的第二个折叠，不在“上一杯 · 验证结果”里。

## 2. S3 early 根因

杯内预测控制的压力/执行器门在 rescueActive 声明之前读取了 rescueActive。S3 early 的 actuator-low 路径触发 ReferenceError，外层 catch 调用 abortSequence，整杯中止。

修复：压力/执行器门移到 rescueActive 初始化之后。回归测试覆盖“S3 actuator-low 不再读取未初始化变量”。

## 3. S2 补水根因

两杯的补水计划：

    baseCommandMlS = 5.5
    refillPumpBaseMlS = 5.5
    targetPercent = 140
    boostCommandMlS = 7.6875
    holdMs = 2500

这等于把旧的 S2 手动 base 5.5 当成补水基准，再乘 140%，直接写成 7.6875。正确口径是：

    S2 目标杯流 = 5 g/s
    targetGS/r（无 r 时 LUT）才是把 5 g/s 翻译成泵指令的控制基准
    targetPercent 不再是泵指令倍率
    泵指令统一硬限 8 ml/s
    cutoffPercent 默认 95%（4.75 g/s），到 95% 交回正常 S2

shot 29 还出现 rawGS=3.994、predictedGS=13.12、thresholdGS=4.25 的提前收回；2 s 预测被短窗加速度放大。修复后收口要求实测斜率至少到 cutoff 的 95%，并且默认 cutoff 提高到 95%。

## 4. 2.2.2 口径

- 补水目标：S2 目标杯流 5 g/s。
- 实际泵指令：

      u = targetGS/r + (targetGS - f2)/r

  其中 f2 是 2 s 预测秤流量；u 夹在 targetGS/r 到 8 ml/s。
- targetPercent 在 bounded 模式不参与控制；旧 140% 归一到 100%。
- cutoffPercent 默认 95%（4.75 g/s），到 95% 交回正常 S2 控制器形成 5 g/s 平台。
- 过冲就下调 cutoff；到目标太慢就上调 cutoff。
- 旧 85% cutoff 在 bounded 模式迁移为 95%。
- 2 s 预测只用于提前收紧；不直接替代实测收口。

## 5. 版本与发布

- 2.2.0：杯间增益记忆 + 预测杯内 + S3 drift；有 S3 TDZ，已弃用。
- 2.2.1：修 TDZ；补水仍是旧的泵域倍率口径，已弃用。
- 2.2.2：当前版本，目标杯流域补水 + 8 ml/s 硬门 + cutoff 95%。

GitHub Release：

    https://github.com/ladiosupp/decenthyperexplugin/releases/tag/v2.2.2

包：

    HyperExPulseFilter_v2.2.2.zip
    SHA256 D7C34B4304193A5957D731AAF5DDD4E407B44FF5F00E2483A9B0C8501540028A

夸克：

    夸克网盘/来自：Codex/HyperExPulseFilter_v2.2.2.zip

## 6. 真机测试

1. 装 2.2.2。
2. 先 RETURN ALL TO LUT。它只清 manualTestOverrides 和 S3 shape，不清 adaptiveHistoryFileV2、gainMemory、学习审核记录或 LUT。
3. 保持补水 basis = 目标折算。
4. 看 S2 onset 后秤流速是否快速上升，到 4.75 g/s 左右交回，正常 S2 是否形成 5 g/s 平台。
5. 过冲则下调 cutoff；到 5 太慢则上调 cutoff，不要改 targetPercent。
6. 确认 S3 early 不再 abort；若仍 abort，导出 history JSON 的 liveFlowTrim.trace 最后几条。

## 7. 未完成

- 95% 阻尼的具体口径（是命令阻尼还是预测阻尼）仍需真机定。
- cutoff 的自适应学习尚未做；目前是手动可调交回点。
- 一致性门 VARIABLE/MIXED 还没有进一步降权。
- S3 drift 的 earlyFactor/drift 边界、救急 0.8 s/8–24 档、S3 4+2 预算仍需真机确认。
