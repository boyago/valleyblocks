import * as THREE from 'three';
import { BLOCK } from './blocks.js';
import { createAtlas, tileOf } from './world.js';

// Ícones "de verdade": blocos como cubos isométricos com as texturas do jogo e itens
// como uma foto do mesmo modelo 3D da mão. Só no navegador; nos testes devolve null.
const SIZE = 96, cache = new Map();
const browser = () => typeof document !== 'undefined' && typeof window !== 'undefined';

let atlasCanvas = null;
function atlas() {
  if (atlasCanvas) return atlasCanvas;
  const tex = createAtlas(), { data, width, height } = tex.image;
  atlasCanvas = document.createElement('canvas'); atlasCanvas.width = width; atlasCanvas.height = height;
  const ctx = atlasCanvas.getContext('2d'), img = ctx.createImageData(width, height);
  // A textura do jogo tem a linha 0 embaixo; no canvas ela fica em cima.
  for (let y = 0; y < height; y++) img.data.set(data.subarray((height - 1 - y) * width * 4, (height - y) * width * 4), y * width * 4);
  ctx.putImageData(img, 0, 0); tex.dispose();
  return atlasCanvas;
}
const tileRect = tile => { const cols = 8, rows = atlas().height / 16; return [(tile % cols) * 16, (rows - 1 - Math.floor(tile / cols)) * 16]; };
function faceTiles(id) {
  if (id === BLOCK.GRASS) return { top: 32, side: BLOCK.GRASS };
  if (id === BLOCK.WOOD) return { top: 33, side: BLOCK.WOOD };
  if (id === BLOCK.WORKBENCH) return { top: 35, side: BLOCK.WORKBENCH };
  return { top: tileOf(id), side: tileOf(id) };
}

/** Cubo isométrico: topo, face esquerda e face direita com sombra, como num bloco de verdade. */
export function blockIcon(id) {
  if (!browser()) return null;
  const key = 'b' + id; if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas'); c.width = c.height = SIZE; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  const { top, side } = faceTiles(id), src = atlas(), k = SIZE / 64;
  const face = (tile, a, b, cc, d, e, f, shade) => {
    const [sx, sy] = tileRect(tile);
    g.setTransform(a * k / 16, b * k / 16, cc * k / 16, d * k / 16, e * k, f * k);
    g.drawImage(src, sx, sy, 16, 16, 0, 0, 16, 16);
    if (shade) { g.fillStyle = `rgba(20,24,30,${shade})`; g.fillRect(0, 0, 16, 16); }
  };
  face(top, 28, 14, -28, 14, 32, 4, 0);       // topo
  face(side, 28, 14, 0, 30, 4, 18, .18);      // esquerda
  face(side, 28, -14, 0, 30, 32, 32, .36);    // direita
  g.setTransform(1, 0, 0, 1, 0, 0);
  const url = c.toDataURL(); cache.set(key, url); return url;
}

let renderer = null, avatar = null;
/** Foto do modelo da mão (avatar.tool), de lado e um pouco inclinado. */
export function modelIcon(id, makeAvatar) {
  if (!browser()) return null;
  const key = 'm' + id; if (cache.has(key)) return cache.get(key);
  try {
    renderer ??= new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(SIZE, SIZE, false); renderer.setClearColor(0x000000, 0);
    avatar ??= makeAvatar();
  } catch { return null; }
  const scene = new THREE.Scene(), group = avatar.tool(id);
  scene.add(new THREE.AmbientLight(0xffffff, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(2, 3, 4); scene.add(sun);
  if (group.userData.iconRotation) { group.rotation.set(...group.userData.iconRotation); group.position.set(0, 0, 0); group.rotation.z += -.25; }
  else { group.rotation.z += -.55; group.rotation.x += .25; }
  scene.add(group);
  const box = new THREE.Box3().setFromObject(group), center = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
  const half = Math.max(size.x, size.y) * .5 || .3;
  const camera = new THREE.OrthographicCamera(-half, half, half, -half, .1, 20);
  camera.position.set(center.x, center.y, center.z + 5); camera.lookAt(center);
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL(); cache.set(key, url);
  group.removeFromParent(); return url;
}
export function clearModelIcons() { for (const k of [...cache.keys()]) if (k.startsWith('m')) cache.delete(k); }

/** Retrato do personagem com a roupa escolhida, de frente e um pouco de lado. */
export function avatarIcon(outfit, makeAvatar) {
  if (!browser()) return null;
  const key = 'a' + outfit; if (cache.has(key)) return cache.get(key);
  try {
    renderer ??= new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(SIZE, SIZE, false); renderer.setClearColor(0x000000, 0);
    avatar ??= makeAvatar();
  } catch { return null; }
  avatar.setOutfit(outfit);
  const scene = new THREE.Scene(), body = avatar.body, visible = body.visible;
  scene.add(new THREE.AmbientLight(0xffffff, 1.5));
  const sun = new THREE.DirectionalLight(0xffffff, 2.4); sun.position.set(-2, 3, -4); scene.add(sun);
  scene.add(body); body.visible = true; body.rotation.set(0, -.45, 0); body.position.set(0, 0, 0);
  const camera = new THREE.OrthographicCamera(-.62, .62, 1.12, -1.12, .1, 20);
  camera.position.set(0, 1.02, -5); camera.lookAt(0, 1.02, 0);
  renderer.setSize(SIZE, SIZE * 1.8, false); renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL(); cache.set(key, url);
  renderer.setSize(SIZE, SIZE, false); body.rotation.set(0, 0, 0); body.visible = visible; body.removeFromParent();
  return url;
}
