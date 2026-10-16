import { getDatabase } from '@/lib/server/usage-store.mjs';
import { getAccounts, AccountError } from '@/lib/server/accounts.mjs';
import { sessionToken, readBody, authError } from '@/lib/server/auth-http.mjs';
import { json } from '@/lib/server/usage-http.mjs';
import { createWorldStore, worldBinding, verifyWorldBinding, MAX_WORLD_BYTES } from '@/lib/server/world-store.mjs';
import { allowUsageRequest } from '@/lib/server/usage-rate-limit.mjs';
export const runtime = 'nodejs';

export async function POST(request) {
  try {
    if (process.env.LABS_WORLDS_ENABLED !== 'true') throw new AccountError('O salvamento remoto está indisponível.', 503);
    const body = await readBody(request, MAX_WORLD_BYTES + 4096);
    const accounts = await getAccounts(), account = await accounts.session(sessionToken(request));
    // Visitors keep the existing browser save. No guest world or placeholder row.
    if (!account) {
      if (body.action === 'load') return json({ localOnly: true });
      throw new AccountError('Entre na sua conta para salvar o mundo na nuvem.', 401);
    }
    if (!account.cloudSave) {
      if (body.action === 'load') return json({ localOnly: true, account: true });
      throw new AccountError('Sua conta não tem salvamento na nuvem liberado. Sua cópia local foi preservada.', 403);
    }
    const owner = 'user:' + account.id;
    if (!allowUsageRequest('world', owner)) return json({ error: 'Aguarde um momento antes de salvar novamente.' }, 429);
    const store = createWorldStore(await getDatabase());
    const binding = worldBinding(owner, process.env.LABS_USAGE_SECRET);
    let result;
    if (body.action === 'load') {
      result = await store.load(owner);
      result = { ...result, binding, account: true };
    } else {
      verifyWorldBinding(owner, body.binding, process.env.LABS_USAGE_SECRET);
      if (body.action === 'save') result = await store.save(owner, body);
      else throw new AccountError('Operação de mundo inválida.');
    }
    return json(result);
  } catch (error) { return authError(error); }
}
