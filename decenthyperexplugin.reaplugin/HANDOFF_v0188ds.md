# HyperEx 1.88ds handoff — 2026-10-31

开发版，版本号 1.88ds（非严格 semver）。五个预设 + 目标切换比例缩放。

## 1. 当前状态

- 版本号：manifest.json = 1.88ds、plugin.js PLUGIN_VERSION = 1.88ds。
- 测试：tests/verify_v0188ds.cjs 559/559（RESULTS_v0188ds.txt）。

## 2. 本轮改动

1. 预设：STORAGE_PRESETS="hyperExPresetsV1"，5 格；presets / presets-save / presets-clear / presets-apply 四个端点（manifest 已声明）。保存时抓当前 cfg 目标与 commandFlowSummary 的实际指令；应用时先把 pending 写进 hyperExPresetPendingV1，再 POST /plugins/<id>/settings 改三个目标；插件重载后按目标匹配落地 overrides（origin manual，presetSource 记录 slot），并同步曲线。
2. 目标缩放：rescaleOverridesForTargets 在读取覆盖、读取 LUT、flowMultiplier 刷新三处调用；条件为 LUT 存在且 schema>=3（不要求当前目标在量程内），按 stage1/2/3 的 新/旧目标比例缩放 mode==="manual" 的指令与 S3 三段，clamp 0.1–8，更新 targets 并写回，幂等；缩放后重写曲线。
3. 诊断页新增预设区（渲染 5 格：目标 → 指令、SAVE CURRENT / APPLY / CLEAR、状态行）。

## 3. 行为说明

- 改目标 2/5/1.5 → 2/6/2 且已有 S2=4.0：缩放为 4.8；S3 1.5→2 时 0.688/0.744/0.761 → 0.917/0.992/1.015。
- 没有覆盖指令时仍按 LUT 重新映射；目标超出量程则整表停用、三段 1:1（缩放不处理这种情况，因为它没有可缩放的指令）。
- 预设应用依赖设置重载；若设置写入失败，pending 会在 8 次轮询后丢弃并记录。

## 4. 真机待确认

1. 保存/应用/清除五格；应用后目标和指令同时到位，首杯偏差应明显小于“只改目标”。
2. 不做预设、直接改目标时，覆盖指令按比例缩放且曲线重写。
3. 预设应用后 S3 形状关闭，需重新启用时用曲线编辑器。

## 5. 坑

- commandFlowSummary 是扁平字段（stage1CommandMlS 等），不是 stage1.effective。
- 缩放只在 LUT 存在时执行；顺序上 LUT 可能晚于覆盖加载，所以读取 LUT 的分支里也要再调一次。
- 页面脚本在模板字符串里：不能出现反引号与美元花括号；本轮一次修改因反引号被工具层拒绝，改为字符串拼接。
