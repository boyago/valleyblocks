import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {VoxelWorld} from '../src/world.js';
import {EntitySystem} from '../src/entities.js';
import {Wildlife,SPECIES} from '../src/wildlife.js';
import {Player} from '../src/player.js';
import {Inventory} from '../src/inventory.js';
import {restoreNeeds,updateNeeds,eatFood} from '../src/survival.js';
import {heatMaterial} from '../src/interactions.js';
import {GameAudio} from '../src/audio.js';

function setup(){
  const scene=new THREE.Scene(),world=new VoxelWorld(scene,'hunt-test');
  for(let x=30;x<55;x++)for(let z=30;z<55;z++)world.setBlock(x,34,z,3);
  const entities=new EntitySystem(scene,world,{}),wildlife=new Wildlife(entities,{animals:[],drops:[]}),inventory=new Inventory('survival');
  return {world,entities,wildlife,inventory,close(){wildlife.dispose();entities.dispose();world.dispose();}};
}

test('survival exertion drains food and energy; rest recovers breath; creative is exempt',()=>{
  const p={health:100};restoreNeeds(p);for(let i=0;i<480;i++)updateNeeds(p,1/60,'survival',{moving:true,sprinting:true});
  assert.ok(p.hunger<99);assert.equal(p.stamina,0);assert.equal(p.exhausted,true);assert.equal(p.panting,1);
  for(let i=0;i<300;i++)updateNeeds(p,1/60,'survival');assert.ok(p.stamina>55);assert.equal(p.exhausted,false);assert.equal(p.panting,0);
  const h=p.hunger,s=p.stamina;updateNeeds(p,60,'creative',{moving:true,sprinting:true});assert.equal(p.hunger,h);assert.equal(p.stamina,s);
  p.hunger=0;const health=p.health;updateNeeds(p,1,'survival');assert.ok(p.health<health);
});

test('player cannot sprint while exhausted or hungry and needs survive reloads and legacy saves',()=>{
  const {world,close}=setup(),p=new Player(world,{position:[38,35.002,40],hunger:100,stamina:0,exhausted:true});
  p.update(.1,new Set(['KeyW','ShiftLeft']),'survival');assert.equal(p.sprinting,false);assert.ok(p.velocity.length()<5);
  p.stamina=100;p.exhausted=false;p.hunger=5;p.update(.1,new Set(['KeyW','ShiftLeft']),'survival');assert.equal(p.sprinting,false);
  const restored=new Player(world,p.serialize());assert.equal(restored.hunger,p.hunger);assert.equal(restored.stamina,p.stamina);
  const legacy=new Player(world,{position:[38,35.002,40]});assert.equal(legacy.hunger,100);assert.equal(legacy.stamina,100);close();
});

test('cooking each hunted species consumes fuel once and eating restores nutrition without duplicates',()=>{
  for(const type of Object.keys(SPECIES).filter(t=>!SPECIES[t].scenery)){
    const item=SPECIES[type].drop,cooked=item.replace('raw_','cooked_'),inv=new Inventory('survival',{counts:{[item]:1,18:1}}),p={health:70};restoreNeeds(p,{hunger:20,stamina:20});
    assert.ok(heatMaterial(type,inv,{water:0}).ok);assert.equal(inv.count(item),0);assert.equal(inv.count(18),0);assert.equal(inv.count(cooked),1);
    inv.hotbar[0]=cooked;
    assert.ok(eatFood(p,inv,cooked,'survival').ok);assert.ok(p.hunger>=50);assert.ok(p.stamina>30);assert.equal(inv.count(cooked),0);assert.equal(inv.hotbar[0],null);
    const before={...p};assert.equal(eatFood(p,inv,cooked,'survival').ok,false);assert.deepEqual(p,before);
    inv.add(cooked);p.hunger=100;assert.equal(eatFood(p,inv,cooked,'survival').ok,false);assert.equal(inv.count(cooked),1);
  }
});

