import { getDatabase } from '../lib/server/usage-store.mjs';
import { WORLD_SCHEMA } from '../lib/server/world-store.mjs';
const db = await getDatabase();
try { for (const sql of WORLD_SCHEMA) await db.query(sql); console.log('Remote world table created/verified.'); }
finally { await db.close(); }
