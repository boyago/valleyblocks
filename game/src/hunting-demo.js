import * as THREE from 'three';

/** Local, disposable showcase: uses the real wildlife and dog AI, never saves. */
export function installHuntingDemo(game) {
  game.save=async()=>false;
  game.saved=null;
  const panel=document.createElement('section');
  panel.id='hunting-demo';
  panel.style.cssText='position:fixed;top:76px;right:24px;z-index:120;width:310px;padding:20px;background:#f5f1e5ed;color:#294334;border:1px solid #fff9;border-radius:12px;font:14px/1.5 sans-serif;box-shadow:0 8px 35px #10251d40';
  panel.innerHTML='<strong style="font-size:20px">Clareira da caça</strong><p data-demo-status>Animais, churrasqueira e Pingo prontos. Inicie para acompanhar a caça.</p><p style="font-size:12px">O cachorro traz a carne da presa. Esta demonstração não salva nem altera sua partida.</p><button data-demo-start style="padding:12px;border:0;border-radius:6px;background:#365b42;color:white;cursor:pointer;width:100%">Iniciar demonstração</button><button data-demo-recipes style="margin-top:8px;padding:10px;border:1px solid #bac8ac;border-radius:6px;background:#e5ead9;color:#294334;cursor:pointer;width:100%">Ver receitas da churrasqueira</button>';
  document.body.append(panel);
  const status=panel.querySelector('[data-demo-status]'),button=panel.querySelector('[data-demo-start]');
  let dog,delivered=false,following=false;
  function prepare(){
    following=false;delivered=false;
    game.newSeed='clareira-da-caca';game.newMode='creative';game.createWorld(null);
    game.started=true;game.running=false;game.ui.setMenu(null,game);
    game.entities.vehicles.forEach(v=>v.mesh.visible=false);
    game.entities.pets.forEach(p=>{p.position.set(0,9,0);p.mode='stay';});
    // A lawn terrace with a paved cooking corner and low boundary walls.
    for(let x=31;x<=52;x++)for(let z=29;z<=55;z++){
      game.world.setBlock(x,34,z,1);
      for(let y=35;y<=41;y++)game.world.setBlock(x,y,z,0);
      if(x===31||x===52||z===29||z===55)game.world.setBlock(x,35,z,12);
    }
    for(let x=43;x<=47;x++)for(let z=46;z<=50;z++)game.world.setBlock(x,34,z,3);
    game.world.setBlock(44,35,47,24);game.forges['44,35,47']={water:0};
    game.world.setBlock(46,35,47,15);
    game.inventory.add(18,8);
    game.player.position.set(40.5,35.002,50.5);game.player.velocity.set(0,0,0);game.player.yaw=0;game.player.pitch=-.22;
    for(const a of game.wildlife.animals)a.mesh.removeFromParent();game.wildlife.animals=[];
    for(const [type,x,z] of [['chicken',40.5,42.5],['rabbit',48,35],['boar',35,34]]){
      const a=game.wildlife.spawn(type,new THREE.Vector3(x,35,z));a.timer=100;a.goal=null;
    }
    game.wildlife.spawnTimer=9999;
    dog=game.entities.pets.find(p=>p.type==='dog');
    dog.name='Pingo';dog.tamed=true;dog.mode='stay';dog.position.set(40.5,35,47.5);dog.home.copy(dog.position);dog.path=[];dog.goal=null;
    game.wildlife.onDelivery=message=>{delivered=true;dog.mode='stay';dog.path=[];dog.goal=null;status.textContent='Pingo trouxe a carne até você! Ela está na mochila e pode ser preparada na churrasqueira.';button.textContent='Repetir demonstração';game.ui.toast(message);};
    game.cameraMode='first';game.updateCamera(1);
    for(let i=0;i<20;i++)game.world.update(41,43,1);
    game.ui.saveStatus('Demonstração • sem salvamento');
  }
  const updateCamera=game.updateCamera.bind(game);
  game.updateCamera=dt=>{
    updateCamera(dt);
    if(following&&dog){
      game.camera.position.set(42.5,38.5,53.5);
      game.camera.lookAt(dog.position.clone().add(new THREE.Vector3(.8,.45,-.8)));
      game.avatar.view.visible=false;
    }
  };
  const simulate=game.simulate.bind(game);
  game.simulate=dt=>{
    game.keys.clear();simulate(dt);
    if(!delivered)status.textContent=dog.carry?'Pingo recolheu a caça e está trazendo a carne até você.':'Pingo está procurando e perseguindo a presa. A câmera acompanha o cachorro.';
  };
  button.onclick=async()=>{
    if(delivered)prepare();
    await game.audio.init();game.audio.setPaused(false);game.ui.setMenu(null,game);game.running=true;following=true;
    game.wildlife.command(dog);button.textContent='Continuar demonstração';
  };
  panel.querySelector('[data-demo-recipes]').onclick=()=>{
    game.openForge({x:44,y:35,z:47});
    button.textContent=delivered?'Repetir demonstração':'Continuar demonstração';
  };
  prepare();
  // The ready scene stays visible before the user starts the hunt.
  game.entities.update(0,game.player.position,new Set(),null);
  game.wildlife.animals.forEach(a=>a.mesh.position.copy(a.position));
  game.camera.position.set(42.5,38.5,53.5);game.camera.lookAt(41,35.5,43);
}
