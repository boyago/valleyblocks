// Controles de toque do ValleyBlocks (celular e tablet, app Capacitor ou navegador).
//
// Esquema: joystick flutuante na metade esquerda (andar, dirigir, navegar);
// arrastar na metade direita olha ao redor; toque longo na direita é a ação
// primária (minerar, atacar, disparar) enquanto o dedo ficar; toque curto é a
// ação secundária (colocar bloco, usar item, comer). Botões fixos cobrem o que
// o teclado fazia: pular (Espaço, segurar), agachar e correr (alternam),
// voar (V, só no criativo), câmera (C), mochila (Tab) e, dentro do carro,
// faróis (L) e buzina (H). O aviso de contexto ("Abrir porta") vira um botão
// e faz o papel do E/R.
//
// Tudo aqui escreve nas mesmas teclas que o teclado usa (game.keys), então a
// física do jogador, dos carros e dos barcos não muda nada.

const DEAD_ZONE = .32;
const SPRINT_EDGE = .92;
const LONG_PRESS_MS = 300;
const DRAG_THRESHOLD = 12;
const LOOK_GAIN = 2.6;

/** O aparelho prefere toque? Ponteiro grosseiro, app nativo ou ?touch=1 (para testar no PC). */
export function touchPreferred({ native = false, search = '' } = {}) {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(search || window.location?.search || '');
  if (params.get('touch') === '1') return true;
  if (params.get('touch') === '0') return false;
  if (native) return true;
  return !!window.matchMedia?.('(pointer:coarse)').matches && (navigator.maxTouchPoints || 0) > 0;
}

/** Vetor do joystick (-1..1 em cada eixo, y para baixo) → teclas que o jogador entende. */
export function stickToKeys(x, y) {
  const keys = new Set();
  const length = Math.hypot(x, y);
  if (length < DEAD_ZONE) return keys;
  // Normaliza a zona morta para o círculo, não para cada eixo: diagonais ficam fáceis.
  const nx = x / length, ny = y / length;
  if (ny < -.38) keys.add('KeyW');
  if (ny > .38) keys.add('KeyS');
  if (nx < -.38) keys.add('KeyA');
  if (nx > .38) keys.add('KeyD');
  if (length >= SPRINT_EDGE && keys.has('KeyW')) keys.add('ShiftLeft');
  return keys;
}

const STICK_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];
const svg = body => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const GLYPHS = {
  jump: svg('<path d="M12 20V5m-6 6 6-6 6 6"/>'),
  crouch: svg('<path d="M12 4v15m-6-6 6 6 6-6"/><path d="M5 21h14"/>'),
  sprint: svg('<path d="M4 12h10m-4-5 5 5-5 5M15 7l5 5-5 5"/>'),
  fly: svg('<path d="M3 13 21 4l-5 17-4-7-9-1Z"/>'),
  camera: svg('<path d="M3 8h4l2-3h6l2 3h4v11H3V8Z"/><circle cx="12" cy="13" r="3.2"/>'),
  bag: svg('<path d="M5 7h14l2 14H3L5 7Zm3 0V5a4 4 0 0 1 8 0v2"/>'),
  lights: svg('<path d="M9 7a5 5 0 0 1 0 10M4 7l5 2m-5 8 5-2M13 12h7M14 8l5-3M14 16l5 3"/>'),
  horn: svg('<path d="M4 10v4h3l6 4V6L7 10H4Zm12-2a5 5 0 0 1 0 8m2.5-10.5a8.5 8.5 0 0 1 0 13"/>'),
  pause: svg('<path d="M8 5v14M16 5v14"/>'),
};

export class TouchControls {
  constructor(game, root) {
    this.game = game;
    this.root = root;
    this.stick = { id: null, x: 0, y: 0, keys: new Set() };
    this.look = null;
    this.held = new Set();
    this.toggles = { crouch: false, sprint: false };
    this.primaryHeld = false;
    this.controller = new AbortController();
    this.build();
  }

