// Controles de toque num celular simulado (paisagem, ponteiro grosseiro, ?touch=1).
// Requer o servidor de desenvolvimento: npm run dev (porta 5186).
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium,devices}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge',args:['--autoplay-policy=no-user-gesture-required']});
const phone=devices['Pixel 7']||{};
const context=await browser.newContext({...phone,viewport:{width:915,height:412},deviceScaleFactor:1,isMobile:true,hasTouch:true});
const page=await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const checks=[];
const check=(label,value)=>{assert.ok(value,label);checks.push(label);console.log('PASS',label);};
const state=()=>page.evaluate(()=>window.__valeDebug());
const cdp=await context.newCDPSession(page);
const touch=async(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(p=>({x:p.x,y:p.y,id:p.id??0}))});
const setPlayer=async(x,y,z,yaw=0,pitch=-.1)=>page.evaluate(({x,y,z,yaw,pitch})=>{const g=window.__valeGame;g.player.position.set(x,y,z);g.player.velocity.set(0,0,0);g.player.yaw=yaw;g.player.pitch=pitch;g.player.flying=false;g.world.ensureAround(x,z,1);g.updateCamera(1);},{x,y,z,yaw,pitch});
await mkdir('test-results',{recursive:true});
try {
  await page.goto((process.env.GAME_URL||'http://127.0.0.1:5186/')+'?touch=1',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.__valeDebug?.().ready);
  await page.waitForTimeout(2500);
  await page.screenshot({path:'test-results/touch-01-landing.png'});
  check('tela inicial abre no celular sem erros',errors.length===0&&await page.evaluate(()=>document.querySelector('#app').classList.contains('touch')));
  await page.locator('[data-action="choose-mode"][data-mode="creative"]').tap();
  await page.locator('[data-action="new-game"]').tap();
  await page.waitForFunction(()=>window.__valeDebug().running);
  await page.waitForTimeout(600);
  await page.screenshot({path:'test-results/touch-02-hud.png'});
  check('jogo começa sem pointer lock, com camada de toque visível e qualidade leve',await page.evaluate(()=>document.pointerLockElement===null&&getComputedStyle(document.querySelector('#touch-layer')).display==='block'&&window.__valeGame.settings.quality==='low'));

  // Joystick: segurar à esquerda e empurrar para cima anda para frente.
  await setPlayer(0,9.01,12,0,-.1);
  const before=(await state()).player.position;
  await touch('touchStart',[{x:150,y:300,id:1}]);
  await touch('touchMove',[{x:150,y:250,id:1}]);
  await page.waitForTimeout(700);
  const keys=await page.evaluate(()=>[...window.__valeGame.keys]);
  await touch('touchEnd',[]);
  await page.waitForTimeout(100);
  const after=(await state()).player.position;
  check('joystick esquerdo anda para frente (W) e solta ao levantar o dedo',keys.includes('KeyW')&&after[2]<before[2]-1&&await page.evaluate(()=>window.__valeGame.keys.size===0));

  // Olhar: arrastar na metade direita gira o jogador.
  const yawBefore=(await state()).player.yaw;
  await touch('touchStart',[{x:650,y:200,id:2}]);
  for(let i=1;i<=6;i++)await touch('touchMove',[{x:650-i*15,y:200,id:2}]);
  await touch('touchEnd',[]);
  await page.waitForTimeout(100);
  check('arrastar à direita olha ao redor',Math.abs((await state()).player.yaw-yawBefore)>.1);

  // Toque longo minera um bloco à frente; toque curto coloca um bloco.
  await setPlayer(16.5,9,15,0,-.2);
  await page.evaluate(()=>{const g=window.__valeGame;g.world.setBlock(16,9,11,5);g.inventory.add(12,64);g.inventory.hotbar[0]=12;g.inventory.select(0);});
  await page.waitForTimeout(150);
  await touch('touchStart',[{x:700,y:200,id:3}]);
  await page.waitForTimeout(1300);
  const miningMid=await page.evaluate(()=>window.__valeGame.mining);
  await touch('touchEnd',[]);
  await page.waitForTimeout(100);
  check('toque longo minera o bloco mirado',miningMid&&await page.evaluate(()=>window.__valeGame.world.getBlock(16,9,11)===0&&!window.__valeGame.mining));
  await page.evaluate(()=>{window.__valeGame.player.pitch=-.6;});
  await page.waitForTimeout(100);
  const spot=await page.evaluate(()=>{const g=window.__valeGame;const t=g.world.raycast(g.player.eye,g.player.direction,6);return t?[t.x+t.normal.x,t.y+t.normal.y,t.z+t.normal.z]:null;});
  await touch('touchStart',[{x:700,y:200,id:4}]);
  await page.waitForTimeout(80);
  await touch('touchEnd',[]);
  await page.waitForTimeout(100);
  check('toque curto coloca um bloco',!!spot&&await page.evaluate(s=>window.__valeGame.world.getBlock(...s)===12,spot)&&(await state()).goals.build);

  // Botão Pular segura Espaço; aviso de contexto vira botão e abre a bancada.
  await touch('touchStart',[{x:860,y:300,id:5}]);
  await page.waitForTimeout(80);
  const jumpHeld=await page.evaluate(()=>window.__valeGame.keys.has('Space'));
  await touch('touchEnd',[]);
  await page.waitForTimeout(80);
  check('botão Pular segura Espaço enquanto pressionado',jumpHeld&&await page.evaluate(()=>!window.__valeGame.keys.has('Space')));
  await setPlayer(16.5,9.01,15,0,-.25);
  await page.evaluate(()=>{const g=window.__valeGame;g.world.setBlock(16,9,12,15);g.world.setBlock(16,10,12,0);g.updateCamera(1);});
  await page.waitForTimeout(400);
  const prompt=await page.locator('#context-prompt').textContent();
  await page.locator('#context-prompt').tap();
  await page.waitForTimeout(200);
  await page.screenshot({path:'test-results/touch-03-bench.png'});
  check('aviso de contexto tocável abre a bancada',/bancada/i.test(prompt)&&(await state()).menu==='workbench');
  await page.locator('[data-action="close"]').first().tap();
  await page.waitForFunction(()=>window.__valeDebug().running);
  await page.locator('[data-touch="bag"]').tap();
  await page.waitForTimeout(150);
  check('botão Mochila abre o inventário',(await state()).menu==='inventory');
  await page.locator('[data-action="close"]').first().tap();
  await page.waitForFunction(()=>window.__valeDebug().running);
  await page.locator('[data-touch="camera"]').tap();
  await page.waitForTimeout(100);
  check('botão Câmera alterna para câmera de costas',await page.evaluate(()=>window.__valeGame.cameraMode==='back'));
  await page.locator('[data-touch="fly"]').tap();
  await page.waitForTimeout(100);
  check('botão Voar liga o voo no criativo',(await state()).player.flying);
  await page.screenshot({path:'test-results/touch-04-final.png'});
  check('nenhum erro de runtime durante a sessão',errors.length===0);
  await writeFile('docs/touch-report.json',JSON.stringify({ok:true,checks,errors,date:new Date().toISOString()},null,2));
  console.log(`\n${checks.length} verificações passaram.`);
} catch(error){
  await page.screenshot({path:'test-results/touch-failure.png'}).catch(()=>{});
  console.error('FAIL',error.message,errors);
  process.exitCode=1;
} finally { await browser.close(); }
