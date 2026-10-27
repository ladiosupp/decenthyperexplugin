# HyperEx Pulse Filter 0.1.73

Based on delivered/GitHub1.70. Install over the same plugin; retain LUT/history and valid starting commands. No new calibration or dedicated coffee tests. No1.68 hardware validation yet.

## 1.73 · 萃取图排除泄压尖峰，标注补水收回原因

用户提供1.71截图：S2绿色称流峰值不足5g/s，橙色指令在明显出液前下降；S1主动泄压和最终停止阶段出现相似的机器目标/实际流量尖峰。当前代码确实持续采集dumping/finishing等遥测，而日常图原先不筛阶段、把所有点连接，导致停杯后的波形看起来像萃取动作。本版修复展示范围，不声称已经证明固件内部那段泵动作的确切物理目的。

### 日常图只画萃取

- 普通HyperEx图保留S1/S2/S3萃取数据，隐藏dumping、soak、restart_wait、finishing、aborted等准备/泄压/停杯后阶段。组合遥测还要求已提供的机器状态是espresso且子状态为preinfusion/pouring，排除稳温/flush等非萃取状态。
- 使用已有stage1_weight_trigger和final_weight_trigger事件，在请求停止的时点截止；即使后续点误留在旧活动阶段，也不能跨越这两个截止点。老杯没有事件时按已保存阶段筛选。
- 主动泄压开启时S1与第二次运行断开绘线，不把停杯/重启两侧数据连成一条线。RAW局部斜率不跨泄压/重启计算。S2→S3仍连续；主动泄压关闭的完整曲线保持连续。称重图也截止于各段萃取停止，保留原时间轴，间隔留空。
- 写入指令线与目标反馈/检查标记使用同一可见时间窗，排除停杯后的目标回显。空萃取图清空旧图，非法数值不伪装成零流量。校准图保持完整校准阶段，不受普通萃取筛选影响。
- **仅筛显示**：原始run.samples/rawScaleSamples、事件、统计、学习与CSV均不删除或改写；泄压尾迹保留用于异常排查。界面明确说明日常图省略准备/泄压/停杯后数据。

### 保留滑块，增加上一次参数窗口

五个补水滑块保留。新增独立只读窗口，区分当前已保存设置、最近一次修改前→修改后及修改时间、上一杯实际采用的启动参数。上一杯的计划增强指令与实际记录到的已发送增强指令分别列出，不把计划冒充执行；旧1.71称流目标倍率明确标为旧版，不当作新版泵倍率。没有记录的字段显示未记录，不用当前滑块猜测历史。

最近一次修改记录与现有补水设置共同持久化，成功应用后更新；只改S1/S2/S3曲线不会覆盖补水修改记录，保存/同步失败回滚时一同恢复。重新启动从存储恢复。上一杯参数从冻结的启动计划或已有落盘杯记录读取，不额外篡改旧历史；缺少旧记录时明确提示。当前滑块草稿可与上次保存值对照，尚未应用的拖动不伪装成上一杯数据。

### S2截图与收回原因

1.71中补水受称流阈值、压力、新鲜度和最长时限共同限制；截图下调发生在绿色称流明显建立前，更像最长时限到期，不能仅凭图认定85%称流收回太早。黄色/蓝色是机器ml/s，粉色/绿色是杯中g/s，峰值不能直接混用单位判断。没有CSV/trace，不能给该历史杯编造确定的触发原因。

本版每次补水增强/返回写入记录startupReason，并在箭头详情显示“补水增强/补水收回”及实际记录原因。原先诊断区的执行原因保留。修复上一版下一杯启动摘要残留“估算称流目标”标签，改为基础泵流量倍率，避免把1.72的泵倍率说成杯流百分比。

用户后续实测参考：启动0秒、旧版补水目标7g/s、收回85%、最长4秒、渐进2秒，出现约5.6–6g/s短暂峰值，再回落到约4.5g/s；压力约1bar，机器目标约5.5→3.8ml/s。用户明确该数据用于算法参考，可接受这种短暂过冲，重点是回落后稳定在5g/s，而非把每次峰值都压平。后续交接优化应区分补水结束与稳态维持指令；现有“直接回基础、渐进时暂降杯目标”的组合值得评估，但本版不凭这一杯临时改动作或放宽保护。图像不能替代具体trace证明触发原因。

**控制不再额外放宽**：继承1.72基础泵指令默认160%、最高8ml/s、无＋2限幅；仅此补水幅度按泵指令，其他目标/学习按杯中g/s。85%称流收回、最长4秒请求返回、压力/新鲜度/ACK保护、原skip拓扑、S3设置全部保持。此用户截图为1.71，不是1.72的160%实测。

**476/476 Node模拟/回归检查通过**。验证结果见本包tests/RESULTS_v0173.txt；包括泄压双尖峰、截止事件、旧记录、连续模式、校准模式、断线和RAW斜率重置、原始CSV不变、空图清除、实际收回原因及旧有控制回归。没有1.73真机或完整浏览器验证。

## Historical release notes — 1.72

## 1.72 · S2补水按基础泵指令160%，取消＋2限制

本次仅修改S2临时增强幅度的单位和边界。用户明确：百分比按基础泵流量指令ml/s计算，其他阶段目标、杯内控流、杯间学习与补水收回仍按真实杯中称流g/s。

- 默认倍率160%，可调100%–160%；基础指令先按原生1/16 ml/s量化，增强指令为`floor(min(8, base × percent / 100) × 16) / 16`。取消基础指令＋2 ml/s限制；计划与驱动派发均校验倍率和8 ml/s上限。LUT/杯间学习仍决定基础指令，但不再额外换算增强倍率。
- 例：基础4 ml/s，160%理论6.4 ml/s，实际档位6.375 ml/s，允许超过旧的6 ml/s上限；基础6 ml/s时理论9.6，封顶8 ml/s。100%不需要增强，不强制多写一档。
- 其余补水参数保留：默认确认S2后0秒启动、实际称流达到S2目标85%收回、最长4秒请求收回、恢复后3秒渐进。用户已有的启动延时、收回阈值、最长时间和渐进时间保留；现有可调范围不变。
- 原压力保护保持：默认S2限压6 bar；增强在达到90%限压即5.4 bar时请求收回。600ms数据新鲜度、ACK/返回截止保护、帧确认、正式出水子状态、检查及写入预算、重量出口均保持。不在机器加热/混水稳温子状态执行增强，不增加skip或曲线帧。
- 原1.71存储百分比含义是称流目标，不能静默当作泵倍率。读取无`basis`的旧补水设置时，只迁移倍率为160%，保留其他有效参数并显示说明；新存储带`basis: pump-command`，用户后续设置的倍率跨重启保留。坏值仍回退默认并提示。旧页面含补水字段但没有新单位标记的应用请求会被拒绝，要求重新载入；完全没有补水字段的旧客户端仍保留当前参数。
- 同一曲线编辑器改为“基础泵流量倍率”，预览显示实际量化后的ml/s；85%收回另显示对应g/s。恢复默认、草稿版本、当前杯冻结、空闲应用和失败回滚保留。S3曲线、时长、手动/学习来源不重置。

