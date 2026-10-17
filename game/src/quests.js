// Livro de missões: pedidos curtos que dão motivo para viajar entre as terras.
// Tipos: "deliver" entrega itens a um morador; "visit" chega a uma terra; "visits"
// conta terras visitadas; "goal" acompanha um marco do jogo (game.goals). As que não
// são de entrega ficam "prontas" sozinhas e a recompensa é recebida no livro.
import { EMERALD, describe, RESIDENTS } from './trading.js';
import { REALMS } from './realms.js';

export const QUESTS = Object.freeze([
  { id: 'primeira-troca', kind: 'goal', goal: 'trade', title: 'Primeiro negócio', text: 'Faça uma troca com um vendedor ou morador.', reward: { [EMERALD]: 2 } },
  { id: 'chegar-triplice', kind: 'visit', realm: 'triplice', title: 'Rumo à fronteira', text: 'Monte um portal de blocos de esmeralda e chegue à Tríplice Fronteira.', reward: { [EMERALD]: 3 } },
  { id: 'calangos', kind: 'deliver', giver: 'sertao', need: { raw_calango: 3 }, title: 'Calango pro almoço', text: 'Zé do Gibão, no Sertão, quer 3 calangos crus.', reward: { [EMERALD]: 3 } },
  { id: 'aluminio', kind: 'deliver', giver: 'minas', need: { aluminum_ingot: 2 }, title: 'Panela de alumínio', text: 'Dona Lia, em Minas, precisa de 2 lingotes de alumínio.', reward: { [EMERALD]: 4 } },
  { id: 'rubis', kind: 'deliver', giver: 'china', need: { 39: 2 }, title: 'Lanterna de rubi', text: 'Mestre Wei, na China, pede 2 rubis para uma lanterna.', reward: { [EMERALD]: 4 } },
  { id: 'peixe-assado', kind: 'deliver', giver: 'japao', need: { cooked_fish: 3 }, title: 'Festival da pesca', text: 'Aiko, no Japão, quer 3 peixes assados para o festival.', reward: { [EMERALD]: 3 } },
  { id: 'uranio', kind: 'deliver', giver: 'eua', need: { 44: 1 }, title: 'Pedra que brilha', text: 'Hank, no cânion dos Estados Unidos, quer ver 1 urânio.', reward: { [EMERALD]: 4 } },
  { id: 'lambaris', kind: 'deliver', giver: 'rio', need: { raw_lambari: 4 }, title: 'Isca de Copacabana', text: 'Seu Jorge, no Rio, precisa de 4 lambaris.', reward: { [EMERALD]: 3 } },
  { id: 'ouro', kind: 'deliver', giver: 'nyc', need: { gold_ingot: 2 }, title: 'Carrinho dourado', text: 'Tony, em Nova York, quer 2 lingotes de ouro.', reward: { [EMERALD]: 4 } },
  { id: 'viajante', kind: 'visits', count: 5, title: 'Viajante', text: 'Visite 5 terras diferentes.', reward: { [EMERALD]: 6, portal_spray: 1 } },
]);

const key = id => (/^\d+$/.test(id) ? Number(id) : id);
const entries = side => Object.entries(side).map(([id, n]) => [key(id), n]);
export const questFor = giver => QUESTS.find(q => q.kind === 'deliver' && q.giver === giver);

/** Estado salvo: { claimed: {id:true}, visited: {realm:true} }. */
export function normalize(saved) {
  const s = saved && typeof saved === 'object' ? saved : {};
  return { claimed: { ...(s.claimed || {}) }, visited: { ...(s.visited || {}) } };
}

/** 'done' (recompensa recebida), 'ready' (pode receber no livro) ou 'open'. */
export function status(q, state, goals = {}) {
  if (state.claimed[q.id]) return 'done';
  if (q.kind === 'goal') return goals[q.goal] ? 'ready' : 'open';
  if (q.kind === 'visit') return state.visited[q.realm] ? 'ready' : 'open';
  if (q.kind === 'visits') return Object.keys(state.visited).length >= q.count ? 'ready' : 'open';
  return 'open';
}

export function progress(q, state, inventory) {
  if (q.kind === 'visits') return `${Math.min(q.count, Object.keys(state.visited).length)}/${q.count} terras`;
  if (q.kind === 'deliver') return entries(q.need).map(([id, n]) => `${Math.min(n, inventory.count(id))}/${n}`).join(' · ');
  return '';
}

export const where = q => REALMS[q.giver || q.realm]?.name || '';
export const rewardText = q => describe(q.reward);
export const giverName = q => RESIDENTS[q.giver]?.name || '';

const pay = (inventory, q) => entries(q.reward).every(([id, n]) => inventory.add(id, n));

/** Recebe a recompensa de uma missão pronta (visita ou marco). */
export function claim(q, state, inventory, goals) {
  if (!q || status(q, state, goals) !== 'ready') return { ok: false, message: 'Essa missão ainda não terminou.' };
  if (!pay(inventory, q)) return { ok: false, message: 'Sua mochila está cheia.' };
  state.claimed[q.id] = true;
  return { ok: true, message: `Missão cumprida: ${q.title}! Você ganhou ${rewardText(q)}.` };
}

/** Entrega os itens de uma missão ao morador. Não altera nada quando falha. */
export function deliver(q, state, inventory) {
  if (!q || q.kind !== 'deliver') return { ok: false, message: 'Essa missão não existe.' };
  if (state.claimed[q.id]) return { ok: false, message: 'Você já cumpriu essa missão.' };
  const missing = entries(q.need).filter(([id, n]) => !inventory.has(id, n));
  if (missing.length) return { ok: false, message: `Ainda falta: ${missing.map(([id, n]) => describe({ [id]: n - inventory.count(id) })).join(', ')}.` };
  for (const [id, n] of entries(q.need)) inventory.remove(id, n);
  if (!pay(inventory, q)) { for (const [id, n] of entries(q.need)) inventory.add(id, n); return { ok: false, message: 'Sua mochila está cheia.' }; }
  state.claimed[q.id] = true;
  return { ok: true, message: `Missão cumprida: ${q.title}! Você ganhou ${rewardText(q)}.` };
}
