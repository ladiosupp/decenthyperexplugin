# 交接：ProfileRecorder + ProfileReplayer 全曲线记录回放（2026-11-14 第三轮收尾）

> 本文是给新对话的接手交接。前序：`HANDOFF_2026-11-14-allcurves-record-replay.md`（现状盘点）、
> `HANDOFF_2026-11-14-profilerecorder-built.md`（recorder 落地 + App v1.1 + GitHub 发版）。本文记 v1.2 后台闭环与待办。
> **用户口径：HyperEx 介入的杯走 HyperEx 现有记录，recorder 只记其余杯，源头不重叠。不改 HyperEx 插件。**

## 0. 开工前必读

1. AGENTS.md 第 7 条四件事（git log / docs/plans / 文件级 log / git status）——**本仓多对话并行**，
   本轮就有另一对话提交了 `265cf1a`（选杯倒序/RAW尖峰/图表拖动）与 `6dbbfa5`。动 app.js 前先读现状，别盖别人。
2. 改代码/发版先问用户（AGENTS.md 第 20 条）。用户输出一律中文（第 16 条）。
3. 本对话已很长，用户要求收尾交新对话。**待办见 §4，别重做已完成的。**

## 1. 已完成（本会话，按提交）

| 提交 | 内容 |
|------|------|
| `5cbb0b0` | ProfileRecorder v1.0.0 插件（记录 HyperEx 之外的杯，源头不重叠，26/26 回归） |
| `c297f8b` | ProfileReplayer v1.1：双源抓取 + 150MB 体积门槛 + gzip 分享桥 |
| `d9d689d` | 交接：recorder 落地 + App v1.1 |
| `46f241b` | 交接补：GitHub 两仓库 + profilelibrary 拉回本地 |
| `d796bb9` | **ProfileReplayer v1.2：后台累积持久化 + 回前台自动合并 + 白名单提示** |

### recorder 插件（已装平板，GitHub Release 跟踪）
- 目录 `profilerecorder.reaplugin/`，id `profilerecorder.reaplugin`，v1.0.0。
- 录制：stateUpdate 里 espresso 开始建 run、离开收 run；samples 100ms（≤3000）+ rawScaleSamples 秤快照（≤12000）+ events（≤300）；温度五列有则记。
- 归属判定：杯结束后 2/5/8s 查 HyperEx `/status`，diagnosticSummary 起止双窗（±5s/±10s）匹配即丢弃；12s 无证据保留；卸载未决杯一律保留。
- 存储 host.storage `profileRecorderHistoryV1`，滚动留最新 4 杯全点。导出 `/history-export` 与 HyperEx 同形，runId 前缀 `pr-`，**带 profileTitle（曲线名）**。
- 平板上经 GitHub Release 重装，`source=github_release`、`releaseTag=v1.0.0`，Decaid 自动跟踪更新。

### App v1.2 后台闭环（本轮重点）
- `MergeCore.java`：合并内核 Java 移植（与 sim/archive-core.js 同口径）。
- `FetchService`：每轮把两路导出**累积合并**进持久 buffer `files/pending-buffer.json`（最近 60 杯），原子写（tmp+rename），记 lastFetchAt/bufferCups。**不再每轮覆盖**——用户几天不开 App 数据也在服务里攒着。
- `HxBridge.takePending` 读累积 buffer（读后清空，兼容旧 pending 键）；新增 `fetchStatus` / `isIgnoringBatteryOptimizations` / `openBatterySettings`。
- `MainActivity.onResume` 发 `hxresume` 事件；网页 `visibilitychange` 双保险 → 回前台自动 `mergePending`。
- 白名单警示条：不在电池优化白名单就显示提示 + 一键跳设置；归档信息行显示「后台已攒 N 杯 · 上次抓取 时间」。
- APK：`release/ProfileReplayer-v1.2-debug.apk`（已装机）。

### GitHub（已推，用户授权）
- `ladiosupp/profilerecorder`（公开）Release v1.0.0 带 ZIP。
- `ladiosupp/profilereplayer`（公开）Release v1.1 带 APK。**注意：GitHub 上还是 v1.1，v1.2 尚未推/发版**（见 §4）。
- 推送走 VPN 代理 `127.0.0.1:57890`，gh 登录 ladiosupp。
- profilelibrary 已克隆到 `D:\vscode\profilelibrary`（Profiles Library v2.0.0，独立项目，与本轮无耦合）。

