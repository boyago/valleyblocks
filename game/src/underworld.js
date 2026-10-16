import * as THREE from 'three';
import { BLOCK, BLOCKS } from './blocks.js';

/** A deterministic cavern, generated before player edits, with paired gateways. */
export class Underworld {
  constructor(world,state){
    this.world=world;this.enabled=state?.version===1;
    const valid=a=>Array.isArray(a)&&a.length===2&&a.every(n=>Number.isInteger(n)&&Math.abs(n)<900000);
    this.center=valid(state?.center)?[...state.center]:[128,112];
    this.surface=valid(state?.surface)?[...state.surface]:[24,-20];
    if(this.enabled&&!valid(state?.center)){
      while([...world.edits.values()].some(e=>Math.abs(e.x-this.center[0])<=18&&Math.abs(e.z-this.center[1])<=18))this.center[0]+=48;
    }
    if(this.enabled&&!valid(state?.surface)){
      while([...world.edits.values()].some(e=>Math.abs(e.x-this.surface[0])<=4&&Math.abs(e.z-this.surface[1])<=4))this.surface[1]-=16;
    }
  }
  get gates(){const [x,z]=this.surface,[cx,cz]=this.center;return [{x,y:this.world._column(x,z).height+1,z},{x:cx-10,y:5,z:cz-2}];}
  contains(p){return this.enabled&&Math.abs(p.x-this.center[0])<17&&Math.abs(p.z-this.center[1])<17&&p.y<18;}
  apply(put,bx,bz,size){
    if(!this.enabled)return;
    const [cx,cz]=this.center;
    for(let z=Math.max(bz,cz-17);z<=Math.min(bz+size-1,cz+17);z++)for(let x=Math.max(bx,cx-17);x<=Math.min(bx+size-1,cx+17);x++){
      const dx=x-cx,dz=z-cz,r=(dx/17)**2+(dz/17)**2;if(r>1)continue;
      const ceiling=12+Math.floor(2*Math.sin(x*.3)*Math.cos(z*.25));
      const wall=r>.82;
      const pool=!wall&&Math.abs(dz)>2&&dx>-5&&Math.sin(dx*.35)+Math.cos(dz*.4)>.0;
      for(let y=2;y<=ceiling+2;y++){
        let id=y<=4||y>=ceiling||wall?BLOCK.STONE:BLOCK.AIR;
        if(pool&&(y===3||y===4))id=BLOCK.LAVA;
        if(wall&&y>4&&y<9&&(x*17+z*11+y)%23===0)id=BLOCK.CRYSTAL;
        if(y===4&&!pool&&(x*7+z*13)%31===0)id=BLOCK.DIAMOND;
        put(x,y,z,id);
      }
    }
    for(const g of this.gates){
      if(g.x+3<bx||g.x-2>=bx+size||g.z+3<bz||g.z-1>=bz+size)continue;
      for(let dx=-2;dx<=3;dx++)for(let dz=-1;dz<=3;dz++){
        put(g.x+dx,g.y-1,g.z+dz,BLOCK.STONE);
        for(let y=0;y<5;y++)put(g.x+dx,g.y+y,g.z+dz,BLOCK.AIR);
      }
      for(let dx=-1;dx<=2;dx++)for(let y=0;y<=3;y++)put(g.x+dx,g.y+y,g.z,dx===-1||dx===2||y===3?BLOCK.CRYSTAL:BLOCK.PORTAL);
      put(g.x-2,g.y,g.z+2,BLOCK.TORCH);put(g.x+3,g.y,g.z+2,BLOCK.TORCH);
    }
  }
  travel(player,entities){
    const entering=!this.contains(player.position),gate=this.gates[entering?1:0];
    this.world.ensureAround(gate.x,gate.z,1);
    let position=null;
    for(const dz of [2.5,3.5,1.5])for(const dx of [.5,1.5,-.5]){
      const p=new THREE.Vector3(gate.x+dx,gate.y+.002,gate.z+dz);
      if(!player.blocked(p)&&BLOCKS[this.world.getBlock(Math.floor(p.x),gate.y-1,Math.floor(p.z))]?.solid){position=p;break;}
    }
    if(!position)return {ok:false,message:'O destino está bloqueado. Libere a saída do portal.'};
    player.position.copy(position);player.velocity.set(0,0,0);player.yaw=entering?-Math.PI/2:0;player.pitch=-.12;player.flying=false;
    for(const pet of entities.pets)if(pet.tamed&&!pet.vehicleId&&pet.mode!=='stay'){
      const stand=entities.petStand(position.x+1,position.z,position.y);
      if(stand){pet.position.copy(stand);pet.home.copy(stand);pet.path=[];pet.goal=null;}
    }
    return {ok:true,message:entering?'Grutas de Brasa: siga as passagens de pedra. A lava causa dano. Use o portal de entrada para voltar.':'Você voltou à superfície.'};
  }
  serialize(){return {version:this.enabled?1:0,center:[...this.center],surface:[...this.surface]};}
}
