import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge'});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));
const check=(name,result)=>{assert.ok(result,name);checks.push(name);console.log('PASS',name);};
await mkdir('test-results',{recursive:true});
try {
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:5186/',{waitUntil:'networkidle'});
  await page.locator('[data-action="choose-mode"][data-mode="survival"]').click();
  await page.locator('[data-action="new-game"]').click();
  await page.waitForFunction(()=>window.__valeDebug?.().running);
  // A controlled pool and bank reproduce the user's edited-lake case.
  await page.evaluate(()=>{
    const g=window.__valeGame;g.menu('pause');g.world.ensureAround(28,4,1);
    for(let x=22;x<=34;x++)for(let z=-2;z<=10;z++)for(let y=5;y<=15;y++)g.world.setBlock(x,y,z,y<=8?3:0);
    for(let x=24;x<=29;x++)for(let z=0;z<=7;z++)for(let y=6;y<=8;y++)g.world.setBlock(x,y,z,9);
    g.world.setBlock(31,8,4,0);
    g.player.position.set(28,9.01,10);g.player.velocity.set(0,0,0);g.player.yaw=0;g.player.pitch=-.5;
  });
  await page.locator('[data-action="resume"]').click();
  await page.evaluate(()=>window.__valeGame.world.setBlock(30,8,4,0));
  await page.waitForFunction(()=>window.__valeGame.world.getBlock(30,8,4)===9&&window.__valeGame.world.getBlock(31,8,4)===9,{},{timeout:12000});
  check('water fills the opening and adjoining empty cell during live simulation',true);
  check('water remains non-solid after spreading',await page.evaluate(()=>!window.__valeGame.world.isSolid(31,8,4)));
  await page.evaluate(()=>{const g=window.__valeGame;g.player.position.set(26.5,6.1,3.5);g.player.velocity.set(0,0,0);g.player.yaw=-Math.PI/2;g.player.pitch=0;g.player.flying=false;g.updateCamera(1);});
  await page.keyboard.down('w');await page.keyboard.down('Space');
  await page.waitForFunction(()=>{const p=window.__valeGame.player;return p.position.x>31.2&&p.position.y>8.9;},{},{timeout:6000});
  await page.keyboard.up('Space');await page.keyboard.up('w');
  const bank=await page.evaluate(()=>window.__valeGame.player.serialize());
  check('Space plus movement climbs out onto a one-block bank without creative flight',bank.position[0]>30.25&&bank.position[1]>8.9&&!bank.flying);
  await page.evaluate(()=>{const g=window.__valeGame;g.player.yaw=Math.PI/2;g.player.pitch=-.5;g.updateCamera(1);});
  await page.screenshot({path:'test-results/physics-water-bank.png'});

  await page.evaluate(()=>{
    const g=window.__valeGame;
    for(let x=40;x<=44;x++)for(let z=4;z<=9;z++)for(let y=8;y<=15;y++)g.world.setBlock(x,y,z,y===8?3:0);
    g.world.setBlock(42,9,5,3);g.world.setBlock(42,10,5,13);
    for(let y=9;y<=11;y++)g.world.setBlock(42,y,8,3);
    g.player.position.set(42.5,12.002,8.5);g.player.velocity.set(0,0,0);g.player.yaw=0;g.player.pitch=-Math.atan2(3.122,3);
    g.inventory.hotbar[0]=13;g.inventory.select(0);g.updateCamera(1);g.updateTarget(0);
  });
  const aimedTorch=await page.evaluate(()=>{const g=window.__valeGame;return g.world.raycast(g.player.eye,g.player.direction,6);});
  assert.ok(aimedTorch?.id===13&&aimedTorch.normal.y===1,'stacking input must target the top of the existing torch');
  const beforeTorch=await page.evaluate(()=>window.__valeGame.inventory.count(13));
  await page.mouse.down({button:'right'});await page.mouse.up({button:'right'});
  check('stacking a torch is rejected without consuming inventory',await page.evaluate(n=>window.__valeGame.inventory.count(13)===n&&window.__valeGame.world.getBlock(42,11,5)===0,beforeTorch));
  await page.evaluate(()=>window.__valeGame.world.setBlock(42,9,5,0));
  await page.waitForFunction(()=>window.__valeGame.world.getBlock(42,10,5)===0);
  await page.waitForFunction(n=>window.__valeGame.inventory.count(13)===n+1,beforeTorch);
  check('removing torch support recovers exactly one torch',await page.evaluate(n=>window.__valeGame.inventory.count(13)===n+1,beforeTorch));

  await page.evaluate(()=>{
    const g=window.__valeGame,c=g.entities.vehicles[0];g.activeVehicle=null;
    g.player.position.set(0,9,10);g.player.velocity.set(0,0,0);
    c.position.set(3.5,9,5);c.speed=0;c.verticalVelocity=0;c.grounded=true;
    for(let x=1;x<=6;x++)for(let z=2;z<=8;z++)for(let y=6;y<=8;y++)g.world.setBlock(x,y,z,0);
  });
  await page.waitForTimeout(900);
  const fallen=await page.evaluate(()=>{const c=window.__valeGame.entities.vehicles[0];return {y:c.position.y,grounded:c.grounded,speed:c.speed};});
  check('parked vehicle falls after excavating support without entering it',fallen.y<7&&fallen.y>=5.9&&fallen.speed===0);
  await page.waitForFunction(()=>window.__valeGame.entities.vehicles[0].grounded);
  check('falling vehicle lands on the remaining solid floor',await page.evaluate(()=>Math.abs(window.__valeGame.entities.vehicles[0].position.y-6)<.25));

  await page.evaluate(()=>{
    const g=window.__valeGame,c=g.entities.vehicles[0];c.position.set(10.5,9,20);c.yaw=Math.PI;c.speed=0;c.verticalVelocity=0;c.grounded=true;c.pitch=0;c.roll=0;g.activeVehicle=c;g.internalCamera=false;g.updateCamera(1);
    window.__physicsSamples=[];
    const timer=setInterval(()=>{const car=g.entities.vehicles[0];window.__physicsSamples.push({y:car.position.y,z:car.position.z,vy:car.verticalVelocity,grounded:car.grounded,speed:car.speed});},30);
    window.__physicsTimer=timer;
  });
  await page.keyboard.down('w');
  await page.waitForFunction(()=>window.__physicsSamples.some(c=>!c.grounded&&c.vy>1&&c.y>13&&c.z<10),{},{timeout:6000});
  await page.screenshot({path:'test-results/physics-ramp-jump.png'});
  await page.keyboard.up('w');
  await page.waitForTimeout(1400);
  const trajectory=await page.evaluate(()=>{clearInterval(window.__physicsTimer);return window.__physicsSamples;});
  check('ramp launch creates an airborne upward trajectory beyond the ramp tip',trajectory.some(c=>!c.grounded&&c.vy>1&&c.y>13&&c.z<10));
  check('airborne vehicle continues forward and begins descending under gravity',trajectory.some(c=>!c.grounded&&c.vy<-.5)&&Math.min(...trajectory.map(c=>c.z))<10);
  await page.evaluate(()=>window.__valeGame.menu('pause'));
  await page.locator('[data-action="save"]').click();
  await page.waitForFunction(()=>window.__valeGame.saved?.fluids);
  const waterSave=await page.evaluate(()=>({id:window.__valeGame.world.getBlock(31,8,4),level:window.__valeGame.world.getWaterLevel(31,8,4),saved:window.__valeGame.saved}));
  await page.reload({waitUntil:'networkidle'});await page.locator('[data-action="continue"]').click();
  await page.waitForFunction(()=>window.__valeDebug?.().running);
  check('saved flowing water restores its level',await page.evaluate(before=>window.__valeGame.world.getBlock(31,8,4)===before.id&&window.__valeGame.world.getWaterLevel(31,8,4)===before.level,waterSave));
  check('new simulation introduces no browser runtime errors',errors.length===0);
  const report={date:new Date().toISOString(),browser:browser.version(),checks,errors,bank,fallen,trajectory};
  await writeFile('test-results/physics-report.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify({checks:checks.length,errors,bank,fallen,samples:trajectory.length}));
}catch(error){await page.screenshot({path:'test-results/physics-failure.png'}).catch(()=>{});console.error('STATE',JSON.stringify(await page.evaluate(()=>window.__valeDebug?.()).catch(()=>({}))));throw error;}
finally{await browser.close();}
