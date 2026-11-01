# HyperEx 2.2.5 handoff — 2026-11-01

2.2.4 真机三杯（07:29 / 07:32 / 07:42 本地）暴露两件事：S2 一直停在 3.6–4.0 g/s 没到 5，以及萃完 Decaid 卡死；状态栏 REAL 冻结已由 2.2.4 处理。

## 一、S2 没到 5：r 拿错了（两处）

实测（S2 后 40% 窗口，杯流用原始秤回归，指令用机器回显 target）：

| 杯子 | 稳态杯流 | 实际生效指令 | 真实 r | 2.2.4 用的 base |
|---|---|---|---|---|
| 2.2.3 16:03 | 3.91 | 2.81 | 1.39 | 2.5（LUT） |
| 2.2.4 23:29 | 5.30 | 4.44 | 1.19 | 2.5（LUT） |
| 2.2.4 23:32 | 4.15 | 3.13 | 1.33 | 2.625（gain-memory） |
| 2.2.4 23:42 | 4.31 | 3.50 | 1.23 | 2.5（LUT） |

- Bug A：`gainStageObservation` 的 S2 分支用 `cfg.stage2CommandMlS` 当分母，可杯内调流每杯都在覆盖它。2.2.3 那杯曲线写 5.527、泵实际 2.8，于是 r=3.91/5.527=0.71，被写进 gainMemory。
- Bug B：`gainMemorySuggestion` 拿不到当前杯阻力特征时直接返回 null，`boundedRefillControlBase` 于是掉回空粉碗 LUT（r=2.0 → base 2.5）。插件重载后的第一杯都是这条路。

修法：

- 新增 `stage2EffectiveCommand(run)`：取 S2 后段（60% 之后）`machineTelemetryValid` 的 `targetFlowMlS` 中位数；样本不足才退回 `cfg.stage2CommandMlS`。
- `gainMemorySuggestion` 在没有 regime 时退回 `memory.lastBucketId` 那个桶，返回对象带 `stale:true`；LUT 只作「从没出过杯」的兜底。
- 诊断页补水预览显示 `r x.xx 实测 / 空粉碗 LUT / 曲线`。

现存两个桶（g2 r=1.36、g3 r=1.63）是拿错指令算出来的，修正后要两三杯才会收敛到 1.25 附近（α 0.35–0.55）。要干净可以清 gainMemory，代价是丢掉这张纸的增益先验。

## 二、萃完卡死：历史文件没有字节上限

导出实测：21 杯带 fullRecord，12.4 MB——samples 3.97 MB、原始秤 3.59 MB、events 1.20 MB、trace 0.94 MB。上限只有 `HISTORY_FILE_MAX_SHOTS = 30`（按杯数）。

每次落盘的旧路径：整份 stringify → 写 → 回读 → `parseStoredJson` 12 MB → `adaptiveHistoryFingerprintKey`（内部是 `JSON.stringify(canonicalProfileValue(...))`）→ 再 `JSON.parse(pendingHistoryWrite)` → 再算一次指纹；随后 `restoreAdaptiveHistoryFromPersistentFile()` 和 `scheduleProfileVerification()`。一杯结束自动应用还会立刻再整份写一次。

2.2.5 的处理：

- `trimHistoryFullRecords`：最近 4 杯保留 `samples`/`rawScaleSamples`/`events`/`trace`；第 5–10 杯丢采样、保留 events 与 trace；更老只留 summary 与 evidence。真实数据 11.79 MB → 4.86 MB（−59%）。在 append 落盘前、以及启动读到文件时各跑一次。
- 落盘回读只比 `writeToken`，删掉第二次全量解析与两次 canonical 规范化。
- `recordNextShotApplied` 在 3 秒内合并进 `historyWriteDirty` 并延时 1.2 s 落盘，不再整份重写两次。
- 启动时压缩老文件的那次重写改成 `scheduleHistoryTrimWrite()`：3 s 后检查，非 idle 每 5 s 重试、最多 12 次，idle 才写。诊断页对历史文件只读不写。

## 三、S3 目标与实测不符

导出里最后一杯（23:42）跑的是 S3 target **2.0**，不是 3：`commands.stage3.desiredGS=2`、`workflowProfileCommands.stage3CommandMlS=0.75`，实际杯流 1.686；按机器回显 0.783 算 r≈2.15，自洽。`profileReadbackAt` 停在 23:37，之后没有重建过曲线。若界面上已是 3，说明那杯启动时曲线还是 2——需要确认改设置的时间，或检查设置改动是否触发了下一杯曲线重写。

## 四、仍未解决

- S3 波动（23:29 那杯 S3 段 1.33 / 0.73 / 0.31，late/early 0.23），需要下一杯 trace 分辨是 drift 形状还是救急反复触发。
- 诊断页打开时的 `calibration-status` 是否仍在拖住 Decaid（2.1.1 的教训：不要动 arming 与校准触发时机）。
- 状态栏 REAL 的冻结是否只是调流停止所致，2.2.4 已加回退，等真机确认。

## 五、测试

- tests/verify_v0225.cjs 627/627。
- 新增：S2 增益用机器目标（曲线基值写错也不污染 r）、无 regime 时用最近桶、trim 分级、回读 token 比对、首次写盘推迟到 idle。

