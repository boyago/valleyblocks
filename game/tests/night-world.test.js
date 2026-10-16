import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { VoxelWorld } from '../src/world.js';
import { EntitySystem } from '../src/entities.js';
import { EnemySystem, isEnemyTime, combatTargets } from '../src/enemies.js';
import { newWorldSeed } from '../src/world-seed.js';
import { Slingshot } from '../src/hunting-tools.js';
import { Inventory } from '../src/inventory.js';

test('random new worlds differ and each retains the cottage, grill, cars and dogs; saved terrain is deterministic',()=>{
  const seeds=Array.from({length:6},()=>newWorldSeed());assert.equal(new Set(seeds).size,6);
  assert.equal(newWorldSeed('  reproducible  '),'reproducible');
  const terrain=[];
  for(const seed of seeds){
    const scene=new THREE.Scene(),w=new VoxelWorld(scene,seed,[],null,{generatorVersion:3}),e=new EntitySystem(scene,w);
    assert.equal(w.getBlock(-8,9,-5),24);assert.equal(w.getBlock(-9,9,2),14);
    assert.ok(e.vehicles.length>=1);assert.ok(e.pets.some(p=>p.type==='dog'));
    const signature=[];for(let x=-100;x<=100;x+=20)for(let z=-100;z<=100;z+=20)signature.push(w._column(x,z));
    terrain.push(JSON.stringify(signature));
    const restored=new VoxelWorld(null,seed,[],null,{generatorVersion:3});assert.deepEqual(restored._column(-60,40),w._column(-60,40));
    w.setBlock(-8,9,-5,0);const removed=new VoxelWorld(null,seed,w.serialize(),null,{generatorVersion:3});assert.equal(removed.getBlock(-8,9,-5),0);
    removed.dispose();restored.dispose();e.dispose();w.dispose();
  }
  assert.equal(new Set(terrain).size,6);
  const legacy=new VoxelWorld(null,'legacy',[],null,{generatorVersion:2});assert.equal(legacy.getBlock(-8,9,-5),0);legacy.dispose();
});

function arena(){
  const scene=new THREE.Scene(),world=new VoxelWorld(scene,'enemy-arena');
  for(let x=38;x<=49;x++)for(let z=37;z<=49;z++){world.setBlock(x,34,z,3);for(let y=35;y<40;y++)world.setBlock(x,y,z,0);}
  const entities=new EntitySystem(scene,world),enemies=new EnemySystem(entities);
  const player={position:new THREE.Vector3(43,35,43),health:100};
  const step=(seconds,mode='survival',time=.8)=>{enemies.spawnTimer=100;for(let i=0;i<seconds*60;i++)enemies.update(1/60,player,time,mode);};
  const dispose=()=>{enemies.dispose();entities.dispose();world.dispose();};
  return {scene,world,entities,enemies,player,step,dispose};
}

test('night spawning has a strict time window, avoids the starter clearing, is bounded and clears at dawn',()=>{
  assert.ok(isEnemyTime(17.5/24));assert.ok(isEnemyTime(0));assert.ok(!isEnemyTime(6/24));assert.ok(!isEnemyTime(.5));
  const a=arena();a.world.ensureAround(43,43,3);
  a.enemies.update(5,a.player,.5,'survival');assert.equal(a.enemies.enemies.length,0);
  a.enemies.update(3,a.player,17.5/24,'survival');assert.equal(a.enemies.enemies.length,1);
  const first=a.enemies.enemies[0];assert.ok(Math.hypot(first.position.x,first.position.z)>=23);
  for(let i=0;i<100;i++)a.enemies.trySpawn(a.player.position);
  assert.equal(a.enemies.enemies.length,8);assert.ok(a.enemies.enemies.some(e=>e.type==='specter'));
  a.enemies.update(.1,a.player,6/24,'survival');assert.equal(a.enemies.enemies.length,0);a.dispose();
});

test('reaper telegraphs a strike, hits once per cooldown, and walls block both attacks and movement',()=>{
  const a=arena(),e=a.enemies.spawn('reaper',new THREE.Vector3(43,35,41.5));
  a.step(.2);assert.ok(e.windup>0);assert.equal(a.player.health,100);
  a.step(.5);assert.equal(a.player.health,84);
  a.step(.5);assert.equal(a.player.health,84);
  e.position.z=41.5;
  for(let x=41;x<=45;x++)for(let y=35;y<=38;y++)a.world.setBlock(x,y,42,3);
  a.step(4);assert.equal(a.player.health,84);assert.ok(e.position.z<42);
  assert.equal(a.enemies.raycast(new THREE.Vector3(43,36,43),new THREE.Vector3(0,0,-1),5),null);
  a.dispose();
});

