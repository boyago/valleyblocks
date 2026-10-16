import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BLOCK } from '../src/blocks.js';
import { VoxelWorld } from '../src/world.js';

test('exploration through 24 regions bounds loaded resources and preserves every edit', () => {
  const scene = new THREE.Scene();
  const world = new VoxelWorld(scene, 'long-exploration');
  const edits = [];
  for (let region = -12; region < 12; region++) {
    const x = 16, z = region * 64;
    world.ensureAround(x, z, 1);
    const y = world.surfaceHeight(x, z);
    world.setBlock(x, y, z, BLOCK.BRICK);
    edits.push({x,y,z});
    for(let i=0;i<12;i++) world.update(x,z,1);
    assert.ok(world.chunks.size <= 49, 'unloaded data must not grow with travel distance');
    assert.ok(scene.children.length <= 27, 'distant chunk meshes must be released');
    for(const laneX of [2,3,4,5]) {
      assert.equal(world.getBlock(laneX,8,z),BLOCK.ASPHALT);
      assert.equal(world.getBlock(laneX,9,z),BLOCK.AIR);
    }
  }
  const restored = new VoxelWorld(new THREE.Scene(),'long-exploration',world.serialize());
  for(const edit of edits) assert.equal(restored.getBlock(edit.x,edit.y,edit.z),BLOCK.BRICK);
  world.dispose();restored.dispose();
  assert.equal(scene.children.length,0);
});

test('spawn, cottage, garage, road and fractional ramp are usable', () => {
  const world = new VoxelWorld(new THREE.Scene());
  assert.equal(world.surfaceHeight(0, 12), 9);
  assert.equal(world.collides({ x: -.3, y: 9, z: 11.7 }, { x: .3, y: 10.8, z: 12.3 }), false);
  assert.equal(world.collides({ x: -.3, y: 8.9, z: 11.7 }, { x: .3, y: 10.8, z: 12.3 }), true);
  assert.equal(world.getBlock(3, 8, 0), BLOCK.ASPHALT);
  assert.equal(world.getBlock(-9, 9, 2), BLOCK.DOOR);
  assert.equal(world.collides({ x: 9, y: 9, z: -6 }, { x: 12, y: 10.6, z: -3 }), false);
  assert.equal(world.getBlock(-6, 9, -4), BLOCK.CHEST);
  assert.equal(world.heightAt(10.5, 14.75, 10), 9.25);
  assert.equal(world.heightAt(10.5, 14.25, 10), 9.75);
  assert.equal(world.collides({ x: 10.1, y: 9.8, z: 14.3 }, { x: 10.9, y: 11, z: 14.8 }), false);
  assert.equal(world.getBlock(0, -10, 0), BLOCK.STONE);
  assert.equal(world.setBlock(0, 0, 0, BLOCK.AIR), false);
  world.dispose();
});

test('edits survive unloading and serialization across negative chunk edges', () => {
  const world = new VoxelWorld(new THREE.Scene(), 'persist-test');
  world.ensureAround(0, 0);
  assert.equal(world.setBlock(-16, 20, -1, BLOCK.BRICK), true);
  assert.equal(world.setBlock(-16, 20, -1, BLOCK.BRICK), false);
  assert.equal(world.revision, 1);
  assert.ok(world.dirty.has('-2,-1'));
  const saved = world.serialize();
  world.update(1000, 1000, 1);
  assert.equal(world.chunks.has('-1,-1'), false);
  assert.equal(world.getBlock(-16, 20, -1), BLOCK.BRICK);
  const restored = new VoxelWorld(new THREE.Scene(), 'persist-test', saved);
  assert.equal(restored.getBlock(-16, 20, -1), BLOCK.BRICK);
  restored.dispose(); world.dispose();
});

test('raycast returns exact hit, entered face and range with zero direction axes', () => {
  const world = new VoxelWorld(new THREE.Scene());
  world.setBlock(-2, 20, -2, BLOCK.GLASS);
  const hit = world.raycast(new THREE.Vector3(-1.5, 24, -1.5), new THREE.Vector3(0, -1, 0), 6);
  assert.deepEqual(hit, { x: -2, y: 20, z: -2, id: BLOCK.GLASS, normal: { x: 0, y: 1, z: 0 }, distance: 3 });
  assert.equal(world.raycast(new THREE.Vector3(-1.5, 24, -1.5), new THREE.Vector3(0, -1, 0), 2.9), null);
  assert.equal(world.raycast(new THREE.Vector3(), new THREE.Vector3(), 6), null);
  world.dispose();
});

test('seed generation is repeatable, contains water and ore, and meshes dispose cleanly', () => {
  const scene = new THREE.Scene();
  const first = new VoxelWorld(scene, 'test-seed');
  const second = new VoxelWorld(new THREE.Scene(), 'test-seed');
  assert.equal(first.getBlock(-35, 8, 18), BLOCK.WATER);
  first.ensureAround(48, 48, 0);
  second.ensureAround(48, 48, 0);
  assert.deepEqual(first.chunks.get('3,3').data, second.chunks.get('3,3').data);
  assert.ok(first.chunks.get('3,3').data.includes(BLOCK.ORE));
  first.update(0, 12, 1);
  assert.ok(scene.children.length > 0);
  for (const mesh of scene.children) {
    assert.equal(mesh.geometry.getAttribute('position').count, mesh.geometry.getAttribute('normal').count);
    assert.ok(mesh.geometry.boundingSphere.radius > 0);
  }
  first.dispose(); second.dispose();
  assert.equal(scene.children.length, 0);
});
