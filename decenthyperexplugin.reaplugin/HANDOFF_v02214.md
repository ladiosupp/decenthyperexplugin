# v2.2.14 交接 — S3 形状：删串联门、拆非递减、门槛按档位（cut 7 · L-5 / L-6）

## 0. 这一版是什么

S3 形状以前有两条并行通路：约 15 条串联硬门的 shape-only 共识，和 drift 模型。前者实际不可达；后者因为在生产的学习快照里没有 `s3DriftModel` 这个键，**从来没跑过**。真机证据：最新一杯（1793492759538-1，2.2.5，00:27）S3 形状是全平 0.777/0.777/0.777，origin 仍标 adaptive。本版删掉 shape-only 整块、让 drift 成为唯一写入者、拆掉三处非递减、把 S3 形状与学习门改成按 1/16 档位计。

基线：HEAD 0fe8971 = v2.2.13。本版未提交。

## 1. 改了什么（全在 plugin.js + manifest.json）

- **L-5 删除 `stage3ShapeOnlyConsensus`**（原约 15 条串联门），删除调用点。S3 形状只剩 drift 一个写入口。
- **drift 真正可达**：`startDiagnostics` 的 `run.config` 新增 `s3DriftModel: state.cfg.s3DriftModel === true`。这是「drift 没产出」的根因；同时 `stage3StabilityDiagnostics` 里 EARLY 帧的 S2→S3 沉降排除（`run.config.s3DriftModel === true && shape.model === "drift"`）现在才会生效。
- **新增 `s3StepLimit(command, fraction, absolute)`**：`max(1/16, |command|×fraction, absolute)`。S3 形状/学习门的最小可表达单位就是 1 个 1/16 档；4% / 0.05 ml/s 只作档内死区。
  - 套用：`projectS3Commands` 的逐帧上下界、两处 `bounded()`（正常两杯与 stall 恢复）、levelFactor 的 ±5%、`stage3SingleSuggestion` 的半档死区与步幅、`driftShapeSuggestion` 的 MID 步幅、`addGain` 的 S3 feed-forward、`nextShotAdaptiveSuggestion` 的最终形状回检。
- **L-6 三处非递减拆除**：`projectS3Commands`（不再合并单调块）、`curveLimits`（EARLY 可高于 MID；MID 只受「相对 EARLY 的相邻增幅」上限约束；LATE 同理）、`applyCurveEditorDraft`（不再抛「前≤中≤后」，改为 drift 因子 0.50–2.00 + 相邻增幅）。另外：`s3ShapeStatus` 读回 legacy 形状时不再因顺序拒绝；stall 恢复路径的 `mid=max(mid,early)`/`late=max(late,mid)` 删除；高级手动编辑器（`applyTestCommands`）的同一检查删除。相邻增幅 ≤ max(+0.25 ml/s, ×1.35) 全部保留。
- **曲线编辑器按 model 分支**：形状值不变时原样保留已存对象（只改补水参数不再重写 S3）；真正编辑形状时写 `model:"drift"` + `earlyFactor` + `drift` + `manual`/`manualTilt`，不再把 drift 降级成 legacy、不再让 `manualS3ShapeLocked` 失效。
- **drift 是唯一形状写入者**：`nextShotAdaptiveSuggestion` 在 `s3DriftModel===true` 时删除 legacy `suggestedShape`（drift 无修正就 HOLD）；`applyNextShotAdaptiveSuggestion` 的 legacy 分支只在 `s3DriftModel!==true` 时执行。
- **UI 文案**：「一档 = 1/16 ml/s…」「输入值按档位归档…」「当前控制点允许范围…」与静态页面同步为「S3 允许前段高于中段、后段低于中段；只限制相邻增幅」。
- 版本：plugin.js 与 manifest.json → 2.2.14。

## 2. 测试（tests/verify_v02214.cjs，666/666）

从 verify_v02213.cjs 复制，v02213 原样保留。**v02213 不能再跑 2.2.14**：它的 hook 注入引用了已删除的 `stage3ShapeOnlyConsensus`，每个用例在 setup 阶段就 ReferenceError（0 条通过），这是删除该函数的预期结果，不是回归。

测试侧改动：

- 删除 4 条 shape-only 用例与 3 条依赖它的 apply 用例，改成 drift 夹具（`syntheticRun(...,[1.4,1.8,2.4])` + `s3DriftModel=true`）继续验证 idle 门、DTO 回读、LUT 不变、上传失败回滚。
- 三条断言旧「4%/0.05 绝对步幅」与「非递减」的用例按新口径重写（per-frame ≤ max(policy, 一档)；只有相邻增幅上限）。
- 两条断言「订单约束」的曲线编辑器用例改成「EARLY 可高于 MID」。

新增 cut 7 验收：