test('specter has a fuse, explodes once, leaves temporary acid and respects creative immunity',()=>{
  for(const mode of ['survival','creative']){
    const a=arena();a.enemies.spawn('specter',new THREE.Vector3(43,35,41.5));
    a.step(.5,mode);assert.equal(a.player.health,100);assert.equal(a.enemies.acid.length,0);
    a.step(1.1,mode);assert.equal(a.enemies.enemies.length,0);assert.equal(a.enemies.acid.length,1);
    const health=a.player.health;a.step(1,mode);
    if(mode==='survival'){assert.ok(health<75);assert.ok(a.player.health<health);}else assert.equal(a.player.health,100);
    a.player.position.x+=10;const safeHealth=a.player.health;a.step(8,mode);assert.equal(a.enemies.acid.length,0);assert.equal(a.player.health,safeHealth);a.dispose();
  }
});

test('defeating a specter cancels its explosion; save/reload preserves fuse, health and acid lifetime',()=>{
  const a=arena(),e=a.enemies.spawn('specter',new THREE.Vector3(43,35,41.5));
  a.step(.3);a.enemies.strike(e,12);a.enemies.addAcid(new THREE.Vector3(46,35,46),3);
  a.enemies.spawnTimer=10;
  const snapshot=a.enemies.serialize(),restored=new EnemySystem(a.entities,snapshot);
  assert.deepEqual(restored.serialize(),snapshot);
  assert.equal(restored.strike(restored.enemies[0],30),true);restored.update(2,a.player,.8,'survival');
  assert.equal(restored.enemies.length,0);assert.equal(restored.acid.length,2);assert.equal(restored.acid[0].life,1);
  const residue=restored.acid[1];assert.equal(residue.safe,true);
  const hp=a.player.health;a.player.position.copy(residue.position);restored.update(.5,a.player,.8,'survival');assert.equal(a.player.health,hp,'defeated specter residue is harmless');
  assert.equal(restored.serialize().acid[1].safe,true);
  assert.equal(restored.collectAcid(residue.position),true);assert.equal(restored.acid.length,1);assert.equal(restored.collectAcid(new THREE.Vector3(0,0,0)),false);
  restored.dispose();a.dispose();
});

test('melee and slingshot target hostile enemies, and projectiles cannot penetrate a wall',()=>{
  for(const wall of [false,true]){
    const a=arena(),e=a.enemies.spawn('reaper',new THREE.Vector3(43,35,39.5));
    const combat=combatTargets({raycast:()=>null,strike:()=>false},a.enemies);
    const inv=new Inventory('survival');inv.add('slingshot');inv.add('pebble');inv.hotbar[0]='slingshot';
    const player={eye:new THREE.Vector3(43,36.2,43),direction:new THREE.Vector3(0,0,-1)};
    if(wall)for(let y=35;y<=38;y++)a.world.setBlock(43,y,41,3);
    else {const hit=combat.raycast(player.eye,player.direction,5);assert.equal(hit.animal,e);assert.ok(combat.strike(e,14,player.eye));}
    const before=e.health,shots=new Slingshot(a.scene,a.world,combat);assert.ok(shots.fire(player,inv).ok);
    for(let i=0;i<30;i++)shots.update(1/60);
    assert.equal(e.health,wall?before:before-24);shots.dispose();a.dispose();
  }
});

test('about one in ten reapers drops the scythe, deterministically by world seed',()=>{
  const a=arena();let drops=0;a.enemies.onDrop=item=>{assert.equal(item,'reaper_scythe');drops++;};
  for(let i=0;i<400;i++){const e=a.enemies.spawn('reaper',new THREE.Vector3(43,35,39.5));a.enemies.strike(e,999);}
  assert.ok(drops>=20&&drops<=65,'drops '+drops);a.dispose();
});

test('flask and portal spray recipes', async ()=>{
  const { craft, Inventory, ITEMS } = await import('../src/inventory.js');
  for(const id of ['flask','specter_acid','portal_spray','reaper_scythe'])assert.ok(ITEMS[id]);
  const inv=new Inventory('survival');inv.add(7);assert.equal(craft('flask',inv).ok,true);assert.equal(inv.count('flask'),2);
  inv.add('specter_acid',2);inv.add('iron_ingot');
  assert.equal(craft('portal_spray',inv,false).ok,false);assert.equal(craft('portal_spray',inv,true).ok,true);
  assert.equal(inv.count('portal_spray'),1);assert.equal(inv.count('specter_acid'),0);assert.equal(inv.count('flask'),1);
});
