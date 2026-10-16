import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../lib/server/usage-store.mjs';
import { AUTH_SCHEMA, createAccounts } from '../lib/server/accounts.mjs';
import { SIGNUP_SCHEMA } from '../lib/server/signup.mjs';
import { PAYMENT_SCHEMA, createPayments, migratePayments } from '../lib/server/payments.mjs';
import { PLAY_SCHEMA, createPlayStore } from '../lib/server/play-store.mjs';
import { WORLD_SCHEMA } from '../lib/server/world-store.mjs';
import { parseRange } from '../lib/server/admin-range.mjs';

const PASS = 'Senha de teste bem longa 2026';
async function setup() {
  const dir = await mkdtemp(join(tmpdir(), 'labs-admin-'));
  const db = await openDatabase({ LABS_USAGE_SQLITE_PATH: join(dir, 't.sqlite'), NODE_ENV: 'test' });
  for (const sql of [...AUTH_SCHEMA, ...SIGNUP_SCHEMA, ...PAYMENT_SCHEMA, ...PLAY_SCHEMA, ...WORLD_SCHEMA]) await db.query(sql);
  await migratePayments(db);
  const accounts = createAccounts(db);
  const boss = await accounts.invite({ name: 'boss', initialAdmin: true }); await accounts.activate(boss.token, PASS);
  const make = async name => { const i = await accounts.invite({ name, actor: boss.account.id }); await accounts.activate(i.token, PASS); return i.account.id; };
  const refunds = [], payments = new Map();
  const mp = { createPreference: async b => ({ id: 'pref', init_point: 'https://mp.test/' + b.external_reference }), getPayment: async id => payments.get(String(id)), refundPayment: async (id, key) => { refunds.push({ id, key }); const p = payments.get(String(id)); payments.set(String(id), { ...p, status: 'refunded' }); return { id: 1 }; } };
  const pay = createPayments(db, { mp, origin: 'https://labsgames.test' });
  return { db, accounts, pay, payments, refunds, admin: boss.account.id, make, close: async () => { await db.close(); await rm(dir, { recursive: true, force: true }); } };
}

test('per-game play history: time and players per game survive the 3-day quota cleanup', async () => {
  const t = await setup();
  try {
    const store = createPlayStore(t.db), now = Date.parse('2026-10-10T15:00:00Z'), s1 = randomUUID(), s2 = randomUUID();
    await store.record('user:a', { game: 'vale-dos-blocos', session: s1, active: true }, { account: true }, now);
    for (let i = 1; i <= 8; i++) await store.record('user:a', { game: 'vale-dos-blocos', session: s1, active: true }, { account: true }, now + i * 15000);
    await store.record('guest:b', { game: 'canyon-strike', session: s2, active: true }, {}, now);
    await store.record('guest:b', { game: 'canyon-strike', session: s2, active: true }, {}, now + 15000);
    const rows = await t.db.query('SELECT game, COUNT(DISTINCT owner_id) AS players, SUM(used_ms) AS ms, SUM(starts) AS starts FROM labs_play_stats GROUP BY game ORDER BY game');
    assert.deepEqual(rows.map(r => [r.game, Number(r.players), Number(r.ms), Number(r.starts)]), [['canyon-strike', 1, 15000, 1], ['vale-dos-blocos', 1, 120000, 1]]);
    await store.cleanup(now + 10 * 86400000);
    assert.equal((await t.db.query('SELECT COUNT(*) AS n FROM labs_play_daily'))[0].n, 0, 'quota rows still expire');
    assert.equal((await t.db.query('SELECT COUNT(*) AS n FROM labs_play_stats'))[0].n, 2, 'history kept');
    assert.equal((await t.db.query("SELECT COUNT(*) AS n FROM labs_play_stats WHERE owner_id LIKE 'ipguest:%'"))[0].n, 0, 'IP-derived owner never stored in history');
  } finally { await t.close(); }
});

test('date range filter only accepts real day keys inside 400 days', () => {
  const now = Date.parse('2026-10-12T15:00:00Z'), p = o => new URLSearchParams(o);
  assert.deepEqual(parseRange(p({}), now), { from: '2026-10-06', to: '2026-10-12' });
  assert.deepEqual(parseRange(p({ from: '2026-10-12', to: '2026-10-12' }), now), { from: '2026-10-12', to: '2026-10-12' });
  for (const bad of [{ from: "2026-10-01' OR 1=1 --", to: '2026-10-02' }, { from: '2026-10-05', to: '2026-10-01' }, { from: '2025-01-01', to: '2026-10-01' }, { from: '2026-13-40', to: '2026-13-41' }, { from: '1', to: '2' }])
    assert.throws(() => parseRange(p(bad), now), /Período|400/);
});

