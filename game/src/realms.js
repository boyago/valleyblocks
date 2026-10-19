import * as THREE from 'three';
import { BLOCK, BLOCKS } from './blocks.js';

// Outras terras: regiões distantes do mesmo mundo, alcançadas por portais de blocos.
// O jogador monta a moldura (2 de largura × 3 de altura por dentro) com o bloco da
// terra e espirra o Spray de portal no vão. Cada terra tem um portal fixo de chegada.
export const REALMS = Object.freeze({
  sertao: Object.freeze({ name: 'Sertão', center: [40000, 40000], radius: 150, frame: BLOCK.COPPER_BLOCK, portal: BLOCK.SERTAO_PORTAL, color: 0xffa040, enemy: 'cangaceiro', day: true, animals: ['calango'], sky: '#5fa8e0', haze: '#e6c99a',
    welcome: 'Sertão: sol forte, mandacarus e ossadas. À noite, cuidado com o Cangaceiro Fantasma. O portal de cobre leva de volta.' }),
  minas: Object.freeze({ name: 'Minas Gerais', center: [-40000, 40000], radius: 150, frame: BLOCK.DIAMOND_BLOCK, portal: BLOCK.MINAS_PORTAL, color: 0x6fe8ff, enemy: 'et', animals: ['capivara', 'capivara', 'onca', 'rabbit'],
    welcome: 'Minas Gerais: morros, rios e grutas cheias de pedras preciosas. Capivaras e onças vivem por aqui; à noite, cuidado com o ET de Varginha. O portal de diamante leva de volta.' }),
  china: Object.freeze({ name: 'China', center: [40000, -40000], radius: 150, frame: BLOCK.RUBY_BLOCK, portal: BLOCK.CHINA_PORTAL, color: 0xff4a5a, enemy: 'terracota', animals: ['panda', 'panda', 'rabbit'], haze: '#dfe8d6',
    welcome: 'China: a Grande Muralha, bambuzais e um pagode. Pandas passeiam por aqui; à noite, cuidado com os Guerreiros de Terracota. O portal de rubi leva de volta.' }),
  japao: Object.freeze({ name: 'Japão', center: [-40000, -40000], radius: 150, frame: BLOCK.GOLD_BLOCK, portal: BLOCK.JAPAN_PORTAL, color: 0xffd35a, enemy: 'oni', animals: ['macaco', 'macaco', 'rabbit'], haze: '#f4dce6',
    welcome: 'Japão: cerejeiras em flor, um torii e o monte Fuji ao norte. Macacos-da-neve vivem aqui; à noite, cuidado com o Oni. O portal de ouro leva de volta.' }),
  eua: Object.freeze({ name: 'Estados Unidos', center: [80000, 0], radius: 150, frame: BLOCK.URANIUM_BLOCK, portal: BLOCK.USA_PORTAL, ground: 22, color: 0x9dff6a, enemy: 'pegrande', animals: ['bisao', 'bisao', 'rabbit'], sky: '#4f9fe0', haze: '#ecc193',
    welcome: 'Estados Unidos: cânion, mesas de rocha vermelha, saguaros e a Rota 66. Bisões pastam por aqui; à noite, cuidado com o Pé-Grande. O portal de urânio leva de volta.' }),
  triplice: Object.freeze({ name: 'Tríplice Fronteira', center: [-80000, 0], radius: 150, frame: BLOCK.EMERALD_BLOCK, portal: BLOCK.TRIPLICE_PORTAL, color: 0x3ddc84, enemy: 'boitata', animals: ['quati', 'quati', 'turista'],
    animalsAt: (x, z) => x - (-80000) < -49 ? ['vendedor', 'vendedor', 'turista'] : ['quati', 'quati', 'turista'], haze: '#d9ecd8',
    welcome: 'Tríplice Fronteira: Foz do Iguaçu, a Ponte da Amizade até Ciudad del Este, Puerto Iguazú, o Marco das Três Fronteiras e as Cataratas a leste. À noite, cuidado com o Boitatá. O portal de esmeralda leva de volta.' }),
  submundo: Object.freeze({ name: 'Submundo', center: [0, -80000], radius: 150, frame: BLOCK.OBSIDIAN, portal: BLOCK.SUBMUNDO_PORTAL, color: 0xb04dff, enemy: 'golem', day: true, animals: ['salamandra'], sky: '#2a0c06', haze: '#5c1c0a', tint: 1, fx: 'embers',
    welcome: 'Submundo: lagos e cachoeiras de lava sob um teto de basalto. Golens de Magma andam por aqui a qualquer hora. A lava queima: cuidado onde pisa. O portal de obsidiana leva de volta.' }),
  rio: Object.freeze({ name: 'Rio de Janeiro', center: [0, 80000], radius: 150, frame: BLOCK.CALCADAO, portal: BLOCK.RIO_PORTAL, color: 0xffd23f, enemy: 'saci', animals: ['mico', 'mico', 'pombo'], sky: '#4fa8ea', haze: '#d6ecf2', tint: .35,
    welcome: 'Rio de Janeiro: Copacabana, o calçadão, o Pão de Açúcar no mar e o Cristo Redentor no alto do Corcovado. À noite, o Saci apronta por aqui. O portal de pedra portuguesa leva de volta.' }),
  nyc: Object.freeze({ name: 'Nova York', center: [80000, -80000], radius: 150, frame: BLOCK.STEEL_BLOCK, portal: BLOCK.NYC_PORTAL, color: 0x5aa9ff, enemy: 'ratao', animals: ['pombo', 'esquilo', 'pombo'], haze: '#d9dde4',
    welcome: 'Nova York: arranha-céus, o Central Park ao norte e, no meio da baía ao sul, a Estátua da Liberdade. Para chegar até ela, só de barco. À noite, cuidado com o Ratão do esgoto. O portal de aço leva de volta.' }),
});
export const REALM_PORTALS = Object.values(REALMS).map(r => r.portal);
export const PORTAL_BLOCKS = new Set(Object.values(REALMS).map(r => r.portal));
const FRAMES = new Map(Object.entries(REALMS).map(([key, r]) => [r.frame, key]));

const fract = n => n - Math.floor(n);
const hash = (x, z, seed) => fract(Math.sin(x * 127.1 + z * 311.7 + seed * 74.7) * 43758.5453);
const smooth = t => t * t * (3 - 2 * t);
function noise(x, z, seed) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = smooth(fract(x)), fz = smooth(fract(z));
  const a = hash(ix, iz, seed), b = hash(ix + 1, iz, seed), c = hash(ix, iz + 1, seed), d = hash(ix + 1, iz + 1, seed);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}

/** Clareira plana de 13×13 ao redor do portal de chegada, que sobe suave até o terreno. */
const flatten = (height, dx, dz, ground = 10) => { const t = Math.max(0, Math.min(1, (Math.max(Math.abs(dx), Math.abs(dz)) - 6) / 16)); return Math.round(ground + (height - ground) * smooth(t)); };
/** Altura do chão da clareira de chegada (o portal fica um bloco acima). */
export const groundOf = key => REALMS[key]?.ground ?? 10;

export function realmAt(x, z) {
  for (const [key, r] of Object.entries(REALMS)) if (Math.abs(x - r.center[0]) <= r.radius && Math.abs(z - r.center[1]) <= r.radius) return key;
  return null;
}

