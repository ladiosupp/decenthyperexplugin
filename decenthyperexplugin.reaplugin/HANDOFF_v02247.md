# HyperEx 2.2.47 交接：曲线标题前缀固定为 HyperEx

日期：2026-11-14（北京时间）。已发版（GitHub Release + 夸克），发布记录见 §6；真机验证待做。

分支：auto-hyperex。基线：2.2.46（tag v2.2.46，提交 63e788e）。

## 1. 背景

ProfileRecorder（另一对话，未提交的 v1.0.1）已按「标题以 `HyperEx` 开头才算 HyperEx 的杯」做归属判定，
但 HyperEx 插件本体仍按「精确匹配设置里的曲线名」绑定，两边口径不一致：用户给曲线改名（仍带 HyperEx 前缀）后，
recorder 认为归 HyperEx，插件却不绑定。本版把插件侧对齐到固定前缀。

## 2. 改动（全部在插件侧）

1. `plugin.js` 新增常量 `HYPEREX_TITLE_PREFIX = "HyperEx"`（与 recorder 同名同值）。
2. `isHyperExProfileTitle`：精确匹配 → `startsWith(HYPEREX_TITLE_PREFIX)`（区分大小写），
   并排除校准曲线标题（校准仍由 `isCalibrationProfileTitle` 精确匹配两条固定名走校准激活）。
   全部 50+ 处绑定点（arming、校验修复、scope flowMultiplier、曲线编辑、预设、温度采纳）自动跟随。
3. 生成标题固定：`baseProfileTitle()` 返回 `HyperEx Pulse Filter`（auto 档追加 ` auto` 的逻辑不变）；
   `calibrationProfileTitle(mode)` 返回 `HyperEx Flow Calibration - <Low Water|Full>`。不再读设置。
4. 设置项 `ProfileTitle` / `CalibrationProfileTitle` 退役：loadConfig 不再读取，manifest 删除两条目。
   旧单校准曲线隐藏迁移（hideLegacyCalibrationProfile）改按固定基础名 `HyperEx Flow Calibration`。
5. 版本 2.2.46 → 2.2.47（plugin.js / manifest.json / 诊断页 / 回归断言同步）。

## 3. 行为影响

- 任何以 `HyperEx` 开头的选中曲线都会被插件校验/修复/控制；同步时按既有逻辑把执行内容（含标题）
  回写为规范生成曲线（改名曲线会被规范化回 `HyperEx Pulse Filter`，与旧版对内容漂移的修复行为一致）。
- 不带前缀的曲线（如拉杆程序）完全不介入；recorder 的归属判定与插件绑定从此同口径。
- 旧自定义曲线名（不带 HyperEx 前缀）不再被绑定；默认名用户无感。
- 校准激活、arming 时机、控制律、LUT、学习、补水一律未动。

## 4. 验证

- tests/verify_v02247.cjs **801/801**（796 基线全绿 + 5 新增）：
  前缀绑定正负例（含大小写、校准标题排除）、生成标题固定且忽略旧设置、
  改名 HyperEx 曲线经校验回写后 arming、非前缀曲线不介入、manifest 无退役设置项。
- node --check plugin.js / verify_v02247.cjs 通过；manifest JSON 解析通过。
- RESULTS_v02247.txt 已生成。

## 5. 不碰

皮肤、宿主、ProfileRecorder（其 v1.0.1 未提交改动保持原样）、sim/、app/。

## 6. 发布记录（2026-11-14，用户授权「提交，发版上传github和夸克」）

- 代码提交 25e43da，tag v2.2.47（annotated），分支 auto-hyperex 已推送（走 VPN 代理 127.0.0.1:57890）。
  同批推上去的还有另一对话的提交 284c626（ProfileReplayer UI，只动 app/ 四文件）；发版包从 tag 用 git archive 取，不含该提交内容。
- GitHub Release：https://github.com/ladiosupp/decenthyperexplugin/releases/tag/v2.2.47 （Latest，非 draft、非 prerelease）。
- 附件：HyperExPulseFilter_v2.2.47.zip，487,570 字节。
- SHA256：357E9DA7A628FFE34DBD7E4709E74B237486E425D74CD58CFBD092EB1FE63731。
- 夸克：夸克网盘/来自：Codex/HyperExPulseFilter_v2.2.47.zip，487,570 字节，fileId 2c2e129fe75140d1806843ab5dea10a3。
- 包内复核：解压后 node --check 通过、tests/verify_v02247.cjs 801/801。
- gh 登录态说明：gh 默认 token 已失效，本次按 release/__gh_token_check.ps1 的口径从 git 凭据管理器取 token（GH_TOKEN）发 Release。

## 7. 待办

- 真机验证：平板当前 2.2.45/2.2.46；装 2.2.47 后出一杯 HyperEx 曲线 + 一杯非 HyperEx 曲线，
  确认插件只绑定前者、recorder 只记后者。
