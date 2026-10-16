import { BLOCK } from './blocks.js';

// Keep legacy IDs: existing pickaxes and axes become the stone tier.
export const TOOLS = Object.freeze(Object.fromEntries([
  ['wooden_pickaxe','Picareta de madeira','pickaxe',1,'#af7747',.7,'Extrai pedra e carvão. Comece com tábuas de madeira.'],
  ['pickaxe','Picareta de pedra','pickaxe',2,'#939caa',.4,'Extrai pedra, carvão, cobre e minério de ferro.'],
  ['iron_pickaxe','Picareta de ferro','pickaxe',3,'#d7e1ec',.27,'Feita com lingotes. Extrai também ouro, cristal e diamante.'],
  ['diamond_pickaxe','Picareta de diamante','pickaxe',4,'#48e6dc',.16,'Extrai pedra e todos os minérios com maior rapidez.'],
  ['wooden_axe','Machado de madeira','axe',1,'#af7747',.65,'Corta madeira mais rápido que a mão.'],
  ['axe','Machado de pedra','axe',2,'#939caa',.35,'Corta troncos, folhas e peças de madeira mais rápido.'],
  ['iron_axe','Machado de ferro','axe',3,'#d7e1ec',.23,'Feito com lingotes. Corta madeira mais rápido que o machado de pedra.'],
  ['diamond_axe','Machado de diamante','axe',4,'#48e6dc',.14,'O machado mais rápido para madeira. Não substitui uma picareta.'],
  ['shovel','Pá de ferro','shovel',3,'#d7e1ec',.3,'Cava terra, grama, areia, argila e neve bem mais rápido.'],
].map(([id,name,kind,tier,color,speed,description])=>[id,Object.freeze({id,name,kind,tier,color,speed,description})])));

export const MINING_TIERS = Object.freeze({
  [BLOCK.STONE]:1, [BLOCK.COAL]:1,
  [BLOCK.ORE]:2, [BLOCK.COPPER]:2,
  [BLOCK.GOLD]:3, [BLOCK.CRYSTAL]:3, [BLOCK.DIAMOND]:3, [BLOCK.EMERALD]:3, [BLOCK.TOPAZ]:3, [BLOCK.DIAMOND_BLOCK]:3, [BLOCK.RUBY]:3, [BLOCK.URANIUM]:3, [BLOCK.RUBY_BLOCK]:3, [BLOCK.GOLD_BLOCK]:3, [BLOCK.URANIUM_BLOCK]:3, [BLOCK.EMERALD_BLOCK]:3, [BLOCK.OBSIDIAN]:3, [BLOCK.BASALT]:1, [BLOCK.MAGMA]:1, [BLOCK.BAUXITE]:2, [BLOCK.STEEL_BLOCK]:3, [BLOCK.VERDIGRIS]:3,
});

export function miningRequirement(blockId, equippedItem) {
  const required=MINING_TIERS[blockId];
  if(!required)return '';
  const tool=TOOLS[equippedItem];
  if(tool?.kind==='pickaxe'&&tool.tier>=required)return '';
  return `Requer picareta de ${['','madeira','pedra','ferro'][required]} ou superior. Equipe uma na mochila (Tab).`;
}

export function miningSpeed(blockId, equippedItem) {
  const tool=TOOLS[equippedItem];
  if(tool?.kind==='pickaxe'&&(MINING_TIERS[blockId]||[BLOCK.BRICK,BLOCK.ASPHALT,BLOCK.FORGE].includes(blockId)))return tool.speed;
  if(tool?.kind==='shovel'&&[BLOCK.DIRT,BLOCK.GRASS,BLOCK.SAND,BLOCK.CLAY,BLOCK.SNOW,BLOCK.DRY_EARTH].includes(blockId))return tool.speed;
  if(tool?.kind==='axe'&&[BLOCK.WOOD,BLOCK.LEAVES,BLOCK.PLANKS,BLOCK.DOOR,BLOCK.WORKBENCH,BLOCK.CHEST].includes(blockId))return tool.speed;
  return 1;
}

/** Dano corpo a corpo por item equipado; o resto da mão livre causa 8. */
export const WEAPON_DAMAGE = Object.freeze({ wooden_sword: 14, iron_sword: 24, diamond_sword: 32, reaper_scythe: 34 });
/** Armas de disparo: munição, velocidade, dano e intervalo entre tiros. */
export const RANGED = Object.freeze({
  slingshot: { ammo: 'pebble', speed: 24, damage: 24, cooldown: .7, gravity: 12, missing: 'Sem pedrinhas. Uma pedra rende oito munições nas receitas.' },
  rifle: { ammo: 'pellet', speed: 52, damage: 30, cooldown: 1.1, gravity: 3, missing: 'Sem chumbinho. Faça chumbinho na bancada com um lingote de ferro.' },
  bow: { ammo: 'arrow', speed: 36, damage: 38, cooldown: .9, gravity: 7, missing: 'Sem flechas. Faça flechas na bancada com tábuas, pedra e folhas.' },
});

/** Usos até a ferramenta quebrar (um bloco minerado, um golpe ou um disparo gasta 1). */
export const DURABILITY = Object.freeze({
  wooden_pickaxe: 60, pickaxe: 130, iron_pickaxe: 250, diamond_pickaxe: 1560,
  wooden_axe: 60, axe: 130, iron_axe: 250, diamond_axe: 1560, shovel: 250,
  wooden_sword: 60, iron_sword: 250, diamond_sword: 1560, reaper_scythe: 400,
  slingshot: 200, bow: 380, rifle: 500, fishing_rod: 64,
});
