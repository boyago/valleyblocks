import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { VoxelWorld } from '../src/world.js';
import { BLOCK } from '../src/blocks.js';
import { Inventory, craft } from '../src/inventory.js';
import { useBucket, forgeIron } from '../src/interactions.js';
import { ExplorerAvatar, playerCamera } from '../src/avatar.js';
import { Player } from '../src/player.js';

function shaft(w,wet=false){
  for(let y=30;y<=45;y++)w.setBlock(20,y,20,y===30?BLOCK.STONE:wet&&y<38?BLOCK.WATER:BLOCK.AIR);
}
function run(w,seconds=5){for(let i=0;i<seconds*60;i++)w.step(1/60);}

test('unsupported sand accelerates down, stacks, and settles underwater without floating',()=>{
  for(const wet of [false,true]){
    const w=new VoxelWorld(null,'sand');shaft(w,wet);
    w.setBlock(20,41,20,BLOCK.SAND);w.setBlock(20,42,20,BLOCK.SAND);
    run(w,.4);assert.ok(w.sand.falling.some(p=>p.y<40&&p.velocity<0));
    assert.equal(w.getBlock(20,42,20),BLOCK.AIR);
    run(w,7);assert.equal(w.getBlock(20,31,20),BLOCK.SAND);assert.equal(w.getBlock(20,32,20),BLOCK.SAND);
    assert.equal(w.sand.falling.filter(p=>p.x===20&&p.z===20).length,0);w.dispose();
  }
});

test('sand loses support after mining and mid-fall saves restore one block',()=>{
  const w=new VoxelWorld(null,'sand-save');shaft(w);
  w.setBlock(20,40,20,BLOCK.STONE);w.setBlock(20,41,20,BLOCK.SAND);run(w,.2);
  assert.equal(w.getBlock(20,41,20),BLOCK.SAND);w.setBlock(20,40,20,BLOCK.AIR);run(w,.3);
  const saved=w.sand.serialize();assert.ok(saved.falling.length);
  const r=new VoxelWorld(null,w.seed,w.serialize(),w.serializeFluids(),{dynamics:saved});r.ensureAround(20,20,1);run(r,4);
  assert.equal(r.getBlock(20,31,20),BLOCK.SAND);
  let count=0;for(let y=31;y<46;y++)if(r.getBlock(20,y,20)===BLOCK.SAND)count++;
  assert.equal(count,1);w.dispose();r.dispose();
});

test('water meshes share sloping edges and excavated water has no collision step',()=>{
  const w=new VoxelWorld(null,'water-slope');
  for(let x=20;x<=27;x++){w.setBlock(x,39,20,BLOCK.STONE);w.setBlock(x,40,20,BLOCK.AIR);}
  w.setBlock(20,40,20,BLOCK.WATER);run(w,5);
  const left=w.waterSurfaceAt(21.9999,40,20.5),right=w.waterSurfaceAt(22.0001,40,20.5);
  assert.ok(Math.abs(left-right)<.001,'water surface must meet continuously across cells');
  assert.equal(w.collides({x:21.1,y:40.01,z:20.1},{x:21.8,y:41,z:20.8}),false);
  w.setBlock(20,39,20,BLOCK.AIR);w.setBlock(20,38,20,BLOCK.AIR);run(w,5);
  assert.equal(w.getBlock(20,39,20),BLOCK.WATER);assert.equal(w.waterSurfaceAt(20.5,39,20.5),40);
  w.dispose();
});

test('bucket collection, rejected placement and forge transfers conserve buckets',()=>{
  const w=new VoxelWorld(null,'bucket');const inv=new Inventory('survival');inv.add('bucket');inv.hotbar[0]='bucket';
  w.setBlock(20,40,20,BLOCK.WATER);const forges={};
  const water={x:20,y:40,z:20,id:BLOCK.WATER,normal:{x:0,y:1,z:0}};
  assert.ok(useBucket(w,inv,water,()=>true,forges).ok);assert.equal(w.getBlock(20,40,20),BLOCK.AIR);assert.equal(inv.count('water_bucket'),1);assert.equal(inv.count('bucket'),0);
  const floor={x:20,y:39,z:20,id:BLOCK.STONE,normal:{x:0,y:1,z:0}};
  assert.equal(useBucket(w,inv,floor,()=>false,forges).ok,false);assert.equal(inv.count('water_bucket'),1);
  assert.ok(useBucket(w,inv,floor,()=>true,forges).ok);assert.equal(inv.count('bucket'),1);assert.equal(w.getBlock(20,40,20),BLOCK.WATER);
  assert.ok(useBucket(w,inv,water,()=>true,forges).ok);
  const forge={x:22,y:40,z:20,id:BLOCK.FORGE};w.setBlock(22,40,20,BLOCK.FORGE);
  assert.ok(useBucket(w,inv,forge,()=>true,forges).ok);assert.equal(forges['22,40,20'].water,1);assert.equal(inv.count('bucket'),1);
  const before=inv.serialize();assert.equal(forgeIron(inv,forges['22,40,20']).ok,false);assert.deepEqual(inv.serialize(),before);assert.equal(forges['22,40,20'].water,1);
  inv.add(BLOCK.ORE);inv.add(BLOCK.COAL);assert.ok(forgeIron(inv,forges['22,40,20']).ok);assert.equal(inv.count('iron_ingot'),1);assert.equal(forges['22,40,20'].water,0);
  assert.ok(craft('bucket-refined',inv,true).ok);assert.equal(inv.count('bucket'),2);w.dispose();
});

