v2.2.61：grace 窗＋settlingBusy 真占用语义＋S2 当杯候选序 a′ 窄版＋S2 normal 封顶 1.25

本版合并用户 11-21 的两批：**grace 窗／settlingBusy**（relay-9，控制律零改，主解决 APK 杯末 8.5 s 数据窗被出站链堵死）与 **d1**（S2 先验切换条件＋S2 normal 上限，本版唯一控制律改动）。manifest 2.2.61 / description 397 字不变。

## grace 窗＋settlingBusy 真占用语义（批 grace）

- **依据（宿主只读探针，2026-11-21，平板 2.2.59，adb forward 18080）**：出站 `api()` pending 期间入站 HTTP 被饿，间隙≈出站腿时长（idle p95 23 ms；并发出站期间 max 3626 ms）——**INBOUND_STARVED_DURING_OUTBOUND**。杯29 的 autoApply 21 s（6+ 顺序腿）刚好堵满 APK 8.5 s 窗。
- **grace**：`resetSequence` 杯末 autoApply 定时器 250 ms → `AUTO_APPLY_GRACE_MS=7000`（集中常量），整条出站 profile 链移出数据窗。到期时 `phase!=="idle"`、机器外部占用或校准中 → 保持 `scheduled` 并以 `AUTO_APPLY_DEFER_MS=1000` 自续到 idle；profile 写仍被 `profileSyncIsIdle` 守卫；插件驱动开新杯仍走 `startSequence` 既有取消守卫（cancelled，杯末数据仍可取）。`restoreManualApplySchedule` 重排同走 grace。
- **settlingBusy 语义修正**：只有真占用才为 true＝`applying || runtimeProfileRepairBusy || profileSyncInFlight()`；`syncHyperExProfile` 入队处加性计数 `state.profileSyncBusy++/finally--`（覆盖非 selected 的排队同步）。**scheduled（等 grace）不再置 true**——`settledRunId===diagnostics.runId` 时 APK 既有 700 ms 轮询零新增即可直取。
- **时序契约**：学习／记忆／镜像在 finalize 已定稿，autoApply 只改 profile 测试覆盖；失败→`error`＋settlingBusy false＋settledRunId/数据不受影响；full/hec 同路。
- **杯29 类实证（本地串行桥模拟）**：base 窗内入站 max gap 2295 ms、settled 取数 21.5 s（超窗）；new 取数前 max gap 728 ms、**787 ms 窗内取数**、autoApply 28.2 s（7 s grace＋21 s 链）仍 applied。**局限如实**：这是本地模拟，宿主串行机制取自真机探针；平板仍装 2.2.59，真机陪杯待装机后另做；杯末 `scheduleProfileVerification` 校验链未移（规格外），真机上仍会占用桥数秒，取数在校验收敛后即可。

## S2 当杯候选序 a′ 窄版（批 d1）

- `liveTrimMemoryCandidate` 的 S2 候选序仍是 `[diagnosticLast, run, diagnosticCurrent]`；只有新增的 `s2FinalSignatureClaimsRun(run)` 为真——`gainRegimeForRun` 的 basis 恰为 `S2 refill return +2–4 s …` **且** `selectGainBucket` 命中桶（`absorb` 不算命中）——才把当杯提到最前。
- 为什么：S2 开段与补水上升期的 late-60% 签名是过渡量（杯29：0.4137→0.6998→0.9263）。整段当杯优先会在 28.6 s 路由到 g9（中心 4.25），29.9 s 终局不命中又回退 g2（3.9375），形成 3.94→4.25→3.94 的回摆，违反平滑度优先。S3 的 2.2.28 当杯优先不动。
- 134 杯回放（真实在线记忆，375 笔 S2 非 startup 写）：70 笔处在终局签名命中时点——**41 笔同桶逐字不变**、**29 笔（16 杯）换桶**、27 笔中心真的移动、**0 回摆**、27/29 换向当杯最终记录的桶；return 窗选不到桶的 64 笔不变；杯29 四笔全不变（不硬凑）。

