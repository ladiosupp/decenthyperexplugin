# 交接：ProfileReplayer 真机接入 + UI 打磨会话收尾（2026-11-14 晚）

> 新对话任务（用户原话）：「继续做插件的判断和提醒」。具体范围用户没展开，**开工先问清**
> （候选理解见 §5），别自行假定。本文交代本会话做完的事、工作区现状、真机链路与回归方法，
> 让新对话不用重新考古。仓库规矩照 AGENTS.md（第 7 条四件事、第 20 条改代码/发版先问、第 16 条中文输出）。

## 1. 本会话已完成（全部真机验证过）

1. **无线调试接入**：pair 一次长期有效；connect `192.168.31.15:46113`，Decaid 端口 **8080**，
   配置 `app/tools/tablet.json`。掉线 `adb connect` 即可。配对弹窗必须亮屏保持打开，码几分钟过期。
2. **App 装机与取数**：ProfileReplayer 经 adb install -r 覆盖装（数据保留）；回环地址抓 HyperEx 67 杯全点。
   后台 FetchService 熄屏 10 分钟实测存活；已加电池优化白名单（dumpsys deviceidle whitelist +com.ladios.hxreplay）。
3. **UI 三改**（提交 `265cf1a`，分支 auto-hyperex）：
   - 选杯 fieldset 移侧栏最顶；列表按 startedAt 倒序、默认最新可回放杯；选旧杯后抓取/切语言不丢选择。
   - 状态卡固定 6 列一行（容器查询字号），320–1600px × 中英文 18/18 回归。
   - RAW dW/dt 轴尖峰剔除：只约束 RAW 线（轴按其 p99、画时跳过超阈值点），秤重/压力轴不受影响；15/15 回归。
   - 三张图表卡 ⠿ 把手长按 350ms 拖动排序，顺序持久化（App IndexedDB chartOrder / PC localStorage
     hx-replay-chart-order）；短按/按下即滑不触发；9/9 回归。PC sim/public/replay.* 同口径。
