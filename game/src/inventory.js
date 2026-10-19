import { BLOCKS } from './blocks.js';
import { TOOLS, DURABILITY } from './tools.js';
import { ARMOR, ARMOR_RECIPES, ARMOR_SLOTS, isArmor, protection } from './armor.js';
/** Item IDs remain stable across saved worlds. */
export const ITEMS = Object.freeze(Object.fromEntries([
  [1, 'Grama', '#7aab4b', 'Um chão verde para o seu jardim.'],
  [2, 'Terra', '#936849', 'O começo de qualquer construção.'],
  [3, 'Pedra', '#9ba3a5', 'Resistente: use a picareta para minerar.'],
  [4, 'Areia', '#e3cf92', 'Praias, caminhos e matéria-prima para vidro.'],
  [5, 'Madeira', '#95613b', 'Troncos viram tábuas e ferramentas.'],
  [6, 'Folhas', '#4e913f', 'Vegetação e alimento para os seus companheiros.'],
  [7, 'Vidro', '#9ddbdc', 'Janelas que deixam a luz entrar.'],
  [8, 'Tijolos', '#bb7259', 'Paredes acolhedoras e resistentes.'],
  [9, 'Água', '#4c99c4', 'Um bloco de água para lagos e jardins.'],
  [10, 'Minério de ferro', '#bda493', 'Ferro para ferramentas, baldes e peças.'],
  [11, 'Asfalto', '#424953', 'Construa uma estrada para explorar de carro.'],
  [12, 'Tábuas', '#c39761', 'Pisos, abrigos, baús e bancada.'],
  [13, 'Tocha', '#ffc665', 'Ilumine a casa e as suas aventuras.'],
  [14, 'Porta', '#a97849', 'Coloque e pressione E para abrir ou fechar.'],
  [15, 'Bancada', '#bb8e5e', 'Aproxime-se para fabricar peças e veículos.'],
  [16, 'Baú', '#bd9250', 'Guarde materiais e abra com E.'],
  [17, 'Rampa', '#727c83', 'Ajuda os carros a subir um bloco.'],
  ...BLOCKS.filter(b=>b.id>=18).map(b=>[b.id,b.name,b.color,b.id===28?'Aproxime-se e use E para descansar à noite.':b.id===29?'Use E para ligar ou desligar Paisagens do Vale.':b.id===24?'Churrasqueira de tijolos com grelha. Use E para aquecer materiais com carvão.':'Explore os novos biomas e o subsolo.']),
  ['resin', 'Resina de árvore', '#dba647', 'Aponte para um tronco natural com copa e pressione E.'],
  ['slingshot', 'Estilingue', '#a46f3c', 'Botão esquerdo dispara uma pedrinha. Fabricado na bancada com madeira e resina.'],
  ['pebble', 'Pedrinha', '#a2adb1', 'Munição do estilingue. Uma pedra rende oito pedrinhas.'],
  ['bucket', 'Balde vazio', '#afb8c6', 'Botão direito numa fonte de água para coletar.'],
  ['water_bucket', 'Balde de água', '#52b8df', 'Botão direito para despejar ou encher a bandeja de resfriamento da churrasqueira.'],
  ['iron_ingot', 'Lingote de ferro', '#c9ccd5', 'Produzido na churrasqueira com minério de ferro e carvão.'],
  ['copper_ingot', 'Lingote de cobre', '#d59064', 'Cobre refinado na churrasqueira.'],
  ['gold_ingot', 'Lingote de ouro', '#efc45e', 'Ouro refinado na churrasqueira.'],
  ...Object.values(TOOLS).map(t=>[t.id,t.name,t.color,t.description]),
  ['food', 'Biscoito', '#dc9b64', 'Coma ou ofereça para alimentar e adotar um cachorro ou um gato.'],
  ['raw_chicken', 'Frango cru', '#e7bba1', 'Carne de galinha. Asse na churrasqueira para alimentar melhor.'],
  ['aluminum_ingot', 'Lingote de alumínio', '#cfd6dc', 'Derretido na churrasqueira a partir da bauxita (Minas Gerais).'],
  ['boat', 'Barco de alumínio', '#b9c2c9', 'Botão direito na água ao ar livre para colocar. E embarca e desembarca; WASD navega.'],
  ['trailer', 'Carretinha', '#3d6fa5', 'Botão direito perto de um carro para engatar. E perto dela abre a caçamba.'],
  ['fishing_rod', 'Vara de pesca', '#a46f3c', 'Botão direito na água lança a linha. Quando a boia afundar, botão direito de novo para puxar.'],
  ['raw_lambari', 'Lambari', '#c9d3d6', 'Peixe fresco. Asse na churrasqueira.'],
  ['raw_tilapia', 'Tilápia', '#8f9a8c', 'Peixe fresco. Asse na churrasqueira.'],
  ['raw_tucunare', 'Tucunaré', '#b9b04a', 'Peixe fresco. Asse na churrasqueira.'],
  ['raw_dourado', 'Dourado', '#e3a92c', 'Peixe fresco. Asse na churrasqueira.'],
  ['raw_pirarucu', 'Pirarucu', '#5c6a5a', 'Peixe fresco. Asse na churrasqueira.'],
  ['cooked_fish', 'Peixe assado', '#c98a4a', 'Recupera 32 de saciedade. Botão direito para comer.'],
  ['raw_capivara', 'Carne de capivara crua', '#c99280', 'Prepare na churrasqueira.'],
  ['cooked_capivara', 'Capivara assada', '#9a5f3a', 'Recupera 38 de saciedade. Botão direito para comer.'],
  ['raw_calango', 'Calango cru', '#a6a058', 'Lagarto do Sertão. Asse na churrasqueira.'],
  ['cooked_calango', 'Calango assado', '#a06a3a', 'Recupera 30 de saciedade. Botão direito para comer.'],
  ['cooked_chicken', 'Frango assado', '#bd773e', 'Recupera 30 de saciedade. Botão direito para comer.'],
  ['raw_rabbit', 'Carne de coelho crua', '#cfad96', 'Carne de coelho. Prepare na churrasqueira.'],
  ['cooked_rabbit', 'Coelho assado', '#a97145', 'Recupera 34 de saciedade. Botão direito para comer.'],
  ['raw_boar', 'Carne de javali crua', '#ce9788', 'Carne de javali. Prepare na churrasqueira.'],
  ['leather', 'Couro', '#8a5a2b', 'Pele curtida de javali. Base das armaduras de couro, na bancada.'],
  ...Object.values(ARMOR).map(a=>[a.id,a.name,a.color,a.description]),
  ['cooked_boar', 'Javali assado', '#9f623e', 'Recupera 40 de saciedade. Botão direito para comer.'],
  ['wooden_sword', 'Espada de madeira', '#c39761', 'Golpe de 14. A primeira arma de quem explora à noite.'],
  ['iron_sword', 'Espada de ferro', '#d7e1ec', 'Golpe de 24. Feita com lingotes de ferro.'],
  ['diamond_sword', 'Espada de diamante', '#48e6dc', 'Golpe de 32. A espada mais forte que se fabrica.'],
  ['bow', 'Arco', '#a46f3c', 'Botão esquerdo dispara uma flecha, mais longe e mais forte que o estilingue.'],
  ['arrow', 'Flecha', '#d9d2c0', 'Munição do arco.'],
  ['rifle', 'Espingarda de pressão', '#6b4a2e', 'Botão esquerdo dispara chumbinho bem longe, com luneta. Para caça e defesa.'],
  ['pellet', 'Chumbinho', '#9aa3a8', 'Munição da espingarda de pressão.'],
  ['flask', 'Frasco de vidro', '#bfe6e4', 'Botão direito perto de uma poça verde do Espectro para coletar o ácido.'],
  ['specter_acid', 'Ácido do Espectro', '#9ef24a', 'Coletado com frasco nas poças do Espectro do Lodo. Base do spray de portal.'],
  ['portal_spray', 'Spray de portal', '#7add35', 'Espirre dentro de uma moldura de portal feita de blocos para abrir caminho a outra terra.'],
  ['reaper_scythe', 'Foice do Ceifador', '#c5d9ce', 'Arma rara: cerca de 1 em cada 10 Ceifadores a derruba. Golpe muito forte.'],
  ['wheel', 'Roda', '#454b57', 'Uma peça essencial para o seu veículo.'],
  ['frame', 'Estrutura', '#91a8ac', 'A base de um novo carro.'],
  ['engine', 'Motor', '#d08a66', 'A força para explorar mais longe.'],
  ['car', 'Carro compacto', '#e9b765', 'Selecione e coloque em um espaço livre.'],
  ['utility', 'Utilitário', '#79a9a8', 'Um companheiro para sua próxima expedição.'],
].map(([id, name, color, description]) => [id, Object.freeze({ id, name, color, description })])));

