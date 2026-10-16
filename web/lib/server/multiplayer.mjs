import { randomInt } from 'node:crypto';

// Co-op rooms for Vale dos Blocos. In-memory (one Node process), host-authoritative:
// the host's game owns and saves the world; the server only authenticates, routes and
// validates messages. Nothing here touches the database except through `authenticate`.
export const MAX_PLAYERS = 4;
export const SNAPSHOT_MAX = 4 * 1024 * 1024;
const MESSAGE_MAX = 2048, RATE_PER_SEC = 40, CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
// Bidi/direction controls (U+202A–202E, U+2066–2069, U+200E/200F) allow spoofed chat text.
export const stripControls = v => String(v).replace(/[\u0000-\u001f\u007f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, ' ');
const int = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
const num = (v, lim) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= lim;

export function createRooms({ now = Date.now, maxRooms = 200, joinFailsPerMin = 10 } = {}) {
  const rooms = new Map(), joinFails = new Map();
  // Room-code brute force: failed joins per account per minute.
  const failed = id => { const t = now(), e = joinFails.get(id); if (!e || t - e.at >= 60000) { if (joinFails.size > 10000) joinFails.clear(); joinFails.set(id, { at: t, n: 1 }); } else e.n++; };
  const blocked = id => { const e = joinFails.get(id); return !!e && now() - e.at < 60000 && e.n >= joinFailsPerMin; };
  const newCode = () => { for (let i = 0; i < 50; i++) { let c = ''; for (let j = 0; j < 6; j++) c += CODE_CHARS[randomInt(CODE_CHARS.length)]; if (!rooms.has(c)) return c; } throw new Error('no code'); };
  const send = (peer, msg) => { try { peer.send(JSON.stringify(msg)); } catch { /* closed */ } };
  const others = (room, peer) => [...room.peers.values()].filter(p => p !== peer);
  const roster = room => [...room.peers.values()].map(p => ({ id: p.id, name: stripControls(p.account.username), host: p === room.host, outfit: p.outfit }));

  /** peer: { id, account:{id,username,unlimited}, send(text), close() } */
  function connect(peer) {
    peer.room = null; peer.window = now(); peer.count = 0; peer.outfit = 'explorer';
    const handler = {
      message(raw, isBinary = false) {
        const t = now(); if (t - peer.window >= 1000) { peer.window = t; peer.count = 0; }
        if (++peer.count > RATE_PER_SEC && !(peer.room?.host === peer && peer.count < RATE_PER_SEC * 4)) return send(peer, { t: 'error', code: 'rate' });
        if (isBinary) return;
        // Size check BEFORE parsing: only the current host, with a guest awaiting a snapshot, may send large frames.
        const size = typeof raw === 'string' ? Buffer.byteLength(raw) : raw.byteLength;
        if (size > MESSAGE_MAX && !(size <= SNAPSHOT_MAX && peer.room?.host === peer && peer.room.pending.size > 0)) return send(peer, { t: 'error', code: 'too-big' });
        let msg; try { msg = JSON.parse(typeof raw === 'string' ? raw : Buffer.from(raw).toString('utf8')); } catch { return; }
        if (!msg || typeof msg !== 'object' || typeof msg.t !== 'string') return;
        if (size > MESSAGE_MAX && msg.t !== 'snapshot') return send(peer, { t: 'error', code: 'too-big' });
        const room = peer.room;
        switch (msg.t) {
          case 'host': {
            if (room) return;
            if (!peer.account.unlimited) return send(peer, { t: 'error', code: 'needs-full' });
            if ([...rooms.values()].some(r => r.host.account.id === peer.account.id)) return send(peer, { t: 'error', code: 'already-hosting' });
            if (rooms.size >= maxRooms) return send(peer, { t: 'error', code: 'busy' });
            const code = newCode(), created = { code, host: peer, peers: new Map([[peer.id, peer]]), pending: new Set() };
            rooms.set(code, created); peer.room = created;
            return send(peer, { t: 'room', code, you: peer.id, players: roster(created) });
          }
          case 'join': {
            if (room) return;
            if (blocked(peer.account.id)) return send(peer, { t: 'error', code: 'rate' });
            const target = rooms.get(String(msg.code || '').toUpperCase().slice(0, 6));
            if (!target) { failed(peer.account.id); return send(peer, { t: 'error', code: 'no-room' }); }
            if (target.peers.size >= MAX_PLAYERS) return send(peer, { t: 'error', code: 'full' });
            if ([...target.peers.values()].some(p => p.account.id === peer.account.id)) return send(peer, { t: 'error', code: 'already' });
            target.peers.set(peer.id, peer); target.pending.add(peer.id); peer.room = target;
            send(target.host, { t: 'want-snapshot', to: peer.id });
            for (const p of others(target, peer)) send(p, { t: 'joined', id: peer.id, name: stripControls(peer.account.username), outfit: peer.outfit });
            return;
          }
          case 'snapshot': {
            if (!room || room.host !== peer || !room.pending.has(msg.to)) return;
            const guest = room.peers.get(msg.to); room.pending.delete(msg.to);
            if (guest) send(guest, { t: 'world', code: room.code, you: guest.id, players: roster(room), data: msg.data });
            return;
          }
          case 'state': {
            if (!room) return;
            const { p, yaw, pitch } = msg;
            if (!Array.isArray(p) || p.length !== 3 || !p.every(v => num(v, 1e5)) || !num(yaw, 100) || !num(pitch, 10)) return;
            const out = { t: 'state', id: peer.id, p: p.map(v => Math.round(v * 100) / 100), yaw: Math.round(yaw * 1000) / 1000, pitch: Math.round(pitch * 1000) / 1000, c: !!msg.c, v: num(msg.v, 100) ? Math.round(msg.v * 10) / 10 : 0 };
            for (const o of others(room, peer)) if (!room.pending.has(o.id)) send(o, out);
            return;
          }
          case 'block': {
            if (!room) return;
            const { x, y, z, id, f = 0 } = msg;
            if (!int(x, -1e6, 1e6) || !int(y, 1, 63) || !int(z, -1e6, 1e6) || !int(id, 0, 255) || !int(f, 0, 3)) return;
            for (const o of others(room, peer)) send(o, { t: 'block', from: peer.id, x, y, z, id, f });
            return;
          }
          case 'outfit': {
            if (typeof msg.id !== 'string' || !/^[a-z]{2,20}$/.test(msg.id)) return;
            peer.outfit = msg.id; if (room) for (const o of others(room, peer)) send(o, { t: 'outfit', id: peer.id, outfit: msg.id });
            return;
          }
          case 'chat': {
            if (!room || typeof msg.text !== 'string') return;
            const text = stripControls(msg.text).trim().slice(0, 120); if (!text) return;
            for (const o of room.peers.values()) send(o, { t: 'chat', id: peer.id, name: stripControls(peer.account.username), text });
            return;
          }
          case 'leave': return handler.close();
          default: return;
        }
      },
      close() {
        const room = peer.room; if (!room) return; peer.room = null;
        room.peers.delete(peer.id); room.pending.delete(peer.id);
        if (room.host === peer) { for (const o of room.peers.values()) { o.room = null; send(o, { t: 'closed' }); } rooms.delete(room.code); }
        else for (const o of room.peers.values()) send(o, { t: 'left', id: peer.id });
      },
    };
    return handler;
  }
  return { connect, stats: () => ({ rooms: rooms.size, players: [...rooms.values()].reduce((n, r) => n + r.peers.size, 0) }) };
}
