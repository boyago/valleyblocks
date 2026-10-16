import test from 'node:test';
import assert from 'node:assert/strict';
import { Inventory, ITEMS, RECIPES, craft, transferItems, STACK_LIMIT } from '../src/inventory.js';
import { validateSnapshot, saveGame, loadGame, deleteSave, hasSave } from '../src/save.js';
import { GameAudio } from '../src/audio.js';

test('a restored inventory does not issue another starter kit', () => {
  const initial = new Inventory('survival');
  assert.equal(initial.count('food'), 0);
  initial.add('food',32);
  assert.ok(initial.remove('food', 32));
  initial.hotbar[0] = 14;
  initial.select(5);
  const restored = new Inventory('survival', initial.serialize());
  assert.equal(restored.count('food'), 0);
  assert.deepEqual(restored.serialize(), initial.serialize());
  assert.notEqual(restored.counts, initial.counts);
  assert.notEqual(restored.hotbar, initial.hotbar);
});

test('creative blocks are unlimited but vehicle parts and food are counted', () => {
  const inventory = new Inventory();
  assert.equal(inventory.count(1), 0);
  inventory.add(1);
  assert.equal(inventory.count(1), Infinity);
  assert.ok(inventory.remove(1, 999));
  assert.equal(inventory.count(1), Infinity);
  assert.equal(inventory.count('food'), 0);
  inventory.add('food',32);
  assert.ok(inventory.remove('food', 10));
  assert.equal(inventory.count('food'), 22);
  assert.ok(Number.isFinite(inventory.count('car')));
  assert.doesNotThrow(() => validateSnapshot({ seed: 'creative', inventory: inventory.serialize() }));
});

test('stack splitting conserves every collected resource and each stack has at most 64', () => {
  const inventory = new Inventory('survival', { counts: { 3: 193 } });
  assert.deepEqual(inventory.getStacks(), [64, 64, 64, 1].map(count => ({ id: 3, count })));
  assert.equal(inventory.getStacks().reduce((sum, stack) => sum + stack.count, 0), 193);
  assert.ok(inventory.getStacks().every(stack => stack.count <= STACK_LIMIT));
});

test('invalid item counts cannot create items or underflow quantities', () => {
  const inventory = new Inventory('survival');
  const before = inventory.serialize();
  for (const value of [0, -1, 1.5, Infinity, NaN, '3']) {
    assert.equal(inventory.add(3, value), false);
    assert.equal(inventory.remove(3, value), false);
  }
  assert.equal(inventory.add('unknown', 5), false);
  assert.equal(inventory.remove(3, 999), false);
  assert.deepEqual(inventory.serialize(), before);
  inventory.select(-1);
  assert.equal(inventory.selected, 8);
  inventory.select(9);
  assert.equal(inventory.selected, 0);
});

test('crafting requires the station and all inputs before changing resources', () => {
  const inventory = new Inventory('survival', { counts: { 3: 8, 10: 2 } });
  const before = inventory.serialize();
  assert.equal(craft('wheel', inventory, false).ok, false);
  assert.deepEqual(inventory.serialize(), before);
  assert.equal(craft('engine', inventory, true).ok, false);
  assert.deepEqual(inventory.serialize(), before);
  assert.equal(craft('wheel', inventory, true).ok, true);
  assert.equal(inventory.count('wheel'), 2);
  assert.equal(inventory.count(3), 4);
  assert.equal(inventory.count(10), 1);
});

test('complete car recipe consumes exactly one set of components', () => {
  const inventory = new Inventory('survival', { counts: { wheel: 4, frame: 1, engine: 1, 7: 2 } });
  assert.equal(craft('car', inventory, true).ok, true);
  assert.deepEqual(inventory.counts, { car: 1 });
  assert.equal(craft('car', inventory, true).ok, false);
  assert.equal(inventory.count('car'), 1);
});

test('pet treats can be replenished from obtainable leaves', () => {
  const inventory = new Inventory('survival', { counts: { 6: 3 } });
  assert.ok(craft('food', inventory).ok);
  assert.equal(inventory.count('food'), 4);
  assert.equal(inventory.count(6), 0);
});

test('all recipes reference existing items with positive quantities', () => {
  assert.equal(new Set(RECIPES.map(recipe => recipe.id)).size, RECIPES.length);
  for (const recipe of RECIPES) {
    assert.ok(ITEMS[recipe.output.id]);
    assert.ok(Number.isInteger(recipe.output.count) && recipe.output.count > 0);
    for (const [id, amount] of Object.entries(recipe.ingredients)) {
      assert.ok(ITEMS[id]);
      assert.ok(Number.isInteger(amount) && amount > 0);
    }
  }
});

