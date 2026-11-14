# HyperEx 2.2.46 交接：细研磨/尼龙滤纸现场数据驱动的五条控制优化

日期：2026-11-14（北京时间）。实验版本，尚未真机验证。

分支：auto-hyperex。基线：2.2.45（tag v2.2.45，提交 78c883a）。

## 0. 数据来源

归档 D:/vscode/.tools/hx-data/hyperex-history-all.json（100 杯，93 杯有全点）。本批分析的是最新 5 杯（2.2.45，auto）：

- 三杯完成的低压纸细研磨：11-11 23:07、11-12 23:22、11-12 23:32。S3 压力 0.94–0.98 bar 全程低于秤流 1.44–1.5 g/s，r≈1.28，新阻力桶 g9（p/q≈0.68）。
- 两杯 1μm 有机尼龙滤纸（全新、特别贴合）：11-11 23:15、23:24。S2 盲灌期压力 4 s 内 0.1→2.2 bar、8 s 到 8.4 bar，杯流始终为零，触发「>8 bar×3」中止。前 4 s 压力轨迹与低压纸几乎一致，第 5 s 后分岔：低压纸走平（粉层可渗透），尼龙杯单调爬升（下游堵死）。

分析脚本：D:/vscode/.tools/__hx-finegrind-*.js、__hx-refill-blind.js、__hx-s2-window-replay.js（只读归档，未入库）。

## 1. 五条改动（全部在插件侧 plugin.js）

### #1 盲灌压力保护
- 位置：s2RefillReturnReason。常量 S2_REFILL_BLIND_PRESSURE_BAR=2.5、S2_REFILL_BLIND_RISE_BAR=0.5。
- 逻辑：补水无有效杯流（s2RefillFlowEstimate 为 null 或 slope≤0）时，记录压力基线；压力 ≥2.5 bar 且 500 ms 内再升 ≥0.5 bar，返回 "S2 refill blind-flood pressure climb (no cup outflow)"，走既有两段断流收口。
- 边界：只在盲灌期生效；有杯流估计的正常上升不受影响。只收紧安全包线，灌水幅度仍由包线定（§22.11）。
- 真机意义：尼龙杯会在 ~2.5–3 bar 提前断流，不再骑到 8 bar。S2 限压 6 bar 时旧压力门（0.9×6=5.4）够不到，这条补上。

### #2 快杯 S2 学习窗
- 位置：controlOutputQuality（reducedWindow 回退）、gainStageObservation（reduced 标记）、updateGainMemoryFromRun（记 reduced）、gainConfidence（reduced 封顶 MEDIUM）。
- 逻辑：标准 1.2 s / R²≥0.90 窗无合格回归时，回退到 0.8 s / R²≥0.95 窗；标记 reducedWindow，观测带 reduced，置信度永不到 HIGH。
- 真机意义：23:07/23:22 两杯 S2 平台窗 1.176 s 全灭、no-observation；回退后可学，g9 的 S2 r 能积累样本。是降权不是墙（§22.8）。

### #3 收口后上行门
- 位置：liveTrimTick。常量 S2_POST_REFILL_UP_HOLD_MS=1500。
- 逻辑：refill-85 收回完成后 1.5 s 内、非接管期、非救急，decisionGS<target 且 reg.slope≤target×1.04 时，上行写入保持（reason "s2-post-refill-up-hold"）。下行与救急照常。
- 真机意义：治 23:07 那杯收口后 4.94→5.19→5.44→5.69 的预测追涨（杯流实际 5.2–5.7）。

### #4 S3 入段反向门
- 位置：liveTrimTick。
- 逻辑：S3 入段 3.5 s 内，reg.slope>target×1.2 且 decisionGS<target 时，禁止上行写入（reason "S3 entry overshoot; hold upward correction"）。
- 真机意义：治 23:32 那杯 S3 起点 raw 2.31 vs 目标 1.5 却 +4 档到 1.3125 的反向写。

### #5 中止杯研磨建议
- 位置：grindAdvisory 开头。
- 逻辑：assessRunLearningIntegrity 检出 execution-fault 时，返回 available:false / status:"aborted" / label「本杯压力异常中止：先查滤纸/粉层是否堵塞，再谈研磨」。
- 边界：仅对真正执行故障杯生效；未结束/普通杯（not-completed 但无 fault）不受影响，既有研磨建议测试照常通过。
- 真机意义：23:24 尼龙杯 p/q=1.18 给「接近合适：先保持」是误导；故障杯应指向滤纸/粉层。

## 2. 验证

- tests/verify_v02246.cjs **796/796**（787 基线 + 9 新增：#1 三条、#2 两条、#3 一条、#4 一条、#5 两条）。RESULTS_v02246.txt 已生成。
- node --check plugin.js 通过。
- 生成诊断页（buildGhcOverlayHtml）3/3 <script> 语法通过，页面版本 HYPEREX v2.2.46。
- profile 帧：auto 4 帧（S1=2 / release=0 bar / S2=5 / S3=1.5，限压 3/0/6/3），on/off 3 帧，校准 10 帧（≤20）。
- manifest.json version=2.2.46，description 已更新。

## 3. 不碰

LUT、S2/S3 目标与限压、补水幅度设置（floodMaxMlS/holdMs/cutoff）、皮肤、宿主。五条都是控制律/学习/诊断侧，不改 arming 与校准触发时机（§21 教训）。

## 4. 真机复测重点

1. 尼龙滤纸（或细研磨高阻）一杯：确认盲灌压力保护在 ~2.5–3 bar 提前断流，不再 8 bar 中止；诊断 trace 出现 "blind-flood pressure climb"。
2. 低压纸细研磨快杯：确认 S2 不再 no-observation，g9 的 S2 r 积累；reduced 观测置信度 MEDIUM。
3. 收口后 S2：确认不再出现 4.94→5.69 的连续上行追涨；trace 出现 "s2-post-refill-up-hold"。
4. S3 入段：确认高余波杯不再 +4 档反向写；trace 出现 "S3 entry overshoot"。
5. 中止杯诊断页：研磨建议显示「先查滤纸/粉层」，不再「接近合适」。

## 5. 回滚

切回 2.2.45 包（tag v2.2.45）即可。2.2.46 没有改 LUT、目标、限压、补水设置、皮肤或宿主。代码回滚不撤销已写进杯间学习的 reduced 观测（它们带 reduced 标记，置信度本就低）。

## 6. 发布记录（2026-11-14）

- 代码提交 63e788e，tag v2.2.46（annotated），分支 auto-hyperex 已推送（走 VPN 代理 127.0.0.1:57890）。
- GitHub Release：https://github.com/ladiosupp/decenthyperexplugin/releases/tag/v2.2.46 （Latest，非 draft、非 prerelease）。
- 附件：HyperExPulseFilter_v2.2.46.zip，487,623 字节。
- SHA256：5F1F469C022C4BB67E42CFFC9B704AD38986B41E0BDFF60A7F793425D65C655C。
- 夸克：夸克网盘/来自：Codex/HyperExPulseFilter_v2.2.46.zip，487,623 字节，fileId 8d95b183bd1b46798da9d647e72f9fd4。
- 包内复核：解压后 node --check 通过、tests/verify_v02246.cjs 796/796。
- 版本号说明：auto 分支已稳定，本版起按正常 semver 递增发布（2.2.46）；历史无「auto 尾数单数」成文规则，单双交替出现。
