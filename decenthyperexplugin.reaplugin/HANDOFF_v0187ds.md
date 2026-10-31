# HyperEx 1.87ds handoff — 2026-10-31

开发版，版本号 1.87ds（非严格 semver）。导入的 URL 通道，适配无法使用文件选择器的环境（例如安卓 WebView）。

## 1. 当前状态

- 版本号：manifest.json = 1.87ds、plugin.js PLUGIN_VERSION = 1.87ds。
- 测试：tests/verify_v0187ds.cjs 552/552（RESULTS_v0187ds.txt）。

## 2. 本轮改动

1. 诊断页学习历史导入区新增：输入框 importurl（默认 location.origin+base+'/history-export'）、按钮 importurlbtn（IMPORT FROM URL）、状态行 importurlstatus。
2. 点击后 fetch 该地址拿 JSON，依次 POST history-import 与 calibration-import；历史成功、LUT 失败时分别提示，不会整体失败。
3. 文本输入框纳入与数字框相同的样式规则。

## 3. 使用

- 默认地址直接指向本机导出端点，无需先下载文件；适用于平板/WebView 无文件选择器的情况。
- 也可以把别处的导出 JSON 放到局域网可访问地址，填入后导入（同源策略会限制跨域，必要时走同一台 Decaid 的本地服务）。
- 文件按钮仍保留，桌面端可继续用。

## 4. 坑

- 中文标签不能直接写 URL（会触发“中文静态页无英文散文”断言，URL 未在白名单），改为“从链接导入”。
- 页面脚本仍在模板字符串里，改完用 new vm.Script 解析。
