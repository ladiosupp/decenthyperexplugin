# HyperEx 2.2.48 交接：HEC 档（外部调流 + 插件监护学习 + 握手保险）

日期：2026-11-15（北京时间）。**已发版（GitHub Release + 夸克），用户授权「按规矩发版」；真机验证待做。**

分支：auto-hyperex。基线：2.2.47（tag v2.2.47）。

## 0. 分工（用户 2026-11-15 点名）

- **本对话只改插件端**；APK（HyperExControler）端由另一对话负责。
- 给 APK 对话的接口契约：仓库根 [HEC_PROTOCOL_FOR_APK.md](../HEC_PROTOCOL_FOR_APK.md)，用户转发。
- 两边同步事项见本文 §5 与协议 MD；每轮更新，交中立对话评估。
- 设计提案与 UI 示意：[HANDOFF_2026-11-15-hec-mode-proposal.md](../HANDOFF_2026-11-15-hec-mode-proposal.md)、review/hec-mock/。

## 1. 用户口径

- 算法介入开关加 HEC 档（APK 名 HyperExControler 缩写）：选这一档，插件监护监测 + 保留学习，
  调流指令交给 APK 发进来。
- **保险**：握手没成功时 HEC 档也要有介入救急——S2 补水阶段之前确认连接，有问题就在 S2 补水阶段介入；
  后续 APK 写指令或握手心跳断开，插件也要及时救急，尽量不浪费用户的豆子。
- 不能破坏现有其他功能（full/off 逐字不变）。

## 2. 实现（全部在 decenthyperexplugin.reaplugin/）

1. **三态**：normalizeAlgorithmIntervention 接受 hec；存储键 algorithmInterventionV1 不变，旧值兼容；
   control-mode POST/GET 透传 hec + hec 状态块；开杯锁存 run.config.algorithmIntervention，运行中 409。
2. **effectiveInterventionForRun**：hec + 本杯接管锁存 → 按 full 执行。所有写闸
   （dispatchS2Startup / liveTrimGovernor / liveTrimTick）改读 effective 值；off 行为不变。
3. **外部端点**（manifest 已登记）：
   - external-hello POST：握手，记 client/version，刷新心跳。
   - external-status GET：决策上下文（相位/逻辑物理帧/目标/基值/当前指令/pending/压力限压/遥测龄/rawGS/预算）
     + 心跳块；**也刷新心跳**。
   - external-flow POST：校验后代写 A010。拒绝分支：hec-mode-required / hec-takeover / not-extracting /
     frame-not-confirmed / frame-mismatch / write-pending / command-busy / write-budget / telemetry-stale /
     frame-not-writable / pressure-upward-blocked（409），command-invalid / command-out-of-bounds（400）。
     200 返回 commandMlS/frame/writes/maxWrites。trace write 行 external:true。
4. **保险**（HEC_HEARTBEAT_MS=4000）：
   - liveTrimTick 顶部：stage2 帧 1、startup armed（或 HEC 禁用且从未握手）且心跳不新鲜 →
     hecLatchTakeover("hec-no-handshake")，**当场把补水计划重建为 full 计划并 re-arm**，本杯插件执行补水/救急。
   - startup 块之后：hecHeartbeatWatchdog——stage2/3 心跳断 → hecLatchTakeover("hec-heartbeat-lost")，
     当前指令 ≠ 基值时先代写一笔基值收回（hecWatchdog:true），随后 full 控制律接管；同 tick 刷新 intervention 立即生效。
   - 接管锁存进 run.config.hecTakeover{reason,atMs}，本杯 external-flow 一律 409 hec-takeover；
     下一杯 startDiagnostics 重置计数、重新按心跳评估（心跳本身跨杯持续，连续轮询的 APK 下一杯仍是 APK 调流）。
5. **学习**：hec 杯 observationOnly=false → 进杯间学习与自动下一杯；接管杯同样进学习；
   compactPersistentShotRecord 带 hecTakeover；增益指纹不加模式维度（学习连续，用户口径）。
6. **UI**：算法滑块三态（algo-switch，复用泄压三态样式），HEC 蓝色主题 state-hec；
   HEC 档卡片下状态条 hec-status（连接心跳/外部写入·拒绝·看门狗/本杯预算/接管标注），纯状态标注无操作小字；
   renderModeCard + renderHecStatus + paint 钩子；i18n 增补词条；中英文静态检查白名单加 HEC/APK。
7. **版本**：plugin.js / manifest.json / 诊断页 / verify 同步 2.2.48；manifest description 更新。

## 3. 验证

