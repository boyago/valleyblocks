import { readBody, sessionCookie, authError, clientKey } from '@/lib/server/auth-http.mjs';
import { json } from '@/lib/server/usage-http.mjs';
import { getPayments } from '@/lib/server/payments-http.mjs';
import { readClaim } from '@/lib/server/payments.mjs';
import { AccountError, getAccounts } from '@/lib/server/accounts.mjs';
export const runtime = 'nodejs';
// Only the browser holding the signed claim cookie of a paid guest order can set the first password here.
export async function POST(request) {
  try {
    const body = await readBody(request);
    const raw = (request.headers.get('cookie') || '').split(';').map(v => v.trim()).find(v => v.startsWith('labs_claim='))?.slice(11);
    const orderId = readClaim(raw, process.env.LABS_USAGE_SECRET);
    if (!orderId || body.pedido !== orderId) throw new AccountError('Use o link enviado para o seu e-mail.', 403);
    await (await getAccounts()).rateLimit('claim:' + clientKey(request), 10);
    const result = await (await getPayments()).claimOrder(orderId, body.password);
    const headers = new Headers({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    headers.append('Set-Cookie', sessionCookie(result.token));
    headers.append('Set-Cookie', `labs_claim=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
    return Response.json({ ok: true }, { status: 200, headers });
  } catch (error) { return authError(error); }
}