/** Terrain column for a realm, or null outside every realm. */
export function realmColumn(x, z, seed) {
  const key = realmAt(x, z); if (key === 'minas') return minasColumn(x, z, seed); if (key === 'china') return chinaColumn(x, z, seed); if (key === 'japao') return japaoColumn(x, z, seed); if (key === 'eua') return euaColumn(x, z, seed); if (key === 'triplice') return triColumn(x, z, seed); if (key === 'submundo') return subColumn(x, z, seed); if (key === 'rio') return rioColumn(x, z, seed); if (key === 'nyc') return nycColumn(x, z, seed); if (key !== 'sertao') return null;
  const r = REALMS.sertao, dx = x - r.center[0], dz = z - r.center[1];
  const edge = Math.max(Math.abs(dx), Math.abs(dz));
  const n = noise(x / 38, z / 38, seed + 5021), mesa = noise(x / 70 + 9, z / 70 - 4, seed + 733);
  let height = 9 + Math.floor(n * 4);
  if (mesa > .7) height += Math.floor((mesa - .7) * 40 / 3) * 3; // chapadas em degraus
  // Leito seco de riacho que corta a terra.
  const bed = Math.abs(dz - Math.sin(dx / 23) * 14);
  if (bed < 3 && edge < r.radius - 16) height = Math.min(height, 7);
  // Serra alta fecha a terra pelos lados.
  if (edge > r.radius - 14) height = Math.max(height, 22 + Math.floor((edge - (r.radius - 14)) * 1.6 + n * 5));
  // Clareira plana ao redor do portal de chegada.
  height = flatten(height, dx, dz);
  const surface = edge > r.radius - 14 ? BLOCK.CLAY : bed < 3 ? BLOCK.SAND : hash(Math.floor(x / 3), Math.floor(z / 3), seed + 88) > .93 ? BLOCK.SAND : BLOCK.DRY_EARTH;
  return { height: Math.min(height, 58), surface, water: false, biome: 'sertao' };
}

const inside = (r, baseX, baseZ, size) => !(baseX > r.center[0] + r.radius || baseX + size < r.center[0] - r.radius || baseZ > r.center[1] + r.radius || baseZ + size < r.center[1] - r.radius);
function arrivalGate(put, r) {
  const [cx, cz] = r.center, gy = (r.ground ?? 10) + 1;
  for (let dx = -1; dx <= 2; dx++) for (let y = -1; y <= 3; y++) put(cx + dx, gy + y, cz, dx === -1 || dx === 2 || y === -1 || y === 3 ? r.frame : r.portal);
  put(cx - 3, gy, cz + 2, BLOCK.TORCH); put(cx + 4, gy, cz + 2, BLOCK.TORCH);
}

/** Mar de morros verdes, terra vermelha, rio que cruza a terra e a serra de pedra em volta. */
function minasColumn(x, z, seed) {
  const r = REALMS.minas, dx = x - r.center[0], dz = z - r.center[1], edge = Math.max(Math.abs(dx), Math.abs(dz));
  const n = noise(x / 34, z / 34, seed + 6101), d = noise(x / 12, z / 12, seed + 6113);
  let height = 11 + Math.floor(n * 13 + d * 3), water = false;
  const river = Math.abs(dz - 34 - Math.sin(dx / 31) * 22 - Math.sin(dx / 11) * 4);
  if (edge < r.radius - 16) {
    if (river < 4) { height = 5 + Math.floor(river / 2); water = true; }
    else if (river < 9) height = Math.round(9 + (height - 9) * (river - 4) / 5);
  }
  if (edge > r.radius - 14) height = Math.max(height, 26 + Math.floor((edge - (r.radius - 14)) * 1.5 + n * 6));
  const near = Math.max(Math.abs(dx), Math.abs(dz)); height = flatten(height, dx, dz); if (near <= 10) water = false;
  const surface = water ? BLOCK.SAND : edge > r.radius - 14 ? BLOCK.STONE : hash(Math.floor(x / 4), Math.floor(z / 4), seed + 6131) > .88 ? BLOCK.CLAY : BLOCK.GRASS;
  return { height: Math.min(height, 58), surface, water, biome: 'minas' };
}
const minasCave = (x, y, z) => Math.sin(x * .11 + Math.sin(z * .07) * 2) + Math.cos(z * .12 + y * .42) + Math.sin(y * .5 + x * .05) > 1.72;
const GEMS = [[.1, BLOCK.DIAMOND], [.18, BLOCK.GOLD], [.26, BLOCK.CRYSTAL], [.44, BLOCK.EMERALD], [.62, BLOCK.TOPAZ], [.8, BLOCK.RUBY], [1, BLOCK.BAUXITE]];
/** Grutas largas; as paredes guardam diamante, ouro, cristal, esmeralda, topázio imperial e rubi. */
function decorateMinas(put, world, baseX, baseZ, size) {
  const r = REALMS.minas, seed = world.seedHash;
  if (!inside(r, baseX, baseZ, size)) return;
  for (let z = baseZ; z < baseZ + size; z++) for (let x = baseX; x < baseX + size; x++) {
    const info = realmColumn(x, z, seed); if (!info || info.biome !== 'minas') continue;
    const dx = x - r.center[0], dz = z - r.center[1];
    if (Math.max(Math.abs(dx), Math.abs(dz)) > r.radius - 16 || (Math.abs(dx) <= 8 && Math.abs(dz) <= 8)) continue;
    if (info.surface === BLOCK.CLAY) for (let y = info.height - 2; y < info.height; y++) put(x, y, z, BLOCK.BAUXITE); // jazida rasa sob a terra vermelha
    const mouth = hash(Math.floor(x / 9), Math.floor(z / 9), seed + 6151) > .9 && !info.water; // boca de gruta
    const top = mouth ? info.height : info.height - 4;
    for (let y = 3; y <= top; y++) {
      if (minasCave(x, y, z)) { put(x, y, z, BLOCK.AIR); continue; }
      if (y > info.height - 3) continue;
      const wall = minasCave(x + 1, y, z) || minasCave(x - 1, y, z) || minasCave(x, y + 1, z) || minasCave(x, y - 1, z) || minasCave(x, y, z + 1) || minasCave(x, y, z - 1);
      if (!wall) continue;
      const roll = hash(x * 3 + y * 17, z * 5 - y * 7, seed + 6163);
      if (roll > .74) { const pick = hash(x + y, z - y, seed + 6173); put(x, y, z, GEMS.find(([p]) => pick < p)[1]); }
      else if (y <= 4 && roll > .55) put(x, y, z, BLOCK.WATER); // poças no fundo da gruta
    }
  }
  arrivalGate(put, r);
}

export function decorateRealm(put, world, baseX, baseZ, size) {
  decorateMinas(put, world, baseX, baseZ, size);
  decorateSertao(put, world, baseX, baseZ, size);
  decorateChina(put, world, baseX, baseZ, size);
  decorateJapao(put, world, baseX, baseZ, size);
  decorateEua(put, world, baseX, baseZ, size);
  decorateTriplice(put, world, baseX, baseZ, size);
  decorateSubmundo(put, world, baseX, baseZ, size);
  decorateRio(put, world, baseX, baseZ, size);
  decorateNyc(put, world, baseX, baseZ, size);
}

/** Ossadas de gado do Sertão: mesmas casas da grade de decoração (roll entre .38 e .44).
 *  Devolve [x, y, z, yaw] com y = topo do chão. Desenhadas por skeletons.js. */
export function sertaoSkeletons(seed) {
  const r = REALMS.sertao, [cx, cz] = r.center, out = [];
  for (let gz = Math.floor((cz - r.radius) / 6); gz <= Math.floor((cz + r.radius) / 6); gz++) for (let gx = Math.floor((cx - r.radius) / 6); gx <= Math.floor((cx + r.radius) / 6); gx++) {
    const x = gx * 6 + Math.floor(hash(gx, gz, seed + 401) * 4), z = gz * 6 + Math.floor(hash(gx, gz, seed + 409) * 4);
    const roll = hash(gx, gz, seed + 419); if (roll < .38 || roll >= .44) continue;
    if (Math.abs(x - cx) <= 7 && Math.abs(z - cz) <= 7) continue;
    const info = realmColumn(x, z, seed); if (!info || info.surface === BLOCK.CLAY || realmAt(x, z) !== 'sertao') continue;
    out.push([x + 1.5, info.height + 1, z + .5, hash(gx, gz, seed + 439) * Math.PI * 2]);
  }
  return out;
}

