import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase, SCHEMA } from '../lib/server/usage-store.mjs';
import { AUTH_SCHEMA, createAccounts } from '../lib/server/accounts.mjs';
import { SIGNUP_SCHEMA, createSignup, ageFromBirthDate } from '../lib/server/signup.mjs';

async function setup() {
  const dir = await mkdtemp(join(tmpdir(), 'labs-signup-'));
  const db = await openDatabase({ LABS_USAGE_SQLITE_PATH: join(dir, 'test.sqlite') });
  for (const sql of [...SCHEMA, ...AUTH_SCHEMA, ...SIGNUP_SCHEMA]) await db.query(sql);
  const outbox = [];
  const signup = createSignup(db, { sendMail: async m => { outbox.push(m); }, origin: 'https://labsgames.test' });
  const accounts = createAccounts(db);
  const tokenOf = mail => mail.text.match(/#token=([a-f0-9]{64})/)[1];
  return { db, signup, accounts, outbox, tokenOf, close: async () => { await db.close(); await rm(dir, { recursive: true, force: true }); } };
}
const adultBirth = '1990-05-10', teenBirth = () => `${new Date().getUTCFullYear() - 15}-01-01`, childBirth = () => `${new Date().getUTCFullYear() - 9}-01-01`;
const PASS = 'Senha forte de teste 2026';

test('age is derived from the birth date and never stored', async () => {
  const now = Date.UTC(2026, 9, 11);
  assert.equal(ageFromBirthDate('2008-10-11', now), 18);
  assert.equal(ageFromBirthDate('2008-10-12', now), 17);
  assert.throws(() => ageFromBirthDate('2026-02-30', now));
  assert.throws(() => ageFromBirthDate('10/11/1990', now));
  assert.throws(() => ageFromBirthDate('2030-01-01', now));
});

test('register, confirm, login; unverified login blocked; duplicate username and e-mail rejected', async () => {
  const t = await setup();
  try {
    const result = await t.signup.register({ name: 'Maria_01', password: PASS, email: 'Maria@Example.com ', birthDate: adultBirth });
    assert.equal(result.username, 'maria_01'); assert.equal(result.sentTo, 'self');
    assert.equal(t.outbox.length, 1); assert.equal(t.outbox[0].to, 'maria@example.com');
    assert.match(t.outbox[0].text, /https:\/\/labsgames\.test\/conta\/verificar#token=/);
    const [row] = await t.db.query('SELECT * FROM labs_account_emails'); assert.equal(row.minor, 0); assert.equal(row.verified_at, null);
    assert.equal((await t.db.query("SELECT * FROM labs_accounts WHERE username='maria_01'"))[0].password_hash.startsWith('scrypt$'), true);
    await assert.rejects(t.signup.requireVerified(result.id), /Confirme seu e-mail/);
    await assert.rejects(t.signup.register({ name: 'maria_01', password: PASS, email: 'x@example.com', birthDate: adultBirth }), /já existe/);
    await assert.rejects(t.signup.register({ name: 'outra', password: PASS, email: 'maria@example.com', birthDate: adultBirth }), /já está cadastrado/);
    const token = t.tokenOf(t.outbox[0]);
    await t.signup.verify(token);
    await t.signup.requireVerified(result.id);
    await assert.rejects(t.signup.verify(token), /inválido ou expirado/);
    const login = await t.accounts.login('maria_01', PASS);
    assert.equal(login.account.username, 'maria_01');
    const audit = await t.db.query('SELECT action FROM labs_account_audit ORDER BY created_at');
    assert.deepEqual(audit.map(r => r.action), ['account-registered', 'email-verified']);
    assert.deepEqual(await t.signup.profile(result.id), { email: 'maria@example.com', minor: false, verified: true });
  } finally { await t.close(); }
});

test('minors are flagged; under 13 need a different guardian e-mail that receives the link', async () => {
  const t = await setup();
  try {
    await assert.rejects(t.signup.register({ name: 'kid', password: PASS, email: 'kid@example.com', birthDate: childBirth() }), /responsável/);
    await assert.rejects(t.signup.register({ name: 'kid', password: PASS, email: 'kid@example.com', birthDate: childBirth(), guardianEmail: 'kid@example.com' }), /diferente/);
    const kid = await t.signup.register({ name: 'kid', password: PASS, email: 'kid@example.com', birthDate: childBirth(), guardianEmail: 'pai@example.com' });
    assert.equal(kid.sentTo, 'guardian'); assert.equal(t.outbox.at(-1).to, 'pai@example.com');
    const teen = await t.signup.register({ name: 'teen', password: PASS, email: 'teen@example.com', birthDate: teenBirth() });
    assert.equal(teen.sentTo, 'self');
    const rows = await t.db.query('SELECT account_id,minor,guardian_email FROM labs_account_emails');
    assert.equal(rows.find(r => r.account_id === kid.id).minor, 1); assert.equal(rows.find(r => r.account_id === kid.id).guardian_email, 'pai@example.com');
    assert.equal(rows.find(r => r.account_id === teen.id).minor, 1); assert.equal(rows.find(r => r.account_id === teen.id).guardian_email, null);
    assert.equal((await t.db.query("SELECT * FROM labs_accounts WHERE username='kid'"))[0].password_hash.includes('kid'), false);
  } finally { await t.close(); }
});

test('resend invalidates older verify tokens; recovery only for verified e-mails and never reveals existence', async () => {
  const t = await setup();
  try {
    const r = await t.signup.register({ name: 'joao', password: PASS, email: 'joao@example.com', birthDate: adultBirth });
    const first = t.tokenOf(t.outbox[0]);
    await t.signup.resend('joao@example.com');
    assert.equal(t.outbox.length, 2);
    await assert.rejects(t.signup.verify(first), /inválido/);
    await t.signup.recover('joao@example.com'); // unverified: silently ignored
    await t.signup.recover('ninguem@example.com');
    assert.equal(t.outbox.length, 2);
    await t.signup.verify(t.tokenOf(t.outbox[1]));
    await t.signup.resend('joao@example.com'); // verified: nothing to resend
    assert.equal(t.outbox.length, 2);
    const session = await t.accounts.login('joao', PASS);
    await t.signup.recover('JOAO@example.com');
    assert.equal(t.outbox.length, 3); assert.match(t.outbox[2].text, /\/conta\/redefinir#token=/);
    const reset = t.tokenOf(t.outbox[2]);
    await assert.rejects(t.signup.verify(reset), /inválido/, 'reset token cannot verify');
    await assert.rejects(t.signup.reset(reset, 'curta'), /12 a 128/);
    await t.signup.reset(reset, 'Nova senha bem comprida 2026');
    assert.equal(await t.accounts.session(session.token), null, 'sessions revoked');
    await assert.rejects(t.accounts.login('joao', PASS), /inválidos/);
    assert.equal((await t.accounts.login('joao', 'Nova senha bem comprida 2026')).account.username, 'joao');
    await assert.rejects(t.signup.reset(reset, 'Outra senha bem comprida 2026'), /inválido/);
    const expired = (await t.db.query('SELECT COUNT(*) AS n FROM labs_email_tokens'))[0].n;
    await t.signup.cleanup(Date.now() + 3 * 86400000);
    assert.equal((await t.db.query('SELECT COUNT(*) AS n FROM labs_email_tokens'))[0].n < expired, true);
    assert.equal(r.username, 'joao');
  } finally { await t.close(); }
});
