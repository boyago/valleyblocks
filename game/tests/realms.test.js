import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BLOCK, BUILDABLE_BLOCKS } from '../src/blocks.js';
import { REALMS, realmAt, realmColumn, findFrame, activatePortal, Realms } from '../src/realms.js';

function fakeWorld() {
  const m = new Map(), k = (x, y, z) => `${x},${y},${z}`;
  return { getBlock: (x, y, z) => m.get(k(x, y, z)) ?? (y <= 8 ? BLOCK.STONE : BLOCK.AIR), setBlock(x, y, z, id) { m.set(k(x, y, z), id); return true; }, ensureAround() {} };
}
function frame(w, x0, y0, z, block = BLOCK.COPPER_BLOCK, axis = 'x', skipCorners = true) {
  for (let a = -1; a <= 2; a++) for (let b = -1; b <= 3; b++) {
    const edge = a === -1 || a === 2 || b === -1 || b === 3, corner = (a === -1 || a === 2) && (b === -1 || b === 3);
    if (!edge || (corner && skipCorners)) continue;
    axis === 'x' ? w.setBlock(x0 + a, y0 + b, z, block) : w.setBlock(z, y0 + b, x0 + a, block);
  }
}

test('copper frame without corners opens a Sertão portal with the spray, in both orientations', () => {
  for (const axis of ['x', 'z']) {
    const w = fakeWorld(); frame(w, 10, 9, 5, BLOCK.COPPER_BLOCK, axis);
    const cell = axis === 'x' ? [11, 10, 5] : [5, 10, 11];
    assert.equal(findFrame(w, ...cell).realm, 'sertao');
    const hit = axis === 'x' ? { x: 11, y: 8, z: 5, normal: { x: 0, y: 1, z: 0 } } : { x: 5, y: 8, z: 11, normal: { x: 0, y: 1, z: 0 } };
    const r = activatePortal(w, hit); assert.equal(r.ok, true, r.message);
    const inner = axis === 'x' ? [[10, 9, 5], [11, 11, 5]] : [[5, 9, 10], [5, 11, 11]];
    for (const c of inner) assert.equal(w.getBlock(...c), BLOCK.SERTAO_PORTAL);
    assert.equal(activatePortal(w, hit).ok, false, 'already open');
  }
});

test('incomplete or wrong frames do not open', () => {
  const w = fakeWorld(); frame(w, 10, 9, 5, BLOCK.STONE);
  assert.equal(activatePortal(w, { x: 10, y: 8, z: 5, normal: { x: 0, y: 1, z: 0 } }).ok, false);
  const w2 = fakeWorld(); frame(w2, 10, 9, 5); w2.setBlock(9, 10, 5, BLOCK.AIR);
  assert.equal(activatePortal(w2, { x: 10, y: 8, z: 5, normal: { x: 0, y: 1, z: 0 } }).ok, false);
  const w3 = fakeWorld(); frame(w3, 10, 9, 5); w3.setBlock(10, 10, 5, BLOCK.DIRT); // blocked opening
  assert.equal(activatePortal(w3, { x: 10, y: 8, z: 5, normal: { x: 0, y: 1, z: 0 } }).ok, false);
  assert.equal(activatePortal(w3, null).ok, false);
});

test('Sertão terrain is dry, enclosed and only inside its region; portal blocks are not buildable', () => {
  const [cx, cz] = REALMS.sertao.center;
  assert.equal(realmAt(cx, cz), 'sertao'); assert.equal(realmAt(0, 0), null);
  assert.equal(realmColumn(0, 0, 1), null);
  const center = realmColumn(cx + 2, cz + 2, 1); assert.equal(center.biome, 'sertao'); assert.equal(center.height, 10); assert.equal(center.water, false);
  assert.ok(realmColumn(cx + 149, cz, 1).height >= 22, 'mountain rim');
  assert.ok(!BUILDABLE_BLOCKS.some(b => b.id === BLOCK.SERTAO_PORTAL || b.id === BLOCK.PORTAL));
});

test('travel goes to the Sertão gate and back to where the player entered; state survives save', () => {
  const w = fakeWorld(), [cx, cz] = REALMS.sertao.center;
  for (let x = cx - 3; x <= cx + 4; x++) for (let z = cz - 2; z <= cz + 6; z++) w.setBlock(x, 10, z, BLOCK.DRY_EARTH);
  const player = { position: new THREE.Vector3(20.5, 9, 20.5), velocity: new THREE.Vector3(1, 1, 1), blocked: () => false };
  const pets = { pets: [] }, realms = new Realms(null);
  assert.equal(realms.travel(BLOCK.SERTAO_PORTAL, player, pets, w).ok, true);
  assert.equal(realmAt(player.position.x, player.position.z), 'sertao'); assert.equal(player.velocity.length(), 0);
  const restored = new Realms(structuredClone(realms.serialize()));
  assert.equal(restored.travel(BLOCK.SERTAO_PORTAL, player, pets, w).ok, true);
  assert.ok(Math.abs(player.position.x - 20.5) < 2 && Math.abs(player.position.z - 22) < 2);
  assert.equal(new Realms({ returnTo: ['x', 1, 2] }).returnTo, null);
  assert.equal(realms.travel(BLOCK.PORTAL, player, pets, w).ok, false);
});

