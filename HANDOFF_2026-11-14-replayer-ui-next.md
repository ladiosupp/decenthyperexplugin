# 交接：ProfileReplayer UI 继续迭代（2026-11-14 深夜，v1.4 已发版）

> 新对话开场材料。前序两份先读：`HANDOFF_2026-11-14-replayer-v1.4.md`（本轮改动与发版回执）、
> `HANDOFF_2026-11-14-replayer-v1.3.md`（真机链路/常驻进程）。
> **通用坑不在这里重复**：已沉淀成技能 `android-tablet-apk-dev`
> （`C:\Users\ladios\.codex\skills\android-tablet-apk-dev\`，SKILL.md 硬规矩 + references/pitfalls.md 26 条 +
> scripts/preview-server.js、cdp.js 可复用）。动 APK 前技能会自动加载，按条号引用即可。
> 仓库规矩照 AGENTS.md（第 7 条四件事、第 20 条改代码/发版先问、第 16 条中文输出）。

## 0. 一句话现状

v1.4 已发版（GitHub + 夸克）并装平板，真机 8 套回归全绿。用户要继续改 UI，
**工作流已定为「模拟器预览 → 用户确认 → 一次性装平板」**，别每改一次就装平板。

## 1. 工作区

- HEAD `ea303f0`（交接）/ `5a07ea6`（v1.4 发版包，versionCode 5 / versionName 1.4）。分支 auto-hyperex。
- **别人未提交的改动，别碰别代提交**：`profilerecorder.reaplugin/`（README/manifest/plugin.js/tests，
  recorder 对话的活）、`HANDOFF_2026-10-31.md`。提交只 add 自己这批。
- 另一对话已发 HyperEx **2.2.47**（`de49a56`，曲线标题前缀固定 HyperEx）；平板上插件还是 2.2.45，
  控制侧复测是另一条线，涉及控制律先读 decentplugin 技能 §22。

## 2. 还活着的进程（本对话结束后会死，新对话先重起）

- **安卓模拟器 hxpad**（Pixel Tablet AVD，emulator-5554，2560×1600）：装着 v1.4，归档 103 杯
  （含 recorder「John Weiss开发的拉杆程序」），中文界面。重起：
  `emulator -avd hxpad -no-snapshot-load -gpu auto`（提权后台），开机后 `install -r` + 喂数据（见技能 preview-workflow）。
- **预览服务 4790**：`.tools/__preview-server.js`（服务 app/www + 真实归档 + Decaid 桩）。
  技能里有同款通用版 `scripts/preview-server.js <wwwDir> <archiveJson> [port]`。提权侧起 + +  `adb -s emulator-5554 reverse tcp:4790 tcp:4790`。
- **PC 轮询 tablet-sync.ps1**：本会话后台跑着，平板休眠期间偶发「积极拒绝」会自愈；死了重起（提权）。
- sim 4780 常驻没动。平板 stayon 已恢复 false（锁屏状态，回归前要唤醒解锁拉前台）。

## 3. 数据与调试口

- PC 归档 `D:/vscode/.tools/hx-data/hyperex-history-all.json`：103 杯 / 96 全点 / 1 杯 pr-。
  平板 App 归档 68 杯（插件只留最近若干，App 累积更多）；拉回归 `app/tools/tablet-pull-app-archive.js`。
- 平板 CDP：forward tcp:**9223**；模拟器：tcp:**9224**。App 重启 pid/页 id 变，重新取 wsUrl。
- 回归脚本（.tools/，不入库，口径已适配 v1.4）：
  __app-layout-check.js（14）/ __app-gesture-check.js（38，含倍速/互斥）/ __cup-label-check.js（12）/
  __app-plugin-check.js（18）/ __app-manual-fetch-check.js（13）/
  decenthyperexplugin/.tools/__app-cards-row-check.js（18）/ __app-raw-axis-check.js（15）/ __app-chart-drag-check.js（9）。
  **每套之间重启 App**（异步求值挂死，技能 pitfalls 8）。

## 4. v1.4 已定的 UI 口径（继续改时别推翻）

- 传输栏单行，无 ±1/±10（键盘方向键/滚轮仍在）；侧栏四卡片等宽、无横滑。
- 选杯/倍速都是自定义下拉：**两段式**（首点高亮+完整信息，再点同行确定），点外/再点/ESC 取消，两下拉互斥。
- 曲线名 >18 字符截断+…，HyperEx 模式后缀 (auto/on/off) 保留；选中行显示完整信息（换行不撑大卡片）。
- 异常杯暗红**只认明确失败语义**；recorder 正常结束 `ended (idle)` 不标。
- 非 HyperEx 杯（pr- 前缀）不显示 S1/S2/S3。
- 顶栏手动抓取按钮：即抓+重置 2 分钟计时+实时倒计时。
- 图表竖滑原生滚动，点按/横拖才动时间轴。

## 5. 待办 / 可能的下一步

1. 用户继续提 UI 修改（本轮没给具体方向，**开工先问清改哪块**）。
2. recorder 归属反向验证（HyperEx 杯 recorder 不记）还没专门跑；归档 pr- 只 1 杯间接成立。
3. 温度曲线进记录+画图仍搁置（用户说不改 HyperEx 插件）。
4. 发版走 v1.5：升 versionCode 6 / versionName 1.5 → 构建 → 装机回归 → staging 推送 → gh release → 夸克。
   gh token 走 git credential fill + VPN 代理（技能 pitfalls 4）。

## 6. 文件清单

- 本轮提交：9435c90 / c061ff3 / 284c626 / f0062cb / 5a07ea6 / ea303f0。
- 技能：android-tablet-apk-dev（通用坑唯一维护处，已校验+冒烟）。
- 截图留证：.impeccable/review/（tablet-v1.4.png / emu-*.png，gitignore）。
- GitHub staging：.tools/gh-profilereplayer（main=af371dd，不入库）。
