// Cena de teste do visual novo: a mesma vista da casa inicial, antes e depois.
// Requer o servidor de desenvolvimento: npm run dev (porta 5186).
// Saída: test-results/visual-antes.png e test-results/visual-novo.png
import { mkdir } from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge',args:['--use-angle=gl','--enable-gpu']});
await mkdir('test-results',{recursive:true});
const HOUR=process.env.HORA||'0.62';
try{
  for(const [name,query] of [['antes',''],['novo','&visual=novo']]){
    const page=await browser.newPage({viewport:{width:1280,height:720}});
    await page.goto(`${process.env.GAME_URL||'http://127.0.0.1:5186/'}?hora=${HOUR}${query}`,{waitUntil:'networkidle'});
    await page.waitForFunction(()=>window.__valeDebug?.().ready);
    await page.locator('[data-action="new-game"]').click();
    await page.locator('[data-action="close"]').first().click().catch(()=>{});
    await page.waitForFunction(()=>window.__valeGame?.started);
    await page.addStyleTag({content:'#app>*:not(canvas){visibility:hidden!important}'});
    const fps=await page.evaluate(async()=>{const g=window.__valeGame;g.settings.quality='high';g.settings.shadows=true;
      g.player.flying=true;g.player.position.set(9,14,11);g.player.velocity.set(0,0,0);g.player.yaw=Math.PI*.22;g.player.pitch=-.32;g.running=true;g.updateCamera(1);
      await new Promise(r=>setTimeout(r,5000));
      let n=0;const t0=performance.now();await new Promise(r=>{const f=()=>{if(++n<120)requestAnimationFrame(f);else r();};requestAnimationFrame(f);});
      return Math.round(120000/(performance.now()-t0));});
    await page.screenshot({path:`test-results/visual-${name}.png`});
    console.log(name,'fps',fps);
    // Close dos pets: cachorro e gato parados lado a lado, de frente para a câmera.
    await page.evaluate(async()=>{const g=window.__valeGame,e=g.entities,[dog,cat]=[e.pets.find(p=>p.type==='dog'),e.pets.find(p=>p.type==='cat')];
      const base=dog.position.clone();for(const p of [dog,cat]){p.mode='stay';p.goal=null;p.path.length=0;}
      cat.position.copy(base).add({x:1.1,y:0,z:0});cat.mesh.position.copy(cat.position);dog.yaw=cat.yaw=0;
      g.player.position.set(base.x+.55,base.y+.35,base.z+3.1);g.player.yaw=0;g.player.pitch=-.12;g.updateCamera(1);
      await new Promise(r=>setTimeout(r,1500));});
    await page.screenshot({path:`test-results/visual-${name}-pets.png`});
    await page.close();
  }
}finally{await browser.close();}
