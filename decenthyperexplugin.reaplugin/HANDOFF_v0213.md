# HyperEx 2.1.3 handoff — 2026-10-31

在 2.1.2（= 2.1.0 行为）上只加两处无时机变化的优化。

## 1. 当前状态

- 版本号：manifest / PLUGIN_VERSION = 2.1.3。
- 测试：tests/verify_v0213.cjs 582/582（RESULTS_v0213.txt）。
- 基线：`plugin.js` = v2.1.0 的行为（2.1.2 回退版）；本版仅新增共享列表与迁移标记。

## 2. 改动

1. 共享 profile 列表：`onLoad` 里先读一次 `GET /profiles?includeHidden=true`，把数组依次传给 `ensureProfileInstalled(records)` → `syncHyperExProfile(false,'startup maintenance',records)` → `performHyperExProfileSync(...,records)` → `upsertProfile(profile,records)`，以及 `ensureCalibrationProfilesInstalled(records)`、`hideLegacyCalibrationProfile(records)`。upsert 在 PUT/POST 后把结果回填数组。
2. 迁移标记：`STORAGE_LEGACY_PROFILE = "legacyCalibrationProfileHiddenV1"` 记住已隐藏的旧标题，重载时标题相同直接跳过。
3. **没有**做的：`calibration-status` 保持 verify/repair；没有修复冷却；没有启动延迟。

## 3. 实测

- 稳定态：5 → 2 次请求（`GET /machine/calibration` + `GET /profiles?includeHidden=true`），且 1.5 秒内全部发生（无延迟）。
- 新装：8 → 5（1 次倍数 + 1 次列表 + 3 次 POST 建 profile）。
- `calibration-status` 仍会读 `/workflow`（测试覆盖，证明 repair 没被削弱）。

## 4. 真机确认（2026-10-31）

- 2.1.2 装到平板后先确认：首杯能正常启动 controller、HyperEx 介入控制；冲洗出水完成后状态正常退出、计时停止。
- 确认后发布 2.1.3，用户反馈「目前没有问题」。

## 5. 风险与回滚

- 共享数组在并发改写时可能短暂过期（毫秒级窗口），upsert 写完会回填；若发现 profile 未按预期更新，回滚到 2.1.2（纯 2.1.0 行为）。
- 若真机再出现 arming 问题，先回 2.1.2，再排查，不要继续在 2.1.3 上加改动。