注意：取消＋2后，不再有原先“额外指令积分≤8个指令ml”的界限；4秒只是计划请求收回时点，不是实测额外水量上限。8 ml/s是软件指令上限，不代表所有粉饼/机器条件下均已实测无过冲或无温度瞬态。

**455/455 Node模拟/回归检查通过**。验证结果见本包`tests/RESULTS_v0173.txt`；Node模拟覆盖新倍率、超过旧＋2边界、8封顶、驱动实际编码/收回、旧值迁移与新值保留、运行中稳温状态禁止派发、界面预览、S3/称流目标/温度保持及既有回归。没有1.72真机或完整浏览器验证。

## Historical release notes — 1.71

## 1.71 · 可视化S2补水设置与自由数值曲线编辑

用户先要求恢复S3旧递增值，随后明确取消源码恢复、选择在真机手动填写。**本版没有S3重置/迁移**；保留现存S3值、来源、时长，尤其是用户已手动恢复的0.698→0.720→0.778。新需求是把S2补水参数放在现有可视化曲线编辑区，并允许原曲线控制点自由输入数字。

### 同一编辑区，统一应用到下一杯

“下一杯·曲线编辑”增加S2提前补水滑块、机器指令预览、估算目标称流速及软件指令上限。滑块修改草稿，点击原有“应用到下一杯”才保存；“恢复补水默认值”只恢复补水参数，不重置S1/S2/S3曲线。现有S3手动值与算法来源保留。补水参数独立存储，不随杯间学习覆盖。

| 参数 | 默认 | 可调范围 | 步长 |
|---|---:|---:|---:|
| 启动延时 | 0秒 | 0–1.5秒 | 0.05秒 |
| 补水目标 | 目标称流速120% | 100%–140% | 1% |
| 实测称流速收回阈值 | 85% | 70%–90% | 1% |
| 最长补水 | 4秒 | 0.5–4秒 | 0.1秒 |
| 恢复后渐进至100%的时间 | 3秒 | 1–6秒 | 0.1秒 |

启动延时从确认进入S2帧后计算，不能设负值或在GHC确认/浸泡结束前补水。当前0秒默认仍尽早执行。正常收回阈值与渐进起点使用同一个配置值；压力/数据/最长时限保护仍可更早请求返回。最长补水设定是计划请求返回的时点，实际执行还取决于驱动与反馈，不能声称毫秒级硬件响应保证。

### 边界的计算与不能调的保护

可调范围以1.70已有限幅为工程边界，不作为所有机器/滤具环境的实测安全认证。设置→读取恢复→生成补水计划→驱动派发均有检查；伪造请求、超界、非有限值和非法步长不被接受。持续提早或增强都不能突破：

- 临时机器指令≤min(8ml/s，基础指令×1.6，基础指令+2ml/s)，按原生1/16向下量化。百分比是称流速目标，仍经LUT/可靠实测局部模型换算，不直接把g/s当ml/s。
- 因此计划额外指令流量最多2ml/s；计划最长4s时，计划增量积分≤8个“指令ml”。这不是实测进水体积、杯中增重或热/压力安全保证；机器标定、流动滞后和保护退出仍影响结果。
- 收回阈值最高90%，保留目标前至少10%的名义流速余量；不能保证所有惯性过冲被消除。0–1.5s延时只允许在确认S2后等待，最少0.5s持续时间覆盖多次常用档位检查，最长4s不放宽原增强期限。渐进时间最少1s，避免恢复后立刻一步把内部目标推至100%。
- 原压力<90%限压的增强准入/收回、600ms新鲜度、驱动ACK、返回截止保护、50ms最小发送间隔、渐进上调750ms、检查/写入预算、重量出口不开放修改。无新增skip、帧或GHC自动启动。
- 主动泄压关闭时仍使用既有连续模式短脉冲，新滑块显示当前不执行补水；保存的设置可供以后开启使用。开关状态不会因调整参数而改变。

### 参数保存与当前杯冻结

新独立KV键`s2RefillSettingsV1`，等待初次读取后才能完成曲线武装/应用；旧安装没有值则使用默认。坏JSON或非法保存值使用默认并提示，不悄悄接受危险值。曲线与补水草稿使用同一版本校验、空闲检查、保存事务和失败回滚；保存失败或上传/回读失败不能报告成功。参数只影响后续杯，当前杯使用冻结的计划。修改补水参数不改变物理LUT指纹、历史准入或原始校准表。

预览明确是估算，显示最大时限示意；达到称流速阈值或保护条件可以更早返回。更改S2基础值时预览同步跟随；应用后以服务器重新换算、限幅和校验结果为准。未把1.70的“返回目标回显缺失仍限制稳态学习”问题冒充为已解决。

### 曲线控制点可直接输入

选中S1/S2/S3控制点后可在数字框输入最多四位小数，也可精细拖动；例如0.698、0.720、0.778不再被界面强行吸附到1/16网格。上下按钮及键盘箭头仍移动一个**实际原生驱动档位**，从最接近当前值的原生量化档计算，触及边界停止；不会用表面小数变化假装实际下降一档。

输入值与对应驱动量化档位分别显示。软件允许保存精细小数，不代表机器具备0.0001ml/s控制分辨率；0.819/0.813仍可能落到同一个0.8125档位。保留0.10–8.00ml/s、S3前≤中≤后与相邻变化限制；非法输入不修改草稿，显示原因并阻止应用。不会因新数字输入而关闭S3三段或重置学习档位。

### 验证

**443/443 Node模拟/回归检查**，包含1.70的408项和35项新检查：默认/边界/步长、延时、70/90%收回、500ms计时、计划二次检查、6s渐进、持久化恢复/坏值回退、旧客户端、版本冲突、保存/上传失败回滚、当前杯冻结、所有硬保护保持、S3保留、滑块逻辑/双语、自由数字精确恢复旧递增值、非法输入、实际档位按钮与下边界。plugin及最终生成HTML脚本语法、HTML结构和1032翻译条目通过检查。没有1.71真机或完整浏览器运行验证；不能把模拟视作硬件过冲/响应已验证。原LICENSE/校准JSON/旧ZIP保持。

