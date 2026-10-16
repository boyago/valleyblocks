import { openDatabase, SCHEMA } from '../lib/server/usage-store.mjs';
let db;
try { db = await openDatabase();for (const sql of SCHEMA) await db.query(sql);console.log('Tabelas de medição preparadas. Nenhum dado existente foi removido.'); }
catch { console.error('Não foi possível preparar as tabelas. Verifique a conexão e as permissões do banco.');process.exitCode = 1; }
finally { if (db) await db.close(); }
