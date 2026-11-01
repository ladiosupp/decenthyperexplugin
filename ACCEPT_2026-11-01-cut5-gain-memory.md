# cut 5 验收 — 增益记忆结构（v2.2.12）

日期：2026-11-01 · 版本：2.2.12 · 基线：`80da6b4`（v2.2.11）· 状态：**未提交、未发版**。

## 1. 交付物

| 文件 | 内容 |
|---|---|
| `decenthyperexplugin.reaplugin/plugin.js` | 增益记忆结构；版本号 2.2.12 |
| `decenthyperexplugin.reaplugin/manifest.json` | 2.2.12 |
| `decenthyperexplugin.reaplugin/tests/verify_v02212.cjs` | v02211 复制 + 7 条新测试 |
| `decenthyperexplugin.reaplugin/tests/RESULTS_v02212.txt` | 658/658 输出 |
| `decenthyperexplugin.reaplugin/README.md` | 2.2.12 小节（顶栏） |
| `decenthyperexplugin.reaplugin/HANDOFF_v02212.md` | 交接 |
| `D:/vscode/.tools/hx-cut5-replay.js` | 真机 JSON 回放（只读，未入库） |

v02211 / RESULTS_v02211 / v0226 原样保留。

## 2. 对照 cut 5 的六项要求

| 要求 | 实现 | 证据 |
|---|---|---|
| ① 桶中心改成滑动中位数或按 α 更新 | 每桶 `samples`（≤6），`center=median(samples)`；每杯更新 | `L-4 the bucket centre is the sliding median`：0.20/0.22/0.24 → 0.22 |
| ② 最近邻 + 超 radius×hysteresis 才新建，新建前先尝试并入 | `selectGainBucket` 先取最近桶；`limit=min(radius×1.25, 邻桶中心距/2)`；`≤limit` 命中，`≤radius` 并入（`absorbed:true`），否则新建 | `L-4 membership is nearest-neighbour ...`：0.40 与 lastBucketId 无关；0.3831→g3 / 0.3881→g2 |
| ③ 缺段回退其它桶并标 stale | `gainMemorySuggestion` 借同段记忆（先 n、再距离），返回 `stale:true` / `fallback:"cross-bucket"` / `activeBucketId` | 真机夹具：g2 无 s3 → g3 r=1.9421、drift=0.913、command 0.772 |
| ④ 淘汰改 LRU | `createGainBucket` 按 `updatedAt` 淘汰最旧，排除新桶与 `lastBucketId` | `L-4 eviction is LRU by updatedAt` |
| ⑤ r 范围统一 [0.2,3]，越界丢段记原因 | `GAIN_R_MIN/MAX` 单一来源；`normalizeGainMemory` 写 `dropped` | `L-9 ...`：r=4.2 / 0.1 丢弃，0.2 / 3.0 保留；源码只有一处字面量 |
| ⑥ 分子分母窗口对齐 | `stage2EffectiveCommand` 末 40% → 60%，与 `tailMeanGS` 同窗；观测记 `window.startPct=40` | `L-10 ...`：60% 中位 5.0 / 40% 中位 3.0，r 按前者 |

附加（台账口径）：每段记忆记 `commandMlS` 与 `commandBand`，建议返回 `commandBand` / `currentBand` / `crossBand`。

## 3. 测试

- `node tests/verify_v02212.cjs` → **658/658**。
- 新增 7 条（详见 HANDOFF §2），全部是口径不变量或真实数据驱动的行为测试；没有 `assert.equal(plan.field, 常数)` 式镜像断言。
- 安全门测试（限压 / ACK / 超时 / 帧确认 / 预算 / 秤失效 / profile truth / 存储回读 / UI 翻译）一条没删、没弱化。
- `node tests/verify_v02211.cjs` 对 2.2.12：**650/651**，唯一红的是版本号断言（预期，和 2.2.8–2.2.11 的规律一致）。

