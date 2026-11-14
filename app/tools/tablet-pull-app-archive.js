// 取回平板上 ProfileReplayer App 已合并的归档（WebView CDP，只读）。
// 用法：先 adb forward tcp:9223 localabstract:webview_devtools_remote_<pid>，
//       GET http://127.0.0.1:9223/json 拿 webSocketDebuggerUrl，然后：
//       node tablet-pull-app-archive.js <wsUrl> <outFile>
// 取回后用 hx-archive.mjs add <outFile> 并入 PC 归档。
const fs = require('fs');
const ws = new WebSocket(process.argv[2]);
let id = 0; const pend = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (method, params) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
ws.onopen = async () => {
  await send('Runtime.enable');
  const r = await send('Runtime.evaluate', { expression: 'dbGet("archive").then(a => a ? JSON.stringify(a) : "")', awaitPromise: true, returnByValue: true });
  const v = r.result && r.result.result && r.result.result.value;
  if (!v) { console.error('App 归档为空或读取失败'); process.exit(1); }
  fs.writeFileSync(process.argv[3], v);
  console.log('pulled', JSON.parse(v).count, 'shots ->', process.argv[3]);
  ws.close(); process.exit(0);
};
setTimeout(() => { console.error('TIMEOUT'); process.exit(2); }, 60000);
