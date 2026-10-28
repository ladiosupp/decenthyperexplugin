# HyperEx 离线仿真台

给算法调参用的本地仿真：加载**真实**的 `decenthyperexplugin.reaplugin/plugin.js`，用假宿主 + 虚拟时钟 + 简单水力模型跑完整一杯，不需要机器、Decaid 或网络。

## 运行

```
node sim/server.js
```

浏览器打开 http://127.0.0.1:4780 （只监听 127.0.0.1）。页面加载后会自动跑一次默认场景；改左侧参数再点「运行仿真」。

命令行跑一次：

```
node sim/harness.js '{"mode":"continuous","plant":{"efficiency":0.9}}'
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

## 植物模型（对齐 Decaid 的 mock DE1）

机器侧取自 Decaid 仓库的 `lib/src/models/device/impl/mock_de1/mock_de1.dart`：100 ms tick、流量按 0.35/tick 一阶逼近目标、压力线性于机器流量、到当前帧的 limiter（或 11 bar）时反向限制流量。杯流再把机器流量按标定锚点换算成 g/s：

```
machineFlow = 一阶逼近(command, 0.35/100ms)，经纯滞后
pressure    = B + K * machineFlow，超过当前帧 limiter 就压回流量
cupFlow     = interp_LUT(machineFlow) * efficiency
weight      = ∫ cupFlow dt + 称重噪声
```

- **效率**：100% 表示与标定一致；90% 模拟粉饼/泵/豆子导致的杯流产率下降。最常用的旋钮。
- **泵响应**：每 100 ms 向目标推进的比例，对应 Decaid mock 的 `flowResponseRate = 0.35`；调小更迟钝。
- **纯滞后**：命令到出流的传输延迟。
- **压力系数**：bar per ml/s。调大更容易先撞 limiter，从「能调」变成「压力受限」。

Decaid 的 `skipStep` 语义（推进一个 profile step、重置计时）、`espresso` 重置、`pouringDone → idle` 与 `state/substate` 字段名都按它的实现对齐。

## 页面能做什么

- 改 S1/S2/S3 目标、触发重量、浸泡时间、调流档位、S2 补水五个参数、学习策略和植物参数。
- 三个图：杯流量 vs 阶段目标、累计重量、压力与指令；阶段底色区分 S1/S2/S3/泄压/浸泡。
- 摘要卡显示各阶段实测与差值、写入/检查次数、结束重量与用时、S2 补水计划。
- 「保存为对照」后，流量和重量图会叠加灰色虚线，方便比较两组参数。
- 「导出本次 JSON」拿到完整序列（series / writes / trace / summary），可以离线画图或做回归。

## 边界

这是趋势工具，不是真机复现：没有 Decaid 的 profile 校验、上报时序、GHC 交互、真实泵/阀特性和秤的滤波延迟，也没有历史存储的异步行为。用它回答「这个参数会不会更容易过冲 / 补水是否太猛 / S3 投影会不会被抬回去」，不要用它断言某杯真机的绝对流量。

