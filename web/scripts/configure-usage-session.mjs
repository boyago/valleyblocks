// Receives a connection only through hidden stdin. Never writes credentials.
import { spawn } from 'node:child_process';
import { openDatabase, SCHEMA } from '../lib/server/usage-store.mjs';
import { AUTH_SCHEMA, createAccounts, hashPassword, verifyPassword } from '../lib/server/accounts.mjs';
import { PLAY_SCHEMA } from '../lib/server/play-store.mjs';
import { WORLD_SCHEMA } from '../lib/server/world-store.mjs';
import { SIGNUP_SCHEMA } from '../lib/server/signup.mjs';
import { PAYMENT_SCHEMA } from '../lib/server/payments.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
process.stdin.setRawMode?.(true);process.stdin.setEncoding('utf8');process.stdin.resume();
console.log('Ready for hidden database configuration on stdin.');
let input='';
const inputTimeout = setTimeout(() => { console.error('Configuration input timed out.');process.exit(1); }, 60000);
process.stdin.on('data', async chunk => {
  if (chunk.includes('\u0003')) process.exit(130);
  input+=chunk;
  if (!/[\r\n]/.test(input)) return;
  clearTimeout(inputTimeout);
  process.stdin.removeAllListeners('data');process.stdin.pause();
  let database;
  try {
    const config=JSON.parse(input.trim());input='';
    const env={...process.env,...config.env};
    const timeout=setTimeout(() => { console.error('Database operation timed out.');process.exit(1); },45000);
    database=await openDatabase(env);
    await database.query('SELECT 1 AS connection_ok');
    console.log('MySQL connection verified.');
    if(config.diagnoseAccount){
      const rows=await database.query('SELECT username,role,password_hash,disabled FROM labs_accounts WHERE username=?',[config.diagnoseAccount]);
      console.log(JSON.stringify(rows.map(row=>({username:row.username,role:row.role,disabled:!!row.disabled,activated:!!row.password_hash,hashLength:row.password_hash?.length,hashFormatValid:/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(row.password_hash||'')}))));
      const probe=randomBytes(24).toString('hex'),encoded=await hashPassword(probe);
      const [roundtrip]=await database.query('SELECT ? AS encoded',[encoded]);
      console.log(JSON.stringify({mysqlHashRoundtrip:await verifyPassword(probe,roundtrip.encoded)}));
    }
    if(config.migrate){for(const sql of SCHEMA)await database.query(sql);console.log('Usage tables created/verified.');}
    if(config.accounts){for(const sql of AUTH_SCHEMA)await database.query(sql);console.log('Account tables created/verified.');}
    if(config.play){for(const sql of PLAY_SCHEMA)await database.query(sql);console.log('Play quota tables created/verified.');}
    if(config.signup){for(const sql of SIGNUP_SCHEMA)await database.query(sql);console.log('Sign-up tables created/verified.');}
    if(config.payments){for(const sql of PAYMENT_SCHEMA)await database.query(sql);console.log('Payment tables created/verified.');}
    if(config.worlds){for(const sql of WORLD_SCHEMA)await database.query(sql);console.log('Remote world table created/verified.');}
    if(config.verifyWorlds){
      const {verifyWorlds}=await import('./verify-worlds.mjs');
      await verifyWorlds(database,env.LABS_ORIGIN);
    }
    if(config.admin){
      const result=await createAccounts(database).invite({name:config.admin,initialAdmin:true});
      // Only this one-use activation link is delivered to the owner. No password is generated.
      console.log(JSON.stringify({username:result.account.username,activationUrl:`${env.LABS_ORIGIN}/conta/ativar#token=${result.token}`,expiresAt:result.expiresAt}));
    }
    if(config.devPort && !env.LABS_USAGE_SECRET) {
      // Only a generated development signing key is persisted, never database credentials.
      // Stable across restarts so visitors keep access to their worlds.
      await mkdir('.local',{recursive:true});
      try { await writeFile('.local/player-signing.key',randomBytes(32).toString('hex'),{flag:'wx',mode:0o600}); }
      catch(error){if(error.code!=='EEXIST')throw error;}
      env.LABS_USAGE_SECRET=(await readFile('.local/player-signing.key','utf8')).trim();
      if(!/^[a-f0-9]{64}$/.test(env.LABS_USAGE_SECRET))throw Error('Invalid development signing key');
    }
    await database.close();database=null;clearTimeout(timeout);
    if(config.devPort){
      const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port',String(config.devPort)],{env,stdio:'inherit',windowsHide:true});
      child.on('exit',code=>process.exit(code||0));
    }else process.exit(0);
  }catch(error){
    // Codes are useful diagnostics; driver messages may contain credentials.
    console.error('Database operation failed:', /^[A-Z0-9_]+$/.test(error.code||'')?error.code:'CONFIGURATION_ERROR');
    if(database)await database.close();process.exit(1);
  }
});
