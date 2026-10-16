import * as THREE from 'three';
import { ExplorerAvatar } from './avatar.js';

// Co-op (até 4 jogadores). O anfitrião é dono do mundo e o único que salva; os convidados
// recebem semente + blocos alterados e jogam numa cópia que nunca é gravada. Depois disso
// só trafegam blocos colocados/quebrados por pessoas e a posição de cada jogador.
const ERRORS = { 'needs-full': 'Criar sala é da versão completa.', 'no-room': 'Sala não encontrada. Confira o código.', full: 'A sala está cheia (4 jogadores).', already: 'Sua conta já está nesta sala.', rate: 'Calma, muitas ações por segundo.', 'too-big': 'O mundo é grande demais para enviar.' };
const STATE_HZ = 10;

function nameTag(text) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d'); g.fillStyle = 'rgba(20,40,32,.72)'; g.beginPath(); g.roundRect(8, 10, 240, 44, 12); g.fill();
  g.fillStyle = '#f4f3e8'; g.font = '600 26px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text.slice(0, 16), 128, 33);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sprite.scale.set(1.6, .4, 1); sprite.position.y = 2.35; sprite.renderOrder = 10; return sprite;
}

class RemotePlayer {
  constructor(scene, info) {
    this.id = info.id; this.name = info.name;
    this.rig = new THREE.Object3D(); this.avatar = new ExplorerAvatar(scene, this.rig);
    if (info.outfit) this.avatar.setOutfit(info.outfit);
    this.tag = nameTag(info.name); this.avatar.body.add(this.tag);
    this.state = { position: new THREE.Vector3(0, -100, 0), yaw: 0, pitch: 0, crouching: false, distance: 0, velocity: new THREE.Vector3() };
    this.target = this.state.position.clone(); this.targetYaw = 0; this.seen = false;
  }
  receive(m) {
    this.target.set(m.p[0], m.p[1], m.p[2]); this.targetYaw = m.yaw; this.state.pitch = m.pitch; this.state.crouching = m.c;
    if (!this.seen) { this.state.position.copy(this.target); this.state.yaw = m.yaw; this.seen = true; }
  }
  update(dt) {
    const before = this.state.position.clone();
    this.state.position.lerp(this.target, Math.min(1, dt * 12));
    let dy = this.targetYaw - this.state.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); this.state.yaw += dy * Math.min(1, dt * 12);
    const moved = before.distanceTo(this.state.position); this.state.distance += moved;
    this.state.velocity.set((this.state.position.x - before.x) / Math.max(dt, 1e-3), 0, (this.state.position.z - before.z) / Math.max(dt, 1e-3));
    this.avatar.update(this.state, null, { first: false, active: this.seen, dt });
  }
  dispose() { this.tag.material.map.dispose(); this.tag.material.dispose(); this.avatar.dispose(); this.rig.removeFromParent(); }
}

export class Coop {
  constructor(game) {
    this.game = game; this.ws = null; this.code = ''; this.role = null; this.you = ''; this.remotes = new Map(); this.capturing = 0; this.applying = false; this.sendTimer = 0; this.status = '';
    this.wrapActions();
  }
  get active() { return !!this.role; }
  get guest() { return this.role === 'guest'; }
  players() { return [{ id: this.you, name: 'Você' }, ...[...this.remotes.values()].map(r => ({ id: r.id, name: r.name }))]; }

  /** Player actions are the only source of shared block changes; physics, water and sand run on every machine. */
  wrapActions() {
    for (const name of ['mine', 'place', 'toggleDoor', 'interact']) {
      const original = this.game[name]; if (typeof original !== 'function') continue;
      this.game[name] = (...args) => { this.capturing++; try { return original.apply(this.game, args); } finally { this.capturing--; } };
    }
  }
  bindWorld(world) {
    if (world.__coopBound) return; world.__coopBound = true;
    const setBlock = world.setBlock.bind(world);
    world.setBlock = (x, y, z, id, facing = 0) => {
      const ok = setBlock(x, y, z, id, facing);
      if (ok && this.active && this.capturing > 0 && !this.applying) this.send({ t: 'block', x: Math.floor(x), y: Math.floor(y), z: Math.floor(z), id, f: facing | 0 });
      return ok;
    };
  }

