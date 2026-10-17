import test from 'node:test';
import assert from 'node:assert/strict';
import { Inventory } from '../src/inventory.js';
import { EMERALD, RESIDENTS } from '../src/trading.js';
import { QUESTS, questFor, normalize, status, claim, deliver } from '../src/quests.js';
import { REALMS } from '../src/realms.js';

test('every resident lives in a real land and hands out one delivery mission', () => {
  for (const key of Object.keys(RESIDENTS)) { assert.ok(REALMS[key], key); assert.ok(questFor(key), key); }
});

test('delivering removes the items once and pays the reward', () => {
  const inv = new Inventory('survival'), state = normalize();
  inv.add('raw_calango', 2);
  const q = questFor('sertao');
  assert.equal(deliver(q, state, inv).ok, false);
  assert.equal(inv.count('raw_calango'), 2);
  inv.add('raw_calango', 2);
  assert.equal(deliver(q, state, inv).ok, true);
  assert.equal(inv.count('raw_calango'), 1);
  assert.equal(inv.count(EMERALD), 3);
  assert.equal(deliver(q, state, inv).ok, false);
});

test('visit and goal missions become ready and are claimed once', () => {
  const inv = new Inventory('survival'), state = normalize({ visited: { triplice: true } });
  const visit = QUESTS.find(q => q.id === 'chegar-triplice'), goal = QUESTS.find(q => q.id === 'primeira-troca');
  assert.equal(status(visit, state), 'ready');
  assert.equal(status(goal, state, {}), 'open');
  assert.equal(claim(goal, state, inv, {}).ok, false);
  assert.equal(claim(visit, state, inv, {}).ok, true);
  assert.equal(status(visit, state), 'done');
  assert.equal(claim(visit, state, inv, {}).ok, false);
});
