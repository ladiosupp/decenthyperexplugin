# v2.2.27 交接 — 2.2.26 诊断页热修（2026-11-02）

状态：**已改完、未提交**。基线 HEAD = `24162f1`（v2.2.26 发布记录），版本 2.2.27。

## 现象

真机装 2.2.26 后，STEP 1 与 STEP 2 都无法“准备完毕”，诊断页一直停在检查 / 请等待；2.2.25 正常。

## 根因

`renderRefillEditor` 里查灌水上限滑杆的选择器写坏了——多了一对引号：

```
box.querySelector('[data-refill-key=""floodMaxMlS""]')
```

这不是合法 CSS 选择器，真浏览器 `querySelector` 直接抛 `SyntaxError`。异常发生在 `loadCal()` 的 try 块里，后面的 STEP 1/2 徽标、补水面板、状态行全部没执行，页面就停在旧状态（“正在检查 / 请等待”）。

测试没抓到：UI 夹具的 `querySelector` 是 `q=>inputs[q]||(inputs[q]={})`，根本不解析选择器字符串，所以 713 条全绿。

## 修法

改成 `box.querySelector('[data-refill-key="floodMaxMlS"]')`，一处。控制律、补水参数、灌水上限逻辑都没动。

## 回归

新增 `2.2.27 every literal DOM selector in the page script is well formed`：把 `buildGhcOverlayHtml()` 里所有字面量 `querySelector('…')` / `querySelectorAll('…')` 扫一遍，选择器里出现 `""` 或 `''` 就红，并断言灌水上限那行是合法选择器。

## 测试

`tests/verify_v02227.cjs` = **714/714**（v02226 的 713 条全部保留 + 1 条扫描），`node --check` 通过。

## 没动

- 2.2.26 的灌水上限（固定 7 / 自适应）功能与 2.2.25 的版式都不变。
- 未 commit / tag / push。

## 待办

1. 用户点头后 commit + tag + Release + 夸克，并提醒 2.2.26 作废。
2. 真机复测 STEP 1 / STEP 2 能正常准备完毕。
