import * as THREE from 'three';
import { BLOCK } from './blocks.js';
import { petHealth, feedPet } from './pet-health.js';
import { buildCreature } from './creatures.js';

const UP = new THREE.Vector3(0, 1, 0);
const clamp = THREE.MathUtils.clamp;
const PET_COATS = {
  dog: [
    { coat: '#ca9b66', light: '#efdcb0', ear: '#785945', tail: '#b58254' },
    { coat: '#e0aa3f', light: '#ffedbf', ear: '#9f562d', tail: '#c07c30' },
    { coat: '#454e50', light: '#e9ecdb', ear: '#222e31', tail: '#303b3d' },
  ],
  cat: [
    { coat: '#9aaba5', light: '#e1e5cb', ear: '#9aaba5', tail: '#637e75' },
    { coat: '#3c4850', light: '#f0eee0', ear: '#3c4850', tail: '#222e38' },
    { coat: '#dba066', light: '#ffe3b4', ear: '#dba066', tail: '#9e5b3b' },
  ],
};
const damp = (a, b, speed, dt) => THREE.MathUtils.lerp(a, b, 1 - Math.exp(-speed * dt));
const finite = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
const keyDown = (keys, ...codes) => codes.some(code => keys?.has?.(code) || keys?.[code]);
const vec = (v, fallback = [0, 9, 0]) => new THREE.Vector3(
  clamp(finite(Array.isArray(v) ? v[0] : v?.x, fallback[0]), -999999, 999999),
  clamp(finite(Array.isArray(v) ? v[1] : v?.y, fallback[1]), -32, 128),
  clamp(finite(Array.isArray(v) ? v[2] : v?.z, fallback[2]), -999999, 999999),
);
const localWorld = (position, yaw, x, y, z) => new THREE.Vector3(
  position.x + Math.cos(yaw) * x + Math.sin(yaw) * z,
  position.y + y,
  position.z - Math.sin(yaw) * x + Math.cos(yaw) * z,
);

/** Cars point along local +Z; positions represent contact with the ground. */
export class EntitySystem {
  constructor(scene, world, audio, savedState = null) {
    this.scene = scene;
    this.world = world;
    this.audio = audio;
    this.vehicles = [];
    this.pets = [];
    this.clock = 0;
    this.serial = 0;
    this.materials = new Map();
    this.geometries = new Set();
    this.lastRevision = world.revision;
    const savedVehicles = Array.isArray(savedState?.vehicles) ? savedState.vehicles.slice(0, 8) : null;
    for (const data of savedVehicles?.length ? savedVehicles : [
      { type: 'compact', position: [3.5, 9, 5], yaw: Math.PI },
      { type: 'pickup', position: [10, 9, -5], yaw: 0 },
    ]) {
      const vehicle = this.spawnVehicle(data.type, vec(data.position), true);
      vehicle.id = typeof data.id === 'string' ? data.id.slice(0, 48) : vehicle.id;
      vehicle.yaw = finite(data.yaw, Math.PI);
      vehicle.speed = clamp(finite(data.speed), -4.5, vehicle.maxSpeed);
      vehicle.verticalVelocity = clamp(finite(data.verticalVelocity), -55, 25);
      vehicle.grounded = data.grounded !== false;
      vehicle.pitch = clamp(finite(data.pitch), -0.9, 0.9);
      vehicle.roll = clamp(finite(data.roll), -0.65, 0.65);
      vehicle.steering = clamp(finite(data.steering), -0.5, 0.5);
      vehicle.headlights = !!data.headlights;
      vehicle.trunk = Object.fromEntries(Object.entries(data.trunk || {}).filter(([k, n]) => /^[\w-]{1,32}$/.test(k) && Number.isSafeInteger(n) && n > 0).slice(0, 50));
      this.updateLights(vehicle);
      this.syncVehicle(vehicle);
    }
    const savedPets = Array.isArray(savedState?.pets) ? savedState.pets.slice(0, 12) : null;
    for (const data of savedPets?.length ? savedPets : [
      { type: 'dog', name: 'Pingo', position: [-2, 9, 9], coatVariant: 0 },
      { type: 'cat', name: 'Lua', position: [-5, 9, 8], coatVariant: 0 },
      { type: 'dog', name: 'Mel', position: [-17, 9, 16], coatVariant: 1 },
      { type: 'cat', name: 'Nino', position: [17, 9, 18], coatVariant: 1 },
    ]) {
      const pet = this.createPet(data.type, vec(data.position), data.coatVariant);
      pet.id = typeof data.id === 'string' ? data.id.slice(0, 48) : pet.id;
      pet.name = typeof data.name === 'string' ? data.name.slice(0, 20) : pet.name;
      pet.tamed = !!data.tamed;
      pet.health = petHealth(data.health);
      pet.mode = data.mode === 'stay' ? 'stay' : data.mode==='guard'&&pet.type==='cat'&&pet.tamed?'guard':data.mode === 'hunt' && pet.type === 'dog' && pet.tamed ? 'hunt' : 'follow';
      pet.guardAnchor=Array.isArray(data.guardAnchor)?vec(data.guardAnchor):pet.position.clone();
      pet.carry = pet.type==='dog' && ['raw_chicken','raw_rabbit','raw_boar'].includes(data.carry?.item) && Number.isSafeInteger(data.carry?.count) && data.carry.count>0 && data.carry.count<=3 ? {...data.carry} : null;
      pet.yaw = finite(data.yaw);
      const vehicle = this.vehicles.find(v => v.id === data.vehicleId);
      if (vehicle && !vehicle.passenger) {
        vehicle.passenger = pet;
        pet.vehicleId = vehicle.id;
        pet.tamed = true;
      }
      pet.collar.visible = pet.tamed;
      pet.mesh.position.copy(pet.position);
    }
  }

