# v2.2.13 交接 — 指令归档统一（cut 6 · Q-1 / L-14）

## 0. 这一版是什么

把「指令」统一到 DE1 驱动的 1/16 ml/s 档位。2.2.12 只有写入面归档，配置 / UI / 学习 / 比较四个面仍是未归档值，导致 `gain memory already maps to the current command` 不可达、AUTO APPLY 每杯重写内容寻址 profile。

基线：HEAD 56aba8d = v2.2.12。本版未提交。

## 1. 改了什么（全在 plugin.js）

- 新增 `COMMAND_EQUAL_TOLERANCE = 1/32` 与 `sameCommandFlow(a,b)`：两侧先 `snapCommandFlow`，相差小于半个档位视为同一条指令。
- `resolvedStageCommandFlow` 返回值过 `snapCommandFlow`：cfg、UI、学习、写入四面同源。
- `liveTrimControlCenter`：gain-memory 的 target/r、LUT 映射、profile 兜底三个返回值归档。
- `gainMemorySuggestion`：command 归档，`commandMlS` 直接存档位值（不再 round 3 位）。
- `driftShapeSuggestion`：mid / early / late 归档；`changed` 用 `sameCommandFlow`。
- `scalarLearningSuggestion` / `scalarConsensusSuggestion`：suggested 归档，HOLD 判定用 `sameCommandFlow`。
- 学习输出写回（applyNextShotAdaptiveSuggestion 的 stage1/stage2/s3Shape、expectedS1/S2、rescaleOverridesForTargets、手动覆盖保存）全部归档。
- `curveSetValue`：输入按档位归档，边界也按档位取整；UI 文案同步为「输入值按 1/16 ml/s 驱动档位归档」。
- `keep` 模式识别、apply 的读回校验（S1/S2 指令、S3 三帧指令）改用 `sameCommandFlow`。
- 版本：plugin.js 与 manifest.json → 2.2.13。

## 2. 测试（tests/verify_v02213.cjs，661/661）

从 verify_v02212.cjs 复制，v02212 原样保留。测试侧改动都是「旧断言写的是未归档口径」：curve 输入/拖动改为断言归档；predictive 中心 4.1875 / LUT 2.5；rescale 4.8125；S3 证据命令 0.688；drift mid 0.6875；读回比较用 `sameCommandFlow`。

新增 cut 6 验收：
- 任意 flow / stage 下 `resolvedStageCommandFlow` 都在档位上；`liveTrimControlCenter` 三个来源都在档位上；scalar / consensus 的 suggested 在档位上。
- 学习命令与曲线写入同值，`round(v*16)===v*16` 对 target×r 网格全覆盖。
- 真机对照：r=1.2874 → 旧 3.884 与曲线 3.875 恒不等（每杯 ADJUST），归档后相等。

## 3. 真机交叉验证

工作区里没有新的 history JSON 导出（`*.json` 只有 .impeccable 的合成夹具）。本轮用 REVIEW §1.4 的实跑记忆值做算术对照：r=1.2874、target 5 → 旧 3.884 / 曲线 3.875 / 差 0.009 > 0.005，恒 ADJUST；归档后 3.875 与曲线一致，HOLD 可达。这与 L-14 的记录一致。

## 4. 未决 / 风险

- **S3 档位粒度冲突（要用户定）**：0.75 ml/s 处一档 = 8.3%，而形状门是 4% / 0.05、正常学习门是 8%（0.06）。量化后 S3 形状与学习修正无法表达，会落成 HOLD。cut 7 处理 S3 形状时必须把门槛改成按档位计，否则「形状可学」在真机上仍然不可达。
- S3 形状共识 / 单杯路径的 suggestedShape 仍保留 3 位小数（cut 7 会重写这条链），它们在 apply 边界才归档；增益记忆、drift、scalar 三个学习输出已全档位。
- 未提交、未打 tag、未推送。

## 5. 怎么验

1. 安装 2.2.13，跑一杯，看 `nextShotApplied.commandFlows` 与曲线 step flow 是否完全相等（都应落在 x/16）。
2. 连续两杯条件相同，第二杯的 `nextShotAdaptive.s2.action` 应为 HOLD，reason 含 `gain memory already maps to the current command`，AUTO APPLY 状态不应再是 applied。
3. 曲线编辑器输入 3.99 应显示 4.0（最近的 1/16 档），不再是 3.9875。