## Historical release notes — 1.70

## 1.70 · S2提早补水至85%；S3投影偏置与实测方向保护

用户1.69截图/run1793099785070-1显示：S2启动指令3.651ml/s，整段RAW3.821g/s，后段误差-12.32%、CV2.78%；回显缺失导致“补水后的基础值恢复尚未确认”，S2尚未纳入数值学习。S3启动三段0.813/0.813/0.813，实际整体1.619g/s、后段误差+11.62%，但归一化整体约1.513g/s，下一杯三段建议0.853。用户要求S2更早补水、估算120%目标流量、实测称流速85%时收回；同时调查S3为何由低转高、三段相同是否错误关闭shape。没有这杯完整CSV，以下确认的是源码机制与模拟，不声称已精确重放全部实机原因。

### S2：提早准备与120%目标估算

- 浸泡开始便准备RAW控制通道；此阶段没有泵写入、不消耗检查预算，不缩短浸泡或代替物理GHC按键。S2确认帧1且通道就绪后，首次检查使用一次0ms调度，不额外等250/944ms档位周期；随后的检查恢复原档位频率。去重定时器与一次kick标记防止回调风暴。1.69去掉的350ms切换等待保持；最多一次有帧预检的重启skip、一次S2重量切换，不增加skip或曲线帧。
- 补水目标为 **1.20×目标称流速**，例如5g/s→估算6g/s。g/s不会直接填入ml/s指令。若可靠上一杯尾段实测与最后指令有机器实际流量佐证，使用其局部比例模型；否则按可用LUT的相对变化换算，超出LUT包络时仅使用明确标记的有界局部比例估计，不伪称精确外推。示例：可靠4g/s对应2.5ml/s时，6g/s估算3.75ml/s；这是模型，不保证实际一定达到6g/s。
- 来源仅取可学习的同物理LUT/模式上下文上一杯；需尾段稳定、实测0.5–1.5倍当前目标、至少8条且≥80%的尾段机器记录新鲜、实际流量在参考指令±15%内且压力<90%原限压。排除杯、模式/LUT不符或缺乏佐证不使用此模型。模型只计算本杯补水指令，不自动视作已验证S2杯间稳态证据。
- 临时补水指令上限为 **基础值1.6倍、基础值+2ml/s、8ml/s** 三者最小，向下量化1/16。它比1.69的40%/+1上限宽，原压力、驱动ACK、数据新鲜度、共享检查/写入预算和4s最长增强保护保留；达到机器指令上限会标记commandLimited，不保证达到估算称流速。
- 正常收回改为 **实测RAW回归达到85%**；预测值不再单独触发提前收回。压力余量、秤失鲜、最长4s仍可提前返回。预测继续用于返回后的渐进阶段，防止响应正在上升时重复上调。恢复基础值并响应等待后仍在3s内由85%渐进100%，上调至少750ms，称重量阶段出口与最终目标重量不变。

### S3：等值三段确实是平直，但没有关闭三段模式

源码没有发现1.69修复时将已启用shape强制关闭的路径；0.813×8s→0.813×14s→0.813是**三段计时、相同流量**。原模式标签仅说明三段功能启用，不能代表数值有起伏。现在已应用与启动快照表格明确显示“平直（三段计时）”，真正不同值仍显示形状；保留其时长与5帧结构，不盲目恢复旧的递增曲线。

发现一个可造成偏高/压平的机制：单杯S3每段修正后，旧代码为保证非递减，向前取最大值；前段一旦上调，可能机械地把中、后段一起抬高，即使它们原建议保持/下降。1.68引入更敏捷单杯修正后，这个偏置更值得注意；不声称它独自解释用户所有杯差。

1.70将正常单杯和双杯LEVEL+SHAPE调整改为带每段时长权重的有界单调投影，保留非递减、相邻变化与四档逐段上限。冲突的三段共同让步，而不是用前段的新最大值覆盖后两段。为最终投影保留原始逐段建议，避免提前丢失后段下降意图。专门的停滞恢复规则保持。

对于杯内运行的S3，如果真实RAW尾段超出所选学习带，而归一化模型建议相反方向变化，高尾段阻止上调，低尾段阻止下调；仍可保留同向的限幅修正。模型冲突造成HOLD时显示“实测与模型方向冲突，保持”，不会冒称“在容差内”。投影后不足0.005ml/s的变化不会被当成新的数值应用。模型未被当成实际测量；RAW曲线/误差继续独立展示。该规则不保证根除所有杯差，也不会人为制造非平直命令；受当前非递减形状约束时，合理结果仍可能为平直。


### S3指令历史追溯

用户随后询问何时全段变为约0.819。1.67–1.69源码中没有写死0.819；它与0.813在杯内A010驱动中均编码为0.8125这一档，但不据此推断用户记错或具体修改时间。新增学习历史里的“S3指令变化时间线”，只读列出现存启动快照和已校验的下一杯应用，显示时间、来源杯、插件版本、三段数值、来源、平直/三段模式和学习排除状态。保留被排除杯用于溯源，不重新纳入学习。只有前后都已校验、同物理上下文且中间快照未缺失时才列出非平直到平直的观测转变；提案和失败应用不能当已执行。仅能报告现存最早证据，缺失旧记录不能宣称第一次修改。当前尚未取得用户设备历史文件，因此未声称准确是哪一杯。

### 验证与保留事项

**408/408 Node模拟/回归检查**：继承1.69的388项，调整新120%流量包络与实测85%收回期望；新增20项覆盖g/s→ml/s区别、LUT插值/超界回退、可信实测来源与排除/模式保护、浸泡预热通道、一次立即kick、S3时长加权投影、800组四档边界、实测高/低与模型相反方向、等值shape5帧上传及UI状态。包含plugin语法、生成HTML脚本语法、双语/HTML结构验证。996翻译条目。无1.70真机或完整浏览器执行验证；构造数据不等于用户该杯原始数据重放。

原LUT、历史及人工排除、温度设定、主动泄压/连续模式区分和四档强度保留，不需重校准。1.69的“S2返回目标回显缺失时暂不学习”仍是限制：本版没有把写入ACK直接冒充机器目标确认，也没有声称已解决底层全部缺失反馈。原LICENSE和校准JSON不变，旧安装包保持。

## Historical release notes — 1.69

## 1.69 · S2 先补水，85%收回，再渐进到目标

主动泄压后，S2使用独立的有界补水策略：不再先等待上一杯合格慢爬升证据，也不再要求泵实际流量先追到基础值的85%。两个原开关S2StartupAssist与杯内控流仍同时生效，默认开启；主动泄压关闭时保留原连续曲线的短脉冲策略。本版不改S3学习增益/限幅，保留1.68四档策略与历史/LUT。

