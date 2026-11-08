# HyperEx 2.2.45 交接：auto release → S2 交接修复 + 100 ms 补水帧确认

日期：2026-11-08（北京时间）。实验版本，尚未真机复测。

分支：auto-hyperex。基线：2.2.43 发布提交 98e38ba（tag v2.2.43）。

## 问题（2.2.43 真机 4 杯 auto）

4 杯里只有 1 杯真正进入 S2，另外 3 杯直接跑到 S3：

| 杯 | soak 起点 | 固件自己到 P=2 | 插件 skip 请求 → ACK | 之后 P=3 | 结果 |
|---|---:|---:|---:|---:|---|
| 01:34 | 7200 | 17239 | 17213 → 17391 | 17534 | 失败 |
| 01:38 | 4900 | 14946 | 14915 → 15043 | 15234 | 失败 |
| 01:39 | 4615 | 14514 | 无 | — | 成功 |
| 01:46 | 7040 | 17100 | 17057 → 17189 | 17329 | 失败 |

根因不是 S2 补水触发条件，而是 release→S2 的 skip 竞争：0 bar 帧自己的 seconds 就是 SoakSeconds，固件在 soak 结束前后自己进 P=2；插件的 soak 定时器早 20–40 ms 发 skipStep，preflight 读到 P=1，等 ACK 回来机器已是 P=2，这条 skip 就把 P=2 推成 P=3。成功那杯是固件先到 P=2，guardedSingleSkip 看到 expectedTo 直接 no-op。

失败杯之后插件仍按 phase=stage2 跑，机器实际在 S3 的物理帧 3/4/5；到 40 g 时尝试 S2→S3，读到 profileFrame=5，报：

Could not advance to final low-flow stage: S2 -> S3: refusing skipStep because profileFrame=5, expected 2 (or already 3)

0 bar 帧本身是实际泄压的：4 杯 soak 起点 0.74–1.61 bar，结束时 0.09–0.21 bar；到 0.5 bar 用 0.69–4.64 s。S2 入口压力 0.085–0.212 bar，比 on 的 0.29–0.80 bar 低。

## 2.2.45 改法

1. auto release → S2 等真实帧：finishAutoSoak() 先等 state.lastPhysicalFrame === layout.s2，最多 900 ms；看到就直接进 S2，不发 skip。超时才 fallback 发一次 guardedSingleSkip(release, s2)；skip 后再等 400 ms 确认，若已到 S3 则 abortSequence，不在 S3 上跑 S2 控制。
2. auto boost 100 ms 帧确认：dispatchS2Startup 的 boost 分支在 auto 下额外要求 S2 物理帧确认后满 100 ms；ON/OFF 的 autoConfirmMs=0，仍按原时序。100 ms 只移动 boost 起点，不固定延长 soak；B 本身等的是固件真实帧，通常只比旧定时器晚 40–60 ms。
3. ON/OFF 不变：guardedSingleSkip 本身没改；on 仍走 beginDump → beginSoak → restartPourConfirmed → scheduleRestartSkip；off 仍连续。新增用例专门验证 on 在 lastPhysicalFrame=5 时仍只发一次 skip 并进 S2。

## 测试

- tests/verify_v02245.cjs 787/787（2.2.43 的 783 条 + 4 条：固件先到 S2 不再 skip、固件停在 release 时 fallback 只 skip 一次、机器已到 S3 时中止、on 交接不等待 auto 帧、auto boost 100 ms 确认）。
- node --check decenthyperexplugin.reaplugin/plugin.js 通过。
- 旧 tests/verify_v02242auto.cjs 保留为 2.2.43 历史测试，不再对 2.2.45 全绿是预期。

## 真机复测重点

1. 装 2.2.45，确认 auto 曲线 4 帧、第 2 段 pressure 0。
2. 连续跑 3–4 杯 auto，确认每杯都进入 S2；若再出现直接到 S3，抓 auto_release_soak_start 后 10 s 的 physicalProfileFrame、skip 请求/ACK 和 stage3_start。
3. 成功进入 S2 后看补水：当前 2.2.43 唯一成功杯是 boost 5.5 ml/s × 3.0 s、峰值 6.18 g/s（+23.5%）、尾段 5.533 g/s（+10.7%）。2.2.45 只加 100 ms 帧确认，不改 boost 数值；若峰值仍 >15–20%，下一版再考虑 auto 专属 boost 上限/收口（5.0–5.25 ml/s、hold 2.0–2.5 s 或压力 0.8–1.0 bar 收口）。
4. 跑一杯 on 对照，确认 on 的 S2 交接和补水时序没变。

## 回滚

切回 2.2.43 包（tag v2.2.43）即可；2.2.45 没有改 LUT、S2/S3 目标、限压、补水设置、皮肤或宿主。
