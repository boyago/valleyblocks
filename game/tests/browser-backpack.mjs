import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'msedge',headless:true});
const checks=[],errors=[];
const check=(name,ok)=>{assert.ok(ok,name);checks.push(name);console.log('PASS',name);};
await mkdir('test-results',{recursive:true});
try{
  for(const mode of ['survival','creative']){
    const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:5186/',{waitUntil:'networkidle'});
    await page.locator(`[data-action="choose-mode"][data-mode="${mode}"]`).click();
    await page.locator('[data-action="new-game"]').click();
    await page.waitForFunction(()=>window.__valeGame?.running);
    check(`${mode}: new inventory and all nine shortcuts are completely empty`,await page.evaluate(()=>{const i=window.__valeGame.inventory;return Object.keys(i.counts).length===0&&i.hotbar.every(id=>id===null);}));
    await page.keyboard.press('Tab');
    check(`${mode}: empty backpack has no equippable items`,await page.locator('[data-action="equip"]').count()===0);
    await page.screenshot({path:`test-results/empty-inventory-${mode}.png`});
    await page.getByRole('button',{name:'Fechar',exact:true}).click();
    await page.evaluate(()=>{const i=window.__valeGame.inventory;i.add('bucket');i.hotbar[2]='bucket';});
    await page.keyboard.press('3');
    await page.waitForFunction(()=>window.__valeGame.avatar.held?.name==='held:bucket');
    await page.locator('.hotbar-slot.selected .bucket-art svg').waitFor();
    check(`${mode}: bucket equipped by key 3 with recognizable icon`,await page.locator('.hotbar-slot.selected .bucket-art svg').count()===1);
    await page.keyboard.press('Tab');
    check(`${mode}: backpack renders 54 slots`,await page.locator('.inventory-grid .inventory-item').count()===54);
    check(`${mode}: slots use nine columns on desktop`,await page.locator('.inventory-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length===9));
    await page.screenshot({path:`test-results/backpack-${mode}.png`});
    if(mode==='survival'){
      check('survival cannot access the creative catalog',await page.locator('[data-tab="catalog"]').count()===0);
      await page.setViewportSize({width:600,height:800});
      check('compact backpack fits viewport',await page.locator('.inventory-grid').evaluate(el=>el.getBoundingClientRect().right<=innerWidth&&el.scrollWidth<=el.clientWidth+1));
      await page.screenshot({path:'test-results/backpack-compact.png'});
      await page.setViewportSize({width:1440,height:1000});
    }
    if(mode==='creative'){
    await page.locator('[data-tab="catalog"]').click();
    await page.locator('[data-action="catalog-add"][data-item="24"]').click();
    check('catalog adds and equips an unlimited barbecue',await page.evaluate(()=>{const i=window.__valeGame.inventory;return i.selectedItem===24&&i.count(24)===Infinity&&i.count(3)===0;}));
    await page.locator('[data-tab="all"]').click();
    check('backpack only shows chosen blocks',await page.locator('[data-action="equip"][data-item="24"]').count()===1&&await page.locator('[data-action="equip"][data-item="3"]').count()===0);
    }
    await page.locator('[data-action="close"]').click();
    if(mode==='survival'){await page.evaluate(()=>{const i=window.__valeGame.inventory;i.add(24);i.hotbar[0]=24;});await page.keyboard.press('1');}
    await page.evaluate(()=>{const g=window.__valeGame;for(let x=19;x<24;x++)for(let z=18;z<25;z++)for(let y=8;y<14;y++)g.world.setBlock(x,y,z,y===8?3:0);g.player.position.set(20.5,9,23);g.player.velocity.set(0,0,0);g.player.yaw=0;g.player.pitch=-.75;g.updateCamera(1);});
    await page.waitForTimeout(200);await page.mouse.down({button:'right'});await page.mouse.up({button:'right'});
    const pos=await page.evaluate(()=>{const w=window.__valeGame.world;for(let z=18;z<25;z++)for(let x=19;x<24;x++)if(w.getBlock(x,9,z)===24)return {x,y:9,z};});
    check(`${mode}: right click places an acquired barbecue`,!!pos);
    check(`${mode}: placement consumes the survival barbecue only`,await page.evaluate(()=>{const g=window.__valeGame;return g.inventory.count(24)===(g.mode==='creative'?Infinity:0);}));
    await page.evaluate(pos=>{const g=window.__valeGame;g.player.position.set(pos.x+.5,9,pos.z+2.8);g.player.pitch=-.48;g.updateCamera(1);g.inventory.hotbar[g.inventory.selected]=null;},pos);
    await page.waitForTimeout(650);await page.screenshot({path:'test-results/barbecue-world.png'});
    await page.keyboard.press('e');
    await page.getByRole('dialog',{name:'Churrasqueira doméstica'}).waitFor();
    check('E opens barbecue recipes and rejects missing materials',await page.locator('[data-action="heat"][data-recipe="iron"]').isDisabled());
    check(`${mode}: all eight recipes remain listed without ingredients`,await page.locator('[data-action="heat"]').count()===8&&await page.locator('[data-action="heat"]:disabled').count()===8&&await page.locator('[data-recipe="iron"]').innerText().then(t=>t.includes('Falta:')));
    await page.getByRole('button',{name:'Fechar',exact:true}).click();
    await page.mouse.down({button:'right'});await page.mouse.up({button:'right'});
    await page.getByRole('dialog',{name:'Churrasqueira doméstica'}).waitFor();
    check(`${mode}: right click also opens barbecue recipes`,await page.locator('[data-action="heat"]').count()===8);
    await page.evaluate(()=>{const g=window.__valeGame;g.inventory.add(10);g.inventory.add(18);g.ui.setMenu('forge',g);});
    await page.locator('[data-action="heat"][data-recipe="iron"]').click();
    check('barbecue produces iron without water',await page.evaluate(()=>window.__valeGame.inventory.count('iron_ingot')===1));
    await page.screenshot({path:'test-results/barbecue-recipes.png'});
    await page.evaluate(()=>window.__valeGame.save());
    await page.reload({waitUntil:'networkidle'});await page.locator('[data-action="continue"]').click();
    await page.waitForFunction(()=>window.__valeGame?.running);
    check('reload preserves selected catalog items and empty hotbar slots',await page.evaluate(()=>{const i=window.__valeGame.inventory;return i.count(24)===(i.mode==='creative'?Infinity:0)&&i.count(3)===0&&i.count('iron_ingot')===1&&i.hotbar[i.selected]===null&&i.count('pickaxe')===0&&i.count('axe')===0;}));
    await context.close();
  }
  check('no browser runtime errors',errors.length===0);
  await writeFile('test-results/backpack-report.json',JSON.stringify({date:new Date().toISOString(),checks,errors},null,2));
}finally{await browser.close();}
