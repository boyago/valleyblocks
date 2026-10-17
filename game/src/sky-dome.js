import * as THREE from 'three';

// Céu em degradê do visual novo: azul em cima, claro e quente no horizonte e um
// halo em volta do sol. Fica sempre centrado no jogador e não entra na neblina.
export function createSkyDome() {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, glow: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 glow; uniform vec3 sunDir; varying vec3 vDir;
      void main(){
        float h = clamp(vDir.y, -0.2, 1.0);
        vec3 col = mix(horizon, top, pow(max(h, 0.0), 0.55));
        float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
        col += glow * (pow(s, 6.0) * 0.45 + pow(s, 64.0) * 0.9);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(280, 32, 16), material);
  mesh.renderOrder = -1; mesh.frustumCulled = false;
  return mesh;
}
