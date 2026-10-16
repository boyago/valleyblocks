import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase, SCHEMA } from '../lib/server/usage-store.mjs';
import { AUTH_SCHEMA, createAccounts } from '../lib/server/accounts.mjs';
import { PAYMENT_SCHEMA, createPayments, verifyWebhookSignature, mercadoPagoClient, migratePayments } from '../lib/server/payments.mjs';
import { PRODUCTS } from '../lib/products.mjs';
import { SIGNUP_SCHEMA } from '../lib/server/signup.mjs';

async function setup() {
  const dir = await mkdtemp(join(tmpdir(), 'labs-pay-'));
  const db = await openDatabase({ LABS_USAGE_SQLITE_PATH: join(dir, 't.sqlite') });
  for (const sql of [...SCHEMA, ...AUTH_SCHEMA, ...SIGNUP_SCHEMA, ...PAYMENT_SCHEMA]) await db.query(sql);
  await migratePayments(db); await migratePayments(db); // idempotente
  const accounts = createAccounts(db);
  const admin = await accounts.invite({ name: 'boss', initialAdmin: true }); await accounts.activate(admin.token, 'Senha do administrador 2026');
  const invite = await accounts.invite({ name: 'comprador', actor: admin.account.id }); await accounts.activate(invite.token, 'Senha do comprador 2026');
  const login = await accounts.login('comprador', 'Senha do comprador 2026');
  const payments = new Map(), preferences = [];
  const mp = { createPreference: async body => { preferences.push(body); return { id: 'pref-' + preferences.length, init_point: 'https://mp.test/checkout/' + body.external_reference }; }, getPayment: async id => { const p = payments.get(String(id)); if (!p) { const e = new Error('nf'); e.code = 'MP_404'; throw e; } return p; } };
  const mails = [];
  const pay = createPayments(db, { mp, origin: 'https://labsgames.test', sendMail: async m => { mails.push(m); } });
  return { db, accounts, account: login.account, pay, mp, payments, preferences, mails, close: async () => { await db.close(); await rm(dir, { recursive: true, force: true }); } };
}

test('webhook signature: valid manifest accepted, tampering and stale timestamps rejected', () => {
  const secret = 'webhook-secret-for-tests-1234', ts = Date.now(), requestId = 'req-abc', dataId = '123456789';
  const v1 = createHmac('sha256', secret).update(`id:${dataId};request-id:${requestId};ts:${ts};`).digest('hex');
  assert.equal(verifyWebhookSignature({ signature: `ts=${ts},v1=${v1}`, requestId, dataId, secret }), true);
  assert.equal(verifyWebhookSignature({ signature: `ts=${ts},v1=${v1}`, requestId, dataId: '987', secret }), false);
  assert.equal(verifyWebhookSignature({ signature: `ts=${ts},v1=${v1}`, requestId: 'other', dataId, secret }), false);
  assert.equal(verifyWebhookSignature({ signature: `ts=${ts},v1=${v1}`, requestId, dataId, secret: 'another-secret-value-9999' }), false);
  assert.equal(verifyWebhookSignature({ signature: `ts=${ts},v1=${v1}`, requestId, dataId, secret }, ts + 20 * 60000), false, 'outside replay window');
  assert.equal(verifyWebhookSignature({ signature: 'garbage', requestId, dataId, secret }), false);
  assert.throws(() => verifyWebhookSignature({ signature: `ts=${ts},v1=${v1}`, requestId, dataId, secret: '' }));
});

