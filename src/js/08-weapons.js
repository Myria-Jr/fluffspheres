// ───────────────────────── Weapons, projectiles & ballistic simulation ─────────────────────────
const GRAVITY = 30;
const WIND_ACC = 10;
const FLUFF_R = 1.3;
const SIM_DT = 1 / 120;

const WEAPONS = [
  { id: 'bazooka', name: 'Herzchen-Bazooka', emoji: '💘', ammo: Infinity, kind: 'bullet', speed: 56, windK: 1, radius: 3.2, damage: 45,
    desc: 'Feuert ein glitzerndes Herz ab, das beim Aufprall explodiert. Vom Wind beeinflusst – Klassiker!' },
  { id: 'cluster', name: 'Plüsch-Splitterbombe', emoji: '🧸', ammo: 3, kind: 'grenade', speed: 42, windK: 0.3, radius: 2.6, damage: 28, fuse: 3, bounce: 0.45,
    desc: 'Ein hüpfender Teddy mit 3-Sekunden-Zünder. Platzt in 5 Mini-Plüschis, die selbst explodieren.' },
  { id: 'orbital', name: 'Regenbogen-Orbitalstrahl', emoji: '🌈', ammo: 1, kind: 'target', radius: 4.4, damage: 42,
    desc: 'Tippe einen Ort an: Ein Regenbogenstrahl schießt vom Himmel herab. Ignoriert Wind und Deckung.' },
  { id: 'grapple', name: 'Zuckerwatte-Greifhaken', emoji: '🍭', ammo: 3, kind: 'rope', speed: 80, range: 46, utility: true,
    desc: 'Schießt ein klebriges Zuckerwatte-Seil und zieht dich hin. Beendet deinen Zug nicht!' },
  { id: 'shove', name: 'Kuschel-Schubser', emoji: '🤗', ammo: Infinity, kind: 'melee', damage: 18, range: 3.8, push: 26,
    desc: 'Eine stürmische Umarmung aus nächster Nähe, die Gegner meterweit wegschleudert – gern ins Meer.' },
  { id: 'mine', name: 'Bonbon-Mine', emoji: '🍬', ammo: 2, kind: 'mine', radius: 2.9, damage: 38,
    desc: 'Lege ein süßes Bonbon ab. Ab der nächsten Runde scharf – explodiert, wenn jemand zu nahe kommt.' },
];
const WEAPON_BY_ID = Object.fromEntries(WEAPONS.map((w) => [w.id, w]));