export const STACK_LIMIT = 64;
export const INVENTORY_SLOTS = 54;
const DEFAULT_HOTBAR = Array(9).fill(null);
const validItem = id => Object.hasOwn(ITEMS, id);
const normalizeId = id => validItem(id) ? ITEMS[id].id : null;
const positiveInteger = value => Number.isSafeInteger(value) && value > 0;
const finiteCount = value => Number.isSafeInteger(value) && value >= 0;
const isBlock = id => Number.isInteger(Number(id)) && Number(id) >= 1 && !!BLOCKS[Number(id)];

export class Inventory {
  constructor(mode = 'creative', saved = null) {
    this.mode = mode === 'survival' ? 'survival' : 'creative';
    this.counts = {};
    this.hotbar = [...DEFAULT_HOTBAR];
    this.selected = 0;
    this.wear = {};
    this.equipment = Object.fromEntries(ARMOR_SLOTS.map(slot => [slot, null]));
    if (saved && typeof saved === 'object') {
      for (const slot of ARMOR_SLOTS) { const id = saved.equipment?.[slot]; if (isArmor(id) && ARMOR[id].slot === slot) this.equipment[slot] = id; }
      for (const [id, used] of Object.entries(saved.wear || {})) if (DURABILITY[id] && Number.isInteger(used) && used > 0 && used < DURABILITY[id]) this.wear[id] = used;
      for (const [id, count] of Object.entries(saved.counts || {})) {
        if (validItem(id) && positiveInteger(count)) this.counts[id] = count;
      }
      // Older creative saves already exposed every block. Preserve that collection.
      if (this.mode === 'creative' && saved.version !== 2) {
        for (const block of BLOCKS) if (block.id) this.counts[block.id] = 1;
      }
      if (Array.isArray(saved.hotbar)) {
        this.hotbar = DEFAULT_HOTBAR.map((_, index) => normalizeId(saved.hotbar[index]));
      }
      if (Number.isInteger(saved.selected)) this.select(saved.selected);
    } else {
      this.counts = {};
    }
  }

