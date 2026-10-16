import test from 'node:test';
import assert from 'node:assert/strict';
import { Coop } from '../src/multiplayer.js';

function fakeGame() {
  const world = { blocks: new Map(), setBlock(x, y, z, id) { const k = `${x},${y},${z}`; if (this.blocks.get(k) === id) return false; this.blocks.set(k, id); return true; } };
  const game = {
    world, toasts: [], ui: { toast: m => game.toasts.push(m) }, audio: { play() {} }, started: true, saved: { mine: true },
    player: { position: { x: 1, y: 9, z: 2 }, yaw: .5, pitch: 0, crouching: false },
    mine() { this.world.setBlock(1, 9, 1, 0); }, place() { this.world.setBlock(2, 9, 1, 12); this.world.setBlock(2, 10, 1, 12); },
    toggleDoor() {}, interact() {}, snapshot() { return { seed: 's', edits: [], inventory: { secret: 1 }, player: { x: 9 } }; },
    startCoopGuest(data) { this.guestData = data; }, endCoopGuest() { this.ended = true; },
  };
  return game;
}
const sock = () => { const sent = []; return { readyState: 1, sent, send: t => sent.push(JSON.parse(t)), close() {} }; };

test('co-op: only player actions are broadcast; remote blocks are applied without echo; guest snapshot hides host inventory', () => {
  const g = fakeGame(), coop = new Coop(g); coop.bindWorld(g.world); coop.ws = sock(); coop.role = 'host';
  g.world.setBlock(5, 9, 5, 4); // simulation (water/sand) is never broadcast
  assert.equal(coop.ws.sent.length, 0);
  g.mine(); g.place();
  assert.deepEqual(coop.ws.sent.map(m => [m.t, m.x, m.y, m.id]), [['block', 1, 9, 0], ['block', 2, 9, 12], ['block', 2, 10, 12]]);
  coop.handle({ t: 'block', x: 7, y: 9, z: 7, id: 3, f: 0 });
  assert.equal(g.world.blocks.get('7,9,7'), 3); assert.equal(coop.ws.sent.length, 3, 'remote change not echoed');
  coop.handle({ t: 'want-snapshot', to: 'abc' });
  const snap = coop.ws.sent.at(-1); assert.equal(snap.t, 'snapshot'); assert.equal(snap.to, 'abc');
  assert.equal(snap.data.inventory, undefined); assert.equal(snap.data.player, undefined); assert.equal(snap.data.coopGuest, true);
});

test('co-op: guest flow, room close returns the guest to their own world, errors become messages', async () => {
  const g = fakeGame(), coop = new Coop(g); coop.bindWorld(g.world); coop.ws = sock();
  coop.pending = { resolve() {}, reject() {} };
  coop.handle({ t: 'world', code: 'ABC123', you: 'me', players: [{ id: 'me', name: 'eu' }], data: { seed: 's', edits: [] } });
  assert.equal(coop.guest, true); assert.equal(g.guestData.seed, 's'); assert.equal(coop.remotes.size, 0, 'self is never a remote');
  coop.handle({ t: 'closed' });
  assert.equal(coop.active, false); assert.equal(g.ended, true); assert.ok(g.toasts.some(t => /fechou/.test(t)));
  let error; coop.pending = { resolve() {}, reject: e => { error = e; } };
  coop.handle({ t: 'error', code: 'no-room' }); assert.match(error.message, /não encontrada/);
  await assert.rejects(coop.join('12'), /6 letras/);
});
