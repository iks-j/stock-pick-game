// 로컬 개발 서버 (Vercel의 api/ + public/ 구조를 그대로 흉내냄). 실행: node server.js
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.ico': 'image/x-icon' };

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      const name = url.pathname.slice(5).replace(/[^\w]/g, '');
      const file = path.join(__dirname, 'api', name + '.js');
      if (name.startsWith('_') || !fs.existsSync(file)) {
        res.writeHead(404).end('not found');
        return;
      }
      req.query = Object.fromEntries(url.searchParams);
      if (req.method === 'POST') {
        let raw = '';
        for await (const c of req) raw += c;
        try { req.body = JSON.parse(raw); } catch { req.body = {}; }
      }
      res.status = (c) => { res.statusCode = c; return res; };
      res.json = (o) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(o));
      };
      try {
        await require(file)(req, res);
      } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'server error' });
      }
      return;
    }
    let p = path.join(PUBLIC, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
    if (!p.startsWith(PUBLIC) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': (TYPES[path.extname(p)] || 'application/octet-stream') + '; charset=utf-8' });
    fs.createReadStream(p).pipe(res);
  })
  .listen(PORT, () => console.log(`http://localhost:${PORT}`));
