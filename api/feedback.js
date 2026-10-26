// TABLE / PIP / INK feedback: stored as a short list entry, no personal data required.
const crypto = require('crypto');
const store = require('./_store');
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const b = req.body || {};
  const cats = ['content', 'rules', 'technical', 'other'];
  const entry = {
    id: 'fb_' + crypto.randomBytes(5).toString('hex'), at: new Date().toISOString(),
    app: String(b.app || 'table').slice(0, 10), category: cats.includes(b.category) ? b.category : 'other',
    text: String(b.text || '').slice(0, 1000), version: String(b.version || '').slice(0, 20),
    room: b.room ? crypto.createHash('sha256').update(String(b.room)).digest('hex').slice(0, 10) : null,
  };
  if (!entry.text.trim()) return res.status(400).json({ error: 'Write a short description first.' });
  if (!store.configured()) return res.status(503).json({ error: 'Feedback storage is not configured on this deployment.', code: 'NO_STORE' });
  try { await store.cmd('LPUSH', 'feedback', JSON.stringify(entry)); await store.cmd('LTRIM', 'feedback', '0', '999'); return res.status(200).json({ receipt: entry.id }); }
  catch (e) { return res.status(500).json({ error: 'Could not save feedback.' }); }
};