/** Mandacarus, árvores secas, ossadas, pedras e o portal de chegada. */
function decorateSertao(put, world, baseX, baseZ, size) {
  const r = REALMS.sertao, [cx, cz] = r.center, seed = world.seedHash;
  if (baseX > cx + r.radius || baseX + size < cx - r.radius || baseZ > cz + r.radius || baseZ + size < cz - r.radius) return;
  for (let gz = Math.floor((baseZ - 3) / 6); gz <= Math.floor((baseZ + size + 2) / 6); gz++) for (let gx = Math.floor((baseX - 3) / 6); gx <= Math.floor((baseX + size + 2) / 6); gx++) {
    const x = gx * 6 + Math.floor(hash(gx, gz, seed + 401) * 4), z = gz * 6 + Math.floor(hash(gx, gz, seed + 409) * 4);
    const info = realmColumn(x, z, seed); if (!info || info.surface === BLOCK.CLAY) continue;
    if (Math.abs(x - cx) <= 7 && Math.abs(z - cz) <= 7) continue;
    const roll = hash(gx, gz, seed + 419), y = info.height + 1;
    if (roll < .3) { // Mandacaru: tronco com dois braços
      const h = 3 + Math.floor(hash(gx, gz, seed + 421) * 3);
      for (let i = 0; i < h; i++) put(x, y + i, z, BLOCK.CACTUS);
      if (h >= 4) { const ax = hash(gx, gz, seed + 431) > .5; const [ox, oz] = ax ? [1, 0] : [0, 1];
        put(x + ox, y + 1, z + oz, BLOCK.CACTUS); put(x + ox, y + 2, z + oz, BLOCK.CACTUS);
        put(x - ox, y + 2, z - oz, BLOCK.CACTUS); put(x - ox, y + 3, z - oz, BLOCK.CACTUS); }
    } else if (roll < .38) { // Árvore seca, sem folhas
      const h = 3 + Math.floor(hash(gx, gz, seed + 433) * 2);
      for (let i = 0; i < h; i++) put(x, y + i, z, BLOCK.WOOD);
      put(x + 1, y + h - 1, z, BLOCK.WOOD); put(x - 1, y + h, z, BLOCK.WOOD); put(x, y + h, z + 1, BLOCK.WOOD);
    } else if (roll < .44) { // Ossada de gado: modelo 3D do Blender (skeletons.js), sem blocos
    } else if (roll < .52) { put(x, y, z, BLOCK.STONE); if (roll < .48) put(x + 1, y, z, BLOCK.STONE); }
    else if (roll < .545) put(x, y - 1, z, BLOCK.COPPER); // cobre aflorando
    else if (roll < .6) { put(x, y - 3, z, BLOCK.URANIUM); put(x + 1, y - 4, z, BLOCK.URANIUM); } // veio de urânio sob a terra
  }
  arrivalGate(put, r); // Portal de chegada (sempre aceso), voltado para o sul.
}

/** Vão retangular (2 a 4 de largura, 3 a 5 de altura) cercado por uma moldura de um
 *  mesmo bloco de terra, de qualquer espessura e com cantos opcionais. Devolve as células
 *  do vão ou, quando quase dá certo, um aviso dizendo o que mudar. */
export const FRAME_LIMITS = Object.freeze({ minW: 2, maxW: 4, minH: 3, maxH: 5 });
export function findFrame(world, x, y, z) {
  const open = (...c) => { const id = world.getBlock(...c); return id === BLOCK.AIR || PORTAL_BLOCKS.has(id); };
  if (!open(x, y, z)) return null;
  let problem = null;
  for (const axis of ['x', 'z']) {
    const at = (a, h) => axis === 'x' ? [x + a, y + h, z] : [x, y + h, z + a];
    let l = 0, r = 0, d = 0, u = 0;
    while (l > -7 && open(...at(l - 1, 0))) l--;
    while (r < 7 && open(...at(r + 1, 0))) r++;
    while (d > -7 && open(...at(0, d - 1))) d--;
    while (u < 7 && open(...at(0, u + 1))) u++;
    const frame = world.getBlock(...at(l - 1, 0));
    if (!FRAMES.has(frame)) continue;
    let ring = true;
    for (let h = d; h <= u && ring; h++) if (world.getBlock(...at(l - 1, h)) !== frame || world.getBlock(...at(r + 1, h)) !== frame) ring = false;
    for (let a2 = l; a2 <= r && ring; a2++) if (world.getBlock(...at(a2, d - 1)) !== frame || world.getBlock(...at(a2, u + 1)) !== frame) ring = false;
    if (!ring) { problem ??= 'A moldura precisa fechar o vão dos quatro lados com o mesmo bloco (os cantos podem ficar vazios).'; continue; }
    let full = true; const cells = [];
    for (let a2 = l; a2 <= r && full; a2++) for (let h = d; h <= u && full; h++) { if (!open(...at(a2, h))) full = false; cells.push(at(a2, h)); }
    if (!full) { problem ??= 'Tire os blocos de dentro do vão: ele precisa estar vazio.'; continue; }
    const w = r - l + 1, hgt = u - d + 1, L = FRAME_LIMITS;
    if (w < L.minW || w > L.maxW || hgt < L.minH || hgt > L.maxH) { problem = `O vão está com ${w} de largura e ${hgt} de altura. Ele precisa ter de ${L.minW} a ${L.maxW} blocos de largura e de ${L.minH} a ${L.maxH} de altura.`; continue; }
    return { realm: FRAMES.get(frame), cells };
  }
  return problem ? { problem } : null;
}

/** Spray de portal: acende uma moldura válida perto do ponto mirado (no vão, no chão ou na própria moldura). */
export function activatePortal(world, hit) {
  if (!hit) return { ok: false, message: 'Mire no vão de uma moldura de portal.' };
  const n = hit.normal || { x: 0, y: 0, z: 0 };
  const tries = [[hit.x + n.x, hit.y + n.y, hit.z + n.z], [hit.x, hit.y, hit.z]];
  for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0]]) tries.push([hit.x + dx, hit.y + dy, hit.z + dz]);
  let problem = null;
  for (const [x, y, z] of tries) {
    const found = findFrame(world, x, y, z); if (!found) continue;
    if (found.problem) { problem ??= found.problem; continue; }
    const realm = REALMS[found.realm];
    if (found.cells.every(c => world.getBlock(...c) === realm.portal)) return { ok: false, message: 'Este portal já está aberto. Pressione E para atravessar.' };
    for (const c of found.cells) world.setBlock(...c, realm.portal);
    return { ok: true, realm: found.realm, message: `Portal aberto! Pressione E para viajar ao ${realm.name}.` };
  }
  return { ok: false, message: problem || 'Monte uma moldura com um vão de 2 a 4 blocos de largura e 3 a 5 de altura e mire o spray no vão. Cobre leva ao Sertão, diamante a Minas, rubi à China, ouro ao Japão, urânio aos EUA, esmeralda à Tríplice Fronteira, obsidiana ao Submundo, pedra portuguesa ao Rio e aço a Nova York.' };
}

