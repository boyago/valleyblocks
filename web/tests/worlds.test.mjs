import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unlink } from 'node:fs/promises';
import { openDatabase } from '../lib/server/usage-store.mjs';
import { WORLD_SCHEMA, createWorldStore, worldBinding, verifyWorldBinding, validateWorld } from '../lib/server/world-store.mjs';
import { createGameWorld } from '../lib/game-world-client.mjs';
const snapshot = seed => ({ version: 1, mode: 'creative', seed, edits: [[1,2,3,4]] });

test('worlds isolate accounts, reject stale tabs and visitors, retry lost responses', async () => {
  const path = join(tmpdir(), `labs-world-${randomUUID()}.sqlite`), db = await openDatabase({ LABS_USAGE_SQLITE_PATH: path, NODE_ENV: 'test' });
  try {
    for (const sql of WORLD_SCHEMA) await db.query(sql);
    const worlds = createWorldStore(db);
    assert.deepEqual(await worlds.load('user:a'), { revision: 0, snapshot: null, savedAt: null });
    const input = { revision: 0, requestId: randomUUID(), snapshot: snapshot('a') };
    const result = await worlds.save('user:a', input);
    assert.equal(result.revision, 1);
    assert.deepEqual(await worlds.save('user:a', input), result);
    await assert.rejects(worlds.save('user:a', { ...input, snapshot: snapshot('changed') }), { status: 409 });
    const competing = await Promise.allSettled([1, 2].map(n => worlds.save('user:a', { revision: 1, requestId: randomUUID(), snapshot: snapshot('tab' + n) })));
    assert.equal(competing.filter(v => v.status === 'fulfilled').length, 1);
    assert.equal((await worlds.load('user:b')).snapshot, null);
    await assert.rejects(worlds.save('guest:c', { ...input, requestId: randomUUID(), snapshot: snapshot('visitor') }), {status:401});
    await assert.rejects(worlds.load('guest:c'), {status:401});
    assert.equal((await db.query("SELECT * FROM labs_worlds WHERE owner_id LIKE 'guest:%'")).length,0);
  } finally { await db.close(); await unlink(path); }
});

test('account changes and forged identities cannot reuse a loaded world binding', () => {
  const secret = 'test-only-'.repeat(6), binding = worldBinding('user:a', secret);
  assert.doesNotThrow(() => verifyWorldBinding('user:a', binding, secret));
  for (const owner of ['user:b', 'guest:a']) assert.throws(() => verifyWorldBinding(owner, binding, secret), { status: 409 });
  assert.throws(() => verifyWorldBinding('user:a', 'forged', secret), { status: 409 });
  assert.throws(() => validateWorld({ ...snapshot('a'), version: 99 }));
  assert.throws(() => validateWorld({ ...snapshot('a'), player: { x: NaN } }));
  assert.throws(() => validateWorld({ ...snapshot('a'), extra: 'a'.repeat(4 * 1024 * 1024) }), { status: 413 });
});

test('portal serializes remote requests and reports HTTP conflicts to the game', async () => {
  const replies = [], calls = [];
  const client = createGameWorld({ send: (type, data) => replies.push({ type, ...data }), fetcher: async (url, options) => {
    calls.push(JSON.parse(options.body));
    return Response.json({ error: 'Conflito' }, { status: 409 });
  } });
  await client.request({ action: 'save', requestId: 'bridge-id', operationId: 'write-id', binding: 'identity', revision: 1, snapshot: snapshot('a') });
  assert.equal(calls[0].requestId, 'write-id');
  assert.equal(replies[0].requestId, 'bridge-id');
  assert.equal(replies[0].status, 409);
  client.dispose();
  await client.request({ action: 'load', requestId: 'late' });
  assert.equal(calls.length, 1);
});
