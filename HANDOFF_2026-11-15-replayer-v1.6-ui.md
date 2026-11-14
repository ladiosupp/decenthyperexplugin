# 交接：ProfileReplayer v1.6 UI 迭代 + 发版（2026-11-15）

> 前序：HANDOFF_2026-11-14-replayer-v1.5-ui.md（v1.5 内容清单）、HANDOFF_2026-11-14-replayer-v1.4.md（发版流程）。
> 通用坑唯一维护处：技能 android-tablet-apk-dev（SKILL.md 硬规矩 + references/pitfalls.md，按条号引用）。
> 仓库规矩照 AGENTS.md（第 7 条四件事、第 20 条改代码/发版先问、第 16 条中文输出）。

## 0. 一句话现状

v1.6（versionCode 7）**已发版**：GitHub Release v1.6 带 APK + 夸克上传；平板与模拟器均装 v1.6。
v1.5 从未对外发版，其内容随 v1.6 首次发布（版本号跳 1.6，避免同版本号两个包）。
工作流仍是「模拟器预览 → 用户确认 → 一次性装平板」。

## 1. 本轮改动（用户逐条点名，均已实现）

1. **标题后版本号**：HxBridge 新增 appVersion()（读 versionName）；h1 内独立 span#appVer，
   applyLang 的 data-i18n 重写不覆盖它；启动时填 'v' + versionName。
2. **时刻卡去帧计数小字**（中英文都去）；RAW 模式的 tare 去皮标记保留（状态标注，非帧号）。
3. **第 4 卡标题「杯流」**（原 decaid 杯流）、**第 6 卡「RAW流速」**（EN: RAW flow）。
   i18n 新增 '杯流'/'RAW流速' 键；图表图例的 'decaid 杯流'/'RAW dW/dt' 标签不动（raw-axis/legend 回归依赖）。
4. **秤重副行「插件累计 / plugin cum.」小字去掉**（中英文）；图表里的插件累计虚线保留。
5. **单位加回，与秤重 g 同格式**（同字号同字重、直接拼数字后，不做小字/上标）：
   杯流 g/s、压力 bar、RAW流速 g/s；机器流量/目标流量卡用 .v.vflow
   （display:flex; align-items:baseline; justify-content:space-between）让 ml/s 靠右、基线与数字对齐。
6. **卡宽规则**（layoutCards()，在 renderCards / applyLang / resize 后调用）：
   - 第 7 卡 = 标题实测宽（Range 量 .k 内容）+ 内边距边框 + 5px；
   - 相位卡 = 可用宽 / 6.55（v1.5 的 1fr / 6.55fr 份额，宽度不变）；
   - 其余 5 卡均分剩余；**下限 = 五卡最宽 .v 内容宽**（加单位后中字号会裁切，真机回归抓出后加的），
     极窄放不下时整行横滑兜底（回归 overflow 断言只在该极端触发，实测 320–1600 全过）；
   - ≤560px 清 inline 列宽，回 CSS 三列（≤400px 相位跨两列不变）。
   - 实测 1280 视口：5 均分卡各 115px、相位 130px、第 7 卡 148px（标题 121 + 22 + 5）；
     英文标题更长时自动重算（第 7 卡 164、其余 112）。**别按模拟器像素调列宽**（真机字体度量不同，v1.5 教训）。

## 2. 验证回执（最终包，双机 11 套全绿）

- layout 14 / gesture 38 / cup 12 / plugin 18 / fetch 13 / cards 18 / raw 15 / drag 9 / de1 12 / legend 8 / cardsc 20。
- 日志：.tools/__emu16-*.log（模拟器）/ __tab16-*.log（平板）。
- 回归脚本本轮更新（.tools/，不入库）：
  - __cards-content-check.js：20 项（新增 版本号=桥接值 / 秤重副行空 / 单位同 g 格式 / ml/s 右对齐+基线 / RAW流速 标题 / 宽度规则）。
  - __app-cards-row-check.js：改视口后**直接调 layoutCards() 再量**（强制重排 + 消后台定时器节流噪声），18 项含宽度规则断言。
  - __emu-shot2.js：fromSurface:false 渲染器快照（表面截图丢 canvas 层，曲线会空白）。
  - __emu-up.js：装机+拉前台+forward 9224+取 wsUrl 一条龙；__v15ui-shot-prep.js：选杯/定位 S2 帧/切语言/设视口。
  - __set-lang.js / __probe-state.js / __canvas-probe.js：小工具。注意 __probe-state.js 的 ws 是 argv[2]，别多塞占位参数。

