# v2.2.22 交接 — P2-1 drift 的 LATE 相邻增幅门（cut 7b）

## 0. 这一版是什么

第二轮复查 P2-1：drift 路径绕过相邻增幅上限。按最小修法，只补 **LATE 侧**：EARLY 高于 MID 是 drift 的合法形状（0.50–2.00），保持自由；LATE 超过 `max(MID+0.25, MID×1.35)` 时，读回、自动建议、应用与手动倾斜四条路径都要拦住。编辑器本来就有 `rise(qMid,qLate)`，这一版是让其它路径与它一致。

基线：5d7e5a9 = v2.2.21（698/698）。本版未提交。

## 1. 改了什么（plugin.js + manifest.json）

- **`s3ShapeStatus` drift 分支**：新增 LATE 边检查，超限返回 `enabled:false` + `stored S3 shape rejected: adjacent rise exceeds test bound`。容差 0.001 ml/s（吸收因子 4 位小数舍入）。
- **`driftShapeSuggestion`**：计划 LATE 超过上限时夹到上限内最大的 1/16 档（`floor(limit×16)/16`），并按夹后的 `late / mid` 重算 `drift`；夹完与当前指令相同则返回 null（HOLD）。
- **`applyNextShotAdaptiveSuggestion`**：写 drift 前再校验 LATE 边，超限同样夹住并重算 `drift`。
- **`applyTestCommands`（UI）**：手动倾斜的 `MID×drift` 超限时用与编辑器相同的提示拒绝。
- **`test-command-set`（服务端）**：同一道 LATE 检查，抛错（409），避免绕过 UI 写入非法形状。
- 版本：plugin.js / manifest.json → 2.2.22。

没有新增 EARLY 限制；`s3StepLimit`、学习门、S2 补水、`liveTrimTick`、增益记忆、桶几何均未动。

## 2. 测试（tests/verify_v02222.cjs，706/706）

从 `verify_v02221.cjs` 复制，v02221 原样保留；版本断言改 2.2.22。新增 8 条 P2-1：

- 已存 drift（mid .75 / drift 1.583 → late 1.1875）读回 rejected，profile 退回 3 帧；
- EARLY>MID（earlyFactor 1.45）仍合法，profile 5 帧；
- 曲线编辑器保存同一 EARLY>MID 形状成功并写成 drift；
- 合法 LATE（drift 1.1667 → late .875）正常读回；
- 手动 tilt=+1（drift .8 → late .6）仍 200 并保存；
- 直接写超限 drift → 409；
- 自动 drift：计划 late 1.1875 → 夹到 1.0；同值则 HOLD；
- 下一杯 override 不含超限 LATE。

安全门（限压、ACK/超时、帧确认、预算、profile truth、存储回读）一条没删、没弱化。

## 3. 证据与数字

- 旧行为：mid .75、drift 1.583 → late 1.1875；上限 max(1.0, 1.0125) = 1.0125。读回仍 enabled；自动路径照写。
- 新行为：读回 rejected；自动/应用夹到 1.0（1.0125 内最大 1/16 档），drift 重算为 1.3333；手动 tilt=+1 的 late .6 不受影响。
- 没有新的真机 JSON；最新真机杯仍缺 `evidence.s3`，S3 drift 上机待新导出。

## 4. 未决 / 风险

- `+0.25 ml/s` 在低 MID（< 0.714）时比 ×1.35 更宽；按公式判定，没有例外。
- 读回容差 0.001 只吸收因子舍入；因子精度若再降，需要复核。
- 夹到上限时 `drift` 会变化，suggestion 里显示的是夹后的值（不假装是模型原解）。
- 手动倾斜按公式永远在界内，UI 那道门是防御性的；服务端同款检查有测试覆盖。
- 未提交、未打 tag、未推送、未发版。

## 5. 怎么验

`cd decenthyperexplugin.reaplugin`
`node --check plugin.js`
`node tests/verify_v02222.cjs`

预期 706/706。v02221 仍可对 2.2.21 跑 698/698。

