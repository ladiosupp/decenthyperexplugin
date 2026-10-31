# HyperEx 2.0.2 handoff — 2026-10-31

预设持久化修复、诊断页图表减压、中止原因可见。

## 1. 当前状态

- 版本号：manifest / PLUGIN_VERSION = 2.0.2。
- 测试：tests/verify_v0202.cjs 574/574（RESULTS_v0202.txt）。
- 改动面：预设回读、图表渲染、诊断页中止卡。控制律、校准、学习、安全联锁未改。

## 2. 预设存不住（已修）

症状：存了预设，重进诊断页就没了；换固件 / 跑完一杯后也一样。

根因：`host.storage` 回读的是**写入时的 JSON 文本**（其它键都用 `parseStoredJson` 处理），但预设分支写的是 `Array.isArray(value)`，字符串永远为假，于是 `state.presets = []`。待应用预设分支同理（`typeof value === "object"`）。

修法：两处都先 `parseStoredJson(value)` 再判类型；仍保留对象直通的兼容分支。

## 3. 诊断页载入后卡（图表侧减压）

真机「没数据很快、跑完一杯进去很卡」，指向数据渲染。实测量级（900 样本 / 220 条杯内点）：flowchart 451 节点、117 条 path、72 KB 路径数据、220 个 `<title>`。

- `svgPath` 内按 y 轴包络抽稀：每两条像素桶保留 min/max（保留尖峰），整条曲线顶点上限约 380；900 点实测路径数据 72→35 KB。
- 标记层封顶 160 个（均匀采样并保留最新一个），220→161 个 title、110→80 个 circle。
- CSS：`#flowchart/#anglechart/#weightchart` 加 `contain:paint;will-change:transform`，让三张大图各自成合成层，滚动时走位图合成。

注意：抽稀与封顶都写在 `svgPath` / `renderChart` **函数体内**，因为测试按函数行切片运行，helper 放外面会让旧测试拿不到。

## 4. S2 一启动就停（未定论，已加取证）

现象：从有背压的滤纸换无背压，跑曲线时 S2 刚切入就停。具体中止原因还没拿到。

已排查的候选（都是 `abortSequence(..., true)` → 请求 Idle）：

1. `Could not skip to 5 ml/s stage after restart: refusing skipStep because profileFrame=X, expected 0` —— 松粉饼重量上升快，restart 后观察到的帧号可能已不是 0。
2. `S2 refill ... ACK missing` / `S2 startup return write failed` —— 补水增强/收回写指令在 2 s 内没拿到 ACK。
3. `Live flow driver write failed` / `acknowledgement timeout` —— 杯内调流写失败。
4. `Machine returned to Idle before the programmed trigger` —— 机器侧自己停了。

本轮新增：诊断页「上一杯 · 验证结果」底部会有红色 **ABORT · <phase>** 卡，正文是该杯最后一次中止原因（来自 `run.learningExecutionFaults`）。下一次复现时直接看这一行即可定位。

## 5. 真机待确认

1. 存预设 → 重进诊断页，1–5 是否还在；跑完一杯后是否仍在。
2. 载入数据后滑动是否明显改善（对比 2.0.1）。
3. S2 早停复现时，ABORT 卡显示的原因是什么。

