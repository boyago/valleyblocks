import { PestSystem, PESTS } from './pests.js';
import { restEligibility, completeRest } from './furniture.js';
import { EnemySystem, ENEMIES, combatTargets } from './enemies.js';
import { newWorldSeed } from './world-seed.js';
import { mineBlock, primaryAction } from './mining.js';
import { stallFor, trade, restock, residentFor } from './trading.js';
import { QUESTS, questFor, normalize as normalizeQuests, claim as claimQuest, deliver as deliverQuest } from './quests.js';
import { TOOLS, miningRequirement , WEAPON_DAMAGE, RANGED } from './tools.js';
import { TreeResin, Slingshot } from './hunting-tools.js';
import * as THREE from 'three';
import { VoxelWorld } from './world.js';
import { BLOCK, BLOCKS } from './blocks.js';
import { Player } from './player.js';
import { EntitySystem } from './entities.js';
import { Inventory, ITEMS, craft, transferItems } from './inventory.js';
import { GameAudio } from './audio.js';
import { saveGame, loadGame } from './save.js';
import { createRemoteSaves } from './remote-save.js';
import { Sky } from './sky.js';
import { Particles } from './particles.js';
import { UI } from './ui.js';
import { createLabsBridge } from './labs-game-sdk.js';
import { ExplorerAvatar, playerCamera } from './avatar.js';
import { Coop } from './multiplayer.js';
import { Fishing } from './fishing.js';
import { Boats, Trailers } from './watercraft.js';
import { Landmarks } from './landmarks.js';
import { Skeletons } from './skeletons.js';
import { Realms, activatePortal, realmAt, PORTAL_BLOCKS, REALMS, buildStarterHouse } from './realms.js';
import { OUTFITS, OUTFIT_PACKS, resolveOutfit } from './outfits.js';
import { useBucket, heatMaterial } from './interactions.js';
import { rampFacingFromYaw } from './ramps.js';
import { Wildlife, SPECIES } from './wildlife.js';
import { FOODS, eatFood, updateNeeds } from './survival.js';
import { TouchControls, touchPreferred } from './touch.js';
import { createAccount } from './account.js';
import { TEST_TIME, NEW_VISUAL } from './visual.js';
import './style.css';

const bridge=createLabsBridge({slug:'valleyblocks',version:'1.25.0'});
const canvas=document.querySelector('#world');
/** App Android/iOS (Capacitor injeta window.Capacitor antes de qualquer script). */
const NATIVE_APP=typeof window.Capacitor?.isNativePlatform==='function'&&window.Capacitor.isNativePlatform();
const TOUCH=touchPreferred({native:NATIVE_APP});
const account=createAccount({bridge,native:NATIVE_APP});
const DEFAULT_SETTINGS={quality:'medium',shadows:true,fog:true,music:.3,effects:.65,sensitivity:1,showFps:false,outfit:'explorer'};
// Celular: começa leve (3 × 3 regiões, sem sombras). O jogador pode subir em Som e imagem.
const TOUCH_DEFAULTS={quality:'low',shadows:false};
/** Packs the portal confirmed for this account (cosmetic only; the server is the source). */
const REALM_TINTS=Object.fromEntries(Object.entries(REALMS).map(([k,r])=>[k,{sky:r.sky?new THREE.Color(r.sky):null,haze:r.haze?new THREE.Color(r.haze):null,tint:r.tint??.4,fx:r.fx}]));
// Tela inicial: cada carregamento sorteia uma vista do vale ou de uma das terras.
// cam/look são relativos ao centro da terra (o vale usa a origem).
const LANDING_VIEWS={
  vale:{cam:[27,25,38],look:[-2,10,0]},
  sertao:{cam:[16,20,26],look:[0,11,0]},
  minas:{cam:[-2,19,22],look:[0,12,0]},
  china:{cam:[-7,22,16],look:[9,15,-12]},
  japao:{cam:[1,24,18],look:[0,30,-50]},
  eua:{cam:[-62,27,14],look:[-30,10,26]},
  triplice:{cam:[50,24,31],look:[20,10,31]},
  submundo:{cam:[16,24,26],look:[0,12,0]},
  rio:{cam:[-20,22,44],look:[50,24,40]},
  nyc:{cam:[-30,30,30],look:[10,20,90]},
};
export function pickLanding(random=Math.random){const keys=Object.keys(LANDING_VIEWS);return keys[Math.floor(random()*keys.length)%keys.length];}
let ownedPacks=[],fullAccess=false,coopAvailable=false;
export const FULL_VERSION=Object.freeze({product:'vale-completo',price:'R$ 29,90'});
const FIXED_STEP=1/60;
let saves={cloud:false,load:loadGame,save:saveGame,info:()=>({})};
let renderer;
try {
  renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance'});
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  // Visual novo: cor mais viva e contraste de "foto de capa" (filtro do próprio navegador, barato).
  if(NEW_VISUAL){canvas.style.filter="saturate(1.22) contrast(1.07)";renderer.toneMappingExposure=1.05;}
} catch(error){fatal('Este navegador precisa de WebGL 2 para abrir o vale.',error);}

function fatal(message,error){
  console.error(error||message);const el=document.querySelector('#fatal');el.hidden=false;
  el.innerHTML='<h1>O vale não pôde abrir.</h1><p></p><button onclick="location.reload()">Tentar novamente</button>';
  el.querySelector('p').textContent=message;bridge.error(message,'webgl-unsupported');
}