test('diamond frame opens Minas; Minas has rivers, red earth, a stone rim and gem-lined caves', async () => {
  const w = fakeWorld(); frame(w, 10, 9, 5, BLOCK.DIAMOND_BLOCK);
  const r = activatePortal(w, { x: 10, y: 8, z: 5, normal: { x: 0, y: 1, z: 0 } }); assert.equal(r.ok, true); assert.equal(w.getBlock(10, 10, 5), BLOCK.MINAS_PORTAL);
  const [cx, cz] = REALMS.minas.center; assert.equal(realmAt(cx, cz), 'minas');
  assert.equal(realmColumn(cx, cz, 1).height, 10);
  assert.equal(realmColumn(cx + 149, cz, 1).surface, BLOCK.STONE);
  let water = 0, clay = 0; for (let x = cx - 100; x < cx + 100; x += 2) for (let z = cz - 100; z < cz + 100; z += 2) { const c = realmColumn(x, z, 1); if (c.water) water++; if (c.surface === BLOCK.CLAY) clay++; }
  assert.ok(water > 50 && clay > 50, `water ${water} clay ${clay}`);
  const { decorateRealm } = await import('../src/realms.js');
  const gems = new Map(); const put = (x, y, z, id) => gems.set(id, (gems.get(id) || 0) + 1);
  for (let i = 0; i < 6; i++) decorateRealm(put, { seedHash: 1 }, cx - 60 + i * 16, cz - 60, 16);
  for (const id of [BLOCK.EMERALD, BLOCK.TOPAZ, BLOCK.DIAMOND, BLOCK.GOLD]) assert.ok(gems.get(id) > 0, 'gem ' + id);
});

test('back home travel leaves the realm', () => {
  const w = fakeWorld(), [cx, cz] = REALMS.minas.center;
  for (let x = cx - 3; x <= cx + 4; x++) for (let z = cz - 2; z <= cz + 6; z++) w.setBlock(x, 10, z, BLOCK.GRASS);
  const player = { position: new THREE.Vector3(3, 9, 3), velocity: new THREE.Vector3(), blocked: () => false }, realms = new Realms(null);
  assert.equal(realms.travel(BLOCK.MINAS_PORTAL, player, { pets: [] }, w).ok, true); assert.equal(realmAt(player.position.x, player.position.z), 'minas');
  assert.equal(realms.travel(BLOCK.MINAS_PORTAL, player, { pets: [] }, w).ok, true); assert.equal(realmAt(player.position.x, player.position.z), null);
});


test('ruby, gold and uranium frames open China, Japan and the USA, each with its landmarks', async () => {
  const { decorateRealm } = await import('../src/realms.js');
  for (const [block, key, portal] of [[BLOCK.RUBY_BLOCK, 'china', BLOCK.CHINA_PORTAL], [BLOCK.GOLD_BLOCK, 'japao', BLOCK.JAPAN_PORTAL], [BLOCK.URANIUM_BLOCK, 'eua', BLOCK.USA_PORTAL]]) {
    const w = fakeWorld(); frame(w, 10, 9, 5, block);
    const r = activatePortal(w, { x: 10, y: 8, z: 5, normal: { x: 0, y: 1, z: 0 } }); assert.equal(r.ok, true); assert.equal(r.realm, key); assert.equal(w.getBlock(11, 11, 5), portal);
    const [cx, cz] = REALMS[key].center; assert.equal(realmColumn(cx + 30, cz + 30, 1).biome, key); assert.equal(realmColumn(cx, cz, 1).height, REALMS[key].ground ?? 10);
    const placed = new Map(); const put = (x, y, z, id) => placed.set(id, (placed.get(id) || 0) + 1);
    for (let i = -5; i < 5; i++) for (let j = -5; j < 5; j++) decorateRealm(put, { seedHash: 1 }, cx + i * 16, cz + j * 16, 16);
    assert.ok(placed.get(portal) >= 6, key + ' arrival portal');
    if (key === 'eua') { let deep = 0; for (let x = cx - 60; x < cx + 60; x += 3) if (realmColumn(x, cz + 40 + Math.round(Math.sin((x - cx) / 35) * 25), 1).height <= 6) deep++; assert.ok(deep > 20 && realmColumn(cx + 30, cz - 30, 1).height >= 20, 'deep canyon below a high plateau'); }
    const landmark = { china: [BLOCK.BAMBOO, BLOCK.RED_LACQUER, BLOCK.STONE], japao: [BLOCK.SAKURA, BLOCK.RED_LACQUER], eua: [BLOCK.CACTUS, BLOCK.ASPHALT] }[key];
    for (const id of landmark) assert.ok(placed.get(id) > 0, key + ' landmark ' + id);
  }
  const [jx, jz] = REALMS.japao.center; assert.equal(realmColumn(jx, jz - 62, 1).surface, BLOCK.SNOW, 'snowy Fuji');
  const [ux, uz] = REALMS.eua.center; let water = 0; for (let x = ux - 100; x < ux + 100; x += 3) if (realmColumn(x, uz + 40 + Math.round(Math.sin((x - ux) / 35) * 25), 1).water) water++; assert.ok(water > 20, 'canyon river');
});

