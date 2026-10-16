import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Boats, Trailers } from '../src/watercraft.js';
import { BLOCK } from '../src/blocks.js';
import { Inventory, craft } from '../src/inventory.js';
import { heatMaterial } from '../src/interactions.js';

// Lago de 20×20 (água em y 5–8) com uma casa de teto de pedra sobre o canto x<4.
function lake() {
  const m = new Map(), k = (x, y, z) => `${x},${y},${z}`;
  for (let x = 0; x < 20; x++) for (let z = 0; z < 20; z++) for (let y = 5; y <= 8; y++) m.set(k(x, y, z), BLOCK.WATER);
  for (let x = 0; x < 4; x++) for (let z = 0; z < 4; z++) m.set(k(x, 13, z), BLOCK.STONE);
  return { getBlock: (x, y, z) => m.get(k(x, y, z)) ?? (y < 5 ? BLOCK.STONE : BLOCK.AIR), heightAt: () => 9 };
}

test('the boat goes only on open water, never under a roof or on land', () => {
  const boats = new Boats(new THREE.Scene(), lake());
  assert.equal(boats.place({ x: 10, y: 8, z: 10, id: BLOCK.STONE }, 0).ok, false);
  assert.match(boats.place({ x: 1, y: 8, z: 1, id: BLOCK.WATER }, 0).message, /fora/);
  const r = boats.place({ x: 10, y: 6, z: 10, id: BLOCK.WATER }, 0); assert.equal(r.ok, true);
  const boat = boats.boats[0]; assert.ok(Math.abs(boat.position.y - (8 + .92)) < 1e-9, 'floats on the surface');
  const restored = new Boats(new THREE.Scene(), lake(), structuredClone(boats.serialize())); assert.equal(restored.boats.length, 1);
  restored.dispose(); boats.dispose();
});

test('driving the boat moves it through water and stops it at the shore', () => {
  const boats = new Boats(new THREE.Scene(), lake()); boats.place({ x: 10, y: 8, z: 10, id: BLOCK.WATER }, 0);
  const boat = boats.boats[0], keys = new Set(['KeyW']), start = boat.position.z;
  for (let i = 0; i < 40; i++) boats.drive(boat, .05, keys);
  assert.ok(boat.position.z > start + 2, 'moves forward on water');
  for (let i = 0; i < 400; i++) boats.drive(boat, .05, keys);
  assert.ok(boat.position.z < 20, 'never leaves the water'); boats.dispose();
});

test('the trailer hitches to the nearest car, follows it and keeps its cargo', () => {
  const car = { id: 'vehicle-1', position: new THREE.Vector3(5, 9, 5), yaw: 0, halfLength: 1.5 };
  const trailers = new Trailers(new THREE.Scene(), lake(), { vehicles: [car] });
  assert.equal(trailers.place(new THREE.Vector3(50, 9, 50)).ok, false, 'needs a car nearby');
  assert.equal(trailers.place(new THREE.Vector3(6, 9, 6)).ok, true);
  assert.equal(trailers.place(new THREE.Vector3(6, 9, 6)).ok, false, 'one trailer per car');
  const t = trailers.trailers[0]; t.cargo[3] = 5;
  car.position.z += 10; for (let i = 0; i < 20; i++) trailers.update(.05);
  assert.ok(t.position.distanceTo(car.position) < 5 && t.position.z < car.position.z, 'follows behind the car');
  const restored = new Trailers(new THREE.Scene(), lake(), { vehicles: [{ ...car, id: 'vehicle-9' }] }, structuredClone(trailers.serialize()));
  restored.update(0); assert.equal(restored.trailers[0].carId, 'vehicle-9', 're-hitches after reload'); assert.equal(restored.trailers[0].cargo[3], 5);
});

test('aluminum comes from bauxite at the grill and builds the boat', () => {
  const inv = new Inventory('survival', { counts: { 57: 8, 18: 4, 12: 3, engine: 1 } });
  for (let i = 0; i < 4; i++) assert.ok(heatMaterial('aluminum', inv, { water: 0 }).ok);
  assert.equal(inv.count('aluminum_ingot'), 4);
  assert.ok(craft('boat', inv, true).ok); assert.equal(inv.count('boat'), 1);
  const t = new Inventory('survival', { counts: { frame: 1, wheel: 2, 12: 4 } }); assert.ok(craft('trailer', t, true).ok);
});
