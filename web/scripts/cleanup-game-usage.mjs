import { openDatabase, createUsageStore } from '../lib/server/usage-store.mjs';
let db;
try { db = await openDatabase();await createUsageStore(db).cleanup();console.log('Retenção de 30 dias aplicada à medição.'); }
catch { console.error('Não foi possível aplicar a retenção. Verifique a conexão e as permissões do banco.');process.exitCode = 1; }
finally { if (db) await db.close(); }
