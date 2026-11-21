# d 消费地板变体交接（2026-11-21，2.2.59 候选，用户裁 Q3 地板变体，改码不发版）

> 派单：统筹 01a1f8e8-499f-7513-a9cd-84b3af28bb14（relay-8）11-21。用户裁地板变体（Q3 消费策略变体）：vi_used＝max(lawVi, 置信混合学习值)。改码本批授权（沿 d 触记忆授权）；**发版待合并发版波**（条件＝本批统筹核过＋研磨 P0 核过＋基线干净）。基线 **9749813**（B 键，本地未推）；新 commit 叠上，版本仍 2.2.59 候选。git 四件事已做；别人 WIP HANDOFF_2026-10-31.md（M）不碰。
>
> 一句话现状：**消费点地板小改落地（vi_used=max(律,blended)，只升不降），其余全零改**。verify_v02259 **939/939**＋sim **5/5**；130 杯 B+地板回放（律复刻 47 杯零误差）：**新门①达——批1真值窗 b+d ⊆ b-only（单调不劣）＋修杯**，历史 3⊂4／uniform 5⊂6，与统筹预估逐杯吻合；预测口径双基准 11/11 零静默欠流；当前 4 干净杯写序列逐字不变；25 杯注入全结构门过；律门 0.086／成熟~0.21／过渡 0.264 均≤0.30；排除核全不学。**地板消除了 B 键的学习回归（329036-2 不再回归、558035-4 修复），残余窗均 b 律固有或 Q10 首杯律先验**。

## 1. 地板机制（plugin.js，外科手术只消费点）

refillAdaptiveFloodDecision 消费点：HIGH 全量／MEDIUM 0.5 半混／LOW 律算出 blended 后 **vi_used=Math.max(viLaw,blended)**，再夹[15,40]（地板≥律≥15 下限自动满足，上界 40 不变）；blended<viLaw 时 viLearning.floored=true、viUsedSource 加 -floored 后缀（learned-high-floored／learned-medium-blend-floored，供取证辨消费来源）；viLearning.blend 字段保留（HIGH 1／MEDIUM 0.5／LOW 0）。LOW（n=1）blended=viLaw→vi_used=律、source law 不变（有桶行时 viLearning blend:0 对象，无桶/域外 viLearning null）。

**其余全零改**：B 路由 viBuckets／七门＋微簇／非对称 EWMA／dev 门／置信分层／完整指纹 reseed／restore／持久化／冷启动／律结构／clamp[15,36]／holdMs／FC0／决策时序／r 机制／归档 raw。manifest 零改（2.2.59/descLen275）。

**取舍注记（用户裁定）**：地板相对律只升不降，牺牲下行校正（era 切回快润湿时学习值低于律→消费仍按律，偏保守几杯、峰略高），合「不欠流＞不过冲」优先；学习值带内仍 EWMA 下行（α_down 0.15/dev 0.3），只是消费地板挡律下——记忆跟踪真实残余，消费不冒欠流险。

## 2. 验证回执

- **verify_v02259 939/939**（RESULTS_v02259.txt）：938 既有套件（消费断言按地板重编码：viMl=max(律,混合)、source 带 -floored 后缀、floored 旗标）＋1 地板专用测试（learned<律→vi_used=律＋learned-high-floored＋floored true／learned>律→vi_used=learned＋learned-high＋floored false／MEDIUM blend 0.5 保留＋max(律,blend)／LOW n=1 律不变 blend:0／clamp[15,40] 交互）。真杯交叉杯21/22/24/25 Vi_obs≈素材±0.05＋杯23 微簇在线拒／律源码钉 34.057/−32.251/15/36/FC0／素材门 rmse 0.086 保持。
- **sim-regression 5/5**；node --check plugin.js/verify 通过；manifest 2.2.59 descLen 275 不变。

## 3. 新门① 批1真值不欠流双基准 subset（达）

true b2b=(ViObs+4.59)/flood−0.274；合格 11 杯（stress 排除 2，ViObs 无效 1 不计真值）。**预测口径 11/11 全过（历史＋uniform，零静默欠流）**。真值口径 **b+d 窗 ⊆ b-only 窗（单调不劣）＋成熟学习修杯**：

