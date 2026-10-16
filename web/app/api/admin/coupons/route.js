import { readBody, requireAccount, authError } from '@/lib/server/auth-http.mjs';
import { json } from '@/lib/server/usage-http.mjs';
import { getPayments } from '@/lib/server/payments-http.mjs';
export const runtime = 'nodejs';
// Cupons: só administradores criam, listam e desligam. O desconto é aplicado no servidor no checkout.
export async function GET(request) {
  try { await requireAccount(request, 'admin'); return json({ coupons: await (await getPayments()).listCoupons() }); }
  catch (error) { return authError(error); }
}
export async function POST(request) {
  try {
    const body = await readBody(request), { account } = await requireAccount(request, 'admin');
    const coupon = await (await getPayments()).createCoupon(account.id, { code: body.code, percentOff: body.percentOff, product: body.product ? String(body.product) : null, maxUses: body.maxUses, expiresAt: body.expiresAt ? String(body.expiresAt) : null, note: body.note });
    return json({ coupon }, 201);
  } catch (error) { return authError(error); }
}
export async function PATCH(request) {
  try {
    const body = await readBody(request), { account } = await requireAccount(request, 'admin');
    await (await getPayments()).setCouponDisabled(account.id, String(body.code || ''), body.disabled);
    return json({ ok: true });
  } catch (error) { return authError(error); }
}
