# 交接：ProfileReplayer v1.3 发版收尾（2026-11-14 晚）

> 前序：`HANDOFF_2026-11-14-replayer-ui-session.md`（真机接入/UI）、
> `HANDOFF_2026-11-14-profilerecorder-v12-handoff.md`（v1.2 后台闭环）。本文记 v1.3 两项新功能与发版回执。
> 仓库规矩照 AGENTS.md（第 7 条四件事、第 20 条改代码/发版先问、第 16 条中文输出）。

## 1. 本会话已完成（用户授权：选杯曲线名 + 弹窗 + 真机回归 + GitHub/夸克发版）

1. **选杯列表：时间 · 曲线标题 · 状态**（提交 `90fef02`，分支 auto-hyperex）。
   - HyperEx 杯统一 `HyperEx Pulse Filter (auto/on/off)`：mode 取 `releaseMode`，老数据按标题 auto 后缀认，再老默认 on（102 杯交叉核对零冲突）。
   - recorder 杯（runId `pr-` 前缀）显示 `profileTitle`（真实曲线名）；合并内核全字段拷贝，无需改内核。
   - 状态归一「完成/中止」（EN completed/aborted），异常杯保留原始描述。原「N 帧/N 采样」中段标签去掉。
   - PC `/replay` 同口径：`sim/server.js` 的 /api/frame/shots 增 profileTitle/releaseMode/workflowTitle 三字段，`sim/public/replay.js` 同公式。
2. **启动插件安装检测弹窗**（同提交）。
   - `HxBridge.checkPlugins(baseUrl, callback)`：原生 HTTP 子线程读 Decaid `/api/v1/plugins`（**无 CORS 头，WebView 直接 fetch 会被拦**），只取 id/version/loaded，经 `MainActivity.runOnWeb` 回调 `window.__hxPluginCheck`。
   - `HxBridge.openUrl`：系统浏览器打开 GitHub Release 页。
   - 网页：启动静默检测，两支齐不打扰（状态回就绪）；缺任一支弹窗（已安装带版本/未安装红标 + 每缺支一个 GitHub 按钮 + 稍后/重新检测）；不可达只顶栏黄字提示。浏览器环境无桥时直接 fetch 兜底（跨域失败按不可达）。
   - 示意图经用户审过：`.impeccable/mocks/plugin-check/plugin-check-mock.html`（已入库口径在 mocks/）。
3. **版本号**：build.gradle versionCode 4 / versionName "1.3"（GitHub 此前 v1.1，v1.2 未发过，顺延 v1.3）。

## 2. 真机回归回执（平板 192.168.31.15:46113，v1.3 已装机）

- 插件检测弹窗 **18/18**（`.tools/__app-plugin-check.js`）：真机启动检测两支齐不弹、缺 recorder/两支缺、稍后/重新检测、不可达、中英文、loaded=false。
- 选杯标签 **11/11**（`.tools/__cup-label-check.js`）。
- 状态卡 **18/18**、RAW 轴 **15/15**、图表拖动 **9/9**（既有三套，口径修正后复跑）。
- PC 帧重放接口 **18/18**（临时 4781 测试服务，没动 4780 常驻）。
- **CDP 坑（重要）**：WebView 异步求值（awaitPromise）会挂死，表现为脚本空输出/TIMEOUT；**重启 App 即恢复**（force-stop + monkey 拉起 + 重新 forward）。同步求值不受影响。回归脚本连跑时尤其容易触发，建议每套之间重启 App。
- 旧回归脚本口径修正：选杯标签改版后 option 不再带「仅事件」字样，`__app-cards-row-check.js` / `__app-raw-axis-check.js` 改按 `cups` 数据挑杯（playable / events+trace）。

## 3. 发版回执（用户授权）

- **GitHub**：`ladiosupp/profilereplayer` main 推到 `bb3d558`（含 v1.2 的 FetchService/MergeCore + v1.3 全部）；Release **v1.3** 带 `ProfileReplayer-v1.3-debug.apk`（2,017,849 字节，SHA256 02b86ec1…）。
  - https://github.com/ladiosupp/profilereplayer/releases/tag/v1.3
  - staging：`.tools/gh-profilereplayer`（.tools 不入库）；推送走 VPN 代理 127.0.0.1:57890，token 经 git credential fill（gh keyring 的 token 失效，GH_TOKEN 覆盖）。
- **夸克**：APK 已传「夸克网盘/来自：Codex」，fileId `a8cbbc08fb7f42b196bbeea14967c5ea`，一次成功。
- 本地提交 `90fef02` 只 add 自己这批 10 个文件；`HANDOFF_2026-10-31.md` 的他人改动没碰。

## 4. 工作区现状

- HEAD `90fef02`（本会话）。recorder 对话的 v1.2 已入库（`d796bb9` / `2270a75`），工作区无他人未提交代码改动。
- 平板装的 APK = v1.3（versionName 1.3，lastUpdateTime 2026-11-14 19:10）。
- PC 轮询 `tablet-sync.ps1 -IntervalSec 120` 本会话后台跑（提权 session）；**本对话结束后会死**，新对话接手先重启。
- sim 4780 常驻服务没动；4781 测试服务已停。

## 5. 待办（交新对话）

1. **recorder 归属判断真机验证**（前序交接 §4.2 遗留）：用户跑一杯非 HyperEx 曲线（如拉杆程序），预期 recorder 记上（~12s 归属判定）→ replayer 抓取/回前台合并 → 杯数 +1、带曲线名、可回放；再出一杯 HyperEx 确认 recorder 不记。选杯列表的 recorder 曲线名显示已就位，等真机数据验证。
2. **HyperEx 2.2.46 控制侧复测**（前序交接 §5.2）：涉及控制律先读 decentplugin 技能 §22，冲突先问。
3. （可选）温度曲线进记录 + 两端画温度图——涉及 HyperEx 2.2.47 发版，用户此前说不改插件，先搁置。

## 6. 文件清单

- 提交 90fef02：app/www 与 assets 的 app.js/index.html、HxBridge.java、MainActivity.java、build.gradle、sim/public/replay.js、sim/server.js、release/ProfileReplayer-v1.3-debug.apk。
- 回归脚本（.tools/，不入库）：__app-plugin-check.js（18）、__cup-label-check.js（11）、__app-cards-row-check.js / __app-raw-axis-check.js / __app-chart-drag-check.js（口径已修正）。
- 示意图：.impeccable/mocks/plugin-check/（html + png）。
- GitHub staging：.tools/gh-profilereplayer（不入库，可删）。
