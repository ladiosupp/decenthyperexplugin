# HANDOFF v02255 — Va+Vb3 补水估计稳健性加固（2.2.55 候选，改码完成待发版批）

> 2026-11-19 插件对话（接杯 16 d 路径评估 HANDOFF_2026-11-19-cup16-dpath-eval.md）。用户批「1、批 Va+Vb3 改码批；2、40% 绊线区分正常/通道事件；3、衰减期安全例外派只读评估批，平滑优先不变的前提下提高反应敏感度；全部做完我再取验冷启动了」。本批＝批 1（Va+Vb3 改码，2.2.55 候选）；**改码本批授权，发版/push/tag 另问**。批 2（衰减例外只读评估＋通道接受准则提案）顺序续做。统筹 01a1f379-3282-7681-8ec5-86443b43708b（relay-4）。
> 一句话现状：**Va+Vb3+Vd15 落地**（用户批 Vd15 并入），verify_v02255 **892/892** 全绿（含杯 16 真机 JSON 交叉），sim-regression 5/5，×1.1 回放通道峰 109.4→102.6／正常零误触，Vd15 通道首笔下调早 500ms／滞回退出／冷尾有界；**2.2.55 已发版**（用户批「并入本次发版」，统筹复核全过另派全 SOP）。代码 aca12a0＋本回执；tag v2.2.55=aca12a0；Release 451325193／asset RA_kwDOVO5zXc4twUF0（uploaded）；夸克 fd2c59ae37524fb7a4b6e18ac18e1941；平板 Download/ 已推核（用户 Decaid 自装一次验 O1+Va/Vb3+Vd15）。详见 §9。

## 1. 本轮改动（plugin.js 2.2.54→2.2.55，估计/触发路径，控制律主体零改）

- **Va 退化零斜率拒收**（s2RefillFlowEstimate，slope<0 门后）：fit.slope<=1e-6 → gate("slope-zero",{slope})，return null，不更新 lastEstimate/estHistory（保持最后有效值或 null，安全路径）。修 D5 门缺口：slope 0 r2=1 完全平重退化拟合此前漏网（只拒负斜率），污染 estHistory／accel 中位。
- **Vb3 瞬时 dw/dt 交叉核**（s2RefillReturnReason，blindFlood 块后、observed/predicted 前）：p.status==="boosting" 时，取 stage2/profileFrame1 原始样本最后 SAMPLES+1 个，连续 SAMPLES 个短窗瞬时斜率（dw/dt，dt>0.02 guard）≥ target×FACTOR → 早 cutoff，与 predicted 主判取先。cutoff 记录 basis="instantaneous-cross"＋instantCrossGS/instantCrossFactor（D5 同款诊断）＋既有 rawGS/predictedGS/decisionGS/thresholdGS/backstopGS/estHistory/margin/firingTickMs/firingObservedGS/atMs。
- **常量**：S2_REFILL_INSTANT_CROSS_FACTOR=1.1（用户批 Q4 保守余量）／S2_REFILL_INSTANT_CROSS_SAMPLES=2（噪声 guard：单尖峰不触发）。
- **边界（Q2 维持）**：只 Va 门＋Vb3 交叉核；coast 8%／up-hold／治理链（settle/ramp/handover falling）／死区／quanta／静默／ceiling／LUT／manual 锚／硬包线 8／§22.11 灌水矢量律／backstop 值 0.85／两段收口全不动。
- 版本：PLUGIN_VERSION/manifest 2.2.55；**description 保持 275 短简介**（§1.15 稳健性加固非重大功能更新，版本细节归 notes/Release body）；README 2.2.55 置顶。

## 2. 验证回执（全绿）

- node --check ✓；manifest JSON ✓（version 2.2.55，description 275）。
- **tests/verify_v02255.cjs 887/887**（880 基线＋7 新增，禁镜像）：Va 零斜率拒收双向（slope-zero/slope/升窗清除）／Va 杯 16 平重真机 JSON 交叉（history-11，tMs 19000-20600 平重 1.5s→slope-zero）／Vb3 触发＋噪声 guard（2 连续≥×1.1 触发／单尖峰不触发／×1.05 不触发）／Vb3 杯 16 突破真机交叉（tMs 20700-22100 dw 0.6→1.0→instantaneous-cross）／Vb3 正常亚阈升不触发／通道＋正常闭环（正常峰≤40 rise≤1.5 maxCmd≥7）／常量 1.1/2。
- **sim/tests/sim-regression.cjs 5/5**。
- **×1.1 生产码回放**（探针 D:/vscode/.tools/__d16-b1-replay.cjs，结果 __d16-b1-replay.json）：
  - 通道植物（校准 V0≈109.4%≈杯 16 量级）：峰 **102.6%**（j0/j1.2，−6.8pp），bleed@2250（早 500ms），basis instantaneous-cross，instCrossGS 7.951，Va 零估计清除（zeros=0）。
  - 正常闭环 r1.29/2.0×抖动 0/0.6/1.2：**逐字不变**（15.4%/3.9%，rise 0.6，maxCmd 7，complete，return=platform，bleed）。
  - 真机决策级（harness，杯 12/15/16）：杯 12 bleed 21.27→21.02（早 0.25s 良性，nW 9→8）／杯 15 21.74 不变／杯 16 21.42 不变（开环回放用录制流量）。
