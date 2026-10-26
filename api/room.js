// TABLE rooms: the server is the only source of truth. Every request re-checks session, phase and version.
const crypto = require('crypto');
const store = require('./_store');
const Games = require('../shared/games.js');

const TTL = 24 * 3600;
const ONLINE_MS = 12000;     // presence window used for display
const HOST_GRACE_MS = 30000; // host may come back within 30 s
const STRICT = new Set(['start', 'set_game', 'transfer_host', 'end_room', 'back_to_lobby', 'next', 'lock_teams', 'next_clue', 'end_early', 'restart']);

const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const rng = () => crypto.randomInt(0, 1e9) / 1e9;
const newCode = () => { const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 5; i++) s += A[crypto.randomInt(0, A.length)]; return s; };
const newId = () => 'p_' + crypto.randomBytes(5).toString('hex');
const clean = s => String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 20);
const BAD = /(fuck|shit|cunt|nigg|fag|retard)/i;

function send(res, status, body) { res.status(status).setHeader('Cache-Control', 'no-store'); res.json(body); }

function activePlayers(room) { return room.players.filter(p => !p.left); }
function isOnline(p, now) { return now - p.lastSeen < ONLINE_MS; }

function roomTick(room, now) {
  let changed = false;
  const host = room.players.find(p => p.id === room.hostId);
  if (host && now - host.lastSeen > HOST_GRACE_MS) {
    const online = activePlayers(room).filter(p => p.id !== room.hostId && isOnline(p, now)).sort((a, b) => a.joinedAt - b.joinedAt);
    const co = online.find(p => p.id === room.coHostId);
    const next = co || online[0];
    if (next) { room.notice = `${host.name} lost connection, so ${next.name} is now hosting${co ? ' (pre-chosen co-host)' : ' (earliest to join)'}.`; room.hostId = next.id; changed = true; }
  }
  if (room.game) {
    const ctx = { offlineSince: pid => { const p = room.players.find(x => x.id === pid); return p ? p.lastSeen : null; } };
    if (Games.tick(room.game, now, ctx)) changed = true;
    if (room.game.status !== 'playing' && room.state === 'in_game') { room.state = 'results'; changed = true; }
  }
  return changed;
}

function snapshot(room, me, now) {
  return {
    code: room.code, version: room.version, state: room.state, locked: room.locked, serverTime: now,
    hostId: room.hostId, coHostId: room.coHostId, gameId: room.gameId, settings: room.settings, notice: room.notice || null,
    me: me ? { id: me.id, name: me.name, isHost: me.id === room.hostId } : null,
    players: activePlayers(room).map(p => ({ id: p.id, name: p.name, seat: p.seat, ready: p.ready, online: isOnline(p, now), isHost: p.id === room.hostId })),
    game: room.game ? Games.view(room.game, me ? me.id : null) : null,
  };
}

async function load(code) { return store.getJSON('room:' + code); }
async function save(room) { room.version++; room.updatedAt = Date.now(); await store.setJSON('room:' + room.code, room, TTL); }

