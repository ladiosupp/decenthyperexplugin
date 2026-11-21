# HANDOFF v02261 — grace 窗＋settlingBusy 真占用语义＋S2 当杯候选序 a′／封顶 1.25（2.2.61 发版）

> 2.2.61 发版（用户 11-21 两批：grace＝relay-9；d1＝S2 候选序 a′ 窄版＋封顶 1.25）。基线链：98a9f1f（2.2.60 回执）→ 51ccff2（grace）→ 0de0946（d1）。批次细节见本地 HANDOFF_2026-11-21-grace-2.2.61-impl.md／HANDOFF_2026-11-21-d1-impl.md（不在包内；本文自包含）。

## 1. 一句话

grace：杯末 autoApply 从 250 ms 延到 7000 ms，把整条出站 profile 链移出 APK 8.5 s 数据窗；非 idle／机器占用／校准中自动 1 s 顺延；`settlingBusy` 改为「只有真占用才 true」，scheduled 期间 APK 可直接取 settled 数据。d1：S2 只在**当杯终局签名命中桶**时才当杯优先（消除 4.25→3.94 的回摆），S2 normal 的写上限由 `center×1.2` 放到 `×1.25`。

## 2. 改动

- **grace（51ccff2）**：`AUTO_APPLY_GRACE_MS=7000`／`AUTO_APPLY_DEFER_MS=1000`；`scheduleAutoApplyGrace(run,delayMs)`（到期先清 timer，再判 phase/profileSyncIsIdle，不满足则以 1 s 自续）；`resetSequence` 杯末与 `restoreManualApplySchedule` 都走它；`state.profileSyncBusy` 计数旗标＋`profileSyncInFlight()`；`externalStatusPayload` 的 settlingBusy 收敛为 `applying || runtimeProfileRepairBusy || profileSyncInFlight()`。
- **d1（0de0946）**：常量 `S2_NORMAL_CEILING_RATIO=1.25`／`S2_FINAL_SIGNATURE_BASIS`；新函数 `s2FinalSignatureClaimsRun(run)`；`liveTrimMemoryCandidate` 的 S2 候选序加门；`commandCeilingFor` 的 `hi` 只对 `stage2+normal` 用 1.25。
- manifest version 2.2.61（description 397 字不动）；README 2.2.61 段；tests/verify_v02261.cjs／RESULTS_v02261.txt。

## 3. 语义契约（APK 消费）

- **settledRunId**（2.2.60 起不变）：finalize 末尾定稿标记，＝`diagnostics.runId`，跨轮询保持到下一杯替换，无则 null。
- **settlingBusy（本版新语义）**：只有真占用（applying／selected repair／排队或在飞的 profile 同步）为 true。**scheduled（等 grace）为 false**——`settledRunId===diagnostics.runId` 时用既有 700 ms 轮询直取杯末数据；真占用期间短退避。
- **grace 时序**：杯末 7 s 内不出站；到期若机器外部占用／校准中／phase 非 idle → 保持 scheduled 每 1 s 自检；插件驱动开新杯仍会取消 pending apply（`cancelled`），数据不受影响。
- **autoApply 失败**：`error`＋settlingBusy false＋settledRunId/summary 不变。full 与 hec 同路。
- **S2 先验（d1）**：当杯签名只在 return+2–4 s 窗口且命中桶时才领先；否则仍读上一杯。S2 normal 的指令上限＝center×1.25（S3／rescue／lo／±0.35 不变）。

## 4. 没动什么

控制律的其余部分不动：LUT 不被学习改写、记忆不删改、硬包线 0.10–8.00／1/16／上行压力门单一实现、`rescueHot` 三门、静默 1200/2400、backstop 0.85、FC_FACTOR=0、影子 `sent` 恒 false；§0 杯内无新增请求；单写者。d1 的 a′ 不改 S3 的 2.2.28 契约。

## 5. 验证

