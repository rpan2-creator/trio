// Narrow, validated model calls for the three apps. The client never sees the API key.
const KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.AI_MODEL || 'claude-haiku-4-5';
const TIMEOUT = 20000;
const hits = new Map();

const PET_ANIMS = ['idle', 'react', 'eat', 'play', 'rest', 'blink'];
const PALETTES = ['cream', 'ginger', 'grey', 'black', 'white', 'brown', 'tricolor', 'golden'];
const MARKINGS = ['none', 'tabby', 'patches', 'socks', 'mask', 'tuxedo'];
const EARS = ['pointed', 'folded', 'floppy', 'round'];
const INK_KB = [
  { id: 'aad-sun', text: 'Sun exposure can fade tattoo ink over time; covering or using sunscreen on healed tattoos helps protect them.', src: 'American Academy of Dermatology, “Caring for tattooed skin”' },
  { id: 'aad-heal', text: 'A new tattoo is a healing wound; aftercare instructions from the artist matter while it heals.', src: 'American Academy of Dermatology, “Caring for tattooed skin”' },
  { id: 'gen-fine', text: 'Very fine lines and small, dense details are a common topic to discuss with an artist when choosing size and placement.', src: 'Team-reviewed consultation note (general, not a prediction)' },
  { id: 'gen-place', text: 'Placement on areas that bend, stretch or rub often is a common topic to discuss with an artist.', src: 'Team-reviewed consultation note (general, not a prediction)' },
  { id: 'gen-scale', text: 'Photo previews cannot give exact physical size without a measured reference; the artist confirms size with a stencil.', src: 'INK STUDY product rule' },
];

function send(res, s, b) { res.status(s).setHeader('Cache-Control', 'no-store'); res.json(b); }
function limited(ip) {
  const now = Date.now(), w = hits.get(ip) || []; const recent = w.filter(t => now - t < 60000); recent.push(now); hits.set(ip, recent); return recent.length > 20;
}
function str(x, n) { return String(x == null ? '' : x).replace(/[\u0000-\u0008\u000b-\u001f]/g, '').slice(0, n); }
function extractJSON(text) { const m = text.match(/\{[\s\S]*\}/); if (!m) throw new Error('Model did not return JSON'); return JSON.parse(m[0]); }

async function callModel(system, content, maxTokens) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: ctl.signal,
      headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: maxTokens || 600, system, messages: [{ role: 'user', content }] }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error((j.error && j.error.message) || 'Model error ' + r.status);
    return { text: (j.content || []).filter(c => c.type === 'text').map(c => c.text).join(''), model: j.model || MODEL };
  } finally { clearTimeout(t); }
}

