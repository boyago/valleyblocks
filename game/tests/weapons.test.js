import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Slingshot } from '../src/hunting-tools.js';
import { Inventory, craft, ITEMS } from '../src/inventory.js';
import { WEAPON_DAMAGE, RANGED } from '../src/tools.js';
import { primaryAction } from '../src/mining.js';

test('swords are crafted in tiers and hit harder than bare hands', () => {
  const inv = new Inventory('survival'); inv.add(12, 5); inv.add('iron_ingot', 2); inv.add(25, 2);
  assert.ok(craft('wooden_sword', inv).ok);
  assert.equal(craft('iron_sword', inv, false).ok, false);
  assert.ok(craft('iron_sword', inv, true).ok); assert.ok(craft('diamond_sword', inv, true).ok);
  for (const id of ['wooden_sword', 'iron_sword', 'diamond_sword']) { assert.equal(inv.count(id), 1); assert.ok(ITEMS[id]); }
  assert.ok(WEAPON_DAMAGE.wooden_sword > 8 && WEAPON_DAMAGE.wooden_sword < WEAPON_DAMAGE.iron_sword && WEAPON_DAMAGE.iron_sword < WEAPON_DAMAGE.diamond_sword);
});

test('the bow fires arrows farther and harder than the slingshot and consumes one arrow per shot', () => {
  let damage = 0; const scene = new THREE.Scene(), world = { raycast: () => null };
  const wildlife = { raycast: () => ({ distance: .2, animal: {} }), strike: (_, d) => { damage = d; return true; } };
  const shot = new Slingshot(scene, world, wildlife), inv = new Inventory('survival');
  inv.add(5, 2); inv.add('resin', 2); inv.add(12); inv.add(3); inv.add(6);
  assert.ok(craft('bow', inv, true).ok); assert.ok(craft('arrows', inv, true).ok); assert.equal(inv.count('arrow'), 8);
  const p = { eye: new THREE.Vector3(0, 2, 0), direction: new THREE.Vector3(0, 0, -1) };
  assert.ok(shot.fire(p, inv, 'bow').ok); assert.equal(inv.count('arrow'), 7); shot.update(.05);
  assert.equal(damage, RANGED.bow.damage); assert.ok(RANGED.bow.damage > RANGED.slingshot.damage && RANGED.bow.speed > RANGED.slingshot.speed);
  shot.cooldown = 0; inv.remove('arrow', 7); assert.match(shot.fire(p, inv, 'bow').message, /flechas/);
  assert.equal(primaryAction('bow', null), 'shoot'); shot.dispose();
});
