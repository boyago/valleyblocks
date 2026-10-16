import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unlink } from 'node:fs/promises';
import { advanceSession, remainingSeconds, dayKey } from '../lib/usage-policy.mjs';
import { openDatabase, SCHEMA, createUsageStore } from '../lib/server/usage-store.mjs';
import { identifyVisitor, parseUsageBody, secureEqual } from '../lib/server/usage-http.mjs';
import { createGameUsage } from '../lib/game-usage-client.mjs';
const start=Date.parse('2026-10-11T15:00:00Z'),game='vale-dos-blocos';

test('policy grants 15/60 minutes with previously used guest time subtracted',()=>{
  assert.equal(remainingSeconds('visitor',0),900);
  assert.equal(remainingSeconds('account',900),2700);
  assert.equal(remainingSeconds('visitor',999),0);
  assert.throws(()=>remainingSeconds('admin',0));
});
test('clock counts only active intervals, caps missing heartbeats and splits Sao Paulo midnight',()=>{
  const input={session:randomUUID(),game,active:true};
  let state=advanceSession(null,input,start).row;
  let result=advanceSession(state,{...input,active:false},start+12000);
  assert.equal(result.segments[0].ms,12000);state=result.row;
  result=advanceSession(state,input,start+90000);assert.deepEqual(result.segments,[]);
  result=advanceSession(result.row,input,start+190000);assert.equal(result.segments[0].ms,30000);
  const midnight=Date.parse('2026-10-12T03:00:00Z');
  state=advanceSession(null,input,midnight-10000).row;
  result=advanceSession(state,input,midnight+10000);
  assert.deepEqual(result.segments,[{day:'2026-10-11',ms:10000},{day:'2026-10-12',ms:10000}]);
  assert.equal(dayKey(midnight),'2026-10-12');
});
test('second tab cannot inflate activity or deactivate the owner; expired owners can be replaced',()=>{
  const first={session:randomUUID(),game,active:true},second={...first,session:randomUUID()};
  const state=advanceSession(null,first,start).row;
  assert.equal(advanceSession(state,second,start+1000).accepted,false);
  assert.equal(advanceSession(state,{...second,active:false},start+50000).accepted,false);
  assert.equal(advanceSession(state,second,start+50000).accepted,true);
});
test('persistent store reports consented browsers, sessions and time without duplicate resumes',async()=>{
  const path=join(tmpdir(),`labs-usage-test-${randomUUID()}.sqlite`);
  let db=await openDatabase({NODE_ENV:'test',LABS_USAGE_SQLITE_PATH:path});
  try{
    for(const sql of SCHEMA)await db.query(sql);
    let store=createUsageStore(db);
    const a={session:randomUUID(),game,active:true},b={...a,session:randomUUID()};
    await store.record('browser-a',a,start);
    await store.record('browser-a',a,start+15000);
    assert.equal((await store.record('browser-a',b,start+16000)).accepted,false);
    await store.record('browser-a',{...a,active:false},start+20000);
    await store.record('browser-a',a,start+60000);
    await store.record('browser-b',b,start+60000);
    let report=await store.report(start+60000);
    assert.equal(Number(report.active[0].players),2);
    assert.equal(Number(report.days[0].sessions),2);
    assert.equal(Number(report.days[0].active_ms),20000);
    assert.equal(Number(report.days[0].browsers),2);
    await db.close();db=await openDatabase({NODE_ENV:'test',LABS_USAGE_SQLITE_PATH:path});store=createUsageStore(db);
    report=await store.report(start+120000);assert.equal(report.active.length,0);assert.equal(Number(report.days[0].sessions),2);
    await store.cleanup(start+32*86400000);assert.equal((await store.report(start+32*86400000)).days.length,0);
  }finally{await db.close();await unlink(path);}
});
test('visitor cookies are signed and identifiers cannot be chosen by requests',()=>{
  const secret='test-only-secret-with-more-than-32-characters';
  const first=identifyVisitor(new Request('http://localhost'),secret);
  assert.match(first.cookie,/HttpOnly/);
  const cookie=first.cookie.split(';')[0];
  const next=identifyVisitor(new Request('http://localhost',{headers:{cookie}}),secret);
  assert.equal(next.hash,first.hash);assert.equal(next.cookie,null);
  const forged=identifyVisitor(new Request('http://localhost',{headers:{cookie:cookie.slice(0,-1)+'x'}}),secret);
  assert.notEqual(forged.hash,first.hash);
  assert.throws(()=>identifyVisitor(new Request('http://localhost'),'short'));
  assert.equal(secureEqual('secret','wrong'),false);
  assert.throws(()=>parseUsageBody({game:'other',session:randomUUID(),active:true}));
});
test('browser tracker requires opt-in, excludes hidden/paused play and sends stop on disposal',async()=>{
  const calls=[],doc=new EventTarget(),win=new EventTarget();doc.hidden=false;
  let choice=null,tick;win.localStorage={getItem:()=>choice};win.setInterval=fn=>(tick=fn,1);win.clearInterval=()=>{};
  const tracker=createGameUsage({game,enabled:true,doc,win,fetcher:async(url,options)=>{calls.push(JSON.parse(options.body));return {};}});
  const flush=()=>new Promise(resolve=>setImmediate(resolve));
  tracker.state(true);tick();await flush();assert.equal(calls.length,0);
  choice='accepted';win.dispatchEvent(new Event('labs-privacy-change'));await flush();assert.equal(calls.at(-1).active,true);
  doc.hidden=true;doc.dispatchEvent(new Event('visibilitychange'));await flush();assert.equal(calls.at(-1).active,false);
  const count=calls.length;tick();await flush();assert.equal(calls.length,count);
  doc.hidden=false;doc.dispatchEvent(new Event('visibilitychange'));await flush();
  tracker.state(false);await flush();assert.equal(calls.at(-1).active,false);
  tracker.state(true);await flush();tracker.dispose();await flush();assert.equal(calls.at(-1).active,false);
});


test('withdrawal suppresses active events still queued on a slow connection',async()=>{
  const calls=[],doc=new EventTarget(),win=new EventTarget();doc.hidden=false;
  let choice='accepted',tick,resolveFirst;
  win.localStorage={getItem:()=>choice};win.setInterval=fn=>(tick=fn,1);win.clearInterval=()=>{};
  const tracker=createGameUsage({game,enabled:true,doc,win,fetcher:async(url,options)=>{
    calls.push(JSON.parse(options.body));if(calls.length===1)await new Promise(resolve=>resolveFirst=resolve);
  }});
  const flush=()=>new Promise(resolve=>setImmediate(resolve));
  tracker.state(true);await flush();tick();tick();choice='rejected';win.dispatchEvent(new Event('labs-privacy-change'));
  resolveFirst();await flush();assert.deepEqual(calls.map(c=>c.active),[true,false]);tracker.dispose();
});
test('rate limiter caps visitor and process traffic with bounded retention',async()=>{
  const {createUsageLimiter}=await import('../lib/server/usage-rate-limit.mjs');
  const allow=createUsageLimiter();for(let n=0;n<30;n++)assert.equal(allow('a',start),true);
  assert.equal(allow('a',start),false);assert.equal(allow('a',start+60000),true);
  for(let n=1;n<2000;n++)assert.equal(allow('visitor-'+n,start+60000),true);
  assert.equal(allow('extra',start+60000),false);
});