const tasks = {
  async 'pet-respond'(b) {
    const pet = b.pet || {};
    const mems = (b.memories || []).slice(0, 5).map(m => ({ id: str(m.id, 40), text: str(m.text, 240) }));
    const turns = (b.turns || []).slice(-8).map(t => ({ role: t.role === 'pet' ? 'pet' : 'user', text: str(t.text, 500) }));
    const system = `You voice ${str(pet.name, 24)}, a pixel ${pet.species === 'dog' ? 'dog' : 'cat'} companion inside the app PIP.
Personality: ${str(pet.personality, 20)}. The user likes to be called: ${str(pet.addressAs, 24) || 'friend'}. Short bio from the user: ${str(pet.bio, 300) || '(none)'}.
${pet.mode === 'real' ? 'This character is a fictional companion inspired by the user\'s real pet. You do NOT know the real animal\'s current thoughts, health, or whereabouts, and never claim to.' : 'This is an original character.'}
Rules: warm, playful and brief; never possessive or guilt-tripping (never say things like "only I understand you" or "I will die if you leave"). Ask instead of assuming unknown facts. Do not diagnose emotions. If real-animal health comes up, say you can't diagnose and suggest checking with their caregiver or a vet.
Only state facts about the user that appear in AUTHORIZED MEMORIES, and list the ids you used in referenced_memory_ids. Reply in the same language the user writes in.
If the user clearly shared a new lasting fact worth remembering, propose it in memory_proposal (kind "you_told_me", one short sentence in third person, e.g. "Sam's sister walks Milo on Sundays."); otherwise null.
Return ONLY JSON: {"reply_text": string (max 80 English words or 160 Chinese characters), "animation_key": one of ${JSON.stringify(PET_ANIMS)}, "memory_proposal": null | {"kind":"you_told_me","text":string}, "referenced_memory_ids": string[]}`;
    const user = `AUTHORIZED MEMORIES: ${JSON.stringify(mems)}\nCURRENT EVENT: ${str(b.event, 80) || 'conversation'}\nRECENT TURNS: ${JSON.stringify(turns.slice(0, -1))}\nUSER NOW SAYS: ${turns.length ? turns[turns.length - 1].text : ''}`;
    const out = await callModel(system, user, 500);
    const j = extractJSON(out.text);
    let reply = str(j.reply_text, 700).trim(); if (!reply) throw new Error('Empty reply');
    const anim = PET_ANIMS.includes(j.animation_key) ? j.animation_key : 'react';
    const ids = Array.isArray(j.referenced_memory_ids) ? j.referenced_memory_ids.filter(id => mems.some(m => m.id === id)) : [];
    let prop = null; if (j.memory_proposal && j.memory_proposal.text) prop = { kind: 'you_told_me', text: str(j.memory_proposal.text, 200) };
    return { reply_text: reply, animation_key: anim, memory_proposal: prop, referenced_memory_ids: ids, model_version: out.model };
  },

  async 'pet-appearance'(b) {
    const img = String(b.image || ''); const m = img.match(/^data:(image\/(jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!m) throw new Error('Expected a cropped JPEG/PNG/WebP image');
    if (m[3].length > 1_400_000) throw new Error('Image too large; crop smaller');
    const system = `You map a pet photo onto a fixed set of pixel-art layers. Choose only from these whitelists.
species_template: ["cat","dog"]; palette: ${JSON.stringify(PALETTES)}; marking_preset: ${JSON.stringify(MARKINGS)}; ear: ${JSON.stringify(EARS)}.
Ignore people and backgrounds. Do not guess personality or health. Return ONLY JSON {"species_template","palette","marking_preset","ear","confidence": number 0-1}. If the photo is not clearly a cat or dog, set confidence below 0.4.`;
    const out = await callModel(system, [{ type: 'image', source: { type: 'base64', media_type: m[1], data: m[3] } }, { type: 'text', text: 'Map this pet to the layers.' }], 200);
    const j = extractJSON(out.text);
    const pick = (v, list, d) => list.includes(v) ? v : d;
    const conf = Math.max(0, Math.min(1, Number(j.confidence) || 0));
    return { species_template: pick(j.species_template, ['cat', 'dog'], 'cat'), palette: pick(j.palette, PALETTES, 'cream'), marking_preset: pick(j.marking_preset, MARKINGS, 'none'), ear: pick(j.ear, EARS, 'pointed'), confidence: conf, status: conf < 0.55 ? 'manual_review' : 'suggested', model_version: out.model };
  },

  async 'ink-questions'(b) {
    const system = `You help a person prepare questions for their tattoo artist. You are NOT an artist or doctor.
Use only the user's inputs and these reviewed notes (cite by id): ${JSON.stringify(INK_KB.map(k => ({ id: k.id, text: k.text })))}.
Write consultation QUESTIONS, never verdicts. Never predict personal fading rates or how their skin will look in N years, never judge medical suitability, never rate the design or the artist, never invent artist details.
Return ONLY JSON {"summary": string (<=40 words, restating what the user wants), "questions": [{"group":"placement"|"linework"|"over time"|"other","text":string}] (max 5), "limitations": [string] (1-3), "source_ids": string[]}`;
    const user = JSON.stringify({ design: str(b.design, 120), body_region: str(b.region, 60), relative_size: str(b.size, 60), intent: str(b.intent, 300), concerns: str(b.concerns, 300), scenario_selected: str(b.scenario, 120) });
    const out = await callModel(system, user, 700);
    const j = extractJSON(out.text);
    const groups = ['placement', 'linework', 'over time', 'other'];
    const qs = (Array.isArray(j.questions) ? j.questions : []).slice(0, 5).map(q => ({ group: groups.includes(q.group) ? q.group : 'other', text: str(q.text, 220) })).filter(q => q.text);
    if (!qs.length) throw new Error('No questions returned');
    const ids = (Array.isArray(j.source_ids) ? j.source_ids : []).filter(id => INK_KB.some(k => k.id === id));
    return { summary: str(j.summary, 300), questions: qs, limitations: (j.limitations || []).slice(0, 3).map(x => str(x, 200)), sources: INK_KB.filter(k => ids.includes(k.id)).map(k => ({ id: k.id, src: k.src })), model_version: out.model };
  },

  async 'table-recommend'(b) {
    const cands = (b.candidates || []).slice(0, 6).map(c => ({ game_id: str(c.game_id, 20), name: str(c.name, 40), players: str(c.players, 20), minutes: str(c.minutes, 20), noise: str(c.noise, 12), summary: str(c.summary, 160) }));
    if (!cands.length) throw new Error('No candidates');
    const system = `You explain which party games fit a group. Choose ONLY from the given candidate game_ids (they already pass every hard constraint). Never invent games. Return ONLY JSON {"picks":[{"game_id":string,"reason":string (<=22 words, concrete to this group)}] (max 3, best first), "note": string (<=20 words, one practical tip)}`;
    const user = JSON.stringify({ group: { players: Number(b.players) || 0, scene: str(b.scene, 20), minutes: Number(b.minutes) || 0, vibe: str(b.vibe, 12), mood: str(b.mood, 12), familiarity: str(b.familiar, 12), device: str(b.device, 10) }, candidates: cands });
    const out = await callModel(system, user, 400);
    const j = extractJSON(out.text);
    const seen = new Set();
    const picks = (j.picks || []).filter(p => cands.some(c => c.game_id === p.game_id) && !seen.has(p.game_id) && seen.add(p.game_id)).slice(0, 3).map(p => ({ game_id: p.game_id, reason: str(p.reason, 200) }));
    if (!picks.length) throw new Error('No valid picks');
    return { picks, note: str(j.note, 160), model_version: out.model };
  },
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  if (!KEY) return send(res, 503, { error: 'AI model is not configured on this deployment.', code: 'NO_MODEL' });
  const ip = (req.headers['x-forwarded-for'] || 'x').split(',')[0];
  if (limited(ip)) return send(res, 429, { error: 'Too many requests. Wait a minute.' });
  const b = req.body || {}; const fn = tasks[b.task];
  if (!fn) return send(res, 400, { error: 'Unknown task' });
  try { return send(res, 200, await fn(b)); }
  catch (e) { return send(res, e.name === 'AbortError' ? 504 : 502, { error: e.name === 'AbortError' ? 'The model took too long.' : String(e.message || e).slice(0, 200) }); }
};
