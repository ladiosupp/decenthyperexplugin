process.env.SIM_PORT = '4781';
require('./server');
const http = require('http');

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request({ host: '127.0.0.1', port: 4781, path, method, headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {} }, (res) => {
      let b = '';
      res.on('data', (d) => { b += d; });
      res.on('end', () => resolve({ status: res.statusCode, body: b }));
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

(async () => {
  await new Promise((r) => setTimeout(r, 250));
  const index = await req('GET', '/');
  const app = await req('GET', '/app.js');
  const replays = await req('GET', '/api/replays');
  const run = await req('POST', '/api/run', { plant: { efficiency: 0.9 } });
  const replayRun = await req('POST', '/api/run', { replay: { index: 1 } });
  const parsed = JSON.parse(run.body);
  const replayParsed = JSON.parse(replayRun.body);
  const history = await req('GET', '/api/history?file=' + encodeURIComponent('C:/Users/ladios/Downloads/hyperex-history.json'));
  let historyRun = null;
  if (history.status === 200) {
    const h = JSON.parse(history.body);
    if (h.cups && h.cups.length) {
      const hr = await req('POST', '/api/run', { replay: { file: 'C:/Users/ladios/Downloads/hyperex-history.json', index: h.cups[0].index } });
      historyRun = JSON.parse(hr.body);
    }
  }
  console.log('index', index.status, index.body.length);
  console.log('app', app.status, app.body.length);
  console.log('replays', replays.status, replays.body.slice(0, 90));
  console.log('run', run.status, 'writes', parsed.writes.length, 's2', parsed.summary.stage2.rawRegressionGS, 'ended', parsed.ended.seconds + 's');
  console.log('replayRun', replayRun.status, 'replay', JSON.stringify(replayParsed.replay && replayParsed.replay.title), 'ended', replayParsed.ended.seconds + 's', replayParsed.ended.phase);
  console.log('history', history.status, history.status === 200 ? JSON.parse(history.body).cups.length + ' cups' : history.body.slice(0, 60));
  console.log('historyRun', historyRun ? historyRun.status + ' replay=' + JSON.stringify(historyRun.replay && historyRun.replay.title) + ' ended ' + historyRun.ended.seconds + 's/' + historyRun.ended.phase + ' writes=' + historyRun.writes.length : 'skip');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });

