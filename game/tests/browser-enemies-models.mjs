// Inimigos com modelo do Blender: aparecem, brilham à noite, andam e atacam com o braço.
// Requer o servidor de desenvolvimento: npm run dev (porta 5186).
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge'});
const page=await browser.newPage({viewport:{width:1280,height:800}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const check=(label,value)=>{assert.ok(value,label);console.log('PASS',label);};
const ROWS=[['reaper','cangaceiro','terracota','oni','pegrande','golem'],['et','saci','ratao','boitata','specter']];
await mkdir('test-results',{recursive:true});
try{
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:5186/',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.__valeDebug?.().ready);
  await page.locator('[data-action="new-game"]').click();
  await page.locator('[data-action="close"]').first().click().catch(()=>{});
  await page.waitForFunction(()=>window.__valeGame?.started);
  for(const [n,row] of ROWS.entries()){
    const made=await page.evaluate(row=>{const g=window.__valeGame,V=g.player.position.constructor;
      for(const e of [...g.enemies.enemies])g.enemies.remove(e);g.time=.9;
      const out=row.map((t,i)=>{const p=new V(2+i*1.7,9.01,22);const y=g.world.heightAt(p.x,p.z,30);if(y!==null)p.y=y;const e=g.enemies.spawn(t,p);if(e){e.yaw=0;e.mesh.rotation.y=0;}return !!e&&!!e.arm&&(["boitata","specter"].includes(t)||e.legs.length>=1);});
      g.player.position.set(6.3,9.01,28);g.player.velocity.set(0,0,0);g.player.yaw=0;g.player.pitch=-.12;g.cameraMode='first';g.updateCamera(1);g.running=false;g.ui.setMenu(null,g);
      g.renderer?.render?.(g.scene,g.camera);return out;},row);
    check(`inimigos ${row.join(', ')} montados com o modelo novo`,made.every(Boolean));
    await page.waitForTimeout(900);
    await page.screenshot({path:`test-results/enemies-models-${n+1}.png`});
  }
  check('olhos e magma brilham (material sem luz)',await page.evaluate(()=>window.__valeGame.enemies.enemies.some(e=>{let lit=false;e.mesh.traverse(m=>{if(m.material?.type==='MeshBasicMaterial')lit=true;});return lit;})));
  const swing=await page.evaluate(()=>{const g=window.__valeGame,e=g.enemies.enemies[0];e.windup=.3;g.enemies.update(.05,g.player,.9,'survival');return e.arm.rotation.x;});
  check('braço gira no ataque',Math.abs(swing)>.1);
  check('nenhum erro de runtime',errors.length===0);
}finally{await browser.close();}
