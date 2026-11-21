# HANDOFF v02260 — fpKey 加性暴露＋杯末结算可见性（2.2.60 发版）

> 2.2.60 发版（用户 11-21 批准批② fpKey＋批① D；发版次序 D→2.2.60、grace→2.2.61）。基线链：3cd2cd8（2.2.59 回执）→ 61693ef（fpKey 批）→ 4922e7a（素材交叉钉 5 杯）→ d1a9de3（D 批）。**代码零改的加性批**；批次细节见本地 HANDOFF_2026-11-21-ext-fpkey-impl.md／settle-d-impl.md／settle-async-assessment.md（不在包内；本文自包含）。

## 1. 一句话

external-status/hello 加性暴露 fpKey（完整指纹，O1/viBuckets 同源）＋numericFpKey（r 证据 numeric 指纹），hello 另加 gainMemory 只读镜像（pre-cup 刷新）；ext-status 尾加 settledRunId（杯末数据定稿标记）＋settlingBusy（结算链忙派生），APK 杯末数据窗零猜测取数。零控制律改；21 既有字段契约不变。

## 2. 改动

- **fpKey 批 61693ef**：externalStatusPayload return 前算 fp（adaptiveHistoryFingerprint→fpKey/numericFpKey，只读）；return 尾 +fpKey/numericFpKey（不可用 null）；新 helper gainMemoryMirrorPayload（normalizeGainMemory 纯函数，不写文件）；external-hello 响应 +gainMemory；PLUGIN_VERSION 2.2.60。
- **素材交叉 4922e7a**：verify 标定反推测试钉原 5 杯子集（cal5 filter＋cal5.length 归一＋子集存在断言），反推式/素材不动；rmse 0.086s 恢复。
- **D 批 d1a9de3**：finalizeDiagnostics 末尾 state.settled={runId,at}；ext-status 尾 +settledRunId（String/null）＋settlingBusy 派生 !!(autoApplyTimer||runtimeProfileRepairBusy||status∈{scheduled,applying})。
- manifest version 2.2.60（description 397 不动）。
- README 2.2.60 段。

## 3. 语义契约（APK 消费）

- fpKey：完整校准上下文指纹 key（含 targets/温度/LUT 点）；校准不可用 null；LUT 点变更即变。
- numericFpKey：r 证据 numeric 指纹（温度/targets/LUT 点不敏感）；模式（activeRelease）区分。
- gainMemory 镜像：normalize 同格式（buckets＋viBuckets＋meta＋dropped）；hello 每次读当前主本；只读。
- settledRunId：最近结算完成 runId（＝diagnostics.runId）；finalize 起可见、跨轮询保持至下杯替换、无则 null。
- settlingBusy：结算链忙（scheduled/applying/autoApplyTimer/runtimeProfileRepairBusy）；失败/异常终态 false 且 autoApplyLastStatus 保留 error 诊断。

## 4. 没动什么

控制律/律结构/r/Vi/门/写入面零改；§0 杯内无新增请求；单写者；LUT/记忆不删改；杯末评分数据链（diagnostics {summary,run}／shots）不回退；21 既有协议字段语义不变。

## 5. 验证

verify_v02260 **968/968**（954 基线＋9 fpKey＋5 D；素材 5 杯交叉 rmse 0.086s；禁镜像）；sim 5/5；node --check；成对写序列回放两轮（base 3cd2cd8／4922e7a，history-18 近 4 杯）writes 逐字＋oqTailErr 全同。

## 6. 用户裁定记录（11-21）

1. 批② 插件经 ext/hello 暴露 fpKey 加性字段（hec C 后半/D 波硬依赖）。
2. 素材漂移裁定 b：标定反推测试钉原 5 杯（杯26–29 属 refit 后活体验证另一口径）。
3. 批① D 并入 2.2.60（settledRunId/settlingBusy）；「1，2，3，push都同意」＝D 入 2.2.60、grace 批授权、次序 D→2.2.60/grace→2.2.61、push 统筹自办。
4. 本发版批代码零改。

## 7. 下一步

- 用户 Decaid 自装；APK 消费点见 §3；杯末 8.5s 窗的 HTTP 可响应性由 2.2.61 grace 窗批（宿主只读探针→方案 a：250ms→6–8s＋非 idle 顺延＋settlingBusy 语义修正＋结算时序契约）解决。
- APK 同步债：新字段展示/消费记 hec 里程碑。

## 8. 发版回执（2026-11-21，用户批次序 D→2.2.60）

- **基线**：61693ef（fpKey 批）＋4922e7a（素材交叉钉 5 杯）＋d1a9de3（D 批）＋发版批 **98a9f1f**（notes＋本交接，代码零改）。tag **v2.2.60**=98a9f1f59c87e3e2d8cbbe2113d23909ce26a066（lightweight）。
- **push**：origin auto-hyperex **3cd2cd8..98a9f1f**（4 commit）＋new tag v2.2.60（VPN 57890）；ls-remote 核分支/tag 均=98a9f1f。
- **包**：release/HyperExPulseFilter_v2.2.60.zip **593698 字节**，SHA256 **461F3C292FFB4E2D9A5B5F909708F974C4D82A3B52673595CF2BF352E460AE13**（git archive v2.2.60，9 条目同 v2259 布局，__build_v2260.ps1）。**包内复跑 968/968**＋node --check＋manifest version=2.2.60 descLen=397 核过。
- **GitHub Release**：**453533794**（tag v2.2.60，make_latest=true，draft=false），asset HyperExPulseFilter_v2.2.60.zip（593698 字节，state=**uploaded**，asset id **774866132**／node_id RA_kwDOVO5zXc4uL4TU）。REST POST releases＋uploads 直传（curl -H Expect: --data-binary），token credential fill 不回显＋代理 57890；body=release/notes-v2.2.60.md。
- **夸克**：「夸克网盘/来自：Codex」fileId **c3068b07568640248b7d4079b3e46f52**（593698 字节，非秒传；官方 CLI 1.0.25，install success/updated=false，result 无 notice；session-input「1，2，3，push都同意」）。
- **平板**：adb mDNS adb-haf6uwvcqcdujzin-trqoCZ 推 /sdcard/Download/HyperExPulseFilter_v2.2.60.zip，ls 核 **593698** 字节（2026-11-21 15:59）；**不代装，用户 Decaid 自装**。
- **红线**：发版批代码零改；push 仅 auto-hyperex＋tag 经 VPN；别人 WIP HANDOFF_2026-10-31.md M 不碰不提交。
- **发版后**：用户 Decaid 自装；APK 消费点见 §3；按派单进入阶段 2 grace（2.2.61：宿主只读探针→方案 a＋settlingBusy 语义修正＋结算时序契约＋杯29 类实证）。


