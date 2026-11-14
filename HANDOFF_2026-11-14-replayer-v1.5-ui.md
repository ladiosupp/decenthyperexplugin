# 交接：ProfileReplayer v1.5 UI + DE1 状态省电（2026-11-14 深夜，本地已提交、未发版）

> 前序：HANDOFF_2026-11-14-replayer-ui-next.md（v1.4 后继续 UI 的开场材料）、
> HANDOFF_2026-11-14-replayer-v1.4.md。通用坑唯一维护处：技能 android-tablet-apk-dev
> （SKILL.md 硬规矩 + references/pitfalls.md，按条号引用）。
> 仓库规矩照 AGENTS.md（第 7 条四件事、第 20 条改代码/发版先问、第 16 条中文输出）。

## 0. 一句话现状

v1.5 代码已本地提交（分支 auto-hyperex），**未 push、未发 GitHub Release、未传夸克**（用户本轮只要本地提交+交接）。
平板与模拟器都已装最终 v1.5 包（versionCode 6 / versionName 1.5）。
工作流仍是「模拟器预览 → 用户确认 → 一次性装平板」。

## 1. 本轮改动（用户逐条点名，均已实现）

### DE1 状态胶囊 + 省电（核心诉求：别永远两分钟一抓）
- 顶栏胶囊：固定文字「咖啡机状态」+ 状态（睡眠蓝/待机绿/萃取中橙呼吸/未连接灰），只显状态不带其他数据。
- **胶囊高度与抓取按钮一致**：两者同 font-size 13 / line-height 1.5 / padding 7px（窄屏 12/6px），CDP 量过 1280/600/480 三档等高。
- 前台网页每 10s 经原生桥读 /api/v1/machine/state（Decaid 无 CORS 头，WebView 直接 fetch 被拦，同 checkPlugins 路子）；回前台先读 SharedPreferences 缓存秒显。
- **省电三层门控**：
  1. 灭屏总闸：FetchService 注册 SCREEN_ON/OFF 广播，灭屏停掉抓取定时器（零轮询零网络），亮屏恢复；
  2. 后台细闸：每轮抓取前先查 DE1 状态，sleeping 跳过本轮（查询失败/未知不拦）；
  3. 前台细闸：自动抓取到点先看状态，睡眠跳过；页面 hidden 时前台定时器不发起网络。
- 桥新增 machineState(baseUrl, callback) / lastMachineState()；FetchService 新增 machineState(url) 写同一份缓存。
- FetchService 的 tick/screenOn 改 volatile，worker 重排前判 tick == this 防 SCREEN_ON 重建后旧 worker 重复排程；门控动作打 HxFetch logcat 便于真机核。

### 图表区（三卡）
- 每个卡片的图示上移到**它自己**标题行：图例靠左、标题文字靠右（三卡左缘对齐）。
- RAW 改**滑块**（隐藏 checkbox 保留 id/rawToggle + change 事件，回归兼容），放在「杯流」文字左侧。
- 画布内不再画图例文字；renderChartLegend() 按卡渲染，RAW 开关时图示增减。

### 状态卡（6 → 7）
- 列宽不等分：时刻/相位宽，秤重/decaid/压力/RAW 收窄，机器流量/目标最宽（grid fr 见 index.html .cards）。
- **七卡标题与主数值同一字号**（以整行 .cards 为容器基准 cqw，clamp(9px,1.6cqw,16px)）；辅助小字单独缩小（vs/s）。
- 时刻：帧计数与秒数同行（行内短标签，英文 f）；副行清空。
- 相位：胶囊 + 帧数字同行，**只留数字**（逻辑帧 · 物理帧 中文去掉）；recorder 杯无相位记录显示「无」不显示 recording。
- RAW dW/dt 独立成第 6 卡（从 decaid 杯流副行移出）。
- 第 7 卡标题「机器流量/目标流量」，两值用 / 合并一行、同字号，副行清空。
- **去单位**：decaid 杯流 / RAW 的 g/s、压力的 bar、机器流量的 ml/s 都去掉（秤重保留 g）。
- 窄屏 ≤560px 三列、≤400px 相位卡跨两列（防裁切）。

## 2. 验证回执（最终包，11 套 × 两设备全绿）

- 模拟器（emulator-5554）与真机（192.168.31.15:46113）同套全过：
  layout 14/14、gesture 38/38、cup 12/12、plugin 18/18、fetch 13/13、cards-row 18/18、
  raw-axis 15/15、chart-drag 9/9、de1 12/12、legend 8/8、cards-content 12/12。
- 日志：.tools/__reg-*.log（真机）/ __emu-*.log（模拟器）。
- **真机首跑 layout 3 项 / gesture 4 项失败是锁屏压视口假失败**（innerWidth=0、hidden=true，pitfalls 11）：
  `wm dismiss-keyguard` 解锁 + am start 拉前台后复跑即 14/14、38/38。回归编排前务必先解锁。
- 回归脚本（.tools/，不入库）：__de1-check.js / __cards-content-check.js / __legend-check.js /
  __app-cards-row-check.js（7 卡口径）/ __tablet-regress.ps1（编排，-Device/-Port/-Tag 参数化，每套之间重启 App）。
- **真机字体度量与模拟器不一致**：列宽在真机 600/1024 档曾裁切，靠「去单位 + 统一字号 + 收窄相位」收口（用户口径），别再按模拟器像素调列宽。

## 3. 工作区 / 进程

- HEAD：本提交（v1.5）。recorder 对话的 v1.0.1 已自行提交（2aa7241），其 HANDOFF_2026-10-31.md 仍未提交，**别碰别代提交**。
- 提交只 add 自己这批：app/build.gradle、app/www/{app.js,index.html}、app/src/main/assets/www/{app.js,index.html}、
  app/src/main/java/.../{HxBridge,FetchService}.java、release/ProfileReplayer-v1.5-debug.apk、本交接。
- 还活着（提权侧）：模拟器 hxpad、预览服务 4790（.tools/__preview-server.js，含 /api/v1/machine/state 桩 ?state=）、
  PC 轮询 tablet-sync.ps1。本对话结束后会死，新对话先重起（技能 preview-workflow）。
- 平板 CDP forward 9223 / 模拟器 9224；App 重启 pid/页 id 变要重取 wsUrl。
- 平板 stayon 本轮回归设了 true，**收尾恢复 false**。

## 4. 待办 / 下一步

1. 发版 v1.5（用户授权后）：staging .tools/gh-profilereplayer 同步 → push main（VPN 127.0.0.1:57890，token 走 git credential fill）→ gh release 带 APK → 夸克。
2. 真机省电实测：灭屏后 logcat HxFetch 应见 screen off: pause fetch、无两分钟空抓；亮屏恢复；DE1 睡眠见 skip fetch。
3. recorder 归属反向验证（HyperEx 杯 recorder 不记）仍欠专门跑（前序遗留）。
4. 温度曲线进记录+画图仍搁置（用户说不改 HyperEx 插件）。

## 5. 文件清单

- 网页：app/www/app.js（renderCards/renderChartLegend/DE1 轮询/睡眠门控）、app/www/index.html（胶囊/滑块/图例/七卡 CSS）。
- Java：HxBridge.java（machineState/lastMachineState）、FetchService.java（屏幕广播+睡眠细闸+volatile/排程防重）。
- 包：release/ProfileReplayer-v1.5-debug.apk（2,031,105 字节，SHA256 B5047C98E79117086A74F2BE65F7A693630251BB31708C4E7DFDEA974D476126）。
- 截图留证：.impeccable/review/emu-*.png（gitignore）。