- 红线复核：控制律主体/灌水律/两段收口/硬包线/单一写者/影子 sent/LUT/记忆/manual 锚零改。

## 3. 技能补注（只加不改，统筹审）

SKILL.md **§22.18 末**「2026-11-19 杯 16 d 路径补注（2.2.55 Va/Vb3）」——Va/Vb3 机制＋用户「40% 绊线区分正常/通道事件」裁定＋Q2 平滑度维持＋已否方案（backstop 0.80/密检零效、平重限时族误触）。

## 4. 待办（每步先问）

- **发版批（用户经统筹另批）**：tag v2.2.55→push（VPN 57890）→git archive zip（release/__build_v2255.ps1 同 v2254 口径）→GitHub Release（notes-v2.2.55.md）→夸克→推平板（ls 核字节，不代装）→回执 commit＋push→回叫统筹。
- **批 2（本对话续做）**：衰减期安全例外只读评估＋通道事件接受准则提案（不改码；平滑优先前提下提高敏感度；回放基线用本批新码）。
- **冷启动验证**：用户点名「全部做完我再取验冷启动了」——O1 测杯待两批做完，不催装机。

## 5. APK 移植同步点（full→hec 里程碑）

- **Va slope-zero 门＋Vb3 瞬时交叉核＋Vd15 衰减例外**（常量 1.5/3/1.2/4＋双退出＋trigger/write/exit 诊断）→ shadow/arbiter 的 refill 估计/收口/衰减等价物；与 D1–D4（HANDOFF_v02253 §6）＋O1（HANDOFF_v02254 §5）债合并到 hec 切换批一次移植。
- 本批无 APK 改动（插件估计/触发路径）。

## 6. 别碰

别人未提交/未跟踪（HANDOFF_2026-10-31.md 改动等）；记忆数据；控制律主体/灌水律/两段收口/LUT/硬包线/单一写者/影子 sent；coast/up-hold/治理链/死区（Q2）；APK 仓；UI 批；技能 §22 现有文本。

## 7. 复跑索引

- 回归：node decenthyperexplugin.reaplugin/tests/verify_v02255.cjs（887）；node sim/tests/sim-regression.cjs（5）。
- 回放：node D:/vscode/.tools/__d16-b1-replay.cjs（通道＋正常＋真机杯）；变体矩阵 __d16-c16-variants.cjs／真机 __d16-c16-harness.cjs（评估批）。
- 数据：history-11（杯 16）／history-9/10（杯 12/15）。
- 评估来源：HANDOFF_2026-11-19-cup16-dpath-eval.md。



## 8. Vd15 并入批（2026-11-19，用户批「Vd15 衰减例外并入本次发版」＋「通道事件接受准则我批准」）

