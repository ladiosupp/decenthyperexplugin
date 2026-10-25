# HyperEx 交接 · v0.1.51

日期：2026-10-25（Asia/Shanghai）

## 基线与状态
- 本包是基于完整、校验一致的 v0.1.50 ZIP 制作的新候选 1.51，未改原始 ZIP。
- 原 1.50 SHA-256：dbdb995b68e1ced18b2d712ed077580fec15196f17fdabff675f47e993b72711。
- 1.50 真机已显示 CAL/LUT 数值存在、WORKFLOW READBACK VERIFIED；用户未单独提供 CAL READY 顶部截图。
- 1.50 两杯后 history 为 PERSISTENT，2 saved / 2 compatible；第三杯后数量及重启恢复未拍照验证。
- 本包 81/81 模拟检查通过；1.51 尚未真机验证。不要宣称形状修正已在真机生效。
- GitHub ladiosupp/decenthyperexplugin 的已核验 main 是 1.49（7f2f38b5111ecb278adfff6ab4602b54b41deb5c）。本轮没有上传 1.50/1.51。

## 三杯证据（截图）
参数和实际开杯指令未变：S1 目标2 g/s、command .719 ml/s；S2目标5、command2.507；S3目标1.5、SHAPE .698×8s → .720×14s → .778 ml/s。保留 manual seed。
1. 第1杯：S1整段RAW .612，startup INSUFFICIENT；S2 5.075；S3整体1.601，late/early .611，LATE DECAY，无stall。
2. 第2杯：S1整段1.123，startup20–80% 2.079 g/s、transit .95s、MEDIUM；S2 4.908，最近两杯均值4.992，HIGH/HOLD；S3整体1.790，frame 2.060/1.843/1.546，late/early .711。S3最大分段差异24%，VARIABLE/REPEAT。
3. 第3杯：S1 startup20–80% 2.834、transit .70s、R² .91431、INSUFFICIENT；S2 5.188，最近两杯均值5.048，HIGH/HOLD。S3 frame1.734/1.558/1.182，late/early .660，LATE DECAY，无stall；最新两杯整体均值1.635，最大分段差异26.7%，VARIABLE/REPEAT。
- 第3杯整体1.480可由 2×1.635−1.790 推算；不是本轮完整截图中独立读取的RAW回归值。测试中仅用于重建案例。
- 第一杯RAW weight96与completed101：代码使用累计重量并跨归零保留offset；5g差异与第一段留存解释一致。但未拿到原始运行日志，不能确认该杯精确offset。

## 1.51 修改
1. S1不降低门槛。显示 gain、transit≥.90s、样本≥8、active≥1.25s、R²≥.90各质量条件的拒绝原因。
2. S3绝对分段波动>20%时，额外计算每杯独立归一化的分段形状。只有同命令、同时间、同measurementBasis、无stall、各R²≥.95、各窗口≥3s，两杯quarter和frame均衰减，归一化变异≤15%、整体变异≤20%、frame late/early差≤.12才允许SHAPE ONLY。
3. 新路径LEVEL factor固定1，SHAPE小步：每段≤4%且≤.05ml/s；舍入后测量窗口加权command exposure变化≤.2%；保留非递减、硬限和相邻升幅限制。不能把command exposure近似保持说成真实杯中流量不变。
4. 既有normal LEVEL+SHAPE和stall路径保留；不同测量basis不形成共识。
5. schema保持truth3，兼容既有有效1.50 evidence；不重校准，不清history。升级后没有完整旧RAW run，通常需新完成一杯才重新计算建议。

## 测试
node --check plugin.js
node tests/verify_v0151.cjs
81/81。原70项全保留。新增截图重建证据、反向形状/低质量/异basis/过大波动拒绝、S1短窗口解释、完整合成RAW→建议→idle apply→DTO验证、上传失败rollback、页面脚本编译。
截图测试不等于原始RAW日志重放。独立fallback测试验证约束和方向，尚无真实杯中修正效果证据。

## 真机下一步
- 同ID覆盖升级，不卸载清数据；保留参数、LUT、manual seed、history。
- 先看1.51版本、CAL READY、PERSISTENT saved/compatible及WORKFLOW VERIFIED。history若丢失或SESSION ONLY，先截图，不重校准。
- 再完成一杯，拍S1 Quality、S3 frame、ADAPTIVE、NEXT SHOT实际指令及验证状态。
- 若出现SHAPE ONLY且已applied/VERIFIED，再跑一杯核对snapshot、实际执行及杯中回归。
- 若再次VARIABLE/REPEAT，不堆杯数；索取完整CSV/diagnostics，核对basis、质量和normalized variability。
- history重启恢复与Dashboard CLOSE/HOME仍是待测项；本版未声称修复导航。

## 不可破坏规则
S1/S2/S3目标始终是杯中g/s；证据是RAW weight+scale timestamp多秒回归，不能以DE1 Flow或瞬时dW/dt替代。Adaptive只改下一杯，不做运行中秤反馈调流、不加skipStep、不写回校准LUT；无效校准保留旧有效LUT。S1不足只repeat；S2 HIT hold；S3 LEVEL/SHAPE分离，fallback保持本杯command provenance。Settings单一来源，Dashboard cooperative。

GitHub同步仅在用户授权版本范围内执行；提交说明标注真实提交者与可确认模型名称，勿猜模型。同步前读head/tree，expected head防覆盖，后核对blob SHA。

用户要求在对话长度风险出现前提醒并提前整理交接；无精确剩余额度，不伪称百分比监控。Android sandbox下载曾无法拉起；优先提供真实已保存Library ID对应原生下载入口。不要编造ID。
