import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unlink } from 'node:fs/promises';
import { openDatabase } from '../lib/server/usage-store.mjs';
import { PLAY_SCHEMA, createPlayStore } from '../lib/server/play-store.mjs';
import { createUsageLimiter, allowUsageRequest } from '../lib/server/usage-rate-limit.mjs';
import { ipGuestOwner } from '../lib/server/usage-http.mjs';
import { createRooms, stripControls } from '../lib/server/multiplayer.mjs';
import { createConnectionGate } from '../lib/server/multiplayer-ws.mjs';

const start = Date.parse('2026-10-11T15:00:00Z');
function peer(id, { unlimited = false, accountId = id } = {}) {
  const inbox = [];
  return { id, account: { id: accountId, username: 'u_' + id, unlimited }, inbox, send: text => inbox.push(JSON.parse(text)), last: t => [...inbox].reverse().find(m => m.t === t) };
}
const msg = (h, m) => h.message(JSON.stringify(m));

test('guest quota: dropping the cookie does not reset time charged to the IP owner; two devices on one IP are not "already-playing"', async () => {
  const path = join(tmpdir(), `labs-sec-${randomUUID()}.sqlite`), db = await openDatabase({ LABS_USAGE_SQLITE_PATH: path, NODE_ENV: 'test' });
  try {
    for (const sql of PLAY_SCHEMA) await db.query(sql); const store = createPlayStore(db);
    const ip = ipGuestOwner('203.0.113.9', 'x'.repeat(32)); assert.match(ip, /^ipguest:[0-9a-f]{64}$/); assert.ok(ip.length <= 80);
    assert.notEqual(ip, ipGuestOwner('203.0.113.10', 'x'.repeat(32)));
    const input = { game: 'vale-dos-blocos', session: randomUUID(), active: true };
    let data; for (let i = 0; i <= 60; i++) data = await store.record('guest:a', input, { ipOwner: ip }, start + i * 15000);
    assert.equal(data.allowed, false);
    // New cookie (fresh guest id), same IP: still denied.
    const fresh = { ...input, session: randomUUID() };
    data = await store.record('guest:b', fresh, { ipOwner: ip }, start + 916000); assert.equal(data.allowed, false); assert.equal(data.reason, 'daily-limit');
    // A different IP with a fresh cookie is independent; a second device on the same IP is not blocked as already-playing.
    const ip2 = ipGuestOwner('198.51.100.1', 'x'.repeat(32));
    assert.equal((await store.record('guest:c', fresh, { ipOwner: ip2 }, start)).allowed, true);
    const other = await store.record('guest:d', { ...input, session: randomUUID() }, { ipOwner: ip2 }, start + 1000);
    assert.equal(other.allowed, true); assert.notEqual(other.reason, 'already-playing');
    // Accounts ignore ipOwner entirely.
    data = await store.record('user:1', fresh, { account: true, ipOwner: ip }, start + 917000); assert.equal(data.allowed, true); assert.equal(data.remainingSeconds, 3600);
  } finally { await db.close(); await unlink(path); }
});

test('rate limiter: per-endpoint isolation, per-IP cap, authenticated budget immune to anonymous flood', () => {
  const allow = createUsageLimiter({ total: 100 });
  for (let n = 0; n < 100; n++) allow('anon-' + n, start, '10.0.0.' + (n % 50));
  assert.equal(allow('anon-x', start, '10.9.9.9'), false, 'anonymous global cap reached');
  assert.equal(allow('user:7', start), true, 'accounts are never blocked by the anonymous cap');
  for (let n = 1; n < 60; n++) allow('user:7', start); assert.equal(allow('user:7', start), false, 'per-account budget');
  const ipCap = createUsageLimiter({ perIp: 5 });
  for (let n = 0; n < 5; n++) assert.equal(ipCap('fresh-' + n, start, '1.2.3.4'), true);
  assert.equal(ipCap('fresh-6', start, '1.2.3.4'), false, 'cookieless rotation still limited by IP');
  assert.equal(ipCap('fresh-7', start, '1.2.3.5'), true);
  for (let n = 0; n < 2000; n++) allowUsageRequest('usage', 'v' + n, 'ip' + n, start);
  assert.equal(allowUsageRequest('usage', 'v-extra', 'ip-extra', start), false);
  assert.equal(allowUsageRequest('play', 'v-extra', 'ip-extra', start), true, 'play has its own limiter');
  assert.equal(allowUsageRequest('world', 'user:1', null, start), true);
  assert.equal(allowUsageRequest('checkout:guest:1.1.1.1'), true, 'legacy single-argument calls still work');
});

