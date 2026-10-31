function createPlugin(host) {
  "use strict";

  const API = "http://localhost:8080/api/v1";
  const SCALE_WS = "ws://localhost:8080/ws/v1/scale/snapshot";
  const WATER_WS = "ws://localhost:8080/ws/v1/machine/waterLevels";
  const ID = "decenthyperexplugin.reaplugin";
  const PLUGIN_VERSION = "1.87ds";
  // Hard bounds are enforced twice: once while loading user settings and again
  // when generating the DE1 profile/calibration commands. This keeps malformed
  // settings, stale LUT values, or advisory calculations from ever becoming an
  // out-of-range machine command.
  const LIMITS = Object.freeze({
    commandFlowMin: 0.10, commandFlowMax: 8.00,
    desiredRealFlowMin: 0.30, desiredRealFlowMax: 6.50,
    temperatureMin: 70.0, temperatureMax: 100.0,
    pressureMin: 0.50, pressureMax: 12.00,
    stage1WeightMin: 1.0, stage1WeightMax: 20.0,
    stage2WeightMax: 200.0, finalWeightMax: 300.0,
    maxProfileFrames: 20
  });
  // Two empty-basket calibration programs. LOW WATER is the default and
  // concentrates samples around the HyperEx real-flow targets while keeping
  // the cup well below 300 ml. FULL retains the denser 12-point map.
  const CALIBRATION_MODES = {
    low: {
      label: "Low Water",
      algorithm: "target-lut",
      // Target-focused calibration. The three blocks follow the HyperEx use order:
      // stage-1 ~2 g/s, stage-2 ~5 g/s, then the final ~1.5 g/s after high flow.
      // Each block is evaluated independently; all three targets must pass before
      // the previous valid LUT is replaced or HyperEx is auto-synced.
      primeFlow: 3.00, primeSeconds: 3.0,
      targetBlocks: [
        { id: "S1", targetSource: "stage1", target: 2.00, commands: [0.65, 0.80, 0.95] },
        { id: "S2", targetSource: "stage2", target: 5.00, commands: [2.20, 2.40, 2.60] },
        { id: "S3", targetSource: "stage3", target: 1.50, commands: [0.70, 0.60, 0.50] }
      ],
      stepSeconds: 7.5, settleSeconds: 2.8, windowSeconds: 4.4,
      hardStopG: 240, recommendedContainerMl: 300,
      waterWarnMarginMm: 15, waterBlockMarginMm: 5
    },
    full: {
      label: "Full",
      algorithm: "staircase",
      primeFlow: 3.00, primeSeconds: 3.0,
      commands: [0.25, 0.40, 0.60, 0.80, 1.00, 1.25, 1.50, 2.00, 2.50, 3.00, 4.00, 5.00],
      stepSeconds: 6.0, settleSeconds: 2.2, windowSeconds: 3.4,
      hardStopG: 270, recommendedContainerMl: 300,
      waterWarnMarginMm: 20, waterBlockMarginMm: 7
    }
  };
  const STORAGE_UI_LANGUAGE="uiLanguage";
  function createUiTranslator(pairs) {
    const maps={zh:new Map(),en:new Map()};
    for(const [en,zh] of pairs){if(en&&zh){maps.zh.set(en,zh);maps.en.set(zh,en);}}
    const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
    const patterns={};for(const lang of ["zh","en"])patterns[lang]=new RegExp([...maps[lang].keys()].sort((a,b)=>b.length-a.length).map(escape).join("|"),"g");
    return (value,language)=>{
      const source=String(value==null?"":value),lang=language==="en"?"en":"zh",map=maps[lang],trim=source.trim();
      if(map.has(trim))return source.slice(0,source.indexOf(trim))+map.get(trim)+source.slice(source.indexOf(trim)+trim.length);
      return source.replace(patterns[lang],(match,offset)=>{
        const prev=source[offset-1]||"",next=source[offset+match.length]||"";
        if(/[A-Za-z]/.test(match[0])&&/[A-Za-z]/.test(prev)||/[A-Za-z]/.test(match[match.length-1])&&/[A-Za-z]/.test(next))return match;
        return map.get(match);
      });
    };
  }

  const UI_LANGUAGE_PAIRS=[["EXPORT HISTORY JSON","导出历史 JSON"],["IMPORT HISTORY JSON","导入学习历史 JSON"],["IMPORT LUT JSON","导入 LUT JSON"],["IMPORT FROM URL","从链接导入"],["HISTORY JSON","历史 JSON"],["Up to 30 shots; new shots keep the per-shot trace.","最多 30 杯；新增杯保留逐点记录。"],["CONTROL LAW CURVE: the angle between the check-to-check trend line (previous check → current regression) and the target line; 0° = trend lies on the target, 90° = parallel offset, above 90° = diverging.","控制律曲线：每次检测点的趋势线（上一检测点 → 当前回归）与目标线的夹角；0° 表示趋势落在目标线上，90° 表示平行偏离，大于 90° 表示背离目标。"],["monitoring-unresponsive-trend","趋势未响应，重新决策中"],["Save refill settings", "保存补水参数"], ["Refill settings saved for next shot", "补水参数已保存，下一杯生效"], ["Checking…", "正在检查…"], ["CHECKING", "正在检查"], ["ENTRY", "入口"], ["Dashboard", "首页"], ["DIAG / CAL", "诊断／校准"], ["Plugins → HyperEx Pulse Filter", "插件 → HyperEx Pulse Filter"], ["is enabled by default. If another plugin occupies the reserved header slot, open", "默认启用。如果入口被其他插件占用，请打开"], ["STEP 1 · FLOW CALIBRATION", "步骤 1 · 流量校准"], ["First-time setup. Use an", "首次设置。请使用"], ["EMPTY BASKET", "空粉碗"], ["and a large catch vessel. A valid RAW-scale calibration creates the real-flow LUT used by HyperEx. Invalid calibration never overwrites the previous valid LUT.", "和大容量接液容器。有效的原始秤重校准会生成 HyperEx 的实际杯流 LUT；失败不会覆盖已有有效 LUT。"], ["CALIBRATION LUT", "校准 LUT"], ["WATER / VESSEL / TANK PREFLIGHT", "水量／容器／水箱检查"], ["Waiting for live DE1 tank level…", "正在读取 DE1 水箱水位…"], ["PREPARE FLOW CAL", "准备流量校准"], ["SYNC HYPEREX", "同步 HyperEx"], ["USE SUGGESTED FOR NEXT CAL", "下次校准使用建议值"], ["APPLY SUGGESTED GLOBALLY", "全局应用建议值"], ["RESTORE PREVIOUS GLOBAL", "恢复原全局设置"], ["CLEAR CAL MAP", "清除校准表"], ["WAITING", "等待中"], ["STEP 2 · SHOT-TO-SHOT AUTO ADAPTIVE", "步骤 2 · 杯间自动学习"], ["Normal daily workflow after calibration. Every completed HyperEx shot is measured with RAW scale weight + timestamp regression. S1, S2 and S3 are evaluated separately; verified changes apply only to the", "校准后的日常流程。每杯完成后，用原始秤重及时间戳回归分别评价 S1、S2、S3；通过校验的调整仅用于"], ["next shot", "下一杯"], [". Normal mode has no running-shot scale closed loop. The optional live-flow test is labelled separately below. No extra skipStep calls.", "。常规模式不进行杯内秤重闭环；可选杯内调流试验在下方单独标注，不增加跳步。"], ["ADAPTIVE HISTORY", "学习历史"], ["checking persistent storage…", "正在检查持久化存储…"], ["NEXT SHOT · APPLIED PROFILE", "下一杯 · 已应用曲线"], ["Actual workflow commands below come from GET /workflow. Real g/s targets and LUT commands remain reference values. VERIFIED also requires successful machine upload acknowledgement.", "下方实际指令来自曲线读取结果。杯流目标 g/s 和 LUT 指令仅作参考；已校验状态还要求机器上传确认成功。"], ["READ RAW WORKFLOW", "读取原始曲线"], ["Raw workflow / adaptive audit JSON", "原始曲线／学习审计 JSON"], ["Next shot · Curve editor", "下一杯 · 曲线编辑"], ["Select S1, S2 or an S3 early/mid/late point. Drag vertically or use the buttons. Orange previews the next-shot machine-flow commands (ml/s), gray shows current settings. Actual cup flow in g/s is below; the preview does not guarantee output.", "选择 S1、S2 或 S3 前／中／后控制点，上下拖动或按按钮调整。橙线是下一杯机器流量指令草稿（ml/s），灰虚线是当前设置；杯中实测 g/s 见下方曲线，预览不代表实际出液保证。"], ["Current settings", "当前设置"], ["Draft commands", "草稿指令"], ["S3 three-stage curve", "S3 三段曲线"], ["↓ One level down", "↓ 下调一档"], ["↑ One level up", "↑ 上调一档"], ["One level = 1/16 ml/s. S3 early≤mid≤late and adjacent-rise limits remain; adjustment stops at a bound.", "一档 = 1/16 ml/s。原有 S3 前≤中≤后及相邻增幅限制保持；到边界时停止调整。"], ["Apply to next shot", "应用到下一杯"], ["Reload current curve", "重新载入当前曲线"], ["Reading current curve…", "正在读取当前曲线…"], ["LATEST SHOT · COMMAND SNAPSHOT", "上一杯 · 启动指令快照"], ["Historical command snapshot captured at shot start. It may differ from NEXT SHOT after adaptation.", "此快照记录该杯开始时的指令，可能与学习调整后的下一杯设置不同。"], ["LATEST SHOT · VALIDATION", "上一杯 · 验证结果"], ["RAW real flow is a multi-second linear regression of unmodified scale weight vs scale timestamp. Instantaneous RAW dW/dt is not the acceptance reference.", "实际杯流通过数秒原始秤重与秤时间戳的线性回归计算；瞬时 RAW dW/dt 不作为验收依据。"], ["S1 STARTUP / S3 STABILITY", "S1 启动／S3 稳定性"], ["S1 separates first-rise delay from active cup flow. S3 tracks EARLY / MID / LATE stability and stall/decay behavior.", "S1 分别分析首次出液延迟和出液后的杯流；S3 跟踪前、中、后段稳定性及停滞／衰减。"], ["NEXT SHOT ADAPTIVE", "下一杯学习建议"], ["AUTOMATIC PATH", "自动流程"], ["S1 startup, S2 level and S3 LEVEL + SHAPE use repeated completed-shot evidence and bounded corrections. Calibration LUT is never rewritten by adaptive history.", "S1 启动、S2 流量及 S3 总体流量与形状均使用已完成杯的重复证据进行限幅调整；学习历史不会改写校准 LUT。"], ["LIVE / END-OF-RUN TELEMETRY", "实时／结束时数据"], ["REAL SCALE CURVES", "实际秤重曲线"], ["Machine target / machine flow: ml/s. Cup target / Decaid weightFlow / RAW-scale slope: g/s. Weight chart is the unmodified scale weight stream.", "机器目标／机器流量单位为 ml/s；杯流目标／Decaid 杯流／原始秤重斜率单位为 g/s。重量图保留原始秤重数据。"], ["LIVE TEST: green circles = check RAW g/s; gray circles on baseline = check without usable regression; orange ↑/↓ = write vector drawn on the previous-check → this-write trend line (arrow up/down = command increase/decrease in absolute terms; divergence from the target line is shown as-is, length = step amplitude ml/s); the vector angle is that trend line vs the target line (0° = trend lying on the target); ↻ = fresh vector on an unresponsive trend; pale blue = smoothed trend trajectory (check → write points joined); pale squares = machine target/trend response ml/s. Tap/hover markers for details.", "杯内试验：绿圆点表示有效杯流检查；底部灰点表示无有效回归；橙色 ↑／↓ 表示写入矢量（箭头画在上一检测点到本次写入的趋势连线上；上下＝指令增／减的绝对方向，与目标背离时如实显示；长短＝指令幅度 ml/s；矢量角度＝这条连线与目标线的夹角，0° 表示趋势落在目标线上）；↻ 表示趋势未响应时的重新决策（不是重发同值）；浅蓝细线表示检测点／控制点连线平滑后的趋势轨迹；浅色方块表示机器目标／趋势响应。点击或悬停查看详情。"], ["OPTIONAL", "可选"], ["STEP 3 · MANUAL / ENGINEERING", "步骤 3 · 手动／工程设置"], ["Optional precise numeric and engineering settings. For daily use, edit the next-shot curve in STEP 2; with AUTO APPLY enabled, learning continues after new shots.", "可选的精确数值和工程设置。日常可在 STEP 2 直接编辑下一杯曲线；AUTO APPLY 保持开启时，新杯完成后继续学习。"], ["Optional precise numeric and engineering settings. For daily use, edit the next-shot curve in STEP 2; with AUTO APPLY enabled, learning continues after new shots.", "可选的精确数值和工程设置。日常可在 步骤 2 直接编辑下一杯曲线；自动应用 保持开启时，新杯完成后继续学习。"], ["REFERENCE ADVISORY · NO RUNNING-SHOT CONTROL", "参考建议 · 不改变正在运行的杯"], ["Manual reference ranges derived from the latest shot. These are not LUT rewrites.", "根据上一杯提供手动参考范围，不改写 LUT。"], ["ADVANCED / TEST OVERRIDE EDITOR", "高级／手动指令编辑"], ["EDITOR ONLY.", "仅为编辑草稿。"], ["AUTO / LUT uses the saved calibration LUT. MANUAL TEST changes only future HyperEx profile commands. S3 shape advances by profile time only.", "自动／LUT 使用已保存校准表；手动设置只改变之后的 HyperEx 指令；S3 三段仅按曲线时间推进。"], ["Precise numeric editor (optional)", "精确数值编辑（可选）"], ["APPLY TEST COMMANDS", "应用手动指令"], ["RETURN ALL TO LUT", "全部恢复 LUT"], ["ADVANCED SETTINGS · QUICK EDIT", "高级设置 · 快速编辑"], ["Same source of truth as", "与以下设置使用相同来源："], [". Saving here writes normal plugin Settings; there is no second settings store.", "。在这里保存会写入常规插件设置，不另建设置副本。"], ["REAL-FLOW TARGETS", "实际杯流目标"], ["Parameter", "参数"], ["Value", "数值"], ["S1 target (g/s)", "S1 目标 (g/s)"], ["S2 target (g/s)", "S2 目标 (g/s)"], ["S3 target (g/s)", "S3 目标 (g/s)"], ["TEMPERATURE / PRESSURE SAFETY", "温度／压力保护"], ["Temperature (°C)", "温度 (°C)"], ["Current profile temperature · adjust on home page", "当前曲线温度 · 在首页调整"], ["Emergency pressure (bar)", "紧急压力上限 (bar)"], ["S1 pressure limiter (bar)", "S1 压力限制 (bar)"], ["S2 pressure limiter (bar)", "S2 压力限制 (bar)"], ["S3 pressure limiter (bar)", "S3 压力限制 (bar)"], ["EXPERIMENTAL S2/S3 LIVE FLOW TRIM · DEFAULT OFF", "S2／S3 杯内调流试验 · 默认关闭"], ["Enable live flow trim", "开启杯内调流"], ["Level", "档位"], ["DIRECT DRIVER START TEST · DEFAULT OFF", "直接驱动启动试验 · 默认关闭"], ["After soak: Espresso request, then raw A002=04 write", "浸泡后：请求萃取，再尝试写入 A002=04"], ["One optional raw write. Original GHC confirmation countdown, re-arm retries and safety guards remain active. Physical GHC confirmation was still required in the 1.54 device test.", "仅一次可选原始写入。原有 GHC 确认倒计时、重新准备重试及保护保持有效；1.54 真机试验仍需实体按键确认。"], ["RELEASE / SCALE / RETRY / DIAGNOSTICS", "泄压／秤／重试／诊断"], ["Release flow threshold (ml/s)", "泄压流量阈值 (ml/s)"], ["Low-flow stable samples", "低流量稳定样本数"], ["Release fallback (s)", "泄压备用延时 (s)"], ["Release timeout (s)", "泄压超时 (s)"], ["Scale tare threshold (g)", "秤归零识别阈值 (g)"], ["No-scale timeout (s)", "秤数据超时 (s)"], ["Auto-arm retry 1 (s)", "自动准备重试 1 (s)"], ["Auto-arm retry 2 (s)", "自动准备重试 2 (s)"], ["Diagnostic sample (ms)", "诊断采样间隔 (ms)"], ["Maximum sequence (s)", "流程最长时间 (s)"], ["SAVE TO PLUGIN SETTINGS", "保存到插件设置"], ["EXPORT", "导出"], ["STEP 4 · COPY CSV", "步骤 4 · 复制 CSV"], ["Raw engineering export for offline analysis or bug reports. This is intentionally last because it is not needed for normal brewing.", "供离线分析或问题排查的原始数据导出；日常冲煮无需使用，因此放在最后。"], ["LAST RUN CSV", "上一杯 CSV"], ["Combined DE1/Decaid samples plus RAW scale weight/timestamp/dW-dt and profile-frame markers.", "合并 DE1／Decaid 样本、原始秤重／时间戳／重量变化率以及曲线帧标记。"], ["RE-ARM", "重新准备"], ["COPY CSV", "复制 CSV"], ["CLOSE / HOME", "关闭／首页"], ["CLOSE", "关闭"], ["DIAGNOSTICS UI ERROR", "诊断界面错误"], ["The diagnostics script failed to initialize. CLOSE / HOME remains available.", "诊断脚本初始化失败；仍可使用关闭／首页。"], ["Unknown UI error", "未知界面错误"], ["S3 EARLY", "S3 前段"], ["S3 MID", "S3 中段"], ["S3 LATE", "S3 后段"], ["Generated parameters", "生成参数"], ["Current", "当前"], ["Draft ml/s", "草稿 ml/s"], ["Early", "前段"], ["Mid", "中段"], ["Late until end", "后段至结束"], ["FLAT", "平直"], ["Verifying and applying to next shot…", "正在校验并应用到下一杯…"], ["Current parameters changed; draft retained. Reload the current curve before editing.", "当前参数已更新；草稿已保留，请先重新载入当前曲线再编辑。"], ["Draft not applied · press Apply to next shot to activate.", "草稿未应用 · 点击“应用到下一杯”后生效。"], ["Manual curve applied to next shot; learning continues after new shots.", "手动曲线已应用到下一杯；新杯完成后继续自动学习。"], ["Select a point, then drag vertically or use the up/down buttons.", "点选控制点后上下拖动，或点击上调／下调。"], ["Running or profile unverified; preview only.", "当前运行中或曲线未校验，只能预览。"], ["Next-shot curve not verified", "下一杯曲线未校验"], ["Verified and applied, but UI refresh failed. Reopen diagnostics:", "已校验应用到下一杯，但界面刷新失败，请重新打开诊断页："], ["Not applied:", "未应用："], [". Draft retained.", "。草稿已保留。"], ["Cup target g/s", "杯中目标 g/s"], ["RAW cup flow g/s", "RAW杯流 g/s"], ["Decaid cup flow g/s", "Decaid杯流 g/s"], ["Machine target ml/s", "机器目标 ml/s"], ["Machine actual ml/s", "机器实际 ml/s"], ["Issued command ml/s", "写入指令 ml/s"], ["Active release is complete. Wait until the soak reaches 0. The plugin will arm the second stage only after the full soak.", "主动泄压已完成。请等待浸泡倒计时归零，插件会在浸泡完成后准备第二阶段。"], ["CHECK PINK LIGHT", "检查粉红灯"], ["Pink ON → press the physical GHC Espresso button. Pink OFF → tap RE-ARM, then press GHC when the light turns pink.", "粉红灯亮 → 按实体 GHC 萃取键；粉红灯灭 → 点击重新准备，待灯亮后再按实体键。"], ["FLOW CAL RUNNING", "流量校准运行中"], ["EMPTY BASKET. Leave the staircase running until Idle. Do not remove the catch vessel; the plugin will stop at the selected-mode actual-water safety cap before 300 ml.", "请使用空粉碗。阶梯校准运行至空闲前不要移走接液容器；插件会在所选模式的实际水量上限停止，低于 300 ml。"], ["HYPEREX IDLE", "HyperEx 空闲"], ["No GHC action is required.", "当前无需操作 GHC 按键。"], ["arm requests", "准备请求次数"], ["DIRECT TEST:", "直接启动试验："], ["RE-ARMING…", "正在重新准备…"], ["RE-ARM REQUEST SENT", "已发送重新准备请求"], ["Wait for the pink GHC Espresso light, then press the physical GHC Espresso button.", "等待 GHC 粉红灯亮，再按实体萃取键。"], ["RE-ARM FAILED", "重新准备失败"], ["MANUAL TEST", "手动设置"], ["AUTO / LUT", "自动／LUT"], ["Current profile command state unavailable.", "无法读取当前曲线指令状态。"], ["Source:", "来源："], ["Manual LUT restore", "手动恢复 LUT"], ["Manual curve editor", "手动曲线编辑"], ["Next-shot execution", "下一杯执行"], ["WORKFLOW READBACK VERIFIED", "曲线读取校验通过"], ["WORKFLOW NOT VERIFIED", "曲线尚未校验"], ["expected commands are shown only as a reference until repair succeeds.", "修复成功前，预期指令仅供参考。"], ["Stage", "阶段"], ["Target REAL g/s", "实际杯流目标 g/s"], ["LUT cmd", "LUT 指令"], ["Mode", "模式"], ["ACTUAL WORKFLOW COMMAND", "实际曲线指令"], ["No completed HyperEx shot command snapshot is available.", "尚无已完成 HyperEx 杯的启动指令快照。"], ["LIVE TRIM ENABLED:", "杯内调流已开启："], ["this table is the shot-start snapshot. In-shot commands and machine target responses are plotted and exported below.", "本表为启动快照；杯内写入及机器目标反馈在下方绘制并导出。"], ["Target", "目标"], ["Mode AT SHOT START", "启动时模式"], ["COMMANDS USED BY THIS SHOT", "该杯启动指令"], ["Historical snapshot only. It does not change when NEXT SHOT ADAPTIVE writes a new profile after this shot.", "仅为历史快照，不随该杯完成后的下一杯学习调整而改变。"], ["Level 1 · original cadence / max 50 writes", "一档 · 原周期 / 最多50次写入"], ["Level 2 · 300 ms / max 150 writes", "二档 · 300 ms / 最多150次写入"], ["Level 3 · 250 ms / max 200 writes", "三档 · 250 ms / 最多200次写入"], ["Level 4 · 200 ms / max 250 writes", "四档 · 200 ms / 最多250次写入"], ["Single settings source · core curve: S1", "统一设置来源 · 核心曲线：S1"], ["GHC timeout", "GHC 超时"], ["DIRECT DRIVER TEST:", "直接驱动试验："], ["Settings load error:", "设置读取失败："], ["Invalid setting:", "无效设置："], ["Save these values to the normal HyperEx plugin Settings?", "将这些值保存到常规 HyperEx 插件设置吗？"], ["This uses the same settings source shown on the Plugins page and reloads HyperEx once.", "这会写入插件页面的同一设置来源，并重新载入 HyperEx 一次。"], ["Save failed:", "保存失败："], ["Settings saved. HyperEx is reloading; reopen DIAG / CAL if this page closes.", "设置已保存，正在重新载入 HyperEx；如果页面关闭，请重新打开诊断／校准。"], ["CAL READY", "校准就绪"], ["REQUIRED FIRST", "请先完成"], ["ACTIVE · AUTO NEXT SHOT", "已启用 · 自动学习下一杯"], ["WAITING FOR VALID LUT", "等待有效 LUT"], ["ADAPTIVE HISTORY · PERSISTENT", "学习历史 · 已持久保存"], ["saved shot(s),", "杯已保存，"], ["compatible with the current calibration/LUT and basket context.", "杯与当前校准／LUT 及粉碗阶段兼容。"], ["empty/pre-upgrade baseline references retained; coffee consensus accumulates from normal coffees.", "条空粉碗／升级前基线已保留；有粉共识从日常出杯积累。"], ["ADAPTIVE HISTORY · SESSION ONLY", "学习历史 · 仅本次会话"], ["Shot-to-shot adaptation still works in this session, but cross-reload/version regression is disabled.", "本次会话仍可杯间学习，但无法跨重新载入／版本保留。"], ["checking pluginStorage write/readback…", "正在校验插件存储写入和读回…"], ["Low Water", "低水量"], ["Full", "完整阶梯"], ["Tank level unavailable", "水箱水位不可用"], ["refill threshold:", "补水阈值："], ["calibration plateaus", "校准平台"], ["nominal DE1 command water", "DE1 指令估算水量"], ["ml or larger", "ml 或更大容量"], ["catch vessel. Plugin actively stops around", "接液容器。插件会主动停止于约"], ["actual collected water.", "实际接液量。"], ["CALIBRATION READY", "校准已就绪"], ["CALIBRATION NOT READY", "校准未就绪"], ["map base:", "校准基准："], ["LUT valid", "LUT 有效"], ["LAST CAL RUN INVALID — previous valid LUT retained", "上次校准无效，已保留原有效 LUT"], ["LAST CAL RUN VALID", "上次校准有效"], ["Test mode:", "手动模式："], ["HYPEREX ONLY", "仅 HyperEx"], ["TARGET LUT:", "目标 LUT："], ["Frame", "曲线帧"], ["Block / target", "区段／目标"], ["DE1 cmd", "DE1 指令"], ["RAW real g/s", "RAW 实测 g/s"], ["DE1 flow", "DE1 流量"], ["Status", "状态"], ["ANCHOR SOURCE", "校准锚点来源"], ["No calibration run yet. Low Water automatically searches the three HyperEx real-flow targets and generates the LUT only when all targets pass. Full remains the wide engineering staircase.", "尚无校准记录。低水量模式会自动搜索三个实际杯流目标，全部通过后生成 LUT；完整模式保留宽范围工程阶梯。"], ["Stable skip topology:", "固定跳步流程："], ["scale feedback is advisory only. Optional S3 DECAY COMP may use 5 profile frames, but S3 subframes advance only by their own timers and never add plugin skipStep calls.", "此处为杯间参考；可选 S3 衰减补偿使用 5 帧，子阶段仅由自身计时推进，不增加插件跳步。"], ["Legacy S1 startup factor", "旧版 S1 启动系数"], ["is stored but ignored in", "已保存，但在当前版本中不使用："], ["CLEAR LEGACY", "清除旧设置"], ["Clear failed:", "清除失败："], ["Calibration status error:", "校准状态错误："], ["Same-target retry ↻", "同值重试 ↻"], ["Command up ↑", "上调指令 ↑"], ["Command down ↓", "下调指令 ↓"], ["Issued command (direction unknown)", "写入指令（方向未知）"], ["no valid RAW regression", "无有效 RAW 回归"], ["EXPERIMENTAL LIVE FLOW TRIM", "杯内调流试验"], ["level", "档位"], ["checks", "检查"], ["writes", "写入"], ["streak", "连续缺失"], ["retries", "重试"], ["interval", "间隔"], ["driver ACK", "驱动 ACK"], ["target responses", "目标反馈"], ["target misses", "目标反馈缺失"], ["(after 3: slower same-target retry, auto-recover)", "（超过 3 次后降低同值重试频率，反馈恢复后自动继续）"], ["next-shot band ±8%; confirmed windows pooled with labelled seed-normalization model", "杯间容差 ±8%；汇总有效窗口，使用已标注的初始指令归一化模型"], ["No complete shot yet; brew normally.", "尚无完整杯数据；请按正常流程出杯。"], ["Next-shot decision · output error and adjustment eligibility are evaluated separately", "下一杯决策 · 输出偏差与调整资格分别判断"], ["Manual curve supersedes this shot's proposal", "手动曲线已替代此杯建议"], ["Verified and applied", "已校验应用"], ["Apply failed; previous curve retained", "应用失败，保留原曲线"], ["Adjustment proposed; awaiting verification and application", "有调整建议，等待校验应用"], ["Adjustment proposed; automatic application disabled", "有调整建议，自动应用已关闭"], ["Within algorithm tolerance; hold", "在算法容差内，保持"], ["Shot variability too high; hold instead of chasing it", "杯间差异较大，暂不自动追调"], ["Limited by pressure or actuator conditions", "受压力／执行条件限制"], ["Waiting for comparable learning evidence", "等待可比学习证据"], ["No learning evidence yet", "尚无学习证据"], ["To adjust manually, use the Next shot · Curve editor above, then apply and verify.", "若需主动调整，可使用上方“下一杯 · 曲线编辑”；修改后需应用并校验。"], ["No S1/S3 stability diagnostics available yet.", "尚无 S1／S3 稳定性诊断。"], ["S1 STARTUP", "S1 启动"], ["confidence", "置信度"], ["First cup rise:", "首次出液："], ["active avg", "出液期均值"], ["Quality:", "数据质量："], ["S3 STABILITY", "S3 稳定性"], ["EARLY 25%", "前段 25%"], ["MID 50%", "中段 50%"], ["LATE 25%", "后段 25%"], ["Stall window", "停滞窗口"], ["YES", "是"], ["none", "无"], ["LATEST SHOT · S3 FRAME MEASUREMENTS", "上一杯 · S3 分段测量"], ["The Command column is the command captured for this completed shot, not the current NEXT SHOT profile.", "指令列记录该杯启动指令，不代表当前下一杯设置。"], ["SHOT command", "该杯启动指令"], ["MEASURED RAW regression", "RAW 回归实测"], ["Window", "窗口"], ["No advisory available yet. Run a complete HyperEx shot.", "尚无参考建议；正常完成一杯 HyperEx 后生成。"], ["Confidence", "置信度"], ["Action", "动作"], ["Current cmd", "当前指令"], ["Mid ref", "中间参考值"], ["Reference Range", "参考范围"], ["Advice", "建议"], ["Range is deliberately only a partial step toward the theoretical correction. LOW confidence may still show a broad manual-test range; INSUFFICIENT never shows a numeric range.", "参考范围仅为朝理论修正值移动的一小步。低置信度可显示较宽的手动范围；证据不足时不显示数值范围。"], ["SHAPE ACTIVE ↓", "三段曲线已启用 ↓"], ["LATE DECAY", "后段衰减"], ["WAITING FOR SHOT EVIDENCE", "等待出杯证据"], ["After STEP 1 calibration is valid, run HyperEx normally. The plugin will collect completed-shot evidence and adjust only the next shot when its safety gates pass.", "步骤 1 校准有效后正常出杯；插件会积累已完成杯的证据，通过保护条件后仅调整下一杯。"], ["HOLD", "保持"], ["Source run:", "来源杯："], ["all numeric changes below apply to the", "下方所有数值修改仅用于"], ["NEXT SHOT ONLY", "下一杯"], ["Evidence", "证据"], ["LEARNING seed / fixed command", "学习初始／固定指令"], ["NEXT action / command", "下一杯动作／指令"], ["Next shot uses the manual curve.", "下一杯已采用手动曲线。"], ["Analysis below is from the old shot; it has not validated the new curve.", "以下为旧杯分析，尚未作为新曲线效果验证。"], ["RAW multi-second regression", "RAW 数秒回归"], ["LEVEL error", "总体流量误差"], ["max var", "最大变异"], ["normalized shape var", "归一化形状变异"], ["normalized SHAPE", "归一化形状"], ["Shot control review", "本杯控制诊断"], ["Controller status:", "杯内状态："], ["Tail error", "后段误差"], ["Ripple CV", "波动 CV"], ["Overshoot", "过冲"], ["writes ·", "次写入 ·"], ["ACTUAL RAW OUTPUT", "RAW 实际输出"], ["phase error", "整段误差"], ["Manual curve applied to next shot.", "手动曲线已应用到下一杯。"], ["The table retains the old-shot analysis; NEXT SHOT · APPLIED PROFILE shows current execution. Learning continues after new shots.", "上表保留旧杯算法分析；当前执行以 NEXT SHOT · APPLIED PROFILE 为准。新杯完成后继续自动学习。"], ["The table retains the old-shot analysis; NEXT SHOT · APPLIED PROFILE shows current execution. Learning continues after new shots.", "上表保留旧杯算法分析；当前执行以 下一杯 · 已应用曲线 为准。新杯完成后继续自动学习。"], ["APPLIED ✓ TO NEXT SHOT", "已校验应用 ✓ 到下一杯"], ["Readback and profile sync completed. The NEXT SHOT · APPLIED PROFILE block above is authoritative.", "读取校验及曲线同步已完成；以上方“下一杯 · 已应用曲线”为准。"], ["NOT APPLIED", "尚未应用"], ["AUTO APPLY failed safely:", "自动应用失败，已保留原设置："], ["unknown error", "未知错误"], ["Previous profile retained.", "已保留原曲线。"], ["AUTO APPLY ARMED", "自动应用已准备"], ["An actionable proposal exists; wait for successful APPLIED readback before treating it as current.", "已有可执行建议，读取校验成功后才算当前已应用设置。"], ["APPLY NEXT SHOT", "应用到下一杯"], ["AUTO APPLY is OFF.", "自动应用已关闭。"], ["NO NUMERIC CHANGE YET", "暂未修改数值"], ["the plugin keeps the current profile until the required repeated evidence agrees.", "达到重复证据一致性要求前，插件保留当前曲线。"], ["Apply the bounded NEXT SHOT adaptive suggestion?", "应用已限幅的下一杯学习建议吗？"], ["This changes only future-shot profile commands. It does NOT modify the calibration LUT and does NOT change a running shot.", "只改变之后的曲线指令，不修改校准 LUT，也不改变正在运行的杯。"], ["server did not verify the applied override", "服务器尚未验证应用结果"], ["Next-shot suggestion VERIFIED and applied.", "下一杯建议已通过校验并应用。"], ["The NEXT SHOT · APPLIED PROFILE block is authoritative.", "以“下一杯 · 已应用曲线”为准。"], ["Apply next shot failed:", "下一杯应用失败："], ["CHECKING BASELINE", "正在检查基线"], ["Checking calibration and saved empty-basket evidence.", "正在检查校准及已保存空粉碗证据。"], ["Empty-basket Step 2:", "空粉碗步骤 2："], ["empty/pre-upgrade references retained. Starting LUT and bounded commands are kept; normal coffees then refine the next-shot trajectory automatically.", "条空粉碗／升级前参考已保留。初始 LUT 及限幅指令保持，之后通过正常出杯自动改进下一杯曲线。"], ["Reading fresh workflow without repair/upload…", "正在重新读取曲线，不进行修复或上传…"], ["Read failed", "读取失败"], ["expected current profile match:", "与当前预期曲线一致："], ["latest proposal match:", "与最新建议一致："], ["no actionable proposal", "无可执行建议"], ["no attempt recorded", "尚无应用记录"], ["Upload acknowledgement is not independent DE1 memory readback.", "上传确认不等于独立读回 DE1 内存。"], ["Raw readback unavailable:", "原始读取结果不可用："], ["Auto apply state:", "自动应用状态："], ["AUTO APPLY NEXT SHOT:", "自动应用下一杯："], ["Default mode · verified actionable suggestions apply automatically.", "默认模式 · 自动应用通过校验的可执行建议。"], ["Manual mode · enter DIAG and press APPLY NEXT SHOT when a numeric suggestion is available.", "手动模式 · 有数值建议时，在诊断中点击应用到下一杯。"], ["AUTO APPLY NEXT SHOT?", "自动应用下一杯吗？"], ["Verified actionable suggestions will apply automatically after completed HyperEx shots.", "HyperEx 出杯完成后，会自动应用通过校验的可执行建议。"], ["The plugin will return to the v0.1.39 manual APPLY NEXT SHOT workflow.", "插件将恢复为手动应用下一杯建议的流程。"], ["AUTO APPLY setting failed:", "自动应用设置失败："], ["REPEAT SAME SHAPE", "保持相同形状，再观察"], ["keep the current shape unchanged until repeated evidence is consistent.", "重复证据一致前保留当前形状。"], ["from NEXT SHOT ADAPTIVE", "来自下一杯学习建议"], ["from latest LATE DECAY", "来自最新后段衰减分析"], ["S3 SHAPE OVERRIDE EDITOR", "S3 三段曲线编辑"], ["profile-time only, no extra skipStep", "仅按曲线时间推进，不增加跳步"], ["APPLIED SHAPE", "已应用三段曲线"], ["inputs below are loaded from the current applied override.", "下方输入来自当前已应用设置。"], ["inputs below are only a TEST/PROPOSED editor until APPLY TEST COMMANDS succeeds.", "手动指令应用成功前，下方输入仅为编辑草稿。"], ["EARLY cmd", "前段指令"], ["EARLY time", "前段时间"], ["MID cmd", "中段指令"], ["MID time", "中段时间"], ["LATE cmd", "后段指令"], ["DECAY COMP TEST", "衰减补偿设置"], ["Commands must be non-decreasing. Adjacent rises are bounded to ≤35% and ≤0.25 ml/s.", "指令须前段≤中段≤后段，并保留相邻增幅保护。"], ["The shape is enabled automatically only when AUTO APPLY is ON and a verified actionable adaptive suggestion passes all safety checks.", "自动应用开启，且可执行学习建议通过全部保护校验后，才会自动启用三段曲线。"], ["Target g/s", "目标 g/s"], ["Ref range", "参考范围"], ["Editor mode", "编辑模式"], ["Editor flat cmd", "平直指令草稿"], ["CURRENTLY APPLIED", "当前已应用"], ["DE1 command hard limit: 0.10–8.00 ml/s. MANUAL TEST changes only the HyperEx profile command; calibration LUT data remains untouched. If S3 DECAY COMP is enabled, its three shape commands override the flat S3 command.", "DE1 指令范围为 0.10–8.00 ml/s。手动设置仅改变 HyperEx 指令，不改校准 LUT。启用 S3 三段补偿后，其指令优先于平直设置。"], ["manual command must be 0.10–8.00 ml/s.", "手动指令必须为 0.10–8.00 ml/s。"], ["S3 shape commands must be 0.10–8.00 ml/s.", "S3 三段指令必须为 0.10–8.00 ml/s。"], ["S3 DECAY COMP commands must be non-decreasing: EARLY ≤ MID ≤ LATE.", "S3 补偿指令必须满足前段≤中段≤后段。"], ["S3 EARLY/MID times must be 3–30 seconds.", "S3 前段／中段时间必须为 3–30 秒。"], ["Apply these TEST commands to HyperEx?", "将这些手动指令应用到 HyperEx 吗？"], ["S1/S2/manual flat commands are static. S3 DECAY COMP, if enabled, advances only by profile time and adds NO plugin skipStep calls. Calibration LUT remains unchanged. Changes apply to the next normal shot only.", "S1／S2 及手动平直指令固定；启用 S3 补偿时仅按曲线时间推进，不增加跳步。校准 LUT 不变，修改仅用于下一杯正常出杯。"], ["Apply failed:", "应用失败："], ["Return S1/S2/S3 to AUTO / LUT and clear all manual test overrides, including S3 shape?", "将 S1／S2／S3 全部恢复自动／LUT，并清除包含 S3 三段曲线的手动设置吗？"], ["Reset failed:", "恢复失败："], ["DIAGNOSTICS / FLOW CAL", "诊断／流量校准"], ["STEP 1 calibrates the physical real-flow LUT. STEP 2 measures every completed shot and automatically adapts S1/S2/S3 for the next shot only. STEP 3 is manual engineering; STEP 4 exports CSV.", "步骤 1 校准实际杯流 LUT；步骤 2 测量完成的杯，并仅调整下一杯的 S1／S2／S3；步骤 3 为手动工程设置；步骤 4 导出 CSV。"], ["S1 target / RAW reg", "S1 目标／RAW 回归"], ["S2 target / RAW reg", "S2 目标／RAW 回归"], ["S3 target / RAW reg", "S3 目标／RAW 回归"], ["DE1 Flow", "DE1 流量"], ["RAW regression", "RAW 回归"], ["Status / error", "状态／误差"], ["LATEST RUN", "最近运行"], ["Latest diagnostic run is not a HyperEx shot. Run HyperEx to populate current-shot validation.", "最近的诊断记录不是 HyperEx 出杯；正常完成 HyperEx 后显示验证结果。"], ["S1/S3 stability diagnostics are generated only from a HyperEx shot.", "S1／S3 稳定性诊断仅根据 HyperEx 出杯生成。"], ["NEW INSTALL / NO PREVIOUS SHOT", "新安装／暂无上一杯"], ["Run one complete HyperEx validation shot to generate the first next-shot suggestion.", "正常完成一杯 HyperEx 后生成首次下一杯建议。"], ["Reference advice is generated only from a HyperEx shot.", "参考建议仅根据 HyperEx 出杯生成。"], ["RAW SCALE WEIGHT", "原始秤重"], ["RAW instantaneous dW/dt", "原始瞬时重量变化率"], ["Decaid weightFlow", "Decaid 杯流"], ["RUN RESULT", "运行结果"], ["COMBINED SAMPLES", "合并样本数"], ["RAW SCALE SAMPLES", "原始秤样本数"], ["LAST RUN", "上次运行"], ["none yet", "暂无"], ["Latest-shot command snapshot unavailable:", "上一杯指令快照不可用："], ["DIAG ERROR", "诊断错误"], ["WATER PREFLIGHT BLOCKED.", "水箱检查未通过。"], ["DE1 tank level is too close to/below the refill threshold.", "DE1 水位接近或低于补水阈值。"], ["Refill the tank and try again.", "请补水后重试。"], ["DE1 tank level is unavailable or stale.", "DE1 水位不可用或已过期。"], ["The plugin cannot verify tank water automatically. Continue only if you have manually checked the tank.", "插件无法自动确认水量；请人工检查水箱后再继续。"], ["DE1 tank water margin is low.", "DE1 水箱剩余水位余量较低。"], ["Continue anyway?", "仍要继续吗？"], ["EMPTY BASKET ONLY", "仅限空粉碗"], ["target/search plateaus", "目标／搜索平台"], ["Nominal DE1 commanded water:", "DE1 指令估算水量："], ["Actual-water safety stop:", "实际水量保护停止点："], ["Tare the scale, then start Espresso manually. Do not remove the vessel until Idle.", "请秤归零后手动启动萃取，进入空闲前不要移走接液容器。"], ["Continue?", "继续吗？"], ["calibration profile selected. EMPTY BASKET. Tare scale, start Espresso, and leave the vessel in place until Idle.", "已选择校准曲线。请使用空粉碗、秤归零后启动萃取，空闲前保持接液容器原位。"], ["Prepare failed:", "准备失败："], ["Sync failed:", "同步失败："], ["Suggested multiplier will be used for the NEXT calibration run. Re-run Flow Cal to create a LUT tied to that multiplier.", "建议倍率将用于下次校准。使用该倍率重新校准后生成对应 LUT。"], ["Action failed:", "操作失败："], ["This changes DE1 flowMultiplier globally for ALL profiles. The current value will be saved for Restore. After applying, run Flow Cal again. Continue?", "这会全局修改所有曲线的 DE1 流量倍率，当前值会保留供恢复。应用后需重新流量校准。继续吗？"], ["Global multiplier applied. Run Flow Cal again before using the LUT.", "全局倍率已应用；使用 LUT 前请重新流量校准。"], ["Global apply failed:", "全局应用失败："], ["Restore the DE1 flowMultiplier saved before the last global apply?", "恢复上次全局应用前保存的 DE1 流量倍率吗？"], ["Restore failed:", "恢复失败："], ["Clear the saved real-flow LUT? HyperEx will return to direct DE1 flow commands.", "清除已保存实际杯流 LUT 吗？HyperEx 将恢复为直接 DE1 流量指令。"], ["All levels: max 2000 checks per shot; continuous mode also includes S1. Write budget is separate and shown by level; retries count as writes. ACK + matching target releases waiting after at least50ms; new writes occur only at level checks with fresh scale data. Missing responses retain the2s fault timeout. After 3 consecutive ACK-without-target misses, continue checks with recoverable same-target retries spaced at least3s apart. Unconfirmed targets retry without accumulating commands. Level 1 defaults to 944 ms. Level 4 is an experimental software cap, not a proven hardware maximum. Target band ±2% (native quantization and response dynamics may prevent reaching it); bounded raw A010 changes, no extra skips. Normal shot-to-shot learning remains ON; confirmed target windows are pooled and normalized to the starting seed with a labelled local response model. Original profile restored afterwards.", "全部档位每杯最多检查 2000 次；连续模式包含 S1，三段共用预算；写入上限按档位独立计算，包含重试。收到 ACK 及匹配目标后至少等待 50ms，之后仅在档位检查点、秤数据更新时考虑写入。缺失反馈仍使用 2s 超时；连续超过 3 次缺少目标反馈后，继续检查，同值重试至少间隔 3s，恢复反馈后自动继续。未确认指令不累加。一档默认 944ms；四档是软件试验上限，未证明为硬件极限。杯流目标容差 ±2%，量化和响应动态可能使其无法达到。A010 写入限幅且不增加跳步；正常杯间学习保持有效，采用明确标注的局部归一化模型，结束后恢复原曲线。"], ["S3 early", "S3 前段"], ["S3 mid", "S3 中段"], ["S3 late", "S3 后段"], ["; S1/S2 still transition by cumulative weight; release/soak are omitted from this diagram.", "；S1、S2仍按累计重量转换，泄压和浸泡在示意图中省略。"], ["Next-shot machine-flow curve editor", "下一杯机器流量曲线编辑器"], ["Live-trim level", "杯内调流档位"], ["Manually edited curve supersedes the old-shot proposal; learning continues after the next shot", "手动曲线已替代旧杯建议，下一杯完成后继续学习"], ["Curve running or synchronizing; apply when idle", "曲线正在运行或同步，请空闲后再应用"], ["Select and verify the HyperEx profile first", "请先选择并校验 HyperEx 曲线"], ["A valid LUT is not ready", "有效 LUT 尚未就绪"], ["Next-shot parameters changed; reload the current curve before editing", "下一杯参数已改变，请重新载入当前曲线后编辑"], ["Flow commands must be within 0.10–8.00 ml/s", "流量指令必须在0.10–8.00 ml/s内"], ["S3 early/mid durations must be within 3–30s", "S3前段、中段时间必须在3–30秒内"], ["S3 requires early≤mid≤late and bounded adjacent rises", "S3需满足前段≤中段≤后段，且相邻增幅在现有保护范围内"], ["Flat S3 requires identical commands at all three points", "平直 S3 的三个指令必须一致"], ["Curve has not changed", "曲线尚未修改"], ["Selected profile changed", "所选曲线已改变"], ["Home or next-shot curve changed; reload before editing", "首页或下一杯曲线已改变，请重新载入后编辑"], ["Next-shot curve verification has not succeeded", "下一杯曲线尚未校验成功"], ["Manual curve verified and applied; learning continues after new shots", "手动曲线已校验并应用到下一杯；新杯完成后继续自动学习"], ["No reliable cup-flow window", "缺少可靠杯流量窗口"], ["Good target tracking and smoothness", "目标跟踪及平滑度良好"], ["Cup flow remains off target", "杯流量仍偏离目标"], ["Mean near target; ripple needs improvement", "均值接近目标，波动仍需改善"], ["Overlapping action group; evaluate combined outcome only", "重叠动作组，仅评价组合后的变化"], ["Before/after one action; a single observation does not prove causality", "单次动作前后变化，不能单凭一次观察确定因果"], ["Insufficient clean before/after windows; record retained", "前后有效窗口不足，保留记录"], ["Target error decreased after group", "组后目标误差减小"], ["Target error increased after group", "组后目标误差增大"], ["Little change across the group", "组前后变化较小"], ["Admitted as learning candidate; consensus and bounds still apply", "已纳入学习候选；仍经过杯间共识与限幅"], ["Not admitted yet:", "暂未纳入："], ["Original fixed-curve learning rules", "使用原固定曲线学习规则"], ["Good tail target tracking and smoothness for this shot", "本杯后段目标跟踪及平滑度良好"], ["Shot still has errors or insufficient data; see stage diagnostics", "本杯仍有偏差或数据不足，详情见阶段诊断"], ["Live trim disabled", "未开启杯内调流"], ["Automatic analysis supports daily use; overlapping actions are evaluated together. Routine screenshots/CSV are not required; export is optional for deeper troubleshooting.", "自动分析用于日常判断；动作响应重叠时评价组合效果。无需日常上传截图或CSV；异常时可选择导出深入排查。"], ["Profile synchronizing; try later", "曲线正在同步，请稍后再试"], ["Next-shot parameters changed; reload before editing", "下一杯参数已改变，请重新载入后编辑"], ["Manual parameters verified and applied; learning continues after new shots", "手动参数已校验并应用；新杯完成后继续自动学习"], ["RELEASING", "泄压中"], ["ACTIVE PRESSURE RELEASE", "主动泄压"], ["ACTIVE RELEASE", "主动泄压"], ["STATUS", "状态"], ["WAITING FOR SETTLE", "等待稳定"], ["SOAK", "浸泡"], ["WAIT — PINK LIGHT AFTER 0", "等待归零后粉红灯亮"], ["ACTIVE RELEASE COMPLETE", "主动泄压完成"], ["NEXT", "下一步"], ["WAIT FOR PINK", "等待粉红灯"], ["WAIT FOR PINK LIGHT", "等待粉红灯亮"], ["ARMING", "正在准备"], ["PINK OFF? TAP HERE", "粉红灯灭？点击此处"], ["TIME", "时间"], ["PRESS GHC", "按实体 GHC 键"], ["PINK ON", "粉红灯亮"], ["PINK OFF", "粉红灯灭"], ["TAP RE-ARM", "点击重新准备"], ["FLOW CAL", "流量校准"], ["RUNNING", "运行中"], ["READY · ADD COFFEE", "就绪 · 可以加粉"], ["EMPTY BASELINE COMPLETE", "空粉碗基线完成"], ["FLOW CAL / DIAG", "流量校准／诊断"], ["OFF", "关闭"], ["ON", "开启"], ["Off", "关闭"], ["Global", "全局"], ["GLOBAL", "全局"], ["HyperEx only", "仅 HyperEx"], ["HIT", "达标"], ["NEAR", "接近"], ["MISS", "偏离"], ["STARTUP / REPEAT", "启动阶段／继续观察"], ["STABLE", "稳定"], ["MEDIUM", "中等"], ["HIGH", "高"], ["LOW", "低"], ["INSUFFICIENT", "证据不足"], ["PENDING", "等待共识"], ["REPEAT SAME COMMAND", "保持相同指令，再观察"], ["VARIABLE / REPEAT", "杯间波动较大／继续观察"], ["REPEAT", "继续观察"], ["ADJUST", "调整"], ["LEVEL + SHAPE", "总体流量＋形状"], ["LIMITED / HOLD", "受限／保持"], ["SHAPE ADVISED", "建议调整形状"], ["TRANSIENT", "过渡阶段"], ["READY FOR COFFEE · AUTO", "可以加粉 · 自动"], ["NORMAL COFFEE · AUTO", "正常有粉出杯 · 自动"], ["STEP 2 · EMPTY BASELINE", "步骤 2 · 空粉碗基线"], ["Original fixed-command evidence path", "原固定指令证据流程"], ["confirmed-target windows normalized to shot-start seed (local model)", "已确认目标窗口归一化到启动指令（局部模型）"], ["startup 20–80%", "启动 20–80%"], ["Live learning admitted:", "杯内数据已纳入学习："], ["Live learning:", "杯内数据学习："], ["withheld:", "暂不纳入："], ["no usable RAW windows", "无可用 RAW 窗口"], ["usable", "有效时长"], ["temporal coverage", "时间覆盖率"], ["consistent-window share", "一致窗口占比"], ["RAW windows require", "RAW 窗口要求"], ["unique samples", "独立样本"], ["region(s)", "个区段"], ["across", "分布于"], ["confirmed-target windows", "已确认目标窗口"], ["response normalized to starting seed using a local proportional model", "使用局部比例模型将响应归一化到启动指令"], ["fresh machine target/frame coverage below80% or fewer than4 samples", "新鲜机器目标／帧数据覆盖率低于 80%，或不足 4 个样本"], ["pressure limiter active in at least20% of samples", "至少 20% 样本触及压力限制"], ["actual flow below70% of observed target in at least25% of samples", "至少 25% 样本中，机器实际流量低于所见目标的 70%"], ["confirmed S3 stall; withhold normalized numeric evidence", "发现 S3 停滞，暂不使用归一化数值证据"], ["fewer than6 RAW scale samples after latest tare", "最近归零后不足 6 个原始秤样本"], ["S3 confirmed-target windows total below5s", "S3 已确认目标窗口总计不足 5s"], ["Two matching S1 startup shots agree on the same error direction; apply one bounded damped step to the next shot.", "两杯可比 S1 启动证据方向一致，下一杯应用一次限幅缓和修正。"], ["One clean S1 startup shot is not enough. Repeat the same command once more.", "目前只有一杯合格 S1 启动证据；保持相同指令，从正常出杯继续积累。"], ["S2 data is not clean enough for numeric adaptation.", "S2 数据尚不足以进行数值学习。"], ["S3 segment/overall data is insufficient.", "S3 分段／整体证据不足。"], ["One clean S3 shot is not enough. Repeat the same shape once more before numeric next-shot adaptation.", "目前只有一杯合格 S3 证据；保持相同形状，从正常出杯继续积累后再做数值学习。"], ["2 matching MEDIUM-confidence startup shots", "2 杯匹配的中等置信度启动证据"], ["2 matching shots", "2 杯匹配证据"], ["deadband", "容差"], ["per next shot", "每下一杯"], ["max", "最多"], ["normal next-shot learning retained", "保留正常杯间学习"], ["shot-finished", "该杯已结束"], ["monitoring", "持续检查"], ["monitoring-degraded-target-feedback", "目标反馈缺失，低频同值重试中"], ["armed-for-S2", "等待 S2"], ["driver-ack-timeout", "驱动 ACK 超时"], ["raw-transport-failed", "原始传输断开"], ["waiting-for-write-response", "等待写入反馈"], ["minimum-write-interval", "等待最短写入间隔"], ["waiting-for-new-scale-sample", "等待新秤样本"], ["degraded-target-feedback-cooldown", "目标反馈缺失，等待重试间隔"], ["inside-2pct-band", "已在 ±2% 目标范围内"], ["pressure-or-actuator-limited", "压力或执行流量受限"], ["unconfirmed-target-direction-changed", "未确认目标的修正方向已反转，暂缓重试"], ["command-bound", "已到指令边界"], ["stage-transition", "阶段转换中"], ["frame-not-confirmed", "曲线帧未确认"], ["frame-settle", "等待当前帧稳定"], ["settling-or-stale-telemetry", "等待稳定或新鲜数据"], ["raw-regression-insufficient", "RAW 回归证据不足"], ["raw-socket-not-ready", "原始连接未就绪"], ["frame-changed-or-command-busy", "曲线帧变化或指令处理中"], ["driver-ack", "驱动 ACK"], ["machine-target-response", "机器目标反馈"], ["check", "检查"], ["write", "写入"], ["hold", "保持"], ["final60% mean", "后 60% 均值"], ["ripple CV", "波动 CV"], ["overshoot", "过冲"], ["collected", "接液量"], ["transit", "通过时间"], ["samples", "样本"], ["late/early", "后／前段比值"], ["20–80% flow", "20–80% 杯流"], ["20–80% samples", "20–80% 样本"], ["active", "出液期"], ["mean", "均值"], ["var", "变异"], ["overall", "整体"], ["LEVEL", "总体流量"], ["SHAPE", "形状"], ["APPLIED", "已应用"], ["scheduled", "已排队"], ["applying", "正在应用"], ["applied", "已应用"], ["waiting", "等待中"], ["manual-applied", "已手动应用"], ["curve-applied", "已应用手动曲线"], ["error", "错误"], ["failed", "失败"], ["true", "是"], ["false", "否"], ["maximum", "上限"], ["Enable", "开启"], ["Disable", "关闭"], ["Enable AUTO APPLY NEXT SHOT?", "开启自动应用下一杯吗？"], ["Disable AUTO APPLY NEXT SHOT?", "关闭自动应用下一杯吗？"], ["g/s while DE1", "g/s，同时 DE1 流量为"], ["auto apply:", "自动应用："], ["NEXT SHOT:", "下一杯："], ["raw scale", "原始秤数据"], ["catch vessel.", "接液容器。"], ["checking persistent history storage", "正在检查历史持久化存储"], ["Single source of truth: values are loaded from Plugins → HyperEx Pulse Filter settings.", "统一设置来源：数值来自插件 → HyperEx Pulse Filter 设置。"], ["legacy calibration map; rerun v0.1.27+ Flow Cal", "旧版校准表，需更新版本流量校准"], ["legacy v0.1.37 adaptive override ignored; run a new validation shot and apply again", "旧版 0.1.37 学习设置已忽略，后续正常出杯后再应用"], ["basket context changed; previous overrides ignored; using LUT baseline", "粉碗阶段已改变，忽略原覆盖值，使用 LUT 基线"], ["calibration LUT changed; manual test override ignored", "校准 LUT 已改变，忽略原手动覆盖值"], ["real-flow targets changed; manual test override ignored", "实际杯流目标已改变，忽略原手动覆盖值"], ["empty/pre-upgrade baseline seed; normal coffee learning", "使用空粉碗／升级前初始基线，继续正常有粉学习"], ["stored S3 shape rejected:", "已保存 S3 形状被拒绝："], ["non-finite value", "存在非有限数值"], ["command outside hard limits", "指令超出硬边界"], ["timing outside 3–30 s", "时间超出 3–30s"], ["commands must be non-decreasing", "指令必须单调不减"], ["adjacent rise exceeds test bound", "相邻增幅超出限制"], ["Could not read DE1 flowMultiplier:", "无法读取 DE1 流量倍率："], ["Fresh DE1 flowMultiplier readback unavailable", "无法重新读取 DE1 流量倍率"], ["selection left scope during multiplier update", "倍率更新时所选曲线已离开作用范围"], ["Could not restore previous flowMultiplier", "无法恢复原流量倍率"], ["S1 startup trajectory is not long/clean enough for a numeric test range. Keep the current command and repeat.", "S1 启动轨迹时长或质量不足以给出数值范围；保持当前指令继续观察。"], ["S1 whole-phase regression is startup-sensitive; the 20–80% trajectory is still insufficient for a numeric adjustment.", "S1 整段回归受启动影响较大，20–80% 轨迹仍不足以支持数值调整。"], ["% of target. Keep the current command; startup delay is reported separately.", "% 目标范围内。保持当前指令；启动延迟单独报告。"], ["S1 command is indicated by the startup 20–80% trajectory. This range is intentionally small; first-rise delay is not treated as flow error.", "S1 指令参考启动 20–80% 轨迹。范围有意较小，首次出液延迟不视为流量误差。"], ["Not enough usable RAW weight-regression data; keep the current command and repeat an empty-basket validation.", "有效 RAW 秤重回归证据不足；保持当前指令，继续空粉碗验证。"], ["Regression exists but target error could not be evaluated.", "存在回归，但无法评价目标误差。"], ["LOW-FLOW STALL SUSPECTED: machine flow stayed active while a", "疑似低流量停滞：机器仍有流量，但"], ["g/s. Try a modestly higher static S3 command and repeat; do not rewrite the LUT from one stall run.", "g/s。可适度提高 S3 固定指令继续观察，不要根据一次停滞改写 LUT。"], ["S3 whole-phase average can hide late decay: LATE/EARLY=", "S3 整段均值可能掩盖后段衰减：后／前段比值="], ["Prefer the NEXT SHOT adaptive-shape suggestion over a flat static correction.", "优先参考下一杯三段形状建议。"], ["Regression quality/window is insufficient; keep the current LUT command and repeat the empty-basket validation.", "回归质量或窗口不足；保持当前 LUT 指令，继续空粉碗验证。"], ["Data confidence is low, so repeat once before treating this as confirmed.", "数据置信度低，需进一步证据确认。"], ["% of target; keep the current command.", "% 目标范围内，保持当前指令。"], ["A regression exists, but the command used by this shot is unavailable. Repeat before changing anything.", "存在回归，但无法确认该杯所用指令；暂不修改。"], ["LOW confidence · manual test only; repeat the empty-basket run before treating the result as calibration.", "低置信度 · 仅供手动参考，不能直接作为校准结果。"], ["confidence · still a manual test range, not an automatic correction.", "置信度 · 仍为手动参考范围，不自动修正。"], ["S1 is startup-transient, so its range is intentionally narrower.", "S1 属启动过渡阶段，因此参考范围更窄。"], ["Actual observed target/pressure quality passed", "实际所见目标及压力质量通过"], ["Coffee actuator evidence missing; keep command", "缺少有粉执行证据，保持指令"], ["Coffee machine telemetry/frame coverage insufficient; keep command", "有粉机器数据／帧覆盖不足，保持指令"], ["Pressure limiter may be active; cup-flow target may be unreachable. Keep command, do not increase pressure", "可能触及压力限制，杯流目标或暂不可达；保持指令，不提高压力"], ["Machine flow is not tracking the shot command; withhold numeric correction", "机器流量未跟随该杯指令，暂不做数值修正"], ["Coffee pressure and actuator quality gates passed", "有粉压力及执行质量条件通过"], ["STALL RECOVERY: clean EARLY/MID + confirmed late stall", "停滞恢复：前／中段数据有效，且后段停滞已确认"], ["live target-normalized frame windows", "杯内目标归一化分帧窗口"], ["live target-normalized stability windows", "杯内目标归一化稳定窗口"], ["Run Step 1 with an empty locked-in basket to save the original LUT.", "在步骤 1 锁好空粉碗运行校准，保存原始 LUT。"], ["Continue normal coffees; the retained empty baseline is refined from completed coffee evidence.", "继续正常有粉出杯，使用完成杯的证据改进已保留空粉碗基线。"], ["Wait for the pending next-shot decision and verified application. Do not start an extra test cup.", "等待下一杯决策及应用校验，不必额外开一杯测试。"], ["Waiting for verified workflow and history readback; do not add test cups while checks are pending.", "等待曲线及历史读取校验，检查期间不必增加测试杯。"], ["Automatic application failed. Read the raw workflow/error and fix it; do not add empty-basket cups.", "自动应用失败。请查看原始曲线／错误并处理，不必增加空粉碗测试杯。"], ["Two clean stable empty-basket shots are sufficient. You can fill the basket and brew normally; no further empty-basket tuning.", "已有两杯有效稳定空粉碗证据，可以加粉正常冲煮，无需继续空粉碗调试。"], ["Empty-basket tuning has reached its 3-shot limit. Preserve this baseline and begin coffee use; at most one dedicated filled-basket acceptance shot.", "空粉碗调试已达 3 杯上限，保留基线并开始有粉冲煮；专门有粉验收最多一杯。"], ["The 3-shot limit is reached but data/stall checks need attention. Stop empty-basket tests and inspect existing diagnostics.", "已达 3 杯上限，但数据／停滞检查仍需关注；停止增加空粉碗测试，检查现有诊断。"], ["Run Step 2 with an empty basket. The plugin refines the next-shot command mapping while preserving the original LUT. It will prompt you automatically after 2–3 shots.", "步骤 2 使用空粉碗运行，插件保留原 LUT 并改进下一杯指令映射；2–3 杯后自动提示进入有粉冲煮。"], ["feed-forward prior; not a matching coffee consensus shot", "前馈参考，不是匹配的有粉共识杯"], ["Retain LUT, validated command baseline and historical cup-response reference. Coffee backpressure changes the response; numeric coffee updates require new coffee evidence and actuator/pressure quality.", "保留 LUT、已验证指令基线及历史杯流参考。有粉背压会改变响应；数值更新需要新的有粉证据及执行／压力质量。"], ["Persistent adaptive history unavailable. Shot-to-shot adaptation remains active for this plugin session, but cross-reload/version history is disabled.", "学习历史持久化不可用；本次会话仍可杯间学习，但不跨重新载入或版本保存。"], ["checking pluginStorage write/readback", "正在检查插件存储写入／读回"], ["history file write/read request failed", "历史文件写入／读取请求失败"], ["Adaptive evidence excluded: workflow profile truth was not verified at shot start (", "该杯未纳入学习：启动时曲线真实性尚未校验（"], ["data is not clean enough for numeric adaptation.", "数据不足以支持数值学习。"], ["shot is not enough. Repeat the same command once more.", "杯证据不足，保持相同指令继续观察。"], ["%; keep the same command rather than chasing shot variability.", "%；保持相同指令，避免追逐杯间波动。"], ["Both matching shots are inside the", "两杯匹配证据均处于"], ["The two matching shots do not show the same out-of-band direction; keep the command and collect another shot.", "两杯匹配证据的超差方向不一致，保持指令，从后续出杯继续积累。"], ["Consensus error is too small to justify a command change.", "共识误差较小，不足以调整指令。"], ["shots agree on the same error direction; apply one bounded damped step to the next shot.", "杯证据的误差方向一致，下一杯应用一次限幅缓和修正。"], ["Absolute frame levels vary, but normalized decay agrees in two matching shots. Apply a small next-shot shape correction with LEVEL held. Weighted command exposure is preserved; cup flow still requires validation.", "绝对分段流量有波动，但两杯归一化衰减一致。保持总体流量，下一杯小幅修正形状；保持加权指令量，实际杯流仍待验证。"], ["Not enough S1 RAW scale samples or collected gain.", "S1 原始秤样本或接液增量不足。"], ["2 matching high-quality shots; ±8% HIT deadband; max ±5% and ±0.10 ml/s per next shot", "两杯匹配高质量证据；±8% 容差；下一杯最多调整 ±5% 且 ±0.10 ml/s"], ["2 matching shots; LEVEL and SHAPE are solved separately", "两杯匹配证据，总体流量及形状分别求解"], ["stall recovery requires 2 same-shape shots that both show late weakness", "停滞恢复需要两杯相同形状、且都显示后段偏弱的证据"], ["A confirmed stall exists, but the matching shot does not confirm the same late-weakness pattern. Keep the current profile and repeat rather than chase one stall.", "存在已确认停滞，但另一杯未确认相同后段偏弱模式；保持当前曲线，避免追逐单次停滞。"], ["Two matching S3 shots confirm late weakness and at least one has a dedicated low-flow stall. Apply one conservative next-shot recovery step: LEVEL rises only if both overall flows are low, while normalized SHAPE shifts command toward LATE.", "两杯匹配 S3 均确认后段偏弱，至少一杯有低流量停滞；下一杯做保守恢复，仅两杯整体流量都低时上调总体流量，并把形状指令偏向后段。"], ["Repeated stall evidence was confirmed but the bounded recovery step is too small to justify a profile rewrite.", "重复停滞证据已确认，但限幅恢复值太小，暂不改写曲线。"], ["The repeated S3 response is too variable. Keep the same shape and repeat instead of chasing the latest shot.", "重复 S3 响应波动较大，保持相同形状，避免追逐最新单杯。"], ["S3 overall LEVEL and EARLY/MID/LATE SHAPE were solved separately, then combined into one bounded next-shot profile.", "分别求解 S3 总体流量与前／中／后形状，再组合为限幅的下一杯曲线。"], ["S3 consensus is inside the overall deadband and shape imbalance is too small to justify a change.", "S3 共识处于整体容差内，形状不平衡较小，暂不调整。"], ["Experimental live trim ran in this shot. This table proposes NEXT-SHOT changes only; normalized response is a local model. Actual RAW tracking metrics remain separate; LUT unchanged.", "该杯使用过杯内调流。本表仅建议修改下一杯；归一化响应为局部模型，实际 RAW 跟踪指标单独保留，LUT 不变。"], ["All three stages use completed-shot evidence only. No running-shot scale control, no extra skipStep calls, and the calibration LUT is never rewritten.", "三个阶段均使用已完成杯证据；此杯间流程不做杯内秤控，不增加跳步，也不改写校准 LUT。"], ["Next-shot adaptation can only be applied while HyperEx is idle", "仅可在 HyperEx 空闲时应用下一杯学习建议"], ["No actionable bounded next-shot suggestion is available from the latest HyperEx run", "最新 HyperEx 记录暂无可执行的限幅下一杯建议"], ["adaptive override readback rejected:", "学习覆盖值读回被拒绝："], ["adaptive readback mismatch: expected", "学习值读回不一致，预期"], ["adaptive shape readback mismatch:", "学习形状读回不一致："], ["profile verification failed: effective mode is", "曲线验证失败，当前模式为"], ["No actionable suggestion; current settings retained", "无可执行建议，保留当前设置"], ["Applying proposal; awaiting workflow readback and machine upload acknowledgement", "正在应用建议，等待曲线读回及机器上传确认"], ["Verified next-shot adaptive override applied automatically", "下一杯学习设置已校验并自动应用"], ["flowMultiplier changed; fresh verification required", "流量倍率改变，需要重新读取校验"], ["home temperature changed during synchronization", "同步期间首页温度发生变化"], ["Profile sync blocked while shot or calibration is active", "出杯或校准期间禁止曲线同步"], ["Workflow selection changed during verification", "校验期间所选曲线发生变化"], ["Expected profile changed during verification; retry required", "校验期间预期曲线发生变化，需要重试"], ["Profile writes blocked during an active shot", "出杯期间禁止写入曲线"], ["waiting for fresh workflow readback", "等待读取最新曲线"], ["Shot began during profile verification", "曲线校验期间开始了出杯"], ["checking fresh workflow / multiplier readback", "正在读取最新曲线／倍率"], ["Waiting for stored calibration and overrides / multiplier scope / history context", "等待已存校准、手动设置、倍率作用域及历史阶段"], ["Scoped multiplier change still pending", "限定作用域的倍率调整尚未完成"], ["Valid LUT and matching actual multiplier required before arming", "准备前需要有效 LUT 及匹配的实际倍率"], ["GET /workflow no longer selects HyperEx", "读取结果已不再选择 HyperEx 曲线"], ["Final GET /workflow does not match expected LUT/adaptive profile", "最终读取曲线与预期 LUT／学习曲线不一致"], ["Multiplier or machine upload acknowledgement changed during verification", "校验期间倍率或机器上传确认发生变化"], ["GET /workflow verified; machine upload acknowledged (", "曲线读取校验通过，机器上传已确认（"], ["Cannot determine current DE1 flowMultiplier", "无法确认当前 DE1 流量倍率"], ["Live DE1 tank level is unavailable or stale. Manually verify the tank before calibration.", "DE1 实时水位不可用或过期，请在校准前人工确认水箱。"], ["Refill the tank before calibration.", "校准前请补水。"], ["Tank is above the DE1 refill threshold but the remaining height margin is only", "水箱高于补水阈值，但水位余量仅为"], ["anchor commands are not strictly increasing", "校准锚点指令不严格递增"], ["Experimental raw frame changed; restoring original profile before next shot", "杯内试验改过原始帧，下一杯前正在恢复原曲线"], ["Completed shot queued for next-shot evaluation", "已完成杯已排队进行下一杯分析"], ["New shot started before pending adaptation; current shot commands retained", "学习应用前已开始新杯，保留该杯当前指令"], ["Startup quality gates passed", "启动数据质量条件通过"], ["monitoring-target-feedback-miss-", "目标反馈缺失，继续检查："], ["-check-budget-complete", "次检查预算已用完"], ["-write-budget", "次写入预算已用完"], ["setup-failed:", "初始化失败："], ["write-failed:", "写入失败："], ["confirmed", "已确认"], ["repeat", "继续观察"], ["Early section", "前"], ["s → Mid", "s → 中"], ["s → Late until end", "s → 后段至结束"], ["times", "次"], ["Ripple CV", "波动CV"], ["Issued writes", "写入"], ["actual RAW g/s; rolling regressions over final60% of phase, separate from normalized learning model", "实际 RAW 杯流 g/s；使用阶段后 60% 的滚动回归，与归一化学习模型分别显示"], ["target-normalized local model", "目标归一化局部模型"], ["20–80% startup trajectory", "启动 20–80% 轨迹"], ["REFERENCE RANGE", "参考范围"], ["A higher command is indicated.", "建议参考较高指令。"], ["A lower command is indicated.", "建议参考较低指令。"], ["SHOT-TO-SHOT ONLY", "仅用于杯间调整"], ["Two matching S1", "两杯匹配 S1"], ["Two matching S2", "两杯匹配 S2"], ["2 matching shots; LEVEL uses overall S3; SHAPE is normalized to ~zero weighted level change; each frame max ±7% and ±0.05 ml/s", "两杯匹配证据；总体流量使用 S3 整段结果，形状归一化后保持加权总体流量近似不变；每帧最多 ±7% 且 ±0.05 ml/s"], ["SHAPE ONLY: 2 same-basis clean decay shots; normalized variation ≤15%, overall variation ≤20%; LEVEL held; each frame ≤4% and 0.05 ml/s; weighted command exposure within 0.2%", "仅调形状：两杯相同依据的有效衰减证据；归一化变异 ≤15%，整体变异 ≤20%；总体流量保持；每帧 ≤4% 且 0.05 ml/s；加权指令量变化在 0.2% 内"], ["STALL RECOVERY requires 2 same-shape late-weak shots with ≥1 confirmed stall; LEVEL max +4%; each frame max ±7% and ±0.05 ml/s", "停滞恢复需要两杯相同形状且后段偏弱的证据，至少一杯确认停滞；总体流量最多 +4%，每帧最多 ±7% 且 ±0.05 ml/s"], ["2 matching MEDIUM-confidence startup shots; ±8% deadband; max ±4% and ±0.04 ml/s per next shot", "两杯匹配中等置信度启动证据；±8% 容差；下一杯最多 ±4% 且 ±0.04 ml/s"], ["EXPERIMENTAL S2/S3 LIVE FLOW TRIM · DEFAULT ON / LEVEL 3", "S2／S3 杯内调流试验 · 默认开启／三档"], [". Live flow trim is enabled by default at level 3; its independent switch and diagnostics are below. Shot-to-shot proposals still affect only future shots. No extra skipStep calls.", "。杯内调流默认开启三档，独立开关及诊断见下方；杯间建议仍仅作用于下一杯，不增加跳步。"], ["AUTO APPLY", "自动应用"], ["STEP 1", "步骤 1"], ["STEP 2", "步骤 2"], ["STEP 3", "步骤 3"], ["STEP 4", "步骤 4"], ["History checked:", "已检查历史："], ["missing stage:", "缺少该阶段证据："], ["context mismatch:", "上下文不兼容："], ["command mismatch:", "指令不匹配："], ["storage excluded:", "存储未校验："], ["matched run:", "匹配来源杯："], ["Learning history · Exclude / restore shots", "学习历史 · 排除／恢复杯次"], ["Exclude known operator mistakes or plugin faults from future learning. Original records, LUT and already-applied settings are retained. Restore removes only your exclusion; automatic fault and stage-quality gates still apply. Legacy records without raw fault evidence cannot be fully audited automatically.", "将明确误操作或插件异常的杯次排除在之后学习之外，保留原记录、LUT 及已应用设置。恢复仅撤销人工排除，仍须通过自动异常与阶段质量检查。缺少原始异常证据的旧记录无法完全自动审核。"], ["Shot / time", "杯次／时间"], ["Learning status", "学习状态"], ["Stage evidence", "阶段证据"], ["Reason", "原因"], ["Shot", "杯次"], ["Operator mistake", "操作失误"], ["Plugin fault", "插件异常"], ["Scale / cup disturbed", "秤／容器受干扰"], ["Other", "其他"], ["Exclude from learning", "不参与学习"], ["Restore automatic eligibility", "恢复自动判定"], ["History save awaiting readback verification", "历史保存等待读回校验"], ["History storage verified", "历史存储已校验"], ["History is read-only until idle and storage is verified", "空闲且历史存储校验通过后才可编辑"], ["History review failed:", "历史标记失败："], ["Shot excluded from learning by user", "本杯已由用户标记为不参与学习"], ["Shot excluded from learning automatically", "本杯已因明确异常自动排除学习"], ["No confirmed execution/scale fault; stage quality and consensus gates still apply.", "未发现明确执行／秤重异常；仍须通过阶段质量与共识检查。"], ["Shot excluded from learning; see history review.", "本杯不参与学习，原因见历史审核。"], ["History review requires idle state", "请在空闲状态下标记历史"], ["History storage is not verified", "历史存储尚未校验"], ["Invalid history review", "无效历史标记"], ["History record not found", "未找到该历史杯次"], ["Select an exclusion reason", "请选择排除原因"], ["History exclusion applied in this session; persistent save unavailable", "本次会话已排除该杯，但持久化保存不可用"], ["Shot excluded from learning", "本杯已排除学习"], ["No confirmed fault", "未发现明确异常"], ["manual-excluded", "人工排除"], ["auto-excluded", "自动排除"], ["no-confirmed-fault", "无明确异常"], ["legacy-limited-audit", "旧记录，审核信息有限"], ["not-completed", "未正常完成"], ["unverified-profile", "启动曲线未通过校验"], ["execution-fault", "执行异常"], ["extra-skip-commands", "跳步指令超过正常次数"], ["scale-drop-during-extraction", "萃取期间秤重异常下降"], ["scale-jump-during-extraction", "萃取期间秤重异常跳增"], ["missing-record", "缺少记录"], ["missing-run", "缺少杯次"], ["operator-mistake", "操作失误"], ["plugin-fault", "插件异常"], ["scale-or-cup-disturbance", "秤／容器干扰"], ["other", "其他"], ["excluded", "已排除"], ["S2 startup response", "S2 起步响应"], ["Response delay:", "响应延迟："], ["20–80% rise:", "20–80% 爬升："], ["Tail error:", "后段偏差："], ["Next startup:", "下杯起步策略："], ["Executed startup boost:", "本杯已执行起步补偿："], ["S2 startup data insufficient", "S2 起步数据不足"], ["S2 startup scale discontinuity", "S2 起步秤数据不连续"], ["S2 startup onset samples missing", "S2 起步初始采样缺失"], ["S2 startup pressure or actuator headroom insufficient", "S2 起步压力或执行余量不足"], ["S2 baseline off target; learn level before startup boost", "S2 基础流量偏离目标；先学习整段流量，再判断起步补偿"], ["S2 tail ripple too high for startup boost", "S2 后段波动过大，暂不增加起步补偿"], ["S2 overshoot; startup boost withheld", "S2 有过冲，暂不增加起步补偿"], ["S2 rise crossings incomplete", "S2 未取得完整的 20–80% 爬升过程"], ["S2 startup shape eligible", "S2 起步曲线符合学习条件"], ["S2 startup integrity check failed", "S2 起步完整性检查未通过"], ["S2 startup needs two comparable clean shots", "S2 起步需要两杯可比的合格证据"], ["S2 startup assist disabled", "S2 起步补偿已关闭"], ["S2 startup history not verified", "S2 起步历史存储尚未校验"], ["S2 startup history context invalid", "S2 起步历史条件不匹配"], ["S2 latest comparable responses do not justify a startup boost", "S2 最近可比曲线不支持增加起步补偿"], ["S2 startup rise varies across shots", "S2 杯间爬升时间差异较大"], ["S2 native quantum exceeds startup boost bound", "S2 最小原生流量档位超过起步补偿范围"], ["S2 prior startup boost improved rise without excess ripple or overshoot", "S2 上次起步补偿缩短了爬升，且波动与过冲未超限"], ["S2 startup boost benefit not demonstrated; return to baseline", "S2 起步补偿未体现足够改善；恢复基础起步"], ["S2 two clean slow-rise shots; one-quantum bounded startup boost", "S2 两杯合格证据均爬升偏慢；启用一档限幅起步补偿"], ["S2 startup bounded pulse or base-return confirmation", "S2 限时起步补偿或基础指令回落确认中"], ["S2 startup boost", "S2 起步补偿"], ["S2 startup response settling", "等待 S2 起步响应稳定"], ["S2 startup base return driver ACK missing", "S2 回落基础指令缺少驱动确认"], ["S2 startup base retry driver ACK missing", "S2 重发基础指令缺少驱动确认"], ["S2 startup raw transport failed", "S2 起步驱动连接中断"], ["S2 startup return write failed", "S2 起步回落指令写入失败"], ["Startup dispatch guards not satisfied in time", "起步时间窗内未满足执行条件，保留正常基础指令"], ["monitoring-degraded-startup-base-feedback", "基础目标回读缺失，降级监测中"], ["windowed RAW source-time regression", "按原始秤时间戳计算的窗口回归"], ["Active release: ON · Release / soak / restart", "主动泄压：开 · 泄压／浸泡／重启"], ["Active release: OFF · Continuous S1 → S2 → S3", "主动泄压：关 · 连续萃取 S1 → S2 → S3"], ["Active pressure release", "主动泄压"], ["Active release", "主动泄压模式"], ["Continuous extraction", "连续萃取模式"], ["ON: release, soak and GHC restart. OFF: one continuous S1 → S2 → S3 extraction. Learning and command overrides are separate for each mode. Change only while idle.", "打开：泄压、浸泡并通过 GHC 重启；关闭：一次连续运行 S1 → S2 → S3。两种模式分别学习并保存指令。仅在空闲时切换。"], ["Change settings only while idle", "请在空闲时修改设置"], ["Settings availability check failed", "设置可修改状态检查失败"], ["Brew mode differs; separate command history is used", "萃取模式不同；使用各自独立的指令记录"], ["S1 startup observed-target exposure local model", "S1 起步实际目标流量积分归一化模型"], ["S1 corrected startup quality insufficient", "S1 杯内修正后的起步数据质量不足"], ["S1 corrected startup target or actuator coverage insufficient", "S1 杯内修正后的目标反馈或执行数据不足"], ["S1 corrected startup source gap", "S1 杯内修正后的原始秤时间戳不连续"], ["S1 corrected startup needs eight unique samples over0.9s", "S1 杯内修正后的起步学习需至少 8 个独立采样，覆盖 0.9 秒"], ["S1 corrected startup model fit insufficient", "S1 杯内修正后的起步模型拟合不足"], ["S1 corrected startup admitted using observed target exposure", "S1 杯内修正后的起步证据已按实际目标流量积分归一化纳入学习"], ["S2 startup preceding S1 trajectories differ", "S2 起步之前的 S1 调流轨迹不同，暂不增加起步补偿"], ["S1 and S2 transition by cumulative weight; see the header for brew mode.", "S1、S2按累计重量转换；流程模式见顶栏。"], ["Active release mode · Weight-driven stage progression.", "主动泄压模式 · 按重量进入下一阶段。"], ["Continuous extraction · No intermediate release or restart.", "连续萃取 · 中途不泄压或重启。"], ["armed-for-S1", "已准备 S1 杯内调流"], ["ORIGINAL / LUT", "原始 LUT"], ["ADAPTIVE", "算法学习"], ["MANUAL", "用户手动"], ["RETAINED / UNKNOWN", "沿用值／旧来源未记录"], ["ORIGINAL / LUT is the calibration baseline. ADAPTIVE is learned by the plugin. MANUAL is explicitly edited by the user.", "原始 LUT 为校准基线；算法学习为插件自动调整；用户手动为用户明确编辑。"], ["Shot-to-shot learning strength", "杯间学习强度"], ["Normal: one clean shot can adjust the next. Different historical responses damp the step instead of blocking it. Live-trim level is a separate setting.", "正常档：一杯合格证据即可调整下一杯。历史响应不同时减小步幅，不强制阻止学习。杯内控流档位另行设置。"], ["Conservative", "保守"], ["Gentle", "温和"], ["Normal", "正常"], ["Aggressive", "激进"], ["Learning strength:", "学习强度："], ["History persistence", "历史落盘回读"], ["History session only; persistent save not verified", "当前仅会话记录，持久化保存未校验"], ["Current shot history readback verified", "本杯记录已保存并读回校验"], ["Current shot history awaiting readback", "本杯记录等待读回校验"], ["Current shot history not saved yet", "本杯记录尚未进入历史"], ["records", "条记录"], ["bytes", "字节"], ["Rise basis:", "爬升参考："], ["observed plateau", "实测平台流速"], ["nearby-command local proportional model", "邻近指令局部比例参考模型"], ["per-frame command and timing reference model", "分段指令与时长参考模型"], ["cross-window historical reference", "不同窗口的历史参考"], ["basis mismatch:", "测量依据不同："], ["nearby command comparisons:", "动态指令参考："], ["Response outside numeric learning envelope; inspect output and execution", "响应超出数值学习范围，请检查出液和执行状态"], ["Current clean output is inside the learning band; retain this command", "本杯合格出液已在学习容差内，保留当前指令"], ["Current clean shot requests a bounded correction; differing history reduces the step instead of blocking learning", "本杯合格证据触发限幅纠偏；历史响应不同时缩小步幅，不阻断学习"], ["Current clean shot requests a bounded next-shot correction; comparable history is a reference, not a mandatory identical-command repeat", "本杯合格证据触发下一杯限幅纠偏；历史用于参考，不要求指令完全相同后再重做一杯"], ["Current clean S3 frame responses request a bounded next-shot level and shape correction; history adjusts confidence and damping", "本杯合格 S3 分段响应触发下一杯水平与形状限幅纠偏；历史用于调整置信度和步幅"], ["Current S3 frame responses are inside the learning band; retain the shape", "本杯 S3 分段响应在学习容差内，保留曲线形状"], ["S3 proposed shape cannot satisfy the selected learning bounds", "S3 建议曲线无法同时满足所选档位限幅"], ["S2 startup needs usable slow-rise evidence", "S2 起步需要有效的慢爬升证据"], ["S2 plateau outside startup-assist range", "S2 平台流量超出起步补偿适用范围"], ["S2 rise is already steep enough; hold startup baseline", "S2 爬升已足够陡，保留基础起步"], ["S2 startup needs a second comparable slow-rise shot", "当前档位的 S2 起步补偿还需一杯可比的慢爬升证据"], ["S2 clean slow rise; learning policy permits bounded single-shot startup trial", "S2 合格曲线爬升偏慢，当前学习档位允许限幅单杯起步试调"], ["S2 startup blocked by an existing pending or issued S2 command", "S2 已有待确认或已发送指令，跳过额外起步补偿"], ["S2 startup return budget unavailable", "S2 起步回落所需预算不足"], ["S2 startup dispatch window elapsed", "S2 起步发送时间窗已结束"], ["S2 startup scale data stale", "S2 起步秤数据已过期"], ["S2 startup pressure headroom unavailable", "S2 起步压力余量不足"], ["S2 startup waiting for actual baseline target and actuator response", "S2 起步等待基础目标与实际执行响应"], ["S2 startup cup flow already high; skip late boost", "S2 杯流量已较高，跳过迟到的起步补偿"], ["S2 startup transport or fresh machine feedback unavailable", "S2 起步连接或新鲜机器反馈未就绪"], ["S2 startup returning to baseline", "S2 起步指令回落基础值"], ["not-planned", "本杯未计划起步补偿"], ["armed", "已准备"], ["issued", "已发送"], ["returning", "回落中"], ["skipped", "已跳过"], ["S2 settled-tail RAW regression", "S2 稳定后段原始秤回归"], ["step ≤", "步幅不超过"], ["band;", "容差；"], ["ml/s per frame; original shape bounds retained", "ml/s／段；保留原曲线形状限制"], ["Admission width:", "学习准入范围："], ["all stages ORIGINAL / LUT", "所有阶段使用原始 LUT"], ["MANUAL changes only the HyperEx profile command; calibration LUT data remains untouched. If S3 DECAY COMP is enabled, its three shape commands override the flat S3 command.", "用户手动仅更改 HyperEx 曲线指令，不改动校准 LUT。启用 S3 三段补偿后，三段指令覆盖平直 S3 指令。"], ["Selected learning policy requires another clean observation; changed commands remain eligible historical references", "当前学习档位还需一杯合格证据；指令改变不影响历史作为参考"], ["Selected learning policy requires another comparable S3 observation; command and timing changes remain usable", "当前学习档位还需一杯可比 S3 证据；指令和时长微调后的历史仍可参考"], ["collected gain <", "杯增重低于"], ["20–80% transit <", "20–80% 经过时间低于"], ["20–80% samples <", "20–80% 采样数低于"], ["active duration <", "有效出液时长低于"], ["20–80% regression R² <", "20–80% 回归 R² 低于"], ["S2 tail ripple", "S2 后段波动"], ["exceeds", "超过"], ["learning limit", "学习准入上限"], ["Live learning: S3 confirmed-target windows total below", "杯内学习：S3 已确认目标窗口总时长低于"], ["step", "步幅"], ["band", "容差"], ["per frame", "每段"], ["original shape bounds retained", "保留原曲线形状限制"], ["S3 shape advances by profile time only.", "S3 三段仅按曲线时间自然转换。"], ["S2 refill assist disabled", "S2 补水增强已关闭"], ["S2 refill base command invalid", "S2 补水基础指令无效"], ["S2 refill has no command headroom", "S2 补水指令没有可用余量"], ["S2 active-release refill; return at predicted 85% cup flow or safety deadline", "S2 主动泄压后补水；预测接近85%称流速或到达保护时限即收回"], ["S2 refill pressure margin reached", "S2 补水达到压力余量边界，收回增强"], ["S2 refill maximum duration reached", "S2 补水达到最长时限，收回增强"], ["S2 refill scale became stale", "S2 补水秤数据过期，收回增强"], ["S2 refill reached 85% cup flow", "S2 补水已达到目标称流速85%，收回增强"], ["S2 refill predicted 85% cup flow; return early", "S2 预测即将达到目标称流速85%，提前收回增强"], ["S2 startup baseline return confirmed", "S2 已确认恢复基础流量"], ["S2 startup waiting for confirmed frame 1", "S2 等待确认已进入第1帧"], ["S2 startup base profile changed", "S2 基础曲线指令发生变化，暂不增强"], ["S2 cup flow already at 85%; refill unnecessary", "S2 称流速已达85%，无需补水增强"], ["S2 refill driver ACK missing", "S2 补水驱动确认缺失"], ["S2 refill base return driver ACK missing", "S2 恢复基础值的驱动确认缺失"], ["S2 startup maximum duration reached", "S2 启动增强达到最长时限，恢复基础值"], ["S2 approach upward-write spacing", "S2 渐进阶段等待下一次上调，继续检查"], ["S2 approach rising response; hold for inertia", "S2 流速正在上升，等待惯性响应"], ["S2 refill base return unconfirmed; retain actual curve but withhold steady-level learning", "S2 补水后的基础值恢复尚未确认；保留实测曲线，暂不纳入稳态数值学习"], ["S2 frame ended; no write to previous frame", "S2 阶段已结束，不再写入上一帧"], ["85% cutoff", "85%称流速收回"], ["S2 startup waiting for fresh frame telemetry", "S2 等待新鲜的机器帧号反馈"], ["S2 refill aims at 120% real flow; return at measured 85% cup flow or safety deadline", "S2 以120%目标称流速估算补水；实测达到85%或保护时限时收回"], ["LUT-relative 120% real-flow target", "基于LUT相对换算的120%称流速目标"], ["bounded local proportional 120% target", "有界局部比例估算的120%称流速目标"], ["actual-tail and corroborated machine-flow local model", "基于实测尾段及机器流量佐证的局部模型"], ["Actual RAW tail disagrees with modeled correction; opposite-direction changes withheld", "实测RAW尾段与模型调整方向冲突，已阻止反向修正"], ["Bounded projection retains the current commands", "限幅投影后保持当前指令"], ["FLAT (3 timed frames)", "平直（三段计时）"], ["Actual output and model disagree; hold", "实测与模型方向冲突，保持"], ["Keep current commands", "保持当前指令"], ["S3 command timeline", "S3 指令变化时间线"], ["Earliest retained flat evidence:", "现存历史中最早的平直指令证据："], ["No verified flat command in retained history", "现存历史中没有已校验的平直指令"], ["Retained history only; missing older records cannot establish the first-ever change. Suggestions are not verified applications.", "仅依据现存历史；更早记录缺失时不能认定首次修改时间。建议不等于已校验应用。"], ["Verified next-shot application", "已校验的下一杯应用"], ["Shot-start snapshot", "启动指令快照"], ["Origin / shape", "来源／形态"], ["3 timed frames", "三段计时"], ["Excluded from learning", "已排除学习"], ["S2 early refill", "S2 提前补水"], ["Start delay", "启动延时"], ["Refill target", "补水目标"], ["Cup-flow cutoff", "称流速收回阈值"], ["Maximum refill duration", "最长补水"], ["Approach100% duration", "渐进至100%时间"], ["Reset refill defaults", "恢复补水默认值"], ["Delay starts at confirmed S2 entry. Sliders edit the draft; apply it to the next shot to take effect.", "启动延时从确认进入S2后计；滑块只修改草稿；请点击保存补水参数，下一杯生效。"], ["Refill enabled", "补水已启用"], ["Refill inactive: enable active release, live trim and S2 startup assist", "当前不执行补水：需开启主动泄压、杯内控流和S2起步增强"], ["S2 refill command preview", "S2补水指令预览"], ["At", "达到"], ["cup flow, refill can end earlier; maximum duration shown", "称流速可提前收回；图示为最长时限"], ["Estimated refill target", "估算补水目标"], ["Estimated preview; verified settings are authoritative after applying.", "预览为估算；应用后以校验结果为准。"], ["Machine-command ceiling", "机器指令上限"], ["90% pressure margin, data freshness and driver-ACK guards are fixed.", "原限压90%、数据新鲜度和驱动确认保护固定。"], ["Command ceiling reached.", "已触及指令上限。"], ["Request base return", "请求收回"], ["No later than", "最迟"], ["Invalid saved S2 refill settings; defaults restored", "已保存补水设置无效，已使用默认值"], ["S2 refill settings are still loading", "S2补水设置尚在载入"], ["S2 refill settings could not be saved", "S2补水设置保存失败"], ["S2 refill plan settings invalid", "S2补水计划设置无效"], ["S2 refill start delay", "等待S2补水启动延时"], ["S2 refill reached configured cup-flow cutoff", "S2已达到设定称流速阈值，收回增强"], ["S2 cup flow already at configured cutoff; refill unnecessary", "S2称流速已达设定阈值，无需补水增强"], ["S2 refill target needs no extra command", "S2补水目标无需增加指令"], ["S2 configurable refill; measured cup-flow cutoff or safety deadline", "S2可调补水；按实测称流速阈值或保护时限收回"], ["LUT-relative real-flow target", "基于LUT相对换算的称流速目标"], ["bounded local proportional real-flow target", "有界局部比例估算的称流速目标"], ["Flow input ml/s", "流量输入 ml/s"], ["You can type up to four decimals or drag finely; up/down buttons still move by1/16ml/s. Draft values and native driver quanta are shown separately. S3 order and adjacent-rise guards remain.", "可直接输入最多四位小数或精细拖动；上下按钮仍按1/16 ml/s调整。输入值与机器实际量化档位分别显示。S3顺序及相邻增幅保护保持。"], ["Native driver quantum ≈", "对应驱动档位 ≈"], ["Allowed range for this point", "当前控制点允许范围"], ["Please preserve S3 order and adjacent-rise bounds.", "请保持S3顺序和相邻增幅。"], ["Base pump flow multiplier", "基础泵流量倍率"], ["% base pump flow", "% 基础泵流量"], ["Refill basis", "补水基准"], ["Base pump multiplier", "基础泵倍率"], ["Target cup-flow", "目标折算"], ["Target cup-flow estimate", "目标折算估算"], ["target cup-flow base", "目标折算基值"], ["No clean observed tail; using profile base", "无合格实测尾段，用曲线基础指令"], ["S2 refill migrated to160% of base pump flow; timing and cutoff retained", "S2补水已迁移为基础泵流量160%；保留原时限和收回阈值"], ["Extraction charts end at extraction stop; release, preparation and post-stop data are hidden. Original records remain exportable.", "萃取图在停止萃取处结束；泄压浸泡间隔按实际时长补零，仅为显示示意，原始记录仍可导出。"], ["Refill boost", "补水增强"], ["Refill return", "补水收回"], ["Previous refill settings", "上一次补水参数"], ["Sliders are drafts; below are saved edits and the previous shot-start snapshot.", "当前滑块是草稿；以下显示已保存的修改记录和上一杯启动快照。"], ["Currently saved", "当前已保存"], ["Previous edit: before → after", "上次修改前 → 修改后"], ["No saved refill edits yet", "尚无已保存的补水修改记录"], ["Previous shot settings", "上一杯实际采用的参数"], ["No boost write recorded for this shot", "该杯未记录增强写入"], ["Sent boost command", "已发送增强指令"], ["Previous refill settings unavailable; current settings are not substituted for history.", "上一杯补水参数尚未记录；不使用当前设置代替历史值。"], ["Full refill settings were not saved in this record", "该记录未保存完整补水参数"], ["Base pump multiplier ", "基础泵倍率 "], ["Legacy cup-target multiplier ", "旧版称流目标倍率 "], ["Start ", "启动 "], ["Cup cutoff ", "称流收回 "], ["Maximum ", "最长 "], ["Approach ", "渐进 "], ["Base command ", "基础指令 "], ["Planned boost ", "计划增强 "], ["Control handover duration", "接管渐进时间"], ["Holding command ", "接管指令 "], [" · holding ", " · 接管 "], ["S2 effective cup-flow onset:", "S2有效称流起点："], ["Pre-output wait ", "出液前等待 "], [" s, excluded from validation and learning windows", " s，不计入合格与学习窗口"], ["S2 sustained outflow not detected; flow validation is pending", "S2尚未检测到持续有效出液；暂不计算流量合格判定"], ["S2 handover falling response; avoid an extra decrease", "S2接管期流量正在回落，避免继续下调"]];
  const translateUiText=createUiTranslator(UI_LANGUAGE_PAIRS);
  const STORAGE_CAL = "flowCalibration";
  const STORAGE_SCOPE = "flowMultiplierScope";
  const STORAGE_PENDING_MULT = "pendingCalibrationMultiplier";
  const STORAGE_GLOBAL_PREVIOUS = "globalPreviousMultiplier";
  const STORAGE_SCOPED_ORIGINAL = "scopedOriginalMultiplier";
  const STORAGE_CAL_MODE = "calibrationMode";
  const STORAGE_S1_STARTUP = "stage1StartupCorrection";
  const STORAGE_TEST_OVERRIDES = "manualTestOverrides";
  const STORAGE_S2_REFILL="s2RefillSettingsV1";
  const S2_REFILL_DEFAULTS=Object.freeze({startDelayMs:0,targetPercent:160,cutoffPercent:85,maxDurationMs:4000,approachMs:200});
  const S2_REFILL_BASES=Object.freeze(["pump-command","cup-target"]);
  const S2_REFILL_LIMITS=Object.freeze({startDelayMs:[0,1500,50],targetPercent:[100,160,1],cutoffPercent:[50,99,1],maxDurationMs:[500,4000,100],approachMs:[200,6000,100]});
  const STORAGE_AUTO_APPLY = "autoApplyNextShot";
  const STORAGE_ADAPTIVE_HISTORY = "adaptiveHistoryV1"; // legacy migration source
  const STORAGE_HISTORY_FILE = "adaptiveHistoryFileV2";
  const STORAGE_HISTORY_PROBE = "adaptiveHistoryStorageProbeV1";
  const HISTORY_FILE_MAX_SHOTS = 30;

  function normalizeCalibrationMode(value) {
    const v = String(value || "").trim().toLowerCase();
    return v === "full" ? "full" : "low";
  }

  function calibrationModeConfig(mode) {
    return CALIBRATION_MODES[normalizeCalibrationMode(mode || state.calibrationMode)] || CALIBRATION_MODES.low;
  }

  function calibrationProgram(mode) {
    const normalized = normalizeCalibrationMode(mode || state.calibrationMode);
    const m = calibrationModeConfig(normalized);
    if (m.algorithm === "target-lut") {
      const steps = [];
      for (const block of (m.targetBlocks || [])) {
        let targetReal = Number(block.target);
        if (state.cfg) {
          if (block.targetSource === "stage1") targetReal = Number(state.cfg.stage1Flow);
          else if (block.targetSource === "stage2") targetReal = Number(state.cfg.stage2Flow);
          else if (block.targetSource === "stage3") targetReal = Number(state.cfg.stage3Flow);
        }
        let commands = (block.commands || []).map(Number).filter(Number.isFinite);
        const defaults = { stage1: 2.0, stage2: 5.0, stage3: 1.5 };
        const defaultTarget = Number(defaults[block.targetSource] || block.target || targetReal || 1);
        let center = mappedCommandForReal(targetReal);
        if (!Number.isFinite(center)) {
          const baseCenter = commands.length ? commands[Math.floor(commands.length / 2)] : Math.max(0.2, targetReal * 0.5);
          center = baseCenter * (targetReal / Math.max(0.1, defaultTarget));
        }
        const span = Math.max(block.targetSource === "stage2" ? 0.16 : 0.10, Math.abs(center) * 0.12);
        commands = block.targetSource === "stage3"
          ? [center + span, center, Math.max(0.10, center - span)]
          : [Math.max(0.10, center - span), center, center + span];
        for (const command of commands) {
          steps.push({
            blockId: String(block.id || ""), targetSource: String(block.targetSource || ""), targetReal,
            commandFlow: clampCommandFlow(command), seconds: Number(m.stepSeconds),
            settleSeconds: Number(m.settleSeconds), windowSeconds: Number(m.windowSeconds)
          });
        }
      }
      return steps;
    }
    return (m.commands || []).map(command => ({
      blockId: "FULL", targetReal: null, commandFlow: clampCommandFlow(command),
      seconds: Number(m.stepSeconds), settleSeconds: Number(m.settleSeconds), windowSeconds: Number(m.windowSeconds)
    }));
  }

  function calibrationCommands(mode) {
    return calibrationProgram(mode).map(x => Number(x.commandFlow));
  }

  function calibrationWaterPlan(mode) {
    const m = calibrationModeConfig(mode);
    const program = calibrationProgram(mode);
    const primeMl = Number(m.primeFlow || 0) * Number(m.primeSeconds || 0);
    const nominalMl = primeMl + program.reduce((sum, step) => sum + Number(step.commandFlow || 0) * Number(step.seconds || m.stepSeconds || 0), 0);
    return {
      mode: normalizeCalibrationMode(mode || state.calibrationMode),
      modeLabel: m.label,
      algorithm: m.algorithm || "staircase",
      steps: program.length,
      stepSeconds: m.stepSeconds,
      settleSeconds: m.settleSeconds,
      windowSeconds: m.windowSeconds,
      primeFlow: Number(m.primeFlow || 0),
      primeSeconds: Number(m.primeSeconds || 0),
      hardStopG: m.hardStopG,
      nominalCommandWaterMl: round(nominalMl, 0),
      recommendedContainerMl: m.recommendedContainerMl,
      waterWarnMarginMm: Number(m.waterWarnMarginMm || 0),
      waterBlockMarginMm: Number(m.waterBlockMarginMm || 0)
    };
  }

  function calibrationProfileTitle(mode) {
    const base = state.cfg && state.cfg.calibrationProfileTitle
      ? String(state.cfg.calibrationProfileTitle) : "HyperEx Flow Calibration";
    return `${base} - ${calibrationModeConfig(mode).label}`;
  }

  function calibrationModeFromTitle(title) {
    const t = String(title || "");
    if (t === calibrationProfileTitle("low")) return "low";
    if (t === calibrationProfileTitle("full")) return "full";
    return null;
  }

  function isCalibrationProfileTitle(title) {
    return calibrationModeFromTitle(title) !== null;
  }

  const state = {
    cfg: null,
    workflowTitle: "",
    workflowProfile: null,
    runtimeProfileVerified: false,
    profileSyncQueue: Promise.resolve(),
    temperatureRecheckNeeded: false,
    machineProfileAckKey: "",
    profileReadbackAt: null,
    calibrationStorageLoaded: false,
    overrideStorageLoaded: false,
    s2RefillSettings:null,s2RefillPrevious:null,s2RefillStorageLoaded:true,s2RefillLoadWarning:null,
    scopeStorageLoaded: false,
    scopedOriginalStorageLoaded: false,
    workflowSelectionRevision: 0,
    runtimeProfileStatus: "not verified",
    runtimeProfileRepairBusy: false,
    profileVerificationPending: false,
    profileVerificationRetryAtMs: 0,
    runtimeProfileMismatchAbortSent: false,
    armed: false,
    phase: "idle", // idle|stage1|dumping|soak|restart_wait|stage2|stage3|finishing|aborted
    lastMachineState: null,
    lastSubstate: null,
    lastPressure: 0,
    lastMachineTelemetryValid: false,
    lastFlow: 0,
    lastWeightFlow: 0,
    lastFrame: null,
    lowFlowSamples: 0,
    idleConfirmedAtMs: 0,
    hardPressureSamples: 0,
    rawBaseline: null,
    lastRawWeight: null,
    cumulativeOffset: 0,
    cumulativeWeight: 0,
    hasScaleSample: false,
    dumpRequestedAtMs: 0,
    dumpAcceptedAtMs: 0,
    dumpReinforceSent: false,
    lastMachineAtMs: 0,
    dumpTimer: null,
    dumpSettleTimer: null,
    dumpFallbackTimer: null,
    idlePollTimer: null,
    soakTimer: null,
    noScaleTimer: null,
    maxRunTimer: null,
    restartSkipTimer: null,
    restartPollTimer: null,
    restartTimeoutTimer: null,
    ghcCountdownTimer: null,
    ghcPromptStartedAtMs: 0,
    ghcSecondsRemaining: 0,
    soakCountdownTimer: null,
    soakPromptStartedAtMs: 0,
    soakSecondsRemaining: 0,
    flowStripTimer: null,
    armReinforceTimer: null,
    armReinforceTimer2: null,
    armRequestCount: 0,
    lastArmRequestAtMs: 0,
    commandBusy: false,
    sequenceStartedAtMs: 0,
    stage1DumpSent: false,
    stage2SkipSent: false,
    finalStopSent: false,
    completionTimer: null,
    abortResetTimer: null,
    liveTrim: null,
    liveTrimTimer: null,
    liveTrimDirty: false,
    directStartTest: null,
    directStartTestTimer: null,
    directStartTestEnabledForRun: false,
    scaleHandle: null,
    scaleReconnectTimer: null,
    scaleConnected: false,
    latestRawWeight: null,
    latestWeightFlow: 0,
    latestScaleAtMs: 0,
    latestScaleTimestamp: null,
    latestRawDwDt: null,
    lastTargetFlow: null,
    lastTargetPressure: null,
    lastMachineWeightFlow: null,
    diagnosticCurrent: null,
    diagnosticLast: null,
    diagnosticLastSampleAtMs: 0,
    diagnosticRunSeq: 0,
    calibrationArmed: false,
    calibrationMode: "low",
    calibrationActive: false,
    calibrationLast: null,
    calibrationMap: null,
    calibrationMapUsable: false,
    calibrationMapStaleReason: "not calibrated",
    calibrationPendingMultiplier: null,
    calibrationFinalizeBusy: false,
    calibrationHardPressureSamples: 0,
    flowMultiplierCurrent: null,
    flowMultiplierReadAtMs: 0,
    scopedOriginalMultiplier: null,
    scopedAppliedMultiplier: null,
    globalPreviousMultiplier: null,
    scopeMode: "hyperex",
    scopeChangeBusy: false,
    profileSyncStatus: "",
    hyperExProfileId: null,
    calibrationProfileIds: { low: null, full: null },
    waterHandle: null,
    waterReconnectTimer: null,
    waterCurrentLevelMm: null,
    waterRefillLevelMm: null,
    waterLevelAtMs: 0,
    waterLevelConnected: false,
    calibrationWaterPreflightApprovedUntilMs: 0,
    stage1StartupCorrection: null,
    testOverrides: null,
    adaptiveHistory: [],
    legacyAdaptiveHistory: [],
    persistentHistoryFile: null,
    persistentHistoryLoaded: false,
    storageProbeVerified: false,
    pendingHistoryWrite: null,
    historyWriteDirty: false,
    historyWriteTimer: null,
    historyVerifiedRunIds:[],historyLastReadbackAt:null,historyWriteBytes:0,historyRecoveryAttempts:0,historyRecoveryTimer:null,
    persistentHistoryAvailable: null,
    persistentHistoryStatus: "checking persistent history storage",
    persistentHistoryCompatibleCount: 0,
    storageProbeToken: "",
    storageProbeTimer: null,
    autoApplyNextShot: true,
    autoApplyLastStatus: null,
    learningStage: null,
    learningContextLoaded: true,
    uiLanguage:"zh",
    uiLanguageEdited:false,
    curveApplyBusy: false,
    autoApplyTimer: null,
    pendingRefillSave: null
  };

  function n(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function b(value, fallback) {
    if (typeof value === "boolean") return value;
    if (value === "true") return true;
    if (value === "false") return false;
    return fallback;
  }

  function clampNumber(value, lo, hi, fallback) {
    const v = Number(value);
    const x = Number.isFinite(v) ? v : Number(fallback);
    return Math.max(lo, Math.min(hi, x));
  }

  function clampCommandFlow(value) {
    return clampNumber(value, LIMITS.commandFlowMin, LIMITS.commandFlowMax, LIMITS.commandFlowMin);
  }

  function activeReleaseEnabled(config) { return !config || config.activeRelease !== false; }
  function overrideStorageKey() { return activeReleaseEnabled(state.cfg) ? STORAGE_TEST_OVERRIDES : "manualTestOverridesContinuousV3"; }
  function liveTrimPhaseAllowed(t) {
    return ["stage2","stage3"].includes(state.phase)||state.phase==="stage1"&&t&&t.run&&t.run.config.activeRelease===false;
  }
  async function beginContinuousStage2() {
    if(activeReleaseEnabled(state.cfg)||state.phase!=="stage1"||state.stage1DumpSent)return;
    state.stage1DumpSent=true;
    const token=state.sequenceStartedAtMs;
    diagnosticEvent("continuous_s1_weight_trigger",{cumulativeWeightG:round(state.cumulativeWeight,3)});
    try {
      await guardedSingleSkip(0,1,"continuous S1 -> S2",()=>state.phase==="stage1"&&state.sequenceStartedAtMs===token);
      if(state.phase!=="stage1"||state.sequenceStartedAtMs!==token)return;
      state.phase="stage2";
      diagnosticEvent("stage2_start",{continuous:true,targetFlowMlS:state.cfg.stage2Flow});
      diagnosticSample("stage2-start",true);emitSkinChanged();startFlowStripTicker();
    }catch(error){if(state.sequenceStartedAtMs===token&&state.phase==="stage1")abortSequence(`Continuous S1 transition failed: ${error.message||error}`,true);}
  }
  // Corrected S1 evidence retains startup-quality gates and normalizes only the
  // observed 20–80% trajectory. The physical RAW curve is never rewritten.
  function stage1LiveLearning(run) {
    const c=run&&run.config||{},trace=run&&run.liveFlowTrim&&run.liveFlowTrim.trace||[];
    const changed=c.activeRelease===false&&!!c.experimentalLiveTrim&&trace.some(x=>x.kind==="write"&&Number(x.frame)===0);
    const report={applicable:changed,eligible:false,actuator:{eligible:false},basis:"S1 startup observed-target exposure local model",reason:"Original S1 startup evidence path"};
    if(!changed)return report;
    const admission=learningAdmission(run);
    const m=stage1StartupMetrics(run),seed=finiteOrNull(c.stage1CommandMlS),target=finiteOrNull(c.stage1Flow),limit=finiteOrNull(c.stage1PressureLimit);
    if(!m||m.confidence!=="MEDIUM"||!seed||!target||!limit){report.reason="S1 corrected startup quality insufficient";return report;}
    const raw=phaseRawSamples(run,"stage1").filter(x=>Number(x.profileFrame)===0&&finiteOrNull(x.scaleTimestampSeconds)!==null&&rawTimeSecondsForSample(x)>=m.midStartScaleS&&rawTimeSecondsForSample(x)<=m.midEndScaleS);
    const machine=(run.samples||[]).filter(x=>x.phase==="stage1"&&Number(x.profileFrame)===0).slice().sort((a,b)=>a.tMs-b.tMs);
    const points=[],stamps=new Set();let mi=-1,previous=null,exposure=0;
    for(const x of raw){
      const stamp=Number(x.scaleTimestampSeconds);if(stamps.has(stamp))continue;stamps.add(stamp);
      while(mi+1<machine.length&&machine[mi+1].tMs<=x.tMs)mi++;
      const q=machine[mi],command=q&&finiteOrNull(q.targetFlowMlS),base=Math.round(seed*16)/16;
      const known=command>0&&(Math.abs(command-base)<.02||trace.some(w=>w.kind==="write"&&Number(w.frame)===0&&w.tMs<=q.tMs&&Math.abs(w.commandMlS-command)<.02));
      if(!q||q.machineTelemetryValid!==true||finiteOrNull(q.machineAgeMs)===null||q.machineAgeMs>600||x.tMs-q.tMs>600||!known||command<base*.8-.02||command>base*1.2+.02||finiteOrNull(q.pressureBar)===null||q.pressureBar<0||q.pressureBar>=limit*.95||finiteOrNull(q.machineFlowMlS)===null||q.machineFlowMlS<command*.7){report.reason="S1 corrected startup target or actuator coverage insufficient";return report;}
      if(previous){const dt=stamp-previous.stamp;if(!(dt>0&&dt<=.6)){report.reason="S1 corrected startup source gap";return report;}exposure+=dt*(previous.command+command)/(2*(Math.round(seed*16)/16));}
      points.push({x:exposure,y:Number(x.weightG)});previous={stamp,command};
    }
    if(points.length<admission.samples(8)||raw.length<admission.samples(8)||Number(raw[raw.length-1].scaleTimestampSeconds)-Number(raw[0].scaleTimestampSeconds)<admission.seconds(.9)){report.reason="S1 corrected startup needs eight unique samples over0.9s";return report;}
    const fit=linearRegression(points);if(!fit||fit.r2<admission.r2(.90)||fit.slope<=0){report.reason="S1 corrected startup model fit insufficient";return report;}
    report.eligible=true;report.actuator={eligible:true,samples:points.length};report.reason="S1 corrected startup admitted using observed target exposure";
    report.evidence={runId:run.runId,targetGS:target,command:round(seed,3),measured:round(fit.slope,3),errorPct:round((fit.slope/target-1)*100,1),confidence:"MEDIUM",r2:round(Math.min(fit.r2,m.midR2),5),transitS:m.transit20to80S,activeSeconds:m.activeSeconds,firstRiseDelayS:m.firstRiseDelayS,measurementBasis:report.basis};
    return report;
  }


  function loadConfig(settings) {
    const hardPressureLimit = clampNumber(settings.HardPressureLimit, 1.0, LIMITS.pressureMax, 8.0);
    const stage1Weight = clampNumber(settings.Stage1Weight, LIMITS.stage1WeightMin, LIMITS.stage1WeightMax, 4.0);
    // Keep the weight state machine ordered even if persisted/user input is contradictory.
    const stage2Weight = clampNumber(settings.Stage2Weight, stage1Weight + 2.0, LIMITS.stage2WeightMax, Math.max(40.0, stage1Weight + 2.0));
    const finalWeight = clampNumber(settings.FinalWeight, stage2Weight + 5.0, LIMITS.finalWeightMax, Math.max(100.0, stage2Weight + 5.0));
    return {
      enabled: b(settings.Enabled, true),
      activeRelease: b(settings.ActiveRelease, true),
      adaptiveLearningLevel:normalizeLearningLevel(settings.AdaptiveLearningLevel),
      basketContext: "empty", // Startup qualification chooses empty engineering or normal coffee automatically.
      profileTitle: String(settings.ProfileTitle || "HyperEx Pulse Filter"),
      temperature: clampNumber(settings.Temperature, LIMITS.temperatureMin, LIMITS.temperatureMax, 92.0),
      stage1Flow: clampNumber(settings.Stage1Flow, LIMITS.desiredRealFlowMin, LIMITS.desiredRealFlowMax, 2.0),
      stage1Weight,
      stage1PressureLimit: clampNumber(settings.Stage1PressureLimit, LIMITS.pressureMin, hardPressureLimit, Math.min(3.0, hardPressureLimit)),
      dumpFlowThreshold: clampNumber(settings.DumpFlowThreshold, 0, 2.0, 0.4),
      dumpFlowStableSamples: Math.max(1, Math.min(20, Math.round(n(settings.DumpFlowStableSamples, 2)))),
      dumpMinSettleSeconds: clampNumber(settings.DumpMinSettleSeconds, 0, 10, 0.8),
      dumpFallbackSeconds: clampNumber(settings.DumpFallbackSeconds, 0.2, 15, 1.5),
      dumpTimeoutSeconds: clampNumber(settings.DumpTimeoutSeconds, 1, 30, 5.0),
      soakSeconds: clampNumber(settings.SoakSeconds, 0, 60, 10.0),
      s2StartupAssist: settings.S2StartupAssist !== false,
      stage2Flow: clampNumber(settings.Stage2Flow, LIMITS.desiredRealFlowMin, LIMITS.desiredRealFlowMax, 5.0),
      stage2Weight,
      stage2PressureLimit: clampNumber(settings.Stage2PressureLimit, LIMITS.pressureMin, hardPressureLimit, Math.min(6.0, hardPressureLimit)),
      stage3Flow: clampNumber(settings.Stage3Flow, LIMITS.desiredRealFlowMin, LIMITS.desiredRealFlowMax, 1.5),
      finalWeight,
      stage3PressureLimit: clampNumber(settings.Stage3PressureLimit, LIMITS.pressureMin, hardPressureLimit, Math.min(3.0, hardPressureLimit)),
      hardPressureLimit,
      scaleResetThreshold: clampNumber(settings.ScaleResetThreshold, 0.5, 20, 2.0),
      noScaleTimeoutSeconds: clampNumber(settings.NoScaleTimeoutSeconds, 1, 30, 5.0),
      liveFlowTrimTest: b(settings.LiveFlowTrimTest, true),
      liveFlowTrimLevel: [1,2,3,4].includes(Number(settings.LiveFlowTrimLevel)) ? Number(settings.LiveFlowTrimLevel) : 3,
      directDriverStartTest: b(settings.DirectDriverStartTest, false),
      ghcConfirmTimeoutSeconds: clampNumber(settings.GHCConfirmTimeoutSeconds, 1, 60, 20.0),
      autoArmRetry1Seconds: clampNumber(settings.AutoArmRetry1Seconds, 0, 30, 3.0),
      autoArmRetry2Seconds: clampNumber(settings.AutoArmRetry2Seconds, 0, 60, 7.0),
      diagnosticEnabled: b(settings.DiagnosticEnabled, true),
      idleDashboardShortcut: b(settings.IdleDashboardShortcut, true),
      diagnosticSampleIntervalMs: Math.round(clampNumber(settings.DiagnosticSampleIntervalMs, 50, 1000, 100)),
      maxRunSeconds: clampNumber(settings.MaxRunSeconds, 30, 600, 180.0),
      useCalibrationLut: b(settings.UseCalibrationLut, true),
      flowMultiplierScope: String(settings.FlowMultiplierScope || "HyperEx only"),
      calibrationProfileTitle: String(settings.CalibrationProfileTitle || "HyperEx Flow Calibration"),
      calibrationMode: normalizeCalibrationMode(settings.CalibrationMode || "Low Water"),
      calibrationStepSeconds: clampNumber(settings.CalibrationStepSeconds, 7, 20, 10.0),
      calibrationSettleSeconds: clampNumber(settings.CalibrationSettleSeconds, 1.5, 10, 4.0),
      calibrationWindowSeconds: clampNumber(settings.CalibrationWindowSeconds, 2, 8, 3.5),
      calibrationAutoSync: b(settings.CalibrationAutoSync, true),
      autoApplyNextShot: b(settings.AutoApplyNextShot, true)
    };
  }

  function advancedSettingsFromCfg(cfg) {
    const c = cfg || state.cfg || loadConfig({});
    return {
      activeRelease: activeReleaseEnabled(c),
      adaptiveLearningLevel:c.adaptiveLearningLevel,
      liveFlowTrimTest: !!c.liveFlowTrimTest,
      liveFlowTrimLevel: c.liveFlowTrimLevel,
      directDriverStartTest: !!c.directDriverStartTest,
      temperature: round(c.temperature, 2),
      stage1Flow: round(c.stage1Flow, 3), stage1PressureLimit: round(c.stage1PressureLimit, 2),
      dumpFlowThreshold: round(c.dumpFlowThreshold, 3), dumpFlowStableSamples: Math.round(c.dumpFlowStableSamples),
      dumpFallbackSeconds: round(c.dumpFallbackSeconds, 2), dumpTimeoutSeconds: round(c.dumpTimeoutSeconds, 2),
      stage2Flow: round(c.stage2Flow, 3), stage2PressureLimit: round(c.stage2PressureLimit, 2),
      stage3Flow: round(c.stage3Flow, 3), stage3PressureLimit: round(c.stage3PressureLimit, 2),
      hardPressureLimit: round(c.hardPressureLimit, 2), scaleResetThreshold: round(c.scaleResetThreshold, 2),
      noScaleTimeoutSeconds: round(c.noScaleTimeoutSeconds, 2), autoArmRetry1Seconds: round(c.autoArmRetry1Seconds, 2),
      autoArmRetry2Seconds: round(c.autoArmRetry2Seconds, 2), diagnosticSampleIntervalMs: Math.round(c.diagnosticSampleIntervalMs),
      maxRunSeconds: round(c.maxRunSeconds, 1)
    };
  }

  function advancedSettingsPayload() {
    return {
      settings: advancedSettingsFromCfg(),
      canEdit:state.phase==="idle"&&!state.calibrationActive&&!state.curveApplyBusy&&(!state.autoApplyLastStatus||state.autoApplyLastStatus.status!=="applying"),
      liveFlowTrimTest: liveTrimPayload(),
      directStartTest: directStartTestPayload(),
      basicCurve: state.cfg ? {
        stage1WeightG: round(state.cfg.stage1Weight,2),
        releaseSettleSeconds: round(state.cfg.dumpMinSettleSeconds,2),
        soakSeconds: round(state.cfg.soakSeconds,2),
        stage2WeightG: round(state.cfg.stage2Weight,2),
        finalWeightG: round(state.cfg.finalWeight,2),
        ghcConfirmTimeoutSeconds: round(state.cfg.ghcConfirmTimeoutSeconds,2)
      } : null,
      note: "Single source of truth: values are loaded from Plugins → HyperEx Pulse Filter settings."
    };
  }

  function log(message) {
    host.log(`[HyperEx] ${message}`);
  }

  function round(value, digits) {
    if (value === null || value === undefined || value === "") return null;
    const v = Number(value);
    if (!Number.isFinite(v)) return null;
    const f = Math.pow(10, digits === undefined ? 3 : digits);
    return Math.round(v * f) / f;
  }

  function finiteOrNull(value) {
    if (value === null || value === undefined || value === "") return null;
    const v = Number(value);
    return Number.isFinite(v) ? v : null;
  }

  function normalizeScope(value) {
    const v = String(value || "").trim().toLowerCase();
    if (v === "off") return "off";
    if (v === "global") return "global";
    return "hyperex";
  }

  function scopeLabel(value) {
    return value === "off" ? "Off" : value === "global" ? "Global" : "HyperEx only";
  }

  function parseStoredJson(value) {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "object") return value;
    try { return JSON.parse(String(value)); } catch (_) { return null; }
  }

  function storageRead(key) {
    if(key===STORAGE_TEST_OVERRIDES)key=overrideStorageKey();
    try { host.storage({ type: "read", key, namespace: ID }); return true; }
    catch (error) { log(`Storage read '${key}' failed: ${error.message || error}`); return false; }
  }

  function storageWrite(key, value) {
    if(key===STORAGE_TEST_OVERRIDES)key=overrideStorageKey();
    try {
      const data = typeof value === "string" ? value : JSON.stringify(value);
      host.storage({ type: "write", key, namespace: ID, data });
      return true;
    } catch (error) {
      log(`Storage write '${key}' failed: ${error.message || error}`);
      return false;
    }
  }

  function desiredRealFlowForPhase(phase) {
    if (!state.cfg) return null;
    if (phase === "stage1") return state.cfg.stage1Flow;
    if (phase === "stage2") return state.cfg.stage2Flow;
    if (phase === "stage3") return state.cfg.stage3Flow;
    return null;
  }

  function calibrationBaseMultiplier() {
    const m = state.calibrationMap && Number(state.calibrationMap.baseFlowMultiplier);
    return Number.isFinite(m) ? m : null;
  }

  function calibrationPoints() {
    const points = state.calibrationMap && Array.isArray(state.calibrationMap.points)
      ? state.calibrationMap.points.filter(p => Number.isFinite(Number(p.commandFlow)) && Number.isFinite(Number(p.actualFlow)) && Number(p.actualFlow) > 0)
      : [];
    return points.slice().sort((a, b) => Number(a.actualFlow) - Number(b.actualFlow));
  }

  function multiplierClose(a, b) {
    const x = finiteOrNull(a), y = finiteOrNull(b);
    return x !== null && y !== null && Math.abs(x - y) <= 0.015;
  }

  function recomputeCalibrationUsability() {
    state.calibrationMapUsable = false;
    state.calibrationMapStaleReason = "not calibrated";
    if (!state.cfg || !state.cfg.useCalibrationLut) {
      state.calibrationMapStaleReason = "LUT disabled";
      return;
    }
    const map = state.calibrationMap;
    const pts = calibrationPoints();
    if (!map || map.valid !== true || pts.length < 3) {
      state.calibrationMapStaleReason = "no valid calibration map";
      return;
    }
    if (Number(map.schema || 0) < 3) {
      state.calibrationMapStaleReason = "legacy calibration map; rerun v0.1.27+ Flow Cal";
      return;
    }
    if (state.cfg && pts.length) {
      const lo = Number(pts[0].actualFlow), hi = Number(pts[pts.length - 1].actualFlow);
      const targets = [Number(state.cfg.stage1Flow), Number(state.cfg.stage2Flow), Number(state.cfg.stage3Flow)].filter(Number.isFinite);
      const outside = targets.find(t => t < lo * 0.92 || t > hi * 1.08);
      if (outside !== undefined) {
        state.calibrationMapStaleReason = `target ${round(outside,3)} g/s outside calibrated range ${round(lo,3)}..${round(hi,3)}; rerun Flow Cal`;
        return;
      }
    }
    const base = calibrationBaseMultiplier();
    if (!Number.isFinite(base)) {
      state.calibrationMapStaleReason = "calibration multiplier missing";
      return;
    }
    if (state.scopeMode === "hyperex") {
      state.calibrationMapUsable = true;
      state.calibrationMapStaleReason = "";
      return;
    }
    if (finiteOrNull(state.flowMultiplierCurrent) === null) {
      state.calibrationMapStaleReason = "current DE1 multiplier unknown";
      return;
    }
    if (!multiplierClose(state.flowMultiplierCurrent, base)) {
      state.calibrationMapStaleReason = `DE1 multiplier ${round(state.flowMultiplierCurrent,3)} != calibration ${round(base,3)}`;
      return;
    }
    state.calibrationMapUsable = true;
    state.calibrationMapStaleReason = "";
  }

  function mappedCommandForReal(realFlow) {
    const target = Number(realFlow);
    if (!state.calibrationMapUsable || !Number.isFinite(target) || target <= 0) return null;
    const pts = calibrationPoints();
    if (pts.length < 2) return null;
    const lo = Number(pts[0].actualFlow), hi = Number(pts[pts.length - 1].actualFlow);
    // Do not silently extrapolate far outside the measured calibration envelope.
    if (target < lo * 0.92 || target > hi * 1.08) return null;
    if (target <= lo) return Number(pts[0].commandFlow);
    if (target >= hi) return Number(pts[pts.length - 1].commandFlow);
    for (let i = 1; i < pts.length; i += 1) {
      const a = pts[i - 1], b = pts[i];
      const ya = Number(a.actualFlow), yb = Number(b.actualFlow);
      if (target <= yb && yb > ya) {
        const f = (target - ya) / (yb - ya);
        return Number(a.commandFlow) + f * (Number(b.commandFlow) - Number(a.commandFlow));
      }
    }
    return null;
  }

  function resolvedCommandFlow(realFlow) {
    const mapped = mappedCommandForReal(realFlow);
    return Number.isFinite(mapped) ? clampCommandFlow(mapped) : clampCommandFlow(realFlow);
  }

  function stage1StartupFactor() {
    const x = state.stage1StartupCorrection;
    if (!x || typeof x !== "object") return 1.0;
    const factor = Number(x.factor), target = Number(x.targetRealFlow), weight = Number(x.stage1Weight);
    if (!Number.isFinite(factor) || factor < 0.70 || factor > 1.60) return 1.0;
    if (!state.cfg || Math.abs(target - Number(state.cfg.stage1Flow)) > 0.001 || Math.abs(weight - Number(state.cfg.stage1Weight)) > 0.001) return 1.0;
    const mapCreatedAt = state.calibrationMap && state.calibrationMap.createdAt ? String(state.calibrationMap.createdAt) : "";
    if (String(x.mapCreatedAt || "") !== mapCreatedAt) return 1.0;
    return factor;
  }

  function testOverrideBinding() {
    const mapCreatedAt = state.calibrationMap && state.calibrationMap.createdAt ? String(state.calibrationMap.createdAt) : "";
    return {
      mapCreatedAt,
      activeRelease:activeReleaseEnabled(state.cfg),
      basketContext: state.cfg ? state.cfg.basketContext : "unknown",
      targets: state.cfg ? {
        stage1: round(state.cfg.stage1Flow, 4),
        stage2: round(state.cfg.stage2Flow, 4),
        stage3: round(state.cfg.stage3Flow, 4)
      } : null
    };
  }


  function testOverrideStatus() {
    const x = state.testOverrides;
    const schema = Number(x && x.schema || 0);
    if (!x || typeof x !== "object" || ![1,2,3].includes(schema)) return { valid: false, reason: "none", activeStages: [], s3ShapeActive: false };
    // v0.1.37 accidentally wrote adaptive schema-3 overrides that its own reader
    // rejected. Do not silently activate those stale writes after upgrading to
    // v0.1.38. Genuine v0.1.38+ schema-3 adaptive writes carry writerVersion.
    if (schema === 3 && x.adaptiveSource && !String(x.writerVersion || "").trim()) {
      return { valid: false, reason: "legacy v0.1.37 adaptive override ignored; run a new validation shot and apply again", activeStages: [], s3ShapeActive: false };
    }
    if (!state.cfg) return { valid: false, reason: "configuration unavailable", activeStages: [], s3ShapeActive: false };
    const binding = testOverrideBinding();
    if(activeReleaseEnabled(x)!==activeReleaseEnabled(state.cfg))return {valid:false,reason:"Brew mode differs; separate command history is used",activeStages:[],s3ShapeActive:false};
    const overrideContext = x.basketContext || "unknown";
    const baselinePrior = binding.basketContext === "coffee" && ["empty","unknown"].includes(overrideContext);
    if (overrideContext !== binding.basketContext && !baselinePrior && !(binding.basketContext === "empty" && overrideContext === "unknown")) {
      return { valid:false, reason:"basket context changed; previous overrides ignored; using LUT baseline", activeStages:[], s3ShapeActive:false };
    }
    if (String(x.mapCreatedAt || "") !== String(binding.mapCreatedAt || "")) return { valid: false, reason: "calibration LUT changed; manual test override ignored", activeStages: [], s3ShapeActive: false };
    const xt = x.targets && typeof x.targets === "object" ? x.targets : {};
    for (const stage of ["stage1","stage2","stage3"]) {
      if (!Number.isFinite(Number(xt[stage])) || !(Number(xt[stage])/Number(binding.targets[stage])>=.5&&Number(xt[stage])/Number(binding.targets[stage])<=2)) {
        return { valid: false, reason: "real-flow targets changed; manual test override ignored", activeStages: [], s3ShapeActive: false };
      }
    }
    const activeStages = [];
    for (const stage of ["stage1","stage2","stage3"]) {
      const q = x.stages && x.stages[stage];
      if (q && String(q.mode) === "manual" && Number.isFinite(Number(q.command))) activeStages.push(stage);
    }
    const sq = schema >= 2 && x.s3Shape && typeof x.s3Shape === "object" ? x.s3Shape : null;
    const s3ShapeActive = !!(sq && sq.enabled === true);
    if (s3ShapeActive) activeStages.push("stage3-shape");
    const adaptiveSource = x.adaptiveSource && typeof x.adaptiveSource === "object" ? x.adaptiveSource : null;
    let reason = "all stages ORIGINAL / LUT";
    if (activeStages.length) {
      if (adaptiveSource && String(adaptiveSource.mode || "").toLowerCase() === "auto") reason = "adaptive auto applied";
      else if (adaptiveSource) reason = "adaptive manual applied";
      else reason = "manual test active";
    }
    if (baselinePrior && activeStages.length) reason = "empty/pre-upgrade baseline seed; normal coffee learning";
    return { valid: true, reason, activeStages, s3ShapeActive, adaptiveSource:baselinePrior?null:adaptiveSource, baselinePrior, sourceBasketContext:overrideContext };
  }

  function s3ShapeStatus() {
    const os = testOverrideStatus();
    const out = { enabled: false, reason: os.valid ? "flat S3" : os.reason, earlyCommand: null, earlySeconds: null, midCommand: null, midSeconds: null, lateCommand: null };
    if (!os.valid || !os.s3ShapeActive) return out;
    const q = state.testOverrides && state.testOverrides.s3Shape;
    if (!q || typeof q !== "object") return out;
    const early = Number(q.earlyCommand), mid = Number(q.midCommand), late = Number(q.lateCommand);
    const earlySeconds = Number(q.earlySeconds), midSeconds = Number(q.midSeconds);
    if (![early,mid,late,earlySeconds,midSeconds].every(Number.isFinite)) return { ...out, reason: "stored S3 shape rejected: non-finite value" };
    if (early < LIMITS.commandFlowMin || early > LIMITS.commandFlowMax ||
        mid < LIMITS.commandFlowMin || mid > LIMITS.commandFlowMax ||
        late < LIMITS.commandFlowMin || late > LIMITS.commandFlowMax) {
      return { ...out, reason: "stored S3 shape rejected: command outside hard limits" };
    }
    if (earlySeconds < 3 || earlySeconds > 30 || midSeconds < 3 || midSeconds > 30) {
      return { ...out, reason: "stored S3 shape rejected: timing outside 3–30 s" };
    }
    if (!(early <= mid && mid <= late)) return { ...out, reason: "stored S3 shape rejected: commands must be non-decreasing" };
    const boundedRise = (a,b) => b <= Math.max(a + 0.25, a * 1.35) + 1e-9;
    if (!boundedRise(early,mid) || !boundedRise(mid,late)) {
      return { ...out, reason: "stored S3 shape rejected: adjacent rise exceeds test bound" };
    }
    return {
      enabled: true, reason: "DECAY COMP TEST",
      earlyCommand: round(early,3),
      earlySeconds: round(earlySeconds,1),
      midCommand: round(mid,3),
      midSeconds: round(midSeconds,1),
      lateCommand: round(late,3)
    };
  }

  function manualTestCommand(stage) {
    const status = testOverrideStatus();
    if (!status.valid) return null;
    const q = state.testOverrides && state.testOverrides.stages ? state.testOverrides.stages[stage] : null;
    if (!q || String(q.mode) !== "manual") return null;
    const v = Number(q.command);
    return Number.isFinite(v) ? clampCommandFlow(v) : null;
  }

  function baseStageCommandFlow(realFlow) {
    return clampCommandFlow(resolvedCommandFlow(realFlow));
  }

  function resolvedStageCommandFlow(stage, realFlow) {
    // v0.1.38 keeps scale feedback advisory-only. A user may explicitly select a
    // bounded MANUAL TEST command per stage from DIAG / CAL; this is static for
    // the entire shot, never learned/applied while espresso is running, and does
    // not modify the saved calibration LUT.
    const manual = manualTestCommand(stage);
    return manual === null ? baseStageCommandFlow(realFlow) : manual;
  }


  // Internal "manual" is an execution override, not proof of user authorship.
  function normalizeLearningLevel(v) {
    const aliases={conservative:"保守",gentle:"温和",normal:"正常",aggressive:"激进"};
    return ["保守","温和","正常","激进"].includes(v)?v:aliases[String(v||"").toLowerCase()]||"正常";
  }
  function learningPolicy(v) {
    const name=normalizeLearningLevel(v===undefined&&state.cfg?state.cfg.adaptiveLearningLevel:v),rank=["保守","温和","正常","激进"].indexOf(name);
    const rows=[
      {deadband:8,gain:.18,single:false,largeSingle:false,s1:[.04,.04],s2:[.05,.10],s3:[.04,.04]},
      {deadband:8,gain:.25,single:false,largeSingle:true,s1:[.05,.04],s2:[.08,.20],s3:[.05,.05]},
      {deadband:8,gain:.35,single:true,largeSingle:true,s1:[.10,.08],s2:[.12,.35],s3:[.08,.075]},
      {deadband:5,gain:.55,single:true,largeSingle:true,s1:[.15,.12],s2:[.20,.60],s3:[.12,.125]}
    ];return {name,rank,qualityWidth:rank===3?1.3:1,...rows[rank]};
  }
  function learningAdmission(run) {
    const factor=learningPolicy(run&&run.config&&run.config.adaptiveLearningLevel).qualityWidth;
    return {factor,r2:base=>round(1-(1-base)*factor,6),seconds:base=>base/factor,samples:base=>Math.ceil(base/factor),spread:base=>base*factor};
  }
  function scalarLearningSuggestion(label,key,current,previous,policy,steadyLarge) {
    const opt={deadbandPct:policy.deadband,maxVariability:policy.rank===0?(key==="s1"?.18:.15):.25,gain:policy.gain,maxFraction:policy[key][0],maxAbs:policy[key][1],
      rule:`${policy.name}: ±${policy.deadband}% band; ${key.toUpperCase()} step ≤${round(policy[key][0]*100,1)}% / ${policy[key][1]} ml/s`};
    if(!current)return scalarConsensusSuggestion(label,current,previous,opt);
    const target=Number(current.targetGS),command=Number(current.command),measured=Number(current.measured),ratio=measured/target;
    if(!(target>0&&command>=.1&&command<=8&&Number.isFinite(measured)&&ratio>=.2&&ratio<=3))return {usable:false,action:"LIMITED / HOLD",confidence:"INSUFFICIENT",reason:"Response outside numeric learning envelope; inspect output and execution",maxStepRule:opt.rule};
    const error=(ratio-1)*100,maySingle=policy.single||policy.largeSingle&&steadyLarge;
    if(!maySingle){const out={...scalarConsensusSuggestion(label,current,previous,opt),learningLevel:policy.name};if(!previous)out.reason="Selected learning policy requires another clean observation; changed commands remain eligible historical references";return out;}
    if(Math.abs(error)<=policy.deadband)return {usable:true,action:"HOLD",confidence:"MEDIUM",targetGS:target,currentCommandMlS:command,measuredGS:measured,suggestedCommandMlS:command,repeatCount:previous?2:1,maxStepRule:opt.rule,learningLevel:policy.name,reason:"Current clean output is inside the learning band; retain this command"};
    const prev=previous&&Number(previous.measured)>0?Number(previous.measured):null;
    const variability=prev===null?null:Math.abs(measured-prev)/((measured+prev)/2);
    const agreement=prev!==null&&Math.sign(prev-target)===Math.sign(measured-target)&&variability<=.35*policy.qualityWidth;
    const modeled=agreement?measured*.8+prev*.2:measured,damping=prev!==null&&!agreement?.5:1;
    const delta=command*Math.max(-opt.maxFraction,Math.min(opt.maxFraction,(target/modeled-1)*policy.gain*damping));
    const value=round(clampCommandFlow(command+Math.max(-opt.maxAbs,Math.min(opt.maxAbs,delta))),3);
    const out={usable:true,action:Math.abs(value-command)<.005?"HOLD":"ADJUST",confidence:prev!==null&&!agreement?"LOW":"MEDIUM",targetGS:target,currentCommandMlS:command,measuredGS:round(modeled,3),currentGS:measured,
      previousGS:prev,variabilityPct:variability===null?null:round(variability*100,1),suggestedCommandMlS:value,repeatCount:prev===null?1:2,errorPct:round(error,1),maxStepRule:opt.rule,learningLevel:policy.name,
      reason:prev!==null&&!agreement?"Current clean shot requests a bounded correction; differing history reduces the step instead of blocking learning":"Current clean shot requests a bounded next-shot correction; comparable history is a reference, not a mandatory identical-command repeat"};
    if(previous&&previous.comparisonModel){out.comparisonModel=previous.comparisonModel;out.previousCommandMlS=previous.originalCommandMlS;out.previousActualGS=previous.originalMeasuredGS;}
    return out;
  }
  function stage3ReferenceEvidence(current,previous) {
    if(!current||!previous||!Array.isArray(current.source)||!Array.isArray(previous.source)||current.source.length!==3||previous.source.length!==3||previous.stall||previous.stallQualitative)return null;
    const source=[];
    for(let i=0;i<3;i++){
      const a=current.source[i],b=previous.source[i],ratio=Number(a.command)/Number(b.command);
      if(!(ratio>=.5&&ratio<=2&&Number(b.measured)>0&&Number(b.r2)>=1-.1*learningPolicy().qualityWidth&&Number(b.seconds)>=1.2/learningPolicy().qualityWidth))return null;
      source.push({...b,command:Number(a.command),measured:round(Number(b.measured)*ratio,3),originalCommandMlS:b.command,originalMeasuredGS:b.measured,seconds:Number(a.seconds)||b.seconds});
    }
    const total=source.reduce((n,x)=>n+x.seconds,0),overall=source.reduce((n,x)=>n+x.measured*x.seconds,0)/total;
    return {...previous,targetGS:current.targetGS,source,overallGS:overall,lateToEarlyRatio:source[2].measured/source[0].measured,
      earlySeconds:current.earlySeconds,midSeconds:current.midSeconds,measurementBasis:current.measurementBasis,comparisonModel:"per-frame command and timing reference model"};
  }
  function projectS3Commands(values,old,policy,weights) {
    const [fraction,absolute]=policy.s3,lo=old.map(v=>Math.max(LIMITS.commandFlowMin,v*(1-fraction),v-absolute)),hi=old.map(v=>Math.min(LIMITS.commandFlowMax,v*(1+fraction),v+absolute));
    const blocks=[];
    for(let i=0;i<3;i++){
      const w=Math.max(.01,Number(weights&&weights[i])||1),v=Math.max(lo[i],Math.min(hi[i],values[i]));
      blocks.push({indices:[i],sum:v*w,weight:w,lo:lo[i],hi:hi[i],v});
      while(blocks.length>1&&blocks[blocks.length-2].v>blocks[blocks.length-1].v){
        const b=blocks.pop(),a=blocks.pop(),x={indices:a.indices.concat(b.indices),sum:a.sum+b.sum,weight:a.weight+b.weight,lo:Math.max(a.lo,b.lo),hi:Math.min(a.hi,b.hi)};
        if(x.lo>x.hi)return old.slice();x.v=Math.max(x.lo,Math.min(x.hi,x.sum/x.weight));blocks.push(x);
      }
    }
    const out=[];for(const b of blocks)for(const i of b.indices)out[i]=b.v;
    for(let i=1;i<3;i++){
      const cap=Math.max(out[i-1]+.25,out[i-1]*1.35);
      if(out[i]>cap){out[i]=Math.max(lo[i],cap);if(out[i]>cap)out[i-1]=Math.min(hi[i-1],Math.max(out[i-1],Math.min(out[i]-.25,out[i]/1.35)));}
    }
    const rounded=out.map(x=>round(x,3));
    return rounded.every((x,i)=>Number.isFinite(x)&&x>=lo[i]-.001&&x<=hi[i]+.001&&(i===0||x>=rounded[i-1]-.001&&x<=Math.max(rounded[i-1]+.25,rounded[i-1]*1.35)+.001))?rounded:old.slice();
  }
  function stage3SingleSuggestion(current,previous,policy) {
    if(!current||current.stall||current.stallQualitative||!Array.isArray(current.source)||current.source.length!==3)return null;
    const target=Number(current.targetGS),source=current.source;
    if(!(target>0)||!source.every(x=>Number(x.measured)/target>=.2&&Number(x.measured)/target<=3&&Number(x.command)>=.1&&Number(x.command)<=8&&Number(x.r2)>=1-.1*policy.qualityWidth&&Number(x.seconds)>=1.2/policy.qualityWidth))return null;
    const large=source.some(x=>Math.abs(Number(x.measured)/target-1)>=.2),maySingle=policy.single||policy.largeSingle&&large;
    if(!maySingle)return null;
    const [fraction,absolute]=policy.s3,old=source.map(x=>Number(x.command));
    const raw=source.map((x,i)=>{
      const measured=Number(x.measured),prior=previous&&previous.source&&previous.source[i],p=prior&&Number(prior.measured);
      if(Math.abs(measured/target-1)*100<=policy.deadband)return old[i];
      const agrees=p>0&&Math.sign(p-target)===Math.sign(measured-target)&&Math.abs(p-measured)/((p+measured)/2)<=.35*policy.qualityWidth;
      const response=agrees?measured*.8+p*.2:measured,damping=p>0&&!agrees?.5:1;
      // Proportional reverse mapping: next command = old * target / measured,
      // damped 0.9. The old policy.gain factor under-shot (S3 field data climbed
      // 0.63 -> 0.81 while the correct steady command was ~0.72).
      const delta=Math.max(-absolute,Math.min(absolute,(target/response-1)*old[i]*.9*damping));
      return round(clampCommandFlow(old[i]+delta),3);
    });
    const rawProposedCommands=raw.slice(),projected=projectS3Commands(raw,old,policy,source.map(x=>x.seconds));raw.splice(0,3,...projected);
    if(raw.some((v,i)=>v<LIMITS.commandFlowMin||v>LIMITS.commandFlowMax||Math.abs(v-old[i])>absolute+.001||Math.abs(v/old[i]-1)>fraction+.002))return null;
    const changed=raw.some((v,i)=>Math.abs(v-old[i])>=.005),out={usable:true,action:changed?"LEVEL + SHAPE":"HOLD",confidence:previous&&source.some((x,i)=>{const p=previous.source&&previous.source[i]&&Number(previous.source[i].measured);return p>0&&(Math.sign(p-target)!==Math.sign(Number(x.measured)-target)||Math.abs(p-Number(x.measured))/((p+Number(x.measured))/2)>.35*policy.qualityWidth);})?"LOW":"MEDIUM",learningLevel:policy.name,targetGS:target,overallGS:current.overallGS,status:current.status,
      lateToEarlyRatio:current.lateToEarlyRatio,repeatCount:previous?2:1,sourceFrames:source.map(x=>({name:x.name,commandMlS:x.command,measuredGS:x.measured,r2:x.r2,windowS:x.seconds})),
      reason:changed?"Current clean S3 frame responses request a bounded next-shot level and shape correction; history adjusts confidence and damping":"Current S3 frame responses are inside the learning band; retain the shape",
      maxStepRule:`${policy.name}: S3 step ≤${round(fraction*100,1)}% / ${absolute} ml/s per frame; original shape bounds retained`};
    out.rawProposedCommands=rawProposedCommands;
    if(changed)out.suggestedShape={earlyCommand:round(raw[0],3),earlySeconds:current.earlySeconds,midCommand:round(raw[1],3),midSeconds:current.midSeconds,lateCommand:round(raw[2],3)};
    return out;
  }


  function stageCommandOrigin(stage, shape) {
    const os=testOverrideStatus(),x=state.testOverrides;
    if(!os.valid||!x)return "original";
    const q=shape?x.s3Shape:x.stages&&x.stages[stage];
    if(!q||(shape?q.enabled!==true:q.mode!=="manual"))return "original";
    if(["original","adaptive","manual","retained"].includes(q.origin))return q.origin;
    if(x.adaptiveSource)return "adaptive"; // Legacy aggregate provenance; future saves are per-stage.
    if(x.manualCurveSource&&x.manualCurveSource.mode!=="lut-reset")return "manual";
    return "retained"; // Legacy unattributed override is not called a user edit.
  }
  function s2NearbyEvidence(current,previous,key) {
    if(!current||!previous||!(Number(current.targetGS)/Number(previous.targetGS)>=.5&&Number(current.targetGS)/Number(previous.targetGS)<=2))return null;
    const a=Number(current.command),b=Number(previous.command),ratio=a/b;
    if(!(a>0&&b>0&&ratio>=.5&&ratio<=2&&Number(previous.measured)>0&&Number(previous.r2)>=1-.1*learningPolicy().qualityWidth&&Number(key==="s1"?previous.transitS:previous.seconds)>=(key==="s1"?.9:1.2)/learningPolicy().qualityWidth))return null;
    return {...previous,command:a,measured:round(Number(previous.measured)*ratio,3),
      originalCommandMlS:b,originalMeasuredGS:Number(previous.measured),comparisonModel:"nearby-command local proportional model"};
  }
  function s2AdaptiveSuggestion(run,current,previous) {
    const chain=current&&current.liveTrimChain;
    if(chain){
      const target=Number(run&&run.config&&run.config.stage2Flow);
      if(!chain.usable)return {usable:false,action:"SATURATED / HOLD",confidence:"LOW",targetGS:round(target,3),reason:chain.reason+"; hold the next-shot S2 command",maxStepRule:"single-shot chain: command rose but cup flow did not; do not learn a LUT offset"};
      const need=chain.gain>0?chain.startCommandMlS+(target-chain.startGS)/chain.gain:chain.commandMlS;
      const suggested=clampCommandFlow(Math.max(chain.startCommandMlS,Math.min(LIMITS.commandFlowMax,chain.commandMlS+(need-chain.commandMlS)*0.9)));
      return {usable:true,action:"LUT COMPENSATE",confidence:"MEDIUM",targetGS:round(target,3),currentCommandMlS:round(chain.commandMlS,3),measuredGS:round(chain.endGS,3),suggestedCommandMlS:round(suggested,3),errorPct:round((chain.endGS/target-1)*100,1),maxStepRule:"single-shot chain: reverse the measured gain, 0.9 damping, bounded by the command limit",reason:chain.reason+"; chain "+chain.startCommandMlS+"->"+chain.commandMlS+" ml/s moved cup flow "+chain.startGS+"->"+chain.endGS+" g/s (gain "+round(chain.gain,2)+"); next shot "+round(suggested,3)+" ml/s"};
    }
    const tail=current&&current.tailGain;
    if(tail&&!previous){
      const target=Number(run&&run.config&&run.config.stage2Flow),need=Number(target)/Number(tail.k),cur=Number(run&&run.config&&run.config.stage2CommandMlS);
      if(Number.isFinite(need)&&Number.isFinite(cur)&&cur>0&&Number.isFinite(target)&&target>0){
        const pol=learningPolicy(run&&run.config&&run.config.adaptiveLearningLevel),[fraction,absolute]=pol.s2;
        const raw=cur+(need-cur)*0.9;
        const bounded=Math.max(cur-cur*fraction,cur-absolute,Math.min(cur+cur*fraction,cur+absolute,raw));
        const suggested=clampCommandFlow(bounded);
        return {usable:true,action:"LUT COMPENSATE",confidence:"MEDIUM",targetGS:round(target,3),currentCommandMlS:round(cur,3),measuredGS:tail.tailMeanGS,suggestedCommandMlS:round(suggested,3),errorPct:tail.tailErrorPct,tailGain:tail,maxStepRule:pol.name+" S2 step ≤"+round(fraction*100,1)+"% / "+absolute+" ml/s; single-shot steady tail reverse with 0.9 damping",reason:"steady tail "+tail.tailMeanGS+" g/s at "+tail.machineFlowMlS+" ml/s (gain "+round(tail.k,2)+"); next shot "+round(suggested,3)+" ml/s"};
      }
    }
    const policy=learningPolicy(run&&run.config&&run.config.adaptiveLearningLevel),q=controlOutputQuality(run,"stage2"),err=current&&current.targetGS>0?(Number(current.measured)/Number(current.targetGS)-1)*100:0;
    const large=!!(current&&q.available&&q.windows>=2&&q.tailRippleCVPct<=12&&Math.abs(err)>=20&&Math.abs(q.tailErrorPct)>=15&&Math.sign(err)===Math.sign(q.tailErrorPct));
    return {...scalarLearningSuggestion("S2","s2",current,previous,policy,large),outputQuality:q};
  }
  function utf8ByteLength(v) {let bytes=0;for(let i=0;i<v.length;i++){const c=v.charCodeAt(i);if(c<128)bytes++;else if(c<2048)bytes+=2;else if(c>=0xd800&&c<=0xdbff&&i+1<v.length&&v.charCodeAt(i+1)>=0xdc00&&v.charCodeAt(i+1)<=0xdfff){bytes+=4;i++;}else bytes+=3;}return bytes;}
  function historyPersistenceAudit(runId) {
    const rows=state.persistentHistoryFile&&state.persistentHistoryFile.shots||[],saved=rows.find(x=>x.runId===runId);
    const verified=(state.historyVerifiedRunIds||[]).includes(runId);
    return {storageKey:STORAGE_HISTORY_FILE,loaded:!!state.persistentHistoryLoaded,probeVerified:!!state.storageProbeVerified,
      storageVerified:state.persistentHistoryAvailable===true,savePending:!!(state.pendingHistoryWrite||state.historyWriteDirty),records:rows.length,
      runId:runId||null,currentRecordPresent:!!saved,currentS2EvidencePresent:!!(saved&&saved.evidence&&saved.evidence.s2),
      currentRunReadbackVerified:verified&&state.persistentHistoryAvailable===true,lastReadbackAt:state.historyLastReadbackAt||null,
      status:state.persistentHistoryAvailable===false?"History session only; persistent save not verified":verified?"Current shot history readback verified":saved?"Current shot history awaiting readback":"Current shot history not saved yet",
      detail:state.persistentHistoryStatus||"",bytes:state.historyWriteBytes||0};
  }
  function compactLiveHistory(report) {
    if(!report)return null;
    const reasons={};for(const x of report.trace||[])if(x.kind==="check"){const k=x.reason||x.decision||"unknown";reasons[k]=(reasons[k]||0)+1;}
    // Preserve every issued action/ACK/target/fault; routine check rows are a histogram.
    // The current-shot full trace and CSV remain untouched.
    return {...report,trace:(report.trace||[]).filter(x=>x.kind!=="check"),checkReasons:reasons,historyTraceFormat:"actions-plus-check-counts-v1"};
  }


  function fullShotRecord(run) {
    if (!run) return null;
    return {
      samples: run.samples || null,
      rawScaleSamples: run.rawScaleSamples || null,
      events: run.events || null,
      liveFlowTrim: run.liveFlowTrim && typeof run.liveFlowTrim === "object"
        ? { ...run.liveFlowTrim, trace: (run.liveFlowTrim.trace || []).map(x => ({ ...x })) }
        : null
    };
  }

  function historyExportPayload() {
    const file = state.persistentHistoryFile || null;
    const shots = file && Array.isArray(file.shots) ? file.shots : [];
    return { kind: "HyperExHistoryExport", schema: 1, pluginVersion: PLUGIN_VERSION, exportedAt: new Date().toISOString(), writerVersion: file && file.writerVersion || null, count: shots.length, shots: shots.slice() };
  }

  function commandFlowSummary() {
    if (!state.cfg) return {};
    const rows = {};
    for (const [stage, real] of [["stage1",state.cfg.stage1Flow],["stage2",state.cfg.stage2Flow],["stage3",state.cfg.stage3Flow]]) {
      const base = baseStageCommandFlow(real);
      const manual = manualTestCommand(stage);
      rows[stage] = { desired: round(real,3), lut: round(base,3), effective: round(manual === null ? base : manual,3), mode: manual === null ? "auto" : "manual",origin:stageCommandOrigin(stage,false) };
    }
    const os = testOverrideStatus();
    const shape = s3ShapeStatus();
    const adaptiveSource = os.valid && !os.baselinePrior && state.testOverrides && state.testOverrides.adaptiveSource && typeof state.testOverrides.adaptiveSource === "object"
      ? {
          runId: String(state.testOverrides.adaptiveSource.runId || ""),
          appliedAt: String(state.testOverrides.adaptiveSource.appliedAt || ""),
          mode: String(state.testOverrides.adaptiveSource.mode || "")
        }
      : null;
    const appliedProfile = {
      stage1: { desiredGS: rows.stage1.desired, lutCommandMlS: rows.stage1.lut, commandMlS: rows.stage1.effective, mode: rows.stage1.mode,origin:rows.stage1.origin },
      stage2: { desiredGS: rows.stage2.desired, lutCommandMlS: rows.stage2.lut, commandMlS: rows.stage2.effective, mode: rows.stage2.mode,origin:rows.stage2.origin },
      stage3: shape.enabled
        ? { desiredGS: rows.stage3.desired, lutCommandMlS: rows.stage3.lut, mode: "shape",origin:stageCommandOrigin("stage3",true), flatCommandMlS: rows.stage3.effective, shape: { ...shape } }
        : { desiredGS: rows.stage3.desired, lutCommandMlS: rows.stage3.lut, mode: rows.stage3.mode,origin:rows.stage3.origin, flatCommandMlS: rows.stage3.effective, shape: { enabled:false, reason:shape.reason } }
    };
    return {
      stage1DesiredGS: rows.stage1.desired, stage1LutCommandMlS: rows.stage1.lut, stage1CommandMlS: rows.stage1.effective, stage1Mode: rows.stage1.mode,stage1Origin:rows.stage1.origin,
      stage2DesiredGS: rows.stage2.desired, stage2LutCommandMlS: rows.stage2.lut, stage2CommandMlS: rows.stage2.effective, stage2Mode: rows.stage2.mode,stage2Origin:rows.stage2.origin,
      stage3DesiredGS: rows.stage3.desired, stage3LutCommandMlS: rows.stage3.lut,
      stage3FlatCommandMlS: rows.stage3.effective,
      stage3CommandMlS: shape.enabled ? shape.midCommand : rows.stage3.effective,
      stage3Mode: shape.enabled ? "shape" : rows.stage3.mode,stage3Origin:stageCommandOrigin("stage3",shape.enabled),
      s3Shape: shape,
      appliedProfile,
      adaptiveSource,
      manualCurveSource: os.valid&&!os.baselinePrior&&state.testOverrides?state.testOverrides.manualCurveSource||null:null,
      manualTestActiveStages: os.activeStages || [], manualTestStatus: os.reason || "none"
    };
  }

  async function refreshFlowMultiplier(force, strict) {
    const now = Date.now();
    if (!force && finiteOrNull(state.flowMultiplierCurrent) !== null && now - state.flowMultiplierReadAtMs < 3000) {
      return finiteOrNull(state.flowMultiplierCurrent);
    }
    try {
      const r = await api('/machine/calibration', { method: 'GET' });
      const j = await r.json();
      const v = Number(j && j.flowMultiplier);
      if (Number.isFinite(v)) {
        noteMultiplierChange(v);
        state.flowMultiplierCurrent = v;
        state.flowMultiplierReadAtMs = now;
        recomputeCalibrationUsability();
        return v;
      }
    } catch (error) {
      log(`Could not read DE1 flowMultiplier: ${error.message || error}`);
      if (strict) throw error;
    }
    if (strict) throw new Error('Fresh DE1 flowMultiplier readback unavailable');
    return finiteOrNull(state.flowMultiplierCurrent) !== null ? finiteOrNull(state.flowMultiplierCurrent) : null;
  }

  async function writeFlowMultiplier(value, reason) {
    const v = Math.max(0.13, Math.min(2.0, Number(value)));
    if (!Number.isFinite(v)) throw new Error('invalid flowMultiplier');
    if (multiplierClose(state.flowMultiplierCurrent, v)) return v;
    await api('/machine/calibration', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flowMultiplier: v })
    });
    noteMultiplierChange(v);
    state.flowMultiplierCurrent = v;
    state.flowMultiplierReadAtMs = Date.now();
    recomputeCalibrationUsability();
    log(`DE1 flowMultiplier -> ${v.toFixed(3)}${reason ? ` (${reason})` : ''}.`);
    return v;
  }

  function inHyperExScope(title) {
    return !!state.cfg && (title === state.cfg.profileTitle || isCalibrationProfileTitle(title));
  }

  async function enterHyperExScopedMultiplier(reason, expectedRevision) {
    if (state.scopeMode !== "hyperex") return;
    const mapBase = calibrationBaseMultiplier();
    const target = state.calibrationArmed && finiteOrNull(state.calibrationPendingMultiplier) !== null
      ? finiteOrNull(state.calibrationPendingMultiplier) : mapBase;
    if (!Number.isFinite(target)) return;
    if (state.scopeChangeBusy) return;
    state.scopeChangeBusy = true;
    try {
      const current = await refreshFlowMultiplier(true, expectedRevision !== undefined);
      if (expectedRevision !== undefined) checkProfileSelection(expectedRevision);
      if (!Number.isFinite(current)) return;
      if (finiteOrNull(state.scopedOriginalMultiplier) === null) { state.scopedOriginalMultiplier = current; storageWrite(STORAGE_SCOPED_ORIGINAL, String(current)); }
      await writeFlowMultiplier(target, reason || "HyperEx scoped");
      state.scopedAppliedMultiplier = target;
    } finally {
      state.scopeChangeBusy = false;
      if (!inHyperExScope(state.workflowTitle) && finiteOrNull(state.scopedOriginalMultiplier) !== null) {
        await restoreHyperExScopedMultiplier('selection left scope during multiplier update');
      }
    }
  }

  async function restoreHyperExScopedMultiplier(reason) {
    if (finiteOrNull(state.scopedOriginalMultiplier) === null) return;
    if (state.scopeChangeBusy) return;
    state.scopeChangeBusy = true;
    const original = finiteOrNull(state.scopedOriginalMultiplier);
    let restored = false;
    try {
      await writeFlowMultiplier(original, reason || "restore previous");
      restored = true;
    } catch (error) {
      log(`Could not restore previous flowMultiplier ${original}: ${error.message || error}`);
    } finally {
      if (restored) {
        state.scopedOriginalMultiplier = null;
        state.scopedAppliedMultiplier = null;
        storageWrite(STORAGE_SCOPED_ORIGINAL, '');
      }
      state.scopeChangeBusy = false;
    }
  }

  function diagnosticEvent(name, data) {
    const run = state.diagnosticCurrent;
    if (!run) return;
    if(name==="learning_fault"){if(!Array.isArray(run.learningExecutionFaults))run.learningExecutionFaults=[];run.learningExecutionFaults.push({phase:state.phase,reason:data&&data.reason||"execution fault"});}
    if(name==="command_accepted"&&data&&data.machineState==="skipStep")run.learningSkipCount=(run.learningSkipCount||0)+1;
    run.events.push({
      tMs: Math.max(0, Date.now() - run.startedAtMs),
      name: String(name || "event"),
      phase: state.phase,
      data: data && typeof data === "object" ? data : (data === undefined ? {} : { value: data })
    });
    if (run.events.length > 300) run.events.shift();
  }

  function startDiagnostics(kind) {
    if (!state.cfg || (!state.cfg.diagnosticEnabled && !state.cfg.liveFlowTrimTest && kind !== "calibration")) {
      state.diagnosticCurrent = null;
      return;
    }
    state.diagnosticRunSeq += 1;
    const now = Date.now();
    state.diagnosticCurrent = {
      schema: 3,
      kind: String(kind || "hyperex"),
      pluginVersion: PLUGIN_VERSION,
      runId: `${now}-${state.diagnosticRunSeq}`,
      profileTitle: state.workflowTitle || (state.cfg ? state.cfg.profileTitle : ""),
      startedAt: new Date(now).toISOString(),
      startedAtMs: now,
      endedAt: null,
      result: null,
      config: {
        activeRelease:activeReleaseEnabled(state.cfg),adaptiveLearningLevel:state.cfg.adaptiveLearningLevel,
        basketContext: kind === "calibration" ? "empty" : state.cfg.basketContext,
        baselinePrior: baselineFeedForwardPayload(),
        stage1PressureLimit: state.cfg.stage1PressureLimit,
        stage2PressureLimit: state.cfg.stage2PressureLimit,
        stage3PressureLimit: state.cfg.stage3PressureLimit,
        stage1Flow: state.cfg.stage1Flow,
        stage1LutCommandMlS: baseStageCommandFlow(state.cfg.stage1Flow),
        stage1CommandMlS: resolvedStageCommandFlow("stage1", state.cfg.stage1Flow),
        stage1CommandOrigin:stageCommandOrigin("stage1",false),
        stage1CommandMode: manualTestCommand("stage1") === null ? "auto" : "manual",
        stage1Weight: state.cfg.stage1Weight,
        soakSeconds: state.cfg.soakSeconds,
        s2StartupPlan: kind === "calibration" ? null : stage2StartupPlan(),
        stage2Flow: state.cfg.stage2Flow,
        stage2LutCommandMlS: baseStageCommandFlow(state.cfg.stage2Flow),
        stage2CommandMlS: resolvedStageCommandFlow("stage2", state.cfg.stage2Flow),
        stage2CommandOrigin:stageCommandOrigin("stage2",false),
        stage2CommandMode: manualTestCommand("stage2") === null ? "auto" : "manual",
        stage2Weight: state.cfg.stage2Weight,
        stage3Flow: state.cfg.stage3Flow,
        stage3LutCommandMlS: baseStageCommandFlow(state.cfg.stage3Flow),
        stage3CommandMlS: s3ShapeStatus().enabled ? s3ShapeStatus().midCommand : resolvedStageCommandFlow("stage3", state.cfg.stage3Flow),
        stage3CommandOrigin:stageCommandOrigin("stage3",s3ShapeStatus().enabled),
        stage3CommandMode: s3ShapeStatus().enabled ? "shape" : (manualTestCommand("stage3") === null ? "auto" : "manual"),
        stage3Shape: s3ShapeStatus(),
        finalWeight: state.cfg.finalWeight,
        sampleIntervalMs: state.cfg.diagnosticSampleIntervalMs,
        flowMultiplier: state.flowMultiplierCurrent,
        profileTruthVerified: !!state.runtimeProfileVerified,
        profileTruthSchema: 3,
        adaptiveFingerprint: adaptiveHistoryFingerprint(),
        profileReadbackAt: state.profileReadbackAt,
        machineProfileUploadAcknowledged: !!state.machineProfileAckKey,
        workflowProfileCommands: profileCommandSummaryFromProfile(state.workflowProfile),
        workflowProfileExecution: normalizedProfileExecution(state.workflowProfile),
        calibrationMode: state.calibrationMode,
        calibrationCommands: calibrationCommands(),
        calibrationProgram: calibrationProgram(),
        calibrationStepSeconds: calibrationModeConfig().stepSeconds,
        calibrationSettleSeconds: calibrationModeConfig().settleSeconds,
        calibrationWindowSeconds: calibrationModeConfig().windowSeconds,
        calibrationHardStopG: calibrationModeConfig().hardStopG
      },
      samples: [],
      rawScaleSamples: [],
      events: []
    };
    state.diagnosticLastSampleAtMs = 0;
    state.latestRawDwDt = null;
    diagnosticEvent(kind === "calibration" ? "calibration_start" : "sequence_start", {
      rawWeight: round(state.latestRawWeight, 3),
      flowMultiplier: round(state.flowMultiplierCurrent, 4)
    });
    log(`${kind === "calibration" ? "Flow calibration" : "Diagnostic"} capture started (${state.cfg.diagnosticSampleIntervalMs} ms target cadence).`);
  }

  function diagnosticSample(source, force) {
    const run = state.diagnosticCurrent;
    if (!run || !state.cfg || (!state.cfg.diagnosticEnabled && !state.cfg.liveFlowTrimTest)) return;
    const now = Date.now();
    if (!force && state.diagnosticLastSampleAtMs && now - state.diagnosticLastSampleAtMs < state.cfg.diagnosticSampleIntervalMs) return;
    state.diagnosticLastSampleAtMs = now;
    const scaleAgeMs = state.latestScaleAtMs ? now - state.latestScaleAtMs : null;
    const machineFlow = Number(state.lastFlow);
    const scaleFlow = Number(state.latestWeightFlow);
    const ratio = Number.isFinite(machineFlow) && Math.abs(machineFlow) >= 0.15 && Number.isFinite(scaleFlow)
      ? scaleFlow / machineFlow : null;
    run.samples.push({
      tMs: Math.max(0, now - run.startedAtMs),
      source: String(source || "sample"),
      phase: state.phase,
      machineState: state.lastMachineState,
      substate: state.lastSubstate,
      profileFrame: state.lastFrame,
      targetFlowMlS: round(state.lastTargetFlow, 3),
      desiredRealFlowGS: round(desiredRealFlowForPhase(state.phase), 3),
      targetPressureBar: round(state.lastTargetPressure, 3),
      machineFlowMlS: round(state.lastFlow, 3),
      machineTelemetryValid: state.lastMachineTelemetryValid,
      machineAgeMs: state.lastMachineAtMs ? Math.max(0,now-state.lastMachineAtMs) : null,
      pressureBar: round(state.lastPressure, 3),
      machineWeightFlowGS: round(state.lastMachineWeightFlow, 3),
      rawScaleWeightG: round(state.latestRawWeight, 3),
      rawScaleDwDtGS: round(state.latestRawDwDt, 3),
      decaidWeightFlowGS: round(state.latestWeightFlow, 3),
      // Backward-compatible aliases retained from v0.1.18.
      scaleWeightG: round(state.latestRawWeight, 3),
      scaleFlowGS: round(state.latestWeightFlow, 3),
      cumulativeWeightG: round(state.cumulativeWeight, 3),
      scaleAgeMs: Number.isFinite(scaleAgeMs) ? Math.max(0, Math.round(scaleAgeMs)) : null,
      gflowToMachineFlow: round(ratio, 4)
    });
    if (run.samples.length > 3000) run.samples.shift();
  }

  function median(values) {
    const a = values.filter(Number.isFinite).sort((x, y) => x - y);
    if (!a.length) return null;
    const i = Math.floor(a.length / 2);
    return a.length % 2 ? a[i] : (a[i - 1] + a[i]) / 2;
  }

  function average(values) {
    const a = values.filter(Number.isFinite);
    return a.length ? a.reduce((sum, v) => sum + v, 0) / a.length : null;
  }

  function diagnosticRawRegression(run, phase) {
    if (!run || !Array.isArray(run.rawScaleSamples)) return null;
    let raw = phaseRawSamples(run, phase);
    if (raw.length < 4) return null;

    const firstTMs = Number(raw[0].tMs);
    const settleSeconds = phase === "stage1" ? 0.25 : phase === "stage2" ? 0 : 2.0;
    let use = raw.filter(s => Number(s.tMs) - firstTMs >= settleSeconds * 1000);
    // Stage 1 is intentionally short (4 g trigger). If the settle cut leaves too
    // little data, fall back to almost the whole phase rather than reporting an
    // instantaneous dW/dt average.
    if (use.length < 5) use = raw.filter(s => Number(s.tMs) - firstTMs >= 100);
    if (use.length < 4) use = raw;

    const points = use.map(s => ({ x: rawTimeSecondsForSample(s), y: Number(s.weightG) }));
    const reg = linearRegression(points);
    if (!reg) return null;
    const times = points.map(p => p.x).filter(Number.isFinite);
    const span = times.length ? Math.max(...times) - Math.min(...times) : 0;
    return {
      slope: round(reg.slope, 3),
      r2: round(reg.r2, 5),
      samples: reg.n,
      seconds: round(span, 2),
      settleSeconds: round(settleSeconds, 2)
    };
  }

  function rawTimeSecondsForSample(s) {
    const ts = Number(s && s.scaleTimestampSeconds);
    return Number.isFinite(ts) ? ts : Number(s && s.tMs) / 1000;
  }

  function phaseRawSamplesUntrimmed(run, phase) {
    if (!run || !Array.isArray(run.rawScaleSamples)) return [];
    let raw = run.rawScaleSamples
      .filter(s => s.phase === phase && Number.isFinite(Number(s.weightG)))
      .slice()
      .sort((a, b) => Number(a.tMs) - Number(b.tMs));
    if (!raw.length) return raw;
    let lastReset = -1;
    for (let i = 0; i < raw.length; i++) if (raw[i].tareReset) lastReset = i;
    if (lastReset >= 0) raw = raw.slice(lastReset + 1);
    return raw;
  }

  // Detect sustained RAW weight rise; a single derivative spike is not outflow.
  // The onset is backdated to the first rising increment, not detection completion.
  function stage2CupOnset(run,source) {
    const raw=source||phaseRawSamplesUntrimmed(run,"stage2"),target=Number(run&&run.config&&run.config.stage2Flow)||5;
    const threshold=Math.max(.05,target*.01),seen=new Set(),window=[];
    for(const row of raw){
      const stamp=finiteOrNull(row.scaleTimestampSeconds),weight=finiteOrNull(row.weightG),at=finiteOrNull(row.tMs);
      if(stamp===null||weight===null||at===null||seen.has(stamp))continue;
      if(window.length&&(stamp<=window[window.length-1].x||stamp-window[window.length-1].x>.6||weight<window[window.length-1].y-.2))window.length=0;
      seen.add(stamp);window.push({x:stamp,y:weight,at});while(window.length&&stamp-window[0].x>2.05+1e-9)window.shift();
      if(window.length<4||stamp-window[0].x<.39||weight-window[0].y<.2-1e-9)continue;
      const fit=linearRegression(window);if(!fit||fit.r2<.85||fit.slope<threshold)continue;
      const rise=window.findIndex(p=>p.y-window[0].y>=.05-1e-9);let onsetIndex=Math.max(0,rise-1);while(onsetIndex>0&&window[onsetIndex].y>window[onsetIndex-1].y+1e-9)onsetIndex--;const start=window[onsetIndex];
      const event=(run.events||[]).find(x=>x.name==="stage2_start"),phaseStart=event&&Number.isFinite(Number(event.tMs))?Number(event.tMs):Number(raw[0].tMs);
      return {detected:true,startMs:start.at,delayS:round(Math.max(0,start.at-phaseStart)/1000,3),confirmedAtMs:at,thresholdGS:threshold,basis:"sustained RAW weight rise"};
    }
    return {detected:false,startMs:null,confirmedAtMs:null,thresholdGS:threshold,basis:"waiting for sustained RAW weight rise"};
  }
  function phaseRawSamples(run,phase) {
    const raw=phaseRawSamplesUntrimmed(run,phase);if(phase!=="stage2")return raw;
    const onset=stage2CupOnset(run,raw);return onset.detected?raw.filter(s=>Number(s.tMs)>=onset.startMs):[];
  }
  // Shot timeline for the refill design: frame confirmation -> onset (S2 start)
  // -> cup flow reaches the cutoff -> return acknowledged.
  function s2RefillTimeline(run) {
    const tr=run&&run.liveFlowTrim&&run.liveFlowTrim.trace||[],plan=run&&run.config&&run.config.s2StartupPlan||null;
    const start=(run&&run.events||[]).find(x=>x.name==="stage2_start");
    const onset=stage2CupOnset(run);
    const boost=tr.find(x=>x.kind==="write"&&x.startupAction==="boost");
    const returns=tr.filter(x=>x.kind==="startup-boost-ended"),ret=returns[0];
    const complete=tr.find(x=>x.kind==="startup-complete"&&Number(x.frame)===1);
    const origin=start&&Number.isFinite(Number(start.tMs))?Number(start.tMs):null;
    const rel=v=>origin!==null&&v!==undefined&&v!==null&&Number.isFinite(Number(v))?round((Number(v)-origin)/1000,2):null;
    const cutoff=run&&run.liveFlowTrim&&run.liveFlowTrim.startupExecution&&run.liveFlowTrim.startupExecution.cutoff||null;
    const overlapStart=onset.detected&&origin!==null?Math.max(Number(onset.startMs),origin):null;
    const overlapEnd=ret&&Number.isFinite(Number(ret.tMs))?Number(ret.tMs):null;
    return {stage2StartMs:origin,onsetMs:onset.detected?Number(onset.startMs):null,onsetConfirmedMs:onset.confirmedAtMs||null,
      boostMs:boost?Number(boost.tMs):null,cutoffAtMs:cutoff&&Number.isFinite(Number(cutoff.atMs))?Number(cutoff.atMs):null,
      returnMs:overlapEnd,returnCount:returns.length,completeMs:complete?Number(complete.tMs):null,
      relative:{onsetS:rel(onset.startMs),boostS:rel(boost&&boost.tMs),cutoffS:rel(cutoff&&cutoff.atMs),returnS:rel(overlapEnd),completeS:rel(complete&&complete.tMs)},
      overlap:overlapStart!==null&&overlapEnd!==null&&overlapEnd>=overlapStart?{fromMs:overlapStart,toMs:overlapEnd,seconds:round((overlapEnd-overlapStart)/1000,2)}:null,
      cutoff,plan};
  }
  function regressionForRawSamples(samples) {
    if (!Array.isArray(samples) || samples.length < 4) return null;
    const points = samples.map(s => ({ x: rawTimeSecondsForSample(s), y: Number(s.weightG) }));
    const reg = linearRegression(points);
    if (!reg) return null;
    const xs = points.map(p => p.x).filter(Number.isFinite);
    const span = xs.length ? Math.max(...xs) - Math.min(...xs) : 0;
    return {
      slope: round(reg.slope, 3),
      r2: round(reg.r2, 5),
      samples: reg.n,
      seconds: round(span, 2)
    };
  }

  function stage1StartupMetrics(run) {
    const admission=learningAdmission(run),gainMin=admission.seconds(2.5),transitMin=admission.seconds(.90),sampleMin=admission.samples(8),activeMin=admission.seconds(1.25),r2Min=admission.r2(.90);
    const raw = phaseRawSamples(run, "stage1");
    if (raw.length < 6) return null;
    const pts = raw.map(s => ({ ...s, x: rawTimeSecondsForSample(s), y: Number(s.weightG) }))
      .filter(s => Number.isFinite(s.x) && Number.isFinite(s.y));
    if (pts.length < 6) return null;
    const head = pts.slice(0, Math.min(4, pts.length)).map(p => p.y);
    const tail = pts.slice(Math.max(0, pts.length - 4)).map(p => p.y);
    const baseline = median(head);
    const finalWeight = median(tail);
    const gain = Number(finalWeight) - Number(baseline);
    if (!Number.isFinite(gain) || gain < 1.0) return null;

    const crossing = threshold => {
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        if (a.y < threshold && b.y >= threshold && b.x > a.x) {
          const f = Math.max(0, Math.min(1, (threshold - a.y) / Math.max(1e-9, b.y - a.y)));
          return a.x + (b.x - a.x) * f;
        }
      }
      const exact = pts.find(p => p.y >= threshold);
      return exact ? exact.x : null;
    };

    const firstRiseThreshold = baseline + Math.min(0.20, Math.max(0.08, gain * 0.05));
    const tRise = crossing(firstRiseThreshold);
    const t20 = crossing(baseline + gain * 0.20);
    const t80 = crossing(baseline + gain * 0.80);
    const t0 = pts[0].x;
    const tEnd = pts[pts.length - 1].x;
    const midSamples = Number.isFinite(t20) && Number.isFinite(t80)
      ? pts.filter(p => p.x >= t20 && p.x <= t80) : [];
    const midReg = regressionForRawSamples(midSamples);
    const transit = Number.isFinite(t20) && Number.isFinite(t80) && t80 > t20 ? t80 - t20 : null;
    const midFlow = Number.isFinite(transit) && transit > 0 ? (gain * 0.60) / transit : null;
    const activeSeconds = Number.isFinite(tRise) && tEnd > tRise ? tEnd - tRise : null;
    const activeGain = Number.isFinite(tRise) ? Math.max(0, finalWeight - firstRiseThreshold) : null;
    const activeFlow = Number.isFinite(activeSeconds) && activeSeconds > 0 ? activeGain / activeSeconds : null;
    const target = desiredRealForRunPhase(run, "stage1");
    const errorPct = Number.isFinite(target) && target > 0 && Number.isFinite(midFlow)
      ? (midFlow - target) / target * 100 : null;
    let confidence = "INSUFFICIENT";
    const rejectionReasons = [];
    if (gain < gainMin) rejectionReasons.push(`collected gain < ${round(gainMin,2)} g`);
    if (!Number.isFinite(transit) || transit < transitMin) rejectionReasons.push(`20–80% transit < ${round(transitMin,2)} s`);
    if (midSamples.length < sampleMin) rejectionReasons.push(`20–80% samples < ${sampleMin}`);
    if (!Number.isFinite(activeSeconds) || activeSeconds < activeMin) rejectionReasons.push(`active duration < ${round(activeMin,2)} s`);
    if (!midReg || !Number.isFinite(Number(midReg.r2)) || Number(midReg.r2) < r2Min) rejectionReasons.push(`20–80% regression R² < ${r2Min}`);
    if (gain >= gainMin && Number.isFinite(transit) && transit >= transitMin && midSamples.length >= sampleMin && Number.isFinite(activeSeconds) && activeSeconds >= activeMin) {
      confidence = midReg && Number(midReg.r2) >= r2Min ? "MEDIUM" : "LOW";
    }
    return {
      midStartScaleS:t20,midEndScaleS:t80,
      admission:{factor:admission.factor,minGainG:gainMin,minTransitS:transitMin,minSamples:sampleMin,minActiveS:activeMin,minR2:r2Min},
      gainG: round(gain, 3),
      firstRiseDelayS: Number.isFinite(tRise) ? round(Math.max(0, tRise - t0), 2) : null,
      transit20to80S: Number.isFinite(transit) ? round(transit, 2) : null,
      midFlowGS: Number.isFinite(midFlow) ? round(midFlow, 3) : null,
      midR2: midReg ? midReg.r2 : null,
      activeFlowGS: Number.isFinite(activeFlow) ? round(activeFlow, 3) : null,
      activeSeconds: Number.isFinite(activeSeconds) ? round(activeSeconds, 2) : null,
      targetGS: round(target, 3),
      errorPct: Number.isFinite(errorPct) ? round(errorPct, 1) : null,
      confidence,
      midSampleCount: midSamples.length, rejectionReasons,
      qualityReason: rejectionReasons.length ? rejectionReasons.join("; ") : "Startup quality gates passed"
    };
  }

  function stage1StartupAdvisory(run) {
    const m = stage1StartupMetrics(run);
    const cfg = run && run.config ? run.config : {};
    let current = Number(cfg.stage1CommandMlS);
    if (!Number.isFinite(current)) current = null;
    if (!m || !Number.isFinite(Number(m.midFlowGS)) || !Number.isFinite(Number(m.targetGS)) || Number(m.targetGS) <= 0) {
      return { phase: "stage1", basis: "20–80% startup trajectory", confidence: "INSUFFICIENT", action: "REPEAT", message: "S1 startup trajectory is not long/clean enough for a numeric test range. Keep the current command and repeat.", referenceCommandMlS: null, referenceRangeMlS: null, currentCommandMlS: current === null ? null : round(current,3) };
    }
    const err = Number(m.errorPct);
    if (m.confidence === "INSUFFICIENT" || !Number.isFinite(err) || current === null) {
      return { phase: "stage1", basis: "20–80% startup trajectory", confidence: m.confidence || "INSUFFICIENT", action: "REPEAT", message: "S1 whole-phase regression is startup-sensitive; the 20–80% trajectory is still insufficient for a numeric adjustment.", referenceCommandMlS: null, referenceRangeMlS: null, currentCommandMlS: current === null ? null : round(current,3), startupMetrics: m };
    }
    if (Math.abs(err) <= 8) {
      return { phase: "stage1", basis: "20–80% startup trajectory", confidence: m.confidence, action: "HOLD", message: `S1 20–80% trajectory is within ${Math.abs(err).toFixed(1)}% of target. Keep the current command; startup delay is reported separately.`, referenceCommandMlS: round(current,3), referenceRangeMlS: [round(current,3),round(current,3)], currentCommandMlS: round(current,3), ratio: round(Number(m.targetGS)/Number(m.midFlowGS),3), errorPct: round(err,1), startupMetrics: m };
    }
    const ratio = Number(m.targetGS) / Number(m.midFlowGS);
    const delta = ratio - 1;
    const fractions = m.confidence === "MEDIUM" ? [0.20, 0.35] : [0.10, 0.20];
    const factorA = Math.max(0.85, Math.min(1.15, 1 + delta * fractions[0]));
    const factorB = Math.max(0.85, Math.min(1.15, 1 + delta * fractions[1]));
    const cmdA = clampCommandFlow(current * factorA), cmdB = clampCommandFlow(current * factorB);
    const range = [round(Math.min(cmdA,cmdB),3), round(Math.max(cmdA,cmdB),3)];
    const midpoint = round((range[0]+range[1])/2,3);
    return {
      phase: "stage1", basis: "20–80% startup trajectory", confidence: m.confidence, action: "REFERENCE RANGE",
      message: `${err < 0 ? "Higher" : "Lower"} S1 command is indicated by the startup 20–80% trajectory. This range is intentionally small; first-rise delay is not treated as flow error.`,
      currentCommandMlS: round(current,3), referenceCommandMlS: midpoint, referenceRangeMlS: range,
      ratio: round(ratio,3), errorPct: round(err,1), startupMetrics: m
    };
  }

  function stage3StabilityDiagnostics(run) {
    let raw = phaseRawSamples(run, "stage3");
    if (raw.length < 10) return null;
    const firstMs = Number(raw[0].tMs);
    raw = raw.filter(s => Number(s.tMs) - firstMs >= 2000);
    if (raw.length < 10) return null;
    const timed = raw.map(s => ({ ...s, x: rawTimeSecondsForSample(s) })).filter(s => Number.isFinite(s.x));
    if (timed.length < 10) return null;
    const t0 = timed[0].x, t1 = timed[timed.length - 1].x, span = t1 - t0;
    if (!(span > 6)) return null;
    const q1 = t0 + span * 0.25, q3 = t0 + span * 0.75;
    const seg = (name, lo, hi, includeHi) => {
      const a = timed.filter(s => s.x >= lo && (includeHi ? s.x <= hi : s.x < hi));
      const r = regressionForRawSamples(a);
      return { name, ...(r || { slope: null, r2: null, samples: a.length, seconds: null }) };
    };
    const early = seg("EARLY", t0, q1, false);
    const mid = seg("MID", q1, q3, false);
    const late = seg("LATE", q3, t1, true);
    const target = desiredRealForRunPhase(run, "stage3");
    const ratioLateEarly = Number.isFinite(Number(early.slope)) && Number(early.slope) > 0 && Number.isFinite(Number(late.slope))
      ? Number(late.slope) / Number(early.slope) : null;

    const stallWindowSeconds = 6.0;
    const rawThreshold = Math.max(0.20, Number.isFinite(Number(target)) ? Number(target) * 0.15 : 0.20);
    const machineThreshold = 0.40;
    let stall = null;
    for (let i = 0; i < timed.length; i++) {
      const end = timed[i].x;
      const start = end - stallWindowSeconds;
      if (start < t0) continue;
      const w = timed.filter(s => s.x >= start && s.x <= end);
      if (w.length < 8) continue;
      const reg = regressionForRawSamples(w);
      if (!reg || !Number.isFinite(Number(reg.slope))) continue;
      const machine = average(w.map(s => Number(s.machineFlowMlS)));
      const activeFraction = w.filter(s => Number(s.machineFlowMlS) >= machineThreshold).length / w.length;
      if (Number.isFinite(machine) && machine >= machineThreshold && activeFraction >= 0.70 && Number(reg.slope) <= rawThreshold) {
        stall = {
          suspected: true,
          startS: round(start - t0, 1),
          endS: round(end - t0, 1),
          rawSlopeGS: reg.slope,
          rawR2: reg.r2,
          machineFlowMlS: round(machine, 3),
          thresholdGS: round(rawThreshold, 3),
          windowS: stallWindowSeconds
        };
        break;
      }
    }
    let shapeFrames = null;
    const shapeCfg = run && run.config && run.config.stage3Shape && run.config.stage3Shape.enabled ? run.config.stage3Shape : null;
    if (shapeCfg) {
      const frameSpec = [
        { frame: 2, name: "S3 EARLY", commandMlS: Number(shapeCfg.earlyCommand), plannedSeconds: Number(shapeCfg.earlySeconds) },
        { frame: 3, name: "S3 MID", commandMlS: Number(shapeCfg.midCommand), plannedSeconds: Number(shapeCfg.midSeconds) },
        { frame: 4, name: "S3 LATE", commandMlS: Number(shapeCfg.lateCommand), plannedSeconds: null }
      ];
      shapeFrames = frameSpec.map(spec => {
        const allFrame = timed.filter(x => Number(x.profileFrame) === spec.frame);
        if (!allFrame.length) return { ...spec, slope: null, r2: null, seconds: null, samples: 0 };
        const f0 = allFrame[0].x;
        const useFrame = allFrame.filter(x => x.x - f0 >= 0.75);
        const use = useFrame.length >= 6 ? useFrame : allFrame;
        const reg = regressionForRawSamples(use);
        return {
          ...spec,
          commandMlS: Number.isFinite(spec.commandMlS) ? round(spec.commandMlS,3) : null,
          plannedSeconds: Number.isFinite(spec.plannedSeconds) ? round(spec.plannedSeconds,1) : null,
          ...(reg || { slope: null, r2: null, seconds: null, samples: use.length })
        };
      });
    }
    const decayQuality = [early, mid, late].every(x => Number.isFinite(Number(x.r2)) && Number(x.r2) >= 0.90 && Number.isFinite(Number(x.slope)) && Number(x.slope) > 0);
    const decay = decayQuality && Number.isFinite(ratioLateEarly) && ratioLateEarly < 0.75;
    return {
      spanS: round(span,2), early, mid, late, shapeFrames,
      lateToEarlyRatio: Number.isFinite(ratioLateEarly) ? round(ratioLateEarly,3) : null,
      lateDecay: !!decay,
      stall: stall || { suspected: false, thresholdGS: round(rawThreshold,3), machineThresholdMlS: machineThreshold, windowS: stallWindowSeconds },
      status: stall ? "STALL SUSPECTED" : decay ? "LATE DECAY" : "STABLE"
    };
  }

  function desiredRealForRunPhase(run, phase) {
    const cfg = run && run.config || {};
    if (phase === "stage1") return finiteOrNull(cfg.stage1Flow);
    if (phase === "stage2") return finiteOrNull(cfg.stage2Flow);
    if (phase === "stage3") return finiteOrNull(cfg.stage3Flow);
    return null;
  }

  function diagnosticPhaseSummary(run, phase) {
    if (!run || !Array.isArray(run.samples)) return null;
    const onset=phase==="stage2"?stage2CupOnset(run):null;
    const all = run.samples.filter(s => s.phase === phase&&(!onset||onset.detected&&Number(s.tMs)>=onset.startMs));
    if (!all.length) return null;
    const firstT = all[0].tMs;
    const settleMs = phase === "stage1" ? 250 : phase === "stage2" ? 0 : 2000;
    const steady = all.filter(s => s.tMs - firstT >= settleMs && Number.isFinite(s.machineFlowMlS) && Math.abs(s.machineFlowMlS) >= 0.15 && Number.isFinite(s.scaleFlowGS));
    const use = steady.length >= 5 ? steady : all.filter(s => Number.isFinite(s.machineFlowMlS) && Math.abs(s.machineFlowMlS) >= 0.15 && Number.isFinite(s.scaleFlowGS));
    const reg = diagnosticRawRegression(run, phase);
    const desired = desiredRealForRunPhase(run, phase);
    const raw = reg && Number.isFinite(Number(reg.slope)) ? Number(reg.slope) : null;
    const errorPct = desired !== null && desired > 0 && raw !== null ? (raw - desired) / desired * 100 : null;
    let validationStatus = "NO DATA";
    if (raw !== null && desired !== null) {
      if (phase === "stage1") {
        const sm = stage1StartupMetrics(run);
        if (!sm || sm.confidence === "INSUFFICIENT" || (reg && Number(reg.seconds) < 1.5)) validationStatus = "STARTUP / REPEAT";
        else if (Math.abs(errorPct) <= 8) validationStatus = "HIT";
        else if (Math.abs(errorPct) <= 25) validationStatus = "NEAR";
        else validationStatus = "STARTUP / REPEAT";
      } else if (Math.abs(errorPct) <= 8) validationStatus = "HIT";
      else if (Math.abs(errorPct) <= 25) validationStatus = "NEAR";
      else validationStatus = "MISS";
    }
    return {
      samples: use.length,
      cupFlowOnset: onset,
      measurementBasis:phase==="stage2"?"RAW cup flow after sustained outflow onset":"RAW phase weight regression",
      desiredRealFlowGS: round(desired, 3),
      commandFlowAvg: round(average(use.map(s => s.targetFlowMlS)), 3),
      machineFlowAvg: round(average(use.map(s => s.machineFlowMlS)), 3),
      gflowAvg: round(average(use.map(s => s.scaleFlowGS)), 3),
      // Retained for CSV/backward diagnostic comparison only. Do not use this
      // instantaneous derivative average as the physical validation reference.
      rawDwDtAvg: round(average(use.map(s => s.rawScaleDwDtGS)), 3),
      rawRegressionGS: raw === null ? null : round(raw, 3),
      rawRegressionR2: reg ? reg.r2 : null,
      rawRegressionSeconds: reg ? reg.seconds : null,
      rawRegressionSamples: reg ? reg.samples : 0,
      rawErrorPct: errorPct === null ? null : round(errorPct, 1),
      validationStatus,
      pressureAvg: round(average(use.map(s => s.pressureBar)), 3),
      ratioMedian: round(median(use.map(s => s.gflowToMachineFlow)), 4),
      ratioAvg: round(average(use.map(s => s.gflowToMachineFlow)), 4)
    };
  }

  function referenceAdvisory(run, phase) {
    if (phase === "stage1") return stage1StartupAdvisory(run);
    const p = diagnosticPhaseSummary(run, phase);
    if (!p || !Number.isFinite(Number(p.desiredRealFlowGS)) || !Number.isFinite(Number(p.rawRegressionGS)) || Number(p.rawRegressionGS) <= 0) {
      return { phase, confidence: "INSUFFICIENT", action: "REPEAT", message: "Not enough usable RAW weight-regression data; keep the current command and repeat an empty-basket validation.", referenceCommandMlS: null, referenceRangeMlS: null, currentCommandMlS: null };
    }
    const target = Number(p.desiredRealFlowGS);
    const measured = Number(p.rawRegressionGS);
    const err = Number(p.rawErrorPct);
    const r2 = Number(p.rawRegressionR2);
    const seconds = Number(p.rawRegressionSeconds);
    const cfg = run && run.config ? run.config : {};
    const key = phase === "stage1" ? "stage1CommandMlS" : phase === "stage2" ? "stage2CommandMlS" : "stage3CommandMlS";
    let current = Number(cfg[key]);
    if (!Number.isFinite(current)) current = Number(p.commandFlowAvg);
    if (!Number.isFinite(current)) current = null;

    let confidence = "LOW";
    if (phase === "stage1") {
      if (r2 >= 0.88 && seconds >= 2.0) confidence = "MEDIUM";
      else if (r2 >= 0.72 && seconds >= 1.5) confidence = "LOW";
      else confidence = "INSUFFICIENT";
    } else {
      if (r2 >= 0.97 && seconds >= (phase === "stage2" ? 4.0 : 5.0)) confidence = "HIGH";
      else if (r2 >= 0.93 && seconds >= 3.0) confidence = "MEDIUM";
      else if (r2 >= 0.85 && seconds >= 2.0) confidence = "LOW";
      else confidence = "INSUFFICIENT";
    }

    if (!Number.isFinite(err)) {
      return { phase, confidence: "INSUFFICIENT", action: "REPEAT", message: "Regression exists but target error could not be evaluated.", referenceCommandMlS: null, referenceRangeMlS: null, currentCommandMlS: current };
    }
    if (phase === "stage3") {
      const stability = stage3StabilityDiagnostics(run);
      if (stability && stability.stall && stability.stall.suspected && current !== null) {
        const lo = clampCommandFlow(current * 1.10), hi = clampCommandFlow(current * 1.20);
        return { phase, confidence: "MEDIUM", action: "STALL CHECK", message: `LOW-FLOW STALL SUSPECTED: machine flow stayed active while a ${stability.stall.windowS}s RAW-weight window fell to ${stability.stall.rawSlopeGS} g/s. Try a modestly higher static S3 command and repeat; do not rewrite the LUT from one stall run.`, currentCommandMlS: round(current,3), referenceCommandMlS: round((lo+hi)/2,3), referenceRangeMlS: [round(lo,3),round(hi,3)], ratio: round(target/measured,3), errorPct: round(err,1), stability };
      }
      if (stability && stability.lateDecay && current !== null) {
        const segR2 = [stability.early, stability.mid, stability.late].map(x => Number(x && x.r2)).filter(Number.isFinite);
        const segConfidence = segR2.length === 3 && Math.min(...segR2) >= 0.97 ? "HIGH" : "MEDIUM";
        return { phase, confidence: segConfidence, action: "SHAPE ADVISED", message: `S3 whole-phase average can hide late decay: LATE/EARLY=${stability.lateToEarlyRatio}. Prefer the NEXT SHOT adaptive-shape suggestion over a flat static correction.`, currentCommandMlS: round(current,3), referenceCommandMlS: round(current,3), referenceRangeMlS: [round(current,3),round(current,3)], ratio: round(target/measured,3), errorPct: round(err,1), stability };
      }
    }
    if (confidence === "INSUFFICIENT") {
      return { phase, confidence, action: "REPEAT", message: "Regression quality/window is insufficient; keep the current LUT command and repeat the empty-basket validation.", referenceCommandMlS: null, referenceRangeMlS: null, currentCommandMlS: current === null ? null : round(current,3) };
    }
    if (Math.abs(err) <= 8) {
      const suffix = confidence === "LOW" ? " Data confidence is low, so repeat once before treating this as confirmed." : "";
      return { phase, confidence, action: "HOLD", message: `Within ${Math.abs(err).toFixed(1)}% of target; keep the current command.${suffix}`, referenceCommandMlS: current === null ? null : round(current,3), referenceRangeMlS: current === null ? null : [round(current,3),round(current,3)], currentCommandMlS: current === null ? null : round(current,3) };
    }
    if (current === null) {
      return { phase, confidence, action: "REPEAT", message: "A regression exists, but the command used by this shot is unavailable. Repeat before changing anything.", referenceCommandMlS: null, referenceRangeMlS: null, currentCommandMlS: null };
    }

    // Reference RANGE only. Move only part of the theoretical ratio correction;
    // the lower-quality the run, the smaller the proposed step. This deliberately
    // avoids a full target/measured jump (e.g. 0.569 -> ~1.05) after one shot.
    const rawRatio = target / measured;
    const delta = rawRatio - 1.0;
    let fractions = confidence === "HIGH" ? [0.60,0.85] : confidence === "MEDIUM" ? [0.40,0.65] : [0.25,0.40];
    if (phase === "stage1") fractions = confidence === "MEDIUM" ? [0.25,0.40] : [0.15,0.25];
    const factorA = 1.0 + delta * fractions[0];
    const factorB = 1.0 + delta * fractions[1];
    const factorLoCap = phase === "stage1" ? 0.80 : 0.70;
    const factorHiCap = phase === "stage1" ? 1.20 : 1.35;
    const boundedA = Math.max(factorLoCap, Math.min(factorHiCap, factorA));
    const boundedB = Math.max(factorLoCap, Math.min(factorHiCap, factorB));
    const cmdA = clampCommandFlow(current * boundedA);
    const cmdB = clampCommandFlow(current * boundedB);
    const range = [round(Math.min(cmdA,cmdB),3), round(Math.max(cmdA,cmdB),3)];
    const midpoint = round((range[0] + range[1]) / 2,3);
    const direction = err < 0 ? "higher" : "lower";
    const qualityText = confidence === "LOW" ? "LOW confidence · manual test only; repeat the empty-basket run before treating the result as calibration." : `${confidence} confidence · still a manual test range, not an automatic correction.`;
    const caveat = phase === "stage1" ? " S1 is startup-transient, so its range is intentionally narrower." : "";
    return {
      phase, confidence, action: "REFERENCE RANGE",
      message: `A ${direction} command is indicated. ${qualityText}${caveat}`,
      currentCommandMlS: round(current,3),
      referenceCommandMlS: midpoint,
      referenceRangeMlS: range,
      ratio: round(rawRatio,3), errorPct: round(err,1)
    };
  }


  function stageActuatorEvidence(run, phase) {
    {
      const controlled=controlLearningAssessment(run,phase);
      if(controlled.applicable)return {...(controlled.actuator||{}),eligible:!!(controlled.actuator&&controlled.actuator.eligible),reason:controlled.actuator&&controlled.actuator.eligible?"Actual observed target/pressure quality passed":controlled.reason};
    }
    const cfg=run && run.config || {};
    if (cfg.basketContext !== "coffee") return {eligible:true,reason:"Empty/legacy engineering context"};
    const limit=finiteOrNull(cfg[phase+"PressureLimit"]);
    const onset=phase==="stage2"?stage2CupOnset(run):null;
    const all=(run.samples||[]).filter(x=>x.phase===phase && finiteOrNull(x.tMs)!==null&&(!onset||onset.detected&&Number(x.tMs)>=onset.startMs));
    if (!all.length || limit===null || limit<=0) return {eligible:false,reason:"Coffee actuator evidence missing; keep command"};
    const start=Math.min(...all.map(x=>Number(x.tMs)));
    // Exclude the first second of actuator transients. No interpolated or cup
    // derivative data are used to pretend the machine reached its command.
    const rows=all.filter(x=>Number(x.tMs)-start>=1000);
    let usable=0,nearLimit=0,underCommand=0;
    for (const row of rows) {
      const pressure=finiteOrNull(row.pressureBar), flow=finiteOrNull(row.machineFlowMlS);
      let command=finiteOrNull(cfg[phase+"CommandMlS"]);
      if (phase==="stage3" && cfg.stage3Shape && cfg.stage3Shape.enabled) {
        const frame=finiteOrNull(row.profileFrame);
        command=frame===2?finiteOrNull(cfg.stage3Shape.earlyCommand):
          frame===3?finiteOrNull(cfg.stage3Shape.midCommand):
          frame===4?finiteOrNull(cfg.stage3Shape.lateCommand):null;
      }
      if (row.machineTelemetryValid!==true || finiteOrNull(row.machineAgeMs)===null || Number(row.machineAgeMs)>1000 || pressure===null || pressure<0 || flow===null || flow<0 || command===null || command<=0) continue;
      usable++;
      if (pressure>=limit*0.95) nearLimit++;
      if (flow<command*0.70) underCommand++;
    }
    const pressureFraction=usable?nearLimit/usable:1;
    const underCommandFraction=usable?underCommand/usable:1;
    const eligible=usable>=4 && usable>=rows.length*0.8 && pressureFraction<0.20 && underCommandFraction<0.25;
    const reason=usable<4 || usable<rows.length*0.8 ? "Coffee machine telemetry/frame coverage insufficient; keep command" :
      pressureFraction>=0.20 ? "Pressure limiter may be active; cup-flow target may be unreachable. Keep command, do not increase pressure" :
      underCommandFraction>=0.25 ? "Machine flow is not tracking the shot command; withhold numeric correction" :
      "Coffee pressure and actuator quality gates passed";
    return {eligible,reason,pressureLimitBar:limit,samples:usable,expectedSamples:rows.length,
      pressureLimitedFraction:round(pressureFraction,3),underCommandFraction:round(underCommandFraction,3)};
  }

  function stage1AdaptiveEvidence(run) {
    const controlled=stage1LiveLearning(run);if(controlled.applicable)return controlled.eligible?controlled.evidence:null;
    if (!stageActuatorEvidence(run, "stage1").eligible) return null;
    if (!run || (run.kind || "hyperex") !== "hyperex") return null;
    const m = stage1StartupMetrics(run);
    const cfg = run.config || {};
    const target = Number(desiredRealForRunPhase(run, "stage1"));
    const command = Number(cfg.stage1CommandMlS);
    if (!m || m.confidence !== "MEDIUM" || !Number.isFinite(target) || target <= 0 || !Number.isFinite(command)) return null;
    const admission=learningAdmission(run);
    const measured = Number(m.midFlowGS), r2 = Number(m.midR2), transit = Number(m.transit20to80S), activeSeconds = Number(m.activeSeconds);
    if (!Number.isFinite(measured) || measured <= 0 || !Number.isFinite(r2) || r2 < admission.r2(.90) || !Number.isFinite(transit) || transit < admission.seconds(.90) || !Number.isFinite(activeSeconds) || activeSeconds < admission.seconds(1.25)) return null;
    return {
      runId: run.runId, targetGS: round(target,3), command: round(command,3), measured: round(measured,3),
      errorPct: round((measured-target)/target*100,1), confidence:"MEDIUM", r2:round(r2,5),
      transitS:round(transit,2), activeSeconds:round(activeSeconds,2), firstRiseDelayS:m.firstRiseDelayS
    };
  }

  // S2 response shape uses source-timestamp regression, never instantaneous dW/dt.
  // The delay is measured separately from rise time; neither is a level error.
  function startupSignaturesCompatible(a,b) {
    try {a=JSON.parse(a||"[]");b=JSON.parse(b||"[]");}catch(_){return false;}
    if(!Array.isArray(a)||!Array.isArray(b)||![...a,...b].every(x=>Number.isFinite(x)&&x>0))return false;
    if(!a.length||!b.length)return a.length===b.length;
    if(Math.abs(a.length-b.length)>1)return false;
    const close=(x,y)=>Math.abs(x/y-1)<=.15;
    return close(a[0],b[0])&&close(a[a.length-1],b[b.length-1])&&Math.abs(a[a.length-1]/a[0]-b[b.length-1]/b[0])<=.10;
  }
  function stage2StartupMetrics(run) {
    const admission=learningAdmission(run);
    const cfg=run&&run.config||{},target=finiteOrNull(cfg.stage2Flow),base=finiteOrNull(cfg.stage2CommandMlS);
    const result={schema:2,admissionFactor:admission.factor,basis:"windowed RAW source-time regression",eligible:false,reason:"S2 startup data insufficient",targetGS:target,baseCommandMlS:base,s1CommandMlS:finiteOrNull(cfg.stage1CommandMlS),
      s1ControlSignature:JSON.stringify((run&&run.liveFlowTrim&&run.liveFlowTrim.trace||[]).filter(x=>x.kind==="write"&&Number(x.frame)===0).map(x=>round(Number(x.commandMlS),4)))};
    if(!run||target===null||target<=0||base===null||base<=0)return result;
    const rows=(run.rawScaleSamples||[]).filter(x=>x.phase==="stage2"&&Number(x.profileFrame)===1).slice().sort((a,b)=>a.tMs-b.tMs);
    if(rows.length<12)return result;
    const phaseStart=(run.events||[]).find(x=>x.name==="stage2_start");
    const first=phaseStart&&Number.isFinite(phaseStart.tMs)&&phaseStart.tMs<=rows[0].tMs?phaseStart.tMs:rows[0].tMs,seen=new Set(),points=[],flows=[];let lastStamp=null,lastAt=null;
    for(const x of rows){
      const stamp=finiteOrNull(x.scaleTimestampSeconds),weight=finiteOrNull(x.weightG),at=finiteOrNull(x.tMs);
      if(stamp===null||weight===null||at===null||seen.has(stamp))continue;
      if(x.tareReset&&points.length||lastStamp!==null&&(stamp<=lastStamp||stamp-lastStamp>.6)||lastAt!==null&&at-lastAt>600){result.reason="S2 startup scale discontinuity";return result;}
      seen.add(stamp);lastStamp=stamp;lastAt=at;points.push({x:stamp,y:weight});while(points.length&&stamp-points[0].x>.85)points.shift();
      if(points.length<4||stamp-points[0].x<.59)continue;
      const fit=linearRegression(points);if(fit&&fit.r2>=admission.r2(.90)&&fit.slope>=0)flows.push({at:at-first,flow:fit.slope});
    }
    if(flows.length<8||rows[rows.length-1].tMs-first<5000)return result;
    const duration=rows[rows.length-1].tMs-first,tail=flows.filter(x=>x.at>=duration*.6),mean=tail.length?tail.reduce((s,x)=>s+x.flow,0)/tail.length:null;
    const cv=mean>0?Math.sqrt(tail.reduce((s,x)=>s+(x.flow-mean)**2,0)/tail.length)/mean:null;
    const crossing=level=>flows.find((x,i)=>i+2<flows.length&&flows[i+2].at-x.at<=600&&flows.slice(i,i+3).every(q=>q.flow>=level));
    const t20=crossing(target*.2),t80=crossing(target*.8),p20=mean>0?crossing(mean*.2):null,p80=mean>0?crossing(mean*.8):null;
    const targetRise=t20&&t80?round((t80.at-t20.at)/1000,2):null,plateauRise=p20&&p80?round((p80.at-p20.at)/1000,2):null;
    const max=flows.reduce((m,x)=>Math.max(m,x.flow),0),previousPlan=cfg.s2StartupPlan||{};
    Object.assign(result,{firstResponseDelayS:t20?round(t20.at/1000,2):p20?round(p20.at/1000,2):null,targetRise20to80S:targetRise,plateauRise20to80S:plateauRise,
      rise20to80S:plateauRise===null?targetRise:plateauRise,riseBasis:plateauRise===null?"target":"observed plateau",riseReferenceGS:plateauRise===null?target:round(mean,3),
      referenceRiseS:previousPlan.referenceRiseS||null,referenceRiseBasis:previousPlan.referenceRiseBasis||"target",referenceHoldMs:previousPlan.holdMs||null,
      tailMeanGS:mean===null?null:round(mean,3),tailErrorPct:mean===null?null:round((mean/target-1)*100,2),tailCvPct:cv===null?null:round(cv*100,2),
      overshootPct:round(Math.max(0,max/target-1)*100,2),pulseUsed:!!(run.liveFlowTrim&&run.liveFlowTrim.trace||[]).find(x=>x.kind==="write"&&x.startupAction==="boost"),sampleCount:seen.size});
    const machine=(run.samples||[]).filter(x=>x.phase==="stage2"&&Number(x.profileFrame)===1),limit=finiteOrNull(cfg.stage2PressureLimit);
    const usable=machine.filter(x=>x.machineTelemetryValid===true&&finiteOrNull(x.machineAgeMs)!==null&&x.machineAgeMs<=600&&finiteOrNull(x.pressureBar)!==null&&x.pressureBar>=0&&finiteOrNull(x.machineFlowMlS)!==null&&finiteOrNull(x.targetFlowMlS)!==null&&x.targetFlowMlS>0);
    const post=usable.filter(x=>x.tMs-first>=1000),near=usable.filter(x=>x.pressureBar>=limit*.95).length,tracking=post.filter(x=>x.machineFlowMlS>=x.targetFlowMlS*.85).length;
    const headroom=limit>0&&usable.length>=8&&usable.length>=machine.length*.8&&near/usable.length<.10&&post.length>=4&&tracking/post.length>=.9;
    result.headroomPassed=!!headroom;result.machineCoveragePct=round(usable.length/Math.max(1,machine.length)*100,1);result.pressureLimitedPct=round(near/Math.max(1,usable.length)*100,1);
    result.eligible=!!(rows[0].tMs-first<=600&&p20&&p80&&mean>=target*(1-admission.spread(.5))&&mean<=target*(1+admission.spread(.08))&&cv!==null&&cv<=admission.spread(.12)&&result.overshootPct<=admission.spread(8)&&headroom&&assessRunLearningIntegrity(run).eligible);
    result.reason=rows[0].tMs-first>600?"S2 startup onset samples missing":!headroom?"S2 startup pressure or actuator headroom insufficient":!p20||!p80?"S2 rise crossings incomplete":mean<target*(1-admission.spread(.5))||mean>target*(1+admission.spread(.08))?"S2 plateau outside startup-assist range":cv>admission.spread(.12)?"S2 tail ripple too high for startup boost":result.overshootPct>admission.spread(8)?"S2 overshoot; startup boost withheld":result.eligible?"S2 startup shape eligible":"S2 startup integrity check failed";
    return result;
  }
  function startupMetricAllowed(m) {
    if(!m)return false;
    // Schema1 baseline-off was evaluated only AFTER all strict headroom checks.
    const factor=learningPolicy().qualityWidth;
    const statistical=m.schema===2&&m.headroomPassed===true&&["S2 tail ripple too high for startup boost","S2 overshoot; startup boost withheld","S2 plateau outside startup-assist range"].includes(m.reason);
    const legacy=m.schema===1&&m.reason==="S2 baseline off target; learn level before startup boost";
    return !!((m.eligible||legacy||statistical)&&Number.isFinite(m.tailMeanGS)&&m.tailMeanGS>=m.targetGS*(1-.5*factor)&&m.tailMeanGS<=m.targetGS*(1+.08*factor)&&Number.isFinite(m.tailCvPct)&&m.tailCvPct<=12*factor&&Number.isFinite(m.overshootPct)&&m.overshootPct<=8*factor);
  }
  function startupRise(m,basis) {
    const v=basis==="target"?(m.schema===1?m.rise20to80S:m.targetRise20to80S):m.plateauRise20to80S;
    return Number.isFinite(v)&&v>=0?v:null;
  }
  function stage2LegacyStartupPlan() {
    const policy=learningPolicy(),plan={schema:2,enabled:false,reason:"S2 startup needs usable slow-rise evidence",holdMs:0,boostQuanta:0,sourceRunIds:[],learningLevel:policy.name};
    if(!state.cfg.s2StartupAssist||!state.cfg.liveFlowTrimTest){plan.reason="S2 startup assist disabled";return plan;}
    if(!state.persistentHistoryLoaded||!state.storageProbeVerified||state.persistentHistoryAvailable!==true){plan.reason="S2 startup history not verified";return plan;}
    const base=Math.round(resolvedStageCommandFlow("stage2",state.cfg.stage2Flow)*16)/16,key=numericLearningFingerprintKey(adaptiveHistoryFingerprint()),s1=resolvedStageCommandFlow("stage1",state.cfg.stage1Flow);
    if(base+1/16>Math.min(LIMITS.commandFlowMax,base*1.08)){plan.reason="S2 native quantum exceeds startup boost bound";return plan;}
    if(!key){plan.reason="S2 startup history context invalid";return plan;}
    const rows=(state.persistentHistoryFile&&state.persistentHistoryFile.shots||[]).slice().reverse(),candidates=[];
    for(const row of rows){
      if(!historyLearningStatus(row).eligible||numericLearningFingerprintKey(row.fingerprint)!==key)continue;
      const m=row.s2Startup;if(!m||![1,2].includes(m.schema)||!Number.isFinite(m.s1CommandMlS)||Math.abs(m.s1CommandMlS/s1-1)>.5||!Number.isFinite(m.baseCommandMlS)||Math.abs(m.baseCommandMlS/base-1)>.5||!(m.targetGS/state.cfg.stage2Flow>=.5&&m.targetGS/state.cfg.stage2Flow<=2))continue;
      candidates.push({id:row.runId,m});if(candidates.length===2)break;
    }
    plan.sourceRunIds=candidates.map(x=>x.id);if(!candidates.length)return plan;
    const latest=candidates[0].m;if(!startupMetricAllowed(latest)){plan.reason=latest.reason||"S2 latest comparable response does not justify startup boost";return plan;}
    plan.s1ControlSignature=latest.s1ControlSignature||"[]";
    if(latest.pulseUsed){
      const basis=latest.referenceRiseBasis||"target",rise=startupRise(latest,basis),reference=latest.referenceRiseS;
      if(rise===null||!Number.isFinite(reference)||rise>reference*.9){plan.reason="S2 startup boost benefit not demonstrated; return to baseline";return plan;}
      return {...plan,enabled:true,reason:"S2 prior startup boost improved rise without excess ripple or overshoot",boostQuanta:1,holdMs:Math.max(400,Math.min(800,latest.referenceHoldMs||reference*250)),baseCommandMlS:base,referenceRiseS:reference,referenceRiseBasis:basis};
    }
    const basis=latest.schema===2&&startupRise(latest,"observed plateau")!==null?"observed plateau":"target",a=startupRise(latest,basis);
    if(a===null||a<=(policy.rank===3?1:1.2)){plan.reason="S2 rise is already steep enough; hold startup baseline";return plan;}
    const single=policy.single||policy.largeSingle&&a>=2.5&&latest.tailCvPct<=8;
    if(single)return {...plan,enabled:true,reason:"S2 clean slow rise; learning policy permits bounded single-shot startup trial",boostQuanta:1,holdMs:400,baseCommandMlS:base,referenceRiseS:a,referenceRiseBasis:basis};
    if(candidates.length===1){plan.reason="S2 startup needs a second comparable slow-rise shot";return plan;}
    const previous=candidates[1].m,b=startupRise(previous,basis);
    if(!startupMetricAllowed(previous)||previous.pulseUsed||b===null||b<=1.2){plan.reason="S2 latest comparable responses do not justify a startup boost";return plan;}
    if(!startupSignaturesCompatible(plan.s1ControlSignature,previous.s1ControlSignature||"[]")){plan.reason="S2 startup preceding S1 trajectories differ";return plan;}
    if(Math.abs(a-b)/((a+b)/2)>.35){plan.reason="S2 startup rise varies across shots";return plan;}
    return {...plan,enabled:true,reason:"S2 two clean slow-rise shots; one-quantum bounded startup boost",boostQuanta:1,holdMs:Math.round(Math.max(400,Math.min(800,(a+b)/2*250))),baseCommandMlS:base,referenceRiseS:(a+b)/2,referenceRiseBasis:basis};
  }
  function validatedS2RefillSettings(raw,strict) {
    const input=raw===null||raw===undefined?{}:raw;
    if(typeof input!=="object"||Array.isArray(input))throw new Error("S2 refill settings must be an object");
    if(strict&&!S2_REFILL_BASES.includes(input.basis))throw new Error("S2 refill basis changed; reload current curve");
    if(input.basis!==undefined&&!S2_REFILL_BASES.includes(input.basis))throw new Error("S2 refill basis invalid");
    const out={basis:input.basis===undefined?"pump-command":input.basis};
    for(const key of Object.keys(S2_REFILL_DEFAULTS)){
      const value=input[key]===undefined?S2_REFILL_DEFAULTS[key]:input[key],[lo,hi,step]=S2_REFILL_LIMITS[key];
      if(typeof value!=="number"||!Number.isFinite(value)||value<lo||value>hi||Math.abs((value-lo)/step-Math.round((value-lo)/step))>1e-6)throw new Error("S2 refill parameter outside allowed range: "+key);
      out[key]=value;
    }
    return out;
  }
  function validatedRefillPrevious(raw) {
    if(!raw||typeof raw!=="object"||typeof raw.at!=="string"||!Number.isFinite(Date.parse(raw.at)))return null;
    try{return {at:raw.at,before:validatedS2RefillSettings(raw.before,true),after:validatedS2RefillSettings(raw.after,true)};}catch(_){return null;}
  }
  function refillLastShotSnapshot() {
    const local=state.diagnosticLast&&state.diagnosticLast.kind!=="calibration"?state.diagnosticLast:null;
    const saved=(state.persistentHistoryFile&&state.persistentHistoryFile.shots||[]).slice(-1)[0];
    const run=local||saved;if(!run)return null;
    const plan=run.config&&run.config.s2StartupPlan||run.liveFlowTrim&&run.liveFlowTrim.s2StartupPlan;
    if(!plan)return {runId:run.runId,startedAt:run.startedAt||null,available:false};
    const write=(run.liveFlowTrim&&run.liveFlowTrim.trace||[]).find(x=>x.kind==="write"&&x.startupAction==="boost");
    return {runId:run.runId,startedAt:run.startedAt||null,available:true,settings:plan.settings?{...plan.settings}:null,
      basis:plan.settings&&plan.settings.basis||"legacy-cup-target",baseCommandMlS:plan.baseCommandMlS,
      plannedBoostMlS:plan.boostCommandMlS,plannedHoldingMlS:plan.returnCommandMlS==null?plan.baseCommandMlS:plan.returnCommandMlS,executedBoostMlS:write?write.commandMlS:null,
      execution:run.liveFlowTrim&&run.liveFlowTrim.startupExecution||null,timeline:s2RefillTimeline(run)};
  }
  function currentS2RefillSettings(){try{return validatedS2RefillSettings(state.s2RefillSettings);}catch(_){return validatedS2RefillSettings(null);}}
  // CUP-TARGET basis: estimate the pump command this machine needs for the S2
  // cup target, then apply the multiplier. The last clean shot's settled tail
  // is the only machine-specific response evidence; without it the refinement
  // falls back to the profile base pump command.
  function s2RefillPumpEstimate(base,targetGS) {
    const prior=state.diagnosticLast;
    if(!prior||!trustedAdaptiveRun(prior))return null;
    if(numericLearningFingerprintKey(prior.config&&prior.config.adaptiveFingerprint)!==numericLearningFingerprintKey(adaptiveHistoryFingerprint()))return null;
    const q=controlOutputQuality(prior,"stage2"),raw=phaseRawSamples(prior,"stage2");
    if(!q.available||!raw.length)return null;
    const lastWrite=(prior.liveFlowTrim&&prior.liveFlowTrim.trace||[]).filter(x=>x.kind==="write"&&Number(x.frame)===1).slice(-1)[0];
    const previousCommand=lastWrite?Number(lastWrite.commandMlS):Number(prior.config.stage2CommandMlS);
    if(!(previousCommand>0))return null;
    const first=Number(raw[0].tMs),last=Number(raw[raw.length-1].tMs),limit=Number(prior.config.stage2PressureLimit);
    const tail=(prior.samples||[]).filter(x=>x.phase==="stage2"&&Number(x.tMs)>=first+(last-first)*.4);
    const fresh=tail.filter(x=>x.machineTelemetryValid===true&&Number(x.machineAgeMs)<=600&&Number(x.machineFlowMlS)>=previousCommand*.85&&Number(x.machineFlowMlS)<=previousCommand*1.15&&Number(x.pressureBar)<limit*.9);
    if(!(q.tailRippleCVPct<=15.6)||!(q.tailMeanGS>=targetGS*.5&&q.tailMeanGS<=targetGS*1.5))return null;
    if(fresh.length<8||fresh.length<tail.length*.8)return null;
    const estimate=previousCommand*targetGS/Math.max(.1,q.tailMeanGS);
    if(!Number.isFinite(estimate)||estimate<LIMITS.commandFlowMin||estimate>LIMITS.commandFlowMax)return null;
    return {command:estimate,basis:"target-cup-flow observed-tail local model",referenceTailGS:round(q.tailMeanGS,3),sourceRunId:prior.runId,previousCommandMlS:round(previousCommand,4)};
  }
  // Active-release restart has a refill transient, separate from steady S2 LEVEL.
  // No extra profile frames or skips: one bounded write to confirmed frame 1.
  function s2HoldingReference(base,boost) {
    const out={commandMlS:base,basis:"verified profile base; no clean holding reference",sourceRunId:null};
    const run=state.diagnosticLast;if(!run||!trustedAdaptiveRun(run))return out;
    const q=controlOutputQuality(run,"stage2"),raw=phaseRawSamples(run,"stage2");
    if(!q.available||!raw.length||q.tailRippleCVPct>12||q.tailMeanGS<state.cfg.stage2Flow*.5||q.tailMeanGS>state.cfg.stage2Flow*1.5)return out;
    const start=Number(raw[0].tMs),end=Number(raw[raw.length-1].tMs),writes=run.liveFlowTrim&&run.liveFlowTrim.trace||[];
    const known=[Number(run.config.stage2CommandMlS),...writes.filter(x=>x.kind==="write"&&Number(x.frame)===1).map(x=>Number(x.commandMlS))];
    const tail=(run.samples||[]).filter(x=>x.phase==="stage2"&&Number(x.tMs)>=start+(end-start)*.4);
    const good=tail.filter(x=>x.machineTelemetryValid===true&&Number(x.machineAgeMs)<=600&&Number(x.pressureBar)<Number(run.config.stage2PressureLimit)*.9&&known.some(v=>Math.abs(Number(x.targetFlowMlS)-v)<.02)&&Number(x.machineFlowMlS)>=Number(x.targetFlowMlS)*.85&&Number(x.machineFlowMlS)<=Number(x.targetFlowMlS)*1.15);
    if(good.length<8||good.length<tail.length*.8)return out;
    const previous=median(good.map(x=>Number(x.targetFlowMlS)));if(!(previous>0))return out;
    // Partial correction of a settled observed cup response, never the refill spike.
    const requested=previous*(1+.5*(state.cfg.stage2Flow/q.tailMeanGS-1));
    const command=Math.floor((Math.min(boost,base*1.2,8,Math.max(base,requested))+1e-9)*16)/16;
    return {commandMlS:Math.max(base,command),basis:"bounded settled-cup holding reference",sourceRunId:run.runId,referenceTailGS:q.tailMeanGS};
  }
  function stage2StartupPlan() {
    if(!activeReleaseEnabled(state.cfg))return stage2LegacyStartupPlan();
    const settings=currentS2RefillSettings();
    const cupTarget=Number(state.cfg.stage2Flow);
    const raw=resolvedStageCommandFlow("stage2",state.cfg.stage2Flow),base=Math.round(raw*16)/16;
    const estimate=settings.basis==="cup-target"&&cupTarget>0?s2RefillPumpEstimate(base,cupTarget):null;
    const refillBase=estimate?estimate.command:base;
    const plan={schema:5,strategy:"refill-85",enabled:false,reason:"S2 refill assist disabled",baseCommandMlS:base,
      refillPumpBaseMlS:round(refillBase,4),refillTargetFraction:settings.targetPercent/100,cutoffFraction:settings.cutoffPercent/100,
      startDelayMs:settings.startDelayMs,predictionSeconds:.4,holdMs:settings.maxDurationMs,dispatchWindowMs:settings.startDelayMs+4000,approachMs:settings.approachMs,approachWriteIntervalMs:750,settings:{...settings},
      sourceRunIds:estimate?[estimate.sourceRunId]:[],learningLevel:learningPolicy().name};
    if(settings.basis==="cup-target"){plan.refillTargetGS=round(cupTarget,3);if(estimate)plan.referenceTailGS=estimate.referenceTailGS;plan.commandBasis=estimate?estimate.basis:"target-cup-flow base fallback (no observed tail)";}
    if(!state.cfg.s2StartupAssist||!state.cfg.liveFlowTrimTest)return plan;
    if(!Number.isFinite(base)||base<LIMITS.commandFlowMin||base>LIMITS.commandFlowMax){plan.reason="S2 refill base command invalid";return plan;}
    if(!Number.isFinite(refillBase)||refillBase<LIMITS.commandFlowMin||refillBase>LIMITS.commandFlowMax){plan.reason="S2 refill target estimate invalid";return plan;}
    // Percentage applies to the selected basis: the quantized base pump command,
    // or the pump command estimated to deliver the S2 cup target. Never cup g/s.
    const requested=refillBase*settings.targetPercent/100;
    if(settings.basis!=="cup-target")plan.commandBasis="base-pump-command multiplier";
    const ceiling=Math.min(LIMITS.commandFlowMax,refillBase*1.6);
    const boost=Math.floor((Math.min(ceiling,Math.max(refillBase,requested))+1e-9)*16)/16;
    plan.requestedCommandMlS=round(requested,4);plan.commandLimited=requested>ceiling;
    if(boost<base+1/16){plan.reason=requested<=refillBase?"S2 refill target needs no extra command":"S2 refill has no command headroom";return plan;}
    const holding=s2HoldingReference(base,boost);
    const basisReason=settings.basis==="cup-target"?(estimate?"S2 refill aims at the S2 cup target using the observed tail":"S2 refill aims at the S2 cup target; profile base pump command, no clean observed tail"):"S2 configurable refill";
    return {...plan,returnCommandMlS:holding.commandMlS,holdingReference:holding,enabled:true,reason:basisReason+"; measured cup-flow cutoff or safety deadline",maximumExtraCommandMl:round(Math.max(0,boost-base)*plan.holdMs/1000,3),
      boostCommandMlS:boost,boostQuanta:Math.round((boost-base)*16)};
  }
  function s2RefillFlowEstimate(t) {
    const now=Date.now(),seen=new Set(),points=[];
    for(const x of t.run.rawScaleSamples||[]){
      if(x.phase!=="stage2"||Number(x.profileFrame)!==1||x.tMs<t.frameAt-t.run.startedAtMs||now-t.run.startedAtMs-x.tMs>1300)continue;
      if(x.tareReset){points.length=0;seen.clear();}
      const stamp=finiteOrNull(x.scaleTimestampSeconds),weight=finiteOrNull(x.weightG);
      if(stamp===null||weight===null||seen.has(stamp))continue;
      if(points.length&&(stamp<=points[points.length-1].x||stamp-points[points.length-1].x>.6))points.length=0;
      seen.add(stamp);points.push({x:stamp,y:weight,at:x.tMs});
    }
    if(points.length<6||points[points.length-1].x-points[0].x<.6||now-t.run.startedAtMs-points[points.length-1].at>600)return null;
    let tail=points.filter(x=>points[points.length-1].x-x.x<=.75);
    if(tail.length<6)tail=points;
    if(tail[tail.length-1].x-tail[0].x<.6)return null;
    const fit=linearRegression(tail);if(!fit||tail.length<6||fit.r2<.90||fit.slope<0)return null;
    const previous=t.startup.lastEstimate,current={slope:fit.slope,stamp:tail[tail.length-1].x,r2:fit.r2};
    let acceleration=previous&&current.stamp>previous.stamp?(current.slope-previous.slope)/(current.stamp-previous.stamp):0;
    acceleration=Math.max(-t.run.config.stage2Flow,Math.min(t.run.config.stage2Flow,acceleration));
    if(!previous||current.stamp>previous.stamp)t.startup.lastEstimate=current;
    return {...current,acceleration,predicted:Math.max(0,current.slope+acceleration*t.startup.plan.predictionSeconds)};
  }
  function s2RefillReturnReason(t) {
    const p=t.startup,plan=p.plan;
    const limit=Number(t.profile.steps[1].limiter.value);
    if(state.lastMachineTelemetryValid&&Date.now()-state.lastMachineAtMs<=600&&state.lastPressure>=limit*.90)return "S2 refill pressure margin reached";
    if(Date.now()-p.startedAt>=plan.holdMs)return "S2 refill maximum duration reached";
    if(Date.now()-state.latestScaleAtMs>600)return "S2 refill scale became stale";
    const flow=s2RefillFlowEstimate(t),threshold=t.run.config.stage2Flow*plan.cutoffFraction;
    if(flow&&flow.slope>=threshold){
      p.cutoff={rawGS:round(flow.slope,3),predictedGS:round(flow.predicted,3),thresholdGS:round(threshold,3),atMs:Date.now()};
      return "S2 refill reached configured cup-flow cutoff";
    }
    return null;
  }
  function completeS2Startup(t) {
    if(!t||!t.startup||t.startup.status==="complete")return;
    clearS2StartupTimers(t);t.startup.status="complete";t.startup.resumeAt=Date.now()+(t.startup.plan.strategy==="refill-85"?50:1600);
    if(t.startup.plan.strategy==="refill-85")t.startup.approachAt=t.startup.resumeAt;
    t.report.startupExecution={status:"complete",reason:t.startup.returnReason||"S2 startup baseline return confirmed",cutoff:t.startup.cutoff||null,confirmation:t.startup.returnConfirmation||"machine-target-echo"};
    t.pending=null;t.retry=null;liveTrimRecord("startup-complete",{frame:1,strategy:t.startup.plan.strategy||"legacy-pulse",reason:t.report.startupExecution.reason,cutoff:t.startup.cutoff||null,confirmation:t.startup.returnConfirmation||"machine-target-echo"});
  }
  function startupBlock(t,reason) {if(t.startup)t.startup.blockReason=reason;return false;}

  function clearS2StartupTimers(t) {
    if(!t)return;for(const key of ["startupReturnTimer","startupWatchdog","startupAckTimer"]){if(t[key])clearTimeout(t[key]);t[key]=null;}
  }
  async function dispatchS2Startup(t,action) {
    const p=t.startup,frame=finiteOrNull(state.lastFrame),now=Date.now(),refill=p&&p.plan.strategy==="refill-85";
    const current=state.liveTrim===t&&t.active&&state.diagnosticCurrent===t.run;
    if(current&&action==="boost"&&p.status==="armed"&&state.phase==="stage2"&&frame!==1&&!state.stage2SkipSent)return startupBlock(t,"S2 startup waiting for confirmed frame 1");
    if(current&&state.phase==="stage2"&&frame===null&&!state.stage2SkipSent)return startupBlock(t,"S2 startup waiting for fresh frame telemetry");
    if(!current||state.phase!=="stage2"||frame!==1||state.stage2SkipSent){clearS2StartupTimers(t);if(p)p.status="frame-ended";return false;}
    if(!t.handle||!state.runtimeProfileVerified||!t.run.config.profileTruthVerified||state.commandBusy||!state.lastMachineTelemetryValid||now-state.lastMachineAtMs>600||state.lastMachineState!=="espresso"||!["pouring","preinfusion"].includes(state.lastSubstate))return startupBlock(t,"S2 startup transport or fresh machine feedback unavailable");
    const step=t.profile.steps[1],base=Math.round(Number(step.flow)*16)/16,limiter=Number(step.limiter&&step.limiter.value);
    if(action==="boost"){
      if(refill){
        let limits;try{limits=validatedS2RefillSettings(p.plan.settings);}catch(_){return startupBlock(t,"S2 refill plan settings invalid");}
        const planBase=Number.isFinite(Number(p.plan.refillPumpBaseMlS))?Number(p.plan.refillPumpBaseMlS):base;
        const expectedBoost=Math.floor((Math.min(LIMITS.commandFlowMax,planBase*limits.targetPercent/100)+1e-9)*16)/16;
        if(p.plan.holdMs!==limits.maxDurationMs||p.plan.cutoffFraction!==limits.cutoffPercent/100||p.plan.approachMs!==limits.approachMs||p.plan.startDelayMs!==limits.startDelayMs||p.plan.refillTargetFraction!==limits.targetPercent/100||!Number.isFinite(planBase)||planBase<LIMITS.commandFlowMin||planBase>LIMITS.commandFlowMax||typeof p.plan.commandBasis!=="string"||!p.plan.commandBasis||p.plan.boostCommandMlS!==expectedBoost)return startupBlock(t,"S2 refill plan settings invalid");
        if(now-(Number.isFinite(p.frameConfirmedAt)?p.frameConfirmedAt:t.frameAt)<limits.startDelayMs)return startupBlock(t,"S2 refill start delay");
      }
      if(p.status!=="armed"||t.pending||t.retry||t.report.trace.some(x=>x.kind==="write"&&Number(x.frame)===1))return startupBlock(t,"S2 startup blocked by an existing pending or issued S2 command");
      if(learningPolicy(t.run.config.adaptiveLearningLevel).rank<2&&!startupSignaturesCompatible(p.plan.s1ControlSignature||"[]",JSON.stringify(t.report.trace.filter(x=>x.kind==="write"&&Number(x.frame)===0).map(x=>round(Number(x.commandMlS),4)))))return startupBlock(t,"S2 startup preceding S1 trajectories differ");
      if(t.report.maxWrites-t.report.writes<2||t.report.maxChecks-t.report.checks<12)return startupBlock(t,"S2 startup return budget unavailable");
      if(now-(refill&&Number.isFinite(p.enteredAt)?p.enteredAt:t.frameAt)>(refill?p.plan.dispatchWindowMs:2000))return startupBlock(t,"S2 startup dispatch window elapsed");
      if(now-state.latestScaleAtMs>600)return startupBlock(t,"S2 startup scale data stale");
      if(!Number.isFinite(limiter)||limiter<=0||!Number.isFinite(state.lastPressure)||state.lastPressure<0||state.lastPressure>=limiter*.90)return startupBlock(t,"S2 startup pressure headroom unavailable");
      if(Math.abs(base-p.plan.baseCommandMlS)>1e-9)return startupBlock(t,"S2 startup base profile changed");
      if(!refill&&(!Number.isFinite(state.lastFlow)||state.lastFlow<base*.85||!Number.isFinite(t.observedTarget)||Math.abs(t.observedTarget-base)>.02))return startupBlock(t,"S2 startup waiting for actual baseline target and actuator response");
      const reg=refill?s2RefillFlowEstimate(t):liveTrimRegression(t);
      if(reg&&reg.slope>=t.run.config.stage2Flow*(refill?p.plan.cutoffFraction:.8)){
        if(refill){p.status="skipped";t.report.startupExecution={status:"skipped",reason:"S2 cup flow already at configured cutoff; refill unnecessary"};}
        return startupBlock(t,"S2 startup cup flow already high; skip late boost");
      }
    }else if(!["boosting","return-unconfirmed"].includes(p.status))return false;
    const boosted=refill?p.plan.boostCommandMlS:base+1/16;
    if(refill&&action==="return"&&!Number.isFinite(p.actualReturnCommandMlS)){
      const proposed=finiteOrNull(p.plan.returnCommandMlS),protective=/pressure|stale/i.test(p.returnReason||"");
      p.actualReturnCommandMlS=protective||proposed===null?base:proposed;
    }
    const command=action==="boost"?boosted:refill?p.actualReturnCommandMlS:base;
    if(refill&&action==="return"&&(command<base||command>Math.min(boosted,base*1.2)+1e-9||Math.abs(command*16-Math.round(command*16))>1e-6))return false;
    const commandCeiling=refill?Math.min(LIMITS.commandFlowMax,(Number.isFinite(Number(p.plan.refillPumpBaseMlS))?Number(p.plan.refillPumpBaseMlS):base)*1.6):base*1.08;
    if(!Number.isFinite(command)||command<LIMITS.commandFlowMin||command>LIMITS.commandFlowMax||command>commandCeiling+1e-9)return false;
    // Returning to the verified base is a decrease, so it must not wait for cup
    // regression, a new scale endpoint, pressure headroom, or the boost target echo.
    // It still needs the boost driver's ACK, the same live frame and fresh telemetry.
    if(action==="return"&&(!(t.pending||t.retry)||!(t.pending||t.retry).ack))return false;
    if(action==="return"&&t.report.writes>=t.report.maxWrites)return false;
    if(action==="return"){
      liveTrimRecord("startup-boost-ended",{frame:1,boostTargetSeen:!!(t.pending||t.retry).targetSeen});t.pending=null;t.retry=null;p.status="returning";
    }else p.status="boosting";
    t.report.startupExecution={status:action==="boost"?"issued":"returning",reason:action==="boost"?p.plan.reason:p.returnReason||"S2 startup returning to baseline",cutoff:p.cutoff||null,returnCommandMlS:action==="return"?command:null};
    const pending={frame:1,command,at:now,ack:false,targetSeen:false,startupAction:action,flowAtWrite:finiteOrNull(state.lastFlow),slopeAtWrite:null};t.pending=pending;
    t.report.writes++;t.lastWriteAt=now;state.liveTrimDirty=true;
    liveTrimRecord("write",{frame:1,commandMlS:command,previousMlS:action==="boost"?base:boosted,retry:false,startupAction:action,startupReason:t.report.startupExecution.reason,payload:encodeLiveFlowFrame(step,1,command)});
    // Keep the ordinary trim baseline in sync with the startup boost/return
    // write. Without this the next decision still starts from the boost value
    // (real 1.80ds trace: return to 4.0 was followed by previousMlS 5.5625) and
    // spends several writes walking back inside the envelope.
    t.commands[1]=command;
    if(action==="boost"){
      p.startedAt=now;
      if(refill)t.startupAckTimer=setTimeout(()=>{
        t.startupAckTimer=null;
        if(state.liveTrim===t&&t.active&&state.phase==="stage2"&&(finiteOrNull(state.lastFrame)===null||Number(state.lastFrame)===1)&&["boosting","returning"].includes(p.status)&&t.pending&&!t.pending.ack)abortSequence("S2 refill driver ACK missing",true);
      },2000);
      t.startupReturnTimer=setTimeout(()=>{t.startupReturnTimer=null;p.returnReason=p.returnReason||"S2 startup maximum duration reached";dispatchS2Startup(t,"return").catch(()=>abortSequence("S2 startup return write failed",true));},p.plan.holdMs);
      t.startupWatchdog=setTimeout(()=>{
        t.startupWatchdog=null;
        if(state.liveTrim===t&&t.active&&state.phase==="stage2"&&(finiteOrNull(state.lastFrame)===null||Number(state.lastFrame)===1)&&p.status!=="complete"){
          const pending=t.pending;
          if(!pending||!pending.ack||pending.startupAction!=="return")abortSequence("S2 startup base return driver ACK missing",true);
          else {p.status="return-unconfirmed";t.retry=pending;t.pending=null;t.report.status="monitoring-degraded-startup-base-feedback";liveTrimRecord("startup-base-feedback-missing",{frame:1});}
        }
      },refill?p.plan.holdMs+2500:2500);
    }
    if(refill&&action==="return"){
      if(t.startupAckTimer)clearTimeout(t.startupAckTimer);
      t.startupAckTimer=setTimeout(()=>{
        t.startupAckTimer=null;
        if(state.liveTrim===t&&t.active&&state.phase==="stage2"&&(finiteOrNull(state.lastFrame)===null||Number(state.lastFrame)===1)&&["returning","return-unconfirmed"].includes(p.status)&&t.pending&&!t.pending.ack)abortSequence("S2 refill base return driver ACK missing",true);
      },2000);
    }
    await host.transport.send(t.handle,{type:"text",data:JSON.stringify({type:"request",operation:"write",characteristicUUID:"A010",payload:encodeLiveFlowFrame(step,1,command)})});
    return true;
  }


  function stage2AdaptiveEvidence(run) {
    const chain=liveTrimChainEvidence(run);
    if(chain){
      const target=Number(desiredRealForRunPhase(run,"stage2"));
      if(Number.isFinite(target)&&target>0)return {measurementBasis:"single-shot command chain",runId:run.runId,targetGS:round(target,3),command:round(chain.commandMlS,3),measured:round(chain.endGS,3),errorPct:round((chain.endGS/target-1)*100,1),confidence:"MEDIUM",r2:null,seconds:null,liveTrimChain:chain};
    }
    const controlled=controlLearningAssessment(run,"stage2");
    if(controlled.applicable&&controlled.eligible){
      // The normalized learner's "measured" is seed-normalized (1.80ds field:
      // 3.14 vs a real tail of 5.15). Attach the physical tail gain so the
      // next-shot suggestion uses the real cup flow instead of the model value.
      const ev=controlled.evidence;
      if(ev){
        const tail=tailMachineGain(run,"stage2",controlled.actuator);
        if(tail&&Math.abs(Number(tail.tailErrorPct))>=2)ev.tailGain=tail;
      }
      return ev;
    }
    const tailGain=tailMachineGain(run,"stage2",controlled.actuator);
    if(tailGain&&Number.isFinite(Number(tailGain.tailErrorPct))&&Math.abs(Number(tailGain.tailErrorPct))>=2){
      const target=Number(desiredRealForRunPhase(run,"stage2"));
      if(Number.isFinite(target)&&target>0)return {measurementBasis:"single-shot steady tail machine gain",runId:run.runId,targetGS:round(target,3),command:round(target/tailGain.k,3),measured:tailGain.tailMeanGS,errorPct:round((tailGain.tailMeanGS/target-1)*100,1),confidence:"MEDIUM",r2:null,seconds:null,tailGain};
    }
    if(controlled.applicable)return null;
    run = liveTrimLearningView(run, "stage2");
    if (!run || !stageActuatorEvidence(run, "stage2").eligible) return null;
    if (!run || (run.kind || "hyperex") !== "hyperex") return null;
    const admission=learningAdmission(run),quality=controlOutputQuality(run,"stage2");
    if(quality.available&&quality.tailRippleCVPct>admission.spread(12))return null;
    const p = diagnosticPhaseSummary(run, "stage2");
    const cfg = run.config || {};
    const target = Number(desiredRealForRunPhase(run, "stage2"));
    const command = Number(cfg.stage2CommandMlS);
    if (!p || !Number.isFinite(target) || target <= 0 || !Number.isFinite(command)) return null;
    const raw=phaseRawSamples(run,"stage2"),start=raw.length?Number(raw[0].tMs):0,end=raw.length?Number(raw[raw.length-1].tMs):0;
    const tail=regressionForRawSamples(raw.filter(x=>Number(x.tMs)>=start+(end-start)*.4));
    const settled=tail&&tail.r2>=admission.r2(.97)&&tail.seconds>=admission.seconds(4)&&tail.slope>0;
    const measured = settled?tail.slope:Number(p.rawRegressionGS), r2 = settled?tail.r2:Number(p.rawRegressionR2), seconds = settled?tail.seconds:Number(p.rawRegressionSeconds);
    if (!Number.isFinite(measured) || measured <= 0 || !Number.isFinite(r2) || r2 < admission.r2(.97) || !Number.isFinite(seconds) || seconds < admission.seconds(4)) return null;
    return {
      measurementBasis:settled?"S2 settled-tail RAW regression":"RAW fixed-command regression",runId:run.runId, targetGS:round(target,3), command:round(command,3), measured:round(measured,3),
      errorPct:round((measured-target)/target*100,1), confidence:"HIGH", r2:round(r2,5), seconds:round(seconds,2)
    };
  }

  function stage3AdaptiveEvidence(run) {
    const controlled=controlLearningAssessment(run,"stage3");
    if(controlled.applicable)return controlled.eligible?controlled.evidence:null;
    run = liveTrimLearningView(run, "stage3");
    if (!run || !stageActuatorEvidence(run, "stage3").eligible) return null;
    if (!run || (run.kind || "hyperex") !== "hyperex") return null;
    const admission=learningAdmission(run);
    const st = stage3StabilityDiagnostics(run);
    const phase = diagnosticPhaseSummary(run, "stage3");
    const target3 = Number(desiredRealForRunPhase(run, "stage3"));
    if (!st || !phase || !Number.isFinite(target3) || target3 <= 0) return null;
    const cfg = run.config || {};
    const baseCurrent = Number(cfg.stage3CommandMlS);
    const runShape = cfg.stage3Shape && cfg.stage3Shape.enabled === true ? cfg.stage3Shape : null;
    const commandTriplet = runShape
      ? [Number(runShape.earlyCommand), Number(runShape.midCommand), Number(runShape.lateCommand)]
      : [baseCurrent, baseCurrent, baseCurrent];
    if (!commandTriplet.every(Number.isFinite)) return null;

    const overallGS = Number(phase.rawRegressionGS), overallR2 = Number(phase.rawRegressionR2), overallSeconds = Number(phase.rawRegressionSeconds);
    if (!Number.isFinite(overallGS) || overallGS <= 0 || !Number.isFinite(overallR2) || overallR2 < admission.r2(.93) || !Number.isFinite(overallSeconds) || overallSeconds < admission.seconds(5)) return null;

    let source = null;
    let measurementBasis = null;
    let stallQualitative = false;
    if (Array.isArray(st.shapeFrames) && st.shapeFrames.length === 3 && st.shapeFrames.every(x =>
      Number.isFinite(Number(x.commandMlS)) && Number.isFinite(Number(x.slope)) && Number(x.slope) > 0 &&
      Number.isFinite(Number(x.r2)) && Number(x.r2) >= admission.r2(.90) && Number.isFinite(Number(x.seconds)) && Number(x.seconds) >= admission.seconds(3))) {
      source = st.shapeFrames.map((x,i) => ({ name:x.name, command:Number(commandTriplet[i]), measured:Number(x.slope), r2:Number(x.r2), seconds:Number(x.seconds), quality:"clean" }));
      measurementBasis = "profile-frame regression";
    } else if ([st.early,st.mid,st.late].every(x =>
      x && Number.isFinite(Number(x.slope)) && Number(x.slope) > 0 && Number.isFinite(Number(x.r2)) && Number(x.r2) >= admission.r2(.90) &&
      Number.isFinite(Number(x.seconds)) && Number(x.seconds) >= admission.seconds(3))) {
      // Measurement windows may fall back to EARLY/MID/LATE 25/50/25 stability segments,
      // but command provenance must always remain the commands that this shot actually ran.
      source = [
        { name:"S3 EARLY", command:commandTriplet[0], measured:Number(st.early.slope), r2:Number(st.early.r2), seconds:Number(st.early.seconds), quality:"clean" },
        { name:"S3 MID", command:commandTriplet[1], measured:Number(st.mid.slope), r2:Number(st.mid.r2), seconds:Number(st.mid.seconds), quality:"clean" },
        { name:"S3 LATE", command:commandTriplet[2], measured:Number(st.late.slope), r2:Number(st.late.r2), seconds:Number(st.late.seconds), quality:"clean" }
      ];
      measurementBasis = "stability 25/50/25 fallback";
    } else if (st.stall && st.stall.suspected) {
      // A confirmed stall is itself useful physical evidence even when the LATE segment's
      // linear fit is poor: DE1 flow stayed active while cup-weight slope collapsed for a
      // dedicated 6 s window. Require clean EARLY and MID measurements; preserve LATE as
      // qualitative stall evidence rather than throwing the whole S3 shot away.
      const clean = x => x && Number.isFinite(Number(x.slope)) && Number(x.slope) > 0 &&
        Number.isFinite(Number(x.r2)) && Number(x.r2) >= admission.r2(.90) && Number.isFinite(Number(x.seconds)) && Number(x.seconds) >= admission.seconds(3);
      const lateSlope = st.late && Number.isFinite(Number(st.late.slope)) && Number(st.late.slope) >= 0
        ? Number(st.late.slope)
        : Number(st.stall.rawSlopeGS);
      if (clean(st.early) && clean(st.mid) && Number.isFinite(lateSlope) && lateSlope >= 0 &&
          Number.isFinite(Number(st.late && st.late.seconds)) && Number(st.late.seconds) >= 3.0) {
        source = [
          { name:"S3 EARLY", command:commandTriplet[0], measured:Number(st.early.slope), r2:Number(st.early.r2), seconds:Number(st.early.seconds), quality:"clean" },
          { name:"S3 MID", command:commandTriplet[1], measured:Number(st.mid.slope), r2:Number(st.mid.r2), seconds:Number(st.mid.seconds), quality:"clean" },
          { name:"S3 LATE", command:commandTriplet[2], measured:lateSlope, r2:Number.isFinite(Number(st.late && st.late.r2)) ? Number(st.late.r2) : Number(st.stall.rawR2), seconds:Number(st.late.seconds), quality:"stall-qualitative" }
        ];
        measurementBasis = "STALL RECOVERY: clean EARLY/MID + confirmed late stall";
        stallQualitative = true;
      }
    }
    if (!source) return null;

    const shapeCfg = cfg.stage3Shape && cfg.stage3Shape.enabled ? cfg.stage3Shape : null;
    const earlySeconds = shapeCfg&&finiteOrNull(shapeCfg.earlySeconds)!==null ? Number(shapeCfg.earlySeconds) : 8;
    const midSeconds = shapeCfg&&finiteOrNull(shapeCfg.midSeconds)!==null ? Number(shapeCfg.midSeconds) : 14;
    return {
      runId: run.runId, targetGS: target3, status: st.status, stall:!!(st.stall&&st.stall.suspected), stallQualitative,
      stallRawSlopeGS: st.stall&&st.stall.suspected ? round(st.stall.rawSlopeGS,3) : null,
      stallMachineFlowMlS: st.stall&&st.stall.suspected ? round(st.stall.machineFlowMlS,3) : null,
      lateToEarlyRatio: st.lateToEarlyRatio,
      overallGS:round(overallGS,3), overallR2:round(overallR2,5), overallSeconds:round(overallSeconds,2),
      earlySeconds: round(earlySeconds,1), midSeconds: round(midSeconds,1), measurementBasis,
      source: source.map(x => ({ name:x.name, command:round(x.command,3), measured:round(x.measured,3), r2:Number.isFinite(Number(x.r2))?round(x.r2,5):null, seconds:round(x.seconds,2), quality:x.quality||"clean" }))
    };
  }

  function sameScalarAdaptiveEvidence(a,b) {
    return !!(a && b && Math.abs(Number(a.command)-Number(b.command)) <= 0.005 && Math.abs(Number(a.targetGS)-Number(b.targetGS)) <= 0.01);
  }

  function sameStage3Shape(a, b) {
    if (!a || !b || !Array.isArray(a.source) || !Array.isArray(b.source) || a.source.length !== 3 || b.source.length !== 3) return false;
    const family=e=>e.measurementBasis==="live target-normalized frame windows"?"profile-frame regression":e.measurementBasis==="live target-normalized stability windows"?"stability 25/50/25 fallback":e.measurementBasis;
    if (family(a) !== family(b)) return false;
    if (Math.abs(Number(a.earlySeconds) - Number(b.earlySeconds)) > 0.25 || Math.abs(Number(a.midSeconds) - Number(b.midSeconds)) > 0.25) return false;
    if (Math.abs(Number(a.targetGS)-Number(b.targetGS)) > 0.01) return false;
    for (let i = 0; i < 3; i++) if (Math.abs(Number(a.source[i].command) - Number(b.source[i].command)) > 0.005) return false;
    return true;
  }

  function adaptiveHistoryFingerprint() {
    if (!state.cfg || !state.calibrationMapUsable || !state.calibrationMap || state.calibrationMap.valid !== true ||
        finiteOrNull(state.flowMultiplierCurrent) === null || !multiplierClose(state.flowMultiplierCurrent, calibrationBaseMultiplier())) return null;
    return {
      schema: 3,
      basketContext: state.cfg.basketContext,
      mapCreatedAt: String(state.calibrationMap.createdAt || ""),
      lutSchema: state.calibrationMap.schema,
      lutAlgorithm: state.calibrationMap.algorithm || "",
      lutPoints: canonicalProfileValue(calibrationPoints()),
      targetAnchors: canonicalProfileValue(state.calibrationMap.targetAnchors || []),
      baseFlowMultiplier: round(calibrationBaseMultiplier(), 4),
      actualFlowMultiplier: round(state.flowMultiplierCurrent, 4),
      targets: { stage1:round(state.cfg.stage1Flow,4), stage2:round(state.cfg.stage2Flow,4), stage3:round(state.cfg.stage3Flow,4) },
      shotSettings: {
        activeRelease:activeReleaseEnabled(state.cfg),
        temperature:state.cfg.temperature, stage1Weight:state.cfg.stage1Weight, soakSeconds:state.cfg.soakSeconds,
        stage2Weight:state.cfg.stage2Weight, finalWeight:state.cfg.finalWeight,
        stage1PressureLimit:state.cfg.stage1PressureLimit, stage2PressureLimit:state.cfg.stage2PressureLimit,
        stage3PressureLimit:state.cfg.stage3PressureLimit, hardPressureLimit:state.cfg.hardPressureLimit
      },
      profileTruthSchema: 3,
      model: "hyperex-realflow-lut-nextshot-v3"
    };
  }

  // Operating qualification survives a normal temperature adjustment. Numeric
  // shot-to-shot consensus also ignores temperature, while retaining all quality gates.
  function qualificationFingerprintKey(fp) {
    if(!fp||typeof fp!=="object")return "";
    const q={...fp,shotSettings:{...(fp.shotSettings||{})}};
    delete q.basketContext;delete q.shotSettings;delete q.targets;
    // A merged LUT re-samples the same machine: keep the operating qualification
    // (and its coffee/empty baseline) across point-list changes.
    delete q.lutPoints;delete q.targetAnchors;delete q.lutSchema;delete q.lutAlgorithm;
    return adaptiveHistoryFingerprintKey(q);
  }

  function refreshLearningStage() {
    if (!state.cfg || state.phase!=="idle") return state.learningStage;
    const status={automatic:true,minEmptyShots:2,maxEmptyShots:3,emptyShots:0};
    const finish=(stage,message,extra={})=>{
      state.learningStage={...status,stage,message,...extra};
      return state.learningStage;
    };
    if (!state.calibrationMapUsable) {
      state.cfg.basketContext="empty";
      return finish("STEP 1 · EMPTY CALIBRATION","Run Step 1 with an empty locked-in basket to save the original LUT.");
    }
    const key=qualificationFingerprintKey;
    const fingerprint=key(adaptiveHistoryFingerprint());
    const rows=state.persistentHistoryFile && state.persistentHistoryFile.shots || [];
    const matching=fingerprint?rows.filter(r=>r && historyLearningStatus(r).eligible && /^completed at /i.test(String(r.result||"")) &&
      r.profileTruthSchema===3 && r.profileTruthVerified===true && key(r.fingerprint)===fingerprint):[];
    const empty=matching.filter(r=>(r.basketContext||"unknown")!=="coffee");
    const coffee=matching.filter(r=>r.basketContext==="coffee");
    status.emptyShots=empty.length;
    const retained=state.persistentHistoryFile&&state.persistentHistoryFile.coffeeQualification;
    if (coffee.length||retained&&(retained.fingerprint===fingerprint||qualificationFingerprintKey(parseStoredJson(retained.fingerprint))===fingerprint)) {
      state.cfg.basketContext="coffee";
      if(coffee.length)keepCoffeeQualification();
      return finish("NORMAL COFFEE · AUTO","Continue normal coffees; the retained empty baseline is refined from completed coffee evidence.");
    }
    // Never change a run's interpretation while its automatic application is
    // queued/in flight, nor use an unverified/failed storage write as readiness.
    const applyStatus=state.autoApplyLastStatus && state.autoApplyLastStatus.status;
    if (["scheduled","applying"].includes(applyStatus)) return finish("STEP 2 · APPLYING","Wait for the pending next-shot decision and verified application. Do not start an extra test cup.");
    if (!state.runtimeProfileVerified || !state.machineProfileAckKey || state.persistentHistoryAvailable!==true || state.pendingHistoryWrite) {
      return finish("STEP 2 · CHECKING","Waiting for verified workflow and history readback; do not add test cups while checks are pending.");
    }
    if (applyStatus==="error") return finish("STEP 2 · BLOCKED","Automatic application failed. Read the raw workflow/error and fix it; do not add empty-basket cups.");
    const usable=(r,strict)=>{
      const a=r.s2||{},b=r.s3||{};
      return [a.rawRegressionGS,b.rawRegressionGS].every(x=>finiteOrNull(x)!==null && Number(x)>0) &&
        Number(a.windowS)>=4 && Number(b.windowS)>=5 &&
        Number(a.rawRegressionR2)>=(strict ? .97 : .93) && Number(b.rawRegressionR2)>=(strict ? .93 : .85) &&
        !(r.s3Stability&&r.s3Stability.stall&&r.s3Stability.stall.suspected);
    };
    const last=empty.slice(-2);
    const inBand=r=>["s2","s3"].every(k=>{
      const q=r[k];return Number(q.targetGS)>0 && Math.abs(Number(q.rawRegressionGS)/Number(q.targetGS)-1)<=.12;
    });
    const variation=k=>{
      const a=Number(last[0]&&last[0][k]&&last[0][k].rawRegressionGS);
      const b=Number(last[1]&&last[1][k]&&last[1][k].rawRegressionGS);
      return Math.abs(a-b)/((a+b)/2);
    };
    const stable=last.length===2 && last.every(r=>usable(r,true)&&inBand(r)) && variation("s2")<=.15 && variation("s3")<=.20;
    const capped=empty.length>=3 && last.length===2 && last.every(r=>usable(r,false));
    if (stable || capped) {
      state.cfg.basketContext="coffee";keepCoffeeQualification();
      return finish("READY FOR COFFEE · AUTO",stable?
        "Two clean stable empty-basket shots are sufficient. You can fill the basket and brew normally; no further empty-basket tuning.":
        "Empty-basket tuning has reached its 3-shot limit. Preserve this baseline and begin coffee use; at most one dedicated filled-basket acceptance shot.",
        {transitionBasis:stable?"two stable shots":"bounded empty-basket test budget",limitedEmptyImprovement:!stable});
    }
    state.cfg.basketContext="empty";
    return finish(empty.length>=3?"STEP 2 · BLOCKED":"STEP 2 · EMPTY BASELINE",empty.length>=3?
      "The 3-shot limit is reached but data/stall checks need attention. Stop empty-basket tests and inspect existing diagnostics.":
      "Run Step 2 with an empty basket. The plugin refines the next-shot command mapping while preserving the original LUT. It will prompt you automatically after 2–3 shots.");
  }

  function baselineFeedForwardPayload() {
    const fingerprint=adaptiveHistoryFingerprint();
    const baseKey=qualificationFingerprintKey;
    const key=baseKey(fingerprint);
    const rows=state.persistentHistoryFile && state.persistentHistoryFile.shots || [];
    const references=key ? rows.filter(row=>row && historyLearningStatus(row).eligible && /^completed at /i.test(String(row.result||"")) && row.profileTruthSchema===3 && row.profileTruthVerified===true &&
      (row.basketContext||"unknown")!=="coffee" && baseKey(row.fingerprint)===key) : [];
    const latest=references.length?references[references.length-1]:null;
    const override=testOverrideStatus();
    return {role:"feed-forward prior; not a matching coffee consensus shot",
      calibrationRetained:!!state.calibrationMapUsable,referenceShots:references.length,
      sourceRunIds:references.map(row=>row.runId),sourceClassification:"empty/pre-upgrade reference",
      commandSeedRetained:!!(override.valid && override.baselinePrior && override.activeStages.length),
      sourceCommands:latest&&latest.commands||null,
      priorCupResponse:latest?{stage1:latest.s1Startup||latest.s1,stage2:latest.s2,stage3:latest.s3,stage3Stability:latest.s3Stability}:null,
      note:"Retain LUT, validated command baseline and historical cup-response reference. Coffee backpressure changes the response; numeric coffee updates require new coffee evidence and actuator/pressure quality."};
  }

  function numericLearningFingerprintKey(fp) {
    if(!fp||typeof fp!=="object")return "";
    const q={...fp,shotSettings:{...(fp.shotSettings||{})}};
    delete q.shotSettings.temperature;
    q.shotSettings={activeRelease:fp.shotSettings&&fp.shotSettings.activeRelease!==undefined?fp.shotSettings.activeRelease!==false:true};
    delete q.targets;
    // A merged LUT re-samples the same machine. Only its identity (mapCreatedAt) and
    // the physical context decide whether old evidence still applies; the point list
    // is deliberately not part of the learning key.
    delete q.lutPoints;
    delete q.targetAnchors;
    delete q.lutSchema;
    delete q.lutAlgorithm;
    return adaptiveHistoryFingerprintKey(q);
  }

  function assessRunLearningIntegrity(run) {
    const reasons=[],events=run&&run.events||[],add=(code,phase,detail)=>{if(!reasons.some(x=>x.code===code&&x.phase===phase))reasons.push({code,phase:phase||null,detail:detail||null});};
    if(!run)return {schema:1,eligible:false,status:"excluded",reasons:[{code:"missing-run"}]};
    if(!/^completed at /i.test(String(run.result||"")))add("not-completed");
    if(!run.config||run.config.profileTruthVerified!==true||run.config.profileTruthSchema!==3)add("unverified-profile");
    for(const event of events)if(event.name==="learning_fault")add("execution-fault",event.phase,event.data&&event.data.reason);
    for(const fault of run.learningExecutionFaults||[])add("execution-fault",fault.phase,fault.reason);
    const skips=events.filter(x=>x.name==="command_accepted"&&x.data&&x.data.machineState==="skipStep");
    const skipCount=Math.max(skips.length,Number(run.learningSkipCount)||0);if(skipCount>2)add("extra-skip-commands",null,skipCount);
    // Only inspect within an active phase, after its first 2s and meaningful cup gain.
    // Initial tare, the intentional dump and restart tare are NOT fault evidence.
    const raw=run.rawScaleSamples||[];
    for(const phase of ["stage1","stage2","stage3"]){
      const rows=raw.filter(x=>x.phase===phase).sort((a,b)=>Number(a.tMs)-Number(b.tMs));if(rows.length<2)continue;
      const first=Number(rows[0].tMs);let previous=null,start=null,peak=null;
      for(const row of rows){
        const weight=finiteOrNull(row.weightG),at=finiteOrNull(row.tMs),stamp=finiteOrNull(row.scaleTimestampSeconds);
        if(weight===null||at===null)continue;
        if(start===null)start=weight;
        const gain=peak===null?0:peak-start,settled=at-first>=2000;
        if(previous&&settled&&gain>=2){
          const drop=previous.weight-weight,dt=stamp!==null&&previous.stamp!==null?stamp-previous.stamp:null;
          if(drop>=3)add("scale-drop-during-extraction",phase,round(drop,2));
          if(dt!==null&&dt>0&&dt<=.6&&weight-previous.weight>Math.max(12,30*dt))add("scale-jump-during-extraction",phase,round(weight-previous.weight,2));
        }
        if(row.tareReset&&(at-first<2000||gain<2)){start=weight;peak=weight;}
        peak=peak===null?weight:Math.max(peak,weight);previous={weight,stamp};
      }
    }
    return {schema:1,eligible:reasons.length===0,status:reasons.length?"excluded":"no-confirmed-fault",reasons,rawChecked:raw.length>0,eventsChecked:events.length>0};
  }
  function historyLearningStatus(row) {
    if(!row)return {eligible:false,status:"excluded",reasons:["missing-record"]};
    if(row.learningReview&&row.learningReview.excluded===true)return {eligible:false,status:"manual-excluded",reasons:[row.learningReview.reason||"operator-marked"]};
    const integrity=row.learningIntegrity;
    if(integrity&&integrity.schema===1&&integrity.eligible===false)return {eligible:false,status:"auto-excluded",reasons:(integrity.reasons||[]).map(x=>x.code)};
    if(Object.prototype.hasOwnProperty.call(row,"result")&&!/^completed at /i.test(String(row.result||"")))return {eligible:false,status:"auto-excluded",reasons:["not-completed"]};
    if(row.profileTruthVerified===false||row.profileTruthSchema&&row.profileTruthSchema!==3)return {eligible:false,status:"auto-excluded",reasons:["unverified-profile"]};
    return {eligible:true,status:integrity?"no-confirmed-fault":"legacy-limited-audit",reasons:[]};
  }
  function learningRunAllowed(run) {
    if(!run||!historyLearningStatus(run).eligible)return false;
    const saved=(state.persistentHistoryFile&&state.persistentHistoryFile.shots||[]).find(x=>x.runId===run.runId);
    if(saved&&!historyLearningStatus(saved).eligible)return false;
    return assessRunLearningIntegrity(run).eligible;
  }
  function historyEvidenceAllowed(evidence) {
    if(!historyLearningStatus(evidence).eligible)return false;
    const saved=(state.persistentHistoryFile&&state.persistentHistoryFile.shots||[]).find(x=>x.runId===evidence.runId);
    return !saved||historyLearningStatus(saved).eligible;
  }
  function keepCoffeeQualification() {
    const file=state.persistentHistoryFile,key=qualificationFingerprintKey(adaptiveHistoryFingerprint());
    if(file&&key)file.coffeeQualification={fingerprint:key,establishedAt:new Date().toISOString()};
  }
  function s3CommandHistoryAudit() {
    const events=[],transitions=[],lastByContext=new Map();
    const shapeOf=commands=>{
      const stage=commands&&(commands.appliedProfile&&commands.appliedProfile.stage3||commands.stage3),shape=stage&&stage.shape||commands&&commands.s3Shape;
      if(!stage&&!shape)return null;
      const enabled=shape&&shape.enabled===true,flat=stage&&(stage.flatCommandMlS===undefined?stage.commandMlS:stage.flatCommandMlS);
      const values=enabled?[shape.earlyCommand,shape.midCommand,shape.lateCommand].map(Number):[flat,flat,flat].map(Number);
      if(!values.every(x=>Number.isFinite(x)&&x>=.1&&x<=8))return null;
      return {values:values.map(x=>round(x,3)),flat:Math.max(...values)-Math.min(...values)<.001,timedShape:!!enabled,
        origin:stage&&stage.origin||commands&&commands.stage3Origin||"retained"};
    };
    for(const row of state.persistentHistoryFile&&state.persistentHistoryFile.shots||[]){
      const context=numericLearningFingerprintKey(row.fingerprint),snapshot=shapeOf(row.commands),applied=row.nextShotApplied;
      if(!snapshot){if(context)lastByContext.delete(context);else lastByContext.clear();} // Unknown history is not an observed transition.
      const add=(shape,kind,at,verified)=>{
        if(!shape)return;
        const entry={runId:row.runId,version:row.pluginVersion||null,at:at||null,kind,verified:!!verified,context,...shape,learningExcluded:!historyLearningStatus(row).eligible};
        const previous=context?lastByContext.get(context):null;
        events.push(entry);
        if(previous&&!previous.flat&&entry.flat&&previous.verified&&entry.verified)transitions.push({before:previous,after:entry,basis:kind==="applied"?"verified next-shot application":"first observed flat shot-start snapshot"});
        if(context)lastByContext.set(context,entry);
      };
      add(snapshot,"shot-start",row.startedAt,row.profileTruthVerified===true);
      // Proposals are never called executed/applied history.
      if(applied&&applied.profileTruth&&applied.profileTruth.verified===true)add(shapeOf(applied.commandFlows),"applied",applied.at,true);
    }
    return {events,flatTransitions:transitions,earliestRetainedFlat:events.find(x=>x.flat&&x.verified)||null,
      note:"Retained history only; missing older records cannot establish the first-ever change. Suggestions are not verified applications."};
  }
  function learningHistoryPayload() {
    const rows=state.persistentHistoryFile&&state.persistentHistoryFile.shots||[];
    return {s3CommandAudit:s3CommandHistoryAudit(),savePending:!!(state.pendingHistoryWrite||state.historyWriteDirty),editable:state.phase==="idle"&&!state.calibrationActive&&!state.curveApplyBusy&&!(state.autoApplyLastStatus&&state.autoApplyLastStatus.status==="applying")&&state.persistentHistoryAvailable===true&&state.storageProbeVerified,
      records:rows.slice().reverse().map(row=>({runId:row.runId,startedAt:row.startedAt,result:row.result,basketContext:row.basketContext,activeRelease:row.activeRelease!==undefined?row.activeRelease!==false:!(row.fingerprint&&row.fingerprint.shotSettings&&row.fingerprint.shotSettings.activeRelease===false),version:row.pluginVersion,
        review:row.learningReview||null,integrity:historyLearningStatus(row),stageEvidence:{s1:!!(row.evidence&&row.evidence.s1),s2:!!(row.evidence&&row.evidence.s2),s3:!!(row.evidence&&row.evidence.s3)}}))};
  }
  function setLearningHistoryReview(body) {
    if(state.phase!=="idle"||state.calibrationActive||state.curveApplyBusy||state.autoApplyLastStatus&&state.autoApplyLastStatus.status==="applying")throw new Error("History review requires idle state");
    if(state.persistentHistoryAvailable!==true||!state.storageProbeVerified||!state.persistentHistoryLoaded)throw new Error("History storage is not verified");
    if(!body||typeof body.runId!=="string"||typeof body.excluded!=="boolean")throw new Error("Invalid history review");
    const row=(state.persistentHistoryFile&&state.persistentHistoryFile.shots||[]).find(x=>x.runId===body.runId);
    if(!row)throw new Error("History record not found");
    if(body.excluded&&!['operator-mistake','plugin-fault','scale-or-cup-disturbance','other'].includes(body.reason))throw new Error("Select an exclusion reason");
    if(state.cfg.basketContext==="coffee")keepCoffeeQualification();
    row.learningReview={excluded:body.excluded,reason:body.excluded?body.reason:null,at:new Date().toISOString()};
    row.learningReviewLog=(Array.isArray(row.learningReviewLog)?row.learningReviewLog:[]).concat({...row.learningReview}).slice(-20);
    const run=state.diagnosticLast&&state.diagnosticLast.runId===row.runId?state.diagnosticLast:null;
    if(run)run.learningReview={...row.learningReview};
    if(body.excluded&&state.autoApplyLastStatus&&state.autoApplyLastStatus.runId===row.runId&&state.autoApplyLastStatus.status==="scheduled"){
      clearTimer("autoApplyTimer");state.autoApplyLastStatus={runId:row.runId,status:"excluded",message:"Shot excluded from learning"};
    }
    // Rebuild restored and session candidates; restore uses retained raw evidence,
    // while all consumers consult the review flag. Never erase the original evidence.
    restoreAdaptiveHistoryFromPersistentFile();
    if(!persistHistoryFile())throw new Error("History exclusion applied in this session; persistent save unavailable");
    if(run)run.summary=diagnosticSummary(run);
    emitSkinChanged();return learningHistoryPayload();
  }

  function trustedAdaptiveRun(run) {
    const c = run && run.config;
    const key = numericLearningFingerprintKey(adaptiveHistoryFingerprint());
    return !!(run && run.kind === "hyperex" && learningRunAllowed(run) && /^completed at /i.test(String(run.result || "")) && c &&
      c.profileTruthVerified === true && c.profileTruthSchema === 3 && c.basketContext === state.cfg.basketContext && key &&
      numericLearningFingerprintKey(c.adaptiveFingerprint) === key);
  }

  function adaptiveHistoryFingerprintKey(fp) {
    if (!fp || typeof fp !== "object") return "";
    try { return JSON.stringify(canonicalProfileValue(fp)); } catch (_) { return ""; }
  }

  function historyStatusPayload() {
    const shots = state.persistentHistoryFile && Array.isArray(state.persistentHistoryFile.shots) ? state.persistentHistoryFile.shots.length : 0;
    return {
      available: state.persistentHistoryAvailable,
      status: state.persistentHistoryStatus || "unknown",
      savedShots: shots,
      compatibleShots: Number(state.persistentHistoryCompatibleCount || 0),
      baselineReferenceShots: baselineFeedForwardPayload().referenceShots,
      maxShots: HISTORY_FILE_MAX_SHOTS,
      storageKey: STORAGE_HISTORY_FILE
    };
  }

  function setPersistentHistoryUnavailable(reason) {
    state.persistentHistoryAvailable = false;
    state.storageProbeVerified = false;
    state.pendingHistoryWrite = null;
    state.adaptiveHistory = (state.adaptiveHistory || []).filter(ev => !ev.restoredFromDisk);
    state.persistentHistoryCompatibleCount = 0;
    if (state.historyWriteTimer) { clearTimeout(state.historyWriteTimer); state.historyWriteTimer = null; }
    state.persistentHistoryStatus = `SESSION ONLY: ${reason || 'pluginStorage unavailable'}`;
    if (state.storageProbeTimer) { clearTimeout(state.storageProbeTimer); state.storageProbeTimer = null; }
    log(`Persistent adaptive history unavailable. Shot-to-shot adaptation remains active for this plugin session, but cross-reload/version history is disabled. ${reason || ''}`);
    if(state.historyRecoveryAttempts<2&&!state.historyRecoveryTimer){
      const recover=()=>{state.historyRecoveryTimer=null;if(state.phase!=="idle"){state.historyRecoveryTimer=setTimeout(recover,1000);return;}state.historyRecoveryAttempts++;state.persistentHistoryAvailable=null;startPersistentHistoryProbe();if(!state.persistentHistoryLoaded)storageRead(STORAGE_HISTORY_FILE);};
      state.historyRecoveryTimer=setTimeout(recover,1500);
    }
    emitSkinChanged();
  }

  function startPersistentHistoryProbe() {
    if (state.storageProbeTimer) clearTimeout(state.storageProbeTimer);
    state.storageProbeToken = `${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
    state.storageProbeVerified = false;
    state.persistentHistoryAvailable = null;
    state.persistentHistoryStatus = "checking pluginStorage write/readback";
    // Arm timeout before requesting a read, including hosts that reply synchronously.
    state.storageProbeTimer = setTimeout(() => {
      if (state.persistentHistoryAvailable !== true) setPersistentHistoryUnavailable("write/readback probe timed out");
    }, 3500);
    if (!storageWrite(STORAGE_HISTORY_PROBE, state.storageProbeToken)) {
      setPersistentHistoryUnavailable("probe write failed");
      return;
    }
    if (!storageRead(STORAGE_HISTORY_PROBE)) setPersistentHistoryUnavailable("probe read request failed");
  }

  function compactPersistentShotRecord(run, evidence) {
    if (!run || !run.runId) return null;
    const summary = run.summary || diagnosticSummary(run) || {};
    const compactPhase = phase => {
      const q = summary[phase] || {};
      return {
        targetGS: q.desiredRealFlowGS, rawRegressionGS: q.rawRegressionGS, rawRegressionR2: q.rawRegressionR2,
        windowS: q.rawRegressionSeconds, de1Flow: q.machineFlowAvg, decaidWeightFlow: q.gflowAvg, status: q.validationStatus, errorPct: q.rawErrorPct
      };
    };
    const st = summary.stage3Stability || null;
    return {
      runId: String(run.runId),
      pluginVersion: PLUGIN_VERSION,
      activeRelease:activeReleaseEnabled(run.config),
      learningIntegrity: assessRunLearningIntegrity(run),
      learningReview: run.learningReview||null,
      basketContext: run.config && run.config.basketContext || "unknown",
      startedAt: run.startedAt || null, endedAt: run.endedAt || null, result: run.result || null,
      fingerprint: run.config && run.config.adaptiveFingerprint || null,
      profileTruthSchema: run.config && run.config.profileTruthSchema || 0,
      profileTruthVerified: !!(run.config && run.config.profileTruthVerified),
      experimentalLiveTrim: !!(run.config && run.config.experimentalLiveTrim),
      liveFlowTrim: compactLiveHistory(run.liveFlowTrim),
      workflowProfileCommands: run.config && run.config.workflowProfileCommands ? run.config.workflowProfileCommands : null,
      profileReadbackAt: run.config && run.config.profileReadbackAt || null,
      machineUploadAcknowledged: !!(run.config && run.config.machineProfileUploadAcknowledged),
      commands: diagnosticRunCommandSnapshot(run),
      flowMultiplier: run.config ? round(run.config.flowMultiplier,4) : null,
      s1: compactPhase("stage1"), s2: compactPhase("stage2"), s3: compactPhase("stage3"),
      s1Startup: summary.stage1Startup ? { confidence:summary.stage1Startup.confidence, firstRiseDelayS:summary.stage1Startup.firstRiseDelayS, midFlowGS:summary.stage1Startup.midFlowGS, midR2:summary.stage1Startup.midR2, activeFlowGS:summary.stage1Startup.activeFlowGS } : null,
      s2Startup: summary.stage2Startup || stage2StartupMetrics(run),
      s3Stability: st ? { status:st.status, lateToEarlyRatio:st.lateToEarlyRatio, early:st.early, mid:st.mid, late:st.late, stall:st.stall } : null,
      adaptiveDecision: summary.nextShotAdaptive || null,
      nextShotApplied: null,
      fullRecord: fullShotRecord(run),
      evidence: evidence || null
    };
  }

  function persistHistoryFile() {
    // Never overwrite disk before the initial read, and serialize full-file writes.
    if (!state.persistentHistoryLoaded || !state.storageProbeVerified || state.persistentHistoryAvailable === false || !state.persistentHistoryFile) return false;
    if (state.pendingHistoryWrite) { state.historyWriteDirty = true; return true; }
    state.persistentHistoryFile.writerVersion = PLUGIN_VERSION;
    state.persistentHistoryFile.updatedAt = new Date().toISOString();
    state.persistentHistoryFile.writeToken = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    state.pendingHistoryWrite = JSON.stringify(state.persistentHistoryFile);
    state.historyWriteBytes=utf8ByteLength(state.pendingHistoryWrite);
    state.historyWriteDirty = false;
    state.historyWriteTimer = setTimeout(() => setPersistentHistoryUnavailable('history file readback timed out'), 3500);
    if (!storageWrite(STORAGE_HISTORY_FILE, state.pendingHistoryWrite) || !storageRead(STORAGE_HISTORY_FILE)) {
      setPersistentHistoryUnavailable('history file write/read request failed');
      return false;
    }
    return true;
  }

  function recordNextShotApplied(run, commandFlows) {
    const rows = state.persistentHistoryFile && state.persistentHistoryFile.shots;
    const row = Array.isArray(rows) && rows.find(x => x && x.runId === run.runId);
    if (!row) return;
    row.nextShotApplied = { at:new Date().toISOString(), commandFlows, profileTruth:runtimeProfileTruthPayload() };
    persistHistoryFile();
  }

  function appendPersistentHistoryShot(run, evidence) {
    const record = compactPersistentShotRecord(run, evidence);
    if (!record) return;
    if (!state.persistentHistoryFile || typeof state.persistentHistoryFile !== "object") {
      state.persistentHistoryFile = { schema:2, kind:"HyperExAdaptiveHistory", writerVersion:PLUGIN_VERSION, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(), shots:[] };
    }
    if (!Array.isArray(state.persistentHistoryFile.shots)) state.persistentHistoryFile.shots = [];
    state.persistentHistoryFile.shots = state.persistentHistoryFile.shots.filter(x => x && x.runId !== record.runId);
    state.persistentHistoryFile.shots.push(record);
    if (state.persistentHistoryFile.shots.length > HISTORY_FILE_MAX_SHOTS) state.persistentHistoryFile.shots = state.persistentHistoryFile.shots.slice(-HISTORY_FILE_MAX_SHOTS);
    persistHistoryFile();
  }

  function restoreAdaptiveHistoryFromPersistentFile() {
    refreshLearningStage();
    const fpKey = numericLearningFingerprintKey(adaptiveHistoryFingerprint());
    const compatible = row => row && row.profileTruthSchema === 3 && row.fingerprint &&
      numericLearningFingerprintKey(row.fingerprint) === fpKey;
    // Session evidence remains usable even when persistent storage is unavailable.
    const session = (state.adaptiveHistory || []).filter(ev => historyEvidenceAllowed(ev) && compatible(ev) && (!ev.restoredFromDisk || state.persistentHistoryAvailable === true));
    const saved = state.persistentHistoryAvailable === true && fpKey && state.persistentHistoryFile && Array.isArray(state.persistentHistoryFile.shots)
      ? state.persistentHistoryFile.shots.filter(row => row && historyLearningStatus(row).eligible && row.evidence && row.profileTruthVerified === true && compatible(row)) : [];
    state.persistentHistoryCompatibleCount = saved.length;
    const merged = new Map();
    for (const ev of saved.map(row => ({...row.evidence, learningIntegrity:row.learningIntegrity||null, learningReview:row.learningReview||null, restoredFromDisk:true})).concat(session)) {
      if (ev && ev.runId && compatible(ev)) merged.set(ev.runId, ev);
    }
    state.adaptiveHistory = Array.from(merged.values()).slice(-20);
    emitSkinChanged();
    return state.adaptiveHistory.length > 0;
  }

  function rememberAdaptiveEvidence(run) {
    const truthVerified = trustedAdaptiveRun(run);
    const ev = truthVerified ? { runId:run && run.runId, profileTruthSchema:3, fingerprint:run.config.adaptiveFingerprint, learningIntegrity:assessRunLearningIntegrity(run), s1:stage1AdaptiveEvidence(run), s2:stage2AdaptiveEvidence(run), s3:stage3AdaptiveEvidence(run) } : null;
    if (!truthVerified) {
      appendPersistentHistoryShot(run, null);
      if (run && run.kind === "hyperex") log(`Adaptive evidence excluded: workflow profile truth was not verified at shot start (${run.runId || 'unknown run'}).`);
      return;
    }
    if (!ev.runId || (!ev.s1 && !ev.s2 && !ev.s3)) {
      appendPersistentHistoryShot(run, ev && ev.runId ? ev : null);
      return;
    }
    if (!Array.isArray(state.adaptiveHistory)) state.adaptiveHistory = [];
    state.adaptiveHistory = state.adaptiveHistory.filter(x => x && x.runId !== ev.runId);
    state.adaptiveHistory.push(ev);
    if (state.adaptiveHistory.length > 20) state.adaptiveHistory = state.adaptiveHistory.slice(-20);
    storageWrite(STORAGE_ADAPTIVE_HISTORY, JSON.stringify(state.adaptiveHistory.slice(-8)));
    appendPersistentHistoryShot(run, ev);
  }

  function matchingAdaptiveEvidenceSearch(current,key) {
    const result={evidence:null,matchedRunId:null,checked:0,skippedStorage:0,skippedContext:0,missingStage:0,incompatibleCommands:0,malformed:0};
    if(!current||!Array.isArray(state.adaptiveHistory))return result;
    const fingerprint=adaptiveHistoryFingerprint();if(!fingerprint)return result;
    const currentKey=numericLearningFingerprintKey(fingerprint);
    for(let i=state.adaptiveHistory.length-1;i>=0;i--){
      const row=state.adaptiveHistory[i];if(!row||row.runId===current.runId)continue;
      result.checked++;
      if(!historyEvidenceAllowed(row)){result.skippedExcluded=(result.skippedExcluded||0)+1;continue;}
      if(row.restoredFromDisk&&state.persistentHistoryAvailable!==true){result.skippedStorage++;continue;}
      if(row.profileTruthSchema!==3||numericLearningFingerprintKey(row.fingerprint)!==currentKey){result.skippedContext++;continue;}
      let evidence=row[key]||(key==="s3"&&row.source?row:null);
      if(!evidence){result.missingStage++;continue;}
      if(key==="s2"&&current.measurementBasis!==evidence.measurementBasis){result.mixedBasis=(result.mixedBasis||0)+1;evidence={...evidence,comparisonModel:"cross-window historical reference"};}
      const plausible=key==="s3"?Array.isArray(evidence.source)&&evidence.source.every(x=>Number(x.measured)/Number(evidence.targetGS)>=.2&&Number(x.measured)/Number(evidence.targetGS)<=3):Number(evidence.measured)/Number(evidence.targetGS)>=.2&&Number(evidence.measured)/Number(evidence.targetGS)<=3;
      if(!plausible){result.extremeResponses=(result.extremeResponses||0)+1;continue;}
      let matches=false;try{matches=key==="s3"?sameStage3Shape(current,evidence):sameScalarAdaptiveEvidence(current,evidence);}catch(_){result.malformed++;continue;}
      if(!matches&&(key==="s1"||key==="s2")){const comparable=s2NearbyEvidence(current,evidence,key);if(comparable){evidence=comparable;matches=true;result.nearbyCommandComparisons=(result.nearbyCommandComparisons||0)+1;}}
      if(!matches&&key==="s3"){const comparable=stage3ReferenceEvidence(current,evidence);if(comparable){evidence=comparable;matches=true;result.nearbyCommandComparisons=(result.nearbyCommandComparisons||0)+1;}}
      if(!matches){result.incompatibleCommands++;continue;}
      // Choose the newest comparable row, BEFORE considering the error direction.
      // Never search for an older agreeing error to bypass a newer conflicting cup.
      result.evidence=evidence;result.matchedRunId=row.runId;return result;
    }
    return result;
  }
  function previousMatchingAdaptiveEvidence(current,key) {
    return matchingAdaptiveEvidenceSearch(current,key).evidence;
  }

  function scalarConsensusSuggestion(label,current,previous,opt) {
    if (!current) return { usable:false, action:"REPEAT", confidence:"INSUFFICIENT", reason:`${label} data is not clean enough for numeric adaptation.` };
    const base = { targetGS:round(Number(current.targetGS),3), currentCommandMlS:round(Number(current.command),3), measuredGS:round(Number(current.measured),3) };
    if (!previous) return { ...base, usable:false, action:"REPEAT SAME COMMAND", confidence:"PENDING", repeatCount:1, reason:`One clean ${label} shot is not enough. Repeat the same command once more.` , maxStepRule:opt.rule };
    const mean=(Number(current.measured)+Number(previous.measured))/2;
    const variability=mean>0?Math.abs(Number(current.measured)-Number(previous.measured))/mean:Infinity;
    const e1=(Number(previous.measured)-Number(current.targetGS))/Number(current.targetGS)*100;
    const e2=(Number(current.measured)-Number(current.targetGS))/Number(current.targetGS)*100;
    const meanErr=(mean-Number(current.targetGS))/Number(current.targetGS)*100;
    const common={...base, measuredGS:round(mean,3), previousGS:round(Number(previous.measured),3), currentGS:round(Number(current.measured),3), variabilityPct:round(variability*100,1), repeatCount:2, maxStepRule:opt.rule};
    if (!Number.isFinite(variability) || variability>opt.maxVariability) return {...common,usable:false,action:"VARIABLE / REPEAT",confidence:"LOW",reason:`Repeated ${label} response differs by ${round(variability*100,1)}%; keep the same command rather than chasing shot variability.`};
    if (Math.abs(e1)<=opt.deadbandPct && Math.abs(e2)<=opt.deadbandPct) return {...common,usable:true,action:"HOLD",confidence:"HIGH",suggestedCommandMlS:round(Number(current.command),3),reason:`Both matching shots are inside the ${opt.deadbandPct}% deadband.`};
    if (Math.sign(e1)!==Math.sign(e2) || Math.abs(e1)<=opt.deadbandPct || Math.abs(e2)<=opt.deadbandPct) return {...common,usable:false,action:"MIXED / REPEAT",confidence:"MEDIUM",reason:`The two matching shots do not show the same out-of-band direction; keep the command and collect another shot.`};
    const ratio=Number(current.targetGS)/mean;
    let factor=1+(ratio-1)*opt.gain;
    factor=Math.max(1-opt.maxFraction,Math.min(1+opt.maxFraction,factor));
    let out=Number(current.command)*factor;
    out=Math.max(Number(current.command)-opt.maxAbs,Math.min(Number(current.command)+opt.maxAbs,out));
    out=clampCommandFlow(out);
    const delta=Math.abs(out-Number(current.command));
    return {...common,usable:true,action:delta<0.005?"HOLD":"ADJUST",confidence:"HIGH",suggestedCommandMlS:round(out,3),errorPct:round(meanErr,1),reason:delta<0.005?`Consensus error is too small to justify a command change.`:`Two matching ${label} shots agree on the same error direction; apply one bounded damped step to the next shot.`};
  }

  // A varying absolute level must not veto a repeatable shape by itself. This
  // fallback requires same commands, timings AND measurement basis. It freezes
  // LEVEL and compares frame flows normalized independently within each shot.
  function stage3ShapeOnlyConsensus(current, previous) {
    if (!sameStage3Shape(current, previous) || current.measurementBasis !== previous.measurementBasis ||
        current.stall || previous.stall || current.stallQualitative || previous.stallQualitative) return null;
    if (![current,previous].every(e => e.status === "LATE DECAY" &&
        Number.isFinite(Number(e.lateToEarlyRatio)) && Number(e.lateToEarlyRatio) < 0.80 &&
        Number(e.overallR2) >= 0.95 && e.source.every(x =>
          Number(x.r2) >= 0.95 && Number(x.seconds) >= 3 && Number(x.measured) > 0 &&
          Number(x.command) >= 0.10 && Number(x.command) <= 8))) return null;
    const weights = current.source.map((x,i) => Math.min(Number(x.seconds),Number(previous.source[i].seconds)));
    const weightSum = weights.reduce((a,b)=>a+b,0);
    const normalized = e => {
      const mean = e.source.reduce((sum,x,i)=>sum+Number(x.measured)*weights[i],0)/weightSum;
      return e.source.map(x=>Number(x.measured)/mean);
    };
    const a=normalized(current), b=normalized(previous);
    const shapeVar=Math.max(...a.map((x,i)=>Math.abs(x-b[i])/((x+b[i])/2)));
    const overallMean=(Number(current.overallGS)+Number(previous.overallGS))/2;
    const overallVar=Math.abs(Number(current.overallGS)-Number(previous.overallGS))/overallMean;
    const profileRatio = e => Number(e.source[2].measured)/Number(e.source[0].measured);
    // Require decay in both the diagnostic quarters and the actual profile frames.
    if (!Number.isFinite(shapeVar) || shapeVar>0.15 || !Number.isFinite(overallVar) || overallVar>0.20 ||
        ![current,previous].every(e=>profileRatio(e)<0.80) ||
        Math.abs(profileRatio(current)-profileRatio(previous))>0.12) return null;
    const commands=current.source.map(x=>Number(x.command));
    let factors=a.map((x,i)=>Math.max(0.97,Math.min(1.03,1+(1/((x+b[i])/2)-1)*0.08)));
    // Preserve weighted command exposure, rather than only the mean factor.
    const exposure=commands.reduce((sum,x,i)=>sum+x*weights[i],0);
    const norm=factors.reduce((sum,x,i)=>sum+x*commands[i]*weights[i],0)/exposure;
    let proposed=commands.map((x,i)=>round(x*factors[i]/norm,3));
    if (proposed.some((x,i)=>x<0.10 || x>8 || Math.abs(x-commands[i])>0.05 ||
        Math.abs(x/commands[i]-1)>0.04)) return null;
    if (proposed[0]>proposed[1] || proposed[1]>proposed[2] ||
        proposed.slice(1).some((x,i)=>x>proposed[i]*1.35 || x-proposed[i]>0.25)) return null;
    const exposureChange=proposed.reduce((sum,x,i)=>sum+x*weights[i],0)/exposure-1;
    if (Math.abs(exposureChange)>0.002 || !proposed.some((x,i)=>Math.abs(x-commands[i])>=0.005)) return null;
    return {
      usable:true, action:"SHAPE ONLY / LEVEL HOLD", confidence:"MEDIUM",
      targetGS:current.targetGS, overallGS:round(overallMean,3), levelFactor:1,
      shapeFactors:proposed.map((x,i)=>round(x/commands[i],4)),
      normalizedShapeVariabilityPct:round(shapeVar*100,1), overallVariabilityPct:round(overallVar*100,1),
      weightedCommandChangePct:round(exposureChange*100,3),
      status:current.status, lateToEarlyRatio:current.lateToEarlyRatio, repeatCount:2,
      sourceFrames:current.source.map((x,i)=>({name:x.name,commandMlS:x.command,currentGS:x.measured,
        previousGS:previous.source[i].measured,r2:Math.min(x.r2,previous.source[i].r2),windowS:weights[i]})),
      suggestedShape:{earlyCommand:proposed[0],earlySeconds:current.earlySeconds,
        midCommand:proposed[1],midSeconds:current.midSeconds,lateCommand:proposed[2]},
      maxStepRule:"SHAPE ONLY: 2 same-basis clean decay shots; normalized variation ≤15%, overall variation ≤20%; LEVEL held; each frame ≤4% and 0.05 ml/s; weighted command exposure within 0.2%",
      reason:"Absolute frame levels vary, but normalized decay agrees in two matching shots. Apply a small next-shot shape correction with LEVEL held. Weighted command exposure is preserved; cup flow still requires validation."
    };
  }

  // Steady-gain feed-forward estimate: median cup/command from the last eight
  // clean shots of the same stage. S2 uses the S2 evidence pair; S3 uses the
  // duration-weighted command and overall cup flow so the three-frame shape is
  // not mixed into one number. This is a reference value; the bounded next-shot
  // controller still applies its own step limits.
  function stageGainEstimate(stage,run,current) {
    const rows=[];
    const addSingle=e=>{if(!e)return;const cmd=Number(e.command),m=Number(e.measured);if(cmd>0&&m>0)rows.push({k:m/cmd,cmd,m,runId:e.runId});};
    const addS3=e=>{if(!e)return;if(Array.isArray(e.source)&&e.source.length){let ws=0,cs=0,ms=0;for(const f of e.source){const w=Math.max(1,Number(f.seconds)||1),c=Number(f.command),m=Number(f.measured);if(c>0&&m>0){ws+=w;cs+=c*w;ms+=m*w;}}if(ws>0&&cs>0&&ms>0)rows.push({k:(ms/ws)/(cs/ws),cmd:cs/ws,m:ms/ws,runId:e.runId});}else addSingle(e);};
    const saved=(state.persistentHistoryFile&&state.persistentHistoryFile.shots||[]).slice(-8);
    for(const s of saved)stage==="s3"?addS3(s.evidence&&s.evidence.s3):addSingle(s.evidence&&s.evidence[stage]);
    stage==="s3"?addS3(current):addSingle(current);
    if(rows.length<2)return {samples:rows.length,k:null};
    const ks=rows.map(x=>x.k).sort((a,b)=>a-b),k=median(ks);
    if(!(k>0))return null;
    const spread=Math.sqrt(rows.reduce((a,x)=>a+(x.k-k)**2,0)/rows.length)/k;
    const last=rows[rows.length-1];
    return {samples:rows.length,k,spread,command:last.cmd,measured:last.m,sources:rows.map(x=>x.runId).filter(Boolean).slice(-8)};
  }
  function nextShotAdaptiveSuggestion(run) {
    if (!trustedAdaptiveRun(run)) return null;
    const s1ev=stage1AdaptiveEvidence(run), s2ev=stage2AdaptiveEvidence(run), s3ev=stage3AdaptiveEvidence(run);
    const s1Search=matchingAdaptiveEvidenceSearch(s1ev,"s1"),s2Search=matchingAdaptiveEvidenceSearch(s2ev,"s2"),s3Search=matchingAdaptiveEvidenceSearch(s3ev,"s3");
    const searchAudit=x=>{const {evidence,...audit}=x;return audit;};
    const policy=learningPolicy(run.config.adaptiveLearningLevel);
    const s1=scalarLearningSuggestion("S1 startup","s1",s1ev,s1Search.evidence,policy,!!s1ev&&Math.abs(s1ev.errorPct)>=20);

    if (!s1ev) {
      const startup=stage1StartupMetrics(run);
      s1.reason=stage1LiveLearning(run).applicable?stage1LiveLearning(run).reason:startup ? startup.qualityReason : "Not enough S1 RAW scale samples or collected gain.";
      s1.startupMetrics=startup;
    }
    const s2=s2AdaptiveSuggestion(run,s2ev,s2Search.evidence);

    const liveS2=controlLearningAssessment(run,"stage2"),liveS3=controlLearningAssessment(run,"stage3");
    s2.evidenceBasis=liveS2.applicable?liveS2.basis:s2ev&&s2ev.measurementBasis||"RAW fixed-command regression";
    if(liveS2.applicable)s2.reason=liveS2.reason+"; "+s2.reason;
    else if(!s2ev){const q=controlOutputQuality(run,"stage2"),limit=learningAdmission(run).spread(12);if(q.available&&q.tailRippleCVPct>limit)s2.reason=`S2 tail ripple ${q.tailRippleCVPct}% exceeds ${round(limit,2)}% learning limit`;}
    let s3={usable:false,action:"REPEAT",confidence:"INSUFFICIENT",reason:liveS3.applicable?liveS3.reason:"S3 segment/overall data is insufficient."};
    if (s3ev) {
      const prev=s3Search.evidence;
      if (!prev) {
        s3={usable:false,action:"REPEAT SAME SHAPE",confidence:"PENDING",targetGS:round(Number(s3ev.targetGS),3),overallGS:s3ev.overallGS,status:s3ev.status,lateToEarlyRatio:s3ev.lateToEarlyRatio,sourceFrames:s3ev.source.map(x=>({name:x.name,commandMlS:x.command,measuredGS:x.measured,r2:x.r2,windowS:x.seconds})),repeatCount:1,maxStepRule:"2 matching shots; LEVEL and SHAPE are solved separately",reason:"One clean S3 shot is not enough. Repeat the same shape once more before numeric next-shot adaptation."};
      } else if (s3ev.stall || prev.stall) {
        const target=Number(s3ev.targetGS);
        const currentRatio=Number(s3ev.lateToEarlyRatio), previousRatio=Number(prev.lateToEarlyRatio);
        const currentLateWeak=!!(s3ev.stall || s3ev.status==="LATE DECAY" || (Number.isFinite(currentRatio)&&currentRatio<0.75));
        const previousLateWeak=!!(prev.stall || prev.status==="LATE DECAY" || (Number.isFinite(previousRatio)&&previousRatio<0.75));
        const bothLateWeak=currentLateWeak&&previousLateWeak;
        const overallMean=(Number(s3ev.overallGS)+Number(prev.overallGS))/2;
        const currentErr=(Number(s3ev.overallGS)-target)/target*100;
        const previousErr=(Number(prev.overallGS)-target)/target*100;
        if (!bothLateWeak || !Number.isFinite(overallMean) || overallMean<=0) {
          s3={usable:false,action:"STALL / REPEAT",confidence:"LOW",targetGS:round(target,3),overallGS:Number.isFinite(overallMean)?round(overallMean,3):null,status:s3ev.status,lateToEarlyRatio:s3ev.lateToEarlyRatio,repeatCount:2,maxStepRule:"stall recovery requires 2 same-shape shots that both show late weakness",reason:"A confirmed stall exists, but the matching shot does not confirm the same late-weakness pattern. Keep the current profile and repeat rather than chase one stall."};
        } else {
          // STALL RECOVERY: the dedicated stall detector is qualitative evidence, so use a
          // smaller bounded step than the normal clean LEVEL+SHAPE controller. LEVEL is
          // allowed to rise only when BOTH matching shots are >10% below target. SHAPE is
          // normalized so late compensation does not silently create a large level jump.
          let levelFactor=1;
          if (currentErr < -10 && previousErr < -10) {
            const ratio=target/overallMean;
            levelFactor=1+(ratio-1)*0.14;
            levelFactor=Math.max(1.0,Math.min(1.04,levelFactor));
          }
          const ratios=[currentRatio,previousRatio].filter(Number.isFinite);
          const meanLateRatio=ratios.length?ratios.reduce((a,b)=>a+b,0)/ratios.length:0.5;
          const severity=Math.max(0,Math.min(1,(0.80-meanLateRatio)/0.80));
          const weights=s3ev.source.map(x=>Math.max(1,Number(x.seconds)||1));
          const wsum=weights.reduce((a,b)=>a+b,0);
          let shapeFactors=[1-0.025*severity,1+0.005*severity,1+0.060*severity];
          const norm=shapeFactors.reduce((a,f,i)=>a+f*weights[i],0)/wsum;
          shapeFactors=shapeFactors.map(f=>f/Math.max(0.001,norm));
          const bounded=(cmd,f)=>{let out=cmd*f;out=Math.max(cmd*0.93,cmd-0.05,out);out=Math.min(cmd*1.07,cmd+0.05,out);return clampCommandFlow(out)};
          const commands=s3ev.source.map(x=>Number(x.command));
          let early=bounded(commands[0],levelFactor*shapeFactors[0]);
          let mid=bounded(commands[1],levelFactor*shapeFactors[1]);
          let late=bounded(commands[2],levelFactor*shapeFactors[2]);
          mid=Math.max(mid,early); late=Math.max(late,mid);
          const boundRise=(a,b)=>Math.min(b,Math.max(a,Math.min(a+0.25,a*1.35)));
          mid=boundRise(early,mid);late=boundRise(mid,late);
          const changed=[early,mid,late].some((v,i)=>Math.abs(v-commands[i])>=0.005);
          s3={usable:changed,action:changed?"STALL RECOVERY":"STALL / HOLD",confidence:"MEDIUM",targetGS:round(target,3),overallGS:round(overallMean,3),levelErrorPct:round((overallMean-target)/target*100,1),levelFactor:round(levelFactor,4),shapeFactors:shapeFactors.map(x=>round(x,4)),status:s3ev.status,lateToEarlyRatio:s3ev.lateToEarlyRatio,meanLateToEarlyRatio:round(meanLateRatio,3),recoverySeverity:round(severity,3),repeatCount:2,maxStepRule:"STALL RECOVERY requires 2 same-shape late-weak shots with ≥1 confirmed stall; LEVEL max +4%; each frame max ±7% and ±0.05 ml/s",sourceFrames:s3ev.source.map((x,i)=>({name:x.name,commandMlS:round(x.command,3),currentGS:round(x.measured,3),previousGS:round(prev.source[i]&&prev.source[i].measured,3),quality:x.quality||"clean",r2:x.r2,windowS:x.seconds})),suggestedShape:changed?{earlyCommand:round(early,3),earlySeconds:s3ev.earlySeconds,midCommand:round(mid,3),midSeconds:s3ev.midSeconds,lateCommand:round(late,3)}:null,reason:changed?"Two matching S3 shots confirm late weakness and at least one has a dedicated low-flow stall. Apply one conservative next-shot recovery step: LEVEL rises only if both overall flows are low, while normalized SHAPE shifts command toward LATE.":"Repeated stall evidence was confirmed but the bounded recovery step is too small to justify a profile rewrite."};
        }
      } else {
        const pairs=s3ev.source.map((x,i)=>{const p=prev.source[i],mean=(Number(x.measured)+Number(p.measured))/2;return {name:x.name,command:Number(x.command),measuredMean:mean,variability:mean>0?Math.abs(Number(x.measured)-Number(p.measured))/mean:Infinity,r2:Math.min(Number(x.r2),Number(p.r2)),seconds:Math.max(1,Math.min(Number(x.seconds),Number(p.seconds))),currentMeasured:Number(x.measured),previousMeasured:Number(p.measured)}});
        const overallMean=(Number(s3ev.overallGS)+Number(prev.overallGS))/2;
        const overallVar=overallMean>0?Math.abs(Number(s3ev.overallGS)-Number(prev.overallGS))/overallMean:Infinity;
        const maxVar=Math.max(overallVar,...pairs.map(x=>x.variability));
        const minR2=Math.min(Number(s3ev.overallR2),Number(prev.overallR2),...pairs.map(x=>x.r2));
        if (!Number.isFinite(maxVar)||maxVar>0.20) {
          s3={usable:false,action:"VARIABLE / REPEAT",confidence:"LOW",targetGS:round(Number(s3ev.targetGS),3),overallGS:round(overallMean,3),status:s3ev.status,lateToEarlyRatio:s3ev.lateToEarlyRatio,repeatCount:2,variabilityPct:round(maxVar*100,1),sourceFrames:pairs.map(x=>({name:x.name,commandMlS:round(x.command,3),measuredGS:round(x.measuredMean,3),variabilityPct:round(x.variability*100,1),previousGS:round(x.previousMeasured,3),currentGS:round(x.currentMeasured,3),r2:round(x.r2,5),windowS:round(x.seconds,2)})),maxStepRule:"no numeric adjustment when any repeated S3 measure differs by >20%",reason:"The repeated S3 response is too variable. Keep the same shape and repeat instead of chasing the latest shot."};
          const shapeOnly=stage3ShapeOnlyConsensus(s3ev,prev);
          if (shapeOnly) s3={...s3,...shapeOnly};
        } else {
          const confidence=minR2>=0.97&&maxVar<=0.15?"HIGH":"MEDIUM";
          const target=Number(s3ev.targetGS);
          const levelErr=(overallMean-target)/target*100;
          const levelGain=policy.gain*(confidence==="HIGH"?1:.75);
          let levelFactor=1;
          if (Math.abs(levelErr)>8) levelFactor=1+(target/overallMean-1)*levelGain;
          levelFactor=Math.max(0.95,Math.min(1.05,levelFactor));
          const weights=pairs.map(x=>Math.max(1,x.seconds));
          const wsum=weights.reduce((a,b)=>a+b,0);
          const frameMean=pairs.reduce((a,x,i)=>a+x.measuredMean*weights[i],0)/wsum;
          const shapeGain=policy.gain*(confidence==="HIGH"?.5:.35);
          let shapeFactors=pairs.map(x=>{
            const rel=frameMean/Math.max(0.05,x.measuredMean);
            let f=1+(rel-1)*shapeGain;
            return Math.max(0.97,Math.min(1.03,f));
          });
          const norm=shapeFactors.reduce((a,f,i)=>a+f*weights[i],0)/wsum;
          shapeFactors=shapeFactors.map(f=>f/Math.max(0.001,norm));
          const bounded=(cmd,f)=>{let out=cmd*f;out=Math.max(cmd*0.93,cmd-0.05,out);out=Math.min(cmd*1.07,cmd+0.05,out);return clampCommandFlow(out)};
          let early=bounded(pairs[0].command,levelFactor*shapeFactors[0]);
          let mid=bounded(pairs[1].command,levelFactor*shapeFactors[1]);
          let late=bounded(pairs[2].command,levelFactor*shapeFactors[2]);
          const rawProposedCommands=[early,mid,late],projected=projectS3Commands(rawProposedCommands,pairs.map(x=>x.command),policy,weights);
          [early,mid,late]=projected;
          const changed=[early,mid,late].some((v,i)=>Math.abs(v-pairs[i].command)>=0.005);
          s3={usable:true,rawProposedCommands,action:changed?"LEVEL + SHAPE":"HOLD",confidence,targetGS:round(target,3),overallGS:round(overallMean,3),levelErrorPct:round(levelErr,1),levelFactor:round(levelFactor,4),shapeFactors:shapeFactors.map(x=>round(x,4)),status:s3ev.status,lateToEarlyRatio:s3ev.lateToEarlyRatio,repeatCount:2,variabilityPct:round(maxVar*100,1),maxStepRule:"2 matching shots; LEVEL uses overall S3; SHAPE is normalized to ~zero weighted level change; each frame max ±7% and ±0.05 ml/s",sourceFrames:pairs.map(x=>({name:x.name,commandMlS:round(x.command,3),measuredGS:round(x.measuredMean,3),variabilityPct:round(x.variability*100,1),previousGS:round(x.previousMeasured,3),currentGS:round(x.currentMeasured,3),r2:round(x.r2,5),windowS:round(x.seconds,2)})),suggestedShape:changed?{earlyCommand:round(early,3),earlySeconds:s3ev.earlySeconds,midCommand:round(mid,3),midSeconds:s3ev.midSeconds,lateCommand:round(late,3)}:null,reason:changed?"S3 overall LEVEL and EARLY/MID/LATE SHAPE were solved separately, then combined into one bounded next-shot profile.":"S3 consensus is inside the overall deadband and shape imbalance is too small to justify a change."};
        }
      }
    }
    const singleS3=stage3SingleSuggestion(s3ev,s3Search.evidence,policy);if(singleS3)s3=singleS3;else if(s3ev&&!s3Search.evidence&&policy.rank<2)s3.reason="Selected learning policy requires another comparable S3 observation; command and timing changes remain usable";
    if(s3.suggestedShape&&s3ev&&Array.isArray(s3ev.source)){
      const keys=["earlyCommand","midCommand","lateCommand"],old=s3ev.source.map(x=>Number(x.command)),[fraction,absolute]=policy.s3;
      let requested=Array.isArray(s3.rawProposedCommands)?s3.rawProposedCommands.slice():keys.map(k=>Number(s3.suggestedShape[k]));
      const actual=liveS3.outputQuality;
      if(liveS3.applicable&&actual&&actual.available&&Math.abs(actual.tailErrorPct)>policy.deadband){
        const high=actual.tailErrorPct>0;
        const guarded=requested.map((v,i)=>high?Math.min(v,old[i]):Math.max(v,old[i]));
        s3.actualDirectionGuard={actualTailErrorPct:actual.tailErrorPct,blocked:guarded.some((v,i)=>Math.abs(v-requested[i])>.0001),direction:high?"no-increase":"no-decrease"};
        requested=guarded;
        if(s3.actualDirectionGuard.blocked)s3.reason+="; Actual RAW tail disagrees with modeled correction; opposite-direction changes withheld";
      }
      const next=projectS3Commands(requested,old,policy,s3ev.source.map(x=>x.seconds));
      if(next.every((v,i)=>Number.isFinite(v)&&Math.abs(v-old[i])<=absolute+.001&&Math.abs(v/old[i]-1)<=fraction+.002))keys.forEach((k,i)=>s3.suggestedShape[k]=round(next[i],3));
      else {delete s3.suggestedShape;s3.usable=false;s3.action="LIMITED / HOLD";s3.reason="S3 proposed shape cannot satisfy the selected learning bounds";}
    }
    if(s3.suggestedShape&&s3ev){
      const proposed=[s3.suggestedShape.earlyCommand,s3.suggestedShape.midCommand,s3.suggestedShape.lateCommand],old=s3ev.source.map(x=>Number(x.command));
      if(!proposed.some((v,i)=>Math.abs(v-old[i])>=.005)){delete s3.suggestedShape;s3.action="HOLD";s3.reason+="; Bounded projection retains the current commands";}
    }
    s3.learningLevel=policy.name;s3.maxStepRule=`${policy.name}: S3 step ≤${round(policy.s3[0]*100,1)}% / ${policy.s3[1]} ml/s per frame; original shape bounds retained`;
    const gainS2=stageGainEstimate("s2",run,s2ev),gainS3=stageGainEstimate("s3",run,s3ev);
    const addGain=(targetNode,gain,stageKey,limits)=>{
      const node=stageKey==="s2"?s2:s3;
      if(!gain||!(Number(gain.k)>0)){node.gainFeedForward={stage:stageKey,samples:gain&&Number(gain.samples)||0,k:null};return;}
      const target=Number(targetNode&&targetNode.targetGS)||Number(run.config&&run.config[stageKey==="s2"?"stage2Flow":"stage3Flow"]);
      const cmd=Number(gain.command),ff=cmd>0?target/gain.k:null;
      if(!(Number.isFinite(ff)&&ff>0))return;
      const [frac,abs]=limits;
      const bounded=Math.max(cmd*(1-frac),cmd-abs,Math.min(cmd*(1+frac),cmd+abs,ff));
      // Two agreeing shots are enough once their spread is <=5% (a <=10%
      // relative difference); three or more shots may use the wider 10% band.
      const ok=gain.samples>=3?gain.spread<=.10:gain.samples===2&&gain.spread<=.05;
      const info={stage:stageKey,samples:gain.samples,k:round(gain.k,3),spread:round(gain.spread,3),targetGS:round(target,3),currentCommandMlS:round(cmd,3),targetCommandMlS:round(ff,3),boundedCommandMlS:round(bounded,3),sources:gain.sources,applied:false};
      node.gainFeedForward=info;
      if(!ok)return;
      if(stageKey==="s2"){
        if(node.usable!==false&&Math.abs(bounded-cmd)>=.005){
          node.suggestedCommandMlS=round(bounded,3);node.action=node.action==="HOLD"?"ADJUST":node.action;
          node.gainFeedForward.applied=true;node.reason+=`; steady-gain feed-forward: k=${round(gain.k,3)}, bounded command ${round(bounded,3)} ml/s`;
        }
        return;
      }
      if(stageKey==="s3"&&node.suggestedShape&&s3ev&&Array.isArray(s3ev.source)){
        const old=s3ev.source.map(x=>Number(x.command)),ratio=bounded/cmd;
        const projected=projectS3Commands(old.map(v=>v*ratio),old,policy,s3ev.source.map(x=>x.seconds));
        if(projected.some((v,i)=>Math.abs(v-old[i])>=.005)){
          node.suggestedShape={...node.suggestedShape,earlyCommand:round(projected[0],3),midCommand:round(projected[1],3),lateCommand:round(projected[2],3)};
          node.action="LEVEL + SHAPE";node.gainFeedForward.applied=true;node.reason+=`; steady-gain feed-forward: k=${round(gain.k,3)}, bounded command ${round(bounded,3)} ml/s`;
        }
      }
    };
    addGain(s2ev,gainS2,"s2",policy.s2);addGain(s3ev,gainS3,"s3",policy.s3);
    s1.evidenceBasis=s1ev&&s1ev.measurementBasis||"startup 20–80%";
    s1.historySearch=searchAudit(s1Search);s2.historySearch=searchAudit(s2Search);s3.historySearch=searchAudit(s3Search);
    const actuatorGuards={stage1:stageActuatorEvidence(run,"stage1"),stage2:stageActuatorEvidence(run,"stage2"),stage3:stageActuatorEvidence(run,"stage3")};
    for (const [key,guard] of [["s1",actuatorGuards.stage1],["s2",actuatorGuards.stage2],["s3",actuatorGuards.stage3]]) {
      const decision=key==="s1"?s1:key==="s2"?s2:s3;
      if (!guard.eligible) Object.assign(decision,{usable:false,action:"LIMITED / HOLD",confidence:"INSUFFICIENT",reason:guard.reason,actuatorGuard:guard});
    }
    const actionable=!!((s1.usable&&s1.action==="ADJUST"&&Number.isFinite(Number(s1.suggestedCommandMlS)))||(s2.usable&&(s2.action==="ADJUST"||s2.action==="LUT COMPENSATE")&&Number.isFinite(Number(s2.suggestedCommandMlS)))||(s3.usable&&s3.suggestedShape));
    if(liveS2.applicable)s2.outputQuality=liveS2.outputQuality;
    if(liveS3.applicable){s3.outputQuality=liveS3.outputQuality;s3.evidenceBasis=liveS3.basis;if(liveS3.eligible)s3.reason=liveS3.reason+"; "+s3.reason;}
    return {usable:!!(s1.usable||s2.usable||s3.usable),actionable,basketContext:run.config.basketContext||"unknown",actuatorGuards,runId:run.runId,mode:"SHOT-TO-SHOT ONLY",learningLevel:policy.name,s1,s2,s3,note:run.config.experimentalLiveTrim?"Experimental live trim ran in this shot. This table proposes NEXT-SHOT changes only; normalized response is a local model. Actual RAW tracking metrics remain separate; LUT unchanged.":"All three stages use completed-shot evidence only. No running-shot scale control, no extra skipStep calls, and the calibration LUT is never rewritten."};
  }


  async function applyNextShotAdaptiveSuggestion(run, source) {
    if(state.curveApplyBusy||manualCurveBlocksRun(run))throw new Error("手动曲线已替代旧杯建议，下一杯完成后继续学习");
    if (state.phase !== "idle" || state.calibrationActive) throw new Error("Next-shot adaptation can only be applied while HyperEx is idle");
    recomputeCalibrationUsability();
    if (!state.calibrationMapUsable) throw new Error(`Calibration LUT is not usable: ${state.calibrationMapStaleReason || "not ready"}`);
    const suggestion = nextShotAdaptiveSuggestion(run);
    if (!suggestion || !suggestion.actionable) throw new Error("No actionable bounded next-shot suggestion is available from the latest HyperEx run");
    const binding = testOverrideBinding();
    const os = testOverrideStatus();
    const prevStages = os.valid && state.testOverrides && state.testOverrides.stages ? state.testOverrides.stages : {};
    const sourceCfg = run && run.config && typeof run.config === "object" ? run.config : {};

    const preserveStage = (stage) => {
      const n = stage === "stage1" ? "1" : stage === "stage2" ? "2" : "3";
      const sourceMode = String(sourceCfg[`stage${n}CommandMode`] || "").toLowerCase();
      const sourceCommand = Number(sourceCfg[`stage${n}CommandMlS`]);
      if (sourceMode === "manual" && Number.isFinite(sourceCommand)) {
        return { mode:"manual",origin:sourceCfg[`stage${n}CommandOrigin`]||stageCommandOrigin(stage,false), command:round(clampCommandFlow(sourceCommand),3) };
      }
      const q = prevStages[stage] && typeof prevStages[stage] === "object" ? prevStages[stage] : {};
      if (String(q.mode) === "manual" && Number.isFinite(Number(q.command))) {
        return { mode:"manual",origin:stageCommandOrigin(stage,false), command:round(clampCommandFlow(Number(q.command)),3) };
      }
      return { mode:"auto", command:null };
    };
    const stages = {
      stage1: preserveStage("stage1"),
      stage2: preserveStage("stage2"),
      stage3: preserveStage("stage3")
    };
    if (suggestion.s1 && suggestion.s1.usable && suggestion.s1.action === "ADJUST" && Number.isFinite(Number(suggestion.s1.suggestedCommandMlS))) {
      stages.stage1 = { mode:"manual",origin:"adaptive", command:round(clampCommandFlow(Number(suggestion.s1.suggestedCommandMlS)),3) };
    }
    if (suggestion.s2 && suggestion.s2.usable && (suggestion.s2.action === "ADJUST" || suggestion.s2.action === "LUT COMPENSATE") && Number.isFinite(Number(suggestion.s2.suggestedCommandMlS))) {
      stages.stage2 = { mode:"manual",origin:"adaptive", command:round(clampCommandFlow(Number(suggestion.s2.suggestedCommandMlS)),3) };
    }

    const sourceShape = sourceCfg.stage3Shape && typeof sourceCfg.stage3Shape === "object" ? sourceCfg.stage3Shape : null;
    let s3Shape = sourceShape && sourceShape.enabled === true
      ? JSON.parse(JSON.stringify(sourceShape))
      : (os.valid && state.testOverrides && state.testOverrides.s3Shape ? JSON.parse(JSON.stringify(state.testOverrides.s3Shape)) : { enabled:false });
    if (suggestion.s3 && suggestion.s3.usable && suggestion.s3.suggestedShape) {
      const q = suggestion.s3.suggestedShape;
      s3Shape = { enabled:true,origin:"adaptive", earlyCommand:round(clampCommandFlow(Number(q.earlyCommand)),3), earlySeconds:round(Math.max(3,Math.min(30,Number(q.earlySeconds))),1), midCommand:round(clampCommandFlow(Number(q.midCommand)),3), midSeconds:round(Math.max(3,Math.min(30,Number(q.midSeconds))),1), lateCommand:round(clampCommandFlow(Number(q.lateCommand)),3) };
    }
    if(s3Shape.enabled&&!s3Shape.origin)s3Shape.origin=sourceCfg.stage3CommandOrigin||stageCommandOrigin("stage3",true);
    const previousOverrides = state.testOverrides ? JSON.parse(JSON.stringify(state.testOverrides)) : null;
    try {
      state.testOverrides = { schema:3, writerVersion:PLUGIN_VERSION, savedAt:new Date().toISOString(), mapCreatedAt:binding.mapCreatedAt, activeRelease:binding.activeRelease, basketContext:binding.basketContext, targets:binding.targets, stages, s3Shape, adaptiveSource:{ runId:suggestion.runId, appliedAt:new Date().toISOString(), mode:String(source || "manual") } };
      storageWrite(STORAGE_TEST_OVERRIDES, state.testOverrides);

      const verifyStatus = testOverrideStatus();
      if (!verifyStatus.valid) throw new Error(`adaptive override readback rejected: ${verifyStatus.reason}`);
      if (suggestion.s1 && suggestion.s1.usable && suggestion.s1.action === "ADJUST") {
        const expectedS1 = round(clampCommandFlow(Number(suggestion.s1.suggestedCommandMlS)),3);
        const actualS1 = manualTestCommand("stage1");
        if (!Number.isFinite(actualS1) || Math.abs(Number(actualS1) - expectedS1) > 0.001) {
          throw new Error(`S1 adaptive readback mismatch: expected ${expectedS1}, got ${actualS1}`);
        }
      }
      if (suggestion.s2 && suggestion.s2.usable && (suggestion.s2.action === "ADJUST" || suggestion.s2.action === "LUT COMPENSATE")) {
        const expectedS2 = round(clampCommandFlow(Number(suggestion.s2.suggestedCommandMlS)),3);
        const actualS2 = manualTestCommand("stage2");
        if (!Number.isFinite(actualS2) || Math.abs(Number(actualS2) - expectedS2) > 0.001) {
          throw new Error(`S2 adaptive readback mismatch: expected ${expectedS2}, got ${actualS2}`);
        }
      }
      if (suggestion.s3 && suggestion.s3.usable && suggestion.s3.suggestedShape) {
        const expected = suggestion.s3.suggestedShape;
        const actual = s3ShapeStatus();
        const same = actual.enabled === true &&
          Math.abs(Number(actual.earlyCommand) - Number(expected.earlyCommand)) <= 0.001 &&
          Math.abs(Number(actual.midCommand) - Number(expected.midCommand)) <= 0.001 &&
          Math.abs(Number(actual.lateCommand) - Number(expected.lateCommand)) <= 0.001 &&
          Math.abs(Number(actual.earlySeconds) - Number(expected.earlySeconds)) <= 0.01 &&
          Math.abs(Number(actual.midSeconds) - Number(expected.midSeconds)) <= 0.01;
        if (!same) throw new Error(`S3 adaptive shape readback mismatch: ${JSON.stringify(actual)}`);
      }

      await syncHyperExProfile(state.workflowTitle === state.cfg.profileTitle);
      const commandFlows = commandFlowSummary();
      if (suggestion.s3 && suggestion.s3.usable && suggestion.s3.suggestedShape && commandFlows.stage3Mode !== "shape") {
        throw new Error(`S3 profile verification failed: effective mode is ${commandFlows.stage3Mode}`);
      }
      recordNextShotApplied(run, commandFlows);
      log(`Next-shot adaptive suggestion VERIFIED (${source || "manual"}) from ${suggestion.runId}: ${JSON.stringify(commandFlows)}`);
      return { verified:true, suggestion, commandFlows };
    } catch (applyError) {
      state.testOverrides = previousOverrides;
      storageWrite(STORAGE_TEST_OVERRIDES, previousOverrides || '');
      try { await syncHyperExProfile(state.workflowTitle === state.cfg.profileTitle); } catch (_) {}
      throw applyError;
    }
  }

  async function autoApplyNextShotIfEligible(run) {
    if (!state.autoApplyNextShot || !run || state.curveApplyBusy || manualCurveBlocksRun(run)) return;
    if (state.autoApplyLastStatus && state.autoApplyLastStatus.runId === run.runId &&
        ["applying","applied","manual-applied"].includes(state.autoApplyLastStatus.status)) return;
    const suggestion = nextShotAdaptiveSuggestion(run);
    if (!suggestion || !suggestion.actionable) {
      state.autoApplyLastStatus = {
        runId: run.runId, status: "waiting", at: new Date().toISOString(),
        message: suggestion ? `S1 ${suggestion.s1&&suggestion.s1.action||"—"} · S2 ${suggestion.s2&&suggestion.s2.action||"—"} · S3 ${suggestion.s3&&suggestion.s3.action||"—"}` : "No actionable suggestion; current settings retained"
      };
      emitSkinChanged();
      log(`AUTO APPLY waiting after ${run.runId}: ${state.autoApplyLastStatus.message}.`);
      refreshLearningStage();
      return;
    }
    state.autoApplyLastStatus = {runId:run.runId,status:"applying",at:new Date().toISOString(),message:"Applying proposal; awaiting workflow readback and machine upload acknowledgement"};
    emitSkinChanged();
    try {
      const result = await applyNextShotAdaptiveSuggestion(run, "auto");
      state.autoApplyLastStatus = {
        runId: run.runId, status: "applied", at: new Date().toISOString(),
        message: "Verified next-shot adaptive override applied automatically",
        commandFlows: result.commandFlows
      };
      emitSkinChanged();
      log(`AUTO APPLY completed for ${run.runId}.`);
      refreshLearningStage();
    } catch (error) {
      state.autoApplyLastStatus = {
        runId: run.runId, status: "error", at: new Date().toISOString(),
        message: String(error.message || error)
      };
      emitSkinChanged();
      log(`AUTO APPLY failed safely for ${run.runId}: ${error.message || error}`);
    }
  }

  async function adaptiveAuditPayload() {
    const revision=state.workflowSelectionRevision;
    const basketContext=state.cfg.basketContext;
    const fingerprint=adaptiveHistoryFingerprintKey(adaptiveHistoryFingerprint());
    const expected=profileObject();
    const response=await api("/workflow",{method:"GET"});
    const body=await response.json();
    const actual=body && body.profile && typeof body.profile==="object" ? body.profile : null;
    const contextStable=revision===state.workflowSelectionRevision && basketContext===state.cfg.basketContext && fingerprint===adaptiveHistoryFingerprintKey(adaptiveHistoryFingerprint()) && profileExecutionEquivalent(expected,profileObject());
    const proposal=nextShotAdaptiveSuggestion(state.diagnosticLast);
    const commands=actual?profileCommandSummaryFromProfile(actual):null;
    const close=(a,b)=>finiteOrNull(a)!==null && finiteOrNull(b)!==null && Math.abs(Number(a)-Number(b))<=0.001;
    let proposalMatchesWorkflow=null;
    if (proposal && proposal.actionable) {
      proposalMatchesWorkflow=!!(contextStable && commands);
      for (const [key,field] of [["s1","stage1CommandMlS"],["s2","stage2CommandMlS"]]) {
        const q=proposal[key];
        if (q && q.usable && (q.action==="ADJUST"||q.action==="LUT COMPENSATE")) proposalMatchesWorkflow=proposalMatchesWorkflow && close(commands&&commands[field],q.suggestedCommandMlS);
      }
      if (proposal.s3 && proposal.s3.usable && proposal.s3.suggestedShape) {
        const shape=commands && commands.s3Shape;
        proposalMatchesWorkflow=proposalMatchesWorkflow && !!(shape&&shape.enabled) &&
          ["earlyCommand","earlySeconds","midCommand","midSeconds","lateCommand"].every(k=>close(shape[k],proposal.s3.suggestedShape[k]));
      }
    }
    // Read-only: never repairs or uploads a profile. A proposal is separate
    // from the workflow and neither is independent DE1 firmware-memory proof.
    return {serverTime:new Date().toISOString(),basketContext,
      contextStable,rawWorkflowProfile:actual,actualCommands:actual?profileCommandSummaryFromProfile(actual):null,
      expectedCommands:profileCommandSummaryFromProfile(expected),
      workflowMatchesExpected:contextStable && profileExecutionEquivalent(actual,expected),
      differences:profileExecutionDifferences(actual,expected),
      proposal,proposalMatchesWorkflow,baselinePrior:baselineFeedForwardPayload(),
      autoApply:state.autoApplyLastStatus,cachedProfileTruth:runtimeProfileTruthPayload(),
      machineProfileIndependentlyReadBack:false};
  }

  function diagnosticRunCommandSnapshot(run) {
    const c = run && run.config && typeof run.config === "object" ? run.config : null;
    if (!c) return null;
    const shape = c.stage3Shape && c.stage3Shape.enabled === true ? c.stage3Shape : null;
    return {
      stage1: { desiredGS: round(c.stage1Flow,3), lutCommandMlS: round(c.stage1LutCommandMlS,3), commandMlS: round(c.stage1CommandMlS,3), mode: String(c.stage1CommandMode || "auto"),origin:c.stage1CommandOrigin||null },
      stage2: { desiredGS: round(c.stage2Flow,3), lutCommandMlS: round(c.stage2LutCommandMlS,3), commandMlS: round(c.stage2CommandMlS,3), mode: String(c.stage2CommandMode || "auto"),origin:c.stage2CommandOrigin||null },
      stage3: shape ? {
        desiredGS: round(c.stage3Flow,3), lutCommandMlS: round(c.stage3LutCommandMlS,3), mode:"shape",origin:c.stage3CommandOrigin||null,
        shape: {
          enabled:true, earlyCommand:round(shape.earlyCommand,3), earlySeconds:round(shape.earlySeconds,1),
          midCommand:round(shape.midCommand,3), midSeconds:round(shape.midSeconds,1), lateCommand:round(shape.lateCommand,3)
        }
      } : {
        desiredGS: round(c.stage3Flow,3), lutCommandMlS: round(c.stage3LutCommandMlS,3), mode:String(c.stage3CommandMode || "auto"),origin:c.stage3CommandOrigin||null,
        flatCommandMlS: round(c.stage3CommandMlS,3), shape:{ enabled:false }
      }
    };
  }

  function diagnosticSummary(run) {
    if (!run) return null;
    return {
      runId: run.runId,
      kind: run.kind || "hyperex",
      profileTitle: run.profileTitle || "",
      startedAt: run.startedAt,
      endedAt: run.endedAt,
      result: run.result,
      liveFlowTrim: run.liveFlowTrim || null,
      controlReview: controlRunReview(run),
      historyPersistence:historyPersistenceAudit(run.runId),
      learningPolicy:learningPolicy(run.config&&run.config.adaptiveLearningLevel),
      learningEvidence: {stage1:stage1LiveLearning(run),stage2:controlLearningAssessment(run,"stage2"),stage3:controlLearningAssessment(run,"stage3")},
      activeRelease:activeReleaseEnabled(run.config),
      shotCommands: diagnosticRunCommandSnapshot(run),
      sampleCount: Array.isArray(run.samples) ? run.samples.length : 0,
      rawScaleSampleCount: Array.isArray(run.rawScaleSamples) ? run.rawScaleSamples.length : 0,
      eventCount: Array.isArray(run.events) ? run.events.length : 0,
      learningIntegrity:assessRunLearningIntegrity(run),
      learningReview:run.learningReview||null,
      lastRawScaleWeightG: Array.isArray(run.rawScaleSamples) && run.rawScaleSamples.length ? round(run.rawScaleSamples[run.rawScaleSamples.length - 1].weightG, 3) : null,
      lastRawScaleDwDtGS: Array.isArray(run.rawScaleSamples) && run.rawScaleSamples.length ? round(run.rawScaleSamples[run.rawScaleSamples.length - 1].rawDwDtGS, 3) : null,
      lastDecaidWeightFlowGS: Array.isArray(run.rawScaleSamples) && run.rawScaleSamples.length ? round(run.rawScaleSamples[run.rawScaleSamples.length - 1].decaidWeightFlowGS, 3) : null,
      stage1: diagnosticPhaseSummary(run, "stage1"),
      stage2: diagnosticPhaseSummary(run, "stage2"),
      stage2CupOnset:stage2CupOnset(run),
      s2RefillTimeline:s2RefillTimeline(run),
      stage3: diagnosticPhaseSummary(run, "stage3"),
      stage2Startup: stage2StartupMetrics(run),
      stage2StartupNext: stage2StartupPlan(),
      stage1Startup: stage1StartupMetrics(run),
      stage3Stability: stage3StabilityDiagnostics(run),
      advisory: {
        stage1: referenceAdvisory(run, "stage1"),
        stage2: referenceAdvisory(run, "stage2"),
        stage3: referenceAdvisory(run, "stage3")
      },
      nextShotAdaptive: nextShotAdaptiveSuggestion(run),
      legacyStage1StartupFactor: round(stage1StartupFactor(), 4)
    };
  }

  function finalizeDiagnostics(result) {
    const run = state.diagnosticCurrent;
    if (!run) return;
    diagnosticSample("final", true);
    run.endedAt = new Date().toISOString();
    run.result = String(result || "ended");
    run.summary = diagnosticSummary(run);
    state.diagnosticLast = run;
    rememberAdaptiveEvidence(run);
    run.summary.stage2StartupNext=stage2StartupPlan();
    state.diagnosticCurrent = null;
    state.diagnosticLastSampleAtMs = 0;
    const s2 = run.summary && run.summary.stage2;
    const s3 = run.summary && run.summary.stage3;
    log(`Diagnostic capture saved: ${run.samples.length} samples; stage2 GFlow/Flow=${s2 && s2.ratioMedian !== null ? s2.ratioMedian : "n/a"}, stage3=${s3 && s3.ratioMedian !== null ? s3.ratioMedian : "n/a"}.`);
    return run;
  }

  function csvEscape(value) {
    if (value === null || value === undefined) return "";
    const s = String(value);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  function diagnosticCsv(run) {
    if (!run) return "No diagnostic run captured yet.\n";
    const headers = ["runId","tMs","source","phase","machineState","substate","profileFrame","targetFlowMlS","desiredRealFlowGS","targetPressureBar","machineFlowMlS","pressureBar","machineWeightFlowGS","rawScaleWeightG","rawScaleDwDtGS","decaidWeightFlowGS","scaleWeightG","scaleFlowGS","cumulativeWeightG","scaleAgeMs","gflowToMachineFlow"];
    const rows = [headers.join(",")];
    for (const s of run.samples || []) {
      const obj = { runId: run.runId, ...s };
      rows.push(headers.map(h => csvEscape(obj[h])).join(","));
    }
    rows.push("");
    rows.push("raw_scale_runId,raw_scale_tMs,raw_scale_phase,profileFrame,targetFlow_ml_s,machineFlow_ml_s,pressure_bar,raw_scale_timestamp,raw_scale_timestamp_seconds,raw_scale_weight_g,raw_scale_dWdt_g_s,decaid_weightFlow_g_s,raw_scale_tare_reset");
    for (const r of run.rawScaleSamples || []) {
      rows.push([
        run.runId,
        r.tMs,
        r.phase,
        r.profileFrame,
        r.targetFlowMlS,
        r.machineFlowMlS,
        r.pressureBar,
        r.scaleTimestamp,
        r.scaleTimestampSeconds,
        r.weightG,
        r.rawDwDtGS,
        r.decaidWeightFlowGS,
        r.tareReset ? 1 : 0
      ].map(csvEscape).join(","));
    }
    rows.push("");
    rows.push("event_tMs,event_name,event_phase,event_data");
    for (const e of run.events || []) {
      rows.push([e.tMs,e.name,e.phase,JSON.stringify(e.data || {})].map(csvEscape).join(","));
    }
    if(run.liveFlowTrim){
      rows.push("");rows.push("live_trim_tMs,kind,frame,decision,command_ml_s,previous_ml_s,raw_g_s,target_g_s,reason,retry,details");
      for(const x of run.liveFlowTrim.trace||[])rows.push([x.tMs,x.kind,x.frame,x.decision,x.commandMlS,x.previousMlS,x.rawGS,x.targetGS,x.reason,x.retry?1:0,JSON.stringify(x)].map(csvEscape).join(","));
    }
    if ((run.kind || "hyperex") === "hyperex") {
      const summary = diagnosticSummary(run);
      rows.push("");
      rows.push("validation_stage,target_real_g_s,machine_flow_avg_ml_s,decaid_weightFlow_avg_g_s,raw_weight_regression_g_s,regression_r2,regression_window_s,error_pct,status");
      for (const [label, p] of [["S1", summary.stage1],["S2", summary.stage2],["S3", summary.stage3]]) {
        rows.push([label,p && p.desiredRealFlowGS,p && p.machineFlowAvg,p && p.gflowAvg,p && p.rawRegressionGS,p && p.rawRegressionR2,p && p.rawRegressionSeconds,p && p.rawErrorPct,p && p.validationStatus].map(csvEscape).join(","));
      }
      rows.push("");
      rows.push("advisory_stage,confidence,action,current_command_ml_s,reference_command_ml_s,reference_range_min_ml_s,reference_range_max_ml_s,ratio,error_pct,message");
      for (const [label, a] of [["S1", summary.advisory && summary.advisory.stage1],["S2", summary.advisory && summary.advisory.stage2],["S3", summary.advisory && summary.advisory.stage3]]) {
        const rr = a && Array.isArray(a.referenceRangeMlS) ? a.referenceRangeMlS : [null,null];
        rows.push([label,a && a.confidence,a && a.action,a && a.currentCommandMlS,a && a.referenceCommandMlS,rr[0],rr[1],a && a.ratio,a && a.errorPct,a && a.message].map(csvEscape).join(","));
      }
      rows.push("");
      rows.push("s1_startup_confidence,first_rise_delay_s,transit_20_80_s,mid_flow_g_s,mid_r2,active_flow_g_s,active_seconds,gain_g,error_pct");
      const s1m = summary.stage1Startup || {};
      rows.push([s1m.confidence,s1m.firstRiseDelayS,s1m.transit20to80S,s1m.midFlowGS,s1m.midR2,s1m.activeFlowGS,s1m.activeSeconds,s1m.gainG,s1m.errorPct].map(csvEscape).join(","));
      rows.push("");
      rows.push("s3_segment,raw_regression_g_s,r2,window_s,samples");
      const s3s = summary.stage3Stability || {};
      for (const seg of [s3s.early,s3s.mid,s3s.late]) if (seg) rows.push([seg.name,seg.slope,seg.r2,seg.seconds,seg.samples].map(csvEscape).join(","));
      rows.push("s3_stability_status,late_to_early_ratio,stall_suspected,stall_start_s,stall_end_s,stall_raw_g_s,stall_machine_ml_s,stall_threshold_g_s");
      const st = s3s.stall || {};
      rows.push([s3s.status,s3s.lateToEarlyRatio,st.suspected?1:0,st.startS,st.endS,st.rawSlopeGS,st.machineFlowMlS,st.thresholdGS].map(csvEscape).join(","));
      if (Array.isArray(s3s.shapeFrames) && s3s.shapeFrames.length) {
        rows.push("s3_shape_frame,command_ml_s,raw_regression_g_s,r2,window_s,samples,planned_seconds");
        for (const x of s3s.shapeFrames) rows.push([x.name,x.commandMlS,x.slope,x.r2,x.seconds,x.samples,x.plannedSeconds].map(csvEscape).join(","));
      }
      const nx = summary.nextShotAdaptive || {};
      rows.push("");
      rows.push("next_shot_stage,usable,confidence,current_command_ml_s,suggested_command_ml_s,early_command_ml_s,early_seconds,mid_command_ml_s,mid_seconds,late_command_ml_s,reason");
      const nx1 = nx.s1 || {};
      rows.push(["S1",nx1.usable?1:0,nx1.confidence,nx1.currentCommandMlS,nx1.suggestedCommandMlS,null,null,null,null,null,nx1.reason].map(csvEscape).join(","));
      const nx2=nx.s2||{};rows.push(["S2",nx2.usable?1:0,nx2.confidence,nx2.currentCommandMlS,nx2.suggestedCommandMlS,null,null,null,null,null,nx2.reason].map(csvEscape).join(","));
      const nx3 = nx.s3 || {}, q3 = nx3.suggestedShape || {};
      rows.push(["S3",nx3.usable?1:0,nx3.confidence,null,null,q3.earlyCommand,q3.earlySeconds,q3.midCommand,q3.midSeconds,q3.lateCommand,nx3.reason].map(csvEscape).join(","));
    }
    rows.push("");rows.push("shot_command_stage,origin,internal_mode");
    const snapshot=diagnosticRunCommandSnapshot(run)||{};for(const key of ["stage1","stage2","stage3"]){const x=snapshot[key]||{};rows.push([key,x.origin||"retained",x.mode].map(csvEscape).join(","));}
    rows.push("learning_level,history_status");rows.push([learningPolicy(run.config&&run.config.adaptiveLearningLevel).name,historyPersistenceAudit(run.runId).status].map(csvEscape).join(","));
    return rows.join("\n") + "\n";
  }

  function emitGhcPrompt(status, secondsRemaining, message) {
    try {
      host.emit("ghcPrompt", {
        status: String(status || ""),
        secondsRemaining: Math.max(0, Math.ceil(Number(secondsRemaining) || 0)),
        message: String(message || "")
      });
    } catch (error) {
      log(`GHC prompt event failed: ${error.message || error}`);
    }
  }

  function stopGhcPrompt(status, message) {
    clearTimer("ghcCountdownTimer");
    state.ghcPromptStartedAtMs = 0;
    state.ghcSecondsRemaining = 0;
    emitGhcPrompt(status, 0, message);
    emitSkinChanged();
  }

  function emitSkinChanged() {
    try { host.emit("changed", { what: "skin" }); } catch (_) {}
  }

  // The strip cells are painted by the skin itself; the RAW real-flow reading is the
  // plugin's own regression, so it needs a skin push about once a second while S2/S3 run.
  function startFlowStripTicker() {
    clearTimer("flowStripTimer");
    const tick = () => {
      state.flowStripTimer = null;
      if (state.phase !== "stage2" && state.phase !== "stage3") return;
      emitSkinChanged();
      state.flowStripTimer = setTimeout(tick, 1000);
    };
    state.flowStripTimer = setTimeout(tick, 1000);
  }

  function startSoakCountdown() {
    clearTimer("soakCountdownTimer");
    state.soakPromptStartedAtMs = Date.now();
    const total = Math.max(0, state.cfg.soakSeconds);
    let last = null;
    const tick = () => {
      if (state.phase !== "soak") return;
      const elapsed = (Date.now() - state.soakPromptStartedAtMs) / 1000;
      const remaining = Math.max(0, Math.ceil(total - elapsed));
      state.soakSecondsRemaining = remaining;
      if (remaining !== last) {
        last = remaining;
        emitGhcPrompt("soak", remaining, `SOAK — ${remaining}s remaining`);
        emitSkinChanged();
      }
      if (remaining > 0 && state.phase === "soak") {
        state.soakCountdownTimer = setTimeout(tick, 250);
      }
    };
    tick();
  }

  function pluginHttpJson(request, status, body) {
    return { requestId: request.requestId, status, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
  }

  function pluginHttpHtml(request, status, body) {
    return { requestId: request.requestId, status, headers: { "Content-Type": "text/html; charset=utf-8" }, body };
  }

  function pluginHttpText(request, status, contentType, body, extraHeaders) {
    return { requestId: request.requestId, status, headers: { "Content-Type": contentType, ...(extraHeaders || {}) }, body };
  }

  function uiStatusPayload() {
    return {
      phase: state.phase,
      activeRelease:activeReleaseEnabled(state.cfg),
      liveFlowTrimTest: liveTrimPayload(),
      directStartTest: directStartTestPayload(),
      soakSecondsRemaining: state.soakSecondsRemaining,
      ghcSecondsRemaining: state.ghcSecondsRemaining,
      armRequestCount: state.armRequestCount,
      cumulativeWeight: Math.round(state.cumulativeWeight * 100) / 100,
      stage2Flow: state.cfg ? state.cfg.stage2Flow : 5,
      diagnosticAvailable: !!state.diagnosticLast,
      diagnosticSummary: diagnosticSummary(state.diagnosticLast),
      calibrationActive: state.calibrationActive,
      calibration: calibrationStatusPayload(),
      commandFlows: commandFlowSummary()
    };
  }

  function stripRealFlowText() {
    const gs = Number(state.liveTrim && state.liveTrim.lastCheckGS);
    return Number.isFinite(gs) ? `${gs.toFixed(2)} g/s` : "—";
  }

  function buildSkinSurfaceAnswer() {
    const surfaces = [];
    const live = { endpoint: "changed" };
    if (state.phase === "dumping") {
      surfaces.push({
        id: "hyperex-release-header", kind: "header-button", label: "RELEASING", text: "ACTIVE PRESSURE RELEASE",
        action: { type: "open", view: "ghc", presentation: "overlay", fit: true, closeOnShot: true }
      });
      surfaces.push({
        id: "hyperex-release-strip", kind: "shot-strip", show: "always", cells: [
          { label: "HYPEREX", text: "ACTIVE RELEASE", color: "amber", col: 1, span: 4 },
          { label: "STATUS", text: "WAITING FOR SETTLE", color: "accent", col: 5, span: 5 }
        ]
      });
    } else if (state.phase === "soak") {
      const sec = Math.max(0, state.soakSecondsRemaining);
      surfaces.push({
        id: "hyperex-soak-header", kind: "header-button", label: `SOAK ${sec}s`, text: "WAIT — PINK LIGHT AFTER 0",
        action: { type: "open", view: "ghc", presentation: "overlay", fit: true, closeOnShot: true }
      });
      surfaces.push({
        id: "hyperex-soak-strip", kind: "shot-strip", show: "always", cells: [
          { label: "SOAK", text: `${sec} s`, color: sec <= 5 ? "amber" : "accent", col: 1, span: 2 },
          { label: "STATUS", text: "ACTIVE RELEASE COMPLETE", color: "accent", col: 3, span: 4 },
          { label: "NEXT", text: "WAIT FOR PINK", color: "flow", col: 7, span: 3 }
        ]
      });

    } else if (state.phase === "restart_wait") {
      const sec = Math.max(0, state.ghcSecondsRemaining);
      const sinceArm = state.lastArmRequestAtMs ? (Date.now() - state.lastArmRequestAtMs) / 1000 : 999;
      const waitingPink = sinceArm < 2.5;
      surfaces.push({
        id: "hyperex-ghc-header", kind: "header-button",
        label: waitingPink ? `ARMING ${sec}s` : "RE-ARM",
        text: waitingPink ? "WAIT FOR PINK LIGHT" : `PINK OFF? TAP HERE · ${sec}s`,
        action: { type: "open", view: waitingPink ? "ghc" : "rearm", presentation: "overlay", fit: true, closeOnShot: true }
      });
      surfaces.push({
        id: "hyperex-ghc-strip", kind: "shot-strip", show: "always", cells: waitingPink ? [
          { label: "HYPEREX", text: "WAIT FOR PINK", color: "amber", col: 1, span: 5 },
          { label: "TIME", text: `${sec} s`, color: sec <= 5 ? "red" : sec <= 10 ? "amber" : "accent", col: 6, span: 2 },
          { label: "NEXT", text: "PRESS GHC", color: "flow", col: 8, span: 2 }
        ] : [
          { label: "PINK ON", text: "PRESS GHC", color: "flow", col: 1, span: 3 },
          { label: "PINK OFF", text: "TAP RE-ARM", color: "accent", col: 4, span: 4 },
          { label: "TIME", text: `${sec} s`, color: sec <= 5 ? "red" : sec <= 10 ? "amber" : "accent", col: 8, span: 2 }
        ]
      });
    } else if (state.phase === "stage2" || state.phase === "stage3") {
      surfaces.push({
        id: "hyperex-flow-strip", kind: "shot-strip", show: "always", cells: [
          { label: "REAL", text: stripRealFlowText(), color: "weight", col: 1, span: 3 },
          { cell: "weightFlow", color: "weight", col: 4, span: 3 },
          { cell: "flow", color: "flow", col: 7, span: 3 }
        ]
      });
    } else if (state.calibrationActive) {
      surfaces.push({
        id: "hyperex-cal-header", kind: "header-button", label: "FLOW CAL", text: "EMPTY BASKET · RUNNING",
        action: { type: "open", view: "diag-dashboard", presentation: "page" }
      });
    } else if (state.phase === "idle" && state.cfg && state.cfg.diagnosticEnabled && state.cfg.idleDashboardShortcut) {
      const ds = diagnosticSummary(state.diagnosticLast);
      const r2 = ds && ds.kind === "hyperex" && ds.stage2 && ds.stage2.rawRegressionGS !== null ? `S2 ${ds.stage2.rawRegressionGS}g/s` : (state.calibrationMapUsable ? "CAL READY" : "FLOW CAL / DIAG");
      surfaces.push({
        id: "hyperex-diag-header", kind: "header-button",
        label: state.learningStage && state.learningStage.stage === "READY FOR COFFEE · AUTO" ? "READY · ADD COFFEE" : "DIAG / CAL",
        text: (activeReleaseEnabled(state.cfg)?"Active release":"Continuous extraction")+" · "+(state.learningStage && state.learningStage.stage === "READY FOR COFFEE · AUTO" ? "EMPTY BASELINE COMPLETE" : r2),
        action: { type: "open", view: "diag-dashboard", presentation: "page" }
      });
    }
    for(const surface of surfaces){for(const key of ["label","text"])if(typeof surface[key]==="string")surface[key]=translateUiText(surface[key],state.uiLanguage);for(const cell of surface.cells||[])for(const key of ["label","text"])if(typeof cell[key]==="string")cell[key]=translateUiText(cell[key],state.uiLanguage);}
    return { version: 1, surfaces, live };
  }

  function buildGhcOverlayHtml() {
    const endpointBase = `/api/v1/plugins/${ID}`;
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
html,body{margin:0;width:100%;min-height:100%;background:transparent;font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;color:#f3f0ea;font-synthesis:none;text-rendering:optimizeLegibility;overflow-x:hidden}
.card{width:860px;max-width:96vw;box-sizing:border-box;padding:24px;border-radius:24px;background:linear-gradient(145deg,rgba(62,54,50,.97),rgba(36,31,29,.97));outline:1px solid rgba(255,255,255,.08);outline-offset:-1px;box-shadow:0 24px 70px rgba(0,0,0,.5)}
html.diagview,body.diagview{background:radial-gradient(circle at 14% 6%,#241f1c 0,#171514 40%,transparent 66%),linear-gradient(126deg,#1b1918 32%,#4a3d34 100%);background-attachment:fixed;min-width:100%;min-height:100vh}
body.diagview .card{width:100vw;max-width:none;min-height:100vh;border-radius:0;box-shadow:none;background:transparent;outline:0;padding:26px 34px 40px}
body.diagview .chart{height:250px}
body.diagview textarea{height:190px}
.k{font-size:12px;line-height:16px;font-weight:600;letter-spacing:.16em;color:#a89f94;opacity:1}
.t{font-size:28px;line-height:1.25;font-weight:600;letter-spacing:-.01em;margin:8px 0;color:#f6f3ee}
.d{font-size:15px;line-height:1.55;color:#cfc8bd}
.row{display:flex;gap:10px;margin-top:14px;flex-wrap:wrap;align-items:center}
.b{display:inline-flex;align-items:center;justify-content:center;gap:7px;border:1px solid transparent;border-radius:999px;padding:11px 18px;font-size:14px;line-height:18px;font-weight:600;letter-spacing:.01em;color:#ece7e0;background:rgba(105,101,98,.3);cursor:pointer;transition:background-color .18s ease,border-color .18s ease,color .18s ease,transform .18s ease;-webkit-tap-highlight-color:transparent}
.b:hover{background:rgba(124,118,113,.44)}
.b:active{transform:scale(.97)}
.b:focus-visible{outline:2px solid #53d68e;outline-offset:3px}
.p{background:#efad56;color:#241a10}
.p:hover{background:#f4bd74}
.s{background:rgba(105,101,98,.3);color:#ece7e0}
.warn{background:rgba(216,184,77,.14);border-color:rgba(216,184,77,.38);color:#f0d793}
.danger{background:rgba(222,97,97,.14);border-color:rgba(222,97,97,.36);color:#f49393}
.primaryAction{background:#efad56;color:#241a10;padding:14px 24px;font-size:15px;font-weight:700;box-shadow:0 10px 26px rgba(239,173,86,.16)}
.primaryAction:hover{background:#f4bd74}
.secondaryAction{background:rgba(105,101,98,.32);color:#ece7e0;border:1px solid rgba(255,255,255,.1);padding:11px 16px;font-size:13px}
.tertiaryAction{background:transparent;color:#c9c2b8;border:1px solid rgba(255,255,255,.16);padding:11px 16px;font-size:13px}
.tertiaryAction:hover{background:rgba(255,255,255,.06)}
.actionBadge{display:inline-block;margin-left:8px;padding:4px 9px;border-radius:999px;background:rgba(239,173,86,.16);color:#f0bd7f;font-size:9px;font-weight:700;letter-spacing:.1em;vertical-align:middle}
.manualPanel{margin-top:12px;padding:14px 16px;border-radius:18px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.08)}
.manualPanel>summary{cursor:pointer;font-weight:600}
.active{outline:2px solid #efad56;outline-offset:2px}
.m{margin-top:12px;font:12px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;color:#c3bcb2;opacity:1}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:14px 0}
.stat{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:16px;padding:12px 14px}
.stat b{display:block;margin-top:6px;font-size:20px;line-height:1.2;font-weight:300;letter-spacing:-.01em;color:#f6f3ee}
.small{font-size:11.5px;line-height:1.5;color:#9a9287;opacity:1}
.section{margin-top:18px;padding-top:16px;border-top:1px solid rgba(255,255,255,.075)}
.section h3{margin:0 0 10px;font-size:17px;line-height:1.3;font-weight:600;letter-spacing:-.01em;color:#f6f3ee}
.good{color:#53d68e}
.bad{color:#f49090}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
textarea{width:100%;height:150px;box-sizing:border-box;background:rgba(0,0,0,.32);color:#d6d0c6;border:1px solid rgba(255,255,255,.09);border-radius:16px;padding:12px 14px;font:11px/1.6 ui-monospace,monospace;resize:vertical}
textarea:focus-visible{outline:2px solid rgba(239,173,86,.6);outline-offset:1px}
table{width:100%;border-collapse:collapse;font-size:12px}
th,td{text-align:right;padding:8px;border-bottom:1px solid rgba(255,255,255,.06)}
th{color:#9a9287;font-weight:600}
th:first-child,td:first-child{text-align:left}
.chart{width:100%;height:205px;background:rgba(0,0,0,.26);border:1px solid rgba(255,255,255,.07);border-radius:18px;margin-top:10px}
.legend{font-size:11.5px;line-height:1.6;color:#a89f94}
.stepHead{margin-top:20px;padding:15px 18px;border-radius:18px;background:linear-gradient(145deg,rgba(255,255,255,.055),rgba(255,255,255,.02));border:1px solid rgba(255,255,255,.08)}
.stepHead b{font-size:19px;font-weight:600;letter-spacing:-.01em;color:#f6f3ee}
.stepBadge{float:right;padding:5px 10px;border-radius:999px;background:rgba(255,255,255,.08);color:#d8d2c9;font-size:10px;font-weight:700;letter-spacing:.08em}
.stepBadge.good{background:rgba(83,214,142,.16);color:#7ee6ac}
.stepBadge.bad{background:rgba(222,97,97,.18);color:#f49090}
.stepHint{margin-top:6px;font-size:12.5px;line-height:1.55;color:#a89f94}
summary{outline:none}
summary:focus-visible{outline:2px solid rgba(239,173,86,.55);outline-offset:3px;border-radius:12px}
select,input[type="number"],input[type="text"]{font-family:inherit;color:#ece7e0;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:7px 10px;font-size:13px}
</style></head><body><div class="card"><div class="row" style="justify-content:space-between;align-items:center;gap:10px;margin:0 0 10px"><div class="row" style="gap:9px;flex:none"><button id="close-top" class="b s" type="button">CLOSE / HOME</button><button id="jump-weight" class="b s" type="button">REAL SCALE CURVES</button></div><div id="hx-language" data-no-i18n class="row" style="justify-content:flex-end;margin:0;gap:9px"><button class="b s" data-language="zh" lang="zh-CN" aria-pressed="true">中文</button><button class="b s" data-language="en" lang="en" aria-pressed="false">English</button><span id="hx-language-status" style="align-self:center" aria-live="polite"></span></div></div><div class="k">HYPEREX v${PLUGIN_VERSION}</div><div id="brewingmode" class="m" role="status" style="margin:10px 0 14px;padding:12px 16px;border:1px solid rgba(239,173,86,.42);border-radius:16px;background:rgba(239,173,86,.10);font-weight:600;letter-spacing:.02em">${activeReleaseEnabled(state.cfg)?"Active release: ON · Release / soak / restart":"Active release: OFF · Continuous S1 → S2 → S3"}</div><div id="title" class="t">Checking…</div><div id="detail" class="d"></div>
<div id="diag" style="display:none">
  <div class="d" style="margin:2px 0 14px;padding:12px 14px;border-radius:16px;background:rgba(255,255,255,.04)"><b>ENTRY</b> · Dashboard <b>DIAG / CAL</b> is enabled by default. If another plugin occupies the reserved header slot, open <b>Plugins → HyperEx Pulse Filter</b>.</div>

  <details class="manualPanel"><summary class="stepHead"><span id="step1badge" class="stepBadge">CHECKING</span><b>STEP 1 · FLOW CALIBRATION</b></summary><div class="stepHint">First-time setup. Use an <b>EMPTY BASKET</b> and a large catch vessel. A valid RAW-scale calibration creates the real-flow LUT used by HyperEx. Invalid calibration never overwrites the previous valid LUT.</div>
  <div class="section"><h3>CALIBRATION LUT</h3><div id="calstatus" class="d"></div><div id="calmode" class="row"></div><div id="waterwarn" class="d" style="margin-top:12px;padding:12px 14px;border-radius:16px;background:rgba(216,184,77,.12);color:#f0d793"><b>WATER / VESSEL / TANK PREFLIGHT</b><br>Waiting for live DE1 tank level…</div><div id="scope" class="row"></div><div class="row"><button id="prepare" class="b p">PREPARE FLOW CAL</button><button id="sync" class="b s">SYNC HYPEREX</button><button id="suggested" class="b s">USE SUGGESTED FOR NEXT CAL</button><button id="importlut" class="b s">IMPORT LUT JSON</button><input id="importlutfile" type="file" accept=".json,application/json" style="display:none"></div><div class="row"><button id="global" class="b danger">APPLY SUGGESTED GLOBALLY</button><button id="restore" class="b warn">RESTORE PREVIOUS GLOBAL</button><button id="clearcal" class="b s">CLEAR CAL MAP</button></div><div id="map" class="m"></div><div id="lutimportstatus" class="small"></div></div></details>

  <div class="stepHead"><span id="step2badge" class="stepBadge">WAITING</span><b>STEP 2 · SHOT-TO-SHOT AUTO ADAPTIVE</b><div class="stepHint">Normal daily workflow after calibration. Every completed HyperEx shot is measured with RAW scale weight + timestamp regression. S1, S2 and S3 are evaluated separately; verified changes apply only to the <b>next shot</b>. Live flow trim is enabled by default at level 3; its independent switch and diagnostics are below. Shot-to-shot proposals still affect only future shots. No extra skipStep calls.</div></div>
  <div id="historystatus" class="d" style="margin-top:12px;padding:12px 14px;border-radius:16px;background:rgba(255,255,255,.04)"><b>ADAPTIVE HISTORY</b> · checking persistent storage…</div>
  <details class="manualPanel"><summary>Learning history · Exclude / restore shots</summary><div class="small">Exclude known operator mistakes or plugin faults from future learning. Original records, LUT and already-applied settings are retained. Restore removes only your exclusion; automatic fault and stage-quality gates still apply. Legacy records without raw fault evidence cannot be fully audited automatically.</div><div class="row"><label>Shot <select id="historyrun"></select></label><label>Reason <select id="historyreason"><option value="operator-mistake">Operator mistake</option><option value="plugin-fault">Plugin fault</option><option value="scale-or-cup-disturbance">Scale / cup disturbed</option><option value="other">Other</option></select></label></div><div class="row"><button id="historyexclude" class="b secondaryAction">Exclude from learning</button><button id="historyrestore" class="b tertiaryAction">Restore automatic eligibility</button></div><div class="row"><button id="importhistory" class="b s">IMPORT HISTORY JSON</button><input id="importhistoryfile" type="file" accept=".json,application/json" style="display:none"></div><div id="historyimportstatus" class="small"></div><div class="row"><input id="importurl" type="text" autocomplete="off" spellcheck="false" style="flex:1;min-width:240px" aria-label="Import URL"><button id="importurlbtn" class="b s">IMPORT FROM URL</button></div><div id="importurlstatus" class="small"></div><div id="historysavestatus" class="m"></div><div id="learninghistorytable" class="m" style="overflow:auto;max-height:360px"></div></details>
  <details class="manualPanel"><summary>NEXT SHOT · APPLIED PROFILE</summary><div class="section"><div class="small">Actual workflow commands below come from GET /workflow. Real g/s targets and LUT commands remain reference values. VERIFIED also requires successful machine upload acknowledgement.</div><div id="appliedcommands" class="m"></div><div id="auditstatus" class="small"></div><button id="readworkflow" class="b s">READ RAW WORKFLOW</button><details><summary>Raw workflow / adaptive audit JSON</summary><textarea id="auditjson" readonly></textarea></details></div></details>
  <div class="section"><h3>下一杯 · 曲线编辑</h3><div class="small">选择 S1、S2 或 S3 前／中／后控制点，上下拖动或按按钮调整。橙线是下一杯机器流量指令草稿（ml/s），灰虚线是当前设置；杯中实测 g/s 见下方曲线，预览不代表实际出液保证。</div><div class="row"><label><input id="curveshowcurrent" type="checkbox" checked>当前设置</label><label><input id="curveshowdraft" type="checkbox" checked>草稿指令</label><label><input id="curveshape" type="checkbox">S3 三段曲线</label></div><svg id="curveeditorchart" class="chart" viewBox="0 0 800 232" preserveAspectRatio="none" style="height:280px;touch-action:none" aria-label="下一杯机器流量曲线编辑器"></svg><div id="curvepoints" class="row"></div><div class="row"><button id="curvedown" class="b s">↓ 下调一档</button><span id="curveselected" style="align-self:center"></span><label>流量输入 ml/s <input id="curvevalue" type="number" inputmode="decimal" step="0.0001" min="0.10" max="8.00" style="width:125px" aria-label="流量输入 ml/s"></label><span id="curvequantum" class="small" style="align-self:center"></span><button id="curveup" class="b s">↑ 上调一档</button></div><div class="small">一档 = 1/16 ml/s。原有 S3 前≤中≤后及相邻增幅限制保持；到边界时停止调整。</div><div id="curvetimes" class="row"></div><details class="manualPanel" id="refill-settings"><summary>S2 early refill</summary><div id="curverefill" class="m"></div></details><div id="curveparams" class="m"></div><div class="row"><button id="curveapply" class="b primaryAction" disabled>应用到下一杯</button><button id="curvereset" class="b tertiaryAction">重新载入当前曲线</button></div><div id="curvestatus" class="m" aria-live="polite">正在读取当前曲线…</div></div>
  <details class="manualPanel"><summary>LATEST SHOT · COMMAND SNAPSHOT</summary><div class="section"><div class="small">Historical command snapshot captured at shot start. It may differ from NEXT SHOT after adaptation.</div><div id="runcommands" class="m"></div></div></details>
  <div class="section"><h3>LATEST SHOT · VALIDATION</h3><div class="small">RAW real flow is a multi-second linear regression of unmodified scale weight vs scale timestamp. Instantaneous RAW dW/dt is not the acceptance reference.</div><div id="livetrimstatus" class="m"></div><div id="validation" class="grid"></div><div id="validationtable" class="m"></div><div id="learningintegrity" class="manualPanel"></div><div id="nextdecision" class="manualPanel"></div></div>
  <div class="section"><h3>S1 STARTUP / S3 STABILITY</h3><div class="small">S1 separates first-rise delay from active cup flow. S3 tracks EARLY / MID / LATE stability and stall/decay behavior.</div><div id="stability" class="m"></div></div>
  <div class="section"><h3>NEXT SHOT ADAPTIVE <span class="actionBadge">AUTOMATIC PATH</span></h3><div id="basketcontext" class="m"></div><div id="autoapplybox" class="m"></div><div class="small">S1 startup, S2 level and S3 LEVEL + SHAPE use repeated completed-shot evidence and bounded corrections. Calibration LUT is never rewritten by adaptive history.</div><div id="adaptive" class="m"></div></div>
  <div class="section"><h3>LIVE / END-OF-RUN TELEMETRY</h3><div id="stats" class="grid"></div></div>
  <div class="section" id="weight-curves"><h3>REAL SCALE CURVES</h3><div class="small">萃取图在停止萃取处结束；泄压浸泡间隔按实际时长补零，仅为显示示意，原始记录仍可导出。</div><div class="legend">Machine target / machine flow: ml/s. Cup target / Decaid weightFlow / RAW-scale slope: g/s. Weight chart is the unmodified scale weight stream.<br>LIVE TEST: green circles = check RAW g/s; gray circles on baseline = check without usable regression; orange ↑/↓ = write vector drawn on the previous-check → this-write trend line (arrow up/down = command increase/decrease in absolute terms; divergence from the target line is shown as-is, length = step amplitude ml/s); the vector angle is that trend line vs the target line (0° = trend lying on the target); ↻ = fresh vector on an unresponsive trend; pale blue = smoothed trend trajectory (check → write points joined); pale squares = machine target/trend response ml/s. Tap/hover markers for details.</div><div id="flowseries" class="row"></div><svg id="flowchart" class="chart" viewBox="0 0 800 205" preserveAspectRatio="none"></svg><div class="small">CONTROL LAW CURVE: the angle between the check-to-check trend line (previous check → current regression) and the target line; 0° = trend lies on the target, 90° = parallel offset, above 90° = diverging.</div><svg id="anglechart" class="chart" viewBox="0 0 800 205" preserveAspectRatio="none"></svg><div id="flowpointdetail" class="small"></div><svg id="weightchart" class="chart" viewBox="0 0 800 205" preserveAspectRatio="none"></svg></div>

  <div class="stepHead"><span class="stepBadge">OPTIONAL</span><b>STEP 3 · MANUAL / ENGINEERING</b><div class="stepHint">可选的精确数值和工程设置。日常可在 STEP 2 直接编辑下一杯曲线；AUTO APPLY 保持开启时，新杯完成后继续学习。</div></div>
  <div class="section"><h3>REFERENCE ADVISORY · NO RUNNING-SHOT CONTROL</h3><div class="small">Manual reference ranges derived from the latest shot. These are not LUT rewrites.</div><div id="advisory" class="m"></div></div>
  <div class="section"><h3>ADVANCED / TEST OVERRIDE EDITOR</h3><div class="manualPanel"><div class="small"><b>EDITOR ONLY.</b> ORIGINAL / LUT is the calibration baseline. ADAPTIVE is learned by the plugin. MANUAL is explicitly edited by the user. S3 shape advances by profile time only.</div><details><summary>精确数值编辑（可选）</summary><div id="testcommands" class="m"></div><div id="s3shape" class="m" style="margin-top:10px"></div><div class="row"><button id="applytest" class="b secondaryAction">APPLY TEST COMMANDS</button><button id="returnlut" class="b tertiaryAction">RETURN ALL TO LUT</button></div></details></div></div>
  <div class="section"><details id="advancedsettings" class="manualPanel"><summary style="cursor:pointer;font-weight:600;font-size:16px">ADVANCED SETTINGS · QUICK EDIT</summary><div class="small" style="margin-top:8px">Same source of truth as <b>Plugins → HyperEx Pulse Filter</b>. Saving here writes normal plugin Settings; there is no second settings store.</div><div style="margin:14px 0;padding:16px 18px;border:1px solid rgba(239,173,86,.38);border-radius:18px;background:rgba(239,173,86,.06)"><label style="font-size:19px;font-weight:600"><input id="adv_activeRelease" type="checkbox" ${activeReleaseEnabled(state.cfg)?"checked":""} style="width:24px;height:24px;vertical-align:middle;accent-color:#efad56"> Active pressure release</label><div class="small">ON: release, soak and GHC restart. OFF: one continuous S1 → S2 → S3 extraction. Learning and command overrides are separate for each mode. Change only while idle.</div></div><div class="m" style="padding:14px 16px;border:1px solid rgba(120,179,230,.35);border-radius:18px;background:rgba(120,179,230,.06)"><b>Shot-to-shot learning strength</b><br><select id="adv_adaptiveLearningLevel" style="font-size:18px"><option value="保守">保守</option><option value="温和">温和</option><option value="正常" selected>正常</option><option value="激进">激进</option></select><div class="small">Normal: one clean shot can adjust the next. Different historical responses damp the step instead of blocking it. Live-trim level is a separate setting.</div></div><div id="advancedmeta" class="m"></div><div class="m"><b>REAL-FLOW TARGETS</b></div><table><tr><th>Parameter</th><th>Value</th><th>Parameter</th><th>Value</th></tr><tr><td>S1 target (g/s)</td><td><input id="adv_stage1Flow" type="number" step="0.1" min="0.3" max="6.5"></td><td>S2 target (g/s)</td><td><input id="adv_stage2Flow" type="number" step="0.1" min="0.3" max="6.5"></td></tr><tr><td>S3 target (g/s)</td><td><input id="adv_stage3Flow" type="number" step="0.1" min="0.3" max="6.5"></td><td></td><td></td></tr></table><div class="m"><b>TEMPERATURE / PRESSURE SAFETY</b></div><table><tr><td>Temperature (°C)</td><td><output id="adv_temperature">—</output><div class="small">当前曲线温度 · 在首页调整</div></td><td>Emergency pressure (bar)</td><td><input id="adv_hardPressureLimit" type="number" step="0.1" min="1" max="12"></td></tr><tr><td>S1 pressure limiter (bar)</td><td><input id="adv_stage1PressureLimit" type="number" step="0.1" min="0.5" max="12"></td><td>S2 pressure limiter (bar)</td><td><input id="adv_stage2PressureLimit" type="number" step="0.1" min="0.5" max="12"></td></tr><tr><td>S3 pressure limiter (bar)</td><td><input id="adv_stage3PressureLimit" type="number" step="0.1" min="0.5" max="12"></td><td></td><td></td></tr></table><div class="m"><b>EXPERIMENTAL S2/S3 LIVE FLOW TRIM · DEFAULT ON / LEVEL 3</b><br><label><input id="adv_liveFlowTrimTest" type="checkbox" checked> Enable live flow trim</label><br><label>Level <input id="adv_liveFlowTrimLevel" type="range" min="1" max="4" step="1" value="3" aria-label="杯内调流档位" style="width:260px;max-width:90%;vertical-align:middle;accent-color:#53d68e"><output id="adv_liveFlowTrimLevelLabel" for="adv_liveFlowTrimLevel">三档 · 250 ms / 最多200次写入</output></label><br>All levels: max 2000 checks per shot; continuous mode also includes S1. Write budget is separate and shown by level; retries count as writes. ACK + matching target releases waiting after at least50ms; new writes occur only at level checks with fresh scale data. Missing responses retain the2s fault timeout. After 3 consecutive ACK-without-target misses, continue checks with recoverable same-target retries spaced at least3s apart. Unconfirmed targets retry without accumulating commands. Level 1 defaults to 944 ms. Level 4 is an experimental software cap, not a proven hardware maximum. Target band ±2% (native quantization and response dynamics may prevent reaching it); bounded raw A010 changes, no extra skips. Normal shot-to-shot learning remains ON; confirmed target windows are pooled and normalized to the starting seed with a labelled local response model. Original profile restored afterwards.</div><div class="m"><b>DIRECT DRIVER START TEST · DEFAULT OFF</b><br><label><input id="adv_directDriverStartTest" type="checkbox"> After soak: Espresso request, then raw A002=04 write</label><br>One optional raw write. Original GHC confirmation countdown, re-arm retries and safety guards remain active. Physical GHC confirmation was still required in the 1.54 device test.</div><div class="m"><b>RELEASE / SCALE / RETRY / DIAGNOSTICS</b></div><table><tr><td>Release flow threshold (ml/s)</td><td><input id="adv_dumpFlowThreshold" type="number" step="0.05" min="0" max="2"></td><td>Low-flow stable samples</td><td><input id="adv_dumpFlowStableSamples" type="number" step="1" min="1" max="20"></td></tr><tr><td>Release fallback (s)</td><td><input id="adv_dumpFallbackSeconds" type="number" step="0.1" min="0.2" max="15"></td><td>Release timeout (s)</td><td><input id="adv_dumpTimeoutSeconds" type="number" step="0.1" min="1" max="30"></td></tr><tr><td>Scale tare threshold (g)</td><td><input id="adv_scaleResetThreshold" type="number" step="0.1" min="0.5" max="20"></td><td>No-scale timeout (s)</td><td><input id="adv_noScaleTimeoutSeconds" type="number" step="0.5" min="1" max="30"></td></tr><tr><td>Auto-arm retry 1 (s)</td><td><input id="adv_autoArmRetry1Seconds" type="number" step="0.5" min="0" max="30"></td><td>Auto-arm retry 2 (s)</td><td><input id="adv_autoArmRetry2Seconds" type="number" step="0.5" min="0" max="60"></td></tr><tr><td>Diagnostic sample (ms)</td><td><input id="adv_diagnosticSampleIntervalMs" type="number" step="10" min="50" max="1000"></td><td>Maximum sequence (s)</td><td><input id="adv_maxRunSeconds" type="number" step="10" min="30" max="600"></td></tr></table><div class="row"><button id="saveadvanced" class="b secondaryAction">SAVE TO PLUGIN SETTINGS</button></div><div id="startupbox" class="d" style="margin-top:10px"></div></details></div>

  <div class="stepHead"><span class="stepBadge">EXPORT</span><b>STEP 4 · COPY CSV</b><div class="stepHint">Raw engineering export for offline analysis or bug reports. This is intentionally last because it is not needed for normal brewing.</div></div>
  <div class="section"><h3>LAST RUN CSV</h3><div class="small">Combined DE1/Decaid samples plus RAW scale weight/timestamp/dW-dt and profile-frame markers.</div><textarea id="csv" readonly></textarea></div><div class="section"><h3>HISTORY JSON</h3><div class="small">Up to 30 shots; new shots keep the per-shot trace.</div><div id="historyurl" class="small"></div></div>
</div>
<div class="row"><button id="rearm" class="b p">RE-ARM</button><button id="copy" class="b p" style="display:none">COPY CSV</button><button id="exporthistory" class="b s">EXPORT HISTORY JSON</button><button id="close" class="b s">CLOSE</button></div><div id="meta" class="m"></div></div>
<script>
(function(){
  const translate=(${createUiTranslator.toString()})(${JSON.stringify(UI_LANGUAGE_PAIRS)});
  let language=${JSON.stringify(state.uiLanguage)},persistedRevision=0,saving=false;
  const textSources=new WeakMap(),attributeSources=new WeakMap();
  const bar=document.getElementById('hx-language');
  const excluded=node=>{const element=node.nodeType===1?node:node.parentElement;return !element||!!element.closest('script,style,textarea,input,pre,code,[data-no-i18n]');};
  function translateNode(node){
    if(excluded(node))return;
    const now=node.nodeValue,record=textSources.get(node),source=record&&record.rendered===now?record.source:now;
    const rendered=translate(source,language);if(now!==rendered)node.nodeValue=rendered;
    textSources.set(node,{source,rendered});
  }
  function attributes(element){
    if(excluded(element))return;let saved=attributeSources.get(element);if(!saved){saved={};attributeSources.set(element,saved);}
    for(const key of ['title','aria-label','aria-valuetext','placeholder']){if(!element.hasAttribute(key))continue;const now=element.getAttribute(key),old=saved[key],source=old&&old.rendered===now?old.source:now;const rendered=translate(source,language);if(rendered!==now)element.setAttribute(key,rendered);saved[key]={source,rendered};}
  }
  function visit(root){if(root.nodeType===3){translateNode(root);return;}if(root.nodeType!==1||excluded(root))return;attributes(root);for(const node of [...root.childNodes])visit(node);}
  const observe=()=>observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['title','aria-label','aria-valuetext','placeholder']});
  const observer=new MutationObserver(records=>{observer.disconnect();try{for(const r of records){if(r.type==='characterData')translateNode(r.target);else if(r.type==='attributes')attributes(r.target);else for(const node of r.addedNodes)visit(node);}}finally{observe();}});
  function render(){observer.disconnect();try{document.documentElement.lang=language==='zh'?'zh-CN':'en';visit(document.body);for(const button of bar.querySelectorAll('[data-language]')){const active=button.dataset.language===language;button.setAttribute('aria-pressed',String(active));button.style.background=active?'#efad56':'rgba(255,255,255,.06)';button.style.color=active?'#241a10':'#ece7e0';} }finally{observe();}}
  function setLanguage(next){if(!['zh','en'].includes(next))return;language=next;render();}
  const originalAlert=window.alert.bind(window),originalConfirm=window.confirm.bind(window);
  window.alert=message=>originalAlert(translate(message,language));window.confirm=message=>originalConfirm(translate(message,language));
  window.HXLang={text:value=>translate(value,language),set:setLanguage,get:()=>language};
  for(const button of bar.querySelectorAll('[data-language]'))button.onclick=async()=>{
    const next=button.dataset.language;if(next===language||saving)return;saving=true;for(const item of bar.querySelectorAll("[data-language]"))item.disabled=true;
    const revision=++persistedRevision,previous=language;setLanguage(next);const status=document.getElementById('hx-language-status');status.textContent=next==='zh'?'正在保存…':'Saving…';
    try{const r=await fetch(${JSON.stringify(endpointBase+"/language")},{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({language:next})});const result=await r.json();if(!r.ok||result.language!==next)throw Error(result.error||'Language save failed');if(revision===persistedRevision)status.textContent='';}
    catch(error){if(revision===persistedRevision){setLanguage(previous);status.textContent=previous==='zh'?'语言保存失败，请重试':'Language save failed; try again';}}finally{saving=false;for(const item of bar.querySelectorAll('[data-language]'))item.disabled=false;}
  };
  render();
  fetch(${JSON.stringify(endpointBase+"/language")}).then(r=>r.json()).then(result=>{if(!persistedRevision&&['zh','en'].includes(result.language))setLanguage(result.language);}).catch(()=>{});
})();

</script>
<script>
(function(){
  function emergencyHomeFallback(){
    try{if(window.top&&window.top!==window&&window.top.history&&window.top.history.length>1){window.top.history.back();return}}catch(_){}
    if(window.history&&window.history.length>2){window.history.go(-2);return}
    if(window.history&&window.history.length>1){window.history.back();return}
  }
  function emergencyClose(){
    try{if(window.parent&&window.parent!==window)window.parent.postMessage({type:'streamline:close'},'*')}catch(_){}
    setTimeout(emergencyHomeFallback,280);
  }
  const c=document.getElementById('close');
  if(c){c.textContent='CLOSE / HOME';c.onclick=emergencyClose}
  window.addEventListener('error',function(e){
    const t=document.getElementById('title'),d=document.getElementById('detail');
    if(t)t.textContent='DIAGNOSTICS UI ERROR';
    if(d)d.textContent='The diagnostics script failed to initialize. CLOSE / HOME remains available. '+String((e&&e.message)||'Unknown UI error');
  });
})();
</script>
<script>
const base=${JSON.stringify(endpointBase)};const coreSettings='/api/v1/plugins/'+${JSON.stringify(ID)}+'/settings';const requestedView=new URLSearchParams(location.search).get('view');const view=requestedView||${JSON.stringify(state.phase === 'idle' ? 'diag' : 'ghc')};const dashboardEntry=view==='diag-dashboard';const diagView=view==='diag'||dashboardEntry;if(diagView){document.documentElement.classList.add('diagview');document.body.classList.add('diagview')}window.parent.postMessage({type:'streamline:ready'},'*');const sw=Math.max(1000,Math.min(1800,Number((window.screen&&window.screen.width)||window.innerWidth||1200)));const sh=Math.max(780,Math.min(1400,Number((window.screen&&window.screen.height)||window.innerHeight||900)));window.parent.postMessage({type:'streamline:size',width:diagView?sw:520,height:diagView?sh:300},'*');
let latestAdvisorySummary=null;let latestStage3Stability=null;let latestNextShotAdaptive=null;let latestAdaptiveSummary=null;let latestAutoApplyEnabled=true;let latestAutoApplyStatus=null;const $=id=>document.getElementById(id),t=$('title'),d=$('detail'),m=$('meta'),b=$('rearm'),copy=$('copy'),diag=$('diag'),stats=$('stats'),appliedcommands=$('appliedcommands'),runcommands=$('runcommands'),validation=$('validation'),validationtable=$('validationtable'),stability=$('stability'),adaptive=$('adaptive'),advisory=$('advisory'),testcommands=$('testcommands'),s3shape=$('s3shape'),csv=$('csv'),calstatus=$('calstatus'),waterwarn=$('waterwarn'),scope=$('scope'),calmode=$('calmode'),map=$('map'),startupbox=$('startupbox');
let curveLatest=null,curveDraft=null,curveSelected=1,curveDirty=false,curveBusy=false,curveDrag=null,curveYmax=4,curveInputInvalid=false,latestManualCurveSource=null,lastChartRun=null;
const curveNames=['S1','S2','S3 前段','S3 中段','S3 后段'],curveKeys=['stage1','stage2','early','mid','late'];
const flowSeriesVisible={cup:true,target:true,machine:true,decaid:true,raw:true,trend:true,writes:true};
function curveSame(a,b){return !!a&&!!b&&a.shaped===b.shaped&&JSON.stringify(a.values)===JSON.stringify(b.values)&&JSON.stringify(a.refill)===JSON.stringify(b.refill)}
function curveReset(){if(!curveLatest)return;curveInputInvalid=false;if($('curvevalue'))$('curvevalue').setCustomValidity('');curveDraft=JSON.parse(JSON.stringify(curveLatest));curveDirty=false;renderCurveEditor(curveLatest)}
function curveLimits(i,v){let lo=.10,hi=8;if(curveDraft.shaped&&i>=2){if(i===2){hi=v.mid;lo=Math.max(lo,Math.min(v.mid-.25,v.mid/1.35))}if(i===3){lo=Math.max(v.early,Math.min(v.late-.25,v.late/1.35));hi=Math.min(v.late,Math.max(v.early+.25,v.early*1.35))}if(i===4){lo=v.mid;hi=Math.min(8,Math.max(v.mid+.25,v.mid*1.35))}}return [lo,hi]}
function curveSetValue(value){if(!curveDraft||curveBusy||!Number.isFinite(value))return;const v=curveDraft.values,k=curveKeys[curveSelected],old=v[k];const shapeBefore=curveDraft.shaped;if(curveSelected>=2)curveDraft.shaped=true;const bounds=curveLimits(curveSelected,v);let next=Math.round(value*10000)/10000;next=Math.max(Math.ceil((bounds[0]-1e-9)*10000)/10000,Math.min(Math.floor((bounds[1]+1e-9)*10000)/10000,next));if(bounds[0]>bounds[1]||next<bounds[0]-1e-9||next>bounds[1]+1e-9||(value>old&&next<old)||(value<old&&next>old))next=old;v[k]=next;if(next===old)curveDraft.shaped=shapeBefore;curveDirty=!curveSame(curveDraft,curveLatest);renderCurveEditor(curveLatest)}
function curveEnterValue(raw){
 if(!curveDraft||curveBusy)return;
 const value=Number(raw),input=$('curvevalue'),previousShape=curveDraft.shaped;
 if(curveSelected>=2)curveDraft.shaped=true;
 const bounds=curveLimits(curveSelected,curveDraft.values);curveDraft.shaped=previousShape;
 const rounded=Math.round(value*10000)/10000;
 if(String(raw).trim()===''||!Number.isFinite(value)||value<bounds[0]-1e-9||value>bounds[1]+1e-9||rounded<bounds[0]-1e-9||rounded>bounds[1]+1e-9){
  curveInputInvalid=true;const message='当前控制点允许范围 '+bounds[0].toFixed(3)+'–'+bounds[1].toFixed(3)+' ml/s；请保持S3顺序和相邻增幅。';if(input)input.setCustomValidity(message);if($('curvestatus'))$('curvestatus').textContent=message;if($('curveapply'))$('curveapply').disabled=true;return;
 }
 curveInputInvalid=false;if(input)input.setCustomValidity('');curveSetValue(rounded);
}
function curveNudge(sign){if(!curveDraft||curveBusy)return;const v=curveDraft.values[curveKeys[curveSelected]],candidate=(Math.round(v*16)+sign)/16,oldShape=curveDraft.shaped;if(curveSelected>=2)curveDraft.shaped=true;const bounds=curveLimits(curveSelected,curveDraft.values);curveDraft.shaped=oldShape;if(candidate<bounds[0]-1e-9||candidate>bounds[1]+1e-9)return;curveInputInvalid=false;if($('curvevalue'))$('curvevalue').setCustomValidity('');curveSetValue(candidate)}
function curveTime(key,sign){if(!curveDraft||curveBusy)return;curveDraft.shaped=true;curveDraft.values[key]=Math.max(3,Math.min(30,curveDraft.values[key]+sign));curveDirty=!curveSame(curveDraft,curveLatest);renderCurveEditor(curveLatest)}
function curveShapeToggle(enabled){if(!curveDraft||curveBusy)return;curveDraft.shaped=enabled;if(!enabled){const v=curveDraft.values;v.early=v.late=v.mid}curveDirty=!curveSame(curveDraft,curveLatest);renderCurveEditor(curveLatest)}
const refillControlFields=[['startDelayMs','启动延时','s'],['targetPercent','基础泵流量倍率','%'],['cutoffPercent','称流速收回阈值','%'],['maxDurationMs','最长补水','s'],['approachMs','接管渐进时间','s']];
function curveRefillBasisChange(value){if(!curveDraft||curveBusy)return;const basis=String(value);if(basis!=="pump-command"&&basis!=="cup-target")return;curveDraft.refill.basis=basis;curveDirty=!curveSame(curveDraft,curveLatest);renderCurveEditor(curveLatest)}
function curveRefillChange(key,value){
 if(!curveDraft||curveBusy||!curveLatest.refillLimits||!curveLatest.refillLimits[key])return;
 const limits=curveLatest.refillLimits[key],n=Number(value);if(!Number.isFinite(n))return;
 curveDraft.refill[key]=Math.max(limits[0],Math.min(limits[1],limits[0]+Math.round((n-limits[0])/limits[2])*limits[2]));
 curveDirty=!curveSame(curveDraft,curveLatest);renderCurveEditor(curveLatest);
}
function refillSettingsText(settings,basis){
 if(!settings)return '该记录未保存完整补水参数';
 return (basis==='cup-target'?'目标折算倍率 ':basis==='pump-command'?'基础泵倍率 ':'旧版称流目标倍率 ')+esc(settings.targetPercent)+'% · 启动 '+esc(settings.startDelayMs/1000)+' s · 称流收回 '+esc(settings.cutoffPercent)+'% · 最长 '+esc(settings.maxDurationMs/1000)+' s · 渐进 '+esc(settings.approachMs/1000)+' s';
}
function renderRefillHistory(){
 const box=$('refillprevious');if(!box||!curveLatest)return;const previous=curveLatest.refillPrevious,last=curveLatest.refillLastShot;
 let h='<b>上一次补水参数</b><div class="small">当前滑块是草稿；以下显示已保存的修改记录和上一杯启动快照。</div>';
 h+='<div class="m"><b>当前已保存</b><br>'+refillSettingsText(curveLatest.refill,curveLatest.refill.basis)+'</div>';
 if(previous)h+='<div class="m"><b>上次修改前 → 修改后</b> · '+esc(previous.at)+'<br>'+refillSettingsText(previous.before,previous.before.basis)+'<br>→ '+refillSettingsText(previous.after,previous.after.basis)+'</div>';
 else h+='<div class="m">尚无已保存的补水修改记录</div>';
 if(last&&last.available){h+='<div class="m"><b>上一杯实际采用的参数</b> · '+esc(last.runId)+'<br>'+refillSettingsText(last.settings,last.basis)+'<br>基础指令 '+esc(last.baseCommandMlS==null?'—':last.baseCommandMlS)+' ml/s · 计划增强 '+esc(last.plannedBoostMlS==null?'—':last.plannedBoostMlS)+' ml/s<br>'+(last.executedBoostMlS==null?'该杯未记录增强写入':'已发送增强指令 '+esc(last.executedBoostMlS)+' ml/s')+(last.execution?'<br>'+esc(last.execution.reason||last.execution.status||''):'')+'</div>';}
 else h+='<div class="m">上一杯补水参数尚未记录；不使用当前设置代替历史值。</div>';
 box.innerHTML=h;
}
function renderRefillEditor(){
 const box=$('curverefill');if(!box||!curveDraft||!curveDraft.refill||!curveLatest.refillLimits)return;
 if(!box.querySelector('[data-refill-key]')){
  box.innerHTML='<b>S2 提前补水</b><div class="small">启动延时从确认进入S2后计；滑块只修改草稿；请点击保存补水参数，下一杯生效。</div>'+'<div class="m"><b>补水基准</b><label style="display:block;margin:8px 0 4px"><input type="radio" name="refill-basis" value="pump-command" data-refill-basis> <span>基础泵倍率（按当前 S2 指令）</span></label><label style="display:block;margin:4px 0 8px"><input type="radio" name="refill-basis" value="cup-target" data-refill-basis> <span>目标折算（按设置值 S2 目标）</span></label><div id="refillvalue-basis" class="small" style="margin-top:4px"></div></div>'+refillControlFields.map(x=>{const l=curveLatest.refillLimits[x[0]];return '<label style="display:block;margin:12px 0">'+x[1]+' <b id="refillvalue-'+x[0]+'"></b><input type="range" style="width:100%;min-height:36px" data-refill-key="'+x[0]+'" min="'+l[0]+'" max="'+l[1]+'" step="'+l[2]+'" aria-label="'+x[1]+'"></label>'}).join('')+'<button id="refillsave" class="b">保存补水参数</button><span id="refillsavestatus" class="small"></span><button id="refilldefaults" class="b s">恢复补水默认值</button><div id="refillnote" class="small"></div><svg id="refillpreview" class="chart" viewBox="0 0 760 156" style="height:200px" aria-label="S2补水指令预览"></svg><div id="refillsafety" class="small"></div><div id="refillnodes" class="m"></div><div id="refillprevious" class="manualPanel"></div>';
  box.querySelectorAll('[data-refill-key]').forEach(q=>q.oninput=()=>curveRefillChange(q.dataset.refillKey,q.value));
  box.querySelectorAll('[data-refill-basis]').forEach(q=>q.onchange=()=>curveRefillBasisChange(q.value));
  $('refillsave').onclick=saveRefillDraft;
  $('refilldefaults').onclick=()=>{if(curveBusy)return;curveDraft.refill=JSON.parse(JSON.stringify(curveLatest.refillDefaults));curveDirty=!curveSame(curveDraft,curveLatest);renderCurveEditor(curveLatest)};
 }
 const r=curveDraft.refill,plan=curveLatest.refillPreview||{},baseCommand=Math.round(Number(curveDraft.values.stage2)*16)/16,goal=Number(curveLatest.targetGS.stage2),planEstimate=plan.settings&&plan.settings.basis==="cup-target"?Number(plan.refillPumpBaseMlS):NaN,refillBase=r.basis==="cup-target"&&Number.isFinite(planEstimate)?planEstimate:baseCommand,upper=Math.min(8,refillBase*1.6);
 const request=refillBase*r.targetPercent/100;
 const boost=Math.max(refillBase,Math.floor((Math.min(upper,Math.max(refillBase,request))+1e-9)*16)/16);
 const holding=Math.max(baseCommand,Math.floor((Math.min(boost,baseCommand*1.2,baseCommand*(Number(plan.returnCommandMlS)||Number(plan.baseCommandMlS)||baseCommand)/Math.max(.1,Number(plan.baseCommandMlS)||baseCommand))+1e-9)*16)/16);
 for(const x of refillControlFields){const input=box.querySelector('[data-refill-key="'+x[0]+'"]');input.value=r[x[0]];input.disabled=curveBusy||!curveLatest.canApply;const text=x[2]==='s'?(r[x[0]]/1000).toFixed(2)+' s':r[x[0]]+'%'+(x[0]==='targetPercent'?' · '+boost.toFixed(4)+' ml/s':' · '+(goal*r[x[0]]/100).toFixed(2)+' g/s');$('refillvalue-'+x[0]).textContent=text;}
 box.querySelectorAll('[data-refill-basis]').forEach(q=>{q.checked=r.basis===q.value;q.disabled=curveBusy||!curveLatest.canApply;});
 const planBasis=plan.settings&&plan.settings.basis;
 const cupBase=Number.isFinite(planEstimate)?planEstimate:baseCommand;const pumpBase=baseCommand;const otherBasis=r.basis==="cup-target"?"pump-command":"cup-target";const otherBase=otherBasis==="cup-target"?cupBase:pumpBase;const otherUpper=Math.min(8,otherBase*1.6);const otherBoost=Math.max(otherBase,Math.floor((Math.min(otherUpper,Math.max(otherBase,otherBase*r.targetPercent/100))+1e-9)*16)/16);$('refillvalue-basis').textContent=(r.basis==="cup-target"?("目标折算 · 设置值 S2 "+(goal||"—")+" g/s → 估算基础 "+(Number.isFinite(planEstimate)?planEstimate.toFixed(4):(planBasis==="cup-target"?"无合格实测尾段，用 "+baseCommand.toFixed(4)+" ml/s":"保存后按实测尾段折算"))+" ml/s → 增强 "+boost.toFixed(4)+" ml/s · 另一基准 "+otherBoost.toFixed(4)+" ml/s"):("基础泵倍率 · 当前指令 "+pumpBase.toFixed(4)+" ml/s → 增强 "+boost.toFixed(4)+" ml/s · 目标折算基准 "+(Number.isFinite(planEstimate)?"（可用）"+otherBoost.toFixed(4)+" ml/s":"（保存后可用）")));
 $('refilldefaults').disabled=curveBusy||!curveLatest.canApply;
 $('refillnote').textContent=(curveLatest.refillActive?'补水已启用':'当前不执行补水：需开启主动泄压、杯内控流和S2起步增强')+(curveLatest.refillLoadWarning?' · '+curveLatest.refillLoadWarning:'');
 const horizon=(r.startDelayMs+r.maxDurationMs+r.approachMs)/1000,xx=t=>34+690*t/Math.max(1,horizon),max=Math.max(baseCommand,boost)*1.2,yy=v=>118-80*v/Math.max(.1,max),start=r.startDelayMs/1000,end=start+r.maxDurationMs/1000;
 $('refillpreview').innerHTML='<line x1="34" y1="118" x2="724" y2="118" stroke="#657082"/><path d="M 34 '+yy(baseCommand)+' H '+xx(start)+' V '+yy(boost)+' H '+xx(end)+' V '+yy(holding)+' H 724" fill="none" stroke="#b794ff" stroke-width="3"/><line x1="'+xx(end)+'" y1="25" x2="'+xx(end)+'" y2="122" stroke="#cdb6ff" stroke-dasharray="4 4"/><text x="34" y="18" fill="#ddd" font-size="12">'+boost.toFixed(4)+' ml/s · '+r.targetPercent+'% '+(r.basis==="cup-target"?'目标折算基值':'基础泵流量')+' · 接管 '+holding.toFixed(4)+' ml/s</text><text x="34" y="143" fill="#ddd" font-size="12">0s → '+start.toFixed(2)+'s 启动 → 最迟 '+end.toFixed(2)+'s 请求收回</text><text x="34" y="36" fill="#ddd" font-size="11">达到 '+r.cutoffPercent+'% 称流速可提前收回；图示为最长时限</text>';
 $('refillsafety').textContent='预览为估算；应用后以校验结果为准。机器指令上限 '+(Math.floor(upper*16)/16).toFixed(4)+' ml/s；原限压90%、数据新鲜度和驱动确认保护固定。'+(request>upper?' 已触及指令上限。':'');
 const tl=curveLatest.refillLastShot&&curveLatest.refillLastShot.timeline;
 if($('refillnodes'))$('refillnodes').innerHTML=tl&&tl.onsetMs!=null?('<b>上一杯补水节点</b><br>帧确认 0.00 s · onset '+((tl.relative&&tl.relative.onsetS)==null?'—':tl.relative.onsetS)+' s（S2 起点）'+(tl.cutoffAtMs!=null?' · 杯流 '+esc(r.cutoffPercent)+'% '+((tl.relative&&tl.relative.cutoffS)==null?'—':tl.relative.cutoffS)+' s':'')+(tl.relative&&tl.relative.returnS!=null?' · 收回 '+esc(tl.relative.returnS)+' s':'')+(tl.relative&&tl.relative.completeS!=null?' · 确认 '+esc(tl.relative.completeS)+' s':'')+'<br>'+(tl.overlap?'S2 与补水重叠 '+esc(tl.overlap.seconds)+' s（onset → 收回）':'S2 与补水无重叠')):'';
 renderRefillHistory();
}
function renderCurveEditor(snapshot){
 if(snapshot)curveLatest=snapshot;const svg=$('curveeditorchart'),points=$('curvepoints'),params=$('curveparams'),status=$('curvestatus');if(!svg||!curveLatest)return;
 if(!curveDraft||!curveDirty&&!curveBusy)curveDraft=JSON.parse(JSON.stringify(curveLatest));
 const v=curveDraft.values,ref=curveLatest.values,stale=curveDraft.revision!==curveLatest.revision;
 curveYmax=curveDrag?curveDrag.ymax:Math.max(1,Math.min(8,Math.ceil(Math.max(...curveKeys.map(k=>Math.max(v[k],ref[k])))*1.35*2)/2));
 const y=n=>190-n/curveYmax*154,b=[34,160,350,490,630,770],x=[88,250,420,560,700];
 let h='';for(let n=0;n<=4;n++){const val=curveYmax*n/4,yy=y(val);h+='<line x1="34" y1="'+yy+'" x2="770" y2="'+yy+'" stroke="#303640"/><text x="4" y="'+(yy+4)+'" fill="#aeb6c2" font-size="11">'+val.toFixed(1)+'</text>'}
 for(const sep of [160,350])h+='<line x1="'+sep+'" y1="32" x2="'+sep+'" y2="194" stroke="#717b89" stroke-dasharray="3 5"/>';
 const path=q=>curveKeys.map((k,i)=>(i?' L ':'M ')+b[i]+' '+y(q[k])+' L '+b[i+1]+' '+y(q[k])).join('');
 const showRef=$('curveshowcurrent'),showDraft=$('curveshowdraft');if(!showRef||showRef.checked)h+='<path d="'+path(ref)+'" fill="none" stroke="#939fae" stroke-width="2" stroke-dasharray="6 5"/>';
 if(!showDraft||showDraft.checked)h+='<path d="'+path(v)+'" fill="none" stroke="#ffb25e" stroke-width="3"/>';
 for(let i=0;i<5;i++){const yy=y(v[curveKeys[i]]),selected=i===curveSelected;h+='<g data-curve-point="'+i+'" role="button" tabindex="0" aria-label="'+curveNames[i]+' '+v[curveKeys[i]]+' ml/s"><circle cx="'+x[i]+'" cy="'+yy+'" r="22" fill="transparent"/><circle cx="'+x[i]+'" cy="'+yy+'" r="'+(selected?8:6)+'" fill="'+(selected?'#fff':'#ffb25e')+'" stroke="#ffb25e" stroke-width="2"/><text x="'+x[i]+'" y="'+Math.max(24,yy-14)+'" text-anchor="middle" fill="#fff" font-size="12">'+Number(v[curveKeys[i]]).toFixed(4)+'</text></g>';const label=i<2?curveNames[i]:curveNames[i]+' '+(i===2?'0':i===3?v.earlySeconds:v.earlySeconds+v.midSeconds)+'s';h+='<text x="'+x[i]+'" y="218" text-anchor="middle" fill="#c9cdd3" font-size="12">'+label+'</text>'}
 svg.innerHTML=h;
 points.innerHTML=curveNames.map((name,i)=>'<button class="b '+(i===curveSelected?'p':'s')+'" data-selectpoint="'+i+'" aria-pressed="'+(i===curveSelected)+'">'+name+'</button>').join('');points.querySelectorAll('[data-selectpoint]').forEach(q=>q.onclick=()=>{curveSelected=Number(q.dataset.selectpoint);renderCurveEditor(curveLatest)});
 const selected=$('curveselected');if(selected)selected.textContent=curveNames[curveSelected]+' · '+Number(v[curveKeys[curveSelected]]).toFixed(4)+' ml/s';
 const input=$('curvevalue');if(input){const bounds=curveLimits(curveSelected,v);input.min=bounds[0];input.max=bounds[1];input.disabled=curveBusy||!curveLatest.canApply;if(document.activeElement!==input||input.dataset.point!==String(curveSelected))input.value=Number(v[curveKeys[curveSelected]]).toFixed(4);input.dataset.point=String(curveSelected);}
 const quantum=$('curvequantum');if(quantum)quantum.textContent='对应驱动档位 ≈ '+(Math.round(v[curveKeys[curveSelected]]*16)/16).toFixed(4)+' ml/s';
 const shape=$('curveshape');if(shape)shape.checked=curveDraft.shaped;
 const times=$('curvetimes');if(times)times.innerHTML='<span>S3 前段 '+v.earlySeconds+'s</span> <button class="b s" data-time="earlySeconds" data-sign="-1">−1s</button><button class="b s" data-time="earlySeconds" data-sign="1">+1s</button><span>中段 '+v.midSeconds+'s</span><button class="b s" data-time="midSeconds" data-sign="-1">−1s</button><button class="b s" data-time="midSeconds" data-sign="1">+1s</button>';if(times)times.querySelectorAll('[data-time]').forEach(q=>q.onclick=()=>curveTime(q.dataset.time,Number(q.dataset.sign)));
 renderRefillEditor();
 params.innerHTML='<table><tr><th>生成参数</th><th>当前</th><th>草稿 ml/s</th></tr>'+curveKeys.map((k,i)=>'<tr><td>'+curveNames[i]+'</td><td>'+Number(ref[k]).toFixed(4)+'</td><td><b>'+Number(v[k]).toFixed(4)+'</b></td></tr>').join('')+'</table><div class="small">S3 '+(curveDraft.shaped?'前 '+v.earlySeconds+'s → 中 '+v.midSeconds+'s → 后段至结束':'平直')+'；S1、S2仍按累计重量转换，泄压和浸泡在示意图中省略。</div>';
 const save=$('refillsave');if(save)save.disabled=curveBusy||stale||!curveLatest.canApply||JSON.stringify(curveDraft.refill)===JSON.stringify(curveLatest.refill);
 const apply=$('curveapply');if(apply)apply.disabled=curveInputInvalid||curveBusy||!curveDirty||stale||!curveLatest.canApply;
 status.textContent=curveBusy?'正在校验并应用到下一杯…':stale?'当前参数已更新；草稿已保留，请先重新载入当前曲线再编辑。':curveDirty?'草稿未应用 · 点击“应用到下一杯”后生效。':curveLatest.source?'手动曲线已应用到下一杯；新杯完成后继续自动学习。':'点选控制点后上下拖动，或点击上调／下调。';
 if(!curveBusy&&!curveLatest.canApply)status.textContent+=' 当前运行中或曲线未校验，只能预览。';
}
async function saveRefillDraft(){
 if(!curveDraft||curveBusy)return;const refill=JSON.parse(JSON.stringify(curveDraft.refill)),revision=curveDraft.revision;
 curveBusy=true;renderCurveEditor(curveLatest);
 try{const r=await post('refill-settings-save',{refill,revision});if(!r.saved)throw Error('未确认保存');
 curveBusy=false;curveDraft.refill=JSON.parse(JSON.stringify(r.curveEditor.refill));curveDraft.revision=r.curveEditor.revision;
 curveDirty=!curveSame(curveDraft,r.curveEditor);renderCurveEditor(r.curveEditor);$('refillsavestatus').textContent='补水参数已保存，下一杯生效';
 }catch(e){curveBusy=false;renderCurveEditor(curveLatest);$('refillsavestatus').textContent='未保存：'+String(e.message||e);}
}
async function applyCurveDraft(){if(!curveDraft||curveBusy||curveInputInvalid||!curveDirty)return;let applied=false;const payload={revision:curveDraft.revision,values:JSON.parse(JSON.stringify(curveDraft.values)),shaped:curveDraft.shaped,refill:JSON.parse(JSON.stringify(curveDraft.refill))};curveBusy=true;renderCurveEditor(curveLatest);try{const r=await post('curve-edit-apply',payload);if(r.verified!==true||!r.profileTruth||r.profileTruth.verified!==true)throw Error('下一杯曲线未校验');applied=true;curveBusy=false;curveDirty=false;curveDraft=null;latestManualCurveSource=r.commandFlows&&r.commandFlows.manualCurveSource||null;renderCurveEditor(r.curveEditor);await loadDiag()}catch(e){curveBusy=false;renderCurveEditor(curveLatest);$('curvestatus').textContent=applied?'已校验应用到下一杯，但界面刷新失败，请重新打开诊断页：'+String(e.message||e):'未应用：'+String(e.message||e)+'。草稿已保留。'}}
const curveSvg=$('curveeditorchart');if(curveSvg){curveSvg.onpointerdown=e=>{if(curveBusy)return;const q=e.target.closest&&e.target.closest('[data-curve-point]');if(!q)return;e.preventDefault();curveSelected=Number(q.dataset.curvePoint);curveDrag={id:e.pointerId,ymax:curveYmax};curveSvg.setPointerCapture(e.pointerId);renderCurveEditor(curveLatest)};curveSvg.onpointermove=e=>{if(!curveDrag||curveDrag.id!==e.pointerId)return;e.preventDefault();const r=curveSvg.getBoundingClientRect(),yy=(e.clientY-r.top)/r.height*232;curveSetValue((190-yy)/154*curveDrag.ymax)};const end=e=>{if(curveDrag&&curveDrag.id===e.pointerId){curveDrag=null;if(curveSvg.hasPointerCapture(e.pointerId))curveSvg.releasePointerCapture(e.pointerId)}};curveSvg.onpointerup=end;curveSvg.onpointercancel=end;curveSvg.onkeydown=e=>{const q=e.target.closest&&e.target.closest('[data-curve-point]');if(q)curveSelected=Number(q.dataset.curvePoint);if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();curveNudge(e.key==='ArrowUp'?1:-1)}};}
const curveInput=$('curvevalue');if(curveInput){curveInput.onchange=()=>curveEnterValue(curveInput.value);curveInput.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();curveEnterValue(curveInput.value)}};}
if($('curveup'))$('curveup').onclick=()=>curveNudge(1);if($('curvedown'))$('curvedown').onclick=()=>curveNudge(-1);if($('curvereset'))$('curvereset').onclick=curveReset;if($('curveapply'))$('curveapply').onclick=applyCurveDraft;if($('curveshape'))$('curveshape').onchange=e=>curveShapeToggle(e.target.checked);for(const id of ['curveshowcurrent','curveshowdraft'])if($(id))$(id).onchange=()=>renderCurveEditor(curveLatest);
const flowOptions=$('flowseries');if(flowOptions){flowOptions.innerHTML=[['cup','杯中目标 g/s'],['raw','RAW杯流 g/s'],['trend','趋势轨迹 g/s'],['decaid','Decaid杯流 g/s'],['target','机器目标 ml/s'],['machine','机器实际 ml/s'],['writes','写入指令 ml/s']].map(x=>'<label style="margin-right:12px"><input type="checkbox" checked data-flowseries="'+x[0]+'">'+x[1]+'</label>').join('');flowOptions.querySelectorAll('[data-flowseries]').forEach(q=>q.onchange=()=>{flowSeriesVisible[q.dataset.flowseries]=q.checked;if(lastChartRun)renderCharts(lastChartRun)})}

let learningHistoryData=null,historyReviewBusy=false,historyReviewError=null;
function renderLearningHistory(data){
 const table=$('learninghistorytable'),select=$('historyrun'),status=$('historysavestatus');if(!table||!select||!data)return;learningHistoryData=data;
 const selected=select.value,records=data.records||[];
 select.innerHTML=records.map(x=>'<option value="'+esc(x.runId).replace(/"/g,'&quot;')+'">'+esc(x.startedAt||x.runId)+' · v'+esc(x.version||'—')+' · '+esc(x.runId)+'</option>').join('');
 if(records.some(x=>x.runId===selected))select.value=selected;
 table.innerHTML='<table><tr><th>Shot / time</th><th>Learning status</th><th>Stage evidence</th><th>Reason</th></tr>'+records.map(x=>'<tr><td>'+esc(x.runId)+'<br>'+esc(x.startedAt||'')+' · v'+esc(x.version||'—')+'<br>'+esc(x.activeRelease===false?'Continuous extraction':'Active release')+'</td><td>'+esc(x.integrity.status)+'</td><td>'+['s1','s2','s3'].filter(k=>x.stageEvidence[k]).map(x=>x.toUpperCase()).join(' / ')+'</td><td>'+esc((x.integrity.reasons||[]).join(' · ')||'No confirmed fault')+'</td></tr>').join('')+'</table>';
 const audit=data.s3CommandAudit||{},timeline=(audit.events||[]).slice().reverse(),first=audit.earliestRetainedFlat;
 const auditHtml='<div class="m"><b>S3 command timeline</b><br>'+esc(first?'Earliest retained flat evidence: '+(first.at||first.runId)+' · '+first.values.join(' → ')+' ml/s':'No verified flat command in retained history')+'<br><span class="small">'+esc(audit.note||'')+'</span><table><tr><th>Shot / time</th><th>Source</th><th>S3 commands ml/s</th><th>Origin / shape</th></tr>'+timeline.map(x=>'<tr><td>'+esc(x.runId)+'<br>'+esc(x.at||'')+' · v'+esc(x.version||'—')+'</td><td>'+esc(x.kind==='applied'?'Verified next-shot application':'Shot-start snapshot')+'</td><td>'+esc(x.values.join(' → '))+'</td><td>'+esc(x.origin)+' · '+esc(x.flat?'FLAT':'SHAPE')+(x.timedShape?' · 3 timed frames':'')+(x.verified?'':' · unverified')+(x.learningExcluded?' · Excluded from learning':'')+'</td></tr>').join('')+'</table></div>';
 table.innerHTML=auditHtml+table.innerHTML;
 for(const id of ['historyexclude','historyrestore'])if($(id))$(id).disabled=historyReviewBusy||!data.editable||!records.length;
 status.textContent=historyReviewError|| (data.savePending?'History save awaiting readback verification':data.editable?'History storage verified':'History is read-only until idle and storage is verified');
}
async function reviewHistory(excluded){
 if(historyReviewBusy||!learningHistoryData)return;const id=$('historyrun').value,reason=$('historyreason').value;if(!id)return;
 historyReviewError=null;historyReviewBusy=true;renderLearningHistory(learningHistoryData);
 try{const response=await post('history-review',{runId:id,excluded,reason});renderLearningHistory(response.learningHistory||response.history);await loadDiag();}
 catch(error){historyReviewError='History review failed: '+String(error.message||error);}
 finally{historyReviewBusy=false;if(learningHistoryData)renderLearningHistory(learningHistoryData);}
}
function renderLearningIntegrity(summary){
 const box=$('learningintegrity');if(!box)return;const q=summary&&summary.learningIntegrity,manual=summary&&summary.learningReview&&summary.learningReview.excluded;
 if(!q){box.textContent='';return;}
 box.innerHTML=manual?'<b class="bad">Shot excluded from learning by user</b>':!q.eligible?'<b class="bad">Shot excluded from learning automatically</b><br>'+esc((q.reasons||[]).map(x=>x.code+(x.phase?' · '+x.phase.replace('stage','S'):'')).join(' / ')):'<span class="small">No confirmed execution/scale fault; stage quality and consensus gates still apply.</span>';
}
if($('historyexclude'))$('historyexclude').onclick=()=>reviewHistory(true);if($('historyrestore'))$('historyrestore').onclick=()=>reviewHistory(false);

function paint(x){const mode=$('brewingmode');if(mode&&typeof x.activeRelease==='boolean')mode.textContent=x.activeRelease?'Active release: ON · Release / soak / restart':'Active release: OFF · Continuous S1 → S2 → S3';if(x.phase==='soak'){t.textContent='SOAK '+x.soakSecondsRemaining+'s';d.textContent='Active release is complete. Wait until the soak reaches 0. The plugin will arm the second stage only after the full soak.';b.disabled=true;}else if(x.phase==='restart_wait'){t.textContent='CHECK PINK LIGHT · '+x.ghcSecondsRemaining+'s';d.textContent='Pink ON → press the physical GHC Espresso button. Pink OFF → tap RE-ARM, then press GHC when the light turns pink.';b.disabled=false;}else if(x.calibrationActive){t.textContent='FLOW CAL RUNNING';d.textContent='EMPTY BASKET. Leave the staircase running until Idle. Do not remove the catch vessel; the plugin will stop at the selected-mode actual-water safety cap before 300 ml.';b.disabled=true;}else if(['stage1','stage2','stage3'].includes(x.phase)){t.textContent='HYPEREX · '+x.phase.toUpperCase();d.textContent=x.activeRelease?'Active release mode · Weight-driven stage progression.':'Continuous extraction · No intermediate release or restart.';b.disabled=true;}else{t.textContent='HYPEREX IDLE';d.textContent='No GHC action is required.';b.disabled=true;}m.textContent='Cumulative '+Number(x.cumulativeWeight||0).toFixed(1)+'g · arm requests '+(x.armRequestCount||0)+(x.directStartTest?' · DIRECT TEST: '+x.directStartTest.status:'');}
async function post(ep,body){const r=await fetch(base+'/'+ep,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body||{})});let j={};try{j=await r.json()}catch(_){j={error:await r.text()}}if(!r.ok)throw new Error(j.error||('HTTP '+r.status));return j;}
async function doRearm(auto){b.disabled=true;b.textContent='RE-ARMING…';try{const x=await post('rearm',{retry:1});paint(x);t.textContent='RE-ARM REQUEST SENT';d.textContent='Wait for the pink GHC Espresso light, then press the physical GHC Espresso button.';if(auto)setTimeout(closeUi,1300)}catch(e){t.textContent='RE-ARM FAILED';d.textContent=String(e)}finally{b.textContent='RE-ARM';setTimeout(()=>b.disabled=false,800)}}
function stat(label,v){return '<div class="stat"><span class="small">'+label+'</span><b>'+v+'</b></div>'}
function esc(v){return String(v==null?'—':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function commandModeLabel(v,origin,shape){const o=origin||((v==='auto'||!v)?'original':'retained'),label=o==='adaptive'?'ADAPTIVE':o==='manual'?'MANUAL':o==='original'?'ORIGINAL / LUT':'RETAINED / UNKNOWN';const values=shape&&[shape.earlyCommand,shape.midCommand,shape.lateCommand].map(Number),flat=values&&values.every(Number.isFinite)&&Math.max(...values)-Math.min(...values)<.001;return label+(v==='shape'?(flat?' · FLAT (3 timed frames)':' · SHAPE'):'')}
function shapeCommandText(sh){if(!sh||sh.enabled!==true)return null;return esc(sh.earlyCommand)+' × '+esc(sh.earlySeconds)+'s → '+esc(sh.midCommand)+' × '+esc(sh.midSeconds)+'s → '+esc(sh.lateCommand)+' ml/s'}
function appliedS3Text(c){const sh=c&&c.s3Shape;const shaped=shapeCommandText(sh);if(shaped)return shaped;const flat=c&&c.stage3FlatCommandMlS!=null?c.stage3FlatCommandMlS:(c&&c.stage3CommandMlS);return esc(flat)+' ml/s FLAT'}
function renderAppliedCommands(c,truth){if(!appliedcommands)return;if(!c||!c.appliedProfile){appliedcommands.innerHTML='<span class="bad">Current profile command state unavailable.</span>';return}const p=c.appliedProfile,src=c.adaptiveSource||null;const expectedS3=p.stage3||{};const t=truth||{};const a=t.actual||null;let ap1=p.stage1&&p.stage1.commandMlS,ap2=p.stage2&&p.stage2.commandMlS,mode=expectedS3.mode,ap3=expectedS3.mode==='shape'?shapeCommandText(expectedS3.shape):(esc(expectedS3.flatCommandMlS)+' ml/s');if(!a){ap1='unavailable';ap2='unavailable';ap3='unavailable';mode='unverified'}if(a){ap1=a.stage1CommandMlS;ap2=a.stage2CommandMlS;mode=a.stage3Mode==='shape'?'shape':'actual';ap3=a.stage3Mode==='shape'?shapeCommandText(a.s3Shape):(esc(a.stage3CommandMlS)+' ml/s')}let source='<b>Source:</b> '+esc(c.manualTestStatus||'AUTO / LUT');if(src&&src.runId)source='<b>Source:</b> NEXT SHOT ADAPTIVE '+esc(String(src.mode||'').toUpperCase())+' · run '+esc(src.runId)+(src.appliedAt?' · '+esc(src.appliedAt):'');if(c.manualCurveSource)source='<b>Source:</b> '+(c.manualCurveSource.mode==='lut-reset'?'手动恢复 LUT':'手动曲线编辑')+' · 下一杯执行 · '+esc(c.manualCurveSource.appliedAt||'');const truthLine=t.verified?'<span class="good"><b>WORKFLOW READBACK VERIFIED</b></span> · '+esc(t.status||''):'<span class="bad"><b>WORKFLOW NOT VERIFIED</b></span> · '+esc(t.status||'')+' · expected commands are shown only as a reference until repair succeeds.';appliedcommands.innerHTML='<table><tr><th>Stage</th><th>Target REAL g/s</th><th>LUT cmd</th><th>Mode</th><th>ACTUAL WORKFLOW COMMAND</th></tr><tr><td>S1</td><td>'+esc(p.stage1&&p.stage1.desiredGS)+' g/s</td><td>'+esc(p.stage1&&p.stage1.lutCommandMlS)+'</td><td>'+commandModeLabel(p.stage1&&p.stage1.mode,p.stage1&&p.stage1.origin)+'</td><td><b>'+esc(ap1)+' ml/s</b></td></tr><tr><td>S2</td><td>'+esc(p.stage2&&p.stage2.desiredGS)+' g/s</td><td>'+esc(p.stage2&&p.stage2.lutCommandMlS)+'</td><td>'+commandModeLabel(p.stage2&&p.stage2.mode,p.stage2&&p.stage2.origin)+'</td><td><b>'+esc(ap2)+' ml/s</b></td></tr><tr><td>S3</td><td>'+esc(expectedS3.desiredGS)+' g/s</td><td>'+esc(expectedS3.lutCommandMlS)+'</td><td>'+commandModeLabel(mode,expectedS3.origin,a&&a.s3Shape||expectedS3.shape)+'</td><td><b>'+ap3+'</b></td></tr></table><div class="small" style="margin-top:7px">'+truthLine+'<br>'+source+'</div>'}
function renderRunCommands(s){renderLearningIntegrity(s);if(!runcommands)return;const p=s&&s.shotCommands;if(!p){runcommands.innerHTML='<span class="small">No completed HyperEx shot command snapshot is available.</span>';return}const s3=p.stage3||{};const s3txt=s3.mode==='shape'?shapeCommandText(s3.shape):(esc(s3.flatCommandMlS)+' ml/s');runcommands.innerHTML=(s.liveFlowTrim?'<div class="small"><b>LIVE TRIM ENABLED:</b> this table is the shot-start snapshot. In-shot commands and machine target responses are plotted and exported below.</div>':'')+'<table><tr><th>Stage</th><th>Target</th><th>LUT cmd</th><th>Mode AT SHOT START</th><th>COMMANDS USED BY THIS SHOT</th></tr><tr><td>S1</td><td>'+esc(p.stage1&&p.stage1.desiredGS)+' g/s</td><td>'+esc(p.stage1&&p.stage1.lutCommandMlS)+'</td><td>'+commandModeLabel(p.stage1&&p.stage1.mode,p.stage1&&p.stage1.origin)+'</td><td><b>'+esc(p.stage1&&p.stage1.commandMlS)+' ml/s</b></td></tr><tr><td>S2</td><td>'+esc(p.stage2&&p.stage2.desiredGS)+' g/s</td><td>'+esc(p.stage2&&p.stage2.lutCommandMlS)+'</td><td>'+commandModeLabel(p.stage2&&p.stage2.mode,p.stage2&&p.stage2.origin)+'</td><td><b>'+esc(p.stage2&&p.stage2.commandMlS)+' ml/s</b></td></tr><tr><td>S3</td><td>'+esc(s3.desiredGS)+' g/s</td><td>'+esc(s3.lutCommandMlS)+'</td><td>'+commandModeLabel(s3.mode,s3.origin,s3.shape)+'</td><td><b>'+s3txt+'</b></td></tr></table><div class="small" style="margin-top:7px">Historical snapshot only. It does not change when NEXT SHOT ADAPTIVE writes a new profile after this shot.</div>'}
const ADV_SETTING_KEYS={adaptiveLearningLevel:'AdaptiveLearningLevel',activeRelease:'ActiveRelease',liveFlowTrimLevel:'LiveFlowTrimLevel',liveFlowTrimTest:'LiveFlowTrimTest',directDriverStartTest:'DirectDriverStartTest',stage1Flow:'Stage1Flow',stage1PressureLimit:'Stage1PressureLimit',dumpFlowThreshold:'DumpFlowThreshold',dumpFlowStableSamples:'DumpFlowStableSamples',dumpFallbackSeconds:'DumpFallbackSeconds',dumpTimeoutSeconds:'DumpTimeoutSeconds',stage2Flow:'Stage2Flow',stage2PressureLimit:'Stage2PressureLimit',stage3Flow:'Stage3Flow',stage3PressureLimit:'Stage3PressureLimit',hardPressureLimit:'HardPressureLimit',scaleResetThreshold:'ScaleResetThreshold',noScaleTimeoutSeconds:'NoScaleTimeoutSeconds',autoArmRetry1Seconds:'AutoArmRetry1Seconds',autoArmRetry2Seconds:'AutoArmRetry2Seconds',diagnosticSampleIntervalMs:'DiagnosticSampleIntervalMs',maxRunSeconds:'MaxRunSeconds'};
document.addEventListener('input',e=>{const k=e.target&&e.target.dataset&&e.target.dataset.originStage;if(k){const q=$('mode_'+k);if(q)q.value='manual'}});
const ADV_FIELDS=Object.keys(ADV_SETTING_KEYS);
function updateTrimLevelLabel(){const q=$('adv_liveFlowTrimLevel'),o=$('adv_liveFlowTrimLevelLabel');if(!q||!o)return;const labels=['一档 · 原周期 / 最多50次写入','二档 · 300 ms / 最多150次写入','三档 · 250 ms / 最多200次写入','四档 · 200 ms / 最多250次写入'];const level=Number(q.value);o.textContent=labels[level-1]||labels[0];q.setAttribute('aria-valuetext',o.textContent)}
const trimLevelSlider=$('adv_liveFlowTrimLevel');if(trimLevelSlider)trimLevelSlider.addEventListener('input',updateTrimLevelLabel);

async function loadAdvancedSettings(){try{const r=await fetch(base+'/advanced-settings');if(!r.ok)return;const j=await r.json(),a=j.settings||{};for(const k of ADV_FIELDS){const q=$('adv_'+k);if(q&&a[k]!=null){if(q.type==='checkbox')q.checked=!!a[k];else q.value=a[k]}}const currentTemp=$('adv_temperature');if(currentTemp&&a.temperature!=null)currentTemp.value=Number(a.temperature).toFixed(1)+' °C';const meta=$('advancedmeta');updateTrimLevelLabel();const modeBox=$('adv_activeRelease');if(modeBox)modeBox.disabled=!j.canEdit;if(meta){const bt=j.basicCurve||{};meta.innerHTML='Single settings source · core curve: S1 <b>'+esc(bt.stage1WeightG)+'g</b> → settle <b>'+esc(bt.releaseSettleSeconds)+'s</b> → soak <b>'+esc(bt.soakSeconds)+'s</b> → S2→S3 <b>'+esc(bt.stage2WeightG)+'g</b> → final <b>'+esc(bt.finalWeightG)+'g</b> · GHC timeout <b>'+esc(bt.ghcConfirmTimeoutSeconds)+'s</b>.'+(j.directStartTest?'<br><b>DIRECT DRIVER TEST: '+esc(j.directStartTest.status)+'</b>':'')}}catch(e){const meta=$('advancedmeta');if(meta)meta.textContent='Settings load error: '+e}}
async function saveAdvancedSettings(){const preflight=await fetch(base+'/advanced-settings');if(!preflight.ok){alert('Settings availability check failed');return}const eligibility=await preflight.json();if(!eligibility.canEdit){alert('Change settings only while idle');return}const payload={};for(const k of ADV_FIELDS){const q=$('adv_'+k);if(!q)continue;if(q.type==='checkbox'){payload[ADV_SETTING_KEYS[k]]=q.checked;continue}if(k==='adaptiveLearningLevel'){payload[ADV_SETTING_KEYS[k]]=q.value;continue}const v=Number(q.value);if(!Number.isFinite(v)){alert('Invalid setting: '+k);return}payload[ADV_SETTING_KEYS[k]]=k==='liveFlowTrimLevel'?String(v):v}if(!confirm('Save these values to the normal HyperEx plugin Settings?\\n\\nThis uses the same settings source shown on the Plugins page and reloads HyperEx once.'))return;const r=await fetch(coreSettings,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});if(!r.ok){alert('Save failed: '+await r.text());return}alert('Settings saved. HyperEx is reloading; reopen DIAG / CAL if this page closes.');setTimeout(()=>location.reload(),1200)}
async function loadCal(){try{const r=await fetch(base+'/calibration-status');const c=await r.json();renderLearningHistory(c.learningHistory);latestManualCurveSource=c.commandFlows&&c.commandFlows.manualCurveSource||null;renderCurveEditor(c.curveEditor);renderAppliedCommands(c.commandFlows||{},c.profileTruth||{});renderBasketContext(c);latestAutoApplyEnabled=c.autoApplyNextShot!==false;latestAutoApplyStatus=c.autoApplyLastStatus||null;renderAutoApplyBox();renderAdaptive(latestAdaptiveSummary);renderNextDecision(latestAdaptiveSummary);const ok=c.calibrationUsable;const b1=$("step1badge"),b2=$("step2badge");if(b1){b1.textContent=ok?"CAL READY":"REQUIRED FIRST";b1.className="stepBadge "+(ok?"good":"bad")}if(b2){b2.textContent=ok?"ACTIVE · AUTO NEXT SHOT":"WAITING FOR VALID LUT";b2.className="stepBadge "+(ok?"good":"bad")}const hs=c.persistentHistory||{},hb=$("historystatus");if(hb){if(hs.available===true){hb.style.background="#173b25";hb.style.color="#9ff0b5";hb.innerHTML='<b>ADAPTIVE HISTORY · PERSISTENT</b> · '+esc(hs.savedShots)+' saved shot(s), '+esc(hs.compatibleShots)+' compatible with the current calibration/LUT and basket context. '+esc(hs.baselineReferenceShots||0)+' empty/pre-upgrade baseline references retained; coffee consensus accumulates from normal coffees.'}else if(hs.available===false){hb.style.background="#4a2024";hb.style.color="#ffb4b8";hb.innerHTML='<b>ADAPTIVE HISTORY · SESSION ONLY</b> · '+esc(hs.status)+'<br>Shot-to-shot adaptation still works in this session, but cross-reload/version regression is disabled.'}else{hb.style.background="#3b2d16";hb.style.color="#ffd58a";hb.innerHTML='<b>ADAPTIVE HISTORY</b> · checking pluginStorage write/readback…'}}if($("t1")){ $("t1").value=c.commandFlows&&c.commandFlows.stage1DesiredGS!=null?c.commandFlows.stage1DesiredGS:""; $("t2").value=c.commandFlows&&c.commandFlows.stage2DesiredGS!=null?c.commandFlows.stage2DesiredGS:""; $("t3").value=c.commandFlows&&c.commandFlows.stage3DesiredGS!=null?c.commandFlows.stage3DesiredGS:"";}if(calmode){calmode.innerHTML=(c.calibrationModes||[{id:'low',label:'Low Water'},{id:'full',label:'Full'}]).map(x=>'<button class="b s '+(c.calibrationMode===x.id?'active':'')+'" data-mode="'+esc(x.id)+'">'+esc(x.label)+(x.id==='low'?' · DEFAULT':'')+'</button>').join('');calmode.querySelectorAll('button').forEach(q=>q.onclick=async()=>{await post('calibration-mode',{mode:q.dataset.mode});await loadCal()})}if(waterwarn){const w=c.waterPreflight||{};const wc=w.status==='ok'?'#163b26':w.status==='warn'?'#3b2d16':'#4a2024';const fg=w.status==='ok'?'#9ff0b5':w.status==='warn'?'#ffd58a':'#ffb4b8';waterwarn.style.background=wc;waterwarn.style.color=fg;let tank='Tank level unavailable';if(w.available)tank='Tank: <b>'+esc(w.currentLevelMm)+' mm</b> · refill threshold: <b>'+esc(w.refillLevelMm)+' mm</b> · margin: <b>'+esc(w.marginMm)+' mm</b>';waterwarn.innerHTML='<b>WATER / VESSEL / TANK PREFLIGHT · '+esc(c.calibrationModeLabel)+' · '+esc((w.status||'unknown').toUpperCase())+'</b><br>'+tank+'<br>Prime: '+esc(c.primeFlow)+' ml/s × '+esc(c.primeSeconds)+' s · '+esc(c.calibrationSteps)+' calibration plateaus × '+esc(c.calibrationStepSeconds)+' s · nominal DE1 command water <b>≈'+esc(c.nominalCommandWaterMl)+' ml</b>.<br>Use a <b>'+esc(c.recommendedContainerMl)+' ml or larger</b> catch vessel. Plugin actively stops around <b>'+esc(c.calibrationHardStopG)+' g</b> actual collected water. '+esc(w.message||'');}calstatus.innerHTML='<b class="'+(ok?'good':'bad')+'">'+(ok?'CALIBRATION READY':'CALIBRATION NOT READY')+'</b><br>Mode: <b>'+esc(c.calibrationModeLabel)+'</b> · Profile: <b>'+esc(c.calibrationProfileTitle)+'</b><br>Scope: <b>'+esc(c.scopeLabel)+'</b> · DE1 multiplier: <b>'+esc(c.currentFlowMultiplier)+'</b> · map base: <b>'+esc(c.calibrationBaseMultiplier)+'</b> · suggested: <b>'+esc(c.suggestedFlowMultiplier)+'</b><br>LUT rev <b>'+esc(c.lutRevision||1)+'</b> · points <b>'+esc(c.pointCount)+'</b>'+(Array.isArray(c.actualRange)?' · range <b>'+esc(c.actualRange[0])+'..'+esc(c.actualRange[1])+' g/s</b>':'')+(c.lutMerge?' · merged: <b>'+esc(c.lutMerge.retained)+'</b> retained, <b>'+esc(c.lutMerge.added)+'</b> new, <b>'+esc(c.lutMerge.replaced)+'</b> replaced':'')+'<br>'+esc(c.calibrationStaleReason||'LUT valid')+(c.lastCalibrationValid===false?'<br><b class="bad">LAST CAL RUN INVALID — previous valid LUT retained</b>':c.lastCalibrationValid===true?'<br><b class="good">LAST CAL RUN VALID</b>':'')+'<br>Real→command: S1 '+esc(c.commandFlows&&c.commandFlows.stage1DesiredGS)+'→'+esc(c.commandFlows&&c.commandFlows.stage1CommandMlS)+' · S2 '+esc(c.commandFlows&&c.commandFlows.stage2DesiredGS)+'→'+esc(c.commandFlows&&c.commandFlows.stage2CommandMlS)+' · S3 '+esc(c.commandFlows&&c.commandFlows.stage3DesiredGS)+'→'+appliedS3Text(c.commandFlows||{})+'<br>Test mode: <b>'+esc((c.commandFlows&&c.commandFlows.manualTestStatus)||'none')+'</b>';renderTestCommands(c.commandFlows||{},latestAdvisorySummary||{});scope.innerHTML=['off','hyperex','global'].map(x=>'<button class="b s '+(c.scope===x?'active':'')+'" data-scope="'+x+'">'+(x==='off'?'OFF':x==='hyperex'?'HYPEREX ONLY':'GLOBAL')+'</button>').join('');scope.querySelectorAll('button').forEach(q=>q.onclick=async()=>{await post('calibration-scope',{scope:q.dataset.scope});await loadCal()});const last=c.lastCalibration||null;const rows=last&&Array.isArray(last.plateauResults)?last.plateauResults:[];const anchors=last&&last.map&&Array.isArray(last.map.targetAnchors)?last.map.targetAnchors:[];const anchorHtml=anchors.length?'<div style="margin:8px 0"><b>TARGET LUT:</b> '+anchors.map(a=>esc(a.blockId)+' '+esc(a.actualFlow)+' g/s → '+esc(a.commandFlow)+' ml/s ('+esc(a.quality)+')').join(' · ')+'</div>':'';map.innerHTML=rows.length?anchorHtml+'<table><tr><th>Frame</th><th>Block / target</th><th>DE1 cmd</th><th>RAW real g/s</th><th>DE1 flow</th><th>R²</th><th>Status</th></tr>'+rows.map(p=>'<tr><td>'+esc(p.frame)+'</td><td>'+esc((p.blockId||'—')+(p.targetReal!=null?' / '+p.targetReal:'') )+'</td><td>'+esc(p.commandFlow)+'</td><td>'+esc(p.actualFlow)+'</td><td>'+esc(p.machineFlow)+'</td><td>'+esc(p.r2)+'</td><td class="'+(p.acceptedInMap?'good':(p.valid?'':'bad'))+'">'+esc(p.acceptedInMap?'ANCHOR SOURCE':(p.reason||'REJECTED'))+'</td></tr>').join('')+'</table><div style="margin-top:8px">'+esc(c.profileSyncStatus||'')+'</div>':'No calibration run yet. Low Water automatically searches the three HyperEx real-flow targets and generates the LUT only when all targets pass. Full remains the wide engineering staircase.';const cur=c.stage1StartupCorrection||1;startupbox.innerHTML='<b>Stable skip topology:</b> scale feedback is advisory only. Optional S3 DECAY COMP may use 5 profile frames, but S3 subframes advance only by their own timers and never add plugin skipStep calls.'+(Number(cur)!==1?(' <br><span class="bad">Legacy S1 startup factor '+esc(cur)+'× is stored but ignored in v${PLUGIN_VERSION}.</span> <button id=clearstartup class="b s">CLEAR LEGACY</button>'):'');const cl=$("clearstartup");if(cl)cl.onclick=async()=>{try{await post('startup-clear',{});await loadCal()}catch(e){alert('Clear failed: '+e)}};}catch(e){calstatus.textContent='Calibration status error: '+e}}
// Daily charts show extraction only. Full original telemetry remains in CSV/run data.
function extractionChartRows(run,rows){
 if(run.kind==='calibration')return(rows||[]).map(s=>({...s,_chartSegment:0,_chartGroup:'calibration'}));
 const events=run.events||[],firstStop=events.find(e=>e.name==='stage1_weight_trigger'),finalStop=events.find(e=>e.name==='final_weight_trigger');
 const release=!(run.config&&run.config.activeRelease===false);let segment=-1,previousGroup=null,interrupted=true;const out=[];
 for(const s of rows||[]){
  const time=Number(s.tMs),phase=s.phase;
  let keep=Number.isFinite(time)&&['stage1','stage2','stage3'].includes(phase);
  if(finalStop&&time>Number(finalStop.tMs))keep=false;
  if(release&&firstStop&&phase==='stage1'&&time>Number(firstStop.tMs))keep=false;
  if(s.machineState&&s.machineState!=='espresso')keep=false;
  if(s.substate&&!['preinfusion','pouring'].includes(s.substate))keep=false;
  if(!keep){interrupted=true;continue;}
  const group=release&&phase==='stage1'?'stage1':'brew';
  if(interrupted||group!==previousGroup)segment++;
  out.push({...s,_chartSegment:segment,_chartGroup:group});interrupted=false;previousGroup=group;
 }
 return out;
}
function extractionChartData(run){
 const combined=extractionChartRows(run,run.samples),raw=extractionChartRows(run,run.rawScaleSamples),windows=[];
 for(const group of ['stage1','brew','calibration']){
  const rows=combined.concat(raw).filter(s=>s._chartGroup===group);if(!rows.length)continue;
  const start=Math.min(...rows.map(s=>Number(s.tMs)));let end=Math.max(...rows.map(s=>Number(s.tMs)));
  const stop=(run.events||[]).find(e=>e.name===(group==='stage1'?'stage1_weight_trigger':'final_weight_trigger'));
  if(stop&&Number(stop.tMs)>=start)end=Number(stop.tMs);
  windows.push({start,end,group});
 }
 const trace=(run.liveFlowTrim&&run.liveFlowTrim.trace||[]).flatMap(x=>{const segment=windows.findIndex(w=>Number(x.tMs)>=w.start&&Number(x.tMs)<=w.end);return segment<0?[]:[{...x,_chartSegment:segment,_chartGroup:windows[segment].group}];});
 return {combined,raw,trace};
}
function extractionChartPoints(rows,field){let segment=null;const points=[];for(const s of rows){const time=Number(s.tMs)/1000;if(segment!==null&&segment!==s._chartSegment){const prev=rows[rows.indexOf(s)-1];if(prev&&prev._chartGroup==='stage1'&&s._chartGroup==='brew'){points.push([Number(prev.tMs)/1000,0],[time,0]);}else points.push([time,NaN]);}points.push([time,s[field]==null?NaN:Number(s[field])]);segment=s._chartSegment;}return points;}
function svgPath(points,xmin,xmax,ymin,ymax){const W=800,H=205,pad=18,dx=Math.max(.001,xmax-xmin),dy=Math.max(.001,ymax-ymin);let out='',pen=false;for(const q of points){if(!Number.isFinite(q[0])||!Number.isFinite(q[1])){pen=false;continue;}const x=pad+(q[0]-xmin)/dx*(W-pad*2),y=H-pad-(q[1]-ymin)/dy*(H-pad*2);out+=(pen?' L ':'M ')+x.toFixed(1)+' '+y.toFixed(1);pen=true}return out}
function renderChart(svg,series,ymin,ymax,markers,tickVals){if(!svg)return;let all=[];series.forEach(s=>all=all.concat(s.points));all=all.filter(p=>Number.isFinite(p[0])&&Number.isFinite(p[1]));if(!all.length){svg.innerHTML='';return}const xs=all.map(p=>p[0]).filter(Number.isFinite),ys=all.map(p=>p[1]).filter(Number.isFinite);const xmin=Math.min(...xs),xmax=Math.max(...xs);if(ymin==null)ymin=Math.min(...ys);if(ymax==null)ymax=Math.max(...ys);if(ymax-ymin<.01)ymax=ymin+1;let h='<line x1="18" y1="187" x2="782" y2="187" stroke="#3a3f47"/><line x1="18" y1="18" x2="18" y2="187" stroke="#3a3f47"/>';for(const tv of (tickVals||[])){if(!Number.isFinite(tv)||tv<=ymin||tv>=ymax)continue;const ty=187-(tv-ymin)/Math.max(.001,ymax-ymin)*169;h+='<line x1="18" y1="'+ty+'" x2="782" y2="'+ty+'" stroke="#3a3f47" stroke-dasharray="3 3" opacity=".4"/><text x="24" y="'+(ty+3.5)+'" fill="#aeb6c2" font-size="10">'+Number(tv).toFixed(1)+'</text>';}for(const s of series){const path=svgPath(s.points,xmin,xmax,ymin,ymax);if(path)h+='<path d="'+path+'" fill="none" stroke="'+s.stroke+'" stroke-width="'+(s.width||1.7)+'" opacity="'+(s.opacity||1)+'"/>'}h+='<text x="24" y="16" fill="#aeb6c2" font-size="10">'+Number(ymax).toFixed(1)+'</text><text x="24" y="184" fill="#aeb6c2" font-size="10">'+Number(ymin).toFixed(1)+'</text>';for(const q of markers||[]){if(!Number.isFinite(q.x))continue;const xx=18+(q.x-xmin)/Math.max(.001,xmax-xmin)*764;const yy=Number.isFinite(q.y)?187-(q.y-ymin)/Math.max(.001,ymax-ymin)*169:181;const title='<title>'+esc(q.label||'')+'</title>';const tip=' data-tip="'+esc(q.label||'').replace(/"/g,'&quot;')+'"';if(q.shape==='up'||q.shape==='down'){const sign=q.shape==='up'?-1:1,sz=q.size||5,tpos=yy+sign*sz,hbase=tpos-sign*5;h+='<path d="M '+xx+' '+(yy-sign*sz)+' L '+xx+' '+tpos+' M '+(xx-4)+' '+hbase+' L '+xx+' '+tpos+' L '+(xx+4)+' '+hbase+'" fill="none" stroke="'+q.color+'" stroke-width="1.8"'+tip+'>'+title+'</path>';}else if(q.shape==='retry'||q.shape==='unknown')h+='<text x="'+xx+'" y="'+(yy+4)+'" text-anchor="middle" fill="'+q.color+'" font-size="13"'+tip+'>'+title+(q.shape==='retry'?'↻':'·')+'</text>';else if(q.shape==='diamond')h+='<path d="M '+xx+' '+(yy-4)+' l 4 4 l -4 4 l -4 -4 Z" fill="'+q.color+'"'+tip+'>'+title+'</path>';else if(q.shape==='square')h+='<rect x="'+(xx-3)+'" y="'+(yy-3)+'" width="6" height="6" fill="'+q.color+'"'+tip+'>'+title+'</rect>';else h+='<circle cx="'+xx+'" cy="'+yy+'" r="3" fill="'+q.color+'"'+tip+'>'+title+'</circle>'}svg.innerHTML=h}
function liveTrimMarkers(run){return(run.liveFlowTrim&&run.liveFlowTrim.trace||[]).filter(x=>['check','write','machine-target-response'].includes(x.kind)).map(x=>{const delta=Number.isFinite(x.previousMlS)&&Number.isFinite(x.commandMlS)?x.commandMlS-x.previousMlS:null;const direction=x.kind==='write'?(x.retry?'retry':delta===null?'unknown':delta>0?'up':delta<0?'down':'retry'):null;return {x:x.tMs/1000,y:x.kind==='check'?x.rawGS:(Number.isFinite(Number(x.rawGS))?Number(x.rawGS):x.commandMlS),size:delta===null?null:Math.max(2,Math.round(Math.abs(delta)*48)),shape:x.kind==='write'?direction:x.kind==='machine-target-response'?'square':'circle',color:x.kind==='write'?'#ff9c45':x.kind==='machine-target-response'?'#f4e6a5':x.rawGS==null?'#7c8795':'#63d89b',label:(x.kind==='write'?(direction==='retry'?'同值重试 ↻':direction==='up'?'上调指令 ↑':direction==='down'?'下调指令 ↓':'写入指令（方向未知）'):x.kind)+' @ '+(x.tMs/1000).toFixed(2)+'s · '+(x.kind==='check'?(x.rawGS==null?'no valid RAW regression':x.rawGS+' g/s')+' · '+(x.reason||x.decision):x.commandMlS+' ml/s')+(delta!==null&&x.kind==='write'?' · '+x.previousMlS+' → '+x.commandMlS+' ml/s':'')+(x.startupAction?' · '+(x.startupAction==='return'?'补水收回':'补水增强')+(x.startupReason?' · '+x.startupReason:''):'')}})}
function renderLiveTrim(run){const q=$('livetrimstatus');if(!q)return;const x=run&&run.liveFlowTrim;if(!x){q.textContent='';return}q.textContent='EXPERIMENTAL LIVE FLOW TRIM · level '+(x.level||1)+' · '+x.status+' · checks '+x.checks+'/'+(x.maxChecks||50)+' · writes '+x.writes+'/'+(x.maxWrites||50)+' · driver ACK '+x.acks+' · trend confirms '+x.targetConfirmations+' · unresponsive '+(x.targetMisses||0)+' / streak '+(x.consecutiveTargetMisses||0)+' · vector redispatch '+(x.retries||0)+' · interval '+x.periodMs+' ms'+(x.zeroDegreeShare===null?'':' · 0° share '+Math.round(x.zeroDegreeShare*100)+'% · mean angle '+x.meanAngleDeg+'°')+' · vector angle '+(x.vectorAngleDeg==null?'—':x.vectorAngleDeg+'°')+' · big-angle streak '+(x.bigAngleStreak||0)+' · next-shot band ±'+esc(x.learningBand||8)+'%; confirmed windows pooled with labelled seed-normalization model';}
function renderCharts(run){if(!run)return;lastChartRun=run;const chart=extractionChartData(run),combined=chart.combined,raw=chart.raw,chartRun={...run,liveFlowTrim:{...(run.liveFlowTrim||{}),trace:chart.trace}};const target=extractionChartPoints(combined,'targetFlowMlS'),machine=extractionChartPoints(combined,'machineFlowMlS'),decaid=extractionChartPoints(combined,'decaidWeightFlowGS');const cupTarget=extractionChartPoints(combined,'desiredRealFlowGS');const rawSlope=[];let rawSegment=null,segmentStart=0;for(let i=0;i<raw.length;i++){if(rawSegment!==raw[i]._chartSegment){if(rawSegment!==null){const prev=raw[i-1];if(prev&&prev._chartGroup==='stage1'&&raw[i]._chartGroup==='brew')rawSlope.push([Number(prev.tMs)/1000,0],[Number(raw[i].tMs)/1000,0]);else rawSlope.push([Number(raw[i].tMs)/1000,NaN]);}rawSegment=raw[i]._chartSegment;segmentStart=i;}let j=i-1;while(j>segmentStart&&Number(raw[i].tMs)-Number(raw[j].tMs)<900)j--;if(j>=segmentStart){let reset=false;for(let k=j+1;k<=i;k++)if(raw[k].tareReset){reset=true;break}const dt=(Number(raw[i].scaleTimestampSeconds)-Number(raw[j].scaleTimestampSeconds));if(!reset&&Number.isFinite(dt)&&dt>.25){rawSlope.push([Number(raw[i].tMs)/1000,(Number(raw[i].weightG)-Number(raw[j].weightG))/dt])}}}const trendPts=[];for(const x of (chart.trace||[]))if((x.kind==='check'||x.kind==='write')&&Number.isFinite(Number(x.rawGS)))trendPts.push([Number(x.tMs)/1000,Number(x.rawGS)]);const trendSmooth=trendPts.map((p,i)=>{const a=trendPts.slice(Math.max(0,i-1),Math.min(trendPts.length,i+2));return [p[0],a.reduce((s,q)=>s+q[1],0)/a.length]});const flowYs=[...target,...machine,...decaid,...rawSlope].map(p=>p[1]).filter(v=>Number.isFinite(v)&&v>-1&&v<20);const fymax=Math.max(6,flowYs.length?Math.min(12,Math.ceil(Math.max(...flowYs)+.5)):8);renderChart($('flowchart'),[{key:'cup',points:cupTarget,stroke:'#f58d9a',width:1.3},{key:'target',points:target,stroke:'#f0c75e',width:1.4},{key:'machine',points:machine,stroke:'#71a7ff',width:1.8},{key:'decaid',points:decaid,stroke:'#c77dff',width:1.5,opacity:.8},{key:'raw',points:rawSlope,stroke:'#63d89b',width:2.1},{key:'trend',points:trendSmooth,stroke:'#8fd7ff',width:1.3,opacity:.9},{key:'writes',points:extractionChartPoints(chart.trace.filter(x=>x.kind==='write'),'commandMlS'),stroke:'#ff9c45',width:2}].filter(x=>flowSeriesVisible[x.key]),0,fymax,liveTrimMarkers(chartRun).filter(x=>x.shape==='circle'?flowSeriesVisible.raw:x.shape==='square'?flowSeriesVisible.target:flowSeriesVisible.writes));const anglePts=[];for(const x of (chart.trace||[]))if(x.kind==='check'&&Number.isFinite(Number(x.trendAngleDeg)))anglePts.push([Number(x.tMs)/1000,Number(x.trendAngleDeg)]);if($('anglechart')){if(anglePts.length)renderChart($('anglechart'),[{key:'angle',points:anglePts,stroke:'#ffd166',width:1.8}],0,180,null,[90]);else $('anglechart').innerHTML='';}const wp=extractionChartPoints(raw,'weightG');if(wp.length){const wy=wp.map(p=>p[1]).filter(Number.isFinite);renderChart($('weightchart'),[{points:wp,stroke:'#e5e8ed',width:2}],Math.min(...wy),Math.max(...wy))}else if($('weightchart'))$('weightchart').innerHTML=''}
function renderNextDecision(s){const el=$('nextdecision');if(!el)return;const a=s&&s.nextShotAdaptive;if(!a){el.textContent=s&&(s.learningReview&&s.learningReview.excluded||s.learningIntegrity&&s.learningIntegrity.eligible===false)?'Shot excluded from learning; see history review.':'尚无完整杯数据；请按正常流程出杯。';return}const manual=latestManualCurveSource&&String(latestManualCurveSource.afterRunId||'')===String(a.runId||''),st=latestAutoApplyStatus||{},matching=String(st.runId||'')===String(a.runId||'');let h='<b>下一杯决策 · 输出偏差与调整资格分别判断</b>';for(const [label,key] of [['S1','s1'],['S2','s2'],['S3','s3']]){const x=a[key]||{},p=s['stage'+label.slice(1)]||{};let status=manual?'手动曲线已替代此杯建议':x.usable!==false&&(x.action==='ADJUST'||x.action==='LUT COMPENSATE'||x.suggestedShape)?(matching&&['applied','manual-applied'].includes(st.status)?'已校验应用':matching&&st.status==='error'?'应用失败，保留原曲线':latestAutoApplyEnabled?'有调整建议，等待校验应用':'有调整建议，自动应用已关闭'):x.action==='HOLD'?(x.actualDirectionGuard&&x.actualDirectionGuard.blocked?'实测与模型方向冲突，保持':'保持当前指令'):String(x.action||'').includes('SATURATED')?'加码未触发杯流响应，保持下一杯指令':String(x.action||'').includes('VARIABLE')?'杯间差异较大，暂不自动追调':String(x.action||'').includes('LIMITED')?'受压力／执行条件限制':'等待可比学习证据';h+='<div class="m"><b>'+label+' · '+esc(p.validationStatus||'—')+' '+(p.rawErrorPct==null?'':esc(p.rawErrorPct)+'%')+' → '+esc(status)+'</b><br>'+esc(x.reason||'尚无学习证据')+(x.historySearch?'<br><span class="small">History checked: '+esc(x.historySearch.checked)+' · missing stage: '+esc(x.historySearch.missingStage)+' · context mismatch: '+esc(x.historySearch.skippedContext)+' · command mismatch: '+esc(x.historySearch.incompatibleCommands)+' · storage excluded: '+esc(x.historySearch.skippedStorage)+' · basis mismatch: '+esc(x.historySearch.incompatibleBasis||0)+' · nearby command comparisons: '+esc(x.historySearch.nearbyCommandComparisons||0)+' · matched run: '+esc(x.historySearch.matchedRunId||'none')+'</span>':'')+'</div>'}if(!manual)h+='<div class="small">若需主动调整，可使用上方“下一杯 · 曲线编辑”；修改后需应用并校验。</div>';const selected=s.learningPolicy||{};h+='<div class="small">Learning strength: '+esc(selected.name||'—')+' · Admission width: '+esc(selected.qualityWidth||1)+'×</div>';const audit=s.historyPersistence||{};h+='<div class="m"><b>History persistence</b><br>'+esc(audit.status||'—')+' · '+esc(audit.records||0)+' records · '+esc(audit.bytes||0)+' bytes<br>'+esc(audit.detail||'')+'</div>';const m=s.stage2Startup||{},plan=s.stage2StartupNext||{},execution=s.liveFlowTrim&&s.liveFlowTrim.startupExecution||{};h+='<div class="m"><b>S2 startup response</b><br>'+esc(m.reason||'S2 startup data insufficient')+'<br>Response delay: '+esc(m.firstResponseDelayS==null?'—':m.firstResponseDelayS)+' s · 20–80% rise: '+esc(m.rise20to80S==null?'—':m.rise20to80S)+' s · Rise basis: '+esc(m.riseBasis||'target')+' · Tail error: '+esc(m.tailErrorPct==null?'—':m.tailErrorPct)+'%<br>Next startup: '+esc(plan.reason||'S2 startup needs two comparable clean shots')+(plan.enabled?(plan.strategy==='refill-85'?' · '+esc(plan.baseCommandMlS)+' → '+esc(plan.boostCommandMlS)+' ml/s · '+esc(Math.round((plan.refillTargetFraction||1)*100))+'% base pump flow · '+esc(Math.round(plan.cutoffFraction*100))+'% cutoff · max '+esc(plan.holdMs)+' ms':' · +'+esc(plan.boostQuanta)+'/16 ml/s × '+esc(plan.holdMs)+' ms'):'')+(plan.returnCommandMlS!=null?' · 接管指令 '+esc(plan.returnCommandMlS)+' ml/s':'')+(s.stage2CupOnset?'<br>'+(s.stage2CupOnset.detected?'S2有效称流起点：'+esc((s.stage2CupOnset.startMs/1000).toFixed(2))+' s · 出液前等待 '+esc(s.stage2CupOnset.delayS)+' s，不计入合格与学习窗口':'S2尚未检测到持续有效出液；暂不计算流量合格判定'):'')+'<br>Executed startup boost: '+esc(m.pulseUsed?'YES':'NO')+' · '+esc(execution.status||'not-planned')+'<br>'+esc(execution.reason||'')+'</div>';const tl=s.s2RefillTimeline||{};if(tl.stage2StartMs!=null||tl.onsetMs!=null){const pct=plan.cutoffFraction!=null?Math.round(plan.cutoffFraction*100):null,relS=v=>v==null?'—':Number(v).toFixed(2)+' s';h+='<div class="m"><b>S2 补水节点</b><br>帧确认 0.00 s · onset '+relS(tl.relative&&tl.relative.onsetS)+'（S2 起点）'+(tl.cutoffAtMs!=null?' · 杯流 '+esc(pct==null?'—':pct)+'% '+relS(tl.relative&&tl.relative.cutoffS):'')+(tl.relative&&tl.relative.returnS!=null?' · 收回 '+relS(tl.relative&&tl.relative.returnS):'')+(tl.relative&&tl.relative.completeS!=null?' · 确认 '+relS(tl.relative&&tl.relative.completeS):'')+'<br>'+(tl.overlap?'S2 与补水重叠 '+esc(tl.overlap.seconds)+' s（onset → 收回）':'S2 与补水无重叠')+'</div>'}const gains=[['S2',a.s2&&a.s2.gainFeedForward],['S3',a.s3&&a.s3.gainFeedForward]].filter(x=>x[1]);if(gains.length)h+='<div class="m">'+gains.map(([n,g])=>g.k==null?'<b>'+n+' 稳态增益 k</b><br>样本 '+esc(g.samples||0)+' 杯 · 需 ≥2 杯同段干净记录':'<b>'+n+' 稳态增益 k</b><br>k '+esc(g.k)+' · 样本 '+esc(g.samples)+' · 离散 '+esc(Number(g.spread*100).toFixed(1))+'%<br>当前指令 '+esc(g.currentCommandMlS)+' → 目标折算 '+esc(g.targetCommandMlS)+' · 限幅后 '+esc(g.boundedCommandMlS)+' ml/s'+(g.applied?' · 已应用':'')).join('<br>')+'</div>';el.innerHTML=h}
function validationClass(x){return x==='HIT'?'good':x==='NEAR'||x==='TRANSIENT'?'':'bad'}
function validationRow(label,p){if(!p)return '<tr><td>'+label+'</td><td colspan=7>—</td></tr>';return '<tr><td>'+label+'</td><td>'+esc(p.desiredRealFlowGS)+'</td><td>'+esc(p.machineFlowAvg)+'</td><td>'+esc(p.gflowAvg)+'</td><td><b>'+esc(p.rawRegressionGS)+'</b></td><td>'+esc(p.rawRegressionR2)+'</td><td>'+esc(p.rawRegressionSeconds)+'s</td><td class="'+validationClass(p.validationStatus)+'">'+esc(p.validationStatus)+' '+(p.rawErrorPct==null?'':('('+p.rawErrorPct+'%)'))+'</td></tr>'}
function advisoryClass(a){return !a?'':a.action==='HOLD'?'good':a.confidence==='INSUFFICIENT'?'bad':''}
function advisoryRow(label,a){if(!a)return '<tr><td>'+label+'</td><td colspan=6>—</td></tr>';const ref=a.referenceCommandMlS==null?'—':a.referenceCommandMlS;const range=a.referenceRangeMlS&&a.referenceRangeMlS.length===2?(a.referenceRangeMlS[0]+'–'+a.referenceRangeMlS[1]):'—';return '<tr><td>'+label+'</td><td>'+esc(a.confidence)+'</td><td>'+esc(a.action)+'</td><td>'+esc(a.currentCommandMlS)+'</td><td>'+esc(ref)+'</td><td><b>'+esc(range)+'</b></td><td class="'+advisoryClass(a)+'">'+esc(a.message)+'</td></tr>'}
function segCell(x){if(!x||x.slope==null)return '—';return '<b>'+esc(x.slope)+'</b> g/s · R² '+esc(x.r2)+' · '+esc(x.seconds)+'s'}
function renderStability(s){if(!stability)return;const m=s&&s.stage1Startup,st=s&&s.stage3Stability;if(!m&&!st){stability.innerHTML='<span class="small">No S1/S3 stability diagnostics available yet.</span>';return}let h='';if(m){const cls=m.confidence==='INSUFFICIENT'?'bad':m.confidence==='MEDIUM'?'good':'';h+='<div style="margin-bottom:10px"><b>S1 STARTUP</b> · confidence <span class="'+cls+'">'+esc(m.confidence)+'</span><br>First cup rise: <b>'+esc(m.firstRiseDelayS)+' s</b> · 20–80% flow: <b>'+esc(m.midFlowGS)+' g/s</b> · R² '+esc(m.midR2)+' · transit '+esc(m.transit20to80S)+' s · active avg '+esc(m.activeFlowGS)+' g/s · collected '+esc(m.gainG)+' g<br><span class="small">Quality: '+esc(m.qualityReason||'—')+' · 20–80% samples '+esc(m.midSampleCount??'—')+' · active '+esc(m.activeSeconds)+' s</span></div>'}if(st){const sc=st.status==='STABLE'?'good':'bad';h+='<div><b>S3 STABILITY</b> · <span class="'+sc+'">'+esc(st.status)+'</span> · late/early '+esc(st.lateToEarlyRatio)+'<table><tr><th>EARLY 25%</th><th>MID 50%</th><th>LATE 25%</th><th>Stall window</th></tr><tr><td>'+segCell(st.early)+'</td><td>'+segCell(st.mid)+'</td><td>'+segCell(st.late)+'</td><td>'+(st.stall&&st.stall.suspected?'<span class="bad"><b>YES</b> '+esc(st.stall.startS)+'–'+esc(st.stall.endS)+'s · RAW '+esc(st.stall.rawSlopeGS)+' g/s while DE1 '+esc(st.stall.machineFlowMlS)+' ml/s</span>':'<span class="good">none</span>')+'</td></tr></table>'+(Array.isArray(st.shapeFrames)?'<div style="margin-top:8px"><b>LATEST SHOT · S3 FRAME MEASUREMENTS</b><div class="small">The Command column is the command captured for this completed shot, not the current NEXT SHOT profile.</div><table><tr><th>Frame</th><th>SHOT command</th><th>MEASURED RAW regression</th><th>R²</th><th>Window</th></tr>'+st.shapeFrames.map(x=>'<tr><td>'+esc(x.name)+'</td><td>'+esc(x.commandMlS)+' ml/s</td><td>'+esc(x.slope)+' g/s</td><td>'+esc(x.r2)+'</td><td>'+esc(x.seconds)+' s</td></tr>').join('')+'</table></div>':'')+'</div>'}stability.innerHTML=h}
function renderAdvisory(s){if(!advisory)return;const a=s&&s.advisory;if(!a){advisory.innerHTML='<span class="small">No advisory available yet. Run a complete HyperEx shot.</span>';return}advisory.innerHTML='<table><tr><th>Stage</th><th>Confidence</th><th>Action</th><th>Current cmd</th><th>Mid ref</th><th>Reference Range</th><th>Advice</th></tr>'+advisoryRow('S1',a.stage1)+advisoryRow('S2',a.stage2)+advisoryRow('S3',a.stage3)+'</table><div class="small" style="margin-top:8px">Range is deliberately only a partial step toward the theoretical correction. LOW confidence may still show a broad manual-test range; INSUFFICIENT never shows a numeric range.</div>'}
function stageTestRow(label,key,c,a){const mode=(c&&c[key+'Mode'])||'auto',origin=c&&c[key+'Origin']||(mode==='auto'?'original':'retained');const lut=c&&c[key+'LutCommandMlS']!=null?c[key+'LutCommandMlS']:'—',eff=c&&c[key+'CommandMlS']!=null?c[key+'CommandMlS']:lut,editor=key==='stage3'&&c&&c.stage3FlatCommandMlS!=null?c.stage3FlatCommandMlS:eff,shaped=key==='stage3'&&c&&c.s3Shape&&c.s3Shape.enabled,applied=shaped?appliedS3Text(c):esc(eff)+' ml/s',adv=a&&a[key],rr=adv&&adv.referenceRangeMlS&&adv.referenceRangeMlS.length===2?adv.referenceRangeMlS[0]+'–'+adv.referenceRangeMlS[1]:'—',keep=shaped||['adaptive','retained'].includes(origin);return '<tr><td>'+label+'</td><td>'+esc(c&&c[key+'DesiredGS'])+'</td><td>'+esc(lut)+'</td><td>'+esc(rr)+'</td><td><select id="mode_'+key+'">'+(keep?'<option value="keep" selected>'+commandModeLabel(mode,origin)+'</option>':'')+'<option value="auto" '+(!keep&&origin==='original'?'selected':'')+'>ORIGINAL / LUT</option><option value="manual" '+(!keep&&origin==='manual'?'selected':'')+'>MANUAL</option></select></td><td><input id="cmd_'+key+'" type="number" min="0.10" max="8.00" step="0.01" value="'+esc(editor)+'" style="width:85px" data-origin-stage="'+key+'"></td><td><b>'+applied+'</b></td></tr>'}
function shapeSuggestion(c,st){const a=latestNextShotAdaptive&&latestNextShotAdaptive.s3;if(a&&a.usable&&a.suggestedShape){const q=a.suggestedShape;return {early:Number(q.earlyCommand),earlySeconds:Number(q.earlySeconds),mid:Number(q.midCommand),midSeconds:Number(q.midSeconds),late:Number(q.lateCommand),source:'NEXT SHOT ADAPTIVE'}}if(a&&a.action&&String(a.action).includes('REPEAT'))return null;const cur=Number(c&&c.stage3CommandMlS);if(!Number.isFinite(cur))return null;let early=cur,mid=cur,late=cur;if(st&&(st.status==='LATE DECAY'||(st.stall&&st.stall.suspected))){early=Math.max(.10,cur*.97);late=Math.min(8,cur*(st.stall&&st.stall.suspected?1.15:1.08));}return {early:Number(early.toFixed(3)),earlySeconds:8,mid:Number(mid.toFixed(3)),midSeconds:14,late:Number(late.toFixed(3)),source:'FALLBACK'}}
function renderAdaptive(s){
  latestAdaptiveSummary=s||null;
  if(!adaptive)return;
  if(s&&(s.learningReview&&s.learningReview.excluded||s.learningIntegrity&&s.learningIntegrity.eligible===false)){adaptive.innerHTML='<span class="bad">Shot excluded from learning; see history review.</span>';return;}
  const a=s&&s.nextShotAdaptive;
  if(!a){adaptive.innerHTML='<span class="small"><b>WAITING FOR SHOT EVIDENCE</b><br>After STEP 1 calibration is valid, run HyperEx normally. The plugin will collect completed-shot evidence and adjust only the next shot when its safety gates pass.</span>';return}
  const s1=a.s1||{},s2=a.s2||{},s3=a.s3||{},ready=!!a.actionable,st=latestAutoApplyStatus||{};
  const appliedForRun=String(st.runId||'')===String(a.runId||'')&&(st.status==='applied'||st.status==='manual-applied');
  const failedForRun=String(st.runId||'')===String(a.runId||'')&&st.status==='error';
  const scalarRow=(label,x,basis)=>{let measured=x.measuredGS==null?'—':esc(x.measuredGS)+' g/s';if(x.previousGS!=null&&x.currentGS!=null)measured=esc(x.previousGS)+' → '+esc(x.currentGS)+' g/s · mean '+esc(x.measuredGS);let proposed='repeat';if(x.action==='HOLD')proposed='<span class="good"><b>HOLD '+esc(x.currentCommandMlS)+' ml/s</b></span>';else if(x.action==='ADJUST'||x.action==='LUT COMPENSATE')proposed='<b>'+esc(x.suggestedCommandMlS)+' ml/s</b>';else if(x.action)proposed='<b>'+esc(x.action)+'</b>';return '<tr><td>'+label+'</td><td>'+basis+'<br>'+measured+(x.variabilityPct!=null?' · var '+esc(x.variabilityPct)+'%':'')+'</td><td>'+esc(x.currentCommandMlS)+' ml/s</td><td>'+proposed+'</td><td>'+esc(x.confidence||'—')+'</td></tr>'};
  let h='<div class="small">Learning strength: '+esc(a.learningLevel||'—')+'<br>Source run: <b>'+esc(a.runId)+'</b> · <b>'+esc(a.mode)+'</b> · all numeric changes below apply to the <b>NEXT SHOT ONLY</b>.</div><table><tr><th>Stage</th><th>Evidence</th><th>LEARNING seed / fixed command</th><th>NEXT action / command</th><th>Confidence</th></tr>';
  if(latestManualCurveSource&&String(latestManualCurveSource.afterRunId||'')===String(a.runId||''))h='<div class="manualPanel good"><b>下一杯已采用手动曲线。</b> 以下为旧杯分析，尚未作为新曲线效果验证。</div>'+h;
  h+=scalarRow('S1',s1,esc(s1.evidenceBasis||'startup 20–80%'));
  h+=scalarRow('S2',s2,esc(s2.evidenceBasis||'RAW multi-second regression'));
  let s3meas=s3.overallGS==null?'—':('overall '+esc(s3.overallGS)+' g/s');
  if(s3.evidenceBasis)s3meas+='<br>'+esc(s3.evidenceBasis);
  if(s3.levelErrorPct!=null)s3meas+=' · LEVEL error '+esc(s3.levelErrorPct)+'%';
  if(s3.variabilityPct!=null)s3meas+=' · max var '+esc(s3.variabilityPct)+'%';
  let s3shot=(s3.sourceFrames||[]).map(x=>esc(x.commandMlS)).join(' → ')||'—';
  let s3next='<b>'+esc(s3.action||'REPEAT')+'</b>';
  if(s3.normalizedShapeVariabilityPct!=null)s3meas+=' · normalized shape var '+esc(s3.normalizedShapeVariabilityPct)+'%';
  if(s3.suggestedShape){const q=s3.suggestedShape;s3next='<b>'+esc(s3.action)+'<br>'+esc(q.earlyCommand)+' × '+esc(q.earlySeconds)+'s → '+esc(q.midCommand)+' × '+esc(q.midSeconds)+'s → '+esc(q.lateCommand)+'</b>';if(s3.levelFactor!=null)s3next+='<br><span class="small">LEVEL ×'+esc(s3.levelFactor)+' · normalized SHAPE '+(s3.shapeFactors||[]).map(x=>'×'+esc(x)).join(' / ')+'</span>'}
  h+='<tr><td>S3</td><td>'+s3meas+'<br>late/early '+esc(s3.lateToEarlyRatio)+' · '+esc(s3.status||'—')+'</td><td>'+s3shot+'</td><td>'+s3next+'</td><td>'+esc(s3.confidence||'—')+'</td></tr>';
  h+='</table><div class="small" style="margin-top:7px">'+esc(a.note||'')+'<br>S1: '+esc(s1.maxStepRule||'')+'<br>'+esc(s1.reason||'—')+'<br>S2: '+esc(s2.maxStepRule||'')+'<br>'+esc(s2.reason||'—')+'<br>S3: '+esc(s3.maxStepRule||'')+'<br>'+esc(s3.reason||'—')+'</div>';
  const review=s&&s.controlReview;if(review){h+='<div class="manualPanel"><b>本杯控制诊断 · '+esc(review.status)+'</b><div class="small">'+esc(review.note)+' · 杯内状态：'+esc(review.controllerStatus)+'</div>';for(const p of review.phases||[]){const q=p.output||{};h+='<div class="m"><b>'+esc(p.phase==='stage2'?'S2':'S3')+' · '+esc(p.status)+'</b> · 后段误差 '+esc(q.tailErrorPct)+'% · 波动CV '+esc(q.tailRippleCVPct)+'% · 过冲 '+esc(q.tailOvershootPct)+'% · 写入 '+esc(p.writes)+'次<br>'+esc(p.learningStatus)+'</div>';for(const g of p.actionGroups||[])h+='<div class="small">'+esc((g.firstMs/1000).toFixed(1))+'–'+esc((g.lastMs/1000).toFixed(1))+'s · '+esc(g.writes)+'次写入 · '+esc(g.status)+' · '+esc(g.attribution)+'</div>'}h+='</div>'}
  for(const [label,x] of [['S2',s2],['S3',s3]]){const q=x.outputQuality;if(q&&q.available)h+='<div class="small"><b>'+label+' ACTUAL RAW OUTPUT</b> · phase error '+esc(q.wholePhaseErrorPct)+'% · final60% mean '+esc(q.tailMeanGS)+' g/s · error '+esc(q.tailErrorPct)+'% · ripple CV '+esc(q.tailRippleCVPct)+'% · RMSE '+esc(q.tailRMSEGS)+' g/s · overshoot '+esc(q.tailOvershootPct)+'%</div>'}
  const curveSuperseded=latestManualCurveSource&&String(latestManualCurveSource.afterRunId||'')===String(a.runId||'');
  if(curveSuperseded){h+='<div class="manualPanel good"><b>手动曲线已应用到下一杯。</b> 上表保留旧杯算法分析；当前执行以 NEXT SHOT · APPLIED PROFILE 为准。新杯完成后继续自动学习。</div>';}else if(ready){
    if(latestAutoApplyEnabled){
      if(appliedForRun)h+='<div class="row"><span class="good"><b>APPLIED ✓ TO NEXT SHOT</b></span><span class="small" style="align-self:center">Readback and profile sync completed. The NEXT SHOT · APPLIED PROFILE block above is authoritative.</span></div>';
      else if(failedForRun)h+='<div class="row"><span class="bad"><b>NOT APPLIED</b></span><span class="small" style="align-self:center">AUTO APPLY failed safely: '+esc(st.message||'unknown error')+'. Previous profile retained.</span></div>';
      else h+='<div class="row"><span><b>AUTO APPLY ARMED</b></span><span class="small" style="align-self:center">An actionable proposal exists; wait for successful APPLIED readback before treating it as current.</span></div>';
    }else h+='<div class="row"><button id="applynext" class="b primaryAction">APPLY NEXT SHOT</button><span class="small" style="align-self:center">AUTO APPLY is OFF.</span></div>';
  }else h+='<div class="small" style="margin-top:8px"><b>NO NUMERIC CHANGE YET</b> · the plugin keeps the current profile until the required repeated evidence agrees.</div>';
  adaptive.innerHTML=h;
  const q=$('applynext');
  if(q)q.onclick=async()=>{if(!confirm('Apply the bounded NEXT SHOT adaptive suggestion?\\n\\nThis changes only future-shot profile commands. It does NOT modify the calibration LUT and does NOT change a running shot.'))return;try{const r=await post('adaptive-next-apply',{});if(r&&r.verified!==true)throw new Error('server did not verify the applied override');alert('Next-shot suggestion VERIFIED and applied.\\n\\nThe NEXT SHOT · APPLIED PROFILE block is authoritative.');await loadDiag()}catch(e){alert('Apply next shot failed: '+e)}}
}
function renderBasketContext(c){
 const el=$('basketcontext');if(!el)return;const prior=c.baselinePrior||{},stage=c.learningStage||{};
 el.innerHTML='<b>'+esc(stage.stage||'CHECKING BASELINE')+'</b><div>'+esc(stage.message||'Checking calibration and saved empty-basket evidence.')+'</div><div class="small">Empty-basket Step 2: '+esc(stage.emptyShots||0)+' / '+esc(stage.maxEmptyShots||3)+' maximum. '+esc(prior.referenceShots||0)+' empty/pre-upgrade references retained. Starting LUT and bounded commands are kept; normal coffees then refine the next-shot trajectory automatically.</div>';
}
async function readRawWorkflow(){
 const status=$('auditstatus'),out=$('auditjson');if(status)status.textContent='Reading fresh workflow without repair/upload…';
 try{
  const r=await fetch(base+'/adaptive-audit');const a=await r.json();
  if(out)out.value=JSON.stringify(a,null,2);
  if(!r.ok)throw Error(a.error||'Read failed');
  status.textContent='RAW GET /workflow · '+a.serverTime+' · expected current profile match: '+a.workflowMatchesExpected+' · latest proposal match: '+(a.proposalMatchesWorkflow==null?'no actionable proposal':a.proposalMatchesWorkflow)+' · auto apply: '+((a.autoApply||{}).status||'no attempt recorded')+'. Upload acknowledgement is not independent DE1 memory readback.';
 }catch(e){if(status)status.textContent='Raw readback unavailable: '+e}
}
if($('readworkflow'))$('readworkflow').onclick=readRawWorkflow;
function renderAutoApplyBox(){const box=$('autoapplybox');if(!box)return;const on=!!latestAutoApplyEnabled;const st=latestAutoApplyStatus||{};let status=st.message?('<span class="small">Auto apply state: <b>'+esc(st.status||'unknown')+'</b> · '+esc(st.message)+(st.runId?' · '+esc(st.runId):'')+'</span>'):'';box.innerHTML='<div class="row"><button id="autoapplytoggle" class="b '+(on?'primaryAction':'tertiaryAction')+'">AUTO APPLY NEXT SHOT: '+(on?'ON':'OFF')+'</button><span class="small" style="align-self:center">'+(on?'Default mode · verified actionable suggestions apply automatically.':'Manual mode · enter DIAG and press APPLY NEXT SHOT when a numeric suggestion is available.')+'</span></div>'+status;const q=$('autoapplytoggle');if(q)q.onclick=async()=>{const next=!latestAutoApplyEnabled;if(!confirm((next?'Enable':'Disable')+' AUTO APPLY NEXT SHOT?\\n\\n'+(next?'Verified actionable suggestions will apply automatically after completed HyperEx shots.':'The plugin will return to the v0.1.39 manual APPLY NEXT SHOT workflow.')))return;try{const r=await post('adaptive-auto-set',{enabled:next});latestAutoApplyEnabled=!!r.autoApplyNextShot;latestAutoApplyStatus=r.autoApplyLastStatus||null;renderAutoApplyBox();renderAdaptive(latestAdaptiveSummary)}catch(e){alert('AUTO APPLY setting failed: '+e)}}}
function renderS3Shape(c,st){if(!s3shape)return;const saved=c&&c.s3Shape&&c.s3Shape.enabled?c.s3Shape:null;const sug=shapeSuggestion(c,st);const q=saved||sug||{early:c.stage3CommandMlS,earlySeconds:8,mid:c.stage3CommandMlS,midSeconds:14,late:c.stage3CommandMlS};const ap=latestNextShotAdaptive&&latestNextShotAdaptive.s3;const hint=(ap&&ap.action&&(ap.action==='REPEAT SAME SHAPE'||ap.action==='VARIABLE / REPEAT'))?('NEXT SHOT: '+ap.action+' · keep the current shape unchanged until repeated evidence is consistent.'):('Suggested '+(sug&&sug.source==='NEXT SHOT ADAPTIVE'?'from NEXT SHOT ADAPTIVE':'from latest LATE DECAY')+': '+(sug?(sug.early+' × '+sug.earlySeconds+'s → '+sug.mid+' × '+sug.midSeconds+'s → '+sug.late):'—'));s3shape.innerHTML='<b>S3 SHAPE OVERRIDE EDITOR</b> · profile-time only, no extra skipStep<div class="small">'+(saved?'<span class="good"><b>APPLIED SHAPE</b></span> · inputs below are loaded from the current applied override.':'<b>NOT APPLIED</b> · inputs below are only a TEST/PROPOSED editor until APPLY TEST COMMANDS succeeds.')+'</div><table><tr><th>Mode</th><th>EARLY cmd</th><th>EARLY time</th><th>MID cmd</th><th>MID time</th><th>LATE cmd</th></tr><tr><td><select id="s3shape_mode"><option value="off" '+(!saved?'selected':'')+'>FLAT</option><option value="decay" '+(saved?'selected':'')+'>DECAY COMP TEST</option></select></td><td><input id="s3shape_early" type="number" min=".10" max="8" step=".01" value="'+esc(q.earlyCommand??q.early)+'" style="width:76px"></td><td><input id="s3shape_early_s" type="number" min="3" max="30" step="1" value="'+esc(q.earlySeconds)+'" style="width:62px"> s</td><td><input id="s3shape_mid" type="number" min=".10" max="8" step=".01" value="'+esc(q.midCommand??q.mid)+'" style="width:76px"></td><td><input id="s3shape_mid_s" type="number" min="3" max="30" step="1" value="'+esc(q.midSeconds)+'" style="width:62px"> s</td><td><input id="s3shape_late" type="number" min=".10" max="8" step=".01" value="'+esc(q.lateCommand??q.late)+'" style="width:76px"></td></tr></table><div class="small">Commands must be non-decreasing. Adjacent rises are bounded to ≤35% and ≤0.25 ml/s. '+hint+' The shape is enabled automatically only when AUTO APPLY is ON and a verified actionable adaptive suggestion passes all safety checks.</div>'}
function renderTestCommands(c,a){if(!testcommands)return;testcommands.innerHTML='<table><tr><th>Stage</th><th>Target g/s</th><th>LUT cmd</th><th>Ref range</th><th>Editor mode</th><th>Editor flat cmd</th><th>CURRENTLY APPLIED</th></tr>'+stageTestRow('S1','stage1',c,a)+stageTestRow('S2','stage2',c,a)+stageTestRow('S3','stage3',c,a)+'</table><div class="small" style="margin-top:7px">DE1 command hard limit: 0.10–8.00 ml/s. MANUAL changes only the HyperEx profile command; calibration LUT data remains untouched. If S3 DECAY COMP is enabled, its three shape commands override the flat S3 command.</div>';renderS3Shape(c,latestStage3Stability)}
async function applyTestCommands(){const stages={};for(const key of ['stage1','stage2','stage3']){const mode=$('mode_'+key).value;const command=Number($('cmd_'+key).value);if(mode==='manual'&&(!Number.isFinite(command)||command<0.10||command>8.00)){alert(key.toUpperCase()+' manual command must be 0.10–8.00 ml/s.');return}stages[key]={mode,command}}const sm=$('s3shape_mode');const s3Shape={enabled:!!sm&&sm.value==='decay',earlyCommand:Number($('s3shape_early').value),earlySeconds:Number($('s3shape_early_s').value),midCommand:Number($('s3shape_mid').value),midSeconds:Number($('s3shape_mid_s').value),lateCommand:Number($('s3shape_late').value)};if(s3Shape.enabled){if([s3Shape.earlyCommand,s3Shape.midCommand,s3Shape.lateCommand].some(x=>!Number.isFinite(x)||x<.10||x>8)){alert('S3 shape commands must be 0.10–8.00 ml/s.');return}if(s3Shape.earlyCommand>s3Shape.midCommand||s3Shape.midCommand>s3Shape.lateCommand){alert('S3 DECAY COMP commands must be non-decreasing: EARLY ≤ MID ≤ LATE.');return}if(!Number.isFinite(s3Shape.earlySeconds)||s3Shape.earlySeconds<3||s3Shape.earlySeconds>30||!Number.isFinite(s3Shape.midSeconds)||s3Shape.midSeconds<3||s3Shape.midSeconds>30){alert('S3 EARLY/MID times must be 3–30 seconds.');return}}if(!confirm('Apply these TEST commands to HyperEx?\\n\\nS1/S2/manual flat commands are static. S3 DECAY COMP, if enabled, advances only by profile time and adds NO plugin skipStep calls. Calibration LUT remains unchanged. Changes apply to the next normal shot only.'))return;try{const r=await post('test-command-set',{stages,s3Shape,revision:curveLatest&&curveLatest.revision});if(r.verified!==true)throw Error('下一杯曲线未校验');await loadDiag()}catch(e){alert('Apply failed: '+e)}}
async function returnAllToLut(){if(!confirm('Return S1/S2/S3 to AUTO / LUT and clear all manual test overrides, including S3 shape?'))return;try{await post('test-command-clear',{});await loadDiag()}catch(e){alert('Reset failed: '+e)}}

async function loadDiag(){b.style.display='none';copy.style.display='block';diag.style.display='block';t.textContent='DIAGNOSTICS / FLOW CAL';d.textContent='STEP 1 calibrates the physical real-flow LUT. STEP 2 measures every completed shot and automatically adapts S1/S2/S3 for the next shot only. STEP 3 is manual engineering; STEP 4 exports CSV.';try{const jr=await fetch(base+'/diagnostics');if(jr.ok){const j=await jr.json(),s=j.summary||{};renderLiveTrim(j.run);renderCharts(j.run);renderRunCommands(s);if(s.kind==='hyperex'){validation.innerHTML=stat('S1 target / RAW reg',(s.stage1?(esc(s.stage1.desiredRealFlowGS)+' / '+esc(s.stage1.rawRegressionGS)):'—'))+stat('S2 target / RAW reg',(s.stage2?(esc(s.stage2.desiredRealFlowGS)+' / '+esc(s.stage2.rawRegressionGS)):'—'))+stat('S3 target / RAW reg',(s.stage3?(esc(s.stage3.desiredRealFlowGS)+' / '+esc(s.stage3.rawRegressionGS)):'—'));validationtable.innerHTML='<table><tr><th>Stage</th><th>Target g/s</th><th>DE1 Flow</th><th>Decaid</th><th>RAW regression</th><th>R²</th><th>Window</th><th>Status / error</th></tr>'+validationRow('S1',s.stage1)+validationRow('S2',s.stage2)+validationRow('S3',s.stage3)+'</table>';latestAdvisorySummary=s.advisory||null;latestStage3Stability=s.stage3Stability||null;latestNextShotAdaptive=s.nextShotAdaptive||null;renderStability(s);renderAdaptive(s);renderNextDecision(s);renderAdvisory(s)}else{validation.innerHTML=stat('LATEST RUN',s.kind||'calibration');validationtable.innerHTML='<span class="small">Latest diagnostic run is not a HyperEx shot. Run HyperEx to populate current-shot validation.</span>';latestAdvisorySummary=null;latestStage3Stability=null;latestNextShotAdaptive=null;latestAdaptiveSummary=null;if(stability)stability.innerHTML='<span class="small">S1/S3 stability diagnostics are generated only from a HyperEx shot.</span>';if(adaptive)adaptive.innerHTML='<span class="small"><b>NEW INSTALL / NO PREVIOUS SHOT</b><br>Run one complete HyperEx validation shot to generate the first next-shot suggestion.</span>';if(advisory)advisory.innerHTML='<span class="small">Reference advice is generated only from a HyperEx shot.</span>'}stats.innerHTML=stat('RAW SCALE WEIGHT',s.lastRawScaleWeightG??'—')+stat('RAW instantaneous dW/dt',s.lastRawScaleDwDtGS??'—')+stat('Decaid weightFlow',s.lastDecaidWeightFlowGS??'—')+stat('RUN RESULT',s.result||'—')+stat('COMBINED SAMPLES',s.sampleCount||0)+stat('RAW SCALE SAMPLES',s.rawScaleSampleCount||0);m.textContent=(s.result||'')+' · '+(s.sampleCount||0)+' combined · '+(s.rawScaleSampleCount||0)+' raw scale';const cr=await fetch(base+'/diagnostics-csv');if(cr.ok)csv.value=await cr.text();}else{renderRunCommands(null);validation.innerHTML=stat('LAST RUN','none yet');validationtable.innerHTML='';latestAdaptiveSummary=null;if(stability)stability.innerHTML='';if(adaptive)adaptive.innerHTML='<span class="small"><b>NEW INSTALL / NO PREVIOUS SHOT</b><br>Run one complete HyperEx validation shot to generate the first next-shot suggestion.</span>';if(advisory)advisory.innerHTML='';stats.innerHTML=''}}catch(e){if(runcommands)runcommands.innerHTML='<span class="bad">Latest-shot command snapshot unavailable: '+esc(e)+'</span>';validation.innerHTML=stat('DIAG ERROR',esc(e));validationtable.innerHTML='';latestAdaptiveSummary=null;if(stability)stability.innerHTML='';if(adaptive)adaptive.innerHTML='';if(advisory)advisory.innerHTML='';stats.innerHTML=''}await loadCal();await loadAdvancedSettings()}
const flowSvg=$('flowchart');if(flowSvg)flowSvg.onclick=e=>{const q=e.target.closest('[data-tip]');if(q&&$('flowpointdetail'))$('flowpointdetail').textContent=q.getAttribute('data-tip')};const saveAdv=$('saveadvanced');if(saveAdv)saveAdv.onclick=saveAdvancedSettings;$('applytest').onclick=applyTestCommands;$('returnlut').onclick=returnAllToLut;
$('prepare').onclick=async()=>{let c={calibrationModeLabel:'Low Water',calibrationSteps:9,calibrationStepSeconds:7.5,nominalCommandWaterMl:95,recommendedContainerMl:300,calibrationHardStopG:240,primeFlow:3,primeSeconds:3,waterPreflight:{status:'unknown',available:false,message:'Tank level unavailable'}};try{const rr=await fetch(base+'/calibration-status');if(rr.ok)c=await rr.json()}catch(_){}const w=c.waterPreflight||{};if(w.status==='block'){alert('WATER PREFLIGHT BLOCKED.\\n\\n'+(w.message||'DE1 tank level is too close to/below the refill threshold.')+'\\n\\nRefill the tank and try again.');return}let allowUnknown=false;if(w.status==='unknown'||!w.available){if(!confirm('DE1 tank level is unavailable or stale.\\n\\nThe plugin cannot verify tank water automatically. Continue only if you have manually checked the tank.'))return;allowUnknown=true}else if(w.status==='warn'){if(!confirm('DE1 tank water margin is low.\\n\\n'+(w.message||'')+'\\n\\nContinue anyway?'))return}const msg='EMPTY BASKET ONLY · '+c.calibrationModeLabel+' CALIBRATION.\\n\\nPrime '+c.primeFlow+' ml/s × '+c.primeSeconds+' s, then '+c.calibrationSteps+' target/search plateaus × '+c.calibrationStepSeconds+' s.\\nNominal DE1 commanded water: ≈'+c.nominalCommandWaterMl+' ml.\\nActual-water safety stop: ≈'+c.calibrationHardStopG+' g.\\n\\nUse a '+c.recommendedContainerMl+' ml or larger catch vessel.\\nTare the scale, then start Espresso manually. Do not remove the vessel until Idle.\\n\\nContinue?';if(!confirm(msg))return;try{await post('calibration-prepare',{allowUnknownWater:allowUnknown,allowLowMargin:w.status==='warn'});alert(c.calibrationModeLabel+' calibration profile selected. EMPTY BASKET. Tare scale, start Espresso, and leave the vessel in place until Idle.');await loadCal()}catch(e){alert('Prepare failed: '+e)}};
$('sync').onclick=async()=>{try{await post('calibration-sync',{});await loadCal()}catch(e){alert('Sync failed: '+e)}};
$('suggested').onclick=async()=>{try{await post('calibration-use-suggested',{});alert('Suggested multiplier will be used for the NEXT calibration run. Re-run Flow Cal to create a LUT tied to that multiplier.');await loadCal()}catch(e){alert('Action failed: '+e)}};
$('global').onclick=async()=>{if(!confirm('This changes DE1 flowMultiplier globally for ALL profiles. The current value will be saved for Restore. After applying, run Flow Cal again. Continue?'))return;try{await post('calibration-apply-global',{});alert('Global multiplier applied. Run Flow Cal again before using the LUT.');await loadCal()}catch(e){alert('Global apply failed: '+e)}};
$('restore').onclick=async()=>{if(!confirm('Restore the DE1 flowMultiplier saved before the last global apply?'))return;try{await post('calibration-restore-global',{});await loadCal()}catch(e){alert('Restore failed: '+e)}};
$('clearcal').onclick=async()=>{if(!confirm('Clear the saved real-flow LUT? HyperEx will return to direct DE1 flow commands.'))return;try{await post('calibration-clear',{});await loadCal()}catch(e){alert('Clear failed: '+e)}};
async function poll(){try{const r=await fetch(base+'/status');paint(await r.json())}catch(e){}setTimeout(poll,400)}b.onclick=()=>doRearm(false);const exportHistory=$('exporthistory'),historyUrl=$('historyurl');if(exportHistory)exportHistory.onclick=async()=>{const url=location.origin+base+'/history-export';if(historyUrl)historyUrl.innerHTML='<a href="'+url+'" target="_blank" rel="noopener">'+url+'</a>';try{await navigator.clipboard.writeText(url);exportHistory.textContent='URL COPIED'}catch(e){exportHistory.textContent='URL SHOWN BELOW'}setTimeout(()=>{exportHistory.textContent='EXPORT HISTORY JSON'},2500)};const importHistoryBtn=$('importhistory'),importHistoryFile=$('importhistoryfile'),importLutBtn=$('importlut'),importLutFile=$('importlutfile');
async function readJsonFile(f){const text=await f.text();try{return JSON.parse(text)}catch(_){throw new Error('Not a JSON file')}}
async function postJson(endpoint,data){const r=await fetch(base+'/'+endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});let j={};try{j=await r.json()}catch(_){j={error:await r.text()}}if(!r.ok)throw new Error(j.error||('HTTP '+r.status));return j}
function wireImport(button,input,statusId,endpoint,done){if(!button||!input)return;button.onclick=()=>input.click();input.onchange=async()=>{const f=input.files&&input.files[0],st=$(statusId);if(!f)return;try{if(st)st.textContent='IMPORTING…';const data=await readJsonFile(f);const r=await postJson(endpoint,data);if(st)st.textContent=done(r);await loadCal()}catch(e){if(st)st.textContent='IMPORT FAILED: '+String(e)}finally{input.value=''}}}
wireImport(importHistoryBtn,importHistoryFile,'historyimportstatus','history-import',r=>'IMPORTED '+r.imported+' new · '+r.replaced+' replaced · '+r.total+' stored'+(r.persisted?'':' (memory only; storage not verified)'));
wireImport(importLutBtn,importLutFile,'lutimportstatus','calibration-import',r=>'LUT IMPORTED · '+r.points+' points · '+r.range[0]+'..'+r.range[1]+' g/s · '+(r.usable?'USABLE':'NOT USABLE: '+(r.staleReason||'out of range')));
const importUrl=$('importurl'),importUrlBtn=$('importurlbtn');
if(importUrl&&!importUrl.value)importUrl.value=location.origin+base+'/history-export';
if(importUrlBtn)importUrlBtn.onclick=async()=>{const st=$('importurlstatus'),url=(importUrl&&importUrl.value||'').trim();if(!url){if(st)st.textContent='URL REQUIRED';return}try{if(st)st.textContent='READING URL…';const res=await fetch(url,{cache:'no-store'});if(!res.ok)throw new Error('HTTP '+res.status);const data=await res.json();if(st)st.textContent='IMPORTING…';const hist=await postJson('history-import',data);let lut=null;try{lut=await postJson('calibration-import',data)}catch(e){lut={error:String(e)}}if(st)st.textContent='HISTORY '+hist.imported+' new · '+hist.replaced+' replaced · '+hist.total+' stored | LUT '+(lut.error?('SKIPPED: '+lut.error):(lut.points+' points · '+lut.range[0]+'..'+lut.range[1]+' g/s · '+(lut.usable?'USABLE':'NOT USABLE')));await loadCal()}catch(e){if(st)st.textContent='IMPORT FAILED: '+String(e)}};
copy.onclick=async()=>{csv.focus();csv.select();try{await navigator.clipboard.writeText(csv.value);copy.textContent='COPIED'}catch(e){document.execCommand('copy');copy.textContent='SELECTED / COPIED'}setTimeout(()=>copy.textContent='COPY CSV',1200)};function dashboardBack(){if(window.history&&window.history.length>1){window.history.back();return}homeFallback()}function homeFallback(){try{if(window.top&&window.top!==window&&window.top.history&&window.top.history.length>1){window.top.history.back();return}}catch(_){}if(window.history&&window.history.length>2){window.history.go(-2);return}if(window.history&&window.history.length>1){window.history.back();return}}function closeUi(){try{if(window.parent&&window.parent!==window)window.parent.postMessage({type:'streamline:close'},'*')}catch(_){}setTimeout(dashboardEntry?dashboardBack:homeFallback,280)}$('close').textContent=diagView?'CLOSE / HOME':'CLOSE';$('close').onclick=closeUi;const closeTop=$('close-top');if(closeTop){closeTop.textContent=diagView?'CLOSE / HOME':'CLOSE';closeTop.onclick=closeUi;}const jumpWeight=$('jump-weight');if(jumpWeight){if(!diagView)jumpWeight.style.display='none';else jumpWeight.onclick=()=>{const target=$('weight-curves');if(target)target.scrollIntoView({behavior:'smooth',block:'start'});};}if(diagView){loadDiag()}else if(view==='rearm'){doRearm(true)}else{poll()}
</script></body></html>`;
  }

  function startGhcCountdown() {
    clearTimer("ghcCountdownTimer");
    state.ghcPromptStartedAtMs = Date.now();
    const total = Math.max(1, state.cfg.ghcConfirmTimeoutSeconds);
    let lastLogged = null;
    let lastUi = null;

    const tick = () => {
      if (state.phase !== "restart_wait") return;
      const elapsed = (Date.now() - state.ghcPromptStartedAtMs) / 1000;
      const remaining = Math.max(0, Math.ceil(total - elapsed));
      state.ghcSecondsRemaining = remaining;
      const message = `CHECK PINK: ON -> PRESS GHC / OFF -> RE-ARM — ${remaining}s`;
      emitGhcPrompt("waiting", remaining, message);
      if (remaining !== lastUi) { emitSkinChanged(); lastUi = remaining; }

      const shouldLog = remaining === Math.ceil(total) || remaining === 15 || remaining === 10 || remaining <= 5;
      if (shouldLog && remaining !== lastLogged) {
        log(`>>> ${message} <<<`);
        lastLogged = remaining;
      }

      if (remaining > 0 && state.phase === "restart_wait") {
        state.ghcCountdownTimer = setTimeout(tick, 250);
      }
    };

    tick();
  }

  function clearTimer(name) {
    if (state[name] !== null && state[name] !== undefined) {
      clearTimeout(state[name]);
      state[name] = null;
    }
  }

  function clearAllTimers() {
    stopLiveTrim("cancelled");
    cancelDirectStartTest();
    clearTimer("dumpTimer");
    clearTimer("dumpSettleTimer");
    clearTimer("dumpFallbackTimer");
    clearTimer("idlePollTimer");
    clearTimer("soakTimer");
    clearTimer("noScaleTimer");
    clearTimer("maxRunTimer");
    clearTimer("restartSkipTimer");
    clearTimer("restartPollTimer");
    clearTimer("restartTimeoutTimer");
    clearTimer("ghcCountdownTimer");
    clearTimer("soakCountdownTimer");
    clearTimer("armReinforceTimer");
    clearTimer("armReinforceTimer2");
    clearTimer("autoApplyTimer");
    clearTimer("completionTimer");
    clearTimer("abortResetTimer");
    clearTimer("flowStripTimer");
  }

  function profileObject() {
    const c = state.cfg;
    const s1 = clampCommandFlow(resolvedStageCommandFlow("stage1", c.stage1Flow));
    const s2 = clampCommandFlow(resolvedStageCommandFlow("stage2", c.stage2Flow));
    const s3 = clampCommandFlow(resolvedStageCommandFlow("stage3", c.stage3Flow));
    const safePressure = value => clampNumber(value, LIMITS.pressureMin, Math.min(LIMITS.pressureMax, c.hardPressureLimit), LIMITS.pressureMin);
    const p1 = safePressure(c.stage1PressureLimit), p2 = safePressure(c.stage2PressureLimit), p3 = safePressure(c.stage3PressureLimit);
    const summary = commandFlowSummary();
    const manualStages = Array.isArray(summary.manualTestActiveStages) ? summary.manualTestActiveStages : [];
    const shape = s3ShapeStatus();
    const manualNote = manualStages.length
      ? ` Command overrides active for ${manualStages.map(x => x.toUpperCase()).join("/")}; per-stage origins are shown in diagnostics; saved LUT is unchanged.`
      : ` All stages ORIGINAL / LUT.`;
    const calNote = state.calibrationMapUsable
      ? `Scale-calibrated real-flow feed-forward. Effective commands: ${s1.toFixed(3)}/${s2.toFixed(3)}/${(shape.enabled ? shape.midCommand : s3).toFixed(3)} ml/s at flowMultiplier ${Number(calibrationBaseMultiplier()).toFixed(3)}.${manualNote}`
      : `Direct bounded DE1 flow feed-forward; calibration LUT inactive (${state.calibrationMapStaleReason || "not available"}).${manualNote}`;
    const steps = [
      {
        name: `S1 real ${c.stage1Flow.toFixed(2)} g/s`,
        temperature: c.temperature.toFixed(1), sensor: "coffee", pump: "flow", transition: "fast", pressure: "",
        flow: s1.toFixed(3), seconds: "120", volume: "0", weight: "0",
        limiter: { value: p1.toFixed(2), range: Math.max(0.1, p1 * 0.1).toFixed(2) }
      },
      {
        name: `S2 real ${c.stage2Flow.toFixed(2)} g/s`,
        temperature: c.temperature.toFixed(1), sensor: "coffee", pump: "flow", transition: "fast", pressure: "",
        flow: s2.toFixed(3), seconds: "180", volume: "0", weight: "0",
        limiter: { value: p2.toFixed(2), range: Math.max(0.1, p2 * 0.1).toFixed(2) }
      }
    ];
    if (shape.enabled) {
      steps.push(
        {
          name: `S3 EARLY real ${c.stage3Flow.toFixed(2)} g/s`,
          temperature: c.temperature.toFixed(1), sensor: "coffee", pump: "flow", transition: "fast", pressure: "",
          flow: clampCommandFlow(shape.earlyCommand).toFixed(3), seconds: clampNumber(shape.earlySeconds,3,30,8).toFixed(1), volume: "0", weight: "0",
          limiter: { value: p3.toFixed(2), range: Math.max(0.1, p3 * 0.1).toFixed(2) }
        },
        {
          name: `S3 MID real ${c.stage3Flow.toFixed(2)} g/s`,
          temperature: c.temperature.toFixed(1), sensor: "coffee", pump: "flow", transition: "fast", pressure: "",
          flow: clampCommandFlow(shape.midCommand).toFixed(3), seconds: clampNumber(shape.midSeconds,3,30,14).toFixed(1), volume: "0", weight: "0",
          limiter: { value: p3.toFixed(2), range: Math.max(0.1, p3 * 0.1).toFixed(2) }
        },
        {
          name: `S3 LATE real ${c.stage3Flow.toFixed(2)} g/s`,
          temperature: c.temperature.toFixed(1), sensor: "coffee", pump: "flow", transition: "fast", pressure: "",
          flow: clampCommandFlow(shape.lateCommand).toFixed(3), seconds: "180", volume: "0", weight: "0",
          limiter: { value: p3.toFixed(2), range: Math.max(0.1, p3 * 0.1).toFixed(2) }
        }
      );
    } else {
      steps.push({
        name: `S3 real ${c.stage3Flow.toFixed(2)} g/s`,
        temperature: c.temperature.toFixed(1), sensor: "coffee", pump: "flow", transition: "fast", pressure: "",
        flow: s3.toFixed(3), seconds: "180", volume: "0", weight: "0",
        limiter: { value: p3.toFixed(2), range: Math.max(0.1, p3 * 0.1).toFixed(2) }
      });
    }
    if (steps.length > LIMITS.maxProfileFrames) throw new Error(`HyperEx profile would contain ${steps.length} frames; DE1 limit is ${LIMITS.maxProfileFrames}`);
    return {
      title: c.profileTitle,
      author: "ladiosupp / HyperEx",
      notes: `DE1XL v1.50 HyperEx pulse filtration. User flow settings mean desired cup-scale mass flow (g/s). ${calNote} ${activeReleaseEnabled(c)?"Active release mode: Idle at S1 weight, soak, GHC restart, one skip to S2 and one weight skip to S3.":"Continuous mode: one Espresso; one S1-weight skip to S2, one S2-weight skip to S3; no intermediate Idle/soak/restart."} Optional S3 DECAY COMP uses only natural profile-time transitions inside S3; no extra plugin skipStep calls. Final stop is by Idle. Current-shot regression is advisory only.`,
      beverage_type: "espresso",
      steps,
      tank_temperature: "0", target_weight: "0", target_volume: "0", target_volume_count_start: "0",
      legacy_profile_type: "settings_2c", type: "flow", lang: "en", hidden: "0",
      reference_file: "hyperex_pulse_filter", changes_since_last_espresso: "", version: "2"
    };
  }

  function calibrationProfileObject(mode) {
    const c = state.cfg;
    const normalizedMode = normalizeCalibrationMode(mode || state.calibrationMode);
    const wp = calibrationWaterPlan(normalizedMode);
    const program = calibrationProgram(normalizedMode);
    const calPressure = clampNumber(6.0, LIMITS.pressureMin, Math.min(LIMITS.pressureMax, c.hardPressureLimit), Math.min(6.0, c.hardPressureLimit));
    const calibrationFrameCount = program.length + (wp.primeSeconds > 0 ? 1 : 0);
    if (calibrationFrameCount > LIMITS.maxProfileFrames) throw new Error(`Calibration profile would contain ${calibrationFrameCount} frames; DE1 limit is ${LIMITS.maxProfileFrames}`);
    return {
      title: calibrationProfileTitle(normalizedMode),
      author: "ladiosupp / HyperEx",
      notes: `EMPTY BASKET ONLY. HyperEx v${PLUGIN_VERSION} ${wp.modeLabel} real-flow calibration. Prime ${wp.primeFlow.toFixed(2)} ml/s × ${wp.primeSeconds.toFixed(1)} s, then ${wp.steps} ${wp.algorithm === "target-lut" ? "target-search" : "calibration"} plateaus × ${wp.stepSeconds.toFixed(1)} s; nominal DE1 commanded water ≈${wp.nominalCommandWaterMl} ml. Use a ${wp.recommendedContainerMl} ml or larger catch vessel. The plugin actively stops calibration at about ${wp.hardStopG} g actual collected water to preserve margin below 300 ml. Tank level is checked before PREPARE when live DE1 water-level telemetry is available. Tare the scale, start Espresso manually, and leave the vessel in place until Idle.`,
      beverage_type: "espresso",
      steps: [
        ...(wp.primeSeconds > 0 ? [{
          name: `CAL PRIME - ${wp.primeFlow.toFixed(2)} ml/s`,
          temperature: c.temperature.toFixed(1), sensor: "coffee", pump: "flow", transition: "fast", pressure: "",
          flow: wp.primeFlow.toFixed(2), seconds: wp.primeSeconds.toFixed(1), volume: "0", weight: "0",
          limiter: { value: calPressure.toFixed(2), range: Math.max(0.1, calPressure * 0.1).toFixed(2) }
        }] : []),
        ...program.map((step, i) => ({
          name: wp.algorithm === "target-lut"
            ? `CAL ${step.blockId} target ${Number(step.targetReal).toFixed(1)} - cmd ${Number(step.commandFlow).toFixed(2)}`
            : `CAL ${wp.modeLabel.toUpperCase()} ${i + 1}/${program.length} - ${Number(step.commandFlow).toFixed(2)} ml/s`,
          temperature: c.temperature.toFixed(1), sensor: "coffee", pump: "flow", transition: "fast", pressure: "",
          flow: Number(step.commandFlow).toFixed(2), seconds: Number(step.seconds).toFixed(1), volume: "0", weight: "0",
          limiter: { value: calPressure.toFixed(2), range: Math.max(0.1, calPressure * 0.1).toFixed(2) }
        }))
      ],
      tank_temperature: "0", target_weight: "0", target_volume: "0", target_volume_count_start: "0",
      legacy_profile_type: "settings_2c", type: "flow", lang: "en", hidden: "0",
      reference_file: `hyperex_flow_calibration_${wp.mode}`, changes_since_last_espresso: "", version: "2"
    };
  }

  async function api(path, options) {
    const response = await fetch(`${API}${path}`, options || {});
    if (!response.ok) {
      let body = "";
      try { body = await response.text(); } catch (_) {}
      throw new Error(`${options && options.method ? options.method : "GET"} ${path} -> HTTP ${response.status}${body ? `: ${body.slice(0, 240)}` : ""}`);
    }
    return response;
  }

  function canonicalProfileValue(value) {
    if (Array.isArray(value)) return value.map(canonicalProfileValue);
    if (value && typeof value === "object") {
      const out = {};
      for (const key of Object.keys(value).sort()) out[key] = canonicalProfileValue(value[key]);
      return out;
    }
    return value;
  }

  function profilesEquivalent(a, b) {
    // Compare the content Decaid actually retains, rather than import-only keys.
    // Source: decentespresso/decaid, lib/src/models/data/profile.dart
    const stored = profile => profile && typeof profile === 'object' ? {
      title:String(profile.title || ''), author:String(profile.author || ''), notes:String(profile.notes || ''),
      execution:normalizedProfileExecution(profile)
    } : null;
    try { return JSON.stringify(stored(a)) === JSON.stringify(stored(b)); }
    catch (_) { return false; }
  }

  function normalizedProfileExecution(profile) {
    if (!profile || typeof profile !== "object") return null;
    const num = value => {
      if (value === null || value === undefined || value === '') return null;
      const v = Number(value);
      return Number.isFinite(v) ? round(v, 5) : String(value);
    };
    const steps = Array.isArray(profile.steps) ? profile.steps.map(step => {
      const q = step || {};
      const pump = String(q.pump || '');
      return {
        name:String(q.name || ''), temperature:num(q.temperature), sensor:String(q.sensor || ''),
        pump, transition:String(q.transition || ''),
        // Flow steps do not serialize unused pressure, and pressure steps do not
        // serialize unused flow. Compare only the actuator used by that step.
        ...(pump === 'flow' ? {flow:num(q.flow)} : pump === 'pressure' ? {pressure:num(q.pressure)} : {flow:num(q.flow),pressure:num(q.pressure)}),
        seconds:num(q.seconds), volume:num(q.volume), weight:num(q.weight),
        limiter:q.limiter ? {value:num(q.limiter.value),range:num(q.limiter.range)} : null,
        // Exit conditions affect execution and MUST survive equivalence checks.
        exit:q.exit ? {type:String(q.exit.type || ''),condition:String(q.exit.condition || ''),value:num(q.exit.value)} : null
      };
    }) : [];
    return {
      beverage_type:String(profile.beverage_type || ''), steps,
      tank_temperature:num(profile.tank_temperature), target_weight:num(profile.target_weight),
      target_volume:num(profile.target_volume), target_volume_count_start:num(profile.target_volume_count_start),
      version:num(profile.version)
      // Decaid's Profile.toJson intentionally omits legacy_profile_type and type.
    };
  }

  function profileExecutionDifferences(actual, expected) {
    const differences = [];
    const visit = (a, e, field) => {
      if (JSON.stringify(a) === JSON.stringify(e)) return;
      if (a && e && typeof a === 'object' && typeof e === 'object' && Array.isArray(a) === Array.isArray(e)) {
        const keys = Array.from(new Set(Object.keys(e).concat(Object.keys(a))));
        for (const key of keys) visit(a[key],e[key],Array.isArray(e) ? `${field}[${key}]` : (field ? `${field}.${key}` : key));
      } else differences.push({field:field || 'profile',expected:e === undefined ? null : e,actual:a === undefined ? null : a});
    };
    visit(normalizedProfileExecution(actual),normalizedProfileExecution(expected),'');
    if (String(actual && actual.title || '') !== String(expected && expected.title || '')) differences.unshift({field:'title',expected:expected && expected.title || null,actual:actual && actual.title || null});
    return differences;
  }

  function profileExecutionEquivalent(a, b) {
    try {
      return JSON.stringify(normalizedProfileExecution(a)) === JSON.stringify(normalizedProfileExecution(b));
    } catch (_) {
      return false;
    }
  }

  function profileCommandSummaryFromProfile(profile) {
    if (!profile || !Array.isArray(profile.steps) || profile.steps.length < 3) return null;
    const flow = step => { const v = Number(step && step.flow); return Number.isFinite(v) ? round(v, 3) : null; };
    const steps = profile.steps;
    const s3steps = steps.slice(2);
    const shape = s3steps.length >= 3;
    return {
      title: String(profile.title || ""),
      stage1CommandMlS: flow(steps[0]),
      stage2CommandMlS: flow(steps[1]),
      stage3Mode: shape ? "shape" : "flat",
      stage3CommandMlS: shape ? flow(s3steps[1]) : flow(s3steps[0]),
      s3Shape: shape ? {
        enabled: true,
        earlyCommand: flow(s3steps[0]), earlySeconds: round(Number(s3steps[0] && s3steps[0].seconds),1),
        midCommand: flow(s3steps[1]), midSeconds: round(Number(s3steps[1] && s3steps[1].seconds),1),
        lateCommand: flow(s3steps[2])
      } : { enabled:false }
    };
  }

  function runtimeProfileTruthPayload() {
    const expected = state.cfg ? profileObject() : null;
    const actual = state.workflowProfile;
    return {
      selectedTitle: state.workflowTitle || "",
      verified: !!state.runtimeProfileVerified,
      readbackAt: state.profileReadbackAt,
      machineUploadAcknowledged: !!state.machineProfileAckKey,
      machineProfileIndependentlyReadBack: false,
      status: state.runtimeProfileStatus || "not verified",
      expected: expected ? profileCommandSummaryFromProfile(expected) : null,
      actual: actual ? profileCommandSummaryFromProfile(actual) : null,
      differences: expected ? profileExecutionDifferences(actual, expected) : []
    };
  }

  async function readWorkflowProfile() {
    const response = await api('/workflow', { method: 'GET' });
    const body = await response.json();
    state.profileReadbackAt = new Date().toISOString();
    return body && body.profile && typeof body.profile === 'object' ? body.profile : null;
  }

  function invalidateProfileTruth(reason, clearMachineAck) {
    state.runtimeProfileVerified = false;
    state.armed = false;
    state.runtimeProfileStatus = reason || 'verification required';
    if (clearMachineAck) state.machineProfileAckKey = "";
  }

  function noteMultiplierChange(value) {
    const previous = finiteOrNull(state.flowMultiplierCurrent);
    if (previous !== null && Math.abs(previous - value) > 0.0001) {
      state.adaptiveHistory = [];
      state.persistentHistoryCompatibleCount = 0;
      invalidateProfileTruth('flowMultiplier changed; fresh verification required', true);
      if (state.diagnosticCurrent && state.diagnosticCurrent.kind === 'hyperex') state.diagnosticCurrent.config.profileTruthVerified = false;
    }
  }

  function profileSyncIsIdle() {
    return state.phase === 'idle' && !state.calibrationActive && state.lastMachineState !== 'espresso';
  }

  function workflowBrewTemperature(profile) {
    if(!state.cfg||!profile||profile.title!==state.cfg.profileTitle||!Array.isArray(profile.steps)||profile.steps.length<3||profile.steps.length>LIMITS.maxProfileFrames)return null;
    const temps=profile.steps.map(step=>finiteOrNull(step&&step.temperature));
    if(temps.some(v=>v===null||v<LIMITS.temperatureMin||v>LIMITS.temperatureMax))return null;
    const value=temps[0];
    return temps.every(v=>Math.abs(v-value)<0.001)?value:null;
  }

  function adoptWorkflowBrewTemperature(profile,fromNotification) {
    if(!profileSyncIsIdle())return false; // Never change an active shot's frozen temperature.
    const value=workflowBrewTemperature(profile);
    if(value===null||Math.abs(value-state.cfg.temperature)<0.001)return false;
    const previous=state.cfg.temperature;
    state.cfg.temperature=value;
    refreshLearningStage();
    if(fromNotification){
      // Also cancel in-flight sync of an older temperature before its next write.
      state.workflowSelectionRevision++;
      state.temperatureRecheckNeeded=true;
    }
    log(`Home/profile brew temperature accepted: ${previous} -> ${value} °C; fresh verification required.`);
    return true;
  }

  function recheckHomeTemperatureIfNeeded() {
    if(!state.temperatureRecheckNeeded||state.runtimeProfileRepairBusy||state.profileVerificationPending||!profileSyncIsIdle())return;
    state.temperatureRecheckNeeded=false;state.profileVerificationRetryAtMs=0;
    scheduleProfileVerification('home temperature changed during synchronization');
  }

  function checkProfileSelection(revision) {
    if (!profileSyncIsIdle()) throw new Error('Profile sync blocked while shot or calibration is active');
    if (state.workflowTitle !== state.cfg.profileTitle || state.workflowSelectionRevision !== revision) throw new Error('Workflow selection changed during verification');
  }

  function checkProfileSyncContext(profile, revision) {
    checkProfileSelection(revision);
    if (!profileExecutionEquivalent(profile, profileObject())) throw new Error('Expected profile changed during verification; retry required');
  }

  async function verifyAndRepairSelectedHyperExProfile(reason) {
    if (!state.cfg || state.workflowTitle !== state.cfg.profileTitle) return;
    return syncHyperExProfile(true, reason || 'workflow verification');
  }

  function scheduleProfileVerification(reason) {
    if (!state.cfg || state.workflowTitle !== state.cfg.profileTitle || state.runtimeProfileRepairBusy || state.profileVerificationPending || Date.now() < state.profileVerificationRetryAtMs || !profileSyncIsIdle()) return;
    state.profileVerificationPending = true;
    state.profileVerificationRetryAtMs = Date.now() + 3000;
    verifyAndRepairSelectedHyperExProfile(reason).catch(error => {
      invalidateProfileTruth(`verification failed: ${error.message || error}`, true);
      log(state.runtimeProfileStatus);
      emitSkinChanged();
    }).finally(() => { state.profileVerificationPending = false; recheckHomeTemperatureIfNeeded(); });
  }

  async function upsertProfile(profile) {
    const title = profile && profile.title ? String(profile.title) : "";
    if (!title) throw new Error("profile title missing");
    let records = [];
    try {
      const listResponse = await api('/profiles?includeHidden=true', { method: 'GET' });
      const body = await listResponse.json();
      if (Array.isArray(body)) records = body;
    } catch (error) {
      log(`Profile list read failed before upsert '${title}': ${error.message || error}`);
    }
    const matching = records.filter(r => r && r.profile && String(r.profile.title || '') === title && r.visibility !== 'deleted');
    if (matching.length) {
      const exact = matching.find(r => profilesEquivalent(r.profile, profile));
      if (exact) {
        log(`Profile '${title}' already current; Decaid write skipped.`);
        return exact;
      }
      const chosen = matching.find(r => !r.isDefault) || matching[0];
      const response = await api(`/profiles/${encodeURIComponent(chosen.id)}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile })
      });
      const updated = await response.json();
      return updated;
    }
    const response = await api('/profiles', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile })
    });
    return await response.json();
  }

  async function ensureProfileInstalled() {
    try { await syncHyperExProfile(false); }
    catch (error) { state.profileSyncStatus = `HyperEx profile sync failed: ${error.message || error}`; log(state.profileSyncStatus); }
  }

  async function hideLegacyCalibrationProfile() {
    const legacyTitle = state.cfg ? String(state.cfg.calibrationProfileTitle || "") : "";
    if (!legacyTitle || isCalibrationProfileTitle(legacyTitle)) return;
    try {
      const listResponse = await api('/profiles?includeHidden=true', { method: 'GET' });
      const records = await listResponse.json();
      if (!Array.isArray(records)) return;
      const legacy = records.filter(r => r && r.profile && String(r.profile.title || '') === legacyTitle && r.visibility === 'visible');
      for (const rec of legacy) {
        if (!rec.id) continue;
        await api(`/profiles/${encodeURIComponent(rec.id)}/visibility`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visibility: 'hidden' })
        });
        log(`Legacy single calibration profile '${legacyTitle}' hidden after dual-profile migration.`);
      }
    } catch (error) {
      log(`Legacy calibration profile migration skipped: ${error.message || error}`);
    }
  }

  async function ensureCalibrationProfilesInstalled() {
    for (const mode of ['low', 'full']) {
      try {
        const profile = calibrationProfileObject(mode);
        const rec = await upsertProfile(profile);
        state.calibrationProfileIds[mode] = rec && rec.id ? rec.id : state.calibrationProfileIds[mode];
        log(`Calibration profile '${profile.title}' installed/updated.`);
      } catch (error) {
        log(`Calibration profile ${calibrationModeConfig(mode).label} auto-install failed: ${error.message || error}`);
      }
    }
    await hideLegacyCalibrationProfile();
  }

  function syncHyperExProfile(updateCurrentWorkflow, reason) {
    if (!profileSyncIsIdle()) return Promise.reject(new Error('Profile writes blocked during an active shot'));
    if (updateCurrentWorkflow && state.workflowTitle === (state.cfg && state.cfg.profileTitle)) invalidateProfileTruth('waiting for fresh workflow readback', false);
    const task = state.profileSyncQueue.catch(() => {}).then(() => performHyperExProfileSync(updateCurrentWorkflow, reason));
    state.profileSyncQueue = task.catch(() => {});
    return task;
  }

  async function requireIdleMachineForProfileSync() {
    const machine = extractMachine(await getMachineSnapshot());
    if (!machine.machineState || machine.machineState === 'espresso') throw new Error('Machine is busy or state is unavailable; profile writes blocked');
    if (!profileSyncIsIdle()) throw new Error('Shot began during profile verification');
  }

  async function performHyperExProfileSync(updateCurrentWorkflow, reason) {
    if (!profileSyncIsIdle()) throw new Error('Profile writes blocked during an active shot');
    const selected = !!(updateCurrentWorkflow && state.workflowTitle === state.cfg.profileTitle);
    const revision = state.workflowSelectionRevision;
    state.runtimeProfileRepairBusy = selected;
    try {
      if (selected) {
        invalidateProfileTruth('checking fresh workflow / multiplier readback', false);
        await requireIdleMachineForProfileSync();
        checkProfileSelection(revision);
        if (!state.calibrationStorageLoaded || !state.overrideStorageLoaded || !state.s2RefillStorageLoaded || !state.scopeStorageLoaded || !state.scopedOriginalStorageLoaded || !state.learningContextLoaded) throw new Error('Waiting for stored calibration and overrides / multiplier scope / history context');
        if (state.scopeMode === 'hyperex') {
          if (state.scopeChangeBusy) throw new Error('Scoped multiplier change still pending');
          await enterHyperExScopedMultiplier('profile verification', revision);
          checkProfileSelection(revision);
        }
        const multiplier = await refreshFlowMultiplier(true, true);
        recomputeCalibrationUsability();
        if (!state.calibrationMapUsable || !multiplierClose(multiplier, calibrationBaseMultiplier())) throw new Error('Valid LUT and matching actual multiplier required before arming');
      }
      recomputeCalibrationUsability();
      // Read the selected workflow BEFORE generating/upserting a replacement.
      // The home page persists its temperature in the profile itself; no second store.
      let actual=null;
      if(selected){
        actual=await readWorkflowProfile();checkProfileSelection(revision);
        if(!actual||actual.title!==state.cfg.profileTitle)throw new Error('GET /workflow no longer selects HyperEx');
        adoptWorkflowBrewTemperature(actual,false);
      }
      const profile = profileObject();
      if (selected) checkProfileSyncContext(profile, revision);
      const rec = await upsertProfile(profile);
      state.hyperExProfileId = rec && rec.id ? rec.id : state.hyperExProfileId;
      if (selected) {
        checkProfileSyncContext(profile, revision);
        state.workflowProfile = actual;
        checkProfileSyncContext(profile, revision);
        if (!actual || actual.title !== state.cfg.profileTitle) throw new Error('GET /workflow no longer selects HyperEx');
        const changed = !profileExecutionEquivalent(actual, profile);
        if (changed) {
          state.machineProfileAckKey = "";
          await requireIdleMachineForProfileSync();
          checkProfileSyncContext(profile, revision);
          await api('/workflow', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({profile}) });
          checkProfileSyncContext(profile, revision);
        }
        const key = JSON.stringify(normalizedProfileExecution(profile));
        if (changed || state.machineProfileAckKey !== key) {
          // HTTP success acknowledges upload; this is not independent DE1 memory readback.
          await requireIdleMachineForProfileSync();
          checkProfileSyncContext(profile, revision);
          await api('/machine/profile', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(profile) });
          checkProfileSyncContext(profile, revision);
          state.machineProfileAckKey = key;
        }
        const readback = await readWorkflowProfile();
        state.workflowProfile = readback;
        checkProfileSyncContext(profile, revision);
        if (!readback || readback.title !== state.cfg.profileTitle || !profileExecutionEquivalent(readback, profile)) {
          const differences = profileExecutionDifferences(readback, profile);
          log(`Workflow execution mismatch details: ${JSON.stringify(differences)}`);
          const detail = differences.slice(0,6).map(d => `${d.field}: expected ${JSON.stringify(d.expected)}, actual ${JSON.stringify(d.actual)}`).join('; ');
          throw new Error(`Final GET /workflow does not match expected LUT/adaptive profile${detail ? ': '+detail : ''}`);
        }
        const multiplier = await refreshFlowMultiplier(true, true);
        checkProfileSyncContext(profile, revision);
        if (!multiplierClose(multiplier, calibrationBaseMultiplier()) || state.machineProfileAckKey !== key) throw new Error('Multiplier or machine upload acknowledgement changed during verification');
        state.temperatureRecheckNeeded=false;
        state.runtimeProfileVerified = true;
        state.profileReadbackAt = new Date().toISOString();
        state.runtimeProfileStatus = `GET /workflow verified; machine upload acknowledged (${reason || 'sync'})`;
        state.runtimeProfileMismatchAbortSent = false;
        state.armed = !!state.cfg.enabled;
        restoreAdaptiveHistoryFromPersistentFile();
      }
      state.profileSyncStatus = `HyperEx profile synced ${new Date().toISOString()}`;
      emitSkinChanged();
      return rec;
    } catch (error) {
      if (selected) invalidateProfileTruth(`verification failed: ${error.message || error}`, true);
      state.profileSyncStatus = `HyperEx sync failed: ${error.message || error}`;
      emitSkinChanged();
      throw error;
    } finally { state.runtimeProfileRepairBusy = false; recheckHomeTemperatureIfNeeded(); }
  }

  async function prepareCalibrationProfile(options) {
    const opts = options && typeof options === 'object' ? options : {};
    const preflight = waterPreflightStatus();
    if (preflight.status === 'block') throw new Error(`Water preflight blocked: ${preflight.message}`);
    if (preflight.status === 'unknown' && opts.allowUnknownWater !== true) throw new Error(`Water preflight unavailable: ${preflight.message}`);
    if (preflight.status === 'warn' && opts.allowLowMargin !== true) throw new Error(`Water preflight warning: ${preflight.message}`);
    state.calibrationWaterPreflightApprovedUntilMs = Date.now() + 10 * 60 * 1000;
    const current = await refreshFlowMultiplier(true);
    let base = finiteOrNull(state.calibrationPendingMultiplier);
    if (!Number.isFinite(base)) base = Number(current);
    if (!Number.isFinite(base)) throw new Error('Cannot determine current DE1 flowMultiplier');
    state.calibrationPendingMultiplier = base;
    storageWrite(STORAGE_PENDING_MULT, String(base));

    // HyperEx-only scope may temporarily move the machine to the pending calibration
    // multiplier. OFF never writes it; GLOBAL uses whatever is already globally set.
    if (state.scopeMode === 'hyperex') {
      if (finiteOrNull(state.scopedOriginalMultiplier) === null) { state.scopedOriginalMultiplier = current; storageWrite(STORAGE_SCOPED_ORIGINAL, String(current)); }
      await writeFlowMultiplier(base, 'prepare Flow Calibration');
      state.scopedAppliedMultiplier = base;
    }

    const selectedMode = normalizeCalibrationMode(state.calibrationMode);
    const profile = calibrationProfileObject(selectedMode);
    const rec = await upsertProfile(profile);
    state.calibrationProfileIds[selectedMode] = rec && rec.id ? rec.id : state.calibrationProfileIds[selectedMode];
    await api('/workflow', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile })
    });
    state.workflowTitle = profile.title;
    state.calibrationArmed = true;
    state.armed = false;
    emitSkinChanged();
    { const wp = calibrationWaterPlan(selectedMode); log(`Calibration profile '${profile.title}' selected. EMPTY BASKET: prime ${wp.primeFlow} ml/s × ${wp.primeSeconds}s + ${calibrationCommands().length} measured plateaus; nominal command water ≈${wp.nominalCommandWaterMl} ml; use >=${wp.recommendedContainerMl} ml catch vessel. Tare scale, then start Espresso manually and let all plateaus finish (unless the actual-water safety stop is reached).`); }
    return calibrationStatusPayload();
  }

  async function requestMachineState(machineState) {
    diagnosticEvent("command_request", { machineState });
    await api(`/machine/state/${machineState}`, { method: "PUT" });
    diagnosticEvent("command_accepted", { machineState });
    diagnosticSample(`command:${machineState}`, true);
    log(`Machine command accepted: ${machineState}`);
  }

  async function getMachineSnapshot() {
    const response = await api(`/machine/state`, { method: "GET" });
    return await response.json();
  }

  function extractMachine(payload) {
    const p = payload || {};
    const m = p.machine || p;
    const nestedState = m.state && typeof m.state === "object" ? m.state : (p.state && typeof p.state === "object" ? p.state : null);
    const machineState = nestedState ? nestedState.state : (typeof p.machineState === "string" ? p.machineState : (typeof p.state === "string" ? p.state : null));
    const substate = nestedState ? nestedState.substate : (p.machineSubstate || p.substate || null);
    return {
      machineState,
      substate,
      pressure: n(m.pressure !== undefined ? m.pressure : p.pressure, 0),
      telemetryValid: finiteOrNull(m.pressure !== undefined ? m.pressure : p.pressure)!==null && finiteOrNull(m.flow !== undefined ? m.flow : p.flow)!==null,
      flow: n(m.flow !== undefined ? m.flow : p.flow, 0),
      targetFlow: Number.isFinite(Number(m.targetFlow !== undefined ? m.targetFlow : p.targetFlow)) ? Number(m.targetFlow !== undefined ? m.targetFlow : p.targetFlow) : null,
      targetPressure: Number.isFinite(Number(m.targetPressure !== undefined ? m.targetPressure : p.targetPressure)) ? Number(m.targetPressure !== undefined ? m.targetPressure : p.targetPressure) : null,
      machineWeightFlow: Number.isFinite(Number(m.weightFlow !== undefined ? m.weightFlow : p.weightFlow)) ? Number(m.weightFlow !== undefined ? m.weightFlow : p.weightFlow) : null,
      profileFrame: m.profileFrame !== undefined ? m.profileFrame : (p.profileFrame !== undefined ? p.profileFrame : null)
    };
  }


  function scaleTimestampSeconds(value) {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return null;
      const numeric = Number(trimmed);
      if (Number.isFinite(numeric)) return scaleTimestampSeconds(numeric);
      const parsed = Date.parse(trimmed);
      return Number.isFinite(parsed) ? parsed / 1000 : null;
    }
    const v = Number(value);
    if (!Number.isFinite(v)) return null;
    const a = Math.abs(v);
    // Common timestamp units: ns, us, ms, or s. For small monotonic
    // timestamps, fractional values are treated as seconds.
    if (a >= 1e17) return v / 1e9;
    if (a >= 1e14) return v / 1e6;
    if (a >= 1e11) return v / 1e3;
    if (a >= 1e9) return v;
    return v;
  }

  function captureRawScaleSample(snapshot, weight, decaidWeightFlow, receivedAtMs) {
    const run = state.diagnosticCurrent;
    const sourceTimestamp = snapshot && snapshot.timestamp !== undefined ? snapshot.timestamp : null;
    const timestampSeconds = scaleTimestampSeconds(sourceTimestamp);
    let rawDwDt = null;
    let tareReset = false;

    if (run && Array.isArray(run.rawScaleSamples) && run.rawScaleSamples.length) {
      const prev = run.rawScaleSamples[run.rawScaleSamples.length - 1];
      const drop = Number(prev.weightG) - weight;
      tareReset = Number.isFinite(drop) && state.cfg && drop >= state.cfg.scaleResetThreshold;
      const dt = Number.isFinite(timestampSeconds) && Number.isFinite(Number(prev.scaleTimestampSeconds))
        ? timestampSeconds - Number(prev.scaleTimestampSeconds) : null;
      if (!tareReset && Number.isFinite(dt) && dt > 0 && dt <= 10) {
        rawDwDt = (weight - Number(prev.weightG)) / dt;
      }
    }

    state.latestRawDwDt = Number.isFinite(rawDwDt) ? rawDwDt : null;
    if (!run) return;
    run.rawScaleSamples.push({
      tMs: Math.max(0, receivedAtMs - run.startedAtMs),
      phase: state.phase,
      profileFrame: state.lastFrame,
      targetFlowMlS: round(state.lastTargetFlow, 4),
      machineFlowMlS: round(state.lastFlow, 4),
      pressureBar: round(state.lastPressure, 4),
      scaleTimestamp: sourceTimestamp,
      scaleTimestampSeconds: Number.isFinite(timestampSeconds) ? round(timestampSeconds, 6) : null,
      weightG: round(weight, 4),
      rawDwDtGS: Number.isFinite(rawDwDt) ? round(rawDwDt, 4) : null,
      decaidWeightFlowGS: Number.isFinite(decaidWeightFlow) ? round(decaidWeightFlow, 4) : null,
      tareReset
    });
    if (run.rawScaleSamples.length > 12000) run.rawScaleSamples.shift();
  }


  function clearScaleReconnectTimer() {
    if (state.scaleReconnectTimer !== null) {
      clearTimeout(state.scaleReconnectTimer);
      state.scaleReconnectTimer = null;
    }
  }

  function scheduleScaleReconnect(delayMs) {
    clearScaleReconnectTimer();
    state.scaleReconnectTimer = setTimeout(() => {
      state.scaleReconnectTimer = null;
      connectScaleStream();
    }, Math.max(250, delayMs || 1000));
  }

  function onScaleSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== "object") return;
    if (snapshot.status === "connected") {
      if (!state.scaleConnected) log("Scale snapshot stream reports connected.");
      state.scaleConnected = true;
      return;
    }
    if (snapshot.status === "disconnected") {
      state.scaleConnected = false;
      log("Scale snapshot stream reports disconnected.");
      return;
    }

    const weight = Number(snapshot.weight);
    if (!Number.isFinite(weight)) return;
    const weightFlow = Number(snapshot.weightFlow);
    const receivedAtMs = Date.now();
    state.scaleConnected = true;
    state.latestRawWeight = weight;
    state.latestWeightFlow = Number.isFinite(weightFlow) ? weightFlow : 0;
    state.latestScaleAtMs = receivedAtMs;
    state.latestScaleTimestamp = snapshot.timestamp !== undefined ? snapshot.timestamp : null;
    state.lastWeightFlow = state.latestWeightFlow;
    captureRawScaleSample(snapshot, weight, Number.isFinite(weightFlow) ? weightFlow : null, receivedAtMs);

    if (state.phase === "idle" || state.phase === "aborted") return;

    updateCumulativeWeight(weight);
    diagnosticSample("scale", false);

    if(!activeReleaseEnabled(state.cfg)&&["stage1","stage2","stage3"].includes(state.phase)&&state.cumulativeWeight>=state.cfg.finalWeight){finishSequence();return;}
    if (state.phase === "stage1" && state.cumulativeWeight >= state.cfg.stage1Weight) {
      if(activeReleaseEnabled(state.cfg))beginDump();else beginContinuousStage2();
      return;
    }
    if (state.phase === "stage2") {
      if (state.cumulativeWeight >= state.cfg.finalWeight) {
        finishSequence();
        return;
      }
      if (state.cumulativeWeight >= state.cfg.stage2Weight) {
        beginStage3LowFlow();
        return;
      }
    }
    if (state.phase === "stage3" && state.cumulativeWeight >= state.cfg.finalWeight) {
      finishSequence();
    }
  }

  function handleScaleTransportEvent(event) {
    if (!event) return;
    if (event.type === "data") {
      try {
        const payload = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        onScaleSnapshot(payload);
      } catch (error) {
        log(`Scale snapshot parse error: ${error.message || error}`);
      }
      return;
    }
    if (event.type === "close" || event.type === "error") {
      state.scaleConnected = false;
      state.scaleHandle = null;
      log(`Scale snapshot stream ${event.type}; reconnecting.`);
      scheduleScaleReconnect(1000);
    }
  }

  function connectScaleStream() {
    if (state.scaleHandle !== null) return;
    clearScaleReconnectTimer();
    host.transport.open({kind: "websocket", url: SCALE_WS})
      .then((opened) => {
        if (!opened || !opened.handle) throw new Error("scale websocket opened without a handle");
        state.scaleHandle = opened.handle;
        host.transport.onEvent(opened.handle, handleScaleTransportEvent);
        log("Connected to Decaid scale snapshot stream.");
      })
      .catch((error) => {
        state.scaleHandle = null;
        state.scaleConnected = false;
        log(`Scale snapshot stream connection failed: ${error.message || error}; retrying.`);
        scheduleScaleReconnect(1000);
      });
  }

  function closeScaleStream() {
    clearScaleReconnectTimer();
    const handle = state.scaleHandle;
    state.scaleHandle = null;
    state.scaleConnected = false;
    if (handle !== null) {
      host.transport.close(handle).catch(() => {});
    }
  }

  function clearWaterReconnectTimer() {
    if (state.waterReconnectTimer !== null) {
      clearTimeout(state.waterReconnectTimer);
      state.waterReconnectTimer = null;
    }
  }

  function scheduleWaterReconnect(delayMs) {
    clearWaterReconnectTimer();
    state.waterReconnectTimer = setTimeout(() => {
      state.waterReconnectTimer = null;
      connectWaterLevelStream();
    }, Math.max(500, delayMs || 1500));
  }

  function waterPreflightStatus() {
    const cfg = calibrationModeConfig();
    const current = finiteOrNull(state.waterCurrentLevelMm);
    const refill = finiteOrNull(state.waterRefillLevelMm);
    const ageMs = state.waterLevelAtMs > 0 ? Date.now() - state.waterLevelAtMs : null;
    const fresh = current !== null && refill !== null && ageMs !== null && ageMs <= 5000;
    if (!fresh) {
      return {
        status: 'unknown', available: false, fresh: false,
        currentLevelMm: round(current, 2), refillLevelMm: round(refill, 2),
        marginMm: current !== null && refill !== null ? round(current - refill, 2) : null,
        ageMs,
        message: 'Live DE1 tank level is unavailable or stale. Manually verify the tank before calibration.'
      };
    }
    const margin = current - refill;
    if (current <= refill || margin < Number(cfg.waterBlockMarginMm || 0)) {
      return {
        status: 'block', available: true, fresh: true,
        currentLevelMm: round(current, 2), refillLevelMm: round(refill, 2), marginMm: round(margin, 2), ageMs,
        message: `Tank margin is too small for ${cfg.label}. Refill the tank before calibration.`
      };
    }
    if (margin < Number(cfg.waterWarnMarginMm || 0)) {
      return {
        status: 'warn', available: true, fresh: true,
        currentLevelMm: round(current, 2), refillLevelMm: round(refill, 2), marginMm: round(margin, 2), ageMs,
        message: `Tank is above the DE1 refill threshold but the remaining height margin is only ${round(margin,1)} mm. Refill is recommended.`
      };
    }
    return {
      status: 'ok', available: true, fresh: true,
      currentLevelMm: round(current, 2), refillLevelMm: round(refill, 2), marginMm: round(margin, 2), ageMs,
      message: `Tank level margin is ${round(margin,1)} mm above the refill threshold.`
    };
  }

  function handleWaterTransportEvent(event) {
    if (!event) return;
    if (event.type === 'data') {
      try {
        const payload = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (!payload || typeof payload !== 'object') return;
        const current = Number(payload.currentLevel);
        const refill = Number(payload.refillLevel);
        if (Number.isFinite(current) && Number.isFinite(refill)) {
          state.waterCurrentLevelMm = current;
          state.waterRefillLevelMm = refill;
          state.waterLevelAtMs = Date.now();
          state.waterLevelConnected = true;
        }
      } catch (error) {
        log(`Water-level parse error: ${error.message || error}`);
      }
      return;
    }
    if (event.type === 'close' || event.type === 'error') {
      state.waterLevelConnected = false;
      state.waterHandle = null;
      scheduleWaterReconnect(1500);
    }
  }

  function connectWaterLevelStream() {
    if (state.waterHandle !== null) return;
    clearWaterReconnectTimer();
    host.transport.open({kind: 'websocket', url: WATER_WS})
      .then(opened => {
        if (!opened || !opened.handle) throw new Error('water-level websocket opened without a handle');
        state.waterHandle = opened.handle;
        state.waterLevelConnected = true;
        host.transport.onEvent(opened.handle, handleWaterTransportEvent);
        log('Connected to Decaid DE1 water-level stream.');
      })
      .catch(error => {
        state.waterHandle = null;
        state.waterLevelConnected = false;
        log(`DE1 water-level stream connection failed: ${error.message || error}; retrying.`);
        scheduleWaterReconnect(1500);
      });
  }

  function closeWaterLevelStream() {
    clearWaterReconnectTimer();
    const handle = state.waterHandle;
    state.waterHandle = null;
    state.waterLevelConnected = false;
    if (handle !== null) host.transport.close(handle).catch(() => {});
  }

  function averageFinite(values) {
    const a = values.map(Number).filter(Number.isFinite);
    return a.length ? a.reduce((sum, v) => sum + v, 0) / a.length : null;
  }

  function linearRegression(points) {
    const clean = points.filter(p => Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y)));
    if (clean.length < 3) return null;
    const mx = clean.reduce((s, p) => s + Number(p.x), 0) / clean.length;
    const my = clean.reduce((s, p) => s + Number(p.y), 0) / clean.length;
    let sxx = 0, sxy = 0, syy = 0;
    for (const p of clean) {
      const dx = Number(p.x) - mx, dy = Number(p.y) - my;
      sxx += dx * dx; sxy += dx * dy; syy += dy * dy;
    }
    if (sxx <= 0) return null;
    const slope = sxy / sxx;
    const intercept = my - slope * mx;
    const r2 = syy > 0 ? Math.max(0, Math.min(1, (sxy * sxy) / (sxx * syy))) : 1;
    return { slope, intercept, r2, n: clean.length };
  }

  function analyzeCalibrationRun(run, baseMultiplier) {
    const raw = run && Array.isArray(run.rawScaleSamples) ? run.rawScaleSamples : [];
    const plateauResults = [];
    const mode = normalizeCalibrationMode(run && run.config && run.config.calibrationMode || state.calibrationMode);
    const modeCfg = calibrationModeConfig(mode);
    const program = Array.isArray(run && run.config && run.config.calibrationProgram)
      ? run.config.calibrationProgram.map(x => ({
          blockId: String(x.blockId || ''), targetSource: String(x.targetSource || ''),
          targetReal: finiteOrNull(x.targetReal), commandFlow: Number(x.commandFlow),
          seconds: Number(x.seconds || modeCfg.stepSeconds),
          settleSeconds: Number(x.settleSeconds || modeCfg.settleSeconds),
          windowSeconds: Number(x.windowSeconds || modeCfg.windowSeconds)
        })).filter(x => Number.isFinite(x.commandFlow))
      : calibrationProgram(mode);
    const frameOffset = Number(modeCfg.primeSeconds || 0) > 0 ? 1 : 0;

    for (let i = 0; i < program.length; i += 1) {
      const step = program[i];
      const frame = i + frameOffset;
      const cmd = Number(step.commandFlow);
      const settleMs = Number(step.settleSeconds || modeCfg.settleSeconds) * 1000;
      const windowMs = Number(step.windowSeconds || modeCfg.windowSeconds) * 1000;
      const frameSamples = raw.filter(r => Number(r.profileFrame) === frame && Number.isFinite(Number(r.weightG)));
      if (!frameSamples.length) {
        plateauResults.push({ frame, blockId: step.blockId || '', targetReal: step.targetReal, commandFlow: cmd, valid: false, acceptedInMap: false, reason: 'no raw scale samples' });
        continue;
      }
      const firstT = Math.min(...frameSamples.map(r => Number(r.tMs)));
      const lastT = Math.max(...frameSamples.map(r => Number(r.tMs)));
      const startT = Math.max(firstT + settleMs, lastT - windowMs);
      const window = frameSamples.filter(r => Number(r.tMs) >= startT && !r.tareReset);
      const regPoints = window.map(r => ({
        x: Number.isFinite(Number(r.scaleTimestampSeconds)) ? Number(r.scaleTimestampSeconds) : Number(r.tMs) / 1000,
        y: Number(r.weightG)
      }));
      const reg = linearRegression(regPoints);
      const machineFlow = averageFinite(window.map(r => r.machineFlowMlS));
      const pressure = averageFinite(window.map(r => r.pressureBar));
      const decaid = averageFinite(window.map(r => r.decaidWeightFlowGS));
      const actual = reg ? reg.slope : null;
      const r2Min = modeCfg.algorithm === 'target-lut' ? 0.96 : 0.95;
      const valid = !!reg && reg.n >= 8 && Number.isFinite(actual) && actual > 0.05 && reg.r2 >= r2Min;
      plateauResults.push({
        frame, blockId: step.blockId || '', targetSource: step.targetSource || '', targetReal: round(step.targetReal, 3),
        commandFlow: cmd, actualFlow: round(actual, 4), machineFlow: round(machineFlow, 4),
        decaidWeightFlow: round(decaid, 4), pressure: round(pressure, 4), r2: reg ? round(reg.r2, 5) : null,
        samples: reg ? reg.n : window.length, fitStartMs: Math.round(startT), fitEndMs: Math.round(lastT),
        valid, acceptedInMap: false,
        reason: valid ? '' : (!reg ? 'insufficient fit' : reg.n < 8 ? `too few samples ${reg.n}` : reg.r2 < r2Min ? `low R2 ${round(reg.r2,3)}` : 'invalid/near-zero slope')
      });
    }

    // LOW WATER: build a target-focused three-anchor LUT. Each HyperEx target is
    // searched independently so transient behavior in one phase cannot make a
    // distant point look like a valid global interpolation bracket.
    if (modeCfg.algorithm === 'target-lut') {
      const anchors = [];
      const targetCoverage = [];
      const blocks = [];
      for (const step of program) {
        if (!step.blockId || blocks.some(b => b.id === step.blockId)) continue;
        blocks.push({ id: step.blockId, targetSource: step.targetSource || '', target: Number(step.targetReal) });
      }

      for (const block of blocks) {
        const target = Number(block.target);
        const candidates = plateauResults
          .filter(p => p.blockId === block.id && p.valid)
          .sort((a, b) => Number(a.commandFlow) - Number(b.commandFlow));
        const monotonic = [];
        for (const p of candidates) {
          if (!monotonic.length || Number(p.actualFlow) > Number(monotonic[monotonic.length - 1].actualFlow) + 0.03) {
            monotonic.push(p);
          } else {
            p.reason = `non-monotonic in ${block.id} vs ${round(monotonic[monotonic.length - 1].actualFlow,3)} g/s`;
          }
        }

        const nearTolerance = target >= 4 ? 0.40 : target >= 1.8 ? 0.25 : 0.20;
        const maxGap = target >= 4 ? 1.25 : target >= 1.8 ? 0.85 : 0.75;
        let nearest = null;
        for (const p of monotonic) {
          const err = Math.abs(Number(p.actualFlow) - target);
          if (!nearest || err < nearest.err) nearest = { p, err };
        }

        let lo = null, hi = null;
        for (const p of monotonic) {
          const y = Number(p.actualFlow);
          if (y <= target) lo = p;
          if (y >= target && !hi) hi = p;
        }

        let command = null, machineFlow = null, quality = null, source = [];
        if (lo && hi && lo !== hi) {
          const ya = Number(lo.actualFlow), yb = Number(hi.actualFlow);
          const gap = yb - ya;
          if (gap > 0 && gap <= maxGap) {
            const f = (target - ya) / gap;
            command = Number(lo.commandFlow) + f * (Number(hi.commandFlow) - Number(lo.commandFlow));
            if (Number.isFinite(Number(lo.machineFlow)) && Number.isFinite(Number(hi.machineFlow))) {
              machineFlow = Number(lo.machineFlow) + f * (Number(hi.machineFlow) - Number(lo.machineFlow));
            }
            quality = 'tight-bracket';
            source = [lo, hi];
          }
        }
        if (!Number.isFinite(command) && nearest && nearest.err <= nearTolerance) {
          command = Number(nearest.p.commandFlow);
          machineFlow = Number(nearest.p.machineFlow);
          quality = 'near-hit';
          source = [nearest.p];
        }

        for (const p of source) {
          p.acceptedInMap = true;
          p.reason = `${quality} source for ${block.id} ${round(target,2)} g/s`;
        }
        for (const p of monotonic) {
          if (!p.acceptedInMap && !p.reason) p.reason = `valid ${block.id} search point`;
        }

        const gap = lo && hi ? Number(hi.actualFlow) - Number(lo.actualFlow) : null;
        const ok = Number.isFinite(command);
        targetCoverage.push({
          blockId: block.id, targetSource: block.targetSource, target: round(target, 3), ok, quality,
          commandFlow: round(command, 4), nearestError: nearest ? round(nearest.err, 4) : null,
          lowerActual: lo ? lo.actualFlow : null, upperActual: hi ? hi.actualFlow : null,
          lowerCommand: lo ? lo.commandFlow : null, upperCommand: hi ? hi.commandFlow : null,
          gap: round(gap, 4), maxGap, nearTolerance
        });
        if (ok) {
          anchors.push({
            blockId: block.id, targetSource: block.targetSource,
            actualFlow: round(target, 4), commandFlow: round(command, 4), machineFlow: round(machineFlow, 4),
            r2: source.length ? round(Math.min(...source.map(p => Number(p.r2))), 5) : null,
            samples: source.length ? Math.min(...source.map(p => Number(p.samples || 0))) : null,
            quality
          });
        }
      }

      anchors.sort((a, b) => Number(a.actualFlow) - Number(b.actualFlow));
      let monotonicCommands = anchors.length >= 3;
      for (let i = 1; i < anchors.length; i += 1) {
        if (!(Number(anchors[i].commandFlow) > Number(anchors[i - 1].commandFlow) + 0.02)) monotonicCommands = false;
      }
      const coversTargets = blocks.length >= 3 && anchors.length === blocks.length && targetCoverage.every(x => x.ok) && monotonicCommands;

      let suggested = null, displayFactor = null;
      const displayPts = anchors.filter(p => Number.isFinite(Number(p.machineFlow)) && Number(p.machineFlow) > 0.12);
      if (coversTargets && Number.isFinite(Number(baseMultiplier)) && displayPts.length >= 3) {
        let num = 0, den = 0;
        for (const p of displayPts) {
          const x = Number(p.machineFlow), y = Number(p.actualFlow);
          num += x * y; den += x * x;
        }
        if (den > 0) {
          displayFactor = num / den;
          suggested = Math.max(0.13, Math.min(2.0, Number(baseMultiplier) * displayFactor));
        }
      }

      const actuals = anchors.map(p => Number(p.actualFlow));
      const map = {
        schema: 3,
        algorithm: 'v0.1.38-target-lut',
        createdAt: new Date().toISOString(), calibrationMode: mode,
        baseFlowMultiplier: round(baseMultiplier, 4), valid: coversTargets, coversTargets,
        targetCoverage, targetAnchors: anchors,
        actualRange: anchors.length ? [round(Math.min(...actuals), 4), round(Math.max(...actuals), 4)] : null,
        desiredRange: anchors.length ? [round(Math.min(...actuals), 4), round(Math.max(...actuals), 4)] : null,
        points: anchors.map(p => ({
          commandFlow: p.commandFlow, actualFlow: p.actualFlow, machineFlow: p.machineFlow,
          r2: p.r2, samples: p.samples, quality: p.quality, blockId: p.blockId, targetSource: p.targetSource
        })),
        suggestedFlowMultiplier: round(suggested, 4), displayScaleFactor: round(displayFactor, 4)
      };
      if (!monotonicCommands && anchors.length) {
        for (const x of targetCoverage) if (x.ok) x.warning = 'anchor commands are not strictly increasing';
      }
      return { valid: map.valid, map, plateauResults };
    }

    // FULL: retain the wide engineering staircase and a monotonic diagnostic LUT.
    const validByCommand = plateauResults.filter(p => p.valid).sort((a, b) => a.commandFlow - b.commandFlow);
    const monotonic = [];
    for (const p of validByCommand) {
      if (!monotonic.length || Number(p.actualFlow) > Number(monotonic[monotonic.length - 1].actualFlow) + 0.03) {
        p.acceptedInMap = true; p.reason = 'used'; monotonic.push(p);
      } else {
        p.acceptedInMap = false;
        p.reason = `non-monotonic vs previous ${round(monotonic[monotonic.length - 1].actualFlow,3)} g/s`;
      }
    }
    const desired = [state.cfg.stage1Flow, state.cfg.stage2Flow, state.cfg.stage3Flow].map(Number).filter(Number.isFinite);
    const minDesired = desired.length ? Math.min(...desired) : 1.5;
    const maxDesired = desired.length ? Math.max(...desired) : 5.0;
    const minActual = monotonic.length ? Number(monotonic[0].actualFlow) : null;
    const maxActual = monotonic.length ? Number(monotonic[monotonic.length - 1].actualFlow) : null;
    const targetCoverage = desired.map(target => {
      let lo = null, hi = null;
      for (const p of monotonic) {
        const y = Number(p.actualFlow);
        if (y <= target) lo = p;
        if (y >= target && !hi) hi = p;
      }
      const gap = lo && hi ? Number(hi.actualFlow) - Number(lo.actualFlow) : null;
      const maxGap = target <= 2.05 ? 0.85 : 1.25;
      const ok = !!lo && !!hi && Number.isFinite(gap) && gap <= maxGap;
      return { target: round(target, 3), ok, lowerActual: lo ? lo.actualFlow : null, upperActual: hi ? hi.actualFlow : null,
        lowerCommand: lo ? lo.commandFlow : null, upperCommand: hi ? hi.commandFlow : null, gap: round(gap, 4), maxGap };
    });
    const coversTargets = monotonic.length >= 5 && targetCoverage.length > 0 && targetCoverage.every(x => x.ok);
    const displayPts = monotonic.filter(p => Number.isFinite(Number(p.machineFlow)) && Number(p.machineFlow) > 0.12);
    let suggested = null, displayFactor = null;
    if (coversTargets && Number.isFinite(Number(baseMultiplier)) && displayPts.length >= 3) {
      let num = 0, den = 0;
      for (const p of displayPts) { const x = Number(p.machineFlow), y = Number(p.actualFlow); num += x * y; den += x * x; }
      if (den > 0) { displayFactor = num / den; suggested = Math.max(0.13, Math.min(2.0, Number(baseMultiplier) * displayFactor)); }
    }
    const map = {
      schema: 3, algorithm: 'v0.1.38-full-staircase', createdAt: new Date().toISOString(), calibrationMode: mode,
      baseFlowMultiplier: round(baseMultiplier, 4), valid: coversTargets, coversTargets, targetCoverage,
      actualRange: monotonic.length ? [round(minActual, 4), round(maxActual, 4)] : null,
      desiredRange: [round(minDesired, 4), round(maxDesired, 4)],
      points: monotonic.map(p => ({ commandFlow: p.commandFlow, actualFlow: p.actualFlow, machineFlow: p.machineFlow, r2: p.r2, samples: p.samples })),
      suggestedFlowMultiplier: round(suggested, 4), displayScaleFactor: round(displayFactor, 4)
    };
    return { valid: map.valid, map, plateauResults };
  }

  function curveEditorRevision() {
    return JSON.stringify({profile:normalizedProfileExecution(profileObject()),binding:testOverrideBinding(),fingerprint:adaptiveHistoryFingerprintKey(adaptiveHistoryFingerprint()),selection:state.workflowSelectionRevision,refill:currentS2RefillSettings()});
  }
  function manualCurveBlocksRun(run) {
    const os=testOverrideStatus(),q=os.valid&&!os.baselinePrior&&state.testOverrides&&state.testOverrides.manualCurveSource;
    return !!(run&&q&&q.afterRunId&&String(q.afterRunId)===String(run.runId));
  }
  function curveEditorSnapshot() {
    if(!state.cfg)return null;
    const c=commandFlowSummary(),q=c.s3Shape||{},v={stage1:c.stage1CommandMlS,stage2:c.stage2CommandMlS,early:q.enabled?q.earlyCommand:c.stage3FlatCommandMlS,mid:q.enabled?q.midCommand:c.stage3FlatCommandMlS,late:q.enabled?q.lateCommand:c.stage3FlatCommandMlS,earlySeconds:q.enabled?q.earlySeconds:8,midSeconds:q.enabled?q.midSeconds:14};
    return {revision:curveEditorRevision(),values:v,shaped:!!q.enabled,refill:currentS2RefillSettings(),refillLimits:S2_REFILL_LIMITS,refillDefaults:validatedS2RefillSettings(null),
      refillPreview:stage2StartupPlan(),refillActive:activeReleaseEnabled(state.cfg)&&state.cfg.liveFlowTrimTest&&state.cfg.s2StartupAssist,refillLoadWarning:state.s2RefillLoadWarning,refillPrevious:state.s2RefillPrevious?JSON.parse(JSON.stringify(state.s2RefillPrevious)):null,refillLastShot:refillLastShotSnapshot(),
      canApply:state.s2RefillStorageLoaded&&state.phase==="idle"&&!state.calibrationActive&&!state.curveApplyBusy&&!state.runtimeProfileRepairBusy&&!(state.autoApplyLastStatus&&state.autoApplyLastStatus.status==="applying")&&state.workflowTitle===state.cfg.profileTitle&&state.runtimeProfileVerified&&state.calibrationMapUsable,
      source:state.testOverrides&&testOverrideStatus().valid&&!testOverrideStatus().baselinePrior?state.testOverrides.manualCurveSource||null:null,
      targetGS:{stage1:state.cfg.stage1Flow,stage2:state.cfg.stage2Flow,stage3:state.cfg.stage3Flow},
      stageWeights:{stage1:state.cfg.stage1Weight,stage2:state.cfg.stage2Weight,final:state.cfg.finalWeight}};
  }
  function restoreManualApplySchedule(previousStatus) {
    if(previousStatus&&previousStatus.status==="scheduled"&&!state.autoApplyTimer&&state.phase==="idle"&&state.autoApplyNextShot&&state.diagnosticLast&&state.diagnosticLast.runId===previousStatus.runId){
      const run=state.diagnosticLast;state.autoApplyTimer=setTimeout(()=>{state.autoApplyTimer=null;return autoApplyNextShotIfEligible(run);},250);
    }
  }
  function verifyS2RefillReadback(stored){
    return new Promise(resolve=>{
      const expected={basis:stored.basis,startDelayMs:stored.startDelayMs,targetPercent:stored.targetPercent,cutoffPercent:stored.cutoffPercent,maxDurationMs:stored.maxDurationMs,approachMs:stored.approachMs};
      const token={expected,done:false,timer:null};
      token.resolve=ok=>{if(token.done)return;token.done=true;if(token.timer)clearTimeout(token.timer);if(state.pendingRefillSave===token)state.pendingRefillSave=null;resolve(ok);};
      token.timer=setTimeout(()=>token.resolve(false),1500);
      state.pendingRefillSave=token;
      if(!storageRead(STORAGE_S2_REFILL))token.resolve(false);
    });
  }
  async function saveS2RefillSettings(body) {
    if(!state.s2RefillStorageLoaded||state.phase!=="idle"||state.calibrationActive||state.curveApplyBusy||state.runtimeProfileRepairBusy||state.autoApplyLastStatus&&state.autoApplyLastStatus.status==="applying")throw new Error("请在空闲且参数载入完成后保存");
    if(!body||body.revision!==curveEditorRevision())throw new Error("参数已改变，请重新载入后保存");
    const next=validatedS2RefillSettings(body.refill,true),before=currentS2RefillSettings();
    state.curveApplyBusy=true;
    try {
      await requireIdleMachineForProfileSync();
      if(state.phase!=="idle"||body.revision!==curveEditorRevision())throw new Error("参数或运行状态已改变");
      const previous=JSON.stringify(before)===JSON.stringify(next)?state.s2RefillPrevious:{at:new Date().toISOString(),before:{...before},after:{...next}};
      const stored={...next,previousChange:previous};
      if(!storageWrite(STORAGE_S2_REFILL,stored))throw new Error("补水参数写入失败");
      if(!await verifyS2RefillReadback(stored))throw new Error("补水参数已写入，但没有收到存储回读确认；请重新载入核对");
      state.s2RefillSettings=next;state.s2RefillPrevious=previous;state.s2RefillLoadWarning=null;
      emitSkinChanged();return {saved:true};
    }finally{state.curveApplyBusy=false;}
  }
  async function applyCurveEditorDraft(body) {
    if(!state.s2RefillStorageLoaded)throw new Error("S2 refill settings are still loading");
    if(state.phase!=="idle"||state.calibrationActive||state.curveApplyBusy||state.runtimeProfileRepairBusy||state.autoApplyLastStatus&&state.autoApplyLastStatus.status==="applying")throw new Error("曲线正在运行或同步，请空闲后再应用");
    if(state.workflowTitle!==state.cfg.profileTitle||!state.runtimeProfileVerified)throw new Error("请先选择并校验 HyperEx 曲线");
    recomputeCalibrationUsability();if(!state.calibrationMapUsable)throw new Error("有效 LUT 尚未就绪");
    if(!body||body.revision!==curveEditorRevision())throw new Error("下一杯参数已改变，请重新载入当前曲线后编辑");
    const v=body.values||{},keys=["stage1","stage2","early","mid","late"],shaped=body.shaped===true;
    for(const k of keys)if(typeof v[k]!=="number"||!Number.isFinite(v[k])||v[k]<LIMITS.commandFlowMin||v[k]>LIMITS.commandFlowMax)throw new Error("流量指令必须在0.10–8.00 ml/s内");
    if(!["earlySeconds","midSeconds"].every(k=>typeof v[k]==="number"&&Number.isFinite(v[k])&&v[k]>=3&&v[k]<=30))throw new Error("S3前段、中段时间必须在3–30秒内");
    if(shaped){
      const rise=(a,b)=>b<=Math.max(a+.25,a*1.35)+1e-9;
      if(!(v.early<=v.mid&&v.mid<=v.late)||!rise(v.early,v.mid)||!rise(v.mid,v.late))throw new Error("S3需满足前段≤中段≤后段，且相邻增幅在现有保护范围内");
    }else if(v.early!==v.mid||v.mid!==v.late)throw new Error("平直 S3 的三个指令必须一致");
    const before=curveEditorSnapshot(),nextRefill=validatedS2RefillSettings(body.refill===undefined?currentS2RefillSettings():body.refill,true),previousRefill=state.s2RefillSettings?{...state.s2RefillSettings}:null,previousRefillWarning=state.s2RefillLoadWarning,previousRefillPrevious=state.s2RefillPrevious?JSON.parse(JSON.stringify(state.s2RefillPrevious)):null,previousOverrides=state.testOverrides?JSON.parse(JSON.stringify(state.testOverrides)):null,previousStatus=state.autoApplyLastStatus;
    if(keys.concat(["earlySeconds","midSeconds"]).every(k=>before.values[k]===v[k])&&before.shaped===shaped&&JSON.stringify(before.refill)===JSON.stringify(nextRefill))throw new Error("曲线尚未修改");
    state.curveApplyBusy=true;
    let changed=false;
    try {
      await requireIdleMachineForProfileSync();
      const actual=await readWorkflowProfile();
      if(!actual||actual.title!==state.cfg.profileTitle)throw new Error("所选曲线已改变");
      adoptWorkflowBrewTemperature(actual,false);
      if(state.phase!=="idle"||body.revision!==curveEditorRevision()||!profileExecutionEquivalent(actual,profileObject()))throw new Error("首页或下一杯曲线已改变，请重新载入后编辑");
      clearTimer("autoApplyTimer");
      const c=commandFlowSummary(),stages={};
      for(const k of ["stage1","stage2","stage3"]){const cmd=k==="stage3"?c.stage3FlatCommandMlS:c[k+"CommandMlS"];stages[k]={mode:c[k+"Mode"]==="manual"?"manual":"auto",origin:c[k+"Origin"]||"original",command:c[k+"Mode"]==="manual"?cmd:null};}
      for(const k of ["stage1","stage2"])if(Math.abs(v[k]-before.values[k])>.00001)stages[k]={mode:"manual",origin:"manual",command:round(v[k],4)};
      if(!shaped&&(before.shaped||Math.abs(v.mid-before.values.mid)>.00001))stages.stage3={mode:"manual",origin:"manual",command:round(v.mid,4)};
      const binding=testOverrideBinding();
      const source={afterRunId:state.diagnosticLast&&state.diagnosticLast.runId||"",appliedAt:new Date().toISOString(),mode:"curve-editor"};
      state.testOverrides={schema:3,writerVersion:PLUGIN_VERSION,savedAt:source.appliedAt,...binding,stages,
        s3Shape:shaped?{enabled:true,origin:before.shaped&&["early","mid","late","earlySeconds","midSeconds"].every(k=>v[k]===before.values[k])?c.stage3Origin||"retained":"manual",earlyCommand:round(v.early,4),midCommand:round(v.mid,4),lateCommand:round(v.late,4),earlySeconds:round(v.earlySeconds,1),midSeconds:round(v.midSeconds,1)}:{enabled:false},manualCurveSource:source};
      changed=true;
      state.s2RefillSettings=nextRefill;state.s2RefillLoadWarning=null;
      if(JSON.stringify(before.refill)!==JSON.stringify(nextRefill))state.s2RefillPrevious={at:source.appliedAt,before:before.refill,after:nextRefill};
      if(!storageWrite(STORAGE_S2_REFILL,{...nextRefill,previousChange:state.s2RefillPrevious})||!storageWrite(STORAGE_TEST_OVERRIDES,state.testOverrides))throw new Error("S2 refill settings could not be saved");
      await syncHyperExProfile(true,"manual curve editor");
      const truth=runtimeProfileTruthPayload();if(!truth.verified||!truth.machineUploadAcknowledged)throw new Error("下一杯曲线尚未校验成功");
      state.autoApplyLastStatus={runId:source.afterRunId,status:"curve-applied",at:source.appliedAt,message:"手动曲线已校验并应用到下一杯；新杯完成后继续自动学习",commandFlows:commandFlowSummary()};
      log("Manual curve editor verified and applied to NEXT SHOT; LUT unchanged.");emitSkinChanged();
      return {verified:true};
    }catch(error){
      if(changed){state.s2RefillSettings=previousRefill;state.s2RefillLoadWarning=previousRefillWarning;state.s2RefillPrevious=previousRefillPrevious;storageWrite(STORAGE_S2_REFILL,previousRefill?{...previousRefill,previousChange:previousRefillPrevious}:"");state.testOverrides=previousOverrides;storageWrite(STORAGE_TEST_OVERRIDES,previousOverrides||"");try{await syncHyperExProfile(state.workflowTitle===state.cfg.profileTitle,"curve editor rollback");}catch(_){} }
      state.autoApplyLastStatus=previousStatus;if(changed)restoreManualApplySchedule(previousStatus);throw error;
    }finally{state.curveApplyBusy=false;}
  }

  function calibrationStatusPayload() {
    recomputeCalibrationUsability();
    refreshLearningStage();
    const map = state.calibrationMap;
    return {
      pluginVersion: PLUGIN_VERSION,
      curveEditor: curveEditorSnapshot(),
      basketContext: state.cfg ? state.cfg.basketContext : "unknown",
      learningStage: state.learningStage,
      baselinePrior: baselineFeedForwardPayload(),
      overrideContextStatus: testOverrideStatus().reason,
      autoApplyNextShot: !!state.autoApplyNextShot,
      autoApplyLastStatus: state.autoApplyLastStatus,
      calibrationMode: state.calibrationMode,
      calibrationModeLabel: calibrationModeConfig().label,
      calibrationAlgorithm: calibrationModeConfig().algorithm || 'staircase',
      calibrationModes: Object.keys(CALIBRATION_MODES).map(k => ({ id: k, label: CALIBRATION_MODES[k].label })),
      workflowTitle: state.workflowTitle,
      calibrationProfileTitle: calibrationProfileTitle(state.calibrationMode),
      calibrationProfileTitles: { low: calibrationProfileTitle('low'), full: calibrationProfileTitle('full') },
      calibrationArmed: state.calibrationArmed,
      calibrationActive: state.calibrationActive,
      scope: state.scopeMode,
      scopeLabel: scopeLabel(state.scopeMode),
      currentFlowMultiplier: round(state.flowMultiplierCurrent, 4),
      scopedOriginalMultiplier: round(state.scopedOriginalMultiplier, 4),
      pendingCalibrationMultiplier: round(state.calibrationPendingMultiplier, 4),
      globalPreviousMultiplier: round(state.globalPreviousMultiplier, 4),
      calibrationValid: !!(map && map.valid),
      calibrationUsable: state.calibrationMapUsable,
      calibrationStaleReason: state.calibrationMapStaleReason,
      calibrationBaseMultiplier: round(calibrationBaseMultiplier(), 4),
      suggestedFlowMultiplier: map && map.valid === true && Number(map.schema || 0) >= 3 ? round(map.suggestedFlowMultiplier, 4) : null,
      targetCoverage: map && Array.isArray(map.targetCoverage) ? map.targetCoverage : null,
      targetAnchors: map && Array.isArray(map.targetAnchors) ? map.targetAnchors : null,
      actualRange: map ? map.actualRange : null,
      pointCount: calibrationPoints().length,
      lutRevision: map && Number(map.revision || 0) > 0 ? Number(map.revision) : null,
      lutMerge: map && map.merge ? map.merge : null,
      commandFlows: commandFlowSummary(),
      profileTruth: runtimeProfileTruthPayload(),
      persistentHistory: historyStatusPayload(),
      learningHistory:learningHistoryPayload(),
      manualTestOverride: testOverrideStatus(),
      profileSyncStatus: state.profileSyncStatus,
      stage1StartupCorrection: stage1StartupFactor(),
      nominalCommandWaterMl: calibrationWaterPlan().nominalCommandWaterMl,
      recommendedContainerMl: calibrationWaterPlan().recommendedContainerMl,
      primeFlow: calibrationWaterPlan().primeFlow,
      primeSeconds: calibrationWaterPlan().primeSeconds,
      calibrationHardStopG: calibrationWaterPlan().hardStopG,
      calibrationStepSeconds: calibrationWaterPlan().stepSeconds,
      calibrationSteps: calibrationWaterPlan().steps,
      waterPreflight: waterPreflightStatus(),
      lastCalibrationValid: state.calibrationLast ? !!state.calibrationLast.valid : null,
      lastCalibration: state.calibrationLast
    };
  }

  async function beginCalibrationRun() {
    if (state.calibrationActive || state.calibrationFinalizeBusy) return;
    state.calibrationActive = true;
    state.phase = 'calibration';
    state.calibrationHardPressureSamples = 0;
    resetWeightTracking(finiteOrNull(state.latestRawWeight));
    const current = await refreshFlowMultiplier(true);
    if (Number.isFinite(current)) state.calibrationPendingMultiplier = current;
    startDiagnostics('calibration');
    diagnosticEvent('calibration_multiplier', { flowMultiplier: round(current, 4) });
    emitSkinChanged();
    log(`Flow Calibration started (${calibrationModeConfig().label}) at flowMultiplier=${Number.isFinite(current) ? current.toFixed(3) : 'unknown'}. EMPTY BASKET; actual-water safety cap=${calibrationModeConfig().hardStopG} g.`);
  }

  // A recalibration is a re-measurement of the same machine. Merge its points into
  // the existing map instead of replacing it: the covered range keeps learning, and
  // a new run can only extend or refine the curve. The map keeps its identity
  // (createdAt) so command overrides and adaptive history stay bound to it; a
  // genuinely different machine state shows up as a new flowMultiplier, which the
  // learning fingerprint does check.
  function mergeCalibrationMap(previous, next) {
    if (!next || next.valid !== true || !Array.isArray(next.points) || next.points.length < 2) return next;
    const usablePrevious = previous && previous.valid === true && Number(previous.schema || 0) >= 3 && Array.isArray(previous.points) && previous.points.length >= 2;
    if (!usablePrevious) return next;
    const near = value => Math.max(0.05, Math.abs(Number(value)) * 0.02);
    const fresh = next.points.map(p => ({ ...p, source: "new" }));
    let replaced = 0, added = 0;
    const kept = previous.points.map(p => {
      const clash = fresh.find(q => Math.abs(Number(q.actualFlow) - Number(p.actualFlow)) <= near(p.actualFlow));
      if (clash) { replaced += 1; return { ...clash }; }
      return { ...p, source: p.source || "retained" };
    });
    for (const q of fresh) {
      if (!kept.some(m => Math.abs(Number(m.actualFlow) - Number(q.actualFlow)) <= near(q.actualFlow))) { kept.push({ ...q }); added += 1; }
    }
    kept.sort((a, b) => Number(a.actualFlow) - Number(b.actualFlow));
    const monotonic = [];
    let dropped = 0;
    for (const p of kept) {
      const last = monotonic[monotonic.length - 1];
      if (last && Number(p.commandFlow) <= Number(last.commandFlow) + 1e-6) {
        dropped += 1;
        if (p.source === "new" && last.source !== "new") monotonic[monotonic.length - 1] = p;
        continue;
      }
      monotonic.push(p);
    }
    const retained = monotonic.filter(p => p.source !== "new").length;
    return {
      ...next,
      createdAt: previous.createdAt || next.createdAt,
      baseFlowMultiplier: Number.isFinite(Number(next.baseFlowMultiplier)) ? next.baseFlowMultiplier : previous.baseFlowMultiplier,
      suggestedFlowMultiplier: Number.isFinite(Number(next.suggestedFlowMultiplier)) ? next.suggestedFlowMultiplier : previous.suggestedFlowMultiplier,
      revisedAt: new Date().toISOString(),
      revision: Number(previous.revision || 1) + 1,
      points: monotonic,
      actualRange: [Number(monotonic[0].actualFlow), Number(monotonic[monotonic.length - 1].actualFlow)],
      merge: {
        at: new Date().toISOString(),
        previousRevision: Number(previous.revision || 1),
        retained,
        added,
        replaced,
        droppedNonMonotonic: dropped
      }
    };
  }

  function adoptCalibrationMap(next) {
    const merged = mergeCalibrationMap(state.calibrationMap, next);
    state.calibrationMap = merged;
    state.calibrationPendingMultiplier = null;
    storageWrite(STORAGE_CAL, merged);
    // Only a brand-new LUT identity drops the learned commands. A merge keeps them:
    // the adaptive evidence is bound to the machine context, not to the point list.
    if (!merged.merge) {
      state.testOverrides = null;
      state.adaptiveHistory = [];
      storageWrite(STORAGE_TEST_OVERRIDES, "");
      storageWrite(STORAGE_PENDING_MULT, "");
    }
    recomputeCalibrationUsability();
    return merged;
  }

  async function finalizeCalibrationRun(result) {
    if (!state.calibrationActive || state.calibrationFinalizeBusy) return;
    state.calibrationFinalizeBusy = true;
    try {
      const run = state.diagnosticCurrent;
      if (!run || run.kind !== 'calibration') {
        state.calibrationActive = false;
        state.phase = 'idle';
        return;
      }
      diagnosticSample('calibration_final', true);
      run.endedAt = new Date().toISOString();
      run.result = String(result || 'calibration ended');
      const base = Number(run.config && run.config.flowMultiplier);
      const analysis = analyzeCalibrationRun(run, Number.isFinite(base) ? base : state.flowMultiplierCurrent);
      run.calibration = analysis;
      run.summary = diagnosticSummary(run);
      state.calibrationLast = {
        result: run.result,
        valid: analysis.valid,
        createdAt: new Date().toISOString(),
        plateauResults: analysis.plateauResults,
        map: analysis.map
      };
      state.diagnosticLast = run;
      state.diagnosticCurrent = null;
      state.diagnosticLastSampleAtMs = 0;
      state.calibrationActive = false;
      state.phase = 'idle';

      if (analysis.valid) {
        const map = adoptCalibrationMap(analysis.map);
        log(`Flow Calibration VALID: ${map.points.length} LUT points (${map.algorithm}), real-flow range ${map.actualRange[0]}..${map.actualRange[1]} g/s.` +
          (map.merge ? ` Merged with revision ${map.merge.previousRevision}: ${map.merge.retained} retained, ${map.merge.added} new, ${map.merge.replaced} replaced.` : ` New LUT identity.`) +
          ` Suggested DE1 flowMultiplier=${map.suggestedFlowMultiplier ?? 'n/a'}.`);
        if (state.cfg.calibrationAutoSync) {
          try { await syncHyperExProfile(false); }
          catch (error) { state.profileSyncStatus = `Auto-sync failed: ${error.message || error}`; log(state.profileSyncStatus); }
        }
      } else {
        log('Flow Calibration INVALID: one or more HyperEx real-flow targets failed the target-search quality gate (or Full staircase coverage was insufficient). Existing valid LUT was kept unchanged and HyperEx was NOT auto-synced.');
      }
      emitSkinChanged();
    } finally {
      state.calibrationFinalizeBusy = false;
    }
  }

  async function handleCalibrationMachine(machine, pourHasBegun) {
    if (!state.calibrationArmed && !state.calibrationActive) return false;
    if (!state.calibrationActive && machine.machineState === 'espresso' && pourHasBegun) {
      const preflight = waterPreflightStatus();
      const preflightApproved = Date.now() <= Number(state.calibrationWaterPreflightApprovedUntilMs || 0);
      const mustBlock = preflight.status === 'block' || ((preflight.status === 'unknown' || preflight.status === 'warn') && !preflightApproved);
      if (mustBlock) {
        log(`CALIBRATION WATER PREFLIGHT STOP: ${preflight.message}${preflightApproved ? '' : ' Use PREPARE FLOW CAL for explicit confirmation.'}`);
        try { await requestMachineState('idle'); } catch (_) {}
        return true;
      }
      await beginCalibrationRun();
      return true;
    }
    if (!state.calibrationActive) return true;

    if (Number(machine.pressure) > state.cfg.hardPressureLimit) {
      state.calibrationHardPressureSamples += 1;
      if (state.calibrationHardPressureSamples >= 3) {
        log(`CALIBRATION EMERGENCY STOP: pressure > ${state.cfg.hardPressureLimit.toFixed(2)} bar for 3 samples.`);
        try { await requestMachineState('idle'); } catch (_) {}
        await finalizeCalibrationRun('aborted: pressure safety');
        return true;
      }
    } else {
      state.calibrationHardPressureSamples = 0;
    }

    const waterCap = calibrationModeConfig().hardStopG;
    if (Number.isFinite(waterCap) && state.cumulativeWeight >= waterCap) {
      log(`CALIBRATION WATER SAFETY STOP: collected ${state.cumulativeWeight.toFixed(1)} g reached ${waterCap} g cap (${calibrationModeConfig().label}). Requesting Idle to stay below 300 ml.`);
      try { await requestMachineState('idle'); } catch (_) {}
      await finalizeCalibrationRun(`water safety stop at ${state.cumulativeWeight.toFixed(1)} g`);
      return true;
    }

    if (machine.machineState === 'idle' || machine.substate === 'pouringDone') {
      await finalizeCalibrationRun('completed');
    }
    return true;
  }

  function resetWeightTracking(rawWeight) {
    state.rawBaseline = Number.isFinite(rawWeight) ? rawWeight : null;
    state.lastRawWeight = Number.isFinite(rawWeight) ? rawWeight : null;
    state.cumulativeOffset = 0;
    state.cumulativeWeight = 0;
    state.hasScaleSample = Number.isFinite(rawWeight);
  }

  function updateCumulativeWeight(rawWeight) {
    if (!Number.isFinite(rawWeight)) return state.cumulativeWeight;

    state.hasScaleSample = true;
    clearTimer("noScaleTimer");

    if (state.rawBaseline === null || state.lastRawWeight === null) {
      state.rawBaseline = rawWeight;
      state.lastRawWeight = rawWeight;
      state.cumulativeWeight = state.cumulativeOffset;
      return state.cumulativeWeight;
    }

    const downwardJump = state.lastRawWeight - rawWeight;
    if (downwardJump >= state.cfg.scaleResetThreshold) {
      const carried = state.cumulativeWeight;
      state.cumulativeOffset = carried;
      state.rawBaseline = rawWeight;
      state.lastRawWeight = rawWeight;
      state.cumulativeWeight = carried;
      log(`Detected scale tare/reset (${downwardJump.toFixed(2)} g drop); carrying cumulative ${carried.toFixed(2)} g.`);
      return state.cumulativeWeight;
    }

    let total = state.cumulativeOffset + (rawWeight - state.rawBaseline);
    if (!Number.isFinite(total)) total = state.cumulativeWeight;
    // Do not let minor scale noise make the logical cumulative weight run backwards by more than 0.5 g.
    if (total < state.cumulativeWeight - 0.5) total = state.cumulativeWeight;
    state.cumulativeWeight = Math.max(0, total);
    state.lastRawWeight = rawWeight;
    return state.cumulativeWeight;
  }

  function resetSequence(reason) {
    let completedDiagnosticRun = null;
    if (state.diagnosticCurrent) completedDiagnosticRun = finalizeDiagnostics(reason || "reset");
    clearAllTimers();
    const previous = state.phase;
    if (previous === "restart_wait") {
      stopGhcPrompt("cleared", "GHC confirmation wait cleared");
    } else {
      state.ghcPromptStartedAtMs = 0;
    }
    state.phase = "idle";
    if (state.liveTrimDirty) {
      invalidateProfileTruth("Experimental raw frame changed; restoring original profile before next shot", true);
      state.liveTrimDirty = false;
    }
    state.lowFlowSamples = 0;
    state.idleConfirmedAtMs = 0;
    state.dumpAcceptedAtMs = 0;
    state.dumpReinforceSent = false;
    state.hardPressureSamples = 0;
    state.dumpRequestedAtMs = 0;
    state.dumpAcceptedAtMs = 0;
    state.dumpReinforceSent = false;
    state.lastMachineAtMs = 0;
    state.commandBusy = false;
    state.stage1DumpSent = false;
    state.stage2SkipSent = false;
    state.finalStopSent = false;
    state.sequenceStartedAtMs = 0;
    state.soakPromptStartedAtMs = 0;
    state.soakSecondsRemaining = 0;
    state.ghcSecondsRemaining = 0;
    state.armRequestCount = 0;
    state.lastArmRequestAtMs = 0;
    state.rawBaseline = null;
    state.lastRawWeight = null;
    state.cumulativeOffset = 0;
    state.cumulativeWeight = 0;
    state.hasScaleSample = false;
    emitSkinChanged();
    if (reason) log(`Sequence reset (${previous} -> idle): ${reason}`);
    if (reason && state.workflowTitle === (state.cfg && state.cfg.profileTitle)) scheduleProfileVerification('sequence reset');
    if (completedDiagnosticRun && /^completed at /i.test(String(reason || "")) && state.autoApplyNextShot) {
      state.autoApplyLastStatus = {runId:completedDiagnosticRun.runId,status:"scheduled",at:new Date().toISOString(),message:"Completed shot queued for next-shot evaluation"};
      state.autoApplyTimer = setTimeout(() => {
        state.autoApplyTimer = null;
        return autoApplyNextShotIfEligible(completedDiagnosticRun);
      }, 250);
    }
  }

  function abortSequence(reason, requestIdle) {
    if (state.phase === "idle" || state.phase === "aborted") return;
    diagnosticEvent("learning_fault",{reason:String(reason||"sequence aborted")});
    const wasRestartWait = state.phase === "restart_wait";
    clearAllTimers();
    if (wasRestartWait) {
      stopGhcPrompt("timeout", `GHC confirmation cancelled: ${reason}`);
    }
    state.phase = "aborted";
    log(`ABORT: ${reason}`);
    if (requestIdle) {
      requestMachineState("idle").catch((error) => log(`Abort idle command failed: ${error.message || error}`));
    }
    if(state.abortResetTimer)clearTimeout(state.abortResetTimer);
    state.abortResetTimer=setTimeout(()=>{state.abortResetTimer=null;if(state.phase==="aborted")resetSequence(reason);},1200);
  }

  function startSequence(rawWeight) {
    refreshLearningStage();
    if (state.autoApplyTimer !== null) state.autoApplyLastStatus = {status:"cancelled",at:new Date().toISOString(),message:"New shot started before pending adaptation; current shot commands retained"};
    clearAllTimers();
    state.phase = "stage1";
    state.directStartTestEnabledForRun = !!state.cfg.directDriverStartTest;
    state.directStartTest = null;
    state.lowFlowSamples = 0;
    state.idleConfirmedAtMs = 0;
    state.hardPressureSamples = 0;
    state.stage1DumpSent = false;
    state.stage2SkipSent = false;
    state.finalStopSent = false;
    state.sequenceStartedAtMs = Date.now();
    state.soakSecondsRemaining = 0;
    state.ghcSecondsRemaining = 0;
    state.armRequestCount = 0;
    state.lastArmRequestAtMs = 0;
    resetWeightTracking(rawWeight);
    startDiagnostics("hyperex");
    initializeLiveTrim();
    if(!activeReleaseEnabled(state.cfg))startLiveTrim();
    diagnosticSample("sequence-start", true);

    state.noScaleTimer = setTimeout(() => {
      if (!state.hasScaleSample && state.phase !== "idle") {
        abortSequence(`No usable scale snapshot received within ${state.cfg.noScaleTimeoutSeconds}s`, true);
      }
    }, state.cfg.noScaleTimeoutSeconds * 1000);

    state.maxRunTimer = setTimeout(() => {
      if (state.phase !== "idle") abortSequence(`Maximum sequence time ${state.cfg.maxRunSeconds}s exceeded`, true);
    }, state.cfg.maxRunSeconds * 1000);

    log(`START stage1: desired real ${state.cfg.stage1Flow.toFixed(2)} g/s -> DE1 command ${resolvedStageCommandFlow("stage1", state.cfg.stage1Flow).toFixed(2)} ml/s, dump at ${state.cfg.stage1Weight.toFixed(2)} g; scale=${state.hasScaleSample ? "ready" : "waiting"}.`);
  }

  function dumpLooksReleased(machine) {
    if (!machine) return false;
    if (machine.machineState === "idle") return true;
    if (machine.substate === "pouringDone") return true;
    const flow = Number(machine.flow);
    const pressure = Number(machine.pressure);
    const lowFlow = Number.isFinite(flow) && Math.abs(flow) <= state.cfg.dumpFlowThreshold;
    const lowPressure = Number.isFinite(pressure) && pressure <= 0.8;
    return lowFlow && lowPressure;
  }

  function confirmDumpIdle(source, machine) {
    if (state.phase !== "dumping" || state.idleConfirmedAtMs) return;
    state.idleConfirmedAtMs = Date.now();
    clearTimer("idlePollTimer");
    clearTimer("dumpFallbackTimer");
    const pressure = machine && Number.isFinite(Number(machine.pressure)) ? Number(machine.pressure) : state.lastPressure;
    const flow = machine && Number.isFinite(Number(machine.flow)) ? Number(machine.flow) : state.lastFlow;
    log(`Active release confirmed via ${source}; pressure=${pressure.toFixed(2)} bar, flow=${flow.toFixed(2)} ml/s. Holding ${state.cfg.dumpMinSettleSeconds.toFixed(1)} s for valve/water-path settling.`);

    state.dumpSettleTimer = setTimeout(() => {
      state.dumpSettleTimer = null;
      if (state.phase !== "dumping") return;
      beginSoak(`${source} + ${state.cfg.dumpMinSettleSeconds.toFixed(1)} s timed water-path settle`);
    }, state.cfg.dumpMinSettleSeconds * 1000);
  }

  function noteMachine(machine) {
    if (!machine) return;
    state.lastMachineAtMs = Date.now();
    state.lastMachineState = machine.machineState;
    state.lastSubstate = machine.substate;
    state.lastPressure = machine.pressure;
    state.lastMachineTelemetryValid = machine.telemetryValid === true;
    state.lastFlow = machine.flow;
    state.lastTargetFlow = machine.targetFlow;
    state.lastTargetPressure = machine.targetPressure;
    state.lastMachineWeightFlow = machine.machineWeightFlow;
    diagnosticSample("machine", false);
  }

  function pollForDumpIdle() {
    clearTimer("idlePollTimer");
    const poll = async () => {
      if (state.phase !== "dumping" || state.idleConfirmedAtMs) return;
      try {
        const snapshot = await getMachineSnapshot();
        const machine = extractMachine(snapshot);
        noteMachine(machine);
        const elapsed = state.dumpAcceptedAtMs ? (Date.now() - state.dumpAcceptedAtMs) / 1000 : 0;
        if (machine.machineState === "idle") {
          confirmDumpIdle("REST idle", machine);
          return;
        }
        if (elapsed >= state.cfg.dumpMinSettleSeconds && dumpLooksReleased(machine)) {
          confirmDumpIdle(`REST settled (${machine.machineState || "?"}/${machine.substate || "?"})`, machine);
          return;
        }
      } catch (error) {
        log(`Release-state poll transient error: ${error.message || error}`);
      }
      if (state.phase === "dumping" && !state.idleConfirmedAtMs) {
        state.idlePollTimer = setTimeout(poll, 150);
      }
    };
    state.idlePollTimer = setTimeout(poll, 120);
  }

  function armDumpFallback() {
    clearTimer("dumpFallbackTimer");
    state.dumpFallbackTimer = setTimeout(async () => {
      state.dumpFallbackTimer = null;
      if (state.phase !== "dumping" || state.idleConfirmedAtMs) return;
      state.dumpReinforceSent = true;
      log(`No definitive Idle frame after ${state.cfg.dumpFallbackSeconds.toFixed(1)} s; reinforcing active release with one more Idle request.`);
      try {
        await requestMachineState("idle");
      } catch (error) {
        log(`Release reinforcement Idle failed: ${error.message || error}`);
        return;
      }

      // Give the valve/state stream a short chance to settle after the reinforced write.
      setTimeout(async () => {
        if (state.phase !== "dumping" || state.idleConfirmedAtMs) return;
        try {
          const snapshot = await getMachineSnapshot();
          const machine = extractMachine(snapshot);
          noteMachine(machine);
          if (dumpLooksReleased(machine) || machine.machineState !== "espresso") {
            confirmDumpIdle(`reinforced Idle + REST (${machine.machineState || "?"}/${machine.substate || "?"})`, machine);
            return;
          }
          const flow = Number(machine.flow);
          const clearlyStillPouring = machine.machineState === "espresso" &&
            (machine.substate === "preinfusion" || machine.substate === "pouring") &&
            Number.isFinite(flow) && Math.abs(flow) > Math.max(0.8, state.cfg.dumpFlowThreshold);
          if (clearlyStillPouring) {
            log(`Reinforced Idle not yet settled: still ${machine.substate}, flow=${flow.toFixed(2)} ml/s; continuing polls.`);
            return;
          }
          // The state is ambiguous but the DE1 acknowledged two Idle writes. Do not throw away
          // the coffee merely because finalize hid the exact Idle frame.
          confirmDumpIdle(`two acknowledged Idle writes; state ambiguous ${machine.machineState || "?"}/${machine.substate || "?"}`, machine);
        } catch (error) {
          // During shot finalization the current-state endpoint can briefly be unavailable.
          // Two acknowledged Idle writes are stronger evidence than a missing REST frame.
          log(`Post-reinforcement state read unavailable (${error.message || error}); accepting two acknowledged Idle writes as release confirmation.`);
          confirmDumpIdle("two acknowledged Idle writes; REST unavailable during finalize", null);
        }
      }, 450);
    }, state.cfg.dumpFallbackSeconds * 1000);
  }

  function beginDump() {
    if (!activeReleaseEnabled(state.cfg)||state.stage1DumpSent || state.phase !== "stage1") return;
    state.stage1DumpSent = true;
    state.phase = "dumping";
    state.lowFlowSamples = 0;
    state.idleConfirmedAtMs = 0;
    state.dumpAcceptedAtMs = 0;
    state.dumpReinforceSent = false;
    state.dumpRequestedAtMs = Date.now();
    emitSkinChanged();
    diagnosticEvent("stage1_weight_trigger", { cumulativeWeightG: round(state.cumulativeWeight, 3) });
    log(`Stage1 reached ${state.cumulativeWeight.toFixed(2)} g. Requesting active water-path release via Espresso -> Idle.`);

    state.dumpTimer = setTimeout(async () => {
      if (state.phase !== "dumping") return;
      // Final guard: only abort when fresh telemetry explicitly says the machine is still
      // pouring with meaningful flow. Otherwise preserve the shot and continue after the
      // already-acknowledged Idle release request(s).
      let machine = null;
      try {
        const snapshot = await getMachineSnapshot();
        machine = extractMachine(snapshot);
        noteMachine(machine);
      } catch (_) {}
      const flow = machine ? Number(machine.flow) : NaN;
      const explicitlyStillPouring = machine && machine.machineState === "espresso" &&
        (machine.substate === "preinfusion" || machine.substate === "pouring") &&
        Number.isFinite(flow) && Math.abs(flow) > Math.max(0.8, state.cfg.dumpFlowThreshold);
      if (explicitlyStillPouring) {
        abortSequence(`Active release still shows ${machine.substate} at ${flow.toFixed(2)} ml/s after ${state.cfg.dumpTimeoutSeconds}s`, true);
      } else if (state.dumpAcceptedAtMs) {
        confirmDumpIdle("release timeout fallback after acknowledged Idle", machine);
      } else {
        abortSequence(`Idle release command was never acknowledged within ${state.cfg.dumpTimeoutSeconds}s`, true);
      }
    }, state.cfg.dumpTimeoutSeconds * 1000);

    requestMachineState("idle")
      .then(() => {
        if (state.phase !== "dumping") return;
        state.dumpAcceptedAtMs = Date.now();
        pollForDumpIdle();
        armDumpFallback();
      })
      .catch((error) => {
        log(`Initial active dump command failed: ${error.message || error}; retrying once.`);
        setTimeout(() => {
          if (state.phase !== "dumping") return;
          requestMachineState("idle")
            .then(() => {
              state.dumpAcceptedAtMs = Date.now();
              state.dumpReinforceSent = true;
              pollForDumpIdle();
              armDumpFallback();
            })
            .catch((retryError) => abortSequence(`Active dump command failed twice: ${retryError.message || retryError}`, true));
        }, 300);
      });
  }


  function beginSoak(reason) {
    if (state.phase !== "dumping") return;
    clearTimer("dumpTimer");
    clearTimer("dumpSettleTimer");
    clearTimer("dumpFallbackTimer");
    clearTimer("idlePollTimer");
    state.phase = "soak";
    state.armRequestCount = 0;
    state.lastArmRequestAtMs = 0;
    const soakStartWeight = state.cumulativeWeight;
    diagnosticEvent("soak_start", { reason, cumulativeWeightG: round(soakStartWeight, 3), pressureBar: round(state.lastPressure, 3), machineFlowMlS: round(state.lastFlow, 3) });
    log(`Active-release confirmed (${reason}); pressure=${state.lastPressure.toFixed(2)} bar, flow=${state.lastFlow.toFixed(2)} ml/s. Starting ${state.cfg.soakSeconds.toFixed(1)} s soak at ${soakStartWeight.toFixed(2)} g.`);
    startSoakCountdown();
    startLiveTrim(); // Connection preparation only; soak never sends A010 or spends checks.

    state.soakTimer = setTimeout(() => {
      state.soakTimer = null;
      clearTimer("soakCountdownTimer");
      state.soakSecondsRemaining = 0;
      if (state.phase !== "soak") return;
      state.phase = "restart_wait";
      state.armRequestCount = 1;
      state.lastArmRequestAtMs = Date.now();
      emitSkinChanged();
      diagnosticEvent("soak_complete_arm1", { cumulativeWeightG: round(state.cumulativeWeight, 3) });
      log(`Soak complete at cumulative ${state.cumulativeWeight.toFixed(2)} g. Sending second-stage Espresso arm request now.`);
      if (state.directStartTestEnabledForRun) {
        beginDirectStartTest();
        return;
      }
      requestMachineState("espresso")
        .then(() => startRestartPoll())
        .catch((error) => abortSequence(`Espresso restart failed: ${error.message || error}`, false));
    }, state.cfg.soakSeconds * 1000);
  }



  // Optional REST -> raw startup attempt retains the original GHC guard and retries.

  // User-authorized experiment: direct writes to the current flow frame, never skipStep.
  // Firmware live-frame semantics are unverified; ACK is distinct from target feedback.

  function controlRunReview(run) {
    if(!run||run.kind!=="hyperex")return null;
    const excluded=!learningRunAllowed(run);
    const trace=run.liveFlowTrim&&run.liveFlowTrim.trace||[],writes=trace.filter(x=>x.kind==="write").sort((a,b)=>a.tMs-b.tMs);
    const phases=(run.config&&run.config.activeRelease===false?["stage1","stage2","stage3"]:["stage2","stage3"]).map(phase=>{
      const q=controlOutputQuality(run,phase),learning=controlLearningAssessment(run,phase);
      const good=q.available&&Math.abs(q.tailErrorPct)<=8&&q.tailRippleCVPct<=10;
      const status=!q.available?"缺少可靠杯流量窗口":good?"目标跟踪及平滑度良好":Math.abs(q.tailErrorPct)>8?"杯流量仍偏离目标":"均值接近目标，波动仍需改善";
      const phaseWrites=writes.filter(x=>phase==="stage1"?Number(x.frame)===0:phase==="stage2"?Number(x.frame)===1:Number(x.frame)>=2);
      const groups=[];
      for(const w of phaseWrites){const g=groups[groups.length-1];if(g&&g.frame===Number(w.frame)&&w.tMs-g.lastMs<3000){g.lastMs=w.tMs;g.writes++;}else groups.push({frame:Number(w.frame),firstMs:w.tMs,lastMs:w.tMs,writes:1});}
      const raw=phaseRawSamples(run,phase),target=Number(desiredRealForRunPhase(run,phase));
      const window=(frame,lo,hi)=>{const a=raw.filter(x=>Number(x.profileFrame)===frame&&Number(x.tMs)>=lo&&Number(x.tMs)<=hi),seen=new Set();const rows=a.filter(x=>{const t=finiteOrNull(x.scaleTimestampSeconds);if(t===null||seen.has(t))return false;seen.add(t);return true;});if(rows.length<6||rows.some((x,i)=>i>0&&(Number(x.scaleTimestampSeconds)<=Number(rows[i-1].scaleTimestampSeconds)||Number(x.scaleTimestampSeconds)-Number(rows[i-1].scaleTimestampSeconds)>.6)))return null;const r=regressionForRawSamples(rows);return r&&r.seconds>=1.2&&r.r2>=.90&&r.slope>0?r:null;};
      for(let i=0;i<groups.length;i++){
        const g=groups[i],before=window(g.frame,g.firstMs-1800,g.firstMs-100),next=groups[i+1];
        const after=window(g.frame,g.lastMs+750,Math.min(g.lastMs+2750,next?next.firstMs-100:Infinity));
        g.attribution=g.writes>1?"重叠动作组，仅评价组合后的变化":"单次动作前后变化，不能单凭一次观察确定因果";
        if(!before||!after){g.status="前后有效窗口不足，保留记录";continue;}
        g.beforeGS=before.slope;g.afterGS=after.slope;g.errorReductionGS=round(Math.abs(before.slope-target)-Math.abs(after.slope-target),3);
        g.status=g.errorReductionGS>target*.02?"组后目标误差减小":g.errorReductionGS< -target*.02?"组后目标误差增大":"组前后变化较小";
      }
      return {phase,status,output:q,writes:phaseWrites.length,actionGroups:groups,
        learningStatus:excluded?"Shot excluded from learning":learning.applicable?(learning.eligible?"已纳入学习候选；仍经过杯间共识与限幅":"暂未纳入："+learning.reason):"使用原固定曲线学习规则"};
    });
    const good=phases.every(x=>x.output.available&&Math.abs(x.output.tailErrorPct)<=8&&x.output.tailRippleCVPct<=10);
    return {status:good?"本杯后段目标跟踪及平滑度良好":"本杯仍有偏差或数据不足，详情见阶段诊断",phases,
      controllerStatus:run.liveFlowTrim&&run.liveFlowTrim.status||"未开启杯内调流",writes:writes.length,
      note:"自动分析用于日常判断；动作响应重叠时评价组合效果。无需日常上传截图或CSV；异常时可选择导出深入排查。"};
  }


  function controlOutputQuality(run,phase) {
    const target=desiredRealForRunPhase(run,phase),raw=phaseRawSamples(run,phase),whole=diagnosticRawRegression(run,phase);
    if(!target||raw.length<6)return {available:false};
    const stamps=new Set(),data=raw.filter(x=>{const t=finiteOrNull(x.scaleTimestampSeconds);if(t===null||stamps.has(t))return false;stamps.add(t);return true;});
    if(data.length<6)return {available:false};
    const lo=Number(data[0].scaleTimestampSeconds),hi=Number(data[data.length-1].scaleTimestampSeconds),tail=lo+(hi-lo)*.4;
    const flows=[];
    for(let i=0;i<data.length;i++){
      const end=Number(data[i].scaleTimestampSeconds);if(end<tail+1.2)continue;
      const rows=data.slice(0,i+1).filter(x=>Number(x.scaleTimestampSeconds)>=Math.max(tail,end-2));
      if(rows.length<6||rows.some((x,j)=>j>0&&(Number(x.scaleTimestampSeconds)<=Number(rows[j-1].scaleTimestampSeconds)||Number(x.scaleTimestampSeconds)-Number(rows[j-1].scaleTimestampSeconds)>.6)))continue;
      const r=regressionForRawSamples(rows);if(r&&r.seconds>=1.2&&r.r2>=.90&&r.slope>0)flows.push(r.slope);
    }
    const mean=average(flows),variance=mean===null?null:average(flows.map(x=>(x-mean)*(x-mean)));
    return {available:!!flows.length,targetGS:target,wholePhaseErrorPct:whole?round((whole.slope/target-1)*100,2):null,
      tailMeanGS:round(mean,3),tailErrorPct:mean===null?null:round((mean/target-1)*100,2),tailRippleCVPct:mean?round(Math.sqrt(variance)/mean*100,2):null,
      tailRMSEGS:flows.length?round(Math.sqrt(average(flows.map(x=>(x-target)*(x-target)))),3):null,
      tailOvershootPct:flows.length?round(Math.max(0,Math.max(...flows)/target-1)*100,2):null,windows:flows.length,
      basis:"actual RAW g/s; rolling regressions over final60% of phase, separate from normalized learning model"};
  }

  // Steady-tail machine gain: cup flow (RAW) divided by the machine's own flow
  // over the same tail window. This is the physical feed-forward the 1.80ds field
  // data supports (S2 5.16/4.6 = 1.12, S3 1.53/0.75 = 2.0). It does not depend on
  // the calibration LUT, so a stale LUT cannot bias the next-shot command.
  function tailMachineGain(run,phase,actuator){
    // Reuse the same safety gates as the normalized learner: fresh machine
    // telemetry, target/frame coverage, pressure headroom and actuator tracking.
    if(!actuator||!(Number(actuator.samples)>=4)||!(Number(actuator.total)>0)||Number(actuator.samples)<Number(actuator.total)*.7)return null;
    if(!(Number(actuator.pressureLimitedFraction)<.2)||!(Number(actuator.underCommandFraction)<.25))return null;
    const q=controlOutputQuality(run,phase);
    if(!q||!q.available||!(Number(q.tailMeanGS)>0))return null;
    const raw=phaseRawSamples(run,phase)||[];
    const samples=(run.samples||[]).filter(x=>x.phase===phase&&Number.isFinite(Number(x.machineFlowMlS))&&Number(x.machineFlowMlS)>0);
    if(raw.length<6||samples.length<4)return null;
    const first=Number(raw[0].tMs),last=Number(raw[raw.length-1].tMs),tailStart=first+(last-first)*.4;
    const flows=samples.filter(x=>Number(x.tMs)>=tailStart).map(x=>Number(x.machineFlowMlS));
    if(flows.length<4)return null;
    const m=median(flows);
    if(!(m>0))return null;
    const k=Number(q.tailMeanGS)/m;
    if(!(k>.2&&k<=3))return null;
    return {k,tailMeanGS:round(Number(q.tailMeanGS),3),machineFlowMlS:round(m,3),tailErrorPct:q.tailErrorPct,tailRippleCVPct:q.tailRippleCVPct};
  }

  // Use every measurable command epoch, not only the last attempted write.
  // Normalization is a local proportional response model, not a physical identity.
  function controlLearningAssessment(run,phase) {
    if(phase==="stage1")return stage1LiveLearning(run);
    const admission=learningAdmission(run);
    const c=run&&run.config||{},trace=run&&run.liveFlowTrim&&run.liveFlowTrim.trace||[];
    const frames=phase==="stage2"?[1]:(c.stage3Shape&&c.stage3Shape.enabled?[2,3,4]:[2]);
    const changed=!!c.experimentalLiveTrim&&trace.some(x=>x.kind==="write"&&frames.includes(Number(x.frame)));
    const report={admissionFactor:admission.factor,applicable:changed,eligible:false,basis:"confirmed-target windows normalized to shot-start seed (local model)",reason:"Original fixed-command evidence path",frames:[],outputQuality:changed?controlOutputQuality(run,phase):null,angleStats:computeAngleStats(run.liveFlowTrim,trace)};
    if(!changed)return report;
    if(phase==="stage2"&&report.outputQuality&&report.outputQuality.available&&report.outputQuality.tailRippleCVPct>admission.spread(12)){report.reason=`S2 tail ripple ${report.outputQuality.tailRippleCVPct}% exceeds ${round(admission.spread(12),2)}% learning limit`;return report;}
    const onset=phase==="stage2"?stage2CupOnset(run):null;
    if(onset&&!onset.detected){report.reason="S2 waiting for sustained cup outflow; pre-output time is excluded";return report;}
    report.cupFlowOnset=onset;
    let steadyAfter=onset?onset.startMs:-Infinity;
    if(phase==="stage2"&&c.s2StartupPlan&&c.s2StartupPlan.strategy==="refill-85"&&trace.some(x=>x.kind==="write"&&x.startupAction==="boost")){
      const completed=trace.find(x=>x.kind==="startup-complete"&&Number(x.frame)===1);
      if(!completed){report.reason="S2 refill base return unconfirmed; retain actual curve but withhold steady-level learning";return report;}
      steadyAfter=Math.max(steadyAfter,Number(completed.tMs)+200);
      report.refillExcludedUntilMs=steadyAfter;
    }
    const raw=phaseRawSamples(run,phase).filter(x=>Number(x.tMs)>=steadyAfter),allMachine=(run.samples||[]).filter(x=>x.phase===phase&&Number(x.tMs)>=steadyAfter).sort((a,b)=>a.tMs-b.tMs);
    const shape=c.stage3Shape&&c.stage3Shape.enabled?c.stage3Shape:null;
    const seedFor=f=>phase==="stage2"?Number(c.stage2CommandMlS):shape?Number(shape[f===2?"earlyCommand":f===3?"midCommand":"lateCommand"]):Number(c.stage3CommandMlS);
    const known=(m)=>{
      const f=Number(m.profileFrame),seed=seedFor(f),v=finiteOrNull(m.targetFlowMlS);
      if(!frames.includes(f)||!Number.isFinite(seed)||seed<=0||v===null||v<=0)return null;
      const base=Math.floor(seed*16+0.5)/16;
      if(v<LIMITS.commandFlowMin||v>LIMITS.commandFlowMax||v<base*.8-.02||v>base*1.2+.02)return null;
      // Firmware ramps its observed target through intermediate 1/16 quanta, so
      // an in-envelope echo that does not exactly equal a write is still a known
      // target (real 1.80ds shots: exact-match left only 47% coverage and blocked learning).
      return v;
    };
    const limit=finiteOrNull(c[phase+"PressureLimit"]),m0=allMachine.length?Number(allMachine[0].tMs):0;
    const machine=allMachine.filter(x=>Number(x.tMs)-m0>=1000);
    const valid=m=>m.machineTelemetryValid===true&&finiteOrNull(m.machineAgeMs)!==null&&Number(m.machineAgeMs)<=600&&known(m)!==null&&finiteOrNull(m.pressureBar)!==null&&Number(m.pressureBar)>=0&&finiteOrNull(m.machineFlowMlS)!==null&&Number(m.machineFlowMlS)>=0;
    const good=machine.filter(valid),near=good.filter(x=>limit!==null&&Number(x.pressureBar)>=limit*.95).length;
    const under=good.filter(x=>Number(x.machineFlowMlS)<known(x)*.7).length;
    report.actuator={samples:good.length,total:machine.length,pressureLimitedFraction:good.length?near/good.length:1,underCommandFraction:good.length?under/good.length:1};
    if(limit===null||limit<=0||good.length<4||good.length<.7*machine.length){report.reason="Live learning: fresh machine target/frame coverage below70% or fewer than4 samples";return report;}
    if(near/good.length>=.2){report.reason="Live learning: pressure limiter active in at least20% of samples";return report;}
    if(under/good.length>=.25){report.reason="Live learning: actual flow below70% of observed target in at least25% of samples";return report;}
    report.actuator.eligible=true;
    if(phase==="stage3"){
      const stability=stage3StabilityDiagnostics(run);
      if(stability&&stability.stall&&stability.stall.suspected){report.reason="Live learning: confirmed S3 stall; withhold normalized numeric evidence";return report;}
    }
    if(raw.length<admission.samples(6)){report.reason="Live learning: fewer than6 RAW scale samples after latest tare";return report;}
    const first=Number(raw[0].tMs),last=Number(raw[raw.length-1].tMs);
    const specs=phase==="stage2"?[{frame:1,name:"S2",lo:first,hi:last,seed:seedFor(1)}]:shape?
      frames.map((frame,i)=>({frame,name:["S3 EARLY","S3 MID","S3 LATE"][i],lo:first,hi:last,seed:seedFor(frame)})):
      [{frame:2,name:"S3 EARLY",lo:first,hi:first+(last-first)*.25,seed:seedFor(2)},
       {frame:2,name:"S3 MID",lo:first+(last-first)*.25,hi:first+(last-first)*.75,seed:seedFor(2)},
       {frame:2,name:"S3 LATE",lo:first+(last-first)*.75,hi:last,seed:seedFor(2)}];
    const sources=[];
    for(const spec of specs){
      const frameRaw=raw.filter(x=>Number(x.profileFrame)===spec.frame),start=frameRaw.length?Number(frameRaw[0].tMs):Infinity;
      const data=frameRaw.filter(x=>Number(x.tMs)>=spec.lo&&Number(x.tMs)<=spec.hi&&Number(x.tMs)-start>=1000);
      const epochs=[],paired=[];let epoch=null,mi=-1,previousStamp=null,previousWeight=null,block=0;
      for(const x of data){
        while(mi+1<allMachine.length&&Number(allMachine[mi+1].tMs)<=Number(x.tMs))mi++;
        const m=allMachine[mi],stamp=finiteOrNull(x.scaleTimestampSeconds),weight=finiteOrNull(x.weightG);
        if(stamp===null||weight===null||!m||Number(x.tMs)-Number(m.tMs)>600||Number(m.profileFrame)!==spec.frame||!valid(m)){
          epoch=null;previousStamp=null;previousWeight=null;block++;continue;
        }
        if(previousStamp!==null&&stamp<=previousStamp)continue; // duplicates/backward samples cannot add evidence
        const command=known(m),gap=previousStamp!==null&&stamp-previousStamp>.6;
        const reset=previousWeight!==null&&weight<previousWeight-.2;
        if(gap||reset){epoch=null;block++;}
        previousStamp=stamp;previousWeight=weight;
        paired.push({...x,command,block});
        if(!epoch||Math.abs(epoch.command-command)>.02){epoch={command,at:Number(x.tMs),rows:[]};epochs.push(epoch);}
        // Each command epoch settles briefly. Earlier good epochs survive a late unconfirmed write.
        if(Number(x.tMs)-epoch.at>=750)epoch.rows.push(x);
      }
      // Refill builds leave ~1.5s of steady RAW evidence in S2 (02-10-28 field
      // export); a 2.4s bar rejected a 1.52s r2=0.997 window every shot, so S2
      // never moved. Quality gates (R2/slope/coverage/cohort) still bound it.
      const minSeconds=admission.seconds(phase==="stage2"?1.5:1.2);
      const observedSpan=data.length?(Number(data[data.length-1].tMs)-Number(data[0].tMs))/1000:0;
      const assess=rows=>{
        const center=median(rows.map(x=>x.normalizedGS)),usable=rows.filter(x=>center>0&&Math.abs(x.normalizedGS/center-1)<=admission.spread(.25));
        const seconds=usable.reduce((a,x)=>a+x.seconds,0),candidateSeconds=rows.reduce((a,x)=>a+x.seconds,0);
        const coverage=observedSpan>0?seconds/observedSpan:0,cohort=candidateSeconds>0?seconds/candidateSeconds:0;
        const failures=[];if(!usable.length)failures.push("no usable RAW windows");if(seconds<minSeconds)failures.push(`usable ${round(seconds,2)}s < ${minSeconds}s`);
        if(coverage<admission.seconds(.25))failures.push(`temporal coverage ${round(coverage*100,1)}% < ${round(admission.seconds(25),2)}%`);
        if(cohort<admission.seconds(.6))failures.push(`consistent-window share ${round(cohort*100,1)}% < ${round(admission.seconds(60),2)}%`);
        return {usable,seconds,candidateSeconds,coverage,cohort,failures,eligible:failures.length===0};
      };
      let windows=epochs.map(e=>{const reg=regressionForRawSamples(e.rows);return reg&&reg.samples>=admission.samples(6)&&reg.seconds>=admission.seconds(1.2)&&reg.r2>=admission.r2(.90)&&reg.slope>0?
        {commandMlS:e.command,measuredGS:reg.slope,normalizedGS:reg.slope*spec.seed/e.command,r2:reg.r2,seconds:reg.seconds,samples:reg.samples,startMs:Number(e.rows[0].tMs),endMs:Number(e.rows[e.rows.length-1].tMs)}:null;}).filter(Boolean);
      let windowAssessment=assess(windows);
      if(!windowAssessment.eligible){
        // When commands change faster than a constant epoch can mature, integrate
        // observed target exposure over source-scale time instead. No invented
        // fixed command is paired with the changing trajectory.
        const chunks=[];let chunk=[];
        for(const row of paired){
          if(chunk.length&&row.block!==chunk[chunk.length-1].block){chunks.push(chunk);chunk=[];}
          if(chunk.length&&Number(row.scaleTimestampSeconds)-Number(chunk[0].scaleTimestampSeconds)>=2){
            chunk.push(row);chunks.push(chunk);chunk=[];
          }
          chunk.push(row);
        }
        if(chunk.length)chunks.push(chunk);
        const dynamic=chunks.map(rows=>{
          if(rows.length<6||rows.some(x=>x.block!==rows[0].block))return null;
          const rawReg=regressionForRawSamples(rows);if(!rawReg||rawReg.seconds<admission.seconds(1.2)||rawReg.r2<admission.r2(.90)||rawReg.slope<=0)return null;
          let exposure=0;const points=[{x:0,y:Number(rows[0].weightG)}];
          for(let i=1;i<rows.length;i++){
            const dt=Number(rows[i].scaleTimestampSeconds)-Number(rows[i-1].scaleTimestampSeconds);
            if(!(dt>0&&dt<=.6))return null;
            exposure+=dt*(rows[i].command+rows[i-1].command)/(2*spec.seed);
            points.push({x:exposure,y:Number(rows[i].weightG)});
          }
          const model=linearRegression(points);if(!model||model.r2<admission.r2(.90)||model.slope<=0)return null;
          return {commandMlS:spec.seed*exposure/rawReg.seconds,measuredGS:rawReg.slope,normalizedGS:model.slope,r2:Math.min(rawReg.r2,model.r2),seconds:rawReg.seconds,samples:rows.length,startMs:Number(rows[0].tMs),endMs:Number(rows[rows.length-1].tMs),dynamicExposure:true};
        }).filter(Boolean);
        const alternative=assess(dynamic);
        if(alternative.eligible||alternative.seconds>windowAssessment.seconds){windows=dynamic;windowAssessment=alternative;}
      }
      const {usable,seconds}=windowAssessment;
      const info={frame:spec.frame,name:spec.name,seedCommandMlS:spec.seed,windows:usable,windowCount:usable.length,seconds:round(seconds,2),discardedEpochs:Math.max(0,epochs.length-usable.length),
        admission:{eligible:windowAssessment.eligible,usableSeconds:round(seconds,2),minimumSeconds:minSeconds,candidateSeconds:round(windowAssessment.candidateSeconds,2),temporalCoveragePct:round(windowAssessment.coverage*100,1),minimumTemporalCoveragePct:round(admission.seconds(25),2),consistentWindowSharePct:round(windowAssessment.cohort*100,1),minimumConsistentWindowSharePct:round(admission.seconds(60),2),failures:windowAssessment.failures}};
      report.frames.push(info);
      if(!windowAssessment.eligible){report.reason=`Live learning: ${spec.name} withheld: ${windowAssessment.failures.join("; ")}. RAW windows require >=${round(admission.seconds(1.2),2)}s,${admission.samples(6)}unique samples,R²>=${admission.r2(.90)}`;return report;}
      const mean=usable.reduce((a,x)=>a+x.normalizedGS*x.seconds,0)/seconds;
      sources.push({name:spec.name,command:round(spec.seed,3),measured:round(mean,3),r2:round(Math.min(...usable.map(x=>x.r2)),5),seconds:round(seconds,2),quality:"target-normalized local model"});
    }
    const duration=sources.reduce((a,x)=>a+x.seconds,0);
    if(phase==="stage3"&&duration<admission.seconds(5)){report.reason=`Live learning: S3 confirmed-target windows total below${round(admission.seconds(5),2)}s`;return report;}
    report.eligible=true;report.reason=`Live learning admitted: ${sources.length} region(s), ${round(duration,2)}s across ${report.frames.reduce((a,x)=>a+x.windowCount,0)} confirmed-target windows; response normalized to starting seed using a local proportional model`;
    if(phase==="stage2"){
      const x=sources[0],target=Number(c.stage2Flow);
      report.evidence={runId:run.runId,targetGS:target,command:x.command,measured:x.measured,errorPct:round((x.measured/target-1)*100,1),confidence:"MEDIUM",r2:x.r2,seconds:x.seconds,measurementBasis:report.basis};
    }else{
      const overall=sources.reduce((a,x)=>a+x.measured*x.seconds,0)/duration,ratio=sources[2].measured/sources[0].measured;
      report.evidence={runId:run.runId,targetGS:Number(c.stage3Flow),status:ratio<.75?"LATE DECAY":"STABLE",stall:false,stallQualitative:false,
        lateToEarlyRatio:round(ratio,3),overallGS:round(overall,3),overallR2:Math.min(...sources.map(x=>x.r2)),overallSeconds:round(duration,2),
        earlySeconds:shape?Number(shape.earlySeconds):8,midSeconds:shape?Number(shape.midSeconds):14,
        measurementBasis:shape?"live target-normalized frame windows":"live target-normalized stability windows",normalizationModel:report.basis,source:sources};
    }
    return report;
  }


  // Single-shot command-chain evidence: consecutive same-direction steady writes
  // are direct proof that the mapped command sits below the target. This replaces
  // the old "wait 2 s and keep a 5 s stable window" gate for next-shot learning.
  function liveTrimChainEvidence(run){
    const trace=(run&&run.liveFlowTrim&&run.liveFlowTrim.trace)||[];
    const writes=trace.filter(x=>x.kind==="write"&&Number(x.frame)===1&&!x.startupAction&&Number.isFinite(Number(x.commandMlS)));
    if(writes.length<2)return null;
    let chain=null,best=null,lastStep=null;
    for(const w of writes){
      const prev=chain&&chain[chain.length-1];
      const step=prev?Number(w.commandMlS)-Number(prev.commandMlS):Number(w.commandMlS)-Number(w.previousMlS);
      const same=prev&&Number.isFinite(step)&&Number.isFinite(lastStep)&&step!==0&&Math.sign(step)===Math.sign(lastStep)&&Number(w.tMs)-Number(prev.tMs)<=4000;
      chain=same?chain.concat([w]):[w];
      if(step!==null)lastStep=step;
      if(!best||chain.length>best.length)best=chain.slice();
    }
    if(!best||best.length<2)return null;
    const first=best[0],last=best[best.length-1];
    const c0=Number(first.previousMlS),c1=Number(last.commandMlS);
    const dCmd=c1-c0;
    if(!Number.isFinite(dCmd)||Math.abs(dCmd)<0.125)return null;
    const checks=trace.filter(x=>x.kind==="check"&&Number(x.frame)===1&&Number.isFinite(Number(x.rawGS)));
    const nearest=t=>checks.filter(x=>Number(x.tMs)<=t).slice(-1)[0];
    const r0=nearest(Number(first.tMs)),r1=nearest(Number(last.tMs)+2500)||nearest(Number(last.tMs));
    if(!r0||!r1)return null;
    const dCup=Number(r1.rawGS)-Number(r0.rawGS);
    const gain=dCup/dCmd;
    const usable=Math.sign(dCup)===Math.sign(dCmd)&&Math.abs(dCup)>=0.08&&gain>=0.2&&gain<=3;
    return {usable,startCommandMlS:c0,commandMlS:c1,startGS:Number(r0.rawGS),endGS:Number(r1.rawGS),deltaCommand:dCmd,deltaGS:dCup,gain:gain,writes:best.map(x=>Number(x.commandMlS)),
      reason:usable?"single-shot chain shows the LUT-mapped command is low":"command rose without a matching cup-flow change; treat as saturated"};
  }

  function liveTrimLearningView(run,phase) {
    if(!run||!run.config||!run.config.experimentalLiveTrim)return run;
    const trace=run.liveFlowTrim&&run.liveFlowTrim.trace||[];
    const frames=phase==="stage2"?[1]:(run.config.stage3Shape&&run.config.stage3Shape.enabled?[2,3,4]:[2]);
    const changed=frames.filter(f=>trace.some(x=>x.kind==="write"&&x.frame===f));
    if(!changed.length)return run; // S1 and untouched phases retain the existing evidence path.
    const bounds={},commands={};
    for(const frame of changed){
      const last=trace.filter(x=>x.kind==="write"&&x.frame===frame).slice(-1)[0];
      const response=trace.find(x=>x.kind==="machine-target-response"&&x.frame===frame&&x.tMs>=last.tMs&&Math.abs(x.commandMlS-last.commandMlS)<0.001);
      if(!response)return null;
      bounds[frame]=response.tMs+2000;commands[frame]=last.commandMlS;
      const raw=(run.rawScaleSamples||[]).filter(x=>x.phase===phase&&Number(x.profileFrame)===frame&&x.tMs>=bounds[frame]);
      if(raw.length<6||raw[raw.length-1].tMs-raw[0].tMs<5000)return null;
    }
    const keep=x=>x.phase!==phase||bounds[Number(x.profileFrame)]===undefined||x.tMs>=bounds[Number(x.profileFrame)];
    const c={...run.config,liveTrimLearningBasis:"verified stable-command windows after 2s settle"};
    if(phase==="stage2")c.stage2CommandMlS=commands[1];
    else if(c.stage3Shape&&c.stage3Shape.enabled){
      c.stage3Shape={...c.stage3Shape};
      for(const [frame,key] of [[2,"earlyCommand"],[3,"midCommand"],[4,"lateCommand"]])if(commands[frame]!==undefined)c.stage3Shape[key]=commands[frame];
      c.stage3CommandMlS=c.stage3Shape.midCommand;
    }else c.stage3CommandMlS=commands[2];
    return {...run,config:c,rawScaleSamples:(run.rawScaleSamples||[]).filter(keep),samples:(run.samples||[]).filter(keep)};
  }

  function liveTrimPayload() { return state.liveTrim ? state.liveTrim.report : null; }
  function liveTrimRecord(kind, extra) {
    const t=state.liveTrim;if(!t)return;
    const row={kind,tMs:Math.max(0,Date.now()-t.run.startedAtMs),...(extra||{})};
    t.report.trace.push(row);
    diagnosticEvent("live_flow_trim",row);
  }
  // In-shot learning quality per the user's definition (2026-10-29): the angle
  // between the target line and the line from the previous check point to this
  // check point, extended to the target. 0 degrees means the trend lies on the
  // target line (cup flow flat on target, no further write); a trend that cannot
  // reach the target line reads 90, and one moving away reads above 90.
  function computeAngleStats(report,trace) {
    const band=(report&&report.deadbandPct)||2;
    const rows=(trace||[]).filter(x=>x.kind==="check"&&Number.isFinite(x.rawGS));
    if(rows.length<2)return {zeroDegreeShare:null,meanAngleDeg:null};
    let z=0,a=0,n=0,prev=null;
    for(const c of rows){
      if(prev&&Number(c.tMs)>Number(prev.tMs)){
        const dt=(Number(c.tMs)-Number(prev.tMs))/1000,df=Number(c.rawGS)-Number(prev.rawGS);
        if(dt>0.05){
          const slope=df/dt,mag=Math.atan(Math.abs(slope))*180/Math.PI;
          const target=Number.isFinite(Number(c.targetGS))?Number(c.targetGS):null;
          let angle=mag;
          if(target!==null){
            const needUp=target>Number(c.rawGS),inBand=Math.abs(Number(c.rawGS)/target-1)<=band/100;
            if(Math.abs(slope)<1e-9)angle=inBand?0:90;
            else if((needUp&&slope>0)||(!needUp&&slope<0))angle=Math.min(90,mag);
            else angle=180-Math.min(90,mag);
          }
          if(angle<=band)z++;a+=angle;n++;
        }
      }
      prev=c;
    }
    return n?{zeroDegreeShare:round(z/n,3),meanAngleDeg:round(a/n,2)}:{zeroDegreeShare:null,meanAngleDeg:null};
  }
  // Sustained same-direction angles mean the current vector is too weak: raise the step
  // ceiling (4 -> 6 -> 8 native quanta) so fewer writes and less time close the angle.
  // The base±20% envelope and the trend gates keep the resulting wave amplitude bounded.
  function vectorStepCount(errGS,sameSideStreak,target){const rel=target>0?Math.abs(errGS/target):1;const head=rel<=.10?1:Math.min(8,4+Math.floor((sameSideStreak||0)/3)*2);return Math.max(1,Math.min(head,Math.round(Math.abs(errGS)*8)));}
  function closeLiveTrim(t) {
    if(!t)return;clearS2StartupTimers(t);if(!t.handle)return;const h=t.handle;t.handle=null;
    host.transport.close(h).catch(()=>{});
  }
  function stopLiveTrim(reason) {
    clearTimer("liveTrimTimer");
    const t=state.liveTrim;if(!t)return;
    if(t.active){t.active=false;t.report.status=reason;liveTrimRecord("stopped",{reason});}
    Object.assign(t.report,computeAngleStats(t.report,t.report.trace));
    closeLiveTrim(t);
  }
  function initializeLiveTrim() {
    state.liveTrim=null;
    const run=state.diagnosticCurrent;
    if(!state.cfg.liveFlowTrimTest||!run)return;
    const c=run.config;
    c.experimentalLiveTrim=true;
    const seconds=(c.activeRelease===false?c.stage1Weight/c.stage1Flow:0)+(c.stage2Weight-c.stage1Weight)/c.stage2Flow+(c.finalWeight-c.stage2Weight)/c.stage3Flow;
    const level=[1,2,3,4].includes(state.cfg.liveFlowTrimLevel)?state.cfg.liveFlowTrimLevel:3;
    const budget=[50,150,200,250][level-1];
    const period=level===1?Math.max(300,Math.round(seconds*1000/50)):[0,300,250,200][level-1];
    const report={enabled:true,status:c.activeRelease===false?"armed-for-S1":"armed-for-S2",level,plannedDurationMs:Math.round(seconds*1000),periodMs:period,maxChecks:2000,maxWrites:budget,
      checks:0,writes:0,acks:0,targetConfirmations:0,targetMissTolerance:3,targetMisses:0,consecutiveTargetMisses:0,retries:0,feedbackReleases:0,feedbackPolicy:"trend-vector-response",degradedRetryIntervalMs:3000,minWriteIntervalMs:50,responseTimeoutMs:2000,deadbandPct:4,trace:[],zeroDegreeShare:null,meanAngleDeg:null,sameSignStreak:0,bigAngleStreak:0,vectorAngleDeg:null,adaptiveMode:"trend-confirmed-window-and-dynamic-exposure-learning"};
    report.learningBand=learningPolicy(c.adaptiveLearningLevel).deadband;report.learningLevel=learningPolicy(c.adaptiveLearningLevel).name;
    report.s2StartupPlan=c.s2StartupPlan||null;report.startupExecution={status:c.s2StartupPlan&&c.s2StartupPlan.enabled?"armed":"not-planned",reason:c.s2StartupPlan&&c.s2StartupPlan.reason||"S2 startup assist disabled"};
    run.liveFlowTrim=report;
    state.liveTrim={active:true,started:false,handle:null,run,report,phase:null,frame:null,frameAt:0,
      startup:{status:c.s2StartupPlan&&c.s2StartupPlan.enabled?"armed":"disabled",plan:c.s2StartupPlan||{enabled:false}},
      commands:{},pending:null,retry:null,lastDecisionStamp:{},lastWriteAt:null,sameSignStreak:0,lastSign:0,bigAngleStreak:0,lastCheckGS:null,lastCheckAtMs:0,profile:JSON.parse(JSON.stringify(profileObject()))};
    liveTrimRecord("armed",{periodMs:report.periodMs});
  }
  async function startLiveTrim() {
    const t=state.liveTrim;
    if(!t||!t.active||t.started)return;t.started=true;
    const live=()=>state.liveTrim===t&&t.active&&state.diagnosticCurrent===t.run&&(liveTrimPhaseAllowed(t)||["soak","restart_wait"].includes(state.phase));
    // Schedule before awaits: opening/API calls cannot strand the experiment.
    scheduleLiveTrimTick(t);
    try {
      const rr=await api("/machine/info",{method:"GET"});const info=await rr.json();
      if(!live())return;
      // This encoder is for stock DE1 only, not Bengle's 0.1-unit v2 protocol.
      if(!info||typeof info.model!=="string"||!/^DE1/i.test(info.model))throw new Error("stock DE1 model not confirmed");
      const opened=await host.transport.open({kind:"websocket",url:"ws://localhost:8080/ws/v1/machine/raw"});
      if(!opened||!opened.handle)throw new Error("raw socket missing handle");
      if(!live()){host.transport.close(opened.handle).catch(()=>{});return;}
      t.handle=opened.handle;t.report.status="monitoring";
      kickS2Refill(t);
      host.transport.onEvent(t.handle,event=>{
        if(!live())return;
        if(event.type==="close"||event.type==="error"){t.handle=null;if(t.startup&&["boosting","returning","return-unconfirmed"].includes(t.startup.status)&&state.phase==="stage2"&&Number(state.lastFrame)===1)abortSequence("S2 startup raw transport failed",true);stopLiveTrim("raw-transport-failed");return;}
        if(event.type!=="data"||!t.pending)return;
        try {
          const x=typeof event.data==="string"?JSON.parse(event.data):event.data;
          if(x.type==="response"&&x.operation==="write"&&x.characteristicUUID==="A010"&&!t.pending.ack){
            const pend=t.pending;pend.ack=true;t.report.acks++;
            liveTrimRecord("driver-ack",{frame:pend.frame,latencyMs:Date.now()-pend.at});
            // The refill is complete when the driver acknowledges the return
            // write: the pump command is back at the profile base. Waiting for a
            // target echo or flow corroboration kept S2 blocked for seconds.
            if(pend.startupAction==="return"&&t.startup&&["returning","return-unconfirmed"].includes(t.startup.status)){t.startup.returnConfirmation="driver-ack";completeS2Startup(t);}
          }
        }catch(_){}
      });
    }catch(error){if(live())stopLiveTrim(`setup-failed: ${error.message||error}`);}
  }
  function kickS2Refill(t) {
    if(!t||!t.handle||!t.startup||t.startup.plan.strategy!=="refill-85"||t.startup.status!=="armed"||t.startup.kickQueued||state.phase!=="stage2"||Number(state.lastFrame)!==1)return;
    t.startup.kickQueued=true;scheduleLiveTrimTick(t,0);
  }
  function scheduleLiveTrimTick(t,delay) {
    if(!t.active||state.liveTrim!==t)return;
    clearTimer("liveTrimTimer");
    state.liveTrimTimer=setTimeout(()=>{
      state.liveTrimTimer=null;
      liveTrimTick(t).catch(error=>{if(state.liveTrim===t&&t.active){stopLiveTrim(`write-failed: ${error.message||error}`);abortSequence("Live flow driver write failed",true);}});
    },Number.isFinite(delay)?delay:t.report.periodMs);
  }
  function observeLiveTrimMachine(machine) {
    const t=state.liveTrim;if(!t||!t.active||!t.started)return;
    if(!liveTrimPhaseAllowed(t))return;
    const frame=finiteOrNull(machine.profileFrame);
    t.observedTarget=machine.machineState==="espresso"&&machine.telemetryValid===true?finiteOrNull(machine.targetFlow):null;
    if(state.phase==="stage3"||t.startup&&["boosting","returning","return-unconfirmed"].includes(t.startup.status)&&(frame!==null&&frame!==1||state.phase!=="stage2")){
      clearS2StartupTimers(t);
      if(t.startup){
        if(["boosting","returning","return-unconfirmed"].includes(t.startup.status))t.report.startupExecution={status:"frame-ended",reason:"S2 frame ended; no write to previous frame",cutoff:t.startup.cutoff||null};
        t.startup.status="frame-ended";
      }
    }
    if(frame!==t.frame||state.phase!==t.phase){t.frame=frame;t.phase=state.phase;t.frameAt=Date.now();}
    if(state.phase==="stage2"&&frame===1&&t.startup&&!Number.isFinite(t.startup.frameConfirmedAt))t.startup.frameConfirmedAt=Date.now();
    kickS2Refill(t);
    const p=t.pending||t.retry;
    if(p) p.lastObserved={frame,targetFlowMlS:finiteOrNull(machine.targetFlow),telemetryValid:machine.telemetryValid===true,atMs:Date.now()};
    // A missing target echo must not freeze a physically settled refill return.
    // This is labelled corroboration, not a target ACK: driver ACK plus several
    // fresh, same-frame actual-flow observations must agree with the return.
    if(p&&p.ack&&!p.targetSeen&&p.startupAction==="return"&&t.startup&&t.startup.plan.strategy==="refill-85"&&state.phase==="stage2"&&!state.stage2SkipSent&&["returning","return-unconfirmed"].includes(t.startup.status)){
      const now=Date.now(),actual=finiteOrNull(machine.flow),pressure=finiteOrNull(machine.pressure),limit=Number(t.profile.steps[1].limiter.value);
      const matches=machine.machineState==="espresso"&&machine.telemetryValid===true&&frame===1&&["preinfusion","pouring"].includes(machine.substate)&&actual!==null&&pressure!==null&&pressure<limit*.9&&Math.abs(actual-p.command)<=Math.max(1/16,p.command*.05)&&now-p.at>=600;
      if(!matches)p.returnFlowEvidence=null;
      else{
        let evidence=p.returnFlowEvidence;
        if(!evidence||now-evidence.lastAt>600)evidence=p.returnFlowEvidence={firstAt:now,lastAt:now,count:0};
        if(!evidence.count||now>evidence.lastAt){evidence.count++;evidence.lastAt=now;}
        if(evidence.count>=3&&now-evidence.firstAt>=500){
          t.commands[1]=p.command;t.report.returnFlowCorroborations=(t.report.returnFlowCorroborations||0)+1;
          t.startup.returnConfirmation="actual-flow-corroborated";
          liveTrimRecord("startup-return-corroborated",{frame:1,commandMlS:p.command,actualFlowMlS:actual,samples:evidence.count,spanMs:now-evidence.firstAt});
          completeS2Startup(t);t.report.status="monitoring-return-flow-corroborated";
        }
      }
    }
    if(p&&(t.pending===p||t.retry===p)&&machine.machineState==="espresso"&&machine.telemetryValid&&frame===p.frame&&
       !p.targetSeen){
      // Trend confirmation, never a value-equality check: the first feedback is the RAW cup-flow
      // slope converging toward the setpoint; machine flow moving with the written vector is
      // corroborating evidence for the pump response. ACK alone advances no command, and a stale
      // same-value re-send is meaningless: the next decision recomputes a fresh vector instead.
      const tgt=state.phase==="stage1"?t.run.config.stage1Flow:state.phase==="stage2"?t.run.config.stage2Flow:t.run.config.stage3Flow;
      let trend=false,basis="raw";
      if(Date.now()-p.at>=600&&Number.isFinite(p.slopeAtWrite)){
        const repr=liveTrimRegression(t);
        if(repr&&Number.isFinite(repr.slope)){const oa=Math.abs(p.slopeAtWrite-tgt),na=Math.abs(repr.slope-tgt);if(na<oa-0.015)trend=true;}
      }
      if(!trend&&Number.isFinite(p.flowAtWrite)&&Number.isFinite(machine.flow)&&Math.abs(machine.flow-p.flowAtWrite)>=1/16&&Math.sign(machine.flow-p.flowAtWrite)===Math.sign(p.command-p.flowAtWrite)){trend=true;basis="machine";}
      if(!trend)return;
      p.targetSeen=true;t.report.targetConfirmations++;
      t.commands[frame]=p.command;t.report.consecutiveTargetMisses=0;t.report.status="monitoring";
      if(t.retry===p)t.retry=null;
      if(p.startupAction==="return"&&p.ack&&t.startup)completeS2Startup(t);
      liveTrimRecord("machine-target-response",{frame,commandMlS:p.command,latencyMs:Date.now()-p.at,basis});
    }
  }
  function encodeLiveFlowFrame(step,frame,command) {
    if(!step||step.pump!=="flow"||step.exit||!Number.isInteger(frame)||frame<0||frame>4)throw new Error("unsupported frame");
    if(!Number.isFinite(command)||command<LIMITS.commandFlowMin||command>LIMITS.commandFlowMax)throw new Error("flow out of bounds");
    const temp=Number(step.temperature),seconds=Number(step.seconds),volume=Number(step.volume);
    if(!Number.isFinite(temp)||temp<70||temp>100||!Number.isFinite(seconds)||seconds<0||!Number.isFinite(volume)||volume!==0)throw new Error("unsupported frame metadata");
    // Exactly match Decaid stock-DE1 frame encoding; preserve sensor, transition,
    // temperature, duration and unlimited-volume flag. Extended limiter frame untouched.
    const flags=0x40|0x01|(step.sensor==="water"?0x10:0)|(step.transition==="smooth"?0x20:0);
    const duration=seconds===0?0:seconds>=12.75?(0x80|Math.min(127,Math.floor(seconds+0.5))):Math.floor(seconds*10+0.5);
    const bytes=[frame,flags,Math.floor(command*16+0.5),Math.floor(temp*2+0.5),duration,0,4,0];
    return bytes.map(x=>x.toString(16).padStart(2,"0").toUpperCase()).join("");
  }
  function liveTrimRegression(t) {
    // S3's machine pump responds with a 2-4 s lag (measured on 1.80ds field data),
    // so a 1.6 s regression is mostly noise there. Use a 3 s window, a 1.2 s tail
    // and a 2 s forecast horizon for S3; keep S2 at 1.6 s / 0.5 s.
    const isS3=state.phase==="stage3",windowMs=isS3?3000:1600,tailSec=isS3?1.2:.75,headSec=isS3?1.2:.65,horizon=isS3?2:.5;
    const now=Date.now(),raw=state.phase==="stage2"?phaseRawSamples(t.run,"stage2"):t.run.rawScaleSamples||[],seen=new Set(),points=[];
    for(const x of raw){
      if(x.phase!==state.phase||Number(x.profileFrame)!==t.frame||x.tMs<t.frameAt-t.run.startedAtMs||now-t.run.startedAtMs-x.tMs>windowMs)continue;
      if(x.tareReset){points.length=0;seen.clear();continue;}
      const stamp=finiteOrNull(x.scaleTimestampSeconds),weight=finiteOrNull(x.weightG);
      if(stamp===null||weight===null||seen.has(stamp))continue;
      if(points.length&&(stamp<=points[points.length-1].x||stamp-points[points.length-1].x>0.6)){points.length=0;}
      seen.add(stamp);points.push({x:stamp,y:weight});
    }
    if(points.length<6||points[points.length-1].x-points[0].x<1.2)return null;
    const r=linearRegression(points),end=points[points.length-1].x;
    const tail=points.filter(p=>end-p.x<=tailSec),head=points.filter(p=>end-p.x>=headSec);
    const fit=a=>a.length>=4&&a[a.length-1].x-a[0].x>=.45?linearRegression(a):null;
    const fast=fit(tail),early=fit(head);
    const fastSlope=fast&&fast.r2>=.90&&fast.slope>=0?fast.slope:null;
    const predicted=fastSlope!==null&&early&&early.r2>=.90?Math.max(0,fastSlope+Math.max(0,fastSlope-early.slope)*horizon):fastSlope;
    return r&&r.r2>=0.90&&r.slope>0?{...r,fastSlope,predicted,sourceEndStamp:end}:null;
  }
  async function liveTrimTick(t) {
    const live=()=>state.liveTrim===t&&t.active&&state.diagnosticCurrent===t.run&&liveTrimPhaseAllowed(t);
    if(!live()){
      if(state.liveTrim===t&&t.active&&state.diagnosticCurrent===t.run&&["soak","restart_wait"].includes(state.phase))scheduleLiveTrimTick(t);
      return;
    }
    // A short boost has a reserved base-return write independent of ordinary
    // regression cadence. Never allow normal trim to extend the boost.
    if(t.startup&&["boosting","returning","return-unconfirmed"].includes(t.startup.status)){
      if(state.phase!=="stage2"||finiteOrNull(state.lastFrame)!==null&&Number(state.lastFrame)!==1){clearS2StartupTimers(t);t.startup.status="frame-ended";}
      else if(["returning","return-unconfirmed"].includes(t.startup.status)&&(t.pending||t.retry)&&(t.pending||t.retry).ack&&(t.pending||t.retry).targetSeen&&Date.now()-(t.pending||t.retry).at>=50){
        t.retry=null;completeS2Startup(t);
      }else{
        if(t.startup.status==="boosting"){
          const reason=t.startup.plan.strategy==="refill-85"?s2RefillReturnReason(t):Date.now()-t.startup.startedAt>=t.startup.plan.holdMs?"S2 startup maximum duration reached":state.lastMachineTelemetryValid&&Date.now()-state.lastMachineAtMs<=600&&state.lastPressure>=Number(t.profile.steps[1].limiter.value)*.95?"S2 startup pressure margin reached":null;
          if(reason){t.startup.returnReason=reason;await dispatchS2Startup(t,"return");}
        }
        if(t.startup.status==="return-unconfirmed"){
          if(t.report.checks>=t.report.maxChecks&&!t.pending){stopLiveTrim(`${t.report.maxChecks}-check-budget-complete`);return;}
          if(t.pending&&Date.now()-t.pending.at>2000){
            if(!t.pending.ack){abortSequence("S2 startup base retry driver ACK missing",true);return;}
            t.retry=t.pending;t.pending=null;
          }
          if(!t.pending&&t.retry&&Date.now()-t.retry.at>=3000&&t.report.writes<t.report.maxWrites){
            if(await dispatchS2Startup(t,"return")){t.report.retries++;t.startup.status="return-unconfirmed";}
          }
        }
        if(t.report.checks<t.report.maxChecks)t.report.checks++;
        liveTrimRecord("check",{frame:1,phase:state.phase,decision:"hold",reason:"S2 startup bounded pulse or base-return confirmation"});
        scheduleLiveTrimTick(t);return;
      }
    }
    const exhausted=t.report.checks>=t.report.maxChecks;
    if(exhausted&&!t.pending){stopLiveTrim(`${t.report.maxChecks}-check-budget-complete`);return;}
    if(!exhausted)t.report.checks++;
    const row={check:t.report.checks,frame:t.frame,phase:state.phase,decision:"hold"};
    const checkReg=liveTrimRegression(t);
    if(checkReg)row.rawGS=round(checkReg.slope,3);
    try {
      if(t.startup&&t.startup.status==="armed"){
        const refill=t.startup.plan.strategy==="refill-85";
        if(refill&&state.phase==="stage2"&&!Number.isFinite(t.startup.enteredAt))t.startup.enteredAt=Date.now();
        const startupAge=Date.now()-(refill&&Number.isFinite(t.startup.enteredAt)?t.startup.enteredAt:t.frameAt);
        const early=state.phase==="stage2"&&Number(state.lastFrame)===1&&startupAge<=(t.startup.plan.dispatchWindowMs||2000);
        if(early&&refill){
          if(!Number.isFinite(t.startup.frameConfirmedAt))t.startup.frameConfirmedAt=Date.now();
          if(Date.now()-t.startup.frameConfirmedAt<(t.startup.plan.startDelayMs||0)){row.reason="S2 refill start delay";return;}
        }
        if(early&&await dispatchS2Startup(t,"boost")){row.reason="S2 startup boost";return;}
        if(state.phase==="stage3"||state.phase==="stage2"&&startupAge>(t.startup.plan.dispatchWindowMs||2000)){t.startup.status="skipped";t.report.startupExecution={status:"skipped",reason:t.startup.blockReason||"Startup dispatch guards not satisfied in time"};liveTrimRecord("startup-skipped",t.report.startupExecution);}
      }
      if(t.startup&&t.startup.resumeAt>Date.now()){row.reason="S2 startup response settling";return;}
      if(t.pending){
        const p=t.pending;
        if(p.ack&&p.targetSeen&&Date.now()-p.at>=50){
          t.report.feedbackReleases++;liveTrimRecord("feedback-wait-released",{frame:p.frame,latencyMs:Date.now()-p.at});t.pending=null;
        }else if(Date.now()-p.at>Math.max(2000,t.report.periodMs*2)){
          if(!p.ack){stopLiveTrim("driver-ack-timeout");abortSequence("Live flow driver acknowledgement timeout",true);return;}
          if(!p.targetSeen){
            t.report.targetMisses++;t.report.consecutiveTargetMisses++;
            liveTrimRecord("vector-unresponsive",{frame:p.frame,commandMlS:p.command,lastObserved:p.lastObserved||null,currentFrame:state.lastFrame,stageTransition:state.stage2SkipSent===true,
              consecutiveMisses:t.report.consecutiveTargetMisses,tolerance:t.report.targetMissTolerance});
            // An unresponsive direction angle only records state; it never queues a
            // same-value re-send. The next decision computes a fresh vector from the
            // current trend (step on / trim back). ACK alone advances no command.
            t.retry=p;t.report.status=t.report.consecutiveTargetMisses>t.report.targetMissTolerance?
              "monitoring-unresponsive-trend":`monitoring-unresponsive-${t.report.consecutiveTargetMisses}`;
            liveTrimRecord("target-feedback-bypass",{frame:p.frame,commandMlS:p.command,consecutiveMisses:t.report.consecutiveTargetMisses});
          }
          t.pending=null;
        }else {row.reason="waiting-for-write-response";return;}
      }
      if(exhausted){stopLiveTrim(`${t.report.maxChecks}-check-budget-complete`);return;}
      if(!t.handle){row.reason="raw-socket-not-ready";return;}
      if(state.stage1DumpSent&&state.phase==="stage1"){row.reason="stage-transition";return;}
      if(state.stage2SkipSent&&state.phase==="stage2"){row.reason="stage-transition";return;}
      const frame=finiteOrNull(state.lastFrame);
      if(frame===null||!Number.isInteger(frame)||(state.phase==="stage1"?frame!==0:state.phase==="stage2"?frame!==1:frame<2||frame>=t.profile.steps.length)){row.reason="frame-not-confirmed";return;}
      if(frame!==t.frame||state.phase!==t.phase){t.frame=frame;t.phase=state.phase;t.frameAt=Date.now();row.reason="frame-settle";return;}
      if(Date.now()-t.frameAt<1600||Date.now()-state.latestScaleAtMs>600||Date.now()-state.lastMachineAtMs>600||!state.lastMachineTelemetryValid||state.lastMachineState!=="espresso"||!["preinfusion","pouring"].includes(state.lastSubstate)){row.reason="settling-or-stale-telemetry";return;}
      const reg=liveTrimRegression(t);if(!reg){row.reason="raw-regression-insufficient";return;}
      if(t.lastWriteAt!==null&&Date.now()-t.lastWriteAt<50){row.reason="minimum-write-interval";return;}
      if(t.lastDecisionStamp[frame]===reg.sourceEndStamp){row.reason="waiting-for-new-scale-sample";return;}
      const finalTarget=state.phase==="stage1"?t.run.config.stage1Flow:state.phase==="stage2"?t.run.config.stage2Flow:t.run.config.stage3Flow;
      const handover=state.phase==="stage2"&&t.startup&&t.startup.plan.strategy==="refill-85"&&Number.isFinite(t.startup.approachAt)&&Date.now()-t.startup.approachAt<t.startup.plan.approachMs;
      const fraction=handover?Math.min(1,Math.max(0,(Date.now()-t.startup.approachAt)/t.startup.plan.approachMs)):1;
      const target=finalTarget; // Cup target never drops to85% after refill.
      row.finalTargetGS=finalTarget;row.approachFraction=1;row.handoverProgress=round(fraction,3);row.handoverActive=!!handover;
      if(handover&&reg.slope>target*1.02){
        const fast=s2RefillFlowEstimate(t);
        if(!fast||fast.slope<=target*1.02||fast.predicted<=target*1.02){row.reason="S2 handover falling response; avoid an extra decrease";return;}
      }
      if(handover&&reg.slope<target){
        if(t.lastWriteAt!==null&&Date.now()-t.lastWriteAt<t.startup.plan.approachWriteIntervalMs){row.reason="S2 approach upward-write spacing";return;}
        const fast=s2RefillFlowEstimate(t);
        if(fast&&fast.predicted>=target){row.reason="S2 approach rising response; hold for inertia";return;}
      }
      if(state.phase==="stage3"&&reg.slope<target){
        // No fixed anti-ripple interval: the trend statistics gate writes. The predicted
        // rise keeps the direction angle from overshooting while the trend is still climbing.
        if(reg.fastSlope!==null&&reg.fastSlope!==undefined&&(reg.fastSlope>=target*.98||reg.predicted>=target)){row.reason="S3 rising response; hold upward correction";return;}
      }
      row.rawGS=round(reg.slope,3);row.targetGS=target;row.errorPct=round((reg.slope/target-1)*100,2);row.r2=round(reg.r2,4);
      const deadband=(Number(t.report.deadbandPct)||4)/100;
      if(Math.abs(reg.slope/target-1)<=deadband+1e-9){row.reason="inside-"+Math.round(deadband*100)+"pct-band";return;}
      if(t.retry&&t.retry.frame!==frame){
        liveTrimRecord("unconfirmed-frame-ended",{frame:t.retry.frame,commandMlS:t.retry.command,nextFrame:frame});
        t.retry=null; // Never carry an unresponsive vector across a frame transition.
      }
      const retry=t.retry;
      const step=t.profile.steps[frame],base=Math.floor(Number(step.flow)*16+0.5)/16;
      const command=Number.isFinite(t.commands[frame])?t.commands[frame]:base;
      const limiter=Number(step.limiter&&step.limiter.value);
      if(reg.slope<target&&(!Number.isFinite(limiter)||state.lastPressure>=0.95*limiter||state.lastFlow<command*0.7)){row.reason="pressure-or-actuator-limited";return;}
      // A stale direction is held, not blindly retried after the cup error reverses.
      if(retry&&Math.sign(retry.command-command)!==Math.sign(target-reg.slope)){row.reason="unconfirmed-target-direction-changed";return;}
      // One quantum only from a confirmed command; unresolved attempts repeat the same target.
      // Vector control: recompute the direction angle from the current trend; a fresh
      // vector steps on (or trims back) instead of re-sending an unresponsive value.
      // PD-style bounded amplitude: the sign steers the trajectory direction angle toward
      // the setpoint line; the capped 1/16-quantized amplitude accelerates a wide angle and
      // tapers as the line is approached. Anti-overshoot stays in the statistics gates above.
      const errGS=target-reg.slope;
      const dir=reg.slope<target?-1:reg.slope>target?1:0;
      if(dir!==0&&dir===t.lastSign)t.sameSignStreak=(t.sameSignStreak||0)+1;else{t.sameSignStreak=dir!==0?1:0;t.lastSign=dir;}
      t.report.sameSignStreak=t.sameSignStreak;
      // Continuous large trend angle (previous check -> current regression vs the
      // target line) means the current vector is too weak: raise the step ceiling
      // so fewer writes and less time close the angle.
      const prevGS=Number(t.lastCheckGS),prevAt=Number(t.lastCheckAtMs);
      let angleDeg=null,trendSlope=null;
      if(Number.isFinite(prevGS)&&prevAt>0){
        const dtS=(Date.now()-prevAt)/1000;
        if(dtS>0.1){
          trendSlope=(reg.slope-prevGS)/dtS;
          const mag=Math.atan(Math.abs(trendSlope))*180/Math.PI,inBand=Math.abs(reg.slope/target-1)<=0.02;
          angleDeg=Math.abs(trendSlope)<1e-9?(inBand?0:90):((target>reg.slope?trendSlope>0:trendSlope<0)?Math.min(90,mag):180-Math.min(90,mag));
        }
      }
      if(angleDeg!==null&&angleDeg>=45)t.bigAngleStreak=(t.bigAngleStreak||0)+1;else t.bigAngleStreak=0;
      t.report.bigAngleStreak=t.bigAngleStreak;t.report.vectorAngleDeg=angleDeg===null?null:round(angleDeg,1);
      // Explicit trim states (user 2026-10-30): coast = the trend is closing on
      // its own; lut-compensate = parallel/weak offset with pressure headroom;
      // vector = the existing bounded controller.
      const predicted=reg.fastSlope!==null&&reg.fastSlope!==undefined?Math.max(reg.slope,Number(reg.fastSlope),Number.isFinite(reg.predicted)?reg.predicted:reg.slope):Math.max(reg.slope,Number.isFinite(reg.predicted)?reg.predicted:reg.slope);
      const closing=reg.slope<target?predicted>=target*0.98:predicted<=target*1.02;
      // A flat 3 s trend is the real steady signal; with puck noise the prediction
      // rarely crosses the band even when the cup is already flat (field data:
      // coast fired once per shot).
      const trendFlat=Number.isFinite(trendSlope)&&Math.abs(trendSlope)<0.1;
      const trimMode=Math.abs(errGS/target)<=0.06&&(closing||trendFlat)?"coast":(errGS>0&&angleDeg!==null&&angleDeg>=55&&angleDeg<=125?"lut-compensate":"vector");
      row.trimMode=trimMode;
      if(trimMode==="coast"){row.reason="coast-trend-stable";return;}
      const steps=trimMode==="lut-compensate"?Math.max(2,vectorStepCount(errGS,t.bigAngleStreak,target)):vectorStepCount(errGS,t.bigAngleStreak,target);
      const raw=Math.round((command+Math.sign(errGS)*steps/16)*16)/16;
      // Hard envelope first (base ±20% at native 1/16 quanta): the PD amplitude adapts
      // inside it, so a wide angle never breaks the bounds. No room inside the envelope
      // reports a bound instead of an empty write.
      let lo=Math.ceil(base*0.8*16)/16,hi=Math.floor(base*1.2*16)/16;
      if(trimMode==="lut-compensate"){
        const mapped=mappedCommandForReal(target);
        if(Number.isFinite(mapped))hi=Math.max(hi,Math.floor(Math.min(mapped*0.9,LIMITS.commandFlowMax)*16)/16);
      }
      const candidate=Math.max(lo,Math.min(hi,raw));
      if(candidate===command||candidate<LIMITS.commandFlowMin||candidate>LIMITS.commandFlowMax){row.reason="command-bound-vector";return;}
      if(t.report.writes>=t.report.maxWrites){row.reason=`${t.report.maxWrites}-write-budget`;return;}
      const payload=encodeLiveFlowFrame(step,frame,candidate);
      // All preconditions are synchronous immediately before dispatch. No awaiting
      // GET/profile upload between frame validation and this single raw write.
      if(!live()||Number(state.lastFrame)!==frame||state.commandBusy){row.reason="frame-changed-or-command-busy";return;}
      const p={frame,command:candidate,at:Date.now(),ack:false,targetSeen:false,flowAtWrite:finiteOrNull(state.lastFlow),slopeAtWrite:Number.isFinite(reg.slope)?reg.slope:null};t.pending=p;
      t.lastWriteAt=p.at;t.lastDecisionStamp[frame]=reg.sourceEndStamp;
      if(retry){t.report.retries++;t.retry=null;}
      t.report.writes++;state.liveTrimDirty=true;
      liveTrimRecord("write",{frame,commandMlS:candidate,previousMlS:command,retry:!!retry,rawGS:row.rawGS,targetGS:target,payload});
      row.decision="write";row.commandMlS=candidate;
      await host.transport.send(t.handle,{type:"text",data:JSON.stringify({type:"request",operation:"write",characteristicUUID:"A010",payload})});
    }finally{
      if(state.liveTrim===t){
        if(!exhausted){
          if(Number.isFinite(row.rawGS)&&Number.isFinite(Number(t.lastCheckGS))&&Number(t.lastCheckAtMs)>0){
            const dtS=(Date.now()-Number(t.lastCheckAtMs))/1000;
            if(dtS>0.1){
              const slope=(row.rawGS-Number(t.lastCheckGS))/dtS,mag=Math.atan(Math.abs(slope))*180/Math.PI,phase=state.phase;
              const tg=Number(row.targetGS)||Number(t.run.config[phase==="stage1"?"stage1Flow":phase==="stage2"?"stage2Flow":"stage3Flow"])||0;
              if(tg>0)row.trendAngleDeg=Math.abs(slope)<1e-9?(Math.abs(row.rawGS/tg-1)<=0.02?0:90):((tg>row.rawGS?slope>0:slope<0)?Math.min(90,mag):180-Math.min(90,mag));
            }
          }
          liveTrimRecord("check",row);
          if(Number.isFinite(row.rawGS)){t.lastCheckGS=row.rawGS;t.lastCheckAtMs=Date.now();}
        }
        if(live())scheduleLiveTrimTick(t);
      }
    }
  }

  // Optional raw attempt shares the original GHC watchdog; no cup-gain watchdog.
  function directStartTestPayload() {
    const t=state.directStartTest;
    return t?{active:t.active,status:t.status,requestAtMs:t.requestAtMs,writeAtMs:t.writeAtMs,
      rawWriteAcknowledged:!!t.rawWriteAcknowledged,machineConfirmed:!!t.machineConfirmed}:null;
  }
  function directTestEvent(status) {
    const t=state.directStartTest;if(!t)return;
    t.status=status;diagnosticEvent("direct_driver_start_test",directStartTestPayload());
    log(`DIRECT START TEST: ${status}`);emitSkinChanged();
  }
  function closeDirectTestTransport(t) {
    if(!t||!t.handle)return;const handle=t.handle;t.handle=null;
    host.transport.close(handle).catch(()=>{});
  }
  function cancelDirectStartTest() {
    clearTimer("directStartTestTimer");
    const t=state.directStartTest;
    if(t){t.active=false;closeDirectTestTransport(t);}
  }
  async function beginDirectStartTest() {
    const t={active:true,status:"requesting-espresso",requestAtMs:Date.now(),writeAtMs:null,handle:null};
    state.directStartTest=t;
    const live=()=>state.directStartTest===t&&t.active&&state.phase==="restart_wait";
    const stop=(reason)=>{
      if(state.directStartTest!==t||!t.active)return;
      directTestEvent(reason);cancelDirectStartTest();
    };
    try {
      await requestMachineState("espresso");
      if(!live())return;
      // Restore the original confirmation/retry/timeout owner before any raw await.
      startRestartPoll();
      directTestEvent("espresso-request-accepted; physical-GHC-may-be-required");
      // Transport cleanup only. This timer never sends Idle or replaces GHC safety.
      state.directStartTestTimer=setTimeout(()=>stop("raw-setup-timeout; original-GHC-guard-active"),5000);
      const rr=await api("/machine/info",{method:"GET"});const info=await rr.json();
      if(!live())return;
      if(!info||!/^DE1/i.test(info.model||"")||info.groupHeadControllerPresent!==false){
        stop(info&&info.groupHeadControllerPresent===true?"GHC-confirmation-required; raw-attempt-skipped":"GHC-capability-unknown; raw-attempt-skipped");
        return;
      }
      const opened=await host.transport.open({kind:"websocket",url:"ws://localhost:8080/ws/v1/machine/raw"});
      if(!opened||!opened.handle)throw new Error("raw socket missing handle");
      if(!live()){host.transport.close(opened.handle).catch(()=>{});return;}
      t.handle=opened.handle;
      host.transport.onEvent(t.handle,event=>{
        if(!live())return;
        if(event.type==="close"||event.type==="error"){stop("raw-transport-closed; original-GHC-guard-active");return;}
        if(event.type!=="data")return;
        try {
          const msg=typeof event.data==="string"?JSON.parse(event.data):event.data;
          if(t.writeAtMs&&msg.type==="response"&&msg.operation==="write"&&String(msg.characteristicUUID).toUpperCase()==="A002"){
            t.rawWriteAcknowledged=true;stop("raw-write-acknowledged; physical-GHC-may-be-required");
          }
        }catch(_){}
      });
      if(!live())return;
      t.writeAtMs=Date.now();directTestEvent("raw-write-dispatched; original-GHC-guard-active");
      await host.transport.send(t.handle,{type:"text",data:JSON.stringify({type:"request",operation:"write",characteristicUUID:"A002",payload:"04"})});
    }catch(error){
      if(!live())return;
      if(t.writeAtMs===null&&!state.restartTimeoutTimer){stop("espresso-request-failed");abortSequence(`Espresso restart failed: ${error.message||error}`,false);}
      else stop(`raw-attempt-failed; original-GHC-guard-active: ${error.message||error}`);
    }
  }

  function restartPourConfirmed(source, machine) {
    if (state.phase !== "restart_wait" || state.restartSkipTimer !== null) return;
    const pourHasBegun = machine && (machine.substate === "preinfusion" || machine.substate === "pouring");
    if (!machine || machine.machineState !== "espresso" || !pourHasBegun) return;
    clearTimer("restartPollTimer");
    clearTimer("restartTimeoutTimer");
    clearTimer("armReinforceTimer");
    clearTimer("armReinforceTimer2");
    if (state.directStartTest && state.directStartTest.active) {
      state.directStartTest.machineConfirmed = true;
      directTestEvent("pouring-observed");
      cancelDirectStartTest();
    }
    stopGhcPrompt("confirmed", "Espresso preinfusion/pouring observed — continuing HyperEx");
    emitSkinChanged();
    diagnosticEvent("ghc_pour_confirmed", { source, substate: machine.substate, armRequestCount: state.armRequestCount });
    log(`GHC CONFIRMED. Restart pour confirmed via ${source} (${machine.substate}); scheduling skipStep to desired real ${state.cfg.stage2Flow.toFixed(2)} g/s (DE1 command ${resolvedStageCommandFlow("stage2", state.cfg.stage2Flow).toFixed(2)} ml/s).`);
    startLiveTrim(); // Prepare raw transport in parallel with the single guarded transition.
    scheduleRestartSkip();
  }

  function startRestartPoll() {
    clearTimer("restartPollTimer");
    clearTimer("restartTimeoutTimer");
    clearTimer("armReinforceTimer");
    log(`Second-stage Espresso request sent. Wait for the pink GHC light; press the physical GHC Espresso button within ${state.cfg.ghcConfirmTimeoutSeconds.toFixed(1)} s. If no pink light, use RE-ARM.`);
    startGhcCountdown();
    emitSkinChanged();

    // Two bounded automatic reinforcement requests after the full soak. They never
    // run during soak, never extend the 20 s GHC window, and are both cancelled
    // immediately once the second pour actually starts (or the user presses RE-ARM).
    const scheduleArmRetry = (timerName, delaySeconds, ordinal) => {
      if (!(delaySeconds > 0)) return;
      state[timerName] = setTimeout(() => {
        state[timerName] = null;
        if (state.phase !== "restart_wait") return;
        state.armRequestCount += 1;
        state.lastArmRequestAtMs = Date.now();
        diagnosticEvent("auto_arm_retry", { ordinal, requestCount: state.armRequestCount, delaySeconds });
        log(`Second-stage automatic arm reinforcement #${ordinal}: request ${state.armRequestCount} at +${delaySeconds.toFixed(1)} s.`);
        requestMachineState("espresso")
          .then(() => emitSkinChanged())
          .catch((error) => log(`Automatic arm reinforcement #${ordinal} failed: ${error.message || error}`));
      }, delaySeconds * 1000);
    };

    scheduleArmRetry("armReinforceTimer", state.cfg.autoArmRetry1Seconds, 1);
    const retry2 = state.cfg.autoArmRetry2Seconds;
    const retry1 = state.cfg.autoArmRetry1Seconds;
    const retry2Effective = retry2 > 0 && retry1 > 0 && retry2 <= retry1 ? retry1 + 1 : retry2;
    scheduleArmRetry("armReinforceTimer2", retry2Effective, 2);

    state.restartTimeoutTimer = setTimeout(() => {
      state.restartTimeoutTimer = null;
      if (state.phase !== "restart_wait") return;
      log(`>>> GHC TIMEOUT — no second-stage pour detected. Sending Idle and clearing HyperEx state. <<<`);
      requestMachineState("idle").catch((error) => log(`Timeout Idle command failed: ${error.message || error}`));
      resetSequence(`GHC confirmation window ${state.cfg.ghcConfirmTimeoutSeconds.toFixed(1)} s expired`);
    }, state.cfg.ghcConfirmTimeoutSeconds * 1000);

    const poll = async () => {
      if (state.phase !== "restart_wait") return;
      try {
        const snapshot = await getMachineSnapshot();
        const machine = extractMachine(snapshot);
        state.lastMachineState = machine.machineState;
        state.lastSubstate = machine.substate;
        state.lastPressure = machine.pressure;
    state.lastMachineTelemetryValid = machine.telemetryValid === true;
        state.lastFlow = machine.flow;
        const pourHasBegun = machine.substate === "preinfusion" || machine.substate === "pouring";
        if (machine.machineState === "espresso" && pourHasBegun) {
          restartPourConfirmed("REST poll", machine);
          return;
        }
      } catch (error) {
        log(`Restart poll transient error: ${error.message || error}`);
      }
      if (state.phase === "restart_wait") state.restartPollTimer = setTimeout(poll, 150);
    };
    state.restartPollTimer = setTimeout(poll, 120);
  }

  async function manualRearmSecondStage() {
    cancelDirectStartTest(); // Manual recovery also cancels any delayed optional raw write.
    if (state.phase !== "restart_wait") throw new Error("HyperEx is not waiting for second-stage GHC confirmation");
    const now = Date.now();
    if (now - state.lastArmRequestAtMs < 800) throw new Error("RE-ARM throttled; wait a moment");
    // A manual RE-ARM means the user has taken over recovery. Do not surprise them
    // with a later scheduled automatic arm request from the original chain.
    clearTimer("armReinforceTimer");
    clearTimer("armReinforceTimer2");
    state.armRequestCount += 1;
    state.lastArmRequestAtMs = now;
    diagnosticEvent("manual_rearm", { requestCount: state.armRequestCount, cumulativeWeightG: round(state.cumulativeWeight, 3) });
    log(`User RE-ARM request ${state.armRequestCount}; cancelled pending automatic arm retries, preserving cumulative ${state.cumulativeWeight.toFixed(2)} g and current GHC timeout window.`);
    await requestMachineState("espresso");
    emitSkinChanged();
    return uiStatusPayload();
  }

  async function guardedSingleSkip(expectedFrom, expectedTo, reason, isCurrent) {
    let frame = null;
    try {
      const snapshot = await getMachineSnapshot();
      const machine = extractMachine(snapshot);
      const f = finiteOrNull(machine.profileFrame);
      if (f!==null) frame = Math.floor(f);
    } catch (error) {
      log(`Could not preflight profileFrame before ${reason}: ${error.message || error}; using one bounded skip only.`);
    }
    if(isCurrent&&!isCurrent())return {cancelled:true,frame};
    if (frame === expectedTo) {
      log(`${reason}: profileFrame already ${expectedTo}; no skipStep sent.`);
      return { skipped: false, frame };
    }
    if (frame !== null && frame !== expectedFrom) {
      throw new Error(`${reason}: refusing skipStep because profileFrame=${frame}, expected ${expectedFrom} (or already ${expectedTo})`);
    }
    await requestMachineState("skipStep");
    return { skipped: true, frame: expectedTo };
  }

  function scheduleRestartSkip() {
    if (state.restartSkipTimer !== null || state.phase !== "restart_wait") return;
    state.restartSkipTimer = setTimeout(async () => {
      try {
        if (state.phase !== "restart_wait") return;
        const token=state.sequenceStartedAtMs;
        await guardedSingleSkip(0, 1, "restart -> S2",()=>state.phase==="restart_wait"&&state.sequenceStartedAtMs===token);
        if(state.phase!=="restart_wait"||state.sequenceStartedAtMs!==token)return;
        state.phase = "stage2";
        emitSkinChanged();
        startFlowStripTicker();
        startLiveTrim();
        diagnosticEvent("stage2_start", { targetFlowMlS: state.cfg.stage2Flow });
        diagnosticSample("stage2-start", true);
        log(`START S2: skipped profile frame 0 -> 1; desired real ${state.cfg.stage2Flow.toFixed(2)} g/s, DE1 command ${resolvedStageCommandFlow("stage2", state.cfg.stage2Flow).toFixed(2)} ml/s until cumulative ${state.cfg.stage2Weight.toFixed(2)} g.`);
      } catch (error) {
        abortSequence(`Could not skip to 5 ml/s stage after restart: ${error.message || error}`, true);
      } finally {
        state.restartSkipTimer = null;
      }
    }, 0);
  }

  function beginStage3LowFlow() {
    if (state.stage2SkipSent || state.phase !== "stage2") return;
    state.stage2SkipSent = true;
    diagnosticEvent("stage2_weight_trigger", { cumulativeWeightG: round(state.cumulativeWeight, 3), nextTargetFlowMlS: state.cfg.stage3Flow });
    log(`Cumulative ${state.cumulativeWeight.toFixed(2)} g reached. Advancing to desired real ${state.cfg.stage3Flow.toFixed(2)} g/s (DE1 command ${resolvedStageCommandFlow("stage3", state.cfg.stage3Flow).toFixed(2)} ml/s) final stage.`);
    const sequenceToken=state.sequenceStartedAtMs;
    guardedSingleSkip(1, 2, "S2 -> S3",()=>state.phase==="stage2"&&state.sequenceStartedAtMs===sequenceToken)
      .then(() => {
        if (state.phase === "stage2"&&state.sequenceStartedAtMs===sequenceToken) {
          state.phase = "stage3";
          diagnosticEvent("stage3_start", { targetFlowMlS: state.cfg.stage3Flow });
          diagnosticSample("stage3-start", true);
          log(`START S3: desired real ${state.cfg.stage3Flow.toFixed(2)} g/s, DE1 command ${resolvedStageCommandFlow("stage3", state.cfg.stage3Flow).toFixed(2)} ml/s until ${state.cfg.finalWeight.toFixed(2)} g.`);
        }
      })
      .catch((error) => abortSequence(`Could not advance to final low-flow stage: ${error.message || error}`, true));
  }

  function finishSequence() {
    if (state.finalStopSent || (!["stage2","stage3"].includes(state.phase)&&!(state.phase==="stage1"&&!activeReleaseEnabled(state.cfg)))) return;
    state.finalStopSent = true;
    stopLiveTrim("shot-finished");
    state.phase = "finishing";
    diagnosticEvent("final_weight_trigger", { cumulativeWeightG: round(state.cumulativeWeight, 3) });
    log(`Final cumulative weight ${state.cumulativeWeight.toFixed(2)} g reached. Ending Espresso.`);
    requestMachineState("idle")
      .catch((error) => log(`Final idle command failed: ${error.message || error}`));
  }

  function handlePressureSafety(pressure) {
    if (state.phase === "idle" || state.phase === "soak" || state.phase === "dumping" || state.phase === "finishing" || state.phase === "aborted") {
      state.hardPressureSamples = 0;
      return;
    }
    if (pressure > state.cfg.hardPressureLimit) {
      state.hardPressureSamples += 1;
      if (state.hardPressureSamples >= 3) {
        abortSequence(`Pressure > ${state.cfg.hardPressureLimit.toFixed(2)} bar for 3 samples`, true);
      }
    } else {
      state.hardPressureSamples = 0;
    }
  }

  function handleStateUpdate(payload) {
    const machine = extractMachine(payload);
    state.lastFrame = machine.profileFrame;
    noteMachine(machine);
    observeLiveTrimMachine(machine);

    if (state.phase === 'idle' && state.runtimeProfileVerified &&
        (!profileExecutionEquivalent(state.workflowProfile, profileObject()) || !adaptiveHistoryFingerprint())) {
      invalidateProfileTruth('Profile or calibration context changed before shot start', true);
    }
    const active = state.cfg && state.cfg.enabled && state.armed && state.runtimeProfileVerified;

    // Never allow a HyperEx-labelled workflow to pour while its execution profile
    // differs from the LUT/adaptive profile the plugin believes is current.
    if (state.cfg && state.cfg.enabled && state.workflowTitle === state.cfg.profileTitle && !state.runtimeProfileVerified &&
        machine.machineState === "espresso" && (machine.substate === "preinfusion" || machine.substate === "pouring")) {
      if (!state.runtimeProfileMismatchAbortSent) {
        state.runtimeProfileMismatchAbortSent = true;
        log(`SAFETY STOP: HyperEx workflow started before profile truth was verified (${state.runtimeProfileStatus}). Sending Idle; this run will not enter adaptive history.`);
        requestMachineState("idle").catch(error => log(`Profile-mismatch safety Idle failed: ${error.message || error}`));
      }
      return;
    }

    // Do not arm control during Decaid's preparingForShot/preheat phase.
    // Decaid treats any Idle command before preinfusion/pouring as a preheat abort.
    const pourHasBegun = machine.substate === "preinfusion" || machine.substate === "pouring";

    // Dedicated Flow Calibration never enters the HyperEx dump/soak state machine.
    // It only captures RAW scale + machine telemetry, with the same 8 bar / 3-sample emergency stop.
    if (state.calibrationArmed || state.calibrationActive) {
      handleCalibrationMachine(machine, pourHasBegun).catch(error => {
        log(`Calibration state handler error: ${error.message || error}`);
      });
      return;
    }

    if (active && state.phase === "idle" && machine.machineState === "espresso" && pourHasBegun) {
      const freshScale = state.latestScaleAtMs > 0 && (Date.now() - state.latestScaleAtMs) < 2500;
      startSequence(freshScale ? state.latestRawWeight : null);
      log(`Pour confirmed (${machine.substate}); HyperEx control is now live.`);
    }

    if (state.phase === "idle") {
      if (machine.machineState === 'idle' && !state.runtimeProfileVerified) scheduleProfileVerification('machine idle');
      return;
    }

    handlePressureSafety(machine.pressure);

    if (state.phase === "dumping") {
      // Fast paths. Exact Idle is strongest, but pouringDone or a settled near-zero
      // flow/pressure snapshot is also sufficient after the acknowledged Idle write.
      if (machine.machineState === "idle") {
        confirmDumpIdle("stateUpdate idle", machine);
      } else if (state.dumpAcceptedAtMs &&
                 (Date.now() - state.dumpAcceptedAtMs) >= state.cfg.dumpMinSettleSeconds * 1000 &&
                 dumpLooksReleased(machine)) {
        confirmDumpIdle(`stateUpdate settled (${machine.machineState || "?"}/${machine.substate || "?"})`, machine);
      }
      return;
    }

    // On the second Espresso start, also wait for real preinfusion/pouring before
    // requesting skipStep. Sending skipStep during preparingForShot can abort the shot.
    if (state.phase === "restart_wait" && machine.machineState === "espresso" && pourHasBegun) {
      restartPourConfirmed("stateUpdate", machine);
      return;
    }

    if (state.phase === "finishing" && machine.machineState === "idle") {
      if (state.completionTimer !== null) return;
      const finalWeight = state.cumulativeWeight;
      const sequenceToken = state.sequenceStartedAtMs;
      const run = state.diagnosticCurrent;
      state.completionTimer = setTimeout(() => {
        state.completionTimer = null;
        if (state.phase !== "finishing" || state.sequenceStartedAtMs !== sequenceToken || state.diagnosticCurrent !== run) return;
        resetSequence(`completed at ${finalWeight.toFixed(2)} g`);
      }, 500);
      return;
    }

    // User/manual abort detection. Idle is expected while dumping/soaking/restart_wait.
    if ((state.phase === "stage1" || state.phase === "stage2" || state.phase === "stage3") && machine.machineState === "idle") {
      abortSequence("Machine returned to Idle before the programmed trigger (manual stop or external stop)", false);
    }
  }

  function handleWorkflowUpdated(payload) {
    const title = payload && payload.profile && payload.profile.title ? String(payload.profile.title) : "";
    const previousTitle = state.workflowTitle;
    const previousCalMode = calibrationModeFromTitle(previousTitle);
    const selectedCalMode = calibrationModeFromTitle(title);
    const eventProfile = payload && payload.profile || null;
    if(title===(state.cfg&&state.cfg.profileTitle))adoptWorkflowBrewTemperature(eventProfile,true);
    const unchanged = previousTitle === title && profileExecutionEquivalent(eventProfile, state.workflowProfile) &&
      (!state.cfg || title !== state.cfg.profileTitle || profileExecutionEquivalent(eventProfile, profileObject()));
    if (previousTitle !== title) state.workflowSelectionRevision += 1;
    state.workflowTitle = title;
    state.calibrationArmed = selectedCalMode !== null;
    if (!unchanged || !state.runtimeProfileVerified) {
      invalidateProfileTruth(title === (state.cfg && state.cfg.profileTitle) ? 'workflow notification; GET verification required' : 'not HyperEx', !unchanged && !state.runtimeProfileRepairBusy);
      if (state.diagnosticCurrent && state.diagnosticCurrent.kind === 'hyperex' && !unchanged) state.diagnosticCurrent.config.profileTruthVerified = false;
      if (previousTitle !== title) { state.workflowProfile = null; state.profileReadbackAt = null; }
      if (!state.runtimeProfileRepairBusy) scheduleProfileVerification('workflowUpdated');
    }

    if (selectedCalMode !== null && state.calibrationMode !== selectedCalMode) {
      state.calibrationMode = selectedCalMode;
      storageWrite(STORAGE_CAL_MODE, selectedCalMode);
      log(`Flow Calibration mode auto-selected from profile: ${calibrationModeConfig(selectedCalMode).label}.`);
    }

    if (state.calibrationActive && previousCalMode !== null && title !== previousTitle) {
      finalizeCalibrationRun('interrupted: workflow changed').catch(error => log(`Calibration finalize error: ${error.message || error}`));
    }

    if (state.scopeMode === 'hyperex') {
      if (inHyperExScope(title)) {
        if (selectedCalMode !== null) enterHyperExScopedMultiplier(selectedCalMode !== null ? `Flow Calibration ${calibrationModeConfig(selectedCalMode).label} selected` : 'HyperEx selected')
          .catch(error => log(`Scoped flowMultiplier apply failed: ${error.message || error}`));
      } else {
        restoreHyperExScopedMultiplier('left HyperEx scope')
          .catch(error => log(`Scoped flowMultiplier restore failed: ${error.message || error}`));
      }
    } else if (finiteOrNull(state.scopedOriginalMultiplier) !== null) {
      restoreHyperExScopedMultiplier('scope mode no longer HyperEx-only')
        .catch(error => log(`Scoped flowMultiplier restore failed: ${error.message || error}`));
    }

    recomputeCalibrationUsability();
    if (state.calibrationArmed) {
      log(`FLOW CAL ARMED (${calibrationModeConfig().label}) by workflow '${title}'. EMPTY BASKET: tare scale and start Espresso; let the staircase finish.`);
    } else if (state.armed) {
      const flows = commandFlowSummary();
      log(`ARMED by VERIFIED workflow '${title}'. Real targets ${flows.stage1DesiredGS}/${flows.stage2DesiredGS}/${flows.stage3DesiredGS} g/s -> DE1 commands ${flows.stage1CommandMlS}/${flows.stage2CommandMlS}/${flows.stage3CommandMlS} ml/s.`);
    } else if (title === (state.cfg && state.cfg.profileTitle)) {
      log(`HyperEx selected but NOT ARMED until profile truth is verified: ${state.runtimeProfileStatus}.`);
    } else if (title) {
      log(`Not armed: selected workflow profile is '${title}'.`);
    }
    emitSkinChanged();
  }

  return {
    id: ID,
    version: PLUGIN_VERSION,

    onLoad(settings) {
      state.cfg = loadConfig(settings || {});
      state.temperatureRecheckNeeded=false;
      state.learningContextLoaded = false;
      state.scopeMode = normalizeScope(state.cfg.flowMultiplierScope);
      state.calibrationMode = normalizeCalibrationMode(state.cfg.calibrationMode);
      state.autoApplyNextShot = state.cfg.autoApplyNextShot !== false;
      state.autoApplyLastStatus = null;
      state.armed = false;
      state.workflowProfile = null;
      state.machineProfileAckKey = "";
      state.calibrationStorageLoaded = false;
      state.overrideStorageLoaded = false;state.s2RefillStorageLoaded=false;state.s2RefillSettings=null;state.s2RefillPrevious=null;state.s2RefillLoadWarning=null;
      state.scopeStorageLoaded = false;
      state.scopedOriginalStorageLoaded = false;
      state.runtimeProfileVerified = false;
      state.runtimeProfileStatus = "not verified";
      state.runtimeProfileMismatchAbortSent = false;
      state.calibrationArmed = false;
      resetSequence();
      log(`Loaded v${PLUGIN_VERSION}. Stable two-skip topology; scale feedback is validation/advisory only; optional S3 decay-compensation subframes advance by profile time and add no skipStep calls. Dual calibration profiles are installed/updated at first load; HyperEx flow settings are desired REAL mass flow: ${state.cfg.stage1Flow}/${state.cfg.stage2Flow}/${state.cfg.stage3Flow} g/s. flowMultiplier scope=${scopeLabel(state.scopeMode)}. Dashboard idle shortcut=${state.cfg.idleDashboardShortcut ? "enabled" : "off (plugin page primary)"}. Brew state machine remains v0.1.16/v0.1.17 baseline.`);
      connectScaleStream();
      connectWaterLevelStream();
      storageRead(STORAGE_UI_LANGUAGE);
    storageRead(STORAGE_CAL);
      storageRead(STORAGE_SCOPE);
      storageRead(STORAGE_PENDING_MULT);
      storageRead(STORAGE_GLOBAL_PREVIOUS);
      storageRead(STORAGE_SCOPED_ORIGINAL);
      storageRead(STORAGE_CAL_MODE);
      storageRead(STORAGE_S1_STARTUP);
      storageRead(STORAGE_TEST_OVERRIDES);
      storageRead(STORAGE_S2_REFILL);
      storageRead(STORAGE_AUTO_APPLY);
      storageRead(STORAGE_HISTORY_FILE);
      storageRead(STORAGE_ADAPTIVE_HISTORY);
      startPersistentHistoryProbe();
      refreshFlowMultiplier(true).then(() => {
        recomputeCalibrationUsability();
        emitSkinChanged();
      });
      ensureProfileInstalled();
      ensureCalibrationProfilesInstalled();
    },

    async __httpRequestHandler(request) {
      if(request.endpoint === "history-review"){
        try{return pluginHttpJson(request,200,{history:setLearningHistoryReview(request.body),...calibrationStatusPayload()});}
        catch(error){return pluginHttpJson(request,409,{error:String(error.message||error),...calibrationStatusPayload()});}
      }
      if(request.endpoint === "language"){
        if(request.body&&Object.prototype.hasOwnProperty.call(request.body,"language")||String(request.method||"GET").toUpperCase()==="POST"){
          const language=request.body&&request.body.language;if(!["zh","en"].includes(language))return pluginHttpJson(request,400,{error:"Unsupported language"});
          if(!storageWrite(STORAGE_UI_LANGUAGE,language))return pluginHttpJson(request,503,{error:"Language save failed"});
          state.uiLanguageEdited=true;state.uiLanguage=language;emitSkinChanged();
        }
        return pluginHttpJson(request,200,{language:state.uiLanguage});
      }
      if (request.endpoint === "skin") return pluginHttpJson(request, 200, buildSkinSurfaceAnswer());
      if (request.endpoint === "ui") return pluginHttpHtml(request, 200, buildGhcOverlayHtml());
      if (request.endpoint === "status") return pluginHttpJson(request, 200, uiStatusPayload());
      if (request.endpoint === "advanced-settings") return pluginHttpJson(request, 200, advancedSettingsPayload());
      if (request.endpoint === "diagnostics") {
        const run = state.diagnosticLast;
        return pluginHttpJson(request, run ? 200 : 404, run ? { summary: diagnosticSummary(run), run } : { error: "No diagnostic run captured yet" });
      }
      if (request.endpoint === "diagnostics-csv") {
        const run = state.diagnosticLast;
        return pluginHttpText(request, run ? 200 : 404, "text/csv; charset=utf-8", diagnosticCsv(run), run ? { "Content-Disposition": `attachment; filename=hyperex-${run.runId}.csv` } : {});
      }
      if (request.endpoint === "history-export") return pluginHttpText(request, 200, "application/json; charset=utf-8", JSON.stringify(historyExportPayload()), { "Content-Disposition": "attachment; filename=hyperex-history.json" });

      if (request.endpoint === "history-import") {
        if (state.phase !== "idle") return pluginHttpJson(request, 409, { error: "Import only while HyperEx is idle" });
        if (!state.persistentHistoryLoaded || !state.storageProbeVerified || state.persistentHistoryAvailable === false) return pluginHttpJson(request, 503, { error: "Persistent history storage is not ready" });
        let body;
        try { body = typeof request.body === "string" ? JSON.parse(request.body) : (request.body || {}); } catch (_) { return pluginHttpJson(request, 400, { error: "Invalid JSON body" }); }
        const incoming = Array.isArray(body && body.shots) ? body.shots : (Array.isArray(body) ? body : []);
        if (!incoming.length) return pluginHttpJson(request, 400, { error: "No shots in file" });
        const file = state.persistentHistoryFile && Array.isArray(state.persistentHistoryFile.shots)
          ? state.persistentHistoryFile
          : { schema: 2, kind: "HyperExAdaptiveHistory", writerVersion: PLUGIN_VERSION, createdAt: new Date().toISOString(), shots: [] };
        const byId = new Map();
        for (const row of file.shots || []) if (row && row.runId) byId.set(String(row.runId), row);
        let imported = 0, replaced = 0, skipped = 0;
        for (const row of incoming) {
          if (!row || typeof row !== "object" || !row.runId) { skipped += 1; continue; }
          const id = String(row.runId);
          if (byId.has(id)) replaced += 1; else imported += 1;
          byId.set(id, { ...row, runId: id });
        }
        const shots = Array.from(byId.values())
          .sort((a, b) => String(a.endedAt || a.startedAt || "").localeCompare(String(b.endedAt || b.startedAt || "")))
          .slice(-HISTORY_FILE_MAX_SHOTS);
        state.persistentHistoryFile = { ...file, shots, updatedAt: new Date().toISOString() };
        const persisted = persistHistoryFile();
        restoreAdaptiveHistoryFromPersistentFile();
        emitSkinChanged();
        return pluginHttpJson(request, 200, { imported, replaced, skipped, total: shots.length, persisted: !!persisted });
      }

      if (request.endpoint === "calibration-import") {
        if (state.phase !== "idle" || state.calibrationActive) return pluginHttpJson(request, 409, { error: "Import only while HyperEx is idle" });
        let body;
        try { body = typeof request.body === "string" ? JSON.parse(request.body) : (request.body || {}); } catch (_) { return pluginHttpJson(request, 400, { error: "Invalid JSON body" }); }
        let source = body && (body.map || body.calibration || (Array.isArray(body.points) ? body : null));
        if (!source && Array.isArray(body && body.shots)) {
          for (let i = body.shots.length - 1; i >= 0; i -= 1) {
            const fp = body.shots[i] && body.shots[i].fingerprint;
            if (fp && Array.isArray(fp.lutPoints) && fp.lutPoints.length >= 3) {
              source = { schema: Number(fp.lutSchema || 3), valid: true, createdAt: fp.mapCreatedAt, baseFlowMultiplier: fp.baseFlowMultiplier, algorithm: fp.lutAlgorithm || "imported-lut", points: fp.lutPoints };
              break;
            }
          }
        }
        if (!source || !Array.isArray(source.points)) return pluginHttpJson(request, 400, { error: "No calibration points in file" });
        const points = source.points
          .map(p => ({ ...p, actualFlow: Number(p && p.actualFlow), commandFlow: Number(p && p.commandFlow) }))
          .filter(p => Number.isFinite(p.actualFlow) && p.actualFlow > 0 && Number.isFinite(p.commandFlow) && p.commandFlow >= 0.1 && p.commandFlow <= 8)
          .sort((a, b) => a.actualFlow - b.actualFlow);
        const monotonic = [];
        for (const p of points) if (!monotonic.length || p.commandFlow > monotonic[monotonic.length - 1].commandFlow + 1e-6) monotonic.push(p);
        if (monotonic.length < 3) return pluginHttpJson(request, 400, { error: "Need at least 3 monotonic points" });
        const currentBase = Number(calibrationBaseMultiplier());
        const base = Number.isFinite(Number(source.baseFlowMultiplier)) ? Number(source.baseFlowMultiplier) : (Number.isFinite(currentBase) ? currentBase : (Number(state.flowMultiplierCurrent) || 1));
        const map = {
          schema: 3, valid: true,
          algorithm: source.algorithm || "imported-lut",
          createdAt: source.createdAt || new Date().toISOString(),
          baseFlowMultiplier: base,
          suggestedFlowMultiplier: Number.isFinite(Number(source.suggestedFlowMultiplier)) ? Number(source.suggestedFlowMultiplier) : null,
          points: monotonic,
          actualRange: [monotonic[0].actualFlow, monotonic[monotonic.length - 1].actualFlow]
        };
        const merged = adoptCalibrationMap(map);
        emitSkinChanged();
        return pluginHttpJson(request, 200, { points: merged.points.length, range: merged.actualRange, usable: !!state.calibrationMapUsable, staleReason: state.calibrationMapStaleReason || "", merge: merged.merge || null });
      }
      if (request.endpoint === "adaptive-audit") {
        try { return pluginHttpJson(request,200,await adaptiveAuditPayload()); }
        catch(error) { return pluginHttpJson(request,503,{error:String(error.message||error),autoApply:state.autoApplyLastStatus}); }
      }
      if (request.endpoint === "calibration-status") {
        await refreshFlowMultiplier(true);
        if (state.workflowTitle === state.cfg.profileTitle && profileSyncIsIdle()) {
          try { await verifyAndRepairSelectedHyperExProfile('diagnostics refresh'); } catch (_) {}
        }
        return pluginHttpJson(request, 200, calibrationStatusPayload());
      }
      if (request.endpoint === "calibration-mode") {
        try {
          if (state.calibrationActive) throw new Error('Cannot change calibration mode while calibration is running');
          const raw = request.body && request.body.mode !== undefined ? request.body.mode : 'low';
          state.calibrationMode = normalizeCalibrationMode(raw);
          storageWrite(STORAGE_CAL_MODE, state.calibrationMode);
          await ensureCalibrationProfilesInstalled();
          log(`Flow Calibration mode -> ${calibrationModeConfig().label}; dedicated profile '${calibrationProfileTitle(state.calibrationMode)}'.`);
          emitSkinChanged();
          return pluginHttpJson(request, 200, calibrationStatusPayload());
        } catch (error) {
          return pluginHttpJson(request, 409, { error: String(error.message || error), ...calibrationStatusPayload() });
        }
      }
      if (request.endpoint === "adaptive-next-apply") {
        try {
          const result = await applyNextShotAdaptiveSuggestion(state.diagnosticLast, "manual");
          state.autoApplyLastStatus = { runId: result.suggestion.runId, status:"manual-applied", at:new Date().toISOString(), message:"Verified next-shot adaptive override applied manually", commandFlows:result.commandFlows };
          return pluginHttpJson(request, 200, { ...result, ...calibrationStatusPayload() });
        } catch (error) {
          return pluginHttpJson(request, 409, { error: String(error.message || error), ...calibrationStatusPayload() });
        }
      }
      if (request.endpoint === "adaptive-auto-set") {
        try {
          if (state.phase !== "idle" || state.calibrationActive) throw new Error("Auto-apply mode can only be changed while HyperEx is idle");
          state.autoApplyNextShot = !(request.body && request.body.enabled === false);
          storageWrite(STORAGE_AUTO_APPLY, state.autoApplyNextShot ? "true" : "false");
          state.autoApplyLastStatus = { status:"mode", at:new Date().toISOString(), message: state.autoApplyNextShot ? "AUTO APPLY enabled for future completed shots" : "AUTO APPLY disabled; v0.1.39 manual confirmation flow restored" };
          emitSkinChanged();
          log(`AUTO APPLY NEXT SHOT -> ${state.autoApplyNextShot ? "ON" : "OFF"}.`);
          return pluginHttpJson(request, 200, calibrationStatusPayload());
        } catch (error) {
          return pluginHttpJson(request, 409, { error: String(error.message || error), ...calibrationStatusPayload() });
        }
      }
      if(request.endpoint === "refill-settings-save"){
        try{return pluginHttpJson(request,200,{...await saveS2RefillSettings(request.body),...calibrationStatusPayload()});}
        catch(error){return pluginHttpJson(request,409,{error:String(error.message||error),...calibrationStatusPayload()});}
      }
      if (request.endpoint === "curve-edit-apply") {
        try { const result=await applyCurveEditorDraft(request.body);return pluginHttpJson(request,200,{...result,...calibrationStatusPayload()}); }
        catch(error){return pluginHttpJson(request,409,{error:String(error.message||error),...calibrationStatusPayload()});}
      }
      if (request.endpoint === "test-command-set") {
        const previousOverrides=state.testOverrides?JSON.parse(JSON.stringify(state.testOverrides)):null,previousStatus=state.autoApplyLastStatus;let acquired=false,written=false;
        try {
          if(state.curveApplyBusy||state.runtimeProfileRepairBusy||state.autoApplyLastStatus&&state.autoApplyLastStatus.status==="applying")throw new Error("曲线正在同步，请稍后再试");
          if(state.workflowTitle!==state.cfg.profileTitle||!state.runtimeProfileVerified)throw new Error("请先选择并校验 HyperEx 曲线");
          if(request.body&&request.body.revision&&request.body.revision!==curveEditorRevision())throw new Error("下一杯参数已改变，请重新载入后编辑");
          if (!state.cfg) throw new Error("HyperEx configuration unavailable");
          if (state.phase !== "idle" || state.calibrationActive) throw new Error("Manual test commands can only be changed while HyperEx is idle");
          recomputeCalibrationUsability();
          if (!state.calibrationMapUsable) throw new Error(`Calibration LUT is not usable: ${state.calibrationMapStaleReason || "not ready"}`);
          const incoming = request.body && request.body.stages && typeof request.body.stages === "object" ? request.body.stages : {};
          const stages = {};
          for (const stage of ["stage1","stage2","stage3"]) {
            const q=incoming[stage]&&typeof incoming[stage]==="object"?incoming[stage]:{},previous=state.testOverrides&&state.testOverrides.stages&&state.testOverrides.stages[stage];
            let mode=String(q.mode||"auto").toLowerCase(),command=Number(q.command),origin="original";
            const actual=stage==="stage3"?commandFlowSummary().stage3FlatCommandMlS:resolvedStageCommandFlow(stage,state.cfg[stage+"Flow"]);
            if(mode==="keep"&&Math.abs(command-actual)<.00001){stages[stage]=previous?{...previous,origin:stageCommandOrigin(stage,false)}:{mode:"auto",command:null,origin:"original"};continue;}
            if(mode==="keep")mode="manual";
            mode=mode==="manual"?"manual":"auto";
            if(mode==="manual"&&(!Number.isFinite(command)||command<LIMITS.commandFlowMin||command>LIMITS.commandFlowMax))throw new Error(`${stage.toUpperCase()} manual command must be ${LIMITS.commandFlowMin.toFixed(2)}–${LIMITS.commandFlowMax.toFixed(2)} ml/s`);
            if(mode==="manual")origin="manual";
            stages[stage]={mode,origin,command:mode==="manual"?round(clampCommandFlow(command),3):null};
          }
          const rawShape = request.body && request.body.s3Shape && typeof request.body.s3Shape === "object" ? request.body.s3Shape : {};
          const shapeEnabled = rawShape.enabled === true;
          let s3Shape = { enabled:false };
          if (shapeEnabled) {
            const earlyCommand = Number(rawShape.earlyCommand), midCommand = Number(rawShape.midCommand), lateCommand = Number(rawShape.lateCommand);
            const earlySeconds = Number(rawShape.earlySeconds), midSeconds = Number(rawShape.midSeconds);
            for (const [label,v] of [["EARLY",earlyCommand],["MID",midCommand],["LATE",lateCommand]]) {
              if (!Number.isFinite(v) || v < LIMITS.commandFlowMin || v > LIMITS.commandFlowMax) throw new Error(`S3 ${label} shape command must be ${LIMITS.commandFlowMin.toFixed(2)}–${LIMITS.commandFlowMax.toFixed(2)} ml/s`);
            }
            if (!(earlyCommand <= midCommand && midCommand <= lateCommand)) throw new Error("S3 DECAY COMP commands must satisfy EARLY ≤ MID ≤ LATE");
            if (!Number.isFinite(earlySeconds) || earlySeconds < 3 || earlySeconds > 30 || !Number.isFinite(midSeconds) || midSeconds < 3 || midSeconds > 30) throw new Error("S3 shape EARLY/MID times must be 3–30 seconds");
            const boundedRise = (a,b) => b <= Math.max(a + 0.25, a * 1.35) + 1e-9;
            if (!boundedRise(earlyCommand,midCommand) || !boundedRise(midCommand,lateCommand)) throw new Error("S3 shape adjacent command rise exceeds test bound (max 35% and 0.25 ml/s)");
            s3Shape = { enabled:true, origin:"manual", earlyCommand:round(earlyCommand,3), earlySeconds:round(earlySeconds,1), midCommand:round(midCommand,3), midSeconds:round(midSeconds,1), lateCommand:round(lateCommand,3) };
            const previousShape=s3ShapeStatus();if(previousShape.enabled&&["earlyCommand","midCommand","lateCommand","earlySeconds","midSeconds"].every(k=>Math.abs(Number(previousShape[k])-Number(s3Shape[k]))<.00001))s3Shape.origin=stageCommandOrigin("stage3",true);
          }
          const binding = testOverrideBinding();
          state.curveApplyBusy=true;acquired=true;clearTimer("autoApplyTimer");
          state.testOverrides = { schema:3, writerVersion:PLUGIN_VERSION, savedAt:new Date().toISOString(), mapCreatedAt:binding.mapCreatedAt, activeRelease:binding.activeRelease, basketContext:binding.basketContext, targets:binding.targets, stages, s3Shape,
            manualCurveSource:{afterRunId:state.diagnosticLast&&state.diagnosticLast.runId||"",appliedAt:new Date().toISOString(),mode:"numeric-editor"} };written=true;
          storageWrite(STORAGE_TEST_OVERRIDES, state.testOverrides);
          await syncHyperExProfile(state.workflowTitle === state.cfg.profileTitle);
          log(`Manual test commands updated: ${JSON.stringify(commandFlowSummary())}`);
          if(!state.runtimeProfileVerified||!state.machineProfileAckKey)throw new Error("下一杯曲线尚未校验成功");
          state.autoApplyLastStatus={runId:state.testOverrides.manualCurveSource.afterRunId,status:"curve-applied",at:new Date().toISOString(),message:"手动参数已校验并应用；新杯完成后继续自动学习"};
          const payload=calibrationStatusPayload();if(payload.curveEditor)payload.curveEditor.canApply=true;
          return pluginHttpJson(request, 200, {verified:true,...payload});
        } catch (error) {
          if(written){state.testOverrides=previousOverrides;storageWrite(STORAGE_TEST_OVERRIDES,previousOverrides||"");try{await syncHyperExProfile(state.workflowTitle===state.cfg.profileTitle,"manual rollback");}catch(_){}state.autoApplyLastStatus=previousStatus;restoreManualApplySchedule(previousStatus);}
          return pluginHttpJson(request, 409, { error: String(error.message || error), ...calibrationStatusPayload() });
        } finally {if(acquired)state.curveApplyBusy=false;}
      }
      if (request.endpoint === "test-command-clear") {
        const previousOverrides=state.testOverrides?JSON.parse(JSON.stringify(state.testOverrides)):null,previousStatus=state.autoApplyLastStatus;let acquired=false,written=false;
        try {
          if(state.curveApplyBusy||state.runtimeProfileRepairBusy||state.autoApplyLastStatus&&state.autoApplyLastStatus.status==="applying")throw new Error("曲线正在同步，请稍后再试");
          if(state.workflowTitle!==state.cfg.profileTitle||!state.runtimeProfileVerified)throw new Error("请先选择并校验 HyperEx 曲线");
          if(request.body&&request.body.revision&&request.body.revision!==curveEditorRevision())throw new Error("下一杯参数已改变，请重新载入后编辑");
          if (state.phase !== "idle" || state.calibrationActive) throw new Error("Manual test commands can only be changed while HyperEx is idle");
          state.curveApplyBusy=true;acquired=true;clearTimer("autoApplyTimer");
          state.testOverrides={schema:3,writerVersion:PLUGIN_VERSION,savedAt:new Date().toISOString(),...testOverrideBinding(),stages:{stage1:{mode:"auto",command:null},stage2:{mode:"auto",command:null},stage3:{mode:"auto",command:null}},s3Shape:{enabled:false},manualCurveSource:{afterRunId:state.diagnosticLast&&state.diagnosticLast.runId||"",appliedAt:new Date().toISOString(),mode:"lut-reset"}};written=true;
          storageWrite(STORAGE_TEST_OVERRIDES,state.testOverrides);
          await syncHyperExProfile(state.workflowTitle === state.cfg.profileTitle);
          log("Manual test commands cleared; all stages returned to AUTO / LUT.");
          if(!state.runtimeProfileVerified||!state.machineProfileAckKey)throw new Error("下一杯曲线尚未校验成功");
          state.autoApplyLastStatus={runId:state.testOverrides.manualCurveSource.afterRunId,status:"curve-applied",at:new Date().toISOString(),message:"手动参数已校验并应用；新杯完成后继续自动学习"};
          const payload=calibrationStatusPayload();if(payload.curveEditor)payload.curveEditor.canApply=true;
          return pluginHttpJson(request, 200, {verified:true,...payload});
        } catch (error) {
          if(written){state.testOverrides=previousOverrides;storageWrite(STORAGE_TEST_OVERRIDES,previousOverrides||"");try{await syncHyperExProfile(state.workflowTitle===state.cfg.profileTitle,"manual rollback");}catch(_){}state.autoApplyLastStatus=previousStatus;restoreManualApplySchedule(previousStatus);}
          return pluginHttpJson(request, 409, { error: String(error.message || error), ...calibrationStatusPayload() });
        } finally {if(acquired)state.curveApplyBusy=false;}
      }
      if (request.endpoint === "calibration-prepare") {
        try {
          const payload = await prepareCalibrationProfile({
            allowUnknownWater: !!(request.body && request.body.allowUnknownWater),
            allowLowMargin: !!(request.body && request.body.allowLowMargin)
          });
          return pluginHttpJson(request, 202, payload);
        } catch (error) {
          return pluginHttpJson(request, 409, { error: String(error.message || error), ...calibrationStatusPayload() });
        }
      }
      if (request.endpoint === "calibration-scope") {
        try {
          const raw = request.body && request.body.scope !== undefined ? request.body.scope : null;
          const next = normalizeScope(raw);
          if (state.scopeMode === 'hyperex' && next !== 'hyperex') await restoreHyperExScopedMultiplier('scope changed');
          state.scopeMode = next;
          storageWrite(STORAGE_SCOPE, next);
          recomputeCalibrationUsability();
          if (next === 'hyperex' && inHyperExScope(state.workflowTitle)) await enterHyperExScopedMultiplier('scope changed to HyperEx only');
          if (next !== 'hyperex') await syncHyperExProfile(state.workflowTitle === state.cfg.profileTitle);
          emitSkinChanged();
          return pluginHttpJson(request, 200, calibrationStatusPayload());
        } catch (error) {
          return pluginHttpJson(request, 409, { error: String(error.message || error), ...calibrationStatusPayload() });
        }
      }
      if (request.endpoint === "calibration-sync") {
        try {
          await refreshFlowMultiplier(true);
          await syncHyperExProfile(state.workflowTitle === state.cfg.profileTitle);
          return pluginHttpJson(request, 200, calibrationStatusPayload());
        } catch (error) {
          return pluginHttpJson(request, 409, { error: String(error.message || error), ...calibrationStatusPayload() });
        }
      }
      if (request.endpoint === "calibration-use-suggested") {
        try {
          recomputeCalibrationUsability();
          const suggested = state.calibrationMap && Number(state.calibrationMap.schema || 0) >= 3 && state.calibrationMap.valid === true ? Number(state.calibrationMap.suggestedFlowMultiplier) : NaN;
          if (!state.calibrationMapUsable || !Number.isFinite(suggested)) throw new Error('No valid/usable calibration map with a suggested multiplier');
          state.calibrationPendingMultiplier = suggested;
          storageWrite(STORAGE_PENDING_MULT, String(suggested));
          log(`Suggested flowMultiplier ${suggested.toFixed(3)} selected for NEXT Flow Calibration. Existing LUT remains tied to ${round(calibrationBaseMultiplier(),3)} until the rerun completes.`);
          return pluginHttpJson(request, 200, calibrationStatusPayload());
        } catch (error) {
          return pluginHttpJson(request, 409, { error: String(error.message || error), ...calibrationStatusPayload() });
        }
      }
      if (request.endpoint === "calibration-apply-global") {
        try {
          recomputeCalibrationUsability();
          const suggested = state.calibrationMap && Number(state.calibrationMap.schema || 0) >= 3 && state.calibrationMap.valid === true ? Number(state.calibrationMap.suggestedFlowMultiplier) : NaN;
          if (!state.calibrationMapUsable || !Number.isFinite(suggested)) throw new Error('No valid/usable calibration map with a suggested multiplier');
          if (finiteOrNull(state.scopedOriginalMultiplier) !== null) await restoreHyperExScopedMultiplier('before global apply');
          const previous = await refreshFlowMultiplier(true);
          if (!Number.isFinite(previous)) throw new Error('Cannot read current DE1 flowMultiplier');
          state.globalPreviousMultiplier = previous;
          storageWrite(STORAGE_GLOBAL_PREVIOUS, String(previous));
          state.scopeMode = 'global';
          storageWrite(STORAGE_SCOPE, 'global');
          await writeFlowMultiplier(suggested, 'explicit GLOBAL apply');
          state.calibrationPendingMultiplier = suggested;
          storageWrite(STORAGE_PENDING_MULT, String(suggested));
          recomputeCalibrationUsability();
          await syncHyperExProfile(state.workflowTitle === state.cfg.profileTitle);
          log(`GLOBAL flowMultiplier applied: ${suggested.toFixed(3)} (previous ${previous.toFixed(3)} saved). Re-run Flow Calibration before trusting the LUT at this multiplier.`);
          emitSkinChanged();
          return pluginHttpJson(request, 200, calibrationStatusPayload());
        } catch (error) {
          return pluginHttpJson(request, 409, { error: String(error.message || error), ...calibrationStatusPayload() });
        }
      }
      if (request.endpoint === "calibration-restore-global") {
        try {
          const previous = finiteOrNull(state.globalPreviousMultiplier);
          if (!Number.isFinite(previous)) throw new Error('No saved pre-global flowMultiplier to restore');
          await writeFlowMultiplier(previous, 'restore pre-global value');
          state.scopeMode = 'off';
          storageWrite(STORAGE_SCOPE, 'off');
          state.calibrationPendingMultiplier = null;
          storageWrite(STORAGE_PENDING_MULT, '');
          recomputeCalibrationUsability();
          await syncHyperExProfile(state.workflowTitle === state.cfg.profileTitle);
          emitSkinChanged();
          return pluginHttpJson(request, 200, calibrationStatusPayload());
        } catch (error) {
          return pluginHttpJson(request, 409, { error: String(error.message || error), ...calibrationStatusPayload() });
        }
      }
      if (request.endpoint === "calibration-clear") {
        state.calibrationMap = null;
        state.calibrationMapUsable = false;
        state.calibrationMapStaleReason = 'calibration cleared';
        state.calibrationPendingMultiplier = null;
        storageWrite(STORAGE_CAL, '');
        state.testOverrides = null; storageWrite(STORAGE_TEST_OVERRIDES, '');
        state.adaptiveHistory = []; state.persistentHistoryCompatibleCount = 0; storageWrite(STORAGE_ADAPTIVE_HISTORY, '');
        storageWrite(STORAGE_PENDING_MULT, '');
        try { await syncHyperExProfile(state.workflowTitle === state.cfg.profileTitle); } catch (_) {}
        emitSkinChanged();
        return pluginHttpJson(request, 200, calibrationStatusPayload());
      }
      if (request.endpoint === "startup-apply") {
        return pluginHttpJson(request, 409, { error: "Legacy startup-apply is disabled in v" + PLUGIN_VERSION + ". S1 is handled only by the unified shot-to-shot adaptive engine after two matching MEDIUM-confidence startup shots." });
      }
      if (request.endpoint === "startup-clear") {
        state.stage1StartupCorrection = null; storageWrite(STORAGE_S1_STARTUP, '');
        try { await syncHyperExProfile(state.workflowTitle === state.cfg.profileTitle); } catch (_) {}
        return pluginHttpJson(request, 200, { ok:true, commandFlows: commandFlowSummary() });
      }
      if (request.endpoint === "rearm") {
        try {
          const payload = await manualRearmSecondStage();
          return pluginHttpJson(request, 202, payload);
        } catch (error) {
          return pluginHttpJson(request, state.phase === "restart_wait" ? 429 : 409, { error: String(error.message || error), ...uiStatusPayload() });
        }
      }
      return pluginHttpJson(request, 404, { error: "not found" });
    },

    onUnload() {
      if (state.liveTrim && state.liveTrim.active) requestMachineState("idle").catch(()=>{});
      if (state.directStartTest && state.directStartTest.active) {
        requestMachineState("idle").catch(error=>log(`Direct test unload Idle failed: ${error.message||error}`));
      }
      clearTimer("storageProbeTimer");
      clearTimer("historyWriteTimer");
      clearTimer("historyRecoveryTimer");
      if (state.calibrationActive) {
        // Preserve the raw run as diagnostics even if unloading interrupts calibration.
        const run = state.diagnosticCurrent;
        if (run) {
          diagnosticSample('plugin_unload', true);
          run.endedAt = new Date().toISOString();
          run.result = 'interrupted: plugin unloaded';
          state.diagnosticLast = run;
          state.diagnosticCurrent = null;
        }
      } else if (state.diagnosticCurrent) {
        finalizeDiagnostics("plugin unloaded");
      }
      if (finiteOrNull(state.scopedOriginalMultiplier) !== null) {
        restoreHyperExScopedMultiplier('plugin unload').catch(() => {});
      }
      clearAllTimers();
      stopGhcPrompt("cleared", "HyperEx plugin unloaded");
      closeScaleStream();
      log("Unloaded; timers cleared and scale stream closed.");
    },

    onEvent(event) {
      if (!event || !event.name) return;
      if (event.name === "workflowUpdated") {
        handleWorkflowUpdated(event.payload || {});
      } else if (event.name === "stateUpdate") {
        handleStateUpdate(event.payload || {});
      } else if (event.name === "storageRead") {
        const payload = event.payload || {};
        const key = payload.key;
        const value = payload.value;
        if(key===STORAGE_UI_LANGUAGE){
          const language=typeof value==="string"?value:parseStoredJson(value);
          if(!state.uiLanguageEdited&&["zh","en"].includes(language))state.uiLanguage=language;
          emitSkinChanged();
        } else if(key===STORAGE_S2_REFILL){
          const saving=state.pendingRefillSave;
          if(saving){
            let ok=false;
            try{const p=value?parseStoredJson(value):null;ok=!!p&&["basis","startDelayMs","targetPercent","cutoffPercent","maxDurationMs","approachMs"].every(k=>p[k]===saving.expected[k]);}catch(_){ok=false;}
            saving.resolve(ok);
            return;
          }
          if(state.phase!=="idle"||state.curveApplyBusy)return;
          try{const parsed=value?parseStoredJson(value):null;if(value&&!parsed)throw new Error("invalid stored JSON");const restored=value?validatedS2RefillSettings(parsed):null;
            // v1 stored a CUP-target percentage. Migrate only that percentage;
            // preserve the user's cutoff, timing, curve commands and S3 shape.
            if(restored&&parsed.basis===undefined){restored.targetPercent=160;state.s2RefillLoadWarning="S2 refill migrated to160% of base pump flow; timing and cutoff retained";}
            else state.s2RefillLoadWarning=null;
            state.s2RefillSettings=restored;state.s2RefillPrevious=validatedRefillPrevious(parsed&&parsed.previousChange);}
          catch(_){state.s2RefillSettings=null;state.s2RefillPrevious=null;state.s2RefillLoadWarning="Invalid saved S2 refill settings; defaults restored";}
          state.s2RefillStorageLoaded=true;
          if(state.cfg&&state.calibrationStorageLoaded)syncHyperExProfile(state.workflowTitle===state.cfg.profileTitle,"S2 refill settings restored").catch(error=>log(String(error.message||error)));
          emitSkinChanged();
        } else if (key === STORAGE_CAL) {
          state.calibrationStorageLoaded = true;
          const parsed = parseStoredJson(value);
          if (parsed && Number(parsed.schema || 0) >= 1) state.calibrationMap = parsed;
          recomputeCalibrationUsability();
          restoreAdaptiveHistoryFromPersistentFile();
          if (state.cfg && state.cfg.calibrationAutoSync && state.calibrationMapUsable) {
            const selected = state.workflowTitle === state.cfg.profileTitle;
            syncHyperExProfile(selected, 'stored calibration loaded').catch(error => log(`Stored calibration auto-sync failed: ${error.message || error}`));
          }
          emitSkinChanged();
        } else if (key === STORAGE_CAL_MODE && value) {
          state.calibrationMode = normalizeCalibrationMode(value);
          emitSkinChanged();
        } else if (key === STORAGE_SCOPE) {
          state.scopeStorageLoaded = true;
          if (value) state.scopeMode = normalizeScope(value);
          recomputeCalibrationUsability();
          scheduleProfileVerification('stored multiplier scope loaded');
          emitSkinChanged();
        } else if (key === STORAGE_PENDING_MULT) {
          const v = value === '' || value === null || value === undefined ? NaN : Number(value);
          state.calibrationPendingMultiplier = Number.isFinite(v) ? v : null;
          emitSkinChanged();
        } else if (key === STORAGE_GLOBAL_PREVIOUS) {
          const v = value === '' || value === null || value === undefined ? NaN : Number(value);
          state.globalPreviousMultiplier = Number.isFinite(v) ? v : null;
        } else if (key === STORAGE_SCOPED_ORIGINAL) {
          state.scopedOriginalStorageLoaded = true;
          const v = value === '' || value === null || value === undefined ? NaN : Number(value);
          state.scopedOriginalMultiplier = Number.isFinite(v) ? v : null;
          if (state.scopedOriginalMultiplier !== null && !inHyperExScope(state.workflowTitle)) {
            restoreHyperExScopedMultiplier('recovery from previous interrupted scoped session').catch(() => {});
          }
          scheduleProfileVerification('stored original multiplier loaded');
        } else if (key === STORAGE_S1_STARTUP) {
          state.stage1StartupCorrection = parseStoredJson(value);
          emitSkinChanged();
        } else if (key === STORAGE_AUTO_APPLY) {
          if (value !== null && value !== undefined && value !== "") state.autoApplyNextShot = b(value, state.cfg ? state.cfg.autoApplyNextShot !== false : true);
          emitSkinChanged();
        } else if (key === STORAGE_HISTORY_PROBE) {
          if (String(value || "") === String(state.storageProbeToken || "") && state.storageProbeToken) {
            state.storageProbeVerified = true;
            state.persistentHistoryStatus = "probe verified; checking history file";
            if (state.storageProbeTimer) { clearTimeout(state.storageProbeTimer); state.storageProbeTimer = null; }
            storageWrite(STORAGE_HISTORY_PROBE, "");
            if (state.persistentHistoryLoaded) persistHistoryFile();
            else state.storageProbeTimer = setTimeout(() => setPersistentHistoryUnavailable('initial history read timed out'), 3500);
            emitSkinChanged();
          }
        } else if (key === STORAGE_HISTORY_FILE) {
          const parsed = parseStoredJson(value);
          if (!state.persistentHistoryLoaded) {
            const sessionRows = state.persistentHistoryFile && state.persistentHistoryFile.shots || [];
            state.persistentHistoryFile = parsed && Number(parsed.schema || 0) >= 2 && Array.isArray(parsed.shots) ? parsed
              : { schema:2, kind:"HyperExAdaptiveHistory", writerVersion:PLUGIN_VERSION, shots:[] };
            for (const row of sessionRows) {
              state.persistentHistoryFile.shots = state.persistentHistoryFile.shots.filter(x => x && x.runId !== row.runId).concat(row);
            }
            state.persistentHistoryFile.shots = state.persistentHistoryFile.shots.slice(-HISTORY_FILE_MAX_SHOTS);
            state.persistentHistoryLoaded = true;
            state.learningContextLoaded = true;
            if (state.storageProbeVerified) { clearTimer('storageProbeTimer'); persistHistoryFile(); }
          } else if (state.pendingHistoryWrite) {
            if (!parsed || adaptiveHistoryFingerprintKey(parsed) !== adaptiveHistoryFingerprintKey(JSON.parse(state.pendingHistoryWrite))) {
              setPersistentHistoryUnavailable('history file readback mismatch');
            } else {
              clearTimer('historyWriteTimer');
              state.pendingHistoryWrite = null;
              state.persistentHistoryAvailable = true;
              state.persistentHistoryStatus = 'probe and history file write/readback verified';
              state.historyVerifiedRunIds=(parsed.shots||[]).map(x=>x.runId);state.historyLastReadbackAt=new Date().toISOString();state.historyRecoveryAttempts=0;
              if(state.diagnosticLast&&state.diagnosticLast.summary)state.diagnosticLast.summary.historyPersistence=historyPersistenceAudit(state.diagnosticLast.runId);
              if (state.historyWriteDirty) persistHistoryFile();
            }
          }
          restoreAdaptiveHistoryFromPersistentFile();
          scheduleProfileVerification("history context loaded");
          emitSkinChanged();


        } else if (key === STORAGE_ADAPTIVE_HISTORY) {
          const parsed = parseStoredJson(value);
          if (Array.isArray(parsed)) {
            state.legacyAdaptiveHistory = parsed.filter(x => x && typeof x === "object" && x.runId).slice(-8);
            restoreAdaptiveHistoryFromPersistentFile();
          }
          emitSkinChanged();
        } else if (key === STORAGE_TEST_OVERRIDES || key === "manualTestOverridesContinuousV3") {
          if(key!==overrideStorageKey())return;
          state.overrideStorageLoaded = true;
          state.testOverrides = parseStoredJson(value);
          const os = testOverrideStatus();
          if (state.testOverrides && !os.valid && os.reason !== "none") log(`Stored manual test override ignored: ${os.reason}`);
          // Storage returns asynchronously after the initial profile install;
          // resync once so a valid persisted MANUAL TEST command is visible.
          if (state.cfg && state.calibrationStorageLoaded) {
            const selected = state.workflowTitle === state.cfg.profileTitle;
            syncHyperExProfile(selected, 'stored override loaded').catch(error => log(`Stored manual test override sync failed: ${error.message || error}`));
          }
          emitSkinChanged();
        }
      } else if (event.name === "shutdown") {
        clearTimer("storageProbeTimer");
        clearTimer("historyWriteTimer");
      clearTimer("historyRecoveryTimer");
        if (finiteOrNull(state.scopedOriginalMultiplier) !== null) restoreHyperExScopedMultiplier('shutdown').catch(() => {});
        clearAllTimers();
      }
    }
  };
}

