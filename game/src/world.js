import { Underworld } from './underworld.js';
import { realmColumn, decorateRealm, PORTAL_BLOCKS, REALMS, REALM_PORTALS } from './realms.js';
// Tiles 32-35 are side faces; blocks from id 32 on use the tile 8 places later.
export const tileOf = id => id >= 32 ? id + 8 : id;
import { appendFurniture } from './furniture.js';
import { appendBarbecue } from './domestic-models.js';
import * as THREE from 'three';
import { BLOCK, BLOCKS } from './blocks.js';
import { SandSimulation } from './granular.js';
import { validFacing, rampHeight, rotateRamp } from './ramps.js';
import { Geology } from './geology.js';
import { NEW_VISUAL } from './visual.js';

export const CHUNK_SIZE = 16;
export const WORLD_HEIGHT = 64;
const SIZE = CHUNK_SIZE;
const keyFor = (x, z) => `${x},${z}`;
const editKey = (x, y, z) => `${x},${y},${z}`;
const index = (x, y, z) => x + z * SIZE + y * SIZE * SIZE;
const fract = n => n - Math.floor(n);
const smooth = t => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
const tileSize = 16;
const atlasColumns = 8;
const atlasRows = 10;
const fluidNeighbors = [[0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0]];
const FLUID_INTERVAL = .08;
export const FLUID_STEP_BUDGET = 96;
const isFluid = id => id === BLOCK.WATER || id === BLOCK.LAVA;

function seedNumber(value) {
  let hash = 2166136261;
  for (const character of String(value)) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return hash >>> 0;
}

function hash(x, z, seed = 0) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ seed;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function noise(x, z, seed) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = smooth(fract(x)), fz = smooth(fract(z));
  return lerp(lerp(hash(ix, iz, seed), hash(ix + 1, iz, seed), fx),
    lerp(hash(ix, iz + 1, seed), hash(ix + 1, iz + 1, seed), fx), fz);
}

/** Líquidos vivos: a superfície ondula, o brilho corre e a lava pulsa. Só muda o desenho;
 *  a física da água (níveis e espalhamento) continua no CPU. */
