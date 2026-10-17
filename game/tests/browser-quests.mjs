// Retrato do personagem, morador do Sertão, entrega de missão e livro de missões.
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
  check('cartão do personagem mostra o retrato',await page.locator('.character-chip .portrait img').count()===1);
  await page.screenshot({path:'test-results/quests-01-start.png'});
  await page.locator('[data-action="choose-mode"][data-mode="survival"]').click();
  await page.locator('[data-action="new-game"]').click();
  await page.locator('[data-action="close"]').first().click().catch(()=>{});
  await page.waitForFunction(()=>window.__valeGame?.started);
  await page.evaluate(()=>{const g=window.__valeGame;g.player.position.set(40000.5,30,39996.5);g.player.velocity.set(0,0,0);g.running=true;});
  await page.waitForFunction(()=>window.__valeGame.wildlife.animals.some(a=>a.type==='morador'&&a.realm==='sertao'),null,{timeout:30000});
  await page.evaluate(()=>{const g=window.__valeGame,m=g.wildlife.animals.find(a=>a.type==='morador');
    g.player.position.set(m.position.x,m.position.y+.01,m.position.z-2.2);g.player.velocity.set(0,0,0);g.player.yaw=Math.PI;g.player.pitch=-.1;g.updateCamera(1);g.inventory.add('raw_calango',3);});
  await page.waitForTimeout(800);
  await page.screenshot({path:'test-results/quests-02-resident.png'});
  check('aviso de conversar com o morador',/Conversar/.test(await page.evaluate(()=>document.querySelector('#context-prompt').textContent)));
  await page.evaluate(()=>{const g=window.__valeGame,m=g.wildlife.animals.find(a=>a.type==='morador');g.focusTrader=m;g.menu('trade');});
  await page.waitForSelector('[data-action="deliver"]');
  await page.screenshot({path:'test-results/quests-03-panel.png'});
  await page.locator('[data-action="deliver"]').click();await page.waitForTimeout(200);
  check('entrega paga esmeraldas',await page.evaluate(()=>window.__valeGame.inventory.count(37)===3&&window.__valeGame.quests.claimed.calangos));
  check('Sertão marcado como visitado',await page.evaluate(()=>window.__valeGame.quests.visited.sertao===true));
  await page.evaluate(()=>window.__valeGame.menu('quests'));
  await page.waitForSelector('.quest-list');
  await page.screenshot({path:'test-results/quests-04-book.png'});
  check('livro lista as dez missões',await page.locator('.quest').count()===10);
  check('missões salvas no snapshot',await page.evaluate(()=>window.__valeGame.snapshot().quests.claimed.calangos===true));
  check('nenhum erro de runtime',errors.length===0);
}finally{await browser.close();}
