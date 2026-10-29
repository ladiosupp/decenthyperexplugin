# HyperEx 离线仿真台

给算法调参用的本地仿真：加载**真实**的 `decenthyperexplugin.reaplugin/plugin.js`，用假宿主 + 虚拟时钟 + 对齐官方 mock 的水力模型跑完整一杯，不需要机器、Decaid 或网络。

## 运行

```
node sim/server.js
```

浏览器打开 http://127.0.0.1:4780 （只监听 127.0.0.1）。页面加载后会自动跑一次默认场景；改左侧参数再点「运行仿真」。

命令行跑一次（默认 active 主动泄压；回放出杯用 `replay`）：

```
node sim/harness.js '{"mode":"continuous","plant":{"efficiency":0.9}}'
node sim/harness.js '{"replay":{"index":0}}'
```

自检（启动服务 + 取页面 + 跑一次）：

```
node sim/smoke.js
```

## 它是怎么跑的

`harness.js` 把 `plugin.js` 放进 Node 的 VM，注入测试钩子后直接调用插件内部的 `startSequence`、`onScaleSnapshot`、`handleStateUpdate`、`liveTrimTick`，所以跑的是真正的控制/学习代码，不是重写版。

- **时钟**：虚拟毫秒时钟 + 假 `setTimeout`，一杯 60 秒的仿真实际约 0.5 秒跑完。
- **宿主**：`host.storage` 内存存储、`host.transport` 记录 A010 写入并解码泵指令、`fetch` 接一个最小的机器 API（idle / espresso / skipStep）。
- **机器**：状态机由插件自己推（重量触发、skipStep、idle），仿真只回应命令并推进 profile 帧时间。
- **秤**：每 100 ms 一个样本，时间戳用虚拟秒，带可选高斯噪声。

## 植物模型（对齐官方 mock_de1 物理，2026-10-29 更新）

机器侧取自官方最新模拟器：Decaid `lib/src/models/device/impl/mock_de1/mock_de1.dart`
（即官网 Streamline demo `mock/de1-mock.js` 的移植来源）。100 ms tick、流量按
`flowResponseRate = 0.35` 每 tick 一阶逼近目标（flow 步不越过目标）、压力 = 流量 ×
**粉饼阻力**，阻力曲线 = rDry 0.10 → 12 s 三次方升到 rPeak（默认 4.2）→ 16 s 线性侵蚀到
rErode 2.5；帧 limiter 用官方 `_applyLimiter` 渐近逼近（不是硬钳），物理上限 11 bar
直接把流量反压回 `11 / 阻力`。杯流换算仍是用户 0.1.77 历史的 20 个稳态点拟合
（杯流 ≈ 1.883 × 机器流量^0.564，R² 0.984）：

```
machineFlow = 一阶逼近(command, 0.35/100ms)，经纯滞后
pressure    = 流量 × puckResistance(出杯秒数)，帧 limiter 渐近逼近，超 11 bar 反压流量
cupFlow     = 1.883 * machineFlow^0.564 * efficiency
weight      = ∫ cupFlow dt + 称重噪声
```

- **杯流产率**：整体缩放杯流，100% 是拟合值；90% 模拟粉饼/豆子变化。
- **杯流系数 / 饱和指数**：拟合曲线的两个参数。指数小于 1 是高流量饱和的原因，也是 S2 越推越不涨的根源。
- **补水倍率**：有两种基准。选「S2 目标折算」时，先用植物曲线把 S2 目标 g/s 反算成所需泵流速，再乘百分比（仿真侧控制）；选「基础泵指令」时沿插件 1.72 起的语义，按当前基础泵指令乘百分比。
- **泵响应**：每 100 ms 向目标推进的比例，对应 Decaid mock 的 `flowResponseRate = 0.35`；调小更迟钝。
- **纯滞后**：命令到出流的传输延迟。
- **阻力峰值**：粉饼阻力峰值 bar/(ml/s)，默认 4.2（官方 rPeak）。调大更容易先撞 limiter / 11 bar 反压，从「能调」变成「压力受限」。官方每杯还会随机乘 0.85–1.15，仿真固定 1.0 保证可复现。

Decaid 的 `skipStep` 语义（推进一个 profile step、重置计时）、`espresso` 重置、`pouringDone → idle` 与 `state/substate` 字段名都按它的实现对齐。

## 页面能做什么

- 改 S1/S2/S3 目标、触发重量、浸泡时间、调流档位、S2 补水五个参数、学习策略和植物参数。
- 三个图：杯流量 vs 阶段目标、累计重量、压力与指令；阶段底色区分 S1/S2/S3/泄压/浸泡。
- 摘要卡显示各阶段实测与差值、写入/检查次数、结束重量与用时、S2 补水计划。
- 「保存为对照」后，流量和重量图会叠加灰色虚线，方便比较两组参数。
- 「导出本次 JSON」拿到完整序列（series / writes / trace / summary），可以离线画图或做回归。

## 回放真实录制出杯

`sim/data/sim_shots.json` 是官网 Streamline demo `mock/seed/sim_shots.json` 的 3 段
**真实录制出杯**（约 30 s、压力到 9 bar、重量约 34 g）。选「回放出杯」后机器不再跑
植物模型，flow / pressure / weight / weightFlow 按录制帧插值播放，插件照常跑整套
分析（阶段回归、补水、求写、诊断）——用来复盘真实曲线下插件会怎么做。

- 回放强制 continuous（录制是一段完整出杯，不走主动泄压的双杯流程）；机器数据不随
  插件写指令变化（复盘语义，机器已经「发生过」）。
- 回放默认把插件压力保护上限放到机器物理包线 11 bar（避免 9 bar 录制触发 8 bar
  紧急中止而看不到分析）；想验证真实保护行为，传 `hardPressureLimit: 8`。
- 录制只到 ~34 g，S2 触发 40 g / 100 g 结束不会走到，插件会如实停在录制能提供的阶段。

## 边界

这是趋势工具，不是真机复现：没有 Decaid 的 profile 校验、上报时序、GHC 交互、真实泵/阀特性和秤的滤波延迟，也没有历史存储的异步行为。用它回答「这个参数会不会更容易过冲 / 补水是否太猛 / S3 投影会不会被抬回去」，不要用它断言某杯真机的绝对流量。回放模式是复盘工具，不承诺结局与真机一致（录制只到 34 g，且插件对 >8 bar 的保护行为取决于传入的 `hardPressureLimit`）。

