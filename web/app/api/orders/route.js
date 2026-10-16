import { requireAccount, authError } from '@/lib/server/auth-http.mjs';
import { json } from '@/lib/server/usage-http.mjs';
import { getPayments, paymentsEnabled } from '@/lib/server/payments-http.mjs';
import { productList } from '@/lib/products.mjs';
export const runtime = 'nodejs';
export async function GET(request) {
  try {
    const { account } = await requireAccount(request);
    if (!paymentsEnabled()) return json({ enabled: false, products: productList(), orders: [] });
    const payments = await getPayments();
    const url = new URL(request.url), check = url.searchParams.get('pedido');
    // Returning from the checkout: re-read pending orders of this account from the provider.
    if (check) { const mine = await payments.listForAccount(account.id); for (const order of mine.filter(o => o.id === check && o.status === 'pending' && o.paymentId)) await payments.reconcilePayment(order.paymentId).catch(() => {}); }
    return json({ enabled: true, products: productList(), orders: await payments.listForAccount(account.id) });
  } catch (error) { return authError(error); }
}