// ── mesh builders ──
function heartShape(s) {
  const sh = new THREE.Shape();
  sh.moveTo(0, -s * 0.6);
  sh.bezierCurveTo(-s * 1.3, s * 0.1, -s * 0.6, s * 1.05, 0, s * 0.45);
  sh.bezierCurveTo(s * 0.6, s * 1.05, s * 1.3, s * 0.1, 0, -s * 0.6);
  return sh;
}
function starShape(r1, r2, n = 5) {
  const sh = new THREE.Shape();
  for (let i = 0; i < n * 2; i++) { const r = i % 2 ? r2 : r1, a = Math.PI / 2 + (i * Math.PI) / n; i ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r) : sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  return sh;
}
const _meshCache = {};
function makeProjectileMesh(look) {
  const g = new THREE.Group();
  const ext = { depth: 0.3, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 3 };
  if (look === 'heart') {
    _meshCache.heart = _meshCache.heart || new THREE.ExtrudeGeometry(heartShape(0.55), ext).center();
    g.add(new THREE.Mesh(_meshCache.heart, new THREE.MeshPhongMaterial({ color: '#ff5f9e', emissive: '#a0205a', shininess: 90, specular: '#ffffff' })));
  } else if (look === 'star') {
    _meshCache.star = _meshCache.star || new THREE.ExtrudeGeometry(starShape(0.7, 0.32), ext).center();
    g.add(new THREE.Mesh(_meshCache.star, new THREE.MeshPhongMaterial({ color: '#ffd94a', emissive: '#c08a00', shininess: 80 })));
  } else if (look === 'plush' || look === 'miniplush') {
    const s = look === 'plush' ? 1 : 0.55;
    const m = new THREE.MeshLambertMaterial({ color: '#d9a07a' });
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.55 * s, 16, 12), m);
    const e1 = new THREE.Mesh(new THREE.SphereGeometry(0.2 * s, 10, 8), m); e1.position.set(-0.38 * s, 0.4 * s, 0);
    const e2 = e1.clone(); e2.position.x *= -1;
    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.2 * s, 10, 8), new THREE.MeshLambertMaterial({ color: '#ffe3cc' })); snout.position.set(0, -0.08 * s, 0.45 * s);
    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.12 * s, 0.06 * s, 6, 12), new THREE.MeshLambertMaterial({ color: '#ff5f9e' })); bow.position.set(0, -0.42 * s, 0.3 * s);
    g.add(b, e1, e2, snout, bow);
  } else if (look === 'candy') {
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), new THREE.MeshPhongMaterial({ color: '#ff6fb0', shininess: 120 }));
    body.scale.set(1.2, 0.85, 0.85);
    const wm = new THREE.MeshPhongMaterial({ color: '#ffe0f0', shininess: 60 });
    const w1 = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.5, 10), wm); w1.rotation.z = Math.PI / 2; w1.position.x = -0.75;
    const w2 = w1.clone(); w2.rotation.z = -Math.PI / 2; w2.position.x = 0.75;
    g.add(body, w1, w2);
  } else if (look === 'hook') {
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.45, 14, 10), new THREE.MeshLambertMaterial({ color: '#ffb3e0', emissive: '#80406a' })));
  }
  return g;
}

class Projectile {
  constructor(game, o) {
    this.game = game;
    Object.assign(this, { x: 0, y: 0, vx: 0, vy: 0, kind: 'bullet', windK: 1, gK: 1, radius: 3, damage: 40, fuse: 0, bounce: 0.4, age: 0, alive: true, owner: null, look: 'heart', trail: '#ffb3dd', acc: 0, spin: 0 }, o);
    this.mesh = makeProjectileMesh(this.look);
    this.mesh.position.set(this.x, this.y, -0.6);
    game.scene.add(this.mesh);
    this.butterflyHits = new Set();
  }

  step(dt) {
    const g = this.game, env = g.env;
    if (this.kind !== 'rope') {
      this.vx += env.wind * WIND_ACC * this.windK * dt;
      this.vy -= env.grav * GRAVITY * this.gK * dt;
    }
    const nx = this.x + this.vx * dt, ny = this.y + this.vy * dt;
    this.age += dt;
    // butterflies
    g.butterflies.hitTest(nx, ny, 1.7, this.butterflyHits);
    if (this.kind === 'rope') {
      const o = this.owner;
      if (g.terrain.solid(nx, ny)) { g.onRopeAnchor(this, nx, ny); return this.kill(); }
      if (Math.hypot(nx - o.x, ny - o.y) > this.range) { g.onRopeMiss(this); return this.kill(); }
      this.x = nx; this.y = ny; return;
    }
    // fluff contact
    if (this.kind === 'bullet') {
      for (const f of g.fluffs) {
        if (!f.alive || (f === this.owner && this.age < 0.25)) continue;
        if (Math.hypot(nx - f.x, ny - f.cy) < FLUFF_R + 0.3) { this.x = nx; this.y = ny; return this.detonate(); }
      }
    }
    if (g.terrain.solid(nx, ny)) {
      if (this.kind === 'bullet') { this.x = nx; this.y = ny; return this.detonate(); }
      // grenade bounce
      const n = g.terrain.normalAt(this.x, this.y);
      const dot = this.vx * n.x + this.vy * n.y;
      this.vx = (this.vx - 2 * dot * n.x) * this.bounce; this.vy = (this.vy - 2 * dot * n.y) * this.bounce;
      if (Math.abs(dot) > 6) Sfx.land();
      if (g.terrain.solid(this.x, this.y)) this.y += 0.3 * env.grav;
    } else { this.x = nx; this.y = ny; }
    if (this.kind === 'grenade') { this.fuse -= dt; if (this.fuse <= 0) return this.detonate(); }
    // out of world
    if (this.y < g.world.seaY - 0.5) { g.splash(this.x); return this.kill(); }
    if (this.x < -40 || this.x > g.W + 40 || this.y > g.H + 90 || this.age > 14) return this.kill();
  }

