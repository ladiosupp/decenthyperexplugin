# HEC 档提案交接（2026-11-15，未实现，待用户确认）

> 分工（用户 2026-11-15 点名）：**本对话只改插件端**；APK（HyperExControler）端由另一对话负责；
> 本文「两边同步事项」每轮更新，交中立对话评估。本文是设计提案，**plugin.js 一行未改**。
> 口径来源：decentplugin 技能 §22（尤其 §22.10 分工、§22.15 外部介入开关）、
> HANDOFF_2026-10-31-design.md、HANDOFF_v02238.md（现有 full/off 实现）。

## 0. 一句话

算法介入开关从两档（full/off）扩成三档（**full / hec / off**）。HEC 档：插件保留全部监护、
检测、记录与杯间学习，**自己一笔 A010 都不写**；调流指令由 APK 经插件新增 HTTP 端点「发进来」，
插件校验后代写（单一写者不变），写入照常进 trace / ACK / 学习证据链。

## 1. 为什么选「插件代写」而不是「APK 直写 raw」

- 用户原话「调流指令交给 apk 发进来」= 指令进插件，插件执行。
- 单一写者保住现有 ACK / 2 s 超时 / pending 串行 / 写入预算 / 看门狗整套机器，不用在 APK 重建。
- 学习证据链（liveTrimChainEvidence / liveTrimLearningView / machine-target-response）
  全部按 trace 里的 write 行工作；代写让外部指令天然进链，**不需要改学习算法**。
- 回环 HTTP 延迟毫秒级，相对固件 ~1.2 s 泵滞后忽略不计。
- APK 直写 raw 的备选被否：双写者冲突、安全包线要在 APK 重建、学习 trace 缺外部写入。

## 2. 三档行为矩阵

| 行为 | full（现状） | hec（新增） | off（现状） |
|---|---|---|---|
| 插件杯内写 A010（正常/救急/补水） | 有 | **无** | 无 |
| 外部指令代写（新端点） | 拒绝 | **接受** | 拒绝 |
| 杯内检测 / trace / 趋势角 / 局部增益 | 有 | 有 | 有 |
| 阶段跳转 / Idle / >8 bar×3 / 最长运行 / 帧确认 | 有 | 有 | 有 |
| 看门狗（外部指令超时回基值，新增） | — | **有** | — |
| observationOnly / 杯间学习 / 自动下一杯 | 参与 | **参与** | 排除 |
| 校准 | full | full（校准强制 full，现状） | full |

锁存口径沿用 §22.15：模式开杯时锁进 run.config.algorithmIntervention，运行中改 settings 不影响本杯；
control-mode 仅空闲可改（409）。存储键不变（algorithmInterventionV1），旧值 full/off 原样兼容。

## 3. 插件侧改动清单（全部在 decenthyperexplugin.reaplugin/，走 1.8xds 发版流程）

1. normalizeAlgorithmIntervention：接受 "hec"（其余非法值仍归 full，现状口径）。
2. stage2StartupPlan / dispatchS2Startup / liveTrimGovernor / liveTrimTick 的写闸：
   off 的守卫扩成「非 full 不写」；hec 的 observe 行 reason 记 hec-external-only。
3. 新端点 POST external-flow：校验（见 §4）→ 复用 pending/ACK 机制代写 A010 →
   liveTrimRecord("write",{...,external:true})；返回执行结果或 409+原因。
4. 新端点 GET external-status：APK 决策上下文 + 连接/预算/看门狗状态（见 §4）。
5. 看门狗：liveTrimTick 内，stage2/3 期间距上次外部写入 > HEC_WATCHDOG_MS（提案 4000）
   且当前指令 ≠ 曲线基值 → 代写基值一笔，记 watchdog 事件；APK 可继续发指令覆盖。
6. observationOnly 仍只对 off 为 true → hec 杯进学习、进自动下一杯（不改学习算法）。
7. compactPersistentShotRecord / history-export：algorithmIntervention 字段自然带 "hec"；
   trace write 行带 external:true（加列不升 schema，消费方按字段取值，兼容）。
8. UI：算法介入滑块改三档（样式复用泄压模式三态滑块）；HEC 蓝色主题；
   HEC 档卡片下加一条状态条（连接心跳 / 上一杯外部写入·拒绝·看门狗计数 / 本杯预算），
   全部状态标注，无操作说明小字（AGENTS 17）。i18n 增补对应词条。
9. control-mode / calibration-status / uiStatusPayload 的 algorithmIntervention 三态透传。
10. tests/verify_v02248.cjs：801 基线全保留 + 新增（三态归一/锁存、hec 不写、代写校验各拒绝分支、
    代写进学习链、看门狗回基值、off/full 行为逐字不变、UI 三态、旧存储值兼容）。
11. 版本 2.2.47 → 2.2.48；README 小节；RESULTS_v02248.txt。

**不碰**：arming/GHC、泄压模式、LUT/校准、预设、曲线编辑、皮肤、宿主、sim/、app/。