test('realms do not overlap each other', () => {
  const list = Object.values(REALMS);
  for (const a of list) for (const b of list) if (a !== b) assert.ok(Math.abs(a.center[0] - b.center[0]) > a.radius + b.radius || Math.abs(a.center[1] - b.center[1]) > a.radius + b.radius);
});


test('emerald opens the Triple Frontier: rivers, bridge, Ciudad del Este stalls, three landmarks and the falls', async () => {
  const { decorateRealm } = await import('../src/realms.js');
  const w = fakeWorld(); frame(w, 10, 9, 5, BLOCK.EMERALD_BLOCK);
  assert.equal(activatePortal(w, { x: 10, y: 8, z: 5, normal: { x: 0, y: 1, z: 0 } }).realm, 'triplice');
  const [cx, cz] = REALMS.triplice.center;
  assert.equal(realmColumn(cx - 41, cz - 60, 1).water, true, 'Rio Paraná');
  assert.equal(realmColumn(cx + 20, cz + 30, 1).water, true, 'Rio Iguaçu');
  assert.ok(realmColumn(cx + 110, cz - 30, 1).height >= 22, 'plateau above the falls');
  const placed = new Map(), at = new Map(); const put = (x, y, z, id) => { placed.set(id, (placed.get(id) || 0) + 1); at.set(x + ',' + y + ',' + z, id); };
  for (let i = -8; i < 8; i++) for (let j = -6; j < 6; j++) decorateRealm(put, { seedHash: 1 }, cx + i * 16, cz + j * 16, 16);
  assert.equal(at.get((cx - 41) + ',15,' + (cz - 20)), BLOCK.ASPHALT, 'Ponte da Amizade deck over the river');
  for (const id of [BLOCK.TRIPLICE_PORTAL, BLOCK.CHEST, BLOCK.GLASS, BLOCK.GOLD_BLOCK, BLOCK.DIAMOND_BLOCK, BLOCK.RED_LACQUER]) assert.ok(placed.get(id) > 0, 'landmark ' + id);
  let falls = 0; for (const [k, id] of at) { const [x, y] = k.split(',').map(Number); if (id === BLOCK.WATER && y >= 12 && x - cx > 60) falls++; } assert.ok(falls > 30, 'waterfall curtain ' + falls);
  assert.deepEqual(REALMS.triplice.animalsAt(cx - 80, cz), ['vendedor', 'vendedor', 'turista']);
});

test('obsidian opens the underworld: basalt ceiling, lava lakes and lava sources on towers', async () => {
  const { decorateRealm } = await import('../src/realms.js');
  const [cx, cz] = REALMS.submundo.center; assert.ok(REALMS.submundo.day && REALMS.submundo.fx);
  const placed = new Map(); let ceiling = 0; const put = (x, y, z, id) => { placed.set(id, (placed.get(id) || 0) + 1); if (id === BLOCK.BASALT && y >= 44) ceiling++; };
  for (let i = -5; i < 5; i++) for (let j = -5; j < 5; j++) decorateRealm(put, { seedHash: 1 }, cx + i * 16, cz + j * 16, 16);
  assert.ok(ceiling > 20000, 'ceiling ' + ceiling); assert.ok(placed.get(BLOCK.LAVA) > 100); assert.ok(placed.get(BLOCK.OBSIDIAN) > 0); assert.ok(placed.get(BLOCK.SUBMUNDO_PORTAL) >= 6);
  assert.equal(realmColumn(cx + 3, cz + 3, 1).surface, BLOCK.BASALT);
});


