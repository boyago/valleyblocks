import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { EntitySystem } from '../src/entities.js';
import { VoxelWorld } from '../src/world.js';
import { BLOCK } from '../src/blocks.js';

function create() {
  const scene = new THREE.Scene();
  const world = new VoxelWorld(scene, 'entities-test');
  const entities = new EntitySystem(scene, world, {});
  return { scene, world, entities, close() { entities.dispose(); world.dispose(); } };
}

test('vehicles leave their starter parking, brake before reversing and stop with the handbrake', () => {
  const { entities, close } = create();
  const car = entities.vehicles[0];
  for (let frame = 0; frame < 60; frame++) entities.updateVehicle(1 / 60, car, new Set(['KeyW']));
  assert.ok(car.position.z < 2);
  assert.ok(car.speed > 7);
  entities.updateVehicle(1 / 60, car, new Set(['KeyS']));
  assert.ok(car.speed > 0, 'reverse input must initially brake');
  for (let frame = 0; frame < 120; frame++) entities.updateVehicle(1 / 60, car, { KeyS: true });
  assert.ok(car.speed < 0);
  for (let frame = 0; frame < 30; frame++) entities.updateVehicle(1 / 60, car, { Space: true });
  assert.equal(car.speed, 0);
  const pickup = entities.vehicles[1];
  for (let frame = 0; frame < 60; frame++) entities.updateVehicle(1 / 60, pickup, { KeyW: true });
  assert.ok(pickup.position.z > -3, 'pickup should leave through the garage opening');
  close();
});

test('a fast vehicle cannot cross a voxel wall, including while airborne', () => {
  const { world, entities, close } = create();
  const car = entities.vehicles[0];
  for (let x = 1; x <= 6; x++) for (let y = 9; y <= 13; y++) world.setBlock(x, y, 0, BLOCK.BRICK);
  car.speed = 14;
  for (let frame = 0; frame < 60; frame++) entities.updateVehicle(1 / 30, car, { KeyW: true });
  assert.ok(car.position.z > 2.45);
  assert.equal(car.speed, 0);
  for (let x = 1; x <= 6; x++) for (let y = 14; y <= 22; y++) world.setBlock(x, y, 0, BLOCK.BRICK);
  car.position.set(3.5, 17, 5);
  car.grounded = false;
  car.speed = 55;
  car.verticalVelocity = -3;
  entities.updateVehicle(0.05, car, { KeyW: true });
  assert.ok(car.position.z > 2.45, 'substeps must prevent airborne tunnelling at high speed');
  assert.equal(car.speed, 0);
  close();
});

test('vehicles drive off an unsupported ledge, fall into a deep pit and land on its floor', () => {
  const { world, entities, close } = create();
  const car = entities.vehicles[0];
  for (let x = 1; x <= 6; x++) for (let z = -35; z <= 2; z++) for (let y = 2; y <= 8; y++) world.setBlock(x, y, z, BLOCK.AIR);
  car.speed = 14;
  let airborne = false, lowest = 9;
  for (let frame = 0; frame < 120; frame++) {
    entities.updateVehicle(1 / 60, car, {});
    airborne ||= !car.grounded && car.verticalVelocity < -1 && car.speed > 5;
    lowest = Math.min(lowest, car.position.y);
  }
  assert.ok(car.position.z < -6, 'missing support must not act like an invisible wall');
  assert.ok(airborne, 'the car must accelerate downwards with horizontal momentum');
  assert.ok(lowest >= 1.98, 'the car must not tunnel through the floor');
  assert.ok(Math.abs(car.position.y - 2) < 0.03);
  assert.equal(car.verticalVelocity, 0);
  assert.equal(car.grounded, true);
  close();
});

