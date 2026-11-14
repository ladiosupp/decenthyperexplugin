# 交接：全曲线记录 + 回放（2026-11-14 第二轮，recorder 落地）

> 本文承接 `HANDOFF_2026-11-14-allcurves-record-replay.md`（现状盘点）。本轮已把 recorder 插件做出来并装上平板，
> App 双源抓取 + 体积门槛 + 分享桥也已装机验证。**HyperEx 介入的杯走 HyperEx 现有记录，recorder 只记其余杯，源头不重叠**（用户点名）。

## 1. 已完成

### profilerecorder.reaplugin v1.0.0（新插件，独立目录，已提交 5cbb0b0）

- 录制：stateUpdate 事件里 espresso 开始建 run、离开收 run；samples 100ms（上限3000）+ rawScaleSamples 秤快照（上限12000）+ events（上限300）。字段镜像 HyperEx 诊断采样；温度五列（mix/group/targetMix/targetGroup/steam）机器快照里有就记。
- 归属判定：杯结束后 2/5/8s 各查一次 HyperEx `/status`，`diagnosticSummary` 的 startedAt/endedAt 与本杯双窗匹配（±5s/±10s）→ 丢弃；12s 无证据 → 保留。卸载时未决杯一律保留（宁重勿丢，App 端 runId 去重）。
- 存储：host.storage 键 `profileRecorderHistoryV1`，滚动留最新 **4 杯**全点（用户确认，比原话 2 杯多留 2 杯防连杯丢数据）。
- 导出：`/api/v1/plugins/profilerecorder.reaplugin/history-export`，与 HyperEx 导出同形（kind HyperExHistoryExport, schema 1），runId 前缀 `pr-`。**archive-core 一行没改**。
- 只读：不写机器状态/曲线/设置。26/26 回归 `node tests/verify_v0100.cjs`。
- 已装平板：`PUT /plugins/<id>/source` + `POST enable`（需 extensions:manage token，见 §4）。status 正常、秤流已连。

### ProfileReplayer v1.1（APK 已装机，提交 c297f8b）

- 双源抓取：doFetch 抓 HyperEx 后自动抓 recorder（URL 由 HyperEx 地址推导，404=未装静默跳过）；后台 FetchService 两路都抓，pending 存 `{hyperex, recorder}`（App 兼容旧单份格式）。
- **MAX_SHOTS 200→0**：旧上限约 74MB，体积门槛永远到不了。归档不设杯数上限，由体积门槛管。
- **150MB 体积门槛**（不是 500MB：单 JSON blob 在 500MB 撞 V8 字符串上限，导出会崩）：到点 confirm 二选一——压缩备份并分享 / 清理最旧一半。两个动作独立，分享取消不会误删。
- 分享桥 `HxBridge.shareFile(name, mime, base64)`：写 cacheDir/share → FileProvider → ACTION_SEND，夸克在分享面板里。导出归档按钮在 APK 里改走它（原 blob 下载没有 DownloadListener，真机点了没反应——这是修了一个现存 bug）。
- gzip 用 WebView 自带 CompressionStream：真机 67 杯 5.2MB→0.5MB / 245ms。
- PC 侧 tablet-sync.ps1 加抓 recorder 导出并入 PC 归档。

## 2. 真机验证回执（2026-11-14 16:30）

- recorder 装机后 status：enabled、scaleConnected=true、historyLoaded=true。
- App 双源抓取：67 杯归档，新增 0 / 补全 0（recorder 0 杯，幂等）；合成 recorder 杯注入→合并→回放→持久化全通，测完已删。
- 合并内核回归 13/13；recorder 回归 26/26。
- **已知边界（非本轮引入）**：App 切后台时 WebView 的 fetch 回调会冻结（探针 fired 后一直 started），回前台立刻恢复。后台数据靠 FetchService（Java 层）抓，不受影响；但 takePending 仍只在冷启动合并（上一对话遗留，用户未答复是否补 visibilitychange）。
- frame-replay-check 18 项里「53 杯可逐帧」失败：PC 归档已从 53 涨到 55 杯，是测试里的硬编码期望过期，非功能回归。改测试期望前问用户（sim/ 有别人未提交改动）。

## 3. 还没做（下一轮）

