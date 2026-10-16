import test from 'node:test';
import assert from 'node:assert/strict';
import { Inventory, ITEMS, craft } from '../src/inventory.js';
import { BLOCK } from '../src/blocks.js';
import { TOOLS, MINING_TIERS, miningRequirement, miningSpeed } from '../src/tools.js';
import { mineBlock } from '../src/mining.js';
import { heatMaterial } from '../src/interactions.js';

function mine(inventory,id,tool=null,mode=inventory.mode){
  let block=id;
  const messages=[];
  inventory.hotbar[0]=tool;inventory.select(0);
  const game={inventory,mode,target:{x:0,y:20,z:0,id},mining:true,miningProgress:0,goals:{},
    world:{setBlock:(x,y,z,value)=>{block=value;}},blockKey:()=> '0,20,0',
    ui:{toast:m=>messages.push(m)},particles:{burst:()=>{}},audio:{play:()=>{}}};
  for(let n=0;n<300&&block===id;n++)mineBlock(game,1/60);
  return {block,messages};
}

test('hands, axes and insufficient or missing pickaxes cannot destroy or collect rock and ores in either mode',()=>{
  for(const mode of ['survival','creative'])for(const [block,tier] of Object.entries(MINING_TIERS)){
    for(const tool of [null,'bucket',...Object.keys(TOOLS)]){
      const inv=new Inventory(mode);if(tool)inv.add(tool);
      const allowed=TOOLS[tool]?.kind==='pickaxe'&&TOOLS[tool].tier>=tier;
      const result=mine(inv,Number(block),tool);
      assert.equal(result.block,allowed?0:Number(block),`${mode}: ${block} / ${tool}`);
      assert.equal(inv.has(block),allowed);
      assert.equal(result.messages.length,allowed?0:1);
    }
    const inv=new Inventory(mode);
    assert.equal(mine(inv,Number(block),'diamond_pickaxe').block,Number(block),'empty shortcut is not a tool');
  }
});

test('empty survival inventory progresses through wood, stone, smelting, iron and diamond without injected minerals',()=>{
  const inv=new Inventory('survival');
  assert.deepEqual(inv.counts,{});assert.ok(inv.hotbar.every(id=>id===null));
  const make=(id,bench=false)=>assert.equal(craft(id,inv,bench).ok,true,id);
  const dig=(block,tool,count=1)=>{for(let i=0;i<count;i++)assert.equal(mine(inv,block,tool).block,0);};
  dig(BLOCK.WOOD,null,12);
  for(let i=0;i<10;i++)make('planks');
  make('wooden_pickaxe');dig(BLOCK.STONE,'wooden_pickaxe',8);dig(BLOCK.COAL,'wooden_pickaxe',3);
  make('pickaxe');dig(BLOCK.ORE,'pickaxe',5);
  dig(BLOCK.DIRT,null,4);make('brick');make('brick');make('workbench');make('forge',true);
  assert.equal(craft('iron_pickaxe',inv,true).ok,false,'raw iron cannot make an iron tool');
  for(let i=0;i<3;i++)assert.equal(heatMaterial('iron',inv,{water:0}).ok,true);
  assert.equal(inv.count('iron_ingot'),3);
  assert.equal(craft('iron_pickaxe',inv,false).ok,false,'advanced tools require a workbench');
  make('iron_pickaxe',true);assert.equal(inv.count('iron_ingot'),0);
  dig(BLOCK.STONE,'iron_pickaxe');dig(BLOCK.DIAMOND,'iron_pickaxe',6);
  make('diamond_pickaxe',true);make('diamond_axe',true);
  for(const block of Object.keys(MINING_TIERS))dig(Number(block),'diamond_pickaxe');
  assert.equal(miningRequirement(BLOCK.ORE,'diamond_axe').length>0,true);
  assert.ok(miningSpeed(BLOCK.WOOD,'diamond_axe')<miningSpeed(BLOCK.WOOD,'axe'));
});

test('tool tiers survive saves and original tool IDs retain stone-tier inventory and shortcuts',()=>{
  const inv=new Inventory('survival');
  for(const id of Object.keys(TOOLS))inv.add(id);
  inv.hotbar=Object.keys(TOOLS).concat(null).slice(0,9);
  const restored=new Inventory('survival',JSON.parse(JSON.stringify(inv.serialize())));
  assert.deepEqual(restored.serialize(),inv.serialize());
  assert.equal(ITEMS.pickaxe.name,'Picareta de pedra');
  assert.equal(ITEMS.axe.name,'Machado de pedra');
  assert.ok(miningRequirement(BLOCK.DIAMOND,'pickaxe'));
  for(const mode of ['survival','creative'])assert.deepEqual(new Inventory(mode).counts,{});
});
