import * as THREE from 'three';
import { BLOCK, BLOCKS } from './blocks.js';

/** Bounded gravity independent of terrain meshing. Water does not support sand. */
export class SandSimulation {
  constructor(world,state=null) {
    this.world=world;this.pending=new Map();this.falling=[];
    this.geometry=new THREE.BoxGeometry(.98,.98,.98);
    this.material=new THREE.MeshLambertMaterial({color:BLOCKS[BLOCK.SAND].color});
    for(const p of state?.pending||[])if(p.length===3&&p.every(Number.isInteger))this.queue(...p);
    for(const p of state?.falling||[])if(p.length===4&&p.every(Number.isFinite)&&Number.isInteger(p[0])&&Number.isInteger(p[2])&&p[1]>0&&p[1]<64)this.spawn(p[0],p[1],p[2],Math.max(-32,Math.min(0,p[3])));
  }
  queue(x,y,z){if(y>0&&y<64)this.pending.set(`${x},${y},${z}`,[x,y,z]);}
  spawn(x,y,z,velocity=0){
    const mesh=new THREE.Mesh(this.geometry,this.material);mesh.castShadow=true;mesh.receiveShadow=true;
    mesh.position.set(x+.5,y+.5,z+.5);mesh.name='falling-sand';this.world.scene?.add(mesh);
    this.falling.push({x,y,z,velocity,mesh});
  }
  step(dt){
    let work=0,active=this.falling.filter(p=>this.world._peekBlock(p.x,Math.floor(p.y),p.z)!==null).length;
    for(const [key,[x,y,z]] of this.pending){
      if(work++>=96||active>=128)break;
      // Keep unloaded work until the player revisits; never generate chunks.
      if(this.world._peekBlock(x,y,z)===null){this.pending.delete(key);continue;}
      this.pending.delete(key);
      if(this.world._peekBlock(x,y,z)!==BLOCK.SAND)continue;
      const below=this.world._peekBlock(x,y-1,z);
      if(below===null||BLOCKS[below]?.solid)continue;
      this.world.setBlock(x,y,z,BLOCK.AIR);this.spawn(x,y,z);active++;
    }
    const ordered=[...this.falling].sort((a,b)=>a.y-b.y);
    for(const grain of ordered){
      const {x,z}=grain;
      if(this.world._peekBlock(x,Math.floor(grain.y),z)===null){grain.mesh.visible=false;continue;}
      grain.mesh.visible=true;
      const wet=this.world._peekBlock(x,Math.floor(grain.y+.3),z)===BLOCK.WATER;
      grain.velocity=Math.max(wet?-3:-32,grain.velocity-(wet?5:22)*Math.min(dt,.1));
      const next=grain.y+grain.velocity*Math.min(dt,.1);
      let landing=null;
      for(let y=Math.floor(grain.y);y>=Math.max(0,Math.floor(next)-1);y--){
        if(BLOCKS[this.world._peekBlock(x,y,z)]?.solid && y+1>=next && y+1<=grain.y+.01){landing=y+1;break;}
      }
      if(landing!==null){
        if(this.blocked?.(x,landing,z)){grain.velocity=0;grain.y=landing;continue;}
        if(this.world.setBlock(x,landing,z,BLOCK.SAND)){
          this.world.scene?.remove(grain.mesh);this.falling.splice(this.falling.indexOf(grain),1);continue;
        }
        grain.velocity=0;
      }else {
        const lower=this.falling.filter(p=>p!==grain&&p.x===x&&p.z===z&&p.y<grain.y).reduce((height,p)=>Math.max(height,p.y+1),-Infinity);
        grain.y=Math.max(next,lower);if(grain.y>next)grain.velocity=0;
      }
      grain.mesh.position.set(x+.5,grain.y+.5,z+.5);
    }
  }
  intersects(x,y,z){return this.falling.some(p=>p.x===x&&p.z===z&&p.y<y+1&&p.y+1>y);}
  serialize(){return {pending:[...this.pending.values()],falling:this.falling.map(p=>[p.x,p.y,p.z,p.velocity])};}
  dispose(){for(const p of this.falling)this.world.scene?.remove(p.mesh);this.geometry.dispose();this.material.dispose();this.falling=[];this.pending.clear();}
}
