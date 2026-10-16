import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { VoxelWorld } from '../src/world.js';
import { EntitySystem } from '../src/entities.js';
import { Inventory } from '../src/inventory.js';
import { PestSystem, pestRoll } from '../src/pests.js';
import { combatTargets } from '../src/enemies.js';

function arena(){
  const world=new VoxelWorld(null,'pests'),scene=new THREE.Scene();
  for(let x=36;x<=49;x++)for(let z=36;z<=49;z++){world.setBlock(x,34,z,3);for(let y=35;y<40;y++)world.setBlock(x,y,z,0);}
  const entities=new EntitySystem(scene,world),inventory=new Inventory('survival'),pests=new PestSystem(entities,inventory),player={position:new THREE.Vector3(43,35,43),health:100};
  pests.spawnTimer=45;
  const step=(seconds,chests={},mode='survival')=>{for(let i=0;i<seconds*60;i++){pests.update(1/60,player,chests,mode);entities.update(1/60,player.position);}};
  return {world,entities,inventory,pests,player,step,dispose(){pests.dispose();entities.dispose();world.dispose();}};
}
test('rare pest selection, population bounds and resource disposal',()=>{
  const counts={};for(let i=0;i<10000;i++){const type=pestRoll((i+.5)/10000);counts[type]=(counts[type]||0)+1;}
  assert.equal(counts.rat,5500);for(const type of ['scorpion','spider','snake'])assert.equal(counts[type],400);
  const a=arena();for(let i=0;i<20;i++)a.pests.spawn('rat',a.player.position);assert.equal(a.pests.animals.length,6);a.dispose();
});
test('rats steal exactly one food, respect chest walls, and recover it only once when defeated',()=>{
  const a=arena();a.inventory.add('food',3);const rat=a.pests.spawn('rat',new THREE.Vector3(43,35,42));
  const target=a.pests.foodTarget(rat,a.player.position,{});
  assert.ok(a.pests.steal(rat,target,'survival'));assert.equal(a.inventory.count('food'),2);assert.equal(a.pests.steal(rat,target,'survival'),false);
  assert.ok(a.pests.strike(rat,20));assert.equal(a.inventory.count('food'),3);assert.equal(a.pests.strike(rat,20),false);assert.equal(a.inventory.count('food'),3);
  a.inventory.counts={};const chest={'43,35,43':{cooked_chicken:2}};a.world.setBlock(43,35,43,16);
  const r=a.pests.spawn('rat',new THREE.Vector3(42.2,35,43.5));const t=a.pests.foodTarget(r,a.player.position,chest);
  a.world.setBlock(42,35,43,12);assert.equal(a.pests.steal(r,t,'survival'),false);a.world.setBlock(42,35,43,0);
  assert.ok(a.pests.steal(r,t,'survival'));assert.equal(chest['43,35,43'].cooked_chicken,1);a.pests.strike(r,20);assert.equal(a.inventory.count('cooked_chicken'),1);a.dispose();
});
test('rats take five seconds to open one wooden wall voxel, never stone, and persist the hole limit',()=>{
  const a=arena(),r=a.pests.spawn('rat',new THREE.Vector3(41.7,35,43.5)),target={position:new THREE.Vector3(44,35,43.5)};
  for(const id of [3,8,12]){
    a.world.setBlock(42,35,43,id);a.world.setBlock(42,36,43,id);
    for(let i=0;i<240;i++)a.pests.dig(r,target,1/60,'survival');assert.equal(a.world.getBlock(42,35,43),id);
    for(let i=0;i<90;i++)a.pests.dig(r,target,1/60,'survival');assert.equal(a.world.getBlock(42,35,43),id===12?0:id);
  }
  assert.equal(r.holes,1);assert.equal(a.world.getBlock(42,36,43),12);
  const restored=new PestSystem(a.entities,a.inventory,a.pests.serialize());assert.equal(restored.animals[0].holes,1);assert.equal(restored.burrowCooldown,120);
  a.world.setBlock(42,35,43,12);restored.burrowCooldown=0;for(let i=0;i<400;i++)restored.dig(restored.animals[0],target,1/60,'survival');assert.equal(a.world.getBlock(42,35,43),12);
  restored.dispose();a.dispose();
});
test('cats pursue all four pests, reclaim stolen food, keep a guard anchor and obey stay',()=>{
  for(const type of ['rat','scorpion','spider','snake']){
    const a=arena(),cat=a.entities.pets.find(p=>p.type==='cat');cat.tamed=true;cat.position.set(39.5,35,43.5);a.pests.command(cat);
    const p=a.pests.spawn(type,new THREE.Vector3(43.5,35,43.5));if(type==='rat')p.stolen='food';
    a.step(10);assert.equal(a.pests.animals.length,0,type);if(type==='rat')assert.equal(a.inventory.count('food'),1);
    assert.equal(cat.mode,'guard');assert.deepEqual(cat.guardAnchor.toArray(),[39.5,35,43.5]);
    const saved=a.entities.serialize(),restored=new EntitySystem(new THREE.Scene(),a.world,null,saved),c=restored.pets.find(p=>p.id===cat.id);assert.equal(c.mode,'guard');assert.deepEqual(c.guardAnchor.toArray(),cat.guardAnchor.toArray());restored.dispose();
    cat.mode='stay';a.pests.spawn('rat',cat.position.clone());a.step(1);assert.equal(a.pests.animals.length,1);a.dispose();
  }
});
test('rare pests bite in survival, creative theft and digging are disabled, and armed targeting includes pests',()=>{
  const a=arena(),p=a.pests.spawn('snake',new THREE.Vector3(43,35,42.5));a.step(.1);assert.equal(a.player.health,94);a.step(.1,{},'creative');assert.equal(a.player.health,94);
  const combat=combatTargets(a.pests);const hit=combat.raycast(new THREE.Vector3(43,35.2,44),new THREE.Vector3(0,0,-1),4);assert.ok(hit);assert.ok(combat.strike(hit.animal,30));
  a.inventory.add('food');const r=a.pests.spawn('rat',new THREE.Vector3(43,35,42.5));assert.equal(a.pests.steal(r,a.pests.foodTarget(r,a.player.position,{}),'creative'),false);assert.equal(a.inventory.count('food'),1);
  r.stolen='food';r.cooldown=12;const saved=a.pests.serialize(),restored=new PestSystem(a.entities,a.inventory,saved);assert.deepEqual(restored.serialize(),saved);restored.dispose();a.dispose();
});