4. **PC 帧重放整块入库**（同提交）：/replay 页 + /api/frame/* 只读接口 + sim/archive-core.js +
   13/13、18/18 回归 + 桌面启动器 vbs。回归里「可逐帧杯数」已改按归档动态计算（原硬编码 53 会随归档涨红）。
5. **交接文档**：HANDOFF_2026-11-14-profilereplayer-tablet.md（接入与验证回执）、
   HANDOFF_2026-11-14-allcurves-record-replay.md（全曲线缺口盘点：温度五列没记，extractMachine 没取）。
6. **夸克**：修复版 v1.0 APK 已传「夸克网盘/来自：Codex」。v1.1/v1.2 的上传/发版**没做**，先问用户。

## 2. 工作区现状（重要：有别人未提交的活）

- HEAD `265cf1a`（本会话）。**recorder 对话（任务「recoder更新」，已 idle）的 v1.2 工作未提交**，
  留在工作区：FetchService.java（两路抓取累积进持久 buffer，上限 60 杯，pending-buffer.json）、
  HxBridge.java（takePending 读 buffer 读后清空、fetchStatus、isIgnoringBatteryOptimizations、
  openBatterySettings）、MainActivity.java（onResume 发 hxresume）、新文件 MergeCore.java
  （archive-core 的 Java 移植）、app/www/app.js 与 assets 里的 mergePending/白名单警示条/归档信息行。
- 本会话提交时只暂存了自己的 hunk（从 HEAD 重建 + 抽块），**对方的 hunk 原样留在工作区，没代提交**。
  新对话若改 app.js：先读现状、接着对方最新版改；提交仍只 add 自己这批，或等用户发话整批收。
- 当前平板上装的 APK = 本会话最后一次构建（含对方未提交的 Java/app.js 改动 + 本会话 UI），
  比 release/ 里任何包都新。release/ProfileReplayer-v1.2-debug.apk 是 recorder 对话 17:12 的包。
- sim/ 下别人未提交改动已随帧重放整块入库（经核对全属帧重放功能）；HANDOFF_2026-10-31.md 等
  历史遗留改动不是本会话的，没碰。

## 3. 常驻进程与链路

- **PC 轮询**：app/tools/tablet-sync.ps1 -IntervalSec 120 在本会话后台跑（每 2 分钟抓 HyperEx+recorder
  并入 D:/vscode/.tools/hx-data/hyperex-history-all.json，现 102 杯/95 全点）。**本对话结束后它会死**，
  新对话接手先重启它（提权）。中途偶发「积极拒绝」= 平板休眠断连，脚本下一轮 adb connect 自愈。
- sim 服务 4780 现在有一个在跑（桌面启动器起的，脱离会话存活）；要跑 frame-replay 回归直接用，别重起。
- 真机插件版本 **2.2.45**；仓库 HyperEx 已到 **2.2.46**（未真机验证，复测重点见其交接 §4）。
  recorder 插件 v1.0.0 已装平板（只记非 HyperEx 杯，runId 前缀 pr-）。

## 4. 真机操作配方（都需提权；沙箱里 adb/网络不可信）

- adb：D:\android-dev\sdk\platform-tools\adb.exe；设备 192.168.31.15:46113；先 adb connect。
- 构建：JAVA_HOME=D:\android-dev\jdk17\jdk-17.0.21+9；gradle=D:\android-dev\gradle\gradle-8.7\bin\gradle.bat；
  改网页后先 Copy-Item app/www/* app/src/main/assets/www/ 再 assembleDebug；install -r 覆盖装。
- CDP：先 svc power stayon true（熄屏时 Emulation/渲染会挂死），跑完恢复 false；
  pidof com.ladios.hxreplay 拿 pid，forward tcp:9223 localabstract:webview_devtools_remote_<pid>；
  /json 里挑 url 含 android_asset 的页（别挑到 Decaid 插件页）。
- 回归脚本（.tools/，不入库）：__app-cards-row-check.js（18）、__app-raw-axis-check.js（15）、
  __app-chart-drag-check.js（9）、__app-tablet-fetch-check.js。node 直接跑，传 wsUrl。
- Invoke-WebRequest 必须 -NoProxy（系统代理 57890 劫持回环）。PowerShell $pid 只读，换名。
- 截图取证丢 D:/vscode/.impeccable/review/（gitignore），回复里贴图用正斜杠绝对路径。

## 5. 「插件的判断和提醒」——待用户明确范围

用户没展开。候选理解（问的时候给选项）：
1. **recorder 归属判断**的真机验证与提醒：出一杯非 HyperEx 曲线看 recorder 记上、出一杯 HyperEx 看它不记
   （recorder 交接 §3.1，机器当时 sleeping 没测）；判断失败/漏记时在 App 或诊断页提醒。
2. **HyperEx 控制侧判断 + 提醒**：2.2.46 五条优化（盲灌压力保护/快杯 S2 学习窗/收口上行门/S3 反向门/
   中止杯研磨建议）的真机复测，触发时在诊断页/通知提醒。涉及控制律先读技能 decentplugin §22，冲突先问。
3. **App 侧提醒**：白名单警示条（对方已写未提交）、后台被杀/断连/归档到 150MB 门槛的提醒完善。
无论哪种：改代码/发版先问（AGENTS.md 20）；插件发版走 1.8xds 流程（版本号/新 verify/RESULTS/README）。

## 6. 文件清单

- 提交 265cf1a：app/www 与 assets 的 index.html/app.js（本会话 hunk）、两份交接、sim 帧重放整块。
- 未提交（recorder 对话的）：Java 三件 + MergeCore.java + app.js/assets 剩余 hunk。
- app/tools/：tablet-connect/sync/pull-app-archive + tablet.json。
- .tools/__app-*-check.js：真机 CDP 回归；.tools/__stage-mine.js：本会话拆 hunk 暂存的工具（可复用思路）。
- 夸克 skill：C:\Users\ladios\.agents\skills\quarkclouddrive（upload 不传 --parent-fid 默认进「来自：Codex」）。
