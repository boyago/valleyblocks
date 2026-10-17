import * as THREE from 'three';
import { REALMS } from './realms.js';
import { petHealth, hurtPet } from './pet-health.js';
import vendorModels from './assets/vendor-models.json' with { type: 'json' };

/** Malhas do vendedor feitas no Blender (assets/blender/create_vendor.py). */
const vendorGeometry=Object.fromEntries(Object.entries(vendorModels).map(([k,s])=>{const g=new THREE.BufferGeometry();for(const [n,v] of [['position',s.positions],['normal',s.normals],['color',s.colors]])g.setAttribute(n,new THREE.Float32BufferAttribute(v,3));g.computeBoundingSphere();return [k,g];}));
const VENDOR_SHIRTS=['#e63946','#ffd166','#2a9d8f'];
const vendorMaterial=new THREE.MeshLambertMaterial({vertexColors:true});

export const SPECIES=Object.freeze({
  chicken:{name:'Galinha',health:18,speed:1.8,drop:'raw_chicken',count:1,radius:.3,height:.95},
  rabbit:{name:'Coelho',health:16,speed:2.4,drop:'raw_rabbit',count:1,radius:.3,height:1.05},
  // Decorativa: passeia pelo cenário, não ataca e não pode ser caçada.
  mico:{name:'Mico-leão-dourado',health:18,speed:2.8,drop:null,count:0,radius:.22,height:.5,scenery:true},
  pombo:{name:'Pombo',health:10,speed:2,drop:null,count:0,radius:.18,height:.35,scenery:true},
  esquilo:{name:'Esquilo',health:12,speed:3,drop:null,count:0,radius:.18,height:.4,scenery:true},
  quati:{name:'Quati',health:20,speed:2.6,drop:null,count:0,radius:.3,height:.6,scenery:true},
  vendedor:{name:'Vendedor de rua',health:40,speed:1.1,drop:null,count:0,radius:.3,height:1.7,scenery:true},
  turista:{name:'Turista',health:40,speed:1.2,drop:null,count:0,radius:.3,height:1.7,scenery:true},
  salamandra:{name:'Salamandra de fogo',health:20,speed:2.4,drop:null,count:0,radius:.25,height:.35,scenery:true},
  panda:{name:'Panda',health:60,speed:1.2,drop:null,count:0,radius:.45,height:1.1,scenery:true},
  macaco:{name:'Macaco-da-neve',health:30,speed:2.4,drop:null,count:0,radius:.3,height:.8,scenery:true},
  bisao:{name:'Bisão',health:90,speed:1.6,drop:null,count:0,radius:.55,height:1.5,scenery:true},
  onca:{name:'Onça-pintada',health:70,speed:2.2,drop:null,count:0,radius:.45,height:1.05,scenery:true},
  capivara:{name:'Capivara',health:30,speed:1.9,drop:'raw_capivara',count:2,radius:.4,height:.8},
  calango:{name:'Calango',health:10,speed:3.2,drop:'raw_calango',count:1,radius:.25,height:.35},
  boar:{name:'Javali',health:48,speed:2.1,drop:'raw_boar',count:3,radius:.45,height:1.1},
});
const goodPosition=p=>Array.isArray(p)&&p.length===3&&p.every(n=>Number.isFinite(n)&&Math.abs(n)<1000000);
const rawItems=new Set(Object.values(SPECIES).map(s=>s.drop).filter(Boolean));