  count(id) {
    if (!validItem(id)) return 0;
    if (this.mode === 'creative' && isBlock(id) && this.counts[id] > 0) return Infinity;
    return this.counts[id] || 0;
  }

  has(id, amount = 1) { return positiveInteger(amount) && this.count(id) >= amount; }

  add(id, amount = 1) {
    if (!validItem(id) || !positiveInteger(amount)) return false;
    if (this.mode === 'creative' && isBlock(id)) { this.counts[id] = 1; return true; }
    const next = this.count(id) + amount;
    if (!Number.isSafeInteger(next)) return false;
    this.counts[id] = next;
    return true;
  }

  remove(id, amount = 1) {
    if (!validItem(id) || !this.has(id, amount)) return false;
    if (this.mode === 'creative' && isBlock(id)) return true;
    this.counts[id] -= amount;
    if (!this.counts[id]) delete this.counts[id];
    return true;
  }

  /** Gasta a ferramenta em uso. No Criativo nada se desgasta. Quando chega ao limite,
   *  uma unidade quebra e a próxima da pilha começa nova. */
  useTool(id, amount = 1) {
    const max = DURABILITY[id];
    if (!max || this.mode === 'creative' || !this.has(id)) return { broke: false };
    const used = (this.wear[id] || 0) + amount;
    if (used < max) { this.wear[id] = used; return { broke: false, left: max - used }; }
    delete this.wear[id]; this.remove(id);
    return { broke: true, name: ITEMS[id].name };
  }
  /** Veste uma peça da mochila; a que estava no lugar volta para a mochila. */
  equip(id) {
    if (!isArmor(id) || !this.has(id)) return false;
    const slot = ARMOR[id].slot, previous = this.equipment[slot];
    this.remove(id); if (previous) this.add(previous);
    this.equipment[slot] = id; return true;
  }
  unequip(slot) {
    const id = this.equipment[slot]; if (!id) return false;
    this.equipment[slot] = null; this.add(id); return true;
  }
  /** Proteção total do que está vestido (0 a 0,8). */
  get protection() { return protection(this.equipment); }
  /** Cada golpe recebido gasta todas as peças vestidas; devolve as que quebraram. */
  wearArmor(amount = 1) {
    const broken = [];
    if (this.mode === 'creative') return broken;
    for (const slot of ARMOR_SLOTS) {
      const id = this.equipment[slot]; if (!id) continue;
      const used = (this.wear[id] || 0) + amount;
      if (used < DURABILITY[id]) this.wear[id] = used; else { delete this.wear[id]; this.equipment[slot] = null; broken.push(ITEMS[id].name); }
    }
    return broken;
  }
  /** 0 a 1: quanto ainda resta da ferramenta (1 = nova). */
  condition(id) { const max = DURABILITY[id]; return max ? 1 - (this.wear[id] || 0) / max : 1; }

