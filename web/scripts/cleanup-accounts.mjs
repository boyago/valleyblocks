import { openDatabase } from '../lib/server/usage-store.mjs';
import { createAccounts } from '../lib/server/accounts.mjs';
import { createPlayStore } from '../lib/server/play-store.mjs';
import { createSignup } from '../lib/server/signup.mjs';
let db;
try {db=await openDatabase();await createAccounts(db).cleanup();await createPlayStore(db).cleanup();await createSignup(db,{}).cleanup();console.log('Sessões expiradas e registros temporários removidos.');}
catch {console.error('Não foi possível limpar registros temporários.');process.exitCode=1;}
finally {if(db)await db.close();}
