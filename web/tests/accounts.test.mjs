import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unlink } from 'node:fs/promises';
import { openDatabase } from '../lib/server/usage-store.mjs';
import { AUTH_SCHEMA,createAccounts,hashPassword,verifyPassword } from '../lib/server/accounts.mjs';
import { sessionCookie,readBody } from '../lib/server/auth-http.mjs';
test('passwords use salted hashes and reject invalid passwords',async()=>{
  const p='Example secure passphrase 2026';const a=await hashPassword(p),b=await hashPassword(p);
  assert.notEqual(a,b);assert.ok(!a.includes(p));assert.equal(await verifyPassword(p,a),true);assert.equal(await verifyPassword('wrong',a),false);assert.equal(await verifyPassword(p,null),false);await assert.rejects(hashPassword('short'));
});
test('admin activation, roles, unlimited grants, revocation, login limits and session invalidation',async()=>{
  const path=join(tmpdir(),`labs-accounts-${randomUUID()}.sqlite`),db=await openDatabase({LABS_USAGE_SQLITE_PATH:path,NODE_ENV:'test'});
  const now=Date.now(),password='A safe test password with 32 chars';
  try{
    for(const sql of AUTH_SCHEMA)await db.query(sql);const accounts=createAccounts(db);
    const admin=await accounts.invite({name:'alexandre',initialAdmin:true},now);
    const rows=await db.query('SELECT * FROM labs_account_invites');assert.notEqual(rows[0].token_hash,admin.token);
    await assert.rejects(accounts.login('alexandre',password,now));
    await assert.rejects(accounts.invite({name:'other_admin',initialAdmin:true},now));
    await accounts.activate(admin.token,password,now+1);
    await assert.rejects(accounts.activate(admin.token,password,now+2));
    const auth=await accounts.login('alexandre',password,now+3);assert.equal((await accounts.session(auth.token,now+4)).role,'admin');
    const player=await accounts.invite({name:'player_child',actor:auth.account.id},now+5);
    await accounts.activate(player.token,password,now+6);
    const playerAuth=await accounts.login('player_child',password,now+7);
    await assert.rejects(accounts.setUnlimited(playerAuth.account.id,playerAuth.account.id,true,now+8),{status:403});
    await accounts.setUnlimited(auth.account.id,playerAuth.account.id,true,now+9);
    assert.equal((await accounts.session(playerAuth.token,now+10)).unlimited,true);
    assert.equal((await accounts.session(playerAuth.token,now+10)).role,'player');
    await accounts.setUnlimited(auth.account.id,playerAuth.account.id,false,now+11);
    assert.equal((await accounts.session(playerAuth.token,now+12)).unlimited,false);
    assert.equal((await db.query("SELECT * FROM labs_account_audit WHERE action='unlimited-granted'")).length,1);
    assert.equal((await accounts.session(playerAuth.token,now+12)).cloudSave,false);
    assert.equal((await accounts.session(auth.token,now+12)).cloudSave,false);
    await assert.rejects(accounts.setCloudSave(playerAuth.account.id,playerAuth.account.id,true),{status:403});
    await accounts.setCloudSave(auth.account.id,playerAuth.account.id,true);
    assert.equal((await accounts.session(playerAuth.token,now+12)).cloudSave,true);
    assert.equal((await accounts.session(playerAuth.token,now+12)).unlimited,false);
    await accounts.setUnlimited(auth.account.id,playerAuth.account.id,true);
    await accounts.setCloudSave(auth.account.id,playerAuth.account.id,false);
    assert.equal((await accounts.session(playerAuth.token,now+12)).cloudSave,false);
    assert.equal((await accounts.session(playerAuth.token,now+12)).unlimited,true);
    assert.equal((await db.query("SELECT * FROM labs_account_audit WHERE action='cloud-save-granted'")).length,1);
    await accounts.logout(playerAuth.token);assert.equal(await accounts.session(playerAuth.token,now+13),null);
    const second=await accounts.login('alexandre',password,now+14);
    await accounts.changePassword(auth.account.id,password,'Another safe test password with length',now+15);
    assert.equal(await accounts.session(auth.token,now+16),null);assert.equal(await accounts.session(second.token,now+16),null);
    assert.equal(await accounts.session('forged'),null);
    const expired=await accounts.invite({name:'expired_user',actor:auth.account.id},now);
    await assert.rejects(accounts.activate(expired.token,password,now+25*3600000));
    for(let i=0;i<10;i++)await assert.rejects(accounts.login('unknown_user','invalid',now));
    await assert.rejects(accounts.login('unknown_user','invalid',now),{status:429});
  }finally{await db.close();await unlink(path);}
});
test('authentication cookies are HttpOnly and cross-origin mutations are rejected',async()=>{
  assert.match(sessionCookie('token'),/HttpOnly; SameSite=Strict/);assert.match(sessionCookie(),/Max-Age=0/);
  process.env.LABS_ORIGIN='http://localhost:5194';
  await assert.rejects(readBody(new Request('http://localhost:5194/api/account/login',{method:'POST',headers:{Origin:'https://attacker.example','Content-Type':'application/json'},body:'{}'})),{status:403});
});