- **尽早进入S2**：GHC确认preinfusion/pouring后，原固定350ms切换等待移除。并行预备RAW传输与一次新鲜帧号预检；已在S2不重发skip，帧号不符合不连续跳步。没有新增帧、skip、自动GHC按键或曲线上传。准备阶段不写补水指令、不消耗检查预算。
- **先有界补水**：只有已确认S2帧1、曲线已校验、机器/秤新鲜、压力低于原限压90%、没有未决S2指令且留足返回预算时，才在同一帧写较高流量。上限为基础值1.4倍、基础值+1ml/s和原8ml/s硬上限三者最小值，向下量化至1/16；例如基础2.5→补水3.5ml/s。这不是无限制机器最大流量。
- **85%提前收回**：短窗RAW重量/源时间回归达到目标85%，或最近上升趋势推算约400ms后将达到85%，即恢复已验证基础指令。目标5g/s对应4.25g/s。需至少6个唯一源样本、约0.6s、R²≥0.90；窗口0.75s为主，较低采样率可用1.3s内窗口，不用单点dW/dt。预测是有界趋势估计，不能保证消除所有惯性过冲。
- **独立时限与保护**：增强最长4s；压力达到限压90%或秤失鲜也收回。返回不等待补水目标回显/称流回归，但需前次驱动ACK、同帧和新鲜机器数据。补水/返回各有2s驱动ACK保护，最长增强+2.5s总返回保护；返回只有目标回显缺失时保持同基础值重试，不继续向上叠加。进入S3取消所有补水计时器，不再写上一帧。帧号缺失是未知状态，不会取消返回截止保护。
- **85%→100%渐进**：确认基础值ACK及目标回显后，保留1.6s响应等待，再让内部称流控制目标在3s内从85%渐进至100%。上调至少间隔750ms，检查仍按所选杯内档位继续；若预测现有上升趋势将达到当时目标，就等待惯性响应。下调保留原频率和边界。完成渐进后继续以100%目标微调，上调仍保持750ms间隔。
- **学习分开**：有实际补水写入的S2，稳态学习使用确认恢复基础值之后再过1.6s的窗口；补水段不进入稳态数值归一化或机器覆盖率分母。未确认返回时保留实测曲线，暂不把该瞬态当稳态证据。整段RAW误差、曲线仍完整显示，不将短暂补水效果伪装为稳态准确度。归一化窗口新增起止时间，诊断/CSV保留实际动作、85%收回原因与预测值。

检查/写入预算仍为每杯2000检查、按杯内档位50/150/200/250实际写入，含补水、返回和重试。原限压、硬停、原始LUT、温度处理、历史人工排除、杯间四档设置保留。无需重新校准。

Validation: **388/388 Node synthetic/regression checks**. Includes the361 prior checks with ordinary-control fixtures explicitly disabling startup to isolate that subject, and legacy planner unit tests explicitly exercising the continuous-mode planner;27 new active-release cases cover arm-without-history, switches/mode separation, quantization/envelopes, early low-actuator dispatch, unconfirmed-frame waiting,85%actual/predicted cutoff, freshness/tare/gaps, pressure/timed return, ACK/timeouts/target-onlydegradation, gradual approach/spacing, transient exclusion, zero-delay/prewarmed single-skip topology, and missing-frame return protection. Plugin and generatedHTMLscripts are syntax checked; both UI languages/HTML structure are covered. No1.69 hardware or full-browser execution validation yet; synthetic input curves are not proof of faster device filling. Physical drain amount is not measured or assumed as a known volume. LICENSE/calibrationJSON bytes unchanged.

## Historical release notes — 1.68

## 1.68 · 动态学习与来源标记

默认杯间学习档位改为 **正常**：一杯合格证据发现超出学习容差，下一杯即可生成、上传并校验一次限幅调整。无需再等一杯完全相同的指令。该设置与杯内控流的1–4档独立；已有杯内开关/档位和主动泄压选择保持。

| 档位 | 启动数值调整 | 学习误差带 | S1 每杯上限 | S2 每杯上限 | S3 每段上限 |
|---|---|---|---|---|---|
| 保守 | 两杯可比证据 | ±8% | ±4%且0.04ml/s | ±5%且0.10ml/s | ±4%且0.04ml/s |
| 温和 | 小偏差两杯；明显偏差允许单杯 | ±8% | ±5%且0.04ml/s | ±8%且0.20ml/s | ±5%且0.05ml/s |
| 正常（默认） | 一杯合格证据 | ±8% | ±10%且0.08ml/s | ±12%且0.35ml/s | ±8%且0.075ml/s |
| 激进 | 一杯合格证据，更高增益 | ±5% | ±15%且0.12ml/s | ±20%且0.60ml/s | ±12%且0.125ml/s |

百分比与绝对值同时限幅，并保留机器流量、S3顺序/相邻变化限制、压力与执行保护；不是承诺实际杯流按同比例改变。基础增益0.18/0.25/0.35/0.55。历史同向一致时作为约20%参考；当前与历史冲突时正常/激进缩小本次步幅而非一律REPEAT。保守保留两杯一致性检查；已确认S3停滞仍使用较保守的专门恢复规则。

**激进的统计学习准入范围为正常的1.3倍**。例如S2稳态与起步波动CV上限12%→15.6%，拟合未解释误差上限0.10→0.13，即R²0.90→0.87；固定S2回归R²0.97→0.961。最少统计时长/覆盖率按1.3折算，样本数向上取整；归一化窗口离散度25%→32.5%、历史参考一致范围35%→45.5%。它扩大可用证据，不把错误杯算正确，也不扩大实际出液目标或驱动安全边界。原始HIT/NEAR/MISS仍是出液诊断，与数据准入/学习误差带分别显示。

### Same curve, dynamic evidence

Normal/Aggressive use current clean S1 startup, S2 level and S3 frame evidence without requiring an identical-command repeat. Near-target current evidence holds; a pressure/actuator limit, unavailable RAW evidence, excluded fault or numeric response outside0.2–3×target still withholds correction. Missing evidence is never invented. Gentle permits a clean large scalar error(≥20%, with stable matching tail forS2) or largeS3frame error; Conservative requires comparable repeats. S3 single-shot LEVEL+SHAPE changes retain the monotonic/adjacent bounds. An explicit user OFF for autoapply still requires manual application.

