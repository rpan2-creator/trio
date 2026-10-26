const store = require('./_store');
module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ ok: true, ai: Boolean(process.env.ANTHROPIC_API_KEY), rooms: store.configured(), version: '1.0.0', time: Date.now() });
};
