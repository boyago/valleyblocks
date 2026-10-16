import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unlink } from 'node:fs/promises';
import { openDatabase } from '../lib/server/usage-store.mjs';
import { PLAY_SCHEMA,createPlayStore } from '../lib/server/play-store.mjs';
test('visitor/account quotas, unlimited, revocation, guest carryover, duplicate tabs and day reset',async()=>{
  const path=join(tmpdir(),`labs-play-${randomUUID()}.sqlite`),db=await openDatabase({LABS_USAGE_SQLITE_PATH:path,NODE_ENV:'test'});
  try{
    for(const sql of PLAY_SCHEMA)await db.query(sql);const store=createPlayStore(db);
    const now=Date.parse('2026-10-11T15:00:00Z'),input={game:'valleyblocks',session:randomUUID(),active:true};
    let data=await store.record('guest',input,{},now);assert.equal(data.remainingSeconds,900);
    for(let i=1;i<=60;i++)data=await store.record('guest',input,{},now+i*15000);
    assert.equal(data.allowed,false);assert.equal(data.remainingSeconds,0);
    await store.claimGuest('guest','account',now+900001);await store.claimGuest('guest','account',now+900002);
    data=await store.record('account',input,{account:true},now+900003);assert.equal(data.remainingSeconds,2700);
    assert.equal((await store.record('account',{...input,session:randomUUID()},{account:true},now+900004)).reason,'already-playing');
    await db.query('UPDATE labs_play_daily SET used_ms=? WHERE owner_id=?',[4000000,'account']);
    data=await store.record('account',input,{account:true,unlimited:true},now+915003);assert.equal(data.allowed,true);assert.equal(data.remainingSeconds,null);
    data=await store.record('account',input,{account:true,unlimited:false},now+930003);assert.equal(data.allowed,false);
    data=await store.record('account',input,{account:true},Date.parse('2026-10-12T03:00:01Z'));assert.equal(data.remainingSeconds,3600);assert.equal(data.allowed,true);
    await store.cleanup(now+5*86400000);assert.equal((await db.query('SELECT * FROM labs_play_daily')).length,0);
  }finally{await db.close();await unlink(path);}
});

test('only the catalog game is accepted and daily time is shared between sessions', async () => {
  const { parseUsageBody, knownGames } = await import('../lib/server/usage-http.mjs');
  const games = knownGames();
  assert.ok(games.has('valleyblocks') && games.size === 1);
  const session = randomUUID();
  assert.equal(parseUsageBody({ game: 'valleyblocks', session, active: true }).game, 'valleyblocks');
  for (const game of ['nao-existe', 'canyon-strike', '../etc/passwd', '', null, 42]) assert.throws(() => parseUsageBody({ game, session, active: true }));
  const path = join(tmpdir(), `labs-play-${randomUUID()}.sqlite`), db = await openDatabase({ LABS_USAGE_SQLITE_PATH: path, NODE_ENV: 'test' });
  try {
    for (const sql of PLAY_SCHEMA) await db.query(sql); const store = createPlayStore(db);
    const now = Date.parse('2026-10-11T15:00:00Z');
    let data = await store.record('guest', { game: 'valleyblocks', session, active: true }, {}, now);
    for (let i = 1; i <= 20; i++) data = await store.record('guest', { game: 'valleyblocks', session, active: true }, {}, now + i * 15000);
    await store.record('guest', { game: 'valleyblocks', session, active: false }, {}, now + 21 * 15000);
    const other = await store.record('guest', { game: 'valleyblocks', session: randomUUID(), active: true }, {}, now + 22 * 15000);
    assert.ok(other.remainingSeconds <= 900 - 290, 'time used in one session counts in the next: ' + other.remainingSeconds);
  } finally { await db.close(); await unlink(path); }
});
