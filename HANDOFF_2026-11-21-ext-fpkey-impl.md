# 2.2.60 ext/hello fpKey 加性暴露 · 实施交接（2026-11-21，用户批②，改码本批授权，发版另问）

> 统筹 relay-9（01a1fc32-fcb0-7773-93d5-8386f19ff231）派单。hec 里程碑 C 后半（O1 暖机）/D 波（Vi 完整指纹门＋D2 证据 live 门）硬依赖。基线 3cd2cd8（2.2.59 发版回执）。**加性协议字段，零控制律改；发版/装机/push 另问**。

## 1. 改动清单（plugin.js 4 hunk＋manifest 版本＋verify_v02260＋README）

- **hunk①** plugin.js:8 PLUGIN_VERSION 2.2.59→2.2.60。
- **hunk②** externalStatusPayload（5910）return 前加 fp 计算：`const fp=adaptiveHistoryFingerprint(); fpKey=fp?adaptiveHistoryFingerprintKey(fp):""; numericFpKey=fp?numericLearningFingerprintKey(fp):""`（只读，无副作用）。
- **hunk③** 同函数 return 对象尾加 `fpKey: fpKey||null, numericFpKey: numericFpKey||null`（校准上下文不可用→null，与 O1/viBuckets fpKeyMatch 同门）。hello 与 ext-status 共享此 payload→两端点同时获得。
- **hunk④** 新 helper `gainMemoryMirrorPayload()`（externalStatusPayload 后）：state.persistentHistoryFile.gainMemory 存在则返回 normalizeGainMemory(file.gainMemory)（纯函数，不写文件），否则 null；external-hello handler 响应加 `gainMemory: gainMemoryMirrorPayload()`。**ext-status 轮询 payload 不含镜像**（大小考虑）。
- manifest.json version 2.2.60（description 397 不动，其余逐字 node 核过）；verify_v02260.cjs（v02259 复制＋版本钉 4 处更新＋injection 加 externalStatusPayload/gainMemoryMirrorPayload/normalizeGainMemory＋9 新测试）；RESULTS_v02260.txt 实跑；README 2.2.60 段。

## 2. 落点提案（派单要求提案，已按此实现）

- **fpKey/numericFpKey 进 externalStatusPayload**（hello＋ext-status 都有）：两 key 是字符串（full key ~1KB 级），每轮询开销可忽；APK D2 live 门/Vi 门需要杯间新鲜度（校准变更后 ext-status 即可辨 stale，无需新请求类型，§0 合规）。
- **gainMemory 镜像仅 hello**：buckets（含 bands）＋viBuckets 可数 KB～数十 KB，pre-cup 刷新一次足够（统筹裁①插件主本＋APK 镜像）；不进每轮询 payload 免撑大热路径。hello 是既有端点（APK 接触时 POST），插件侧只是既有响应加字段，无新增请求。
- 镜像＝normalize 同格式（含 dropped 诊断行），APK 可直接按插件 normalize 口径消费；每次 hello 读当前主本（实时）。

## 3. 红线遵守

控制律零改（律结构/r/Vi/门/写入面全不动，diff 仅 ext payload/helper/版本）；加性字段不改既有字段语义（21 个既有协议字段契约测试钉）；**杯末评分取值链不回退**（diagnostics {summary,run} 源未触，新测试钉 summary 10 关键键＋endpoint shape；取不到值排查另批 01a1ebd1）；影子 sent false/硬包线/LUT/记忆不删改（镜像只读，normalize 纯函数，测试钉文件前后 JSON 全同）；§0 杯内不新增请求；别人 WIP HANDOFF_2026-10-31.md M 不碰。

## 4. 验证

