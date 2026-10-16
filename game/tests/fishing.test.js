import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Fishing, FISH, rollFish } from '../src/fishing.js';
import { Inventory, craft } from '../src/inventory.js';
import { heatMaterial } from '../src/interactions.js';
import { BLOCK } from '../src/blocks.js';

const pond = () => {
  const water = (x, y, z) => x >= 0 && x < 10 && z >= -10 && z < 0 && y >= 4 && y <= 8;
  return {
    getBlock: (x, y, z) => water(x, y, z) ? BLOCK.WATER : y < 4 ? BLOCK.STONE : BLOCK.AIR,
    raycast: (o, d, max, includeWater) => includeWater ? { x: 4, y: 8, z: -4, id: BLOCK.WATER, distance: 5 } : null,
  };
};
const angler = () => ({ eye: new THREE.Vector3(4.5, 10, 2), direction: new THREE.Vector3(0, -.5, -1).normalize(), position: new THREE.Vector3(4.5, 9, 2) });

test('rod casts only on water, fish bite after waiting, and a timely pull catches one fish', () => {
  let r = .5; const fishing = new Fishing(new THREE.Scene(), pond(), () => r), inv = new Inventory('survival'), p = angler();
  assert.equal(fishing.use(p, inv).ok, true); assert.equal(fishing.active, true);
  assert.equal(fishing.reel(inv).ok, false, 'pulling before the bite fails'); assert.equal(fishing.active, false);
  fishing.use(p, inv); let event = null; for (let i = 0; i < 200 && event !== 'bite'; i++) event = fishing.update(.05, p);
  assert.equal(event, 'bite');
  const caught = fishing.use(p, inv); assert.equal(caught.ok, true); assert.ok(FISH[caught.caught]); assert.equal(inv.count(`raw_${caught.caught}`), 1);
  fishing.use(p, inv); for (let i = 0; i < 200 && fishing.state !== 'bite'; i++) fishing.update(.05, p);
  let escaped = false; for (let i = 0; i < 40; i++) if (fishing.update(.05, p) === 'escaped') escaped = true;
  assert.ok(escaped, 'missing the bite window lets the fish escape'); fishing.dispose();
  const dry = new Fishing(new THREE.Scene(), { ...pond(), raycast: () => ({ id: BLOCK.STONE }) });
  assert.equal(dry.use(p, inv).ok, false);
});

test('fish are cooked at the grill, the giant pirarucu feeds more, and rarity is weighted', () => {
  const inv = new Inventory('survival', { counts: { raw_pirarucu: 1, raw_lambari: 1, 18: 2 } });
  assert.ok(heatMaterial('fish_pirarucu', inv, { water: 0 }).ok); assert.equal(inv.count('cooked_fish'), 3);
  assert.ok(heatMaterial('fish_lambari', inv, { water: 0 }).ok); assert.equal(inv.count('cooked_fish'), 4);
  const counts = {}; let seed = 1; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 4000; i++) { const id = rollFish(rnd); counts[id] = (counts[id] || 0) + 1; }
  assert.ok(counts.lambari > counts.dourado && counts.dourado > counts.pirarucu && counts.pirarucu > 0);
  const rod = new Inventory('survival'); rod.add(5, 2); rod.add('resin'); assert.ok(craft('fishing_rod', rod).ok);
});

test('schools of fish swim only where there is water', () => {
  const fishing = new Fishing(new THREE.Scene(), pond(), Math.random), center = new THREE.Vector3(4.5, 8, -4.5);
  for (let i = 0; i < 40; i++) fishing.updateSchools(2.6, center);
  assert.ok(fishing.fish.length > 0 && fishing.fish.length <= 8);
  for (const f of fishing.fish) assert.equal(pond().getBlock(Math.floor(f.mesh.position.x), Math.floor(f.mesh.position.y), Math.floor(f.mesh.position.z)), BLOCK.WATER);
  fishing.dispose();
});