test('multiplayer: oversize frames from non-hosts are rejected before JSON.parse', () => {
  const rooms = createRooms(), h = peer('h', { unlimited: true }), g = peer('g');
  const hh = rooms.connect(h), gh = rooms.connect(g);
  const parse = JSON.parse; let parsed = 0; JSON.parse = (s, ...a) => { if (String(s).length > 4096) parsed++; return parse(s, ...a); };
  try {
    gh.message('{' + ' '.repeat(5000)); assert.equal(parsed, 0); assert.equal(g.last('error').code, 'too-big');
    msg(hh, { t: 'host' }); parsed = 0;
    hh.message('{"t":"snapshot"' + ' '.repeat(5000) + '}'); assert.equal(parsed, 0, 'host without pending guest cannot send large frames');
    msg(gh, { t: 'join', code: h.last('room').code }); parsed = 0;
    hh.message(JSON.stringify({ t: 'snapshot', to: 'g', data: 'x'.repeat(5000) })); assert.ok(parsed >= 1, 'host may send while a guest is pending'); assert.equal(g.last('world').data.length, 5000);
    gh.message(JSON.stringify({ t: 'chat', text: 'x'.repeat(5000) })); assert.equal(g.last('error').code, 'too-big');
  } finally { JSON.parse = parse; }
});

test('multiplayer: one hosted room per account, global room cap, join brute-force limit', () => {
  let t = start; const rooms = createRooms({ now: () => t, maxRooms: 2 });
  const a = peer('a', { unlimited: true }), a2 = peer('a2', { unlimited: true, accountId: 'a' });
  msg(rooms.connect(a), { t: 'host' }); msg(rooms.connect(a2), { t: 'host' }); assert.equal(a2.last('error').code, 'already-hosting');
  const b = peer('b', { unlimited: true }), c = peer('c', { unlimited: true });
  msg(rooms.connect(b), { t: 'host' }); msg(rooms.connect(c), { t: 'host' }); assert.equal(c.last('error').code, 'busy');
  const x = peer('x'), hx = rooms.connect(x);
  for (let i = 0; i < 10; i++) { msg(hx, { t: 'join', code: 'ZZZZZ' + i }); assert.equal(x.last('error').code, 'no-room'); }
  msg(hx, { t: 'join', code: a.last('room').code }); assert.equal(x.last('error').code, 'rate', 'even a valid code is refused while limited');
  t += 60001; msg(hx, { t: 'join', code: a.last('room').code }); assert.equal(a.last('want-snapshot').to, 'x');
});

test('websocket connection gate: per account, per IP and global caps; release frees slots', () => {
  const gate = createConnectionGate({ perAccount: 3, perIp: 10, max: 12 });
  const r = [1, 2, 3].map(() => gate.acquire('acc', '1.1.1.1')); assert.ok(r.every(Boolean));
  assert.equal(gate.acquire('acc', '2.2.2.2'), null, 'per account');
  for (let i = 0; i < 7; i++) assert.ok(gate.acquire('o' + i, '1.1.1.1'));
  assert.equal(gate.acquire('new', '1.1.1.1'), null, 'per IP');
  assert.ok(gate.acquire('p', '3.3.3.3')); assert.ok(gate.acquire('q', '4.4.4.4'));
  assert.equal(gate.acquire('z', '5.5.5.5'), null, 'global');
  r[0](); r[0](); assert.equal(gate.stats().total, 11, 'release is idempotent');
  assert.ok(gate.acquire('acc', '6.6.6.6'));
});

test('bidi controls are stripped from chat and names', () => {
  assert.equal(stripControls('a\u202eb\u2066c\u200fd\u200ee\u2069'), 'a b c d e ');
  const rooms = createRooms(), h = peer('h', { unlimited: true }), hh = rooms.connect(h);
  msg(hh, { t: 'host' }); msg(hh, { t: 'chat', text: 'oi \u202egnp.exe' });
  assert.ok(!/[\u202a-\u202e\u2066-\u2069\u200e\u200f]/.test(h.last('chat').text));
});