  update(dt) {
    this.acc += dt;
    while (this.acc >= SIM_DT && this.alive) { this.step(SIM_DT); this.acc -= SIM_DT; }
    if (!this.alive) return;
    this.mesh.position.set(this.x, this.y, -0.6);
    if (this.kind === 'bullet' || this.kind === 'rope') this.mesh.rotation.z = Math.atan2(this.vy, this.vx) - Math.PI / 2;
    else { this.spin += dt * (this.vx * 0.6); this.mesh.rotation.z = -this.spin; }
    this.mesh.rotation.y += dt * 4;
    const W = this.game.world;
    if (Math.random() < 0.9) W.fxAdd.spawn({ x: this.x, y: this.y, z: -0.6 + rand(-0.3, 0.3), vx: rand(-1, 1), vy: rand(-1, 1), life: rand(0.4, 0.8), size: rand(0.5, 1.0), color: this.trail, shape: pick([0, 3, 1]), drag: 3 });
    if (this.kind === 'grenade' && Math.random() < 0.2) W.fxAdd.spawn({ x: this.x, y: this.y + 0.6, vx: 0, vy: 2, life: 0.4, size: 0.6, color: '#ffef9a', shape: 3 });
  }

  detonate() {
    if (!this.alive) return;
    const g = this.game;
    g.explode(this.x, this.y, this.radius, this.damage, { owner: this.owner, look: this.look });
    if (this.clusters) {
      for (let i = 0; i < this.clusters; i++) {
        const a = Math.PI / 2 + rand(-1.0, 1.0) * g.env.grav;
        const sp = rand(14, 24);
        g.projectiles.push(new Projectile(g, { x: this.x, y: this.y + 0.8 * g.env.grav, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * g.env.grav, kind: 'bullet', look: 'miniplush', radius: 1.7, damage: 14, windK: 0.4, owner: this.owner, trail: '#ffd6a8', age: -0.5 }));
      }
    }
    this.kill();
  }

  kill() { this.alive = false; this.game.scene.remove(this.mesh); }
}

class Mine {
  constructor(game, x, y, owner) {
    this.game = game; this.x = x; this.y = y; this.vx = 0; this.vy = 0; this.owner = owner; this.armed = false; this.trigger = -1; this.alive = true;
    this.mesh = makeProjectileMesh('candy');
    this.light = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: '#7dffb0' }));
    this.light.position.set(0, 0.45, 0.2); this.mesh.add(this.light);
    game.scene.add(this.mesh);
  }
  update(dt) {
    const g = this.game, T = g.terrain;
    if (!T.solid(this.x, this.y - 0.55 * g.env.grav)) { this.vy -= GRAVITY * g.env.grav * dt; this.y += this.vy * dt; this.x += this.vx * dt; }
    else { this.vy = 0; this.vx *= 0.8; while (T.solid(this.x, this.y - 0.4 * g.env.grav)) this.y += 0.05 * g.env.grav; }
    if (this.y < g.world.seaY - 0.5) { g.splash(this.x); this.remove(); return; }
    if (this.armed && this.trigger < 0) {
      for (const f of g.fluffs) if (f.alive && Math.hypot(f.x - this.x, f.cy - this.y) < 2.6) { this.trigger = 1.0; Sfx.alarm(); break; }
    }
    if (this.trigger >= 0) { this.trigger -= dt; if (this.trigger <= 0) return this.detonate(); }
    this.mesh.position.set(this.x, this.y, -0.6);
    this.mesh.rotation.y += dt;
    const blink = this.trigger >= 0 ? (Math.sin(performance.now() * 0.04) > 0) : this.armed ? (Math.sin(performance.now() * 0.006) > 0.6) : false;
    this.light.material.color.set(this.trigger >= 0 ? (blink ? '#ff3060' : '#ffffff') : this.armed ? (blink ? '#ff6fa0' : '#5a2040') : '#7dffb0');
  }
  detonate() { if (!this.alive) return; this.remove(); this.game.explode(this.x, this.y, 2.9, 38, { owner: this.owner, look: 'candy' }); }
  remove() { this.alive = false; this.game.scene.remove(this.mesh); }
}