test('wildlife spawns three species, flees, respects walls and drops loot only once',()=>{
  const c=setup(),w=c.wildlife,p=new THREE.Vector3(40.5,35,42.5);
  for(const [i,type] of Object.keys(SPECIES).entries())w.spawn(type,new THREE.Vector3(40.5+i*3,35,40.5));
  const bird=w.animals[0],start=bird.position.clone();
  for(let i=0;i<60;i++)w.update(1/60,p,c.inventory);
  assert.ok(bird.position.distanceTo(start)>.4,'prey should flee a nearby player');
  bird.position.set(40.5,35,40.5);
  const eye=new THREE.Vector3(40.5,35.5,43.5),direction=new THREE.Vector3(0,0,-1);
  assert.equal(w.raycast(eye,direction).animal,bird);
  for(let y=35;y<38;y++)c.world.setBlock(40,y,42,3);
  assert.equal(w.raycast(eye,direction),null,'cannot hunt through blocks');
  assert.ok(w.strike(bird,100,p));assert.equal(w.strike(bird,100,p),false);assert.equal(w.drops.length,1);
  assert.equal(w.collect(c.inventory,bird.position),1);assert.equal(w.collect(c.inventory,bird.position),0);assert.equal(c.inventory.count('raw_chicken'),1);c.close();
});

test('a tamed dog pursues prey, carries loot back and delivers exactly once',()=>{
  const c=setup(),w=c.wildlife,pet=c.entities.pets.find(p=>p.type==='dog'),player=new THREE.Vector3(40.5,35,44.5);
  pet.position.set(40.5,35,42.5);pet.home.copy(pet.position);pet.tamed=true;
  const prey=w.spawn('chicken',new THREE.Vector3(40.5,35,38.5));
  assert.match(w.command(pet),/procurar/);
  let carried=false;
  for(let i=0;i<2400;i++){w.update(1/60,player,c.inventory);c.entities.updatePet(1/60,pet,player);carried ||= !!pet.carry;if(c.inventory.count('raw_chicken'))break;}
  assert.equal(w.animals.includes(prey),false);assert.ok(carried,'dog should visibly carry the package');assert.equal(c.inventory.count('raw_chicken'),1);
  assert.equal(pet.carry,null);assert.equal(w.drops.length,0);
  assert.match(w.command(c.entities.pets.find(p=>p.type==='cat')),/Apenas/);c.close();
});

test('in-transit hunt saves preserve carried meat and do not resurrect killed animals',()=>{
  const c=setup(),pet=c.entities.pets[0];pet.tamed=true;pet.mode='hunt';pet.position.set(40.5,35,40.5);pet.carry={item:'raw_boar',count:3};
  const animalSave=c.wildlife.serialize(),entitySave=c.entities.serialize();c.wildlife.dispose();c.entities.dispose();
  const entities=new EntitySystem(new THREE.Scene(),c.world,{},entitySave),w=new Wildlife(entities,animalSave),player=new THREE.Vector3(40.5,35,41.5);
  assert.equal(w.animals.length,0);assert.equal(entities.pets[0].carry.count,3);
  w.update(1/60,player,c.inventory);w.update(1/60,player,c.inventory);
  assert.equal(c.inventory.count('raw_boar'),3);assert.equal(entities.pets[0].carry,null);
  w.dispose();entities.dispose();c.world.dispose();
});

test('panting schedules filtered breathing only during active dry simulation',()=>{
  const audio=new GameAudio(),calls=[];audio.sound=options=>calls.push(options);
  const param={setTargetAtTime(){}};audio.context={state:'running',currentTime:1};audio.waterGain={gain:param};audio.windGain={gain:param};
  audio.ambientTime=100;audio.musicTime=100;
  audio.update(.1,{panting:1});assert.equal(calls.length,2);assert.ok(calls.every(c=>c.noise));
  audio.paused=true;audio.update(1,{panting:1});assert.equal(calls.length,2);
  audio.paused=false;audio.breathTime=0;audio.update(.1,{panting:1,inWater:true});assert.equal(calls.length,2);
});
