import * as THREE from 'three';
import { realmAt, sertaoSkeletons } from './realms.js';
import skeletonModels from './assets/skeleton-models.json' with { type: 'json' };

// Ossadas de gado do Sertão, modeladas no Blender (assets/blender/create_skeleton.py).
// Um único InstancedMesh com só as ossadas perto do jogador, para pesar pouco no celular.
const RANGE = 56, REFRESH = 8;
const geometry = (() => { const s = skeletonModels.body, g = new THREE.BufferGeometry();
  for (const [n, v] of [['position', s.positions], ['normal', s.normals], ['color', s.colors]]) g.setAttribute(n, new THREE.Float32BufferAttribute(v, 3));
  g.computeBoundingSphere(); return g; })();

export class Skeletons {
  constructor(scene, getWorld) {
    this.scene = scene; this.getWorld = getWorld; this.spots = null; this.mesh = null; this.center = null;
  }
  update(player) {
    const inside = realmAt(player.x, player.z) === 'sertao';
    if (this.mesh) this.mesh.visible = inside;
    if (!inside || (this.center && Math.hypot(player.x - this.center.x, player.z - this.center.z) < REFRESH)) return;
    this.spots ??= sertaoSkeletons(this.getWorld().seedHash);
    if (!this.mesh) {
      this.mesh = new THREE.InstancedMesh(geometry, new THREE.MeshLambertMaterial({ vertexColors: true }), this.spots.length || 1);
      this.mesh.name = 'sertao-skeletons'; this.mesh.castShadow = true; this.mesh.receiveShadow = true; this.mesh.frustumCulled = false;
      this.scene.add(this.mesh);
    }
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
    let n = 0;
    for (const [x, y, z, yaw] of this.spots) {
      if (Math.abs(x - player.x) > RANGE || Math.abs(z - player.z) > RANGE) continue;
      m.compose(new THREE.Vector3(x, y, z), q.setFromAxisAngle(up, yaw), one); this.mesh.setMatrixAt(n++, m);
    }
    this.mesh.count = n; this.mesh.instanceMatrix.needsUpdate = true;
    this.center = { x: player.x, z: player.z };
  }
  dispose() { this.mesh?.removeFromParent(); this.mesh?.material.dispose(); this.mesh = null; }
}