  build() {
    const layer = document.createElement('div');
    layer.id = 'touch-layer';
    layer.innerHTML = `
      <div class="stick" id="touch-stick" aria-hidden="true"><i></i></div>
      <div class="touch-cluster" id="touch-cluster">
        <button type="button" class="touch-btn big" data-touch="jump" aria-label="Pular (segurar)">${GLYPHS.jump}<span>Pular</span></button>
        <button type="button" class="touch-btn" data-touch="crouch" aria-label="Agachar" aria-pressed="false">${GLYPHS.crouch}<span>Agachar</span></button>
        <button type="button" class="touch-btn" data-touch="sprint" aria-label="Correr" aria-pressed="false">${GLYPHS.sprint}<span>Correr</span></button>
        <button type="button" class="touch-btn" data-touch="fly" aria-label="Voar" hidden>${GLYPHS.fly}<span>Voar</span></button>
        <button type="button" class="touch-btn" data-touch="lights" aria-label="Faróis" hidden>${GLYPHS.lights}<span>Faróis</span></button>
        <button type="button" class="touch-btn" data-touch="horn" aria-label="Buzina" hidden>${GLYPHS.horn}<span>Buzina</span></button>
      </div>
      <div class="touch-side" id="touch-side">
        <button type="button" class="touch-btn" data-touch="bag" aria-label="Mochila">${GLYPHS.bag}<span>Mochila</span></button>
        <button type="button" class="touch-btn" data-touch="camera" aria-label="Câmera">${GLYPHS.camera}<span>Câmera</span></button>
      </div>`;
    // Antes do HUD no DOM: a barra de atalhos, o aviso de contexto e os botões
    // de cima continuam por cima e recebem os toques normalmente.
    this.root.insertBefore(layer, this.root.firstElementChild?.nextElementSibling || null);
    this.layer = layer;
    this.stickEl = layer.querySelector('#touch-stick');
    this.knob = this.stickEl.firstElementChild;
    this.buttons = Object.fromEntries([...layer.querySelectorAll('[data-touch]')].map(b => [b.dataset.touch, b]));
    const options = { signal: this.controller.signal, passive: false };
    layer.addEventListener('pointerdown', e => this.onDown(e), options);
    layer.addEventListener('pointermove', e => this.onMove(e), options);
    layer.addEventListener('pointerup', e => this.onUp(e), options);
    layer.addEventListener('pointercancel', e => this.onUp(e), options);
    layer.addEventListener('contextmenu', e => e.preventDefault(), options);
    layer.addEventListener('touchstart', e => e.preventDefault(), options); // sem zoom por toque duplo nem rolagem
    for (const [name, button] of Object.entries(this.buttons)) {
      button.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); this.press(name, button, e); }, options);
      button.addEventListener('pointerup', e => { e.preventDefault(); e.stopPropagation(); this.release(name, button, e); }, options);
      button.addEventListener('pointercancel', e => { e.preventDefault(); this.release(name, button, e); }, options);
      button.addEventListener('contextmenu', e => e.preventDefault(), options);
    }
  }

  get active() { return !!this.game.running; }

  // ----- Botões fixos -----
  press(name, button, e) {
    if (!this.active) return;
    button.setPointerCapture?.(e.pointerId);
    button.classList.add('down');
    const g = this.game;
    switch (name) {
      case 'jump': g.keys.add('Space'); this.held.add('Space'); break;
      case 'crouch': this.toggle('crouch', 'ControlLeft', button); break;
      case 'sprint': this.toggle('sprint', 'ShiftLeft', button); break;
      case 'fly': g.toggleFly(); break;
      case 'camera': g.cycleCamera(); break;
      case 'bag': g.openInventory(); break;
      case 'lights': if (g.activeVehicle) g.entities.toggleLights(g.activeVehicle); break;
      case 'horn': if (g.activeVehicle) g.audio.play('horn', g.activeVehicle.position); break;
    }
  }
  release(name, button) {
    button.classList.remove('down');
    if (name === 'jump') { this.game.keys.delete('Space'); this.held.delete('Space'); }
  }
  toggle(name, code, button) {
    this.toggles[name] = !this.toggles[name];
    button.classList.toggle('active', this.toggles[name]);
    button.setAttribute('aria-pressed', String(this.toggles[name]));
    if (this.toggles[name]) this.game.keys.add(code); else this.game.keys.delete(code);
    // Correr e agachar são exclusivos: ligar um desliga o outro.
    const other = name === 'crouch' ? 'sprint' : 'crouch';
    if (this.toggles[name] && this.toggles[other]) this.toggle(other, other === 'crouch' ? 'ControlLeft' : 'ShiftLeft', this.buttons[other]);
  }

  // ----- Área livre: joystick à esquerda, olhar e ações à direita -----
  onDown(e) {
    if (!this.active || e.target !== this.layer) return;
    e.preventDefault();
    this.layer.setPointerCapture?.(e.pointerId);
    const width = window.innerWidth;
    if (this.stick.id === null && e.clientX < width * .45) {
      this.stick.id = e.pointerId; this.stick.x = e.clientX; this.stick.y = e.clientY;
      this.stickEl.style.left = `${e.clientX}px`; this.stickEl.style.top = `${e.clientY}px`;
      this.stickEl.classList.add('active'); this.moveKnob(0, 0);
      return;
    }
    if (this.look === null) {
      this.look = { id: e.pointerId, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, moved: false, timer: 0, t: performance.now() };
      this.look.timer = setTimeout(() => { if (this.look?.id === e.pointerId && !this.look.moved) this.primaryStart(); }, LONG_PRESS_MS);
    }
  }
  onMove(e) {
    if (e.pointerId === this.stick.id) {
      e.preventDefault();
      const radius = 54;
      let dx = (e.clientX - this.stick.x) / radius, dy = (e.clientY - this.stick.y) / radius;
      const length = Math.hypot(dx, dy); if (length > 1) { dx /= length; dy /= length; }
      this.moveKnob(dx * radius, dy * radius);
      this.applyStick(stickToKeys(dx, dy));
      return;
    }
    if (this.look && e.pointerId === this.look.id) {
      e.preventDefault();
      const dx = e.clientX - this.look.x, dy = e.clientY - this.look.y;
      this.look.x = e.clientX; this.look.y = e.clientY;
      if (!this.look.moved && Math.hypot(e.clientX - this.look.startX, e.clientY - this.look.startY) > DRAG_THRESHOLD) {
        this.look.moved = true;
        if (!this.primaryHeld) clearTimeout(this.look.timer);
      }
      const g = this.game;
      if (g.running && !g.activeVehicle) g.player.look(dx * LOOK_GAIN, dy * LOOK_GAIN, g.settings.sensitivity);
    }
  }
  onUp(e) {
    if (e.pointerId === this.stick.id) { this.releaseStick(); return; }
    if (this.look && e.pointerId === this.look.id) {
      clearTimeout(this.look.timer);
      const quick = !this.look.moved && performance.now() - this.look.t < LONG_PRESS_MS;
      this.look = null;
      if (this.primaryHeld) this.primaryEnd();
      else if (quick && this.active && e.type === 'pointerup') this.secondary();
    }
  }
  moveKnob(x, y) { this.knob.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`; }
  applyStick(next) {
    const keys = this.game.keys;
    for (const code of this.stick.keys) if (!next.has(code)) keys.delete(code);
    for (const code of next) keys.add(code);
    // Correr pelo joystick não deve apagar o botão Correr nem vice-versa.
    if (this.toggles.sprint) keys.add('ShiftLeft');
    this.stick.keys = next;
  }
  releaseStick() {
    const keys = this.game.keys;
    for (const code of this.stick.keys) if (code !== 'ShiftLeft' || !this.toggles.sprint) keys.delete(code);
    this.stick.keys = new Set(); this.stick.id = null;
    this.stickEl.classList.remove('active'); this.stickEl.style.left = ''; this.stickEl.style.top = ''; this.moveKnob(0, 0);
  }
  primaryStart() { if (!this.active) return; this.primaryHeld = true; this.layer.classList.add('acting'); this.game.primaryDown(); }
  primaryEnd() { this.primaryHeld = false; this.layer.classList.remove('acting'); this.game.primaryUp(); }
  secondary() {
    const g = this.game, item = g.inventory?.selectedItem;
    // Estilingue, arco e espingarda disparam no toque curto: colocar não faz sentido com eles.
    if (g.isRanged?.(item)) { g.primaryDown(); g.primaryUp(); return; }
    g.place();
  }

  /** Solta tudo (menus, troca de mundo, perda de foco). */
  reset() {
    if (this.look) clearTimeout(this.look.timer);
    this.look = null;
    if (this.primaryHeld) { this.primaryHeld = false; this.layer.classList.remove('acting'); }
    this.releaseStick();
    for (const code of this.held) this.game.keys.delete(code);
    this.held.clear();
    for (const name of ['crouch', 'sprint']) if (this.toggles[name]) { this.toggles[name] = false; this.buttons[name].classList.remove('active'); this.buttons[name].setAttribute('aria-pressed', 'false'); }
    for (const b of Object.values(this.buttons)) b.classList.remove('down');
  }

  /** Mostra só os botões que fazem sentido agora (chamado junto com o HUD). */
  update() {
    const g = this.game, vehicle = !!g.activeVehicle, boat = !!g.activeBoat;
    this.buttons.fly.hidden = g.mode !== 'creative' || vehicle || boat;
    this.buttons.crouch.hidden = vehicle || boat;
    this.buttons.sprint.hidden = vehicle || boat;
    this.buttons.lights.hidden = !vehicle;
    this.buttons.horn.hidden = !vehicle;
    this.buttons.jump.querySelector('span').textContent = vehicle ? 'Freio' : boat ? '—' : g.player?.flying ? 'Subir' : 'Pular';
    this.buttons.jump.hidden = boat;
    this.buttons.fly.classList.toggle('active', !!g.player?.flying);
    this.buttons.camera.hidden = false;
  }

  dispose() { this.controller.abort(); this.layer.remove(); }
}
