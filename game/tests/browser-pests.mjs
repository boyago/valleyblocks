import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),checks=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));
const check=(name,ok)=>{assert.ok(ok,name);checks.push(name);console.log('PASS',name);};
await mkdir('test-results',{recursive:true});
try{
  await page.goto('http://127.0.0.1:5186/',{waitUntil:'networkidle'});
  await page.locator('[data-mode="survival"]').click();await page.locator('[data-action="new-game"]').click();await page.waitForFunction(()=>window.__valeGame?.running);
  await page.evaluate(()=>{
    const g=window.__valeGame;g.time=.4;
    for(let x=36;x<=50;x++)for(let z=36;z<=50;z++){g.world.setBlock(x,34,z,3);for(let y=35;y<40;y++)g.world.setBlock(x,y,z,0);}
    g.player.position.set(46.5,35.002,43.5);g.player.velocity.set(0,0,0);g.player.yaw=Math.PI/2;g.player.pitch=-.4;g.updateCamera(1);
    const cat=g.entities.pets.find(p=>p.type==='cat');cat.tamed=true;cat.collar.visible=true;cat.mode='stay';cat.position.set(46,35,45);
    g.inventory.add('food',2);g.pests.spawnTimer=45;g.pests.spawn('rat',g.player.position.clone().set(45.5,35,43.5));
  });
  await page.waitForFunction(()=>window.__valeGame.inventory.count('food')===1);
  check('rat steals one food during real simulation',await page.evaluate(()=>window.__valeGame.pests.animals[0].stolen==='food'));
  await page.evaluate(async()=>{const g=window.__valeGame;g.menu('pause');await g.save();});
  await page.reload({waitUntil:'networkidle'});await page.locator('[data-action="continue"]').click();await page.waitForFunction(()=>window.__valeGame.running);
  check('stolen food remains on the rat after reload',await page.evaluate(()=>{const g=window.__valeGame;return g.inventory.count('food')===1&&g.pests.animals.some(p=>p.stolen==='food');}));
  await page.evaluate(()=>{const g=window.__valeGame;g.focusPet=g.entities.pets.find(p=>p.type==='cat');g.menu('pet');});
  await page.locator('[data-kind="guard"]').click();
  check('cat menu assigns a guard location',await page.evaluate(()=>{const c=window.__valeGame.focusPet;return c.mode==='guard'&&!!c.guardAnchor;}));
  await page.screenshot({path:'test-results/cat-guard-menu.png'});
  await page.locator('[data-action="close"]').click();await page.waitForFunction(()=>window.__valeGame.inventory.count('food')===2,null,{timeout:15000});
  check('cat kills the rat and recovers the food',await page.evaluate(()=>!window.__valeGame.pests.animals.some(p=>p.type==='rat')));
  await page.evaluate(()=>{
    const g=window.__valeGame;g.entities.pets.filter(p=>p.type==='cat').forEach(c=>c.mode='stay');g.inventory.counts={};
    for(const p of [...g.pests.animals])g.pests.remove(p);
    for(let z=40;z<=46;z++)for(let y=35;y<=37;y++)g.world.setBlock(42,y,z,12);
    g.world.setBlock(43,35,43,16);g.chests['43,35,43']={food:1};g.pests.burrowCooldown=0;g.pests.spawnTimer=45;
    g.pests.spawn('rat',g.player.position.clone().set(41.5,35,43.5));
    g.player.position.set(40,35.002,46);g.player.yaw=-Math.PI/4;g.player.pitch=-.3;g.updateCamera(1);
  });
  await page.waitForFunction(()=>window.__valeGame.world.getBlock(42,35,43)===0,null,{timeout:18000});
  check('rat opens a one-block hole beneath the intact wall',await page.evaluate(()=>window.__valeGame.world.getBlock(42,36,43)===12));
  await page.waitForFunction(()=>!window.__valeGame.chests['43,35,43'].food,null,{timeout:10000});
  check('rat enters through the hole and steals chest food',await page.evaluate(()=>window.__valeGame.pests.animals.some(p=>p.stolen==='food'&&p.holes===1)));
  await page.screenshot({path:'test-results/rat-wall-hole.png'});
  await page.evaluate(()=>{
    const g=window.__valeGame;for(const p of [...g.pests.animals])g.pests.remove(p);
    for(let z=40;z<=46;z++)for(let y=35;y<=37;y++)g.world.setBlock(42,y,z,0);
    g.player.position.set(42.5,35.002,47);g.player.yaw=0;g.player.pitch=-.45;g.updateCamera(1);
    for(const [i,type] of ['rat','scorpion','spider','snake'].entries())g.pests.spawn(type,g.player.position.clone().set(40+i*1.6,35,44));
    g.menu('pause');
  });
  await page.locator('#menu-layer').evaluate(e=>e.style.visibility='hidden');await page.waitForTimeout(300);await page.screenshot({path:'test-results/pest-species.png'});await page.locator('#menu-layer').evaluate(e=>e.style.visibility='');
  check('all four pest models are rendered',await page.evaluate(()=>window.__valeGame.pests.animals.length===4&&window.__valeGame.pests.animals.every(p=>p.body.children.length>4)));
  await page.evaluate(async()=>{const g=window.__valeGame;const c=g.entities.pets.find(p=>p.type==='cat');g.pests.command(c);await g.save();});
  await page.reload({waitUntil:'networkidle'});await page.locator('[data-action="continue"]').click();await page.waitForFunction(()=>window.__valeGame.running);
  check('cat guard command persists across saves',await page.evaluate(()=>window.__valeGame.entities.pets.some(c=>c.type==='cat'&&c.mode==='guard'&&c.guardAnchor)));
  check('no browser runtime errors',errors.length===0);await writeFile('test-results/pests-report.json',JSON.stringify({checks,errors},null,2));
}finally{await browser.close();}
