import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));
try{
  await page.goto('http://127.0.0.1:5186/',{waitUntil:'networkidle'});
  await page.locator('[data-action="new-game"]').click();
  await page.waitForFunction(()=>window.__valeGame?.running);
  await page.evaluate(()=>{
    const g=window.__valeGame;g.time=.4;
    for(let x=35;x<56;x++)for(let z=35;z<56;z++){
      g.world.setBlock(x,34,z,3);for(let y=35;y<39;y++)g.world.setBlock(x,y,z,0);
    }
    g.player.position.set(49,35.002,40);g.player.yaw=Math.PI/2;g.player.pitch=-.5;g.player.velocity.set(0,0,0);
    const dog=g.entities.pets.find(p=>p.type==='dog'),cat=g.entities.pets.find(p=>p.type==='cat');
    for(const p of [dog,cat]){p.position.set(40.5,35,40.5);p.tamed=true;p.mode='follow';p.collar.visible=true;p.path.length=0;p.routeAge=2;}
    window.spacingIds=[dog.id,cat.id];
  });
  for(const target of [[49,35.002,40],[49,35.002,49],[39,35.002,49]]){
    await page.evaluate(t=>{const g=window.__valeGame;g.player.position.set(...t);g.player.velocity.set(0,0,0);},target);
    await page.waitForFunction(()=>{
      const g=window.__valeGame,p=window.spacingIds.map(id=>g.entities.pets.find(p=>p.id===id));
      return p.every(p=>p.position.distanceTo(g.player.position)<3.2)&&p[0].position.distanceTo(p[1].position)>1.22;
    },null,{timeout:20000});
    checks.push('Both companions follow and keep space at '+target.join(','));
  }
  await page.evaluate(()=>{
    const g=window.__valeGame,p=window.spacingIds.map(id=>g.entities.pets.find(p=>p.id===id));
    const center=p[0].position.clone().add(p[1].position).multiplyScalar(.5);
    g.menu('pause');g.player.position.copy(center).add({x:0,y:3,z:5});g.player.yaw=0;g.player.pitch=-.72;g.updateCamera(1);
  });
  await page.locator('#menu-layer').evaluate(e=>e.style.visibility='hidden');
  await page.screenshot({path:'test-results/pet-spacing.png'});
  assert.deepEqual(errors,[]);checks.push('No browser errors');
  await writeFile('test-results/pet-spacing-report.json',JSON.stringify({checks,errors},null,2));
  console.log(checks);
}finally{await browser.close();}
