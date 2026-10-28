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

## 植物模型

稳态杯流按标定锚点插值（0.569→1.5、0.719→2.0、2.507→5.0 g/s），再乘「效率」，然后过一阶滞后和纯滞后：

```
target = interp_LUT(command) * efficiency
flow   = 一阶滞后(target, tau) + 纯滞后(deadTime)
weight = ∫ flow dt + 称重噪声
pressure = B + K * flow
```

- **效率**：100% 表示和标定一致；90% 模拟粉饼阻力变化、泵衰减或豆子差异。这是最常用的一个旋钮。
- **时间常数 / 纯滞后**：模拟液压惯性。滞后越大，实时调流越容易过冲。
- **压力系数**：只影响压力曲线和限压保护是否触发，不参与杯流计算。

## 页面能做什么

- 改 S1/S2/S3 目标、触发重量、浸泡时间、调流档位、S2 补水五个参数、学习策略和植物参数。
- 三个图：杯流量 vs 阶段目标、累计重量、压力与指令；阶段底色区分 S1/S2/S3/泄压/浸泡。
- 摘要卡显示各阶段实测与差值、写入/检查次数、结束重量与用时、S2 补水计划。
- 「保存为对照」后，流量和重量图会叠加灰色虚线，方便比较两组参数。
- 「导出本次 JSON」拿到完整序列（series / writes / trace / summary），可以离线画图或做回归。

## 边界

这是趋势工具，不是真机复现：没有 Decaid 的 profile 校验、上报时序、GHC 交互、真实泵/阀特性和秤的滤波延迟，也没有历史存储的异步行为。用它回答「这个参数会不会更容易过冲 / 补水是否太猛 / S3 投影会不会被抬回去」，不要用它断言某杯真机的绝对流量。

