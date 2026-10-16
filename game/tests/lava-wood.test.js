import test from 'node:test';
import assert from 'node:assert/strict';
import { VoxelWorld } from '../src/world.js';
import { Player } from '../src/player.js';
import { Inventory } from '../src/inventory.js';
import { TreeResin } from '../src/hunting-tools.js';
import { primaryAction, mineBlock } from '../src/mining.js';
import { BLOCK } from '../src/blocks.js';

function pool(id) {
  const world=new VoxelWorld(null,'liquid-body');
  for(let x=0;x<7;x++)for(let z=32;z<39;z++){
    world.setBlock(x,39,z,BLOCK.STONE);
    for(let y=40;y<44;y++)world.setBlock(x,y,z,id);
  }
  const player=new Player(world,{position:[3.5,41,35.5]});
  return {world,player};
}

test('lava slows falling and walking more than water, allows rising, and deals 40 damage per second',()=>{
  for(const dt of [1/120,1/30,.1]){
    const lava=pool(BLOCK.LAVA),water=pool(BLOCK.WATER);
    for(let n=0;n<Math.round(1/dt);n++){
      lava.player.update(dt,new Set(['KeyD']),'survival');
      water.player.update(dt,new Set(['KeyD']),'survival');
    }
    assert.ok(lava.player.inLava);assert.equal(lava.player.inWater,false);
    assert.ok(Math.abs(lava.player.health-60)<.1);
    assert.ok(lava.player.position.x<water.player.position.x);
    assert.ok(lava.player.velocity.y>water.player.velocity.y);
    const y=lava.player.position.y,health=lava.player.health;
    for(let n=0;n<Math.round(.5/dt);n++)lava.player.update(dt,new Set(['Space']),'creative');
    assert.ok(lava.player.position.y>y);assert.equal(lava.player.health,health);
    lava.world.dispose();water.world.dispose();
  }
});

test('lava contact follows the rendered surface, stops burning after exit, and respawns safely',()=>{
  const {world,player}=pool(BLOCK.LAVA);
  player.position.y=43.95;player.flying=true;
  player.update(.1,new Set(),'creative');assert.equal(player.inLava,false);
  player.position.set(3.5,41,35.5);player.flying=false;
  player.update(.1,new Set(),'survival');assert.ok(player.health<100);
  player.position.set(3.5,45,35.5);player.velocity.set(0,0,0);
  const health=player.health;player.update(.1,new Set(),'survival');assert.equal(player.health,health);
  player.position.set(3.5,41,35.5);player.health=2;
  assert.equal(player.update(.1,new Set(),'survival'),'respawn');
  assert.equal(player.health,100);assert.equal(player.blocked(player.position),false);
  world.dispose();
});

test('resin and wood can both be collected from the same tree with any equipped tool',()=>{
  for(const item of [null,'axe','pickaxe','slingshot'])for(const collectFirst of [false,true]){
    let log=BLOCK.WOOD;
    const world={edits:new Map(),getBlock:(x,y,z)=>x===0&&z===0?(y===3?log:y===6?BLOCK.LEAVES:0):0,
      setBlock:(x,y,z,id)=>{log=id;return true;}};
    const inventory=new Inventory('survival'),hit={x:0,y:3,z:0,id:BLOCK.WOOD};
    if(item){inventory.add(item);inventory.hotbar[0]=item;}inventory.add('pebble',3);
    const resin=new TreeResin(world);
    if(collectFirst){assert.ok(resin.collect(hit,inventory).ok);assert.equal(log,BLOCK.WOOD);}
    assert.equal(primaryAction(item,hit),'mine');
    const game={world,inventory,target:hit,mining:true,miningProgress:0,mode:'survival',goals:{},
      blockKey:()=> '0,3,0',ui:{toast:()=>{}},audio:{play:()=>{}},particles:{burst:()=>{}}};
    // Exercise the same mining routine called by the live game, over real frames.
    for(let n=0;n<120&&log===BLOCK.WOOD;n++)mineBlock(game,1/60);
    assert.equal(log,BLOCK.AIR);assert.equal(inventory.count(BLOCK.WOOD),1);
    assert.equal(inventory.count('resin'),collectFirst?1:0);
    assert.equal(inventory.count('pebble'),3);
    assert.equal(resin.collect(hit,inventory).ok,false);
  }
  assert.equal(primaryAction('slingshot',{id:BLOCK.STONE}),'shoot');
  assert.equal(primaryAction('slingshot',null),'shoot');
  assert.equal(primaryAction('slingshot',{id:BLOCK.WOOD,distance:4},{distance:2}),'shoot');
  assert.equal(primaryAction('slingshot',{id:BLOCK.WOOD,distance:2},{distance:4}),'mine');
});
