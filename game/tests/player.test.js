import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Player } from '../src/player.js';
import { VoxelWorld } from '../src/world.js';
import { BLOCK } from '../src/blocks.js';

const tick = (player, count, keys = [], mode = 'creative', extraCollision = undefined) => {
  let result;
  for (let i = 0; i < count; i++) result = player.update(1 / 120, new Set(keys), mode, extraCollision) || result;
  return result;
};
const setup = state => {
  const world = new VoxelWorld(new THREE.Scene(), 'player-tests');
  return { world, player: new Player(world, state) };
};

test('diagonal movement has the same speed as cardinal movement', () => {
  const straight = setup(), diagonal = setup();
  tick(straight.player, 120, ['KeyW']);
  tick(diagonal.player, 120, ['KeyW', 'KeyD']);
  const traveled = player => Math.hypot(player.position.x, player.position.z - 12);
  assert.ok(Math.abs(traveled(straight.player) - traveled(diagonal.player)) < 1e-6);
  assert.ok(traveled(straight.player) > 3.9 && traveled(straight.player) < 4.3);
  straight.world.dispose(); diagonal.world.dispose();
});

test('walking, sprinting and flying cannot tunnel through a voxel wall', () => {
  for (const movement of [[], ['ShiftLeft'], ['ShiftRight'], ['fly']]) {
    const { world, player } = setup();
    for (let y = 9; y <= 13; y++) for (let z = 10; z <= 14; z++) world.setBlock(2, y, z, BLOCK.STONE);
    player.flying = movement.includes('fly');
    tick(player, 180, ['KeyD', ...movement]);
    assert.ok(player.position.x <= 2 - player.radius + .00001, `${movement} crossed the wall`);
    assert.ok(player.position.x > 1.69, `${movement} stopped too far from contact`);
    assert.equal(player.blocked(player.position), false);
    world.dispose();
  }
});

test('jump contacts a ceiling, falls back to stable ground, and obeys mode', () => {
  const { world, player } = setup();
  for (let x = -1; x <= 1; x++) for (let z = 11; z <= 13; z++) world.setBlock(x, 12, z, BLOCK.STONE);
  tick(player, 10);
  assert.equal(player.grounded, true);
  let peak = player.position.y;
  tick(player, 1, ['Space']);
  for (let i = 0; i < 240; i++) { tick(player, 1); peak = Math.max(peak, player.position.y); }
  assert.ok(peak > 9.9 && peak <= 12 - player.height + .0001);
  assert.ok(Math.abs(player.position.y - 9) < .003);
  assert.equal(player.grounded, true);
  player.flying = true;
  tick(player, 1, ['Space'], 'survival');
  assert.equal(player.flying, false);
  world.dispose();
});

test('crouching stays engaged beneath a vehicle ceiling until there is headroom', () => {
  const { world, player } = setup();
  const lowCeiling = (min, max) => max.y > 10.5 && min.y < 11;
  tick(player, 10, ['ControlLeft'], 'creative', lowCeiling);
  assert.equal(player.crouching, true);
  tick(player, 10, [], 'creative', lowCeiling);
  assert.equal(player.crouching, true);
  assert.equal(player.height, 1.22);
  tick(player, 1);
  assert.equal(player.crouching, false);
  assert.equal(player.height, 1.78);
  world.dispose();
});

test('the full player footprint walks up continuous ramps without jumping', () => {
  const { world, player } = setup({ position: [10.5, 9.002, 16], yaw: 0 });
  tick(player, 10);
  let highest = player.position.y;
  for (let i = 0; i < 135; i++) { tick(player, 1, ['KeyW']); highest = Math.max(highest, player.position.y); }
  assert.ok(player.position.z < 12, `stalled at z=${player.position.z}`);
  assert.ok(highest > 12, `did not ascend: y=${highest}`);
  assert.equal(player.blocked(player.position), false);
  world.dispose();
});

test('restoring inside a block chooses a safe standing position', () => {
  const world = new VoxelWorld(new THREE.Scene());
  world.setBlock(0, 9, 12, BLOCK.BRICK);
  world.setBlock(0, 10, 12, BLOCK.BRICK);
  const player = new Player(world, { position: [.5, 9, 12.5], pitch: 99 });
  assert.equal(player.blocked(player.position), false);
  assert.ok(player.position.y >= 11);
  assert.equal(player.pitch, 1.52);
  const invalid = new Player(world, { position: [NaN, 8], yaw: Infinity });
  assert.equal(invalid.position.toArray().every(Number.isFinite), true);
  assert.equal(invalid.yaw, 0);
  world.dispose();
});

test('survival fall damage applies once on landing while creative remains unharmed', () => {
  for (const mode of ['survival', 'creative']) {
    const { world, player } = setup({ position: [0, 18, 12] });
    tick(player, 240, [], mode);
    assert.equal(player.grounded, true);
    if (mode === 'survival') assert.ok(player.health < 100 && player.health > 0);
    else assert.equal(player.health, 100);
    const health = player.health;
    tick(player, 120, [], mode);
    assert.equal(player.health, health);
    world.dispose();
  }
});

test('chunk neighborhood is ensured only when crossing a chunk boundary', () => {
  const { world, player } = setup();
  let calls = 0;
  const ensureAround = world.ensureAround.bind(world);
  world.ensureAround = (...args) => { calls++; return ensureAround(...args); };
  tick(player, 120);
  assert.equal(calls, 0);
  player.position.set(16.5, 30, 12);
  tick(player, 1);
  assert.equal(calls, 1);
  world.dispose();
});

