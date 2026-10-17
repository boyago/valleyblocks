import test from 'node:test';
import assert from 'node:assert/strict';
import { Inventory } from '../src/inventory.js';
import { STALLS, EMERALD, stallFor, trade, remaining, restock, RESTOCK_SECONDS } from '../src/trading.js';

const offer = id => STALLS.flatMap(s => s.offers).find(o => o.id === id);

test('selling goods earns emeralds and buying spends them', () => {
  const inv = new Inventory('survival'), ledger = {};
  inv.add('iron_ingot', 8);
  assert.equal(trade(inv, ledger, 'a', offer('sell-iron')).ok, true);
  assert.equal(inv.count(EMERALD), 1);
  assert.equal(inv.count('iron_ingot'), 4);
  inv.add(EMERALD, 5);
  assert.equal(trade(inv, ledger, 'a', offer('buy-iron-pickaxe')).ok, true);
  assert.equal(inv.count('iron_pickaxe'), 1);
  assert.equal(inv.count(EMERALD), 0);
});

test('a failed trade changes nothing and reports what is missing', () => {
  const inv = new Inventory('survival'), ledger = {};
  inv.add(EMERALD, 2);
  const r = trade(inv, ledger, 'a', offer('buy-iron-pickaxe'));
  assert.equal(r.ok, false);
  assert.match(r.message, /Falta: 4 Esmeralda/);
  assert.equal(inv.count(EMERALD), 2);
  assert.deepEqual(ledger, {});
});

test('stock runs out per vendor and restocks over time', () => {
  const inv = new Inventory('survival'), ledger = {}, o = offer('buy-portal-spray');
  inv.add(EMERALD, 20);
  assert.equal(trade(inv, ledger, 'v1', o).ok, true);
  assert.equal(remaining(ledger, 'v1', o), 0);
  assert.equal(trade(inv, ledger, 'v1', o).ok, false);
  assert.equal(remaining(ledger, 'v2', o), 1, 'another vendor keeps its own stock');
  restock(ledger, RESTOCK_SECONDS);
  assert.equal(remaining(ledger, 'v1', o), 1);
});

test('every offer names real items and each stall is reachable', () => {
  const inv = new Inventory('survival');
  for (const s of STALLS) for (const o of s.offers) for (const side of [o.give, o.get]) for (const id of Object.keys(side)) assert.equal(inv.add(/^\d+$/.test(id) ? Number(id) : id, 1), true, `${s.id}/${o.id}: ${id}`);
  assert.deepEqual(new Set([0, 1, 2, -5, 7].map(n => stallFor(n).id)).size, 3);
});
