import test from 'node:test';
import assert from 'node:assert/strict';
import { Inventory, ITEMS, RECIPES, craft } from '../src/inventory.js';
import { ARMOR, ARMOR_SLOTS, protection } from '../src/armor.js';
import { DURABILITY } from '../src/tools.js';
import { EnemySystem } from '../src/enemies.js';

test('as 12 peças existem como itens e receitas de bancada, e o couro vem do javali', async () => {
  assert.equal(Object.keys(ARMOR).length, 12);
  for (const a of Object.values(ARMOR)) { assert.ok(ITEMS[a.id]); assert.ok(RECIPES.find(r => r.id === a.id)?.station); assert.ok(DURABILITY[a.id] > 0); }
  const { SPECIES } = await import('../src/wildlife.js').catch(() => ({ SPECIES: null }));
  if (SPECIES) assert.equal(SPECIES.boar.extra.item, 'leather');
  const inv = new Inventory('survival'); inv.add('leather', 8);
  assert.equal(craft('leather_chest', inv, true).ok, true); assert.equal(inv.count('leather'), 0); assert.equal(inv.count('leather_chest'), 1);
  assert.match(craft('iron_helmet', inv, true).message, /Falta/);
});

test('vestir e tirar: a peça sai da mochila, a anterior volta, e a proteção soma por material', () => {
  const inv = new Inventory('survival'); inv.add('leather_helmet'); inv.add('iron_helmet'); inv.add('diamond_chest');
  assert.equal(inv.protection, 0);
  assert.ok(inv.equip('leather_helmet')); assert.equal(inv.count('leather_helmet'), 0); assert.equal(inv.equipment.head, 'leather_helmet');
  assert.ok(inv.equip('iron_helmet')); assert.equal(inv.count('leather_helmet'), 1); assert.equal(inv.equipment.head, 'iron_helmet');
  assert.ok(inv.equip('diamond_chest'));
  assert.ok(Math.abs(inv.protection - (ARMOR.iron_helmet.protection + ARMOR.diamond_chest.protection)) < 1e-9);
  assert.equal(inv.equip('leather'), false); assert.equal(inv.equip('leather_boots'), false);
  assert.ok(inv.unequip('head')); assert.equal(inv.count('iron_helmet'), 1); assert.equal(inv.equipment.head, null);
  const full = { head: 'diamond_helmet', chest: 'diamond_chest', legs: 'diamond_legs', feet: 'diamond_boots' };
  assert.ok(protection(full) <= .8 && protection(full) > .6);
  const restored = new Inventory('survival', structuredClone(inv.serialize()));
  assert.equal(restored.equipment.chest, 'diamond_chest');
  assert.equal(new Inventory('survival', { counts: {}, equipment: { head: 'diamond_chest', chest: 'nada' } }).equipment.head, null);
});

test('inimigos causam menos dano com armadura, que se desgasta e quebra', () => {
  const inv = new Inventory('survival'); inv.add('leather_chest'); inv.equip('leather_chest');
  const system = Object.create(EnemySystem.prototype);
  let pending = 0;
  const player = { health: 100, armor: { get protection() { return inv.protection; }, hit(amount) { pending += amount / 8; const n = Math.floor(pending); pending -= n; if (n) inv.wearArmor(n); } } };
  system.hurt(player, 16, 'survival');
  assert.ok(Math.abs(player.health - (100 - 16 * (1 - ARMOR.leather_chest.protection))) < 1e-9);
  assert.equal(inv.wear.leather_chest, 2);
  system.hurt({ health: 100 }, 16, 'survival');
  const bare = { health: 100 }; system.hurt(bare, 16, 'survival'); assert.equal(bare.health, 84);
  const broken = inv.wearArmor(DURABILITY.leather_chest); assert.deepEqual(broken, ['Peitoral de couro']); assert.equal(inv.equipment.chest, null);
  const creative = new Inventory('creative'); creative.add('iron_boots'); creative.equip('iron_boots'); assert.deepEqual(creative.wearArmor(5000), []);
  for (const slot of ARMOR_SLOTS) assert.ok(slot in inv.equipment);
});
