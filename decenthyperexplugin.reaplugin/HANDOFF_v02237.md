# v2.2.37 交接 — 研磨建议（2026-11-05）

状态：已改完、已跑测试（741/741），本地待提交。

## 这一版做了什么

诊断页新增「研磨建议 · GRIND ADVISORY」琥珀色块，只给方向，不改曲线、不改研磨、不写机器。

- 判据：S2 尾段压力 / 机器流量 `p/q` 对比当前增益桶中心；S2/S3 尾段流量误差；S2 尾 CV；S3 late/early。
- 偏粗：`p/q` 比桶中心低 ≥12% 且 S2/S3 流量偏高 → 调细约 1 档。
- 偏细：`p/q` 比桶中心高 ≥12% 且 S2/S3 流量偏低 → 调粗约 1 档。
- 流量偏高但阻力正常：先查粉量/指令；CV ≥15% 或 S3 late/early <0.80：先查布粉/通道，连续两杯再调细半档。
- 输出：`diagnosticSummary.grindAdvice` 与历史 JSON 的 `shot.grindAdvice`，字段含 `status/direction/label/confidence/s2Pq/referencePq/relPct/s2TailErrorPct/s2TailCvPct/s3TailErrorPct/s3LateToEarlyRatio/detail`。

## 数据依据（hyperex-history (8).json）

换磨豆机后的三杯（2.2.34，19:28/19:36/19:44）S2 尾 p/q 分别为 0.269 / 0.311 / 0.217，旧桶中心 0.3103；19:44 新建 g5 0.2002（n=1 LOW）。同段 S3 均值 +6.4%–8.2%，19:36 early 2.05 → mid 1.47，符合偏粗/快粉饼。2.2.35 的 06:31 是反例：p/q 0.353、S3 1.40（−6.6%），偏细。

## UI

- `renderNextDecision` 里追加琥珀色块：左边框 `#f59e0b`、底色 `rgba(245,158,11,.10)`、标题 `#fbbf24`、建议文字 `#fcd34d`。
- 只在 `grindAdvice.available` 时显示；不可用时不占位。

## 测试

- `tests/verify_v02237.cjs` **741/741**；新增 3 条：低阻力+高流量→coarse/finer、高阻力+低流量→fine/coarser、阻力与两段流量都在带内→hold；另 1 条检查琥珀色块与 only-when-available。
- `node --check` 通过；manifest / plugin / 页面版本一致 2.2.37。

## 已知边界

- `p/q` 受粉量、粉碗、豆子、预浸影响；建议只在同豆同粉量下比较，换豆/换粉量先别当研磨结论。
- 换磨豆机第一杯的桶中心可能还是旧的（g3 vs 新 g5），建议会标 LOW；连续两杯同向再动。
- 这是建议，不会自动改 S2/S3 指令，也不会改研磨。
