import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'msedge',headless:true});
const checks=[],errors=[];
await mkdir('test-results',{recursive:true});
const check=(name,result)=>{assert.ok(result,name);checks.push(name);console.log('PASS',name);};
try{
  for(const mode of ['creative','survival']){
    const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:5186/',{waitUntil:'networkidle'});
    await page.locator(`[data-action="choose-mode"][data-mode="${mode}"]`).click();
    await page.locator('[data-action="new-game"]').click();
    await page.waitForFunction(()=>window.__valeGame?.running);
    await page.evaluate(()=>{const g=window.__valeGame;g.inventory.add(17,4);g.inventory.hotbar[0]=17;g.inventory.select(0);
      for(let x=35;x<=66;x++)for(let z=35;z<=46;z++){g.world.setBlock(x,34,z,3);for(let y=35;y<40;y++)g.world.setBlock(x,y,z,0);}
    });
    const positions=[];
    for(let f=0;f<4;f++){
      const target=await page.evaluate(f=>{const g=window.__valeGame;const [dx,dz]=[[0,-1],[1,0],[0,1],[-1,0]][f];
        g.player.position.set(40.5+f*6-dx*2.5,35.002,40.5-dz*2.5);g.player.velocity.set(0,0,0);g.player.yaw=-f*Math.PI/2;g.player.pitch=-.65;g.updateCamera(1);
        const h=g.world.raycast(g.player.eye,g.player.direction,6);return {x:h.x+h.normal.x,y:h.y+h.normal.y,z:h.z+h.normal.z};
      },f);
      positions.push(target);
      await page.mouse.down({button:'right'});await page.mouse.up({button:'right'});
      check(`${mode}: right click places ramp uphill toward facing ${f}`,await page.evaluate(({p,f})=>{const w=window.__valeGame.world;return w.getBlock(p.x,p.y,p.z)===17&&w.rampFacingAt(p.x,p.y,p.z)===f;},{p:target,f}));
      if(mode==='creative'){await page.waitForTimeout(250);await page.screenshot({path:`test-results/ramp-facing-${f}.png`});}
    }
    if(mode==='survival')check('survival consumes exactly one ramp per placement',await page.evaluate(()=>window.__valeGame.inventory.count(17)===0));
    await page.evaluate(()=>window.__valeGame.menu('pause'));
    await page.locator('[data-action="save"]').click();
    await page.waitForFunction(()=>window.__valeGame.saved?.edits.some(e=>e.id===17&&e.facing===3));
    await page.reload({waitUntil:'networkidle'});await page.locator('[data-action="continue"]').click();
    await page.waitForFunction(()=>window.__valeGame?.running);
    check(`${mode}: all four orientations survive saving and reloading`,await page.evaluate(positions=>{const w=window.__valeGame.world;return positions.every((p,f)=>w.getBlock(p.x,p.y,p.z)===17&&w.rampFacingAt(p.x,p.y,p.z)===f);},positions));
    await context.close();
  }
  check('no browser runtime errors',errors.length===0);
  await writeFile('test-results/ramps-report.json',JSON.stringify({date:new Date().toISOString(),checks,errors},null,2));
}finally{await browser.close();}
