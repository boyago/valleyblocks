import test from 'node:test';
import assert from 'node:assert/strict';
import { createRooms, MAX_PLAYERS } from '../lib/server/multiplayer.mjs';

function peer(id, { unlimited = false, accountId = id } = {}) {
  const inbox = [];
  return { id, account: { id: accountId, username: 'u_' + id, unlimited }, inbox, send: text => inbox.push(JSON.parse(text)), last: t => [...inbox].reverse().find(m => m.t === t) };
}
const msg = (h, m) => h.message(JSON.stringify(m));

test('rooms: only full-version accounts host; snapshot goes only to the joining guest; state and blocks are relayed and validated', () => {
  const rooms = createRooms();
  const free = peer('free'), hostP = peer('host', { unlimited: true }), g1 = peer('g1'), g2 = peer('g2');
  const hFree = rooms.connect(free), h = rooms.connect(hostP), a = rooms.connect(g1), b = rooms.connect(g2);
  msg(hFree, { t: 'host' }); assert.equal(free.last('error').code, 'needs-full');
  msg(h, { t: 'host' }); const code = hostP.last('room').code; assert.match(code, /^[A-Z2-9]{6}$/);
  msg(a, { t: 'join', code: 'ZZZZZZ' }); assert.equal(g1.last('error').code, 'no-room');
  msg(a, { t: 'join', code: code.toLowerCase() });
  assert.equal(hostP.last('want-snapshot').to, 'g1');
  // a guest cannot fake the snapshot; host's snapshot reaches only g1
  msg(b, { t: 'join', code });
  msg(a, { t: 'snapshot', to: 'g2', data: { evil: true } }); assert.equal(g2.last('world'), undefined);
  msg(h, { t: 'snapshot', to: 'g1', data: { seed: 's', edits: [] } });
  assert.equal(g1.last('world').data.seed, 's'); assert.equal(g2.last('world'), undefined, 'g2 still pending');
  msg(h, { t: 'snapshot', to: 'g1', data: { seed: 'again' } }); assert.equal(g1.inbox.filter(m => m.t === 'world').length, 1, 'snapshot only once');
  msg(h, { t: 'snapshot', to: 'g2', data: { seed: 's' } });
  // state relay with rounding; invalid state dropped
  msg(a, { t: 'state', p: [1.23456, 9, -3], yaw: 1, pitch: 0 });
  assert.deepEqual(hostP.last('state').p, [1.23, 9, -3]); assert.equal(g1.last('state'), undefined, 'not echoed to sender');
  const before = hostP.inbox.length; msg(a, { t: 'state', p: [1e9, 0, 0], yaw: 1, pitch: 0 }); msg(a, { t: 'state', p: 'x' }); assert.equal(hostP.inbox.length, before);
  // blocks
  msg(a, { t: 'block', x: 3, y: 10, z: -4, id: 0 }); assert.deepEqual({ ...hostP.last('block') }, { t: 'block', from: 'g1', x: 3, y: 10, z: -4, id: 0, f: 0 });
  const n = g2.inbox.length; msg(a, { t: 'block', x: 3, y: 99, z: 0, id: 1 }); msg(a, { t: 'block', x: 1.5, y: 9, z: 0, id: 1 }); assert.equal(g2.inbox.length, n, 'invalid blocks dropped');
  // chat sanitised
  msg(a, { t: 'chat', text: 'oi\u0007 pessoal' + 'x'.repeat(300) }); assert.equal(hostP.last('chat').text.length, 120); assert.ok(!hostP.last('chat').text.includes('\u0007'));
  // capacity and duplicate account
  const g3 = peer('g3'), g4 = peer('g4'), dup = peer('dup', { accountId: 'g1' });
  msg(rooms.connect(dup), { t: 'join', code }); assert.equal(dup.last('error').code, 'already');
  msg(rooms.connect(g3), { t: 'join', code }); msg(rooms.connect(g4), { t: 'join', code }); assert.equal(g4.last('error').code, 'full');
  assert.equal(MAX_PLAYERS, 4);
  // guest leaves -> others notified; host leaves -> room closed for everyone
  b.close(); assert.equal(hostP.last('left').id, 'g2');
  h.close(); assert.equal(g1.last('closed').t, 'closed'); assert.equal(rooms.stats().rooms, 0);
});

test('rooms: oversized messages and floods are refused', () => {
  const rooms = createRooms(), hostP = peer('h', { unlimited: true }), g = peer('g');
  const h = rooms.connect(hostP), a = rooms.connect(g);
  msg(h, { t: 'host' }); const code = hostP.last('room').code; msg(a, { t: 'join', code });
  msg(a, { t: 'chat', text: 'x'.repeat(5000) }); assert.equal(g.last('error').code, 'too-big');
  for (let i = 0; i < 60; i++) msg(a, { t: 'chat', text: 'spam' });
  assert.ok(hostP.inbox.filter(m => m.t === 'chat').length <= 40);
  assert.equal(g.last('error').code, 'rate');
  a.message('not json'); a.message('{"t":5}');
});
