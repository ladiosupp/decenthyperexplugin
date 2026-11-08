# HyperEx 2.2.43 交接：三档泄压 + 自动 0 bar 帧

日期：2026-11-08（北京时间）。实验版本，尚未真机验证。

分支：`auto-hyperex`。基线：2.2.42 提交 `2b79249`。版本号带 `-auto` 后缀，按语义版本低于正式 2.2.43、高于 2.2.42，可直接覆盖 2.2.42 安装。

## 用户口径

把原来的主动泄压布尔开关改成三段：`auto` / `on` / `off`，默认 `auto`。

- `auto`：生成一条标题后缀 ` auto` 的新曲线。S1 到重量后 skipStep 进入一个真实的 `pressure: 0` 帧，泄压并浸泡，再自动进 S2/S3；整杯只需要按一次实体萃取键。
- `on`：保留 2.2.42 原来的 Idle → soak → GHC 重启路径。
- `off`：连续 S1 → S2 → S3，无中间泄压。

0 bar 帧的 `seconds` 直接使用用户 `SoakSeconds`。插件倒计时也用同一个值，**不等待压力降到 0.8 bar**；0 bar 指令没有把压力放下来也照常倒计时。整体硬压力上限、最长运行时间和最终重量停止仍保留；允许带压进 S2。

## 关键实现

1. **三档设置**：`ActiveRelease` 从 boolean 改为 enum `auto/on/off`，默认 `auto`。旧 `true` 在设置加载时迁移为 `auto`，旧 `false` 为 `off`；显式字符串 `on` 才走旧路径。历史 run.config 只有 `activeRelease:true` 且没有 `releaseMode` 时，仍按旧 3 帧 on 布局读取。
2. **自动曲线**：`profileObject()` 在 auto 档插入 `Active release / soak` 帧：`pump:pressure`、`pressure:0`、`seconds:SoakSeconds`、`exit:null`、`limiter {0, 0.6}`。物理帧为 S1=0 / release=1 / S2=2 / S3=3+；标题为 `<ProfileTitle> auto`。
3. **逻辑帧 helper**：`profileLayoutForMode/Profile`、`logicalFrameForPhysical`、`physicalFrameForLogical`、`runProfileLayout`。采样、trace、学习、图表、CSV 的 `profileFrame` 继续是逻辑帧 S1=0 / S2=1 / S3=2+；只有 A010 实写、`profile.steps` 索引和 skipStep 使用物理帧。这样 auto 与 on 共用现有 S1/S2/S3 学习 key，旧记录不需要迁移。
4. **自动状态机**：`beginAutoRelease()` 在 S1 重量触发时 skipStep 0→1，进入 release 帧后立即启动 `SoakSeconds` 倒计时；`finishAutoSoak()` 在倒计时结束 skipStep 1→2 进 S2。固件若已自行进入 S2，`guardedSingleSkip` 看到期望帧会 no-op；不会重复跳到 S3。没有 `espresso` 请求、GHC 倒计时或 RE-ARM。
5. **学习边界**：auto 允许 3 个 skipStep（S1→release、release→S2、S2→S3），不再被旧 `skipCount>2` 判成 extra-skip。0 bar 段的采样 phase 是 `dumping`/`soak`、逻辑帧为 null；所有 S1/S2/S3 学习函数都按 phase 过滤，0 bar 段不进入任何学习窗口。auto 与 on 的 persistent history 共用 active-release 指纹，可互相恢复使用。
6. **校准例外**：流量校准仍是物理帧阶梯，`liveFrameForLayout()` 在 calibrationActive 或校准标题时直接保留机器帧号，避免 auto 布局把校准帧 1/2/3 映射错。
7. **UI**：诊断页「泄压模式」改为三档分段控件；`control-mode`/`uiStatusPayload` 带 `releaseMode`；auto 的 soak 状态显示 0 bar soak + S2 自动开始，不再提示粉灯/按 GHC。
8. **版本与标题**：`PLUGIN_VERSION`/manifest 为 `2.2.43`；auto 曲线标题后缀 ` auto`。

## 测试

`tests/verify_v02242auto.cjs`：**783/783** 通过。

新增覆盖：

- 三档默认与旧 boolean 迁移；manifest enum 与页面三段控件。
- auto 4 帧曲线、0 bar 帧、SoakSeconds 时长、S1/S2/S3 命令摘要。
- 物理→逻辑帧映射与逆映射；release 帧不作为萃取阶段。
- auto S2 实写 payload 帧字节为 `02`，trace 仍记逻辑帧 1。
- S1 重量触发后压力仍 9 bar 也启动 soak 倒计时；倒计时结束进 S2 且不发 espresso/GHC。
- auto 3 个 skipStep 不触发 extra-skip 排除；0 bar 的 `soak` 采样不进入 stage 学习窗口。
- auto 能恢复 on 的 persistent history，on 也能恢复 auto 写入的记录。
- auto 曲线校验/选中；on→auto 切换会上传 4 帧曲线且学习 fingerprint 不变。
- 校准在 auto 设置下仍保留物理帧。
- 旧 2.2.42 回归（按 on 模式运行）全部通过。

## 真机测试重点

1. 先确认自动档生成/选中 `<ProfileTitle> auto`，物理曲线第 2 段是 pressure 0。
2. 空粉碗或正常粉饼各跑一杯：S1 到重量后是否进入 0 bar 帧；压力是否下降；SoakSeconds 倒计时是否照常结束并进 S2。
3. 故意让 0 bar 帧压力没有完全放掉，确认仍按 soak 时间进 S2，不被卡住；同时确认 >8 bar ×3 的整体压力中止仍有效。
4. 观察 S2 起步/补水是否因不再重启 Espresso 而改变；对比 on 模式的 S2 爬升、尾段和产出。
5. 跑一杯 on 模式，确认旧 GHC 重启路径未变；跑一杯 off，确认连续模式未受影响。
6. 导出 CSV 检查 `profileFrame`（逻辑）与 `physicalProfileFrame`（物理）是否对应 auto 的 0/1/2/3。

## 回滚与安装

- 代码回滚：切回 `v1.79ds` 的 2.2.42 提交 `2b79249`，重新安装 2.2.42 包。
- 模式回滚：把 `ActiveRelease` 设为 `on` 即回到旧 Idle/soak/GHC 路径；设为 `off` 回到连续模式。
- 学习历史：auto 与 on 共用 active-release 学习 key，切换模式不会丢掉旧 S1/S2/S3 记录；off 仍独立。

## 发布记录（2026-11-08）

- 代码提交 `98e38ba`，tag `v2.2.43`，分支 `auto-hyperex` 已推送。
- GitHub Release：https://github.com/ladiosupp/decenthyperexplugin/releases/tag/v2.2.43（附件 `HyperExPulseFilter_v2.2.43_experimental.zip`，479,976 字节）。
- SHA256：`4CDBFF8BEB45A4EDE93C3775B8102C20B85AE4929B94EB1D49D7D887BBB879FA`。
- 夸克：`夸克网盘/来自：Codex/HyperExPulseFilter_v2.2.43.zip`，479,976 字节，fileId `2d811c4dd02e4580a4b4b0ff89a98839`。