test('a parked car falls when its supports are removed without an active driver', () => {
  const { world, entities, close } = create();
  const car = entities.vehicles[0];
  for (let x = 1; x <= 6; x++) for (let z = 2; z <= 7; z++) for (let y = 2; y <= 8; y++) world.setBlock(x, y, z, BLOCK.AIR);
  const player = new THREE.Vector3(0, 9, 10);
  for (let frame = 0; frame < 20; frame++) entities.update(1 / 60, player, {}, null);
  assert.ok(car.position.y < 8, 'all vehicles need gravity, even stationary unoccupied ones');
  assert.ok(car.verticalVelocity < -5);
  assert.equal(car.grounded, false);
  for (let frame = 0; frame < 60; frame++) entities.update(1 / 60, player, {}, null);
  assert.ok(Math.abs(car.position.y - 2) < 0.03);
  assert.equal(car.grounded, true);
  assert.equal(car.speed, 0);
  close();
});

test('rotated chassis corners cannot tunnel through narrow tall columns', () => {
  const { world, entities, close } = create();
  const car = entities.vehicles[0];
  car.position.set(1.5, 9, 13.5);
  car.yaw = Math.PI / 4;
  car.speed = 55;
  for (let y = 9; y <= 15; y++) world.setBlock(4, y, 14, BLOCK.BRICK);
  entities.updateVehicle(0.05, car, {});
  assert.equal(car.speed, 0);
  assert.ok(car.position.x < 2.4, 'the front side corner must stop before the column');
  assert.equal(entities.vehicleBlocked(car, car.position), false, 'the stopped chassis must remain outside the obstacle');
  close();
});

test('fast falls land without tunnelling and settle a tilted car onto a level floor', () => {
  const { entities, close } = create();
  const car = entities.vehicles[0];
  car.position.set(3.5, 20, 5);
  car.grounded = false;
  car.verticalVelocity = -55;
  car.pitch = -0.78;
  for (let frame = 0; frame < 12; frame++) entities.updateVehicle(0.05, car, {});
  assert.ok(Math.abs(car.position.y - 9) < 0.03);
  assert.equal(car.grounded, true);
  assert.equal(car.verticalVelocity, 0);
  assert.ok(Math.abs(car.pitch) < 0.01);
  close();
});

test('vehicles climb continuous ramps and keep independent lights', () => {
  const { entities, close } = create();
  const [car, pickup] = entities.vehicles;
  entities.toggleLights(car);
  assert.equal(car.headlights, true);
  assert.equal(pickup.headlights, false);
  assert.equal(car.lamps[0].material.emissiveIntensity, 1.8);
  assert.equal(pickup.lamps[0].material.emissiveIntensity, 0.12);
  car.position.set(10.5, 9, 18);
  for (let frame = 0; frame < 80; frame++) entities.updateVehicle(1 / 60, car, { KeyW: true });
  assert.ok(car.position.y > 10.5, 'suspension should climb the starter ramp');
  assert.ok(car.pitch < -0.1);
  for (let frame = 0; frame < 14; frame++) entities.updateVehicle(1 / 60, car, { KeyW: true });
  assert.equal(car.grounded, false, 'the car must leave the ramp with upward momentum');
  assert.ok(car.position.z < 10 && car.position.y > 14);
  assert.ok(car.verticalVelocity > 5 && car.speed > 8);
  const airborneSpeed = car.speed, airborneYaw = car.yaw, airborneY = car.position.y;
  for (let frame = 0; frame < 15; frame++) entities.updateVehicle(1 / 60, car, { KeyA: true, Space: true });
  assert.ok(car.position.y > airborneY, 'gravity should decelerate the jump instead of snapping to terrain');
  assert.ok(car.speed > airborneSpeed * 0.99, 'a handbrake cannot arrest momentum in the air');
  assert.equal(car.yaw, airborneYaw, 'steering requires tire contact');
  close();
});

