# 2.2.62 杯末校验后置 · 实施交接（2026-11-21，统筹 relay-10 01a1fd38 派；用户 11-21 批，改码本批授权，发版/push 另问）

基线 **b982d79**（2.2.61 发版回执，分支 auto-hyperex）。代码实体 `decenthyperexplugin.reaplugin/plugin.js`。别人 WIP `HANDOFF_2026-10-31.md`（M）未碰、未暂存。

## 1. 问题实证（用户真机杯 30）

杯 30 runId **1795253527486-1**，插件 2.2.61＋APK v0.38：endedAt 09:33:24.241Z → autoApply **applied** 09:33:42.667Z＝**18.43s**（grace 生效、最终 applied、未 cancelled）；但 APK 杯末自动取分失败，用户约 +18s **人工点刷新**才拿到 87 分。

根因：2.2.61 只把 autoApply 移出 grace 窗，**resetSequence 第一秒仍立即 `scheduleProfileVerification('sequence reset')`**（3–6s 同桥串行链），吃掉 APK 首取窗。手刷时 apply 已完成、桥空闲，所以能取到。

## 2. 改动（plugin.js 4 处，控制律零触）

1. `PLUGIN_VERSION` 2.2.61 → 2.2.62（L8）。
2. `state.cupVerificationRunId: null`（autoApplyTimer 旁，L601）：本轮"校验欠账"只对这一个 runId 生效。
3. **resetSequence（~8916）**：先算
   `cupCompletion = !!(completedDiagnosticRun && /^completed at /i.test(reason) && state.autoApplyNextShot)`；
   仅 `!cupCompletion` 时立即 `scheduleProfileVerification('sequence reset')`；cupCompletion 时记 `state.cupVerificationRunId=run.runId`＋照旧置 scheduled＋`scheduleAutoApplyGrace(run, AUTO_APPLY_GRACE_MS)`。
4. **scheduleAutoApplyGrace（~5455）**：到期且空闲时取 `pending = autoApplyNextShotIfEligible(run)`；若 `state.cupVerificationRunId===run.runId` 则返回 `Promise.resolve(pending).finally(...)`——finally 里再核一次 runId（防中途取消）→ 清欠账 → `scheduleProfileVerification('post-cup verification')`。顺延分支（phase 非 idle / 桥非空闲）**不触发**校验，欠账保留。
5. **startSequence（~8947）**：清 autoApplyTimer 的同一分支里 `state.cupVerificationRunId=null`（取消即不补跑）。

未改：`scheduleProfileVerification` 的 3s 重试节流／`profileVerificationPending` 去重／`profileSyncIsIdle` 守卫；apply 状态机；控制律／写面／LUT／记忆／镜像。

其余文件：`manifest.json` version 2.2.62（**description 397 字不动**）；`tests/verify_v02262.cjs`（v02261 复制＋版本钉 4 处＋2 条旧断言按新时序重编码＋9 本批测试＋verificationCounter）；`tests/RESULTS_v02262.txt` 实跑；README 2.2.62 段；本交接。

## 3. 语义契约

- **autoApply on 的 completed 杯**：杯末**零** profile 请求；`settlingBusy` 在 grace 窗内 false（settledRunId 已可见，APK 既有 700ms 轮询可直取）。
- **校验恰好一次**：apply 结束后触发一次 'post-cup verification'——**applied／error／observation-only／waiting（无建议）／manualCurveBlocksRun 早退全部算数**。apply 自身的 sync 成功时已置 `runtimeProfileVerified=true`，所以校验是二次确认；失败路径 verify 亦会失败，`runtimeProfileStatus` 记 `verification failed: …`。
- **autoApply off / 非 completed reason / 无 completed 杯**：维持旧行为（立即 'sequence reset' 校验）。
- **取消**：grace 定时器被 startSequence（插件开新杯）清掉 → 本次校验不跑、不新增请求；靠既有 'machine idle'（`runtimeProfileVerified` 为假时）与 'workflowUpdated' 兜底。曲线编辑器／排除杯等其它 `clearTimer("autoApplyTimer")` 路径同理（欠账字段留着也不匹配新 runId，无副作用）。
- **不影响学习链**：finalize 内 summary／rememberAdaptiveEvidence／diagnosticLast 早于 autoApply；校验只读回写 profile 真值，`profileTruthVerified` 由 apply 的 sync 负责。