## 3. 本轮新坑（项目特有；通用坑见技能 pitfalls）

- **回归编排连跑读旧布局**：行布局套改视口后只等 250ms 不够（后台 WebView 定时器节流），
  单独跑绿、编排跑红。修法：量前直接调 layoutCards()（同步重算）+ 强制重排。
- **平板锁屏假失败**：mDreamingLockscreen=true 时 innerWidth=0、hidden=true，layout/gesture 红一片。
  wm dismiss-keyguard + KEYCODE_WAKEUP + am start 后重跑即绿（pitfalls 11）。编排前务必先解锁。
- **平板无线调试端口重启会变**：旧端口 46113 被拒（10061），5555 也拒。本次靠 **adb mDNS 自动发现**连上：
  设备名 adb-haf6uwvcqcdujzin-trqoCZ._adb-tls-connect._tcp（adb devices 直接可见）。
  service.adb.tcp.port / persist.adb.tcp.port 都读不到（TLS 模式不写）。新对话先 adb devices 看 mDNS 名，
  没有再让用户开无线调试报端口（tablet-connect.ps1 配对流程备用）。
- **CDP 表面截图丢 canvas**：Page.captureScreenshot 默认 fromSurface 在模拟器上曲线空白（位图有内容、合成层丢）。
  用 fromSurface:false（__emu-shot2.js）。
- **夸克 MCP upload_file commit 203**：两次失败文件不落盘；改走官方 CLI（quarkclouddrive 技能）成功。
  CLI --parent-fid 要**目录 FID 不是路径**（先 browse 根目录拿「来自：Codex」的 fid）；
  --task-dir 要先建目录；pwsh 无 bash，用 "C:\Program Files\Git\bin\bash.exe" 跑 install.sh。

## 4. 发版回执（用户授权「装平板吧，同时发版」）

- 本地提交（auto-hyperex 分支，只 add 自己这批）：
  - 7323125 v1.6 代码+包+交接（build.gradle / www×2 / assets×2 / HxBridge.java / release APK / 本交接）。
  - f7a1dfe 交接回执补记。
- staging .tools/gh-profilereplayer：同步 6 文件 + APK，提交 e7a8482，push main（af371dd..e7a8482，
  VPN 127.0.0.1:57890，token 走 git credential fill）。
- GitHub Release：https://github.com/ladiosupp/profilereplayer/releases/tag/v1.6
  APK 2,033,495 字节，SHA256 83EAA0BC454B4008090B5D7EC6F272F6B5E58398238AB65BFBBC89E4E9EDAFA0（资产已核对）。
- 夸克：「夸克网盘/来自：Codex」ProfileReplayer-v1.6-debug.apk，fileId 4863be531cb349098dedff0bd9f6c0a4。
- 发版说明：release/notes-v1.6.md。

## 5. 工作区 / 进程

- HEAD：f7a1dfe（本交接补全提交见 git log）。recorder 对话的 HANDOFF_2026-10-31.md 仍未提交，**别碰别代提交**。
- 平板：装 v1.6；stayon 本轮设 true、**收尾已恢复 false**；CDP forward 9223。
- 模拟器 hxpad：装 v1.6；CDP forward 9224；预览服务 4790（.tools/__preview-server.js，提权侧）活着；
  adb reverse tcp:4790 已映射。本对话结束后模拟器/预览服务会死，新对话先重起（技能 preview-workflow）。
- 平板取数地址 http://127.0.0.1:8080/...（真实 Decaid，68 杯）；模拟器喂的预览归档 103 杯。
- app/build/ 未跟踪（构建产物），不入库。

## 6. 待办 / 下一步

1. 真机省电实测：灭屏后 logcat HxFetch 应见 screen off: pause fetch、无两分钟空抓；亮屏恢复；DE1 睡眠见 skip fetch（v1.5 遗留）。
2. recorder 归属反向验证（HyperEx 杯 recorder 不记）仍欠专门跑（遗留）。
3. 温度曲线进记录+画图仍搁置（用户说不改 HyperEx 插件）。
4. 下一版若再动卡片：宽度规则以 layoutCards() 为唯一实现，回归用 __app-cards-row-check.js + __cards-content-check.js。

