import * as THREE from 'three';
import creatureModels from './assets/creature-models.json' with { type: 'json' };
import { NEW_VISUAL } from './visual.js';

// Bichos e pets modelados no Blender (assets/blender/create_creatures.py). Cada modelo tem
// um corpo fixo e peças com pivô (leg0..legN, head, tail) que o jogo anima. As geometrias
// são compartilhadas entre todos os bichos do mesmo tipo.
const material = new THREE.MeshLambertMaterial({ vertexColors: true });
// Peças que brilham (olhos, magma, fantasmas): sem luz nem sombra, continuam vivas à noite.
const glowMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });
const geometries = new Map();
function geometry(s) {
  if (geometries.has(s)) return geometries.get(s);
  const g = new THREE.BufferGeometry();
  // As cores vêm em sRGB (como no Blender); o Three espera cor por vértice linear.
  const linear = s.colors.map(c => THREE.MathUtils.clamp(c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4, 0, 1));
  for (const [n, v] of [['position', s.positions], ['normal', s.normals], ['color', linear]]) g.setAttribute(n, new THREE.Float32BufferAttribute(v, 3));
  g.computeBoundingSphere(); geometries.set(s, g); return g;
}
const mesh = s => {
  const m = new THREE.Mesh(geometry(s), material); m.castShadow = true; m.receiveShadow = true;
  if (s.glow) m.add(new THREE.Mesh(geometry(s.glow), glowMaterial));
  return m;
};

export const hasCreature = name => Object.hasOwn(creatureModels, name);

/** Monta a criatura dentro de `parent`; devolve { legs, head, tail } (grupos com pivô). */
export function buildCreature(name, parent) {
  // Visual novo: usa a versão "@novo" do bicho quando existe.
  const spec = (NEW_VISUAL && creatureModels[name + '@novo']) || creatureModels[name]; if (!spec) return null;
  parent.add(mesh(spec.body));
  const out = { legs: [], head: null, tail: null, arm: null };
  for (const p of spec.parts) {
    const group = new THREE.Group(); group.position.set(...p.pivot); group.add(mesh(p)); parent.add(group);
    if (p.name.startsWith('leg')) out.legs.push(group); else out[p.name] = group;
  }
  return out;
}
