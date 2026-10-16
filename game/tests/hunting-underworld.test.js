import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {TreeResin,Slingshot} from '../src/hunting-tools.js';
import {Inventory,craft} from '../src/inventory.js';
import {VoxelWorld} from '../src/world.js';
import {EntitySystem} from '../src/entities.js';
import {Wildlife} from '../src/wildlife.js';
import {Player} from '../src/player.js';
import {hurtPet,feedPet} from '../src/pet-health.js';
import {BLOCK} from '../src/blocks.js';

test('resin comes from natural trees once, survives reload and cannot be farmed from placed logs',()=>{
  const w={edits:new Map(),getBlock:(x,y,z)=>x===0&&z===0?(y===3?5:y===6?6:0):0},i=new Inventory('survival'),hit={x:0,y:3,z:0,id:5};
  const r=new TreeResin(w);assert.ok(r.collect(hit,i).ok);assert.equal(i.count('resin'),1);
  assert.equal(new TreeResin(w,r.serialize()).collect(hit,i).ok,false);
  w.edits.set('0,3,0',{id:5});assert.equal(new TreeResin(w).collect(hit,i).ok,false);assert.equal(i.count('resin'),1);
});
test('slingshot crafting needs the workbench, wood and resin; stone makes eight rounds',()=>{
  const i=new Inventory('survival');i.add(5);i.add('resin');i.add(3);
  assert.equal(craft('slingshot',i,false).ok,false);assert.equal(i.count(5),1);
  assert.ok(craft('slingshot',i,true).ok);assert.equal(i.count('slingshot'),1);assert.equal(i.count('resin'),0);assert.equal(i.count(5),0);
  assert.ok(craft('pebbles',i).ok);assert.equal(i.count('pebble'),8);assert.equal(i.count(3),0);
});
test('projectiles consume ammunition once, hit prey and cannot cross a closer wall',()=>{
  let wall=false,hits=0;const scene=new THREE.Scene(),world={raycast:()=>wall?{distance:.1}:null};
  const wildlife={raycast:()=>({distance:.2,animal:{}}),strike:()=>hits++};
  const shot=new Slingshot(scene,world,wildlife),inv=new Inventory('survival');inv.add('slingshot');inv.add('pebble',2);
  const p={eye:new THREE.Vector3(0,2,0),direction:new THREE.Vector3(0,0,-1)};
  assert.ok(shot.fire(p,inv).ok);assert.equal(shot.fire(p,inv).ok,false);assert.equal(inv.count('pebble'),1);shot.update(.1);assert.equal(hits,1);
  shot.update(1);wall=true;assert.ok(shot.fire(p,inv).ok);shot.update(.1);assert.equal(hits,1);assert.equal(shot.shots.length,0);shot.dispose();
});
test('boars injure hunting dogs; wounded dogs retreat, recover with food and retain health on reload',()=>{
  const w=new VoxelWorld(null,'pet-combat'),scene=new THREE.Scene(),e=new EntitySystem(scene,w,null),wild=new Wildlife(e,{animals:[]});
  for(let x=30;x<37;x++)for(let z=30;z<37;z++)for(let y=34;y<39;y++)w.setBlock(x,y,z,y===34?3:0);
  const dog=e.pets[0];dog.tamed=true;dog.mode='hunt';dog.position.set(33.5,35,33.5);dog.health=100;dog.huntCooldown=99;
  wild.spawn('boar',new THREE.Vector3(33.5,35,34.5));wild.update(.1,new THREE.Vector3(35,35,35),new Inventory());assert.equal(dog.health,82);
  wild.update(.1,new THREE.Vector3(35,35,35),new Inventory());assert.equal(dog.health,82);
  hurtPet(dog,60);assert.equal(dog.health,22);assert.equal(dog.mode,'follow');assert.match(wild.command(dog),/recuperação/);
  feedPet(dog);assert.equal(dog.health,52);assert.match(wild.command(dog),/procurar/);
  const restored=new EntitySystem(new THREE.Scene(),w,null,e.serialize());assert.equal(restored.pets[0].health,52);
  restored.dispose();wild.dispose();e.dispose();w.dispose();
});
test('paired portals safely reach a roofed lava cavern, return and preserve edits and location across reload',()=>{
  const w=new VoxelWorld(null,'portal',{},{},{underworld:{version:1}}),p=new Player(w),entities={pets:[]};
  const gates=w.underworld.gates;assert.equal(w.getBlock(gates[0].x,gates[0].y,gates[0].z),BLOCK.PORTAL);
  assert.ok(w.underworld.travel(p,entities).ok);assert.ok(w.underworld.contains(p.position));assert.equal(p.blocked(p.position),false);
  const [x,z]=w.underworld.center;assert.equal(w.getBlock(x+3,4,z+5),BLOCK.LAVA);assert.equal(w.getBlock(x+3,2,z+5),BLOCK.STONE);
  assert.ok(w.getBlock(x,15,z));w.setBlock(x,6,z,8);
  const r=new VoxelWorld(null,'portal',w.serialize(),null,{underworld:w.underworld.serialize()}),rp=new Player(r,p.serialize());
  assert.ok(r.underworld.contains(rp.position));assert.equal(r.getBlock(x,6,z),8);assert.ok(r.underworld.travel(rp,entities).ok);assert.equal(r.underworld.contains(rp.position),false);
  r.dispose();w.dispose();
});
