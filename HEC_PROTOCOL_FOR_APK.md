# HEC 协议（插件端 → HyperExControler APK 对话）

> 2026-11-15。插件端实现见 HANDOFF_2026-11-15-hec-mode-proposal.md 与 verify_v02248.cjs。
> 本文是给 APK 对话的接口契约，**逐条实现即可，不需要改插件**。中立对话评估用同一份。
> 基址：http://127.0.0.1:8080（APK 与 Decaid 同平板回环）。插件 id：decenthyperexplugin.reaplugin。
> 下文省略前缀 /api/v1/plugins/decenthyperexplugin.reaplugin。
> 2026-11-15 修订：字段名与拒绝分支按 plugin.js 2.2.48 实测更正（heartbeat / takeover 字段名、
> external 计数并入 heartbeat 块、补 frame-not-confirmed / frame-not-writable）；插件代码未动。

## 0. 总原则

- **写者只有插件一个**。APK 不直接写 BLE / ws/v1/machine/raw；调流指令经 external-flow 发进插件，
  插件校验后代写 A010，ACK / 超时 / 预算 / 看门狗全在插件侧。
- **HEC 档有保险**：握手没成功、或心跳/指令断流，插件在 S2 补水前或断流 4 s 后**本杯锁存接管**，
  补水与救急回到插件手里，尽量不浪费豆子。接管后本杯拒绝外部指令（防双写），下一杯重新评估。
- 模式三档：full（插件调流，现状）/ hec（APK 调流 + 插件监护学习 + 保险）/ off（只检测，现状）。
- 插件端点**无 CORS 头**：WebView 里 fetch 会被拦，走原生 HTTP（现有 HxBridge 同款模式）。
- 无鉴权（回环本地，与现有全部插件端点一致）。body 上限 64 KiB，指令 JSON 远小于。

## 1. 版本与模式

- 版本核对：GET /status 的 calibration.pluginVersion，或 GET /external-status 顶层 pluginVersion
  （GET /control-mode 返回里没有 pluginVersion 字段）。档位核对：GET /control-mode → algorithmIntervention。
  **HEC 需要 pluginVersion ≥ 2.2.48**；旧插件没有 external-* 端点，APK 应提示升级而不是硬调。
- POST /control-mode，body {"mode":"hec"|"full"|"off"}。
  仅空闲 200；运行中 409（本杯锁定）。下一杯生效。GET 同路读 {algorithmIntervention, algorithmInterventionActive, canEdit, ...}。
- APK 自己的「启用 HEC」UI 应先切档成功再进入控制界面；切档失败（409）提示「本杯进行中，下一杯生效」。

## 2. 握手与心跳（保险的核心）

- POST /external-hello，body {"client":"HyperExControler","version":"<apk版本>"}（字段可省略，仅作记录）。
  返回 200 {ok:true, mode, ...（其余字段同 §4 external-status）}，超时在 heartbeat.heartbeatTimeoutMs（=4000）。
  **hello 与 external-status 都刷新心跳**。
- 心跳超时 HEC_HEARTBEAT_MS = 4000 ms（插件常量，external-status 里透出 heartbeat.heartbeatTimeoutMs）。
- **建议节奏**：控制界面打开即 hello；之后每 500–1000 ms GET /external-status（兼心跳兼决策上下文）。
  萃取中若 APK 决策周期更短，external-flow 本身也刷新心跳。
- 保险判定（插件侧，APK 只需知道后果）：
  1. **S2 补水前**（stage2 帧确认、补水计划 armed 时）检查心跳：从未 hello 或已超时 →
     本杯锁存 takeover（reason=hec-no-handshake），补水计划当场重建为插件 full 计划，插件执行补水/救急。
  2. **萃取中**（stage2/3）心跳超时 → 锁存 takeover（reason=hec-heartbeat-lost），
     当前指令 ≠ 曲线基值时先代写一笔基值收回，随后插件 full 控制律接管（含救急）。
  3. takeover 一旦锁存，**本杯** external-flow 一律 409 reason=hec-takeover；APK 读到后应停止发指令、
     显示「插件已接管本杯」。下一杯开杯时重新按当时心跳评估（心跳恢复则下一杯仍是 APK 调流）。
- 注意：S1 阶段不判心跳（连续模式 S1 插件本来就不写）；判定从 stage2 开始，与补水时机对齐。

## 3. 调流指令

- POST /external-flow，body {"command": <number, ml/s>, "frame": <int, 可选>}。
- command 硬边界 0.10–8.00，插件按 1/16 量化（toDriverStep）。越界 400。
- frame 为**逻辑帧**：S1=0（仅连续模式可写）、S2=1、S3=2/3/4。省略 = 用插件当前逻辑帧。
  给了但与当前不符 → 409 reason=frame-mismatch（防跨帧写）。物理帧映射插件按泄压模式做，APK 不碰物理帧。
- 200 → {ok:true, commandMlS, frame, writes, maxWrites, ack:false}。
  ACK 由插件异步收（driver-ack 进 trace）；APK 不直接碰 BLE，也不需要等 ACK 才发下一笔——
  但插件内部 pending 串行：上一笔未 ACK 且未超时前，新指令 409 reason=write-pending。
  建议 APK 决策周期 ≥ 300 ms，或读 external-status 的 pending 状态再发。