1. **真机一杯验证 recorder**：需要用户在平板上出一杯非 HyperEx 曲线（当前选中「John Weiss开发的拉杆程序」正好是非 HyperEx），看 recorder historyShots 变 1、App 抓到、回放正常；再出一杯 HyperEx 确认 recorder 不记（归属判定生效）。机器现在 sleeping，没测。
2. **温度曲线进 HyperEx 记录 + 两端画温度图**：交接 §2 的缺口（extractMachine 补温度 → state.last* 缓存 → samples/rawScaleSamples 加列），涉及 HyperEx 发版 2.2.47，走 1.8xds 流程。recorder 侧温度列已就位。
3. **夸克上传实测**：分享桥已装机，但没真点过分享面板（需要用户操作）。前提平板装了夸克。
4. 150MB 门槛的真实触发没测（当前归档 5.2MB）；逻辑已代码审查 + 合成数据验证合并链路。

## 4. 安装 recorder 的口径（重要）

- Decaid 新版管理端点（PUT /source、enable、settings POST 等）要 `Authorization: Bearer <token>`，scope `extensions:manage`。
- token 在平板 Decaid：Decent Account 页 → API access tokens → Create → 开「Manage plugins and skins」。**只显示一次**。本轮用户已建（名字 codex），token 在平板剪贴板/页面上，我经 uiautomator dump 读到后用了。
- 安装脚本 `.tools/__pr-install.cjs`（PUT source + enable + status 核对）。重装/升级同路。
- 本地 ZIP 安装包 `release/ProfileRecorder_v1.0.0.zip`（根目录 profilerecorder.reaplugin/），也可在 Decaid Plugins 页 Install plugin → ZIP file 装。

## 5. 文件清单

- `profilerecorder.reaplugin/`：plugin.js / manifest.json / README.md / LICENSE / tests/verify_v0100.cjs（已提交）。
- `app/www/app.js` + `app/src/main/assets/www/app.js`：双源 + 门槛 + 分享（已提交，两份同步）。
- `app/src/main/java/.../FetchService.java` / `HxBridge.java` / `AndroidManifest.xml` / `res/xml/file_paths.xml`（已提交）。
- `app/tools/tablet-sync.ps1`：PC 轮询加 recorder（已提交）。
- `release/ProfileReplayer-v1.1-debug.apk`（已装机）、`release/ProfileRecorder_v1.0.0.zip`、`release/__build_pr100.ps1`（已提交）。
- `.tools/__pr-install.cjs` / `.tools/__cdp-eval.cjs`：安装与 CDP 探针（.tools 不入库）。

## 6. GitHub 仓库与发版（2026-11-14 已推，用户授权）

本轮新建了两个**公开**仓库（recorder 要能被平板 Decaid 从 GitHub Release 装，必须公开），各自独立、不带工作区里别人未提交的改动：

| 仓库 | 内容 | Release |
|------|------|---------|
| `ladiosupp/profilerecorder` | recorder 插件（plugin.js / manifest / README / LICENSE / tests，archive-core 附在 tests/ 下） | v1.0.0，带 `ProfileRecorder_v1.0.0.zip`（根目录 profilerecorder.reaplugin/） |
| `ladiosupp/profilereplayer` | App 全套（app/www + app/src + gradle + sim/archive-core + tools + APK） | v1.1，带 `ProfileReplayer-v1.1-debug.apk` |

- 平板装/更新 recorder：Decaid → Plugins → Install plugin → GitHub Release → `ladiosupp/profilerecorder`。
- 推送走本机 VPN 代理 `127.0.0.1:57890`（`HTTPS_PROXY`/`HTTP_PROXY`），gh 登录 ladiosupp。
- 独立仓库的两处自洽调整：recorder 测试 require 改成 `tests/archive-core.js`（26/26 仍过）；`tablet-sync.ps1` 的 hx-archive 路径改成可配置（`-Adb` 覆盖 adb 路径，合并仍用 hx-archive.mjs）。
- 本地 `decenthyperexplugin` 仓库的三个提交（5cbb0b0 / c297f8b / d9d689d）仍在原处，**没动它的远端 origin**。
- 干净仓库的 staging 目录在 `.tools/gh-profilerecorder` / `.tools/gh-profilereplayer`（.tools 不入库，可删）。

## 7. profilelibrary 已拉回本地（2026-11-14）

- `ladiosupp/profilelibrary`（公开，Profiles Library v2.0.0 插件）已克隆到 **`D:\vscode\profilelibrary`**。
- 内容：plugin.js / manifest.json / README / LICENSE / SOURCES.md / WORK_HANDOFF.md + snapshot/（离线快照）+ release/（ZIP）。3 个提交，HEAD `0bce7dd`。
- 与本轮 recorder/replayer 无代码耦合，独立项目。


