# HANDOFF v2.2.50：S2 收回稳健性 + manual 基值尊重 + 重复 push 修

> 插件侧 only。用户 2026-11-18 授权「2.2.50 加上修重复 push 去动手吧，口径维持但是加上约束，过冲不能太高」。
> **实施 + 测试 + 本地 commit 已授权；发版（push/Release/夸克/平板）未授权**——包备好回归全绿后停下，回叫统筹 ready，待用户批准发版。
> 口径真源 decentplugin §22（新增 §22.18 记录本批 + 用户过冲约束）；评估真源 HANDOFF_2026-11-18-flood-strategy-eval.md（未跟踪）。

## 0. 一句话

灌水量律不动（§22.11），修收回时机（cutoff 背 stop + accel 滤波 + predicted sanity）与杯间 manual 锚（manual base 不被记忆覆盖），删 reduced 回退重复 push。峰秤流 ≤40% 硬验收：闭环 +15.4%、真机杯 9 新律触发 ≤4.25（旧 5.861→峰 +58.6%）。

## 1. 五项改动（plugin.js 2.2.50）

1. **cutoff 背 stop**（s2RefillReturnReason）：const backstop=target×S2_REFILL_CUTOFF_BACKSTOP(0.85)；触发条件 observed≥噪声底 && (predicted≥target || observed≥backstop)；cutoff 记录加 basis(predicted/observed-backstop)/backstopGS/predictedRawGS。背 stop 独立于 cutoffPercent。
2. **accel 中位滤波 + predicted sanity**（s2RefillFlowEstimate）：estHistory 最近 4 估计，accel=相邻差分中位夹 ±target；predicted 未封顶（shaping 用），predictedCapped=min(predicted,1.6×target)（显示/记录用）。常量 S2_REFILL_ACCEL_HISTORY=4 / S2_REFILL_PREDICTED_CAP=1.6 / S2_REFILL_CUTOFF_BACKSTOP=0.85。
3. **manual-origin 锚**（nextShotAdaptiveSuggestion 决策块）：stage2CommandOrigin=manual && s2.action≠HOLD → 强制 HOLD、delete suggestedCommandMlS、gainMemory.role=manual-anchor/applied=false。
4. **regimeChange 排除 manual**：baseBand 移动项加 !manualOrigin 前置（local 项不变）。
5. **重复 push 删**（controlOutputQuality reduced 回退）：删第二个相同 if-push；windows 计数回正。

## 2. 测试回执

- tests/verify_v02250.cjs **837/837**（829 基线全绿：3 条 cutoff 基线测试按背 stop+滤波口径重写〔lead-comp 4.3→4.0、cutoff90 边界、noise-floor estHistory 预置〕、2 版本断言 2.2.50；+ 8 新增）。node --check / manifest JSON 通过。
- 新增 8：背 stop 预测滞后时触发（observed 4.4≥4.25、decisionGS<5）/ 预测仍早触发（3.0<4.25 basis predicted）/ accel 中位拒尖峰 / 闭环噪声 ≤40%（jitter 0/0.6/1.2 峰 +15.4% rise 0.6 maxCmd 7）/ manual 锚 HIT 尾 / manual 锚热尾 / auto-apply 不覆盖 manual base（s2 留 3.875）/ reduced windows 独立复算（q.windows==独立计数，含 r2/seconds 舍入匹配）。
- 真机交叉验证（__flood-eval-cutoff-replay.cjs，杯 9/6 全点滚动斜率回放 old vs new）：杯 6 新律早触发 slope 2.473（预测，保留）；杯 9 新律触发 slope 4.055 ≤4.25 背 stop 界（记录旧律 5.861→峰 +58.6%）。回放连续采样 vs 插件 250ms tick 节奏差（replay 4.055 vs 记录 5.861），背 stop 界与节奏无关。
- 闭环硬验收（refillClosedLoop 真实 dispatch/tick + jitter）：峰 +15.4% ≤40% ✓ rise 0.6s ≤1.5 ✓ maxCmd 7 ≥7 ✓ 两段收口 ✓。

## 3. 与 2.2.49 / 评估的关系

- 2.2.49 已修（P0-1 阻尼 / P0-2 HIT 锚 / P1-3 路由 / P1-4 provisional / P2 α）不动；本批补其残留：P0-2 锚的 regimeChange 误判 manual 回基值（本批 manual 锚 + 排除 manual 修）。
- 评估选项 (a) 三项全做；选项 (b)（flood 相对 base 设上限）与 §22.11 冲突，**未做**（用户口径维持）。
- 杯内 platform/center 读路径（P1-3 有意未动）证实良性，本批不动。

## 4. 发版状态：待发版（用户批准后才执行）

- 本地 commit + tag v2.2.50 + 干净 zip（git archive 自 tag）已备；**push / GitHub Release / 夸克 / 平板推送未执行**（用户本次只说「动手」没说「发」）。
- 发版步骤（批准后）：git -c http.proxy=http://127.0.0.1:57890 push origin auto-hyperex v2.2.50 → gh release create v2.2.50 zip（token git credential fill + HTTPS_PROXY 57890，notes-v2.2.50.md）→ 夸克 upload「来自：Codex」fid ~1gOHOd8RH7eUH3bLHdZgsnt7QwJnjHMsjNwDL1clUPAh17wXDef6aYH_RARNLHebEAcUK2Vb_boDGZYRKt8-4Fo|wgooCuplegY → adb -s adb-haf6uwvcqcdujzin-trqoCZ._adb-tls-connect._tcp push zip /sdcard/Download/（不代装）。
- 装机首杯预期：manual 锚生效后用户手动 base 不再被覆盖；cutoff 背 stop 把峰压 ≤40%。建议装机仍可手动 S2 3.875（autoApply 可留 ON，manual 锚保住）。

## 5. 待拍板 / 后续

- 发版批准（统筹问用户）。
- backstop 0.85 / accel 历史 4 / predicted cap 1.6 为保守起步，真机验证后可调（另批）。
- 评估残留：legacy 成熟污染带在非 manual 杯仍可能经 pull 有界移动（P1-3 路由 + P2 吸收逐杯衰减），真机观察。

## 6. 别碰 / 红线自检

- 灌水量律 / §22.11 / LUT / 硬包线 / 单一写者 / full-off-hec 协议 / 两段收口不动。
- 别人未提交/未跟踪不碰（HEC .impeccable/mocks/hec-shot-summary/ 在途、HANDOFF_2026-10-31.md 等）；本批只 add plugin.js/manifest/README/tests/RESULTS/HANDOFF_v02250.md。
- 不操作真机/adb（设置代写由取证对话执行）；记忆数据不删。
- 分析脚本 HEC .tools/__flood-eval-*（不入库）；本 MD 随包入库。

## 7. 复跑索引

- node tests/verify_v02250.cjs（HX_LOOP_REPORT=1 打印闭环峰）。
- node D:/vscode/HyperExController/.tools/__flood-eval-cutoff-replay.cjs（杯 9/6 old vs new 触发）。
- node D:/vscode/HyperExController/.tools/__flood-eval-cup9.cjs（杯 5/6/9 峰/cutoff/κ 对比）。
- 代码锚点（2.2.50）：常量 ~184 / s2RefillFlowEstimate ~3200 / s2RefillReturnReason 背 stop ~3255 / manual 锚 + regimeChange 决策块 ~4360/4410 / 重复 push 修 ~8360。

