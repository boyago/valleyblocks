import * as THREE from 'three';
import { buildCreature } from './creatures.js';
import { BLOCK } from './blocks.js';
import { realmAt, REALMS } from './realms.js';
import { heldModel, loadHeldModels } from './held-models.js';

export const ENEMIES=Object.freeze({
  reaper:{name:'Ceifador Rubro',health:64,speed:1.65,radius:.34,height:1.95},
  specter:{name:'Espectro do Lodo',health:36,speed:1.3,radius:.4,height:1.7},
  cangaceiro:{name:'Cangaceiro Fantasma',health:52,speed:1.9,radius:.34,height:1.95},
  terracota:{name:'Guerreiro de Terracota',health:58,speed:1.6,radius:.34,height:1.95},
  oni:{name:'Oni',health:66,speed:1.8,radius:.38,height:2.2},
  saci:{name:'Saci',health:40,speed:2.6,radius:.28,height:1.45},
  ratao:{name:'Ratão do esgoto',health:46,speed:2.4,radius:.4,height:.8},
  golem:{name:'Golem de Magma',health:90,speed:1.4,radius:.48,height:2.5},
  boitata:{name:'Boitatá',health:50,speed:2.3,radius:.4,height:.9},
  pegrande:{name:'Pé-Grande',health:80,speed:1.7,radius:.45,height:2.4},
  et:{name:'ET de Varginha',health:44,speed:2.1,radius:.3,height:1.5},
});
export const isEnemyTime=time=>time>=17.5/24||time<6/24;
const validPosition=p=>Array.isArray(p)&&p.length===3&&p.every(n=>Number.isFinite(n)&&Math.abs(n)<1000000);
const bounded=(n,fallback,max)=>Number.isFinite(n)?Math.max(0,Math.min(max,n)):fallback;
const raised=(p,y=.8)=>p.clone().add(new THREE.Vector3(0,y,0));

