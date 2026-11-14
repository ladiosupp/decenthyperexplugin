# HyperEx 离线仿真台

给算法调参用的本地仿真：加载**真实**的 `decenthyperexplugin.reaplugin/plugin.js`，用假宿主 + 虚拟时钟 + 对齐官方 mock 的水力模型跑完整一杯，不需要机器、Decaid 或网络。

## 运行

```
node sim/server.js
```

## 桌面入口（2026-11-14）

- `sim/make-desktop-shortcut.vbs`：双击一次，在桌面生成「HyperEx sim」快捷方式
  （已生成过就刷新）。
- 快捷方式 → `sim/launch-sim.vbs`：无黑窗。先探 4780 是否就绪；没起就隐藏启动
  `node server.js`（依赖只有 Node 本身，仿真核心全用内置模块，无需 npm install），
  轮询就绪后打开默认浏览器；Node 缺失或起不来会弹窗说明。服务已在跑时直接开页面，
  不重复起进程。
- 服务进程脱离启动器存活，关浏览器/关启动窗口不影响；要停服务就结束对应 node 进程。

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

## 纸种 / 泵预设（2.2.27 实测，2026-11-02）

官方 mock 的 4.2 rPeak 继续作为默认，用来回放 demo；真实纸的预设是 opt-in：

- 低压纸：plant: { paper: "low", pump: "realDe1" }
  - rPeak 0.26、cupGain 2.177、cupExp 0.524；2.2.27 以后十点拟合（R² 0.980，S2 尾段 + S3 MID，中位 3.4%）。
- 高压纸：plant: { paper: "high", pump: "realDe1" }
  - rPeak 0.53、cupGain 1.240、cupExp 0.796；2.2.27 23:06 实测 S2 r≈0.86。
- 泵：pump: "realDe1" = 0.35 s 死区 + 0.85 s 爬升 + 0.22/100ms（τ≈0.4 s）；默认 official 仍是 mock 的 0.35/100ms。
- 低 rPeak 时 rErode 会自动夹到 rPeak，避免官方 2.5 的侵蚀项在低压纸上把阻力反向抬高；paper 预设直接令 rErode = rPeak（不模拟侵蚀）。

命令示例（在 D:/vscode/decenthyperexplugin 下）：

node sim/harness.js '{"mode":"continuous","plant":{"paper":"low","pump":"realDe1"}}'
node sim/harness.js '{"mode":"continuous","plant":{"paper":"high","pump":"realDe1"}}'

这些预设仍只用于方向比较：S3 late 下漂不是官方侵蚀能表达的，绝对流量仍以真机为准。

### 纸况连续档（2026-11-04）

2.2.31 的相邻两杯（shot 30 / 31）给出了接近两端的真实状态：low 能跟住 shot 30 的
S2/S3 与时长，high 能跟住 shot 31 的 S3 与时长。单靠 low/high 只能夹住，不能表达
中间的纸况。`plant.paperCondition` 是 0..1 的连续档，0 = low，1 = high，中间线性
插值 rPeak / rErode / cupGain / cupExp：

```
node sim/harness.js '{"mode":"continuous","plant":{"paperCondition":0.65,"pump":"realDe1"}}'
```

它只改变植物，不反写插件；显式传 `cupGain` / `cupExp` / `rPeak` 仍可覆盖插值结果。

## 页面能做什么

- 改 S1/S2/S3 目标、触发重量、浸泡时间、调流档位、S2 补水五个参数、学习策略和植物参数。
- 三个图：杯流量 vs 阶段目标、累计重量、压力与指令；阶段底色区分 S1/S2/S3/泄压/浸泡。
- 摘要卡显示各阶段实测与差值、写入/检查次数、结束重量与用时、S2 补水计划。
- 「保存为对照」后，流量和重量图会叠加灰色虚线，方便比较两组参数。
- 「导出本次 JSON」拿到完整序列（series / writes / trace / summary），可以离线画图或做回归。

## 帧重放（/replay，2026-11-14）

独立的逐帧查看器，**不跑插件**：直接读历史归档（默认
`D:/vscode/.tools/hx-data/hyperex-history-all.json`，页面可改路径）里任意一杯的
全点数据，按原始帧回放。主页头部「帧重放 →」进入。

- 选杯：列出归档里有全点/事件的杯（逐帧杯用 `fullRecord.rawScaleSamples`，
  没有 raw 时退到 `samples`；只剩事件的杯显示事件时间线，点行看完整 data）。
