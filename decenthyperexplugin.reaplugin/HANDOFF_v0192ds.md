# HyperEx 1.92ds handoff — 2026-10-31

开发版，版本号 1.92ds（非严格 semver）。诊断页按步骤归位。

## 1. 当前状态

- 版本号：manifest.json = 1.92ds、plugin.js PLUGIN_VERSION = 1.92ds。
- 测试：tests/verify_v0192ds.cjs 563/563（RESULTS_v0192ds.txt）。

## 2. 本轮改动

1. STEP 2 的 details 现在包住：学习历史、下一杯已应用曲线、曲线编辑（curveEditor）、预设（presets）、上一杯指令快照、上一杯验证、S1/S3 稳定性、下一杯学习建议、实时数据（stats）。
2. REAL SCALE CURVES（id=weight-curves）留在 STEP 2 之后、STEP 3 之前，不折叠。
3. STEP 3 改为 details（id=step3，summary.stepHead），包住参考建议、高级/测试覆盖编辑、高级设置；STEP 4（复制 CSV）保持原样在外。
4. html.diagview 补 background-color:#171514，避免整页截图/超长滚动时露出白底。

## 3. 坑

- Step 3 的 head 从 div 改 details 时不要留下原来的 </div>，否则会把 details 提前闭合（本轮踩过一次，DOM 里 step3 变空）。
- 搬迁用整块字符串替换，改完数一次 <details>/</details> 平衡，并用 DOM 查 closest('#step2'/'#step3') 复核归属。

## 4. 真机待确认

1. 折叠态首屏是否只剩三步 + 实际秤重曲线 + STEP 4。
2. 展开 STEP 2 后各块顺序与滚动体验。
3. 展开 STEP 3 后高级设置可正常保存。