test('ban, edit and delete: admin only, never on admins or yourself, sessions die on ban', async () => {
  const t = await setup();
  try {
    const kid = await t.make('kid_one'), other = await t.make('other_one');
    const login = await t.accounts.login('kid_one', PASS);
    // A player cannot use the admin actions.
    await assert.rejects(t.accounts.setDisabled(other, kid, true), { status: 403 });
    await assert.rejects(t.accounts.remove(other, kid), { status: 403 });
    await assert.rejects(t.accounts.updateProfile(other, kid, { username: 'x_hacked', minor: false }), { status: 403 });
    // Not yourself, not an admin.
    await assert.rejects(t.accounts.setDisabled(t.admin, t.admin, true), { status: 409 });
    await assert.rejects(t.accounts.remove(t.admin, t.admin), { status: 409 });
    // Ban: open session ends immediately and login is refused; unban restores login.
    assert.ok(await t.accounts.session(login.token));
    await t.accounts.setDisabled(t.admin, kid, true);
    assert.equal(await t.accounts.session(login.token), null);
    await assert.rejects(t.accounts.login('kid_one', PASS), { status: 401 });
    await t.accounts.setDisabled(t.admin, kid, false);
    assert.ok((await t.accounts.login('kid_one', PASS)).token);
    // Edit: validates input and uniqueness; e-mail change drops old recovery links.
    await assert.rejects(t.accounts.updateProfile(t.admin, kid, { username: 'other_one', minor: false }), /já existe/);
    await assert.rejects(t.accounts.updateProfile(t.admin, kid, { username: "kid'; DROP TABLE x", minor: false }), /letras/);
    await assert.rejects(t.accounts.updateProfile(t.admin, kid, { username: 'kid_one', email: 'nope', minor: false }), /e-mail/);
    await assert.rejects(t.accounts.updateProfile(t.admin, kid, { username: 'kid_one', minor: true }), /responsável/);
    await t.db.query("INSERT INTO labs_email_tokens (token_hash,account_id,purpose,expires_at) VALUES ('h',?,'reset',?)", [kid, Date.now() + 3600000]);
    await t.accounts.updateProfile(t.admin, kid, { username: 'Kid_Renamed', email: 'Kid@Example.com', guardianEmail: 'mae@example.com', minor: true });
    const row = (await t.accounts.list(t.admin)).find(a => a.id === kid);
    assert.equal(row.username, 'kid_renamed'); assert.equal(row.email, 'kid@example.com'); assert.equal(row.minor, true);
    assert.equal((await t.db.query('SELECT COUNT(*) AS n FROM labs_email_tokens WHERE account_id=?', [kid]))[0].n, 0);
    await t.accounts.updateProfile(t.admin, other, { username: 'other_one', minor: false }).catch(() => {});
    await assert.rejects(t.accounts.updateProfile(t.admin, other, { username: 'other_one', email: 'kid@example.com', minor: false }), /outra conta/);
    // Delete: everything keyed to the player goes, the audit stays.
    await t.db.query("INSERT INTO labs_worlds (owner_id,revision,saved_at) VALUES (?,0,0)", ['user:' + kid]);
    await t.db.query("INSERT INTO labs_play_stats (day_key,game,owner_id,used_ms,starts) VALUES ('2026-10-10','vale-dos-blocos',?,1,1)", ['user:' + kid]);
    await t.accounts.remove(t.admin, kid);
    for (const [table, col, val] of [['labs_accounts', 'id', kid], ['labs_account_emails', 'account_id', kid], ['labs_auth_sessions', 'account_id', kid], ['labs_worlds', 'owner_id', 'user:' + kid], ['labs_play_stats', 'owner_id', 'user:' + kid]])
      assert.equal((await t.db.query(`SELECT COUNT(*) AS n FROM ${table} WHERE ${col}=?`, [val]))[0].n, 0, table);
    assert.equal((await t.db.query("SELECT COUNT(*) AS n FROM labs_account_audit WHERE action='account-deleted' AND account_id=?", [kid]))[0].n, 1);
    await assert.rejects(t.accounts.remove(t.admin, kid), { status: 404 });
  } finally { await t.close(); }
});

test('refund and delete orders: paid orders are refunded at the provider before they can be deleted', async () => {
  const t = await setup();
  try {
    const buyer = await t.make('buyer_one'), account = (await t.accounts.list(t.admin)).find(a => a.id === buyer);
    const { orderId } = await t.pay.checkout(account, 'vale-completo');
    await assert.rejects(t.pay.refundOrder(t.admin, orderId), /Só pedidos pagos/);
    t.payments.set('p9', { id: 'p9', status: 'approved', status_detail: 'accredited', transaction_amount: 29.9, currency_id: 'BRL', external_reference: orderId });
    await t.pay.reconcilePayment('p9', { eventId: 'e9' });
    assert.equal((await t.accounts.session((await t.accounts.login('buyer_one', PASS)).token)).unlimited, true);
    await assert.rejects(t.pay.deleteOrder(t.admin, orderId), /devolução antes/);
    await assert.rejects(t.pay.refundOrder(buyer, orderId), { status: 403 });
    await assert.rejects(t.pay.refundOrder(t.admin, 'not-a-uuid'), /inválido/);
    assert.equal((await t.pay.refundOrder(t.admin, orderId)).status, 'refunded');
    assert.deepEqual(t.refunds, [{ id: 'p9', key: 'refund-' + orderId }]);
    assert.equal((await t.accounts.session((await t.accounts.login('buyer_one', PASS)).token)).unlimited, false, 'benefits revoked');
    await assert.rejects(t.pay.refundOrder(t.admin, orderId), /Só pedidos pagos/, 'no double refund');
    await assert.rejects(t.pay.deleteOrder(buyer, orderId), { status: 403 });
    await t.pay.deleteOrder(t.admin, orderId);
    assert.equal((await t.db.query('SELECT COUNT(*) AS n FROM labs_orders WHERE id=?', [orderId]))[0].n, 0);
    // Pagination: 10 per page.
    const report = await t.pay.adminReport(undefined, { page: 2 });
    assert.equal(report.page, 2); assert.equal(report.orders.length, 0);
  } finally { await t.close(); }
});