export class Realms {
  constructor(state) {
    const ok = p => Array.isArray(p) && p.length === 3 && p.every(n => Number.isFinite(n) && Math.abs(n) < 1e6);
    this.returnTo = ok(state?.returnTo) ? [...state.returnTo] : null;
  }
  gate(key) { const [x, z] = REALMS[key].center; return { x, y: groundOf(key) + 1, z }; }
  /** E no portal: entra na terra do portal ou volta para onde o jogador estava. */
  travel(portalId, player, entities, world) {
    const key = Object.keys(REALMS).find(k => REALMS[k].portal === portalId); if (!key) return { ok: false, message: '' };
    const inside = realmAt(player.position.x, player.position.z) === key;
    let target;
    if (inside) target = this.returnTo ? new THREE.Vector3(...this.returnTo) : new THREE.Vector3(.5, 9.002, 6.5);
    else { this.returnTo = [player.position.x, player.position.y + .002, player.position.z + 1.5]; const g = this.gate(key); target = new THREE.Vector3(g.x + 1, g.y, g.z + 2.5); }
    world.ensureAround(target.x, target.z, 1);
    let position = null;
    for (const dy of [0, 1, 2, 3]) for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const p = target.clone().add(new THREE.Vector3(dx, dy, dz));
      if (!position && !player.blocked(p) && BLOCKS[world.getBlock(Math.floor(p.x), Math.floor(p.y) - 1, Math.floor(p.z))]?.solid) position = p;
    }
    if (!position) return { ok: false, message: 'O destino está bloqueado. Tente de novo.' };
    player.position.copy(position); player.velocity.set(0, 0, 0); player.pitch = -.1; player.flying = false; if (!inside) player.yaw = Math.PI; // chega de costas para o portal, olhando a paisagem
    for (const pet of entities.pets) if (pet.tamed && !pet.vehicleId && pet.mode !== 'stay') {
      const stand = entities.petStand(position.x + 1, position.z, position.y);
      if (stand) { pet.position.copy(stand); pet.home.copy(stand); pet.path = []; pet.goal = null; }
    }
    return { ok: true, realm: inside ? null : key, message: inside ? 'Você voltou para casa.' : REALMS[key].welcome };
  }
  serialize() { return { version: 1, returnTo: this.returnTo }; }
}

const rim = (r, dx, dz) => Math.max(Math.abs(dx), Math.abs(dz)) > r.radius - 14;
const rimHeight = (r, dx, dz, n, base) => base + Math.floor((Math.max(Math.abs(dx), Math.abs(dz)) - (r.radius - 14)) * 1.5 + n * 6);
const wallLine = dx => -40 + Math.round(Math.sin(dx / 40) * 10); // Grande Muralha, em z relativo

/** China: morros em terraços, picos de pedra e a Grande Muralha. */
function chinaColumn(x, z, seed) {
  const r = REALMS.china, dx = x - r.center[0], dz = z - r.center[1];
  const n = noise(x / 40, z / 40, seed + 7101);
  let height = 10 + Math.floor(n * 16 / 2) * 2;
  const cell = hash(Math.floor(x / 9), Math.floor(z / 9), seed + 7111), px = x - Math.floor(x / 9) * 9 - 4, pz = z - Math.floor(z / 9) * 9 - 4;
  if (cell > .93 && px * px + pz * pz < 6) height = 34 + Math.floor(cell * 40) % 10; // picos de pedra (carste)
  if (rim(r, dx, dz)) height = Math.max(height, rimHeight(r, dx, dz, n, 28));
  height = flatten(height, dx, dz);
  const surface = rim(r, dx, dz) || height > 30 ? BLOCK.STONE : BLOCK.GRASS;
  return { height: Math.min(height, 58), surface, water: false, biome: 'china' };
}
function decorateChina(put, world, baseX, baseZ, size) {
  const r = REALMS.china, [cx, cz] = r.center, seed = world.seedHash;
  if (!inside(r, baseX, baseZ, size)) return;
  for (let x = baseX; x < baseX + size; x++) { // Grande Muralha com ameias
    const dx = x - cx, lz = cz + wallLine(dx);
    if (rim(r, dx, 0) || Math.abs(dx) < 10) continue;
    for (let z = lz - 1; z <= lz + 1; z++) {
      if (z < baseZ || z >= baseZ + size) continue;
      const h = realmColumn(x, z, seed).height;
      const top = Math.max(h, realmColumn(x, lz, seed).height) + 4;
      for (let y = h + 1; y <= top; y++) put(x, y, z, BLOCK.STONE);
      if (z !== lz && x % 2 === 0) put(x, top + 1, z, BLOCK.STONE);
    }
  }
  for (let gz = Math.floor(baseZ / 4); gz <= Math.floor((baseZ + size) / 4); gz++) for (let gx = Math.floor(baseX / 4); gx <= Math.floor((baseX + size) / 4); gx++) {
    const x = gx * 4 + Math.floor(hash(gx, gz, seed + 7121) * 3), z = gz * 4 + Math.floor(hash(gx, gz, seed + 7123) * 3);
    const info = realmColumn(x, z, seed); if (!info || info.surface !== BLOCK.GRASS || Math.abs(z - cz - wallLine(x - cx)) < 3) continue;
    if (Math.abs(x - cx) <= 16 && Math.abs(z - cz) <= 16) continue;
    if (noise(x / 25, z / 25, seed + 7127) > .55 && hash(gx, gz, seed + 7129) < .7) { // bambuzal
      const h = 5 + Math.floor(hash(gx, gz, seed + 7131) * 4);
      for (let i = 1; i <= h; i++) put(x, info.height + i, z, BLOCK.BAMBOO);
    }
  }
  // Pagode de três andares perto da chegada.
  const px = cx + 9, pz = cz - 12;
  for (let x = px - 4; x <= px + 4; x++) for (let z = pz - 4; z <= pz + 4; z++) put(x, 10, z, BLOCK.STONE);
  for (let t = 0; t < 3; t++) {
    const half = 3 - t, y0 = 11 + t * 4;
    for (let x = px - half; x <= px + half; x++) for (let z = pz - half; z <= pz + half; z++) {
      const wall = Math.abs(x - px) === half || Math.abs(z - pz) === half, door = t === 0 && x === px && z === pz + half;
      for (let y = y0; y < y0 + 3; y++) put(x, y, z, wall && !(door && y < y0 + 2) ? BLOCK.RED_LACQUER : BLOCK.AIR);
    }
    for (let x = px - half - 1; x <= px + half + 1; x++) for (let z = pz - half - 1; z <= pz + half + 1; z++) put(x, y0 + 3, z, BLOCK.BRICK);
  }
  arrivalGate(put, r);
}

