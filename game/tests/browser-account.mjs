// Login na tela inicial do app (Capacitor simulado, servidor /api/app simulado).
// Requer o servidor de desenvolvimento: npm run dev (porta 5186).
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge'});
const page=await browser.newPage({viewport:{width:1280,height:800}});
const errors=[],calls=[];page.on('pageerror',e=>errors.push(e.message));
const check=(label,value)=>{assert.ok(value,label);console.log('PASS',label);};
await mkdir('test-results',{recursive:true});
const TOKEN='b'.repeat(64);
await page.addInitScript(()=>{window.Capacitor={isNativePlatform:()=>true,Plugins:{}};});
await page.route('https://labsgames.cloud/api/app/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname;calls.push({path,auth:req.headers().authorization||''});
  const reply=(status,body)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  if(path.endsWith('/login')){const b=JSON.parse(req.postData()||'{}');return b.password==='senha certa'?reply(200,{token:TOKEN,account:{username:b.username,entitlements:{outfits:['expedicao']}}}):reply(401,{error:'Usuário ou senha inválidos.'});}
  if(path.endsWith('/me'))return reply(200,{account:req.headers().authorization===`Bearer ${TOKEN}`?{username:'alexandre',entitlements:{outfits:['expedicao']}}:null});
  if(path.endsWith('/logout'))return reply(200,{ok:true});
  return reply(404,{});
});
try{
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:5186/',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.__valeDebug?.().ready);
  check('tela inicial oferece entrar na conta',await page.locator('[data-action="account-login"]').count()===1);
  await page.locator('[data-action="account-login"]').click();
  await page.waitForSelector('#account-user');
  await page.fill('#account-user','alexandre');await page.fill('#account-pass','errada');
  await page.press('#account-pass','Enter');
  await page.waitForSelector('.login-error');
  check('senha errada mostra o erro e guarda o usuário',/inválidos/.test(await page.textContent('.login-error'))&&await page.inputValue('#account-user')==='alexandre');
  await page.screenshot({path:'test-results/account-01-error.png'});
  await page.fill('#account-pass','senha certa');await page.locator('[data-action="account-submit"]').click();
  await page.waitForSelector('.account-row strong');
  await page.screenshot({path:'test-results/account-02-logged.png'});
  check('volta à tela inicial conectado',await page.textContent('.account-row strong')==='alexandre');
  check('token guardado, senha não',await page.evaluate(()=>localStorage.getItem('vb-account-token')?.length===64&&!JSON.stringify(localStorage).includes('senha')));
  check('roupas compradas liberadas',await page.evaluate(()=>window.__valeGame.ownedPacks.includes('expedicao')));
  await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>window.__valeDebug?.().ready);
  await page.waitForSelector('.account-row strong');
  check('ao reabrir o app continua conectado',calls.some(c=>c.path.endsWith('/me')&&c.auth===`Bearer ${TOKEN}`));
  await page.locator('[data-action="account-logout"]').click();
  await page.waitForSelector('[data-action="account-login"]');
  check('sair apaga o token',await page.evaluate(()=>localStorage.getItem('vb-account-token')===null)&&calls.some(c=>c.path.endsWith('/logout')));
  check('nenhum erro de runtime',errors.length===0);
}finally{await browser.close();}
