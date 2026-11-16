// ───────────────────────── Game core: renderer, loop, camera, input, menu showcase ─────────────────────────
class Game {
  constructor() {
    this.W = 160; this.H = 80;
    const q = Q();
    this.canvas = $('#gl');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: q.aa, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, q.pixelRatio));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.setClearColor(0xf6dff3);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.5, 900);
    this.world = new World(this.scene, this.W, this.H);
    this.terrain = new Terrain(this.scene, this.W, this.H, 4);
    this.env = { grav: 1, wind: 0 };
    this.fluffs = []; this.players = []; this.projectiles = []; this.mines = []; this.beams = []; this.timers = []; this.tweens = [];
    this.deck = new Deck();
    this.ui = new UI(this);
    this.butterflies = new Butterflies(this, 0);
    this.state = 'menu'; this.phase = null; this.turnId = 0;
    this.aim = { angle: 0.8, power: 0.65 }; this.aimPoint = null; this.weapon = 'bazooka';
    this.turnFx = {}; this.antiGrav = 0; this.storm = 0; this.stamina = STAMINA_MAX; this.turnTime = 0; this.retreatTime = 0; this.blocking = 0;
    this.stats = { damage: {} };
    this.cam = { x: 80, y: 30, dist: 40, tx: 80, ty: 30, tdist: 40, shake: 0, manualT: 0, punch: 0 };
    this.input = { left: false, right: false };
    this.pointers = new Map();
    this.mouseWorld = new THREE.Vector3(80, 30, 0);
    this.clock = new THREE.Clock(); this.time = 0;
    this.showcase = [];
    this.buildAimVisuals();
    this.bindInput();
    addEventListener('resize', () => this.resize());
    Bus.on('profile', () => this.refreshShowcase());
    this.menuArena();
    this.renderer.setAnimationLoop(() => this.loop());
  }

  // ── helpers ──
  later(t, fn, blocking = true) { this.timers.push({ t, fn, blocking }); }
  sleep(t) { return new Promise((r) => this.later(t, r, false)); }
  get active() { return this.state === 'playing'; }
  get currentPlayer() { return this.players[this.turnIndex] || null; }
  get activeFluff() { const P = this.currentPlayer; return P ? P.fluffs[P.fluffTurn] : null; }
  isHumanTurn() { const P = this.currentPlayer; return this.state === 'playing' && P && !P.ai; }
  handOwner() {
    const P = this.currentPlayer;
    if (P && !P.ai) return P;
    const humans = this.players.filter((p) => !p.ai);
    return humans.length === 1 ? humans[0] : this.lastHuman || null;
  }

  project(x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    if (v.z > 1) return null;
    return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight };
  }

  screenToWorld(sx, sy, z = -1) {
    const v = new THREE.Vector3((sx / innerWidth) * 2 - 1, -(sy / innerHeight) * 2 + 1, 0.5).unproject(this.camera);
    const dir = v.sub(this.camera.position).normalize();
    const t = (z - this.camera.position.z) / dir.z;
    return this.camera.position.clone().addScaledVector(dir, t);
  }

  viewRect() {
    const hh = Math.tan((this.camera.fov * Math.PI) / 360) * (this.cam.dist + 1), hw = hh * this.camera.aspect;
    return { x0: this.cam.x - hw, x1: this.cam.x + hw, y0: this.cam.y - hh, y1: this.cam.y + hh, hw, hh };
  }

  resize() {
    this.renderer.setSize(innerWidth, innerHeight);
    this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix();
    this.world.resize();
    if (this.state === 'menu') this.menuShowcase(this.showcaseEdit);
  }

  // ── aim visuals ──
  buildAimVisuals() {
    const N = 160;
    this.trajPos = new Float32Array(N * 3); this.trajA = new Float32Array(N);
    const g = new THREE.BufferGeometry();
    g.setAttribute('aI', new THREE.BufferAttribute(new Float32Array(N).map((_, i) => i), 1));
    g.setAttribute('position', new THREE.BufferAttribute(this.trajPos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aA', new THREE.BufferAttribute(this.trajA, 1).setUsage(THREE.DynamicDrawUsage));
    this.trajMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: false,
      uniforms: { uTime: { value: 0 }, uScale: { value: innerHeight * 0.5 } },
      vertexShader: `attribute float aA; attribute float aI; uniform float uTime; uniform float uScale; varying float vA; varying float vI;
        void main(){ vA = aA; vI = aI; vec4 mv = modelViewMatrix*vec4(position,1.); gl_PointSize = (0.9 + 0.35*sin(uTime*8.0 - vI*0.6)) * (0.55 + 0.45*aA) * uScale / max(1.0,-mv.z); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `varying float vA; varying float vI; uniform float uTime; void main(){ vec2 p = gl_PointCoord - 0.5; float d = length(p);
        float a = smoothstep(0.5, 0.36, d) * vA;
        vec3 c = mix(vec3(0.42,0.29,0.77), vec3(0.93,0.27,0.62), 0.5+0.5*sin(vI*0.35 - uTime*4.0));
        c = mix(c, vec3(1.0), smoothstep(0.22, 0.05, d));
        c = mix(vec3(1.0), c, smoothstep(0.5, 0.4, d) + 0.0);
        if (a < 0.02) discard; gl_FragColor = vec4(c, a); }`,
    });
    this.traj = new THREE.Points(g, this.trajMat); this.traj.frustumCulled = false; this.traj.renderOrder = 40;
    this.scene.add(this.traj);
    // reticle (M3 cookie shape ring)
    const shape = new THREE.Shape();
    const sp = SHAPES.cookie9;
    for (let i = 0; i <= 90; i++) { const t = (i / 90) * TAU, r = 1 + sp.a * Math.cos(sp.n * t); i ? shape.lineTo(Math.cos(t) * r, Math.sin(t) * r) : shape.moveTo(Math.cos(t) * r, Math.sin(t) * r); }
    const hole = new THREE.Path(); hole.absarc(0, 0, 0.72, 0, TAU, true); shape.holes.push(hole);
    this.reticle = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color: '#ff5fb0', transparent: true, opacity: 0.9, depthTest: false }));
    this.reticle.renderOrder = 41; this.reticle.scale.setScalar(0.8);
    this.scene.add(this.reticle);
    this.ropeMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1, 8), new THREE.MeshLambertMaterial({ color: '#ffc6ea', emissive: '#a0507a' }));
    this.ropeMesh.visible = false; this.scene.add(this.ropeMesh);
  }

  aimDir() { return { x: Math.cos(this.aim.angle), y: Math.sin(this.aim.angle) }; }

  updateAimVisuals() {
    const f = this.activeFluff, w = WEAPON_BY_ID[this.weapon];
    const show = this.state === 'playing' && this.phase === 'aim' && f && f.alive && (!this.currentPlayer.ai || true);
    this.traj.visible = false; this.reticle.visible = false;
    if (!show) return;
    this.trajMat.uniforms.uTime.value = this.time;
    this.reticle.rotation.z = this.time * 1.2;
    if (w.kind === 'target') {
      if (this.aimPoint) { this.reticle.visible = true; this.reticle.position.set(this.aimPoint.x, this.aimPoint.y + 0.8, 0.5); this.reticle.scale.setScalar(1.6 + Math.sin(this.time * 5) * 0.15); }
      return;
    }
    const d = this.aimDir();
    this.reticle.visible = true; this.reticle.scale.setScalar(0.8);
    const rr = w.kind === 'melee' ? 2.6 : 3 + this.aim.power * 4;
    this.reticle.position.set(f.x + d.x * rr, f.cy + d.y * rr, 0.3);
    if (w.kind === 'melee' || w.kind === 'mine') return;
    const pts = [];
    if (w.kind === 'rope') { for (let i = 1; i < 40; i++) pts.push(f.x + d.x * i * (w.range / 40), f.cy + d.y * i * (w.range / 40)); }
    else {
      const sp = w.speed * this.aim.power;
      simulateShot(this, f, f.x + d.x * 1.6, f.cy + 0.4 + d.y * 1.6, d.x * sp, d.y * sp, w, 5, pts);
    }
    const total = pts.length / 2;
    const n = Math.min(160, this.turnFx.aim ? total : Math.max(8, Math.floor(total * 0.38)));
    for (let i = 0; i < n; i++) {
      this.trajPos[i * 3] = pts[i * 2]; this.trajPos[i * 3 + 1] = pts[i * 2 + 1]; this.trajPos[i * 3 + 2] = 0.3;
      this.trajA[i] = this.turnFx.aim ? 1 : clamp(1.15 - i / n, 0.15, 1);
    }
    this.traj.geometry.setDrawRange(0, n);
    this.traj.geometry.attributes.position.needsUpdate = true; this.traj.geometry.attributes.aA.needsUpdate = true;
    this.traj.visible = true;
  }

  // ── input ──
  bindInput() {
    const c = this.canvas;
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('pointerdown', (e) => {
      Sfx.init();
      c.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, btn: e.button, t: performance.now() });
      if (this.ui.fabMenu && this.ui.fabMenu.classList.contains('open')) this.ui.toggleFabMenu(false);
      $('#cardPop') && ($('#cardPop').remove(), $$('.gcard.sel').forEach((x) => x.classList.remove('sel')));
      if (this.pointers.size === 1 && e.button === 0) this.aimFromPointer(e.clientX, e.clientY, true);
    });
    c.addEventListener('pointermove', (e) => {
      this.mouseWorld.copy(this.screenToWorld(e.clientX, e.clientY, -1));
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (this.pointers.size >= 2) {
        const [a, b] = [...this.pointers.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.pinchD) this.cam.tdist = clamp(this.cam.tdist * (this.pinchD / dist), 16, 90);
        this.pinchD = dist;
        this.pan(dx / 2, dy / 2);
      } else if (p.btn === 2 || p.btn === 1) this.pan(dx, dy);
      else if (p.btn === 0) this.aimFromPointer(e.clientX, e.clientY, false);
    });
    const up = (e) => {
      const p = this.pointers.get(e.pointerId);
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinchD = null;
      if (p && p.btn === 0 && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) < 10 && WEAPON_BY_ID[this.weapon].kind === 'target' && this.isHumanTurn() && this.phase === 'aim') {
        const w = this.screenToWorld(e.clientX, e.clientY, -1);
        const x = clamp(w.x, 1, this.W - 1);
        this.aimPoint = { x, y: this.terrain.surfaceY(x) };
        Sfx.pop();
      }
    };
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    c.addEventListener('wheel', (e) => { e.preventDefault(); this.cam.tdist = clamp(this.cam.tdist * (1 + Math.sign(e.deltaY) * 0.1), 16, 90); }, { passive: false });
    addEventListener('keydown', (e) => this.key(e, true));
    addEventListener('keyup', (e) => this.key(e, false));
    addEventListener('pointerdown', () => Sfx.init(), { once: true });
  }

  pan(dx, dy) {
    const k = (this.cam.dist * 0.0021) * (900 / innerHeight);
    this.cam.tx -= dx * k; this.cam.ty += dy * k; this.cam.manualT = 3.5;
  }

  aimFromPointer(sx, sy) {
    if (!this.isHumanTurn() || this.phase !== 'aim') return;
    const f = this.activeFluff, w = WEAPON_BY_ID[this.weapon];
    if (!f || w.kind === 'target') return;
    const p = this.screenToWorld(sx, sy, -1);
    const dx = p.x - f.x, dy = p.y - f.cy;
    if (Math.hypot(dx, dy) < 0.6) return;
    this.aim.angle = Math.atan2(dy, dx);
    this.aim.power = clamp(Math.hypot(dx, dy) / 16, 0.12, 1);
    f.facing = dx >= 0 ? 1 : -1;
    this.cam.manualT = 0;
  }

  key(e, down) {
    if (e.target && e.target.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    if (['arrowleft', 'a'].includes(k)) this.input.left = down;
    if (['arrowright', 'd'].includes(k)) this.input.right = down;
    if (!down) return;
    if (k === 'escape' && this.state === 'playing') { this.pause(); return; }
    if (!this.isHumanTurn()) return;
    if (['arrowup', 'w'].includes(k)) this.humanJump();
    if (['arrowdown', 's'].includes(k)) { if (this.phase === 'aim' || this.phase === 'retreat') this.activeFluff.jump(true); }
    if (k === ' ' || k === 'enter') { e.preventDefault(); this.humanFire(); }
    if (k === 'q') this.aim.angle += 0.05;
    if (k === 'e') this.aim.angle -= 0.05;
    if (k === 'r') this.aim.power = clamp(this.aim.power + 0.05, 0.1, 1);
    if (k === 'f') this.aim.power = clamp(this.aim.power - 0.05, 0.1, 1);
    if (k === 'tab') { e.preventDefault(); this.focusActive(); }
    const n = parseInt(k, 10);
    if (n >= 1 && n <= WEAPONS.length) this.selectWeapon(WEAPONS[n - 1].id);
  }

  focusActive() { this.cam.manualT = 0; }

  // ── camera ──
  updateCamera(dt) {
    const c = this.cam;
    let target = null;
    if (this.state === 'menu') { /* set by showcase */ }
    else if (this.followObj && (this.followObj.alive !== false)) target = this.followObj;
    else if (this.activeFluff && this.activeFluff.alive) target = { x: this.activeFluff.x, y: this.activeFluff.cy };
    c.manualT -= dt;
    if (target && c.manualT <= 0) {
      c.tx = target.x; c.ty = target.y + 4;
      const base = this.phase === 'flying' ? 34 : this.phase === 'aim' ? 42 : 46;
      if (!this.userZoom) c.tdist = damp(c.tdist, base, 1.5, dt);
    }
    const vr = this.viewRect();
    if (this.state !== 'menu') { c.tx = clamp(c.tx, Math.min(this.W / 2, vr.hw - 10), Math.max(this.W / 2, this.W - vr.hw + 10)); c.ty = clamp(c.ty, Math.max(vr.hh - 2, 10), this.H + 10); }
    const lam = this.followObj ? 5 : 3.2;
    c.x = damp(c.x, c.tx, lam, dt); c.y = damp(c.y, c.ty, lam, dt);
    c.punch = damp(c.punch, 0, 4, dt);
    c.dist = damp(c.dist, c.tdist - c.punch, 3, dt);
    c.shake = Math.max(0, c.shake - dt * 2.2);
    const sh = Settings.shake ? c.shake * c.shake : 0;
    const ox = (Math.random() - 0.5) * sh * 2.2, oy = (Math.random() - 0.5) * sh * 2.2;
    this.camera.position.set(c.x + ox, c.y + c.dist * 0.2 + oy, c.dist);
    this.camera.lookAt(c.x + ox * 0.5, c.y + oy * 0.5, -1);
  }

  // ── menu arena & showcase ──
  menuArena() {
    this.terrain.build(TERRAIN_THEMES[0]);
    this.terrain.generate(1234567);
    const T = this.terrain;
    for (let cx = 56 * T.res; cx < 104 * T.res; cx++) {
      const x = cx / T.res, edge = Math.min(x - 56, 104 - x);
      const top = 22 - Math.max(0, 7 - edge) ** 2 * 0.25;
      for (let cy = 0; cy < T.rows; cy++) T.mask[cy * T.cols + cx] = cy / T.res < top ? 255 : 0;
    }
    for (let i = 0; i < T.mask.length; i++) { T.data[i * 4] = T.mask[i]; T.data[i * 4 + 1] = 0; }
    T.tex.needsUpdate = true; T.updateMini();
    this.butterflies.clear();
    for (let i = 0; i < 5; i++) this.butterflies.spawn({ x: rand(60, 110), y: rand(28, 40) });
  }

  refreshShowcase() { for (let i = 0; i < this.showcase.length; i++) this.showcase[i].setProfile(Profiles[i]); }

  menuShowcase(editIdx = -1) {
    this.showcaseEdit = editIdx;
    if (!this.showcase.length) {
      for (let i = 0; i < 4; i++) { const m = new FluffModel(Profiles[i]); this.scene.add(m.group); this.showcase.push(m); }
    }
    const surf = this.terrain.surfaceY(80, 40);
    this.showcase.forEach((m, i) => {
      m.group.visible = editIdx < 0 || editIdx === i;
      const x = editIdx >= 0 ? 80 : 73.5 + i * 4.4;
      m.group.position.set(x, this.terrain.surfaceY(x, 40) + 1.3, -1);
      m.group.scale.setScalar(editIdx >= 0 ? 1.6 : 1.25);
    });
    const dist = editIdx >= 0 ? 13 : 24;
    const hh = Math.tan((this.camera.fov * Math.PI) / 360) * dist, hw = hh * this.camera.aspect;
    const pgEl = $('.menu-page');
    const panelFrac = clamp(pgEl ? pgEl.getBoundingClientRect().right / innerWidth : 0.5, 0.3, 0.78);
    const targetFrac = panelFrac + (1 - panelFrac) / 2;
    this.cam.tx = 80 - (targetFrac - 0.5) * 2 * hw;
    this.cam.ty = surf + (editIdx >= 0 ? 1.8 : 2.6);
    this.cam.tdist = dist;
  }

  // ── main loop ──
  loop() {
    const dt = Math.min(0.05, this.clock.getDelta());
    this.time += dt;
    const t = this.time;
    const paused = this.state === 'paused';
    if (!paused) {
      for (let i = this.timers.length - 1; i >= 0; i--) { const T = this.timers[i]; T.t -= dt; if (T.t <= 0) { this.timers.splice(i, 1); T.fn(); } }
      for (let i = this.tweens.length - 1; i >= 0; i--) { const T = this.tweens[i]; T.t += dt; const k = Math.min(1, T.t / T.dur); T.fn(k); if (k >= 1) { this.tweens.splice(i, 1); T.done && T.done(); } }
      this.world.update(dt, t);
      this.terrain.update(dt, t);
      this.butterflies.update(dt, t);
      if (this.state === 'menu') {
        for (const m of this.showcase) { if (!m.group.visible) continue; m.lookTarget = this.mouseWorld.clone().setZ(14); m.update(dt, t, { grounded: true, wind: Math.sin(t * 0.7) * 2 }); }
      } else if (this.state === 'playing' || this.state === 'over') this.updateMatch(dt, t);
      this.updateCamera(dt);
    }
    this.updateAimVisuals();
    if (this.state === 'playing' || this.state === 'over') this.ui.updateHud(dt);
    this.renderer.render(this.scene, this.camera);
  }
}