/** Japão: colinas, lagos e o monte Fuji nevado ao norte. */
const FUJI = [0, -62];
function japaoColumn(x, z, seed) {
  const r = REALMS.japao, dx = x - r.center[0], dz = z - r.center[1];
  const n = noise(x / 36, z / 36, seed + 8101);
  let height = 10 + Math.floor(n * 9), water = false;
  const fuji = Math.hypot(dx - FUJI[0], dz - FUJI[1]);
  if (fuji < 50) height = Math.max(height, Math.round(56 - fuji * .9));
  if (noise(x / 22 + 5, z / 22, seed + 8111) < .2 && fuji > 58) { height = 7; water = true; } // lagos
  if (rim(r, dx, dz)) height = Math.max(height, rimHeight(r, dx, dz, n, 24));
  const near = Math.max(Math.abs(dx), Math.abs(dz)); height = flatten(height, dx, dz); if (near <= 12) water = false;
  const slope = fuji < 46 && height > 16;
  const surface = water ? BLOCK.SAND : height > 40 ? BLOCK.SNOW : slope || height > 30 || rim(r, dx, dz) ? BLOCK.STONE : BLOCK.GRASS;
  return { height: Math.min(height, 58), surface, water, biome: 'japao' };
}
function decorateJapao(put, world, baseX, baseZ, size) {
  const r = REALMS.japao, [cx, cz] = r.center, seed = world.seedHash;
  if (!inside(r, baseX, baseZ, size)) return;
  for (let gz = Math.floor((baseZ - 3) / 7); gz <= Math.floor((baseZ + size + 2) / 7); gz++) for (let gx = Math.floor((baseX - 3) / 7); gx <= Math.floor((baseX + size + 2) / 7); gx++) {
    const x = gx * 7 + Math.floor(hash(gx, gz, seed + 8121) * 4), z = gz * 7 + Math.floor(hash(gx, gz, seed + 8123) * 4);
    const info = realmColumn(x, z, seed); if (!info || info.surface !== BLOCK.GRASS || hash(gx, gz, seed + 8125) > .45) continue;
    if (Math.abs(x - cx) <= 9 && Math.abs(z - cz) <= 12) continue;
    const top = info.height + 4; // cerejeira: tronco curto e copa larga cor-de-rosa
    for (let y = info.height + 1; y <= top; y++) put(x, y, z, BLOCK.WOOD);
    for (let dy = 0; dy <= 2; dy++) for (let ox = -3; ox <= 3; ox++) for (let oz = -3; oz <= 3; oz++) {
      if (Math.abs(ox) + Math.abs(oz) + dy * 1.5 > 4.5 || (ox === 0 && oz === 0 && dy === 0)) continue;
      put(x + ox, top + dy, z + oz, BLOCK.SAKURA);
    }
  }
  // Torii na frente do portal de chegada.
  const tz = cz + 9;
  for (const x of [cx - 2, cx + 3]) for (let y = 11; y <= 15; y++) put(x, y, tz, BLOCK.RED_LACQUER);
  for (let x = cx - 3; x <= cx + 4; x++) put(x, 16, tz, BLOCK.RED_LACQUER);
  for (let x = cx - 2; x <= cx + 3; x++) put(x, 14, tz, BLOCK.RED_LACQUER);
  arrivalGate(put, r);
}

/** EUA: chão de deserto, mesas de rocha vermelha, cânion com rio e a Rota 66. */
function euaColumn(x, z, seed) {
  const r = REALMS.eua, dx = x - r.center[0], dz = z - r.center[1];
  const n = noise(x / 30, z / 30, seed + 9101), mesa = noise(x / 46 + 3, z / 46 - 7, seed + 9111);
  // Planalto alto; o cânion desce em degraus largos até o rio, e mesas sobem do planalto.
  let height = 22 + Math.floor(n * 3), water = false;
  if (mesa > .7) height = 32 + Math.floor(n * 4);
  const canyon = Math.abs(dz - 40 - Math.sin(dx / 35) * 25);
  if (canyon < 20 && !rim(r, dx, dz)) {
    height = canyon < 5 ? 5 : Math.min(height, 7 + Math.floor((canyon - 5) / 2.5) * 2);
    if (canyon < 5) water = true;
  }
  if (rim(r, dx, dz)) height = Math.max(height, rimHeight(r, dx, dz, n, 36));
  const near = Math.max(Math.abs(dx), Math.abs(dz)); height = flatten(height, dx, dz, r.ground); if (near <= 12) water = false;
  const surface = water ? BLOCK.SAND : canyon < 20 || height > 26 ? BLOCK.RED_ROCK : hash(Math.floor(x / 5), Math.floor(z / 5), seed + 9121) > .55 ? BLOCK.SAND : BLOCK.RED_ROCK;
  return { height: Math.min(height, 58), surface, water, biome: 'eua', fill: BLOCK.RED_ROCK };
}
function decorateEua(put, world, baseX, baseZ, size) {
  const r = REALMS.eua, [cx, cz] = r.center, seed = world.seedHash;
  if (!inside(r, baseX, baseZ, size)) return;
  for (let x = baseX; x < baseX + size; x++) { // Rota 66
    const z0 = cz - 14; if (rim(r, x - cx, 0)) continue;
    for (let z = z0 - 1; z <= z0 + 2; z++) { if (z < baseZ || z >= baseZ + size) continue; const info = realmColumn(x, z, seed); if (info.height >= 20 && info.height <= 26 && !info.water) put(x, info.height, z, BLOCK.ASPHALT); }
  }
  for (let gz = Math.floor((baseZ - 3) / 6); gz <= Math.floor((baseZ + size + 2) / 6); gz++) for (let gx = Math.floor((baseX - 3) / 6); gx <= Math.floor((baseX + size + 2) / 6); gx++) {
    const x = gx * 6 + Math.floor(hash(gx, gz, seed + 9131) * 4), z = gz * 6 + Math.floor(hash(gx, gz, seed + 9133) * 4);
    const info = realmColumn(x, z, seed); if (!info || info.water || info.height > 26 || info.height < 20 || Math.abs(z - (cz - 14)) < 3) continue;
    if (Math.abs(x - cx) <= 8 && Math.abs(z - cz) <= 8) continue;
    const roll = hash(gx, gz, seed + 9135), y = info.height + 1;
    if (roll < .22) { // saguaro: tronco alto com braços que sobem
      const h = 5 + Math.floor(hash(gx, gz, seed + 9137) * 3);
      for (let i = 0; i < h; i++) put(x, y + i, z, BLOCK.CACTUS);
      put(x + 1, y + 2, z, BLOCK.CACTUS); put(x + 2, y + 2, z, BLOCK.CACTUS); put(x + 2, y + 3, z, BLOCK.CACTUS); put(x + 2, y + 4, z, BLOCK.CACTUS);
      put(x - 1, y + 3, z, BLOCK.CACTUS); put(x - 2, y + 3, z, BLOCK.CACTUS); put(x - 2, y + 4, z, BLOCK.CACTUS);
    } else if (roll < .28) { put(x, y, z, BLOCK.RED_ROCK); put(x, y + 1, z, BLOCK.RED_ROCK); }
  }
  arrivalGate(put, r);
}

