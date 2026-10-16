import { readBody, requireAccount, authError, clientKey } from '@/lib/server/auth-http.mjs';
import { json } from '@/lib/server/usage-http.mjs';
import { getPayments } from '@/lib/server/payments-http.mjs';
import { allowUsageRequest } from '@/lib/server/usage-rate-limit.mjs';
import { AccountError } from '@/lib/server/accounts.mjs';
import { claimValue } from '@/lib/server/payments.mjs';
const CLAIM_COOKIE = 'labs_claim';
export const runtime = 'nodejs';
export async function POST(request) {
  try {
    const body = await readBody(request);
    let account = null;
    try { ({ account } = await requireAccount(request)); } catch (error) { if (error?.status !== 401) throw error; }
    const product = String(body.product || ''), coupon = typeof body.coupon === 'string' ? body.coupon.slice(0, 40) : '';
    const payments = await getPayments();
    if (account) {
      if (!allowUsageRequest('checkout:' + account.id)) return json({ error: 'Aguarde um momento antes de tentar novamente.' }, 429);
      return json(await payments.checkout(account, product, coupon), 201);
    }
    // No session: buying with an e-mail creates (or finds a passwordless) account; the password comes from the link sent after payment.
    if (typeof body.email !== 'string' || !body.email.trim()) throw new AccountError('Entre na sua conta ou informe seu e-mail para comprar.', 401);
    const client = clientKey(request);
    if (!allowUsageRequest('checkout:guest:' + client)) return json({ error: 'Aguarde um momento antes de tentar novamente.' }, 429);
    const { claimable, ...result } = await payments.guestCheckout({ email: body.email.slice(0, 254), product, coupon, client });
    // Cookie de claim só quando este checkout criou a conta; contas já existentes ativam pelo e-mail.
    if (!claimable) return json(result, 201);
    const cookie = `${CLAIM_COOKIE}=${claimValue(result.orderId, process.env.LABS_USAGE_SECRET)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=172800${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
    return json(result, 201, cookie);
  } catch (error) { return authError(error); }
}
