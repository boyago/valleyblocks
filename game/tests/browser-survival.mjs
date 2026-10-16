import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),checks=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));
const check=(name,ok)=>{assert.ok(ok,name);checks.push(name);console.log('PASS',name);};
const clickRight=async()=>{await page.mouse.down({button:'right'});await page.mouse.up({button:'right'});};
await mkdir('test-results',{recursive:true});
try{
  await page.goto('http://127.0.0.1:5186/',{waitUntil:'networkidle'});
  await page.locator('[data-mode="survival"]').click();await page.locator('[data-action="new-game"]').click();
  await page.waitForFunction(()=>window.__valeGame?.running);
  check('all three species appear in a new world',await page.evaluate(()=>['chicken','rabbit','boar'].every(type=>window.__valeGame.wildlife.animals.some(a=>a.type===type))));
  check('survival HUD exposes hunger and stamina',await page.getByLabel('Saciedade',{exact:true}).count()===1&&await page.getByLabel('Energia',{exact:true}).count()===1);
  await page.evaluate(()=>{
    const g=window.__valeGame;for(let x=30;x<62;x++)for(let z=25;z<58;z++){g.world.setBlock(x,34,z,3);for(let y=35;y<42;y++)g.world.setBlock(x,y,z,0);}
    g.player.position.set(40.5,35.002,42.8);g.player.velocity.set(0,0,0);g.player.yaw=0;g.player.pitch=-.46;
    g.wildlife.spawnTimer=200;
    for(const [i,type] of ['chicken','rabbit','boar'].entries()){const a=g.wildlife.animals.find(a=>a.type===type);a.position.set(40.5+i*2,35,40.5);a.home.copy(a.position);a.timer=100;a.goal=null;}
    g.inventory.add('food',32);g.inventory.add('axe');g.inventory.hotbar[0]='axe';g.inventory.select(0);g.player.position.set(42.5,35.002,47);g.player.pitch=-.2;g.updateCamera(1);
  });
  await page.waitForTimeout(250);await page.screenshot({path:'test-results/survival-wildlife.png'});
  await page.evaluate(()=>{const g=window.__valeGame;g.player.position.set(40.5,35.002,42.8);g.player.pitch=-.46;g.updateCamera(1);});
  await page.waitForFunction(()=>window.__valeGame.wildlife.raycast(window.__valeGame.player.eye,window.__valeGame.player.direction)?.animal.type==='chicken');
  await page.mouse.down();await page.waitForTimeout(120);await page.mouse.up();
  check('aimed axe attack creates one chicken meat drop',await page.evaluate(()=>window.__valeGame.wildlife.drops.some(d=>d.item==='raw_chicken')));
  await page.keyboard.down('w');await page.waitForTimeout(550);await page.keyboard.up('w');
  check('approaching the hunted animal collects the meat',await page.evaluate(()=>window.__valeGame.inventory.count('raw_chicken')===1));
  await page.evaluate(()=>{const g=window.__valeGame;g.world.setBlock(40,35,38,24);g.player.position.set(40.5,35.002,41);g.player.velocity.set(0,0,0);g.player.pitch=-.44;g.player.hunger=40;g.player.stamina=25;g.inventory.add(18);g.updateCamera(1);});
  await page.waitForTimeout(150);await page.keyboard.press('e');
  await page.locator('[data-action="heat"][data-recipe="chicken"]').click();
  check('barbecue cooks hunted meat and consumes charcoal',await page.evaluate(()=>{const i=window.__valeGame.inventory;return i.count('raw_chicken')===0&&i.count('cooked_chicken')===1&&i.count(18)===0;}));
  await page.screenshot({path:'test-results/survival-cooking.png'});
  await page.getByRole('button',{name:'Fechar',exact:true}).click();await page.keyboard.press('Tab');
  await page.locator('[data-action="equip"][data-item="cooked_chicken"]').click();await page.getByRole('button',{name:'Fechar',exact:true}).click();
  await page.evaluate(()=>{window.__valeGame.player.pitch=.25;window.__valeGame.updateCamera(1);});
  await clickRight();
  check('right-click eating restores hunger and consumes cooked food',await page.evaluate(()=>window.__valeGame.player.hunger>69&&window.__valeGame.inventory.count('cooked_chicken')===0));
  await page.evaluate(()=>{const g=window.__valeGame;g.player.position.set(55.5,35.002,53.5);g.player.velocity.set(0,0,0);g.player.pitch=0;g.player.stamina=22;g.player.exhausted=false;});
  await page.keyboard.down('Shift');await page.keyboard.down('w');await page.waitForTimeout(3000);await page.keyboard.up('w');await page.keyboard.up('Shift');
  check('sprinting exhausts stamina and schedules audible panting',await page.evaluate(()=>{const g=window.__valeGame;return g.player.exhausted&&g.player.stamina<25&&g.player.panting>.6&&g.audio.breathTime>0&&g.audio.context.state==='running';}));
  await page.screenshot({path:'test-results/survival-exhaustion.png'});
  await page.waitForTimeout(4200);
  check('standing still recovers energy and breathing',await page.evaluate(()=>{const p=window.__valeGame.player;return !p.exhausted&&p.stamina>50&&p.panting===0;}));
  await page.evaluate(()=>{const g=window.__valeGame,p=g.entities.pets[0];g.player.position.set(40.5,35.002,49.5);g.player.velocity.set(0,0,0);g.player.pitch=-.3;p.position.set(40.5,35,47.5);p.home.copy(p.position);p.path=[];p.goal=null;p.mode='stay';p.tamed=false;g.wildlife.spawn('chicken',p.position.clone().set(40.5,35,43.5));g.wildlife.spawnTimer=200;g.updateCamera(1);});
  await page.waitForTimeout(150);await page.keyboard.press('e');
  await page.locator('[data-kind="tame"]').click();await page.locator('[data-kind="hunt"]').click();
  check('pet menu enables hunting for a domesticated dog',await page.evaluate(()=>window.__valeGame.entities.pets[0].mode==='hunt'));
  await page.screenshot({path:'test-results/survival-dog-command.png'});
  await page.getByRole('button',{name:'Fechar',exact:true}).click();
  await page.waitForFunction(()=>!!window.__valeGame.entities.pets[0].carry,null,{timeout:30000});
  await page.screenshot({path:'test-results/survival-dog-retrieval.png'});
  check('dog carries a visible meat package',await page.evaluate(()=>{const g=window.__valeGame,p=g.entities.pets[0];return !!p.carry&&g.wildlife.carryMeshes.get(p.id)?.visible;}));
  await page.waitForFunction(()=>window.__valeGame.inventory.count('raw_chicken')>0,null,{timeout:30000});
  check('dog delivers the hunted meat to inventory',await page.evaluate(()=>!window.__valeGame.entities.pets[0].carry));
  await page.keyboard.press('Tab');
  const paused=await page.evaluate(()=>({p:window.__valeGame.player.serialize(),w:window.__valeGame.wildlife.serialize()}));
  await page.waitForTimeout(600);
  check('menus freeze needs and wildlife simulation',await page.evaluate(before=>JSON.stringify(before)===JSON.stringify({p:window.__valeGame.player.serialize(),w:window.__valeGame.wildlife.serialize()}),paused));
  await page.getByRole('button',{name:'Fechar',exact:true}).click();await page.evaluate(()=>window.__valeGame.menu('pause'));await page.locator('[data-action="save"]').click();
  await page.waitForFunction(()=>window.__valeGame.saved?.wildlife&&!window.__valeGame.savePromise);
  const saved=await page.evaluate(()=>window.__valeGame.saved);
  await page.reload({waitUntil:'networkidle'});await page.locator('[data-action="continue"]').click();await page.waitForFunction(()=>window.__valeGame?.running);
  check('saved needs, hunt command and meat survive reload',await page.evaluate(s=>{const g=window.__valeGame;return Math.abs(g.player.hunger-s.player.hunger)<1&&g.inventory.count('raw_chicken')===s.inventory.counts.raw_chicken&&g.entities.pets[0].mode==='hunt'&&g.wildlife.animals.length===s.wildlife.animals.length;},saved));
  check('no runtime errors in the hunting and cooking session',errors.length===0);
  await writeFile('test-results/survival-report.json',JSON.stringify({date:new Date().toISOString(),checks,errors},null,2));
}catch(error){await page.screenshot({path:'test-results/survival-failure.png'});console.error(await page.evaluate(()=>({toast:document.querySelector('#toast')?.textContent,debug:window.__valeDebug?.(),pets:window.__valeGame?.entities.pets.map(p=>({mode:p.mode,carry:p.carry,goal:p.goal?.toArray(),position:p.position.toArray()}))})));throw error;}
finally{await browser.close();}
