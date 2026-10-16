import * as THREE from 'three';
import { BLOCK, BLOCKS } from './blocks.js';

// Barco de alumínio e carretinha de carro. O barco só existe na água e ao ar livre;
// a carretinha engata no carro mais próximo e o segue pela barra de reboque.
const forward = yaw => new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
const finite = (v, d) => Number.isFinite(v) ? v : d;

class Builder {
  constructor() { this.geometry = new THREE.BoxGeometry(1, 1, 1); this.materials = new Map(); }
  mat(color) { if (!this.materials.has(color)) this.materials.set(color, new THREE.MeshLambertMaterial({ color })); return this.materials.get(color); }
  box(parent, size, pos, color) { const m = new THREE.Mesh(this.geometry, this.mat(color)); m.scale.set(...size); m.position.set(...pos); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; }
  dispose() { this.geometry.dispose(); for (const m of this.materials.values()) m.dispose(); }
}

export class Boats {
  constructor(scene, world, saved = []) {
    this.scene = scene; this.world = world; this.boats = []; this.parts = new Builder(); this.serial = 0;
    for (const b of Array.isArray(saved) ? saved.slice(0, 8) : []) if ([b?.x, b?.y, b?.z].every(Number.isFinite)) this.spawn(new THREE.Vector3(b.x, b.y, b.z), finite(b.yaw, 0));
  }
  isWater(x, y, z) { return this.world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)) === BLOCK.WATER; }
  /** Ao ar livre: nenhum bloco sólido nas 12 camadas acima da água. */
  openSky(x, y, z) { for (let h = 1; h <= 12; h++) { const id = this.world.getBlock(Math.floor(x), Math.floor(y) + h, Math.floor(z)); if (BLOCKS[id]?.solid) return false; } return true; }
  /** Botão direito com o barco: só na superfície da água, fora de casa. */
  place(hit, yaw) {
    if (!hit || hit.id !== BLOCK.WATER) return { ok: false, message: 'O barco só pode ser colocado na água.' };
    let y = hit.y; while (this.isWater(hit.x, y + 1, hit.z)) y++;
    const x = hit.x + .5, z = hit.z + .5;
    if (!this.openSky(x, y, z)) return { ok: false, message: 'O barco fica sempre do lado de fora: coloque em água ao ar livre.' };
    let room = 0; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (this.isWater(x + dx * 1.5, y, z + dz * 1.5)) room++;
    if (room < 2) return { ok: false, message: 'Precisa de mais água em volta para o barco.' };
    if (this.boats.length >= 8) return { ok: false, message: 'Este mundo já tem 8 barcos.' };
    this.spawn(new THREE.Vector3(x, y + .92, z), yaw);
    return { ok: true, message: 'Barco na água! Aproxime-se e pressione E para embarcar.' };
  }
  spawn(position, yaw = 0) {
    const g = new THREE.Group(), p = this.parts, hull = '#b9c2c9', dark = '#7f8a92';
    p.box(g, [1.3, .12, 2.6], [0, .05, 0], dark);
    for (const s of [-1, 1]) { p.box(g, [.12, .42, 2.5], [s * .66, .26, 0], hull); p.box(g, [.14, .06, 2.5], [s * .66, .49, 0], '#dfe6ea'); }
    p.box(g, [1.2, .42, .12], [0, .26, -1.25], hull);
    for (let i = 0; i < 3; i++) p.box(g, [1.0 - i * .25, .4 - i * .08, .25], [0, .24 + i * .02, 1.25 + i * .2], hull); // proa afinando
    for (const z of [-.5, .55]) p.box(g, [1.2, .07, .35], [0, .32, z], '#a46f3c');
    p.box(g, [.3, .5, .34], [0, .6, -1.45], '#2e3439'); p.box(g, [.22, .26, .26], [0, .9, -1.45], '#d9342b'); p.box(g, [.06, .55, .06], [0, .1, -1.55], '#2e3439');
    g.position.copy(position); g.rotation.y = yaw; this.scene.add(g);
    const boat = { id: `boat-${++this.serial}`, mesh: g, position: position.clone(), yaw, speed: 0, clock: 0 };
    this.boats.push(boat); return boat;
  }
  nearest(position, max = 3) { let best = null; for (const b of this.boats) { const d = b.position.distanceTo(position); if (d < max && (!best || d < best.d)) best = { boat: b, d }; } return best?.boat || null; }
  /** Pilotar: W/S aceleram, A/D viram; o barco só avança onde há água. */
  drive(boat, dt, keys) {
    const fwd = keys.has('KeyW') ? 1 : 0, back = keys.has('KeyS') ? 1 : 0, turn = (keys.has('KeyA') ? 1 : 0) - (keys.has('KeyD') ? 1 : 0);
    boat.speed += (fwd * 5 - back * 3) * dt; boat.speed *= Math.exp(-1.1 * dt); boat.speed = Math.max(-2.5, Math.min(7, boat.speed));
    boat.yaw += turn * dt * (1 + Math.abs(boat.speed) * .25);
    const next = boat.position.clone().addScaledVector(forward(boat.yaw), boat.speed * dt), nose = next.clone().addScaledVector(forward(boat.yaw), Math.sign(boat.speed || 1) * 1.3);
    const waterY = boat.position.y - .92;
    if (this.isWater(next.x, waterY, next.z) && this.isWater(nose.x, waterY, nose.z)) boat.position.copy(next); else boat.speed *= -.2;
  }
  update(dt) {
    for (const b of this.boats) {
      b.clock += dt;
      b.mesh.position.set(b.position.x, b.position.y + Math.sin(b.clock * 1.8) * .04, b.position.z);
      b.mesh.rotation.set(Math.sin(b.clock * 1.3) * .02, b.yaw, Math.sin(b.clock * 1.1) * .03);
    }
  }
  seat(boat) { return boat.position.clone().addScaledVector(forward(boat.yaw), -.3).add(new THREE.Vector3(0, .05, 0)); }
  /** Desembarque: primeiro pedaço de chão firme ao lado do barco. */
  landing(boat, standable) {
    for (const r of [1.6, 2.4, 3.2]) for (let a = 0; a < 8; a++) {
      const yaw = boat.yaw + Math.PI / 2 + a * Math.PI / 4, p = boat.position.clone().addScaledVector(forward(yaw), r);
      const spot = standable(p.x, p.z, boat.position.y); if (spot) return spot;
    }
    return null;
  }
  remove(boat) { boat.mesh.removeFromParent(); this.boats.splice(this.boats.indexOf(boat), 1); }
  serialize() { return this.boats.map(b => ({ x: b.position.x, y: b.position.y, z: b.position.z, yaw: b.yaw })); }
  dispose() { for (const b of [...this.boats]) this.remove(b); this.parts.dispose(); }
}