- **实现**（liveTrimTick，常量 S2_DECAY_EXCEPTION_FACTOR=1.5／SAMPLES=3／EXIT_FACTOR=1.2／MAX_WRITES=4）：stage2 && startup complete && reg.slope>target×1.5 连续 3 fresh check → decayException=true（记 decay-exception-trigger：rawGS/thresholdGS/streak）；旁路 handover-falling guard（!decayException）＋governor（(rescueActive||decayException)?null）；normalMax=min(正常,2)（小步≤2 quanta，§22.13）；**静默 1200 保留**。**双退出**：滞回 raw<target×1.2（记 exit reason=hysteresis）OR 例外写笔数≥4（记 exit reason=max-writes）；每笔例外下调记 decay-exception-write（commandMlS/previousMlS/quanta/count/rawGS）。
- **MAX_WRITES=4 默认理由（统筹审，真机标定）**：4 笔×≤2 quanta=≤8 quanta=0.5 ml/s 上限命令降幅——足够缩短热平台又防过调成欠流；杯 16 热窗 ~0.8s（静默 1200 下约 1 笔）cap 罕达，但约束更长热平台；滞回退出（raw<1.2×target）是主退出，cap 是 backstop。合成冷尾示过调风险（minPost −9.2→−9.7，0.5pp），滞回＋小步限幅；真机须标定退出阈值与 cap。
- **边界（Q2 维持）**：常态 coast/up-hold/governor/死区/quanta/静默/ceiling/LUT/manual 锚/硬包线 8/灌水矢量律/Va+Vb3 全不动；例外仅严重过冲安全路径。
- **验证**：verify_v02255 **892/892**（887＋5 Vd15：常量 1.5/3/1.2/4／正常闭环 r1.29/2.0×抖动 0/0.6/1.2 零触发／通道触发＋小步≤2＋双退出＋笔数≤cap／通道首笔下调≤6500（基线 6750）／杯 16 真机后向窗交叉：热 check 22872 slope 8.65>7.5、23146 slope 7.62>7.5、23963 slope 5.91<6.0 退出）；sim-regression 5/5。
- **Vd15 回放**（探针 __d16-vd-replay.cjs，基线=批 1 7751806 无 Vd15 vs 当前）：通道首笔下调 6750→6250（早 500ms），trig 1/write 1/exit hysteresis；正常闭环峰逐字相同（15.4/3.9）；冷尾 minPost −9.2→−9.7（过调有界，滞回限幅）；峰 161.3 不变（pre-complete，例外不影响峰）。
- **通道事件接受准则（用户已批，取证即日生效，插件侧无动作）**：识别签名合取（grindAdvice uneven＋突破前平重≥1s＋dw 尖峰≥target×1.1＋存水≥~8ml）＋物理上限法（峰上限≈泵最大+留存水释放率×安全系数 1.1）＋tail 收敛带内＋计数反馈布粉改善；正常杯 40% 不变；阈值暂定待真机多杯标定。详见 HANDOFF_2026-11-19-decay-exception-eval.md §5。
- **技能补注**：§22.18 末「2026-11-19 Vd15 衰减例外并入」（机制＋用户并入批准＋通道准则批准引用，只加不改统筹审）。
- **冷启动验证**：发版后用户装机一次验 O1+Va/Vb3+Vd15，取证陪杯录 decayException 诊断供标定（用户点名两批做完再取验）。
- **复跑**：node __d16-vd-replay.cjs（Vd15 含退出 vs 基线）；verify_v02255（892）。


## 9. 发版回执（2026-11-19，用户批「并入本次发版」，统筹复核全过派全 SOP）

- **基线**：aca12a0（发版批不改码；统筹独立复跑 verify_v02255 892/892＋sim 5/5＋__d16-vd-replay/__d16-b1-replay＋diff 审 43 行仅 Vd15＋MAX_WRITES=4 审过＋技能补注审过＋manifest descLen 275）。tag **v2.2.55**=aca12a00fdb99138fa6e343d12a5b22d7d66e860（lightweight）。
- **push**：origin auto-hyperex 812b6bb..aca12a0＋new tag v2.2.55（VPN 代理 127.0.0.1:57890）。
- **包**：release/HyperExPulseFilter_v2.2.55.zip **542182 字节**，SHA256 **77653A2C87FEAA9B92F18AEEE000B786B418FE89A553635EDF5008AD502EB975**（git archive v2.2.55，9 条目同 v2254 布局）。**包内复跑 892/892**＋node --check＋manifest version=2.2.55 descLen=275 核过。
- **GitHub Release**：**451325193**（tag v2.2.55，--latest），asset **RA_kwDOVO5zXc4twUF0**（HyperExPulseFilter_v2.2.55.zip，542182 字节，state=**uploaded**）。gh token git credential fill 不回显＋HTTPS_PROXY=57890；notes-v2.2.55.md（版本细节归 notes/Release body，§1.15 短简介不动）。
- **夸克**：「夸克网盘/来自：Codex」fileId **fd2c59ae37524fb7a4b6e18ac18e1941**（542182 字节，非秒传；result 无 notice.text）。
- **平板**：adb mDNS push /sdcard/Download/HyperExPulseFilter_v2.2.55.zip，ls 核 **542182** 字节（2026-11-19 20:36）；**不代装，用户 Decaid 自装**一次验 O1+Va/Vb3+Vd15。
- **发版后**：统筹独立远端核（ls-remote/Release API/zip SHA256 复算/平板 ls）→基线推 2.2.55→通知取证装机陪杯，录 decayException 诊断供标定（MAX_WRITES/退出阈值真机标定）。
- 红线遵守：只 add 本批（回执仅 HANDOFF_v02255.md）；gh/夸克/adb/push 均提权；装机不代做；别人 WIP（HANDOFF_2026-10-31.md）不碰。
