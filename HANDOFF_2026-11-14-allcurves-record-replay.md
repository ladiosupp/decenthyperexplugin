# 交接：插件全曲线记录 + 回放配套（2026-11-14）

> 新对话目标（用户原话）：「配套插件增加所有曲线的记录和回放功能」。
> 即：把 Decaid 机器遥测里**还没记的曲线**（温度类、目标压力、机器秤流等）补进插件的逐点记录，
> 并让 ProfileReplayer App / PC 仿真台能回放它们。本文是现状盘点与落点，不是已定稿的方案——
> **动手前先按 AGENTS.md 第 20 条向用户确认改哪侧、改什么**；涉及控制律的改动先读技能第 22 节。

## 0. 开工前必读（按顺序）

1. `C:\Users\ladios\.codex\skills\decentplugin\SKILL.md` 第 19–22 节（本任务主要是记录/展示，
   不碰控制律；但若顺手动了 liveTrimTick / 学习 / 补水，必须先对照 §22 口径，冲突先问）。
2. 本文 + `HANDOFF_2026-11-14-profilereplayer-tablet.md`（真机无线调试已接通，含验证回执）。
3. 插件最新交接 `decenthyperexplugin.reaplugin/HANDOFF_v02246.md`（当前版本 2.2.46，
   五条控制优化已发版但**未真机验证**；真机复测重点见其 §4，别和本任务混在一起做）。
4. 仓库规矩：AGENTS.md 第 7 条四件事（git log / docs/plans / 文件级 log / git status）。
   插件目录是独立 git 仓（分支 auto-hyperex），工作区有别人未提交的改动（sim/、.tools/ 等），
   **只 add 自己这批**。发版走 `1.8xds` 流程：版本号、新 verify_vXXXX.cjs、RESULTS、README 小节。

## 1. 现状：已经记了哪些曲线

记录入口都在 `decenthyperexplugin.reaplugin/plugin.js`（约 887 KB，单文件）：

- **samples**（`diagnosticSample`，约 L2114）：默认 100 ms 节奏（设置 DiagnosticSampleIntervalMs，
  50–1000 可调），上限 3000 点/杯。每点已有：tMs、phase、machineState、substate、profileFrame、
  physicalProfileFrame、targetFlowMlS、desiredRealFlowGS、targetPressureBar、machineFlowMlS、
  machineTelemetryValid、machineAgeMs、pressureBar、machineWeightFlowGS、rawScaleWeightG、
  rawScaleDwDtGS、decaidWeightFlowGS、scaleWeightG/scaleFlowGS（旧别名）、cumulativeWeightG、
  scaleAgeMs、gflowToMachineFlow。
- **rawScaleSamples**（`captureRawScaleSample`，约 L6482）：秤快照驱动（Decaid 秤流约 10 Hz），
  上限 12000 点/杯。每点：tMs、phase、profileFrame、physicalProfileFrame、targetFlowMlS、
  machineFlowMlS、pressureBar、scaleTimestamp(Seconds)、weightG、rawDwDtGS、decaidWeightFlowGS、tareReset。
- **events**（diagnosticEvent）+ **liveFlowTrim.trace**（调流检查/写入/ACK 全轨迹）。
- 落盘：`fullShotRecord`（约 L1873）把四者打包进 rec.fullRecord；`historyExportPayload`（约 L1884）
  经 `/api/v1/plugins/decenthyperexplugin.reaplugin/history-export` 导出（schema:1）。
- **裁剪**（`trimHistoryFullRecords`，约 L1860；常量 L205）：全点只留最新 **4 杯**
  （HISTORY_FULL_SHOTS=4），trace/events 留最新 **10 杯**（HISTORY_TRACE_SHOTS=10），
  历史总量 80 杯。PC 轮询 2 分钟一次就是赶在裁剪前补全（见 tablet 交接 §3）。

## 2. 缺口：机器遥测里有、但没记的曲线

`extractMachine`（约 L6440）从 Decaid `GET /api/v1/machine/state` 只取了
state/substate/pressure/flow/targetFlow/targetPressure/weightFlow/profileFrame。
**2026-11-14 在平板真机实测该接口，还有这些字段没进记录**：

```json
{"mixTemperature":22.07, "groupTemperature":21.67,
 "targetMixTemperature":90.0, "targetGroupTemperature":90.0, "steamTemperature":31}
```

即：混合水温、冲煮头温、两个目标温度、蒸汽温——**五条温度曲线全缺**。
另外 samples 里已有的 targetPressureBar / machineWeightFlowGS / desiredRealFlowGS / gflowToMachineFlow
在回放端**没画**（见 §3）。

