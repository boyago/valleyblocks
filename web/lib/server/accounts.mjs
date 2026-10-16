import { randomBytes, randomUUID, createHash, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { getDatabase } from './usage-store.mjs';
import { PRODUCTS } from '../products.mjs';
import { email as normalEmail } from './signup.mjs';
export const PACKS = Object.freeze(['expedicao']);
const scrypt = promisify(scryptCallback);
export const AUTH_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS labs_cloud_access (
    account_id VARCHAR(36) PRIMARY KEY, enabled INTEGER NOT NULL DEFAULT 0, updated_at BIGINT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS labs_accounts (
    id VARCHAR(36) PRIMARY KEY, username VARCHAR(32) NOT NULL UNIQUE,
    password_hash VARCHAR(200), role VARCHAR(10) NOT NULL,
    unlimited INTEGER NOT NULL DEFAULT 0, disabled INTEGER NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS labs_auth_sessions (
    token_hash VARCHAR(64) PRIMARY KEY, account_id VARCHAR(36) NOT NULL, expires_at BIGINT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS labs_account_invites (
    token_hash VARCHAR(64) PRIMARY KEY, account_id VARCHAR(36) NOT NULL,
    expires_at BIGINT NOT NULL, used_at BIGINT
  )`,
  `CREATE TABLE IF NOT EXISTS labs_auth_limits (
    bucket VARCHAR(64) PRIMARY KEY, window_start BIGINT NOT NULL, attempts INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS labs_pack_grants (
    account_id VARCHAR(36) NOT NULL, pack VARCHAR(32) NOT NULL, granted_by VARCHAR(36) NOT NULL, created_at BIGINT NOT NULL,
    PRIMARY KEY (account_id, pack)
  )`,
  `CREATE TABLE IF NOT EXISTS labs_account_audit (
    id VARCHAR(36) PRIMARY KEY, actor_id VARCHAR(36) NOT NULL, account_id VARCHAR(36) NOT NULL,
    action VARCHAR(40) NOT NULL, created_at BIGINT NOT NULL
  )`,
];
export const tokenHash = value => createHash('sha256').update(value).digest('hex');
export class AccountError extends Error {
  constructor(message, status = 400) { super(message);this.status = status; }
}
export function username(value) {
  if (typeof value === 'string') value=value.trim();
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_]{3,32}$/.test(value)) throw new AccountError('Use um nome de 3 a 32 letras, números ou sublinhado.');
  return value.toLowerCase();
}
export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) throw new AccountError('Use uma senha de 12 a 128 caracteres.');
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${salt}$${key.toString('hex')}`;
}
export async function verifyPassword(password, encoded) {
  const parts = typeof encoded === 'string' ? encoded.split('$') : [];
  const valid = parts[0] === 'scrypt' && /^[a-f0-9]{32}$/.test(parts[1] || '') && /^[a-f0-9]{128}$/.test(parts[2] || '');
  // Run the same expensive operation for unknown users and invitations pending activation.
  const key = await scrypt(typeof password === 'string' ? password.slice(0,128) : '', valid ? parts[1] : '00000000000000000000000000000000', 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return valid && timingSafeEqual(key, Buffer.from(parts[2], 'hex'));
}
export const publicAccount = row => row ? ({ id: row.id, username: row.username, role: row.role, unlimited: !!row.unlimited, cloudSave: !!row.cloud_save, disabled: !!row.disabled, activated: !!row.password_hash, packs: typeof row.packs === 'string' && row.packs ? row.packs.split(',') : [] }) : null;
// Admin-only view: adds contact data that never reaches the player APIs.
const adminAccount = row => ({ ...publicAccount(row), email: row.email || null, guardianEmail: row.guardian_email || null, minor: !!row.minor, emailVerified: row.verified_at != null, createdAt: row.created_at ? new Date(Number(row.created_at)).toISOString() : null });
export function createAccounts(db) {
  const lock = db.dialect === 'mysql' ? ' FOR UPDATE' : '';
  const insert = db.dialect === 'mysql' ? 'INSERT IGNORE' : 'INSERT OR IGNORE';
  const audit = (query, actor, id, action, now) => query('INSERT INTO labs_account_audit (id,actor_id,account_id,action,created_at) VALUES (?,?,?,?,?)', [randomUUID(), actor, id, action, now]);
  const admin = async (query, actor) => {
    const [row] = await query(`SELECT * FROM labs_accounts WHERE id=?${lock}`, [actor]);
    if (!row || row.role !== 'admin' || row.disabled || !row.password_hash) throw new AccountError('Acesso administrativo necessário.',403);
  };
  return {
    async rateLimit(bucket, maximum, now = Date.now(), { peek = false } = {}) {
      return db.transaction(async query => {
        await query(`${insert} INTO labs_auth_limits (bucket,window_start,attempts) VALUES (?,?,0)`, [bucket,now]);
        const [row] = await query(`SELECT * FROM labs_auth_limits WHERE bucket=?${lock}`,[bucket]);
        const expired = now - Number(row.window_start) >= 15 * 60000;
        if (!expired && row.attempts >= maximum) throw new AccountError('Muitas tentativas. Aguarde 15 minutos.',429);
        if (peek) return;
        await query('UPDATE labs_auth_limits SET window_start=?,attempts=? WHERE bucket=?',[expired ? now : row.window_start, expired ? 1 : Number(row.attempts)+1,bucket]);
      });
    },
    async invite({ name, actor, initialAdmin = false }, now = Date.now()) {
      const normalized = username(name), token = randomBytes(32).toString('hex'), id = randomUUID();
      await db.transaction(async query => {
        if (!initialAdmin) await admin(query,actor);
        else {
          // Only the server-side provisioning script may bootstrap the first admin.
          const rows = await query("SELECT id FROM labs_accounts WHERE role='admin'");
          if (rows.length) throw new AccountError('O administrador já existe; nenhuma credencial foi alterada.',409);
        }
        const existing = await query('SELECT id FROM labs_accounts WHERE username=?',[normalized]);
        if (existing.length) throw new AccountError('Esse nome de usuário já existe.',409);
        await query('INSERT INTO labs_accounts (id,username,password_hash,role,unlimited,disabled,created_at) VALUES (?,?,NULL,?,0,0,?)',[id,normalized,initialAdmin ? 'admin' : 'player',now]);
        await query('INSERT INTO labs_account_invites (token_hash,account_id,expires_at,used_at) VALUES (?,?,?,NULL)',[tokenHash(token),id,now+24*3600000]);
        await audit(query,actor || id,id,'invite-created',now);
      });
      return { account: {id,username:normalized,role:initialAdmin?'admin':'player'}, token, expiresAt:now+24*3600000 };
    },
    /** New one-use link for an account still waiting activation; earlier links stop working. */
    async reinvite(actor, id, now = Date.now()) {
      const token = randomBytes(32).toString('hex');
      let account;
      await db.transaction(async query => {
        await admin(query, actor);
        [account] = await query(`SELECT * FROM labs_accounts WHERE id=?${lock}`, [id]);
        if (!account) throw new AccountError('Conta não encontrada.', 404);
        if (account.password_hash || account.disabled) throw new AccountError('Esta conta já foi ativada; use a recuperação de senha.', 409);
        await query('UPDATE labs_account_invites SET used_at=? WHERE account_id=? AND used_at IS NULL', [now, id]);
        await query('INSERT INTO labs_account_invites (token_hash,account_id,expires_at,used_at) VALUES (?,?,?,NULL)', [tokenHash(token), id, now + 24 * 3600000]);
        await audit(query, actor, id, 'invite-renewed', now);
      });
      return { account: { id, username: account.username, role: account.role }, token, expiresAt: now + 24 * 3600000 };
    },
    /** New 12 h session for an account that just proved itself (activation link, purchase claim). */
    async openSession(accountId, now = Date.now()) {
      const token = randomBytes(32).toString('hex');
      await db.query('INSERT INTO labs_auth_sessions (token_hash,account_id,expires_at) VALUES (?,?,?)', [tokenHash(token), accountId, now + 12 * 3600000]);
      return token;
    },
    async activate(token, password, now = Date.now()) {
      if (!/^[a-f0-9]{64}$/.test(token || '')) throw new AccountError('Convite inválido ou expirado.');
      const passwordHash = await hashPassword(password);
      let activated = null;
      await db.transaction(async query => {
        const [invite] = await query(`SELECT * FROM labs_account_invites WHERE token_hash=?${lock}`,[tokenHash(token)]);
        if (!invite || invite.used_at != null || Number(invite.expires_at)<=now) throw new AccountError('Convite inválido ou expirado.');
        const [account] = await query(`SELECT * FROM labs_accounts WHERE id=?${lock}`,[invite.account_id]);
        if (!account || account.disabled || account.password_hash) throw new AccountError('Convite inválido ou expirado.');
        await query('UPDATE labs_accounts SET password_hash=? WHERE id=?',[passwordHash,account.id]);
        await query('UPDATE labs_account_invites SET used_at=? WHERE token_hash=?',[now,tokenHash(token)]);
        await audit(query,account.id,account.id,'account-activated',now);
        activated = account.id;
      });
      return { token: await this.openSession(activated, now) };
    },
    async login(name, password, now = Date.now(), client = '') {
      const normalized = username(name);
      // Per account+client: slows guessing without letting a stranger lock someone out.
      await this.rateLimit(tokenHash('login:'+normalized+':'+String(client).slice(0,64)),10,now);
      // Per account across all clients: counts only wrong passwords, so a stranger needs many
      // addresses to lock someone out and a correct login never spends the budget.
      const accountBucket=tokenHash('login-account:'+normalized);
      await this.rateLimit(accountBucket,300,now,{peek:true});
      const [account] = await db.query('SELECT a.*,c.enabled AS cloud_save FROM labs_accounts a LEFT JOIN labs_cloud_access c ON c.account_id=a.id WHERE a.username=?',[normalized]);
      const valid = await verifyPassword(password,account?.password_hash);
      if (!valid || account.disabled) { await this.rateLimit(accountBucket,300,now); throw new AccountError('Usuário ou senha inválidos.',401); }
      const token=randomBytes(32).toString('hex');
      await db.query('INSERT INTO labs_auth_sessions (token_hash,account_id,expires_at) VALUES (?,?,?)',[tokenHash(token),account.id,now+12*3600000]);
      return { token, account:publicAccount(account) };
    },
    async session(token, now = Date.now()) {
      if (!/^[a-f0-9]{64}$/.test(token || '')) return null;
      const [row]=await db.query('SELECT a.*,c.enabled AS cloud_save FROM labs_accounts a JOIN labs_auth_sessions s ON a.id=s.account_id LEFT JOIN labs_cloud_access c ON c.account_id=a.id WHERE s.token_hash=? AND s.expires_at>? AND a.disabled=0',[tokenHash(token),now]);
      return publicAccount(row);
    },
    async logout(token) { if (token) await db.query('DELETE FROM labs_auth_sessions WHERE token_hash=?',[tokenHash(token)]); },
    async changePassword(id, current, replacement, now = Date.now()) {
      await this.rateLimit(tokenHash('password:'+id),10,now);
      const [account]=await db.query('SELECT * FROM labs_accounts WHERE id=?',[id]);
      if (!account || !await verifyPassword(current,account.password_hash)) throw new AccountError('Senha atual inválida.',401);
      const encoded=await hashPassword(replacement);
      await db.transaction(async query=>{
        const [latest]=await query(`SELECT * FROM labs_accounts WHERE id=?${lock}`,[id]);
        if (latest.password_hash!==account.password_hash || latest.disabled) throw new AccountError('Entre novamente para continuar.',401);
        await query('UPDATE labs_accounts SET password_hash=? WHERE id=?',[encoded,id]);
        await query('DELETE FROM labs_auth_sessions WHERE account_id=?',[id]);
        await audit(query,id,id,'password-changed',now);
      });
    },
    async list(actor) {
      await admin(db.query,actor);
      const base='SELECT a.*,c.enabled AS cloud_save,(SELECT GROUP_CONCAT(pack) FROM labs_pack_grants g WHERE g.account_id=a.id) AS packs';
      let rows;
      try { rows=await db.query(base+',e.email,e.guardian_email,e.minor,e.verified_at FROM labs_accounts a LEFT JOIN labs_cloud_access c ON c.account_id=a.id LEFT JOIN labs_account_emails e ON e.account_id=a.id ORDER BY a.created_at DESC LIMIT 500'); }
      catch { rows=await db.query(base+' FROM labs_accounts a LEFT JOIN labs_cloud_access c ON c.account_id=a.id ORDER BY a.created_at DESC LIMIT 500'); }
      return rows.map(adminAccount);
    },
    async setUnlimited(actor, id, unlimited, now = Date.now()) {
      if (typeof unlimited !== 'boolean') throw new AccountError('Permissão inválida.');
      await db.transaction(async query=>{
        await admin(query,actor);
        const [account]=await query('SELECT id FROM labs_accounts WHERE id=?',[id]);
        if (!account) throw new AccountError('Conta não encontrada.',404);
        await query('UPDATE labs_accounts SET unlimited=? WHERE id=?',[unlimited?1:0,id]);
        await audit(query,actor,id,unlimited?'unlimited-granted':'unlimited-revoked',now);
      });
    },
    async setCloudSave(actor, id, enabled, now = Date.now()) {
      if (typeof enabled !== 'boolean') throw new AccountError('Permissão inválida.');
      await db.transaction(async query => {
        await admin(query, actor);
        const [account] = await query('SELECT id FROM labs_accounts WHERE id=?', [id]);
        if (!account) throw new AccountError('Conta não encontrada.', 404);
        await query(`${insert} INTO labs_cloud_access (account_id,enabled,updated_at) VALUES (?,0,?)`, [id, now]);
        await query('UPDATE labs_cloud_access SET enabled=?,updated_at=? WHERE account_id=?', [enabled ? 1 : 0, now, id]);
        await audit(query, actor, id, enabled ? 'cloud-save-granted' : 'cloud-save-revoked', now);
      });
    },
    /** Target of a destructive admin action: never yourself, never another admin. */
    async _target(query, actor, id) {
      await admin(query, actor);
      if (id === actor) throw new AccountError('Você não pode alterar a própria conta por aqui.', 409);
      const [account] = await query(`SELECT * FROM labs_accounts WHERE id=?${lock}`, [id]);
      if (!account) throw new AccountError('Conta não encontrada.', 404);
      if (account.role === 'admin') throw new AccountError('Contas de administrador não podem ser banidas, editadas ou excluídas aqui.', 409);
      return account;
    },
    /** Ban (disabled=1) ends every open session at once; unban only reopens login. */
    async setDisabled(actor, id, disabled, now = Date.now()) {
      if (typeof disabled !== 'boolean') throw new AccountError('Permissão inválida.');
      await db.transaction(async query => {
        await this._target(query, actor, id);
        await query('UPDATE labs_accounts SET disabled=? WHERE id=?', [disabled ? 1 : 0, id]);
        if (disabled) await query('DELETE FROM labs_auth_sessions WHERE account_id=?', [id]);
        await audit(query, actor, id, disabled ? 'account-banned' : 'account-unbanned', now);
      });
    },
    /** Username, e-mail, guardian e-mail and the minor flag. Sessions survive a profile edit. */
    async updateProfile(actor, id, input, now = Date.now()) {
      const name = username(input?.username);
      const mail = input?.email ? normalEmail(input.email) : null;
      const guardian = input?.guardianEmail ? normalEmail(input.guardianEmail) : null;
      if (typeof input?.minor !== 'boolean') throw new AccountError('Informe se a conta é de menor de idade.');
      if (input.minor && !guardian) throw new AccountError('Conta de menor precisa do e-mail do responsável.');
      await db.transaction(async query => {
        const account = await this._target(query, actor, id);
        if (name !== account.username && (await query('SELECT id FROM labs_accounts WHERE username=?', [name])).length) throw new AccountError('Esse nome de usuário já existe.', 409);
        if (mail && (await query('SELECT account_id FROM labs_account_emails WHERE email=? AND account_id<>?', [mail, id])).length) throw new AccountError('Esse e-mail já pertence a outra conta.', 409);
        await query('UPDATE labs_accounts SET username=? WHERE id=?', [name, id]);
        const [current] = await query('SELECT * FROM labs_account_emails WHERE account_id=?', [id]);
        if (!mail) await query('DELETE FROM labs_account_emails WHERE account_id=?', [id]);
        else if (!current) await query('INSERT INTO labs_account_emails (account_id,email,guardian_email,minor,verified_at,created_at) VALUES (?,?,?,?,?,?)', [id, mail, guardian, input.minor ? 1 : 0, now, now]);
        else await query('UPDATE labs_account_emails SET email=?,guardian_email=?,minor=?,verified_at=? WHERE account_id=?', [mail, guardian, input.minor ? 1 : 0, mail === current.email ? current.verified_at : now, id]);
        // Old recovery/confirmation links pointed at the previous address.
        if (!current || mail !== current.email) await query('DELETE FROM labs_email_tokens WHERE account_id=?', [id]);
        await audit(query, actor, id, 'profile-updated', now);
      });
    },
    /** Erases the player and everything keyed to them. Orders stay for the books, without the name. */
    async remove(actor, id, now = Date.now()) {
      await db.transaction(async query => {
        await this._target(query, actor, id);
        const owner = 'user:' + id;
        for (const [sql, args] of [
          ['DELETE FROM labs_auth_sessions WHERE account_id=?', [id]], ['DELETE FROM labs_account_invites WHERE account_id=?', [id]],
          ['DELETE FROM labs_cloud_access WHERE account_id=?', [id]], ['DELETE FROM labs_pack_grants WHERE account_id=?', [id]],
          ['DELETE FROM labs_account_emails WHERE account_id=?', [id]], ['DELETE FROM labs_email_tokens WHERE account_id=?', [id]],
          ['DELETE FROM labs_worlds WHERE owner_id=?', [owner]], ['DELETE FROM labs_play_sessions WHERE owner_id=?', [owner]],
          ['DELETE FROM labs_play_daily WHERE owner_id=?', [owner]], ['DELETE FROM labs_play_stats WHERE owner_id=?', [owner]],
          ['DELETE FROM labs_play_guest_claims WHERE account_id=?', [owner]],
        ]) {
          // Optional tables (cloud worlds, play quota) may not exist in every install.
          try { await query(sql, args); } catch (error) { if (!/no such table|doesn't exist/i.test(String(error?.message))) throw error; }
        }
        await query('DELETE FROM labs_accounts WHERE id=?', [id]);
        await audit(query, actor, id, 'account-deleted', now);
      });
    },
    /** Manual cosmetic pack grant (family, promotions). Audited like the other permissions. */
    async setPack(actor, id, pack, enabled, now = Date.now()) {
      if (!PACKS.includes(pack) || typeof enabled !== 'boolean') throw new AccountError('Pacote inválido.');
      await db.transaction(async query => {
        await admin(query, actor);
        const [account] = await query('SELECT id FROM labs_accounts WHERE id=?', [id]);
        if (!account) throw new AccountError('Conta não encontrada.', 404);
        if (enabled) await query(`${insert} INTO labs_pack_grants (account_id,pack,granted_by,created_at) VALUES (?,?,?,?)`, [id, pack, actor, now]);
        else await query('DELETE FROM labs_pack_grants WHERE account_id=? AND pack=?', [id, pack]);
        await audit(query, actor, id, enabled ? 'pack-granted' : 'pack-revoked', now);
      });
    },
    /** Cosmetic packs: manual grants plus paid orders. Never from the browser. */
    async entitlements(id) {
      const packs = new Set((await db.query('SELECT pack FROM labs_pack_grants WHERE account_id=?', [id])).map(r => r.pack));
      try {
        for (const row of await db.query("SELECT DISTINCT product FROM labs_orders WHERE account_id=? AND status='approved'", [id]))
          for (const grant of PRODUCTS[row.product]?.grants || []) if (grant.startsWith('outfits:')) packs.add(grant.slice(8));
      } catch { /* payments schema absent: manual grants still count */ }
      return { outfits: [...packs] };
    },
    async cleanup(now = Date.now()) {
      await db.query('DELETE FROM labs_auth_sessions WHERE expires_at<=?',[now]);
      await db.query('DELETE FROM labs_auth_limits WHERE window_start<?',[now-86400000]);
      await db.query('DELETE FROM labs_account_invites WHERE expires_at<?',[now-86400000]);
    },
  };
}
export async function getAccounts() {
  if (process.env.LABS_ACCOUNTS_ENABLED !== 'true') throw new AccountError('Contas ainda não disponíveis.',503);
  return createAccounts(await getDatabase());
}