export class Trailers {
  constructor(scene, world, entities, saved = []) {
    this.scene = scene; this.world = world; this.entities = entities; this.trailers = []; this.parts = new Builder(); this.serial = 0;
    for (const t of Array.isArray(saved) ? saved.slice(0, 8) : []) if ([t?.x, t?.y, t?.z].every(Number.isFinite)) this.spawn(new THREE.Vector3(t.x, t.y, t.z), finite(t.yaw, 0), t.cargo, t.carId);
  }
  spawn(position, yaw = 0, cargo = {}, carId = null) {
    const g = new THREE.Group(), p = this.parts, paint = '#3d6fa5';
    p.box(g, [1.5, .12, 2.2], [0, .55, 0], '#55606a');
    for (const s of [-1, 1]) p.box(g, [.1, .38, 2.2], [s * .75, .8, 0], paint);
    p.box(g, [1.5, .38, .1], [0, .8, -1.1], paint); p.box(g, [1.5, .38, .1], [0, .8, 1.1], paint);
    p.box(g, [.08, .08, 1.3], [0, .5, 1.75], '#2e3439'); p.box(g, [.16, .12, .16], [0, .5, 2.4], '#55606a'); // barra de reboque
    for (const s of [-1, 1]) { p.box(g, [.22, .62, .62], [s * .86, .31, 0], '#253031'); p.box(g, [.24, .3, .3], [s * .86, .31, 0], '#dfd8bc'); p.box(g, [.3, .06, .9], [s * .86, .68, 0], '#2e3439'); }
    for (const s of [-1, 1]) p.box(g, [.14, .1, .05], [s * .6, .7, -1.16], '#c74b3d');
    g.position.copy(position); g.rotation.y = yaw; this.scene.add(g);
    const t = { id: `trailer-${++this.serial}`, mesh: g, position: position.clone(), yaw, cargo: cargo && typeof cargo === 'object' ? { ...cargo } : {}, carId };
    this.trailers.push(t); return t;
  }
  hitchPoint(car) { return car.position.clone().addScaledVector(forward(car.yaw), -(car.halfLength + .25)); }
  /** Coloca a carretinha atrás do carro mais próximo (até 10 blocos), já engatada. */
  place(near) {
    const car = this.entities.vehicles.filter(v => v.position.distanceTo(near) < 10).sort((a, b) => a.position.distanceTo(near) - b.position.distanceTo(near))[0];
    if (!car) return { ok: false, message: 'Coloque a carretinha perto de um carro para engatar.' };
    if (this.trailers.some(t => t.carId === car.id)) return { ok: false, message: 'Este carro já está com uma carretinha.' };
    const hitch = this.hitchPoint(car), pos = hitch.clone().addScaledVector(forward(car.yaw), -2.4);
    this.spawn(pos, car.yaw, {}, car.id); this.update(0);
    return { ok: true, message: 'Carretinha engatada! Ela segue o carro. Pressione E perto dela para usar a caçamba.' };
  }
  update() {
    for (const t of this.trailers) {
      let car = this.entities.vehicles.find(v => v.id === t.carId);
      if (!car && t.carId) { car = this.entities.vehicles.find(v => v.position.distanceTo(t.position) < 5 && !this.trailers.some(o => o !== t && o.carId === v.id)); if (car) t.carId = car.id; } // reengata depois de carregar o mundo
      if (car) {
        // A barra puxa: a carretinha gira para apontar para o engate e fica 2,4 atrás dele.
        const hitch = this.hitchPoint(car), dir = hitch.clone().sub(t.position).setY(0);
        if (dir.lengthSq() > 1e-4) t.yaw = Math.atan2(dir.x, dir.z);
        t.position.copy(hitch).addScaledVector(forward(t.yaw), -2.4);
        const ground = this.world.heightAt(t.position.x, t.position.z, car.position.y + 1.5);
        t.position.y = ground ?? car.position.y;
      }
      t.mesh.position.copy(t.position); t.mesh.rotation.set(0, t.yaw, 0);
    }
  }
  nearest(position, max = 2.6) { return this.trailers.find(t => t.position.distanceTo(position) < max) || null; }
  serialize() { return this.trailers.map(t => ({ x: t.position.x, y: t.position.y, z: t.position.z, yaw: t.yaw, cargo: { ...t.cargo }, carId: t.carId })); }
  dispose() { for (const t of this.trailers) t.mesh.removeFromParent(); this.trailers = []; this.parts.dispose(); }
}
