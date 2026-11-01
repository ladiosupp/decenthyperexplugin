# cut 7 验收 — S3 形状（v2.2.14）

日期：2026-11-01 · 范围：L-5、L-6、S3 形状/学习门按档位 · 基线：0fe8971（v2.2.13）

## 验收项

| 项 | 结果 | 证据 |
|---|---|---|
| L-5 `stage3ShapeOnlyConsensus` 整块删除 | 通过 | 源码不再含该标识；hook 不再注入；15 条串联门随函数消失 |
| S3 形状只有一个写入口（drift） | 通过 | `run.config.s3DriftModel` 已接线；开启时删除 legacy `suggestedShape`，apply 的 legacy 分支只在开关关闭时执行 |
| drift 能真正产出并写进曲线 | 通过 | 合成回放：EARLY<MID 实测 → earlyFactor>1、late 衰减 → drift<1，`s3ShapeStatus().model==="drift"`，profile 三帧同值；另有两条真机 2.2.4 证据交叉验证 |
| 形状门/学习门按 1/16 档位计（至少 1 档） | 通过 | `s3StepLimit = max(1/16, |cmd|×fraction, absolute)`；0.75 ml/s 处 4% / 0.05 / 0.0625 → 0.0625；单杯 6.7% 误差产出一档修正，1.3% 落 HOLD |
| 三处非递减拆除，只留相邻增幅 | 通过 | `projectS3Commands`、`curveLimits`、`applyCurveEditorDraft`；另清掉 `s3ShapeStatus` legacy 读回、stall 恢复与高级手动编辑器的同一限制 |
| 相邻增幅 ≤ max(+0.25 ml/s, ×1.35) 保留 | 通过 | 投影与保存两处均校验；混随机请求 800 次不变 |
| 曲线编辑器保存 EARLY>MID / LATE<MID 不降级 | 通过 | 保存后 `model:"drift"`、earlyFactor/drift 保留、profile 三帧 = 0.9375/0.75/0.6875；后续只改 S2 仍保留 drift 因子 |
| 只改补水参数不重写 S3 形状 | 通过 | 形状值不变时原样复制已存对象；既有测试「refill-only apply unchanged」仍绿 |
| UI 文案同步 | 通过 | UI_LANGUAGE_PAIRS 三条 + 静态页面 + 输入错误提示；英译覆盖测试全绿 |
| 安全门未删未弱化 | 通过 | 666 条全绿；限压、ACK/超时、帧确认、写入预算、profile truth、存储回读原样 |
| v02213 原样保留 | 通过 | verify_v02213.cjs / RESULTS_v02213.txt 未修改；它在 2.2.14 上因 hook 引用已删除函数而全红（预期） |
| 未碰 S2 补水段 | 通过 | `boundedRefillControlBase` / `boundedRefillCommand` / `stage2StartupPlan` / `s2RefillReturnReason` / `dispatchS2Startup` / `liveTrimTick` startup 分支均未改 |

## 测试

`node tests/verify_v02214.cjs` → **666/666 checks passed**（RESULTS_v02214.txt）。

新增 10 条：删除不变量、诊断快照携带 `s3DriftModel`、一档步幅、单杯一档修正 vs 半档 HOLD、drift 投影保持非单调、drift 学习并写曲线、编辑器保存 drift、后续保存保留 drift、因子越界被拒、真机 2.2.4 证据产出非空 drift。

## 真机交叉验证

`C:/Users/ladios/Downloads/hyperex-history (4).json`（30 杯，pluginVersion 2.2.5）：

- 最新杯 1793492759538-1（00:27，2.2.5）S3 = 0.777/0.777/0.777、origin=adaptive，**没有 evidence.s3**，逐帧 gain 无法重算；症状与 handoff 一致。
- 文件里 16 杯有 evidence.s3；两条 2.2.4 的 flat 指令 + 衰减响应喂给本版 drift：
  - 1793489532447-2（target 1.5，指令 0.569，实测 1.357/1.069/1.023）→ 0.5 / 0.625 / 0.625；
  - 1793490122135-1（target 2.0，指令 0.719，实测 1.446/1.442/1.253）→ 0.8125 / 0.8125 / 0.9375。
- 两杯都至少移动一档，证明「平直」不是物理必然；第一杯的 EARLY 偏高疑似旧 EARLY 含过渡，2.2.14 的沉降排除刚接线，需新真机数据确认。

## 根因记录（重要）

`driftShapeSuggestion` 一直读 `run.config.s3DriftModel`，而 `startDiagnostics` 构建的 `run.config` 从来没有这个键 → 函数恒返回 null；同一遗漏也让 EARLY 帧的 S2→S3 沉降排除（`stage3StabilityDiagnostics`）从未生效。这是「origin=adaptive 但形状全平」的直接原因，已在 2.2.14 修复并加测试锁住。

## 未决口径 / 风险

- `sameStage3Shape` 仍是 0.005（L-13，cut 8）：drift 每杯改形状，两杯难判「同形状」；保守/温和档要求 previous 时 drift 实际学不动。默认正常档不受影响。**建议 cut 8 优先。**
- drift 的 earlyFactor/drift 仍 ±20%/杯（比率步幅，与指令档位无关）。
- 最新真机杯缺 evidence.s3；≥5 ml/s 仍 0 稳态样本。两项都限制本轮能核对的范围。
- `s3DriftModel` 没有 manifest 设置项（内部开关，默认 true），关闭路径只为回退保留。

## 状态

未提交、未打 tag、未推送、未发版。工作区里其它对话的未提交文档未触碰。
