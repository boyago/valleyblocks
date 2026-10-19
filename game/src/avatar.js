import * as THREE from 'three';
import { ITEMS } from './inventory.js';
import { TOOLS } from './tools.js';
import { loadHeldModels, onHeldModel, heldModel } from './held-models.js';
import { domesticGeometry } from './domestic-models.js';
import { NEW_VISUAL } from './visual.js';

import { OUTFITS, DEFAULT_OUTFIT } from './outfits.js';
import outfitModels from './assets/outfit-models.json' with { type: 'json' };
import { ARMOR, ARMOR_MATERIALS } from './armor.js';

/** Original field explorer: short jacket, amber scarf, cap and survey backpack. Outfits recolor tagged parts and add a Blender-made head accessory. */
export class ExplorerAvatar {
  constructor(scene,camera){
    this.scene=scene;this.camera=camera;this.geometry=new THREE.BoxGeometry(1,1,1);this.materials=new Map();this.parts=[];this.outfit=null;this.accessory=null;this.accessoryGeometries=new Map();
    this.body=new THREE.Group();this.body.name='explorer-avatar';scene.add(this.body);
    this.view=new THREE.Group();this.view.name='first-person-hands';camera.add(this.view);scene.add(camera);
    this.box(this.body,[.49,.57,.29],[0,1.04,0],'jacket');
    this.box(this.body,[.035,.51,.035],[.02,1.08,-.164],'zipper');
    this.box(this.body,[.23,.13,.06],[-.12,.96,-.18],'pocket');
    this.box(this.body,[.5,.09,.33],[0,.79,0],'belt');
    this.box(this.body,[.12,.11,.04],[0,.79,-.18],'buckle');
    this.head=new THREE.Group();this.head.position.y=1.53;this.body.add(this.head);
    this.box(this.head,[.39,.4,.35],[0,0,0],'skin');
    this.box(this.head,[.41,.12,.37],[0,.15,.014],'hair');
    this.capParts=[this.box(this.head,[.43,.1,.39],[0,.24,0],'cap'),this.box(this.head,[.48,.045,.17],[0,.18,-.22],'visor')];
    if(NEW_VISUAL){
      // Visual novo (estilo das artes): cabeça maior, olhos grandes com dois brilhos,
      // sobrancelha, bochecha corada e sorriso. Acessórios crescem junto com a cabeça.
      this.head.scale.setScalar(1.22);this.head.position.y=1.575;
      for(const x of [-.095,.095]){this.box(this.head,[.085,.1,.018],[x,.02,-.184],'#2a1d16');this.box(this.head,[.034,.038,.012],[x-.016,.042,-.195],'#fffbe8');this.box(this.head,[.016,.016,.012],[x+.02,-.01,-.195],'#fffbe8');this.box(this.head,[.1,.02,.016],[x,.09,-.182],'hair');this.box(this.head,[.07,.035,.012],[x*1.55,-.07,-.18],'#f0a08a');}
      this.box(this.head,[.05,.04,.04],[0,-.04,-.192],'#c98a6c');this.box(this.head,[.11,.022,.012],[0,-.11,-.182],'#7a3b2e');this.box(this.head,[.07,.018,.012],[0,-.128,-.18],'#e9798a');
    }else{
      for(const x of [-.1,.1]){this.box(this.head,[.065,.06,.018],[x,.025,-.184],'#263c42');this.box(this.head,[.022,.022,.02],[x-.012,.04,-.195],'#f0e4c8');}
      this.box(this.head,[.075,.06,.055],[0,-.055,-.195],'#ad7357');
    }
    this.box(this.body,[.4,.09,.39],[0,1.34,0],'scarf');
    this.box(this.body,[.115,.23,.03],[.12,1.18,-.18],'scarfTail');
    this.box(this.body,[.35,.44,.19],[0,1.08,.23],'backpack');
    this.box(this.body,[.38,.11,.22],[0,1.29,.24],'backpackTop');
    for(const x of [-.17,.17])this.box(this.body,[.055,.5,.035],[x,1.06,-.17],'strap');
    this.legs=[];this.arms=[];
    for(const side of [-1,1]){
      const leg=new THREE.Group();leg.position.set(side*.135,.77,0);this.body.add(leg);this.legs.push(leg);
      this.box(leg,[.22,.55,.25],[0,-.28,0],'pants');this.box(leg,[.24,.2,.34],[0,-.66,-.04],'boots');
      const arm=new THREE.Group();arm.position.set(side*.34,1.31,0);this.body.add(arm);this.arms.push(arm);
      this.box(arm,[.19,.33,.23],[0,-.15,0],'sleeve');
      if(NEW_VISUAL){
        // Mão como nas artes: punho da manga, palma mais larga e polegar separado por dentro.
        this.box(arm,[.22,.06,.26],[0,-.32,0],'strap');this.box(arm,[.18,.22,.2],[0,-.46,0],'hand');this.box(arm,[.07,.13,.08],[-side*.11,-.42,-.08],'hand');
      }else this.box(arm,[.17,.25,.19],[0,-.43,0],'hand');
    }
    this.hand=new THREE.Group();this.hand.position.set(.32,-.34,-.65);this.hand.scale.setScalar(.7);this.hand.rotation.z=-.16;this.view.add(this.hand);
    this.box(this.hand,[.18,.3,.21],[0,-.16,.15],'sleeve');
    if(NEW_VISUAL){this.box(this.hand,[.21,.05,.24],[0,-.03,.15],'strap');this.box(this.hand,[.16,.2,.19],[0,.04,.03],'hand');this.box(this.hand,[.07,.12,.08],[-.1,.08,-.04],'hand');}
    else this.box(this.hand,[.15,.2,.18],[0,.02,.03],'hand');
    // Armadura: peças por cima da roupa (capacete, peitoral com ombreiras, calça e botas),
    // escondidas até vestir; a cor vem do material (couro, ferro, diamante) e a borda escura do acabamento.
    const armor=(parent,size,pos,slot,trim=false)=>{const m=this.box(parent,size,pos,'#888');m.visible=false;this.armorParts[slot].push({mesh:m,trim});};
    this.armorParts={head:[],chest:[],legs:[],feet:[]};
    armor(this.head,[.45,.24,.41],[0,.13,0],'head');armor(this.head,[.47,.09,.43],[0,-.01,0],'head',true);armor(this.head,[.12,.07,.44],[0,.27,0],'head',true);
    armor(this.body,[.55,.6,.35],[0,1.04,0],'chest');armor(this.body,[.57,.08,.37],[0,.82,0],'chest',true);armor(this.body,[.2,.2,.04],[0,1.1,-.19],'chest',true);
    for(const arm of this.arms)armor(arm,[.24,.11,.27],[0,.0,0],'chest',true);
    for(const leg of this.legs){armor(leg,[.25,.48,.28],[0,-.27,0],'legs');armor(leg,[.26,.06,.29],[0,-.49,0],'legs',true);armor(leg,[.27,.22,.37],[0,-.66,-.04],'feet');armor(leg,[.28,.05,.38],[0,-.59,-.04],'feet',true);}
    armor(this.hand,[.21,.13,.24],[0,-.2,.15],'chest',true);
    this.held=null;this.heldWorld=null;this.item=null;this.swing=0;
    this.domesticGeometries={bucket:domesticGeometry('bucket'),grill:domesticGeometry('grill')};
    this.domesticMaterial=new THREE.MeshLambertMaterial({vertexColors:true});
    this.waterGeometry=new THREE.CylinderGeometry(.132,.132,.012,12);
    this.waterMaterial=new THREE.MeshLambertMaterial({color:'#52b8df'});
    this.setOutfit(DEFAULT_OUTFIT);
    // Quando um modelo do Blender termina de carregar, refaz o item na mão.
    loadHeldModels();this.offHeldModel=onHeldModel(()=>{this.item=undefined;});
  }
  material(color){if(!this.materials.has(color))this.materials.set(color,new THREE.MeshLambertMaterial({color}));return this.materials.get(color);}
  /** role: a palette key (recolored by outfits) or a literal color. */
  box(parent,size,pos,role){
    const palette=OUTFITS[DEFAULT_OUTFIT].palette,color=palette[role]||role;
    const m=new THREE.Mesh(this.geometry,this.material(color));m.scale.set(...size);m.position.set(...pos);m.castShadow=true;m.receiveShadow=true;parent.add(m);
    if(palette[role])this.parts.push({mesh:m,role});
    return m;
  }
  setOutfit(id){
    const outfit=OUTFITS[id]||OUTFITS[DEFAULT_OUTFIT];if(this.outfit===outfit)return;this.outfit=outfit;
    for(const part of this.parts)part.mesh.material=this.material(outfit.palette[part.role]);
    for(const cap of this.capParts)cap.visible=!outfit.hideCap;
    this.accessory?.removeFromParent();this.accessory=null;
    if(outfit.accessory&&outfitModels[outfit.accessory]){
      if(!this.accessoryGeometries.has(outfit.accessory)){
        const source=outfitModels[outfit.accessory],geometry=new THREE.BufferGeometry();
        for(const [name,values] of [['position',source.positions],['normal',source.normals],['color',source.colors]])geometry.setAttribute(name,new THREE.Float32BufferAttribute(values,3));
        geometry.computeBoundingSphere();this.accessoryGeometries.set(outfit.accessory,geometry);
      }
      this.accessory=new THREE.Mesh(this.accessoryGeometries.get(outfit.accessory),this.domesticMaterial);this.accessory.castShadow=true;this.accessory.name='accessory:'+outfit.accessory;this.head.add(this.accessory);
    }
  }
  /** Mostra as peças vestidas ({ head, chest, legs, feet } com ids de armadura) nas cores do material. */
  setArmor(equipment){
    for(const slot of Object.keys(this.armorParts)){
      const piece=ARMOR[equipment?.[slot]],material=piece&&ARMOR_MATERIALS[piece.material];
      for(const part of this.armorParts[slot]){part.mesh.visible=!!piece;if(material)part.mesh.material=this.material(part.trim?material.trim:material.color);}
    }
  }
  /** Modelos na mão, em voxels pequenos: cabo com veio, amarração, metal com brilho e sombra. */
  tool(id){
    const g=new THREE.Group();g.name=`held:${id}`;
    const shade=(hex,k)=>'#'+new THREE.Color(hex).multiplyScalar(k).getHexString();
    const b=(size,pos,color,rz=0,rx=0)=>{const m=this.box(g,size,pos,color);m.rotation.z=rz;m.rotation.x=rx;return m;};
    const handle=(len=.62,y=.16)=>{b([.055,len,.055],[0,y,0],'#7d5236');b([.02,len*.9,.058],[.012,y,0],'#9a6a45');for(const yy of [-.06,.02,.1])b([.068,.03,.068],[0,yy,0],'#4a3324');};
    const binding=y=>{b([.075,.05,.075],[0,y,0],'#c79a55');b([.078,.015,.078],[0,y+.03,0],'#8a6638');};
    if(id==='slingshot'){
      b([.07,.32,.07],[0,.06,0],'#a46f3c');
      for(const side of [-1,1]){b([.055,.28,.055],[side*.10,.30,0],'#b7854e',-side*.48);b([.17,.022,.025],[side*.07,.43,.015],'#dba647',side*.12);}
      b([.055,.04,.04],[0,.41,.02],'#664c36');
    }else if(TOOLS[id]&&TOOLS[id].kind==='pickaxe'&&heldModel('pickaxe')){
      const model=heldModel('pickaxe',TOOLS[id].color);model.scale.setScalar(.95);model.position.y=-.08;model.rotation.y=Math.PI/2;g.add(model);g.rotation.z=-.3;
    }else if(TOOLS[id]&&TOOLS[id].kind==='pickaxe'){
      const c=TOOLS[id].color,hi=shade(c,1.25),lo=shade(c,.7);handle();binding(.43);
      // Cabeça em arco: sete segmentos que descem para as pontas.
      for(let i=-3;i<=3;i++){const x=i*.075,y=.49-Math.abs(i)*Math.abs(i)*.012,w=Math.abs(i)===3?.06:.085;b([w,.07,.085],[x,y,0],c,-i*.12);b([w,.018,.088],[x,y+.035,0],hi,-i*.12);b([w,.016,.088],[x,y-.034,0],lo,-i*.12);}
      for(const side of [-1,1])b([.05,.05,.07],[side*.29,.37,0],hi,side*.9);
      g.rotation.z=-.3;
    }else if(TOOLS[id]&&TOOLS[id].kind==='axe'){
      const c=TOOLS[id].color,hi=shade(c,1.3),lo=shade(c,.7);handle();binding(.42);
      // Lâmina que alarga até o fio, com o fio claro e o talão escuro atrás.
      for(let i=0;i<4;i++)b([.06,.12+i*.05,.08],[.06+i*.055,.45,0],i===3?hi:c);
      b([.025,.3,.082],[.27,.45,0],hi);b([.07,.09,.09],[-.05,.45,0],lo);
      g.rotation.z=-.3;
    }else if(TOOLS[id]&&TOOLS[id].kind==='shovel'){
      const c=TOOLS[id].color;handle(.7,.2);b([.12,.05,.06],[0,.6,0],'#5a3d22');
      b([.2,.24,.035],[0,-.18,0],c);b([.16,.06,.035],[0,-.33,0],c);b([.2,.03,.04],[0,-.05,0],shade(c,.7));b([.03,.2,.037],[0,-.18,0],shade(c,1.25));
      g.rotation.z=-.3;
    }else if(/_sword$/.test(id)||id==='reaper_scythe'){
      if(id==='reaper_scythe'&&heldModel('scythe')){const model=heldModel('scythe');model.scale.setScalar(.75);model.position.y=-.2;model.rotation.y=Math.PI/2;g.add(model);}
      else if(id==='reaper_scythe'){handle(.9,.3);for(let i=0;i<6;i++)b([.17,.05,.04],[-.06-i*.09,.72-i*i*.012,0],i===5?'#eef4f0':'#c5d9ce',-i*.16);}
      else{
        const c=ITEMS[id].color,hi=shade(c,1.3),lo=shade(c,.75);
        b([.065,.18,.065],[0,0,0],'#4a3324');for(const y of [-.05,0,.05])b([.07,.02,.07],[0,y,0],'#7d5236');b([.085,.07,.085],[0,-.11,0],'#e4c06a');
        b([.26,.05,.08],[0,.11,0],'#e4c06a');b([.06,.06,.09],[0,.11,0],'#c08a2a');
        for(let i=0;i<6;i++){const w=.1-i*.008;b([w,.1,.035],[0,.19+i*.1,0],c);b([.018,.1,.038],[0,.19+i*.1,0],lo);b([.012,.1,.038],[w/2-.006,.19+i*.1,0],hi);}
        b([.05,.06,.035],[0,.8,0],c,Math.PI/4);
      }
      g.rotation.z=-.25;
    }else if(id==='bow'){
      for(let i=-4;i<=4;i++){const y=.3+i*.09,x=.12-Math.abs(i)*Math.abs(i)*.008;b([.045,.1,.045],[x,y,0],i===0?'#5a3d22':'#a46f3c',i*.1);}
      b([.008,.72,.008],[-.02,.3,0],'#efe6cf');b([.03,.03,.5],[.02,.3,.18],'#8e653e');
    }else if(id==='fishing_rod'){
      // Vara reta e afinando: cabo de cortiça, molinete com manivela, passadores, ponta
      // vermelha. A linha só aparece quando é lançada (fishing.js).
      b([.07,.04,.07],[0,-.13,0],'#2e3439');b([.062,.24,.062],[0,0,0],'#c9a06a');b([.066,.03,.066],[0,.13,0],'#2e3439');
      b([.09,.08,.07],[0,.2,.075],'#55606a');b([.05,.05,.03],[0,.2,.125],'#8a949b');b([.015,.07,.015],[.05,.2,.09],'#2e3439');b([.03,.03,.03],[.05,.24,.09],'#e8e2d0');
      for(const [w,h,y] of [[.04,.42,.36],[.03,.4,.77],[.02,.32,1.13]])b([w,h,w],[0,y,0],'#2f5d7a');
      b([.018,.06,.018],[0,1.31,0],'#d9342b');
      for(const y of [.4,.7,.98,1.2])b([.034,.012,.034],[0,y,.022],'#c9ccd1');
      g.scale.setScalar(.62);g.rotation.x=.45;g.rotation.z=-.15;
    }else if(/^raw_(lambari|tilapia|tucunare|dourado|pirarucu)$|^cooked_fish$/.test(id)){
      const c=ITEMS[id].color;b([.1,.14,.32],[0,.15,0],c);b([.03,.12,.08],[0,.15,-.2],shade(c,.8));b([.03,.06,.12],[0,.24,0],shade(c,.8));
    }else if(id==='rifle'){
      // Espingarda de pressão: coronha de madeira, cano, gatilho e luneta.
      b([.07,.12,.34],[0,0,-.12],'#6b4a2e');b([.06,.08,.24],[0,.04,.14],'#7d5236');
      b([.035,.035,.62],[0,.09,.4],'#55606a');b([.04,.04,.04],[0,.09,.72],'#2e3439');
      b([.05,.05,.24],[0,.16,.16],'#2e3439');for(const z of [.05,.27])b([.065,.065,.035],[0,.16,z],'#1d2124');
      b([.012,.05,.02],[0,-.03,.03],'#2e3439');g.rotation.set(-.04,Math.PI,0);g.position.set(-.02,.14,0);g.scale.setScalar(1.35);g.userData.iconRotation=[0,-Math.PI/2,0];
    }else if(id==='bucket'||id==='water_bucket'){
      const mesh=new THREE.Mesh(this.domesticGeometries.bucket,this.domesticMaterial);mesh.castShadow=true;g.add(mesh);
      if(id==='water_bucket'){const water=new THREE.Mesh(this.waterGeometry,this.waterMaterial);water.position.y=.10;g.add(water);}
    }else if(id===24){
      const mesh=new THREE.Mesh(this.domesticGeometries.grill,this.domesticMaterial);mesh.scale.setScalar(.32);mesh.position.y=.02;mesh.castShadow=true;g.add(mesh);
    }else if(typeof id==='string'&&(id.startsWith('raw_')||id.startsWith('cooked_'))){
      b([.065,.21,.065],[0,.1,0],'#f1e2bd');b([.22,.23,.19],[0,.29,0],ITEMS[id].color);b([.14,.14,.17],[.025,.42,0],ITEMS[id].color);
    }else if(/_ingot$/.test(id)){ // lingote: tronco de pirâmide com brilho no topo
      const c=ITEMS[id].color;b([.3,.09,.15],[0,.05,0],shade(c,.8));b([.26,.04,.11],[0,.115,0],c);b([.2,.012,.06],[0,.14,0],shade(c,1.3));
    }else if(id==='aluminum_ingot'){const c=ITEMS[id].color;b([.3,.09,.15],[0,.05,0],shade(c,.8));b([.26,.04,.11],[0,.115,0],c);b([.2,.012,.06],[0,.14,0],shade(c,1.3));
    }else if(id==='boat'){b([.34,.05,.6],[0,.05,0],'#7f8a92');for(const s2 of [-1,1])b([.03,.12,.58],[s2*.17,.12,0],'#b9c2c9');b([.08,.12,.08],[0,.14,-.32],'#d9342b');
    }else if(id==='trailer'){b([.36,.04,.5],[0,.12,0],'#55606a');for(const s2 of [-1,1]){b([.03,.1,.5],[s2*.18,.18,0],'#3d6fa5');b([.06,.15,.15],[s2*.21,.06,0],'#253031');}b([.03,.03,.25],[0,.1,.36],'#2e3439');
    }else if(id==='resin'){b([.16,.13,.14],[0,.07,0],'#c98a2a');b([.1,.08,.09],[.02,.16,0],'#e3a94a');b([.04,.03,.02],[-.03,.1,.075],'#fff3c0');
    }else if(id==='pebble'){for(const [x,y,z] of [[0,.04,0],[.09,.03,.05],[-.07,.03,.06]])b([.08,.06,.07],[x,y,z],'#a2adb1');
    }else if(id==='flask'||id==='specter_acid'){
      b([.16,.16,.16],[0,.1,0],'#d9f1ef');b([.07,.1,.07],[0,.23,0],'#d9f1ef');b([.08,.03,.08],[0,.29,0],'#8e653e');if(id==='specter_acid')b([.14,.09,.14],[0,.07,0],'#8ff23f');
    }else if(id==='portal_spray'){
      b([.12,.26,.12],[0,.13,0],'#7add35');b([.124,.07,.124],[0,.15,0],'#2f5a26');b([.07,.06,.07],[0,.29,0],'#9aa3a8');b([.05,.02,.02],[0,.31,.05],'#55606a');
    }else if(ITEMS[id])b(Number.isInteger(id)?[.25,.25,.25]:[.2,.12,.25],[0,.15,0],ITEMS[id].color);
    return g;
  }
  update(player,item,{first=true,active=true,mining=false,dt=0}={}){
    if(this.item!==item){
      this.held?.removeFromParent();this.heldWorld?.removeFromParent();this.held=this.tool(item);this.hand.add(this.held);
      this.heldWorld=this.tool(item);this.heldWorld.position.set(0,-.52,-.12);this.heldWorld.rotation.x=-.5;this.arms[1].add(this.heldWorld);this.item=item;
    }
    this.body.visible=active&&!first;this.view.visible=active&&first;
    this.body.position.copy(player.position);this.body.rotation.y=player.yaw;
    this.body.scale.y=player.crouching?.72:1;this.head.rotation.x=player.pitch*.65;
    this.swing+=dt*(mining?13:5);
    const gait=Math.sin(player.distance*5)*Math.min(1,Math.hypot(player.velocity.x,player.velocity.z)/4)*.65;
    this.legs[0].rotation.x=gait;this.legs[1].rotation.x=-gait;
    this.arms[0].rotation.x=-gait*.7;this.arms[1].rotation.x=mining?-1-Math.sin(this.swing)*.45:gait*.5-.2;
    this.hand.rotation.x=mining?-.35-Math.sin(this.swing)*.45:-.12;
    this.hand.position.y=-.34+Math.sin(player.distance*4)*.018;
  }
  dispose(){this.offHeldModel?.();this.body.removeFromParent();this.view.removeFromParent();this.geometry.dispose();for(const m of this.materials.values())m.dispose();for(const g of Object.values(this.domesticGeometries))g.dispose();for(const g of this.accessoryGeometries.values())g.dispose();this.domesticMaterial.dispose();this.waterGeometry.dispose();this.waterMaterial.dispose();}
}

export function playerCamera(world,player,mode){
  const target=player.eye.clone();
  const offset=player.direction.clone().multiplyScalar(mode==='front'?3.6:-4.4);offset.y+=.5;
  const length=offset.length(),direction=offset.clone().normalize();let distance=length;
  // Multiple rays leave room for the near plane at corners and low ceilings.
  const right=new THREE.Vector3(direction.z,0,-direction.x).normalize();
  for(const dx of [-.2,0,.2])for(const dy of [-.15,.15]){
    const start=target.clone().addScaledVector(right,dx);start.y+=dy;const hit=world.raycast(start,direction,length);
    if(hit)distance=Math.min(distance,Math.max(.08,hit.distance-.28));
  }
  return {position:target.clone().addScaledVector(direction,distance),target,distance};
}