For this single fixed HyperEx curve, numeric history no longer hard-matches targets, weight exits, soak time, temperature or pressure-setting microchanges. PhysicalLUT/multiplier, coffee/empty context and ActiveReleaseON/OFF remain separated. Existing coffee qualification and valid learned command seeds survive microchanges without resetting to empty calibration. Existing qualification-marker strings migrate by normalizing their original fingerprint. Learned override goal bindings accept bounded goal changes instead of discarding every small change; physicalLUT and mode guards remain.

Nearby scalar commands are compared through an explicitly labelled local proportional reference; S3 maps old frame commands/timings into a reference for current frames. The model has a bounded0.5–2 command/target ratio envelope; more distant history remains retained but is not forced into that model. The newest comparable contradictory observation is retained as conflicting evidence; Normal/Aggressive damp against it rather than searching for an older agreeing cup. Numeric extreme responses are excluded from numeric reference, independently of operator/fault annotations. Legacy version numbers are not an exclusion and the same adaptiveHistoryFileV2 storage key is retained.

Fixed-command S2 LEVEL uses a clean settled last60% RAW regression when available, preventing initial delay/ramp from being mistaken for a persistent plateau deficit. Whole-phase actual validation and plots remain unmodified. In-shot normalized target-window learning remains explicitly modelled; actual RAW output remains separate. Selected statistical thresholds/rejection reasons and learning policy appear in diagnostics.

### Startup assist without a prerequisite plateau HIT

Startupmetrics schema2 stores both target-referenced20–80% rise and observed-plateau-relative rise, with the displayed basis. A stable below-target plateau can qualify: Normal allows0.5–1.08×target, CV≤12%, targetovershoot≤8%; Aggressive widens these statistical ranges by1.3. Valid onset/continuous unique source timestamps, execution integrity and fresh machine coverage/headroom are still required. Machineheadroom statistics require≥80%coverage/8rows, <10%samples near≥95%pressurelimiter and≥90%post1s samples with actualflow≥85%observedtarget. No hard pressure limits are raised.

Normal/Aggressive can trial one native1/16ml/s quantum for400ms from one clean slow-rise cup (>1.2s/>1s). Gentle permits a very slow single cup(≥2.5s,CV≤8%); Conservative needs two compatible observations. Small S1/S2 starting-command changes no longer reset this evidence. Legacy schema1 metrics whose explicit rejection was only baseline-off may be reused, because that reason followed their strict headroom checks; absent raw metrics are not reconstructed. Normal/Aggressive do not require an identical preceding S1write signature; other policies retain bounded trajectory compatibility.

Runtime still requires sameframe1, verified original base target, fresh machine+scale, no pending/priorS2write, pressure<90%configuredlimiter, actualflow≥85%base, and reserved return/check budget. The dispatch window is2s; if a usable RAW estimate is already≥80%target, skip a late boost. One-quantum amplitude≤8%/8ml/s is unchanged. Existing independent base-return deadline, earlypressure return,2.5s total driver-ACK guard, missing-target-only degradation/retry, cooldown, same-frame checks and shared budgets remain. Continued assist needs an observed≥10%rise improvement against a consistent reference basis; this is not proof of individual-action causality. The UI separates NOTPLANNED/ARMED/ISSUED/RETURNING/SKIPPED and the actual reason, plus current next-shot eligibility, instead of an unexplainedNO.

### Original / Adaptive / Manual

Applied-profile and shot-start tables now show **ORIGINAL/LUT**, **ADAPTIVE**, or **MANUAL** independently of internal execution-override type and S3shape. Stageorigin is frozen atshotstart and persisted perstage/shape. Auto changes mark only changedstages adaptive; editingS2 does not relabel untouchedS1/S3 as manual. Numeric editor Keep retains adaptive provenance; actual user edits/selectingmanual create manual provenance. Visual editing, successful applies, persistence/reload and failure rollbacks preserve origins. Legacy adaptiveSource is an aggregate learned-source migration; unattributed legacy overrides show RETAINED/UNKNOWN rather than inventing user authorship. The saved LUT is unchanged.

### Storage and export diagnostics

The user confirmed the three reported cups were saved. This release does NOT claim they were lost: code inspection found exact-command and startup gates that can cause repeated waiting. A new per-run persistence audit reports current record/evidence presence, write/readback pending/verified status, lastreadback time and actualUTF8 bytes. A small successful probe alone does not claim the current cup was saved. Transient storage errors get atmosttwo idle retry/probes, and require whole-file readback before restoring verified status. Unload/shutdown clears retrytimers; failures remain visible.

New compact history records keep every action/ACK/target/fault but replace routine check rows with reason counts. Current full trace/CSV stays intact and older records are not rewritten. CSV now has the full current live trace despite the separate300event ring, a previously missingS2next-shot row, and origin/policy/history metadata. An independent flatS3 analysis null-dereference was found by the new reload integration test and fixed; it is not asserted as the user's reported cause.

Validation: **361/361 syntheticNodechecks**, plugin syntax, generated browser scripts and HTML/locale checks. The legacy regression harness explicitly selects Conservative and is supplemented by Normal/Aggressive cases: three-cup synthetic response→verifiedupload→diskreadback→reload→next-cup improvement; one-cupS1/S2/S3; conflictinghistorydamping; mixedmanual/adaptiveprovenance; exact1.3statisticalwidth and same-waveformCV admission; pressure/freshness/ACK/budgets unchanged; old-version/microsetting reuse; fullCSV/flatS3/storage recovery. These are simulations, not replay of the user's unseen3cups. No1.68 hardware/fullbrowser validation yet. OriginalLICENSE/calibrationJSON stay byteidentical. No new calibration or dedicated coffee tests are requested.

## Historical: Active release switch and continuous brewing (1.67)

ActiveRelease defaultsON, preserving the original S1weight→Idle/active release→soak→GHC restart→S2→S3 sequence. The switch is immediately after Enable in native plugin settings and the first highlighted control in the quick-settings editor. The diagnostics top banner always states ON/release-soak-restart or OFF/continuousS1→S2→S3, including before settings fetch. Dashboard DIAGheader text also identifies the mode. Chinese/English labels and reasons remain reversible. The active-shot UI now shows the runningstage instead of HYPEREXIDLE. Quick settings use the existing native settings endpoint, preflight idle/availability and reload once; no second switch store. Native host settings remain host-controlled: change between cups because saving reloads the plugin.

OFF runs one Espresso: atS1weight(default4g), a guarded single0→1advance entersS2; atS2weight(default40g), one1→2advance entersS3; atfinalweight(default100g), requestIdle. No intermediateIdle,soak,Espressoarm,restart countdown or second GHCconfirmation. Initial start stays the usual user start. Cumulative weight is not reset atstageboundaries. Natural S3shape timers remain unchanged, without extra skips. Continuous finalweight also stops whileS1transition awaits its APIread. Asynchronous preflight skips recheck phase/sequence identity before dispatch, so finishing/abort/restart cannot cause a late skip. Missing/null profileFrame is no longer coerced into0; the existing once-only bounded unknown-frame fallback remains. Explicit unexpected frames are rejected. Original active-release mode and its guards retain their default behavior.

