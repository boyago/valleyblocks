import { dayKey } from '../usage-policy.mjs';
import { AccountError } from './accounts.mjs';
const DAY = /^\d{4}-\d{2}-\d{2}$/;
// ?from=AAAA-MM-DD&to=AAAA-MM-DD (dias de Brasília, inclusivos). Padrão: últimos 7 dias. Máximo 400 dias.
export function parseRange(params, now = Date.now()) {
  const today = dayKey(now), from = params.get('from') || dayKey(now - 6 * 86400000), to = params.get('to') || today;
  if (!DAY.test(from) || !DAY.test(to) || from > to || Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to))) throw new AccountError('Período inválido.');
  if ((Date.parse(to) - Date.parse(from)) / 86400000 > 400) throw new AccountError('Escolha um período de até 400 dias.');
  return { from, to };
}
