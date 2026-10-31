# HyperEx 2.2.4 handoff — 2026-11-01

2.2.3 真机一杯：S2 没到 5、不平直；S3 波动大；诊断页把 Decaid 拖住；状态栏 REAL 冻结在一个固定值（另外两格在动）。

## 本版只处理状态栏 REAL

- startFlowStripTicker 推送周期 1000 ms → 500 ms。
- stripRealFlowText 原来固定读 state.liveTrim.lastCheckGS，调流一停就冻结。现在：调流值 1.5 s 内新鲜就用它；过期退回当前杯最近 16 个 S2/S3 原始秤样本的短窗回归（要求跨度 ≥0.8 s）；再不行用 state.latestRawDwDt（1.2 s 内）；都没有才显示「—」。
- 测试：tests/verify_v0224.cjs 625/625。

## 没有处理的

- S2 未达 5 g/s、不平直：需要 2.2.3 那杯的 liveFlowTrim.trace 与 rawScaleSamples 才能判断是水量不足、回落过早，还是杯内写得不对。
- S3 波动大：同上，先分清是 drift 形状偏了还是救急反复触发。
- 诊断页卡死：怀疑打开时的 calibration-status（会顺带做曲线校验/上传）加上大 trace 的同步重绘，但没有复现，未改。
- 调流为什么会在杯中停：看 trace 的 report.status 与最后一条 check 时间戳。

## 真机

1. 装 2.2.4，先 RETURN ALL TO LUT。
2. 看状态栏 REAL 是否在出液期间持续跳动（0.5 s 一次），调流停掉后是否仍在更新。

## 发布

- GitHub v2.2.4；夸克 来自：Codex/HyperExPulseFilter_v2.2.4.zip。

