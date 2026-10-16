import * as THREE from 'three';
import { BLOCK } from './blocks.js';
import { FOODS } from './survival.js';
import { petHealth, hurtPet } from './pet-health.js';

export const PESTS=Object.freeze({
  rat:{name:'Rato',health:12,speed:1.15,height:.38,radius:.2},
  scorpion:{name:'Escorpião',health:16,speed:.65,height:.48,radius:.25},
  spider:{name:'Aranha',health:14,speed:.9,height:.35,radius:.3},
  snake:{name:'Cobra',health:20,speed:.8,height:.35,radius:.3},
});
const foods=Object.keys(FOODS),chewable=new Set([BLOCK.WOOD,BLOCK.PLANKS,BLOCK.DIRT]);
const validPosition=p=>Array.isArray(p)&&p.length===3&&p.every(n=>Number.isFinite(n)&&Math.abs(n)<1000000);
const lift=(p,y=.25)=>p.clone().add(new THREE.Vector3(0,y,0));
const limit=(n,fallback,max)=>Number.isFinite(n)?Math.max(0,Math.min(n,max)):fallback;
export const pestRoll=r=>r<.55?'rat':r<.59?'scorpion':r<.63?'spider':r<.67?'snake':null;

/** Small pests, limited theft and burrowing, and cats that defend their chosen area. */
export class PestSystem{
  constructor(entities,inventory,saved=null){
    this.entities=entities;this.world=entities.world;this.scene=entities.scene;this.inventory=inventory;
    this.animals=[];this.clock=0;this.spawnTimer=limit(saved?.spawnTimer,25,45);this.burrowCooldown=limit(saved?.burrowCooldown,0,120);
    this.randomState=Number.isInteger(saved?.randomState)?saved.randomState>>>0:(this.world.seedHash^0x274abe)>>>0;
    this.geometry=new THREE.BoxGeometry(1,1,1);this.materials=new Map();
    for(const p of (Array.isArray(saved?.animals)?saved.animals:[]).slice(0,6))if(PESTS[p.type]&&validPosition(p.position)&&p.health>0)this.spawn(p.type,new THREE.Vector3(...p.position),p);
  }
  random(){this.randomState=(Math.imul(this.randomState,1664525)+1013904223)>>>0;return this.randomState/4294967296;}
  box(parent,size,pos,color){
    if(!this.materials.has(color))this.materials.set(color,new THREE.MeshLambertMaterial({color}));
    const mesh=new THREE.Mesh(this.geometry,this.materials.get(color));mesh.scale.set(...size);mesh.position.set(...pos);mesh.castShadow=true;parent.add(mesh);return mesh;
  }
  spawn(type,position,state={}){
    const spec=PESTS[type];if(!spec||this.animals.length>=6)return null;
    const mesh=new THREE.Group(),body=new THREE.Group();mesh.add(body);mesh.name=`pest:${type}`;const limbs=[];
    if(type==='rat'){
      this.box(body,[.28,.23,.46],[0,.2,0],'#827366');this.box(body,[.22,.2,.23],[0,.23,.29],'#a08e7d');
      for(const s of [-1,1]){this.box(body,[.13,.16,.065],[s*.12,.35,.22],'#c4988f');this.box(body,[.035,.04,.025],[s*.08,.27,.413],'#172323');}
      this.box(body,[.07,.06,.06],[0,.2,.43],'#d28f8b');
      for(let i=0;i<4;i++)limbs.push(this.box(body,[.045,.045,.16],[Math.sin(i)*.07,.13,-.27-i*.12],'#bb8e87'));
    }else if(type==='snake'){
      for(let i=0;i<6;i++)limbs.push(this.box(body,[.18-i*.015,.16-i*.012,.2],[0,.14,.35-i*.17],i%2?'#56643a':'#8d9c50'));
      this.box(body,[.22,.18,.23],[0,.18,.48],'#6f8743');
      for(const s of [-1,1])this.box(body,[.035,.035,.025],[s*.08,.21,.602],'#edda7b');
      this.box(body,[.025,.025,.14],[0,.13,.64],'#af4b50');
    }else{
      const spider=type==='spider',color=spider?'#504452':'#b38b52';
      this.box(body,[.32,.22,.4],[0,.18,-.08],color);this.box(body,[.23,.19,.23],[0,.17,.22],color);
      for(const s of [-1,1]){
        this.box(body,[.045,.05,.03],[s*.07,.21,.35],spider?'#df6557':'#263129');
        for(let i=0;i<4;i++){const leg=this.box(body,[.35,.055,.055],[s*.27,.11,-.23+i*.16],color);leg.rotation.z=s*.3;leg.rotation.y=s*(i-1.5)*.25;limbs.push(leg);}
      }
      if(!spider){
        for(const s of [-1,1]){this.box(body,[.09,.07,.21],[s*.22,.16,.39],color);this.box(body,[.14,.09,.1],[s*.23,.17,.52],color);}
        for(let i=0;i<4;i++)this.box(body,[.07,.1,.1],[0,.2+i*.085,-.32-i*.035],color);
        this.box(body,[.055,.07,.1],[0,.43,-.33],'#574337');
      }
    }
    const p={type,mesh,body,limbs,position:position.clone(),home:validPosition(state.home)?new THREE.Vector3(...state.home):position.clone(),health:Math.min(spec.health,state.health??spec.health),
      yaw:Number.isFinite(state.yaw)?state.yaw:0,cooldown:limit(state.cooldown,0,30),holes:limit(state.holes,0,1),digTime:0,digKey:'',goal:null,wander:0,
      stolen:foods.includes(state.stolen)?state.stolen:null};
    mesh.position.copy(position);mesh.rotation.y=p.yaw;this.scene.add(mesh);this.animals.push(p);return p;
  }
  visible(from,to,allowed=null){const delta=to.clone().sub(from),distance=delta.length();if(distance<.001)return true;const h=this.world.raycast(from,delta.normalize(),distance);return !h||h.distance>=distance-.05||allowed&&h.x===allowed.x&&h.y===allowed.y&&h.z===allowed.z;}
  raycast(origin,direction,maxDistance=3.6){
    const ray=new THREE.Ray(origin,direction.clone().normalize());let nearest=null;
    for(const animal of this.animals){const p=animal.position,s=PESTS[animal.type];
      const hit=ray.intersectBox(new THREE.Box3(new THREE.Vector3(p.x-s.radius,p.y,p.z-s.radius),new THREE.Vector3(p.x+s.radius,p.y+s.height,p.z+s.radius)),new THREE.Vector3());
      if(!hit)continue;const distance=hit.distanceTo(origin);
      if(distance<=maxDistance&&(!nearest||distance<nearest.distance)&&this.visible(origin,hit))nearest={animal,distance};
    }return nearest;
  }
  remove(p){p.mesh.removeFromParent();this.animals.splice(this.animals.indexOf(p),1);}
  strike(p,damage){
    if(!this.animals.includes(p)||!Number.isFinite(damage)||damage<=0)return false;
    p.health-=damage;
    if(p.health<=0){
      if(p.stolen&&!this.inventory.add(p.stolen)){p.health=1;return false;}
      if(p.stolen)this.onEvent?.('A comida roubada pelo rato voltou para sua mochila.');
      this.remove(p);
    }return true;
  }
  command(cat){
    if(cat?.type!=='cat'||!cat.tamed)return 'Faça amizade com o gato antes de pedir proteção.';
    if(cat.vehicleId)return 'Desembarque o gato antes de proteger a casa.';
    if(petHealth(cat.health)<=25)return 'Alimente o gato para que ele recupere forças.';
    cat.mode='guard';cat.guardAnchor=cat.position.clone();cat.path.length=0;cat.routeAge=2;
    return `${cat.name} vai proteger este local de ratos, escorpiões, aranhas e cobras.`;
  }
  cats(dt,player){
    for(const cat of this.entities.pets){
      if(cat.type!=='cat')continue;cat.pestGoal=false;cat.pestCooldown=Math.max(0,(cat.pestCooldown||0)-dt);
      if(!cat.tamed||cat.vehicleId||cat.mode==='stay'||petHealth(cat.health)<=25)continue;
      const anchor=cat.mode==='guard'?(cat.guardAnchor||cat.position):player;
      if(cat.position.distanceTo(player)>48){cat.goal=null;cat.path.length=0;continue;}
      const prey=this.animals.filter(p=>p.position.distanceTo(anchor)<12&&p.position.distanceTo(cat.position)<16).sort((a,b)=>a.position.distanceToSquared(cat.position)-b.position.distanceToSquared(cat.position))[0];
      if(!prey){if(cat.mode==='guard')cat.goal=cat.position.distanceTo(anchor)>1?anchor.clone():null;continue;}
      cat.pestGoal=true;cat.goal=prey.position.clone();
      if(cat.position.distanceTo(prey.position)<1.65&&cat.pestCooldown===0&&this.visible(lift(cat.position,.55),lift(prey.position,.2))){
        this.strike(prey,14);cat.pestCooldown=.7;cat.affection=1;
        this.entities.audio?.play?.('meow',cat.position);
        if(!this.animals.includes(prey))this.onEvent?.(`${cat.name} eliminou ${PESTS[prey.type].name.toLowerCase()}.`);
      }
    }
  }
  foodTarget(p,player,chests){
    const targets=[];
    if(foods.some(id=>this.inventory.has(id)))targets.push({position:player.clone(),inventory:true});
    for(const [key,items] of Object.entries(chests)){
      if(!foods.some(id=>Number.isSafeInteger(items[id])&&items[id]>0))continue;
      const [x,y,z]=key.split(',').map(Number);if(![x,y,z].every(Number.isFinite)||Math.hypot(x-p.position.x,z-p.position.z)>20)continue;
      if(this.world.getBlock(x,y,z)===BLOCK.CHEST)targets.push({position:new THREE.Vector3(x+.5,y,z+.5),items,x,y,z});
    }
    return targets.filter(t=>t.position.distanceTo(p.position)<20).sort((a,b)=>a.position.distanceToSquared(p.position)-b.position.distanceToSquared(p.position))[0]||null;
  }
  steal(p,target,mode){
    if(mode!=='survival'||p.stolen||p.cooldown>0||!target||p.position.distanceTo(target.position)>1.4||!this.visible(lift(p.position),lift(target.position),target.inventory?null:target))return false;
    const item=foods.find(id=>target.inventory?this.inventory.has(id):Number.isSafeInteger(target.items[id])&&target.items[id]>0);if(!item)return false;
    if(target.inventory){if(!this.inventory.remove(item))return false;}else{target.items[item]--;if(!target.items[item])delete target.items[item];}
    p.stolen=item;p.cooldown=30;this.onEvent?.('Um rato roubou uma comida! Seu gato pode recuperá-la.');return true;
  }
  dig(p,target,dt,mode){
    if(mode!=='survival'||p.type!=='rat'||p.holes>=1||p.stolen||this.burrowCooldown>0||!target){p.digTime=0;return false;}
    const from=lift(p.position,.22),to=lift(target.position,.22),direction=to.sub(from);direction.y=0;
    const h=this.world.raycast(from,direction.normalize(),.8);
    if(!h||!chewable.has(h.id)||Math.abs(h.normal.y)>.1||h.y!==Math.floor(p.position.y)||!this.world.isSolid(h.x,h.y+1,h.z)){p.digTime=0;return false;}
    const key=`${h.x},${h.y},${h.z}`;if(p.digKey!==key){p.digKey=key;p.digTime=0;}p.digTime+=dt;
    if(p.digTime<5)return false;
    if(!this.world.setBlock(h.x,h.y,h.z,BLOCK.AIR))return false;
    p.holes++;p.digTime=0;this.burrowCooldown=120;this.onEvent?.('Um rato roeu um bloco da parede. Traga um gato para proteger a casa!');return true;
  }
  trySpawn(player){
    const type=pestRoll(this.random());if(!type||this.animals.length>=6||type!=='rat'&&this.animals.filter(p=>p.type!=='rat').length>=2||type==='rat'&&this.animals.filter(p=>p.type==='rat').length>=4)return;
    for(let i=0;i<8;i++){
      const a=this.random()*Math.PI*2,r=12+this.random()*9,x=player.x+Math.cos(a)*r,z=player.z+Math.sin(a)*r;
      if(!this.world.chunks.has(`${Math.floor(x/16)},${Math.floor(z/16)}`))continue;
      const y=this.world.heightAt(x,z);if(y===null)continue;
      if(![BLOCK.GRASS,BLOCK.DIRT,BLOCK.STONE,BLOCK.SAND,BLOCK.CLAY,BLOCK.SNOW].includes(this.world.getBlock(x,y-1,z)))continue;
      const point=this.entities.safeStand(x,z,y,.5,.25,.1,.1);
      if(point&&![BLOCK.WATER,BLOCK.LAVA].includes(this.world.getBlock(x,y,z))){this.spawn(type,point);break;}
    }
  }
  update(dt,player,chests,mode){
    this.clock+=dt;this.spawnTimer-=dt;this.burrowCooldown=Math.max(0,this.burrowCooldown-dt);
    if(this.spawnTimer<=0){this.spawnTimer=45;for(const p of [...this.animals])if(!p.stolen&&p.position.distanceTo(player.position)>90)this.remove(p);this.trySpawn(player.position);}
    for(const p of this.animals){
      p.mesh.visible=p.position.distanceTo(player.position)<48;if(!p.mesh.visible)continue;
      p.cooldown=Math.max(0,p.cooldown-dt);p.wander-=dt;
      const target=p.type==='rat'&&!p.stolen?this.foodTarget(p,player.position,chests):null;
      if(p.type==='rat'&&target)this.steal(p,target,mode);
      if(p.stolen)p.goal=p.home.clone();else if(target)p.goal=target.position.clone();
      else if(p.wander<=0){p.wander=4;const a=this.random()*Math.PI*2;p.goal=p.home.clone().add(new THREE.Vector3(Math.cos(a)*3,0,Math.sin(a)*3));}
      if(p.type!=='rat'&&mode==='survival'&&p.cooldown===0){
        const cat=this.entities.pets.find(c=>c.type==='cat'&&c.pestGoal&&c.position.distanceTo(p.position)<1.1);
        if(cat&&this.visible(lift(p.position),lift(cat.position,.4))){hurtPet(cat,3);p.cooldown=1.5;}
        else if(p.position.distanceTo(player.position)<.9&&this.visible(lift(p.position),lift(player.position,.4))){player.health=Math.max(0,player.health-(p.type==='snake'?6:3));p.cooldown=1.5;}
      }
      let moving=false;
      if(p.goal){const delta=p.goal.clone().sub(p.position).setY(0),distance=delta.length();
        if(distance>.25){delta.normalize().multiplyScalar(Math.min(distance,dt*PESTS[p.type].speed));
          const next=this.entities.safeStand(p.position.x+delta.x,p.position.z+delta.z,p.position.y,PESTS[p.type].height,PESTS[p.type].radius,.55,1.1);
          if(next&&![BLOCK.WATER,BLOCK.LAVA].includes(this.world.getBlock(next.x,next.y,next.z))&&!this.entities.vehicles.some(v=>this.entities.pointInsideVehicle(next,v,.2))){p.position.copy(next);moving=true;p.digTime=0;}
          else if(target)this.dig(p,target,dt,mode);
          p.yaw=Math.atan2(delta.x,delta.z);
        }
      }
      const floor=this.world.heightAt(p.position.x,p.position.z,p.position.y+.05);if(floor!==null&&floor<p.position.y-.05)p.position.y=Math.max(floor,p.position.y-dt*4);
      p.limbs.forEach((l,i)=>{if(p.type==='snake')l.position.x=Math.sin(this.clock*8+i)*.07;else l.rotation.y=moving?Math.sin(this.clock*14+i)*.2:0;});
      p.mesh.position.copy(p.position);p.mesh.rotation.y=p.yaw;
    }
    this.cats(dt,player.position);
  }
  blocksPlacement(x,y,z){return this.animals.some(p=>{const s=PESTS[p.type],v=p.position;return x<v.x+s.radius&&x+1>v.x-s.radius&&z<v.z+s.radius&&z+1>v.z-s.radius&&y<v.y+s.height&&y+1>v.y;});}
  serialize(){return {randomState:this.randomState,spawnTimer:this.spawnTimer,burrowCooldown:this.burrowCooldown,animals:this.animals.map(p=>({type:p.type,position:p.position.toArray(),home:p.home.toArray(),health:p.health,yaw:p.yaw,cooldown:p.cooldown,holes:p.holes,stolen:p.stolen}))};}
  dispose(){for(const p of [...this.animals])this.remove(p);this.geometry.dispose();for(const m of this.materials.values())m.dispose();}
}
