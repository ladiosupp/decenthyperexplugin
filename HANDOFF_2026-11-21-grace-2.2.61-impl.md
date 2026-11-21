# 2.2.61 grace 窗＋settlingBusy 真占用语义 · 实施交接（2026-11-21，relay-9 派单，用户 11-21 批；改码本批授权，发版另问）

> 统筹接力：原统筹 01a1fc32-fcb0-7773-93d5-8386f19ff231 已退位，**新统筹 01a1fd38-9fe3-7131-a24c-7983d70cf7f3（relay-10）**，回执/回叫发新 ID。规格＝[HANDOFF_2026-11-21-grace-2.2.61-relay.md](HANDOFF_2026-11-21-grace-2.2.61-relay.md)（自包含）；前序评估 [settle-async-assessment](HANDOFF_2026-11-21-settle-async-assessment.md)／D 语义 [settle-d-impl](HANDOFF_2026-11-21-settle-d-impl.md)。基线 **98a9f1f**（2.2.60 已发版）；代码实体 decenthyperexplugin.reaplugin/plugin.js。别人 WIP HANDOFF_2026-10-31.md（M）未碰。

## 1. 探针结论（前序对话已完成，本批依据）

adb forward tcp:18080→8080，平板 Decaid（装 2.2.59）只读 GET：idle 基线 external-status p95=23ms；并发 8 个 adaptive-audit（0.6–4.2s/个）期间入站轮询间隙 max **3626ms**≈出站腿时长，腿间歇恢复 10–17ms → **INBOUND_STARVED_DURING_OUTBOUND**（宿主对入站/出站串行化）。杯29 endedAt→autoApply applied +21.05s（6+ 顺序腿）＝APK 8.5s 窗全堵。方案 a（grace 窗移出整条出站链）依据成立；b/c 不消除单腿饿死，否。

## 2. 改动清单（plugin.js 9 hunk，42+/9-；其余文件见下）

1. **PLUGIN_VERSION** 2.2.60→2.2.61（L8）。
2. **常量**（L198 后）：AUTO_APPLY_GRACE_MS=7000、AUTO_APPLY_DEFER_MS=1000，注释钉探针依据。
3. **state.profileSyncBusy: 0**（profileSyncQueue 旁，加性计数旗标）。
4. **scheduleAutoApplyGrace(run, delayMs)**（autoApplyNextShotIfEligible 前）：setTimeout 回调先置 autoApplyTimer=null；若 phase!=="idle" || !profileSyncIsIdle() → 保持 scheduled、以 AUTO_APPLY_DEFER_MS 自续；否则照常 autoApplyNextShotIfEligible。
5. **resetSequence 杯末**：原 setTimeout(...,250) → scheduleAutoApplyGrace(completedDiagnosticRun, AUTO_APPLY_GRACE_MS)。
6. **restoreManualApplySchedule**：原 250 重排 → scheduleAutoApplyGrace(run, AUTO_APPLY_GRACE_MS)（manual 回滚后重排同走 grace）。
7. **profileSyncInFlight()**（profileSyncIsIdle 旁）＝state.profileSyncBusy>0。
8. **syncHyperExProfile 入队处**：state.profileSyncBusy++；task 链尾 .finally(()=>{state.profileSyncBusy--})（加性，不改串行队列/拒绝守卫）。
9. **externalStatusPayload settlingBusy** 新语义：!!(status==="applying" || runtimeProfileRepairBusy || profileSyncInFlight())；scheduled/纯定时器不再置 true。hello 继承同 payload。

其余：manifest.json version 2.2.61（**description 397 字不动**）；tests/verify_v02261.cjs（v02260 复制＋版本钉＋D settlingBusy 重编码＋11 新测试＋hooks 加 restoreManualApplySchedule）；tests/RESULTS_v02261.txt 实跑重生成；README 2.2.61 段；本交接。

## 3. 语义契约（APK 消费）

- **settledRunId**（2.2.60 D 不变）：finalize 末尾定稿标记，＝diagnostics.runId，跨轮询至下杯替换。
- **settlingBusy 新语义**：仅真占用（applying／selected repair／排队或在飞 profile 同步）。**scheduled（等 grace）＝false**：settledRunId===diagnostics.runId 时 APK 既有 700ms 轮询零新增直取杯末数据；真占用期间短退避。
- **时序**：①grace 7s 内出站链不启动，入站可响应（校验链除外，见§4 局限）；②grace 到期机器外部占用（lastMachineState=espresso）/校准中/phase 非 idle → 保持 scheduled 每 1s 自检至 idle，profile 写仍被 profileSyncIsIdle（7563/7570 同款）守卫；③**插件驱动开新杯**仍走 startSequence 既有守卫：清定时器＋status=cancelled（「赶不上下杯」路径，数据仍 settled 可取）——此为现状保留，顺延守卫覆盖非插件驱动占用；④autoApply 失败→error＋settlingBusy false＋settledRunId/summary 不受影响；⑤full/hec 同路（observationOnly 早退不变）；⑥学习/记忆/镜像 finalize 已定稿，autoApply 只改 profile 测试覆盖。

