// Mochila: busca, escolha do espaço de atalho, arrastar para o espaço e rolagem mantida no catálogo.
// Requer o servidor de desenvolvimento: npm run dev (porta 5186).
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge'});
const page=await browser.newPage({viewport:{width:1280,height:800}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const check=(label,value)=>{assert.ok(value,label);console.log('PASS',label);};
await mkdir('test-results',{recursive:true});
try{
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:5186/',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.__valeDebug?.().ready);
  await page.locator('[data-action="choose-mode"][data-mode="creative"]').click();
  await page.locator('[data-action="new-game"]').click();
  await page.locator('[data-action="close"]').first().click().catch(()=>{});
  await page.waitForFunction(()=>window.__valeGame?.started);
  await page.evaluate(()=>window.__valeGame.openInventory());
  await page.locator('[data-action="inventory-tab"][data-tab="catalog"]').click();
  check('nove espaços de atalho na mochila',await page.locator('.pick-slot').count()===9);
  await page.locator('[data-action="hotbar-pick"][data-slot="4"]').click();
  check('tocar no espaço 5 seleciona o espaço',await page.evaluate(()=>window.__valeGame.inventory.selected===4));
  // rolagem mantida ao escolher um item no fim do catálogo
  const grid=page.locator('.inventory-grid');
  await grid.evaluate(g=>{g.scrollTop=g.scrollHeight;});const before=await grid.evaluate(g=>g.scrollTop);
  await page.locator('.inventory-grid .inventory-item[data-item]').last().click();
  const after=await page.locator('.inventory-grid').evaluate(g=>g.scrollTop);
  check('escolher item não volta o catálogo para o início',before>100&&Math.abs(after-before)<4);
  check('item vai para o espaço escolhido',await page.evaluate(()=>window.__valeGame.inventory.hotbar[4]!=null));
  // busca
  await page.fill('#inventory-search','tocha');
  const shown=await page.locator('.inventory-grid .inventory-item[data-item]:visible').allTextContents();
  check('busca filtra o catálogo',shown.length>=1&&shown.length<6&&shown.some(t=>/Tocha/.test(t)));
  await page.fill('#inventory-search','pedra sem acento nao existe xyz');
  check('aviso quando nada é encontrado',await page.locator('.inventory-empty').isVisible());
  await page.fill('#inventory-search','agua');
  check('busca ignora acentos',(await page.locator('.inventory-grid .inventory-item[data-item]:visible').allTextContents()).some(t=>/Água/.test(t)));
  await page.keyboard.type('2');
  check('digitar número na busca não troca o espaço',await page.evaluate(()=>window.__valeGame.inventory.selected===4));
  await page.fill('#inventory-search','tocha');
  // arrastar a tocha até o espaço 9
  await page.locator('.inventory-grid .inventory-item[data-item]:visible').first().dragTo(page.locator('[data-drop-slot="8"]'));
  check('arrastar item até o espaço 9',await page.evaluate(()=>window.__valeGame.inventory.hotbar[8]===13));
  check('busca continua aplicada depois de redesenhar',await page.inputValue('#inventory-search')==='tocha');
  await page.screenshot({path:'test-results/backpack-search.png'});
  check('nenhum erro de runtime',errors.length===0);
}finally{await browser.close();}
