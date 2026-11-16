// Tiny static server for local testing of dist/
const http = require('http');
const fs = require('fs');
const path = require('path');
const dir = path.resolve(__dirname, '..', 'dist');
const port = Number(process.env.PORT) || 5178;
http.createServer((req, res) => {
  const p = path.join(dir, decodeURIComponent(req.url.split('?')[0]) === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(dir) || !fs.existsSync(p)) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': p.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(p).pipe(res);
}).listen(port, () => console.log('serving on http://localhost:' + port));
