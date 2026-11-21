# HANDOFF v02262 — 杯末校验后置（2.2.62 发版）

> 2.2.62 发版（用户 11-21 批，relay-10 派单；改码批 128a40c，文档补记 1a7b719）。基线 b982d79（2.2.61 回执）。批次细节见本地 HANDOFF_2026-11-21-v2262-defer-verify.md（不在包内；本文自包含）。

## 1. 一句话

completed 杯且 autoApply 已排队时，**杯末 profile 校验不再跟着 resetSequence 立即跑**，而是等 grace autoApply 流程结束（applied 或 error，含各类早退）后**恰好补一次**；开新杯取消则不补跑。APK 8.5 s 首取窗里只剩空闲桥与 settled 数据。

## 2. 根因与改动

- **根因（真机杯 30，runId 1795253527486-1，2.2.61＋APK v0.38）**：endedAt 09:33:24.241Z → autoApply applied 09:33:42.667Z＝18.43 s（grace 正常），但 APK 自动取分失败、用户约 +18 s 手刷才拿到 87 分。2.2.61 已把 autoApply 移出窗，可是 `resetSequence` 第一秒仍 `scheduleProfileVerification('sequence reset')`，3–6 s 同桥链继续堵窗。
- **plugin.js（4 处，控制律零触）**：
  1. `PLUGIN_VERSION` → 2.2.62；
  2. `state.cupVerificationRunId`（欠账只对一个 runId 生效）；
  3. `resetSequence`：`cupCompletion = completedDiagnosticRun && /^completed at /i.test(reason) && state.autoApplyNextShot`；仅 `!cupCompletion` 时立即校验；cupCompletion 时记欠账＋走 grace；
  4. `scheduleAutoApplyGrace`：到期空闲时取 `pending = autoApplyNextShotIfEligible(run)`，欠账匹配则 `Promise.resolve(pending).finally(...)` → 再核 runId → 清欠账 → `scheduleProfileVerification('post-cup verification')`；顺延分支不触发、欠账保留；`startSequence` 清定时器时同清欠账。
- manifest version 2.2.62（description 397 字不动）；README 2.2.62 段；tests/verify_v02262.cjs／RESULTS_v02262.txt。

## 3. 时序契约

- **autoApply on 的 completed 杯**：杯末**零** profile 请求；`settlingBusy` 在 grace 窗内 false（`settledRunId` 已可见，APK 既有 700 ms 轮询直取）。
- **校验恰好一次**：apply 结束后一次 `'post-cup verification'`——applied／error／observation-only／waiting／manualCurveBlocksRun 早退都算数。apply 自身的 sync 成功时已置 `runtimeProfileVerified=true`，校验是二次确认；失败路径校验亦失败并记 `verification failed`。
- **autoApply off／非 completed reason／无 completed 杯**：维持旧行为（立即 `'sequence reset'`）。
- **取消**：`startSequence`（插件开新杯）清 grace 定时器 → 本次校验不跑、不新增请求；靠既有 `'machine idle'`（runtimeProfileVerified 为假时）与 `'workflowUpdated'` 兜底。
- **学习链不受影响**：finalize 内 summary／rememberAdaptiveEvidence／diagnosticLast 早于 autoApply。

## 4. 没动什么

`scheduleProfileVerification` 的 3 s 重试节流／`profileVerificationPending` 去重／`profileSyncIsIdle` 守卫全部保持原样；apply 状态机不动；控制律／写面／LUT／记忆／镜像不动；§0 杯内无新增请求；单写者。

## 5. 验证

- verify_v02262 **995/995，EXIT0**（986 基线＋9：杯末无立即 sync／grace 窗桥空闲＋settled 可取／apply 后校验恰好一次且校验链 0 写／autoApply off 立即／非 completed 立即／observation-only 早退仍校验／失败仍校验／startSequence 取消不补跑／顺延期间欠账保留）。
- 成对写序列回放（base b982d79 vs 新，history-18 近 4 杯）writes／status／oqTail／oqTailErr／observedR 全逐字。
- 本地串行桥：new 首个可取 781 ms（复跑；本机 774 ms），grace 窗内最大间隙 793/778 ms，apply 28.2 s 仍 applied。
- sim 5/5；node --check。
- **局限**：本地桥模型分辨力有限，base 2.2.61 在模型里也落 8.5 s 窗内（6935/6217 ms），不能当实证；真机杯 30 才是阻塞证据。3 s 节流可能吞 post-cup 校验，由 apply sync＋machine-idle/workflowUpdated 兜底。

## 6. 用户裁定记录（11-21）

1. 杯末校验后置做在插件侧（改码批授权）；发版/push 另问。
2. 发 2.2.62（明确批）；发版链沿 2.2.61 先例。
3. 本地实证里 base 也落窗内——如实记录，不写成「base 超窗」结论。
4. 3 s 节流可能吞 post-cup 校验、其它 clearTimer 路径不清欠账——按局限接受，不改语义。

## 7. 下一步

- 用户 Decaid 自装 2.2.62；装机不由插件包代做（包只推平板 `Download/`）。
- 真机验证计划：1 杯可执行 autoApply 的萃取 → 看杯末自动取分是否在 +8.5 s 内成功（不手刷）、ext-status settledRunId／settlingBusy 时序、autoApply 最终 applied。
- 若真机仍取不到分：下一步评估把 apply 链再拆段（评估文档 b/c 方案），须用户裁。