test('midair saves preserve velocity and attitude, and legacy vehicle saves remain compatible', () => {
  const { scene, world, entities, close } = create();
  const car = entities.vehicles[0];
  car.position.set(3.5, 23, 5);
  car.speed = 11;
  car.verticalVelocity = 7;
  car.grounded = false;
  car.pitch = -0.35;
  car.roll = 0.1;
  const save = entities.serialize();
  const restored = new EntitySystem(scene, world, {}, save);
  const airborne = restored.vehicles[0];
  assert.equal(airborne.verticalVelocity, 7);
  assert.equal(airborne.grounded, false);
  assert.equal(airborne.pitch, -0.35);
  assert.equal(airborne.roll, 0.1);
  assert.equal(restored.findExit(airborne), null);
  airborne.speed = 0;
  assert.equal(restored.findExit(airborne), null, 'a stationary airborne car still has no safe exit');
  const pet = restored.pets[0];
  pet.position.copy(airborne.position);
  pet.tamed = true;
  assert.match(restored.interactPet(pet, 'board', pet.position), /Aproxime/, 'a pet cannot board a car in flight');
  restored.updateVehicle(1 / 60, airborne, { KeyW: true });
  assert.ok(airborne.position.y > 23 && airborne.verticalVelocity < 7);
  assert.equal(airborne.speed, 0, 'the engine cannot propel a car in flight');
  restored.dispose();
  const legacy = entities.serialize();
  for (const vehicle of legacy.vehicles) for (const key of ['verticalVelocity', 'grounded', 'pitch', 'roll']) delete vehicle[key];
  const old = new EntitySystem(scene, world, {}, legacy);
  assert.equal(old.vehicles[0].verticalVelocity, 0);
  assert.equal(old.vehicles[0].grounded, true);
  old.dispose();
  close();
});

test('pet pathfinding routes around walls, follows and honors stay', () => {
  const { world, entities, close } = create();
  const dog = entities.pets[0];
  for (let x = -3; x <= -1; x++) for (let y = 9; y <= 12; y++) world.setBlock(x, y, 5, BLOCK.BRICK);
  const player = new THREE.Vector3(-2, 9, 1);
  entities.interactPet(dog, 'tame', player);
  const path = entities.findPetPath(dog, player);
  assert.ok(path.length > 5);
  assert.ok(path.some(p => p.x >= 0 || p.x < -3), 'route should go around the wall');
  for (let frame = 0; frame < 900; frame++) entities.update(1 / 60, player, {}, null);
  assert.ok(dog.position.distanceTo(player) < 2.6, `dog stopped at ${dog.position.toArray()}`);
  entities.interactPet(dog, 'stay', player);
  const stayedAt = dog.position.clone();
  for (let frame = 0; frame < 180; frame++) entities.update(1 / 60, new THREE.Vector3(15, 9, 15), {}, null);
  assert.ok(stayedAt.distanceTo(dog.position) < 0.01);
  close();
});

test('a pet in a one-block trench turns along it instead of poking into the walls', () => {
  const { world, entities, close } = create();
  const dog = entities.pets[0];
  const x = Math.floor(dog.position.x), y = Math.floor(dog.position.y), z = Math.floor(dog.position.z);
  for (let dx = -3; dx <= 3; dx++) for (const dz of [-1, 1]) for (let h = 0; h <= 1; h++) world.setBlock(x + dx, y + h, z + dz, BLOCK.BRICK);
  entities.interactPet(dog, 'stay', dog.position);
  dog.yaw = 0; // olhando para a parede (+z)
  assert.equal(entities.petFits(dog, 0), false);
  for (let frame = 0; frame < 10; frame++) entities.update(1 / 60, dog.position.clone().add(new THREE.Vector3(0, 0, 3)), {}, null);
  assert.ok(Math.abs(Math.sin(dog.yaw)) > 0.99, `yaw ${dog.yaw}`);
  assert.ok(entities.petFits(dog, dog.yaw));
  close();
});