class Game {
  constructor(saved) {
    this.saved=saved;this.started=false;this.running=false;this.disposed=false;
    this.cloudSaves=saves.cloud;this.saveInfo=saves.info();this.saveFailure='';
    let storedSettings={};try{storedSettings=JSON.parse(localStorage.getItem('vale-settings')||'{}');}catch{}
    this.settings={...DEFAULT_SETTINGS,...(TOUCH?TOUCH_DEFAULTS:{}),...saved?.settings,...storedSettings};
    if(!['low','medium','high'].includes(this.settings.quality))this.settings.quality='medium';
    this.seed='';this.newSeed='';this.mode='creative';this.newMode='creative';
    this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(65,1,.05,310);
    this.audio=new GameAudio(this.settings);this.keys=new Set();this.mining=false;this.miningProgress=0;this.miningKey='';this.target=null;
    this.time=.355;this.activeVehicle=null;this.internalCamera=false;this.focusPet=null;this.focusStorage=null;
    this.chests={};this.doors={};this.goals={};this.autoSave=0;this.torchTimer=0;this.torchLights=[];
    this.sky=new Sky(this.scene);this.particles=new Particles(this.scene);
    this.avatar=new ExplorerAvatar(this.scene,this.camera);
    this.ownedPacks=ownedPacks;this.fullOffer=!bridge.standalone&&!fullAccess?FULL_VERSION:null;this.settings.outfit=resolveOutfit(this.settings.outfit,this.ownedPacks);this.avatar.setOutfit(this.settings.outfit);
    this.selection=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.012,1.012,1.012)),new THREE.LineBasicMaterial({color:0xfff4c7,transparent:true,opacity:.9}));
    this.selection.visible=false;this.scene.add(this.selection);
    this.ui=new UI(document.querySelector('#app'),(action,data,button)=>this.action(action,data,button),{touch:TOUCH});
    this.touch=TOUCH?new TouchControls(this,document.querySelector('#app')):null;
    this.coopAvailable=coopAvailable&&!bridge.standalone;this.coop=new Coop(this);
    this.account=account;account.onChange(s=>{
      // No app as roupas compradas vêm da conta; no portal, o site já manda no 'start'.
      if(s.mode==='app'){this.ownedPacks=s.outfits.filter(id=>OUTFIT_PACKS[id]);this.settings.outfit=resolveOutfit(this.settings.outfit,this.ownedPacks);this.avatar.setOutfit(this.settings.outfit);}
      if(['landing','login','character'].includes(this.ui.menu))this.ui.setMenu(this.ui.menu,this);
    });
    this.landingBoot=true;this.createWorld(null);this.landingBoot=false;this.coop.bindWorld(this.world);
    this.bindInput();this.resize();this.ui.setMenu('landing',this);
    this.frameTimes=[];this.fps=0;this.perfElapsed=0;this.frameCounter=0;this.accumulator=0;this.elapsed=0;
    this.lastFrame=performance.now();this.frame=this.frame.bind(this);this.raf=requestAnimationFrame(this.frame);
  }
  createWorld(save) {
    this.realmFx?.group.removeFromParent();this.realmFx=null;this.fishing?.dispose();this.boats?.dispose();this.landmarks?.dispose();this.skeletons?.dispose();this.trailers?.dispose();this.activeBoat=null;this.landmarks=new Landmarks(this.scene);this.skeletons=new Skeletons(this.scene,()=>this.world);this.slingshot?.dispose();this.pests?.dispose();this.enemies?.dispose();this.wildlife?.dispose();this.world?.dispose();this.entities?.dispose();this.torchLights.forEach(l=>this.scene.remove(l));this.torchLights=[];
    this.seed=save?.seed||newWorldSeed(this.newSeed);this.mode=save?.mode||this.newMode;
    this.world=new VoxelWorld(this.scene,this.seed,save?.edits||[],save?.fluids||null,{generatorVersion:save?(save.generatorVersion||1):3,dynamics:save?.dynamics,geology:save?.geology||{version:1},underworld:save?.underworld||{version:1},televisions:save?.televisions});
    this.world.ensureAround(0,0,1);
    if(save&&!save.starterGrillVersion&&!this.world.edits.has('-8,9,-5')&&this.world.getBlock(-8,9,-5)===BLOCK.AIR)this.world.setBlock(-8,9,-5,BLOCK.FORGE);
    if(save&&!save.homeFurnitureVersion)for(const [x,y,z,id] of [[-11,9,0,BLOCK.SOFA],[-10,9,0,BLOCK.SOFA],[-10,9,-4,BLOCK.TV]]){if(!this.world.edits.has(x+','+y+','+z)&&this.world.getBlock(x,y,z)===BLOCK.AIR)this.world.setBlock(x,y,z,id);}
    this.focusSofa=null;this.restRemaining=0;this.whistleCooldown=0;
    this.player=new Player(this.world,save?.player);
    this.inventory=new Inventory(this.mode,save?.inventory);
    this.entities=new EntitySystem(this.scene,this.world,this.audio,save?.entities||null);
    this.wildlife=new Wildlife(this.entities,save?.wildlife);
    this.realms=new Realms(save?.realms);
    this.enemies=new EnemySystem(this.entities,save?.enemies);this.enemies.onEvent=message=>this.ui.toast(message);this.enemies.onDrop=item=>{if(this.inventory.add(item)){this.ui.toast(`Raro! ${ITEMS[item].name} foi para a sua mochila.`);this.audio.play('craft');}};
    this.pests=new PestSystem(this.entities,this.inventory,save?.pests);this.pests.onEvent=message=>this.ui.toast(message);
    this.combat=combatTargets(this.wildlife,this.enemies,this.pests);
    this.wildlife.onDelivery=message=>this.ui.toast(message);this.wildlife.onPetHurt=pet=>this.ui.toast(`${pet.name} foi atingido pelo javali. Vida: ${Math.round(pet.health)}/100.${pet.health<=25?' Ofereça alimento para recuperar.':''}`);this.attackCooldown=0;
    this.world.sand.blocked=(x,y,z)=>this.player.overlaps(x,y,z)||this.entities.blocksPlacement(x,y,z)||this.wildlife.blocksPlacement(x,y,z)||this.enemies.blocksPlacement(x,y,z)||this.pests.blocksPlacement(x,y,z);
    this.resin=new TreeResin(this.world,save?.resin);this.slingshot=new Slingshot(this.scene,this.world,this.combat);this.fishing=new Fishing(this.scene,this.world);this.boats=new Boats(this.scene,this.world,save?.boats);this.trailers=new Trailers(this.scene,this.world,this.entities,save?.trailers);this.activeBoat=null;
    this.forges=structuredClone(save?.forges||{});this.focusForge=null;
    this.cameraMode=['first','back','front'].includes(save?.cameraMode)?save.cameraMode:'first';
    this.time=TEST_TIME??save?.time??.355;this.trades=save?.trades&&typeof save.trades==='object'?structuredClone(save.trades):{};this.tradeClock=0;this.chests=structuredClone(save?.chests||{'-6,9,-4':{3:32,12:24,10:12,food:12}});
    this.doors=structuredClone(save?.doors||{'-9,9,2':{x:-9,y:9,z:2,open:false}});
    this.goals={mine:false,build:false,pet:false,drive:false,...save?.goals};this.quests=normalizeQuests(save?.quests);this.residentClock=0;
    this.activeVehicle=save?.activeVehicle?this.entities.vehicles.find(v=>v.id===save.activeVehicle)||null:null;
    this.internalCamera=!!save?.internalCamera;
    if(!this.activeVehicle&&this.player.blocked(this.player.position))this.player.safeSpawn();
    this.world.ensureAround(this.player.position.x,this.player.position.z,1);
    for(let i=0;i<9;i++)this.world.update(this.player.position.x,this.player.position.z,1);
    this.ui.lastHotbar='';this.resetInput();this.torchTimer=0;this.autoSave=0;
    if(this.landingBoot){this.landingKey??=pickLanding();const f=this.landingFocus();this.world.ensureAround(f.x,f.z,1);for(let i=0;i<9;i++)this.world.update(f.x,f.z,1);this.landingLife();}
    this.landingCamera(0);
  }
  /** Posiciona a câmera da tela inicial na vista sorteada, com um balanço lento. */
  landingCamera(t=0){
    const key=this.landingKey||'vale',v=LANDING_VIEWS[key],c=REALMS[key]?.center||[0,0];
    this.camera.position.set(c[0]+v.cam[0]+Math.sin(t*.035)*2,v.cam[1],c[1]+v.cam[2]);
    this.camera.lookAt(c[0]+v.look[0],v.look[1],c[1]+v.look[2]);
  }
  landingFocus(){const key=this.landingKey||'vale',v=LANDING_VIEWS[key],c=REALMS[key]?.center||[0,0];return new THREE.Vector3(c[0]+(v.cam[0]+v.look[0])/2,9,c[1]+(v.cam[2]+v.look[2])/2);}
  /** Bichos da terra sorteada passeando na frente da câmera da tela inicial. */
  landingLife(){
    const realm=REALMS[this.landingKey];if(!realm||!this.wildlife)return;
    const v=LANDING_VIEWS[this.landingKey],[cx,cz]=realm.center;
    for(let i=0;i<3;i++){
      const x=cx+v.look[0]*.6+v.cam[0]*.4+(i-1)*2.5,z=cz+v.look[2]*.6+v.cam[2]*.4+(i%2)*2;
      const y=this.world.heightAt(x,z,v.cam[1]);if(y===null)continue;
      this.wildlife.spawn(realm.animals[i%realm.animals.length],new THREE.Vector3(x,y,z));
    }
  }
  resize() {
    const w=window.innerWidth,h=window.innerHeight;
    const cap=this.settings.quality==='high'?1.5:this.settings.quality==='low'?.75:1;
    // Telas de celular têm DPR 2–3 em GPU modesta: nunca renderizar acima de 1×.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,cap,TOUCH?1:Infinity));renderer.setSize(w,h,false);
    renderer.shadowMap.enabled=!!this.settings.shadows;
    this.camera.aspect=w/h;this.camera.updateProjectionMatrix();
  }
  resetInput(){this.keys.clear();this.mining=false;this.miningProgress=0;this.miningKey='';this.mouseDragging=false;this.touch?.reset();}
  isRanged(item){return !!RANGED[item];}
  /** Botão esquerdo / toque longo: minerar, atacar ou disparar com o item equipado. */
  primaryDown(){
    if(!this.running||this.activeVehicle)return;
    const item=this.inventory.selectedItem;
    const hit=this.world.raycast(this.player.eye,this.player.direction,6);
    const prey=RANGED[item]?this.combat.raycast(this.player.eye,this.player.direction,RANGED[item].speed):null;
    if(primaryAction(item,hit,prey)==='shoot'){
      const result=this.slingshot.fire(this.player,this.inventory,item);
      if(result.message)this.ui.toast(result.message);
      if(result.ok){this.audio.play('hunt-hit');this.wearTool(item);}
    }else this.mining=true;
  }
  primaryUp(){this.mining=false;this.miningProgress=0;}
  openInventory(){
    if(!this.started)return;
    if(this.ui.menu==='inventory'||this.ui.menu==='storage'){this.resume();return;}
    if(this.activeVehicle){if(this.activeVehicle.grounded===false||Math.abs(this.activeVehicle.verticalVelocity||0)>.5){this.ui.toast('Aguarde o carro tocar o chão antes de abrir o porta-malas.');return;}if(Math.abs(this.activeVehicle.speed)>.25){this.ui.toast('Pare o carro antes de abrir o porta-malas.');return;}this.focusStorage={vehicle:true,items:this.activeVehicle.trunk};this.menu('storage');}
    else{this.audio.play('inventory');this.menu('inventory');}
  }
  toggleFly(){
    if(this.mode!=='creative'||this.activeVehicle||!this.running)return;
    this.player.flying=!this.player.flying;this.player.velocity.y=0;
    this.ui.toast(this.player.flying?(TOUCH?'Voo livre. Pular sobe, Agachar desce.':'Voo livre. Espaço sobe, Ctrl desce.'):'De volta ao chão.');
  }
  cycleCamera(){
    if(!this.running)return;
    if(this.activeVehicle)this.internalCamera=!this.internalCamera;
    else{const modes=['first','back','front'];this.cameraMode=modes[(modes.indexOf(this.cameraMode)+1)%3];this.ui.toast({first:'Primeira pessoa',back:'Câmera de costas',front:'Câmera de frente'}[this.cameraMode]);}
    this.updateCamera(1);
  }
  menu(name) {
    bridge.gameplay(false);
    this.running=false;this.resetInput();this.selection.visible=false;this.audio.setPaused(true);
    this.ui.setMenu(name,this);
    if(document.pointerLockElement===canvas)document.exitPointerLock();
  }
  async resume() {
    const access=await bridge.requestAccess();
    if(!access.allowed){this.menu(this.started?'pause':'landing');this.ui.toast(access.message||'Não foi possível continuar.');return false;}
    await this.audio.init();
    this.resetInput();this.ui.setMenu(null,this);this.running=true;this.audio.setPaused(false);bridge.started();bridge.gameplay(true);
    canvas.focus();
    if(TOUCH){this.touch?.update();return true;}
    try {await canvas.requestPointerLock();}
    catch {this.ui.toast('Mouse livre: segure Alt e arraste para olhar. Clique no cenário para capturar o cursor.');}
    return true;
  }
  start(save=null){this.createWorld(save);this.coop?.bindWorld(this.world);this.started=true;
    const realm=!save&&!this.fullOffer&&REALMS[this.startRealmChoice];this.startRealmChoice='';
    if(realm){
      const r=this.realms.travel(realm.portal,this.player,this.entities,this.world);
      if(r.ok){
        // Começar numa terra: uma casa pronta ao lado do portal e o jogador na porta dela.
        const key=r.realm,house=buildStarterHouse(this.world,key);
        if(house){this.player.position.set(...house.door);this.player.velocity.set(0,0,0);this.player.yaw=Math.PI;}
        this.ui.arrival(key);this.updateCamera(1);this.resume();this.ui.toast(`Sua casa no ${realm.name} está pronta! O portal ao lado leva ao vale.`);return;
      }
    }
    this.updateCamera(1);this.resume();this.ui.toast(save?'Seu mundo está de volta. Boa aventura!':TOUCH?'Bem-vindo ao vale! Joystick à esquerda anda, arraste à direita para olhar. Toque longo minera; toque curto coloca. Toque no aviso para abrir portas, bancada e carros.':'Bem-vindo ao vale! Tab abre a mochila; E interage com portas, bancada e veículos; R cuida dos animais.');}
  /** Guest of a co-op room: plays the host's copy of the world; nothing is saved locally. */
  startCoopGuest(data){this.coopReturnMenu=true;this.start(data);}
  endCoopGuest(){this.started=false;this.running=false;this.activeVehicle=null;this.menu('landing');this.landingKey='vale';this.landingCamera(0);}
  atWorkbench(){const p=this.player.position;for(let x=Math.floor(p.x)-4;x<=p.x+4;x++)for(let z=Math.floor(p.z)-4;z<=p.z+4;z++)for(let y=Math.floor(p.y)-1;y<=p.y+2;y++)if(this.world.getBlock(x,y,z)===BLOCK.WORKBENCH&&Math.hypot(x+.5-p.x,y-p.y,z+.5-p.z)<4.5)return true;return false;}
  async action(action,data={},button) {
    if(this.importingSave)return;
    const seedInput=document.querySelector('#seed-input');if(seedInput)this.newSeed=seedInput.value.trim();
    try {
      switch(action) {
        case 'choose-mode':this.newMode=data.mode;this.ui.setMenu('landing',this);break;
        case 'new-game':this.startRealmChoice=this.fullOffer?'':(document.querySelector('#start-realm')?.value||'');if(this.saved)this.menu('replace-save');else this.start();break;
        case 'confirm-new':this.start();break;
        case 'continue':this.start(this.saved);break;
        case 'import-local':case 'recover-save':{
          if(this.importingSave)break;this.importingSave=true;
          try{this.saved=await (action==='import-local'?saves.importLocal():saves.recover());this.saveInfo=saves.info();this.menu('landing');this.ui.toast('Mundo salvo na nuvem. Clique em Continuar mundo salvo.');}
          finally{this.importingSave=false;}break;
        }
        case 'download-backup':{
          const snapshot=this.started?this.snapshot():await saves.backupSnapshot?.();
          if(!snapshot){this.ui.toast('Não há cópia local para baixar.');break;}
          const url=URL.createObjectURL(new Blob([JSON.stringify(snapshot)],{type:'application/json'}));
          const link=document.createElement('a');link.href=url;link.download='valleyblocks-recuperacao.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);break;
        }
        case 'resume':this.resume();break;
        case 'coop-menu':this.menu('coop');break;
        case 'coop-start-host':{
          if(this.coopBusy)break;this.coopBusy=true;
          try{if(!this.started)this.start(this.saved||null);await this.coop.host();this.menu('pause');}catch(error){this.ui.toast(error.message);}finally{this.coopBusy=false;}break;
        }
        case 'coop-host':{
          if(this.coopBusy)break;this.coopBusy=true;
          try{await this.coop.host();this.menu('pause');}catch(error){this.ui.toast(error.message);}finally{this.coopBusy=false;}break;
        }
        case 'coop-join':{
          if(this.coopBusy)break;this.coopBusy=true;
          const code=document.querySelector('#coop-code')?.value||'';
          try{this.ui.toast('Entrando na sala…');await this.coop.join(code);}catch(error){this.ui.toast(error.message);}finally{this.coopBusy=false;}break;
        }
        case 'coop-leave':this.coop.leave();if(this.started)this.menu('pause');break;
        case 'coop-copy':navigator.clipboard?.writeText(this.coop.code).then(()=>this.ui.toast('Código copiado.')).catch(()=>{});break;
        case 'account-login':if(account.state.mode==='portal')account.login();else this.menu('login');break;
        case 'account-submit':{
          const user=document.querySelector('#account-user')?.value,pass=document.querySelector('#account-pass')?.value;
          void account.login(user,pass).then(r=>{if(r.ok&&account.state.username){this.ui.toast(`Olá, ${account.state.username}!`);this.menu(this.started?'pause':'landing');}});break;
        }
        case 'account-logout':void account.logout().then(()=>this.ui.toast('Você saiu da conta.'));break;
        case 'account-signup':window.open(account.signupUrl,'_blank','noopener');break;
        case 'close':if(this.started)this.resume();else this.menu('landing');break;
        // Ações dos controles de toque (o aviso de contexto vira botão; a mochila, a câmera e o voo têm botões próprios).
        case 'context':if(!this.running)break;if(data.key==='R')this.interactPet();else this.interact();break;
        case 'inventory':this.openInventory();break;
        case 'camera':this.cycleCamera();break;
        case 'fly':this.toggleFly();break;
        case 'landing':this.started=false;this.menu('landing');break;
        case 'pause':if(this.started)this.menu('pause');break;
        case 'settings':case 'help':case 'character':this.menu(action);break;
        case 'save':await this.save(true);break;
        case 'save-exit':if(this.coop?.guest){this.coop.leave();break;}if(this.coop?.active)this.coop.leave();if(await this.save(true)){this.started=false;this.activeVehicle=null;this.menu('landing');this.landingKey='vale';this.landingCamera(0);}break;
        case 'slot':this.inventory.select(Number(data.slot));break;
        case 'equip':if(this.inventory.has(data.item)){this.inventory.hotbar[this.inventory.selected]=ITEMS[data.item].id;this.audio.play('inventory');this.ui.setMenu('inventory',this);this.ui.toast(`${ITEMS[data.item].name} no espaço ${this.inventory.selected+1}.`);}break;
        case 'catalog-add':if(this.mode==='creative'&&ITEMS[data.item]&&this.inventory.add(ITEMS[data.item].id)){this.inventory.hotbar[this.inventory.selected]=ITEMS[data.item].id;this.audio.play('inventory');this.ui.setMenu('inventory',this);this.ui.toast(`${ITEMS[data.item].name} adicionado à mochila.`);}break;
        case 'hotbar-pick':this.inventory.select(Number(data.slot));this.ui.setMenu('inventory',this);break;
        case 'hotbar-drop':{
          const slot=Number(data.slot),item=ITEMS[data.item];if(!item||!(slot>=0&&slot<9))break;
          if(!this.inventory.has(item.id)&&!(this.mode==='creative'&&this.inventory.add(item.id)))break;
          this.inventory.hotbar[slot]=item.id;this.inventory.select(slot);this.audio.play('inventory');this.ui.setMenu('inventory',this);this.ui.toast(`${item.name} no espaço ${slot+1}.`);break;
        }
        case 'inventory-tab':this.ui.inventoryTab=data.tab;this.ui.setMenu('inventory',this);break;
        case 'bench-pick':this.ui.benchRecipe=data.recipe;this.ui.setMenu('workbench',this);break;
        case 'bench-tab':this.ui.benchTab=data.tab;this.ui.benchRecipe=null;this.ui.setMenu('workbench',this);break;
        case 'craft':{const result=craft(data.recipe,this.inventory,this.atWorkbench());this.ui.toast(result.message);if(result.ok)this.audio.play('craft');this.ui.setMenu(this.ui.menu==='workbench'?'workbench':'inventory',this);break;}
        case 'heat':{if(this.ui.menu!=='forge'||this.world.getBlock(...(this.focusForge||'').split(',').map(Number))!==BLOCK.FORGE)break;const result=heatMaterial(data.recipe,this.inventory,this.forges[this.focusForge]);this.ui.toast(result.message);if(result.ok)this.audio.play('craft');this.ui.setMenu('forge',this);break;}
        case 'outfit':{
          if(!OUTFITS[data.id])break;
          if(resolveOutfit(data.id,this.ownedPacks)!==data.id){this.ui.toast(`${OUTFITS[data.id].name} faz parte do ${OUTFIT_PACKS[OUTFITS[data.id].pack].name}.`);break;}
          this.settings.outfit=data.id;this.avatar.setOutfit(data.id);this.coop?.setOutfit(data.id);this.audio.play('craft');
          try{localStorage.setItem('vale-settings',JSON.stringify(this.settings));}catch{}
          this.ui.toast(`Você está de ${OUTFITS[data.id].name}.`);this.ui.setMenu('character',this);break;
        }
        case 'trade':{
          const v=this.focusTrader;if(!v||this.ui.menu!=='trade')break;
          const offer=this.stallOf(v).offers.find(o=>o.id===data.offer);
          const result=trade(this.inventory,this.trades,v.stallKey,offer);this.ui.toast(result.message);if(result.ok){this.audio.play('craft');this.goals.trade=true;this.ui.lastHotbar='';}
          this.ui.setMenu('trade',this);break;
        }
        case 'deliver':{
          const v=this.focusTrader;if(!v||this.ui.menu!=='trade')break;
          const result=deliverQuest(questFor(v.realm),this.quests,this.inventory);this.ui.toast(result.message);if(result.ok){this.audio.play('craft');this.ui.lastHotbar='';}
          this.ui.setMenu('trade',this);break;
        }
        case 'quests':this.menu('quests');break;
        case 'claim-quest':{
          const result=claimQuest(QUESTS.find(q=>q.id===data.quest),this.quests,this.inventory,this.goals);this.ui.toast(result.message);if(result.ok){this.audio.play('craft');this.ui.lastHotbar='';}
          this.ui.setMenu('quests',this);break;
        }
        case 'buy-full':{
          if(bridge.standalone){this.ui.toast('A compra fica disponível no portal LABSGames.');break;}
          this.ui.toast('Abrindo o pagamento no portal…');bridge.purchase(FULL_VERSION.product);break;
        }
        case 'buy-pack':{
          const pack=OUTFIT_PACKS[data.pack];if(!pack?.product)break;
          if(bridge.standalone){this.ui.toast('A compra fica disponível no portal LABSGames.');break;}
          this.ui.toast('Abrindo o pagamento no portal…');bridge.purchase(pack.product);break;
        }
        case 'setting':{
          this.settings[data.key]=['music','effects','sensitivity'].includes(data.key)?Number(data.value):data.value;
          if(data.key==='quality')this.settings.shadows=data.value!=='low';
          this.audio.setVolumes(this.settings.music,this.settings.effects);this.resize();
          try{localStorage.setItem('vale-settings',JSON.stringify(this.settings));}catch{}
          if(data.key==='newVisual'){this.ui.toast('Trocando o visual…');(this.started?this.save(true):Promise.resolve()).finally(()=>location.reload());break;}
          this.ui.setMenu('settings',this);break;
        }
        case 'pet-action':{
          const pet=this.focusPet;if(!pet)break;
          if(data.kind==='tame'||data.kind==='feed'){
            if(data.kind==='tame'&&pet.tamed)break;
            if(!this.inventory.remove('food',1)){this.ui.toast('Faltou petisco. Colete folhas e crie mais no inventário.');break;}
          }
          const result=data.kind==='guard'?this.pests.command(pet):data.kind==='hunt'?this.wildlife.command(pet):this.entities.interactPet(pet,data.kind,this.player.position);
          if(data.kind==='tame')this.goals.pet=true;
          this.ui.toast(result);this.ui.setMenu('pet',this);break;
        }
        case 'rest':{const message=restEligibility(this,this.focusSofa);if(message){this.ui.toast(message);break;}this.restRemaining=3;this.menu('resting');break;}
        case 'whistle':this.whistle();if(this.ui.menu==='storage')this.ui.setMenu('storage',this);break;
        case 'passenger':if(this.activeVehicle?.passenger){this.focusPet=this.activeVehicle.passenger;this.menu('pet');}break;
        case 'rename-pet':{
          const name=document.querySelector('#pet-name')?.value.trim();if(name){this.focusPet.name=name.slice(0,20);this.ui.toast(`Seu companheiro agora se chama ${this.focusPet.name}.`);this.ui.setMenu('pet',this);}break;
        }
        case 'deposit':case 'withdraw':{
          const store=this.focusStorage?.items;if(!store)break;
          const available=action==='deposit'?this.inventory.count(data.item):store[data.item]||0;
          const n=Math.min(8,available);if(!Number.isFinite(n)||n<=0)break;
          const result=action==='deposit'?transferItems(this.inventory,store,data.item,n):transferItems(store,this.inventory,data.item,n);
          if(result.ok)this.audio.play('inventory');else this.ui.toast(result.message);this.ui.setMenu('storage',this);break;
        }
      }
    } catch(error){console.error(error);this.ui.toast(`Não foi possível completar a ação: ${error.message}`);}
  }
  bindInput() {
    this.events=new AbortController();const options={signal:this.events.signal};
    window.addEventListener('resize',()=>this.resize(),options);
    window.addEventListener('keydown',e=>{
      if(e.target.matches('input,select,textarea'))return;
      if(['Tab','Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
      if(e.code==='Escape'){
        if(this.running)this.menu('pause');else if(this.started&&this.ui.menu!=='pause')this.menu('pause');return;
      }
      if(e.code==='Tab'&&this.started&&!e.repeat){this.openInventory();return;}
      if(e.target?.matches?.('input,textarea,select')&&e.code!=='Escape')return;
      if(this.ui.menu==='inventory'&&/^Digit[1-9]$/.test(e.code)){this.inventory.select(Number(e.code.slice(-1))-1);this.ui.setMenu('inventory',this);return;}
      if(!this.running)return;
      if(/^(Key[WASDEVCHLF]|Space|ShiftLeft|ShiftRight|ControlLeft|ControlRight|Digit[1-9])$/.test(e.code))e.preventDefault();
      this.keys.add(e.code);if(e.repeat)return;
      if(/^Digit[1-9]$/.test(e.code))this.inventory.select(Number(e.code.slice(-1))-1);
      if(e.code==='KeyE')this.interact();
      if(e.code==='KeyR'&&!this.activeVehicle&&!this.activeBoat)this.interactPet();
      if(e.code==='KeyV')this.toggleFly();
      if(e.code==='KeyC')this.cycleCamera();
      if(e.code==='KeyJ'){this.menu('quests');return;}
      if(e.code==='KeyQ'){this.whistle();return;}
      if(e.code==='KeyL'&&this.activeVehicle)this.entities.toggleLights(this.activeVehicle);
      if(e.code==='KeyH'&&this.activeVehicle)this.audio.play('horn',this.activeVehicle.position);
      if(e.code==='KeyF'){if(bridge.standalone){if(document.fullscreenElement)document.exitFullscreen();else document.documentElement.requestFullscreen().catch(()=>{});}else bridge.requestFullscreen();}
    },options);
    window.addEventListener('keyup',e=>this.keys.delete(e.code),options);
    window.addEventListener('blur',()=>{if(this.running)this.menu('pause');},options);
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&this.started){if(this.running)this.menu('pause');this.save(false);}},options);
    document.addEventListener('pointerlockchange',()=>{if(!TOUCH&&document.pointerLockElement!==canvas&&this.running)this.menu('pause');},options);
    document.addEventListener('mousemove',e=>{if(this.running&&!this.activeVehicle&&(document.pointerLockElement===canvas||this.mouseDragging))this.player.look(e.movementX,e.movementY,this.settings.sensitivity);},options);
    canvas.addEventListener('mousedown',e=>{
      if(!this.running||TOUCH)return;
      if(e.altKey){this.mouseDragging=true;return;}
      if(document.pointerLockElement!==canvas){canvas.requestPointerLock()?.catch(()=>{});return;}
      if(this.activeVehicle)return;
      if(e.button===0)this.primaryDown();
      if(e.button===2)this.place();
    },options);
    window.addEventListener('mouseup',e=>{if(e.button===0&&!TOUCH)this.primaryUp();this.mouseDragging=false;},options);
    canvas.addEventListener('contextmenu',e=>e.preventDefault(),options);
    window.addEventListener('wheel',e=>{if(this.running&&!this.activeVehicle){e.preventDefault();this.inventory.select(this.inventory.selected+Math.sign(e.deltaY));}}, {...options,passive:false});
  }
  interaction(withPets=false) {
    if(this.activeBoat)return {kind:'leave-boat'};
    if(this.activeVehicle)return {kind:'exit'};
    const p=this.player.position;
    const eye=this.player.eye,direction=this.player.direction;
    const pets=(withPets?this.entities.pets:[]).filter(pet=>pet.position.distanceTo(p)<4).sort((a,b)=>a.position.distanceToSquared(p)-b.position.distanceToSquared(p));
    for(const pet of pets){
      const offset=pet.position.clone().add(new THREE.Vector3(0,pet.vehicleId?.45:.72,0)).sub(eye);
      const along=offset.dot(direction),distance=offset.length();
      const aimed=along>0&&offset.lengthSq()-along*along<(pet.vehicleId?.065:.3);
      if(this.inventory.selectedItem!=='food'&&!aimed)continue;
      const obstacle=this.world.raycast(eye,offset.normalize(),distance);
      if(!obstacle||obstacle.distance>=distance-.3)return {kind:'pet',entity:pet};
    }
    if(withPets)return null;
    const boat=this.boats.nearest(p,3);if(boat)return {kind:'boat',entity:boat};
    const trailer=this.trailers.nearest(p,2.6);if(trailer)return {kind:'trailer',entity:trailer};
    const nearest=this.entities.nearest(p,3.8);
    if(nearest&&nearest.kind!=='pet')return nearest;
    const trader=this.wildlife.animals.filter(a=>(a.type==='vendedor'||a.type==='morador')&&a.position.distanceTo(p)<3.2).sort((a,b)=>a.position.distanceToSquared(p)-b.position.distanceToSquared(p))[0];
    if(trader){trader.stallKey=`${Math.floor(trader.home.x)},${Math.floor(trader.home.z)}`;trader.stallSeed=Math.floor(trader.home.x)+Math.floor(trader.home.z);return {kind:'trader',entity:trader};}
    const hit=this.target;
    if(hit&&hit.distance<=5&&[BLOCK.CHEST,BLOCK.WORKBENCH,BLOCK.DOOR,BLOCK.FORGE,BLOCK.WOOD,BLOCK.PORTAL,BLOCK.SOFA,BLOCK.TV].includes(hit.id)||hit&&hit.distance<=5&&PORTAL_BLOCKS.has(hit.id))return {kind:'block',hit};
    for(const door of Object.values(this.doors))if(door.open&&Math.hypot(door.x+.5-p.x,door.y-p.y,door.z+.5-p.z)<2.8)return {kind:'door',door};
    return null;
  }
  /** R: cuidar dos animais (antes no E, que conflitava com portas, carro e bancada). */
  /** Desgaste: avisa quando falta pouco e quando a ferramenta quebra. */
  wearTool(id){
    const result=this.inventory.useTool(id);if(!result)return;
    if(result.broke){this.ui.toast(`${result.name} quebrou! Faça outra peça na bancada.`);this.audio.play('hunt-hit',this.player.position);this.ui.lastHotbar='';}
    else if(result.left===10)this.ui.toast(`${ITEMS[id].name}: está quase quebrando.`);
  }
  interactPet(){
    const action=this.interaction(true);
    if(action?.kind==='pet'){this.focusPet=action.entity;this.menu('pet');}
    else this.ui.toast('Chegue perto de um animal e olhe para ele para usar o R.');
  }
  interact() {
    if(!this.activeVehicle)this.target=this.world.raycast(this.player.eye,this.player.direction,6);
    const action=this.interaction();if(!action)return;
    if(action.kind==='leave-boat'){
      const spot=this.boats.landing(this.activeBoat,(x,z,y)=>this.entities.safeStand(x,z,y,1.8,.3,2.5,3));
      if(!spot){this.ui.toast('Chegue mais perto da margem para desembarcar.');return;}
      this.activeBoat.speed=0;this.activeBoat=null;this.player.position.copy(spot);this.player.velocity.set(0,0,0);this.resetInput();this.ui.toast('Você desembarcou.');return;
    }
    if(action.kind==='boat'){this.activeBoat=action.entity;this.player.flying=false;this.player.velocity.set(0,0,0);this.resetInput();this.audio.play('door');this.ui.toast('W acelera · S ré · A D vira · E desembarca');return;}
    if(action.kind==='trailer'){this.focusStorage={items:action.entity.cargo,key:'trailer:'+action.entity.id,trailer:true};this.audio.play('door');this.menu('storage');return;}
    if(action.kind==='exit'){
      const exit=this.entities.findExit(this.activeVehicle);
      if(!exit){this.ui.toast(this.activeVehicle.grounded===false?'Aguarde o carro tocar o chão antes de sair.':Math.abs(this.activeVehicle.speed)>.25?'Pare o carro antes de sair.':'Não há espaço seguro. Estacione longe das paredes.');return;}
      this.player.position.copy(exit);this.player.velocity.set(0,0,0);this.player.yaw=Math.PI+this.activeVehicle.yaw;this.player.pitch=-.07;
      this.activeVehicle.speed=0;this.activeVehicle=null;this.audio.engine(0);this.audio.play('door');this.resetInput();this.updateCamera(1);return;
    }
    if(action.kind==='vehicle'){
      if(action.entity.grounded===false||Math.abs(action.entity.verticalVelocity||0)>.5||Math.abs(action.entity.speed)>.25){this.ui.toast('Espere o carro parar no chão antes de entrar.');return;}
      this.activeVehicle=action.entity;this.player.flying=false;this.internalCamera=false;this.goals.drive=true;
      this.player.inWater=false;
      this.resetInput();this.audio.play('door');this.updateCamera(1);this.ui.toast('W acelera · S freia · Q assovia/manda o companheiro descer · E sai');return;
    }
    if(action.kind==='pet'){this.focusPet=action.entity;this.menu('pet');return;}
    if(action.kind==='trader'){this.focusTrader=action.entity;action.entity.yaw=Math.atan2(this.player.position.x-action.entity.position.x,this.player.position.z-action.entity.position.z);action.entity.goal=null;this.audio.play('inventory');this.menu('trade');return;}
    if(action.kind==='door'){this.toggleDoor(action.door);return;}
    if(PORTAL_BLOCKS.has(action.hit?.id)){const result=this.realms.travel(action.hit.id,this.player,this.entities,this.world);this.ui.toast(result.message);if(result.ok){this.resetInput();this.updateCamera(1);this.audio.play('craft');if(result.realm)this.ui.arrival(result.realm);}return;}
    if(action.hit?.id===BLOCK.PORTAL){const result=this.world.underworld.travel(this.player,this.entities);this.ui.toast(result.message);if(result.ok){this.resetInput();this.updateCamera(1);this.audio.play('door');}return;}
    if(action.hit?.id===BLOCK.WOOD){const result=this.resin.collect(action.hit,this.inventory);this.ui.toast(result.message);if(result.ok)this.audio.play('collect');return;}
    if(action.hit?.id===BLOCK.SOFA){this.focusSofa=action.hit;this.menu('sofa');return;}
    if(action.hit?.id===BLOCK.TV){const h=action.hit,key=this.blockKey(h);if(this.world.televisions.has(key))this.world.televisions.delete(key);else this.world.televisions.add(key);this.world._dirtyCell(h.x,h.z);this.audio.play('click');this.ui.toast(this.world.televisions.has(key)?'TV ligada — Paisagens do Vale.':'TV desligada.');return;}
    if(action.hit?.id===BLOCK.WORKBENCH){this.menu('workbench');return;}
    if(action.hit?.id===BLOCK.FORGE){this.openForge(action.hit);return;}
    if(action.hit?.id===BLOCK.CHEST){const key=this.blockKey(action.hit);this.chests[key]??={};this.focusStorage={items:this.chests[key],key};this.audio.play('door');this.menu('storage');return;}
    if(action.hit?.id===BLOCK.DOOR){const h=action.hit;const y=this.world.getBlock(h.x,h.y-1,h.z)===BLOCK.DOOR?h.y-1:h.y;const key=`${h.x},${y},${h.z}`;this.doors[key]??={x:h.x,y,z:h.z,open:false};this.toggleDoor(this.doors[key]);}
  }
  whistle(){
    if(this.whistleCooldown>0)return;
    this.whistleCooldown=.8;
    const vehicle=this.activeVehicle||this.entities.vehicles.filter(v=>v.passenger&&v.position.distanceTo(this.player.position)<6).sort((a,b)=>a.position.distanceToSquared(this.player.position)-b.position.distanceToSquared(this.player.position))[0];
    this.ui.toast(this.entities.whistle(vehicle,this.player.position));
  }
  toggleDoor(door) {
    const {x,y,z}=door;
    if(door.open&&![this.world.getBlock(x,y,z),this.world.getBlock(x,y+1,z)].every(id=>id===BLOCK.AIR||id===BLOCK.WATER)){this.ui.toast('Retire os blocos colocados no vão antes de fechar a porta.');return;}
    if(door.open&&(this.player.overlaps(x,y,z)||this.player.overlaps(x,y+1,z)||this.entities.blocksPlacement(x,y,z)||this.entities.blocksPlacement(x,y+1,z))){this.ui.toast('O espaço da porta precisa estar livre.');return;}
    door.open=!door.open;this.world.setBlock(x,y,z,door.open?0:BLOCK.DOOR);this.world.setBlock(x,y+1,z,door.open?0:BLOCK.DOOR);this.audio.play('door',new THREE.Vector3(x,y,z));
  }
  blockKey(hit){return `${hit.x},${hit.y},${hit.z}`;}
  openForge(hit){this.focusForge=this.blockKey(hit);this.forges[this.focusForge]??={water:0};this.menu('forge');}
  canPlace(x,y,z){const id=this.world.getBlock(x,y,z);return y>0&&y<63&&(id===BLOCK.AIR||id===BLOCK.WATER||id===BLOCK.LAVA)&&!this.world.sand.intersects(x,y,z)&&!this.player.overlaps(x,y,z)&&!this.entities.blocksPlacement(x,y,z)&&!this.wildlife.blocksPlacement(x,y,z)&&!this.enemies.blocksPlacement(x,y,z)&&!this.pests.blocksPlacement(x,y,z);}
  place() {
    if(this.activeVehicle||!this.running)return false;
    const id=this.inventory.selectedItem;
    if(id==='boat'){
      const result=this.boats.place(this.world.raycast(this.player.eye,this.player.direction,8,true),this.player.yaw+Math.PI);
      this.ui.toast(result.message);if(result.ok){this.inventory.remove('boat');this.audio.play('craft');}return result.ok;
    }
    if(id==='trailer'){
      const result=this.trailers.place(this.player.position);this.ui.toast(result.message);if(result.ok){this.inventory.remove('trailer');this.audio.play('craft');}return result.ok;
    }
    if(id==='fishing_rod'){
      const result=this.fishing.use(this.player,this.inventory,this.world.biomeAt(this.player.position.x,this.player.position.z));
      this.ui.toast(result.message);if(result.caught){this.audio.play('collect',this.player.position);this.wearTool('fishing_rod');}return result.ok;
    }
    if(this.fishing.active)this.fishing.stop();
    if(id==='flask'){
      if(!this.enemies.collectAcid(this.player.position)){this.ui.toast('Chegue perto de uma poça verde do Espectro para coletar o ácido.');return false;}
      this.inventory.remove('flask');this.inventory.add('specter_acid');this.ui.toast('Ácido do Espectro coletado.');this.audio.play('collect',this.player.position);return true;
    }
    if(id==='portal_spray'){
      const result=activatePortal(this.world,this.world.raycast(this.player.eye,this.player.direction,6));this.ui.toast(result.message);
      if(result.ok){if(this.mode==='survival')this.inventory.remove('portal_spray');this.audio.play('craft',this.player.position);}
      return result.ok;
    }
    if(id==='bucket'||id==='water_bucket'){
      const hit=this.world.raycast(this.player.eye,this.player.direction,6,true);
      const result=useBucket(this.world,this.inventory,hit,(x,y,z)=>this.canPlace(x,y,z),this.forges);
      this.ui.toast(result.message);if(result.ok)this.audio.play('place',this.player.position);return result.ok;
    }
    const target=this.world.raycast(this.player.eye,this.player.direction,6);
    if(target?.id===BLOCK.FORGE&&target.distance<=5){this.openForge(target);return true;}
    if(id==='food'){
      const nearby=this.interaction();
      if(nearby?.kind==='pet'){this.focusPet=nearby.entity;this.menu('pet');return false;}
    }
    if(FOODS[id]){const result=eatFood(this.player,this.inventory,id,this.mode);this.ui.toast(result.message);if(result.ok)this.audio.play('eat');return result.ok;}
    if(!target)return false;
    const {x:nx,y:ny,z:nz}=target.normal;let x=target.x+nx,y=target.y+ny,z=target.z+nz;
    if(id==='car'||id==='utility'){
      if(!this.inventory.has(id)){this.ui.toast('Crie este veículo na bancada.');return false;}
      if(this.entities.vehicles.length>=8){this.ui.toast('Este mundo já tem 8 veículos.');return false;}
      const pos=new THREE.Vector3(x+.5,this.world.heightAt(x+.5,z+.5,y+1)??y,z+.5);
      const type=id==='utility'?'pickup':'compact';
      const placement=this.entities.findVehiclePlacement(type,pos,Math.PI,this.player.box());
      if(!placement){this.ui.toast('O veículo precisa de espaço livre: 3 × 5 blocos e chão firme.');return false;}
      const car=this.entities.spawnVehicle(type,placement);
      if(!car){this.ui.toast('O veículo precisa de espaço livre e chão firme.');return false;}
      this.inventory.remove(id);this.audio.play('craft');this.ui.toast('Sua garagem ganhou um novo veículo!');return true;
    }
    if(!Number.isInteger(id)||id<1)return false;
    if(!this.inventory.has(id)){this.ui.toast('Este material acabou. Colete ou crie mais.');return false;}
    if(!this.canPlace(x,y,z)||(id===BLOCK.DOOR&&!this.canPlace(x,y+1,z))){this.ui.toast('Deixe espaço livre para você, os animais e os veículos.');return false;}
    if(id===BLOCK.TORCH&&!this.world.canSupportTorch(x,y,z)){this.ui.toast('Tochas precisam de um bloco firme e seco por baixo. Não podem ficar sobre outra tocha.');return false;}
    if(!this.inventory.remove(id))return false;
    if(!this.world.setBlock(x,y,z,id,id===BLOCK.RAMP?rampFacingFromYaw(this.player.yaw):0)){this.inventory.add(id);return false;}
    if(id===BLOCK.DOOR){this.world.setBlock(x,y+1,z,id);this.doors[`${x},${y},${z}`]={x,y,z,open:false};}
    if(id===BLOCK.CHEST)this.chests[`${x},${y},${z}`]??={};
    if(id===BLOCK.FORGE)this.ui.toast('Churrasqueira colocada! Aponte e pressione E ou clique com o botão direito para ver todos os preparos.');
    this.goals.build=true;this.audio.play('place',new THREE.Vector3(x,y,z));this.torchTimer=0;return true;
  }
  mine(dt) { mineBlock(this, dt); }
  updateTarget(dt) {
    this.attackCooldown=Math.max(0,this.attackCooldown-dt);
    const prey=!this.activeVehicle&&this.combat.raycast(this.player.eye,this.player.direction,RANGED[this.inventory.selectedItem]?RANGED[this.inventory.selectedItem].speed:3.6);
    if(prey){
      this.target=null;this.selection.visible=false;this.miningProgress=0;
      this.ui.target(`${(PESTS[prey.animal.type]||ENEMIES[prey.animal.type]||SPECIES[prey.animal.type]).name} · ${Math.ceil(prey.animal.health)} · ${RANGED[this.inventory.selectedItem]?'Clique para disparar uma pedrinha':'Segure o botão esquerdo para atacar'}`);this.ui.context('');
      if(this.mining&&this.attackCooldown<=0&&!RANGED[this.inventory.selectedItem]){
        this.attackCooldown=.65;
        if(this.mode==='survival'&&this.player.stamina<5){this.ui.toast('Recupere o fôlego antes de atacar.');return;}
        const equipped=this.inventory.has(this.inventory.selectedItem)?this.inventory.selectedItem:null;
        if(this.combat.strike(prey.animal,WEAPON_DAMAGE[equipped]??(TOOLS[equipped]?.kind==='axe'?22:TOOLS[equipped]?.kind==='pickaxe'?14:8),this.player.position)){
          if(this.mode==='survival')this.player.stamina=Math.max(0,this.player.stamina-5);
          this.wearTool(equipped);
          this.audio.play('hunt-hit',prey.animal.position);
        }
      }return;
    }
    this.target=this.activeVehicle?null:this.world.raycast(this.player.eye,this.player.direction,6,['bucket','water_bucket'].includes(this.inventory.selectedItem));
    this.selection.visible=!!this.target&&this.running;
    if(this.target)this.selection.position.set(this.target.x+.5,this.target.y+.5,this.target.z+.5);
    this.mine(dt);
    const equipped=this.inventory.has(this.inventory.selectedItem)?this.inventory.selectedItem:null;
    const required=this.target?miningRequirement(this.target.id,equipped):'';
    this.ui.target(this.target?.id===BLOCK.WOOD?'Madeira · Segure o botão esquerdo para cortar':this.target?`${BLOCKS[this.target.id].name}${required?' · '+required:''}`:'',this.miningProgress);
    const context=this.interaction(),petContext=!context&&!this.activeVehicle&&!this.activeBoat?this.interaction(true):null;
    if(context?.kind==='boat'||context?.kind==='leave-boat'||context?.kind==='trailer'){this.ui.context(context.kind==='boat'?'Embarcar no barco':context.kind==='trailer'?'Abrir a caçamba da carretinha':'Desembarcar');return;}
    if(petContext?.kind==='pet'){this.ui.context(`Conhecer ${petContext.entity.name}`,'R');return;}
    this.ui.context(context?.kind==='trader'?`${context.entity.type==='morador'?'Conversar':'Negociar'} · ${this.stallOf(context.entity).name}`:context?.kind==='exit'?(this.vehicleStopped(this.activeVehicle)?'Sair do carro':''):context?.kind==='vehicle'?(context.entity.passenger?'Entrar no carro · Q para desembarcar companheiro':'Entrar no carro'):context?.kind==='pet'?`Conhecer ${context.entity.name}`:context?.kind==='door'?'Fechar porta':context?.hit?.id===BLOCK.PORTAL?'Atravessar portal':context?.hit?.id===BLOCK.WOOD?'Coletar resina (opcional)':context?.hit?.id===BLOCK.CHEST?'Abrir baú':context?.hit?.id===BLOCK.WORKBENCH?'Usar bancada':context?.hit?.id===BLOCK.FORGE?'Usar churrasqueira':context?.hit?.id===BLOCK.SOFA?'Descansar no sofá':context?.hit?.id===BLOCK.TV?(this.world.televisions.has(this.blockKey(context.hit))?'Desligar TV':'Ligar TV'):context?.hit?.id===BLOCK.DOOR?'Abrir porta':'');
  }
  /** Carro no chão e praticamente parado: só então pode sair (e só então o aviso aparece). */
  vehicleStopped(vehicle){return !!vehicle&&vehicle.grounded!==false&&Math.abs(vehicle.speed)<=.25;}
  /** Em cavernas e túneis escavados a luz do dia vai sumindo; tochas e faróis continuam iluminando. */
  updateCaveLight(dt,focus,underground){
    this.caveClock=(this.caveClock||0)+dt;
    if(this.caveTarget===undefined||this.caveClock>=.15){this.caveClock=0;this.caveTarget=underground||!this.started?0:this.world.burial(focus.x,focus.y+1,focus.z);}
    this.caveDarkness=THREE.MathUtils.lerp(this.caveDarkness||0,this.caveTarget,1-Math.exp(-dt*2.5));
    const d=this.caveDarkness;if(d<.002)return;
    this.sky.ambient.intensity=THREE.MathUtils.lerp(this.sky.ambient.intensity,.14,d);
    this.sky.sun.intensity=THREE.MathUtils.lerp(this.sky.sun.intensity,0,d);
    const dark=new THREE.Color('#06090b');this.scene.background.lerp(dark,d*.92);if(this.scene.fog){this.scene.fog.color.lerp(dark,d*.92);this.scene.fog.near*=1-d*.6;this.scene.fog.far*=1-d*.45;}
    this.sky.sunDisc.visible=this.sky.sunDisc.visible&&d<.5;
  }
  playerEntityCollision(min,max) {
    return this.entities.vehicles.some(vehicle=>this.entities.vehicleIntersectsBox(vehicle,min,max,.13));
  }
  simulate(dt) {
    const focus=this.activeVehicle?.position||this.player.position;
    this.world.step(dt,focus.x,focus.z);
    this.whistleCooldown=Math.max(0,this.whistleCooldown-dt);
    this.player.working=this.mining;
    if(this.activeVehicle){this.player.position.copy(this.activeVehicle.position);updateNeeds(this.player,dt,this.mode);if(this.player.health<=0){this.activeVehicle=null;this.player.health=100;this.player.hunger=75;this.player.stamina=100;this.player.safeSpawn();this.ui.toast('Você voltou ao início. Alimente-se para continuar.');}}
    else if(this.activeBoat){this.boats.drive(this.activeBoat,dt,this.keys);this.player.position.copy(this.boats.seat(this.activeBoat));this.player.velocity.set(0,0,0);updateNeeds(this.player,dt,this.mode);}
    else if(this.player.update(dt,this.keys,this.mode,(a,b)=>this.playerEntityCollision(a,b))==='respawn')this.ui.toast('Você voltou ao início em segurança.');
    {const ev=this.fishing.update(dt,this.player);if(ev==='bite'){this.ui.toast('Fisgou! Botão direito agora para puxar!');this.audio.play('hunt-hit',this.player.position);}else if(ev==='escaped')this.ui.toast(this.fishing.active?'O peixe escapou. A linha continua na água.':'A linha voltou para a vara.');if(this.fishing.active&&this.inventory.selectedItem!=='fishing_rod')this.fishing.stop();}
    this.boats.update(dt);this.trailers.update(dt);
    this.slingshot.update(dt);this.wildlife.update(dt,this.player.position,this.inventory);this.skeletons.update(this.player.position);
    this.pests.update(dt,this.player,this.chests,this.mode);
    this.entities.update(dt,this.player.position,this.keys,this.activeVehicle);
    this.enemies.update(dt,this.player,this.time,this.mode);
    if(this.activeVehicle)this.player.position.copy(this.activeVehicle.position);
    if(TEST_TIME==null)this.time=(this.time+dt/1440)%1;
    this.residentClock-=dt;if(this.residentClock<=0){this.residentClock=2;this.updateResidents();}
    this.tradeClock+=dt;if(this.tradeClock>=240){restock(this.trades,this.tradeClock);this.tradeClock=0;}
    this.updateTarget(dt);
    for(const drop of this.world.drainDrops()){
      this.inventory.add(drop.id,drop.count);
      this.particles.burst(drop.x+.3,drop.y+.2,drop.z+.3,BLOCKS[drop.id].color,8);
      this.audio.play('collect',new THREE.Vector3(drop.x,drop.y,drop.z));this.torchTimer=0;
    }
    this.audio.update(dt,{position:this.player.eye,forward:this.player.direction,time:this.time,moving:!this.activeVehicle&&this.player.grounded&&Math.hypot(this.player.velocity.x,this.player.velocity.z)>.3,material:this.world.getBlock(this.player.position.x,this.player.position.y-.15,this.player.position.z),inWater:this.player.inWater,panting:this.mode==='survival'?this.player.panting:0});
    {const e=this.player.eye,eyeLava=this.world.getBlock(Math.floor(e.x),Math.floor(e.y),Math.floor(e.z))===BLOCK.LAVA;
     const v=eyeLava?1:this.player.inLava?.45:0;if(v!==this.lavaVision){this.lavaVision=v;this.lavaOverlay??=Object.assign(document.body.appendChild(document.createElement('div')),{className:'lava-vision'});this.lavaOverlay.style.opacity=String(v);}}
    this.autoSave+=dt;if(this.autoSave>=30){this.autoSave=0;this.save(false);}
  }
  updateCamera(dt) {
    if(this.activeVehicle){
      const view=this.entities.vehicleCamera(this.activeVehicle,this.internalCamera);
      if(this.internalCamera)this.camera.position.copy(view.position);else this.camera.position.lerp(view.position,1-Math.exp(-8*dt));
      this.camera.lookAt(view.target);
      // Keep the smooth chase path outside walls as well as its final target.
      if(!this.internalCamera){const anchor=this.activeVehicle.position.clone().add(new THREE.Vector3(0,1.7,0));const ray=this.camera.position.clone().sub(anchor);const len=ray.length();const hit=this.world.raycast(anchor,ray.normalize(),len);if(hit)this.camera.position.copy(anchor).addScaledVector(ray,Math.max(.35,hit.distance-.3));}
    } else if(this.cameraMode!=='first'){
      const view=playerCamera(this.world,this.player,this.cameraMode);this.camera.position.copy(view.position);this.camera.lookAt(view.target);
      this.avatar.body.visible=view.distance>.7;
    } else {
      this.camera.position.copy(this.player.eye);
      if(this.player.grounded&&this.running&&this.player.velocity.length()>1)this.camera.position.y+=Math.sin(this.player.distance*3.6)*.028;
      this.camera.rotation.order='YXZ';this.camera.rotation.set(this.player.pitch,this.player.yaw,0);
    }
  }
  updateTorches(dt) {
    this.torchTimer-=dt;if(this.torchTimer>0)return;this.torchTimer=2;
    const p=this.started?this.player.position:new THREE.Vector3(-4,9,2),found=[];
    for(let x=Math.floor(p.x)-10;x<=p.x+10;x++)for(let z=Math.floor(p.z)-10;z<=p.z+10;z++)for(let y=Math.max(1,Math.floor(p.y)-3);y<=Math.min(63,p.y+6);y++)if(this.world.getBlock(x,y,z)===BLOCK.TORCH)found.push(new THREE.Vector3(x+.5,y+.9,z+.5));
    found.sort((a,b)=>a.distanceToSquared(p)-b.distanceToSquared(p));
    for(let i=0;i<6;i++){if(!this.torchLights[i]){const light=new THREE.PointLight(0xffc478,0,9,1.6);this.torchLights.push(light);this.scene.add(light);}this.torchLights[i].intensity=found[i]?7:0;if(found[i])this.torchLights[i].position.copy(found[i]);}
  }
  /** Brasas que sobem e fumaça lenta perto do jogador nas terras com efeito (Submundo). */
  updateRealmFx(fx,focus){
    if(!fx){if(this.realmFx)this.realmFx.group.visible=false;return;}
    if(!this.realmFx){
      // Partícula redonda e macia (degradê radial), para brasa e fumaça não virarem quadrados.
      const c=document.createElement('canvas');c.width=c.height=32;const x=c.getContext('2d'),gr=x.createRadialGradient(16,16,0,16,16,16);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.5,'rgba(255,255,255,.5)');gr.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=gr;x.fillRect(0,0,32,32);const soft=new THREE.CanvasTexture(c);
      const group=new THREE.Group(),make=(count,size,color,opacity,additive)=>{const g=new THREE.BufferGeometry(),p=new Float32Array(count*3);for(let i=0;i<count;i++){p[i*3]=(Math.random()-.5)*40;p[i*3+1]=Math.random()*24;p[i*3+2]=(Math.random()-.5)*40;}g.setAttribute('position',new THREE.BufferAttribute(p,3));const m=new THREE.PointsMaterial({color,size,map:soft,alphaTest:.01,transparent:true,opacity,depthWrite:false,blending:additive?THREE.AdditiveBlending:THREE.NormalBlending});const pts=new THREE.Points(g,m);pts.frustumCulled=false;group.add(pts);return pts;};
      this.realmFx={group,embers:make(320,.07,'#ffa040',.95,true),smoke:make(70,2.2,'#4a3a36',.16,false),last:performance.now()};this.scene.add(group);
    }
    const fxs=this.realmFx,now=performance.now(),dt=Math.min(.1,(now-fxs.last)/1000);fxs.last=now;fxs.group.visible=true;fxs.group.position.set(focus.x,focus.y-4,focus.z);
    for(const [pts,rise,sway] of [[fxs.embers,2.2,.9],[fxs.smoke,.7,.3]]){const a=pts.geometry.attributes.position;for(let i=0;i<a.count;i++){let y=a.getY(i)+rise*dt;if(y>24)y=0;a.setY(i,y);a.setX(i,a.getX(i)+Math.sin(now/700+i)*sway*dt);}a.needsUpdate=true;}
  }
  stallOf(v){return v.type==='morador'?residentFor(v.realm):stallFor(v.stallSeed);}
  /** Marca terras visitadas e põe o morador da terra perto do portal de chegada. */
  updateResidents(){
    const p=this.player.position,key=realmAt(p.x,p.z);if(!key)return;
    if(!this.quests.visited[key]){this.quests.visited[key]=true;if(QUESTS.some(q=>q.realm===key||q.kind==='visits'))this.ui.toast('Nova página no livro de missões (J).');}
    if(!residentFor(key)||this.wildlife.animals.some(a=>a.type==='morador'&&a.realm===key))return;
    const [cx,cz]=REALMS[key].center,x=cx+5.5,z=cz+4.5;if(Math.hypot(p.x-x,p.z-z)>60)return;
    const at=this.wildlife.spawnPoint(x,z,40);if(at)this.wildlife.spawn('morador',at,{realm:key});
  }
  snapshot(){return structuredClone({version:1,trades:this.trades,quests:this.quests,boats:this.boats.serialize(),trailers:this.trailers.serialize(),starterGrillVersion:1,homeFurnitureVersion:1,televisions:[...this.world.televisions],generatorVersion:this.world.generatorVersion,geology:this.world.geology.serialize(),underworld:this.world.underworld.serialize(),realms:this.realms.serialize(),seed:this.seed,mode:this.mode,edits:this.world.serialize(),fluids:this.world.serializeFluids(),dynamics:this.world.sand.serialize(),forges:this.forges,cameraMode:this.cameraMode,wildlife:this.wildlife.serialize(),enemies:this.enemies.serialize(),pests:this.pests.serialize(),player:this.player.serialize(),inventory:this.inventory.serialize(),resin:this.resin.serialize(),chests:this.chests,doors:this.doors,time:this.time,entities:this.entities.serialize(),activeVehicle:this.activeVehicle?.id||null,internalCamera:this.internalCamera,settings:this.settings,goals:this.goals});}
  async save(manual=false) {
    if(!this.started)return false;
    if(this.coop?.guest){if(manual)this.ui.toast('Na sala de um amigo, quem salva o mundo é o anfitrião.');return false;}
    if(this.savePromise){try{await this.savePromise;}catch{return false;}return this.save(manual);}
    const snapshot=this.snapshot();this.ui.saveStatus('Salvando seu mundo…');
    this.savePromise=saves.save(snapshot);
    try{await this.savePromise;this.saved=structuredClone(snapshot);this.saveFailure='';this.saveInfo=saves.info();this.ui.saveStatus(this.cloudSaves?'Salvo na nuvem ✓':'Mundo salvo agora ✓');if(manual)this.ui.toast(this.cloudSaves?'Seu mundo foi salvo na nuvem.':'Seu mundo foi salvo neste navegador.');return true;}
    catch(error){this.saveFailure=error.message;this.saveInfo=saves.info();if(this.cloudSaves&&!this.disposed)this.menu('pause');this.ui.saveStatus('Falha ao salvar');this.ui.toast(error.message);return false;}
    finally{this.savePromise=null;}
  }
  frame(now) {
    if(this.disposed)return;
    const raw=(now-this.lastFrame)/1000,dt=Math.min(.2,Math.max(0,raw));this.lastFrame=now;this.elapsed+=dt;
    if(this.ui.menu==='resting'){
      this.restRemaining-=dt;
      if(this.restRemaining<=0){const result=completeRest(this,this.focusSofa);this.ui.toast(result.message);this.menu('pause');}
    }
    if(this.running){this.accumulator=Math.min(this.accumulator+dt,.2);while(this.accumulator>=FIXED_STEP){this.simulate(FIXED_STEP);this.accumulator-=FIXED_STEP;}this.updateCamera(dt);}
    else{this.accumulator=0;if(!this.started)this.landingCamera(this.elapsed);}
    const focus=this.started?this.activeVehicle?.position||this.player.position:this.landingFocus();
    this.world.update(focus.x,focus.z,({low:1,medium:3,high:4})[this.settings.quality]);
    this.sky.update(this.time,this.running||!this.started?dt:0,focus,{...this.settings,preview:!this.started});
    if(this.sky.dome&&this.world.waterSky){const d=this.sky.dome.material.uniforms,w=this.world.waterSky;w.top.value.copy(d.top.value);w.horizon.value.copy(d.horizon.value);w.glow.value.copy(d.glow.value);w.sunDir.value.copy(d.sunDir.value);}
    const underground=this.world.underworld.contains(focus);
    this.updateCaveLight(dt,focus,underground);
    if(underground){this.scene.background.set('#241b2f');if(this.scene.fog)this.scene.fog.color.set('#241b2f');this.sky.ambient.intensity=.95;this.sky.sun.intensity=.1;this.sky.sunDisc.visible=false;}
    {const tint=!underground&&REALM_TINTS[realmAt(focus.x,focus.z)];if(tint){if(tint.sky)this.scene.background.lerp(tint.sky,tint.tint);if(tint.haze&&this.scene.fog)this.scene.fog.color.lerp(tint.haze,Math.max(.5,tint.tint));if(tint.fx){this.sky.clouds.visible=false;this.sky.sunDisc.visible=false;}}
     this.updateRealmFx(tint?.fx,focus);}
    this.sky.clouds.visible=!underground;this.sky.stars.visible=!underground;
    this.particles.update(this.running?dt:0);this.updateTorches(dt);this.coop?.update(dt);
    this.avatar.update(this.player,this.inventory.selectedItem,{first:this.cameraMode==='first',active:this.started&&!this.activeVehicle,mining:this.mining,dt:this.running?dt:0});
    if(this.cameraMode!=='first'&&this.camera.position.distanceTo(this.player.eye)<.7)this.avatar.body.visible=false;
    renderer.render(this.scene,this.camera);
    this.frameCounter++;this.perfElapsed+=raw;
    if(this.perfElapsed>=.5){this.fps=Math.round(this.frameCounter/this.perfElapsed);this.frameTimes.push({fps:this.fps,ms:this.perfElapsed*1000/this.frameCounter});if(this.frameTimes.length>120)this.frameTimes.shift();this.frameCounter=0;this.perfElapsed=0;}
    if(!this.lastUi||now-this.lastUi>100){this.ui.update(this,{fps:this.fps,width:canvas.width,height:canvas.height,calls:renderer.info.render.calls});if(this.running)this.touch?.update();this.lastUi=now;}
    this.raf=requestAnimationFrame(this.frame);
  }
  debug(){return {ready:true,started:this.started,running:this.running,menu:this.ui.menu,mode:this.mode,seed:this.seed,player:this.player.serialize(),inventory:this.inventory.serialize(),entities:this.entities.serialize(),activeVehicle:this.activeVehicle?.id||null,time:this.time,edits:this.world.serialize().length,chunks:this.world.chunks.size,renderer:{fps:this.fps,width:canvas.width,height:canvas.height,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries},performance:this.frameTimes.slice(-30),goals:this.goals};}
  dispose(){this.disposed=true;cancelAnimationFrame(this.raf);this.events.abort();this.touch?.dispose();this.avatar.dispose();this.slingshot.dispose();this.pests.dispose();this.enemies.dispose();this.wildlife.dispose();this.audio.dispose();this.world.dispose();this.entities.dispose();this.sky.dispose();this.particles.dispose();this.selection.geometry.dispose();this.selection.material.dispose();renderer.dispose();bridge.dispose();}
}