// ---------------------------------------------------------------------------
// Tríplice Fronteira. Coordenadas relativas à praça de Foz do Iguaçu (centro).
// Rio Paraná corre no eixo z a oeste; o Iguaçu vem do leste e deságua nele.
const PARANA_X = -41, IGUACU_Z = dx => 30 + Math.round(Math.sin(dx / 20) * 4), BRIDGE_Z = -20;
const fallsX = dz => 78 + Math.round(8 * Math.cos((dz - 30) / 9)); // ferradura das Cataratas
const triZone = (dx, dz) => dx < PARANA_X - 8 ? 'py' : dz > IGUACU_Z(dx) + 6 ? 'ar' : 'br';
const city = (dx, dz) => {
  const zone = triZone(dx, dz);
  if (zone === 'py') return dx > -120 && Math.abs(dz) < 70;
  if (zone === 'br') return dx > PARANA_X + 10 && dx < 60 && dz > -70 && dz < IGUACU_Z(dx) - 8;
  return dx > PARANA_X + 10 && dx < 50 && dz > IGUACU_Z(dx) + 10 && dz < 110;
};
function triColumn(x, z, seed) {
  const r = REALMS.triplice, dx = x - r.center[0], dz = z - r.center[1];
  const n = noise(x / 30, z / 30, seed + 10101);
  let height = 10 + Math.floor(n * 3), water = false, surface = BLOCK.GRASS;
  const parana = Math.abs(dx - PARANA_X), iguacu = Math.abs(dz - IGUACU_Z(dx)), fx = fallsX(dz);
  if (dx > fx) height = 22 + Math.floor(n * 3); // planalto acima das Cataratas
  if (parana < 7) { height = 3; water = true; } else if (parana < 9) height = 9;
  if (dx > PARANA_X && iguacu < 6) {
    if (dx > fx) { height = 17; surface = BLOCK.SAND; } // leito do rio acima da queda (água posta na decoração)
    else { height = 4; water = true; }
  } else if (dx > PARANA_X && iguacu < 8 && dx <= fx) height = 9;
  if (city(dx, dz) && !water) { height = 10; surface = BLOCK.STONE; }
  if (rim(r, dx, dz)) { height = Math.max(height, rimHeight(r, dx, dz, n, 26)); surface = BLOCK.GRASS; water = false; }
  const near = Math.max(Math.abs(dx), Math.abs(dz)); height = flatten(height, dx, dz); if (near <= 12) water = false;
  if (water) surface = BLOCK.SAND;
  return { height: Math.min(height, 58), surface, water, biome: 'triplice' };
}
function stall(put, x, y, z, color) { // barraquinha: balcão de tábuas, postes e toldo colorido
  for (let ox = 0; ox < 3; ox++) { put(x + ox, y, z, BLOCK.PLANKS); put(x + ox, y + 3, z, color); put(x + ox, y + 3, z + 1, color); }
  for (const ox of [0, 2]) for (let oy = 1; oy <= 2; oy++) put(x + ox, y + oy, z + 1, BLOCK.WOOD);
  put(x + 1, y + 1, z, BLOCK.CHEST);
}
function building(put, x, y, z, w, d, h, wall, glass = true) {
  for (let ox = 0; ox < w; ox++) for (let oz = 0; oz < d; oz++) for (let oy = 0; oy < h; oy++) {
    const edge = ox === 0 || oz === 0 || ox === w - 1 || oz === d - 1;
    if (!edge) { if (oy === h - 1) put(x + ox, y + oy, z + oz, wall); continue; }
    const window = glass && oy % 3 === 1 && (ox + oz) % 2 === 1 && ox > 0 && ox < w - 1;
    put(x + ox, y + oy, z + oz, window ? BLOCK.GLASS : wall);
  }
}
function obelisk(put, x, y, z, a, b) {
  for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) put(x + ox, y, z + oz, BLOCK.STONE);
  for (let oy = 1; oy <= 7; oy++) put(x, y + oy, z, oy % 2 ? a : b);
}
function decorateTriplice(put, world, baseX, baseZ, size) {
  const r = REALMS.triplice, [cx, cz] = r.center, seed = world.seedHash;
  if (!inside(r, baseX, baseZ, size)) return;
  const AWNINGS = [BLOCK.RED_LACQUER, BLOCK.GOLD_BLOCK, BLOCK.DIAMOND_BLOCK, BLOCK.SAKURA, BLOCK.EMERALD_BLOCK, BLOCK.COPPER_BLOCK];
  for (let z = baseZ; z < baseZ + size; z++) for (let x = baseX; x < baseX + size; x++) {
    const dx = x - cx, dz = z - cz, info = realmColumn(x, z, seed); if (!info) continue;
    // Rio Iguaçu acima da queda e a cortina de água das Cataratas.
    const fx = fallsX(dz);
    if (dx > fx && dx > PARANA_X && Math.abs(dz - IGUACU_Z(dx)) < 6 && !rim(r, dx, dz)) for (let y = 18; y <= 20; y++) put(x, y, z, BLOCK.WATER);
    if (dx === fx && Math.abs(dz - IGUACU_Z(dx)) < 14 && !rim(r, dx, dz)) for (let y = 9; y <= 20; y++) put(x, y, z, BLOCK.WATER);
    // Ruas da cidade (asfalto a cada 12 blocos).
    if (city(dx, dz) && (((dx % 12) + 12) % 12 < 2 || ((dz % 12) + 12) % 12 < 2)) put(x, 10, z, BLOCK.ASPHALT);
    // Ponte da Amizade: tabuleiro de asfalto com guarda-corpo e pilares.
    if (Math.abs(dz - BRIDGE_Z) <= 2 && dx >= PARANA_X - 12 && dx <= PARANA_X + 12) {
      const deck = 15;
      put(x, deck, z, Math.abs(dz - BRIDGE_Z) === 2 ? BLOCK.STONE : BLOCK.ASPHALT);
      if (Math.abs(dz - BRIDGE_Z) === 2) put(x, deck + 1, z, BLOCK.STONE);
      if ((dx - PARANA_X) % 6 === 0 && Math.abs(dz - BRIDGE_Z) === 1) for (let y = 3; y < deck; y++) put(x, y, z, BLOCK.STONE);
      for (let y = deck + 1 + (Math.abs(dz - BRIDGE_Z) === 2 ? 1 : 0); y <= deck + 4; y++) put(x, y, z, BLOCK.AIR);
    }
    // Rampas de acesso à ponte dos dois lados.
    for (const side of [-1, 1]) {
      const start = PARANA_X + side * 12, run = (dx - start) * side;
      if (run > 0 && run <= 5 && Math.abs(dz - BRIDGE_Z) <= 1) for (let y = 11; y <= 15 - run + 1; y++) put(x, y, z, y === 15 - run + 1 ? BLOCK.ASPHALT : BLOCK.STONE);
    }
  }
  // Lotes da cidade: prédios em Foz, galerias e barraquinhas em Ciudad del Este, casas em Puerto Iguazú.
  for (let gz = Math.floor((baseZ - cz) / 12) - 1; gz <= Math.floor((baseZ + size - cz) / 12) + 1; gz++) for (let gx = Math.floor((baseX - cx) / 12) - 1; gx <= Math.floor((baseX + size - cx) / 12) + 1; gx++) {
    const lx = gx * 12 + 3, lz = gz * 12 + 3;
    if (!city(lx, lz) || !city(lx + 8, lz + 8) || (Math.abs(lx) < 16 && Math.abs(lz) < 16) || Math.abs(lz - BRIDGE_Z) < 9) continue;
    const zone = triZone(lx, lz), roll = hash(gx, gz, seed + 10111), x = cx + lx, z = cz + lz;
    if (zone === 'py') {
      if (roll < .45) building(put, x, 11, z, 8, 8, 6 + Math.floor(roll * 20), BLOCK.BRICK); // galeria de compras
      else for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) stall(put, x + i * 3, 11, z + j * 4, AWNINGS[Math.floor(hash(gx * 3 + i, gz * 2 + j, seed + 10113) * AWNINGS.length)]);
    } else if (zone === 'br') {
      if (roll < .7) building(put, x, 11, z, 7, 7, 8 + Math.floor(roll * 22), roll < .35 ? BLOCK.STONE : BLOCK.BRICK);
    } else if (roll < .8) building(put, x + 1, 11, z + 1, 6, 5, 4, roll < .4 ? BLOCK.PLANKS : BLOCK.CLAY);
  }
  // Marco das Três Fronteiras: um obelisco em cada margem, com as cores do país.
  const mz = cz + IGUACU_Z(PARANA_X + 10);
  obelisk(put, cx + PARANA_X + 10, 10, mz - 9, BLOCK.GOLD_BLOCK, BLOCK.EMERALD_BLOCK);      // Brasil
  obelisk(put, cx + PARANA_X + 10, 10, mz + 9, BLOCK.DIAMOND_BLOCK, BLOCK.SNOW);           // Argentina
  obelisk(put, cx + PARANA_X - 10, 10, mz, BLOCK.RED_LACQUER, BLOCK.SNOW);                 // Paraguai
  arrivalGate(put, r);
}