test('admin can renew a pending invite; old link dies, activated accounts cannot be re-invited', async () => {
  const { openDatabase, SCHEMA } = await import('../lib/server/usage-store.mjs');
  const { mkdtemp, rm } = await import('node:fs/promises'); const { tmpdir } = await import('node:os'); const { join } = await import('node:path');
  const dir = await mkdtemp(join(tmpdir(), 'labs-reinvite-'));
  const db = await openDatabase({ LABS_USAGE_SQLITE_PATH: join(dir, 't.sqlite') });
  try {
    for (const sql of [...SCHEMA, ...AUTH_SCHEMA]) await db.query(sql);
    const accounts = createAccounts(db);
    const admin = await accounts.invite({ name: 'boss', initialAdmin: true }); await accounts.activate(admin.token, 'Senha do administrador 2026');
    const first = await accounts.invite({ name: 'arthur', actor: admin.account.id });
    const renewed = await accounts.reinvite(admin.account.id, first.account.id);
    assert.notEqual(renewed.token, first.token);
    await assert.rejects(accounts.activate(first.token, 'Senha do arthur bem longa'), /inválido/);
    await accounts.activate(renewed.token, 'Senha do arthur bem longa');
    await assert.rejects(accounts.reinvite(admin.account.id, first.account.id), /já foi ativada/);
    await assert.rejects(accounts.reinvite(first.account.id, admin.account.id), /administrativo/);
    const actions = (await db.query('SELECT action FROM labs_account_audit ORDER BY created_at')).map(r => r.action);
    assert.ok(actions.includes('invite-renewed'));
  } finally { await db.close(); await rm(dir, { recursive: true, force: true }); }
});

test('admin grants and revokes a cosmetic pack; players cannot; entitlements union manual grants and paid orders', async () => {
  const { openDatabase, SCHEMA } = await import('../lib/server/usage-store.mjs');
  const { PAYMENT_SCHEMA } = await import('../lib/server/payments.mjs');
  const { mkdtemp, rm } = await import('node:fs/promises'); const { tmpdir } = await import('node:os'); const { join } = await import('node:path');
  const dir = await mkdtemp(join(tmpdir(), 'labs-packs-'));
  const db = await openDatabase({ LABS_USAGE_SQLITE_PATH: join(dir, 't.sqlite') });
  try {
    for (const sql of [...SCHEMA, ...AUTH_SCHEMA, ...PAYMENT_SCHEMA]) await db.query(sql);
    const accounts = createAccounts(db);
    const admin = await accounts.invite({ name: 'boss', initialAdmin: true }); await accounts.activate(admin.token, 'Senha do administrador 2026');
    const kid = await accounts.invite({ name: 'arthur', actor: admin.account.id }); await accounts.activate(kid.token, 'Senha do arthur bem longa');
    assert.deepEqual(await accounts.entitlements(kid.account.id), { outfits: [] });
    await assert.rejects(accounts.setPack(kid.account.id, kid.account.id, 'expedicao', true), /administrativo/);
    await assert.rejects(accounts.setPack(admin.account.id, kid.account.id, 'inexistente', true), /inválido/);
    await accounts.setPack(admin.account.id, kid.account.id, 'expedicao', true);
    await accounts.setPack(admin.account.id, kid.account.id, 'expedicao', true); // idempotent
    assert.deepEqual(await accounts.entitlements(kid.account.id), { outfits: ['expedicao'] });
    assert.deepEqual((await accounts.list(admin.account.id)).find(r => r.username === 'arthur').packs, ['expedicao']);
    await accounts.setPack(admin.account.id, kid.account.id, 'expedicao', false);
    assert.deepEqual(await accounts.entitlements(kid.account.id), { outfits: [] });
    await db.query("INSERT INTO labs_orders (id,account_id,product,amount_cents,currency,status,provider,created_at,updated_at) VALUES ('o-1',?,'vale-aparencias-expedicao',990,'BRL','approved','mercadopago',1,1)", [kid.account.id]);
    assert.deepEqual(await accounts.entitlements(kid.account.id), { outfits: ['expedicao'] }, 'paid order counts too');
    const actions = (await db.query('SELECT action FROM labs_account_audit ORDER BY created_at')).map(r => r.action);
    assert.ok(actions.includes('pack-granted') && actions.includes('pack-revoked'));
  } finally { await db.close(); await rm(dir, { recursive: true, force: true }); }
});
