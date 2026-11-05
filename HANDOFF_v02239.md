# 2.2.39 交接 — 删除诊断页标题行

## 0. 一句话

诊断页不再显示「诊断 / 流量校准」和右侧的步骤说明，页面从萃取模式卡片直接进入步骤列表。

## 1. 改动

- 删除 #diag 内的 .diaghead / .diagtitle / .diagdesc 结构与对应 CSS。
- 删除两条只服务该标题行的翻译词条。
- 版本升到 2.2.39。

## 2. 未变

- 萃取模式卡片、主动泄压/算法介入、步骤 1–4、学习/控制逻辑、所有安全门均未改。

## 3. 测试

- tests/verify_v02239.cjs 751/751；新增标题/说明行删除测试。
- node --check 通过。

## 4. 发布状态（2026-11-05）

- 代码提交：47aa675（2.2.39 标题行删除）。
- tag v2.2.39 → 47aa675；分支 v1.79ds → 发布记录提交。
- GitHub Release：https://github.com/ladiosupp/decenthyperexplugin/releases/tag/v2.2.39
- 附件 HyperExPulseFilter_v2.2.39.zip：463,052 字节，SHA256 25FE832022F1D586D2F6B990829CCA362BA5A0D2DF13547B616A37962A03F3E4。
- 夸克：夸克网盘/来自：Codex/HyperExPulseFilter_v2.2.39.zip，fileId 07aa303f44e349abaf8f4fc81e24fc99。
- 测试：发布包解压后 751/751；本地 751/751。
