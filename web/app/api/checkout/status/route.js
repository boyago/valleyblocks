import { sessionToken, clientKey, authError } from '@/lib/server/auth-http.mjs';
import { json } from '@/lib/server/usage-http.mjs';
import { getPayments } from '@/lib/server/payments-http.mjs';
import { readClaim } from '@/lib/server/payments.mjs';
import { getAccounts } from '@/lib/server/accounts.mjs';
import { allowUsageRequest } from '@/lib/server/usage-rate-limit.mjs';
export const runtime = 'nodejs';
const claimOf = request => (request.headers.get('cookie') || '').split(';').map(v => v.trim()).find(v => v.startsWith('labs_claim='))?.slice(11);
// Return page polling: the order must belong to the signed-in account or to this browser's claim cookie.
export async function GET(request) {
  try {
    if (!allowUsageRequest('order-status:' + clientKey(request))) return json({ error: 'Aguarde um momento.' }, 429);
    const url = new URL(request.url), claimed = readClaim(claimOf(request), process.env.LABS_USAGE_SECRET);
    const orderId = url.searchParams.get('pedido') || claimed;
    if (!orderId || !/^[0-9a-f-]{36}$/.test(orderId)) return json({ order: null });
    const payments = await getPayments();
    let order = await payments.orderStatus(orderId);
    if (!order) return json({ order: null });
    const account = await (await getAccounts()).session(sessionToken(request));
    if (account?.id !== order.accountId && claimed !== orderId) return json({ order: null });
    // Back from Mercado Pago with a payment id: re-read it from the provider (it is only applied if it references this order).
    const paymentId = url.searchParams.get('payment_id') || url.searchParams.get('collection_id');
    if (order.status === 'pending' && paymentId && /^[0-9]{1,20}$/.test(paymentId)) { await payments.reconcilePayment(paymentId).catch(() => {}); order = await payments.orderStatus(orderId); }
    // Usuário só para o dono logado ou para o navegador que criou a conta neste pedido (não revela contas existentes).
    const owner = account?.id === order.accountId, claimer = claimed === orderId && order.claimable;
    return json({ order: { orderId: order.orderId, status: order.status, product: order.product, ...(owner || claimer ? { username: order.username } : {}), needsPassword: order.needsPassword && claimer } });
  } catch (error) { return authError(error); }
}