  select(index) {
    if (Number.isInteger(index)) this.selected = ((index % 9) + 9) % 9;
    return this.selectedItem;
  }

  get selectedItem() { return this.hotbar[this.selected]; }

  /** Storage grows by stacks; collected resources are never silently discarded. */
  getStacks() {
    const stacks = [];
    for (const item of Object.values(ITEMS)) {
      let remaining = this.count(item.id);
      if (remaining === Infinity) {
        stacks.push({ id: item.id, count: Infinity });
        continue;
      }
      while (remaining > 0) {
        const count = Math.min(STACK_LIMIT, remaining);
        stacks.push({ id: item.id, count });
        remaining -= count;
      }
    }
    return stacks;
  }

  serialize() {
    return { version: 2, mode: this.mode, counts: { ...this.counts }, hotbar: [...this.hotbar], selected: this.selected, wear: { ...this.wear }, equipment: { ...this.equipment } };
  }
}

export const RECIPES = Object.freeze([
  { id: 'sofa', name: 'Sofá', ingredients: {12:6,6:4}, output:{id:28,count:1}, station:true },
  { id: 'tv', name: 'TV', ingredients: {iron_ingot:2,copper_ingot:2,7:1}, output:{id:29,count:1}, station:true },
  { id: 'slingshot', name: 'Estilingue', ingredients: {5:1,resin:1}, output:{id:'slingshot',count:1}, station:true },
  { id: 'flask', name: 'Dois frascos', ingredients: { 7: 1 }, output: { id: 'flask', count: 2 }, station: false },
  { id: 'portal_spray', name: 'Spray de portal', ingredients: { specter_acid: 2, iron_ingot: 1, flask: 1 }, output: { id: 'portal_spray', count: 1 }, station: true },
  { id: 'copper_block', name: 'Bloco de cobre', ingredients: { copper_ingot: 1, 3: 1 }, output: { id: 30, count: 1 }, station: true },
  { id: 'diamond_block', name: 'Dois blocos de diamante', ingredients: { 25: 1, 3: 2 }, output: { id: 35, count: 2 }, station: true },
  { id: 'ruby_block', name: 'Dois blocos de rubi', ingredients: { 39: 1, 3: 2 }, output: { id: 40, count: 2 }, station: true },
  { id: 'gold_block', name: 'Bloco de ouro', ingredients: { gold_ingot: 1, 3: 1 }, output: { id: 42, count: 1 }, station: true },
  { id: 'uranium_block', name: 'Dois blocos de urânio', ingredients: { 44: 1, 3: 2 }, output: { id: 45, count: 2 }, station: true },
  { id: 'wooden_sword', name: 'Espada de madeira', ingredients: { 12: 3 }, output: { id: 'wooden_sword', count: 1 }, station: false },
  { id: 'iron_sword', name: 'Espada de ferro', ingredients: { iron_ingot: 2, 12: 1 }, output: { id: 'iron_sword', count: 1 }, station: true },
  { id: 'diamond_sword', name: 'Espada de diamante', ingredients: { 25: 2, 12: 1 }, output: { id: 'diamond_sword', count: 1 }, station: true },
  { id: 'bow', name: 'Arco', ingredients: { 5: 2, resin: 2 }, output: { id: 'bow', count: 1 }, station: true },
  { id: 'arrows', name: 'Oito flechas', ingredients: { 12: 1, 3: 1, 6: 1 }, output: { id: 'arrow', count: 8 }, station: true },
  { id: 'emerald_block', name: 'Dois blocos de esmeralda', ingredients: { 37: 1, 3: 2 }, output: { id: 51, count: 2 }, station: true },
  { id: 'obsidian_block', name: 'Duas obsidianas', ingredients: { 3: 2, 18: 1, 21: 1 }, output: { id: 53, count: 2 }, station: true },
  { id: 'shovel', name: 'Pá de ferro', ingredients: { iron_ingot: 1, 12: 2 }, output: { id: 'shovel', count: 1 }, station: true },
  { id: 'rifle', name: 'Espingarda de pressão', ingredients: { iron_ingot: 3, 12: 2, 7: 1 }, output: { id: 'rifle', count: 1 }, station: true },
  { id: 'pellets', name: 'Dezesseis chumbinhos', ingredients: { iron_ingot: 1 }, output: { id: 'pellet', count: 16 }, station: true },
  { id: 'fishing_rod', name: 'Vara de pesca', ingredients: { 5: 2, resin: 1 }, output: { id: 'fishing_rod', count: 1 }, station: false },
  { id: 'boat', name: 'Barco de alumínio', ingredients: { aluminum_ingot: 4, 12: 3, engine: 1 }, output: { id: 'boat', count: 1 }, station: true },
  { id: 'trailer', name: 'Carretinha', ingredients: { frame: 1, wheel: 2, 12: 4 }, output: { id: 'trailer', count: 1 }, station: true },
  { id: 'calcadao', name: 'Quatro pedras portuguesas', ingredients: { 3: 3, 18: 1 }, output: { id: 58, count: 4 }, station: true },
  { id: 'steel_block', name: 'Bloco de aço', ingredients: { iron_ingot: 2, 18: 1 }, output: { id: 60, count: 1 }, station: true },
  { id: 'pebbles', name: 'Oito pedrinhas', ingredients:{3:1},output:{id:'pebble',count:8},station:false },
  { id: 'planks', name: 'Tábuas de madeira', ingredients: { 5: 1 }, output: { id: 12, count: 4 }, station: false },
  { id: 'workbench', name: 'Bancada de criação', ingredients: { 12: 4 }, output: { id: 15, count: 1 }, station: false },
  { id: 'wooden_pickaxe', name: 'Picareta de madeira', ingredients: { 12: 5 }, output: { id: 'wooden_pickaxe', count: 1 }, station: false },
  { id: 'pickaxe', name: 'Picareta de pedra', ingredients: { 12: 2, 3: 3 }, output: { id: 'pickaxe', count: 1 }, station: false },
  { id: 'iron_pickaxe', name: 'Picareta de ferro', ingredients: { 12: 2, iron_ingot: 3 }, output: { id: 'iron_pickaxe', count: 1 }, station: true },
  { id: 'diamond_pickaxe', name: 'Picareta de diamante', ingredients: { 12: 2, 25: 3 }, output: { id: 'diamond_pickaxe', count: 1 }, station: true },
  { id: 'wooden_axe', name: 'Machado de madeira', ingredients: { 12: 4 }, output: { id: 'wooden_axe', count: 1 }, station: false },
  { id: 'axe', name: 'Machado de pedra', ingredients: { 12: 2, 3: 2 }, output: { id: 'axe', count: 1 }, station: false },
  { id: 'iron_axe', name: 'Machado de ferro', ingredients: { 12: 2, iron_ingot: 3 }, output: { id: 'iron_axe', count: 1 }, station: true },
  { id: 'diamond_axe', name: 'Machado de diamante', ingredients: { 12: 2, 25: 3 }, output: { id: 'diamond_axe', count: 1 }, station: true },
  { id: 'torch', name: 'Quatro tochas', ingredients: { 5: 1, 3: 1 }, output: { id: 13, count: 4 }, station: false },
  { id: 'door', name: 'Porta de madeira', ingredients: { 12: 4 }, output: { id: 14, count: 1 }, station: false },
  { id: 'chest', name: 'Baú', ingredients: { 12: 8 }, output: { id: 16, count: 1 }, station: false },
  { id: 'brick', name: 'Quatro tijolos', ingredients: { 2: 2, 3: 1 }, output: { id: 8, count: 4 }, station: false },
  { id: 'glass', name: 'Quatro vidros', ingredients: { 4: 4, 3: 1 }, output: { id: 7, count: 4 }, station: false },
  { id: 'bucket', name: 'Balde', ingredients: { 10: 3 }, output: { id: 'bucket', count: 1 }, station: true },
  { id: 'bucket-refined', name: 'Balde de ferro refinado', ingredients: { iron_ingot: 1 }, output: { id: 'bucket', count: 1 }, station: true },
  { id: 'charcoal', name: 'Carvão de madeira', ingredients: { 5: 2 }, output: { id: 18, count: 1 }, station: false },
  { id: 'forge', name: 'Churrasqueira doméstica', ingredients: { 8: 8, 10: 2 }, output: { id: 24, count: 1 }, station: true },
  { id: 'asphalt', name: 'Oito blocos de asfalto', ingredients: { 3: 4, 4: 2 }, output: { id: 11, count: 8 }, station: false },
  { id: 'ramp', name: 'Quatro rampas', ingredients: { 3: 4, 12: 2 }, output: { id: 17, count: 4 }, station: false },
  { id: 'food', name: 'Quatro biscoitos', ingredients: { 6: 3 }, output: { id: 'food', count: 4 }, station: false },
  { id: 'wheel', name: 'Duas rodas', ingredients: { 3: 4, 10: 1 }, output: { id: 'wheel', count: 2 }, station: true },
  { id: 'frame', name: 'Estrutura do veículo', ingredients: { 10: 6, 12: 4 }, output: { id: 'frame', count: 1 }, station: true },
  { id: 'engine', name: 'Motor', ingredients: { 10: 8, 3: 4 }, output: { id: 'engine', count: 1 }, station: true },
  { id: 'car', name: 'Carro compacto', ingredients: { wheel: 4, frame: 1, engine: 1, 7: 2 }, output: { id: 'car', count: 1 }, station: true },
  { id: 'utility', name: 'Veículo utilitário', ingredients: { wheel: 4, frame: 2, engine: 1, 7: 3, 16: 1 }, output: { id: 'utility', count: 1 }, station: true },
  ...ARMOR_RECIPES,
].map(recipe => Object.freeze({ ...recipe, ingredients: Object.freeze(recipe.ingredients), output: Object.freeze(recipe.output) })));