注意：rawScaleSamples 是秤快照回调里写的，那里只有 state.last* 缓存；温度要进 raw 行，
得先在机器快照处理处（约 L7685 / L9278 两处 state.last* 赋值）把温度缓存进 state，再在两个采样函数里带上。

## 3. 回放端现状（两条链路都要配套）

- **App**（`app/www/app.js` + `index.html`，WebView 壳）：chartDefs 约 L381，目前三张图——
  cFlow（decaid 杯流 + RAW dW/dt）、cWeight（秤重 + 插件累计）、cPress（压力 + 机器流量 + 目标指令）。
  加曲线 = 往 chartDefs 加 series / 加 chartbox；状态卡今天刚改成固定 6 列一行
  （容器查询字号，回归脚本 `.tools/__app-cards-row-check.js`，18 项），**加卡会破坏该回归，先问用户要不要加卡**。
  改完必须 `Copy-Item app/www/* app/src/main/assets/www/` 再 gradle 构建（路径见 tablet 交接回执，
  旧文档里的工具链路径少一层目录）。
- **PC 仿真台帧重放**（`sim/public/replay.js` + `replay.html`，回归 `sim/tests/frame-replay-check.cjs` 18 项）：
  与 App 同源的曲线定义，两边要同步加。
- **合并内核**（`sim/archive-core.js`，App 内嵌副本 `app/www/archive-core.js`，回归 13 项）：
  runId 去重、分量取最长，对新增字段透明（整行保留），一般不用动；动了就三份同步 + 跑回归。

## 4. 建议落点（待用户确认，不是定稿）

1. **插件侧**（plugin.js，走发版流程）：extractMachine 补温度字段 → state.last* 缓存 →
   samples / rawScaleSamples 各加温度列。旧数据没有这些列，回放端按 null 断线处理。
   schema 是否升 2 由用户定（现有消费方都按字段取值，加列不升 schema 也兼容）。
2. **回放侧**（App + PC replay）：新增温度图（实测两线 + 目标两线 + 蒸汽），
   把已记录未画的 targetPressureBar / machineWeightFlowGS 补进现有图或新图。
3. **裁剪口径**：加列后单杯体积变大（温度 5 列 × 3000 点 ≈ 每杯多几十 KB），
   HISTORY_FULL_SHOTS=4 与轮询 2 分钟的口径是否维持，问用户。
4. 验证：插件新 verify_vXXXX.cjs（基线 796/796）+ 真机一杯（无线调试已通，见 tablet 交接）
   + App/PC 回归 + 多分辨率布局回归（若动了 UI）。

## 5. 真机 / 数据链路现状（2026-11-14 15:30）

- 平板无线调试已配对：connect `192.168.31.15:46113`，Decaid 端口 8080，
  配置 `app/tools/tablet.json`；掉线 `adb connect` 即可，不用重新配对（配对弹窗必须亮屏保持打开）。
- PC 轮询 `app/tools/tablet-sync.ps1 -IntervalSec 120` 在上一对话常驻；新对话接手先确认它还活着，
  不在就重启。PC 归档 `D:/vscode/.tools/hx-data/hyperex-history-all.json`（102 杯 / 95 全点）。
- App 修复版已装机并传夸克（夸克网盘/来自：Codex/ProfileReplayer-v1.0-debug.apk，42,134 字节）。
- 真机插件版本 **2.2.45**（平板 Decaid 上跑的），仓库已到 2.2.46——新插件装机验证时注意版本差。
- 已知边界：App 的 takePending 只在冷启动合并（切后台回前台不触发）；是否补 visibilitychange 合并，
  上一对话已提出、用户未答复，别默默做。

## 6. 文件清单

- `decenthyperexplugin.reaplugin/plugin.js`：记录与导出（本任务主改动点）。
- `decenthyperexplugin.reaplugin/tests/verify_v02246.cjs`：最新回归基线 796/796。
- `app/www/`（app.js / index.html / archive-core.js）：App 网页源；assets 是打包来源。
- `sim/public/replay.*`、`sim/archive-core.js`、`sim/tests/*`：PC 回放与合并内核。
- `app/tools/`：tablet-connect.ps1 / tablet-sync.ps1 / tablet-pull-app-archive.js / tablet.json。
- `.tools/__app-cards-row-check.js`、`.tools/__app-tablet-fetch-check.js`：真机 CDP 回归（可复用）。
