import test from 'node:test';
import assert from 'node:assert/strict';
import { BLOCK } from '../src/blocks.js';
import { VoxelWorld, FLUID_STEP_BUDGET } from '../src/world.js';

const makeWorld = () => new VoxelWorld(null, 'fluid-regression');
function settle(world, ticks = 400) {
  for (let i = 0; i < ticks && world.fluidHead < world.fluidQueue.length; i++) world.step(.08, 0, 32);
  assert.equal(world.fluidQueue.length - world.fluidHead, 0, 'resident simulation must settle');
}

// A sealed, elevated one-block-wide channel avoids relying on terrain seeds.
function channel(world, start = 0, end = 12, z = 32, y = 40) {
  for (let x = start; x <= end; x++) {
    world.setBlock(x, y - 1, z, BLOCK.STONE);
    world.setBlock(x, y, z - 1, BLOCK.STONE);
    world.setBlock(x, y, z + 1, BLOCK.STONE);
  }
  world.setBlock(start, y, z, BLOCK.STONE);
  world.setBlock(end, y, z, BLOCK.STONE);
  settle(world);
}

test('lava flows through excavated channels, slopes, falls and drains without replacing water', () => {
  const world=makeWorld();channel(world);
  world.setBlock(3,40,32,BLOCK.STONE);world.setBlock(1,40,32,BLOCK.LAVA);
  settle(world);
  assert.equal(world.getBlock(2,40,32),BLOCK.LAVA);
  assert.equal(world.getBlock(4,40,32),BLOCK.AIR);
  world.setBlock(3,40,32,BLOCK.AIR);settle(world);
  assert.equal(world.getBlock(8,40,32),BLOCK.LAVA);
  assert.equal(world.getBlock(9,40,32),BLOCK.AIR);
  assert.ok(world.fluidSurfaceAt(2,40,32,BLOCK.LAVA)>world.fluidSurfaceAt(7,40,32,BLOCK.LAVA));
  assert.equal(world.waterSurfaceAt(2,40,32),null);
  world.setBlock(8,40,32,BLOCK.WATER);settle(world);
  assert.equal(world.getBlock(8,40,32),BLOCK.WATER);
  assert.equal(world.getBlock(7,40,32),BLOCK.LAVA);
  world.setBlock(8,40,32,BLOCK.STONE);
  for(let y=37;y<=39;y++)for(const [x,z] of [[1,32],[3,32],[2,31],[2,33]])world.setBlock(x,y,z,BLOCK.STONE);
  world.setBlock(2,36,32,BLOCK.STONE);world.setBlock(2,39,32,BLOCK.AIR);settle(world);
  assert.equal(world.getBlock(2,37,32),BLOCK.LAVA);
  assert.equal(world.fluidSurfaceAt(2,38,32,BLOCK.LAVA),39);
  world.setBlock(1,40,32,BLOCK.AIR);settle(world);
  for(let y=37;y<=40;y++)assert.equal(world.getBlock(2,y,32),BLOCK.AIR);
  world.dispose();
});

test('lava metadata survives save and chunk boundaries without becoming permanent sources', () => {
  const world=makeWorld();channel(world,12,24);world.setBlock(13,40,32,BLOCK.LAVA);settle(world);
  const restored=new VoxelWorld(null,world.seed,world.serialize(),world.serializeFluids());
  restored.getBlock(16,40,32);settle(restored);
  assert.equal(restored.getBlock(16,40,32),BLOCK.LAVA);
  assert.equal(restored.fluidLevels.get('16,40,32').level,3);
  restored.setBlock(13,40,32,BLOCK.AIR);settle(restored);
  assert.equal(restored.getBlock(20,40,32),BLOCK.AIR);
  world.dispose();restored.dispose();
});

test('lava respects the work budget and never loads neighboring chunks', () => {
  const world=makeWorld();world.setBlock(15,50,15,BLOCK.LAVA);
  const count=world.chunks.size;
  for(let tick=0;tick<160;tick++){
    assert.ok(world.step(100)<=FLUID_STEP_BUDGET);
    assert.equal(world.chunks.size,count);
  }
  assert.ok(world.serializeFluids().pending.some(([x,,z])=>x>=16||z>=16));world.dispose();
});