  material(color, extra = {}) {
    const key = `${color}:${JSON.stringify(extra)}`;
    if (!this.materials.has(key)) this.materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, ...extra }));
    return this.materials.get(key);
  }

  nextId(prefix) {
    let id;
    do { id = `${prefix}-${++this.serial}`; } while ([...this.vehicles, ...this.pets].some(entity => entity.id === id));
    return id;
  }

  box(parent, size, position, color, extra = {}) {
    const geometry = new THREE.BoxGeometry(...size);
    this.geometries.add(geometry);
    const mesh = new THREE.Mesh(geometry, this.material(color, extra));
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  spawnVehicle(type = 'compact', position = new THREE.Vector3(3.5, 9, 5), restoring = false) {
    if (this.vehicles.length >= 8) return null;
    type = type === 'pickup' || type === 'truck' ? 'pickup' : 'compact';
    const spawnPosition = restoring ? vec(position) : this.findVehiclePlacement(type, vec(position));
    if (!spawnPosition) return null;
    const truck = type === 'pickup';
    const mesh = new THREE.Group();
    mesh.name = truck ? 'Picape utilitária' : 'Compacto laranja';
    const vehicle = {
      id: this.nextId('vehicle'), type, name: truck ? 'Picape' : 'Compacto',
      position: spawnPosition, yaw: Math.PI, speed: 0, steering: 0, headlights: false,
      passenger: null, mesh, trunk: {}, wheels: [], lamps: [], brakeLamps: [],
      halfWidth: truck ? 0.98 : 0.88, halfLength: truck ? 1.85 : 1.52,
      maxSpeed: truck ? 11.5 : 14.5, wheelbase: truck ? 2.65 : 2.1,
      pitch: 0, roll: 0, impactCooldown: 0, groundY: finite(position?.y, 9),
      verticalVelocity: 0, grounded: true,
    };
    const paint = truck ? '#338e88' : '#e9933e';
    const trim = '#f7e8ba';
    const width = vehicle.halfWidth * 2;
    const length = vehicle.halfLength * 2;
    this.box(mesh, [width - 0.12, 0.32, length - 0.2], [0, 0.49, 0], '#263536');
    this.box(mesh, [width, 0.48, length - 0.16], [0, 0.88, 0], paint);
    this.box(mesh, [width + 0.07, 0.21, 0.17], [0, 0.49, length / 2], '#d4d9c4', { metalness: 0.35 });
    this.box(mesh, [width + 0.07, 0.21, 0.17], [0, 0.49, -length / 2], '#d4d9c4', { metalness: 0.35 });
    this.box(mesh, [width * 0.49, 0.2, 0.05], [0, 0.79, length / 2 + 0.01], '#263536');
    for (let i = -2; i <= 2; i++) this.box(mesh, [0.035, 0.16, 0.06], [i * 0.14, 0.79, length / 2 + 0.045], '#778d84');
    const cabinZ = truck ? 0.42 : -0.07;
    const cabinLength = truck ? 1.45 : 1.65;
    // Open, transparent windows make the interior and travelling pet visible.
    this.box(mesh, [width - 0.17, 0.13, cabinLength + 0.09], [0, 1.88, cabinZ], trim);
    for (const x of [-1, 1]) {
      for (const z of [-1, 1]) this.box(mesh, [0.09, 0.76, 0.1], [x * (width / 2 - 0.11), 1.49, cabinZ + z * cabinLength / 2], paint);
      this.box(mesh, [0.07, 0.3, cabinLength - 0.12], [x * (width / 2 - 0.04), 1.12, cabinZ], paint);
      this.box(mesh, [0.1, 0.055, 0.23], [x * (width / 2 + 0.01), 1.22, cabinZ - 0.17], '#f1e5c1');
      this.box(mesh, [0.21, 0.17, 0.14], [x * (width / 2 + 0.09), 1.43, cabinZ + 0.5], paint);
      this.box(mesh, [0.22, 0.18, 0.055], [x * (width / 2 + 0.09), 1.43, cabinZ + 0.59], '#afcfda', { metalness: 0.4 });
    }
    for (const z of [-1, 1]) this.box(mesh, [width - 0.27, 0.61, 0.025], [0, 1.5, cabinZ + z * (cabinLength / 2 - 0.01)], '#a9d7db', { transparent: true, opacity: 0.25, depthWrite: false, roughness: 0.2 });
    this.box(mesh, [width - 0.27, 0.18, 0.3], [0, 1.21, cabinZ + cabinLength / 2 - 0.08], '#34434a');
    for (const x of [-0.42, 0.42]) {
      this.box(mesh, [0.53, 0.14, 0.56], [x, 1.04, cabinZ - 0.1], '#454a47');
      this.box(mesh, [0.51, 0.51, 0.15], [x, 1.32, cabinZ - 0.34], '#454a47');
    }
    const steeringGeo = new THREE.TorusGeometry(0.18, 0.035, 4, 10);
    this.geometries.add(steeringGeo);
    const steeringWheel = new THREE.Mesh(steeringGeo, this.material('#202f30'));
    steeringWheel.position.set(-0.43, 1.45, cabinZ + 0.45);
    steeringWheel.rotation.x = -0.4;
    mesh.add(steeringWheel);
    vehicle.steeringWheel = steeringWheel;
    if (truck) {
      this.box(mesh, [width - 0.24, 0.09, 1.53], [0, 1.02, -1.02], '#335c59');
      for (const x of [-1, 1]) this.box(mesh, [0.13, 0.37, 1.57], [x * (width / 2 - 0.07), 1.24, -1.02], paint);
      this.box(mesh, [width, 0.38, 0.12], [0, 1.24, -1.76], paint);
      this.box(mesh, [0.45, 0.44, 0.48], [0.36, 1.28, -1.16], '#ac7d49');
      for (const y of [1.14, 1.43]) this.box(mesh, [0.49, 0.05, 0.51], [0.36, y, -1.16], '#684e37');
    } else {
      this.box(mesh, [width - 0.14, 0.09, 0.6], [0, 1.13, 1.13], paint);
      this.box(mesh, [width - 0.13, 0.09, 0.57], [0, 1.12, -1.13], paint);
    }
    for (const side of [-1, 1]) for (const axle of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * (width / 2 - 0.02), 0.4, axle * vehicle.wheelbase / 2);
      mesh.add(pivot);
      const spin = new THREE.Group();
      pivot.add(spin);
      const tireGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.29, 12);
      this.geometries.add(tireGeo);
      const tire = new THREE.Mesh(tireGeo, this.material('#253031'));
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      spin.add(tire);
      const hubGeo = new THREE.CylinderGeometry(0.21, 0.21, 0.3, 8);
      this.geometries.add(hubGeo);
      const hub = new THREE.Mesh(hubGeo, this.material('#dfd8bc', { metalness: 0.4 }));
      hub.rotation.z = Math.PI / 2;
      spin.add(hub);
      this.box(spin, [0.315, 0.065, 0.34], [0, 0, 0], '#778b87');
      vehicle.wheels.push({ pivot, spin, front: axle > 0 });
    }
    for (const side of [-1, 1]) {
      const lamp = this.box(mesh, [0.35, 0.27, 0.07], [side * width * 0.34, 0.9, length / 2 - 0.045], '#fff1b4', { emissive: '#fff0a4', emissiveIntensity: 0.12 });
      lamp.material = lamp.material.clone();
      this.materials.set(`${vehicle.id}-headlight-${side}`, lamp.material);
      vehicle.lamps.push(lamp);
      const brakeLamp = this.box(mesh, [0.3, 0.2, 0.08], [side * width * 0.36, 0.9, -length / 2 + 0.03], '#c74b3d', { emissive: '#ff3921', emissiveIntensity: 0.13 });
      brakeLamp.material = brakeLamp.material.clone();
      this.materials.set(`${vehicle.id}-brakelight-${side}`, brakeLamp.material);
      vehicle.brakeLamps.push(brakeLamp);
      const light = new THREE.SpotLight('#ffefc0', 0, 22, Math.PI / 5, 0.55, 1.3);
      light.position.set(side * width * 0.34, 1.0, length / 2 + 0.03);
      light.target.position.set(side * width * 0.34, 0.4, length / 2 + 12);
      mesh.add(light, light.target);
      (vehicle.spots ||= []).push(light);
    }
    this.box(mesh, [0.48, 0.17, 0.035], [0, 0.58, -length / 2 - 0.085], '#eee2b3');
    mesh.userData.vehicle = vehicle;
    this.scene.add(mesh);
    this.vehicles.push(vehicle);
    if (!restoring) {
      this.world.ensureAround?.(vehicle.position.x, vehicle.position.z, 1);
    }
    this.syncVehicle(vehicle);
    return vehicle;
  }

  /** Pet de caixas: reserva para quando o modelo do Blender não existe. */
  boxPet(cat, palette, coatVariant, bodyGroup) {
    const { coat, light } = palette;
    this.box(bodyGroup, cat ? [0.48, 0.39, 0.77] : [0.59, 0.5, 0.96], [0, cat ? 0.43 : 0.53, -0.05], coat);
    this.box(bodyGroup, cat ? [0.29, 0.28, 0.28] : [0.39, 0.34, 0.32], [0, cat ? 0.4 : 0.52, 0.25], light);
    const head = new THREE.Group();
    head.position.set(0, cat ? 0.74 : 0.88, cat ? 0.38 : 0.49);
    bodyGroup.add(head);
    this.box(head, cat ? [0.5, 0.42, 0.43] : [0.55, 0.49, 0.5], [0, 0, 0], coat);
    this.box(head, cat ? [0.25, 0.15, 0.14] : [0.36, 0.22, 0.24], [0, -0.09, cat ? 0.25 : 0.3], light);
    this.box(head, [0.09, 0.075, 0.05], [0, -0.035, cat ? 0.33 : 0.435], cat ? '#c78178' : '#303d3a');
    for (const side of [-1, 1]) {
      this.box(head, [0.075, 0.09, 0.035], [side * 0.16, 0.045, cat ? 0.222 : 0.257], cat ? '#315948' : '#273735');
      this.box(head, [0.025, 0.029, 0.038], [side * 0.17, 0.065, cat ? 0.228 : 0.265], '#fffce4');
      const ear = this.box(head, cat ? [0.18, 0.23, 0.14] : [0.17, 0.4, 0.23], [side * 0.22, cat ? 0.25 : 0.04, -0.04], palette.ear);
      ear.rotation.z = side * (cat ? -0.22 : 0.17);
      if (cat) this.box(head, [0.09, 0.11, 0.025], [side * 0.22, 0.27, 0.042], '#d2a89e');
      if (cat) for (const y of [-0.065, -0.12]) this.box(head, [0.25, 0.012, 0.015], [side * 0.29, y, 0.27], '#e2e5cd');
    }
    const legs = [];
    for (const side of [-1, 1]) for (const end of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(side * (cat ? 0.16 : 0.2), cat ? 0.29 : 0.34, end * (cat ? 0.25 : 0.34));
      bodyGroup.add(leg);
      this.box(leg, cat ? [0.14, 0.28, 0.15] : [0.17, 0.33, 0.19], [0, cat ? -0.13 : -0.15, 0], coat);
      this.box(leg, cat ? [0.16, 0.1, 0.2] : [0.2, 0.1, 0.24], [0, cat ? -0.24 : -0.29, 0.025], light);
      legs.push({ mesh: leg, phase: side * end, back: end < 0 });
    }
    const tail = new THREE.Group();
    tail.position.set(0, cat ? 0.57 : 0.7, cat ? -0.4 : -0.54);
    bodyGroup.add(tail);
    const tailPart = this.box(tail, cat ? [0.12, 0.57, 0.13] : [0.15, 0.17, 0.49], cat ? [0, 0.23, -0.07] : [0, 0.09, -0.19], cat ? coat : palette.tail);
    tailPart.rotation.x = cat ? -0.35 : 0.45;
    if (cat) this.box(tail, [0.12, 0.16, 0.23], [0, 0.49, -0.13], palette.tail);
    if (cat && coatVariant === 2) for (const z of [-0.25, -0.05, 0.15]) this.box(bodyGroup, [0.49, 0.035, 0.08], [0, 0.63, z], palette.tail);
    if (!cat && coatVariant === 2) this.box(bodyGroup, [0.6, 0.04, 0.4], [0, 0.78, -0.19], light);
    return { head, tail, legs };
  }
  createPet(type, position, coatVariant = 0) {
    type = type === 'cat' ? 'cat' : 'dog';
    coatVariant = clamp(Math.floor(finite(coatVariant)), 0, 2);
    const cat = type === 'cat';
    const mesh = new THREE.Group();
    const bodyGroup = new THREE.Group();
    mesh.add(bodyGroup);
    const palette = PET_COATS[type][coatVariant];
    const { coat, light } = palette;
    const PHASES = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    const model = buildCreature(type + coatVariant, bodyGroup);
    const { head, tail, legs } = model
      ? { head: model.head, tail: model.tail, legs: model.legs.map((leg, i) => ({ mesh: leg, phase: PHASES[i][0] * PHASES[i][1], back: PHASES[i][1] < 0 })) }
      : this.boxPet(cat, palette, coatVariant, bodyGroup);
    const collar = new THREE.Group();
    this.box(collar, cat ? [0.5, 0.09, 0.14] : [0.61, 0.1, 0.16], [0, cat ? 0.56 : 0.69, cat ? 0.29 : 0.33], cat ? '#bc779f' : '#35b9b2');
    this.box(collar, [0.11, 0.14, 0.04], [0, cat ? 0.47 : 0.59, cat ? 0.38 : 0.43], '#f4d46b', { metalness: 0.4 });
    bodyGroup.add(collar);
    collar.visible = false;
    const pet = {
      id: this.nextId('pet'), type, coatVariant, name: cat ? 'Lua' : 'Pingo', tamed: false, mode: 'follow',
      position: position.clone(), mesh, bodyGroup, head, tail, legs, collar, yaw: 0,
      vehicleId: null, path: [], routeAge: 1, wanderTimer: 4 + Math.random() * 3,
      home: position.clone(), goal: null, gait: Math.random() * 4, affection: 0,
      stuck: 0, soundTimer: 10 + Math.random() * 12, moving: false, jump: 0,
    };
    mesh.userData.pet = pet;
    this.scene.add(mesh);
    this.pets.push(pet);
    return pet;
  }

  groundAt(x, z, nearY, maxUp = 1.05, maxDown = 1.2) {
    if (this.world.heightAt) {
      const value = this.world.heightAt(x, z, nearY + maxUp + 0.001);
      return Number.isFinite(value) && value >= nearY - maxDown && value <= nearY + maxUp + 0.005 ? value : null;
    }
    for (let y = Math.floor(nearY + maxUp); y >= Math.ceil(nearY - maxDown); y--) {
      if (this.world.isSolid(Math.floor(x), y - 1, Math.floor(z)) && !this.world.isSolid(Math.floor(x), y, Math.floor(z))) return y;
    }
    return null;
  }

  volumeBlocked(min, max) {
    if (this.world.collides) return this.world.collides(min, max);
    for (let x = Math.floor(min.x); x < Math.ceil(max.x); x++)
      for (let y = Math.floor(min.y); y < Math.ceil(max.y); y++)
        for (let z = Math.floor(min.z); z < Math.ceil(max.z); z++)
          if (this.world.isSolid(x, y, z)) return true;
    return false;
  }

  safeStand(x, z, nearY, height = 1.8, radius = 0.3, maxUp = 1.05, maxDown = 1.2) {
    let y = this.groundAt(x, z, nearY, maxUp, maxDown);
    if (y == null) return null;
    const corners = [];
    for (const dx of [-radius, radius]) for (const dz of [-radius, radius]) {
      const h = this.groundAt(x + dx, z + dz, y, 0.3, 0.8);
      if (h == null || Math.abs(h - y) > 0.35) return null;
      corners.push(h);
    }
    y = Math.max(y, ...corners);
    if (this.volumeBlocked(new THREE.Vector3(x - radius, y + 0.04, z - radius), new THREE.Vector3(x + radius, y + height, z + radius))) return null;
    return new THREE.Vector3(x, y, z);
  }

  vehicleTerrain(vehicle, x, z, yaw) {
    const heights = [];
    const pivot = new THREE.Vector3(x, vehicle.position.y, z);
    // A fully supported slope is needed for placement and suspension alignment.
    // Motion itself may continue without this fit (jumping, falling or partial contact).
    for (const lx of [-vehicle.halfWidth + 0.15, 0, vehicle.halfWidth - 0.15]) {
      for (const lz of [-vehicle.halfLength + 0.2, 0, vehicle.halfLength - 0.2]) {
        const p = localWorld(pivot, yaw, lx, 0, lz);
        const reach = vehicle.halfLength + 0.7;
        const y = this.groundAt(p.x, p.z, vehicle.position.y, reach, reach);
        if (y == null) return null;
        heights.push(y);
      }
    }
    const groundY = heights.reduce((sum, h) => sum + h, 0) / heights.length;
    const slopeZ = ((heights[2] + heights[5] + heights[8]) - (heights[0] + heights[3] + heights[6])) / (3 * (vehicle.halfLength * 2 - 0.4));
    const slopeX = ((heights[6] + heights[7] + heights[8]) - (heights[0] + heights[1] + heights[2])) / (3 * (vehicle.halfWidth * 2 - 0.3));
    if (Math.abs(groundY - vehicle.position.y) > 1.05 || Math.abs(slopeZ) > 1.08 || Math.abs(slopeX) > 0.76) return null;
    // Reject abrupt walls and holes that a smooth slope fit would otherwise hide.
    for (let ix = 0; ix < 3; ix++) for (let iz = 0; iz < 3; iz++) {
      const predicted = groundY + (ix - 1) * (vehicle.halfWidth - 0.15) * slopeX + (iz - 1) * (vehicle.halfLength - 0.2) * slopeZ;
      if (Math.abs(heights[ix * 3 + iz] - predicted) > 0.56) return null;
    }
    pivot.y = groundY;
    // Thin columns follow the rotated footprint instead of an oversized world AABB.
    for (let lx = -vehicle.halfWidth + 0.12; lx <= vehicle.halfWidth - 0.1; lx += 0.38) {
      for (let lz = -vehicle.halfLength + 0.12; lz <= vehicle.halfLength - 0.1; lz += 0.38) {
        const p = localWorld(pivot, yaw, lx, 0, lz);
        const bottom = groundY + lx * slopeX + lz * slopeZ;
        if (this.volumeBlocked(new THREE.Vector3(p.x - 0.19, bottom + 0.48, p.z - 0.19), new THREE.Vector3(p.x + 0.19, bottom + 1.93, p.z + 0.19))) return null;
      }
    }
    for (const other of this.vehicles) {
      if (other === vehicle || Math.abs(other.position.y - groundY) > 2) continue;
      // Separating axes for two rectangular vehicle footprints.
      const axes = [yaw, yaw + Math.PI / 2, other.yaw, other.yaw + Math.PI / 2];
      const separated = axes.some(axis => {
        const ax = Math.cos(axis), az = -Math.sin(axis);
        const project = (v, angle) => (v.halfWidth + 0.13) * Math.abs(Math.cos(angle - axis)) + (v.halfLength + 0.09) * Math.abs(Math.sin(angle - axis));
        return Math.abs((x - other.position.x) * ax + (z - other.position.z) * az) >= project(vehicle, yaw) + project(other, other.yaw) + 0.05;
      });
      if (!separated) return null;
    }
    return { y: groundY, pitch: Math.atan(slopeZ), roll: Math.atan(slopeX) };
  }

  /** Collide a tilted chassis across the whole footprint, including its corners. */
  vehicleBlocked(vehicle, position, yaw = vehicle.yaw, wheels = true) {
    const slopeX = Math.tan(vehicle.roll), slopeZ = -Math.tan(vehicle.pitch);
    const slopeExtent = Math.abs(slopeX * Math.cos(yaw) + slopeZ * Math.sin(yaw)) + Math.abs(-slopeX * Math.sin(yaw) + slopeZ * Math.cos(yaw));
    const nx = Math.ceil(vehicle.halfWidth * 2 / 0.3), nz = Math.ceil(vehicle.halfLength * 2 / 0.3);
    const pad = 0.16;
    for (let ix = 0; ix <= nx; ix++) for (let iz = 0; iz <= nz; iz++) {
      const lx = -vehicle.halfWidth + vehicle.halfWidth * 2 * ix / nx;
      const lz = -vehicle.halfLength + vehicle.halfLength * 2 * iz / nz;
      const p = localWorld(position, yaw, lx, 0, lz);
      const bottom = position.y + lx * slopeX + lz * slopeZ;
      // Each column has a small horizontal extent; account for the slope within it.
      const slopeAllowance = pad * slopeExtent;
      const clearance = wheels ? 0.35 : 0.48;
      if (this.volumeBlocked({ x: p.x - pad, y: bottom + clearance + slopeAllowance, z: p.z - pad }, { x: p.x + pad, y: bottom + 1.93, z: p.z + pad })) return true;
    }
    // Wheels reach the ground; bumpers have clearance while leaving a ramp crest.
    if (wheels) for (const lx of [-vehicle.halfWidth + 0.12, vehicle.halfWidth - 0.12]) for (const lz of [-vehicle.wheelbase / 2, vehicle.wheelbase / 2]) {
      const p = localWorld(position, yaw, lx, 0, lz);
      const bottom = position.y + lx * slopeX + lz * slopeZ;
      const allowance = 0.12 * slopeExtent;
      if (this.volumeBlocked({ x: p.x - 0.12, y: bottom + 0.015 + allowance, z: p.z - 0.12 }, { x: p.x + 0.12, y: bottom + 0.8, z: p.z + 0.12 })) return true;
    }
    for (const other of this.vehicles) {
      if (other === vehicle || position.y + 1.93 <= other.position.y || position.y >= other.position.y + 1.93) continue;
      const axes = [yaw, yaw + Math.PI / 2, other.yaw, other.yaw + Math.PI / 2];
      const separated = axes.some(axis => {
        const ax = Math.cos(axis), az = -Math.sin(axis);
        const radius = (v, angle) => (v.halfWidth + 0.13) * Math.abs(Math.cos(angle - axis)) + (v.halfLength + 0.09) * Math.abs(Math.sin(angle - axis));
        return Math.abs((position.x - other.position.x) * ax + (position.z - other.position.z) * az) >= radius(vehicle, yaw) + radius(other, other.yaw);
      });
      if (!separated) return true;
    }
    return false;
  }

  /** Keep the rear axle on the ramp after the front axle has passed its edge. */
  vehicleRampContact(vehicle, x, z, yaw, step) {
    if (Math.abs(vehicle.pitch) < 0.12 || Math.abs(vehicle.speed) < 0.01) return null;
    const slopeZ = -Math.tan(vehicle.pitch), slopeX = Math.tan(vehicle.roll);
    const position = new THREE.Vector3(x, vehicle.position.y + vehicle.speed * slopeZ * step, z);
    for (const lz of [-vehicle.wheelbase / 2, 0, vehicle.wheelbase / 2]) {
      let contacts = 0;
      for (const lx of [-vehicle.halfWidth + 0.15, vehicle.halfWidth - 0.15]) {
        const point = localWorld(position, yaw, lx, lx * slopeX + lz * slopeZ, lz);
        if (this.groundAt(point.x, point.z, point.y, 0.06, 0.08) != null) contacts++;
      }
      if (contacts === 2 && !this.vehicleBlocked(vehicle, position, yaw)) return { y: position.y, pitch: -vehicle.pitch, roll: vehicle.roll };
    }
    return null;
  }

  vehicleImpact(vehicle) {
    if (Math.abs(vehicle.speed) > 2 && !vehicle.impactCooldown) {
      this.audio?.play?.('bump', vehicle.position);
      vehicle.impactCooldown = 0.6;
    }
    vehicle.speed = 0;
  }

  updateVehicle(dt, vehicle, keys = {}, playEngine = true) {
    dt = Math.min(0.05, Math.max(0, dt));
    const forward = keyDown(keys, 'KeyW', 'ArrowUp', 'w', 'W', 'forward');
    const reverse = keyDown(keys, 'KeyS', 'ArrowDown', 's', 'S', 'backward');
    const handbrake = keyDown(keys, 'Space', ' ', 'brake');
    const turn = Number(keyDown(keys, 'KeyA', 'ArrowLeft', 'a', 'A', 'left')) - Number(keyDown(keys, 'KeyD', 'ArrowRight', 'd', 'D', 'right'));
    const braking = handbrake || (forward && vehicle.speed < -0.25) || (reverse && vehicle.speed > 0.25);
    vehicle.impactCooldown = Math.max(0, vehicle.impactCooldown - dt);
    vehicle.steering = damp(vehicle.steering, turn * 0.5, 7, dt);
    if (vehicle.grounded && braking) {
      const brake = (handbrake ? 22 : 13) * dt;
      vehicle.speed = Math.sign(vehicle.speed) * Math.max(0, Math.abs(vehicle.speed) - brake);
    } else if (vehicle.grounded && forward) vehicle.speed = Math.min(vehicle.maxSpeed, vehicle.speed + (vehicle.type === 'pickup' ? 5.2 : 7.3) * dt);
    else if (vehicle.grounded && reverse) vehicle.speed = Math.max(-4.5, vehicle.speed - 4.2 * dt);
    else if (vehicle.grounded) {
      vehicle.speed *= Math.exp(-0.52 * dt);
      vehicle.speed = Math.sign(vehicle.speed) * Math.max(0, Math.abs(vehicle.speed) - dt * 0.7);
    } else vehicle.speed *= Math.exp(-0.015 * dt);
    if (Math.abs(vehicle.speed) < 0.025) vehicle.speed = 0;
    // Bound translation AND turning at the nose; falls need substeps as much as driving.
    const movement = Math.abs(vehicle.speed) + Math.abs(vehicle.verticalVelocity) + Math.abs(vehicle.speed / vehicle.wheelbase * Math.tan(vehicle.steering)) * vehicle.halfLength + 22 * dt;
    const substeps = Math.max(1, Math.ceil(movement * dt / 0.12));
    const step = dt / substeps;
    this.world.ensureAround?.(vehicle.position.x, vehicle.position.z, 1);
    for (let i = 0; i < substeps; i++) {
      const yaw = vehicle.yaw + (vehicle.grounded ? vehicle.speed / vehicle.wheelbase * Math.tan(vehicle.steering) * step : 0);
      const x = vehicle.position.x + Math.sin(yaw) * vehicle.speed * step;
      const z = vehicle.position.z + Math.cos(yaw) * vehicle.speed * step;
      const ground = vehicle.grounded ? this.vehicleTerrain(vehicle, x, z, yaw) || this.vehicleRampContact(vehicle, x, z, yaw, step) : null;
      const rise = ground ? (ground.y - vehicle.position.y) / Math.max(step, 1e-6) : -Infinity;
      // Suspension follows an existing slope, but cannot pull a moving car down at a crest.
      if (ground && ground.y >= vehicle.position.y - 0.12 && !(vehicle.verticalVelocity > 2 && rise < vehicle.verticalVelocity - 2.5)) {
        const previousPitch = vehicle.pitch, previousRoll = vehicle.roll;
        vehicle.pitch = -ground.pitch;
        vehicle.roll = ground.roll;
        if (this.vehicleBlocked(vehicle, new THREE.Vector3(x, ground.y, z), yaw, false)) {
          vehicle.pitch = previousPitch;
          vehicle.roll = previousRoll;
          this.vehicleImpact(vehicle);
          vehicle.verticalVelocity = 0;
          continue;
        }
        vehicle.position.set(x, ground.y, z);
        vehicle.yaw = yaw;
        vehicle.verticalVelocity = vehicle.speed * Math.tan(ground.pitch);
        vehicle.groundY = ground.y;
        continue;
      }

      vehicle.grounded = false;
      vehicle.verticalVelocity = Math.max(-55, vehicle.verticalVelocity - 22 * step);
      const vertical = vehicle.position.clone();
      vertical.y += vehicle.verticalVelocity * step;
      if (this.vehicleBlocked(vehicle, vertical)) {
        // A short binary sweep finds the first floor/ceiling contact without tunnelling.
        let free = vehicle.position.y, blocked = vertical.y;
        for (let n = 0; n < 8; n++) {
          const middle = (free + blocked) / 2;
          vertical.y = middle;
          if (this.vehicleBlocked(vehicle, vertical)) blocked = middle;
          else free = middle;
        }
        vehicle.position.y = free;
        vehicle.grounded = vehicle.verticalVelocity < 0;
        vehicle.verticalVelocity = 0;
        if (vehicle.grounded) {
          // Align a landing only when there is a complete, collision-free support plane.
          const landing = this.vehicleTerrain(vehicle, vehicle.position.x, vehicle.position.z, vehicle.yaw);
          if (landing && Math.abs(landing.y - vehicle.position.y) < vehicle.halfLength + 0.3) {
            const oldPitch = vehicle.pitch, oldRoll = vehicle.roll;
            vehicle.pitch = -landing.pitch;
            vehicle.roll = landing.roll;
            const settled = vehicle.position.clone();
            settled.y = landing.y;
            if (!this.vehicleBlocked(vehicle, settled)) vehicle.position.y = landing.y;
            else { vehicle.pitch = oldPitch; vehicle.roll = oldRoll; }
          }
          vehicle.groundY = vehicle.position.y;
        }
      } else vehicle.position.y = vertical.y;

      const horizontal = new THREE.Vector3(x, vehicle.position.y, z);
      if (this.vehicleBlocked(vehicle, horizontal, yaw)) this.vehicleImpact(vehicle);
      else {
        vehicle.position.x = x;
        vehicle.position.z = z;
        vehicle.yaw = yaw;
      }
    }
    for (const wheel of vehicle.wheels) {
      wheel.spin.rotation.x += vehicle.speed * dt / 0.4;
      wheel.pivot.rotation.y = wheel.front ? vehicle.steering : 0;
    }
    vehicle.steeringWheel.rotation.z = -vehicle.steering * 2;
    for (const lamp of vehicle.brakeLamps) lamp.material.emissiveIntensity = braking ? 1.4 : 0.13;
    this.syncVehicle(vehicle);
    if (playEngine) this.audio?.engine?.(Math.abs(vehicle.speed), vehicle.position);
  }

  syncVehicle(vehicle) {
    vehicle.mesh.position.copy(vehicle.position);
    vehicle.mesh.rotation.set(vehicle.pitch || 0, vehicle.yaw, vehicle.roll || 0, 'YXZ');
  }

  nearest(position, maxDistance = 4) {
    let nearest = null;
    let best = maxDistance;
    for (const [kind, list] of [['pet', this.pets], ['vehicle', this.vehicles]]) {
      for (const entity of list) {
        if (kind === 'pet' && entity.vehicleId) continue;
        const distance = position.distanceTo(entity.position);
        if (distance < best) {
          best = distance;
          nearest = { kind, entity, distance };
        }
      }
    }
    return nearest;
  }

  getVehicleSeat(vehicle) { return localWorld(vehicle.position, vehicle.yaw, -0.42, 1.45, vehicle.type === 'pickup' ? 0.45 : -0.05); }

  vehicleCamera(vehicle, internal = false) {
    const position = internal
      ? localWorld(vehicle.position, vehicle.yaw, -0.42, 1.66, vehicle.type === 'pickup' ? 0.46 : 0.05)
      : localWorld(vehicle.position, vehicle.yaw, 0, 4.4, -7.4);
    const target = localWorld(vehicle.position, vehicle.yaw, internal ? -0.42 : 0, internal ? 1.49 : 1.12, internal ? 8 : 1.5);
    if (!internal && this.world.raycast) {
      const anchor = localWorld(vehicle.position, vehicle.yaw, 0, 1.7, 0);
      const direction = position.clone().sub(anchor);
      const length = direction.length();
      direction.normalize();
      const hit = this.world.raycast(anchor, direction, length);
      if (hit && Number.isFinite(hit.distance)) position.copy(anchor).addScaledVector(direction, Math.max(0.35, hit.distance - 0.3));
    }
    return { position, target };
  }

  findExit(vehicle, avoidPosition = null, ignorePet = null) {
    if (!vehicle.grounded || Math.abs(vehicle.verticalVelocity) > 0.5 || Math.abs(vehicle.speed) > 0.25) return null;
    const offsets = [
      [-vehicle.halfWidth - 0.72, 0], [vehicle.halfWidth + 0.72, 0],
      [-vehicle.halfWidth - 0.72, -0.8], [vehicle.halfWidth + 0.72, -0.8],
      [0, -vehicle.halfLength - 0.85], [0, vehicle.halfLength + 0.85],
    ];
    for (const [x, z] of offsets) {
      const p = localWorld(vehicle.position, vehicle.yaw, x, 0, z);
      const safe = this.safeStand(p.x, p.z, vehicle.position.y, 1.85, 0.31, 1, 1.2);
      if (safe && avoidPosition && Math.abs(safe.y - avoidPosition.y) < 1.8 && Math.hypot(safe.x - avoidPosition.x, safe.z - avoidPosition.z) < 0.8) continue;
      if (safe && !this.vehicles.some(v => v !== vehicle && this.pointInsideVehicle(safe, v, 0.35)) && !this.pets.some(pet => pet!==ignorePet && !pet.vehicleId && pet.position.distanceTo(safe) < 0.8)) return safe;
    }
    return null;
  }

  updateLights(vehicle) {
    for (const light of vehicle.spots || []) light.intensity = vehicle.headlights ? 12 : 0;
    for (const lamp of vehicle.lamps) lamp.material.emissiveIntensity = vehicle.headlights ? 1.8 : 0.12;
  }

  toggleLights(vehicle) {
    vehicle.headlights = !vehicle.headlights;
    this.updateLights(vehicle);
    this.audio?.play?.('click', vehicle.position);
    return vehicle.headlights;
  }

  boardPet(pet,vehicle){
    pet.vehicleId=vehicle.id;vehicle.passenger=pet;pet.boardingVehicleId=null;
    pet.path.length=0;pet.goal=null;pet.jump=0;pet.mode='follow';
    this.audio?.play?.('door',vehicle.position);
    return `${pet.name} embarcou no veículo ${vehicle.name}.`;
  }

  whistle(vehicle,playerPosition){
    this.audio?.play?.('whistle',playerPosition);
    if(!vehicle)return 'Entre num carro ou aproxime-se de um carro com seu companheiro.';
    if(!vehicle.grounded||Math.abs(vehicle.verticalVelocity)>.5||Math.abs(vehicle.speed)>.25)return 'Pare o carro no chão para chamar ou desembarcar seu companheiro.';
    if(vehicle.passenger)return this.interactPet(vehicle.passenger,'unboard',playerPosition);
    const pet=this.pets.filter(p=>p.type==='dog'&&p.tamed&&!p.vehicleId&&petHealth(p.health)>0&&p.position.distanceTo(vehicle.position)<18)
      .sort((a,b)=>a.position.distanceToSquared(vehicle.position)-b.position.distanceToSquared(vehicle.position))[0];
    if(!pet)return 'Nenhum cachorro domesticado está por perto. Faça amizade oferecendo um biscoito.';
    const entry=this.findExit(vehicle,playerPosition,pet);
    if(!entry)return 'Estacione em um local aberto para o cachorro se aproximar.';
    pet.boardingVehicleId=vehicle.id;pet.mode='follow';pet.goal=entry;pet.path.length=0;pet.routeAge=2;
    return `${pet.name} ouviu seu assovio e está vindo para o carro.`;
  }

  interactPet(pet, action, playerPosition) {
    if (!pet || !this.pets.includes(pet)) return 'Companheiro não encontrado.';
    if(action==='feed')return feedPet(pet);
    if(petHealth(pet.health)===0&&!['pet','unboard'].includes(action))return `${pet.name} está ferido. Ofereça alimento para recuperá-lo.`;
    if (action === 'tame') {
      if (pet.tamed) return `${pet.name} já é seu companheiro.`;
      pet.tamed = true;
      pet.mode = 'follow';
      pet.collar.visible = true;
      pet.affection = 3;
      pet.path.length = 0;
      this.audio?.play?.(pet.type === 'cat' ? 'meow' : 'bark', pet.position);
      return `${pet.name} ganhou uma coleira e agora segue você!`;
    }
    if (action === 'pet') {
      pet.affection = 3;
      this.audio?.play?.(pet.type === 'cat' ? 'purr' : 'bark', pet.position);
      return pet.type === 'cat' ? `${pet.name} está ronronando. ♥` : `${pet.name} adorou o carinho! ♥`;
    }
    if (!pet.tamed) return 'Faça amizade primeiro para dar comandos.';
    if (action === 'follow' || action === 'stay') {
      if (pet.vehicleId) return 'Peça para seu companheiro descer primeiro.';
      pet.mode = action;
      pet.boardingVehicleId=null;
      pet.path.length = 0;
      pet.goal = null;
      return action === 'follow' ? `${pet.name} vai seguir você.` : `${pet.name} vai esperar aqui.`;
    }
    if (action === 'board') {
      if (pet.vehicleId) return `${pet.name} já está no carro.`;
      const vehicle = this.vehicles.filter(v => !v.passenger && v.grounded && Math.abs(v.verticalVelocity) < 0.5 && Math.abs(v.speed) < 0.25 && v.position.distanceTo(pet.position) < 5 && (!playerPosition || v.position.distanceTo(playerPosition) < 6)).sort((a, b) => a.position.distanceToSquared(pet.position) - b.position.distanceToSquared(pet.position))[0];
      if (!vehicle) return 'Aproxime seu companheiro de um carro parado com assento livre.';
      return this.boardPet(pet,vehicle);
    }
    if (action === 'unboard') {
      const vehicle = this.vehicles.find(v => v.id === pet.vehicleId);
      if (!vehicle) return `${pet.name} já está fora do carro.`;
      if (Math.abs(vehicle.speed) > 0.25) return 'Pare o veículo antes de desembarcar.';
      const exit = this.findExit(vehicle, playerPosition);
      if (!exit) return 'Não há espaço seguro para descer. Estacione em um local aberto.';
      vehicle.passenger = null;
      pet.vehicleId = null;
      pet.boardingVehicleId=null;pet.mode='follow';pet.goal=null;
      pet.position.copy(exit);
      pet.mesh.position.copy(exit);
      pet.mesh.scale.setScalar(1);
      pet.path.length = 0;
      pet.routeAge = 2;
      this.audio?.play?.('door', vehicle.position);
      return `${pet.name} desceu em segurança.`;
    }
    return '';
  }

  pointInsideVehicle(point, vehicle, margin = 0) {
    const dx = point.x - vehicle.position.x, dz = point.z - vehicle.position.z;
    const x = dx * Math.cos(vehicle.yaw) - dz * Math.sin(vehicle.yaw);
    const z = dx * Math.sin(vehicle.yaw) + dz * Math.cos(vehicle.yaw);
    return Math.abs(x) < vehicle.halfWidth + margin && Math.abs(z) < vehicle.halfLength + margin && point.y < vehicle.position.y + 2.1 && point.y + 1 > vehicle.position.y;
  }

  vehicleIntersectsBox(vehicle, min, max, margin = 0) {
    if (max.y <= vehicle.position.y + 0.12 || min.y >= vehicle.position.y + 2.05) return false;
    const dx = (min.x + max.x) / 2 - vehicle.position.x;
    const dz = (min.z + max.z) / 2 - vehicle.position.z;
    const halfX = (max.x - min.x) / 2, halfZ = (max.z - min.z) / 2;
    const c = Math.cos(vehicle.yaw), s = Math.sin(vehicle.yaw);
    for (const [ax, az] of [[1, 0], [0, 1], [c, -s], [s, c]]) {
      const vehicleRadius = (vehicle.halfWidth + margin) * Math.abs(ax * c - az * s) + (vehicle.halfLength + margin) * Math.abs(ax * s + az * c);
      const boxRadius = halfX * Math.abs(ax) + halfZ * Math.abs(az);
      if (Math.abs(dx * ax + dz * az) >= vehicleRadius + boxRadius) return false;
    }
    return true;
  }

  /** Validate the complete footprint before spending a vehicle item or creating meshes. */
  findVehiclePlacement(type, position, yaw = Math.PI, occupiedBox = null) {
    const pickup = type === 'pickup' || type === 'truck' || type === 'utility';
    const candidate = { position: vec(position), yaw, halfWidth: pickup ? 0.98 : 0.88, halfLength: pickup ? 1.85 : 1.52 };
    const floors = [];
    const width = candidate.halfWidth + 0.12, length = candidate.halfLength + 0.09;
    const nx = Math.ceil(width * 2 / 0.4), nz = Math.ceil(length * 2 / 0.4);
    for (let ix = 0; ix <= nx; ix++) for (let iz = 0; iz <= nz; iz++) {
      const point = localWorld(candidate.position, yaw, -width + width * 2 * ix / nx, 0, -length + length * 2 * iz / nz);
      const floor = this.groundAt(point.x, point.z, candidate.position.y, 0.35, 0.35);
      if (floor == null) return null;
      floors.push(floor);
    }
    if (Math.max(...floors) - Math.min(...floors) > 0.35) return null;
    candidate.position.y = Math.max(...floors);
    if (!this.vehicleTerrain(candidate, candidate.position.x, candidate.position.z, yaw)) return null;
    if (occupiedBox && this.vehicleIntersectsBox(candidate, occupiedBox.min, occupiedBox.max, 0.13)) return null;
    for (const pet of this.pets) {
      if (pet.vehicleId) continue;
      if (this.vehicleIntersectsBox(candidate, { x: pet.position.x - 0.35, y: pet.position.y, z: pet.position.z - 0.6 }, { x: pet.position.x + 0.35, y: pet.position.y + 1.2, z: pet.position.z + 0.6 }, 0.13)) return null;
    }
    return candidate.position;
  }

  petStand(x, z, y) {
    const point = this.safeStand(x, z, y, 1.17, 0.23, 1.05, 1.1);
    if (!point || this.petLavaAt(x, z, point.y) || this.vehicles.some(v => this.pointInsideVehicle(point, v, 0.23))) return null;
    return point;
  }

  petRadius(pet) { return pet.type === 'dog' ? 0.67 : 0.56; }

  petOverlap(pet, point) {
    let overlap = 0;
    for (const other of this.pets) {
      if (other === pet || other.vehicleId || Math.abs(point.y - other.position.y) >= 1.1) continue;
      overlap += Math.max(0, this.petRadius(pet) + this.petRadius(other) - Math.hypot(point.x - other.position.x, point.z - other.position.z));
    }
    return overlap;
  }

  petMove(pet, dx, dz) {
    const overlap = this.petOverlap(pet, pet.position);
    // Try the route first, then slide around a companion. Every candidate still
    // uses the terrain/vehicle checks, so separation cannot push through walls.
    for (const angle of [0, Math.PI / 3, -Math.PI / 3, Math.PI / 2, -Math.PI / 2]) {
      const x = pet.position.x + dx * Math.cos(angle) - dz * Math.sin(angle);
      const z = pet.position.z + dx * Math.sin(angle) + dz * Math.cos(angle);
      const point = this.petStep(x, z, pet.position.y);
      if (point && this.petOverlap(pet, point) <= Math.max(0, overlap - 0.001) + 1e-6) return point;
    }
    return null;
  }

  separatePets(dt, playerPosition) {
    const pets = this.pets.filter(p => !p.vehicleId && p.position.distanceToSquared(playerPosition) < 64 * 64);
    // Resolve old saves with overlapping animals gradually, including exact
    // coincidence. Seated passengers are intentionally excluded.
    for (let i = 0; i < pets.length; i++) for (let j = i + 1; j < pets.length; j++) {
      const a = pets[i], b = pets[j];
      if (Math.abs(a.position.y - b.position.y) >= 1.1) continue;
      let dx = a.position.x - b.position.x, dz = a.position.z - b.position.z;
      const distance = Math.hypot(dx, dz), overlap = this.petRadius(a) + this.petRadius(b) - distance;
      if (overlap <= 0.001) continue;
      if (distance < 0.001) { dx = 1; dz = 0; } else { dx /= distance; dz /= distance; }
      const amount = Math.min(overlap / 2 + 0.001, dt * 2);
      for (const [pet, sign] of [[a, 1], [b, -1]]) {
        const before = this.petOverlap(pet, pet.position);
        for (const angle of [0, Math.PI / 3, -Math.PI / 3, Math.PI / 2, -Math.PI / 2]) {
          const x = pet.position.x + sign * amount * (dx * Math.cos(angle) - dz * Math.sin(angle));
          const z = pet.position.z + sign * amount * (dx * Math.sin(angle) + dz * Math.cos(angle));
          const point = this.petStep(x, z, pet.position.y);
          if (!point || Math.abs(point.y - pet.position.y) > 0.1 || this.petOverlap(pet, point) >= before - 1e-6) continue;
          pet.position.copy(point);pet.mesh.position.copy(point);break;
        }
      }
    }
  }

  petLavaAt(x, z, y) {
    for (const dx of [-.23, .23]) for (const dz of [-.23, .23]) {
      for (let by = Math.floor(y + .02); by <= Math.floor(y + 1.13); by++) {
        if (this.world.getBlock(x + dx, by, z + dz) === BLOCK.LAVA) return true;
      }
    }
    return false;
  }

  petStep(x, z, y) {
    const heights = [];
    for (const dx of [-0.21, 0, 0.21]) for (const dz of [-0.21, 0, 0.21]) {
      const h = this.groundAt(x + dx, z + dz, y, 1.05, 1.1);
      if (h == null) return null;
      heights.push(h);
    }
    if (Math.max(...heights) - Math.min(...heights) > 1.05) return null;
    const high = Math.max(...heights);
    if (this.petLavaAt(x, z, high)) return null;
    if (this.volumeBlocked(new THREE.Vector3(x - 0.21, high + 0.04, z - 0.21), new THREE.Vector3(x + 0.21, high + 1.13, z + 0.21))) return null;
    const point = new THREE.Vector3(x, high, z);
    return this.vehicles.some(v => this.pointInsideVehicle(point, v, 0.21)) ? null : point;
  }

  findPetPath(pet, target) {
    const start = this.petStand(Math.floor(pet.position.x) + 0.5, Math.floor(pet.position.z) + 0.5, pet.position.y);
    if (!start) return [];
    const tx = Math.floor(target.x), tz = Math.floor(target.z);
    const key = p => `${Math.floor(p.x)},${Math.round(p.y * 4)},${Math.floor(p.z)}`;
    const heuristic = p => Math.abs(Math.floor(p.x) - tx) + Math.abs(Math.floor(p.z) - tz);
    const origin = { point: start, g: 0, f: heuristic(start), parent: null };
    const open = [origin], visited = new Map([[key(start), 0]]);
    let closest = origin, result = null, expanded = 0;
    while (open.length && expanded++ < 480) {
      let best = 0;
      for (let i = 1; i < open.length; i++) if (open[i].f < open[best].f) best = i;
      const node = open.splice(best, 1)[0];
      if (heuristic(node.point) < heuristic(closest.point)) closest = node;
      if (heuristic(node.point) <= (pet.boardingVehicleId?0:1) && Math.abs(node.point.y - target.y) <= 1.2) { result = node; break; }
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = node.point.x + dx, z = node.point.z + dz;
        if (Math.abs(x - start.x) > 28 || Math.abs(z - start.z) > 28) continue;
        const next = this.petStand(x, z, node.point.y);
        if (!next || this.petOverlap(pet, next) > 0.001) continue;
        const cost = node.g + 1 + Math.abs(next.y - node.point.y) * 0.65;
        const id = key(next);
        if ((visited.get(id) ?? Infinity) <= cost) continue;
        visited.set(id, cost);
        open.push({ point: next, g: cost, f: cost + heuristic(next), parent: node });
      }
    }
    result ||= closest;
    const path = [];
    while (result?.parent) { path.push(result.point); result = result.parent; }
    return path.reverse();
  }

  recoverPet(pet, playerPosition) {
    // Recovery only occurs when far away, so nearby obstacles cannot be bypassed.
    if (pet.position.distanceTo(playerPosition) < 28) return false;
    this.world.ensureAround?.(playerPosition.x, playerPosition.z, 1);
    for (let radius = 3; radius <= 6; radius++) for (let i = 0; i < 12; i++) {
      const angle = i * Math.PI / 6;
      const p = this.petStand(Math.floor(playerPosition.x + Math.cos(angle) * radius) + 0.5, Math.floor(playerPosition.z + Math.sin(angle) * radius) + 0.5, playerPosition.y);
      if (p && this.petOverlap(pet, p) < 0.001) {
        pet.position.copy(p);
        pet.path.length = 0;
        pet.stuck = 0;
        pet.routeAge = 2;
        return true;
      }
    }
    return false;
  }

  updatePet(dt, pet, playerPosition) {
    if(pet.boardingVehicleId){
      const vehicle=this.vehicles.find(v=>v.id===pet.boardingVehicleId);
      if(!vehicle||vehicle.passenger||!vehicle.grounded||Math.abs(vehicle.speed)>.25||Math.abs(vehicle.verticalVelocity)>.5||petHealth(pet.health)===0||pet.position.distanceTo(vehicle.position)>24){pet.boardingVehicleId=null;pet.goal=null;}
      else{
        const entry=this.findExit(vehicle,playerPosition,pet);
        if(!entry){pet.boardingVehicleId=null;pet.goal=null;}
        else if(pet.position.distanceTo(entry)<.85){this.boardPet(pet,vehicle);this.audio?.play?.('bark',vehicle.position);}
        else pet.goal=entry;
      }
    }
    if(petHealth(pet.health)===0&&!pet.vehicleId){pet.mode='stay';pet.goal=null;pet.path.length=0;pet.mesh.position.copy(pet.position);pet.mesh.rotation.z=.25;return;}
    pet.mesh.rotation.z=0;
    pet.affection = Math.max(0, pet.affection - dt);
    pet.soundTimer -= dt;
    pet.routeAge += dt;
    pet.moving = false;
    if (pet.vehicleId) {
      const vehicle = this.vehicles.find(v => v.id === pet.vehicleId);
      if (vehicle) {
        const p = localWorld(vehicle.position, vehicle.yaw, 0.43, 1.08, vehicle.type === 'pickup' ? 0.4 : -0.1);
        pet.position.copy(p);
        pet.yaw = vehicle.yaw;
        pet.mesh.scale.setScalar(0.61);
      } else pet.vehicleId = null;
    } else {
      pet.mesh.scale.setScalar(1);
      const distance = pet.position.distanceTo(playerPosition);
      if (pet.tamed && pet.mode === 'follow'&&!pet.boardingVehicleId&&!pet.pestGoal) pet.goal = distance > 2.3 ? playerPosition.clone() : null;
      else if (!pet.tamed) {
        pet.wanderTimer -= dt;
        if (pet.wanderTimer <= 0) {
          pet.wanderTimer = 5 + Math.random() * 6;
          const angle = Math.random() * Math.PI * 2, radius = 1 + Math.random() * 3;
          pet.goal = pet.home.clone().add(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
          pet.routeAge = 2;
        }
      }
      if (pet.goal && pet.mode !== 'stay') {
        if (pet.routeAge > 1.1) {
          pet.path = this.findPetPath(pet, pet.goal);
          pet.routeAge = 0;
        }
        const next = pet.path[0];
        if (next) {
          const dx = next.x - pet.position.x, dz = next.z - pet.position.z;
          const dist = Math.hypot(dx, dz);
          const speed = pet.tamed ? (distance > 9 ? 4.9 : 3.05) : 1.05;
          const amount = Math.min(dist, speed * dt);
          if (dist < 0.08) pet.path.shift();
          else {
            const nx = pet.position.x + dx / dist * amount, nz = pet.position.z + dz / dist * amount;
            // A high step is entered at its new floor height; retain a small hop for animation.
            const step = this.petMove(pet, nx - pet.position.x, nz - pet.position.z);
            if (step) {
              if (step.y - pet.position.y > 0.35) pet.jump = 0.32;
              const targetYaw = Math.atan2(step.x - pet.position.x, step.z - pet.position.z);
              pet.position.copy(step);
              const delta = Math.atan2(Math.sin(targetYaw - pet.yaw), Math.cos(targetYaw - pet.yaw));
              pet.yaw += delta * Math.min(1, dt * 10);
              pet.moving = true;
              pet.stuck = 0;
            } else {
              pet.path.length = 0;
              pet.routeAge = 1.15;
              pet.stuck += dt;
            }
          }
        } else {
          pet.stuck += dt;
          if (!pet.tamed) pet.goal = null;
        }
        if (pet.tamed && distance > 28 && pet.stuck > 7) this.recoverPet(pet, playerPosition);
      } else {
        pet.path.length = 0;
        pet.stuck = 0;
        if (pet.affection > 0 || distance < 5) {
          const wanted = Math.atan2(playerPosition.x - pet.position.x, playerPosition.z - pet.position.z);
          pet.yaw += Math.atan2(Math.sin(wanted - pet.yaw), Math.cos(wanted - pet.yaw)) * Math.min(1, dt * 3);
        }
      }
      // A removed support block invalidates routes and settles the pet safely.
      const support = this.petStep(pet.position.x, pet.position.z, pet.position.y);
      if (support && support.y < pet.position.y - 0.1) pet.position.y = Math.max(support.y, pet.position.y - dt * 5);
      else if (!support) {
        const floors = [];
        for (const dx of [-0.21, 0.21]) for (const dz of [-0.21, 0.21]) {
          const floor = this.groundAt(pet.position.x + dx, pet.position.z + dz, pet.position.y, 0.05, 16);
          if (floor != null) floors.push(floor);
        }
        const floor = floors.length ? Math.max(...floors) : null;
        if (floor != null && floor < pet.position.y - 0.1) {
          const y = Math.max(floor, pet.position.y - dt * 6);
          if (!this.volumeBlocked(new THREE.Vector3(pet.position.x - 0.21, y + 0.04, pet.position.z - 0.21), new THREE.Vector3(pet.position.x + 0.21, y + 1.13, pet.position.z + 0.21))) pet.position.y = y;
        }
      }
    }
    if (pet.soundTimer <= 0) {
      pet.soundTimer = 15 + Math.random() * 18;
      if (pet.position.distanceTo(playerPosition) < 10) this.audio?.play?.(pet.type === 'cat' ? 'meow' : 'bark', pet.position);
    }
    pet.jump = Math.max(0, pet.jump - dt);
    pet.gait += dt * (pet.moving ? 13 : 2);
    const sit = pet.mode === 'stay' || (pet.type === 'cat' && !pet.moving && !pet.vehicleId);
    for (const leg of pet.legs) leg.mesh.rotation.x = pet.moving ? Math.sin(pet.gait) * 0.55 * leg.phase : sit && leg.back ? -0.9 : 0;
    pet.bodyGroup.position.y = (pet.moving ? Math.abs(Math.sin(pet.gait)) * 0.035 : sit ? -0.075 : 0) + Math.sin(pet.jump / 0.32 * Math.PI) * 0.24;
    pet.tail.rotation.y = Math.sin(this.clock * (pet.affection > 0 ? 17 : 6)) * (pet.type === 'dog' ? pet.tamed ? 0.6 : 0.25 : 0.16);
    pet.tail.rotation.z = pet.type === 'cat' ? Math.sin(this.clock * 1.8) * 0.12 : 0;
    pet.head.rotation.x = pet.affection > 0 ? Math.sin(this.clock * 8) * 0.12 - 0.15 : Math.sin(this.clock * 1.6) * 0.035;
    pet.mesh.position.copy(pet.position);
    pet.mesh.rotation.set(0, pet.yaw, 0);
  }

  update(dt, playerPosition, keys = {}, activeVehicle = null) {
    dt = Math.min(0.05, Math.max(0, dt));
    this.clock += dt;
    if (this.world.revision !== this.lastRevision) {
      this.lastRevision = this.world.revision;
      for (const pet of this.pets) { pet.path.length = 0; pet.routeAge = 2; }
    }
    const active = typeof activeVehicle === 'string' ? this.vehicles.find(v => v.id === activeVehicle) : activeVehicle;
    for (const vehicle of this.vehicles) {
      if (vehicle === active) this.updateVehicle(dt, vehicle, keys);
      else this.updateVehicle(dt, vehicle, { Space: true }, false);
    }
    if (!active) this.audio?.engine?.(0);
    for (const pet of this.pets) {
      if (!pet.tamed && !pet.vehicleId && pet.position.distanceToSquared(playerPosition) > 64 * 64) continue;
      this.updatePet(dt, pet, playerPosition);
    }
    this.separatePets(dt, playerPosition);
  }

  blocksPlacement(x, y, z) {
    const center = new THREE.Vector3(x + 0.5, y, z + 0.5);
    if (this.vehicles.some(v => y + 1 > v.position.y && y < v.position.y + 2.05 && this.pointInsideVehicle(center, v, 0.71))) return true;
    return this.pets.some(p => !p.vehicleId && y + 1 > p.position.y && y < p.position.y + 1.2 && Math.abs(x + 0.5 - p.position.x) < 0.92 && Math.abs(z + 0.5 - p.position.z) < 1.08);
  }

  serialize() {
    return {
      vehicles: this.vehicles.map(v => ({ id: v.id, type: v.type, position: v.position.toArray(), yaw: v.yaw, speed: v.speed, verticalVelocity: v.verticalVelocity, grounded: v.grounded, pitch: v.pitch, roll: v.roll, steering: v.steering, headlights: v.headlights, trunk: { ...v.trunk } })),
      pets: this.pets.map(p => ({ health:petHealth(p.health), id: p.id, type: p.type, name: p.name, coatVariant: p.coatVariant, position: p.position.toArray(), yaw: p.yaw, tamed: p.tamed, mode: p.mode, guardAnchor:p.guardAnchor?.toArray()||null, vehicleId: p.vehicleId, carry:p.carry?{...p.carry}:null })),
    };
  }

  dispose() {
    for (const entity of [...this.vehicles, ...this.pets]) this.scene.remove(entity.mesh);
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials.values()) material.dispose();
    for (const vehicle of this.vehicles) for (const light of vehicle.spots || []) light.dispose?.();
    this.vehicles.length = 0;
    this.pets.length = 0;
    this.audio?.engine?.(0);
  }
}
