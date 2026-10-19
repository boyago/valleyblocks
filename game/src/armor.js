// Armaduras: capacete, peitoral, calça e botas em couro, ferro e diamante.
// Reduzem o dano dos inimigos da noite no Sobrevivência e gastam como as ferramentas.
export const ARMOR_SLOTS = Object.freeze(['head', 'chest', 'legs', 'feet']);
export const SLOT_NAMES = Object.freeze({ head: 'Cabeça', chest: 'Peito', legs: 'Pernas', feet: 'Pés' });
/** Peso de cada peça na proteção total (soma 1). */
const SLOT_WEIGHT = Object.freeze({ head: .2, chest: .4, legs: .25, feet: .15 });
const PIECES = Object.freeze({ head: ['helmet', 'Capacete'], chest: ['chest', 'Peitoral'], legs: ['legs', 'Calça'], feet: ['boots', 'Botas'] });

export const ARMOR_MATERIALS = Object.freeze({
  leather: { name: 'couro', protection: .2, durability: 120, color: '#8a5a2b', trim: '#5e3d1c', cost: { head: 5, chest: 8, legs: 7, feet: 4 }, ingredient: 'leather' },
  iron: { name: 'ferro', protection: .45, durability: 320, color: '#c9ccd5', trim: '#7d838f', cost: { head: 5, chest: 8, legs: 7, feet: 4 }, ingredient: 'iron_ingot' },
  diamond: { name: 'diamante', protection: .65, durability: 900, color: '#48e6dc', trim: '#1f9c94', cost: { head: 5, chest: 8, legs: 7, feet: 4 }, ingredient: 25 },
});

/** Todas as peças: id -> { id, name, slot, material, color, description }. */
export const ARMOR = Object.freeze(Object.fromEntries(Object.entries(ARMOR_MATERIALS).flatMap(([material, m]) =>
  ARMOR_SLOTS.map(slot => {
    const [suffix, label] = PIECES[slot], id = `${material}_${suffix}`;
    const of = material === 'leather' ? 'de couro' : material === 'iron' ? 'de ferro' : 'de diamante';
    return [id, Object.freeze({ id, name: `${label} ${of}`, slot, material, color: m.color, protection: m.protection * SLOT_WEIGHT[slot], durability: m.durability,
      description: `Protege ${Math.round(m.protection * SLOT_WEIGHT[slot] * 100)}% do dano dos inimigos. Vista pela mochila (Tab); gasta a cada golpe recebido.` })];
  }))));

export const ARMOR_DURABILITY = Object.freeze(Object.fromEntries(Object.values(ARMOR).map(a => [a.id, a.durability])));

/** Receitas das 12 peças, na bancada. */
export const ARMOR_RECIPES = Object.freeze(Object.values(ARMOR).map(a => {
  const m = ARMOR_MATERIALS[a.material];
  return Object.freeze({ id: a.id, name: a.name, ingredients: Object.freeze({ [m.ingredient]: m.cost[a.slot] }), output: Object.freeze({ id: a.id, count: 1 }), station: true });
}));

export const isArmor = id => Object.hasOwn(ARMOR, id);

/** Proteção total (0 a 0,8) de um conjunto { head, chest, legs, feet } de ids. */
export function protection(equipment) {
  let total = 0;
  for (const slot of ARMOR_SLOTS) { const piece = ARMOR[equipment?.[slot]]; if (piece && piece.slot === slot) total += piece.protection; }
  return Math.min(.8, total);
}
