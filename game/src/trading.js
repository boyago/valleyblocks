// Comércio com os vendedores de rua (Tríplice Fronteira), inspirado nas trocas
// dos aldeões: a moeda é a esmeralda (bloco 37), que o jogador consegue minerando
// ou vendendo o que coleta. Cada vendedor tem uma banca com ofertas próprias e
// estoque que se renova com o tempo, para a troca não virar fonte infinita.
import { ITEMS } from './inventory.js';

export const EMERALD = 37;
export const RESTOCK_SECONDS = 240;

/** Bancas: o tipo vem do número do vendedor, então o mesmo vendedor sempre vende o mesmo. */
export const STALLS = Object.freeze([
  Object.freeze({ id: 'ferragens', name: 'Ferragens do Seu Ramón', greeting: 'Ferramenta boa e barata, amigo! Olha só.', offers: Object.freeze([
    { id: 'buy-iron-pickaxe', give: { [EMERALD]: 6 }, get: { iron_pickaxe: 1 }, stock: 2 },
    { id: 'buy-shovel', give: { [EMERALD]: 4 }, get: { shovel: 1 }, stock: 2 },
    { id: 'buy-bucket', give: { [EMERALD]: 3 }, get: { bucket: 1 }, stock: 3 },
    { id: 'buy-fishing-rod', give: { [EMERALD]: 2 }, get: { fishing_rod: 1 }, stock: 3 },
    { id: 'sell-iron', give: { iron_ingot: 4 }, get: { [EMERALD]: 1 }, stock: 8 },
    { id: 'sell-copper', give: { copper_ingot: 6 }, get: { [EMERALD]: 1 }, stock: 8 },
  ]) }),
  Object.freeze({ id: 'comidas', name: 'Chipa da Doña Rosa', greeting: 'Chipa quentinha, peixe assado! Prova, prova.', offers: Object.freeze([
    { id: 'buy-food', give: { [EMERALD]: 1 }, get: { food: 6 }, stock: 6 },
    { id: 'buy-fish', give: { [EMERALD]: 1 }, get: { cooked_fish: 3 }, stock: 6 },
    { id: 'buy-boar', give: { [EMERALD]: 2 }, get: { cooked_boar: 3 }, stock: 4 },
    { id: 'sell-lambari', give: { raw_lambari: 5 }, get: { [EMERALD]: 1 }, stock: 8 },
    { id: 'sell-tilapia', give: { raw_tilapia: 3 }, get: { [EMERALD]: 1 }, stock: 8 },
    { id: 'sell-pirarucu', give: { raw_pirarucu: 1 }, get: { [EMERALD]: 3 }, stock: 3 },
  ]) }),
  Object.freeze({ id: 'importados', name: 'Importados do Paco', greeting: 'Tudo original, garantia de três dias!', offers: Object.freeze([
    { id: 'buy-portal-spray', give: { [EMERALD]: 8 }, get: { portal_spray: 1 }, stock: 1 },
    { id: 'buy-glass', give: { [EMERALD]: 1 }, get: { 7: 16 }, stock: 6 },
    { id: 'buy-torches', give: { [EMERALD]: 1 }, get: { 13: 12 }, stock: 6 },
    { id: 'buy-pellets', give: { [EMERALD]: 1 }, get: { pellet: 24 }, stock: 6 },
    { id: 'sell-gold', give: { gold_ingot: 2 }, get: { [EMERALD]: 1 }, stock: 8 },
    { id: 'sell-diamond', give: { 25: 1 }, get: { [EMERALD]: 2 }, stock: 6 },
  ]) }),
]);

export const stallFor = serial => STALLS[Math.abs(Math.trunc(Number(serial) || 0)) % STALLS.length];
const entries = side => Object.entries(side).map(([id, n]) => [/^\d+$/.test(id) ? Number(id) : id, n]);
export const describe = side => entries(side).map(([id, n]) => `${n} ${ITEMS[id]?.name || id}`).join(' + ');

/** Estoque restante de uma oferta, guardado por vendedor (`ledger[stallKey][offerId] = vendidos`). */
export function remaining(ledger, key, offer) { return Math.max(0, offer.stock - (ledger?.[key]?.[offer.id] || 0)); }

/** Faz a troca se houver itens e estoque; retorna { ok, message }. Não altera nada quando falha. */
export function trade(inventory, ledger, key, offer) {
  if (!offer) return { ok: false, message: 'Essa oferta não existe.' };
  if (remaining(ledger, key, offer) <= 0) return { ok: false, message: 'Acabou o estoque. Volte daqui a pouco.' };
  const missing = entries(offer.give).filter(([id, n]) => !inventory.has(id, n));
  if (missing.length) return { ok: false, message: `Falta: ${missing.map(([id, n]) => `${n - inventory.count(id)} ${ITEMS[id]?.name || id}`).join(', ')}.` };
  for (const [id, n] of entries(offer.give)) inventory.remove(id, n);
  const added = entries(offer.get).every(([id, n]) => inventory.add(id, n));
  if (!added) { // mochila cheia: desfaz
    for (const [id, n] of entries(offer.get)) inventory.remove(id, Math.min(n, inventory.count(id)));
    for (const [id, n] of entries(offer.give)) inventory.add(id, n);
    return { ok: false, message: 'Sua mochila está cheia.' };
  }
  ledger[key] = ledger[key] || {}; ledger[key][offer.id] = (ledger[key][offer.id] || 0) + 1;
  return { ok: true, message: `Negócio fechado: ${describe(offer.get)}.` };
}

/** Repõe uma unidade de cada oferta a cada RESTOCK_SECONDS. */
export function restock(ledger, elapsed) {
  for (const key of Object.keys(ledger || {})) for (const id of Object.keys(ledger[key])) {
    ledger[key][id] = Math.max(0, ledger[key][id] - Math.floor(elapsed / RESTOCK_SECONDS));
    if (!ledger[key][id]) delete ledger[key][id];
  }
}
