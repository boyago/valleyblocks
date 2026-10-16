import { json } from '@/lib/server/usage-http.mjs';
import { getPayments, paymentsEnabled } from '@/lib/server/payments-http.mjs';
import { verifyWebhookSignature } from '@/lib/server/payments.mjs';
import { allowUsageRequest } from '@/lib/server/usage-rate-limit.mjs';
export const runtime = 'nodejs';
// Called by Mercado Pago (no browser Origin). The signature is required; the
// payment is always re-read from the provider API before any benefit changes.
export async function POST(request) {
  if (!paymentsEnabled()) return json({ ok: false }, 503);
  try {
    const url = new URL(request.url);
    let body = {};
    try { const text = await request.text(); if (text.length <= 8192) body = JSON.parse(text || '{}'); } catch { body = {}; }
    const dataId = url.searchParams.get('data.id') || url.searchParams.get('id') || body?.data?.id || '';
    const type = url.searchParams.get('type') || url.searchParams.get('topic') || body?.type || body?.action || '';
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(String(dataId))) return json({ ok: true, ignored: 'no-id' });
    const secret = process.env.LABS_MP_WEBHOOK_SECRET;
    if (!secret) { console.error('[labs] webhook secret missing'); return json({ ok: false }, 503); }
    if (!verifyWebhookSignature({ signature: request.headers.get('x-signature'), requestId: request.headers.get('x-request-id'), dataId: String(dataId), secret })) {
      // Só requisições com assinatura inválida contam no limite: o provedor legítimo nunca é bloqueado.
      if (!allowUsageRequest('webhook:invalid')) return json({ ok: false }, 429);
      return json({ error: 'Assinatura inválida.' }, 401);
    }
    if (!/payment/i.test(String(type))) return json({ ok: true, ignored: 'type' });
    const payments = await getPayments();
    const result = await payments.reconcilePayment(String(dataId), { eventId: `mp:${dataId}:${request.headers.get('x-request-id') || body?.id || Date.now()}` });
    return json({ ok: true, ...result });
  } catch (error) {
    // Simulations and foreign ids: acknowledge so the provider stops retrying.
    if (error?.code === 'MP_404') return json({ ok: true, ignored: 'payment-not-found' });
    console.error('[labs] webhook error:', /^[A-Z0-9_]+$/.test(error?.code || '') ? error.code : (error?.name || 'UNKNOWN'));
    return json({ ok: false }, 500);
  }
}
