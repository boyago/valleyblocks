// Vendedor de rua: modelo do Blender, aviso "Negociar", painel de troca e estoque.
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
  await page.locator('[data-action="choose-mode"][data-mode="survival"]').click();
  await page.locator('[data-action="new-game"]').click();
  await page.locator('[data-action="close"]').first().click().catch(()=>{});
  await page.waitForFunction(()=>window.__valeGame?.started);
  await page.evaluate(()=>{const g=window.__valeGame;g.player.position.set(2.5,9.01,14.5);g.player.velocity.set(0,0,0);g.player.yaw=Math.PI;g.player.pitch=-.15;g.updateCamera(1);
    const v=g.wildlife.spawn('vendedor',g.player.position.clone().add({x:0,y:0,z:2.2}));v.yaw=Math.PI;v.mesh.rotation.y=Math.PI;window.__vendor=v;
    g.inventory.add('iron_ingot',8);g.inventory.add(37,5);g.running=true;});
  await page.waitForTimeout(600);
  await page.screenshot({path:'test-results/trade-01-vendor.png'});
  const prompt=await page.evaluate(()=>document.querySelector('#context-prompt').textContent);
  check('aviso de negociar aparece perto do vendedor',/Negociar/.test(prompt));
  await page.evaluate(()=>window.__valeGame.interact());
  await page.waitForFunction(()=>window.__valeDebug().menu==='trade');
  await page.screenshot({path:'test-results/trade-02-panel.png'});
  const offers=await page.locator('.trade-offer').count();
  check('painel mostra seis ofertas da banca',offers===6);
  const before=await page.evaluate(()=>window.__valeGame.inventory.count(37));
  const enabled=page.locator('.trade-offer:not([disabled])').first();
  await enabled.click();await page.waitForTimeout(200);
  const after=await page.evaluate(()=>window.__valeGame.inventory.count(37));
  check('uma troca muda as esmeraldas da mochila',after!==before);
  check('estoque fica salvo no snapshot do mundo',await page.evaluate(()=>Object.keys(window.__valeGame.snapshot().trades||{}).length===1));
  check('nenhum erro de runtime',errors.length===0);
}finally{await browser.close();}
