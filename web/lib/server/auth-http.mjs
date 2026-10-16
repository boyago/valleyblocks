import { AccountError, getAccounts } from './accounts.mjs';
import { json } from './usage-http.mjs';
const COOKIE='labs_session';
export function sessionToken(request) { return (request.headers.get('cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(COOKIE+'='))?.slice(COOKIE.length+1); }
export function sessionCookie(token='') { return `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${token?43200:0}${process.env.NODE_ENV==='production'?'; Secure':''}`; }
// Valor mais à direita, acrescentado pelo proxy confiável. LABS_TRUSTED_PROXIES diz quantos
// proxies extras (além do primeiro) ficam na frente do Node. O que o cliente manda fica à esquerda.
export function clientKey(request) {
  const hops=(request.headers.get('x-forwarded-for')||'').split(',').map(v=>v.trim()).filter(Boolean);
  const skip=Math.max(0,Math.min(5,Number(process.env.LABS_TRUSTED_PROXIES)||0));
  return (hops[hops.length-1-skip]||request.headers.get('x-real-ip')||'unknown').slice(0,64);
}
export async function requireAccount(request, role) {
  const accounts=await getAccounts(), account=await accounts.session(sessionToken(request));
  if (!account) throw new AccountError('Entre na sua conta para continuar.',401);
  if (role && account.role!==role) throw new AccountError('Acesso administrativo necessário.',403);
  return {accounts,account};
}
export async function readBody(request, max=4096) {
  if (!process.env.LABS_ORIGIN || request.headers.get('origin')!==process.env.LABS_ORIGIN) throw new AccountError('Origem não permitida.',403);
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new AccountError('Formato inválido.',415);
  const reader=request.body?.getReader();if (!reader) throw new AccountError('Dados inválidos.');
  const chunks=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw new AccountError('Solicitação muito grande.',413);}chunks.push(value);}
  try {const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!data||typeof data!=='object'||Array.isArray(data))throw Error();return data;}
  catch {throw new AccountError('Dados inválidos.');}
}
export function authError(error) {
  // Operational diagnostics only: error codes never include SQL, hosts or credentials.
  if (!(error instanceof AccountError)) console.error("[labs] backend error:", /^[A-Z0-9_]+$/.test(error?.code||"")?error.code:(error?.name||"UNKNOWN"));
  return json({error:error instanceof AccountError?error.message:'Serviço temporariamente indisponível.'},error instanceof AccountError?error.status:503); }
