// Ossadas de gado do Sertão: modelo do Blender instanciado perto do jogador, sem blocos de osso.
// Requer o servidor de desenvolvimento: npm run dev (porta 5186).
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge'});
const page=await browser.newPage({viewport:{width:1280,height:800}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const check=(label,value)=>{assert.ok(value,label);console.log('PASS',label);};
await mkdir('test-results',{recursive:true});
try{
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:5186/',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.__valeDebug?.().ready);
  await page.locator('[data-action="new-game"]').click();
  await page.locator('[data-action="close"]').first().click().catch(()=>{});
  await page.waitForFunction(()=>window.__valeGame?.started);
  const spot=await page.evaluate(async()=>{const g=window.__valeGame,{sertaoSkeletons}=await import('/src/realms.js');
    const list=sertaoSkeletons(g.world.seedHash),s=list.find(([x,,z])=>Math.hypot(x-40000,z-40000)>20)||list[0];
    g.player.flying=true;g.player.position.set(s[0]-3.5,s[1]+2.2,s[2]-3.5);g.player.velocity.set(0,0,0);g.player.yaw=Math.PI*1.25;g.player.pitch=-.5;g.time=.45;g.running=true;g.updateCamera(1);return {count:list.length,s};});
  check('o Sertão tem várias ossadas',spot.count>=20);
  await page.waitForFunction(()=>window.__valeGame.skeletons.mesh?.count>0,null,{timeout:20000});
  await page.evaluate(()=>{const g=window.__valeGame,p=g.player.position;g.player.flying=true;});await page.waitForTimeout(4000);
  await page.screenshot({path:'test-results/skeleton-game.png'});
  check('só as ossadas perto do jogador são desenhadas',await page.evaluate(n=>{const m=window.__valeGame.skeletons.mesh;return m.count>0&&m.count<n;},spot.count));
  check('não sobra bloco de osso no chão',await page.evaluate(([x,y,z])=>{const w=window.__valeGame.world;for(let dx=-1;dx<5;dx++)for(let dy=0;dy<2;dy++)if(w.getBlock(Math.floor(x)-1+dx,y+dy,Math.floor(z))===34)return false;return true;},spot.s));
  check('nenhum erro de runtime',errors.length===0);
}finally{await browser.close();}