/** Small, bounded population; dogs use the existing collision-aware pet routes. */
export class Wildlife {
  constructor(entities,saved=null){
    this.entities=entities;this.world=entities.world;this.scene=entities.scene;
    this.animals=[];this.drops=[];this.serial=Number.isSafeInteger(saved?.serial)?Math.max(0,saved.serial):0;
    this.clock=0;this.spawnTimer=Number.isFinite(saved?.spawnTimer)?Math.max(0,Math.min(30,saved.spawnTimer)):20;
    this.randomState=Number.isInteger(saved?.randomState)?saved.randomState>>>0:this.world.seedHash;
    this.geometry=new THREE.BoxGeometry(1,1,1);this.materials=new Map();this.carryMeshes=new Map();
    if(Array.isArray(saved?.animals)){
      for(const a of saved.animals.slice(0,32))if(SPECIES[a.type]&&goodPosition(a.position)&&Number.isFinite(a.health)&&a.health>0){
        this.spawn(a.type,new THREE.Vector3(...a.position),a);
      }
      for(const d of (saved.drops||[]).slice(0,64))if(rawItems.has(d.item)&&goodPosition(d.position)&&Number.isSafeInteger(d.count)&&d.count>0&&d.count<=3)this.addDrop(d.item,d.count,new THREE.Vector3(...d.position));
    }else{
      for(const [type,x,z] of [['chicken',-13,18],['chicken',-11,20],['rabbit',18,18],['rabbit',21,15],['boar',-22,23],['boar',22,-17]]){
        const p=this.spawnPoint(x+.5,z+.5);if(p)this.spawn(type,p);
      }
    }
  }
  random(){this.randomState=(Math.imul(1664525,this.randomState)+1013904223)>>>0;return this.randomState/4294967296;}
  box(parent,size,position,color){
    if(!this.materials.has(color))this.materials.set(color,new THREE.MeshLambertMaterial({color}));
    const m=new THREE.Mesh(this.geometry,this.materials.get(color));m.scale.set(...size);m.position.set(...position);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
  }
  spawnPoint(x,z,maxY){
    const y=this.world.heightAt(x,z,maxY);if(y===null)return null;
    if(this.world.getBlock(x,y,z)===9)return null;
    return this.entities.petStand(x,z,y);
  }
  spawn(type,position,saved={}){
    const spec=SPECIES[type];if(!spec||this.animals.length>=32)return null;
    const mesh=new THREE.Group(),body=new THREE.Group();mesh.add(body);
    if(['panda','macaco','bisao','quati','vendedor','turista','salamandra','mico','pombo','esquilo'].includes(type)){
      const legs=[],box=(sz,p,c)=>this.box(body,sz,p,c);
      if(type==='mico'){
        box([.22,.24,.36],[0,.3,0],'#f2a32a');box([.3,.28,.26],[0,.48,.2],'#f7b53c');box([.14,.12,.06],[0,.44,.34],'#5a3a24');
        const tail=box([.06,.06,.45],[0,.3,-.38],'#e08f1f');tail.rotation.x=.6;
        for(const s2 of [-1,1])for(const e of [-1,1])legs.push(box([.06,.18,.06],[s2*.08,.09,e*.12],'#c47a1a'));
      }else if(type==='pombo'){
        box([.16,.16,.28],[0,.18,0],'#8a8f99');box([.12,.12,.12],[0,.3,.13],'#6a7a8a');box([.04,.03,.06],[0,.29,.21],'#d9a441');box([.1,.04,.14],[0,.16,-.18],'#5a606a');
        for(const s2 of [-1,1]){box([.03,.12,.2],[s2*.09,.2,0],'#757a84');legs.push(box([.02,.08,.02],[s2*.04,.04,0],'#d97a6a'));}
      }else if(type==='esquilo'){
        box([.16,.18,.28],[0,.18,0],'#9a5a2a');box([.14,.14,.14],[0,.3,.14],'#a8673a');const tail=box([.12,.32,.1],[0,.32,-.17],'#b0703f');tail.rotation.x=-.3;
        for(const s2 of [-1,1])for(const e of [-1,1])legs.push(box([.04,.1,.05],[s2*.06,.05,e*.09],'#7a4520'));
      }else if(type==='quati'){
        box([.3,.28,.6],[0,.32,0],'#8a5a34');box([.22,.2,.26],[0,.4,.38],'#8a5a34');box([.1,.1,.2],[0,.36,.58],'#5a3a22');
        for(let i=0;i<5;i++)box([.1,.1,.12],[0,.42+i*.06,-.38-i*.08],i%2?'#3a2616':'#c49a6c');
        for(const s2 of [-1,1])for(const e of [-1,1])legs.push(box([.08,.2,.08],[s2*.1,.1,e*.2],'#3a2616'));
      }else if(type==='salamandra'){
        box([.2,.1,.5],[0,.08,0],'#ff6a1a');box([.16,.1,.18],[0,.1,.32],'#ffb238');const tail=box([.07,.06,.45],[0,.06,-.45],'#ff5a10');tail.rotation.y=.25;
        for(const s2 of [-1,1])for(const e of [-1,1])legs.push(box([.05,.07,.05],[s2*.13,.03,e*.16],'#c03a0a'));
      }else if(type==='vendedor'){
        const n=this.serial+1,add=(g,m,p=[0,0,0])=>{const x=new THREE.Mesh(g,m);x.position.set(...p);x.castShadow=true;x.receiveShadow=true;body.add(x);return x;};
        add(vendorGeometry.body,vendorMaterial);add(vendorGeometry.shirt,new THREE.MeshLambertMaterial({vertexColors:true,color:VENDOR_SHIRTS[n%3]}));
        for(const s2 of [-1,1])legs.push(add(vendorGeometry.leg,vendorMaterial,[s2*.12,.75,0]));
      }else if(type==='turista'){
        const shirt='#4cc9f0';
        box([.5,.6,.3],[0,1.05,0],shirt);box([.38,.38,.36],[0,1.55,0],'#c48e6b');
        box([.42,.1,.4],[0,1.78,0],type==='vendedor'?'#1d3557':'#f1e3b5');if(type==='vendedor')box([.5,.08,.2],[0,1.75,.22],'#1d3557');
        if(type==='vendedor'){box([.6,.18,.34],[0,1.0,.36],'#a46f3c');for(let i=0;i<3;i++)box([.14,.1,.14],[-.18+i*.18,1.14,.36],['#ffd166','#06d6a0','#ef476f'][i]);}
        else box([.16,.12,.08],[0,1.2,.2],'#222');
        for(const s2 of [-1,1]){box([.15,.55,.18],[s2*.33,1.0,0],shirt);legs.push(box([.18,.75,.2],[s2*.12,.38,0],type==='vendedor'?'#264653':'#e9c46a'));}
      }else if(type==='panda'){
        box([.62,.55,.85],[0,.6,0],'#f2f0ea');box([.64,.3,.4],[0,.62,.12],'#1f1f22');
        box([.46,.42,.4],[0,.86,.55],'#f2f0ea');for(const s2 of [-1,1]){box([.12,.12,.06],[s2*.2,1.1,.5],'#1f1f22');box([.12,.1,.03],[s2*.11,.9,.76],'#1f1f22');}
        box([.12,.08,.04],[0,.8,.77],'#1f1f22');
        for(const s2 of [-1,1])for(const e of [-1,1])legs.push(box([.18,.36,.2],[s2*.2,.18,e*.28],'#1f1f22'));
      }else if(type==='macaco'){
        box([.36,.4,.42],[0,.45,0],'#a39486');box([.3,.3,.28],[0,.72,.2],'#a39486');box([.2,.18,.06],[0,.7,.35],'#e07a74');
        for(const s2 of [-1,1])box([.04,.04,.02],[s2*.05,.74,.39],'#2a201c');
        for(const s2 of [-1,1])for(const e of [-1,1])legs.push(box([.1,.26,.1],[s2*.12,.13,e*.14],'#8d7f72'));
      }else{
        box([.8,.8,1.3],[0,.95,0],'#5a3d28');box([.86,.6,.6],[0,1.25,.35],'#3f2a1c');box([.5,.5,.45],[0,.95,.82],'#3f2a1c');
        for(const s2 of [-1,1]){const h=box([.06,.18,.06],[s2*.24,1.24,.86],'#e8e0cc');h.rotation.z=-s2*.6;}
        for(const s2 of [-1,1])for(const e of [-1,1])legs.push(box([.18,.55,.2],[s2*.26,.28,e*.4],'#3f2a1c'));
      }
      const animal={id:`wild-${++this.serial}`,type,position:position.clone(),home:position.clone(),health:spec.health,yaw:Number.isFinite(saved.yaw)?saved.yaw:0,mesh,body,legs,goal:null,timer:0,panic:0,gait:0,cooldown:0};
      mesh.position.copy(position);mesh.rotation.y=animal.yaw;mesh.name='wildlife:'+type;this.scene.add(mesh);this.animals.push(animal);return animal;
    }
    if(type==='onca'){
      // Onça-pintada: corpo baixo dourado com rosetas pretas.
      const coat='#d39a3a',spot='#2a211b';
      this.box(body,[.5,.42,1.05],[0,.62,0],coat);
      this.box(body,[.42,.36,.38],[0,.82,.66],coat);this.box(body,[.24,.16,.12],[0,.74,.88],'#e8c48a');
      for(const side of [-1,1]){this.box(body,[.1,.1,.06],[side*.15,1.02,.6],coat);this.box(body,[.06,.05,.03],[side*.11,.88,.86],'#e6d23c');}
      for(let i=0;i<10;i++)this.box(body,[.1,.03,.1],[(i%3-1)*.17,.84,-.42+i*.09],spot);
      for(const side of [-1,1])for(let i=0;i<3;i++)this.box(body,[.03,.1,.1],[side*.26,.6+(i%2)*.08,-.3+i*.25],spot);
      const tail=this.box(body,[.08,.08,.6],[0,.75,-.78],coat);tail.rotation.x=.5;
      const legs=[];for(const side of [-1,1])for(const end of [-1,1])legs.push(this.box(body,[.15,.42,.16],[side*.17,.21,end*.36],coat));
      const animal={id:`wild-${++this.serial}`,type,position:position.clone(),home:position.clone(),health:spec.health,yaw:Number.isFinite(saved.yaw)?saved.yaw:0,mesh,body,legs,goal:null,timer:0,panic:0,gait:0,cooldown:0};
      mesh.position.copy(position);mesh.rotation.y=animal.yaw;mesh.name='wildlife:onca';this.scene.add(mesh);this.animals.push(animal);return animal;
    }
    if(type==='capivara'){
      // Capivara: corpo de barril, focinho quadrado, orelhinhas e pernas curtas.
      const fur='#8a5f3c';
      this.box(body,[.62,.5,.95],[0,.5,0],fur);
      this.box(body,[.42,.4,.42],[0,.58,.6],fur);this.box(body,[.36,.3,.16],[0,.52,.86],'#6f4a2e');
      for(const side of [-1,1]){this.box(body,[.08,.08,.06],[side*.15,.82,.52],'#5a3b24');this.box(body,[.05,.05,.03],[side*.15,.66,.82],'#1d1714');}
      const legs=[];for(const side of [-1,1])for(const end of [-1,1])legs.push(this.box(body,[.13,.26,.14],[side*.2,.13,end*.32],'#6f4a2e'));
      const animal={id:`wild-${++this.serial}`,type,position:position.clone(),home:position.clone(),health:Math.min(spec.health,saved.health??spec.health),yaw:Number.isFinite(saved.yaw)?saved.yaw:0,mesh,body,legs,goal:null,timer:0,panic:0,gait:0,cooldown:0};
      mesh.position.copy(position);mesh.rotation.y=animal.yaw;mesh.name='wildlife:capivara';this.scene.add(mesh);this.animals.push(animal);return animal;
    }
    if(type==='calango'){
      // Lagarto baixo e rápido do Sertão: corpo, cauda longa e quatro patinhas.
      this.box(body,[.22,.12,.5],[0,.1,0],'#8f8a4a');this.box(body,[.18,.1,.2],[0,.12,.33],'#a6a058');
      const tail=this.box(body,[.08,.07,.5],[0,.08,-.48],'#7d7840');tail.rotation.y=.2;
      for(const side of [-1,1])this.box(body,[.03,.03,.02],[side*.07,.16,.43],'#1f2420');
      for(let i=0;i<3;i++)this.box(body,[.12,.02,.08],[0,.17,.12-i*.14],'#c96b3a');
      const legs=[];for(const side of [-1,1])for(const end of [-1,1])legs.push(this.box(body,[.06,.08,.06],[side*.14,.04,end*.17],'#7d7840'));
      const animal={id:`wild-${++this.serial}`,type,position:position.clone(),home:position.clone(),health:Math.min(spec.health,saved.health??spec.health),yaw:Number.isFinite(saved.yaw)?saved.yaw:0,mesh,body,legs,goal:null,timer:0,panic:0,gait:0,cooldown:0};
      mesh.position.copy(position);mesh.rotation.y=animal.yaw;mesh.name='wildlife:calango';this.scene.add(mesh);this.animals.push(animal);return animal;
    }
    const chicken=type==='chicken',rabbit=type==='rabbit';
    const coat=chicken?'#f3e9cc':rabbit?'#a6a098':'#765444';
    this.box(body,chicken?[.42,.4,.55]:rabbit?[.4,.38,.58]:[.78,.59,1.05],[0,chicken?.47:rabbit?.36:.58,0],coat);
    const head=new THREE.Group();head.position.set(0,chicken?.74:rabbit?.59:.65,chicken?.25:rabbit?.27:.51);body.add(head);
    this.box(head,chicken?[.28,.3,.3]:rabbit?[.3,.29,.29]:[.5,.4,.42],[0,0,0],coat);
    if(chicken){
      this.box(head,[.16,.1,.18],[0,-.03,.22],'#e7ac3f');this.box(head,[.075,.13,.22],[0,.21,0],'#c95748');
      this.box(head,[.08,.12,.06],[0,-.19,.17],'#c95748');
      for(const side of [-1,1])this.box(body,[.08,.27,.38],[side*.25,.48,-.03],'#ddd0ae');
      const tail=this.box(body,[.21,.3,.12],[0,.65,-.33],'#d3b786');tail.rotation.x=-.5;
    }else if(rabbit){
      for(const side of [-1,1]){this.box(head,[.1,.42,.1],[side*.09,.3,-.02],coat);this.box(head,[.05,.29,.018],[side*.09,.32,.037],'#d9b6a8');}
      this.box(body,[.22,.22,.23],[0,.37,-.38],'#efe7d8');this.box(head,[.08,.07,.06],[0,-.04,.18],'#bf9388');
    }else{
      this.box(head,[.35,.22,.28],[0,-.08,.28],'#ad8871');
      for(const side of [-1,1]){this.box(head,[.12,.19,.18],[side*.24,.24,-.04],'#5d4438');this.box(head,[.055,.18,.07],[side*.2,-.12,.36],'#efdebc');}
      for(let i=0;i<5;i++)this.box(body,[.09,.13,.14],[0,.92,-.35+i*.15],'#45382f');
    }
    for(const side of [-1,1])this.box(head,[.045,.055,.03],[side*(chicken?.1:rabbit?.1:.17),.035,chicken?.16:rabbit?.15:.22],'#272f2c');
    const legs=[];
    for(const side of [-1,1])for(const end of chicken?[0]:[-1,1]){
      const leg=this.box(body,chicken?[.055,.25,.055]:rabbit?[.12,.2,.19]:[.16,.3,.19],[side*(chicken?.12:rabbit?.13:.26),chicken?.13:rabbit?.12:.16,end*(rabbit?.2:.33)],chicken?'#d99a36':coat);legs.push(leg);
    }
    const animal={id:`wild-${++this.serial}`,type,position:position.clone(),home:position.clone(),health:Math.min(spec.health,saved.health??spec.health),yaw:Number.isFinite(saved.yaw)?saved.yaw:0,mesh,body,legs,goal:null,timer:0,panic:0,gait:0,cooldown:0};
    mesh.position.copy(position);mesh.rotation.y=animal.yaw;mesh.name=`wildlife:${type}`;this.scene.add(mesh);this.animals.push(animal);return animal;
  }
  addDrop(item,count,position){
    const mesh=new THREE.Group();this.box(mesh,[.3,.19,.26],[0,.18,0],'#c79c71');this.box(mesh,[.32,.04,.28],[0,.2,0],'#e1c99a');
    mesh.position.copy(position);this.scene.add(mesh);
    const d={id:`drop-${++this.serial}`,item,count,position:position.clone(),mesh};this.drops.push(d);return d;
  }
  visibleBetween(from,to){const v=to.clone().sub(from),distance=v.length();if(distance<.001)return true;const h=this.world.raycast(from,v.normalize(),distance);return !h||h.distance>=distance-.06;}
  raycast(origin,direction,maxDistance=3.6){
    const ray=new THREE.Ray(origin,direction.clone().normalize());let nearest=null;
    for(const animal of this.animals){const s=SPECIES[animal.type],p=animal.position;if(s.scenery)continue;
      const box=new THREE.Box3(new THREE.Vector3(p.x-s.radius,p.y,p.z-s.radius),new THREE.Vector3(p.x+s.radius,p.y+s.height,p.z+s.radius));
      const hit=ray.intersectBox(box,new THREE.Vector3());if(!hit)continue;
      const distance=hit.distanceTo(origin);
      if(distance<=maxDistance&&(!nearest||distance<nearest.distance)&&this.visibleBetween(origin,hit))nearest={animal,distance};
    }return nearest;
  }
  strike(animal,damage,source){
    if(!this.animals.includes(animal)||SPECIES[animal.type].scenery||!Number.isFinite(damage)||damage<=0||this.drops.length>=64)return false;
    animal.health-=damage;animal.panic=5;animal.goal=animal.position.clone().add(animal.position.clone().sub(source).setY(0).normalize().multiplyScalar(7));
    if(animal.health>0)return true;
    const s=SPECIES[animal.type];this.addDrop(s.drop,s.count,animal.position);
    animal.mesh.removeFromParent();this.animals.splice(this.animals.indexOf(animal),1);return true;
  }
  command(pet){
    if(pet?.type!=='dog'||!pet.tamed)return 'Apenas um cachorro domesticado pode caçar com você.';
    if(pet.vehicleId)return 'Desembarque o cachorro antes de caçar.';
    if(petHealth(pet.health)<50)return `${pet.name} precisa de alimento e recuperação antes de voltar a caçar (vida ${Math.round(petHealth(pet.health))}/100).`;
    pet.mode='hunt';pet.goal=null;pet.path.length=0;pet.routeAge=2;
    return `${pet.name} vai procurar uma presa e trazer a carne até você.`;
  }
  collect(inventory,player){
    let count=0;
    for(const drop of [...this.drops])if(drop.position.distanceTo(player)<1.6&&this.visibleBetween(player.clone().add(new THREE.Vector3(0,.5,0)),drop.position.clone().add(new THREE.Vector3(0,.2,0)))&&inventory.add(drop.item,drop.count)){
      count+=drop.count;drop.mesh.removeFromParent();this.drops.splice(this.drops.indexOf(drop),1);
    }return count;
  }
  dogs(dt,player,inventory){
    for(const pet of this.entities.pets){
      if(pet.type!=='dog'||!pet.tamed)continue;
      if(petHealth(pet.health)===0)continue;
      pet.huntCooldown=Math.max(0,(pet.huntCooldown||0)-dt);
      const carry=pet.carry&&rawItems.has(pet.carry.item)&&Number.isSafeInteger(pet.carry.count)&&pet.carry.count>0&&pet.carry.count<=3?pet.carry:null;
      if(!this.carryMeshes.has(pet.id)){const group=new THREE.Group();this.box(group,[.29,.18,.25],[0,-.14,.5],'#c79c71');pet.head.add(group);this.carryMeshes.set(pet.id,group);}
      this.carryMeshes.get(pet.id).visible=!!carry;
      if(pet.vehicleId||pet.mode==='stay')continue;
      if(carry){
        pet.goal=player.clone();
        if(pet.position.distanceTo(player)<2.3&&this.visibleBetween(pet.position.clone().add(new THREE.Vector3(0,.6,0)),player.clone().add(new THREE.Vector3(0,.6,0)))&&inventory.add(carry.item,carry.count)){
          pet.carry=null;pet.goal=null;this.carryMeshes.get(pet.id).visible=false;this.onDelivery?.(`${pet.name} trouxe a caça para sua mochila!`);
        }continue;
      }
      if(pet.mode!=='hunt')continue;
      const distance=d=>d.position.distanceToSquared(pet.position);
      const drop=this.drops.filter(d=>d.position.distanceTo(player)<26).sort((a,b)=>distance(a)-distance(b))[0];
      const prey=this.animals.filter(a=>a.position.distanceTo(player)<24).sort((a,b)=>distance(a)-distance(b))[0];
      const target=drop||prey;
      pet.goal=target?target.position.clone():pet.position.distanceTo(player)>3?player.clone():null;
      if(!target)continue;
      const contact=pet.position.distanceTo(target.position)<1.7&&this.visibleBetween(pet.position.clone().add(new THREE.Vector3(0,.65,0)),target.position.clone().add(new THREE.Vector3(0,.4,0)));
      if(!contact)continue;
      if(drop){pet.carry={item:drop.item,count:drop.count};drop.mesh.removeFromParent();this.drops.splice(this.drops.indexOf(drop),1);pet.path.length=0;pet.routeAge=2;}
      else if(pet.huntCooldown<=0){this.strike(prey,18,pet.position);pet.huntCooldown=.8;this.entities.audio?.play?.('bark',pet.position);}
    }
  }
  update(dt,player,inventory){
    this.clock+=dt;this.spawnTimer-=dt;
    if(this.spawnTimer<=0){
      this.spawnTimer=30;
      // Recycle far-away living wildlife only. Uncollected loot is never discarded.
      for(const a of [...this.animals])if(a.position.distanceToSquared(player)>160*160){a.mesh.removeFromParent();this.animals.splice(this.animals.indexOf(a),1);}
      if(this.animals.filter(a=>a.position.distanceToSquared(player)<64*64).length<12)for(let tries=0;tries<3;tries++){
        const angle=this.random()*Math.PI*2,r=18+this.random()*18,x=player.x+Math.cos(angle)*r,z=player.z+Math.sin(angle)*r;
        const p=this.spawnPoint(x,z,player.y+8);if(!p)continue;
        const b=this.world.biomeAt(x,z),types=REALMS[b]?(REALMS[b].animalsAt?.(x,z)??REALMS[b].animals):['bosque','floresta'].includes(b)?['boar','rabbit']:['chicken','rabbit','boar'];
        this.spawn(types[Math.floor(this.random()*types.length)],p);break;
      }
    }
    for(const a of this.animals){
      a.mesh.visible=a.position.distanceToSquared(player)<72*72;if(!a.mesh.visible)continue;
      const spec=SPECIES[a.type];a.timer-=dt;a.panic=Math.max(0,a.panic-dt);a.cooldown=Math.max(0,a.cooldown-dt);
      const hunter=this.entities.pets.find(p=>p.mode==='hunt'&&!p.vehicleId&&petHealth(p.health)>0&&p.position.distanceTo(a.position)<4);
      const threat=a.position.distanceTo(player)<3.5?player:hunter?.position;
      if(a.type==='boar'&&hunter){
        a.panic=2;a.goal=hunter.position.clone();
        if(a.cooldown<=0&&a.position.distanceTo(hunter.position)<1.8&&this.visibleBetween(a.position.clone().add(new THREE.Vector3(0,.6,0)),hunter.position.clone().add(new THREE.Vector3(0,.6,0)))){
          hurtPet(hunter,18);a.cooldown=1;this.entities.audio?.play?.('hunt-hit',hunter.position);
          this.onPetHurt?.(hunter);
        }
      }
      else if(threat){a.panic=2;a.goal=a.position.clone().add(a.position.clone().sub(threat).setY(0).normalize().multiplyScalar(6));}
      else if(a.timer<=0){a.timer=3+this.random()*4;const angle=this.random()*Math.PI*2;a.goal=a.home.clone().add(new THREE.Vector3(Math.cos(angle)*4,0,Math.sin(angle)*4));}
      let moving=false;
      if(a.goal){const delta=a.goal.clone().sub(a.position).setY(0),distance=delta.length();
        if(distance>.15){delta.normalize().multiplyScalar(Math.min(distance,dt*spec.speed*(a.panic>0?1:.35)));
          const point=this.entities.petStep(a.position.x+delta.x,a.position.z+delta.z,a.position.y);
          if(point&&this.world.getBlock(point.x,point.y,point.z)!==9&&!this.world.collides({x:point.x-spec.radius,y:point.y+.04,z:point.z-spec.radius},{x:point.x+spec.radius,y:point.y+spec.height,z:point.z+spec.radius})){
            a.position.copy(point);a.yaw=Math.atan2(delta.x,delta.z);moving=true;
          }else {a.goal=null;a.timer=.5;}
        }else a.goal=null;
      }
      const floor=this.entities.groundAt(a.position.x,a.position.z,a.position.y,.05,64);
      if(floor!==null&&floor<a.position.y-.05){const next=a.position.clone();next.y=Math.max(floor,next.y-dt*5);if(!this.world.collides({x:next.x-spec.radius,y:next.y+.04,z:next.z-spec.radius},{x:next.x+spec.radius,y:next.y+spec.height,z:next.z+spec.radius}))a.position.copy(next);}
      a.gait+=dt*(moving?13:2);a.legs.forEach((leg,i)=>leg.rotation.x=moving?Math.sin(a.gait)*(i%2?1:-1)*.45:0);
      a.body.position.y=moving&&a.type==='rabbit'?Math.abs(Math.sin(a.gait))*.13:0;
      a.mesh.position.copy(a.position);a.mesh.rotation.y=a.yaw;
    }
    for(const d of this.drops){
      d.mesh.visible=d.position.distanceToSquared(player)<72*72;
      if(d.mesh.visible){const floor=this.world.heightAt(d.position.x,d.position.z,d.position.y+.05);if(floor!==null&&floor<d.position.y)d.position.y=Math.max(floor,d.position.y-dt*5);d.mesh.position.copy(d.position);d.mesh.rotation.y=this.clock*.7;}
    }
    this.dogs(dt,player,inventory);
    if(this.collect(inventory,player))this.entities.audio?.play?.('collect');
  }
  blocksPlacement(x,y,z){return this.animals.some(a=>{const s=SPECIES[a.type],p=a.position;return x<p.x+s.radius&&x+1>p.x-s.radius&&z<p.z+s.radius&&z+1>p.z-s.radius&&y<p.y+s.height&&y+1>p.y;});}
  serialize(){return {serial:this.serial,randomState:this.randomState,spawnTimer:this.spawnTimer,animals:this.animals.map(a=>({type:a.type,position:a.position.toArray(),health:a.health,yaw:a.yaw})),drops:this.drops.map(d=>({item:d.item,count:d.count,position:d.position.toArray()}))};}
  dispose(){for(const e of [...this.animals,...this.drops])e.mesh.removeFromParent();for(const mesh of this.carryMeshes.values())mesh.removeFromParent();this.geometry.dispose();for(const m of this.materials.values())m.dispose();}
}
