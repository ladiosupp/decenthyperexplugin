# 交接：ProfileReplayer 真机无线调试接入（2026-11-14）

> 新对话在 `D:\vscode\decenthyperexplugin` 打开。用户自己装 APK；本对话负责无线调试接入与数据链路。
> 配套脚本在 `app/tools/`，本文是口径与顺序。
> **后续任务交接**：插件全曲线记录 + 回放配套见 `HANDOFF_2026-11-14-allcurves-record-replay.md`（2026-11-14 新对话用）。

## 0. 现状

- App 名 **ProfileReplayer**（包名 `com.ladios.hxreplay`，**不换**）。APK：`release/ProfileReplayer-v1.0-debug.apk`。
- 功能：帧重放（顺/逆/暂停/逐帧/事件跳/变速/循环）、中英文切换（持久化）、归档存 IndexedDB、
  取数三路（贴 Decaid 地址抓 / 自动抓默认 2 分钟可选 / 本地 JSON 导入）、后台前台服务抓取（**真机未验**）。
- 合并内核 `sim/archive-core.js`（与 PC 归档 hx-archive 同口径：runId 去重、分量取最长）。
- 模拟器已端到端验过（100 杯归档注入→回放→i18n→持久化）。工具链在 `D:\android-dev`
  （jdk17、sdk、gradle-8.7；AVD `hxpad`）。构建：`gradle.bat -p . assembleDebug`（JAVA_HOME 指 jdk17）。
- 仓库多对话并行：`release/` 里别人的发版包不碰；只 add 自己这批。

## 1. 用户侧（已完成/进行中）

- 平板（红米，装 Decaid + HyperEx 插件）已开无线调试；用户自装 APK。
- 新对话向用户要：**配对码 + 配对端口**（「用配对码配对设备」弹窗）与**连接端口**（无线调试主页面）。
  配对码几分钟过期，现开现发。

## 2. 接入（需提权）

```powershell
.\app\tools\tablet-connect.ps1 -PairHost <ip:配对端口> -PairCode <码> -ConnectHost <ip:连接端口>
```

- 脚本：pair → connect → 扫平板监听端口逐个 forward 探测
  `/api/v1/plugins/decenthyperexplugin.reaplugin/status` → 认出 Decaid 端口 → 存 `app/tools/tablet.json`。
- 探测不到时让用户把平时贴的导出地址端口用 `-DecaidPort` 传入。
- 掉线重连：`adb connect <connect>`（不用重新配对）；平板深度休眠会掉。

## 3. 数据链路（只读，不写 Decaid/插件）

- **PC 轮询补全点**：`.\app\tools\tablet-sync.ps1 -IntervalSec 120`。
  经 forward 抓 `history-export` → 落 `.tools/hx-data/inbox/` → `hx-archive.mjs add` 并入 PC 归档。
  裁剪规则：导出全点只留最新 4 杯，轮询间隔必须小于出杯间隔×4；2 分钟默认足够。
- **取回 App 归档**（App 后台攒的那份，含 PC 掉线期间）：
  `adb shell pidof com.ladios.hxreplay` → `adb forward tcp:9223 localabstract:webview_devtools_remote_<pid>` →
  GET `http://127.0.0.1:9223/json` 拿 wsUrl → `node app/tools/tablet-pull-app-archive.js <wsUrl> <out.json>` →
  `hx-archive.mjs add <out.json>`。debug 包 WebView 调试默认可用。
- 两段互补：PC 轮询管连接期间，App 后台管断开期间；合并内核幂等，重复合并不增杯。

## 4. 真机待验（按顺序）

> **2026-11-14 15:05 验证回执（本对话）**：
> - 接入完成：pair 成功（第三次给码才成——前两次配对弹窗被熄屏关掉，端口作废，报
>   `protocol fault` / TLS `CERTIFICATE_UNKNOWN`；**配对全程平板必须保持亮屏且弹窗不关**）。
>   connect = 192.168.31.15:46113，Decaid 端口 = 8080，配置已存 app/tools/tablet.json。
> - 第 1 步 ✅：CDP 驱动 App 填回环地址点抓取，67 杯 · 67 全点 · 67 可回放
>   （脚本 .tools/__app-tablet-fetch-check.js）。
> - 第 2 步 ✅（10 分钟熄屏实测）：FetchService 全程存活、每 2 分钟落盘（14:54→15:02 时间戳连续）；
>   已 `dumpsys deviceidle whitelist +com.ladios.hxreplay`（可逆）。App 经 adb install -r 装的 v1.0-debug。
>   **已知边界**：takePending 只在页面启动时调用，切后台再回前台不触发（MainActivity 无 onResume 补调、
>   页面无 visibilitychange 监听）；且服务每轮覆盖 pending 只留最新一份。连接期间靠 App 自身
>   setInterval 抓（回前台后已验证在跑）；断开期间的数据要**冷启动 App** 或走 CDP 取回才合并。
>   是否补 onResume/visibilitychange 合并：待定，改代码须先问用户。
> - PC 轮询 ✅：tablet-sync.ps1 -IntervalSec 120 常驻（本对话会话），首轮 +2 新杯 2 补全，
>   后续幂等 0 增；PC 归档 102 杯 / 95 全点。
> - 第 3 步（本地导入）未验：需要用户在平板浏览器下载一份 JSON 后走「选择已下载的 JSON」。
> - 掉线重连只需 `adb connect 192.168.31.15:46113`；深度休眠掉线后端口可能变，届时看无线调试主页面。