## 4. 两边同步事项（交中立对话评估；APK 对话按此实现）

### 4.1 模式切换
- POST /api/v1/plugins/decenthyperexplugin.reaplugin/control-mode，body {"mode":"hec"}（或 full/off）。
- 仅空闲返回 200；运行中 409。GET 同路读当前/本杯锁定值。下一杯生效。
- APK 启用 HEC  UI 前先 GET /status 或 control-mode 核对 pluginVersion ≥ 2.2.48。

### 4.2 调流指令（APK → 插件）
- POST .../external-flow，body {"command": <ml/s>, "frame": <逻辑帧，可省略>}。
- command 单位 ml/s，插件按 1/16 量化；硬边界 0.10–8.00，越界 409。
- frame 省略 = 用当前帧；给了但与当前逻辑帧不符 409（防跨帧写）。
  逻辑帧口径：S1=0（连续模式）、S2=1、S3=2/3/4；物理帧映射由插件按泄压模式做，APK 不碰物理帧。
- 拒绝分支（409 + reason）：非 hec 档 / 非萃取中 / 帧不符 / 越界 / 预算耗尽 /
  上行且压力 ≥ 限压×0.90（下行不限，与内部补水门同口径）/ 遥测过期。
- 200 返回 {ok, commandMlS, frame, writes, maxWrites}；ACK 由插件异步收，APK 不直接碰 BLE。
- 预算复用现有档位滑块（50/150/200/250 笔/杯），耗尽 409。

### 4.3 决策上下文（插件 → APK）
- GET .../external-status，建议 300–500 ms 轮询（兼作连接心跳）：
  {mode, phase, logicalFrame, physicalFrame, layout, targetGS, baseCommandMlS, lastCommandMlS,
   pressureBar, limiterBar, machineAgeMs, scaleAgeMs, rawGS(最近回归), writes, maxWrites,
   lastExternalAtMs, watchdogCount, rejectCount}。
- 秤流/压力原始流 APK 仍可自取 ws/v1/scale/snapshot、ws/v1/machine/snapshot（Decaid 官方通道，
  与插件同源）；external-status 只给插件口径的汇总，避免 APK 重算回归。

### 4.4 看门狗与失联
- stage2/3 期间 4 s 无外部指令且指令 ≠ 基值 → 插件代写基值收回，watchdogCount+1。
- APK 前台被杀 / 切后台被节流时由此兜底；APK 恢复后读 external-status 的 lastCommandMlS 重新接管。
- 4000 ms 为提案值，中立对话可调；常量 HEC_WATCHDOG_MS 单点定义。

### 4.5 学习口径
- hec 杯 observationOnly=false，进杯间学习与自动下一杯；trace write 行 external:true 可区分。
- 增益指纹（adaptiveHistoryFingerprint）**暂不加模式维度**：hec 与 full 杯共享增益记忆
  （用户要学习连续）；每杯记录 algorithmIntervention 供事后分离分析。是否加维度交中立评估。
- HEC 档插件补水计划禁用；APK 若自做灌水，经 external-flow 发（上限 8.00 同硬边界），
  S2 学习窗按现有 plateau 检测自适应，不依赖插件补水事件。

### 4.6 传输与权限
- 插件端点无 CORS 头：APK 的 WebView 不能直接 fetch，走原生 HTTP（现有 HxBridge 同款模式）。
- 无鉴权（回环本地，与现有全部插件端点一致）；APK 与 Decaid 同机 127.0.0.1:8080。
- 端点 body 上限走 Decaid 小 body 64 KiB，指令 JSON 远小于。

## 5. 开放问题（请中立对话 / 用户拍板）

1. 看门狗 4 s 与「回基值」动作是否合适（备选：回基值后暂停接受外部指令 N 秒）。
2. 增益指纹要不要加 hec 维度（提案：不加，保学习连续；风险：外部控制律风格差异混入记忆）。
3. 上行压力门 0.90×限压 是否照搬内部口径（提案：照搬）。
4. external-status 轮询 300–500 ms 是否够（APK 决策周期若 200 ms，上下文可略旧，原始流自取补）。
5. HEC 状态条字段取舍（示意图见 review/hec-mock/）。

## 6. UI 示意

- 稿子：review/hec-mock/index.html（本地，不入库）；截图 review/hec-mock/hec-mock.png。
- 三档滑块复用泄压模式三态样式；HEC 蓝色；状态条仅 HEC 档出现，纯状态标注。
- 用户确认后才动 plugin.js。

## 7. 验证计划（实现后）

- verify_v02248.cjs 全绿（801 基线 + 新增）；node --check；manifest JSON 解析。
- sim harness 跑 hec 杯：外部指令序列进 trace、学习 eligible、看门狗触发回基值。
- 真机一杯 hec + 一杯 full 对照（APK 对话配合），history-export 核对 external 标记与学习字段。
- 发版走 1.8xds：版本号 / verify / RESULTS / README，先问用户再上传。
