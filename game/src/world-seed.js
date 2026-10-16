/** Blank input creates a fresh world; a typed seed deliberately reproduces terrain. */
export function newWorldSeed(input = '') {
  return String(input).trim() || `vale-${globalThis.crypto.randomUUID()}`;
}