/** Bounded night encounters. Attacks respect walls and never destroy builds. */
export class EnemySystem {
  constructor(entities,saved=null){
    loadHeldModels();
    this.entities=entities;this.world=entities.world;this.scene=entities.scene;
    this.enemies=[];this.acid=[];this.clock=0;
    this.randomState=Number.isInteger(saved?.randomState)?saved.randomState>>>0:(this.world.seedHash^0x7ac312)>>>0;
    this.spawnTimer=bounded(saved?.spawnTimer,2,15);this.nextType=ENEMIES[saved?.nextType]?saved.nextType:'reaper';
    this.geometry=new THREE.BoxGeometry(1,1,1);this.materials=new Map();
    for(const e of (Array.isArray(saved?.enemies)?saved.enemies:[]).slice(0,8)){
      if(ENEMIES[e.type]&&validPosition(e.position)&&e.health>0)this.spawn(e.type,new THREE.Vector3(...e.position),e);
    }
    for(const a of (Array.isArray(saved?.acid)?saved.acid:[]).slice(0,12))if(validPosition(a.position)&&a.life>0)this.addAcid(new THREE.Vector3(...a.position),bounded(a.life,8,40),a.safe===true);
  }
  random(){this.randomState=(Math.imul(this.randomState,1664525)+1013904223)>>>0;return this.randomState/4294967296;}
  box(parent,size,pos,color,glow=false){
    const key=color+glow;
    if(!this.materials.has(key))this.materials.set(key,new THREE.MeshLambertMaterial({color,emissive:glow?color:'#000000',emissiveIntensity:glow?.55:0}));
    const m=new THREE.Mesh(this.geometry,this.materials.get(key));m.scale.set(...size);m.position.set(...pos);m.castShadow=true;parent.add(m);return m;
  }
  spawn(type,position,state={}){
    const spec=ENEMIES[type];if(!spec||this.enemies.length>=8)return null;
    const mesh=new THREE.Group(),body=new THREE.Group();let arm=new THREE.Group();mesh.add(body);
    mesh.name=`enemy:${type}`;const legs=[];
    // Modelo do Blender (creatures.js); o código de caixas abaixo fica como reserva.
    const model=buildCreature(`enemy-${type}`,body);
    if(model){legs.push(...model.legs);arm=model.arm||arm;if(!arm.parent)body.add(arm);}
    else if(type==='saci'){
      // Saci: uma perna só, gorro vermelho, cachimbo e o corpo pequeno e ágil.
      this.box(body,[.4,.45,.26],[0,.85,0],'#5a3a24');this.box(body,[.36,.34,.32],[0,1.24,0],'#6b4630');
      this.box(body,[.3,.14,.3],[0,1.45,0],'#d9342b');this.box(body,[.18,.14,.18],[0,1.56,-.04],'#d9342b');this.box(body,[.1,.1,.1],[0,1.66,-.1],'#d9342b');
      for(const side of [-1,1])this.box(body,[.06,.06,.03],[side*.09,1.27,.165],'#fff3c0',true);
      this.box(body,[.04,.04,.18],[.08,1.17,.22],'#3a2616');this.box(body,[.07,.07,.07],[.08,1.2,.32],'#3a2616');
      const leg=new THREE.Group();leg.position.set(0,.62,0);body.add(leg);legs.push(leg);this.box(leg,[.14,.6,.16],[0,-.3,0],'#5a3a24');
      this.box(body,[.12,.4,.14],[-.27,.86,0],'#6b4630');arm.position.set(.27,1.02,0);body.add(arm);this.box(arm,[.12,.4,.14],[0,-.2,0],'#6b4630');
    }else if(type==='ratao'){
      const fur='#6d6a66';this.box(body,[.5,.42,.9],[0,.38,0],fur);this.box(body,[.34,.3,.36],[0,.44,.58],fur);this.box(body,[.12,.1,.12],[0,.4,.8],'#d79a9a');
      for(const side of [-1,1]){this.box(body,[.12,.14,.04],[side*.14,.66,.52],'#d79a9a');this.box(body,[.05,.05,.03],[side*.1,.5,.77],'#c0201a',true);}
      const tail=this.box(body,[.06,.06,.7],[0,.3,-.78],'#d79a9a');tail.rotation.x=-.25;
      for(const side of [-1,1])for(const end of [-1,1]){const leg=new THREE.Group();leg.position.set(side*.2,.2,end*.3);body.add(leg);legs.push(leg);this.box(leg,[.1,.2,.1],[0,-.1,0],'#4d4a46');}
      arm.position.set(0,.4,.6);body.add(arm);
    }else if(type==='boitata'){
      // Serpente de fogo do folclore guarani: corpo em gomos brilhantes e olhos de brasa.
      for(let i=0;i<9;i++){const seg=this.box(body,[.42-i*.03,.36-i*.025,.42],[Math.sin(i*.9)*.18,.3,-i*.38],i%2?'#ff7a1a':'#ffb238',true);void seg;}
      this.box(body,[.5,.38,.5],[0,.36,.36],'#ff5a10',true);for(const side of [-1,1])this.box(body,[.08,.08,.04],[side*.14,.46,.62],'#fff3a0',true);
      body.add(arm);
    }else if(type==='terracota'||type==='oni'||type==='pegrande'||type==='golem'){
      // Humanoides das outras terras: mesma base, roupa e proporções próprias.
      const k={terracota:{s:1,skin:'#b98a62',cloth:'#9c6b46',dark:'#6e4a30'},oni:{s:1.12,skin:'#c8322d',cloth:'#2f3a4a',dark:'#1d1d1d'},pegrande:{s:1.22,skin:'#5a3e2b',cloth:'#4b3323',dark:'#3a281b'},golem:{s:1.3,skin:'#3d3633',cloth:'#2c2624',dark:'#221d1b'}}[type],m=k.s;
      this.box(body,[.62*m,.66*m,.36*m],[0,1.03*m,0],k.cloth);
      this.box(body,[.45*m,.42*m,.42*m],[0,1.58*m,0],k.skin);
      for(const side of [-1,1]){
        this.box(body,[.07,.06,.03],[side*.11*m,1.62*m,.215*m],type==='oni'?'#ffe066':type==='pegrande'?'#2a1a10':'#3a2a20',type==='oni');
        const leg=new THREE.Group();leg.position.set(side*.16*m,.73*m,0);body.add(leg);legs.push(leg);
        this.box(leg,[.24*m,.57*m,.29*m],[0,-.28*m,0],type==='pegrande'?k.skin:k.dark);
      }
      if(type==='terracota'){ // armadura de placas e coque
        for(let i=0;i<3;i++)this.box(body,[.66,.06,.4],[0,.86+i*.16,0],'#7e5638');
        this.box(body,[.16,.14,.16],[0,1.86,-.06],k.dark);
      }else if(type==='oni'){ // chifres, cabelo e maça de ferro
        for(const side of [-1,1]){const horn=this.box(body,[.08,.22,.08],[side*.17*m,1.9*m,0],'#f2e6c8');horn.rotation.z=-side*.3;}
        this.box(body,[.5*m,.1,.46*m],[0,1.8*m,-.02],k.dark);this.box(body,[.3,.08,.04],[0,1.47*m,.22*m],'#f6f1e0');
      }else if(type==='golem'){ // rachaduras de magma pelo corpo de pedra
        for(const [x,y,z,w,h] of [[-.15,1.2,.24,.08,.4],[.18,.95,.24,.3,.06],[0,1.45,.24,.06,.3],[.1,1.7,.27,.2,.05]])this.box(body,[w*m,h*m,.03],[x*m,y*m,z*m],'#ff9a2a',true);
      }else{ // rosto claro e pelagem pesada
        this.box(body,[.3,.24,.03],[0,1.55*m,.22*m],'#8c6a50');this.box(body,[.7*m,.2,.4*m],[0,1.28*m,0],k.skin);
      }
      this.box(body,[.2*m,.62*m,.23*m],[-.43*m,1*m,0],type==='pegrande'?k.skin:k.cloth);
      arm.position.set(.43*m,1.28*m,0);body.add(arm);
      this.box(arm,[.19*m,.5*m,.21*m],[0,-.22*m,0],type==='pegrande'?k.skin:k.cloth);this.box(arm,[.17,.18,.2],[0,-.52*m,.03],k.skin);
      if(type==='terracota'){this.box(arm,[.05,1.6,.05],[.03,-.2,.18],'#6b4a2e');this.box(arm,[.09,.22,.09],[.03,.66,.18],'#9aa3a8');}
      if(type==='oni'){this.box(arm,[.12,.9,.12],[0,-.55,.32],'#4a3a2a');for(let i=0;i<4;i++)this.box(arm,[.15,.05,.05],[0,-.75+i*.12,.32],'#9aa3a8');}
    }else if(type==='et'){
      // Pele marrom e oleosa, cabeça grande com três calombos e olhos vermelhos.
      const skin='#6b4a33';
      this.box(body,[.42,.55,.26],[0,.85,0],skin);
      this.box(body,[.62,.5,.52],[0,1.33,.02],skin);
      for(const x of [-.2,0,.2])this.box(body,[.14,.16,.3],[x,1.62,-.02],'#5a3d2a');
      for(const side of [-1,1]){
        this.box(body,[.17,.13,.04],[side*.15,1.33,.28],'#d91f1f',true);
        const leg=new THREE.Group();leg.position.set(side*.12,.58,0);body.add(leg);legs.push(leg);
        this.box(leg,[.14,.56,.16],[0,-.28,0],skin);
      }
      this.box(body,[.12,.62,.13],[-.3,.78,0],skin);
      arm.position.set(.3,1.08,0);body.add(arm);this.box(arm,[.12,.62,.13],[0,-.3,0],skin);this.box(arm,[.16,.08,.16],[0,-.63,0],'#5a3d2a');
    }else if(type==='cangaceiro'){
      const ghost=['#c8b48d','#8a6a45','#e9dcc0'];
      this.box(body,[.62,.66,.34],[0,1.03,0],ghost[0],true);
      this.box(body,[.45,.4,.4],[0,1.57,0],ghost[2],true);
      this.box(body,[.66,.08,.38],[0,1.03,0],'#5b3b22'); // cartucheira
      for(let i=-2;i<=2;i++)this.box(body,[.05,.1,.02],[i*.12,1.03,.2],'#e4c06a');
      this.box(body,[.9,.06,.5],[0,1.8,0],'#6b4426'); // chapéu de couro em meia-lua
      this.box(body,[.5,.22,.42],[0,1.92,0],'#6b4426');this.box(body,[.62,.12,.06],[0,2.0,.18],'#6b4426');
      for(const x of [-.2,0,.2])this.box(body,[.06,.06,.03],[x,2.0,.22],'#e4c06a');
      for(const side of [-1,1]){
        this.box(body,[.06,.06,.035],[side*.11,1.6,.213],'#ffb347',true);
        const leg=new THREE.Group();leg.position.set(side*.16,.73,0);body.add(leg);legs.push(leg);
        this.box(leg,[.24,.57,.29],[0,-.28,0],ghost[1],true);this.box(leg,[.27,.14,.4],[0,-.64,.06],'#4a3220');
      }
      this.box(body,[.2,.6,.23],[-.43,1,0],ghost[0],true);
      arm.position.set(.43,1.28,0);body.add(arm);
      this.box(arm,[.19,.47,.21],[0,-.21,0],ghost[0],true);this.box(arm,[.17,.18,.2],[0,-.51,.03],ghost[2],true);
      this.box(arm,[.05,.08,.7],[0,-.55,.4],'#d9dee0'); // peixeira
    }else if(type==='reaper'){
      this.box(body,[.62,.66,.34],[0,1.03,0],'#b72f38');
      this.box(body,[.45,.4,.4],[0,1.57,0],'#c48e6b');
      this.box(body,[.49,.14,.43],[0,1.83,0],'#c92933');
      this.box(body,[.5,.055,.24],[0,1.78,.26],'#e04440');
      this.box(body,[.43,.24,.09],[0,1.43,.23],'#402e28');
      this.box(body,[.29,.07,.07],[0,1.55,.25],'#402e28');
      for(const side of [-1,1]){
        this.box(body,[.055,.05,.035],[side*.11,1.63,.213],'#f0d088',true);
        const leg=new THREE.Group();leg.position.set(side*.16,.73,0);body.add(leg);legs.push(leg);
        this.box(leg,[.24,.57,.29],[0,-.28,0],'#354951');
        this.box(leg,[.27,.14,.4],[0,-.64,.06],'#382e2c');
      }
      this.box(body,[.2,.6,.23],[-.43,1,0],'#b72f38');
      arm.position.set(.43,1.28,0);body.add(arm);
      this.box(arm,[.19,.47,.21],[0,-.21,0],'#b72f38');
      this.box(arm,[.17,.18,.2],[0,-.51,.03],'#c48e6b');
      // A foice do Ceifador é a mesma do Blender que o jogador ganha; enquanto o
      // modelo carrega, fica a versão de blocos (trocada no primeiro update).
      const fallback=new THREE.Group();arm.add(fallback);
      this.box(fallback,[.065,1.55,.065],[.04,-.14,.18],'#8e653e');
      for(let i=0;i<5;i++){const blade=this.box(fallback,[.24,.085,.055],[-.08-i*.18,.62-i*i*.022,.18],'#c5d9ce');blade.rotation.z=-i*.18;}
      arm.userData.scytheFallback=fallback;this.attachScythe(arm);
    }else{
      this.box(body,[.65,.77,.5],[0,1.03,0],'#d6e9c0',true);
      this.box(body,[.53,.41,.47],[0,1.58,0],'#e6f1d4',true);
      for(const side of [-1,1]){
        this.box(body,[.13,.16,.025],[side*.15,1.6,.245],'#305e40');
        this.box(body,[.055,.07,.04],[side*.15,1.58,.264],'#82ff47',true);
        const wing=this.box(body,[.21,.58,.23],[side*.43,1.07,0],'#c4dbb0');wing.rotation.z=side*.35;
      }
      this.box(body,[.19,.21,.03],[0,1.33,.27],'#406344');
      for(let i=-2;i<=2;i++)this.box(body,[.13,.3+(i%2)*.1,.4],[i*.13,.58,0],'#a5d980');
      this.box(body,[.36,.25,.11],[0,.91,.28],'#7add35',true);
    }
    const enemy={type,position:position.clone(),health:Math.min(spec.health,state.health??spec.health),yaw:Number.isFinite(state.yaw)?state.yaw:0,
      cooldown:bounded(state.cooldown,0,3),windup:bounded(state.windup,0,.65),fuse:Number.isFinite(state.fuse)&&state.fuse>=0?Math.min(1.5,state.fuse):-1,
      mesh,body,arm,legs,gait:0};
    mesh.position.copy(position);mesh.rotation.y=enemy.yaw;this.scene.add(mesh);this.enemies.push(enemy);return enemy;
  }
  /** Troca a foice de blocos pelo modelo 3D quando ele estiver carregado. */
  attachScythe(arm){
    if(arm.userData.scythe)return true;
    const model=heldModel('scythe');if(!model)return false;
    arm.userData.scytheFallback?.removeFromParent();
    model.scale.setScalar(1.3);model.position.set(.04,-.92,.18);model.rotation.y=-Math.PI/2;arm.add(model);arm.userData.scythe=model;return true;
  }
  clearLine(from,to){const delta=to.clone().sub(from),n=delta.length();if(n<.001)return true;const h=this.world.raycast(from,delta.normalize(),n);return !h||h.distance>=n-.05;}
  raycast(origin,direction,maxDistance=3.6){
    const ray=new THREE.Ray(origin,direction.clone().normalize());let nearest=null;
    for(const animal of this.enemies){const p=animal.position,s=ENEMIES[animal.type];
      const hit=ray.intersectBox(new THREE.Box3(new THREE.Vector3(p.x-s.radius,p.y,p.z-s.radius),new THREE.Vector3(p.x+s.radius,p.y+s.height,p.z+s.radius)),new THREE.Vector3());
      if(!hit)continue;const distance=origin.distanceTo(hit);
      if(distance<=maxDistance&&(!nearest||distance<nearest.distance)&&this.clearLine(origin,hit))nearest={animal,distance};
    }return nearest;
  }
  remove(e){e.mesh.removeFromParent();this.enemies.splice(this.enemies.indexOf(e),1);}
  strike(e,damage){
    if(!this.enemies.includes(e)||!Number.isFinite(damage)||damage<=0)return false;
    e.health-=damage;
    if(e.health<=0){ // Defeating a specter in time prevents its explosion and leaves harmless, collectable acid.
      this.remove(e);
      if(e.type==='reaper'&&this.random()<.1)this.onDrop?.('reaper_scythe',e.position);
      if(e.type==='specter'){this.addAcid(e.position,40,true);this.onEvent?.('O Espectro deixou uma poça de ácido. Use um frasco (botão direito) para coletar.');}
    }
    return true;
  }
  trySpawn(player,realm=null,night=true){const sertao=!!realm;
    for(let i=0;i<12;i++){
      const angle=this.random()*Math.PI*2,r=19+this.random()*9;
      const x=player.x+Math.cos(angle)*r,z=player.z+Math.sin(angle)*r;
      if((!sertao&&Math.hypot(x,z)<23)||!this.world.chunks.has(`${Math.floor(x/16)},${Math.floor(z/16)}`))continue;
      const y=this.world.heightAt(x,z,player.y+8);if(y===null||y<1||y>54)continue;
      const p=this.entities.safeStand(x,z,y,2,.4,.1,.1);
      if(!p||[BLOCK.WATER,BLOCK.LAVA].includes(this.world.getBlock(x,p.y,z))||this.entities.blocksPlacement(Math.floor(x),Math.floor(p.y),Math.floor(z)))continue;
      if(this.enemies.some(e=>e.position.distanceTo(p)<2))continue;
      const roll=this.random(),type=realm?(roll<.6?REALMS[realm].enemy:this.nextType):this.nextType;
      const e=this.spawn(type,p);if(e){if(type==='reaper'||type==='specter')this.nextType=type==='reaper'?'specter':'reaper';return e;}
    }return null;
  }
  addAcid(position,life=8,safe=false){
    if(this.acid.length>=12)return;
    const mesh=new THREE.Group();mesh.name='acid-puddle';
    // Grounded splashes stay visible after the burst and fade with their lifetime.
    for(let i=0;i<9;i++){const angle=i*2.4,r=i===0?0:1.65;this.box(mesh,[1,.045,1],[Math.cos(angle)*r,.045,Math.sin(angle)*r],i%2?'#69b934':'#a0f347',true);}
    for(let i=0;i<8;i++){const a=i*Math.PI/4;this.box(mesh,[.13,.15,.13],[Math.cos(a)*1.3,.8,Math.sin(a)*1.3],'#acff57',true);}
    mesh.position.copy(position);this.scene.add(mesh);this.acid.push({position:position.clone(),life,mesh,safe});
  }
  /** Flask use: takes the nearest puddle within reach. */
  collectAcid(position,reach=3.2){
    const a=this.acid.filter(a=>a.position.distanceTo(position)<reach).sort((x,y)=>x.position.distanceTo(position)-y.position.distanceTo(position))[0];
    if(!a)return false;a.mesh.removeFromParent();this.acid.splice(this.acid.indexOf(a),1);return true;
  }
  /** Dano ao jogador; a armadura vestida (player.armor) absorve parte e se desgasta. */
  hurt(player,amount,mode){if(mode!=='survival')return;const armor=player.armor;const taken=armor?amount*(1-armor.protection):amount;player.health=Math.max(0,player.health-taken);armor?.hit?.(amount);}
  explode(e,player,mode){
    if(e.position.distanceTo(player.position)<3.3&&this.clearLine(raised(e.position),raised(player.position)))this.hurt(player,26,mode);
    this.addAcid(e.position);this.onEvent?.('O Espectro do Lodo explodiu! Afaste-se da meleca verde.');
    this.entities.audio?.play?.('hunt-hit',e.position);this.remove(e);
  }
  update(dt,player,time,mode){
    this.clock+=dt;
    const realm=realmAt(player.position.x,player.position.z),sertao=!!REALMS[realm]?.day;
    if(!isEnemyTime(time)&&!sertao){
      if(this.enemies.length)this.onEvent?.('O sol nasceu. Os inimigos se dissiparam.');
      for(const e of [...this.enemies])this.remove(e);this.spawnTimer=2;
    }else{
      this.spawnTimer-=dt;
      if(this.spawnTimer<=0){this.spawnTimer=isEnemyTime(time)?12:30;this.trySpawn(player.position,realm,isEnemyTime(time));}
    }
    for(const e of [...this.enemies]){
      if(e.type==='reaper'&&!e.arm.userData.scythe)this.attachScythe(e.arm);
      const distance=e.position.distanceTo(player.position);
      if(distance>90){this.remove(e);continue;}
      const spec=ENEMIES[e.type];e.cooldown=Math.max(0,e.cooldown-dt);
      if(distance>45)continue;
      const visible=this.clearLine(raised(e.position),raised(player.position));
      if(e.type==='specter'){
        if(e.fuse<0&&distance<2.5&&visible){e.fuse=1.5;this.onEvent?.('Espectro carregando! Afaste-se ou derrote-o antes da explosão.');}
        if(e.fuse>=0){e.fuse-=dt;e.mesh.scale.setScalar(1+Math.sin(this.clock*28)*.09);if(e.fuse<=0){this.explode(e,player,mode);continue;}}
        e.body.position.y=Math.sin(this.clock*3)*.12;
      }else{
        if(e.type==='cangaceiro')e.body.position.y=.08+Math.sin(this.clock*2.4)*.06;
        if(e.windup>0){
          e.windup=Math.max(0,e.windup-dt);
          if(e.windup===0){e.cooldown=1.3;if(distance<2&&visible){this.hurt(player,16,mode);this.entities.audio?.play?.('hunt-hit',e.position);}}
        }else if(e.cooldown===0&&distance<1.9&&visible)e.windup=.65;
        e.arm.rotation.x=e.windup>0?-1.7*(1-e.windup/.65):e.cooldown>1? .8:0;
      }
      const beforeMove=e.position.clone(),delta=player.position.clone().sub(e.position).setY(0);
      if(delta.length()>.9&&e.windup<=0&&e.fuse<0){
        delta.normalize().multiplyScalar(dt*spec.speed);
        for(const [dx,dz] of [[delta.x,delta.z],[delta.x,0],[0,delta.z]]){
          const p=this.entities.safeStand(e.position.x+dx,e.position.z+dz,e.position.y,spec.height,spec.radius,.65,.8);
          if(p&&![BLOCK.WATER,BLOCK.LAVA].includes(this.world.getBlock(p.x,p.y,p.z))&&!this.entities.vehicles.some(v=>this.entities.pointInsideVehicle(p,v,.4))){e.position.copy(p);break;}
        }
        e.yaw=Math.atan2(delta.x,delta.z);
      }
      const floor=this.world.heightAt(e.position.x,e.position.z,e.position.y+.05);
      if(floor!==null&&floor<e.position.y-.05)e.position.y=Math.max(floor,e.position.y-dt*5);
      const travelled=Math.hypot(e.position.x-beforeMove.x,e.position.z-beforeMove.z);
      e.gait+=travelled*7;
      e.legs.forEach((leg,i)=>leg.rotation.x=travelled>.0001?Math.sin(e.gait)*(i?1:-1)*.65:0);
      e.mesh.position.copy(e.position);e.mesh.rotation.y=e.yaw;
    }
    for(const a of [...this.acid]){
      a.life-=dt;
      if(a.life<=0){a.mesh.removeFromParent();this.acid.splice(this.acid.indexOf(a),1);continue;}
      a.mesh.scale.setScalar(Math.min(1,a.life));
      a.mesh.children.slice(9).forEach((drop,i)=>{drop.position.y=.15+Math.max(0,Math.sin(this.clock*7+i))*.65;});
      const p=player.position;
      if(!a.safe&&Math.hypot(p.x-a.position.x,p.z-a.position.z)<2.4&&Math.abs(p.y-a.position.y)<1.2&&this.clearLine(raised(a.position,.15),raised(p,.3)))this.hurt(player,8*dt,mode);
    }
  }
  blocksPlacement(x,y,z){return this.enemies.some(e=>{const p=e.position,s=ENEMIES[e.type];return x<p.x+s.radius&&x+1>p.x-s.radius&&z<p.z+s.radius&&z+1>p.z-s.radius&&y<p.y+s.height&&y+1>p.y;});}
  serialize(){return {randomState:this.randomState,spawnTimer:this.spawnTimer,nextType:this.nextType,
    enemies:this.enemies.map(e=>({type:e.type,position:e.position.toArray(),health:e.health,yaw:e.yaw,cooldown:e.cooldown,windup:e.windup,fuse:e.fuse})),
    acid:this.acid.map(a=>({position:a.position.toArray(),life:a.life,safe:!!a.safe}))};}
  dispose(){for(const e of [...this.enemies])this.remove(e);for(const a of this.acid)a.mesh.removeFromParent();this.acid=[];this.geometry.dispose();for(const m of this.materials.values())m.dispose();}
}

/** Shared targeting for melee and slingshot, with nearest visible entity winning. */
export function combatTargets(...systems){return {
  raycast(origin,direction,distance){return systems.map(s=>s.raycast(origin,direction,distance)).filter(Boolean).sort((a,b)=>a.distance-b.distance)[0]||null;},
  strike(target,damage,source){const system=systems.find(s=>(s.animals||s.enemies||[]).includes(target));return system?system.strike(target,damage,source):false;},
};}
