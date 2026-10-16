import test from 'node:test';
import assert from 'node:assert/strict';
import { createRemoteSaves } from '../src/remote-save.js';
import { saveGame, loadGame, writeBackup, readBackup } from '../src/save.js';

const snapshot = seed => ({ version: 1, seed, mode: 'creative', edits: [] });
function fixture() {
  const copies = new Map(), writes = []; let fail = false, conflict = false, current = null, revision = 0, lastId;
  return {
    copies, writes,
    set fail(value) { fail = value; }, set conflict(value) { conflict = value; },
    options: { legacyLoad: async () => snapshot('legacy'), backup: { read: async () => structuredClone([...copies.values()].find(v=>v.pending)), write: async (key, value) => copies.set(key, structuredClone(value)) }, request: async (action, data) => {
      if (action === 'load') return { snapshot: current, revision, binding: 'owner-a', account: true };
      writes.push(structuredClone(data));
      if (conflict) throw Object.assign(Error('Conflict'), { status: 409 });
      if (data.operationId !== lastId) { assert.equal(data.revision, revision); current = data.snapshot; revision++; lastId = data.operationId; }
      if (fail) throw Error('Lost response');
      return { revision, savedAt: new Date().toISOString() };
    } },
  };
}
test('legacy worlds require explicit import; lost responses retry the same write and preserve a backup', async () => {
  const f = fixture(), saves = createRemoteSaves(f.options);
  assert.equal(await saves.load(), null); assert.equal(f.writes.length, 0); assert.equal(saves.info().localAvailable, true);
  f.fail = true;
  await assert.rejects(saves.save(snapshot('new')));
  assert.equal([...f.copies.values()][0].snapshot.seed, 'new');
  assert.equal([...f.copies.values()][0].pending, true);
  f.fail = false;
  await saves.save(snapshot('newer'));
  assert.equal(f.writes[0].operationId, f.writes[1].operationId);
  assert.equal([...f.copies.values()][0].pending, false);
  assert.equal([...f.copies.values()][0].snapshot.seed, 'newer');
  assert.equal(saves.info().localAvailable, false);
});
test('conflict blocks further cloud writes and leaves exportable progress', async () => {
  const f = fixture(), saves = createRemoteSaves(f.options); await saves.load(); f.conflict = true;
  await assert.rejects(saves.save(snapshot('my-copy')), { status: 409 });
  assert.equal((await saves.backupSnapshot()).seed, 'my-copy');
  await assert.rejects(saves.save(snapshot('later')));
  assert.equal(f.writes.length, 1);
});
test('load failures never enable saving into an empty replacement', async () => {
  const saves = createRemoteSaves({ request: async () => { throw Error('Offline'); } });
  await assert.rejects(saves.load()); await assert.rejects(saves.save(snapshot('new')));
});
test('two tabs keep separate pending recovery copies for the same account', async () => {
  const f=fixture(), a=createRemoteSaves(f.options), b=createRemoteSaves(f.options);
  await a.load();await b.load();f.conflict=true;
  await assert.rejects(a.save(snapshot('tab-a')));await assert.rejects(b.save(snapshot('tab-b')));
  assert.deepEqual([...f.copies.values()].map(v=>v.snapshot.seed),['tab-a','tab-b']);
});
test('visitors and free accounts keep local saves and send no world contents to the server', async () => {
  for(const account of [false,true]) {
    const calls=[], local=[];
    const saves=createRemoteSaves({request:async action=>{calls.push(action);return {localOnly:true,account};},legacyLoad:async()=>snapshot('old-local'),localSave:async data=>local.push(data)});
    assert.equal((await saves.load()).seed,'old-local');assert.equal(saves.cloud,false);
    await saves.save(snapshot('new-local'));
    assert.deepEqual(calls,['load']);assert.equal(local[0].seed,'new-local');
  }
});
test('revoked cloud access never falls back to overwriting a browser world', async () => {
  let writes=0,localWrites=0;
  const saves=createRemoteSaves({request:async action=>{if(action==='load')return {binding:'a',revision:0,account:true};writes++;throw Object.assign(Error('Revoked'),{status:403});},legacyLoad:async()=>null,localSave:async()=>localWrites++,backup:{read:async()=>null,write:async()=>{}}});
  await saves.load();await assert.rejects(saves.save(snapshot('cloud')),{status:403});
  await assert.rejects(saves.save(snapshot('new')));
  assert.equal(writes,1);assert.equal(localWrites,0);
});
test('remote backups do not replace legacy saves or another owner backup', async () => {
  const items = new Map(); globalThis.localStorage = { setItem: (k,v) => items.set(k,v), getItem: k => items.get(k) || null };
  try {
    await saveGame(snapshot('legacy')); await writeBackup('a', { snapshot: snapshot('a') }); await writeBackup('b', { snapshot: snapshot('b') });
    assert.equal((await loadGame()).seed, 'legacy'); assert.equal((await readBackup('a')).snapshot.seed, 'a'); assert.equal((await readBackup('b')).snapshot.seed, 'b');
  } finally { delete globalThis.localStorage; }
});
