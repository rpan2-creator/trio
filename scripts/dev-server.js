// Local test server: static files + /api functions, with an in-memory stand-in for Upstash Redis
// (only used when no real UPSTASH/KV env vars are set). Production runs on Vercel instead.
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.PORT || 3000);
const kv = new Map(), exp = new Map();
if (!process.env.UPSTASH_REDIS_REST_URL && !process.env.KV_REST_API_URL && !process.env.NO_FAKE_KV) {
  process.env.UPSTASH_REDIS_REST_URL = `http://127.0.0.1:${PORT}/__kv`; process.env.UPSTASH_REDIS_REST_TOKEN = 'dev';
}
function kvRun([c, k, ...a]) {
  const now = Date.now(); for (const [key, t] of exp) if (t < now) { kv.delete(key); exp.delete(key); }
  c = c.toUpperCase();
  if (c === 'GET') return kv.has(k) ? kv.get(k) : null;
  if (c === 'DEL') { const h = kv.delete(k); exp.delete(k); return h ? 1 : 0; }
  if (c === 'INCR') { const v = Number(kv.get(k) || 0) + 1; kv.set(k, String(v)); return v; }
  if (c === 'EXPIRE') { exp.set(k, now + Number(a[0]) * 1000); return 1; }
  if (c === 'SET') { const v = a[0]; const nx = a.includes('NX'); if (nx && kv.has(k)) return null; kv.set(k, v);
    const px = a.indexOf('PX'), ex = a.indexOf('EX'); if (px > 0) exp.set(k, now + Number(a[px + 1])); else if (ex > 0) exp.set(k, now + Number(a[ex + 1]) * 1000); else exp.delete(k); return 'OK'; }
  if (c === 'LPUSH') { const l = JSON.parse(kv.get(k) || '[]'); l.unshift(...a); kv.set(k, JSON.stringify(l)); return l.length; }
  if (c === 'LTRIM') return 'OK';
  throw new Error('unsupported ' + c);
}
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.patt': 'text/plain', '.jpg': 'image/jpeg' };
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  let body = ''; req.on('data', d => body += d); req.on('end', async () => {
    if (u.pathname === '/__kv') { try { res.end(JSON.stringify({ result: kvRun(JSON.parse(body)) })); } catch (e) { res.end(JSON.stringify({ error: e.message })); } return; }
    if (u.pathname.startsWith('/api/')) {
      const f = path.join(ROOT, 'api', u.pathname.slice(5).replace(/\/$/, '') + '.js');
      if (!fs.existsSync(f)) { res.statusCode = 404; return res.end('{}'); }
      req.body = body ? (() => { try { return JSON.parse(body); } catch { return {}; } })() : {};
      res.status = c => { res.statusCode = c; return res; }; res.json = o => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(o)); };
      try { await require(f)(req, res); } catch (e) { res.statusCode = 500; res.end(JSON.stringify({ error: e.message })); }
      return;
    }
    let p = path.join(ROOT, decodeURIComponent(u.pathname));
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
    else if (!fs.existsSync(p) && fs.existsSync(p + '.html')) p += '.html';
    if (!p.startsWith(ROOT) || !fs.existsSync(p)) { res.statusCode = 404; return res.end('Not found'); }
    res.setHeader('content-type', TYPES[path.extname(p)] || 'application/octet-stream'); fs.createReadStream(p).pipe(res);
  });
}).listen(PORT, () => console.log('dev server on http://localhost:' + PORT));