test('checkout creates a pending order with the server-side price; approval grants, duplicates ignored, refund revokes', async () => {
  const t = await setup();
  try {
    await assert.rejects(t.pay.checkout(t.account, 'nao-existe'), /não encontrado/);
    await assert.rejects(t.pay.checkout(null, 'vale-completo'), /Entre na sua conta/);
    const { orderId, url } = await t.pay.checkout(t.account, 'vale-completo');
    assert.match(url, /^https:\/\/mp\.test\/checkout\//);
    const pref = t.preferences[0];
    assert.equal(pref.external_reference, orderId); assert.equal(pref.items[0].unit_price, 29.9); assert.equal(pref.notification_url, 'https://labsgames.test/api/payments/webhook');
    const [order] = await t.db.query('SELECT * FROM labs_orders WHERE id=?', [orderId]);
    assert.equal(order.status, 'pending'); assert.equal(order.amount_cents, PRODUCTS['vale-completo'].priceCents); assert.equal(order.preference_id, 'pref-1');
    // Tampered amount from the provider: never grants.
    t.payments.set('p1', { id: 'p1', status: 'approved', status_detail: 'accredited', transaction_amount: 1, currency_id: 'BRL', external_reference: orderId });
    assert.equal((await t.pay.reconcilePayment('p1', { eventId: 'evt-1' })).ignored, 'amount-mismatch');
    assert.equal((await t.accounts.session((await t.accounts.login('comprador', 'Senha do comprador 2026')).token)).unlimited, false);
    // Real approval
    t.payments.set('p2', { id: 'p2', status: 'approved', status_detail: 'accredited', transaction_amount: 29.9, currency_id: 'BRL', external_reference: orderId });
    const result = await t.pay.reconcilePayment('p2', { eventId: 'evt-2' });
    assert.deepEqual(result, { orderId, status: 'approved', previous: 'pending' });
    const session = await t.accounts.session((await t.accounts.login('comprador', 'Senha do comprador 2026')).token);
    assert.equal(session.unlimited, true); assert.equal(session.cloudSave, true);
    assert.deepEqual(await t.pay.reconcilePayment('p2', { eventId: 'evt-2' }), { duplicate: true });
    const again = await t.pay.reconcilePayment('p2', { eventId: 'evt-3' });
    assert.equal(again.previous, 'approved');
    assert.equal((await t.db.query("SELECT COUNT(*) AS n FROM labs_account_audit WHERE action='cloud-save-granted'"))[0].n, 1, 'grant applied once');
    await assert.rejects(t.pay.checkout(session, 'vale-completo'), /já tem este benefício/);
    // Refund revokes the grants
    t.payments.set('p2', { id: 'p2', status: 'refunded', transaction_amount: 29.9, currency_id: 'BRL', external_reference: orderId });
    await t.pay.reconcilePayment('p2', { eventId: 'evt-4' });
    const after = await t.accounts.session((await t.accounts.login('comprador', 'Senha do comprador 2026')).token);
    assert.equal(after.unlimited, false); assert.equal(after.cloudSave, false);
    // Unknown order / foreign payment is ignored
    t.payments.set('p9', { id: 'p9', status: 'approved', transaction_amount: 29.9, currency_id: 'BRL', external_reference: '11111111-1111-4111-8111-111111111111' });
    assert.equal((await t.pay.reconcilePayment('p9')).ignored, 'unknown-order');
    const mine = await t.pay.listForAccount(t.account.id);
    assert.equal(mine.length, 1); assert.equal(mine[0].status, 'refunded');
    const report = await t.pay.adminReport();
    assert.equal(report.total.orders, 1); assert.equal(report.orders[0].username, 'comprador');
    assert.equal(report.month.refunded, 1);
  } finally { await t.close(); }
});

test('provider failure cancels the order; repeated checkouts do not pile up', async () => {
  const t = await setup();
  try {
    for (let i = 0; i < 4; i++) await t.pay.checkout(t.account, 'vale-nuvem');
    assert.equal((await t.db.query("SELECT COUNT(*) AS n FROM labs_orders WHERE status='pending'"))[0].n, 1, 'repeated checkouts of one product never pile up');
    t.mp.createPreference = async () => { throw new Error('down'); };
    const other = await t.accounts.invite({ name: 'outro', actor: (await t.db.query("SELECT id FROM labs_accounts WHERE role='admin'"))[0].id }); await t.accounts.activate(other.token, 'Senha do outro bem longa');
    const acc = (await t.accounts.login('outro', 'Senha do outro bem longa')).account;
    await assert.rejects(t.pay.checkout(acc, 'vale-nuvem'), /down/);
    const [row] = await t.db.query('SELECT status,provider_status FROM labs_orders WHERE account_id=?', [acc.id]);
    assert.equal(row.status, 'cancelled'); assert.equal(row.provider_status, 'preference-failed');
  } finally { await t.close(); }
});

test('http client never leaks the token and maps provider errors to codes', async () => {
  const calls = [];
  const client = mercadoPagoClient({ accessToken: 'TEST-token', fetchImpl: async (url, init) => { calls.push({ url, init }); return { ok: false, status: 401, json: async () => ({ message: 'invalid token TEST-token' }) }; } });
  await assert.rejects(client.getPayment('1'), e => e.code === 'MP_401' && !e.message.includes('TEST-token'));
  assert.equal(calls[0].url, 'https://api.mercadopago.com/v1/payments/1');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer TEST-token');
});

test('outfit pack entitlement comes only from approved orders', async () => {
  const t = await setup();
  try {
    assert.deepEqual(await t.pay.entitlements(t.account.id), { outfits: [] });
    const { orderId } = await t.pay.checkout(t.account, 'vale-aparencias-expedicao');
    assert.deepEqual(await t.pay.entitlements(t.account.id), { outfits: [] }, 'pending order grants nothing');
    t.payments.set('o1', { id: 'o1', status: 'approved', transaction_amount: 9.9, currency_id: 'BRL', external_reference: orderId });
    await t.pay.reconcilePayment('o1', { eventId: 'evt-o1' });
    assert.deepEqual(await t.pay.entitlements(t.account.id), { outfits: ['expedicao'] });
    const session = await t.accounts.session((await t.accounts.login('comprador', 'Senha do comprador 2026')).token);
    assert.equal(session.unlimited, false, 'cosmetic pack never grants time');
    t.payments.set('o1', { id: 'o1', status: 'refunded', transaction_amount: 9.9, currency_id: 'BRL', external_reference: orderId });
    await t.pay.reconcilePayment('o1', { eventId: 'evt-o2' });
    assert.deepEqual(await t.pay.entitlements(t.account.id), { outfits: [] }, 'refund removes the pack');
  } finally { await t.close(); }
});

test('coupons: admin only, server-side discount, 100% approves without the provider, limits enforced', async () => {
  const t = await setup();
  try {
    const adminId = (await t.db.query("SELECT id FROM labs_accounts WHERE role='admin'"))[0].id;
    await assert.rejects(t.pay.createCoupon(t.account.id, { code: 'HACK', percentOff: 100 }), /administrativo/);
    await assert.rejects(t.pay.createCoupon(adminId, { code: 'x', percentOff: 100 }), /Código/);
    await assert.rejects(t.pay.createCoupon(adminId, { code: 'MUITO', percentOff: 101 }), /entre 1 e 100/);
    await assert.rejects(t.pay.createCoupon(adminId, { code: 'VENCIDO', percentOff: 10, expiresAt: '2000-01-01' }), /futura/);
    const half = await t.pay.createCoupon(adminId, { code: 'metade', percentOff: 50, product: 'vale-completo', maxUses: 5 });
    assert.equal(half.code, 'METADE'); assert.equal(half.uses, 0);
    await assert.rejects(t.pay.createCoupon(adminId, { code: 'METADE', percentOff: 50 }), /Já existe/);
    // wrong product / unknown code never create an order
    await assert.rejects(t.pay.checkout(t.account, 'vale-nuvem', 'METADE'), /Cupom inválido/);
    await assert.rejects(t.pay.checkout(t.account, 'vale-completo', 'NAO-EXISTE'), /Cupom inválido/);
    assert.equal((await t.db.query('SELECT COUNT(*) AS n FROM labs_orders'))[0].n, 0);
    // 50%: order carries the discounted amount and the provider gets the discounted price; reconcile checks that amount
    const { orderId, free } = await t.pay.checkout(t.account, 'vale-completo', 'metade');
    assert.equal(free, false); assert.equal(t.preferences.at(-1).items[0].unit_price, 14.95);
    const [order] = await t.db.query('SELECT * FROM labs_orders WHERE id=?', [orderId]);
    assert.equal(order.amount_cents, 1495); assert.equal((await t.pay.listCoupons())[0].uses, 1);
    t.payments.set('c1', { id: 'c1', status: 'approved', transaction_amount: 29.9, currency_id: 'BRL', external_reference: orderId });
    assert.equal((await t.pay.reconcilePayment('c1', { eventId: 'evt-c1' })).ignored, 'amount-mismatch', 'full price paid for a discounted order is not what we asked');
    t.payments.set('c2', { id: 'c2', status: 'approved', transaction_amount: 14.95, currency_id: 'BRL', external_reference: orderId });
    assert.equal((await t.pay.reconcilePayment('c2', { eventId: 'evt-c2' })).status, 'approved');
    assert.equal((await t.pay.listForAccount(t.account.id))[0].coupon, 'METADE');
    // 100%: approved immediately, grants applied, no provider call
    const other = await t.accounts.invite({ name: 'filho', actor: adminId }); await t.accounts.activate(other.token, 'Senha do filho bem longa');
    const kid = (await t.accounts.login('filho', 'Senha do filho bem longa')).account;
    await t.pay.createCoupon(adminId, { code: 'FAMILIA', percentOff: 100, maxUses: 1, note: 'teste' });
    const calls = t.preferences.length;
    const result = await t.pay.checkout(kid, 'vale-aparencias-expedicao', 'familia');
    assert.equal(result.free, true); assert.match(result.url, /\/conta\?pedido=/); assert.equal(t.preferences.length, calls, 'no provider call');
    assert.deepEqual(await t.pay.entitlements(kid.id), { outfits: ['expedicao'] });
    const [freeOrder] = await t.db.query('SELECT * FROM labs_orders WHERE id=?', [result.orderId]);
    assert.equal(freeOrder.status, 'approved'); assert.equal(freeOrder.provider, 'coupon'); assert.equal(freeOrder.amount_cents, 0);
    // a webhook for a coupon order is ignored
    t.payments.set('c3', { id: 'c3', status: 'refunded', transaction_amount: 0, currency_id: 'BRL', external_reference: result.orderId });
    assert.equal((await t.pay.reconcilePayment('c3', { eventId: 'evt-c3' })).ignored, 'not-provider-order');
    // exhausted and disabled
    await assert.rejects(t.pay.checkout(kid, 'vale-nuvem', 'FAMILIA'), /Cupom inválido/);
    await t.pay.setCouponDisabled(adminId, 'metade', true);
    await assert.rejects(t.pay.checkout(kid, 'vale-completo', 'METADE'), /Cupom inválido/);
    await assert.rejects(t.pay.setCouponDisabled(kid.id, 'metade', false), /administrativo/);
    // provider failure releases the coupon use
    await t.pay.setCouponDisabled(adminId, 'metade', false);
    t.mp.createPreference = async () => { throw new Error('down'); };
    await assert.rejects(t.pay.checkout(kid, 'vale-completo', 'METADE'), /down/);
    assert.equal((await t.pay.listCoupons()).find(c => c.code === 'METADE').uses, 1);
    // already owned (manual grant) refuses even with a coupon
    await t.accounts.setPack(adminId, kid.id, 'expedicao', true);
    await assert.rejects(t.pay.checkout(kid, 'vale-aparencias-expedicao'), /já tem este benefício/);
    assert.equal((await t.db.query("SELECT COUNT(*) AS n FROM labs_account_audit WHERE action='coupon-redeemed'"))[0].n, 1);
  } finally { await t.close(); }
});

test('a new checkout for the same product supersedes the abandoned pending ones instead of hitting the pending limit', async () => {
  const t = await setup();
  try {
    const first = await t.pay.checkout(t.account, 'vale-completo');
    await t.pay.checkout(t.account, 'vale-completo'); await t.pay.checkout(t.account, 'vale-completo');
    const adminId = (await t.db.query("SELECT id FROM labs_accounts WHERE role='admin'"))[0].id;
    await t.pay.createCoupon(adminId, { code: 'GRATIS', percentOff: 100, maxUses: 1 });
    const result = await t.pay.checkout(t.account, 'vale-completo', 'GRATIS');
    assert.equal(result.free, true);
    const rows = await t.db.query("SELECT status, provider_status FROM labs_orders WHERE account_id=? ORDER BY created_at", [t.account.id]);
    assert.deepEqual(rows.map(r => r.status), ['cancelled', 'cancelled', 'cancelled', 'approved']);
    assert.equal(rows[0].provider_status, 'superseded');
    // paying a superseded preference later still counts
    t.payments.set('s1', { id: 's1', status: 'approved', transaction_amount: 29.9, currency_id: 'BRL', external_reference: first.orderId });
    assert.equal((await t.pay.reconcilePayment('s1', { eventId: 'evt-s1' })).status, 'approved');
    // other products still respect the limit
    for (let i = 0; i < 3; i++) await t.pay.checkout(t.account, 'vale-aparencias-expedicao');
    assert.equal((await t.db.query("SELECT COUNT(*) AS n FROM labs_orders WHERE status='pending'"))[0].n, 1, 'same product keeps a single pending order');
  } finally { await t.close(); }
});

test('guest checkout: e-mail creates the account, payment sends the set-password link, existing e-mails reuse their account', async () => {
  const t = await setup();
  try {
    await assert.rejects(t.pay.guestCheckout({ email: 'nao-e-email', product: 'vale-completo' }), /e-mail válido/);
    await assert.rejects(t.pay.guestCheckout({ email: 'a@b.co', product: 'nao-existe' }), /não encontrado/);
    const first = await t.pay.guestCheckout({ email: 'Maria.Silva@Example.com', product: 'vale-completo', client: '1.2.3.4' });
    assert.equal(first.guest, true); assert.equal(first.claimable, true); assert.equal(first.username, undefined); assert.equal(first.created, undefined);
    assert.equal(first.free, false); assert.match(t.preferences.at(-1).back_urls.success, /\/comprar\/vale-completo\?pedido=/);
    assert.equal(t.mails.length, 0, 'nothing is sent before the payment');
    first.username = (await t.pay.orderStatus(first.orderId)).username; assert.match(first.username, /^mariasilva_\d+$/);
    const [acc] = await t.db.query('SELECT * FROM labs_accounts WHERE username=?', [first.username]);
    assert.equal(acc.password_hash, null);
    // payment approved: grants + e-mail with a 7-day activation link
    t.payments.set('g1', { id: 'g1', status: 'approved', transaction_amount: 29.9, currency_id: 'BRL', external_reference: first.orderId });
    assert.deepEqual(await t.pay.reconcilePayment('g1', { eventId: 'evt-g1' }), { orderId: first.orderId, status: 'approved', previous: 'pending' });
    assert.equal(t.mails.length, 1); assert.equal(t.mails[0].to, 'maria.silva@example.com');
    const token = t.mails[0].text.match(/#token=([a-f0-9]{64})/)[1];
    await t.accounts.activate(token, 'Senha escolhida pela Maria 2026');
    const session = await t.accounts.session((await t.accounts.login(first.username, 'Senha escolhida pela Maria 2026')).token);
    assert.equal(session.unlimited, true); assert.equal(session.cloudSave, true);
    // duplicate webhook: no second mail
    await t.pay.reconcilePayment('g1', { eventId: 'evt-g1b' }); assert.equal(t.mails.length, 1);
    // same e-mail again: the account now has a password, so the buyer must sign in
    await assert.rejects(t.pay.guestCheckout({ email: 'maria.silva@example.com', product: 'vale-aparencias-expedicao' }), e => e.status === 409 && /já tem conta/.test(e.message));
    const again = await t.pay.checkout(session, 'vale-aparencias-expedicao');
    t.payments.set('g2', { id: 'g2', status: 'approved', transaction_amount: 9.9, currency_id: 'BRL', external_reference: again.orderId });
    await t.pay.reconcilePayment('g2', { eventId: 'evt-g2' });
    assert.equal(t.mails.length, 2); assert.match(t.mails[1].subject, /confirmada/); assert.doesNotMatch(t.mails[1].text, /#token=/);
    // 100% coupon as a guest: approved at once and the link goes out immediately
    const adminId = (await t.db.query("SELECT id FROM labs_accounts WHERE role='admin'"))[0].id;
    await t.pay.createCoupon(adminId, { code: 'PRESENTE', percentOff: 100, maxUses: 1 });
    const gift = await t.pay.guestCheckout({ email: 'joao@example.com', product: 'vale-aparencias-expedicao', coupon: 'presente' });
    assert.equal(gift.free, true); assert.equal(t.mails.length, 3); assert.match(t.mails[2].text, /#token=/);
    // e-mail rate limit: 5 attempts per address per window
    for (let i = 0; i < 5; i++) await t.pay.guestCheckout({ email: 'spam@example.com', product: 'vale-nuvem' }).catch(() => {});
    await assert.rejects(t.pay.guestCheckout({ email: 'spam@example.com', product: 'vale-nuvem' }), /Muitas tentativas/);
  } finally { await t.close(); }
});

test('claim: the paying browser sets the first password after approval and gets a session; activation also returns a session', async () => {
  const t = await setup();
  try {
    const { claimValue, readClaim } = await import('../lib/server/payments.mjs');
    const secret = 'x'.repeat(40);
    const order = await t.pay.guestCheckout({ email: 'claim@example.com', product: 'vale-completo' });
    const cookie = claimValue(order.orderId, secret);
    assert.equal(readClaim(cookie, secret), order.orderId);
    assert.equal(readClaim(cookie.replace(/.$/, c => c === 'a' ? 'b' : 'a'), secret), null, 'tampered claim rejected');
    assert.equal(readClaim(cookie, 'y'.repeat(40)), null);
    assert.equal((await t.pay.orderStatus(order.orderId)).needsPassword, true);
    await assert.rejects(t.pay.claimOrder(order.orderId, 'Senha do comprador nova 1'), /ainda não foi confirmado/);
    t.payments.set('c9', { id: 'c9', status: 'approved', transaction_amount: 29.9, currency_id: 'BRL', external_reference: order.orderId });
    await t.pay.reconcilePayment('c9', { eventId: 'evt-c9' });
    const { token } = await t.pay.claimOrder(order.orderId, 'Senha do comprador nova 1');
    const session = await t.accounts.session(token);
    assert.equal(session.username, (await t.pay.orderStatus(order.orderId)).username); assert.equal(session.unlimited, true);
    await assert.rejects(t.pay.claimOrder(order.orderId, 'Outra senha qualquer 22'), /já tem senha/);
    const mailed = t.mails.find(m => m.to === 'claim@example.com').text.match(/#token=([a-f0-9]{64})/)[1];
    await assert.rejects(t.accounts.activate(mailed, 'Outra senha qualquer 22'), /inválido/, 'e-mailed link stops working after the claim');
    const adminId = (await t.db.query("SELECT id FROM labs_accounts WHERE role='admin'"))[0].id;
    const inv = await t.accounts.invite({ name: 'ativa_sessao', actor: adminId });
    const activated = await t.accounts.activate(inv.token, 'Senha da ativacao 2026');
    assert.equal((await t.accounts.session(activated.token)).username, 'ativa_sessao');
  } finally { await t.close(); }
});

test('claim takeover: only the checkout that created the account can set its password; existing accounts use the e-mail link', async () => {
  const t = await setup();
  try {
    const first = await t.pay.guestCheckout({ email: 'vitima@example.com', product: 'vale-nuvem' });
    assert.equal(first.claimable, true);
    // attacker re-uses the victim's e-mail while the account still has no password
    const attack = await t.pay.guestCheckout({ email: 'vitima@example.com', product: 'vale-completo' });
    assert.equal(attack.claimable, false); assert.equal(attack.username, undefined);
    assert.equal((await t.pay.orderStatus(attack.orderId)).claimable, false);
    t.payments.set('a1', { id: 'a1', status: 'approved', transaction_amount: 29.9, currency_id: 'BRL', external_reference: attack.orderId });
    await t.pay.reconcilePayment('a1', { eventId: 'evt-a1' });
    await assert.rejects(t.pay.claimOrder(attack.orderId, 'Senha do invasor 123456'), e => e.status === 403);
    const [acc] = await t.db.query('SELECT a.id,a.password_hash FROM labs_accounts a JOIN labs_account_emails e ON e.account_id=a.id WHERE e.email=?', ['vitima@example.com']);
    assert.equal(acc.password_hash, null, 'password untouched');
    // account with a password: guest checkout refused (must sign in)
    await t.db.query("UPDATE labs_accounts SET password_hash='x' WHERE id=?", [acc.id]);
    await assert.rejects(t.pay.guestCheckout({ email: 'vitima@example.com', product: 'vale-aparencias-expedicao' }), e => e.status === 409 && /já tem conta/.test(e.message));
  } finally { await t.close(); }
});

test('coupon max uses: superseding keeps the use consumed; paying the old preference does not exceed max_uses', async () => {
  const t = await setup();
  try {
    const adminId = (await t.db.query("SELECT id FROM labs_accounts WHERE role='admin'"))[0].id;
    await t.pay.createCoupon(adminId, { code: 'UNICO', percentOff: 50, maxUses: 1 });
    const old = await t.pay.checkout(t.account, 'vale-completo', 'UNICO');
    await t.pay.checkout(t.account, 'vale-completo');
    assert.equal((await t.pay.listCoupons())[0].uses, 1, 'use stays consumed after supersede');
    await assert.rejects(t.pay.checkout(t.account, 'vale-nuvem', 'UNICO'), /esgotado/);
    t.payments.set('u1', { id: 'u1', status: 'approved', transaction_amount: 14.95, currency_id: 'BRL', external_reference: old.orderId });
    assert.equal((await t.pay.reconcilePayment('u1', { eventId: 'evt-u1' })).status, 'approved');
    assert.equal((await t.pay.listCoupons())[0].uses, 1);
    // a cancelled order that was not superseded (preference failed, coupon released) is never approved
    const [other] = await t.db.query("SELECT id FROM labs_orders WHERE id<>? AND product='vale-completo'", [old.orderId]);
    await t.db.query("UPDATE labs_orders SET status='cancelled',provider_status='preference-failed' WHERE id=?", [other.id]);
    t.payments.set('u2', { id: 'u2', status: 'approved', transaction_amount: 29.9, currency_id: 'BRL', external_reference: other.id });
    assert.equal((await t.pay.reconcilePayment('u2')).ignored, 'final-state');
  } finally { await t.close(); }
});

test('state machine: approved only changes by a refund of the same payment; refunded is final', async () => {
  const t = await setup();
  try {
    const { orderId } = await t.pay.checkout(t.account, 'vale-completo');
    const ok = { transaction_amount: 29.9, currency_id: 'BRL', external_reference: orderId };
    t.payments.set('m1', { id: 'm1', status: 'approved', ...ok });
    await t.pay.reconcilePayment('m1');
    for (const [id, status] of [['m2', 'rejected'], ['m2', 'pending'], ['m2', 'refunded'], ['m1', 'pending'], ['m1', 'rejected']]) {
      t.payments.set(id, { id, status, ...ok });
      assert.equal((await t.pay.reconcilePayment(id)).ignored, 'final-state', id + ' ' + status);
    }
    let [row] = await t.db.query('SELECT status,payment_id FROM labs_orders WHERE id=?', [orderId]);
    assert.equal(row.status, 'approved'); assert.equal(row.payment_id, 'm1');
    assert.equal((await t.accounts.session((await t.accounts.login('comprador', 'Senha do comprador 2026')).token)).unlimited, true);
    t.payments.set('m1', { id: 'm1', status: 'charged_back', ...ok });
    assert.equal((await t.pay.reconcilePayment('m1')).status, 'refunded');
    t.payments.set('m1', { id: 'm1', status: 'approved', ...ok });
    assert.equal((await t.pay.reconcilePayment('m1')).ignored, 'final-state');
    [row] = await t.db.query('SELECT status FROM labs_orders WHERE id=?', [orderId]);
    assert.equal(row.status, 'refunded');
  } finally { await t.close(); }
});

test('webhook event is recorded only after the provider answers, so a retry after a failure is processed', async () => {
  const t = await setup();
  try {
    const { orderId } = await t.pay.checkout(t.account, 'vale-completo');
    t.payments.set('w1', { id: 'w1', status: 'approved', transaction_amount: 29.9, currency_id: 'BRL', external_reference: orderId });
    const real = t.mp.getPayment;
    t.mp.getPayment = async () => { const e = new Error('down'); e.code = 'MP_500'; throw e; };
    await assert.rejects(t.pay.reconcilePayment('w1', { eventId: 'evt-w1' }), /down/);
    assert.equal((await t.db.query("SELECT COUNT(*) AS n FROM labs_payment_events WHERE id='evt-w1'"))[0].n, 0);
    t.mp.getPayment = real;
    assert.equal((await t.pay.reconcilePayment('w1', { eventId: 'evt-w1' })).status, 'approved');
    assert.deepEqual(await t.pay.reconcilePayment('w1', { eventId: 'evt-w1' }), { duplicate: true });
  } finally { await t.close(); }
});

test('refund keeps benefits still granted by another approved order or by an admin', async () => {
  const t = await setup();
  try {
    const login = async () => t.accounts.session((await t.accounts.login('comprador', 'Senha do comprador 2026')).token);
    const pay = async (product, id, amount) => { const o = await t.pay.checkout(await login(), product); t.payments.set(id, { id, status: 'approved', transaction_amount: amount, currency_id: 'BRL', external_reference: o.orderId }); await t.pay.reconcilePayment(id); };
    await pay('vale-nuvem', 'r1', 9.9); await pay('vale-completo', 'r2', 29.9);
    t.payments.set('r1', { ...t.payments.get('r1'), status: 'refunded' }); await t.pay.reconcilePayment('r1');
    assert.equal((await login()).cloudSave, true, 'vale-completo still grants cloud');
    const adminId = (await t.db.query("SELECT id FROM labs_accounts WHERE role='admin'"))[0].id;
    await t.accounts.setUnlimited(adminId, t.account.id, true, Date.now() + 1000);
    t.payments.set('r2', { ...t.payments.get('r2'), status: 'refunded' }); await t.pay.reconcilePayment('r2');
    const after = await login();
    assert.equal(after.unlimited, true, 'admin grant kept'); assert.equal(after.cloudSave, false);
  } finally { await t.close(); }
});
