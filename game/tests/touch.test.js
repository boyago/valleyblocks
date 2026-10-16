import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stickToKeys, touchPreferred } from '../src/touch.js';

const keys = (x, y) => [...stickToKeys(x, y)].sort();

test('joystick: zona morta não gera teclas', () => {
  assert.deepEqual(keys(0, 0), []);
  assert.deepEqual(keys(.2, -.2), []);
});

test('joystick: eixos viram WASD', () => {
  assert.deepEqual(keys(0, -.6), ['KeyW']);
  assert.deepEqual(keys(0, .6), ['KeyS']);
  assert.deepEqual(keys(-.6, 0), ['KeyA']);
  assert.deepEqual(keys(.6, 0), ['KeyD']);
});

test('joystick: diagonais combinam duas teclas', () => {
  assert.deepEqual(keys(.5, -.5), ['KeyD', 'KeyW']);
  assert.deepEqual(keys(-.5, .5), ['KeyA', 'KeyS']);
});

test('joystick: empurrar até a borda para frente corre; para trás não', () => {
  assert.deepEqual(keys(0, -1), ['KeyW', 'ShiftLeft']);
  assert.deepEqual(keys(0, 1), ['KeyS']);
  assert.deepEqual(keys(0, -.8), ['KeyW']);
});

test('touchPreferred: fora do navegador é falso; app nativo é verdadeiro', () => {
  assert.equal(touchPreferred(), false);
  globalThis.window = { matchMedia: () => ({ matches: false }), location: { search: '' } };
  const nav = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const setNav = value => Object.defineProperty(globalThis, "navigator", { value, configurable: true });
  setNav({ maxTouchPoints: 0 });
  try {
    assert.equal(touchPreferred(), false);
    assert.equal(touchPreferred({ native: true }), true);
    assert.equal(touchPreferred({ search: '?touch=1' }), true);
    assert.equal(touchPreferred({ native: true, search: '?touch=0' }), false);
    globalThis.window.matchMedia = () => ({ matches: true });
    setNav({ maxTouchPoints: 5 });
    assert.equal(touchPreferred(), true);
  } finally { delete globalThis.window; if (nav) Object.defineProperty(globalThis, "navigator", nav); else delete globalThis.navigator; }
});