// ---------------------------------------------------------------------------
// Submundo: basalto sob um teto de pedra, lagos e cachoeiras de lava, magma e obsidiana.
const CEILING = 44;
function subColumn(x, z, seed) {
  const r = REALMS.submundo, dx = x - r.center[0], dz = z - r.center[1];
  const n = noise(x / 26, z / 26, seed + 11101), lake = noise(x / 34 + 7, z / 34 - 2, seed + 11111);
  let height = 10 + Math.floor(n * 7), lava = false;
  const cell = hash(Math.floor(x / 11), Math.floor(z / 11), seed + 11121), px = x - Math.floor(x / 11) * 11 - 5, pz = z - Math.floor(z / 11) * 11 - 5;
  if (cell > .82 && px * px + pz * pz < 9) height = 20 + Math.floor(cell * 60) % 12; // torres de basalto
  if (lake < .3) { height = 5; lava = true; }
  if (rim(r, dx, dz)) height = Math.max(height, rimHeight(r, dx, dz, n, 30));
  const near = Math.max(Math.abs(dx), Math.abs(dz)); height = flatten(height, dx, dz); if (near <= 12) lava = false;
  const shore = !lava && lake < .36;
  return { height: Math.min(height, CEILING - 4), surface: lava ? BLOCK.MAGMA : shore ? BLOCK.MAGMA : BLOCK.BASALT, water: false, lava, biome: 'submundo', fill: BLOCK.BASALT };
}
function decorateSubmundo(put, world, baseX, baseZ, size) {
  const r = REALMS.submundo, [cx, cz] = r.center, seed = world.seedHash;
  if (!inside(r, baseX, baseZ, size)) return;
  for (let z = baseZ; z < baseZ + size; z++) for (let x = baseX; x < baseX + size; x++) {
    const info = realmColumn(x, z, seed); if (!info || info.biome !== 'submundo') continue;
    if (info.lava) for (let y = info.height + 1; y <= 8; y++) put(x, y, z, BLOCK.LAVA);
    // Teto de basalto com poucas fendas; pingentes descem dele.
    const gap = hash(Math.floor(x / 5), Math.floor(z / 5), seed + 11131) > .94;
    if (!gap) for (let y = CEILING; y <= CEILING + 3; y++) put(x, y, z, BLOCK.BASALT);
    const drip = hash(x, z, seed + 11137);
    if (!gap && drip > .985) for (let y = CEILING - 1; y >= CEILING - 1 - Math.floor(drip * 400) % 6; y--) put(x, y, z, BLOCK.BASALT);
  }
  for (let gz = Math.floor((baseZ - 3) / 7); gz <= Math.floor((baseZ + size + 2) / 7); gz++) for (let gx = Math.floor((baseX - 3) / 7); gx <= Math.floor((baseX + size + 2) / 7); gx++) {
    const x = gx * 7 + Math.floor(hash(gx, gz, seed + 11141) * 4), z = gz * 7 + Math.floor(hash(gx, gz, seed + 11143) * 4);
    const info = realmColumn(x, z, seed); if (!info || info.lava || info.biome !== 'submundo') continue;
    if (Math.abs(x - cx) <= 8 && Math.abs(z - cz) <= 8) continue;
    const roll = hash(gx, gz, seed + 11147), y = info.height + 1;
    if (info.height >= 20 && roll < .5) put(x, y, z, BLOCK.LAVA); // fonte no alto da torre: vira cachoeira de lava
    else if (roll < .22) { const h = 3 + Math.floor(roll * 30) % 5; for (let i = 0; i < h; i++) put(x, y + i, z, BLOCK.OBSIDIAN); } // espinho de obsidiana
    else if (roll < .3) { put(x, y, z, BLOCK.CRYSTAL); put(x + 1, y, z, BLOCK.CRYSTAL); put(x, y + 1, z, BLOCK.CRYSTAL); }
    else if (roll < .36) put(x, y - 1, z, BLOCK.MAGMA);
  }
  arrivalGate(put, r);
}

// ---------------------------------------------------------------------------
// Rio de Janeiro: centro na Avenida Atlântica. Mar ao sul, praia, calçadão de
// ondas, prédios ao norte, Pão de Açúcar no mar e Corcovado com o Cristo.
const PAO = [74, 52], URCA = [52, 46];
export const CORCOVADO = [-62, -74];
function rioColumn(x, z, seed) {
  const r = REALMS.rio, dx = x - r.center[0], dz = z - r.center[1];
  const n = noise(x / 30, z / 30, seed + 12101);
  let height = 10, water = false, surface = BLOCK.STONE;
  if (dz > 30) { height = 4; water = true; surface = BLOCK.SAND; }
  else if (dz > 18) { height = 9; surface = BLOCK.SAND; }
  else if (dz > 13) surface = BLOCK.CALCADAO;
  else if (dz > 8) surface = BLOCK.ASPHALT;
  else if (dz < -50) { height = 11 + Math.floor(n * 8); surface = BLOCK.GRASS; } // morros com mata
  // Pão de Açúcar e Morro da Urca: cúpulas de pedra saindo do mar.
  for (const [[px, pz], h, rad] of [[PAO, 46, 13], [URCA, 26, 10]]) {
    const d = Math.hypot(dx - px, dz - pz);
    if (d < rad) { height = Math.max(height, Math.round(8 + (h - 8) * Math.sqrt(1 - (d / rad) ** 2))); water = false; surface = d < rad * .55 ? BLOCK.STONE : BLOCK.GRASS; }
  }
  const cd = Math.hypot(dx - CORCOVADO[0], dz - CORCOVADO[1]);
  if (cd < 50) { height = Math.max(height, Math.round(52 - cd * .85)); surface = cd < 6 ? BLOCK.STONE : BLOCK.GRASS; water = false; }
  if (rim(r, dx, dz) && dz < 30) { height = Math.max(height, rimHeight(r, dx, dz, n, 24)); surface = BLOCK.GRASS; }
  const near = Math.max(Math.abs(dx), Math.abs(dz)); height = flatten(height, dx, dz); if (near <= 12) water = false;
  return { height: Math.min(height, 58), surface, water, biome: 'rio' };
}
function decorateRio(put, world, baseX, baseZ, size) {
  const r = REALMS.rio, [cx, cz] = r.center, seed = world.seedHash;
  if (!inside(r, baseX, baseZ, size)) return;
  // Prédios da orla, de frente para o mar.
  for (let gx = Math.floor((baseX - cx) / 11) - 1; gx <= Math.floor((baseX + size - cx) / 11) + 1; gx++) for (const gz of [-1, -2, -3]) {
    const lx = gx * 11 + 2, lz = gz * 11 + 2; if (Math.abs(lx) < 14 || Math.abs(lx) > 120) continue;
    const roll = hash(gx, gz, seed + 12111);
    building(put, cx + lx, 11, cz + lz, 8, 8, 8 + Math.floor(roll * 26), roll < .5 ? BLOCK.SNOW : BLOCK.CLAY);
  }
  // Coqueiros e guarda-sóis na areia.
  for (let gx = Math.floor((baseX - cx) / 9); gx <= Math.floor((baseX + size - cx) / 9); gx++) {
    const x = cx + gx * 9 + 3, roll = hash(gx, 7, seed + 12113);
    if (Math.abs(gx * 9) < 10) continue;
    if (roll < .5) { const z = cz + 21; for (let y = 10; y <= 15; y++) put(x, y, z, BLOCK.WOOD); for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]) put(x + ox, 16, z + oz, BLOCK.LEAVES); put(x, 16, z, BLOCK.LEAVES); }
    else { const z = cz + 25; put(x, 10, z, BLOCK.WOOD); put(x, 11, z, BLOCK.WOOD); for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) put(x + ox, 12, z + oz, roll < .75 ? BLOCK.RED_LACQUER : BLOCK.GOLD_BLOCK); }
  }
  // Pedestal do Cristo Redentor no topo do Corcovado.
  const tx = cx + CORCOVADO[0], tz = cz + CORCOVADO[1], top = realmColumn(tx, tz, seed).height;
  for (let y = 1; y <= 3; y++) for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) put(tx + ox, top + y, tz + oz, BLOCK.STONE);
  // O Cristo em si é um modelo 3D do Blender (landmarks.js) posto sobre este pedestal.
  arrivalGate(put, r);
}

