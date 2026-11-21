# 2.2.61 d1（a′ 窄版＋S2 normal 封顶 1.25）· 实施交接（2026-11-21，relay-10 派单，用户 11-21 批 d1；改码本批授权，发版/push 另问）

> 基线＝插件仓 `D:/vscode/decenthyperexplugin` 分支 `auto-hyperex` 的 **51ccff2**（2.2.61 grace 候选，本地未推未发版）。本批与 grace 合入**同一个 2.2.61**，不另起版本号（用户「这两批做完再发版」）。本文件自包含；依据＝[S2 当杯候选序评估](HANDOFF_2026-11-21-s2-current-order-eval.md) §1.3/§2/§3 与技能 §22.3/§22.13/§22.18。

## 1. 改了什么（`decenthyperexplugin.reaplugin/plugin.js`，30+/4-）

1. **常量**（:345 / :348）：`S2_NORMAL_CEILING_RATIO=1.25`；`S2_FINAL_SIGNATURE_BASIS="S2 refill return +2–4 s pressure / machine flow"`（与 `gainRegimeForRun` 的 basis 字面量逐字相同，含 en dash）。
2. **`s2FinalSignatureClaimsRun(run)`**（:9652，新函数）：`gainRegimeForRun(run)` 的 basis 必须等于上面那条常量，且 `selectGainBucket(memory, regime.signature).bucket` 非空。**`absorb` 不算命中**（它只会加宽邻近桶）；无 run／无记忆／无桶一律 false。
3. **`liveTrimMemoryCandidate`**（:9669–:9674）：S3 保持 `[run, diagnosticLast, diagnosticCurrent]`；S2 改为 `currentFirst = stageKey==="s2" && s2FinalSignatureClaimsRun(run)`，真则当杯最前，假则原序 `[diagnosticLast, run, diagnosticCurrent]` 逐字。
4. **`commandCeilingFor`**（:9779）：`hi = max(anchor × (stage2 && normal ? 1.25 : 1.2), mapped)`。S3 normal、rescue 分支、`lo`（×0.8）、以及 `liveTrimControlCenter` 里 `±0.35` 的绝对包线全部没动。

没动的：`GP_PLUGIN_VERSION`（仍 2.2.61）、manifest（2.2.61 / description 397 字）、LUT、记忆结构、Vi、静默/backstop/FC_FACTOR、影子（`sent` 恒 false）。

## 2. 语义

a′ 的意图是**只在当杯签名已终局时切先验**：S2 开段与补水上升期的 late-60% 签名（杯29 的 0.4137／0.6998）不是稳态，切过去会路由到 g9 再在中段回退 g2（4.25→3.94 的回摆，违反 §22.13）。终局窗口＝return 写之后 +2–4 s、≥10 样本；命中桶才切。杯29 的 0.9263 不命中任何桶（且无桶可借），所以杯29 a′ 无变化——这是预期，不硬凑。

c 是把 S2 normal 的可达上沿从 `center×1.2` 放到 `center×1.25`；这是**放宽杯内可达范围**，不是换先验，故不受 a′ 的签名条件约束。

## 3. 验证（实跑）

- **verify_v02261 986/986，EXIT0**（978 基线 + 8 条 d1 断言）。新增断言：a′ 过渡签名（late-60%）即使命中 g9 也不切、终局命中则 `liveTrimMemoryCandidate`/`liveTrimControlCenter` 都到 g9、终局无桶回退 diagnosticLast、absorb 不算命中、无记忆不抛错、S3 的 2.2.28 契约不动；c 只动 `stage2+normal`（3.9375→4.875）、S3 normal 仍 .875、rescue 仍 5.0、lo 不变；**归档三笔**按记录 `controlCenterMlS` 复算「旧封顶=记录命令」且新封顶放行到 intended。禁镜像（断言的是 tick/函数行为与真实归档数据）。
- **成对写序列回放**：base＝51ccff2（`git show` 提取到 `.tools/__d1-plugin-base.js`）vs 新，`__d18-writeseq.cjs`（history-18 近 4 杯）：writes／oqTail／oqTailErr／observedR／status 全部逐字，**D1_WRITESEQ_VERBATIM=true**。
- **sim 5/5**；`node --check plugin.js`／verify 通过。
- **134 杯 recorded-decision 回放（375 笔）**：见 §4 的 c／a′ 数字。

## 4. 134 杯回放结论（真实在线记忆）

**c（决策级，逐笔）**：S2 非 startup 写 375 笔（106 杯），旧 ×1.2 只夹 3 笔，且三笔都是欠流杯的上调：

| 杯 | 记录 center | prev → 旧命令 | 新命令 | 说明 |
|---|---|---|---|---|
| 9401-1 | 3.063 | 3.375 → 3.625（act 4/6） | **3.75** | 完整 6 档 |
| 4643-2 | 4.313 | 5.0625 → 5.125（act 1/4） | **5.3125** | 完整 4 档；评估里的 5.1875 是近似桶重建值，以本行为准 |
| 杯29 | 3.938 | 4.625 → 4.6875（act 1/4） | **4.875** | 完整 4 档 |

