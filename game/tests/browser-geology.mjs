import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const checks = [], errors = [];
page.on('pageerror', e => errors.push(e.message));
const check = (name, ok) => { assert.ok(ok, name); checks.push(name); console.log('PASS', name); };
await mkdir('test-results', { recursive: true });
try {
  await page.goto('http://127.0.0.1:5186/', { waitUntil: 'networkidle' });
  await page.locator('[data-mode="survival"]').click();
  await page.locator('[data-action="new-game"]').click();
  await page.waitForFunction(() => window.__valeGame?.running);
  const pool = await page.evaluate(() => window.__valeGame.world.geology.candidate(0, 0));
  check('new worlds contain an accessible lava pool and exposed diamonds', await page.evaluate(p => {
    const w = window.__valeGame.world;
    return w.getBlock(p.x, p.y - 1, p.z) === 26 && w.getBlock(p.x + p.rx, p.y, p.z) === 25;
  }, pool));
  await page.evaluate(p => {
    const g = window.__valeGame;
    g.mode = 'creative'; g.player.flying = true;
    g.player.position.set(p.x + 11, p.y + 9, p.z + 13);
    g.player.velocity.set(0, 0, 0); g.player.yaw = Math.atan2(11, 13); g.player.pitch = -.6;
    g.time = .38; g.updateCamera(1);
  }, pool);
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'test-results/geology-lava-pool.png' });
  check('lava has a visible unlit material mesh', await page.evaluate(() => [...window.__valeGame.world.chunks.values()].some(c => c.meshes.some(m => m.material === window.__valeGame.world.lavaMaterial))));
  await page.evaluate(p => {
    const g = window.__valeGame;
    g.mode = 'survival'; g.player.flying = false;
    g.player.position.set(p.x + p.rx + 1.5, p.y + 1.002, p.z + .5);
    g.player.velocity.set(0, 0, 0); g.player.yaw = Math.PI / 2;
    g.player.pitch = Math.atan2(p.y + .5 - g.player.eye.y, 1);
    g.inventory.add('iron_pickaxe'); g.inventory.hotbar[7]='iron_pickaxe'; g.inventory.select(7); g.updateCamera(1);
  }, pool);
  await page.waitForFunction(() => window.__valeGame.target?.id === 25);
  await page.mouse.down(); await page.waitForTimeout(1550); await page.mouse.up();
  check('left-click with the pickaxe mines and collects diamond ore', await page.evaluate(() => window.__valeGame.inventory.count(25) === 1));
  await page.evaluate(p => {
    const g = window.__valeGame;
    g.player.position.set(p.x + .5, p.y + 2, p.z + .5);
    g.player.velocity.set(0, 0, 0); g.player.pitch = -1.5;
    g.updateCamera(1);
  }, pool);
  await page.mouse.down(); await page.waitForTimeout(700); await page.mouse.up();
  check('lava damages the player and cannot be mined into inventory', await page.evaluate(p => {
    const g = window.__valeGame;
    return g.player.health < 100 && g.player.inLava && !g.inventory.count(26) && g.world.getBlock(p.x, p.y - 1, p.z) === 26;
  }, pool));
  await page.screenshot({ path: 'test-results/geology-lava-contact.png' });
  await page.evaluate(p => {
    const g = window.__valeGame;
    g.player.position.set(p.x + p.rx + 1.5, p.y + 1.002, p.z + .5);
    g.player.velocity.set(0, 0, 0); g.menu('pause');
  }, pool);
  await page.locator('[data-action="save"]').click();
  await page.waitForFunction(() => window.__valeGame.saved?.geology && !window.__valeGame.savePromise);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('[data-action="continue"]').click();
  await page.waitForFunction(() => window.__valeGame?.running);
  check('pool, mined ore and diamond inventory survive save/reload', await page.evaluate(p => {
    const g = window.__valeGame;
    return g.inventory.count(25) === 1 && g.world.getBlock(p.x + p.rx, p.y, p.z) === 0 && g.world.getBlock(p.x, p.y - 1, p.z) === 26;
  }, pool));
  check('no browser runtime errors', errors.length === 0);
  await writeFile('test-results/geology-report.json', JSON.stringify({ date: new Date().toISOString(), checks, errors }, null, 2));
} catch (error) {
  await page.screenshot({ path: 'test-results/geology-failure.png' });
  console.error(await page.evaluate(() => window.__valeDebug?.()));
  throw error;
} finally { await browser.close(); }
