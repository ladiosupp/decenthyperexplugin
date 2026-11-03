# v2.2.31 交接 — S2 救急实测门槛 + 历史 80 杯（2026-11-03）

状态：已改完、已提交、已发版。代码基线 = `fec293d`（2.2.31 代码提交），发布提交 = `81fb48f`，tag `v2.2.31`。

## 用户口径

- 历史记录上限从 30 放宽到 80；按 **4 杯全量 + 6 杯 trace + 70 杯摘要**保留。
- 学习窗口仍是最近 20 杯，不跟着放宽；20 是内存证据窗口，不是学习门槛。
- 本轮要求提交到本地并发布新版。

## 改了哪一侧

只改**插件**（`plugin.js` / `manifest.json` / 测试 / README / HANDOFF）。控制律改动只有 `liveTrimTick` 的 S2 救急门槛；历史分层常量保持 4 / 10。

## 改动

1. `HISTORY_FILE_MAX_SHOTS` 30 → 80；`historyStatusPayload.maxShots` 和界面中英文文案同步为 80。
2. `HISTORY_FULL_SHOTS = 4`、`HISTORY_TRACE_SHOTS = 10` 不动 → 4 杯全量 + 6 杯 trace + 70 杯摘要。按实测单杯大小估算约 5.0MB（Windows 约 4.8MB）。
3. `history-import` 仍按 80 截断；`verify_v02231.cjs` 的导入测试改成 100 杯输入、断言保留最新 80 杯。
4. S2 杯内救急 `rescueHot` 增加 `actualRel >= 12%`：预测误差仍负责 `cannotReturn`，实测杯流偏差负责判断是否真的有大偏差。
5. `PLUGIN_VERSION` / `manifest.version` → 2.2.31；测试 `tests/verify_v02231.cjs` 727/727。

## 注意

- 已经抽稀掉的旧杯 `samples` / trace 不会因为改上限而恢复；要等新杯逐步填满 4 个全量槽和 6 个 trace 槽。
- 学习仍用 `state.adaptiveHistory.slice(-20)`；80 杯只影响审计/导出，不会让学习变强。
- `history-import` 目前只按 80 截断，没有调用 `trimHistoryFullRecords`；导入旧的多全量文件会先整份写一遍，再在下一杯/下次载入时抽稀。
- 每杯结束仍然是整份历史 JSON 写 Hive + 回读校验；80 杯约 5MB，单文件写读仍在可接受范围。

## 测试

`tests/verify_v02231.cjs` **727/727**，日志 `tests/RESULTS_v02231.txt`；`node --check` 通过。发布包解压后需复跑同样 727/727。

## 发布记录

（2026-11-03）

- commit `81fb48f`，tag `v2.2.31`，分支 `v1.79ds` 已推送。
- GitHub Release：https://github.com/ladiosupp/decenthyperexplugin/releases/tag/v2.2.31（附件 `HyperExPulseFilter_v2.2.31.zip`，442,765 字节）。
- 夸克：`夸克网盘/来自：Codex/HyperExPulseFilter_v2.2.31.zip`，fileId `352961c15a704ddb8c70fddd458c04e7`。
- SHA256：`432EB39481C46A7E642DF2809086F234B720EEFAB3F92D64ECC81DFF9F7D6262`。
- 打包：从 tag `v2.2.31` 的 `git archive` 构建（不压工作区），解压后 `node --check` 通过、复跑 **727/727**。
- 备注：夸克上传使用官方 skill 的 CLI，落在同一目录。
