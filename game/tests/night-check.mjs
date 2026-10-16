import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,channel:'msedge'});
const page=await browser.newPage({viewport:{width:1440,height:900}});
try {
  await page.goto('http://127.0.0.1:5186/',{waitUntil:'networkidle'});
  await page.locator('[data-action="new-game"]').click();
  await page.waitForFunction(()=>window.__valeDebug?.().running);
  await page.evaluate(()=>{const g=window.__valeGame;g.time=.9;g.player.position.set(-9,9,9);g.player.pitch=0;g.player.yaw=-.14;g.entities.vehicles[0].headlights=true;g.entities.updateLights(g.entities.vehicles[0]);});
  await page.waitForTimeout(1200);
  await page.screenshot({path:'test-results/08-night.png'});
  console.log(JSON.stringify(await page.evaluate(()=>({time:window.__valeDebug().time,activeTorches:window.__valeGame.torchLights.filter(l=>l.intensity>0).length,nightLight:window.__valeGame.sky.ambient.intensity}))));
} finally{await browser.close();}
