# HyperEx 交接 · v0.1.52
2026-10-25（Asia/Shanghai）。

## 当前文件与版本
- 本包1.52为新候选，基于已交付并上传的1.51；原1.51 ZIP未改。原1.51 SHA256：4198cb9fbdc6ba34782bda8a34feec005962e3e66b1a2c166707d7e30536d0df。
- GitHub ladiosupp/decenthyperexplugin main已核验1.51 commit54e8794d00c9146bd25b5acf4a68be2be54dcc93。用户仅授权上传1.51；1.52未上传，不可把main当1.52。
- 1.52：125/125模拟检查、plugin/browser脚本编译通过；尚未真机/填粉验证。
- 用户最新补充优先于此前检查点/1.51 skill旧说法：有粉转换自动，不要手动模式切换；空碗历史/指令应成为有粉基线，不能一刀切丢弃。背压通常增加，但不可预设杯中流量方向或保证更平滑。

## 1.51实际证据与缺陷
1.50有三杯空碗；1.51一杯（累计第四杯）后history PERSISTENT 4 saved/4 compatible，workflow实际仍.719 /2.507 /S3 .698×8s→.720×14s→.778，VERIFIED，source manual test active。
第四杯S1整段.700，startup20–80%20.677但仅.10s/2样本、active.66s，正确拒绝。S2 4.512，上杯5.188，两杯均值4.85 HIGH/HOLD。S3整体1.476，frame1.778/1.612/1.244，late/early.674，无stall。正常LEVEL+SHAPE共识maxvar5.1%，LEVEL误差−1.5%，MEDIUM，建议.688→.715→.790，LEVEL1；刷新后actual仍旧曲线。
未取得当杯原始workflow JSON及日志。因此截图和模拟不能确认当杯真实执行或唯一本杯根因。
已在1.51确定复现：finishing的多个Idle各排500ms结束reset；第一次保存history并排250ms autoapply；后一个reset清计时器，取消autoapply，且没有diagnosticCurrent可重排。1.52使用tracked completionTimer+sequence/run身份，多个Idle只排一次。全流程测试验证实际auto wrapper而非仅手动apply。

## 1.52实现
- 首次history context读回之前禁止profile上传，防止reload过早把coffee覆盖值当空碗丢弃或上传错误初值；读回后恢复工况再校验。
- 自动应用状态scheduled/applying/waiting/applied/error/cancelled，已应用同run不重复；new-shot/unload取消旧任务。保留idle和最终workflow/machine-upload校验。
- adaptive-audit只读新GET/workflow，返回raw profile、actualCommands、expected match、proposal match、cachedProfileTruth、autoApply和baseline；不repair/PUT。页面READ RAW WORKFLOW和可复制JSON，区分UI缓存与实际应用层回读。
- 新用户自动流程：无LUT→STEP1空碗校准保存原始LUT；之后STEP2空碗最多2–3杯，通过下一杯指令映射修正层调节，不覆盖原始LUT。两杯S2/S3在±12%且回归/变异质量够可提前READY；3杯合格记录仍波动/改善有限则结束空碗调优并建议最多一次填粉验收。data/stall/workflow/history/autoapply错误阻断放行，暂停查看现有诊断，不能靠再堆杯绕过。
- 准备完成后自动切coffee，不推测实物装粉；专用calibration始终空碗。不提供BasketContext手动切换。Diagnostic显示READY FOR COFFEE、现有Dashboard快捷入口READY·ADD COFFEE，不抢占其他插件slot。
- 升级后现有4杯同基线旧记录计数，不从头测。记录仅在physical fingerprint同条件下计入；已有coffee记录可跨reload保持正常模式。运行中或autoapply scheduled/applying不能改变本杯context，pending history读回完成后再转。
- 保留空碗LUT、已有valid bounded static command seed/shape（绑定校准/targets且通过既有guard），标记empty/pre-upgrade baseline seed。不会把未应用的旧建议冒充已验证指令，也不凭猜测背压写倍率。
- 保存记录不删除。完整、profileTruth3 verified、匹配物理指纹（忽略basketContext）的空碗/旧记录作为baselineResponse/reference，随新run冻结；不能作为第二杯有粉共识。新coffee overrides标记coffee；回到工程空碗（仅测试内部场景）不能泄漏coffee覆盖值。
- run.config记录basketContext、baselinePrior、三段pressure limit、实际command/fingerprint。新fingerprint带context，所以旧history咖啡compatible可为0，但baseline references仍4，用户不需要重校准/清历史。
- 有粉numeric evidence排除前1s，要求≥4个fresh valid machine样本且coverage≥80%；≥20%样本pressure≥95%limiter，或≥25%样本machineFlow<70%冻结command，或missing/stale/frame unknown→受影响stage LIMITED/HOLD。S3shape需真实profileFrame 2/3/4。这些是工程保守门槛，不宣称完整物理识别所有受限。不会提高压力limit、不会持续加指令追不可达目标。
- empty/pre-upgrade history是feed-forward初值与响应参考；coffee response完成后更新未来shot，不改LUT，不把两工况当成同一个共识数据集。

## 后续使用/验收
- 本用户已有四杯，不再安排额外空碗流量调优；新用户才走2–3杯有上限的qualification。覆盖升级，不卸载清数据，保留参数、LUT、seed、history。
- 安装后CAL READY、READY FOR COFFEE、WORKFLOW READBACK VERIFIED；已有四杯会自动计入。准备条件通过后可以填粉正常做咖啡，无需手动切模式。
- 最多一次专门填粉验收（或0次，第一杯正常饮用即可顺便观察）；后续让正常喝掉的咖啡逐杯积累，不要求一轮轮测试。
- 首杯PENDING、S1短startup REPEAT、pressure LIMITED/HOLD不直接视为程序失败。拍当前诊断/READ RAW WORKFLOW JSON即可判断；不用继续堆测试杯。
- 如果newactual指令没有更新，看proposalMatchesWorkflow、raw实际commands、autoApply状态/错误；VERIFIED可能只表示当前旧profile正确，不能当成建议已应用。
- 上传ack不是独立DE1硬件内存回读。后续snapshot/telemetry才补充执行证据。
- history跨真实reload与Dashboard CLOSE/HOME仍待观察，1.52不宣称导航修复。

## 测试和不变约束
node --check plugin.js；node tests/verify_v0152.cjs：125/125，包括原81与新增生命周期/自动/有粉/基线/pressure/audit/脚本测试。截图重建不是原始RAW重放。
真实目标杯中g/s；RAWweight+scale timestamp多秒回归是主要证据，不是DE1Flow/瞬时dWdt。当前杯固定轨迹，adaptive只下一杯，不新增skipStep，不写校准LUT。有效旧LUT保留。Settings单一源，Dashboard cooperative。
GitHub上传需明确版本授权，expected-head防覆盖，blob逐一比对，提交说明实际提交者与可确认模型。用户要求对话长之前提醒/先交接，无精确剩余token监控。Android优先真实LibraryID原生下载链接。
