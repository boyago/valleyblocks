import { getUsageStore } from '@/lib/server/usage-store.mjs';
import { identifyVisitor, json, parseUsageBody } from '@/lib/server/usage-http.mjs';
import { allowUsageRequest } from '@/lib/server/usage-rate-limit.mjs';
import { clientKey } from '@/lib/server/auth-http.mjs';
export const runtime = 'nodejs';

export async function POST(request) {
  if (process.env.LABS_USAGE_ENABLED !== 'true') return json({ enabled: false });
  const expectedOrigin = process.env.LABS_ORIGIN;
  if (!expectedOrigin || request.headers.get('origin') !== expectedOrigin) return json({ error: 'Origem não permitida.' }, 403);
  if (!request.headers.get('content-type')?.startsWith('application/json')) return json({ error: 'Formato inválido.' }, 415);
  try {
    // Bound the streamed body, including requests without Content-Length.
    const reader = request.body?.getReader();let text = '', bytes = 0;
    if (!reader) return json({ error: 'Evento inválido.' }, 400);
    const decoder = new TextDecoder();
    while (true) {
      const { value, done } = await reader.read();if (done) break;
      bytes += value.length;if (bytes > 1024) { await reader.cancel();return json({ error: 'Evento muito grande.' }, 413); }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    let input;
    try { input = parseUsageBody(JSON.parse(text)); } catch { return json({ error: 'Evento inválido.' }, 400); }
    const visitor = identifyVisitor(request, process.env.LABS_USAGE_SECRET);
    const ip = clientKey(request);
    // Invalid/missing cookie: the fresh random id is worthless as a key, so rate-limit by IP.
    if (!allowUsageRequest('usage', visitor.cookie ? 'ipv:' + ip : visitor.hash, ip)) return json({ error: 'Aguarde para tentar novamente.' }, 429);
    const store = await getUsageStore();
    const result = await store.record(visitor.hash, input);
    return json({ enabled: true, ...result }, 200, visitor.cookie);
  } catch (error) {
    // Never expose a database address, credential, SQL or driver error to the client.
    console.error("[labs] usage error:", /^[A-Z0-9_]+$/.test(error?.code||"")?error.code:(error?.name||"UNKNOWN"));
    return json({ error: 'Medição temporariamente indisponível.' }, 503);
  }
}