test('pet boarding survives save/restore and requires a stationary safe exit', () => {
  const { scene, world, entities, close } = create();
  const car = entities.vehicles[0], dog = entities.pets[0];
  dog.position.set(1.5, 9, 5);
  entities.interactPet(dog, 'tame', dog.position);
  assert.match(entities.interactPet(dog, 'board', dog.position), /embarcou/);
  assert.equal(car.passenger, dog);
  entities.update(1 / 60, new THREE.Vector3(3.5, 9, 8.5));
  assert.equal(entities.nearest(new THREE.Vector3(3.5, 9, 8.5), 4).kind, 'vehicle', 'the passenger must not steal the default enter action');
  car.speed = 2;
  assert.match(entities.interactPet(dog, 'unboard', dog.position), /Pare/);
  assert.equal(dog.vehicleId, car.id);
  const saved = entities.serialize();
  const restored = new EntitySystem(scene, world, {}, saved);
  assert.equal(restored.vehicles[0].passenger, restored.pets[0]);
  assert.equal(restored.vehicles[0].speed, 2);
  restored.vehicles[0].speed = 0;
  const driverExit = restored.findExit(restored.vehicles[0]);
  assert.match(restored.interactPet(restored.pets[0], 'unboard', driverExit), /segurança/);
  assert.equal(restored.pets[0].vehicleId, null);
  assert.ok(restored.pets[0].position.distanceTo(driverExit) > .8, 'a passenger must not disembark into the player');
  assert.ok(entities.blocksPlacement(3, 9, 5));
  restored.dispose();
  close();
});

test('vehicle placement validates the whole base and overlapping vehicle, pet and player volumes', () => {
  const { world, entities, close } = create();
  const position = new THREE.Vector3(8.5, 9, 6.5);
  assert.ok(entities.findVehiclePlacement('compact', position));
  assert.equal(entities.findVehiclePlacement('compact', new THREE.Vector3(5.5, 9, 5)), null, 'side overlap must be rejected even when the centre voxel is free');
  const oldGround = world.getBlock(9, 8, 7);
  world.setBlock(9, 8, 7, BLOCK.AIR);
  assert.equal(entities.findVehiclePlacement('compact', position), null, 'a hole under a remote corner must block placement');
  assert.equal(entities.spawnVehicle('compact', position), null);
  assert.equal(entities.vehicles.length, 2);
  world.setBlock(9, 8, 7, oldGround);
  const dog = entities.pets[0], previous = dog.position.clone();
  dog.position.set(9.55, 9, 6.5);
  assert.equal(entities.findVehiclePlacement('compact', position), null, 'an animal touching the side is part of the occupied volume');
  dog.position.copy(previous);
  assert.equal(entities.findVehiclePlacement('compact', position, Math.PI, { min: { x: 9.1, y: 9, z: 6.2 }, max: { x: 9.7, y: 10.8, z: 6.8 } }), null);
  assert.ok(entities.spawnVehicle('compact', position));
  close();
});

test('player collision catches a rotated vehicle corner even when every player corner is outside', () => {
  const { entities, close } = create();
  const car = entities.vehicles[0];
  car.position.set(0, 9, 0);
  car.yaw = Math.PI / 4;
  const min = { x: -2.25, y: 9, z: -.97 }, max = { x: -1.67, y: 10.78, z: -.39 };
  for (const x of [min.x, max.x]) for (const z of [min.z, max.z]) assert.equal(entities.pointInsideVehicle(new THREE.Vector3(x, 9.89, z), car), false);
  assert.equal(entities.vehicleIntersectsBox(car, min, max), true);
  assert.equal(entities.vehicleIntersectsBox(car, { ...min, x: min.x - 1 }, { ...max, x: max.x - 1 }), false);
  assert.equal(entities.vehicleIntersectsBox(car, { ...min, y: 12 }, { ...max, y: 14 }), false);
  close();
});

test('save restore preserves vehicle and pet positions beyond the original starter region', () => {
  const { scene, world, entities, close } = create();
  entities.vehicles[0].position.set(8432.5, 21, -9200.75);
  entities.pets[0].position.set(-7682.25, 17, 12045.5);
  const saved = entities.serialize();
  const restored = new EntitySystem(scene, world, {}, saved);
  assert.deepEqual(restored.vehicles[0].position.toArray(), saved.vehicles[0].position);
  assert.deepEqual(restored.pets[0].position.toArray(), saved.pets[0].position);
  restored.dispose();
  close();
});

