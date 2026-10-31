# HyperEx 2.1.1 handoff — 2026-10-31

诊断页改回只读；加载路径减负（合并列表、迁移标记、延迟执行）。

## 1. 当前状态

- 版本号：manifest / PLUGIN_VERSION = 2.1.1。
- 测试：tests/verify_v0211.cjs 582/582（RESULTS_v0211.txt）。
- 改动面：`calibration-status`、profile 修复调度、启动期 profile 维护。控制律、校准、学习未改。

## 2. 为什么改

真机反馈两件事：进入诊断页时 GHC 闪一圈粉灯；Streamline 里 HyperEx 那条收藏在装皮肤后（以及跑完一杯学习后）消失。

- 闪灯：`calibration-status` 里原本 `await verifyAndRepairSelectedHyperExProfile('diagnostics refresh')`，会读机器状态 / 倍数 / workflow，必要时重写 profile 甚至 workflow；DE1 重载 profile 就闪灯。诊断页因此不是只读的。
- 收藏消失：Streamline 的收藏存的是 profile id（`favorite-profiles`），Decaid 的 profile 是内容寻址的（皮肤源码注释：content-addressed，id 随内容变）。插件每次改写内容都会让 id 变，皮肤那条收藏指向旧 id。减少无谓改写能显著降低触发概率，但**不能根除**——只要 profile 内容真的变了（学习后指令更新），id 仍可能变。根子在「插件写 profile ≠ 皮肤重指收藏」，需要皮肤侧配合（repointFavorite）才能彻底解决。

## 3. 改动

1. `calibration-status`：去掉 verify/repair 与强制倍数读取，只 `refreshFlowMultiplier(false)` + 返回 `calibrationStatusPayload()`。
2. `scheduleProfileVerification(reason, immediate)`：新增 10 分钟冷却（`PROFILE_REPAIR_COOLDOWN_MS`），冷却期内只记 `profileVerificationSkippedAtMs` 不发请求；工作流切换与「首页温度变化」按 immediate 走，SYNC 按钮直接更新时间戳绕过冷却。
3. 启动期维护：`onLoad` 不再直接调 `ensureProfileInstalled / ensureCalibrationProfilesInstalled`，改为 2 秒后执行；定时器纳入 `clearAllTimers`。
4. 列表合并：启动维护先读一次 `GET /profiles?includeHidden=true`，把数组传给 `ensureProfileInstalled(records)` → `syncHyperExProfile(..., records)` → `performHyperExProfileSync(..., records)` → `upsertProfile(profile, records)`，以及 `ensureCalibrationProfilesInstalled(records)`、`hideLegacyCalibrationProfile(records)`。upsert 在 PUT/POST 后把结果写回数组。
5. 迁移标记：`STORAGE_LEGACY_PROFILE = "legacyCalibrationProfileHiddenV1"`，迁移成功后 `storageWrite` 标题；重载时若标题相同直接跳过。

## 4. 实测（vm 假 host，统计 API 调用）

- 稳定态：5 → 2（`GET /machine/calibration` + `GET /profiles?includeHidden=true`）。
- 新装：8 → 5（1 次倍数 + 1 次列表 + 3 次 POST 建 profile）。
- 前 1.5 秒：只有 1 次 `GET /machine/calibration`（维护已推迟）。
- 诊断页 `calibration-status`：不再产生任何 PUT/POST，也不再读 `/workflow`（测试覆盖）。

## 5. 残留风险

- 收藏消失只能缓解不能根治：profile 内容变化 → 内容寻址 id 变化 → 皮肤旧收藏悬空。需要皮肤在检测到同标题 profile 换 id 时重新指收藏（Streamline 的 `repointFavorite` 只处理它自己的编辑）。
- 冷却 10 分钟内若真的发生漂移，修复会等到下一次触发（工作流切换 / SYNC / 冷却结束）。这是有意的取舍。
- 迁移标记按「旧标题」记忆；若换机器或恢复备份带回同一旧标题，不会重复迁移。