export function craft(recipeId, inventory, atWorkbench = false) {
  const recipe = RECIPES.find(entry => entry.id === recipeId);
  if (!recipe || !(inventory instanceof Inventory)) return { ok: false, message: 'Receita indisponível.' };
  if (recipe.station && !atWorkbench) return { ok: false, message: 'Aproxime-se de uma bancada para fabricar esta peça.' };
  const missing = Object.entries(recipe.ingredients).filter(([id, count]) => !inventory.has(id, count));
  if (missing.length) {
    return { ok: false, message: `Falta: ${missing.map(([id, count]) => `${count - inventory.count(id)} ${ITEMS[id].name.toLowerCase()}`).join(', ')}.` };
  }
  // Commit a complete trial inventory only after the output can be accepted.
  const trial = new Inventory(inventory.mode, inventory.serialize());
  for (const [id, count] of Object.entries(recipe.ingredients)) trial.remove(id, count);
  if (!trial.add(recipe.output.id, recipe.output.count)) return { ok: false, message: 'Não foi possível guardar o item.' };
  inventory.counts = trial.counts;
  return { ok: true, message: `${ITEMS[recipe.output.id].name} criado!`, output: { ...recipe.output } };
}

/** Atomic transfer between Inventory instances and plain { itemId: quantity } chests/trunks. */
export function transferItems(source, target, id, amount = 1) {
  const failure = message => ({ ok: false, message, moved: 0 });
  if (source === target) return failure('Escolha outro recipiente.');
  if (!validItem(id) || !positiveInteger(amount) || !source || !target || typeof source !== 'object' || typeof target !== 'object') {
    return failure('Transferência inválida.');
  }
  const fromInventory = source instanceof Inventory;
  const toInventory = target instanceof Inventory;
  const sourceCounts = fromInventory ? source.counts : source;
  const targetCounts = toInventory ? target.counts : target;
  if (sourceCounts === targetCounts) return failure('Escolha outro recipiente.');
  const from = fromInventory ? source.count(id) : (source[id] ?? 0);
  const to = toInventory ? target.count(id) : (target[id] ?? 0);
  if ((!finiteCount(from) && !(fromInventory && from === Infinity)) || (!finiteCount(to) && !(toInventory && to === Infinity)) || from < amount) return failure('Quantidade indisponível.');
  if (to !== Infinity && !Number.isSafeInteger(to + amount)) return failure('O recipiente está cheio.');
  const sourceProperty = Object.getOwnPropertyDescriptor(sourceCounts, id);
  const targetProperty = Object.getOwnPropertyDescriptor(targetCounts, id);
  const sourceWritable = from === Infinity || (sourceProperty && 'value' in sourceProperty && sourceProperty.writable && (from !== amount || sourceProperty.configurable));
  const targetWritable = to === Infinity || (targetProperty ? 'value' in targetProperty && targetProperty.writable : Object.isExtensible(targetCounts));
  if (!sourceWritable || !targetWritable) {
    return failure('O recipiente não está disponível.');
  }
  // There is no async work between these writes. Preflight guarantees both fit.
  if (fromInventory) source.remove(id, amount);
  else if (from === amount) delete source[id];
  else source[id] = from - amount;
  if (toInventory) target.add(id, amount);
  else target[id] = to + amount;
  return { ok: true, message: `${amount} ${ITEMS[id].name.toLowerCase()} transferido(s).`, moved: amount };
}