- 播放：顺放 / 倒放 / 暂停、±1 / ±10 帧、首帧 / 末帧、上一个 / 下一个事件、
  0.1×–10× 变速、循环；进度条拖动、点曲线定位；快捷键 空格 / ←→（Shift ×10）/
  Home / End / PageUp / PageDown。
- 视图：三张曲线（杯流 decaid + 可选 RAW dW/dt 叠加、秤重 + 插件累计、
  压力 + 机器流量 + 目标指令）带当前帧游标与时刻标签；数值卡随帧刷新
  （相位 / 逻辑帧 / 物理帧 / tare 标记）；事件 + 调流 trace 合并时间线随帧高亮。
- 接口：`GET /api/frame/shots?file=`（杯列表）、`GET /api/frame/cup?file=&index=`
  （单杯全点 + 合并日志），只读、按文件 mtime 缓存。
- 回归：`node sim/tests/frame-replay-check.cjs`（需 server 在跑，18 项）。

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


## 回放插件导出的历史 JSON（hyperex-history.json）

页面「历史 JSON 路径」填插件诊断页导出的 hyperex-history.json（或任意同构导出），
点「载入历史杯」列出**保留了原始时序**的杯（被 detailRetention 裁掉时序的历史行
不可回放）。选中后机器按录制帧插值播放，且**带 phase 的录制会把真实状态序列喂给
插件**（stage1 → dumping/soak/restart_wait → stage2 → stage3 → finishing 对应
espresso / idle / soak / …），所以主动泄压双杯流程、GHC 重启、scale tare/reset
都能按录制的真实节奏复盘：

```
node sim/harness.js '{"replay":{"file":"C:/Users/ladios/Downloads/hyperex-history.json","index":0}}'
```

- 与官方 demo 录制不同，这里**不强制 continuous、不强制 11 bar**：保持插件默认
  压力保护（要放宽就传 hardPressureLimit: 11），机器状态完全按录制相位走。
- 重量用录制原始秤读数（weightG），插件在 tare/reset 时自己衔接累计（日志可见
  "Detected scale tare/reset … carrying cumulative"），与真机一致。
- 2.2.30+ 的导出把时序放在 `fullRecord.rawScaleSamples`；harness 现在会先解包
  `fullRecord`，顶层旧格式继续兼容。文件里没有可回放杯时 `runShot` 直接报错，
  不再静默退化成一次普通前向仿真。
- 回放跑的是当前 plugin.js（1.79ds），数值口径与录制当时（0.1.77）的分析可不同
  ——这正是复盘目的：看现在的控制/学习逻辑在真实曲线下会怎么判。

## warm start / handoff（2026-11-04）

回放默认全程用录制数据。要在某个真实相位后切回植物模型，传 `handoff`：

```
node sim/harness.js '{"replay":{"file":"C:/Users/ladios/Downloads/hyperex-history (7).json","index":2},"handoff":{"phase":"stage2","frame":1}}'
```

到该 phase/frame 时，机器状态、flow、pressure、weight 从录制接过来，粉饼时钟默认
设到 12 s（湿粉饼、阻力在 rPeak），之后由植物模型响应插件写入。`puckAgeSec` 可改
（0 = 干粉饼重新爬）。这样保留 S1 / 浸泡 / 重启的真实时序，只比较 S2/S3 的模型误差；
输出里的 `handoff` 记录切点，`replay` 元数据在切换后仍保留。

S3 形状可直接通过 `commands.shape` 给三段值：

```
node sim/harness.js '{"mode":"continuous","commands":{"enabled":true,"s1":1.938,"s2":4.313,"s3":0.625,"shape":{"earlyCommand":0.938,"earlySeconds":8,"midCommand":0.625,"midSeconds":14,"lateCommand":0.75}},"plant":{"paper":"low","pump":"realDe1"}}'
```

回归测试：

```
node sim/tests/sim-regression.cjs
```

## 边界

这是趋势工具，不是真机复现：没有 Decaid 的 profile 校验、上报时序、GHC 交互、真实泵/阀特性和秤的滤波延迟，也没有历史存储的异步行为。用它回答「这个参数会不会更容易过冲 / 补水是否太猛 / S3 投影会不会被抬回去」，不要用它断言某杯真机的绝对流量。回放模式是复盘工具，不承诺结局与真机一致（官方 demo 录制只到 34 g；hyperex 历史回放的压力保护/学习口径取决于当前插件版本）。