## 4. 真机 JSON 交叉验证

数据：`C:/Users/ladios/Downloads/hyperex-history (4).json`（30 杯，22 杯 fullRecord，2026-11-01 08:30 导出）。

**导出的增益记忆**（结构与审查 §1.4 完全一致）：

| 桶 | center | s2 | s3 |
|---|---|---|---|
| g2 | 0.4715 | r=1.2874, n=3 | — |
| g3 | 0.2997 | r=1.6304, n=2 | r=1.9421, n=2, drift=0.913 |

- 旧命名带宽：g2 [0.3215, 0.6215]、g3 [0.1497, 0.4497]，**重叠 0.3215–0.4497**。
- 新分界 0.3856：0.3831→g3、0.3881→g2；把 `lastBucketId` 在 g2/g3 之间来回改，0.40 的答案不变。
- 缺段：活动桶 g2 求 s3 → g3（r=1.9421、drift=0.913、stale=true、command 0.772 ml/s），不再掉回 LUT 的 0.719。

**22 杯重放**（直接跑 shipped 代码）：只有 4 杯有可用 S2 压力/流量签名（2.2.4×3、2.2.5），其余旧记录缺机器遥测。

| runId | 版本 | 签名 | 落桶 | s2 观测 |
|---|---|---|---|---|
| 1793489359425-1 | 2.2.4 | 0.3899 | g2（新建） | 1.261 |
| 1793489532447-2 | 2.2.4 | 0.2997 | g2 | 1.296 |
| 1793490122135-1 | 2.2.4 | 0.3655 | g2 | 1.211 |
| 1793492759538-1 | 2.2.5 | 0.5176 | g3（新建） | 1.276 |

终态：g2 center 0.3655 / radius 0.08 / samples [0.3899,0.2997,0.3655] / s2 r=1.2448；g3 center 0.5176 / radius 0.12 / s2 r=1.276。命中带 [0.2894,0.4415] 与 [0.4415,0.5936] 相接，**不再重叠**。r 落在技能台账的低流量区（1.22–1.26）附近，与「r 是命令的函数」一致。

## 5. 仿真植物

本版不改控制律、不改补水段，植物动力学参数未动。用 `HX_LOOP_REPORT=1` 复核补水闭环，与 2.2.11 输出逐项一致：rise20-80 = 0.60 s、峰值过冲 +33.2%、平台 −19.3%、return 3.875 ml/s、writes 3。技能台账已补一行「cut 5：无参数变更 + 增益记忆回放结果」。

## 6. 边界

没有碰：`boundedRefillControlBase`、`boundedRefillCommand`、`stage2StartupPlan` 的 bounded 分支、`s2RefillReturnReason`、`dispatchS2Startup` 的 boost|bleed|trim|return、`liveTrimTick` 的 startup 分支与控制律。补水的 `predictionSeconds`、`cutoffPercent`、`bleedMs`、`S2_REFILL_SETTLE_MS` 全部保持 2.2.11。

## 7. 风险与观察点

1. 半径下限 0.08：真机上若同一张纸的签名漂移超过 0.08，会新建桶。重放里最后一杯就是 0.152 的跳变。需要真机观察桶数量增长；若过快，先调下限而不是改回固定 0.12。
2. `commandBand` 首次观测前为空，`crossBand` 只在已有带别时生效。
3. 存量 r 若在 [0.2,3] 之外会被丢弃（导出数据里没有）。
4. S3 回放只能沿用已存 s3 行，导出里没有 `evidence.s3`；跨桶回退是通过导出记忆直接验证的。

## 8. 复现

```
cd D:/vscode/decenthyperexplugin/decenthyperexplugin.reaplugin
node tests/verify_v02212.cjs
$env:HX_LOOP_REPORT='1'; node tests/verify_v02212.cjs
node D:/vscode/.tools/hx-cut5-replay.js
```