function animateFluid(material, clock, lava, sky) {
  material.onBeforeCompile = shader => {
    shader.uniforms.uTime = clock;
    const head = 'uniform float uTime;\nvarying vec2 vFluidXZ;\nvarying vec3 vFluidPos;\nvarying float vFluidTop;\n';
    shader.vertexShader = head + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 fluidWorld = modelMatrix * vec4(transformed, 1.0);
      vFluidXZ = fluidWorld.xz; vFluidPos = fluidWorld.xyz; vFluidTop = step(0.5, normal.y);
      if (normal.y > 0.5) transformed.y += ${lava ? 'sin(uTime * 0.9 + fluidWorld.x * 0.7 + fluidWorld.z * 0.5) * 0.035 - 0.04' : 'sin(uTime * 1.7 + fluidWorld.x * 0.9 + fluidWorld.z * 0.7) * 0.045 + sin(uTime * 2.3 - fluidWorld.z * 1.1) * 0.03 - 0.07'};`);
    shader.fragmentShader = head + shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      ${lava
        ? 'diffuseColor.rgb *= 0.82 + 0.28 * sin(uTime * 1.3 + vFluidXZ.x * 1.4 + sin(vFluidXZ.y * 1.1 + uTime * 0.6) * 2.0);'
        : 'float ripple = sin(uTime * 2.0 + vFluidXZ.x * 2.1 + sin(vFluidXZ.y * 1.7 + uTime) * 1.5) * sin(uTime * 1.3 - vFluidXZ.y * 1.6); diffuseColor.rgb *= 0.92 + 0.14 * ripple; diffuseColor.a = min(1.0, diffuseColor.a + 0.05 * ripple);'}`);
    if (!sky) return;
    // Visual novo: a superfície reflete o céu (mais de raspão, menos de cima) e o sol
    // faz um brilho que corre pelas ondas. Sem render extra: o céu é o mesmo degradê do domo.
    Object.assign(shader.uniforms, { uSkyTop: sky.top, uSkyHorizon: sky.horizon, uSkyGlow: sky.glow, uSunDir: sky.sunDir });
    // Os tracinhos do atlas somem quase todos: a água fica lisa e o que dá vida é o reflexo.
    shader.fragmentShader = shader.fragmentShader.replace('float ripple = sin(', 'diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.1, 0.43, 0.6), 0.78 * vFluidTop); float ripple = sin(');
    shader.fragmentShader = 'uniform vec3 uSkyTop; uniform vec3 uSkyHorizon; uniform vec3 uSkyGlow; uniform vec3 uSunDir;\n' + shader.fragmentShader.replace('#include <opaque_fragment>', `
      if (vFluidTop > 0.5) {
        float wx = cos(uTime * 1.7 + vFluidPos.x * 0.9 + vFluidPos.z * 0.7) * 0.9 * 0.045 + cos(uTime * 2.6 + vFluidPos.x * 2.3 - vFluidPos.z * 1.4) * 2.3 * 0.012;
        float wz = cos(uTime * 1.7 + vFluidPos.x * 0.9 + vFluidPos.z * 0.7) * 0.7 * 0.045 - cos(uTime * 2.3 - vFluidPos.z * 1.1) * 1.1 * 0.03 - cos(uTime * 2.6 + vFluidPos.x * 2.3 - vFluidPos.z * 1.4) * 1.4 * 0.012;
        vec3 wn = normalize(vec3(-wx * 2.2, 1.0, -wz * 2.2));
        vec3 view = normalize(cameraPosition - vFluidPos);
        float facing = max(dot(wn, view), 0.0);
        float fresnel = 0.08 + 0.72 * pow(1.0 - facing, 3.0);
        vec3 refl = reflect(-view, wn);
        vec3 skyCol = mix(uSkyHorizon, uSkyTop, pow(max(refl.y, 0.0), 0.55));
        float s = max(dot(refl, normalize(uSunDir)), 0.0);
        vec3 glint = uSkyGlow * (pow(s, 220.0) * 1.6 + pow(s, 18.0) * 0.18);
        outgoingLight = mix(outgoingLight, skyCol, fresnel) + glint;
        diffuseColor.a = mix(diffuseColor.a, 0.97, fresnel);
      }
      #include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => lava ? 'fluid-lava' : sky ? 'fluid-water-sky' : 'fluid-water';
}

/** A deliberately tiny, locally generated pixel atlas: no remote textures or assets. */
export function createAtlas() {
  const width = tileSize * atlasColumns, height = tileSize * atlasRows;
  const pixels = new Uint8Array(width * height * 4);
  const colors = BLOCKS.map(block => block.color);
  for (const b of BLOCKS) if (b.id >= 32) colors[tileOf(b.id)] = b.color;
  colors[32]='#7db551';colors[33]='#a78459';colors[34]='#45515b';colors[35]='#78694f';
  // Lisos: transparentes, fluidos e luz não recebem a moldura em relevo.
  const flatTiles = new Set([BLOCK.AIR, BLOCK.GLASS, BLOCK.WATER, BLOCK.LAVA, BLOCK.TORCH, BLOCK.PORTAL, BLOCK.LEAVES, ...REALM_PORTALS.map(tileOf), tileOf(BLOCK.SAKURA)]);
  // Chão natural: relevo bem leve para o terreno não parecer piso de azulejo.
  const softTiles = new Set([32, BLOCK.GRASS, BLOCK.DIRT, BLOCK.SAND, BLOCK.SNOW, BLOCK.CLAY, tileOf(BLOCK.DRY_EARTH), BLOCK.ASPHALT, 34]);
  const parse = hex => [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16));
  for (let tile = 0; tile < atlasColumns*atlasRows; tile++) {
    const base = parse(colors[tile] || '#8b8d83');
    for (let y = 0; y < tileSize; y++) for (let x = 0; x < tileSize; x++) {
      let rgb = [...base], alpha = 255;
      const random = hash(x + tile * 23, y + tile * 7, 7919);
      const grain = hash((x >> 1) + tile * 23, (y >> 1) + tile * 7, 7919);
      let variance = (grain - .5) * 20;
      if (tile === BLOCK.GRASS) {
        const fringe = 11 + Math.round(Math.sin(x * 1.25) * 1.2 + hash(x >> 1, 0, 43));
        rgb = parse(y > fringe ? '#78ad4c' : y === fringe ? '#5f9140' : '#8f6b4c');
        if (y < fringe && grain > .86) rgb = parse('#a98a66');
      }
      if ([BLOCK.STONE,BLOCK.ORE,BLOCK.COAL,BLOCK.COPPER,BLOCK.GOLD,BLOCK.CRYSTAL,BLOCK.DIAMOND].includes(tile)) {
        const row = Math.floor(y / 5), cx = (x + (row % 2) * 3) % 7, cy = y % 5;
        const seam = cx === 0 || cy === 0, lit = cx === 1 || cy === 1;
        rgb = parse('#8c979c'); variance = seam ? -30 : lit ? 14 : (grain - .5) * 12;
        const gem = (x > 3 && x < 7 && y > 4 && y < 8) || (x > 10 && x < 14 && y > 10 && y < 14);
        if (tile !== BLOCK.STONE && gem) { rgb = parse(BLOCKS[tile].color); variance = (x + y) % 4 === 0 ? 38 : (x === 6 || y === 13) ? -24 : 6; }
      }
      if (tile === BLOCK.WOOD) { const groove = (x + Math.floor(y / 6) * 2) % 5 === 0; variance = groove ? -34 : (x + Math.floor(y / 6) * 2) % 5 === 1 ? 14 : (grain - .5) * 10; }
      if (tile === BLOCK.LEAVES) { // folhinhas: losangos com nervura
        const ox = Math.floor(hash(Math.floor(y / 4), 3, 977) * 4), cx = (x + ox) % 4, cy = y % 4, leaf = hash(Math.floor((x + ox) / 4), Math.floor(y / 4), 991);
        const d = Math.abs(cx - 1.5) + Math.abs(cy - 1.5);
        variance = d > 2.2 ? -26 : leaf > .7 && cx === 1 ? 20 : leaf < .25 ? -12 : 4 + (grain - .5) * 10;
      }
      if (tile === BLOCK.GLASS) {
        const border = x < 1 || x > 14 || y < 1 || y > 14;
        rgb = parse(border ? '#c7ecdf' : '#9ee1e1'); alpha = border ? 230 : 55;
        if (x === y || x === y + 1) alpha = 125;
      }
      if (tile === BLOCK.SAND) variance = (y + Math.round(Math.sin(x * .55) * 1.6)) % 5 === 0 ? 16 : (grain - .5) * 10;
      if (tile === BLOCK.DIRT) { variance = (grain - .5) * 14; if (hash(x >> 1, y >> 1, 211) > .9) { rgb = parse('#ad9273'); variance = 0; } }
      if (tile === BLOCK.WATER) { alpha = 190; variance = y % 6 === 0 && x % 8 < 5 ? 34 : random * 10; }
      if (tile === BLOCK.LAVA) { rgb = parse(Math.sin(x * .7 + Math.sin(y * .6) * 2) > .4 ? '#ffb632' : '#e54d18'); variance = random * 24; }
      if (tile === BLOCK.BRICK) {
        const seam = y % 5 === 0 || (x + (Math.floor(y / 5) % 2) * 4) % 8 === 0;
        if (seam) rgb = parse('#dec9ac');
      }
      if ([BLOCK.PLANKS, BLOCK.RAMP, BLOCK.DOOR, BLOCK.WORKBENCH, BLOCK.CHEST].includes(tile)) {
        const board = Math.floor(y / 5), end = (x + board * 6) % 16;
        if (y % 5 === 0) variance = -36; else if (end === 0) variance = -24; else variance = (grain - .5) * 10 + (y % 5 === 1 ? 10 : 0);
        if (tile === BLOCK.PLANKS && end === 1 && board % 2 === 0 && y % 5 === 2) { rgb = parse('#6b6f73'); variance = 0; }
        if (tile === BLOCK.PLANKS && board === 1 && Math.abs(x - 9) + Math.abs(y - 7) < 2) variance = -26;
        if (tile === BLOCK.DOOR && (x < 2 || x > 13 || y % 8 === 0)) rgb = parse('#795d3e');
        if (tile === BLOCK.DOOR && x === 12 && y === 7) rgb = parse('#f2c965');
        if (tile === BLOCK.WORKBENCH && (x % 5 === 0 || y % 5 === 0)) rgb = parse('#594938');
        if (tile === BLOCK.CHEST && (x < 2 || x > 13 || y === 10)) rgb = parse('#584f43');
        if (tile === BLOCK.CHEST && x > 6 && x < 10 && y > 7 && y < 11) rgb = parse('#f6d883');
      }
      if (tile === BLOCK.TORCH) { rgb = parse(y > 8 ? '#ffd26e' : '#775035'); }
      if (tile === 33) { // Growth rings for end grain.
        const radius = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
        variance += Math.floor(radius) % 3 === 0 ? -35 : 9;
      }
      if (tile === 32) { // topo da grama: trevos claros e florzinhas
        const clover = (Math.abs(x - 4) + Math.abs(y - 4) < 2) || (Math.abs(x - 11) + Math.abs(y - 9) < 2) || (Math.abs(x - 6) + Math.abs(y - 13) < 2);
        if (clover) { rgb = parse('#8cc45c'); variance = 2; }
        if ((x === 12 && y === 3) || (x === 2 && y === 10)) { rgb = parse(x === 12 ? '#ffe680' : '#ffffff'); variance = 0; }
      }
      if (tile === 34) { rgb = parse(x > 5 && x < 10 ? '#efd48b' : '#45515b'); }
      if (tile === 35) { if (x < 2 || x > 13 || y < 2 || y > 13) rgb = parse('#4f493b'); }
      if (tile === tileOf(BLOCK.DRY_EARTH)) { const crack=(x===Math.floor(4+Math.sin(y*.9)*2)&&y<11)||(y===Math.floor(9+Math.sin(x*.7)*1.5)&&x>3&&x<14)||(x===12&&y>10); variance = crack ? -42 : random * 22 - 11; }
      if (tile === tileOf(BLOCK.CACTUS)) { variance = x % 4 === 0 ? -26 : x % 4 === 2 ? 10 : 0; if ((x * 3 + y * 5) % 11 === 0) rgb = parse('#f1e7b2'); }
      if (tile === tileOf(BLOCK.BONE)) { variance = (y === 3 || y === 12) ? -30 : random * 10; if (x < 2 || x > 13) variance -= 14; }
      if (tile === tileOf(BLOCK.DIAMOND_BLOCK)) { variance = (x % 8 === 0 || y % 8 === 0) ? -40 : (x + y) % 7 === 0 ? 40 : random * 10; }
      if (tile === tileOf(BLOCK.EMERALD) || tile === tileOf(BLOCK.TOPAZ)) { rgb = parse('#87949b'); variance = random * 26 - 13; if ((x > 3 && x < 7 && y > 4 && y < 8) || (x > 9 && x < 13 && y > 9 && y < 13) || (x === 11 && y === 3)) { rgb = parse(tile === tileOf(BLOCK.EMERALD) ? '#2fbf71' : '#f29a3b'); variance = (x + y) % 3 === 0 ? 40 : 0; } }
      if ([BLOCK.RUBY_BLOCK, BLOCK.GOLD_BLOCK, BLOCK.URANIUM_BLOCK].map(tileOf).includes(tile)) { variance = (x % 8 === 0 || y % 8 === 0) ? -38 : (x + y) % 7 === 0 ? 38 : (grain - .5) * 10; }
      if (tile === tileOf(BLOCK.RUBY) || tile === tileOf(BLOCK.URANIUM)) { rgb = parse('#8c979c'); variance = (grain - .5) * 14; if ((x > 3 && x < 7 && y > 4 && y < 8) || (x > 9 && x < 13 && y > 9 && y < 13) || (x === 11 && y === 3)) { rgb = parse(BLOCKS[tile - 8].color); variance = (x + y) % 3 === 0 ? 40 : 0; } }
      if (tile === tileOf(BLOCK.BAMBOO)) { variance = y % 6 === 0 ? -30 : x % 5 === 0 ? -16 : x % 5 === 2 ? 14 : 0; }
      if (tile === tileOf(BLOCK.RED_LACQUER)) { variance = (grain - .5) * 6; if (y === 2 || y === 13) { rgb = parse('#e7b74a'); variance = 0; } }
      if (tile === tileOf(BLOCK.SAKURA)) { const ox = Math.floor(hash(Math.floor(y / 4), 5, 977) * 4), cx = (x + ox) % 4, cy = y % 4, d = Math.abs(cx - 1.5) + Math.abs(cy - 1.5); variance = d > 2.2 ? -24 : (cx === 1 && cy === 1) ? 26 : (grain - .5) * 12; if (cx === 2 && cy === 2 && hash(x >> 2, y >> 2, 31) > .6) { rgb = parse('#ffffff'); variance = 0; } }
      if (tile === tileOf(BLOCK.RED_ROCK)) { const band = Math.floor((y + Math.round(Math.sin(x * .4))) / 3) % 3; variance = band === 0 ? -18 : band === 1 ? 10 : 0; variance += (grain - .5) * 8; }
      if (tile === tileOf(BLOCK.CALCADAO)) { const wave = Math.floor(y + Math.sin(x * .55) * 2.4) % 8 < 4; rgb = parse(wave ? '#1d1f22' : '#efece2'); variance = (grain - .5) * 10; }
      if (tile === tileOf(BLOCK.STEEL_BLOCK)) { variance = (x % 8 === 0 || y % 4 === 0) ? -26 : (x + y) % 9 === 0 ? 22 : (grain - .5) * 8; if ((x % 8 === 3 || x % 8 === 4) && y % 4 === 2) variance = 30; }
      if (tile === tileOf(BLOCK.VERDIGRIS)) { variance = (grain - .5) * 18 + (y % 5 === 0 ? -14 : 0); }
      if (tile === tileOf(BLOCK.BAUXITE)) { rgb = parse('#b8754e'); variance = (grain - .5) * 22; if ((x * 5 + y * 3) % 7 === 0 || (x > 9 && y < 5)) { rgb = parse('#e7b48a'); variance = 0; } }
      if (tile === tileOf(BLOCK.EMERALD_BLOCK)) { variance = (x % 8 === 0 || y % 8 === 0) ? -38 : (x + y) % 7 === 0 ? 38 : (grain - .5) * 10; }
      if (tile === tileOf(BLOCK.OBSIDIAN)) { variance = (grain - .5) * 12; if (hash(x >> 1, y >> 1, 53) > .88) { rgb = parse('#7b4fc4'); variance = 0; } }
      if (tile === tileOf(BLOCK.BASALT)) { variance = (x % 5 === 0) ? -22 : (y % 7 === 0 && x % 5 > 1) ? -14 : (grain - .5) * 12; }
      if (tile === tileOf(BLOCK.MAGMA)) { const crack = Math.abs(Math.sin(x * .9 + y * .3) + Math.cos(y * .8 - x * .2)) < .35; rgb = parse(crack ? '#ffb238' : '#4a2116'); variance = crack ? (grain - .5) * 30 : (grain - .5) * 14; }
      if (tile === BLOCK.COPPER_BLOCK) { variance = (x % 8 === 0 || y % 8 === 0) ? -34 : (x + y) % 9 === 0 ? 30 : random * 8; }
      if (tile === BLOCK.FORGE) {rgb=parse('#434b51');variance=random*14-7;}
      if (!flatTiles.has(tile)) {
        const edge = Math.min(x, y, 15 - x, 15 - y), corner = Math.min(x, 15 - x) + Math.min(y, 15 - y);
        const soft = softTiles.has(tile);
        if (soft) { if (edge === 0) variance -= corner === 0 ? 12 : 5; }
        else if (edge === 0) variance -= corner === 0 ? 34 : 18; else if (edge === 1) variance += corner <= 2 ? -10 : 9;
      }
      const pixel = ((Math.floor(tile / atlasColumns) * tileSize + y) * width + (tile % atlasColumns) * tileSize + x) * 4;
      pixels[pixel] = Math.max(0, Math.min(255, rgb[0] + variance));
      pixels[pixel + 1] = Math.max(0, Math.min(255, rgb[1] + variance));
      pixels[pixel + 2] = Math.max(0, Math.min(255, rgb[2] + variance));
      pixels[pixel + 3] = alpha;
    }
  }
  const texture = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

// Corners are counterclockwise when seen from outside the cube.
const faces = [
  { normal: [1, 0, 0], corners: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], shade: .84 },
  { normal: [-1, 0, 0], corners: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], shade: .77 },
  { normal: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], shade: 1 },
  { normal: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: .57 },
  { normal: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], shade: .91 },
  { normal: [0, 0, -1], corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], shade: .8 },
];

export class VoxelWorld {
  constructor(scene, seed = 'vale-2026', edits = [], fluidState = null, options = {}) {
    this.scene = scene;
    this.seed = String(seed);
    this.seedHash = seedNumber(seed);
    this.televisions=new Set((Array.isArray(options.televisions)?options.televisions:[]).filter(k=>typeof k==='string'&&/^-?\d+,\d+,-?\d+$/.test(k)));
    this.generatorVersion=[2,3].includes(options.generatorVersion)?options.generatorVersion:1;
    this.chunks = new Map();
    this.edits = new Map();
    this.editsByChunk = new Map();
    this.dirty = new Set();
    this.revision = 0;
    this.lastCenter = '';
    this.pending = [];
    // Flowing liquids share metadata; their block ID identifies the material.
    // Unannotated liquid, including older saves, is a source. Never load chunks.
    this.fluidLevels = new Map();
    this.fluidQueue = [];
    this.fluidQueued = new Set();
    this.fluidHead = 0;
    this.fluidDeferred = new Map();
    this.fluidTime = 0;
    this.drops = [];
    this.sand = new SandSimulation(this,options.dynamics);
    this.lastFluidWork = 0;
    this.atlas = createAtlas();
    this.portalMaterial=new THREE.MeshBasicMaterial({color:0xb7a4ff,transparent:true,opacity:.65,side:THREE.DoubleSide,depthWrite:false});
    this.realmPortalMaterials=Object.values(REALMS).map(r=>new THREE.MeshBasicMaterial({color:r.color,transparent:true,opacity:.7,side:THREE.DoubleSide,depthWrite:false}));
    this.domesticMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.opaqueMaterial = new THREE.MeshLambertMaterial({ map: this.atlas, vertexColors: true });
    this.transparentMaterial = new THREE.MeshLambertMaterial({ map: this.atlas, vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.torchMaterial = new THREE.MeshLambertMaterial({ map: this.atlas, vertexColors: true, emissive: '#f8b34c', emissiveIntensity: .65 });
    this.lavaMaterial = new THREE.MeshBasicMaterial({ map: this.atlas, vertexColors: true });
    this.fluidClock = { value: 0 };
    this.waterMaterial = new THREE.MeshLambertMaterial({ map: this.atlas, vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.waterSky = NEW_VISUAL ? { top: { value: new THREE.Color(0x4f9be0) }, horizon: { value: new THREE.Color(0xd9eef2) }, glow: { value: new THREE.Color(0xffd59a) }, sunDir: { value: new THREE.Vector3(0, 1, 0) } } : null;
    animateFluid(this.waterMaterial, this.fluidClock, false, this.waterSky); animateFluid(this.lavaMaterial, this.fluidClock, true);
    for (const edit of Array.isArray(edits) ? edits : []) {
      const [x, y, z, id, facing] = Array.isArray(edit) ? edit : [edit.x, edit.y, edit.z, edit.id, edit.facing];
      if ([x, y, z, id].every(Number.isInteger) && y >= 1 && y < WORLD_HEIGHT && BLOCKS[id]) this._saveEdit(x, y, z, id, facing);
    }
    this.geology = new Geology(this, options.geology);this.underworld=new Underworld(this,options.underworld);
    for (const entry of Array.isArray(fluidState?.levels) ? fluidState.levels : []) {
      if (!Array.isArray(entry)) continue;
      const [x, y, z, level, falling] = entry;
      if ([x, y, z, level].every(Number.isInteger) && y > 0 && y < WORLD_HEIGHT && level >= 1 && level <= 7 && isFluid(this.edits.get(editKey(x, y, z))?.id)) {
        this.fluidLevels.set(editKey(x, y, z), { level, falling: !!falling });
      }
    }
    for (const entry of Array.isArray(fluidState?.pending) ? fluidState.pending : []) {
      if (Array.isArray(entry) && entry.length === 3 && entry.every(Number.isInteger)) this._queueFluid(...entry);
    }
    for (const drop of Array.isArray(fluidState?.drops) ? fluidState.drops : []) {
      if (drop && [drop.x, drop.y, drop.z].every(Number.isInteger) && drop.id === BLOCK.TORCH && drop.count === 1) this.drops.push({ ...drop });
    }
  }

  _saveEdit(x, y, z, id, facing = 0) {
    const key = editKey(x, y, z);
    const record = { x, y, z, id };
    if(id === BLOCK.RAMP) record.facing = validFacing(facing);
    this.edits.set(key, record);
    const chunkKey = keyFor(Math.floor(x / SIZE), Math.floor(z / SIZE));
    if (!this.editsByChunk.has(chunkKey)) this.editsByChunk.set(chunkKey, new Map());
    this.editsByChunk.get(chunkKey).set(key, record);
  }

  _column(x, z) {
    const n = noise(x / 47, z / 47, this.seedHash);
    const detail = noise(x / 15, z / 15, this.seedHash + 39);
    const distance = Math.max(Math.abs(x), Math.abs(z));
    const weight = smooth(Math.max(0, Math.min(1, (distance - 22) / 20)));
    let height = Math.floor(lerp(8, 7 + n * 13 + detail * 4, weight));
    let biome = noise(x / 105 + 83, z / 105 - 16, this.seedHash + 1009) > .66 ? 'areal' : n > .67 ? 'serra' : 'bosque';
    if (distance <= 26) biome = 'campina';
    const realm = realmColumn(x, z, this.seedHash); if (realm) return realm;
    if(this.generatorVersion>=2 && distance>48){
      const heat=noise(x/160+31,z/160-53,this.seedHash+402);
      const moisture=noise(x/120-61,z/120+29,this.seedHash+913);
      biome=heat<.34?'nevasca':heat>.64&&moisture<.52?'deserto':moisture>.66?'floresta':moisture<.3?'meseta':n>.66?'serra':'pradaria';
      const target=biome==='nevasca'?14+n*19:biome==='deserto'?8+n*9:biome==='meseta'?10+Math.floor(n*5)*3:biome==='pradaria'?8+n*5:8+n*15;
      height=Math.floor(lerp(height,target,smooth(Math.min(1,(distance-48)/32))));
    }
    // New worlds vary the surrounding lake as well as terrain, biomes and trees.
    // Keep the old layout for saved generators and a level, usable starter clearing.
    const varied=this.generatorVersion>=3;
    const lakeX=varied?-38-Math.floor(hash(1,2,this.seedHash)*14):-35;
    const lakeZ=varied?10+Math.floor(hash(3,4,this.seedHash)*28):18;
    const lake = ((x - lakeX) / (varied?8+hash(5,6,this.seedHash)*6:11)) ** 2 + ((z - lakeZ) / (varied?7+hash(7,8,this.seedHash)*5:9)) ** 2;
    let water = false;
    if (lake < 1.22) { height = lake < .65 ? 5 : lake < 1 ? 6 : 7; water = true; biome = 'lago'; }
    else if (lake < 1.75) { height = 8; biome = 'praia'; }
    // The road continues through every generated biome. A broad graded verge
    // blends its level shoulders back into the hills instead of cutting a canyon.
    // Beyond 22 blocks from the road center, lakes and natural terrain are intact.
    const roadDistance = Math.abs(x - 3.5);
    if (roadDistance < 22) {
      const terrainWeight = smooth(Math.max(0, Math.min(1, (roadDistance - 4) / 18)));
      height = Math.round(lerp(8, height, terrainWeight));
    }
    const surface = ['areal', 'praia', 'lago','deserto'].includes(biome) ? BLOCK.SAND : biome==='nevasca'?BLOCK.SNOW:biome==='meseta'?BLOCK.CLAY:biome === 'serra' && height > 20 ? BLOCK.STONE : BLOCK.GRASS;
    return { height, surface, water, biome };
  }

  biomeAt(x, z) { return this._column(x, z).biome; }

  _generate(cx, cz) {
    const key = keyFor(cx, cz);
    if (this.chunks.has(key)) return this.chunks.get(key);
    const data = new Uint8Array(SIZE * SIZE * WORLD_HEIGHT);
    const chunk = { cx, cz, key, data, meshes: [], generated: true };
    const baseX = cx * SIZE, baseZ = cz * SIZE;
    const put = (x, y, z, id) => {
      if (x >= baseX && x < baseX + SIZE && z >= baseZ && z < baseZ + SIZE && y >= 0 && y < WORLD_HEIGHT) data[index(x - baseX, y, z - baseZ)] = id;
    };
    for (let lz = 0; lz < SIZE; lz++) for (let lx = 0; lx < SIZE; lx++) {
      const x = baseX + lx, z = baseZ + lz;
      const info = this._column(x, z);
      for (let y = 0; y <= info.height; y++) {
        let id = y === info.height ? info.surface : y >= info.height - 3 ? BLOCK.DIRT : BLOCK.STONE;
        if (info.surface === BLOCK.SAND && y >= info.height - 2) id = BLOCK.SAND;
        if (info.fill && y > 3 && y < info.height) id = info.fill; // terras com rocha própria (paredões do cânion)
        if (y > 1 && y < info.height - 3 && Math.max(Math.abs(x), Math.abs(z)) > 25) {
          const cave = Math.sin(x * .155 + Math.sin(z * .06) * 2) + Math.cos(z * .16 + y * .58) + Math.sin(y * .7 + x * .034);
          if (cave > 2.04) id = BLOCK.AIR;
          else if (hash(x + y * 173, z - y * 311, this.seedHash) > .965) id = BLOCK.ORE;
        } else if (y > 1 && y < info.height - 3 && hash(x + y * 173, z - y * 311, this.seedHash) > .98) id = BLOCK.ORE;
        if(id===BLOCK.ORE && this.generatorVersion>=2){
          const mineral=hash(Math.floor(x/3)+Math.floor(y/2)*31,Math.floor(z/3),this.seedHash+271);
          id=y<7&&mineral>.78?BLOCK.CRYSTAL:y<12&&mineral>.6?BLOCK.GOLD:mineral<.27?BLOCK.COAL:mineral<.54?BLOCK.COPPER:BLOCK.ORE;
        }
        put(x, y, z, this.geology.mineral(x, y, z, id));
      }
      if (info.water) for (let y = info.height + 1; y <= 8; y++) put(x, y, z, BLOCK.WATER);
      if (x >= 2 && x <= 5 && !REALMS[info.biome]) put(x, 8, z, BLOCK.ASPHALT); // a estrada do vale não atravessa as outras terras
    }
    // Candidate positions come from a world-space grid, including adjacent chunks;
    // tree canopies therefore agree at chunk boundaries and after unloading.
    for (let gz = Math.floor((baseZ - 3) / 7); gz <= Math.floor((baseZ + SIZE + 2) / 7); gz++) {
      for (let gx = Math.floor((baseX - 3) / 7); gx <= Math.floor((baseX + SIZE + 2) / 7); gx++) {
        const x = gx * 7 + Math.floor(hash(gx, gz, this.seedHash + 41) * 5);
        const z = gz * 7 + Math.floor(hash(gx, gz, this.seedHash + 67) * 5);
        const info = this._column(x, z);
        const realm = REALMS[info.biome];
        if (realm && (info.surface !== BLOCK.GRASS || Math.max(Math.abs(x - realm.center[0]), Math.abs(z - realm.center[1])) < 15)) continue; // nas terras: só na grama e fora da clareira da chegada
        if (Math.max(Math.abs(x), Math.abs(z)) < 19 || Math.abs(x - 3.5) < 9 || info.water || ![BLOCK.GRASS,BLOCK.SNOW].includes(info.surface)) continue;
        const density=info.biome==='pradaria'?.08:info.biome==='floresta'?.9:info.biome==='nevasca'?.32:info.biome==='bosque'?.67:.35;
        if (hash(gx, gz, this.seedHash + 197) > density) continue;
        const trunk = 4 + Math.floor(hash(gx, gz, this.seedHash + 29) * 2), top = info.height + trunk;
        for (let y = info.height + 1; y <= top; y++) put(x, y, z, BLOCK.WOOD);
        for (let dy = -1; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
          if (Math.abs(dx) + Math.abs(dz) + Math.max(0, dy) > 4 || (dx === 0 && dz === 0 && dy <= 0)) continue;
          put(x + dx, top + dy, z + dz, BLOCK.LEAVES);
          if(info.biome==='nevasca'&&dy===2)put(x+dx,top+dy+1,z+dz,BLOCK.SNOW);
        }
      }
    }
    this.geology.apply(put, baseX, baseZ, SIZE);
    this._starterStructures(put, baseX, baseZ);
    this.underworld.apply(put,baseX,baseZ,SIZE);
    decorateRealm(put,this,baseX,baseZ,SIZE);
    for (const edit of this.editsByChunk.get(key)?.values() || []) put(edit.x, edit.y, edit.z, edit.id);
    this.chunks.set(key, chunk);
    this.dirty.add(key);
    const deferred = this.fluidDeferred.get(key);
    this.fluidDeferred.delete(key);
    for (const position of deferred?.values() || []) this._queueFluid(...position);
    for (let y = 1; y < WORLD_HEIGHT; y++) for (let z = 0; z < SIZE; z++) for (let x = 0; x < SIZE; x++) {
      const id = data[index(x, y, z)];
      if (isFluid(id)) this._queueFluidAround(baseX + x, y, baseZ + z);
      else if (id === BLOCK.TORCH) this._queueFluid(baseX + x, y, baseZ + z);
      else if(id===BLOCK.SAND)this.sand.queue(baseX+x,y,baseZ+z);
    }
    // A newly loaded neighbor can supply or receive water at either side of a
    // chunk boundary, including a frontier that was saved while unloaded.
    for (let y = 1; y < WORLD_HEIGHT; y++) for (let edge = 0; edge < SIZE; edge++) {
      for (const [x, z] of [[baseX, baseZ + edge], [baseX + SIZE - 1, baseZ + edge], [baseX + edge, baseZ], [baseX + edge, baseZ + SIZE - 1]]) {
        if (isFluid(this._peekBlock(x, y, z)) || fluidNeighbors.some(([dx, dy, dz]) => isFluid(this._peekBlock(x + dx, y + dy, z + dz)))) this._queueFluidAround(x, y, z);
      }
    }
    return chunk;
  }

  _starterStructures(put, baseX, baseZ) {
    if (baseX > 20 || baseX + SIZE < -18 || baseZ > 19 || baseZ + SIZE < -14) return;
    // Timber-frame cottage, with interior headroom and a stepped terracotta roof.
    for (let x = -12; x <= -5; x++) for (let z = -6; z <= 2; z++) {
      put(x, 8, z, BLOCK.PLANKS);
      for (let y = 9; y <= 12; y++) {
        const edge = x === -12 || x === -5 || z === -6 || z === 2;
        let id = edge ? BLOCK.PLANKS : BLOCK.AIR;
        if (edge && ((x === -12 || x === -5) && (z === -6 || z === 2) || y === 12)) id = BLOCK.WOOD;
        if (edge && (y === 10 || y === 11) && (((x === -12 || x === -5) && z >= -3 && z <= -1) || ((z === -6 || z === 2) && (x === -11 || x === -6)))) id = BLOCK.GLASS;
        if (x === -9 && z === 2 && y < 11) id = BLOCK.DOOR;
        put(x, y, z, id);
      }
    }
    for (let x = -13; x <= -4; x++) {
      const roofY = 13 + Math.floor(Math.min(x + 13, -4 - x) * .8);
      for (let z = -7; z <= 3; z++) put(x, roofY, z, BLOCK.BRICK);
      if (x >= -12 && x <= -5) for (let y = 13; y < roofY; y++) { put(x, y, -6, BLOCK.PLANKS); put(x, y, 2, BLOCK.PLANKS); }
    }
    for (let x = -11; x <= -7; x++) for (let z = 3; z <= 4; z++) put(x, 8, z, BLOCK.PLANKS);
    for (let z = 5; z <= 9; z++) { put(-9, 8, z, BLOCK.SAND); put(-8, 8, z, BLOCK.SAND); }
    for (let x = -8; x <= 1; x++) { put(x, 8, 8, BLOCK.SAND); put(x, 8, 9, BLOCK.SAND); }
    put(-11, 9, -4, BLOCK.WORKBENCH);
    put(-6, 9, -4, BLOCK.CHEST);
    if(this.generatorVersion>=3)put(-8,9,-5,BLOCK.FORGE);
    if(this.generatorVersion>=3){put(-11,9,0,BLOCK.SOFA);put(-10,9,0,BLOCK.SOFA);put(-10,9,-4,BLOCK.TV);}
    put(-10, 9, -5, BLOCK.TORCH);
    put(-11, 9, 4, BLOCK.TORCH);
    put(-7, 9, 4, BLOCK.TORCH);
    // Open-front garage, with a clear approach from the road.
    for (let x = 7; x <= 14; x++) for (let z = -9; z <= 2; z++) {
      put(x, 8, z, BLOCK.ASPHALT);
      if (z <= -3) {
        for (let y = 9; y <= 11; y++) {
          let id = x === 7 || x === 14 || z === -9 ? BLOCK.PLANKS : BLOCK.AIR;
          if ((x === 7 || x === 14) && (z === -9 || z === -3)) id = BLOCK.WOOD;
          if (y === 10 && z >= -7 && z <= -5 && (x === 7 || x === 14)) id = BLOCK.GLASS;
          put(x, y, z, id);
        }
        put(x, 12, z, BLOCK.WOOD);
        put(x, 13, z, BLOCK.BRICK);
      }
    }
    for (let x = 5; x <= 7; x++) for (let z = -1; z <= 2; z++) put(x, 8, z, BLOCK.ASPHALT);
    // A four-block jump ramp: drive north from z=16 toward the garage.
    for (let x = 9; x <= 11; x++) for (let z = 11; z <= 14; z++) {
      const y = 23 - z;
      for (let support = 9; support < y; support++) put(x, support, z, BLOCK.PLANKS);
      put(x, y, z, BLOCK.RAMP);
    }
  }

  /**
   * Quanto o ponto está enterrado (0 = céu aberto, 1 = caverna fechada).
   * Amostra as colunas ao redor: cada uma conta como coberta se houver bloco opaco
   * acima do ponto, e só pesa se o ponto estiver abaixo do terreno original — assim
   * uma casa construída na superfície continua clara, mas um túnel na encosta ou
   * um buraco escavado para baixo vai escurecendo.
   */
  burial(x, y, z, radius = 3) {
    const cx = Math.floor(x), cy = Math.floor(y), cz = Math.floor(z);
    if (cy >= WORLD_HEIGHT) return 0;
    let covered = 0, total = 0;
    for (let dz = -radius; dz <= radius; dz++) for (let dx = -radius; dx <= radius; dx++) {
      const weight = 1 / (1 + (dx * dx + dz * dz) * .3);
      total += weight;
      const depth = Math.min(1, Math.max(0, (this._column(cx + dx, cz + dz).height - cy) / 3));
      if (!depth) continue;
      let roof = false;
      for (let yy = cy + 1; yy < WORLD_HEIGHT; yy++) { const block = BLOCKS[this.getBlock(cx + dx, yy, cz + dz)]; if (block?.solid && !block.transparent) { roof = true; break; } }
      if (roof) covered += weight * depth;
    }
    return total ? covered / total : 0;
  }

  getBlock(x, y, z) {
    x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
    if (y < 0) return BLOCK.STONE;
    if (y >= WORLD_HEIGHT) return BLOCK.AIR;
    const cx = Math.floor(x / SIZE), cz = Math.floor(z / SIZE);
    return this._generate(cx, cz).data[index(x - cx * SIZE, y, z - cz * SIZE)];
  }

  setBlock(x, y, z, id, facing = 0) {
    x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
    if (!BLOCKS[id] || y <= 0 || y >= WORLD_HEIGHT) return false;
    if (id === BLOCK.TORCH && !this.canSupportTorch(x, y, z)) return false;
    const previous = this.getBlock(x, y, z);
    if(previous===BLOCK.TV&&id!==BLOCK.TV)this.televisions.delete(editKey(x,y,z));
    const wasFlow = this.fluidLevels.has(editKey(x, y, z));
    if (previous === id && !(isFluid(id) && wasFlow) && !(id === BLOCK.RAMP && this.rampFacingAt(x,y,z) !== validFacing(facing))) return false;
    this.fluidLevels.delete(editKey(x, y, z));
    this._writeBlock(x, y, z, id, facing);
    if (previous === BLOCK.TORCH && id !== BLOCK.AIR && id !== BLOCK.TORCH) this.drops.push({ x, y, z, id: BLOCK.TORCH, count: 1 });
    this._removeUnsupportedTorchesAbove(x, y, z);
    this._queueFluidAround(x, y, z);
    this.sand.queue(x,y,z);this.sand.queue(x,y+1,z);
    return true;
  }

  _writeBlock(x, y, z, id, facing = 0) {
    const cx = Math.floor(x / SIZE), cz = Math.floor(z / SIZE);
    const chunk = this._generate(cx, cz), lx = x - cx * SIZE, lz = z - cz * SIZE;
    chunk.data[index(lx, y, lz)] = id;
    this._saveEdit(x, y, z, id, facing);
    this._dirtyCell(x, z);
    this.revision++;
  }

  _dirtyCell(x, z) {
    const cx = Math.floor(x / SIZE), cz = Math.floor(z / SIZE), lx = x - cx * SIZE, lz = z - cz * SIZE;
    const chunk = this.chunks.get(keyFor(cx, cz));
    if (!chunk) return;
    this.dirty.add(chunk.key);
    if (lx === 0) this.dirty.add(keyFor(cx - 1, cz));
    if (lx === SIZE - 1) this.dirty.add(keyFor(cx + 1, cz));
    if (lz === 0) this.dirty.add(keyFor(cx, cz - 1));
    if (lz === SIZE - 1) this.dirty.add(keyFor(cx, cz + 1));
    if((lx===0||lx===SIZE-1)&&(lz===0||lz===SIZE-1))this.dirty.add(keyFor(cx+(lx===0?-1:1),cz+(lz===0?-1:1)));
  }

  /** Read only resident voxels: fluid work cannot grow the loaded world. */
  _peekBlock(x, y, z) {
    if (y < 1) return BLOCK.STONE;
    if (y >= WORLD_HEIGHT) return BLOCK.AIR;
    const cx = Math.floor(x / SIZE), cz = Math.floor(z / SIZE);
    const chunk = this.chunks.get(keyFor(cx, cz));
    return chunk ? chunk.data[index(x - cx * SIZE, y, z - cz * SIZE)] : null;
  }

  _fluidNeighborBlock(x, y, z) {
    return this._peekBlock(x, y, z) ?? this.edits.get(editKey(x, y, z))?.id ?? null;
  }

  _queueFluid(x, y, z) {
    if (y <= 0 || y >= WORLD_HEIGHT) return;
    const key = editKey(x, y, z), chunkKey = keyFor(Math.floor(x / SIZE), Math.floor(z / SIZE));
    if (!this.chunks.has(chunkKey)) {
      if (!this.fluidDeferred.has(chunkKey)) this.fluidDeferred.set(chunkKey, new Map());
      this.fluidDeferred.get(chunkKey).set(key, [x, y, z]);
    } else if (!this.fluidQueued.has(key)) {
      this.fluidQueued.add(key);
      this.fluidQueue.push([x, y, z]);
    }
  }

  _queueFluidAround(x, y, z) {
    this._queueFluid(x, y, z);
    for (const [dx, dy, dz] of fluidNeighbors) this._queueFluid(x + dx, y + dy, z + dz);
    // A changed floor also changes whether the water above may feed its peers.
    for (const [dx, , dz] of fluidNeighbors.slice(1, 5)) this._queueFluid(x + dx, y + 1, z + dz);
  }

  canSupportTorch(x, y, z) {
    x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
    if (y <= 0 || y >= WORLD_HEIGHT || this.getBlock(x, y, z) === BLOCK.WATER) return false;
    const support = this.getBlock(x, y - 1, z);
    return !!BLOCKS[support]?.solid && support !== BLOCK.RAMP && support !== BLOCK.DOOR;
  }

  _breakUnsupportedTorch(x, y, z) {
    if (this._peekBlock(x, y, z) !== BLOCK.TORCH || this.canSupportTorch(x, y, z)) return false;
    this._writeBlock(x, y, z, BLOCK.AIR);
    this.drops.push({ x, y, z, id: BLOCK.TORCH, count: 1 });
    this._queueFluidAround(x, y, z);
    return true;
  }

  _removeUnsupportedTorchesAbove(x, y, z) {
    while (++y < WORLD_HEIGHT && this._breakUnsupportedTorch(x, y, z)) { /* Legacy stacks collapse once each. */ }
  }

  drainDrops() { return this.drops.splice(0); }

  getWaterLevel(x, y, z) {
    x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
    return this.getBlock(x, y, z) === BLOCK.WATER ? this.fluidLevels.get(editKey(x, y, z))?.level ?? 0 : null;
  }

  waterSurfaceAt(x, y, z) {
    return this.fluidSurfaceAt(x, y, z, BLOCK.WATER);
  }

  fluidSurfaceAt(x, y, z, id) {
    const bx=Math.floor(x),by=Math.floor(y),bz=Math.floor(z);
    if(!isFluid(id)||this.getBlock(bx,by,bz)!==id)return null;
    if(this.getBlock(bx,by+1,bz)===id)return by+1;
    const a=this.waterCornerHeight(bx,by,bz,id),b=this.waterCornerHeight(bx+1,by,bz,id);
    const c=this.waterCornerHeight(bx,by,bz+1,id),d=this.waterCornerHeight(bx+1,by,bz+1,id);
    return by+lerp(lerp(a,b,fract(x)),lerp(c,d,fract(x)),fract(z));
  }

  waterCornerHeight(x,y,z,id=BLOCK.WATER){
    let total=0,weights=0;
    for(const dx of [-1,0])for(const dz of [-1,0]){
      if(this._peekBlock(x+dx,y,z+dz)!==id)continue;
      const flow=this.fluidLevels.get(editKey(x+dx,y,z+dz));
      if(this._peekBlock(x+dx,y+1,z+dz)===id||flow?.falling)return 1;
      const weight=flow?1:4;
      total+=.89*(8-(flow?.level??0))/8*weight;weights+=weight;
    }
    return weights?total/weights:0;
  }

  _canSpreadWater(x, y, z, id=BLOCK.WATER) {
    const below = this._fluidNeighborBlock(x, y - 1, z);
    // Waterfalls descend before spreading; sources within a lake also support
    // the layer above, so digging along its shore immediately opens a channel.
    return below !== null && (BLOCKS[below]?.solid || below === id && !this.fluidLevels.has(editKey(x, y - 1, z)));
  }

  _stepFluidCell(x, y, z) {
    let id = this._peekBlock(x, y, z);
    if (id === null) { this._queueFluid(x, y, z); return; }
    if (id === BLOCK.TORCH && this._breakUnsupportedTorch(x, y, z)) {
      this._removeUnsupportedTorchesAbove(x, y, z);
      id = BLOCK.AIR;
    }
    const key = editKey(x, y, z), current = this.fluidLevels.get(key);
    if (isFluid(id) && !current || !isFluid(id) && id !== BLOCK.AIR && id !== BLOCK.TORCH) return;
    let desired = null;
    let material = isFluid(id) ? id : null;
    const unknownNeighbors = [];
    const above = this._peekBlock(x, y + 1, z);
    // Existing water and lava never overwrite one another.
    if (isFluid(above) && (!material || material === above)) { material = above; desired = { level: 1, falling: true }; }
    else {
      for (const [dx, , dz] of fluidNeighbors.slice(1, 5)) {
        const neighborBlock = this._fluidNeighborBlock(x + dx, y, z + dz);
        if (neighborBlock === null) unknownNeighbors.push([Math.floor((x + dx) / SIZE), Math.floor((z + dz) / SIZE)]);
        if (!isFluid(neighborBlock) || material && material !== neighborBlock || !this._canSpreadWater(x + dx, y, z + dz, neighborBlock)) continue;
        const neighbor = this.fluidLevels.get(editKey(x + dx, y, z + dz));
        const level = (neighbor?.falling ? 0 : neighbor?.level ?? 0) + 1;
        if (level <= 7 && (!desired || level < desired.level)) { material = neighborBlock; desired = { level, falling: false }; }
      }
    }
    // Lagos se refazem: um buraco (ou correnteza) com duas fontes de água ao lado e
    // apoio embaixo vira fonte de novo, então o balde não deixa "bloco quebrado" no lago.
    if ((material === BLOCK.WATER || !material) && id !== BLOCK.LAVA && desired?.falling !== true) {
      let sources = 0;
      for (const [dx, , dz] of fluidNeighbors.slice(1, 5)) {
        if (this._fluidNeighborBlock(x + dx, y, z + dz) === BLOCK.WATER && !this.fluidLevels.has(editKey(x + dx, y, z + dz))) sources++;
      }
      const below = this._fluidNeighborBlock(x, y - 1, z);
      if (sources >= 2 && below !== null && (BLOCKS[below]?.solid || below === BLOCK.WATER && !this.fluidLevels.has(editKey(x, y - 1, z)))) {
        if (current || id !== BLOCK.WATER) {
          this.fluidLevels.delete(key);
          if (id === BLOCK.TORCH) this.drops.push({ x, y, z, id: BLOCK.TORCH, count: 1 });
          this._writeBlock(x, y, z, BLOCK.WATER);
          this._queueFluidAround(x, y, z);
        }
        return;
      }
    }
    if (current && unknownNeighbors.length && (!desired || desired.level > current.level || current.falling && !desired.falling)) {
      // An unloaded donor is unknown, not removed. Freeze dependent flow and
      // retry when that chunk returns, rather than draining the visible edge.
      for (const [cx, cz] of unknownNeighbors) {
        const chunkKey = keyFor(cx, cz);
        if (!this.fluidDeferred.has(chunkKey)) this.fluidDeferred.set(chunkKey, new Map());
        this.fluidDeferred.get(chunkKey).set(key, [x, y, z]);
      }
      return;
    }
    if (!desired && !isFluid(id) || desired && current?.level === desired.level && current.falling === desired.falling) return;
    if (desired) {
      this.fluidLevels.set(key, desired);
      if (id === BLOCK.TORCH) this.drops.push({ x, y, z, id: BLOCK.TORCH, count: 1 });
      this._writeBlock(x, y, z, material);
    } else {
      this.fluidLevels.delete(key);
      this._writeBlock(x, y, z, BLOCK.AIR);
    }
    this._removeUnsupportedTorchesAbove(x, y, z);
    this._queueFluidAround(x, y, z);
  }

  /** Fixed cadence and bounded work; unloaded frontiers resume on regeneration. */
  step(dt, _x, _z) {
    this.sand.step(dt);
    this.lastFluidWork = 0;
    this.fluidTime = Math.min(FLUID_INTERVAL, this.fluidTime + Math.max(0, Number.isFinite(dt) ? dt : 0));
    if (this.fluidTime < FLUID_INTERVAL) return 0;
    this.fluidTime = 0;
    while (this.fluidHead < this.fluidQueue.length && this.lastFluidWork < FLUID_STEP_BUDGET) {
      const position = this.fluidQueue[this.fluidHead++];
      this.fluidQueued.delete(editKey(...position));
      this._stepFluidCell(...position);
      this.lastFluidWork++;
    }
    if (this.fluidHead === this.fluidQueue.length || this.fluidHead > 2048) {
      this.fluidQueue = this.fluidQueue.slice(this.fluidHead);
      this.fluidHead = 0;
    }
    return this.lastFluidWork;
  }

  isSolid(x, y, z) { return BLOCKS[this.getBlock(x, y, z)]?.solid || false; }

  rampFacingAt(x,y,z) { return validFacing(this.edits.get(editKey(Math.floor(x),Math.floor(y),Math.floor(z)))?.facing); }

  /** Highest solid surface below maxY; fractional x/z preserve the ramp slope. */
  heightAt(x, z, maxY = WORLD_HEIGHT) {
    for (let y = Math.min(WORLD_HEIGHT - 1, Math.floor(maxY)); y >= 0; y--) {
      const id = this.getBlock(x, y, z);
      if (!BLOCKS[id].solid) continue;
      const top = id === BLOCK.RAMP ? y + rampHeight(fract(x),fract(z),this.rampFacingAt(x,y,z)) : y + 1;
      if (top <= maxY + .0001) return top;
    }
    return null;
  }

  surfaceHeight(x, z) { return this.heightAt(x, z) ?? 0; }

  /** AABB overlap. min/max are {x,y,z}; max is exclusive. */
  collides(min, max) {
    const epsilon = .00001;
    for (let y = Math.floor(min.y + epsilon); y <= Math.floor(max.y - epsilon); y++) {
      for (let z = Math.floor(min.z + epsilon); z <= Math.floor(max.z - epsilon); z++) {
        for (let x = Math.floor(min.x + epsilon); x <= Math.floor(max.x - epsilon); x++) {
          const id = this.getBlock(x, y, z);
          if (!BLOCKS[id].solid) continue;
          if (id === BLOCK.RAMP) {
            const facing=this.rampFacingAt(x,y,z);
            const lowX=Math.max(0,min.x-x),highX=Math.min(1,max.x-x);
            const lowZ=Math.max(0,min.z-z),highZ=Math.min(1,max.z-z);
            const top=y+Math.max(rampHeight(lowX,lowZ,facing),rampHeight(highX,highZ,facing));
            if(min.y >= top-epsilon)continue;
          }
          return true;
        }
      }
    }
    return false;
  }

  ensureAround(x, z, radius = 1) {
    const cx = Math.floor(x / SIZE), cz = Math.floor(z / SIZE);
    for (let dz = -radius; dz <= radius; dz++) for (let dx = -radius; dx <= radius; dx++) this._generate(cx + dx, cz + dz);
  }

  update(x, z, viewRadius = 3) {
    this.fluidClock.value = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
    const cx = Math.floor(x / SIZE), cz = Math.floor(z / SIZE);
    const radius = Math.max(1, Math.min(6, Math.floor(viewRadius)));
    const center = `${cx},${cz},${radius}`;
    if (center !== this.lastCenter) {
      this.lastCenter = center;
      this.pending = [];
      for (let dz = -radius; dz <= radius; dz++) for (let dx = -radius; dx <= radius; dx++) {
        this.pending.push({ cx: cx + dx, cz: cz + dz, distance: dx * dx + dz * dz });
      }
      this.pending.sort((a, b) => a.distance - b.distance);
      for (const [key, chunk] of this.chunks) {
        const distance = Math.max(Math.abs(chunk.cx - cx), Math.abs(chunk.cz - cz));
        if (distance > radius) this._disposeMeshes(chunk);
        if (distance > radius + 2) { this.chunks.delete(key); this.dirty.delete(key); }
      }
    }
    // Mesh changes nearest to the player first. Limit work to avoid mining hitches.
    const dirty = [...this.dirty].map(key => this.chunks.get(key)).filter(chunk => chunk && Math.abs(chunk.cx - cx) <= radius && Math.abs(chunk.cz - cz) <= radius);
    dirty.sort((a, b) => (a.cx - cx) ** 2 + (a.cz - cz) ** 2 - (b.cx - cx) ** 2 - (b.cz - cz) ** 2);
    let built = 0;
    for (const chunk of dirty) {
      this._buildMesh(chunk);
      if (++built >= 2) break;
    }
    if (built < 2) {
      while (this.pending.length) {
        const target = this.pending.shift(), key = keyFor(target.cx, target.cz);
        const chunk = this._generate(target.cx, target.cz);
        if (!chunk.meshes.length || this.dirty.has(key)) { this._buildMesh(chunk); break; }
      }
    }
    // Queries may have generated a distant chunk without moving the player.
    if (this.chunks.size > (radius * 2 + 5) ** 2) {
      for (const [key, chunk] of this.chunks) if (Math.max(Math.abs(chunk.cx - cx), Math.abs(chunk.cz - cz)) > radius + 2) {
        this._disposeMeshes(chunk); this.chunks.delete(key); this.dirty.delete(key);
      }
    }
  }

  _disposeMeshes(chunk) {
    for (const mesh of chunk.meshes) { this.scene?.remove(mesh); mesh.geometry.dispose(); }
    chunk.meshes = [];
  }

  _buildMesh(chunk) {
    const { cx, cz, data } = chunk;
    const WATER_GROUP = 6 + REALM_PORTALS.length;
    const groups = Array.from({ length: 7 + REALM_PORTALS.length }, (_, i) => i).map(() => ({ positions: [], normals: [], uvs: [], colors: [], indices: [] }));
    const neighborChunks = new Map();
    const peek = (x, y, z) => {
      if (y < 0) return BLOCK.STONE;
      if (y >= WORLD_HEIGHT) return BLOCK.AIR;
      if (x >= 0 && x < SIZE && z >= 0 && z < SIZE) return data[index(x, y, z)];
      const dx = Math.floor(x / SIZE), dz = Math.floor(z / SIZE), key = keyFor(cx + dx, cz + dz);
      if (!neighborChunks.has(key)) neighborChunks.set(key, this._generate(cx + dx, cz + dz));
      return neighborChunks.get(key).data[index(x - dx * SIZE, y, z - dz * SIZE)];
    };
    // Sombra de canto (visual novo): cada vértice escurece conforme os blocos opacos
    // encostados nele, do lado de fora da face. É o que dá volume aos blocos.
    const opaque = (x, y, z) => { const b = peek(x, y, z); return !!b && BLOCKS[b].solid && !BLOCKS[b].transparent; };
    const AO_LEVELS = [.38, .6, .8, 1];
    const cornerShade = (x, y, z, normal, corners) => {
      const axis = normal.findIndex(v => v !== 0), [t1, t2] = [0, 1, 2].filter(i => i !== axis);
      return corners.map(c => {
        const o = [x + normal[0], y + normal[1], z + normal[2]], d1 = [0, 0, 0], d2 = [0, 0, 0];
        d1[t1] = c[t1] ? 1 : -1; d2[t2] = c[t2] ? 1 : -1;
        const s1 = opaque(o[0] + d1[0], o[1] + d1[1], o[2] + d1[2]), s2 = opaque(o[0] + d2[0], o[1] + d2[1], o[2] + d2[2]);
        const k = opaque(o[0] + d1[0] + d2[0], o[1] + d1[1] + d2[1], o[2] + d1[2] + d2[2]);
        return AO_LEVELS[s1 && s2 ? 0 : 3 - s1 - s2 - k];
      });
    };
    const addFace = (group, x, y, z, corners, normal, tile, shade, scale = null, ao = null) => {
      const offset = group.positions.length / 3;
      const inset = .035;
      const u0 = ((tile % atlasColumns) + inset) / atlasColumns, u1 = ((tile % atlasColumns) + 1 - inset) / atlasColumns;
      const v0 = (Math.floor(tile / atlasColumns) + inset) / atlasRows, v1 = (Math.floor(tile / atlasColumns) + 1 - inset) / atlasRows;
      for (let n = 0; n < corners.length; n++) {
        const corner = corners[n], light = ao ? shade * ao[n] : shade;
        group.positions.push(x + (scale ? scale[0] + corner[0] * scale[3] : corner[0]), y + (scale ? scale[1] + corner[1] * scale[4] : corner[1]), z + (scale ? scale[2] + corner[2] * scale[5] : corner[2]));
        group.normals.push(...normal);
        group.colors.push(light, light, light);
      }
      group.uvs.push(u0, v0, u1, v0, u1, v1, u0, v1);
      // Com sombra de canto, a diagonal segue os cantos mais claros (sem "dobra" escura).
      if (ao && ao[0] + ao[2] < ao[1] + ao[3]) group.indices.push(offset + 1, offset + 2, offset + 3, offset + 1, offset + 3, offset);
      else group.indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
    };
    for (let y = 0; y < WORLD_HEIGHT; y++) for (let z = 0; z < SIZE; z++) for (let x = 0; x < SIZE; x++) {
      const id = data[index(x, y, z)];
      if (!id) continue;
      const group = groups[id === BLOCK.LAVA || id === BLOCK.MAGMA ? 3 : id === BLOCK.TORCH ? 2 : id === BLOCK.WATER ? WATER_GROUP : id === BLOCK.GLASS ? 1 : 0];
      if(id===BLOCK.PORTAL||PORTAL_BLOCKS.has(id)){const g=groups[id===BLOCK.PORTAL?5:6+REALM_PORTALS.indexOf(id)],alongX=peek(x-1,y,z)===id||peek(x+1,y,z)===id||(peek(x,y,z-1)!==id&&peek(x,y,z+1)!==id);
        addFace(g,x,y,z,alongX?[[0,0,.5],[1,0,.5],[1,1,.5],[0,1,.5]]:[[.5,0,0],[.5,0,1],[.5,1,1],[.5,1,0]],alongX?[0,0,1]:[1,0,0],tileOf(id),1);continue;}
      if (id === BLOCK.FORGE) {
        appendBarbecue(groups[4],x,y,z);
        continue;
      }
      if(id===BLOCK.SOFA||id===BLOCK.TV){appendFurniture(groups[4],id,x,y,z,this.televisions.has(editKey(cx*SIZE+x,y,cz*SIZE+z)),peek(x-1,y,z)===BLOCK.SOFA,peek(x+1,y,z)===BLOCK.SOFA);continue;}
      if (id === BLOCK.RAMP) {
        const facing=this.rampFacingAt(cx*SIZE+x,y,cz*SIZE+z);
        const slopeFace=(corners,normal)=>{
          const rotatedNormal=rotateRamp(normal,facing,true);
          const shade=rotatedNormal[1]>0?1:rotatedNormal[1]<0?.58:rotatedNormal[0]>0?.84:rotatedNormal[0]<0?.77:rotatedNormal[2]>0?.9:.7;
          addFace(group,x,y,z,corners.map(c=>rotateRamp(c,facing)),rotatedNormal,BLOCK.PLANKS,shade);
        };
        const top = [[0, 0, 1], [1, 0, 1], [1, 1, 0], [0, 1, 0]];
        slopeFace(top, [0, Math.SQRT1_2, Math.SQRT1_2]);
        slopeFace([[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 0]], [1, 0, 0]);
        slopeFace([[0, 0, 0], [0, 0, 1], [0, 1, 0], [0, 1, 0]], [-1, 0, 0]);
        for (const i of [3, 5]) slopeFace(faces[i].corners, faces[i].normal);
        continue;
      }
      for (let side = 0; side < faces.length; side++) {
        const face = faces[side], [nx, ny, nz] = face.normal;
        const other = peek(x + nx, y + ny, z + nz);
        if (id !== BLOCK.TORCH && other !== BLOCK.RAMP && other !== BLOCK.FORGE && other!==BLOCK.SOFA && other!==BLOCK.TV) {
          if (id === BLOCK.WATER && other === BLOCK.WATER) {
            continue;
          }
          if (id === BLOCK.LAVA && other === BLOCK.LAVA) continue;
          if (id === BLOCK.GLASS && other === BLOCK.GLASS) continue;
          if (BLOCKS[other].solid && !BLOCKS[other].transparent) continue;
        }
        let tile = tileOf(id);
        if (id === BLOCK.GRASS) tile = side === 2 ? 32 : side === 3 ? BLOCK.DIRT : BLOCK.GRASS;
        if (id === BLOCK.WOOD && (side === 2 || side === 3)) tile = 33;
        if (id === BLOCK.WORKBENCH && side === 2) tile = 35;
        if (id === BLOCK.ASPHALT && side === 2 && cx * SIZE + x === 3 && ((cz * SIZE + z) % 8 + 8) % 8 < 4) tile = 34;
        const scale = id === BLOCK.TORCH ? [.4, 0, .4, .2, .8, .2] : null;
        const corners=isFluid(id)?face.corners.map(([a,b,c])=>[a,b?this.waterCornerHeight(cx*SIZE+x+a,y,cz*SIZE+z+c,id):0,c]):face.corners;
        const ao = NEW_VISUAL && !scale && !isFluid(id) && group === groups[0] ? cornerShade(x, y, z, face.normal, corners) : null;
        addFace(group, x, y, z, corners, face.normal, tile, face.shade, scale, ao);
      }
    }
    this._disposeMeshes(chunk);
    groups.forEach((group, i) => {
      if (!group.indices.length) return;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(group.positions, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(group.normals, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(group.uvs, 2));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(group.colors, 3));
      geometry.setIndex(group.indices);
      if(i===1||i===WATER_GROUP)geometry.computeVertexNormals();
      geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, [this.opaqueMaterial, this.transparentMaterial, this.torchMaterial, this.lavaMaterial, this.domesticMaterial, this.portalMaterial, ...this.realmPortalMaterials, this.waterMaterial][i]);
      mesh.position.set(cx * SIZE, 0, cz * SIZE);
      mesh.castShadow = i === 0 || i === 4;
      mesh.receiveShadow = true;
      mesh.name = `chunk:${chunk.key}:${i}`;
      mesh.renderOrder = i === 1 ? 1 : 0;
      this.scene?.add(mesh);
      chunk.meshes.push(mesh);
    });
    this.dirty.delete(chunk.key);
  }

  /** Amanatides–Woo voxel traversal; water is intentionally selectable only by swimming. */
  raycast(origin, direction, maxDistance = 6, includeWater = false) {
    const length = Math.hypot(direction.x, direction.y, direction.z);
    if (!length) return null;
    const d = { x: direction.x / length, y: direction.y / length, z: direction.z / length };
    const cell = { x: Math.floor(origin.x), y: Math.floor(origin.y), z: Math.floor(origin.z) };
    const step = { x: Math.sign(d.x), y: Math.sign(d.y), z: Math.sign(d.z) };
    const delta = { x: Math.abs(1 / d.x), y: Math.abs(1 / d.y), z: Math.abs(1 / d.z) };
    const next = {};
    for (const axis of ['x', 'y', 'z']) next[axis] = d[axis] === 0 ? Infinity : ((step[axis] > 0 ? cell[axis] + 1 : cell[axis]) - origin[axis]) / d[axis];
    let distance = 0, normal = { x: 0, y: 0, z: 0 };
    for (let iteration = 0; iteration < 512 && distance <= maxDistance; iteration++) {
      const id = this.getBlock(cell.x, cell.y, cell.z);
      if (id !== BLOCK.AIR && (id !== BLOCK.WATER || includeWater)) return { ...cell, id, normal: { ...normal }, distance };
      const axis = next.x <= next.y && next.x <= next.z ? 'x' : next.y <= next.z ? 'y' : 'z';
      distance = next[axis];
      cell[axis] += step[axis];
      next[axis] += delta[axis];
      normal = { x: 0, y: 0, z: 0 };
      normal[axis] = -step[axis];
    }
    return null;
  }

  serialize() { return [...this.edits.values()].map(edit => ({ ...edit })); }

  serializeFluids() {
    const pending = new Map(this.fluidQueue.slice(this.fluidHead).map(position => [editKey(...position), position]));
    for (const cells of this.fluidDeferred.values()) for (const [key, position] of cells) pending.set(key, position);
    return {
      version: 1,
      levels: [...this.fluidLevels].map(([key, flow]) => [...key.split(',').map(Number), flow.level, flow.falling]),
      pending: [...pending.values()].map(position => [...position]),
      drops: this.drops.map(drop => ({ ...drop })),
    };
  }

  dispose() {
    this.sand.dispose();
    for (const chunk of this.chunks.values()) this._disposeMeshes(chunk);
    this.chunks.clear(); this.dirty.clear(); this.pending = [];
    this.fluidQueue = []; this.fluidQueued.clear(); this.fluidDeferred.clear(); this.fluidLevels.clear(); this.drops = [];
    this.atlas.dispose(); this.opaqueMaterial.dispose(); this.transparentMaterial.dispose(); this.torchMaterial.dispose(); this.lavaMaterial.dispose(); this.domesticMaterial.dispose();for(const m of this.realmPortalMaterials)m.dispose();this.waterMaterial.dispose();this.portalMaterial.dispose();
  }
}
