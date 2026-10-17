// Bichos e pets com modelo do Blender (creatures.js): aparecem, andam e não geram erros.
// Requer o servidor de desenvolvimento: npm run dev (porta 5186).
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge'});
const page=await browser.newPage({viewport:{width:1280,height:800}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const check=(label,value)=>{assert.ok(value,label);console.log('PASS',label);};
const SHOW=(process.env.CREATURES||'chicken,rabbit,boar').split(',');
await mkdir('test-results',{recursive:true});
try{
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:5186/',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.__valeDebug?.().ready);
  await page.locator('[data-action="new-game"]').click();
  await page.locator('[data-action="close"]').first().click().catch(()=>{});
  await page.waitForFunction(()=>window.__valeGame?.started);
  const info=await page.evaluate(show=>{const g=window.__valeGame,THREE=g.player.position.constructor;
    g.time=.42;for(const a of [...g.wildlife.animals]){a.mesh.removeFromParent();}g.wildlife.animals.length=0;
    const base=new THREE(7.5,9.01,24.5),made=[];
    show.forEach((t,i)=>{const p=base.clone().add(new THREE(-3+i*1.6,0,0));const y=g.world.heightAt(p.x,p.z,30);if(y!==null)p.y=y;const a=g.wildlife.spawn(t,p);if(a){a.yaw=-.6;a.mesh.rotation.y=-.6;a.timer=99;made.push(t);}});
    const pets=g.entities.pets.map((p,i)=>{p.position.set(3.5+i*1.6,9.01,27);p.home.copy(p.position);p.yaw=-.6;p.goal=null;return p.type;});
    g.player.position.set(6.5,9.01,30.5);g.player.velocity.set(0,0,0);g.player.yaw=0;g.player.pitch=-.42;g.cameraMode='first';g.updateCamera(1);g.running=true;
    return {made,pets,legs:g.wildlife.animals.map(a=>a.legs.length)};},SHOW);
  check('bichos criados com o modelo novo',info.made.length===SHOW.length&&info.legs.every(n=>n>=2));
  await page.waitForTimeout(1500);
  await page.screenshot({path:'test-results/creatures-game.png'});
  // anda: as pernas balançam
  const swing=await page.evaluate(async()=>{const g=window.__valeGame,a=g.wildlife.animals[0];a.goal=a.position.clone().add({x:3,y:0,z:0});a.timer=99;await new Promise(r=>setTimeout(r,500));return Math.abs(a.legs[0].rotation.x);});
  check('pernas balançam ao andar',swing>.02);
  check('pets usam o modelo novo com cabeça e rabo',await page.evaluate(()=>window.__valeGame.entities.pets.every(p=>p.head&&p.tail&&p.legs.length===4&&p.bodyGroup.children[0].geometry.getAttribute('color'))));
  check('nenhum erro de runtime',errors.length===0);
}finally{await browser.close();}
