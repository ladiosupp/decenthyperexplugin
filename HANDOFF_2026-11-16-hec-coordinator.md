# HEC 统筹交接（2026-11-16，统筹对话 → 新统筹对话）

> 读者：接手 HEC 统筹的新对话。本文自包含，读完即可接手。
> 角色：统筹 HEC 插件（decenthyperexplugin）× APK（HyperExController）开发——复核各执行对话交付、评估冲突、派单、把关授权、维护跨侧协议。
> 规矩：AGENTS 20（改出厂代码/发版/推送/闭环先问用户）、16（全程中文）、7（动代码前 git 四件事、只 add 本批）、21（控制律先读 decentplugin 技能 §22）、15（本地图/链接用正斜杠绝对路径）。

## 0. 接手第一件事（ critical ）

自动回叫协议当前指向**旧统筹对话 ID 01a1dcec-c136-7102-bbb6-df3c9f4cd903**。新统筹对话建立后，立即给 APK 整改对话（01a1e148-99c1-7de1-a5ce-22e736df8f4f）发消息，把回叫目标改成**新统筹对话自己的 threadId**（hostId local），否则执行对话做完仍敲旧对话。
回叫协议内容：执行对话每完成一轮或需用户输入，send_message_to_thread 给统筹，带本轮名/key 数字/交接 MD 路径/待拍板事；纯确认不回叫。

## 1. 线程与项目

| 对话 | threadId | 状态 |
|---|---|---|
| 旧统筹（本交接来源） | 01a1dcec-c136-7102-bbb6-df3c9f4cd903 | 交出 |
| APK 整改（R1–R5 + 阶段 B/C） | 01a1e148-99c1-7de1-a5ce-22e736df8f4f | idle，离线已结案 |
| UI | 01a1e18f-0113-7712-8465-d0e574f18828 | 活跃，v0.12 已发、续改 UI |
| 液重停杯 bug | 01a1e168-6cf1-7fa0-a211-79a0d0e01371 | idle，已修复发版 |

项目「decent 相关」projectId 5f74cf60-4cb4-4b5c-b439-b5bdf0cde7e5（path D:/vscode）。create_thread 用嵌套 target:{type:"project",projectId,environment:{type:"local"}}（AGENTS 22，拍平写法必报错）。send_message_to_thread 字段是 prompt 不是 message。

## 2. 插件侧（decenthyperexplugin，branch auto-hyperex）

- 2.2.48 已发版（GitHub Release v2.2.48 + 夸克），回执 commit e8d6219；回归 818/818（801 基线 + 17 HEC）。
- HEC 三档 full/hec/off；external-hello/status/flow 三端点插件代写 A010；心跳 4s 保险（无握手 S2 前接管 / 心跳断先收基值再交 full）；接管本杯锁存、下一杯重评。
- 协议文档 HEC_PROTOCOL_FOR_APK.md 已按代码实测更正，commit db1b50b（heartbeat/takeover 字段名、external 计数并入 heartbeat、补 frame-not-confirmed/frame-not-writable、版本核对走 status.calibration.pluginVersion）。APK 仓 docs/ 副本与之一致。
- 控制口径真源：技能 decentplugin §22（C:/Users/ladios/.codex/skills/decentplugin/SKILL.md）。
- 插件仓工作区曾有别人未提交的 HANDOFF_2026-10-31.md，不碰不代提交。

## 3. APK 侧（HyperExController，HEAD f8a5917）

- v0.12 已发版（f8a5917，versionCode 12）。含：液重停杯修复 ffa1815 + R1–R5 影子整改 583cc66/827ffca + 阶段 B 学习仲裁 761e7b2 + UI 五项。
- 版本冲突处置（66d37ee / HANDOFF_2026-11-16-hec-v011.md §6）：v0.11 发版包是临时 worktree 构建的纯 v0.11（不含阶段 B）；主线留 v0.12 含阶段 B，不降级。
- 平板已装 v0.12（2026-11-16 19:30，adb dumpsys versionCode 12 实测），真机测试条件满足。
- R1–R5 影子整改：predictedGS/rescue 自算（与插件同口径，离线比对 98.78%/99.36%）、writes 区分 frame-change/write、决策点 realized/matched、写后 0.75–2.75s 响应窗、杯级 modeAtStart/fixLevel；导出 schema 2 rectify 标记；并档排除 hec 与 pre-fix 旧杯。
- 阶段 B 学习仲裁：LightGBM 20 维（剔了 model_want_so_far/agree_rate 两维密集/稀疏错配特征），纯 JS 树评估器 + vendor/arbiter_lgb.json（300 树），与 Python 比特级一致（max err 1.1e-16）；替换仲裁第 2/3 层，第 1 层硬包线共用，未就绪回落规则 v0；默认启用 thr 0.5，HxArbiter.setLearnedThreshold(t) 可调。
- 影子恒 sent:false、不碰 external-flow；第 1 层硬包线（0.10–8.00、1/16、上行≥限压×0.90、==当前→hold）永不放宽；单一写者（插件代写）。

## 4. 路线图状态与核心判断

- 阶段 A 真机影子攒数据：用户暂缓；平板已就绪，待用户出杯。
- 阶段 B 学习仲裁：离线 + 集成完成（761e7b2）。
- 阶段 C 决策模型 CQL：离线完成，**阴性结论**——CQL/bc_v0/插件策略价值持平（0.840/0.841/0.840，分相位几乎逐位相同），CQL hold 97.4% 极保守。picked-better 0.648 是植物中介乐观数、非干净对照。离线 RL 没证出增益。
- 阶段 D 闭环发送：gated，须用户另行批准 + 协议 §8 联调，未做。

