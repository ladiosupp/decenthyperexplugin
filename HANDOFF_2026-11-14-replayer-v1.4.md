# 交接：ProfileReplayer v1.4 发版收尾（2026-11-14 晚）

> 前序：`HANDOFF_2026-11-14-replayer-v1.3.md`。本文记 v1.4 交互重做与发版回执。
> 仓库规矩照 AGENTS.md（第 7 条四件事、第 20 条改代码/发版先问、第 16 条中文输出）。

## 1. 本会话已完成（用户授权：UI 迭代 + 发版 + 装平板）

工作流改为「模拟器预览 → 用户确认 → 一次性装平板」：安卓模拟器 `hxpad`（Pixel Tablet AVD，
emulator-5554）+ 本机预览服务 `.tools/__preview-server.js`（4790，服务 app/www + 真实归档 +
Decaid 接口桩，adb reverse 映射进模拟器）。真实归档 103 杯（含 recorder「John Weiss开发的拉杆程序」）。

### v1.4 改动（提交 9435c90 / c061ff3 / 284c626 / f0062cb / 5a07ea6）

1. **手势**：画布 touch-action:pan-y，竖滑原生滚动，点按/横拖才动时间轴。
2. **选杯自定义下拉**：隐藏原生 select；点外/再点/ESC 关闭；清晰滚动条；当前杯定位。
   两段式：首点高亮+完整信息（全名+完整状态，换行不撑大卡片），再点同行才确定。
   曲线名 >18 字符截断+…，HyperEx 模式后缀 (auto/on/off) 保留。
3. **倍速下拉同口径**（两段式+互斥，开一个收另一个）。
4. **异常杯暗红**：仅明确失败语义（error/fail/refus/timeout/interrupted/missing/could not/
   pressure >/returned to idle/driver test）；recorder 正常结束 ended (idle) 不标。
5. **传输栏单行**：去 ±1/±10（键盘方向键/滚轮仍在）；.tbar nowrap。
6. **侧栏等宽无横滑**：fieldset min-width:0 + aside overflow-x:hidden。
7. **非 HyperEx 杯隐藏 S1/S2/S3**（renderCupInfo 按 pr- 前缀）。
8. **顶栏手动抓取按钮**（c061ff3）：点击即抓+重置 2 分钟计时+实时倒计时；窄屏顶栏单行。
9. 白名单警示条跟随语言翻译。

### 关键坑（本轮新增）

- **行点击重建面板导致节点脱离文档** → 被「点外关闭」监听器误判提前关闭；行 click 必须 stopPropagation。
- **CDP 改视口后布局不即时刷新**：量布局前 void document.body.offsetHeight + resize 事件 + 等待。
- **通知栏遮罩/锁屏把 WebView 视口压成 0**：手势测试假失败；唤醒+解锁+am start 恢复。
- **display:none 的原生 select 仍是 .tbar 子元素**（rect 全 0）：布局断言要过滤 width>0。
- 模拟器 127.0.0.1 是它自己：预览服务要 adb reverse tcp:4790 tcp:4790。
- 沙箱起的监听提权进程连不上（跨会话隔离）：预览服务/测试服务都要提权侧起。

## 2. 真机回归回执（平板 v1.4 已装机，versionName 1.4）

布局 14/14、手势/下拉/倍速 38/38、选杯 12/12、插件检测 18/18、手动抓取 13/13、
状态卡 18/18、RAW 轴 15/15、图表拖动 9/9。模拟器同套全绿。
回归脚本：.tools/__app-layout-check.js / __app-gesture-check.js / __cup-label-check.js /
__app-manual-fetch-check.js / __app-plugin-check.js（口径已适配两段式/截断/异常语义）。

## 3. 发版回执（用户授权）

- **GitHub**：main 推到 `af371dd`；Release **v1.4** 带 APK（2,002,613 字节，SHA256 686762c9…）。
  https://github.com/ladiosupp/profilereplayer/releases/tag/v1.4
- **夸克**：APK 一次上传成功，「夸克网盘/来自：Codex」，fileId `4b23545a45ee452380f3a696df2af2b2`。
- 本地提交只 add 自己的文件；recorder 对话未提交的 profilerecorder.reaplugin/* 与
  HANDOFF_2026-10-31.md 没碰。

## 4. 工作区现状

- HEAD `5a07ea6`（v1.4 发版包）。平板装 v1.4；模拟器 hxpad 也装 v1.4。
- 预览服务 4790 与模拟器本对话结束后会死；新对话要用先重起（提权）。
- PC 轮询 tablet-sync.ps1 状态见前序交接；sim 4780 常驻没动。

## 5. 待办

1. recorder 归属判断真机验证已部分完成（拉杆杯已记上、曲线名显示正常）；
   「HyperEx 杯 recorder 不记」的反向验证还没专门跑（归档里 pr- 只有 1 杯，间接成立）。
2. HyperEx 2.2.47 已由另一对话发版（de49a56）；控制侧复测见其交接。
3. 温度曲线进记录+画图仍搁置（用户说不改插件）。
