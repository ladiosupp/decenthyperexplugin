# HANDOFF v02259 — Vi 约束拟合（裁 b）＋Vi 杯间学习 B 键＋消费地板＋研磨建议 P0+R7（合并发版波）

> 三批合并发版（用户 11-21「等在途做完一起发」预授权；发版波三条件全达：地板 e4283df 统筹核过＋研磨 188daf0 统筹核过＋基线干净）。基线链：ef4f490（2.2.58 回执）→ a6ae73c（Vi 重拟合）→ 09f8b43（裁 b）→ 3adafd7（d Vi 学习）→ 9749813（d-B 键）→ e4283df（d-floor）→ 188daf0（研磨 P0+R7）。批次细节见本地交接 HANDOFF_2026-11-21-vi-refit.md／vi-learning-impl.md／vi-learning-B.md／vi-learning-floor.md／grind-advice-impl.md（untracked 本地参考，不在包内；本文自包含版本级摘要）。

## 1. 一句话

S2 补水 Vi 律换当前豆期约束拟合系数（A 34.057／B −32.251 固定，rmse 0.086s），其上新增 Vi 杯间学习（soakP2sRatio 3 带独立 viBuckets，七门＋非对称 EWMA＋完整指纹门）并按用户裁定的消费地板 vi_used=max(律,置信混合学习值) 消费（相对律只升不降，批1真值窗单调不劣＋修杯）；研磨建议细化 P0+R7（状态词表＋阈值冻结，加性字段，uneven 签名语义冻结，纯建议）。

## 2. 改了什么（三批）

### b Vi 约束拟合（09f8b43，取代 a6ae73c 无约束）
- VI_A 40.929→34.057、VI_B −32.251 固定（用户裁 b：跨豆期斜率保留，非拟合自由度）；fc=0、clamp[15,36] 固定，5 杯素材（杯21/22/23去尖峰/24/25）最小化 wetLat rmse 0.831→0.086s（用户门 ≤0.30 PASS；平均偏差 +0.802→+0.013s）。
- 支撑域 Vi 15–27.6ml；默认 holdMs4000 低 ratio 端预算驱动 flood 6.0–7.9375（跨度恢复）；当前 5 杯 ratio 0.54–0.72 全选 6.0。只改两系数常量，律结构/clamp/兜底/holdMs/FC0/决策时序全零改。

### d Vi 杯间学习 B 键＋消费地板（3adafd7→9749813→e4283df）
- gainMemory.viBuckets 独立于 r g 桶，键＝soakP2sRatio 3 带 [0.2,0.4)/[0.4,0.6)/[0.6,0.8]；决策点 stage2 入口按当杯 ratio 落带路由（无 lastBucket 滞后／无跨签名混桶；空带→律 b，Q10 首杯律先验）。A 键 g 桶 vi 行移除，r 机制零改。
- 杯末 Vi_obs＝stage2CupOnset wetLat×trace 实际 boost commandMlS；七质量门（含微簇 <60ms≤100 拒杯23 原始流）；非对称 EWMA（up 0.5/down 0.15，dev>15% 0.55/0.3，截尾/微噪减半）；完整指纹门（重标定回律＋reseed）；restore 扩 viBuckets 贡献者撤销；冷启动律 b/flood5 不动。
- **消费地板（用户裁 Q3 变体）**：HIGH 全量/MEDIUM 0.5 半混/LOW 律算 blended 后 vi_used=max(viLaw,blended) 再夹[15,40]（相对律只升不降，合不欠流＞不过冲；学习值带内仍 EWMA 下行只是消费地板挡律下）；floored 旗标＋viUsedSource -floored 后缀取证辨来源。

### 研磨建议 P0+R7（188daf0，用户裁 Q1–Q7 全按推荐）
- grindAdvisory 重写：R0 uneven&&high 置顶（coarse-uneven 并入 subtype，字符串退役）／R1 非完成杯 incomplete 门（aborted 保留）／R2 近带 8–12% 双侧微建议＋suggestedDirection（滞回不做）／R3 原因分诊注记（local dev≥15 base 归因／阶段归因 S3-only 研磨嫌疑低／regime stale·fallback·|rel|>50 警告／带内 uneven le<0.80 只注记不改 status／TDS 固定文案）／R4 证据驱动置信＋evidence 串（HIGH 需 R6 确认＋桶 HIGH n≥8，本期闲置）／R5 幅度带 12–20 半档 20–35 一档 >35 先核 regime（仅文案）／R6 两杯确认严格守卫（同桶＋两杯 8≤|rel|≤35＋非 stale/fallback＋上杯非 MISS/uneven/故障＋eligible，读历史不写记忆，confirmation 供 APK）／R7 coarse/fine 须 S2 尾参与（S3-only→flow-high/low）。
- 加性字段 evidence/subtype/suggestedDirection/confirmation；status 词表＋阈值冻结；纯建议（控制律/记忆/写入零消费）。

