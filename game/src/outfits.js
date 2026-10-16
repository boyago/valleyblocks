/**
 * Aparências do explorador. Cada uma troca a paleta das partes do avatar e pode
 * adicionar um acessório de cabeça modelado no Blender (src/assets/outfit-models.json).
 * Aparências são cosméticas: não alteram progressão, tempo ou salvamento.
 */
export const OUTFIT_PACKS = Object.freeze({
  base: Object.freeze({ name: 'Explorador', product: null, price: '' }),
  expedicao: Object.freeze({ name: 'Pacote Expedição', product: 'vale-aparencias-expedicao', price: 'R$ 9,90', description: 'Quatro aparências com acessórios exclusivos: Capitão do Vale, Minerador, Guarda-florestal e Astronauta de Bloco.' }),
});

const BASE = { jacket: '#287b79', sleeve: '#287b79', zipper: '#ecdba8', pocket: '#346965', belt: '#584637', buckle: '#dab861', hair: '#45352f', cap: '#d7b46c', visor: '#957146', scarf: '#e2ac48', scarfTail: '#e2ac48', backpack: '#9c633d', backpackTop: '#c49254', strap: '#77563b', pants: '#d5c7a1', boots: '#493e38', skin: '#bf8667', hand: '#bf8667' };

export const OUTFITS = Object.freeze({
  explorer: { name: 'Explorador', pack: 'base', palette: BASE, accessory: null, description: 'Jaqueta curta, lenço âmbar e mochila de campo.' },
  captain: { name: 'Capitão do Vale', pack: 'expedicao', accessory: 'captain', hideCap: true, description: 'Casaco azul-marinho, lenço branco e boné de capitão.',
    palette: { ...BASE, jacket: '#1f2f5c', sleeve: '#1f2f5c', zipper: '#d9a63a', pocket: '#172447', belt: '#2b2b33', buckle: '#d9a63a', scarf: '#f1efe6', scarfTail: '#f1efe6', backpack: '#4a4a52', backpackTop: '#6b6b74', strap: '#2b2b33', pants: '#e8e6dc', boots: '#1b1b1f' } },
  miner: { name: 'Minerador', pack: 'expedicao', accessory: 'hardhat', hideCap: true, description: 'Colete laranja refletivo, capacete com lanterna e botas reforçadas.',
    palette: { ...BASE, jacket: '#e8702a', sleeve: '#4a4f57', zipper: '#f7f3d6', pocket: '#f2c230', belt: '#2f2a26', buckle: '#a5b7c1', scarf: '#4a4f57', scarfTail: '#4a4f57', backpack: '#5b5146', backpackTop: '#7a6c5c', strap: '#2f2a26', pants: '#5a6270', boots: '#2b2420' } },
  ranger: { name: 'Guarda-florestal', pack: 'expedicao', accessory: 'ranger', hideCap: true, description: 'Uniforme verde-musgo, chapéu de aba larga e mochila de couro.',
    palette: { ...BASE, jacket: '#4f6b3a', sleeve: '#4f6b3a', zipper: '#c8a24b', pocket: '#3c5330', belt: '#3f2d1c', buckle: '#c8a24b', scarf: '#8a6a3f', scarfTail: '#8a6a3f', backpack: '#6b4a2b', backpackTop: '#8a6a3f', strap: '#3f2d1c', pants: '#8c8362', boots: '#3a2a1c' } },
  astronaut: { name: 'Astronauta de Bloco', pack: 'expedicao', accessory: 'astronaut', hideCap: true, description: 'Traje branco com detalhes dourados e capacete com visor.',
    palette: { ...BASE, jacket: '#eef0f2', sleeve: '#eef0f2', zipper: '#e0b24a', pocket: '#c9ced3', belt: '#8b949c', buckle: '#e0b24a', scarf: '#8b949c', scarfTail: '#8b949c', backpack: '#c9ced3', backpackTop: '#8b949c', strap: '#8b949c', pants: '#eef0f2', boots: '#8b949c', hand: '#eef0f2' } },
});

export const DEFAULT_OUTFIT = 'explorer';
export const outfitList = () => Object.entries(OUTFITS).map(([id, o]) => ({ id, ...o }));
/** `owned` lists pack ids the portal confirmed for this account; the base pack is always owned. */
export function outfitAvailable(id, owned = []) { const outfit = OUTFITS[id]; return !!outfit && (outfit.pack === 'base' || owned.includes(outfit.pack)); }
export function resolveOutfit(id, owned = []) { return outfitAvailable(id, owned) ? id : DEFAULT_OUTFIT; }