- 删除不变量：源码不再含 `stage3ShapeOnlyConsensus`，hook 也不存在。
- 诊断快照携带 `s3DriftModel`（true/false 两向）。
- `s3StepLimit` 在 0.75 ml/s、保守档 = 1/16；普通档 ≥ 1/16。
- 单杯 6.7% 误差产出一档修正（`snapCommandFlow(early)` = 0.8125），1.3% 落 HOLD。
- drift 投影保持非单调形状（EARLY>MID>LATE 不被拉平）。
- drift 学习并写进曲线：`driftShape` 存在、`s3ShapeStatus().model === "drift"`、EARLY>MID、LATE<MID、profile 三帧同值。
- 曲线编辑器保存 EARLY>MID / LATE<MID 不降级；后续只改 S2 仍保留 drift 因子；0.50–2.00 之外的比率被拒。
- 真机 2.2.4 的两条 S3 证据（见 §3）喂给 `driftShapeSuggestion`，必须产出非空、admissible 的形状。

安全门测试（限压、ACK/超时、帧确认、预算、profile truth、存储回读）一条没删、没弱化。

## 3. 真机交叉验证

数据源：`C:/Users/ladios/Downloads/hyperex-history (4).json`（kind=HyperExHistoryExport、schema 1、pluginVersion 2.2.5、30 杯）。

- **导出确实覆盖 16 杯 `evidence.s3`**（不是整个导出都没有）；但**最新一杯 1793492759538-1（2.2.5，00:27）没有 `evidence.s3`**，它的 `commands.stage3.shape` 是 `0.777 / 0.777 / 0.777`、origin=adaptive。这一杯的逐帧增益无法从导出重算，只能确认「平直 + adaptive」这个症状。
- 最近 6 杯的 shape：2.2.2/2.2.3 = `0.798/0.798/0.849`（legacy），2.2.4 两杯 = 形状关闭（live trim），2.2.5 = `0.777/0.777/0.777`。也就是说从 10-29 22:47 起形状一直没有被学习改写。
- 两条带 `evidence.s3` 的 2.2.4 杯（flat 指令 + 衰减响应）在本版 `driftShapeSuggestion` 下：

| 杯 | target | 指令（flat） | 逐帧实测 | 2.2.14 drift 结果 |
|---|---|---|---|---|
| 1793489532447-2 | 1.5 | 0.569 | 1.357 / 1.069 / 1.023 | MID 0.625，early ×0.8 → 0.5，drift 1.0 → 0.625 |
| 1793490122135-1 | 2.0 | 0.719 | 1.446 / 1.442 / 1.253 | MID 0.8125，early ×1.0，drift 1.1538 → LATE 0.9375 |

  两杯都会至少移动一档，不再是「恒为平直」；这两条已固化成测试。注意 1793489532447-2 的 EARLY 非常高（1.357），很可能是旧导出里 EARLY 仍含 S2→S3 过渡；2.2.14 的沉降排除（刚接线成功）会改变这一点，**没有新真机数据前不下结论**。
- 无法做的：用最新 2.2.5 杯核对每帧 gain（缺 `evidence.s3`）；用高流量区（≥5 ml/s）核对任何东西（仍是 0 稳态样本）。

## 4. 未决 / 风险

- **`sameStage3Shape` 仍是 0.005 相等判据（L-13，cut 8）**：drift 每杯都会改形状，两杯几乎不可能被判成「同形状」。于是「保守 / 温和」两档要求上一条可比证据时，drift 实际学不动（这两档 `policy.rank<2`，`driftShapeSuggestion` 在没有 previous 时直接返回 null）。默认「正常」档不受影响，但用户若选了保守/温和，S3 形状仍然只会在第一次有 previous 时动一次。**这是 cut 8 的口径问题，建议优先处理。**
- drift 的 `earlyFactor`/`drift` 仍限制每杯 ±20%（比率步幅，与按档位计的指令步幅是两件事）。真机 EARLY 帧含过渡时，±20% 可能不够；等新导出再判。
- `s3DriftModel` 仍未出现在 manifest settings 里（内部开关，默认 true）；关闭它的路径只为回退保留，本轮没有 UI 入口。
- 曲线编辑器在 `shapeUnchanged` 时原样保留 `state.testOverrides.s3Shape`；如果这个对象是 legacy，只改补水参数会继续保持 legacy（这是有意的：不因无关保存而改写形状）。真正编辑 S3 值时才会写成 drift。
- 未提交、未打 tag、未推送、未发版。

## 5. 怎么验

```
cd decenthyperexplugin.reaplugin
node --check plugin.js
node tests/verify_v02214.cjs
```

预期 666/666。v02213 在 2.2.14 上会全红（hook 引用已删除函数），不要拿它当回归。
