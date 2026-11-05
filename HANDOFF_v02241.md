# HyperEx 2.2.41 交接：平滑回收与控制逻辑一致性

日期：2026-11-05（北京时间）。实验版本，尚未经过红米平板 / DE1 真机验证。
提交者：ChatGPT / OpenAI Codex。

## 接手基线与授权

用户要求：直接实施审查建议、发布新版本、留下交接 MD。源分支 v1.79ds，基线 2.2.40 提交 3deca9ce3c7e94f9f0df36fa74148b3ad8fa6636。分支名不是插件版本。
设计依据：用户提供 decentplugin_SKILL_2026-11-05.md，特别是 §22.4、§22.8、§22.13、§22.16 及仿真校准台账。优先平滑回到目标，不为补面积刻意下冲；少写是第二目标；救急不得被普通平滑规则吞掉。

## 改动与原因

1. 当前杯增益 updateLiveGain：命令变化超过半档时重新初始化 r/count/n/firstStamp，不沿用旧命令的 EWMA。非稳态或比值越界时删除候选；相同或倒退采样不增加证据。至少 3 个新样本且覆盖一个回归窗（S2 1.6 s / S3 3 s）才参与控制中心，600 ms 新鲜度仍在。此覆盖要求只管采用新增益，不暂停原控制。它仍是平均响应比，不是边际斜率。距写入一个窗的条件保留，不能声称已严格消除所有暂态。
2. 角度恢复 atan(abs(dq/dt))，新报告 trendAngleScale=absolute-per-second，使 90/120° 门槛回到原定义。读取 2.2.40 的 relative-per-second 报告仍兼容，不重解释历史数据。
3. liveTrimRegression：用前后窗口样本时间的均值差 separationS，计算 acceleration=(fast-early)/separationS，再外推 horizon 秒。新增 acceleration/separationS 诊断。前瞻 1.5/1.2 s、原预测限幅与质量门保留。它是有界经验预测，不是真机已辨识模型。
4. S2 回收采用启动时确定的 u0→u1 时间轨迹，反馈负责到达目标/跨越目标退出，终点不再每个样本重新比例折算。每笔最多 2 档；距上次写入每 600 ms 最多积累 1 档、最多 2 档，不把长暂停累积成大下拉。保留 2.2.40 峰值检测、短 S2 启动、救急优先。到时限仍交回普通控制，不声称达到目标；速率约束只用于普通 S2 回收，不约束救急或补水特殊写入。
5. 杯流首次改善仅作 onset 诊断，不再当作动力学完成而加快写入。统一 writer 门沿用 S2 1200 ms / S3 2400 ms / 救急 800 ms，basis=unidentified-response-baseline；不恢复 S3 第二重 hold。每个新样本仍评估，但不会保证每次都写。此为撤销未经辨识的自动加速，不是完成在途响应建模；更灵活间隔仍需真机辨识。
6. 救急时间：normalTrimQuanta 共用正常动作上限；recoveryTimeEstimate 按实际每笔档数折算所需笔数，不再每档算一次写入。报告 fastestS 到 slowestS（后者假定响应为平均比值一半）的经验范围；使用较快估计仍来不及时才满足 cannotReturn。报告 basis=average-gain-proxy-range，绝非统计置信区间。真实边际增益未知，未伪造辨识结果。
7. 控制评价与学习资格分开。controlQualityGood 保留尾均值 ±8%、CV≤10%，新增 p95绝对误差≤15%、尾过冲≤20%、RMSE/target≤10%。这些是实验诊断阈值，待真机校准，不新增学习拒绝门。报告/UI增加 p95、RMSE、同帧指令反转数；反转含必要纠偏，所以只报告，不一律判坏。指标是既有后段回归窗的指标，不能当作整段补水过冲。

## 保留内容

2.2.40 的 fresh-sample 去重、null 保真、g/s 与 ml/s 单位分离、S2 剩余时间、救急先于 governor、对称接近判断、ACK 与命令状态分离全部保留。压力、通信、帧确认、全局预算、观察模式、LUT、状态机、两次 skip 拓扑未改。杯间持久记忆结构未迁移。
局部增益旧先验 ±25% 和最高75%融合仍保留；不同条件下先验可能形成限制，后续应凭真机数据调整。跨 LUT 的旧绝对指令学习通路也未重构，不混进本次控制修复。

## 测试与发布

验证记录在 tests/RESULTS_v02241.txt、tests/RESULTS_closed_loop_v02241.txt；最终主回归 **767/767** 通过（最终源码重新执行），简化闭环 **3/3** 通过；node --check、生成 HTML 脚本检查（包含在主回归）、manifest JSON 解析、git diff --check 和 ZIP 完整性检查通过。verify_v02241.cjs 继承安全、生成 HTML 脚本、profile、配置、存储与学习回归；新增命令切换增益隔离、重叠窗口不升级置信度、多档恢复时间、均值掩盖过冲、斜坡不囤积档数、预测时间原点不变性测试。旧测试脚本保留。
现有测试和模拟不提供 90% 真机准确度承诺。原 field replay 依赖缺失的 hyperex-history (5).json；本轮未获得新真机 JSON，无法交叉校准，不把它记成通过。

## 真机一次测试重点

正常设置跑一杯并导出完整 history：检查 S2 峰后是否仍被连续下拉、末端能否回目标；S3 锯齿/反转与末端偏差；rescue 触发的 raw/predicted/angle/remainingS/timeToReturnS；current-cup-blend 是否触发及其命令/覆盖时长。不要只看均值或写入数。平滑度、过冲和末端误差优先比较，不能以减少写入掩盖迟到目标。

## 安装、回滚及接手

安装 releases/v2.2.41/HyperExPulseFilter_v2.2.41_experimental.zip，根目录 decenthyperexplugin.reaplugin/。重载后确认 2.2.41。
按用户约定，需要时安装 2.2.39 回滚包；2.2.40 也原样保留。代码回滚不会撤销测试杯写入的学习历史；对明显失败/异常杯使用现有手动排除，保留原导出便于分析。
后续先读此文档和真实 history，再判断参数；不能以旧版测试字符串或未经校准模拟替代用户目标。发布更新 v1.79ds 及版本目录；GitHub Release 已于 2026-11-05 补建，见文末「发布记录」。

## 发布记录（2026-11-05）

- 代码提交 `133a3e1`，tag `v2.2.41`，分支 `v1.79ds` 已推送。
- GitHub Release：https://github.com/ladiosupp/decenthyperexplugin/releases/tag/v2.2.41（附件 `HyperExPulseFilter_v2.2.41_experimental.zip`，473,501 字节）。
- SHA256：`D9BA5E83CA84BD2BA3FA666EA87A757276AD996EFB9D64D1D5035A4A7D5D7D74`；包内 11 个文件与提交 `133a3e1` 逐字节一致。
- 夸克：`夸克网盘/来自：Codex/HyperExPulseFilter_v2.2.41.zip`，473,501 字节，fileId `de89300b2157406b86078c9f95af4d95`。
