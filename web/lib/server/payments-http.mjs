import { AccountError } from './accounts.mjs';
import { getDatabase } from './usage-store.mjs';
import { createPayments, mercadoPagoClient, migratePayments, PAYMENT_SCHEMA } from './payments.mjs';
import { SIGNUP_SCHEMA } from './signup.mjs';
import { AUTH_SCHEMA } from './accounts.mjs';
import { sendAccountMail } from './mail.mjs';

export const paymentsEnabled = () => process.env.LABS_PAYMENTS_ENABLED === 'true';
// Payment tables are created on first use (CREATE TABLE IF NOT EXISTS + ALTER idempotente para colunas novas),
// so a deploy does not depend on a manual migration with database credentials.
let schemaReady = null;
async function ensureSchema(db) {
  if (!schemaReady) schemaReady = (async () => { for (const sql of [...AUTH_SCHEMA, ...SIGNUP_SCHEMA, ...PAYMENT_SCHEMA]) await db.query(sql); await migratePayments(db); })().catch(error => { schemaReady = null; throw error; });
  return schemaReady;
}
export async function getPayments() {
  if (!paymentsEnabled()) throw new AccountError('Pagamentos ainda não estão disponíveis.', 503);
  if (!process.env.LABS_MP_ACCESS_TOKEN || !process.env.LABS_ORIGIN) throw new Error('Payments configuration is missing');
  const db = await getDatabase(); await ensureSchema(db);
  return createPayments(db, { mp: mercadoPagoClient({ accessToken: process.env.LABS_MP_ACCESS_TOKEN }), origin: process.env.LABS_ORIGIN, sendMail: sendAccountMail });
}
