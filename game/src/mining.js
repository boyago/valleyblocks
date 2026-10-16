import * as THREE from 'three';
import { BLOCK, BLOCKS, PORTAL_IDS } from './blocks.js';
import { miningRequirement, miningSpeed } from './tools.js';

// Trees always offer wood on the primary button, independently of resin on E.
export function primaryAction(item, hit, prey = null) {
  return (item === 'slingshot' || item === 'bow' || item === 'rifle') && (hit?.id !== BLOCK.WOOD || prey && prey.distance < hit.distance) ? 'shoot' : 'mine';
}

export function mineBlock(game, dt) {
  const g=game, hit=g.target;
  if(!g.mining||!hit||g.activeVehicle||primaryAction(g.inventory.selectedItem,hit)==='shoot'){g.miningProgress=0;return;}
  if(PORTAL_IDS.includes(hit.id)){g.mining=false;g.ui.toast('Pressione E para atravessar o portal.');return;}
  if(hit.y<=0||hit.id===BLOCK.WATER||hit.id===BLOCK.LAVA){g.miningProgress=0;return;}
  const key=g.blockKey(hit);if(key!==g.miningKey){g.miningKey=key;g.miningProgress=0;}
  const selected=g.inventory.has(g.inventory.selectedItem)?g.inventory.selectedItem:null;
  const required=miningRequirement(hit.id,selected);
  if(required){g.mining=false;g.miningProgress=0;g.ui.toast(required);return;}
  let duration=BLOCKS[hit.id].hardness||.3;
  duration*=miningSpeed(hit.id,selected);
  if(g.mode==='creative')duration=Math.min(duration,.17);
  const prev=g.miningProgress;g.miningProgress+=dt/Math.max(.12,duration);
  if(Math.floor(prev*4)!==Math.floor(g.miningProgress*4)){g.audio.play('mine',new THREE.Vector3(hit.x,hit.y,hit.z));g.particles.burst(hit.x+.3,hit.y+.3,hit.z+.3,BLOCKS[hit.id].color,3);}
  if(g.miningProgress<1)return;
  if(hit.id===BLOCK.FORGE&&g.forges[key]?.water){g.ui.toast('Retire a água com um balde vazio antes de remover a churrasqueira.');g.mining=false;g.miningProgress=0;return;}
  if(hit.id===BLOCK.CHEST&&Object.values(g.chests[key]||{}).some(n=>n>0)){g.ui.toast('Esvazie o baú antes de removê-lo.');g.mining=false;g.miningProgress=0;return;}
  if(hit.id===BLOCK.DOOR){const y=g.world.getBlock(hit.x,hit.y-1,hit.z)===BLOCK.DOOR?hit.y-1:hit.y;g.world.setBlock(hit.x,y,hit.z,0);g.world.setBlock(hit.x,y+1,hit.z,0);delete g.doors[`${hit.x},${y},${hit.z}`];}
  else g.world.setBlock(hit.x,hit.y,hit.z,0);
  if(hit.id===BLOCK.CHEST)delete g.chests[key];
  if(hit.id===BLOCK.FORGE)delete g.forges[key];
  g.wearTool?.(selected);
  g.inventory.add(hit.id);g.particles.burst(hit.x+.2,hit.y+.2,hit.z+.2,BLOCKS[hit.id].color);g.audio.play('collect');g.goals.mine=true;g.miningProgress=0;g.torchTimer=0;
}
