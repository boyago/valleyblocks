import * as THREE from 'three';
import { BLOCK } from './blocks.js';

// Peixes e pescaria. Cardumes decorativos nadam na água perto do jogador; a vara lança
// uma boia na água, o peixe fisga depois de alguns segundos e o jogador puxa a tempo.
export const FISH = Object.freeze({
  lambari: { name: 'Lambari', color: '#c9d3d6', fin: '#e7c45a', size: .5, weight: 40 },
  tilapia: { name: 'Tilápia', color: '#8f9a8c', fin: '#c66b5a', size: .7, weight: 28 },
  tucunare: { name: 'Tucunaré', color: '#b9b04a', fin: '#d4572f', size: .8, weight: 16 },
  dourado: { name: 'Dourado', color: '#e3a92c', fin: '#c4401f', size: .9, weight: 12 },
  pirarucu: { name: 'Pirarucu', color: '#5c6a5a', fin: '#b2302a', size: 1.4, weight: 4 },
});
const BITE_WINDOW = 1.3, MAX_FISH = 8, CAST_RANGE = 14;

/** Sorteio ponderado; dourado é mais comum nos rios da Tríplice Fronteira. */
export function rollFish(random, biome = '') {
  const entries = Object.entries(FISH).map(([id, f]) => [id, f.weight * (biome === 'triplice' && id === 'dourado' ? 3 : 1)]);
  let r = random() * entries.reduce((n, [, w]) => n + w, 0);
  for (const [id, w] of entries) { if ((r -= w) < 0) return id; }
  return 'lambari';
}

export class Fishing {
  constructor(scene, world, random = Math.random) {
    this.scene = scene; this.world = world; this.random = random;
    this.bobber = null; this.state = 'idle'; this.timer = 0; this.fish = []; this.spawnTimer = 0;
    this.geometry = new THREE.BoxGeometry(1, 1, 1); this.materials = new Map();
  }
  material(color) { if (!this.materials.has(color)) this.materials.set(color, new THREE.MeshLambertMaterial({ color })); return this.materials.get(color); }
  box(parent, size, pos, color) { const m = new THREE.Mesh(this.geometry, this.material(color)); m.scale.set(...size); m.position.set(...pos); parent.add(m); return m; }
  get active() { return this.state !== 'idle'; }

  /** Botão direito com a vara: lança, ou puxa se já houver uma boia na água. */
  use(player, inventory, biome) {
    if (this.active) return this.reel(inventory, biome);
    const hit = this.world.raycast(player.eye, player.direction, CAST_RANGE, true);
    if (!hit || hit.id !== BLOCK.WATER) return { ok: false, message: 'Mire na água para lançar a linha.' };
    const g = new THREE.Group(); g.name = 'fishing-bobber';
    this.box(g, [.16, .1, .16], [0, .02, 0], '#f4f1e8'); this.box(g, [.16, .1, .16], [0, .12, 0], '#d9342b'); this.box(g, [.03, .12, .03], [0, .22, 0], '#2e3439');
    g.position.set(hit.x + .5, hit.y + .92, hit.z + .5); this.scene.add(g);
    this.bobber = g; this.base = g.position.y; this.state = 'waiting'; this.timer = 3 + this.random() * 6; this.clock = 0;
    return { ok: true, message: 'Linha na água. Espere a boia afundar e clique com o botão direito para puxar.' };
  }
  reel(inventory, biome) {
    const bit = this.state === 'bite'; this.stop();
    if (!bit) return { ok: false, message: 'Puxou cedo demais. Lance de novo e espere a boia afundar.' };
    const id = rollFish(this.random, biome), item = `raw_${id}`;
    if (!inventory.add(item)) return { ok: false, message: 'A mochila está cheia.' };
    return { ok: true, caught: id, message: `Você pescou um ${FISH[id].name}!${id === 'pirarucu' ? ' Um gigante dos rios!' : ''}` };
  }
  stop() { this.bobber?.removeFromParent(); this.bobber = null; this.state = 'idle'; }

  /** Avança a boia e os cardumes; devolve 'bite' quando o peixe fisga e 'escaped' quando escapa. */
  update(dt, player) {
    let event = null;
    if (this.bobber) {
      this.clock += dt; this.timer -= dt;
      if (this.bobber.position.distanceTo(player.position) > CAST_RANGE + 6) { this.stop(); event = 'escaped'; }
      else if (this.state === 'waiting') { this.bobber.position.y = this.base + Math.sin(this.clock * 2.4) * .03; if (this.timer <= 0) { this.state = 'bite'; this.timer = BITE_WINDOW; event = 'bite'; } }
      else if (this.state === 'bite') { this.bobber.position.y = this.base - .18 + Math.sin(this.clock * 22) * .05; if (this.timer <= 0) { this.state = 'waiting'; this.timer = 3 + this.random() * 5; event = 'escaped'; } }
    }
    this.updateSchools(dt, player.position);
    return event;
  }

  waterCell(x, z) {
    for (let y = 9; y >= 3; y--) if (this.world.getBlock(x, y, z) === BLOCK.WATER && this.world.getBlock(x, y - 1, z) === BLOCK.WATER) return y - 1;
    return null;
  }
  spawnFish(center) {
    for (let i = 0; i < 10; i++) {
      const x = Math.floor(center.x + (this.random() - .5) * 40), z = Math.floor(center.z + (this.random() - .5) * 40), y = this.waterCell(x, z);
      if (y === null) continue;
      const id = rollFish(this.random), f = FISH[id], g = new THREE.Group(); g.name = `fish:${id}`;
      const s = f.size;
      this.box(g, [.16 * s, .2 * s, .5 * s], [0, 0, 0], f.color); this.box(g, [.17 * s, .07 * s, .3 * s], [0, -.06 * s, .02], '#e9ece4');
      this.box(g, [.04 * s, .12 * s, .2 * s], [0, .14 * s, -.02], f.fin); const tail = this.box(g, [.04 * s, .22 * s, .12 * s], [0, 0, -.3 * s], f.fin);
      for (const side of [-1, 1]) this.box(g, [.02, .04 * s, .04 * s], [side * .085 * s, .03 * s, .19 * s], '#1d2124');
      g.position.set(x + .5, y + .5, z + .5); this.scene.add(g);
      this.fish.push({ mesh: g, tail, target: g.position.clone(), clock: this.random() * 10, speed: .6 + this.random() * .6 });
      return true;
    }
    return false;
  }
  updateSchools(dt, center) {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 2.5;
      for (const f of [...this.fish]) if (f.mesh.position.distanceTo(center) > 48) { f.mesh.removeFromParent(); this.fish.splice(this.fish.indexOf(f), 1); }
      if (this.fish.length < MAX_FISH) this.spawnFish(center);
    }
    for (const f of this.fish) {
      f.clock += dt; f.tail.rotation.y = Math.sin(f.clock * 9) * .5;
      const p = f.mesh.position, d = f.target.clone().sub(p);
      if (d.length() < .3) {
        const x = Math.floor(p.x + (this.random() - .5) * 6), z = Math.floor(p.z + (this.random() - .5) * 6), y = this.waterCell(x, z);
        if (y !== null) f.target.set(x + .5, y + .3 + this.random() * .6, z + .5);
        continue;
      }
      d.normalize(); p.addScaledVector(d, Math.min(f.speed * dt, p.distanceTo(f.target)));
      f.mesh.rotation.y = Math.atan2(d.x, d.z);
    }
  }
  dispose() { this.stop(); for (const f of this.fish) f.mesh.removeFromParent(); this.fish = []; this.geometry.dispose(); for (const m of this.materials.values()) m.dispose(); }
}
