import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));
const check=(name,ok)=>{assert.ok(ok,name);checks.push(name);console.log('PASS',name);};
await mkdir('test-results',{recursive:true});
try{
  await page.goto('http://127.0.0.1:5186/',{waitUntil:'networkidle'});
  await page.locator('[data-action="choose-mode"][data-mode="survival"]').click();
  await page.locator('[data-action="new-game"]').click();
  await page.waitForFunction(()=>window.__valeDebug?.().running);
  await page.evaluate(()=>{const i=window.__valeGame.inventory;i.add('pickaxe');i.hotbar[7]='pickaxe';});
  await page.keyboard.press('8');await page.waitForTimeout(500);
  check('first-person pickaxe and hands are visible',await page.evaluate(()=>{const a=window.__valeGame.avatar;return a.view.visible&&!a.body.visible&&a.held.name==='held:pickaxe';}));
  await page.screenshot({path:'test-results/expansion-pickaxe.png'});
  await page.keyboard.press('c');await page.waitForTimeout(250);
  check('C switches to rear camera with original avatar',await page.evaluate(()=>window.__valeGame.cameraMode==='back'&&window.__valeGame.avatar.body.visible));
  await page.screenshot({path:'test-results/expansion-back.png'});
  await page.keyboard.press('c');await page.waitForTimeout(250);
  check('C switches to front camera',await page.evaluate(()=>window.__valeGame.cameraMode==='front'&&window.__valeGame.avatar.body.visible));
  await page.screenshot({path:'test-results/expansion-front.png'});
  await page.keyboard.press('c');
  await page.evaluate(()=>{
    const g=window.__valeGame;g.world.ensureAround(28,4,1);
    for(let x=22;x<=34;x++)for(let z=-2;z<=10;z++)for(let y=5;y<=18;y++)g.world.setBlock(x,y,z,y<=8?3:0);
    for(let x=24;x<=29;x++)for(let z=0;z<=7;z++)for(let y=6;y<=8;y++)g.world.setBlock(x,y,z,9);
    g.player.position.set(26.5,8.2,3.5);g.player.velocity.set(0,0,0);g.player.pitch=-.3;g.player.yaw=0;g.player.flying=false;
  });
  await page.waitForTimeout(1400);
  check('player sinks below the water surface without pressing Control',await page.evaluate(()=>{const g=window.__valeGame;return g.player.position.y<7.4&&g.player.inWater;}));
  await page.screenshot({path:'test-results/expansion-underwater.png'});
  await page.evaluate(()=>{const g=window.__valeGame;g.player.yaw=-Math.PI/2;});
  await page.keyboard.down('w');await page.keyboard.down('Space');
  await page.waitForFunction(()=>{const p=window.__valeGame.player.position;return p.x>31&&p.y>=9;},{},{timeout:7000});
  await page.keyboard.up('w');await page.keyboard.up('Space');
  check('swimmer can still climb out onto the bank',true);
  // Exercise actual right-click bucket use with a known target and real inventory.
  await page.evaluate(()=>{
    const g=window.__valeGame;g.player.position.set(26.5,9,9);g.player.velocity.set(0,0,0);g.player.yaw=0;g.player.pitch=-.7;
    g.inventory.add('bucket');g.inventory.hotbar[0]='bucket';g.inventory.select(0);g.updateCamera(1);
  });
  await page.waitForTimeout(150);await page.mouse.down({button:'right'});await page.mouse.up({button:'right'});
  check('right click fills a bucket from the lake',await page.evaluate(()=>window.__valeGame.inventory.selectedItem==='water_bucket'&&window.__valeGame.inventory.count('water_bucket')===1));
  await page.waitForFunction(()=>window.__valeGame.avatar.item==='water_bucket');
  await page.screenshot({path:'test-results/expansion-bucket.png'});
  await page.evaluate(()=>{
    const g=window.__valeGame;g.world.setBlock(26,9,10,24);g.player.position.set(26.5,9,13);g.player.velocity.set(0,0,0);g.player.yaw=0;g.player.pitch=-.45;g.updateCamera(1);
    g.inventory.add(10,1);g.inventory.add(18,1);
  });
  await page.waitForTimeout(150);await page.mouse.down({button:'right'});await page.mouse.up({button:'right'});
  check('right click transfers water to forge and returns empty bucket',await page.evaluate(()=>window.__valeGame.forges['26,9,10']?.water===1&&window.__valeGame.inventory.selectedItem==='bucket'));
  await page.keyboard.press('e');await page.locator('[data-action="heat"][data-recipe="iron"]').waitFor();
  await page.screenshot({path:'test-results/expansion-forge.png'});
  await page.locator('[data-action="heat"][data-recipe="iron"]').click();
  check('forge UI consumes resources and creates an iron ingot',await page.evaluate(()=>window.__valeGame.inventory.count('iron_ingot')===1&&window.__valeGame.forges['26,9,10'].water===0));
  await page.locator('[data-action="close"]').last().click();
  await page.evaluate(()=>{
    const g=window.__valeGame;g.world.setBlock(27,14,4,4);g.player.position.set(26.5,9,10);g.player.velocity.set(0,0,0);g.player.pitch=-.1;
  });
  await page.waitForFunction(()=>window.__valeGame.world.sand.falling.some(p=>p.x===27&&p.z===4));
  await page.screenshot({path:'test-results/expansion-sand.png'});
  await page.waitForFunction(()=>window.__valeGame.world.getBlock(27,6,4)===4,{},{timeout:10000});
  check('sand falls through water to the bottom in live simulation',true);
  await page.keyboard.press('c');
  await page.evaluate(()=>window.__valeGame.menu('pause'));await page.locator('[data-action="save"]').click();
  await page.waitForFunction(()=>window.__valeGame.saved?.generatorVersion===3);
  await page.reload({waitUntil:'networkidle'});await page.locator('[data-action="continue"]').click();
  await page.waitForFunction(()=>window.__valeDebug?.().running);
  check('reload preserves camera, generator, ingot, forge and settled sand',await page.evaluate(()=>{const g=window.__valeGame;return g.cameraMode==='back'&&g.world.generatorVersion===3&&g.inventory.count('iron_ingot')===1&&g.forges['26,9,10'].water===0&&g.world.getBlock(27,6,4)===4;}));
  const biomes=await page.evaluate(()=>{
    const w=window.__valeGame.world,found={};for(let x=-640;x<=640;x+=32)for(let z=-640;z<=640;z+=32){const b=w.biomeAt(x,z);if(!found[b]&&Math.abs(x)>70)found[b]=[x,z];}return found;
  });
  for(const biome of ['pradaria','deserto','floresta','meseta','nevasca']){
    check('new world contains '+biome,!!biomes[biome]);
    await page.evaluate(([x,z])=>{const g=window.__valeGame;g.mode='creative';g.inventory.mode='creative';g.player.position.set(x,g.world.surfaceHeight(x,z)+8,z);g.player.flying=true;g.player.velocity.set(0,0,0);g.player.yaw=.5;g.player.pitch=-.5;g.cameraMode='first';g.updateCamera(1);},biomes[biome]);
    await page.waitForTimeout(1200);await page.screenshot({path:`test-results/expansion-${biome}.png`});
  }
  check('legacy snapshots retain generator 1, existing edits and inventory',await page.evaluate(()=>{
    const g=window.__valeGame;g.world.setBlock(3,30,20,10);const legacy=g.snapshot();delete legacy.generatorVersion;delete legacy.dynamics;delete legacy.cameraMode;delete legacy.forges;
    g.menu('pause');g.createWorld(legacy);return g.world.generatorVersion===1&&g.world.getBlock(3,30,20)===10&&JSON.stringify(g.inventory.serialize())===JSON.stringify(legacy.inventory)&&g.cameraMode==='first';
  }));
  check('no browser runtime errors',errors.length===0);
  const report={date:new Date().toISOString(),version:'1.2.0',checks,errors,biomes};await writeFile('test-results/expansion-report.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify({checks:checks.length,errors}));
}catch(e){await page.screenshot({path:'test-results/expansion-failure.png'});console.error(await page.evaluate(()=>({debug:window.__valeDebug?.(),toast:document.querySelector('#toast')?.textContent,target:window.__valeGame?.target})));throw e;}
finally{await browser.close();}
