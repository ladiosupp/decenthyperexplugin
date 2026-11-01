# v2.2.11 交接 — 杯间学习的封锁与门槛（2026-11-01）

## 0. 这一版是什么

cut 4：L-1/L-2/L-3/L-11/L-12 与 §6.2。只动杯间学习（增益记忆、质量门、known 窗），补水段与杯内控制律没碰。

## 1. 改了什么（全在 plugin.js）

- gainStageObservation：删 `chain.usable===false` 封锁；纹波 >25% 才 null、≥12% 标 damped；饱和时 local=true、alphaOverride=.55；删掉 cfg.stage2CommandMlS 回退（拿不到实际指令直接 null）。
- updateGainMemoryFromRun：damped → α 减半；alphaOverride 生效；偏差 >15% 或 local 时写 `lastLocalR`。
- normalizeGainMemory：保留 `lastLocalR` / `damped`（否则每次读档被剥掉）。
- gainMemorySuggestion：local 改用当杯 `lastLocalR`，local=true 置信度强制 LOW。
- nextShotAdaptiveSuggestion：不可采信的标量证据不再封锁 `gainMemory.applied`；target/r 照常应用，damped + 置信度降一级。
- known()：±20% → ±35%。
- gainMemoryQualityGuard / stageActuatorEvidence：欠跟踪分母换成实际生效指令（S2 effective / S3 逐帧 targetFlow），门槛统一 0.60/0.35/0.40。
- 版本 2.2.11。

## 2. 测试（651/651）

四条旧测试按新口径重写 + 新增 L-2 饱和链路测试（α=.55、local 当杯、LOW）。

## 3. 已知限制

- 补水段两处纹波门槛（15.6% / 12%）未动（归属）。
- 导出 JSON 不含 nextShotAdaptive / check 行，无法做逐杯回放交叉验证；本轮只能引用审查里的真机记录。

## 4. 发布状态

未提交、未打 tag、未推送。

