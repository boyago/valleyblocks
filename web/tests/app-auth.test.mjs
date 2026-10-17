import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unlink } from 'node:fs/promises';
import { openDatabase } from '../lib/server/usage-store.mjs';
import { AUTH_SCHEMA, createAccounts } from '../lib/server/accounts.mjs';
import { bearerToken, readBody } from '../lib/server/auth-http.mjs';

const request = (headers, body = '{}') => new Request('https://labsgames.cloud/api/app/login', { method: 'POST', headers, body });

test('app sessions last 30 days and expire after that', async () => {
  const path = join(tmpdir(), `labs-app-${randomUUID()}.sqlite`), db = await openDatabase({ LABS_USAGE_SQLITE_PATH: path, NODE_ENV: 'test' });
  const now = Date.now(), password = 'A safe test password with 32 chars', month = 30 * 24 * 3600000;
  try {
    for (const sql of AUTH_SCHEMA) await db.query(sql); const accounts = createAccounts(db);
    const invite = await accounts.invite({ name: 'celular', initialAdmin: true }, now); await accounts.activate(invite.token, password, now + 1);
    const site = await accounts.login('celular', password, now + 2);
    assert.equal(site.expiresAt, now + 2 + 12 * 3600000);
    const app = await accounts.login('celular', password, now + 3, 'ip', month);
    assert.ok(await accounts.session(app.token, now + 20 * 24 * 3600000));
    assert.equal(await accounts.session(app.token, now + 4 + month), null);
    await accounts.logout(app.token);
    assert.equal(await accounts.session(app.token, now + 5), null);
  } finally { await db.close?.(); await unlink(path).catch(() => {}); }
});

test('bearer token accepts only a 64-hex session token', () => {
  const token = 'a'.repeat(64);
  assert.equal(bearerToken(request({ authorization: `Bearer ${token}` })), token);
  assert.equal(bearerToken(request({ authorization: `Bearer ${token}x` })), undefined);
  assert.equal(bearerToken(request({ authorization: `Basic ${token}` })), undefined);
  assert.equal(bearerToken(request({})), undefined);
});

test('app bodies are accepted only from the app origins', async () => {
  const origins = ['https://localhost', 'capacitor://localhost'], type = { 'content-type': 'application/json' };
  assert.deepEqual(await readBody(request({ ...type, origin: 'https://localhost' }, '{"a":1}'), 4096, origins), { a: 1 });
  await assert.rejects(readBody(request({ ...type, origin: 'https://evil.example' }), 4096, origins), { status: 403 });
  await assert.rejects(readBody(request({ ...type }), 4096, origins), { status: 403 });
});