- verify_v02261 **986/986，EXIT0**（968 基线＋11 grace/时序测试＋8 d1 断言；含归档三笔按记录 center 复算；禁镜像）。
- 成对写序列回放两轮（base 98a9f1f 与 51ccff2，history-18 近 4 杯）writes／oqTail／oqTailErr／observedR／status 全逐字。
- sim 5/5；node --check。
- 134 杯 recorded-decision：S2 非 startup 写 375 笔，封顶只夹 3 笔（9401-1 3.75／4643-2 5.3125／杯29 4.875），372 笔逐字；a′ 70 笔终局命中→41 同桶不变、29 笔（16 杯）换桶、27 笔中心移动、0 回摆；杯29 四笔全不变。
- **局限**：tick 闭环回放只 4/84 杯复现归档命令流（plan/return 基值与 band 行不在归档），故 134 杯以 recorded-decision 为准，tick 回放只作律级辅助（74/84 杯 base=new；10 杯首笔差全为上调，无新增下调/反转）；grace 的杯29 类实证是本地串行桥模拟，真机陪杯待装机。

## 6. 用户裁定记录（11-21）

1. grace 批授权改码；与 d1 合入同一个 2.2.61（不另起版本号）。
2. d1＝a′ 窄版＋c 封顶 1.25；不做全同构 a、b 门槛放宽、b′ return 窗局部估计。
3. 4643-2 对外用 5.3125（5.1875 作废）。
4. c 潜在面接受（贴旧封顶 11 个写点，归档实际夹 3 笔），列入真机观察项。
5. 「这些做完再发版和推送」＝本批发版与 push 授权。

## 7. 下一步

- 用户 Decaid 自装；APK 消费点见 §3。
- 真机陪杯（另批）：中心序列／每笔写／峰秤流／tail／whole；杯29 类与 9401-1 类各 1 杯；关注欠流杯首笔上调幅度与 40% 峰绊线。
- shadow/APK 同步：`estLiveTrimControlCenter` 与 `commandCeilingFor` 对位（1.25 只 S2 normal），a′ gate 需要 basis＝return+2–4 s 且命中桶。


## 8. 发版回执（2026-11-21，2.2.61：grace＋d1）

- **基线**：51ccff2（grace）→ 0de0946（d1）→ 发版批 **b2101ee**（notes＋本交接，代码零改）。tag **v2.2.61**=b2101ee7c4f54ab47631472b78bbaa34e2fe0602（lightweight）。
- **push**：origin auto-hyperex **74e54f4..b2101ee**＋new tag v2.2.61（VPN 57890）；ls-remote 分支／tag 均=b2101ee。
- **包**：release/HyperExPulseFilter_v2.2.61.zip **603050 字节**，SHA256 **39477B261C290DD9FA8D6017A527951F1B7A6280AB4FCB8B9CCD9F41A146B75C**（git archive v2.2.61，9 条目同 v2259/v2260 布局，__build_v2261.ps1）；**包内复跑 986/986 EXIT0**＋node --check＋manifest version=2.2.61 descLen=397。
- **GitHub Release**：**453572358**（tag v2.2.61，draft=false，prerelease=false，latest=v2.2.61），asset HyperExPulseFilter_v2.2.61.zip（603050 字节，state=**uploaded**，asset id **775033792**／node_id RA_kwDOVO5zXc4uMhPA）。REST POST releases＋uploads 直传（token credential fill 不回显，代理 57890），body=release/notes-v2.2.61.md。
- **夸克**：「夸克网盘/来自：Codex」fileId **419711529e9e4da99c6a742da194593c**（603050 字节，instantUpload=false 非秒传；result 无 notice）。
- **平板**：adb mDNS adb-haf6uwvcqcdujzin-trqoCZ（192.168.31.15:44439）推 `/sdcard/Download/HyperExPulseFilter_v2.2.61.zip`，ls 核 **603050** 字节（2026-11-21 17:14）；**不代装，用户 Decaid 自装**。
- **说明**：包内交接是 §1–§7 版本，本回执在发版后的独立 commit（沿 v2259／v2260 先例，避免包内自指）。发版批代码零改；别人 WIP HANDOFF_2026-10-31.md 未碰。