> **2026-11-14 15:25 状态卡一行布局修复（本对话，用户点名「机器流量掉到第二行」）**：
> - 只改 `app/www/index.html` 的 CSS：`.cards` 由 auto-fit 改固定 6 列 `minmax(0,1fr)`；
>   `.card` 设 `container-type:inline-size`，k/v/s 字号用 `clamp(…,cqi,…)` 随卡宽收缩；
>   窄屏（≤600px / ≤340px）收 gap 与 padding；`.phasepill` 加 max-width+ellipsis 防溢出。
> - 回归脚本 `.tools/__app-cards-row-check.js`：CDP 模拟 320–1600px 九档宽 × 中英文，
>   断言 6 卡同行、数值不裁切、不出屏。**18/18 全过**（真机 WebView 实测）。
> - 已构建装机（adb install -r，数据保留），`release/ProfileReplayer-v1.0-debug.apk` 已同步为
>   修复版（SHA256 与 build 输出一致）。构建命令实际路径：JAVA_HOME=`D:\android-dev\jdk17\jdk-17.0.21+9`，
>   gradle=`D:\android-dev\gradle\gradle-8.7\bin\gradle.bat`（本文 §0 写的旧路径少一层目录）。
> - 坑：CDP 的 Emulation 改视口在**熄屏时会挂死**（页面无渲染），跑布局回归前先
>   `svc power stayon true`，跑完恢复 false。

> **2026-11-14 18:30 本对话后续 UI 改动（均已真机回归 + 装机）**：
> - 选杯 fieldset 移到侧栏最顶；列表按 startedAt 倒序，默认选中最新可回放杯，
>   选旧杯后抓取/切语言不丢选择（app.js rebuildCupList）。
> - RAW dW/dt 坐标轴：只约束 RAW 线——轴按其 p99 定、画时跳过超阈值突变点；
>   秤重/压力轴不受影响；曲线绘制加 plot 区 clip。回归 .tools/__app-raw-axis-check.js 15/15。
> - 三张图表卡（杯流/秤重/压力）标题栏加 ⠿ 把手，长按 350ms 拖动排序，顺序持久化
>   （App 存 IndexedDB chartOrder；PC replay 存 localStorage）。短按/按下即滑不触发。
>   回归 .tools/__app-chart-drag-check.js 9/9。PC 端 sim/public/replay.* 同口径。
> - **提交口径**：recorder 对话（01a1d8fb）已 idle，但其 v1.2 工作（Java 三件 + MergeCore.java +
>   app.js 的 mergePending/白名单警示）仍未提交，与本对话改动同处 app.js。本对话只提交自己的
>   hunk（选杯倒序 / RAW 轴 / 拖动排序）+ index.html + 交接文档 + sim 帧重放整块；
>   对方的 Java/MergeCore/app.js 剩余 hunk 留在工作区，不代提交。

1. App 抓平板 Decaid：地址 `http://127.0.0.1:<Decaid端口>/api/v1/plugins/decenthyperexplugin.reaplugin/history-export`
   （App 与 Decaid 同机，回环；WebView 已放行明文）。
2. 后台 2 分钟服务：开自动抓取 → 锁屏/切后台 10 分钟 → 看通知在不在、`takePending` 有没有攒下数据；
   红米省电可能杀前台服务，被杀就引导用户给 App 加「无限制」电池策略。
3. 本地导入：用户浏览器下载的 JSON 走「选择已下载的 JSON」。

## 5. 坑

- 沙箱里 adb/网络/进程列表都不可信，一律提权跑（AGENTS.md 第 10 条）。
- PowerShell 里 `$pid` 只读，变量换名；`Invoke-WebRequest` 必须 `-NoProxy`（系统代理 57890 会劫持回环）。
- IndexedDB 事务：`oncomplete` 挂在 **transaction** 上，不是 put 返回的 request（踩过，已修）。
- 配对端口 ≠ 连接端口；pair 一次即可，connect 可反复。
- 改 App 网页后必须 `Copy-Item app/www/* app/src/main/assets/www/` 再构建，assets 是打包来源。
- 用户输出一律中文；改代码/发版先问（AGENTS.md 第 20 条），本交接里的脚本只读不写平板。

## 6. 文件清单

- `app/www/`（index.html / app.js / archive-core.js）：App 网页源。
- `app/src/main/`：WebView 壳 + FetchService（后台抓）+ HxBridge（JS 桥）。
- `app/tools/`：tablet-connect.ps1 / tablet-sync.ps1 / tablet-pull-app-archive.js / tablet.json（接入后生成）。
- `sim/archive-core.js` + `sim/tests/archive-core-check.cjs`：合并内核与回归（13 项）。
- `sim/public/replay.*` + `sim/tests/frame-replay-check.cjs`：PC 仿真台帧重放页（18 项回归）。
- `.tools/__app-*.js`：模拟器 CDP 验证脚本（可复用于真机）。
