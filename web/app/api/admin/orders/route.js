import { requireAccount, authError, readBody } from '@/lib/server/auth-http.mjs';
import { json } from '@/lib/server/usage-http.mjs';
import { getPayments, paymentsEnabled } from '@/lib/server/payments-http.mjs';
import { AccountError } from '@/lib/server/accounts.mjs';
import { productList } from '@/lib/products.mjs';
export const runtime = 'nodejs';
export async function GET(request) {
  try {
    await requireAccount(request, 'admin');
    if (!paymentsEnabled()) return json({ enabled: false, products: productList() });
    const page = Math.min(1000, Math.max(1, Number.parseInt(new URL(request.url).searchParams.get('page') || '1', 10) || 1));
    const payments = await getPayments();
    return json({ enabled: true, products: productList(), ...(await payments.adminReport(undefined, { page })) });
  } catch (error) { return authError(error); }
}
// Devolução (reembolso total) de um pedido pago.
export async function POST(request) {
  try {
    const body = await readBody(request), { account } = await requireAccount(request, 'admin');
    if (body.action !== 'refund') throw new AccountError('Ação inválida.');
    if (!paymentsEnabled()) throw new AccountError('Pagamentos desligados.', 503);
    return json(await (await getPayments()).refundOrder(account.id, body.id));
  } catch (error) { return authError(error); }
}
// Exclusão de pedido de teste/abandonado (nunca de um pedido pago).
export async function DELETE(request) {
  try {
    const body = await readBody(request), { account } = await requireAccount(request, 'admin');
    if (!paymentsEnabled()) throw new AccountError('Pagamentos desligados.', 503);
    await (await getPayments()).deleteOrder(account.id, body.id);
    return json({ ok: true });
  } catch (error) { return authError(error); }
}
