import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { AccountError, createAccounts, tokenHash } from './accounts.mjs';
import { email as parseEmail } from './signup.mjs';
import { secureEqual } from './usage-http.mjs';
import { PRODUCTS, CURRENCY } from '../products.mjs';

// Pagamentos via Mercado Pago (Checkout Pro: Pix, cartão, saldo). O benefício só é
// concedido depois que o servidor consulta o pagamento na API do provedor; nem o
// webhook, nem a tela de retorno, nem o navegador concedem nada sozinhos.
// Cupons: criados só por administradores; o desconto é calculado no servidor e um
// cupom de 100% libera o pedido sem passar pelo provedor (provider 'coupon').
export const PAYMENT_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS labs_orders (
    id VARCHAR(36) PRIMARY KEY, account_id VARCHAR(36) NOT NULL, product VARCHAR(40) NOT NULL,
    amount_cents INTEGER NOT NULL, currency VARCHAR(3) NOT NULL, status VARCHAR(16) NOT NULL,
    provider VARCHAR(16) NOT NULL, preference_id VARCHAR(80), payment_id VARCHAR(40),
    provider_status VARCHAR(40), created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS labs_payment_events (
    id VARCHAR(120) PRIMARY KEY, order_id VARCHAR(36), payment_id VARCHAR(40), status VARCHAR(40), received_at BIGINT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS labs_coupons (
    code VARCHAR(32) PRIMARY KEY, percent_off INTEGER NOT NULL, product VARCHAR(40), max_uses INTEGER NOT NULL,
    uses INTEGER NOT NULL DEFAULT 0, expires_at BIGINT, disabled INTEGER NOT NULL DEFAULT 0, note VARCHAR(80),
    created_by VARCHAR(36) NOT NULL, created_at BIGINT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS labs_coupon_uses (
    order_id VARCHAR(36) PRIMARY KEY, code VARCHAR(32) NOT NULL, account_id VARCHAR(36) NOT NULL, discount_cents INTEGER NOT NULL, created_at BIGINT NOT NULL
  )`,
];
// Colunas novas em tabelas que já existem em produção: ALTER idempotente (ignora coluna duplicada).
export const PAYMENT_MIGRATIONS = ['ALTER TABLE labs_orders ADD COLUMN claimable INTEGER NOT NULL DEFAULT 0'];
export async function migratePayments(db) {
  for (const sql of PAYMENT_MIGRATIONS) { try { await db.query(sql); } catch (error) { if (!/duplicate column/i.test(String(error?.message || '')) && error?.code !== 'ER_DUP_FIELDNAME') throw error; } }
}
export const SYSTEM_ACTOR = 'system:payment';
export const COUPON_CODE = /^[A-Z0-9][A-Z0-9-]{2,31}$/;
const STATUS = { approved: 'approved', pending: 'pending', in_process: 'pending', authorized: 'pending', rejected: 'rejected', cancelled: 'cancelled', refunded: 'refunded', charged_back: 'refunded' };
/** Browser-bound proof that this browser started a guest order: "<orderId>.<hmac>". */
export function claimValue(orderId, secret) { if (typeof secret !== 'string' || secret.length < 32) throw new Error('Usage secret is not configured'); return `${orderId}.${createHmac('sha256', secret).update('claim:' + orderId).digest('hex')}`; }
export function readClaim(value, secret) {
  const [orderId, mac] = String(value || '').split('.');
  if (!/^[0-9a-f-]{36}$/.test(orderId || '') || !/^[a-f0-9]{64}$/.test(mac || '')) return null;
  return secureEqual(claimValue(orderId, secret).split('.')[1], mac) ? orderId : null;
}
export const normalizeCoupon = code => String(code || '').trim().toUpperCase();

/** Mercado Pago: manifest `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` signed with HMAC-SHA256 (hex). */
export function verifyWebhookSignature({ signature, requestId, dataId, secret }, now = Date.now()) {
  if (!secret || secret.length < 16) throw new Error('Webhook secret missing');
  const parts = Object.fromEntries(String(signature || '').split(',').map(p => p.trim().split('=')).filter(p => p.length === 2));
  if (!/^\d{10,16}$/.test(parts.ts || '') || !/^[a-f0-9]{64}$/.test(parts.v1 || '')) return false;
  const ts = Number(parts.ts), tsMs = ts < 1e12 ? ts * 1000 : ts;
  if (Math.abs(now - tsMs) > 15 * 60000) return false; // replay window
  const id = String(dataId || ''); const manifest = `id:${/^[0-9]+$/.test(id) ? id : id.toLowerCase()};request-id:${requestId || ''};ts:${parts.ts};`;
  return secureEqual(createHmac('sha256', secret).update(manifest).digest('hex'), parts.v1);
}

/** Minimal Mercado Pago client. Injected in tests. */
export function mercadoPagoClient({ accessToken, fetchImpl = fetch }) {
  if (!accessToken) throw new Error('Mercado Pago access token missing');
  const call = async (path, init = {}) => {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetchImpl('https://api.mercadopago.com' + path, { ...init, signal: controller.signal, headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', ...(init.headers || {}) } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { const error = new Error('Mercado Pago request failed'); error.code = 'MP_' + response.status; throw error; }
      return data;
    } finally { clearTimeout(timer); }
  };
  return {
    createPreference: body => call('/checkout/preferences', { method: 'POST', body: JSON.stringify(body), headers: { 'X-Idempotency-Key': body.external_reference } }),
    getPayment: id => call(`/v1/payments/${encodeURIComponent(id)}`),
    // Full refund. The idempotency key makes a double click (or a retry) a single refund.
    refundPayment: (id, key) => call(`/v1/payments/${encodeURIComponent(id)}/refunds`, { method: 'POST', body: '{}', headers: { 'X-Idempotency-Key': key } }),
  };
}

export function createPayments(db, { mp, origin, sendMail = null, now: clock = Date.now }) {
  const insert = db.dialect === 'mysql' ? 'INSERT IGNORE' : 'INSERT OR IGNORE', lock = db.dialect === 'mysql' ? ' FOR UPDATE' : '';
  const accounts = createAccounts(db);
  const audit = (query, actor, id, action, now) => query('INSERT INTO labs_account_audit (id,actor_id,account_id,action,created_at) VALUES (?,?,?,?,?)', [randomUUID(), actor, id, action, now]);
  const requireAdmin = async (query, actor) => {
    const [row] = await query(`SELECT role,disabled,password_hash FROM labs_accounts WHERE id=?${lock}`, [actor]);
    if (!row || row.role !== 'admin' || row.disabled || !row.password_hash) throw new AccountError('Acesso administrativo necessário.', 403);
  };
  // No reembolso, só revoga o que nenhum outro pedido aprovado nem concessão manual (admin) mantém.
  const stillGranted = async (query, accountId, grant, exceptOrder) => {
    for (const row of await query("SELECT product FROM labs_orders WHERE account_id=? AND status='approved' AND id<>?", [accountId, exceptOrder])) if ((PRODUCTS[row.product]?.grants || []).includes(grant)) return true;
    const actions = grant === 'unlimited' ? ['unlimited-granted', 'unlimited-revoked'] : ['cloud-save-granted', 'cloud-save-revoked'];
    const [last] = await query('SELECT action FROM labs_account_audit WHERE account_id=? AND actor_id<>? AND action IN (?,?) ORDER BY created_at DESC LIMIT 1', [accountId, SYSTEM_ACTOR, ...actions]);
    return last?.action === actions[0];
  };
  const revokeGrants = async (query, accountId, grants, orderId, now) => {
    const revoke = [];
    for (const g of grants) if ((g === 'unlimited' || g === 'cloud') && !(await stillGranted(query, accountId, g, orderId))) revoke.push(g);
    await applyGrants(query, accountId, revoke, false, now);
  };
  const applyGrants = async (query, accountId, grants, enable, now) => {
    if (grants.includes('unlimited')) { await query('UPDATE labs_accounts SET unlimited=? WHERE id=?', [enable ? 1 : 0, accountId]); await audit(query, SYSTEM_ACTOR, accountId, enable ? 'unlimited-granted' : 'unlimited-revoked', now); }
    if (grants.includes('cloud')) { await query(`${insert} INTO labs_cloud_access (account_id,enabled,updated_at) VALUES (?,0,?)`, [accountId, now]); await query('UPDATE labs_cloud_access SET enabled=?,updated_at=? WHERE account_id=?', [enable ? 1 : 0, now, accountId]); await audit(query, SYSTEM_ACTOR, accountId, enable ? 'cloud-save-granted' : 'cloud-save-revoked', now); }
  };
  const view = row => ({ id: row.id, product: row.product, title: PRODUCTS[row.product]?.title || row.product, amountCents: Number(row.amount_cents), currency: row.currency, status: row.status, provider: row.provider, providerStatus: row.provider_status, paymentId: row.payment_id, coupon: row.coupon || null, createdAt: new Date(Number(row.created_at)).toISOString(), updatedAt: new Date(Number(row.updated_at)).toISOString() });
  const couponView = row => ({ code: row.code, percentOff: Number(row.percent_off), product: row.product || null, productTitle: row.product ? (PRODUCTS[row.product]?.title || row.product) : 'Qualquer produto', maxUses: Number(row.max_uses), uses: Number(row.uses), expiresAt: row.expires_at ? new Date(Number(row.expires_at)).toISOString() : null, disabled: !!row.disabled, note: row.note || '', createdAt: new Date(Number(row.created_at)).toISOString() });
  /** Validates a coupon for this product inside a transaction (row locked) and returns the discount in cents. */
  const redeemCoupon = async (query, code, productCode, priceCents, now) => {
    const [coupon] = await query(`SELECT * FROM labs_coupons WHERE code=?${lock}`, [code]);
    const invalid = !coupon || coupon.disabled || Number(coupon.uses) >= Number(coupon.max_uses) || (coupon.expires_at && Number(coupon.expires_at) < now) || (coupon.product && coupon.product !== productCode);
    if (invalid) throw new AccountError('Cupom inválido, esgotado ou não vale para este produto.', 400);
    await query('UPDATE labs_coupons SET uses=uses+1 WHERE code=?', [code]);
    return Math.min(priceCents, Math.round(priceCents * Number(coupon.percent_off) / 100));
  };
  /** After a confirmed purchase: accounts created at checkout get the link to set their password; others get a receipt. Never throws. */
  const notify = async (accountId, productCode, now) => {
    if (!sendMail) return;
    try {
      const [row] = await db.query('SELECT a.username, a.password_hash, e.email FROM labs_accounts a LEFT JOIN labs_account_emails e ON e.account_id=a.id WHERE a.id=?', [accountId]);
      if (!row?.email) return;
      const title = PRODUCTS[productCode]?.title || productCode;
      if (row.password_hash) {
        await sendMail({ to: row.email, subject: 'Compra confirmada no ValleyBlocks', text: `Olá!\n\nSua compra foi confirmada: ${title}.\nO benefício já está na conta "${row.username}". É só entrar e jogar:\n\n${origin}/jogos/valleyblocks\n\nValleyBlocks · https://labsgames.cloud` });
        return;
      }
      const token = randomBytes(32).toString('hex');
      await db.transaction(async query => {
        await query('UPDATE labs_account_invites SET used_at=? WHERE account_id=? AND used_at IS NULL', [now, accountId]);
        await query('INSERT INTO labs_account_invites (token_hash,account_id,expires_at,used_at) VALUES (?,?,?,NULL)', [tokenHash(token), accountId, now + 7 * 86400000]);
        await query('UPDATE labs_account_emails SET verified_at=COALESCE(verified_at,?) WHERE account_id=?', [now, accountId]);
        await audit(query, SYSTEM_ACTOR, accountId, 'purchase-invite-sent', now);
      });
      await sendMail({ to: row.email, subject: 'Sua compra no ValleyBlocks: crie sua senha', text: `Olá!\n\nSua compra foi confirmada: ${title}.\nCriamos a conta "${row.username}" para você. Para escolher sua senha e começar a jogar, abra o link abaixo em até 7 dias:\n\n${origin}/conta/ativar#token=${token}\n\nSe você não fez esta compra, ignore esta mensagem.\n\nValleyBlocks · https://labsgames.cloud` });
    } catch (error) { console.error('[labs] purchase mail failed:', error?.code || error?.name || 'UNKNOWN'); }
  };
  return {
    /** Checkout without a session: the e-mail identifies (or creates) the account; the password is set from the link sent after payment. */
    async guestCheckout({ email, product: productCode, coupon = '', client = '' }) {
      const address = parseEmail(email), now = clock();
      if (!PRODUCTS[productCode]) throw new AccountError('Produto não encontrado.', 404);
      await accounts.rateLimit(createHash('sha256').update('guest-email:' + address).digest('hex'), 5, now);
      await accounts.rateLimit(createHash('sha256').update('guest-client:' + String(client).slice(0, 64)).digest('hex'), 20, now);
      let [row] = await db.query('SELECT a.* FROM labs_account_emails e JOIN labs_accounts a ON a.id=e.account_id WHERE e.email=?', [address]);
      // Conta com senha: precisa entrar. Conta sem senha já existente: só o convite por e-mail ativa (sem claim).
      if (row?.password_hash) throw new AccountError('Esse e-mail já tem conta. Entre na sua conta para comprar.', 409);
      let created = false;
      if (!row) {
        const base = (address.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24) || 'jogador').padEnd(3, '0');
        const id = randomUUID();
        await db.transaction(async query => {
          if ((await query('SELECT account_id FROM labs_account_emails WHERE email=?', [address])).length) throw new AccountError('Tente novamente.', 409);
          let name = '';
          for (let i = 0; i < 6 && !name; i++) { const candidate = `${base}_${randomBytes(2).readUInt16BE(0) % 10000}`.padEnd(3, '0'); if (!(await query('SELECT id FROM labs_accounts WHERE username=?', [candidate])).length) name = candidate; }
          if (!name) throw new AccountError('Tente novamente.', 409);
          await query('INSERT INTO labs_accounts (id,username,password_hash,role,unlimited,disabled,created_at) VALUES (?,?,NULL,?,0,0,?)', [id, name, 'player', now]);
          await query('INSERT INTO labs_account_emails (account_id,email,guardian_email,minor,verified_at,created_at) VALUES (?,?,NULL,0,NULL,?)', [id, address, now]);
          await audit(query, SYSTEM_ACTOR, id, 'guest-created', now);
        });
        [row] = await db.query('SELECT * FROM labs_accounts WHERE id=?', [id]); created = true;
      }
      if (row.disabled) throw new AccountError('Esta conta está desativada.', 403);
      const [cloud] = await db.query('SELECT enabled FROM labs_cloud_access WHERE account_id=?', [row.id]);
      const view = { id: row.id, username: row.username, unlimited: !!row.unlimited, cloudSave: !!cloud?.enabled };
      const result = await this.checkout(view, productCode, coupon, { back: id => `${origin}/comprar/${productCode}?pedido=${id}`, claimable: created });
      return { ...result, guest: true, claimable: created };
    },
    /** Creates a pending order and the provider checkout; returns the redirect URL. A 100% coupon approves the order right away. */
    async checkout(account, productCode, couponCode = '', { back = null, claimable = false } = {}) {
      const product = PRODUCTS[productCode];
      if (!product) throw new AccountError('Produto não encontrado.', 404);
      if (!account?.id) throw new AccountError('Entre na sua conta para comprar.', 401);
      const code = normalizeCoupon(couponCode);
      if (code && !COUPON_CODE.test(code)) throw new AccountError('Cupom inválido, esgotado ou não vale para este produto.', 400);
      const paid = await db.query("SELECT id FROM labs_orders WHERE account_id=? AND product=? AND status='approved' LIMIT 1", [account.id, productCode]);
      const owned = await accounts.entitlements(account.id);
      const already = paid.length > 0 || product.grants.every(g => (g === 'unlimited' && account.unlimited) || (g === 'cloud' && account.cloudSave) || (g.startsWith('outfits:') && owned.outfits.includes(g.slice(8))));
      if (already) throw new AccountError('Sua conta já tem este benefício.', 409);
      const now = clock(), id = randomUUID();
      // A new checkout for the same product replaces the player's own abandoned checkouts. Their coupon uses stay
      // consumed: if an old preference is paid anyway, reconcilePayment approves it without exceeding max_uses.
      await db.transaction(async query => {
        const stale = await query("SELECT id FROM labs_orders WHERE account_id=? AND product=? AND status='pending'", [account.id, productCode]);
        for (const row of stale) {
          await query("UPDATE labs_orders SET status='cancelled',provider_status='superseded',updated_at=? WHERE id=?", [now, row.id]);
        }
      });
      const pending = await db.query("SELECT id FROM labs_orders WHERE account_id=? AND status='pending' AND created_at>?", [account.id, now - 3600000]);
      if (pending.length >= 3) throw new AccountError('Você já tem pedidos em andamento. Conclua ou aguarde antes de abrir outro.', 429);
      // Guessing coupon codes is rate limited per account (DB-backed, shared across instances).
      if (code) await accounts.rateLimit(createHash('sha256').update('coupon:' + account.id).digest('hex'), 20, now);
      const amount = await db.transaction(async query => {
        const discount = code ? await redeemCoupon(query, code, productCode, product.priceCents, now) : 0;
        const due = product.priceCents - discount, isFree = due === 0;
        await query('INSERT INTO labs_orders (id,account_id,product,amount_cents,currency,status,provider,provider_status,claimable,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)', [id, account.id, productCode, due, CURRENCY, isFree ? 'approved' : 'pending', isFree ? 'coupon' : 'mercadopago', isFree ? 'coupon:' + code : null, claimable ? 1 : 0, now, now]);
        if (code) await query('INSERT INTO labs_coupon_uses (order_id,code,account_id,discount_cents,created_at) VALUES (?,?,?,?,?)', [id, code, account.id, discount, now]);
        if (isFree) { await applyGrants(query, account.id, product.grants, true, now); await audit(query, SYSTEM_ACTOR, account.id, 'coupon-redeemed', now); }
        return due;
      });
      const returnUrl = back ? back(id) : `${origin}/conta?pedido=${id}`;
      if (amount === 0) { await notify(account.id, productCode, now); return { orderId: id, url: returnUrl, free: true }; }
      let preference;
      try {
        preference = await mp.createPreference({
          items: [{ id: productCode, title: product.title, description: code ? `${product.description} Cupom ${code}.` : product.description, quantity: 1, currency_id: CURRENCY, unit_price: amount / 100 }],
          external_reference: id, notification_url: `${origin}/api/payments/webhook`,
          back_urls: { success: returnUrl, pending: returnUrl, failure: returnUrl }, auto_return: 'approved',
          statement_descriptor: 'LABSGAMES', metadata: { order_id: id, account_id: account.id, product: productCode },
        });
      } catch (error) {
        await db.transaction(async query => {
          await query("UPDATE labs_orders SET status='cancelled',provider_status='preference-failed',updated_at=? WHERE id=?", [clock(), id]);
          if (code) await query('UPDATE labs_coupons SET uses=CASE WHEN uses>0 THEN uses-1 ELSE 0 END WHERE code=?', [code]);
        });
        throw error;
      }
      await db.query('UPDATE labs_orders SET preference_id=?,updated_at=? WHERE id=?', [String(preference.id || ''), clock(), id]);
      return { orderId: id, url: preference.init_point, sandboxUrl: preference.sandbox_init_point || null, free: false };
    },
    /** Called by the webhook (or a manual re-check). Fetches the payment from the provider and reconciles the order. */
    async reconcilePayment(paymentId, { eventId } = {}) {
      const now = clock();
      if (eventId && (await db.query('SELECT id FROM labs_payment_events WHERE id=?', [eventId])).length) return { duplicate: true };
      // O evento só é registrado depois que o provedor respondeu: se a consulta falhar, o reenvio é processado.
      const payment = await mp.getPayment(paymentId);
      if (eventId) {
        const inserted = await db.transaction(async query => { await query(`${insert} INTO labs_payment_events (id,payment_id,received_at) VALUES (?,?,?)`, [eventId, String(paymentId), now]); const [row] = await query('SELECT received_at FROM labs_payment_events WHERE id=?', [eventId]); return Number(row.received_at) === now; });
        if (!inserted) return { duplicate: true };
      }
      const orderId = String(payment.external_reference || payment.metadata?.order_id || '');
      if (!/^[0-9a-f-]{36}$/.test(orderId)) return { ignored: 'no-order' };
      const status = STATUS[payment.status] || 'pending';
      const outcome = await db.transaction(async query => {
        const [order] = await query(`SELECT * FROM labs_orders WHERE id=?${lock}`, [orderId]);
        if (!order) return { ignored: 'unknown-order' };
        if (order.provider !== 'mercadopago') return { ignored: 'not-provider-order' };
        if (eventId) await query('UPDATE labs_payment_events SET order_id=?,status=? WHERE id=?', [orderId, payment.status, eventId]);
        const amountOk = Math.round(Number(payment.transaction_amount) * 100) === Number(order.amount_cents) && (payment.currency_id || CURRENCY) === order.currency;
        if (status === 'approved' && !amountOk) { await query("UPDATE labs_orders SET provider_status=?,updated_at=? WHERE id=?", ['amount-mismatch:' + payment.status, now, orderId]); return { ignored: 'amount-mismatch' }; }
        const previous = order.status, grants = PRODUCTS[order.product]?.grants || [], pid = String(payment.id);
        // Estados: pending/rejected → approved|rejected|cancelled|pending; approved → refunded só pelo MESMO pagamento.
        // Cancelado só aprova se foi substituído (o uso do cupom continua consumido); refunded é final.
        const final = { orderId, previous, ignored: 'final-state' };
        if (previous === 'approved') { if (status !== 'refunded' || String(order.payment_id || '') !== pid) return final; }
        else if (previous === 'refunded' || (previous === 'cancelled' && !(status === 'approved' && order.provider_status === 'superseded'))) return final;
        else if (status === 'refunded') return final;
        await query('UPDATE labs_orders SET status=?,payment_id=?,provider_status=?,updated_at=? WHERE id=?', [status, pid, String(payment.status_detail || payment.status), now, orderId]);
        if (status === 'approved' && previous !== 'approved') await applyGrants(query, order.account_id, grants, true, now);
        if (status === 'refunded' && previous === 'approved') await revokeGrants(query, order.account_id, grants, orderId, now);
        return { orderId, status, previous, accountId: order.account_id, product: order.product };
      });
      if (outcome.status === 'approved' && outcome.previous !== 'approved') await notify(outcome.accountId, outcome.product, now);
      const { accountId: _a, product: _p, ...result } = outcome; void _a; void _p;
      return result;
    },
    /** Cosmetic packs owned by the account, derived from paid orders and manual grants (never from the browser). */
    async entitlements(accountId) { return accounts.entitlements(accountId); },
    /** Order status for the return page. needsPassword: the account was created at checkout and has no password yet. */
    async orderStatus(orderId) {
      const [row] = await db.query('SELECT o.id,o.status,o.product,o.account_id,o.claimable,a.username,a.password_hash FROM labs_orders o JOIN labs_accounts a ON a.id=o.account_id WHERE o.id=?', [orderId]);
      if (!row) return null;
      return { orderId: row.id, status: row.status, product: row.product, accountId: row.account_id, username: row.username, needsPassword: !row.password_hash, claimable: Number(row.claimable) === 1 };
    },
    /** The browser that paid sets the password right away (instead of waiting for the e-mail) and gets a session. */
    async claimOrder(orderId, password, now = clock()) {
      const { hashPassword } = await import('./accounts.mjs');
      const passwordHash = await hashPassword(password);
      let accountId = null;
      await db.transaction(async query => {
        const [order] = await query(`SELECT * FROM labs_orders WHERE id=?${lock}`, [orderId]);
        if (!order || order.status !== 'approved') throw new AccountError('O pagamento ainda não foi confirmado.', 409);
        // Só o pedido que CRIOU a conta define a primeira senha; contas já existentes usam o link do e-mail.
        if (Number(order.claimable) !== 1) throw new AccountError('Use o link enviado para o seu e-mail.', 403);
        const [account] = await query(`SELECT * FROM labs_accounts WHERE id=?${lock}`, [order.account_id]);
        if (!account || account.disabled || account.password_hash) throw new AccountError('Esta conta já tem senha. Entre normalmente.', 409);
        await query('UPDATE labs_accounts SET password_hash=? WHERE id=?', [passwordHash, account.id]);
        await query('UPDATE labs_account_invites SET used_at=? WHERE account_id=? AND used_at IS NULL', [now, account.id]);
        await audit(query, account.id, account.id, 'account-claimed', now);
        accountId = account.id;
      });
      return { token: await accounts.openSession(accountId, now) };
    },
    async listForAccount(accountId) { return (await db.query('SELECT o.*, u.code AS coupon FROM labs_orders o LEFT JOIN labs_coupon_uses u ON u.order_id=o.id WHERE o.account_id=? ORDER BY o.created_at DESC LIMIT 50', [accountId])).map(view); },
    /** Admin: coupons. Codes are upper-case; percent 1-100; optional product restriction and expiry. */
    async createCoupon(actor, { code, percentOff, product = null, maxUses = 1, expiresAt = null, note = '' }) {
      const normalized = normalizeCoupon(code), percent = Number(percentOff), uses = Number(maxUses);
      if (!COUPON_CODE.test(normalized)) throw new AccountError('Código do cupom: 3 a 32 letras, números ou hífen.');
      if (!Number.isInteger(percent) || percent < 1 || percent > 100) throw new AccountError('Desconto deve ser um inteiro entre 1 e 100.');
      if (!Number.isInteger(uses) || uses < 1 || uses > 10000) throw new AccountError('Quantidade de usos deve ficar entre 1 e 10000.');
      if (product && !PRODUCTS[product]) throw new AccountError('Produto não encontrado.', 404);
      const expiry = expiresAt ? Number(new Date(expiresAt)) : null;
      if (expiresAt && (!Number.isFinite(expiry) || expiry <= clock())) throw new AccountError('Validade precisa ser uma data futura.');
      const now = clock();
      await db.transaction(async query => {
        await requireAdmin(query, actor);
        const [exists] = await query('SELECT code FROM labs_coupons WHERE code=?', [normalized]);
        if (exists) throw new AccountError('Já existe um cupom com este código.', 409);
        await query('INSERT INTO labs_coupons (code,percent_off,product,max_uses,uses,expires_at,disabled,note,created_by,created_at) VALUES (?,?,?,?,0,?,0,?,?,?)', [normalized, percent, product || null, uses, expiry, String(note || '').slice(0, 80), actor, now]);
        await audit(query, actor, actor, 'coupon-created', now);
      });
      return couponView((await db.query('SELECT * FROM labs_coupons WHERE code=?', [normalized]))[0]);
    },
    async setCouponDisabled(actor, code, disabled) {
      const normalized = normalizeCoupon(code);
      if (typeof disabled !== 'boolean') throw new AccountError('Valor inválido.');
      await db.transaction(async query => {
        await requireAdmin(query, actor);
        const [row] = await query('SELECT code FROM labs_coupons WHERE code=?', [normalized]);
        if (!row) throw new AccountError('Cupom não encontrado.', 404);
        await query('UPDATE labs_coupons SET disabled=? WHERE code=?', [disabled ? 1 : 0, normalized]);
        await audit(query, actor, actor, disabled ? 'coupon-disabled' : 'coupon-enabled', clock());
      });
    },
    async listCoupons() { return (await db.query('SELECT * FROM labs_coupons ORDER BY created_at DESC LIMIT 200')).map(couponView); },
    /** Admin refund: Mercado Pago orders are refunded at the provider and then re-read from its API
     *  (the provider's word sets the status); coupon orders (no charge) are just closed locally. */
    async refundOrder(actor, orderId) {
      if (!/^[0-9a-f-]{36}$/i.test(String(orderId || ''))) throw new AccountError('Pedido inválido.');
      const [order] = await db.query('SELECT * FROM labs_orders WHERE id=?', [orderId]);
      if (!order) throw new AccountError('Pedido não encontrado.', 404);
      if (order.status !== 'approved') throw new AccountError('Só pedidos pagos podem ser devolvidos.', 409);
      await db.transaction(async query => { await requireAdmin(query, actor); });
      const now = clock();
      if (!order.payment_id) {
        await db.transaction(async query => {
          const [latest] = await query(`SELECT * FROM labs_orders WHERE id=?${lock}`, [orderId]);
          if (latest.status !== 'approved') throw new AccountError('O pedido mudou; atualize a página.', 409);
          await query("UPDATE labs_orders SET status='refunded',provider_status='admin-refund',updated_at=? WHERE id=?", [now, orderId]);
          await revokeGrants(query, order.account_id, PRODUCTS[order.product]?.grants || [], orderId, now);
          await audit(query, actor, order.account_id, 'order-refunded', now);
        });
        return { status: 'refunded' };
      }
      try { await mp.refundPayment(order.payment_id, 'refund-' + orderId); }
      catch (error) { throw new AccountError(`O Mercado Pago recusou a devolução (${error.code || 'erro'}). Confira o saldo da conta ou devolva pelo painel do Mercado Pago.`, 502); }
      await db.transaction(async query => { await audit(query, actor, order.account_id, 'order-refunded', now); });
      const outcome = await this.reconcilePayment(order.payment_id);
      const [after] = await db.query('SELECT status FROM labs_orders WHERE id=?', [orderId]);
      return { status: after?.status || outcome?.status || 'pending' };
    },
    /** Removes a test/abandoned order. A paid order must be refunded first, so no money or grant
     *  is ever left without its record. */
    async deleteOrder(actor, orderId) {
      if (!/^[0-9a-f-]{36}$/i.test(String(orderId || ''))) throw new AccountError('Pedido inválido.');
      const now = clock();
      await db.transaction(async query => {
        await requireAdmin(query, actor);
        const [order] = await query(`SELECT * FROM labs_orders WHERE id=?${lock}`, [orderId]);
        if (!order) throw new AccountError('Pedido não encontrado.', 404);
        if (order.status === 'approved') throw new AccountError('Pedido pago: faça a devolução antes de excluir.', 409);
        await query('DELETE FROM labs_coupon_uses WHERE order_id=?', [orderId]);
        await query('DELETE FROM labs_payment_events WHERE order_id=?', [orderId]);
        await query('DELETE FROM labs_orders WHERE id=?', [orderId]);
        await audit(query, actor, order.account_id, 'order-deleted', now);
      });
    },
    async adminReport(now = clock(), { page = 1, pageSize = 10 } = {}) {
      const monthStart = new Date(now); monthStart.setUTCHours(monthStart.getUTCHours() - 3); const since = Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), 1) + 3 * 3600000;
      const [month] = await db.query("SELECT COALESCE(SUM(CASE WHEN status='approved' THEN amount_cents ELSE 0 END),0) AS revenue, SUM(CASE WHEN status='approved' THEN 1 ELSE 0 END) AS approved, SUM(CASE WHEN status='refunded' THEN 1 ELSE 0 END) AS refunded, SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending FROM labs_orders WHERE updated_at>=?", [since]);
      const [total] = await db.query("SELECT COALESCE(SUM(CASE WHEN status='approved' THEN amount_cents ELSE 0 END),0) AS revenue, COUNT(*) AS orders FROM labs_orders");
      const byProduct = await db.query("SELECT product, SUM(CASE WHEN status='approved' THEN 1 ELSE 0 END) AS approved, COALESCE(SUM(CASE WHEN status='approved' THEN amount_cents ELSE 0 END),0) AS revenue FROM labs_orders GROUP BY product");
      const orders = await db.query('SELECT o.*, u.code AS coupon, a.username FROM labs_orders o LEFT JOIN labs_coupon_uses u ON u.order_id=o.id LEFT JOIN labs_accounts a ON a.id=o.account_id ORDER BY o.created_at DESC LIMIT ? OFFSET ?', [pageSize, (Math.max(1, page) - 1) * pageSize]);
      const days = await db.query("SELECT updated_at, amount_cents FROM labs_orders WHERE status='approved' AND updated_at>=?", [now - 30 * 86400000]);
      return { month: { revenueCents: Number(month?.revenue || 0), approved: Number(month?.approved || 0), refunded: Number(month?.refunded || 0), pending: Number(month?.pending || 0) }, total: { revenueCents: Number(total?.revenue || 0), orders: Number(total?.orders || 0) },
        byProduct: byProduct.map(r => ({ product: r.product, title: PRODUCTS[r.product]?.title || r.product, approved: Number(r.approved), revenueCents: Number(r.revenue) })),
        orders: orders.map(r => ({ ...view(r), username: r.username || '(conta excluída)' })), page: Math.max(1, page), pageSize, approvedPayments: days.map(r => ({ at: Number(r.updated_at), amountCents: Number(r.amount_cents) })), coupons: await this.listCoupons() };
    },
  };
}