/** Botão Voltar do Android: pausa, fecha menus ou sai do app na tela inicial (nunca fecha no meio do jogo). */
function bindNativeBack(getGame){
  const App=window.Capacitor?.Plugins?.App;if(!App?.addListener)return;
  App.addListener('backButton',()=>{
    const game=getGame();
    if(!game){App.exitApp?.();return;}
    if(game.running){game.menu('pause');return;}
    if(game.started){if(game.ui.menu==='pause')game.resume();else game.menu('pause');return;}
    if(game.ui.menu&&game.ui.menu!=='landing'){game.menu('landing');return;}
    App.exitApp?.();
  });
}

async function boot() {
  const nativeApp=NATIVE_APP;
  if(!import.meta.env.DEV&&bridge.standalone&&!nativeApp){location.replace('/jogos/valleyblocks');return;}
  if(!renderer)return;
  const huntingDemo=import.meta.env.DEV&&new URLSearchParams(location.search).get('demo')==='caca';
  let game,initializing=false,destroyed=false;
  const initialize=async(options={})=>{
    if(initializing||game||destroyed)return;initializing=true;
    try{
      if(options.cloudSaves)saves=createRemoteSaves({request:bridge.worldRequest});
      account.fromPortal(options);void account.restore();
      ownedPacks=Array.isArray(options.outfits)?options.outfits.filter(id=>typeof id==='string'&&OUTFIT_PACKS[id]):[];fullAccess=options.unlimited===true;coopAvailable=options.multiplayer===true;
      const saved=huntingDemo?null:await saves.load();
      if(destroyed)return;
      game=new Game(saved);
      window.__valeDebug=()=>game.debug();
      if(import.meta.env.DEV)window.__valeGame=game;
      if(huntingDemo){const {installHuntingDemo}=await import('./hunting-demo.js');installHuntingDemo(game);}
      game.ui.setMenu('landing',game);bridge.started();
    }catch(error){bridge.error('Não foi possível carregar seu mundo. '+error.message,'save-load');if(bridge.standalone)fatal(error.message,error);}
    finally{initializing=false;}
  };
  bridge.on('start',initialize);
  bridge.on('restart',()=>{if(game){game.newSeed='';game.newMode=game.mode;game.action('new-game');}});
  bridge.on('pause',()=>{if(game?.started){game.menu('pause');void game.save(false);}});
  bridge.on('resume',()=>{if(game?.started)game.resume();});
  bridge.on('destroy',()=>{destroyed=true;game?.dispose();});
  if(nativeApp)bindNativeBack(()=>game);
  if(bridge.standalone)await initialize();
  bridge.ready();
}
boot().catch(error=>fatal(`Não foi possível preparar o mundo: ${error.message}`,error));