| 基准 | b-only 窗 | b+d 窗 | subset | 修杯 | 新增窗 |
|---|---|---|---|---|---|
| 历史 holdCfg | 4（1794311272562-5、1794393997909-9、1794437908164-11、1794617558035-4） | 3（1794311272562-5、1794393997909-9、1794437908164-11） | ✓ | 1794617558035-4 | 无 |
| uniform 4000 | 6（1794311272562-5、1794349686272-6、1794350648377-7、1794351268936-8、1794437908164-11、1794617558035-4） | 5（1794311272562-5、1794349686272-6、1794350648377-7、1794351268936-8、1794437908164-11） | ✓ | 1794617558035-4 | 无 |

**与统筹预估逐杯吻合**：历史 3⊂4（-5+0.19/-9+0.48/-11+0.24，修 -4）；uniform 5⊂6（-5+0.19/-6+0.38/-7+0.34/-8+0.27/-11+0.24，修 -4）。残余窗均 b 律固有窗（律本身欠预测该杯，地板保持 vi=律→与 b-only 同）或 Q10 首杯律先验（2562-5/686272-6 src law）；**地板消除了 B 键的学习回归**（329036-2 从 B 的 learned-high 回归回到 b-only PASS；558035-4 修复）。禁镜像，真实回放核。

**逐杯双基准表**：

| runId | ViObs | b-only 历史 真值/hold | b+d 历史 flood/hold/真值 | b-only uniform | b+d uniform flood/hold/真值 | 消费来源 |
|---|---|---|---|---|---|---|
| 1794311272562-5 | 22.22 | 3.185/3000 FAIL | 7.75/3000/3.185 FAIL | 4.194/4000 FAIL | 6/4000/4.194 FAIL | law |
| 1794349686272-6 | 26.56 | 3.62/3900 PASS | 8/3900/3.62 PASS | 4.384/4000 FAIL | 6.6875/4000/4.384 FAIL | law |
| 1794350648377-7 | 28.29 | 3.836/4000 PASS | 8/4000/3.836 PASS | 4.341/4000 FAIL | 7.125/4000/4.341 FAIL | learned-medium-blend-floored |
| 1794351268936-8 | 26.64 | 3.63/3900 PASS | 8/3900/3.63 PASS | 4.269/4000 FAIL | 6.875/4000/4.269 FAIL | learned-medium-blend-floored |
| 1794393997909-9 | 18.42 | 3.483/3000 FAIL | 6.125/3000/3.483 FAIL | 3.561/3700 PASS | 6/3700/3.561 PASS | learned-medium-blend-floored |
| 1794395116314-10 | 1.01 | 0.426/4300 PASS | 8/4300/0.426 PASS | 0.454/4000 PASS | 7.6875/4000/0.454 PASS | learned-medium-blend-floored |
| 1794437908164-11 | 25.03 | 4.24/4000 FAIL | 6.5625/4000/4.24 FAIL | 4.24/4000 FAIL | 6.5625/4000/4.24 FAIL | learned-medium-blend-floored |
| 1794525779756-1 | 23.17 | 3.622/4000 PASS | 7.125/4000/3.622 PASS | 3.622/4000 PASS | 7.125/4000/3.622 PASS | learned-medium-blend-floored |
| 1794526329036-2 | 25.4 | 3.692/4000 PASS | 7.5625/4000/3.692 PASS | 3.692/4000 PASS | 7.5625/4000/3.692 PASS | learned-high-floored |
| 1794617112489-3 | 19.35 | 3.716/4000 PASS | 6/4000/3.716 PASS | 3.716/4000 PASS | 6/4000/3.716 PASS | learned-medium-blend-floored |
| 1794617558035-4 | 23.53 | 4.181/4000 FAIL | 6.875/4000/3.816 PASS | 4.181/4000 FAIL | 6.875/4000/3.816 PASS | learned-high |

## 4. 门②③④⑤⑥⑦（全过）