test('generator versions keep existing terrain and new seeds contain diverse biomes and ores',()=>{
  const old=new VoxelWorld(null,'aurora-2026'),fresh=new VoxelWorld(null,'aurora-2026',[],null,{generatorVersion:2});
  const restored=new VoxelWorld(null,old.seed,old.serialize(),null,{generatorVersion:1});
  const biomes=new Set(),ores=new Set();
  for(let x=-640;x<=640;x+=64)for(let z=-640;z<=640;z+=64)biomes.add(fresh.biomeAt(x,z));
  for(const name of ['pradaria','deserto','floresta','meseta','nevasca'])assert.ok(biomes.has(name),name);
  for(let x=80;x<112;x++)for(let z=80;z<112;z++)for(let y=2;y<26;y++){
    assert.equal(old.getBlock(x,y,z),restored.getBlock(x,y,z));
    ores.add(fresh.getBlock(x,y,z));
  }
  for(const id of [10,18,19,20,21])assert.ok(ores.has(id),'missing mineral '+id);
  assert.equal(old.generatorVersion,1);assert.equal(fresh.generatorVersion,2);
  old.dispose();fresh.dispose();restored.dispose();
});

test('original avatar equips matching tools in both views and camera avoids rear wall',()=>{
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();const w=new VoxelWorld(scene,'avatar'),p=new Player(w);
  const avatar=new ExplorerAvatar(scene,camera);avatar.update(p,'pickaxe',{first:true});
  assert.equal(avatar.view.visible,true);assert.equal(avatar.body.visible,false);assert.equal(avatar.held.name,'held:pickaxe');
  avatar.update(p,'water_bucket',{first:false});assert.equal(avatar.body.visible,true);assert.equal(avatar.view.visible,false);assert.equal(avatar.heldWorld.name,'held:water_bucket');
  p.position.set(0,9,12);p.pitch=0;
  for(let x=-2;x<=2;x++)for(let y=9;y<14;y++)w.setBlock(x,y,14,BLOCK.STONE);
  const view=playerCamera(w,p,'back');assert.ok(view.position.z<13.8);assert.ok(view.distance<2);
  assert.ok(playerCamera(w,p,'front').position.z<12);avatar.dispose();w.dispose();
});

test('unloaded falling sand does not exhaust local simulation capacity or generate distant chunks',()=>{
  const w=new VoxelWorld(null,'sand-unloaded');shaft(w);
  for(let i=0;i<128;i++)w.sand.spawn(10000+i,40,10000);
  const chunks=w.chunks.size;w.setBlock(20,42,20,BLOCK.SAND);run(w,.2);
  assert.ok(w.sand.falling.some(p=>p.x===20&&p.y<42));assert.equal(w.chunks.size,chunks);
  const saved=w.sand.serialize();assert.equal(saved.falling.filter(p=>p[0]>=10000).length,128);w.dispose();
});

test('new creative materials stay unlimited and flowing water cannot duplicate bucket contents',()=>{
  const creative=new Inventory('creative');for(const id of [18,19,20,21,22,23,24]){assert.equal(creative.count(id),0);creative.add(id);assert.equal(creative.count(id),Infinity);}
  const w=new VoxelWorld(null,'bucket-flow');w.setBlock(20,39,20,3);w.setBlock(21,39,20,3);w.setBlock(20,40,20,9);run(w,4);
  const inv=new Inventory('survival');inv.add('bucket');inv.hotbar[0]='bucket';const before=inv.serialize();
  assert.equal(useBucket(w,inv,{x:21,y:40,z:20,id:9},()=>true,{}).ok,false);assert.deepEqual(inv.serialize(),before);w.dispose();
});
