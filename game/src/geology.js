import { BLOCK } from './blocks.js';

const REGION = 160;
function random(x, z, seed) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ seed;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/** Separate from the terrain version so existing worlds keep their biomes. */
export class Geology {
  constructor(world, state) {
    this.world = world;
    this.enabled = state?.version === 1;
    this.excluded = new Set(Array.isArray(state?.excluded) ? state.excluded.filter(k => typeof k === 'string') : []);
    // Only migrate once. Later mining must not suppress an entire natural pool.
    if (this.enabled && !Array.isArray(state.excluded)) {
      for (const edit of world.edits.values()) {
        const gx = Math.floor(edit.x / REGION), gz = Math.floor(edit.z / REGION);
        const pool = this.candidate(gx, gz);
        if (pool && Math.abs(edit.x - pool.x) <= 14 && Math.abs(edit.z - pool.z) <= 14) this.excluded.add(pool.key);
      }
    }
  }

  candidate(gx, gz) {
    const seed = this.world.seedHash;
    const starter = gx === 0 && gz === 0;
    if (!starter && random(gx, gz, seed + 701) < .38) return null;
    const x = starter ? 48 : gx * REGION + 36 + Math.floor(random(gx, gz, seed + 703) * 80);
    const z = starter ? 32 : gz * REGION + 36 + Math.floor(random(gx, gz, seed + 709) * 80);
    if (Math.abs(x - 3.5) < 35 || Math.hypot(x + 35, z - 18) < 30) return null;
    return { key: `${gx},${gz}`, x, z, y: this.world._column(x, z).height,
      rx: starter ? 5 : 4 + Math.floor(random(gx, gz, seed + 719) * 3),
      rz: starter ? 4 : 3 + Math.floor(random(gx, gz, seed + 727) * 3) };
  }

  poolsIn(minX, minZ, maxX, maxZ) {
    if (!this.enabled) return [];
    const pools = [];
    for (let gz = Math.floor(minZ / REGION); gz <= Math.floor(maxZ / REGION); gz++) {
      for (let gx = Math.floor(minX / REGION); gx <= Math.floor(maxX / REGION); gx++) {
        const p = this.candidate(gx, gz);
        if (p && !this.excluded.has(p.key) && p.x + 8 >= minX && p.x - 8 <= maxX && p.z + 8 >= minZ && p.z - 8 <= maxZ) pools.push(p);
      }
    }
    return pools;
  }

  mineral(x, y, z, id) {
    if (this.enabled && y > 1 && y < 8 && [BLOCK.STONE, BLOCK.ORE].includes(id) &&
      random(x + y * 173, z - y * 311, this.world.seedHash + 733) > .993) return BLOCK.DIAMOND;
    return id;
  }

  apply(put, baseX, baseZ, size) {
    for (const p of this.poolsIn(baseX, baseZ, baseX + size - 1, baseZ + size - 1)) {
      for (let z = Math.max(baseZ, p.z - 8); z <= Math.min(baseZ + size - 1, p.z + 8); z++) {
        for (let x = Math.max(baseX, p.x - 8); x <= Math.min(baseX + size - 1, p.x + 8); x++) {
          const radius = ((x - p.x) / p.rx) ** 2 + ((z - p.z) / p.rz) ** 2;
          if (radius > 1.65) continue;
          const inside = radius < 1;
          const diamond = !inside && ((Math.abs(x - p.x) === p.rx && z === p.z) || random(x, z, this.world.seedHash + 739) > .94);
          // A closed stone bowl, two blocks of lava, and a dry rim one block higher.
          for (let y = 1; y < 64; y++) {
            let id = y <= p.y ? BLOCK.STONE : BLOCK.AIR;
            if (inside && y >= p.y - 2) id = y < p.y ? BLOCK.LAVA : BLOCK.AIR;
            if (diamond && y === p.y) id = BLOCK.DIAMOND;
            if (inside && x === p.x && z === p.z && y === p.y - 3) id = BLOCK.DIAMOND;
            put(x, y, z, id);
          }
        }
      }
    }
  }

  serialize() { return { version: this.enabled ? 1 : 0, excluded: [...this.excluded] }; }
}
