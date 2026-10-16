import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const checks=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));
const check=(name,ok)=>{assert.ok(ok,name);checks.push(name);console.log('PASS',name);};
await mkdir('test-results',{recursive:true});
try{
  await page.goto('http://127.0.0.1:5186/',{waitUntil:'networkidle'});
  await page.locator('[data-mode="survival"]').click();
  await page.locator('[data-action="new-game"]').click();
  await page.waitForFunction(()=>window.__valeGame?.running);
  check('new world stays empty',await page.evaluate(()=>Object.keys(window.__valeGame.inventory.counts).length===0));
  await page.evaluate(()=>{
    const g=window.__valeGame;
    for(let x=38;x<=43;x++)for(let z=38;z<=46;z++){
      g.world.setBlock(x,34,z,3);
      for(let y=35;y<=40;y++)g.world.setBlock(x,y,z,0);
    }
    g.player.position.set(40.5,35.002,43);g.player.velocity.set(0,0,0);
    g.player.yaw=0;g.player.pitch=0;g.updateCamera(1);
  });
  async function hit(block,tool,mode='survival',duration=1100){
    await page.evaluate(({block,tool,mode})=>{
      const g=window.__valeGame;g.mode=mode;
      g.world.setBlock(40,36,40,block);
      if(tool&&!g.inventory.has(tool))g.inventory.add(tool);
      g.inventory.hotbar[0]=tool;g.inventory.select(0);g.miningProgress=0;
      g.player.position.set(40.5,35.002,43);g.player.yaw=0;g.player.pitch=0;g.updateCamera(1);
    },{block,tool,mode});
    await page.waitForFunction(id=>window.__valeGame.target?.id===id,block);
    await page.mouse.down();await page.waitForTimeout(duration);await page.mouse.up();
    return page.evaluate(()=>window.__valeGame.world.getBlock(40,36,40));
  }
  check('survival hands cannot break stone',await hit(3,null)===3);
  check('HUD explains required wooden pickaxe',(await page.locator('#target-label').textContent()).includes('picareta de madeira'));
  check('creative hands cannot break ore',await hit(10,null,'creative')===10);
  check('wooden pickaxe mines stone',await hit(3,'wooden_pickaxe')===0);
  check('wooden pickaxe cannot mine iron',await hit(10,'wooden_pickaxe')===10);
  check('stone pickaxe mines iron',await hit(10,'pickaxe')===0);
  check('stone pickaxe cannot mine diamond',await hit(25,'pickaxe')===25);
  await page.evaluate(()=>{
    const g=window.__valeGame;
    g.inventory.add(10,3);g.inventory.add(18,3);g.inventory.add(12,4);
    g.world.setBlock(41,35,43,24);g.openForge({x:41,y:35,z:43,id:24});
  });
  // Use the actual preparation button, with the same recipe shown to the player.
  for(let i=0;i<3;i++)await page.locator('[data-action="heat"][data-recipe="iron"]').click();
  check('barbecue turns ore and fuel into three iron ingots',await page.evaluate(()=>window.__valeGame.inventory.count('iron_ingot')===3));
  await page.evaluate(()=>{
    const g=window.__valeGame;g.world.setBlock(39,35,43,15);g.menu('inventory');
  });
  await page.locator('[data-action="craft"][data-recipe="iron_pickaxe"]').click();
  check('workshop crafts iron pickaxe from ingots',await page.evaluate(()=>{const i=window.__valeGame.inventory;return i.has('iron_pickaxe')&&!i.has('iron_ingot');}));
  await page.locator('[data-action="close"]').first().click();
  await page.waitForFunction(()=>window.__valeGame.running);
  check('iron pickaxe mines diamond',await hit(25,'iron_pickaxe')===0);
  check('equipped iron pickaxe has a first-person model',await page.evaluate(()=>window.__valeGame.avatar.held.name==='held:iron_pickaxe'));
  await page.evaluate(()=>{const g=window.__valeGame;g.inventory.add(25,5);g.inventory.add(12,4);g.menu('inventory');});
  await page.locator('[data-action="craft"][data-recipe="diamond_pickaxe"]').click();
  await page.locator('[data-action="craft"][data-recipe="diamond_axe"]').click();
  check('workshop crafts diamond pickaxe and axe',await page.evaluate(()=>{const i=window.__valeGame.inventory;return i.has('diamond_pickaxe')&&i.has('diamond_axe');}));
  await page.screenshot({path:'test-results/tool-recipes.png'});
  await page.locator('[data-action="close"]').first().click();
  await page.waitForFunction(()=>window.__valeGame.running);
  for(const id of [3,18,10,19,20,21,25])check(`diamond pickaxe mines block ${id}`,await hit(id,'diamond_pickaxe','survival',650)===0);
  check('diamond axe cannot mine stone',await hit(3,'diamond_axe')===3);
  check('diamond axe cuts wood',await hit(5,'diamond_axe')===0);
  await page.screenshot({path:'test-results/diamond-axe.png'});
  await page.evaluate(async()=>{const g=window.__valeGame;g.menu('pause');await g.save();});
  await page.reload({waitUntil:'networkidle'});
  await page.locator('[data-action="continue"]').click();
  await page.waitForFunction(()=>window.__valeGame?.running);
  check('crafted tools persist after reload',await page.evaluate(()=>{const i=window.__valeGame.inventory;return i.has('iron_pickaxe')&&i.has('diamond_pickaxe')&&i.has('diamond_axe');}));
  check('no browser runtime errors',errors.length===0);
  await writeFile('test-results/tools-report.json',JSON.stringify({checks,errors},null,2));
}finally{await browser.close();}
