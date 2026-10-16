import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { VoxelWorld } from '../src/world.js';
import { BLOCK } from '../src/blocks.js';
import { Player } from '../src/player.js';
import { EntitySystem } from '../src/entities.js';
import { Inventory } from '../src/inventory.js';
import { useBucket } from '../src/interactions.js';

const options = { generatorVersion: 2, geology: { version: 1 } };

test('natural lava pools have a sealed floor, dry diamond rim and deterministic chunk seams', () => {
  for (const seed of ['aurora-2026', 'outro-vale']) {
    const w = new VoxelWorld(null, seed, [], null, options);
    const r = new VoxelWorld(null, seed, [], null, options);
    const pools = w.geology.poolsIn(-480, -480, 480, 480);
    assert.ok(pools.length > 5);
    assert.ok(pools.some(p => p.x < 0 && p.z < 0));
    for (const p of pools.slice(0, 4).concat(w.geology.candidate(0, 0))) {
      // Access opposite sides first to vary chunk generation order.
      r.getBlock(p.x + 7, p.y, p.z + 7);
      w.getBlock(p.x - 7, p.y, p.z - 7);
      for (let x = p.x - 7; x <= p.x + 7; x++) for (let z = p.z - 7; z <= p.z + 7; z++) {
        for (let y = p.y - 3; y <= p.y + 1; y++) assert.equal(w.getBlock(x, y, z), r.getBlock(x, y, z));
        if (w.getBlock(x, p.y - 1, z) === BLOCK.LAVA) {
          assert.equal(w.getBlock(x, p.y, z), BLOCK.AIR);
          assert.ok([BLOCK.STONE, BLOCK.DIAMOND].includes(w.getBlock(x, p.y - 3, z)));
          for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) assert.notEqual(w.getBlock(x + dx, p.y - 1, z + dz), BLOCK.AIR);
        }
      }
      assert.equal(w.getBlock(p.x + p.rx, p.y, p.z), BLOCK.DIAMOND);
      assert.equal(w.getBlock(p.x, p.y - 1, p.z), BLOCK.LAVA);
    }
    w.dispose(); r.dispose();
  }
});

test('migration protects edited sites and keeps exclusions and mined diamonds across reloads', () => {
  const edited = [{ x: 48, y: 35, z: 32, id: BLOCK.BRICK }];
  const old = new VoxelWorld(null, 'saved', edited, null, { generatorVersion: 2 });
  const migrated = new VoxelWorld(null, 'saved', edited, null, options);
  assert.ok(migrated.geology.excluded.has('0,0'));
  const p = migrated.geology.candidate(0, 0);
  assert.equal(migrated.getBlock(p.x, p.y - 1, p.z), old.getBlock(p.x, p.y - 1, p.z));
  assert.equal(migrated.getBlock(48, 35, 32), BLOCK.BRICK);
  const fresh = new VoxelWorld(null, 'saved', [], null, options);
  fresh.setBlock(p.x + p.rx, p.y, p.z, BLOCK.AIR);
  const reloaded = new VoxelWorld(null, 'saved', fresh.serialize(), null, { ...options, geology: fresh.geology.serialize() });
  assert.equal(reloaded.getBlock(p.x + p.rx, p.y, p.z), BLOCK.AIR);
  assert.equal(reloaded.getBlock(p.x, p.y - 1, p.z), BLOCK.LAVA);
  assert.equal(reloaded.geology.excluded.size, 0);
  for (const w of [old, migrated, fresh, reloaded]) w.dispose();
});

test('deep diamonds occur away from pools and keep their inventory identity on save', () => {
  const w = new VoxelWorld(null, 'aurora-2026', [], null, options);
  let diamonds = 0;
  for (let x = 80; x < 112; x++) for (let z = 80; z < 112; z++) for (let y = 2; y < 8; y++) if (w.getBlock(x, y, z) === BLOCK.DIAMOND) diamonds++;
  assert.ok(diamonds > 0);
  const i = new Inventory('survival'); i.add(BLOCK.DIAMOND, diamonds);
  assert.equal(new Inventory('survival', i.serialize()).count(BLOCK.DIAMOND), diamonds);
  w.dispose();
});

test('lava is non-solid, blocks mining rays, hurts survival, spares creative and repels pet paths', () => {
  const w = new VoxelWorld(null, 'lava-contact', [], null, options), p = w.geology.candidate(0, 0);
  const player = new Player(w);
  const floor = p.y - 2;
  player.position.set(p.x + .5, floor + .002, p.z + .5);
  player.velocity.set(0, 0, 0);
  const input = new Set();
  for (let i = 0; i < 30; i++) player.update(1 / 60, input, 'survival');
  assert.ok(player.health < 90 && player.inLava);
  const health = player.health;
  for (let i = 0; i < 30; i++) player.update(1 / 60, input, 'creative');
  assert.equal(player.health, health);
  assert.equal(w.collides({ x: p.x + .2, y: floor + .01, z: p.z + .2 }, { x: p.x + .8, y: floor + 1, z: p.z + .8 }), false);
  assert.equal(w.raycast({ x: p.x + .5, y: p.y + 2, z: p.z + .5 }, { x: 0, y: -1, z: 0 }).id, BLOCK.LAVA);
  const entities = new EntitySystem(new THREE.Scene(), w);
  assert.equal(entities.petStand(p.x + .5, p.z + .5, floor), null);
  assert.equal(entities.petStep(p.x + .5, p.z + .5, floor), null);
  const inventory = new Inventory('survival'); inventory.select(2);
  const before = inventory.serialize();
  assert.equal(useBucket(w, inventory, { x: p.x, y: p.y - 1, z: p.z, id: BLOCK.LAVA }, () => true, {}).ok, false);
  assert.deepEqual(inventory.serialize(), before);
  entities.dispose(); w.dispose();
});