## 3. 没动什么（逐字）

flood 律结构／clamp[3.5,8]／holdMs[2000,7000]默认4000／FC_FACTOR=0／决策点 stage2 入口时序／soak 六拒收门／禁 S1 出流族／Va/Vb3/Vd15/O1／cutoff predicted 主判／backstop 0.85／两段收口 bleed→return／Q2 平滑链（coast/up-hold/治理链/死区/quanta/静默1200/ceiling）／硬包线 0.10–8.00 与 1/16／压力门／ACK／写入预算／单一写者／影子 sent 恒 false／LUT 不被学习改写／r 机制／gain memory 结构／manual 锚／归档 raw／uneven 签名合取式（s2Cv≥15 OR le<0.80）＋high。

## 4. 验证

- tests/verify_v02259.cjs **954/954**（927 b 基线＋11 vi-B 套件＋1 地板专用＋15 研磨 P0/R7；6 条老 grind 钉保绿；真杯交叉杯21/22/24/25 Vi_obs≈素材±0.05＋杯23 微簇在线拒＋研磨 8 杯 fullRecord 复算杯16/17/19/21/22/23/24/25，禁镜像）。tests/RESULTS_v02259.txt 实跑输出。
- sim/tests/sim-regression.cjs **5/5**；node --check plugin.js/verify 通过；manifest JSON 合法（version 2.2.59，description 397 字符 ≤400——用户 11-21 裁放宽长度口径「===275 没必要，≤400 都可以」，verify 断言同步改 typeof string＋>0＋≤400；新稿统筹核可，§1.15 短简介＋重大功能一句）。
- 25 杯三方决策级回放（b）：b1up 9/13、hotDown 4/4、零 infeasible/extrap/disabled、峰估 −3.15pp；5 杯全量写序列 b vs a6ae73c 逐字相同。
- 130 杯 B+地板回放（r+vi 同钩子，律复刻 47 杯零误差）：批1真值窗 b+d⊆b-only 双基准（历史 3⊂4／uniform 5⊂6，修 -4，零新增）；预测口径 11/11 零静默欠流；当前 4 干净杯 Vi 隔离写序列逐字；25 杯注入结构门全过；律门 0.086/成熟~0.21/过渡 0.264 均≤0.30；排除核 universe7/integrity/杯23 微簇全不学。
- 130 杯研磨回放（__ga-review-replay --r7）：可用杯状态零迁移（仅故障门杯84/98＋3 no-usable→incomplete）；uneven 集合 [83,105,121] 逐字不变；签名杯16/19/17 分类不变；R7 fine 4 杯→flow-low；置信 LOW42/MED12→MED31/LOW26；R6 0 有效触发（守卫拒 1，机制 inert）。

## 5. 用户裁定记录（11-21）

1. Vi 重拟合批批准（a6ae73c）→ **裁 b 约束拟合**（B=−32.251 固定只拟 A，09f8b43）。
2. d Vi 杯间学习 Q1–Q11 全裁＋Q11 触记忆授权（3adafd7）→ 门①批1真值未达如实呈报 → **裁①退 B 键重做**（9749813）→ 门①仍含学习消费窗 → **裁 Q3 消费地板变体**（vi_used=max(律,混合)，e4283df，新门①达）。
3. 研磨提案 **Q1–Q7 全按统筹推荐**（188daf0）；TDS 联合层落 APK（a27d2d6 已核）。
4. **「等在途做完一起发」**：插件 b+d(B+地板)+研磨合并 2.2.59 一次发版（本波），APK WS+TDS+UI12 合并 v0.37 另波。

## 6. APK 移植同步点（full→hec 里程碑）

