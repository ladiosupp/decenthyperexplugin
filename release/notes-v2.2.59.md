v2.2.59：Vi 约束拟合（裁 b）＋Vi 杯间学习 B 键＋消费地板＋研磨建议 P0+R7 细化

本版为三批合并发版波（用户 11-21「等在途做完一起发」预授权）：b 约束拟合 09f8b43＋d Vi 杯间学习（B 键 9749813＋消费地板 e4283df）＋研磨建议 P0+R7 188daf0。基线链 ef4f490（2.2.58）→ a6ae73c → 09f8b43 → 3adafd7 → 9749813 → e4283df → 188daf0。

## b：Vi 约束拟合（用户裁 b）

VI_A 40.929→34.057、VI_B −32.251 固定（用户裁定：跨豆期斜率保留，非拟合自由度）；fc=0、clamp[15,36] 固定，5 杯当前豆期素材（杯21/22/23去尖峰/24/25）最小化 wetLat rmse **0.831→0.086s**（用户验收门 ≤0.30 PASS；平均偏差 +0.802→+0.013s）。首轮无约束重拟合（a6ae73c，rmse 0.077）被裁 b 取代：+0.009s rmse 换回低 ratio 端 Vi 表征与默认挡 flood 跨度。支撑域 Vi 15–27.6ml；默认 holdMs4000 低 ratio 端预算驱动 flood 6.0–7.9375；当前 5 杯 ratio 0.54–0.72 全选 6.0。只改两系数常量，律结构/clamp/兜底/holdMs/FC0/决策时序零改。

## d：Vi 杯间学习 B 键＋消费地板（用户 Q1–Q11 全裁＋触记忆授权＋裁①退 B＋裁 Q3 地板）

- gainMemory.viBuckets 独立于 r g 桶，键＝soakP2sRatio 3 带 [0.2,0.4)/[0.4,0.6)/[0.6,0.8]；决策点 stage2 入口按当杯 ratio 落带路由（无 lastBucket 滞后／无跨签名混桶；空带→律 b，首杯律先验）。r 机制零改（A 键 g 桶 vi 行移除）。
- 杯末 Vi_obs＝stage2CupOnset wetLat×实际 boost commandMlS；七质量门（含微簇 <60ms≤100 拒杯23 原始流）；非对称 EWMA（up 0.5/down 0.15，dev>15% 0.55/0.3，截尾/微噪减半）；完整指纹门（重标定回律＋reseed）；restore 扩 viBuckets 贡献者撤销；冷启动律 b/flood5 不动。
- **消费地板（用户裁 Q3 变体）**：HIGH 全量/MEDIUM 半混/LOW 律算 blended 后 **vi_used=max(律,blended)** 再夹[15,40]——相对律只升不降，合「不欠流＞不过冲」优先；学习值带内仍 EWMA 下行，只是消费地板挡律下；floored 旗标＋来源后缀取证可辨。
- 验收（130 杯 B+地板回放，律复刻 47 杯零误差）：**批1真值窗 b+d⊆b-only 双基准单调不劣＋修杯**（历史 3⊂4／uniform 5⊂6，残余均 b 律固有窗或首杯律先验）；预测口径 11/11 零静默欠流；当前 4 干净杯 Vi 隔离写序列逐字不变；25 杯注入结构门全过零 infeasible/extrap；律门 rmse 0.086/成熟~0.21/过渡 0.264 均≤0.30；排除核 universe7/integrity/杯23 微簇全不学。

## 研磨建议 P0+R7（用户裁 Q1–Q7 全按推荐）

status 词表＋阈值冻结，加性字段 evidence/subtype/suggestedDirection/confirmation：R0 uneven&&high 置顶（coarse-uneven 并入子型，字符串退役）／R1 非完成杯 incomplete 门（aborted 保留）／R2 近带 8–12% 双侧微建议（滞回不做）／R3 原因分诊（base 偏离／阶段归因／regime 警告／带内 uneven 注记／TDS 文案）／R4 证据驱动置信（HIGH 本期闲置）／R5 幅度带（半档／一档／>35% 先核 regime，仅文案无研磨真值）／R6 两杯确认严格守卫（读历史不写记忆，归档 0 触发机制 inert）／R7 coarse/fine 须 S2 尾参与（S3-only→flow-high/low）。**uneven 签名语义冻结**（A/B 子形分类不变）；纯建议，控制律/记忆/写入零消费。

验收（130 杯回放）：可用杯状态零迁移（仅故障门杯84/98＋3 no-usable→incomplete）；uneven 集合 [83,105,121] 逐字不变；签名杯16/19/17 分类不变；R7 fine 4 杯→flow-low；置信 LOW42/MED12→MED31/LOW26；R6 0 有效触发（守卫拦假确认）。

## 边界（三批合计，逐字不动）

flood 律结构／clamp[3.5,8]／holdMs[2000,7000]默认4000／FC_FACTOR=0／决策点 stage2 入口时序／soak 六拒收门／禁 S1 出流族／Va/Vb3/Vd15/O1／cutoff predicted 主判／backstop 0.85／两段收口／Q2 平滑链／硬包线 0.10–8.00 与 1/16／压力门／ACK／写入预算／单一写者／影子 sent 恒 false／LUT 不被学习改写／r 机制／gain memory 结构／manual 锚／归档 raw／uneven 签名合取式。manifest description 按 §1.15 更新为 397 字符短简介（≤400，用户 11-21 裁放宽长度口径；加 Vi 杯间学习＋研磨细化一句，统筹核可；版本细节归本 notes/Release body）。

## 验证

tests/verify_v02259.cjs **954/954**（927 b＋11 vi-B＋1 地板＋15 研磨；6 条老 grind 钉保绿；description 断言按用户裁定放宽 typeof string＋>0＋≤400；真杯交叉杯21/22/24/25 Vi_obs±0.05＋杯23 微簇在线拒＋研磨 8 杯 fullRecord 复算，禁镜像）；sim-regression **5/5**；node --check 通过；manifest JSON 合法（2.2.59/descLen397）。25 杯三方决策级回放＋5 杯全量写序列（b vs a6ae73c 逐字相同）；130 杯 B+地板回放＋130 杯研磨回放见上。

## 装机与后续

装机由用户在 Decaid 里自做（包只推平板 Download/，不代装）。adaptive 挡第一杯即标定点（对比预测 boostToBleed 与实测，偏则调 VI_A/VI_B 须另批改码）；Vi 学习随缘攒杯（B 键带路由跨豆期自动分带）；TDS 联合判定真验需 APK 侧录≥5 杯；R6 多杯确认随缘攒。APK 移植同步债：VI_A/VI_B＋viBuckets＋七门＋EWMA＋指纹门＋restore＋地板消费＋研磨新字段/R6 消费→shadow/arbiter full→hec 里程碑。

详见包内 HANDOFF_v02259.md／README.md；批次细节见本地 HANDOFF_2026-11-21-vi-refit.md／vi-learning-impl.md／vi-learning-B.md／vi-learning-floor.md／grind-advice-impl.md（不在包内）。

