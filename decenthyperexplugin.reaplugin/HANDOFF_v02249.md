# HANDOFF v2.2.49：S2 杯间自适应加固（P0+P1+P2 修复批）

> 插件侧 only。用户 2026-11-18 授权「p0 p1 p2 一起做完了一起发版，之后我再跑真机」（统筹派单）。
> 评估真源：HANDOFF_2026-11-18-s2-adaptive-eval.md（插件仓根，未跟踪）；口径真源：decentplugin 技能 §22。
> 本 MD 随包入库（zip 内）；发版回执在文末 §8（commit 2 补）。

## 0. 一句话

杯内自适应灌水没问题，问题在杯间 override：污染 band 先验 + 直接映射无步长阻尼，杯 6 HIT 后 base 一步 3.875→5.0（+29%）→ 杯 7/8 +30.1%/+21.8%。本批五项修复后，真机状态回放 1–3 杯收敛 HIT（修复前 9–17 杯），HIT 态不再被记忆推翻。

## 1. 背景数字（评估回放，全点交叉验证）

| 杯 | base | wholeReg | 学习分子 tailMean | 学习分母(回显中位) | obsR | 真实增益 wholeReg/base |
|---|---|---|---|---|---|---|
| 6 | 3.875 | 5.153 (+3.1%) | 5.117 | 4.125 | 1.2405 | 1.3297 |
| 7 | 5.0 | 6.504 (+30.1%) | 6.200 | 5.438 | 1.1401 | 1.3009 |
| 8 | 4.375 | 6.088 (+21.8%) | 5.684 | 4.313 | 1.3179 | 1.3916 |

- 跳变链：杯 6 杯内 trim 上写 → 有效指令中位 4.125 → 观测落 g2「4.0-5.0」band（先验 = 11-01 23:06 饱和杯单样本 r=0.9174，α 0.55）→ EMA 0.9562（n=2）→ 标量 HOLD 被直接映射分支覆盖 → snap(min(5/0.9562, LUT×2=5.014)) = 5.0，无阻尼。
- 慢收敛：g3「4.0-5.0」15 条旧咖啡样本 r≈1.1467，α 0.12，杯 8 偏差 13.3% < 15% 门 → 无 local；4.375→4.313 是慢 EMA 不是阻尼。
- 修复前回放：r=1.33 需 9–17 杯、平衡 +6–8% 偏热；4.0 带边界振荡。修复后：1–3 杯 HIT、平衡 ≤±1.5%。

## 2. 五项改动（plugin.js 2.2.49）

1. **P0-1**（决策块直接映射分支，~4390）：±25%/0.35 ml/s 包线一步过渡（复用 pull 分支包线，§22.8）；吸附后与曲线半档内 → HOLD。
2. **P0-2**（决策块 memoryS2 入口，~4360）：oq2.tailErrorPct ≤ policy.deadband（8%）= tailHit；regimeChange = local || baseBand≠commandBand（**不用 L-7 crossBand**，防污染带循环绕过）；bandImmature = !regimeChange && bandMatched && bandN<3。tailHit&&!regimeChange 或 bandImmature 时 **pull 与直接映射两分支都 withheld**（role hit-anchor / immature-band，applied=false），标量自身的有界纠正照常（FF ±12%/0.35、reverse ±8%/0.35 是设计内学习，不冻）。
3. **P1-3**（gainStageObservation ~1490 + gainMemorySuggestion ~1640）：观测 commandBand = commandBandOf(base 指令)（base 缺失回退 effective）；r 分母仍是 effective（§22.3 不变）；suggestion 的 crossBand = 估计带≠指令带 || 估计带≠baseBand（去掉 trim 敏感的有效带项）。**杯内 platform 选择不动**（liveTrimMemoryCandidate 仍按有效带查 r，无收回饥饿风险）。
4. **P1-4**（updateGainMemoryFromRun ~1610 + normalizeGainMemory ~1248）：local 种子行 steadyN=0/provisional=true；稳态观测 +1；steadyN≥2 转成熟；legacy 行（steadyN==null）首触豁免=2。provisional 行在 gainMemorySuggestion 里 bandR=null → 回退整体 r（bandProvisional 字段透出）。normalize 幂等保留 steadyN（null 不强转 0）/provisional。
5. **P2-5**（gainBackfillAlpha ~1302）：0<dev≤0.15 → α=max(α, 0.35×dev/0.15)；>0.15 仍 max(α,0.55)。保守依据：门内不超设计基准 0.35（§22.3 α≈0.35）、dev 0 不升、damped 减半与饱和 alphaOverride 0.55 下游仍生效。杯 8 dev 13.3% → α 0.31（原 0.12 的 2.6 倍）。

