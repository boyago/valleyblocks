import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { VoxelWorld } from '../src/world.js';
import { EntitySystem } from '../src/entities.js';
import { EnemySystem } from '../src/enemies.js';
import { appendFurniture, completeRest, restEligibility } from '../src/furniture.js';
import { GameAudio } from '../src/audio.js';

test('home furniture exists, renders different TV states and preserves changes across saves',()=>{
  const w=new VoxelWorld(null,'home',[],null,{generatorVersion:3});
  assert.equal(w.getBlock(-11,9,0),28);assert.equal(w.getBlock(-10,9,-4),29);
  const groups=[];for(const on of [false,true]){const g={positions:[],normals:[],colors:[],uvs:[],indices:[]};appendFurniture(g,29,0,0,0,on);groups.push(g);assert.ok(g.positions.every(n=>n>=0&&n<=1));}
  assert.notDeepEqual(groups[0],groups[1]);
  w.televisions.add('-10,9,-4');const restored=new VoxelWorld(null,'home',[],null,{generatorVersion:3,televisions:[...w.televisions]});
  assert.ok(restored.televisions.has('-10,9,-4'));restored.setBlock(-10,9,-4,0);assert.equal(restored.televisions.size,0);
  const removed=new VoxelWorld(null,'home',restored.serialize(),null,{generatorVersion:3});assert.equal(removed.getBlock(-10,9,-4),0);
  w.dispose();restored.dispose();removed.dispose();
});

test('rest requires a nearby sofa at night, restores energy, spends food and rejects nearby enemies',()=>{
  const world=new VoxelWorld(null,'rest',[],null,{generatorVersion:3}),hit={x:-11,y:9,z:0};let updates=0;
  const g={world,time:.8,mode:'survival',player:{position:new THREE.Vector3(-10,9,-1),stamina:20,hunger:75,panting:1,exhausted:true},enemies:{enemies:[],update:()=>updates++}};
  assert.equal(restEligibility(g,hit),'');assert.ok(completeRest(g,hit).ok);
  assert.equal(g.time,6.5/24);assert.equal(g.player.stamina,100);assert.equal(g.player.hunger,67);assert.equal(g.player.exhausted,false);assert.equal(updates,1);
  assert.equal(completeRest(g,hit).ok,false);g.time=.8;g.enemies.enemies.push({position:g.player.position.clone()});assert.equal(completeRest(g,hit).ok,false);
  g.enemies.enemies=[];world.setBlock(-11,9,0,0);assert.equal(completeRest(g,hit).ok,false);world.dispose();
});

test('whistled dog walks to the occupied player vehicle, boards, and safely exits on another whistle',()=>{
  const world=new VoxelWorld(null,'whistle'),scene=new THREE.Scene(),sounds=[];
  const entities=new EntitySystem(scene,world,{play:name=>sounds.push(name)}),car=entities.vehicles[0],dog=entities.pets[0];
  dog.tamed=true;const player=car.position.clone(),initial=dog.position.clone();
  assert.match(entities.whistle(car,player),/vindo/);assert.equal(dog.vehicleId,null);assert.deepEqual(dog.position,initial);
  for(let n=0;n<1200&&!car.passenger;n++)entities.update(1/60,player,new Set(),car);
  assert.ok(car.passenger===dog,'dog should reach the entry and board');assert.equal(dog.vehicleId,car.id);assert.ok(sounds.includes('whistle'));assert.ok(dog.position.distanceTo(initial)>1);
  car.speed=2;assert.match(entities.whistle(car,player),/Pare/);assert.equal(car.passenger,dog);car.speed=0;
  assert.match(entities.whistle(car,player),/desceu/);assert.equal(car.passenger,null);assert.equal(dog.vehicleId,null);assert.equal(dog.mode,'follow');
  assert.equal(world.collides({x:dog.position.x-.2,y:dog.position.y+.04,z:dog.position.z-.2},{x:dog.position.x+.2,y:dog.position.y+1,z:dog.position.z+.2}),false);
  entities.dispose();world.dispose();
});

test('whistle cannot recruit wild dogs, board a moving vehicle or unload into walls',()=>{
  const world=new VoxelWorld(null,'safety'),entities=new EntitySystem(new THREE.Scene(),world),car=entities.vehicles[0],dog=entities.pets[0];
  assert.match(entities.whistle(car,car.position),/Nenhum cachorro/);dog.tamed=true;car.speed=1;assert.match(entities.whistle(car,car.position),/Pare/);assert.equal(dog.boardingVehicleId,undefined);
  car.speed=0;entities.boardPet(dog,car);const original=entities.findExit;entities.findExit=()=>null;
  assert.match(entities.whistle(car,car.position),/espaço seguro/);assert.equal(car.passenger,dog);
  entities.findExit=original;entities.dispose();world.dispose();
});

test('reaper feet move with hip pivots while walking and stop when winding up or blocked',()=>{
  const world=new VoxelWorld(null,'walk'),entities=new EntitySystem(new THREE.Scene(),world),enemies=new EnemySystem(entities);
  const enemy=enemies.spawn('reaper',new THREE.Vector3(-2,9,13)),player={position:new THREE.Vector3(-2,9,19),health:100};enemies.spawnTimer=15;
  assert.equal(enemy.legs[0].type,'Group');assert.equal(enemy.legs[0].children.length,2);
  enemies.update(.1,player,.8,'creative');const angle=enemy.legs[0].rotation.x;
  assert.ok(Math.abs(angle)>.1);assert.equal(enemy.legs[0].rotation.x,-enemy.legs[1].rotation.x);
  enemies.update(.1,player,.8,'creative');assert.notEqual(enemy.legs[0].rotation.x,angle);
  enemy.windup=.5;enemies.update(.1,player,.8,'creative');assert.equal(enemy.legs[0].rotation.x,0);
  enemies.dispose();entities.dispose();world.dispose();
});

test('whistle schedules two distinct ascending and descending sine tones',()=>{
  const a=new GameAudio(),tones=[];a.context={};a.sound=options=>tones.push(options);a.play('whistle');
  assert.equal(tones.length,2);assert.ok(tones[0].endFrequency>tones[0].frequency);assert.ok(tones[1].endFrequency<tones[1].frequency);assert.ok(tones[1].delay>0);
});