- 409 拒绝分支（body {ok:false, reason, ...}）：
  | reason | 含义 | APK 应对 |
  |---|---|---|
  | hec-mode-required | 本杯不是 hec 档 | 停止发指令，提示切档 |
  | hec-takeover | 本杯已被插件接管 | 停止发指令，显示接管 |
  | not-extracting | 非萃取中 / 相位不允许 | 等下一杯 |
  | frame-not-confirmed | 当前逻辑帧尚未确认 | 等 external-status 的 logicalFrame 非 null 再发 |
  | frame-mismatch | 逻辑帧不符 | 用 external-status 的 logicalFrame 重发 |
  | frame-not-writable | 当前帧非流量泵步 / 是退出步 | 等进入可写帧再发 |
  | write-pending | 上一笔未确认 | 等 ACK 或超时（≤2 s）再发 |
  | write-budget | 本杯预算耗尽 | 停止，插件接管剩余 |
  | pressure-upward-blocked | 上行且压力 ≥ 限压×0.90 | 改下行或保持 |
  | telemetry-stale | 机器/秤遥测过期 | 等遥测恢复 |
  | command-busy | 插件正在写曲线等 | 稍后重试 |
  400 分支：command-invalid（command 不是有限数字）、command-out-of-bounds（越出 0.10–8.00）。
  未知 reason 一律按「停发 + 显示原文」兜底，不要按前缀猜。
- 预算复用现有档位滑块（LiveFlowTrimLevel 1–4 → 50/150/200/250 笔/杯），external-status 透出 writes/maxWrites。
- 上行压力门与内部补水门同口径（≥ limiter×0.90 拒上行）；**下行不限**（救急要能断流）。

## 4. 决策上下文

- GET /external-status（建议 300–500 ms 轮询，兼心跳）：
  {
    mode, pluginVersion, phase, extracting,
    logicalFrame, physicalFrame, layout:{s1,release,s2,s3},
    targetGS, baseCommandMlS, lastCommandMlS, pending:{frame,command,ack}|null,
    pressureBar, limiterBar, machineAgeMs, scaleAgeMs, rawGS,
    writes, maxWrites,
    heartbeat:{heartbeatTimeoutMs, lastContactAtMs, ageMs, ok, client, takeover,
               externalWrites, externalRejects, watchdogs},
    takeover:{reason, atMs}|null,
    runId
  }
- takeover 非 null 即本杯已接管（没有 active 字段）；heartbeat.takeover 与顶层 takeover 是同一对象。
- client 为 hello 记录的 {name, version}|null；externalWrites / externalRejects / watchdogs 为
  插件加载以来的累计计数（每杯开杯清零）。
- rawGS 是插件最近一次 RAW 回归杯流（g/s），与插件决策同源；APK 若要更细可自行订阅
  Decaid 官方 ws/v1/scale/snapshot、ws/v1/machine/snapshot（与插件同源，不冲突）。
- lastCommandMlS = 插件指令台账当前值（含外部代写与接管后的内部写）。takeover 后 APK 用它做显示即可。

## 5. 学习与记录（APK 无需动作，知悉即可）

- hec 杯 observationOnly=false，**进杯间学习与自动下一杯**；trace write 行带 external:true 区分来源。
- 接管杯同样进学习（接管后就是插件 full 控制律）；run.config.hecTakeover 记录 reason。
- 增益指纹暂不加模式维度：hec 与 full 杯共享增益记忆（用户要学习连续）。
- HEC 未接管时插件补水计划禁用；APK 若自做灌水，经 external-flow 发（上限 8.00 同硬边界），
  S2 学习窗按现有 plateau 检测自适应，不依赖插件补水事件。接管后补水由插件执行。

## 6. APK 侧建议状态机

1. 打开控制页 → GET /status 核对版本（calibration.pluginVersion）+ GET /control-mode 核对档位；需要时 POST 切 hec（空闲）。
2. POST /external-hello → 进入「已连接」；起 500–1000 ms external-status 轮询。
3. 萃取中：按 external-status + 自取 WS 做决策 → POST /external-flow。
4. 读到 takeover 非 null 或 409 hec-takeover → 停发指令，UI 显示「插件接管本杯」，继续轮询显示曲线。
5. 杯结束 → 回 idle；下一杯开杯前确认心跳仍在（轮询不断），否则插件会再次接管。
6. 切后台/被杀：插件 4 s 后接管兜底；回前台读 external-status 重新同步（本杯若已接管则只读）。

## 7. 边界与坑

- 运行中切档 409；**模式开杯锁存**，APK 不要在萃取中尝试切档。
- 校准杯强制 full，external-flow 会 409 hec-mode-required。
- 非 HyperEx 前缀曲线插件不介入，external-status 的 extracting 仍可能 true 但 mode 非 hec → 不发指令。
- 插件重载（改核心设置会 reload）会丢心跳 → 下一杯按无握手接管；APK 重发 hello 即可恢复下一杯。
- 所有时间戳 ms（Date.now 口径）；ageMs 为插件计算的距上次事件毫秒数。

## 8. 联调清单（两边各自验）

- [ ] 切档 hec → hello → status 心跳 ok=true。
- [ ] 不 hello 直接出杯 → S2 前 takeover reason=hec-no-handshake，插件补水正常。
- [ ] hello 后出杯，中途停轮询 4 s → takeover reason=hec-heartbeat-lost，基值收回 + 插件接管。
- [ ] 正常 hec 杯：external-flow 写入进 trace（external:true），杯后学习 eligible。
- [ ] 越界 / 跨帧 / 上行限压 / 预算耗尽各 409 分支。
- [ ] 接管后 external-flow 409 hec-takeover；下一杯心跳恢复后回到 APK 调流。
