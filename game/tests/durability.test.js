import test from 'node:test';
import assert from 'node:assert/strict';
import { Inventory } from '../src/inventory.js';
import { DURABILITY } from '../src/tools.js';

test('tools wear with use, break at their limit and the next one in the stack starts new', () => {
  const inv = new Inventory('survival'); inv.add('wooden_pickaxe', 2);
  for (let i = 0; i < DURABILITY.wooden_pickaxe - 1; i++) assert.equal(inv.useTool('wooden_pickaxe').broke, false);
  assert.ok(inv.condition('wooden_pickaxe') < .05);
  const last = inv.useTool('wooden_pickaxe'); assert.equal(last.broke, true); assert.match(last.name, /Picareta/);
  assert.equal(inv.count('wooden_pickaxe'), 1); assert.equal(inv.condition('wooden_pickaxe'), 1);
});

test('better materials last longer, creative never wears, and wear survives saving', () => {
  assert.ok(DURABILITY.wooden_pickaxe < DURABILITY.pickaxe && DURABILITY.pickaxe < DURABILITY.iron_pickaxe && DURABILITY.iron_pickaxe < DURABILITY.diamond_pickaxe);
  const creative = new Inventory('creative'); creative.add('iron_sword');
  for (let i = 0; i < 500; i++) creative.useTool('iron_sword');
  assert.equal(creative.count('iron_sword'), 1); assert.equal(creative.condition('iron_sword'), 1);
  const inv = new Inventory('survival'); inv.add('iron_axe'); for (let i = 0; i < 40; i++) inv.useTool('iron_axe');
  const restored = new Inventory('survival', structuredClone(inv.serialize()));
  assert.equal(restored.wear.iron_axe, 40); assert.equal(new Inventory('survival', { counts: {}, wear: { iron_axe: 99999, nada: 3 } }).wear.iron_axe, undefined);
  assert.equal(inv.useTool('stone_block_nao_ferramenta').broke, false);
});
