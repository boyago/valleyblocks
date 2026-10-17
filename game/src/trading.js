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

/** Um morador por terra, perto do portal de chegada. Cada um vende o que é típico dali e entrega uma missão. */
export const RESIDENTS = Object.freeze({
  sertao: Object.freeze({ id: 'sertao', name: 'Zé do Gibão, vaqueiro', shirt: '#9c5a2c', greeting: 'Oxente, visita! Sertão é duro, mas é generoso com quem trabalha.', offers: Object.freeze([
    { id: 'sertao-sell-calango', give: { raw_calango: 3 }, get: { [EMERALD]: 1 }, stock: 8 },
    { id: 'sertao-buy-calango', give: { [EMERALD]: 1 }, get: { cooked_calango: 3 }, stock: 5 },
    { id: 'sertao-buy-copper', give: { [EMERALD]: 2 }, get: { 30: 2 }, stock: 4 },
    { id: 'sertao-sell-copper', give: { copper_ingot: 4 }, get: { [EMERALD]: 1 }, stock: 8 },
  ]) }),
  minas: Object.freeze({ id: 'minas', name: 'Dona Lia, garimpeira', shirt: '#2f6f8f', greeting: 'Uai, sô! Nessas grutas tem pedra que brilha mais que estrela.', offers: Object.freeze([
    { id: 'minas-sell-topaz', give: { 38: 2 }, get: { [EMERALD]: 1 }, stock: 8 },
    { id: 'minas-sell-aluminum', give: { aluminum_ingot: 3 }, get: { [EMERALD]: 1 }, stock: 8 },
    { id: 'minas-buy-diamond-pickaxe', give: { [EMERALD]: 14 }, get: { diamond_pickaxe: 1 }, stock: 1 },
    { id: 'minas-buy-capivara', give: { [EMERALD]: 1 }, get: { cooked_capivara: 3 }, stock: 5 },
  ]) }),
  china: Object.freeze({ id: 'china', name: 'Mestre Wei, artesão', shirt: '#b23a3a', greeting: 'Paciência e bambu: com os dois, se constrói uma muralha.', offers: Object.freeze([
    { id: 'china-buy-bamboo', give: { [EMERALD]: 1 }, get: { 47: 16 }, stock: 6 },
    { id: 'china-buy-lacquer', give: { [EMERALD]: 1 }, get: { 48: 12 }, stock: 6 },
    { id: 'china-sell-ruby', give: { 39: 2 }, get: { [EMERALD]: 1 }, stock: 8 },
    { id: 'china-buy-iron-sword', give: { [EMERALD]: 7 }, get: { iron_sword: 1 }, stock: 1 },
  ]) }),
  japao: Object.freeze({ id: 'japao', name: 'Aiko, pescadora', shirt: '#e98fb2', greeting: 'O rio ensina a esperar. E o peixe ensina a puxar na hora certa!', offers: Object.freeze([
    { id: 'japao-buy-sakura', give: { [EMERALD]: 1 }, get: { 49: 12 }, stock: 6 },
    { id: 'japao-sell-dourado', give: { raw_dourado: 2 }, get: { [EMERALD]: 1 }, stock: 8 },
    { id: 'japao-sell-tucunare', give: { raw_tucunare: 2 }, get: { [EMERALD]: 1 }, stock: 8 },
    { id: 'japao-buy-fish', give: { [EMERALD]: 1 }, get: { cooked_fish: 4 }, stock: 5 },
  ]) }),
  eua: Object.freeze({ id: 'eua', name: 'Hank, guia do cânion', shirt: '#c96a3a', greeting: 'Howdy! A Rota 66 é longa; leve munição e água.', offers: Object.freeze([
    { id: 'eua-buy-rifle', give: { [EMERALD]: 10 }, get: { rifle: 1 }, stock: 1 },
    { id: 'eua-buy-pellets', give: { [EMERALD]: 1 }, get: { pellet: 32 }, stock: 6 },
    { id: 'eua-buy-redrock', give: { [EMERALD]: 1 }, get: { 50: 16 }, stock: 6 },
    { id: 'eua-sell-uranium', give: { 44: 1 }, get: { [EMERALD]: 2 }, stock: 6 },
  ]) }),
  rio: Object.freeze({ id: 'rio', name: 'Seu Jorge do mate', shirt: '#f2c14e', greeting: 'Olha o mate, olha o biscoito! Copacabana tá linda hoje.', offers: Object.freeze([
    { id: 'rio-buy-food', give: { [EMERALD]: 1 }, get: { food: 8 }, stock: 6 },
    { id: 'rio-buy-calcadao', give: { [EMERALD]: 1 }, get: { 58: 16 }, stock: 6 },
    { id: 'rio-sell-lambari', give: { raw_lambari: 4 }, get: { [EMERALD]: 1 }, stock: 8 },
    { id: 'rio-buy-boat', give: { [EMERALD]: 6 }, get: { boat: 1 }, stock: 1 },
  ]) }),
  nyc: Object.freeze({ id: 'nyc', name: 'Tony do cachorro-quente', shirt: '#3a5a9c', greeting: 'Hey! Hot dog, pretzel, o que você precisar. Aqui tudo é rápido!', offers: Object.freeze([
    { id: 'nyc-buy-chicken', give: { [EMERALD]: 1 }, get: { cooked_chicken: 3 }, stock: 6 },
    { id: 'nyc-buy-steel', give: { [EMERALD]: 2 }, get: { 60: 8 }, stock: 4 },
    { id: 'nyc-sell-gold', give: { gold_ingot: 2 }, get: { [EMERALD]: 1 }, stock: 8 },
    { id: 'nyc-buy-trailer', give: { [EMERALD]: 5 }, get: { trailer: 1 }, stock: 1 },
  ]) }),
});
export const residentFor = realm => RESIDENTS[realm] || null;

/** Repõe uma unidade de cada oferta a cada RESTOCK_SECONDS. */
export function restock(ledger, elapsed) {
  for (const key of Object.keys(ledger || {})) for (const id of Object.keys(ledger[key])) {
    ledger[key][id] = Math.max(0, ledger[key][id] - Math.floor(elapsed / RESTOCK_SECONDS));
    if (!ledger[key][id]) delete ledger[key][id];
  }
}
