import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),checks=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));
const check=(name,ok)=>{assert.ok(ok,name);checks.push(name);console.log('PASS',name);};
await mkdir('test-results',{recursive:true});
try{
  await page.goto('http://127.0.0.1:5186/',{waitUntil:'networkidle'});
  check('seed is optional and defaults to random',(await page.locator('#seed-input').inputValue())==='');
  await page.locator('[data-mode="survival"]').click();await page.locator('[data-action="new-game"]').click();
  await page.waitForFunction(()=>window.__valeGame?.running);
  const firstSeed=await page.evaluate(()=>window.__valeGame.seed);
  check('new world includes a grill at home, a car and a dog',await page.evaluate(()=>{const g=window.__valeGame;return g.world.getBlock(-8,9,-5)===24&&g.entities.vehicles.length>=1&&g.entities.pets.some(p=>p.type==='dog');}));
  await page.evaluate(()=>{const g=window.__valeGame;g.player.position.set(-8.5,9.002,-1.5);g.player.yaw=0;g.player.pitch=-.3;g.updateCamera(1);});
  await page.waitForTimeout(500);await page.screenshot({path:'test-results/starter-grill.png'});
  await page.evaluate(()=>{const g=window.__valeGame;g.openForge({x:-8,y:9,z:-5,id:24});});
  check('starter grill opens its real recipes',await page.locator('[data-action="heat"][data-recipe="iron"]').isVisible());
  await page.evaluate(()=>window.__valeGame.start());await page.waitForFunction(()=>window.__valeGame.running);
  check('creating another world generates a different seed',await page.evaluate(seed=>window.__valeGame.seed!==seed,firstSeed));
  check('new world inventory remains empty',await page.evaluate(()=>Object.keys(window.__valeGame.inventory.counts).length===0));
  await page.evaluate(()=>{
    const g=window.__valeGame;
    for(let x=37;x<=48;x++)for(let z=35;z<=48;z++){g.world.setBlock(x,34,z,3);for(let y=35;y<=40;y++)g.world.setBlock(x,y,z,0);}
    g.player.position.set(42.5,35.002,44);g.player.velocity.set(0,0,0);g.player.yaw=0;g.player.pitch=-.05;g.time=.5;g.updateCamera(1);
  });
  await page.waitForTimeout(500);
  check('daytime has no hostile enemies',await page.evaluate(()=>window.__valeGame.enemies.enemies.length===0));
  await page.evaluate(()=>{const g=window.__valeGame;g.time=17.6/24;g.enemies.spawnTimer=0;});
  await page.waitForFunction(()=>window.__valeGame.enemies.enemies.length>0,{timeout:15000});
  check('dusk automatically spawns an enemy',true);
  await page.evaluate(()=>{
    const g=window.__valeGame;for(const e of [...g.enemies.enemies])g.enemies.remove(e);
    g.enemies.spawnTimer=12;
    g.enemies.spawn('reaper',g.player.position.clone().set(40.5,35,39));
    g.enemies.spawn('specter',g.player.position.clone().set(44.5,35,39));
    g.settings.fog=false;g.settings.quality='high';g.updateCamera(1);
  });
  await page.waitForTimeout(300);await page.evaluate(()=>window.__valeGame.menu('pause'));
  // Hide only the pause UI for an unobstructed capture of the live models.
  await page.locator('#menu-layer').evaluate(el=>el.style.visibility='hidden');
  await page.screenshot({path:'test-results/night-enemies.png'});
  await page.locator('#menu-layer').evaluate(el=>el.style.visibility='');
  check('both original enemy models render',await page.evaluate(()=>window.__valeGame.enemies.enemies.every(e=>e.mesh.visible&&e.body.children.length>8)));
  await page.evaluate(()=>{
    const g=window.__valeGame;for(const e of [...g.enemies.enemies])g.enemies.remove(e);
    g.enemies.spawn('reaper',g.player.position.clone().set(42.5,35,42.5));g.player.health=100;
  });
  await page.locator('[data-action="resume"]').click();
  await page.waitForFunction(()=>window.__valeGame.player.health<100);
  check('reaper scythe damages survival player',true);
  await page.evaluate(()=>{
    const g=window.__valeGame;for(const e of [...g.enemies.enemies])g.enemies.remove(e);
    g.enemies.spawn('specter',g.player.position.clone().set(42.5,35,42.5));g.player.health=100;
  });
  await page.waitForFunction(()=>window.__valeGame.enemies.acid.length>0);
  check('specter explodes and leaves green acid',await page.evaluate(()=>{const g=window.__valeGame;return g.enemies.enemies.length===0&&g.player.health<100&&g.enemies.acid[0].mesh.name==='acid-puddle';}));
  await page.evaluate(()=>{const g=window.__valeGame;g.player.position.z=46;g.player.pitch=-.55;g.updateCamera(1);g.menu('pause');});
  await page.locator('#menu-layer').evaluate(el=>el.style.visibility='hidden');
  await page.screenshot({path:'test-results/specter-acid.png'});
  await page.locator('#menu-layer').evaluate(el=>el.style.visibility='');
  await page.evaluate(async()=>{const g=window.__valeGame;g.enemies.spawn('reaper',g.player.position.clone().set(40,35,39));await g.save();});
  const seed=await page.evaluate(()=>window.__valeGame.seed);
  await page.reload({waitUntil:'networkidle'});await page.locator('[data-action="continue"]').click();
  await page.waitForFunction(()=>window.__valeGame.running);
  check('reload retains seed, enemy and acid',await page.evaluate(seed=>{const g=window.__valeGame;return g.seed===seed&&g.enemies.enemies.some(e=>e.type==='reaper')&&g.enemies.acid.length===1;},seed));
  await page.evaluate(()=>window.__valeGame.time=6/24);await page.waitForTimeout(150);
  check('enemies dissipate at dawn',await page.evaluate(()=>window.__valeGame.enemies.enemies.length===0));
  check('no browser runtime errors',errors.length===0);
  await writeFile('test-results/night-report.json',JSON.stringify({checks,errors},null,2));
}finally{await browser.close();}
