v2.2.62：杯末校验后置（APK 杯末首取不再被 3–6 s 校验链堵住）

本版是用户 11-21 批的结算时序修复（relay-10 派单；改码批 128a40c，发版批代码零改）。manifest 2.2.62 / description 397 字不变。**控制律、写面、LUT、记忆、镜像全部零改。**

## 问题（真机杯 30）

杯 30（runId 1795253527486-1，2.2.61＋APK v0.38）endedAt 09:33:24.241Z → autoApply applied 09:33:42.667Z＝18.43 s（grace 生效、最终 applied、未取消），但 **APK 杯末自动取分失败**，用户约 +18 s 人工点刷新才拿到 87 分。2.2.61 只把 autoApply 移出 grace 窗；`resetSequence` 第一秒仍立即 `scheduleProfileVerification('sequence reset')`，其 3–6 s 同桥串行链仍占住 APK 8.5 s 首取窗。

## 修复

- **completed 杯＋autoApply on（已排队 grace）**：不再立即校验，记 `state.cupVerificationRunId`，由 `scheduleAutoApplyGrace` 到期后的 `autoApplyNextShotIfEligible(run)` promise `finally` 触发一次 `'post-cup verification'`。
- **恰好一次**：applied／error／observation-only／waiting（无建议）／manualCurveBlocksRun 早退都补。
- **autoApply off／reason 非 `completed at …`／无 completed 杯**：保持立即 `'sequence reset'` 校验。
- **取消**：`startSequence` 清 grace 定时器时同清欠账——本次校验不跑，依赖既有 `'machine idle'`／`'workflowUpdated'` 兜底，不新增杯内请求。
- `scheduleProfileVerification` 自身的 3 s 重试节流／去重／pending 旗标语义未改。

## 验证

- `tests/verify_v02262.cjs` **995/995，EXIT0**（986 基线＋9 条本批断言；两条 2.2.61 旧断言按新时序重编码：apply 后不再立刻断言 settlingBusy=false，改为等校验收敛；失败路径补 runtimeProfileVerified=false＋verification failed）。
- 成对写序列回放：base b982d79 vs 新，history-18 近 4 杯 writes／status／oqTail／oqTailErr／observedR **逐字**（V2262_WRITESEQ_VERBATIM=true）。
- 本地串行桥：new 首个可取分数 **781 ms**（统筹复跑；本机 774 ms），grace 窗内桥空闲（取数前最大间隙 793/778 ms≈轮询周期）、apply 28.2 s 仍 applied。
- sim-regression **5/5**；`node --check` 通过；manifest 2.2.62 descLen 397。

## 如实注记

- 本地串行桥模型分辨力有限：**base 2.2.61 在模型里也落在 8.5 s 窗内**（统筹复跑 6935 ms、本机 6217 ms），不能据此断言「base 也超窗」；阻塞的真机证据是杯 30 的「自动失败、手刷 87」。
- 3 s 节流可能吞掉 post-cup 校验（若 apply 结束时恰有别的校验在节流窗内）；此时 profile 真值由 apply 自身的 sync 保证，`'machine idle'`／`'workflowUpdated'` 仍兜底。属既有语义，未扩。
- 曲线编辑器／排除杯等其它 `clearTimer("autoApplyTimer")` 路径不清欠账字段（runId 不匹配，无副作用）。

## 兼容性

- 不改控制律／写面／LUT／记忆／镜像；`settlingBusy`／`settledRunId` 语义延续 2.2.61（scheduled＝非真占用，真占用才退避）。
- APK 无需新字段：本版只把窗内出站链移走。

## 真机验证计划

用户 Decaid 自装 2.2.62 后，完成 1 杯可执行 autoApply 的萃取，观察杯末自动取分是否在 +8.5 s 内成功（无需手刷）；同时看 ext-status 的 settledRunId／settlingBusy 时序与 autoApply 最终 applied。装机与真机模式切换不在本批。

详见包内 HANDOFF_v02262.md／README.md；批次细节见本地 HANDOFF_2026-11-21-v2262-defer-verify.md（不在包内）。