- **门② 当前 4 干净杯写序列**（Vi 隔离成对）：21/22/24/25 非 boost 笔**逐字不变**＋boost 逐字＋oq/observedR 不变＋全 complete ✓（地板微调 holdMs 但写笔仍逐字；当前 era learned>律→learned-high 全量消费非地板）。杯23（噪点杯非验收 4 杯）收口时序移动命令不变。

| 杯 | boost | 非 boost 笔 | oq/observedR | holdMs 基线→学习 | nW | status |
|---|---|---|---|---|---|---|
| 21 | 逐字 | **逐字** | 不变 | 3900→4000 | 6/6 | complete |
| 22 | 逐字 | **逐字** | 不变 | 3700→4000 | 6/6 | complete |
| 23 | 逐字 | 时序差 | 不变 | 3600→3800 | 3/3 | complete |
| 24 | 逐字 | **逐字** | 不变 | 3600→3800 | 8/8 | complete |
| 25 | 逐字 | **逐字** | 不变 | 3600→3700 | 7/7 | complete |

- **门③ 25 杯注入**：rise 地板／flood[3.5,8]／hold[2000,7000]／predicted≤hold 全过／零 infeasible／零 extrap ✓。
- **门④ rmse**：律素材门 0.086 保持✓／成熟学习~0.21≤0.30✓／era 过渡 0.264≤0.30✓。
- **门⑤ 峰≤40%**：verify 闭环全过✓（真值须真机陪杯）。
- **门⑥ 排除/指纹/restore/冷启动/截尾/固定挡**：939 全绿✓；universe7（6 在线＋1 离线）/integrity/杯23 微簇在线拒✓。
- **门⑦ 预测口径双基准 11/11 零静默欠流**✓。

## 5. 坑

1. **LOW viLearning**：有桶行时 viLearning 是 blend:0 对象（非 null）；null 仅无桶/域外。地板测试 LOW 断言 blend:0/confidence LOW。
2. **夹具 ratio 漂移**：soakSignature 名义 0.55 实测~0.57，律值~15.7；learned≈律时地板边界敏感→消费断言用 max(律,混合)＋startsWith source。
3. **地板 source 后缀**：learned-high-floored／learned-medium-blend-floored；既有断言改 startsWith 兼容地板/非地板。
4. **b-only uniform 基准**：true b2b 须用 uniform flood（前批已修）；subset 核从 decisions 逐杯 bTrueOkU/dTrueOkU 算。

## 6. 待办／发版条件／复跑

- **发版待合并发版波**：条件＝本批统筹核过＋研磨 P0 核过＋基线干净；统筹派 relay-2 执行 b/d(B+地板) 合并 2.2.59 发版一次（用户预授权）。本批不发版不 push 不 tag 不装机。
- 技能 §22.19/§22.3 d 补注消费子句已按地板更新＋用户 11-21 裁定引用＋取舍注记（只改 d 补注其余逐字，待统筹审）。
- fc 批依赖（Vi 标定 b＋学习 d）已落，触记忆仍须另批；FC>0 Vi_obs 预留已埋。APK 同步债 viBuckets ratio 带＋地板消费→shadow/arbiter full→hec。
- 真机陪杯（发版装机后）：Vi_obs trace vs 预测／≥3 杯 era 吸收／零 holdMs 超时／峰≤40%／rise≤0.9s／whole 不劣化／固定挡收录／restore 撤销／地板消费来源旗标取证。
- 复跑：cd decenthyperexplugin.reaplugin && node tests/verify_v02259.cjs（939）；cd .. && node sim/tests/sim-regression.cjs（5）；node D:/vscode/.tools/__d20-vi-learn-replay-b.cjs（B+地板 130 杯回放，写 __d20-vi-learn-replay-b.json）。
- 本批 commit 仅 plugin.js/tests/verify_v02259.cjs/tests/RESULTS_v02259.txt/README.md/本交接（manifest 零改）；探针 .tools/__d20-* untracked 不入库；别人 WIP 不碰不提交不回滚；记忆不删改（restore 除外）；归档 raw 不改；律结构/r 机制零改。