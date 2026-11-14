# 交接：ProfileReplayer v1.6 UI 迭代 + 发版（2026-11-15）

> 前序：HANDOFF_2026-11-14-replayer-v1.5-ui.md。通用坑唯一维护处：技能 android-tablet-apk-dev。
> 仓库规矩照 AGENTS.md（第 7 条四件事、第 20 条改代码/发版先问、第 16 条中文输出）。

## 0. 一句话现状

v1.6（versionCode 7）已发版：GitHub Release v1.6 带 APK + 夸克上传；平板与模拟器均装 v1.6。
v1.5 从未对外发版，其内容随 v1.6 首次发布（版本号跳 1.6 避免同版本号两个包）。

## 1. 本轮改动（用户逐条点名）

1. 顶栏标题后版本号 v1.6：HxBridge 新增 appVersion()（读 versionName），h1 内独立 span#appVer（applyLang 不覆盖）。
2. 时刻卡去帧计数小字；RAW 模式 tare 标记保留。
3. 第 4 卡「杯流」、第 6 卡「RAW流速」（EN: RAW flow）；i18n 新增 '杯流'/'RAW流速' 键。
4. 秤重副行「插件累计」小字中英文都删（renderCards 不再拼 cum；图表的插件累计线保留）。
5. 单位与秤重 g 同格式（同字号同字重拼数字后）：杯流 g/s、压力 bar、RAW流速 g/s；
   机器流量/目标流量卡用 .v.vflow（flex、baseline、space-between）让 ml/s 靠右且基线对齐。
6. 卡宽规则（layoutCards()，renderCards/applyLang/resize 后调用）：
   - 第 7 卡 = 标题实测宽（Range 量）+ 内边距边框 + 5px；
   - 相位卡 = 可用宽 / 6.55（v1.5 的 1fr 份额）；
   - 其余 5 卡均分剩余，下限 = 五卡最宽 .v 内容（防中字号裁切），极窄整行横滑兜底；
   - ≤560px 清 inline 列宽回 CSS 三列。

## 2. 验证回执

- 模拟器 + 平板 11 套全绿：layout 14 / gesture 38 / cup 12 / plugin 18 / fetch 13 /
  cards 18 / raw 15 / drag 9 / de1 12 / legend 8 / cardsc 20。
- 日志：.tools/__emu16-*.log / __tab16-*.log。
- 本轮新坑：
  - 回归编排连跑时行布局套读到旧布局 → 脚本改视口后必须强制重排；现已直接调 layoutCards() 再量（消后台定时器节流噪声）。
  - 平板锁屏（mDreamingLockscreen=true）把视口压 0 → layout/gesture 假失败；wm dismiss-keyguard + WAKEUP + am start 后重跑（pitfalls 11）。
  - 平板无线调试端口重启会变；本次旧端口 46113 被拒，靠 adb mDNS 自动发现（adb-<serial>._adb-tls-connect._tcp）连上。
  - CDP 表面截图丢 canvas 层（曲线空白）→ 用 fromSurface:false 渲染器快照（.tools/__emu-shot2.js）。

## 3. 发版回执

- 本地提交：见 git log（v1.6 一笔，只 add 自己这批：build.gradle / www×2 / assets×2 / HxBridge / release APK / 本交接）。
- staging .tools/gh-profilereplayer 同步 6 文件 + APK → push main（VPN 127.0.0.1:57890，token 走 git credential fill）。
- GitHub Release v1.6：APK 2,033,495 字节，SHA256 83EAA0BC454B4008090B5D7EC6F272F6B5E58398238AB65BFBBC89E4E9EDAFA0。
- 夸克：「夸克网盘/来自：Codex」上传 v1.6 APK。

## 4. 工作区 / 进程

- 平板 stayon 本轮设 true，收尾恢复 false。
- 模拟器 hxpad / 预览服务 4790 提权侧活着；本对话结束后会死，新对话先重起。
- recorder 对话的 HANDOFF_2026-10-31.md 仍未提交，别碰别代提交。

## 5. 待办

1. 真机省电实测（灭屏 logcat HxFetch）仍欠（v1.5 遗留）。
2. recorder 归属反向验证仍欠（遗留）。
3. 温度曲线进记录+画图仍搁置（用户说不改 HyperEx 插件）。

