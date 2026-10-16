import * as THREE from 'three';
import { BLOCK } from './blocks.js';
import { isEnemyTime } from './enemies.js';

const cube=new THREE.BoxGeometry(1,1,1).toNonIndexed();
const shapes=(id,on,left,right)=>id===BLOCK.SOFA?[
  [[1,.23,.82],[.5,.28,.5],'#284e4e'],
  [[.94,.2,.63],[.5,.49,.4],'#65a39a'],
  [[1,.55,.18],[.5,.64,.84],'#417970'],
  ...left?[]:[[[.12,.37,.84],[.06,.49,.5],'#417970']],
  ...right?[]:[[[.12,.37,.84],[.94,.49,.5],'#417970']],
  ...[.16,.84].flatMap(x=>[.19,.8].map(z=>[[.1,.18,.1],[x,.09,z],'#735038'])),
]:[
  [[.92,.09,.64],[.5,.12,.5],'#926b45'],
  ...[.15,.85].map(x=>[[.08,.16,.55],[x,.08,.5],'#604938']),
  [[.12,.2,.12],[.5,.27,.5],'#273742'],
  [[.93,.61,.13],[.5,.64,.5],'#273742'],
  [[.79,.45,.015],[.5,.65,.576],on?'#62a3b0':'#101c28'],
  ...on?[
    [[.79,.12,.018],[.5,.48,.589],'#497950'],
    [[.22,.2,.019],[.3,.59,.59],'#54865c'],
    [[.12,.12,.02],[.72,.78,.591],'#ffe395'],
    [[.19,.07,.02],[.44,.77,.591],'#e8f5e6'],
  ]:[],
  [[.025,.025,.02],[.85,.38,.58],on?'#85e275':'#d75a4e'],
];

/** Furniture stays inside its voxel and shares the chunk's vertex-color material. */
export function appendFurniture(group,id,x,y,z,on=false,left=false,right=false){
  for(const [size,pos,color] of shapes(id,on,left,right)){
    const c=new THREE.Color(color),p=cube.attributes.position,n=cube.attributes.normal,offset=group.positions.length/3;
    for(let i=0;i<p.count;i++){
      group.positions.push(x+pos[0]+p.getX(i)*size[0],y+pos[1]+p.getY(i)*size[1],z+pos[2]+p.getZ(i)*size[2]);
      group.normals.push(n.getX(i),n.getY(i),n.getZ(i));group.colors.push(c.r,c.g,c.b);group.uvs.push(0,0);group.indices.push(offset+i);
    }
  }
}

export function restEligibility(game,hit){
  if(!hit||game.activeVehicle||game.world.getBlock(hit.x,hit.y,hit.z)!==BLOCK.SOFA||game.player.position.distanceTo(new THREE.Vector3(hit.x+.5,hit.y,hit.z+.5))>5)return 'Aproxime-se do sofá para descansar.';
  if(!isEnemyTime(game.time))return 'Você pode passar a noite no sofá a partir das 17h30.';
  if(game.enemies.enemies.some(e=>e.position.distanceTo(game.player.position)<10))return 'Há inimigos perto demais. Afaste-os antes de descansar.';
  return '';
}
export function completeRest(game,hit){
  const message=restEligibility(game,hit);if(message)return {ok:false,message};
  game.time=6.5/24;game.player.stamina=100;game.player.exhausted=false;game.player.panting=0;
  if(game.mode==='survival')game.player.hunger=Math.max(0,game.player.hunger-8);
  game.enemies.update(0,game.player,game.time,game.mode);
  return {ok:true,message:'Bom dia! Energia recuperada. São 6h30; lembre-se de comer.'};
}
