// Visual novo em teste (cena de teste): ligue com ?visual=novo na URL.
// Sombra de canto nos blocos, céu em degradê e luz quente de fim de tarde.
export const NEW_VISUAL = typeof location !== 'undefined' && new URLSearchParams(location.search).get('visual') === 'novo';
// Hora fixa para comparar (0 a 1; 0,3 manhã, 0,62 fim de tarde): ?hora=0.62
const hour = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('hora') : null;
export const TEST_TIME = hour != null && Number.isFinite(+hour) ? ((+hour % 1) + 1) % 1 : null;

/** Visual novo: "pixels" de tom sobre as peças dos personagens, como nas artes.
 *  Cada célula de 1/16 de bloco, no espaço local da peça (não nada ao andar),
 *  fica um pouco mais clara ou escura, em três tons, como pixel art. */
export function pixelate(material, cells = 16) {
  if (!NEW_VISUAL || material.userData.pixelated) return material;
  material.userData.pixelated = true;
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec3 vPix;\n' + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vPix = position * vec3(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz), length(modelMatrix[2].xyz));`);
    shader.fragmentShader = 'varying vec3 vPix;\n' + shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      {
        vec3 cell = floor(vPix * ${cells.toFixed(1)} + 0.001);
        float h = fract(sin(dot(cell, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        diffuseColor.rgb *= 0.87 + 0.13 * floor(h * 3.0);
      }`);
  };
  material.customProgramCacheKey = () => 'pixelate-' + cells;
  return material;
}
