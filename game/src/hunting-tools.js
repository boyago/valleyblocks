import * as THREE from 'three';
import { RANGED } from './tools.js';
import { BLOCK } from './blocks.js';

export class TreeResin {
  constructor(world,saved=[]){this.world=world;this.tapped=new Set(Array.isArray(saved)?saved.filter(k=>typeof k==='string'&&/^-?\d+,-?\d+$/.test(k)):[]);}
  collect(hit,inventory){
    if(!hit||hit.id!==BLOCK.WOOD||this.world.getBlock(hit.x,hit.y,hit.z)!==BLOCK.WOOD)return {ok:false,message:'Aponte para o tronco de uma árvore.'};
    const key=`${hit.x},${hit.z}`;
    if(this.tapped.has(key))return {ok:false,message:'Resina já retirada. Segure o botão esquerdo no tronco para coletar madeira.'};
    if(this.world.edits.has(`${hit.x},${hit.y},${hit.z}`))return {ok:false,message:'Retire resina de árvores naturais, não de madeira colocada.'};
    let leaves=false;
    for(let x=hit.x-3;x<=hit.x+3&&!leaves;x++)for(let z=hit.z-3;z<=hit.z+3&&!leaves;z++)for(let y=hit.y;y<=Math.min(63,hit.y+8);y++)if(this.world.getBlock(x,y,z)===BLOCK.LEAVES){leaves=true;break;}
    if(!leaves)return {ok:false,message:'Procure um tronco de árvore com copa.'};
    if(!inventory.add('resin'))return {ok:false,message:'Não foi possível guardar a resina.'};
    this.tapped.add(key);return {ok:true,message:'Resina retirada! Segure o botão esquerdo no tronco para coletar madeira. Combine as duas na bancada para criar um estilingue.'};
  }
  serialize(){return [...this.tapped];}
}

export class Slingshot {
  constructor(scene,world,wildlife){this.scene=scene;this.world=world;this.wildlife=wildlife;this.shots=[];this.cooldown=0;this.geometry=new THREE.SphereGeometry(.065,6,4);this.material=new THREE.MeshLambertMaterial({color:'#a2adb1'});}
  fire(player,inventory,weapon='slingshot'){
    const spec=RANGED[weapon]||RANGED.slingshot;
    if(this.cooldown>0)return {ok:false,message:''};
    if(!inventory.has(weapon))return {ok:false,message:'Fabrique a arma na bancada.'};
    if(this.shots.length>=8||!inventory.remove(spec.ammo))return {ok:false,message:spec.missing};
    const arrow=weapon==='bow'||weapon==='rifle',position=player.eye.clone(),velocity=player.direction.clone().multiplyScalar(spec.speed);
    const mesh=arrow?new THREE.Mesh(this.arrowGeometry??=new THREE.BoxGeometry(.05,.05,.7),this.arrowMaterial??=new THREE.MeshLambertMaterial({color:'#8e653e'})):new THREE.Mesh(this.geometry,this.material);
    if(arrow)mesh.lookAt(position.clone().add(velocity));
    mesh.position.copy(position);this.scene.add(mesh);this.shots.push({mesh,position,velocity,age:0,damage:spec.damage,gravity:spec.gravity,arrow});this.cooldown=spec.cooldown;
    return {ok:true,message:''};
  }
  update(dt){
    this.cooldown=Math.max(0,this.cooldown-dt);
    for(const s of [...this.shots]){
      s.age+=dt;s.velocity.y-=(s.gravity??12)*dt;
      const movement=s.velocity.clone().multiplyScalar(dt),distance=movement.length(),direction=movement.clone().normalize();
      const wall=this.world.raycast(s.position,direction,distance),prey=this.wildlife.raycast(s.position,direction,distance);
      if(prey&&(!wall||prey.distance<wall.distance)){this.wildlife.strike(prey.animal,s.damage??24,s.position);this.remove(s);}
      else if(wall||s.age>3||s.position.y<0)this.remove(s);
      else{s.position.add(movement);s.mesh.position.copy(s.position);if(s.arrow)s.mesh.lookAt(s.position.clone().add(s.velocity));}
    }
  }
  remove(s){s.mesh.removeFromParent();this.shots.splice(this.shots.indexOf(s),1);}
  dispose(){for(const s of [...this.shots])this.remove(s);this.geometry.dispose();this.material.dispose();this.arrowGeometry?.dispose();this.arrowMaterial?.dispose();}
}
