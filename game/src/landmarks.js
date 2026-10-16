import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { REALMS, LIBERTY, CORCOVADO } from './realms.js';

// Monumentos modelados no Blender, postos no mundo sobre bases de blocos (src/assets/models).
const SPOTS = [
  { file: new URL('./assets/models/liberty.glb', import.meta.url).href, realm: 'nyc', offset: [LIBERTY[0] + .5, 19, LIBERTY[1] + .5], yaw: Math.PI, scale: 1 },
  // Topo do Corcovado na altura 52, mais 3 blocos de pedestal; olhando para a praia.
  { file: new URL('./assets/models/cristo.glb', import.meta.url).href, realm: 'rio', offset: [CORCOVADO[0] + .5, 56, CORCOVADO[1] + .5], yaw: 0, scale: 1 },
];

export class Landmarks {
  constructor(scene) {
    this.scene = scene; this.objects = []; this.disposed = false;
    if (typeof window === 'undefined') return;
    const loader = new GLTFLoader();
    for (const spot of SPOTS) {
      const [cx, cz] = REALMS[spot.realm].center;
      loader.load(spot.file, gltf => {
        if (this.disposed) return;
        const o = gltf.scene; o.position.set(cx + spot.offset[0], spot.offset[1], cz + spot.offset[2]); o.rotation.y = spot.yaw; o.scale.setScalar(spot.scale);
        o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; if (m.material?.metalness > .3) m.material.metalness = .3; } }); // sem mapa de reflexo, metal alto fica escuro
        this.scene.add(o); this.objects.push(o);
      }, undefined, () => { /* sem o modelo, fica só o pedestal */ });
    }
  }
  dispose() { this.disposed = true; for (const o of this.objects) o.removeFromParent(); this.objects = []; }
}
