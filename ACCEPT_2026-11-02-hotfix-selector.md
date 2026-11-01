# 验收 · v2.2.27 — 2.2.26 诊断页选择器热修

日期：2026-11-02。基线 HEAD `24162f1`（v2.2.26）。目标版本 2.2.27。

## 1. 现象与根因

真机 2.2.26：STEP 1（流量校准）与 STEP 2（杯间学习）都无法准备完毕，页面停在“正在检查 / 请等待”；2.2.25 没有。

根因是 `renderRefillEditor` 里一个写坏的选择器：

```
box.querySelector('[data-refill-key=""floodMaxMlS""]')
```

选择器里多了一对引号。真浏览器把它当 CSS 选择器解析时抛 `SyntaxError`，异常发生在 `loadCal()` 的 try 块里，后续的 STEP 1/2 徽标与状态都不再更新，页面就停在进入时的旧状态。2.2.26 新加的灌水上限滑杆正是唯一一处这样的写法。

测试为什么没挡住：UI 夹具的 `querySelector` 是 `q=>inputs[q]||(inputs[q]={})`，只按字符串查表、不解析选择器，所以 713 条全绿。这是“mock 看不见、真机才炸”的典型盲区。

## 2. 修法

改成合法选择器 `[data-refill-key="floodMaxMlS"]`，一处，无其它改动。2.2.26 的固定 7 / 自适应逻辑原样保留。

## 3. 回归

新增测试 `2.2.27 every literal DOM selector in the page script is well formed`：

- 从 `buildGhcOverlayHtml()` 里提取所有字面量 `querySelector('…')` / `querySelectorAll('…')`；
- 选择器里出现 `""` 或 `''` 即失败；
- 断言灌水上限那行确实是 `[data-refill-key="floodMaxMlS"]`。

这类错误以后会被测试挡住，而不是等真机。

## 4. 测试

- `tests/verify_v02227.cjs`：**714/714**（v02226 的 713 条全部保留 + 1 条扫描）。
- `node --check plugin.js` 通过；v02226 及其 RESULTS 原样保留。

## 5. 发布建议

- 2.2.26 作废，直接发 2.2.27；发版说明里写明“修 2.2.26 诊断页 STEP 1/2 卡在等待”。
- 真机复测：打开诊断页，STEP 1 与 STEP 2 徽标应在几秒内刷新；点击“准备流量校准 / 准备”能正常进入下一步。

## 6. 未做

- 没有改控制律、补水参数、灌水上限行为或 2.2.25 的版式。
- 未 commit / tag / push（等用户点头）。