## 4. 验证（本批实跑）

- **verify_v02261 978/978 EXIT0**（968 基线：版本钉 4 处＋HTML 钉更新；D 旧 5 断言中 settlingBusy 一条按新语义重编码（scheduled/纯 timer→false，applying/repair/profileSyncBusy→true，error→false 保留 message），其余 4 条不变；＋11 新测试见 README）。禁镜像。
- **成对写序列回放**：base 98a9f1f（.tools/__grace-plugin-base.js，git show 提取）vs 新，__d18-writeseq.cjs（history-18 近 4 杯 fullRecord）：4 杯 writes/status/oqTail/oqTailErr/observedR 逐字 **GRACE_WRITESEQ_VERBATIM=true**（.tools/__grace-ws-base.json／__grace-ws-new.json／__grace-wscmp.cjs）。
- **sim-regression 5/5**；node --check plugin.js/verify 通过。
- **杯29 类实证（本地串行桥模拟）**：.tools/__grace-empirical.cjs（untracked）。复用 verify_v02261 harness（每变体重建 vm ctx，setApi 注入串行桥：出站腿占桥、入站排队；applying 链腿慢、杯末校验链腿 25ms 基线量级），间隙判定复用探针公式（阈值适配腿长：max(3×p95, 0.5×腿长)）。applying 链 11 腿，校准 21s（1909ms/腿）。结果：**base** 窗内入站 max gap 2299ms、settled 取数 21524ms（超 8.5s 窗）、starved=true；**new** 取数前 max gap 728ms（700ms 轮询周期量级）、**取数 789ms 窗内**、starved=false、autoApply 28225ms（7s grace＋21s 链）仍 applied。**GRACE_EMPIRICAL_PASS=true**（.tools/__grace-empirical.json）。
- **局限如实说明**：①实证是本地模拟，宿主串行机制取自真机探针结论；平板装 2.2.59 且装机属发版流程（未授权），**真机陪杯确认待装 2.2.61 后另做**；②杯末 scheduleProfileVerification 校验链（杯26–28 的 3–6s 堵塞源）本批未移（规格范围外），实证中按基线量级腿模拟；真机上它仍会在杯末占用桥数秒，APK 取数在校验收敛后（settlingBusy 落 false）即可，8.5s 窗内可完成；③empirical 脚本 appliedAtMs 字段改取独立 20ms 状态时间线（driver await 阻塞曾使该字段失真），gaps/fetch/timeline 为可信取证。

## 5. 红线遵守

控制律/律结构/r/Vi/门/写入面零改（写序列逐字实证）；§0 杯末非萃取请求；单写者；LUT/记忆不删改；杯末评分数据链不回退（D 数据链断言保留＋失败路径 summary 断言）；别人 WIP 不碰；.tools 探针/实证 untracked 不入库；**不自行 push/发版**（发版待统筹核后另派，push 亦统筹）。

## 6. 复跑索引

- 回归：node decenthyperexplugin.reaplugin/tests/verify_v02261.cjs（978）；node sim/tests/sim-regression.cjs（5）。
- 写序列：node D:/vscode/.tools/__d18-writeseq.cjs <plugin>（base＝.tools/__grace-plugin-base.js）；比对 node D:/vscode/.tools/__grace-wscmp.cjs。
- 实证：node D:/vscode/.tools/__grace-empirical.cjs（约 85s，3 变体；退出码＝PASS）。
- 真机探针（只读，idle 前置，提权）：adb forward tcp:18080 tcp:8080; node D:/vscode/.tools/__grace-host-probe.cjs。
- 代码锚点：rg "AUTO_APPLY_GRACE_MS|scheduleAutoApplyGrace|profileSyncBusy|profileSyncInFlight|settlingBusy" plugin.js。

## 7. 遗留／交接

- 发版 2.2.61（打包/Release/夸克/平板推送）待新统筹核后另派；push 亦统筹。
- **APK 消费口径变化**：settlingBusy 不再含 scheduled——HEC 侧「settlingBusy 期间短退避」逻辑需按新语义同步（真占用才退避；scheduled 期间可直取），请统筹派 HEC 同步批时带上。
- 校验链（scheduleProfileVerification）杯末占用桥数秒为现状保留；若真机陪杯发现 APK 取数仍偏晚，另批评估是否把校验链也纳入 grace（须用户裁）。
