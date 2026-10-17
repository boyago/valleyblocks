// Conta no app Android/iOS (Capacitor). O app roda em outra origem (https://localhost,
// capacitor://localhost), então não usa o cookie do site: recebe um token de sessão e
// o manda em Authorization: Bearer. Mesma tabela de sessões, limites e verificação de
// e-mail do login do site; só a duração é maior, para não pedir senha toda hora.
import { getAccounts, AccountError } from '@/lib/server/accounts.mjs';
import { readBody, bearerToken, authError, clientKey } from '@/lib/server/auth-http.mjs';
import { getDatabase } from '@/lib/server/usage-store.mjs';
import { createSignup } from '@/lib/server/signup.mjs';
import { sendAccountMail } from '@/lib/server/mail.mjs';
export const runtime='nodejs';
export const APP_ORIGINS=['https://localhost','capacitor://localhost'];
const APP_SESSION=30*24*3600000;

function cors(request,response) {
  const origin=request.headers.get('origin');
  if (APP_ORIGINS.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin',origin);
    response.headers.set('Vary','Origin');
  }
  return response;
}
const reply=(request,body,status=200)=>cors(request,Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}}));
const fail=(request,error)=>cors(request,authError(error));
const signup=async()=>createSignup(await getDatabase(),{sendMail:sendAccountMail,origin:process.env.LABS_ORIGIN});

export async function OPTIONS(request) {
  const response=new Response(null,{status:204});
  if (APP_ORIGINS.includes(request.headers.get('origin'))) {
    response.headers.set('Access-Control-Allow-Methods','GET, POST');
    response.headers.set('Access-Control-Allow-Headers','Content-Type, Authorization');
    response.headers.set('Access-Control-Max-Age','600');
  }
  return cors(request,response);
}

export async function GET(request,{params}) {
  try {
    if ((await params).action!=='me') throw new AccountError('Não encontrado.',404);
    if (!APP_ORIGINS.includes(request.headers.get('origin'))) throw new AccountError('Origem não permitida.',403);
    const accounts=await getAccounts(), account=await accounts.session(bearerToken(request));
    if (!account) return reply(request,{account:null});
    let entitlements={outfits:[]};
    try { entitlements=await accounts.entitlements(account.id); } catch { /* roupas pagas ficam travadas se a consulta falhar */ }
    return reply(request,{account:{username:account.username,unlimited:account.unlimited,entitlements}});
  } catch(error){return fail(request,error);}
}

export async function POST(request,{params}) {
  try {
    const {action}=await params, body=await readBody(request,4096,APP_ORIGINS), accounts=await getAccounts(), client=clientKey(request);
    if (action==='login') {
      await accounts.rateLimit('public-auth:'+client,60);
      await accounts.rateLimit('public-auth',20000);
      const result=await accounts.login(body.username,body.password,Date.now(),client,APP_SESSION);
      if (process.env.LABS_SIGNUP_ENABLED==='true') {
        try { await (await signup()).requireVerified(result.account.id); }
        catch (error) { await accounts.logout(result.token); throw error; }
      }
      let entitlements={outfits:[]};
      try { entitlements=await accounts.entitlements(result.account.id); } catch { /* idem */ }
      return reply(request,{token:result.token,expiresAt:result.expiresAt,account:{username:result.account.username,unlimited:result.account.unlimited,entitlements}});
    }
    if (action==='logout') { await accounts.logout(bearerToken(request)); return reply(request,{ok:true}); }
    throw new AccountError('Não encontrado.',404);
  } catch(error){return fail(request,error);}
}
