# HyperEx 2.2.45 experimental

Auto-only S2 handoff fix after the first 2.2.43 real-machine auto run.

## 修复

- **auto release → S2**：0 bar 帧的 seconds 仍是 SoakSeconds；插件倒计时结束后先等机器物理帧真正到 S2（最多 900 ms），看到就直接进 S2，不再发第二次 skipStep。只有固件一直停在 release 帧才 fallback 发一次 skip；skip 后再确认帧号，若已到 S3 则中止，不在 S3 上跑 S2 控制。
- **auto refill**：S2 物理帧确认后，第一次补水 boost 再等 100 ms；ON/OFF 不加这个等待。
- **ON/OFF 不变**：on 仍走 beginDump → beginSoak → restartPourConfirmed → scheduleRestartSkip；off 仍连续 S1→S2→S3。

## 2.2.43 真机数据

4 杯 auto 只有 1 杯进入 S2；另外 3 杯在 soak 结束瞬间多发了一次 skipStep，把固件刚到的 S2 推成 S3。失败杯到 40 g 时报 refusing skipStep because profileFrame=5, expected 2。0 bar 帧本身泄压正常（0.74–1.61 → 0.09–0.21 bar）。

## 测试

tests/verify_v02245.cjs **787/787**；node --check 通过。旧 tests/verify_v02242auto.cjs 保留为 2.2.43 历史测试。

## 关注点

装 2.2.45 后连续跑 3–4 杯 auto，确认每杯都进入 S2；再看补水峰值是否仍 >15–20%。2.2.45 只加 100 ms 帧确认，不改 boost 数值；若峰值仍高，下一版再考虑 auto 专属 boost 上限/收口。