test('starter animals have distinct coats and restore all three variants without duplicating pets', () => {
  const { scene, world, entities, close } = create();
  assert.deepEqual(entities.pets.map(p => [p.name, p.coatVariant]), [['Pingo', 0], ['Lua', 0], ['Mel', 1], ['Nino', 1]]);
  // Modelo do Blender: a pelagem está na cor por vértice do corpo; reserva de caixas: na cor do material.
  const coat = pet => { const m = pet.bodyGroup.children[0], c = m.geometry.getAttribute('color'); return c ? [...c.array.slice(0, 3)].join() : m.material.color.getHex(); };
  assert.notEqual(coat(entities.pets[0]), coat(entities.pets[2]));
  assert.notEqual(coat(entities.pets[1]), coat(entities.pets[3]));
  for (const pet of entities.pets) assert.ok(entities.petStand(pet.position.x, pet.position.z, pet.position.y), `${pet.name} needs a safe starter floor`);
  const saved = entities.serialize();
  saved.pets[1].coatVariant = 2;
  const restored = new EntitySystem(scene, world, {}, saved);
  assert.equal(restored.pets.length, 4);
  assert.deepEqual(restored.pets.map(p => p.coatVariant), [0, 2, 1, 1]);
  assert.notEqual(coat(restored.pets[1]), coat(entities.pets[1]));
  assert.notEqual(coat(restored.pets[1]), coat(entities.pets[3]));
  assert.deepEqual(restored.serialize().pets.map(p => p.coatVariant), [0, 2, 1, 1]);
  restored.dispose();
  const legacy = entities.serialize();
  legacy.pets = legacy.pets.slice(0, 2).map(({ coatVariant, ...pet }) => pet);
  const oldWorld = new EntitySystem(scene, world, {}, legacy);
  assert.equal(oldWorld.pets.length, 2, 'loading older worlds must not append starter animals');
  assert.deepEqual(oldWorld.pets.map(p => p.coatVariant), [0, 0]);
  oldWorld.dispose();
  close();
});

test('distant wild animals sleep without moving and resume near the player', () => {
  const { entities, close } = create();
  const pet = entities.pets[2];
  pet.wanderTimer = 0;
  const position = pet.position.clone(), gait = pet.gait;
  for (let frame = 0; frame < 120; frame++) entities.update(1 / 60, new THREE.Vector3(1000, 9, 1000));
  assert.deepEqual(pet.position.toArray(), position.toArray());
  assert.equal(pet.gait, gait);
  assert.equal(pet.wanderTimer, 0);
  entities.update(1 / 60, position);
  assert.ok(pet.wanderTimer > 0);
  assert.ok(pet.gait > gait);
  close();
});

test('vehicle restore preserves large trunk stacks and driving state within physical limits', () => {
  const { scene, world, entities, close } = create();
  const car = entities.vehicles[0];
  car.trunk = { 3: 25000, food: 12000 };
  car.speed = 12.75;
  car.steering = -.32;
  const saved = entities.serialize();
  assert.equal(saved.vehicles[0].speed, 12.75);
  assert.equal(saved.vehicles[0].steering, -.32);
  saved.vehicles[0].trunk.fractional = 3.5;
  saved.vehicles[0].trunk.unsafe = Number.MAX_SAFE_INTEGER + 1;
  saved.vehicles[0].trunk.negative = -4;
  const restored = new EntitySystem(scene, world, {}, saved);
  assert.deepEqual(restored.vehicles[0].trunk, { 3: 25000, food: 12000 });
  assert.equal(restored.vehicles[0].speed, 12.75);
  assert.equal(restored.vehicles[0].steering, -.32);
  restored.dispose();
  saved.vehicles[0].speed = 1000000;
  saved.vehicles[0].steering = -8;
  saved.vehicles[1].speed = -1000000;
  saved.vehicles[1].steering = 8;
  const bounded = new EntitySystem(scene, world, {}, saved);
  assert.equal(bounded.vehicles[0].speed, bounded.vehicles[0].maxSpeed);
  assert.equal(bounded.vehicles[0].steering, -.5);
  assert.equal(bounded.vehicles[1].speed, -4.5);
  assert.equal(bounded.vehicles[1].steering, .5);
  bounded.dispose();
  close();
});
