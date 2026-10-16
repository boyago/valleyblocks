import { openDatabase } from '../lib/server/usage-store.mjs';
import { AUTH_SCHEMA } from '../lib/server/accounts.mjs';
import { PLAY_SCHEMA } from '../lib/server/play-store.mjs';
import { SIGNUP_SCHEMA } from '../lib/server/signup.mjs';
import { PAYMENT_SCHEMA } from '../lib/server/payments.mjs';
let db;
try { db=await openDatabase();for(const sql of [...AUTH_SCHEMA,...PLAY_SCHEMA,...SIGNUP_SCHEMA,...PAYMENT_SCHEMA])await db.query(sql);console.log('Tabelas de contas e tempo diário preparadas.'); }
catch { console.error('Falha ao preparar contas. Verifique configuração e permissões.');process.exitCode=1; }
finally { if(db)await db.close(); }
