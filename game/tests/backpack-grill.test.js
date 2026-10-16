import test from 'node:test';
import assert from 'node:assert/strict';
import {Inventory,craft} from '../src/inventory.js';
import {heatMaterial,HEAT_RECIPES} from '../src/interactions.js';
import {BLOCKS} from '../src/blocks.js';

test('both modes start completely empty and stay empty after reload',()=>{
  for(const mode of ['creative','survival']){
    const inv=new Inventory(mode);
    for(const b of BLOCKS)assert.equal(inv.count(b.id),0);
    assert.deepEqual(inv.counts,{});
    assert.deepEqual(inv.hotbar,Array(9).fill(null));
    assert.equal(inv.count('bucket'),0);
    assert.equal(inv.hotbar[2],null);
    assert.equal(inv.selectedItem,null);
    const restored=new Inventory(mode,inv.serialize());
    assert.deepEqual(restored.serialize(),inv.serialize());
  }
});

test('creative catalog acquisitions persist without restoring unchosen blocks',()=>{
  const inv=new Inventory('creative');inv.add(24);inv.hotbar[0]=24;
  const restored=new Inventory('creative',inv.serialize());
  assert.equal(restored.count(24),Infinity);
  assert.equal(restored.count(3),0);
  assert.deepEqual(restored.hotbar,inv.hotbar);
  assert.ok(restored.remove(24,500));assert.equal(restored.count(24),Infinity);
});

test('old creative collections and survival resources survive migration',()=>{
  const old={counts:{3:130,bucket:2},hotbar:[1,3,5,12,7,13,17,'pickaxe','food'],selected:4};
  const creative=new Inventory('creative',old);
  assert.equal(creative.count(7),Infinity);assert.equal(creative.count('bucket'),2);
  const survival=new Inventory('survival',old);
  assert.equal(survival.count(3),130);assert.equal(survival.count('bucket'),2);
  assert.deepEqual(survival.hotbar,old.hotbar);assert.equal(survival.selected,4);
});

test('collecting beyond 54 stacks loses no resources across reloads',()=>{
  const inv=new Inventory('survival',{version:2,counts:{},hotbar:Array(9).fill(null)});
  inv.add(3,64*60+17);
  const restored=new Inventory('survival',inv.serialize());
  assert.equal(restored.getStacks().length,61);
  assert.equal(restored.getStacks().reduce((n,s)=>n+s.count,0),64*60+17);
});

test('barbecue can be crafted and process all materials without mandatory water',()=>{
  const inv=new Inventory('survival',{counts:{8:8,10:2}});
  assert.equal(craft('forge',inv,false).ok,false);
  assert.ok(craft('forge',inv,true).ok);assert.equal(inv.count(24),1);
  for(const recipe of HEAT_RECIPES){
    const materials=new Inventory('survival',{counts:recipe.ingredients});
    assert.ok(heatMaterial(recipe.id,materials,{water:0}).ok);
    assert.equal(materials.count(recipe.output.id),recipe.output.count);
    for(const id of Object.keys(recipe.ingredients))assert.equal(materials.count(id),0);
  }
});

test('failed barbecue operations keep fuel, ore and cooling water intact',()=>{
  for(const counts of [{10:1},{18:1},{10:1,18:1,iron_ingot:Number.MAX_SAFE_INTEGER}]){
    const inv=new Inventory('survival',{counts});const before=inv.serialize(),station={water:1};
    assert.equal(heatMaterial('iron',inv,station).ok,false);
    assert.deepEqual(inv.serialize(),before);assert.equal(station.water,1);
  }
  const inv=new Inventory('survival',{counts:{10:1,18:1}}),station={water:1};
  assert.ok(heatMaterial('iron',inv,station).ok);assert.equal(station.water,0);
  assert.equal(heatMaterial('iron',inv,station).ok,false);assert.equal(inv.count('iron_ingot'),1);
});