Live trim stays defaultON/level3. In continuous mode the same controller also coversS1frame0, with the same RAWregression/freshtelemetry/pressure/actuator/onepending/ACK/target/native1/16/bounds safeguards. A pending S1weight transition blocks new S1writes. Existing50/150/200/250write and2000check limits cover the WHOLE cup, includingS1 andS2startupboost/returns/retries; no budget reset atstagechanges. Active-releaseON retains its previous S2/S3-only live coverage. Explicit liveOFF disables all live actions but preserves fixed-profile S1/S2/S3 completed-shot learning. The raw encoder now accepts the valid nativeframe0; no extra machine characteristic or global multiplier changes.

S1 corrected continuous cups use the original startup quality gates (2.5gcollected,20–80%≥0.9s/8samples/R²≥.90,active≥1.25s). Only that measured20–80%RAWtrajectory is fitted against integrated ACTUAL observed target exposure relative to the quantized starting command. It requires unique continuous source timestamps and freshsameframe target/machine coverage, known bounded commands, pressureheadroom and actuator tracking. Insufficient/limited corrected S1 does not pretend fixed-command evidence; its reason appears in the existing decision panel. This is explicitly a local proportional model, not physical causality or a modifiedRAWcurve. Two-cup consistency,±8%nextshotband and original bounded S1changes remain. Fixed S1 retains its existing path. S2/S3 learning is retained. S2startupshape also compares the preceding S1write signature; an unmatched actual S1trajectory skips the conditional startupboost.

Numeric fingerprints now include shotSettings.activeRelease. Missing legacy field meansON, so previous records remain usable in the originalmode. OFF numerical consensus cannot use ONcups, and viceversa; startupshape learning is isolated too. All history stays in the same retained file and manual exclude/restore rules still apply. The history table labels each cup's mode. Persistent command/shape/manual provenance uses the ORIGINAL manualTestOverrides key forON and manualTestOverridesContinuousV3 forOFF; reads, clears, applies and rollbacks route to the currentmode, and overrides carry the mode binding. Returning toON restores its savedcommands rather than overwriting them withOFFvalues. FreshOFF starts from the shared valid physicalLUT until it learns its own commands.

The original physical calibrationLUT and established coffee operating qualification are shared across the switch. Qualification ignores mode (like temperature) to avoid demanding new empty-basket calibration merely because the flow topology changed. This is readiness/baseline reference sharing, NOT mixed numeric consensus or sharing learned command overrides. Other physical LUT/settings/context guards remain, and explicit history exclusion cannot re-enter learning. No user history or prior ZIP is deleted.

Validation:328/328 syntheticNodechecks with all original305 plus23continuous-mode checks covering full two-skip/oneIdle run, original release flow, finalweight/latepreflight cancellation, transitionfailure, S1frame0driverwrites/normalization/insufficientfeedback, fixedlearning, mode/legacy history isolation, separate commandstorage/load/clear/verifiedapply, coffee qualification, UIstate/defaults/idle-savepreflight, S2startup preceding-S1guard and pressurestop. Generated browser scripts and HTML structure/IDs are checked. No1.67 hardware run or full browser/WebView visual validation yet. Continuous S1driver behavior and normalized-model accuracy require ordinary-use hardware evidence; no claim of guaranteed target tracking.

## S2 startup response and bounded pre-emphasis (1.66)

S2 retains its immediate FAST fixed baseline command on entry. It does not create a slow command ramp. Existing next-shot LEVEL learning remains responsible for the baseline; an independent response-shape analysis separates cup response delay, sustained20–80% target-flow rise time, tail60% mean/error/CV and overshoot. Measurements are rolling0.6–0.85s linear regressions of original scale weight against unique source timestamps, not instantaneousdW/dt. Crossing requires3successive good fits; a real-time windowed estimate is not an exact hydraulic delay measurement. First/reset/gap/frame/onset and execution integrity are checked. Analysis only: no automatic time-shift of displayed actual data.

The native plugin setting S2StartupAssist defaultsON, but requires live trimON and verified persisted history. Old records still supply existing LEVEL learning; they do not contain invented startup evidence. Two newest comparable startup records must agree within25% on rise time, have sustained20–80% rise>1s, tailerror≤8%,tailCV≤10%,overshoot≤8%, trustworthy completion/profile, same physical fingerprint/context/target and baseline within1/32ml/s, and same S1command. Temperature alone stays compatible. Machine telemetry coverage≥80%/8samples, pressure<85%limiter, and flow≥90%observedtarget after1s are required for shape eligibility. Newer comparable failed/fast/variable responses are not skipped to find older slow agreement. Excluding a history cup removes it from startup planning too. Old history/LUT is retained; no recalibration or dedicated coffee shots are requested.

When justified, the frozen shot-start plan requests exactly one native1/16ml/s upward quantum, no more than8% or8ml/s, for400–800ms derived from repeated rise time. It does not grow with each sample. Actual dispatch is same S2frame1, stockDE1 driver only, within1.2s of observedframe entry, after fresh machine/scale telemetry, verified original base target, machine flow≥90%base, pressureheadroom, no pending/retry/busy command, zero priorwrites and reserved return/check budget. If guards/socket are late, skip assist and retain ordinary baseline/trim. No extra profile frames, skipStep, pressure limit or global multiplier changes. Opening latency can mean no boost on that cup; diagnostics distinguish plan and issued write.

Independent400–800ms deadline requests the base command as soon as boostdriverACK and freshsameframe telemetry permit, regardless of boosttarget echo or scale regression. Rising pressure≥95%limiter also returns early. No normal scale correction can extend the pulse. Returning is a downward command, not an extra upward increment. At2.5s from boost dispatch, missing base-return DRIVER ACK triggers the existing Idle/abort safety path; raw transport/send failure also retains safety stop. Base-return driverACK without targetecho does NOT stop the shot: monitor in degraded mode and retry only the SAME base at≥3s with freshsameframe machine telemetry, inside existingwrite/check budgets. No upward progression until base echo arrives. Delayed echo recovers, then wait1.6s before regular cup-scale trim resumes. Cross-frame transition clears pulse timers and never returns into oldframe. Every boost/return/retry consumes the existing50/150/200/250writebudget; no budget reset. No unconfirmed boost stacking.

