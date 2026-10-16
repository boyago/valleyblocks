import { getDatabase } from '@/lib/server/usage-store.mjs';
import { getAccounts, AccountError } from '@/lib/server/accounts.mjs';
import { sessionToken, readBody, authError, clientKey } from '@/lib/server/auth-http.mjs';
import { identifyVisitor, json, parseUsageBody, ipGuestOwner } from '@/lib/server/usage-http.mjs';
import { createPlayStore } from '@/lib/server/play-store.mjs';
import { createSignup } from '@/lib/server/signup.mjs';
import { allowUsageRequest } from '@/lib/server/usage-rate-limit.mjs';
export const runtime='nodejs';
export async function POST(request) {
  if(process.env.LABS_PLAY_ENABLED!=='true')return json({allowed:true,enabled:false});
  try{
    const body=await readBody(request);let input;
    try{input=parseUsageBody(body);}catch{throw new AccountError('Evento inválido.');}
    const visitor=identifyVisitor(request,process.env.LABS_USAGE_SECRET,'labs_player');
    const ip=clientKey(request),accounts=await getAccounts(),account=await accounts.session(sessionToken(request));
    // Accounts: own budget. Guests with an invalid/missing cookie: keyed by IP (fresh ids are free).
    const key=account?'user:'+account.id:visitor.cookie?'ipguest:'+ip:visitor.hash;
    if(!allowUsageRequest('play',key,account?null:ip))return json({error:'Aguarde um momento.'},429);
    const db=await getDatabase();
    // Hourly opportunistic cleanup; keeps the pilot working without a cron job.
    const state=globalThis[Symbol.for('labs.play.cleanup')]||={at:0};
    if(Date.now()-state.at>3600000){state.at=Date.now();Promise.all([createPlayStore(db).cleanup(),accounts.cleanup(),createSignup(db,{}).cleanup()]).catch(()=>{});}
    const store=createPlayStore(db),guest='guest:'+visitor.hash,owner=account?'user:'+account.id:guest;
    if(account)await store.claimGuest(guest,owner);
    const result=await store.record(owner,input,{account:!!account,unlimited:!!account?.unlimited,ipOwner:account?null:ipGuestOwner(ip,process.env.LABS_USAGE_SECRET)});
    return json({enabled:true,...result},200,visitor.cookie);
  }catch(error){return authError(error);}
}