## 4. 验证（实跑数字）

- `node decenthyperexplugin.reaplugin/tests/verify_v02262.cjs` → **995/995 EXIT0**（986 基线＋9）。新增覆盖：杯末无立即 sync（profileSyncBusy 0、无 GET /workflow）／grace 窗桥空闲＋ext-status settled 可取／apply 后校验**恰好一次**（verificationCounter 计 1，且校验链 0 写）／autoApply off 立即／非 completed 立即／observation-only 早退仍校验／apply 失败仍校验（`verification failed`）／startSequence 取消后无 7000 定时器、无 GET /workflow、欠账清空／顺延期间不校验、idle 后 applied＋校验。
- 两条 2.2.61 旧断言按新时序重编码：「idle 到期单次应用」不再在 apply 后立即断言 settlingBusy=false（改为等校验收敛＋runtimeProfileStatus 含 post-cup verification）；「失败路径」同样等校验收敛，并补 `runtimeProfileVerified=false`＋`verification failed`。
- **成对写序列回放**：base `git show b982d79:…/plugin.js`（.tools/__v2262-plugin-base.js）vs 新，`__d18-writeseq.cjs` history-18 近 4 杯：6/6、6/6、5/5、3/3 笔 writes/status/oqTail/oqTailErr/observedR **逐字**，`V2262_WRITESEQ_VERBATIM=true`（.tools/__v2262-ws-{base,new}.json）。
- **串行桥实证**（.tools/__v2262-empirical.cjs，复用 2.2.61 探针机制；applying 11 腿 × 1909ms＝21s，杯末校验 8 腿 × 750ms＝6.0s 取实测上限）：base 2.2.61 **fetch 6217ms**（链 0–6.0s 全占桥、settlingBusy true，窗内轮询被逐腿挡住）；new 2.2.62 **fetch 774ms**（grace 窗空闲，取数前最大间隙 778ms≈轮询周期），apply 28.2s 仍 applied。`GRACE_VERIFY_PASS=true`（.tools/__v2262-empirical.json）。
- `node sim/tests/sim-regression.cjs` 5/5 EXIT0；`node --check` plugin.js／verify_v02262 均通过；manifest 2.2.62 descLen 397。

## 5. 局限（如实）

- 实证是本地模拟（宿主串行机制取自 2.2.61 真机探针 INBOUND_STARVED_DURING_OUTBOUND），**平板仍装旧版、装机属发版流程未授权**，真机陪杯待装 2.2.62 后另做。
- 6.0s 校验链在模拟里结束于 6.2s，仍落 8.5s 窗内；真机杯 30 的失败是「校验链 3–6s」与「7s 后 21s apply」首尾相连。本批把校验整体挪到 apply 之后，窗内不再有这两段出站链。
- 未改 scheduleProfileVerification 的重试节流：若 apply 结束时恰有别的校验挂在 3s 节流窗内，本次 'post-cup verification' 会被既有语义吞掉（此时 profile 真值由 apply 的 sync 保证，'machine idle'/'workflowUpdated' 仍有兜底）。属既有语义，未扩。

## 6. 复跑索引

- 回归：`node decenthyperexplugin.reaplugin/tests/verify_v02262.cjs`（995）；`node sim/tests/sim-regression.cjs`（5）。
- 写序列：`node D:/vscode/.tools/__d18-writeseq.cjs [plugin]` → 比对 __v2262-ws-*.json。
- 实证：`node D:/vscode/.tools/__v2262-empirical.cjs`（约 95s，3 变体；退出码＝PASS）。
- 代码锚点：`rg -n "cupVerificationRunId|post-cup verification|cupCompletion" plugin.js`。

## 7. 遗留

- **发版／push／tag／Release／夸克／平板推送／装机均未做**（统筹另派）。
- APK 侧无需新字段：settledRunId／settlingBusy 语义不变；本批只把窗内出站链移走。
- 若真机陪杯仍取不到分，下一步是评估把 apply 本身再拆段（评估文档 b/c 方案），须用户裁。