test('breaking a natural lake shore fills the newly opened space', () => {
  const world = makeWorld();
  assert.equal(world.getBlock(-23, 8, 18), BLOCK.WATER);
  assert.equal(world.getBlock(-22, 8, 18), BLOCK.SAND);
  world.setBlock(-22, 8, 18, BLOCK.AIR);
  settle(world);
  assert.equal(world.getBlock(-22, 8, 18), BLOCK.WATER);
  assert.equal(world.getWaterLevel(-22, 8, 18), 1);
  world.dispose();
});

test('water crosses opened channels, attenuates to seven cells and respects walls', () => {
  const world = makeWorld();
  channel(world);
  world.setBlock(3, 40, 32, BLOCK.BRICK);
  world.setBlock(1, 40, 32, BLOCK.WATER);
  settle(world);
  assert.equal(world.getBlock(2, 40, 32), BLOCK.WATER);
  assert.equal(world.getBlock(3, 40, 32), BLOCK.BRICK);
  assert.equal(world.getBlock(4, 40, 32), BLOCK.AIR);
  world.setBlock(3, 40, 32, BLOCK.AIR);
  settle(world);
  for (let x = 1; x <= 8; x++) assert.equal(world.getWaterLevel(x, 40, 32), x - 1);
  assert.equal(world.getBlock(9, 40, 32), BLOCK.AIR);
  assert.ok(world.waterSurfaceAt(2, 40, 32) > world.waterSurfaceAt(7, 40, 32));
  assert.equal(world.getBlock(5, 40, 31), BLOCK.STONE);
  assert.equal(world.getBlock(5, 40, 30), BLOCK.AIR);
  world.dispose();
});

test('water falls into excavated floors and retreats after its only source is removed', () => {
  const world = makeWorld();
  channel(world);
  for (let y = 37; y <= 39; y++) {
    for (const [x, z] of [[1, 32], [3, 32], [2, 31], [2, 33]]) world.setBlock(x, y, z, BLOCK.STONE);
  }
  world.setBlock(2, 36, 32, BLOCK.STONE);
  world.setBlock(1, 40, 32, BLOCK.WATER);
  settle(world);
  world.setBlock(2, 39, 32, BLOCK.AIR);
  settle(world);
  for (let y = 37; y <= 40; y++) assert.equal(world.getBlock(2, y, 32), BLOCK.WATER);
  assert.equal(world.waterSurfaceAt(2, 38, 32), 39, 'a waterfall fills the voxel height');
  world.setBlock(1, 40, 32, BLOCK.AIR);
  settle(world);
  for (let y = 37; y <= 40; y++) assert.equal(world.getBlock(2, y, 32), BLOCK.AIR);
  assert.equal(world.fluidLevels.size, 0);
  world.dispose();
});

test('flow crosses positive and negative chunk boundaries', () => {
  for (const start of [12, -20]) {
    const world = makeWorld();
    channel(world, start, start + 12);
    world.setBlock(start + 1, 40, 32, BLOCK.WATER);
    settle(world);
    assert.equal(world.getWaterLevel(start + 6, 40, 32), 5);
    assert.ok(world.dirty.has(`${Math.floor((start + 6) / 16)},2`));
    world.dispose();
  }
});

test('active flow and unloaded pending regions survive save/restore without becoming sources', () => {
  const world = makeWorld();
  channel(world, 12, 24);
  world.setBlock(13, 40, 32, BLOCK.WATER);
  world.step(.08, 0, 32);
  const snapshot = world.serializeFluids();
  assert.ok(snapshot.levels.length > 0);
  const restored = new VoxelWorld(null, world.seed, world.serialize(), snapshot);
  // All pending cells are initially unloaded. Loading just one side must not
  // discard work in the other chunk, including when saving again mid-flight.
  restored.getBlock(13, 40, 32);
  restored.step(.08, 0, 32);
  const second = new VoxelWorld(null, world.seed, restored.serialize(), restored.serializeFluids());
  second.getBlock(13, 40, 32);
  second.getBlock(20, 40, 32);
  settle(second);
  assert.equal(second.getWaterLevel(20, 40, 32), 7);
  second.setBlock(13, 40, 32, BLOCK.AIR);
  settle(second);
  assert.equal(second.getBlock(20, 40, 32), BLOCK.AIR);
  world.dispose(); restored.dispose(); second.dispose();
});

test('simulation never generates chunks and bounds every call even for a large dt', () => {
  const world = makeWorld();
  world.getBlock(15, 50, 15);
  world.setBlock(15, 50, 15, BLOCK.WATER);
  const count = world.chunks.size;
  for (let tick = 0; tick < 160; tick++) {
    assert.ok(world.step(100, 0, 0) <= FLUID_STEP_BUDGET);
    assert.equal(world.chunks.size, count);
  }
  assert.ok(world.serializeFluids().pending.some(([x, , z]) => x >= 16 || z >= 16), 'unloaded frontier stays pending');
  world.dispose();
});

