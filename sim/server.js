const http = require('http');
const fs = require('fs');
const path = require('path');
const { runShot, plantDefaults } = require('./harness');

const PORT = Number(process.env.SIM_PORT || 4780);
const PUB = path.join(__dirname, 'public');

function send(res, status, body, type) {
  res.writeHead(status, {
    'Content-Type': type || 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function staticFile(res, name) {
  const file = path.join(PUB, name);
  if (!file.startsWith(PUB) || !fs.existsSync(file)) return send(res, 404, 'not found', 'text/plain');
  const ext = path.extname(file);
  const type = ext === '.html' ? 'text/html; charset=utf-8' : ext === '.js' ? 'text/javascript; charset=utf-8' : 'text/plain; charset=utf-8';
  send(res, 200, fs.readFileSync(file), type);
}

const server = http.createServer((req, res) => {
  console.log(new Date().toISOString(), req.method, req.url.slice(0, 120));
  if (req.method === 'POST' && req.url === '/api/run') {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 2e6) req.destroy(); });
    req.on('end', async () => {
      try {
        const params = body ? JSON.parse(body) : {};
        const result = await runShot(params);
        send(res, 200, JSON.stringify(result));
      } catch (e) {
        console.error(e);
        send(res, 500, JSON.stringify({ ok: false, error: String((e && e.message) || e) }));
      }
    });
    return;
  }
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) return staticFile(res, 'index.html');
  if (req.method === 'GET' && req.url === '/app.js') return staticFile(res, 'app.js');
  if (req.method === 'GET' && req.url === '/api/defaults') {
    return send(res, 200, JSON.stringify({ plant: plantDefaults() }));
  }
  send(res, 404, 'not found', 'text/plain');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('HyperEx sim: http://127.0.0.1:' + PORT + ' (listening on all interfaces)');
});