const BEAM_FRAG = `uniform float uT; varying vec2 vUv;
vec3 hue(float h){ return clamp(abs(mod(h*6.0+vec3(0.,4.,2.),6.)-3.)-1.,0.,1.); }
void main(){ float x = abs(vUv.x - 0.5) * 2.0; float core = smoothstep(1.0, 0.0, x); vec3 c = mix(hue(fract(vUv.y * 2.0 - uT * 1.5 + vUv.x)), vec3(1.0), pow(core, 4.0));
  gl_FragColor = vec4(c * core * (0.6 + 0.4 * sin(vUv.y * 40.0 - uT * 30.0)), 1.0); }`;

class Beam {
  constructor(game, x, y, owner, radius, damage) {
    this.game = game; this.x = x; this.y = y; this.t = 0; this.alive = true; this.fired = false; this.owner = owner; this.radius = radius; this.damage = damage;
    this.mat = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 } }, vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`, fragmentShader: BEAM_FRAG, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.mat);
    this.mesh.renderOrder = 28;
    game.scene.add(this.mesh);
    Sfx.beam();
  }
  update(dt) {
    this.t += dt; this.mat.uniforms.uT.value = this.t;
    const top = this.game.H + 70, k = clamp(this.t / 0.55, 0, 1);
    const bottom = lerp(top, this.y, 1 - Math.pow(1 - k, 3));
    const w = (this.t < 0.6 ? 1.5 : 5.5 * Math.max(0, 1 - (this.t - 0.6) / 0.7)) + 0.01;
    this.mesh.scale.set(w, top - bottom + 0.01, 1);
    this.mesh.position.set(this.x, (top + bottom) / 2, 0.5);
    if (Math.random() < 0.8) this.game.world.fxAdd.spawn({ x: this.x + rand(-1.5, 1.5), y: bottom + rand(0, 6), vx: rand(-6, 6), vy: rand(2, 9), life: 0.6, size: rand(0.6, 1.4), color: pick(['#ff8fd0', '#ffe27a', '#8fd3ff', '#b9a2ff']), shape: 3 });
    if (!this.fired && this.t > 0.6) {
      this.fired = true;
      this.game.explode(this.x, this.y, this.radius, this.damage, { owner: this.owner, look: 'rainbow' });
      this.game.explode(this.x, this.y - 2.2, this.radius * 0.7, 0, { owner: this.owner, look: 'rainbow', silent: true });
    }
    if (this.t > 1.35) { this.alive = false; this.game.scene.remove(this.mesh); this.mat.dispose(); }
  }
}

// deterministic ballistic simulation used by trajectory preview & AI
function simulateShot(game, owner, x, y, vx, vy, w, maxT = 7, collect = null) {
  const env = game.env, T = game.terrain;
  let t = 0;
  while (t < maxT) {
    vx += env.wind * WIND_ACC * (w.windK || 0) * SIM_DT;
    vy -= env.grav * GRAVITY * SIM_DT;
    x += vx * SIM_DT; y += vy * SIM_DT; t += SIM_DT;
    if (collect && ((t / SIM_DT) | 0) % 3 === 0) collect.push(x, y);
    if (T.solid(x, y)) return { x, y, t, hit: 'terrain' };
    for (const f of game.fluffs) if (f.alive && (f !== owner || t > 0.25) && Math.hypot(x - f.x, y - f.cy) < FLUFF_R + 0.3) return { x, y, t, hit: 'fluff', fluff: f };
    if (y < game.world.seaY - 0.5 || x < -40 || x > game.W + 40 || y > game.H + 90) return { x, y, t, hit: 'out' };
  }
  return { x, y, t, hit: 'timeout' };
}