test('chest and trunk transactions conserve items after repeated transfers', () => {
  const inventory = new Inventory('survival', { counts: { 3: 130 } });
  const chest = {};
  const trunk = {};
  for (let i = 0; i < 300; i++) {
    assert.ok(transferItems(inventory, chest, 3, 65).ok);
    assert.ok(transferItems(chest, trunk, 3, 65).ok);
    assert.ok(transferItems(trunk, inventory, 3, 65).ok);
  }
  assert.equal(inventory.count(3), 130);
  assert.deepEqual(chest, {});
  assert.deepEqual(trunk, {});
  const before = inventory.serialize();
  assert.equal(transferItems(inventory, chest, 3, 131).ok, false);
  assert.deepEqual(inventory.serialize(), before);
  assert.deepEqual(chest, {});
});

test('a failed transfer never consumes or duplicates the source', () => {
  const inventory = new Inventory('survival', { counts: { 3: 10 } });
  for (const target of [inventory, inventory.counts, Object.freeze({}), Object.seal({}), { 3: Number.MAX_SAFE_INTEGER }]) {
    assert.equal(transferItems(inventory, target, 3, 2).ok, false);
    assert.equal(inventory.count(3), 10);
  }
  assert.equal(transferItems({ 3: Infinity }, inventory, 3, 2).ok, false);
  assert.equal(inventory.count(3), 10);
});

test('save validation creates a detached complete snapshot and rejects invalid numbers', () => {
  const input = {
    seed: 'uma-aventura', mode: 'survival', edits: { '16,5,0': 8, '15,5,0': 0 },
    player: { position: [3, 12, 8], life: 90 }, inventory: new Inventory('survival').serialize(),
    chests: { '2,9,1': { 3: 65 } }, time: 0.75,
    vehicles: [{ id: 'compact-1', position: [8, 10, 4], trunk: { 5: 6 }, petId: 'dog-1' }],
    pets: [{ id: 'dog-1', name: 'Pipoca', owner: true, state: 'riding', vehicleId: 'compact-1' }],
    settings: { music: 0.3, effects: 0.7, quality: 'medium' },
  };
  const copy = validateSnapshot(input);
  assert.equal(copy.version, 1);
  assert.deepEqual(copy.vehicles, input.vehicles);
  assert.deepEqual(copy.pets, input.pets);
  copy.chests['2,9,1'][3] = 1;
  assert.equal(input.chests['2,9,1'][3], 65);
  assert.throws(() => validateSnapshot({ seed: 'x', player: { position: [NaN, 3, 4] } }), /número inválido/);
  assert.throws(() => validateSnapshot({ seed: '', player: {} }), /seed/);
  assert.throws(() => validateSnapshot({ seed: 'x', version: 900 }), /versão/);
  const circular = { seed: 'x' }; circular.self = circular;
  assert.throws(() => validateSnapshot(circular), /circulares/);
});

test('save fallback restores, replaces and removes a whole snapshot without merging stale entities', async () => {
  const previous = globalThis.localStorage;
  const memory = new Map();
  globalThis.localStorage = {
    getItem: key => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value),
    removeItem: key => memory.delete(key),
  };
  try {
    assert.equal(await hasSave(), false);
    const first = { seed: '42', pets: [{ id: 'dog-1' }], vehicles: [{ id: 'car-1' }], edits: [[0, 0, 0, 0]] };
    const pending = saveGame(first);
    first.pets.push({ id: 'late-pet' });
    await pending;
    assert.equal((await loadGame()).pets.length, 1);
    await saveGame({ seed: '42', pets: [], vehicles: [], edits: [] });
    const restored = await loadGame();
    assert.deepEqual(restored.pets, []);
    assert.deepEqual(restored.vehicles, []);
    assert.deepEqual(restored.edits, []);
    assert.equal(await hasSave(), true);
    await deleteSave();
    assert.equal(await loadGame(), null);
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  }
});

test('audio stays inert until a user gesture creates an available audio context', async () => {
  const audio = new GameAudio({ music: 0.25, effects: 0.5 });
  assert.equal(audio.context, null);
  audio.play('bark');
  audio.engine(12, [0, 1, 2]);
  audio.update(1 / 60, { moving: true });
  audio.setVolumes(3, -2);
  assert.equal(audio.musicVolume, 1);
  assert.equal(audio.effectsVolume, 0);
  assert.equal(await audio.init(), false);
  audio.dispose();
});
