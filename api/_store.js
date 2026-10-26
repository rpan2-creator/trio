// Minimal Upstash Redis REST client (works with Vercel's Upstash / KV integration env vars).
const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

const configured = () => Boolean(URL_ && TOKEN);

async function cmd(...args) {
  const r = await fetch(URL_, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const j = await r.json();
  if (j.error) throw new Error('store: ' + j.error);
  return j.result;
}

async function getJSON(key) { const v = await cmd('GET', key); return v ? JSON.parse(v) : null; }
async function setJSON(key, val, ttlSec) { return cmd('SET', key, JSON.stringify(val), 'EX', String(ttlSec)); }

async function withLock(key, fn) {
  const lock = 'lock:' + key, me = Math.random().toString(36).slice(2);
  for (let i = 0; i < 40; i++) {
    const ok = await cmd('SET', lock, me, 'NX', 'PX', '4000');
    if (ok === 'OK') {
      try { return await fn(); }
      finally { const cur = await cmd('GET', lock); if (cur === me) await cmd('DEL', lock); }
    }
    await new Promise(r => setTimeout(r, 60 + Math.random() * 80));
  }
  throw new Error('Room is busy, please retry.');
}

async function rateLimit(key, limit, windowSec) {
  const n = await cmd('INCR', 'rl:' + key);
  if (n === 1) await cmd('EXPIRE', 'rl:' + key, String(windowSec));
  return n <= limit;
}

module.exports = { configured, cmd, getJSON, setJSON, withLock, rateLimit };
