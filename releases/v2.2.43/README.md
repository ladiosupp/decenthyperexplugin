# HyperEx Pulse Filter 2.2.43（实验版）

三档泄压：`auto` / `on` / `off`，默认 `auto`。

- `auto`：S1 到重量后进入真实的 0 bar 泄压/浸泡帧，再在同一杯自动进 S2/S3；不需要第二次按 GHC 萃取键。0 bar 帧时长就是 `SoakSeconds`，插件倒计时同值。
- `on`：原来的 Idle → soak → GHC 重启路径。
- `off`：连续 S1 → S2 → S3。

auto 曲线标题为 `<ProfileTitle> auto`。采样/学习/图表/CSV 保持逻辑帧，旧 on 模式学习记录和 S1/S2/S3 控制参数继续可用。流量校准仍用物理帧。

安装包：`HyperExPulseFilter_v2.2.43_experimental.zip`，解压后根目录为 `decenthyperexplugin.reaplugin/`。

测试：`tests/verify_v02242auto.cjs` **783/783** 通过。真机尚未验证；重点看 0 bar 帧实际泄压、SoakSeconds 倒计时进 S2、S2 起步/补水是否与 on 模式有差异。

回滚：切回 2.2.42 包；或把泄压模式设为 `on` 回到原路径、`off` 回到连续模式。