## S2 normal 封顶 ×1.2 → ×1.25（批 d1）

- `commandCeilingFor` 的 `hi` 只对 `stage2 + normal` 用 `center×1.25`；S3 normal 仍 ×1.2、rescue 仍 `max(hi, mapped×2)`、`lo` 仍 ×0.8、`liveTrimControlCenter` 的 ±0.35 绝对包线不动。
- 归档实际夹取 **3 笔**（欠流杯上调）：9401-1 3.625→**3.75**（完整 6 档）、4643-2 5.125→**5.3125**（完整 4 档）、杯29 4.6875→**4.875**（完整 4 档）；其余 **372 笔逐字**。
- **如实注记机制面（不粉饰成「只影响 3 笔」）**：全归档有 **11 笔** S2 写的命令正好落在 `floor(center×1.2)`，其中 3 笔被截断、8 笔恰好踩在旧上限上（下一步上探会被挡住）。tick 级回放 84 杯里 10 杯首笔因此多走一档（3.0→3.125、5.0→5.125 一类），全部是上调、无新增下调笔、无方向反转增加。约束仍在：±0.35 绝对包线、驱动网格、rescue 映射与 §22.18 的 40% 峰秤流绊线。
- 观察项（真机）：欠流杯的首笔上调幅度与峰秤流；杯29 类尾段误差是否从约 −5% 收到 −3% 量级（早段欠流属 plan 先验，不在本版范围）。

## 用户裁定（2026-11-21）

1. grace 批授权改码；2.2.61 与 grace 同版，不另起版本号；「这些做完再发版和推送」＝本批发版与 push 授权。
2. d1 按「a′ 窄版＋c 封顶 1.25」做，不做全同构 a、不做 b 门槛放宽、不做 b′ return 窗局部估计（另立设计批）。
3. 4643-2 的对外数值用 **5.3125**（评估里的 5.1875 是近似桶重建的旧数，作废）。
4. c 的潜在面接受：归档真正夹取 3 笔，但贴旧封顶的写点不止 3 个（11 个），受绝对包线／网格／rescue 映射／40% 绊线约束；列为真机观察项。
5. 134 杯结论以 recorded-decision（逐笔用记录 controlCenterMlS 与记录桶 landscape）为准；tick 闭环回放只 4/84 杯复现归档命令流，仅作律级辅助。

## 验证

- `tests/verify_v02261.cjs` **986/986，EXIT0**（968 基线＋11 grace/时序测试＋8 d1 断言；D 的 settlingBusy 断言按新语义重编码；归档三笔按记录 center 复算「旧封顶=记录命令、新封顶放行到 intended」；禁镜像）。
- 成对写序列回放：grace 批（base 98a9f1f）与 d1 批（base 51ccff2）各一轮，history-18 近 4 杯 writes／oqTail／oqTailErr／observedR／status 全逐字。
- sim-regression **5/5**；`node --check` 通过。

## 边界（逐字不动）

LUT 不被学习改写；记忆不删改；硬包线 0.10–8.00／1/16／上行压力门单一实现；`rescueHot` 三门、静默 1200/2400、backstop 0.85、FC_FACTOR=0、影子 `sent` 恒 false 全部不动；§0 杯内无新增请求；单写者。

## 装机与后续

装机由用户在 Decaid 里自做（包只推平板 `Download/`，不代装）。APK 消费点：settlingBusy 新语义＝「真占用才退避」，scheduled 期间 settledRunId 已可见即可抓杯末数据；shadow 侧 `estLiveTrimControlCenter`／`commandCeilingFor` 需按本版对位（1.25 只 S2 normal；a′ gate 需 basis＝return+2–4 s 且命中桶）。

详见包内 HANDOFF_v02261.md／README.md；批次细节见本地 HANDOFF_2026-11-21-grace-2.2.61-impl.md／HANDOFF_2026-11-21-d1-impl.md（不在包内）。