function auth(room, token) {
  if (!token) return null;
  const h = sha(token);
  return room.players.find(p => p.tokenHash === h && !p.left) || null;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  if (!store.configured()) return send(res, 503, { error: 'Room service is not configured yet. Shared-phone mode still works.', code: 'NO_STORE' });
  const b = req.body || {};
  const now = Date.now();
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0] || 'x';
  try {
    if (b.op === 'create') {
      if (!(await store.rateLimit('create:' + ip, 20, 600))) return send(res, 429, { error: 'Too many rooms created. Wait a few minutes.' });
      const name = clean(b.name) || 'Host';
      if (BAD.test(name)) return send(res, 400, { error: 'Please choose a different nickname.' });
      let code; for (let i = 0; i < 8; i++) { code = newCode(); if (!(await load(code))) break; }
      const token = crypto.randomBytes(24).toString('hex');
      const host = { id: newId(), name, seat: 0, ready: false, joinedAt: now, lastSeen: now, tokenHash: sha(token), left: false };
      const s = b.settings || {};
      const room = {
        code, version: 0, state: 'lobby', locked: false, createdAt: now, hostId: host.id, coHostId: null,
        gameId: Games.meta(s.gameId) ? s.gameId : 'frequency',
        settings: { scene: clean(s.scene), expected: Math.max(3, Math.min(10, Number(s.players) || 4)), device: 'each', minutes: Number(s.minutes) || 15, passAllowed: s.passAllowed !== false, noPersonal: s.noPersonal !== false },
        players: [host], game: null, seen: [],
      };
      await save(room);
      return send(res, 200, { token, playerId: host.id, room: snapshot(room, host, now) });
    }

    const code = String(b.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
    if (code.length !== 5) return send(res, 400, { error: 'Room codes have 5 characters.' });

    if (b.op === 'join') {
      if (!(await store.rateLimit('join:' + ip, 40, 300))) return send(res, 429, { error: 'Too many attempts. Wait a few minutes.' });
      return await store.withLock(code, async () => {
        const room = await load(code);
        if (!room) return send(res, 404, { error: 'No room with that code. Check the letters, or ask the host for a new code.', code: 'NOT_FOUND' });
        if (room.state === 'ended') return send(res, 410, { error: 'This table has ended.', code: 'ENDED' });
        const back = auth(room, b.token);
        if (back) { back.lastSeen = now; await save(room); return send(res, 200, { token: b.token, playerId: back.id, room: snapshot(room, back, now), resumed: true }); }
        if (room.locked) return send(res, 403, { error: 'The host has locked this room.', code: 'LOCKED' });
        if (!b.adult) return send(res, 400, { error: 'TABLE is for adults. Please confirm you are 18 or older.' });
        let name = clean(b.name); if (!name) return send(res, 400, { error: 'Add a nickname so the table knows who you are.' });
        if (BAD.test(name)) return send(res, 400, { error: 'Please choose a different nickname.' });
        const act = activePlayers(room);
        if (act.length >= 10) return send(res, 403, { error: 'This table is full (10 players).' });
        const base = name; let n = 2; while (act.some(p => p.name.toLowerCase() === name.toLowerCase())) name = `${base} ${n++}`;
        const token = crypto.randomBytes(24).toString('hex');
        const p = { id: newId(), name, seat: Math.max(...room.players.map(x => x.seat)) + 1, ready: false, joinedAt: now, lastSeen: now, tokenHash: sha(token), left: false };
        room.players.push(p); room.notice = null;
        await save(room);
        return send(res, 200, { token, playerId: p.id, room: snapshot(room, p, now), renamed: name !== base ? name : null });
      });
    }

    if (b.op === 'snapshot') {
      return await store.withLock(code, async () => {
        const room = await load(code);
        if (!room) return send(res, 404, { error: 'This room has expired or never existed.', code: 'NOT_FOUND' });
        const me = auth(room, b.token);
        if (!me) return send(res, 401, { error: 'Your seat in this room is no longer valid. Join again with the code.', code: 'NO_SEAT' });
        const wasSeen = me.lastSeen; me.lastSeen = now;
        const changed = roomTick(room, now);
        if (changed || now - wasSeen > 5000) await save(room); else await store.setJSON('room:' + code, room, TTL);
        return send(res, 200, { room: snapshot(room, me, now) });
      });
    }

    if (b.op === 'action') {
      return await store.withLock(code, async () => {
        const room = await load(code);
        if (!room) return send(res, 404, { error: 'This room has expired.', code: 'NOT_FOUND' });
        const me = auth(room, b.token);
        if (!me) return send(res, 401, { error: 'Your seat is no longer valid.', code: 'NO_SEAT' });
        me.lastSeen = now; roomTick(room, now);
        const a = b.action || {}; const aid = String(b.action_id || '');
        if (aid && room.seen.includes(aid)) return send(res, 200, { duplicate: true, room: snapshot(room, me, now) });
        if (STRICT.has(a.type) && b.expected_version != null && Number(b.expected_version) !== room.version)
          return send(res, 409, { error: 'The table changed while you were acting. Here is the latest state.', code: 'STALE', room: snapshot(room, me, now) });
        const isHost = me.id === room.hostId;
        const fail = (m, s = 400) => send(res, s, { error: m, room: snapshot(room, me, now) });
        const ok = async () => { if (aid) { room.seen.push(aid); room.seen = room.seen.slice(-300); } await save(room); return send(res, 200, { room: snapshot(room, me, now) }); };

        switch (a.type) {
          case 'ready': if (room.state !== 'lobby') return fail('Not in the lobby.'); me.ready = !!a.value; return ok();
          case 'set_game': if (!isHost) return fail('Only the host picks the game.', 403); if (room.state !== 'lobby') return fail('Finish the current game first.'); if (!Games.meta(a.gameId)) return fail('Unknown game.'); room.gameId = a.gameId; room.players.forEach(p => p.ready = false); return ok();
          case 'lock': if (!isHost) return fail('Only the host can lock the room.', 403); room.locked = !!a.value; return ok();
          case 'set_cohost': if (!isHost) return fail('Only the host can choose a co-host.', 403); room.coHostId = a.player || null; return ok();
          case 'transfer_host': {
            if (!isHost) return fail('Only the host can hand over hosting.', 403);
            const t = activePlayers(room).find(p => p.id === a.to); if (!t) return fail('That player is not at the table.');
            room.hostId = t.id; room.notice = `${me.name} handed hosting to ${t.name}.`; return ok();
          }
          case 'start': case 'restart': {
            if (!isHost) return fail('Only the host can start.', 403);
            if (a.type === 'start' && room.state !== 'lobby') return fail('A game is already running.');
            const players = activePlayers(room);
            if (a.type === 'start' && players.some(p => !p.ready)) return fail('Everyone needs to tap Ready first.');
            const r = Games.start(room.gameId, players.sort((x, y) => x.seat - y.seat).map(p => p.id), { mode: 'each' }, now, rng);
            if (r.error) return fail(r.error);
            room.game = r.game; room.state = 'in_game'; room.notice = null; return ok();
          }
          case 'back_to_lobby': if (!isHost) return fail('Only the host can do that.', 403); room.game = null; room.state = 'lobby'; room.players.forEach(p => p.ready = false); return ok();
          case 'end_room': if (!isHost) return fail('Only the host can end the table.', 403); room.state = 'ended'; room.game = null; return ok();
          case 'leave': {
            if (isHost && activePlayers(room).length > 1) return fail('Hand hosting to someone else before leaving.');
            me.left = true; me.ready = false; room.notice = `${me.name} left the table.`;
            if (activePlayers(room).length === 0) room.state = 'ended';
            if (aid) room.seen.push(aid); await save(room); return send(res, 200, { left: true });
          }
          default: {
            if (!room.game || room.state !== 'in_game') return fail('No game is running.');
            const action = Object.assign({}, a);
            if (room.game.game_id === 'frequency' && a.type === 'next') action.roster = activePlayers(room).sort((x, y) => x.seat - y.seat).map(p => p.id);
            const r = Games.act(room.game, me.id, action, now, { isHost: id => id === room.hostId });
            if (!r.ok) return fail(r.error);
            if (room.game.status !== 'playing') room.state = 'results';
            return ok();
          }
        }
      });
    }
    return send(res, 400, { error: 'Unknown operation' });
  } catch (e) {
    return send(res, 500, { error: e.message || 'Server error' });
  }
};
