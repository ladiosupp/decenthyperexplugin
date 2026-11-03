# v2.2.30 交接 — STEP 3 每折补保存入口（2026-11-03）

状态：已改完、已提交（未发版）。基线 HEAD = `8f1d307`（2.2.29 之后的 tests/sim 提交），版本 2.2.30。

## 用户口径

诊断页 STEP 3「目标与压力保护」折里没有保存按钮，改完数字不知道按哪里生效。要求 03 / 04 / 05 / 07 每折底部各放一个同款保存按钮，06 保留，全部绑同一个 `saveAdvancedSettings`；按钮仍是「保存到插件设置」，旁边加一行小字「保存提交以上所有折叠的当前值」。

## 改了哪一侧

只改**插件**（`plugin.js` / `manifest.json` / 测试 / 文档）。控制律、门槛、补水逻辑、设置项定义均未动。

## 改动

1. `fold-modecards` / `fold-targets` / `fold-livetrim` / `fold-directstart` 四个折叠底部各加 `<button class="b secondaryAction" data-save-advanced>SAVE TO PLUGIN SETTINGS</button>`；`fold-releaseparams` 保留原 `#saveadvanced`。
2. 绑定由单元素改成 `for(const saveAdv of document.querySelectorAll('#saveadvanced,[data-save-advanced]'))saveAdv.onclick=saveAdvancedSettings;`。
3. 每个按钮右侧加 `<span class="small">保存提交以上所有折叠的当前值</span>`；`UI_LANGUAGE_PAIRS` 新增一条译文。
4. 版本 `PLUGIN_VERSION` / `manifest.version` → 2.2.30；测试 `tests/verify_v02230.cjs`（自 v02229 复制）+ 1 条新测试。

## 注意

- 保存是**整张**高级设置一次提交（`ADV_FIELDS` 全量），不是只保存当前折叠；按钮文案刻意保持「保存到插件设置」。
- 这段代码在 2.2.25 之后被 2.2.26 / 2.2.27 / 2.2.29 改过外层，动手前先看 `git log --oneline -8`，不要按 2.2.25 的印象改。

## 测试

`tests/verify_v02230.cjs` **726/726**（v02229 的 725 条 + 1 条「每个含可编辑 adv_* 字段的折叠都必须有保存入口，且五个按钮共用一个处理函数」），日志 `tests/RESULTS_v02230.txt`；`node --check` 通过；58 个被页面脚本/测试引用的 id 存在性检查全在。

## 发布记录

（2026-11-03）

- commit `3fd7a47`，tag `v2.2.30`，分支 `v1.79ds` 已推送。推送时 `git push origin v1.79ds` 报 `src refspec v1.79ds matches more than one`（同名 tag 造成歧义），要用 `refs/heads/v1.79ds:refs/heads/v1.79ds`。
- GitHub Release：https://github.com/ladiosupp/decenthyperexplugin/releases/tag/v2.2.30（附件 `HyperExPulseFilter_v2.2.30.zip`，446,669 字节）。
- 夸克：`夸克网盘/来自：Codex/HyperExPulseFilter_v2.2.30.zip`，fileId `c154961c87ed445b942160cf374198e6`。
- SHA256：`828322E501BC5A9BE0BC9608614873A002DDA0B965A8B4F973FEFB342D36715D`。
- 打包：从 tag `v2.2.30` 的 `git archive` 构建（不压工作区），解压后 `node --check` 通过、复跑 **726/726**。
- 备注：夸克 MCP 的 `upload_file` 仍然稳定返回 `203`（列表/详情正常），继续用官方 skill 的 CLI（`quark-drive upload`）上传，落在同一目录。