A completed assisted cup records the actual action and reference rise; bounded assist is retained only if the new eligible response shows≥10% shorter rise against that reference without excessive ripple/overshoot. This is an observational policy, not proof of individual-write causality. Otherwise revert to ordinary baseline and gather normal coffee evidence. There is no automatic boost escalation. All actual issued/target windows remain in the existing normalized LEVEL learning pipeline, so a temporary boost is not silently labelled a new constant profile command.

The next-shot decision panel displays delay/rise/tailerror, current next startup plan/reason and whether a boost was actually issued; labels/reasons have Chinese/English translations. CSV/raw diagnostic JSON and plots retain the original measured stream and action trace. Fixed-command curve-editor preview remains the baseline, not a promised actual cup response or a depiction of every conditional rawwrite.

Validation:305/305 syntheticNodechecks, generated browser-script syntax and existing HTML structure checks. No1.66 hardware test or full browser/WebView rendering. Rise/boost thresholds are software heuristics and hardware benefit is unverified. Explicit liveOFF disables both regulartrim and startupassist. OriginalGHC/two-skip topology, finalweight/pressure/scale guards, LUT, manual/history controls and persisted preferences remain.

## Learning history integrity and exclusion (1.65)

Step2 now includes Learning history · Exclude / restore shots. Select a cup by time/runID/version, choose Operator mistake,Plugin fault,Scale/cup disturbed orOther, then exclude it from future learning. The history table shows eligibility/reasons and which stages have retained evidence. Restore removes the user's exclusion only; automatic faults and normal stage quality/consensus gates still apply. No graph/evidence/LUT deletion, automatic profile rollback or extra machine upload. Already-applied commands remain current and can be adjusted using the curve editor. Existing history retention limits still apply.

Eligibility is enforced before current-shot suggestions/admission, during persisted/session restore, matching lookup and empty-baseline/reference counts. Excluded original evidence is retained for inspection and valid manual restoration, never silently merged back. Pending application of the excluded cup is cancelled. Control review/decision UI clearly labels exclusion instead of still claiming learning admission. Existing coffee operating qualification is persisted independently of later sample exclusion, preventing an annotation from resetting a valid coffee profile/LUT to empty mode. A changed physical LUT/settings key invalidates that retained qualification.

Automatic hard exclusions use positive evidence: incomplete/interrupted run, unverified initial profile, recorded execution abort/fault, more than2accepted plugin skip commands, or a gross in-extraction scale discontinuity. Scale inspection is within S1/S2/S3 after2s with at least2g prior gain: drop≥3g, or positive jump>max(12g,30g/s×dt) for a positive source-time gap≤0.6s. These are conservative software disturbance heuristics, not hardware-proven operator intent. Initial tare with no meaningful gain, intended dump/restart tare and normal GHC re-arm are allowed. Execution faults/skip counts survive event-ring truncation. Negative raw readings during release are not mistaken for extraction faults.

MISS, low flow, ordinary ripple, late decay, real stalls, pressure limitation without abort, and missing target feedback alone are not reasons to label a cup an operator/plugin mistake. Existing per-stage regression/pressure/actuator and consensus protections still decide numerical use. Legacy compact records without raw/events cannot be fully retrospectively audited; they retain available completion/profile checks, and the UI labels limited audit. Users can flag known old mistakes explicitly. No claim that all historical mistakes can be detected automatically.

Review edits require idle state and verified persistent history, use the existing history file (no second numeric data store), retain a bounded annotation log and serialize through its existing write/readback queue. UI shows save pending until readback. If dispatch fails, the session flag remains fail-closed with an explicit persistence error; persistence across reload is not falsely claimed.

## Historical consensus lookup fix (1.64)

A newer cup lacking S2 evidence, with a different phase command/context, or restored from unverified disk used to terminate the history search immediately. That could hide an earlier valid matching cup and make a currently admitted S2 keep reporting REPEAT SAME COMMAND. Now scan newest-to-oldest through the retained history and select the first comparable verified cup. Apply the same correction to S1/S3 history lookup.

Keep the same LUT/target/context/storage truth and stage command/shape checks. After finding the newest comparable cup, retain the existing variability/error-direction/pressure/actuator gates. Never skip a newer contradictory comparable cup to find an older agreeing one. No evidence is invented for a currently inadmissible stage. Missing current evidence still waits; this does not force every MISS into an adjustment.

The decision panel shows lookup counts (checked, missing stage, incompatible context/commands, unverified disk) and matched source run. These are translated while preserving raw IDs. A synthetic before/after replay of the same history (valid S2 → intervening missing-S2 row → current valid S2) changes old REPEAT to ADJUST2.507→2.607ml/s, then passes automatic upload and workflow verification. This reproduces a software defect, not the user's unavailable original1.62 RAW data. The exact blocker in the newly reported1.62 cup still needs its screenshot; do not assume this is its sole cause.

## 中文／English switch (1.63)

The page header now has 中文 / English buttons. Default language is Chinese; the chosen language is saved in existing pluginStorage under uiLanguage and restored on reopen/reload. Switches apply immediately without page reload, profile upload or a new machine request. Curve drafts, selected handles, input values, source records and learning history remain unchanged. Preference saves are serialized; an unsuccessful storage request visibly restores the prior language. Late initial-storage reads cannot overwrite a newer explicit choice.

Coverage: generated diagnostics/GHC pages, Step1–4 headings and controls, curve editor, automatic status and gate explanations, marker titles/details, confirm/alert dialogs, and plugin-provided dashboard/header/shot-strip text. RAW,LUT,ACK,DE1,units and product names are intentional technical terms. Raw CSV/JSON, numeric input values, IDs and code blocks are never translated. The native Decaid Plugins/settings interface is rendered by Decaid from manifest metadata and is outside the plugin page switch; this switch does not alter Decaid's app-wide language.

Text translation is reversible and observes newly rendered nodes, tooltips and accessible labels. Original text is retained in WeakMaps so switching cannot accumulate translation artifacts. The bootstrap is independent from the main diagnostics script; original CLOSE/HOME failure containment remains. The embedded reviewed catalog contains859phrase entries/aliases. Raw external error messages without a catalog entry remain original diagnostic text, not invented translations. The catalog is embedded in plugin.js; no remote translation/network service or extra dependency is used.

## Default live trim: ON / level3 (1.63)

User-authorized defaults now enable live trim at level3:250ms checks,2000check cap across S2/S3,200write cap including retries. Manifest and loadConfig defaults match; invalid/missing level falls back to3. Explicitly saved OFF or a different valid level is retained, so upgrading does not force a user's stored preference. A saved level1 remains1. Original ACK/pressure/source/command bounds,2%target aim and recoverable missing-target policy unchanged. Direct-driver-start test remains OFF. The initial slider, checkbox and instructional text match the new defaults.

