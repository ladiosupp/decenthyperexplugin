# 2.2.38 交接 — 外部算法介入开关（全开 / 全关）

## 0. 一句话

诊断页顶部新增「萃取模式」卡片：主动泄压与算法介入两个两态滑块并排一行；算法介入对外只有全开/全关。全关是只检测：不写 A010、不补水、不救急，也不参与杯间学习和自动曲线改写。

## 1. 用户口径

- 对外只保留全开/全关，避免把「只正常 / 只救急」这种非标准控制策略混进学习历史。
- 开关与主动泄压放在一起，替换原来顶部那条只提示泄压的颜色条。
- 切换必须不弄乱控制逻辑：模式在开杯时锁进 run.config.algorithmIntervention，滑块只在空闲时可改，下一杯生效。

## 2. 实现

- 新 storage key: algorithmInterventionV1，值 full/off；onLoad 读取，默认 full。
- startDiagnostics 把模式锁进 run.config.algorithmIntervention，并写 run.observationOnly = (mode === "off")。
- stage2StartupPlan(mode) 在全关时返回 strategy=none、enabled=false 的禁用计划，S2 补水/起步增强不启动。
- liveTrimTick 在 rescueActive 计算之后、压力门/coast 之前加闸：全关记录 observe 行后直接返回，不发 A010。
- liveTrimGovernor 在全关返回 null，避免 S2 斜坡或 S3 单调闸挡住救急检测。
- dispatchS2Startup 顶部再一道全关守卫。
- 全关杯不进入学习：learningRunAllowed / historyLearningStatus 检查 observationOnly；compactPersistentShotRecord 写 algorithmIntervention 与 observationOnly；autoApplyNextShotIfEligible 跳过并记 observation-only。
- 手动应用下一杯建议、校准、LUT 均不受影响。

## 3. UI

- 诊断页 #diag 顶部新增 #modecard；旧 #brewingmode 在 diagview 隐藏，GHC 浮层仍用它做单行状态。
- 卡片两列：主动泄压（泄压重启/连续萃取）、算法介入（全开/全关）；表头三个状态同尺寸绿点：本杯算法全开/关、本杯锁定、下一杯算法全开/关·已保存。
- 标题行改为「诊断 / 流量校准」+ 右侧同字号单行说明；窄屏省略号，不换行。
- 步骤 3 原来的 Active pressure release 复选框保留在 DOM 里但隐藏，避免和卡片抢入口；卡片改主动泄压时复用原 core settings 保存（会重载插件一次）。
- 算法介入走新 HTTP endpoint control-mode（GET/POST），写 storage，不重载；运行中返回 409。

## 4. 测试

- tests/verify_v02238.cjs **750/750**；新增 9 条：禁用补水计划、开杯锁存、全关不发 A010、整杯全关、页面 state-off、学习/自动应用排除、历史字段、control-mode 接口、页面卡片渲染。
- node --check 通过；2.2.37 的 741 条旧测试全部保留通过。

## 5. 已知边界

- 只实现对外两档；只正常/只救急没有入口（用户 2026-11-05 决定）。
- 杯内检测仍受 LiveFlowTrimTest 总开关控制；如果总开关关掉，全关也没有逐点诊断曲线。
- 全关杯仍保留阶段跳转（4 g / 40 g / 100 g）、Idle、>8 bar×3、最长运行时间、帧确认/ACK、写入预算。
- 版本已升到 2.2.38；未发版、未推送。

## 6. 改动文件

- decenthyperexplugin.reaplugin/plugin.js
- decenthyperexplugin.reaplugin/manifest.json
- decenthyperexplugin.reaplugin/README.md
- decenthyperexplugin.reaplugin/tests/verify_v02238.cjs
- review/mode-mock/index.html（示意图）
- HANDOFF_v02238.md
