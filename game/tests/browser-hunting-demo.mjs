import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
  await page.goto('http://127.0.0.1:5186/?demo=caca',{waitUntil:'networkidle'});
  await page.getByRole('button',{name:'Iniciar demonstração',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.__valeGame.world.getBlock(44,35,47)),24);
  assert.equal(await page.evaluate(()=>window.__valeGame.wildlife.animals.length),3);
  assert.equal(await page.evaluate(()=>window.__valeGame.save()),false);
  await page.screenshot({path:'test-results/hunting-demo-ready.png'});
  await page.getByRole('button',{name:'Iniciar demonstração',exact:true}).click();
  await page.waitForFunction(()=>window.__valeGame.entities.pets.some(p=>p.carry),null,{timeout:45000});
  await page.screenshot({path:'test-results/hunting-demo-carry.png'});
  await page.getByRole('button',{name:'Repetir demonstração',exact:true}).waitFor({timeout:45000});
  assert.ok(await page.evaluate(()=>['raw_chicken','raw_rabbit','raw_boar'].some(id=>window.__valeGame.inventory.count(id)>0)));
  await page.screenshot({path:'test-results/hunting-demo-delivery.png'});
  await page.getByRole('button',{name:'Ver receitas da churrasqueira',exact:true}).click();
  assert.equal(await page.locator('[data-action="heat"]').count(),8);
  assert.deepEqual(errors,[]);
  console.log('PASS: ready scene, three species, station, disabled saves, real dog hunt/carry/delivery and eight barbecue recipes');
}finally{await browser.close();}
