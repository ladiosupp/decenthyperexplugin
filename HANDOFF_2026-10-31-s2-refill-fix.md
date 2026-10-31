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

## 8. 2.2.3（2026-10-31 夜）已发布

真机两杯在 S2 补水后 abort，报「S2 回落基础指令缺少驱动确认」。根因不是控制律，是档位：

- 2.2.2 的补水基准是 `target/r`（r≈1.254 → 3.9872），LUT 基值 2.507；都不是驱动 1/16 ml/s 的整档。
- 回落守卫要求指令是 1/16 整倍数且不小于基值，`2.507×16=40.112` 判无效 → `dispatchS2Startup(t,"return")` 静默 false → 2.5 s 后看门狗 abort，泵停在 8 ml/s。

2.2.3 的处理：

- 统一档位入口 `toDriverStep` / `snapCommandFlow` / `formatCommandFlow`；A010 帧、曲线 S1/S2/S3、S3 形状、两条校准曲线全部过这一层。曲线里现在是 2.5 / 0.75 / 0.6875 这类可执行值。
- 补水基准先归并档位，`r = target / 归并值`；回落基值同样归并，回落指令等于基值；越档回落兜底成基值，不再丢笔。
- 补水增强上限 8 → 控制基准 1.5 倍（r=1.25 时 6.0）。
- `predictionSeconds` 2.0 → 1.5。
- tests/verify_v0223.cjs 623/623；新增「任意指令编码后字节 = round(cmd×16)」与「曲线每段 flow 都在 1/16 档位」的不变量测试。

### 「2 s 惯性」的更正

- 不是官方文档，也不是泵转子惯性。12 杯 `machineFlowMlS` 按阶跃拟合：死区 0.35 s + 爬升 0.85 s + 一阶 τ，τ 中位数 0.4 s（0.2–0.8），RMSE 0.5–1.0 ml/s。
- 小台阶（≤0.7 ml/s）机器流量 0.02–0.27 s 到位；2 ml/s 台阶约 2 s。
- 旧记录「收后惯性 1.9–2.2 s」是 RAW 秤 1.2 s 滑动回归的峰顶时间，含约 0.6 s 窗口滞后，只对大台阶成立。

### 真机待确认（2.2.3）

1. S2 onset 后是否在 6.0 左右收住（不再顶 8），4.75 g/s 附近交回并形成 5 g/s 平台。
2. 杯流峰值 >5.5 g/s → 1.5× 或 1.5 s 仍偏激进，先回 2.0 s；收口太晚到不了 4.75 → 降到 1.2 s。
3. 若仍出现「S2 回落基础指令缺少驱动确认」，导出 history JSON 的 `liveFlowTrim.trace` 最后几条。

发布：GitHub v2.2.3（包 HyperExPulseFilter_v2.2.3.zip，SHA256 09DAD2F16F9ABB695E8A0A6751B023BDBC746F3406494C347C6E3230FF4032CD）。夸克上传当时返回 commit status 203，未完成。
