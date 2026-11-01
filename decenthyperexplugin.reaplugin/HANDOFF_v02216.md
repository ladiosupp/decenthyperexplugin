# v2.2.16 交接 — cut 9 补水收尾（2026-11-01）

完整验收见仓库根目录 ACCEPT_2026-11-01-cut9-refill-closeout.md（结论 / 范围 / 口径 / 改动逐条 / 真机交叉验证 / 测试 / 复现 / 清单 / 限制）。这里只记接手要知道的。

## 一句话

补水段的收尾清理：学习沉降窗按消费方拆成 800 ms（测量）与 1500 ms（链路）；收回未确认时三处测量消费方一律拒绝而不是退回无窗口；handover 的三处死参数清掉；补水侧两处私有纹波门对齐 2.2.11 的统一策略。灌水与收口控制律本身一行没动（灌水量仍是安全包线 8.00，两段收口仍是 bleed 到平台 target/r）。

## 版本与测试

- plugin.js 与 manifest.json = 2.2.16；tests/verify_v02216.cjs = 679/679；RESULTS_v02216.txt 已出。v02215 及更早测试与 RESULTS 原样保留。
- 未 commit、未 tag、未推送、未发版。基线 HEAD = 63fc42c，分支 v1.79ds。

## 接手要注意

1. 学习窗现在有两个值。别再用单一 settleMs 假设：s2LearningWindow(run) 给 800，s2LearningWindow(run,"chain") 给 1500，返回体带 chainSettleMs。
2. controlOutputQuality 的 available:false 现在带 reason。依赖它「静默不可用」的地方要检查；诊断面板经 controlLearningAssessment.outputQualityReason 到 controlRunReview.learningStatus 显示。
3. approachMs 默认值变成 800。测试里的 refillDefaults 常量与三处断言已同步；S2_REFILL_LIMITS 区间 [200,6000] 未变，用户已存的值不动。
4. 已删除的字段别在新代码里引用：plan.flowMaxGS、plan.approachWriteIntervalMs、trace 行的 approachFraction、s2LearningWindow 的 fromMs。
5. strategy 仍是 refill-85，故意没改名（持久化字段 + 12 处分支 + 3 处测试断言；cutoff 默认回到 85% 后名字又对上了）。要改必须做兼容读取且需用户点头。
6. 补水段所有权：见 plugin.js 常量区中文横幅注释与审查文档 §9 / §10。其它对话要改这段先读技能 §22.11 与 §22.12 的六条自检。
7. README 缺 2.2.13 / 2.2.14 / 2.2.15 三个小节（cut 6/7/8 没写），2.2.16 已按「最新在前」插在顶部。补缺归 cut 10。

## 真机怎么验

1. 诊断页「上一杯补水节点」应显示「学习窗口：X s 起 · 已排除补水 + 测量 0.8 s / 链路 1.5 s 沉降」；补水收回没确认时显示「本杯不学 S2 稳态」。
2. 短 S2 跑一杯，看「本杯控制诊断」S2 那行是否出现「（S2 输出质量：learning-window-too-short（窗口内 N / 全段 M 个原始样本））」——这是新加的可观测性，用来区分「窗口切光了」和「数据本来就不够」。
3. 补水参数面板「恢复默认」现在给 approachMs 800（原 200）；cutoffPercent 仍可设 85（2.2.7 起不再被静默改回 95）。
4. 过冲仍是主要待收指标，请记录秤流速峰值。闭环基线 +33.2%（绊线 ≤40%），旋钮是 cutoffPercent 与 S2_REFILL_BLEED_MS（700）。
5. 高指令标定还没做：≥5 ml/s 稳态 r 是 0 样本。方便时跑一杯 S2 手动固定 5.5 / 6.5 / 7.5 ml/s 各 3 s，导出 history JSON 用于校准仿真植物（技能台账）。

## 待用户点头

- commit / tag v2.2.16 / push / GitHub Release / 夸克上传（按 §20，每次都要当次同意）。
- strategy 改名（建议不改，理由见 ACCEPT §5）。
- controlOutputQuality 的 basis 文案（被多处测试与 UI 翻译表引用，改动面大于收益，建议留给 cut 10）。