// ---------------------------------------------------------------------------
// Nova York: ruas em grade com arranha-céus, Central Park ao norte e a baía ao sul
// com a ilha da Estátua da Liberdade (só se chega de barco).
export const LIBERTY = [10, 96];
function nycColumn(x, z, seed) {
  const r = REALMS.nyc, dx = x - r.center[0], dz = z - r.center[1];
  let height = 10, water = false, surface = BLOCK.STONE;
  const island = Math.hypot(dx - LIBERTY[0], dz - LIBERTY[1]);
  if (dz > 40) { height = 4; water = true; surface = BLOCK.SAND; }
  if (island < 9) { height = 10; water = false; surface = BLOCK.GRASS; }
  else if (dz <= 40 && dz > 34) surface = BLOCK.STONE; // cais
  if (dz < -40 && dz > -110 && Math.abs(dx) < 40) surface = BLOCK.GRASS; // Central Park
  if (rim(r, dx, dz) && dz < 40) { height = Math.max(height, 30); surface = BLOCK.STONE; }
  const near = Math.max(Math.abs(dx), Math.abs(dz)); height = flatten(height, dx, dz); if (near <= 12) water = false;
  return { height: Math.min(height, 58), surface, water, biome: 'nyc' };
}
function decorateNyc(put, world, baseX, baseZ, size) {
  const r = REALMS.nyc, [cx, cz] = r.center, seed = world.seedHash;
  if (!inside(r, baseX, baseZ, size)) return;
  for (let z = baseZ; z < baseZ + size; z++) for (let x = baseX; x < baseX + size; x++) {
    const dx = x - cx, dz = z - cz;
    if (dz <= 34 && !(dz < -40 && dz > -110 && Math.abs(dx) < 40) && (((dx % 14) + 14) % 14 < 3 || ((dz % 14) + 14) % 14 < 3) && !rim(r, dx, dz)) put(x, 10, z, BLOCK.ASPHALT);
  }
  for (let gz = Math.floor((baseZ - cz) / 14) - 1; gz <= Math.floor((baseZ + size - cz) / 14) + 1; gz++) for (let gx = Math.floor((baseX - cx) / 14) - 1; gx <= Math.floor((baseX + size - cx) / 14) + 1; gx++) {
    const lx = gx * 14 + 3, lz = gz * 14 + 3;
    if (lz > 22 || Math.abs(lx) > 128 || lz < -134 || (Math.abs(lx) < 18 && Math.abs(lz) < 18) || (lz < -36 && lz > -112 && Math.abs(lx) < 44)) continue;
    const roll = hash(gx, gz, seed + 13111), x = cx + lx, z = cz + lz;
    if (gx === 2 && gz === -2) { // prédio em degraus, estilo Empire State
      building(put, x, 11, z, 10, 10, 22, BLOCK.STEEL_BLOCK); building(put, x + 2, 33, z + 2, 6, 6, 14, BLOCK.STEEL_BLOCK); building(put, x + 4, 47, z + 4, 2, 2, 8, BLOCK.STEEL_BLOCK, false);
    } else building(put, x, 11, z, 10, 10, 12 + Math.floor(roll * 32), roll < .4 ? BLOCK.STEEL_BLOCK : roll < .7 ? BLOCK.BRICK : BLOCK.STONE);
  }
  // Pedestal da Estátua da Liberdade.
  const sx = cx + LIBERTY[0], sz = cz + LIBERTY[1];
  for (let y = 11; y <= 18; y++) { const w = y < 15 ? 3 : 2; for (let ox = -w; ox <= w; ox++) for (let oz = -w; oz <= w; oz++) put(sx + ox, y, sz + oz, BLOCK.STONE); }
  // A estátua em si é um modelo 3D do Blender (landmarks.js) posto sobre este pedestal.
  arrivalGate(put, r);
}

/** Casa inicial para quem começa o mundo numa terra: piso, paredes, janelas, telhado,
 *  porta voltada para o portal, baú, bancada e tochas. Usa world.setBlock (fica salva). */
export function buildStarterHouse(world, key) {
  const r = REALMS[key]; if (!r) return null;
  return buildStarterHouseAt(world, r.center[0], r.center[1]);
}

/** A mesma casa inicial em qualquer ponto do vale (começar num bioma escolhido). */
export function buildStarterHouseAt(world, cx, cz) {
  const x0 = cx - 3, z0 = cz + 7, x1 = cx + 3, z1 = cz + 12;
  // O piso fica na altura do chão em frente à porta, para a porta ser sempre acessível;
  // o terreno do lote é nivelado (cortado por cima, fundação por baixo) e um pátio de
  // pedra na frente cobre buracos e água.
  const ground = (x, z) => world.heightAt(x + .5, z + .5, 40);
  const floor = Math.floor(ground(cx, z0 - 1) ?? ground(cx, z0 - 2) ?? 10);
  const set = (x, y, z, id) => world.setBlock(x, y, z, id);
  const level = (x, z, top, clearTo) => {
    for (let y = floor - 1; y >= 4 && (world.getBlock(x, y, z) === BLOCK.AIR || world.getBlock(x, y, z) === BLOCK.WATER || world.getBlock(x, y, z) === BLOCK.LAVA); y--) set(x, y, z, BLOCK.STONE); // fundação
    set(x, floor, z, top);
    for (let y = floor + 1; y <= floor + clearTo; y++) if (world.getBlock(x, y, z) !== BLOCK.AIR) set(x, y, z, BLOCK.AIR);
  };
  for (let x = cx - 2; x <= cx + 2; x++) for (let z = z0 - 3; z < z0; z++) { const g = ground(x, z); if (g !== floor + 1 || !BLOCKS[world.getBlock(x, floor, z)].solid) level(x, z, BLOCK.STONE, 4); else for (let y = floor + 1; y <= floor + 4; y++) if (world.getBlock(x, y, z) !== BLOCK.AIR) set(x, y, z, BLOCK.AIR); } // pátio: só onde o chão não está no nível
  for (let x = cx + 5; x <= cx + 9; x++) for (let z = z0 - 3; z <= z0 + 4; z++) level(x, z, BLOCK.STONE, 4); // garagem: piso de pedra nivelado ao lado da casa
  let crest = floor + 8; for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) crest = Math.max(crest, Math.ceil(ground(x, z) ?? 0)); // morro por cima do lote some inteiro
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
    level(x, z, BLOCK.PLANKS, crest - floor);
    for (let y = floor + 1; y <= floor + 4; y++) {
      const wall = x === x0 || x === x1 || z === z0 || z === z1;
      const window = wall && y === floor + 2 && (x === cx - 2 || x === cx + 2 || z === cz + 10);
      set(x, y, z, !wall ? BLOCK.AIR : window ? BLOCK.GLASS : (x === x0 || x === x1) && (z === z0 || z === z1) ? BLOCK.WOOD : BLOCK.PLANKS);
    }
    set(x, floor + 5, z, BLOCK.BRICK);
  }
  set(cx, floor + 1, z0, BLOCK.DOOR); set(cx, floor + 2, z0, BLOCK.DOOR);
  set(x1 - 1, floor + 1, z1 - 1, BLOCK.CHEST); set(x0 + 1, floor + 1, z1 - 1, BLOCK.WORKBENCH);
  set(x0 + 1, floor + 1, z0 + 1, BLOCK.TORCH); set(x1 - 1, floor + 1, z0 + 1, BLOCK.TORCH);
  set(cx - 1, floor + 1, z0 - 1, BLOCK.TORCH); set(cx + 1, floor + 1, z0 - 1, BLOCK.TORCH);
  return { door: [cx + .5, floor + 1, z0 - 1.6] };
}