test('unloaded donors do not erase existing edge flow and their return resumes recession', () => {
  const world = makeWorld();
  channel(world, 12, 24);
  world.setBlock(13, 40, 32, BLOCK.WATER);
  settle(world);
  world.chunks.delete('0,2');
  world._queueFluidAround(16, 40, 32);
  settle(world);
  assert.equal(world.getWaterLevel(16, 40, 32), 3);
  const restored = new VoxelWorld(null, world.seed, world.serialize(), world.serializeFluids());
  restored.getBlock(16, 40, 32);
  settle(restored);
  assert.equal(restored.getWaterLevel(16, 40, 32), 3);
  restored.setBlock(13, 40, 32, BLOCK.AIR);
  settle(restored);
  assert.equal(restored.getBlock(16, 40, 32), BLOCK.AIR);
  world.dispose(); restored.dispose();
});

test('legacy WATER edits remain sources without a fluid snapshot', () => {
  const world = makeWorld();
  channel(world);
  const restored = new VoxelWorld(null, world.seed, [...world.serialize(), { x: 1, y: 40, z: 32, id: BLOCK.WATER }]);
  restored.getBlock(1, 40, 32);
  settle(restored);
  assert.equal(restored.getWaterLevel(1, 40, 32), 0);
  assert.equal(restored.getWaterLevel(7, 40, 32), 6);
  world.dispose(); restored.dispose();
});

test('torches require a full dry support block, cannot stack and drop once when support is broken', () => {
  const world = makeWorld();
  world.setBlock(1, 40, 32, BLOCK.STONE);
  assert.equal(world.canSupportTorch(1, 41, 32), true);
  assert.equal(world.setBlock(1, 41, 32, BLOCK.TORCH), true);
  assert.equal(world.setBlock(1, 42, 32, BLOCK.TORCH), false);
  assert.equal(world.setBlock(2, 41, 32, BLOCK.TORCH), false);
  for (const id of [BLOCK.RAMP, BLOCK.DOOR, BLOCK.WATER]) {
    world.setBlock(3, 40, 32, id);
    assert.equal(world.canSupportTorch(3, 41, 32), false);
  }
  world.setBlock(1, 40, 32, BLOCK.AIR);
  assert.equal(world.getBlock(1, 41, 32), BLOCK.AIR);
  assert.deepEqual(world.drainDrops(), [{ x: 1, y: 41, z: 32, id: BLOCK.TORCH, count: 1 }]);
  world.step(.08, 0, 32);
  assert.deepEqual(world.drainDrops(), []);
  world.dispose();
});

test('water displaces a torch once; queued drops and legacy unsupported stacks survive saves', () => {
  const world = makeWorld();
  channel(world);
  world.setBlock(2, 40, 32, BLOCK.TORCH);
  world.setBlock(1, 40, 32, BLOCK.WATER);
  settle(world);
  assert.equal(world.getBlock(2, 40, 32), BLOCK.WATER);
  assert.equal(world.canSupportTorch(2, 40, 32), false);
  const restored = new VoxelWorld(null, world.seed, world.serialize(), world.serializeFluids());
  assert.deepEqual(restored.drainDrops(), [{ x: 2, y: 40, z: 32, id: BLOCK.TORCH, count: 1 }]);
  assert.deepEqual(restored.drainDrops(), []);
  const legacy = new VoxelWorld(null, 'legacy', [
    { x: 3, y: 39, z: 32, id: BLOCK.STONE },
    { x: 3, y: 40, z: 32, id: BLOCK.TORCH },
    { x: 3, y: 41, z: 32, id: BLOCK.TORCH },
    { x: 3, y: 42, z: 32, id: BLOCK.TORCH },
  ]);
  legacy.getBlock(3, 42, 32);
  settle(legacy);
  assert.equal(legacy.getBlock(3, 40, 32), BLOCK.TORCH);
  assert.equal(legacy.getBlock(3, 41, 32), BLOCK.AIR);
  assert.equal(legacy.getBlock(3, 42, 32), BLOCK.AIR);
  assert.equal(legacy.drainDrops().length, 2);
  settle(legacy);
  assert.deepEqual(legacy.drainDrops(), []);
  world.dispose(); restored.dispose(); legacy.dispose();
});