## 3. 迁移方案：自然失效（不删数据）

选自然失效而非显式迁移，理由：① 用户未授权删记忆数据（红线）；② §22.3「重跑 LUT/换纸不必清空记忆，只降置信」同精神；③ 显式重写 band 会误伤合法历史。落地：污染 g2「4.0-5.0」n=2 行被 P0-2 成熟度门挡死，且 P1-3 后不再收到新观测（base 3.875 的杯路由去 3.0-4.0）→ 永久失效；g3 旧咖啡行合法但陈旧，P2 快速吸收 + P1-4 对新种子降级；legacy 行豁免避免追溯降权。

## 4. 开发中测试抓到的三个真问题（已修）

1. HIT 锚只守直接映射分支不够：无历史证据时标量走 tailGain 反算（LUT COMPENSATE 数值），记忆 100% pull 把 4.25 放大到 5.25 → 锚前移到两分支入口。
2. normalizeGainMemory 的 steadyN 保留不幂等：undefined→null→Number(null)=0 有限 → 第二遍把 null 强转 0，legacy 豁免失效 → null 显式保留（基线「归一化幂等、未知字段保 null」口径）。
3. 锚的 regime 信号若复用 L-7 crossBand：污染带把 memory 指令推到远 band → crossBand 恒真 → 锚被循环绕过 → 改用 baseBand 移动信号。

## 5. 测试回执

- tests/verify_v02249.cjs **829/829**（818 基线全绿，2 条版本断言随发版更新 2.2.49；11 新增见 RESULTS_v02249.txt）。node --check 通过；manifest JSON 通过。
- 真机交叉验证（history-4，HEC .tools/__s2-fix-replay.cjs，vm harness 驱动真实函数）：杯 6/7/8 obsR 复算 = 记录（1.2405/1.1401/1.3179），分母 4.125/5.438/4.313 不变；杯 6 路由 4.0-5.0→3.0-4.0（口径取代，记录保留）。
- 修复后决策级回放（真实函数 + 杯 8 后实际导出 gainMemory，植物比值取真机）：
  - r=1.33：杯 9 +14.7%→4.0625，杯 10 +8.1%→4.0，杯 11 +6.4% HIT→3.8125，杯 12+ 稳定 +1.4%。
  - r=1.39：杯 9 +19.9%→3.625，杯 10+ 稳定 +0.8%。
  - r=1.27：杯 9 +9.6%→4.1875，杯 10 +6.4% HIT→3.9375，杯 11+ 稳定 +0.01%。
  - 手动回 3.875（r=1.33）：杯 9 +3.1% HIT，锚稳住，杯 10+ −0.25%。
  - 注：fixture 尾段无衰减（κ=1），真机 κ≈0.95，实际可能再慢半拍；结构结论（1–3 杯 vs 9–17 杯）稳健。

## 6. 装机后首杯预期 + 手动回基值建议（明确）

- 现有 override base 4.313 仍在（设置级 testOverrides，装新包不清）。**不手动回基值**：首杯大概率 +15–20%（回放 +14.7~19.9%），随后 1–3 杯拉回 HIT，平衡 ≤±1.5%。安全无虞（硬包线/限压门全程有效），代价是 1–2 杯偏热咖啡。
- **建议装机时手动把 S2 base 回 3.875**（设置级，立即 HIT ±3%，省 1–2 杯热杯；回放 manual-reset 实证）。操作路径：Decaid → HyperEx 插件诊断页 → 曲线编辑器 → S2 指令改 **3.875** → 应用（或 DIAG 精确数值编辑）。autoApply 可留 ON（HIT 锚会保住好基值，不再被记忆推翻）。注意：打开诊断页会触发 calibration-status 的 profile 校验同步（技能 §20：非纯只读），属正常行为。
- 真机验证由取证对话陪跑（用户发版后才跑）；首杯重点跟 s2.errorPct / autoApplyLastStatus / gainMemory role（hit-anchor 应出现）。

