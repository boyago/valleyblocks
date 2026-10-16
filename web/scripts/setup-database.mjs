// Cria todas as tabelas da plataforma ValleyBlocks no banco apontado por LABS_MYSQL_* (ou SQLite via LABS_USAGE_SQLITE_PATH).
// Idempotente: usa CREATE TABLE IF NOT EXISTS. Não apaga nem migra dados do portal LABSGames.
import { openDatabase, SCHEMA } from '../lib/server/usage-store.mjs';
import { AUTH_SCHEMA } from '../lib/server/accounts.mjs';
import { PLAY_SCHEMA } from '../lib/server/play-store.mjs';
import { WORLD_SCHEMA } from '../lib/server/world-store.mjs';
import { SIGNUP_SCHEMA } from '../lib/server/signup.mjs';
import { PAYMENT_SCHEMA } from '../lib/server/payments.mjs';
let db;
try {
  db = await openDatabase();
  const groups = [['medição', SCHEMA], ['contas', AUTH_SCHEMA], ['tempo diário', PLAY_SCHEMA], ['mundos', WORLD_SCHEMA], ['cadastro/e-mail', SIGNUP_SCHEMA], ['pagamentos', PAYMENT_SCHEMA]];
  for (const [name, schema] of groups) { for (const sql of schema) await db.query(sql); console.log(`✓ ${name} (${schema.length} comandos)`); }
  console.log('Banco do ValleyBlocks preparado.');
} catch (error) { console.error('Falha ao preparar o banco:', error?.code || error?.message); process.exitCode = 1; }
finally { if (db) await db.close(); }