test('Rio has the sea, the beach, the wave sidewalk, Sugarloaf and Christ on Corcovado', async () => {
  const { decorateRealm } = await import('../src/realms.js');
  const w = fakeWorld(); frame(w, 10, 9, 5, BLOCK.CALCADAO);
  assert.equal(activatePortal(w, { x: 10, y: 8, z: 5, normal: { x: 0, y: 1, z: 0 } }).realm, 'rio');
  const [cx, cz] = REALMS.rio.center;
  assert.equal(realmColumn(cx + 40, cz + 60, 1).water, true, 'ocean');
  assert.equal(realmColumn(cx + 40, cz + 24, 1).surface, BLOCK.SAND, 'beach');
  assert.equal(realmColumn(cx + 40, cz + 15, 1).surface, BLOCK.CALCADAO, 'calçadão');
  assert.ok(realmColumn(cx + 74, cz + 52, 1).height > 40, 'Pão de Açúcar');
  assert.ok(realmColumn(cx - 62, cz - 74, 1).height > 45, 'Corcovado');
  const placed = new Map(); const put = (x, y, z, id) => placed.set(id, (placed.get(id) || 0) + 1);
  for (let i = -6; i < 3; i++) for (let j = -7; j < 4; j++) decorateRealm(put, { seedHash: 1 }, cx + i * 16, cz + j * 16, 16);
  assert.ok(placed.get(BLOCK.SNOW) > 20, 'white buildings'); assert.ok(placed.get(BLOCK.RIO_PORTAL) >= 6);
});

test('New York has towers, Central Park and Liberty Island surrounded by water', async () => {
  const { decorateRealm } = await import('../src/realms.js');
  const [cx, cz] = REALMS.nyc.center;
  assert.equal(realmColumn(cx + 10, cz + 96, 1).water, false, 'island');
  assert.equal(realmColumn(cx + 10, cz + 75, 1).water, true, 'bay between the city and the island');
  assert.equal(realmColumn(cx, cz - 70, 1).surface, BLOCK.GRASS, 'Central Park');
  const placed = new Map(); let tallest = 0; const put = (x, y, z, id) => { placed.set(id, (placed.get(id) || 0) + 1); if (id === BLOCK.STEEL_BLOCK) tallest = Math.max(tallest, y); };
  for (let i = -6; i < 6; i++) for (let j = -6; j < 8; j++) decorateRealm(put, { seedHash: 1 }, cx + i * 16, cz + j * 16, 16);
  assert.ok(tallest > 45, 'skyscraper ' + tallest);
});

test('starting a world in a land builds a saved house next to the portal', async () => {
  const { buildStarterHouse } = await import('../src/realms.js');
  const w = fakeWorld(); w.heightAt = () => 10;
  const house = buildStarterHouse(w, 'rio'), [cx, cz] = REALMS.rio.center;
  assert.ok(house && house.door.length === 3);
  assert.equal(w.getBlock(cx, 11, cz + 7), BLOCK.DOOR); assert.equal(w.getBlock(cx, 12, cz + 7), BLOCK.DOOR);
  assert.equal(w.getBlock(cx + 2, 11, cz + 11), BLOCK.CHEST); assert.equal(w.getBlock(cx, 15, cz + 9), BLOCK.BRICK);
  assert.equal(buildStarterHouse(w, 'nada'), null);
});

test('a porta da casa inicial fica no nível do chão em todas as terras (pátio de pedra na frente, morro do lote cortado)', async () => {
  const { buildStarterHouse } = await import('../src/realms.js');
  const { VoxelWorld } = await import('../src/world.js');
  for (const seed of ['vale-2026', 'S1234567']) for (const key of Object.keys(REALMS)) {
    const w = new VoxelWorld(null, seed), house = buildStarterHouse(w, key), [cx, cz] = REALMS[key].center, floor = house.door[1] - 1;
    for (let k = 1; k <= 3; k++) assert.equal(w.heightAt(cx + .5, cz + 7 - k + .5, 40), floor + 1, `${key}/${seed}: chão a ${k} da porta`);
    for (let y = floor + 6; y < floor + 30; y++) assert.equal(w.getBlock(cx, y, cz + 9), BLOCK.AIR, `${key}/${seed}: nada sobre o telhado em y=${y}`);
  }
});

test('começar num bioma do vale: findBiome acha o bioma e a casa fica no nível do chão ali', async () => {
  const { buildStarterHouseAt } = await import('../src/realms.js');
  const { VoxelWorld, VALLEY_STARTS } = await import('../src/world.js');
  const w = new VoxelWorld(null, 'vale-2026', [], null, { generatorVersion: 4 });
  for (const key of Object.keys(VALLEY_STARTS)) {
    const spot = w.findBiome(key); assert.ok(spot, `${key}: nenhum ponto`);
    assert.equal(w.biomeAt(spot.x, spot.z), key);
  }
  const spot = w.findBiome('florido'), house = buildStarterHouseAt(w, spot.x, spot.z), floor = house.door[1] - 1;
  assert.equal(w.getBlock(spot.x, floor + 1, spot.z + 7), BLOCK.DOOR);
  for (let k = 1; k <= 3; k++) assert.equal(w.heightAt(spot.x + .5, spot.z + 7 - k + .5, 40), floor + 1);
});