## 7. 待拍板 / 后续

- 本批已授权范围内无待拍板。真机若出现新形态（第三种纸 / 偏差 >15% 持续），按 §22.3 机制扩展，不写死。
- 评估报告 §4 的 §22 冲突清单中，「学习输出仍是绝对指令 / mapCreatedAt 作废」（§22.7 仍然差 1）与「S2 无方向保护」（仍然差 2）**本批未动**（不在授权范围），留后续设计。
- 残留风险（已记录）：legacy 成熟污染带在**非 HIT** 杯仍可能经 pull 分支做有界（±25%/0.35）移动；P1-3 路由 + P2 吸收使其逐杯衰减，真机观察。

## 8. 发版回执（2026-11-18）

- 版本 2.2.49 / tag v2.2.49 / 代码 commit **8593268**（branch auto-hyperex，已推 origin）。
- zip **506532 字节**，SHA256 **AB47972049093076331F4C8A9C1FC5CBAB006AF858AA864482FA49FAD486414B**；git archive 自 tag 构建（干净基线，无他人 WIP）；包内回归 **829/829**、node --check 通过。
- GitHub Release **449341221** / asset **RA_kwDOVO5zXc4tXbcI**：https://github.com/ladiosupp/decenthyperexplugin/releases/tag/v2.2.49
- 夸克 fileId **6233e61ba962427385dc49bbcc6899e0**（夸克网盘/来自：Codex，506532 字节）。
- 平板 **/sdcard/Download/HyperExPulseFilter_v2.2.49.zip** 已推并 ls 核对 506532 字节（taiko，mDNS adb）。**安装由用户在 Decaid 里做，不代装**。
- 推送走 VPN 代理 127.0.0.1:57890（AGENTS 18）；gh token 走 git credential fill + HTTPS_PROXY。

## 9. 别碰 / 复跑索引

- 别人未提交/未跟踪一律不碰不代提交；本批只 add：plugin.js / manifest.json / README.md / tests/verify_v02249.cjs / tests/RESULTS_v02249.txt / HANDOFF_v02249.md（+ commit 2 回执更新本 MD）。
- 记忆数据不删；LUT/硬包线/单一写者/full-off-hec 协议不动。
- 复跑：node tests/verify_v02249.cjs；node D:/vscode/HyperExController/.tools/__s2-fix-replay.cjs（交叉验证+回放）；评估脚本 __s2-eval-extract/scan/replay/sim.cjs（HEC .tools，不入库）。

## 10. 观察项核实（统筹转达，只读，未扩 scope）

杯末弹窗评估对话发现 controlOutputQuality reduced-window 回退重复 push（plugin.js:8352，同一 if-push 连写两遍）。**属实**。影响面核实：

- 重复 push 是均匀加倍：**均值 / 方差 / RMSE / 过冲不变**；**p95 值也不变**（加倍保持经验分布，索引 ceil(0.95×2n)−1 虽变但映射到同一原序统计量）；唯一失真的是 **windows 计数（×2）**。
- windows 的唯一消费方是 s2AdaptiveSuggestion 的 large 门（1965 行 q.windows>=2）：单个真实 reduced 窗会被算成 2，保守策略下大偏差快杯可能早一杯获得单杯数值学习资格（置信度仍被 reduced 封顶 MEDIUM、步长仍 policy 有界）——窄边界，非安全问题。诊断页 windows 显示虚高（外观）。
- **杯间增益学习不受影响**：gainStageObservation 消费的 tailMeanGS / tailRippleCVPct / reducedWindow 均不变，r_obs 不变。
- 真机 history-4 77 杯里仅 **1 杯**命中 reduced 回退：1794731835503-2（11-15，windows 8 = 实 4，hec 杯 NEAR −10.1%）；杯 6/7/8 链全不受影响。
- 修法 = 删一行重复 if-push（零行为风险，windows 计数回正、large 门回紧）。**未修**（不在本批授权）；待用户拍板搭下一批（如 2.2.50）或另批。2.2.49 发版未因此延迟。

