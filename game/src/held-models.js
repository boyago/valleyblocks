import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Modelos feitos no Blender (src/assets/models/*.glb). Carregam uma vez em segundo plano;
// até chegarem, o avatar usa o modelo de blocos. O material "Metal" é recolorido por tipo.
const SOURCES = {
  pickaxe: new URL('./assets/models/pickaxe.glb', import.meta.url).href,
  scythe: new URL('./assets/models/scythe.glb', import.meta.url).href,
};
const cache = new Map(), listeners = new Set();
let started = false;

export function loadHeldModels() {
  if (started || typeof window === 'undefined') return;
  started = true;
  const loader = new GLTFLoader();
  for (const [key, url] of Object.entries(SOURCES)) {
    loader.load(url, gltf => {
      gltf.scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      cache.set(key, gltf.scene); for (const fn of listeners) fn(key);
    }, undefined, () => { /* sem o arquivo, segue o modelo de blocos */ });
  }
}
export function onHeldModel(fn) { listeners.add(fn); return () => listeners.delete(fn); }

/** Cópia pronta para a mão, com o metal na cor do material da ferramenta. */
export function heldModel(key, metalColor) {
  const source = cache.get(key); if (!source) return null;
  const copy = source.clone(true);
  copy.traverse(o => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const tinted = mats.map(m => {
      if (m.name !== 'Metal' || !metalColor) return m;
      const t = m.clone(); t.color = new THREE.Color(metalColor); t.metalness = .35; t.roughness = .45; return t;
    });
    o.material = Array.isArray(o.material) ? tinted : tinted[0];
  });
  return copy;
}
