import * as THREE from 'three';
import models from './assets/domestic-models.json' with { type: 'json' };

/** Meshes authored in Blender; coordinates exported in Three.js Y-up space. */
export function domesticGeometry(kind) {
  const source = models[kind];
  const geometry = new THREE.BufferGeometry();
  for (const [name, values] of [['position', source.positions], ['normal', source.normals], ['color', source.colors]]) {
    geometry.setAttribute(name, new THREE.Float32BufferAttribute(values, 3));
  }
  geometry.computeBoundingSphere();
  return geometry;
}

/** Bake stations into the chunk to avoid a draw call per brick or per station. */
export function appendBarbecue(group, x, y, z) {
  const source = models.grill, offset = group.positions.length / 3;
  for (let i = 0; i < source.positions.length; i += 3) {
    group.positions.push(x + .5 + source.positions[i], y + source.positions[i + 1], z + .5 + source.positions[i + 2]);
    group.normals.push(source.normals[i], source.normals[i + 1], source.normals[i + 2]);
    group.colors.push(source.colors[i], source.colors[i + 1], source.colors[i + 2]);
    group.uvs.push(0, 0);
    group.indices.push(offset + i / 3);
  }
}