VI_A/VI_B 新系数＋viBuckets ratio 带＋七门＋微簇＋非对称 EWMA＋完整指纹门＋restore 扩展＋地板消费 → shadow/arbiter 等价物（APK 无 soak 流则 Vi 学习 inert）；研磨新字段（evidence/subtype/suggestedDirection/confirmation）显示＋R6 confirmation 消费；与既有债（D1–D6/O1/Va/Vb3/Vd15/2.2.56 新律/scaleSampleGate）合并。TDS 联合层 APK 原生无插件对应物。

## 7. 下一步

- 用户 Decaid 自装；adaptive 挡第一杯即标定点（对比预测 boostToBleed 与实测，偏则调 VI_A/VI_B 须另批改码）；Vi 学习随缘攒杯（B 键带路由，跨豆期自动分带）。
- TDS 联合判定真验需用户 APK 侧录≥5 杯；R6 多杯确认需连续两杯同向近带（随缘攒不压杯数）；通道杯机遇验 A/B 分类不变。
- 二期候选：pq 趋势 EWMA（触记忆须另批）／grindInput 漂移（APK 本地）／异常重跑杯 S1 识别。

## 8. 发版回执（2026-11-21，用户预授权「等在途做完一起发」发版波）

- **基线**：三改码批 09f8b43（b 约束拟合）／9749813＋e4283df（d-B 键＋消费地板）／188daf0（研磨 P0+R7）＋小改码批 **443ffaf**（description 长度口径放宽 ≤400＋落统筹核可新稿 397，用户 11-21 裁「===275 没必要，≤400 都可以」；verify 断言改 typeof string＋>0＋≤400）＋发版批 **1345ce8**（notes＋本交接，代码零改）。tag **v2.2.59**=1345ce871c73e54157c097e8810cd953b0c3b6f3（lightweight）。
- **push**：origin auto-hyperex **ef4f490..1345ce8**（8 commit：a6ae73c/09f8b43/3adafd7/9749813/e4283df/188daf0/443ffaf/1345ce8）＋new tag v2.2.59（VPN 57890）；ls-remote 核分支/tag 均=1345ce8。
- **包**：release/HyperExPulseFilter_v2.2.59.zip **590993 字节**，SHA256 **1BB417B2371872D0BDE5403164A4C320E18A9433B5A5A75876457848E8B9B5FE**（git archive v2.2.59，9 条目同 v2258 布局，release/__build_v2259.ps1）。**包内复跑 954/954**＋node --check＋manifest version=2.2.59 descLen=397（≤400）核过。发版前复跑 954/954＋sim 5/5＋node --check 全过。
- **GitHub Release**：**453412518**（tag v2.2.59，make_latest=true，draft=false），asset HyperExPulseFilter_v2.2.59.zip（590993 字节，state=**uploaded**，asset id **774287859**／node_id RA_kwDOVO5zXc4uJrHz）。REST POST releases＋uploads 直传（curl -H Expect: --data-binary 耐慢传），token git credential fill 不回显＋代理 57890；Release body=release/notes-v2.2.59.md（本波随发版 commit 入库）。
- **夸克**：「夸克网盘/来自：Codex」fileId **c57dfd40673e4e3a831ad2097dfd48dc**（590993 字节，非秒传；官方 quarkclouddrive CLI 1.0.25，install success/updated=false，result 无 notice；session-input「等在途做完一起发」）。
- **平板**：adb mDNS（adb-haf6uwvcqcdujzin-trqoCZ；旧 IP:port transport 失效，以 mDNS 服务名直推）/sdcard/Download/HyperExPulseFilter_v2.2.59.zip，ls 核 **590993** 字节（2026-11-21 11:28）；**不代装，用户 Decaid 自装**。
- **红线遵守**：发版批代码零改（小改码批 443ffaf 用户授权单独 commit）；只 add 本批（发版 commit=notes＋本交接；回执仅本交接 §8）；别人 WIP HANDOFF_2026-10-31.md M 不碰不提交；批交接 MD（vi-refit/vi-learning-B/floor/grind-review/grind-impl）保持 untracked 不代提交；gh/夸克/adb/push 均提权；真实仓写不做。技能 decentplugin 无 275 硬钉（仅 runId 时间戳含子串）无需改；旧交接 275 提及保留为历史口径记录；HEC AGENTS §1.15 统筹已更 ≤400。
- **发版后**：用户 Decaid 自装；adaptive 挡第一杯即标定点（偏则调 VI_A/VI_B 须另批）；Vi 学习随缘攒杯；TDS 联合判定真验需 APK 侧≥5 杯；R6 多杯确认随缘攒。APK 同步债见 §6。