**统筹核心判断（已告用户）**：离线学习（B+C）到顶，插件现有控制律已近离线模型天花板，再刷离线模型证不出增益。真正瓶颈是两样都要用户机器时间的数据：① 真机影子 matched/响应真标签（重训仲裁、验证学习模型）；② 高指令 S3 稳态标定样本（≥5 ml/s，当前 0 条）。
**S3 植物反事实不可信**：剔限压是空操作（S3 压力最高 2.35 < 0.95×3=2.85，剔 0/476）；平坦根因是杯流对指令不敏感 + 命令范围窄（0.125–1.438 ml/s），不是限压杯。没有高指令标定样本前 S3 增益只能当上界。
**建议口径**：离线暂停刷模型；优先真机取证；CQL 接进 APK 暂缓（离线无增益、徒增复杂度）。

## 5. 待用户拍板（都没擅自做）

1. CQL 接进 APK 决策模型（替换/并联 bc_v0）——建议暂缓；要接是另一批、须批准、先影子只记录。
2. 真机取证（优先）——平板就绪，等用户 full 档出杯。
3. 阶段 D 闭环发送——gated，须批准 + §8。
4. 后续发版——v0.12 已发；下一批改动攒着，发版另问。

## 6. 真机测试就绪（交接时的最近一步）

- 平板 v0.12 实测确认；屏幕亮（mScreenOn true），HEC 进程 pid 9041 在后台，前台当时是 Godox BLE 应用（com.godox.ble.mesh）。
- 旧统筹提议做只读就绪冒烟（拉 HEC 前台 → CDP 读 HxShadow.loadState=ready / HxArbiter.learnedReady() / 插件版本 / 心跳 ok），用户尚未回复就转去问上下文长度。**新统筹接手可继续这个冒烟，或直接等用户出杯。**
- **关键实操提醒**：先连接再出杯。上次自查唯一 v0.10 杯相位全程 idle、零决策，根因是出杯时控制页没连上（hello 晚于萃取）。务必：打开 HEC 控制页 → 确认「已连接」胶囊亮（心跳 ok）→ 再 full 档出杯，影子才记得到正常相位决策。
- 真机自查脚本：APK 仓 .tools/__rectify-tablet-check.cjs；导出落 .tools/__rectify-tablet-shadow-export.json。

## 7. 关键路径与复跑索引

- 插件仓 D:/vscode/decenthyperexplugin；APK 仓 D:/vscode/HyperExController；离线训练 D:/vscode/.tools/hx-train（.venv：d3rlpy 2.8/torch/lightgbm 4.7/onnxruntime；Windows GBK 坑读写显式 utf-8）。
- 协议 D:/vscode/decenthyperexplugin/HEC_PROTOCOL_FOR_APK.md。
- 交接 MD：插件仓 HANDOFF_v02248.md / HANDOFF_2026-11-15-hec-mode-proposal.md；APK 仓 RECTIFY_2026-11-16-hec-shadow.md、HANDOFF_2026-11-16-hec-shadow-rectify.md、HANDOFF_2026-11-16-phaseB-apk-integration.md、HANDOFF_2026-11-16-hec-yield-fix.md、HANDOFF_2026-11-16-hec-v011.md、DECISION_ARBITER_MODELS.md；离线 .tools/hx-train/HANDOFF_2026-11-16-phaseB-arbiter-learning.md、HANDOFF_2026-11-16-phaseC-decision-model.md。
- 复跑：插件回归 node tests/verify_v02248.cjs（插件仓）；R1 比对 node .tools/__rectify-r1-replay.cjs、R2–R5 桩 node .tools/__rectify-r2345-test.cjs、阶段 B 集成桩 node .tools/__phaseB-integration-test.cjs（APK 仓）；JS parity node __verify_js_eval.cjs、CQL .venv/Scripts/python.exe train_cql.py 2000、S3 修正 plant_s3_correct.py（hx-train）。
- adb：D:/android-dev/sdk/platform-tools/adb.exe；平板 mDNS adb-haf6uwvcqcdujzin-trqoCZ._adb-tls-connect._tcp（tablet.json 的 192.168.31.15:46113 已失效）；包名 com.ladios.hxcontroller；配置 APK 仓 app/tools/tablet.json；另有模拟器 emulator-5554（adb 命令要 -s 指定设备）。
- 技能：decentplugin（§22 控制口径）、android-tablet-apk-dev（adb/CDP/构建坑：沙箱 adb/回环不可信一律提权；灭屏 mDNS 不广播需亮屏；锁屏遮罩压 WebView 视口为 0 需 wm dismiss-keyguard；改网页先同步 assets 再构建；gh release upload 挂死改 REST/curl 走 VPN）。

## 8. 别碰

- 影子只记录不发送；第 1 层硬包线永不放宽；单一写者。
- full 攒标签 / hec 验链路（用户拍板口径）；hec 杯与 pre-fix 旧杯不进训练。
- 别人未提交改动不碰不代提交；提交只 add 本批。
- 改出厂代码/发版/推送/闭环先问用户（AGENTS 20）；adb/构建/回环网络提权。
