import { getAccounts, AccountError } from '@/lib/server/accounts.mjs';
import { readBody, requireAccount, sessionToken, sessionCookie, authError, clientKey } from '@/lib/server/auth-http.mjs';
import { json } from '@/lib/server/usage-http.mjs';
import { getDatabase } from '@/lib/server/usage-store.mjs';
import { createSignup } from '@/lib/server/signup.mjs';
import { sendAccountMail } from '@/lib/server/mail.mjs';
export const runtime='nodejs';
const SIGNUP_ACTIONS=['register','verify','recover','reset','resend'];
async function getSignup() {
  if (process.env.LABS_SIGNUP_ENABLED!=='true') throw new AccountError('O cadastro público ainda não está aberto.',503);
  return createSignup(await getDatabase(),{sendMail:sendAccountMail,origin:process.env.LABS_ORIGIN});
}
export async function GET(request,{params}) {
  try {
    if ((await params).action!=='me') throw new AccountError('Não encontrado.',404);
    const accounts=await getAccounts(), account=await accounts.session(sessionToken(request));
    let profile=null;
    if (account && process.env.LABS_SIGNUP_ENABLED==='true') profile=await createSignup(await getDatabase(),{sendMail:sendAccountMail,origin:process.env.LABS_ORIGIN}).profile(account.id);
    let entitlements={outfits:[]};
    if (account) { try { entitlements=await accounts.entitlements(account.id); } catch { /* cosmetics stay locked if the query fails */ } }
    return json({account:account?{...account,email:profile?.email||null,emailVerified:profile?.verified??null,minor:profile?.minor??null,entitlements}:null});
  } catch(error){return authError(error);}
}
export async function POST(request,{params}) {
  try {
    const body=await readBody(request), {action}=await params, accounts=await getAccounts(), client=clientKey(request);
    // Shared DB-backed budget bounds expensive password operations across workers.
    if (['login','activate',...SIGNUP_ACTIONS].includes(action)) {
      await accounts.rateLimit('public-auth:'+client,60);
      await accounts.rateLimit('public-auth',20000);
    }
    if (SIGNUP_ACTIONS.includes(action)) {
      const signup=await getSignup();
      // Per client: 5 sign-ups / 10 e-mails per 15 minutes slow abuse of the mailbox.
      await accounts.rateLimit('signup:'+action+':'+client, action==='register'?5:10);
      if (action==='register') { const result=await signup.register({name:body.username,password:body.password,email:body.email,birthDate:body.birthDate,guardianEmail:body.guardianEmail||undefined}); return json({ok:true,username:result.username,sentTo:result.sentTo},201); }
      if (action==='verify') { await signup.verify(body.token); return json({ok:true}); }
      if (action==='resend') { await signup.resend(body.email); return json({ok:true}); }
      if (action==='recover') { await signup.recover(body.email); return json({ok:true}); }
      if (action==='reset') { await signup.reset(body.token,body.password); return json({ok:true}); }
    }
    if (action==='login') {
      const result=await accounts.login(body.username,body.password,Date.now(),client);
      if (process.env.LABS_SIGNUP_ENABLED==='true') {
        // Do not leave a usable session behind when the e-mail is still unconfirmed.
        try { await createSignup(await getDatabase(),{sendMail:sendAccountMail,origin:process.env.LABS_ORIGIN}).requireVerified(result.account.id); }
        catch (error) { await accounts.logout(result.token); throw error; }
      }
      await accounts.logout(sessionToken(request));
      return json({account:result.account},200,sessionCookie(result.token));
    }
    if (action==='activate') {const result=await accounts.activate(body.token,body.password);await accounts.logout(sessionToken(request));return json({ok:true,loggedIn:true},200,sessionCookie(result.token));}
    if (action==='logout') {await accounts.logout(sessionToken(request));return json({ok:true},200,sessionCookie());}
    if (action==='password') {
      const {account}=await requireAccount(request);await accounts.changePassword(account.id,body.currentPassword,body.password);
      return json({ok:true},200,sessionCookie());
    }
    throw new AccountError('Não encontrado.',404);
  } catch(error){return authError(error);}
}
