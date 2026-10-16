import * as THREE from 'three';
import { restoreNeeds, updateNeeds } from './survival.js';
import { BLOCK } from './blocks.js';

const STANDING_HEIGHT = 1.78;
const CROUCH_HEIGHT = 1.22;
const CONTACT_GAP = .002;

export class Player {
  constructor(world, state = null) {
    this.world = world;
    this.position = new THREE.Vector3(0, 9.01, 12);
    this.velocity = new THREE.Vector3();
    this.yaw = 0; this.pitch = -.1; this.health = 100;
    this.grounded = false; this.flying = false; this.crouching = false;
    this.radius = .29; this.height = STANDING_HEIGHT; this.fallSpeed = 0;
    this.distance = 0; this.inWater = false; this.air = 12;
    this._swimJumping = false;
    this._ensuredChunk = null;
    restoreNeeds(this,state);
    if (state) {
      if (Array.isArray(state.position) && state.position.length === 3 && state.position.every(Number.isFinite) && state.position.every(value => Math.abs(value) < 1000000)) this.position.fromArray(state.position);
      this.yaw = Number.isFinite(state.yaw) ? state.yaw : 0;
      this.pitch = THREE.MathUtils.clamp(Number.isFinite(state.pitch) ? state.pitch : 0, -1.52, 1.52);
      this.health = Number.isFinite(state.health) ? Math.max(1, Math.min(100, state.health)) : 100;
      this.flying = !!state.flying;
    }
    this._ensureChunks();
    if (this.position.y < -8 || this.position.y > 256 || this.blocked(this.position)) this.safeSpawn(null, this.position);
  }
  get eye() { return this.position.clone().add(new THREE.Vector3(0, this.crouching ? 1.12 : 1.62, 0)); }
  get direction() { return new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch)); }
  look(dx, dy, sensitivity = 1) {
    this.yaw -= dx * .002 * sensitivity;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * .002 * sensitivity, -1.52, 1.52);
  }
  box(position = this.position, height = this.height) {
    return { min: { x: position.x-this.radius, y: position.y+CONTACT_GAP, z: position.z-this.radius }, max: { x: position.x+this.radius, y: position.y+height, z: position.z+this.radius } };
  }
  blocked(position, extraCollision = null) {
    const { min, max } = this.box(position);
    return this.world.collides(min, max) || (extraCollision?.(min,max) ?? false);
  }
  overlaps(x,y,z) {
    const {min,max} = this.box();
    return min.x<x+1 && max.x>x && min.y<y+1 && max.y>y && min.z<z+1 && max.z>z;
  }
  _ensureChunks() {
    const key = `${Math.floor(this.position.x / 16)},${Math.floor(this.position.z / 16)}`;
    if (key !== this._ensuredChunk) {
      this.world.ensureAround(this.position.x, this.position.z, 1);
      this._ensuredChunk = key;
    }
  }
  safeSpawn(extraCollision = null, preferred = null) {
    const origin = preferred?.clone() || new THREE.Vector3(0, 9, 12);
    this.height = STANDING_HEIGHT; this.crouching = false;
    for (const center of [origin, new THREE.Vector3(0, 9, 12)]) {
      this.world.ensureAround(center.x, center.z, 1);
      for (let radius = 0; radius < 12; radius++) for (let dx = -radius; dx <= radius; dx++) for (let dz = -radius; dz <= radius; dz++) {
        if (radius > 0 && Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue;
        const x = Math.floor(center.x) + dx + .5, z = Math.floor(center.z) + dz + .5;
        const p = new THREE.Vector3(x, this.world.surfaceHeight(x, z) + CONTACT_GAP, z);
        if (!this.blocked(p, extraCollision) && p.y > 1) {
          this.position.copy(p); this.velocity.set(0, 0, 0);
          this.grounded = false; this.fallSpeed = 0; this._ensuredChunk = null;
          this._swimJumping = false;
          this._ensureChunks();
          return true;
        }
      }
    }
    // The immutable bottom layer guarantees a world exists, but a player may
    // have built over the entire spawn. Search above it without deleting builds.
    const fallback = new THREE.Vector3(.5, Math.max(66, this.world.surfaceHeight(.5, 12.5) + 2), 12.5);
    this.position.copy(fallback); this.velocity.set(0, 0, 0); this.grounded = false;
    this._ensuredChunk = null; this._ensureChunks();
    return false;
  }
  _supportHeight(position, maxY) {
    if (!this.world.heightAt) return null;
    const r = this.radius - .0001;
    let highest = null;
    for (const dx of [-r, 0, r]) for (const dz of [-r, 0, r]) {
      const height = this.world.heightAt(position.x + dx, position.z + dz, maxY);
      if (Number.isFinite(height) && (highest === null || height > highest)) highest = height;
    }
    return highest;
  }
  _moveAxis(axis, amount, extraCollision) {
    if (Math.abs(amount) < 1e-8) return false;
    const start = this.position[axis];
    const next = this.position.clone(); next[axis] += amount;
    if (!this.blocked(next, extraCollision)) { this.position.copy(next); return false; }
    // Resolve to the actual contact plane, even on a long frame. The caller has
    // already subdivided movement so that a whole voxel cannot be skipped.
    let low = 0, high = 1;
    for (let iteration = 0; iteration < 9; iteration++) {
      const middle = (low + high) / 2;
      next[axis] = start + amount * middle;
      if (this.blocked(next, extraCollision)) high = middle; else low = middle;
    }
    this.position[axis] = start + amount * low;
    return true;
  }
  _waterSurface(x, y, z) {
    if (this.world.waterSurfaceAt) return this.world.waterSurfaceAt(x, y, z);
    return this.world.getBlock(x, y, z) === 9 ? Math.floor(y) + 1 : null;
  }
  _waterState(id = BLOCK.WATER) {
    // Sample the body rather than one waist voxel: water remains active while
    // swimming across the surface, including flowing water below a voxel top.
    let depth = 0, surface = null;
    const r = this.radius * .8;
    for (const [dx, dz] of [[0, 0], [-r, 0], [r, 0], [0, -r], [0, r]]) {
      let columnDepth = 0;
      for (let y = Math.floor(this.position.y); y <= Math.floor(this.position.y + this.height); y++) {
        const x=this.position.x+dx,z=this.position.z+dz;
        const top = id===BLOCK.WATER ? this._waterSurface(x,y,z) : this.world.fluidSurfaceAt ? this.world.fluidSurfaceAt(x,y,z,id) : (this.world.getBlock(x,y,z)===id?y+1:null);
        if (!Number.isFinite(top)) continue;
        const overlap = Math.min(this.position.y + this.height, top) - Math.max(this.position.y, y);
        if (overlap <= 0) continue;
        columnDepth += overlap;
        surface = Math.max(surface ?? -Infinity, top);
      }
      depth = Math.max(depth, columnDepth);
    }
    return { depth, surface };
  }
  _canSwimOnto(next, surface, extraCollision) {
    // Source water renders slightly below a full voxel; allow that small gap
    // when measuring an otherwise one-block-high bank.
    const floor = this._supportHeight(next, surface + 1.2);
    if (floor === null || floor < surface - .1 || floor > surface + 1.2) return false;
    const landing = next.clone(); landing.y = floor + CONTACT_GAP;
    if (this.blocked(landing, extraCollision)) return false;
    // The boost still moves through the normal collision solver. Check the
    // vertical corridor too, so a low ceiling cannot turn swimming into a lift.
    const probe = this.position.clone();
    for (let y = this.position.y + .1; y < landing.y + .1; y += .1) {
      probe.y = Math.min(y, landing.y);
      if (this.blocked(probe, extraCollision)) return false;
    }
    return true;
  }
  update(dt, keys, mode, extraCollision) {
    if (!Number.isFinite(dt) || dt <= 0) return null;
    dt = Math.min(dt, .1);
    const prev = this.position.clone();
    this._ensureChunks();
    const crouch = keys.has('ControlLeft') || keys.has('ControlRight');
    // Do not stand up into a ceiling.
    if (crouch) { this.crouching=true; this.height=CROUCH_HEIGHT; }
    else { const b=this.box(this.position,STANDING_HEIGHT); if(!this.world.collides(b.min,b.max) && !(extraCollision?.(b.min,b.max) ?? false)) {this.crouching=false;this.height=STANDING_HEIGHT;} }
    this.inWater=this._waterState().depth>.02;
    this.inLava=this._waterState(BLOCK.LAVA).depth>.02;
    if(mode!=='creative') this.flying=false;
    let strafe=Number(keys.has('KeyD'))-Number(keys.has('KeyA'));
    let forward=Number(keys.has('KeyW'))-Number(keys.has('KeyS'));
    const len=Math.hypot(strafe,forward); if(len>1) {strafe/=len;forward/=len;}
    this.sprinting=!this.flying&&!this.crouching&&len>0&&(keys.has('ShiftLeft')||keys.has('ShiftRight'))&&(mode==='creative'||(!this.exhausted&&this.stamina>0&&this.hunger>10));
    const speed=this.flying?11:this.crouching?2:this.sprinting?7:4.3;
    const factor=this.inLava?.4:this.inWater?.52:1;
    const targetX=(Math.cos(this.yaw)*strafe-Math.sin(this.yaw)*forward)*speed*factor;
    const targetZ=(-Math.sin(this.yaw)*strafe-Math.cos(this.yaw)*forward)*speed*factor;
    const easing=1-Math.exp(-18*dt);
    this.velocity.x=THREE.MathUtils.lerp(this.velocity.x,targetX,easing);
    this.velocity.z=THREE.MathUtils.lerp(this.velocity.z,targetZ,easing);
    const jump=keys.has('Space');
    const steps=Math.max(1,Math.ceil(dt*120),Math.ceil((this.velocity.length()+23*dt)*dt/.18));
    const h=dt/steps;
    let lavaExposure=0;
    for(let i=0;i<steps;i++) {
      const water=this._waterState();
      this.inWater=water.depth>.02;
      const lava=this._waterState(BLOCK.LAVA);
      this.inLava=lava.depth>.02;
      const inFluid=this.inWater||this.inLava;
      const surface=this.inLava?lava.surface:water.surface;
      if(this.inLava)lavaExposure+=h;
      if(!jump || this.velocity.y<=0) this._swimJumping=false;
      if(this.flying) { this.velocity.y=(Number(jump)-Number(crouch))*speed; this.grounded=false; }
      else if(jump && this.grounded && (mode==='creative'||this.stamina>=8||inFluid)) { this.velocity.y=8; this.grounded=false; this._swimJumping=inFluid;if(mode==='survival')this.stamina=Math.max(0,this.stamina-8); }
      else if(inFluid && !this._swimJumping) {
        // Water slows falls but never holds the player on an invisible surface.
        // Swimming up is deliberate; idle swimmers sink and Control dives faster.
        const targetY=this.inLava?(jump?3:crouch?-2.6:-.8):(jump?3.8:crouch?-3:-.85);
        this.velocity.y=Math.max(this.inLava?-4:-5,this.velocity.y);
        this.velocity.y=THREE.MathUtils.lerp(this.velocity.y,targetY,1-Math.exp(-8*h));
      }
      else this.velocity.y=Math.max(-38,this.velocity.y-23*h);
      let grounded=false;
      for(const axis of ['x','z']) {
        if(Math.abs(this.velocity[axis])<.001)continue;
        const next=this.position.clone(); next[axis]+=this.velocity[axis]*h;
        if(!this.blocked(next,extraCollision)) this.position.copy(next);
        else if(!this.flying && jump && inFluid && !this._swimJumping && surface-this.position.y<.38 && this._canSwimOnto(next,surface,extraCollision)) {
          // Give a real upward impulse at an accessible bank; gravity and all
          // ordinary collisions remain active throughout the exit jump.
          this.velocity.y=8.5; this._swimJumping=true; this.grounded=false;
          this._moveAxis(axis,this.velocity[axis]*h,extraCollision);
        }
        else if(!this.flying && this.grounded) {
          const floor=this._supportHeight(next,this.position.y+.62);
          if(floor!==null && floor-this.position.y>CONTACT_GAP && floor-this.position.y<=.6) {
            next.y=floor+CONTACT_GAP;
            if(!this.blocked(next,extraCollision)) {this.position.copy(next);continue;}
          }
          this._moveAxis(axis,this.velocity[axis]*h,extraCollision);
        }
        else this._moveAxis(axis,this.velocity[axis]*h,extraCollision);
      }
      if(this._moveAxis('y',this.velocity.y*h,extraCollision)) {
        if(this.velocity.y<0) {
          grounded=true;
          if(mode==='survival' && this.velocity.y < -13) this.health=Math.max(0,this.health-Math.round((-this.velocity.y-13)*3));
        }
        this.velocity.y=0;
      }
      if(!this.flying) {
        const down=this.position.clone();down.y-=.055;
        this.grounded=grounded||(this.velocity.y<=0 && this.blocked(down,extraCollision));
      }
    }
    this.inWater=this._waterState().depth>.02;
    this.inLava=this._waterState(BLOCK.LAVA).depth>.02;
    this.distance+=Math.hypot(this.position.x-prev.x,this.position.z-prev.z);
    const moving=this.position.distanceToSquared(prev)>.000001;
    updateNeeds(this,dt,mode,{moving,sprinting:this.sprinting&&moving,swimming:this.inWater,mining:this.working});
    const eye=this.eye;
    const eyeSurface=this._waterSurface(eye.x,eye.y,eye.z);
    const underwater=Number.isFinite(eyeSurface) && eye.y<eyeSurface;
    if(underwater && mode==='survival') {this.air-=dt;if(this.air<0)this.health=Math.max(0,this.health-dt*7);}
    else this.air=Math.min(12,this.air+dt*3);
    if (mode === 'survival') this.health = Math.max(0, this.health - lavaExposure * 40);
    if(this.position.y < -8 || this.health<=0) {this.safeSpawn(extraCollision);this.health=100;this.air=12;restoreNeeds(this,{hunger:75,stamina:100});return 'respawn';}
    return null;
  }
  serialize() {return {position:this.position.toArray(),yaw:this.yaw,pitch:this.pitch,health:this.health,flying:this.flying,hunger:this.hunger,stamina:this.stamina,exhausted:this.exhausted};}
}
