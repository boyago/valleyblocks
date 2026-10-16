import { randomBytes, randomUUID } from 'node:crypto';
import { AccountError, hashPassword, tokenHash, username } from './accounts.mjs';

// Public sign-up, e-mail confirmation and password recovery. Separate tables so
// the invite-only schema needs no ALTER TABLE. Only the "minor" flag is kept;
// the birth date itself is never stored.
export const SIGNUP_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS labs_account_emails (
    account_id VARCHAR(36) PRIMARY KEY, email VARCHAR(254) NOT NULL UNIQUE,
    guardian_email VARCHAR(254), minor INTEGER NOT NULL DEFAULT 0,
    verified_at BIGINT, created_at BIGINT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS labs_email_tokens (
    token_hash VARCHAR(64) PRIMARY KEY, account_id VARCHAR(36) NOT NULL,
    purpose VARCHAR(10) NOT NULL, expires_at BIGINT NOT NULL, used_at BIGINT
  )`,
];
export const VERIFY_TTL_MS = 24 * 3600000, RESET_TTL_MS = 3600000;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,189}\.[a-zA-Z]{2,24}$/;

export function email(value) {
  if (typeof value === 'string') value = value.trim().toLowerCase();
  if (typeof value !== 'string' || value.length > 254 || !EMAIL.test(value)) throw new AccountError('Informe um e-mail válido.');
  return value;
}
/** Returns the age in whole years without keeping the date. */
export function ageFromBirthDate(value, now = Date.now()) {
  const match = typeof value === 'string' && value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new AccountError('Informe a data de nascimento.');
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new AccountError('Data de nascimento inválida.');
  const today = new Date(now);
  let age = today.getUTCFullYear() - year;
  if (today.getUTCMonth() + 1 < month || (today.getUTCMonth() + 1 === month && today.getUTCDate() < day)) age--;
  if (age < 0 || age > 120) throw new AccountError('Data de nascimento inválida.');
  return age;
}

export function createSignup(db, { sendMail, origin }) {
  const lock = db.dialect === 'mysql' ? ' FOR UPDATE' : '';
  const token = () => randomBytes(32).toString('hex');
  const audit = (query, actor, id, action, now) => query('INSERT INTO labs_account_audit (id,actor_id,account_id,action,created_at) VALUES (?,?,?,?,?)', [randomUUID(), actor, id, action, now]);
  const issue = async (query, accountId, purpose, ttl, now) => { const value = token(); await query('INSERT INTO labs_email_tokens (token_hash,account_id,purpose,expires_at,used_at) VALUES (?,?,?,?,NULL)', [tokenHash(value), accountId, purpose, now + ttl]); return value; };
  const link = (path, value) => `${origin}/conta/${path}#token=${value}`;
  const mailVerify = (to, name, value) => sendMail({ to, subject: 'Confirme sua conta no ValleyBlocks', text: `Olá!\n\nA conta "${name}" foi criada no ValleyBlocks com este e-mail. Para confirmar, abra o link abaixo em até 24 horas:\n\n${link('verificar', value)}\n\nSe você não criou esta conta, ignore esta mensagem; nada será ativado.\n\nValleyBlocks · https://labsgames.cloud` });
  return {
    /** Creates an unverified account and sends the confirmation link. */
    async register({ name, password, email: rawEmail, birthDate, guardianEmail }, now = Date.now()) {
      const normalized = username(name), address = email(rawEmail), age = ageFromBirthDate(birthDate, now);
      const minor = age < 18;
      let guardian = null;
      if (age < 13) {
        if (!guardianEmail) throw new AccountError('Para menores de 13 anos, informe o e-mail de um responsável.');
        guardian = email(guardianEmail);
        if (guardian === address) throw new AccountError('O e-mail do responsável precisa ser diferente do seu.');
      }
      const passwordHash = await hashPassword(password), id = randomUUID();
      let value;
      await db.transaction(async query => {
        if ((await query('SELECT id FROM labs_accounts WHERE username=?', [normalized])).length) throw new AccountError('Esse nome de usuário já existe.', 409);
        if ((await query('SELECT account_id FROM labs_account_emails WHERE email=?', [address])).length) throw new AccountError('Esse e-mail já está cadastrado. Use "Esqueci a senha" se precisar.', 409);
        await query('INSERT INTO labs_accounts (id,username,password_hash,role,unlimited,disabled,created_at) VALUES (?,?,?,?,0,0,?)', [id, normalized, passwordHash, 'player', now]);
        await query('INSERT INTO labs_account_emails (account_id,email,guardian_email,minor,verified_at,created_at) VALUES (?,?,?,?,NULL,?)', [id, address, guardian, minor ? 1 : 0, now]);
        value = await issue(query, id, 'verify', VERIFY_TTL_MS, now);
        await audit(query, id, id, 'account-registered', now);
      });
      await mailVerify(guardian || address, normalized, value);
      return { id, username: normalized, sentTo: guardian ? 'guardian' : 'self' };
    },
    /** Sends a fresh confirmation link to an unverified account. Never reveals whether the e-mail exists. */
    async resend(rawEmail, now = Date.now()) {
      const address = email(rawEmail);
      const [row] = await db.query('SELECT e.account_id,e.guardian_email,a.username FROM labs_account_emails e JOIN labs_accounts a ON a.id=e.account_id WHERE e.email=? AND e.verified_at IS NULL AND a.disabled=0', [address]);
      if (!row) return;
      let value;
      await db.transaction(async query => {
        await query("UPDATE labs_email_tokens SET used_at=? WHERE account_id=? AND purpose='verify' AND used_at IS NULL", [now, row.account_id]);
        value = await issue(query, row.account_id, 'verify', VERIFY_TTL_MS, now);
      });
      await mailVerify(row.guardian_email || address, row.username, value);
    },
    async verify(value, now = Date.now()) {
      if (!/^[a-f0-9]{64}$/.test(value || '')) throw new AccountError('Link inválido ou expirado.');
      await db.transaction(async query => {
        const [row] = await query(`SELECT * FROM labs_email_tokens WHERE token_hash=?${lock}`, [tokenHash(value)]);
        if (!row || row.purpose !== 'verify' || row.used_at != null || Number(row.expires_at) <= now) throw new AccountError('Link inválido ou expirado.');
        await query('UPDATE labs_email_tokens SET used_at=? WHERE token_hash=?', [now, tokenHash(value)]);
        await query('UPDATE labs_account_emails SET verified_at=? WHERE account_id=? AND verified_at IS NULL', [now, row.account_id]);
        await audit(query, row.account_id, row.account_id, 'email-verified', now);
      });
    },
    /** Password recovery for verified e-mails. Always resolves, to avoid enumeration. */
    async recover(rawEmail, now = Date.now()) {
      const address = email(rawEmail);
      const [row] = await db.query('SELECT e.account_id,a.username FROM labs_account_emails e JOIN labs_accounts a ON a.id=e.account_id WHERE e.email=? AND e.verified_at IS NOT NULL AND a.disabled=0', [address]);
      if (!row) return;
      let value;
      await db.transaction(async query => {
        await query("UPDATE labs_email_tokens SET used_at=? WHERE account_id=? AND purpose='reset' AND used_at IS NULL", [now, row.account_id]);
        value = await issue(query, row.account_id, 'reset', RESET_TTL_MS, now);
      });
      await sendMail({ to: address, subject: 'Redefinir sua senha no ValleyBlocks', text: `Olá!\n\nRecebemos um pedido para redefinir a senha da conta "${row.username}". Abra o link abaixo em até 1 hora:\n\n${link('redefinir', value)}\n\nSe não foi você, ignore esta mensagem; sua senha continua a mesma.\n\nValleyBlocks · https://labsgames.cloud` });
    },
    async reset(value, password, now = Date.now()) {
      if (!/^[a-f0-9]{64}$/.test(value || '')) throw new AccountError('Link inválido ou expirado.');
      const passwordHash = await hashPassword(password);
      await db.transaction(async query => {
        const [row] = await query(`SELECT * FROM labs_email_tokens WHERE token_hash=?${lock}`, [tokenHash(value)]);
        if (!row || row.purpose !== 'reset' || row.used_at != null || Number(row.expires_at) <= now) throw new AccountError('Link inválido ou expirado.');
        await query('UPDATE labs_email_tokens SET used_at=? WHERE token_hash=?', [now, tokenHash(value)]);
        await query('UPDATE labs_accounts SET password_hash=? WHERE id=? AND disabled=0', [passwordHash, row.account_id]);
        await query('DELETE FROM labs_auth_sessions WHERE account_id=?', [row.account_id]);
        await audit(query, row.account_id, row.account_id, 'password-reset', now);
      });
    },
    /** For login: self-registered accounts must confirm their e-mail first. */
    async requireVerified(accountId) {
      const [row] = await db.query('SELECT verified_at FROM labs_account_emails WHERE account_id=?', [accountId]);
      if (row && row.verified_at == null) throw new AccountError('Confirme seu e-mail antes de entrar. Procure a mensagem do ValleyBlocks ou peça um novo link.', 403);
    },
    async profile(accountId) {
      const [row] = await db.query('SELECT email,minor,verified_at FROM labs_account_emails WHERE account_id=?', [accountId]);
      return row ? { email: row.email, minor: !!row.minor, verified: row.verified_at != null } : null;
    },
    async cleanup(now = Date.now()) { await db.query('DELETE FROM labs_email_tokens WHERE expires_at<?', [now - 86400000]); },
  };
}
