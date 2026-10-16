import { getUsageStore } from '@/lib/server/usage-store.mjs';
import { json } from '@/lib/server/usage-http.mjs';
import { requireAccount, authError } from '@/lib/server/auth-http.mjs';
export const runtime = 'nodejs';
export async function GET(request) {
  try {
    await requireAccount(request,'admin');
    const store = await getUsageStore();
    if (!store) return json({ error: 'Medição ainda não configurada.' }, 503);
    return json(await store.report());
  } catch(error) { return authError(error); }
}