其余 **372 笔逐字**（命令、center、source 全同）。判据：对每笔用记录 `controlCenterMlS` 复算 `floor(center×1.2×16)/16`，若等于记录命令即证明夹点是 anchor 边界（`mapped` 不是约束），于是新封顶必然放行到 intended 档数。

**a′（决策级，逐笔）**：375 笔里 70 笔处在「终局签名命中桶」的时点 → 41 笔同桶（`gainMemorySuggestion` 返回同一 stateRow，逐字不变）、29 笔（16 杯）换桶、27 笔中心真的移动、**0 回摆**（同一杯切过去后没有回到旧桶）、27/29 换向当杯最终记录的桶。return 窗选不到桶的 64 笔全部不变；杯29 的 4 笔全不变（0.6998 是 late-60%、0.9263 不命中）。

## 5. 局限（如实，别把近似当结论）

1. **tick 级闭环回放只复现 4/84 杯**的归档 S2 写命令序列。原因：归档不含当杯的 plan/return 基值与 `stages.s2.bands` 行，重放必须自行推导，绝对命令流因此整体偏移（杯29 重放 baseline 3.75，记录 3.9375）。所以 134 杯的 c／a′ 结论以 §4 的 **recorded-decision** 为准。
2. tick 回放仅保留为**律级辅助**：84 杯里 74 杯 base=new；10 杯有差，首笔都是被旧封顶卡住的上调（3.0→3.125、5.0→5.125 类），无新增下调笔、无方向反转增加。其中 6 杯是 0.1.77／1.79ds／1.83ds 前预测控制时代（写行没有 steps/center，封顶语义不同），不属本批口径；402254-4（2.2.27）重放 center 2.5 ≠ 记录 4.313，重放不可信，也在差异表里如实列出。
3. a′ 的中心**绝对值**用的是桶整体 r（记录里没有 band 行），因此与在线 band 条件值可能差一个量化档；但 a′ 变化的是**读哪只桶**，同桶时 stateRow 相同、结果逐字——这一点是精确的。
4. c 的过冲安全**不能**由归档证明：3 笔都是上调放开，需要真机看峰秤流（§22.18 40% 绊线）。

## 6. 红线核对

LUT 未被学习改写（本批不碰学习）；记忆不删改（只读）；硬包线 0.10–8.00／1/16／上行压力门单一实现（`commandCeilingFor` 与上游 guard 均未改）；`rescueHot` 三门、backstop 0.85、静默 1200/2400、FC_FACTOR=0、影子 `sent` 恒 false 全不动；§0 杯内不新增请求；单写者（无新增写路径）；别人 WIP `HANDOFF_2026-10-31.md` 不碰。

## 7. APK 移植同步点（shadow）

- `estLiveTrimControlCenter`：与 `liveTrimControlCenter` 对位；1.25 只作用于 **S2 normal**，S3／rescue／lo／`±0.35` 不改。
- `commandCeilingFor` 的 shadow 版：同一处三目（`stage2 && normal`）。
- a′：shadow 侧 S2 候选序加同一 gate（basis＝return+2–4 s **且**命中桶，absorb 不算）。注意 shadow 若没有 `gainRegimeForRun` 的 basis 字段，就不能移植这条——本批的前提是插件侧字段存在且语义与评估一致（已核：basis 字面量逐字匹配）。

## 8. 待拍板／遗留

1. c 的放开面比评估的「3 笔」多了**潜在**的一档：任何 S2 normal 写若原本被 `center×1.2` 顶住，现在会多走一档（典型是 LUT center 2.5 的 3.0→3.125）。归档里真正发生的只有那 3 笔，但真机请留意欠流杯尾段是否因此更接近目标、以及峰秤流是否仍在 40% 内。
2. 4643-2 的新命令由 5.125 变为 5.3125（评估写的 5.1875 是近似值）——如果统筹要按评估口径复述，请用本表。
3. 真机陪杯本批不做（另批）：需看中心序列、每笔写、峰秤流、tail/whole；杯29 类与 9401-1 类各 1 杯。
4. 发版（打包/Release/夸克/平板推送）与 push 均未做，等统筹核后另派。

## 9. 复跑索引

- 回归：`node decenthyperexplugin.reaplugin/tests/verify_v02261.cjs`（986，EXIT0）。
- sim：`node sim/tests/sim-regression.cjs`（5/5）。
- 成对写序列：`node .tools/__d18-writeseq.cjs <plugin>`（base＝`.tools/__d1-plugin-base.js`）。
- 134 杯：`.tools/__d1-replay134.cjs <variant> <plugin> [from] [count]`；比对 `.tools/__d1-cmp134.cjs`；a′ 逐笔 `.tools/__d1-aprime.cjs`；c 逐笔 `.tools/__d1-cbv.cjs`／`__d1-probe.cjs`（均为 untracked 探针，不入库）。