test('large frames still obey extra collisions and falling out of bounds respawns safely', () => {
  const { world, player } = setup();
  player.flying = true;
  const vehicle = (min, max) => min.x < 3 && max.x > 1 && min.z < 14 && max.z > 10 && min.y < 12 && max.y > 9;
  for (let i = 0; i < 10; i++) player.update(.5, new Set(['KeyD']), 'creative', vehicle);
  assert.ok(player.position.x <= 1 - player.radius + .00001);
  assert.equal(player.blocked(player.position, vehicle), false);
  player.position.set(0, -12, 12);
  assert.equal(tick(player, 1, [], 'survival'), 'respawn');
  assert.equal(player.health, 100);
  assert.equal(player.blocked(player.position), false);
  assert.ok(player.position.y > 8);
  world.dispose();
});

const lake = ({ bankHeight = 10, ceiling = null, position = [.5, 6.05, 25.5] } = {}) => {
  const world = new VoxelWorld(new THREE.Scene(), 'swimming-tests');
  // Three blocks of water, a solid bottom, and a bank one block above water.
  for (let x = -6; x <= 8; x++) for (let z = 20; z <= 30; z++) {
    world.setBlock(x, 5, z, BLOCK.STONE);
    for (let y = 6; y <= 15; y++) {
      const id = ceiling === y ? BLOCK.STONE : x >= 3 && y < bankHeight ? BLOCK.STONE : x < 3 && y < 9 ? BLOCK.WATER : BLOCK.AIR;
      world.setBlock(x, y, z, id);
    }
  }
  return { world, player: new Player(world, { position }) };
};

test('Space swims from underwater and exits a one-block bank in survival at normal and low frame rates', () => {
  for (const dt of [1 / 120, 1 / 30, .1]) {
    const { world, player } = lake();
    let wasSwimming = false;
    for (let time = 0; time < 3.5; time += dt) {
      player.update(dt, new Set(['KeyD', 'Space']), 'survival');
      wasSwimming ||= player.inWater;
      assert.equal(player.blocked(player.position), false, `intersected the bank at dt=${dt}`);
    }
    assert.equal(wasSwimming, true);
    assert.ok(player.position.x > 4, `failed to leave water at dt=${dt}: ${player.position.toArray()}`);
    assert.ok(player.position.y >= 10 - .004, `did not climb onto the bank at dt=${dt}`);
    assert.equal(player.flying, false);
    assert.equal(player.health, 100);
    world.dispose();
  }
});

test('idle swimmers sink, Control dives faster and Space swims up again', () => {
  for(const dt of [1/120,1/30,.1]){
    const {world,player}=lake({position:[.5,8.1,25.5]});
    for(let t=0;t<1;t+=dt)player.update(dt,new Set(),'survival');
    const idle=player.position.y;
    assert.ok(idle<7.6&&idle>6.8,'idle sinking must be gradual');
    player.position.set(.5,8.1,25.5);player.velocity.set(0,0,0);
    for(let t=0;t<1;t+=dt)player.update(dt,new Set(['ControlLeft']),'survival');
    assert.ok(player.position.y<idle-.3);assert.ok(player.position.y>=5.99);
    for(let t=0;t<2;t+=dt)player.update(dt,new Set(['Space']),'survival');
    assert.ok(player.eye.y>8.89,'Space must restore breathable air');
    assert.equal(player.health,100);world.dispose();
  }
});

test('swimming cannot climb tall walls or pass through low ceilings', () => {
  for (const options of [{ bankHeight: 11 }, { bankHeight: 12 }, { ceiling: 10 }]) {
    const { world, player } = lake(options);
    let peak = player.position.y;
    for (let i = 0; i < 600; i++) {
      tick(player, 1, ['Space', 'KeyD'], 'survival');
      peak = Math.max(peak, player.position.y);
      assert.equal(player.blocked(player.position), false);
    }
    assert.ok(player.position.x <= 3 - player.radius + .00001);
    if (options.ceiling) assert.ok(peak <= options.ceiling - player.height + .0001);
    else assert.ok(peak < 10, `swam unnaturally up the tall wall: ${peak}`);
    world.dispose();
  }
});

test('entering deep water damps a fast fall before landing and does not cause fall damage', () => {
  for (const dt of [1 / 120, .1]) {
    const { world, player } = lake({ position: [.5, 25, 25.5] });
    for (let time = 0; time < 5; time += dt) player.update(dt, new Set(), 'survival');
    assert.equal(player.health, 100, `water did not cushion the fall at dt=${dt}`);
    assert.equal(player.inWater, true);
    assert.ok(player.position.y >= 5.99 && player.position.y < 7.7);
    world.dispose();
  }
});

test('water checks respect a flowing water surface below the voxel top', () => {
  const { world, player } = lake({ position: [.5, 8.6, 25.5] });
  world.waterSurfaceAt = (x, y, z) => world.getBlock(x, y, z) === BLOCK.WATER ? Math.floor(y) + .5 : null;
  assert.equal(player._waterState().depth, 0);
  player.position.y = 8.25;
  assert.ok(Math.abs(player._waterState().depth - .25) < .0001);
  // Eye is in the same voxel as a partial flow, but above the actual water.
  player.position.y = 6.98;
  player.air = 10;
  tick(player, 1, [], 'survival');
  assert.ok(player.air > 10);
  world.dispose();
});