  connect() {
    if (this.ws && this.ws.readyState <= 1) return Promise.resolve();
    return new Promise((resolve, reject) => {
      let ws;
      try { ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/mp`); } catch { reject(new Error('Multiplayer indisponível neste navegador.')); return; }
      this.ws = ws; let opened = false;
      ws.onopen = () => { opened = true; };
      ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch { return; } if (m.t === 'hello') { this.you = m.you; this.canHost = m.canHost; resolve(); } else this.handle(m); };
      ws.onerror = () => { if (!opened) reject(new Error('Não foi possível conectar. Entre na sua conta e tente de novo.')); };
      ws.onclose = () => { if (!opened) reject(new Error('Não foi possível conectar. Entre na sua conta e tente de novo.')); else if (this.active) this.end('A conexão com a sala caiu.'); this.ws = null; };
    });
  }
  send(m) { if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(m)); }

  async host() {
    await this.connect();
    if (!this.canHost) throw new Error(ERRORS['needs-full']);
    return new Promise((resolve, reject) => { this.pending = { resolve, reject }; this.send({ t: 'host' }); });
  }
  async join(code) {
    const clean = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    if (clean.length !== 6) throw new Error('O código da sala tem 6 letras e números.');
    await this.connect();
    return new Promise((resolve, reject) => { this.pending = { resolve, reject }; this.send({ t: 'join', code: clean }); });
  }
  leave() { this.send({ t: 'leave' }); this.end(null); }

  /** Called by the game when a guest starts: the save it plays is the host's copy. */
  guestSnapshot() {
    const s = this.game.snapshot();
    // The guest keeps their own items and starts at the host's door; nothing of the host's player state is copied.
    delete s.inventory; delete s.player; s.coopGuest = true; return s;
  }
  handle(m) {
    const g = this.game;
    switch (m.t) {
      case 'room': this.role = 'host'; this.code = m.code; this.pending?.resolve(m.code); this.pending = null; g.ui.toast(`Sala criada: ${m.code}. Passe o código para seus amigos.`); break;
      case 'want-snapshot': this.send({ t: 'snapshot', to: m.to, data: this.guestSnapshot() }); break;
      case 'world': {
        this.role = 'guest'; this.code = m.code; this.you = m.you;
        for (const p of m.players) if (p.id !== this.you) this.addRemote(p);
        g.startCoopGuest(m.data); this.pending?.resolve(m.code); this.pending = null;
        g.ui.toast(`Você entrou na sala ${m.code}. O mundo é do anfitrião e é salvo por ele.`); break;
      }
      case 'joined': this.addRemote(m); g.ui.toast(`${m.name} entrou no vale.`); g.audio.play('craft'); break;
      case 'left': { const r = this.remotes.get(m.id); if (r) { g.ui.toast(`${r.name} saiu.`); r.dispose(); this.remotes.delete(m.id); } break; }
      case 'state': this.remotes.get(m.id)?.receive(m); break;
      case 'outfit': this.remotes.get(m.id)?.avatar.setOutfit(m.outfit); break;
      case 'block': { this.applying = true; try { g.world.setBlock(m.x, m.y, m.z, m.id, m.f); } finally { this.applying = false; } break; }
      case 'chat': if (m.id !== this.you) g.ui.toast(`${m.name}: ${m.text}`); break;
      case 'closed': this.end('O anfitrião fechou a sala.'); break;
      case 'error': { const message = ERRORS[m.code] || 'Algo deu errado na sala.'; if (this.pending) { this.pending.reject(new Error(message)); this.pending = null; } else if (m.code !== 'rate') g.ui.toast(message); break; }
    }
  }
  addRemote(info) { if (info.id === this.you || this.remotes.has(info.id)) return; this.remotes.set(info.id, new RemotePlayer(this.game.scene, info)); }

  update(dt) {
    if (!this.active) return;
    for (const r of this.remotes.values()) r.update(dt);
    this.sendTimer += dt; if (this.sendTimer < 1 / STATE_HZ || !this.game.started) return; this.sendTimer = 0;
    const p = this.game.activeVehicle?.position || this.game.player.position;
    this.send({ t: 'state', p: [p.x, p.y, p.z], yaw: this.game.player.yaw, pitch: this.game.player.pitch, c: !!this.game.player.crouching });
  }
  setOutfit(id) { this.send({ t: 'outfit', id }); }
  end(message) {
    const wasGuest = this.guest;
    for (const r of this.remotes.values()) r.dispose(); this.remotes.clear();
    this.role = null; this.code = '';
    try { this.ws?.close(); } catch { /* ignore */ } this.ws = null;
    if (message) this.game.ui.toast(message);
    if (wasGuest) this.game.endCoopGuest();
  }
  dispose() { this.end(null); }
}