- **verify_v02260 963/963**（954 基线＋9 新；素材交叉按统筹裁钉原 5 杯后全绿，见 §5）。新测试：fpKey/numericFpKey 与 hook 同源＋21 协议字段契约＋ext-status 无镜像／fp null（flowMultiplierCurrent=1.2 超容差）／LUT 点变更 fpKey 失效／温度语义（cfg.temperature+1→fpKey 变 numericFpKey 不变）／hello 端到端（__httpRequestHandler POST external-hello：ok＋fpKey＋镜像 normalize 格式 dropped 行剔除＋文件只读 JSON 全同；ext-status 无镜像同 key）／镜像 null 态＋deepEqual normalize／杯末数据链（syntheticRun→finalizeDiagnostics→summary 10 键＋diagnostics endpoint {summary,run} runId 一致）／镜像实时读主本／external-flow 写入面 ledger 语义不变。
- **成对写序列回放**（__d18-writeseq.cjs 双跑：base=3cd2cd8 plugin vs 新 plugin，history-18 近 4 杯含 2.2.55 干净杯＋杯21/22/23）：**WRITESEQ_VERBATIM=true**（writes 逐字＋status complete＋oqTailErr −7.71/−0.66/0.88/7.71 全同）→加性字段不进控制实证。取证 .tools/__fp-ws-base.json／__fp-ws-new.json。
- sim-regression 5/5；node --check plugin.js/verify 通过；manifest 2.2.60/descLen397。

## 5. 外部数据漂移（呈统筹裁，非本批回归）

- **现象**：verify「2.2.59 Vi refit crosses the 5-cup calibration material」FAIL（v02260 与 v02259 基线复跑同红）。
- **诊断**（探针 .tools/__fp-matdiag.cjs）：vi-refit-material.json mtime **2026-11-21T07:24:38Z（15:24 本地）**被外部从 5 杯扩到 **9 杯**（新 runId 1795232484374-1/1795235159794-2/1795238671071-3/1795245280005-4＝杯26–29，history-all 07:22 并档）；原 5 杯 obs vs (40.929−viPlanMl)/32.251 反推 diff≤0.0001 全过；新 4 杯 diff −0.1335/−0.2131/−0.1051/−0.2130（新行 viPlanMl 疑为 clamp 后值或他批口径，反推式失效）。
- **处置（统筹 relay-9 裁定 b，11-21，已执行）**：测试钉回原 5 杯标定子集（cal5 filter＋cal5.length 归一＋子集存在断言），反推式/原 5 杯素材不动；杯26–29 属 refit 后活体验证另一口径（活体 rmse 0.104 统筹已独立核），素材属主取证另注记（子集标记＋viLawRawMl，统筹已通知）。修毕 963/963 全绿。
- v02259 基线复跑另 2 红（version pin/heartbeat pluginVersion）为 2.2.60 版本钉预期差，v02260 已更新绿。

## 6. 待办

- 发版另问（改码＋统筹核过后呈用户批发版链）；本批不发版不 push 不 tag 不装机。
- 素材漂移已裁已修（§5），verify 全绿；发版波条件满足，待用户批。
- APK 消费（hec 里程碑）：fpKey→O1 暖机指纹匹配＋Vi 完整指纹门；numericFpKey→D2 证据 live 门；gainMemory 镜像→pre-cup 刷新（hello）；新字段展示/消费记同步债。
- 杯末评分取不到值排查另批 01a1ebd1（本批数据链回归绿，非 ext payload 引起）。

## 7. 复跑索引

- node decenthyperexplugin.reaplugin/tests/verify_v02260.cjs（963，1 已知外部漂移红）；node sim/tests/sim-regression.cjs（5）。
- 成对回放：node D:/vscode/.tools/__d18-writeseq.cjs <plugin路径>（base 对比 .tools/__fp-plugin-base.js=3cd2cd8）；素材诊断 node D:/vscode/.tools/__fp-matdiag.cjs。
- 代码锚点：rg "fpKey: fpKey" plugin.js（externalStatusPayload）／rg "gainMemoryMirrorPayload" plugin.js。