## 2. 真机验证回执

- recorder 装机：enabled、scaleConnected、historyLoaded 正常；当前选中曲线「John Weiss开发的拉杆程序」（非 HyperEx）。
- 后台 buffer 累积：60 杯 / 5.2MB 落盘 `pending-buffer.json`，服务前台存活 42min+，电池白名单在列。
- 白名单检测：已在白名单 → 无警示条（正确）。
- gzip：67 杯 5.2MB→0.5MB / 245ms。分享桥 shareFile 在位。
- 合并内核回归 13/13；recorder 回归 26/26。

## 3. 已知问题 / 坑（务必看）

1. **回前台合并的 CDP 验证没跑完**：本会话末 CDP 的 `/json` 端点返回空列表（WebView 调试 socket 是沙箱进程 pid，
   不是 App 主进程 pid；`/proc/net/unix` 里查 `webview_devtools_remote_<pid>` 取正确 pid）。
   合并逻辑代码已就位，但「buffer 并进归档使杯数变化」这一步**没在真机最终确认**（当时 buffer 全是已存在的旧杯，
   去重后本就不新增，需出一杯新杯才能看出 +1）。新对话先修 CDP 连接再验。
2. **HyperEx 历史杯没有曲线名**：`compactPersistentShotRecord` 落盘没带 profileTitle，PC 归档 102 杯全空。
   **用户已明确：不改 HyperEx 插件，replayer 端自己补显示**（见 §4）。recorder 新杯自带 profileTitle。
3. **App 切后台 WebView fetch 冻结**：回前台恢复；后台数据靠 Java 服务抓不受影响。这是 WebView 特性，非 bug。
4. **frame-replay-check「53 杯可逐帧」**：另一对话已改成按归档动态计算（265cf1a），不再硬编码。
5. CDP 探针脚本 `.tools/__cdp-eval.cjs`（异步评估易超时，用 window 变量存结果分步读）；安装脚本 `.tools/__pr-install.cjs` / `__pr-ghinstall.cjs`。

## 4. 待办（交给新对话，按优先级）

1. **replayer 端补曲线名显示**（用户点名，不改插件）：杯列表 / 杯信息（renderCupInfo / rebuildCupList）显示 profileTitle。
   HyperEx 旧杯没有该字段→显示「—」或回退；recorder 新杯有。数据侧不用动。
2. **真机出一杯验证全链路**：用户要跑拉杆曲线（非 HyperEx）。预期：recorder 记上（~12s 归属判定后落盘）→
   replayer 抓取/回前台合并 → 杯数 +1、带曲线名、可回放。再出一杯 HyperEx 确认 recorder 不记（不重叠）。
3. **修 CDP 连接并最终确认回前台合并**（§3.1）。
4. **v1.2 推 GitHub + 发版**（用户授权后）：profilereplayer 仓库现在还是 v1.1，需同步 v1.2 代码 + 发 Release 带新 APK。
   staging 目录 `.tools/gh-profilereplayer`（.tools 不入库）。
5. （可选，前序交接遗留）温度曲线进 HyperEx 记录 + 两端画温度图——涉及 HyperEx 发版 2.2.47，**用户本轮说不改插件，先搁置**。

## 5. 文件清单

- `profilerecorder.reaplugin/`：插件全套（已提交、已装机、GitHub 跟踪）。
- `app/www/app.js` + `app/src/main/assets/www/app.js`：v1.2 网页（两份同步，已提交）。
- `app/src/main/java/com/ladios/hxreplay/`：MergeCore / FetchService / HxBridge / MainActivity（已提交）。
- `release/ProfileReplayer-v1.2-debug.apk`（已装机、已提交）；`release/ProfileRecorder_v1.0.0.zip`。
- `.tools/__cdp-eval.cjs` / `__pr-install.cjs` / `__pr-ghinstall.cjs`：调试与安装脚本（不入库）。
- GitHub staging：`.tools/gh-profilerecorder` / `.tools/gh-profilereplayer`（不入库，可删）。