- tests/verify_v02248.cjs **818/818**（801 基线全保留 + 17 新增）；RESULTS_v02248.txt 已生成。
- node --check plugin.js / verify_v02248.cjs 通过；manifest JSON 解析通过。
- 渲染诊断页 3 段脚本 vm.Script 编译通过（verify 内既有断言）。
- 新增覆盖：三态归一/锁存/存储兼容、hec 不写、代写量化与台账、越界/跨帧/上行限压/pending/非 hec 拒绝、
  无握手 S2 前接管 + 补水计划重建、新鲜握手保持 APK 控制、心跳断基值收回 + 接管、接管后 full 恢复写入、
  按杯重评、UI 三态与状态条、外部写入进 liveTrimChainEvidence 学习链。
- **未做**：真机 DE1 / 红米平板 / APK 联调（APK 端另一对话实现后按协议 §8 清单联调）。

## 4. 不碰

full/off 两档行为、LUT、校准、arming/GHC、泄压模式、预设、曲线编辑、皮肤、宿主、sim/、app/。
工作区里别人的未提交改动（HANDOFF_2026-10-31.md、verify_v0226.cjs 等）不碰不代提交。

## 5. 两边同步事项（交中立对话评估；与协议 MD 一致）

1. 切档 POST control-mode {mode:"hec"}，仅空闲、下一杯生效；APK 先核对 pluginVersion ≥ 2.2.48。
2. 握手 POST external-hello；心跳 = external-status 轮询（建议 500–1000 ms）或 external-flow，超时 4000 ms。
3. 调流 POST external-flow {command, frame?}；逻辑帧 S1=0/S2=1/S3=2..4；拒绝分支见协议 §3 表。
4. 上下文 GET external-status；原始秤流 APK 可自取 Decaid 官方 WS（同源不冲突）。
5. 保险后果：接管后本杯 external-flow 409 hec-takeover，APK 停发只读；下一杯心跳恢复则回到 APK 调流。
6. 学习：hec 杯进学习，trace external:true 区分；接管杯 run.config.hecTakeover 记录 reason。
7. 传输：插件端点无 CORS，APK 走原生 HTTP（HxBridge 同款）；回环无鉴权。

## 6. 开放问题（中立对话 / 用户拍板）

1. 看门狗 4 s 与「回基值」动作是否合适（备选：回基值后暂停接受外部指令 N 秒——当前未加，接管即全拒）。
2. 增益指纹要不要加 hec 维度（当前不加，保学习连续；风险：外部控制律风格差异混入记忆）。
3. 上行压力门 0.90×限压 照搬内部口径（已照搬）。
4. external-status 轮询 300–500 ms 是否够（APK 决策周期更短时上下文略旧，原始流自取补）。
5. HEC 状态条字段取舍（示意 review/hec-mock/）。

## 7. 发版回执（2026-11-15，用户授权「你要是确定不会影响现有功能的，可以按规矩发版了」）

- 代码提交 6e6c2bb（auto-hyperex），tag v2.2.48（annotated），已推送（VPN 代理 127.0.0.1:57890）。
  只 add 本批 9 文件：plugin.js / manifest.json / README.md / tests/verify_v02248.cjs / tests/RESULTS_v02248.txt /
  HANDOFF_v02248.md / HEC_PROTOCOL_FOR_APK.md / HANDOFF_2026-11-15-hec-mode-proposal.md / release/notes-v2.2.48.md。
  别人未提交的 HANDOFF_2026-10-31.md 等未碰。
- 包从 tag 用 git archive 取（release/__build_v2248.ps1）：HyperExPulseFilter_v2.2.48.zip，**498,792 字节**。
  SHA256：**919E1B2D965A86B7995C766F59E9AFC1368613DC74F47EACF4DFDFBAC580D64A**。
  包内复核：解压后 node --check 通过、tests/verify_v02248.cjs **818/818**。
- GitHub Release：https://github.com/ladiosupp/decenthyperexplugin/releases/tag/v2.2.48 （Latest，非 draft/prerelease；
  资产 digest 与本地 SHA256 一致，gh release view 核对）。
- 夸克：夸克网盘/来自：Codex/HyperExPulseFilter_v2.2.48.zip，498,792 字节，fileId 96a71fbc29484fbda2849ca771fbbb6f。
- 发版说明：release/notes-v2.2.48.md。
- 用户先更新平板插件；HEC 档真机联调待 APK 端（另一对话）实现后按协议 §8 清单做。
  未装 APK 时选 HEC 档出杯，插件会在 S2 补水前自动接管，行为等同全开（保险兜底）。