## 下一杯曲线编辑（Step 2）

Step2 now contains a visual command editor with5 selectable handles: S1,S2,S3 EARLY/MID/LATE. Select a handle and drag vertically, use ↑/↓ buttons, or keyboard arrows. Each button advances to the next native1/16ml/s command level. Preview the draft and current commands, inspect generated parameters, then click 应用到下一杯. This is an explicit next-shot application, never a running-shot edit. Preview does not write to the machine.

The vertical axis is DE1 flow command ml/s, not measured cup g/s. Gray dashed is current setup; orange is draft. This is a stage diagram: S1/S2 remain weight-triggered, release/soak are omitted, and the S3 handles show their actual0/early/early+mid second starts. Change S3 EARLY/MID durations with±1s buttons (3–30s); late runs to final weight. S3 retains non-decreasing commands and existing adjacent-rise limits. No free-form profile frames, extra skipStep calls, physical-response guarantee or invented delay model.

Editing S1/S2 preserves other stage modes and current commands. Editing S3 enables the3-part shape; switching shape off gives flat S3 at the middle command. Flow command bounds remain0.1–8ml/s. Draft/current visibility switches are separate. Dirty drafts survive refresh; changed applied parameters disable applying an obsolete draft until reloaded. Applying requires selected verified HyperEx, idle state, valid LUT, a fresh unchanged workflow, upload acknowledgement and final readback. Failure rolls back previous overrides. A successful upload followed by a page-refresh failure remains labelled applied, with a refresh warning. A successful application updates Step2 APPLIED PROFILE and provenance. Old-run automatic or manual adaptive proposals cannot overwrite the new curve; new completed coffees continue normal learning. Numeric precision editor remains under optional Step3 details, using the same storage/profile source, verification/rollback and prior-run supersession. RETURN ALL TO LUT also verifies application and suppresses stale old-run proposals. AUTO APPLY remains unchanged.

## Curve and decision output audit

- Real-scale flow chart has independent visibility checkboxes for cup target, RAW cup flow, Decaid cup flow, machine target, machine actual and issued flow commands. Units remain visible; original raw weight chart unchanged.
- Issued writes use small upward/downward arrows according to command change. SAME-target retries use↻, rather than falsely counting another increment. Historical writes without a recorded previous command have an unknown-direction dot. ACK is not a cup-output confirmation; matching machine target remains a separate square.
- Validation now has an adjacent 下一杯决策 panel explaining each stage's output error, whether an adjustment is proposed/applied/failed/held/waiting, and the exact learning blocker. Manual application marks the old cup analysis as superseded. An available proposal is not described as already applied before successful readback.
- Fixed-target learning previously tried dynamic exposure only when fixed-window seconds were too short. It now tries the dynamic path if ANY fixed-window admission gate fails, including temporal coverage or consistent-cohort share. Prefer an eligible dynamic analysis. RAW/machine/pressure gates, ≥1.2s and6unique source samples,R²≥.90, S2≥2.4s,25% temporal coverage,60% consistent-window share, matching two-cup consensus and correction bounds remain unchanged.
- Learning reports structured actual/required seconds, temporal coverage, consistent-window share and precise failures. It no longer says merely “need2.4s” when2.84s has already passed that condition. This repairs a skipped analysis path; it does not guarantee every MISS should cause an automatic adjustment.

## Retained controller and learning behavior

Original LUT unchanged. S1 startup quality gates unchanged; normal next-shot S1/S2 deadband8%,S3 LEVEL8%. Live target band2% is an aim, not guaranteed physical precision; DE1 command quantum1/16ml/s. Unique RAW source timestamps, pressure/actuator and fresh-machine guards retained. S3 timed subframes advance naturally. Only the original2business skip transitions; physical GHC confirmation remains. Home temperature persists; temperature alone does not invalidate numeric consensus or require a new LUT. Actual output review stays separate from labelled target-normalized local-model learning. Whole-cup smoothness supports overall outcome, not isolated per-write causal proof.

|Level|Check cadence|Check cap S2+S3|Write cap including retries|
|---|---|---|---|
|1|planned duration/50,minimum300ms; default944ms|2000|50|
|2|300ms|2000|150|
|3|250ms|2000|200|
|4|200ms|2000|250|

Live trim defaults ON at level3; diagnostic slider/native dropdown. Saved explicit choices are retained. Success waits at least50ms for BOTH ACK and matching target, then next level tick/new source sample. Missing target alone does not end trim: after3misses, retry SAME unresolved target at least3s after prior send while continuing checks. Matching target recovers automatically; no unconfirmed accumulation. Missing driver ACK retains original abort path. Budgets never reset on recovery. Original pressure/no-scale/total-time/final-weight safeguards and post-shot profile restoration remain.

## Validation

305/305 Node simulations: steady-MISS retention, execution/extra-skip and scale anomaly exclusion, normal/delayed tare and GHC recovery allowance, manual exclude/restore, immutable evidence/LUT/profile, restore/merge bypass protection, coffee context retention/LUT invalidation, queued apply cancellation, invalid inputs/storage/busy gates, HTTP no-machine-write behavior, exclusion display and retained history selection/errors; plus interrupted historical lookup, missing-stage/context/command/storage exclusions, newest-conflicting-row retention, S3 lookup, absent evidence and automatic upload verification; plus reversible localization, newly authored text, raw CSV/JSON/input preservation, dialogs, storage rollback/late-read/serialization, dashboard actions, all static language coverage, ON/level3 defaults and explicit saved preferences; plus retained controller tests, generated browser-script compilation, UI draft/refresh/stale checks, pointer and keyboard interaction with a simulated DOM, quantization/shape/time bounds, real HTTP handlers for application and reset, rollback, fresh workflow edits, prior-run suppression/new-run learning, queued evaluation restoration, successful application vs failed UI refresh, arrow/retry direction, explicit stage decisions and dynamic fallback when fixed seconds pass but coverage fails. Generated full HTML has balanced elements and unique IDs; generated editor SVG parses as XML. Fixtures are synthetic, not unavailable user RAW replays.

Full browser visual/touch rendering was unavailable (Chromium/Firefox and SVG raster delegate not installed); simulated DOM/pointer checks are not hardware or full WebView validation. Existing handheld/tablet screenshots remain the actual1.60 evidence. No1.65 device results yet.

Run node --check plugin.js and node tests/verify_v0173.cjs. Current HANDOFF_v0173.md and tests/RESULTS_v0173.txt accompany this package. LICENSE and original calibration JSON are unchanged. Delivered older ZIPs remain immutable; old remote files retained for history.
